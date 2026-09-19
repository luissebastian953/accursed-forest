import { DEBRIS } from '../balance/pests.ts';
import { readBlock, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type SanitizeBlock = Extract<Command, { type: 'SanitizeBlock' }>;

export const sanitizeBlock: CommandHandler<SanitizeBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }
    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'Wait for the fire to go out.');
    if (block.debris <= 0) return reject('wrongPhase', 'No debris to clear here.');
    if (state.inventory.sanitationCrew < 1) {
      return reject('noInventory', 'No sanitation crew on hand; hire one at the Kopdes.');
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    state.inventory.sanitationCrew -= 1;
    block.debris = Math.max(0, block.debris - DEBRIS.sanitizePerCrew);
    events.push({ type: 'BlockSanitized', block: command.block, debris: block.debris });
    events.push({ type: 'BlockChanged', block: command.block });
  },
};
