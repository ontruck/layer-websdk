'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Basic XHR Library with some notions hardcoded in
 * of what the Layer server expects/returns.
 *
    layer.xhr({
      url: 'http://my.com/mydata',
      data: {hey: 'ho', there: 'folk'},
      method: 'GET',
      format: 'json',
      headers: {'fred': 'Joe'},
      timeout: 50000
    }, function(result) {
      if (!result.success) {
        errorHandler(result.data, result.headers, result.status);
      } else {
        successHandler(result.data, result.headers, result.xhr);
      }
    });
 *
 * @class layer.xhr
 * @private
 */

/**
 * Send a Request.
 *
 * @method  xhr
 * @param {Object} options
 * @param {string} options.url
 * @param {Mixed} [options.data=null]
 * @param {string} [options.format=''] - set to 'json' to get result parsed as json (in case there is no obvious Content-Type in the response)
 * @param {Object} [options.headers={}] - Name value pairs for  headers and their values
 * @param {number} [options.timeout=0] - When does the request expire/timeout in miliseconds.
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {number} callback.result.status - http status code
 * @param {boolean} callback.result.success - true if it was a successful response
 * @param {XMLHttpRequest} callback.result.xhr - The XHR object used for the request
 * @param {Object} callback.result.data -  The parsed response body
 *
 * TODO:
 *
 * 1. Make this a subclass of Root and make it a singleton so it can inherit a proper event system
 * 2. Result should be a layer.ServerResponse instance
 * 3. Should only access link headers if requested; annoying having it throw errors every other time.
 */

// Don't set xhr to window.XMLHttpRequest as it will bypass jasmine's
// ajax library
var Xhr = typeof window === 'undefined' ? require('xhr2') : null;

function parseLinkHeaders(linkHeader) {
  if (!linkHeader) return {};

  // Split parts by comma
  var parts = linkHeader.split(',');
  var links = {};

  // Parse each part into a named link
  parts.forEach(function (part) {
    var section = part.split(';');
    if (section.length !== 2) return;
    var url = section[0].replace(/<(.*)>/, '$1').trim();
    var name = section[1].replace(/rel='?(.*)'?/, '$1').trim();
    links[name] = url;
  });

  return links;
}

