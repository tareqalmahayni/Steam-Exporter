// Loader + validator for the input tracker workbook.
// Verifies the Tracker Map is still accurate against the on-disk template;
// blocks the run if any check fails.

import type { Workbook } from "exceljs";
import { GAMES, REQUIRED_SHEETS } from "./map.js";
import { stringifyCell } from "./cellOps.js";

export interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export function validateWorkbook(wb: Workbook): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const push = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  // 1) Required sheets exist.
  const sheetNames = wb.worksheets.map((s) => s.name);
  for (const required of REQUIRED_SHEETS) {
    push(`sheet exists: ${required}`, sheetNames.includes(required), `found sheets: ${sheetNames.join(", ")}`);
  }

  // 2) Each WL sheet has the canonical header row at row 1 and the canonical
  //    game label at column B row 2.
  for (const game of Object.values(GAMES)) {
    const ws = wb.getWorksheet(game.wlSheet);
    if (!ws) {
      push(`WL sheet load: ${game.wlSheet}`, false, "missing");
      continue;
    }
    const headerA = stringifyCell(ws.getCell("A1").value);
    const headerC = stringifyCell(ws.getCell("C1").value);
    push(
      `WL header A1/C1: ${game.wlSheet}`,
      headerA === "DateLocal" && headerC === "Adds",
      `A1="${headerA}" C1="${headerC}"`,
    );
    const gameLabel = stringifyCell(ws.getCell("B2").value);
    push(
      `WL game label B2: ${game.wlSheet}`,
      gameLabel === game.wlGameLabel,
      `expected "${game.wlGameLabel}", got "${gameLabel}"`,
    );
  }

  // 3) KPI by Quarter block headers in column A match expectations
  //    (typo "Putania" is expected and tolerated — typoFix will repair it
  //    in the output copy).
  const kpi = wb.getWorksheet("KPI by Quarter");
  if (!kpi) {
    push("KPI by Quarter present", false, "missing");
  } else {
    for (const game of Object.values(GAMES)) {
      for (const q of ["Q1", "Q2", "Q3", "Q4"] as const) {
        const r = game.kpiQuarterRows[q];
        const label = stringifyCell(kpi.getCell(`A${r.headerRow}`).value);
        const isPetuniaTypo = game.id === "petunia" && label === "Putania's Purgatory";
        const ok = label === game.canonicalName || isPetuniaTypo;
        push(
          `KPI block header A${r.headerRow} (${game.id} ${q})`,
          ok,
          `expected "${game.canonicalName}", got "${label}"`,
        );
        const wlCellA = stringifyCell(kpi.getCell(`A${r.wishlistsRow}`).value);
        const impA = stringifyCell(kpi.getCell(`A${r.impressionsRow}`).value);
        const visA = stringifyCell(kpi.getCell(`A${r.visitsRow}`).value);
        push(
          `KPI metric labels for ${game.id} ${q}`,
          wlCellA === "Wishlists" && impA === "Impressions" && visA === "Visits",
          `got ["${wlCellA}","${impA}","${visA}"]`,
        );
      }
    }
  }

  return checks;
}

export function validationPassed(checks: ValidationCheck[]): boolean {
  return checks.every((c) => c.pass);
}
