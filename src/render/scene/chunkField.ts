import { quantise } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { Biome, Block, BlockId, BlockPhase } from '@sim/types';
import { NOISE_TAG, noiseFor } from '@sim/worldgen/elevation';
import type { World } from '@sim/worldgen/index';

import type { MeshArrays } from '../geometry/boxBuilder.ts';
import { buildColumnArrays, type ColumnField } from '../geometry/terrain.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { growBlock, growFence, hash01 } from './props.ts';
import { buildRiverChannel, type RiverChannel } from './riverChannel.ts';

/** World units of height per elevation level. */
export const ELEVATION_STEP = 1.5;
/** Column heights snap to this (GDD 6.1: half-unit steps). */
export const HEIGHT_QUANTUM = 0.5;
/** Columns per chunk side: 4 blocks × 12 slots. */
export const CHUNK_COLUMNS = WORLD.chunkSide * WORLD.blockSide;
/** How far below the lowest land the diorama slab reaches. */
export const FLOOR_Y = -4;
/** River water sits this far below the land it cuts through. */
const WATER_DROP = 0.75;
/** Water may reach blocks at most this many cells from a river block. */
const WATER_REACH = 2;
/** Biome edges on wild land wander by up to this many columns. */
const EDGE_WARP = 3.2;
const EDGE_WARP_SCALE = 16;
const TINT_SCALE = 7;
/** Columns across a deep patch in the river; an offset keeps them off the land's tint pattern. */
const RIVER_PATCH_SCALE = 5;
const RIVER_PATCH_OFFSET = 311;

/** River water: light blue, with a few darker pools where the tint noise dips. */
function riverSlot(look: LandLook, gx: number, gz: number): number {
  const v =
    look.tint(
      (gx + RIVER_PATCH_OFFSET) / RIVER_PATCH_SCALE,
      (gz - RIVER_PATCH_OFFSET) / RIVER_PATCH_SCALE,
    ) +
    (hash01(gx, gz, 13) - 0.5) * 0.3;
  return v < -0.42 ? Palette.RiverDeep : Palette.River;
}

interface LandLook {
  channel: RiverChannel;
  tint: (x: number, y: number) => number;
  warp: (x: number, y: number) => number;
}

/** Per-world render extras: built once, reused by every chunk. */
const looks = new WeakMap<World, LandLook>();
function lookFor(world: World): LandLook {
  let look = looks.get(world);
  if (!look) {
    look = {
      channel: buildRiverChannel(world),
      tint: noiseFor(world.params.seed, NOISE_TAG.groundTint),
      warp: noiseFor(world.params.seed, NOISE_TAG.groundWarp),
    };
    looks.set(world, look);
  }
  return look;
}

/** Break up a wild biome's colour: lighter and darker patches. */
function tinted(slot: number, v: number): number {
  switch (slot) {
    case Palette.Grass:
      return v > 0.4 ? Palette.GrassLight : slot;
    case Palette.Forest:
      return v > 0.45 ? Palette.ForestLight : v < -0.5 ? Palette.ForestDark : slot;
    case Palette.Scrub:
      return v < -0.35 ? Palette.ScrubDark : slot;
    case Palette.Rock:
      return v < -0.35 ? Palette.RockDark : slot;
    case Palette.Sand:
      // Village ground: trodden paths through grass.
      return v > 0.1 ? Palette.GrassLight : v < -0.35 ? Palette.Dirt : slot;
    default:
      return slot;
  }
}

/** The subset of `Block` the mesher needs; what the worker is sent. */
export interface DivergedBlockLite {
  id: BlockId;
  biome: Biome;
  phase: BlockPhase;
  elevation: number;
  burning: boolean;
  /** Inside the post-burn ash window: the ground is grey, not laterite. */
  ashy: boolean;
  /** Under flood water right now: the top reads as shallow water. */
  flooded: boolean;
  /** The slope gave way here and nothing has been planted since (GDD 3.6.2). */
  slid: boolean;
  /**
   * Which of the block's slots have something standing in them, one byte per
   * slot, or null for a block with no palms at all. The ground grid is one
   * column per slot, so an empty slot is a column of bare earth: a hectare
   * planted with half the bibit it needed looks half planted.
   */
  planted: Uint8Array | null;
}

