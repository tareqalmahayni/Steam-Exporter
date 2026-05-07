// Deterministic, seeded mock pull-result generator. No network calls.
// Returns daily WL rows + per-day Impressions/Visits per game over the
// requested ISO window. Numbers are plausible (low-double-digit wishlists,
// 100s-low-1000s impressions/visits) so writes look real in the dry-run.

import type { GameId } from "./map.js";
import { daysInRange } from "./dateWindow.js";

export interface MockDailyWL {
  dateIso: string;
  adds: number;
  deletes: number;
  purchases: number;
  gifts: number;
}

export interface MockDailyTraffic {
  dateIso: string;
  impressions: number;
  visits: number;
}

export interface MockGamePull {
  game: GameId;
  daily: MockDailyWL[];
  traffic: MockDailyTraffic[];
}

export interface MockPullResult {
  startIso: string;
  endIso: string;
  seed: string;
  perGame: Record<GameId, MockGamePull>;
}

/** Tiny deterministic PRNG (mulberry32) seeded from a string. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_GAMES: GameId[] = ["taival", "colossus", "petunia", "fleet", "noor"];

export function generateMockPull(opts: { startIso: string; endIso: string; seed: string }): MockPullResult {
  const perGame = {} as Record<GameId, MockGamePull>;
  for (const game of ALL_GAMES) {
    const rng = mulberry32(hashSeed(`${opts.seed}|${game}`));
    const daily: MockDailyWL[] = [];
    const traffic: MockDailyTraffic[] = [];
    for (const dateIso of daysInRange(opts.startIso, opts.endIso)) {
      const adds = 1 + Math.floor(rng() * 15);
      const deletes = Math.floor(rng() * 4);
      const purchases = rng() < 0.05 ? 1 : 0;
      const gifts = 0;
      daily.push({ dateIso, adds, deletes, purchases, gifts });
      const impressions = 200 + Math.floor(rng() * 1500);
      const visits = 30 + Math.floor(rng() * 250);
      traffic.push({ dateIso, impressions, visits });
    }
    perGame[game] = { game, daily, traffic };
  }
  return { startIso: opts.startIso, endIso: opts.endIso, seed: opts.seed, perGame };
}
