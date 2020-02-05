global.fetch = require('node-fetch');

global.Request = fetch.Request;

const nock = require('nock');
const fetchHar = require('../');
const { constructRequest } = require('../');

describe('construct request', () => {
  it('should convert har object to a http request obj', () => {
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
                text: '{"id":8,"category":{"id":6,"name":"name"},"name":"name"}',
              },
              method: 'PUT',
              url: 'http://petstore.swagger.io/v2/pet',
            },
          },
        ],
      },
    };

    const request = constructRequest(har);

    expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
    expect(request.method).toBe('PUT');
    expect(request.headers.get('authorization')).toBe('Bearer api-key');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.body.toString()).toBe('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });
});

describe('fetch har', () => {
  it('should throw if it looks like you are missing a valid har file', () => {
    expect(fetchHar).toThrow('Missing har file');
    expect(fetchHar.bind(null, { log: {} })).toThrow('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).toThrow('Missing log.entries array');
  });

  it('should make a request', async () => {
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

    const mock = nock('http://petstore.swagger.io')
      .post('/v2/store/order', 'test')
      .reply(200);

    await fetchHar(har);
    mock.done();
  });
});
