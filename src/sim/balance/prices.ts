/** Starting economy, land pricing and shop prices (§3.1.1, §3.3, §3.5). */

import type { ItemId } from '../types.ts';

export const ECONOMY = {
  /** Enough for roughly two grassfield blocks, the Kopdes and bibit — no more. */
  startingCash: 95_000_000,

  /** Rupiah per kg of TBS at the start. */
  startingTbsPrice: 2_650,
  tbsPriceMin: 1_400,
  tbsPriceMax: 4_200,
  /** Per-tick standard deviation of the bounded random walk. */
  tbsPriceDrift: 28,
  /** Pull back toward the long-run mean each tick. */
  tbsPriceMeanReversion: 0.015,
  tbsPriceMean: 2_650,

  /** Labour per planted block per tick. */
  upkeepPerPlantedBlock: 18_000,

  /** Manhattan distance from the Kopdes within which TBS can be sold same-day. */
  kopdesRange: 3,
  kopdesRangePerLevel: 2,
  kopdesMaxLevel: 4,

  /** Ledger ring buffer size. */
  ledgerCap: 500,
  /** News ring buffer size (§3.7). */
  newsCap: 200,
  /** Command log cap; older years are summarised before this bites (§4.4). */
  commandLogCap: 4_000,
} as const;

/**
 * Land price = biome base × (1 + owned × perOwnedBlock) × (1 + distance × perDistance),
 * where distance is Manhattan blocks from the Kopdes, or from the estate's
 * centre before one is placed (§3.1.1: each purchase raises the next).
 */
export const LAND_PRICE = {
  perOwnedBlock: 0.04,
  perDistance: 0.06,
} as const;

/** A clearing crew's wages per day. Chopping a block costs `chopDays × this`. */
export const CREW_WAGE_PER_DAY = 350_000;

/** Base prices, before `economy.inputPriceIndex` is applied (§3.7). */
export const ITEM_PRICES: Record<ItemId, number> = {
  bibit: 38_000,
  fertilizer: 1_250_000,
  pheromoneTrap: 320_000,
  metarhizium: 780_000,
  trichoderma: 950_000,
  sanitationCrew: 2_100_000,
  forestSapling: 21_000,
};

export const KOPDES_BUILD_COST = 22_000_000;
