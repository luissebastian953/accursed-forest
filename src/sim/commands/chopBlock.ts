/**
 * ChopBlock (§3.1.1): the safe, slow way to clear. Puts a crew on the block;
 * `systems/terrain.ts` advances the work each day, leaves stumps and debris
 * behind when it is done, and sells the timber.
 */

import { BIOMES } from '../balance/biomes.ts';
import { CREW_WAGE_PER_DAY } from '../balance/prices.ts';
import { readBlock, spend, writeBlock } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type ChopBlock = Extract<Command, { type: 'ChopBlock' }>;

export function chopCost(biome: keyof typeof BIOMES): number {
  return BIOMES[biome].chopDays * CREW_WAGE_PER_DAY;
}

export const chopBlock: CommandHandler<ChopBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.bannedUntil > state.tick) {
      return reject('banned', `Clearing is banned here until day ${block.bannedUntil}.`);
    }
    if (block.burning) return reject('burning', 'This block is on fire.');
    if (block.phase !== 'wild') return reject('wrongPhase', 'Only wild land can be chopped.');
    if (!BIOMES[block.biome].clearable) {
      return reject('wrongPhase', 'This land cannot be cleared.');
    }

    const cost = chopCost(block.biome);
    if (state.economy.cash < cost) {
      return reject('noCash', `A crew costs Rp ${cost.toLocaleString('id-ID')} for this block.`);
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    spend(state, chopCost(block.biome), 'wages', `chop: block ${command.block}`);
    block.phase = 'clearing';
    block.clearProgress = 0;
    events.push({ type: 'BlockChanged', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
