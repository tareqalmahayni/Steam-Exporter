/**
 * Milestone 5B — Traffic CSV import for all five games.
 *
 * Reuses the proven M5 parser (scripts/src/traffic/trafficCsv.ts) and
 * builds one consolidated workbook with per-game sheets. If a CSV file
 * is missing for a game, that game is marked TRAFFIC_CSV_MISSING — never
 * faked with zeroes.
 *
 * CLI:
 *   pnpm --filter @workspace/scripts run tracker:current-pull:traffic-csv:all-games
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS, { type Workbook, type Worksheet } from "exceljs";

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
} from "./trafficCsv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const INPUT_DIR = path.join(repoRoot, ".local", "input", "traffic");

/** AppID → expected CSV filename (per spec). Matches TRAFFIC_APP_ALLOWLIST. */
const EXPECTED_FILES: Array<{ appid: string; gameName: string; fileName: string }> = [
  { appid: "1722800", gameName: "Colossus - Eternal Blight", fileName: "traffic_colossus_1722800_20260430_20260506.csv" },
  { appid: "2929040", gameName: "Fleetbreakers",             fileName: "traffic_fleetbreakers_2929040_20260430_20260506.csv" },
  { appid: "3152750", gameName: "Taival",                    fileName: "traffic_taival_3152750_20260430_20260506.csv" },
  { appid: "3728760", gameName: "Noor",                      fileName: "traffic_noor_3728760_20260430_20260506.csv" },
  { appid: "4009450", gameName: "Petunia's Purgatory",       fileName: "traffic_petunia_4009450_20260430_20260506.csv" },
];

interface GameResult {
  appid: string;
  gameName: string;
  fileName: string;
  csvPath: string;
  status: "REAL_DATA" | "TRAFFIC_CSV_MISSING" | "PARSE_FAILED";
  startIso: string | null;
  endIso: string | null;
  headers: string[];
  rows: NormalizedTrafficRow[];
  pageSource: NormalizedTrafficRow[];
  country: NormalizedTrafficRow[];
  invalidLines: Array<{ lineNumber: number; raw: string; reason: string }>;
  totals: WindowAggregate | null;
  byPageSource: PageSourceAggregate[];
  byCountry: CountryAggregate[];
  warnings: string[];
  errors: string[];
}

function fmtCtr(c: number | null): string {
  return c === null ? "NOT AVAILABLE" : `${(c * 100).toFixed(2)}%`;
}

function emptyTotals(): WindowAggregate {
  return {
    publicImpressions: 0, publicVisits: 0, publicCtr: null,
    ownerImpressions: 0, ownerVisits: 0,
    botImpressions: 0, botVisits: 0,
    realPageSourceRowCount: 0, countryRowCount: 0,
  };
}

function processOneGame(spec: { appid: string; gameName: string; fileName: string }): GameResult {
  const csvPath = path.join(INPUT_DIR, spec.fileName);
  const base: GameResult = {
    appid: spec.appid,
    gameName: spec.gameName,
    fileName: spec.fileName,
    csvPath,
    status: "REAL_DATA",
    startIso: null, endIso: null,
    headers: [], rows: [], pageSource: [], country: [], invalidLines: [],
    totals: null, byPageSource: [], byCountry: [],
    warnings: [], errors: [],
  };

  if (!fs.existsSync(csvPath)) {
    base.status = "TRAFFIC_CSV_MISSING";
    base.errors.push(`CSV file missing for ${spec.gameName} (${spec.fileName})`);
    return base;
  }

  const ident = validateTrafficFileIdentity(csvPath, { appAllowlist: TRAFFIC_APP_ALLOWLIST });
  base.warnings.push(...ident.warnings);
  base.errors.push(...ident.errors);
  if (!ident.ok || !ident.appid || !ident.startIso || !ident.endIso) {
    base.status = "PARSE_FAILED";
    return base;
  }
  if (ident.appid !== spec.appid) {
    base.errors.push(`Filename AppID ${ident.appid} does not match expected ${spec.appid} for ${spec.gameName}`);
    base.status = "PARSE_FAILED";
    return base;
  }
  base.startIso = ident.startIso;
  base.endIso = ident.endIso;

  const parsed = parseTrafficCsv(csvPath);
  base.headers = parsed.headers;
  base.invalidLines = parsed.invalidLines;
  for (const inv of parsed.invalidLines) base.warnings.push(`Line ${inv.lineNumber}: ${inv.reason}`);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    base.errors.push("CSV produced no rows");
    base.status = "PARSE_FAILED";
    return base;
  }

  const normalized = normalizeTrafficRows(parsed.rows);
  const split = splitTrafficRowsIntoPageSourceAndCountry(normalized);
  const validation = validateTrafficRows(normalized);
  base.warnings.push(...validation.warnings);
  base.rows = normalized;
  base.pageSource = split.pageSource;
  base.country = split.country;
  base.totals = aggregateTrafficByGameAndWindow(normalized);
  base.byPageSource = aggregateTrafficBySourcePage(normalized);
  base.byCountry = aggregateTrafficByCountry(normalized);
  return base;
}

