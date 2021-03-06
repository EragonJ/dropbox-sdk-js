var request = require('superagent');
var Promise = require('es6-promise').Promise;

var buildCustomError;
var downloadRequest;
var nodeBinaryParser;
var BASE_URL = 'https://content.dropboxapi.com/2/';

// Register a handler that will instruct superagent how to parse the response
request.parse['application/octect-stream'] = function (obj) {
  return obj;
};

// This doesn't match what was spec'd in paper doc yet
buildCustomError = function (error, response) {
  return {
    status: error.status,
    error: response.text,
    response: response
  };
};

nodeBinaryParser = function (res, done) {
  res.text = '';
  res.setEncoding('binary');
  res.on('data', function (chunk) { res.text += chunk; });
  res.on('end', function () {
    done();
  });
};

downloadRequest = function (path, args, accessToken, selectUser) {
  var promiseFunction = function (resolve, reject) {
    var apiRequest;

    function success(data) {
      if (resolve) {
        resolve(data);
      }
    }

    function failure(error) {
      if (reject) {
        reject(error);
      }
    }

    function responseHandler(error, response) {
      var data;
      if (error) {
        failure(buildCustomError(error, response));
      } else {
        // In the browser, the file is passed as a blob and in node the file is
        // passed as a string of binary data.
        data = JSON.parse(response.headers['dropbox-api-result']);
        if (response.xhr) {
          data.fileBlob = response.xhr.response;
        } else {
          data.fileBinary = response.res.text;
        }
        success(data);
      }
    }

    apiRequest = request.post(BASE_URL + path)
      .set('Authorization', 'Bearer ' + accessToken)
      .set('Dropbox-API-Arg', JSON.stringify(args))
      .on('request', function () {
        if (this.xhr) {
          this.xhr.responseType = 'blob';
        }
      });

    if (selectUser) {
      apiRequest = apiRequest.set('Dropbox-API-Select-User', selectUser);
    }

    // Apply the node binary parser to the response if executing in node
    apiRequest
      .buffer(true)
      .parse(nodeBinaryParser)
      .end(responseHandler);
  };

  return new Promise(promiseFunction);
};

module.exports = downloadRequest;
