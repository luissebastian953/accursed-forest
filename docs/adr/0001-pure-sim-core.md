# 1. The simulation is a pure, seeded, tick-based core

Status: accepted

## Context

The game is a 25-year management sim with weather, pests, fire, economics and an
authority system, all interacting. Bugs in that mesh are hard to reproduce if the
simulation can observe the renderer, the DOM or the wall clock.

## Decision

`src/sim/` is pure TypeScript: no Three.js, no DOM, no timers, no `Date.now()`,
no `Math.random()`. It owns a single seeded PRNG whose state lives in `SimState`.
`dispatch(command)` validates and applies; `tick()` runs the systems in a fixed
order and returns the events that happened. Layers above read state and consume
events; they never mutate.

The rule is enforced mechanically by `eslint-plugin-boundaries` plus
`no-restricted-imports` / `no-restricted-globals` / `no-restricted-syntax` in
`eslint.config.js`, not by convention. A probe of every banned construct is part
of how the config was verified.

## Consequences

- A seed plus a command log reproduces a run exactly, which makes the year
  snapshots and the "Return to Year N" rewind (GDD 3.8) fall out for free.
- Balance can be swept headlessly (`tools/balance-sweep.ts`) with no browser.
- The renderer may lag or drop frames without affecting the simulation.
- Cost: anything needing the clock or the DOM has to be lifted into `app/`.
