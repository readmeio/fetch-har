global.fetch = require('node-fetch');
global.Headers = require('node-fetch').Headers;
global.Request = require('node-fetch').Request;
global.FormData = require('form-data');

const fs = require('fs').promises;
const path = require('path');
const nock = require('nock');
const fetchHar = require('..');
const { constructRequest } = require('..');
const harExamples = require('har-examples');
const jsonWithAuthHar = require('./__fixtures__/json-with-auth.har.json');
const urlEncodedWithAuthHar = require('./__fixtures__/urlencoded-with-auth.har.json');

describe('#fetch', () => {
  it('should throw if it looks like you are missing a valid har file', () => {
    expect(fetchHar).toThrow('Missing HAR file');
    expect(fetchHar.bind(null, { log: {} })).toThrow('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).toThrow('Missing log.entries array');
  });

  it('should make a request with a custom user agent if specified', async () => {
    const mock = nock('http://mockbin.com').matchHeader('user-agent', 'test-app/1.0').get('/har').reply(200);
    await fetchHar(harExamples.short, 'test-app/1.0');
    mock.done();
  });

  describe('Content types', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', async () => {
      const mock = nock('http://petstore.swagger.io')
        .matchHeader('content-type', 'application/x-www-form-urlencoded')
        .put('/v2/pet')
        .query({ a: 1, b: 2 })
        .reply(200, function (uri, body) {
          expect(this.req.headers.authorization).toStrictEqual(['Bearer api-key']);
          expect(body).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
        });

      await fetchHar(urlEncodedWithAuthHar);
      mock.done();
    });

    it('should be able to handle full payloads', async () => {
      const mock = nock('http://mockbin.com')
        .matchHeader('content-type', 'application/x-www-form-urlencoded')
        .post('/har')
        .query(true)
        .reply(200, function (uri, body) {
          expect(this.req.path).toBe('/har?key=value?foo=bar&foo=baz&baz=abc');
          expect(this.req.headers.accept).toStrictEqual(['application/json']);
          expect(this.req.headers.cookie).toStrictEqual(['foo=bar; bar=baz']);
          expect(body).toBe('foo=bar');
        });

      await fetchHar(harExamples.full);
      mock.done();
    });

    describe('multipart/form-data', () => {
      it("should be able to handle a `multipart/form-data` payload that's a standard object", async () => {
        const mock = nock('http://mockbin.com')
          .post('/har')
          .reply(200, function (uri, body) {
            expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
            expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

            expect(body.replace(/\r\n/g, '\n')).toContain(`Content-Disposition: form-data; name="foo"

bar`);
          });

        await fetchHar(harExamples['multipart-form-data']);
        mock.done();
      });

      it('should be able to handle a `multipart/form-data` payload with a file', async () => {
        const mock = nock('http://mockbin.com')
          .post('/har')
          .reply(200, function (uri, body) {
            expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
            expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

            expect(
              body.replace(/\r\n/g, '\n')
            ).toContain(`Content-Disposition: form-data; name="foo"; filename="hello.txt"
Content-Type: text/plain

Hello World`);
          });

        await fetchHar(harExamples['multipart-data']);
        mock.done();
      });

      describe('base64-encoded data URLs', () => {
        let owlbert;

        beforeAll(async () => {
          owlbert = await fs.readFile(path.join(__dirname, '__fixtures__', 'owlbert.png')).then(img => {
            return img.toString();
          });
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
          const mock = nock('http://mockbin.com')
            .post('/har')
            .reply(200, function (uri, body) {
              expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
              expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

              expect(body).toContain('Content-Disposition: form-data; name="foo"; filename="owlbert.png"');
              expect(body).toContain('Content-Type: image/png');

              // The rest of the body should be the raw image not the data URL that was in the HAR.
              expect(body).toContain(owlbert);
            });

          await fetchHar(harExamples['multipart-data-dataurl']);
          mock.done();
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async () => {
          const har = harExamples['multipart-data-dataurl'];
          har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
          har.log.entries[0].request.postData.params[0].value = har.log.entries[0].request.postData.params[0].value.replace(
            'name=owlbert.png;',
            `name=${encodeURIComponent('owlbert (1).png')};`
          );

          const mock = nock('http://mockbin.com')
            .post('/har')
            .reply(200, function (uri, body) {
              expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
              expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

              expect(body).toContain('Content-Disposition: form-data; name="foo"; filename="owlbert (1).png"');
              expect(body).toContain('Content-Type: image/png');

              // The rest of the body should be the raw image not the data URL that was in the HAR.
              expect(body).toContain(owlbert);
            });

          await fetchHar(har);
          mock.done();
        });
      });
    });

    it('should be able to handle `text/plain` payloads', async () => {
      const mock = nock('http://mockbin.com')
        .matchHeader('content-type', 'text/plain')
        .post('/har')
        .query(true)
        .reply(200, function (uri, body) {
          expect(body).toBe('Hello World');
        });

      await fetchHar(harExamples['text-plain']);
      mock.done();
    });
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

  describe('Content types', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', () => {
      const request = constructRequest(urlEncodedWithAuthHar);

      expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
      expect(request.method).toBe('PUT');
      expect(request.headers.get('authorization')).toBe('Bearer api-key');

      // Though we have a Content-Type header set to application/json, since the post data is to be treated as
      // `application/x-www-form-urlencoded`, that needs to be the only `Content-Type` header present. This is how
      // Postman handles this case!
      expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
      expect(request.body.toString()).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
    });

    it('should be able to handle full payloads', () => {
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

        expect(request.url).toBe('http://mockbin.com/har');
        expect(request.method).toBe('POST');
        expect(request.headers.get('content-type')).toContain('multipart/form-data');
        expect(request.headers.get('content-type')).toContain('boundary=-------------------------');

        expect(request.body).toBeInstanceOf(FormData);
        expect(request.body.getBuffer().toString().replace(/\r\n/g, '\n'))
          .toContain(`Content-Disposition: form-data; name="foo"

bar`);
      });

      it('should be able to handle a `multipart/form-data` payload with a file', () => {
        const request = constructRequest(harExamples['multipart-data']);

        expect(request.url).toBe('http://mockbin.com/har');
        expect(request.method).toBe('POST');
        expect(request.headers.get('content-type')).toContain('multipart/form-data');
        expect(request.headers.get('content-type')).toContain('boundary=-------------------------');

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
