import type { Locale } from './locale.svelte.ts';

const modules = import.meta.glob<Record<string, string>>('./locales/*/*.json', {
  eager: true,
  import: 'default',
});

type Catalog = Record<string, string>;

const catalogs: Record<Locale, Catalog> = { en: {}, id: {} };

const PATH = /\.\/locales\/(en|id)\/([\w-]+)\.json$/;

for (const [path, messages] of Object.entries(modules)) {
  const match = PATH.exec(path);

  if (!match) continue;

  const locale = match[1] as Locale;
  const namespace = match[2];

  for (const [key, value] of Object.entries(messages)) {
    catalogs[locale][`${namespace}.${key}`] = value;
  }
}

export function lookup(locale: Locale, key: string): string | undefined {
  return catalogs[locale][key];
}
