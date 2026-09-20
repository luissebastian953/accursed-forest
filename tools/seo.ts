export interface SitePage {
  /** Path under the origin, with the trailing slash the canonical tag uses. */
  path: string;
  /** The HTML source, whose last commit dates the page. */
  file: string;
  /** hreflang for this page. */
  lang: string;
}

/**
 * The indexable pages, the landing page and its Indonesian twin. `play.html` is `noindex`
 * and stays out: a sitemap lists only canonical pages meant for search.
 */
export const SITE_PAGES: readonly SitePage[] = [
  { path: '/', file: 'index.html', lang: 'en' },
  { path: '/id/', file: 'id/index.html', lang: 'id' },
];

/** Where hreflang sends a searcher whose language has no page of its own. */
export const DEFAULT_PAGE_PATH = '/';

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
 * Each page with its date, every hreflang alternate plus x-default (Google wants all of them
 * on every page) and its images. No `changefreq` or `priority`: Google ignores both.
 */
export function renderSitemap(
  siteUrl: string,
  lastModified: (page: SitePage) => string,
  pages: readonly SitePage[] = SITE_PAGES,
  images: readonly string[] = SITE_IMAGES,
): string {
  const abs = (path: string) => escapeXml(`${siteUrl}${path}`);
  const alternates = [
    ...pages.map((page) => ({ lang: page.lang, path: page.path })),
    { lang: 'x-default', path: DEFAULT_PAGE_PATH },
  ];
  const urls = pages.map((page) =>
    [
      '  <url>',
      `    <loc>${abs(page.path)}</loc>`,
      `    <lastmod>${escapeXml(lastModified(page))}</lastmod>`,
      ...alternates.map(
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
