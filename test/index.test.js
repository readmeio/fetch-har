require('isomorphic-fetch');

const { host } = require('@jsdevtools/host-environment');
const { expect } = require('chai');
const fetchHar = require('../src');
const { constructRequest } = require('../src');
const { Blob: BlobPolyfill, File: FilePolyfill } = require('formdata-node');
const harExamples = require('har-examples');

const invalidHeadersHAR = require('./fixtures/invalid-headers.har.json');
const urlEncodedWithAuthHAR = require('./fixtures/urlencoded-with-auth.har.json');
const owlbertDataURL = require('./fixtures/owlbert-dataurl.json');

describe('#fetch', function () {
  beforeEach(function () {
    if (host.node) {
      globalThis.FormData = require('formdata-node').FormData;

      globalThis.Blob = BlobPolyfill;
      globalThis.File = FilePolyfill;
    }
  });

  describe('#constructRequest', function () {
    it('should convert a HAR object to a HTTP request object', async function () {
      const request = constructRequest(harExamples.full);

      expect(request.url).to.equal('https://httpbin.org/post?key=value?foo=bar&foo=baz&baz=abc');
      expect(request.method).to.equal('POST');

      if (host.node) {
        expect(Array.from(request.headers)).to.deep.equal([
          ['accept', 'application/json'],
          ['content-type', 'application/x-www-form-urlencoded'],
          ['cookie', 'foo=bar; bar=baz'],
        ]);
      } else {
        expect(Array.from(request.headers)).to.deep.equal([
          ['accept', 'application/json'],
          ['content-type', 'application/x-www-form-urlencoded'],
        ]);
      }

      // Inspecting `Request.body` isn't supported in most browsers right now.
      // https://developer.mozilla.org/en-US/docs/Web/API/Request/body
      if (host.node) {
        expect(request.body.toString()).to.equal('foo=bar');
      }
    });
  });

  it('should throw if it looks like you are missing a valid HAR definition', function () {
    expect(fetchHar).to.throw('Missing HAR definition');
    expect(fetchHar.bind(null, { log: {} })).to.throw('Missing log.entries array');
    expect(fetchHar.bind(null, { log: { entries: [] } })).to.throw('Missing log.entries array');
  });

  it('should make a request with a custom user agent if specified', async function () {
    if (!host.node) {
      this.skip('Custom user agents are not supported in browser environments.');
      return;
    }

    const res = await fetchHar(harExamples.short, { userAgent: 'test-app/1.0' }).then(r => r.json());
    expect(res.headers['User-Agent']).to.equal('test-app/1.0');
  });

  it('should catch and toss invalid headers present in a HAR', async function () {
    const res = await fetchHar(invalidHeadersHAR).then(r => r.json());
    expect(res.headers['X-Api-Key']).to.equal('asdf1234');
    expect(res.headers['X-Api-Key (invalid)']).to.be.undefined;
  });

  describe('integrations', function () {
    it('should support `text/plain` requests', async function () {
      const res = await fetchHar(harExamples['text-plain']).then(r => r.json());

      expect(res.args).to.be.empty;
      expect(res.data).to.equal('Hello World');
      expect(res.files).to.be.empty;
      expect(res.form).to.be.empty;
      expect(res.headers['Content-Length']).to.equal('11');
      expect(res.headers['Content-Type']).to.equal('text/plain');
      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post');
    });

    it('should support requests with cookies', async function () {
      const res = await fetchHar(harExamples.cookies).then(r => r.json());

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
      const res = await fetchHar(urlEncodedWithAuthHAR).then(r => r.json());

      expect(res.args).to.deep.equal({ a: '1', b: '2' });
      expect(res.data).to.equal('');
      expect(res.files).to.be.empty;
      expect(res.form).to.deep.equal({ category: '{"id":6,"name":"name"}', id: '8', name: 'name' });
      expect(res.headers.Authorization).to.equal('Bearer api-key');
      expect(res.headers['Content-Length']).to.equal('68');
      expect(res.headers['Content-Type']).to.equal('application/x-www-form-urlencoded');
      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post?a=1&b=2');
    });

    it('should support requests that cover the entire HAR spec', async function () {
      const res = await fetchHar(harExamples.full).then(r => r.json());

      expect(res.args).to.deep.equal({ baz: 'abc', foo: 'baz', key: 'value?foo=bar' });
      expect(res.data).to.equal('');
      expect(res.files).to.be.empty;
      expect(res.form).to.deep.equal({ foo: 'bar' });
      expect(res.headers['Content-Length']).to.equal('7');
      expect(res.headers['Content-Type']).to.equal('application/x-www-form-urlencoded');

      // @todo we should mock this request instead
      if (host.node) {
        expect(res.headers.Cookie).to.equal('foo=bar; bar=baz');
      }

      expect(res.json).to.be.null;
      expect(res.url).to.equal('https://httpbin.org/post?key=value%3Ffoo=bar&foo=baz&baz=abc');
    });

    describe('multipart/form-data', function () {
      it('should throw an error if `fileName` is present without `value` or a mapping', function () {
        expect(() => {
          fetchHar(harExamples['multipart-file']);
        }).to.throw(/doesn't have access to the filesystem/);
      });

      describe('`files` option', function () {
        it('should throw on an unsupported type', function () {
          expect(() => {
            fetchHar(harExamples['multipart-data-dataurl'], {
              files: {
                'owlbert.png': new Blob([owlbertDataURL], { type: 'image/png' }),
              },
            });
          }).to.throw('An unknown object has been supplied into the `files` config for use.');
        });
      });
    });
  });
});
