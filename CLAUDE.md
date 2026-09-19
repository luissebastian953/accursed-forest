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
- [`docs/gdd/`](docs/gdd/README.md): the design. Code cites it as `§3.6`,
  `§8`. A number in `src/sim/balance/` serves a rule there.

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
- **The world clock stops on pause.** Scene animation reads `worldMs` /
  `worldDt` in `App.ts`, not `performance.now()`. The camera and the interface
  keep wall time.
- **Palette colours are authored in linear space** and the alpha channel is
  an emission mask, not opacity.

## Writing

- No em dashes and no middle dots, anywhere: copy, code, commits, docs.
  Commas, colons and periods.
- Comments explain a surprise, not a function's existence. Reasons that would
  stop someone undoing a decision belong in an ADR, with the comment pointing
  at it.
- The game's officials are invented: Prerows, BehLOL, Purboy, Amrun, Rajuli,
  Nazarra, Mulyonows, Tanjidoor. A test fails on any real name.

## Verifying

Before a commit, all of:

```
npx eslint src tests e2e
npx tsc --noEmit
npx svelte-check --threshold error
npx vitest run
npx playwright test --workers=1
```

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

Repeatable procedures live in `.claude/skills/`: a balance change, a new
command, a new headline. Use them rather than reconstructing the steps.
