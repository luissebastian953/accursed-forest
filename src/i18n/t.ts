/**
 * `t('panel.key')` looks a message up in the active locale, falls back to
 * English (a missing translation should never blank a label), and falls
 * back to the key itself if even English is missing (a mistyped key reads
 * as itself in the UI, not as an empty string).
 *
 * `{name}`-style placeholders are filled from the second argument:
 * `t('epilogue.chronicleCount', { count: 12 })`.
 */

import { lookup } from './catalog.ts';
import { locale } from './locale.svelte.ts';

export function t(key: string, vars?: Record<string, string | number>): string {
  const message = lookup(locale(), key) ?? lookup('en', key) ?? key;
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
