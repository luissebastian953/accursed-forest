/**
 * Where the scenery grows (§6.1, §6.3). The models live in `render/models/`;
 * this file is the ecology; which of them each kind of land carries, and
 * how thickly.
 *
 * - forest: rainforest trees, the odd emergent giant hung with vines, fallen
 *   logs, understory bushes and flowers, a weeping fig or a wood cabin now and then
 * - protected forest: the same, denser and older, more giants
 * - riverbank: willows, reeds at the water's edge, flowers
 * - grassland: tufts, wildflowers, bushes, a lone tree, rarely an abandoned house
 * - scrub: dry bushes, dead trees, cactus, tumbleweed, rocks
 * - hills: pines and boulders; spires and caves on the high ridges
 * - villages: stilt houses around a weeping fig
 * - burning, or burned within the ash window: charred snags on charred ground
 *
 * Props are merged into the chunk mesh the worker builds, so they stream and
 * rebuild with the terrain: chop a forest block and its chunk is remeshed
 * without the trees. Each block visits a jittered grid of spots, asks what the
 * ground there shows (the same warped edges the ground colour uses, so forest
 * edges wander across the block grid), and rolls that land's table. A hash of
 * (seed, block, draw) makes a block always grow the same things.
 */

import { WORLD } from '@sim/balance/world';
import type { Biome } from '@sim/types';

import type { BoxBuilder } from '../geometry/boxBuilder.ts';
import type { ColumnField } from '../geometry/terrain.ts';
import { Palette } from '../materials/paletteSlots.ts';
import { MODELS, ModelKit, type Model } from '../models/index.ts';

const SIDE = WORLD.blockSide;
/** Candidate spots per block side; each spot grows at most one thing. */
const SPOTS = 6;

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
  elevation: number;
  slope: boolean;
  /** On fire, or burned and still inside the ash window. */
  burnt: boolean;
  /** Torn open by a landslide and not put back yet. */
  slid: boolean;
}

export interface PropContext {
  seed: number;
  field: ColumnField;
  /** Signed distance to the river's edge, in columns (see `riverChannel.ts`). */
  riverEdge(gx: number, gz: number): number;
  /** The biome the ground at a column shows, after edge warping. */
  lookBiome(gx: number, gz: number, own: Biome): Biome;
}

interface Spot {
  x: number;
  z: number;
  block: PropBlock;
  ctx: PropContext;
}

/** One row of a land's table: a model, its chance per spot, and a scale range. */
interface Growth {
  model: Model;
  p: number;
  scale?: readonly [number, number];
  /** Only where this holds. */
  where?: (spot: Spot) => boolean;
}

const m = MODELS;
const nearWater = ({ x, z, ctx }: Spot): boolean => {
  const edge = ctx.riverEdge(Math.floor(x), Math.floor(z));
  return edge >= 0 && edge <= 3;
};
const high = ({ block }: Spot): boolean => block.elevation >= 2;
const summit = ({ block }: Spot): boolean => block.elevation >= 3;
const cliff = ({ block }: Spot): boolean => block.elevation >= 2 && block.slope;

