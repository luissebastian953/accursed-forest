# Sawit Simulator

A browser management sim about turning wild land into a working oil-palm estate:
clear terrain, plant _bibit_, wait out the immature years, harvest _TBS_ on a
rotation, sell through your _Kopdes_, and live with what your clearing choices
invite: pests, landslides, haze, and the letters from the district office.

Vite + TypeScript + Three.js (WebGPU with a WebGL 2 fallback) for the world,
Svelte 5 + Tailwind for the panels around it, in English and Indonesian. No
backend; saves live in `localStorage`.

The full design document is the source of truth for everything below.
Section references in the code (`§6.5`, `§4.1`, …) point into it.

## Status

**M1a–M1g done: skeleton, loop, terrain & expansion, pests, weather & events,
news & authority, endings.** A run now has an end. Meet the five ISPO
conditions: profit, bearing hectares, no burns, forest on the slopes, a
full Kopdes, and the Ministry sends a banner. With low integrity the burn
and forest conditions can be waived, and the epilogue tells that dirty win
plainly. Fall below the bank's credit line (Rp 20M per planted hectare in
Kopdes range) for 90 days and the loans are called; burn while an honest
enforcement team is in office and the estate can be shut for two years.
Put more land back to young forest than you hold in palms, by two clear
hectares and six at least, and the run ends in _reboisasi_, the ending nobody
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
| Panels on Svelte 5; the interface in English and Indonesian (`src/i18n`)       | done                     |
| Far-LOD heatmap tiles, GPU per-instance animation, forest box-trees            | deferred until they bite |

