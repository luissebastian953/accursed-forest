/** Starting economy, land pricing and shop prices (§3.1.1, §3.3, §3.5). */

import type { Biome, ItemId } from '../types.ts';

export const ECONOMY = {
  /**
   * Enough to build the Kopdes and get five or six blocks planted before the
   * first harvest — a start with room to make decisions, not just survive.
   */
  startingCash: 250_000_000,

  /** Rupiah per kg of TBS at the start. */
  startingTbsPrice: 2_650,
  tbsPriceMin: 1_400,
  tbsPriceMax: 4_200,
  /** Per-tick standard deviation of the bounded random walk. */
  tbsPriceDrift: 28,
  /** Pull back toward the long-run mean each tick. */
  tbsPriceMeanReversion: 0.015,
  tbsPriceMean: 2_650,

  /**
   * Labour per planted block per tick. Tuned with `pnpm sweep`: the immature
   * years still cost, but the estate no longer bleeds while it waits (§3.5).
   */
  upkeepPerPlantedBlock: 9_000,
  /** Extra daily cost of keeping an irrigated block watered (§3.1). */
  irrigationUpkeepPerDay: 3_000,
  /** Price history kept for the HUD trend and sparkline. */
  priceHistoryCap: 60,

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

/** What a chopped block's timber fetches at the Kopdes (§3.1.1: offsets wages). */
export const TIMBER_VALUE: Partial<Record<Biome, number>> = {
  forest: 4_500_000,
  protected: 6_000_000,
  hills: 1_200_000,
  riverbank: 900_000,
  rubber: 2_000_000,
  peat: 1_500_000,
  swamp: 500_000,
};

/** Per-block upgrades (§3.1): irrigation lifts the dry-scrub penalty; drainage flood-proofs. */
export const IRRIGATION_COST = 6_000_000;
export const DRAINAGE_COST = 4_000_000;

/** Cost to go from level `i` to `i + 1`; index 0 is unused (building is separate). */
export const KOPDES_UPGRADE_COST: readonly number[] = [0, 18_000_000, 30_000_000, 50_000_000];

export const HARVEST = {
  /** A harvest crew's wages per block per round. */
  crewWagePerRound: 180_000,
  /**
   * The Kopdes's own crew, when auto-harvest is on: a small surcharge on top
   * of the wages for picking the block without being asked (§3.3).
   */
  autoSurchargePerRound: 45_000,
  /** Unharvested fruit rots on the tree beyond this many rounds' worth. */
  overripeCapRounds: 1.5,
} as const;
