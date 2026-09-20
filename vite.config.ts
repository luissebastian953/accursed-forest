import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { defineConfig, type Plugin } from 'vite';
import checker from 'vite-plugin-checker';

import { normalizeSiteUrl, renderRobots, renderSitemap, verificationMeta } from './tools/seo.ts';

/** Stamped into save manifests (GDD 7). */
const appVersion = JSON.stringify(process.env['npm_package_version'] ?? '0.0.0-dev');

/**
 * The public origin, for the tags crawlers want absolute. Empty locally, which
 * drops those tags and the sitemap; a malformed value fails the build.
 */
const siteUrl = normalizeSiteUrl(process.env['VITE_SITE_URL']);
/** The Search Console "HTML tag" token, if ownership is verified that way. */
const googleVerification = (process.env['VITE_GOOGLE_SITE_VERIFICATION'] ?? '').trim();
/**
 * Where the site is mounted. Empty is the root of a domain; a project host
 * such as GitHub Pages serves under a path (config.md).
 */
const base = `/${(process.env['VITE_BASE'] ?? '').trim().replace(/^\/+|\/+$/g, '')}/`.replace(
  '//',
  '/',
);

/** A page's last commit, so `lastmod` only moves when the page does. */
function lastCommitDate(file: string): string {
  for (const args of [
    ['log', '-1', '--format=%cI', '--', file],
    // A shallow CI checkout may not reach the file's last change.
    ['log', '-1', '--format=%cI'],
  ]) {
    try {
      const date = execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (date) return date;
    } catch {
      // Not a git checkout: fall through to the build date.
    }
  }

  return new Date().toISOString();
}

function siteUrlPlugin(): Plugin {
  return {
    name: 'sawit-site-url',
    // Post, so Vite has already put the base on everything it bundles.
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let out = html
          .replaceAll('__SITE_URL__', siteUrl)
          // The structured data names the build it is describing.
          .replaceAll('__APP_VERSION__', JSON.parse(appVersion) as string);

        // The pages link to `/play.html` and `/id/` by hand, which Vite does not
        // bundle and so does not move; anything it did move already has the base.
        if (base !== '/') {
          out = out.replace(/(href|src)="(\/[^"]*)"/g, (whole, attr: string, url: string) =>
            url.startsWith(base) ? whole : `${attr}="${base}${url.slice(1)}"`,
          );
        }

        if (!siteUrl) {
          out = out.replace(/^\s*<link rel="canonical"[^>]*>\n?/m, '');
          out = out.replace(/^\s*<link rel="alternate" hreflang=[^>]*>\n?/gm, '');
        }

        // Search Console reads the tag from the home page; the game page is noindex.
        if (googleVerification && !ctx.filename.endsWith('play.html')) {
          out = out.replace(
            /(<meta name="viewport"[^>]*>)/,
            `$1\n    ${verificationMeta(googleVerification)}`,
          );
        }

        return out;
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: renderRobots(siteUrl) });

      if (!siteUrl) {
        this.warn(
          'VITE_SITE_URL is not set: no sitemap.xml, no Sitemap line in robots.txt, and no canonical or hreflang tags. Set it for a production build.',
        );
        return;
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(siteUrl, (page) => lastCommitDate(page.file)),
      });
    },
  };
}

/**
 * Production hardening: only the cheap transforms, because the rest cost frame
 * time in the sim's hot loops. Nothing here encrypts the game (GDD, config.md).
 */
const obfuscate = process.env['VITE_OBFUSCATE'] !== '0';
/**
 * The string array halves the sim's tick rate (24.8 to 12.5 days a second at
 * 50x), so only the chunks whose strings are copy and markup get it.
 */
const STRING_ARRAY_CHUNKS = new Set(['App', 'play']);

function obfuscatePlugin(): Plugin {
  return {
    name: 'sawit-obfuscate',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (!obfuscate || chunk.name === 'three') return null;

      const result = JavaScriptObfuscator.obfuscate(code, {
        target: 'browser',
        seed: 7,
        compact: true,
        simplify: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        ignoreImports: true,
        stringArray: STRING_ARRAY_CHUNKS.has(chunk.name),
        stringArrayThreshold: 0.8,
        stringArrayEncoding: ['base64'],
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersType: 'variable',
        splitStrings: false,
        transformObjectKeys: false,
        numbersToExpressions: false,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        selfDefending: false,
        debugProtection: false,
        disableConsoleOutput: false,
        unicodeEscapeSequence: false,
        sourceMap: false,
      });

      return { code: result.getObfuscatedCode(), map: null };
    },
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: appVersion },
  plugins: [
    siteUrlPlugin(),
    svelte(),
    tailwindcss(),
    checker({
      typescript: true,
      eslint: { lintCommand: 'eslint "src/**/*.{ts,svelte}"', useFlatConfig: true },
    }),
    obfuscatePlugin(),
  ],
  resolve: {
    // Vite 8 reads the tsconfig aliases only for imports made from TypeScript,
    // so a `.svelte` file's imports need the same map spelled out below.
    tsconfigPaths: true,
    alias: Object.fromEntries(
      ['app', 'sim', 'render', 'ui', 'input', 'persistence', 'workers', 'shared', 'audio'].map(
        (layer) => [`@${layer}`, fileURLToPath(new URL(`./src/${layer}`, import.meta.url))],
      ),
    ),
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    // Maps only on request: shipping them hands the source back.
    sourcemap: process.env['VITE_SOURCEMAP'] === '1',
    rollupOptions: {
      // Three pages: the static landing page, the game, and the workbench,
      // a development page that ships but is never indexed or linked.
      input: {
        index: 'index.html',
        id: 'id/index.html',
        play: 'play.html',
        workbench: 'workbench.html',
      },
      output: {
        // three.js in its own long-lived chunk: it changes far less often than
        // the game, and it is the one the boot shell is waiting on.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
});
