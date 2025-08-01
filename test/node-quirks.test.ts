import fs from 'node:fs/promises';

import harExamples from 'har-examples';
import { describe, expect, it } from 'vitest';

import fetchHAR from '../src/index.js';
import owlbertDataURL from './fixtures/owlbert.dataurl.json';
import owlbertScreenshotDataURL from './fixtures/owlbert-screenshot.dataurl.json';
import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json';

function isNode24() {
  return process.version.startsWith('v24');
}

describe('#fetchHAR (Node-only quirks)', () => {
  describe('binary handling', () => {
    it('should support an `image/png` request that has a data URL with no file name', async () => {
      const har = JSON.parse(JSON.stringify(harExamples['image-png-no-filename']));

      // Not only is this Owlbert image not what is in the HAR, but the HAR doesn't contain a file
      // name so supplying this buffer to the fetch call will be ignored.
      const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert-shrub.png`);
      const res = await fetchHAR(har, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

      expect(res.data).toBe(har.log.entries[0].request.postData.text);
    });

    describe('supplemental overrides', () => {
      it('should support a Buffer `files` mapping override for a raw payload data URL', async () => {
        const har = JSON.parse(JSON.stringify(harExamples['image-png']));
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);
        const res = await fetchHAR(har, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

        expect(res.args).toStrictEqual({});
        expect(res.data).toBe(
          // Since we uploaded a raw file buffer it isn't going to have `image/png` in the data URL
          // coming back from HTTPBin; that information will just exist within the `Content-Type`
          // header.
          har.log.entries[0].request.postData.text.replace(
            'data:image/png;name=owlbert.png',
            'data:application/octet-stream',
          ),
        );

        expect(res.files).toStrictEqual({});
        expect(res.form).toStrictEqual({});
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(400);
        expect(res.headers['Content-Type']).toBe('image/png');
        expect(res.json).toBeNull();
        expect(res.url).toBe('https://httpbin.org/post');
      });

      it('should support a File `files` mapping override for a raw payload data URL', async () => {
        // In the HAR is `owlbert.png` but we want to adhoc override that with the contents of
        // `owlbert-shrub.png` here to ensure that the override works.
        const owlbert = new File([owlbertShrubDataURL], 'owlbert.png', { type: 'image/png' });
        const res = await fetchHAR(harExamples['image-png'], {
          files: { 'owlbert.png': owlbert },
        }).then(r => r.json());

        expect(res.args).toStrictEqual({});
        expect(res.data).toBe(owlbertShrubDataURL);
        expect(res.files).toStrictEqual({});
        expect(res.form).toStrictEqual({});
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(877);
        expect(res.headers['Content-Type']).toBe('image/png');
        expect(res.json).toBeNull();
        expect(res.url).toBe('https://httpbin.org/post');
      });

      it("should ignore a `files` mapping override if it's neither a Buffer or a File", async () => {
        const res = await fetchHAR(harExamples['image-png'], {
          files: {
            // @ts-expect-error Intentional mistyping.
            'owlbert.png': 'owlbert.png',
          },
        }).then(r => r.json());

        expect(res.data).toBe(harExamples['image-png'].log.entries[0].request.postData?.text);
      });
    });
  });

  describe('multipart requests option', () => {
    it("should support a `multipart/form-data` request that's a standard object", async () => {
      const res = await fetchHAR(harExamples['multipart-form-data']).then(r => r.json());

      expect(res.form).toStrictEqual({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 125 : 123);
      expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async () => {
      const res = await fetchHAR(harExamples['multipart-data']).then(r => r.json());

      expect(res.files).toStrictEqual({ foo: 'Hello World' });
      expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 181 : 179);
      expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
    });

    describe('`files` option', () => {
      it('should support Buffers', async () => {
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);

        const res = await fetchHAR(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': owlbert,
          },
        }).then(r => r.json());

        expect(res.files).toStrictEqual({
          // This won't have `name=owlbert.png` in the data URL that comes back to us because we
          // sent a raw file buffer.
          foo: owlbertDataURL.replace('name=owlbert.png;', ''),
        });

        expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 571 : 569);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should support File objects', async () => {
        const res = await fetchHAR(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': new File([owlbertDataURL], 'owlbert.png', { type: 'image/png' }),
          },
        }).then(r => r.json());

        expect(res.files).toStrictEqual({ foo: owlbertDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 746 : 744);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should support filenames with characters that are encoded with `encodeURIComponent`', async () => {
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
              { type: 'image/png' },
            ),
          },
        }).then(r => r.json());

        expect(res.files).toStrictEqual({ foo: owlbertScreenshotDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 36360 : 36358);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });
    });

    describe('data URLs', () => {
      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
        const res = await fetchHAR(harExamples['multipart-data-dataurl']).then(r => r.json());

        expect(res.files).toStrictEqual({ foo: owlbertDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 746 : 744);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async () => {
        const har = JSON.parse(JSON.stringify(harExamples['multipart-data-dataurl']));
        har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
        har.log.entries[0].request.postData.params[0].value =
          har.log.entries[0].request.postData.params[0].value.replace(
            'name=owlbert.png;',
            `name=${encodeURIComponent('owlbert (1).png')};`,
          );

        const res = await fetchHAR(har).then(r => r.json());
        expect(res.files).toStrictEqual({
          foo: owlbertDataURL.replace('owlbert.png', encodeURIComponent('owlbert (1).png')),
        });

        expect(parseInt(res.headers['Content-Length'], 10)).toBe(isNode24() ? 756 : 754);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });
    });
  });
});
