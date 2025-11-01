import { defineConfig } from 'vitest/config';

// biome-ignore lint/style/noDefaultExport: Vitest requires a default export.
export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/dist/**', '**/test/**', '**/tsup.config.ts', '**/vitest.*'],
    },
  },
});
