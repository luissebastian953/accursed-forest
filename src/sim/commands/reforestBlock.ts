/**
 * ReforestBlock (§3.10): put a block back under forest in one step. The two
 * halves of reforesting, buying saplings at the Kopdes and planting them,
 * were separate commands and a player had to work out the arithmetic between
 * them. This buys exactly what the block is short of and plants it.
 *
 * Saplings already in stock are used first, so a block out of the Kopdes's
 * range can still be reforested from what the estate is carrying.
 */

import { inKopdesRange } from '../kopdes.ts';
import { readBlock, spend, type SimContext } from '../state.ts';
import type { BlockId, Command } from '../types.ts';

import { itemPrice } from './buyItem.ts';
import { reject, type CommandHandler } from './handler.ts';
import { plantBlock, seedlingsNeeded } from './plantBlock.ts';

type ReforestBlock = Extract<Command, { type: 'ReforestBlock' }>;

/** How many saplings this block still needs buying for. */
export function saplingShortfall(ctx: SimContext, block: BlockId): number {
  const b = readBlock(ctx.state, ctx.world, block);
  return Math.max(0, seedlingsNeeded(b.biome) - ctx.state.inventory.forestSapling);
}

/** What reforesting this block would cost today: the shortfall, at shop prices. */
export function reforestCost(ctx: SimContext, block: BlockId): number {
  return (
    saplingShortfall(ctx, block) * itemPrice('forestSapling', ctx.state.economy.inputPriceIndex)
  );
}

export const reforestBlock: CommandHandler<ReforestBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;
    // Everything that stops a planting stops this too: it is the same act.
    const planting = plantBlock.validate(ctx, {
      type: 'PlantBlock',
      block: command.block,
      species: 'forest',
    });
    // Short stock is this command's business, not a reason to refuse.
    if (planting !== null && planting.code !== 'noInventory') return planting;

    const short = saplingShortfall(ctx, command.block);
    if (short > 0) {
      if (!state.kopdes) {
        return reject('noKopdes', 'Saplings come from a Kopdes. Build one first.');
      }
      if (!inKopdesRange(state, world, command.block)) {
        return reject('noKopdes', 'No Kopdes within range of this block to buy saplings from.');
      }
      const cost = reforestCost(ctx, command.block);
      if (state.economy.cash < cost) {
        return reject(
          'noCash',
          `${short} saplings cost Rp ${cost.toLocaleString('id-ID')}; you have Rp ${Math.max(0, state.economy.cash).toLocaleString('id-ID')}.`,
        );
      }
    }
    return null;
  },

  apply(ctx, command) {
    const { state, events } = ctx;
    const short = saplingShortfall(ctx, command.block);
    if (short > 0) {
      const cost = reforestCost(ctx, command.block);
      spend(state, cost, 'purchase', `${short} × forestSapling`);
      state.inventory.forestSapling += short;
      events.push({ type: 'ItemBought', item: 'forestSapling', quantity: short });
      events.push({ type: 'CashChanged', cash: state.economy.cash });
    }
    plantBlock.apply(ctx, { type: 'PlantBlock', block: command.block, species: 'forest' });
  },
};
