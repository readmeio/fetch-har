import harExamples from 'har-examples';
import nock from 'nock';
import { describe, expect, it } from 'vitest';

import fetchHAR from '../../src/index.js';

describe('#fetchHAR mocking (nock)', () => {
  it('should support mocking a request with `nock`', async () => {
    nock('https://httpbin.org').get('/get').reply(429);

    const res = await fetchHAR(harExamples.short);
    expect(res.status).toBe(429);

    nock.restore();
  });
});
