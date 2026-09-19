import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type KeepPlaying = Extract<Command, { type: 'KeepPlaying' }>;

export const keepPlaying: CommandHandler<KeepPlaying> = {
  validate(ctx) {
    const { run } = ctx.state;
    if (run.sandbox) return reject('wrongPhase', 'Already playing on in sandbox.');
    const wins: readonly (typeof run.ending)[] = [
      'clean',
      'dirty',
      'reboisasi',
      'redemption',
      'fade',
    ];
    if (!wins.includes(run.ending)) {
      return reject('gameOver', 'The run is over.');
    }
    return null;
  },

  apply(ctx) {
    ctx.state.run.sandbox = true;
    ctx.events.push({ type: 'SandboxStarted' });
  },
};
