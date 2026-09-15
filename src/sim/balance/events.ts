/**
 * The weather event deck and the landscape hazards (§3.6, §3.6.2).
 *
 * Events are data: a weight, the conditions that allow a draw, a duration
 * range, and the effects the world-events system applies while they run. The
 * deck is drawn at most once every `drawEveryDays`, so a bad month is a bad
 * month rather than a stack of five disasters. Drought is not drawn — it is
 * what a long enough dry streak *is*.
 */

import type { ClimateRegime } from '../types.ts';

export const DECK = {
  /** Days between draws. */
  drawEveryDays: 30,
  /**
   * Chance a draw produces any event at all, before weights. At 0.35 the deck
   * dealt four events a year and ash fell annually; 0.12 is about one a year.
   */
  drawChance: 0.12,
  /**
   * The weights are shares of this fixed total; whatever they do not claim is
   * "nothing happens". Without it, an event that cannot be drawn (already
   * running, wrong season) handed its share to the others — with a flood
   * running in the wet season, a draw was a certain ash fall.
   */
  referenceWeight: 1.6,
} as const;

export type DeckEventId = 'haze' | 'ash' | 'flood';

export interface DeckEvent {
  /** Base weight in a normal regime. */
  weight: number;
  regimeWeight: Record<ClimateRegime, number>;
  /** Only drawn in the wet season, the dry season, or either. */
  season: 'wet' | 'dry' | 'any';
  days: { min: number; max: number };
}

export const DECK_EVENTS: Record<DeckEventId, DeckEvent> = {
  /** Regional smoke from fires beyond the estate; your own fires make it likelier. */
  haze: {
    weight: 3,
    regimeWeight: { normal: 0.4, elNino: 2.5, laNina: 0.1 },
    season: 'dry',
    days: { min: 12, max: 35 },
  },
  /** A volcano somewhere upwind. Rare, regional, and fertile afterwards. */
  ash: {
    weight: 0.06,
    regimeWeight: { normal: 1, elNino: 1, laNina: 1 },
    season: 'any',
    days: { min: 3, max: 10 },
  },
  /** The river comes up over the low ground. */
  flood: {
    weight: 2,
    regimeWeight: { normal: 0.6, elNino: 0.1, laNina: 2.5 },
    season: 'wet',
    days: { min: 5, max: 12 },
  },
};

export const HAZE = {
  /** Sun multiplier while regional haze hangs (§3.6.1: haze ≈ 0.7). */
  light: 0.7,
  /** Each point of fire pressure makes haze this much likelier. */
  weightPerFirePressure: 0.5,
  /** Buyers pay less in a haze season: the price walk's mean dips this much. */
  priceDip: 0.08,
} as const;

export const ASH = {
  /** Sun multiplier during ash fall (§3.6: `light` ≈ 0.5). */
  light: 0.5,
  /** Health immature palms lose per day of ash on their fronds. */
  immatureDamagePerDay: 2,
  /** The fertile season afterwards (§3.6: ash is a real fertilizer). */
  fertileDays: 90,
} as const;

export const FLOOD = {
  /** Blocks at or below this elevation, this close to the river, go under. */
  maxElevation: 0,
  riverDistance: 2,
  /** Health an immature palm loses per day under water; mature palms stand. */
  immatureDamagePerDay: 30,
  /** Debris the water leaves behind — beetle food, again. */
  debrisPerDay: 1.5,
  /** Ganoderma likes wet roots: spontaneous infection multiplier while flooded. */
  ganodermaSeedFactor: 3,
} as const;

export const DROUGHT = {
  /**
   * `dryStreak` at which a dry spell becomes a drought: never in a normal
   * year, in a little over half of El Niño dry seasons (measured).
   */
  onAtDryStreak: 12,
  /** A drought breaks on a day with at least this much rain, not the first damp one. */
  breaksAtRain: 0.5,
  /** Extra moisture lost per day on non-irrigated blocks. */
  moistureLossPerDay: 0.012,
  /**
   * Chance per day, under El Niño drought, that a spark catches a debris pile
   * on or next to the estate (§3.6: "a dry-regime spark next to debris").
   */
  sparkPerDay: 0.012,
} as const;

/** Forest cover and landslides (§3.6.2). */
export const LANDSLIDE = {
  /** Radius, in blocks, of the neighbourhood whose forest holds a slope. */
  coverRadius: 2,
  /** Base daily chance on a slope in the wet season, before the multipliers. */
  basePerDay: 0.0012,
  /** Wet-streak factor: `min(maxStreakFactor, 1 + wetStreak / streakScale)`. */
  streakScale: 3,
  maxStreakFactor: 3,
  /** Planted slopes slide more than wild ones (§3.6.2). */
  plantedFactor: 1.5,
  unplantedFactor: 0.5,
  /** An established cover crop halves the chance. */
  coverCropFactor: 0.5,
  /** Debris left on the slid block, and dumped on the block below. */
  debrisOnBlock: 35,
  debrisBelow: 25,
} as const;

/** Weight of forest by what is standing (§3.10: young forest counts half). */
export const FOREST_COVER_WEIGHT = {
  wild: 1,
  reforestYoung: 0.5,
  reforestMature: 1,
} as const;

export const COVER_CROP = {
  cost: 900_000,
  /** How long one sowing lasts. */
  days: 3 * 360,
  /** It only holds the soil once established (§3.6.2: after 90 days). */
  establishDays: 90,
} as const;
