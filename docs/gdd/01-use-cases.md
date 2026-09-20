# GDD 1: the game in use

Who acts on the estate, what they are trying to do, and the shape of the flows
that get them there. The rules themselves live in the sections this one points
at; nothing here is a number.

## GDD 1.1: actors

| Actor                       | Kind      | What it wants                                                                      |
| --------------------------- | --------- | ---------------------------------------------------------------------------------- |
| The planter                 | primary   | The only human actor. Owns the estate, spends its money, answers for what it does. |
| The clock                   | secondary | Turns real seconds into days (GDD 4.2). Every system below runs off it.            |
| The weather                 | secondary | Rain, drought, haze, lightning, flood, landslide (GDD 3.6).                        |
| The Kopdes                  | secondary | The estate's own shop, crew and payroll (GDD 3.3). Inside the system, not outside. |
| The authorities             | secondary | Attention, letters, investigations, suspension, arrest (GDD 3.9).                  |
| The Ministry                | secondary | Reads the estate once a year and certifies it or does not (GDD 3.8).               |
| The market                  | secondary | The TBS price and the input price index, moved by the headline deck (GDD 3.7).     |
| Wildlife and the neighbours | secondary | Boar, monkeys, thieves, the babi ngepet (GDD 6.7). They arrive uninvited.          |

Only the planter presses anything. Every other actor acts on a tick, which is
why so much of the game happens while the player watches.

## GDD 1.2: use cases

```mermaid
graph LR
  planter([The planter])
  clock([The clock])
  authorities([The authorities])
  ministry([The Ministry])
  market([The market])

  subgraph estate[Sawit Simulator]
    take[Take land]
    clear[Clear a hectare]
    plant[Plant palms]
    reforest[Put forest back]
    tend[Tend the crop]
    pick[Harvest and sell]
    build[Build and upgrade the Kopdes]
    burn[Burn to clear]
    undo[Clear a plantation]
    pay[Pay the matter away]
    answer[Answer for the estate]
    close[Close the year]
    certify[Seek certification]
    finish[End the run]
  end

  planter --> take
  planter --> clear
  planter --> plant
  planter --> reforest
  planter --> tend
  planter --> pick
  planter --> build
  planter --> burn
  planter --> undo
  planter --> pay
  clock --> tend
  clock --> close
  market --> pick
  burn -.->|raises attention| answer
  clear -.->|forest is noticed| answer
  reforest -.->|halves what is held| answer
  authorities --> answer
  pay -.->|ends a case| answer
  close --> certify
  ministry --> certify
  certify --> finish
  answer -.->|arrest| finish
```

The dotted arrows are the point of the game: the quick way to clear is the way
that draws attention, and the slow way is the way that certifies.

| Use case              | The planter's goal                               | Refused when                                            | Rules            |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------- | ---------------- |
| Take land             | Own the block next door                          | Not for sale, not adjacent, not affordable              | GDD 3.1.1        |
| Clear a hectare       | Turn wild land into plantable ground             | Under investigation, already burning, protected forest  | GDD 3.1.1        |
| Plant palms           | Fill 144 slots with bibit                        | Ground not cleared, no stock, spoil from a slide        | GDD 3.2          |
| Put forest back       | Buy and plant saplings in one press              | No Kopdes in range and nothing in stock                 | GDD 3.10         |
| Tend the crop         | Keep palms alive and bearing                     | No stock of the kit, nothing wrong yet                  | GDD 3.4, GDD 3.5 |
| Harvest and sell      | Turn fruit into cash the same day                | Not ripe, out of Kopdes range, the crew has it on auto  | GDD 3.3          |
| Build and upgrade     | Reach further and unlock the payroll and clock   | Not cleared, not affordable                             | GDD 3.3          |
| Burn to clear         | Clear almost free, almost at once                | Rain, a wildfire already running, a standing suspension | GDD 3.6.1        |
| Clear a plantation    | Undo a wrong turn and get bare land back         | Nothing standing, a crew already on it, not affordable  | GDD 3.1.1        |
| Pay the matter away   | Make a case and a suspension go away             | The district office is honest that year                 | GDD 3.9          |
| Answer for the estate | Survive the letter, the case, the suspension     | Not a command: it happens to the estate                 | GDD 3.9          |
| Close the year        | Bank the year and read the card                  | Not a command: the clock does it                        | GDD 3.8          |
| Seek certification    | Meet five conditions and be read by the Ministry | Before year 3 the checklist is not even shown           | GDD 3.8          |
| End the run           | Reach one of the eight endings                   | Not a command, except carrying on in sandbox            | GDD 3.8          |

