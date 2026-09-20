import { BIOMES } from '../balance/biomes.ts';
import { NOISE, WORLD } from '../balance/world.ts';
import { forkRng } from '../rng.ts';
import type { Biome, Block, BlockId, WorldGenParams } from '../types.ts';

import { classifyBiome, type CellTerrain } from './biomes.ts';
import { NOISE_TAG, createElevationField, type ElevationField } from './elevation.ts';
import { findProtectedForest, findStartSite, findVillages, type StartSite } from './features.ts';
import { createMoistureField } from './moisture.ts';
import { traceRivers, type RiverField } from './rivers.ts';

export interface GeneratedBlock {
  biome: Biome;
  elevation: number;
  /** Continuous 0..1 height, for the column mesher's half-steps. */
  height01: number;
  slope: boolean;
  moisture: number;
  forSale: boolean;
  isProtected: boolean;
}

export interface World {
  readonly params: WorldGenParams;
  readonly width: number;
  readonly height: number;
  readonly rivers: RiverField;
  readonly start: StartSite;
  /** Terrain and biome for any in-bounds cell. Cached. */
  generated(x: number, y: number): GeneratedBlock;
  /** A fresh, untouched `Block` as the simulation would first see it. */
  block(x: number, y: number): Block;
  blockById(id: BlockId): Block;
  inBounds(x: number, y: number): boolean;
  toId(x: number, y: number): BlockId;
  toXY(id: BlockId): [x: number, y: number];
  /** Human-shareable code for this world (GDD 4.6). */
  estateCode: string;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function createWorld(
  seed: number,
  width: number = WORLD.width,
  height: number = WORLD.height,
): World {
  const elevation: ElevationField = createElevationField(seed);
  const moistureField = createMoistureField(seed, elevation);
  const rivers = traceRivers(seed, width, height, elevation, NOISE.riverMoistureRange);

  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  const toId = (x: number, y: number): BlockId => y * width + x;
  const toXY = (id: BlockId): [number, number] => {
    const x = id % width;

    return [x, (id - x) / width];
  };

  // ── Per-cell terrain, cached ─────────────────────────────────────────────
  // A flat array beats an LRU here: 4,096 entries at 64x64, cheap to regenerate.
  const terrainCache = new Array<(CellTerrain & { height01: number }) | undefined>(width * height);

  const terrainAt = (x: number, y: number): CellTerrain & { height01: number } => {
    const key = toId(x, y);
    const cached = terrainCache[key];

    if (cached) return cached;

    const elev = elevation.elevation(x, y);
    const riverDistance = rivers.distance[key] ?? Infinity;
    const isWater = rivers.water.has(key);

    // A slope is any block with a lower neighbour: canyon-adjacent, or simply
    // higher than the land beside it (GDD 3.6.2).
    let slope = false;

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;

      if (!inBounds(nx, ny)) continue;

      if (elevation.elevation(nx, ny) < elev) {
        slope = true;
        break;
      }
    }

    const riverBoost =
      riverDistance <= NOISE.riverMoistureRange
        ? NOISE.riverMoistureBoost * (1 - riverDistance / (NOISE.riverMoistureRange + 1))
        : 0;
    const moisture = Math.min(1, moistureField.base(x, y) + riverBoost);

    const cell = {
      elevation: elev,
      slope,
      moisture,
      riverDistance,
      isWater,
      height01: elevation.height01(x, y),
    };

    terrainCache[key] = cell;
    return cell;
  };

  const baseBiomeAt = (x: number, y: number): Biome => classifyBiome(terrainAt(x, y));

  // ── Map-scale features ──────────────────────────────────────────────────
  const featureInputs = {
    width,
    height,
    biomeAt: baseBiomeAt,
    elevationAt: (x: number, y: number) => terrainAt(x, y).elevation,
    riverDistanceAt: (x: number, y: number) => terrainAt(x, y).riverDistance,
  };
  const protectedCells = findProtectedForest(featureInputs);
  const isProtected = (x: number, y: number): boolean => protectedCells.has(toId(x, y));
  const start = findStartSite(featureInputs, isProtected);
  const villageCells = findVillages(
    featureInputs,
    isProtected,
    start,
    forkRng(seed, NOISE_TAG.villages),
  );

