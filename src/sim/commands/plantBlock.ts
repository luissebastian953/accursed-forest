/**
 * PlantBlock (§3.2, §3.10): fill a cleared block with palms or forest saplings.
 * In M1a bibit are bought implicitly at list price; the Kopdes shop and the
 * inventory indirection arrive in M1b.
 */

import { BIOMES } from '../balance/biomes.ts';
import { ITEM_PRICES } from '../balance/prices.ts';
import { createPalmArrays, plantSlots } from '../palms.ts';
import { readBlock, spend, writeBlock, type SimContext } from '../state.ts';
import type { Command, Species } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type PlantBlock = Extract<Command, { type: 'PlantBlock' }>;

export function plantingCost(
  biome: keyof typeof BIOMES,
  species: Species,
  priceIndex: number,
): number {
  const slots = BIOMES[biome].plantableSlots;
  const unit = species === 'forest' ? ITEM_PRICES.forestSapling : ITEM_PRICES.bibit;
  return Math.round(slots * unit * priceIndex);
}

export const plantBlock: CommandHandler<PlantBlock> = {
  validate(ctx: SimContext, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);
    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.bannedUntil > state.tick) {
      return reject('banned', `Planting is banned here until day ${block.bannedUntil}.`);
    }
    if (block.phase !== 'cleared') {
      return reject(
        'wrongPhase',
        block.phase === 'wild' ? 'Clear the block first.' : 'This block is already in use.',
      );
    }

    const cost = plantingCost(block.biome, command.species, state.economy.inputPriceIndex);
    if (state.economy.cash < cost) {
      return reject('noCash', `Planting costs Rp ${cost.toLocaleString('id-ID')} here.`);
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    const slots = BIOMES[block.biome].plantableSlots;

    spend(
      state,
      plantingCost(block.biome, command.species, state.economy.inputPriceIndex),
      'purchase',
      `${command.species === 'forest' ? 'saplings' : 'bibit'}: block ${command.block}`,
    );

    const palms = createPalmArrays();
    const count = plantSlots(palms, slots, state.tick);
    state.palms.set(command.block, palms);

    block.species = command.species;
    block.phase = command.species === 'forest' ? 'reforesting' : 'planted';

    events.push({ type: 'BlockPlanted', block: command.block, species: command.species, count });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
