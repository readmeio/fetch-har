import fetchMock from 'fetch-mock';
import harExamples from 'har-examples';
import 'isomorphic-fetch';
import { describe, it, expect } from 'vitest';

describe('#fetchHAR mocking (fetch-mock)', () => {
  it('should support mocking a request with `fetch-mock`', async () => {
    const { default: fetchHAR } = await import('../../src');

    fetchMock.mock(
      {
        url: 'https://httpbin.org/get',
        method: 'get',
      },
      new Response(null, { status: 429 }),
    );

    const res = await fetchHAR(harExamples.short);
    expect(res.status).to.equal(429);

    fetchMock.restore();
  });
});
