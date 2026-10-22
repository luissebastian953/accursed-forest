import { FIRE } from '../balance/fire.ts';
import { ignite, isFuel, isWildfire, startWildfire } from '../fire.ts';
import { hasWon } from '../run.ts';
import { readBlock, spend } from '../state.ts';
import { staffBlock } from '../systems/mobs.ts';
import { operatingBanRejection, operatingBanned, underInvestigation } from '../systems/society.ts';
import type { Command } from '../types.ts';

import { investigationRejection } from './chopBlock.ts';
import { reject, type CommandHandler } from './handler.ts';

type BurnBlock = Extract<Command, { type: 'BurnBlock' }>;

/** Shown on every greyed Burn button once the estate has won (GDD 3.8). */
export const WON_NO_BURN = 'You already won. Why would you need to burn?';

export const burnBlock: CommandHandler<BurnBlock> = {
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

    // A won estate keeps its fire; the sandbox is for building, not razing.
    if (hasWon(state)) return reject('halted', WON_NO_BURN, { key: 'rejections.burn.won' });

    if (block.bannedUntil > state.tick) {
      return reject('banned', `Clearing is banned here until day ${block.bannedUntil}.`, {
        key: 'rejections.ban.clearingUntilDay',
        vars: { day: block.bannedUntil },
      });
    }

    if (operatingBanned(state)) return operatingBanRejection(state);
    if (underInvestigation(state)) return investigationRejection(state);

    if (block.burning) {
      return reject('burning', 'This block is already burning.', {
        key: 'rejections.burn.alreadyBurning',
      });
    }

    if (!isFuel(block, false)) {
      if (block.phase === 'cleared') {
        return reject('noFuel', 'Nothing left to burn; not enough debris.', {
          key: 'rejections.burn.noDebris',
        });
      }

      if (block.phase === 'planted') {
        return reject('noFuel', 'You would be burning your own palms.', {
          key: 'rejections.burn.ownPalms',
        });
      }

      return reject('noFuel', 'Nothing here will burn.', { key: 'rejections.burn.nothingBurns' });
    }

    if (state.economy.cash < FIRE.burnCost) {
      return reject('noCash', `A burn crew costs Rp ${FIRE.burnCost.toLocaleString('id-ID')}.`, {
        key: 'rejections.burn.crewCost',
        vars: { rp: FIRE.burnCost },
      });
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