export function toLite(
  block: Readonly<Block>,
  tick: number,
  flooded = false,
  palms?: { plantedAt: Int32Array | ArrayLike<number> } | undefined,
): DivergedBlockLite {
  let planted: Uint8Array | null = null;
  if (palms && (block.phase === 'planted' || block.phase === 'reforesting')) {
    const slots = palms.plantedAt.length;
    planted = new Uint8Array(slots);
    for (let i = 0; i < slots; i++) planted[i] = palms.plantedAt[i]! >= 0 ? 1 : 0;
  }
  return {
    id: block.id,
    biome: block.biome,
    phase: block.phase,
    elevation: block.elevation,
    burning: block.burning,
    ashy: block.ashUntil > tick,
    flooded,
    slid: block.landslideAt >= 0,
    planted,
  };
}

/** Height of a levelled terrace on a block of the given elevation. */
export function terraceHeight(elevation: number): number {
  return elevation * ELEVATION_STEP;
}

const TERRACED: ReadonlySet<BlockPhase> = new Set(['cleared', 'planted', 'reforesting', 'kopdes']);

/**
 * The height of the land the mesher draws under world point (x, z): a flat
 * terrace on cleared, planted and Kopdes blocks, otherwise the same bilinear
 * blend of neighbouring block heights the columns use, snapped to the same
 * quantum. Anything standing on the ground; mobs, cars, felled trees; must
 * use this, or it floats or sinks wherever the two formulas disagree. (The
 * river's cut is not applied; nothing should be standing in the river.)
 */
export function landHeight(
  world: World,
  phaseOf: (id: BlockId) => BlockPhase,
  x: number,
  z: number,
): number {
  const side = WORLD.blockSide;
  const bx = Math.floor(x / side);
  const by = Math.floor(z / side);
  if (!world.inBounds(bx, by)) return FLOOR_Y;
  if (TERRACED.has(phaseOf(world.toId(bx, by)))) {
    return terraceHeight(world.generated(bx, by).elevation);
  }
  const gx = Math.floor(x);
  const gz = Math.floor(z);
  const u = (gx + 0.5) / side - 0.5;
  const v = (gz + 0.5) / side - 0.5;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const h00 = continuousHeight(world, x0, y0);
  const h10 = continuousHeight(world, x0 + 1, y0);
  const h01 = continuousHeight(world, x0, y0 + 1);
  const h11 = continuousHeight(world, x0 + 1, y0 + 1);
  const h = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
  return Math.max(FLOOR_Y + HEIGHT_QUANTUM, quantise(h, HEIGHT_QUANTUM));
}

/** Continuous height of a block's land before quantising. */
function continuousHeight(world: World, bx: number, by: number): number {
  const x = Math.min(world.width - 1, Math.max(0, bx));
  const y = Math.min(world.height - 1, Math.max(0, by));
  return world.generated(x, y).height01 * (WORLD.maxElevation + 1) * ELEVATION_STEP;
}

function topSlot(
  biome: Biome,
  phase: BlockPhase,
  burning: boolean,
  ashy: boolean,
  flooded: boolean,
  slid = false,
): number {
  if (burning) return Palette.Charcoal;
  if (flooded) return Palette.WaterShallow;
  // Torn open: bare earth, whatever the block was before the slope went.
  if (slid) return Palette.Dirt;
  switch (phase) {
    case 'planted':
    case 'reforesting':
      return Palette.Terrace;
    case 'cleared':
      return ashy ? Palette.CharredGround : Palette.Laterite;
    case 'clearing':
    case 'kopdes':
      return Palette.Laterite;
    case 'wild':
      break;
  }
  switch (biome) {
    case 'grassfield':
      return Palette.Grass;
    case 'forest':
      return Palette.Forest;
    case 'protected':
      return Palette.ForestDark;
    case 'scrub':
      return Palette.Scrub;
    case 'hills':
      return Palette.Rock;
    case 'riverbank':
      return Palette.Terrace;
    case 'river':
      return Palette.River;
    case 'peat':
      return Palette.Peat;
    case 'rubber':
      return Palette.ForestDark;
    case 'village':
      return Palette.Sand;
    case 'swamp':
      return Palette.WaterShallow;
  }
}

