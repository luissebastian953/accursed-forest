import { compact } from '@shared/compact';
import type { Ending } from '@sim/types';

/** What the card says about a run: the numbers the epilogue already shows, nothing that spoils an ending. */
export interface RunCardInput {
  estateCode: string;
  year: number;
  ending: Ending;
  /** The ending's title, already translated. */
  endingTitle: string;
  /** 0 to 1. */
  forestCover: number;
  blocksBurned: number;
  forestPlanted: number;
  /** Operating profit over the run, in rupiah; negative is a loss. */
  profit: number;
  /** Where a friend lands to play the same estate. */
  shareUrl: string;
}

/** `t()` as the card needs it, passed in so the card stays testable without a locale. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

const BADGE: Record<Ending, string> = {
  clean: '🏆',
  dirty: '🏆',
  reboisasi: '🌳',
  redemption: '🌳',
  fade: '⏳',
  bankrupt: '💸',
  banned: '🚫',
  arrested: '🚔',
};

/** The run as a few lines of text and emoji, for a chat or a post. The last line is the link. */
export function buildRunCard(input: RunCardInput, t: Translate): string {
  const ha = (n: number) => t('epilogue.ha', { n });
  const rp = `Rp ${compact(Math.abs(input.profit))}`;
  const money = input.profit >= 0 ? t('share.cardProfit', { rp }) : t('share.cardLoss', { rp });

  return [
    `🌴 ${t('share.cardHead', { code: input.estateCode })}`,
    `${BADGE[input.ending]} ${t('share.cardEnding', { year: input.year, ending: input.endingTitle })}`,
    [
      `🌳 ${t('share.cardForest', { pct: `${Math.round(input.forestCover * 100)}%` })}`,
      `🔥 ${t('share.cardBurned', { n: ha(input.blocksBurned) })}`,
      `🌱 ${t('share.cardPlanted', { n: ha(input.forestPlanted) })}`,
    ].join('  '),
    `💰 ${money}`,
    `▶ ${t('share.cardPlay', { url: input.shareUrl })}`,
  ].join('\n');
}
