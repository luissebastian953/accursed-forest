import { IRRIGATION_COST } from '../balance/prices.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type IrrigateBlock = Extract<Command, { type: 'IrrigateBlock' }>;

export const irrigateBlock: CommandHandler<IrrigateBlock> = {
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
      return reject('burning', 'Wait for the fire to go out.', {
        key: 'rejections.block.waitForFire',
      });
    }

    if (block.irrigated) {
      return reject('occupied', 'Already irrigated.', { key: 'rejections.irrigate.done' });
    }

    if (block.phase === 'kopdes') {
      return reject('wrongPhase', 'The Workshop does not need watering.', {
        key: 'rejections.irrigate.kopdes',
      });
    }

    if (state.economy.cash < IRRIGATION_COST) {
      return reject('noCash', `Irrigation costs Rp ${IRRIGATION_COST.toLocaleString('id-ID')}.`, {
        key: 'rejections.irrigate.cost',
        vars: { rp: IRRIGATION_COST },
      });
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);

    spend(state, IRRIGATION_COST, 'capital', `irrigation: block ${command.block}`);
    block.irrigated = true;
    events.push({ type: 'BlockIrrigated', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
