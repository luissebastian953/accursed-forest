/**
 * A headline template (§3.7). Templates are data with slot variables and
 * several phrasings each, so the feed does not repeat itself. Institutions
 * and people are fictional and generic; the Palace, the Ministry, a governor,
 * a regional police chief. Satire targets institutions, never persons.
 *
 * Slots: {region} {estate} {n} {days} {pct} {price} {block} {until} {cost}
 */

import type { NewsLane, NewsSeverity } from '../../types.ts';

export interface NewsTemplate {
  lane: NewsLane;
  severity: NewsSeverity;
  /** The same key will not publish again within this many days. */
  cooldownDays: number;
  titles: readonly string[];
  bodies: readonly string[];
  /** The "what this does to you" line (§3.7). */
  effects: readonly string[];
  /**
   * Whether the headline goes into the run's chronicle for the epilogue
   * (§3.8). Defaults to warnings and above.
   */
  chronicle?: boolean;
}
