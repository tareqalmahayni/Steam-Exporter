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

export interface DebugResult {
  steps: Array<{ step: string; status: string; detail: string; rawSnippet?: string }>;
  rawAppsFound: Array<{ appId: number; name: string; type: string }>;
}

const BASE = "https://partner.steamgames.com";

function makeCookieHeader(sessionid: string, steamLoginSecure: string) {
  return `sessionid=${sessionid}; steamLoginSecure=${steamLoginSecure}`;
}

function isLoginRedirect(url: string | null): boolean {
  if (!url) return false;
  return url.includes("/login") || url.includes("steampowered.com/login");
}

// Only trigger on very explicit login-page markers to avoid false positives.
// g_steamID = false and store.steampowered.com/login can appear on valid partner pages.
function isLoginPage(html: string): boolean {
  return (
    html.includes('id="login_form"') ||
    html.includes('class="login_form"') ||
    html.includes('id="login_btn_signin"') ||
    html.includes("OpenID Connect Login")
  );
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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://partner.steamgames.com/",
      ...(options.headers || {}),
    },
    redirect: "manual",
  });
  return resp;
}

async function fetchJsonWithCookies(
  url: string,
  sessionid: string,
  steamLoginSecure: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithCookies(url, sessionid, steamLoginSecure, {
    ...options,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      ...(options.headers || {}),
    },
  });
}

// Returns a brief raw snippet of /home for diagnosis (first 2000 chars, redacted)
export async function getRawHomeSnippet(
  sessionid: string,
  steamLoginSecure: string
): Promise<{ status: number; location: string | null; contentType: string | null; bodySnippet: string }> {
  const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);
  const bodyText = await resp.text();
  return {
    status: resp.status,
    location: resp.headers.get("location"),
    contentType: resp.headers.get("content-type"),
    bodySnippet: bodyText.slice(0, 2000),
  };
}

export async function testConnection(
  sessionid: string,
  steamLoginSecure: string
): Promise<ConnectionResult> {
  const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);

  // Explicit redirect to login page
  if (resp.status === 301 || resp.status === 302 || resp.status === 303) {
    const location = resp.headers.get("location") || "";
    logger.info({ status: resp.status, location }, "testConnection /home redirect");
    if (isLoginRedirect(location)) throw new Error("session_expired");
    // Non-login redirect — follow it (fall through with empty body)
  }

  if (!resp.ok && resp.status !== 301 && resp.status !== 302 && resp.status !== 303) {
    throw new Error(`Steam returned HTTP ${resp.status}`);
  }

  let html = "";
  try { html = await resp.text(); } catch { /* redirect with no body */ }

  logger.info({ htmlLen: html.length, isLogin: isLoginPage(html) }, "testConnection /home body");

  if (isLoginPage(html)) throw new Error("session_expired");

  const $ = cheerio.load(html);
  // Try many selectors — the partner portal HTML changes over time
  const publisherName =
    $(".partnerHeader .header_publisher_name").first().text().trim() ||
    $("[class*='publisher'] [class*='name']").first().text().trim() ||
    $(".publisherName").first().text().trim() ||
    $(".partner_header_info h2").first().text().trim() ||
    $("title").text().replace(/Steamworks\s*[-–]?\s*/i, "").trim() ||
    "Unknown Publisher";

  // Fetch game count separately — don't let this failure block connection test
  let gameCount = 0;
  try {
    const gamesResult = await listGames(sessionid, steamLoginSecure);
    gameCount = gamesResult.games.length;
  } catch (e) {
    // session_expired during listGames is real; other errors are not fatal for connection test
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "listGames failed during testConnection — returning gameCount=0");
  }

  return { publisherName, gameCount };
}

