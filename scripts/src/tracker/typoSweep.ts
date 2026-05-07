// Final typo cleanup sweep — replaces visible "Putania's Purgatory" with
// "Petunia's Purgatory" everywhere it still appears in the COPIED workbook
// after the targeted typoFix module has run. Covers two cases the targeted
// module doesn't:
//   1) Plain-text cells (string / richText / sharedString) on ANY sheet that
//      still contain "Putania" — e.g. Consolidated KPI D18/D23.
//   2) Formula cells on Dashboard whose formula TEXT embeds the literal
//      "Putania's Purgatory" inside an IF(...) — e.g. E9, E31, the dropdown
//      branches in row 6, weekly KPI rows. These are visible because Excel
//      shows the literal string when the user picks "Petunia's Purgatory"
//      from the dropdown — the formula must compare against the new label.
//
// Internal aliases in source code (the "putania" game id, mapping comments)
// are intentionally untouched per user requirement.
//
// Returns addresses of formula cells that were rewritten so the caller can
// pass them into the formula-integrity allow-list.

import type { Workbook, Worksheet, Cell } from "exceljs";
import type { ChangeEntry } from "./changelog.js";

const FROM = "Putania's Purgatory";
const TO = "Petunia's Purgatory";

export interface TypoSweepResult {
  entries: ChangeEntry[];
  rewrittenFormulaAddrs: string[]; // sheet-qualified, e.g. "Dashboard!E9"
}

export function applyTypoSweep(wb: Workbook): TypoSweepResult {
  const entries: ChangeEntry[] = [];
  const rewrittenFormulaAddrs: string[] = [];

  for (const ws of wb.worksheets) {
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        if (!v) continue;

        // Case 1: formula cell — only Dashboard, only when formula text
        // contains the literal. Other sheets' formulas are left untouched as
        // a safety boundary: we do not rewrite raw-data-sheet formulas.
        if (typeof v === "object" && "formula" in (v as object)) {
          if (ws.name !== "Dashboard") continue;
          const oldF = (v as { formula: string }).formula;
          if (!oldF || !oldF.includes(FROM)) continue;
          const newF = oldF.split(FROM).join(TO);
          (v as { formula: string }).formula = newF;
          cell.value = v as never;
          rewrittenFormulaAddrs.push(`${ws.name}!${cell.address}`);
          entries.push(mk(ws, cell, `=${oldF}`, `=${newF}`, "typo-sweep: rewrote Dashboard formula literal Putania → Petunia"));
          continue;
        }

        // Case 2: plain string.
        if (typeof v === "string") {
          if (!v.includes("Putania")) continue;
          const newS = v.split("Putania").join("Petunia");
          cell.value = newS;
          entries.push(mk(ws, cell, v, newS, "typo-sweep: rewrote visible label Putania → Petunia"));
          continue;
        }

        // Case 3: rich text.
        if (typeof v === "object" && "richText" in (v as object) && Array.isArray((v as { richText: unknown[] }).richText)) {
          const rt = (v as { richText: Array<{ text?: string; font?: unknown }> }).richText;
          let touched = false;
          const oldStr = rt.map((p) => p.text ?? "").join("");
          if (!oldStr.includes("Putania")) continue;
          for (const part of rt) {
            if (part.text && part.text.includes("Putania")) {
              part.text = part.text.split("Putania").join("Petunia");
              touched = true;
            }
          }
          if (touched) {
            const newStr = rt.map((p) => p.text ?? "").join("");
            cell.value = v as never;
            entries.push(mk(ws, cell, oldStr, newStr, "typo-sweep: rewrote rich-text label Putania → Petunia"));
          }
          continue;
        }

        // Case 4: object wrapper carrying a `text` field (e.g. hyperlink
        // cells `{ text, hyperlink, tooltip }` or other derived-text shapes).
        // We mutate ONLY the `text` field in place to preserve every other
        // property (hyperlink target, tooltip, styling refs, etc.). Do NOT
        // coerce to a plain string — that would strip the link.
        if (typeof v === "object" && "text" in (v as object) && !("formula" in (v as object)) && !("richText" in (v as object))) {
          const wrapper = v as { text: unknown };
          const t = wrapper.text;
          if (typeof t === "string" && t.includes("Putania")) {
            const newT = t.split("Putania").join("Petunia");
            wrapper.text = newT;
            cell.value = v as never;
            entries.push(mk(ws, cell, t, newT, "typo-sweep: rewrote text-wrapper label Putania → Petunia (preserved hyperlink/metadata)"));
          }
        }
      }
    }
  }

  return { entries, rewrittenFormulaAddrs };
}

function mk(ws: Worksheet, cell: Cell, oldV: string, newV: string, reason: string): ChangeEntry {
  return {
    sheet: ws.name,
    cell: cell.address,
    oldValue: oldV,
    newValue: newV,
    game: "petunia",
    metric: "label",
    dateOrWeek: "—",
    status: "write",
    reason,
  };
}
