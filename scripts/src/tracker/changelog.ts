// Change-log entry types + serializers (JSONL + markdown table).

import { writeFileSync } from "node:fs";

export type ChangeStatus =
  | "write"
  | "skip-existing-manual"
  | "skip-zero"
  | "skip-na"
  | "skip-empty"
  | "skip-formula-target"
  | "skip-out-of-range"
  | "block-mapping";

export interface ChangeEntry {
  sheet: string;
  cell: string;
  oldValue: string; // stringified for display + diff
  newValue: string;
  game: string;
  metric: string; // wishlists | impressions | visits | label | structure
  dateOrWeek: string; // ISO date or "M/D" week label or "—"
  status: ChangeStatus;
  reason: string;
}

export function writeChangelogJsonl(entries: ChangeEntry[], path: string): void {
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
}

export function writeChangelogMarkdown(entries: ChangeEntry[], path: string): void {
  const header = "| Sheet | Cell | Game | Metric | Date/Week | Old | New | Status | Reason |";
  const sep = "|---|---|---|---|---|---|---|---|---|";
  const rows = entries.map((e) =>
    `| ${esc(e.sheet)} | ${e.cell} | ${esc(e.game)} | ${e.metric} | ${esc(e.dateOrWeek)} | ${esc(e.oldValue)} | ${esc(e.newValue)} | ${e.status} | ${esc(e.reason)} |`,
  );
  writeFileSync(path, [header, sep, ...rows].join("\n") + "\n", "utf8");
}

function esc(s: string): string {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function summarize(entries: ChangeEntry[]): Record<ChangeStatus, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.status] = (out[e.status] ?? 0) + 1;
  return out as Record<ChangeStatus, number>;
}
