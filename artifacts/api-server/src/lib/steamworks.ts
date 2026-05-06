import * as cheerio from "cheerio";
import { logger } from "./logger";

export interface GameInfo {
  appId: number;
  name: string;
  type: string;
}

export interface ConnectionResult {
  publisherName: string;
  gameCount: number;
}

export interface GamesListResult {
  games: GameInfo[];
  skipped: GameInfo[];
}

export interface StatRow {
  date: string;
  [key: string]: string | number;
}

export interface GameStats {
  appId: number;
  gameName: string;
  wishlistData?: StatRow[];
  visitsData?: StatRow[];
  trafficData?: StatRow[];
  utmData?: StatRow[];
  salesData?: StatRow[];
  followersData?: StatRow[];
  reviewsData?: { positive: number; negative: number; score: string } | null;
  regionData?: StatRow[];
  errors: string[];
}

const BASE = "https://partner.steamgames.com";

function makeCookieHeader(sessionid: string, steamLoginSecure: string) {
  return `sessionid=${sessionid}; steamLoginSecure=${steamLoginSecure}`;
}

function isLoginRedirect(url: string | null): boolean {
  if (!url) return false;
  return url.includes("/login") || url.includes("steampowered.com/login");
}

async function fetchWithCookies(
  url: string,
  sessionid: string,
  steamLoginSecure: string,
  options: RequestInit = {}
): Promise<Response> {
  const resp = await fetch(url, {
    ...options,
    headers: {
      Cookie: makeCookieHeader(sessionid, steamLoginSecure),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/html, */*",
      "Accept-Language": "en-US,en;q=0.9",
      ...(options.headers || {}),
    },
    redirect: "manual",
  });
  return resp;
}

export async function testConnection(
  sessionid: string,
  steamLoginSecure: string
): Promise<ConnectionResult> {
  const resp = await fetchWithCookies(
    `${BASE}/home`,
    sessionid,
    steamLoginSecure
  );

  if (resp.status === 301 || resp.status === 302 || resp.status === 303) {
    const location = resp.headers.get("location") || "";
    if (isLoginRedirect(location)) {
      throw new Error("session_expired");
    }
  }

  if (!resp.ok && resp.status !== 301 && resp.status !== 302) {
    throw new Error(`Steam returned HTTP ${resp.status}`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  if (html.includes("login_form") || html.includes("Please Login")) {
    throw new Error("session_expired");
  }

  let publisherName =
    $(".partnerHeader .header_publisher_name").first().text().trim() ||
    $(".publisherName").first().text().trim() ||
    $(".partner_header_info h2").first().text().trim() ||
    $("title").text().replace("Steamworks - ", "").replace("Steamworks", "").trim() ||
    "Unknown Publisher";

  const gamesResult = await listGames(sessionid, steamLoginSecure);

  return {
    publisherName,
    gameCount: gamesResult.games.length,
  };
}

export async function listGames(
  sessionid: string,
  steamLoginSecure: string
): Promise<GamesListResult> {
  const resp = await fetchWithCookies(
    `${BASE}/apps/getfulllist`,
    sessionid,
    steamLoginSecure,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `sessionid=${encodeURIComponent(sessionid)}`,
    }
  );

  if (resp.status === 301 || resp.status === 302) {
    const location = resp.headers.get("location") || "";
    if (isLoginRedirect(location)) throw new Error("session_expired");
  }

  let allApps: GameInfo[] = [];

  if (resp.ok) {
    try {
      const json = await resp.json() as { nAllAppCount?: number; rgAllApps?: Array<{ nAppID: number; strName: string; strAppType: string }> };
      if (json && json.rgAllApps) {
        allApps = json.rgAllApps.map((a) => ({
          appId: a.nAppID,
          name: a.strName,
          type: (a.strAppType || "game").toLowerCase(),
        }));
      }
    } catch {
      logger.warn("getfulllist returned non-JSON, trying HTML parse");
    }
  }

  if (allApps.length === 0) {
    const htmlResp = await fetchWithCookies(
      `${BASE}/apps/landing/0`,
      sessionid,
      steamLoginSecure
    );
    const html = await htmlResp.text();
    const $ = cheerio.load(html);

    $(".app_row, .appRow, [data-appid]").each((_, el) => {
      const appId = parseInt(
        $(el).attr("data-appid") || $(el).find("[data-appid]").attr("data-appid") || "0"
      );
      const name =
        $(el).find(".app_name, .appName, .title").first().text().trim() ||
        $(el).text().trim();
      const type = (
        $(el).attr("data-type") ||
        $(el).find("[data-type]").attr("data-type") ||
        "game"
      ).toLowerCase();

      if (appId && name) {
        allApps.push({ appId, name, type });
      }
    });
  }

  const EXCLUDED_TYPES = new Set(["demo", "dlc", "playtest", "beta", "tool", "music", "video"]);
  const EXCLUDED_SUFFIXES = ["demo", "playtest", "beta", "soundtrack"];

  const games: GameInfo[] = [];
  const skipped: GameInfo[] = [];

  for (const app of allApps) {
    const typeExcluded = EXCLUDED_TYPES.has(app.type);
    const nameLower = app.name.toLowerCase();
    const nameExcluded = EXCLUDED_SUFFIXES.some(
      (s) => nameLower.endsWith(` ${s}`) || nameLower.includes(` ${s} `) || nameLower.startsWith(`${s} `)
    );

    if (typeExcluded || nameExcluded) {
      skipped.push(app);
    } else {
      games.push(app);
    }
  }

  return { games, skipped };
}

function getDateRange(granularity: string): { start: string; end: string; granStr: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const start = new Date(now);
  let granStr = "day";

  if (granularity === "daily") {
    start.setDate(now.getDate() - 30);
    granStr = "day";
  } else if (granularity === "weekly") {
    start.setDate(now.getDate() - 84);
    granStr = "week";
  } else if (granularity === "monthly") {
    start.setDate(now.getDate() - 365);
    granStr = "month";
  } else if (granularity === "lifetime") {
    start.setFullYear(2003);
    granStr = "month";
  }

  return { start: fmt(start), end: fmt(now), granStr };
}

type StatsJsonRow = Record<string, string | number>;

async function fetchStatJson(
  appId: number,
  endpoint: string,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatsJsonRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/${endpoint}?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}&format=json`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) return [];

    const json = await resp.json() as { response?: { data?: StatsJsonRow[] }; data?: StatsJsonRow[] } | StatsJsonRow[];
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      const obj = json as { response?: { data?: StatsJsonRow[] }; data?: StatsJsonRow[] };
      if (obj.response?.data) return obj.response.data;
      if (obj.data) return obj.data;
    }
    return [];
  } catch (e) {
    logger.warn({ appId, endpoint, err: e }, "Stat fetch failed");
    return [];
  }
}

async function fetchWishlists(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/wishlist?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure);
    if (!resp.ok) return [];
    const html = await resp.text();

    if (html.includes("login_form")) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          date: $(cells[0]).text().trim(),
          adds: $(cells[1]).text().trim().replace(/,/g, "") || "0",
          deletes: $(cells[2])?.text?.().trim().replace(/,/g, "") || "0",
          purchases: $(cells[3])?.text?.().trim().replace(/,/g, "") || "0",
          balance: $(cells[4])?.text?.().trim().replace(/,/g, "") || "0",
        });
      }
    });

    if (rows.length === 0) {
      const jsonRows = await fetchStatJson(appId, "wishlist", sessionid, steamLoginSecure, granularity);
      return jsonRows.map((r) => ({ date: String(r.date || r.dt || ""), ...r }));
    }

    return rows;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: e }, "Wishlist fetch failed");
    return [];
  }
}

async function fetchVisits(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/visits?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure);
    if (!resp.ok) return [];
    const html = await resp.text();
    if (html.includes("login_form")) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          date: $(cells[0]).text().trim(),
          visits: $(cells[1]).text().trim().replace(/,/g, "") || "0",
          unique_visitors: $(cells[2])?.text?.().trim().replace(/,/g, "") || "0",
          impressions: $(cells[3])?.text?.().trim().replace(/,/g, "") || "0",
        });
      }
    });

    return rows;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: e }, "Visits fetch failed");
    return [];
  }
}

async function fetchTrafficBreakdown(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/trafficbreakdown?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure);
    if (!resp.ok) return [];
    const html = await resp.text();
    if (html.includes("login_form")) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          source: $(cells[0]).text().trim(),
          visits: $(cells[1]).text().trim().replace(/,/g, "") || "0",
          unique_visitors: $(cells[2])?.text?.().trim().replace(/,/g, "") || "0",
        });
      }
    });

    return rows;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: e }, "Traffic breakdown fetch failed");
    return [];
  }
}

async function fetchSales(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/transactions?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure);
    if (!resp.ok) return [];
    const html = await resp.text();
    if (html.includes("login_form")) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          date: $(cells[0]).text().trim(),
          units: $(cells[1]).text().trim().replace(/,/g, "") || "0",
          gross_revenue: $(cells[2])?.text?.().trim().replace(/[^0-9.-]/g, "") || "0",
          net_revenue: $(cells[3])?.text?.().trim().replace(/[^0-9.-]/g, "") || "0",
        });
      }
    });

    return rows;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: e }, "Sales fetch failed");
    return [];
  }
}

async function fetchFollowers(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string
): Promise<StatRow[]> {
  const { start, end, granStr } = getDateRange(granularity);
  const url = `${BASE}/partner/stats/dashboard/followers?appid=${appId}&start=${start}&end=${end}&granularity=${granStr}`;

  try {
    const resp = await fetchWithCookies(url, sessionid, steamLoginSecure);
    if (!resp.ok) return [];
    const html = await resp.text();
    if (html.includes("login_form")) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          date: $(cells[0]).text().trim(),
          followers_added: $(cells[1]).text().trim().replace(/,/g, "") || "0",
          total_followers: $(cells[2])?.text?.().trim().replace(/,/g, "") || "0",
        });
      }
    });

    return rows;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: e }, "Followers fetch failed");
    return [];
  }
}

async function fetchReviews(
  appId: number,
  sessionid: string,
  steamLoginSecure: string
): Promise<{ positive: number; negative: number; score: string } | null> {
  try {
    const resp = await fetch(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`
    );
    if (!resp.ok) return null;
    const json = await resp.json() as { query_summary?: { total_positive?: number; total_negative?: number; review_score_desc?: string } };
    const summary = json?.query_summary;
    if (!summary) return null;
    return {
      positive: summary.total_positive || 0,
      negative: summary.total_negative || 0,
      score: summary.review_score_desc || "n/a",
    };
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProgressCallback = (info: {
  gameIndex: number;
  totalGames: number;
  gameName: string;
  metric: string;
  estimatedSecondsRemaining?: number;
}) => void;

export type CancelCheck = () => boolean;

export async function pullAllStats(
  appIds: number[],
  games: GameInfo[],
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  onProgress: ProgressCallback,
  isCancelled: CancelCheck
): Promise<GameStats[]> {
  const results: GameStats[] = [];
  const METRICS = ["Wishlists", "Visits", "Traffic Breakdown", "Sales", "Followers", "Reviews"];
  const totalSteps = appIds.length * METRICS.length;
  let stepsDone = 0;
  const startTime = Date.now();

  for (let i = 0; i < appIds.length; i++) {
    if (isCancelled()) break;

    const appId = appIds[i];
    const game = games.find((g) => g.appId === appId);
    const gameName = game?.name || `App ${appId}`;
    const errors: string[] = [];

    const stats: GameStats = { appId, gameName, errors };

    const report = (metric: string) => {
      stepsDone++;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = stepsDone / elapsed;
      const remaining = rate > 0 ? Math.round((totalSteps - stepsDone) / rate) : undefined;
      onProgress({
        gameIndex: i + 1,
        totalGames: appIds.length,
        gameName,
        metric,
        estimatedSecondsRemaining: remaining,
      });
    };

    try {
      report("Wishlists");
      stats.wishlistData = await fetchWishlists(appId, sessionid, steamLoginSecure, granularity);
      await sleep(400);

      if (isCancelled()) break;
      report("Visits & Impressions");
      stats.visitsData = await fetchVisits(appId, sessionid, steamLoginSecure, granularity);
      await sleep(400);

      if (isCancelled()) break;
      report("Traffic Breakdown");
      stats.trafficData = await fetchTrafficBreakdown(appId, sessionid, steamLoginSecure, granularity);
      await sleep(400);

      if (isCancelled()) break;
      report("Sales");
      try {
        stats.salesData = await fetchSales(appId, sessionid, steamLoginSecure, granularity);
      } catch {
        stats.salesData = [];
        errors.push("Sales data unavailable");
      }
      await sleep(400);

      if (isCancelled()) break;
      report("Followers");
      stats.followersData = await fetchFollowers(appId, sessionid, steamLoginSecure, granularity);
      await sleep(400);

      if (isCancelled()) break;
      report("Reviews");
      stats.reviewsData = await fetchReviews(appId, sessionid, steamLoginSecure);
      await sleep(200);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "session_expired") throw e;
      errors.push(`Error: ${msg}`);
    }

    results.push(stats);
    await sleep(600);
  }

  return results;
}
