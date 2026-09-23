# GDD 10: conventions

Rules that are not about the estate, but about how the code that runs it is
put together: how a moment in the game is counted, and how the layers
outside the simulation are allowed to talk to it and to each other.

## GDD 10.2: time, and the boundary above the sim

Sim time is an integer tick, one simulated day (`src/sim/types.ts`: `Tick =
number`). Nothing in `sim/` measures time any other way; a calendar year is
`GROWTH.daysPerYear` (360) ticks, so `src/ui/format.ts` turns a raw tick into
a year and a day the same way everywhere it is shown:

```
year = floor(tick / 360) + 1
day  = (tick % 360) + 1
```

Both are 1-based for the player, `format.date` reads "Year {year}, Day
{day}" and the phone's status bar uses the shorter `format.dateShort`, "Y{year},
D{day}" (`src/i18n/locales/*/format.json`); the tick underneath still counts
from zero. The same file holds the other display conventions: `formatRp`
renders rupiah through `Intl.NumberFormat('id-ID')` with a "Rp " prefix and
no decimal places, `formatKg` rounds kilograms to a whole number with a "kg"
suffix, and `formatPercent` rounds a 0..1 fraction to the nearest whole
percent. The sim itself never rounds or localises a number; that happens
once, here, on the way to the screen.

How fast a tick arrives is a separate concern from what a tick is, and lives
in `src/app/timeControl.ts`: `TICKS_PER_SECOND` maps each `Speed` (0, 1, 10, 50) to ticks per real second, so 1x is a day every five seconds and 50x is
ten days a second. `TimeControl` is also where the world clock's pause lives:
`App.ts` accumulates a `worldMs` that only advances while the sim is running,
and every animation that should freeze with the game reads `worldMs` /
`worldDt`, never `performance.now()`, which keeps ticking for the camera and
the interface regardless.

Everything above the sim, `app/`, `render/`, `ui/`, is free to talk to
itself in a way the sim is not: `src/shared/EventBus.ts` is a typed wrapper
over `mitt`, used only by those layers talking to each other through
`app/`. The sim never touches it; `tick()` returns an array of `SimEvent`s
and that is the only channel out (GDD 1.8), so a bug in a render-side signal
can never be mistaken for something the simulation actually did.

The production interface is Svelte 5 and Tailwind (`src/ui/svelte/`), the
one place a player-facing panel is allowed to live. A one-off prototype,
`src/app/Spike.ts`'s art spike or `workbench.html`, is plain DOM instead,
because it exists to try a look or a mechanic, not to be a panel, and is
proven only by its own smoke test rather than the game's panel tests:
`e2e/spike.spec.ts` boots the WebGL 2 fallback, confirms the scene actually
rendered and that the spike's weather uniforms reached the shader, and stops
there. It does not exercise gameplay, because the spike has none to
exercise.

## GDD 10.3: headless play, the sweep and the scripted player

`src/sim/` imports nothing from three.js, Svelte or the DOM, so it can be
driven without a browser at all. `src/sim/autoplay.ts` is the one scripted
player this buys: given `AutoplayOptions` (a seed, a number of years, how
many blocks to work) it does the sensible, boring thing a careful player
would, build the Kopdes on day one, chop the nearest owned blocks, buy
`bibit` and plant as soon as land clears, harvest every block the day it
ripens, and, with `managePests` set, also sanitise debris, trap beetles,
treat and remove sick palms and replant the gaps. With an `expand` option
it keeps buying and clearing more land, and upgrading the Kopdes, while
cash stays above a reserve. It is deliberately not clever: the point is to
see what the numbers do to a player who simply follows the loop, not to
find the optimal one.

That one player backs two different uses of the same run. `pnpm sweep`
(`tools/balance-sweep.ts`) calls `autoplay()` for several seeds and prints
the yearly cash, profit, sold kilograms, planted and bearing palm counts,
TBS price and certificate conditions met, so a balance change can be judged by what
an estate actually earns rather than by reading the constants that changed
it (the `balance-change` skill leans on this). The same `autoplay()` also
drives tests that need a grown, harvested, or multi-year estate without
scripting one by hand tick by tick. Because both read off the same scripted
player, a change that breaks a test's assumptions about a "sensible player"
is a change that would also move the sweep's numbers, and the two are never
quietly telling different stories about what the game rewards.
