// Milestone 4 CLI — pull real Steam wishlist data for all five main games
// and write each game safely into the copied tracker workbook.
//
// Usage:
//   pnpm --filter @workspace/scripts run tracker:real-wishlist:all-games
//
// Optional:
//   -- --range custom:<startISO>:<endISO>   (default: latest completed 7-day window)
//   -- --in <path>                          (default: attached_assets/Tracker_Template_…xlsx)
//
// Out of scope (deliberately): UI, Electron, dashboard scraping, traffic /
// impressions / visits, demos, playtests, supporter packs, Tales of the
// Forgotten, the original tracker (untouched — bytes are copied first).

import path from "node:path";
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { GAMES, APP_IDS, type GameMap, type GameId } from "./map.js";
import { validateWorkbook, validationPassed } from "./validate.js";
import { applyTypoFix } from "./typoFix.js";
import { applyTypoSweep } from "./typoSweep.js";
import { addNoor } from "./addNoor.js";
import { applyDashboardGuard } from "./dashboardGuard.js";
import { applyRealWishlistForGame } from "./realWriter.js";
import { writeRawWishlistApi, writeRawTrafficStub } from "./rawSheets.js";
import { loadWorkbook, sha256, checkFormulaIntegrity } from "./output.js";
import { writeChangelogJsonl, writeChangelogMarkdown, type ChangeEntry } from "./changelog.js";
import {
  fetchWishlistRange,
  latestCompletedSevenDayWindow,
  type WishlistDayResult,
  type WishlistPullSummary,
} from "../realPull/steamWishlist.js";

interface Args {
  inPath: string;
  range: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { inPath: "attached_assets/Tracker_Template_1778144249529.xlsx", range: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") out.inPath = argv[++i] ?? out.inPath;
    else if (a === "--range") out.range = argv[++i];
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return out;
}

function printHelp(): void {
  console.log(`Tracker Real Wishlist (Milestone 4 — all five main games, real Steam API)

Options:
  --in <path>                          input tracker .xlsx
  --range custom:<startISO>:<endISO>   override date window (default latest completed 7-day)
  --help                               this help

Output: .local/tracker-runs/<timestamp>/Steamworks_Tracker_REAL_WISHLIST_AllGames_<YYYY-MM-DD>.xlsx`);
}

function resolveWindow(arg: string | undefined): { startIso: string; endIso: string; label: string } {
  if (!arg) {
    const w = latestCompletedSevenDayWindow();
    return { ...w, label: `latest-completed-7-day (${w.startIso} → ${w.endIso})` };
  }
  if (arg.startsWith("custom:")) {
    const parts = arg.split(":");
    if (parts.length !== 3) throw new Error(`Bad --range. Expected custom:<startISO>:<endISO>, got "${arg}"`);
    const [, startIso, endIso] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      throw new Error(`Bad ISO dates in --range. Got start="${startIso}" end="${endIso}"`);
    }
    if (startIso > endIso) throw new Error(`--range start (${startIso}) is after end (${endIso})`);
    return { startIso, endIso, label: `custom (${startIso} → ${endIso})` };
  }
  throw new Error(`Unknown --range: "${arg}". Only 'custom:<startISO>:<endISO>' is accepted in M4.`);
}

interface OutputPaths {
  outputDir: string;
  outputXlsx: string;
  changelogJsonl: string;
  changelogMd: string;
  runJson: string;
}

