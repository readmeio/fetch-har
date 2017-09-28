function fetchHar(har) {
  console.log(fetch(constructRequest(har)));
  return fetch(constructRequest(har));
  // .then((res) => {
  //   return res
  // })
  // .then((json) => {
  //   return (json)
  // })
  // .catch((err) => {
  //   console.log(err)
  // })
}

function constructRequest(har) {
  let requestObj = {
    method: har.method,
    body: har.postData.text,
  };

  if (har.headers.length) {
    requestObj.headers = {};
    har.headers.forEach(header => {
      requestObj.headers[header.name] = header.value;
    });
  }

  if (har.queryString.length) {
    har.url = har.url + '?';
    let str2;
    har.queryString.forEach((query, i) => {
      str2 = har.queryString[i].name + '=' + har.queryString[i].value;
    });
    har.url.concat(str2);
    return har.url;
  }

  return new Request(har.url, requestObj);
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
