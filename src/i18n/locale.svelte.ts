/**
 * Locale state for the game UI: English and Indonesian. There is no server,
 * so a first-time visitor's country is a guess from the browser: the time
 * zone first (Asia/Jakarta and the other Indonesian zones are a much
 * steadier signal than the browser's language, which install defaults and
 * travel both leave stale), then the browser's own language list. A
 * visitor's own choice always wins from there, and is remembered.
 */

export type Locale = 'en' | 'id';
export const LOCALES: readonly Locale[] = ['en', 'id'];

const STORAGE_KEY = 'sawit:locale';

/** Indonesia's three time zones (WIB, WITA, WIT): the strongest signal a browser gives up for free. */
const ID_TIME_ZONES = new Set(['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura']);

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'id';
}

/** Best guess at a first-time visitor's language: time zone, then browser language, then English. */
export function detectLocale(): Locale {
  try {
    if (ID_TIME_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone)) return 'id';
  } catch {
    // Intl unavailable, or threw on a stub environment (a test runner, say): fall through.
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    if (lang.toLowerCase().startsWith('id')) return 'id';
  }
  return 'en';
}

function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage off: detect fresh every visit.
  }
  return detectLocale();
}

const state = $state({ locale: loadLocale() });
if (typeof document !== 'undefined') document.documentElement.lang = state.locale;

/** The active locale. Reading it inside a component, or a `$derived`, tracks changes to it. */
export function locale(): Locale {
  return state.locale;
}

/** The BCP 47 tag for `Intl` and `toLocale*String`. */
export function localeTag(): string {
  return state.locale === 'id' ? 'id-ID' : 'en-GB';
}

/** A visitor's own choice always wins from here on; Analytics hears about the switch. */
export function setLocale(next: Locale): void {
  const from = state.locale;
  if (next === from) return;
  state.locale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Session-only, then.
  }
  document.documentElement.lang = next;
  window.gtag?.('event', 'change_language', { from, to: next });
}
