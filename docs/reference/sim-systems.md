# Simulation: systems

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/systems/economy.ts`

Economy system (GDD 3.3, GDD 3.5): sell the day's TBS, charge upkeep, walk the price.

The price is a bounded random walk pulled back toward a long-run mean; mild
market pressure, not a market. Macro shocks and the input price index move
with the news system (M1f).

## `src/sim/systems/endings.ts`

Endings system (GDD 3.8). Runs after `society` and before the news, so the
news can headline whatever ended today.

Daily it keeps the run's books; the epilogue's counters and the estate's
own lines in the chronicle; and watches for bankruptcy. On the first day
of each year it closes the year, checks the ISPO certificate and, at the
horizon, calls the fade.

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

## `src/sim/systems/news.ts`

News system (GDD 3.7). Runs last each tick and turns what happened into
headlines: every item comes from a template keyed by a sim event or a
derived condition, the UI never invents one. Events of the same kind in the
same tick make one headline; a key does not repeat within its cooldown.

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

## `src/sim/systems/terrain.ts`

Terrain system (GDD 3.1): clearing and burning progress, timber, debris decay,
and the crew digging a landslide out (GDD 3.6.2).

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