## GDD 1.3: how these diagrams are cut

Each shape answers a different question, so the subject of a diagram follows
the shape rather than the file layout:

- **One use case diagram, for the whole game.** Actors and goals. It never
  names a panel or a command, because a goal outlives both.
- **An activity diagram per flow.** A flow is one goal that crosses several
  commands and several systems and contains a real decision. That is where the
  design can be wrong, so that is what is worth drawing.
- **A state diagram per entity**, not an activity diagram. A block, a palm or a
  case has a life with states and transitions, and drawing it as a flow hides
  the one thing worth knowing, which is what it can become next.
- **No diagram per panel.** GDD 8 already describes the interface panel by
  panel, and a second drawing of the same thing would go stale on its own.
- **No diagram per command.** All 28 have the same shape, validate then apply,
  so the shape is drawn once in GDD 1.8 and each command's own rules stay in
  prose where the numbers can live beside them.

## GDD 1.4: a run, start to ending

```mermaid
flowchart TD
  start([New estate]) --> seed[Name it, and seed it or not]
  seed --> world[A world is generated, with one cleared block and a start site]
  world --> day{The clock runs}
  day -->|the player acts| act[Buy, clear, plant, tend, harvest, sell, build]
  day -->|the tick acts| tick[Growth, weather, pests, mobs, the market, the authorities]
  act --> day
  tick --> year{Year closed?}
  year -->|no| day
  year --> card[Year-end card: the year's money, and the ISPO checklist from year 3]
  card --> ends{An ending?}
  ends -->|no| day
  ends -->|five conditions met| clean([Certified])
  ends -->|certified with a waiver| dirty([Certified, with a waiver])
  ends -->|forest beats palms| reboisasi([Reboisasi])
  ends -->|burned, then put it all back| redemption([Redemption])
  ends -->|90 days below the credit line| bankrupt([Bankrupt])
  ends -->|attention reaches 100| arrested([Arrested])
  ends -->|caught burning at high integrity| banned([Suspended, and it stuck])
  ends -->|25 years and none of the above| fade([The horizon])
  clean --> after{Carry on?}
  dirty --> after
  reboisasi --> after
  redemption --> after
  fade --> after
  after -->|sandbox| day
  after -->|no| done([The epilogue])
  bankrupt --> rewind[Rewind to the start of a year, same seed]
  rewind --> day
  arrested --> done
  banned --> done
```

## GDD 1.5: land to cash, the core loop

```mermaid
flowchart TD
  pick[Pick a block] --> owned{Owned?}
  owned -->|no| buy[Buy land: price rises with every block owned and every block of distance]
  buy --> phase
  owned -->|yes| phase{What phase?}
  phase -->|wild| how{How to clear?}
  how -->|chop| crew[A crew works it for days, timber pays part of the wages]
  how -->|burn| fire[Cheap, fast, and it spreads: see GDD 1.7]
  how -->|open land, keep it green| forest[Reforest: buy and plant saplings in one press]
  crew --> cleared[Cleared, with stumps and debris]
  fire --> cleared
  cleared --> sanitize{Debris breeding beetles?}
  sanitize -->|yes| clean[Sanitize with a crew from the shop]
  sanitize -->|no| plant
  clean --> plant[Plant 144 bibit from stock]
  plant --> grow[Immature years: growth-days, fertiliser, pests, weather]
  grow --> bearing{Bearing?}
  bearing -->|not yet| grow
  bearing -->|yes| ripe{Ripe round?}
  ripe -->|not yet| grow
  ripe --> range{Inside Kopdes range?}
  range -->|no| spoil[Refused: the fruit would spoil on the road]
  range -->|yes| harvest[Harvest, by hand or by the Kopdes crew on auto]
  harvest --> sell[Sold the same day at the day's price]
  sell --> cash[Cash, and the next round in a few weeks]
  cash --> ripe
  forest --> cover[Forest cover: no income, but it counts for ISPO and calms the Ministry]
```

## GDD 1.6: undoing a plantation

