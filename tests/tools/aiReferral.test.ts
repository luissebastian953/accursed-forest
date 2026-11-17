import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AI_SOURCE_KEY, AI_SOURCES, aiReferralScript } from '../../tools/aiReferral.ts';

interface Visit {
  referrer?: string;
  search?: string;
  stored?: string;
  gtag?: boolean;
  clarity?: boolean;
  storage?: boolean;
}

/** Runs the tag as a page would, and returns what it stored and what it told GA4 and Clarity. */
function land(visit: Visit) {
  const store = new Map<string, string>(visit.stored ? [[AI_SOURCE_KEY, visit.stored]] : []);
  const gtag: unknown[][] = [];
  const clarity: unknown[][] = [];
  const sessionStorage = {
    getItem: (k: string) => {
      if (visit.storage === false) throw new Error('blocked');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (visit.storage === false) throw new Error('blocked');
      store.set(k, v);
    },
  };
  const window = {
    location: { search: visit.search ?? '' },
    sessionStorage,
    ...(visit.gtag === false ? {} : { gtag: (...args: unknown[]) => gtag.push(args) }),
    ...(visit.clarity === false ? {} : { clarity: (...args: unknown[]) => clarity.push(args) }),
  };
  const document = { referrer: visit.referrer ?? '' };
  const body = aiReferralScript()
    .replace(/^<script>/, '')
    .replace(/<\/script>$/, '');

  new Function('window', 'document', body)(window, document);
  return { stored: store.get(AI_SOURCE_KEY) ?? '', gtag, clarity };
}

describe('the AI referral tag', () => {
  it('names the assistant from the referrer, subdomains and www included', () => {
    expect(land({ referrer: 'https://chatgpt.com/' }).stored).toBe('chatgpt');
    expect(land({ referrer: 'https://www.perplexity.ai/search/x' }).stored).toBe('perplexity');
    expect(land({ referrer: 'https://gemini.google.com/app' }).stored).toBe('gemini');
    expect(land({ referrer: 'https://claude.ai/chat/1' }).stored).toBe('claude');
    expect(land({ referrer: 'https://chat.deepseek.com/' }).stored).toBe('deepseek');
  });

  it('names it from utm_source when the app strips the referrer', () => {
    expect(land({ search: '?utm_source=chatgpt.com' }).stored).toBe('chatgpt');
    expect(land({ search: '?utm_source=perplexity' }).stored).toBe('perplexity');
  });

  it('leaves every other visitor alone, Google search included', () => {
    for (const referrer of ['', 'https://www.google.com/', 'https://notchatgpt.com/']) {
      const visit = land({ referrer });

      expect(visit.stored, referrer).toBe('');
      expect(visit.gtag, referrer).toEqual([]);
      expect(visit.clarity, referrer).toEqual([]);
    }
  });

  it('reports the arrival to GA4 once and tags the Clarity recording', () => {
    const first = land({ referrer: 'https://claude.ai/' });

    expect(first.gtag).toEqual([['event', 'ai_referral', { ai_source: 'claude' }]]);
    expect(first.clarity).toEqual([['set', 'ai_source', 'claude']]);
    expect(land({ referrer: 'https://claude.ai/', stored: 'claude' }).gtag).toEqual([]);
  });

  it('keeps tagging later pages of the visit, the game among them', () => {
    const play = land({ referrer: 'https://sawitsimulator.com/', stored: 'gemini' });

    expect(play.gtag).toEqual([]);
    expect(play.clarity).toEqual([['set', 'ai_source', 'gemini']]);
  });

  it('still reports the landing with storage blocked, and needs neither tool on the page', () => {
    const blocked = land({ referrer: 'https://chatgpt.com/', storage: false });

    expect(blocked.gtag).toEqual([['event', 'ai_referral', { ai_source: 'chatgpt' }]]);
    expect(() =>
      land({ referrer: 'https://chatgpt.com/', gtag: false, clarity: false }),
    ).not.toThrow();
  });

  it('writes the key the funnel events read, and names sources fit for a GA4 value', () => {
    const app = readFileSync(
      fileURLToPath(new URL('../../src/app/analytics.ts', import.meta.url)),
      'utf8',
    );

    expect(app).toContain(`AI_SOURCE_KEY = '${AI_SOURCE_KEY}'`);

    for (const name of Object.keys(AI_SOURCES)) expect(name).toMatch(/^[a-z_]+$/);
  });
});
