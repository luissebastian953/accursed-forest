# Application

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/app/App.ts`

Composition root (§4.1): wires sim, render, ui, input and persistence.
Nothing below this file knows about anything beside it.

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

The art spike (design doc §6.9).

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

## `src/app/loop.ts`

The game loop (§4.2 step 3): fixed-step sim ticks on a wall-clock
accumulator, and a render callback every animation frame regardless of
tick rate. This is the one place wall-clock time lives (§4.3).

The accumulator is capped: after a long stall (a hidden tab, a debugger
pause) the loop runs at most `maxTicksPerFrame` ticks and drops the rest,
rather than freezing the page to catch up on thousands of sim days.

## `src/app/timeControl.ts`

Sim speed (§4.2, §8 panel 2): pause, 1×, 10×, 50×.

While anything burns the speed is locked to 1×; you watch your fire
(§3.1.1). The lock is separate from the requested speed so releasing it
returns the player to what they had chosen.

## `src/app/vitals.ts`

Core Web Vitals from real visitors (§ organic): LCP, INP and CLS, plus
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

## `src/app/workbench/subjects.ts`

What the workbench can put on the turntable, and what each one can be asked
to do. One entry per thing worth looking at on its own: a scenery model, a
palm at a stage, a mob, an effect.

Every subject implements whichever of the shared actions make sense for it.
The panel draws the whole vocabulary either way and greys out what a
subject has not implemented, so the gaps are as visible as the behaviour.

## `src/app/workbench/workbenchState.svelte.ts`

What the workbench panel shows, and the handful of things it can ask the
stage to do. The stage (`Workbench.ts`) owns the renderer and hands this a
fresh view whenever something changes; the panel only reads it.