// Extract app links from any page that contains /apps/landing/APPID hrefs
function extractAppsFromHtml(html: string): Array<{ appId: number; name: string; type: string }> {
  const apps: Array<{ appId: number; name: string; type: string }> = [];
  const seen = new Set<number>();
  const $ = cheerio.load(html);

  // Primary: anchor tags linking to /apps/landing/APPID
  $('a[href*="/apps/landing/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/\/apps\/landing\/(\d+)/);
    if (!match) return;
    const appId = parseInt(match[1], 10);
    if (!appId || seen.has(appId)) return;
    seen.add(appId);

    const rawName = $(el).text().trim() ||
      $(el).find(".app_name, .appName, .title, .name, span").first().text().trim();
    if (!rawName) return;

    // Infer type from name / surrounding context
    const container = $(el).closest("[data-apptype], [data-type]");
    const type = (
      container.attr("data-apptype") ||
      container.attr("data-type") ||
      "game"
    ).toLowerCase();

    apps.push({ appId, name: rawName, type });
  });

  // Secondary: any element with data-appid
  $("[data-appid]").each((_, el) => {
    const appId = parseInt($(el).attr("data-appid") || "0", 10);
    if (!appId || seen.has(appId)) return;
    seen.add(appId);

    const name = $(el)
      .find(".app_name, .appName, .title, .name, span, a")
      .first()
      .text()
      .trim() || $(el).text().trim().split("\n")[0].trim();

    if (!name) return;

    const type = ($(el).attr("data-apptype") || $(el).attr("data-type") || "game").toLowerCase();
    apps.push({ appId, name, type });
  });

  return apps;
}

// Strategy 1: POST /apps/getfulllist (official JSON endpoint)
async function tryGetFullList(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchJsonWithCookies(`${BASE}/apps/getfulllist`, sessionid, steamLoginSecure, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `sessionid=${encodeURIComponent(sessionid)}&format=json`,
    });

    if (resp.status === 301 || resp.status === 302) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "getfulllist non-OK");
      return [];
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      const text = await resp.text();
      if (isLoginPage(text)) throw new Error("session_expired");
      logger.warn({ contentType, snippet: text.slice(0, 200) }, "getfulllist not JSON");
      return [];
    }

    const json = await resp.json() as {
      nAllAppCount?: number;
      rgAllApps?: Array<{ nAppID?: number; appid?: number; strName?: string; name?: string; strAppType?: string; type?: string }>;
      apps?: Array<{ appid?: number; nAppID?: number; name?: string; strName?: string; strAppType?: string; type?: string }>;
    };

    const rawApps = json.rgAllApps || json.apps || [];
    if (rawApps.length === 0) {
      logger.warn({ json: JSON.stringify(json).slice(0, 300) }, "getfulllist returned empty rgAllApps");
      return [];
    }

    return rawApps.map((a) => ({
      appId: a.nAppID ?? a.appid ?? 0,
      name: a.strName ?? a.name ?? "",
      type: ((a.strAppType ?? a.type) || "game").toLowerCase(),
    })).filter((a) => a.appId && a.name);
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "getfulllist threw");
    return [];
  }
}

// Strategy 2: GET /apps/ (the apps index page)
async function tryScrapeAppsPage(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchWithCookies(`${BASE}/apps/`, sessionid, steamLoginSecure);

    if (resp.status === 301 || resp.status === 302) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }
    if (!resp.ok) return [];

    const html = await resp.text();
    if (isLoginPage(html)) throw new Error("session_expired");

    const apps = extractAppsFromHtml(html);
    logger.info({ count: apps.length }, "Scraped /apps/ page");
    return apps;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "scrapeAppsPage threw");
    return [];
  }
}

// Strategy 3: GET /apps/landing/0 (publisher landing with all apps)
async function tryScrapeAppsLanding(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchWithCookies(`${BASE}/apps/landing/0`, sessionid, steamLoginSecure);

    if (resp.status === 301 || resp.status === 302) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }
    if (!resp.ok) return [];

    const html = await resp.text();
    if (isLoginPage(html)) throw new Error("session_expired");

    const apps = extractAppsFromHtml(html);
    logger.info({ count: apps.length }, "Scraped /apps/landing/0 page");
    return apps;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "scrapeAppsLanding threw");
    return [];
  }
}

