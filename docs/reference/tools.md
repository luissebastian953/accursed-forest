# Tools

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `tools/balance-sweep.ts`

Headless balance sweep (GDD 5, GDD 10.3): run the scripted player for N years on
a few seeds and print the yearly cash curve.

pnpm sweep # 1 block, 8 years, seeds 1 42 1234
pnpm sweep -- --blocks 2 --years 10 --seeds 7,8,9 --fertilize
pnpm sweep -- --cert --years 25 --seeds 1,42,1234,7,99 # expanding player, endings (GDD 3.8)
pnpm sweep -- --cert --spare # ...who never chops forest

`--cert` expands to 48 blocks, because the top of the Kopdes ladder asks for 40
bearing ones and a run that stops short of it never certifies (GDD 3.3).

## `tools/clarity.ts`

The Microsoft Clarity tag, as the build writes it into each page: session
recordings, heatmaps, and dead and rage clicks, from Microsoft's free product
analytics. Pure string building, so the build and the unit tests share it.

### Notes

- `normalizeClarityId()`: letters and digits only, or the build fails. The id
  is written into an inline script, so anything else could end it.
- `clarityScript()`: the same shape as the Google Analytics snippet: the
  `clarity` queue is installed at once and the library fetched at idle, so it
  is never in the critical path and a `track()` call that fires first is queued
  rather than lost. It tags every session with `page_language` from
  `<html lang>`, so recordings filter by English and Indonesian.
- Recording starts at idle, so the first second or two of a visit is missing
  from a replay. Clarity snapshots the page when it starts, so the replay
  still opens on the right content.
- Clarity masks input text in its default Balanced mode, which covers the
  estate name. Do not switch the project to Relaxed: the estate name is
  personal data (`src/app/analytics.ts`).
- The game's canvas is not recorded, only its Svelte panels. Since 31 October
  2025 Clarity needs a consent signal (`consentv2`) for visitors from the EEA,
  the UK and Switzerland. The site has no consent banner and sends none, so
  those visitors are recorded without cookies and their sessions are not linked.

## `tools/indexnow.ts`

The IndexNow submission, pure: the key's validation, the key file's name and
the JSON body. IndexNow is how Bing hears about a changed page within minutes
rather than waiting for its next crawl. The shared endpoint passes each
submission on to the other engines on the protocol (Yandex, Seznam, Naver and
the rest). Google is not one of them.

### Notes

- `normalizeIndexNowKey()`: 8 to 128 of a-z, A-Z, 0-9 and `-`, as the protocol
  allows. That rules out a path, so the key file can only land at the root.
- `indexNowPayload()`: every page in `SITE_PAGES` by default, or the paths
  given. A path that is not an indexable page is refused rather than
  submitted: `play.html` is `noindex`, and a typo only spends quota.
- `describeIndexNowStatus()`: 202 is not a failure. It means the key has not
  been validated yet, which is normal on a first submission.

## `tools/indexnow-submit.ts`

`pnpm indexnow`: submits the pages once a deploy is live.

    pnpm indexnow                    # every page in the sitemap
    pnpm indexnow -- /guide/ /id/    # just these
    pnpm indexnow -- --dry-run       # print the body, send nothing

It reads `VITE_SITE_URL` and `VITE_INDEXNOW_KEY` from the environment, or from
`.env` when there is one.

### Notes

- Before submitting, it fetches the live key file with a cache-busting query and
  stops unless that file holds the key. Submitting before the deploy lands
  gets a 403, and EdgeOne's git trigger has failed silently before, so the key
  file is the proof the new build is the one being served.
- Run it after a deploy that changes what a page says, not after every push.
  Resubmitting unchanged URLs does not speed anything up, and the endpoint
  rate-limits with 429.

## `tools/seo.ts`

What crawlers read about the site besides the pages themselves: the XML
sitemap, robots.txt and `/llms.txt`. Pure string building, so the build (vite.config.ts)
and the unit tests share it; the build supplies the dates.

