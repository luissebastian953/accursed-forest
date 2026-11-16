import { describe, expect, it } from 'vitest';

import {
  describeIndexNowStatus,
  indexNowKeyFile,
  indexNowPayload,
  normalizeIndexNowKey,
} from '../../tools/indexnow.ts';
import { SITE_PAGES } from '../../tools/seo.ts';

const SITE = 'https://sawit.example';
const KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

describe('VITE_INDEXNOW_KEY', () => {
  it('comes back trimmed, or empty when unset', () => {
    expect(normalizeIndexNowKey(undefined)).toBe('');
    expect(normalizeIndexNowKey(` ${KEY} `)).toBe(KEY);
  });

  it('holds to the protocol: 8 to 128 letters, digits or dashes', () => {
    expect(() => normalizeIndexNowKey('short')).toThrow(/VITE_INDEXNOW_KEY/);
    expect(() => normalizeIndexNowKey('has spaces in it')).toThrow(/VITE_INDEXNOW_KEY/);
    expect(() => normalizeIndexNowKey('../../etc/passwd')).toThrow(/VITE_INDEXNOW_KEY/);
    expect(() => normalizeIndexNowKey('x'.repeat(129))).toThrow(/VITE_INDEXNOW_KEY/);
  });
});

describe('the IndexNow submission', () => {
  it('names the key file at the root of the host', () => {
    expect(indexNowKeyFile(KEY)).toBe(`${KEY}.txt`);
    expect(indexNowPayload(SITE, KEY).keyLocation).toBe(`${SITE}/${KEY}.txt`);
    expect(indexNowPayload(SITE, KEY).host).toBe('sawit.example');
  });

  it('submits every indexable page by default, absolute, and never the game page', () => {
    const { urlList } = indexNowPayload(SITE, KEY);

    expect(urlList).toEqual(SITE_PAGES.map((page) => `${SITE}${page.path}`));
    expect(urlList.some((url) => url.includes('play.html'))).toBe(false);
  });

  it('submits only the pages asked for, and refuses one the sitemap does not list', () => {
    expect(indexNowPayload(SITE, KEY, ['/', '/id/']).urlList).toEqual([`${SITE}/`, `${SITE}/id/`]);
    expect(() => indexNowPayload(SITE, KEY, ['/play.html'])).toThrow(/play\.html/);
  });

  it('explains the status codes a submission can come back with', () => {
    expect(describeIndexNowStatus(200)).toBe('accepted');
    expect(describeIndexNowStatus(403)).toMatch(/key file/);
    expect(describeIndexNowStatus(418)).toMatch(/418/);
  });
});
