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
