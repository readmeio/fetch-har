# fetch-har

Converts har objects to request objects

[![](https://d3vv6lp55qjaqc.cloudfront.net/items/1M3C3j0I0s0j3T362344/Untitled-2.png)](https://readme.io)

## Installation

```
npm install --save fetch-har
```

## Usage
```
const har = {
  headers: [
    {
      name: 'Authorization',
      value: 'Bearer api-key',
      'Content-Type': 'application/json',
    },
  ],
  queryString: [{ name: 'a', value: 1 }],
  postData: {
    text: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
  },
  method: 'PUT',
  url: 'http://petstore.swagger.io/v2/pet',
};

/* Construct Request function converts har into a Request object
 that is readily formatted for node fetch */

const harToHTTP = {
  method: 'PUT',
  redirect: 'follow',
  headers: { _headers: { authorization: [Array] } },
  url: 'http://petstore.swagger.io/v2/pet?a=1',
  follow: 20,
  compress: true,
  counter: 0,
  agent: undefined,
  body: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
  bodyUsed: false,
  size: 0,
  timeout: 0,
  _raw: [],
  _abort: false,
  protocol: 'http:',
  hostname: 'petstore.swagger.io',
  port: null,
  path: '/v2/pet?a=1',
  auth: null,
};
```

### `function constructRequest(har)`

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format. It usually has more 

The object returned is a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object.
This function is mainly exported for testing purposes but could be useful if you want to construct
a request but do not want to execute it right away.

<!-- - `method` - type of HTTP method - [docs](#method)
- `redirect` - allows for redirection from an old URL to a new one - [docs](#redirect)
- `headers` - will contain what content type and if an authorization type is required for endpoint - [docs](#headers)
- `url` - full url that fetch should request from - [docs](#url)
<!-- - `follow` - an array of the `@secret` comment types - [docs](#secret) -->
- `compress` - boolean that tells server to reduce content before transmitting - [docs](#compress)
- `counter` - an object of all the possible errors from this action - [docs](#errors)
- `agent` - information about the operating system and browser - [docs](#agent)
- `body` - an object of the request body - [docs](#body)
<!-- - `bodyUsed` - an object of all the possible errors from this action - [docs](#bodyUsed) -->
<!-- - `size` - an object describing the return type - [docs](#size) -->
- `timeout` - number to wait if response is not fully received to abort request - [docs](#timeout)
- `_raw` - array of raw data to sent with request - [docs](#raw)
- `_abort` - boolean value whether to abort request or not - [docs](#abort)
- `protocol` - type of hyper text transfer protocol - [docs](#protocol)
- `hostname` - the domain of the url - [docs](#hostname)
- `port` - an object describing the return type - [docs](#port)
- `path` - endpoint that fetch needs to hit - [docs](#path)
- `auth` - an object describing the return type - [docs](#auth) -->

## Credits
[Sanjeet](https://github.com/uppal101/)

## License

ISC
