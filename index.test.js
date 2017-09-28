global.fetch = require('node-fetch');
global.Request = fetch.Request;
const expect = require('chai').expect;
const nock = require('nock');
const fetchHar = require('./index.js');
const { constructRequest } = require('./index.js');

const har = {
  headers: [
    {
      name: 'Authorization',
      value: 'Bearer api-key',
      'Content-Type': 'application/json',
    },
  ],
  queryString: [],
  postData: {
    text: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
  },
  method: 'PUT',
  url: 'http://petstore.swagger.io/v2/pet',
};

describe('construct request', () => {
  it('should convert har object to a http request obj', () => {
    const request = constructRequest(har);
    expect(request.url).to.equal('http://petstore.swagger.io/v2/pet');
    expect(request.method).to.equal('PUT');
    // expect(request.headers).to.equal("Headers {_headers : {Authorization : ['Bearer api-key']}}")
    expect(request.body).to.equal('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });
});

describe('fetch har', () => {
  it('should return a promise', () => {
    const mock = nock('http://petstore.swagger.io')
      .put('/v2/pet', { id: '1', name: 'pedro' })
      .reply(200);
  });
});
