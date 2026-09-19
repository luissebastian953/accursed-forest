import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { START_SITE, WORLD } from '@sim/balance/world.ts';
import type { Biome } from '@sim/types.ts';
import { createWorld, estateCodeFor, seedFromEstateCode } from '@sim/worldgen/index.ts';

const SEEDS = [1, 42, 1234, 99_999, 0x7fffffff];

describe('world generation (GDD 4.6)', () => {
  it('same seed → identical blocks, every cell', () => {
    for (const seed of SEEDS) {
      const a = createWorld(seed);
      const b = createWorld(seed);
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          expect(a.generated(x, y)).toEqual(b.generated(x, y));
        }
      }
      expect(a.params).toEqual(b.params);
    }
  });

  it('different seeds → different worlds', () => {
    const a = createWorld(1);
    const b = createWorld(2);
    let differing = 0;
    for (let y = 0; y < a.height; y += 4) {
      for (let x = 0; x < a.width; x += 4) {
        if (a.generated(x, y).biome !== b.generated(x, y).biome) differing += 1;
      }
    }
    expect(differing).toBeGreaterThan(20);
  });

  it('every cell has a valid biome, elevation and moisture', () => {
    const world = createWorld(42);
    const biomes = new Set(Object.keys(BIOMES) as Biome[]);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const g = world.generated(x, y);
        expect(biomes.has(g.biome)).toBe(true);
        expect(g.elevation).toBeGreaterThanOrEqual(0);
        expect(g.elevation).toBeLessThanOrEqual(WORLD.maxElevation);
        expect(g.height01).toBeGreaterThanOrEqual(0);
        expect(g.height01).toBeLessThanOrEqual(1);
        expect(g.moisture).toBeGreaterThanOrEqual(0);
        expect(g.moisture).toBeLessThanOrEqual(1);
        // `forSale` is a pure function of the biome (GDD 3.1).
        expect(g.forSale).toBe(BIOMES[g.biome].forSale);
      }
    }
  });

  it('produces a mix of land: the map is neither all one biome nor all desert', () => {
    for (const seed of SEEDS) {
      const world = createWorld(seed);
      const counts: Partial<Record<Biome, number>> = {};
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const b = world.generated(x, y).biome;
          counts[b] = (counts[b] ?? 0) + 1;
        }
      }
      const total = world.width * world.height;
      const share = (b: Biome): number => (counts[b] ?? 0) / total;

      // Grassfield and forest are the plantable heartland; scrub is a niche.
      expect(share('grassfield') + share('forest')).toBeGreaterThan(0.4);
      expect(share('scrub')).toBeLessThan(0.35);
      expect(share('river')).toBeGreaterThan(0);
      expect(share('riverbank')).toBeGreaterThan(0);
    }
  });

  it('rivers reach the map edge', () => {
    for (const seed of SEEDS) {
      const world = createWorld(seed);
      const { water } = world.rivers;
      expect(water.size).toBeGreaterThan(0);

      let touchesEdge = false;
      for (const key of water) {
        const [x, y] = world.toXY(key);
        if (x === 0 || y === 0 || x === world.width - 1 || y === world.height - 1) {
          touchesEdge = true;
          break;
        }
      }
      expect(touchesEdge).toBe(true);
    }
  });

  it('riverbank is exactly the strip beside the water', () => {
    const world = createWorld(42);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.generated(x, y).biome !== 'riverbank') continue;
        let besideWater = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (world.inBounds(nx, ny) && world.generated(nx, ny).biome === 'river')
            besideWater = true;
        }
        expect(besideWater).toBe(true);
      }
    }
  });

  it('protected forest is never for sale and never on water', () => {
    for (const seed of SEEDS) {
      const world = createWorld(seed);
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const g = world.generated(x, y);
          if (!g.isProtected) continue;
          expect(g.biome).toBe('protected');
          expect(g.forSale).toBe(false);
        }
      }
    }
  });

  it('the start site is always valid (GDD 4.6)', () => {
    for (const seed of SEEDS) {
      const world = createWorld(seed);
      const { start } = world;

      expect(start.size).toBe(WORLD.startSize);
      expect(start.x).toBeGreaterThanOrEqual(0);
      expect(start.y).toBeGreaterThanOrEqual(0);
      expect(start.x + start.size).toBeLessThanOrEqual(world.width);
      expect(start.y + start.size).toBeLessThanOrEqual(world.height);

      // Mostly plantable land.
      let allowed = 0;
      let nearestRiver = Infinity;
      for (let y = start.y; y < start.y + start.size; y++) {
        for (let x = start.x; x < start.x + start.size; x++) {
          const biome = world.generated(x, y).biome;
          if ((START_SITE.allowed as readonly string[]).includes(biome)) allowed += 1;
          nearestRiver = Math.min(nearestRiver, world.rivers.distance[world.toId(x, y)]!);
        }
      }
      expect(allowed / (start.size * start.size)).toBeGreaterThanOrEqual(
        START_SITE.minAllowedShare,
      );

      // The Kopdes block is inside the region and on land you can build on.
      const kopdes = world.generated(start.kopdesX, start.kopdesY);
      expect(start.kopdesX).toBeGreaterThanOrEqual(start.x);
      expect(start.kopdesX).toBeLessThan(start.x + start.size);
      expect(start.kopdesY).toBeGreaterThanOrEqual(start.y);
      expect(start.kopdesY).toBeLessThan(start.y + start.size);
      expect(kopdes.forSale).toBe(true);
      expect(kopdes.biome).not.toBe('river');
      expect(kopdes.isProtected).toBe(false);
      expect(world.params.kopdesBlock).toBe(world.toId(start.kopdesX, start.kopdesY));
    }
  });

  it('every start has standing forest in or around it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const world = createWorld(seed);
      const { x: sx, y: sy, size } = world.start;
      const r = START_SITE.forestRing;
      let forest = 0;
      let area = 0;
      for (let y = sy - r; y < sy + size + r; y++) {
        for (let x = sx - r; x < sx + size + r; x++) {
          if (!world.inBounds(x, y)) continue;
          area += 1;
          const biome = world.generated(x, y).biome;
          if (biome === 'forest' || biome === 'protected') forest += 1;
        }
      }
      expect(forest / area, `seed ${seed}`).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('river paths are the water, cell to neighbouring cell, ending on the map edge', () => {
    const world = createWorld(42);
    const { paths, water } = world.rivers;
    expect(paths.length).toBe(world.rivers.count);
    const covered = new Set(paths.flat());
    expect([...water].every((key) => covered.has(key))).toBe(true);
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = world.toXY(path[i - 1]!);
        const [bx, by] = world.toXY(path[i]!);
        expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
      }
      const [ex, ey] = world.toXY(path.at(-1)!);
      expect(ex === 0 || ey === 0 || ex === world.width - 1 || ey === world.height - 1).toBe(true);
    }
  });

  it('a fresh Block from the world is wild, unowned and carries the terrain', () => {
    const world = createWorld(7);
    const block = world.block(10, 12);
    const g = world.generated(10, 12);
    expect(block.id).toBe(world.toId(10, 12));
    expect(block.phase).toBe('wild');
    expect(block.owned).toBe(false);
    expect(block.biome).toBe(g.biome);
    expect(block.elevation).toBe(g.elevation);
    expect(block.slope).toBe(g.slope);
    expect(block.moisture).toBe(g.moisture);
    expect(block.debris).toBe(0);
  });

  it('id ↔ xy round-trips', () => {
    const world = createWorld(3, 40, 24);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 39 }), fc.integer({ min: 0, max: 23 }), (x, y) => {
        expect(world.toXY(world.toId(x, y))).toEqual([x, y]);
      }),
    );
  });

  it('honours a custom bound', () => {
    const world = createWorld(5, 16, 12);
    expect(world.width).toBe(16);
    expect(world.height).toBe(12);
    expect(world.params.width).toBe(16);
    expect(() => world.generated(16, 0)).toThrow(RangeError);
  });

  it('generates a 64x64 world quickly enough to do on every load', () => {
    const t0 = performance.now();
    const world = createWorld(31337);
    for (let y = 0; y < world.height; y++)
      for (let x = 0; x < world.width; x++) world.generated(x, y);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('estate code (GDD 4.6)', () => {
  it('round-trips any 32-bit seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        expect(seedFromEstateCode(estateCodeFor(seed))).toBe(seed);
      }),
      { numRuns: 500 },
    );
  });

  it('reads like a code: 3-4 grouping, no ambiguous glyphs', () => {
    const code = estateCodeFor(0xdeadbeef);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('is forgiving about case, spaces and dashes on input', () => {
    const seed = 123_456_789;
    const code = estateCodeFor(seed);
    expect(seedFromEstateCode(code.toLowerCase())).toBe(seed);
    expect(seedFromEstateCode(code.replace('-', ' '))).toBe(seed);
  });

  it('takes any words as a world, however they are written', () => {
    const seed = seedFromEstateCode('PENYAWIT-HANDAL');
    expect(seed).not.toBeNull();
    // The three ways the same estate might be typed are the same estate.
    expect(seedFromEstateCode('PENYAWIT HANDAL')).toBe(seed);
    expect(seedFromEstateCode('penyawit handal')).toBe(seed);
    expect(seedFromEstateCode('  Penyawit,  Handal!  ')).toBe(seed);

    // A different phrase is a different world, including a near miss.
    expect(seedFromEstateCode('penyawit handan')).not.toBe(seed);
    expect(seedFromEstateCode('kebun sawit')).not.toBe(seed);

    // Nothing but emoji still names one; nothing at all does not.
    expect(seedFromEstateCode('\u{1f334}\u{1f334}')).not.toBeNull();
    expect(seedFromEstateCode('   ')).toBeNull();
    expect(seedFromEstateCode('')).toBeNull();
  });

  it('spreads phrases across the seed space rather than clumping', () => {
    const seen = new Set<number>();
    const words = ['sawit', 'kebun', 'hutan', 'ladang', 'panen', 'kopdes'];
    for (const a of words) {
      for (const b of words) {
        for (let n = 0; n < 20; n++) seen.add(seedFromEstateCode(`${a} ${b} ${n}`)!);
      }
    }
    // Every one of the 720 phrases is its own world.
    expect(seen.size).toBe(words.length * words.length * 20);
    // And they are not all crowded into one corner of the range.
    const high = [...seen].filter((s) => s > 0x80000000).length;
    expect(high).toBeGreaterThan(seen.size * 0.35);
    expect(high).toBeLessThan(seen.size * 0.65);
  });
});
