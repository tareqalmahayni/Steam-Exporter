// Canonical Tracker Map (Milestone 1).
// Encodes everything we need to write into the Steamworks publisher tracker
// without ever touching anything outside the §7 safe set.

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type Metric = "wishlists" | "impressions" | "visits";
export type GameId = "taival" | "colossus" | "petunia" | "fleet" | "noor";

export interface KpiBlockRows {
  /** Row that holds the game label + 13 weekly date headers (B..N) + WoW% (O) + Total (P) */
  headerRow: number;
  /** Row of weekly Wishlists (formula-driven on existing four games — never write) */
  wishlistsRow: number;
  /** Row of weekly Impressions (numeric — safe to write) */
  impressionsRow: number;
  /** Row of weekly Visits (numeric — safe to write) */
  visitsRow: number;
}

export interface GameMap {
  id: GameId;
  /** Canonical game label as it appears in KPI by Quarter column A */
  canonicalName: string;
  /** Game label as it appears in WL sheet column B (may differ from canonicalName,
   *  e.g. "Fleetbreakers" in WL vs "Fleet Breakers" in KPI). */
  wlGameLabel: string;
  /** Worksheet name for daily wishlist data */
  wlSheet: string;
  /** Block rows in 'KPI by Quarter' for each quarter */
  kpiQuarterRows: Record<Quarter, KpiBlockRows>;
  /** Row in 'Consolidated KPI' for the three metric rows (header label cells in column A) */
  consolidatedRows: { wishlists: number; impressions: number; visits: number };
}

/** The four pre-existing games. Noor is added at runtime by addNoor.ts. */
export const GAMES: Record<Exclude<GameId, "noor">, GameMap> = {
  taival: {
    id: "taival",
    canonicalName: "Taival",
    wlGameLabel: "Taival",
    wlSheet: "Taival_WL",
    kpiQuarterRows: {
      Q1: { headerRow: 2, wishlistsRow: 3, impressionsRow: 4, visitsRow: 5 },
      Q2: { headerRow: 19, wishlistsRow: 20, impressionsRow: 21, visitsRow: 22 },
      Q3: { headerRow: 36, wishlistsRow: 37, impressionsRow: 38, visitsRow: 39 },
      Q4: { headerRow: 53, wishlistsRow: 54, impressionsRow: 55, visitsRow: 56 },
    },
    consolidatedRows: { wishlists: 2, impressions: 3, visits: 4 },
  },
  colossus: {
    id: "colossus",
    canonicalName: "Colossus - Eternal Blight",
    wlGameLabel: "Colossus - Eternal Blight",
    wlSheet: "Colossus - Eternal Blight_WL",
    kpiQuarterRows: {
      Q1: { headerRow: 6, wishlistsRow: 7, impressionsRow: 8, visitsRow: 9 },
      Q2: { headerRow: 23, wishlistsRow: 24, impressionsRow: 25, visitsRow: 26 },
      Q3: { headerRow: 40, wishlistsRow: 41, impressionsRow: 42, visitsRow: 43 },
      Q4: { headerRow: 57, wishlistsRow: 58, impressionsRow: 59, visitsRow: 60 },
    },
    consolidatedRows: { wishlists: 6, impressions: 7, visits: 8 },
  },
  petunia: {
    id: "petunia",
    // The KPI sheet labels are misspelled "Putania's Purgatory"; the WL sheet
    // is correctly "Petunia's Purgatory_WL". The typoFix module corrects the
    // five label cells in the copied output. The WL sheet name is correct
    // already and is NEVER renamed.
    canonicalName: "Petunia's Purgatory",
    wlGameLabel: "Petunia's Purgatory",
    wlSheet: "Petunia's Purgatory_WL",
    kpiQuarterRows: {
      Q1: { headerRow: 10, wishlistsRow: 11, impressionsRow: 12, visitsRow: 13 },
      Q2: { headerRow: 27, wishlistsRow: 28, impressionsRow: 29, visitsRow: 30 },
      Q3: { headerRow: 44, wishlistsRow: 45, impressionsRow: 46, visitsRow: 47 },
      Q4: { headerRow: 61, wishlistsRow: 62, impressionsRow: 63, visitsRow: 64 },
    },
    consolidatedRows: { wishlists: 10, impressions: 11, visits: 12 },
  },
  fleet: {
    id: "fleet",
    canonicalName: "Fleet Breakers",
    wlGameLabel: "Fleetbreakers",
    wlSheet: "Fleetbreakers_WL",
    kpiQuarterRows: {
      Q1: { headerRow: 14, wishlistsRow: 15, impressionsRow: 16, visitsRow: 17 },
      Q2: { headerRow: 31, wishlistsRow: 32, impressionsRow: 33, visitsRow: 34 },
      Q3: { headerRow: 48, wishlistsRow: 49, impressionsRow: 50, visitsRow: 51 },
      Q4: { headerRow: 65, wishlistsRow: 66, impressionsRow: 67, visitsRow: 68 },
    },
    consolidatedRows: { wishlists: 14, impressions: 15, visits: 16 },
  },
};

/** Steam AppIDs for the five main games, per Milestone 4. Demos, playtests,
 *  supporter packs, and "Tales of the Forgotten" are intentionally NOT here. */
export const APP_IDS: Record<GameId, string> = {
  colossus: "1722800",
  fleet: "2929040",
  taival: "3152750",
  noor: "3728760",
  petunia: "4009450",
};

/** Sheets we expect to find when validating the input workbook. */
export const REQUIRED_SHEETS = [
  "Consolidated KPI",
  "KPI by Quarter",
  "Taival_WL",
  "Colossus - Eternal Blight_WL",
  "Petunia's Purgatory_WL",
  "Fleetbreakers_WL",
  "Dashboard",
] as const;

/** §7 safe write columns for WL sheets (A=date readonly, B=game readonly, G/H/I=formulas). */
export const WL_SAFE_COLUMNS = {
  Adds: "C",
  Deletes: "D",
  Purchases: "E",
  Gifts: "F",
} as const;

/** §13 typo-fix targets — exact (sheet, address) pairs to correct from "Putania" → "Petunia". */
export const TYPO_FIX_TARGETS: Array<{ sheet: string; address: string }> = [
  { sheet: "KPI by Quarter", address: "A10" },
  { sheet: "KPI by Quarter", address: "A27" },
  { sheet: "KPI by Quarter", address: "A44" },
  { sheet: "KPI by Quarter", address: "A61" },
  { sheet: "Consolidated KPI", address: "A10" },
  { sheet: "Consolidated KPI", address: "A11" },
  { sheet: "Consolidated KPI", address: "A12" },
  { sheet: "Dashboard", address: "L4" },
  { sheet: "Dashboard", address: "E31" },
];

/** Rows in `Dashboard` that contain "Putania's Purgatory" inside an IF formula
 *  string — those formulas reference the wrong literal but we DO NOT rewrite
 *  formulas in this milestone. We log a warning instead. */
export const KNOWN_DASHBOARD_FORMULA_TYPO_ROWS = [9, 31, 53] as const;