```mermaid
flowchart TD
  open[The planter opens a planted block] --> zone[The danger zone is folded shut under the footer]
  zone --> ask{Unfold it?}
  ask -->|no| done([Nothing happens])
  ask -->|yes| price[The price is read out: every palm standing, at today's input index]
  price --> press{Press the red button?}
  press -->|no| done
  press -->|yes| confirm[The card names the losses: palms, fruit on the trees, years of growth]
  confirm --> sure{Confirm?}
  sure -->|keep it standing| done
  sure -->|clear it| pay[The wages are taken at once]
  pay --> work[A crew works the block for twelve days, palms standing the whole time]
  work --> fell[On the last day every palm comes down together]
  fell --> bare[Bare land, with the debris of the job and nothing sold]
```

Nothing is earned here. It is the one clearing that pays for none of what it
brings down, which is what makes it a punishment for a wrong turn rather than a
tool (GDD 3.1.1).

## GDD 1.7: fire, and what it costs

```mermaid
flowchart TD
  light[Light a burn: low, medium or high] --> banned{Suspended, or raining, or a wildfire already?}
  banned -->|yes| refused([Refused, with the reason on the button])
  banned -->|no| lit[The block burns for a few days]
  lit --> pressure[Fire pressure rises by the intensity's share]
  pressure --> spread{Does it catch next door?}
  spread -->|dry fuel, El Nino, high intensity| next[A neighbour catches, and the same question is asked again]
  next --> spread
  spread -->|no| over{Burned out, or rained out?}
  over --> ash[Ash: fertile ground for a while, and haze over the estate]
  ash --> seen{Was it noticed?}
  seen -->|attention| authorities[See GDD 1.9]
  pressure --> tip{Past the wildfire line?}
  tip -->|yes| wildfire[The fire is no longer yours: it burns until the rain comes]
  wildfire --> loss[Palms, forest and the year's crop go with it]
  loss --> authorities
```

## GDD 1.8: a command, from press to pixels

Every one of the 28 commands runs this path. It is drawn once here and never
again (GDD 4.2, GDD 5).

```mermaid
flowchart LR
  press[The planter presses a button] --> validate{validate}
  validate -->|a rejection with a reason| grey[The button is greyed and says why, in the player's words]
  validate -->|null| apply[apply: the state changes, and events are pushed]
  apply --> tick[The tick returns the events]
  tick --> digest[digestEvents collects what changed]
  digest --> screen[Chunks are rebuilt, palms redrawn, panels refreshed, toasts raised, sounds played]
  apply -.->|money moved, or a crew went out| now[The app answers at once, without waiting for the tick]
```

## GDD 1.9: answering for the estate

```mermaid
flowchart TD
  act[Something the estate did: chopping forest, burning, a wildfire] --> meter[Attention rises; quiet seasons forget about eleven points a year]
  meter --> forty{Attention 40?}
  forty -->|yes| letter[A letter arrives: clearing costs half again until the meter falls back under 25]
  forty --> seventy{Attention 70?}
  seventy -->|yes| case[Police at the gate: no chopping, no burning, for ninety days. Sales go on]
  case --> out{How does it end?}
  out -->|the envelope, if the office is taking calls| settle[The case is dropped, the licence comes back, attention resets to 30]
  out -->|it runs its course| closed[Closed, attention set between the two lines]
  out -->|the meter empties first| dropped[The file is closed on its own]
  seventy --> hundred{Attention 100?}
  hundred -->|yes| arrest([Arrested: the run is over])
  letter --> relief{Put forest back?}
  case --> relief
  relief -->|each reforested hectare| half[Half the attention, and half of what is left of a suspension]
  half --> meter
```

## GDD 1.10: a block's life

A block is an entity, so it gets a state diagram rather than a flow. This is
the shape the save file and the block panel both follow (GDD 7, GDD 8).

```mermaid
stateDiagram-v2
  [*] --> Wild
  Wild --> Clearing: chop, with a crew
  Wild --> Burning: burn
  Wild --> Reforesting: reforest, on open land
  Clearing --> Cleared: the crew finishes, timber sold
  Burning --> Cleared: burned out or rained out, ash left behind
  Cleared --> Planted: plant 144 bibit
  Cleared --> Reforesting: plant saplings
  Cleared --> Kopdes: build the Kopdes
  Planted --> Cleared: clear the plantation, twelve days, nothing sold
  Reforesting --> Cleared: clear the plantation
  Planted --> Burning: burn it back
  Reforesting --> Burning: burn it back
  Planted --> Planted: harvest, fertilise, treat, replant
  Reforesting --> Reforesting: the trees grow
  Kopdes --> Kopdes: upgrade, level 1 to 4
```

A landslide does not change the phase: it scars the block, and the scar is dug
out or waited out (GDD 3.6.2).
