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
 * over a fifth of a second and falling away over four, with a second roll
 * arriving a moment later. Overhead it cracks and punches first; far away
 * the swell is slow, the cutoff lower, the tail longer and the hit gone.
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
      // Overhead it hits before it rolls: a crack of mid noise and a punch of
      // sub, both over in a fraction of a second, then the swell takes over.
      const near = 1 - d * 2;
      const crack = envelope(ctx, at, { attack: 0.003, decay: 0.2, peak: 0.38 * near });
      const crackNoise = noiseSource(ctx, 'white', at + 0.0005);
      chain(crackNoise, filter(ctx, at, { from: 1100, to: 250, seconds: 0.2, q: 0.8 }), crack, out);
      crackNoise.stop(at + 0.3);
      const punch = envelope(ctx, at, { attack: 0.004, decay: 0.55, peak: 0.55 * near });
      chain(tone(ctx, at, { from: 62, to: 30, seconds: 0.6 }), punch, out);

      const thump = envelope(ctx, at, { attack: attack * 0.5, decay: 2, peak: 0.35 * near });
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
 * Rain: two layers. A bed of pink noise rolled off above 3 kHz, which is the
 * sound of rain on everything at once, and over it a thinner spatter of
 * brighter noise that swells and fades on its own, which is the drops. Flat
 * white hiss on its own reads as a radio between stations.
 */
const rain: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.12;

  const bed = noiseSource(ctx, 'pink', at);
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.9;
  chain(
    bed,
    filter(ctx, at, { type: 'highpass', from: 180, q: 0.6 }),
    filter(ctx, at, { from: 3000, q: 0.5 }),
    bedGain,
    gain,
    out,
  );
  const breathe = lfo(ctx, bedGain.gain, { rate: 0.23, depth: 0.12, at });

  const spatter = noiseSource(ctx, 'white', at + 0.001);
  const spatterGain = ctx.createGain();
  spatterGain.gain.value = 0.28;
  chain(spatter, filter(ctx, at, { type: 'bandpass', from: 4200, q: 0.9 }), spatterGain, gain, out);
  // The spatter comes and goes faster than the bed, so gusts read through it.
  const gust = lfo(ctx, spatterGain.gain, { rate: 0.7, depth: 0.14, at });

  return handle(gain, (when) => {
    bed.stop(when);
    spatter.stop(when);
    breathe.stop(when);
    gust.stop(when);
  });
};

/**
 * Fire: a body and a crackle. The body is two layers, a low rumble and a
 * mid roar around 500 Hz that surges and drops the way flames do; the
 * crackle is short pops of noise in the low thousands, not the top of the
 * range, which is where a snap of dry wood sits. They are scheduled a few
 * seconds ahead and topped up while the loop runs.
 */
const fire: Loop = (ctx, out, at = 0) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  const rumble = noiseSource(ctx, 'brown', at);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.55;
  chain(
    rumble,
    filter(ctx, at, { type: 'highpass', from: 60, q: 0.7 }),
    filter(ctx, at, { from: 700, q: 0.7 }),
    rumbleGain,
    gain,
    out,
  );
  const roar = noiseSource(ctx, 'pink', at + 0.001);
  const roarGain = ctx.createGain();
  roarGain.gain.value = 0.42;
  chain(roar, filter(ctx, at, { type: 'bandpass', from: 520, q: 0.55 }), roarGain, gain, out);
  // Flames surge: the roar breathes faster and deeper than the rumble.
  const surge = lfo(ctx, roarGain.gain, { rate: 1.3, depth: 0.16, at });
  const breathe = lfo(ctx, rumbleGain.gain, { rate: 0.45, depth: 0.1, at });

  let seed = 99;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pops: AudioBufferSourceNode[] = [];
  const crackle = (from: number, to: number): void => {
    // Eight or so a second, each a few hundredths of a second, sitting in
    // the low thousands rather than at the top of the range.
    for (let t = from; t < to; t += 0.06 + random() * 0.16) {
      const env = envelope(ctx, t, {
        attack: 0.002,
        decay: 0.025 + random() * 0.05,
        peak: 0.22 + random() * 0.3,
      });
      const pop = noiseSource(ctx, 'white', t);
      chain(
        pop,
        filter(ctx, t, { type: 'bandpass', from: 900 + random() * 1600, q: 1.4 }),
        env,
        gain,
      );
      pop.stop(t + 0.12);
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
    rumble.stop(when);
    roar.stop(when);
    surge.stop(when);
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
