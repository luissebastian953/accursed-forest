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
 * where distance is Manhattan blocks from the Kopdes, or from the estate's
 * centre before one is placed (GDD 3.1.1: each purchase raises the next).
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

/** What a chopped block's timber fetches at the Kopdes (GDD 3.1.1: offsets wages). */
/**
 * Clearing a plantation (GDD 3.1.1): felling every palm on a block and
 * hauling the stumps out. Priced per palm standing, so a full hectare costs
 * about twelve chops, because it is a punishment for a wrong turn, not a
 * tool; and it pays nothing for what comes down, unlike a forest chop.
 */
export const CLEAR_PLANTATION = {
  perPalm: 300_000,
  /** Real crew days: a plantation is heavier work than scrub. */
  days: 12,
  /** What the felling leaves on the ground for the beetles. */
  debris: 40,
} as const;

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
 * Cost to go from level `i` to `i + 1`; index 0 is unused (building is
 * separate). The curve is steep on purpose: level 3 is what opens the payroll
 * and the 50x clock, and the top level is one of the five ISPO conditions, so
 * each step has to be earned out of the crop rather than paid for out of the
 * opening balance.
 */
/**
 * What each level of the Kopdes costs (GDD 3.3). The ladder climbs steeply: the
 * range it buys is the difference between selling a corner of the estate and
 * all of it, and level 3 opens the payroll and the fast clock besides. An
 * estate should be years into its harvests before it reaches the top.
 */
export const KOPDES_UPGRADE_COST: readonly number[] = [0, 90_000_000, 260_000_000, 650_000_000];

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
