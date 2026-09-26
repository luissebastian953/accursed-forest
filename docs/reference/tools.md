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

## `tools/seo.ts`

What crawlers read about the site besides the pages themselves: the XML
sitemap and robots.txt. Pure string building, so the build (vite.config.ts)
and the unit tests share it; the build supplies the dates.

Both need absolute URLs, so they hang off `VITE_SITE_URL`. Without it the
build still writes a robots.txt (allow everything, no sitemap line) and
skips the sitemap: a sitemap of relative URLs is invalid, not just weak.

### Notes

- `SITE_PAGES`: the indexable pages, the landing page and its Indonesian
  twin, each a translation of the other. `play.html` is the game behind a
  `noindex` tag and stays out; a sitemap lists only canonical pages meant for
  search.
- `normalizeSiteUrl()`: returns `VITE_SITE_URL` as an origin with no trailing
  slash, or `''` when unset. Anything else fails the build: a wrong canonical
  origin quietly tells Google the pages live somewhere else.
- `renderSitemap()`: every page with its last-modified date, its full set of
  language alternates (each page lists all of them, itself included, plus
  `x-default`, as Google requires for hreflang in sitemaps), and its images.
  No `changefreq` or `priority`: Google ignores both.
- `renderRobots()`: crawl everything. The game page is not blocked on
  purpose: a blocked page cannot be fetched, so its `noindex` would never be
  seen and a linked URL could still be indexed bare. The sitemap line needs
  an absolute URL, so it is only written when the origin is known.
