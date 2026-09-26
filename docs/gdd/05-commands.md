# GDD 5: commands

A command is the only way the player changes anything about the estate.
Growth, weather, pests and the market move on their own every tick; the
planter's whole vocabulary for acting on the world, buying land, planting,
harvesting, burning, paying off a case, is this list and nothing beyond it.
The path a command takes from a button press to a changed world and a
redrawn screen is drawn once, as a diagram, in
[GDD 1.8](01-use-cases.md#gdd-18-a-command-from-press-to-pixels); this
section is the contract every command keeps to reach that diagram, and the
list of the 28 that exist today.

## The shape

Every command lives in its own file under `src/sim/commands/`: twenty-three
implementation files for twenty-eight commands, since a few files hold a
small family of closely related ones (`treatments.ts` holds the three pest
kits, `palmSlots.ts` holds the three per-slot actions, `workers.ts` holds
hiring and dismissal), plus `index.ts`, the registry, and `handler.ts`, the
shared contract, twenty-five files in the directory in all. Each command
file exports the same two functions, the `CommandHandler` shape from
`src/sim/commands/handler.ts`:

```ts
validate(ctx, command): Rejection | null; // why not, in the player's words, or null to proceed
apply(ctx, command): void; // change state, push events; may assume validation already passed
```

`validate` never mutates. It returns either `null`, meaning the command may
proceed, or a `Rejection`, a typed `code` plus a `reason` string that the UI
shows verbatim on the greyed-out button, so the player learns what is and
is not allowed by reading rather than by guessing. `apply` is only ever
called after `validate` has returned `null` for the same command, so it does
not have to re-check anything `validate` already confirmed; it changes
`SimState` and pushes events onto the tick's event sink, the same events
[GDD 4.2](04-architecture.md#gdd-42-the-frame-from-a-press-or-a-tick-to-the-screen)
describes leaving the sim.

`src/sim/commands/index.ts` holds the registry, a single
`Partial<Record<CommandType, CommandHandler>>` mapping each command's `type`
discriminant to its handler. It is the only place in the codebase that knows
every command by name: `Sim.dispatch()` looks a command up here, runs
`validate` then `apply`, and refuses anything the registry does not
recognise. Adding a command means adding it here and nowhere else needs to
change to find it; the corresponding entry in the `Command` union
(`src/sim/types.ts`) and the zod `CommandSchema` in
`src/persistence/schema.ts` are the two other places a new command has to be
declared, so that the save format and the simulation's command set never
drift out of step.

Every command that is actually applied is recorded: `SimState.commandLog`
appends `{ tick, command }` on a successful `dispatch`, capped at
`commandLogCap` (`4,000`, [GDD 4.4](04-architecture.md#gdd-44-the-state-is-plain-data)).
This is what makes a run replayable: a seed plus its command log reproduces
the run exactly, which is how the year-start snapshots and the bankruptcy
rewind work without storing a second copy of the world for every year
([ADR 0001](../adr/0001-pure-sim-core.md)). It is also how the headless
balance sweep judges a change: `tools/balance-sweep.ts` plays years of
estate through `src/sim/autoplay.ts`, and the autoplay script does nothing a
player could not do, it builds the Kopdes, buys bibit, chops and plants
owned blocks and harvests ripe ones, entirely by calling `sim.dispatch()`
with the same commands below. A balance number the sweep prints is a
measurement of what these commands actually cost and pay, not a shortcut
that bypasses them.

## The commands

Twenty-eight commands, in the order the registry lists them:

| Command               | File                     | What it does                                                                                           |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `BuyBlock`            | `buyBlock.ts`            | Instant title on a for-sale block adjacent to land already owned; buying does not clear it.            |
| `ChopBlock`           | `chopBlock.ts`           | Puts a crew on a block to clear it over several days and sell the timber; the safe, slow way to clear. |
| `PlantBlock`          | `plantBlock.ts`          | Fills a cleared block's 144 slots with bibit or forest saplings from stock.                            |
| `ReforestBlock`       | `reforestBlock.ts`       | Buys whatever a block is short of and plants forest saplings on it in one step.                        |
| `ClearPlantation`     | `clearPlantation.ts`     | Fells every palm on a planted or reforesting block at a price per palm standing; nothing is sold.      |
| `PlaceKopdes`         | `placeKopdes.ts`         | Builds the estate's admin building on one cleared block; required before buying or selling.            |
| `HarvestBlock`        | `harvestBlock.ts`        | One picking round on one ripe block inside Kopdes range, sold the same day.                            |
| `FertilizeBlock`      | `fertilizeBlock.ts`      | One application lifts a block's fertility for `FERTILIZER_DAYS` (90 days).                             |
| `UpgradeKopdes`       | `upgradeKopdes.ts`       | Raises the Kopdes a level, extending the range TBS can be sold same-day from.                          |
| `BuyItem`             | `buyItem.ts`             | Buys stock from the Kopdes shop at `base × inputPriceIndex`.                                           |
| `BurnBlock`           | `burnBlock.ts`           | Burns a block at low, medium or high intensity; nearly free and fast, but it can spread.               |
| `SanitizeBlock`       | `sanitizeBlock.ts`       | A sanitation crew from stock clears a block's debris, the real fix for beetles.                        |
| `ExcavateBlock`       | `excavateBlock.ts`       | A one-shot crew digs out a landslide's spoil, or opens a mass grave, so the block is ground again.     |
| `IrrigateBlock`       | `irrigateBlock.ts`       | A per-block upgrade that floors dry-season moisture, at a daily water cost thereafter.                 |
| `DrainBlock`          | `drainBlock.ts`          | A per-block upgrade that flood-proofs a block and caps how waterlogged it can get.                     |
| `SetTrap`             | `treatments.ts`          | Sets pheromone traps against beetles on one block for a window of days.                                |
| `ApplyMetarhizium`    | `treatments.ts`          | Applies Metarhizium, a beetle treatment, to one block for a window of days.                            |
| `ApplyTrichoderma`    | `treatments.ts`          | Applies Trichoderma, a Ganoderma treatment, to one block for a window of days.                         |
| `RemovePalm`          | `palmSlots.ts`           | Removes one infected or dead palm from a slot; its remains add debris until sanitized.                 |
| `TrenchPalm`          | `palmSlots.ts`           | Cuts an isolation trench around one slot, cutting the root links Ganoderma spreads along.              |
| `ReplantBlock`        | `palmSlots.ts`           | Replants a block's empty slots from stock.                                                             |
| `CoverCropBlock`      | `coverCropBlock.ts`      | A cheap per-block planting that halves a slope's slide chance once established, 90 days on.            |
| `SettleInvestigation` | `settleInvestigation.ts` | A large payment ends an active case and lifts a suspension, resetting attention to 30.                 |
| `SetAutoHarvest`      | `setAutoHarvest.ts`      | Hands picking to the Kopdes crew for a surcharge, or takes manual harvest back.                        |
| `HireWorker`          | `workers.ts`             | Puts a sanitizer, plant doctor or security worker on the payroll.                                      |
| `DismissWorker`       | `workers.ts`             | Takes a hired worker off the payroll.                                                                  |
| `TapMob`              | `tapMob.ts`              | Catches the golden capybara or the babi ngepet before it leaves the estate.                            |
| `KeepPlaying`         | `keepPlaying.ts`         | After a certificate or the fade, carries on in sandbox with no further end checks.                     |

Reforestation is deliberately not a separate species of block: `PlantBlock`
takes a `species` of `'palm'` or `'forest'`, so putting forest back is one
planting path with two things to plant, not two commands that happen to look
alike. `ReforestBlock` sits alongside it as the one-press convenience that
buys what is missing and calls `PlantBlock` with `species: 'forest'` on the
player's behalf, so the arithmetic of "how many saplings, at what price"
never has to be worked out by hand.

The rejection a `validate` returns is not free-form: `Rejection.code` is a
closed set of reasons (`notOwned`, `notAdjacent`, `wrongPhase`, `noCash`,
`banned`, `outOfRange`, `notRipe`, `gameOver`, and the rest, in
`src/sim/types.ts`), and `reason` is the sentence the UI shows on the
greyed-out button. Ordering matters where more than one reason could apply
at once: `HarvestBlock`, for one, checks "still immature" before "next round
in N days" before "nothing on the trees," because that is the order a player
reads them in, not the order that is cheapest to compute.

This is also why this section is a table and not twenty-eight diagrams:
[GDD 1.3](01-use-cases.md#gdd-13-how-these-diagrams-are-cut) already gives
the reason, every command shares the one shape drawn in GDD 1.8, so what
is worth writing down per command is its own rule in prose, not a second
picture of the same arrow.
