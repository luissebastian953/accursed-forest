import { describe, expect, it } from 'vitest';

import { buildColumnArrays } from '@render/geometry/terrain.ts';
import { Palette } from '@render/materials/paletteSlots.ts';
import {
  CHUNK_COLUMNS,
  ELEVATION_STEP,
  HEIGHT_QUANTUM,
  buildChunkArrays,
  buildChunkField,
  chunkOfBlock,
  terraceHeight,
  toLite,
  type DivergedBlockLite,
} from '@render/scene/chunkField.ts';
import { WORLD } from '@sim/balance/world.ts';
import { createSim } from '@sim/index.ts';
import { createWorld } from '@sim/worldgen/index.ts';

const EMPTY: ReadonlyMap<number, DivergedBlockLite> = new Map();

describe('chunk field (§6.3, §6.7)', () => {
  it('covers the chunk plus a one-column border, quantised to half units', () => {
    const world = createWorld(42);
    const field = buildChunkField(world, 3, 3, EMPTY);

    expect(field.size).toBe(CHUNK_COLUMNS + 2);
    expect(field.inset).toBe(1);
    expect(field.originX).toBe(3 * CHUNK_COLUMNS);
    expect(field.originZ).toBe(3 * CHUNK_COLUMNS);

    for (const h of field.heights) {
      expect(h).toBeGreaterThanOrEqual(field.floorY);
      expect(Math.abs(h / HEIGHT_QUANTUM - Math.round(h / HEIGHT_QUANTUM))).toBeLessThan(1e-6);
    }
  });

  it('never produces a one-column pit on wild land', () => {
    // Bilinear blending is monotone between block centres, so no interior
    // column can be lower than all four of its neighbours by a full step.
    const world = createWorld(42);
    for (const [cx, cy] of [
      [4, 4],
      [8, 6],
      [10, 10],
    ] as const) {
      const f = buildChunkField(world, cx, cy, EMPTY);
      const at = (x: number, z: number): number => f.heights[z * f.size + x]!;
      let pits = 0;
      for (let z = 2; z < f.size - 2; z++) {
        for (let x = 2; x < f.size - 2; x++) {
          const h = at(x, z);
          const lowestNeighbour = Math.min(at(x + 1, z), at(x - 1, z), at(x, z + 1), at(x, z - 1));
          if (h < lowestNeighbour - HEIGHT_QUANTUM * 1.5) pits += 1;
        }
      }
      expect(pits).toBe(0);
    }
  });

  it('terraces planted blocks flat at the block base height', () => {
    const sim = createSim(42);
    const { world, state } = sim;
    const planted = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    planted.phase = 'planted';
    const diverged = new Map<number, DivergedBlockLite>([[planted.id, toLite(planted)]]);

    const [cx, cy] = chunkOfBlock(world, planted.id);
    const field = buildChunkField(world, cx, cy, diverged);

    const [bx, by] = world.toXY(planted.id);
    const localX = (bx - cx * WORLD.chunkSide) * WORLD.blockSide + field.inset!;
    const localZ = (by - cy * WORLD.chunkSide) * WORLD.blockSide + field.inset!;
    const expected = terraceHeight(planted.elevation);

    for (let z = 0; z < WORLD.blockSide; z++) {
      for (let x = 0; x < WORLD.blockSide; x++) {
        const i = (localZ + z) * field.size + (localX + x);
        expect(field.heights[i]).toBe(expected);
        expect(field.topSlots[i]).toBe(Palette.Terrace);
      }
    }
  });

  it('paints tops by phase and biome', () => {
    const sim = createSim(42);
    const { world, state } = sim;
    const block = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    const [cx, cy] = chunkOfBlock(world, block.id);
    const [bx, by] = world.toXY(block.id);

    const slotAt = (phase: DivergedBlockLite['phase'], burning = false): number => {
      const lite: DivergedBlockLite = { ...toLite(block), phase, burning };
      const f = buildChunkField(world, cx, cy, new Map([[block.id, lite]]));
      const lx = (bx - cx * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 5;
      const lz = (by - cy * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 5;
      return f.topSlots[lz * f.size + lx]!;
    };

    expect(slotAt('cleared')).toBe(Palette.Laterite);
    expect(slotAt('kopdes')).toBe(Palette.Laterite);
    expect(slotAt('reforesting')).toBe(Palette.Terrace);
    expect(slotAt('wild', true)).toBe(Palette.Charcoal);
  });

  it('water sits below the land and river tops are painted as water', () => {
    const world = createWorld(42);
    let checked = 0;
    for (const key of world.rivers.water) {
      const [bx, by] = world.toXY(key);
      const [cx, cy] = chunkOfBlock(world, key);
      const f = buildChunkField(world, cx, cy, EMPTY);
      const lx = (bx - cx * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 6;
      const lz = (by - cy * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 6;
      expect(f.topSlots[lz * f.size + lx]).toBe(Palette.Water);
      checked += 1;
      if (checked >= 5) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('elevation steps are visible: a level-2 block is a full step above level 1', () => {
    expect(terraceHeight(2) - terraceHeight(1)).toBe(ELEVATION_STEP);
    expect(ELEVATION_STEP / HEIGHT_QUANTUM).toBe(Math.round(ELEVATION_STEP / HEIGHT_QUANTUM));
  });
});

describe('chunk mesh (§6.7 budgets)', () => {
  it('meshes a chunk inside the triangle budget with faces culled', () => {
    const world = createWorld(42);
    for (const [cx, cy] of [
      [0, 0],
      [7, 7],
      [15, 15],
      [8, 3],
    ] as const) {
      const arrays = buildChunkArrays(world, cx, cy, EMPTY);
      expect(arrays.triangles).toBeGreaterThan(CHUNK_COLUMNS * CHUNK_COLUMNS * 2 - 1); // at least every top
      // §6.7: ~6–10k triangles per culled 48×48 chunk. Full boxes would be 27k.
      expect(arrays.triangles).toBeLessThan(14_000);
      expect(arrays.positions.length).toBe(arrays.triangles * 9);
      expect(arrays.normals.length).toBe(arrays.triangles * 9);
      expect(arrays.paletteU.length).toBe(arrays.triangles * 3);
    }
  });

  it('the inset border is not emitted: every vertex lies inside the chunk footprint', () => {
    const world = createWorld(42);
    const cx = 5;
    const cy = 6;
    const arrays = buildChunkArrays(world, cx, cy, EMPTY);
    const minX = cx * CHUNK_COLUMNS;
    const minZ = cy * CHUNK_COLUMNS;
    for (let i = 0; i < arrays.positions.length; i += 3) {
      const x = arrays.positions[i]!;
      const z = arrays.positions[i + 2]!;
      expect(x).toBeGreaterThanOrEqual(minX - 1e-6);
      expect(x).toBeLessThanOrEqual(minX + CHUNK_COLUMNS + 1e-6);
      expect(z).toBeGreaterThanOrEqual(minZ - 1e-6);
      expect(z).toBeLessThanOrEqual(minZ + CHUNK_COLUMNS + 1e-6);
    }
  });

  it('adjacent chunks meet without a wall: border faces are culled against the neighbour', () => {
    const world = createWorld(42);
    const a = buildChunkField(world, 5, 6, EMPTY);
    const b = buildChunkField(world, 6, 6, EMPTY);
    // a's east border column must equal b's first emitted column, so a's
    // eastmost emitted faces are culled exactly where b's land begins.
    for (let z = 0; z < a.size; z++) {
      expect(a.heights[z * a.size + (a.size - 1)]).toBe(b.heights[z * b.size + 1]);
    }
  });

  it('builds a chunk fast enough for the worker budget', () => {
    const world = createWorld(42);
    const t0 = performance.now();
    for (let i = 0; i < 8; i++) buildColumnArrays(buildChunkField(world, 4 + i, 4, EMPTY));
    const perChunk = (performance.now() - t0) / 8;
    expect(perChunk).toBeLessThan(40);
  });
});
