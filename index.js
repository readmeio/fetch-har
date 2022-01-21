const { Readable } = require('readable-stream');
const parseDataUrl = require('parse-data-url');
const { Blob: BlobPolyfill, File: FilePolyfill } = require('formdata-node');

// Instead of requiring the user to polyfill this on their end we're doing it ourselves so we can ensure that we have
// an API we know will work.
if (!globalThis.Blob) {
  globalThis.Blob = BlobPolyfill;
}

if (!globalThis.File) {
  globalThis.File = FilePolyfill;
}

/**
 * @license MIT
 * @see {@link https://github.com/octet-stream/form-data-encoder/blob/master/lib/util/isFunction.ts}
 */
function isFunction(value) {
  return typeof value === 'function';
}

/**
 * We're loading this library in here instead of loading it from `form-data-encoder` because that uses lookbehind
 * regex in its main encoder that Safari doesn't support so it throws a fatal page exception.
 *
 * @license MIT
 * @see {@link https://github.com/octet-stream/form-data-encoder/blob/master/lib/util/isFormData.ts}
 */
function isFormData(value) {
  return (
    value &&
    isFunction(value.constructor) &&
    value[Symbol.toStringTag] === 'FormData' && // eslint-disable-line compat/compat
    isFunction(value.append) &&
    isFunction(value.getAll) &&
    isFunction(value.entries) &&
    isFunction(value[Symbol.iterator]) // eslint-disable-line compat/compat
  );
}

