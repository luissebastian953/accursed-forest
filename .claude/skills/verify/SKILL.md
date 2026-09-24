---
name: verify
description: Prove a change before it is committed, in the order that finds the cheap failures first
---

# Verifying a change

Every change earns its commit the same way: a chore, a fix, a docs pass, a
comment. The order matters because each step is cheaper than the next and
catches what the next one would only stumble over minutes later.

1. **Typecheck first, both projects.** `src/` and `tests/` are one program and
   `e2e/` is another, and CI runs both:

   ```
   pnpm typecheck                       # tsc --noEmit && svelte-check
   npx tsc -p tsconfig.node.json --noEmit
   ```

   Run the second one every time, not only when `e2e/` changed: a type widened
   in `src/` is read by the suite. A green `pnpm typecheck` on its own has
   shipped a red CI here.

2. **Lint and format.** `npx eslint src tests e2e` and `npx prettier --check .`.
   The pre-commit hook fixes what it can, but a boundary or an unused import
   is a rejected commit, and a rejected commit leaves the index staged.
3. **The unit suite.** `npx vitest run`. It is headless and takes twenty
   seconds. A comment over two lines fails here too (`tests/tools/comments`).
4. **The smoke suite.** `npx playwright test --grep @smoke --workers=1`, and
   only once nothing else is rendering (step 6).
5. **The whole browser suite** with anything that touches the interface, the
   renderer or the loop: `npx playwright test --workers=1`, about five minutes.
6. **One browser at a time.** Before any Playwright run:

   ```
   pgrep -f 'chrome-headless-shell|playwright test'
   ```

   must print nothing. The suite renders in software and one run takes six to
   eight cores; two at once starve the runner's own timers, a 2.5 second wait
   blows a 120 second budget, and every test looks broken. A run that timed
   out in a tool is still running in the background: kill it before the next.
   The loop smoke test is load-sensitive on top of that (it needs about nine
   game-days a second), so a lone failure there at load above 8 is re-run
   alone before it is believed.

7. **A balance number** also gets the sweep, before and after; see
   `balance-change`.

Then commit, locally, one milestone per commit. Never push unless asked.
