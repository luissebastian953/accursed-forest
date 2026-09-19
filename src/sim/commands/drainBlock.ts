import { DRAINAGE_COST } from '../balance/prices.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type DrainBlock = Extract<Command, { type: 'DrainBlock' }>;

export const drainBlock: CommandHandler<DrainBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }
    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'Wait for the fire to go out.');
    if (block.drained) return reject('occupied', 'Already drained.');
    if (block.phase === 'kopdes') return reject('wrongPhase', 'The Kopdes does not need drainage.');
    if (state.economy.cash < DRAINAGE_COST) {
      return reject('noCash', `Drainage costs Rp ${DRAINAGE_COST.toLocaleString('id-ID')}.`);
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
