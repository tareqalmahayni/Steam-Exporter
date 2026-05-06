import ExcelJS from "exceljs";
import type { GameStats } from "./steamworks";

function sanitizeSheetName(name: string, existing: Set<string>): string {
  let safe = name
    .replace(/[/\\?*[\]:]/g, " ")
    .substring(0, 31)
    .trim();

  if (existing.has(safe)) {
    let i = 2;
    const base = safe.substring(0, 28);
    while (existing.has(`${base} ${i}`)) i++;
    safe = `${base} ${i}`;
  }

  existing.add(safe);
  return safe;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F0FF" },
  };
  row.border = {
    bottom: { style: "thin", color: { argb: "FF4A90D9" } },
  };
}

function addSection(
  sheet: ExcelJS.Worksheet,
  title: string,
  headers: string[],
  rows: Record<string, string | number>[],
  naValue = "n/a"
) {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 12 };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5C" } };
  titleRow.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  sheet.addRow([]);

  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  if (rows.length === 0) {
    const naRow = sheet.addRow([naValue]);
    naRow.font = { italic: true, color: { argb: "FF888888" } };
  } else {
    for (const row of rows) {
      const values = headers.map((h) => {
        const key = h.toLowerCase().replace(/ /g, "_");
        const val = row[key] ?? row[h] ?? row[h.toLowerCase()] ?? "";
        if (val === "" || val === null || val === undefined) return naValue;
        if (typeof val === "string" && val.trim() === "") return naValue;
        return val;
      });
      const dataRow = sheet.addRow(values);
      dataRow.eachCell((cell) => {
        if (cell.value === "0" || cell.value === 0) {
          cell.value = "—";
        }
      });
    }
  }

  sheet.addRow([]);
}

export async function generateExcel(
  stats: GameStats[],
  granularity: string,
  skippedApps: Array<{ appId: number; name: string; type: string }>,
  gameErrors: Array<{ appId: number; gameName: string; error: string }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Steamworks Exporter";
  workbook.created = new Date();

  const sheetNames = new Set<string>();

  const summarySheet = workbook.addWorksheet("Summary");
  sheetNames.add("Summary");

  summarySheet.columns = [
    { width: 30 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  const summaryHeader = summarySheet.addRow([
    "Game",
    "Wishlist Net",
    "Store Visits",
    "Impressions",
    "Followers Added",
    "Units Sold",
    "Gross Revenue",
  ]);
  styleHeaderRow(summaryHeader);
  summarySheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const game of stats) {
    const wishlistBalance = game.wishlistData?.reduce((sum, r) => {
      const v = typeof r.balance === "string" ? parseInt(r.balance, 10) : r.balance;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const visits = game.visitsData?.reduce((sum, r) => {
      const v = typeof r.visits === "string" ? parseInt(r.visits as string, 10) : r.visits;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const impressions = game.visitsData?.reduce((sum, r) => {
      const v =
        typeof r.impressions === "string"
          ? parseInt(r.impressions as string, 10)
          : r.impressions;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const followersAdded = game.followersData?.reduce((sum, r) => {
      const v =
        typeof r.followers_added === "string"
          ? parseInt(r.followers_added as string, 10)
          : r.followers_added;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const units = game.salesData?.reduce((sum, r) => {
      const v = typeof r.units === "string" ? parseInt(r.units as string, 10) : r.units;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const grossRevenue = game.salesData?.reduce((sum, r) => {
      const v =
        typeof r.gross_revenue === "string"
          ? parseFloat(r.gross_revenue as string)
          : r.gross_revenue;
      return sum + (isNaN(v as number) ? 0 : (v as number));
    }, 0) ?? "n/a";

    const row = summarySheet.addRow([
      game.gameName,
      wishlistBalance,
      visits,
      impressions,
      followersAdded,
      units,
      typeof grossRevenue === "number" ? grossRevenue : "n/a",
    ]);

    if (typeof grossRevenue === "number") {
      row.getCell(7).numFmt = '"$"#,##0.00';
    }
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0";
  }

  const totalsRow = summarySheet.addRow(["TOTALS", ...Array(6).fill(null)]);
  totalsRow.font = { bold: true };
  totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0B2" } };

  for (const game of stats) {
    const sheetName = sanitizeSheetName(game.gameName, sheetNames);
    const gameSheet = workbook.addWorksheet(sheetName);
    gameSheet.views = [{ state: "frozen", ySplit: 1 }];
    gameSheet.columns = [{ width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

    addSection(
      gameSheet,
      "Wishlists",
      ["Date", "Adds", "Deletes", "Purchases & Gifts", "Balance"],
      (game.wishlistData || []).map((r) => ({
        Date: r.date,
        Adds: r.adds,
        Deletes: r.deletes,
        "Purchases & Gifts": r.purchases,
        Balance: r.balance,
      }))
    );

    addSection(
      gameSheet,
      "Visits & Impressions",
      ["Date", "Visits", "Unique Visitors", "Impressions"],
      (game.visitsData || []).map((r) => ({
        Date: r.date,
        Visits: r.visits,
        "Unique Visitors": r.unique_visitors,
        Impressions: r.impressions,
      }))
    );

    addSection(
      gameSheet,
      "Traffic Breakdown",
      ["Source", "Visits", "Unique Visitors"],
      (game.trafficData || []).map((r) => ({
        Source: r.source,
        Visits: r.visits,
        "Unique Visitors": r.unique_visitors,
      }))
    );

    addSection(
      gameSheet,
      "Sales",
      ["Date", "Units", "Gross Revenue", "Net Revenue"],
      (game.salesData || []).map((r) => ({
        Date: r.date,
        Units: r.units,
        "Gross Revenue": r.gross_revenue,
        "Net Revenue": r.net_revenue,
      }))
    );

    addSection(
      gameSheet,
      "Followers",
      ["Date", "Followers Added", "Total Followers"],
      (game.followersData || []).map((r) => ({
        Date: r.date,
        "Followers Added": r.followers_added,
        "Total Followers": r.total_followers,
      }))
    );

    if (game.reviewsData) {
      addSection(
        gameSheet,
        "Reviews (Snapshot)",
        ["Positive", "Negative", "Score"],
        [
          {
            Positive: game.reviewsData.positive,
            Negative: game.reviewsData.negative,
            Score: game.reviewsData.score,
          },
        ]
      );
    } else {
      addSection(gameSheet, "Reviews (Snapshot)", ["Positive", "Negative", "Score"], []);
    }

    if (game.errors.length > 0) {
      gameSheet.addRow(["Errors during pull:"]).font = { bold: true, color: { argb: "FFCC0000" } };
      for (const err of game.errors) {
        gameSheet.addRow([err]);
      }
    }
  }

  const infoSheet = workbook.addWorksheet("Pull Info");
  sheetNames.add("Pull Info");
  infoSheet.columns = [{ width: 24 }, { width: 60 }];

  const now = new Date();
  infoSheet.addRow(["Date Pulled", now.toISOString().split("T")[0]]);
  infoSheet.addRow(["Granularity", granularity]);
  infoSheet.addRow(["Games Included", stats.map((g) => g.gameName).join(", ")]);
  infoSheet.addRow([
    "Skipped (Demo/Playtest)",
    skippedApps.map((a) => `${a.name} (${a.appId})`).join(", ") || "None",
  ]);
  infoSheet.addRow([
    "Per-game Errors",
    gameErrors.length > 0
      ? gameErrors.map((e) => `${e.gameName}: ${e.error}`).join("\n")
      : "None",
  ]);

  const headerStyle = infoSheet.getRow(1);
  headerStyle.font = { bold: true };

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
