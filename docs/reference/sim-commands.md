# Simulation: commands

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/commands/burnBlock.ts`

BurnBlock (GDD 3.1.1): the tempting way to clear. Nearly free, fast, and it
spreads. Each burn adds its intensity's pressure; past the wildfire
threshold the fire stops being yours. The game never forbids it; it makes
the consequences legible.

## `src/sim/commands/buyBlock.ts`

BuyBlock (GDD 3.1.1): instant title on a for-sale block adjacent to land you
already own. Buying does not clear; a bought forest still needs chopping.

## `src/sim/commands/buyItem.ts`

BuyItem (GDD 3.3): the Kopdes shop. Prices are `base × inputPriceIndex`, so a
currency headline (M1f) shows up on the shelf immediately.

## `src/sim/commands/chopBlock.ts`

ChopBlock (GDD 3.1.1): the safe, slow way to clear. Puts a crew on the block;
`systems/terrain.ts` advances the work each day, leaves stumps and debris
behind when it is done, and sells the timber. Chopping forest is noticed
(GDD 3.9); under a letter it costs half again, under investigation it is banned.

## `src/sim/commands/clearPlantation.ts`

ClearPlantation (GDD 3.1.1, GDD 8 panel 13a): fell a planted or reforesting
block back to bare land. Priced per palm standing at the day's input index,
so a full hectare runs to tens of millions, and nothing is sold: it is the
one clearing that pays for nothing it brings down. A crew goes on the block
at once; the palms stand until the last day and come down together in
`systems/terrain.ts`, leaving the debris of the job behind. The panel asks
twice before sending the order.

### Notes

- `apply`, the felling: the palms stay standing while the crew works through
  them, and come down together when the job ends (`systems/terrain.ts`).
  What the player sees in the meantime is a crew on the block and a ring
  counting down.

## `src/sim/commands/coverCropBlock.ts`

CoverCropBlock (GDD 3.6.2): a cheap per-block planting that holds the soil.
It halves a slope's slide chance once established, ninety days after
sowing, and lasts three years. It never fully replaces forest cover.

## `src/sim/commands/drainBlock.ts`

DrainBlock (GDD 3.6): a per-block upgrade that makes a block flood-proof and
caps how waterlogged it can get. Floods themselves arrive with the event
deck (M1e); the moisture ceiling works today.

## `src/sim/commands/excavateBlock.ts`

Digging out a landslide (GDD 3.6.2): the one-shot crew from the shop, with the
machine that comes with it. They are on the block for a few days, and when
they are done the spoil is gone, the debris with it, and the hectare is
ground again rather than a scar.

The alternative, which costs nothing, is to wait for the debris to rot and
plant through the spoil. That takes seasons.

## `src/sim/commands/fertilizeBlock.ts`

FertilizeBlock (GDD 3.5): one application lifts the block's fertility factor
for `FERTILIZER_DAYS`, which feeds both growth-days and yield through `G`.

## `src/sim/commands/handler.ts`

The shape every command file exports (GDD 4.2). `validate` returns a typed
`Rejection` the UI shows verbatim, or `null` to proceed; `apply` may assume
validation passed.

## `src/sim/commands/harvestBlock.ts`

HarvestBlock (GDD 2, GDD 3.3): one round on one block. The fruit goes to the
Kopdes intake and is sold at the day's price by the economy system; a block
outside Kopdes range is refused outright, because its fruit would spoil on
the road (GDD 2: TBS must reach the mill within a day).

The crew's wage is charged but never gated on cash: a harvest pays for
itself, and the first balance sweep showed what happens otherwise; an
estate that dipped below zero on the eve of its first round could not
afford to pick, and spiralled to −Rp 74M with fruit rotting on the trees.

Rejections are ordered for the player, not the machine: "still immature",
then "next round in N days", then "nothing on the trees".

## `src/sim/commands/index.ts`

Command registry. One file per command (GDD 5); the map below is the only
place that knows them all.

## `src/sim/commands/irrigateBlock.ts`

IrrigateBlock (GDD 3.1): a per-block upgrade. Lifts the dry-scrub penalty,
floors moisture in the dry season, and costs water every day after.

## `src/sim/commands/keepPlaying.ts`

KeepPlaying (GDD 3.8): after the certificate or the fade, carry on in sandbox;
the same estate, no further end checks. Losses have no sandbox; they have
the rewind.

## `src/sim/commands/palmSlots.ts`

Per-palm actions (GDD 3.4): remove an infected or dead palm (its remains add
debris until sanitized), cut an isolation trench around a slot, and replant
a block's empty slots from stock.

## `src/sim/commands/placeKopdes.ts`

PlaceKopdes (GDD 3.3): the estate's admin building, on one cleared block.
Required for buying and selling from M1b on.

## `src/sim/commands/plantBlock.ts`

PlantBlock (GDD 3.2, GDD 3.10): fill a cleared block with palms or forest saplings
from stock. Bibit and saplings are bought at the Kopdes (`BuyItem`); the
block needs one per plantable slot.

## `src/sim/commands/reforestBlock.ts`

ReforestBlock (GDD 3.10): put a block back under forest in one step. The two
halves of reforesting, buying saplings at the Kopdes and planting them,
were separate commands and a player had to work out the arithmetic between
them. This buys exactly what the block is short of and plants it.

Saplings already in stock are used first, so a block out of the Kopdes's
range can still be reforested from what the estate is carrying.

## `src/sim/commands/sanitizeBlock.ts`

SanitizeBlock (GDD 3.1, GDD 3.4): a sanitation crew from stock clears debris;
the only real fix for beetles, and what makes a cleared forest block's
organic soil safe to plant.

## `src/sim/commands/setAutoHarvest.ts`

SetAutoHarvest (GDD 3.3): hand the picking to the Kopdes crew, or take it back.
While it is on, every ripe block in range is picked the day it ripens for a
small surcharge, and `HarvestBlock` is refused; the crew has it.

## `src/sim/commands/settleInvestigation.ts`

SettleInvestigation (GDD 3.9): while integrity is low, a large payment makes
the police cars leave and lifts a suspended licence with them. It resets
attention to 30; and the news makes it clear exactly what happened.

It is the most expensive button in the game, and it is not always there:
an honest district office will not take the call.

## `src/sim/commands/tapMob.ts`

Catching something at it (GDD POC): the golden capybara that turns up among
the others, and the babi ngepet, both while it ambles onto the estate as a
pig and on the day it stands up at the Kopdes.
Both are worth something to whoever spots them and clicks before they are
gone; the capybara simply goes, the pig drops its takings and bolts. It is
the one command aimed at a mob rather than a block.

## `src/sim/commands/treatments.ts`

Pest treatments (GDD 3.4): pheromone traps, Metarhizium and Trichoderma, each
a kit from the Kopdes applied to one block for a window of days.

## `src/sim/commands/upgradeKopdes.ts`

UpgradeKopdes (GDD 3.3): each level extends the range within which TBS can be
sold same-day. Level-ups add a wing to the building (render, M1b+).

## `src/sim/commands/workers.ts`

HireWorker / DismissWorker: the Kopdes puts people on the payroll. A hired
worker is a mob that stays until dismissed, is paid every day, and finds
its own jobs; debris for the sanitizer, sick palms for the plant doctor,
ripe blocks and thieves for the guard.
