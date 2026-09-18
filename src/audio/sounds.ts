/**
 * The estate's noises, written out rather than recorded (§6.6).
 *
 * A one-shot is a function that schedules its nodes at a time and returns how
 * long it lasts. A loop builds a running graph and hands back a stop. Both
 * take the context they draw on, so the same recipe plays live and renders
 * offline for the tests.
 */

import { chain, envelope, filter, lfo, noiseSource, tone } from './synth.ts';

/** Everything a one-shot needs: where to play it and when. */
export type OneShot = (ctx: BaseAudioContext, out: AudioNode, at: number) => number;

export interface LoopHandle {
  /** The loop's own gain, for fading it in and out. */
  gain: GainNode;
  stop(at?: number): void;
}

export type Loop = (ctx: BaseAudioContext, out: AudioNode, at?: number) => LoopHandle;

// ── One-shots ─────────────────────────────────────────────────────────────

/** A soft wooden tap: the sound most of the UI makes. */
const buttonPress: OneShot = (ctx, out, at) => {
  const seconds = 0.09;
  const env = envelope(ctx, at, { attack: 0.002, decay: seconds, peak: 0.5 });
  chain(tone(ctx, at, { type: 'triangle', from: 430, to: 280, seconds }), env, out);
  // A grain of noise on the front, so it reads as a knock and not a beep.
  const click = envelope(ctx, at, { attack: 0.001, decay: 0.02, peak: 0.2 });
  const noise = noiseSource(ctx, 'white', at);
  chain(noise, filter(ctx, at, { type: 'bandpass', from: 2200, q: 0.9 }), click, out);
  noise.stop(at + 0.05);
  return seconds;
};

/** The shut door: a locked button, a rejected order. */
const buttonDenied: OneShot = (ctx, out, at) => {
  const seconds = 0.16;
  const env = envelope(ctx, at, { attack: 0.004, decay: seconds, peak: 0.42 });
  chain(
    tone(ctx, at, { type: 'square', from: 150, to: 96, seconds }),
    filter(ctx, at, { from: 520, q: 0.7 }),
    env,
    out,
  );
  return seconds;
};

/** Coins landing: three bell partials, staggered, over a dry chink. */
const coinsBurst: OneShot = (ctx, out, at) => {
  const partials = [1180, 1760, 2640];
  partials.forEach((hz, i) => {
    const start = at + i * 0.018;
    const env = envelope(ctx, start, {
      attack: 0.001,
      decay: 0.34 - i * 0.07,
      peak: 0.3 - i * 0.07,
    });
    chain(tone(ctx, start, { from: hz, seconds: 0.4 }), env, out);
  });
  const chink = envelope(ctx, at, { attack: 0.001, decay: 0.06, peak: 0.22 });
  const noise = noiseSource(ctx, 'white', at);
  chain(noise, filter(ctx, at, { type: 'bandpass', from: 5200, q: 1.4 }), chink, out);
  noise.stop(at + 0.1);
  return 0.45;
};

/** Money in: two notes up. Money out is the same two notes down. */
function cashMove(up: boolean): OneShot {
  return (ctx, out, at) => {
    const notes = up ? [880, 1320] : [1320, 880];
    notes.forEach((hz, i) => {
      const start = at + i * 0.08;
      const env = envelope(ctx, start, { attack: 0.004, decay: 0.26, peak: 0.24 });
      chain(tone(ctx, start, { type: 'triangle', from: hz, seconds: 0.3 }), env, out);
    });
    return 0.4;
  };
}

/** An axe into wood: a bright crack over a low thud. */
const chopStroke: OneShot = (ctx, out, at) => {
  const crack = envelope(ctx, at, { attack: 0.001, decay: 0.12, peak: 0.5 });
  const noise = noiseSource(ctx, 'white', at);
  chain(
    noise,
    filter(ctx, at, { type: 'bandpass', from: 1500, to: 600, seconds: 0.12, q: 1.1 }),
    crack,
    out,
  );
  noise.stop(at + 0.2);

  const thud = envelope(ctx, at, { attack: 0.002, decay: 0.18, peak: 0.34 });
  chain(tone(ctx, at, { from: 120, to: 62, seconds: 0.2 }), thud, out);
  return 0.25;
};

/** A hillside letting go: the one sound that should stop the player. */
const landslide: OneShot = (ctx, out, at) => {
  const seconds = 2.6;
  const body = envelope(ctx, at, { attack: 0.08, decay: seconds, peak: 0.7 });
  const noise = noiseSource(ctx, 'brown', at);
  chain(noise, filter(ctx, at, { from: 900, to: 90, seconds, q: 0.8 }), body, out);
  noise.stop(at + seconds + 0.1);

  // Boulders in it: a few random knocks through the first second.
  for (let i = 0; i < 7; i++) {
    const knock = at + 0.15 + i * 0.13;
    const env = envelope(ctx, knock, { attack: 0.002, decay: 0.22, peak: 0.3 });
    chain(tone(ctx, knock, { from: 150 - i * 8, to: 54, seconds: 0.24 }), env, out);
  }
  return seconds + 0.2;
};

