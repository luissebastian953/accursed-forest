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

## `src/sim/systems/endings.ts`

Endings system (GDD 3.8). Runs after `society` and before the news, so the
news can headline whatever ended today.

Daily it keeps the run's books; the epilogue's counters and the estate's
own lines in the chronicle; and watches for bankruptcy. On the first day
of each year it closes the year, checks the ISPO certificate and, at the
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

## `src/sim/systems/pest.ts`

Pest system (GDD 3.4): Ganoderma along the lattice, beetles in the debris,
and the plague flag when either gets out of hand.

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
and the crew digging a landslide out (GDD 3.6.2).

### Notes

- `terrain()` felling branch: a crew felling the plantation. The palms stand
  until the last day, then come down together, and the block goes back to bare
  land with the debris of the job on it. Nothing is sold: this is the one
  clearing that pays for nothing it brings down.
- `terrain()` excavation branch: the crew digging a slide out. When they are
  done the spoil goes, the debris with it, and the scar comes off the map.

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
