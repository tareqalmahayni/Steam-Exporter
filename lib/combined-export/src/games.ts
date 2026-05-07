/**
 * Canonical list of the 5 supported games. Used by the combined export
 * builder, the API server, and the web UI.
 */

export type GameId = "colossus" | "fleet" | "taival" | "noor" | "petunia";

export interface GameSpec {
  id: GameId;
  /** "Cache id" used inside the M4B wishlist-pull-cache.json. */
  cacheId: string;
  appid: string;
  /** Display name AND sheet name in the workbook. */
  displayName: string;
  /** Filename token used in the traffic CSV (not user-facing). */
  trafficFileToken: string;
  /**
   * First date for which Steam has wishlist reporting for this game (YYYY-MM-DD).
   * Required for the "Lifetime" date option. Leave undefined to block Lifetime
   * runs for this game until a real date is supplied.
   */
  trackingStartDate?: string;
}

export const GAME_SPECS: GameSpec[] = [
  { id: "colossus", cacheId: "colossus", appid: "1722800", displayName: "Colossus - Eternal Blight", trafficFileToken: "colossus" },
  { id: "fleet",    cacheId: "fleet",    appid: "2929040", displayName: "Fleetbreakers",             trafficFileToken: "fleetbreakers" },
  { id: "taival",   cacheId: "taival",   appid: "3152750", displayName: "Taival",                    trafficFileToken: "taival" },
  { id: "noor",     cacheId: "noor",     appid: "3728760", displayName: "Noor",                      trafficFileToken: "noor" },
  { id: "petunia",  cacheId: "petunia",  appid: "4009450", displayName: "Petunia's Purgatory",       trafficFileToken: "petunia" },
];

export const PETUNIA_VTI_NOTE =
  "Visits exceed impressions because off-Steam referrers (e.g. facebook.com, instagram, Google) carry 0 tracked impressions on Steam.";

/** Build the expected traffic CSV filename for a game and date window. */
export function expectedTrafficFilename(spec: GameSpec, window: { startIso: string; endIso: string }): string {
  const stripDashes = (iso: string) => iso.replace(/-/g, "");
  return `traffic_${spec.trafficFileToken}_${spec.appid}_${stripDashes(window.startIso)}_${stripDashes(window.endIso)}.csv`;
}

/** Resolve game specs from a selection list. Accepts cacheIds OR appids. */
export function resolveGameSelection(selection: string[]): GameSpec[] {
  const out: GameSpec[] = [];
  for (const sel of selection) {
    const s = sel.trim();
    if (s === "") continue;
    const byId = GAME_SPECS.find((g) => g.cacheId === s || g.id === s);
    const byApp = GAME_SPECS.find((g) => g.appid === s);
    const found = byId ?? byApp;
    if (!found) throw new Error(`Unknown game selector: "${sel}". Use cacheId (colossus/fleet/taival/noor/petunia) or appid.`);
    if (!out.includes(found)) out.push(found);
  }
  return out;
}
