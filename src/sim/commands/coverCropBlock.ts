import { COVER_CROP } from '../balance/events.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type CoverCropBlock = Extract<Command, { type: 'CoverCropBlock' }>;

export const coverCropBlock: CommandHandler<CoverCropBlock> = {
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

    if (block.phase !== 'planted' && block.phase !== 'cleared') {
      return reject('wrongPhase', 'Cover crops go between palms or on cleared ground.', {
        key: 'rejections.coverCrop.wrongPhase',
      });
    }

    if (block.coverCropUntil > state.tick) {
      const n = block.coverCropUntil - state.tick;

      return reject('occupied', `Cover crop already growing for ${n} more days.`, {
        key: 'rejections.coverCrop.growing',
        vars: { n },
      });
    }

    if (state.economy.cash < COVER_CROP.cost) {
      return reject('noCash', `Sowing costs Rp ${COVER_CROP.cost.toLocaleString('id-ID')}.`, {
        key: 'rejections.coverCrop.cost',
        vars: { rp: COVER_CROP.cost },
      });
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
