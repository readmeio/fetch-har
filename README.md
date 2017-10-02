# fetch-har

Converts har objects to request objects

[![](https://d3vv6lp55qjaqc.cloudfront.net/items/1M3C3j0I0s0j3T362344/Untitled-2.png)](https://readme.io)

## Installation

```
npm install --save fetch-har
```

## Usage
```
const fetchHar = require('fetch-har');
// eslint-disable-next-line no-unused-vars
const har = {
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
        queryString: [{ name: 'a', value: 1 }],
        postData: {
          text: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
        },
        method: 'PUT',
        url: 'http://petstore.swagger.io/v2/pet',
      },
    },
  ],
};

// eslint-disable-next-line no-console
fetchHar(har).then(request => console.log(request.json()));
```

### `function constructRequest(har)`

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.  

The object returned is a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object.
This function is mainly exported for testing purposes but could be useful if you want to construct
a request but do not want to execute it right away.

### `function fetchRequest(har)`

- `har` is a [har](https://en.wikipedia.org/wiki/.har) file format.  

Utilizes constructRequest function to format har into a request object and then returns a promise from node-fetch.

## Credits
[Sanjeet](https://github.com/uppal101/)

## License

ISC
