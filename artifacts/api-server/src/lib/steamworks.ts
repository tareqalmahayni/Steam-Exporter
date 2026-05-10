import * as cheerio from "cheerio";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger";

/**
 * Per-pull HTML prefetch cache. When set, fetchPartnerHtml returns the
 * pre-stashed HTML for a URL instead of making a network request. This is
 * how the bookmarklet flow works: the user's browser does the actual
 * fetches (using their real session/IP), submits the HTML, and the server
 * runs the existing parsers against the submitted HTML.
 */
const prefetchStorage = new AsyncLocalStorage<Map<string, string>>();

export function runWithPrefetch<T>(map: Map<string, string>, fn: () => Promise<T>): Promise<T> {
  return prefetchStorage.run(map, fn);
}

/** Extract appId+name list from a Steamworks /home page HTML. Used by the bookmarklet flow. */
export function parseGamesFromHomeHtml(html: string): GamesListResult {
  const apps = extractAppsFromHtml(html);
  return classifyApps(apps);
}

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
const BASE_PARTNER = "https://partner.steampowered.com";

/**
 * Build the Cookie header.
 *
 * Chrome DevTools Application tab URL-decodes cookie values for display.
 * steamLoginSecure is stored / sent by Steam as URL-encoded
 * (e.g. `76561198000000000%7Ctoken` with `%7C` for the pipe `|`).
 * When users copy from DevTools they get the decoded `|` version.
 * We normalise it back to %7C so Steam's server accepts it.
 */
function normalizeSteamLoginSecure(value: string): string {
  // If already URL-encoded (contains %7C / %7c / %7B etc) leave it alone.
  // If it has raw pipe chars and no % escapes, encode the pipes.
  if (!value.includes("%") && value.includes("|")) {
    return value.replace(/\|/g, "%7C");
  }
  return value;
}

function makeCookieHeader(sessionid: string, steamLoginSecure: string) {
  const secureCookie = normalizeSteamLoginSecure(steamLoginSecure);
  return `sessionid=${sessionid}; steamLoginSecure=${secureCookie}`;
}

function isLoginRedirect(url: string | null): boolean {
  if (!url) return false;
  // JWT refresh is NOT a login expiry — it's a token mint for a different subdomain.
  // The browser follows it transparently and gets new auth cookies back.
  if (url.includes("login.steampowered.com/jwt/")) return false;
  // Real login pages: /login as a path segment, OAuth/OpenID flows
  return /\/login(\?|\/|$)/.test(url) || url.includes("openid");
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

    const isRedirect = resp.status === 301 || resp.status === 302 || resp.status === 303;
    const loc = resp.headers.get("location") || "";
    const contentType = resp.headers.get("content-type") || "";

    logger.info({ status: resp.status, isRedirect, loc, contentType }, "getfulllist response headers");

    if (isRedirect) {
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "getfulllist non-OK");
      return [];
    }

    const text = await resp.text();
    logger.info({ bodyLen: text.length, bodySnippet: text.slice(0, 500) }, "getfulllist body");

    if (!contentType.includes("json")) {
      if (isLoginPage(text)) throw new Error("session_expired");
      logger.warn({ contentType }, "getfulllist not JSON content-type");
      return [];
    }

    let json: {
      nAllAppCount?: number;
      rgAllApps?: Array<{ nAppID?: number; appid?: number; strName?: string; name?: string; strAppType?: string; type?: string }>;
      apps?: Array<{ appid?: number; nAppID?: number; name?: string; strName?: string; strAppType?: string; type?: string }>;
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      logger.warn({ snippet: text.slice(0, 200) }, "getfulllist JSON parse error");
      return [];
    }

    const rawApps = json.rgAllApps || json.apps || [];
    logger.info({ rawAppsCount: rawApps.length, keys: Object.keys(json) }, "getfulllist parsed JSON");

    if (rawApps.length === 0) {
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

// Strategy 1b: GET /apps/getallappids — alternate endpoint some partner accounts expose
async function tryGetAllAppIds(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchJsonWithCookies(`${BASE}/apps/getallappids`, sessionid, steamLoginSecure);

    if (resp.status === 301 || resp.status === 302 || resp.status === 303) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }
    if (!resp.ok) return [];

    const text = await resp.text();
    logger.info({ status: resp.status, bodyLen: text.length, bodySnippet: text.slice(0, 300) }, "getallappids response");

    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return [];

    const json = JSON.parse(text) as {
      appids?: number[];
      rgAllApps?: Array<{ nAppID?: number; strName?: string; strAppType?: string }>;
    };

    if (json.rgAllApps) {
      return json.rgAllApps.map((a) => ({
        appId: a.nAppID ?? 0,
        name: a.strName ?? "",
        type: (a.strAppType || "game").toLowerCase(),
      })).filter((a) => a.appId && a.name);
    }
    // If it just returns a list of IDs without names, return them with placeholder names
    if (json.appids) {
      return json.appids.map((id) => ({ appId: id, name: `App ${id}`, type: "game" }));
    }
    return [];
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "getallappids threw");
    return [];
  }
}

// Strategy 1c: look for JSON app data embedded in <script> tags on /home
// Steamworks sometimes inlines initial React state as window.__appData or similar
async function tryExtractScriptJson(
  sessionid: string,
  steamLoginSecure: string
): Promise<Array<{ appId: number; name: string; type: string }>> {
  try {
    const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);

    if (resp.status === 301 || resp.status === 302 || resp.status === 303) {
      const loc = resp.headers.get("location") || "";
      if (isLoginRedirect(loc)) throw new Error("session_expired");
      return [];
    }
    if (!resp.ok) return [];

    const html = await resp.text();
    if (isLoginPage(html)) throw new Error("session_expired");

    const $ = cheerio.load(html);
    const results: Array<{ appId: number; name: string; type: string }> = [];
    const seen = new Set<number>();

    // Look in all inline <script> tags for patterns like "nAppID":12345 or "appid":12345
    $("script:not([src])").each((_, el) => {
      const src = $(el).html() || "";
      // Match JSON-like app id patterns in JS blobs
      const idPattern = /"(?:nAppID|appid|appID)"\s*:\s*(\d{4,10})/g;
      const namePattern = /"(?:strName|name)"\s*:\s*"([^"]+)"/g;

      // Try to find paired app IDs + names near each other
      let m: RegExpExecArray | null;
      const localIds: number[] = [];
      const localNames: string[] = [];

      while ((m = idPattern.exec(src)) !== null) localIds.push(parseInt(m[1], 10));
      while ((m = namePattern.exec(src)) !== null) localNames.push(m[1]);

      if (localIds.length > 0 && localNames.length === localIds.length) {
        for (let i = 0; i < localIds.length; i++) {
          const appId = localIds[i];
          if (appId && !seen.has(appId)) {
            seen.add(appId);
            results.push({ appId, name: localNames[i], type: "game" });
          }
        }
      }
    });

    if (results.length > 0) {
      logger.info({ count: results.length }, "Extracted app data from script tags on /home");
    }
    return results;
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ err: e }, "extractScriptJson threw");
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

