import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type SetAutoHarvest = Extract<Command, { type: 'SetAutoHarvest' }>;

export const setAutoHarvest: CommandHandler<SetAutoHarvest> = {
  validate(ctx, command) {
    const { state } = ctx;

    if (!state.kopdes) {
      return reject('noKopdes', 'Build a Workshop first; its crew does the picking.', {
        key: 'rejections.autoHarvest.noKopdes',
      });
    }

    if (state.kopdes.autoHarvest === command.on) {
      if (command.on) {
        return reject('wrongPhase', 'Already on.', { key: 'rejections.autoHarvest.alreadyOn' });
      }

      return reject('wrongPhase', 'Already off.', { key: 'rejections.autoHarvest.alreadyOff' });
    }

    return null;
  },

  apply(ctx, command) {
    ctx.state.kopdes!.autoHarvest = command.on;
    ctx.events.push({ type: 'AutoHarvestSet', on: command.on });
  },
};