module.exports = function (request, callback) {
  var req = Xhr ? new Xhr() : new XMLHttpRequest();
  var method = (request.method || 'GET').toUpperCase();

  var onload = function onload() {
    var headers = {
      'content-type': this.getResponseHeader('content-type')
    };

    var result = {
      status: this.status,
      success: this.status && this.status < 300,
      xhr: this
    };
    var isJSON = String(headers['content-type']).split(/;/)[0].match(/^application\/json/) || request.format === 'json';

    if (this.responseType === 'blob' || this.responseType === 'arraybuffer') {
      if (this.status === 0) {
        result.data = new Error('Connection Failed');
      } else {
        // Damnit, this.response is a function if using jasmine test framework.
        result.data = typeof this.response === 'function' ? this.responseText : this.response;
      }
    } else {
      if (isJSON && this.responseText) {
        try {
          result.data = JSON.parse(this.responseText);
        } catch (err) {
          result.data = {
            code: 999,
            message: 'Invalid JSON from server',
            response: this.responseText
          };
          result.status = 999;
        }
      } else {
        result.data = this.responseText;
      }

      module.exports.trigger({
        target: this,
        status: !this.responseText && !this.status ? 'connection:error' : 'connection:success'
      });

      if (!this.responseText && !this.status) {
        result.status = 408;
        result.data = {
          id: 'request_timeout',
          message: 'The server is not responding please try again in a few minutes',
          url: 'https://docs.layer.com/reference/client_api/errors',
          code: 0,
          status: 408,
          httpStatus: 408
        };
      } else if (this.status === 404 && _typeof(result.data) !== 'object') {
        result.data = {
          id: 'operation_not_found',
          message: 'Endpoint ' + (request.method || 'GET') + ' ' + request.url + ' does not exist',
          status: this.status,
          httpStatus: 404,
          code: 106,
          url: 'https://docs.layer.com/reference/client_api/errors'
        };
      } else if (typeof result.data === 'string' && this.status >= 400) {
        result.data = {
          id: 'unknown_error',
          message: result.data,
          status: this.status,
          httpStatus: this.status,
          code: 0,
          url: 'https://www.google.com/search?q=doh!'
        };
      }
    }

    if (request.headers && (request.headers.accept || '').match(/application\/vnd.layer\+json/)) {
      var links = this.getResponseHeader('link');
      if (links) result.Links = parseLinkHeaders(links);
    }
    result.xhr = this;

    if (callback) callback(result);
  };

  req.onload = onload;

  // UNTESTED!!!
  req.onerror = req.ontimeout = onload;

  // Replace all headers in arbitrary case with all lower case
  // for easy matching.
  var headersList = Object.keys(request.headers || {});
  var headers = {};
  headersList.forEach(function (header) {
    if (header.toLowerCase() === 'content-type') {
      headers['content-type'] = request.headers[header];
    } else {
      headers[header.toLowerCase()] = request.headers[header];
    }
  });
  request.headers = headers;

  var data = '';
  if (request.data) {
    if (typeof Blob !== 'undefined' && request.data instanceof Blob) {
      data = request.data;
    } else if (request.headers && (String(request.headers['content-type']).match(/^application\/json/) || String(request.headers['content-type']) === 'application/vnd.layer-patch+json')) {
      data = typeof request.data === 'string' ? request.data : JSON.stringify(request.data);
    } else if (request.data && _typeof(request.data) === 'object') {
      Object.keys(request.data).forEach(function (name) {
        if (data) data += '&';
        data += name + '=' + request.data[name];
      });
    } else {
      data = request.data; // Some form of raw string/data
    }
  }
  if (data) {
    if (method === 'GET') {
      request.url += '?' + data;
    }
  }

  req.open(method, request.url, true);
  if (request.timeout) req.timeout = request.timeout;
  if (request.withCredentials) req.withCredentials = true;
  if (request.responseType) req.responseType = request.responseType;

  if (request.headers) {
    Object.keys(request.headers).forEach(function (headerName) {
      return req.setRequestHeader(headerName, request.headers[headerName]);
    });
  }

  try {
    if (method === 'GET') {
      req.send();
    } else {
      req.send(data);
    }
  } catch (e) {
    // do nothing
  }
};

var listeners = [];
module.exports.addConnectionListener = function (func) {
  return listeners.push(func);
};

