/**
 * Pest tunables (§3.4). Two pests, two tempos: Ganoderma is slow and
 * structural (root to root along the lattice, years to kill), the rhinoceros
 * beetle is fast and about sanitation (breeds in debris, bores young palms).
 * Debris feeds both, which is why what you leave behind when clearing matters.
 */

export const DEBRIS = {
  /**
   * Debris points that decay away on their own each day. Slow on purpose:
   * a chopped forest's trunks (55) take almost four years to rot, which is
   * what keeps the beetles fed if nobody sanitizes. At 0.12 the pile was gone
   * in fifteen months and beetles never finished a seedling.
   */
  decayPerDay: 0.04,
  /** Debris points one sanitation crew removes. */
  sanitizePerCrew: 60,
} as const;

export const BEETLES = {
  /** Carrying capacity per debris point; a freshly chopped forest (55) holds ~110. */
  capacityPerDebris: 2,
  /** Below this debris there is nothing to breed in. */
  minDebrisToBreed: 5,
  /** Logistic growth per day; ~9 days to double when the pile is fresh. */
  growthPerDay: 0.08,
  /** A pile always attracts a founding few. */
  seedPopulation: 2,
  /** Population shrinks by this factor per day once there is nothing to breed in. */
  decayWithoutFood: 0.9,
  /**
   * Expected health lost per immature palm per day, per beetle. At capacity on
   * fresh forest debris (~110 beetles) a seedling loses ~0.7 hp/day and dies
   * inside a year if nothing is done; mature palms are not attacked (§2).
   */
  damagePerBeetle: 0.0065,
  /** Beetles killed per day while pheromone traps are up, and how long they last. */
  trapKillPerDay: 3,
  trapDays: 120,
  /** Metarhizium multiplies breeding by this while active, and for how long. */
  metarhiziumGrowthFactor: 0.4,
  metarhiziumDays: 90,
  /** Share of a block's beetles that fly to each neighbouring breeding site per day. */
  spilloverPerDay: 0.01,
} as const;

export const GANODERMA = {
  /**
   * Chance per day that an infected palm infects each of its six lattice
   * neighbours, before debris, plague and Trichoderma. One symptomatic palm
   * takes a neighbour roughly every couple of months.
   */
  spreadPerDay: 0.0025,
  /** A dead palm's stump keeps spreading at this fraction until removed. */
  stumpSourceFactor: 0.5,
  /** Spontaneous infection per day: a floor for any planted block, plus debris. */
  baseSeedPerDay: 0.00015,
  seedPerDebrisPerDay: 0.00006,
  /** Latent → symptomatic, then symptomatic → dead: young palms go fast (§2). */
  latentDays: { immature: 180, mature: 360 },
  symptomaticDays: { immature: 360, mature: 1080 },
  /** Symptomatic palms cap stress here (§3.6.1). */
  stressCap: 0.6,
  /** Trichoderma halves spread while active (§3.4). */
  trichodermaFactor: 0.5,
  trichodermaDays: 120,
  /** A plagued block spreads at double rate (§3.4). */
  plagueSpreadFactor: 2,
  /** Debris a dead palm's stump adds, and a removed palm's remains. */
  debrisPerDeath: 3,
  debrisPerRemoval: 2,
} as const;

/**
 * Plague (§3.4): pressure = beetles / beetleScale + infectedShare × infectedScale.
 * Flagged at `onAt`, cleared at `offAt` — hysteresis so it does not flicker.
 */
export const PLAGUE = {
  beetleScale: 80,
  infectedScale: 5,
  onAt: 1,
  offAt: 0.5,
} as const;

/** Per-palm labour. */
export const PEST_LABOUR = {
  removePalm: 120_000,
  trenchPalm: 90_000,
} as const;
