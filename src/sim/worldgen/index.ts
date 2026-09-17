/**
 * World generation entry point (§4.6).
 *
 * `createWorld(seed, width, height)` runs the map-scale passes once (rivers,
 * protected forest, start site) and returns a `World` whose `block(x, y)` is a
 * pure function of the seed and coordinates. Nothing about untouched land is
 * ever stored: `SimState.blocks` holds only blocks that diverged, and reading
 * any other block comes here.
 *
 * Determinism: every random draw comes from streams forked off the seed with a
 * fixed tag, so the same seed always produces the same world regardless of what
 * the main simulation stream has done.
 */

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
  /** Human-shareable code for this world (§4.6). */
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

  // ── Per-cell terrain, cached ────────────────────────────────────────────
  // A flat array is cheaper than an LRU here: at 64x64 the full cache is 4,096
  // entries, and the render worker regenerates chunks on demand anyway.
  const terrainCache = new Array<(CellTerrain & { height01: number }) | undefined>(width * height);

  const terrainAt = (x: number, y: number): CellTerrain & { height01: number } => {
    const key = toId(x, y);
    const cached = terrainCache[key];
    if (cached) return cached;

    const elev = elevation.elevation(x, y);
    const riverDistance = rivers.distance[key] ?? Infinity;
    const isWater = rivers.water.has(key);

    // A slope is any block with a lower neighbour: canyon-adjacent, or simply
    // higher than the land beside it (§3.6.2).
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

export function seedFromEstateCode(code: string): number | null {
  const clean = code.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (clean.length !== 7) return null;
  let value = 0;
  for (const ch of clean) {
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    value = value * ALPHABET.length + digit;
  }
  return value >>> 0;
}
