/* eslint-disable @typescript-eslint/no-var-requires */
import type { VersionInfo } from '@jsdevtools/host-environment';
import type { Har } from 'har-format';
import 'isomorphic-fetch';
import { host } from '@jsdevtools/host-environment';

import { expect } from 'chai';
import harExamples from 'har-examples';

import owlbertDataURL from './fixtures/owlbert.dataurl.json';

import invalidHeadersHAR from './fixtures/invalid-headers.har.json';
import urlEncodedWithAuthHAR from './fixtures/urlencoded-with-auth.har.json';

describe('fetch-har', function () {
  let fetchHAR;

  beforeEach(function () {
    /**
     * Under Node 18's native `fetch` implementation if a `File` global doesn't exist it'll polyfill
     * its own implementation. Normally this works fine, but its implementation is **different**
     * than the one that `formdata-node` ships and when we use the `formdata-node` one under Node
     * 18 `type` options that we set into `File` instances don't get picked up, resulting in
     * multipart payloads being sent as `application/octet-stream` instead of whatever content type
     * was attached to that file.
     *
     * This behavior also extends to Undici's usage of `Blob` as well where the `Blob` that ships
     * with `formdata-node` behaves differently than the `Blob` that is part of the Node `buffer`
     * module, which Undici wants you to use.
     *
     * `NODE_ENV` is set to `production` when Karma runs this code and we don't need to polyfill
     * APIs that are already available in the browser.
     */
    if (process.env.NODE_ENV !== 'production') {
      if (!globalThis.File) {
        globalThis.FormData = require('formdata-node').FormData;
      }

      const isNode18 = (host.node as VersionInfo).version >= 18;
      if (isNode18) {
        globalThis.File = require('undici').File;
        globalThis.Blob = require('buffer').Blob;
      } else {
        globalThis.File = require('formdata-node').File;
        globalThis.Blob = require('formdata-node').Blob;
      }
    }

    fetchHAR = require('../src').default;
  });

  it('should throw if it looks like you are missing a valid HAR definition', function () {
    expect(fetchHAR).to.throw('Missing HAR definition');
    expect(fetchHAR.bind(null, { log: {} })).to.throw('Missing log.entries array');
    expect(fetchHAR.bind(null, { log: { entries: [] } })).to.throw('Missing log.entries array');
  });

  it('should make a request with a custom user agent if specified', async function () {
    if (!host.node) {
      // Custom user agents are not supported in browser environments.
      this.skip();
    }

    const res = await fetchHAR(harExamples.short, { userAgent: 'test-app/1.0' }).then(r => r.json());
    expect(res.headers['User-Agent']).to.equal('test-app/1.0');
  });

  it('should catch and toss invalid headers present in a HAR', async function () {
    const res = await fetchHAR(invalidHeadersHAR as Har).then(r => r.json());
    expect(res.headers['X-Api-Key']).to.equal('asdf1234');
    expect(res.headers['X-Api-Key (invalid)']).to.be.undefined;
  });

  describe('custom options', function () {
    it('should support supplying custom headers in a `Headers` instance', async function () {
      const res = await fetchHAR(harExamples['text-plain'], {
        init: {
          headers: new Headers({
            'x-custom-header': 'buster',
          }),
        },
      }).then(r => r.json());

      expect(res.headers['X-Custom-Header']).to.equal('buster');
    });

    it('should support supplying custom headers as an object', async function () {
      const res = await fetchHAR(harExamples['text-plain'], {
        init: {
          headers: {
            'x-custom-header': 'buster',
          },
        },
      }).then(r => r.json());

      expect(res.headers['X-Custom-Header']).to.equal('buster');
    });
  });

  describe('integrations', function () {
    it('should support `text/plain` requests', async function () {
      const res = await fetchHAR(harExamples['text-plain']).then(r => r.json());

      expect(res.args).to.be.empty;
      expect(res.data).to.equal('Hello World');
      expect(res.files).to.be.empty;
      expect(res.form).to.be.empty;
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(11);
      expect(res.headers['Content-Type']).to.equal('text/plain');
      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post');
    });

    it('should support requests with array query parameters', async function () {
      const res = await fetchHAR(harExamples.query).then(r => r.json());

      expect(res.args).to.deep.equal({ baz: 'abc', foo: ['bar', 'baz'], key: 'value' });
      expect(res.url).to.equal('https://httpbin.org/get?key=value&foo=bar&foo=baz&baz=abc');
    });

    it('should not double encode query parameters', async function () {
      const res = await fetchHAR(harExamples['query-encoded']).then(r => r.json());

      expect(res.args).to.deep.equal({
        array: ['something&nothing=true', 'nothing&something=false', 'another item'],
        stringArray: 'where[4]=10',
        stringHash: 'hash#data',
        stringPound: 'something&nothing=true',
        stringWeird: 'properties["$email"] == "testing"',
      });

      expect(res.url).to.equal(
        'https://httpbin.org/anything?stringPound=something%26nothing%3Dtrue&stringHash=hash%23data&stringArray=where[4]%3D10&stringWeird=properties["%24email"] %3D%3D "testing"&array=something%26nothing%3Dtrue&array=nothing%26something%3Dfalse&array=another item'
      );
    });

    it('should support requests with cookies', async function () {
      const res = await fetchHAR(harExamples.cookies).then(r => r.json());

      if (host.browser) {
        // This assertion looks funky but because we're making a cross-origin request here we aren't going to have
        // cookies present here even despite us sending `credentials: include`. We'll only be able to detect cookies
        // here if we mock the server out, which we can't do in the browser.
        //
        // @todo we should try mocking this request instead to make sure that cookies are sent
        expect(res.cookies).to.be.empty;
      } else {
        expect(res.cookies).to.deep.equal({
          bar: 'baz',
          foo: 'bar',
        });
      }
    });

    it('should support `application/x-www-form-urlencoded` requests with auth', async function () {
      const res = await fetchHAR(urlEncodedWithAuthHAR as unknown as Har).then(r => r.json());

      expect(res.args).to.deep.equal({ a: '1', b: '2' });
      expect(res.data).to.equal('');
      expect(res.files).to.be.empty;
      expect(res.form).to.deep.equal({ category: '{"id":6,"name":"name"}', id: '8', name: 'name' });
      expect(res.headers.Authorization).to.equal('Bearer api-key');
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(68);
      expect(res.headers['Content-Type']).to.equal('application/x-www-form-urlencoded');
      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post?a=1&b=2');
    });

    it('should support requests that cover the entire HAR spec', async function () {
      const res = await fetchHAR(harExamples.full).then(r => r.json());

      expect(res.args).to.deep.equal({ baz: 'abc', foo: ['bar', 'baz'], key: 'value' });
      expect(res.data).to.equal('');
      expect(res.files).to.be.empty;
      expect(res.form).to.deep.equal({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(7);
      expect(res.headers['Content-Type']).to.equal('application/x-www-form-urlencoded');

      // We can't set cookies in the browser within this test environment.
      if (host.node) {
        expect(res.headers.Cookie).to.equal('foo=bar; bar=baz');
      }

      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post?key=value&foo=bar&foo=baz&baz=abc');
    });

    describe('binary handling', function () {
      it('should support a `image/png` request', async function () {
        const har = harExamples['image-png'];
        const res = await fetchHAR(har).then(r => r.json());

        expect(res.args).to.be.empty;
        expect(res.data).to.equal(har.log.entries[0].request.postData.text);
        expect(res.files).to.be.empty;
        expect(res.form).to.be.empty;
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(575);
        expect(res.headers['Content-Type']).to.equal('image/png');
        expect(res.json).to.be.null;
        expect(res.url).to.equal('https://httpbin.org/post');
      });
    });

    describe('multipart/form-data', function () {
      it('should throw an error if `fileName` is present without `value` or a mapping', function () {
        expect(() => {
          fetchHAR(harExamples['multipart-file']);
        }).to.throw(/doesn't have access to the filesystem/);
      });

      describe('`files` option', function () {
        it('should throw on an unsupported type', function () {
          expect(() => {
            fetchHAR(harExamples['multipart-data-dataurl'], {
              files: {
                'owlbert.png': new Blob([owlbertDataURL], { type: 'image/png' }),
              },
            });
          }).to.throw('An unknown object has been supplied into the `files` config for use.');
        });
      });
    });

    describe('quirks', function () {
      it('should not fail if `postData.text` is `undefined`', function () {
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
          fetchHAR(har);
        }).not.to.throw("Cannot read property 'length' of undefined");
      });
    });
  });
});
