/**
 * Wild vegetation and rocks (§6.1, §6.3): box trees in the forest, taller and
 * darker ones in protected forest, rubber in rows, bushes on scrub, tufts on
 * grassland, boulders on the hills, reeds along the water.
 *
 * Props are merged into the chunk mesh the worker builds, so they stream,
 * cull and rebuild with the terrain: chop a forest block and its chunk is
 * remeshed without the trees. Placement is a jittered grid per block with a
 * hash of (seed, block, index), so a block always grows the same trees.
 * Nothing grows on a block that has left the wild.
 */

import { Matrix4 } from 'three';

import { WORLD } from '@sim/balance/world';
import type { Biome } from '@sim/types';

import type { BoxBuilder } from '../geometry/boxBuilder.ts';
import type { ColumnField } from '../geometry/terrain.ts';
import { Palette } from '../materials/paletteSlots.ts';

const SIDE = WORLD.blockSide;
const SKIP_BOTTOM = { ny: true } as const;

/** Deterministic 0..1 from three integers. */
export function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export interface PropBlock {
  id: number;
  /** Block coordinates. */
  bx: number;
  by: number;
  biome: Biome;
  burning: boolean;
}

export interface PropContext {
  seed: number;
  field: ColumnField;
  /** Signed distance to the river's edge, in columns (see `riverChannel.ts`). */
  riverEdge(gx: number, gz: number): number;
  /** The biome the ground at a column shows, after edge warping. */
  lookBiome(gx: number, gz: number, own: Biome): Biome;
}

const _m = new Matrix4();
const _r = new Matrix4();

class Grower {
  private n = 0;

  constructor(
    private readonly b: BoxBuilder,
    private readonly ctx: PropContext,
    private readonly block: PropBlock,
  ) {}

  riverEdge(x: number, z: number): number {
    return this.ctx.riverEdge(Math.floor(x), Math.floor(z));
  }

  rand(): number {
    return hash01(this.ctx.seed, this.block.id, this.n++);
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.rand();
  }

  /** Ground height under world column (gx, gz), or null over water or off the field. */
  ground(gx: number, gz: number): number | null {
    const f = this.ctx.field;
    const inset = f.inset ?? 0;
    const lx = Math.floor(gx) - (f.originX ?? 0) + inset;
    const lz = Math.floor(gz) - (f.originZ ?? 0) + inset;
    if (lx < inset || lz < inset || lx >= f.size - inset || lz >= f.size - inset) return null;
    const slot = f.topSlots[lz * f.size + lx]!;
    if (slot === Palette.Water || slot === Palette.WaterShallow) return null;
    return f.heights[lz * f.size + lx]!;
  }

  box(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    slot: number,
    turn: number,
  ) {
    // Keep the turned footprint inside the block, and so inside its chunk.
    const half = Math.max(sx, sz) * Math.SQRT1_2;
    const x0 = this.block.bx * SIDE;
    const z0 = this.block.by * SIDE;
    const cx = Math.min(x0 + SIDE - half, Math.max(x0 + half, x));
    const cz = Math.min(z0 + SIDE - half, Math.max(z0 + half, z));
    _m.makeScale(sx, sy, sz);
    _r.makeRotationY(turn);
    _m.premultiply(_r).setPosition(cx, y + sy / 2, cz);
    this.b.addBox(_m, { side: slot }, SKIP_BOTTOM);
  }

  /**
   * Visit a jittered grid of `cells`×`cells` spots in the block, each taken
   * with probability `p`. `margin` keeps a prop of that half-width inside the
   * block, and so inside its chunk.
   */
  scatter(
    cells: number,
    p: number,
    margin: number,
    jitter: boolean,
    place: (x: number, z: number) => void,
  ) {
    const cell = SIDE / cells;
    const x0 = this.block.bx * SIDE;
    const z0 = this.block.by * SIDE;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const take = this.rand() < p;
        const jx = jitter ? this.rand() : 0.5;
        const jz = jitter ? this.rand() : 0.5;
        if (!take) continue;
        const x = Math.min(x0 + SIDE - margin, Math.max(x0 + margin, x0 + (i + jx) * cell));
        const z = Math.min(z0 + SIDE - margin, Math.max(z0 + margin, z0 + (j + jz) * cell));
        place(x, z);
      }
    }
  }

  tree(x: number, z: number, scale: number, canopies: readonly number[], charred: boolean) {
    const y = this.ground(x, z);
    if (y === null) return;
    const turn = this.range(0, Math.PI / 2);
    const trunk = this.range(1.1, 2) * scale;
    const girth = 0.35 * Math.max(0.8, scale);
    this.box(x, y, z, girth, trunk, girth, charred ? Palette.Charcoal : Palette.Bark, turn);
    if (charred) return;
    const width = this.range(1.9, 2.8) * scale;
    const height = this.range(1.5, 2.3) * scale;
    const slot = canopies[Math.floor(this.rand() * canopies.length)]!;
    this.box(x, y + trunk * 0.85, z, width, height, width, slot, turn);
    if (this.rand() < 0.55) {
      const top = width * this.range(0.5, 0.7);
      this.box(x, y + trunk * 0.85 + height * 0.8, z, top, height * 0.7, top, slot, turn + 0.4);
    }
  }

  bush(x: number, z: number, width: number, height: number, slot: number) {
    const y = this.ground(x, z);
    if (y === null) return;
    this.box(x, y, z, width, height, width * this.range(0.7, 1), slot, this.range(0, Math.PI / 2));
  }
}

