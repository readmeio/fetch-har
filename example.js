// eslint-disable-next-line
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
