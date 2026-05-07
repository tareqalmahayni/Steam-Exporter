// Cell writer: takes a mock pull result + the game map and writes:
//   • Daily WL rows (Adds, Deletes, Purchases, Gifts) by appending to the
//     bottom of each WL sheet — never overwriting existing dated rows.
//   • Weekly KPI by Quarter Impressions/Visits cells — bucketed by the
//     week-ending Sunday header value.
//
// All writes go through cellOps.attemptWrite, which enforces the safety
// guards. Returns a flat array of changelog entries.

import type { Workbook, Worksheet } from "exceljs";
import { GAMES, type GameId, type GameMap, type Quarter } from "./map.js";
import { quarterOf } from "./dateWindow.js";
import type { MockPullResult } from "./mockPull.js";
import { attemptWrite, stringifyCell } from "./cellOps.js";
import type { ChangeEntry } from "./changelog.js";

export function applyMockPull(
  wb: Workbook,
  pull: MockPullResult,
  noorMap: GameMap | null,
  forceRefresh: boolean,
): ChangeEntry[] {
  const entries: ChangeEntry[] = [];
  const allGames: GameMap[] = [...Object.values(GAMES), ...(noorMap ? [noorMap] : [])];

  for (const game of allGames) {
    // 1) WL daily rows — append-only.
    const wl = wb.getWorksheet(game.wlSheet);
    if (!wl) {
      entries.push(blockEntry(game.wlSheet, "—", game.id, "WL sheet missing — validation gap"));
      continue;
    }
    entries.push(...applyWlAppendOnly(wl, game, pull.perGame[game.id], forceRefresh));

    // 2) KPI by Quarter Impressions / Visits weekly cells.
    entries.push(...applyKpiWeekly(wb, game, pull.perGame[game.id], forceRefresh));
  }
  return entries;
}

/** Append-only WL writer. Looks up the row for each ISO date; if a row exists
 *  we treat it as historical and (without --force-refresh) skip. If the date
 *  is not present at all, we append a new row at the bottom of the sheet. */
function applyWlAppendOnly(
  wl: Worksheet,
  game: GameMap,
  pull: { daily: { dateIso: string; adds: number; deletes: number; purchases: number; gifts: number }[] },
  forceRefresh: boolean,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  // Build a quick index of existing date → row. Track the last row containing
  // ANY content too, so when we append we don't accidentally overwrite a row
  // that has non-date content (e.g. notes columns) below the last dated row.
  const dateToRow = new Map<string, number>();
  let lastDatedRow = 1;
  const last = wl.rowCount;
  for (let r = 2; r <= last; r++) {
    const v = wl.getRow(r).getCell(1).value;
    let iso: string | null = null;
    if (v instanceof Date) iso = v.toISOString().slice(0, 10);
    else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) iso = v.slice(0, 10);
    if (iso) {
      dateToRow.set(iso, r);
      lastDatedRow = r;
    }
  }
  // Append below the absolute end of the sheet (rowCount) AND below the last
  // dated row, whichever is greater. This protects against orphan content
  // sitting below the last dated row.
  let lastRowWithData = Math.max(wl.rowCount, lastDatedRow);

  for (const day of pull.daily) {
    const existingRow = dateToRow.get(day.dateIso);
    if (existingRow) {
      // Historical row — write only if --force-refresh.
      for (const [colLetter, value, metric] of [
        ["C", day.adds, "wl.adds"],
        ["D", day.deletes, "wl.deletes"],
        ["E", day.purchases, "wl.purchases"],
        ["F", day.gifts, "wl.gifts"],
      ] as const) {
        out.push(attemptWrite({
          sheet: wl.name,
          ws: wl,
          address: `${colLetter}${existingRow}`,
          newValue: value,
          game: game.id,
          metric,
          dateOrWeek: day.dateIso,
          forceRefresh,
        }));
      }
    } else {
      // Append a new row at the bottom (out-of-template-range — log as informational).
      lastRowWithData += 1;
      const newRow = lastRowWithData;
      wl.getCell(`A${newRow}`).value = day.dateIso;
      wl.getCell(`B${newRow}`).value = game.wlGameLabel;
      out.push(append("A", newRow, day.dateIso, "wl.date"));
      out.push(append("B", newRow, game.wlGameLabel, "wl.game"));
      out.push(attemptWrite({ sheet: wl.name, ws: wl, address: `C${newRow}`, newValue: day.adds, game: game.id, metric: "wl.adds", dateOrWeek: day.dateIso, forceRefresh }));
      out.push(attemptWrite({ sheet: wl.name, ws: wl, address: `D${newRow}`, newValue: day.deletes, game: game.id, metric: "wl.deletes", dateOrWeek: day.dateIso, forceRefresh }));
      out.push(attemptWrite({ sheet: wl.name, ws: wl, address: `E${newRow}`, newValue: day.purchases, game: game.id, metric: "wl.purchases", dateOrWeek: day.dateIso, forceRefresh }));
      out.push(attemptWrite({ sheet: wl.name, ws: wl, address: `F${newRow}`, newValue: day.gifts, game: game.id, metric: "wl.gifts", dateOrWeek: day.dateIso, forceRefresh }));
    }

    function append(col: string, row: number, value: string, metric: string): ChangeEntry {
      return {
        sheet: wl.name,
        cell: `${col}${row}`,
        oldValue: "",
        newValue: value,
        game: game.id,
        metric,
        dateOrWeek: day.dateIso,
        status: "write",
        reason: "appended new WL row (date not in template)",
      };
    }
  }
  return out;
}

