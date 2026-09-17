import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { defineConfig, type Plugin } from 'vite';
import checker from 'vite-plugin-checker';

/** Stamped into save manifests (§7). */
const appVersion = JSON.stringify(process.env['npm_package_version'] ?? '0.0.0-dev');

/**
 * The public origin, for the tags crawlers want absolute: canonical, Open
 * Graph image, JSON-LD url, the sitemap. Empty locally, so `__SITE_URL__`
 * resolves to '' (relative URLs), the canonical tag is dropped, and no
 * sitemap is written.
 */
const siteUrl = (process.env['VITE_SITE_URL'] ?? '').replace(/\/$/, '');

function siteUrlPlugin(): Plugin {
  return {
    name: 'sawit-site-url',
    transformIndexHtml(html) {
      let out = html.replaceAll('__SITE_URL__', siteUrl);
      if (!siteUrl) {
        out = out.replace(/^\s*<link rel="canonical"[^>]*>\n?/m, '');
        out = out.replace(/^\s*<link rel="alternate" hreflang=[^>]*>\n?/gm, '');
      }
      return out;
    },
    generateBundle() {
      if (!siteUrl) return;
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...['/', '/id/'].map(
            (path) =>
              `  <url><loc>${siteUrl}${path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>` +
              `<xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/"/>` +
              `<xhtml:link rel="alternate" hreflang="id" href="${siteUrl}/id/"/>` +
              `<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/></url>`,
          ),
          '</urlset>',
          '',
        ].join('\n'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /play.html\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
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
        stringArray: true,
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
        advancedChunks: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
});