// Only exclude these clearly non-base-game types. Unknown type → keep as game.
const EXCLUDED_TYPES = new Set(["demo", "dlc", "playtest", "beta", "tool", "music", "video", "config"]);
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
  type AppList = Array<{ appId: number; name: string; type: string }>;
  const strategies: Array<[string, () => Promise<AppList>]> = [
    ["getfulllist",    () => tryGetFullList(sessionid, steamLoginSecure)],
    ["getallappids",   () => tryGetAllAppIds(sessionid, steamLoginSecure)],
    ["script-json",    () => tryExtractScriptJson(sessionid, steamLoginSecure)],
    ["apps-page",      () => tryScrapeAppsPage(sessionid, steamLoginSecure)],
    ["apps-landing",   () => tryScrapeAppsLanding(sessionid, steamLoginSecure)],
    ["home-page",      () => tryScrapeHomePage(sessionid, steamLoginSecure)],
  ];

  for (const [name, fn] of strategies) {
    const allApps = await fn();
    if (allApps.length > 0) {
      logger.info({ count: allApps.length, strategy: name }, "Games found via strategy");
      return classifyApps(allApps);
    }
    logger.info({ strategy: name }, "Strategy returned 0 apps");
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
    // Today only — start and end are both today
    granStr = "day";
  } else if (granularity === "weekly") {
    start.setDate(now.getDate() - 7);
    granStr = "day";
  } else if (granularity === "monthly") {
    start.setDate(now.getDate() - 30);
    granStr = "day";
  } else if (granularity === "lifetime") {
    // Use 2003-01-01 as a safe "beginning of Steam" anchor
    start.setFullYear(2003, 0, 1);
    granStr = "month";
  }

  return { start: fmt(start), end: fmt(now), granStr };
}

/**
 * Same date range but formatted as ISO YYYY-MM-DD with dashes.
 * Required for the partner.steampowered.com URLs which use ?dateStart= / ?dateEnd=.
 */
