import { ASH_EVENT, activeEvent } from '../fire.ts';
import { distanceToKopdes, inKopdesRange, kopdesRange } from '../kopdes.ts';
import { readBlock } from '../state.ts';
import {
  bearingCount,
  daysUntilRipe,
  harvestableKg,
  isRipe,
  pickBlock,
} from '../systems/harvest.ts';
import { operatingBanReason, operatingBanned } from '../systems/society.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type HarvestBlock = Extract<Command, { type: 'HarvestBlock' }>;

export const harvestBlock: CommandHandler<HarvestBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');
    if (operatingBanned(state)) return reject('banned', operatingBanReason(state));

    if (block.phase !== 'planted' || block.species !== 'palm') {
      return reject('wrongPhase', 'Nothing to harvest here.');
    }

    if (!state.kopdes) {
      return reject('noKopdes', 'Build a Workshop first; harvested fruit has nowhere to go.');
    }

    if (state.kopdes.autoHarvest) {
      return reject('halted', 'Auto-harvest is on; the Workshop crew picks this block itself.');
    }

    if (!inKopdesRange(state, world, command.block)) {
      const distance = distanceToKopdes(state, world, command.block) ?? 0;
      const range = kopdesRange(state.kopdes.level);

      return reject(
        'outOfRange',
        `Out of Workshop range (${distance} blocks, range ${range}); TBS would spoil before it sells. Upgrade the Workshop.`,
      );
    }

    const palms = state.palms.get(command.block);

    if (!palms) return reject('nothingToHarvest', 'No palms on this block.');

    if (bearingCount(palms, 'palm', state.tick) === 0) {
      return reject('nothingToHarvest', 'No ripe fruit yet; the palms are still immature.');
    }

    if (activeEvent(state, ASH_EVENT)) {
      return reject('halted', 'Ash is falling; crews cannot work until it stops.');
    }

    if (!isRipe(block, state.tick)) {
      const days = daysUntilRipe(block, state.tick) ?? 0;

      return reject('notRipe', `Next round in ${days} day${days === 1 ? '' : 's'}.`);
    }

    if (harvestableKg(palms, 'palm', state.tick) <= 0) {
      return reject('nothingToHarvest', 'Nothing on the trees this round.');
    }

    return null;
  },

  apply(ctx, command) {
    pickBlock(ctx, command.block, false);
  },
};
