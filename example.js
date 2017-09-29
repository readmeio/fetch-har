// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
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
