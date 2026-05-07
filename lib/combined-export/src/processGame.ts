/**
 * Pure per-game processor used by both the M6 CLI and the M7 API server.
 *
 * Takes an already-loaded wishlist summary + an already-loaded traffic CSV
 * (as text), and produces a fully-assembled `PerGame` record ready to feed
 * into `buildCombinedWorkbook`. NO filesystem I/O.
 */

import type { GameSpec } from "./games.js";
import { PETUNIA_VTI_NOTE, expectedTrafficFilename } from "./games.js";
import type {
  WishlistDayResult,
  WishlistDayStatus,
  WishlistPullSummary,
} from "./wishlist.js";
import {
  TRAFFIC_APP_ALLOWLIST,
  parseTrafficCsvText,
  validateTrafficFileIdentity,
  normalizeTrafficRows,
  splitTrafficRowsIntoPageSourceAndCountry,
  validateTrafficRows,
  aggregateTrafficByGameAndWindow,
  aggregateTrafficBySourcePage,
  aggregateTrafficByCountry,
  type NormalizedTrafficRow,
  type PageSourceAggregate,
  type CountryAggregate,
  type WindowAggregate,
} from "./traffic.js";

export type DataType = "wishlist" | "traffic" | "both";

export interface DerivedBreakdownRow {
  dateIso: string;
  key: string;
  label: string;
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  net: number | null;
}

export interface WishlistTotals {
  adds: number | null;
  deletes: number | null;
  purchases: number | null;
  gifts: number | null;
  net: number | null;
}

export type WishlistRollupStatus =
  | WishlistDayStatus
  | "WISHLIST_CACHE_MISSING"
  | "WISHLIST_NOT_REQUESTED";

export type TrafficRollupStatus =
  | "REAL_DATA"
  | "TRAFFIC_CSV_MISSING"
  | "TRAFFIC_CSV_DATE_RANGE_MISMATCH"
  | "PARSE_FAILED"
  | "TRAFFIC_NOT_REQUESTED";

