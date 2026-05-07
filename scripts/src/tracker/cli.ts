// CLI entrypoint for the safe tracker dry-run.
//
// Usage:
//   pnpm --filter @workspace/scripts run tracker:dry-run [-- --range <preset>] [--seed <s>] [--in <path>] [--force-refresh]
//
// Defaults: range=previous-month, seed=tracker-dry-run-v1, in=attached_assets/Tracker_Template_1778144249529.xlsx
//
// This milestone has NO --apply flag. The CLI never opens the source workbook
// for writing; it copies the bytes, opens the copy, applies edits, and saves.

import path from "node:path";
import { writeFileSync } from "node:fs";
import { parseRangeArg, resolveRange } from "./dateWindow.js";
import { generateMockPull } from "./mockPull.js";
import { validateWorkbook, validationPassed } from "./validate.js";
import { applyTypoFix } from "./typoFix.js";
import { applyTypoSweep } from "./typoSweep.js";
import { addNoor } from "./addNoor.js";
import { applyDashboardGuard } from "./dashboardGuard.js";
import { applyMockPull } from "./writer.js";
import { writeValidationSheet, appendPullLog, countByGroup } from "./logSheets.js";
import { prepareOutputPaths, copyTemplateBytes, loadWorkbook, sha256, checkFormulaIntegrity } from "./output.js";
import { writeChangelogJsonl, writeChangelogMarkdown } from "./changelog.js";

