import { describe, expect, it } from 'vitest';

import { clarityScript, normalizeClarityId } from '../../tools/clarity.ts';

describe('VITE_CLARITY_ID', () => {
  it('comes back trimmed, or empty when unset', () => {
    expect(normalizeClarityId(undefined)).toBe('');
    expect(normalizeClarityId('  ')).toBe('');
    expect(normalizeClarityId(' abc123xyz9 ')).toBe('abc123xyz9');
  });

  it('fails on anything that could break out of the inline script', () => {
    expect(() => normalizeClarityId("abc'; alert(1); '")).toThrow(/VITE_CLARITY_ID/);
    expect(() => normalizeClarityId('https://clarity.ms/abc123')).toThrow(/VITE_CLARITY_ID/);
  });
});

describe('the Clarity tag', () => {
  const html = clarityScript('abc123xyz9');
  const idle = html.indexOf('var go = function');
  const scheduled = html.slice(idle, html.indexOf('};', idle));

  it('installs the queue synchronously, so an early funnel event is kept', () => {
    expect(html.indexOf('w.clarity.q = w.clarity.q ||')).toBeLessThan(idle);
    expect(html.indexOf("w.clarity('set', 'page_language'")).toBeLessThan(idle);
  });

  it('fetches the library at idle, for the project it names', () => {
    expect(scheduled).toContain("'https://www.clarity.ms/tag/' + id");
    expect(scheduled).not.toContain('clarity(');
    expect(html).toContain('requestIdleCallback(go, { timeout: 4000 })');
    expect(html).toContain("})(window, document, 'abc123xyz9');");
  });
});
