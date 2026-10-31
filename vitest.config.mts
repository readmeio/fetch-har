import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // httpbin.org allows 2 body-echo requests per second per IP. Files that
    // run together overrun that and the extras come back as 429s. test/setup.ts
    // spaces those requests apart, which only holds if one file runs at a time.
    fileParallelism: false,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      exclude: ['**/dist/**', '**/test/**', '**/tsup.config.ts', '**/vitest.*'],
    },
  },
});
