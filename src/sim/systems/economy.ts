/**
 * Economy system (§3.5). M1a: upkeep only. The TBS price walk, sales and
 * spoilage arrive with the Kopdes in M1b.
 */

import { ECONOMY } from '../balance/prices.ts';
import { spend, type SimContext } from '../state.ts';

export function economy(ctx: SimContext): void {
  const { state, events } = ctx;

  let planted = 0;
  for (const block of state.blocks.values()) {
    if (block.phase === 'planted') planted += 1;
  }

  if (planted === 0) return;

  spend(state, planted * ECONOMY.upkeepPerPlantedBlock, 'upkeep');
  events.push({ type: 'CashChanged', cash: state.economy.cash });
}
