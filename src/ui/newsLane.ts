/**
 * The news feed's three lanes (§8 panels 3, 8, 13): a colour and a label,
 * shared by the ticker and the full feed panel. Plain data, not a
 * component, so either can import it regardless of which has moved to
 * Svelte.
 */

import type { NewsItem } from '@sim/types';

export const LANE_TONE: Record<NewsItem['lane'], string> = {
  natural: 'bg-[#3faa4c]',
  economic: 'bg-[#5a8bff]',
  government: 'bg-[#e04a3a]',
};

export const LANE_LABEL: Record<NewsItem['lane'], string> = {
  natural: 'Natural',
  economic: 'Economic',
  government: 'Government',
};
