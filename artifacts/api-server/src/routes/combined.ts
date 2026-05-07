/**
 * Milestone 7 — Combined Pull Data Alone web endpoint.
 *
 * Pulls wishlist via the proven Steam Partner Financial API for selected
 * games over a chosen window, parses uploaded traffic CSVs, runs them all
 * through the shared `processGame` + `buildCombinedWorkbook` pipeline, and
 * stores the resulting XLSX buffer in an in-memory job map (TTL: 2h).
 *
 * Routes:
 *   GET  /api/combined/setup        — health-style probe (financial-key + games)
 *   POST /api/combined/generate     — sync; runs the full pipeline
 *   GET  /api/combined/download/:id — streams the XLSX
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  GAME_SPECS,
  fetchWishlistRange,
  processGame,
  buildCombinedWorkbook,
  computeFinalStatus,
  expectedTrafficFilename,
  type DataType,
  type PerGame,
  type WishlistPullSummary,
} from "@workspace/combined-export";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// In-memory job store (no DB, per spec).
// ---------------------------------------------------------------------------

interface StoredJob {
  buffer: Buffer;
  filename: string;
  createdAt: number;
}

const JOBS = new Map<string, StoredJob>();
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_JOBS = 50;
const MAX_SELECTED = 5; // Spec: 5 known games.
const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB per uploaded CSV.

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of JOBS.entries()) {
    if (now - job.createdAt > TTL_MS) JOBS.delete(id);
  }
  // Hard cap: if still over the limit, evict oldest.
  if (JOBS.size > MAX_JOBS) {
    const sorted = [...JOBS.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toEvict = sorted.slice(0, JOBS.size - MAX_JOBS);
    for (const [id] of toEvict) JOBS.delete(id);
  }
}

// ---------------------------------------------------------------------------
// GET /api/combined/setup — surface what the UI needs to know up-front.
// ---------------------------------------------------------------------------

router.get("/combined/setup", (_req, res) => {
  pruneExpiredJobs();
  const hasFinancialKey = typeof process.env["STEAM_FINANCIAL_KEY"] === "string"
    && process.env["STEAM_FINANCIAL_KEY"]!.trim() !== "";
  res.json({
    status: hasFinancialKey ? "READY" : "MISSING_FINANCIAL_KEY",
    hasFinancialKey,
    games: GAME_SPECS.map((g) => ({
      id: g.id,
      cacheId: g.cacheId,
      appid: g.appid,
      displayName: g.displayName,
    })),
    defaultWindow: { startIso: "2026-04-30", endIso: "2026-05-06" },
  });
});

// ---------------------------------------------------------------------------
// POST /api/combined/generate
//   body: {
//     selectedAppIds: string[],            // 1..5 entries
//     dataType: "wishlist" | "traffic" | "both",
//     window: { startIso: string, endIso: string },
//     trafficCsvs: { [appid]: { fileName: string, text: string } }
//                                          // only required when dataType !== "wishlist"
//   }
//   → { jobId, filename, finalStatus, perGameStatus, warnings, errors }
// ---------------------------------------------------------------------------

interface GenerateBody {
  selectedAppIds?: unknown;
  dataType?: unknown;
  window?: unknown;
  trafficCsvs?: unknown;
}

function parseGenerateBody(body: GenerateBody): {
  ok: true;
  selected: typeof GAME_SPECS;
  dataType: DataType;
  window: { startIso: string; endIso: string };
  trafficCsvs: Record<string, { fileName: string; text: string }>;
} | { ok: false; error: string } {
  // selectedAppIds
  if (!Array.isArray(body.selectedAppIds) || body.selectedAppIds.length === 0) {
    return { ok: false, error: "selectedAppIds must be a non-empty array" };
  }
  if (body.selectedAppIds.length > MAX_SELECTED) {
    return { ok: false, error: `selectedAppIds may contain at most ${MAX_SELECTED} entries` };
  }
  const wantedIds = new Set(body.selectedAppIds.map((s) => String(s)));
  const selected = GAME_SPECS.filter((g) => wantedIds.has(g.appid) || wantedIds.has(g.id) || wantedIds.has(g.cacheId));
  if (selected.length === 0) {
    return { ok: false, error: "selectedAppIds did not match any known games" };
  }

  // dataType
  const dataType = body.dataType;
  if (dataType !== "wishlist" && dataType !== "traffic" && dataType !== "both") {
    return { ok: false, error: 'dataType must be "wishlist", "traffic", or "both"' };
  }

  // window
  if (typeof body.window !== "object" || body.window === null) {
    return { ok: false, error: "window must be {startIso, endIso}" };
  }
  const w = body.window as { startIso?: unknown; endIso?: unknown };
  const startIso = typeof w.startIso === "string" ? w.startIso : "";
  const endIso = typeof w.endIso === "string" ? w.endIso : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
    return { ok: false, error: "window.startIso / window.endIso must be YYYY-MM-DD" };
  }
  if (startIso > endIso) {
    return { ok: false, error: `window.startIso (${startIso}) is after window.endIso (${endIso})` };
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  if (endIso > todayIso) {
    return { ok: false, error: `window.endIso (${endIso}) is in the future (today=${todayIso})` };
  }

  // trafficCsvs
  const trafficCsvs: Record<string, { fileName: string; text: string }> = {};
  if (body.trafficCsvs && typeof body.trafficCsvs === "object") {
    for (const [appid, raw] of Object.entries(body.trafficCsvs as Record<string, unknown>)) {
      if (raw && typeof raw === "object") {
        const r = raw as { fileName?: unknown; text?: unknown };
        if (typeof r.fileName === "string" && typeof r.text === "string") {
          if (Buffer.byteLength(r.text, "utf8") > MAX_CSV_BYTES) {
            return { ok: false, error: `trafficCsvs[${appid}] exceeds ${MAX_CSV_BYTES} bytes` };
          }
          trafficCsvs[appid] = { fileName: r.fileName, text: r.text };
        }
      }
    }
  }

  return { ok: true, selected, dataType: dataType as DataType, window: { startIso, endIso }, trafficCsvs };
}

router.post("/combined/generate", async (req: Request, res: Response) => {
  pruneExpiredJobs();
  const parsed = parseGenerateBody(req.body ?? {});
  if (!parsed.ok) {
    res.status(400).json({ status: "BAD_REQUEST", error: parsed.error });
    return;
  }
  const { selected, dataType, window, trafficCsvs } = parsed;

  const apiKey = process.env["STEAM_FINANCIAL_KEY"];
  if ((dataType === "wishlist" || dataType === "both") && (!apiKey || apiKey.trim() === "")) {
    res.status(400).json({ status: "MISSING_FINANCIAL_KEY", error: "STEAM_FINANCIAL_KEY is not configured on the server." });
    return;
  }

  // Pull wishlist for each selected game (sequentially — same polite spacing
  // the CLI uses).
  const log: Array<{ game: string; event: string; detail: string }> = [];
  const wishlistByAppId = new Map<string, WishlistPullSummary>();
  if (dataType === "wishlist" || dataType === "both") {
    for (const spec of selected) {
      log.push({ game: spec.displayName, event: "PULLING_WISHLIST", detail: `${window.startIso} → ${window.endIso}` });
      try {
        const summary = await fetchWishlistRange({
          appid: spec.appid,
          startIso: window.startIso,
          endIso: window.endIso,
          apiKey,
        });
        wishlistByAppId.set(spec.appid, summary);
        log.push({ game: spec.displayName, event: "WISHLIST_PULLED", detail: `attempted=${summary.attempted} succeeded=${summary.succeeded} failed=${summary.failed}` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push({ game: spec.displayName, event: "WISHLIST_FAILED", detail: msg });
      }
    }
  }

  // Build per-game records using the shared processor.
  const perGame: PerGame[] = selected.map((spec) => {
    const summary = wishlistByAppId.get(spec.appid) ?? null;
    const csv = trafficCsvs[spec.appid] ?? null;
    if (dataType !== "wishlist") {
      log.push({ game: spec.displayName, event: csv ? "PARSING_TRAFFIC" : "TRAFFIC_CSV_MISSING", detail: csv ? csv.fileName : `Expected ${expectedTrafficFilename(spec, window)}` });
    }
    return processGame({
      spec,
      selected: true,
      dataType,
      expectedWindow: window,
      wishlistSummary: summary,
      wishlistMissingReason: (dataType !== "traffic" && !summary)
        ? `Wishlist pull returned no data for ${spec.displayName}`
        : null,
      trafficCsv: csv,
    });
  });

  const finalStatus = computeFinalStatus(perGame);
  const pullTimestamp = new Date().toISOString();

  log.push({ game: "(all)", event: "GENERATING_EXCEL", detail: `${perGame.length} games` });

  const buffer = await buildCombinedWorkbook({
    perGame,
    window,
    pullTimestamp,
    wishlistSourceLabel: dataType !== "traffic"
      ? `Steam Partner Financial API (live pull at ${pullTimestamp})`
      : "(wishlist not requested)",
    trafficSourceLabel: dataType !== "wishlist"
      ? `Uploaded traffic CSVs (${Object.keys(trafficCsvs).length} files)`
      : "(traffic not requested)",
    finalStatus,
    dataType,
  });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `Steamworks_Current_Pull_Combined_SelectedGames_${today}.xlsx`;
  const jobId = randomUUID();
  JOBS.set(jobId, { buffer, filename, createdAt: Date.now() });

  log.push({ game: "(all)", event: finalStatus, detail: `Workbook ${filename} ready (${(buffer.length / 1024).toFixed(1)} KB)` });

  res.json({
    status: finalStatus,
    jobId,
    filename,
    bytes: buffer.length,
    perGameStatus: perGame.map((g) => ({
      appid: g.spec.appid,
      displayName: g.spec.displayName,
      wishlistStatus: g.wishlistStatus,
      trafficStatus: g.trafficStatus,
      warningCount: g.warnings.length,
      errorCount: g.errors.length,
      warnings: g.warnings,
      errors: g.errors,
    })),
    log,
  });
});

// ---------------------------------------------------------------------------
// GET /api/combined/download/:jobId
// ---------------------------------------------------------------------------

router.get("/combined/download/:jobId", (req, res) => {
  pruneExpiredJobs();
  const { jobId } = req.params;
  const job = JOBS.get(jobId);
  if (!job) {
    res.status(404).json({ status: "NOT_FOUND", error: "Job not found or expired." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`);
  res.setHeader("Content-Length", String(job.buffer.length));
  res.send(job.buffer);
});

export default router;
