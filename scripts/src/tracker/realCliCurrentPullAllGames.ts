// Milestone 4B — Pull Data Alone export mode.
//
// Builds a CLEAN STANDALONE workbook that contains ONLY the data pulled in
// the current run for the latest completed 7-day Steam wishlist window.
// No tracker template, no historical rows, no manual values, no placeholder
// zeros, no formulas (values are written directly so the file is readable
// without recalculation).
//
// Reuse rule: if a recent M4 run wrote `wishlist-pull-cache.json` covering
// the same date window in `.local/tracker-runs/*`, reuse it. Otherwise
// re-pull through the Steam Partner Financial API.
//
// Usage:
//   pnpm --filter @workspace/scripts run tracker:current-pull:wishlist:all-games
//
// Optional:
//   -- --range custom:<startISO>:<endISO>   (default: latest completed 7-day window)
//   -- --no-cache                           (force re-pull)

import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import { GAMES, APP_IDS, type GameMap, type GameId } from "./map.js";
import {
  fetchWishlistRange,
  latestCompletedSevenDayWindow,
  type WishlistDayResult,
  type WishlistPullSummary,
  type WishlistDayStatus,
} from "../realPull/steamWishlist.js";

interface Args {
  range: string | undefined;
  noCache: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { range: undefined, noCache: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--range") out.range = argv[++i];
    else if (a === "--no-cache") out.noCache = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return out;
}

function printHelp(): void {
  console.log(`Tracker Current-Pull Wishlist (Milestone 4B — Pull Data Alone)

Options:
  --range custom:<startISO>:<endISO>   override date window (default latest completed 7-day)
  --no-cache                           force re-pull (ignore any wishlist-pull-cache.json)
  --help                               this help

Output: .local/tracker-runs/<timestamp>/Steamworks_Current_Pull_Wishlist_AllGames_<YYYY-MM-DD>.xlsx`);
}

function resolveWindow(arg: string | undefined): { startIso: string; endIso: string; label: string } {
  if (!arg) {
    const w = latestCompletedSevenDayWindow();
    return { ...w, label: `latest-completed-7-day (${w.startIso} → ${w.endIso})` };
  }
  if (arg.startsWith("custom:")) {
    const parts = arg.split(":");
    if (parts.length !== 3) throw new Error(`Bad --range. Expected custom:<startISO>:<endISO>`);
    const [, startIso, endIso] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      throw new Error(`Bad ISO dates in --range`);
    }
    if (startIso > endIso) throw new Error(`--range start (${startIso}) is after end (${endIso})`);
    return { startIso, endIso, label: `custom (${startIso} → ${endIso})` };
  }
  throw new Error(`Unknown --range: "${arg}".`);
}

interface CachedGame {
  id: GameId;
  canonicalName: string;
  wlSheet: string;
  appid: string;
  overallStatus: WishlistDayStatus;
  summary: WishlistPullSummary;
}
interface CacheFile {
  version: number;
  writtenAt: string;
  range: { startIso: string; endIso: string };
  games: CachedGame[];
}

const CANONICAL_GAMES: Array<{ id: GameId; map: GameMap }> = [
  { id: "colossus", map: GAMES.colossus },
  { id: "fleet", map: GAMES.fleet },
  { id: "taival", map: GAMES.taival },
  { id: "noor", map: { id: "noor", canonicalName: "Noor", wlGameLabel: "Noor", wlSheet: "Noor", kpiQuarterRows: GAMES.colossus.kpiQuarterRows, consolidatedRows: GAMES.colossus.consolidatedRows } },
  { id: "petunia", map: GAMES.petunia },
];

/** Per-spec sheet names for the standalone workbook (no spaces, no "_WL" suffix). */
const STANDALONE_SHEET_NAMES: Record<GameId, string> = {
  colossus: "Colossus - Eternal Blight",
  fleet: "Fleetbreakers",
  taival: "Taival",
  noor: "Noor",
  petunia: "Petunia's Purgatory",
};

