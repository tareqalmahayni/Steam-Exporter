/**
 * Pure workbook builder for the combined Pull Data Alone report.
 *
 * Takes a fully-assembled `PerGame[]` (from `processGame`) plus a window
 * and metadata, and returns an XLSX `Buffer`. NO filesystem I/O — used by
 * both the M6 CLI (which writes the buffer to disk) and the M7 API server
 * (which streams the buffer back to the browser).
 *
 * Sheet order (M6 spec):
 *   1. Executive Summary
 *   2. Game Comparison
 *   3..N. <Selected game sheets, in spec order>
 *   N+1. Raw_Wishlist_API
 *   N+2. Raw_Traffic
 *   N+3. Validation
 *   N+4. Pull Log
 */

import ExcelJS, { type Workbook } from "exceljs";
import { calculateCtr } from "./traffic.js";
import { isGameOk, type PerGame } from "./processGame.js";

const NA = "NOT AVAILABLE" as const;

function valOrNa(v: number | null | undefined): number | typeof NA {
  return v === null || v === undefined ? NA : v;
}

function fmtRatio(visits: number | null, impressions: number | null): string {
  const c = calculateCtr(visits, impressions);
  return c === null ? NA : `${(c * 100).toFixed(2)}%`;
}

export type FinalStatus = "PASSED" | "PARTIAL" | "FAILED";

export function computeFinalStatus(perGame: PerGame[]): FinalStatus {
  if (perGame.length === 0) return "FAILED";
  const okCount = perGame.filter(isGameOk).length;
  if (okCount === perGame.length) return "PASSED";
  if (okCount === 0) return "FAILED";
  return "PARTIAL";
}

export interface BuildWorkbookOptions {
  perGame: PerGame[];
  window: { startIso: string; endIso: string };
  pullTimestamp: string;
  /** Free-text description of where the wishlist data came from. */
  wishlistSourceLabel: string;
  /** Free-text description of where the traffic CSVs came from. */
  trafficSourceLabel: string;
  /** Pre-computed final status. */
  finalStatus: FinalStatus;
  /** Which data was actually requested. */
  dataType: "wishlist" | "traffic" | "both";
  /** Total games BEFORE selection (for context). Optional. */
  totalGamesAvailable?: number;
}

export async function buildCombinedWorkbook(opts: BuildWorkbookOptions): Promise<Buffer> {
  const { perGame, window, pullTimestamp, wishlistSourceLabel, trafficSourceLabel, finalStatus, dataType } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = "steamworks-combined-export";
  wb.created = new Date();

  writeExecutiveSummary(wb, perGame, window, finalStatus, pullTimestamp, dataType);
  writeGameComparison(wb, perGame);
  for (const g of perGame) writeGameSheet(wb, g, window);
  writeRawWishlistApi(wb, perGame);
  writeRawTraffic(wb, perGame);
  writeValidation(wb, perGame, window, wishlistSourceLabel, trafficSourceLabel, finalStatus, pullTimestamp, dataType);
  writePullLog(wb, perGame, wishlistSourceLabel, pullTimestamp);

  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 12000, height: 24000, firstSheet: 0, visibility: "visible" }];

  verifyNoForbiddenTokens(wb);

  const arrayBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuf as ArrayBuffer);
}

function verifyNoForbiddenTokens(wb: Workbook): void {
  const FORBIDDEN = new Set(["[object Object]", "undefined", "null", "#VALUE!", "#VALUE", "#N/A"]);
  const offenders: string[] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow((row, rIdx) => row.eachCell((cell, cIdx) => {
      const v = cell.value;
      const s = typeof v === "string" ? v : (v == null ? "" : String(v));
      if (FORBIDDEN.has(s)) {
        offenders.push(`${ws.name}!${cell.address ?? `R${rIdx}C${cIdx}`}="${s}"`);
      }
    }));
  }
  if (offenders.length > 0) {
    throw new Error(`Workbook contains forbidden tokens (${offenders.length}): ${offenders.slice(0, 5).join(", ")}${offenders.length > 5 ? ", ..." : ""}`);
  }
}

