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

**M1a–M1g done: skeleton, loop, terrain & expansion, pests, weather & events,
news & authority, endings.** A run now has an end. Meet the five ISPO
conditions — profit, bearing hectares, no burns, forest on the slopes, a
full Kopdes — and the Ministry sends a banner; with low integrity the burn
and forest conditions can be waived, and the epilogue tells that dirty win
plainly. Fall below the bank's credit line (Rp 20M per planted hectare in
Kopdes range) for 90 days and the loans are called; burn while an honest
enforcement team is in office and the estate can be shut for two years.
Put more land back to young forest than you hold in palms — by two clear
hectares, six at least — and the run ends in _reboisasi_, the ending nobody
planned for. Twenty-five years without a certificate is the fade. Every ending replays
the run as a chain of headlines, and losses offer "Return to Year N" from
start-of-year snapshots. M1h (polish: toasts, block panel rejections, the stats
panel, the balance sweep, README) is next.

| Area                                                                           | State                    |
| ------------------------------------------------------------------------------ | ------------------------ |
| Repo, tooling, CI, ADRs, layer-boundary lint                                   | done                     |
| Seeded RNG, easing + spring, base64 codec                                      | done                     |
| World generation: elevation, moisture, biomes, rivers, start                   | done                     |
| Sparse block map, active set, pure `tick()` and `dispatch()`                   | done                     |
| Systems: weather, world events (fire), terrain, growth, pest, harvest, economy | done                     |
| Land: buy, chop (with timber), burn at three intensities, sanitize             | done                     |
| Fire: spread, rain, pressure meter, wildfire threshold, haze, 1× lock          | done                     |
| Pests: Ganoderma on the lattice, beetles in debris, plague, treatments         | done                     |
| Per-palm: remove, trench, replant gaps; sick palms and stumps rendered         | done                     |
| Per-block upgrades: irrigation, drainage; reforestation planting               | done                     |
| Kopdes: placement, shop, upgrades, range, same-day sales; price walk           | done                     |
| Scripted autoplayer (with a careful-player mode) and `pnpm sweep`              | done                     |
| Chunked, validated, migratable `localStorage` saves; autosave                  | done (schema v5)         |
| Column terrain via mesher worker + chunk streaming; ash and char tops          | done                     |
| Instanced palms, Kopdes, flames, selection / range / hazard rings              | done                     |
| Map camera, picking, keyboard, HUD (price, fire, plague), panels, shop         | done                     |
| Weather deck: haze, ash, flood, drought; forest cover and landslides           | done                     |
| News feed (3 lanes), integrity, macro economy, authority ladder                | done                     |
| Endings: ISPO clean/dirty, reboisasi, bankruptcy, ban, fade, rewind, sandbox   | done                     |
| Mobs: wildlife, thief, babi ngepet, ghost, hired workers, chop/burn crews      | done                     |
| Endgame: on a win the President's motorcade pulls up to the Kopdes door        | done                     |
| Far-LOD heatmap tiles, GPU per-instance animation, forest box-trees            | deferred until they bite |

Tests: 323 unit (Vitest) and 12 browser (Playwright, WebGL fallback) — the
browser suite plays the loop end to end, lights a wildfire on purpose, and
lets beetles loose on an unsanitized block.

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

The interface follows the cartoon UI kit: cream cards with a hard bottom
edge, inset pills, Baloo 2 (Google Fonts, with a rounded system fallback if
it cannot be fetched), and the 35 flat icons in `public/icons`. The tokens
and the handful of component classes live in `src/ui/styles.css`.

Mobs walk the estate: wild boar, pigs, mice, cows, a capybara by the river,
monkeys and orangutans in the forest. They live on a small repertoire —
stand about, mill around a spot, cross the estate or circle a patch, and
sleep on their side with Zs drifting up — at a stroll, and pick the next
thing when the last runs out. A thief comes for ripe fruit now and then:
creeps to the trees by the block, waits a day or three crouched in the
canopy, dashes in low, and dashes back with the sack. A security guard from
the Kopdes gets a post hut on the corner of the block, patrols the estate at
a walk between rests there, keeps most thieves away and catches the rest.
Rarer still, a pig ambles up to the Kopdes, stands on two legs, the cash box
is lighter — and the babi ngepet runs the estate upright for three days, then
is simply gone. Workers hired at the Kopdes (sanitation, plant doctor,
security) cost a wage a day and find their own jobs; a crew of four works
every block being chopped or burned, each swinging at a tree for a few days
before moving to the next, and a forest block gives up a tree at each quarter of the chop. Every mob lives in the sim as
data, drawn from its own random stream, so a save replays the same visitors.
The renderer poses every body part on the CPU and skins the whole crowd into
one merged mesh per material — two draw calls, no new shaders
(`src/render/mobs/`); the `?mobs` page measures why.

URL flags: `?webgl` forces the WebGL 2 fallback CI uses; `?seed=42` picks a
world; `?fresh` ignores the save in this browser; `?spike` opens the §6.9 art
spike instead of the game; `?models` lays out every scenery model (`src/render/models/`); `?mobs` is the mob proof of concept (`src/render/mobs/`), a rigged crowd with a cost readout; `?debug` exposes the running sim as
`window.__sawit` for the browser suite and for poking at events by hand;
`?turbo` runs the clock twenty times faster (a day is ten seconds at 1×, one
at 10×, a fifth at 50×) so the browser suite can skip years.

Controls: drag to pan, wheel to zoom, **Q/E** rotate a quarter turn, click a
block, double-click to focus it, **space** pauses, **1/2/3** set speed,
**F** jumps to the Kopdes, **K** opens its shop, **N** opens the news, **Esc** closes panels.

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
