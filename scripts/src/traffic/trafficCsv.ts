/**
 * Milestone 5 — Traffic CSV import for the Steamworks Publisher Stats
 * Exporter. Parses Steam's "App Traffic" CSV export into typed rows, splits
 * Page/Source vs Country breakdowns, and aggregates totals.
 *
 * Strict rules (per spec):
 *  - Real CSV parsing (RFC 4180) — quoted values may contain commas.
 *  - UTF-8 BOM on the header is stripped.
 *  - AppID and date range come from the FILENAME, never invented.
 *  - "Country" rows are a separate breakdown — never double-counted into
 *    page-source totals.
 *  - "Bot Traffic" is preserved with is_bot=true.
 *  - Owner Impressions / Visits stay separate from public counters.
 *  - Blank Page/Feature renders as "(unknown)".
 *  - Missing values are NOT AVAILABLE — never coerced to fake 0.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Allowlist of Steam AppIDs the system supports. The 5 main publisher games. */
export const TRAFFIC_APP_ALLOWLIST: Record<string, string> = {
  "1722800": "Colossus - Eternal Blight",
  "2929040": "Fleetbreakers",
  "3152750": "Taival",
  "3728760": "Noor",
  "4009450": "Petunia's Purgatory",
};

/** Filename pattern: `traffic_<game>_<appid>_<startYYYYMMDD>_<endYYYYMMDD>.csv`. */
export interface ParsedTrafficFilename {
  ok: boolean;
  fileName: string;
  appid?: string;
  gameToken?: string;
  startIso?: string;
  endIso?: string;
  reason?: string;
}

export interface TrafficCsvParseResult {
  /** Headers as they appeared in the file (BOM stripped). */
  headers: string[];
  /** All raw rows, in source order. */
  rows: RawTrafficRow[];
  /** Lines that could not be parsed into a row (empty / wrong arity / etc). */
  invalidLines: Array<{ lineNumber: number; raw: string; reason: string }>;
}

/**
 * One row exactly as it appears in the CSV (after RFC-4180 parsing).
 * No interpretation, no coercion of missing → 0.
 */
export interface RawTrafficRow {
  lineNumber: number;
  pageCategory: string;
  pageFeature: string; // verbatim — may be "" or "(Other)"
  impressions: number | null;
  visits: number | null;
  ownerImpressions: number | null;
  ownerVisits: number | null;
}

/** A normalized row with semantic flags. */
export interface NormalizedTrafficRow extends RawTrafficRow {
  /** True iff pageCategory === "Country". Country rows feed Section C only. */
  isCountry: boolean;
  /** True iff pageCategory === "Bot Traffic". Kept, but flagged so they
   *  never get summed into "real visits". */
  isBot: boolean;
  /** When the raw feature cell is empty, surface as "(unknown)". */
  pageFeatureDisplay: string;
}

export interface PageSourceAggregate {
  category: string;
  feature: string;
  isBot: boolean;
  impressions: number;
  visits: number;
  ownerImpressions: number;
  ownerVisits: number;
  ctr: number | null;
}

export interface CountryAggregate {
  countryCode: string;
  impressions: number;
  visits: number;
  ownerImpressions: number;
  ownerVisits: number;
  ctr: number | null;
}

export interface WindowAggregate {
  publicImpressions: number;
  publicVisits: number;
  publicCtr: number | null;
  ownerImpressions: number;
  ownerVisits: number;
  botImpressions: number;
  botVisits: number;
  /** Number of page/source rows excluding Country and excluding Bot. */
  realPageSourceRowCount: number;
  /** Country row count. */
  countryRowCount: number;
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV parser (inline to avoid a new npm dep within the 1-day delay).
// Handles: quoted fields, doubled-quote escapes ("" → "), embedded commas,
// and embedded newlines inside quoted fields. Strips a leading UTF-8 BOM.
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue; // ignore CR; handle on LF
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  // Flush the last field/row if no trailing newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // Drop trailing fully-empty rows (a single "" cell from a trailing newline).
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === "") rows.pop();
    else break;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Format detection + parsing