function writeExecutiveSummary(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string }, finalStatus: FinalStatus, pullTimestamp: string, dataType: string): void {
  const ws = wb.addWorksheet("Executive Summary");

  ws.getCell("A1").value = "Steamworks Combined Pull Report";
  ws.getCell("A1").font = { bold: true, size: 16 };

  let r = 3;
  const meta: Array<[string, string | number]> = [
    ["Date range", `${window.startIso} → ${window.endIso}`],
    ["Pull timestamp", pullTimestamp],
    ["Data type", dataType],
    ["Total games included", perGame.length],
    ["Wishlist data source", "Steam Partner Financial API"],
    ["Traffic data source", "Steam App Traffic CSV exports"],
    ["Overall status", finalStatus],
  ];
  for (const [k, v] of meta) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  ws.getCell(`A${r}`).value = "Per-game summary";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const headers = [
    "Game", "AppID",
    "Wishlist net", "Public visits", "Public impressions", "Visit/Impression",
    "Wishlist status", "Traffic status",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(r, i + 1);
    c.value = headers[i];
    c.font = { bold: true };
  }
  r++;
  for (const g of perGame) {
    const t = g.trafficTotals;
    ws.getCell(r, 1).value = g.spec.displayName;
    ws.getCell(r, 2).value = g.spec.appid;
    ws.getCell(r, 3).value = valOrNa(g.wishlistTotals.net);
    ws.getCell(r, 4).value = t ? t.publicVisits : NA;
    ws.getCell(r, 5).value = t ? t.publicImpressions : NA;
    ws.getCell(r, 6).value = t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA;
    ws.getCell(r, 7).value = g.wishlistStatus;
    ws.getCell(r, 8).value = g.trafficStatus;
    r++;
  }

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 12;
  for (let c = 3; c <= 8; c++) ws.getColumn(c).width = 20;
}

function writeGameComparison(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Game Comparison");
  const headers = [
    "Game", "AppID",
    "Wishlist adds", "Wishlist deletes", "Net wishlist change",
    "Public impressions", "Public visits", "Visit-to-impression ratio",
    "Owner visits", "Bot visits",
    "Wishlist status", "Traffic status", "Warnings",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(1, i + 1);
    c.value = headers[i];
    c.font = { bold: true };
  }
  let r = 2;
  for (const g of perGame) {
    const t = g.trafficTotals;
    ws.getCell(r, 1).value = g.spec.displayName;
    ws.getCell(r, 2).value = g.spec.appid;
    ws.getCell(r, 3).value = valOrNa(g.wishlistTotals.adds);
    ws.getCell(r, 4).value = valOrNa(g.wishlistTotals.deletes);
    ws.getCell(r, 5).value = valOrNa(g.wishlistTotals.net);
    ws.getCell(r, 6).value = t ? t.publicImpressions : NA;
    ws.getCell(r, 7).value = t ? t.publicVisits : NA;
    ws.getCell(r, 8).value = t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA;
    ws.getCell(r, 9).value = t ? t.ownerVisits : NA;
    ws.getCell(r, 10).value = t ? t.botVisits : NA;
    ws.getCell(r, 11).value = g.wishlistStatus;
    ws.getCell(r, 12).value = g.trafficStatus;
    ws.getCell(r, 13).value = g.warnings.length === 0 ? "(none)" : g.warnings.join("; ");
    r++;
  }
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 10;
  for (let c = 3; c <= 12; c++) ws.getColumn(c).width = 18;
  ws.getColumn(13).width = 80;
}

