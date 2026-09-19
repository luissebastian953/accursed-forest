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
