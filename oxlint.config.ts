import oxlintConfig from '@readme/oxlint-config';
import oxlintConfigVitest from '@readme/oxlint-config/testing/vitest';
import oxlintConfigTS from '@readme/oxlint-config/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [oxlintConfig, oxlintConfigTS],
  options: {
    reportUnusedDisableDirectives: 'error',
  },
  ignorePatterns: ['coverage/', 'dist/'],
  env: {
    browser: true,
    commonjs: true,
    es2022: true,
    node: true,
  },
  overrides: [
    {
      files: ['test/**/*.test.{js,ts}'],
      ...oxlintConfigVitest,
      rules: Object.assign(structuredClone(oxlintConfigVitest.rules), {
        'vitest/no-conditional-expect': 'off',
      }),
    },
  ],
});
