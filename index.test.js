/* eslint-env mocha */
global.fetch = require('node-fetch');
global.Request = fetch.Request;
const { expect } = require('chai');
const nock = require('nock');
const fetchRequest = require('./index.js');
const { constructRequest } = require('./index.js');

const har = {
  entries: [
    {
      request: [
        {
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
        },
      ],
    },
  ],
};
describe('construct request', () => {
  it('should convert har object to a http request obj', () => {
    const request = constructRequest(har);
    expect(request.url).to.equal('http://petstore.swagger.io/v2/pet?a=1');
    expect(request.method).to.equal('PUT');
    // expect(request.headers).to.equal("Headers {_headers : {Authorization : ['Bearer api-key']}}")
    expect(request.body).to.equal('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });
});
const har2 = {
  entries: [
    {
      request: [
        {
          headers: [
            {
              name: 'Authorization',
              value: 'Bearer api-key',
              'Content-Type': 'application/json',
            },
          ],
          queryString: [],
          postData: {
            text: '{"id":1,"name":"pedro"}',
          },
          method: 'PUT',
          url: 'http://petstore.swagger.io/v2/pet',
        },
      ],
    },
  ],
};

describe('fetch har', () => {
  it('should return a promise', () => {
    // const mock = nock('http://petstore.swagger.io')
    //   .put('/v2/pet', { id: '1', name: 'pedro' })
    //   .reply(200);
    const mock = fetchRequest(har2);

    // console.log(mock);
    // expect(mock.interceptors[0].statusCode).to.equal(200);
    // expect(mock).to.equal('Promise { <pending> }');
  });
});
