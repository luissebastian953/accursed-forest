import { describe, expect, it } from 'vitest';

import {
  normalizeSiteUrl,
  renderRobots,
  renderSitemap,
  SITE_IMAGES,
  SITE_PAGES,
  type SitePage,
  verificationMeta,
} from '../../tools/seo.ts';

const SITE = 'https://sawit.example';
const DATES: Record<string, string> = {
  'index.html': '2026-09-17T16:40:12+07:00',
  'id/index.html': '2026-09-15T09:00:00+07:00',
};
const EXPLAINER_PAIRS: [string, string][] = [
  ['/guide/when-does-oil-palm-bear-fruit/', '/id/panduan/berapa-lama-sawit-berbuah/'],
  ['/guide/rhinoceros-beetle-oil-palm/', '/id/panduan/kumbang-tanduk-sawit/'],
  ['/guide/ganoderma-oil-palm/', '/id/panduan/ganoderma-kelapa-sawit/'],
  ['/guide/oil-palm-replanting-cost/', '/id/panduan/biaya-replanting-sawit/'],
];
const sitemap = renderSitemap(SITE, (page) => DATES[page.file] ?? '2026-10-15T12:00:00+07:00');

/** The `<url>` block for one page. */
function urlBlock(path: string, from = sitemap): string {
  const blocks = from.split('<url>').slice(1);
  const block = blocks.find((b) => b.includes(`<loc>${SITE}${path}</loc>`));

  expect(block, path).toBeDefined();
  return block!;
}

/** Every hreflang alternate in a `<url>` block, as `lang -> href`. */
function alternates(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
}

describe('the sitemap', () => {
  it('lists exactly the indexable pages, absolute, and never the game page', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const pages = locs.filter((loc) => !SITE_IMAGES.some((image) => loc!.endsWith(image)));

    expect(pages).toEqual(SITE_PAGES.map((page) => `${SITE}${page.path}`));
    expect(pages).toContain(`${SITE}/`);
    expect(pages).toContain(`${SITE}/id/`);
    expect(pages).toHaveLength(18);
    expect(sitemap).not.toContain('play.html');
  });

  it('pairs every page with a twin in its own group, the explainers included', () => {
    for (const page of SITE_PAGES) {
      const group = SITE_PAGES.filter((p) => p.group === page.group);

      expect(group.map((p) => p.lang).sort(), page.path).toEqual(['en', 'id']);
    }

    expect(new Set(SITE_PAGES.map((p) => p.path)).size).toBe(SITE_PAGES.length);
  });

  it('dates each page by its own last change', () => {
    expect(urlBlock('/')).toContain('<lastmod>2026-09-17T16:40:12+07:00</lastmod>');
    expect(urlBlock('/id/')).toContain('<lastmod>2026-09-15T09:00:00+07:00</lastmod>');
  });

  it('gives the landing pages the full hreflang set: itself, its twin, and x-default', () => {
    for (const path of ['/', '/id/']) {
      const block = urlBlock(path);

      expect(block).toContain(`hreflang="en" href="${SITE}/"`);
      expect(block).toContain(`hreflang="id" href="${SITE}/id/"`);
      expect(block).toContain(`hreflang="x-default" href="${SITE}/"`);
    }
  });

  it('declares alternates only within a group, with x-default on the English page of the group', () => {
    for (const page of SITE_PAGES) {
      const en = SITE_PAGES.find((p) => p.group === page.group && p.lang === 'en')!;
      const id = SITE_PAGES.find((p) => p.group === page.group && p.lang === 'id')!;

      expect(alternates(urlBlock(page.path)), page.path).toEqual({
        en: `${SITE}${en.path}`,
        id: `${SITE}${id.path}`,
        'x-default': `${SITE}${en.path}`,
      });
    }
  });

  it('never calls a third subject an alternate of the guide', () => {
    const pages: SitePage[] = [
      { path: '/guide/', file: 'g.html', lang: 'en', group: 'guide' },
      { path: '/id/panduan/', file: 'gi.html', lang: 'id', group: 'guide' },
      { path: '/glossary/', file: 'l.html', lang: 'en', group: 'glossary' },
      { path: '/id/istilah/', file: 'li.html', lang: 'id', group: 'glossary' },
    ];
    const map = renderSitemap(SITE, () => '2026-01-01', pages);
    const guide = urlBlock('/guide/', map);

    expect(guide).toContain(`hreflang="id" href="${SITE}/id/panduan/"`);
    expect(guide).toContain(`hreflang="x-default" href="${SITE}/guide/"`);
    expect(guide).not.toContain('/id/istilah/');
    expect(guide).not.toContain('/glossary/');
    expect(urlBlock('/id/istilah/', map)).not.toContain('/guide/');
    expect(urlBlock('/id/istilah/', map)).toContain(
      `hreflang="x-default" href="${SITE}/glossary/"`,
    );
  });

  it('keeps hreflang inside a group: an explainer pair is never an alternate of the guide', () => {
    for (const [en, id] of EXPLAINER_PAIRS) {
      for (const path of [en, id]) {
        expect(alternates(urlBlock(path)), path).toEqual({
          en: `${SITE}${en}`,
          id: `${SITE}${id}`,
          'x-default': `${SITE}${en}`,
        });
      }

      expect(urlBlock('/guide/')).not.toContain(en);
      expect(urlBlock('/id/panduan/')).not.toContain(id);
    }
  });

  it('points x-default at the page itself when a group has no English page', () => {
    const odd = renderSitemap(SITE, () => '2026-01-01', [
      { path: '/id/a/', file: 'a.html', lang: 'id', group: 'a' },
      { path: '/id/b/', file: 'b.html', lang: 'id', group: 'b' },
      { path: '/b/', file: 'b-en.html', lang: 'en', group: 'b' },
    ]);
    const [a, b] = odd.split('<url>').slice(1);

    expect(a).toContain(`hreflang="x-default" href="${SITE}/id/a/"`);
    expect(a).not.toContain('/id/b/');
    expect(b).toContain(`hreflang="en" href="${SITE}/b/"`);
    expect(b).toContain(`hreflang="x-default" href="${SITE}/b/"`);
  });

  it('lists the screenshot and the share image only on the pages that show them', () => {
    for (const page of SITE_PAGES) {
      const block = urlBlock(page.path);

      if (page.images) {
        expect(block).not.toContain('<image:image>');
        continue;
      }

      for (const image of SITE_IMAGES) {
        expect(block).toContain(`<image:loc>${SITE}${image}</image:loc>`);
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
      { path: '/?a=1&b=2', file: 'x.html', lang: 'en', group: 'odd' },
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
