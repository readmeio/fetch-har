import { host } from '@jsdevtools/host-environment';
import harExamples from 'har-examples';
import { describe, expect, it } from 'vitest';

import fetchHAR from '../src/index.js';
import owlbert from './fixtures/owlbert.dataurl.json' with { type: 'json' };
import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json' with { type: 'json' };

describe.skipIf(host.node)('#fetchHAR (Browser-only quirks)', () => {
  describe('binary handling', () => {
    describe('supplemental overrides', () => {
      it('should support a File `files` mapping override for a raw payload data URL', async () => {
        // In the HAR is `owlbert.png` but we want to adhoc override that with the contents of
        // `owlbert-shrub.png` here to ensure that the override works.
        const res = await fetchHAR(harExamples['image-png'], {
          files: {
            'owlbert.png': new File([owlbertShrubDataURL], 'owlbert.png', { type: 'image/png' }),
          },
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
    });
  });

  describe('multipart/form-data', () => {
    it("should support a `multipart/form-data` request that's a standard object", async () => {
      const res = await fetchHAR(harExamples['multipart-form-data']).then(r => r.json());

      expect(res.form).toStrictEqual({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).toBeGreaterThanOrEqual(133);
      expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async () => {
      const res = await fetchHAR(harExamples['multipart-data']).then(r => r.json());
      expect(res.files).toStrictEqual({ foo: 'Hello World' });

      expect(parseInt(res.headers['Content-Length'], 10)).toBeGreaterThanOrEqual(189);
      expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should throw an error if `fileName` is present without `value` or a mapping', async () => {
      await expect(fetchHAR(harExamples['multipart-file'])).rejects.toThrow(/doesn't have access to the filesystem/);
    });

    describe('`files` option', () => {
      it('should support File objects', async () => {
        const res = await fetchHAR(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': new File([owlbert], 'owlbert.png', { type: 'image/png' }),
          },
        }).then(r => r.json());

        expect(res.files).toStrictEqual({ foo: owlbert });
        expect(parseInt(res.headers['Content-Length'], 10)).toBeGreaterThanOrEqual(737);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should throw on an unsupported type', async () => {
        await expect(
          fetchHAR(harExamples['multipart-data-dataurl'], {
            files: {
              'owlbert.png': new Blob([owlbert], { type: 'image/png' }),
            },
          }),
        ).rejects.toThrow('An unknown object has been supplied into the `files` config for use.');
      });
    });

    describe('data URLs', () => {
      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
        const res = await fetchHAR(harExamples['multipart-data-dataurl']).then(r => r.json());

        expect(res.files).toStrictEqual({ foo: owlbert });
        expect(parseInt(res.headers['Content-Length'], 10)).toBeGreaterThanOrEqual(758);
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
        expect(res.files).toStrictEqual({ foo: owlbert.replace('owlbert.png', encodeURIComponent('owlbert (1).png')) });
        expect(parseInt(res.headers['Content-Length'], 10)).toBeGreaterThanOrEqual(768);
        expect(res.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=(.*)$/);
      });
    });
  });
});
