import { clamp } from '@shared/math';

import { OPERATING_BAN } from '../balance/endings.ts';
import { HAZE } from '../balance/events.ts';
import { ECONOMY } from '../balance/prices.ts';
import { HAZE_EVENT, activeEvent } from '../fire.ts';
import { estateForestCover } from '../landscape.ts';
import { macroKopdesPay } from '../macro.ts';
import { nextGaussian } from '../rng.ts';
import { earn, spend, type SimContext } from '../state.ts';

import { operatingBanned, tbsMeanFactor } from './society.ts';

export function economy(ctx: SimContext): void {
  const { state, events } = ctx;
  const e = state.economy;
  const cashBefore = e.cash;

  // ── Sales: everything harvested today, at today's price ────────────────
  if (e.tbsPending > 0) {
    const kilograms = e.tbsPending;
    const revenue = Math.round(kilograms * e.tbsPrice);

    earn(state, revenue, 'sale', `${Math.round(kilograms)} kg TBS @ ${e.tbsPrice}`);
    e.soldKgTotal += kilograms;
    e.tbsPending = 0;
    events.push({ type: 'TbsSold', kilograms, price: e.tbsPrice, revenue });
  }

  // ── Upkeep ─────────────────────────────────────────────────────────────
  let planted = 0;
  let irrigated = 0;

  for (const block of state.blocks.values()) {
    if (block.phase === 'planted') planted += 1;
    if (block.irrigated && block.owned) irrigated += 1;
  }

  const upkeep = Math.round(
    (planted * ECONOMY.upkeepPerPlantedBlock + irrigated * ECONOMY.irrigationUpkeepPerDay) *
      (operatingBanned(state) ? OPERATING_BAN.upkeepFactor : 1),
  );

  if (upkeep > 0) spend(state, upkeep, 'upkeep');

  // A supply contract the headlines handed the co-op, paid by the day.
  const contract = macroKopdesPay(state);

  if (contract > 0) earn(state, contract, 'sale', 'co-op supply contract');

  // ── Price walk ───────────────────────────────────────────────────────
  // Haze and forest cover shift the mean the price reverts to (GDD 3.6).
  const macro = tbsMeanFactor(state, estateForestCover(state, ctx.world));
  const mean =
    ECONOMY.tbsPriceMean * macro * (activeEvent(state, HAZE_EVENT) ? 1 - HAZE.priceDip : 1);
  const pull = ECONOMY.tbsPriceMeanReversion * (mean - e.tbsPrice);
  const noise = nextGaussian(state.rng) * ECONOMY.tbsPriceDrift;

  e.tbsPrice = Math.round(
    clamp(e.tbsPrice + pull + noise, ECONOMY.tbsPriceMin * macro, ECONOMY.tbsPriceMax * macro),
  );
  e.tbsPriceHistory.push(e.tbsPrice);

  if (e.tbsPriceHistory.length > ECONOMY.priceHistoryCap) {
    e.tbsPriceHistory.splice(0, e.tbsPriceHistory.length - ECONOMY.priceHistoryCap);
  }

  if (e.cash !== cashBefore) events.push({ type: 'CashChanged', cash: e.cash });
}
