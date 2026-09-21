# GDD 9: keeping it honest

There is no QA team here, so the game is honest by construction: four
different checks, each shaped by [`docs/architecture.md`](../architecture.md)'s
own boundary between the sim and everything that draws it. The sim is judged
headlessly, in bulk, on every commit. The interface is judged in a real
browser, against the same build a player gets. Balance is judged by playing
the whole game, thousands of days at a time, with nobody at the wheel. The
look is judged by eye, because that is the one thing a test cannot do for a
person.

## The unit suite

`vitest` (`npx vitest run`, or `npm run test`) runs `tests/**/*.test.ts`
headlessly, with no browser and no renderer, because `src/sim/` imports
nothing that would need one: no three.js, no Svelte, no DOM, no
`Date.now()`, no `Math.random()` outside its own seeded PRNG
([ADR 0001](../adr/0001-pure-sim-core.md)). That purity is what makes the
suite fast enough to run in full on every change and exact enough to pin a
system's behaviour to the day.

The suite is organized the way the sim is: `tests/sim/` for one system at a
time (`endings.test.ts` walks certification, bankruptcy, arrest, the rewind
and the sandbox that follows a finished run; `society.test.ts` covers
attention, letters, investigations, the coordination fee and the news
deck's own cast, including the guard that fails on any real person's name
sitting where an invented official belongs; `weather-events.test.ts` covers
the event deck, the seasons and what they do to the landscape), and
`tests/render/` for the handful of rendering pieces that are themselves pure
functions (`easing.test.ts` pins the spring integrator's settle time against
the parity rule [ADR 0007](../adr/0007-easing-parity.md) records;
`palette.test.ts` checks the 256-by-2 palette strip and that its alpha
channel reads as emission, never opacity). `tests/tools/comments.test.ts` is
the odd one out: it does not test the game, it tests the repository, walking
every tracked file to enforce the two-line comment rule from `CLAUDE.md`
("comments explain a surprise, not a function's existence") rather than
leaving it to review.

As of this writing the suite carries about 409 tests across 28 files. A
failure names the file and, for the comment rule, the exact line.

## The browser suite

`playwright` (`npx playwright test --workers=1`, or `npm run e2e`) drives
the production preview on port 4173, the same static build that ships, not
the dev server. That has one consequence worth knowing before writing a new
test: `/src/*` imports do not exist there, so a test cannot reach into the
sim or the UI state directly. Instead, booting with `?debug` exposes
`window.__sawit`, a console rather than a cheat (`src/app/App.ts`): it hands
back the running `Sim`, lets a test force a chunk or the palm layer to
redraw, reads what the renderer is currently holding (draw calls, triangles,
geometries, textures, programs, bytes), and reaches the audio engine and a
few of the scene's own classes directly. Everything else about a test is
the query string: `?webgl` forces the WebGL 2 fallback so headless CI can
run it, `?seed=42&fresh` makes the world deterministic and ignores whatever
is saved in that browser profile, and `?turbo` runs the clock twenty times
faster than a player's, so years pass in seconds rather than minutes.

`e2e/app.spec.ts` is the suite's spine, and the one file that cites this
section directly: "the browser smoke test (GDD 9, M1a + M1b)". It boots on
the fallback path, places the Kopdes, stocks bibit, chops and plants a
neighbour, speeds through the immature years, harvests a ripe round and
watches it sell, then saves, reloads and continues; the rest of the suite
grew outward from that one path to cover the keyboard, the menu, naming an
estate, pause, the certificate, headlines, burning, pests, weather, the
authorities, the endings, open land and the danger zone (GDD 8 panel 13a:
folded shut, offered only where something stands, and asking twice before a
crew is sent). `e2e/spike.spec.ts` and `e2e/landing.spec.ts` prove the art
spike renders and the static landing page hands off to the game without
loading the engine twice; `e2e/audio.spec.ts` renders the synthesised sound
effects offline and measures them (audible, not clipping, energy where a
roll of thunder's should sit) rather than asking whether they sound right;
`e2e/workbench.spec.ts` is the only thing that opens `workbench.html` at
all, and its last test is the one that matters: switching subjects on the
turntable, over and over, must leave the renderer holding exactly what it
held to start, which is the whole test for "does this leak," measured
instead of assumed.

As of this writing the suite carries about 34 tests across 5 spec files.

## The balance sweep

`pnpm sweep` (`tools/balance-sweep.ts`) plays the game without a player.
It calls `autoplay()` in `src/sim/autoplay.ts` for each of a handful of
seeds (`1, 42, 1234` by default, or whatever `--seeds` names), for `--years`
years (8 by default) on `--blocks` starting hectares, optionally fertilizing
on schedule (`--fertilize`), managing pests and expanding toward the ISPO
conditions (`--ispo`, which also raises the starting blocks to at least 3
and turns on an expansion budget), and prints, year by year, cash, net,
profit, kilograms sold, hectares planted and bearing, the TBS price and how
many of the five ISPO conditions are met. It also reports the lowest cash
the run touched and which ending it reached, if any.

This is the tool `CLAUDE.md`'s verification list means by "judge a balance
change with `pnpm sweep` before and after": a number in `src/sim/balance/`
can look reasonable in isolation and still break the game over a run, and
the sweep is what turns "this number feels right" into a printed answer. A
change to `src/sim/balance/` that does not move anything the sweep prints
did not actually change the game.

## The workbench

`workbench.html` (`src/app/workbench/Workbench.ts`, `WorkbenchPanel.svelte`,
`subjects.ts`, `workbenchState.svelte.ts`) puts one part of the estate on a
turntable at a time: a scenery model, a palm at a given growth stage, a mob,
an effect. Every subject is offered the same vocabulary of actions and
whichever it has not implemented shows up greyed rather than missing, so a
gap is as visible as a working feature. It is a development page: nothing
links to it, it carries `noindex`, and `window.__bench` (exposing the
one-shot and looping sound effects and the audio engine) exists only so the
browser suite and a developer's own console can reach it.

This is what `CLAUDE.md` means by "judge a model by eye on `/workbench.html`":
some questions (does this palm read as a palm from the camera's usual angle,
does this fire look like fire, does the light spill onto the trees beside
it the way it should) have no numeric answer, and the workbench exists so
the answer can be looked at without hunting across the map for one example
of it, and so a leak in what the renderer holds shows up as a number that
climbs rather than as a tab that quietly dies an hour later.
