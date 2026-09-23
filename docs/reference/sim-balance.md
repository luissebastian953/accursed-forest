# Simulation: balance tables

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/balance/biomes.ts`

Per-biome costs, clearing times and modifiers (GDD 3.1).

### Notes

- `BiomeSpec.openLand`: open land is grass and scrub, where there is nothing
  standing to clear. A forest can be planted straight onto it, though palms
  still want the land prepared first.

## `src/sim/balance/endings.ts`

End-state tunables (GDD 3.8): the ISPO certificate, bankruptcy, the operating
ban, and the 25-year horizon. Calibrated with `pnpm sweep -- --ispo`.

### Notes

- `REBOISASI`: the ending nobody planned for. An estate that has put more of
  its land back to forest than it holds in palms, by a clear margin and not a
  token strip, is called at the close of the year, from the same year the
  ISPO checklist opens. Young forest counts, saplings do not.
- `REDEMPTION`: a secret ending (GDD 3.10), the run of someone who cleared
  land with fire, thought better of it, and put the forest back without ever
  taking a crop off the ground they burned. It is rarer than reboisasi and
  quieter: it asks for less land back, but it asks that the estate never
  became an estate.
- `BANKRUPTCY`: the bank's patience (GDD 3.8). Palms planted within Kopdes
  range are collateral: the estate may sit `creditPerHectare` in the red per
  hectare of them. Below that line for `daysInRed` straight days, or below
  zero with no collateral at all, or with the licence suspended, the loans
  are called.
- `OPERATING_BAN`: the enforcement roll on burn-to-clear (GDD 3.8). It only
  rolls while integrity is high, which only happens after a scandal made the
  news, so an operating ban is rare and always has a headline before it.
- `OPERATING_BAN.days`: a quarter of the year shut. Half a year read as
  longer than it was: a suspension in the back half of a year ran into the
  next one, so the notice named a year the player had not reached yet.

## `src/sim/balance/events.ts`

The weather event deck and the landscape hazards (GDD 3.6, GDD 3.6.2).

Events are data: a weight, the conditions that allow a draw, a duration
range, and the effects the world-events system applies while they run. The
deck is drawn at most once every `drawEveryDays`, so a bad month is a bad
month rather than a stack of five disasters. Drought is not drawn; it is
what a long enough dry streak _is_.

### Notes

- `DECK.referenceWeight`: the event weights are shares of this fixed total,
  and whatever they do not claim is "nothing happens". Without it, an event
  that cannot be drawn (already running, or the wrong season) handed its
  share to the others: with a flood running in the wet season, a draw was a
  certain ash fall.
- `EXCAVATION`: digging a slide out (GDD 3.6.2) takes a crew and a machine
  for a few days, and the hectare is ground again. The alternative is waiting
  for the debris to rot and planting through the spoil, which takes seasons.

## `src/sim/balance/fire.ts`

Fire tunables (GDD 3.1.1, GDD 3.6). Burning is nearly free and fast; these numbers
are the brakes: spread, the pressure meter, and the wildfire threshold.

Pressures 1 / 3 / 5 against a threshold of 3: a high burn tips it on its
own, a medium burn sits exactly on the line so anything after it tips, and
low burns spaced out over seasons still never do. Burning big is now a
decision to lose control, not a gamble.

### Notes

- `FIRE.spreadPerDay`: the chance per day of igniting each burnable
  neighbour, before fuel and regime. Read it together with `burnDays`: what
  matters is the chance over the whole burn. Low is about 0.16 per neighbour
  over 8 days (a controlled burn mostly stays put), medium about 0.34 over 4
  (it sometimes takes one), high about 0.4 over 2 (it takes a couple and
  often more; a big fire is meant to be a thing that gets away from you).
  0.35 a day is the ceiling: at that, one high burn chain-reacted into 130
  blocks on its own. The design doc's per-day figures were written without
  the durations and chain-reacted even at low intensity.
- `FIRE.forestSpreadFactor`: a man-made burn spreads this much more readily
  into a neighbouring block of standing forest, because dry canopy and litter
  catch where grass would not. Lightning and drought fires do not spread at
  all (`weather.naturalFires`): they burn their block out and stop, so an act
  of God never costs the player the hillside; only their own matches do.
- `FIRE.wildfireSpreadPerDay`: a wildfire's own daily spread chance per
  neighbour, replacing the block's intensity. Tuned by burned area over a dry
  season: about 50 blocks in two months and about 95 over the season in a
  normal year, a disaster for a 64-block estate but not a map reset. 0.4
  burned a quarter of the map.
- `FIRE.wildfireRegimeMultiplier`: the regime scaling for a wildfire, gentler
  than `regimeSpreadMultiplier`. A wildfire's reproduction rate sits near 1,
  so doubling it burned two thirds of the map, ×1.25 a fifth, and ×1.1 a few
  hundred blocks: the bad-year haze story without erasing the world.
- `FIRE.fuelWetAt`, `fuelDryRange`, `moistureResistance`: fuel dryness comes
  from block moisture. It is 1 at or below `fuelWetAt - fuelDryRange`, 0 at
  or above `fuelWetAt`, and raised to `moistureResistance`. Dry-season ground
  (about 0.4 moisture) reads about 0.6; riverbanks and irrigated blocks are
  firebreaks. Soil moisture is not fuel dryness: an earlier `(1 - moisture)`
  term choked every fire and made the wildfire a hair-trigger between 3 and
  600 blocks.

## `src/sim/balance/growth.ts`

Growth and yield tunables (GDD 2, GDD 3.6.1).

Palms accumulate growth-days, not calendar days: each tick a palm gains
`1 * G` where `G = light * moistureCurve(moisture) * fertility * stress`.
Stages are thresholds on accumulated growth-days; senescence is calendar age,
because palms get tall whether or not they grew well.

### Notes

- `GROWTH.immatureDays`: growth-days from planting to first fruit. The design
  doc's ~900 was a real palm's three years; with a day then ten seconds long,
  that was an hour of watching seedlings, so the whole life cycle runs at 0.6.
- `YIELD_CURVE`: kilograms of TBS per palm per harvest round at peak health,
  by calendar age in years. It ramps from first fruit (about a year and a
  half in) to year 5, plateaus to 18, declines to 25, and then the palm is
  senile (GDD 2). About 10.5 kg per palm per round, a round every six days
  when this was tuned (`HARVEST_ROTATION_DAYS` is five now), is far above a
  real estate's best: a good round should feel like a payday, and a year of
  them should build something.
- `FOREST_GROWTH`: reforestation grows on the same machinery as palms, with
  its own thresholds: sapling to young to mature forest over roughly eight
  years (GDD 3.10). Saplings take hold quickly, so a player who replants sees
  the ground turn green within a season rather than waiting most of a year
  for the first sign of it.

## `src/sim/balance/macroEvents.ts`

The headline deck (GDD 3.7): what the country does to the estate while the
player is busy with it. Every entry is data, and every lever below is read
in exactly one place, so an event can only do what it says here.

The world is fictional and so are its officials. President Prerows, Energy
Minister BehLOL, Finance Minister Purboy, Agriculture Minister Amrun,
Forestry Minister Rajuli, his deputy Nazarra and the previous president
Mulyonows are invented figures in an invented kabupaten. What is not
invented is the shape of the thing: a speech moves prices, an enforcement
drive moves land, and nobody in the deck is ever held to account for
either.

### Notes

- `MacroEvent.after`: the event is only drawn after this one has already
  happened. It is a `MacroEventId` by intent, but typed loosely as a string
  because the ids are read back off this very table; a test holds it to real
  ones.

## `src/sim/balance/mobs.ts`

Mob tunables: who wanders the estate, how often, and what they do.

Mobs live in the simulation as data (position in block units, an intent,
a target) so a save replays the same thieves and the same boars. Wild
animals are set dressing with a population cap; the thief and the babi
ngepet take things; workers are hired at the Kopdes and cost a wage a day.

Speeds are blocks per day. A block is twelve world units and a day is ten
seconds at 1×, so 0.12 blocks a day is a slow stroll and anything past 0.5
reads as purposeful; the renderer spreads each day's walk over the day.

### Notes

- `WILDLIFE.kinds`: where each kind turns up (the block biomes it spawns on
  and prefers to wander over) and its weight in the draw. Monkeys and
  orangutans keep to the forest; the capybara keeps near the water.
- `HABITS`: what each animal actually does with its day. A species with no
  habits of its own falls back to `BEHAVIOUR.weights`; anything left out of
  its table it never does, so a pangolin never circles and only a climber
  climbs.
- `BABI_NGEPET.spottedDrop`: what falls out when it is spotted on the estate
  before it ever reaches the Kopdes, while it is still ambling in as a pig.
  Less falls out of it than `caughtDrop`, but clicking it here costs it the
  raid it came for.

## `src/sim/balance/news/economic.ts`

Economic lane (GDD 3.7): the price walk and the macro deck.

## `src/sim/balance/news/endings.ts`

How a run ends, in the papers (GDD 3.8): the operating ban, the certificate;
clean or bought; the fade, and the bank. Every one goes into the chronicle.

## `src/sim/balance/news/government.ts`

Government lane (GDD 3.7, GDD 3.9): reactions, scandals, and the authorities'
letters. Whether a response does anything is the integrity stat's business;
the words give it away. `.hollow` variants publish under low integrity,
`.real` under high.

## `src/sim/balance/news/index.ts`

Every headline template, by key (GDD 3.7).

## `src/sim/balance/news/natural.ts`

Natural lane (GDD 3.7): generated directly by the weather and the land.

## `src/sim/balance/news/statements.ts`

The headline deck's own copy (GDD 3.7): what the ticker says when one of the
events in `macroEvents.ts` lands.

The country here is invented, and so is everyone in it. President Prerows,
Energy Minister BehLOL, Finance Minister Purboy, Agriculture Minister
Amrun, Forestry Minister Rajuli, his deputy Nazarra and the former
president Mulyonows hold offices that do not exist in a kabupaten that does
not exist. What the deck satirises is the shape: that a sentence said into

### Notes

- `hasHeadline()`: the one question the deck asks before dealing. It is here
  rather than in `society.ts` so that both the draw and `news.ts` build the
  key the same way, through `macroNewsKey()`, and so that neither system has
  to import the other.
- Commenting an entry out of `economic.ts`, `government.ts`, `natural.ts` or
  `statements.ts` is how a headline is retired, which is why
  `tests/tools/comments.test.ts` exempts those four from the two-line comment
  rule: a commented-out template is a thirty-line comment by any other reading,
  and the rule is about prose, not about copy on the shelf.

a microphone moves the price of a seedling, and that nobody who says it is
ever the one who pays.

The lane decides the colour, the severity decides the weight, and `effects`
is the "what this does to you" line the player actually reads.

### Notes

- `What burning costs` (`macro.hazeSeason`, `macro.animalsGone`,
  `macro.onTheBrink`, `macro.burnedCarcasses`): this section is written flat.
  The deck jokes about ministers; it does not joke about this, and the
  contrast is the point.

## `src/sim/balance/news/types.ts`

A headline template (GDD 3.7). Templates are data with slot variables and
several phrasings each, so the feed does not repeat itself. Institutions
and people are fictional and generic; the Palace, the Ministry, a governor,
a regional police chief. Satire targets institutions, never persons.

Slots: {region} {estate} {n} {days} {pct} {price} {block} {until} {cost}

## `src/sim/balance/pests.ts`

Pest tunables (GDD 3.4). Two pests, two tempos: Ganoderma is slow and
structural (root to root along the lattice, years to kill), the rhinoceros
beetle is fast and about sanitation (breeds in debris, bores young palms).
Debris feeds both, which is why what you leave behind when clearing matters.

### Notes

- `DEBRIS.decayPerDay`: debris points that decay away on their own each day.
  Slow on purpose: a chopped forest's trunks (55) take almost four years to
  rot, which is what keeps the beetles fed if nobody sanitizes. At 0.12 the
  pile was gone in fifteen months and beetles never finished a seedling.
- `BEETLES.damagePerBeetle`: expected health lost per immature palm per day,
  per beetle. At capacity on fresh forest debris (about 110 beetles) a
  seedling loses about 0.7 hp a day and dies inside a year if nothing is
  done; mature palms are not attacked (GDD 2).
- `GANODERMA.spreadPerDay`: the chance per day that an infected palm infects
  each of its six lattice neighbours, before debris, plague and Trichoderma.
  One symptomatic palm takes a neighbour roughly every four months:
  Ganoderma is the slow pest, and at 0.0025 an outbreak ran through a block
  faster than a careful player could answer it.
- `GANODERMA.latentDays`, `symptomaticDays`: latent to symptomatic, then
  symptomatic to dead, and young palms go fast (GDD 2). Both are scaled with
  the palm life cycle (0.6, see `GROWTH.immatureDays`) so an infection still
  plays out over the same share of a palm's life.

## `src/sim/balance/prices.ts`

Starting economy, land pricing and shop prices (GDD 3.1.1, GDD 3.3, GDD 3.5).

### Notes

- `LAND_PRICE`: land price is biome base × (1 + owned × `perOwnedBlock`) ×
  (1 + distance × `perDistance`), where distance is Manhattan blocks from the
  Kopdes, or from the estate's centre before one is placed (GDD 3.1.1: each
  purchase raises the next).
- `CLEAR_PLANTATION`: clearing a plantation (GDD 3.1.1) is felling every
  palm on a block and hauling the stumps out. It is priced per palm
  standing, so a full hectare costs about twelve chops, because it is a
  punishment for a wrong turn, not a tool; and it pays nothing for what
  comes down, unlike a forest chop.
- `KOPDES_UPGRADE_COST`: what each level of the Kopdes costs (GDD 3.3).
  Entry `i` is the cost to go from level `i` to `i + 1`; index 0 is unused,
  because building is separate (`KOPDES_BUILD_COST`). The ladder climbs
  steeply on purpose. The range it buys is the difference between selling a
  corner of the estate and all of it, level 3 opens the payroll and the 50x
  clock besides, and the top level is one of the five ISPO conditions. So
  each step has to be earned out of the crop rather than paid for out of the
  opening balance, and an estate should be years into its harvests before it
  reaches the top.

## `src/sim/balance/seasons.ts`

Seasonal baseline (GDD 3.6): a 360-day year with a wet season (Nov–Mar) and a
dry season (Apr–Oct), and the climate regime that scales it each year.

### Notes

- `SEASONS.rain`: daily rain is a clamped normal draw from the season's
  distribution. It is calibrated so a grassfield block under the normal
  regime averages G ≈ 1.0 over a year and reaches 900 growth-days in about
  900 calendar days (GDD 3.6.1); El Niño (×0.55 rain) stretches that to about
  1000 days. The Kalimantan dry season is "less wet", not arid: an earlier
  0.2 dry-season mean starved growth to G ≈ 0.6 and pushed first harvest
  past four years.
- `SEASONS.dryStreakBelow`: `dryStreak` counts consecutive ticks with rain
  below this, meaning a day drier than an ordinary dry-season day, not a day
  with no rain at all. Daily rain is drawn independently, so a strict "no
  rain" threshold (0.1) never produced a fortnight's streak even under El
  Niño.
- `SEASONS.cloudPerRain`: `sun = 1 - cloudPerRain * rain`, before haze and
  ash attenuation. Kept mild on purpose: GDD 3.6.1 puts normal light near 1.0
  and reserves the big drops for haze (about 0.7) and ash (about 0.5).
- `SKY.dryStormStreak`, `dryStormRain`, `dryStormChance`: dry storms. After
  a run of dry days, a middling sky can still turn to thunder. These are the
  storms that start fires; a wet one douses its own lightning within a day or
  two.
- `SKY.spellDays`: weather comes in spells. Once the sky is set it holds for
  this many days before it is read off the rain again, so a sunny week is a
  week. A storm still breaks in whenever the rain calls for one.

## `src/sim/balance/society.ts`

Society tunables (GDD 3.7, GDD 3.9): the hidden integrity stat, the macro-economic
deck, and the authority meter with its warnings and arrest.

### Notes

- `ATTENTION`: attention (GDD 3.9) is how much the authorities have noticed
  the estate, 0 to 100. Increases are scaled by `0.5 + integrity`, so with
  low integrity the meter climbs slower: three quarters speed at the
  starting 0.25.
- `AUTHORITY.reforestationRelief`: putting forest back is the one thing the
  Ministry takes at face value. Each reforested hectare halves what is held
  against the estate, both the attention on it and whatever is left of a
  suspension.
- `AUTHORITY.investigationClosesAt`: when a case runs its course, attention
  falls to at most this: still over the letter line, so the file stays open,
  but far enough under the police line that only a new offence brings them
  back. Without it, a meter still at 70 or more on the last day opened a
  fresh 90-day case the same tick.
- `AUTHORITY.settleCost`: "settle the matter" (GDD 3.9) is the envelope that
  makes a case go away, and a suspension with it. It is only on offer while
  the district office is crooked enough to take it, and it is dear enough
  that it is never the cheap way out: an estate pays about a year of good
  harvests for the favour.

## `src/sim/balance/world.ts`

World shape and generation tunables (GDD 4.6).

Balance lives in data, never as literals inside systems (GDD 4.5).

### Notes

- `START_SITE.forestRing`: standing forest is counted in and around the
  starting square, this many blocks out. The choice between chopping and
  burning needs forest to choose about, and a start on bare grassland looked
  like nothing was there.
- `START_SITE.openTarget` / `openWeight`: the counterweight to the two above.
  Wanting forest around the square says nothing about what is inside it, so
  two seeds in five used to open with the Kopdes ringed by trees. This asks
  for a fifth of the square to be open ground, which is what gives the Kopdes
  an edge cell to sit on (GDD 4.6).
- `START_SITE.kopdesMinOpen` / `kopdesBuriedPenalty`: the same rule at the
  scale of one hectare. The penalty is deliberately larger than the whole
  distance-to-centre range it competes with, so it reads as a veto rather
  than a preference, and falls back to the old behaviour only where every
  candidate is buried.
