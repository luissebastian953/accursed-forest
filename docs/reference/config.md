# Configuration

What the build and lint configuration does, and the reasoning that used to sit in
the files as comments. A `GDD n` reference points into the [design document](../gdd/README.md).

## `.env.example`

The template for a local `.env`. Every variable is optional: with all of them
empty the game builds and runs, and ships no third-party script.

### Notes

- `VITE_GA_ID`: the Google Analytics 4 measurement id, in the form
  `G-XXXXXXXXXX`. Left empty, the pages load no analytics script at all.
- `VITE_SITE_URL`: the site's public origin, such as `https://sawitsimulator.com`.
  A production build that should be indexed needs it: it drives the canonical and
  hreflang tags, the absolute Open Graph and JSON-LD URLs, `sitemap.xml`, and the
  Sitemap line in `robots.txt`. Left empty locally those tags are dropped, no
  sitemap is written, and the build warns. A value that is not a bare http or
  https origin fails the build.
- `VITE_GOOGLE_SITE_VERIFICATION`: ownership for Google Search Console by its
  "HTML tag" method, which is the content value of the
  `<meta name="google-site-verification">` tag it hands out. It is added to both
  landing pages. Leave it empty when ownership is verified by DNS instead.
- `VITE_BASE`: where the site is mounted. Empty is a domain root, which is what
  EdgeOne Pages and any real host give you. A project host such as GitHub Pages
  serves under `/<repo>/`, and the value is that path segment; the build then
  fixes its own hand-written links to `/play.html` and `/id/`.
- `VITE_OBFUSCATE` and `VITE_SOURCEMAP`: production builds obfuscate the game's
  own chunks and ship no source maps. `VITE_OBFUSCATE=0` gives a readable build
  and `VITE_SOURCEMAP=1` emits maps. Both are for debugging a deployed build,
  not for shipping.

## `eslint.config.js`

The lint rules, and the layer boundaries that keep the architecture honest.
`eslint-plugin-boundaries` enforces the rule in GDD 4.1 that arrows point down
only, so a violation is a lint error rather than a review comment.

### Notes

- The layer rule (GDD 4.1): `app` may import ui, render, input, persistence, sim
  and shared; `ui` may import sim read-only and shared; `render`, `input`,
  `persistence` and `workers` may import sim read-only and shared; `sim` may
  import shared and nothing else, never three.js, never the DOM, never timers;
  `shared` imports nothing. `render/` and `ui/` may not import each other, and
  meet in `app/`. `audio` is a leaf that may import shared: it makes noises, it
  does not know what they mean. `shared` has no policy entry of its own, because
  the default of `disallow` already keeps it leaf-level.
- Svelte components are linted syntactically only, for import order and the layer
  boundary. Type-aware rules need a project service that `svelte-check` already
  provides, and running both would duplicate the work.
- `**/*.svelte.ts`: Svelte 5 runes such as `$state` and `$derived` work outside a
  `.svelte` file in a module named `*.svelte.ts`. The plugin's own setup for
  those files sets a parser but not what it hands TypeScript syntax to, so it
  chokes on an ordinary `import { type X } from` and worse. The config points it
  at the real TypeScript parser.
- `@stylistic/padding-line-between-statements`: Prettier never adds a blank line,
  so this rule is where the code's rhythm is set. A blank line goes on both sides
  of anything that ends in a block and around a run of declarations, while `else`
  is part of its `if` and stays on the closing brace. It is auto-fixed, so it
  costs nothing to keep.
- Component filenames are not linted for case: the Svelte files mix a lowercase
  name such as `phone` with PascalCase panels, which is not worth a rule.

## `vite.config.ts`

The build: the three pages, the SEO tags and files, the alias map, the chunking,
and the production obfuscation pass.

### Notes

- `siteUrl`: the public origin, for the tags crawlers want absolute, which are
  canonical, hreflang, the Open Graph image, the JSON-LD url and the sitemap.
  Empty locally, so `__SITE_URL__` resolves to an empty string and URLs stay
  relative, the canonical and hreflang tags are dropped and no sitemap is
  written. A malformed value fails the build.
- `lastCommitDate()`: a shallow CI checkout may not reach a file's last change,
  so the lookup falls back to the repository's most recent commit, and then to
  the build date.
- `obfuscate`: production hardening. The game's own chunks are obfuscated on top
  of minification and no source maps ship; three.js is left alone, being public
  code and by far the largest chunk. Only the cheap transforms are on: string
  literals move into an encoded, rotated array and identifiers become hex.
  Control-flow flattening, dead-code injection, self-defending and debug
  protection stay off, because they cost frame time in the sim's hot loops and
  fight the minifier. `VITE_OBFUSCATE=0` turns the pass off. The honest limit is
  that the browser runs whatever it downloads, so nothing here encrypts the game;
  it raises the cost of reading and reusing the code.
- `STRING_ARRAY_CHUNKS`: the string array halves the sim's tick rate, measured at
  24.8 down to 12.5 days a second at 50x, because every literal in the per-block
  loops becomes a call and a lookup. It is applied only to the app and UI chunks,
  where the strings are copy and markup; the sim, the loop and the mesher get the
  rest of the pass.
- `resolve.tsconfigPaths`: Vite 8 resolves the `@sim/*` style aliases from
  tsconfig natively, but only for imports made from TypeScript. A `.svelte`
  file's imports go through the plain resolver, so the same map is spelled out in
  `alias` as well.
- `build.rollupOptions.input`: three pages ship, the static landing page, the
  game, and the workbench, which is a development page that is never indexed or
  linked. three.js gets its own long-lived chunk: it changes far less often than
  the game, and it is what the boot shell waits on.
