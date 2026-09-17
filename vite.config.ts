import tailwindcss from '@tailwindcss/vite';
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

export default defineConfig({
  define: { __APP_VERSION__: appVersion },
  plugins: [
    siteUrlPlugin(),
    tailwindcss(),
    checker({
      typescript: true,
      eslint: { lintCommand: 'eslint "src/**/*.ts"', useFlatConfig: true },
    }),
  ],
  resolve: {
    // Vite 8 resolves the `@sim/*` style aliases from tsconfig natively.
    tsconfigPaths: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
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
