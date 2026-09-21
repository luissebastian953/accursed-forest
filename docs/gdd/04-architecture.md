# GDD 4: architecture

How the game is built, so that everything else in this document has somewhere
honest to stand. This section is the design's reasons for the shape of the
code; the shape itself, the layer table, the file tree, the sequence diagrams,
is kept once in [the architecture notes](../architecture.md) and cross-linked
rather than redrawn.

## GDD 4.1: the sim knows nothing about the screen

The simulation is a self-contained core: no Three.js, no DOM, no wall clock,
no `Math.random`. Everything that watches, draws or clicks sits above it and
reads it; nothing above it is allowed to reach back in and change it except
through a command. This is the decision recorded in
[ADR 0001](../adr/0001-pure-sim-core.md), and the reason for it is practical
rather than aesthetic: a 25-year sim with weather, pests, fire, economics and
an authority system all interacting is nearly impossible to debug if a report
of "the beetles did something wrong" might also mean the renderer, the DOM or
the frame rate did something wrong first. Cutting the sim off from all three
means a bug is reproducible from a seed and a command log alone.

The rule is a layer table, arrows pointing down only: `app` may reach every
layer below it, `ui`, `render`, `input`, `persistence` and `workers` may
reach `sim` and `shared` but not each other, and `sim` may reach only
`shared`. The full table, and what each layer holds, is in
[the architecture notes](../architecture.md#the-layers); it is not repeated
here because a second copy is a second place for it to go stale.

What makes the rule worth having is that it is not a convention anyone has to
remember. `eslint-plugin-boundaries` reads the same layer table from
`eslint.config.js` and fails the build on an import that points the wrong
way, and `sim/` additionally bans the `three` import, the `window` and
`document` globals, and any import reaching up into `render/`, `ui/` or
`app/`, by lint rule rather than by review comment. [ADR
0004](../adr/0004-pnpm-and-the-boundary-lint.md) records why the lint tool
was chosen for exactly this: a competing, faster linter was rejected because
it could not express the boundary rule, and the boundary rule was the point
of choosing one at all. A layer violation is a red build, not something a
reviewer has to notice.

The composition root, `src/app/App.ts`, is the one file allowed to see every
layer at once. It exists so that nothing below it has to: the sim does not
know the renderer exists, the renderer does not know the UI exists, and a
panel does not know how a chunk is meshed. Wiring lives in exactly one place.

## GDD 4.2: the frame, from a press or a tick to the screen

Two things drive the estate: the player pressing a button, and the clock
ticking on its own. Both funnel through the same shape, drawn once as a
diagram in [GDD 1.8](01-use-cases.md#gdd-18-a-command-from-press-to-pixels);
this section is that diagram's account of where each step actually lives in
the code.

A press becomes a command, and a command is validated before it is applied:
`validate` returns a typed rejection with a reason or `null` to proceed, and
`apply` may assume validation already passed. That shape is exported by
every file in `src/sim/commands/`, enforced by the `CommandHandler` interface
in `commands/handler.ts`; the full contract and the command list are in
[GDD 5](05-commands.md).

The clock lives apart from all of it. `GameLoop` in `src/app/loop.ts` runs a
fixed-step accumulator against wall-clock time: every frame it adds the
elapsed milliseconds to a running total and drains whole ticks out of it at
the current rate, so the sim always advances in whole days regardless of how
choppy the frame rate is. A stall, a hidden tab, a paused debugger, cannot
demand years of catch-up: `maxTicksPerFrame` (six, by default) caps how many
ticks one frame will ever run, and the rest of the backlog is simply dropped.
Speed itself is `TICKS_PER_SECOND` in `src/app/timeControl.ts`: pause is
`0`, `1×` is `0.2` ticks a second, which is one sim day every five seconds,
long enough to watch a crew work a tree or a boar cross a block, `10×` is
`2` ticks a second and `50×` (`TURBO_SPEED`) is `10`, a year in about half a
minute. `50×` stays locked behind `TURBO_KOPDES_LEVEL` (Kopdes level 3), and
while anything is burning the speed is capped to `FIRE_LOCK_SPEED` (`10×`)
regardless of what the player asked for, so a fire is always watched rather
than skipped.

Each tick, `Sim.tick()` runs its systems in a fixed order and returns the
events they raised; that order is a rule in its own right and is described
once in [`docs/simulation.md`](../simulation.md) rather than here. The
events are the only thing that crosses back out of the sim: `src/sim/events.ts`
notes that `sim/` does not emit, it returns an array, and everything above it
consumes that array after the fact. `render/sync.ts` is the classifier on
the other side, turning that array into what the scene needs to redo, which
chunks to rebuild, which palms to redraw, what to say in a toast, so the
event-to-visual mapping has exactly one home. Nothing downstream diffs state
to work out what changed; the events already say so.

## GDD 4.3: one wall clock, one seed, and nothing else random

Two kinds of time exist in this game and they are kept strictly apart.
Wall-clock time lives in exactly one place, `src/app/loop.ts`'s accumulator;
nowhere in `sim/` may call `performance.now()`, `Date.now()`, `setTimeout` or
`requestAnimationFrame`, and the lint config enforces each of those bans by
name. The sim instead runs on `worldMs`, a clock the composition root
advances by the frame's elapsed time only while the game is not paused
(`worldMs += dt * 1000` when `running`, untouched otherwise); everything that
animates in the scene, palms swaying, mobs walking, fire flickering, reads
`worldMs` and `worldDt` rather than the frame's own timestamp, which is what
lets Pause stop the estate cold while the camera and the interface keep
moving in real time.

Randomness has the same discipline. The whole simulation draws from a single
seeded stream, `xoshiro128**`, hand-written so its state is four plain
`uint32` fields that a save file can serialise exactly and resume mid-stream;
`Math.random` is banned in `sim/` by lint for the same reason wall-clock
calls are. World generation does not share that stream: `forkRng(seed, tag)`
derives an independent one from the seed and a tag without consuming or
disturbing the main stream, so terrain stays a pure function of the seed no
matter how many random draws the weather or the mobs have made first. Between
the two, a seed plus the sequence of commands a player issued reproduces a
run exactly, which is what the year-start snapshots and the bankruptcy
rewind rely on, as [ADR 0001](../adr/0001-pure-sim-core.md) records.

## GDD 4.4: the state is plain data

`SimState`, defined in `src/sim/types.ts`, is deliberately inert: interfaces
and unions, no classes with behaviour, nothing that cannot be JSON-ish
serialised (typed arrays are the one exception, handled by
`src/shared/base64.ts` and described in [persistence](../reference/persistence.md)).
The rule matters because a class with methods invites behaviour to leak into
the data it describes, and the whole point of GDD 4.1 is that behaviour lives
in systems and commands, not in the objects they touch.

Two parts of that shape are worth calling out by name. Palms are stored as
`PalmArrays`, a struct-of-arrays over a block's 144 slots (`plantedAt`,
`growth`, `health`, `ganoderma` and the rest as separate typed arrays rather
than 144 palm objects), because a block-sized array of small numbers is
cheaper to hold and to serialise than an array of structs. And the estate's
money is a ledger, not a running total the player has to trust:
`Economy.ledger` is an array of `{ tick, kind, amount }` entries, capped at
`ledgerCap` (`500`) entries, kept only long enough to explain a recent
change rather than a whole run.

Next to the ledger sits the command log, `SimState.commandLog`, every applied
command with the tick it happened on. It is what [GDD 5](05-commands.md)
means by a replayable run, and it is capped too: `commandLogCap` (`4,000`)
in `src/sim/balance/prices.ts`, on the understanding that older years are
summarised (into `RunState.years`) well before a run's command count could
reach it.

One gap is worth stating plainly rather than glossing over: `Block.species`,
which tells a planted or reforesting block whether it is carrying palms or
forest, is not part of the shape this section's citations describe, and the
code says so directly, "GDD 4.4 omits this; GDD 3.10 requires it." Reforestation
cannot work without knowing which species a block holds, so the field exists
in `SimState` regardless; the design document's account of the core types is
the piece that has not caught up.

## GDD 4.5: balance lives in data, not in the systems that read it

Every tunable number, a price, a threshold, a curve, a cap, sits in
`src/sim/balance/`, never as a literal inside a system or a command. The
reason is legibility rather than taste: a number that lives beside the rule
it serves, under a comment naming that rule's GDD section, can be found,
questioned and changed without reading the system that consumes it, and
[the GDD's own index](README.md#keeping-it-honest) leans on exactly this to
keep the design and the code from drifting apart unnoticed.

Curves are expressed the same way. `sampleCurve()` in `src/shared/math.ts`
samples a piecewise-linear curve from knots sorted by `x`, clamping outside
the knot range, and it is how things like the yield curve and the moisture
curve are written in `sim/balance/*`: a short table of points, not a formula
buried in a growth system. Changing a curve is changing a table, and the
result of that change is judged by running `pnpm sweep` before and after,
never by reading the code and guessing.

## GDD 4.6: the world is a seed, and the state is only what changed

`createWorld(seed, width, height)` in `src/sim/worldgen/index.ts` is a pure
function: elevation, moisture, rivers, the biome of every cell, the
protected forest, the villages and the start site all fall out of the seed
alone, computed on demand and cached rather than stored. The passes that
need to see the whole map at once, the rivers (traced once, least-cost, from
ridge sources to the coast), the largest forest cluster that becomes
protected forest, the start site search, and the village clusters placed
afterward and kept clear of it, run once when the world is created; the rest,
elevation and moisture, are `f(seed, x, y)` and never need to be. A cell's
biome then falls out of thresholds on that terrain: `BIOME_RULES` in
`src/sim/balance/world.ts` names them, hills at or above elevation `2` on a
slope, scrub below moisture `0.2`, forest at or above moisture `0.46`,
riverbank within `1` block of water. The map itself is `WORLD.width` by
`WORLD.height`, `64` by `64` by default, in blocks of `WORLD.blockSide`
(`12`, so 144 palm slots each, GDD 2) grouped into chunks of `WORLD.chunkSide`
(`4`) blocks a side, and the player starts owning a `WORLD.startSize` (`8`)
square around the start site, water and protected forest inside it excepted,
because nobody holds title to a river.

Because the map is deterministic, it never has to be stored: `SimState.blocks`
is sparse, holding only blocks that have diverged from what `createWorld`
would generate on its own, and `readBlock` / `writeBlock` in `src/sim/state.ts`
materialise a block into that map only on first write. `docs/simulation.md`
already describes why this matters at scale; it is not repeated here. The
same economy applies to what a tick actually walks: `rebuildActiveSet()` in
`src/sim/activeSet.ts` recomputes, every tick, the small set of blocks worth
stepping, every owned block, its one-block ring, and any diverged block still
doing something (burning, carrying debris, hosting beetles, mid-clear), so a
64×64 map's 4,096 cells never have to be visited to advance a few hundred
that matter.

The seed itself is shareable. `estateCodeFor` and `seedFromEstateCode` in
`src/sim/worldgen/index.ts` turn a seed into a seven-symbol code and back;
typing the same seven symbols back in, regardless of case, spacing or
punctuation, reconstructs the exact same estate, and any other text is
hashed into a seed instead, so a player can type whatever they like and
still get a world, with an empty box the one input that means "random."
World generation's own random choices, where exactly to place a hill, a
river's meander, are drawn through `forkRng`, described in
[GDD 4.3](#gdd-43-one-wall-clock-one-seed-and-nothing-else-random), so that
worldgen's determinism does not depend on how many draws anything else has
made first.
