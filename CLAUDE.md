# Working on Sawit Simulator

A browser management sim about an oil-palm estate. Vite, TypeScript, three.js
(WebGPU with a WebGL 2 fallback), Svelte 5, Tailwind. No backend; saves live
in `localStorage`. English and Indonesian.

## Read first

- [`docs/README.md`](docs/README.md): where every kind of writing lives.
- [`docs/architecture.md`](docs/architecture.md): the layers and what may
  import what. The boundary lint enforces it; do not fight the lint.
- [`docs/simulation.md`](docs/simulation.md): what a tick does, in order.
- [`docs/reference/`](docs/reference/README.md): what every module is for.
  **Files carry no header comment.** The description of a module lives in the
  reference, one entry per file. When you add a module, add its entry there;
  do not put a description block at the top of the file.
- [`docs/gdd/`](docs/gdd/README.md): the design. Code cites it as `GDD 3.6`,
  `GDD 8`. A number in `src/sim/balance/` serves a rule there.

## The rules that are not obvious from the code

- **The sim never touches the screen.** `src/sim/` imports nothing from
  three.js, Svelte or the DOM. It runs headlessly in tests and in the sweep.
- **A command is the only way the player changes anything.** One file per
  command in `src/sim/commands/`, with `validate` (a rejection with a reason,
  shown on the greyed button) and `apply`. Register it in `commands/index.ts`,
  add it to the zod `CommandSchema` in `src/persistence/schema.ts`.
- **Events are the only way out of the sim.** `tick()` returns them;
  `src/render/sync.ts` digests them into what changed on screen.
- **Every save change is a schema bump and a migration.** `CURRENT_SCHEMA` in
  `src/persistence/schema.ts`, a migration in `migrations.ts`, and the key
  order in the encoder must match the state or the round-trip test fails.
- **The headline deck's levers are read in one place each**, through
  `src/sim/macro.ts`. An event can only do what `macroEvents.ts` declares.
- **Every timed headline needs a chip label** in both
  `src/i18n/locales/*/events.json`; a test fails otherwise.
- **A panel is a folder.** `src/ui/svelte/<panel>/` holds the
  `<name>State.svelte.ts` module and the `<Name>.svelte` files it mounts.
  `App.ts` imports the state module, never a component. `svelte/base/` is for
  pieces with no game vocabulary, and is the only folder others import from.
- **The world clock stops on pause.** Scene animation reads `worldMs` /
  `worldDt` in `App.ts`, not `performance.now()`. The camera and the interface
  keep wall time.
- **Palette colours are authored in linear space** and the alpha channel is
  an emission mask, not opacity.

## Writing

- No em dashes and no middle dots, anywhere: copy, code, commits, docs.
  Commas, colons and periods.
- A blank line on both sides of anything that ends in a block (`if`/`else`
  chains, loops, `switch`, functions, block-bodied arrows) and around a run
  of declarations; consecutive declarations stay together and `else` stays
  on its closing brace. `@stylistic/padding-line-between-statements` enforces
  it and `eslint --fix` applies it, so write freely and let the fixer space it.
- Comments explain a surprise, not a function's existence, in **two lines at
  most**. Write the detail first, then cut the comment: the full reasoning
  goes in the file's entry in `docs/reference/`, under `### Notes`, one bullet
  per annotated thing; a rule that binds other files goes in this file; a
  repeatable procedure goes in a skill. Reasons that would stop someone
  undoing a decision belong in an ADR, with the comment pointing at it.
  `tests/tools/comments.test.ts` fails on any longer comment, in any file.
- The game's officials are invented: Prerows, BehLOL, Purboy, Amrun, Rajuli,
  Nazarra, Mulyonows, Tanjidoor. A test fails on any real name.

## Verifying

**Every change runs the unit suite and the smoke suite before it is
committed.** Not only features: a chore, a fix, a CI tweak, a documentation
pass, a comment. A docs commit has broken the build here before, and the two
suites together take about three minutes.

```
npx vitest run                      # the unit suite, every change
npx playwright test --grep @smoke   # the smoke suite, every change
```

Before a commit, all of, **in this order**: the typecheck comes first
because it is the cheapest and CI runs both projects, and `e2e/` reads types
from `src/`. The full procedure, with the reasons, is the `verify` skill.

```
pnpm typecheck && npx tsc -p tsconfig.node.json --noEmit
npx eslint src tests e2e
npx vitest run
npx playwright test --grep @smoke --workers=1
```

The whole browser suite (`npx playwright test --workers=1`, about five
minutes) goes with anything that touches the interface, the renderer or the
loop, and runs nightly in CI regardless.

The e2e suite runs against the production preview on `:4173`, so `/src/*`
imports fail there; reach the running game through `window.__sawit`
(`?debug`) or the bench through `window.__bench`. Judge a balance change with
`pnpm sweep` before and after. Judge a model by eye on `/workbench.html`.

## Committing

Commit locally per milestone; never push. Conventional commits, lowercase
subject, scope from: sim, render, ui, app, input, persistence, workers,
shared, balance, tools, docs, ci, deps. `balance` is a scope, not a type.
The hooks run lint-staged and commitlint; a rejected commit prints why.

## Skills

Repeatable procedures live in `.claude/skills/`: verifying a change, a
balance change, a new command, a new headline. Use them rather than
reconstructing the steps.
