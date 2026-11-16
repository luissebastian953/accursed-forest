import { locale } from '../i18n/index.ts';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/** The funnel, as Google Analytics 4 events. Every value is an enum or a number: no free text. */
export type FunnelEvent =
  | { name: 'game_start'; resumed: boolean }
  | { name: 'tutorial_done'; how: 'finished' | 'skipped' }
  | { name: 'first_harvest'; year: number }
  | { name: 'year_closed'; year: number; profit_sign: 'profit' | 'loss' }
  | { name: 'run_ended'; ending: string; year: number }
  | { name: 'share'; method: 'copy' | 'share' | 'link' };

export function track(event: FunnelEvent): void {
  const { name, ...params } = event;

  // Clarity takes the name alone, so its recordings can be filtered by funnel step.
  window.clarity?.('event', name);
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, { ...params, locale: locale() });
}
