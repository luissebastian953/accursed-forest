import { ECONOMY, KOPDES_UPGRADE_COST, KOPDES_UPGRADE_MATURED } from '../balance/prices.ts';
import { spend } from '../state.ts';
import { matureHectares } from '../systems/endings.ts';
import type { Command, SimState } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type UpgradeKopdes = Extract<Command, { type: 'UpgradeKopdes' }>;

export function kopdesUpgradeCost(level: number): number | null {
  if (level >= ECONOMY.kopdesMaxLevel) return null;
  return KOPDES_UPGRADE_COST[level] ?? null;
}

/** Blocks of bearing palms the next level asks for, and how many there are. */
export function kopdesMaturedNeeded(level: number): number {
  return KOPDES_UPGRADE_MATURED[level] ?? 0;
}

export function kopdesMaturedShort(state: SimState, level: number): number {
  return Math.max(0, kopdesMaturedNeeded(level) - matureHectares(state));
}

export const upgradeKopdes: CommandHandler<UpgradeKopdes> = {
  validate(ctx) {
    const { state } = ctx;

    if (!state.kopdes) return reject('noKopdes', 'There is no Kopdes to upgrade.');

    const cost = kopdesUpgradeCost(state.kopdes.level);

    if (cost === null) return reject('maxLevel', 'The Kopdes is already at its highest level.');

    const short = kopdesMaturedShort(state, state.kopdes.level);

    if (short > 0) {
      return reject(
        'wrongPhase',
        `${short} more ${short === 1 ? 'block' : 'blocks'} of bearing palms first.`,
      );
    }

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
