const fs = require('fs').promises;
const path = require('path');
const fetchHar = require('..');
const { constructRequest } = require('..');
const harExamples = require('har-examples');

console.logx = obj => {
  console.log(require('util').inspect(obj, false, null, true));
};

// https://www.npmjs.com/package/cross-fetch
// https://www.npmjs.com/package/form-data
describe('cross-fetch + form-data', () => {
  beforeEach(() => {
    globalThis.fetch = require('cross-fetch');
    globalThis.Headers = require('cross-fetch').Headers;
    globalThis.Request = require('cross-fetch').Request;
    globalThis.FormData = require('form-data');
  });

  it('should make a request', async () => {
    const res = await fetchHar(harExamples.short).then(r => r.json());
    expect(res).toStrictEqual({
      args: {},
      headers: {
        Accept: '*/*',
        'Accept-Encoding': 'gzip,deflate',
        Host: 'httpbin.org',
        'User-Agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        'X-Amzn-Trace-Id': expect.any(String),
      },
      origin: expect.any(String),
      url: 'https://httpbin.org/get',
    });
  });

  it('should be able to handle full payloads', async () => {
    const res = await fetchHar(harExamples.full).then(r => r.json());
    expect(res).toStrictEqual({
      args: { baz: 'abc', foo: 'baz', key: 'value?foo=bar' },
      data: '',
      files: {},
      form: { foo: 'bar' },
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip,deflate',
        'Content-Length': expect.any(String),
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'foo=bar; bar=baz',
        Host: 'httpbin.org',
        'User-Agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        'X-Amzn-Trace-Id': expect.any(String),
      },
      json: null,
      origin: expect.any(String),
      url: 'https://httpbin.org/post?key=value%3Ffoo=bar&foo=baz&baz=abc'
    });
  });

  it('should be able to handle a `multipart/form-data` payload with a file', async () => {
    const res = await fetchHar(harExamples['multipart-data']).then(r => r.json());
    expect(res).toStrictEqual({
      args: {},
      data: '',
      files: { foo: 'Hello World' },
      form: {},
      headers: {
        Accept: '*/*',
        'Accept-Encoding': 'gzip,deflate',
        'Content-Length': '217',
        'Content-Type': expect.stringContaining('multipart/form-data;boundary=--------------------------'),
        Host: 'httpbin.org',
        'User-Agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        'X-Amzn-Trace-Id': expect.any(String),
      },
      json: null,
      origin: expect.any(String),
      url: 'https://httpbin.org/post',
    });
  });
});

// describe('#fetch', () => {
//   it('should throw if it looks like you are missing a valid HAR definition', () => {
//     expect(fetchHar).toThrow('Missing HAR definition');
//     expect(fetchHar.bind(null, { log: {} })).toThrow('Missing log.entries array');
//     expect(fetchHar.bind(null, { log: { entries: [] } })).toThrow('Missing log.entries array');
//   });

//   it('should catch and toss invalid headers present in a HAR', async () => {
//     const mock = nock('https://httpbin.org')
//       .post('/post')
//       .reply(function () {
//         expect(this.req.headers['x-api-key']).toStrictEqual(['asdf1234']);
//         expect(this.req.headers['x-api-key (invalid)']).toBeUndefined();
//         return [200];
//       });

//     await fetchHar(invalidHeadersHAR);
//     mock.done();
//   });

//   describe('Content types', () => {
//     it('should be able to handle `application/x-www-form-urlencoded` payloads', async () => {
//       const mock = nock('http://petstore.swagger.io')
//         .matchHeader('content-type', 'application/x-www-form-urlencoded')
//         .put('/v2/pet')
//         .query({ a: 1, b: 2 })
//         .reply(200, function (uri, body) {
//           expect(this.req.headers.authorization).toStrictEqual(['Bearer api-key']);
//           expect(body).toBe('id=8&category=%7B%22id%22%3A6%2C%22name%22%3A%22name%22%7D&name=name');
//         });

//       await fetchHar(urlEncodedWithAuthHAR);
//       mock.done();
//     });



//     it('should be able to handle `text/plain` payloads', async () => {
//       const mock = nock('https://httpbin.org')
//         .matchHeader('content-type', 'text/plain')
//         .post('/post')
//         .query(true)
//         .reply(200, function (uri, body) {
//           expect(body).toBe('Hello World');
//         });

//       await fetchHar(harExamples['text-plain']);
//       mock.done();
//     });

//     describe('multipart/form-data', () => {
//       it("should be able to handle a `multipart/form-data` payload that's a standard object", async () => {
//         const mock = nock('https://httpbin.org')
//           .post('/post')
//           .reply(200, function (uri, body) {
//             expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
//             expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

//             expect(body.replace(/\r\n/g, '\n')).toContain(`Content-Disposition: form-data; name="foo"

// bar`);
//           });

//         await fetchHar(harExamples['multipart-form-data']);
//         mock.done();
//       });



//       describe('base64-encoded data URLs', () => {
//         let owlbert;

//         beforeAll(async () => {
//           owlbert = await fs.readFile(path.join(__dirname, '__fixtures__', 'owlbert.png')).then(img => {
//             return img.toString();
//           });
//         });

//         it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL file', async () => {
//           const mock = nock('https://httpbin.org')
//             .post('/post')
//             .reply(200, function (uri, body) {
//               expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
//               expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

//               expect(body).toContain('Content-Disposition: form-data; name="foo"; filename="owlbert.png"');
//               expect(body).toContain('Content-Type: image/png');

//               // The rest of the body should be the raw image not the data URL that was in the HAR.
//               expect(body).toContain(owlbert);
//             });

//           await fetchHar(harExamples['multipart-data-dataurl']);
//           mock.done();
//         });

//         it('should be able to handle a `multipart/form-data` payload with a base64-encoded data URL filename that contains parentheses', async () => {
//           const har = harExamples['multipart-data-dataurl'];
//           har.log.entries[0].request.postData.params[0].fileName = 'owlbert (1).png';
//           har.log.entries[0].request.postData.params[0].value =
//             har.log.entries[0].request.postData.params[0].value.replace(
//               'name=owlbert.png;',
//               `name=${encodeURIComponent('owlbert (1).png')};`
//             );

//           const mock = nock('https://httpbin.org')
//             .post('/post')
//             .reply(200, function (uri, body) {
//               expect(this.req.headers['content-type'][0]).toContain('multipart/form-data');
//               expect(this.req.headers['content-type'][0]).toContain('boundary=--------------------------');

//               expect(body).toContain('Content-Disposition: form-data; name="foo"; filename="owlbert (1).png"');
//               expect(body).toContain('Content-Type: image/png');

//               // The rest of the body should be the raw image not the data URL that was in the HAR.
//               expect(body).toContain(owlbert);
//             });

//           await fetchHar(har);
//           mock.done();
//         });
//       });
//     });
//   });
// });
