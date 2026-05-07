// Putania → Petunia typo fix, in the copied output workbook only.
// Touches the five known label cells and logs each one.

import type { Workbook } from "exceljs";
import { TYPO_FIX_TARGETS } from "./map.js";
import { stringifyCell } from "./cellOps.js";
import type { ChangeEntry } from "./changelog.js";

export function applyTypoFix(wb: Workbook, forceRefresh: boolean): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  for (const target of TYPO_FIX_TARGETS) {
    const ws = wb.getWorksheet(target.sheet);
    if (!ws) {
      out.push(mk(target, "", "", "skip-existing-manual", `sheet "${target.sheet}" not found`));
      continue;
    }
    const cell = ws.getCell(target.address);
    const old = cell.value;
    // Refuse formula cells (defense in depth).
    if (old && typeof old === "object" && "formula" in (old as object)) {
      out.push(mk(target, stringifyCell(old), stringifyCell(old), "skip-formula-target", "label cell is a formula — refusing"));
      continue;
    }
    const oldStr = stringifyCell(old);
    if (!oldStr.includes("Putania")) {
      out.push(mk(target, oldStr, oldStr, "skip-existing-manual", forceRefresh ? "no Putania substring; nothing to fix" : "no Putania substring; nothing to fix"));
      continue;
    }
    const newStr = oldStr.replace(/Putania/g, "Petunia");
    cell.value = newStr;
    out.push(mk(target, oldStr, newStr, "write", "Putania → Petunia"));
  }
  return out;
}

function mk(t: { sheet: string; address: string }, oldV: string, newV: string, status: ChangeEntry["status"], reason: string): ChangeEntry {
  return {
    sheet: t.sheet,
    cell: t.address,
    oldValue: oldV,
    newValue: newV,
    game: "petunia",
    metric: "label",
    dateOrWeek: "—",
    status,
    reason: `typo-fix: ${reason}`,
  };
}