// Strategy 4: Scrape the home page (sometimes shows recent/all apps)
async function tryScrapeHomePage(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);

    if (resp.status === 301 || resp.status === 302) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }
    if (!resp.ok) return [];

    const html = await resp.text();
    if (isLoginPage(html)) throw new Error("session_expired");

    const apps = extractAppsFromHtml(html);
    logger.info({ count: apps.length }, "Scraped /home for apps");
    return apps;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "scrapeHomePage threw");
    return [];
  }
}

const EXCLUDED_TYPES = new Set(["demo", "dlc", "playtest", "beta", "tool", "music", "video"]);
const EXCLUDED_SUFFIXES = ["demo", "playtest", "beta", "soundtrack"];

function classifyApps(allApps: Array<{ appId: number; name: string; type: string }>): GamesListResult {
  const games: GameInfo[] = [];
  const skipped: GameInfo[] = [];

  for (const app of allApps) {
    if (!app.appId || !app.name) continue;
    const typeExcluded = EXCLUDED_TYPES.has(app.type);
    const nameLower = app.name.toLowerCase();
    const nameExcluded = EXCLUDED_SUFFIXES.some(
      (s) =>
        nameLower.endsWith(` ${s}`) ||
        nameLower.includes(` ${s} `) ||
        nameLower.startsWith(`${s} `)
    );
    if (typeExcluded || nameExcluded) {
      skipped.push(app);
    } else {
      games.push(app);
    }
  }

  return { games, skipped };
}

export async function listGames(
  sessionid: string,
  steamLoginSecure: string
): Promise<GamesListResult> {
  // Try all strategies in order, use the first one that returns results
  let allApps: Array<{ appId: number; name: string; type: string }> = [];

  allApps = await tryGetFullList(sessionid, steamLoginSecure);
  if (allApps.length > 0) {
    logger.info({ count: allApps.length, strategy: "getfulllist" }, "Games found");
    return classifyApps(allApps);
  }

  allApps = await tryScrapeAppsPage(sessionid, steamLoginSecure);
  if (allApps.length > 0) {
    logger.info({ count: allApps.length, strategy: "apps-page" }, "Games found");
    return classifyApps(allApps);
  }

  allApps = await tryScrapeAppsLanding(sessionid, steamLoginSecure);
  if (allApps.length > 0) {
    logger.info({ count: allApps.length, strategy: "apps-landing" }, "Games found");
    return classifyApps(allApps);
  }

  allApps = await tryScrapeHomePage(sessionid, steamLoginSecure);
  if (allApps.length > 0) {
    logger.info({ count: allApps.length, strategy: "home-page" }, "Games found");
    return classifyApps(allApps);
  }

  logger.warn("All game list strategies returned 0 results");
  return { games: [], skipped: [] };
}