/**
 * Build the column field for chunk (cx, cy). `diverged` holds the estate's
 * blocks by id; anything not in it is read from the generator.
 */
export function buildChunkField(
  world: World,
  cx: number,
  cy: number,
  diverged: ReadonlyMap<BlockId, DivergedBlockLite>,
): ColumnField {
  const inset = 1;
  const size = CHUNK_COLUMNS + inset * 2;
  const heights = new Float32Array(size * size);
  const topSlots = new Uint16Array(size * size);

  const originX = cx * CHUNK_COLUMNS;
  const originZ = cy * CHUNK_COLUMNS;
  const side = WORLD.blockSide;
  const look = lookFor(world);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      // World column coordinates, including the one-column border.
      const gx = originX + x - inset;
      const gz = originZ + z - inset;
      const i = z * size + x;

      const bx = Math.floor(gx / side);
      const by = Math.floor(gz / side);

      if (!world.inBounds(bx, by)) {
        heights[i] = FLOOR_Y;
        topSlots[i] = Palette.Rock;
        continue;
      }

      const lite = diverged.get(world.toId(bx, by));
      const generated = world.generated(bx, by);
      const biome = lite?.biome ?? generated.biome;
      const phase = lite?.phase ?? 'wild';
      const burning = lite?.burning ?? false;
      const ashy = lite?.ashy ?? false;
      const flooded = lite?.flooded ?? false;
      const slid = lite?.slid ?? false;

      if (TERRACED.has(phase)) {
        heights[i] = terraceHeight(generated.elevation);
      } else {
        // Bilinear blend of the four nearest block centres.
        const u = (gx + 0.5) / side - 0.5;
        const v = (gz + 0.5) / side - 0.5;
        const x0 = Math.floor(u);
        const y0 = Math.floor(v);
        const fx = u - x0;
        const fy = v - y0;

        const h00 = continuousHeight(world, x0, y0);
        const h10 = continuousHeight(world, x0 + 1, y0);
        const h01 = continuousHeight(world, x0, y0 + 1);
        const h11 = continuousHeight(world, x0 + 1, y0 + 1);
        let h = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;

        const nearRiver = (world.rivers.distance[world.toId(bx, by)] ?? Infinity) <= WATER_REACH;
        const edge = nearRiver ? look.channel.edge(gx, gz) : Infinity;
        if (edge < 0) {
          h -= WATER_DROP;
          heights[i] = Math.max(FLOOR_Y + HEIGHT_QUANTUM, quantise(h, HEIGHT_QUANTUM));
          topSlots[i] = flooded ? Palette.WaterShallow : riverSlot(look, gx, gz);
          continue;
        }
        heights[i] = Math.max(FLOOR_Y + HEIGHT_QUANTUM, quantise(h, HEIGHT_QUANTUM));

        if (!burning && !flooded) {
          // The water's edge is mud; a river block the channel missed is bank.
          if (edge < 1.2) {
            topSlots[i] = Palette.Bank;
            continue;
          }
          const lookBiome =
            biome === 'river' ? 'riverbank' : warpedBiome(world, diverged, gx, gz, biome, look);
          const slot = topSlot(lookBiome, 'wild', false, false, false);
          const v = look.tint(gx / TINT_SCALE, gz / TINT_SCALE) + (hash01(gx, gz, 7) - 0.5) * 0.5;
          topSlots[i] = tinted(slot, v);
          continue;
        }
      }

      // A planted hectare is only green where something stands. The ground
      // grid is one column per slot, so an empty slot is its own column of
      // bare earth, and a half-planted block reads as half planted.
      const bare =
        lite?.planted !== null &&
        lite?.planted !== undefined &&
        !burning &&
        !flooded &&
        !slid &&
        lite.planted[(gz - by * side) * side + (gx - bx * side)] === 0;
      // Bare ground is earth, which the mottling below turns into brown with
      // stony patches rather than one flat colour.
      const slot = bare ? Palette.Dirt : topSlot(biome, phase, burning, ashy, flooded, slid);
      // Burned ground is mottled char and ash, and torn ground is mottled
      // earth and stone: neither is one flat colour.
      topSlots[i] =
        slot === Palette.CharredGround || slot === Palette.Charcoal
          ? hash01(gx, gz, 11) < 0.12
            ? Palette.Ash
            : hash01(gx, gz, 12) < 0.5
              ? Palette.Charcoal
              : Palette.CharredGround
          : slot === Palette.Dirt
            ? hash01(gx, gz, 13) < 0.16
              ? Palette.Rock
              : hash01(gx, gz, 14) < 0.42
                ? Palette.Laterite
                : Palette.Dirt
            : slot;
    }
  }

  return {
    size,
    heights,
    topSlots,
    sideSlot: Palette.Laterite,
    deepSlot: Palette.Rock,
    floorY: FLOOR_Y,
    inset,
    originX,
    originZ,
  };
}

