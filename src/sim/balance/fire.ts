import type { ClimateRegime, FireIntensity } from '../types.ts';

export const FIRE = {
  /** Days a burn takes to clear its block. */
  burnDays: { 1: 8, 2: 4, 3: 2 } satisfies Record<FireIntensity, number>,

  /**
   * Chance per day of igniting each burnable neighbour, before fuel and regime. Tune it with
   * `burnDays`: the chance over the whole burn is what matters. 0.35 a day is the ceiling.
   */
  spreadPerDay: { 1: 0.01, 2: 0.058, 3: 0.3 } satisfies Record<FireIntensity, number>,

  /**
   * A man-made burn spreads this much more readily into standing forest. Natural fires never
   * spread (`weather.naturalFires`): only the player's own matches cost the hillside.
   */
  forestSpreadFactor: 3,

  /**
   * A wildfire's own daily spread chance per neighbour, replacing the block's intensity.
   * Tuned on burned area over a dry season: a disaster, not a map reset.
   */
  wildfireSpreadPerDay: 0.3,

  /** How the year's regime scales a controlled burn's spread. */
  regimeSpreadMultiplier: {
    normal: 1,
    elNino: 2,
    laNina: 0.6,
  } satisfies Record<ClimateRegime, number>,

  /**
   * The same for a wildfire, and gentler: its reproduction rate sits near 1, so doubling it
   * burned two thirds of the map.
   */
  wildfireRegimeMultiplier: {
    normal: 1,
    elNino: 1.1,
    laNina: 0.7,
  } satisfies Record<ClimateRegime, number>,

  /**
   * Fuel dryness: 1 at or below `fuelWetAt - fuelDryRange`, 0 at or above `fuelWetAt`. Soil
   * moisture is not fuel dryness: a (1 - moisture) term made the wildfire a hair-trigger.
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
  /** Ash lifts fertility for a season (GDD 3.1.1: +0.2). */
  ashDays: 90,

  /** Light while wildfire smoke hangs (GDD 3.1.1: `light` ≈ 0.6), and its tail. */
  hazeLight: 0.6,
  hazeTailDays: 20,

  /** Setting and watching a burn: a crew for a day. */
  burnCost: 250_000,
} as const;