  const generatedCache = new Array<GeneratedBlock | undefined>(width * height);

  const generated = (x: number, y: number): GeneratedBlock => {
    if (!inBounds(x, y))
      throw new RangeError(`block (${x}, ${y}) is outside the ${width}x${height} world`);

    const key = toId(x, y);
    const cached = generatedCache[key];

    if (cached) return cached;

    const terrain = terrainAt(x, y);
    const protectedHere = isProtected(x, y);
    const biome: Biome = protectedHere
      ? 'protected'
      : villageCells.has(key)
        ? 'village'
        : baseBiomeAt(x, y);

    const block: GeneratedBlock = {
      biome,
      elevation: terrain.elevation,
      height01: terrain.height01,
      slope: terrain.slope,
      moisture: terrain.moisture,
      forSale: BIOMES[biome].forSale,
      isProtected: protectedHere,
    };

    generatedCache[key] = block;
    return block;
  };

  const params: WorldGenParams = {
    seed,
    width,
    height,
    startX: start.x,
    startY: start.y,
    startSize: start.size,
    kopdesBlock: toId(start.kopdesX, start.kopdesY),
    riverCount: rivers.count,
  };

  const block = (x: number, y: number): Block => {
    const g = generated(x, y);

    return {
      id: toId(x, y),
      biome: g.biome,
      phase: 'wild',
      clearProgress: 0,
      debris: 0,
      irrigated: false,
      fertilizedUntil: -1,
      beetles: 0,
      trapsUntil: -1,
      metarhiziumUntil: -1,
      trichodermaUntil: -1,
      lastHarvest: -1,
      plagued: false,
      moisture: g.moisture,
      drained: false,
      burning: false,
      fireIntensity: 0,
      ashUntil: -1,
      bannedUntil: -1,
      owned: false,
      forSale: g.forSale,
      elevation: g.elevation,
      slope: g.slope,
      coverCropUntil: -1,
      landslideAt: -1,
      landslidePalms: 0,
      excavateUntil: -1,
      fellingUntil: -1,
      species: 'palm',
    };
  };

  return {
    params,
    width,
    height,
    rivers,
    start,
    generated,
    block,
    blockById: (id) => {
      const [x, y] = toXY(id);

      return block(x, y);
    },
    inBounds,
    toId,
    toXY,
    estateCode: estateCodeFor(seed),
  };
}

// ── Estate code ───────────────────────────────────────────────────────────
// Base-32 without ambiguous glyphs (no 0/O, 1/I/L), grouped for reading aloud.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function estateCodeFor(seed: number): string {
  let value = seed >>> 0;
  let code = '';

  for (let i = 0; i < 7; i++) {
    code = ALPHABET[value % ALPHABET.length]! + code;
    value = Math.floor(value / ALPHABET.length);
  }

  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * FNV-1a over the code points, so a phrase lands somewhere unrelated to its
 * neighbours: "penyawit handal" and "penyawit handan" are different estates.
 */
function hashWords(words: string): number {
  let hash = 0x811c9dc5;

  for (const ch of words) {
    hash = Math.imul(hash ^ ch.codePointAt(0)!, 0x01000193);
  }

  // One final mix: FNV leaves the low bits of short strings a little ordered,
  // and the low bits are what the worldgen fields read first.
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  return (hash ^ (hash >>> 15)) >>> 0;
}

/** Any words name a world (GDD 4.6): a 7-symbol code decodes exactly, other text is hashed. */
export function seedFromEstateCode(code: string): number | null {
  // Letters and digits of any script; a phrase in Indonesian works as well as
  // one in English, and the separators a player puts between words do not.
  const clean = code
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

  if (clean === '') {
    // Nothing usable, but not empty: emoji and punctuation still name a world.
    const raw = code.trim();

    return raw === '' ? null : hashWords(raw);
  }

  if (clean.length === 7 && [...clean].every((ch) => ALPHABET.includes(ch))) {
    let value = 0;

    for (const ch of clean) {
      value = value * ALPHABET.length + ALPHABET.indexOf(ch);
    }

    return value >>> 0;
  }

  return hashWords(clean);
}
