/**
 * UpgradeKopdes (§3.3): each level extends the range within which TBS can be
 * sold same-day. Level-ups add a wing to the building (render, M1b+).
 */

import { ECONOMY, KOPDES_UPGRADE_COST } from '../balance/prices.ts';
import { spend } from '../state.ts';
import type { Command } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type UpgradeKopdes = Extract<Command, { type: 'UpgradeKopdes' }>;

export function kopdesUpgradeCost(level: number): number | null {
  if (level >= ECONOMY.kopdesMaxLevel) return null;
  return KOPDES_UPGRADE_COST[level] ?? null;
}

export const upgradeKopdes: CommandHandler<UpgradeKopdes> = {
  validate(ctx) {
    const { state } = ctx;
    if (!state.kopdes) return reject('noKopdes', 'There is no Kopdes to upgrade.');
    const cost = kopdesUpgradeCost(state.kopdes.level);
    if (cost === null) return reject('maxLevel', 'The Kopdes is already at its highest level.');
    if (state.economy.cash < cost) {
      return reject('noCash', `The upgrade costs Rp ${cost.toLocaleString('id-ID')}.`);
    }
    return null;
  },

  apply(ctx) {
    const { state, events } = ctx;
    const kopdes = state.kopdes!;
    spend(state, kopdesUpgradeCost(kopdes.level)!, 'capital', `Kopdes level ${kopdes.level + 1}`);
    kopdes.level += 1;
    events.push({ type: 'KopdesUpgraded', level: kopdes.level });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