const CANOPY = [Palette.Canopy, Palette.Canopy, Palette.CanopyLight, Palette.CanopyDark] as const;
const CANOPY_OLD = [Palette.CanopyDark, Palette.CanopyDark, Palette.Canopy] as const;
const RUBBER = [Palette.CanopyLight] as const;

/** Candidate spots per block side; each spot grows at most one prop. */
const SPOTS = 6;

type Grow = (g: Grower, x: number, z: number, charred: boolean) => void;

/** Per-spot chances by biome, in order; the rest of the time nothing grows. */
const TABLE: Partial<Record<Biome, readonly (readonly [number, Grow])[]>> = {
  forest: [[0.4, (g, x, z, c) => g.tree(x, z, g.range(0.85, 1.15), CANOPY, c)]],
  protected: [
    [0.12, (g, x, z, c) => g.tree(x, z, g.range(1.35, 1.6), CANOPY_OLD, c)],
    [0.45, (g, x, z, c) => g.tree(x, z, g.range(1.05, 1.3), CANOPY_OLD, c)],
  ],
  riverbank: [
    [0.08, (g, x, z, c) => g.tree(x, z, g.range(0.7, 0.95), CANOPY, c)],
    [
      0.55,
      (g, x, z, c) => {
        if (c) return;
        const edge = g.riverEdge(x, z);
        if (edge >= 0 && edge <= 3) g.bush(x, z, 0.25, g.range(0.9, 1.6), Palette.Reed);
      },
    ],
  ],
  grassfield: [
    [0.015, (g, x, z, c) => !c && g.tree(x, z, g.range(0.7, 0.9), CANOPY, false)],
    [0.045, (g, x, z, c) => !c && g.bush(x, z, g.range(1, 1.5), g.range(0.7, 1), Palette.Bush)],
    [
      0.3,
      (g, x, z, c) =>
        !c &&
        g.bush(x, z, 0.5, g.range(0.35, 0.6), g.rand() < 0.5 ? Palette.GrassLight : Palette.Reed),
    ],
  ],
  scrub: [
    [0.07, (g, x, z, c) => !c && g.bush(x, z, g.range(0.6, 1.1), g.range(0.4, 0.7), Palette.Rock)],
    [
      0.25,
      (g, x, z, c) =>
        !c &&
        g.bush(
          x,
          z,
          g.range(1, 1.8),
          g.range(0.6, 1.1),
          g.rand() < 0.6 ? Palette.Bush : Palette.ScrubDark,
        ),
    ],
  ],
  hills: [
    [
      0.14,
      (g, x, z) =>
        g.bush(
          x,
          z,
          g.range(0.8, 2),
          g.range(0.5, 1.4),
          g.rand() < 0.5 ? Palette.Rock : Palette.RockDark,
        ),
    ],
    [0.05, (g, x, z, c) => !c && g.tree(x, z, g.range(0.7, 0.95), CANOPY, false)],
    [0.2, (g, x, z, c) => !c && g.bush(x, z, 0.5, g.range(0.3, 0.5), Palette.GrassLight)],
  ],
};

/**
 * Grow the props of one wild block into the chunk's builder. Each spot asks
 * `lookBiome` what the ground there shows — the same warped edges the ground
 * colour uses — so a forest's edge wanders across the block grid with it.
 * Rubber is planted in rows and ignores the warp.
 */
export function growBlock(b: BoxBuilder, ctx: PropContext, block: PropBlock): void {
  const g = new Grower(b, ctx, block);
  const charred = block.burning;

  if (block.biome === 'rubber') {
    g.scatter(4, 0.95, 1.2, false, (x, z) => g.tree(x, z, 0.8, RUBBER, charred));
    return;
  }

  g.scatter(SPOTS, 1, 0.3, true, (x, z) => {
    const biome = ctx.lookBiome(Math.floor(x), Math.floor(z), block.biome);
    const table = TABLE[biome === 'rubber' ? block.biome : biome];
    if (!table) return;
    let roll = g.rand();
    for (const [p, grow] of table) {
      if (roll < p) {
        grow(g, x, z, charred);
        return;
      }
      roll -= p;
    }
  });
}
