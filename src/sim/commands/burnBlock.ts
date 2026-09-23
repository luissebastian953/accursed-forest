import { FIRE } from '../balance/fire.ts';
import { ignite, isFuel, isWildfire, startWildfire } from '../fire.ts';
import { hasWon } from '../run.ts';
import { readBlock, spend } from '../state.ts';
import { staffBlock } from '../systems/mobs.ts';
import { operatingBanReason, operatingBanned, underInvestigation } from '../systems/society.ts';
import type { Command } from '../types.ts';

import { investigationReason } from './chopBlock.ts';
import { reject, type CommandHandler } from './handler.ts';

type BurnBlock = Extract<Command, { type: 'BurnBlock' }>;

/** Shown on every greyed Burn button once the estate has won (GDD 3.8). */
export const WON_NO_BURN = 'You already won. Why would you destroy it?';

export const burnBlock: CommandHandler<BurnBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    // A won estate keeps its fire; the sandbox is for building, not razing.
    if (hasWon(state)) return reject('halted', WON_NO_BURN);

    if (block.bannedUntil > state.tick) {
      return reject('banned', `Clearing is banned here until day ${block.bannedUntil}.`);
    }

    if (operatingBanned(state)) return reject('banned', operatingBanReason(state));
    if (underInvestigation(state)) return reject('banned', investigationReason(state));
    if (block.burning) return reject('burning', 'This block is already burning.');

    // Spoil does not burn, and a crew would be lighting it standing in mud.
    if (block.landslideAt >= 0) {
      return reject('wrongPhase', 'Dig the slide out before burning this block.');
    }

    if (!isFuel(block, false)) {
      return reject(
        'noFuel',
        block.phase === 'cleared'
          ? 'Nothing left to burn; not enough debris.'
          : block.phase === 'planted'
            ? 'You would be burning your own palms.'
            : 'Nothing here will burn.',
      );
    }

    if (state.economy.cash < FIRE.burnCost) {
      return reject('noCash', `A burn crew costs Rp ${FIRE.burnCost.toLocaleString('id-ID')}.`);
    }

    return null;
  },

  apply(ctx, command) {
    const { state, events } = ctx;
    // Under a wildfire every new fire is a wildfire.
    const intensity = isWildfire(state) ? 3 : command.intensity;

    ignite(ctx, command.block, intensity);
    staffBlock(ctx, command.block);
    spend(state, FIRE.burnCost, 'wages', `burn: block ${command.block}`);

    state.society.firePressure += FIRE.pressure[command.intensity];
    state.run.lastBurnAt = state.tick;
    events.push({ type: 'BurnStarted', block: command.block, intensity });
    events.push({ type: 'BlockChanged', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });

    if (state.society.firePressure > FIRE.wildfireThreshold) startWildfire(state, events);
  },
};