function findReusableCache(rootDir: string, window: { startIso: string; endIso: string }): { path: string; cache: CacheFile } | null {
  const runsDir = path.join(rootDir, ".local", "tracker-runs");
  if (!fs.existsSync(runsDir)) return null;
  const dirs = fs.readdirSync(runsDir).sort().reverse();
  const requiredIds = new Set<GameId>(["colossus", "fleet", "taival", "noor", "petunia"]);
  for (const d of dirs) {
    const cachePath = path.join(runsDir, d, "wishlist-pull-cache.json");
    if (!fs.existsSync(cachePath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as CacheFile;
      if (raw.range.startIso !== window.startIso || raw.range.endIso !== window.endIso) continue;
      const haveIds = new Set(raw.games.map((g) => g.id));
      let ok = true;
      for (const id of requiredIds) if (!haveIds.has(id)) { ok = false; break; }
      if (ok) return { path: cachePath, cache: raw };
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

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function netOf(adds: number | null, deletes: number | null, purchases: number | null, gifts: number | null): number | null {
  if (adds === null || deletes === null || purchases === null || gifts === null) return null;
  return adds - deletes - purchases - gifts;
}

function extractCountryRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.countrySummaryPresent) continue;
    const cs = deepFind(d.parsed, "country_summary");
    if (!cs || typeof cs !== "object") continue;
    const entries = Array.isArray(cs) ? cs : Object.entries(cs).map(([code, val]) => ({ country_code: code, ...((val ?? {}) as object) }));
    for (const e of entries) {
      const obj = e as Record<string, unknown>;
      const code = String(obj.country_code ?? obj.code ?? obj.country ?? "");
      const name = String(obj.country_name ?? obj.name ?? "");
      const adds = num(obj.wishlist_adds ?? obj.adds);
      const deletes = num(obj.wishlist_deletes ?? obj.deletes);
      const purchases = num(obj.wishlist_purchases ?? obj.purchases);
      const gifts = num(obj.wishlist_gifts ?? obj.gifts);
      rows.push({ dateIso: d.dateIso, key: code, label: name, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

function extractLanguageRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.languageSummaryPresent) continue;
    const ls = deepFind(d.parsed, "language_summary");
    if (!ls || typeof ls !== "object") continue;
    const entries = Array.isArray(ls) ? ls : Object.entries(ls).map(([k, v]) => ({ language: k, ...((v ?? {}) as object) }));
    for (const e of entries) {
      const obj = e as Record<string, unknown>;
      const lang = String(obj.language ?? obj.lang ?? obj.code ?? "");
      const adds = num(obj.wishlist_adds ?? obj.adds);
      const deletes = num(obj.wishlist_deletes ?? obj.deletes);
      const purchases = num(obj.wishlist_purchases ?? obj.purchases);
      const gifts = num(obj.wishlist_gifts ?? obj.gifts);
      rows.push({ dateIso: d.dateIso, key: lang, label: lang, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

interface PerGame {
  map: GameMap;
  appid: string;
  summary: WishlistPullSummary;
  totals: { adds: number; deletes: number; purchases: number; gifts: number; net: number };
  overallStatus: WishlistDayStatus;
  countryRows: DerivedBreakdownRow[];
  languageRows: DerivedBreakdownRow[];
  errors: string[];
  warnings: string[];
}

function aggregate(s: WishlistPullSummary): PerGame["totals"] {
  let adds = 0, deletes = 0, purchases = 0, gifts = 0;
  for (const d of s.daily) {
    if (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM") {
      adds += d.adds ?? 0;
      deletes += d.deletes ?? 0;
      purchases += d.purchases ?? 0;
      gifts += d.gifts ?? 0;
    }
  }
  return { adds, deletes, purchases, gifts, net: adds - deletes - purchases - gifts };
}

function deriveOverallStatus(s: WishlistPullSummary): WishlistDayStatus {
  if (s.daily.length === 0) return "EMPTY_RESPONSE";
  if (s.daily.some((d) => d.status === "REAL_DATA")) return "REAL_DATA";
  if (s.daily.every((d) => d.status === "TRUE_ZERO_FROM_STEAM")) return "TRUE_ZERO_FROM_STEAM";
  const firstFail = s.daily.find((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
  return firstFail?.status ?? "API_ERROR";
}

function topByVolume(rows: DerivedBreakdownRow[], metricLabel: "net" | "adds"): string {
  if (rows.length === 0) return "n/a";
  // Aggregate adds + net per key. Steam often returns only adds at the
  // country/language level (no deletes/purchases/gifts), so net is null →
  // ranking-by-adds is the meaningful fallback.
  const totals = new Map<string, { label: string; adds: number; netSum: number; netHasValue: boolean }>();
  for (const r of rows) {
    const cur = totals.get(r.key) ?? { label: r.label || r.key, adds: 0, netSum: 0, netHasValue: false };
    cur.adds += r.adds ?? 0;
    if (r.net !== null) { cur.netSum += r.net; cur.netHasValue = true; }
    totals.set(r.key, cur);
  }
  // Prefer net if any row had a real net; otherwise rank by adds.
  const anyNet = Array.from(totals.values()).some((v) => v.netHasValue);
  let best: { label: string; metric: number; metricName: string } | null = null;
  for (const v of totals.values()) {
    const metric = anyNet ? v.netSum : v.adds;
    if (!best || metric > best.metric) best = { label: v.label, metric, metricName: anyNet ? "net" : "adds" };
  }
  return best ? `${best.label} (${best.metricName}=${best.metric})` : "n/a";
}

async function pullFresh(window: { startIso: string; endIso: string }, apiKey: string | undefined): Promise<CachedGame[]> {
  const out: CachedGame[] = [];
  for (const { id, map } of CANONICAL_GAMES) {
    const appid = APP_IDS[id];
    console.log(`[current-pull] === ${map.canonicalName} (appid ${appid}) ===`);
    const summary = await fetchWishlistRange({
      appid, startIso: window.startIso, endIso: window.endIso, apiKey,
      onProgress: (d, i, t) => {
        const detail = d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM" ? `adds=${d.adds} del=${d.deletes}` : d.message;
        console.log(`  [${i + 1}/${t}] ${d.dateIso} — ${d.status} ${detail}`);
      },
    });
    out.push({ id, canonicalName: map.canonicalName, wlSheet: map.wlSheet, appid, overallStatus: deriveOverallStatus(summary), summary });
  }
  return out;
}

function setCellNumberFormat(cell: ExcelJS.Cell, fmt: string): void { cell.numFmt = fmt; }

function writeSummarySheet(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string }): void {
  const ws = wb.addWorksheet("Summary");
  ws.getRow(1).values = [
    "Game", "AppID", "Date range",
    "Wishlist adds", "Wishlist deletes", "Wishlist purchases", "Wishlist gifts", "Net wishlist change",
    "Top country", "Top language", "Status", "Errors", "Warnings",
  ];
  ws.getRow(1).font = { bold: true };
  for (let i = 0; i < perGame.length; i++) {
    const g = perGame[i];
    const r = ws.getRow(i + 2);
    r.values = [
      g.map.canonicalName, g.appid, `${window.startIso} → ${window.endIso}`,
      g.totals.adds, g.totals.deletes, g.totals.purchases, g.totals.gifts, g.totals.net,
      topByVolume(g.countryRows, "net"), topByVolume(g.languageRows, "net"),
      g.overallStatus,
      g.errors.length === 0 ? "" : g.errors.join("; "),
      g.warnings.length === 0 ? "" : g.warnings.join("; "),
    ];
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 26;
  for (let c = 4; c <= 8; c++) ws.getColumn(c).width = 18;
  ws.getColumn(9).width = 24;
  ws.getColumn(10).width = 24;
  ws.getColumn(11).width = 22;
  ws.getColumn(12).width = 60;
  ws.getColumn(13).width = 60;
}

function writeValidationSheet(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string; label: string }, source: "cache-reuse" | "fresh-pull", keyPresent: boolean): "PASSED" | "FAILED" {
  const ws = wb.addWorksheet("Validation");
  ws.getRow(1).values = ["Field", "Value"];
  ws.getRow(1).font = { bold: true };

  const totalsAttempted = perGame.reduce((s, g) => s + g.summary.attempted, 0);
  const totalsSucceeded = perGame.reduce((s, g) => s + g.summary.succeeded, 0);
  const totalsFailed = perGame.reduce((s, g) => s + g.summary.failed, 0);
  const realDataGames = perGame.filter((g) => g.overallStatus === "REAL_DATA").map((g) => g.map.canonicalName);
  const trueZeroGames = perGame.filter((g) => g.overallStatus === "TRUE_ZERO_FROM_STEAM").map((g) => g.map.canonicalName);
  const failedGames = perGame.filter((g) => g.overallStatus !== "REAL_DATA" && g.overallStatus !== "TRUE_ZERO_FROM_STEAM").map((g) => `${g.map.canonicalName} [${g.overallStatus}]`);

  // PASSED iff every game returned at least some real or true-zero days. A
  // game with partial daily failures (like Fleetbreakers) still counts as
  // succeeded overall.
  const allOk = perGame.every((g) => g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM");
  const finalStatus: "PASSED" | "FAILED" = allOk ? "PASSED" : "FAILED";

  const rows: Array<[string, string | number]> = [
    ["Export mode", "Pull Data Alone"],
    ["Pull timestamp", new Date().toISOString()],
    ["Data source", source === "cache-reuse" ? "Reused cache from prior M4 run (no Steam call)" : "Fresh pull from Steam Partner Financial API"],
    ["STEAM_FINANCIAL_KEY present", keyPresent ? "YES" : "NO"],
    ["Selected games", perGame.map((g) => g.map.canonicalName).join(", ")],
    ["Selected date range", window.label],
    ["Range start", window.startIso],
    ["Range end", window.endIso],
    ["API calls attempted (total)", totalsAttempted],
    ["API calls successful (total)", totalsSucceeded],
    ["API calls failed (total)", totalsFailed],
    ["Games with real data", realDataGames.length === 0 ? "(none)" : realDataGames.join(", ")],
    ["Games with true-zero values", trueZeroGames.length === 0 ? "(none)" : trueZeroGames.join(", ")],
    ["Games with failed pulls", failedGames.length === 0 ? "(none)" : failedGames.join(", ")],
    ["Final status", finalStatus],
  ];
  for (let i = 0; i < rows.length; i++) ws.getRow(i + 2).values = rows[i];
  ws.getRow(rows.length + 1).font = { bold: true };
  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 80;
  return finalStatus;
}

function writePullLogSheet(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Pull Log");
  ws.getRow(1).values = ["Timestamp", "Game", "AppID", "Date", "HTTP", "Status", "Adds", "Deletes", "Purchases", "Gifts", "Net", "Source", "Message"];
  ws.getRow(1).font = { bold: true };
  const stamp = new Date().toISOString();
  for (const g of perGame) {
    for (const d of g.summary.daily) {
      const r = ws.getRow(ws.rowCount + 1);
      r.values = [
        stamp, g.map.canonicalName, g.appid, d.dateIso, d.httpStatus ?? "", d.status,
        d.adds ?? "", d.deletes ?? "", d.purchases ?? "", d.gifts ?? "", d.net ?? "",
        "Steam Partner Financial API", d.message,
      ];
    }
  }
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 8;
  ws.getColumn(6).width = 22;
  for (let c = 7; c <= 11; c++) ws.getColumn(c).width = 10;
  ws.getColumn(12).width = 30;
  ws.getColumn(13).width = 60;
}

function writeRawWishlistApiSheet(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Raw_Wishlist_API");
  ws.getRow(1).values = [
    "Date", "Game", "AppID", "Adds", "Deletes", "Purchases And Activations", "Gifts",
    "Windows Adds", "Mac Adds", "Linux Adds", "Net Wishlist",
    "Country Summary Present", "Language Summary Present", "Source", "Status", "Message",
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    for (const d of g.summary.daily) {
      const r = ws.getRow(ws.rowCount + 1);
      r.values = [
        d.dateIso, g.map.canonicalName, g.appid,
        d.adds ?? "n/a", d.deletes ?? "n/a", d.purchases ?? "n/a", d.gifts ?? "n/a",
        d.addsWindows ?? "n/a", d.addsMac ?? "n/a", d.addsLinux ?? "n/a", d.net ?? "n/a",
        d.countrySummaryPresent ? "YES" : "NO", d.languageSummaryPresent ? "YES" : "NO",
        "Steam Partner Financial API", d.status, d.message,
      ];
    }
  }
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 10;
  for (let c = 4; c <= 11; c++) ws.getColumn(c).width = 12;
  ws.getColumn(12).width = 22;
  ws.getColumn(13).width = 22;
  ws.getColumn(14).width = 30;
  ws.getColumn(15).width = 22;
  ws.getColumn(16).width = 60;
}

function writeRawTrafficSheet(wb: Workbook): void {
  const ws = wb.addWorksheet("Raw_Traffic");
  ws.getRow(1).values = ["Field", "Value"];
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).values = ["Traffic Data", "NOT PULLED"];
  ws.getRow(3).values = ["Reason", "Traffic/impressions/visits are not part of Milestone 4B."];
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 80;
}

function writeGameSheet(wb: Workbook, g: PerGame, sheetName: string, window: { startIso: string; endIso: string }, pullTimestamp: string): void {
  const ws = wb.addWorksheet(sheetName);
  let r = 1;

  // Section A — Overview
  ws.getCell(`A${r}`).value = "SECTION A — OVERVIEW";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const overview: Array<[string, string | number]> = [
    ["Game", g.map.canonicalName],
    ["AppID", g.appid],
    ["Date range", `${window.startIso} → ${window.endIso}`],
    ["Pull timestamp", pullTimestamp],
    ["Wishlist adds (total)", g.totals.adds],
    ["Wishlist deletes (total)", g.totals.deletes],
    ["Wishlist purchases (total)", g.totals.purchases],
    ["Wishlist gifts (total)", g.totals.gifts],
    ["Net wishlist change (total)", g.totals.net],
    ["Status", g.overallStatus],
    ["Errors", g.errors.length === 0 ? "(none)" : g.errors.join("; ")],
    ["Warnings", g.warnings.length === 0 ? "(none)" : g.warnings.join("; ")],
  ];
  for (const [k, v] of overview) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  // Section B — Daily wishlist data
  ws.getCell(`A${r}`).value = "SECTION B — DAILY WISHLIST DATA";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const dailyHeaders = ["Date", "Adds", "Deletes", "Purchases And Activations", "Gifts", "Windows Adds", "Mac Adds", "Linux Adds", "Net Wishlist", "Source", "Status", "Message"];
  for (let i = 0; i < dailyHeaders.length; i++) {
    const cell = ws.getCell(r, i + 1);
    cell.value = dailyHeaders[i];
    cell.font = { bold: true };
  }
  r++;
  for (const d of g.summary.daily) {
    const succeeded = d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM";
    ws.getCell(r, 1).value = d.dateIso;
    ws.getCell(r, 2).value = succeeded ? (d.adds ?? "n/a") : "n/a";
    ws.getCell(r, 3).value = succeeded ? (d.deletes ?? "n/a") : "n/a";
    ws.getCell(r, 4).value = succeeded ? (d.purchases ?? "n/a") : "n/a";
    ws.getCell(r, 5).value = succeeded ? (d.gifts ?? "n/a") : "n/a";
    ws.getCell(r, 6).value = succeeded ? (d.addsWindows ?? "n/a") : "n/a";
    ws.getCell(r, 7).value = succeeded ? (d.addsMac ?? "n/a") : "n/a";
    ws.getCell(r, 8).value = succeeded ? (d.addsLinux ?? "n/a") : "n/a";
    ws.getCell(r, 9).value = succeeded ? (d.net ?? "n/a") : "n/a";
    ws.getCell(r, 10).value = "Steam Partner Financial API";
    ws.getCell(r, 11).value = d.status;
    ws.getCell(r, 12).value = d.message;
    r++;
  }
  r++;

  // Section C — Country breakdown
  ws.getCell(`A${r}`).value = "SECTION C — COUNTRY BREAKDOWN (if available)";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  if (g.countryRows.length === 0) {
    ws.getCell(`A${r}`).value = "(no country breakdown returned by Steam for this window)";
    r++;
  } else {
    const ch = ["Date", "Country Code", "Country Name", "Adds", "Deletes", "Purchases", "Gifts", "Net Wishlist"];
    for (let i = 0; i < ch.length; i++) {
      const cell = ws.getCell(r, i + 1);
      cell.value = ch[i];
      cell.font = { bold: true };
    }
    r++;
    for (const cr of g.countryRows) {
      ws.getCell(r, 1).value = cr.dateIso;
      ws.getCell(r, 2).value = cr.key;
      ws.getCell(r, 3).value = cr.label;
      ws.getCell(r, 4).value = cr.adds ?? "n/a";
      ws.getCell(r, 5).value = cr.deletes ?? "n/a";
      ws.getCell(r, 6).value = cr.purchases ?? "n/a";
      ws.getCell(r, 7).value = cr.gifts ?? "n/a";
      ws.getCell(r, 8).value = cr.net ?? "n/a";
      r++;
    }
  }
  r++;

  // Section D — Language breakdown
  ws.getCell(`A${r}`).value = "SECTION D — LANGUAGE BREAKDOWN (if available)";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  if (g.languageRows.length === 0) {
    ws.getCell(`A${r}`).value = "(no language breakdown returned by Steam for this window)";
    r++;
  } else {
    const lh = ["Date", "Language", "Adds", "Deletes", "Purchases", "Gifts", "Net Wishlist"];
    for (let i = 0; i < lh.length; i++) {
      const cell = ws.getCell(r, i + 1);
      cell.value = lh[i];
      cell.font = { bold: true };
    }
    r++;
    for (const lr of g.languageRows) {
      ws.getCell(r, 1).value = lr.dateIso;
      ws.getCell(r, 2).value = lr.label;
      ws.getCell(r, 3).value = lr.adds ?? "n/a";
      ws.getCell(r, 4).value = lr.deletes ?? "n/a";
      ws.getCell(r, 5).value = lr.purchases ?? "n/a";
      ws.getCell(r, 6).value = lr.gifts ?? "n/a";
      ws.getCell(r, 7).value = lr.net ?? "n/a";
      r++;
    }
  }
  r++;

  // Section E — Traffic
  ws.getCell(`A${r}`).value = "SECTION E — TRAFFIC";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  ws.getCell(`A${r}`).value = "Traffic Data";
  ws.getCell(`B${r}`).value = "NOT PULLED";
  r++;
  ws.getCell(`A${r}`).value = "Reason";
  ws.getCell(`B${r}`).value = "Traffic/impressions/visits are not part of Milestone 4B.";

  // Column widths.
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 22;
  for (let c = 4; c <= 12; c++) ws.getColumn(c).width = 14;
  ws.getColumn(12).width = 60;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd().endsWith("/scripts") ? path.join(process.cwd(), "..") : process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const window = resolveWindow(args.range);
  const apiKey = process.env.STEAM_FINANCIAL_KEY;
  const keyPresent = typeof apiKey === "string" && apiKey.trim() !== "";

  console.log(`[current-pull] window:       ${window.label}`);
  console.log(`[current-pull] key present:  ${keyPresent ? "YES" : "NO"}`);

  // Try cache reuse first.
  let cachedGames: CachedGame[] | null = null;
  let source: "cache-reuse" | "fresh-pull";
  let cacheUsedPath: string | null = null;
  if (!args.noCache) {
    const found = findReusableCache(repoRoot, window);
    if (found) {
      cachedGames = found.cache.games;
      cacheUsedPath = found.path;
      source = "cache-reuse";
      console.log(`[current-pull] REUSING cache: ${found.path}`);
    } else {
      console.log(`[current-pull] no reusable cache for window ${window.startIso}→${window.endIso}; will re-pull`);
      source = "fresh-pull";
    }
  } else {
    console.log(`[current-pull] --no-cache: forcing re-pull`);
    source = "fresh-pull";
  }
  if (!cachedGames) {
    cachedGames = await pullFresh(window, apiKey);
  }

  // Build per-game records.
  const perGame: PerGame[] = CANONICAL_GAMES.map(({ id, map }) => {
    const c = cachedGames!.find((cg) => cg.id === id);
    if (!c) {
      const empty: WishlistPullSummary = { appid: APP_IDS[id], startIso: window.startIso, endIso: window.endIso, daily: [], attempted: 0, succeeded: 0, failed: 0 };
      return { map, appid: APP_IDS[id], summary: empty, totals: { adds: 0, deletes: 0, purchases: 0, gifts: 0, net: 0 }, overallStatus: "API_ERROR" as WishlistDayStatus, countryRows: [], languageRows: [], errors: ["No data for this game in cache or pull"], warnings: [] };
    }
    const totals = aggregate(c.summary);
    const failedDays = c.summary.daily.filter((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const d of failedDays) (d.status === "EMPTY_RESPONSE" ? warnings : errors).push(`${d.dateIso} [${d.status}] ${d.message}`);
    return {
      map, appid: c.appid, summary: c.summary, totals, overallStatus: c.overallStatus,
      countryRows: extractCountryRows(c.summary.daily),
      languageRows: extractLanguageRows(c.summary.daily),
      errors, warnings,
    };
  });

  // Build the standalone workbook.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, ".local", "tracker-runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `Steamworks_Current_Pull_Wishlist_AllGames_${today}.xlsx`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "tracker-current-pull";
  wb.created = new Date();
  writeSummarySheet(wb, perGame, window);
  const finalStatus = writeValidationSheet(wb, perGame, window, source, keyPresent);
  writePullLogSheet(wb, perGame);
  writeRawWishlistApiSheet(wb, perGame);
  writeRawTrafficSheet(wb);
  const pullTimestamp = new Date().toISOString();
  for (const g of perGame) writeGameSheet(wb, g, STANDALONE_SHEET_NAMES[g.map.id], window, pullTimestamp);

  await wb.xlsx.writeFile(outPath);

  // Verification: scan every cell for any "[object Object]" string. There
  // shouldn't be any — but the spec demands an explicit check.
  const verifyWb = new ExcelJS.Workbook();
  await verifyWb.xlsx.readFile(outPath);
  const objectObjectCells: string[] = [];
  for (const ws of verifyWb.worksheets) {
    ws.eachRow((row, rIdx) => {
      row.eachCell((cell, cIdx) => {
        const v = cell.value;
        const s = typeof v === "string" ? v : (v && typeof v === "object" && !("formula" in v) && !(v instanceof Date)) ? String(v) : "";
        if (s === "[object Object]") objectObjectCells.push(`${ws.name}!R${rIdx}C${cIdx}`);
      });
    });
  }

  const totalsAttempted = perGame.reduce((s, g) => s + g.summary.attempted, 0);
  const totalsSucceeded = perGame.reduce((s, g) => s + g.summary.succeeded, 0);
  const totalsFailed = perGame.reduce((s, g) => s + g.summary.failed, 0);
  const fleetMap = perGame.find((g) => g.map.id === "fleet");
  const fleetEmptyDates = (fleetMap?.summary.daily ?? [])
    .filter((d) => d.status === "EMPTY_RESPONSE")
    .map((d) => d.dateIso);

  console.log(`\n=== TRACKER CURRENT-PULL (Pull Data Alone) REPORT ===`);
  console.log(`1. Output workbook:                 ${outPath}`);
  console.log(`2. Data source:                     ${source === "cache-reuse" ? `REUSED CACHE (${cacheUsedPath})` : "FRESH PULL from Steam Partner Financial API"}`);
  console.log(`3. Date range pulled:               ${window.startIso} → ${window.endIso} (7 days)`);
  console.log(`4. Daily values per game:`);
  for (const g of perGame) {
    console.log(`   --- ${g.map.canonicalName} (appid ${g.appid}) — ${g.overallStatus}`);
    for (const d of g.summary.daily) {
      if (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM") {
        console.log(`     ${d.dateIso}  adds=${d.adds}  del=${d.deletes}  pur=${d.purchases}  gifts=${d.gifts}  net=${d.net}`);
      } else {
        console.log(`     ${d.dateIso}  [${d.status}] ${d.message}`);
      }
    }
  }
  console.log(`5. Weekly totals per game:`);
  for (const g of perGame) {
    console.log(`   ${g.map.canonicalName.padEnd(28)} adds=${g.totals.adds} del=${g.totals.deletes} pur=${g.totals.purchases} gifts=${g.totals.gifts} NET=${g.totals.net}  [${g.overallStatus}]`);
  }
  console.log(`6. API calls attempted:             ${totalsAttempted}`);
  console.log(`7. API calls successful:            ${totalsSucceeded}`);
  console.log(`8. API calls failed:                ${totalsFailed}`);
  console.log(`9. Validation status:               ${finalStatus}`);
  console.log(`10. Pulled-data-only (no tracker):  YES — built from scratch with ExcelJS; no template was opened`);
  console.log(`11. Fleetbreakers EMPTY_RESPONSE dates: ${fleetEmptyDates.length === 0 ? "(none)" : fleetEmptyDates.join(", ")}  ${fleetEmptyDates.length > 0 ? "→ shown as EMPTY_RESPONSE in workbook (no fake 0)" : ""}`);
  console.log(`12. [object Object] cells:          ${objectObjectCells.length === 0 ? "0 (clean)" : `${objectObjectCells.length} found at: ${objectObjectCells.join(", ")}`}`);
  const allFails = perGame.flatMap((g) => g.errors.map((m) => `${g.map.canonicalName} ERR ${m}`).concat(g.warnings.map((m) => `${g.map.canonicalName} WARN ${m}`)));
  console.log(`13. Errors / warnings:              ${allFails.length === 0 ? "none" : `${allFails.length}:`}`);
  for (const f of allFails) console.log(`    ${f}`);
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus !== "PASSED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[current-pull] FATAL:", err);
  process.exit(1);
});
