import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  chance,
  cloneRng,
  createRng,
  forkRng,
  nextFloat,
  nextGaussian,
  nextInt,
  nextUint32,
  pickWeighted,
  type RngState,
} from '@sim/rng.ts';

function draw(state: RngState, n: number): number[] {
  return Array.from({ length: n }, () => nextFloat(state));
}

describe('seeded RNG (§4.3)', () => {
  it('is deterministic for a seed', () => {
    expect(draw(createRng(1234), 16)).toEqual(draw(createRng(1234), 16));
  });

  it('gives different streams for different seeds', () => {
    expect(draw(createRng(1), 16)).not.toEqual(draw(createRng(2), 16));
  });

  it('restores an in-flight stream exactly; this is what makes saves safe', () => {
    const live = createRng(99);
    draw(live, 37);

    // A save writes these four numbers and nothing else.
    const saved = cloneRng(live);
    const expected = draw(live, 24);

    const restored: RngState = { ...saved };
    expect(draw(restored, 24)).toEqual(expected);
  });

  it('never reaches the all-zero fixed point, even from seed 0', () => {
    const state = createRng(0);
    expect(state.a | state.b | state.c | state.d).not.toBe(0);
    for (let i = 0; i < 1000; i++) nextUint32(state);
    expect(state.a | state.b | state.c | state.d).not.toBe(0);
  });

  it('forks independent streams without consuming the parent', () => {
    const parent = createRng(7);
    const before = cloneRng(parent);

    const a = draw(forkRng(7, 0), 8);
    const b = draw(forkRng(7, 1), 8);

    expect(a).not.toEqual(b);
    expect(parent).toEqual(before);
    // A fork is itself reproducible; worldgen relies on this.
    expect(draw(forkRng(7, 0), 8)).toEqual(a);
  });

  it('stays in [0, 1) over a long run', () => {
    const state = createRng(42);
    for (let i = 0; i < 100_000; i++) {
      const v = nextFloat(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a mean near 0.5 and covers the unit interval', () => {
    const state = createRng(5);
    const buckets = new Array<number>(10).fill(0);
    let sum = 0;
    const n = 100_000;

    for (let i = 0; i < n; i++) {
      const v = nextFloat(state);
      sum += v;
      buckets[Math.floor(v * 10)]! += 1;
    }

    expect(sum / n).toBeCloseTo(0.5, 2);
    for (const count of buckets) expect(count).toBeGreaterThan(n / 10 - n / 100);
  });

  it('nextInt stays in range and handles empty ranges', () => {
    const state = createRng(11);
    for (let i = 0; i < 10_000; i++) {
      const v = nextInt(state, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(nextInt(state, 0)).toBe(0);
    expect(nextInt(state, -3)).toBe(0);
  });

  it('chance treats degenerate probabilities without consuming the stream', () => {
    const state = createRng(3);
    const before = cloneRng(state);
    expect(chance(state, 0)).toBe(false);
    expect(chance(state, 1)).toBe(true);
    expect(state).toEqual(before);
  });

  it('pickWeighted respects weights and skips zero-weight entries', () => {
    const state = createRng(21);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[pickWeighted(state, [1, 0, 3])]! += 1;

    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.5);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.5);
    expect(pickWeighted(state, [0, 0])).toBe(-1);
  });

  it('nextGaussian is finite and roughly standard-normal', () => {
    const state = createRng(8);
    let sum = 0;
    let sumSq = 0;
    const n = 50_000;

    for (let i = 0; i < n; i++) {
      const v = nextGaussian(state);
      expect(Number.isFinite(v)).toBe(true);
      sum += v;
      sumSq += v * v;
    }

    expect(sum / n).toBeCloseTo(0, 1);
    expect(Math.sqrt(sumSq / n)).toBeCloseTo(1, 1);
  });

  it('property: any seed produces the same stream twice', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(draw(createRng(seed), 12)).toEqual(draw(createRng(seed), 12));
      }),
      { numRuns: 200 },
    );
  });
});
