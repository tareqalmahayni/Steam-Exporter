// Real Steam Partner Financial API wishlist fetcher (Milestone 3).
//
// Wraps the same endpoint proven in Milestone 2's debug command:
//   GET https://partner.steam-api.com/IPartnerFinancialsService
//       /GetAppWishlistReporting/v001/?key=...&appid=...&date=YYYY-MM-DD
//
// One call per date. Returns a structured per-day result with raw response
// text, parsed numerics, and a final status from the same enum the M2 debug
// command uses. NEVER coerces a failed pull to 0 — failures stay failures.

const ENDPOINT =
  "https://partner.steam-api.com/IPartnerFinancialsService/GetAppWishlistReporting/v001/";

export type WishlistDayStatus =
  | "REAL_DATA"
  | "TRUE_ZERO_FROM_STEAM"
  | "EMPTY_RESPONSE"
  | "PERMISSION_ERROR"
  | "MISSING_FINANCIAL_KEY"
  | "APP_NOT_ACCESSIBLE"
  | "API_ERROR";

export interface WishlistDayResult {
  dateIso: string;
  appid: string;
  status: WishlistDayStatus;
  message: string;
  httpStatus: number | null;
  /** Raw response body as text (truncated to 32 KB for log safety). */
  rawBody: string;
  /** Parsed object root (the full Steam JSON), or null on parse/network failure. */
  parsed: unknown;
  /** Convenience numerics — `null` means the field was absent. `0` is a real zero. */
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  addsWindows: number | null;
  addsMac: number | null;
  addsLinux: number | null;
  countrySummaryPresent: boolean;
  languageSummaryPresent: boolean;
  /** Net wishlist change for the day (adds - deletes - purchases - gifts), or null if any input is missing. */
  net: number | null;
}

