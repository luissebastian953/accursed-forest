# Sawit Simulator

A browser management sim about turning wild land into a working oil-palm estate:
clear terrain, plant _bibit_, wait out the immature years, harvest _TBS_ on a
rotation, sell through your _Kopdes_, and live with what your clearing choices
invite — pests, landslides, haze, and the letters from the district office.

Vite + TypeScript + Three.js (WebGPU with a WebGL 2 fallback). No backend; saves
live in `localStorage`.

The full design document is the source of truth for everything below.
Section references in the code (`§6.5`, `§4.1`, …) point into it.

## Status

**M1a — Skeleton: done.** You can pan a generated 64×64 world, select a
block, chop and plant it, speed through the immature phase at 20×, save,
reload and continue. M1b (harvest, Kopdes shop, TBS price) is next.

| Area                                                          | State                           |
| ------------------------------------------------------------- | ------------------------------- |
| Repo, tooling, CI, ADRs, layer-boundary lint                  | done                            |
| Seeded RNG, easing + spring, base64 codec                     | done                            |
| World generation: elevation, moisture, biomes, rivers, start  | done                            |
| Sparse block map, active set, pure `tick()` and `dispatch()`  | done                            |
| Systems: weather, terrain, growth (G), economy (upkeep)       | done                            |
| Commands: Buy, Chop, Plant (palm / forest), Place Kopdes      | done                            |
| Chunked, validated, migratable `localStorage` saves; autosave | done                            |
| Column terrain via mesher worker + chunk streaming            | done                            |
| Instanced palms, selection ring, Kopdes building              | done                            |
| Orthographic map camera, picking, keyboard, HUD, block panel  | done                            |
| Menu: new estate by code, save, load                          | done                            |
| Harvest, TBS sales, Kopdes shop and range                     | **M1b**                         |
| Burn, fire pressure, reforestation, land expansion rules      | **M1c**                         |
| Pests, weather events, news, authority, endings               | **M1d–M1g**                     |
| Far-LOD heatmap tiles, GPU per-instance animation             | deferred until palm counts bite |

Tests: 145 unit (Vitest) and 7 browser (Playwright, WebGL fallback) — the
browser suite plays the M1a loop end to end.

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

URL flags: `?webgl` forces the WebGL 2 fallback CI uses; `?seed=42` picks a
world; `?fresh` ignores the save in this browser; `?spike` opens the §6.9 art
spike instead of the game.

Controls: drag to pan, wheel to zoom, **Q/E** rotate a quarter turn, click a
block, double-click to focus it, **space** pauses, **1/2/3** set speed,
**F** jumps to the Kopdes, **Esc** closes panels.

## Scripts

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Vite dev server, with type and lint errors in the overlay |
| `pnpm build`     | typecheck, then production build                          |
| `pnpm typecheck` | `tsc --noEmit` over `src/` and `tests/`                   |
| `pnpm test`      | Vitest unit tests                                         |
| `pnpm e2e`       | Playwright smoke test (builds and previews first)         |
| `pnpm lint`      | ESLint + Prettier check                                   |
| `pnpm format`    | Prettier write                                            |
| `pnpm knip`      | unused files, exports and dependencies                    |
| `pnpm commit`    | Commitizen — Conventional Commits with layer scopes       |

## Architecture

Dependencies point **down only**:

```
app/          composition root, game loop, time control
ui/  render/  input/  persistence/  workers/
sim/          pure TS: state, commands, systems, events, RNG
shared/       math, event bus, typed-array helpers
```

`sim/` imports nothing from above it — no Three.js, no DOM, no timers, no
`Date.now()`, no `Math.random()`. This is enforced by `eslint-plugin-boundaries`
and a set of restricted-global rules, so a violation fails the build. See
`docs/adr/0001-pure-sim-core.md`.

Everything random goes through one seeded PRNG whose state is part of the save,
so a seed plus a command log replays a run exactly.

## Layout

```
src/
├── app/          composition root, game loop, time control, the art spike
├── sim/          the simulation (pure)
│   ├── rng.ts    xoshiro128** — the only source of randomness
│   ├── worldgen/ f(seed, x, y)
│   ├── commands/ one file per command
│   ├── systems/  weather → worldEvents → terrain → growth → pest → …
│   └── balance/  every tunable, as data
├── render/       Three.js: geometry, materials, animation, camera
├── ui/           DOM overlay panels
├── persistence/  localStorage adapter, save schema, migrations
├── workers/      chunk mesher
└── shared/       math, event bus, base64
```

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- No magic numbers in systems — tunables live in `sim/balance/*`.
- Conventional Commits, scoped by layer (`feat(sim):`, `fix(render):`).
- One ADR in `docs/adr/` per decision that would be expensive to reverse.
