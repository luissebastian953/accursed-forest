import { GROWTH } from '@sim/balance/growth';
import { ENGLISH, renderWith, type NewsFormats } from '@sim/systems/news';
import type { ChronicleEntry, NewsItem, NewsVars } from '@sim/types';

import { lookup } from '../i18n/catalog.ts';
import type { Locale } from '../i18n/locale.svelte.ts';

export interface NewsText {
  title: string;
  body: string;
  effects: string[];
}

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** How a locale says a block, a date and a sum inside a headline. English is the sim's own. */
export function formatsFor(lang: Locale): NewsFormats {
  if (lang === 'en') return ENGLISH;

  const date = lookup(lang, 'format.date') ?? lookup('en', 'format.date') ?? '{year}/{day}';
  const block = lookup(lang, 'chronicle.blockOne') ?? 'block {labels}';

  return {
    block: (label) => fill(block, { labels: label }),
    date: (tick) =>
      fill(date, {
        year: Math.floor(tick / GROWTH.daysPerYear) + 1,
        day: (tick % GROWTH.daysPerYear) + 1,
      }),
    money: (amount) => `Rp ${rupiah.format(Math.round(amount))}`,
  };
}

const ESTATE_WORD: Record<Locale, string> = { en: 'estate', id: 'kebun' };

/** A headline in the reader's language, or the sim's English when the catalog has no line for it. */
export function newsText(lang: Locale, item: NewsItem, seed: number): NewsText {
  const english: NewsText = { title: item.title, body: item.body, effects: item.effects };

  if (lang === 'en' || !item.pick || !item.vars) return english;

  const title = lookup(lang, `headlines.${item.key}.title.${item.pick.title}`);

  if (title === undefined) return english;

  const body = lookup(lang, `headlines.${item.key}.body.${item.pick.body}`);
  const effects: string[] = [];

  for (let i = 0; ; i++) {
    const effect = lookup(lang, `headlines.${item.key}.effect.${i}`);

    if (effect === undefined) break;
    effects.push(effect);
  }

  const formats = formatsFor(lang);
  const say = (text: string) => renderWith(text, seed, item.vars!, formats, ESTATE_WORD[lang]);

  return {
    title: capitalise(say(title)),
    body: body === undefined ? item.body : say(body),
    effects: effects.length > 0 ? effects.map(say).filter((e) => e.trim() !== '') : item.effects,
  };
}

/** A list of block labels the way the locale says it; the sim joins labels with "; ". */
function blockList(lang: Locale, labels: string): string {
  const names = labels.split('; ').filter((n) => n !== '');
  const key = names.length === 1 ? 'blockOne' : names.length <= 3 ? 'blockSome' : 'blockMany';
  const template = lookup(lang, `chronicle.${key}`) ?? lookup('en', `chronicle.${key}`) ?? '';

  return fill(template, { labels: names.join('; '), n: names.length });
}

/** A chronicle line in the reader's language: a headline by its template, an estate line by its key. */
export function chronicleTitle(lang: Locale, entry: ChronicleEntry, seed: number): string {
  if (lang === 'en' || entry.key === undefined) return entry.title;

  if (entry.lane !== 'estate') {
    if (!entry.pick || !entry.vars) return entry.title;

    const title = lookup(lang, `headlines.${entry.key}.title.${entry.pick.title}`);

    if (title === undefined) return entry.title;
    return capitalise(
      renderWith(title, seed, entry.vars as NewsVars, formatsFor(lang), ESTATE_WORD[lang]),
    );
  }

  const template = lookup(lang, `chronicle.${entry.key}`);

  if (template === undefined) return entry.title;

  const vars: Record<string, string | number> = { ...entry.vars };

  if (typeof vars['blocks'] === 'string') vars['blocks'] = blockList(lang, vars['blocks']);
  return capitalise(fill(template, vars));
}
