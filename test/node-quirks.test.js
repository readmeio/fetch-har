require('isomorphic-fetch');

const fs = require('fs').promises;
const { expect } = require('chai');
const fetchHar = require('..');
const { Blob: BlobPolyfill, File: FilePolyfill } = require('formdata-node');
const harExamples = require('har-examples');
const { FormDataEncoder } = require('form-data-encoder');

const owlbertDataURL = require('./fixtures/owlbert.dataurl.json');
const owlbertShrubDataURL = require('./fixtures/owlbert-shrub.dataurl.json');

const binaryHAR = require('./fixtures/binary.har.json');

describe('#fetch (Node-only quirks)', function () {
  beforeEach(function () {
    globalThis.FormData = require('formdata-node').FormData;

    globalThis.Blob = BlobPolyfill;
    globalThis.File = FilePolyfill;
  });

  it('should throw if you are using a non-compliant FormData polyfill', function () {
    globalThis.FormData = require('form-data');

    expect(() => {
      fetchHar(harExamples['multipart-form-data']);
    }).to.throw("We've detected you're using a non-spec compliant FormData library.");
  });

  describe('binary handling', function () {
    it('should support an `image/png` request that has a data URL with no file name', async function () {
      const har = JSON.parse(JSON.stringify(binaryHAR));
      har.log.entries[0].request.postData.text = har.log.entries[0].request.postData.text.replace(
        'name=owlbert.png;',
        ''
      );

      // Not only is this Owlbert image not what is in the HAR, but the HAR doesn't contain a file name so supplying
      // this buffer to the fetch call will be ignored.
      const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert-shrub.png`);
      const res = await fetchHar(har, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

      expect(res.data).to.equal(har.log.entries[0].request.postData.text);
    });

    describe('supplemental overrides', function () {
      it('should support a Buffer `files` mapping override for a raw payload data URL', async function () {
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);
        const res = await fetchHar(binaryHAR, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

        expect(res.args).to.be.empty;
        expect(res.data).to.equal(
          // Since we uploaded a raw file buffer it isn't going to have `image/png` in the data URL coming back from
          // httpbin; that information will just exist within the `Content-Type` header.
          binaryHAR.log.entries[0].request.postData.text.replace(
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
        const res = await fetchHar(binaryHAR, { files: { 'owlbert.png': owlbert } }).then(r => r.json());

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
        const res = await fetchHar(binaryHAR, { files: { 'owlbert.png': 'owlbert.png' } }).then(r => r.json());

        expect(res.data).to.equal(binaryHAR.log.entries[0].request.postData.text);
      });
    });
  });

  describe('`multipartEncoder` option', function () {
    it("should support a `multipart/form-data` request that's a standard object", async function () {
      const res = await fetchHar(harExamples['multipart-form-data'], { multipartEncoder: FormDataEncoder }).then(r =>
        r.json()
      );

      expect(res.form).to.deep.equal({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.equal(133);
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async function () {
      const res = await fetchHar(harExamples['multipart-data'], { multipartEncoder: FormDataEncoder }).then(r =>
        r.json()
      );

      expect(res.files).to.deep.equal({ foo: 'Hello World' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(189);
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    describe('`files` option', function () {
      it('should support Buffers', async function () {
        const owlbert = await fs.readFile(`${__dirname}/fixtures/owlbert.png`);

        const res = await fetchHar(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': owlbert,
          },
          multipartEncoder: FormDataEncoder,
        }).then(r => r.json());

        expect(res.files).to.deep.equal({
          // This won't have `name=owlbert.png` in the data URL that comes back to us because we sent a raw file buffer.
          foo: owlbertDataURL.replace('name=owlbert.png;', ''),
        });

        expect(res.headers['Content-Length']).to.equal('579');
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/);
      });

      it('should support File objects', async function () {
        const res = await fetchHar(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': new File([owlbertDataURL], 'owlbert.png', { type: 'image/png' }),
          },
          multipartEncoder: FormDataEncoder,
        }).then(r => r.json());

        expect(res.files).to.deep.equal({ foo: owlbertDataURL });
        expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(737);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });
    });

    describe('data URLs', function () {
      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async function () {
        const res = await fetchHar(harExamples['multipart-data-dataurl'], { multipartEncoder: FormDataEncoder }).then(
          r => r.json()
        );

        expect(res.files).to.deep.equal({ foo: owlbertDataURL });
        expect(res.headers['Content-Length']).to.equal('754');
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

        const res = await fetchHar(har, { multipartEncoder: FormDataEncoder }).then(r => r.json());
        expect(res.files).to.deep.equal({
          foo: owlbertDataURL.replace('owlbert.png', encodeURIComponent('owlbert (1).png')),
        });

        expect(res.headers['Content-Length']).to.equal('764');
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=form-data-boundary-(.*)$/);
      });
    });
  });
});
