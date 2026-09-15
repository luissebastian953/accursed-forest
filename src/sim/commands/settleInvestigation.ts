/**
 * SettleInvestigation (§3.9): while integrity is low, a large payment makes the
 * police cars leave. It resets attention to 30 and lifts the ban — and the
 * news makes it clear exactly what happened.
 */

import { AUTHORITY } from '../balance/society.ts';
import { spend } from '../state.ts';
import { underInvestigation } from '../systems/society.ts';
import type { Command, SimState } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type SettleInvestigation = Extract<Command, { type: 'SettleInvestigation' }>;

export function settleCost(state: SimState): number {
  return Math.round(AUTHORITY.settleCost * state.economy.inputPriceIndex);
}

export const settleInvestigation: CommandHandler<SettleInvestigation> = {
  validate(ctx) {
    const { state } = ctx;
    if (!underInvestigation(state))
      return reject('wrongPhase', 'There is no investigation to settle.');
    if (state.society.integrity > AUTHORITY.settleMaxIntegrity) {
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
    state.society.warningLevel = 1;
    state.society.attention = AUTHORITY.settleAttention;
    events.push({ type: 'InvestigationSettled', cost });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};
