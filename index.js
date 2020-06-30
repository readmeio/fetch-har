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

  if ('postData' in request) {
    if ('params' in request.postData) {
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
    } else {
      options.body = request.postData.text;
    }
  }

  if (request.headers.length) {
    options.headers = request.headers.map(header => headers.append(header.name, header.value));
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
