// Milestone 3 CLI — connect real Steam wishlist API to the safe tracker writer.
//
// Usage:
//   pnpm --filter @workspace/scripts run tracker:real-wishlist:colossus
//
// Optional:
//   -- --range custom:<startISO>:<endISO>   (default: latest completed 7-day window)
//   -- --in <path>                          (default: attached_assets/Tracker_Template_…xlsx)
//   -- --appid <id>                         (default: 1722800 — Colossus)
//
// What this does (and only this):
//   - Pulls real daily wishlist data from Steam's Partner Financial API for
//     Colossus across the requested window.
//   - Writes daily WL rows into "Colossus - Eternal Blight_WL" via the same
//     guarded writer used in Milestone 1.
//   - Updates the Validation, Pull Log, and Raw_Wishlist_API sheets and
//     stubs Raw_Traffic as "NOT PULLED".
//   - Applies the same Milestone-1 structural cleanups (typo + Noor +
//     Dashboard #VALUE! safety net) so the output workbook stays clean.
//   - NEVER touches the original tracker bytes. NEVER writes synthesized 0s.
//   - NEVER scrapes Steamworks dashboard. NEVER pulls impressions/visits.

import path from "node:path";
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { GAMES } from "./map.js";
import { validateWorkbook, validationPassed } from "./validate.js";
import { applyTypoFix } from "./typoFix.js";
import { applyTypoSweep } from "./typoSweep.js";
import { addNoor } from "./addNoor.js";
import { applyDashboardGuard } from "./dashboardGuard.js";
import { applyRealWishlistColossus } from "./realWriter.js";
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
  appid: string;
  range: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    inPath: "attached_assets/Tracker_Template_1778144249529.xlsx",
    appid: "1722800",
    range: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") out.inPath = argv[++i] ?? out.inPath;
    else if (a === "--appid") out.appid = argv[++i] ?? out.appid;
    else if (a === "--range") out.range = argv[++i];
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return out;
}

function printHelp(): void {
  console.log(`Tracker Real Wishlist (Milestone 3 — Colossus only, real Steam API)

Options:
  --in <path>                      input tracker .xlsx
  --appid <id>                     Steam AppID (default 1722800 — Colossus)
  --range custom:<startISO>:<endISO>   override the date window
                                   (default: latest completed 7-day window)
  --help                           this help

Output: .local/tracker-runs/<timestamp>/Steamworks_Tracker_REAL_WISHLIST_Colossus_<YYYY-MM-DD>.xlsx`);
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
  throw new Error(`Unknown --range: "${arg}". Only 'custom:<startISO>:<endISO>' is accepted in M3.`);
}

interface OutputPaths {
  outputDir: string;
  outputXlsx: string;
  changelogJsonl: string;
  changelogMd: string;
  runJson: string;
}

