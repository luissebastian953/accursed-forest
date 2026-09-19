import { MACRO_EVENTS } from './macroEvents.ts';

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
 * Attention (GDD 3.9): how much the authorities have noticed you, 0..100.
 * Increases are scaled by `0.5 + integrity`; with low integrity the meter
 * climbs slower (three quarters speed at the starting 0.25).
 */
export const ATTENTION = {
  /** Each forest block chopped; small, cumulative. */
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
  /**
   * Putting forest back is the one thing the Ministry takes at face value:
   * each reforested hectare halves what is held against the estate, both the
   * attention on it and whatever is left of a suspension.
   */
  reforestationRelief: 0.5,
  /** Clearing costs this much more while a letter stands (GDD 3.9: +50%). */
  letterChopCostFactor: 1.5,
  /** Warning 2: police at the gate. */
  investigationAt: 70,
  /** Three months' ban on chopping and burning; sales continue. (Was two years: too long to sit out.) */
  investigationDays: 90,
  /**
   * When a case runs its course, attention falls to at most this: still over
   * the letter line, so the file stays open, but far enough under the police
   * line that only a new offence brings them back. Without it, a meter still
   * at 70+ on the last day opened a fresh 90-day case the same tick.
   */
  investigationClosesAt: 45,
  /** Game over. */
  arrestAt: 100,
  /**
   * "Settle the matter" (GDD 3.9): the envelope that makes a case go away, and a
   * suspension with it. Only while the district office is crooked enough to
   * take it, and dear enough that it is never the cheap way out: an estate
   * pays about a year of good harvests for the favour.
   */
  settleCost: 320_000_000,
  /** A standing suspension costs this much again on top. */
  settleBanExtra: 180_000_000,
  settleMaxIntegrity: 0.4,
  settleAttention: 30,
} as const;

export { MACRO_EVENTS, type MacroEvent, type MacroEventId } from './macroEvents.ts';

export const MACRO = {
  drawEveryDays: 60,
  drawChance: 0.3,
  /** CPO is priced in USD: a weaker rupiah lifts TBS by only this share of the input rise. */
  tbsPassThrough: 0.5,
  events: MACRO_EVENTS,
  /** The input index never runs away past this over a run. */
  maxInputIndex: 2.2,
} as const;

export const MACRO_PREFIX = 'macro:';
