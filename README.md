# fetch-har
[![CI](https://github.com/readmeio/fetch-har/workflows/CI/badge.svg)](https://github.com/readmeio/fetch-har)

Make a [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) request from a HAR definition.

[![](https://d3vv6lp55qjaqc.cloudfront.net/items/1M3C3j0I0s0j3T362344/Untitled-2.png)](https://readme.io)

## Installation

```
npm install --save fetch-har
```

## Usage
```js
const fetchHar = require('fetch-har');

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
```

### API
If you are executing `fetch-har` in a browser environment that supports the [FormData API](https://developer.mozilla.org/en-US/docs/Web/API/FormData) then you don't need to do anything. If you arent, however, you'll need to polyfill it.

Unfortunately the most popular NPM package [form-data](https://npm.im/form-data) ships with a [non-spec compliant API](https://github.com/form-data/form-data/issues/124), and for this we don't recommend you use it, as if you use `fetch-har` to upload files it may not work.

We recommend either [formdata-node](https://npm.im/formdata-node) or [formdata-polyfill](https://npm.im/formdata-polyfill).

### `fetchHar(har, { userAgent, files }) => Promise`
Performs a fetch request from a given HAR definition. HAR definitions can be used to list lots of requests but we only use the first from the `log.entries` array.

```js
const fetchHar = require('fetch-har');
```

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.
- `opts.userAgent` is an optional user agent string to let you declare where the request is coming from.
- `opts.files` is an optional user agent string to let you declare where the request is coming from.

### `fetchHar.constructRequest(har, { userAgent, files }) => Request`
We also export a second function, `constructRequest`, which we use to construct a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object from your HAR.

Though this function is mainly exported for testing purposes, it could be useful to you if you plan on constructing a request but not executing it right away.

```js
const { constructRequest } = require('fetch-har');
```

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.
- `opts.userAgent` is an optional user agent string to let you declare where the request is coming from.
- `opts.files` is an optional mapping object of `fileName` to file buffers you can use to supply file uploads instead of relying on encoded file data within the supplied HAR.
