import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { defineConfig, type Plugin } from 'vite';
import checker from 'vite-plugin-checker';

import { normalizeSiteUrl, renderRobots, renderSitemap, verificationMeta } from './tools/seo.ts';

/** Stamped into save manifests (§7). */
const appVersion = JSON.stringify(process.env['npm_package_version'] ?? '0.0.0-dev');

/**
 * The public origin, for the tags crawlers want absolute: canonical, hreflang,
 * Open Graph image, JSON-LD url, the sitemap. Empty locally, so `__SITE_URL__`
 * resolves to '' (relative URLs), the canonical and hreflang tags are dropped,
 * and no sitemap is written. A malformed value fails the build.
 */
const siteUrl = normalizeSiteUrl(process.env['VITE_SITE_URL']);
/** The Search Console "HTML tag" token, if ownership is verified that way. */
const googleVerification = (process.env['VITE_GOOGLE_SITE_VERIFICATION'] ?? '').trim();

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
    transformIndexHtml(html, ctx) {
      let out = html.replaceAll('__SITE_URL__', siteUrl);
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
 * Production hardening: the game's own chunks are obfuscated on top of
 * minification, and no source maps ship. three.js is left alone (public code,
 * and by far the largest chunk). Only the cheap transforms are on: string
 * literals move into an encoded, rotated array and identifiers become hex;
 * control-flow flattening, dead-code injection, self-defending and debug
 * protection stay off because they cost frame time in the sim's hot loops and
 * fight the minifier. `VITE_OBFUSCATE=0` turns it off for a readable build.
 *
 * Honest limit: the browser runs whatever it downloads, so nothing here
 * "encrypts" the game; it raises the cost of reading and reusing the code.
 */
const obfuscate = process.env['VITE_OBFUSCATE'] !== '0';
/**
 * The string array halves the sim's tick rate (measured: 24.8 to 12.5 days a
 * second at 50×): every literal in the per-block loops becomes a call and a
 * lookup. So it applies only to the app and UI chunks, where the strings are
 * copy and markup; the sim, the loop and the mesher get the rest of the pass.
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
    // Vite 8 resolves the `@sim/*` style aliases from tsconfig natively, but
    // only for imports made from TypeScript; a `.svelte` file's imports go
    // through the plain resolver, so the same map is spelled out here.
    tsconfigPaths: true,
    alias: Object.fromEntries(
      ['app', 'sim', 'render', 'ui', 'input', 'persistence', 'workers', 'shared'].map((layer) => [
        `@${layer}`,
        fileURLToPath(new URL(`./src/${layer}`, import.meta.url)),
      ]),
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
      // Two pages: the static landing page and the game.
      input: { index: 'index.html', id: 'id/index.html', play: 'play.html' },
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
