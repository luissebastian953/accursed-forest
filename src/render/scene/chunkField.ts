/**
 * From world + estate to a column field for one chunk (§6.3, §6.7).
 *
 * Column height for wild land is the bilinear blend of the four nearest
 * blocks' continuous heights, quantised to half-unit steps — smooth ground
 * that reads as staircases, and never a one-column pit (bilinear is monotone
 * between samples; the art spike learned that lesson the hard way). Planted,
 * cleared and Kopdes blocks are levelled terraces at the block's base height,
 * cut into whatever the land around them does. Water sits a step below,
 * along the smoothed channel of `riverChannel.ts` rather than the river's
 * blocks, and wild ground is tinted and its biome edges warped by noise so
 * the land does not read as a checkerboard. Trees and rocks grow on top.
 *
 * Runs in the mesher worker, so it imports nothing that touches the renderer.
 */

import { quantise } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { Biome, Block, BlockId, BlockPhase } from '@sim/types';
import { NOISE_TAG, noiseFor } from '@sim/worldgen/elevation';
import type { World } from '@sim/worldgen/index';

import type { MeshArrays } from '../geometry/boxBuilder.ts';
import { buildColumnArrays, type ColumnField } from '../geometry/terrain.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { growBlock, hash01 } from './props.ts';
import { buildRiverChannel, type RiverChannel } from './riverChannel.ts';

/** World units of height per elevation level. */
export const ELEVATION_STEP = 1.5;
/** Column heights snap to this (§6.1: half-unit steps). */
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
}

export function toLite(block: Readonly<Block>, tick: number, flooded = false): DivergedBlockLite {
  return {
    id: block.id,
    biome: block.biome,
    phase: block.phase,
    elevation: block.elevation,
    burning: block.burning,
    ashy: block.ashUntil > tick,
    flooded,
  };
}

/** Height of a levelled terrace on a block of the given elevation. */
export function terraceHeight(elevation: number): number {
  return elevation * ELEVATION_STEP;
}

const TERRACED: ReadonlySet<BlockPhase> = new Set(['cleared', 'planted', 'reforesting', 'kopdes']);

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
): number {
  if (burning) return Palette.Charcoal;
  if (flooded) return Palette.WaterShallow;
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
      return Palette.Water;
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
          topSlots[i] = flooded ? Palette.WaterShallow : Palette.Water;
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

      const slot = topSlot(biome, phase, burning, ashy, flooded);
      // Burned ground is mottled char and ash, not one flat colour.
      topSlots[i] =
        slot === Palette.CharredGround || slot === Palette.Charcoal
          ? hash01(gx, gz, 11) < 0.12
            ? Palette.Ash
            : hash01(gx, gz, 12) < 0.5
              ? Palette.Charcoal
              : Palette.CharredGround
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

/** Field + mesh + props in one call — what the worker runs per request. */
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
        if (lite && lite.phase !== 'wild' && !burnt) continue;
        const generated = world.generated(bx, by);
        growBlock(builder, ctx, {
          id,
          bx,
          by,
          biome: lite?.biome ?? generated.biome,
          elevation: generated.elevation,
          slope: generated.slope,
          burnt,
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
