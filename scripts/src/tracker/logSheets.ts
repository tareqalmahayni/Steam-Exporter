// Writes the in-workbook "Validation" and "Pull Log" sheets in the output copy.

import type { Workbook } from "exceljs";
import type { ValidationCheck } from "./validate.js";
import type { ChangeEntry } from "./changelog.js";
import { summarize } from "./changelog.js";

export function writeValidationSheet(wb: Workbook, checks: ValidationCheck[]): void {
  const name = "Validation";
  let ws = wb.getWorksheet(name);
  if (ws) wb.removeWorksheet(ws.id);
  ws = wb.addWorksheet(name);
  ws.getRow(1).values = ["Check", "Pass", "Detail"];
  for (let i = 0; i < checks.length; i++) {
    ws.getRow(i + 2).values = [checks[i].name, checks[i].pass ? "PASS" : "FAIL", checks[i].detail];
  }
  ws.getColumn(1).width = 60;
  ws.getColumn(3).width = 80;
}

export interface PullLogRow {
  timestamp: string;
  mode: string;
  rangeLabel: string;
  seed: string;
  writes: number;
  skips: number;
  blocks: number;
  outputFile: string;
  inputSha256: string;
  outputSha256: string;
}

export function appendPullLog(wb: Workbook, row: PullLogRow): void {
  const name = "Pull Log";
  let ws = wb.getWorksheet(name);
  if (!ws) {
    ws = wb.addWorksheet(name);
    ws.getRow(1).values = [
      "Timestamp", "Mode", "Range", "Seed", "Writes", "Skips", "Blocks", "Output File", "Input SHA256", "Output SHA256",
    ];
    ws.getColumn(1).width = 22;
    ws.getColumn(3).width = 28;
    ws.getColumn(8).width = 60;
  }
  const next = ws.rowCount + 1;
  ws.getRow(next).values = [
    row.timestamp, row.mode, row.rangeLabel, row.seed, row.writes, row.skips, row.blocks, row.outputFile, row.inputSha256, row.outputSha256,
  ];
}

export function countByGroup(entries: ChangeEntry[]): { writes: number; skips: number; blocks: number } {
  const s = summarize(entries);
  let writes = 0, skips = 0, blocks = 0;
  for (const [k, v] of Object.entries(s)) {
    if (k === "write") writes += v;
    else if (k.startsWith("skip")) skips += v;
    else if (k.startsWith("block")) blocks += v;
  }
  return { writes, skips, blocks };
}
