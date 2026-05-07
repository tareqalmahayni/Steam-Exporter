// Date-window resolver: turns a CLI --range argument into an explicit ISO
// window, plus the canonical week-end Sundays the tracker uses.
//
// Pure, no IO. The tracker template is anchored on calendar 2026; for this
// milestone we keep the year configurable but default to 2026 so the dry-run
// is reproducible regardless of "today".

import type { Quarter } from "./map.js";

export type RangePreset =
  | "today"
  | "previous-month"
  | "previous-year"
  | "lifetime"
  | { kind: "custom"; startIso: string; endIso: string };

export interface ResolvedRange {
  startIso: string; // YYYY-MM-DD inclusive
  endIso: string; // YYYY-MM-DD inclusive
  label: string;
}

export function parseRangeArg(arg: string | undefined): RangePreset {
  if (!arg || arg === "previous-month") return "previous-month";
  if (arg === "today" || arg === "previous-year" || arg === "lifetime") return arg;
  if (arg.startsWith("custom:")) {
    const parts = arg.split(":");
    if (parts.length !== 3) throw new Error(`Bad --range. Expected custom:<startISO>:<endISO>, got "${arg}"`);
    const [, startIso, endIso] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      throw new Error(`Bad ISO dates in --range. Got start="${startIso}" end="${endIso}"`);
    }
    if (startIso > endIso) throw new Error(`--range start (${startIso}) is after end (${endIso})`);
    return { kind: "custom", startIso, endIso };
  }
  throw new Error(`Unknown --range: "${arg}"`);
}

/** Returns inclusive ISO date window for a preset, anchored to the workbook's reference year. */
export function resolveRange(preset: RangePreset, refYear: number, today: Date): ResolvedRange {
  if (typeof preset === "object") {
    return { startIso: preset.startIso, endIso: preset.endIso, label: `custom ${preset.startIso} → ${preset.endIso}` };
  }
  if (preset === "today") {
    const iso = today.toISOString().slice(0, 10);
    return { startIso: iso, endIso: iso, label: `today (${iso})` };
  }
  if (preset === "lifetime") {
    return { startIso: `${refYear}-01-01`, endIso: `${refYear}-12-31`, label: `lifetime (${refYear})` };
  }
  if (preset === "previous-year") {
    const y = refYear - 1;
    return { startIso: `${y}-01-01`, endIso: `${y}-12-31`, label: `previous-year (${y})` };
  }
  // previous-month — anchored to refYear so dry-run is reproducible. If today's
  // year matches refYear we use today's month-1; otherwise default to April
  // (Q2) which lands in mostly-empty cells of the template.
  let month: number;
  let year: number;
  if (today.getUTCFullYear() === refYear) {
    const m = today.getUTCMonth(); // 0-indexed
    if (m === 0) { year = refYear - 1; month = 11; } else { year = refYear; month = m - 1; }
  } else {
    year = refYear;
    month = 3; // April (0-indexed)
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    label: `previous-month (${start.toISOString().slice(0, 7)})`,
  };
}

/** Which quarter does an ISO date belong to? */
export function quarterOf(iso: string): Quarter {
  const m = Number(iso.slice(5, 7));
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

/** Iterate every ISO date in the inclusive window. */
export function* daysInRange(startIso: string, endIso: string): Generator<string> {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}
