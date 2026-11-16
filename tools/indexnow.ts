import { SITE_PAGES } from './seo.ts';

/** The shared endpoint: Bing, Yandex, Seznam, Naver and the rest pass a submission on. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** `VITE_INDEXNOW_KEY`, or '' when unset. The protocol allows 8 to 128 of a-z, A-Z, 0-9 and '-'. */
export function normalizeIndexNowKey(raw: string | undefined): string {
  const value = (raw ?? '').trim();

  if (value === '') return '';

  if (!/^[a-zA-Z0-9-]{8,128}$/.test(value)) {
    throw new Error(`VITE_INDEXNOW_KEY must be 8 to 128 letters, digits or dashes, got "${raw}"`);
  }

  return value;
}

/** The key file the build writes at the root, which proves the key belongs to the host. */
export function indexNowKeyFile(key: string): string {
  return `${key}.txt`;
}

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/**
 * One submission for the given paths, every sitemap page by default. A path that is not an
 * indexable page is refused: the game page is noindex, and a typo would only cost quota.
 */
export function indexNowPayload(
  siteUrl: string,
  key: string,
  paths: readonly string[] = SITE_PAGES.map((page) => page.path),
): IndexNowPayload {
  const known = new Set(SITE_PAGES.map((page) => page.path));
  const unknown = paths.filter((path) => !known.has(path));

  if (unknown.length > 0) {
    throw new Error(`Not an indexable page (tools/seo.ts SITE_PAGES): ${unknown.join(', ')}`);
  }

  return {
    host: new URL(siteUrl).host,
    key,
    keyLocation: `${siteUrl}/${indexNowKeyFile(key)}`,
    urlList: paths.map((path) => `${siteUrl}${path}`),
  };
}

/** What the endpoint's status codes mean, from the protocol documentation. */
export function describeIndexNowStatus(status: number): string {
  switch (status) {
    case 200:
      return 'accepted';

    case 202:
      return 'received, key validation pending';

    case 400:
      return 'bad request: the payload is malformed';

    case 403:
      return 'key not valid: the key file is missing or does not hold the key';

    case 422:
      return 'unprocessable: a URL is not on the host, or the key does not match the schema';

    case 429:
      return 'too many requests: wait before submitting again';

    default:
      return `unexpected status ${status}`;
  }
}
