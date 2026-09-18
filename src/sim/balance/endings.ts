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
 * Reboisasi: the ending nobody planned for. An estate that has put more of
 * its land back to forest than it holds in palms, by a clear margin and not
 * a token strip, is called at the close of the year, from the same year the
 * ISPO checklist opens. Young forest counts, saplings do not.
 */
export const REBOISASI = {
  /** Reforested hectares must beat palm hectares by at least this many. */
  marginHectares: 2,
  /** ...and be at least this many, so a two-block hobby does not end a run. */
  minHectares: 6,
  /** A reforesting block counts once this share of its trees has grown past sapling. */
  grownShare: 0.5,
  /**
   * TODO(sponsor): the reboisasi card carries a sponsor line; fill this in
   * when the partner is confirmed (name, one line, optional url).
   */
  sponsor: null as { name: string; line: string; url?: string } | null,
} as const;

/**
 * Redemption (§3.10, secret): the run of someone who cleared land with fire,
 * thought better of it, and put the forest back without ever taking a crop
 * off the ground they burned. Rarer than reboisasi and quieter: it asks for
 * less land back, but it asks that the estate never became an estate.
 */
export const REDEMPTION = {
  /** At least one burn lit by hand: an accident of lightning is not a sin to atone for. */
  burnsAtLeast: 1,
  /** Hectares of grown-back forest, counted the same way reboisasi counts them. */
  hectares: 2,
} as const;

/**
 * The bank's patience (§3.8). Palms planted within Kopdes range are collateral:
 * the estate may sit this far in the red per hectare of them. Below that line
 * for `daysInRed` straight days, or below zero with no collateral at all, or
 * with the licence suspended, the loans are called.
 */
export const BANKRUPTCY = {
  daysInRed: 90,
  creditPerHectare: 20_000_000,
} as const;

/**
 * The enforcement roll on burn-to-clear (§3.8). It only rolls while integrity
 * is high, which only happens after a scandal made the news, so an operating
 * ban is rare and always has a headline before it.
 */
export const OPERATING_BAN = {
  minIntegrity: 0.5,
  chance: 0.4,
  /**
   * A quarter of the year shut. Half a year read as longer than it was: a
   * suspension in the back half of a year ran into the next one, so the
   * notice named a year the player had not reached yet.
   */
  days: 90,
  /** Caretaker crews: upkeep runs at this share while the estate is shut. */
  upkeepFactor: 0.5,
} as const;

/** The run's chronicle for the epilogue timeline (§3.8). */
export const CHRONICLE = {
  cap: 160,
} as const;
