/**
 * Easing curves (§6.5). Every curve maps t in [0,1] to a value that starts at 0
 * and ends at 1; the "back", "elastic" and "bounce" families overshoot on the way.
 *
 * This file is the CPU half of the curve library. `easingTSL.ts` holds the same
 * curves written as TSL nodes for GPU per-instance animation, and
 * `tests/render/easing-parity.test.ts` asserts the two agree at 32 sample points.
 * Change a curve here and you must change it there.
 */

import { clamp01 } from '@shared/math';

export type Easing = (t: number) => number;

/** Default overshoot constant (Penner's `c1`). */
export const BACK_K = 1.70158;

export function linear(t: number): number {
  return clamp01(t);
}

export function easeInQuad(t: number): number {
  const x = clamp01(t);
  return x * x;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  const u = 1 - x;
  return 1 - u * u * u;
}

/** Overshoots to ~1.1 then settles. Pop-in, selection ring, UI badges. */
export function easeOutBack(t: number, k: number = BACK_K): number {
  const x = clamp01(t);
  const u = x - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
}

/** Anticipation squat before vanishing. Pop-out. */
export function easeInBack(t: number, k: number = BACK_K): number {
  const x = clamp01(t);
  return (k + 1) * x * x * x - k * x * x;
}

/** Several diminishing wobbles. Stage-change grow burst, Kopdes level-up. */
export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
}

/** Penner's piecewise parabola. Anything that lands: bunches, debris, slabs. */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  let x = clamp01(t);

  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/**
 * Volume-preserving squash and stretch (§6.5).
 *
 * `curveValue` is the overshooting curve's output; `f = curveValue - 1` is the
 * deviation from rest, scaled by `amount`. Vertical scale is `1 + a·f`, and the
 * two horizontal axes take `1/sqrt(sy)` so the product `sy · sxz² === 1`.
 *
 * Note this is a modulation *around 1*, applied on top of whatever base scale
 * the animation already has — not the base scale itself. (The abbreviated TSL
 * sketch in design doc §6.5 folds the two together and is degenerate at t = 0,
 * where `1/sqrt(0)` is infinite.)
 */
export function squashStretch(curveValue: number, amount = 1): { sy: number; sxz: number } {
  const sy = Math.max(1e-4, 1 + amount * (curveValue - 1));
  return { sy, sxz: 1 / Math.sqrt(sy) };
}

/** Durations in wall-clock milliseconds (§6.5). Animations never use sim time. */
export const DURATION = {
  popIn: 400,
  popOut: 250,
  grow: 700,
  fall: 700,
  topple: 900,
  shiver: 300,
  cameraFocus: 450,
  /** Per-instance stagger so a block's rows pop in sequence. */
  cascadeStep: 15,
  /** Total cascade is capped no matter how many instances are involved. */
  cascadeCap: 300,
} as const;

/** Cascade offset for instance `i`, capped per §6.5. */
export function cascadeDelay(index: number): number {
  return Math.min(index * DURATION.cascadeStep, DURATION.cascadeCap);
}
