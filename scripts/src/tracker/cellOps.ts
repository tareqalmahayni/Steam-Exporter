// Low-level guarded cell operations on an exceljs Worksheet.
// All writes go through `attemptWrite` so guards 9, 10, 15 are enforced
// in one place.

import type { Worksheet } from "exceljs";
import type { ChangeEntry, ChangeStatus } from "./changelog.js";

export interface WriteRequest {
  sheet: string;
  ws: Worksheet;
  address: string;
  newValue: number | string;
  game: string;
  metric: string;
  dateOrWeek: string;
  forceRefresh: boolean;
  /** Real-data path: a numeric 0 IS allowed because Steam reported a true zero.
   *  Default false (mock-pull keeps the conservative behavior). */
  allowRealZero?: boolean;
}

export function attemptWrite(req: WriteRequest): ChangeEntry {
  const cell = req.ws.getCell(req.address);
  const oldRaw = cell.value;

  // §10 Never write fake 0 / na / blank / "-".
  if (req.newValue === null || req.newValue === undefined) {
    return entry("skip-empty", "incoming value is null/undefined", req, oldRaw, req.newValue);
  }
  if (typeof req.newValue === "string") {
    const t = req.newValue.trim();
    if (t === "" || t === "-" || /^n\.?\/?a$/i.test(t)) {
      return entry("skip-na", `incoming string is empty/n-a/dash ("${t}")`, req, oldRaw, req.newValue);
    }
  }
  if (typeof req.newValue === "number" && req.newValue === 0 && !req.allowRealZero) {
    return entry("skip-zero", "incoming number is 0", req, oldRaw, req.newValue);
  }

  // §15 Never write to a formula cell.
  if (oldRaw && typeof oldRaw === "object" && "formula" in (oldRaw as object)) {
    return entry("skip-formula-target", "target is a formula cell", req, oldRaw, req.newValue);
  }

  // §9 Preserve existing manual non-empty values unless --force-refresh.
  // Special policy: literal `0` on KPI by Quarter Impressions/Visits is treated
  // as a placeholder (those rows are pre-filled with 0s for unfilled weeks),
  // and IS eligible to overwrite. Everywhere else, 0 is a real manual entry
  // (e.g. 0 deletes that day on a WL sheet) and IS preserved.
  const isPlaceholderZero =
    req.sheet === "KPI by Quarter" &&
    (req.metric === "impressions" || req.metric === "visits") &&
    typeof oldRaw === "number" && oldRaw === 0;

  const isExistingManual = oldRaw !== null && oldRaw !== undefined && oldRaw !== "" && !isPlaceholderZero;
  if (isExistingManual && !req.forceRefresh) {
    return entry("skip-existing-manual", "preserve existing manual value (use --force-refresh to override)", req, oldRaw, req.newValue);
  }

  cell.value = req.newValue as never;
  return entry("write", isPlaceholderZero ? "overwrote placeholder 0" : "wrote into empty cell", req, oldRaw, req.newValue);
}

function entry(
  status: ChangeStatus,
  reason: string,
  req: WriteRequest,
  oldRaw: unknown,
  newValue: unknown,
): ChangeEntry {
  return {
    sheet: req.sheet,
    cell: req.address,
    oldValue: stringifyCell(oldRaw),
    newValue: stringifyCell(newValue),
    game: req.game,
    metric: req.metric,
    dateOrWeek: req.dateOrWeek,
    status,
    reason,
  };
}

export function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("formula" in o) return `=${o.formula as string}`;
    if ("result" in o) return String(o.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ("text" in o) return String(o.text);
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((p) => p.text ?? "").join("");
    }
    return JSON.stringify(v);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
