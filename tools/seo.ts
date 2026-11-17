export interface SitePage {
  /** Path under the origin, with the trailing slash the canonical tag uses. */
  path: string;
  /** The HTML source, whose last commit dates the page. */
  file: string;
  /** hreflang for this page. */
  lang: string;
  /** Pages in one group are translations of each other; hreflang never crosses groups. */
  group: string;
  /** The content images this page shows, when not `SITE_IMAGES`. */
  images?: readonly string[];
}

/** The explainers, as English slug and Indonesian slug; the English slug names the group. */
export const EXPLAINERS: readonly (readonly [string, string])[] = [
  ['when-does-oil-palm-bear-fruit', 'berapa-lama-sawit-berbuah'],
  ['rhinoceros-beetle-oil-palm', 'kumbang-tanduk-sawit'],
  ['ganoderma-oil-palm', 'ganoderma-kelapa-sawit'],
  ['oil-palm-replanting-cost', 'biaya-replanting-sawit'],
  ['oil-palm-fertilizer-dose', 'dosis-pupuk-sawit'],
  ['oil-palm-spacing', 'jarak-tanam-sawit'],
  ['karhutla-land-fires-oil-palm', 'karhutla-bakar-lahan-sawit'],
];

/**
 * The indexable pages: twelve translation pairs, the five companion pages and the seven
 * explainers. `play.html` is `noindex` and stays out: a sitemap lists only canonical pages.
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
  ...EXPLAINERS.flatMap(([en, id]) => [
    { path: `/guide/${en}/`, file: `guide/${en}/index.html`, lang: 'en', group: en, images: [] },
    {
      path: `/id/panduan/${id}/`,
      file: `id/panduan/${id}/index.html`,
      lang: 'id',
      group: en,
      images: [],
    },
  ]),
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
 * A page's hreflang set: its translations, itself included, plus x-default, which is the
 * group's English page when there is one and the page itself otherwise.
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
      ...(page.images ?? images).map(
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
 * The answer engines' crawlers, named so a later `Disallow` under `*` cannot shut them out
 * by accident. Training, search and user-fetch agents alike; Bingbot and Googlebot ride `*`.
 */
export const AI_CRAWLERS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'DuckAssistBot',
  'MistralAI-User',
  'CCBot',
];

/**
 * robots.txt allows everything: a blocked game page could never show its `noindex`, and a
 * linked URL could still be indexed bare. The sitemap line waits for a known origin.
 */
export function renderRobots(siteUrl: string): string {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    ...AI_CRAWLERS.map((agent) => `User-agent: ${agent}`),
    'Allow: /',
  ];

  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** What a page says about itself in its head. */
export interface PageHead {
  title: string;
  description: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim();
}

/** A page's `<title>` and meta description as plain text, empty when missing. */
export function readHead(html: string): PageHead {
  return {
    title: decodeHtml(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? ''),
    description: decodeHtml(
      /<meta\s+name="description"\s+content="([\s\S]*?)"/.exec(html)?.[1] ?? '',
    ),
  };
}

const LLMS_SECTIONS: readonly { lang: string; heading: string }[] = [
  { lang: 'en', heading: 'English' },
  { lang: 'id', heading: 'Bahasa Indonesia' },
];

/**
 * `/llms.txt` (llmstxt.org): the site as an assistant would summarise it, every indexable
 * page linked with its own title and description, so it cannot drift from the pages.
 */
export function renderLlmsTxt(
  siteUrl: string,
  headOf: (page: SitePage) => PageHead,
  pages: readonly SitePage[] = SITE_PAGES,
): string {
  const home = pages.find((p) => p.path === '/') ?? pages[0]!;
  const sections = LLMS_SECTIONS.flatMap(({ lang, heading }) => [
    '',
    `## ${heading}`,
    '',
    ...pages
      .filter((p) => p.lang === lang)
      .map((p) => {
        const head = headOf(p);

        return `- [${head.title}](${siteUrl}${p.path}): ${head.description}`;
      }),
  ]);

  return [
    '# Sawit Simulator',
    '',
    `> ${headOf(home).description}`,
    '',
    'A free, single-player management game that runs in the web browser (WebGPU, with a',
    'WebGL 2 fallback), in English and Bahasa Indonesia. Nothing to install and no account:',
    'saves stay in the browser. The officials in the game are invented; the explainers and',
    'the accuracy page below say what the game takes from real oil-palm agronomy.',
    '',
    `Play it at ${siteUrl}/play.html`,
    ...sections,
    '',
  ].join('\n');
}

/** The search engines whose ownership tag the build can write: Search Console and Bing. */
export type VerificationName = 'google-site-verification' | 'msvalidate.01';

/** A search engine's ownership tag, for the head of every page but the game. */
export function verificationMeta(name: VerificationName, token: string): string {
  return `<meta name="${name}" content="${escapeXml(token.trim())}" />`;
}