export function getDateRangeIso(
  granularity: string,
  customRange?: { startIso?: string; endIso?: string },
): { startIso: string; endIso: string } {
  // Custom range: caller supplies both ISO dates explicitly. Used by
  // the bookmarklet's custom date-range picker.
  if (
    granularity === "custom" &&
    customRange?.startIso &&
    customRange?.endIso
  ) {
    return { startIso: customRange.startIso, endIso: customRange.endIso };
  }
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let start = new Date(now);
  let end = new Date(now);
  if (granularity === "weekly") start.setDate(now.getDate() - 7);
  else if (granularity === "monthly") start.setDate(now.getDate() - 30);
  else if (granularity === "yearly" || granularity === "previous-year") {
    // Previous calendar year: Jan 1 → Dec 31 of last year
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else if (granularity === "previous-month") {
    // Previous calendar month
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (granularity === "today") {
    // Just today
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (granularity === "preference" || granularity === "previous-week") {
    // Rolling last 7 days: today minus 6 → today (inclusive). This is the
    // default user preference — most useful slice for weekly check-ins.
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (granularity === "lifetime") {
    start.setFullYear(2003, 0, 1);
  }
  // daily: start = today (legacy alias)
  return { startIso: fmt(start), endIso: fmt(end) };
}

/**
 * Preflight check: validates that (a) the home page is authenticated AND
 * (b) the per-game traffic stats page for one selected appId is reachable
 * with the supplied cookies. Used by /api/connection/preflight to gate
 * the Pull button — surfaces session/access problems BEFORE we kick off
 * a long pull job that would otherwise fail mid-flight.
 *
 * Returns one of:
 *   STEAMWORKS_SESSION_VALID         — both checks pass
 *   STEAMWORKS_LOGIN_REQUIRED        — home redirects/returns login form
 *   STEAMWORKS_SESSION_EXPIRED       — cookies were valid before but expired
 *   TRAFFIC_PAGE_ACCESS_DENIED       — home OK but traffic page is login/403
 *   TRAFFIC_DOWNLOAD_FAILED          — network/HTTP error fetching traffic page
 */
export type PreflightStatus =
  | "STEAMWORKS_SESSION_VALID"
  | "STEAMWORKS_SESSION_EXPIRED"
  | "STEAMWORKS_LOGIN_REQUIRED"
  | "TRAFFIC_PAGE_ACCESS_DENIED"
  | "TRAFFIC_DOWNLOAD_FAILED";

export async function preflightSession(
  sessionid: string,
  steamLoginSecure: string,
  appId: number,
): Promise<{
  ok: boolean;
  status: PreflightStatus;
  publisherName?: string;
  message?: string;
  checks: {
    homeAuthenticated: boolean;
    trafficPageReachable: boolean;
    trafficPageStatus?: number;
  };
}> {
  // Step 1 — verify home/dashboard is authenticated.
  let homeAuthenticated = false;
  let publisherName: string | undefined;
  try {
    const resp = await fetchWithCookies(`${BASE}/home`, sessionid, steamLoginSecure);
    const html = await resp.text();
    if (isLoginPage(html)) {
      return {
        ok: false,
        status: "STEAMWORKS_LOGIN_REQUIRED",
        message: "Steamworks home redirected to the login page. Sign in again.",
        checks: { homeAuthenticated: false, trafficPageReachable: false },
      };
    }
    homeAuthenticated = true;
    // Best-effort publisher name extraction (matches testConnection logic).
    const m = html.match(/<title>([^<]+)<\/title>/i);
    if (m) publisherName = m[1].replace(/\s*-\s*Steamworks.*$/i, "").trim();
  } catch (e) {
    return {
      ok: false,
      status: "STEAMWORKS_SESSION_EXPIRED",
      message: `Could not reach Steamworks home: ${(e as Error).message}`,
      checks: { homeAuthenticated: false, trafficPageReachable: false },
    };
  }

  // Step 2 — verify the per-game traffic stats page is reachable.
  // Same URL the Excel pull will hit. If this fails, the pull would
  // fail too, so block before starting.
  const trafficUrl = `${BASE}/apps/navtrafficstats/${appId}`;
  try {
    const resp = await fetchWithCookies(trafficUrl, sessionid, steamLoginSecure);
    const text = await resp.text();
    const trafficPageStatus = resp.status;
    if (isLoginPage(text)) {
      return {
        ok: false,
        status: "TRAFFIC_PAGE_ACCESS_DENIED",
        publisherName,
        message:
          "Home page is signed in but the per-game traffic page returned the login form. Re-sign in to refresh stats access.",
        checks: { homeAuthenticated, trafficPageReachable: false, trafficPageStatus },
      };
    }
    if (!resp.ok) {
      return {
        ok: false,
        status: "TRAFFIC_PAGE_ACCESS_DENIED",
        publisherName,
        message: `Traffic page returned HTTP ${trafficPageStatus}. Your account may not have access to that game's stats.`,
        checks: { homeAuthenticated, trafficPageReachable: false, trafficPageStatus },
      };
    }
    return {
      ok: true,
      status: "STEAMWORKS_SESSION_VALID",
      publisherName,
      checks: { homeAuthenticated, trafficPageReachable: true, trafficPageStatus },
    };
  } catch (e) {
    return {
      ok: false,
      status: "TRAFFIC_DOWNLOAD_FAILED",
      publisherName,
      message: `Could not download traffic page: ${(e as Error).message}`,
      checks: { homeAuthenticated, trafficPageReachable: false },
    };
  }
}

// ─── Stat helpers ────────────────────────────────────────────────────────────

type StatsJsonRow = Record<string, string | number>;

/**
 * Fetch a URL and return { ok, status, contentType, text }.
 * Logs the request + first 400 chars of the response body so we can diagnose
 * what each endpoint actually returns.
 */
async function statFetch(
  label: string,
  url: string,
  sessionid: string,
  steamLoginSecure: string,
  useJsonHeaders = false
): Promise<{ ok: boolean; status: number; contentType: string; text: string }> {
  const resp = useJsonHeaders
    ? await fetchJsonWithCookies(url, sessionid, steamLoginSecure)
    : await fetchWithCookies(url, sessionid, steamLoginSecure);
  const text = await resp.text();
  const contentType = resp.headers.get("content-type") || "";
  logger.info(
    {
      label,
      path: url.replace(BASE, ""),
      status: resp.status,
      contentType,
      bodyLen: text.length,
      bodySnippet: text.slice(0, 400),
    },
    "stat endpoint"
  );
  if (isLoginPage(text)) throw new Error("session_expired");
  return { ok: resp.ok, status: resp.status, contentType, text };
}

/** Try to parse a body as JSON stat rows. Returns [] on failure. */
function parseJsonRows(text: string): StatsJsonRow[] {
  try {
    const parsed = JSON.parse(text) as
      | StatsJsonRow[]
      | { response?: { data?: StatsJsonRow[] }; data?: StatsJsonRow[] };
    if (Array.isArray(parsed)) return parsed;
    const obj = parsed as { response?: { data?: StatsJsonRow[] }; data?: StatsJsonRow[] };
    if (obj.response?.data) return obj.response.data;
    if (obj.data) return obj.data;
  } catch { /* ignore */ }
  return [];
}

/** Parse a TSV/CSV body into StatRow[] using the provided column name map. */
function parseTsv(text: string, colMap: Record<string, string>): StatRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const rows: StatRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    if (cells.length < 2 || !cells[0].trim()) continue;
    const row: StatRow = { date: cells[0].trim() };
    headers.forEach((hdr, idx) => {
      if (idx === 0) return;
      const key = colMap[hdr] ?? hdr;
      const raw = cells[idx]?.trim() ?? "";
      row[key] = raw.replace(/,/g, "");
    });
    rows.push(row);
  }
  return rows;
}

// ─── HTML page fetcher + scraper ─────────────────────────────────────────────

/**
 * Parse Set-Cookie response headers into a flat name→value map.
 * Skips deletion cookies (empty value or value === "deleted").
 */
function parseSetCookies(headers: Headers): Map<string, string> {
  const out = new Map<string, string>();
  // getSetCookie() returns each Set-Cookie header separately (Node 20+).
  const setCookieList: string[] =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [];
  for (const sc of setCookieList) {
    const m = sc.match(/^\s*([^=;]+)=([^;]*)/);
    if (!m) continue;
    const name = m[1].trim();
    const value = m[2].trim();
    if (!value || value === "deleted") continue;
    out.set(name, value);
  }
  return out;
}

function makeJarHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Fetch a Steamworks page following the cross-subdomain JWT refresh dance:
 *
 * 1. GET partner.steampowered.com/foo with steamLoginSecure
 * 2. → 302 to login.steampowered.com/jwt/refresh?redir=...
 * 3. We follow it with our jar; that endpoint Set-Cookies a fresh
 *    steamLoginSecure for partner.steampowered.com, then 302s back.
 * 4. We follow back with the now-updated jar → 200 OK with the real HTML.
 *
 * Browsers do this transparently. We replicate it manually so we can use
 * the right cookie at each hop.
 *
 * Throws "session_expired" only if we end up on an actual login form.
 */
async function fetchPartnerHtml(
  label: string,
  url: string,
  sessionid: string,
  steamLoginSecure: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<string> {
  // Pick the cookie pair scoped to the right top-level domain.
  // partner.steampowered.com / login.steampowered.com / store.steampowered.com
  // need cookies issued for *.steampowered.com. partner.steamgames.com needs
  // cookies issued for *.steamgames.com. Steam mints these as separate cookies.
  // Bookmarklet flow: if a prefetch cache is set, it is the only source of HTML.
  // - Cache hit: return submitted HTML.
  // - Cache miss: treat as "no data" instead of doing a network fetch (because
  //   in this mode we don't have the user's Steam cookies on the server).
  const prefetched = prefetchStorage.getStore();
  if (prefetched) {
    if (prefetched.has(url)) {
      const html = prefetched.get(url) ?? "";
      logger.info({ label, url, bodyLen: html.length }, "partner page fetch (prefetched from browser)");
      if (isLoginPage(html)) throw new Error("session_expired");
      return html;
    }
    logger.info({ label, url }, "partner page fetch (prefetch miss — returning empty)");
    return "";
  }

  const isSteampoweredHost = url.startsWith(BASE_PARTNER);
  const useSid = isSteampoweredHost && partnerSessionid ? partnerSessionid : sessionid;
  const useSecure = isSteampoweredHost && partnerSteamLoginSecure ? partnerSteamLoginSecure : steamLoginSecure;

  const jar = new Map<string, string>([
    ["sessionid", useSid],
    ["steamLoginSecure", normalizeSteamLoginSecure(useSecure)],
  ]);
  const refererBase = isSteampoweredHost ? BASE_PARTNER : BASE;

  let currentUrl = url;
  let hopCount = 0;
  const MAX_HOPS = 6;
  const hopTrace: Array<{ status: number; url: string; loc: string | null; setCookies: string[] }> = [];

  while (hopCount++ < MAX_HOPS) {
    const resp = await fetch(currentUrl, {
      headers: {
        Cookie: makeJarHeader(jar),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `${refererBase}/`,
      },
      redirect: "manual",
    });

    const status = resp.status;
    const location = resp.headers.get("location");
    const newCookies = parseSetCookies(resp.headers);
    hopTrace.push({
      status,
      url: currentUrl.length > 120 ? currentUrl.slice(0, 120) + "…" : currentUrl,
      loc: location,
      setCookies: Array.from(newCookies.keys()),
    });

    // Merge any new cookies into the jar
    for (const [k, v] of newCookies) jar.set(k, v);

    // Follow redirects manually (3xx + Location)
    if (status >= 300 && status < 400 && location) {
      // Resolve relative URLs against current URL
      currentUrl = new URL(location, currentUrl).toString();
      if (isLoginRedirect(currentUrl)) {
        // Drain body to free the connection
        await resp.text().catch(() => "");
        logger.warn({ label, hopTrace }, "partner page fetch — bounced to login");
        throw new Error("session_expired");
      }
      // Drain body so the socket is reused
      await resp.text().catch(() => "");
      continue;
    }

    // Final response (2xx, 4xx, 5xx)
    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "";

    logger.info(
      {
        label,
        url: url.replace(BASE_PARTNER, "[partner]").replace(BASE, "[games]"),
        finalStatus: status,
        finalUrl: currentUrl !== url ? currentUrl : undefined,
        contentType,
        bodyLen: text.length,
        hops: hopTrace.length,
        hopTrace,
        bodySnippet: text.slice(0, 400),
      },
      "partner page fetch"
    );

    if (isLoginPage(text)) throw new Error("session_expired");
    if (status >= 400) return "";
    return text;
  }

  logger.warn({ label, url, hopTrace }, "partner page fetch — too many redirects");
  return "";
}

/**
 * Extract every table on the page as { headers, rows }.
 * Also extracts numeric "summary" cells (big number + label pattern) so we can
 * surface things like "Total Wishlist Adds: 1,234" even when there's no table.
 */
function extractTablesAndStats(html: string): {
  tables: Array<{ headers: string[]; rows: string[][] }>;
  stats: Array<{ label: string; value: string }>;
} {
  const $ = cheerio.load(html);
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];

  $("table").each((_, tbl) => {
    const headers: string[] = [];
    $(tbl)
      .find("thead th, thead td, tr:first-child th")
      .each((__, th) => {
        headers.push($(th).text().trim());
      });

    const rows: string[][] = [];
    $(tbl)
      .find("tbody tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("td")
          .map((___, td) => $(td).text().trim())
          .get();
        if (cells.length > 0) rows.push(cells);
      });

    // Fallback: if no thead, treat first <tr> as headers
    if (headers.length === 0 && rows.length > 1) {
      const firstRow = rows.shift();
      if (firstRow) headers.push(...firstRow);
    }

    if (rows.length > 0 || headers.length > 0) {
      tables.push({ headers, rows });
    }
  });

  // Collect "label: number" style stats (often used for summary blocks)
  const stats: Array<{ label: string; value: string }> = [];
  $(".summary_stat, .stat_block, .stats_card, [class*='summary'] [class*='value']").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^(.+?)[:\s]+([\d,.]+)$/);
    if (match) stats.push({ label: match[1].trim(), value: match[2].replace(/,/g, "") });
  });

  return { tables, stats };
}