export interface PerGame {
  spec: GameSpec;
  selected: boolean;
  dataType: DataType;
  expectedTrafficFileName: string;
  // Wishlist
  wishlistStatus: WishlistRollupStatus;
  wishlistDaily: WishlistDayResult[];
  wishlistTotals: WishlistTotals;
  countryRows: DerivedBreakdownRow[];
  languageRows: DerivedBreakdownRow[];
  // Traffic
  trafficStatus: TrafficRollupStatus;
  trafficSourceFileName: string;
  trafficStartIso: string | null;
  trafficEndIso: string | null;
  trafficHeaders: string[];
  trafficRows: NormalizedTrafficRow[];
  trafficPageSource: NormalizedTrafficRow[];
  trafficCountry: NormalizedTrafficRow[];
  trafficInvalid: Array<{ lineNumber: number; raw: string; reason: string }>;
  trafficTotals: WindowAggregate | null;
  trafficByPageSource: PageSourceAggregate[];
  trafficByCountry: CountryAggregate[];
  // Combined
  warnings: string[];
  errors: string[];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function netOf(adds: number | null, deletes: number | null, purchases: number | null, gifts: number | null): number | null {
  if (adds === null || deletes === null || purchases === null || gifts === null) return null;
  return adds - deletes - purchases - gifts;
}

function extractCountryRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.countrySummaryPresent) continue;
    const resp = (d.parsed as { response?: { country_summary?: unknown } })?.response;
    const cs = resp?.country_summary;
    if (!Array.isArray(cs)) continue;
    for (const e of cs) {
      const obj = e as Record<string, unknown>;
      const code = String(obj.country_code ?? obj.code ?? "");
      const name = String(obj.country_name ?? obj.name ?? "");
      const sa = (obj.summary_actions ?? obj) as Record<string, unknown>;
      const adds = num(sa.wishlist_adds ?? sa.adds);
      const deletes = num(sa.wishlist_deletes ?? sa.deletes);
      const purchases = num(sa.wishlist_purchases ?? sa.purchases);
      const gifts = num(sa.wishlist_gifts ?? sa.gifts);
      rows.push({ dateIso: d.dateIso, key: code, label: name, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

function extractLanguageRows(daily: WishlistDayResult[]): DerivedBreakdownRow[] {
  const rows: DerivedBreakdownRow[] = [];
  for (const d of daily) {
    if (!d.languageSummaryPresent) continue;
    const resp = (d.parsed as { response?: { language_summary?: unknown } })?.response;
    const ls = resp?.language_summary;
    if (!Array.isArray(ls)) continue;
    for (const e of ls) {
      const obj = e as Record<string, unknown>;
      const code = String(obj.language ?? obj.lang ?? obj.code ?? "");
      const label = String(obj.language_name ?? obj.name ?? code);
      const sa = (obj.summary_actions ?? obj) as Record<string, unknown>;
      const adds = num(sa.wishlist_adds ?? sa.adds);
      const deletes = num(sa.wishlist_deletes ?? sa.deletes);
      const purchases = num(sa.wishlist_purchases ?? sa.purchases);
      const gifts = num(sa.wishlist_gifts ?? sa.gifts);
      rows.push({ dateIso: d.dateIso, key: code, label, adds, deletes, purchases, gifts, net: netOf(adds, deletes, purchases, gifts) });
    }
  }
  return rows;
}

export function aggregateWishlist(s: WishlistPullSummary): WishlistTotals {
  const sumField = (pick: (d: WishlistDayResult) => number | null): number | null => {
    let sum = 0;
    let anyReal = false;
    for (const d of s.daily) {
      if (d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM") continue;
      anyReal = true;
      const v = pick(d);
      if (v === null) return null;
      sum += v;
    }
    return anyReal ? sum : null;
  };
  const adds = sumField((d) => d.adds);
  const deletes = sumField((d) => d.deletes);
  const purchases = sumField((d) => d.purchases);
  const gifts = sumField((d) => d.gifts);
  const net = (adds === null || deletes === null || purchases === null || gifts === null)
    ? null : adds - deletes - purchases - gifts;
  return { adds, deletes, purchases, gifts, net };
}

export interface ProcessGameInput {
  spec: GameSpec;
  selected: boolean;
  dataType: DataType;
  expectedWindow: { startIso: string; endIso: string };
  /** Already-pulled or already-cached wishlist data; null if not requested. */
  wishlistSummary: WishlistPullSummary | null;
  /** Whether wishlist was requested but not provided (cache miss / pull failure outside processor). */
  wishlistMissingReason?: string | null;
  /** Uploaded traffic CSV (text + filename); null if not provided. */
  trafficCsv: { fileName: string; text: string } | null;
}

export function processGame(input: ProcessGameInput): PerGame {
  const { spec, selected, dataType, expectedWindow, wishlistSummary, wishlistMissingReason, trafficCsv } = input;
  const warnings: string[] = [];
  const errors: string[] = [];

  const wishlistRequested = dataType === "wishlist" || dataType === "both";
  const trafficRequested = dataType === "traffic" || dataType === "both";

  // Wishlist
  let wishlistStatus: WishlistRollupStatus;
  let wishlistDaily: WishlistDayResult[] = [];
  let wishlistTotals: WishlistTotals = { adds: null, deletes: null, purchases: null, gifts: null, net: null };
  let countryRows: DerivedBreakdownRow[] = [];
  let languageRows: DerivedBreakdownRow[] = [];
  if (!wishlistRequested) {
    wishlistStatus = "WISHLIST_NOT_REQUESTED";
  } else if (!wishlistSummary) {
    wishlistStatus = "WISHLIST_CACHE_MISSING";
    errors.push(wishlistMissingReason ?? `No wishlist data for ${spec.displayName}`);
  } else {
    wishlistDaily = wishlistSummary.daily;
    wishlistTotals = aggregateWishlist(wishlistSummary);
    countryRows = extractCountryRows(wishlistSummary.daily);
    languageRows = extractLanguageRows(wishlistSummary.daily);
    const failedDays = wishlistSummary.daily.filter((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
    for (const d of failedDays) {
      const target = d.status === "EMPTY_RESPONSE" ? warnings : errors;
      target.push(`Wishlist ${d.dateIso} [${d.status}] ${d.message}`);
    }
    // Roll up to the lowest-severity status across the window: any non-OK day downgrades it.
    const allOk = wishlistSummary.daily.every((d) => d.status === "REAL_DATA" || d.status === "TRUE_ZERO_FROM_STEAM");
    if (allOk) {
      const anyReal = wishlistSummary.daily.some((d) => d.status === "REAL_DATA");
      wishlistStatus = anyReal ? "REAL_DATA" : "TRUE_ZERO_FROM_STEAM";
    } else {
      // Pick the first non-OK status as representative.
      const firstFail = wishlistSummary.daily.find((d) => d.status !== "REAL_DATA" && d.status !== "TRUE_ZERO_FROM_STEAM");
      wishlistStatus = (firstFail?.status ?? "API_ERROR");
    }
  }

  // Traffic
  const expectedTrafficFileName = expectedTrafficFilename(spec, expectedWindow);
  let trafficStatus: TrafficRollupStatus = "REAL_DATA";
  let trafficSourceFileName = expectedTrafficFileName;
  let trafficStartIso: string | null = null;
  let trafficEndIso: string | null = null;
  let trafficHeaders: string[] = [];
  let trafficRows: NormalizedTrafficRow[] = [];
  let trafficPageSource: NormalizedTrafficRow[] = [];
  let trafficCountry: NormalizedTrafficRow[] = [];
  let trafficInvalid: Array<{ lineNumber: number; raw: string; reason: string }> = [];
  let trafficTotals: WindowAggregate | null = null;
  let trafficByPageSource: PageSourceAggregate[] = [];
  let trafficByCountry: CountryAggregate[] = [];

  if (!trafficRequested) {
    trafficStatus = "TRAFFIC_NOT_REQUESTED";
  } else if (!trafficCsv) {
    trafficStatus = "TRAFFIC_CSV_MISSING";
    errors.push(`Traffic CSV missing: ${expectedTrafficFileName}`);
  } else {
    trafficSourceFileName = trafficCsv.fileName;
    const ident = validateTrafficFileIdentity(trafficCsv.fileName, {
      appAllowlist: TRAFFIC_APP_ALLOWLIST,
      expectedRange: expectedWindow,
    });
    warnings.push(...ident.warnings);
    errors.push(...ident.errors);
    const dateMismatch = !!(ident.startIso && ident.endIso
      && (ident.startIso !== expectedWindow.startIso || ident.endIso !== expectedWindow.endIso));
    if (!ident.ok || !ident.appid || !ident.startIso || !ident.endIso) {
      trafficStatus = "PARSE_FAILED";
    } else if (ident.appid !== spec.appid) {
      errors.push(`Traffic CSV AppID ${ident.appid} mismatched expected ${spec.appid} for ${spec.displayName}`);
      trafficStatus = "PARSE_FAILED";
    } else if (dateMismatch) {
      errors.push(`TRAFFIC_CSV_DATE_RANGE_MISMATCH: ${trafficCsv.fileName} covers ${ident.startIso} → ${ident.endIso} but selected window is ${expectedWindow.startIso} → ${expectedWindow.endIso}`);
      trafficStatus = "TRAFFIC_CSV_DATE_RANGE_MISMATCH";
    } else {
      trafficStartIso = ident.startIso;
      trafficEndIso = ident.endIso;
      const parsed = parseTrafficCsvText(trafficCsv.text);
      trafficHeaders = parsed.headers;
      trafficInvalid = parsed.invalidLines;
      for (const inv of parsed.invalidLines) warnings.push(`Traffic line ${inv.lineNumber}: ${inv.reason}`);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        errors.push(`Traffic CSV produced no rows for ${spec.displayName}`);
        trafficStatus = "PARSE_FAILED";
      } else {
        const normalized = normalizeTrafficRows(parsed.rows);
        const split = splitTrafficRowsIntoPageSourceAndCountry(normalized);
        const v = validateTrafficRows(normalized);
        warnings.push(...v.warnings);
        trafficRows = normalized;
        trafficPageSource = split.pageSource;
        trafficCountry = split.country;
        trafficTotals = aggregateTrafficByGameAndWindow(normalized);
        trafficByPageSource = aggregateTrafficBySourcePage(normalized);
        trafficByCountry = aggregateTrafficByCountry(normalized);

        if (
          spec.id === "petunia" &&
          trafficTotals &&
          trafficTotals.publicImpressions > 0 &&
          trafficTotals.publicVisits > trafficTotals.publicImpressions
        ) {
          warnings.push(`Petunia VTI > 100%: ${PETUNIA_VTI_NOTE}`);
        }
      }
    }
  }

  return {
    spec, selected, dataType, expectedTrafficFileName,
    wishlistStatus, wishlistDaily, wishlistTotals, countryRows, languageRows,
    trafficStatus, trafficSourceFileName,
    trafficStartIso, trafficEndIso, trafficHeaders,
    trafficRows, trafficPageSource, trafficCountry, trafficInvalid,
    trafficTotals, trafficByPageSource, trafficByCountry,
    warnings, errors,
  };
}

/** True iff a per-game record represents fully-OK data (used by both CLI + API for finalStatus). */
export function isGameOk(g: PerGame): boolean {
  const wishlistOk =
    g.dataType === "traffic" ||
    g.wishlistStatus === "REAL_DATA" ||
    g.wishlistStatus === "TRUE_ZERO_FROM_STEAM";
  const trafficOk =
    g.dataType === "wishlist" || g.trafficStatus === "REAL_DATA";
  return wishlistOk && trafficOk;
}
