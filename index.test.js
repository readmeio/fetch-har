/* eslint-env mocha */
global.fetch = require('node-fetch');

global.Request = fetch.Request;
const { expect } = require('chai');
const nock = require('nock');
const fetchHar = require('./');
const { constructRequest } = require('./');

describe('construct request', () => {
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
            method: 'PUT',
            url: 'http://petstore.swagger.io/v2/pet',
          },
        },
      ],
    },
  };

  it('should convert har object to a http request obj', () => {
    const request = constructRequest(har);
    expect(request.url).to.equal('http://petstore.swagger.io/v2/pet?a=1&b=2');
    expect(request.method).to.equal('PUT');
    expect(request.headers.get('authorization')).to.equal('Bearer api-key');
    expect(request.headers.get('content-type')).to.equal('application/json');
    expect(request.body).to.equal('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });
});

describe('fetch har', () => {
  it('should throw if it looks like you are missing a valid har file', () => {
    expect(fetchHar).to.throw('Missing har file');
    expect(fetchHar.bind(null, { log: {} })).to.throw('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).to.throw('Missing log.entries array');
  });

  const har = {
    log: {
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
    },
  };

  it('should make a request', async () => {
    const mock = nock('http://petstore.swagger.io')
      .post('/v2/store/order', 'test')
      .reply(200);

    await fetchHar(har);
    mock.done();
  });
});
