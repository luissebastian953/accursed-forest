---
name: new-command
description: Add a player action to the sim, from the command file to the button that runs it
---

# Adding a command

A command is the only way the player changes the world. Every one has the
same shape, and the pieces below are all required or something downstream
breaks quietly.

1. **The type.** Add a member to the `Command` union in `src/sim/types.ts`.
   Include `block: BlockId` if it acts on a block; the app marks that block's
   chunk dirty automatically after a successful dispatch.
2. **The handler.** `src/sim/commands/<name>.ts`, exporting a
   `CommandHandler` with `validate(ctx, command)` returning
   `reject(code, reason) | null`, and `apply(ctx, command)`. The reason is
   shown on the greyed-out button, so write it for the player, in a sentence.
   Push events; never touch the screen.
3. **Register it** in `src/sim/commands/index.ts`.
4. **The save.** Add it to `CommandSchema` in `src/persistence/schema.ts`,
   because the command log is persisted and an unknown command fails the
   decode. No schema bump is needed for a new command alone.
5. **The button.** In `src/ui/svelte/block/blockPanelState.svelte.ts`, push an
   `action(label, command, 'action-<Name>', { cost, icon })`; the rejection is
   looked up for you. Strings go in both `src/i18n/locales/*/block.json`.
6. **Feedback.** If it moves money the app plays cash-in or cash-out on its
   own. Anything else the player should hear or see is wired in `App.ts`,
   from the event the command pushed, via `src/render/sync.ts`.
7. **Tests.** A unit test in `tests/sim/` that dispatches it and asserts the
   state, including one rejection with its reason. A browser test in
   `e2e/app.spec.ts` if it has a button, clicking `action-<Name>`.
8. **The reference.** An entry for the new file in
   `docs/reference/sim-commands.md`, in path order: what the command is for,
   and under `### Notes` anything a two-line comment in the file cannot hold.

`src/sim/commands/reforestBlock.ts` is a complete recent example: it reuses
another handler's `validate`, buys what is short, and plants.
