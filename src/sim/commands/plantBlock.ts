import { BIOMES } from '../balance/biomes.ts';
import { createPalmArrays, plantSlots } from '../palms.ts';
import { readBlock, writeBlock } from '../state.ts';
import { creditReforestation, operatingBanReason, operatingBanned } from '../systems/society.ts';
import type { Command, ItemId, Species } from '../types.ts';

import { itemPrice } from './buyItem.ts';
import { reject, type CommandHandler } from './handler.ts';

type PlantBlock = Extract<Command, { type: 'PlantBlock' }>;

export function seedlingItem(species: Species): ItemId {
  return species === 'forest' ? 'forestSapling' : 'bibit';
}

/** Seedlings a block of this biome needs. */
export function seedlingsNeeded(biome: keyof typeof BIOMES): number {
  return BIOMES[biome].plantableSlots;
}

/** What buying the seedlings for a block would cost at the shop today. */
export function plantingCost(
  biome: keyof typeof BIOMES,
  species: Species,
  priceIndex: number,
): number {
  return seedlingsNeeded(biome) * itemPrice(seedlingItem(species), priceIndex);
}

export const plantBlock: CommandHandler<PlantBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');
    // Planting forest back is what the ban is asking for.
    if (command.species === 'palm' && operatingBanned(state))
      return reject('banned', operatingBanReason(state));

    if (block.bannedUntil > state.tick) {
      return reject('banned', `Planting is banned here until day ${block.bannedUntil}.`);
    }

    // Grass and scrub have nothing standing on them, so saplings go straight
    // in. Palms still want the land prepared first.
    const openWild =
      block.phase === 'wild' &&
      command.species === 'forest' &&
      BIOMES[block.biome].openLand === true;

    if (block.phase !== 'cleared' && !openWild) {
      return reject(
        'wrongPhase',
        block.phase === 'wild' ? 'Clear the block first.' : 'This block is already in use.',
      );
    }

    const item = seedlingItem(command.species);
    const needed = seedlingsNeeded(block.biome);
    const have = state.inventory[item];

    if (have < needed) {
      const label = command.species === 'forest' ? 'saplings' : 'seedlings';

      return reject(
        'noInventory',
        `Needs ${needed} ${label}; you have ${have}. Buy them at the Workshop.`,
      );
    }

    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    const needed = seedlingsNeeded(block.biome);

    state.inventory[seedlingItem(command.species)] -= needed;

    const palms = createPalmArrays();
    const count = plantSlots(palms, needed, state.tick);

    state.palms.set(command.block, palms);

    block.species = command.species;
    block.phase = command.species === 'forest' ? 'reforesting' : 'planted';
    // Straight from wild: there was no crew, so mark the ground finished.
    block.clearProgress = 1;

    events.push({ type: 'BlockPlanted', block: command.block, species: command.species, count });
    if (command.species === 'forest') creditReforestation(ctx, command.block);
  },
};
