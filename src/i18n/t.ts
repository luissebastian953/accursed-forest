import { lookup } from './catalog.ts';
import { locale } from './locale.svelte.ts';

export function t(key: string, vars?: Record<string, string | number>): string {
  const message = lookup(locale(), key) ?? lookup('en', key) ?? key;

  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
