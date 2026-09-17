/**
 * The news feed's three lanes (§8 panels 3, 8, 13): a colour and a message
 * key, shared by the ticker and the full feed panel.
 */

import type { NewsItem } from '@sim/types';

export const LANE_TONE: Record<NewsItem['lane'], string> = {
  natural: 'bg-[#3faa4c]',
  economic: 'bg-[#5a8bff]',
  government: 'bg-[#e04a3a]',
};

export const LANE_LABEL_KEY: Record<NewsItem['lane'], string> = {
  natural: 'news.laneNatural',
  economic: 'news.laneEconomic',
  government: 'news.laneGovernment',
};
