# Simulation: balance tables

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/balance/biomes.ts`

Per-biome costs, clearing times and modifiers (GDD 3.1).

## `src/sim/balance/endings.ts`

End-state tunables (GDD 3.8): the ISPO certificate, bankruptcy, the operating
ban, and the 25-year horizon. Calibrated with `pnpm sweep -- --ispo`.

## `src/sim/balance/events.ts`

The weather event deck and the landscape hazards (GDD 3.6, GDD 3.6.2).

Events are data: a weight, the conditions that allow a draw, a duration
range, and the effects the world-events system applies while they run. The
deck is drawn at most once every `drawEveryDays`, so a bad month is a bad
month rather than a stack of five disasters. Drought is not drawn; it is
what a long enough dry streak _is_.

## `src/sim/balance/fire.ts`

Fire tunables (GDD 3.1.1, GDD 3.6). Burning is nearly free and fast; these numbers
are the brakes: spread, the pressure meter, and the wildfire threshold.

Pressures 1 / 3 / 5 against a threshold of 3: a high burn tips it on its
own, a medium burn sits exactly on the line so anything after it tips, and
low burns spaced out over seasons still never do. Burning big is now a
decision to lose control, not a gamble.

## `src/sim/balance/growth.ts`

Growth and yield tunables (GDD 2, GDD 3.6.1).

Palms accumulate growth-days, not calendar days: each tick a palm gains
`1 * G` where `G = light * moistureCurve(moisture) * fertility * stress`.
Stages are thresholds on accumulated growth-days; senescence is calendar age,
because palms get tall whether or not they grew well.

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

## `src/sim/balance/mobs.ts`

Mob tunables: who wanders the estate, how often, and what they do.

Mobs live in the simulation as data (position in block units, an intent,
a target) so a save replays the same thieves and the same boars. Wild
animals are set dressing with a population cap; the thief and the babi
ngepet take things; workers are hired at the Kopdes and cost a wage a day.

Speeds are blocks per day. A block is twelve world units and a day is ten
seconds at 1×, so 0.12 blocks a day is a slow stroll and anything past 0.5
reads as purposeful; the renderer spreads each day's walk over the day.

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
a microphone moves the price of a seedling, and that nobody who says it is
ever the one who pays.

The lane decides the colour, the severity decides the weight, and `effects`
is the "what this does to you" line the player actually reads.

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

## `src/sim/balance/prices.ts`

Starting economy, land pricing and shop prices (GDD 3.1.1, GDD 3.3, GDD 3.5).

## `src/sim/balance/seasons.ts`

Seasonal baseline (GDD 3.6): a 360-day year with a wet season (Nov–Mar) and a
dry season (Apr–Oct), and the climate regime that scales it each year.

## `src/sim/balance/society.ts`

Society tunables (GDD 3.7, GDD 3.9): the hidden integrity stat, the macro-economic
deck, and the authority meter with its warnings and arrest.

## `src/sim/balance/world.ts`

World shape and generation tunables (GDD 4.6).

Balance lives in data, never as literals inside systems (GDD 4.5).
