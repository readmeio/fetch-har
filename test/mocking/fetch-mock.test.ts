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
      new Response('oops!', { status: 404 })
    );

    const res = await fetchHAR(harExamples.short).then(r => r.text());
    expect(res).to.equal('oops!');

    fetchMock.restore();
  });
});
