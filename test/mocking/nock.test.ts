/* eslint-disable @typescript-eslint/no-var-requires */
import type { VersionInfo } from '@jsdevtools/host-environment';
import 'isomorphic-fetch';
import { host } from '@jsdevtools/host-environment';

import { expect } from 'chai';
import nock from 'nock';
import harExamples from 'har-examples';

describe('#fetchHAR mocking (nock)', function () {
  it('should support mocking a request with `nock`', async function () {
    const isNode18 = (host.node as VersionInfo).version >= 18;
    const fetchHAR = require('../../src').default;

    // Nock does not support Node 18's native `fetch` implementation.
    if (isNode18) {
      this.skip();
    }

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