function writeGameSheet(wb: Workbook, g: PerGame, window: { startIso: string; endIso: string }): void {
  const ws = wb.addWorksheet(g.spec.displayName);
  let r = 1;

  ws.getCell(`A${r}`).value = "SECTION A — GAME OVERVIEW";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const t = g.trafficTotals;
  const overview: Array<[string, string | number]> = [
    ["Game", g.spec.displayName],
    ["AppID", g.spec.appid],
    ["Date range", `${window.startIso} → ${window.endIso}`],
    ["Wishlist adds", valOrNa(g.wishlistTotals.adds)],
    ["Wishlist deletes", valOrNa(g.wishlistTotals.deletes)],
    ["Wishlist purchases", valOrNa(g.wishlistTotals.purchases)],
    ["Wishlist gifts", valOrNa(g.wishlistTotals.gifts)],
    ["Net wishlist change", valOrNa(g.wishlistTotals.net)],
    ["Public impressions", t ? t.publicImpressions : NA],
    ["Public visits", t ? t.publicVisits : NA],
    ["Visit-to-impression ratio", t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA],
    ["Owner impressions", t ? t.ownerImpressions : NA],
    ["Owner visits", t ? t.ownerVisits : NA],
    ["Bot impressions", t ? t.botImpressions : NA],
    ["Bot visits", t ? t.botVisits : NA],
    ["Wishlist status", g.wishlistStatus],
    ["Traffic status", g.trafficStatus],
    ["Warnings", g.warnings.length === 0 ? "(none)" : g.warnings.join("; ")],
    ["Errors", g.errors.length === 0 ? "(none)" : g.errors.join("; ")],
  ];
  for (const [k, v] of overview) {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = v;
    r++;
  }
  r++;

  ws.getCell(`A${r}`).value = "SECTION B — DAILY WISHLIST DATA";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const dh = ["Date", "Adds", "Deletes", "Purchases", "Gifts", "Net", "Windows Adds", "Mac Adds", "Linux Adds", "Status", "Message"];
  for (let i = 0; i < dh.length; i++) { const c = ws.getCell(r, i + 1); c.value = dh[i]; c.font = { bold: true }; }
  r++;
  if (g.wishlistDaily.length === 0) {
    ws.getCell(`A${r}`).value = NA; r++;
  } else {
    for (const d of g.wishlistDaily) {
      const ok = d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM";
      ws.getCell(r, 1).value = d.dateIso;
      ws.getCell(r, 2).value = ok ? valOrNa(d.adds) : NA;
      ws.getCell(r, 3).value = ok ? valOrNa(d.deletes) : NA;
      ws.getCell(r, 4).value = ok ? valOrNa(d.purchases) : NA;
      ws.getCell(r, 5).value = ok ? valOrNa(d.gifts) : NA;
      ws.getCell(r, 6).value = ok ? valOrNa(d.net) : NA;
      ws.getCell(r, 7).value = ok ? valOrNa(d.addsWindows) : NA;
      ws.getCell(r, 8).value = ok ? valOrNa(d.addsMac) : NA;
      ws.getCell(r, 9).value = ok ? valOrNa(d.addsLinux) : NA;
      ws.getCell(r, 10).value = d.status;
      ws.getCell(r, 11).value = d.message;
      r++;
    }
  }
  r++;

  ws.getCell(`A${r}`).value = "SECTION C — TRAFFIC PAGE/SOURCE BREAKDOWN";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const ph = ["Source Category", "Source/Page Feature", "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits", "Is Bot"];
  for (let i = 0; i < ph.length; i++) { const c = ws.getCell(r, i + 1); c.value = ph[i]; c.font = { bold: true }; }
  r++;
  if (g.trafficStatus !== "REAL_DATA") {
    for (let i = 1; i <= ph.length; i++) ws.getCell(r, i).value = NA;
    ws.getCell(r, ph.length).value = g.trafficStatus;
    r++;
  } else {
    for (const a of g.trafficByPageSource) {
      ws.getCell(r, 1).value = a.category;
      ws.getCell(r, 2).value = a.feature;
      ws.getCell(r, 3).value = a.impressions;
      ws.getCell(r, 4).value = a.visits;
      ws.getCell(r, 5).value = a.ctr === null ? NA : `${(a.ctr * 100).toFixed(2)}%`;
      ws.getCell(r, 6).value = a.ownerImpressions;
      ws.getCell(r, 7).value = a.ownerVisits;
      ws.getCell(r, 8).value = a.isBot ? "YES" : "NO";
      r++;
    }
  }
  r++;

  ws.getCell(`A${r}`).value = "SECTION D — TRAFFIC COUNTRY BREAKDOWN";
  ws.getCell(`A${r}`).font = { bold: true };
  r++;
  const tch = ["Country Code", "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits"];
  for (let i = 0; i < tch.length; i++) { const c = ws.getCell(r, i + 1); c.value = tch[i]; c.font = { bold: true }; }
  r++;
  if (g.trafficStatus !== "REAL_DATA") {
    for (let i = 1; i <= tch.length; i++) ws.getCell(r, i).value = NA;
    r++;
  } else {
    for (const a of g.trafficByCountry) {
      ws.getCell(r, 1).value = a.countryCode;
      ws.getCell(r, 2).value = a.impressions;
      ws.getCell(r, 3).value = a.visits;
      ws.getCell(r, 4).value = a.ctr === null ? NA : `${(a.ctr * 100).toFixed(2)}%`;
      ws.getCell(r, 5).value = a.ownerImpressions;
      ws.getCell(r, 6).value = a.ownerVisits;
      r++;
    }
  }
  r++;

  if (g.countryRows.length > 0) {
    ws.getCell(`A${r}`).value = "SECTION E — WISHLIST COUNTRY BREAKDOWN";
    ws.getCell(`A${r}`).font = { bold: true };
    r++;
    const wch = ["Date", "Country Code", "Country Name", "Adds", "Deletes", "Purchases", "Gifts", "Net"];
    for (let i = 0; i < wch.length; i++) { const c = ws.getCell(r, i + 1); c.value = wch[i]; c.font = { bold: true }; }
    r++;
    for (const cr of g.countryRows) {
      ws.getCell(r, 1).value = cr.dateIso;
      ws.getCell(r, 2).value = cr.key;
      ws.getCell(r, 3).value = cr.label || NA;
      ws.getCell(r, 4).value = valOrNa(cr.adds);
      ws.getCell(r, 5).value = valOrNa(cr.deletes);
      ws.getCell(r, 6).value = valOrNa(cr.purchases);
      ws.getCell(r, 7).value = valOrNa(cr.gifts);
      ws.getCell(r, 8).value = valOrNa(cr.net);
      r++;
    }
    r++;
  }

  if (g.languageRows.length > 0) {
    ws.getCell(`A${r}`).value = "SECTION F — WISHLIST LANGUAGE BREAKDOWN";
    ws.getCell(`A${r}`).font = { bold: true };
    r++;
    const wlh = ["Date", "Language", "Adds", "Deletes", "Purchases", "Gifts", "Net"];
    for (let i = 0; i < wlh.length; i++) { const c = ws.getCell(r, i + 1); c.value = wlh[i]; c.font = { bold: true }; }
    r++;
    for (const lr of g.languageRows) {
      ws.getCell(r, 1).value = lr.dateIso;
      ws.getCell(r, 2).value = lr.label;
      ws.getCell(r, 3).value = valOrNa(lr.adds);
      ws.getCell(r, 4).value = valOrNa(lr.deletes);
      ws.getCell(r, 5).value = valOrNa(lr.purchases);
      ws.getCell(r, 6).value = valOrNa(lr.gifts);
      ws.getCell(r, 7).value = valOrNa(lr.net);
      r++;
    }
  }

  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 28;
  for (let c = 3; c <= 11; c++) ws.getColumn(c).width = 16;
}

