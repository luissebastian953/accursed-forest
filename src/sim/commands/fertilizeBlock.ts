/**
 * FertilizeBlock (§3.5): one application lifts the block's fertility factor
 * for `FERTILIZER_DAYS`, which feeds both growth-days and yield through `G`.
 */

import { FERTILIZER_DAYS } from '../balance/growth.ts';
import { readBlock, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type FertilizeBlock = Extract<Command, { type: 'FertilizeBlock' }>;

export const fertilizeBlock: CommandHandler<FertilizeBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }
    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');
    if (block.phase !== 'planted' && block.phase !== 'reforesting') {
      return reject('wrongPhase', 'Only planted blocks take fertilizer.');
    }
    if (block.fertilizedUntil > state.tick) {
      return reject(
        'occupied',
        `Already fertilized for ${block.fertilizedUntil - state.tick} more days.`,
      );
    }
    if (state.inventory.fertilizer < 1) {
      return reject('noInventory', 'No fertilizer in stock; buy some at the Kopdes.');
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
