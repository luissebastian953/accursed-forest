# Audio

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/audio/Audio.ts`

The mixer (GDD 6.6): one audio context, four buses, and the rules that keep a
fast clock from turning the estate into noise.

Nothing is created until the player's first click, because a browser will
not start an audio context without a gesture. Until then every call is a
no-op, which also means the sim and the tests can run with no audio at all.

### Notes

- `play()`: fires a one-shot, unless it fired a moment ago or the frame is
  already full. It returns whether it actually played, which the tests read.
  `delaySeconds` holds it back, for a sound whose cause is far off.

## `src/audio/settings.ts`

Where the player's sound settings live between visits (GDD 6.6): one key in
local storage, read once at boot, written on every change. Storage can be
off or full, so every touch is wrapped and a failure means "the default".

## `src/audio/sounds.ts`

The estate's noises, written out rather than recorded (GDD 6.6).

A one-shot is a function that schedules its nodes at a time and returns how
long it lasts. A loop builds a running graph and hands back a stop. Both
take the context they draw on, so the same recipe plays live and renders
offline for the tests.

### Notes

- `thunder()`: thunder, near or far. Noise through a resonant lowpass at
  300 Hz, swelling over a fifth of a second and falling away over four, with
  a second roll arriving a moment later. Overhead it cracks and punches
  first; far away the swell is slow, the cutoff lower, the tail longer and
  the hit gone.
- `rain` (`rain-light`): two layers. A bed of pink noise rolled off above
  3 kHz, which is the sound of rain on everything at once, and over it a
  thinner spatter of brighter noise that swells and fades on its own, which
  is the drops. Flat white hiss on its own reads as a radio between stations.
- `fire` (`fire-crackle`): a body and a crackle. The body is two layers, a
  low rumble and a mid roar around 500 Hz that surges and drops the way
  flames do; the crackle is short pops of noise in the low thousands, not
  the top of the range, which is where a snap of dry wood sits. They are
  scheduled a few seconds ahead and topped up while the loop runs.
- `fire` crackle scheduling: offline contexts render their whole length at
  once and never tick a timer, so they get every crackle up front; live ones
  are fed ahead of the clock. Without this an offline render goes quiet after
  four seconds, and anything measuring it measures the silence.
- `fireAlt` (`fire-crackle-2`): fire the other way round, a second take on
  the same thing. The flames are pink noise under a lowpass whose cutoff
  wanders between about 300 and 500 Hz, rather than a gain that breathes;
  the embers are narrow, resonant pops that die inside a fiftieth of a
  second. The reference weighs its pops well under its flames and they still
  carry, because the ear is far more sensitive at three kilohertz than at
  four hundred. Here the balance is pushed further that way again: the
  blowing sits back and the embers lead.

## `src/audio/synth.ts`

Synthesis primitives (GDD 6.6): the handful of building blocks every sound in
`sounds.ts` is made of. No files, no decoding, no download: the estate's
noises are generated the same way its palms and its palette are.

Everything here takes a `BaseAudioContext`, so the same recipe runs live
through an `AudioContext` and offline through an `OfflineAudioContext`,
which is how the tests measure a sound without anyone listening to it.

### Notes

- `NOISE_SECONDS`: seconds of noise kept per buffer. A looping buffer
  repeats its own wander, and the ear finds that cycle quickly, so the buffer
  is long and its seam is crossfaded: the tail is blended into the head and
  then cut.
- `noiseBuffer()` brown scaling: the brown walk is scaled to sit around the
  same level as the white and pink buffers. Unscaled, a brown walk peaks four
  times higher and clips everything built on it.
- `drift()`: slow, aperiodic modulation of a parameter: noise read far below
  its own rate, which wanders instead of cycling. An LFO is a metronome and
  the ear finds it; this is what a fire's body or a shower's weight actually
  does. `seconds` is roughly how long one wander takes.