/** Thunder: a crack, then the roll going away from you. */
const thunder: OneShot = (ctx, out, at) => {
  const seconds = 2.2;
  const env = envelope(ctx, at, { attack: 0.01, decay: seconds, peak: 0.7 });
  const noise = noiseSource(ctx, 'brown', at);
  chain(noise, filter(ctx, at, { from: 800, to: 70, seconds, q: 0.6 }), env, out);
  noise.stop(at + seconds + 0.1);
  return seconds + 0.2;
};

export const ONE_SHOTS = {
  'ui-button-press': buttonPress,
  'ui-button-denied': buttonDenied,
  'coins-burst': coinsBurst,
  'cash-in': cashMove(true),
  'cash-out': cashMove(false),
  'chop-stroke': chopStroke,
  landslide,
  'thunder-near': thunder,
} as const satisfies Record<string, OneShot>;

export type OneShotId = keyof typeof ONE_SHOTS;

// ── Loops ─────────────────────────────────────────────────────────────────

function handle(gain: GainNode, stop: (at: number) => void): LoopHandle {
  return {
    gain,
    stop(at = 0) {
      // Always fade: cutting a loop dead is a click.
      const ctx = gain.context;
      const when = Math.max(at, ctx.currentTime);
      gain.gain.cancelScheduledValues(when);
      gain.gain.setValueAtTime(gain.gain.value, when);
      gain.gain.linearRampToValueAtTime(0, when + 0.25);
      stop(when + 0.3);
    },
  };
}

/** Rain: bandpassed noise with a slow wobble, so it breathes. */
const rain: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.32;
  const noise = noiseSource(ctx, 'pink', at);
  chain(noise, filter(ctx, at, { type: 'bandpass', from: 1400, q: 0.55 }), gain, out);
  const wobble = lfo(ctx, gain.gain, { rate: 0.17, depth: 0.08, at });
  return handle(gain, (when) => {
    noise.stop(when);
    wobble.stop(when);
  });
};

/** Fire: a low bed with pops scheduled over it. */
const fire: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.22;
  const noise = noiseSource(ctx, 'brown', at);
  chain(noise, filter(ctx, at, { from: 620, q: 0.7 }), gain, out);

  // Pops for the next while; the engine restarts the loop long before it runs out.
  let seed = 7;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pops: AudioBufferSourceNode[] = [];
  for (let t = 0.1; t < 12; t += 0.06 + random() * 0.32) {
    const when = at + t;
    const env = envelope(ctx, when, {
      attack: 0.001,
      decay: 0.04 + random() * 0.06,
      peak: 0.08 + random() * 0.12,
    });
    const pop = noiseSource(ctx, 'white', when);
    chain(
      pop,
      filter(ctx, when, { type: 'bandpass', from: 900 + random() * 2600, q: 2.2 }),
      env,
      gain,
    );
    pop.stop(when + 0.16);
    pops.push(pop);
  }
  return handle(gain, (when) => {
    noise.stop(when);
    for (const pop of pops) {
      try {
        pop.stop(when);
      } catch {
        // Already finished; nothing to stop.
      }
    }
  });
};

/** The excavator: two detuned saws under a lowpass, wobbling as it works. */
const excavator: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.22;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 320;
  low.connect(gain).connect(out);

  const oscs = [0, 14].map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 56;
    osc.detune.value = detune;
    osc.connect(low);
    osc.start(at);
    return osc;
  });
  const wobble = lfo(ctx, low.frequency, { rate: 2.4, depth: 90, at });
  return handle(gain, (when) => {
    for (const osc of oscs) osc.stop(when);
    wobble.stop(when);
  });
};

/** The police: two tones, back and forth, through a narrow band. */
const siren: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.42;
  const band = filter(ctx, at, { type: 'bandpass', from: 900, q: 1.6 });
  band.connect(gain).connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 660;
  osc.connect(band);
  osc.start(at);
  // A square LFO on the pitch is the two-tone; sine would wail instead.
  const sweep = lfo(ctx, osc.frequency, { rate: 1.1, depth: 200, type: 'square', at });
  return handle(gain, (when) => {
    osc.stop(when);
    sweep.stop(when);
  });
};

export const LOOPS = {
  'rain-light': rain,
  'fire-crackle': fire,
  'excavator-engine': excavator,
  'police-siren': siren,
} as const satisfies Record<string, Loop>;

export type LoopId = keyof typeof LOOPS;
