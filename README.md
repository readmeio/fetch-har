# fetch-har
[![Build](https://github.com/readmeio/fetch-har/workflows/Node%20CI/badge.svg)](https://github.com/readmeio/fetch-har)

Make a [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) request from a HAR file

[![](https://d3vv6lp55qjaqc.cloudfront.net/items/1M3C3j0I0s0j3T362344/Untitled-2.png)](https://readme.io)

## Installation

```
npm install --save fetch-har
```

## Usage
```js
const fetchHar = require('fetch-har');

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
          queryString: [{ name: 'a', value: 1 }, { name: 'b', value: 2 }],
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
```

### `fetchHar(har, userAgent) => Promise`

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.
- `userAgent` is an optional user agent string to let you declare where the request is coming from.

Performs a fetch request from a given HAR file. HAR files can be used to list lots of requests but we only use the first from the `log.entries` array.

### `fetchHar.constructRequest(har, userAgent) => Request`

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.
- `userAgent` is an optional user agent string to let you declare where the request is coming from.

We also export a 2nd function which is used to construct a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object from your HAR.

This function is mainly exported for testing purposes but could be useful if you want to construct
a request but do not want to execute it right away.

## Credits
[Sanjeet](https://github.com/uppal101/)

## License

ISC
