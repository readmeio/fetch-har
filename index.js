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
  const requestObj = { method: har.method, headers: { [har.headers[0].name] : har.headers[0].value }, body: har.postData.text }
  return new Request(har.url, requestObj);
}

module.exports = fetchHar;
module.exports.constructRequest = constructRequest;
