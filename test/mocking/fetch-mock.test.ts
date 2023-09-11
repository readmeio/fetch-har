import fetchMock from 'fetch-mock';
import harExamples from 'har-examples';
import { describe, it, expect } from 'vitest';

import fetchHAR from '../../src';

describe('#fetchHAR mocking (fetch-mock)', () => {
  it('should support mocking a request with `fetch-mock`', async () => {
    fetchMock.mock(
      {
        url: 'https://httpbin.org/get',
        method: 'get',
      },
      new Response(null, { status: 429 }),
    );

    const res = await fetchHAR(harExamples.short);
    expect(res.status).toBe(429);

    fetchMock.restore();
  });
});