/** Match a header label to a known column key. Case/punctuation insensitive. */
function matchHeader(header: string, patterns: RegExp[]): boolean {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  return patterns.some((p) => p.test(norm));
}

/**
 * Convert a generic { headers, rows } table into StatRow[] using a column-key
 * resolver. Preserves any extra columns under their normalized header name.
 */
function tableToStatRows(
  headers: string[],
  rows: string[][],
  resolveKey: (header: string) => string | null
): StatRow[] {
  if (rows.length === 0) return [];
  const keys = headers.map((h) => resolveKey(h) ?? h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows
    .map((cells) => {
      const out: StatRow = { date: "" };
      keys.forEach((k, i) => {
        if (k && cells[i] !== undefined) {
          const val = cells[i].replace(/[,$]/g, "").trim();
          out[k] = val;
        }
      });
      // Ensure `date` field exists — first column is usually date
      if (!out.date && cells[0]) out.date = cells[0];
      return out;
    })
    .filter((r) => Object.keys(r).length > 1);
}

// ─── Per-metric fetch functions (using the actual data URLs) ─────────────────

/**
 * Wishlist data: https://partner.steampowered.com/app/wishlist/{appId}/
 */
async function fetchWishlists(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  _granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<StatRow[]> {
  const url = `${BASE_PARTNER}/app/wishlist/${appId}/`;
  const html = await fetchPartnerHtml("wishlist", url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
  if (!html) {
    throw new Error("Could not access wishlist stats page. Login/session not detected.");
  }

  try {
    const { tables, stats } = extractTablesAndStats(html);
    logger.info({ appId, tableCount: tables.length, statCount: stats.length, headers: tables.map((t) => t.headers) }, "wishlist parse");

    // Find the table that has wishlist-related headers
    for (const { headers, rows } of tables) {
      const hasDate = headers.some((h) => matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/]));
      const hasWishlistish = headers.some((h) => matchHeader(h, [/add/, /balance/, /wishlist/, /total/, /delete/, /purchase/]));
      if (!hasDate || !hasWishlistish) continue;

      const result = tableToStatRows(headers, rows, (h) => {
        if (matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/])) return "date";
        if (matchHeader(h, [/add/])) return "adds";
        if (matchHeader(h, [/delete/])) return "deletes";
        if (matchHeader(h, [/purchase/, /gift/, /activation/])) return "purchases";
        if (matchHeader(h, [/balance/, /^total$/, /currentwishlist/, /^net$/])) return "balance";
        return null;
      });
      if (result.length > 0) return result;
    }

    // No table matched — fall back to summary stats if present
    if (stats.length > 0) {
      return [{ date: "Summary", adds: stats.find((s) => /add/i.test(s.label))?.value || "0", balance: stats.find((s) => /balance|total/i.test(s.label))?.value || "0" }];
    }
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    if ((e as Error).message?.startsWith("Could not")) throw e;
    logger.warn({ appId, err: (e as Error).message }, "Wishlist parse error");
    throw new Error(`Could not parse wishlist data on the Steamworks page (${(e as Error).message}).`);
  }
  throw new Error("Could not find wishlist data on the Steamworks page.");
}

