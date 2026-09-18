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

/**
 * A hillside letting go: the one sound that should stop the player. A low
 * rumble juddering at nine a second, with fourteen boulders in it.
 */
const landslide: OneShot = (ctx, out, at) => {
  const seconds = 2.9;
  const body = envelope(ctx, at, { attack: 0.15, decay: seconds - 0.15, peak: 0.42 });
  const noise = noiseSource(ctx, 'pink', at);
  chain(noise, filter(ctx, at, { from: 600, to: 110, seconds, q: 0.9 }), body, out);
  noise.stop(at + seconds + 0.1);
  // The judder: the whole mass shaking as it comes down.
  const judder = lfo(ctx, body.gain, { rate: 9, depth: 0.3, at });
  judder.stop(at + seconds);

  let seed = 17;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 14; i++) {
    const knock = at + 0.1 + random() * 2.2;
    const env = envelope(ctx, knock, { attack: 0.003, decay: 0.22, peak: 0.26 });
    chain(tone(ctx, knock, { from: 70 + random() * 50, to: 35, seconds: 0.25 }), env, out);
  }
  return seconds + 0.2;
};

/**
 * Thunder, near or far. Noise through a resonant lowpass at 300 Hz, swelling
 * over a fifth of a second and falling away over four; a thump of sub under
 * it, and a second roll arriving a moment later. Far away the swell is slow,
 * the cutoff lower, the tail longer and the thump gone.
 */
function thunder(distance: number): OneShot {
  return (ctx, out, at) => {
    const d = Math.max(0, Math.min(1, distance));
    const cutoff = 300 - 180 * d;
    const attack = 0.2 + 0.6 * d;
    const tail = 4 + 2 * d;
    // What a steep lowpass leaves of white noise falls with the cutoff, so
    // the level rises to meet it: near about 2.5x, far about 4x.
    const makeup = Math.sqrt(4500 / cutoff);
    const level = (0.62 - 0.1 * d) * makeup;

    const strike = envelope(ctx, at, { attack, decay: tail, peak: level });
    const noise = noiseSource(ctx, 'white', at);
    chain(noise, filter(ctx, at, { from: cutoff, q: 1.1 }), strike, out);
    noise.stop(at + attack + tail + 0.1);

    if (d < 0.5) {
      const thump = envelope(ctx, at, { attack: attack * 0.5, decay: 2, peak: 0.4 * (1 - d) });
      chain(tone(ctx, at, { from: 60, to: 28, seconds: 2.2 }), thump, out);
    }

    // The second roll, quieter and darker, throbbing as it goes.
    const rollAt = at + 0.9 + 0.6 * d;
    const roll = envelope(ctx, rollAt, { attack: 0.5, decay: tail * 0.8, peak: level * 0.55 });
    const rollNoise = noiseSource(ctx, 'white', rollAt);
    chain(rollNoise, filter(ctx, rollAt, { from: cutoff * 0.6, q: 0.9 }), roll, out);
    rollNoise.stop(rollAt + 0.5 + tail * 0.8 + 0.1);
    const throb = lfo(ctx, roll.gain, { rate: 2.5 + 2 * d, depth: level * 0.2, at: rollAt });
    throb.stop(rollAt + 0.5 + tail * 0.8);

    return attack + tail + 1;
  };
}

export const ONE_SHOTS = {
  'ui-button-press': buttonPress,
  'ui-button-denied': buttonDenied,
  'coins-burst': coinsBurst,
  'cash-in': cashMove(true),
  'cash-out': cashMove(false),
  'chop-stroke': chopStroke,
  landslide,
  'thunder-near': thunder(0),
  'thunder-far': thunder(1),
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

/**
 * Rain: white noise with a highpass under the lowpass, so it hisses without
 * rumbling, breathing slowly so it does not read as a fixed tone.
 */
const rain: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  const noise = noiseSource(ctx, 'white', at);
  chain(
    noise,
    filter(ctx, at, { type: 'highpass', from: 400, q: 0.7 }),
    filter(ctx, at, { from: 7000, q: 0.7 }),
    gain,
    out,
  );
  const wobble = lfo(ctx, gain.gain, { rate: 0.5, depth: 0.055, at });
  return handle(gain, (when) => {
    noise.stop(when);
    wobble.stop(when);
  });
};

/**
 * Fire: a quiet bed of low noise breathing under a constant rain of sharp
 * crackles above 1.5 kHz. The crackles are what read as fire; the bed alone
 * is a furnace heard through a wall. They are scheduled a few seconds ahead
 * and topped up while the loop runs.
 */
const fire: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  const bed = ctx.createGain();
  bed.gain.value = 0.12;
  const noise = noiseSource(ctx, 'brown', at);
  chain(
    noise,
    filter(ctx, at, { type: 'highpass', from: 80, q: 0.7 }),
    filter(ctx, at, { from: 900, q: 0.7 }),
    bed,
    gain,
    out,
  );
  const breathe = lfo(ctx, bed.gain, { rate: 0.75, depth: 0.05, at });

  let seed = 99;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pops: AudioBufferSourceNode[] = [];
  const crackle = (from: number, to: number): void => {
    // Around twenty a second, each a few milliseconds of bright noise.
    for (let t = from; t < to; t += 0.02 + random() * 0.07) {
      const env = envelope(ctx, t, {
        attack: 0.001,
        decay: 0.012 + random() * 0.03,
        peak: 0.45 + random() * 0.5,
      });
      const pop = noiseSource(ctx, 'white', t);
      chain(pop, filter(ctx, t, { type: 'highpass', from: 1500, q: 0.8 }), env, gain);
      pop.stop(t + 0.08);
      pops.push(pop);
    }
  };
  crackle(at + 0.05, at + 4);
  // Offline contexts render their whole length at once and never tick a
  // timer; live ones keep the fire fed a few seconds ahead of the clock.
  let horizon = at + 4;
  const feed =
    typeof setInterval === 'function' && !(ctx instanceof OfflineAudioContext)
      ? setInterval(() => {
          const ahead = ctx.currentTime + 3;
          if (ahead > horizon) {
            crackle(horizon, ahead);
            horizon = ahead;
          }
          // Let the finished ones go, or the list grows for as long as it burns.
          while (pops.length > 400) pops.shift();
        }, 1000)
      : null;

  return handle(gain, (when) => {
    if (feed !== null) clearInterval(feed);
    noise.stop(when);
    breathe.stop(when);
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
