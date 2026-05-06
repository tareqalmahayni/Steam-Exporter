import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  parseGamesFromHomeHtml,
  pullAllStats,
  runWithPrefetch,
  clearStatsCache,
  getDateRangeIso,
  type GameInfo,
} from "../lib/steamworks";
import { generateExcel } from "../lib/excel";
import { logger } from "../lib/logger";
import { bookmarkletScript } from "../lib/bookmarklet-script";

const router = Router();

const BASE_GAMES = "https://partner.steamgames.com";
const BASE_PARTNER = "https://partner.steampowered.com";

interface BrowserJob {
  sessionId: string;
  granularity: string;
  customStartIso?: string;
  customEndIso?: string;
  games: GameInfo[];
  htmlCache: Map<string, string>;
  steamgamesSubmitted: boolean;
  steampoweredSubmitted: boolean;
  status:
    | "awaiting_steamgames"
    | "awaiting_steampowered"
    | "processing"
    | "complete"
    | "failed";
  excelBuffer?: Buffer;
  filename?: string;
  errorMessage?: string;
  createdAt: number;
}

/** URLs the bookmarklet fetches to show wishlist totals in the picker. */
function wishlistUrlsFor(games: GameInfo[]): string[] {
  return games.map((g) => `${BASE_PARTNER}/app/wishlist/${g.appId}/`);
}

// One active job at a time (single-user tool). Older completed jobs kept by id
// for download until 2h TTL.
let activeJob: BrowserJob | null = null;
const completedJobs = new Map<string, BrowserJob>();

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, j] of completedJobs.entries()) {
    if (j.createdAt < cutoff) completedJobs.delete(id);
  }
}, 60_000);

function steamgamesUrlsFor(games: GameInfo[]): string[] {
  return games.map((g) => `${BASE_GAMES}/apps/navtrafficstats/${g.appId}`);
}

/**
 * IMPORTANT: these URLs MUST exactly match what `fetchWishlists`,
 * `fetchSales`, `fetchFollowers` request inside `pullAllStats`. The prefetch
 * cache is keyed by exact URL string — a mismatch is a silent prefetch miss
 * and that metric ends up empty. We import the same `getDateRangeIso` the
 * fetchers use to guarantee identical date strings.
 *
 * Note: wishlist URL is shared by both `fetchWishlists` and `fetchFollowers`,
 * so we emit it once per game.
 */
function steampoweredUrlsFor(
  games: GameInfo[],
  granularity: string,
  customStartIso?: string,
  customEndIso?: string,
): string[] {
  const { startIso, endIso } = getDateRangeIso(granularity, {
    startIso: customStartIso,
    endIso: customEndIso,
  });
  const urls: string[] = [];
  for (const g of games) {
    urls.push(`${BASE_PARTNER}/app/wishlist/${g.appId}/`);
    urls.push(`${BASE_PARTNER}/app/details/${g.appId}/?dateStart=${startIso}&dateEnd=${endIso}`);
  }
  return urls;
}

/** Sales URLs only (for fetching after user picks games + dates). */
function salesUrlsFor(
  games: GameInfo[],
  granularity: string,
  customStartIso?: string,
  customEndIso?: string,
): string[] {
  const { startIso, endIso } = getDateRangeIso(granularity, {
    startIso: customStartIso,
    endIso: customEndIso,
  });
  return games.map(
    (g) =>
      `${BASE_PARTNER}/app/details/${g.appId}/?dateStart=${startIso}&dateEnd=${endIso}`,
  );
}

