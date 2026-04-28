import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/dist/**', '**/test/**', '**/tsup.config.ts', '**/vitest.*'],
    },
  },
});
