import { EXCAVATION } from '../balance/events.ts';
import { readBlock, writeBlock } from '../state.ts';
import { staffBlock } from '../systems/mobs.ts';
import type { Command, Rejection } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type ExcavateBlock = Extract<Command, { type: 'ExcavateBlock' }>;

export const excavateBlock: CommandHandler<ExcavateBlock> = {
  validate(ctx, command): Rejection | null {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'Wait for the fire to go out.');
    if (block.landslideAt < 0) return reject('wrongPhase', 'Nothing has come down here.');

    if (block.excavateUntil > state.tick) {
      return reject('occupied', 'The crew is already digging this one out.');
    }

    if (state.inventory.excavationCrew < 1) {
      return reject('noInventory', 'No excavation crew on hand; hire one at the Kopdes.');
    }

    return null;
  },

  apply(ctx, command): void {
    const { state, events } = ctx;
    const block = writeBlock(state, ctx.world, command.block);

    state.inventory.excavationCrew -= 1;
    block.excavateUntil = state.tick + EXCAVATION.days;
    // The diggers are on it before the next tick, so the site is not empty
    // for a day while the machine drives in.
    staffBlock(ctx, command.block, state.rng);
    events.push({ type: 'ExcavationStarted', block: command.block });
    events.push({ type: 'BlockChanged', block: command.block });
  },
};
