// Raw_Wishlist_API + Raw_Traffic sheet writers (Milestone 3).
//
// Raw_Wishlist_API: one row per pulled date, exposing every parsed numeric
// field plus the per-date status and message. Used for human auditability —
// the tracker writer is the product, this sheet is the receipt.
//
// Raw_Traffic: explicit "NOT PULLED" stub so reviewers don't mistake
// "missing" for "zero". Traffic (impressions/visits) is out of scope this
// milestone.

import type { Workbook } from "exceljs";
import type { WishlistDayResult } from "../realPull/steamWishlist.js";

const RAW_WL_HEADERS = [
  "Date", "Game", "AppID",
  "Adds", "Deletes", "Purchases And Activations", "Gifts",
  "Windows Adds", "Mac Adds", "Linux Adds",
  "Net Wishlist",
  "Country Summary Present", "Language Summary Present",
  "Source", "Status", "Message",
] as const;

export function writeRawWishlistApi(
  wb: Workbook,
  rows: Array<{ gameLabel: string; day: WishlistDayResult }>,
): void {
  const name = "Raw_Wishlist_API";
  const existing = wb.getWorksheet(name);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(name);
  ws.getRow(1).values = [...RAW_WL_HEADERS];
  ws.getRow(1).font = { bold: true };

  for (let i = 0; i < rows.length; i++) {
    const { gameLabel, day } = rows[i];
    ws.getRow(i + 2).values = [
      day.dateIso,
      gameLabel,
      day.appid,
      day.adds ?? "n/a",
      day.deletes ?? "n/a",
      day.purchases ?? "n/a",
      day.gifts ?? "n/a",
      day.addsWindows ?? "n/a",
      day.addsMac ?? "n/a",
      day.addsLinux ?? "n/a",
      day.net ?? "n/a",
      day.countrySummaryPresent ? "YES" : "NO",
      day.languageSummaryPresent ? "YES" : "NO",
      "Steam Partner Financial API",
      day.status,
      day.message,
    ];
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 10;
  for (let c = 4; c <= 11; c++) ws.getColumn(c).width = 10;
  ws.getColumn(12).width = 12;
  ws.getColumn(13).width = 12;
  ws.getColumn(14).width = 26;
  ws.getColumn(15).width = 22;
  ws.getColumn(16).width = 60;
}

export function writeRawTrafficStub(wb: Workbook): void {
  const name = "Raw_Traffic";
  const existing = wb.getWorksheet(name);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(name);
  ws.getRow(1).values = ["Status", "Reason"];
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).values = [
    "NOT PULLED",
    "Traffic (impressions/visits) is out of scope for Milestone 3. Wishlist API only.",
  ];
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 90;
}
