/**
 * End-state tunables (§3.8): the ISPO certificate, bankruptcy, the operating
 * ban, and the 25-year horizon. Calibrated with `pnpm sweep -- --ispo`.
 */

export const ISPO = {
  /** One palm generation: the run's horizon, and the fade ending if nothing else came first. */
  horizonYears: 25,
  /** The checklist shows from this year on (§8 panel 19). */
  progressFromYear: 3,
  /** Cumulative operating profit, land and buildings excluded. */
  winProfit: 6_000_000_000,
  /** Every one of the last this-many years must have been profitable. */
  profitableYears: 3,
  /** Hectares of palms bearing fruit. One block is one hectare. */
  winHectares: 20,
  /** A block counts as mature once this share of its palms bear. */
  matureShare: 0.5,
  /** No burn-to-clear within this many years. */
  noBurnYears: 5,
  /** Forest share around the estate's slopes (§3.6.2). */
  winForestFloor: 0.2,
  /** Below this integrity, the no-burn and forest conditions can be waived. */
  waiverMaxIntegrity: 0.4,
  /** Closed years kept for the year-end card and the profit history; sandbox runs go on. */
  yearsKept: 100,
} as const;

/**
 * The bank's patience (§3.8). Palms planted within Kopdes range are collateral:
 * the estate may sit this far in the red per hectare of them. Below that line
 * for `daysInRed` straight days — or below zero with no collateral at all, or
 * with the licence suspended — the loans are called.
 */
export const BANKRUPTCY = {
  daysInRed: 90,
  creditPerHectare: 20_000_000,
} as const;

/**
 * The enforcement roll on burn-to-clear (§3.8). It only rolls while integrity
 * is high — which only happens after a scandal made the news — so an operating
 * ban is rare and always has a headline before it.
 */
export const OPERATING_BAN = {
  minIntegrity: 0.5,
  chance: 0.4,
  days: 300,
  /** Caretaker crews: upkeep runs at this share while the estate is shut. */
  upkeepFactor: 0.5,
} as const;

/** The run's chronicle for the epilogue timeline (§3.8). */
export const CHRONICLE = {
  cap: 160,
} as const;
