/* eslint-disable @typescript-eslint/no-var-requires */
const { karmaConfig } = require('@jsdevtools/karma-config');
const { host } = require('@jsdevtools/host-environment');

module.exports = karmaConfig({
  sourceDir: '.',
  fixtures: ['test/fixtures/*.json'],
  browsers: {
    chrome: true,
    firefox: true,
    safari: host.os.mac,
    edge: false,
    ie: false,
  },
  tests: ['test/*.ts'],
  config: {
    client: {
      mocha: {
        // Windows CI sometimes takes longer than 2s to run some tests.
        timeout: 15000,
      },
    },
    exclude: ['test/node-quirks.test.ts'],
    webpack: {
      resolve: {
        extensions: ['.js', '.ts'],
      },
      mode: 'production',
      module: {
        rules: [{ test: /\.ts$/, use: 'ts-loader' }],
      },
    },
  },
});
