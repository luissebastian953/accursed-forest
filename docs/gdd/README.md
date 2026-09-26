# Game design document

This is where the design lives. The code cites it 194 times, from `GDD 2` to
`GDD 10.2`, so a reader who finds a number in `balance/` can get to the rule it
came from.

One file per top-level section, named for its number, so `GDD 1.2` is
[[01-use-cases.md](01-use-cases.md)](01-use-cases.md) and a search for the section number finds
both the rule and every line of code that serves it.

## The sections the code cites

| Section           | Subject                                                           | File                                     |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| 1.1 to GDD 1.10   | The game in use: actors, use cases, the flows, a block's life     | [01-use-cases.md](01-use-cases.md)       |
| 2                 | The estate: a block is one hectare, 12 by 12, 144 palms           | [02-estate.md](02-estate.md)             |
| 3.1, 3.1.1        | Clearing: chopping, the crew, the timber                          | [03-systems.md](03-systems.md)           |
| 3.2               | Planting palms and forest                                         | [03-systems.md](03-systems.md)           |
| 3.3               | The Kopdes: range, levels, the shop, auto-harvest                 | [03-systems.md](03-systems.md)           |
| 3.4               | Pests: beetles, Ganoderma, treatments, the slot grid              | [03-systems.md](03-systems.md)           |
| 3.5               | Fertiliser and fertility                                          | [03-systems.md](03-systems.md)           |
| 3.6, 3.6.1, 3.6.2 | Weather, fire, flood, drought, landslides                         | [03-systems.md](03-systems.md)           |
| 3.7               | News, the macro deck, and what the headlines do                   | [03-systems.md](03-systems.md)           |
| 3.8               | Endings: the certificate, bankruptcy, the ban, the horizon        | [03-systems.md](03-systems.md)           |
| 3.9               | The authorities: attention, letters, investigation, arrest        | [03-systems.md](03-systems.md)           |
| 3.10              | Reforestation                                                     | [03-systems.md](03-systems.md)           |
| 3.11              | The haunting: mass graves, the dead, and animals caught in a burn | [03-systems.md](03-systems.md)           |
| 4.1 to GDD 4.6    | Architecture: the composition root, state, the world              | [04-architecture.md](04-architecture.md) |
| 5                 | Commands: one file each, the only way the player changes anything | [05-commands.md](05-commands.md)         |
| 6.1 to GDD 6.9    | Look: palette, terrain, models, animation, sound, picking         | [06-look.md](06-look.md)                 |
| 7                 | Saving: the slot, the schema, the migrations, the snapshots       | [07-saving.md](07-saving.md)             |
| 8                 | The interface, panel by panel                                     | [08-interface.md](08-interface.md)       |
| 9                 | Keeping it honest: the suites, the sweep, the workbench           | [09-quality.md](09-quality.md)           |
| 10.2, 10.3        | Conventions: time, formatting                                     | [10-conventions.md](10-conventions.md)   |

## Keeping it honest

The design is what the game is meant to be; the code is what it is. Where
they disagree, one of them is wrong and it is worth finding out which before
changing either.

Two things make that checkable rather than hopeful:

- **The balance tables carry their section.** Every constant in
  `src/sim/balance/` sits under a comment naming the rule it serves, so a
  number that drifts from the design is visible in review.
- **The sweep measures the result.** `pnpm sweep` plays the game without a
  player and prints what an estate actually earns, year by year, across
  several seeds. A design change that does not show up there did not happen.
