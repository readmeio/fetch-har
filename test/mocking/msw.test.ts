import harExamples from 'har-examples';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect } from 'vitest';

import fetchHAR from '../../src/index.js';

describe('#fetchHAR mocking (msw)', () => {
  it('should support mocking a request with `msw`', async () => {
    const server = setupServer(
      rest.get('https://httpbin.org/get', (req, res, ctx) => {
        return res(ctx.status(429));
      }),
    );

    server.listen();

    const res = await fetchHAR(harExamples.short);
    expect(res.status).toBe(429);

    server.close();
  });
});
