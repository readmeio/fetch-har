function fetchHar(har) {
  console.log(fetch(constructRequest(har)))
  return fetch(constructRequest(har))
    // .then((res) => {
    //   return res
    // })
    // .then((json) => {
    //   return (json)
    // })
    // .catch((err) => {
    //   console.log(err)
    // })
};

function constructRequest(har) {
  const requestObj;

  if (har.headers.length > 0) {
    requestObj = { method: har.method, headers: { [har.headers[0].name] : har.headers[0].value }, body: har.postData.text }
  } else {
    requestObj = { method: har.method, body: har.postData.text }
  }

  if (har.queryString.length > 0) {
    har.url = har.url + "?" + har.queryString[0].name + "=" + har.queryString[0].value;
    return har.url
  }
  return new Request(har.url, requestObj);
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