interface Args {
  inPath: string;
  range: string | undefined;
  seed: string;
  forceRefresh: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { inPath: "attached_assets/Tracker_Template_1778144249529.xlsx", range: undefined, seed: "tracker-dry-run-v1", forceRefresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") out.inPath = argv[++i] ?? out.inPath;
    else if (a === "--range") out.range = argv[++i];
    else if (a === "--seed") out.seed = argv[++i] ?? out.seed;
    else if (a === "--force-refresh") out.forceRefresh = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return out;
}

function printHelp(): void {
  console.log(`Tracker Dry-Run CLI (Milestone 1 — mock data, no Steam, no UI)

Options:
  --in <path>             input tracker .xlsx (default: attached_assets/Tracker_Template_1778144249529.xlsx)
  --range <preset>        previous-month | today | previous-year | lifetime | custom:<startISO>:<endISO>
  --seed <string>         deterministic mock-data seed (default: tracker-dry-run-v1)
  --force-refresh         overwrite existing manual values (off by default)
  --help                  this help

Output: .local/tracker-runs/<timestamp>/Steamworks_Tracker_DRY_RUN_<YYYY-MM-DD>.xlsx
The original input file is NEVER modified (sha256 verified before/after).`);
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd().endsWith("/scripts") ? path.join(process.cwd(), "..") : process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const inputAbs = path.isAbsolute(args.inPath) ? args.inPath : path.join(repoRoot, args.inPath);

  console.log(`[tracker:dry-run] input:        ${inputAbs}`);
  const inputShaBefore = sha256(inputAbs);
  console.log(`[tracker:dry-run] input sha256: ${inputShaBefore}`);

  // 1) Resolve date range.
  const preset = parseRangeArg(args.range);
  const range = resolveRange(preset, /* refYear */ 2026, new Date());
  console.log(`[tracker:dry-run] range:        ${range.label} (${range.startIso} → ${range.endIso})`);
  console.log(`[tracker:dry-run] seed:         ${args.seed}`);
  console.log(`[tracker:dry-run] forceRefresh: ${args.forceRefresh}`);

  // 2) Prepare output dir + copy bytes.
  const targets = prepareOutputPaths(repoRoot);
  copyTemplateBytes(inputAbs, targets.outputXlsx);
  console.log(`[tracker:dry-run] output:       ${targets.outputXlsx}`);

  // 3) Load BOTH copies — `before` for formula-integrity check, `after` for editing.
  const before = await loadWorkbook(inputAbs);
  const after = await loadWorkbook(targets.outputXlsx);

  // 4) Validate.
  const checks = validateWorkbook(after);
  const okValidation = validationPassed(checks);
  writeValidationSheet(after, checks);
  console.log(`[tracker:dry-run] validation:   ${okValidation ? "PASS" : "FAIL"} (${checks.length} checks)`);
  if (!okValidation) {
    const failed = checks.filter((c) => !c.pass);
    for (const f of failed) console.error(`  FAIL: ${f.name} — ${f.detail}`);
    // Persist what we have, then abort.
    await after.xlsx.writeFile(targets.outputXlsx);
    console.error(`[tracker:dry-run] BLOCKED — mapping uncertainty. See Validation sheet in ${targets.outputXlsx}`);
    process.exit(2);
  }

  // 5) Generate mock pull.
  const pull = generateMockPull({ startIso: range.startIso, endIso: range.endIso, seed: args.seed });

  // 6) Apply typo fix.
  const typoEntries = applyTypoFix(after, args.forceRefresh);

  // 7) Add Noor.
  const noor = addNoor(after);

  // 8) Apply mock writes for all 5 games.
  const writeEntries = applyMockPull(after, pull, noor.noorMap, args.forceRefresh);

  // 8a) Final typo cleanup sweep — fix any remaining "Putania's Purgatory"
  //     occurrences in plain text cells (any sheet) and Dashboard formula
  //     literals. Runs BEFORE the dashboard #VALUE! guard so the wrap sees
  //     the corrected formulas.
  const typoSweep = applyTypoSweep(after);

  // 8b) Dashboard #VALUE! safety net — wrap unguarded Dashboard formulas
  //     in IFERROR(...,"") so compute-time errors render as blank.
  const dashGuard = applyDashboardGuard(after);

  // 8c) Force Excel to fully recalculate on open. Without this, Excel may
  //     briefly display stale cached results (some viewers don't recalc at
  //     all), which can show #VALUE! for cells whose dependencies changed.
  after.calcProperties = { ...(after.calcProperties ?? {}), fullCalcOnLoad: true };

  const allEntries = [...typoEntries, ...noor.entries, ...writeEntries, ...typoSweep.entries, ...dashGuard.entries];

  // 9) Formula-integrity check.
  // The check iterates every cell that was a formula in `before` and asserts
  // it is the SAME formula in `after`. Our write paths (cellOps.attemptWrite,
  // typoFix, addNoor.setLog) all explicitly refuse to overwrite formula cells.
  // The intentional exceptions are: (a) the Dashboard #VALUE! safety net
  // wrapping formulas in IFERROR, and (b) the typo-sweep rewriting Dashboard
  // formula literals "Putania's Purgatory" → "Petunia's Purgatory". Both
  // contribute their touched addresses to this allow-list; integrity check
  // tolerates only those audited rewrites.
  const allowList = new Set<string>([...dashGuard.rewrittenAddrs, ...typoSweep.rewrittenFormulaAddrs]);
  const formulaDeltas = checkFormulaIntegrity(before, after, allowList);

  // 10) Write Pull Log row + save.
  const counts = countByGroup(allEntries);
  // We save once now to compute output sha256, then again after appending Pull
  // Log row — the Pull Log row needs the final outputSha256, which we
  // approximate by hashing the workbook *with* the row already appended, so
  // do it in this order: append Pull Log row → save → hash.
  appendPullLog(after, {
    timestamp: new Date().toISOString(),
    mode: args.forceRefresh ? "dry-run --force-refresh" : "dry-run",
    rangeLabel: range.label,
    seed: args.seed,
    writes: counts.writes,
    skips: counts.skips,
    blocks: counts.blocks,
    outputFile: path.basename(targets.outputXlsx),
    inputSha256: inputShaBefore,
    outputSha256: "(self)",
  });
  await after.xlsx.writeFile(targets.outputXlsx);

  const outputSha = sha256(targets.outputXlsx);
  const inputShaAfter = sha256(inputAbs);
  const inputUntouched = inputShaBefore === inputShaAfter;

  // 11) Write changelog files + run.json.
  writeChangelogJsonl(allEntries, targets.changelogJsonl);
  writeChangelogMarkdown(allEntries, targets.changelogMd);

  const runMeta = {
    timestamp: new Date().toISOString(),
    mode: args.forceRefresh ? "dry-run --force-refresh" : "dry-run",
    range,
    seed: args.seed,
    input: { path: inputAbs, sha256Before: inputShaBefore, sha256After: inputShaAfter, untouched: inputUntouched },
    output: { path: targets.outputXlsx, sha256: outputSha },
    counts,
    formulaIntegrity: {
      ok: formulaDeltas.length === 0,
      unexpectedChanges: formulaDeltas,
    },
    noor: { alreadyPresent: noor.alreadyPresent, added: !noor.alreadyPresent },
    typoFixCells: typoEntries.filter((e) => e.status === "write").length,
    touchedSheets: Array.from(new Set(allEntries.filter((e) => e.status === "write").map((e) => e.sheet))),
    consolidatedKpiPolicy: "formula-protected — no data cell writes; only typo-fix label cells touched",
    dashboardGuard: {
      formulasWrapped: dashGuard.entries.length,
      fullCalcOnLoad: true,
    },
  };
  writeFileSync(targets.runJson, JSON.stringify(runMeta, null, 2));

  // 12) Console report.
  console.log(`\n=== TRACKER DRY-RUN REPORT ===`);
  console.log(`1. Output workbook:        ${targets.outputXlsx}`);
  console.log(`2. Change log (jsonl):     ${targets.changelogJsonl}`);
  console.log(`   Change log (markdown):  ${targets.changelogMd}`);
  console.log(`   Run metadata:           ${targets.runJson}`);
  console.log(`3. Validation sheet:       ${okValidation ? "PASS" : "FAIL"} (${checks.length} checks; written into output workbook)`);
  console.log(`4. Pull Log:               1 new row appended into output workbook`);
  console.log(`5. Cells changed (write):  ${counts.writes}`);
  console.log(`   Cells skipped:          ${counts.skips}`);
  console.log(`   Cells blocked:          ${counts.blocks}`);
  const preserved = allEntries.filter((e) => e.status === "skip-existing-manual").length;
  console.log(`6. Manual values preserved: ${preserved}`);
  console.log(`7. Original tracker untouched: ${inputUntouched ? "YES (sha256 matches)" : "NO — DANGER"}`);
  console.log(`8. Formula integrity:      ${formulaDeltas.length === 0 ? "OK (no unexpected formula changes)" : `FAIL — ${formulaDeltas.length} unexpected formula changes (see run.json)`}`);
  console.log(`9. Dashboard #VALUE risk:  ${dashGuard.entries.length} Dashboard formulas wrapped in IFERROR(...,"") as a defensive safety net (compute-time errors now render as blank, never #VALUE!). Workbook calcProperties.fullCalcOnLoad=true so Excel performs a full recalc on open instead of trusting stale cached results.`);
  console.log(`10. Consolidated KPI:      formula-protected — its data cells reference KPI by Quarter and recalc when Excel opens the file. Only typo-fix label cells (A10:A12) and the Noor block (rows 28-30, below "Total Achieved") were written. A pre-flight collision check guards rows 28-30 — if a future template revision occupies them, the Noor consolidated block aborts with a clear message instead of overwriting anything.`);
  console.log(`11. KPI by Quarter:        Impressions/Visits weekly cells received mock values (only where existing value was empty or a placeholder 0). Existing wishlist formulas (rows 3,7,11,15 etc.) were never touched.`);
  console.log(`12. Noor added:            ${noor.alreadyPresent ? "ALREADY PRESENT (no-op)" : "YES — new Noor_WL sheet, KPI block at rows 70+, Consolidated rows 28-30, Dashboard L6"}`);
  const typoTotal = typoEntries.filter((e) => e.status === "write").length + typoSweep.entries.length;
  const sweepFormulaCount = typoSweep.rewrittenFormulaAddrs.length;
  const sweepTextCount = typoSweep.entries.length - sweepFormulaCount;
  console.log(`13. Putania→Petunia typo:  fixed ${typoTotal} cells in the COPIED output only (${typoEntries.filter((e) => e.status === "write").length} targeted label cells + ${sweepTextCount} sweep text cells + ${sweepFormulaCount} sweep Dashboard-formula literals; "putania" remains as internal source-code alias only)`);
  console.log(`\nInspect changelog: head -n 20 ${targets.changelogMd}`);
  console.log(`Filter by status:  jq -r 'select(.status=="write")' ${targets.changelogJsonl}`);
}

main().catch((err) => {
  console.error("[tracker:dry-run] FATAL:", err);
  process.exit(1);
});
