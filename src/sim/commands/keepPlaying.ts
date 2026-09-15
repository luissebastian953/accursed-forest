/**
 * KeepPlaying (§3.8): after the certificate or the fade, carry on in sandbox —
 * the same estate, no further end checks. Losses have no sandbox; they have
 * the rewind.
 */

import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type KeepPlaying = Extract<Command, { type: 'KeepPlaying' }>;

export const keepPlaying: CommandHandler<KeepPlaying> = {
  validate(ctx) {
    const { run } = ctx.state;
    if (run.sandbox) return reject('wrongPhase', 'Already playing on in sandbox.');
    if (run.ending !== 'clean' && run.ending !== 'dirty' && run.ending !== 'fade') {
      return reject('gameOver', 'The run is over.');
    }
    return null;
  },

  apply(ctx) {
    ctx.state.run.sandbox = true;
    ctx.events.push({ type: 'SandboxStarted' });
  },
};