function writeRawWishlistApi(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Raw_Wishlist_API");
  ws.getRow(1).values = [
    "Date", "Game", "AppID",
    "Adds", "Deletes", "Purchases", "Gifts",
    "Windows Adds", "Mac Adds", "Linux Adds", "Net",
    "Country Summary Present", "Language Summary Present",
    "HTTP", "Status", "Message",
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    if (g.wishlistDaily.length === 0) {
      ws.addRow(["NOT AVAILABLE", g.spec.displayName, g.spec.appid, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, g.wishlistStatus, "No daily data"]);
      continue;
    }
    for (const d of g.wishlistDaily) {
      ws.addRow([
        d.dateIso, g.spec.displayName, g.spec.appid,
        valOrNa(d.adds), valOrNa(d.deletes), valOrNa(d.purchases), valOrNa(d.gifts),
        valOrNa(d.addsWindows), valOrNa(d.addsMac), valOrNa(d.addsLinux), valOrNa(d.net),
        d.countrySummaryPresent ? "YES" : "NO",
        d.languageSummaryPresent ? "YES" : "NO",
        d.httpStatus ?? NA, d.status, d.message,
      ]);
    }
  }
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 10;
  for (let c = 4; c <= 13; c++) ws.getColumn(c).width = 14;
  ws.getColumn(14).width = 8;
  ws.getColumn(15).width = 22;
  ws.getColumn(16).width = 60;
}

