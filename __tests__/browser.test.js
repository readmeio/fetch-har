/* global debugHar, fetchHar, page, serializeRequest, SERVER_URL */
const fs = require('fs').promises;
const path = require('path');
const harExamples = require('har-examples');
const jsonWithAuthHar = require('./__fixtures__/json-with-auth.har.json');
const urlEncodedWithAuthHar = require('./__fixtures__/urlencoded-with-auth.har.json');

beforeAll(async () => {
  await page.exposeFunction('har_full', () => harExamples.full);
  await page.exposeFunction('har_jsonWithAuthHar', () => jsonWithAuthHar);
  await page.exposeFunction('har_multipartData', () => harExamples['multipart-data']);
  await page.exposeFunction('har_multipartData_DataUrl', () => harExamples['multipart-data-dataurl']);
  await page.exposeFunction('har_multipartData_DataUrl_withParentheses', () => {
    const har = harExamples['multipart-data-dataurl'];
    har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
    har.log.entries[0].request.postData.params[0].value = har.log.entries[0].request.postData.params[0].value.replace(
      'name=owlbert.png;',
      `name=${encodeURIComponent('owlbert (1).png')};`
    );

    return har;
  });

  await page.exposeFunction('har_multipartFile', () => harExamples['multipart-file']);
  await page.exposeFunction('har_multipartFormData', () => harExamples['multipart-form-data']);
  await page.exposeFunction('har_textPlain', () => harExamples['text-plain']);
  await page.exposeFunction('har_urlEncodedWithAuthHar', () => urlEncodedWithAuthHar);
});

