/**
 * Seasonal baseline (§3.6): a 360-day year with a wet season (Nov–Mar) and a
 * dry season (Apr–Oct), and the climate regime that scales it each year.
 */

import type { ClimateRegime } from '../types.ts';

export const SEASONS = {
  daysPerYear: 360,
  /** Wet season runs from this day of the year... */
  wetStartDay: 300,
  /** ...through the day before this one, wrapping over the new year. */
  wetEndDay: 90,

  /**
   * Daily rain is a clamped normal draw from the season's distribution.
   *
   * Calibrated so a grassfield block under the normal regime averages G ≈ 1.0
   * over a year and reaches 900 growth-days in ~900 calendar days (§3.6.1);
   * El Niño (×0.55 rain) stretches that to ~1000 days. The Kalimantan dry
   * season is "less wet", not arid — an earlier 0.2 mean starved growth to
   * G ≈ 0.6 and pushed first harvest past four years.
   */
  rain: {
    wet: { mean: 0.65, sd: 0.2 },
    dry: { mean: 0.4, sd: 0.16 },
  },

  regime: {
    weights: { normal: 0.6, elNino: 0.2, laNina: 0.2 } satisfies Record<ClimateRegime, number>,
    /** Added to last year's regime weight: regimes cluster (§3.6). */
    persistence: 0.3,
    rainMultiplier: { normal: 1, elNino: 0.55, laNina: 1.35 } satisfies Record<
      ClimateRegime,
      number
    >,
  },

  /**
   * `dryStreak` counts consecutive ticks with rain below this — a day drier
   * than an ordinary dry-season day, not a day with no rain at all. Daily rain
   * is drawn independently, so a strict "no rain" threshold (0.1) never
   * produced a fortnight's streak even under El Niño.
   */
  dryStreakBelow: 0.3,
  /** `wetStreak` counts consecutive ticks with rain above this. */
  wetStreakAbove: 0.6,

  /**
   * `sun = 1 - cloudPerRain * rain`, before haze and ash attenuation. Kept
   * mild on purpose: §3.6.1 puts normal light near 1.0 and reserves the big
   * drops for haze (≈0.7) and ash (≈0.5).
   */
  cloudPerRain: 0.15,

  /** Block moisture relaxes toward the day's rain at this rate per tick. */
  moistureRelax: 0.06,
  /** Irrigated blocks never dry below this. */
  irrigationFloor: 0.55,
  /** Drained blocks never waterlog above this. */
  drainageCeiling: 0.7,
} as const;

export function isWetSeason(dayOfYear: number): boolean {
  return dayOfYear >= SEASONS.wetStartDay || dayOfYear < SEASONS.wetEndDay;
}
