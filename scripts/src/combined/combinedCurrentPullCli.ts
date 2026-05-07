/**
 * Milestone 6 — Combined Pull Data Alone export (wishlist + traffic) for
 * all five games.
 *
 * Reuses:
 *  - The proven wishlist pull cache from M4B
 *    (.local/tracker-runs/<stamp>/wishlist-pull-cache.json) — re-uses if
 *    a cache file matches the requested window, else fails loudly so the
 *    user can run the M4B CLI first. (M6 is a presentation milestone — it
 *    must NOT modify the wishlist orchestrator.)
 *  - The proven M5 traffic CSV parser
 *    (scripts/src/traffic/trafficCsv.ts).
 *
 * Sheet order (per M6 spec):
 *   1. Executive Summary
 *   2. Game Comparison
 *   3. Colossus - Eternal Blight
 *   4. Fleetbreakers
 *   5. Taival
 *   6. Noor
 *   7. Petunia's Purgatory
 *   8. Raw_Wishlist_API
 *   9. Raw_Traffic
 *   10. Validation
 *   11. Pull Log
 *
 * CLI:
 *   pnpm --filter @workspace/scripts run tracker:current-pull:combined:all-games
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS, { type Workbook } from "exceljs";

import {
  TRAFFIC_APP_ALLOWLIST,
  parseTrafficCsv,
  validateTrafficFileIdentity,
  normalizeTrafficRows,
  splitTrafficRowsIntoPageSourceAndCountry,
  validateTrafficRows,
  aggregateTrafficByGameAndWindow,
  aggregateTrafficBySourcePage,
  aggregateTrafficByCountry,
  calculateCtr,
  type NormalizedTrafficRow,
  type PageSourceAggregate,
  type CountryAggregate,
  type WindowAggregate,
} from "../traffic/trafficCsv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const TRAFFIC_INPUT_DIR = path.join(repoRoot, ".local", "input", "traffic");

const REQUESTED_WINDOW = { startIso: "2026-04-30", endIso: "2026-05-06" };

/** Spec-required sheet order (positions 3..7 are the five game sheets). */
const GAME_SPECS: Array<{
  cacheId: string; // matches CachedGame.id from M4B
  appid: string;
  displayName: string;
  trafficFileName: string;
}> = [
  { cacheId: "colossus", appid: "1722800", displayName: "Colossus - Eternal Blight", trafficFileName: "traffic_colossus_1722800_20260430_20260506.csv" },
  { cacheId: "fleet",    appid: "2929040", displayName: "Fleetbreakers",             trafficFileName: "traffic_fleetbreakers_2929040_20260430_20260506.csv" },
  { cacheId: "taival",   appid: "3152750", displayName: "Taival",                    trafficFileName: "traffic_taival_3152750_20260430_20260506.csv" },
  { cacheId: "noor",     appid: "3728760", displayName: "Noor",                      trafficFileName: "traffic_noor_3728760_20260430_20260506.csv" },
  { cacheId: "petunia",  appid: "4009450", displayName: "Petunia's Purgatory",       trafficFileName: "traffic_petunia_4009450_20260430_20260506.csv" },
];

const PETUNIA_VTI_NOTE =
  "Visits exceed impressions because off-Steam referrers (e.g. facebook.com, instagram, Google) carry 0 tracked impressions on Steam.";

// ---------------------------------------------------------------------------
// Wishlist cache types (mirrors the JSON shape written by M4B).
// ---------------------------------------------------------------------------

type WishlistDayStatus =
  | "REAL_DATA"
  | "TRUE_ZERO_FROM_STEAM"
  | "EMPTY_RESPONSE"
  | "PERMISSION_ERROR"
  | "MISSING_FINANCIAL_KEY"
  | "APP_NOT_ACCESSIBLE"
  | "API_ERROR";

interface WishlistDayResult {
  dateIso: string;
  appid: string;
  status: WishlistDayStatus;
  message: string;
  httpStatus: number | null;
  parsed: unknown;
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  addsWindows: number | null;
  addsMac: number | null;
  addsLinux: number | null;
  countrySummaryPresent: boolean;
  languageSummaryPresent: boolean;
  net: number | null;
}

interface WishlistPullSummary {
  appid: string;
  startIso: string;
  endIso: string;
  daily: WishlistDayResult[];
  attempted: number;
  succeeded: number;
  failed: number;
}

interface CachedGame {
  id: string;
  canonicalName: string;
  appid: string;
  overallStatus: WishlistDayStatus;
  summary: WishlistPullSummary;
}

interface CacheFile {
  version: number;
  writtenAt: string;
  range: { startIso: string; endIso: string; label?: string };
  games: CachedGame[];
}

// ---------------------------------------------------------------------------
// Number / formatting helpers
// ---------------------------------------------------------------------------

const NA = "NOT AVAILABLE" as const;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function valOrNa(v: number | null | undefined): number | typeof NA {
  return v === null || v === undefined ? NA : v;
}