// ---------------------------------------------------------------------------

const EXPECTED_HEADERS = [
  "Page / Category",
  "Page / Feature",
  "Impressions",
  "Visits",
  "Owner Impressions",
  "Owner Visits",
] as const;

export interface DetectFormatResult {
  ok: boolean;
  reason?: string;
  /** Normalized index of each expected header in the file, or -1 if missing. */
  columnIndexes: Record<typeof EXPECTED_HEADERS[number], number>;
}

export function detectTrafficCsvFormat(headers: string[]): DetectFormatResult {
  const trimmed = headers.map((h) => h.trim());
  const idx: Record<string, number> = {};
  for (const expected of EXPECTED_HEADERS) {
    idx[expected] = trimmed.findIndex((h) => h.toLowerCase() === expected.toLowerCase());
  }
  const missing = EXPECTED_HEADERS.filter((h) => idx[h] === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Missing required headers: ${missing.join(", ")}. Got: ${trimmed.join(" | ")}`,
      columnIndexes: idx as DetectFormatResult["columnIndexes"],
    };
  }
  return { ok: true, columnIndexes: idx as DetectFormatResult["columnIndexes"] };
}

/** Parse one numeric cell. Empty / non-numeric → null (never fake 0). */
function parseIntegerCell(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === "") return null;
  // Steam exports use plain integers in this column set.
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function parseTrafficCsv(filePath: string): TrafficCsvParseResult {
  const text = fs.readFileSync(filePath, "utf8");
  const grid = parseCsv(text);
  if (grid.length === 0) {
    return { headers: [], rows: [], invalidLines: [{ lineNumber: 0, raw: "", reason: "Empty file" }] };
  }
  const headers = grid[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  const fmt = detectTrafficCsvFormat(headers);
  if (!fmt.ok) {
    return { headers, rows: [], invalidLines: [{ lineNumber: 1, raw: grid[0].join(","), reason: fmt.reason ?? "Bad header" }] };
  }
  const rows: RawTrafficRow[] = [];
  const invalid: Array<{ lineNumber: number; raw: string; reason: string }> = [];
  for (let i = 1; i < grid.length; i++) {
    const line = grid[i];
    const lineNumber = i + 1; // 1-based, includes header line
    if (line.every((c) => c.trim() === "")) {
      invalid.push({ lineNumber, raw: line.join(","), reason: "Blank line" });
      continue;
    }
    if (line.length < EXPECTED_HEADERS.length) {
      invalid.push({ lineNumber, raw: line.join(","), reason: `Wrong column count (got ${line.length}, expected ${EXPECTED_HEADERS.length})` });
      continue;
    }
    const pageCategory = (line[fmt.columnIndexes["Page / Category"]] ?? "").trim();
    const pageFeature = line[fmt.columnIndexes["Page / Feature"]] ?? ""; // do not trim — preserve exact verbatim
    if (pageCategory === "") {
      invalid.push({ lineNumber, raw: line.join(","), reason: "Empty Page / Category" });
      continue;
    }
    rows.push({
      lineNumber,
      pageCategory,
      pageFeature,
      impressions: parseIntegerCell(line[fmt.columnIndexes["Impressions"]]),
      visits: parseIntegerCell(line[fmt.columnIndexes["Visits"]]),
      ownerImpressions: parseIntegerCell(line[fmt.columnIndexes["Owner Impressions"]]),
      ownerVisits: parseIntegerCell(line[fmt.columnIndexes["Owner Visits"]]),
    });
  }
  return { headers, rows, invalidLines: invalid };
}

// ---------------------------------------------------------------------------
// Filename parsing & identity validation
// ---------------------------------------------------------------------------

/** Match `traffic_<game>_<appid>_<YYYYMMDD>_<YYYYMMDD>.csv`. */
const FILENAME_RE = /^traffic_(.+)_(\d+)_(\d{8})_(\d{8})\.csv$/;

export function parseTrafficFilename(filePath: string): ParsedTrafficFilename {
  const fileName = path.basename(filePath);
  const m = FILENAME_RE.exec(fileName);
  if (!m) {
    return { ok: false, fileName, reason: "Filename does not match traffic_<game>_<appid>_<YYYYMMDD>_<YYYYMMDD>.csv" };
  }
  const [, gameToken, appid, startRaw, endRaw] = m;
  const toIso = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  const startIso = toIso(startRaw);
  const endIso = toIso(endRaw);
  // Sanity: dates must be valid.
  for (const iso of [startIso, endIso]) {
    if (Number.isNaN(new Date(iso).getTime())) {
      return { ok: false, fileName, reason: `Invalid date in filename: ${iso}` };
    }
  }
  if (startIso > endIso) {
    return { ok: false, fileName, reason: `Start date ${startIso} is after end date ${endIso}` };
  }
  return { ok: true, fileName, gameToken, appid, startIso, endIso };
}

export interface IdentityValidation {
  ok: boolean;
  warnings: string[];
  errors: string[];
  appid?: string;
  gameName?: string;
  startIso?: string;
  endIso?: string;
}

export function validateTrafficFileIdentity(
  filePath: string,
  opts: { appAllowlist: Record<string, string>; expectedRange?: { startIso: string; endIso: string } } = { appAllowlist: TRAFFIC_APP_ALLOWLIST },
): IdentityValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const parsed = parseTrafficFilename(filePath);
  if (!parsed.ok) {
    errors.push(parsed.reason ?? "Unparseable filename");
    return { ok: false, warnings, errors };
  }
  const gameName = opts.appAllowlist[parsed.appid!];
  if (!gameName) {
    errors.push(`AppID ${parsed.appid} is not in the allowlist (${Object.keys(opts.appAllowlist).join(", ")})`);
  }
  if (opts.expectedRange) {
    if (opts.expectedRange.startIso !== parsed.startIso || opts.expectedRange.endIso !== parsed.endIso) {
      warnings.push(
        `Filename date range ${parsed.startIso} → ${parsed.endIso} does not match expected window ${opts.expectedRange.startIso} → ${opts.expectedRange.endIso}`,
      );
    }
  }
  return {
    ok: errors.length === 0,
    warnings,
    errors,
    appid: parsed.appid,
    gameName,
    startIso: parsed.startIso,
    endIso: parsed.endIso,
  };
}

// ---------------------------------------------------------------------------
// Normalization, splitting, validation
// ---------------------------------------------------------------------------

export function normalizeTrafficRows(rows: RawTrafficRow[]): NormalizedTrafficRow[] {
  return rows.map((r) => ({
    ...r,
    isCountry: r.pageCategory === "Country",
    isBot: r.pageCategory === "Bot Traffic",
    pageFeatureDisplay: r.pageFeature.trim() === "" ? "(unknown)" : r.pageFeature,
  }));
}

export function splitTrafficRowsIntoPageSourceAndCountry(rows: NormalizedTrafficRow[]): {
  pageSource: NormalizedTrafficRow[];
  country: NormalizedTrafficRow[];
} {
  return {
    pageSource: rows.filter((r) => !r.isCountry),
    country: rows.filter((r) => r.isCountry),
  };
}

/** Detect rows whose numeric cells are all null (no usable data). */
export function validateTrafficRows(rows: NormalizedTrafficRow[]): { rows: NormalizedTrafficRow[]; warnings: string[] } {
  const warnings: string[] = [];
  for (const r of rows) {
    if (r.impressions === null && r.visits === null && r.ownerImpressions === null && r.ownerVisits === null) {
      warnings.push(`Line ${r.lineNumber}: ${r.pageCategory} / ${r.pageFeatureDisplay} has no numeric values (all NOT AVAILABLE).`);
    }
  }
  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// CTR + aggregations
// ---------------------------------------------------------------------------

/** CTR = visits / impressions. Returns null when impressions is null/0/missing. */
export function calculateCtr(visits: number | null, impressions: number | null): number | null {
  if (impressions === null || impressions <= 0) return null;
  if (visits === null) return null;
  return visits / impressions;
}

export function aggregateTrafficBySourcePage(rows: NormalizedTrafficRow[]): PageSourceAggregate[] {
  // Each row already represents a unique (category, feature) pair in Steam's
  // CSV — but we still aggregate defensively in case Steam emits duplicates.
  const map = new Map<string, PageSourceAggregate>();
  for (const r of rows) {
    if (r.isCountry) continue;
    const key = `${r.pageCategory}\u0000${r.pageFeatureDisplay}`;
    const cur = map.get(key) ?? {
      category: r.pageCategory,
      feature: r.pageFeatureDisplay,
      isBot: r.isBot,
      impressions: 0,
      visits: 0,
      ownerImpressions: 0,
      ownerVisits: 0,
      ctr: null,
    };
    cur.impressions += r.impressions ?? 0;
    cur.visits += r.visits ?? 0;
    cur.ownerImpressions += r.ownerImpressions ?? 0;
    cur.ownerVisits += r.ownerVisits ?? 0;
    map.set(key, cur);
  }
  for (const v of map.values()) v.ctr = calculateCtr(v.visits, v.impressions);
  return Array.from(map.values()).sort((a, b) => b.impressions - a.impressions || b.visits - a.visits);
}

export function aggregateTrafficByCountry(rows: NormalizedTrafficRow[]): CountryAggregate[] {
  const map = new Map<string, CountryAggregate>();
  for (const r of rows) {
    if (!r.isCountry) continue;
    const code = r.pageFeature.trim() === "" ? "(unknown)" : r.pageFeature.trim();
    const cur = map.get(code) ?? {
      countryCode: code,
      impressions: 0,
      visits: 0,
      ownerImpressions: 0,
      ownerVisits: 0,
      ctr: null,
    };
    cur.impressions += r.impressions ?? 0;
    cur.visits += r.visits ?? 0;
    cur.ownerImpressions += r.ownerImpressions ?? 0;
    cur.ownerVisits += r.ownerVisits ?? 0;
    map.set(code, cur);
  }
  for (const v of map.values()) v.ctr = calculateCtr(v.visits, v.impressions);
  return Array.from(map.values()).sort((a, b) => b.visits - a.visits || b.impressions - a.impressions);
}

export function aggregateTrafficByGameAndWindow(rows: NormalizedTrafficRow[]): WindowAggregate {
  let publicImpressions = 0;
  let publicVisits = 0;
  let ownerImpressions = 0;
  let ownerVisits = 0;
  let botImpressions = 0;
  let botVisits = 0;
  let realPageSourceRowCount = 0;
  let countryRowCount = 0;

  for (const r of rows) {
    if (r.isCountry) { countryRowCount++; continue; }
    // Owner counters are tracked across ALL non-country rows.
    ownerImpressions += r.ownerImpressions ?? 0;
    ownerVisits += r.ownerVisits ?? 0;
    if (r.isBot) {
      botImpressions += r.impressions ?? 0;
      botVisits += r.visits ?? 0;
      continue;
    }
    publicImpressions += r.impressions ?? 0;
    publicVisits += r.visits ?? 0;
    realPageSourceRowCount++;
  }
  return {
    publicImpressions,
    publicVisits,
    publicCtr: calculateCtr(publicVisits, publicImpressions),
    ownerImpressions,
    ownerVisits,
    botImpressions,
    botVisits,
    realPageSourceRowCount,
    countryRowCount,
  };
}
