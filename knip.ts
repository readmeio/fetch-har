import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreDependencies: [
    'eslint-plugin-readme', // This is used in our Oxlint config through another dependency.
  ],

  oxfmt: {
    config: ['oxfmt.config.ts'],
  },

  oxlint: {
    config: ['oxlint.config.ts'],
  },

  vitest: {
    config: ['vitest.config.mts'],
    entry: ['test/**/*.ts'],
  },
};

export default config;
