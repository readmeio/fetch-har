/* eslint-disable @typescript-eslint/no-var-requires */
import type { VersionInfo } from '@jsdevtools/host-environment';
import type { Express } from 'express';

import { promises as fs } from 'fs';

import { host } from '@jsdevtools/host-environment';
import { expect } from 'chai';
import DatauriParser from 'datauri/parser';
import express from 'express';
import { FormDataEncoder } from 'form-data-encoder';
import 'isomorphic-fetch';
import multer from 'multer';
import tempDirectory from 'temp-dir';

import arrayOfOwlbertsHAR from './fixtures/array-of-owlberts.har.json';
import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json';
import owlbertDataURL from './fixtures/owlbert.dataurl.json';

const isNode18 = (host.node as VersionInfo).version >= 18;

describe('#fetchHAR (Node-only quirks)', function () {
  let fetchHAR;
  let app: Express;
  let listener;

  beforeEach(async function () {
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

    /**
     * Due to a bug with `multipart/form-data` handling on multiple files in HTTPBin we need to
     * spin up our own server for these tests.
     *
     * @see {@link https://github.com/postmanlabs/httpbin/issues/682}
     */
    const upload = multer({ dest: tempDirectory });
    app = express();

    app.post('/', upload.array('files', 12), function (req, res) {
      return res.status(200).json(req.files);
    });

    listener = await app.listen();
  });

  afterEach(function () {
    return listener.close();
  });

  it('should support sending multiple images to the same parameter', async function () {
    const har = JSON.parse(JSON.stringify(arrayOfOwlbertsHAR));
    har.log.entries[0].request.url = `http://localhost:${listener.address().port}/`;

    const res = await fetchHAR(har, {
      files: {
        // In the HAR are corrupted data URLs so in order to test that the override actually works
        // we're filling them in here with the actual file contents. The response that we get back
        // should have these, not the bad data.
        'owlbert.png': await fs.readFile(`${__dirname}/fixtures/owlbert.png`),
        'owlbert-shrub.png': await fs.readFile(`${__dirname}/fixtures/owlbert-shrub.png`),
      },
      multipartEncoder: FormDataEncoder,
    }).then(r => r.json());

    const parser = new DatauriParser();

    /**
     * The data that's stored in `res[*].path` is the image binary that we uploaded but in order to
     * assert that it matches what we uploaded, and wasn't corrupted, we're converting it into a
     * data URI. Unfortunately the `datauri` package that we're using doesn't add filename `name`
     * metadata into ones it generates so we need to pop those off before we do our assertions.
     */
    expect(parser.format('.png', await fs.readFile(res[0].path)).base64).to.equal(
      owlbertDataURL.replace('data:image/png;name=owlbert.png;base64,', '')
    );

    expect(parser.format('.png', await fs.readFile(res[1].path)).base64).to.equal(
      owlbertShrubDataURL.replace('data:image/png;name=owlbert-shrub.png;base64,', '')
    );
  });
});
