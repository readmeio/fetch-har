import type { Options } from 'tsup';

import { defineConfig } from 'tsup';

// biome-ignore lint/style/noDefaultExport: `tsup` requires a default export.
export default defineConfig((options: Options) => ({
  ...options,

  cjsInterop: true,
  clean: true,
  dts: true,
  entry: ['src/index.ts', 'src/types.ts'],
  format: ['esm', 'cjs'],
  minify: false,
  shims: true,
  silent: !options.watch,
  sourcemap: true,
  splitting: true,
}));
