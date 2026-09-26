# Simulation: core

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/activeSet.ts`

The active set (GDD 4.6): which blocks the systems tick this turn.

Owned blocks, their one-block ring, and any diverged block that is still
doing something; burning, carrying debris, hosting beetles, or simply not
wild any more. Rebuilt every tick; at estate scale it is a few hundred ids.

## `src/sim/autoplay.ts`

A scripted player for balance sweeps and tests (GDD 10.3, `tools/balance-sweep.ts`).

It does the sensible, boring thing: build the Kopdes on day one, chop the
nearest owned blocks, buy bibit and plant as soon as land is cleared, and
harvest every block the day it is ripe. With `managePests` it also does the
sanitation and pest work a careful player would. Nothing clever; the point
is to see what the numbers do to a player who simply follows the loop.

### Notes

- `AutoplayOptions.managePests`: do the sanitation and pest work a careful
  player would: sanitize debris before planting and whenever it piles up, trap
  beetles, treat and remove visibly sick palms, and replant the gaps.
- `AutoplayOptions.expand`: keep expanding. Each month, while cash stays above
  `reserve`, chop and plant the next owned block in Kopdes range, up to
  `maxBlocks`, and upgrade the Kopdes whenever it can be afforded on top of the
  reserve.
- `managePests()`: the careful player's pest routine for one planted block:
  traps when the beetles build up, sanitation when debris piles up,
  Trichoderma and removal once Ganoderma shows, and replanting the gaps every
  so often.

## `src/sim/events.ts`

Events a tick produces (GDD 4.2 step 4).

`sim/` does not emit; `tick()` returns the array and the layers above consume
it after the tick, syncing only what changed. Every event names the blocks it
touched so `render/sync.ts` can build its dirty set without diffing state.

## `src/sim/fire.ts`

Fire mechanics shared by the burn command and the world-events system
(GDD 3.1.1, GDD 3.6): what counts as fuel, igniting, finishing, extinguishing,
and the wildfire transition.

## `src/sim/haunting.ts`

The haunting (GDD 3.11), read from the blocks: which hectare is or was a
grave, how many years a planted one has been haunted and which of the three
stages that puts the estate in, what the hired hands are worth because of it,
and how much of a picked round the dead take. Everything here is a pure
function of state, so the panel, the harvest and the mobs all read the same
answer.

### Notes

- `hauntStage()`: the estate's stage is the furthest any haunted block has
  reached. One grave planted years ago is enough to haunt the whole estate,
  and a second one planted yesterday adds nothing to it.
- `missingFruit()`: the draw is forked from `HAUNT_STREAM`, the day and the
  block, not taken from the main stream, so a haunted harvest never moves the
  weather and a manual pick and an auto pick on the same day lose the same
  fruit.

## `src/sim/index.ts`

The simulation's public API (GDD 4.2).

const sim = createSim(seed);
sim.dispatch({ type: 'ChopBlock', block }); // validated; may be rejected
const events = sim.tick(); // one day; returns what happened

Pure TypeScript: nothing here knows about Three.js, the DOM or the clock.
The systems run in a fixed order each tick. The full chain from GDD 4.2 is

weather → worldEvents → terrain → haunting → growth → pest → harvest → economy → mobs → society → endings → news

Once the run is over (and not continued in sandbox) the world stops: `tick()`
does nothing and every command but `KeepPlaying` is refused.

## `src/sim/kopdes.ts`

Kopdes range (GDD 3.3): blocks within Manhattan distance `r` of the Kopdes can
sell same-day; beyond it TBS spoils on the road. Upgrades extend `r`.

## `src/sim/labels.ts`

How a block and a planting slot are written for people.

The world is indexed from zero, as arrays are, but "block 0, 0" reads as a
bug to anyone who did not write it. Only the label moves: everything else,
ids included, still counts from zero.

## `src/sim/landscape.ts`

Forest cover and landslides (GDD 3.6.2). Wild forest you leave standing is
doing work: every slope block's slide chance scales with the share of
forest around it, so clearing every forest block makes the rains dangerous.

## `src/sim/macro.ts`

What the headlines are doing to the estate right now (GDD 3.7).

Every lever in `MACRO_EVENTS` is read through this one module, and each
reader is used in exactly one place in the sim, so an event cannot quietly
reach anything it did not declare. The multipliers compound: two events
that both raise shop prices raise them together.

## `src/sim/palms.ts`

Per-block palm storage, the stage function and the planting lattice
(GDD 3.4, GDD 3.6.1, GDD 4.4).

Palms are struct-of-arrays over the block's slots. Growth is accumulated
growth-days; the stage is a threshold on that, except senescence, which is
calendar age; palms get tall whether or not they grew well.

Slots form a 12×12 triangular lattice: odd rows are offset half a slot, so
every palm has six neighbours. Ganoderma spreads root to root along it.

### Notes

- `stageOf()`: the stage a palm, or a reforested tree, is in. A Ganoderma
  stump (`ganoderma === 3`) and zero health both count as dead; senescence goes
  by calendar age; every other stage goes by accumulated growth-days.

## `src/sim/rng.ts`

xoshiro128**; the single seeded PRNG for the whole simulation (GDD 4.3).

Hand-written on purpose: the state must be plain, serialisable numbers so a
save file can restore the exact stream position, and every random draw in
`sim/` must go through here. `Math.random` is banned in `sim/` by lint.

State is four uint32s kept as plain number fields (JSON-friendly, no typed
array to base64-encode for something this small).

### Notes

- `forkRng()`: derives an independent stream from a seed and a tag, without
  touching or consuming any existing stream. Worldgen uses it so that terrain
  stays a pure `f(seed, x, y)` no matter what the main stream has done
  (GDD 4.6).

## `src/sim/run.ts`

The run's own bookkeeping (GDD 3.8): whether it is over, how it ended, and the
chronicle the epilogue replays.

## `src/sim/state.ts`

Initial state, the sparse block map, and the ledger (GDD 4.4, GDD 4.6).

`SimState.blocks` holds only blocks that diverged from world generation.
Everything reads through `readBlock` and writes through `writeBlock`, which
materialises the block into the map on first touch. That is the whole trick
that lets a 64x64 world cost the size of the estate.

### Notes

- `createInitialState()`, the starting estate: the player owns a square around
  the start site, with the Kopdes block pre-cleared (GDD 4.6). Water and
  protected forest inside the square stay unowned: you cannot hold title to a
  river.

## `src/sim/types.ts`

Core simulation types (GDD 4.4).

Everything here is plain data: no classes with behaviour, no references to
anything outside `sim/`. If it cannot be JSON-ish serialised (typed arrays
excepted, see `persistence/`), it does not belong in `SimState`.

### Notes

- `Block.fellingUntil`: a crew is felling the plantation until this tick, and
  the block goes back to bare land when they finish; -1 when nobody is. It is
  the one job that pays nothing for what comes down.
- `Block.hauntedSince`: the day a dug-out grave was planted over, or -1
  (GDD 3.11). The haunting's three stages are years counted from it, so it is
  a clock rather than a flag, and the haunting system resets it the day the
  plantation on the grave comes down. Whether a block was a grave at all is
  not stored: it is `biome === 'grave'` on a block that is no longer wild.
- `PalmArrays`: palms for one block, struct-of-arrays over the block's 144
  slots. `fertility` is deliberately absent from `Block` and from here:
  GDD 3.6.1 makes it a function of the fertilizer window, the ash window, the
  biome and the clearing history, so it is computed per tick rather than
  stored.
- `MobIntent`: what a mob is doing. Animals and ghosts cycle through `idle`,
  `pace`, `wander`, `circle` and (animals only) `sleep`; the climbers add
  `sit`, `climb` and `climbJump` among the trees; visitors `travel`, `hide`,
  `raid` and `flee`; workers `travel` and `work`; everyone eventually
  `leave`s.
