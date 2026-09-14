import { describe, expect, it } from 'vitest';

import {
  DURATION,
  cascadeDelay,
  easeInBack,
  easeInQuad,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  easeOutElastic,
  linear,
  squashStretch,
  type Easing,
} from '@render/anim/easing.ts';
import {
  CALM_SPRING,
  TOY_SPRING,
  createSpring,
  impulse,
  isSettled,
  stepSpring,
} from '@render/anim/spring.ts';

const CURVES: Record<string, Easing> = {
  linear,
  easeInQuad,
  easeOutCubic,
  easeOutBack,
  easeInBack,
  easeOutElastic,
  easeOutBounce,
};

describe('easing curves (§6.5)', () => {
  it.each(Object.keys(CURVES))('%s starts at 0 and ends at 1', (name) => {
    const curve = CURVES[name]!;
    expect(curve(0)).toBeCloseTo(0, 6);
    expect(curve(1)).toBeCloseTo(1, 6);
  });

  it.each(Object.keys(CURVES))('%s clamps outside [0,1]', (name) => {
    const curve = CURVES[name]!;
    expect(curve(-5)).toBeCloseTo(curve(0), 6);
    expect(curve(5)).toBeCloseTo(curve(1), 6);
  });

  it.each(Object.keys(CURVES))('%s stays finite across its domain', (name) => {
    const curve = CURVES[name]!;
    for (let i = 0; i <= 64; i++) expect(Number.isFinite(curve(i / 64))).toBe(true);
  });

  it('easeOutBack overshoots to about 1.1 then settles', () => {
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, easeOutBack(i / 100));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.15);
  });

  it('easeInBack anticipates below zero before rising', () => {
    let trough = 1;
    for (let i = 0; i <= 100; i++) trough = Math.min(trough, easeInBack(i / 100));
    expect(trough).toBeLessThan(-0.05);
  });

  it('easeOutElastic wobbles more than once', () => {
    let crossings = 0;
    let previous = easeOutElastic(0) - 1;
    for (let i = 1; i <= 400; i++) {
      const current = easeOutElastic(i / 400) - 1;
      if (Math.sign(current) !== Math.sign(previous) && current !== 0) crossings += 1;
      previous = current;
    }
    expect(crossings).toBeGreaterThanOrEqual(2);
  });

  it('easeOutBounce never overshoots past 1', () => {
    for (let i = 0; i <= 200; i++) expect(easeOutBounce(i / 200)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('easeOutCubic is monotonic — the camera must never reverse (§6.5)', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const v = easeOutCubic(i / 200);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
});

describe('squash and stretch (§6.5)', () => {
  it('preserves volume: sy * sxz^2 === 1', () => {
    for (let i = 0; i <= 100; i++) {
      const { sy, sxz } = squashStretch(easeOutBack(i / 100));
      expect(sy * sxz * sxz).toBeCloseTo(1, 9);
    }
  });

  it('is a no-op at rest', () => {
    const { sy, sxz } = squashStretch(1);
    expect(sy).toBeCloseTo(1, 9);
    expect(sxz).toBeCloseTo(1, 9);
  });

  it('stretches tall and thin on the overshoot', () => {
    const { sy, sxz } = squashStretch(1.1);
    expect(sy).toBeGreaterThan(1);
    expect(sxz).toBeLessThan(1);
  });

  it('stays finite at t = 0, where the abbreviated TSL sketch in §6.5 would divide by zero', () => {
    const { sy, sxz } = squashStretch(0);
    expect(Number.isFinite(sy)).toBe(true);
    expect(Number.isFinite(sxz)).toBe(true);
  });
});

describe('cascade timing (§6.5)', () => {
  it('staggers by 15 ms and caps at 300 ms', () => {
    expect(cascadeDelay(0)).toBe(0);
    expect(cascadeDelay(1)).toBe(DURATION.cascadeStep);
    expect(cascadeDelay(10_000)).toBe(DURATION.cascadeCap);
  });
});

describe('spring integrator (§6.5)', () => {
  it('is visually settled by ~600 ms and numerically settled by ~1.2 s', () => {
    // §6.5 promises a ~600 ms settle. Measured, the toy preset (zeta ~= 0.54)
    // is within ~1.3% of target at 600 ms — settled to the eye — and converges
    // properly a few hundred ms later.
    const spring = createSpring(0);
    for (let i = 0; i < 36; i++) stepSpring(spring, 1, 1 / 60);
    expect(Math.abs(spring.x - 1)).toBeLessThan(0.02);

    for (let i = 0; i < 36; i++) stepSpring(spring, 1, 1 / 60);
    expect(isSettled(spring, 1, 5e-3)).toBe(true);
  });

  it('overshoots on the way — that is the toy feel', () => {
    const spring = createSpring(0);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      stepSpring(spring, 1, 1 / 60);
      peak = Math.max(peak, spring.x);
    }
    expect(peak).toBeGreaterThan(1);
  });

  it('the calm preset does not visibly overshoot — the camera uses it', () => {
    const spring = createSpring(0);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      stepSpring(spring, 1, 1 / 60, CALM_SPRING);
      peak = Math.max(peak, spring.x);
    }
    expect(peak).toBeLessThan(1.02);
  });

  it('stays stable across a huge frame gap (tab regains focus)', () => {
    const spring = createSpring(0);
    stepSpring(spring, 1, 10, TOY_SPRING);
    expect(Number.isFinite(spring.x)).toBe(true);
    expect(Math.abs(spring.x)).toBeLessThan(10);
  });

  it('re-targets mid-flight without a discontinuity', () => {
    const spring = createSpring(0);
    for (let i = 0; i < 10; i++) stepSpring(spring, 1, 1 / 60);
    const midway = spring.x;
    stepSpring(spring, 0, 1 / 60);
    expect(Math.abs(spring.x - midway)).toBeLessThan(0.1);
  });

  it('impulse kicks velocity without teleporting position', () => {
    const spring = createSpring(0.5);
    impulse(spring, 4);
    expect(spring.x).toBe(0.5);
    expect(spring.v).toBe(4);
  });
});
