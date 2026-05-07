// Dashboard #VALUE! safety net.
//
// Wraps every Dashboard formula that isn't already wrapped in IFERROR(...,"")
// so that any compute-time error (e.g. arithmetic on an empty-string result
// from an inner IF, dynamic-array engine differences) renders as a clean
// blank cell instead of #VALUE!. Pure safety net: when the wrapped formula
// would have computed a real number, IFERROR is transparent — no fake 0s,
// no behavior change for the happy path.
//
// Returns the list of cell addresses whose formulas were rewritten so the
// caller can pass them into the formula-integrity allow-list (these are the
// ONE intentional exception to "never overwrite a pre-existing formula").

import type { Workbook } from "exceljs";
import type { ChangeEntry } from "./changelog.js";

const DASHBOARD = "Dashboard";

export interface DashboardGuardResult {
  entries: ChangeEntry[];
  rewrittenAddrs: string[]; // sheet-qualified, e.g. "Dashboard!A6"
}

export function applyDashboardGuard(wb: Workbook): DashboardGuardResult {
  const entries: ChangeEntry[] = [];
  const rewrittenAddrs: string[] = [];

  const ws = wb.getWorksheet(DASHBOARD);
  if (!ws) return { entries, rewrittenAddrs };

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (!v || typeof v !== "object" || !("formula" in (v as object))) continue;

      const original = (v as { formula: string }).formula;
      if (!original || original.trim() === "") continue;

      // Skip if already error-guarded.
      if (/^\s*IFERROR\s*\(/i.test(original)) continue;

      // Skip pure cell references like 'Consolidated KPI'!B1 — these can't
      // produce #VALUE! on their own; wrapping adds noise without benefit.
      if (isPureCellRef(original)) continue;

      const wrapped = `IFERROR(${original},"")`;
      cell.value = { formula: wrapped } as never;

      rewrittenAddrs.push(`${DASHBOARD}!${cell.address}`);
      entries.push({
        sheet: DASHBOARD,
        cell: cell.address,
        oldValue: `=${original}`,
        newValue: `=${wrapped}`,
        game: "—",
        metric: "structure",
        dateOrWeek: "—",
        status: "write",
        reason: "dashboard-error-guard: wrap in IFERROR(...,\"\") so compute-time errors render as blank instead of #VALUE!",
      });
    }
  }

  return { entries, rewrittenAddrs };
}

function isPureCellRef(formula: string): boolean {
  // Matches:  A1   $A$1   'Sheet Name'!A1   SheetName!$A$1
  return /^\s*(?:'[^']+'|[A-Za-z_][A-Za-z0-9_]*)?!?\$?[A-Z]+\$?\d+\s*$/.test(formula);
}
