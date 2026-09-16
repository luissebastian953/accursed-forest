/**
 * Growth and yield tunables (§2, §3.6.1).
 *
 * Palms accumulate growth-days, not calendar days: each tick a palm gains
 * `1 * G` where `G = light * moistureCurve(moisture) * fertility * stress`.
 * Stages are thresholds on accumulated growth-days; senescence is calendar age,
 * because palms get tall whether or not they grew well.
 */

export const GROWTH = {
  /**
   * Growth-days from planting to first fruit. The design doc's ~900 was a
   * real palm's three years; with a day ten seconds long that was an hour of
   * watching seedlings, so the whole life cycle runs at 0.6.
   */
  immatureDays: 540,
  /** Growth-days from planting to the end of the seedling look. */
  seedlingDays: 110,

  /** Calendar days per simulated year. */
  daysPerYear: 360,

  /** Calendar age in years at which a palm is senile. */
  senileYears: 18,
  /** Replant is prompted here (§2). */
  replantYears: 25,
  /** Hard senility: the palm is finished. */
  deadYears: 30,

  /** Bounds on the per-tick growth multiplier, asserted by tests. */
  minMultiplier: 0,
  maxMultiplier: 1.6,
} as const;

/** Bounds each factor of `G` is clamped to (§3.6.1 table). */
export const GROWTH_FACTORS = {
  light: { min: 0.4, max: 1 },
  moisture: { min: 0.3, max: 1.15 },
  fertility: { min: 0.6, max: 1.4 },
  stress: { min: 0, max: 1 },
} as const;

/**
 * Bell-shaped response to block moisture: too dry and waterlogged both hurt,
 * and the sweet spot sits slightly above average rain (§3.6.1).
 */
export const MOISTURE_CURVE: readonly (readonly [moisture: number, factor: number])[] = [
  [0, 0.3],
  [0.15, 0.6],
  [0.3, 0.95],
  [0.5, 1.15],
  [0.7, 1.1],
  [0.85, 0.9],
  [1, 0.65],
];

/**
 * Kilograms of TBS per palm per harvest round at peak health, by calendar age
 * in years: ramp from first fruit (about a year and a half in) to year 5,
 * plateau to 18, decline to 25, then senile (§2). ~10.5 kg/palm/round every
 * six days is far above a real estate's best: a good round should feel like a
 * payday, and a year of them should build something.
 */
export const YIELD_CURVE: readonly (readonly [ageYears: number, kg: number])[] = [
  [0, 0],
  [1.5, 1.2],
  [2.5, 5],
  [4, 8.4],
  [5, 10.5],
  [18, 10.5],
  [25, 6],
  [30, 2.2],
];

/** Days between harvest rounds on a block (§2: ten, shortened with the slower clock). */
export const HARVEST_ROTATION_DAYS = 6;

/** One fertilizer application lifts fertility for this long (§3.5). */
export const FERTILIZER_DAYS = 90;

/**
 * Reforestation grows on the same machinery with its own thresholds: sapling to
 * young to mature forest over roughly eight years (§3.10).
 */
export const FOREST_GROWTH = {
  saplingDays: 220,
  youngDays: 860,
  matureDays: 1720,
  /** Forest cover weight by stage (§3.10: young counts half). */
  youngCoverWeight: 0.5,
  matureCoverWeight: 1,
} as const;
