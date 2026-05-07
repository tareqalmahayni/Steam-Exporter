// Adds "Noor" as the 5th game in the copied output workbook.
// Idempotent: detects existing Noor structures and skips cleanly.
//
// What we add (and ONLY what we add):
//   • New worksheet "Noor_WL" with the same A1:I1 header row as other WL sheets.
//     We do NOT pre-populate any data rows — the writer (with mock data) fills
//     daily rows as new appends, never overwriting historical values.
//   • A 5th KPI block on "KPI by Quarter" appended below row 68. For each
//     quarter we add 4 rows: header (game + 13 weekly date strings + WoW% + Total),
//     Wishlists row (with the same SUMIF/SUMIFS formula pattern as other games),
//     Impressions row (zeros placeholder), Visits row (zeros placeholder).
//   • A new Consolidated KPI 3-row block (Wishlists / Impressions / Visits)
//     appended below row 16, each cell pointing at the matching KPI by Quarter
//     cell with the same pattern as the other games.
//   • A Dashboard L-column entry "Noor" at the next free row in the game-list
//     range L2:L5.

import type { Workbook, Worksheet } from "exceljs";
import type { ChangeEntry } from "./changelog.js";
import { stringifyCell } from "./cellOps.js";
import type { GameMap } from "./map.js";

const NOOR_NAME = "Noor";
const NOOR_WL_SHEET = "Noor_WL";

const Q_DATE_HEADERS: Record<"Q1" | "Q2" | "Q3" | "Q4", string[]> = {
  Q1: ["1/4", "1/11", "1/18", "1/25", "2/1", "2/8", "2/15", "2/22", "3/1", "3/8", "3/15", "3/22", "3/29"],
  Q2: ["4/5", "4/12", "4/19", "4/26", "5/3", "5/10", "5/16", "5/23", "5/30", "6/6", "6/13", "6/20", "6/27"],
  Q3: ["7/4", "7/11", "7/18", "7/25", "8/1", "8/8", "8/15", "8/22", "8/29", "9/5", "9/12", "9/19", "9/26"],
  Q4: ["10/3", "10/10", "10/17", "10/24", "10/31", "11/7", "11/14", "11/21", "11/28", "12/5", "12/12", "12/19", "12/26"],
};

const COL_LETTERS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"]; // 13 weekly cols

/** Run the Noor add. Returns the per-cell changelog and (on success) a
 *  GameMap entry for "noor" so the writer can target it like any other game. */
export interface NoorAddResult {
  entries: ChangeEntry[];
  noorMap: GameMap | null; // null if Noor already present
  alreadyPresent: boolean;
}

