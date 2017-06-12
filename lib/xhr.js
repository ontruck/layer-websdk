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
  var startTime = Date.now();
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

      // Note that it is a successful connection if we get back an error from the server,
      // it may have been a failed request, but the connection was good.
      module.exports.trigger({
        target: this,
        status: !this.responseText && !this.status ? 'connection:error' : 'connection:success',
        duration: Date.now() - startTime,
        request: request
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy94aHIuanMiXSwibmFtZXMiOlsiWGhyIiwid2luZG93IiwicmVxdWlyZSIsInBhcnNlTGlua0hlYWRlcnMiLCJsaW5rSGVhZGVyIiwicGFydHMiLCJzcGxpdCIsImxpbmtzIiwiZm9yRWFjaCIsInBhcnQiLCJzZWN0aW9uIiwibGVuZ3RoIiwidXJsIiwicmVwbGFjZSIsInRyaW0iLCJuYW1lIiwibW9kdWxlIiwiZXhwb3J0cyIsInJlcXVlc3QiLCJjYWxsYmFjayIsInN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJyZXEiLCJYTUxIdHRwUmVxdWVzdCIsIm1ldGhvZCIsInRvVXBwZXJDYXNlIiwib25sb2FkIiwiaGVhZGVycyIsImdldFJlc3BvbnNlSGVhZGVyIiwicmVzdWx0Iiwic3RhdHVzIiwic3VjY2VzcyIsInhociIsImlzSlNPTiIsIlN0cmluZyIsIm1hdGNoIiwiZm9ybWF0IiwicmVzcG9uc2VUeXBlIiwiZGF0YSIsIkVycm9yIiwicmVzcG9uc2UiLCJyZXNwb25zZVRleHQiLCJKU09OIiwicGFyc2UiLCJlcnIiLCJjb2RlIiwibWVzc2FnZSIsInRyaWdnZXIiLCJ0YXJnZXQiLCJkdXJhdGlvbiIsImlkIiwiaHR0cFN0YXR1cyIsImFjY2VwdCIsIkxpbmtzIiwib25lcnJvciIsIm9udGltZW91dCIsImhlYWRlcnNMaXN0IiwiT2JqZWN0Iiwia2V5cyIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiQmxvYiIsInN0cmluZ2lmeSIsIm9wZW4iLCJ0aW1lb3V0Iiwid2l0aENyZWRlbnRpYWxzIiwic2V0UmVxdWVzdEhlYWRlciIsImhlYWRlck5hbWUiLCJzZW5kIiwiZSIsImxpc3RlbmVycyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsInB1c2giLCJmdW5jIiwiZXZ0Il0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdUJBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QkE7QUFDQTtBQUNBLElBQU1BLE1B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QTNCOztBQUUxQixNQUFJcEIsUUFBUVUsT0FBWixFQUFxQjtBQUNuQjhCLFdBQU9DLElBQVAsQ0FBWXpDLFFBQVFVLE9BQXBCLEVBQTZCcEIsT0FBN0IsQ0FBcUM7QUFBQSxhQUFjZSxJQUFJNEMsZ0JBQUosQ0FBcUJDLFVBQXJCLEVBQWlDbEQsUUFBUVUsT0FBUixDQUFnQndDLFVBQWhCLENBQWpDLENBQWQ7QUFBQSxLQUFyQztBQUNEOztBQUVELE1BQUk7QUFDRixRQUFJM0MsV0FBVyxLQUFmLEVBQXNCO0FBQ3BCRixVQUFJOEMsSUFBSjtBQUNELEtBRkQsTUFFTztBQUNMOUMsVUFBSThDLElBQUosQ0FBUzlCLElBQVQ7QUFDRDtBQUNGLEdBTkQsQ0FNRSxPQUFPK0IsQ0FBUCxFQUFVO0FBQ1Y7QUFDRDtBQUNGLENBdkpEOztBQXlKQSxJQUFNQyxZQUFZLEVBQWxCO0FBQ0F2RCxPQUFPQyxPQUFQLENBQWV1RCxxQkFBZixHQUF1QztBQUFBLFNBQVFELFVBQVVFLElBQVYsQ0FBZUMsSUFBZixDQUFSO0FBQUEsQ0FBdkM7O0FBRUExRCxPQUFPQyxPQUFQLENBQWUrQixPQUFmLEdBQXlCLFVBQUMyQixHQUFELEVBQVM7QUFDaENKLFlBQVUvRCxPQUFWLENBQWtCO0FBQUEsV0FBUWtFLEtBQUtDLEdBQUwsQ0FBUjtBQUFBLEdBQWxCO0FBQ0QsQ0FGRCIsImZpbGUiOiJ4aHIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJhc2ljIFhIUiBMaWJyYXJ5IHdpdGggc29tZSBub3Rpb25zIGhhcmRjb2RlZCBpblxuICogb2Ygd2hhdCB0aGUgTGF5ZXIgc2VydmVyIGV4cGVjdHMvcmV0dXJucy5cbiAqXG4gICAgbGF5ZXIueGhyKHtcbiAgICAgIHVybDogJ2h0dHA6Ly9teS5jb20vbXlkYXRhJyxcbiAgICAgIGRhdGE6IHtoZXk6ICdobycsIHRoZXJlOiAnZm9sayd9LFxuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIGZvcm1hdDogJ2pzb24nLFxuICAgICAgaGVhZGVyczogeydmcmVkJzogJ0pvZSd9LFxuICAgICAgdGltZW91dDogNTAwMDBcbiAgICB9LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgZXJyb3JIYW5kbGVyKHJlc3VsdC5kYXRhLCByZXN1bHQuaGVhZGVycywgcmVzdWx0LnN0YXR1cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdWNjZXNzSGFuZGxlcihyZXN1bHQuZGF0YSwgcmVzdWx0LmhlYWRlcnMsIHJlc3VsdC54aHIpO1xuICAgICAgfVxuICAgIH0pO1xuICpcbiAqIEBjbGFzcyBsYXllci54aHJcbiAqIEBwcml2YXRlXG4gKi9cblxuLyoqXG4gKiBTZW5kIGEgUmVxdWVzdC5cbiAqXG4gKiBAbWV0aG9kICB4aHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy51cmxcbiAqIEBwYXJhbSB7TWl4ZWR9IFtvcHRpb25zLmRhdGE9bnVsbF1cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb3JtYXQ9JyddIC0gc2V0IHRvICdqc29uJyB0byBnZXQgcmVzdWx0IHBhcnNlZCBhcyBqc29uIChpbiBjYXNlIHRoZXJlIGlzIG5vIG9idmlvdXMgQ29udGVudC1UeXBlIGluIHRoZSByZXNwb25zZSlcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzPXt9XSAtIE5hbWUgdmFsdWUgcGFpcnMgZm9yICBoZWFkZXJzIGFuZCB0aGVpciB2YWx1ZXNcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy50aW1lb3V0PTBdIC0gV2hlbiBkb2VzIHRoZSByZXF1ZXN0IGV4cGlyZS90aW1lb3V0IGluIG1pbGlzZWNvbmRzLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFjay5yZXN1bHRcbiAqIEBwYXJhbSB7bnVtYmVyfSBjYWxsYmFjay5yZXN1bHQuc3RhdHVzIC0gaHR0cCBzdGF0dXMgY29kZVxuICogQHBhcmFtIHtib29sZWFufSBjYWxsYmFjay5yZXN1bHQuc3VjY2VzcyAtIHRydWUgaWYgaXQgd2FzIGEgc3VjY2Vzc2Z1bCByZXNwb25zZVxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0gY2FsbGJhY2sucmVzdWx0LnhociAtIFRoZSBYSFIgb2JqZWN0IHVzZWQgZm9yIHRoZSByZXF1ZXN0XG4gKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2sucmVzdWx0LmRhdGEgLSAgVGhlIHBhcnNlZCByZXNwb25zZSBib2R5XG4gKlxuICogVE9ETzpcbiAqXG4gKiAxLiBNYWtlIHRoaXMgYSBzdWJjbGFzcyBvZiBSb290IGFuZCBtYWtlIGl0IGEgc2luZ2xldG9uIHNvIGl0IGNhbiBpbmhlcml0IGEgcHJvcGVyIGV2ZW50IHN5c3RlbVxuICogMi4gUmVzdWx0IHNob3VsZCBiZSBhIGxheWVyLlNlcnZlclJlc3BvbnNlIGluc3RhbmNlXG4gKiAzLiBTaG91bGQgb25seSBhY2Nlc3MgbGluayBoZWFkZXJzIGlmIHJlcXVlc3RlZDsgYW5ub3lpbmcgaGF2aW5nIGl0IHRocm93IGVycm9ycyBldmVyeSBvdGhlciB0aW1lLlxuICovXG5cbi8vIERvbid0IHNldCB4aHIgdG8gd2luZG93LlhNTEh0dHBSZXF1ZXN0IGFzIGl0IHdpbGwgYnlwYXNzIGphc21pbmUnc1xuLy8gYWpheCBsaWJyYXJ5XG5jb25zdCBYaHIgPSAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpID8gcmVxdWlyZSgneGhyMicpIDogbnVsbDtcblxuZnVuY3Rpb24gcGFyc2VMaW5rSGVhZGVycyhsaW5rSGVhZGVyKSB7XG4gIGlmICghbGlua0hlYWRlcikgcmV0dXJuIHt9O1xuXG4gIC8vIFNwbGl0IHBhcnRzIGJ5IGNvbW1hXG4gIGNvbnN0IHBhcnRzID0gbGlua0hlYWRlci5zcGxpdCgnLCcpO1xuICBjb25zdCBsaW5rcyA9IHt9O1xuXG4gIC8vIFBhcnNlIGVhY2ggcGFydCBpbnRvIGEgbmFtZWQgbGlua1xuICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgY29uc3Qgc2VjdGlvbiA9IHBhcnQuc3BsaXQoJzsnKTtcbiAgICBpZiAoc2VjdGlvbi5sZW5ndGggIT09IDIpIHJldHVybjtcbiAgICBjb25zdCB1cmwgPSBzZWN0aW9uWzBdLnJlcGxhY2UoLzwoLiopPi8sICckMScpLnRyaW0oKTtcbiAgICBjb25zdCBuYW1lID0gc2VjdGlvblsxXS5yZXBsYWNlKC9yZWw9Jz8oLiopJz8vLCAnJDEnKS50cmltKCk7XG4gICAgbGlua3NbbmFtZV0gPSB1cmw7XG4gIH0pO1xuXG4gIHJldHVybiBsaW5rcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgY29uc3QgcmVxID0gWGhyID8gbmV3IFhocigpIDogbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIGNvbnN0IG1ldGhvZCA9IChyZXF1ZXN0Lm1ldGhvZCB8fCAnR0VUJykudG9VcHBlckNhc2UoKTtcblxuICBjb25zdCBvbmxvYWQgPSBmdW5jdGlvbiBvbmxvYWQoKSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgICdjb250ZW50LXR5cGUnOiB0aGlzLmdldFJlc3BvbnNlSGVhZGVyKCdjb250ZW50LXR5cGUnKSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN1Y2Nlc3M6IHRoaXMuc3RhdHVzICYmIHRoaXMuc3RhdHVzIDwgMzAwLFxuICAgICAgeGhyOiB0aGlzLFxuICAgIH07XG5cbiAgICBjb25zdCBpc0pTT04gPSAoU3RyaW5nKGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKS5zcGxpdCgvOy8pWzBdLm1hdGNoKC9eYXBwbGljYXRpb25cXC9qc29uLykgfHxcbiAgICAgICAgICAgcmVxdWVzdC5mb3JtYXQgPT09ICdqc29uJyk7XG5cbiAgICBpZiAodGhpcy5yZXNwb25zZVR5cGUgPT09ICdibG9iJyB8fCB0aGlzLnJlc3BvbnNlVHlwZSA9PT0gJ2FycmF5YnVmZmVyJykge1xuICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAwKSB7XG4gICAgICAgIHJlc3VsdC5kYXRhID0gbmV3IEVycm9yKCdDb25uZWN0aW9uIEZhaWxlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGFtbml0LCB0aGlzLnJlc3BvbnNlIGlzIGEgZnVuY3Rpb24gaWYgdXNpbmcgamFzbWluZSB0ZXN0IGZyYW1ld29yay5cbiAgICAgICAgcmVzdWx0LmRhdGEgPSB0eXBlb2YgdGhpcy5yZXNwb25zZSA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMucmVzcG9uc2VUZXh0IDogdGhpcy5yZXNwb25zZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzSlNPTiAmJiB0aGlzLnJlc3BvbnNlVGV4dCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3VsdC5kYXRhID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHJlc3VsdC5kYXRhID0ge1xuICAgICAgICAgICAgY29kZTogOTk5LFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgSlNPTiBmcm9tIHNlcnZlcicsXG4gICAgICAgICAgICByZXNwb25zZTogdGhpcy5yZXNwb25zZVRleHQsXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXN1bHQuc3RhdHVzID0gOTk5O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZGF0YSA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlIHRoYXQgaXQgaXMgYSBzdWNjZXNzZnVsIGNvbm5lY3Rpb24gaWYgd2UgZ2V0IGJhY2sgYW4gZXJyb3IgZnJvbSB0aGUgc2VydmVyLFxuICAgICAgLy8gaXQgbWF5IGhhdmUgYmVlbiBhIGZhaWxlZCByZXF1ZXN0LCBidXQgdGhlIGNvbm5lY3Rpb24gd2FzIGdvb2QuXG4gICAgICBtb2R1bGUuZXhwb3J0cy50cmlnZ2VyKHtcbiAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICBzdGF0dXM6ICF0aGlzLnJlc3BvbnNlVGV4dCAmJiAhdGhpcy5zdGF0dXMgPyAnY29ubmVjdGlvbjplcnJvcicgOiAnY29ubmVjdGlvbjpzdWNjZXNzJyxcbiAgICAgICAgZHVyYXRpb246IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICAgIHJlcXVlc3QsXG4gICAgICB9KTtcblxuICAgICAgaWYgKCF0aGlzLnJlc3BvbnNlVGV4dCAmJiAhdGhpcy5zdGF0dXMpIHtcbiAgICAgICAgcmVzdWx0LnN0YXR1cyA9IDQwODtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3RpbWVvdXQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdUaGUgc2VydmVyIGlzIG5vdCByZXNwb25kaW5nIHBsZWFzZSB0cnkgYWdhaW4gaW4gYSBmZXcgbWludXRlcycsXG4gICAgICAgICAgdXJsOiAnaHR0cHM6Ly9kb2NzLmxheWVyLmNvbS9yZWZlcmVuY2UvY2xpZW50X2FwaS9lcnJvcnMnLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgc3RhdHVzOiA0MDgsXG4gICAgICAgICAgaHR0cFN0YXR1czogNDA4LFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnN0YXR1cyA9PT0gNDA0ICYmIHR5cGVvZiByZXN1bHQuZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB7XG4gICAgICAgICAgaWQ6ICdvcGVyYXRpb25fbm90X2ZvdW5kJyxcbiAgICAgICAgICBtZXNzYWdlOiAnRW5kcG9pbnQgJyArIChyZXF1ZXN0Lm1ldGhvZCB8fCAnR0VUJykgKyAnICcgKyByZXF1ZXN0LnVybCArICcgZG9lcyBub3QgZXhpc3QnLFxuICAgICAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIGNvZGU6IDEwNixcbiAgICAgICAgICB1cmw6ICdodHRwczovL2RvY3MubGF5ZXIuY29tL3JlZmVyZW5jZS9jbGllbnRfYXBpL2Vycm9ycycsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQuZGF0YSA9PT0gJ3N0cmluZycgJiYgdGhpcy5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgIHJlc3VsdC5kYXRhID0ge1xuICAgICAgICAgIGlkOiAndW5rbm93bl9lcnJvcicsXG4gICAgICAgICAgbWVzc2FnZTogcmVzdWx0LmRhdGEsXG4gICAgICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgICAgICBodHRwU3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgIHVybDogJ2h0dHBzOi8vd3d3Lmdvb2dsZS5jb20vc2VhcmNoP3E9ZG9oIScsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJlcXVlc3QuaGVhZGVycyAmJiAocmVxdWVzdC5oZWFkZXJzLmFjY2VwdCB8fCAnJykubWF0Y2goL2FwcGxpY2F0aW9uXFwvdm5kLmxheWVyXFwranNvbi8pKSB7XG4gICAgICBjb25zdCBsaW5rcyA9IHRoaXMuZ2V0UmVzcG9uc2VIZWFkZXIoJ2xpbmsnKTtcbiAgICAgIGlmIChsaW5rcykgcmVzdWx0LkxpbmtzID0gcGFyc2VMaW5rSGVhZGVycyhsaW5rcyk7XG4gICAgfVxuICAgIHJlc3VsdC54aHIgPSB0aGlzO1xuXG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXN1bHQpO1xuICB9O1xuXG4gIHJlcS5vbmxvYWQgPSBvbmxvYWQ7XG5cbiAgLy8gVU5URVNURUQhISFcbiAgcmVxLm9uZXJyb3IgPSByZXEub250aW1lb3V0ID0gb25sb2FkO1xuXG4gIC8vIFJlcGxhY2UgYWxsIGhlYWRlcnMgaW4gYXJiaXRyYXJ5IGNhc2Ugd2l0aCBhbGwgbG93ZXIgY2FzZVxuICAvLyBmb3IgZWFzeSBtYXRjaGluZy5cbiAgY29uc3QgaGVhZGVyc0xpc3QgPSBPYmplY3Qua2V5cyhyZXF1ZXN0LmhlYWRlcnMgfHwge30pO1xuICBjb25zdCBoZWFkZXJzID0ge307XG4gIGhlYWRlcnNMaXN0LmZvckVhY2goKGhlYWRlcikgPT4ge1xuICAgIGlmIChoZWFkZXIudG9Mb3dlckNhc2UoKSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgIGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddID0gcmVxdWVzdC5oZWFkZXJzW2hlYWRlcl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYWRlcnNbaGVhZGVyLnRvTG93ZXJDYXNlKCldID0gcmVxdWVzdC5oZWFkZXJzW2hlYWRlcl07XG4gICAgfVxuICB9KTtcbiAgcmVxdWVzdC5oZWFkZXJzID0gaGVhZGVycztcblxuICBsZXQgZGF0YSA9ICcnO1xuICBpZiAocmVxdWVzdC5kYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyAmJiByZXF1ZXN0LmRhdGEgaW5zdGFuY2VvZiBCbG9iKSB7XG4gICAgICBkYXRhID0gcmVxdWVzdC5kYXRhO1xuICAgIH0gZWxzZSBpZiAocmVxdWVzdC5oZWFkZXJzICYmIChcbiAgICAgICAgU3RyaW5nKHJlcXVlc3QuaGVhZGVyc1snY29udGVudC10eXBlJ10pLm1hdGNoKC9eYXBwbGljYXRpb25cXC9qc29uLykgfHxcbiAgICAgICAgU3RyaW5nKHJlcXVlc3QuaGVhZGVyc1snY29udGVudC10eXBlJ10pID09PSAnYXBwbGljYXRpb24vdm5kLmxheWVyLXBhdGNoK2pzb24nKVxuICAgICkge1xuICAgICAgZGF0YSA9IHR5cGVvZiByZXF1ZXN0LmRhdGEgPT09ICdzdHJpbmcnID8gcmVxdWVzdC5kYXRhIDogSlNPTi5zdHJpbmdpZnkocmVxdWVzdC5kYXRhKTtcbiAgICB9IGVsc2UgaWYgKHJlcXVlc3QuZGF0YSAmJiB0eXBlb2YgcmVxdWVzdC5kYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgT2JqZWN0LmtleXMocmVxdWVzdC5kYXRhKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIGlmIChkYXRhKSBkYXRhICs9ICcmJztcbiAgICAgICAgZGF0YSArPSBuYW1lICsgJz0nICsgcmVxdWVzdC5kYXRhW25hbWVdO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEgPSByZXF1ZXN0LmRhdGE7IC8vIFNvbWUgZm9ybSBvZiByYXcgc3RyaW5nL2RhdGFcbiAgICB9XG4gIH1cbiAgaWYgKGRhdGEpIHtcbiAgICBpZiAobWV0aG9kID09PSAnR0VUJykge1xuICAgICAgcmVxdWVzdC51cmwgKz0gJz8nICsgZGF0YTtcbiAgICB9XG4gIH1cblxuICByZXEub3BlbihtZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKTtcbiAgaWYgKHJlcXVlc3QudGltZW91dCkgcmVxLnRpbWVvdXQgPSByZXF1ZXN0LnRpbWVvdXQ7XG4gIGlmIChyZXF1ZXN0LndpdGhDcmVkZW50aWFscykgcmVxLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gIGlmIChyZXF1ZXN0LnJlc3BvbnNlVHlwZSkgcmVxLnJlc3BvbnNlVHlwZSA9IHJlcXVlc3QucmVzcG9uc2VUeXBlO1xuXG4gIGlmIChyZXF1ZXN0LmhlYWRlcnMpIHtcbiAgICBPYmplY3Qua2V5cyhyZXF1ZXN0LmhlYWRlcnMpLmZvckVhY2goaGVhZGVyTmFtZSA9PiByZXEuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXJOYW1lLCByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyTmFtZV0pKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgaWYgKG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgIHJlcS5zZW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcS5zZW5kKGRhdGEpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIGRvIG5vdGhpbmdcbiAgfVxufTtcblxuY29uc3QgbGlzdGVuZXJzID0gW107XG5tb2R1bGUuZXhwb3J0cy5hZGRDb25uZWN0aW9uTGlzdGVuZXIgPSBmdW5jID0+IGxpc3RlbmVycy5wdXNoKGZ1bmMpO1xuXG5tb2R1bGUuZXhwb3J0cy50cmlnZ2VyID0gKGV2dCkgPT4ge1xuICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jID0+IGZ1bmMoZXZ0KSk7XG59O1xuIl19