/**
 * Sales data: https://partner.steampowered.com/app/details/{appId}/?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
 */
async function fetchSales(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string,
  customRange?: { startIso: string; endIso: string }
): Promise<StatRow[]> {
  try {
    const { startIso, endIso } = getDateRangeIso(granularity, customRange);
    const url = `${BASE_PARTNER}/app/details/${appId}/?dateStart=${startIso}&dateEnd=${endIso}`;
    const html = await fetchPartnerHtml("sales", url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
    if (!html) return [];

    const { tables, stats } = extractTablesAndStats(html);
    logger.info({ appId, tableCount: tables.length, statCount: stats.length, headers: tables.map((t) => t.headers) }, "sales parse");

    // Sales tables typically have Units, Gross/Net Revenue
    for (const { headers, rows } of tables) {
      const hasSalesish = headers.some((h) =>
        matchHeader(h, [/unit/, /sale/, /revenue/, /gross/, /^net$/, /purchase/, /licens/, /activation/])
      );
      if (!hasSalesish) continue;

      const result = tableToStatRows(headers, rows, (h) => {
        if (matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/, /^period$/])) return "date";
        if (matchHeader(h, [/unit/, /^sales$/, /licens/, /activation/, /purchase/])) return "units";
        if (matchHeader(h, [/grossrevenue/, /^gross$/])) return "gross_revenue";
        if (matchHeader(h, [/netrevenue/, /^net$/])) return "net_revenue";
        if (matchHeader(h, [/^revenue$/])) return "gross_revenue";
        return null;
      });
      if (result.length > 0) return result;
    }

    if (stats.length > 0) {
      return [{
        date: "Summary",
        units: stats.find((s) => /unit|sale|licens/i.test(s.label))?.value || "0",
        gross_revenue: stats.find((s) => /gross|revenue/i.test(s.label))?.value || "0",
      }];
    }
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: (e as Error).message }, "Sales fetch error");
  }
  return [];
}

/**
 * Single fetch for the navtrafficstats page — contains visits, impressions,
 * AND traffic breakdown. Cached per-appId so the two consumer functions
 * (fetchVisits, fetchTrafficBreakdown) only trigger one HTTP request per game.
 */
const trafficStatsCache = new Map<string, { tables: Array<{ headers: string[]; rows: string[][] }>; stats: Array<{ label: string; value: string }> }>();

