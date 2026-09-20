import type { ClimateRegime } from '../types.ts';

export const SEASONS = {
  daysPerYear: 360,
  /** Wet season runs from this day of the year... */
  wetStartDay: 300,
  /** ...through the day before this one, wrapping over the new year. */
  wetEndDay: 90,

  /**
   * Daily rain, a clamped normal draw, calibrated so grassfield averages G ≈ 1.0 (GDD 3.6.1).
   * The Kalimantan dry season is "less wet", not arid: a 0.2 mean starved growth.
   */
  rain: {
    wet: { mean: 0.65, sd: 0.2 },
    dry: { mean: 0.4, sd: 0.16 },
  },

  regime: {
    weights: { normal: 0.6, elNino: 0.2, laNina: 0.2 } satisfies Record<ClimateRegime, number>,
    /** Added to last year's regime weight: regimes cluster (GDD 3.6). */
    persistence: 0.3,
    rainMultiplier: { normal: 1, elNino: 0.55, laNina: 1.35 } satisfies Record<
      ClimateRegime,
      number
    >,
  },

  /**
   * `dryStreak` counts consecutive ticks with rain below this: drier than a dry-season day,
   * not rainless. A strict 0.1 never made a fortnight's streak, even under El Niño.
   */
  dryStreakBelow: 0.3,
  /** `wetStreak` counts consecutive ticks with rain above this. */
  wetStreakAbove: 0.6,

  /**
   * `sun = 1 - cloudPerRain * rain`, before haze and ash. Mild on purpose: GDD 3.6.1 keeps
   * normal light near 1.0 and saves the big drops for haze and ash.
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

/**
 * The day's sky, read off the rain draw (GDD 3.6): sunshine, cloud, rain, and
 * the thunderstorms that bring lightning.
 */
export const SKY = {
  /** Below this rain the sky is clear... */
  cloudyAbove: 0.2,
  /** ...below this it is cloudy... */
  rainAbove: 0.45,
  /** ...and at or above this it is a thunderstorm. */
  stormAbove: 0.82,

  /**
   * Dry storms: after a run of dry days a middling sky can still thunder. These start the
   * fires; a wet storm douses its own lightning.
   */
  dryStormStreak: 5,
  dryStormRain: 0.2,
  dryStormChance: 0.3,

  /**
   * Weather comes in spells: the sky holds this many days before it is read off the rain
   * again. A storm still breaks in whenever the rain calls for one.
   */
  spellDays: { min: 6, max: 14 },
  /** Tag for the spell lengths' own random stream. */
  stream: 0x534b5920,
} as const;

/** Lightning (GDD 3.6): storms strike, and dry timber catches. */
export const LIGHTNING = {
  /** Chance of any strike at all on a storm day. */
  strikeChance: 0.45,
  /** At most this many strikes in one storm day. */
  maxStrikes: 2,
  /** Chance a strike sets what it hit alight. */
  igniteChance: 0.25,
  /** Above this much rain nothing catches: it is coming down too hard. */
  soakedAbove: 0.92,
  /** Nor does anything catch on ground wetter than this. */
  soakedGround: 0.62,
  /** How far outside the estate a strike may land, in blocks. */
  reach: 6,
} as const;