module.exports.trigger = function (evt) {
  listeners.forEach(function (func) {
    return func(evt);
  });
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy94aHIuanMiXSwibmFtZXMiOlsiWGhyIiwid2luZG93IiwicmVxdWlyZSIsInBhcnNlTGlua0hlYWRlcnMiLCJsaW5rSGVhZGVyIiwicGFydHMiLCJzcGxpdCIsImxpbmtzIiwiZm9yRWFjaCIsInBhcnQiLCJzZWN0aW9uIiwibGVuZ3RoIiwidXJsIiwicmVwbGFjZSIsInRyaW0iLCJuYW1lIiwibW9kdWxlIiwiZXhwb3J0cyIsInJlcXVlc3QiLCJjYWxsYmFjayIsInJlcSIsIlhNTEh0dHBSZXF1ZXN0IiwibWV0aG9kIiwidG9VcHBlckNhc2UiLCJvbmxvYWQiLCJoZWFkZXJzIiwiZ2V0UmVzcG9uc2VIZWFkZXIiLCJyZXN1bHQiLCJzdGF0dXMiLCJzdWNjZXNzIiwieGhyIiwiaXNKU09OIiwiU3RyaW5nIiwibWF0Y2giLCJmb3JtYXQiLCJyZXNwb25zZVR5cGUiLCJkYXRhIiwiRXJyb3IiLCJyZXNwb25zZSIsInJlc3BvbnNlVGV4dCIsIkpTT04iLCJwYXJzZSIsImVyciIsImNvZGUiLCJtZXNzYWdlIiwidHJpZ2dlciIsInRhcmdldCIsImlkIiwiaHR0cFN0YXR1cyIsImFjY2VwdCIsIkxpbmtzIiwib25lcnJvciIsIm9udGltZW91dCIsImhlYWRlcnNMaXN0IiwiT2JqZWN0Iiwia2V5cyIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiQmxvYiIsInN0cmluZ2lmeSIsIm9wZW4iLCJ0aW1lb3V0Iiwid2l0aENyZWRlbnRpYWxzIiwic2V0UmVxdWVzdEhlYWRlciIsImhlYWRlck5hbWUiLCJzZW5kIiwiZSIsImxpc3RlbmVycyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsInB1c2giLCJmdW5jIiwiZXZ0Il0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdUJBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QkE7QUFDQTtBQUNBLElBQU1BLE1BQU8sT0FBT0MsTUFBUCxLQUFrQixXQUFuQixHQUFrQ0MsUUFB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UUFBUU8sT0FBUixDQUFnQnVDLFVBQWhCLENBQWpDLENBQWQ7QUFBQSxLQUFyQztBQUNEOztBQUVELE1BQUk7QUFDRixRQUFJMUMsV0FBVyxLQUFmLEVBQXNCO0FBQ3BCRixVQUFJNkMsSUFBSjtBQUNELEtBRkQsTUFFTztBQUNMN0MsVUFBSTZDLElBQUosQ0FBUzdCLElBQVQ7QUFDRDtBQUNGLEdBTkQsQ0FNRSxPQUFPOEIsQ0FBUCxFQUFVO0FBQ1Y7QUFDRDtBQUNGLENBbEpEOztBQW9KQSxJQUFNQyxZQUFZLEVBQWxCO0FBQ0FuRCxPQUFPQyxPQUFQLENBQWVtRCxxQkFBZixHQUF1QztBQUFBLFNBQVFELFVBQVVFLElBQVYsQ0FBZUMsSUFBZixDQUFSO0FBQUEsQ0FBdkM7O0FBRUF0RCxPQUFPQyxPQUFQLENBQWU0QixPQUFmLEdBQXlCLFVBQUMwQixHQUFELEVBQVM7QUFDaENKLFlBQVUzRCxPQUFWLENBQWtCO0FBQUEsV0FBUThELEtBQUtDLEdBQUwsQ0FBUjtBQUFBLEdBQWxCO0FBQ0QsQ0FGRCIsImZpbGUiOiJ4aHIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJhc2ljIFhIUiBMaWJyYXJ5IHdpdGggc29tZSBub3Rpb25zIGhhcmRjb2RlZCBpblxuICogb2Ygd2hhdCB0aGUgTGF5ZXIgc2VydmVyIGV4cGVjdHMvcmV0dXJucy5cbiAqXG4gICAgbGF5ZXIueGhyKHtcbiAgICAgIHVybDogJ2h0dHA6Ly9teS5jb20vbXlkYXRhJyxcbiAgICAgIGRhdGE6IHtoZXk6ICdobycsIHRoZXJlOiAnZm9sayd9LFxuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIGZvcm1hdDogJ2pzb24nLFxuICAgICAgaGVhZGVyczogeydmcmVkJzogJ0pvZSd9LFxuICAgICAgdGltZW91dDogNTAwMDBcbiAgICB9LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgZXJyb3JIYW5kbGVyKHJlc3VsdC5kYXRhLCByZXN1bHQuaGVhZGVycywgcmVzdWx0LnN0YXR1cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdWNjZXNzSGFuZGxlcihyZXN1bHQuZGF0YSwgcmVzdWx0LmhlYWRlcnMsIHJlc3VsdC54aHIpO1xuICAgICAgfVxuICAgIH0pO1xuICpcbiAqIEBjbGFzcyBsYXllci54aHJcbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiBTZW5kIGEgUmVxdWVzdC5cbiAqXG4gKiBAbWV0aG9kICB4aHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy51cmxcbiAqIEBwYXJhbSB7TWl4ZWR9IFtvcHRpb25zLmRhdGE9bnVsbF1cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb3JtYXQ9JyddIC0gc2V0IHRvICdqc29uJyB0byBnZXQgcmVzdWx0IHBhcnNlZCBhcyBqc29uIChpbiBjYXNlIHRoZXJlIGlzIG5vIG9idmlvdXMgQ29udGVudC1UeXBlIGluIHRoZSByZXNwb25zZSlcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzPXt9XSAtIE5hbWUgdmFsdWUgcGFpcnMgZm9yICBoZWFkZXJzIGFuZCB0aGVpciB2YWx1ZXNcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy50aW1lb3V0PTBdIC0gV2hlbiBkb2VzIHRoZSByZXF1ZXN0IGV4cGlyZS90aW1lb3V0IGluIG1pbGlzZWNvbmRzLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFjay5yZXN1bHRcbiAqIEBwYXJhbSB7bnVtYmVyfSBjYWxsYmFjay5yZXN1bHQuc3RhdHVzIC0gaHR0cCBzdGF0dXMgY29kZVxuICogQHBhcmFtIHtib29sZWFufSBjYWxsYmFjay5yZXN1bHQuc3VjY2VzcyAtIHRydWUgaWYgaXQgd2FzIGEgc3VjY2Vzc2Z1bCByZXNwb25zZVxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0gY2FsbGJhY2sucmVzdWx0LnhociAtIFRoZSBYSFIgb2JqZWN0IHVzZWQgZm9yIHRoZSByZXF1ZXN0XG4gKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2sucmVzdWx0LmRhdGEgLSAgVGhlIHBhcnNlZCByZXNwb25zZSBib2R5XG4gKlxuICogVE9ETzpcbiAqXG4gKiAxLiBNYWtlIHRoaXMgYSBzdWJjbGFzcyBvZiBSb290IGFuZCBtYWtlIGl0IGEgc2luZ2xldG9uIHNvIGl0IGNhbiBpbmhlcml0IGEgcHJvcGVyIGV2ZW50IHN5c3RlbVxuICogMi4gUmVzdWx0IHNob3VsZCBiZSBhIGxheWVyLlNlcnZlclJlc3BvbnNlIGluc3RhbmNlXG4gKiAzLiBTaG91bGQgb25seSBhY2Nlc3MgbGluayBoZWFkZXJzIGlmIHJlcXVlc3RlZDsgYW5ub3lpbmcgaGF2aW5nIGl0IHRocm93IGVycm9ycyBldmVyeSBvdGhlciB0aW1lLlxuICovXG5cbi8vIERvbid0IHNldCB4aHIgdG8gd2luZG93LlhNTEh0dHBSZXF1ZXN0IGFzIGl0IHdpbGwgYnlwYXNzIGphc21pbmUnc1xuLy8gYWpheCBsaWJyYXJ5XG5jb25zdCBYaHIgPSAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpID8gcmVxdWlyZSgneGhyMicpIDogbnVsbDtcblxuZnVuY3Rpb24gcGFyc2VMaW5rSGVhZGVycyhsaW5rSGVhZGVyKSB7XG4gIGlmICghbGlua0hlYWRlcikgcmV0dXJuIHt9O1xuXG4gIC8vIFNwbGl0IHBhcnRzIGJ5IGNvbW1hXG4gIGNvbnN0IHBhcnRzID0gbGlua0hlYWRlci5zcGxpdCgnLCcpO1xuICBjb25zdCBsaW5rcyA9IHt9O1xuXG4gIC8vIFBhcnNlIGVhY2ggcGFydCBpbnRvIGEgbmFtZWQgbGlua1xuICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgY29uc3Qgc2VjdGlvbiA9IHBhcnQuc3BsaXQoJzsnKTtcbiAgICBpZiAoc2VjdGlvbi5sZW5ndGggIT09IDIpIHJldHVybjtcbiAgICBjb25zdCB1cmwgPSBzZWN0aW9uWzBdLnJlcGxhY2UoLzwoLiopPi8sICckMScpLnRyaW0oKTtcbiAgICBjb25zdCBuYW1lID0gc2VjdGlvblsxXS5yZXBsYWNlKC9yZWw9Jz8oLiopJz8vLCAnJDEnKS50cmltKCk7XG4gICAgbGlua3NbbmFtZV0gPSB1cmw7XG4gIH0pO1xuXG4gIHJldHVybiBsaW5rcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcbiAgY29uc3QgcmVxID0gWGhyID8gbmV3IFhocigpIDogbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIGNvbnN0IG1ldGhvZCA9IChyZXF1ZXN0Lm1ldGhvZCB8fCAnR0VUJykudG9VcHBlckNhc2UoKTtcblxuICBjb25zdCBvbmxvYWQgPSBmdW5jdGlvbiBvbmxvYWQoKSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgICdjb250ZW50LXR5cGUnOiB0aGlzLmdldFJlc3BvbnNlSGVhZGVyKCdjb250ZW50LXR5cGUnKSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN1Y2Nlc3M6IHRoaXMuc3RhdHVzICYmIHRoaXMuc3RhdHVzIDwgMzAwLFxuICAgICAgeGhyOiB0aGlzLFxuICAgIH07XG4gICAgY29uc3QgaXNKU09OID0gKFN0cmluZyhoZWFkZXJzWydjb250ZW50LXR5cGUnXSkuc3BsaXQoLzsvKVswXS5tYXRjaCgvXmFwcGxpY2F0aW9uXFwvanNvbi8pIHx8XG4gICAgICAgICAgIHJlcXVlc3QuZm9ybWF0ID09PSAnanNvbicpO1xuXG4gICAgaWYgKHRoaXMucmVzcG9uc2VUeXBlID09PSAnYmxvYicgfHwgdGhpcy5yZXNwb25zZVR5cGUgPT09ICdhcnJheWJ1ZmZlcicpIHtcbiAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMCkge1xuICAgICAgICByZXN1bHQuZGF0YSA9IG5ldyBFcnJvcignQ29ubmVjdGlvbiBGYWlsZWQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIERhbW5pdCwgdGhpcy5yZXNwb25zZSBpcyBhIGZ1bmN0aW9uIGlmIHVzaW5nIGphc21pbmUgdGVzdCBmcmFtZXdvcmsuXG4gICAgICAgIHJlc3VsdC5kYXRhID0gdHlwZW9mIHRoaXMucmVzcG9uc2UgPT09ICdmdW5jdGlvbicgPyB0aGlzLnJlc3BvbnNlVGV4dCA6IHRoaXMucmVzcG9uc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc0pTT04gJiYgdGhpcy5yZXNwb25zZVRleHQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXN1bHQuZGF0YSA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICAgIGNvZGU6IDk5OSxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdJbnZhbGlkIEpTT04gZnJvbSBzZXJ2ZXInLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHRoaXMucmVzcG9uc2VUZXh0LFxuICAgICAgICAgIH07XG4gICAgICAgICAgcmVzdWx0LnN0YXR1cyA9IDk5OTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgIH1cblxuXG4gICAgICBtb2R1bGUuZXhwb3J0cy50cmlnZ2VyKHtcbiAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICBzdGF0dXM6ICF0aGlzLnJlc3BvbnNlVGV4dCAmJiAhdGhpcy5zdGF0dXMgPyAnY29ubmVjdGlvbjplcnJvcicgOiAnY29ubmVjdGlvbjpzdWNjZXNzJyxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXRoaXMucmVzcG9uc2VUZXh0ICYmICF0aGlzLnN0YXR1cykge1xuICAgICAgICByZXN1bHQuc3RhdHVzID0gNDA4O1xuICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICBpZDogJ3JlcXVlc3RfdGltZW91dCcsXG4gICAgICAgICAgbWVzc2FnZTogJ1RoZSBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmcgcGxlYXNlIHRyeSBhZ2FpbiBpbiBhIGZldyBtaW51dGVzJyxcbiAgICAgICAgICB1cmw6ICdodHRwczovL2RvY3MubGF5ZXIuY29tL3JlZmVyZW5jZS9jbGllbnRfYXBpL2Vycm9ycycsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICBzdGF0dXM6IDQwOCxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDgsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdHVzID09PSA0MDQgJiYgdHlwZW9mIHJlc3VsdC5kYXRhICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICBpZDogJ29wZXJhdGlvbl9ub3RfZm91bmQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdFbmRwb2ludCAnICsgKHJlcXVlc3QubWV0aG9kIHx8ICdHRVQnKSArICcgJyArIHJlcXVlc3QudXJsICsgJyBkb2VzIG5vdCBleGlzdCcsXG4gICAgICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgY29kZTogMTA2LFxuICAgICAgICAgIHVybDogJ2h0dHBzOi8vZG9jcy5sYXllci5jb20vcmVmZXJlbmNlL2NsaWVudF9hcGkvZXJyb3JzJyxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdC5kYXRhID09PSAnc3RyaW5nJyAmJiB0aGlzLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB7XG4gICAgICAgICAgaWQ6ICd1bmtub3duX2Vycm9yJyxcbiAgICAgICAgICBtZXNzYWdlOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgICAgIGh0dHBTdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgdXJsOiAnaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1kb2ghJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmVxdWVzdC5oZWFkZXJzICYmIChyZXF1ZXN0LmhlYWRlcnMuYWNjZXB0IHx8ICcnKS5tYXRjaCgvYXBwbGljYXRpb25cXC92bmQubGF5ZXJcXCtqc29uLykpIHtcbiAgICAgIGNvbnN0IGxpbmtzID0gdGhpcy5nZXRSZXNwb25zZUhlYWRlcignbGluaycpO1xuICAgICAgaWYgKGxpbmtzKSByZXN1bHQuTGlua3MgPSBwYXJzZUxpbmtIZWFkZXJzKGxpbmtzKTtcbiAgICB9XG4gICAgcmVzdWx0LnhociA9IHRoaXM7XG5cbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3VsdCk7XG4gIH07XG5cbiAgcmVxLm9ubG9hZCA9IG9ubG9hZDtcblxuICAvLyBVTlRFU1RFRCEhIVxuICByZXEub25lcnJvciA9IHJlcS5vbnRpbWVvdXQgPSBvbmxvYWQ7XG5cbiAgLy8gUmVwbGFjZSBhbGwgaGVhZGVycyBpbiBhcmJpdHJhcnkgY2FzZSB3aXRoIGFsbCBsb3dlciBjYXNlXG4gIC8vIGZvciBlYXN5IG1hdGNoaW5nLlxuICBjb25zdCBoZWFkZXJzTGlzdCA9IE9iamVjdC5rZXlzKHJlcXVlc3QuaGVhZGVycyB8fCB7fSk7XG4gIGNvbnN0IGhlYWRlcnMgPSB7fTtcbiAgaGVhZGVyc0xpc3QuZm9yRWFjaCgoaGVhZGVyKSA9PiB7XG4gICAgaWYgKGhlYWRlci50b0xvd2VyQ2FzZSgpID09PSAnY29udGVudC10eXBlJykge1xuICAgICAgaGVhZGVyc1snY29udGVudC10eXBlJ10gPSByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhZGVyc1toZWFkZXIudG9Mb3dlckNhc2UoKV0gPSByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyXTtcbiAgICB9XG4gIH0pO1xuICByZXF1ZXN0LmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gIGxldCBkYXRhID0gJyc7XG4gIGlmIChyZXF1ZXN0LmRhdGEpIHtcbiAgICBpZiAodHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIHJlcXVlc3QuZGF0YSBpbnN0YW5jZW9mIEJsb2IpIHtcbiAgICAgIGRhdGEgPSByZXF1ZXN0LmRhdGE7XG4gICAgfSBlbHNlIGlmIChyZXF1ZXN0LmhlYWRlcnMgJiYgKFxuICAgICAgICBTdHJpbmcocmVxdWVzdC5oZWFkZXJzWydjb250ZW50LXR5cGUnXSkubWF0Y2goL15hcHBsaWNhdGlvblxcL2pzb24vKSB8fFxuICAgICAgICBTdHJpbmcocmVxdWVzdC5oZWFkZXJzWydjb250ZW50LXR5cGUnXSkgPT09ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicpXG4gICAgKSB7XG4gICAgICBkYXRhID0gdHlwZW9mIHJlcXVlc3QuZGF0YSA9PT0gJ3N0cmluZycgPyByZXF1ZXN0LmRhdGEgOiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0LmRhdGEpO1xuICAgIH0gZWxzZSBpZiAocmVxdWVzdC5kYXRhICYmIHR5cGVvZiByZXF1ZXN0LmRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBPYmplY3Qua2V5cyhyZXF1ZXN0LmRhdGEpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKGRhdGEpIGRhdGEgKz0gJyYnO1xuICAgICAgICBkYXRhICs9IG5hbWUgKyAnPScgKyByZXF1ZXN0LmRhdGFbbmFtZV07XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IHJlcXVlc3QuZGF0YTsgLy8gU29tZSBmb3JtIG9mIHJhdyBzdHJpbmcvZGF0YVxuICAgIH1cbiAgfVxuICBpZiAoZGF0YSkge1xuICAgIGlmIChtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICByZXF1ZXN0LnVybCArPSAnPycgKyBkYXRhO1xuICAgIH1cbiAgfVxuXG4gIHJlcS5vcGVuKG1ldGhvZCwgcmVxdWVzdC51cmwsIHRydWUpO1xuICBpZiAocmVxdWVzdC50aW1lb3V0KSByZXEudGltZW91dCA9IHJlcXVlc3QudGltZW91dDtcbiAgaWYgKHJlcXVlc3Qud2l0aENyZWRlbnRpYWxzKSByZXEud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgaWYgKHJlcXVlc3QucmVzcG9uc2VUeXBlKSByZXEucmVzcG9uc2VUeXBlID0gcmVxdWVzdC5yZXNwb25zZVR5cGU7XG5cbiAgaWYgKHJlcXVlc3QuaGVhZGVycykge1xuICAgIE9iamVjdC5rZXlzKHJlcXVlc3QuaGVhZGVycykuZm9yRWFjaChoZWFkZXJOYW1lID0+IHJlcS5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlck5hbWUsIHJlcXVlc3QuaGVhZGVyc1toZWFkZXJOYW1lXSkpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBpZiAobWV0aG9kID09PSAnR0VUJykge1xuICAgICAgcmVxLnNlbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxLnNlbmQoZGF0YSk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG59O1xuXG5jb25zdCBsaXN0ZW5lcnMgPSBbXTtcbm1vZHVsZS5leHBvcnRzLmFkZENvbm5lY3Rpb25MaXN0ZW5lciA9IGZ1bmMgPT4gbGlzdGVuZXJzLnB1c2goZnVuYyk7XG5cbm1vZHVsZS5leHBvcnRzLnRyaWdnZXIgPSAoZXZ0KSA9PiB7XG4gIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmMgPT4gZnVuYyhldnQpKTtcbn07XG4iXX0=
