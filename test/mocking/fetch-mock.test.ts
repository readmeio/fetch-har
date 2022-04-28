/* eslint-disable @typescript-eslint/no-var-requires */
import 'isomorphic-fetch';

import { expect } from 'chai';
import fetchMock from 'fetch-mock';
import harExamples from 'har-examples';

describe('#fetchHAR mocking (fetch-mock)', function () {
  it('should support mocking a request with `fetch-mock`', async function () {
    const fetchHAR = require('../../src').default;

    fetchMock.mock(
      {
        url: 'https://httpbin.org/get',
        method: 'get',
      },
      new Response(null, { status: 429 })
    );

    const res = await fetchHAR(harExamples.short);
    expect(res.status).to.equal(429);

    fetchMock.restore();
  });
});
