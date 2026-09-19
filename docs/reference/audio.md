# Audio

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/audio/Audio.ts`

The mixer (GDD 6.6): one audio context, four buses, and the rules that keep a
fast clock from turning the estate into noise.

Nothing is created until the player's first click, because a browser will
not start an audio context without a gesture. Until then every call is a
no-op, which also means the sim and the tests can run with no audio at all.

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

## `src/audio/synth.ts`

Synthesis primitives (GDD 6.6): the handful of building blocks every sound in
`sounds.ts` is made of. No files, no decoding, no download: the estate's
noises are generated the same way its palms and its palette are.

Everything here takes a `BaseAudioContext`, so the same recipe runs live
through an `AudioContext` and offline through an `OfflineAudioContext`,
which is how the tests measure a sound without anyone listening to it.