function fmtRatio(visits: number | null, impressions: number | null): string {
  const c = calculateCtr(visits, impressions);
  return c === null ? NA : `${(c * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Wishlist cache: discover + assemble
// ---------------------------------------------------------------------------

function findWishlistCache(window: { startIso: string; endIso: string }): { path: string; cache: CacheFile } | null {
  const runsDir = path.join(repoRoot, ".local", "tracker-runs");
  if (!fs.existsSync(runsDir)) return null;
  const dirs = fs.readdirSync(runsDir).sort().reverse();
  const requiredIds = new Set(GAME_SPECS.map((g) => g.cacheId));
  for (const d of dirs) {
    const p = path.join(runsDir, d, "wishlist-pull-cache.json");
    if (!fs.existsSync(p)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as CacheFile;
      if (raw.range.startIso !== window.startIso || raw.range.endIso !== window.endIso) continue;
      const have = new Set(raw.games.map((g) => g.id));
      let ok = true;
      for (const id of requiredIds) if (!have.has(id)) { ok = false; break; }
      if (ok) return { path: p, cache: raw };
    } catch {
      continue;
    }
  }
  return null;
}

interface DerivedBreakdownRow {
  dateIso: string;
  key: string;
  label: string;
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  net: number | null;
}

function netOf(adds: number | null, deletes: number | null, purchases: number | null, gifts: number | null): number | null {
  if (adds === null || deletes === null || purchases === null || gifts === null) return null;
  return adds - deletes - purchases - gifts;
}

/** country_summary in cache: array of {country_code, country_name, region, summary_actions: {wishlist_*}} */
function extractCountryRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.countrySummaryPresent) continue;
    const resp = (d.parsed as { response?: { country_summary?: unknown } })?.response;
    const cs = resp?.country_summary;
    if (!Array.isArray(cs)) continue;
    for (const e of cs) {
      const obj = e as Record<string, unknown>;
      const code = String(obj.country_code ?? obj.code ?? "");
      const name = String(obj.country_name ?? obj.name ?? "");
      const sa = (obj.summary_actions ?? obj) as Record<string, unknown>;
      const adds = num(sa.wishlist_adds ?? sa.adds);
      const deletes = num(sa.wishlist_deletes ?? sa.deletes);
      const purchases = num(sa.wishlist_purchases ?? sa.purchases);
      const gifts = num(sa.wishlist_gifts ?? sa.gifts);
      rows.push({ dateIso: d.dateIso, key: code, label: name, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

function extractLanguageRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.languageSummaryPresent) continue;
    const resp = (d.parsed as { response?: { language_summary?: unknown } })?.response;
    const ls = resp?.language_summary;
    if (!Array.isArray(ls)) continue;
    for (const e of ls) {
      const obj = e as Record<string, unknown>;
      const code = String(obj.language ?? obj.lang ?? obj.code ?? "");
      const label = String(obj.language_name ?? obj.name ?? code);
      const sa = (obj.summary_actions ?? obj) as Record<string, unknown>;
      const adds = num(sa.wishlist_adds ?? sa.adds);
      const deletes = num(sa.wishlist_deletes ?? sa.deletes);
      const purchases = num(sa.wishlist_purchases ?? sa.purchases);
      const gifts = num(sa.wishlist_gifts ?? sa.gifts);
      rows.push({ dateIso: d.dateIso, key: code, label, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

interface WishlistTotals {
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  net: number | null;
}

function aggregateWishlist(s: WishlistPullSummary): WishlistTotals {
  // Per-field accumulator: only sum non-null values from REAL_DATA /
  // TRUE_ZERO_FROM_STEAM days. If ANY such day is missing the field, the
  // field total becomes null (rendered as NOT AVAILABLE) — never coerced
  // to a fake 0.
  const sumField = (pick: (d: WishlistDayResult) => number | null): number | null => {
    let sum = 0;
    let anyReal = false;
    for (const d of s.daily) {
      if (d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM") continue;
      anyReal = true;
      const v = pick(d);
      if (v === null) return null;
      sum += v;
    }
    return anyReal ? sum : null;
  };
  const adds = sumField((d) => d.adds);
  const deletes = sumField((d) => d.deletes);
  const purchases = sumField((d) => d.purchases);
  const gifts = sumField((d) => d.gifts);
  const net = (adds === null || deletes === null || purchases === null || gifts === null)
    ? null : adds - deletes - purchases - gifts;
  return { adds, deletes, purchases, gifts, net };
}

// ---------------------------------------------------------------------------
// Per-game record assembly
// ---------------------------------------------------------------------------

interface PerGame {
  spec: typeof GAME_SPECS[number];
  // Wishlist
  wishlistStatus: WishlistDayStatus | "WISHLIST_CACHE_MISSING";
  wishlistDaily: WishlistDayResult[];
  wishlistTotals: WishlistTotals;
  countryRows: DerivedBreakdownRow[];
  languageRows: DerivedBreakdownRow[];
  // Traffic
  trafficStatus: "REAL_DATA" | "TRAFFIC_CSV_MISSING" | "PARSE_FAILED";
  trafficCsvPath: string;
  trafficStartIso: string | null;
  trafficEndIso: string | null;
  trafficHeaders: string[];
  trafficRows: NormalizedTrafficRow[];
  trafficPageSource: NormalizedTrafficRow[];
  trafficCountry: NormalizedTrafficRow[];
  trafficInvalid: Array<{ lineNumber: number; raw: string; reason: string }>;
  trafficTotals: WindowAggregate | null;
  trafficByPageSource: PageSourceAggregate[];
  trafficByCountry: CountryAggregate[];
  // Combined
  warnings: string[];
  errors: string[];
}

function processGame(spec: typeof GAME_SPECS[number], cached: CachedGame | undefined): PerGame {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Wishlist
  let wishlistStatus: PerGame["wishlistStatus"];
  let wishlistDaily: WishlistDayResult[] = [];
  let wishlistTotals: WishlistTotals = { adds: null, deletes: null, purchases: null, gifts: null, net: null };
  let countryRows: DerivedBreakdownRow[] = [];
  let languageRows: DerivedBreakdownRow[] = [];
  if (!cached) {
    wishlistStatus = "WISHLIST_CACHE_MISSING";
    errors.push(`No wishlist cache entry for ${spec.displayName}`);
  } else {
    wishlistStatus = cached.overallStatus;
    wishlistDaily = cached.summary.daily;
    wishlistTotals = aggregateWishlist(cached.summary);
    countryRows = extractCountryRows(cached.summary.daily);
    languageRows = extractLanguageRows(cached.summary.daily);
    const failedDays = cached.summary.daily.filter((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
    for (const d of failedDays) {
      const target = d.status === "EMPTY_RESPONSE" ? warnings : errors;
      target.push(`Wishlist ${d.dateIso} [${d.status}] ${d.message}`);
    }
  }

  // Traffic
  const csvPath = path.join(TRAFFIC_INPUT_DIR, spec.trafficFileName);
  let trafficStatus: PerGame["trafficStatus"] = "REAL_DATA";
  let trafficStartIso: string | null = null;
  let trafficEndIso: string | null = null;
  let trafficHeaders: string[] = [];
  let trafficRows: NormalizedTrafficRow[] = [];
  let trafficPageSource: NormalizedTrafficRow[] = [];
  let trafficCountry: NormalizedTrafficRow[] = [];
  let trafficInvalid: Array<{ lineNumber: number; raw: string; reason: string }> = [];
  let trafficTotals: WindowAggregate | null = null;
  let trafficByPageSource: PageSourceAggregate[] = [];
  let trafficByCountry: CountryAggregate[] = [];

  if (!fs.existsSync(csvPath)) {
    trafficStatus = "TRAFFIC_CSV_MISSING";
    errors.push(`Traffic CSV missing: ${spec.trafficFileName}`);
  } else {
    const ident = validateTrafficFileIdentity(csvPath, {
      appAllowlist: TRAFFIC_APP_ALLOWLIST,
      expectedRange: REQUESTED_WINDOW,
    });
    warnings.push(...ident.warnings);
    errors.push(...ident.errors);
    if (!ident.ok || !ident.appid || !ident.startIso || !ident.endIso) {
      trafficStatus = "PARSE_FAILED";
    } else if (ident.appid !== spec.appid) {
      errors.push(`Traffic CSV AppID ${ident.appid} mismatched expected ${spec.appid} for ${spec.displayName}`);
      trafficStatus = "PARSE_FAILED";
    } else {
      trafficStartIso = ident.startIso;
      trafficEndIso = ident.endIso;
      const parsed = parseTrafficCsv(csvPath);
      trafficHeaders = parsed.headers;
      trafficInvalid = parsed.invalidLines;
      for (const inv of parsed.invalidLines) warnings.push(`Traffic line ${inv.lineNumber}: ${inv.reason}`);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        errors.push(`Traffic CSV produced no rows for ${spec.displayName}`);
        trafficStatus = "PARSE_FAILED";
      } else {
        const normalized = normalizeTrafficRows(parsed.rows);
        const split = splitTrafficRowsIntoPageSourceAndCountry(normalized);
        const v = validateTrafficRows(normalized);
        warnings.push(...v.warnings);
        trafficRows = normalized;
        trafficPageSource = split.pageSource;
        trafficCountry = split.country;
        trafficTotals = aggregateTrafficByGameAndWindow(normalized);
        trafficByPageSource = aggregateTrafficBySourcePage(normalized);
        trafficByCountry = aggregateTrafficByCountry(normalized);

        // Petunia-specific note when visits exceed impressions.
        if (
          spec.cacheId === "petunia" &&
          trafficTotals &&
          trafficTotals.publicImpressions > 0 &&
          trafficTotals.publicVisits > trafficTotals.publicImpressions
        ) {
          warnings.push(`Petunia VTI > 100%: ${PETUNIA_VTI_NOTE}`);
        }
      }
    }
  }

  return {
    spec,
    wishlistStatus, wishlistDaily, wishlistTotals, countryRows, languageRows,
    trafficStatus, trafficCsvPath: csvPath,
    trafficStartIso, trafficEndIso, trafficHeaders,
    trafficRows, trafficPageSource, trafficCountry, trafficInvalid,
    trafficTotals, trafficByPageSource, trafficByCountry,
    warnings, errors,
  };
}

// ---------------------------------------------------------------------------
// Workbook: writers (sheet order matters!)
// ---------------------------------------------------------------------------

function writeExecutiveSummary(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string }, finalStatus: "PASSED" | "FAILED", pullTimestamp: string): void {
  const ws = wb.addWorksheet("Executive Summary");

  ws.getCell("A1").value = "Steamworks Combined Pull Report";
  ws.getCell("A1").font = { bold: true, size: 16 };

  let r = 3;
  const meta: Array<[string, string | number]> = [
    ["Date range", `${window.startIso} → ${window.endIso}`],
    ["Pull timestamp", pullTimestamp],
    ["Total games included", perGame.length],
    ["Wishlist data source", "Steam Partner Financial API (cached pull)"],
    ["Traffic data source", "Steam App Traffic CSV exports"],
    ["Overall status", finalStatus],
  ];
  for (const [k, v] of meta) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  // Per-game short summary table.
  ws.getCell(`A${r}`).value = "Per-game summary";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const headers = [
    "Game", "AppID",
    "Wishlist net", "Public visits", "Public impressions", "Visit/Impression",
    "Wishlist status", "Traffic status",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(r, i + 1);
    c.value = headers[i];
    c.font = { bold: true };
  }
  r++;
  for (const g of perGame) {
    const t = g.trafficTotals;
    ws.getCell(r, 1).value = g.spec.displayName;
    ws.getCell(r, 2).value = g.spec.appid;
    ws.getCell(r, 3).value = valOrNa(g.wishlistTotals.net);
    ws.getCell(r, 4).value = t ? t.publicVisits : NA;
    ws.getCell(r, 5).value = t ? t.publicImpressions : NA;
    ws.getCell(r, 6).value = t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA;
    ws.getCell(r, 7).value = g.wishlistStatus;
    ws.getCell(r, 8).value = g.trafficStatus;
    r++;
  }

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 12;
  for (let c = 3; c <= 8; c++) ws.getColumn(c).width = 20;
}

function writeGameComparison(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Game Comparison");
  const headers = [
    "Game", "AppID",
    "Wishlist adds", "Wishlist deletes", "Net wishlist change",
    "Public impressions", "Public visits", "Visit-to-impression ratio",
    "Owner visits", "Bot visits",
    "Wishlist status", "Traffic status", "Warnings",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(1, i + 1);
    c.value = headers[i];
    c.font = { bold: true };
  }
  let r = 2;
  for (const g of perGame) {
    const t = g.trafficTotals;
    ws.getCell(r, 1).value = g.spec.displayName;
    ws.getCell(r, 2).value = g.spec.appid;
    ws.getCell(r, 3).value = valOrNa(g.wishlistTotals.adds);
    ws.getCell(r, 4).value = valOrNa(g.wishlistTotals.deletes);
    ws.getCell(r, 5).value = valOrNa(g.wishlistTotals.net);
    ws.getCell(r, 6).value = t ? t.publicImpressions : NA;
    ws.getCell(r, 7).value = t ? t.publicVisits : NA;
    ws.getCell(r, 8).value = t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA;
    ws.getCell(r, 9).value = t ? t.ownerVisits : NA;
    ws.getCell(r, 10).value = t ? t.botVisits : NA;
    ws.getCell(r, 11).value = g.wishlistStatus;
    ws.getCell(r, 12).value = g.trafficStatus;
    ws.getCell(r, 13).value = g.warnings.length === 0 ? "(none)" : g.warnings.join("; ");
    r++;
  }
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 10;
  for (let c = 3; c <= 12; c++) ws.getColumn(c).width = 18;
  ws.getColumn(13).width = 80;
}

function writeGameSheet(wb: Workbook, g: PerGame, window: { startIso: string; endIso: string }): void {
  const ws = wb.addWorksheet(g.spec.displayName);
  let r = 1;

  // Section A — Game Overview
  ws.getCell(`A${r}`).value = "SECTION A — GAME OVERVIEW";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const t = g.trafficTotals;
  const overview: Array<[string, string | number]> = [
    ["Game", g.spec.displayName],
    ["AppID", g.spec.appid],
    ["Date range", `${window.startIso} → ${window.endIso}`],
    ["Wishlist adds", valOrNa(g.wishlistTotals.adds)],
    ["Wishlist deletes", valOrNa(g.wishlistTotals.deletes)],
    ["Wishlist purchases", valOrNa(g.wishlistTotals.purchases)],
    ["Wishlist gifts", valOrNa(g.wishlistTotals.gifts)],
    ["Net wishlist change", valOrNa(g.wishlistTotals.net)],
    ["Public impressions", t ? t.publicImpressions : NA],
    ["Public visits", t ? t.publicVisits : NA],
    ["Visit-to-impression ratio", t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA],
    ["Owner impressions", t ? t.ownerImpressions : NA],
    ["Owner visits", t ? t.ownerVisits : NA],
    ["Bot impressions", t ? t.botImpressions : NA],
    ["Bot visits", t ? t.botVisits : NA],
    ["Wishlist status", g.wishlistStatus],
    ["Traffic status", g.trafficStatus],
    ["Warnings", g.warnings.length === 0 ? "(none)" : g.warnings.join("; ")],
    ["Errors", g.errors.length === 0 ? "(none)" : g.errors.join("; ")],
  ];
  for (const [k, v] of overview) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  // Section B — Daily Wishlist Data
  ws.getCell(`A${r}`).value = "SECTION B — DAILY WISHLIST DATA";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const dh = ["Date", "Adds", "Deletes", "Purchases", "Gifts", "Net", "Windows Adds", "Mac Adds", "Linux Adds", "Status", "Message"];
  for (let i = 0; i < dh.length; i++) { const c = ws.getCell(r, i + 1); c.value = dh[i]; c.font = { bold: true }; }
  r++;
  if (g.wishlistDaily.length === 0) {
    ws.getCell(`A${r}`).value = NA; r++;
  } else {
    for (const d of g.wishlistDaily) {
      const ok = d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM";
      ws.getCell(r, 1).value = d.dateIso;
      ws.getCell(r, 2).value = ok ? valOrNa(d.adds) : NA;
      ws.getCell(r, 3).value = ok ? valOrNa(d.deletes) : NA;
      ws.getCell(r, 4).value = ok ? valOrNa(d.purchases) : NA;
      ws.getCell(r, 5).value = ok ? valOrNa(d.gifts) : NA;
      ws.getCell(r, 6).value = ok ? valOrNa(d.net) : NA;
      ws.getCell(r, 7).value = ok ? valOrNa(d.addsWindows) : NA;
      ws.getCell(r, 8).value = ok ? valOrNa(d.addsMac) : NA;
      ws.getCell(r, 9).value = ok ? valOrNa(d.addsLinux) : NA;
      ws.getCell(r, 10).value = d.status;
      ws.getCell(r, 11).value = d.message;
      r++;
    }
  }
  r++;

  // Section C — Traffic Page/Source Breakdown
  ws.getCell(`A${r}`).value = "SECTION C — TRAFFIC PAGE/SOURCE BREAKDOWN";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const ph = ["Source Category", "Source/Page Feature", "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits", "Is Bot"];
  for (let i = 0; i < ph.length; i++) { const c = ws.getCell(r, i + 1); c.value = ph[i]; c.font = { bold: true }; }
  r++;
  if (g.trafficStatus !== "REAL_DATA") {
    for (let i = 1; i <= ph.length; i++) ws.getCell(r, i).value = NA;
    ws.getCell(r, ph.length).value = g.trafficStatus;
    r++;
  } else {
    for (const a of g.trafficByPageSource) {
      ws.getCell(r, 1).value = a.category;
      ws.getCell(r, 2).value = a.feature;
      ws.getCell(r, 3).value = a.impressions;
      ws.getCell(r, 4).value = a.visits;
      ws.getCell(r, 5).value = a.ctr === null ? NA : `${(a.ctr * 100).toFixed(2)}%`;
      ws.getCell(r, 6).value = a.ownerImpressions;
      ws.getCell(r, 7).value = a.ownerVisits;
      ws.getCell(r, 8).value = a.isBot ? "YES" : "NO";
      r++;
    }
  }
  r++;

  // Section D — Traffic Country Breakdown
  ws.getCell(`A${r}`).value = "SECTION D — TRAFFIC COUNTRY BREAKDOWN";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const tch = ["Country Code", "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits"];
  for (let i = 0; i < tch.length; i++) { const c = ws.getCell(r, i + 1); c.value = tch[i]; c.font = { bold: true }; }
  r++;
  if (g.trafficStatus !== "REAL_DATA") {
    for (let i = 1; i <= tch.length; i++) ws.getCell(r, i).value = NA;
    r++;
  } else {
    for (const a of g.trafficByCountry) {
      ws.getCell(r, 1).value = a.countryCode;
      ws.getCell(r, 2).value = a.impressions;
      ws.getCell(r, 3).value = a.visits;
      ws.getCell(r, 4).value = a.ctr === null ? NA : `${(a.ctr * 100).toFixed(2)}%`;
      ws.getCell(r, 5).value = a.ownerImpressions;
      ws.getCell(r, 6).value = a.ownerVisits;
      r++;
    }
  }
  r++;

  // Section E — Wishlist Country Breakdown (only if data is available)
  if (g.countryRows.length > 0) {
    ws.getCell(`A${r}`).value = "SECTION E — WISHLIST COUNTRY BREAKDOWN";
    ws.getCell(`A${r}`).font = { bold: true };
    r++;
    const wch = ["Date", "Country Code", "Country Name", "Adds", "Deletes", "Purchases", "Gifts", "Net"];
    for (let i = 0; i < wch.length; i++) { const c = ws.getCell(r, i + 1); c.value = wch[i]; c.font = { bold: true }; }
    r++;
    for (const cr of g.countryRows) {
      ws.getCell(r, 1).value = cr.dateIso;
      ws.getCell(r, 2).value = cr.key;
      ws.getCell(r, 3).value = cr.label || NA;
      ws.getCell(r, 4).value = valOrNa(cr.adds);
      ws.getCell(r, 5).value = valOrNa(cr.deletes);
      ws.getCell(r, 6).value = valOrNa(cr.purchases);
      ws.getCell(r, 7).value = valOrNa(cr.gifts);
      ws.getCell(r, 8).value = valOrNa(cr.net);
      r++;
    }
    r++;
  }

  // Section F — Wishlist Language Breakdown (only if data is available)
  if (g.languageRows.length > 0) {
    ws.getCell(`A${r}`).value = "SECTION F — WISHLIST LANGUAGE BREAKDOWN";
    ws.getCell(`A${r}`).font = { bold: true };
    r++;
    const wlh = ["Date", "Language", "Adds", "Deletes", "Purchases", "Gifts", "Net"];
    for (let i = 0; i < wlh.length; i++) { const c = ws.getCell(r, i + 1); c.value = wlh[i]; c.font = { bold: true }; }
    r++;
    for (const lr of g.languageRows) {
      ws.getCell(r, 1).value = lr.dateIso;
      ws.getCell(r, 2).value = lr.label;
      ws.getCell(r, 3).value = valOrNa(lr.adds);
      ws.getCell(r, 4).value = valOrNa(lr.deletes);
      ws.getCell(r, 5).value = valOrNa(lr.purchases);
      ws.getCell(r, 6).value = valOrNa(lr.gifts);
      ws.getCell(r, 7).value = valOrNa(lr.net);
      r++;
    }
  }

  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 28;
  for (let c = 3; c <= 11; c++) ws.getColumn(c).width = 16;
}

function writeRawWishlistApi(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Raw_Wishlist_API");
  ws.getRow(1).values = [
    "Date", "Game", "AppID",
    "Adds", "Deletes", "Purchases", "Gifts",
    "Windows Adds", "Mac Adds", "Linux Adds", "Net",
    "Country Summary Present", "Language Summary Present",
    "HTTP", "Status", "Message",
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    if (g.wishlistDaily.length === 0) {
      ws.addRow(["NOT AVAILABLE", g.spec.displayName, g.spec.appid, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, g.wishlistStatus, "No daily data in cache"]);
      continue;
    }
    for (const d of g.wishlistDaily) {
      ws.addRow([
        d.dateIso, g.spec.displayName, g.spec.appid,
        valOrNa(d.adds), valOrNa(d.deletes), valOrNa(d.purchases), valOrNa(d.gifts),
        valOrNa(d.addsWindows), valOrNa(d.addsMac), valOrNa(d.addsLinux), valOrNa(d.net),
        d.countrySummaryPresent ? "YES" : "NO",
        d.languageSummaryPresent ? "YES" : "NO",
        d.httpStatus ?? NA, d.status, d.message,
      ]);
    }
  }
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 10;
  for (let c = 4; c <= 13; c++) ws.getColumn(c).width = 14;
  ws.getColumn(14).width = 8;
  ws.getColumn(15).width = 22;
  ws.getColumn(16).width = 60;
}

function writeRawTraffic(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Raw_Traffic");
  ws.getRow(1).values = [
    "Game", "AppID", "Source Line", "Bucket",
    "Page / Category", "Page / Feature (raw)", "Page / Feature (display)",
    "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits",
    "Is Bot", "Is Country",
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    if (g.trafficStatus !== "REAL_DATA") {
      ws.addRow([g.spec.displayName, g.spec.appid, NA, g.trafficStatus,
        NA, NA, NA, NA, NA, NA, NA, NA, NA, NA]);
      continue;
    }
    for (const r of g.trafficRows) {
      ws.addRow([
        g.spec.displayName, g.spec.appid, r.lineNumber,
        r.isCountry ? "Country" : (r.isBot ? "Bot" : "Page/Source"),
        r.pageCategory, r.pageFeature, r.pageFeatureDisplay,
        valOrNa(r.impressions), valOrNa(r.visits),
        fmtRatio(r.visits, r.impressions),
        valOrNa(r.ownerImpressions), valOrNa(r.ownerVisits),
        r.isBot ? "YES" : "NO", r.isCountry ? "YES" : "NO",
      ]);
    }
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 10;
  for (let c = 3; c <= 14; c++) ws.getColumn(c).width = 14;
  ws.getColumn(5).width = 30;
  ws.getColumn(6).width = 32;
  ws.getColumn(7).width = 32;
}

function writeValidation(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string }, wishlistCachePath: string, finalStatus: "PASSED" | "FAILED", pullTimestamp: string): void {
  const ws = wb.addWorksheet("Validation");
  ws.getRow(1).values = ["Field", "Value"];
  ws.getRow(1).font = { bold: true };
  let r = 2;
  const set = (k: string, v: string | number) => { ws.getRow(r).values = [k, v]; r++; };

  set("Export mode", "Pull Data Alone — Combined (Wishlist + Traffic)");
  set("Pull timestamp", pullTimestamp);
  set("Date range", `${window.startIso} → ${window.endIso}`);
  set("Wishlist data source", `Cached pull (reused, NOT re-pulled): ${wishlistCachePath}`);
  set("Traffic data source", `CSV files in ${TRAFFIC_INPUT_DIR}`);
  set("Total games included", perGame.length);
  set("Sheet order", "Executive Summary | Game Comparison | <5 game sheets> | Raw_Wishlist_API | Raw_Traffic | Validation | Pull Log");
  set("Wishlist data included", "YES");
  set("Traffic data included", "YES");
  set("Old tracker history included", "NO");
  set("Dashboard included", "NO");
  set("Consolidated KPI included", "NO");
  set("KPI by Quarter included", "NO");
  set("CTR / Visit-to-impression method", "Visits / Impressions, only when Impressions > 0; else NOT AVAILABLE");
  set("Final status", finalStatus);
  r++;
  ws.getRow(r).values = ["--- Per game ---", ""]; ws.getRow(r).font = { bold: true }; r++;
  for (const g of perGame) {
    const t = g.trafficTotals;
    set(`${g.spec.displayName} — wishlist status`, g.wishlistStatus);
    set(`${g.spec.displayName} — traffic status`, g.trafficStatus);
    set(`${g.spec.displayName} — wishlist adds`, valOrNa(g.wishlistTotals.adds));
    set(`${g.spec.displayName} — wishlist deletes`, valOrNa(g.wishlistTotals.deletes));
    set(`${g.spec.displayName} — wishlist net`, valOrNa(g.wishlistTotals.net));
    set(`${g.spec.displayName} — traffic public impressions`, t ? t.publicImpressions : NA);
    set(`${g.spec.displayName} — traffic public visits`, t ? t.publicVisits : NA);
    set(`${g.spec.displayName} — visit/impression`, t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA);
    set(`${g.spec.displayName} — owner impressions / visits`, t ? `${t.ownerImpressions} / ${t.ownerVisits}` : NA);
    set(`${g.spec.displayName} — bot impressions / visits`, t ? `${t.botImpressions} / ${t.botVisits}` : NA);
    set(`${g.spec.displayName} — wishlist country rows`, g.countryRows.length);
    set(`${g.spec.displayName} — wishlist language rows`, g.languageRows.length);
    set(`${g.spec.displayName} — traffic invalid rows`, g.trafficInvalid.length);
    set(`${g.spec.displayName} — warnings`, g.warnings.length === 0 ? "(none)" : g.warnings.join("; "));
    set(`${g.spec.displayName} — errors`, g.errors.length === 0 ? "(none)" : g.errors.join("; "));
    r++;
  }
  ws.getColumn(1).width = 56;
  ws.getColumn(2).width = 90;
}

function writePullLog(wb: Workbook, perGame: PerGame[], wishlistCachePath: string, pullTimestamp: string): void {
  const ws = wb.addWorksheet("Pull Log");
  ws.getRow(1).values = ["Timestamp", "Game", "Source", "Event", "Detail"];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    ws.addRow([pullTimestamp, g.spec.displayName, "Wishlist", "CACHE_REUSED", `From ${wishlistCachePath} | status=${g.wishlistStatus} | adds=${valOrNa(g.wishlistTotals.adds)} del=${valOrNa(g.wishlistTotals.deletes)} net=${valOrNa(g.wishlistTotals.net)}`]);
    for (const d of g.wishlistDaily) {
      ws.addRow([pullTimestamp, g.spec.displayName, "Wishlist", d.status, `${d.dateIso} HTTP=${d.httpStatus ?? NA} | adds=${valOrNa(d.adds)} del=${valOrNa(d.deletes)} pur=${valOrNa(d.purchases)} gifts=${valOrNa(d.gifts)} net=${valOrNa(d.net)}`]);
    }
    if (g.trafficStatus === "TRAFFIC_CSV_MISSING") {
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "MISSING_CSV", `Expected ${g.spec.trafficFileName} in ${TRAFFIC_INPUT_DIR}`]);
    } else if (g.trafficStatus === "PARSE_FAILED") {
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "PARSE_FAILED", g.errors.filter((e) => e.startsWith("Traffic") || e.includes("AppID")).join("; ") || "Parse failed"]);
    } else if (g.trafficTotals) {
      const t = g.trafficTotals;
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "READ_CSV", `Read ${g.trafficRows.length + g.trafficInvalid.length + 1} lines (1 header + ${g.trafficRows.length} data + ${g.trafficInvalid.length} invalid)`]);
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "AGGREGATE", `pubI=${t.publicImpressions} pubV=${t.publicVisits} ownI=${t.ownerImpressions} ownV=${t.ownerVisits} botI=${t.botImpressions} botV=${t.botVisits}`]);
      for (const inv of g.trafficInvalid) ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "INVALID_ROW", `Line ${inv.lineNumber}: ${inv.reason}`]);
    }
    for (const w of g.warnings) ws.addRow([pullTimestamp, g.spec.displayName, "Combined", "WARN", w]);
    for (const e of g.errors) ws.addRow([pullTimestamp, g.spec.displayName, "Combined", "ERROR", e]);
  }
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 100;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[combined] window: ${REQUESTED_WINDOW.startIso} → ${REQUESTED_WINDOW.endIso}`);
  console.log(`[combined] traffic input: ${TRAFFIC_INPUT_DIR}`);

  // 1. Wishlist cache reuse — required (per spec, M6 must NOT re-pull or
  //    modify the wishlist orchestrator).
  const cacheHit = findWishlistCache(REQUESTED_WINDOW);
  if (!cacheHit) {
    console.error(`[combined] FATAL: no wishlist cache covering ${REQUESTED_WINDOW.startIso} → ${REQUESTED_WINDOW.endIso} for all 5 games.`);
    console.error(`[combined] Run 'pnpm --filter @workspace/scripts run tracker:current-pull:wishlist:all-games' first to produce one.`);
    process.exit(1);
  }
  console.log(`[combined] wishlist cache REUSED: ${cacheHit.path}`);
  const cacheById = new Map(cacheHit.cache.games.map((g) => [g.id, g] as const));

  // 2. Per-game records.
  const perGame: PerGame[] = GAME_SPECS.map((spec) => processGame(spec, cacheById.get(spec.cacheId)));

  // 3. Final status: PASSED iff every game has both wishlist (REAL_DATA or
  //    TRUE_ZERO_FROM_STEAM) AND traffic REAL_DATA.
  const allOk = perGame.every(
    (g) =>
      (g.wishlistStatus === "REAL_DATA" || g.wishlistStatus === "TRUE_ZERO_FROM_STEAM") &&
      g.trafficStatus === "REAL_DATA",
  );
  const finalStatus: "PASSED" | "FAILED" = allOk ? "PASSED" : "FAILED";
  const pullTimestamp = new Date().toISOString();

  // 4. Build workbook in EXACT spec order.
  const wb = new ExcelJS.Workbook();
  wb.creator = "tracker-current-pull-combined";
  wb.created = new Date();
  writeExecutiveSummary(wb, perGame, REQUESTED_WINDOW, finalStatus, pullTimestamp);
  writeGameComparison(wb, perGame);
  for (const g of perGame) writeGameSheet(wb, g, REQUESTED_WINDOW);
  writeRawWishlistApi(wb, perGame);
  writeRawTraffic(wb, perGame);
  writeValidation(wb, perGame, REQUESTED_WINDOW, cacheHit.path, finalStatus, pullTimestamp);
  writePullLog(wb, perGame, cacheHit.path, pullTimestamp);

  // Open on Executive Summary.
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 12000, height: 24000, firstSheet: 0, visibility: "visible" }];

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, ".local", "tracker-runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `Steamworks_Current_Pull_Combined_AllGames_${today}.xlsx`);
  await wb.xlsx.writeFile(outPath);

  // 5. Self-check: scan all cells for forbidden tokens.
  const verify = new ExcelJS.Workbook();
  await verify.xlsx.readFile(outPath);
  const sheetNames = verify.worksheets.map((s) => s.name);
  let bad = { objObj: 0, undef: 0, nullStr: 0, valueErr: 0, naErr: 0 };
  for (const ws of verify.worksheets) {
    ws.eachRow((row) => row.eachCell((cell) => {
      const v = cell.value;
      const s = typeof v === "string" ? v : (v == null ? "" : String(v));
      if (s === "[object Object]") bad.objObj++;
      if (s === "undefined") bad.undef++;
      if (s === "null") bad.nullStr++;
      if (s === "#VALUE!" || s === "#VALUE") bad.valueErr++;
      if (s === "#N/A") bad.naErr++;
    }));
  }

  // ---- Console report (16-item checklist) ----
  console.log(`\n=== TRACKER CURRENT-PULL COMBINED REPORT ===`);
  console.log(`1.  Output workbook:                    ${outPath}`);
  console.log(`2.  Wishlist source:                    REUSED CACHE (${cacheHit.path})`);
  console.log(`3.  Traffic CSVs from .local/input/traffic: YES`);
  console.log(`4.  Date range:                         ${REQUESTED_WINDOW.startIso} → ${REQUESTED_WINDOW.endIso}`);
  console.log(`5.  Wishlist totals per game (adds / del / net):`);
  for (const g of perGame) {
    console.log(`     - ${g.spec.displayName.padEnd(28)} ${valOrNa(g.wishlistTotals.adds)} / ${valOrNa(g.wishlistTotals.deletes)} / ${valOrNa(g.wishlistTotals.net)}   [${g.wishlistStatus}]`);
  }
  console.log(`6.  Traffic totals per game (pubImp / pubVisits):`);
  for (const g of perGame) {
    const t = g.trafficTotals;
    console.log(`     - ${g.spec.displayName.padEnd(28)} ${t ? t.publicImpressions : NA} / ${t ? t.publicVisits : NA}   [${g.trafficStatus}]`);
  }
  console.log(`7.  Visit-to-impression ratio per game:`);
  for (const g of perGame) {
    const t = g.trafficTotals;
    console.log(`     - ${g.spec.displayName.padEnd(28)} ${t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA}`);
  }
  console.log(`8.  Warnings:`);
  const allWarn = perGame.flatMap((g) => g.warnings.map((w) => `[${g.spec.displayName}] ${w}`));
  if (allWarn.length === 0) console.log(`     (none)`);
  for (const w of allWarn) console.log(`     - ${w}`);
  console.log(`9.  Raw_Wishlist_API populated:         ${verify.getWorksheet("Raw_Wishlist_API")!.rowCount > 1 ? `YES (${verify.getWorksheet("Raw_Wishlist_API")!.rowCount - 1} rows)` : "NO"}`);
  console.log(`10. Raw_Traffic populated:              ${verify.getWorksheet("Raw_Traffic")!.rowCount > 1 ? `YES (${verify.getWorksheet("Raw_Traffic")!.rowCount - 1} rows)` : "NO"}`);
  const gameSheetSummary = perGame.map((g) => `${g.spec.displayName}=${verify.getWorksheet(g.spec.displayName)?.rowCount ?? 0}`).join(", ");
  console.log(`11. All five game sheets populated:     ${gameSheetSummary}`);
  console.log(`12. Validation final status:            ${finalStatus}`);
  const expectedOrder = [
    "Executive Summary", "Game Comparison",
    "Colossus - Eternal Blight", "Fleetbreakers", "Taival", "Noor", "Petunia's Purgatory",
    "Raw_Wishlist_API", "Raw_Traffic", "Validation", "Pull Log",
  ];
  const orderOk = sheetNames.length === expectedOrder.length && sheetNames.every((n, i) => n === expectedOrder[i]);
  console.log(`13. Sheet order matches spec:           ${orderOk ? "YES" : "NO — got " + sheetNames.join(" | ")}`);
  console.log(`14. Zero #VALUE / #N/A cells:           ${bad.valueErr === 0 && bad.naErr === 0 ? "YES" : `NO (#VALUE=${bad.valueErr}, #N/A=${bad.naErr})`}`);
  console.log(`15. Zero [object Object] cells:         ${bad.objObj === 0 ? "YES" : `NO (${bad.objObj})`}    (undefined=${bad.undef}, null=${bad.nullStr})`);
  console.log(`16. Workbook contains only current pulled data, no Dashboard/KPI/tracker history: YES (built from scratch — no template loaded)`);
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus !== "PASSED" || !orderOk || bad.objObj > 0 || bad.valueErr > 0 || bad.naErr > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[combined] FATAL:", err);
  process.exit(1);
});
