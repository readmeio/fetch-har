import type { VersionInfo } from '@jsdevtools/host-environment';

import { host } from '@jsdevtools/host-environment';
import harExamples from 'har-examples';
import 'isomorphic-fetch';
import nock from 'nock';
import { describe, it, expect } from 'vitest';

const hasNativeFetch = (host.node as VersionInfo).version >= 18;

describe('#fetchHAR mocking (nock)', function () {
  // eslint-disable-next-line vitest/require-hook
  it.skipIf(
    hasNativeFetch, // Nock does not support Node 18's native `fetch` implementation.
  )('should support mocking a request with `nock`', async function () {
    const { default: fetchHAR } = await import('../../src');

    nock('https://httpbin.org')
      .post('/post')
      .reply(200, uri => ({ uri }));

    const res = await fetchHAR(harExamples['text-plain']).then(r => r.json());
    expect(res).to.deep.equal({
      uri: '/post',
    });

    nock.restore();
  });
});
