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

**M1a Skeleton, M1b Loop and M1c Terrain & expansion: done.** Place the
Kopdes, stock its shop, buy or chop or burn land, plant palms or forest,
harvest ripe rounds and sell them, sanitize debris, irrigate and drain. Burn
carefully and the ash feeds your block for a season; burn twice in a row and
the fire stops being yours. M1d (pests: Ganoderma, rhinoceros beetle,
treatments) is next.

| Area                                                                     | State                    |
| ------------------------------------------------------------------------ | ------------------------ |
| Repo, tooling, CI, ADRs, layer-boundary lint                             | done                     |
| Seeded RNG, easing + spring, base64 codec                                | done                     |
| World generation: elevation, moisture, biomes, rivers, start             | done                     |
| Sparse block map, active set, pure `tick()` and `dispatch()`             | done                     |
| Systems: weather, world events (fire), terrain, growth, harvest, economy | done                     |
| Land: buy, chop (with timber), burn at three intensities, sanitize       | done                     |
| Fire: spread, rain, pressure meter, wildfire threshold, haze, 1× lock    | done                     |
| Per-block upgrades: irrigation, drainage; reforestation planting         | done                     |
| Kopdes: placement, shop, upgrades, range, same-day sales; price walk     | done                     |
| Scripted autoplayer and `pnpm sweep` balance tool                        | done                     |
| Chunked, validated, migratable `localStorage` saves; autosave            | done (schema v2)         |
| Column terrain via mesher worker + chunk streaming; ash and char tops    | done                     |
| Instanced palms, Kopdes, flames, selection / range / hazard rings        | done                     |
| Map camera, picking, keyboard, HUD (price, fire gauge), panels, shop     | done                     |
| Pests, weather event deck, landslides, news, authority, endings          | **M1d–M1g**              |
| Far-LOD heatmap tiles, GPU per-instance animation, forest box-trees      | deferred until they bite |

Tests: 181 unit (Vitest) and 8 browser (Playwright, WebGL fallback) — the
browser suite plays the loop end to end and lights a wildfire on purpose.

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
**F** jumps to the Kopdes, **K** opens its shop, **Esc** closes panels.

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