// Debug function: runs all strategies and reports what each one found
export async function debugListGames(
  sessionid: string,
  steamLoginSecure: string
): Promise<DebugResult> {
  const steps: DebugResult["steps"] = [];
  const seen = new Set<number>();
  let allRaw: Array<{ appId: number; name: string; type: string }> = [];

  // Step 1: getfulllist JSON endpoint
  try {
    const resp = await fetchJsonWithCookies(`${BASE}/apps/getfulllist`, sessionid, steamLoginSecure, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `sessionid=${encodeURIComponent(sessionid)}&format=json`,
    });
    const text = await resp.text();
    const isRedirect = resp.status === 301 || resp.status === 302;
    const loc = resp.headers.get("location") || "";
    steps.push({
      step: "POST /apps/getfulllist",
      status: `HTTP ${resp.status}${isRedirect ? " → " + loc : ""}`,
      detail: `Content-Type: ${resp.headers.get("content-type")}`,
      rawSnippet: text.slice(0, 500),
    });
    // Try parse
    try {
      const json = JSON.parse(text) as { rgAllApps?: Array<{ nAppID?: number; strName?: string; strAppType?: string }> };
      const apps = (json.rgAllApps || []).map((a) => ({ appId: a.nAppID ?? 0, name: a.strName ?? "", type: (a.strAppType || "game").toLowerCase() })).filter(a => a.appId && a.name);
      apps.forEach((a) => { if (!seen.has(a.appId)) { seen.add(a.appId); allRaw.push(a); } });
      steps[steps.length - 1].detail += ` | Parsed ${apps.length} apps`;
    } catch { steps[steps.length - 1].detail += " | Not valid JSON"; }
  } catch (e) {
    steps.push({ step: "POST /apps/getfulllist", status: "THREW", detail: String(e) });
  }

  // Step 2: GET /apps/
  try {
    const resp = await fetchWithCookies(`${BASE}/apps/`, sessionid, steamLoginSecure);
    const text = await resp.text();
    const isRedirect = resp.status === 301 || resp.status === 302;
    const loc = resp.headers.get("location") || "";
    const apps = extractAppsFromHtml(text);
    apps.forEach((a) => { if (!seen.has(a.appId)) { seen.add(a.appId); allRaw.push(a); } });
    steps.push({
      step: "GET /apps/",
      status: `HTTP ${resp.status}${isRedirect ? " → " + loc : ""}`,
      detail: `Found ${apps.length} app links | loginPage=${isLoginPage(text)}`,
      rawSnippet: text.slice(0, 500),
    });
  } catch (e) {
    steps.push({ step: "GET /apps/", status: "THREW", detail: String(e) });
  }

  // Step 3: GET /apps/landing/0
  try {
    const resp = await fetchWithCookies(`${BASE}/apps/landing/0`, sessionid, steamLoginSecure);
    const text = await resp.text();
    const isRedirect = resp.status === 301 || resp.status === 302;
    const loc = resp.headers.get("location") || "";
    const apps = extractAppsFromHtml(text);
    apps.forEach((a) => { if (!seen.has(a.appId)) { seen.add(a.appId); allRaw.push(a); } });
    steps.push({
      step: "GET /apps/landing/0",
      status: `HTTP ${resp.status}${isRedirect ? " → " + loc : ""}`,
      detail: `Found ${apps.length} app links | loginPage=${isLoginPage(text)}`,
      rawSnippet: text.slice(0, 500),
    });
  } catch (e) {
    steps.push({ step: "GET /apps/landing/0", status: "THREW", detail: String(e) });
  }

  // Step 4: GET /home
  try {
    const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);
    const text = await resp.text();
    const isRedirect = resp.status === 301 || resp.status === 302;
    const loc = resp.headers.get("location") || "";
    const apps = extractAppsFromHtml(text);
    apps.forEach((a) => { if (!seen.has(a.appId)) { seen.add(a.appId); allRaw.push(a); } });
    steps.push({
      step: "GET /home",
      status: `HTTP ${resp.status}${isRedirect ? " → " + loc : ""}`,
      detail: `Found ${apps.length} app links | loginPage=${isLoginPage(text)}`,
      rawSnippet: text.slice(0, 500),
    });
  } catch (e) {
    steps.push({ step: "GET /home", status: "THREW", detail: String(e) });
  }

  return { steps, rawAppsFound: allRaw };
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
    const resp = await fetchJsonWithCookies(url, sessionid, steamLoginSecure);
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
    if (isLoginPage(html)) throw new Error("session_expired");

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
    if (isLoginPage(html)) throw new Error("session_expired");

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
    if (isLoginPage(html)) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const rows: StatRow[] = [];

    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        rows.push({
          date: $(cells[0]).text().trim(),
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
    if (isLoginPage(html)) throw new Error("session_expired");

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
    if (isLoginPage(html)) throw new Error("session_expired");

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
      onProgress({ gameIndex: i + 1, totalGames: appIds.length, gameName, metric, estimatedSecondsRemaining: remaining });
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
      stats.reviewsData = await fetchReviews(appId);
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