/** Weekly KPI Impressions/Visits writer. */
function applyKpiWeekly(
  wb: Workbook,
  game: GameMap,
  pull: { traffic: { dateIso: string; impressions: number; visits: number }[] },
  forceRefresh: boolean,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const kpi = wb.getWorksheet("KPI by Quarter");
  if (!kpi) return out;

  // Aggregate traffic into weekly buckets per quarter.
  // Bucketing rule: read each game's quarter header row B..N for that quarter
  // (those are the week-ending Sunday strings, e.g. "4/5"). For each pulled day,
  // find the smallest header date that is >= the pulled date within the same
  // quarter. Sum impressions/visits into that bucket.
  const refYear = Number(pull.traffic[0]?.dateIso.slice(0, 4) ?? new Date().getUTCFullYear());

  for (const q of ["Q1", "Q2", "Q3", "Q4"] as Quarter[]) {
    const block = game.kpiQuarterRows[q];
    const headerCells: { col: string; iso: string }[] = [];
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"]) {
      const raw = kpi.getCell(`${col}${block.headerRow}`).value;
      const iso = parseHeaderDate(raw, refYear);
      if (iso) headerCells.push({ col, iso });
    }
    if (headerCells.length === 0) continue;
    headerCells.sort((a, b) => a.iso.localeCompare(b.iso));

    const weekly: Record<string, { impressions: number; visits: number }> = {};
    for (const day of pull.traffic) {
      if (quarterOf(day.dateIso) !== q) continue;
      const target = headerCells.find((h) => h.iso >= day.dateIso);
      if (!target) continue;
      weekly[target.col] = weekly[target.col] ?? { impressions: 0, visits: 0 };
      weekly[target.col].impressions += day.impressions;
      weekly[target.col].visits += day.visits;
    }

    for (const [col, totals] of Object.entries(weekly)) {
      const header = headerCells.find((h) => h.col === col)!;
      out.push(attemptWrite({
        sheet: "KPI by Quarter",
        ws: kpi,
        address: `${col}${block.impressionsRow}`,
        newValue: totals.impressions,
        game: game.id,
        metric: "impressions",
        dateOrWeek: `${header.iso} (${q})`,
        forceRefresh,
      }));
      out.push(attemptWrite({
        sheet: "KPI by Quarter",
        ws: kpi,
        address: `${col}${block.visitsRow}`,
        newValue: totals.visits,
        game: game.id,
        metric: "visits",
        dateOrWeek: `${header.iso} (${q})`,
        forceRefresh,
      }));
    }
  }
  return out;
}

function parseHeaderDate(raw: unknown, refYear: number): string | null {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const month = String(m[1]).padStart(2, "0");
      const day = String(m[2]).padStart(2, "0");
      return `${refYear}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  }
  if (typeof raw === "object" && raw && "result" in (raw as object)) {
    return parseHeaderDate((raw as { result: unknown }).result, refYear);
  }
  return null;
}

function blockEntry(sheet: string, cell: string, game: GameId, reason: string): ChangeEntry {
  return { sheet, cell, oldValue: "", newValue: "", game, metric: "—", dateOrWeek: "—", status: "block-mapping", reason };
}

// keep stringifyCell linked so unused-import lint stays quiet across modules
void stringifyCell;
