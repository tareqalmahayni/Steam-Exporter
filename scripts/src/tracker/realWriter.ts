// Real-data wishlist writer (Milestone 3) — Colossus only.
//
// Writes daily wishlist values pulled from the official Steam Partner
// Financial API into the per-game WL sheet, using the same safety guards as
// the mock writer. Differences from writer.ts:
//   1. Only one game (Colossus). No KPI Impressions/Visits writes — those
//      are out of scope this milestone.
//   2. Real `0` from Steam IS a meaningful value, so attemptWrite is called
//      with `allowRealZero: true`. Never coerces a failed pull to 0.
//   3. Per-date refresh: when a date in the explicit pull range succeeds,
//      its row is overwritten (forceRefresh effectively true for that date).
//      Dates whose pull failed leave any existing values alone.
//   4. The KPI by Quarter weekly Wishlists row is a formula in the template
//      that references the WL sheet, so writing daily rows is sufficient —
//      Excel recomputes the weekly net on open (calcProperties.fullCalcOnLoad
//      is set in the CLI).

import type { Workbook, Worksheet } from "exceljs";
import { GAMES } from "./map.js";
import { attemptWrite } from "./cellOps.js";
import type { ChangeEntry } from "./changelog.js";
import type { WishlistDayResult } from "../realPull/steamWishlist.js";

export function applyRealWishlistColossus(
  wb: Workbook,
  daily: WishlistDayResult[],
): ChangeEntry[] {
  const game = GAMES.colossus;
  const wl = wb.getWorksheet(game.wlSheet);
  const out: ChangeEntry[] = [];
  if (!wl) {
    out.push({
      sheet: game.wlSheet,
      cell: "—",
      oldValue: "",
      newValue: "",
      game: game.id,
      metric: "wl.realdata",
      dateOrWeek: "—",
      status: "block-mapping",
      reason: `WL sheet "${game.wlSheet}" missing — validation gap`,
    });
    return out;
  }

  // Index existing dated rows.
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
  let appendCursor = Math.max(wl.rowCount, lastDatedRow);

  for (const day of daily) {
    const ok = day.status === "REAL_DATA" || day.status === "TRUE_ZERO_FROM_STEAM";
    if (!ok) {
      // §5: never overwrite manual values with failed values. Don't touch the row.
      out.push({
        sheet: wl.name,
        cell: "—",
        oldValue: "",
        newValue: "",
        game: game.id,
        metric: "wl.realdata",
        dateOrWeek: day.dateIso,
        status: "skip-na",
        reason: `Steam status ${day.status} — left existing row untouched (${day.message})`,
      });
      continue;
    }

    const existingRow = dateToRow.get(day.dateIso);
    const adds = day.adds ?? 0;
    const deletes = day.deletes ?? 0;
    const purchases = day.purchases ?? 0;
    const gifts = day.gifts ?? 0;

    if (existingRow) {
      out.push(...writeWlCells(wl, game.id, existingRow, day.dateIso, adds, deletes, purchases, gifts, /*refresh*/ true));
    } else {
      // Append at the bottom; A/B are template-readonly columns by convention,
      // so we set them directly (the row didn't exist).
      appendCursor += 1;
      const newRow = appendCursor;
      wl.getCell(`A${newRow}`).value = day.dateIso;
      wl.getCell(`B${newRow}`).value = game.wlGameLabel;
      out.push(append("A", newRow, day.dateIso, "wl.date", day.dateIso, game.id));
      out.push(append("B", newRow, game.wlGameLabel, "wl.game", day.dateIso, game.id));
      out.push(...writeWlCells(wl, game.id, newRow, day.dateIso, adds, deletes, purchases, gifts, /*refresh*/ true));
    }
  }

  return out;
}

function writeWlCells(
  wl: Worksheet,
  gameId: string,
  row: number,
  dateIso: string,
  adds: number,
  deletes: number,
  purchases: number,
  gifts: number,
  forceRefresh: boolean,
): ChangeEntry[] {
  const cells: Array<[string, number, string]> = [
    ["C", adds, "wl.adds"],
    ["D", deletes, "wl.deletes"],
    ["E", purchases, "wl.purchases"],
    ["F", gifts, "wl.gifts"],
  ];
  return cells.map(([col, value, metric]) =>
    attemptWrite({
      sheet: wl.name,
      ws: wl,
      address: `${col}${row}`,
      newValue: value,
      game: gameId,
      metric,
      dateOrWeek: dateIso,
      forceRefresh,
      allowRealZero: true,
    }),
  );
}

function append(col: string, row: number, value: string, metric: string, dateIso: string, gameId: string): ChangeEntry {
  return {
    sheet: "(wl)",
    cell: `${col}${row}`,
    oldValue: "",
    newValue: value,
    game: gameId,
    metric,
    dateOrWeek: dateIso,
    status: "write",
    reason: "appended new WL row (date not in template)",
  };
}