function writeGameSheet(wb: Workbook, g: GameResult): void {
  const gs = wb.addWorksheet(g.gameName);
  let r = 1;
  gs.getCell(`A${r}`).value = "SECTION A — OVERVIEW";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;

  const t = g.totals ?? emptyTotals();
  const showVal = (n: number) => (g.status === "REAL_DATA" ? n : "NOT AVAILABLE");
  const overview: Array<[string, string | number]> = [
    ["Game", g.gameName],
    ["AppID", g.appid],
    ["Date range", g.startIso && g.endIso ? `${g.startIso} → ${g.endIso}` : "NOT AVAILABLE"],
    ["Granularity", "Window Aggregate (no per-day data in CSV)"],
    ["Total public impressions", showVal(t.publicImpressions)],
    ["Total public visits", showVal(t.publicVisits)],
    ["CTR", g.status === "REAL_DATA" ? fmtCtr(t.publicCtr) : "NOT AVAILABLE"],
    ["Total owner impressions", showVal(t.ownerImpressions)],
    ["Total owner visits", showVal(t.ownerVisits)],
    ["Bot impressions", showVal(t.botImpressions)],
    ["Bot visits", showVal(t.botVisits)],
    ["Status", g.status],
    ["Errors", g.errors.length === 0 ? "(none)" : g.errors.join("; ")],
    ["Warnings", g.warnings.length === 0 ? "(none)" : g.warnings.join("; ")],
  ];
  for (const [k, v] of overview) {
    gs.getCell(`A${r}`).value = k;
    gs.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  gs.getCell(`A${r}`).value = "SECTION B — PAGE/SOURCE BREAKDOWN";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;
  gs.getRow(r).values = [
    "Source Category", "Source/Page Feature", "Impressions", "Visits", "CTR",
    "Owner Impressions", "Owner Visits", "Is Bot", "Status", "Message",
  ];
  gs.getRow(r).font = { bold: true };
  r++;
  if (g.status !== "REAL_DATA") {
    gs.getRow(r).values = [
      "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE",
      "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", g.status,
      g.status === "TRAFFIC_CSV_MISSING" ? "Traffic CSV not found in input folder" : "CSV failed to parse",
    ];
    r++;
  } else {
    for (const a of g.byPageSource) {
      gs.getRow(r).values = [
        a.category, a.feature, a.impressions, a.visits, fmtCtr(a.ctr),
        a.ownerImpressions, a.ownerVisits,
        a.isBot ? "YES" : "NO", "REAL_DATA",
        a.isBot ? "Bot Traffic — excluded from public totals" : "OK",
      ];
      r++;
    }
  }
  r++;

  gs.getCell(`A${r}`).value = "SECTION C — COUNTRY BREAKDOWN";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;
  gs.getRow(r).values = [
    "Country Code", "Impressions", "Visits", "CTR",
    "Owner Impressions", "Owner Visits", "Status", "Message",
  ];
  gs.getRow(r).font = { bold: true };
  r++;
  if (g.status !== "REAL_DATA") {
    gs.getRow(r).values = [
      "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE",
      "NOT AVAILABLE", "NOT AVAILABLE", g.status,
      g.status === "TRAFFIC_CSV_MISSING" ? "Traffic CSV not found in input folder" : "CSV failed to parse",
    ];
    r++;
  } else {
    for (const a of g.byCountry) {
      gs.getRow(r).values = [
        a.countryCode, a.impressions, a.visits, fmtCtr(a.ctr),
        a.ownerImpressions, a.ownerVisits, "REAL_DATA", "OK",
      ];
      r++;
    }
  }

  gs.getColumn(1).width = 32;
  gs.getColumn(2).width = 36;
  for (let c = 3; c <= 10; c++) gs.getColumn(c).width = 16;
}

function buildWorkbook(results: GameResult[]): { wb: Workbook; finalStatus: "PASSED" | "FAILED"; missing: GameResult[]; parsed: GameResult[] } {
  const wb = new ExcelJS.Workbook();
  wb.creator = "tracker-current-pull-traffic-all-games";
  wb.created = new Date();

  const missing = results.filter((g) => g.status === "TRAFFIC_CSV_MISSING");
  const parseFailed = results.filter((g) => g.status === "PARSE_FAILED");
  const parsed = results.filter((g) => g.status === "REAL_DATA");
  // Per spec: missing files mark a game TRAFFIC_CSV_MISSING (not failure).
  // PASSED requires all available CSVs to parse without errors.
  const finalStatus: "PASSED" | "FAILED" = parseFailed.length === 0 ? "PASSED" : "FAILED";

  // 1. Summary — one row per game.
  const sum = wb.addWorksheet("Summary");
  sum.getRow(1).values = [
    "Game", "AppID", "Status", "Date range", "Granularity",
    "Public impressions", "Public visits", "CTR",
    "Owner impressions", "Owner visits",
    "Bot impressions", "Bot visits",
    "Page/source rows", "Country rows", "Invalid rows",
    "Errors", "Warnings",
  ];
  sum.getRow(1).font = { bold: true };
  let rr = 2;
  for (const g of results) {
    const t = g.totals ?? emptyTotals();
    sum.getRow(rr).values = [
      g.gameName, g.appid, g.status,
      g.startIso && g.endIso ? `${g.startIso} → ${g.endIso}` : "NOT AVAILABLE",
      "Window Aggregate",
      g.status === "REAL_DATA" ? t.publicImpressions : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.publicVisits : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? fmtCtr(t.publicCtr) : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.ownerImpressions : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.ownerVisits : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.botImpressions : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.botVisits : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.realPageSourceRowCount : "NOT AVAILABLE",
      g.status === "REAL_DATA" ? t.countryRowCount : "NOT AVAILABLE",
      g.invalidLines.length,
      g.errors.length === 0 ? "(none)" : g.errors.join("; "),
      g.warnings.length === 0 ? "(none)" : g.warnings.join("; "),
    ];
    rr++;
  }
  sum.getColumn(1).width = 28;
  sum.getColumn(2).width = 10;
  sum.getColumn(3).width = 22;
  sum.getColumn(4).width = 26;
  for (let c = 5; c <= 15; c++) sum.getColumn(c).width = 16;
  sum.getColumn(16).width = 60;
  sum.getColumn(17).width = 60;

  // 2. Validation
  const v = wb.addWorksheet("Validation");
  v.getRow(1).values = ["Field", "Value"];
  v.getRow(1).font = { bold: true };
  let vr = 2;
  const set = (k: string, val: string | number) => { v.getRow(vr).values = [k, val]; vr++; };
  set("Export mode", "Pull Data Alone — Traffic CSV (All Games)");
  set("Pull timestamp", new Date().toISOString());
  set("Input folder", INPUT_DIR);
  set("Files expected", EXPECTED_FILES.length);
  set("Files parsed (REAL_DATA)", parsed.length);
  set("Files missing (TRAFFIC_CSV_MISSING)", missing.length);
  set("Files failed to parse (PARSE_FAILED)", parseFailed.length);
  set("CTR calculation method", "Visits / Impressions, only if Impressions > 0; else NOT AVAILABLE");
  set("Country rows separated (not double-counted)", "YES — country rows excluded from page/source totals");
  set("Wishlist data included", "NO");
  set("Tracker history included", "NO");
  set("Dashboard / Consolidated KPI / KPI by Quarter included", "NO");
  set("Final status", finalStatus);
  vr++;
  v.getRow(vr).values = ["--- Per game ---", ""]; v.getRow(vr).font = { bold: true }; vr++;
  for (const g of results) {
    set(`${g.gameName} — file`, g.fileName);
    set(`${g.gameName} — status`, g.status);
    set(`${g.gameName} — headers`, g.headers.length > 0 ? g.headers.join(" | ") : "NOT AVAILABLE");
    set(`${g.gameName} — date range`, g.startIso && g.endIso ? `${g.startIso} → ${g.endIso}` : "NOT AVAILABLE");
    set(`${g.gameName} — rows parsed`, g.rows.length);
    set(`${g.gameName} — page/source rows`, g.pageSource.length);
    set(`${g.gameName} — country rows`, g.country.length);
    set(`${g.gameName} — invalid rows`, g.invalidLines.length);
    if (g.totals) {
      set(`${g.gameName} — public impressions`, g.totals.publicImpressions);
      set(`${g.gameName} — public visits`, g.totals.publicVisits);
      set(`${g.gameName} — public CTR`, fmtCtr(g.totals.publicCtr));
      set(`${g.gameName} — owner impressions`, g.totals.ownerImpressions);
      set(`${g.gameName} — owner visits`, g.totals.ownerVisits);
      set(`${g.gameName} — bot impressions`, g.totals.botImpressions);
      set(`${g.gameName} — bot visits`, g.totals.botVisits);
    }
    set(`${g.gameName} — warnings`, g.warnings.length === 0 ? "(none)" : g.warnings.join("; "));
    set(`${g.gameName} — errors`, g.errors.length === 0 ? "(none)" : g.errors.join("; "));
    vr++;
  }
  v.getColumn(1).width = 50;
  v.getColumn(2).width = 90;

  // 3. Pull Log
  const pl = wb.addWorksheet("Pull Log");
  pl.getRow(1).values = ["Timestamp", "Game", "Event", "Detail"];
  pl.getRow(1).font = { bold: true };
  const stamp = new Date().toISOString();
  for (const g of results) {
    if (g.status === "TRAFFIC_CSV_MISSING") {
      pl.addRow([stamp, g.gameName, "MISSING_CSV", `Expected ${g.fileName} in ${INPUT_DIR}`]);
      continue;
    }
    if (g.status === "PARSE_FAILED") {
      pl.addRow([stamp, g.gameName, "PARSE_FAILED", g.errors.join("; ")]);
      continue;
    }
    const t = g.totals!;
    pl.addRow([stamp, g.gameName, "READ_CSV", `Read ${g.rows.length + g.invalidLines.length + 1} lines (1 header + ${g.rows.length} data + ${g.invalidLines.length} invalid)`]);
    pl.addRow([stamp, g.gameName, "VALIDATE_FILENAME", `AppID=${g.appid}, range=${g.startIso} → ${g.endIso}`]);
    pl.addRow([stamp, g.gameName, "NORMALIZE", `${g.pageSource.length} page/source + ${g.country.length} country`]);
    pl.addRow([stamp, g.gameName, "AGGREGATE", `pubI=${t.publicImpressions} pubV=${t.publicVisits} ownI=${t.ownerImpressions} ownV=${t.ownerVisits} botI=${t.botImpressions} botV=${t.botVisits}`]);
    for (const inv of g.invalidLines) pl.addRow([stamp, g.gameName, "INVALID_ROW", `Line ${inv.lineNumber}: ${inv.reason}`]);
    for (const w of g.warnings) pl.addRow([stamp, g.gameName, "WARN", w]);
    for (const e of g.errors) pl.addRow([stamp, g.gameName, "ERROR", e]);
  }
  pl.getColumn(1).width = 24;
  pl.getColumn(2).width = 28;
  pl.getColumn(3).width = 18;
  pl.getColumn(4).width = 90;

  // 4. Raw_Traffic — every row across every game, tagged.
  const raw = wb.addWorksheet("Raw_Traffic");
  raw.getRow(1).values = [
    "Game", "AppID", "Source Line", "Bucket",
    "Page / Category", "Page / Feature (raw)", "Page / Feature (display)",
    "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits",
    "Is Bot", "Is Country",
  ];
  raw.getRow(1).font = { bold: true };
  for (const g of results) {
    if (g.status !== "REAL_DATA") {
      raw.addRow([g.gameName, g.appid, "NOT AVAILABLE", "NOT AVAILABLE",
        "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE",
        "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE", "NOT AVAILABLE",
        "NOT AVAILABLE", "NOT AVAILABLE"]);
      continue;
    }
    for (const r of g.rows) {
      raw.addRow([
        g.gameName, g.appid, r.lineNumber,
        r.isCountry ? "Country" : (r.isBot ? "Bot" : "Page/Source"),
        r.pageCategory, r.pageFeature, r.pageFeatureDisplay,
        r.impressions ?? "NOT AVAILABLE",
        r.visits ?? "NOT AVAILABLE",
        fmtCtr(calculateCtr(r.visits, r.impressions)),
        r.ownerImpressions ?? "NOT AVAILABLE",
        r.ownerVisits ?? "NOT AVAILABLE",
        r.isBot ? "YES" : "NO",
        r.isCountry ? "YES" : "NO",
      ]);
    }
  }
  raw.getColumn(1).width = 28;
  raw.getColumn(2).width = 10;
  for (let c = 3; c <= 14; c++) raw.getColumn(c).width = 14;
  raw.getColumn(5).width = 32;
  raw.getColumn(6).width = 36;
  raw.getColumn(7).width = 36;

  // 5..9 — one sheet per game, in spec order.
  for (const g of results) writeGameSheet(wb, g);

  return { wb, finalStatus, missing, parsed };
}

async function main(): Promise<void> {
  console.log(`[traffic-csv:all-games] Input folder: ${INPUT_DIR}`);
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[traffic-csv:all-games] FATAL: input folder not found at ${INPUT_DIR}`);
    process.exit(1);
  }

  const results: GameResult[] = EXPECTED_FILES.map(processOneGame);
  const { wb, finalStatus, missing, parsed } = buildWorkbook(results);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, ".local", "tracker-runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `Steamworks_Current_Pull_Traffic_AllGames_${today}.xlsx`);
  await wb.xlsx.writeFile(outPath);

  // ---- Console report (15-item checklist) ----
  console.log(`\n=== TRACKER CURRENT-PULL TRAFFIC CSV — ALL GAMES REPORT ===`);
  console.log(`1. Output workbook:                    ${outPath}`);
  console.log(`2. Files parsed (${parsed.length}):                 ${parsed.map((g) => g.gameName).join(", ") || "(none)"}`);
  console.log(`3. Files missing (${missing.length}):                ${missing.map((g) => g.gameName).join(", ") || "(none)"}`);
  console.log(`4. Rows parsed per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.status === "REAL_DATA" ? g.rows.length : g.status}`);
  console.log(`5. Page/source rows per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.status === "REAL_DATA" ? g.pageSource.length : g.status}`);
  console.log(`6. Country rows per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.status === "REAL_DATA" ? g.country.length : g.status}`);
  console.log(`7. Invalid rows per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.invalidLines.length}`);
  console.log(`8. Public impressions per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.totals ? g.totals.publicImpressions : g.status}`);
  console.log(`9. Public visits per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.totals ? g.totals.publicVisits : g.status}`);
  console.log(`10. CTR per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.totals ? fmtCtr(g.totals.publicCtr) : g.status}`);
  console.log(`11. Owner impressions / visits per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.totals ? `${g.totals.ownerImpressions} / ${g.totals.ownerVisits}` : g.status}`);
  console.log(`12. Bot impressions / visits per game:`);
  for (const g of results) console.log(`     - ${g.gameName.padEnd(28)} ${g.totals ? `${g.totals.botImpressions} / ${g.totals.botVisits}` : g.status}`);
  console.log(`13. Country rows separated:            YES — country rows excluded from page/source totals for every game`);
  console.log(`14. Final Validation status:           ${finalStatus}`);
  const allWarn = results.flatMap((g) => g.warnings.map((w) => `[${g.gameName}] ${w}`));
  const allErr = results.flatMap((g) => g.errors.map((e) => `[${g.gameName}] ${e}`));
  console.log(`15. Warnings (${allWarn.length}) / Errors (${allErr.length}):`);
  for (const w of allWarn) console.log(`    WARN  ${w}`);
  for (const e of allErr) console.log(`    ERROR ${e}`);
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus !== "PASSED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[traffic-csv:all-games] FATAL:", err);
  process.exit(1);
});
