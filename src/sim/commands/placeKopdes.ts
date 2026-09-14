/**
 * PlaceKopdes (§3.3): the estate's admin building, on one cleared block.
 * Required for buying and selling from M1b on.
 */

import { KOPDES_BUILD_COST } from '../balance/prices.ts';
import { readBlock, spend, writeBlock, type SimContext } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type PlaceKopdes = Extract<Command, { type: 'PlaceKopdes' }>;

export const placeKopdes: CommandHandler<PlaceKopdes> = {
  validate(ctx: SimContext, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }
    if (state.kopdes) return reject('occupied', 'The estate already has a Kopdes.');

    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');
    if (block.phase !== 'cleared') return reject('wrongPhase', 'The Kopdes needs a cleared block.');
    if (state.economy.cash < KOPDES_BUILD_COST) {
      return reject(
        'noCash',
        `Building the Kopdes costs Rp ${KOPDES_BUILD_COST.toLocaleString('id-ID')}.`,
      );
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    spend(state, KOPDES_BUILD_COST, 'purchase', 'Kopdes');
    block.phase = 'kopdes';
    state.kopdes = { blockId: command.block, level: 1 };
    events.push({ type: 'KopdesPlaced', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
