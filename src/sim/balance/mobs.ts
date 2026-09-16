/**
 * Mob tunables: who wanders the estate, how often, and what they do.
 *
 * Mobs live in the simulation as data (position in block units, an intent,
 * a target) so a save replays the same thieves and the same boars. Wild
 * animals are set dressing with a population cap; the thief and the babi
 * ngepet take things; workers are hired at the Kopdes and cost a wage a day.
 */

import type { MobSpecies } from '../types.ts';

export const MOB_STREAM = 0x4d4f4253;

/** Blocks a wild animal may roam from the estate before it has "left". */
export const ROAM = 6;

export const WILDLIFE = {
  /** Wild animals around the estate at once. */
  cap: 14,
  /** Chance per day of one more arriving while under the cap. */
  arrivePerDay: 0.35,
  /** Days a wild animal stays before it wanders off, min and max. */
  stayDays: { min: 20, max: 90 },
  /**
   * Where each kind turns up (block biomes it spawns on and prefers to
   * wander over) and its weight in the draw. Monkeys and orangutans keep to
   * the forest; the capybara keeps near the water.
   */
  kinds: {
    wildBoar: { weight: 3, biomes: ['forest', 'grassfield', 'scrub'] },
    pig: { weight: 2, biomes: ['grassfield', 'scrub', 'village'] },
    mouse: { weight: 3, biomes: ['grassfield', 'scrub'], onPlanted: true },
    cow: { weight: 2, biomes: ['grassfield', 'village'] },
    monkey: { weight: 3, biomes: ['forest', 'protected'] },
    orangutan: { weight: 1, biomes: ['forest', 'protected'] },
    capybara: { weight: 2, biomes: ['riverbank'] },
  } satisfies Partial<
    Record<MobSpecies, { weight: number; biomes: readonly string[]; onPlanted?: boolean }>
  >,
  /** Blocks per day a wild animal covers. */
  speed: 1.5,
} as const;

export const THIEF = {
  /** Chance per day one shows up, once any block is bearing: a visit or two a year. */
  arrivePerDay: 0.005,
  /** Share of the ripe fruit on the block they get away with. */
  takeShare: 0.6,
  /** Blocks per day. */
  speed: 3,
  /** Days they keep at it before slipping away, if nobody stops them. */
  stayDays: 12,
  /** With a security guard on the payroll, a thief is this much less likely to try. */
  guardedFactor: 0.25,
  /** ...and the guard catches them this often before they reach a block. */
  caughtChance: 0.7,
} as const;

export const BABI_NGEPET = {
  /**
   * Rarer than a thief, and only once the estate is earning: the stories say
   * it comes for money that is there. Roughly once every four years.
   */
  arrivePerDay: 0.0007,
  /** Share of cash it takes when it gets to the Kopdes. */
  takeShare: 0.04,
  maxTake: 25_000_000,
  speed: 2.5,
  /** It looks like a pig until it stands up at the Kopdes. */
  stayDays: 8,
} as const;

export const GHOST = {
  /** A cleared block nobody has touched for this long is abandoned. */
  abandonedAfterDays: 360,
  /** Chance per day a ghost drifts onto an abandoned block. */
  appearPerDay: 0.02,
  stayDays: { min: 3, max: 9 },
} as const;

export type WorkerKind = 'sanitizer' | 'plantDoctor' | 'security';

export const WORKERS: Record<
  WorkerKind,
  { wagePerDay: number; label: string; hireFee: number; speed: number }
> = {
  /** Walks to the messiest block and clears it; the crew item, on a salary. */
  sanitizer: { label: 'Sanitation worker', wagePerDay: 350_000, hireFee: 2_000_000, speed: 2 },
  /** Finds sick palms and removes them, and doses the block with Trichoderma. */
  plantDoctor: { label: 'Plant doctor', wagePerDay: 1_400_000, hireFee: 15_000_000, speed: 2 },
  /** Patrols the ripe blocks; thieves mostly stay away, and get caught when they don't. */
  security: { label: 'Security guard', wagePerDay: 900_000, hireFee: 8_000_000, speed: 2.5 },
};

export const WORKER_JOBS = {
  /** A sanitizer starts on a block with at least this much debris... */
  sanitizeAbove: 25,
  /** ...and clears this much a day while on it. */
  sanitizePerDay: 12,
  /** A plant doctor removes this many sick palms a day on the block it is treating. */
  removalsPerDay: 2,
  /** Blocks per day a hired crew walks. */
  crewSpeed: 2,
} as const;
