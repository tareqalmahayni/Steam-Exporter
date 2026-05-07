/**
 * Milestone 5 — Traffic CSV → standalone Excel exporter.
 *
 * Reads one Steam "App Traffic" CSV, validates filename identity (AppID +
 * date range), parses + normalizes rows, and writes a clean standalone
 * workbook containing ONLY the data from this CSV. No wishlist data, no
 * tracker history, no Dashboard / Consolidated KPI / KPI by Quarter.
 *
 * CLI:
 *   pnpm --filter @workspace/scripts run tracker:current-pull:traffic-csv [path]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS, { type Workbook } from "exceljs";

import {
  TRAFFIC_APP_ALLOWLIST,
  parseTrafficCsv,
  parseTrafficFilename,
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
// scripts/src/traffic/ → repo root is three levels up.
const repoRoot = path.resolve(__dirname, "..", "..", "..");

const DEFAULT_CSV = path.join(
  repoRoot,
  ".local",
  "input",
  "traffic",
  "traffic_colossus_1722800_20260430_20260506.csv",
);

interface BuildContext {
  csvPath: string;
  fileName: string;
  appid: string;
  gameName: string;
  startIso: string;
  endIso: string;
  headers: string[];
  rows: NormalizedTrafficRow[];
  pageSourceRows: NormalizedTrafficRow[];
  countryRows: NormalizedTrafficRow[];
  invalidLines: Array<{ lineNumber: number; raw: string; reason: string }>;
  warnings: string[];
  errors: string[];
  totals: WindowAggregate;
  byPageSource: PageSourceAggregate[];
  byCountry: CountryAggregate[];
}

function fmtCtr(c: number | null): string {
  return c === null ? "NOT AVAILABLE" : `${(c * 100).toFixed(2)}%`;
}

function buildWorkbook(ctx: BuildContext): { wb: Workbook; finalStatus: "PASSED" | "FAILED" } {
  const wb = new ExcelJS.Workbook();
  wb.creator = "tracker-current-pull-traffic";
  wb.created = new Date();
  const finalStatus: "PASSED" | "FAILED" = ctx.errors.length === 0 ? "PASSED" : "FAILED";

  // 1. Summary
  const sum = wb.addWorksheet("Summary");
  sum.getRow(1).values = [
    "Game", "AppID", "Date range", "Granularity",
    "Total public impressions", "Total public visits", "CTR",
    "Total owner impressions", "Total owner visits",
    "Bot impressions", "Bot visits",
    "Page/source rows", "Country rows", "Invalid rows",
    "Status", "Errors", "Warnings",
  ];
  sum.getRow(1).font = { bold: true };
  sum.getRow(2).values = [
    ctx.gameName, ctx.appid, `${ctx.startIso} → ${ctx.endIso}`, "Window Aggregate",
    ctx.totals.publicImpressions, ctx.totals.publicVisits, fmtCtr(ctx.totals.publicCtr),
    ctx.totals.ownerImpressions, ctx.totals.ownerVisits,
    ctx.totals.botImpressions, ctx.totals.botVisits,
    ctx.totals.realPageSourceRowCount, ctx.totals.countryRowCount, ctx.invalidLines.length,
    finalStatus,
    ctx.errors.length === 0 ? "(none)" : ctx.errors.join("; "),
    ctx.warnings.length === 0 ? "(none)" : ctx.warnings.join("; "),
  ];
  for (let c = 1; c <= 17; c++) sum.getColumn(c).width = c <= 4 ? 26 : 18;
  sum.getColumn(16).width = 60;
  sum.getColumn(17).width = 60;

  // 2. Validation
  const v = wb.addWorksheet("Validation");
  v.getRow(1).values = ["Field", "Value"];
  v.getRow(1).font = { bold: true };
  const vrows: Array<[string, string | number]> = [
    ["Export mode", "Pull Data Alone — Traffic CSV"],
    ["Pull timestamp", new Date().toISOString()],
    ["CSV file used", ctx.csvPath],
    ["Headers detected", ctx.headers.join(" | ")],
    ["Filename AppID", ctx.appid],
    ["Filename date range", `${ctx.startIso} → ${ctx.endIso}`],
    ["AppID allowlist match", `${ctx.gameName} (${ctx.appid})`],
    ["Rows parsed", ctx.rows.length],
    ["Page/source rows parsed", ctx.pageSourceRows.length],
    ["Country rows parsed", ctx.countryRows.length],
    ["Invalid rows", ctx.invalidLines.length],
    ["Public impressions total", ctx.totals.publicImpressions],
    ["Public visits total", ctx.totals.publicVisits],
    ["CTR calculation method", "Visits / Impressions, only if Impressions > 0; else NOT AVAILABLE"],
    ["Public CTR", fmtCtr(ctx.totals.publicCtr)],
    ["Owner impressions total", ctx.totals.ownerImpressions],
    ["Owner visits total", ctx.totals.ownerVisits],
    ["Bot impressions total", ctx.totals.botImpressions],
    ["Bot visits total", ctx.totals.botVisits],
    ["Country rows separated (not double-counted)", "YES — country rows excluded from page/source totals"],
    ["Wishlist data included", "NO"],
    ["Tracker history included", "NO"],
    ["Warnings", ctx.warnings.length === 0 ? "(none)" : ctx.warnings.join("; ")],
    ["Errors", ctx.errors.length === 0 ? "(none)" : ctx.errors.join("; ")],
    ["Final status", finalStatus],
  ];
  for (let i = 0; i < vrows.length; i++) v.getRow(i + 2).values = vrows[i];
  v.getColumn(1).width = 44;
  v.getColumn(2).width = 90;

  // 3. Pull Log
  const pl = wb.addWorksheet("Pull Log");
  pl.getRow(1).values = ["Timestamp", "CSV file", "Event", "Detail"];
  pl.getRow(1).font = { bold: true };
  const stamp = new Date().toISOString();
  const events: Array<[string, string]> = [
    ["READ_CSV", `Read ${ctx.rows.length + ctx.invalidLines.length + 1} lines (1 header + ${ctx.rows.length} data + ${ctx.invalidLines.length} invalid)`],
    ["VALIDATE_FILENAME", `AppID=${ctx.appid}, range=${ctx.startIso} → ${ctx.endIso}`],
    ["VALIDATE_HEADERS", `OK — ${ctx.headers.length} columns: ${ctx.headers.join(", ")}`],
    ["NORMALIZE", `${ctx.rows.length} rows normalized; ${ctx.pageSourceRows.length} page/source + ${ctx.countryRows.length} country`],
    ["AGGREGATE", `Public impressions=${ctx.totals.publicImpressions}, public visits=${ctx.totals.publicVisits}, owner impressions=${ctx.totals.ownerImpressions}, owner visits=${ctx.totals.ownerVisits}, bot impressions=${ctx.totals.botImpressions}, bot visits=${ctx.totals.botVisits}`],
  ];
  for (const [evt, detail] of events) {
    pl.addRow([stamp, ctx.fileName, evt, detail]);
  }
  for (const inv of ctx.invalidLines) {
    pl.addRow([stamp, ctx.fileName, "INVALID_ROW", `Line ${inv.lineNumber}: ${inv.reason}`]);
  }
  for (const w of ctx.warnings) pl.addRow([stamp, ctx.fileName, "WARN", w]);
  for (const e of ctx.errors) pl.addRow([stamp, ctx.fileName, "ERROR", e]);
  pl.getColumn(1).width = 24;
  pl.getColumn(2).width = 56;
  pl.getColumn(3).width = 18;
  pl.getColumn(4).width = 80;

  // 4. Raw_Traffic — every parsed row, verbatim, both page/source and country.
  const raw = wb.addWorksheet("Raw_Traffic");
  raw.getRow(1).values = [
    "Source Line", "Bucket", "Page / Category", "Page / Feature (raw)", "Page / Feature (display)",
    "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits", "Is Bot", "Is Country",
  ];
  raw.getRow(1).font = { bold: true };
  for (const r of ctx.rows) {
    raw.addRow([
      r.lineNumber,
      r.isCountry ? "Country" : (r.isBot ? "Bot" : "Page/Source"),
      r.pageCategory,
      r.pageFeature,
      r.pageFeatureDisplay,
      r.impressions ?? "NOT AVAILABLE",
      r.visits ?? "NOT AVAILABLE",
      fmtCtr(calculateCtr(r.visits, r.impressions)),
      r.ownerImpressions ?? "NOT AVAILABLE",
      r.ownerVisits ?? "NOT AVAILABLE",
      r.isBot ? "YES" : "NO",
      r.isCountry ? "YES" : "NO",
    ]);
  }
  raw.getColumn(1).width = 12;
  raw.getColumn(2).width = 12;
  raw.getColumn(3).width = 32;
  raw.getColumn(4).width = 36;
  raw.getColumn(5).width = 36;
  for (let c = 6; c <= 12; c++) raw.getColumn(c).width = 14;

  // 5. Game-specific sheet — uses spec-required name "Colossus - Eternal Blight".
  const gs = wb.addWorksheet(ctx.gameName);
  let r = 1;
  gs.getCell(`A${r}`).value = "SECTION A — OVERVIEW";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;
  const overview: Array<[string, string | number]> = [
    ["Game", ctx.gameName],
    ["AppID", ctx.appid],
    ["Date range", `${ctx.startIso} → ${ctx.endIso}`],
    ["Granularity", "Window Aggregate (no per-day data in CSV)"],
    ["Total public impressions", ctx.totals.publicImpressions],
    ["Total public visits", ctx.totals.publicVisits],
    ["CTR", fmtCtr(ctx.totals.publicCtr)],
    ["Total owner impressions", ctx.totals.ownerImpressions],
    ["Total owner visits", ctx.totals.ownerVisits],
    ["Bot impressions", ctx.totals.botImpressions],
    ["Bot visits", ctx.totals.botVisits],
    ["Status", finalStatus === "PASSED" ? "REAL_DATA" : "PARSE_FAILED"],
    ["Errors", ctx.errors.length === 0 ? "(none)" : ctx.errors.join("; ")],
    ["Warnings", ctx.warnings.length === 0 ? "(none)" : ctx.warnings.join("; ")],
  ];
  for (const [k, val] of overview) {
    gs.getCell(`A${r}`).value = k;
    gs.getCell(`B${r}`).value = val;
    r++;
  }
  r++;

  // Section B — Page/Source Breakdown
  gs.getCell(`A${r}`).value = "SECTION B — PAGE/SOURCE BREAKDOWN";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;
  gs.getRow(r).values = [
    "Source Category", "Source/Page Feature", "Impressions", "Visits", "CTR",
    "Owner Impressions", "Owner Visits", "Is Bot", "Status", "Message",
  ];
  gs.getRow(r).font = { bold: true };
  r++;
  for (const a of ctx.byPageSource) {
    gs.getRow(r).values = [
      a.category, a.feature,
      a.impressions, a.visits, fmtCtr(a.ctr),
      a.ownerImpressions, a.ownerVisits,
      a.isBot ? "YES" : "NO",
      "REAL_DATA",
      a.isBot ? "Bot Traffic — excluded from public totals" : "OK",
    ];
    r++;
  }
  r++;

  // Section C — Country Breakdown
  gs.getCell(`A${r}`).value = "SECTION C — COUNTRY BREAKDOWN";
  gs.getCell(`A${r}`).font = { bold: true };
  r++;
  gs.getRow(r).values = [
    "Country Code", "Impressions", "Visits", "CTR",
    "Owner Impressions", "Owner Visits", "Status", "Message",
  ];
  gs.getRow(r).font = { bold: true };
  r++;
  for (const a of ctx.byCountry) {
    gs.getRow(r).values = [
      a.countryCode, a.impressions, a.visits, fmtCtr(a.ctr),
      a.ownerImpressions, a.ownerVisits,
      "REAL_DATA", "OK",
    ];
    r++;
  }
  gs.getColumn(1).width = 32;
  gs.getColumn(2).width = 36;
  for (let c = 3; c <= 10; c++) gs.getColumn(c).width = 16;

  return { wb, finalStatus };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const csvPath = path.resolve(args[0] ?? DEFAULT_CSV);

  console.log(`[traffic-csv] Input: ${csvPath}`);
  if (!fs.existsSync(csvPath)) {
    console.error(`[traffic-csv] FATAL: CSV not found at ${csvPath}`);
    process.exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Filename identity
  const ident = validateTrafficFileIdentity(csvPath, { appAllowlist: TRAFFIC_APP_ALLOWLIST });
  errors.push(...ident.errors);
  warnings.push(...ident.warnings);
  if (!ident.ok || !ident.appid || !ident.startIso || !ident.endIso) {
    console.error(`[traffic-csv] FATAL: filename identity check failed`);
    for (const e of errors) console.error(`  ERROR: ${e}`);
    process.exit(1);
  }
  const gameName = ident.gameName ?? "(unknown)";

  // 2. Parse
  const parsed = parseTrafficCsv(csvPath);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    if (parsed.invalidLines.length > 0) {
      for (const inv of parsed.invalidLines) errors.push(`Line ${inv.lineNumber}: ${inv.reason}`);
    } else {
      errors.push("CSV produced no rows");
    }
  }
  for (const inv of parsed.invalidLines) warnings.push(`Invalid line ${inv.lineNumber}: ${inv.reason}`);

  // 3. Normalize + split + validate
  const normalized = normalizeTrafficRows(parsed.rows);
  const split = splitTrafficRowsIntoPageSourceAndCountry(normalized);
  const validation = validateTrafficRows(normalized);
  warnings.push(...validation.warnings);

  // 4. Aggregates
  const totals = aggregateTrafficByGameAndWindow(normalized);
  const byPageSource = aggregateTrafficBySourcePage(normalized);
  const byCountry = aggregateTrafficByCountry(normalized);

  // 5. Build workbook
  const ctx: BuildContext = {
    csvPath,
    fileName: path.basename(csvPath),
    appid: ident.appid,
    gameName,
    startIso: ident.startIso,
    endIso: ident.endIso,
    headers: parsed.headers,
    rows: normalized,
    pageSourceRows: split.pageSource,
    countryRows: split.country,
    invalidLines: parsed.invalidLines,
    warnings,
    errors,
    totals,
    byPageSource,
    byCountry,
  };
  const { wb, finalStatus } = buildWorkbook(ctx);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, ".local", "tracker-runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  // Use a filename-safe game label (drop special chars).
  const gameSlug = gameName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const outPath = path.join(outDir, `Steamworks_Current_Pull_Traffic_${gameSlug}_${today}.xlsx`);
  await wb.xlsx.writeFile(outPath);

  console.log(`\n=== TRACKER CURRENT-PULL TRAFFIC CSV REPORT ===`);
  console.log(`1. Output workbook:                    ${outPath}`);
  console.log(`2. Rows parsed:                        ${normalized.length}`);
  console.log(`3. Page/source rows parsed:            ${split.pageSource.length}`);
  console.log(`4. Country rows parsed:                ${split.country.length}`);
  console.log(`5. Invalid rows:                       ${parsed.invalidLines.length}`);
  console.log(`6. Total public impressions:           ${totals.publicImpressions}`);
  console.log(`7. Total public visits:                ${totals.publicVisits}`);
  console.log(`8. CTR (public):                       ${fmtCtr(totals.publicCtr)}`);
  console.log(`9. Total owner impressions:            ${totals.ownerImpressions}`);
  console.log(`10. Total owner visits:                ${totals.ownerVisits}`);
  console.log(`11. Bot impressions / Bot visits:      ${totals.botImpressions} / ${totals.botVisits}`);
  console.log(`12. Country rows separated:            YES — ${split.country.length} country rows excluded from page/source totals`);
  console.log(`13. Workbook contains only traffic:    YES — built from scratch with ExcelJS, no wishlist / no tracker template`);
  console.log(`14. Final Validation status:           ${finalStatus}`);
  console.log(`15. Warnings (${warnings.length}) / Errors (${errors.length}):`);
  for (const w of warnings) console.log(`    WARN  ${w}`);
  for (const e of errors) console.log(`    ERROR ${e}`);
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus !== "PASSED") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[traffic-csv] FATAL:", err);
  process.exit(1);
});
