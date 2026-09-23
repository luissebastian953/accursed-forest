# Backlog

Work that is understood but not done, so it is not carried in someone's head.
An item earns a place here by being specific enough to start: what, where, and
why it matters. Anything already decided against belongs in an
[ADR](adr/) instead.

## Search: more than two indexable pages

The site has exactly two pages a crawler may index, `/` and `/id/`, which is
the ceiling on what it can ever rank for. Three translation pairs would take it
to eight, each aimed at something people actually search:

| Page     | Paths                               | Aimed at                                                             |
| -------- | ----------------------------------- | -------------------------------------------------------------------- |
| Guide    | `/guide/`, `/id/panduan/`           | "how to play", "cara bermain": the loop, the Kopdes, the certificate |
| Glossary | `/glossary/`, `/id/istilah/`        | "apa itu TBS", "sertifikasi sawit", "kopdes", "reboisasi"            |
| Endings  | `/endings/`, `/id/akhir-permainan/` | "all endings", "semua ending": the eight ways a run ends             |

The glossary is the one with real search demand, and the game already defines
every term it would cover.

Each page needs its own title, description, JSON-LD and Open Graph, an entry in
`SITE_PAGES` (`tools/seo.ts`) and in `rollupOptions.input` (`vite.config.ts`),
and a link from both landing pages.

**One change the plumbing needs first.** `SitePage` has no translation group, so
hreflang treats every page as an alternate of every other. That is correct for
two pages that are translations of each other and wrong the moment a third
subject exists: it would tell Google that `/id/istilah/` is the Indonesian
version of `/guide/`. Add a group key to `SitePage`, use it in `renderSitemap`,
and pin it in `tests/tools/seo.test.ts`.

Thin pages are worse than no pages, so each wants 400 to 800 words of real
content, and the Indonesian written properly rather than mirrored.

## Dead rules the code still carries

Found while writing the design document, recorded there and unfixed:

- `Block.bannedUntil` is read by `ChopBlock`, `BurnBlock` and `PlantBlock`, is
  initialised to -1, and is never set anywhere. Only the estate-wide
  `operatingBanUntil` bans anything today. Either wire it to something (a
  per-block sanction) or take it out, including from the save schema.
- The `plague.start` headline says Ganoderma spread "doubles" on a plagued
  block. `GANODERMA.plagueSpreadFactor` is 1.6. One of the two is wrong.
- `TIMBER_VALUE.protected` prices timber for a biome that is never `clearable`,
  so it can never pay out. Harmless, and misleading to read.

## Hosting

- `www.sawitsimulator.com` does not resolve. The apex is a CNAME to EdgeOne, so
  add `www` as its own CNAME or a redirect to the apex.
- The deploy runs from the host's own git build, which ships whatever compiles,
  tests or no tests. The workflow that deploys from CI after a green suite is
  written and parked; wiring it needs `EDGEONE_API_TOKEN` as a repository
  secret.
- `/play.html` carries `noindex`, so a shared game link can never rank. That was
  deliberate, the page being a boot shell, but it is worth revisiting if the
  game URL is what people pass around.

## Interface

- The certificate panel's footer still reads "Complete this to win the game"
  under the forest-win banner, which says the certificate is no longer the
  point. The footer should follow the band.
- The icon kit shipped `times.svg`, `speaker-low.svg` and five `hud-pin-*`
  icons that nothing uses yet.
