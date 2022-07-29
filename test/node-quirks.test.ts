/* eslint-disable @typescript-eslint/no-var-requires */
import type { VersionInfo } from '@jsdevtools/host-environment';
import 'isomorphic-fetch';
import { host } from '@jsdevtools/host-environment';

import { promises as fs } from 'fs';
import { expect } from 'chai';
import harExamples from 'har-examples';
import { FormDataEncoder } from 'form-data-encoder';

import owlbertDataURL from './fixtures/owlbert.dataurl.json';
import owlbertScreenshotDataURL from './fixtures/owlbert-screenshot.dataurl.json';
import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json';

const isNode18 = (host.node as VersionInfo).version >= 18;

describe('#fetchHAR (Node-only quirks)', function () {
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
     */
    if (isNode18) {
      globalThis.File = require('undici').File;
      globalThis.Blob = require('buffer').Blob;
    } else {
      globalThis.File = require('formdata-node').File;
      globalThis.Blob = require('formdata-node').Blob;
    }

    if (!isNode18) {
      // We only need to polyfill handlers for `multipart/form-data` requests below Node 18 as Node
      // 18 natively supports `fetch`.
      if (!globalThis.FormData) {
        globalThis.FormData = require('formdata-node').FormData;
      }
    }

    fetchHAR = require('../src').default;
  });

  it('should throw if you are using a non-compliant FormData polyfill', function () {
    const ogFormData = globalThis.FormData;
    globalThis.FormData = require('form-data');

    expect(() => {
      fetchHAR(harExamples['multipart-form-data']);
    }).to.throw("We've detected you're using a non-spec compliant FormData library.");

    // Reset this to whatever it was originally so we don't corrupt any Node 18+ tests that use a
    // native `FormData` API.
    globalThis.FormData = ogFormData;
  });

  describe('binary handling', function () {
    it('should support an `image/png` request that has a data URL with no file name', async function () {
      const har = JSON.parse(JSON.stringify(harExamples['image-png-no-filename']));

      // Not only is this Owlbert image not what is in the HAR, but the HAR doesn't contain a file name so supplying
      // this buffer to the fetch call will be ignored.
      const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert-shrub.png`);
      const res = await fetchHAR(har, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

      expect(res.data).to.equal(har.log.entries[0].request.postData.text);
    });

    describe('supplemental overrides', function () {
      it('should support a Buffer `files` mapping override for a raw payload data URL', async function () {
        const har = JSON.parse(JSON.stringify(harExamples['image-png']));
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);
        const res = await fetchHAR(har, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

        expect(res.args).to.be.empty;
        expect(res.data).to.equal(
          // Since we uploaded a raw file buffer it isn't going to have `image/png` in the data URL coming back from
          // httpbin; that information will just exist within the `Content-Type` header.
          har.log.entries[0].request.postData.text.replace(
            'data:image/png;name=owlbert.png',
            'data:application/octet-stream'
          )
        );

        expect(res.files).to.be.empty;
        expect(res.form).to.be.empty;
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(400);
        expect(res.headers['Content-Type']).to.equal('image/png');
        expect(res.json).to.be.null;
        expect(res.url).to.equal('https://httpbin.org/post');
      });

      it('should support a File `files` mapping override for a raw payload data URL', async function () {
        // In the HAR is `owlbert.png` but we want to adhoc override that with the contents of `owlbert-shrub.png` here
        // to ensure that the override works.
        const owlbert = new File([owlbertShrubDataURL], 'owlbert.png', { type: 'image/png' });
        const res = await fetchHAR(harExamples['image-png'], { files: { 'owlbert.png': owlbert } }).then(r => r.json());

        expect(res.args).to.be.empty;
        expect(res.data).to.equal(owlbertShrubDataURL);
        expect(res.files).to.be.empty;
        expect(res.form).to.be.empty;
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(877);
        expect(res.headers['Content-Type']).to.equal('image/png');
        expect(res.json).to.be.null;
        expect(res.url).to.equal('https://httpbin.org/post');
      });

      it("should ignore a `files` mapping override if it's neither a Buffer or a File", async function () {
        const res = await fetchHAR(harExamples['image-png'], {
          files: {
            'owlbert.png': 'owlbert.png',
          },
        }).then(r => r.json());

        expect(res.data).to.equal(harExamples['image-png'].log.entries[0].request.postData.text);
      });
    });
  });

  describe('`multipartEncoder` option', function () {
    it("should support a `multipart/form-data` request that's a standard object", async function () {
      const res = await fetchHAR(harExamples['multipart-form-data'], { multipartEncoder: FormDataEncoder }).then(r =>
        r.json()
      );

      expect(res.form).to.deep.equal({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(133);
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async function () {
      const res = await fetchHAR(harExamples['multipart-data'], { multipartEncoder: FormDataEncoder }).then(r =>
        r.json()
      );

      expect(res.files).to.deep.equal({ foo: 'Hello World' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(189);
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    describe('`files` option', function () {
      it('should support Buffers', async function () {
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);

        const res = await fetchHAR(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': owlbert,
          },
          multipartEncoder: FormDataEncoder,
        }).then(r => r.json());

        expect(res.files).to.deep.equal({
          // This won't have `name=owlbert.png` in the data URL that comes back to us because we sent a raw file buffer.
          foo: owlbertDataURL.replace('name=owlbert.png;', ''),
        });

        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(579);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/);
      });

      it('should support File objects', async function () {
        const res = await fetchHAR(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': new File([owlbertDataURL], 'owlbert.png', { type: 'image/png' }),
          },
          multipartEncoder: FormDataEncoder,
        }).then(r => r.json());

        expect(res.files).to.deep.equal({ foo: owlbertDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(754);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should support filenames with characters that are encoded with `encodeURIComponent`', async function () {
        const encodedFilename = encodeURIComponent('owlbert screen shot 2022-07-29 at 11.05.56 AM.png');

        // We're intentionally corrupting the data URL with a junk base64 payload in order to test
        // that the the file we're supplying below is delivered.
        const har = JSON.parse(JSON.stringify(harExamples['multipart-data-dataurl']));
        har.log.entries[0].request.postData.params[0].fileName = encodedFilename;
        har.log.entries[0].request.postData.params[0].value = `data:image/png;name=${encodedFilename};base64,YnVzdGVy`;

        const res = await fetchHAR(har, {
          files: {
            'owlbert screen shot 2022-07-29 at 11.05.56 AM.png': new File(
              [owlbertScreenshotDataURL],
              'owlbert screen shot 2022-07-29 at 11.05.56 AM.png.png',
              { type: 'image/png' }
            ),
          },
          multipartEncoder: FormDataEncoder,
        }).then(r => r.json());

        expect(res.files).to.deep.equal({ foo: owlbertScreenshotDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(36368);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });
    });

    describe('data URLs', function () {
      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async function () {
        const res = await fetchHAR(harExamples['multipart-data-dataurl'], { multipartEncoder: FormDataEncoder }).then(
          r => r.json()
        );

        expect(res.files).to.deep.equal({ foo: owlbertDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(754);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/);
      });

      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async function () {
        const har = JSON.parse(JSON.stringify(harExamples['multipart-data-dataurl']));
        har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
        har.log.entries[0].request.postData.params[0].value =
          har.log.entries[0].request.postData.params[0].value.replace(
            'name=owlbert.png;',
            `name=${encodeURIComponent('owlbert (1).png')};`
          );

        const res = await fetchHAR(har, { multipartEncoder: FormDataEncoder }).then(r => r.json());
        expect(res.files).to.deep.equal({
          foo: owlbertDataURL.replace('owlbert.png', encodeURIComponent('owlbert (1).png')),
        });

        expect(parseInt(res.headers['Content-Length'], 10)).to.equal(764);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/);
      });
    });
  });
});