Both need absolute URLs, so they hang off `VITE_SITE_URL`. Without it the
build still writes a robots.txt (allow everything, no sitemap line) and
skips the sitemap: a sitemap of relative URLs is invalid, not just weak.

### Notes

- `SITE_PAGES`: the indexable pages, twelve translation pairs: the landing page,
  the guide, the glossary, the endings and the accuracy page, and the seven
  explainers (`EXPLAINERS`, English slug under `/guide/`, Indonesian under
  `/id/panduan/`, grouped by the English slug). `play.html` is the game behind
  a `noindex` tag and stays out; a sitemap lists only canonical pages meant
  for search.
- `SitePage.group`: the translation group. hreflang alternates are declared
  only within a group, because without it every page was an alternate of every
  other, which was true of two pages that were translations of each other and
  false the moment a third subject existed: it would have told Google that
  `/id/istilah/` was the Indonesian version of `/guide/`. `x-default` points
  at the group's page in `DEFAULT_LANG`, English, or at the page itself when
  the group has no English page.
- `SitePage.images`: the content images a page shows, when they are not
  `SITE_IMAGES`. An explainer shows none, so it lists none: an image sitemap
  entry for an image the page does not carry contradicts the page.
- `normalizeSiteUrl()`: returns `VITE_SITE_URL` as an origin with no trailing
  slash, or `''` when unset. Anything else fails the build: a wrong canonical
  origin quietly tells Google the pages live somewhere else.
- `renderSitemap()`: every page with its last-modified date, its group's set
  of language alternates (each page lists all of them, itself included, plus
  `x-default`, as Google requires for hreflang in sitemaps), and its images.
  No `changefreq` or `priority`: Google ignores both.
- `SITE_IMAGES`: the images the sitemap offers to image search, so every one of
  them is content and owes the page that shows it a real `alt`. The hero used to
  sit in an `aria-hidden` wrapper with an empty `alt` while this list asked
  Google to index it, which is the page and the sitemap contradicting each
  other. `e2e/landing.spec.ts` pins the description on both pages.
- `verificationMeta()`: the ownership tag for Search Console
  (`google-site-verification`) or Bing Webmaster Tools (`msvalidate.01`), the
  token escaped. Both engines read it from the home page.
- `renderRobots()`: crawl everything. The game page is not blocked on
  purpose: a blocked page cannot be fetched, so its `noindex` would never be
  seen and a linked URL could still be indexed bare. The sitemap line needs
  an absolute URL, so it is only written when the origin is known.
- `AI_CRAWLERS`: the answer engines' crawlers (OpenAI, Anthropic, Google's
  Gemini token, Perplexity, Apple, Meta, Amazon, DuckDuckGo, Mistral, Common
  Crawl), named in their own robots.txt group with `Allow: /`. `*` already lets
  them in, so the group changes nothing today; it keeps them in if a `Disallow`
  is ever added under `*`, because a crawler that matches a named group ignores
  `*` entirely. ChatGPT search and Copilot answer from Bing's index and Gemini
  from Google's, so Bingbot and Googlebot stay on `*`. DeepSeek publishes no
  crawler name, so there is nothing to list for it; its training data reaches
  it through Common Crawl, and its search through the engines above.
- `readHead()`: a page's `<title>` and meta description as plain text,
  whitespace collapsed and entities decoded. The build feeds it to `/llms.txt`
  and `tests/tools/headTags.test.ts` holds the lengths to it, so both read the
  head the same way.
- `renderLlmsTxt()`: `/llms.txt` in the llmstxt.org shape: an H1, the landing
  page's description as the summary, a short paragraph of facts (free, in the
  browser, no account, the officials invented), the game's address, then every
  indexable page linked under English and Bahasa Indonesia with its own title
  and description. Built from the pages' heads rather than written by hand, so
  it cannot drift from them. No assistant has promised to read it; it costs one
  small file, and the pages themselves are what the crawlers index.
