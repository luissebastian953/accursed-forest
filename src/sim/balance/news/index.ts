/** Every headline template, by key (§3.7). */

import { ECONOMIC } from './economic.ts';
import { GOVERNMENT } from './government.ts';
import { NATURAL } from './natural.ts';
import type { NewsTemplate } from './types.ts';

export const NEWS_TEMPLATES: Record<string, NewsTemplate> = {
  ...NATURAL,
  ...ECONOMIC,
  ...GOVERNMENT,
};

export const NEWS = {
  /** The feed keeps this many items; older ones fall off (§3.7). */
  cap: 200,
  /** Chance the government reacts publicly to a fire or flood headline. */
  governmentReactionChance: 0.6,
  /** Integrity above which the reaction is real rather than hollow. */
  realResponseIntegrity: 0.5,
  /** Price move over 30 days that makes the news. */
  priceMoveHeadline: 0.1,
} as const;

export type { NewsTemplate } from './types.ts';

const PREFIXES = [
  'Sungai',
  'Bukit',
  'Tanjung',
  'Muara',
  'Rantau',
  'Kuala',
  'Teluk',
  'Padang',
] as const;
const SUFFIXES = [
  'Rimba',
  'Merah',
  'Hitam',
  'Panjang',
  'Tenang',
  'Jernih',
  'Sawit',
  'Baru',
] as const;

/** A fictional kabupaten name for this world, fixed by the seed. */
export function regionName(seed: number): string {
  const s = seed >>> 0;
  return `Kabupaten ${PREFIXES[s % PREFIXES.length]} ${SUFFIXES[Math.floor(s / 8) % SUFFIXES.length]}`;
}
