global.fetch = require('node-fetch');
global.Headers = require('node-fetch').Headers;
global.Request = require('node-fetch').Request;
global.FormData = require('form-data');

const nock = require('nock');
const fetchHar = require('..');
const { constructRequest } = require('..');
const harExamples = require('har-examples');
const jsonWithAuthHar = require('./__fixtures__/json-with-auth.har.json');
const urlEncodednWithAuthHar = require('./__fixtures__/urlencoded-with-auth.har.json');

describe('#fetch', () => {
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

  it('should throw if it looks like you are missing a valid har file', () => {
    expect(fetchHar).toThrow('Missing HAR file');
    expect(fetchHar.bind(null, { log: {} })).toThrow('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).toThrow('Missing log.entries array');
  });

  it('should make a request', async () => {
    const mock = nock('http://petstore.swagger.io').post('/v2/store/order', 'test').reply(200);

    await fetchHar(har, 'test-app/1.0');
    mock.done();
  });

  it('should make a request with a custom user agent if specified', async () => {
    const mock = nock('http://petstore.swagger.io')
      .matchHeader('user-agent', 'test-app/1.0')
      .post('/v2/store/order', 'test')
      .reply(200);

    await fetchHar(har, 'test-app/1.0');
    mock.done();
  });
});

describe('#constructRequest', () => {
  it('should convert HAR object to a HTTP request object', () => {
    const request = constructRequest(jsonWithAuthHar);

    expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
    expect(request.method).toBe('PUT');
    expect(request.headers.get('authorization')).toBe('Bearer api-key');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.body.toString()).toBe('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });

  it('should include a `User-Agent` header if one is supplied', () => {
    const request = constructRequest(jsonWithAuthHar, 'test-user-agent/1.0');

    expect(request.headers.get('user-agent')).toBe('test-user-agent/1.0');
  });

  describe('Content type use cases', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', () => {
      const request = constructRequest(urlEncodednWithAuthHar);

      expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
      expect(request.method).toBe('PUT');
      expect(request.headers.get('authorization')).toBe('Bearer api-key');

      // Though we have a Content-Type header set to application/json, since the post data is to be treated as
      // `application/x-www-form-urlencoded`, that needs to be the only `Content-Type` header present. This is how
      // Postman handles this case!
      expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
      expect(request.body.toString()).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
    });

    it('should be able to handle `full` payloads', () => {
      const request = constructRequest(harExamples.full);

      expect(request.url).toBe('http://mockbin.com/har?key=value?foo=bar&foo=baz&baz=abc');
      expect(request.method).toBe('POST');

      expect(request.headers.get('accept')).toBe('application/json');
      expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
      expect(request.headers.get('cookie')).toBe('foo=bar; bar=baz');

      expect(request.body.toString()).toBe('foo=bar');
    });

    it('should be able to handle payloads with cookies', () => {
      const request = constructRequest(harExamples.cookies);

      expect(request.url).toBe('http://mockbin.com/har');
      expect(request.method).toBe('POST');
      expect(request.headers.get('cookie')).toBe('foo=bar; bar=baz');

      // Wasn't supplied with the HAR so it shouldn't be present.
      expect(request.headers.get('content-type')).toBeNull();
    });

    describe('multipart/form-data', () => {
      it("should be able to handle a `multipart/form-data` payload that's a standard object", () => {
        const request = constructRequest(harExamples['multipart-form-data']);

        expect(request.body).toBeInstanceOf(FormData);
        expect(request.body.getBuffer().toString().replace(/\r\n/g, '\n'))
          .toContain(`Content-Disposition: form-data; name="foo"

bar`);
      });

      it('should be able to handle a `multipart/form-data` payload with a file', () => {
        const request = constructRequest(harExamples['multipart-data']);

        expect(request.url).toBe('http://mockbin.com/har');
        expect(request.method).toBe('POST');
        expect(request.headers.get('content-type')).toBe('multipart/form-data');

        expect(request.body).toBeInstanceOf(FormData);

        expect(request.body.getBuffer().toString().replace(/\r\n/g, '\n'))
          .toContain(`Content-Disposition: form-data; name="foo"; filename="hello.txt"
Content-Type: text/plain

Hello World`);
      });

      it('should throw an error if `fileName` is present but no file content in `value`', () => {
        expect(() => {
          constructRequest(harExamples['multipart-file']);
        }).toThrow(/doesn't have access to the filesystem/);
      });
    });

    it('should be able to handle `text/plain` payloads', () => {
      const request = constructRequest(harExamples['text-plain']);

      expect(request.url).toBe('http://mockbin.com/har');
      expect(request.method).toBe('POST');
      expect(request.headers.get('content-type')).toBe('text/plain');
      expect(request.body.toString()).toBe('Hello World');
    });
  });
});
