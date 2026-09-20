# Tests

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `e2e/app.spec.ts`

The browser smoke test (GDD 9, M1a + M1b): boot on the WebGL fallback, place the
Kopdes, stock bibit at the shop, chop and plant a neighbour, speed through the
immature years, harvest a ripe round and watch it sell, then save, reload and
continue. The rest of the suite grew around it: the keyboard, the menu, naming
an estate, pause, the certificate, headlines, burning, pests, weather, the
authorities, the endings, open land and the danger zone.

The query string is the whole setup. `?webgl` forces the fallback path CI can
run, `?seed=42&fresh` makes the world deterministic and ignores any save in this
browser profile, `?turbo` runs the clock twenty times faster than a player's so
years pass in seconds, and `?debug` exposes `window.__sawit`.

### Notes

- `unlockKopdes()` and `unlockTurbo()`: level 3 is what opens the payroll and the
  50x clock (GDD 3.3). The suite has neither the years nor the cash to grow one,
  so it hands itself the level through the debug hook, and the shop redraws on
  its next refresh.
- the save and reload test: the clock is already running at 1x, which is several
  ticks a second under turbo, so the date may have moved by the time the test
  reads it. The save is proven by landing within a fortnight of where it left
  off, not to the day.
- the danger zone (GDD 8 panel 13a): it is offered only where something stands,
  it is folded shut so the red button is not on the panel until asked for, and it
  asks twice. The first press opens the question and the wide button closes it
  without sending a crew.

## `e2e/audio.spec.ts`

The estate's noises are synthesised, not recorded (`src/audio`), which means they
can be rendered offline and measured rather than listened to. Nobody here can say
whether the thunder sounds like thunder, but this suite can say that it is
audible, that it does not clip, and that its energy sits where a roll of
thunder's should.

### Notes

- `cyclicity()`: how strongly a loop's envelope repeats itself at any lag over a
  second, where 0 is a texture and 1 is a metronome. A sine LFO on a gain scores
  high and is heard as a slope up and down, which is not what weather or fire
  does.

## `e2e/landing.spec.ts`

The landing page (GDD organic): static HTML that says what the game is, loads
no engine, and hands off to `play.html`. The game page paints its boot
shell before the engine arrives and takes it down once the app is up.

## `e2e/spike.spec.ts`

Smoke test (GDD 10.2): boot the app on the WebGL 2 fallback path, prove the scene
actually renders, and prove the spike's weather uniforms are wired. `?webgl`
forces the fallback because WebGPU is not available in headless CI (GDD 6.4), and
`?spike` selects the spike over the game. The WebGPU path is exercised by hand in
a real browser.

The canvas cannot be read back with `drawImage`: the renderer runs without
`preserveDrawingBuffer`, so the backbuffer is empty by the time a 2D context
could copy it. The test asks the renderer what it drew instead.

## `e2e/workbench.spec.ts`

The workbench (`workbench.html`): the development page that puts one part of the
estate on a turntable at a time. It is not linked from anywhere and it carries
`noindex`, so this suite is the only thing that opens it.

The last test is the one worth keeping: switching subjects over and over must
leave the renderer holding exactly what it held to begin with. That is the whole
answer to "does this leak", measured rather than assumed.

## `tests/render/easing.test.ts`

The easing curves and the spring integrator (GDD 6.5), pinned so a change to the
feel of the interface is deliberate. ADR 0007 records the parity rule.

### Notes

- the settle test: GDD 6.5 promises a settle of about 600 ms. Measured, the toy
  preset, whose zeta is about 0.54, is within about 1.3% of target at 600 ms,
  settled to the eye, and converges properly a few hundred milliseconds later.

## `tests/render/palette.test.ts`

The palette strip and its lookup. The strip is 256 by 2: wet colours on row 0,
dry on row 1, and the alpha channel of both is how much light a slot gives off
rather than opacity. The material turns that into an emissive term, so a slot
with alpha is a slot that glows.

## `tests/sim/endings.test.ts`

The endings (GDD 3.8): certification, bankruptcy, arrest, the rewind and the
sandbox that follows a finished run.

### Notes

- `certifiableEstate()`: an estate one week from the end of year 10 that meets
  every ISPO condition, which is a Kopdes at maximum level, 16 bearing hectares,
  three profitable years and the profit behind them, and no burns.

## `tests/sim/society.test.ts`

Attention, letters, investigations, the coordination fee and the news deck's
register (GDD 3.9).

### Notes

- the cast guard: the deck names officials, so the rule moved rather than went
  away. Every name in it must be one of the invented cast, and no headline may
  carry the name of a real person the cast is drawn from. The guard is the point,
  because the register invites exactly that mistake.

## `tests/sim/weather-events.test.ts`

The event deck, the seasons and the landscape they act on (GDD 3.6): haze,
flood, drought, ash, landslides, cover crop and excavation.

### Notes

- the drought test: El Niño keeps the rain under the breaking point for years on
  end, which is the point of it, and a wet regime is what ends a drought. A short
  one may already have broken during the ticks the test runs first.

## `tests/tools/comments.test.ts`

The two-line comment rule from CLAUDE.md, enforced over every tracked file rather
than by review. It counts a comment's text lines, ignoring the delimiters, and
fails with the file and line of anything longer. The detail that does not fit in
two lines belongs in this reference, under the file's `### Notes`.
