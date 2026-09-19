import { AUTHORITY } from '../balance/society.ts';
import { settleFactor } from '../macro.ts';
import { spend } from '../state.ts';
import { operatingBanned, underInvestigation } from '../systems/society.ts';
import type { Command, SimState } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type SettleInvestigation = Extract<Command, { type: 'SettleInvestigation' }>;

/** What the envelope costs today: more when a suspension goes with it. */
export function settleCost(state: SimState): number {
  const base = AUTHORITY.settleCost + (operatingBanned(state) ? AUTHORITY.settleBanExtra : 0);

  return Math.round(base * state.economy.inputPriceIndex * settleFactor(state));
}

/** Whether there is anything an envelope could fix. */
export function settleable(state: SimState): boolean {
  return underInvestigation(state) || operatingBanned(state);
}

/** Whether anyone at the district office would take it. */
export function settleListening(state: SimState): boolean {
  return state.society.integrity <= AUTHORITY.settleMaxIntegrity;
}

export const settleInvestigation: CommandHandler<SettleInvestigation> = {
  validate(ctx) {
    const { state } = ctx;

    if (!settleable(state)) {
      return reject('wrongPhase', 'There is nothing to settle.');
    }

    if (!settleListening(state)) {
      return reject('wrongPhase', 'Nobody at the district office is taking calls right now.');
    }

    const cost = settleCost(state);

    if (state.economy.cash < cost) {
      return reject('noCash', `The "coordination fee" is Rp ${cost.toLocaleString('id-ID')}.`);
    }

    return null;
  },

  apply(ctx) {
    const { state, events } = ctx;
    const cost = settleCost(state);

    spend(state, cost, 'fine', 'coordination fee');
    state.society.investigationUntil = state.tick;
    state.society.operatingBanUntil = state.tick;
    state.society.warningLevel = 1;
    state.society.attention = AUTHORITY.settleAttention;
    events.push({ type: 'InvestigationSettled', cost });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
