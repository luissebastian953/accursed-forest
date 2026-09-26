import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The pages carrying the Google Analytics snippet, which is every page that ships. */
const PAGES = ['index.html', 'id/index.html', 'play.html'] as const;

function source(page: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${page}`, import.meta.url)), 'utf8');
}

describe.each(PAGES)('the analytics snippet in %s', (page) => {
  const html = source(page);
  const idle = html.indexOf('var go = function');
  const scheduled = html.slice(idle, html.indexOf('</script>', idle));

  it('is there, and does nothing without a measurement id', () => {
    expect(html).toContain("var id = '%VITE_GA_ID%'");
    expect(html).toContain("if (!id || id.charAt(0) === '%') return");
    expect(idle).toBeGreaterThan(0);
  });

  it('installs the queue and the stub synchronously, before anything is scheduled', () => {
    expect(html.indexOf('window.dataLayer = window.dataLayer ||')).toBeLessThan(idle);
    expect(html.indexOf('window.gtag = function')).toBeLessThan(idle);
    expect(html.indexOf("window.gtag('config'")).toBeLessThan(idle);
  });

  it('never touches gtag inside the idle callback, where an early event would be lost', () => {
    expect(scheduled).not.toContain('gtag(');
    expect(scheduled).not.toContain('window.dataLayer =');
  });

  it('fetches the library at idle, so it is never in the critical path', () => {
    expect(scheduled).toContain('googletagmanager.com/gtag/js?id=');
    expect(scheduled).toContain('requestIdleCallback(go');
    expect(scheduled).toContain('setTimeout(go');
  });
});
