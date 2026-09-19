---
name: balance-change
description: Change a number in src/sim/balance and prove what it did with the sweep
---

# Changing a balance number

A balance change is a claim about what the game will feel like. The sweep is
how the claim is checked.

1. **Find the rule.** Every constant in `src/sim/balance/` sits under a comment
   naming the `§` it serves. Read that section in `docs/gdd/` first; the number
   may be wrong, or the rule may be.
2. **Sweep before.** `pnpm sweep` plays several seeds for eight years with the
   autoplayer and prints cash, profit, kilograms sold, bearing hectares, price
   and ISPO progress per year. Keep the output.
3. **Change the number, and the comment above it** if the reason moved.
4. **Sweep after.** Compare year by year. A change that does not show up did
   not happen; a change that flips a run from profit to loss in year 3 is
   bigger than it looked.
5. **Run `npx vitest run tests/sim`.** Several tests pin specific costs and
   thresholds and will name the one you moved.
6. **Commit as `feat(sim):` or `fix(sim):`.** `balance` is a scope, not a
   type. Say in the body what the sweep showed, with the numbers.

## Where things are

| Number                                   | File                             |
| ---------------------------------------- | -------------------------------- |
| Prices, wages, upkeep, the Kopdes ladder | `src/sim/balance/prices.ts`      |
| Growth, yield curve, forest stages       | `src/sim/balance/growth.ts`      |
| Fire spread, burn cost, haze             | `src/sim/balance/fire.ts`        |
| Attention, letters, the coordination fee | `src/sim/balance/society.ts`     |
| The headline deck and its levers         | `src/sim/balance/macroEvents.ts` |
| Endings, ISPO, the credit line           | `src/sim/balance/endings.ts`     |
| Biomes, chop days, open land             | `src/sim/balance/biomes.ts`      |