beforeEach(async () => {
  await page.goto(SERVER_URL, { waitUntil: 'load' });

  await page.addScriptTag({
    content: `const SERVER_URL = "${SERVER_URL}";`,
  });

  await page.evaluate(() => {
    /**
     * Take a given HAR object and rewrite its URL to our debug server in order to test requests against it.
     *
     * @param {Object} har
     * @returns {Object}
     */
    window.debugHar = har => {
      // eslint-disable-next-line no-param-reassign
      har.log.entries[0].request.url = `${SERVER_URL}/debug`;
      return har;
    };

    /**
     * Take a `Request` object and manually serialize it down into an object of the data we're looking for.
     *
     * Why? Since `constructRequest` returns a `Request` object, which is not serializable, for our tests we need to
     * have Puppeteer return an object containing the properties and data we're looking for in order for us to be able
     * to run assertions within Jest.
     *
     * Why not use `page.exposeFunction`? That method unfortunately serializes all parameters that are supplied to
     * callbacks created with it, and as `Request` can't be serialized we'll end up with an empty object. Also since
     * we don't need to pass data from the Node layer into Puppetter, as you normally would with `exposeFunction`, we
     * can skirt that and simply create what we need on the page instance.
     *
     * @link https://github.com/puppeteer/puppeteer/issues/1750
     * @link https://pptr.dev/#?product=Puppeteer&version=v5.2.1&show=api-pageevaluatepagefunction-args
     * @param {Request} req
     * @returns {Object}
     */
    window.serializeRequest = async req => {
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

describe('#fetch', () => {
  it('should not make a request with a custom user agent if specified', async () => {
    const req = await page.evaluate(async () => {
      const har = debugHar(await window.har_full());
      return fetchHar(har, 'test-app/1.0').then(res => res.json());
    });

    expect(req.headers['user-agent']).not.toContain('test-app/1.0');
  });

  describe('Content types', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', async () => {
      const req = await page.evaluate(async () => {
        const har = debugHar(await window.har_urlEncodedWithAuthHar());
        return fetchHar(har).then(res => res.json());
      });

      expect(req.method).toBe('PUT');
      expect(req.headers.authorization).toBe('Bearer api-key');
      expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(req.query).toMatchObject({ a: '1', b: '2' });
      expect(req.body).toMatchObject({
        id: '8',
        category: '{"id":6,"name":"name"}',
        name: 'name',
      });
    });

    it('should be able to handle full payloads', async () => {
      const req = await page.evaluate(async () => {
        const har = debugHar(await window.har_full());
        return fetchHar(har).then(res => res.json());
      });

      expect(req.method).toBe('POST');
      expect(req.headers.accept).toBe('application/json');
      expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');

      expect(req.cookies).toMatchObject({ foo: 'bar', bar: 'baz' });
      expect(req.query).toMatchObject({ foo: ['bar', 'baz'], baz: 'abc' });
      expect(req.body).toMatchObject({ foo: 'bar' });
    });

    describe('multipart/form-data', () => {
      it("should be able to handle a `multipart/form-data` payload that's a standard object", async () => {
        const req = await page.evaluate(async () => {
          const har = debugHar(await window.har_multipartFormData());
          return fetchHar(har).then(res => res.json());
        });

        expect(req.method).toBe('POST');
        expect(req.headers['content-type']).toContain('multipart/form-data');
        expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');
        expect(req.body).toMatchObject({ foo: 'bar' });
      });

      it('should be able to handle a `multipart/form-data` payload with a file', async () => {
        const req = await page.evaluate(async () => {
          const har = debugHar(await window.har_multipartData());
          return fetchHar(har).then(res => res.json());
        });

        expect(req.method).toBe('POST');
        expect(req.headers['content-type']).toContain('multipart/form-data');
        expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');

        expect(req.files).toHaveLength(1);
        expect(req.files[0].fieldname).toBe('foo');
        expect(req.files[0].originalname).toBe('hello.txt');
        expect(req.files[0].mimetype).toBe('text/plain');
        expect(Buffer.from(req.files[0].buffer).toString()).toBe('Hello World');
      });

      describe('base64-encoded data URLs', () => {
        let owlbert;

        beforeAll(async () => {
          owlbert = await fs.readFile(path.join(__dirname, '__fixtures__', 'owlbert.png')).then(img => {
            return img.toString();
          });
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
          const req = await page.evaluate(async () => {
            const har = debugHar(await window.har_multipartData_DataUrl());
            return fetchHar(har).then(res => res.json());
          });

          expect(req.method).toBe('POST');
          expect(req.headers['content-type']).toContain('multipart/form-data');
          expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');

          expect(req.files).toHaveLength(1);
          expect(req.files[0].fieldname).toBe('foo');
          expect(req.files[0].originalname).toBe('owlbert.png');
          expect(req.files[0].mimetype).toBe('image/png');

          // There's some encoding issues happening between the Puppeteer and test server layer that's adding some extra
          // characters in some line breaks. Since it's difficult to sort out what exactly is going on there, checking
          // just the first 20 characters of both images to see if they match there should be okay!
          expect(Buffer.from(req.files[0].buffer).toString().substring(0, 20)).toBe(owlbert.substring(0, 20));
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async () => {
          const req = await page.evaluate(async () => {
            const har = debugHar(await window.har_multipartData_DataUrl_withParentheses());
            return fetchHar(har).then(res => res.json());
          });

          expect(req.method).toBe('POST');
          expect(req.headers['content-type']).toContain('multipart/form-data');
          expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');

          expect(req.files).toHaveLength(1);
          expect(req.files[0].fieldname).toBe('foo');
          expect(req.files[0].originalname).toBe('owlbert (1).png');
          expect(req.files[0].mimetype).toBe('image/png');

          // There's some encoding issues happening between the Puppeteer and test server layer that's adding some extra
          // characters in some line breaks. Since it's difficult to sort out what exactly is going on there, checking
          // just the first 20 characters of both images to see if they match there should be okay!
          expect(Buffer.from(req.files[0].buffer).toString().substring(0, 20)).toBe(owlbert.substring(0, 20));
        });
      });
    });

    it('should be able to handle `text/plain` payloads', async () => {
      const req = await page.evaluate(async () => {
        const har = debugHar(await window.har_textPlain());
        return fetchHar(har).then(res => res.json());
      });

      expect(req.headers['content-type']).toBe('text/plain');
      expect(req.body).toBe('Hello World');
    });
  });
});

describe('#constructRequest', () => {
  it('should convert HAR object to a HTTP request object', async () => {
    const req = await page.evaluate(async () => {
      const { constructRequest } = fetchHar;
      return serializeRequest(constructRequest(await window.har_jsonWithAuthHar()));
    });

    expect(req.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
    expect(req.method).toBe('PUT');
    expect(req.headers.authorization).toBe('Bearer api-key');
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.body).toBe('{"id":8,"category":{"id":6,"name":"name"},"name":"name"}');
  });

  // Custom user agents on browser requests aren't supported in browsers.
  it('should not include a `User-Agent` header if one is supplied', async () => {
    const req = await page.evaluate(async () => {
      const { constructRequest } = fetchHar;
      return serializeRequest(constructRequest(await window.har_jsonWithAuthHar()));
    });

    expect(req.headers['user-agent']).toBeUndefined();
  });

  describe('Content types', () => {
    it('should be able to handle `application/x-www-form-urlencoded` payloads', async () => {
      const req = await page.evaluate(async () => {
        const { constructRequest } = fetchHar;
        return serializeRequest(constructRequest(await window.har_urlEncodedWithAuthHar()));
      });

      expect(req.url).toBe('http://petstore.swagger.io/v2/pet?a=1&b=2');
      expect(req.method).toBe('PUT');
      expect(req.headers.authorization).toBe('Bearer api-key');

      // Though we have a Content-Type header set to application/json, since the post data is to be treated as
      // `application/x-www-form-urlencoded`, that needs to be the only `Content-Type` header present. This is how
      // Postman handles this case!
      expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(req.body).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
    });

    it('should be able to handle full payloads', async () => {
      const req = await page.evaluate(async () => {
        const { constructRequest } = fetchHar;
        return serializeRequest(constructRequest(await window.har_full()));
      });

      expect(req.url).toBe('https://httpbin.org/post?key=value?foo=bar&foo=baz&baz=abc');
      expect(req.method).toBe('POST');

      expect(req.headers.accept).toBe('application/json');
      expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(req.cookies).toBe('foo=bar; bar=baz');
      expect(req.credentials).toBe('include');

      expect(req.body.toString()).toBe('foo=bar');
    });

    describe('multipart/form-data', () => {
      it("should be able to handle a `multipart/form-data` payload that's a standard object", async () => {
        const req = await page.evaluate(async () => {
          const { constructRequest } = fetchHar;
          return serializeRequest(constructRequest(await window.har_multipartFormData()));
        });

        expect(req.url).toBe('https://httpbin.org/post');
        expect(req.method).toBe('POST');
        expect(req.headers['content-type']).toContain('multipart/form-data');
        expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');

        expect(req.body).toContain(`Content-Disposition: form-data; name="foo"

bar`);
      });

      it('should be able to handle a `multipart/form-data` payload with a file', async () => {
        const req = await page.evaluate(async () => {
          const { constructRequest } = fetchHar;
          return serializeRequest(constructRequest(await window.har_multipartData()));
        });

        expect(req.url).toBe('https://httpbin.org/post');
        expect(req.method).toBe('POST');
        expect(req.headers['content-type']).toContain('multipart/form-data');
        expect(req.headers['content-type']).toContain('boundary=----WebKitFormBoundary');

        expect(req.body).toContain(`Content-Disposition: form-data; name="foo"; filename="hello.txt"
Content-Type: text/plain

Hello World`);
      });

      it('should throw an error if `fileName` is present but no file content in `value`', async () => {
        expect.hasAssertions();

        try {
          await page.evaluate(async () => {
            const { constructRequest } = fetchHar;
            return serializeRequest(constructRequest(await window.har_multipartFile()));
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
      const req = await page.evaluate(async () => {
        const { constructRequest } = fetchHar;
        return serializeRequest(constructRequest(await window.har_textPlain()));
      });

      expect(req.url).toBe('https://httpbin.org/post');
      expect(req.method).toBe('POST');
      expect(req.headers['content-type']).toBe('text/plain');
      expect(req.body).toBe('Hello World');
    });
  });
});
