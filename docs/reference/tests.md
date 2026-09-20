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

## `tests/app/loop.test.ts`

The fixed-step loop (GDD 4.2): 1x is one tick every five seconds and 50x is ten
ticks a second, a frame is rendered whether or not a tick ran, a stall drops its
backlog instead of catching up, a speed change does not release a burst earned
at the old rate, and a frame that throws does not stop the loop. The fire lock
lives here too: it caps the speed at 10x without forgetting what the player
asked for, and it never unpauses.

## `tests/app/timeControl.test.ts`

The speed control: the fire lock that caps the clock while something burns so a
fire is watchable, and the Kopdes gate that keeps 50x shut until the building
reaches level 3 (GDD 3.1.1, GDD 8).

## `tests/audio/settings.test.ts`

The sound settings: they round-trip through storage, fall back to the default
when nothing or nonsense is saved, clamp a volume that has wandered, read muted
only as a real `true`, and never throw when storage is switched off.

## `tests/persistence/save.test.ts`

The save (GDD 7): `load(save(state))` is the same state, a restored sim
continues identically with the RNG position intact, only diverged blocks are
stored, and a partial save rewrites just the dirty chunks plus the manifest.
The failure modes are all asserted to fail loudly rather than half-read: a
missing slot, a newer schema, a corrupt chunk, a chunk that fails validation,
and a manifest naming a chunk that is gone. Saves from v1, v2, v3 and v4 are
opened in the current build, and the migration list is checked to cover every
schema from 1 to current.

## `tests/render/chunkField.test.ts`

The chunk mesher (GDD 6.3, GDD 6.7): a chunk covers its footprint plus a
one-column border quantised to half units, planted blocks are terraced flat, a
half-planted hectare reads as half planted, tops are painted by phase and biome,
rivers hold water along the smoothed channel, and adjacent chunks meet without a
wall because border faces are culled against the neighbour. The triangle and
time budgets are asserted here, and so is the fence, which is grown only where
the crop meets bare ground.

## `tests/render/coins.test.ts`

The coin burst that marks a sale: it is thrown up and lands back where it came
from, spreads out from that point without leaving the map, clears itself a
second and a half later, and survives a burst larger than its own pool.

## `tests/render/easing.test.ts`

The easing curves and the spring integrator (GDD 6.5), pinned so a change to the
feel of the interface is deliberate. ADR 0007 records the parity rule.

### Notes

- the settle test: GDD 6.5 promises a settle of about 600 ms. Measured, the toy
  preset, whose zeta is about 0.54, is within about 1.3% of target at 600 ms,
  settled to the eye, and converges properly a few hundred milliseconds later.

## `tests/render/kopdes.test.ts`

The Kopdes building (GDD 6.3): it stands on its own hectare at every level, and
grows with every upgrade, in reach and in height, so a level is legible from
across the estate.

## `tests/render/mobs.test.ts`

The crowd: every species is a tree of parts with a body at its root and parents
before children, the poses move the body the way the role needs (sitting,
climbing, the babi ngepet rearing up), a walk swings the legs out of phase
without breaking the rig, and a mob that bolts fades out and does not come back
(GDD 6.5). Posing 500 mobs must cost well under a frame.

## `tests/render/models.test.ts`

The scenery models (GDD 6.3): every model in the catalogue is built and checked
to stay inside its declared radius and to be cheap, so a model that quietly
grows or gets expensive fails here rather than on someone's laptop.

## `tests/render/palette.test.ts`

The palette strip and its lookup. The strip is 256 by 2: wet colours on row 0,
dry on row 1, and the alpha channel of both is how much light a slot gives off
rather than opacity. The material turns that into an emissive term, so a slot
with alpha is a slot that glows.

## `tests/render/rain.test.ts`

The rain: it falls only on the days the sky itself calls rain, shows something
from the first rainy day and thickens as the rain does, and agrees with the sky
the weather system reports rather than keeping its own weather.

## `tests/shared/base64.test.ts`

The typed-array base64 codec (GDD 7) the save is written with: it round-trips
the palm arrays a block actually stores, preserves the -1 empty-slot sentinel
and extreme int32 values, encodes a view without dragging its whole buffer
along, survives an array larger than the `fromCharCode` chunk size, and
round-trips arbitrary bytes as a property.

## `tests/shared/math.test.ts`