function constructRequest(har, opts = { userAgent: false, files: {}, multipartEncoder: false }) {
  if (!har) throw new Error('Missing HAR definition');
  if (!har.log || !har.log.entries || !har.log.entries.length) throw new Error('Missing log.entries array');

  const { request } = har.log.entries[0];
  const { url } = request;
  let querystring = '';

  const headers = new Headers();
  const options = {
    method: request.method,
  };

  if ('headers' in request && request.headers.length) {
    // eslint-disable-next-line consistent-return
    request.headers.forEach(header => {
      try {
        return headers.append(header.name, header.value);
      } catch (err) {
        // `Headers.append()` will throw errors if the header name is not a legal HTTP header name, like
        // `X-API-KEY (Header)`. If that happens instead of tossing the error back out, we should silently just ignore
        // it.
      }
    });
  }

  if ('cookies' in request && request.cookies.length) {
    // As the browser fetch API can't set custom cookies for requests, they instead need to be defined on the document
    // and passed into the request via `credentials: include`. Since this is a browser-specific quirk, that should only
    // happen in browsers!
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      request.cookies.forEach(cookie => {
        document.cookie = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
      });

      options.credentials = 'include';
    } else {
      headers.append(
        'cookie',
        request.cookies
          .map(cookie => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`)
          .join('; ')
      );
    }
  }

  if ('postData' in request) {
    if ('params' in request.postData) {
      if (!('mimeType' in request.postData)) {
        request.postData.mimeType = 'application/octet-stream';
      }

      switch (request.postData.mimeType) {
        case 'application/x-www-form-urlencoded':
          // Since the content we're handling here is to be encoded as `application/x-www-form-urlencoded`, this should
          // override any other Content-Type headers that are present in the HAR. This is how Postman handles this case
          // when building code snippets!
          //
          // https://github.com/github/fetch/issues/263#issuecomment-209530977
          headers.set('Content-Type', request.postData.mimeType);

          const encodedParams = new URLSearchParams();
          request.postData.params.forEach(param => encodedParams.set(param.name, param.value));

          options.body = encodedParams.toString();
          break;

        case 'multipart/alternative':
        case 'multipart/form-data':
        case 'multipart/mixed':
        case 'multipart/related':
          // If there's a Content-Type header set remove it. We're doing this because when we pass the form data object
          // into `fetch` that'll set a proper `Content-Type` header for this request that also includes the boundary
          // used on the content.
          //
          // If we don't do this, then consumers won't be able to parse out the payload because they won't know what
          // the boundary to split on it.
          if (headers.has('Content-Type')) {
            headers.delete('Content-Type');
          }

          const form = new FormData();
          if (!isFormData(form)) {
            // The `form-data` NPM module returns one of two things: a native `FormData` API or its own polyfill.
            // Unfortunatley this polyfill does not support the full API of the native FormData object so when you load
            // `form-data` within a browser environment you'll have two major differences in API:
            //
            //  * The `.append()` API in `form-data` requires that the third argument is an object containing various,
            //    undocumented, options. In the browser, `.append()`'s third argument should only be present when the
            //    second is a `Blob` or `USVString`, and when it is present, it should be a filename string.
            //  * `form-data` does not expose an `.entries()` API, so the only way to retrieve data out of it for
            //    construction of boundary-separated payload content is to use its `.pipe()` API. Since the browser
            //    doesn't have this API, you'll be unable to retrieve data out of it.
            //
            // Now since the native `FormData` API is iterable, and has the `.entries()` iterator, we can easily detect
            // if we have a native copy of the FormData API. It's for all of these reasons that we're opting to hard
            // crash here because supporting this non-compliant API is more trouble than its worth.
            //
            // https://github.com/form-data/form-data/issues/124
            throw new Error(
              "We've detected you're using a non-spec compliant FormData library. We recommend polyfilling FormData with https://npm.im/formdata-node"
            );
          }

          request.postData.params.forEach(param => {
            if ('fileName' in param) {
              if (opts.files && param.fileName in opts.files) {
                const fileContents = opts.files[param.fileName];

                // If the file we've got available to us is a Buffer then we need to convert it so that the FormData
                // API can use it.
                if (Buffer.isBuffer(fileContents)) {
                  form.set(
                    param.name,
                    new File([fileContents], param.fileName, {
                      type: param.contentType || null,
                    }),
                    param.fileName
                  );

                  return;
                } else if (fileContents instanceof File) {
                  // The `Blob` polyfill on Node comes back as being an instanceof `File`. Because passing a Blob into
                  // a File will end up with a corrupted file we want to prevent this.
                  //
                  // This object identity crisis does not happen in the browser.
                  if (fileContents.constructor.name === 'File') {
                    form.set(param.name, fileContents, param.fileName);
                    return;
                  }
                }

                throw new TypeError(
                  'An unknown object has been supplied into the `files` config for use. We only support instances of the File API and Node Buffer objects.'
                );
              } else if ('value' in param) {
                let paramBlob;
                const parsed = parseDataUrl(param.value);
                if (parsed) {
                  // If we were able to parse out this data URL we don't need to transform its data into a buffer for
                  // `Blob` because that supports data URLs already.
                  paramBlob = new Blob([param.value], { type: parsed.contentType || param.contentType || null });
                } else {
                  paramBlob = new Blob([param.value], { type: param.contentType || null });
                }

                form.append(param.name, paramBlob, param.fileName);
                return;
              }

              throw new Error(
                "The supplied HAR has a postData parameter with `fileName`, but neither `value` content within the HAR or any file buffers were supplied with the `files` option. Since this library doesn't have access to the filesystem, it can't fetch that file."
              );
            }

            form.append(param.name, param.value);
          });

          // If a the `fetch` polyfill that's being used here doesn't have spec-compliant handling for the `FormData`
          // API (like `node-fetch@2`), then you should pass in a handler (like the `form-data-encoder` library) to
          // transform its contents into something that can be used with the `Request` object.
          //
          // https://www.npmjs.com/package/formdata-node
          if (opts.multipartEncoder) {
            // eslint-disable-next-line new-cap
            const encoder = new opts.multipartEncoder(form);
            Object.keys(encoder.headers).forEach(header => {
              headers.set(header, encoder.headers[header]);
            });

            options.body = Readable.from(encoder);
          } else {
            options.body = form;
          }
          break;

        default:
          const formBody = {};
          request.postData.params.map(param => {
            try {
              formBody[param.name] = JSON.parse(param.value);
            } catch (e) {
              formBody[param.name] = param.value;
            }

            return true;
          });

          options.body = JSON.stringify(formBody);
      }
    } else {
      options.body = request.postData.text;
    }
  }

  if ('queryString' in request && request.queryString.length) {
    const query = request.queryString.map(q => `${q.name}=${q.value}`).join('&');
    querystring = `?${query}`;
  }

  if (opts.userAgent) {
    headers.append('User-Agent', opts.userAgent);
  }

  options.headers = headers;

  return new Request(`${url}${querystring}`, options);
}

function fetchHar(har, opts = { userAgent: false, files: {}, multipartEncoder: false }) {
  return fetch(constructRequest(har, opts));
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
