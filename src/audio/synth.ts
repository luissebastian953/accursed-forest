/**
 * Synthesis primitives (§6.6): the handful of building blocks every sound in
 * `sounds.ts` is made of. No files, no decoding, no download: the estate's
 * noises are generated the same way its palms and its palette are.
 *
 * Everything here takes a `BaseAudioContext`, so the same recipe runs live
 * through an `AudioContext` and offline through an `OfflineAudioContext`,
 * which is how the tests measure a sound without anyone listening to it.
 */

/** Seconds of noise kept per buffer; long enough that a loop does not pulse. */
const NOISE_SECONDS = 2;

const noiseCache = new WeakMap<BaseAudioContext, Map<NoiseColour, AudioBuffer>>();

export type NoiseColour = 'white' | 'pink' | 'brown';

/**
 * A buffer of noise, cached per context and colour. White is flat, pink rolls
 * off with frequency (rain, wind), brown rolls off harder (fire, thunder).
 */
export function noiseBuffer(ctx: BaseAudioContext, colour: NoiseColour = 'white'): AudioBuffer {
  let byColour = noiseCache.get(ctx);
  if (!byColour) {
    byColour = new Map();
    noiseCache.set(ctx, byColour);
  }
  const cached = byColour.get(colour);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // A deterministic source, so a sound measured in a test is the sound shipped.
  let seed = 0x9e3779b9;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0x100000000) * 2 - 1;
  };

  if (colour === 'white') {
    for (let i = 0; i < length; i++) data[i] = random();
  } else if (colour === 'brown') {
    // A random walk, kept off the rails by leaking back toward zero.
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + random() * 0.08) * 0.996;
      // Scaled to sit around the same level as the white and pink buffers:
      // unscaled, a brown walk peaks four times higher and clips everything
      // built on it.
      data[i] = last * 0.9;
    }
  } else {
    // Pink: the Voss-McCartney approximation, cheap and close enough.
    const rows = new Float32Array(6);
    let running = 0;
    for (let i = 0; i < length; i++) {
      let index = 0;
      let n = i;
      while (index < rows.length && (n & 1) === 0) {
        n >>= 1;
        index += 1;
      }
      if (index < rows.length) {
        running -= rows[index]!;
        rows[index] = random() * 0.5;
        running += rows[index]!;
      }
      data[i] = (running + random() * 0.2) * 0.9;
    }
  }
  byColour.set(colour, buffer);
  return buffer;
}

/** A looping noise source, started and left to the caller to stop. */
export function noiseSource(
  ctx: BaseAudioContext,
  colour: NoiseColour = 'white',
  at = 0,
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, colour);
  source.loop = true;
  source.start(at);
  return source;
}

export interface EnvelopeShape {
  /** Seconds to the peak. Zero is a click, which is sometimes the point. */
  attack: number;
  /** Seconds from the peak down to silence. */
  decay: number;
  /** Peak gain, 0..1. */
  peak?: number;
  /** Curve: exponential decay reads as natural, linear as mechanical. */
  curve?: 'exponential' | 'linear';
}

/**
 * A gain node that opens and shuts once. The floor is not quite zero because
 * `exponentialRampToValueAtTime` refuses to ramp to it.
 */
export function envelope(ctx: BaseAudioContext, at: number, shape: EnvelopeShape): GainNode {
  const { attack, decay, peak = 1, curve = 'exponential' } = shape;
  const gain = ctx.createGain();
  const floor = 0.0001;
  gain.gain.setValueAtTime(floor, at);
  gain.gain.linearRampToValueAtTime(peak, at + Math.max(attack, 0.001));
  const end = at + attack + decay;
  if (curve === 'exponential') gain.gain.exponentialRampToValueAtTime(floor, end);
  else gain.gain.linearRampToValueAtTime(0, end);
  return gain;
}

/** An oscillator that sweeps from one frequency to another and stops. */
export function tone(
  ctx: BaseAudioContext,
  at: number,
  options: {
    type?: OscillatorType;
    from: number;
    to?: number;
    seconds: number;
    detune?: number;
  },
): OscillatorNode {
  const { type = 'sine', from, to = from, seconds, detune = 0 } = options;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + seconds);
  osc.start(at);
  osc.stop(at + seconds);
  return osc;
}

/** A filter, optionally sweeping its cutoff over the life of the sound. */
export function filter(
  ctx: BaseAudioContext,
  at: number,
  options: {
    type?: BiquadFilterType;
    from: number;
    to?: number;
    seconds?: number;
    q?: number;
  },
): BiquadFilterNode {
  const { type = 'lowpass', from, to = from, seconds = 0, q = 1 } = options;
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.Q.value = q;
  node.frequency.setValueAtTime(from, at);
  if (to !== from && seconds > 0) {
    node.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + seconds);
  }
  return node;
}

/** A slow oscillator wired onto a parameter: wobble, throb, a siren's sweep. */
export function lfo(
  ctx: BaseAudioContext,
  target: AudioParam,
  options: { rate: number; depth: number; type?: OscillatorType; at?: number },
): OscillatorNode {
  const { rate, depth, type = 'sine', at = 0 } = options;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start(at);
  return osc;
}

/** Chain nodes in order and return the last, so a recipe reads top to bottom. */
export function chain<T extends AudioNode>(first: AudioNode, ...rest: [...AudioNode[], T]): T {
  let node = first;
  for (const next of rest) {
    node.connect(next);
    node = next;
  }
  return node as T;
}
