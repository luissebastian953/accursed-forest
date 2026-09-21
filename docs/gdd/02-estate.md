## GDD 2: the estate

The estate is built from one shape, repeated: a block, one hectare, carrying
144 palms. Every system that acts on a block, clearing it (GDD 3.1), tending
it (GDD 3.4, GDD 3.5), burning it (GDD 3.6.1), answering for it (GDD 3.9),
acts on this shape. This section is the shape itself, and the two things
that live longest on it: a palm's life, and the round of fruit it pays out.

### The block

A block is one hectare, `WORLD.blockSide` (12) palms to a side,
`SLOTS_PER_BLOCK` (`blockSide * blockSide`, 144) planting slots in all
(`src/sim/balance/world.ts`). The estate is a grid of these blocks, each
addressed by a `BlockId`; only a block that has diverged from its generated
state, chopped, planted, on fire, anything other than untouched wild land,
is ever stored, in `SimState.blocks`, a sparse `Map<BlockId, Block>`. An
unowned block nobody has touched costs nothing to hold: `readBlock`
regenerates it from the seed on demand instead of reading a saved copy.

The 144 slots are not a square grid. They sit on a triangular lattice, odd
rows offset by half a slot (`slotNeighbours` in `src/sim/palms.ts`), so an
interior palm has six neighbours rather than four. Ganoderma's root-to-root
spread (GDD 3.4) walks this lattice; the lattice itself is a fact about the
block, true whether or not any palm on it is sick.

### The palm

A palm passes through five stages (`GrowthStage`): seedling, immature,
mature, senile, dead. Getting to mature is measured in growth-days, not
calendar days: a palm gains at most one growth-day per tick, scaled down by
light, moisture, fertility and stress (GDD 3.6.1), so two palms planted the
same day can reach mature on different calendar days. Senescence runs the
other way, on calendar age regardless of how well the palm grew, because a
palm gets tall whether or not it grew well.

| Stage    | Reached at                                                               | Beetle risk (GDD 3.4) | Ganoderma incubation (GDD 3.4)                       |
| -------- | ------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------- |
| Seedling | 0 growth-days                                                            | yes (`isYoung`)       | fast: `GANODERMA.latentDays.immature`, 145 days      |
| Immature | `GROWTH.seedlingDays`, 110 growth-days                                   | yes                   | fast: `GANODERMA.symptomaticDays.immature`, 290 days |
| Mature   | `GROWTH.immatureDays`, 540 growth-days                                   | no                    | slow: `GANODERMA.latentDays.mature`, 290 days        |
| Senile   | `GROWTH.senileYears`, 18 calendar years                                  | no                    | slow: `GANODERMA.symptomaticDays.mature`, 860 days   |
| Dead     | `GROWTH.deadYears`, 30 calendar years, or health 0, or a Ganoderma stump | none                  | a stump still spreads, at `stumpSourceFactor` (0.5)  |

A calendar year here is `GROWTH.daysPerYear` (360) ticks (GDD 10.2).
`GROWTH.replantYears` (25) names the age the design means to prompt a
replant, sitting between senile and dead; nothing in the code reads that
constant today, so no such prompt exists yet. `ReplantBlock` only refills
empty slots, whatever emptied them; it does not look at age.

### Yield

`YIELD_CURVE` gives kilograms of TBS (the fruit bunches) per palm per
harvest round at peak health, by calendar age in years: a ramp from first
fruit to a plateau, then a decline.

| Age (years)  | 0   | 1.5 | 2.5 | 4   | 5    | 18   | 25  | 30  |
| ------------ | --- | --- | --- | --- | ---- | ---- | --- | --- |
| kg per round | 0   | 1.2 | 5   | 8.4 | 10.5 | 10.5 | 6   | 2.2 |

The peak is generous on purpose: a good round is meant to feel like a
payday. What a palm actually banks each tick is this curve's value at its
current age, scaled by the same growth multiplier `G` that governs its
growth-days, so a hazy, dry stretch pays out less even at an unchanged age.

### The harvest clock

A block's harvest clock starts the day its first palm bears fruit, and comes
round again every `HARVEST_ROTATION_DAYS` (5) days after the last round; the
design calls for ten, halved to five to match a clock that itself runs
slower than the design assumed, so a round still arrives at roughly the
design's cadence. Fruit left unpicked keeps accumulating but is capped at
`HARVEST.overripeCapRounds` (1.5) rounds' worth of that palm's current
peak, then rots on the tree rather than banking further, so a neglected
block cannot save up a year of fruit for one big harvest.

Picking a round is one command, `HarvestBlock`, one press per block: manual
until auto-harvest arrives as a Kopdes upgrade (GDD 3.3). It refuses outright
rather than let a trip go to waste: a block outside Kopdes range
(`kopdesRange`, `inKopdesRange` in `src/sim/kopdes.ts`) is rejected with
`outOfRange` rather than harvested and lost, because TBS must reach the mill
within a day. Fruit that is harvested is credited to `Economy.tbsPending`
and sold that same tick, at that day's price: TBS never survives a night, so
there is no warehouse and no held inventory of fruit, only of the price it
sold at.

### Pests and age

Two pest facts belong to the palm's age rather than to the pest itself (GDD
3.4 covers the mechanics, and the table above the numbers). The rhinoceros
beetle only bores young palms, seedling or immature; a mature or senile palm
is left alone. Ganoderma infects a palm at any age, but a young palm goes
from latent to symptomatic to dead far faster than an old one, because it
has less of a trunk to fight the rot with.
