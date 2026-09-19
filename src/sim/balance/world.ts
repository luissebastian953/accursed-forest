export const WORLD = {
  /** Default bound: a kabupaten. Lazy generation makes this a parameter, not a limit. */
  width: 64,
  height: 64,

  /** Palms per block side. Block = 1 ha = 12x12 = 144 palms (§2). */
  blockSide: 12,

  /** Blocks per chunk side. Shared by the mesher and the save format (§6.7, §7). */
  chunkSide: 4,

  /** Side of the player's initially owned square (§3.1). */
  startSize: 8,

  /** Elevation is quantised to these many steps, 0..3 (§3.6.2). */
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

/** Thresholds turning (elevation, moisture, slope) into a biome (§4.6). */
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
 * Kampung (§3.1, village land): a few small clusters of houses along the
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
   * Standing forest in and around the square (this many blocks out): the
   * choice between chopping and burning needs forest to choose about, and a
   * start on bare grassland looked like nothing was there.
   */
  forestRing: 3,
  /** Forest share of that area that earns the full bonus. */
  forestTarget: 0.3,
  forestWeight: 5,
} as const;
