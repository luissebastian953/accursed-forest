# Tools

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `tools/balance-sweep.ts`

Headless balance sweep (§5, §10.3): run the scripted player for N years on
a few seeds and print the yearly cash curve.

pnpm sweep # 1 block, 8 years, seeds 1 42 1234
pnpm sweep -- --blocks 2 --years 10 --seeds 7,8,9 --fertilize
pnpm sweep -- --ispo --years 25 --seeds 1,42,1234,7,99 # expanding player, endings (§3.8)
pnpm sweep -- --ispo --spare # ...who never chops forest

## `tools/seo.ts`

What crawlers read about the site besides the pages themselves: the XML
sitemap and robots.txt. Pure string building, so the build (vite.config.ts)
and the unit tests share it; the build supplies the dates.

Both need absolute URLs, so they hang off `VITE_SITE_URL`. Without it the
build still writes a robots.txt (allow everything, no sitemap line) and
skips the sitemap: a sitemap of relative URLs is invalid, not just weak.
