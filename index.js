function constructRequest(har, userAgent = false) {
  if (!har) throw new Error('Missing HAR file');
  if (!har.log || !har.log.entries || !har.log.entries.length) throw new Error('Missing log.entries array');

  const { request } = har.log.entries[0];
  const { url } = request;
  let querystring = '';

  const headers = new Headers();
  const options = {
    method: request.method,
  };

  if (request.headers.length) {
    options.headers = request.headers.map(header => headers.append(header.name, header.value));
  }

  if ('postData' in request) {
    if ('params' in request.postData) {
      if ('mimeType' in request.postData && request.postData.mimeType === 'application/x-www-form-urlencoded') {
        // Since the content we're handling here is to be encoded as application/x-www-form-urlencoded, this should
        // override any other Content-Type headers that are present in the HAR. This is how Postman handles this case
        // when building code snippets!
        //
        // https://github.com/github/fetch/issues/263#issuecomment-209530977
        headers.set('Content-Type', request.postData.mimeType);

        const encodedParams = new URLSearchParams();
        request.postData.params.map(param => encodedParams.set(param.name, param.value));

        options.body = encodedParams;
      } else {
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

  if (request.queryString.length) {
    const query = request.queryString.map(q => `${q.name}=${q.value}`).join('&');
    querystring = `?${query}`;
  }

  if (userAgent) {
    headers.append('User-Agent', userAgent);
  }

  options.headers = headers;

  return new Request(`${url}${querystring}`, options);
}

function fetchHar(har, userAgent) {
  return fetch(constructRequest(har, userAgent));
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
