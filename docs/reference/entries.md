# Entry points

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/main.ts`

The game's entry (`play.html`). The app is a static import, so Vite writes
`modulepreload` links for it and for three.js into the page and the engine
downloads in parallel with the first script; the dev pages (`?spike`,
`?models`, `?mobs`) stay behind dynamic imports. The boot shell the page
painted comes down once the app has mounted. `index.html` is the static
landing page and loads none of this.

## `src/workbench.ts`

The workbench's entry (`workbench.html`). A development page: it boots the
same renderer and materials the game does, with none of the simulation.

## `src/site/site.css`

The one stylesheet of the static pages: the two landing pages and the eight
companion pages (guide, glossary, endings, accuracy, in English and
Indonesian). Plain CSS, no Tailwind; every page links it from `/src/site/` so
Vite bundles and hashes it once instead of each page carrying an inline copy.

### Notes

- The tokens and the card, nav, hero, step, scene, glossary and FAQ rules are the
  landing page's inline styles moved out unchanged. The `.hero.compact`,
  `.prose`, `.terms`, `.toc` and `.read-more` rules below them are for the
  companion pages, which run text in cards rather than a grid of steps.

## `src/vite-env.d.ts`

The Vite client types, so `import.meta.env` and the asset imports are typed. No
code, and nothing to configure.
