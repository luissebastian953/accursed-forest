# Application

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/app/App.ts`

Composition root (GDD 4.1): wires sim, render, ui, input and persistence.
Nothing below this file knows about anything beside it.

### Notes

- `startApp()` layout: the world fills the root, and the block panel is an
  aside laid over its right edge that slides in with a selection (GDD 8 panel
  9). Laying it over rather than docking it means the canvas never resizes
  when it comes and goes; the HUD and ticker shift left by its width instead,
  through `--chrome-right`. Modals mount on the root so they cover both.
- `unlockAudio`: the audio context cannot start until the player has clicked
  something, so the first gesture anywhere on the page (a `pointerdown` or
  `keydown` on the root) opens it. After that the calls are cheap no-ops that
  keep a suspended context awake.
- `uiPress`: every button in the UI taps, and a locked one thuds. Disabled
  buttons never fire `click`, but Chromium still delivers `pointerdown` to
  them, which is the one place the thud can be heard from.
- `WON`: the endings the epilogue frames as a win: certified either way
  (`clean`, `dirty`), the forest back (`reboisasi`), or the slope put right
  (`redemption`). The rest, including the estate simply fading out, get the
  drone.
- `syncWeatherAudio()`: the weather's own noise. Rain fades in when the sky
  turns and away when it clears, riding the day's rain so a storm is heavier
  than a shower. The sky flips between rain and cloudy on neighbouring days,
  and at 50× a day is a tenth of a second, so a shower that stopped on every
  dry day would stutter. It holds through the gaps (`RAIN_HOLD` real seconds
  of dry sky) and only goes when they last.
- `syncFireAudio()`: fire on the estate, under everything else. It is the
  loudest thing that can happen and the one the player can least afford to
  tune out, so it sits low and leans on the vignette and the clock lock to
  carry the alarm.
- `watchedByAuthorities()`: whether the attention gauge is worth a place in
  the bar. It arrives with the first letter and stays while anything is
  open: a meter above zero, a letter, a case or a suspension. An estate with
  a clean sheet loses it again rather than carrying a permanent zero.
- `certMetNow()`: how many conditions are met today, which is what the
  certificate panel shows. The bar used to show last year's audited count
  instead, so the two disagreed for up to a year at a time. It is worked out
  once a day, because it walks every block, and again whenever a command
  changes something (a successful dispatch clears the cache).
- `conditionsNow()`: the same conditions, but every one of them reads as met
  once `hasWon(state)` (GDD 8 panel 19). A certified estate played on in the
  sandbox will drift out of its own conditions, and a checklist that un-ticks
  itself claims the Ministry took something back that it did not. The freeze
  lives here rather than in `certificateConditions()` so the sim keeps
  answering honestly for the year close that awards the ending.
- `onTick()` save marking: moisture and growth move every tick on every
  estate block, so every chunk with estate in it is dirty for the save on
  every tick. The dirty set earns its keep on chunks far from the estate that
  were touched once.
- `worldMs`: the world's own clock, wall time less every moment the estate
  was paused. Everything that moves in the scene reads it (through
  `worldNow()`) instead of `performance.now()`, so Pause stops the clouds,
  the mobs, the fires and the crews along with the days. The camera and the
  interface keep wall time, because a paused player still wants to look
  around.
- `treesFelled`: a forest block gives up a tree at each quarter of the chop,
  and whatever is left when the block clears. A block that clears while
  unwatched (a loaded save, a 50× skip) just drops what remains.
- `BEETLES_WORTH_A_PIN`: the pin layer (design kit 6a) marks the Kopdes and
  any block the pests have got into. Beetles only matter once there are
  enough of them to bore a palm, so a stray one does not plant a pin on the
  map.
- `onFrame()` panel refresh: the panels are DOM, so ten refreshes a second
  (`UI_REFRESH_MS`) is plenty, and it leaves the frame budget to the world.
  Refreshing every frame cost the sim a third of its ticks at 20× on the
  software renderer.
- `onFrame()` bloom: the glow pass runs only while something glows, because
  it costs a few full-screen passes. What glows is fire, gold coins in the
  air, and the glints over anything worth clicking, which is also what marks
  the golden capybara.
- `onTheEstate()` and mob clicks: some mobs are worth a click rather than a
  block: the golden capybara, and the babi ngepet on the day it stands up at
  the Kopdes. Both sparkle while they can be caught, and their drawn position
  is projected on the click, because the crowd mesh itself cannot be picked
  apart.
- `worthAClick()`: what is worth a click: the golden capybara, and the babi
  ngepet once it is on your land, whether it is still ambling in as a pig or
  up on two legs. The sim decides what that is worth; this only decides what
  glints.
- `titleScreen`: the title screen sits over the estate pulled back to a
  backdrop. Dev and test URLs that name a world (`?seed`, `?fresh`) go
  straight in. `welcome` greets a named estate by name, with its code in hand
  for sharing.

## `src/app/MobPoc.ts`

`?mobs`: the mob proof of concept.

A real estate (seed 42, streamed chunks) with a crowd of rigged mobs walking
over it, and a readout of what they cost: frame time, the time spent posing
them, draw calls and triangles. Buttons set the crowd size and switch between
the two ways of drawing it; one scene node per body part, or every part
skinned on the CPU into one merged mesh; so the question "will this make
the game heavy?" gets a
number rather than an opinion. "Chop a tree" plays the tree-fall animation.

`?mobs&count=200&mode=nodes` presets the crowd for scripted measurement, and
`window.__mobs` exposes the stats.

## `src/app/ModelGallery.ts`

`?models`: every scenery model from `render/models/` on a grass plinth, in
rows, three variants each, with its name underneath. For tuning the look
without hunting for a cave on a ridge.

## `src/app/Spike.ts`

The art spike (GDD 6.9).

One flat 12x12 block with stepped edges, 144 procedural slab-frond palms,
hemisphere + directional light, linear fog, a `season` slider (wet -> dry
palette lerp), a `haze` slider (fog colour/density + event tint) and a
"Replant" button that pops all 144 palms in with the row cascade.

Pass criteria: it looks like Kalimantan in September at one end and a wet
January at the other, the fronds read as palms from the diagonal, and the
cascade pop-in makes you want to press the button again.

This is deliberately pre-sim: no `sim/` imports, no game state. It exists to
prove the art direction and the WebGPU/TSL/instancing stack before M1a builds
on top of it.

### Notes

- `CAMERA_DISTANCE`: how far back the camera sits. Under an orthographic
  projection this changes nothing about the framing, but fog is measured in
  view depth, so every fog distance is expressed relative to it.
- `startSpike()` renderer: WebGPU with an automatic WebGL 2 fallback. `?webgl`
  forces the fallback so the Playwright smoke test and CI exercise the same
  path (GDD 6.4).
- `makeSpikeField()` wobble: the columns outside the terrace step down with a
  low-frequency deterministic wobble. It must vary slowly across neighbouring
  columns: per-column noise carves one-column pits, and the mesher then
  correctly draws their walls, which reads as speckle.

## `src/app/loop.ts`

The game loop (GDD 4.2 step 3): fixed-step sim ticks on a wall-clock
accumulator, and a render callback every animation frame regardless of
tick rate. This is the one place wall-clock time lives (GDD 4.3).

The accumulator is capped: after a long stall (a hidden tab, a debugger
pause) the loop runs at most `maxTicksPerFrame` ticks and drops the rest,
rather than freezing the page to catch up on thousands of sim days.

### Notes

- `step()`: advances to `nowMs`, running the ticks the elapsed time has
  earned and then one frame. It is public so tests can drive the loop without
  an animation frame, and it returns the number of ticks run.

## `src/app/timeControl.ts`

Sim speed (GDD 4.2, GDD 8 panel 2): pause, 1×, 10×, 50×.

While anything burns the speed is locked to 1×; you watch your fire
(GDD 3.1.1). The lock is separate from the requested speed so releasing it
returns the player to what they had chosen.

### Notes

- `TICKS_PER_SECOND`: ticks per real second at each speed. 1× is one sim day
  every five seconds (GDD 4.2), long enough to watch a crew work a tree and a
  boar cross a block. 10× is two days a second and 50× ten days a second, a
  year in about half a minute.

## `src/app/vitals.ts`

Core Web Vitals from real visitors (GDD organic): LCP, INP and CLS, plus
FCP and TTFB, sent to Google Analytics 4 as events when `gtag` is on the
page, and logged in development so a regression shows up in the console
before it shows up in Search Console.

## `src/app/workbench/Workbench.ts`

`workbench.html`: the estate's parts on a turntable, one at a time, the way
a component gallery does it for widgets. Pick a subject on the left, ask it
to do something on the right, change the backdrop to judge the light, and
watch what the renderer is holding while you do.

It is a development page. Nothing links to it, it is not in the sitemap,
and it carries `noindex`; it exists so a model can be looked at without
hunting for one on a ridge somewhere, and so a leak shows up as a number
that climbs rather than as a tab that dies an hour later.

## `src/app/workbench/WorkbenchPanel.svelte`

The workbench chrome: the catalogue on the left, the controls on the right,
and the stage between them. Every subject is offered the same vocabulary of
actions; the ones it has not implemented are disabled, so what is missing is
as plain as what works.

## `src/app/workbench/subjects.ts`

What the workbench can put on the turntable, and what each one can be asked
to do. One entry per thing worth looking at on its own: a scenery model, a
palm at a stage, a mob, an effect.

Every subject implements whichever of the shared actions make sense for it.
The panel draws the whole vocabulary either way and greys out what a
subject has not implemented, so the gaps are as visible as the behaviour.

### Notes

- `mobSubject()` climbing trunk: a climber in the game is up a tree; on the
  bench there is nothing to be up. A bare trunk appears under it while it
  climbs and goes again after: a whole tree would only hide the thing being
  looked at.

## `src/app/workbench/workbenchState.svelte.ts`

What the workbench panel shows, and the handful of things it can ask the
stage to do. The stage (`Workbench.ts`) owns the renderer and hands this a
fresh view whenever something changes; the panel only reads it.
