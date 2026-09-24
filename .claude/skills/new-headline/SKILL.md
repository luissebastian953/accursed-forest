---
name: new-headline
description: Add an event to the news deck, with its levers, its copy, its chip label and its tests
---

# Adding a headline

The deck in `src/sim/balance/macroEvents.ts` is data. An event can only do
what its entry declares, because every lever is read in exactly one place
through `src/sim/macro.ts`. That is the contract; keep it.

1. **The entry.** Add it to `MACRO_EVENTS`. Pick the levers it needs:
   `tbsFactor`, `inputFactor`, `landFactor`, `wageFactor`, `yieldFactor`,
   `landslideFactor`, `attentionDecayFactor`, `settleFactor`, `mobsQuiet`,
   `kopdesCashPerDay`, `calm`, `forestSoftens` while it runs; `attention`,
   `attentionScale`, `integrity`, `ashDays` when it lands; `inputRise` for a
   permanent step. Anything temporary needs `days`. Gate it with `once`,
   `after`, or `fromYear` (permanent ones must not land before year 3).
   `triggered: true` keeps it out of the draw so play can start it.
2. **The copy.** A `macro.<id>` template in
   `src/sim/balance/news/statements.ts`: lane, severity, cooldown, two titles,
   a body, and the `effects` line the player actually reads. Name only the
   invented cast; a test fails on any real person's name.
3. **The chip.** Every timed event shows on the bar, so add `events.<id>` to
   both `src/i18n/locales/en/events.json` and `id/events.json`. A test fails
   if either is missing.
4. **A new lever** means one reader in `macro.ts` and one call site in the
   sim, and a line in the table in `docs/simulation.md`.
5. **Tests.** `tests/sim/macro.test.ts` already checks coherence, templates
   and chip labels for every entry. Add an assertion for a new lever, and a
   `drawable` check for a new gate.
6. **See it deal.** Run a sim for eight years and count `MacroEventStarted`
   events; a new entry with a sensible weight should appear in some seeds and
   not swamp the rest.

The register matters. Ministers are fair game; the ecological consequences
(`hazeSeason`, `animalsGone`, `onTheBrink`, `burnedCarcasses`) are written
flat, and the contrast is the point.

## Before you commit

The gate runs on every change, this one included, in the order the `verify`
skill gives and for the reasons it gives: the typecheck first, both projects,
then lint, the unit suite, and the smoke suite.

```
pnpm typecheck && npx tsc -p tsconfig.node.json --noEmit
npx eslint src tests e2e
npx vitest run
npx playwright test --grep @smoke --workers=1
```
