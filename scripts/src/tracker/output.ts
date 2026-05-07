// Output orchestrator + formula-integrity check + sha256 verification.

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Workbook } from "exceljs";

export function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export interface CopyTarget {
  outputDir: string;
  outputXlsx: string;
  changelogJsonl: string;
  changelogMd: string;
  runJson: string;
}

export function prepareOutputPaths(rootDir: string): CopyTarget {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(rootDir, ".local", "tracker-runs", stamp);
  mkdirSync(outputDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  return {
    outputDir,
    outputXlsx: path.join(outputDir, `Steamworks_Tracker_DRY_RUN_${today}.xlsx`),
    changelogJsonl: path.join(outputDir, "changelog.jsonl"),
    changelogMd: path.join(outputDir, "changelog.md"),
    runJson: path.join(outputDir, "run.json"),
  };
}

export function copyTemplateBytes(srcPath: string, destPath: string): void {
  copyFileSync(srcPath, destPath);
}

export async function loadWorkbook(p: string): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  return wb;
}

/** Compares formula cells between input and output workbooks; returns a list
 *  of unexpected formula changes. Cells whose addresses are in `allowList`
 *  are exempted (used for the typo-fix and Noor-add cells). */
export interface FormulaDelta {
  sheet: string;
  cell: string;
  before: string;
  after: string;
}

export function checkFormulaIntegrity(
  before: Workbook,
  after: Workbook,
  allowList: ReadonlySet<string>,
): FormulaDelta[] {
  const deltas: FormulaDelta[] = [];
  for (const sheetBefore of before.worksheets) {
    const sheetAfter = after.getWorksheet(sheetBefore.name);
    if (!sheetAfter) continue;
    for (let r = 1; r <= sheetBefore.rowCount; r++) {
      const rowBefore = sheetBefore.getRow(r);
      const rowAfter = sheetAfter.getRow(r);
      for (let c = 1; c <= sheetBefore.columnCount; c++) {
        const vb = rowBefore.getCell(c).value;
        if (!isFormula(vb)) continue;
        const va = rowAfter.getCell(c).value;
        const fb = (vb as { formula: string }).formula;
        const fa = isFormula(va) ? (va as { formula: string }).formula : "(non-formula)";
        const addr = `${sheetBefore.name}!${rowBefore.getCell(c).address}`;
        if (allowList.has(addr)) continue;
        if (fb === fa) continue;
        // Sanctioned transformations on Dashboard (handles merged-cell slaves
        // automatically without enumerating every slave address):
        //   (1) #VALUE! safety net wraps formulas in IFERROR(<original>,"")
        //   (2) typo sweep replaces "Putania's Purgatory" → "Petunia's Purgatory"
        //   (3) both transforms applied together (typo inside IFERROR wrap)
        if (sheetBefore.name === "Dashboard") {
          const fbTypoFixed = fb.split("Putania's Purgatory").join("Petunia's Purgatory");
          if (fa === fbTypoFixed) continue;
          if (fa === `IFERROR(${fb},"")`) continue;
          if (fa === `IFERROR(${fbTypoFixed},"")`) continue;
        }
        deltas.push({ sheet: sheetBefore.name, cell: rowBefore.getCell(c).address, before: fb, after: fa });
      }
    }
  }
  return deltas;
}

function isFormula(v: unknown): v is { formula: string } {
  return !!v && typeof v === "object" && "formula" in (v as object);
}