// ─── POST /browser-pull/init ────────────────────────────────────────────────
// Called by bookmarklet on partner.steamgames.com after fetching /home.
// Server parses games list and creates a new active job.
router.post("/browser-pull/init", (req, res): void => {
  const { homeHtml, granularity = "monthly" } = (req.body ?? {}) as {
    homeHtml?: string;
    granularity?: string;
  };
  if (!homeHtml || typeof homeHtml !== "string") {
    res.status(400).json({ error: "missing_home_html" });
    return;
  }

  const { games } = parseGamesFromHomeHtml(homeHtml);
  if (games.length === 0) {
    res.status(400).json({
      error: "no_games",
      message: "No games found in /home page. Are you logged in to Steamworks?",
    });
    return;
  }

  const sessionId = uuidv4();
  activeJob = {
    sessionId,
    granularity,
    games,
    htmlCache: new Map(),
    steamgamesSubmitted: false,
    steampoweredSubmitted: false,
    status: "awaiting_steamgames",
    createdAt: Date.now(),
  };

  logger.info(
    { sessionId, gameCount: games.length, granularity },
    "browser-pull job initialized",
  );

  res.json({
    sessionId,
    gameCount: games.length,
    games: games.map((g) => ({ appId: g.appId, name: g.name })),
    steamgamesUrls: steamgamesUrlsFor(games),
    wishlistUrls: wishlistUrlsFor(games),
  });
});

// ─── POST /browser-pull/configure ───────────────────────────────────────────
// Bookmarklet calls this after the user picks games + granularity in the
// in-page overlay. Server filters the active job's game list and updates
// granularity, returning the URL plan computed from those selections.
router.post("/browser-pull/configure", (req, res): void => {
  const {
    sessionId,
    selectedAppIds,
    granularity,
    customStartIso,
    customEndIso,
  } = (req.body ?? {}) as {
    sessionId?: string;
    selectedAppIds?: number[];
    granularity?: string;
    customStartIso?: string;
    customEndIso?: string;
  };
  if (!sessionId || !Array.isArray(selectedAppIds) || !granularity) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }
  if (granularity === "custom" && (!customStartIso || !customEndIso)) {
    res.status(400).json({ error: "missing_custom_dates" });
    return;
  }
  if (!activeJob || activeJob.sessionId !== sessionId) {
    res.status(404).json({ error: "session_not_found" });
    return;
  }
  const idSet = new Set(selectedAppIds);
  const filtered = activeJob.games.filter((g) => idSet.has(g.appId));
  if (filtered.length === 0) {
    res.status(400).json({ error: "no_games_selected" });
    return;
  }
  activeJob.games = filtered;
  activeJob.granularity = granularity;
  activeJob.customStartIso = customStartIso;
  activeJob.customEndIso = customEndIso;
  logger.info(
    { sessionId, gameCount: filtered.length, granularity, customStartIso, customEndIso },
    "browser-pull configured",
  );
  res.json({
    ok: true,
    gameCount: filtered.length,
    salesUrls: salesUrlsFor(filtered, granularity, customStartIso, customEndIso),
  });
});

// ─── GET /browser-pull/active ───────────────────────────────────────────────
// Cross-domain handoff: bookmarklet on partner.steampowered.com calls this
// to find out the sessionId + URLs it needs to fetch.
router.get("/browser-pull/active", (_req, res): void => {
  if (!activeJob) {
    res.status(404).json({ error: "no_active_session" });
    return;
  }
  res.json({
    sessionId: activeJob.sessionId,
    status: activeJob.status,
    gameCount: activeJob.games.length,
    games: activeJob.games.map((g) => ({ appId: g.appId, name: g.name })),
    steamgamesUrls: steamgamesUrlsFor(activeJob.games),
    wishlistUrls: wishlistUrlsFor(activeJob.games),
  });
});