function prepareOutputPaths(rootDir: string, appLabel: string): OutputPaths {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(rootDir, ".local", "tracker-runs", stamp);
  mkdirSync(outputDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  return {
    outputDir,
    outputXlsx: path.join(outputDir, `Steamworks_Tracker_REAL_WISHLIST_${appLabel}_${today}.xlsx`),
    changelogJsonl: path.join(outputDir, "changelog.jsonl"),
    changelogMd: path.join(outputDir, "changelog.md"),
    runJson: path.join(outputDir, "run.json"),
  };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd().endsWith("/scripts") ? path.join(process.cwd(), "..") : process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const inputAbs = path.isAbsolute(args.inPath) ? args.inPath : path.join(repoRoot, args.inPath);
  const window = resolveWindow(args.range);

  const apiKey = process.env.STEAM_FINANCIAL_KEY;
  const keyPresent = typeof apiKey === "string" && apiKey.trim() !== "";

  console.log(`[real-wishlist] input:        ${inputAbs}`);
  console.log(`[real-wishlist] appid:        ${args.appid} (Colossus)`);
  console.log(`[real-wishlist] window:       ${window.label}`);
  console.log(`[real-wishlist] key present:  ${keyPresent ? "YES" : "NO"}`);

  const inputShaBefore = sha256(inputAbs);
  console.log(`[real-wishlist] input sha256: ${inputShaBefore}`);

  // 1) Prepare output paths + copy bytes.
  const targets = prepareOutputPaths(repoRoot, "Colossus");
  copyFileSync(inputAbs, targets.outputXlsx);
  console.log(`[real-wishlist] output:       ${targets.outputXlsx}`);

  // 2) Load both copies.
  const before = await loadWorkbook(inputAbs);
  const after = await loadWorkbook(targets.outputXlsx);

  // 3) Validate input shape.
  const checks = validateWorkbook(after);
  const okValidation = validationPassed(checks);
  console.log(`[real-wishlist] validation:   ${okValidation ? "PASS" : "FAIL"} (${checks.length} checks)`);
  if (!okValidation) {
    const failed = checks.filter((c) => !c.pass);
    for (const f of failed) console.error(`  FAIL: ${f.name} — ${f.detail}`);
    await after.xlsx.writeFile(targets.outputXlsx);
    console.error(`[real-wishlist] BLOCKED — input mapping invalid.`);
    process.exit(2);
  }

  // 4) Pull real wishlist data for Colossus across the window.
  console.log(`[real-wishlist] pulling Steam Wishlist API for ${args.appid}…`);
  const summary: WishlistPullSummary = await fetchWishlistRange({
    appid: args.appid,
    startIso: window.startIso,
    endIso: window.endIso,
    apiKey,
    onProgress: (d, i, total) => {
      console.log(`  [${i + 1}/${total}] ${d.dateIso} — ${d.status}${d.adds !== null ? ` (adds=${d.adds}, del=${d.deletes ?? "?"})` : ""}`);
    },
  });
  console.log(`[real-wishlist] Steam calls: attempted=${summary.attempted} succeeded=${summary.succeeded} failed=${summary.failed}`);

  // 5) Apply same Milestone-1 structural cleanups (idempotent).
  const typoEntries = applyTypoFix(after, /*forceRefresh*/ false);
  const noor = addNoor(after);

  // 6) Write Colossus daily WL rows for successful days.
  const writeEntries = applyRealWishlistColossus(after, summary.daily);

  // 7) Final typo sweep + Dashboard #VALUE! guard (same pattern as M1 CLI).
  const typoSweep = applyTypoSweep(after);
  const dashGuard = applyDashboardGuard(after);
  after.calcProperties = { ...(after.calcProperties ?? {}), fullCalcOnLoad: true };

  // 8) Raw_Wishlist_API + Raw_Traffic sheets.
  const game = GAMES.colossus;
  writeRawWishlistApi(
    after,
    summary.daily.map((d) => ({ gameLabel: game.canonicalName, day: d })),
  );
  writeRawTrafficStub(after);

  // 9) Validation sheet (M3 enriched).
  writeRealValidationSheet(after, {
    pullStatus: deriveOverallStatus(summary),
    summary,
    writeEntries,
    keyPresent,
    range: window,
    inputValidationChecks: checks.length,
    inputValidationPass: okValidation,
  });

  // 10) Pull Log per-date.
  appendPullLogPerDate(after, {
    timestampIso: new Date().toISOString(),
    gameLabel: game.canonicalName,
    appid: args.appid,
    summary,
    writeEntries,
  });

  // 11) Formula-integrity allow-list = sanctioned Dashboard rewrites.
  const allowList = new Set<string>([...dashGuard.rewrittenAddrs, ...typoSweep.rewrittenFormulaAddrs]);
  const formulaDeltas = checkFormulaIntegrity(before, after, allowList);

  // 12) Save.
  await after.xlsx.writeFile(targets.outputXlsx);
  const inputShaAfter = sha256(inputAbs);
  const outputSha = sha256(targets.outputXlsx);
  const inputUntouched = inputShaBefore === inputShaAfter;

  // 13) Changelog files.
  const allEntries: ChangeEntry[] = [...typoEntries, ...noor.entries, ...writeEntries, ...typoSweep.entries, ...dashGuard.entries];
  writeChangelogJsonl(allEntries, targets.changelogJsonl);
  writeChangelogMarkdown(allEntries, targets.changelogMd);

  // 14) run.json.
  const totals = aggregateTotals(summary);
  const writes = writeEntries.filter((e) => e.status === "write").length;
  const skips = writeEntries.filter((e) => e.status.startsWith("skip")).length;
  const preserved = writeEntries.filter((e) => e.status === "skip-existing-manual").length;
  const overallStatus = deriveOverallStatus(summary);
  const finalStatus =
    overallStatus === "REAL_DATA" || overallStatus === "TRUE_ZERO_FROM_STEAM" ? "PASSED" : "FAILED";

  writeFileSync(targets.runJson, JSON.stringify({
    milestone: "M3-real-wishlist-colossus",
    timestamp: new Date().toISOString(),
    appid: args.appid,
    game: game.canonicalName,
    range: window,
    keyPresent,
    input: { path: inputAbs, sha256Before: inputShaBefore, sha256After: inputShaAfter, untouched: inputUntouched },
    output: { path: targets.outputXlsx, sha256: outputSha },
    steam: {
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
      perDateStatuses: summary.daily.map((d) => ({ date: d.dateIso, status: d.status, http: d.httpStatus, message: d.message })),
    },
    totals,
    writes: { writes, skips, preserved },
    formulaIntegrity: { ok: formulaDeltas.length === 0, unexpectedChanges: formulaDeltas },
    dashboardGuard: { formulasWrapped: dashGuard.entries.length, fullCalcOnLoad: true },
    finalStatus,
  }, null, 2));

  // 15) Console report (the 16 things the user asked to see).
  console.log(`\n=== TRACKER REAL-WISHLIST COLOSSUS REPORT ===`);
  console.log(`1. Files changed:               ${targets.outputXlsx} (output workbook); changelogs + run.json beside it.`);
  console.log(`2. Output workbook path:        ${targets.outputXlsx}`);
  console.log(`3. Change log path:             ${targets.changelogJsonl}`);
  console.log(`                                ${targets.changelogMd}`);
  console.log(`4. Date range pulled:           ${window.startIso} → ${window.endIso} (7 days)`);
  console.log(`5. Daily wishlist values pulled:`);
  for (const d of summary.daily) {
    if (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM") {
      console.log(`     ${d.dateIso}  adds=${d.adds}  del=${d.deletes}  pur=${d.purchases}  gifts=${d.gifts}  net=${d.net}  [${d.status}]`);
    } else {
      console.log(`     ${d.dateIso}  FAILED [${d.status}] — ${d.message}`);
    }
  }
  console.log(`6. Total NET wishlist (week):   ${totals.net} (adds=${totals.adds}, del=${totals.deletes}, pur=${totals.purchases}, gifts=${totals.gifts})`);
  console.log(`7. Cells written:               ${writes}`);
  console.log(`8. Manual values preserved:     ${preserved}`);
  console.log(`9. Original tracker hash:       before=${inputShaBefore}`);
  console.log(`                                after =${inputShaAfter}  ${inputUntouched ? "(MATCH ✅)" : "(MISMATCH ❌ DANGER)"}`);
  console.log(`10. Formula integrity:          ${formulaDeltas.length === 0 ? "OK" : `FAIL (${formulaDeltas.length} unexpected changes)`}`);
  console.log(`11. Dashboard #VALUE risk:      neutralized (${dashGuard.entries.length} formulas wrapped in IFERROR(...,""); fullCalcOnLoad=true)`);
  console.log(`12. Validation status:          ${finalStatus} (sheet "Validation" written into output workbook)`);
  console.log(`13. Raw_Wishlist_API populated: YES (${summary.daily.length} rows — one per date)`);
  console.log(`14. Colossus_WL populated:      YES with real Steam data (sheet: "${game.wlSheet}")`);
  console.log(`15. Consolidated KPI / KPI by Quarter: untouched directly; their existing formulas reference "${game.wlSheet}" which now contains real data — Excel recomputes weekly net + consolidated totals on open (fullCalcOnLoad=true).`);
  const failed = summary.daily.filter((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
  if (failed.length === 0) {
    console.log(`16. Errors / warnings:          none`);
  } else {
    console.log(`16. Errors / warnings:          ${failed.length} day(s) failed:`);
    for (const f of failed) console.log(`     ${f.dateIso} — ${f.status} — ${f.message}`);
  }
  console.log(`\nFINAL: ${finalStatus}`);
  if (finalStatus !== "PASSED") process.exitCode = 1;
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
  // Else surface the first failure status as representative.
  const firstFail = s.daily.find((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
  return firstFail?.status ?? "API_ERROR";
}

function writeRealValidationSheet(
  wb: ReturnType<typeof loadWorkbook> extends Promise<infer W> ? W : never,
  v: {
    pullStatus: WishlistDayResult["status"];
    summary: WishlistPullSummary;
    writeEntries: ChangeEntry[];
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

  const totals = aggregateTotals(v.summary);
  const writes = v.writeEntries.filter((e) => e.status === "write").length;
  const skips = v.writeEntries.filter((e) => e.status.startsWith("skip")).length;
  const preserved = v.writeEntries.filter((e) => e.status === "skip-existing-manual").length;
  const finalStatus =
    v.pullStatus === "REAL_DATA" || v.pullStatus === "TRUE_ZERO_FROM_STEAM" ? "PASSED" : "FAILED";

  const rows: Array<[string, string | number]> = [
    ["Milestone", "M3 — Real Steam Wishlist API → Colossus"],
    ["Pull mode status (overall)", v.pullStatus],
    ["STEAM_FINANCIAL_KEY present", v.keyPresent ? "YES" : "NO"],
    ["Range", v.range.label],
    ["Range start", v.range.startIso],
    ["Range end", v.range.endIso],
    ["Steam API calls attempted", v.summary.attempted],
    ["Steam API calls successful", v.summary.succeeded],
    ["Steam API calls failed", v.summary.failed],
    ["Dates pulled", v.summary.daily.map((d) => d.dateIso).join(", ")],
    ["Total adds (week)", totals.adds],
    ["Total deletes (week)", totals.deletes],
    ["Total purchases (week)", totals.purchases],
    ["Total gifts (week)", totals.gifts],
    ["Total NET wishlist change (week)", totals.net],
    ["True-zero fields (count)", totals.trueZeroFields],
    ["Manual values preserved", preserved],
    ["Cells written", writes],
    ["Cells skipped", skips],
    ["Input mapping checks", `${v.inputValidationChecks} (${v.inputValidationPass ? "PASS" : "FAIL"})`],
    ["FINAL STATUS", finalStatus],
  ];
  for (let i = 0; i < rows.length; i++) {
    ws.getRow(i + 2).values = rows[i];
  }
  ws.getRow(rows.length + 1).font = { bold: true };
  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 80;
}

function appendPullLogPerDate(
  wb: ReturnType<typeof loadWorkbook> extends Promise<infer W> ? W : never,
  v: {
    timestampIso: string;
    gameLabel: string;
    appid: string;
    summary: WishlistPullSummary;
    writeEntries: ChangeEntry[];
  },
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
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 26;
    ws.getColumn(7).width = 22;
    ws.getColumn(8).width = 12;
    ws.getColumn(9).width = 12;
    ws.getColumn(10).width = 60;
  }

  const wlSheet = GAMES.colossus.wlSheet;

  for (const d of v.summary.daily) {
    // One summary row per (date, metric) — adds, deletes, purchases, gifts.
    const metrics: Array<{ metric: string; value: number | null }> = [
      { metric: "wishlist_adds", value: d.adds },
      { metric: "wishlist_deletes", value: d.deletes },
      { metric: "wishlist_purchases", value: d.purchases },
      { metric: "wishlist_gifts", value: d.gifts },
    ];
    for (const m of metrics) {
      const matched = v.writeEntries.find(
        (e) =>
          e.dateOrWeek === d.dateIso &&
          (e.metric === `wl.${m.metric.replace("wishlist_", "")}` ||
            (m.metric === "wishlist_purchases" && e.metric === "wl.purchases") ||
            (m.metric === "wishlist_gifts" && e.metric === "wl.gifts")),
      );
      const oldValue = matched?.oldValue ?? "";
      const newValue = m.value === null ? "n/a" : String(m.value);
      const status = matched?.status ?? (d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM" ? "write" : "skip-na");
      const message =
        d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM"
          ? `Steam ${d.status}; row in ${wlSheet}`
          : `Steam ${d.status} — ${d.message}`;
      const next = ws.rowCount + 1;
      ws.getRow(next).values = [
        v.timestampIso,
        v.gameLabel,
        v.appid,
        d.dateIso,
        m.metric,
        "Steam Partner Financial API",
        status,
        oldValue,
        newValue,
        message,
      ];
    }
  }
}

main().catch((err) => {
  console.error("[real-wishlist] FATAL:", err);
  process.exit(1);
});
