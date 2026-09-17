import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

/** Stamped into save manifests (§7). */
const appVersion = JSON.stringify(process.env['npm_package_version'] ?? '0.0.0-dev');

export default defineConfig({
  define: { __APP_VERSION__: appVersion },
  plugins: [
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
      input: { index: 'index.html', play: 'play.html' },
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
