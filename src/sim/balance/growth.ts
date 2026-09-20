export const GROWTH = {
  /** Growth-days from planting to first fruit. The whole life cycle runs at 0.6 of the GDD's. */
  immatureDays: 540,
  /** Growth-days from planting to the end of the seedling look. */
  seedlingDays: 110,

  /** Calendar days per simulated year. */
  daysPerYear: 360,

  /** Calendar age in years at which a palm is senile. */
  senileYears: 18,
  /** Replant is prompted here (GDD 2). */
  replantYears: 25,
  /** Hard senility: the palm is finished. */
  deadYears: 30,

  /** Bounds on the per-tick growth multiplier, asserted by tests. */
  minMultiplier: 0,
  maxMultiplier: 1.6,
} as const;

/** Bounds each factor of `G` is clamped to (GDD 3.6.1 table). */
export const GROWTH_FACTORS = {
  light: { min: 0.4, max: 1 },
  moisture: { min: 0.3, max: 1.15 },
  fertility: { min: 0.6, max: 1.4 },
  stress: { min: 0, max: 1 },
} as const;

/**
 * Bell-shaped response to block moisture: too dry and waterlogged both hurt,
 * and the sweet spot sits slightly above average rain (GDD 3.6.1).
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
 * Kilograms of TBS per palm per round at peak health, by calendar age in years (GDD 2).
 * Far above a real estate's best on purpose: a good round should feel like a payday.
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

/** Days between harvest rounds on a block (GDD 2: ten, shortened with the slower clock). */
export const HARVEST_ROTATION_DAYS = 5;

/** One fertilizer application lifts fertility for this long (GDD 3.5). */
export const FERTILIZER_DAYS = 90;

/**
 * Reforestation: the palms' growth machinery with its own thresholds, about a year to mature
 * forest (GDD 3.10). Putting land back has to pay inside a run, or nobody does it.
 */
export const FOREST_GROWTH = {
  saplingDays: 40,
  /** Half a year in: a young tree. Declared for the ladder; nothing reads it yet. */
  youngDays: 180,
  matureDays: 360,
  /** Forest cover weight by stage (GDD 3.10: young counts half). */
  youngCoverWeight: 0.5,
  matureCoverWeight: 1,
} as const;
