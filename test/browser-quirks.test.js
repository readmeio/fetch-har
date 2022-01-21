require('isomorphic-fetch');

const { host } = require('@jsdevtools/host-environment');
const { expect } = require('chai');
const fetchHar = require('..');
const harExamples = require('har-examples');

const owlbert = require('./fixtures/owlbert-dataurl.json');

describe('#fetch (Browser-only quirks)', function () {
  beforeEach(function () {
    if (host.node) {
      this.skip('This test suite should only run in the browser.');
    }
  });

  describe('multipart/form-data', function () {
    it("should support a `multipart/form-data` request that's a standard object", async function () {
      const res = await fetchHar(harExamples['multipart-form-data']).then(r => r.json());

      expect(res.form).to.deep.equal({ foo: 'bar' });
      expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(133); // Varies depending on the boundary being used.
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should support a `multipart/form-data` request with a plaintext file encoded in the HAR', async function () {
      const res = await fetchHar(harExamples['multipart-data']).then(r => r.json());
      expect(res.files).to.deep.equal({ foo: 'Hello World' });

      expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(189);
      expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
    });

    it('should throw an error if `fileName` is present without `value` or a mapping', function () {
      expect(() => {
        fetchHar(harExamples['multipart-file']);
      }).to.throw(/doesn't have access to the filesystem/);
    });

    describe('`files` option', function () {
      it('should support File objects', async function () {
        const res = await fetchHar(harExamples['multipart-data-dataurl'], {
          files: {
            'owlbert.png': new File([owlbert], 'owlbert.png', { type: 'image/png' }),
          },
        }).then(r => r.json());

        expect(res.files).to.deep.equal({ foo: owlbert });
        expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(737);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should throw on an unsupported type', function () {
        expect(() => {
          fetchHar(harExamples['multipart-data-dataurl'], {
            files: {
              'owlbert.png': new Blob([owlbert], { type: 'image/png' }),
            },
          });
        }).to.throw('An unknown object has been supplied into the `files` config for use.');
      });
    });

    describe('data URLs', function () {
      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async function () {
        const res = await fetchHar(harExamples['multipart-data-dataurl']).then(r => r.json());

        expect(res.files).to.deep.equal({ foo: owlbert });
        expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(758);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });

      it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async function () {
        const har = JSON.parse(JSON.stringify(harExamples['multipart-data-dataurl']));
        har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
        har.log.entries[0].request.postData.params[0].value =
          har.log.entries[0].request.postData.params[0].value.replace(
            'name=owlbert.png;',
            `name=${encodeURIComponent('owlbert (1).png')};`
          );

        const res = await fetchHar(har).then(r => r.json());
        expect(res.files).to.deep.equal({ foo: owlbert.replace('owlbert.png', encodeURIComponent('owlbert (1).png')) });
        expect(parseInt(res.headers['Content-Length'], 10)).to.be.at.least(768);
        expect(res.headers['Content-Type']).to.match(/^multipart\/form-data; boundary=(.*)$/);
      });
    });
  });
});