Tests: 336 unit (Vitest) and 16 browser (Playwright, WebGL fallback). The
browser suite plays the loop end to end, lights a wildfire on purpose, and
lets beetles loose on an unsanitized block.

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:5173, the landing page; the game is /play.html
```

Two pages: `index.html` is a static landing page (real HTML for search
engines, no engine loaded), and `play.html` is the game. The game page paints
a boot shell first and loads the engine behind it; three.js ships as its own
long-lived chunk (~250 KB gzipped) apart from the sim and the UI. Baloo 2 is
self-hosted from `public/fonts` (one variable woff2, preloaded). Core Web
Vitals (LCP, INP, CLS, FCP, TTFB) are measured with `web-vitals` and sent to
Google Analytics 4 as events when `VITE_GA_ID` is set at build time (see
`.env.example`); with it empty the pages load no third-party script at all.

Production builds obfuscate the game's own chunks on top of minification
(string literals into an encoded array, hex identifiers; the expensive
transforms stay off so the sim keeps its frame budget) and ship no source
maps; three.js is left as is. `VITE_OBFUSCATE=0` gives a readable build and
`VITE_SOURCEMAP=1` emits maps, for debugging a deployment. This raises the
cost of reading the code; it cannot hide it from the browser that runs it.

For search and social: the landing page carries a description, canonical
link, Open Graph and Twitter cards (the 1200×630 image in `public/`), the
favicon set and web manifest from the brand kit (`public/brand`, `icon-*.png`),
and JSON-LD (`VideoGame` + `Organization` + `WebSite` + `WebPage`). Set
`VITE_SITE_URL` at build time to make those URLs absolute and to emit
`sitemap.xml` and a `robots.txt` that points at it (the game page itself is
`noindex`); with it empty the tags fall back to relative URLs.

The landing page exists in English (`/`) and Indonesian (`/id/`), cross-linked
with `hreflang` (also in the sitemap), each with scenario sections (forest
fire / kebakaran hutan, deforestation / penebangan hutan, reboisasi, petani
sawit, minyak sawit, pests), a bilingual glossary and an FAQ with `FAQPage`
schema: the terms people search for, used where they mean something, rather
than a keyword list. The pages share one design (a nav card, the title over a
screenshot of a working estate, step and scenario cards) and are hand-mirrored;
the hero is self-hosted WebP in three widths and preloaded, the icons an inline
sprite, so nothing on them waits on a third party.

The game plays in English or Bahasa Indonesia (`src/i18n`). A first visit
picks Indonesian for an Indonesian time zone or browser language; the title
screen and the menu switch it; the choice is remembered (`sawit:locale`), and
the landing pages show a dismissible pointer to their twin instead of
redirecting. Catalogs are flat JSON per panel in `src/i18n/locales/<locale>/`;
`t('panel.key', vars)` falls back to English, then to the key. The sim's own
prose (headlines, chronicle entries, a command's rejection reason) is still
English: it is part of the sim's event data, not the UI's.

The interface follows the cartoon UI kit: cream cards with a hard bottom
edge, inset pills, Baloo 2 (self-hosted), and the 35 flat icons in
`public/icons`. The tokens and the handful of component classes live in
`src/ui/styles.css`. Panels are Svelte 5 components in `src/ui/svelte/`: each
`<Name>.svelte` has a `<name>State.svelte.ts` module beside it exporting a
class with the constructor and `show`/`hide`/`update` surface `App.ts` always
drove, so the composition root never learned Svelte, and the world stays a
plain three.js canvas. Panels that read the sim derive a plain snapshot from it
on every `refresh()`; the sim itself is never made reactive.

Mobs walk the estate: wild boar, pigs, mice, cows, a capybara by the river,
monkeys and orangutans in the forest. They live on a small repertoire:
stand about, mill around a spot, cross the estate or circle a patch, and
sleep on their side with Zs drifting up, at a stroll, and pick the next
thing when the last runs out. A thief comes for ripe fruit now and then:
creeps to the trees by the block, waits a day or three crouched in the
canopy, dashes in low, and dashes back with the sack. A security guard from
the Kopdes gets a post hut on the corner of the block, patrols the estate at
a walk between rests there, keeps most thieves away and catches the rest.
Rarer still, a pig ambles up to the Kopdes, stands on two legs, the cash box
is lighter, and the babi ngepet runs the estate upright for three days, then
is simply gone. Workers hired at the Kopdes (sanitation, plant doctor,
security) cost a wage a day and find their own jobs; a crew of four works
every block being chopped or burned, each swinging at a tree for a few days
before moving to the next, and a forest block gives up a tree at each quarter of the chop. Every mob lives in the sim as
data, drawn from its own random stream, so a save replays the same visitors.
The renderer poses every body part on the CPU and skins the whole crowd into
one merged mesh per material: two draw calls, no new shaders
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

| Command          | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Vite dev server, with type and lint errors in the overlay    |
| `pnpm build`     | typecheck, then production build                             |
| `pnpm typecheck` | `tsc --noEmit` over `src/` and `tests/`, then `svelte-check` |
| `pnpm test`      | Vitest unit tests                                            |
| `pnpm e2e`       | Playwright smoke test (builds and previews first)            |
| `pnpm lint`      | ESLint + Prettier check                                      |
| `pnpm format`    | Prettier write                                               |
| `pnpm knip`      | unused files, exports and dependencies                       |
| `pnpm commit`    | Commitizen, Conventional Commits with layer scopes           |

## Architecture

Dependencies point **down only**:

```
app/          composition root, game loop, time control
ui/  render/  input/  persistence/  workers/
sim/          pure TS: state, commands, systems, events, RNG
shared/       math, event bus, typed-array helpers
```

`sim/` imports nothing from above it: no Three.js, no DOM, no timers, no
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
│   ├── rng.ts    xoshiro128**, the only source of randomness
│   ├── worldgen/ f(seed, x, y)
│   ├── commands/ one file per command
│   ├── systems/  weather → worldEvents → terrain → growth → pest → …
│   └── balance/  every tunable, as data
├── render/       Three.js: geometry, materials, animation, camera
├── ui/           the panels: Svelte components in ui/svelte, helpers beside them
├── i18n/         EN and ID catalogs, locale detection, t()
├── persistence/  localStorage adapter, save schema, migrations
├── workers/      chunk mesher
└── shared/       math, event bus, base64
```

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- No magic numbers in systems: tunables live in `sim/balance/*`.
- Conventional Commits, scoped by layer (`feat(sim):`, `fix(render):`).
- One ADR in `docs/adr/` per decision that would be expensive to reverse.
- Copy and comments use plain punctuation: commas, colons, periods. No em
  dashes, no middle-dot separators.
- A `.svelte.ts` state module never shares its base name with the `.svelte`
  component next to it (`menuState.svelte.ts` beside `Menu.svelte`): with
  bundler module resolution, TypeScript would otherwise resolve `./Menu.svelte`
  to the module.
