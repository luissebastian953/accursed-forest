import { CLEAR_PLANTATION } from '../balance/prices.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import { staffBlock } from '../systems/mobs.ts';
import { operatingBanReason, operatingBanned } from '../systems/society.ts';
import type { Command, SimState } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type ClearPlantation = Extract<Command, { type: 'ClearPlantation' }>;

/** Palms standing on a block, which is what the crew is paid to fell. */
export function palmsStanding(state: SimState, block: number): number {
  const palms = state.palms.get(block);

  if (!palms) return 0;

  let n = 0;

  for (const t of palms.plantedAt) if (t >= 0) n += 1;

  return n;
}

/** What felling this block costs today: per palm standing, at the day's index. */
export function clearPlantationCost(state: SimState, block: number): number {
  return Math.round(
    palmsStanding(state, block) * CLEAR_PLANTATION.perPalm * state.economy.inputPriceIndex,
  );
}

export const clearPlantation: CommandHandler<ClearPlantation> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');

    if (block.phase !== 'planted' && block.phase !== 'reforesting') {
      return reject('wrongPhase', 'There is no plantation here to clear.');
    }

    if (block.burning) return reject('burning', 'This block is on fire.');

    if (block.fellingUntil > state.tick) {
      return reject('wrongPhase', 'A crew is already felling this block.');
    }

    if (operatingBanned(state)) return reject('banned', operatingBanReason(state));

    if (palmsStanding(state, command.block) === 0) {
      return reject('wrongPhase', 'Nothing is standing here to fell.');
    }

    const cost = clearPlantationCost(state, command.block);

    if (state.economy.cash < cost) {
      return reject(
        'noCash',
        `Felling this plantation costs Rp ${cost.toLocaleString('id-ID')}; you have Rp ${Math.max(0, state.economy.cash).toLocaleString('id-ID')}.`,
      );
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    const palms = palmsStanding(state, command.block);
    const cost = clearPlantationCost(state, command.block);

    spend(state, cost, 'wages', `clear plantation: block ${command.block}`);
    // The palms stay standing while the crew works through them, and come
    // down together when the job ends (`terrain.ts`). What the player sees
    // in the meantime is a crew on the block and a ring counting down.
    block.fellingUntil = state.tick + CLEAR_PLANTATION.days;
    staffBlock(ctx, command.block);
    events.push({ type: 'FellingStarted', block: command.block, palms, cost });
    events.push({ type: 'BlockChanged', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
