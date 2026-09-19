import { COVER_CROP } from '../balance/events.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type CoverCropBlock = Extract<Command, { type: 'CoverCropBlock' }>;

export const coverCropBlock: CommandHandler<CoverCropBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block)))
      return reject('unknownBlock', 'That block is outside the map.');

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');

    if (block.phase !== 'planted' && block.phase !== 'cleared') {
      return reject('wrongPhase', 'Cover crops go between palms or on cleared ground.');
    }

    if (block.coverCropUntil > state.tick) {
      return reject(
        'occupied',
        `Cover crop already growing for ${block.coverCropUntil - state.tick} more days.`,
      );
    }

    if (state.economy.cash < COVER_CROP.cost) {
      return reject('noCash', `Sowing costs Rp ${COVER_CROP.cost.toLocaleString('id-ID')}.`);
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);

    spend(state, COVER_CROP.cost, 'purchase', `cover crop: block ${command.block}`);
    block.coverCropUntil = state.tick + COVER_CROP.days;
    events.push({ type: 'CoverCropSown', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
