/**
 * Pest tunables (§3.4). Only the debris economy is live in M1a; Ganoderma and
 * beetle rates arrive with the pest system in M1d.
 */

export const DEBRIS = {
  /** Debris points that decay away on their own each day. */
  decayPerDay: 0.12,
  /** Debris points one sanitation crew removes. */
  sanitizePerCrew: 60,
} as const;
