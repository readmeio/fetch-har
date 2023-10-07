# fetch-har

Make a [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) request from a HAR definition.

[![CI](https://github.com/readmeio/fetch-har/workflows/CI/badge.svg)](https://github.com/readmeio/fetch-har/)
[![](https://img.shields.io/npm/v/fetch-har)](https://npm.im/fetch-har)
[![License](https://img.shields.io/npm/l/fetch-har.svg)](LICENSE)

[![](https://raw.githubusercontent.com/readmeio/.github/main/oss-header.png)](https://readme.io)

## Features

- Supports Node 18+
- Natively works in all browsers that support [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) without having to use any polyfils.
- [Tested](https://github.com/readmeio/fetch-har/actions) across Chrome, Safari, Firefox on Mac, Windows, and Linux.
- Requests can be mocked with [`msw`](https://npm.im/msw) or [`fetch-mock`](https://npm.im/fetch-mock) (though the latter does not appear to be maintained).

## Installation

```
npm install --save fetch-har
```

## Usage

```js
import fetchHAR from 'fetch-har';
// const fetchHAR = require('fetch-har');

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

fetchHAR(har)
  .then(res => res.json())
  .then(console.log);
```

### API

#### Options

##### userAgent

A custom `User-Agent` header to apply to your request. Please note that browsers have their own handling for these headers in `fetch()` calls so it may not work everywhere; it will always be sent in Node however.

```js
await fetchHAR(har, { userAgent: 'my-client/1.0' });
```

##### files

An optional object map you can supply to use for `multipart/form-data` file uploads in leu of relying on if the HAR you have has [data URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs). It supports Node file buffers and the [File](https://developer.mozilla.org/en-US/docs/Web/API/File) API.

```js
await fetchHAR(har, {
  files: {
    'owlbert.png': await fs.readFile('./owlbert.png'),
    'file.txt': document.querySelector('#some-file-input').files[0],
  },
});
```

If you don't supply this option `fetch-har` will fallback to the data URL present within the supplied HAR. If no `files` option is present, and no data URL (via `param.value`) is present in the HAR, a fatal exception will be thrown.

##### init

This optional argument lets you supply any option that's available to supply to the [Request constructor](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request).

```js
await fetchHAR(har, {
  init: {
    headers: new Headers({
      'x-custom-header': 'buster',
    }),
  },
});
```

> ❗ Note that if you supply `body` or `credentials` to this option they may be overridden by what your HAR requires.
