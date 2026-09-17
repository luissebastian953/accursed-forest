/** Small numeric helpers shared by every layer. No allocations, no dependencies. */

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where `v` sits between `a` and `b`, clamped to 0..1. Returns 0 if a === b. */
export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : clamp01((v - a) / (b - a));
}

export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, v));
}

export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = invLerp(edge0, edge1, v);
  return t * t * (3 - 2 * t);
}

/** Modulo that always returns a non-negative result (unlike `%`). */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Quantise to the nearest multiple of `step`; used by the column mesher (§6.3). */
export function quantise(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/**
 * Sample a piecewise-linear curve defined by knots sorted ascending by `x`.
 * Values outside the knot range clamp to the first/last knot. This is how the
 * yield curve and the moisture curve are expressed in `sim/balance/*` (§4.5).
 */
export function sampleCurve(
  knots: readonly (readonly [x: number, y: number])[],
  x: number,
): number {
  const first = knots[0];
  if (first === undefined) return 0;
  if (x <= first[0]) return first[1];

  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1]!;
    const next = knots[i]!;
    if (x <= next[0]) return lerp(prev[1], next[1], invLerp(prev[0], next[0], x));
  }

  return knots[knots.length - 1]![1];
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
