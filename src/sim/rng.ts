export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** splitmix32; expands a single seed into well-mixed 32-bit words. */
function splitmix32(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x = (x + 0x9e3779b9) | 0;
    let t = x ^ (x >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export function createRng(seed: number): RngState {
  const mix = splitmix32(seed);
  const state: RngState = { a: mix(), b: mix(), c: mix(), d: mix() };
  // The all-zero state is a fixed point of xoshiro and must never occur.
  if ((state.a | state.b | state.c | state.d) === 0) state.a = 1;
  return state;
}

export function cloneRng(state: RngState): RngState {
  return { a: state.a, b: state.b, c: state.c, d: state.d };
}

/**
 * Derive an independent stream from a seed and a tag, without touching or
 * consuming any existing stream. Worldgen uses this so that terrain stays a
 * pure `f(seed, x, y)` no matter what the main stream has done (GDD 4.6).
 */
export function forkRng(seed: number, tag: number): RngState {
  return createRng((Math.imul(seed, 0x2545f491) ^ Math.imul(tag + 1, 0x9e3779b1)) | 0);
}

/** Advance the stream and return the raw 32-bit word. */
export function nextUint32(state: RngState): number {
  const result = Math.imul(rotl(Math.imul(state.b, 5) >>> 0, 7), 9) >>> 0;
  const t = (state.b << 9) >>> 0;

  state.c = (state.c ^ state.a) >>> 0;
  state.d = (state.d ^ state.b) >>> 0;
  state.b = (state.b ^ state.c) >>> 0;
  state.a = (state.a ^ state.d) >>> 0;
  state.c = (state.c ^ t) >>> 0;
  state.d = rotl(state.d, 11);

  return result;
}

/** Uniform in [0, 1). 24 bits of mantissa; plenty for game randomness. */
export function nextFloat(state: RngState): number {
  return (nextUint32(state) >>> 8) / 0x1000000;
}

/** Uniform integer in [0, maxExclusive). Returns 0 when the range is empty. */
export function nextInt(state: RngState, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(nextFloat(state) * maxExclusive);
}

/** Uniform float in [min, max). */
export function nextRange(state: RngState, min: number, max: number): number {
  return min + nextFloat(state) * (max - min);
}

/** True with probability `p` (p <= 0 never, p >= 1 always). */
export function chance(state: RngState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return nextFloat(state) < p;
}

export function pick<T>(state: RngState, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(state, items.length)];
}

/**
 * Pick an index by weight; the event deck draw (GDD 3.6) and the news template
 * picker both need this. Returns -1 if every weight is zero.
 */
export function pickWeighted(state: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return -1;

  let roll = nextFloat(state) * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    if (w <= 0) continue;
    roll -= w;
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/** Standard normal via Box-Muller. Used by the rain distribution (GDD 3.6). */
export function nextGaussian(state: RngState): number {
  // u must be non-zero for the log.
  const u = 1 - nextFloat(state);
  const v = nextFloat(state);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
