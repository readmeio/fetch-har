/* eslint-disable import/no-extraneous-dependencies, no-console */
const fetchHar = require('./');

// If executing from an environment without `fetch`, you'll need to polyfill
global.fetch = require('node-fetch');
global.Request = require('node-fetch').Request;

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
