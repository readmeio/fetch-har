import harExamples from 'har-examples';
import { http } from 'msw';
// not sure why this isn't being picked up by ESLint,
// it definitely is resolving!
// eslint-disable-next-line import/no-unresolved
import { setupServer } from 'msw/node';
import { describe, it, expect } from 'vitest';

import fetchHAR from '../../src/index.js';

describe('#fetchHAR mocking (msw)', () => {
  it('should support mocking a request with `msw`', async () => {
    const server = setupServer(
      http.get('https://httpbin.org/get', () => {
        return new Response(null, { status: 429 });
      }),
    );

    server.listen();

    const res = await fetchHAR(harExamples.short);
    expect(res.status).toBe(429);

    server.close();
  });
});
