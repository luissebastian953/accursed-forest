import { describe, expect, it } from 'vitest';

import { buildKopdesGeometry, type KopdesLevel } from '@render/scene/Kopdes.ts';
import { WORLD } from '@sim/balance/world.ts';

const LEVELS: KopdesLevel[] = [1, 2, 3, 4];

/** What the model occupies, measured from the vertices the builder produced. */
function extent(level: KopdesLevel) {
  const geometry = buildKopdesGeometry(level);
  const p = geometry.getAttribute('position').array as ArrayLike<number>;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let top = -Infinity;
  let low = Infinity;

  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i]!);
    maxX = Math.max(maxX, p[i]!);
    top = Math.max(top, p[i + 1]!);
    low = Math.min(low, p[i + 1]!);
    minZ = Math.min(minZ, p[i + 2]!);
    maxZ = Math.max(maxZ, p[i + 2]!);
  }

  geometry.dispose();
  return { width: maxX - minX, depth: maxZ - minZ, top, low, minX, maxX, count: p.length / 3 };
}

describe('the Kopdes (GDD 6.3)', () => {
  it('stands on its own hectare at every level', () => {
    const side = WORLD.blockSide;

    for (const level of LEVELS) {
      const e = extent(level);

      // The mesh is placed at the centre of its block, so half a side either
      // way is all the room it has.
      expect(e.width, `level ${level} is ${e.width.toFixed(1)} wide`).toBeLessThanOrEqual(side);
      expect(e.depth, `level ${level} is ${e.depth.toFixed(1)} deep`).toBeLessThanOrEqual(side);
      expect(Math.max(Math.abs(e.minX), Math.abs(e.maxX))).toBeLessThanOrEqual(side / 2);
      // Nothing hangs below the ground it sits on.
      expect(e.low).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('grows with every upgrade, in reach and in height', () => {
    const seen = LEVELS.map(extent);

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.count, `level ${i + 1} against ${i}`).toBeGreaterThan(seen[i - 1]!.count);
      expect(seen[i]!.top).toBeGreaterThanOrEqual(seen[i - 1]!.top);
    }

    // The hall is the visible difference: the top level reaches half again as
    // far as the one-room shop it started as.
    expect(seen[3]!.width).toBeGreaterThan(seen[0]!.width * 1.5);
  });
});
