import { DRAINAGE_COST } from '../balance/prices.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type DrainBlock = Extract<Command, { type: 'DrainBlock' }>;

export const drainBlock: CommandHandler<DrainBlock> = {
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

    if (block.drained) {
      return reject('occupied', 'Already drained.', { key: 'rejections.drain.done' });
    }

    if (block.phase === 'kopdes') {
      return reject('wrongPhase', 'The Workshop does not need drainage.', {
        key: 'rejections.drain.kopdes',
      });
    }

    if (state.economy.cash < DRAINAGE_COST) {
      return reject('noCash', `Drainage costs Rp ${DRAINAGE_COST.toLocaleString('id-ID')}.`, {
        key: 'rejections.drain.cost',
        vars: { rp: DRAINAGE_COST },
      });
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);

    spend(state, DRAINAGE_COST, 'capital', `drainage: block ${command.block}`);
    block.drained = true;
    events.push({ type: 'BlockDrained', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