function prepareOutputPaths(rootDir: string): OutputPaths {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(rootDir, ".local", "tracker-runs", stamp);
  mkdirSync(outputDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  return {
    outputDir,
    outputXlsx: path.join(outputDir, `Steamworks_Tracker_REAL_WISHLIST_AllGames_${today}.xlsx`),
    changelogJsonl: path.join(outputDir, "changelog.jsonl"),
    changelogMd: path.join(outputDir, "changelog.md"),
    runJson: path.join(outputDir, "run.json"),
  };
}

interface PerGameResult {
  game: GameMap;
  appid: string;
  summary: WishlistPullSummary;
  writeEntries: ChangeEntry[];
  overallStatus: WishlistDayResult["status"];
  totals: { adds: number; deletes: number; purchases: number; gifts: number; net: number; trueZeroFields: number };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd().endsWith("/scripts") ? path.join(process.cwd(), "..") : process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const inputAbs = path.isAbsolute(args.inPath) ? args.inPath : path.join(repoRoot, args.inPath);
  const window = resolveWindow(args.range);
  const apiKey = process.env.STEAM_FINANCIAL_KEY;
  const keyPresent = typeof apiKey === "string" && apiKey.trim() !== "";

  console.log(`[real-wishlist:all] input:        ${inputAbs}`);
  console.log(`[real-wishlist:all] window:       ${window.label}`);
  console.log(`[real-wishlist:all] key present:  ${keyPresent ? "YES" : "NO"}`);

  const inputShaBefore = sha256(inputAbs);
  console.log(`[real-wishlist:all] input sha256: ${inputShaBefore}`);

  const targets = prepareOutputPaths(repoRoot);
  copyFileSync(inputAbs, targets.outputXlsx);
  console.log(`[real-wishlist:all] output:       ${targets.outputXlsx}`);

  const before = await loadWorkbook(inputAbs);
  const after = await loadWorkbook(targets.outputXlsx);

  // Validate input.
  const checks = validateWorkbook(after);
  const okValidation = validationPassed(checks);
  console.log(`[real-wishlist:all] validation:   ${okValidation ? "PASS" : "FAIL"} (${checks.length} checks)`);
  if (!okValidation) {
    const failed = checks.filter((c) => !c.pass);
    for (const f of failed) console.error(`  FAIL: ${f.name} — ${f.detail}`);
    await after.xlsx.writeFile(targets.outputXlsx);
    console.error(`[real-wishlist:all] BLOCKED — input mapping invalid.`);
    process.exit(2);
  }

  // Apply the M1 cleanups BEFORE writing real data so Noor_WL exists for the
  // Noor pull and the Putania→Petunia label fixes are in place.
  const typoEntries = applyTypoFix(after, /*forceRefresh*/ false);
  const noor = addNoor(after);

  // Build the canonical 5-game list. After addNoor() runs, the workbook has a
  // Noor_WL sheet — but addNoor returns null noorMap if Noor was already
  // present, so always synthesize the GameMap explicitly here.
  const allGames: Array<{ id: GameId; map: GameMap }> = [
    { id: "colossus", map: GAMES.colossus },
    { id: "fleet", map: GAMES.fleet },
    { id: "taival", map: GAMES.taival },
    { id: "noor", map: noor.noorMap ?? buildNoorMapFallback() },
    { id: "petunia", map: GAMES.petunia },
  ];

  // Pull each game serially (polite spacing across the entire run).
  const perGame: PerGameResult[] = [];
  const allWriteEntries: ChangeEntry[] = [];
  let allRawRows: Array<{ gameLabel: string; day: WishlistDayResult }> = [];

  for (const { id, map } of allGames) {
    const appid = APP_IDS[id];
    console.log(`\n[real-wishlist:all] === ${map.canonicalName} (appid ${appid}) ===`);
    const summary = await fetchWishlistRange({
      appid,
      startIso: window.startIso,
      endIso: window.endIso,
      apiKey,
      onProgress: (d, i, total) => {
        const detail =
          d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM"
            ? `adds=${d.adds} del=${d.deletes}`
            : d.message;
        console.log(`  [${i + 1}/${total}] ${d.dateIso} — ${d.status} ${detail}`);
      },
    });
    const writeEntries = applyRealWishlistForGame(after, map, summary.daily);
    const totals = aggregateTotals(summary);
    const overallStatus = deriveOverallStatus(summary);
    perGame.push({ game: map, appid, summary, writeEntries, overallStatus, totals });
    allWriteEntries.push(...writeEntries);
    allRawRows = allRawRows.concat(summary.daily.map((d) => ({ gameLabel: map.canonicalName, day: d })));
    console.log(`[real-wishlist:all] ${map.canonicalName}: status=${overallStatus} attempted=${summary.attempted} succ=${summary.succeeded} fail=${summary.failed}`);
  }

  // Apply final cleanups AFTER all writes so the typo sweep and dashboard
  // guard see the latest state.
  const typoSweep = applyTypoSweep(after);
  const dashGuard = applyDashboardGuard(after);
  after.calcProperties = { ...(after.calcProperties ?? {}), fullCalcOnLoad: true };

  // Raw_Wishlist_API + Raw_Traffic stub.
  writeRawWishlistApi(after, allRawRows);
  writeRawTrafficStub(after);

  // Validation sheet.
  writeAllGamesValidationSheet(after, {
    perGame,
    keyPresent,
    range: window,
    inputValidationChecks: checks.length,
    inputValidationPass: okValidation,
  });

  // Pull Log per-(game,date,metric).
  appendAllGamesPullLog(after, {
    timestampIso: new Date().toISOString(),
    perGame,
  });

  // Formula-integrity check.
  const allowList = new Set<string>([...dashGuard.rewrittenAddrs, ...typoSweep.rewrittenFormulaAddrs]);
  const formulaDeltas = checkFormulaIntegrity(before, after, allowList);

  // Save.
  await after.xlsx.writeFile(targets.outputXlsx);
  const inputShaAfter = sha256(inputAbs);
  const outputSha = sha256(targets.outputXlsx);
  const inputUntouched = inputShaBefore === inputShaAfter;

  // Changelog files.
  const allEntries: ChangeEntry[] = [...typoEntries, ...noor.entries, ...allWriteEntries, ...typoSweep.entries, ...dashGuard.entries];
  writeChangelogJsonl(allEntries, targets.changelogJsonl);
  writeChangelogMarkdown(allEntries, targets.changelogMd);

  // run.json.
  const totalsAttempted = perGame.reduce((s, g) => s + g.summary.attempted, 0);
  const totalsSucceeded = perGame.reduce((s, g) => s + g.summary.succeeded, 0);
  const totalsFailed = perGame.reduce((s, g) => s + g.summary.failed, 0);
  const writes = allWriteEntries.filter((e) => e.status === "write").length;
  const skips = allWriteEntries.filter((e) => e.status.startsWith("skip")).length;
  const preserved = allWriteEntries.filter((e) => e.status === "skip-existing-manual").length;
  // FINAL = PASSED iff at least one game returned data AND every game's
  // overall status is REAL_DATA or TRUE_ZERO_FROM_STEAM.
  const allOk = perGame.every((g) => g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM");
  const anyOk = perGame.some((g) => g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM");
  const finalStatus = allOk ? "PASSED" : (anyOk ? "PARTIAL" : "FAILED");

  writeFileSync(targets.runJson, JSON.stringify({
    milestone: "M4-real-wishlist-all-games",
    timestamp: new Date().toISOString(),
    range: window,
    keyPresent,
    input: { path: inputAbs, sha256Before: inputShaBefore, sha256After: inputShaAfter, untouched: inputUntouched },
    output: { path: targets.outputXlsx, sha256: outputSha },
    perGame: perGame.map((g) => ({
      game: g.game.canonicalName,
      wlSheet: g.game.wlSheet,
      appid: g.appid,
      overallStatus: g.overallStatus,
      attempted: g.summary.attempted,
      succeeded: g.summary.succeeded,
      failed: g.summary.failed,
      totals: g.totals,
      perDate: g.summary.daily.map((d) => ({ date: d.dateIso, status: d.status, http: d.httpStatus, adds: d.adds, deletes: d.deletes, net: d.net, message: d.message })),
    })),
    aggregate: { attempted: totalsAttempted, succeeded: totalsSucceeded, failed: totalsFailed, writes, skips, preserved },
    formulaIntegrity: { ok: formulaDeltas.length === 0, unexpectedChanges: formulaDeltas },
    dashboardGuard: { formulasWrapped: dashGuard.entries.length, fullCalcOnLoad: true },
    finalStatus,
  }, null, 2));

  // Console report — the 17 things requested.
  console.log(`\n=== TRACKER REAL-WISHLIST ALL-GAMES REPORT ===`);
  console.log(`1. Output workbook:             ${targets.outputXlsx}`);
  console.log(`2. Change log:                  ${targets.changelogJsonl}`);
  console.log(`                                ${targets.changelogMd}`);
  console.log(`3. Date range pulled:           ${window.startIso} → ${window.endIso} (7 days)`);
  console.log(`4. Daily wishlist values per game:`);
  for (const g of perGame) {
    console.log(`   --- ${g.game.canonicalName} (appid ${g.appid}) — ${g.overallStatus}`);
    for (const d of g.summary.daily) {
      if (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM") {
        console.log(`     ${d.dateIso}  adds=${d.adds}  del=${d.deletes}  pur=${d.purchases}  gifts=${d.gifts}  net=${d.net}`);
      } else {
        console.log(`     ${d.dateIso}  FAILED [${d.status}] — ${d.message}`);
      }
    }
  }
  console.log(`5. Total NET wishlist per game:`);
  for (const g of perGame) {
    console.log(`   ${g.game.canonicalName.padEnd(28)} net=${g.totals.net}  (adds=${g.totals.adds} del=${g.totals.deletes} pur=${g.totals.purchases} gifts=${g.totals.gifts})  [${g.overallStatus}]`);
  }
  console.log(`6. API calls attempted:         ${totalsAttempted}`);
  console.log(`7. API calls successful:        ${totalsSucceeded}`);
  console.log(`8. API calls failed:            ${totalsFailed}`);
  console.log(`9. Cells written:               ${writes}`);
  console.log(`10. Manual values preserved:    ${preserved}`);
  console.log(`11. Original tracker hash:      before=${inputShaBefore}`);
  console.log(`                                after =${inputShaAfter}  ${inputUntouched ? "(MATCH ✅)" : "(MISMATCH ❌ DANGER)"}`);
  console.log(`12. Formula integrity:          ${formulaDeltas.length === 0 ? "OK" : `FAIL (${formulaDeltas.length} unexpected changes)`}`);
  console.log(`13. Dashboard #VALUE risk:      neutralized (${dashGuard.entries.length} formulas wrapped in IFERROR(...,""); fullCalcOnLoad=true)`);
  console.log(`14. Validation status:          ${finalStatus} (sheet "Validation" written into output workbook)`);
  console.log(`15. Raw_Wishlist_API populated: YES — ${allRawRows.length} rows across ${perGame.length} games`);
  console.log(`16. Per-game _WL sheet status:`);
  for (const g of perGame) {
    const wrote = g.writeEntries.filter((e) => e.status === "write").length;
    if (g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM") {
      console.log(`    ${g.game.wlSheet.padEnd(36)} POPULATED with real data (${wrote} cells written)`);
    } else {
      console.log(`    ${g.game.wlSheet.padEnd(36)} NOT WRITTEN — ${g.overallStatus}; rows untouched (no failed-pull overwrite)`);
    }
  }
  const allFails = perGame.flatMap((g) =>
    g.summary.daily
      .filter((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM")
      .map((d) => `${g.game.canonicalName} ${d.dateIso} [${d.status}] ${d.message}`),
  );
  if (allFails.length === 0) {
    console.log(`17. Errors / warnings:          none`);
  } else {
    console.log(`17. Errors / warnings:          ${allFails.length} day(s) failed:`);
    for (const f of allFails) console.log(`    ${f}`);
  }
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus === "FAILED") process.exitCode = 1;
}

function aggregateTotals(s: WishlistPullSummary): { adds: number; deletes: number; purchases: number; gifts: number; net: number; trueZeroFields: number } {
  let adds = 0, deletes = 0, purchases = 0, gifts = 0, trueZeroFields = 0;
  for (const d of s.daily) {
    if (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM") {
      adds += d.adds ?? 0;
      deletes += d.deletes ?? 0;
      purchases += d.purchases ?? 0;
      gifts += d.gifts ?? 0;
      for (const v of [d.adds, d.deletes, d.purchases, d.gifts, d.addsWindows, d.addsMac, d.addsLinux]) {
        if (v === 0) trueZeroFields++;
      }
    }
  }
  return { adds, deletes, purchases, gifts, net: adds - deletes - purchases - gifts, trueZeroFields };
}

function deriveOverallStatus(s: WishlistPullSummary): WishlistDayResult["status"] {
  if (s.daily.length === 0) return "EMPTY_RESPONSE";
  const anyReal = s.daily.some((d) => d.status === "REAL_DATA");
  if (anyReal) return "REAL_DATA";
  const allTrueZero = s.daily.every((d) => d.status === "TRUE_ZERO_FROM_STEAM");
  if (allTrueZero) return "TRUE_ZERO_FROM_STEAM";
  const firstFail = s.daily.find((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
  return firstFail?.status ?? "API_ERROR";
}

function buildNoorMapFallback(): GameMap {
  // Used only if addNoor() reported alreadyPresent (so noorMap=null) — the
  // template already had Noor_WL from a prior run. Mirror addNoor's row layout.
  return {
    id: "noor",
    canonicalName: "Noor",
    wlGameLabel: "Noor",
    wlSheet: "Noor_WL",
    kpiQuarterRows: {
      Q1: { headerRow: 70, wishlistsRow: 71, impressionsRow: 72, visitsRow: 73 },
      Q2: { headerRow: 75, wishlistsRow: 76, impressionsRow: 77, visitsRow: 78 },
      Q3: { headerRow: 80, wishlistsRow: 81, impressionsRow: 82, visitsRow: 83 },
      Q4: { headerRow: 85, wishlistsRow: 86, impressionsRow: 87, visitsRow: 88 },
    },
    consolidatedRows: { wishlists: 28, impressions: 29, visits: 30 },
  };
}

function writeAllGamesValidationSheet(
  wb: ReturnType<typeof loadWorkbook> extends Promise<infer W> ? W : never,
  v: {
    perGame: PerGameResult[];
    keyPresent: boolean;
    range: { startIso: string; endIso: string; label: string };
    inputValidationChecks: number;
    inputValidationPass: boolean;
  },
): void {
  const name = "Validation";
  const existing = wb.getWorksheet(name);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(name);
  ws.getRow(1).values = ["Field", "Value"];
  ws.getRow(1).font = { bold: true };

  const totalsAttempted = v.perGame.reduce((s, g) => s + g.summary.attempted, 0);
  const totalsSucceeded = v.perGame.reduce((s, g) => s + g.summary.succeeded, 0);
  const totalsFailed = v.perGame.reduce((s, g) => s + g.summary.failed, 0);
  const totalsWritten = v.perGame.reduce((s, g) => s + g.writeEntries.filter((e) => e.status === "write").length, 0);
  const totalsSkipped = v.perGame.reduce((s, g) => s + g.writeEntries.filter((e) => e.status.startsWith("skip")).length, 0);
  const totalsPreserved = v.perGame.reduce((s, g) => s + g.writeEntries.filter((e) => e.status === "skip-existing-manual").length, 0);
  const trueZeroFields = v.perGame.reduce((s, g) => s + g.totals.trueZeroFields, 0);
  const allOk = v.perGame.every((g) => g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM");
  const anyOk = v.perGame.some((g) => g.overallStatus === "REAL_DATA" || g.overallStatus === "TRUE_ZERO_FROM_STEAM");
  const finalStatus = allOk ? "PASSED" : (anyOk ? "PARTIAL" : "FAILED");

  const rows: Array<[string, string | number]> = [
    ["Milestone", "M4 — Real Steam Wishlist API → All Five Main Games"],
    ["STEAM_FINANCIAL_KEY present", v.keyPresent ? "YES" : "NO"],
    ["Range", v.range.label],
    ["Range start", v.range.startIso],
    ["Range end", v.range.endIso],
    ["Steam API calls attempted (total)", totalsAttempted],
    ["Steam API calls successful (total)", totalsSucceeded],
    ["Steam API calls failed (total)", totalsFailed],
    ["Cells written (total)", totalsWritten],
    ["Cells skipped (total)", totalsSkipped],
    ["Manual values preserved (total)", totalsPreserved],
    ["True-zero fields (total)", trueZeroFields],
    ["Input mapping checks", `${v.inputValidationChecks} (${v.inputValidationPass ? "PASS" : "FAIL"})`],
  ];
  // Per-game block: status, attempted/succ/fail, totals.
  for (const g of v.perGame) {
    rows.push([`--- ${g.game.canonicalName}`, ""]);
    rows.push([`  AppID`, g.appid]);
    rows.push([`  WL sheet`, g.game.wlSheet]);
    rows.push([`  Overall status`, g.overallStatus]);
    rows.push([`  API calls attempted`, g.summary.attempted]);
    rows.push([`  API calls successful`, g.summary.succeeded]);
    rows.push([`  API calls failed`, g.summary.failed]);
    rows.push([`  Total adds`, g.totals.adds]);
    rows.push([`  Total deletes`, g.totals.deletes]);
    rows.push([`  Total purchases`, g.totals.purchases]);
    rows.push([`  Total gifts`, g.totals.gifts]);
    rows.push([`  Total NET wishlist`, g.totals.net]);
  }
  rows.push(["FINAL STATUS", finalStatus]);

  for (let i = 0; i < rows.length; i++) ws.getRow(i + 2).values = rows[i];
  ws.getRow(rows.length + 1).font = { bold: true };
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 80;
}

function appendAllGamesPullLog(
  wb: ReturnType<typeof loadWorkbook> extends Promise<infer W> ? W : never,
  v: { timestampIso: string; perGame: PerGameResult[] },
): void {
  const name = "Pull Log";
  let ws = wb.getWorksheet(name);
  if (!ws) {
    ws = wb.addWorksheet(name);
    ws.getRow(1).values = [
      "Timestamp", "Game", "AppID", "Date", "Metric", "Source", "Status", "Old Value", "New Value", "Message",
    ];
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 28;
    ws.getColumn(7).width = 22;
    ws.getColumn(8).width = 12;
    ws.getColumn(9).width = 12;
    ws.getColumn(10).width = 60;
  }
  const source = "Steam Partner Financial API";
  for (const g of v.perGame) {
    for (const d of g.summary.daily) {
      const metrics: Array<{ metric: string; key: "adds" | "deletes" | "purchases" | "gifts"; value: number | null }> = [
        { metric: "wishlist_adds", key: "adds", value: d.adds },
        { metric: "wishlist_deletes", key: "deletes", value: d.deletes },
        { metric: "wishlist_purchases", key: "purchases", value: d.purchases },
        { metric: "wishlist_gifts", key: "gifts", value: d.gifts },
      ];
      for (const m of metrics) {
        const matched = g.writeEntries.find(
          (e) => e.dateOrWeek === d.dateIso && e.metric === `wl.${m.key}`,
        );
        const oldValue = matched?.oldValue ?? "";
        const newValue = m.value === null ? "n/a" : String(m.value);
        const status = matched?.status ?? (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM" ? "write" : "skip-na");
        const message =
          d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM"
            ? `Steam ${d.status}; row in ${g.game.wlSheet}`
            : `Steam ${d.status} — ${d.message}`;
        const next = ws.rowCount + 1;
        ws.getRow(next).values = [
          v.timestampIso, g.game.canonicalName, g.appid, d.dateIso, m.metric, source, status, oldValue, newValue, message,
        ];
      }
    }
  }
}

main().catch((err) => {
  console.error("[real-wishlist:all] FATAL:", err);
  process.exit(1);
});