export function addNoor(wb: Workbook): NoorAddResult {
  const entries: ChangeEntry[] = [];
  const log = (sheet: string, cell: string, oldV: string, newV: string, status: ChangeEntry["status"], reason: string, metric = "structure", dateOrWeek = "—"): void => {
    entries.push({ sheet, cell, oldValue: oldV, newValue: newV, game: "noor", metric, dateOrWeek, status, reason: `add-noor: ${reason}` });
  };

  // 1) WL sheet
  if (wb.getWorksheet(NOOR_WL_SHEET)) {
    log(NOOR_WL_SHEET, "—", "(sheet exists)", "(sheet exists)", "skip-existing-manual", "Noor_WL already present");
    return { entries, noorMap: null, alreadyPresent: true };
  }
  const wlSheet = wb.addWorksheet(NOOR_WL_SHEET);
  const headers = ["DateLocal", "Game", "Adds", "Deletes", "Purchases And Activations", "Gifts", "Net Wishlist", "Weekly Net", "Monthly Net"];
  for (let i = 0; i < headers.length; i++) {
    const addr = `${String.fromCharCode(65 + i)}1`;
    wlSheet.getCell(addr).value = headers[i];
    log(NOOR_WL_SHEET, addr, "", headers[i], "write", "WL header row");
  }

  // 2) KPI by Quarter — append 4 quarter blocks at the bottom (rows 70+).
  const kpi = wb.getWorksheet("KPI by Quarter");
  if (!kpi) throw new Error("KPI by Quarter sheet missing — validation should have caught this");

  // Find the next free row after row 68. Be a few rows generous.
  const startRow = 70;
  const blocksByQuarter: Record<"Q1" | "Q2" | "Q3" | "Q4", { headerRow: number; wishlistsRow: number; impressionsRow: number; visitsRow: number }> = {
    Q1: { headerRow: startRow, wishlistsRow: startRow + 1, impressionsRow: startRow + 2, visitsRow: startRow + 3 },
    Q2: { headerRow: startRow + 5, wishlistsRow: startRow + 6, impressionsRow: startRow + 7, visitsRow: startRow + 8 },
    Q3: { headerRow: startRow + 10, wishlistsRow: startRow + 11, impressionsRow: startRow + 12, visitsRow: startRow + 13 },
    Q4: { headerRow: startRow + 15, wishlistsRow: startRow + 16, impressionsRow: startRow + 17, visitsRow: startRow + 18 },
  };

  // For each quarter: header row, wishlists row (formula), impressions row (empty — writer fills), visits row (empty — writer fills)
  for (const q of ["Q1", "Q2", "Q3", "Q4"] as const) {
    const block = blocksByQuarter[q];
    const dates = Q_DATE_HEADERS[q];

    // Header row: A=NOOR_NAME, B..N=dates, O=WoW%, P=Total
    setLog(kpi, `A${block.headerRow}`, NOOR_NAME, "header label");
    for (let i = 0; i < COL_LETTERS.length; i++) setLog(kpi, `${COL_LETTERS[i]}${block.headerRow}`, dates[i], `header date col ${i + 1}`);
    setLog(kpi, `O${block.headerRow}`, "WoW%", "header WoW%");
    setLog(kpi, `P${block.headerRow}`, "Total", "header Total");

    // Wishlists row: A=label + formulas. We DO write formulas here because we
    // are constructing the new structure (this is not editing an existing
    // formula). Pattern follows the established SUMIF/SUMIFS template.
    setLog(kpi, `A${block.wishlistsRow}`, "Wishlists", "metric label");
    // First column: cumulative-up-to-week formula. Subsequent columns: range formula.
    const wlSheetRef = `'${NOOR_WL_SHEET}'`;
    const headerCellRef = (col: string) => `${col}${block.headerRow}`;
    for (let i = 0; i < COL_LETTERS.length; i++) {
      const col = COL_LETTERS[i];
      let formula: string;
      if (i === 0) {
        // Cumulative up to first week-ending Sunday. Mirrors first-week pattern in Q1 of existing games (e.g. row 3 col B).
        formula = `SUMIF(${wlSheetRef}!$A:$A,"<="&${headerCellRef("B")},${wlSheetRef}!$H:$H)`;
      } else {
        const prev = COL_LETTERS[i - 1];
        formula = `SUMIFS(${wlSheetRef}!$H:$H,${wlSheetRef}!$A:$A,">"&${headerCellRef(prev)},${wlSheetRef}!$A:$A,"<="&${headerCellRef(col)})`;
      }
      setFormulaLog(kpi, `${col}${block.wishlistsRow}`, formula, `wishlists formula ${col}`);
    }
    setFormulaLog(kpi, `P${block.wishlistsRow}`, `SUM(B${block.wishlistsRow}:N${block.wishlistsRow})`, "wishlists Total formula");

    // Impressions / Visits rows: just labels + Total formula. Weekly cells
    // start empty so the writer can fill them with mock numbers.
    setLog(kpi, `A${block.impressionsRow}`, "Impressions", "metric label");
    setFormulaLog(kpi, `P${block.impressionsRow}`, `SUM(B${block.impressionsRow}:N${block.impressionsRow})`, "impressions Total formula");
    setLog(kpi, `A${block.visitsRow}`, "Visits", "metric label");
    setFormulaLog(kpi, `P${block.visitsRow}`, `SUM(B${block.visitsRow}:N${block.visitsRow})`, "visits Total formula");
  }

  // 3) Consolidated KPI — append a 3-row block. The first 17 rows are the
  //    main data block. Rows 18-21 are the "Latest WoW%" section, 23-26 are
  //    the "Total Achieved" section, and rows G18:K22 are filler text. Putting
  //    Noor at row 18 collides with Latest WoW%, so we go below the entire
  //    used region (row 28+ — row 27 left blank as a visual separator).
  const cons = wb.getWorksheet("Consolidated KPI");
  if (!cons) throw new Error("Consolidated KPI sheet missing — validation should have caught this");
  const consStart = 28;
  const consRows = { wishlists: consStart, impressions: consStart + 1, visits: consStart + 2 };
  // Pre-flight: every cell we are about to touch in the Consolidated KPI Noor
  // block MUST be empty in the input. If anything is populated, refuse to
  // write anything in this sheet (so we never silently corrupt a future
  // template revision that has reused these rows).
  const consTargets: string[] = [];
  consTargets.push(`A${consRows.wishlists}`, `A${consRows.impressions}`, `A${consRows.visits}`);
  for (const col of [...COL_LETTERS, "O", "P", "Q", "R"]) {
    consTargets.push(`${col}${consRows.wishlists}`, `${col}${consRows.impressions}`, `${col}${consRows.visits}`);
  }
  const consCollisions = consTargets.filter((addr) => {
    const v = cons.getCell(addr).value;
    return v !== null && v !== undefined && v !== "";
  });
  if (consCollisions.length > 0) {
    log("Consolidated KPI", consCollisions.join(","), "(collision)", "(skipped)", "block-mapping",
      `refusing to write Noor consolidated block at rows ${consStart}-${consStart + 2}: ${consCollisions.length} target cells are non-empty (${consCollisions.slice(0, 5).join(",")}${consCollisions.length > 5 ? "…" : ""}). Update consStart in addNoor.ts.`);
    // Skip the consolidated block, but still continue to Dashboard write.
    setLog(dashOrThrow(wb), "L6", NOOR_NAME, "dashboard game-list entry");
    return { entries, noorMap: null, alreadyPresent: false };
  }
  setLog(cons, `A${consRows.wishlists}`, `${NOOR_NAME} - Wishlists`, "consolidated label");
  setLog(cons, `A${consRows.impressions}`, `${NOOR_NAME} - Impressions`, "consolidated label");
  setLog(cons, `A${consRows.visits}`, `${NOOR_NAME} - Visits`, "consolidated label");
  // Map columns B..R to KPI rows. Existing pattern: B..N=Q1 (cols B..N of KPI), O..R=Q2 (cols B..E of KPI).
  for (let i = 0; i < COL_LETTERS.length; i++) {
    const col = COL_LETTERS[i];
    setFormulaLog(cons, `${col}${consRows.wishlists}`, `'KPI by Quarter'!${col}${blocksByQuarter.Q1.wishlistsRow}`, "consolidated wishlists ref");
    setFormulaLog(cons, `${col}${consRows.impressions}`, `'KPI by Quarter'!${col}${blocksByQuarter.Q1.impressionsRow}`, "consolidated impressions ref");
    setFormulaLog(cons, `${col}${consRows.visits}`, `'KPI by Quarter'!${col}${blocksByQuarter.Q1.visitsRow}`, "consolidated visits ref");
  }
  // O..R = Q2 first 4 weeks (B..E of KPI Q2 block)
  const q2Cols = ["B", "C", "D", "E"];
  const consQ2Cols = ["O", "P", "Q", "R"];
  for (let i = 0; i < 4; i++) {
    setFormulaLog(cons, `${consQ2Cols[i]}${consRows.wishlists}`, `'KPI by Quarter'!${q2Cols[i]}${blocksByQuarter.Q2.wishlistsRow}`, "consolidated Q2 wishlists ref");
    setFormulaLog(cons, `${consQ2Cols[i]}${consRows.impressions}`, `'KPI by Quarter'!${q2Cols[i]}${blocksByQuarter.Q2.impressionsRow}`, "consolidated Q2 impressions ref");
    setFormulaLog(cons, `${consQ2Cols[i]}${consRows.visits}`, `'KPI by Quarter'!${q2Cols[i]}${blocksByQuarter.Q2.visitsRow}`, "consolidated Q2 visits ref");
  }

  // 4) Dashboard L-column entry. Existing list is L1=All Games, L2=Taival, L3=Colossus, L4=Putania→Petunia, L5=Fleet Breakers. Append at L6.
  setLog(dashOrThrow(wb), "L6", NOOR_NAME, "dashboard game-list entry");

  const noorMap: GameMap = {
    id: "noor",
    canonicalName: NOOR_NAME,
    wlGameLabel: NOOR_NAME,
    wlSheet: NOOR_WL_SHEET,
    kpiQuarterRows: blocksByQuarter,
    consolidatedRows: consRows,
  };
  return { entries, noorMap, alreadyPresent: false };

  function setLog(ws: Worksheet, addr: string, value: string | number, reason: string): void {
    const old = ws.getCell(addr).value;
    if (old !== null && old !== undefined && old !== "") {
      log(ws.name, addr, stringifyCell(old), stringifyCell(value), "skip-existing-manual", `cell already populated; ${reason}`);
      return;
    }
    ws.getCell(addr).value = value;
    log(ws.name, addr, "", stringifyCell(value), "write", reason);
  }
  function setFormulaLog(ws: Worksheet, addr: string, formula: string, reason: string): void {
    const old = ws.getCell(addr).value;
    if (old !== null && old !== undefined && old !== "") {
      log(ws.name, addr, stringifyCell(old), `=${formula}`, "skip-existing-manual", `cell already populated; ${reason}`);
      return;
    }
    ws.getCell(addr).value = { formula, result: undefined } as never;
    log(ws.name, addr, "", `=${formula}`, "write", reason);
  }
}

function dashOrThrow(wb: Workbook): Worksheet {
  const dash = wb.getWorksheet("Dashboard");
  if (!dash) throw new Error("Dashboard sheet missing — validation should have caught this");
  return dash;
}
