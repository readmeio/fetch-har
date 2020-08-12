/* global fetchHar, page, SERVER_URL */
const harExamples = require('har-examples');
const jsonWithAuthHar = require('./__fixtures__/json-with-auth.har.json');
const urlEncodedWithAuthHar = require('./__fixtures__/urlencoded-with-auth.har.json');

describe('#constructRequest', () => {
  beforeAll(async () => {
    await page.exposeFunction('har_cookies', () => harExamples.cookies);
    await page.exposeFunction('har_full', () => harExamples.full);
    await page.exposeFunction('har_jsonWithAuthHar', () => jsonWithAuthHar);
    await page.exposeFunction('har_multipartData', () => harExamples['multipart-data']);
    await page.exposeFunction('har_multipartFile', () => harExamples['multipart-file']);
    await page.exposeFunction('har_multipartFormData', () => harExamples['multipart-form-data']);
    await page.exposeFunction('har_textPlain', () => harExamples['text-plain']);
    await page.exposeFunction('har_urlEncodedWithAuthHar', () => urlEncodedWithAuthHar);
  });

  beforeEach(async () => {
    await page.goto(SERVER_URL, { waitUntil: 'load' });

    // Since `constructRequest` returns a `Request` object, which is not serializable, for our tests we need to have
    // Puppeteer return an object containing the properties and data we're looking for in order for us to be able to run
    // assertions within Jest.
    //
    // Why not use `page.exposeFunction`? That method unfortunately serializes all parameters that are supplied to
    // callbacks created with it, and as `Request` can't be serialized we'll end up with an empty object. Also since
    // we don't need to pass data from the Node layer into Puppetter, as you normally would with `exposeFunction`, we
    // can skirt that and simply create what we need on the page instance.
    //
    // https://github.com/puppeteer/puppeteer/issues/1750
    // https://pptr.dev/#?product=Puppeteer&version=v5.2.1&show=api-pageevaluatepagefunction-args
    await page.evaluate(() => {
      window.parseRequest = async req => {
        return {
          url: req.url,
          method: req.method,
          headers: Object.fromEntries(req.headers.entries()),
          credentials: req.credentials,
          cookies: document.cookie,
          body: (await req.text()).replace(/\r\n/g, '\n'),
        };
      };
    });
  });

  it('should convert HAR object to a HTTP request object', async () => {
    const request = await page.evaluate(async () => {
      return window.parseRequest(fetchHar.constructRequest(await window.har_jsonWithAuthHar()));
    });

    expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
    expect(request.method).toBe('PUT');
    expect(request.headers.authorization).toBe('Bearer api-key');
    expect(request.headers['content-type']).toBe('application/json');
    expect(request.body).toBe('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });

  // Custom user agents on browser requests aren't supported in browsers.
  it('should not include a `User-Agent` header if one is supplied', async () => {
    const request = await page.evaluate(async () => {
      return window.parseRequest(fetchHar.constructRequest(await window.har_jsonWithAuthHar()));
    });

    expect(request.headers['user-agent']).toBeUndefined();
  });

  describe('Content type use cases', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', async () => {
      const request = await page.evaluate(async () => {
        return window.parseRequest(fetchHar.constructRequest(await window.har_urlEncodedWithAuthHar()));
      });

      expect(request.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
      expect(request.method).toBe('PUT');
      expect(request.headers.authorization).toBe('Bearer api-key');

      // Though we have a Content-Type header set to application/json, since the post data is to be treated as
      // `application/x-www-form-urlencoded`, that needs to be the only `Content-Type` header present. This is how
      // Postman handles this case!
      expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(request.body).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
    });

    it('should be able to handle `full` payloads', async () => {
      const request = await page.evaluate(async () => {
        return window.parseRequest(fetchHar.constructRequest(await window.har_full()));
      });

      expect(request.url).toBe('http://mockbin.com/har?key=value?foo=bar&foo=baz&baz=abc');
      expect(request.method).toBe('POST');

      expect(request.headers.accept).toBe('application/json');
      expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(request.cookies).toBe('foo=bar; bar=baz');
      expect(request.credentials).toBe('include');

      expect(request.body.toString()).toBe('foo=bar');
    });

    it('should be able to handle payloads with cookies', async () => {
      const request = await page.evaluate(async () => {
        return window.parseRequest(fetchHar.constructRequest(await window.har_cookies()));
      });

      expect(request.url).toBe('http://mockbin.com/har');
      expect(request.method).toBe('POST');
      expect(request.cookies).toBe('foo=bar; bar=baz');
      expect(request.credentials).toBe('include');

      // Wasn't supplied with the HAR so it shouldn't be present.
      expect(request.headers['content-type']).toBeUndefined();
    });

    describe('multipart/form-data', () => {
      it("should be able to handle a `multipart/form-data` payload that's a standard object", async () => {
        const request = await page.evaluate(async () => {
          return window.parseRequest(fetchHar.constructRequest(await window.har_multipartFormData()));
        });

        expect(request.url).toBe('http://mockbin.com/har');
        expect(request.method).toBe('POST');
        expect(request.headers['content-type']).toBe('multipart/form-data');

        expect(request.body).toContain(`Content-Disposition: form-data; name="foo"

bar`);
      });

      it('should be able to handle a `multipart/form-data` payload with a file', async () => {
        const request = await page.evaluate(async () => {
          return window.parseRequest(fetchHar.constructRequest(await window.har_multipartData()));
        });

        expect(request.url).toBe('http://mockbin.com/har');
        expect(request.method).toBe('POST');
        expect(request.headers['content-type']).toBe('multipart/form-data');

        expect(request.body).toContain(`Content-Disposition: form-data; name="foo"; filename="hello.txt"
Content-Type: text/plain

Hello World`);
      });

      it('should throw an error if `fileName` is present but no file content in `value`', async () => {
        expect.hasAssertions();

        try {
          await page.evaluate(async () => {
            return window.parseRequest(fetchHar.constructRequest(await window.har_multipartFile()));
          });
        } catch (e) {
          // This test can't be written in an `expect(() => { page.evaluate() }) form because Puppetter throws "Target
          // closed" errors in that context instead of our actual error.
          //
          // eslint-disable-next-line jest/no-try-expect, jest/no-conditional-expect
          expect(e.message).toMatch(/doesn't have access to the filesystem/);
        }
      });
    });

    it('should be able to handle `text/plain` payloads', async () => {
      const request = await page.evaluate(async () => {
        const req = fetchHar.constructRequest(await window.har_textPlain());

        return {
          url: req.url,
          method: req.method,
          headers: {
            'content-type': req.headers.get('content-type'),
          },
          body: await req.text(),
        };
      });

      expect(request.url).toBe('http://mockbin.com/har');
      expect(request.method).toBe('POST');
      expect(request.headers['content-type']).toBe('text/plain');
      expect(request.body).toBe('Hello World');
    });
  });
});
