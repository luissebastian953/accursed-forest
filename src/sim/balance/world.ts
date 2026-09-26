export const WORLD = {
  /** Default bound: a kabupaten. Lazy generation makes this a parameter, not a limit. */
  width: 64,
  height: 64,

  /** Palms per block side. Block = 1 ha = 12x12 = 144 palms (GDD 2). */
  blockSide: 12,

  /** Blocks per chunk side. Shared by the mesher and the save format (GDD 6.7, GDD 7). */
  chunkSide: 4,

  /** Side of the player's initially owned square (GDD 3.1). */
  startSize: 8,

  /** Elevation is quantised to these many steps, 0..3 (GDD 3.6.2). */
  maxElevation: 3,
} as const;

/** Slots per block. */
export const SLOTS_PER_BLOCK = WORLD.blockSide * WORLD.blockSide;

export const NOISE = {
  /** Low-frequency continental shape. */
  continentScale: 0.018,
  /** Mid-frequency hills. */
  hillScale: 0.055,
  /** High-frequency detail; only nudges the quantised elevation. */
  detailScale: 0.16,
  continentWeight: 0.62,
  hillWeight: 0.28,
  detailWeight: 0.1,

  moistureScale: 0.035,
  /** Lowlands are wetter: how strongly elevation pushes moisture down. */
  moistureElevationBias: 0.28,
  /** Moisture added near a river, and how far that reaches in blocks. */
  riverMoistureBoost: 0.35,
  riverMoistureRange: 4,
} as const;

/** Thresholds turning (elevation, moisture, slope) into a biome (GDD 4.6). */
export const BIOME_RULES = {
  /** At or above this normalised height, with slope, the block is hills. */
  hillsElevation: 2,
  /** Below this moisture, dry scrub. */
  scrubMoisture: 0.2,
  /** At or above this moisture, forest; below it, grassfield. */
  forestMoisture: 0.46,
  /** Blocks within this distance of river water become riverbank. */
  riverbankRange: 1,
} as const;

export const RIVERS = {
  min: 1,
  max: 3,
  /** Flat cost of entering any cell. Higher values cut straighter to the coast. */
  stepCost: 0.01,
  /** Multiplies a cell's 0..1 height in the path cost: how hard valleys pull. */
  heightWeight: 1.6,
  /** Per-cell deterministic wobble in the path cost, so flat ground meanders. */
  wobbleWeight: 0.3,
  wobbleScale: 0.2,
  /** Sources are drawn from the map's interior: this share of each side is excluded. */
  sourceMargin: 0.25,
} as const;

export const PROTECTED = {
  /** Minimum blocks in the high forest cluster promoted to protected forest. */
  minClusterSize: 14,
  /** Normalised elevation at or above which forest may become protected. */
  minElevation: 2,
} as const;

/**
 * Kampung (GDD 3.1, village land): a few small clusters of houses along the
 * rivers, well away from the estate. Not for sale and not clearable.
 */
export const VILLAGES = {
  min: 2,
  max: 4,
  /** Blocks per village, before running out of suitable neighbours. */
  minSize: 2,
  maxSize: 4,
  /** A village sits this close to river water... */
  riverWithin: 3,
  /** ...on low ground... */
  maxElevation: 1,
  /** ...and at least this many blocks outside the starting square. */
  startClearance: 5,
  biomes: ['grassfield', 'riverbank', 'scrub'] as const,
} as const;

/**
 * Mass graves (GDD 3.11): a site or two of unmarked low ground, outside the
 * free square but within a run's reach, and never beside a village.
 */
export const GRAVES = {
  min: 1,
  max: 2,
  /** Blocks per site. */
  minSize: 1,
  maxSize: 2,
  /** Low ground only; the dead were not carried up a hill. */
  maxElevation: 1,
  /** At least this many blocks outside the starting square... */
  startClearance: 3,
  /** ...and no closer than this to the square, so a run reaches one in its first years. */
  startReach: 9,
  /** No village keeps its dead this close. */
  villageClearance: 3,
  biomes: ['grassfield', 'scrub', 'forest'] as const,
} as const;

export const START_SITE = {
  /** Search radius, in blocks, around the map centre. */
  searchRadius: 18,
  /** A start site needs river water within this many blocks. */
  riverWithin: 6,
  /** Biomes the starting region may sit on. */
  allowed: ['grassfield', 'forest'] as const,
  /** Minimum share of the starting square that must be allowed biomes. */
  minAllowedShare: 0.7,
  /**
   * Standing forest counted this many blocks out from the square: chop or burn needs forest
   * to choose about, and a bare grassland start looked empty.
   */
  forestRing: 3,
  /** Forest share of that area that earns the full bonus. */
  forestTarget: 0.3,
  forestWeight: 5,
  /**
   * Open (non-forest, unprotected) neighbours of the eight around the Kopdes
   * hectare, below which it counts as buried in the trees (GDD 4.6).
   */
  kopdesMinOpen: 3,
  /** Marked down by more than the whole distance term, so an edge always wins. */
  kopdesBuriedPenalty: 40,
  /**
   * Open ground inside the square that earns the full bonus: without it a
   * forest square scores like a mixed one, and buries the Kopdes (GDD 4.6).
   */
  openTarget: 0.2,
  openWeight: 4,
} as const;
