/* eslint-env mocha */
global.fetch = require('node-fetch');

global.Request = fetch.Request;
const { expect } = require('chai');
const nock = require('nock');
const fetchHar = require('./index.js');
const { constructRequest } = require('./index.js');

describe('construct request', () => {
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
  it('should convert har object to a http request obj', () => {
    const request = constructRequest(har);
    expect(request.url).to.equal('http://petstore.swagger.io/v2/pet?a=1');
    expect(request.method).to.equal('PUT');
    // expect(request.headers).to.equal("Headers {_headers : {Authorization : ['Bearer api-key']}}")
    expect(request.body).to.equal('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });
});

describe('fetch har', () => {
  const har = {
    entries: [
      {
        request: {
          headers: [],
          queryString: [],
          postData: {
            text: 'test',
          },
          method: 'POST',
          url: 'http://petstore.swagger.io/v2/store/order',
        },
      },
    ],
  };

  it('should make a request', async () => {
    const mock = nock('http://petstore.swagger.io')
      .post('/v2/store/order', 'test')
      .reply(200, {
        id: 1,
        petId: 1,
        quantity: 1,
        shipDate: '2017-07-02T05:00:00.000+0000',
        status: 'placed',
        complete: false,
      });

    await fetchHar(har);
    mock.done();
  });
});
