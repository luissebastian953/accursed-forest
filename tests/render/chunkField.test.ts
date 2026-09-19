import { describe, expect, it } from 'vitest';

import { BoxBuilder } from '@render/geometry/boxBuilder.ts';
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
import { growFence } from '@render/scene/props.ts';
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
    const diverged = new Map<number, DivergedBlockLite>([[planted.id, toLite(planted, 0)]]);

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

  it('a half-planted hectare reads as half planted', () => {
    const sim = createSim(42);
    const { world, state } = sim;
    const block = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    block.phase = 'planted';

    // Slots fill in order, so plant the first half of the rows and no more.
    const slots = WORLD.blockSide * WORLD.blockSide;
    const half = slots / 2;
    const plantedAt = new Int32Array(slots).fill(-1);
    for (let i = 0; i < half; i++) plantedAt[i] = 0;

    const lite = toLite(block, 0, false, { plantedAt });
    const [cx, cy] = chunkOfBlock(world, block.id);
    const field = buildChunkField(world, cx, cy, new Map([[block.id, lite]]));

    const [bx, by] = world.toXY(block.id);
    const localX = (bx - cx * WORLD.chunkSide) * WORLD.blockSide + field.inset!;
    const localZ = (by - cy * WORLD.chunkSide) * WORLD.blockSide + field.inset!;

    for (let z = 0; z < WORLD.blockSide; z++) {
      for (let x = 0; x < WORLD.blockSide; x++) {
        const i = (localZ + z) * field.size + (localX + x);
        const occupied = plantedAt[z * WORLD.blockSide + x]! >= 0;
        // Green where something stands; bare earth, mottled with stone,
        // where nothing does.
        if (occupied) {
          expect(field.topSlots[i], `slot ${z * WORLD.blockSide + x}`).toBe(Palette.Terrace);
        } else {
          expect(
            [Palette.Dirt, Palette.Rock, Palette.Laterite],
            `slot ${z * WORLD.blockSide + x}`,
          ).toContain(field.topSlots[i]);
        }
        // And the ground is still a terrace either way: it is one hectare.
        expect(field.heights[i]).toBe(terraceHeight(block.elevation));
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
      const lite: DivergedBlockLite = { ...toLite(block, 0), phase, burning };
      const f = buildChunkField(world, cx, cy, new Map([[block.id, lite]]));
      const lx = (bx - cx * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 5;
      const lz = (by - cy * WORLD.chunkSide) * WORLD.blockSide + f.inset! + 5;
      return f.topSlots[lz * f.size + lx]!;
    };

    expect(slotAt('cleared')).toBe(Palette.Laterite);
    expect(slotAt('kopdes')).toBe(Palette.Laterite);
    expect(slotAt('reforesting')).toBe(Palette.Terrace);
    expect([Palette.Charcoal, Palette.CharredGround, Palette.Ash]).toContain(slotAt('wild', true));
  });

  /** The river's surface: light blue, with the darker pools that texture it. */
  const RIVER_SLOTS = new Set<number>([Palette.River, Palette.RiverDeep]);

  it('water follows the smoothed channel: every river block holds water, and none strays far', () => {
    const world = createWorld(42);
    const blocks = new Map<number, { water: number }>();
    const seen = new Set<string>();
    for (const key of world.rivers.water) {
      const [cx, cy] = chunkOfBlock(world, key);
      if (seen.has(`${cx}:${cy}`)) continue;
      seen.add(`${cx}:${cy}`);
      const f = buildChunkField(world, cx, cy, EMPTY);
      for (let z = f.inset!; z < f.size - f.inset!; z++) {
        for (let x = f.inset!; x < f.size - f.inset!; x++) {
          if (!RIVER_SLOTS.has(f.topSlots[z * f.size + x]!)) continue;
          const bx = Math.floor((f.originX! + x - f.inset!) / WORLD.blockSide);
          const by = Math.floor((f.originZ! + z - f.inset!) / WORLD.blockSide);
          const id = world.toId(bx, by);
          expect(world.rivers.distance[id]).toBeLessThanOrEqual(2);
          const entry = blocks.get(id) ?? { water: 0 };
          entry.water += 1;
          blocks.set(id, entry);
        }
      }
      if (seen.size >= 6) break;
    }
    let river = 0;
    let wet = 0;
    for (const key of world.rivers.water) {
      const [cx, cy] = chunkOfBlock(world, key);
      if (!seen.has(`${cx}:${cy}`)) continue;
      river += 1;
      if ((blocks.get(key)?.water ?? 0) > 0) wet += 1;
    }
    expect(river).toBeGreaterThan(0);
    expect(wet / river).toBeGreaterThan(0.9);
  });

  it('the river is textured: mostly light blue, with a few deeper pools', () => {
    const world = createWorld(42);
    let light = 0;
    let deep = 0;
    for (const key of [...world.rivers.water].slice(0, 40)) {
      const [cx, cy] = chunkOfBlock(world, key);
      const f = buildChunkField(world, cx, cy, EMPTY);
      for (const slot of f.topSlots) {
        if (slot === Palette.River) light += 1;
        else if (slot === Palette.RiverDeep) deep += 1;
      }
    }
    expect(light).toBeGreaterThan(0);
    const share = deep / (light + deep);
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.35);
  });

  it('wild ground is not one flat colour per block', () => {
    const world = createWorld(42);
    const f = buildChunkField(world, 6, 6, EMPTY);
    expect(new Set(f.topSlots).size).toBeGreaterThan(3);
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
      // §6.7: ~6–10k triangles per culled 48×48 chunk, plus the trees and
      // rocks merged into it (a chunk of protected forest is the worst case).
      expect(arrays.triangles).toBeLessThan(30_000);
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

describe('the fence along the crop (§6.3)', () => {
  /** Triangles the fence adds for one block with this occupancy. */
  function fenceTriangles(planted: Uint8Array): number {
    const builder = new BoxBuilder();
    growFence(builder, { bx: 0, by: 0, y: 0, planted });
    return builder.triangleCount;
  }

  const slots = WORLD.blockSide * WORLD.blockSide;

  it('is built only where the crop meets bare ground', () => {
    // A full hectare has no inside edge, so there is nothing to fence.
    expect(fenceTriangles(new Uint8Array(slots).fill(1))).toBe(0);
    // An empty one has no crop to fence in.
    expect(fenceTriangles(new Uint8Array(slots))).toBe(0);

    // Half planted: one straight run across the block, and no more.
    const half = new Uint8Array(slots);
    for (let i = 0; i < slots / 2; i++) half[i] = 1;
    const straight = fenceTriangles(half);
    expect(straight).toBeGreaterThan(0);

    // A ragged edge is a longer fence than a straight one.
    const ragged = new Uint8Array(slots);
    for (let i = 0; i < slots; i++) {
      const row = Math.floor(i / WORLD.blockSide);
      ragged[i] = row < 6 || (row === 6 && i % WORLD.blockSide < 4) ? 1 : 0;
    }
    expect(fenceTriangles(ragged)).toBeGreaterThan(straight);
  });

  it('costs nothing on a hectare nobody has planted', () => {
    // The mask only exists for planted and reforesting blocks, so the common
    // case never reaches the fence at all.
    const sim = createSim(42);
    const block = [...sim.state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    expect(toLite(block, 0).planted).toBeNull();
  });
});