export interface WishlistPullSummary {
  appid: string;
  startIso: string;
  endIso: string;
  daily: WishlistDayResult[];
  attempted: number;
  succeeded: number;
  failed: number;
}

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function deepFind(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === "object") {
      const found = deepFind(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Iterate inclusive ISO date window. */
export function* dailyDates(startIso: string, endIso: string): Generator<string> {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

/** Latest completed Steam reporting date. Steam's wishlist data is delivered
 *  daily for prior days; "yesterday UTC" is the safe latest-completed pick. */
export function latestCompletedReportingDateIso(now: Date = new Date()): string {
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

/** Compute the inclusive 7-day window ending on the latest completed reporting date. */
export function latestCompletedSevenDayWindow(now: Date = new Date()): { startIso: string; endIso: string } {
  const endIso = latestCompletedReportingDateIso(now);
  const end = new Date(`${endIso}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startIso: start.toISOString().slice(0, 10), endIso };
}

/** Fetch a single date. Never throws; failures are reflected in `status`. */
export async function fetchWishlistDay(opts: {
  appid: string;
  dateIso: string;
  apiKey: string | undefined;
}): Promise<WishlistDayResult> {
  const base: WishlistDayResult = {
    dateIso: opts.dateIso,
    appid: opts.appid,
    status: "API_ERROR",
    message: "",
    httpStatus: null,
    rawBody: "",
    parsed: null,
    adds: null,
    deletes: null,
    purchases: null,
    gifts: null,
    addsWindows: null,
    addsMac: null,
    addsLinux: null,
    countrySummaryPresent: false,
    languageSummaryPresent: false,
    net: null,
  };

  if (!opts.apiKey || opts.apiKey.trim() === "") {
    return { ...base, status: "MISSING_FINANCIAL_KEY", message: "STEAM_FINANCIAL_KEY not set." };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", opts.apiKey);
  url.searchParams.set("appid", opts.appid);
  url.searchParams.set("date", opts.dateIso);

  let httpStatus: number | null = null;
  let rawText = "";
  let parsed: unknown = null;
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    httpStatus = res.status;
    rawText = await res.text();
    if (rawText.trim() !== "") {
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        return {
          ...base,
          httpStatus,
          rawBody: rawText.slice(0, 32_000),
          status: "API_ERROR",
          message: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
  } catch (e) {
    return {
      ...base,
      status: "API_ERROR",
      message: `network error: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
    };
  }

  // HTTP-level errors first.
  if (httpStatus === 401 || httpStatus === 403) {
    return { ...base, httpStatus, rawBody: rawText.slice(0, 32_000), status: "PERMISSION_ERROR", message: `HTTP ${httpStatus} — key rejected or no access.` };
  }
  if (httpStatus === 404) {
    return { ...base, httpStatus, rawBody: rawText.slice(0, 32_000), status: "APP_NOT_ACCESSIBLE", message: `HTTP 404 — Steam reports no such app or no access.` };
  }
  if (typeof httpStatus === "number" && httpStatus >= 400) {
    return { ...base, httpStatus, rawBody: rawText.slice(0, 32_000), status: "API_ERROR", message: `HTTP ${httpStatus}.` };
  }

  // Body present? Parse fields.
  if (rawText.trim() === "" || !isPresent(parsed)) {
    return { ...base, httpStatus, rawBody: rawText.slice(0, 32_000), status: "EMPTY_RESPONSE", message: "Steam returned an empty body." };
  }

  const adds = pickNumber(deepFind(parsed, "wishlist_adds"));
  const deletes = pickNumber(deepFind(parsed, "wishlist_deletes"));
  const purchases = pickNumber(deepFind(parsed, "wishlist_purchases"));
  const gifts = pickNumber(deepFind(parsed, "wishlist_gifts"));
  const addsWindows = pickNumber(deepFind(parsed, "wishlist_adds_windows"));
  const addsMac = pickNumber(deepFind(parsed, "wishlist_adds_mac"));
  const addsLinux = pickNumber(deepFind(parsed, "wishlist_adds_linux"));
  const countrySummaryPresent = isPresent(deepFind(parsed, "country_summary"));
  const languageSummaryPresent = isPresent(deepFind(parsed, "language_summary"));

  const net =
    adds !== null && deletes !== null && purchases !== null && gifts !== null
      ? adds - deletes - purchases - gifts
      : null;

  const numericKeys = [adds, deletes, purchases, gifts, addsWindows, addsMac, addsLinux];
  const anyNonZero = numericKeys.some((n) => typeof n === "number" && n !== 0);
  const anyPresent = numericKeys.some((n) => n !== null);
  const allPresentZero = anyPresent && numericKeys.every((n) => n === null || n === 0);

  if (anyNonZero || countrySummaryPresent || languageSummaryPresent) {
    return {
      ...base,
      httpStatus,
      rawBody: rawText.slice(0, 32_000),
      parsed,
      adds, deletes, purchases, gifts, addsWindows, addsMac, addsLinux,
      countrySummaryPresent, languageSummaryPresent,
      net,
      status: "REAL_DATA",
      message: "OK",
    };
  }
  if (allPresentZero) {
    return {
      ...base,
      httpStatus,
      rawBody: rawText.slice(0, 32_000),
      parsed,
      adds, deletes, purchases, gifts, addsWindows, addsMac, addsLinux,
      countrySummaryPresent, languageSummaryPresent,
      net,
      status: "TRUE_ZERO_FROM_STEAM",
      message: "All wishlist counters present and equal to zero.",
    };
  }
  return {
    ...base,
    httpStatus,
    rawBody: rawText.slice(0, 32_000),
    parsed,
    status: "EMPTY_RESPONSE",
    message: "Response parsed, but no recognizable wishlist fields were found.",
  };
}

/** Fetch a contiguous date window (one request per day, with polite 350ms spacing). */
export async function fetchWishlistRange(opts: {
  appid: string;
  startIso: string;
  endIso: string;
  apiKey: string | undefined;
  onProgress?: (day: WishlistDayResult, idx: number, total: number) => void;
}): Promise<WishlistPullSummary> {
  const dates = Array.from(dailyDates(opts.startIso, opts.endIso));
  const daily: WishlistDayResult[] = [];
  for (let i = 0; i < dates.length; i++) {
    const d = await fetchWishlistDay({ appid: opts.appid, dateIso: dates[i], apiKey: opts.apiKey });
    daily.push(d);
    opts.onProgress?.(d, i, dates.length);
    if (i < dates.length - 1) await sleep(350);
  }
  const succeeded = daily.filter((d) => d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM").length;
  return {
    appid: opts.appid,
    startIso: opts.startIso,
    endIso: opts.endIso,
    daily,
    attempted: daily.length,
    succeeded,
    failed: daily.length - succeeded,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
