import { BIOMES } from '../balance/biomes.ts';
import { createPalmArrays, plantSlots } from '../palms.ts';
import { readBlock, writeBlock } from '../state.ts';
import { creditReforestation, operatingBanRejection, operatingBanned } from '../systems/society.ts';
import type { Command, ItemId, Rejection, Species } from '../types.ts';

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

/** The stock shortfall a planting or a replanting reports, in the species' own word. */
export function shortSeedlings(species: Species, needed: number, have: number): Rejection {
  const forest = species === 'forest';
  const label = forest ? 'saplings' : 'seedlings';

  return reject(
    'noInventory',
    `Needs ${needed} ${label}; you have ${have}. Buy them at the Workshop.`,
    {
      key: forest ? 'rejections.plant.needsSaplings' : 'rejections.plant.needsSeedlings',
      vars: { n: needed, have },
    },
  );
}

export const plantBlock: CommandHandler<PlantBlock> = {
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

    if (block.burning) {
      return reject('burning', 'This block is on fire.', { key: 'rejections.block.onFire' });
    }

    // Planting forest back is what the ban is asking for.
    if (command.species === 'palm' && operatingBanned(state)) return operatingBanRejection(state);

    if (block.bannedUntil > state.tick) {
      return reject('banned', `Planting is banned here until day ${block.bannedUntil}.`, {
        key: 'rejections.ban.plantingUntilDay',
        vars: { day: block.bannedUntil },
      });
    }

    // Grass and scrub have nothing standing on them, so saplings go straight
    // in. Palms still want the land prepared first.
    const openWild =
      block.phase === 'wild' &&
      command.species === 'forest' &&
      BIOMES[block.biome].openLand === true;

    if (block.phase !== 'cleared' && !openWild) {
      if (block.phase === 'wild') {
        return reject('wrongPhase', 'Clear the block first.', {
          key: 'rejections.plant.clearFirst',
        });
      }

      return reject('wrongPhase', 'This block is already in use.', {
        key: 'rejections.plant.inUse',
      });
    }

    const needed = seedlingsNeeded(block.biome);
    const have = state.inventory[seedlingItem(command.species)];

    if (have < needed) return shortSeedlings(command.species, needed, have);

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

    // Roots go down into a dug-out grave: the haunting's clock starts here (GDD 3.11).
    if (block.biome === 'grave') {
      block.hauntedSince = state.tick;
      events.push({ type: 'HauntingStarted', block: command.block });
    }
  },
};