// ─── POST /browser-pull/submit ──────────────────────────────────────────────
// Bookmarklet POSTs the raw HTMLs it fetched. Once both domains have been
// submitted, server runs the existing parsers against the cached HTML and
// generates the Excel.
router.post("/browser-pull/submit", async (req, res): Promise<void> => {
  const { sessionId, domain, htmlByUrl } = (req.body ?? {}) as {
    sessionId?: string;
    domain?: "steamgames" | "steampowered";
    htmlByUrl?: Record<string, string>;
  };
  if (!sessionId || !domain || !htmlByUrl) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }
  if (!activeJob || activeJob.sessionId !== sessionId) {
    res.status(404).json({ error: "session_not_found" });
    return;
  }

  for (const [url, html] of Object.entries(htmlByUrl)) {
    if (typeof html === "string" && html.length > 0) {
      activeJob.htmlCache.set(url, html);
    }
  }
  if (domain === "steamgames") activeJob.steamgamesSubmitted = true;
  if (domain === "steampowered") activeJob.steampoweredSubmitted = true;

  // Advance status so /active reporting is accurate.
  if (activeJob.status === "awaiting_steamgames" && activeJob.steamgamesSubmitted) {
    activeJob.status = "awaiting_steampowered";
  }

  logger.info(
    {
      sessionId,
      domain,
      pages: Object.keys(htmlByUrl).length,
      cacheSize: activeJob.htmlCache.size,
      steamgamesSubmitted: activeJob.steamgamesSubmitted,
      steampoweredSubmitted: activeJob.steampoweredSubmitted,
    },
    "browser-pull submit",
  );

  if (!(activeJob.steamgamesSubmitted && activeJob.steampoweredSubmitted)) {
    res.json({
      ok: true,
      status: activeJob.status,
      nextStep:
        domain === "steamgames"
          ? "Open partner.steampowered.com and click the bookmark again."
          : "Open partner.steamgames.com and click the bookmark again.",
    });
    return;
  }

  // Both halves submitted — finalize.
  // Idempotency guard: if a duplicate submit arrives while we're already
  // processing/complete, just return the current state instead of double-running.
  if (activeJob.status === "processing") {
    res.json({ ok: true, status: "processing" });
    return;
  }
  const job = activeJob;
  job.status = "processing";

  try {
    clearStatsCache();
    const stats = await runWithPrefetch(job.htmlCache, () =>
      pullAllStats(
        job.games.map((g) => g.appId),
        job.games,
        "", // sessionid not used — prefetch cache is the source
        "",
        job.granularity,
        () => {
          /* progress unused for browser-pull */
        },
        () => false,
      ),
    );

    const date = new Date().toISOString().slice(0, 10);
    const filename = `steamworks_pull_${date}_${job.granularity}.xlsx`;
    const gameErrors = stats.flatMap((s) =>
      s.errors.map((e) => ({ appId: s.appId, gameName: s.gameName, error: e })),
    );
    const buf = await generateExcel(stats, job.granularity, [], gameErrors);

    job.excelBuffer = buf;
    job.filename = filename;
    job.status = "complete";
    completedJobs.set(sessionId, job);
    activeJob = null;

    logger.info(
      { sessionId, gameCount: job.games.length, excelBytes: buf.length },
      "browser-pull complete",
    );

    res.json({
      ok: true,
      status: "complete",
      downloadUrl: `/api/browser-pull/download/${sessionId}`,
    });
  } catch (e) {
    job.status = "failed";
    job.errorMessage = (e as Error).message;
    logger.error({ err: e, sessionId }, "browser-pull finalize failed");
    res.status(500).json({
      error: "finalize_failed",
      message: (e as Error).message,
    });
  }
});

// ─── GET /browser-pull/download/:sessionId ──────────────────────────────────
router.get("/browser-pull/download/:sessionId", (req, res): void => {
  const job = completedJobs.get(req.params["sessionId"] || "");
  if (!job || !job.excelBuffer) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${job.filename || "steamworks_pull.xlsx"}"`,
  );
  res.send(job.excelBuffer);
});

// ─── GET /bookmarklet.js ────────────────────────────────────────────────────
// Serves the bookmarklet payload script with our origin baked in so it knows
// where to POST data back to.
router.get("/bookmarklet.js", (req, res): void => {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ||
    req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ||
    req.get("host") ||
    "";
  const origin = `${proto}://${host}`;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(bookmarkletScript.replace(/__SERVER_ORIGIN__/g, origin));
});

export default router;