const TABLE: Partial<Record<Biome, readonly Growth[]>> = {
  forest: [
    { model: m.giantTree, p: 0.02, scale: [0.9, 1.1] },
    { model: m.woodCabin, p: 0.003 },
    { model: m.weepingFig, p: 0.004 },
    { model: m.rainforestTree, p: 0.34, scale: [0.85, 1.2] },
    { model: m.fallenLog, p: 0.03 },
    { model: m.bush, p: 0.06 },
    { model: m.floweringBush, p: 0.02 },
    { model: m.flowers, p: 0.01 },
  ],
  protected: [
    { model: m.giantTree, p: 0.07, scale: [1, 1.2] },
    { model: m.rainforestTree, p: 0.42, scale: [1, 1.3] },
    { model: m.fallenLog, p: 0.04 },
    { model: m.bush, p: 0.05 },
  ],
  riverbank: [
    { model: m.reeds, p: 0.45, where: nearWater },
    { model: m.willowTree, p: 0.06, scale: [0.85, 1.1] },
    { model: m.rainforestTree, p: 0.03, scale: [0.75, 0.95] },
    { model: m.flowers, p: 0.05 },
    { model: m.bush, p: 0.03 },
    { model: m.boulders, p: 0.01, scale: [0.5, 0.8] },
  ],
  grassfield: [
    { model: m.abandonedHouse, p: 0.0015 },
    { model: m.weepingFig, p: 0.003 },
    { model: m.rainforestTree, p: 0.012, scale: [0.75, 0.95] },
    { model: m.floweringBush, p: 0.01 },
    { model: m.bush, p: 0.035 },
    { model: m.flowers, p: 0.06 },
    { model: m.boulders, p: 0.005, scale: [0.5, 0.8] },
    { model: m.grassTuft, p: 0.28 },
  ],
  scrub: [
    { model: m.abandonedHouse, p: 0.002 },
    { model: m.deadTree, p: 0.03 },
    { model: m.cactus, p: 0.03 },
    { model: m.tumbleweed, p: 0.04 },
    { model: m.bush, p: 0.14, scale: [0.7, 1] },
    { model: m.boulders, p: 0.06, scale: [0.6, 1] },
    { model: m.grassTuft, p: 0.06 },
  ],
  hills: [
    { model: m.cave, p: 0.008, where: cliff },
    { model: m.rockSpire, p: 0.05, where: summit, scale: [0.8, 1.2] },
    { model: m.woodCabin, p: 0.002 },
    { model: m.pineTree, p: 0.22, where: high, scale: [0.85, 1.2] },
    { model: m.pineTree, p: 0.06, scale: [0.8, 1] },
    { model: m.boulders, p: 0.11 },
    { model: m.deadTree, p: 0.02 },
    { model: m.grassTuft, p: 0.15 },
  ],
  peat: [
    { model: m.deadTree, p: 0.05 },
    { model: m.reeds, p: 0.2 },
  ],
  swamp: [
    { model: m.deadTree, p: 0.04 },
    { model: m.willowTree, p: 0.03 },
    { model: m.reeds, p: 0.35 },
  ],
  village: [
    { model: m.flowers, p: 0.1 },
    { model: m.bush, p: 0.04 },
    { model: m.grassTuft, p: 0.1 },
  ],
};

/** Lands whose trees leave snags behind when they burn, and how many per spot. */
const SNAGS: Partial<Record<Biome, number>> = {
  forest: 0.3,
  protected: 0.4,
  rubber: 0.3,
  riverbank: 0.08,
  hills: 0.06,
  scrub: 0.04,
  grassfield: 0.02,
};

class Grower {
  private n = 0;
  private readonly kit: ModelKit;

  constructor(
    builder: BoxBuilder,
    private readonly ctx: PropContext,
    private readonly block: PropBlock,
  ) {
    this.kit = new ModelKit(builder);
  }

  readonly rand = (): number => hash01(this.ctx.seed, this.block.id, this.n++);

  /** Ground height under a column, or null over water or outside the emitted field. */
  private ground(x: number, z: number): number | null {
    const f = this.ctx.field;
    const inset = f.inset ?? 0;
    const lx = Math.floor(x) - (f.originX ?? 0) + inset;
    const lz = Math.floor(z) - (f.originZ ?? 0) + inset;
    if (lx < inset || lz < inset || lx >= f.size - inset || lz >= f.size - inset) return null;
    const slot = f.topSlots[lz * f.size + lx]!;
    if (
      slot === Palette.River ||
      slot === Palette.RiverDeep ||
      slot === Palette.Water ||
      slot === Palette.WaterShallow
    )
      return null;
    return f.heights[lz * f.size + lx]!;
  }

