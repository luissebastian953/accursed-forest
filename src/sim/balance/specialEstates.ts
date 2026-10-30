import type { ClimateRegime } from '../types.ts';

import { SLOTS_PER_BLOCK } from './world.ts';

export interface SpecialEstate {
  /** The first year's climate; the yearly roll takes over after it. */
  regime?: ClimateRegime;
  /** Added to the attention meter on day one. */
  attention?: number;
  /** Added to the starting cash. */
  cash?: number;
  /** Seedlings already in the shed. */
  bibit?: number;
  /** Fertilizer bags already in the shed. */
  fertilizer?: number;
}

/** Three estate names start a different run (GDD 4.6); the world is still the name's own. */
export const SPECIAL_ESTATES = {
  karhutla: { regime: 'elNino', attention: 20 },
  nyawit: { cash: 100_000_000 },
  penyawit: { bibit: SLOTS_PER_BLOCK, fertilizer: 4 },
} as const satisfies Record<string, SpecialEstate>;

export type SpecialEstateId = keyof typeof SPECIAL_ESTATES;

/** The special estate a name asks for, read the way the seed reads it: letters and digits only. */
export function specialEstate(name: string): SpecialEstateId | null {
  const clean = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

  return Object.hasOwn(SPECIAL_ESTATES, clean) ? (clean as SpecialEstateId) : null;
}
