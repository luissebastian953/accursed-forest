export interface SitePage {
  /** Path under the origin, with the trailing slash the canonical tag uses. */
  path: string;
  /** The HTML source, whose last commit dates the page. */
  file: string;
  /** hreflang for this page. */
  lang: string;
  /** The translation group: one subject, one page per language. */
  group: string;
}

/**
 * The indexable pages, in translation pairs. `play.html` is `noindex` and stays out: a
 * sitemap lists only canonical pages meant for search.
 */
export const SITE_PAGES: readonly SitePage[] = [
  { path: '/', file: 'index.html', lang: 'en', group: 'home' },
  { path: '/id/', file: 'id/index.html', lang: 'id', group: 'home' },
  { path: '/guide/', file: 'guide/index.html', lang: 'en', group: 'guide' },
  { path: '/id/panduan/', file: 'id/panduan/index.html', lang: 'id', group: 'guide' },
  { path: '/glossary/', file: 'glossary/index.html', lang: 'en', group: 'glossary' },
  { path: '/id/istilah/', file: 'id/istilah/index.html', lang: 'id', group: 'glossary' },
  { path: '/endings/', file: 'endings/index.html', lang: 'en', group: 'endings' },
  {
    path: '/id/akhir-permainan/',
    file: 'id/akhir-permainan/index.html',
    lang: 'id',
    group: 'endings',
  },
  { path: '/accuracy/', file: 'accuracy/index.html', lang: 'en', group: 'accuracy' },
  { path: '/id/akurasi/', file: 'id/akurasi/index.html', lang: 'id', group: 'accuracy' },
];

/** The language whose page a group's `x-default` points at. */
export const DEFAULT_LANG = 'en';

/** Images for Google Images, listed on every page that shows them. */
export const SITE_IMAGES: readonly string[] = ['/brand/hero-estate-1600.webp', '/og-1200x630.png'];

/**
 * `VITE_SITE_URL` as a bare origin, or '' when unset. Anything else fails the build: a
 * wrong canonical origin quietly tells Google the pages live somewhere else.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');

  if (value === '') return '';

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL like https://example.com, got "${raw}"`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`VITE_SITE_URL must start with https:// (or http://), got "${raw}"`);
  }

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(
      `VITE_SITE_URL must be the bare origin the pages are served from, like ${url.origin}, got "${raw}"`,
    );
  }

  return url.origin;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * One page's hreflang set: its own group, itself included, plus x-default on the group's
 * English page. A page on another subject is never an alternate.
 */
function alternatesOf(
  page: SitePage,
  pages: readonly SitePage[],
): { lang: string; path: string }[] {
  const group = pages.filter((p) => p.group === page.group);
  const fallback = group.find((p) => p.lang === DEFAULT_LANG) ?? page;

  return [
    ...group.map((p) => ({ lang: p.lang, path: p.path })),
    { lang: 'x-default', path: fallback.path },
  ];
}

/**
 * Each page with its date, its group's hreflang set (Google wants all of them on every
 * page) and its images. No `changefreq` or `priority`: Google ignores both.
 */
export function renderSitemap(
  siteUrl: string,
  lastModified: (page: SitePage) => string,
  pages: readonly SitePage[] = SITE_PAGES,
  images: readonly string[] = SITE_IMAGES,
): string {
  const abs = (path: string) => escapeXml(`${siteUrl}${path}`);
  const urls = pages.map((page) =>
    [
      '  <url>',
      `    <loc>${abs(page.path)}</loc>`,
      `    <lastmod>${escapeXml(lastModified(page))}</lastmod>`,
      ...alternatesOf(page, pages).map(
        (alt) => `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${abs(alt.path)}"/>`,
      ),
      ...images.map(
        (image) => `    <image:image><image:loc>${abs(image)}</image:loc></image:image>`,
      ),
      '  </url>',
    ].join('\n'),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * robots.txt allows everything: a blocked game page could never show its `noindex`, and a
 * linked URL could still be indexed bare. The sitemap line waits for a known origin.
 */
export function renderRobots(siteUrl: string): string {
  const lines = ['User-agent: *', 'Allow: /'];

  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** The Search Console ownership tag, for the landing pages' head. */
export function verificationMeta(token: string): string {
  return `<meta name="google-site-verification" content="${escapeXml(token.trim())}" />`;
}
