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
  config: {
    exclude: [
      // Exclude these tests because some of the APIs are HUGE and cause timeouts.
      // We still test them in Node though.
      // "test/specs/real-world/*",
      'test/node-quirks.test.js',
    ],
    client: {
      mocha: {
        // Windows CI sometimes takes longer than 2s to run some tests.
        timeout: 15000,
      },
    },
  },
});
