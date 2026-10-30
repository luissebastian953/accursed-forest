import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
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
          out = out.replace(/^\s*<link\s+rel="canonical"[^>]*>\n?/m, '');
          out = out.replace(/^\s*<link\s+rel="alternate"\s+hreflang=[^>]*>\n?/gm, '');
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
    // Maps only on request: a deployment is debugged with VITE_SOURCEMAP=1.
    sourcemap: process.env['VITE_SOURCEMAP'] === '1',
    rollupOptions: {
      // The indexable pages (tools/seo.ts), the game, and the workbench, a
      // development page that ships but is never indexed or linked.
      input: {
        index: 'index.html',
        id: 'id/index.html',
        guide: 'guide/index.html',
        'id-panduan': 'id/panduan/index.html',
        glossary: 'glossary/index.html',
        'id-istilah': 'id/istilah/index.html',
        endings: 'endings/index.html',
        'id-akhir-permainan': 'id/akhir-permainan/index.html',
        accuracy: 'accuracy/index.html',
        'id-akurasi': 'id/akurasi/index.html',
        panduanBerbuah: 'id/panduan/berapa-lama-sawit-berbuah/index.html',
        panduanKumbang: 'id/panduan/kumbang-tanduk-sawit/index.html',
        panduanGanoderma: 'id/panduan/ganoderma-kelapa-sawit/index.html',
        panduanReplanting: 'id/panduan/biaya-replanting-sawit/index.html',
        panduanKarhutla: 'id/panduan/karhutla-bakar-lahan-sawit/index.html',
        guideBearFruit: 'guide/when-does-oil-palm-bear-fruit/index.html',
        guideBeetle: 'guide/rhinoceros-beetle-oil-palm/index.html',
        guideGanoderma: 'guide/ganoderma-oil-palm/index.html',
        guideReplanting: 'guide/oil-palm-replanting-cost/index.html',
        guideFertilizer: 'guide/oil-palm-fertilizer-dose/index.html',
        guideSpacing: 'guide/oil-palm-spacing/index.html',
        panduanPupuk: 'id/panduan/dosis-pupuk-sawit/index.html',
        panduanJarak: 'id/panduan/jarak-tanam-sawit/index.html',
        guideKarhutla: 'guide/karhutla-land-fires-oil-palm/index.html',
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