async function getTrafficStats(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
) {
  const cacheKey = `${appId}|${granularity}`;
  const cached = trafficStatsCache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/apps/navtrafficstats/${appId}`;
  const html = await fetchPartnerHtml("navtrafficstats", url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
  if (!html) {
    const empty = { tables: [], stats: [] };
    trafficStatsCache.set(cacheKey, empty);
    return empty;
  }
  const parsed = extractTablesAndStats(html);
  logger.info({ appId, tableCount: parsed.tables.length, statCount: parsed.stats.length, headers: parsed.tables.map((t) => t.headers) }, "navtrafficstats parse");
  trafficStatsCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * M7 — Pull the Store & Steam Platform Traffic Breakdown for one game and
 * return it as a canonical Page/Category CSV (the same shape the manual CSV
 * upload path produces). Used by the Electron "Pull Traffic from Steamworks"
 * flow so the rest of the pipeline (parser → processGame → workbook) needs
 * zero changes downstream.
 *
 * Returns either:
 *   { ok: true, csvText, fileName, rowCount }
 *   { ok: false, status: TrafficPullStatus, error }
 *
 * Status tokens align with the renderer / processGame contract:
 *   STEAMWORKS_LOGIN_REQUIRED  — no usable session for partner.steampowered.com
 *   TRAFFIC_PAGE_ACCESS_DENIED — page returned but with no parseable content
 *   TRAFFIC_DOWNLOAD_FAILED    — fetched, but no breakdown table extractable
 */
export type TrafficPullStatus =
  | "STEAMWORKS_LOGIN_REQUIRED"
  | "TRAFFIC_PAGE_ACCESS_DENIED"
  | "TRAFFIC_DOWNLOAD_FAILED";

const TRAFFIC_CSV_HEADERS = [
  "Page / Category",
  "Page / Feature",
  "Impressions",
  "Visits",
  "Owner Impressions",
  "Owner Visits",
] as const;

function csvCell(s: string): string {
  if (s == null) return "";
  const needsQuote = /[",\n\r]/.test(s);
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvIntCell(n: number | null): string {
  return n === null ? "" : String(n);
}

function parseLooseInt(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim().replace(/,/g, "");
  if (t === "" || t === "-" || /^n\/a$/i.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** Resolve a header label into one of the canonical CSV column keys (or null). */
function classifyTrafficHeader(header: string): keyof typeof TRAFFIC_HEADER_BUCKETS | null {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/category/.test(norm)) return "category";
  if (/feature|source|referrer|^from$|channel/.test(norm)) return "feature";
  if (/^country$|countrycode/.test(norm)) return "country";
  if (/ownerimpression/.test(norm)) return "ownerImpressions";
  if (/ownervisit|ownerview/.test(norm)) return "ownerVisits";
  if (/impression/.test(norm)) return "impressions";
  if (/^visits?$|pageview|pagevisit/.test(norm)) return "visits";
  return null;
}

const TRAFFIC_HEADER_BUCKETS = {
  category: 0,
  feature: 0,
  country: 0,
  impressions: 0,
  visits: 0,
  ownerImpressions: 0,
  ownerVisits: 0,
} as const;

export async function pullSteamworksTrafficCsv(
  appId: number,
  startIso: string,
  endIso: string,
  trafficFileToken: string,
  sessionid: string,
  steamLoginSecure: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<
  | { ok: true; csvText: string; fileName: string; rowCount: number }
  | { ok: false; status: TrafficPullStatus; error: string }
> {
  const stripDashes = (iso: string) => iso.replace(/-/g, "");
  const fileName = `traffic_${trafficFileToken}_${appId}_${stripDashes(startIso)}_${stripDashes(endIso)}.csv`;

  // Best-effort: pass dateStart / dateEnd as query params. Steamworks accepts
  // these on the navtrafficstats page; if the server ignores them the page
  // defaults to its own preset and we'll surface that as a known limitation.
  const url = `${BASE}/apps/navtrafficstats/${appId}?dateStart=${startIso}&dateEnd=${endIso}&preset_date_range=custom`;

  let html: string;
  try {
    html = await fetchPartnerHtml("navtrafficstats:csv-pull", url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "session_expired") {
      return { ok: false, status: "STEAMWORKS_LOGIN_REQUIRED", error: "Steamworks session expired or not detected — please sign in again in the desktop window." };
    }
    return { ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: `Network error fetching navtrafficstats: ${msg}` };
  }

  if (!html || html.trim().length === 0) {
    return { ok: false, status: "TRAFFIC_PAGE_ACCESS_DENIED", error: `Empty response from ${url} — the partner page is inaccessible (auth gap or 4xx).` };
  }

  let parsed: ReturnType<typeof extractTablesAndStats>;
  try {
    parsed = extractTablesAndStats(html);
  } catch (e) {
    return { ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: `Could not parse navtrafficstats HTML: ${(e as Error).message}` };
  }

  // Walk every table and emit rows for any that look like a breakdown
  // (i.e. have at least one of: feature, source, country) AND impressions/visits.
  const out: Array<{ pageCategory: string; pageFeature: string; impressions: number | null; visits: number | null; ownerImpressions: number | null; ownerVisits: number | null }> = [];

  for (const { headers, rows } of parsed.tables) {
    if (!headers || headers.length === 0 || rows.length === 0) continue;

    const colByKey: Partial<Record<keyof typeof TRAFFIC_HEADER_BUCKETS, number>> = {};
    headers.forEach((h, idx) => {
      const key = classifyTrafficHeader(h);
      if (key && colByKey[key] === undefined) colByKey[key] = idx;
    });

    const hasMetric = colByKey.impressions !== undefined || colByKey.visits !== undefined;
    const hasLabel = colByKey.feature !== undefined || colByKey.country !== undefined || colByKey.category !== undefined;
    if (!hasMetric || !hasLabel) continue;

    // Decide the synthetic Page / Category for rows in this table:
    //  - If the table itself has a Country column → category = "Country"
    //  - If the headers mention "bot" → "Bot Traffic"
    //  - Otherwise prefer the explicit Category column, falling back to a
    //    table-level label derived from the first non-feature header.
    const isCountryTable = colByKey.country !== undefined;
    const headerJoined = headers.join(" ").toLowerCase();
    const isBotTable = /\bbot/.test(headerJoined);

    for (const cells of rows) {
      const featureRaw = isCountryTable
        ? (cells[colByKey.country!] ?? "")
        : (cells[colByKey.feature ?? colByKey.category ?? 0] ?? "");
      const feature = String(featureRaw ?? "").trim();
      if (feature === "") continue;
      const explicitCategory = colByKey.category !== undefined ? String(cells[colByKey.category] ?? "").trim() : "";
      const pageCategory = isCountryTable
        ? "Country"
        : isBotTable
          ? "Bot Traffic"
          : (explicitCategory !== "" ? explicitCategory : "Steamworks Traffic");
      out.push({
        pageCategory,
        pageFeature: feature,
        impressions: parseLooseInt(colByKey.impressions !== undefined ? cells[colByKey.impressions] : undefined),
        visits: parseLooseInt(colByKey.visits !== undefined ? cells[colByKey.visits] : undefined),
        ownerImpressions: parseLooseInt(colByKey.ownerImpressions !== undefined ? cells[colByKey.ownerImpressions] : undefined),
        ownerVisits: parseLooseInt(colByKey.ownerVisits !== undefined ? cells[colByKey.ownerVisits] : undefined),
      });
    }
  }

  if (out.length === 0) {
    return { ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: `Fetched navtrafficstats but no breakdown rows were extractable for appid ${appId}. Steam may have changed the page layout.` };
  }

  const lines: string[] = [];
  lines.push(TRAFFIC_CSV_HEADERS.map(csvCell).join(","));
  for (const r of out) {
    lines.push([
      csvCell(r.pageCategory),
      csvCell(r.pageFeature),
      csvIntCell(r.impressions),
      csvIntCell(r.visits),
      csvIntCell(r.ownerImpressions),
      csvIntCell(r.ownerVisits),
    ].join(","));
  }
  const csvText = lines.join("\n") + "\n";
  logger.info({ appId, startIso, endIso, rowCount: out.length, bytes: csvText.length }, "pullSteamworksTrafficCsv synthesized CSV");
  return { ok: true, csvText, fileName, rowCount: out.length };
}

async function fetchVisits(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<StatRow[]> {
  let tables: Array<{ headers: string[]; rows: string[][] }>;
  let stats: Array<{ label: string; value: string }>;
  try {
    ({ tables, stats } = await getTrafficStats(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure));
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    throw new Error(`Could not access visits/impressions stats page. Login/session not detected. (${(e as Error).message})`);
  }
  try {

    // Visits table: has columns like Date, Visits, Unique Visitors, Impressions
    for (const { headers, rows } of tables) {
      const hasDate = headers.some((h) => matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/]));
      const hasVisits = headers.some((h) => matchHeader(h, [/visit/, /impression/, /view/, /unique/]));
      // Skip breakdown tables (they have a "source" column instead of date)
      const isBreakdown = headers.some((h) => matchHeader(h, [/source/, /referrer/, /^from$/, /channel/]));
      if (!hasDate || !hasVisits || isBreakdown) continue;

      const result = tableToStatRows(headers, rows, (h) => {
        if (matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/])) return "date";
        if (matchHeader(h, [/uniquevisit/, /^unique$/])) return "unique_visitors";
        if (matchHeader(h, [/^visits?$/, /pageview/, /pagevisit/])) return "visits";
        if (matchHeader(h, [/impression/])) return "impressions";
        return null;
      });
      if (result.length > 0) return result;
    }

    if (stats.length > 0) {
      return [{
        date: "Summary",
        visits: stats.find((s) => /visit/i.test(s.label))?.value || "0",
        unique_visitors: stats.find((s) => /unique/i.test(s.label))?.value || "0",
        impressions: stats.find((s) => /impression/i.test(s.label))?.value || "0",
      }];
    }
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    if ((e as Error).message?.startsWith("Could not")) throw e;
    logger.warn({ appId, err: (e as Error).message }, "Visits parse error");
    throw new Error(`Could not parse visits/impressions on the Steamworks page (${(e as Error).message}).`);
  }
  throw new Error("Could not find visits/impressions data on the Steamworks page.");
}

async function fetchTrafficBreakdown(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<StatRow[]> {
  try {
    const { tables } = await getTrafficStats(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure);

    for (const { headers, rows } of tables) {
      const isBreakdown = headers.some((h) => matchHeader(h, [/source/, /referrer/, /^from$/, /channel/, /category/]));
      if (!isBreakdown) continue;

      const result = tableToStatRows(headers, rows, (h) => {
        if (matchHeader(h, [/source/, /referrer/, /^from$/, /channel/, /category/])) return "source";
        if (matchHeader(h, [/uniquevisit/, /^unique$/])) return "unique_visitors";
        if (matchHeader(h, [/^visits?$/, /pageview/])) return "visits";
        if (matchHeader(h, [/impression/])) return "impressions";
        return null;
      });
      // Re-map: source goes into both `date` (for output column) and `source`
      const mapped = result.map((r) => ({ ...r, date: String(r.source || r.date || "") }));
      if (mapped.length > 0) return mapped;
    }
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    if ((e as Error).message?.startsWith("Could not")) throw e;
    logger.warn({ appId, err: (e as Error).message }, "Traffic breakdown fetch error");
    throw new Error(`Could not parse traffic breakdown on the Steamworks page (${(e as Error).message}).`);
  }
  // Traffic breakdown is sometimes legitimately empty for new games — don't
  // throw, just return [] so the absence is silent rather than an error.
  return [];
}

/**
 * Followers — no specific URL provided by user. Try the wishlist page (which
 * usually shows follower count too) and fall back to the legacy followers URL.
 */
async function fetchFollowers(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  _granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<StatRow[]> {
  try {
    const url = `${BASE_PARTNER}/app/wishlist/${appId}/`;
    const html = await fetchPartnerHtml("followers", url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
    if (!html) return [];

    const { tables, stats } = extractTablesAndStats(html);

    for (const { headers, rows } of tables) {
      const hasFollowers = headers.some((h) => matchHeader(h, [/follow/]));
      const hasDate = headers.some((h) => matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/]));
      if (!hasFollowers || !hasDate) continue;

      const result = tableToStatRows(headers, rows, (h) => {
        if (matchHeader(h, [/^date$/, /^day$/, /^week$/, /^month$/])) return "date";
        if (matchHeader(h, [/followersadded/, /newfollow/, /add/])) return "followers_added";
        if (matchHeader(h, [/totalfollow/, /^follow/, /^followers$/])) return "total_followers";
        return null;
      });
      if (result.length > 0) return result;
    }

    const total = stats.find((s) => /follow/i.test(s.label));
    if (total) return [{ date: "Summary", followers_added: "n/a", total_followers: total.value }];
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    logger.warn({ appId, err: (e as Error).message }, "Followers fetch error");
  }
  return [];
}

/** Clear the in-process traffic cache. Called at start of each pull. */
export function clearStatsCache() {
  trafficStatsCache.clear();
}

/**
 * Lightweight totals fetch for the picker reveal panel: lifetime
 * Wishlists / Impressions / Visits for one game. Reuses the same
 * parsers as the full pull so a break in one of the metric modules
 * doesn't kill the totals call.
 */
export interface GameTotals {
  wishlists: number;
  impressions: number;
  visits: number;
  errors: string[];
}

function parseNumberLoose(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function sumColumn(rows: StatRow[] | undefined, keys: string[]): number {
  if (!rows || rows.length === 0) return 0;
  // Prefer the most recent "balance" / "total"-style column when present
  // (running total) — otherwise sum the per-row deltas.
  const balanceKey = keys.find((k) => /balance|total/i.test(k));
  if (balanceKey) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = parseNumberLoose(rows[i][balanceKey]);
      if (v) return v;
    }
  }
  let total = 0;
  for (const row of rows) {
    for (const k of keys) {
      if (k in row) total += parseNumberLoose(row[k]);
    }
  }
  return total;
}

export async function fetchGameTotals(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string,
): Promise<GameTotals> {
  const errors: string[] = [];
  const result: GameTotals = { wishlists: 0, impressions: 0, visits: 0, errors };

  // Wishlists — lifetime balance
  try {
    const wl = await fetchWishlists(appId, sessionid, steamLoginSecure, "lifetime", partnerSessionid, partnerSteamLoginSecure);
    result.wishlists = sumColumn(wl, ["balance", "adds"]);
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    errors.push(`wishlists: ${(e as Error).message}`);
  }

  // Visits + impressions — lifetime sums from navtrafficstats
  try {
    const v = await fetchVisits(appId, sessionid, steamLoginSecure, "lifetime", partnerSessionid, partnerSteamLoginSecure);
    result.visits = sumColumn(v, ["visits", "unique_visitors"]);
    result.impressions = sumColumn(v, ["impressions"]);
  } catch (e) {
    if ((e as Error).message === "session_expired") throw e;
    errors.push(`visits/impressions: ${(e as Error).message}`);
  }

  return result;
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

// ─── Diagnostic probe ─────────────────────────────────────────────────────────

export interface ProbeResult {
  metric: string;
  url: string;
  status: number;
  contentType: string;
  bodyLen: number;
  bodySnippet: string;
  parsedRowCount: number;
}

/**
 * Fetch each stat endpoint for one appId and return the raw responses
 * without trying to parse them into StatRow[]. Used by the /api/pull/probe
 * debug endpoint so we can see exactly what Steamworks returns.
 */
export async function probeStats(
  appId: number,
  sessionid: string,
  steamLoginSecure: string,
  granularity: string,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string
): Promise<ProbeResult[]> {
  const { startIso, endIso } = getDateRangeIso(granularity);
  const results: ProbeResult[] = [];

  const probes: Array<{ metric: string; url: string }> = [
    {
      metric: "navtrafficstats (visits + impressions + breakdown)",
      url: `${BASE}/apps/navtrafficstats/${appId}`,
    },
    {
      metric: "wishlist",
      url: `${BASE_PARTNER}/app/wishlist/${appId}/`,
    },
    {
      metric: "details (sales)",
      url: `${BASE_PARTNER}/app/details/${appId}/?dateStart=${startIso}&dateEnd=${endIso}`,
    },
  ];

  for (const { metric, url } of probes) {
    try {
      // Uses the same JWT-refresh-aware fetcher as the real pull.
      const text = await fetchPartnerHtml(`probe:${metric}`, url, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
      const { tables, stats } = extractTablesAndStats(text);
      const parsedRowCount = tables.reduce((sum, t) => sum + t.rows.length, 0);
      const snippet =
        `tables=${tables.length} totalRows=${parsedRowCount} statBlocks=${stats.length}\n` +
        tables
          .slice(0, 4)
          .map((t, i) => `[T${i}] headers=[${t.headers.join(" | ")}] firstRow=[${(t.rows[0] || []).join(" | ")}]`)
          .join("\n");
      results.push({
        metric,
        url: url.replace(BASE_PARTNER, "[partner]").replace(BASE, "[games]"),
        status: text.length > 0 ? 200 : 0,
        contentType: "text/html",
        bodyLen: text.length,
        bodySnippet: snippet || "(empty body)",
        parsedRowCount,
      });
    } catch (e) {
      results.push({
        metric,
        url: url.replace(BASE_PARTNER, "[partner]").replace(BASE, "[games]"),
        status: 0,
        contentType: "",
        bodyLen: 0,
        bodySnippet: `ERROR: ${(e as Error).message}`,
        parsedRowCount: 0,
      });
    }
    await sleep(400);
  }

  return results;
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
  isCancelled: CancelCheck,
  partnerSessionid?: string,
  partnerSteamLoginSecure?: string,
  customRange?: { startIso: string; endIso: string }
): Promise<GameStats[]> {
  const results: GameStats[] = [];
  const METRICS = ["Wishlists", "Visits", "Traffic Breakdown", "Sales", "Followers", "Reviews"];
  const totalSteps = appIds.length * METRICS.length;
  let stepsDone = 0;
  const startTime = Date.now();

  // Reset the per-pull traffic page cache so a re-pull re-fetches.
  clearStatsCache();

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

    // Per-metric resilience — one failure does not kill the rest. Each
    // metric pushes its own descriptive error to `errors[]` which the
    // Excel writer prints at the bottom of the per-game sheet.
    const runMetric = async <T>(
      label: string,
      fn: () => Promise<T>
    ): Promise<T | undefined> => {
      report(label);
      try {
        return await fn();
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "session_expired") throw e;
        errors.push(`${label}: ${msg}`);
        logger.warn({ appId, label, err: msg }, "metric failed");
        return undefined;
      }
    };

    try {
      stats.wishlistData = await runMetric("Wishlists", () =>
        fetchWishlists(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure)
      );
      await sleep(400);

      if (isCancelled()) break;
      stats.visitsData = await runMetric("Visits & Impressions", () =>
        fetchVisits(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure)
      );
      await sleep(400);

      if (isCancelled()) break;
      stats.trafficData = await runMetric("Traffic Breakdown", () =>
        fetchTrafficBreakdown(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure)
      );
      await sleep(400);

      if (isCancelled()) break;
      stats.salesData = await runMetric("Sales", () =>
        fetchSales(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure, customRange)
      );
      await sleep(400);

      if (isCancelled()) break;
      stats.followersData = await runMetric("Followers", () =>
        fetchFollowers(appId, sessionid, steamLoginSecure, granularity, partnerSessionid, partnerSteamLoginSecure)
      );
      await sleep(400);

      if (isCancelled()) break;
      stats.reviewsData = (await runMetric("Reviews", () => fetchReviews(appId))) ?? null;
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
