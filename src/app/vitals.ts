/**
 * Core Web Vitals from real visitors (§ organic): LCP, INP and CLS, plus
 * FCP and TTFB, sent to Google Analytics 4 as events when `gtag` is on the
 * page, and logged in development so a regression shows up in the console
 * before it shows up in Search Console.
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function send(metric: Metric): void {
  const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value);
  if (typeof window.gtag === 'function') {
    window.gtag('event', metric.name, {
      value,
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
      non_interaction: true,
    });
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- the one place a dev build talks to the console on purpose
    console.debug(`[vitals] ${metric.name} ${metric.value.toFixed(1)} (${metric.rating})`);
  }
}

export function reportVitals(): void {
  onLCP(send);
  onINP(send);
  onCLS(send);
  onFCP(send);
  onTTFB(send);
}
