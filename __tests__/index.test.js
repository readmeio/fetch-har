const fs = require('fs').promises;
const fetchHar = require('..');
const { constructRequest } = require('..');
const { Blob, File } = require('formdata-node');
const harExamples = require('har-examples');

const invalidHeadersHAR = require('./__fixtures__/invalid-headers.har.json');
const jsonWithAuthHAR = require('./__fixtures__/json-with-auth.har.json');
const urlEncodedWithAuthHAR = require('./__fixtures__/urlencoded-with-auth.har.json');

console.logx = obj => {
  console.log(require('util').inspect(obj, false, null, true));
};

beforeEach(() => {
  globalThis.fetch = require('node-fetch');
  globalThis.Headers = require('node-fetch').Headers;
  globalThis.Request = require('node-fetch').Request;
  globalThis.FormData = require('formdata-node').FormData;
});

describe('#fetch', () => {
  it('should throw if you are using a non-compliant FormData polyfill', () => {
    globalThis.FormData = require('form-data');

    expect(() => {
      fetchHar(harExamples['multipart-form-data']);
    }).toThrow("We've detected you're using a non-spec compliant FormData library.");
  });

  it('should throw if it looks like you are missing a valid HAR definition', () => {
    expect(fetchHar).toThrow('Missing HAR definition');
    expect(fetchHar.bind(null, { log: {} })).toThrow('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).toThrow('Missing log.entries array');
  });

  it('should make a request with a custom user agent if specified', async () => {
    const res = await fetchHar(harExamples.short, { userAgent: 'test-app/1.0' }).then(r => r.json());
    expect(res.headers['User-Agent']).toBe('test-app/1.0');
  });

  it('should catch and toss invalid headers present in a HAR', async () => {
    const res = await fetchHar(invalidHeadersHAR).then(r => r.json());
    expect(res.headers['X-Api-Key']).toBe('asdf1234');
    expect(res.headers['X-Api-Key (invalid)']).toBeUndefined();
    expect(Object.keys(res.headers)).toHaveLength(8);
  });

  describe('integrations', () => {
    it('should support `text/plain` requests', async () => {
      const res = await fetchHar(harExamples['text-plain']).then(r => r.json());
      expect(res).toStrictEqual({
        args: {},
        data: 'Hello World',
        files: {},
        form: {},
        headers: expect.objectContaining({
          'Content-Length': '11',
          'Content-Type': 'text/plain',
        }),
        json: null,
        origin: expect.any(String),
        url: 'https://httpbin.org/post',
      });
    });

    it('should support requests with cookies', async () => {
      const res = await fetchHar(harExamples.cookies).then(r => r.json());
      expect(res).toStrictEqual({
        cookies: {
          bar: 'baz',
          foo: 'bar',
        },
      });
    });

    it('should support `application/x-www-form-urlencoded` requests with auth', async () => {
      const res = await fetchHar(urlEncodedWithAuthHAR).then(r => r.json());
      expect(res).toStrictEqual({
        args: { a: '1', b: '2' },
        data: '',
        files: {},
        form: { category: '{"id":6,"name":"name"}', id: '8', name: 'name' },
        headers: expect.objectContaining({
          Authorization: 'Bearer api-key',
          'Content-Length': '68',
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        json: null,
        origin: expect.any(String),
        url: 'https://httpbin.org/post?a=1&b=2',
      });
    });

    it('should support requests that cover the entire HAR spec', async () => {
      const res = await fetchHar(harExamples.full).then(r => r.json());
      expect(res).toStrictEqual({
        args: { baz: 'abc', foo: 'baz', key: 'value?foo=bar' },
        data: '',
        files: {},
        form: { foo: 'bar' },
        headers: expect.objectContaining({
          'Content-Length': '7',
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'foo=bar; bar=baz',
        }),
        json: null,
        origin: expect.any(String),
        url: 'https://httpbin.org/post?key=value%3Ffoo=bar&foo=baz&baz=abc',
      });
    });

    describe('multipart/form-data', () => {
      it("should support a `multipart/form-data` request that's a standard object", async () => {
        const res = await fetchHar(harExamples['multipart-form-data']).then(r => r.json());
        expect(res.form).toStrictEqual({ foo: 'bar' });
        expect(res.headers).toStrictEqual(
          expect.objectContaining({
            'Content-Length': '133',
            'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
          })
        );
      });

      describe('files', () => {
        it('should throw an error if `fileName` is present without `value` or a mapping', () => {
          expect(() => {
            fetchHar(harExamples['multipart-file']);
          }).toThrow(/doesn't have access to the filesystem/);
        });

        it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async () => {
          const res = await fetchHar(harExamples['multipart-data']).then(r => r.json());

          expect(res.files).toStrictEqual({ foo: 'Hello World' });
          expect(res.headers).toStrictEqual(
            expect.objectContaining({
              'Content-Length': '189',
              'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
            })
          );
        });

        describe('file mapping option', () => {
          let owlbert;
          let owlbertDataURL;

          beforeEach(async () => {
            owlbert = await fs.readFile(`${__dirname}/__fixtures__/owlbert.png`);

            // If you decode this data URL and save it to the filesystem it'll be a copy of `owlbert.png`.
            owlbertDataURL =
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAMCAYAAABbayygAAABV0lEQVR4AWNwL/Bh0FGQ9FWUENUGsZExPz8/h5gArzmIDRZw1VfpSfeyagIJgiRBYkCg7mOl72akIt0KVwhSVB5o9SPESutJWajzquJgx/lRDganc7zNX3obq9SiKKxN8P/fmB33vybc7j+MHe1k8t9RSy4NrrA4K2Xp1k0b/peUlPzPjfL5v3bpgv9NTc3/48JD/sOsBju4JDnq6MS+3v9uLlb/pzeY/l82r+9/cIA/GNtrK2wFqQH7uDzY/gXQOrBpbemi/xO9DH4B2WCrQe4GqWHQVRDfBnLXpDTX/z3xTii4xM/if4iF5n+QGgZjZamvIIH5RT5wPKvQC0wDDQAr1FMQ/8YgK8zfAzIeqgCOp+V5gBW6Giq9A6kB+9pUXTiqINjwJ9B6uKKmBHuwW7XkhFeAYg2sMMWXQTvJh/2Uu6nciTgXvVsg7Gsp+xAkZqHPIA1SAwCKnrxJusHahgAAAABJRU5ErkJggg==';
          });

          it('should support Buffer objects', async () => {
            const res = await fetchHar(harExamples['multipart-data-dataurl'], {
              files: {
                'owlbert.png': owlbert,
              },
            }).then(r => r.json());

            expect(res.files).toStrictEqual({ foo: owlbertDataURL });
            expect(res.headers).toStrictEqual(
              expect.objectContaining({
                'Content-Length': '579',
                'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
              })
            );
          });

          it('should support File objects', async () => {
            const res = await fetchHar(harExamples['multipart-data-dataurl'], {
              files: {
                'owlbert.png': new File([owlbert], 'owlbert.png', { type: 'image/png' }),
              },
            }).then(r => r.json());

            expect(res.files).toStrictEqual({ foo: owlbertDataURL });
            expect(res.headers).toStrictEqual(
              expect.objectContaining({
                'Content-Length': '579',
                'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
              })
            );
          });

          it('should throw on an unsupported type', () => {
            expect(() => {
              fetchHar(harExamples['multipart-data-dataurl'], {
                files: {
                  'owlbert.png': new Blob([owlbert.toString()], { type: 'image/png' }),
                },
              });
            }).toThrow('An unknown object has been supplied into the `files` config for use.');
          });
        });
      });

      // Though thests tests are testling if we'll a data URL properly,  the image contained within this data URL isn't
      // guaranteed here to be right because the PNG to data URL conversion sometimes screws images up.
      //
      // We're just asserting here that we aren't mangling what we're dealing with.
      describe('base64-encoded data URLs', () => {
        let owlbert;

        beforeAll(async () => {
          owlbert = await fs.readFile(`${__dirname}/__fixtures__/owlbert.png`).then(img => img.toString());
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
          const res = await fetchHar(harExamples['multipart-data-dataurl']).then(r => r.json());
          expect(res.files).toStrictEqual({ foo: owlbert });
          expect(res.headers).toStrictEqual(
            expect.objectContaining({
              'Content-Length': '887',
              'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
            })
          );
        });

        it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async () => {
          const har = JSON.parse(JSON.stringify(harExamples['multipart-data-dataurl']));
          har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
          har.log.entries[0].request.postData.params[0].value =
            har.log.entries[0].request.postData.params[0].value.replace(
              'name=owlbert.png;',
              `name=${encodeURIComponent('owlbert (1).png')};`
            );

          const res = await fetchHar(har).then(r => r.json());
          expect(res.files).toStrictEqual({ foo: owlbert });
          expect(res.headers).toStrictEqual(
            expect.objectContaining({
              'Content-Length': '891',
              'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/),
            })
          );
        });
      });
    });
  });
});

describe('#constructRequest', () => {
  it('should convert a HAR object to a HTTP request object', () => {
    const request = constructRequest(harExamples.full);

    expect(request.url).toBe('https://httpbin.org/post?key=value?foo=bar&foo=baz&baz=abc');
    expect(request.method).toBe('POST');

    expect(Array.from(request.headers)).toStrictEqual([
      ['accept', 'application/json'],
      ['content-type', 'application/x-www-form-urlencoded'],
      ['cookie', 'foo=bar; bar=baz'],
    ]);

    expect(request.body.toString()).toBe('foo=bar');
  });
});
