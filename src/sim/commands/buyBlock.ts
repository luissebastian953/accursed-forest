/**
 * BuyBlock (§3.1.1): instant title on a for-sale block adjacent to land you
 * already own. Buying does not clear; a bought forest still needs chopping.
 */

import { manhattan } from '@shared/math';

import { BIOMES } from '../balance/biomes.ts';
import { LAND_PRICE } from '../balance/prices.ts';
import { landFactor } from '../macro.ts';
import { countOwned, hasOwnedNeighbour, readBlock, spend, writeBlock } from '../state.ts';
import type { BlockId, Command, SimState } from '../types.ts';
import type { World } from '../worldgen/index.ts';

import { reject, type CommandHandler } from './handler.ts';

type BuyBlock = Extract<Command, { type: 'BuyBlock' }>;

export function landPrice(state: SimState, world: World, id: BlockId): number {
  const block = readBlock(state, world, id);
  const [x, y] = world.toXY(id);

  const anchor = state.kopdes?.blockId ?? state.worldGen.kopdesBlock;
  const [ax, ay] = world.toXY(anchor);

  const distance = manhattan(x, y, ax, ay);
  // The starting estate came free; only purchases raise the next price.
  const startBlocks = state.worldGen.startSize * state.worldGen.startSize;
  const bought = Math.max(0, countOwned(state) - startBlocks);

  return Math.round(
    BIOMES[block.biome].price *
      (1 + bought * LAND_PRICE.perOwnedBlock) *
      (1 + distance * LAND_PRICE.perDistance) *
      landFactor(state),
  );
}

export const buyBlock: CommandHandler<BuyBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    if (!world.inBounds(...world.toXY(command.block))) {
      return reject('unknownBlock', 'That block is outside the map.');
    }

    const block = readBlock(state, world, command.block);
    if (block.owned) return reject('occupied', 'You already own this block.');
    if (block.burning) return reject('burning', 'This block is on fire; nobody is selling.');
    if (!block.forSale) {
      return reject('notForSale', `${describe(block.biome)} is not for sale.`);
    }
    if (!hasOwnedNeighbour(state, world, command.block)) {
      return reject('notAdjacent', 'Not adjacent to your land; buy a neighbouring block first.');
    }

    const price = landPrice(state, world, command.block);
    if (state.economy.cash < price) {
      return reject(
        'noCash',
        `Costs Rp ${price.toLocaleString('id-ID')}; you have Rp ${Math.max(0, state.economy.cash).toLocaleString('id-ID')}.`,
      );
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const price = landPrice(state, world, command.block);
    const block = writeBlock(state, world, command.block);
    block.owned = true;
    spend(state, price, 'capital', `land: block ${command.block}`);
    events.push({ type: 'BlockBought', block: command.block });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};

function describe(biome: string): string {
  switch (biome) {
    case 'protected':
      return 'Protected forest';
    case 'river':
      return 'River water';
    case 'village':
      return 'Village land';
    default:
      return 'This land';
  }
}
