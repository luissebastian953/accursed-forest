/**
 * Fire tunables (§3.1.1, §3.6). Burning is nearly free and fast; these numbers
 * are the brakes: spread, the pressure meter, and the wildfire threshold.
 *
 * Pressures 1 / 3 / 5 against a threshold of 5.5: a lone high burn stops just
 * short, so any residual pressure from an earlier burn tips it — "almost
 * guaranteed to tip pressure over the line". Two medium burns in one season
 * cross it; low burns spaced out over seasons never do.
 */

import type { ClimateRegime, FireIntensity } from '../types.ts';

export const FIRE = {
  /** Days a burn takes to clear its block. */
  burnDays: { 1: 17, 2: 7, 3: 3 } satisfies Record<FireIntensity, number>,
  /** Chance per day of igniting each burnable neighbour. */
  spreadPerDay: { 1: 0.05, 2: 0.15, 3: 0.35 } satisfies Record<FireIntensity, number>,
  /** Fire pressure a burn adds when lit. */
  pressure: { 1: 1, 2: 3, 3: 5 } satisfies Record<FireIntensity, number>,
  wildfireThreshold: 5.5,
  /** Roughly a season to clear one medium burn. */
  pressureDecayPerDay: 3 / 180,
  /** Spread multiplier once the fire is a wildfire; planted blocks become fuel. */
  wildfireSpreadMultiplier: 3,
  regimeSpreadMultiplier: { normal: 1, elNino: 2, laNina: 0.6 } satisfies Record<
    ClimateRegime,
    number
  >,
  /** A cleared block needs at least this much debris to catch. */
  debrisFuelMin: 20,
  /** Extra spread into a cleared block per 100 debris. */
  debrisFuel: 1,
  /**
   * Sustained heavy rain puts fires out: needs `wetStreak` at least this long,
   * then this chance per day. Light dry-season showers do not stop a land fire.
   */
  extinguishWetStreak: 2,
  extinguishPerDay: 0.35,
  /** Debris a burned block keeps (ash, charred stumps). */
  debrisAfterBurn: 10,
  /** Debris left when palms burn: charred trunks, beetle food. */
  debrisFromBurnedPalms: 40,
  /** Debris a rained-out, half-burned block gains. */
  debrisFromExtinguished: 15,
  /** Ash lifts fertility for a season (§3.1.1: +0.2). */
  ashDays: 90,
  /** Light while wildfire smoke hangs (§3.1.1: `light` ≈ 0.6), and its tail. */
  hazeLight: 0.6,
  hazeTailDays: 20,
  /** Setting and watching a burn: a crew for a day. */
  burnCost: 250_000,
} as const;
