/* eslint-disable import/no-extraneous-dependencies, no-console */
const fetchHar = require('.');

// If executing from an environment without `fetch`, you'll need to polyfill.
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
  globalThis.Headers = require('node-fetch').Headers;
  globalThis.Request = require('node-fetch').Request;
  globalThis.FormData = require('form-data');
}

const har = {
  log: {
    entries: [
      {
        request: {
          method: 'POST',
          url: 'https://httpbin.org/post',
          headers: [
            {
              name: 'content-type',
              value: 'multipart/form-data',
            },
          ],
          postData: {
            mimeType: 'multipart/form-data',
            params: [
              {
                name: 'foo',
                value: 'bar',
              },
            ],
          },
        },
      },
    ],
  },
};

fetchHar(har)
  .then(request => request.json())
  .then(console.log);