/**
 * The biome whose colour a wild column shows: its own, or a wild neighbour's
 * when the warped sample point lands there, so edges between wild biomes
 * wander instead of following the block grid. Estate blocks stay crisp.
 */
function warpedBiome(
  world: World,
  diverged: ReadonlyMap<BlockId, DivergedBlockLite>,
  gx: number,
  gz: number,
  biome: Biome,
  look: LandLook,
): Biome {
  const wx = look.warp(gx / EDGE_WARP_SCALE, gz / EDGE_WARP_SCALE) * EDGE_WARP;
  const wz = look.warp(gx / EDGE_WARP_SCALE + 31.7, gz / EDGE_WARP_SCALE - 12.3) * EDGE_WARP;
  const bx = Math.floor((gx + wx) / WORLD.blockSide);
  const by = Math.floor((gz + wz) / WORLD.blockSide);
  if (!world.inBounds(bx, by)) return biome;
  const id = world.toId(bx, by);
  const other = diverged.get(id);
  if (other && other.phase !== 'wild') return biome;
  const sampled = other?.biome ?? world.generated(bx, by).biome;
  return sampled === 'river' ? biome : sampled;
}

/** Field + mesh + props in one call; what the worker runs per request. */
export function buildChunkArrays(
  world: World,
  cx: number,
  cy: number,
  diverged: ReadonlyMap<BlockId, DivergedBlockLite>,
): MeshArrays {
  const field = buildChunkField(world, cx, cy, diverged);
  const look = lookFor(world);
  return buildColumnArrays(field, (builder) => {
    const ctx = {
      seed: world.params.seed,
      field,
      riverEdge: (gx: number, gz: number) => look.channel.edge(gx, gz),
      lookBiome: (gx: number, gz: number, own: Biome) =>
        warpedBiome(world, diverged, gx, gz, own, look),
    };
    for (let by = cy * WORLD.chunkSide; by < (cy + 1) * WORLD.chunkSide; by++) {
      for (let bx = cx * WORLD.chunkSide; bx < (cx + 1) * WORLD.chunkSide; bx++) {
        if (!world.inBounds(bx, by)) continue;
        const id = world.toId(bx, by);
        const lite = diverged.get(id);
        // Burned land keeps its snags through the ash window; other estate land is bare.
        const burnt = (lite?.burning ?? false) || (lite?.phase === 'cleared' && lite.ashy);
        // A slid block keeps its spoil and its snapped branches until it is
        // dug out or planted over.
        const slid = lite?.slid ?? false;
        // A planted hectare grows no scenery, but it is fenced along the
        // edge of the crop.
        if (lite?.planted !== null && lite?.planted !== undefined) {
          growFence(builder, {
            bx,
            by,
            y: terraceHeight(world.generated(bx, by).elevation),
            planted: lite.planted,
          });
        }
        if (lite && lite.phase !== 'wild' && !burnt && !slid) continue;
        const generated = world.generated(bx, by);
        growBlock(builder, ctx, {
          id,
          bx,
          by,
          biome: lite?.biome ?? generated.biome,
          elevation: generated.elevation,
          slope: generated.slope,
          burnt,
          slid,
        });
      }
    }
  });
}

/** Chunk coordinates of a block. */
export function chunkOfBlock(world: Pick<World, 'toXY'>, block: BlockId): [cx: number, cy: number] {
  const [x, y] = world.toXY(block);
  return [Math.floor(x / WORLD.chunkSide), Math.floor(y / WORLD.chunkSide)];
}
