import { describe, expect, it } from 'vitest';

import { buildRunCard, type RunCardInput } from '../../src/ui/svelte/endings/runCard.ts';

/** A stand-in for `t()`: the key with its variables filled, so a test reads what the card asked for. */
const COPY: Record<string, string> = {
  'epilogue.ha': '{n} ha',
  'share.cardHead': 'Sawit Simulator: estate {code}',
  'share.cardEnding': 'Year {year}, {ending}',
  'share.cardForest': 'Forest cover {pct}',
  'share.cardBurned': 'Burned {n}',
  'share.cardPlanted': 'Forest planted {n}',
  'share.cardProfit': 'Operating profit {rp}',
  'share.cardLoss': 'Operating loss {rp}',
  'share.cardPlay': 'Play the same estate: {url}',
};

const t = (key: string, vars: Record<string, string | number> = {}): string =>
  (COPY[key] ?? key).replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );

const run: RunCardInput = {
  estateCode: 'ABC-DEFG',
  year: 9,
  ending: 'clean',
  endingTitle: 'Certified Penyawit Expert!',
  forestCover: 0.412,
  blocksBurned: 3,
  forestPlanted: 12,
  profit: 1_234_567_890,
  shareUrl: 'https://sawit.example/?estate=ABC-DEFG',
};

describe('the run card', () => {
  it('is five lines: the estate, the ending, the land, the money, the link', () => {
    const lines = buildRunCard(run, t).split('\n');

    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('🌴 Sawit Simulator: estate ABC-DEFG');
    expect(lines[1]).toBe('🏆 Year 9, Certified Penyawit Expert!');
    expect(lines[2]).toBe('🌳 Forest cover 41%  🔥 Burned 3 ha  🌱 Forest planted 12 ha');
    expect(lines[3]).toMatch(/^💰 Operating profit Rp 1[.,]2/);
    expect(lines[4]).toBe('▶ Play the same estate: https://sawit.example/?estate=ABC-DEFG');
  });

  it('calls a negative profit a loss, and keeps the sign out of the figure', () => {
    const line = buildRunCard({ ...run, ending: 'bankrupt', profit: -2_500_000 }, t).split('\n')[3];

    expect(line).toMatch(/^💸 |^💰 /);
    expect(line).toContain('Operating loss Rp 2');
    expect(line).not.toContain('-');
  });

  it('badges every ending without naming the ones the game keeps quiet about', () => {
    for (const ending of [
      'dirty',
      'reboisasi',
      'redemption',
      'fade',
      'banned',
      'arrested',
    ] as const) {
      const card = buildRunCard({ ...run, ending }, t);

      expect(card).not.toContain(ending);
      expect(card.split('\n')[1]).toMatch(/^\p{Extended_Pictographic}/u);
    }
  });
});