  /** Grow `model` at (x, z), pulled inward so all of it stays inside the block. */
  grow(model: Model, x: number, z: number, scale: number): void {
    const reach = Math.min(SIDE / 2 - 0.01, model.radius * scale);
    const x0 = this.block.bx * SIDE;
    const z0 = this.block.by * SIDE;
    const px = Math.min(x0 + SIDE - reach, Math.max(x0 + reach, x));
    const pz = Math.min(z0 + SIDE - reach, Math.max(z0 + reach, z));
    const y = this.ground(px, pz);
    if (y === null) return;
    this.kit.at({ x: px, y, z: pz, scale, turn: this.rand() * Math.PI * 2 });
    model.build(this.kit, this.rand);
  }

  /** Visit a `cells`×`cells` grid over the block, jittered within each cell. */
  spots(cells: number, jitter: boolean, visit: (x: number, z: number) => void): void {
    const cell = SIDE / cells;
    const x0 = this.block.bx * SIDE;
    const z0 = this.block.by * SIDE;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const jx = jitter ? this.rand() : 0.5;
        const jz = jitter ? this.rand() : 0.5;
        visit(x0 + (i + jx) * cell, z0 + (j + jz) * cell);
      }
    }
  }

  roll(table: readonly Growth[], x: number, z: number): void {
    const spot: Spot = { x, z, block: this.block, ctx: this.ctx };
    let roll = this.rand();
    for (const row of table) {
      if (row.where && !row.where(spot)) continue;
      if (roll < row.p) {
        const [lo, hi] = row.scale ?? [0.9, 1.1];
        this.grow(row.model, x, z, lo + (hi - lo) * this.rand());
        return;
      }
      roll -= row.p;
    }
  }
}

/** Grow the props of one block into the chunk's builder. */
export function growBlock(builder: BoxBuilder, ctx: PropContext, block: PropBlock): void {
  const g = new Grower(builder, ctx, block);

  if (block.slid) {
    // Spoil heaps and the branches that came down with them, thick enough to
    // read as a mess from across the estate.
    g.spots(SPOTS, true, (x, z) => {
      const roll = g.rand();
      if (roll < 0.42) g.grow(MODELS.spoilHeap, x, z, 0.75 + g.rand() * 0.6);
      else if (roll < 0.68) g.grow(MODELS.snappedBranch, x, z, 0.8 + g.rand() * 0.5);
    });
    return;
  }

  if (block.burnt) {
    const p = SNAGS[block.biome] ?? 0;
    g.spots(SPOTS, true, (x, z) => {
      if (g.rand() < p) g.grow(MODELS.burntTree, x, z, 0.8 + g.rand() * 0.4);
    });
    return;
  }

  if (block.biome === 'rubber') {
    // Planted in rows: no jitter, no warp.
    g.spots(4, false, (x, z) => {
      if (g.rand() < 0.95) g.grow(MODELS.rainforestTree, x, z, 0.6);
    });
    return;
  }

  if (block.biome === 'village') {
    const centre = SIDE / 2;
    const cx = block.bx * SIDE + centre;
    const cz = block.by * SIDE + centre;
    if (g.rand() < 0.7) g.grow(MODELS.weepingFig, cx, cz, 0.9);
    // Houses round the fig, facing every which way.
    g.spots(3, true, (x, z) => {
      const middle = Math.abs(x - cx) < 3 && Math.abs(z - cz) < 3;
      if (!middle && g.rand() < 0.55) g.grow(MODELS.stiltHouse, x, z, 0.95 + g.rand() * 0.2);
    });
  }

  g.spots(SPOTS, true, (x, z) => {
    const shown =
      block.biome === 'village'
        ? block.biome
        : ctx.lookBiome(Math.floor(x), Math.floor(z), block.biome);
    // Village land does not spill its houses and flowers into its neighbours.
    const land = shown === 'village' || shown === 'rubber' ? block.biome : shown;
    const table = TABLE[land];
    if (table) g.roll(table, x, z);
  });
}
