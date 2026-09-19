import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type SetAutoHarvest = Extract<Command, { type: 'SetAutoHarvest' }>;

export const setAutoHarvest: CommandHandler<SetAutoHarvest> = {
  validate(ctx, command) {
    const { state } = ctx;

    if (!state.kopdes)
      return reject('noKopdes', 'Build a Kopdes first; its crew does the picking.');

    if (state.kopdes.autoHarvest === command.on) {
      return reject('wrongPhase', command.on ? 'Already on.' : 'Already off.');
    }

    return null;
  },

  apply(ctx, command) {
    ctx.state.kopdes!.autoHarvest = command.on;
    ctx.events.push({ type: 'AutoHarvestSet', on: command.on });
  },
};
