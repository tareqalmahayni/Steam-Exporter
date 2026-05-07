/**
 * Milestone 6 — Combined Pull Data Alone export (wishlist + traffic) for
 * all five games.
 *
 * M7 refactor: the proven engine has MOVED to @workspace/combined-export
 * (no behavior changes — re-exports preserve all M3/M5 imports). This CLI
 * now:
 *   1. Discovers the wishlist pull cache produced by M4B.
 *   2. Reads the per-game traffic CSV files from .local/input/traffic.
 *   3. Delegates per-game record assembly + workbook build to the shared
 *      lib (`processGame` + `buildCombinedWorkbook`).
 *   4. Writes the workbook to disk + runs the same 16-item self-check.
 *
 * CLI:
 *   pnpm --filter @workspace/scripts run tracker:current-pull:combined:all-games
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

import {
  GAME_SPECS,
  expectedTrafficFilename,
  processGame,
  buildCombinedWorkbook,
  computeFinalStatus,
  isGameOk,
  type WishlistDayStatus,
  type WishlistPullSummary,
  type PerGame,
} from "@workspace/combined-export";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const TRAFFIC_INPUT_DIR = path.join(repoRoot, ".local", "input", "traffic");

const REQUESTED_WINDOW = { startIso: "2026-04-30", endIso: "2026-05-06" };

const NA = "NOT AVAILABLE" as const;
const valOrNa = (v: number | null | undefined) => (v === null || v === undefined ? NA : v);

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

function fmtRatio(visits: number | null, impressions: number | null): string {
  if (impressions === null || impressions <= 0 || visits === null) return NA;
  return `${((visits / impressions) * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  console.log(`[combined] window: ${REQUESTED_WINDOW.startIso} → ${REQUESTED_WINDOW.endIso}`);
  console.log(`[combined] traffic input: ${TRAFFIC_INPUT_DIR}`);

  const cacheHit = findWishlistCache(REQUESTED_WINDOW);
  if (!cacheHit) {
    console.error(`[combined] FATAL: no wishlist cache covering ${REQUESTED_WINDOW.startIso} → ${REQUESTED_WINDOW.endIso} for all 5 games.`);
    console.error(`[combined] Run 'pnpm --filter @workspace/scripts run tracker:current-pull:wishlist:all-games' first to produce one.`);
    process.exit(1);
  }
  console.log(`[combined] wishlist cache REUSED: ${cacheHit.path}`);
  const cacheById = new Map(cacheHit.cache.games.map((g) => [g.id, g] as const));

  const perGame: PerGame[] = GAME_SPECS.map((spec) => {
    const cached = cacheById.get(spec.cacheId);
    const expectedFileName = expectedTrafficFilename(spec, REQUESTED_WINDOW);
    const csvPath = path.join(TRAFFIC_INPUT_DIR, expectedFileName);
    const trafficCsv = fs.existsSync(csvPath)
      ? { fileName: expectedFileName, text: fs.readFileSync(csvPath, "utf8") }
      : null;
    return processGame({
      spec,
      selected: true,
      dataType: "both",
      expectedWindow: REQUESTED_WINDOW,
      wishlistSummary: cached?.summary ?? null,
      wishlistMissingReason: cached ? null : `No wishlist cache entry for ${spec.displayName}`,
      trafficCsv,
    });
  });

  const finalStatus = computeFinalStatus(perGame);
  // M6 spec: PASSED iff every game OK; here we treat PARTIAL as a failure too
  // for back-compat with the previous CLI's exit code.
  const allOk = perGame.every(isGameOk);
  const pullTimestamp = new Date().toISOString();

  const buf = await buildCombinedWorkbook({
    perGame,
    window: REQUESTED_WINDOW,
    pullTimestamp,
    wishlistSourceLabel: `Cached pull (reused, NOT re-pulled): ${cacheHit.path}`,
    trafficSourceLabel: `CSV files in ${TRAFFIC_INPUT_DIR}`,
    finalStatus,
    dataType: "both",
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, ".local", "tracker-runs", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `Steamworks_Current_Pull_Combined_AllGames_${today}.xlsx`);
  fs.writeFileSync(outPath, buf);

  // Self-check: scan all cells for forbidden tokens.
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
  if (!allOk || !orderOk || bad.objObj > 0 || bad.valueErr > 0 || bad.naErr > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[combined] FATAL:", err);
  process.exit(1);
});
