/**
 * Mob tunables: who wanders the estate, how often, and what they do.
 *
 * Mobs live in the simulation as data (position in block units, an intent,
 * a target) so a save replays the same thieves and the same boars. Wild
 * animals are set dressing with a population cap; the thief and the babi
 * ngepet take things; workers are hired at the Kopdes and cost a wage a day.
 *
 * Speeds are blocks per day. A tick is half a second at 1×, and a block is
 * twelve world units, so 0.12 blocks a day is a stroll and anything past 0.5
 * reads as running; the renderer walks each mob to where the sim put it.
 */

import type { MobSpecies } from '../types.ts';

export const MOB_STREAM = 0x4d4f4253;

/** Blocks a wild animal may roam from the estate before it has "left". */
export const ROAM = 6;

/** How animals (and the ghost) spend their days. */
export const BEHAVIOUR = {
  /** Standing still, days. */
  idleDays: { min: 1, max: 4 },
  /** Milling about an anchor, days, and how far from it, blocks. */
  paceDays: { min: 3, max: 8 },
  paceRadius: 0.6,
  /** Heading somewhere across the estate, or round in a circle, days. */
  wanderDays: { min: 4, max: 12 },
  circleRadius: { min: 1, max: 2.5 },
  /** Radians a day round the circle. */
  circleTurn: 0.35,
  /** Lying down, days. */
  sleepDays: { min: 2, max: 5 },
  /** How likely each is when the last one ends. */
  weights: { idle: 3, pace: 3, wander: 2, circle: 1, sleep: 1 },
  /** A leaving mob that has not made the edge in this long has slipped off anyway. */
  leaveGraceDays: 45,
} as const;

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
  /** Blocks per day: milling about, and crossing the estate. */
  paceSpeed: 0.1,
  wanderSpeed: 0.28,
} as const;

export const THIEF = {
  /** Chance per day one shows up, once any block is bearing: a visit or two a year. */
  arrivePerDay: 0.005,
  /** Share of the ripe fruit on the block they get away with. */
  takeShare: 0.6,
  /** Blocks per day: creeping to the trees, and the crouched dash across the estate. */
  sneakSpeed: 0.45,
  raidSpeed: 0.95,
  /** Days spent hidden in the trees before the dash. */
  hideDays: { min: 1, max: 3 },
  /** Blocks from the target the hiding tree may be. */
  hideRadius: 3,
  /** Days they keep at it before slipping away, if nobody stops them. */
  stayDays: 30,
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
  /** Blocks per day: ambling in as a pig, and the upright run afterwards. */
  pigSpeed: 0.3,
  raidSpeed: 0.9,
  /** Days it runs the estate on two legs before it is gone. */
  raidDays: 3,
  /** It looks like a pig until it stands up at the Kopdes. */
  stayDays: 40,
} as const;

export const GHOST = {
  /** A cleared block nobody has touched for this long is abandoned. */
  abandonedAfterDays: 360,
  /** Chance per day a ghost drifts onto an abandoned block. */
  appearPerDay: 0.02,
  stayDays: { min: 3, max: 9 },
  /** Blocks per day; it drifts. */
  speed: 0.06,
} as const;

export type WorkerKind = 'sanitizer' | 'plantDoctor' | 'security';

export const WORKERS: Record<
  WorkerKind,
  { wagePerDay: number; label: string; hireFee: number; speed: number }
> = {
  /** Walks to the messiest block and clears it; the crew item, on a salary. */
  sanitizer: { label: 'Sanitation worker', wagePerDay: 350_000, hireFee: 2_000_000, speed: 0.5 },
  /** Finds sick palms and removes them, and doses the block with Trichoderma. */
  plantDoctor: { label: 'Plant doctor', wagePerDay: 1_400_000, hireFee: 15_000_000, speed: 0.5 },
  /** Patrols the estate at a walk from a post by the Kopdes; thieves mostly stay away. */
  security: { label: 'Security guard', wagePerDay: 900_000, hireFee: 8_000_000, speed: 0.2 },
};

export const WORKER_JOBS = {
  /** A sanitizer starts on a block with at least this much debris... */
  sanitizeAbove: 25,
  /** ...and clears this much a day while on it. */
  sanitizePerDay: 12,
  /** A plant doctor removes this many sick palms a day on the block it is treating. */
  removalsPerDay: 2,
  /** Blocks per day a crew shifts between work spots on its block. */
  crewSpeed: 0.3,
  /** Days a crew works one spot before moving to the next tree. */
  crewSpotDays: { min: 2, max: 4 },
  /** The guard's pace when there is a thief about, and how long a rest at the post lasts. */
  chaseSpeed: 0.6,
  postDays: { min: 2, max: 4 },
  /** Where the guard post stands, in blocks from the Kopdes centre. */
  guardPost: { dx: 0.34, dz: -0.34 },
} as const;
