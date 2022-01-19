/* eslint-disable import/no-extraneous-dependencies, no-console */
const fetchHar = require('.');

// If executing from an environment without `fetch`, you'll need to polyfill.
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
  globalThis.Headers = require('node-fetch').Headers;
  globalThis.Request = require('node-fetch').Request;
  globalThis.FormData = require('form-data');
}

fetchHar({
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
})
  .then(res => res.json())
  .then(res => {
    console.log('🚥 multipart/form-data request', res);
  });

fetchHar({
  log: {
    entries: [
      {
        request: {
          headers: [
            {
              name: 'Authorization',
              value: 'Bearer api-key',
            },
            {
              name: 'Content-Type',
              value: 'application/json',
            },
          ],
          queryString: [
            { name: 'a', value: 1 },
            { name: 'b', value: 2 },
          ],
          postData: {
            mimeType: 'application/json',
            text: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
          },
          method: 'POST',
          url: 'http://httpbin.org/post',
        },
      },
    ],
  },
})
  .then(res => res.json())
  .then(res => {
    console.log('🚥 application/json request', res);
  });
