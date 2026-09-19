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
