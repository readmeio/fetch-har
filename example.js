/* eslint-disable import/no-extraneous-dependencies, no-console */
require('isomorphic-fetch');
const fetchHar = require('.');

// If executing from an environment that dodoesn't normally provide fetch() you'll need to polyfill some APIs in order
// to make `multipart/form-data` requests.
if (!globalThis.FormData) {
  globalThis.Blob = require('formdata-node').Blob;
  globalThis.File = require('formdata-node').File;
  globalThis.FormData = require('formdata-node').FormData;
}

const har = {
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
};

fetchHar(har)
  .then(request => request.json())
  .then(console.log);
