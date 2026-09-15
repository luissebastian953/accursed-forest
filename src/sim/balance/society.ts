/**
 * Society tunables (§3.7, §3.9): the hidden integrity stat, the macro-economic
 * deck, and the authority meter with its warnings and arrest.
 */

export const INTEGRITY = {
  start: 0.25,
  /** Integrity drifts back toward this after every scandal. */
  baseline: 0.25,
  driftSd: 0.003,
  reversionPerDay: 0.004,
  /** A scandal can break every so often, briefly making enforcement real. */
  scandalEveryDays: 90,
  scandalChance: 0.12,
  scandalJump: 0.35,
} as const;

/**
 * Attention (§3.9): how much the authorities have noticed you, 0..100.
 * Increases are scaled by `0.5 + integrity` — with low integrity the meter
 * climbs slower (three quarters speed at the starting 0.25).
 */
export const ATTENTION = {
  /** Each forest block chopped — small, cumulative. */
  chopForest: 4,
  /** Each burn, by intensity. */
  burn: { 1: 5, 2: 10, 3: 16 } as Record<1 | 2 | 3, number>,
  /** Each block a fire reaches that is not yours. */
  fireIntoUnowned: 6,
  /** Planting forest back pulls attention down sharply... */
  reforestPlant: 12,
  /** ...and a growing forest keeps pulling, per block, per day. */
  reforestTricklePerBlock: 0.006,
  /** Quiet seasons forget. About eleven points a year. */
  decayPerDay: 0.03,
  max: 100,
} as const;

export const AUTHORITY = {
  /** Warning 1: the letter. */
  letterAt: 40,
  /** The letter's surcharge lifts once attention falls back below this. */
  letterClearsBelow: 25,
  /** Clearing costs this much more while a letter stands (§3.9: +50%). */
  letterChopCostFactor: 1.5,
  /** Warning 2: police at the gate. */
  investigationAt: 70,
  /** A two-year ban on chopping and burning; sales continue. */
  investigationDays: 720,
  /** Game over. */
  arrestAt: 100,
  /** "Settle the matter": only available while integrity is low. */
  settleCost: 75_000_000,
  settleMaxIntegrity: 0.4,
  settleAttention: 30,
} as const;

export type MacroEventId =
  | 'rupiahSlide'
  | 'fertilizerSpike'
  | 'biodieselMandate'
  | 'euRestriction'
  | 'millStrike'
  | 'exportLevy';

export interface MacroEvent {
  weight: number;
  /** Permanent rise in the input price index (inflation is sticky). */
  inputRise?: number;
  /** Temporary multiplier on the TBS price's long-run mean, and how long. */
  tbsFactor?: number;
  days?: { min: number; max: number };
}

export const MACRO = {
  drawEveryDays: 60,
  drawChance: 0.3,
  /** CPO is priced in USD: a weaker rupiah lifts TBS by only this share of the input rise. */
  tbsPassThrough: 0.5,
  events: {
    // ~3.5% a year on average: close to recent Indonesian inflation. At 7%/4%
    // the index was already ×1.19 by year 2.
    rupiahSlide: { weight: 3, inputRise: 0.05 },
    fertilizerSpike: { weight: 2, inputRise: 0.03 },
    biodieselMandate: { weight: 1.5, tbsFactor: 1.1, days: { min: 150, max: 240 } },
    euRestriction: { weight: 1, tbsFactor: 0.88, days: { min: 180, max: 300 } },
    millStrike: { weight: 1.5, tbsFactor: 0.85, days: { min: 10, max: 25 } },
    exportLevy: { weight: 1.5, tbsFactor: 0.94, days: { min: 90, max: 150 } },
  } satisfies Record<MacroEventId, MacroEvent>,
  /** The input index never runs away past this over a run. */
  maxInputIndex: 2.2,
} as const;

export const MACRO_PREFIX = 'macro:';
