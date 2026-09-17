import { describe, expect, it } from 'vitest';

import {
  normalizeSiteUrl,
  renderRobots,
  renderSitemap,
  SITE_IMAGES,
  SITE_PAGES,
  verificationMeta,
} from '../../tools/seo.ts';

const SITE = 'https://sawit.example';
const DATES: Record<string, string> = {
  'index.html': '2026-09-17T16:40:12+07:00',
  'id/index.html': '2026-09-15T09:00:00+07:00',
};
const sitemap = renderSitemap(SITE, (page) => DATES[page.file]!);

/** The `<url>` block for one page. */
function urlBlock(path: string): string {
  const blocks = sitemap.split('<url>').slice(1);
  const block = blocks.find((b) => b.includes(`<loc>${SITE}${path}</loc>`));
  expect(block, path).toBeDefined();
  return block!;
}

describe('the sitemap', () => {
  it('lists exactly the indexable pages, absolute, and never the game page', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const pages = locs.filter((loc) => !SITE_IMAGES.some((image) => loc!.endsWith(image)));
    expect(pages).toEqual([`${SITE}/`, `${SITE}/id/`]);
    expect(sitemap).not.toContain('play.html');
  });

  it('dates each page by its own last change', () => {
    expect(urlBlock('/')).toContain('<lastmod>2026-09-17T16:40:12+07:00</lastmod>');
    expect(urlBlock('/id/')).toContain('<lastmod>2026-09-15T09:00:00+07:00</lastmod>');
  });

  it('gives every page the full hreflang set: itself, its twin, and x-default', () => {
    for (const page of SITE_PAGES) {
      const block = urlBlock(page.path);
      expect(block).toContain(`hreflang="en" href="${SITE}/"`);
      expect(block).toContain(`hreflang="id" href="${SITE}/id/"`);
      expect(block).toContain(`hreflang="x-default" href="${SITE}/"`);
    }
  });

  it('lists the screenshot and the share image for image search', () => {
    for (const page of SITE_PAGES) {
      for (const image of SITE_IMAGES) {
        expect(urlBlock(page.path)).toContain(`<image:loc>${SITE}${image}</image:loc>`);
      }
    }
  });

  it('declares every namespace it uses, and carries nothing Google ignores', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemap).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(sitemap).not.toMatch(/changefreq|priority/);
  });

  it('escapes what XML cannot hold', () => {
    const odd = renderSitemap(SITE, () => '2026-01-01', [
      { path: '/?a=1&b=2', file: 'x.html', lang: 'en' },
    ]);
    expect(odd).toContain('<loc>https://sawit.example/?a=1&amp;b=2</loc>');
  });
});

describe('robots.txt', () => {
  it('allows everything, the game page included, so its noindex can be read', () => {
    const robots = renderRobots(SITE);
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).not.toContain('Disallow');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('writes no sitemap line without an origin: robots.txt needs an absolute URL there', () => {
    expect(renderRobots('')).toBe('User-agent: *\nAllow: /\n');
  });
});

describe('VITE_SITE_URL', () => {
  it('comes back as a bare origin, or empty when unset', () => {
    expect(normalizeSiteUrl(undefined)).toBe('');
    expect(normalizeSiteUrl('  ')).toBe('');
    expect(normalizeSiteUrl('https://sawit.example/')).toBe('https://sawit.example');
    expect(normalizeSiteUrl('https://Sawit.Example')).toBe('https://sawit.example');
  });

  it('fails loudly on a value that would point canonicals somewhere wrong', () => {
    expect(() => normalizeSiteUrl('sawit.example')).toThrow(/absolute URL/);
    expect(() => normalizeSiteUrl('ftp://sawit.example')).toThrow(/https/);
    expect(() => normalizeSiteUrl('https://sawit.example/game')).toThrow(/bare origin/);
  });
});

describe('Search Console verification', () => {
  it('renders the meta tag with the token escaped', () => {
    expect(verificationMeta(' abc"123 ')).toBe(
      '<meta name="google-site-verification" content="abc&quot;123" />',
    );
  });
});
