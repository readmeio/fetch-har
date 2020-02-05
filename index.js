function constructRequest(har, userAgent = false) {
  if (!har) throw new Error('Missing har file');
  if (!har.log || !har.log.entries || !har.log.entries.length) throw new Error('Missing log.entries array');

  const { request } = har.log.entries[0];
  const { url } = request;
  let querystring = '';
  const options = {
    method: request.method,
    body: request.postData.text,
    headers: {},
  };

  if (request.headers.length) {
    options.headers = request.headers
      .map(header => {
        return { [header.name]: header.value };
      })
      .reduce((headers, next) => {
        return Object.assign(headers, next);
      }, {});
  }

  if (request.queryString.length) {
    const query = request.queryString.map(q => `${q.name}=${q.value}`).join('&');
    querystring = `?${query}`;
  }

  if (userAgent) {
    options.headers['User-Agent'] = userAgent;
  }

  return new Request(`${url}${querystring}`, options);
}

function fetchHar(har, userAgent) {
  return fetch(constructRequest(har, userAgent));
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
