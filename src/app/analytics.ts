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

/** The key the landing page's AI referral tag writes (tools/aiReferral.ts). */
const AI_SOURCE_KEY = 'sawit:ai-source';

/** The assistant that sent this visit, or '' for every other visitor. */
function aiSource(): string {
  try {
    return window.sessionStorage.getItem(AI_SOURCE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function track(event: FunnelEvent): void {
  const { name, ...params } = event;
  const source = aiSource();

  // Clarity takes the name alone, so its recordings can be filtered by funnel step.
  window.clarity?.('event', name);
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, {
    ...params,
    locale: locale(),
    ...(source ? { ai_source: source } : {}),
  });
}
