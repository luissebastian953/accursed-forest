import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readHead, SITE_PAGES } from '../../tools/seo.ts';

/** Under what Google shows and what Bing's URL Inspection flags (about 65 and 160). */
const TITLE_MAX = 60;
const DESCRIPTION = { min: 100, max: 155 };

describe.each(SITE_PAGES.map((page) => page.file))('the head of %s', (file) => {
  const html = readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
  const { title, description } = readHead(html);

  it(`has a title of at most ${TITLE_MAX} characters`, () => {
    expect(title.length, title).toBeGreaterThan(0);
    expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
  });

  it(`has a description of ${DESCRIPTION.min} to ${DESCRIPTION.max} characters`, () => {
    expect(description.length, description).toBeGreaterThanOrEqual(DESCRIPTION.min);
    expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION.max);
  });
});
