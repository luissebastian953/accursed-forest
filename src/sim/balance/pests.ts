export const DEBRIS = {
  /**
   * Debris points that rot away each day. Slow on purpose: a chopped forest's 55 takes almost
   * four years, which keeps the beetles fed if nobody sanitizes.
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
  /** Logistic growth per day; ~12 days to double when the pile is fresh. */
  growthPerDay: 0.06,
  /** A pile always attracts a founding few. */
  seedPopulation: 2,
  /** Population shrinks by this factor per day once there is nothing to breed in. */
  decayWithoutFood: 0.9,
  /** Health lost per immature palm per day, per beetle; mature palms are not attacked (GDD 2). */
  damagePerBeetle: 0.005,
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
   * Chance per day an infected palm infects each of its six lattice neighbours, before
   * modifiers. Ganoderma is the slow pest: at 0.0025 it outran a careful player.
   */
  spreadPerDay: 0.0013,
  /** A dead palm's stump keeps spreading at this fraction until removed. */
  stumpSourceFactor: 0.5,
  /** Spontaneous infection per day: a floor for any planted block, plus debris. */
  baseSeedPerDay: 0.00008,
  seedPerDebrisPerDay: 0.00003,
  /**
   * Latent → symptomatic, then symptomatic → dead: young palms go fast (GDD 2).
   * Scaled with the palm life cycle (0.6).
   */
  latentDays: { immature: 145, mature: 290 },
  symptomaticDays: { immature: 290, mature: 860 },
  /** Symptomatic palms cap stress here (GDD 3.6.1). */
  stressCap: 0.6,
  /** Trichoderma halves spread while active (GDD 3.4). */
  trichodermaFactor: 0.5,
  trichodermaDays: 120,
  /** A plagued block spreads faster (GDD 3.4). */
  plagueSpreadFactor: 1.6,
  /** Debris a dead palm's stump adds, and a removed palm's remains. */
  debrisPerDeath: 3,
  debrisPerRemoval: 2,
} as const;

/**
 * Plague (GDD 3.4): pressure = beetles / beetleScale + infectedShare × infectedScale.
 * Flagged at `onAt`, cleared at `offAt`; hysteresis so it does not flicker.
 */
export const PLAGUE = {
  beetleScale: 80,
  infectedScale: 5,
  onAt: 1.25,
  offAt: 0.6,
} as const;

/** Per-palm labour. */
export const PEST_LABOUR = {
  removePalm: 120_000,
  trenchPalm: 90_000,
} as const;
