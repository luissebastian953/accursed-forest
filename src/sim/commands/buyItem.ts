/**
 * BuyItem (§3.3): the Kopdes shop. Prices are `base × inputPriceIndex`, so a
 * currency headline (M1f) shows up on the shelf immediately.
 */

import { ITEM_PRICES } from '../balance/prices.ts';
import { spend } from '../state.ts';
import type { Command, ItemId } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type BuyItem = Extract<Command, { type: 'BuyItem' }>;

export function itemPrice(item: ItemId, priceIndex: number): number {
  return Math.round(ITEM_PRICES[item] * priceIndex);
}

export const buyItem: CommandHandler<BuyItem> = {
  validate(ctx, command) {
    const { state } = ctx;
    if (!state.kopdes) return reject('noKopdes', 'Build a Kopdes first — it is where you buy.');
    if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
      return reject('badQuantity', 'Quantity must be a whole number above zero.');
    }
    const cost = itemPrice(command.item, state.economy.inputPriceIndex) * command.quantity;
    if (state.economy.cash < cost) {
      return reject(
        'noCash',
        `That costs Rp ${cost.toLocaleString('id-ID')}; you have Rp ${Math.max(0, state.economy.cash).toLocaleString('id-ID')}.`,
      );
    }
    return null;
  },

  apply(ctx, command) {
    const { state, events } = ctx;
    const cost = itemPrice(command.item, state.economy.inputPriceIndex) * command.quantity;
    spend(state, cost, 'purchase', `${command.quantity} × ${command.item}`);
    state.inventory[command.item] += command.quantity;
    events.push({ type: 'ItemBought', item: command.item, quantity: command.quantity });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
