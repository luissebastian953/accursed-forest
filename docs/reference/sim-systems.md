# Simulation: systems

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/systems/economy.ts`

Economy system (GDD 3.3, GDD 3.5): sell the day's TBS, charge upkeep, walk the price.

The price is a bounded random walk pulled back toward a long-run mean; mild
market pressure, not a market. Macro shocks and the input price index move
with the news system (M1f).

### Notes

- `economy()` price walk: besides the headlines, two things move the mean the
  price is pulled back toward. Regional haze keeps crews at home across the
  province and buyers pay less, so the mean dips by `HAZE.priceDip` (GDD 3.6).
  Forest cover is worth money under a buyer that checks for it, so the
  estate's forest cover goes into `tbsMeanFactor`.
- `kopdesTbsShare()`: the Kopdes's own level presses the same mean down, and
  the clamp with it (GDD 3.3). It lives beside `tbsMeanFactor` rather than in
  `macro.ts` because it is a standing consequence of what the estate built, not
  a headline's lever with a duration.

## `src/sim/systems/endings.ts`

Endings system (GDD 3.8). Runs after `society` and before the news, so the
news can headline whatever ended today.

Daily it keeps the run's books; the epilogue's counters and the estate's
own lines in the chronicle; and watches for bankruptcy. On the first day
of each year it closes the year, checks the Palm Certificate and, at the
horizon, calls the fade.

### Notes

- `creditLine()`: how far into the red the bank lets the estate go before the
  days in the red start counting toward bankruptcy. Palms planted within
  Kopdes range are the collateral. Nothing is lent to an estate without a
  Kopdes or with its licence suspended.
- `redemptionReached()`: the test for the secret redemption ending. Fire was
  set here, the forest has been put back, and the estate never became an
  estate: nothing standing in palms, and not a kilogram of fruit ever sold off
  the land that was cleared.
- `slopeForestCover()`: the forest share around the estate's slopes
  (GDD 3.6.2), taken as the mean neighbourhood cover of every slope block the
  estate touches. An estate with no slopes is judged on its forest cover
  overall.

## `src/sim/systems/growth.ts`

Growth system (GDD 3.6.1).

Each tick a palm gains `G` growth-days, where

    G = light × moistureCurve(moisture) × fertility × stress

The first three factors are per block; stress is per palm (health, and in
M1d the pest stages). Stage thresholds live in `palms.ts`; yield accumulates
on bearing palms at the same rate, so a hazy round is visibly lighter.

## `src/sim/systems/harvest.ts`

Harvest system (GDD 2, GDD 3.3): ripeness and rot.

A block's harvest clock starts the day its first palm bears fruit; the block
is ripe every `HARVEST_ROTATION_DAYS` after the last round. Fruit left on
the tree past ~1.5 rounds' worth rots; the cap keeps a neglected block from
banking a year of yield. Harvesting itself is a command (`HarvestBlock`):
manual per block, as GDD 2 says, until auto-harvest arrives as an upgrade.

### Notes

- `harvestCapKg()`: the same sum the rot loop trims each slot to, totalled for
  the block, so the panel can say when a stand is carrying all it can. The cap
  was invisible until now, which made a full block look like a saving account
  rather than what it is: fruit going over, and the reason fertilizer's
  bearing bonus (GDD 3.5) pays nothing to a block nobody picks.
- `pickBlock()`, the missing fruit: the dead take their share (GDD 3.11) after
  the slots are emptied and before the kilograms are credited, so the yield on
  the trees is gone either way and only what reaches the Kopdes is short. The
  wages are paid on the round as picked, not as delivered: the crew did the
  work.

## `src/sim/systems/haunting.ts`

The haunting's own bookkeeping (GDD 3.11), run right after `terrain`: a
haunted block that is no longer planted, whether a crew felled it, a wildfire
took it or a slide buried it, goes quiet, and a block that crossed into a new
stage since yesterday says so. The stages themselves are computed in
`sim/haunting.ts`; this system only notices them change.

### Notes

- The stage event is derived, not stored: the stage at `tick` is compared
  with the stage at `tick - 1`, so a save loaded on the anniversary raises it
  once and a save loaded a day later never raises it at all, which is the
  right answer for a headline about a change.

## `src/sim/systems/mobs.ts`

Mobs (POC → game): wild animals for the eye, a thief and a babi ngepet for
the ledger, ghosts for the abandoned corners, and the workers you pay.

Runs after the economy and before society, so a theft shows up in the
day's books and the news. Every roll comes from its own stream, forked
from the seed and the tick: a crowd of boars must never shift the weather.

Positions are in block units. A mob walks toward its target a fraction of
a block a day; the renderer walks it there between ticks. Animals live on
a small repertoire; stand, mill about, cross the estate, circle, sleep;
and pick the next thing when the current one runs out.

### Notes

- `spawnCrews()`: keeps every worked block's crew topped up. A chop is always
  the player's order, so every clearing block is staffed, and so is every block
  being dug out after a slide. A fire is only the player's if the burn command
  staffed it: lightning, a drought spark and a fire that spread in from next
  door burn with nobody standing round them. Once the pressure tips into a
  wildfire, nobody works any fire at all.
- `staffBlock()`: tops a block's crew up to `WORKER_JOBS.crewSize`. The chop and
  burn commands call it the moment the order is given, so the crew is on the
  block before the next day's tick; at five seconds a day, waiting for the tick
  read as a delay.
- `onLand()` / `walk()`: nothing in the game swims, so a step into the water is
  refused and the mob slides along the bank instead. The water it tests is
  `riverChannel(world)`, the same meandering channel the renderer draws, not
  the `river` biome: the channel crosses block edges, so a `riverbank` block can
  be wet and a `river` block the channel missed is dry. Testing the biome
  instead put animals in the water wherever the two disagreed.
  `WILDLIFE.bankClearance` keeps a body's width of dry ground between the mob
  and the edge. Off the map counts as ground, so a mob with the `leave` intent
  can still go, and a mob already in the water walks out, which is what a save
  from before this rule needs.
- `stepDoctor()`: it chooses a block by sick palms per day of walking rather
  than by the raw count, and leaves only when the block is clean. Both changes
  are about the same thing, which is that walking treats nothing: the old rule
  sent it to the worst block anywhere, then rolled a 5% chance each day to
  abandon whatever it was halfway through, so on a wide estate it spent most
  of its life in transit and the infection outran it.
- Between them the payroll reaches every treatment the shop sells for a block:
  traps, Metarhizium, Trichoderma, fertilizer and the seedlings behind a pulled
  palm. Only the security guard buys nothing, having nothing to apply.
- `useItem()`: the one place a mob spends money on anything but its own wage.
  A worker takes what it needs from `state.inventory` and, finding the shelf
  empty, buys a single unit at `itemPrice(item, shopIndex(state))`, the same
  price the shop would charge the player that day. It never goes into debt for
  one: short of cash it returns false and the worker skips that job today,
  which is the opposite of `payWages()`, whose whole point is that the payroll
  is owed whether or not it can be met. Only the item-backed jobs are skipped;
  clearing debris and pulling sick palms are labour the wage already bought.
  No Kopdes check is needed because the payroll itself is gated behind one
  (`WORKERS_FROM_LEVEL`), so a worker on the estate implies a shop to buy from.
- `stepDoctor()`: the doctor used to hand itself a 120-day Trichoderma window
  free, with the number written in rather than taken from
  `GANODERMA.trichodermaDays`, and without touching stock. It now pays for the
  dose like anyone else. It also buys `bibit` to fill the gaps it makes, one
  per palm it pulls; the removal's own `PalmRemoved` redraw covers the seedling
  that takes the slot, so the refill raises no second event and no toast, which
  a daily `BlockReplanted` would.
- `stepSanitizer()`: clearing debris stays free labour. On top of it the
  sanitizer now sets a `pheromoneTrap` where the window has lapsed and, on a
  planted or reforesting block, applies a `fertilizer`. The fertilizer is the
  expensive habit: at `ITEM_PRICES.fertilizer` it is the largest recurring cost
  a worker can incur, once per block per `FERTILIZER_DAYS`.
- `spawnHaunting()`: the dead a planted grave raises (GDD 3.11). Each haunted
  block keeps a fixed few spectres on it, the count fixed per block by its id
  so a crowd does not drift up and down, and once the estate is at stage 2 a
  capped few more turn up on any owned block. They are counted by `target`,
  which is why the spectres have a habit table of their own
  (`HABITS.spectre`): a `wander` retargets a mob to the block it roams to, and
  a ghost that wandered off its grave was counted as missing and replaced,
  without end.
- `spawnSpectre()`: half ghosts, half pocong, by a coin from the mob stream.
- `burnedAlive()`: an animal standing on a burning block dies with
  `BURNED_ALIVE.killPerDay` or bolts (GDD 3.6.1). It runs after every mob has
  stepped, so a boar that walked into a fire this morning is in it by the
  time the roll is made, and the dead are dropped from the list in the same
  pass that drops the departed, without a `MobLeft`: `MobBurned` is the
  event, and the renderer raises a skull from it. Only animals burn: the crew
  working the fire, a thief in the trees and the dead themselves do not.
- `stepWild()`, the leave at a run: an animal bolting out of a fire moves at
  `BURNED_ALIVE.fleeSpeed` for as long as the block under it is burning, and
  drops to a walk once it is out. There is no `fleeing` flag on a mob; the
  fire under its feet is the flag.

## `src/sim/systems/news.ts`

News system (GDD 3.7). Runs last each tick and turns what happened into
headlines: every item comes from a template keyed by a sim event or a
derived condition, the UI never invents one. Events of the same kind in the
same tick make one headline; a key does not repeat within its cooldown.

### Notes

- `NEWS_STREAM`: headlines draw from their own stream, forked from the seed and
  the tick. The words of the news must never change the world's future:
  drawing a phrasing from the main stream shifted every later weather and pest
  roll.
- `KopdesUpgraded`: the level's headline is published on the tick after the
  upgrade, because a command's events wait in the queue until the next tick
  drains it. Its effects line quotes `KOPDES_TBS_SHARE` rather than a number of
  its own, so the copy cannot drift from the rule (GDD 3.3).

## `src/sim/systems/pest.ts`

Pest system (GDD 3.4): Ganoderma along the lattice, beetles in the debris,
and the plague flag when either gets out of hand.

### Notes

- `plagueFlags()`: its own pass over every block, after the palm loop. The
  flag used to be set inside that loop, which walks `state.palms` and skips
  anything not planted, so a block whose palms were cleared, buried or burned
  was never visited again and kept the flag for the rest of the run. Turning
  it off is therefore allowed anywhere; turning it on still wants a
  plantation, so debris on bare ground reads as beetles rather than a plague.

Ganoderma is the slow, structural pest: a latent palm turns symptomatic,
loses yield, dies, and spreads to its six lattice neighbours the whole
time; the stump keeps spreading until it is removed. Debris raises both
spontaneous infection and spread. Trichoderma halves spread; an isolation
trench cuts a slot's links entirely.

The beetle is the fast, sanitation pest: a block's population grows
logistically toward a capacity set by its debris, bores immature palms
every day, and flies to neighbouring breeding sites. Traps kill, Metarhizium
slows breeding, and removing the debris is the only real fix.

## `src/sim/systems/society.ts`

Society system (GDD 3.7, GDD 3.9): the macro-economic deck, the hidden integrity
stat, and the authority meter. Runs after the economy and before the news,
reading everything that happened this tick; including commands dispatched
since the last one, whose events wait in the same sink.

### Notes

- `drawable()`: whether the deck may deal this headline today. The
  consequences answer to the player rather than the shuffle, so a `triggered`
  headline is never dealt; once means once; a sequel waits for its first part;
  and the headlines that leave a permanent mark hold off until the estate is
  standing. Before any of that it asks `hasHeadline()`: a headline commented
  out of the news files leaves the deck and takes its levers with it, so
  retiring copy is one edit rather than a hunt through the deck, the chip
  labels and the suite (GDD 3.7). Weights are relative, so the rest of the
  deck closes the gap on its own.
- `startMacro()`: puts a headline on the wire: its permanent mark, its
  duration, and whatever it does the moment it lands. The deck draws most of
  them; the ones that answer to what the player has done are started from
  `authority()`.
- `creditReforestation()`: a hectare put back under forest, credited
  (GDD 3.9). It halves the attention on the estate and whatever is left of a
  suspension, on top of the meter drop the planting itself earns. Doing it
  twice means chopping the forest down in between, which costs more attention
  than the second credit returns, so it needs no cooldown of its own.
- `ecology()`: what burning costs beyond the meter (GDD 3.7). These headlines
  are not dealt by the deck: they answer to what the estate and the province
  have actually set alight, which is the only way a consequence reads as one.

## `src/sim/systems/terrain.ts`

Terrain system (GDD 3.1): clearing and burning progress, timber, debris decay,
and the crew digging a landslide or a grave out (GDD 3.6.2, GDD 3.11).

### Notes

- `terrain()` felling branch: a crew felling the plantation. The palms stand
  until the last day, then come down together, and the block goes back to bare
  land with the debris of the job on it. Nothing is sold: this is the one
  clearing that pays for nothing it brings down.
- `terrain()` excavation branch: one crew, two jobs. On a slid hectare the
  spoil goes, the debris with it, and the scar comes off the map. On an
  untouched grave the block becomes cleared land carrying
  `HAUNT.exhumedDebris` of earth and bone, and raises `GraveExcavated` rather
  than `BlockExcavated` (GDD 3.11). The landslide fields are cleared either
  way, so a grave on a slope that has also slid needs one crew, not two.

## `src/sim/systems/weather.ts`

Weather system (GDD 3.6). Runs first each tick: everything downstream reads
this tick's rain, sun and block moisture.

Seasonal baseline plus the light attenuation of whatever smoke is in the
air. The event deck that creates most events arrives in M1e; the wildfire's
haze already comes from `worldEvents`.

## `src/sim/systems/worldEvents.ts`

World events system (GDD 3.6): the event deck, drought, floods, ash fall,
sparks, landslides, and fire spread with its pressure and wildfire.

Every effect goes through moisture, light, fertility or damage; nothing
affects the trees by decree (GDD 3.6). Light is applied in `weather.ts`, which
reads the events this system keeps in `state.weather.activeEvents`.

### Notes

- `strikeLightning()`: a thunderstorm throws bolts at the estate and the land
  around it. Most hit wet ground and do nothing but light up the sky; one in
  four finds something that will burn, and unless it is pouring, that is a fire
  nobody lit: no pressure on the meter, and nothing for the authorities to read
  into it.
- `strikeTarget()`: where a bolt lands: anywhere over the estate's box, widened
  by the storm's reach. Drawing from the box rather than a list of blocks keeps
  the draw O(1) on a storm day, and independent of the order the sparse map
  happens to be in: a restored save must throw its bolts at the same places.
