import { FERTILIZER_DAYS } from '../balance/growth.ts';
import { readBlock, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type FertilizeBlock = Extract<Command, { type: 'FertilizeBlock' }>;

export const fertilizeBlock: CommandHandler<FertilizeBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.', {
        key: 'rejections.block.outsideMap',
      });
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) {
      return reject('notOwned', 'You do not own this block.', {
        key: 'rejections.block.notOwned',
      });
    }

    if (block.burning) {
      return reject('burning', 'This block is on fire.', { key: 'rejections.block.onFire' });
    }

    if (block.phase !== 'planted' && block.phase !== 'reforesting') {
      return reject('wrongPhase', 'Only planted blocks take fertilizer.', {
        key: 'rejections.fertilize.notPlanted',
      });
    }

    if (block.fertilizedUntil > state.tick) {
      const n = block.fertilizedUntil - state.tick;

      return reject('occupied', `Already fertilized for ${n} more days.`, {
        key: 'rejections.fertilize.active',
        vars: { n },
      });
    }

    if (state.inventory.fertilizer < 1) {
      return reject('noInventory', 'No fertilizer in stock; buy some at the Workshop.', {
        key: 'rejections.fertilize.noStock',
      });
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);

    state.inventory.fertilizer -= 1;
    block.fertilizedUntil = state.tick + FERTILIZER_DAYS;
    events.push({ type: 'BlockFertilized', block: command.block });
  },
};
