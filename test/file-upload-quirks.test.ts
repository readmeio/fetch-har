import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

import fs from 'node:fs/promises';
import os from 'node:os';

import DatauriParser from 'datauri/parser';
import express from 'express';
import multer from 'multer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import fetchHAR from '../src/index.js';
import arrayOfOwlbertsHAR from './fixtures/array-of-owlberts.har.json' with { type: 'json' };
import owlbertDataURL from './fixtures/owlbert.dataurl.json' with { type: 'json' };
import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json' with { type: 'json' };

describe('#fetchHAR (Node-only quirks)', () => {
  let app: Express;
  let listener: Server;

  beforeEach(async () => {
    /**
     * Due to a bug with `multipart/form-data` handling on multiple files in HTTPBin we need to
     * spin up our own server for these tests.
     *
     * @see {@link https://github.com/postmanlabs/httpbin/issues/682}
     */
    const upload = multer({ dest: os.tmpdir() });
    app = express();

    app.post('/', upload.array('files', 12), (req, res) => {
      res.status(200).json(req.files);
    });

    listener = await app.listen();
  });

  afterEach(() => {
    return listener.close();
  });

  it('should support sending multiple images to the same parameter', async () => {
    const har = JSON.parse(JSON.stringify(arrayOfOwlbertsHAR));
    // biome-ignore lint/style/noNonNullAssertion: This is fine.
    har.log.entries[0].request.url = `http://localhost:${(listener.address() as AddressInfo)!.port}/`;

    const res = await fetchHAR(har, {
      files: {
        // In the HAR are corrupted data URLs so in order to test that the override actually works
        // we're filling them in here with the actual file contents. The response that we get back
        // should have these, not the bad data.
        'owlbert.png': await fs.readFile(`${__dirname}/fixtures/owlbert.png`),
        'owlbert-shrub.png': await fs.readFile(`${__dirname}/fixtures/owlbert-shrub.png`),
      },
    }).then(r => r.json());

    const parser = new DatauriParser();

    /**
     * The data that's stored in `res[*].path` is the image binary that we uploaded but in order to
     * assert that it matches what we uploaded, and wasn't corrupted, we're converting it into a
     * data URI. Unfortunately the `datauri` package that we're using doesn't add filename `name`
     * metadata into ones it generates so we need to pop those off before we do our assertions.
     */
    expect(parser.format('.png', await fs.readFile(res[0].path)).base64).toBe(
      owlbertDataURL.replace('data:image/png;name=owlbert.png;base64,', ''),
    );

    expect(parser.format('.png', await fs.readFile(res[1].path)).base64).toBe(
      owlbertShrubDataURL.replace('data:image/png;name=owlbert-shrub.png;base64,', ''),
    );
  });
});
