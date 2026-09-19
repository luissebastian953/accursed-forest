import { describe, expect, it } from 'vitest';

import {
  clamp,
  clamp01,
  invLerp,
  lerp,
  manhattan,
  mod,
  quantise,
  remap,
  sampleCurve,
  smoothstep,
} from '@shared/math.ts';

describe('shared math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('lerps and inverse-lerps', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(invLerp(10, 20, 12.5)).toBe(0.25);
    // Degenerate range must not produce NaN; balance tables can be flat.
    expect(invLerp(5, 5, 5)).toBe(0);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
  });

  it('smoothstep is clamped and symmetric about the midpoint', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('mod is always non-negative; wrapping dayOfYear depends on it', () => {
    expect(mod(-1, 360)).toBe(359);
    expect(mod(360, 360)).toBe(0);
    expect(mod(721, 360)).toBe(1);
  });

  it('quantises to half-unit steps for the column mesher (GDD 6.3)', () => {
    expect(quantise(0.26, 0.5)).toBe(0.5);
    expect(quantise(0.24, 0.5)).toBe(0);
    expect(quantise(-0.75, 0.5)).toBe(-0.5);
  });

  it('samples a piecewise-linear curve and clamps outside the knots', () => {
    // A stand-in for the yield curve shape (GDD 2): ramp, plateau, decline.
    const knots = [
      [2.5, 0],
      [8, 1],
      [18, 1],
      [25, 0.4],
    ] as const;

    expect(sampleCurve(knots, 0)).toBe(0);
    expect(sampleCurve(knots, 2.5)).toBe(0);
    expect(sampleCurve(knots, 5.25)).toBeCloseTo(0.5, 6);
    expect(sampleCurve(knots, 12)).toBe(1);
    expect(sampleCurve(knots, 25)).toBeCloseTo(0.4, 6);
    expect(sampleCurve(knots, 40)).toBeCloseTo(0.4, 6);
    expect(sampleCurve([], 3)).toBe(0);
  });

  it('manhattan distance drives Kopdes range (GDD 3.3)', () => {
    expect(manhattan(0, 0, 3, 4)).toBe(7);
  });
});
