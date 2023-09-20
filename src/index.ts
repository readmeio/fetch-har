import type { FetchHAROptions, RequestInitWithDuplex } from './types.js';
import type { DataURL as npmDataURL } from '@readme/data-urls';
import type { Har } from 'har-format';

import { parse as parseDataUrl } from '@readme/data-urls';
import { Readable } from 'readable-stream';

if (!globalThis.Blob) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    globalThis.Blob = require('node:buffer').Blob;
  } catch (e) {
    throw new Error('The Blob API is required for this library. https://developer.mozilla.org/en-US/docs/Web/API/Blob');
  }
}

if (!globalThis.File) {
  try {
    // Node's native `fetch` implementation unfortunately does not make this API global so we need
    // to pull it in if we don't have it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    globalThis.File = require('undici').File;
  } catch (e) {
    throw new Error('The File API is required for this library. https://developer.mozilla.org/en-US/docs/Web/API/File');
  }
}

type DataURL = npmDataURL & {
  // `parse-data-url` doesn't explicitly support `name` in data URLs but if it's there it'll be
  // returned back to us.
  name?: string;
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isBuffer(value: any) {
  return typeof Buffer !== 'undefined' && Buffer.isBuffer(value);
}

function isFile(value: any) {
  if (value instanceof File) {
    /**
     * The `Blob` polyfill on Node comes back as being an instanceof `File`. Because passing a Blob
     * into a File will end up with a corrupted file we want to prevent this.
     *
     * This object identity crisis does not happen in the browser.
     */
    return value.constructor.name === 'File';
  }

  return false;
}

function getFileFromSuppliedFiles(filename: string, files: FetchHAROptions['files']) {
  if (files && filename in files) {
    return files[filename];
  } else if (files && decodeURIComponent(filename) in files) {
    return files[decodeURIComponent(filename)];
  }

  return false;
}

export default function fetchHAR(har: Har, opts: FetchHAROptions = {}) {
  if (!har) throw new Error('Missing HAR definition');
  if (!har.log || !har.log.entries || !har.log.entries.length) throw new Error('Missing log.entries array');

  const { request } = har.log.entries[0];
  const { url } = request;
  let querystring = '';
  let shouldSetDuplex = false;

  const options: RequestInitWithDuplex = {
    // If we have custom options for the `Request` API we need to add them in here now before we
    // fill it in with everything we need from the HAR.
    ...(opts.init ? opts.init : {}),
    method: request.method,
  };

  if (!options.headers) {
    options.headers = new Headers();
  } else if (typeof options.headers === 'object' && !(options.headers instanceof Headers) && options.headers !== null) {
    options.headers = new Headers(options.headers);
  }

  const headers = options.headers as Headers;
  if ('headers' in request && request.headers.length) {
    // eslint-disable-next-line consistent-return
    request.headers.forEach(header => {
      try {
        return headers.append(header.name, header.value);
      } catch (err) {
        /**
         * `Headers.append()` will throw errors if the header name is not a legal HTTP header name,
         * like `X-API-KEY (Header)`. If that happens instead of tossing the error back out, we
         * should silently just ignore
         * it.
         */
      }
    });
  }

  if ('cookies' in request && request.cookies.length) {
    /**
     * As the browser fetch API can't set custom cookies for requests, they instead need to be
     * defined on the document and passed into the request via `credentials: include`. Since this
     * is a browser-specific quirk, that should only
     * happen in browsers!
     */
    if (isBrowser()) {
      request.cookies.forEach(cookie => {
        document.cookie = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
      });

      options.credentials = 'include';
    } else {
      headers.append(
        'cookie',
        request.cookies
          .map(cookie => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`)
          .join('; '),
      );
    }
  }

  if ('postData' in request) {
    if (request.postData && 'params' in request.postData) {
      if (!('mimeType' in request.postData)) {
        // @ts-expect-error HAR spec requires that `mimeType` is always present but it might not be.
        request.postData.mimeType = 'application/octet-stream';
      }

      switch (request.postData.mimeType) {
        case 'application/x-www-form-urlencoded':
          /**
           * Since the content we're handling here is to be encoded as
           * `application/x-www-form-urlencoded`, this should override any other `Content-Type`
           * headers that are present in the HAR. This is how Postman handles this case when
           * building code snippets!
           *
           * @see {@link https://github.com/github/fetch/issues/263#issuecomment-209530977}
           */
          headers.set('Content-Type', request.postData.mimeType);

          const encodedParams = new URLSearchParams();
          request.postData.params?.forEach(param => {
            if (param.value) encodedParams.set(param.name, param.value);
          });

          options.body = encodedParams.toString();
          break;

        case 'multipart/alternative':
        case 'multipart/form-data':
        case 'multipart/mixed':
        case 'multipart/related':
          /**
           * If there's a `Content-Type` header set we need to remove it. We're doing this because
           * when we pass the form data object into `fetch` that'll set a proper `Content-Type`
           * header for this request that also includes the boundary used on the content.
           *
           * If we don't do this, then consumers won't be able to parse out the payload because
           * they won't know what the boundary to split on it.
           */
          if (headers.has('Content-Type')) {
            headers.delete('Content-Type');
          }

          const form = new FormData();

          request.postData.params?.forEach(param => {
            if ('fileName' in param && param.fileName) {
              if (opts.files) {
                const fileContents = getFileFromSuppliedFiles(param.fileName, opts.files);
                if (fileContents) {
                  // If the file we've got available to us is a Buffer then we need to convert it so
                  // that the FormData API can use it.
                  if (isBuffer(fileContents)) {
                    form.append(
                      param.name,
                      new File([fileContents], param.fileName, {
                        type: param.contentType || undefined,
                      }),
                      param.fileName,
                    );

                    return;
                  } else if (isFile(fileContents)) {
                    form.append(param.name, fileContents as Blob, param.fileName);
                    return;
                  }

                  throw new TypeError(
                    'An unknown object has been supplied into the `files` config for use. We only support instances of the File API and Node Buffer objects.',
                  );
                }
              }

              if ('value' in param && param.value) {
                let paramBlob;
                const parsed = parseDataUrl(param.value);
                if (parsed) {
                  // If we were able to parse out this data URL we don't need to transform its data
                  // into a buffer for `Blob` because that supports data URLs already.
                  paramBlob = new Blob([param.value], { type: parsed.contentType || param.contentType || undefined });
                } else {
                  paramBlob = new Blob([param.value], { type: param.contentType || undefined });
                }

                form.append(param.name, paramBlob, param.fileName);
                return;
              }

              throw new Error(
                "The supplied HAR has a postData parameter with `fileName`, but neither `value` content within the HAR or any file buffers were supplied with the `files` option. Since this library doesn't have access to the filesystem, it can't fetch that file.",
              );
            }

            if (param.value) form.append(param.name, param.value);
          });

          options.body = form;
          break;

        default:
          const formBody: Record<string, unknown> = {};
          request.postData.params?.map(param => {
            try {
              formBody[param.name] = JSON.parse(param.value || '');
            } catch (e) {
              formBody[param.name] = param.value;
            }

            return true;
          });

          options.body = JSON.stringify(formBody);
      }
    } else if (request.postData?.text?.length) {
      // If we've got `files` map content present, and this post data content contains a valid data
      // URL then we can substitute the payload with that file instead of the using data URL.
      if (opts.files) {
        const parsed = parseDataUrl(request.postData.text) as DataURL;
        if (parsed) {
          if (parsed?.name && parsed.name in opts.files) {
            const fileContents = getFileFromSuppliedFiles(parsed.name, opts.files);
            if (fileContents) {
              if (isBuffer(fileContents)) {
                options.body = fileContents;
              } else if (isFile(fileContents)) {
                // `Readable.from` isn't available in browsers but the browser `Request` object can
                // handle `File` objects just fine without us having to mold it into shape.
                if (isBrowser()) {
                  options.body = fileContents;
                } else {
                  // @ts-expect-error "Property 'from' does not exist on type 'typeof Readable'." but it does!
                  options.body = Readable.from((fileContents as File).stream());
                  shouldSetDuplex = true;

                  // Supplying a polyfilled `File` stream into `Request.body` doesn't automatically
                  // add `Content-Length`.
                  if (!headers.has('content-length')) {
                    headers.set('content-length', String((fileContents as File).size));
                  }
                }
              }
            }
          }
        }
      }

      if (typeof options.body === 'undefined') {
        options.body = request.postData.text;
      }
    }

    /**
     * The fetch spec, which Node 18+ strictly abides by, now requires that `duplex` be sent with
     * requests that have payloads.
     *
     * As `RequestInit#duplex` isn't supported by any browsers, or even mentioned on MDN, we aren't
     * sending it in browser environments. This work is purely to support Node 18+ and `undici`
     * environments.
     *
     * @see {@link https://github.com/nodejs/node/issues/46221}
     * @see {@link https://github.com/whatwg/fetch/pull/1457}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Request/Request}
     */
    if (shouldSetDuplex && !isBrowser()) {
      options.duplex = 'half';
    }
  }

  // We automaticaly assume that the HAR that we have already has query parameters encoded within
  // it so we do **not** use the `URLSearchParams` API here for composing the query string.
  let requestURL = url;
  if ('queryString' in request && request.queryString.length) {
    const urlObj = new URL(requestURL);

    const queryParams = Array.from(urlObj.searchParams).map(([k, v]) => `${k}=${v}`);
    request.queryString.forEach(q => {
      queryParams.push(`${q.name}=${q.value}`);
    });

    querystring = queryParams.join('&');

    // Because anchor hashes before query strings will prevent query strings from being delivered
    // we need to pop them off and re-add them after.
    if (urlObj.hash) {
      const urlWithoutHashes = requestURL.replace(urlObj.hash, '');
      requestURL = `${urlWithoutHashes.split('?')[0]}${querystring ? `?${querystring}` : ''}`;
      requestURL += urlObj.hash;
    } else {
      requestURL = `${requestURL.split('?')[0]}${querystring ? `?${querystring}` : ''}`;
    }
  }

  if (opts.userAgent) {
    headers.append('User-Agent', opts.userAgent);
  }

  options.headers = headers;

  return fetch(requestURL, options);
}