The shared maths: clamp, lerp and inverse lerp, a smoothstep that is clamped and
symmetric about its midpoint, a modulo that is never negative because the day of
the year wraps on it, the half-unit quantiser the column mesher needs (GDD 6.3),
a piecewise-linear curve sampler, and the Manhattan distance that drives Kopdes
range (GDD 3.3).

## `tests/sim/clearPlantation.test.ts`

Clearing a plantation (GDD 3.1.1): what it costs per palm standing, that the
crew goes on the block at once and the palms stand until the last day, that
nothing is sold for what comes down, and the rejections, which are an empty
block, a crew already on it and too little cash.

## `tests/sim/economy.test.ts`

The money (GDD 2, GDD 3.3): nothing can be bought without a Kopdes, stock costs
base times the input price index, nonsense quantities and empty pockets are
refused, each upgrade extends the range and the ladder stops at the top, and
range is Manhattan distance from the Kopdes block. Harvesting is refused while
the palms are immature, and the crew on auto picks what the player would have.

## `tests/sim/endings.test.ts`

The endings (GDD 3.8): certification, bankruptcy, arrest, the rewind and the
sandbox that follows a finished run.

### Notes

- `certifiableEstate()`: an estate one week from the end of year 10 that meets
  every ISPO condition, which is a Kopdes at maximum level, 16 bearing hectares,
  three profitable years and the profit behind them, and no burns.

## `tests/sim/fire.test.ts`

Fire (GDD 3.1.1): burning is refused on land you do not own, on land with
nothing to burn and on a block already alight. Ash lifts fertility for a season,
so a burned block grows faster than a chopped one. Each burn adds its pressure
and the pressure decays over a season, two medium burns back to back cross the
threshold and one low burn never does, smoke dims the sun while it hangs, and a
wildfire can take planted palms where a controlled burn cannot.

## `tests/sim/macro.test.ts`

The headline deck (GDD 3.7): that every entry is coherent, that each lever it
declares is read in exactly one place, that its copy template exists, and that
every timed event has a chip label in both locales (GDD 8). The cast is checked
here too: only invented officials, never a real person.

## `tests/sim/mobs.test.ts`

The crowd the estate attracts: animals arrive, stay under the cap, keep to the
land that suits them and move on, living on a repertoire of standing, milling
about, crossing, circling and sleeping. Climbers take to the trees and the low
ones never do. The babi ngepet drops its takings and bolts when it is caught,
whether it is spotted on four legs or two.

## `tests/sim/pests.test.ts`

Pests (GDD 3.4): Ganoderma spreading along the lattice of roots, beetles
breeding in debris, the treatments and their windows, and the per-palm commands
that remove, trench and replant.

## `tests/sim/rng.test.ts`

The seeded generator (GDD 4.3): deterministic for a seed, different streams for
different seeds, forks that do not consume their parent, output that stays in
[0, 1) over a long run, and never the all-zero fixed point even from seed 0. It
also restores an in-flight stream exactly, which is what makes a save safe to
continue from.

## `tests/sim/sim.test.ts`

The sim itself: a run starts with the 8 by 8 estate owned, the Kopdes block
pre-cleared and nothing else diverged (GDD 4.4, GDD 4.6), and reading an
untouched block does not materialise it. Commands are refused with a reason the
player can act on: planting on wild land, acting on land you do not own, buying
land that is not adjacent, buying protected forest or water (GDD 4.2). Growth
through the immature years and determinism across two sims on one seed are
checked here as well (GDD 3.6.1, GDD 4.3).

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

## `tests/sim/worldgen.test.ts`

World generation (GDD 4.6): the same seed gives identical blocks in every cell
and different seeds give different worlds, every cell has a valid biome,
elevation and moisture, the map is a mix rather than all one biome, rivers reach
the map edge, and riverbank is exactly the strip beside the water. The estate
code round-trips to the same map, which is what makes a code worth sharing.

## `tests/tools/comments.test.ts`

The two-line comment rule from CLAUDE.md, enforced over every tracked file rather
than by review. It counts a comment's text lines, ignoring the delimiters, and
fails with the file and line of anything longer. The detail that does not fit in
two lines belongs in this reference, under the file's `### Notes`.

## `tests/tools/seo.test.ts`

The crawl files: that the sitemap lists exactly the indexable pages and never
the game page, that robots.txt names the sitemap, what an empty or malformed
`VITE_SITE_URL` does, and the Search Console verification tag.