function writeRawTraffic(wb: Workbook, perGame: PerGame[]): void {
  const ws = wb.addWorksheet("Raw_Traffic");
  ws.getRow(1).values = [
    "Game", "AppID", "Source Line", "Bucket",
    "Page / Category", "Page / Feature (raw)", "Page / Feature (display)",
    "Impressions", "Visits", "CTR", "Owner Impressions", "Owner Visits",
    "Is Bot", "Is Country",
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    if (g.trafficStatus !== "REAL_DATA") {
      ws.addRow([g.spec.displayName, g.spec.appid, NA, g.trafficStatus,
        NA, NA, NA, NA, NA, NA, NA, NA, NA, NA]);
      continue;
    }
    for (const r of g.trafficRows) {
      ws.addRow([
        g.spec.displayName, g.spec.appid, r.lineNumber,
        r.isCountry ? "Country" : (r.isBot ? "Bot" : "Page/Source"),
        r.pageCategory, r.pageFeature, r.pageFeatureDisplay,
        valOrNa(r.impressions), valOrNa(r.visits),
        fmtRatio(r.visits, r.impressions),
        valOrNa(r.ownerImpressions), valOrNa(r.ownerVisits),
        r.isBot ? "YES" : "NO", r.isCountry ? "YES" : "NO",
      ]);
    }
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 10;
  for (let c = 3; c <= 14; c++) ws.getColumn(c).width = 14;
  ws.getColumn(5).width = 30;
  ws.getColumn(6).width = 32;
  ws.getColumn(7).width = 32;
}

function writeValidation(wb: Workbook, perGame: PerGame[], window: { startIso: string; endIso: string }, wishlistSourceLabel: string, trafficSourceLabel: string, finalStatus: FinalStatus, pullTimestamp: string, dataType: string): void {
  const ws = wb.addWorksheet("Validation");
  ws.getRow(1).values = ["Field", "Value"];
  ws.getRow(1).font = { bold: true };
  let r = 2;
  const set = (k: string, v: string | number) => { ws.getRow(r).values = [k, v]; r++; };

  set("Export mode", "Pull Data Alone — Combined (Wishlist + Traffic)");
  set("Pull timestamp", pullTimestamp);
  set("Date range", `${window.startIso} → ${window.endIso}`);
  set("Data type", dataType);
  set("Wishlist data source", wishlistSourceLabel);
  set("Traffic data source", trafficSourceLabel);
  set("Total games included", perGame.length);
  set("Sheet order", `Executive Summary | Game Comparison | <${perGame.length} game sheets> | Raw_Wishlist_API | Raw_Traffic | Validation | Pull Log`);
  set("Wishlist data included", dataType !== "traffic" ? "YES" : "NO");
  set("Traffic data included", dataType !== "wishlist" ? "YES" : "NO");
  set("Old tracker history included", "NO");
  set("Dashboard included", "NO");
  set("Consolidated KPI included", "NO");
  set("KPI by Quarter included", "NO");
  set("CTR / Visit-to-impression method", "Visits / Impressions, only when Impressions > 0; else NOT AVAILABLE");
  set("Final status", finalStatus);
  r++;
  ws.getRow(r).values = ["--- Per game ---", ""]; ws.getRow(r).font = { bold: true }; r++;
  for (const g of perGame) {
    const t = g.trafficTotals;
    set(`${g.spec.displayName} — wishlist status`, g.wishlistStatus);
    set(`${g.spec.displayName} — traffic status`, g.trafficStatus);
    set(`${g.spec.displayName} — wishlist adds`, valOrNa(g.wishlistTotals.adds));
    set(`${g.spec.displayName} — wishlist deletes`, valOrNa(g.wishlistTotals.deletes));
    set(`${g.spec.displayName} — wishlist net`, valOrNa(g.wishlistTotals.net));
    set(`${g.spec.displayName} — traffic public impressions`, t ? t.publicImpressions : NA);
    set(`${g.spec.displayName} — traffic public visits`, t ? t.publicVisits : NA);
    set(`${g.spec.displayName} — visit/impression`, t ? fmtRatio(t.publicVisits, t.publicImpressions) : NA);
    set(`${g.spec.displayName} — owner impressions / visits`, t ? `${t.ownerImpressions} / ${t.ownerVisits}` : NA);
    set(`${g.spec.displayName} — bot impressions / visits`, t ? `${t.botImpressions} / ${t.botVisits}` : NA);
    set(`${g.spec.displayName} — wishlist country rows`, g.countryRows.length);
    set(`${g.spec.displayName} — wishlist language rows`, g.languageRows.length);
    set(`${g.spec.displayName} — traffic invalid rows`, g.trafficInvalid.length);
    set(`${g.spec.displayName} — warnings`, g.warnings.length === 0 ? "(none)" : g.warnings.join("; "));
    set(`${g.spec.displayName} — errors`, g.errors.length === 0 ? "(none)" : g.errors.join("; "));
    r++;
  }
  ws.getColumn(1).width = 56;
  ws.getColumn(2).width = 90;
}

function writePullLog(wb: Workbook, perGame: PerGame[], wishlistSourceLabel: string, pullTimestamp: string): void {
  const ws = wb.addWorksheet("Pull Log");
  ws.getRow(1).values = ["Timestamp", "Game", "Source", "Event", "Detail"];
  ws.getRow(1).font = { bold: true };
  for (const g of perGame) {
    ws.addRow([pullTimestamp, g.spec.displayName, "Wishlist", g.wishlistStatus, `${wishlistSourceLabel} | adds=${valOrNa(g.wishlistTotals.adds)} del=${valOrNa(g.wishlistTotals.deletes)} net=${valOrNa(g.wishlistTotals.net)}`]);
    for (const d of g.wishlistDaily) {
      ws.addRow([pullTimestamp, g.spec.displayName, "Wishlist", d.status, `${d.dateIso} HTTP=${d.httpStatus ?? NA} | adds=${valOrNa(d.adds)} del=${valOrNa(d.deletes)} pur=${valOrNa(d.purchases)} gifts=${valOrNa(d.gifts)} net=${valOrNa(d.net)}`]);
    }
    if (g.trafficStatus === "TRAFFIC_CSV_MISSING") {
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "MISSING_CSV", `Expected ${g.expectedTrafficFileName}`]);
    } else if (g.trafficStatus === "PARSE_FAILED") {
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "PARSE_FAILED", g.errors.filter((e) => e.startsWith("Traffic") || e.includes("AppID")).join("; ") || "Parse failed"]);
    } else if (g.trafficStatus === "TRAFFIC_NOT_REQUESTED") {
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "NOT_REQUESTED", "Data type did not include traffic"]);
    } else if (g.trafficTotals) {
      const t = g.trafficTotals;
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "READ_CSV", `Read ${g.trafficRows.length + g.trafficInvalid.length + 1} lines (1 header + ${g.trafficRows.length} data + ${g.trafficInvalid.length} invalid) from ${g.trafficSourceFileName}`]);
      ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "AGGREGATE", `pubI=${t.publicImpressions} pubV=${t.publicVisits} ownI=${t.ownerImpressions} ownV=${t.ownerVisits} botI=${t.botImpressions} botV=${t.botVisits}`]);
      for (const inv of g.trafficInvalid) ws.addRow([pullTimestamp, g.spec.displayName, "Traffic", "INVALID_ROW", `Line ${inv.lineNumber}: ${inv.reason}`]);
    }
    for (const w of g.warnings) ws.addRow([pullTimestamp, g.spec.displayName, "Combined", "WARN", w]);
    for (const e of g.errors) ws.addRow([pullTimestamp, g.spec.displayName, "Combined", "ERROR", e]);
  }
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 100;
}
