import { defineConfig } from 'tsdown';

export default defineConfig(options => ({
  ...options,

  attw: {
    pack: true,
    format: 'ascii',
    profile: 'node16',
  },
  cjsDefault: true,
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
