import type { Biome, ItemId } from '../types.ts';

export const ECONOMY = {
  /**
   * Enough to build the Kopdes and get five or six blocks planted before the
   * first harvest; a start with room to make decisions, not just survive.
   */
  startingCash: 250_000_000,

  /** Rupiah per kg of TBS at the start. */
  startingTbsPrice: 3_300,
  tbsPriceMin: 1_900,
  tbsPriceMax: 5_200,
  /** Per-tick standard deviation of the bounded random walk. */
  tbsPriceDrift: 28,
  /** Pull back toward the long-run mean each tick. */
  tbsPriceMeanReversion: 0.015,
  tbsPriceMean: 3_300,

  /**
   * Labour per planted block per tick. Tuned with `pnpm sweep`: the immature
   * years still cost, but the estate no longer bleeds while it waits (GDD 3.5).
   */
  upkeepPerPlantedBlock: 9_000,
  /** Extra daily cost of keeping an irrigated block watered (GDD 3.1). */
  irrigationUpkeepPerDay: 3_000,
  /** Price history kept for the HUD trend and sparkline. */
  priceHistoryCap: 60,

  /** Manhattan distance from the Kopdes within which TBS can be sold same-day. */
  kopdesRange: 3,
  kopdesRangePerLevel: 2,
  kopdesMaxLevel: 4,

  /** Ledger ring buffer size. */
  ledgerCap: 500,
  /** News ring buffer size (GDD 3.7). */
  newsCap: 200,
  /** Command log cap; older years are summarised before this bites (GDD 4.4). */
  commandLogCap: 4_000,
} as const;

/**
 * Land price = biome base × (1 + owned × perOwnedBlock) × (1 + distance × perDistance),
 * distance in Manhattan blocks from the Kopdes (GDD 3.1.1: each purchase raises the next).
 */
export const LAND_PRICE = {
  perOwnedBlock: 0.04,
  perDistance: 0.06,
} as const;

/** A clearing crew's wages per day. Chopping a block costs `chopDays × this`. */
export const CREW_WAGE_PER_DAY = 350_000;

/** Base prices, before `economy.inputPriceIndex` is applied (GDD 3.7). */
export const ITEM_PRICES: Record<ItemId, number> = {
  bibit: 38_000,
  fertilizer: 1_250_000,
  pheromoneTrap: 320_000,
  metarhizium: 780_000,
  trichoderma: 950_000,
  sanitationCrew: 2_100_000,
  /** A machine and the men to work it, for the days it takes. */
  excavationCrew: 14_000_000,
  forestSapling: 21_000,
};

export const KOPDES_BUILD_COST = 22_000_000;

/**
 * Clearing a plantation (GDD 3.1.1), per palm standing: a full hectare is about twelve chops
 * and sells nothing, because it punishes a wrong turn rather than being a tool.
 */
export const CLEAR_PLANTATION = {
  perPalm: 300_000,
  /** Real crew days: a plantation is heavier work than scrub. */
  days: 12,
  /** What the felling leaves on the ground for the beetles. */
  debris: 40,
} as const;

/** What a chopped block's timber fetches at the Kopdes (GDD 3.1.1: offsets wages). */
export const TIMBER_VALUE: Partial<Record<Biome, number>> = {
  forest: 4_500_000,
  protected: 6_000_000,
  hills: 1_200_000,
  riverbank: 900_000,
  rubber: 2_000_000,
  peat: 1_500_000,
  swamp: 500_000,
};

/** Per-block upgrades (GDD 3.1): irrigation lifts the dry-scrub penalty; drainage flood-proofs. */
export const IRRIGATION_COST = 6_000_000;
export const DRAINAGE_COST = 4_000_000;

/**
 * Kopdes level `i` to `i + 1` (GDD 3.3); index 0 is unused, building is separate. Steep on
 * purpose: each step is earned out of the crop, not the opening balance.
 */
export const KOPDES_UPGRADE_COST: readonly number[] = [0, 90_000_000, 420_000_000, 1_200_000_000];

/**
 * Blocks of bearing palms the estate must already work before the Kopdes will
 * grow, indexed by the level it is on (GDD 3.3). Money alone no longer does it.
 */
export const KOPDES_UPGRADE_MATURED: readonly number[] = [0, 10, 20, 40];

/**
 * What the market pays a Kopdes of each level, as a share of the opening price
 * (GDD 3.3): every level is more competition, and index 0 is no Kopdes at all.
 */
export const KOPDES_TBS_SHARE: readonly number[] = [1, 1, 7 / 8, 1 / 2, 1 / 3];

export const HARVEST = {
  /** A harvest crew's wages per block per round. */
  crewWagePerRound: 180_000,
  /**
   * The Kopdes's own crew, when auto-harvest is on: a small surcharge on top
   * of the wages for picking the block without being asked (GDD 3.3).
   */
  autoSurchargePerRound: 45_000,
  /** Unharvested fruit rots on the tree beyond this many rounds' worth. */
  overripeCapRounds: 1.5,
} as const;
