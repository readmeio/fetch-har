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
        startedDateTime: '2021-07-09T23:28:52.627Z',
        time: 420,
        request: {
          method: 'POST',
          url: 'https://httpbin.org/post',
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: [
            {
              name: 'content-type',
              value: 'multipart/form-data',
            },
          ],
          queryString: [],
          postData: {
            mimeType: 'multipart/form-data',
            params: [
              {
                name: 'foo',
                value: 'bar',
              },
            ],
          },
          bodySize: -1,
          headersSize: -1,
        },
      },
    ],
  },
};

fetchHar(har)
  .then(request => request.json())
  .then(console.log);
