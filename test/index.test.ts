import type { Har } from 'har-format';

import { host } from '@jsdevtools/host-environment';
import harExamples from 'har-examples';
import { describe, it, expect } from 'vitest';

import fetchHAR from '../src/index.js';

import invalidHeadersHAR from './fixtures/invalid-headers.har.json';
import owlbertDataURL from './fixtures/owlbert.dataurl.json';
import urlEncodedWithAuthHAR from './fixtures/urlencoded-with-auth.har.json';

describe('fetch-har', () => {
  it('should throw if it looks like you are missing a valid HAR definition', () => {
    expect(fetchHAR).rejects.toThrow('Missing HAR definition');
    // @ts-expect-error deliberately bad data
    expect(fetchHAR.bind(null, { log: {} })).rejects.toThrow('Missing log.entries array');
    // @ts-expect-error deliberately bad data
    expect(fetchHAR.bind(null, { log: { entries: [] } })).rejects.toThrow('Missing log.entries array');
  });

  it.skipIf(
    !host.node, // Custom user agents are not supported in browser environments.
  )('should make a request with a custom user agent if specified', async () => {
    const res = await fetchHAR(harExamples.short, { userAgent: 'test-app/1.0' }).then(r => r.json());
    expect(res.headers['User-Agent']).toBe('test-app/1.0');
  });

  it('should catch and toss invalid headers present in a HAR', async () => {
    const res = await fetchHAR(invalidHeadersHAR as Har).then(r => r.json());
    expect(res.headers['X-Api-Key']).toBe('asdf1234');
    expect(res.headers['X-Api-Key (invalid)']).toBeUndefined();
  });

  describe('custom options', () => {
    it('should support supplying custom headers in a `Headers` instance', async () => {
      const res = await fetchHAR(harExamples['text-plain'], {
        init: {
          headers: new Headers({
            'x-custom-header': 'buster',
          }),
        },
      }).then(r => r.json());

      expect(res.headers['X-Custom-Header']).toBe('buster');
    });

    it('should support supplying custom headers as an object', async () => {
      const res = await fetchHAR(harExamples['text-plain'], {
        init: {
          headers: {
            'x-custom-header': 'buster',
          },
        },
      }).then(r => r.json());

      expect(res.headers['X-Custom-Header']).toBe('buster');
    });
  });

  describe('integrations', () => {
    it('should support `text/plain` requests', async () => {
      const res = await fetchHAR(harExamples['text-plain']).then(r => r.json());

      expect(res.args).toStrictEqual({});
      expect(res.data).toBe('Hello World');
      expect(res.files).toStrictEqual({});
      expect(res.form).toStrictEqual({});
      expect(parseInt(res.headers['Content-Length'], 10)).toBe(11);
      expect(res.headers['Content-Type']).toBe('text/plain');
      expect(res.json).toBeNull();
      expect(res.url).toBe('https://httpbin.org/post');
    });

    it('should support requests with array query parameters', async () => {
      const res = await fetchHAR(harExamples.query).then(r => r.json());

      expect(res.args).toStrictEqual({ baz: 'abc', foo: ['bar', 'baz'], key: 'value' });
      expect(res.url).toBe('https://httpbin.org/get?key=value&foo=bar&foo=baz&baz=abc');
    });

    it('should not double encode query parameters', async () => {
      const res = await fetchHAR(harExamples['query-encoded']).then(r => r.json());

      expect(res.args).toStrictEqual({
        array: ['something&nothing=true', 'nothing&something=false', 'another item'],
        stringArray: 'where[4]=10',
        stringHash: 'hash#data',
        stringPound: 'something&nothing=true',
        stringWeird: 'properties["$email"] == "testing"',
      });

      expect(res.url).toBe(
        'https://httpbin.org/anything?stringPound=something%26nothing%3Dtrue&stringHash=hash%23data&stringArray=where[4]%3D10&stringWeird=properties["%24email"] %3D%3D "testing"&array=something%26nothing%3Dtrue&array=nothing%26something%3Dfalse&array=another item',
      );
    });

    it('should support requests with cookies', async () => {
      const res = await fetchHAR(harExamples.cookies).then(r => r.json());

      if (host.browser) {
        /**
         * This assertion looks funky but because we're making a cross-origin request here we aren't
         * going to have cookies present here even despite us sending `credentials: include`. We'll
         * only be able to detect cookies here if we mock the server out, which we can't do in the
         * browser.
         *
         * @todo we should try mocking this request instead to make sure that cookies are sent
         */
        expect(res.cookies).toStrictEqual({});
      } else {
        expect(res.cookies).toStrictEqual({
          bar: 'baz',
          foo: 'bar',
        });
      }
    });

    it('should support `application/x-www-form-urlencoded` requests with auth', async () => {
      const res = await fetchHAR(urlEncodedWithAuthHAR as unknown as Har).then(r => r.json());

      expect(res.args).toStrictEqual({ a: '1', b: '2' });
      expect(res.data).toBe('');
      expect(res.files).toStrictEqual({});
      expect(res.form).toStrictEqual({ category: '{"id":6,"name":"name"}', id: '8', name: 'name' });
      expect(res.headers.Authorization).toBe('Bearer api-key');
      expect(parseInt(res.headers['Content-Length'], 10)).toBe(68);
      expect(res.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(res.json).toBeNull();
      expect(res.url).toBe('https://httpbin.org/post?a=1&b=2');
    });

    it('should support requests that cover the entire HAR spec', async () => {
      const res = await fetchHAR(harExamples.full).then(r => r.json());

      expect(res.args).toStrictEqual({ baz: 'abc', foo: ['bar', 'baz'], key: 'value' });
      expect(res.data).toBe('');
      expect(res.files).toStrictEqual({});
      expect(res.form).toStrictEqual({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).toBe(7);
      expect(res.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      // We can't set cookies in the browser within this test environment.
      if (host.node) {
        expect(res.headers.Cookie).toBe('foo=bar; bar=baz');
      }

      expect(res.json).toBeNull();
      expect(res.url).toBe('https://httpbin.org/post?key=value&foo=bar&foo=baz&baz=abc');
    });

    describe('binary handling', () => {
      it('should support a `image/png` request', async () => {
        const har = harExamples['image-png'];
        const res = await fetchHAR(har).then(r => r.json());

        expect(res.args).toStrictEqual({});
        expect(res.data).toBe(har.log.entries[0].request.postData.text);
        expect(res.files).toStrictEqual({});
        expect(res.form).toStrictEqual({});
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(575);
        expect(res.headers['Content-Type']).toBe('image/png');
        expect(res.json).toBeNull();
        expect(res.url).toBe('https://httpbin.org/post');
      });
    });

    describe('multipart/form-data', () => {
      it('should throw an error if `fileName` is present without `value` or a mapping', () => {
        expect(fetchHAR(harExamples['multipart-file'])).rejects.toThrow(/doesn't have access to the filesystem/);
      });

      describe('`files` option', () => {
        it('should throw on an unsupported type', () => {
          expect(
            fetchHAR(harExamples['multipart-data-dataurl'], {
              files: {
                'owlbert.png': new Blob([owlbertDataURL], { type: 'image/png' }),
              },
            }),
          ).rejects.toThrow('An unknown object has been supplied into the `files` config for use.');
        });
      });
    });

    describe('quirks', () => {
      it('should not fail if `postData.text` is `undefined`', () => {
        const har = {
          log: {
            entries: [
              {
                request: {
                  cookies: [],
                  headers: [
                    {
                      name: 'Content-Type',
                      value: 'application/json',
                    },
                  ],
                  headersSize: 0,
                  queryString: [],
                  postData: {
                    mimeType: 'application/json',
                    text: undefined,
                  },
                  bodySize: 0,
                  method: 'GET',
                  url: 'https://httpbin.org/anything',
                  httpVersion: 'HTTP/1.1',
                },
              },
            ],
          },
        };

        expect(() => {
          // @ts-expect-error deliberately sending non-conforming data
          fetchHAR(har);
        }).not.toThrow("Cannot read property 'length' of undefined");
      });

      it('should support urls with query parameters if the url has an anchor hash in it', async () => {
        const har = {
          log: {
            entries: [
              {
                request: {
                  cookies: [],
                  headers: [
                    {
                      name: 'content-type',
                      value: 'multipart/form-data',
                    },
                  ],
                  headersSize: 0,
                  queryString: [
                    {
                      name: 'dog_id',
                      value: 'buster18',
                    },
                  ],
                  postData: {
                    mimeType: 'application/json',
                    text: undefined,
                  },
                  bodySize: 0,
                  method: 'GET',
                  url: 'https://httpbin.org/anything?dog=true#anything',
                  httpVersion: 'HTTP/1.1',
                },
              },
            ],
          },
        };

        // @ts-expect-error deliberately sending non-conforming data
        const res = await fetchHAR(har).then(r => r.json());

        expect(res.args).toStrictEqual({ dog: 'true', dog_id: 'buster18' });
        expect(res.url).toBe('https://httpbin.org/anything?dog=true&dog_id=buster18');
      });
    });
  });
});
