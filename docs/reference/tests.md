# Tests

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `e2e/landing.spec.ts`

The landing page (GDD organic): static HTML that says what the game is, loads
no engine, and hands off to `play.html`. The game page paints its boot
shell before the engine arrives and takes it down once the app is up.
