import { describe, expect, it } from 'vitest';

import type { ChronicleEntry, NewsItem } from '../../src/sim/types.ts';
import { chronicleTitle, formatsFor, newsText } from '../../src/ui/newsText.ts';

const item: NewsItem = {
  key: 'authority.operatingBan',
  tick: 400,
  lane: 'government',
  severity: 'critical',
  title: 'The estate is shut',
  body: 'Until year 3, day 5.',
  effects: ['No clearing'],
  pick: { title: 0, body: 0 },
  vars: { until: 724 },
};

describe('a headline in the reader’s language', () => {
  it('is the sim’s own English for an English reader, untouched', () => {
    expect(newsText('en', item, 42)).toEqual({
      title: item.title,
      body: item.body,
      effects: item.effects,
    });
  });

  it('falls back to the English when the catalog has no line for the template', () => {
    expect(newsText('id', { ...item, key: 'no.such.template' }, 42).title).toBe(item.title);
  });

  it('keeps an old save’s headline readable: no pick, no vars, no translation', () => {
    const { pick: _pick, vars: _vars, ...old } = item;

    expect(newsText('id', old, 42).body).toBe(item.body);
  });

  it('says a date, a block and a sum the Indonesian way', () => {
    const f = formatsFor('id');

    expect(f.date(724)).toBe('Tahun 3, Hari 5');
    expect(f.block('4, 7')).toBe('petak 4, 7');
    expect(f.money(1234567)).toBe('Rp 1.234.567');
  });
});

describe('a chronicle line', () => {
  const estate = (key: string, vars: Record<string, string | number>): ChronicleEntry => ({
    tick: 10,
    lane: 'estate',
    severity: 'notice',
    title: 'the English the sim wrote',
    key,
    vars,
  });

  it('lists blocks the way the locale counts them', () => {
    expect(chronicleTitle('id', estate('forestChopped', { blocks: '4, 7' }), 1)).toBe(
      'Hutan ditebang di petak 4, 7',
    );
    expect(chronicleTitle('en', estate('forestChopped', { blocks: '4, 7' }), 1)).toBe(
      'the English the sim wrote',
    );
    expect(
      chronicleTitle('id', estate('burnedToClear', { blocks: '1, 1; 1, 2; 1, 3; 1, 4' }), 1),
    ).toBe('4 petak dibakar untuk dibuka');
  });

  it('closes a year in rupiah millions, in either direction', () => {
    expect(chronicleTitle('id', estate('yearClosedLoss', { year: 2, rp: 35, ha: 3 }), 1)).toBe(
      'Tahun 2 ditutup: rugi Rp 35 juta, 3 ha berbuah',
    );
  });

  it('leaves a line alone when it has no key, which is every line from before the catalog', () => {
    const { key: _key, vars: _vars, ...old } = estate('forestChopped', {});

    expect(chronicleTitle('id', old, 1)).toBe('the English the sim wrote');
  });
});
