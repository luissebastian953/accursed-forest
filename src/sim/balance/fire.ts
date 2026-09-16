/**
 * Fire tunables (§3.1.1, §3.6). Burning is nearly free and fast; these numbers
 * are the brakes: spread, the pressure meter, and the wildfire threshold.
 *
 * Pressures 1 / 3 / 5 against a threshold of 3: a high burn tips it on its
 * own, a medium burn sits exactly on the line so anything after it tips, and
 * low burns spaced out over seasons still never do. Burning big is now a
 * decision to lose control, not a gamble.
 */

import type { ClimateRegime, FireIntensity } from '../types.ts';

export const FIRE = {
  /** Days a burn takes to clear its block. */
  burnDays: { 1: 8, 2: 4, 3: 2 } satisfies Record<FireIntensity, number>,

  /**
   * Chance per day of igniting each burnable neighbour, before fuel and
   * regime. Read together with `burnDays`: what matters is the chance over
   * the whole burn. Low ≈ 0.16 per neighbour over 8 days (a controlled burn
   * mostly stays put), medium ≈ 0.34 over 4 (sometimes takes one), high ≈ 0.4
   * over 2 (probably takes a couple; at 0.35/day one high burn chain-reacted
   * into 130 blocks on its own). The design doc's per-day figures were
   * written without the durations and chain-reacted even at low intensity.
   */
  spreadPerDay: { 1: 0.01, 2: 0.058, 3: 0.2 } satisfies Record<FireIntensity, number>,

  /**
   * A man-made burn spreads this much more readily into a neighbouring block
   * of standing forest: dry canopy and litter catch where grass would not.
   * Lightning and drought fires do not spread at all (`weather.naturalFires`):
   * they burn their block out and stop, so an act of God never costs the
   * player the hillside — only their own matches do.
   */
  forestSpreadFactor: 3,

  /**
   * A wildfire's own daily spread chance per neighbour, replacing the block's
   * intensity. Tuned by burned area over a dry season: ~50 blocks in two
   * months and ~95 over the season in a normal year — a disaster for a
   * 64-block estate, not a map reset. (0.4 burned a quarter of the map.)
   */
  wildfireSpreadPerDay: 0.3,

  /** How the year's regime scales a controlled burn's spread. */
  regimeSpreadMultiplier: {
    normal: 1,
    elNino: 2,
    laNina: 0.6,
  } satisfies Record<ClimateRegime, number>,

  /**
   * The same for a wildfire, gentler: its reproduction rate sits near 1, so
   * doubling it burned two thirds of the map, ×1.25 a fifth, ×1.1 a few hundred
   * blocks — the bad-year haze story without erasing the world.
   */
  wildfireRegimeMultiplier: {
    normal: 1,
    elNino: 1.1,
    laNina: 0.7,
  } satisfies Record<ClimateRegime, number>,

  /**
   * Fuel dryness from block moisture: 1 at or below `fuelWetAt − fuelDryRange`,
   * 0 at or above `fuelWetAt`, raised to `moistureResistance`. Dry-season
   * ground (~0.4) reads ~0.6; riverbanks and irrigated blocks are firebreaks.
   * Soil moisture is not fuel dryness — an earlier (1 − moisture) term choked
   * every fire and made the wildfire a hair-trigger between 3 and 600 blocks.
   */
  fuelWetAt: 0.7,
  fuelDryRange: 0.5,
  moistureResistance: 1,

  /** Fire pressure a burn adds when lit. */
  pressure: { 1: 1, 2: 3, 3: 5 } satisfies Record<FireIntensity, number>,
  wildfireThreshold: 3,
  /** Roughly a season to clear one medium burn. */
  pressureDecayPerDay: 3 / 180,

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
