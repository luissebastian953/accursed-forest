import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('0.0.0-test') },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Several tests play whole 25-year runs across seeds, which a CI runner
    // takes minutes over. Stated here so it does not ride on vitest's default.
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/sim/**', 'src/persistence/**', 'src/shared/**', 'src/render/anim/**'],
    },
  },
});
