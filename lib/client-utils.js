'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Utility methods
 *
 * @class layer.ClientUtils
 */

var uuid = require('uuid');
var base64url = require('base64url');
exports.atob = typeof atob === 'undefined' ? global.getNativeSupport('atob') : atob.bind(window);
exports.btoa = typeof btoa === 'undefined' ? global.getNativeSupport('btoa') : btoa.bind(window);
var LocalFileReader = typeof FileReader === 'undefined' ? global.getNativeSupport('FileReader') : FileReader;

/**
 * Generate a random UUID
 *
 * @method
 * @return {string}
 */
exports.generateUUID = uuid.v4;

/**
 * Returns the 'type' portion of a Layer ID.
 *
 *         switch(Utils.typeFromID(id)) {
 *             case 'conversations':
 *                 ...
 *             case 'message':
 *                 ...
 *             case: 'queries':
 *                 ...
 *         }
 *
 * Does not currently handle Layer App IDs.
 *
 * @method
 * @param  {string} id
 * @return {string}
 */
exports.typeFromID = function (id) {
  var matches = id.match(/([^/]*)(\/[^/]*)$/);
  return matches ? matches[1] : '';
};

/**
 * Returns the UUID portion of a Layer ID
 *
 * @method
 * @param  {string} id
 * @return {string}
 */
exports.uuid = function (id) {
  return (id || '').replace(/^.*\//, '');
};

exports.isEmpty = function (obj) {
  return Object.prototype.toString.apply(obj) === '[object Object]' && Object.keys(obj).length === 0;
};

/**
 * Simplified sort method.
 *
 * Provides a function to return the value to compare rather than do the comparison.
 *
 *      sortBy([{v: 3}, {v: 1}, v: 33}], function(value) {
 *          return value.v;
 *      }, false);
 *
 * @method
 * @param  {Mixed[]}   inArray      Array to sort
 * @param  {Function} fn            Function that will return a value to compare
 * @param  {Function} fn.value      Current value from inArray we are comparing, and from which a value should be extracted
 * @param  {boolean}  [reverse=false] Sort ascending (false) or descending (true)
 */
exports.sortBy = function (inArray, fn, reverse) {
  reverse = reverse ? -1 : 1;
  return inArray.sort(function (valueA, valueB) {
    var aa = fn(valueA);
    var bb = fn(valueB);
    if (aa === undefined && bb === undefined) return 0;
    if (aa === undefined && bb !== undefined) return 1;
    if (aa !== undefined && bb === undefined) return -1;
    if (aa > bb) return 1 * reverse;
    if (aa < bb) return -1 * reverse;
    return 0;
  });
};

/**
 * Quick and easy clone method.
 *
 * Does not work on circular references; should not be used
 * on objects with event listeners.
 *
 *      var newObj = Utils.clone(oldObj);
 *
 * @method
 * @param  {Object}     Object to clone
 * @return {Object}     New Object
 */
exports.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * URL Decode a URL Encoded base64 string
 *
 * Copied from https://github.com/auth0-blog/angular-token-auth, but
 * appears in many places on the web.
 *
 * @method decode
 * @param {String} str   base64 string
 * @return str   Decoded string
 */
/* istanbul ignore next */
exports.decode = function (str) {
  var result = base64url.decode(str);
  if (!result) throw new Error("Illegal base64url string!");
  return result;
};

/**
 * Returns a delay in seconds needed to follow an exponential
 * backoff pattern of delays for retrying a connection.
 *
 * Algorithm has two motivations:
 *
 * 1. Retry with increasingly long intervals up to some maximum interval
 * 2. Randomize the retry interval enough so that a thousand clients
 * all following the same algorithm at the same time will not hit the
 * server at the exact same times.
 *
 * The following are results before jitter for some values of counter:

      0: 0.1
      1: 0.2
      2: 0.4
      3: 0.8
      4: 1.6
      5: 3.2
      6: 6.4
      7: 12.8
      8: 25.6
      9: 51.2
      10: 102.4
      11. 204.8
      12. 409.6
      13. 819.2
      14. 1638.4 (27 minutes)

 * @method getExponentialBackoffSeconds
 * @param  {number} maxSeconds - This is not the maximum seconds delay, but rather
 * the maximum seconds delay BEFORE adding a randomized value.
 * @param  {number} counter - Current counter to use for calculating the delay; should be incremented up to some reasonable maximum value for each use.
 * @return {number}     Delay in seconds/fractions of a second
 */
exports.getExponentialBackoffSeconds = function getExponentialBackoffSeconds(maxSeconds, counter) {
  var secondsWaitTime = Math.pow(2, counter) / 10,
      secondsOffset = Math.random(); // value between 0-1 seconds.
  if (counter < 2) secondsOffset = secondsOffset / 4; // values less than 0.2 should be offset by 0-0.25 seconds
  else if (counter < 6) secondsOffset = secondsOffset / 2; // values between 0.2 and 1.0 should be offset by 0-0.5 seconds

  if (secondsWaitTime >= maxSeconds) secondsWaitTime = maxSeconds;

  return secondsWaitTime + secondsOffset;
};

/**
 * Is this data a blob?
 *
 * @method isBlob
 * @param {Mixed} value
 * @returns {Boolean} - True if its a blob, false if not.
 */
exports.isBlob = function (value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
};

/**
 * Given a blob return a base64 string.
 *
 * @method blobToBase64
 * @param {Blob} blob - data to convert to base64
 * @param {Function} callback
 * @param {String} callback.result - Your base64 string result
 */
exports.blobToBase64 = function (blob, callback) {
  var reader = new LocalFileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = function () {
    return callback(reader.result.replace(/^.*?,/, ''));
  };
};

/**
 * Given a base64 string return a blob.
 *
 * @method base64ToBlob
 * @param {String} b64Data - base64 string data without any type prefixes
 * @param {String} contentType - mime type of the data
 * @returns {Blob}
 */
exports.base64ToBlob = function (b64Data, contentType) {
  try {
    var sliceSize = 512;
    var byteCharacters = exports.atob(b64Data);
    var byteArrays = [];
    var offset = void 0;

    for (offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var i = void 0;
      var slice = byteCharacters.slice(offset, offset + sliceSize);
      var byteNumbers = new Array(slice.length);
      for (i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  } catch (e) {
    // noop
  }
  return null;
};

/**
 * Does window.btao() in a unicode-safe way
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method utoa
 * @param {String} str
 * @return {String}
 */
exports.utoa = function (str) {
  return exports.btoa(unescape(encodeURIComponent(str)));
};

/**
 * Does window.atob() in a way that can decode data from utoa()
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method atou
 * @param {String} str
 * @return {String}
 */
exports.atou = function (str) {
  return decodeURIComponent(escape(exports.atob(str)));
};

/**
 * Given a File/Blob return a string.
 *
 * Assumes blob represents textual data.
 *
 * @method fetchTextFromFile
 * @param {Blob} file
 * @param {Function} callback
 * @param {String} callback.result
 */
exports.fetchTextFromFile = function (file, callback) {
  if (typeof file === 'string') return callback(file);
  var reader = new LocalFileReader();
  reader.addEventListener('loadend', function () {
    callback(reader.result);
  });
  reader.readAsText(file);
};

/**
 * Execute this function immediately after current processing is complete (setImmediate replacement).
 *
 * A depth of up to 10 is allowed.  That means that functions you schedule using defer
 * can in turn schedule further actions.  The original actions are depth = 0; the actions scheduled
 * by your actions are depth = 1.  These new actions may in turn schedule further actions, which happen at depth = 3.
 * But to avoid infinite loops, if depth reaches 10, it clears the queue and ignores them.
 *
 * @method defer
 * @param {Function} f
 */
exports.defer = require('./utils/defer');

/**
 * Run the Layer Parser on the request.
 *
 * Parameters here
 * are the parameters specied in [Layer-Patch](https://github.com/layerhq/node-layer-patch), plus
 * a client object.
 *
 *      Util.layerParse({
 *          object: conversation,
 *          type: 'Conversation',
 *          operations: layerPatchOperations,
 *          client: client
 *      });
 *
 * @method
 * @deprecated Use 'utils/layer-parser' instead
 * @param {Object} request - layer-patch parameters
 * @param {Object} request.object - Object being updated  by the operations
 * @param {string} request.type - Type of object being updated
 * @param {Object[]} request.operations - Array of change operations to perform upon the object
 * @param {layer.Client} request.client
 */
exports.layerParse = require('./utils/layer-parser');

/**
 * Object comparison.
 *
 * Does a recursive traversal of two objects verifying that they are the same.
 * Is able to make metadata-restricted assumptions such as that
 * all values are either plain Objects or strings.
 *
 *      if (Utils.doesObjectMatch(conv1.metadata, conv2.metadata)) {
 *          alert('These two metadata objects are the same');
 *      }
 *
 * @method
 * @param  {Object} requestedData
 * @param  {Object} actualData
 * @return {boolean}
 */
exports.doesObjectMatch = function (requestedData, actualData) {
  if (!requestedData && actualData || requestedData && !actualData) return false;
  var requestedKeys = Object.keys(requestedData).sort();
  var actualKeys = Object.keys(actualData).sort();

  // If there are a different number of keys, fail.
  if (requestedKeys.length !== actualKeys.length) return false;

  // Compare key name and value at each index
  for (var index = 0; index < requestedKeys.length; index++) {
    var k1 = requestedKeys[index];
    var k2 = actualKeys[index];
    var v1 = requestedData[k1];
    var v2 = actualData[k2];
    if (k1 !== k2) return false;
    if (v1 && (typeof v1 === 'undefined' ? 'undefined' : _typeof(v1)) === 'object') {
      // Array comparison is not used by the Web SDK at this time.
      if (Array.isArray(v1)) {
        throw new Error('Array comparison not handled yet');
      } else if (!exports.doesObjectMatch(v1, v2)) {
        return false;
      }
    } else if (v1 !== v2) {
      return false;
    }
  }
  return true;
};

/**
 * Simple array inclusion test
 * @method includes
 * @param {Mixed[]} items
 * @param {Mixed} value
 * @returns {boolean}
 */
exports.includes = function (items, value) {
  return items.indexOf(value) !== -1;
};

/**
 * Some ASCII art when client initializes
 */
exports.asciiInit = function (version) {
  if (!version) return 'Missing version';

  var split = version.split('-');
  var line1 = split[0] || '',
      line2 = split[1] || '';

  line1 += new Array(13 - line1.length).join(' ');
  line2 += new Array(14 - line2.length).join(' ');

  return '\n    /hNMMMMMMMMMMMMMMMMMMMms.\n  hMMy+/////////////////omMN-\n  MMN                    oMMo\n  MMN        Layer       oMMo\n  MMN       Web SDK      oMMo\n  MMM-                   oMMo\n  MMMy      v' + line1 + 'oMMo\n  MMMMo     ' + line2 + 'oMMo\n  MMMMMy.                oMMo\n  MMMMMMNy:\'             oMMo\n  NMMMMMMMMmy+:-.\'      \'yMM/\n  :dMMMMMMMMMMMMNNNNNNNNNMNs\n   -/+++++++++++++++++++:\'';
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtdXRpbHMuanMiXSwibmFtZXMiOlsidXVpZCIsInJlcXVpcmUiLCJiYXNlNjR1cmwiLCJleHBvcnRzIiwiYXRvYiIsImdsb2JhbCIsImdldE5hdGl2ZVN1cHBvcnQiLCJiaW5kIiwid2luZG93IiwiYnRvYSIsIkxvY2FsRmlsZVJlYWRlciIsIkZpbGVSZWFkZXIiLCJnZW5lcmF0ZVVVSUQiLCJ2NCIsInR5cGVGcm9tSUQiLCJpZCIsIm1hdGNoZXMiLCJtYXRjaCIsInJlcGxhY2UiLCJpc0VtcHR5IiwiT2JqZWN0IiwicHJvdG90eXBlIiwidG9TdHJpbmciLCJhcHBseSIsIm9iaiIsImtleXMiLCJsZW5ndGgiLCJzb3J0QnkiLCJpbkFycmF5IiwiZm4iLCJyZXZlcnNlIiwic29ydCIsInZhbHVlQSIsInZhbHVlQiIsImFhIiwiYmIiLCJ1bmRlZmluZWQiLCJjbG9uZSIsIkpTT04iLCJwYXJzZSIsInN0cmluZ2lmeSIsImRlY29kZSIsInN0ciIsInJlc3VsdCIsIkVycm9yIiwiZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyIsIm1heFNlY29uZHMiLCJjb3VudGVyIiwic2Vjb25kc1dhaXRUaW1lIiwiTWF0aCIsInBvdyIsInNlY29uZHNPZmZzZXQiLCJyYW5kb20iLCJpc0Jsb2IiLCJCbG9iIiwidmFsdWUiLCJibG9iVG9CYXNlNjQiLCJibG9iIiwiY2FsbGJhY2siLCJyZWFkZXIiLCJyZWFkQXNEYXRhVVJMIiwib25sb2FkZW5kIiwiYmFzZTY0VG9CbG9iIiwiYjY0RGF0YSIsImNvbnRlbnRUeXBlIiwic2xpY2VTaXplIiwiYnl0ZUNoYXJhY3RlcnMiLCJieXRlQXJyYXlzIiwib2Zmc2V0IiwiaSIsInNsaWNlIiwiYnl0ZU51bWJlcnMiLCJBcnJheSIsImNoYXJDb2RlQXQiLCJieXRlQXJyYXkiLCJVaW50OEFycmF5IiwicHVzaCIsInR5cGUiLCJlIiwidXRvYSIsInVuZXNjYXBlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiYXRvdSIsImRlY29kZVVSSUNvbXBvbmVudCIsImVzY2FwZSIsImZldGNoVGV4dEZyb21GaWxlIiwiZmlsZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZWFkQXNUZXh0IiwiZGVmZXIiLCJsYXllclBhcnNlIiwiZG9lc09iamVjdE1hdGNoIiwicmVxdWVzdGVkRGF0YSIsImFjdHVhbERhdGEiLCJyZXF1ZXN0ZWRLZXlzIiwiYWN0dWFsS2V5cyIsImluZGV4IiwiazEiLCJrMiIsInYxIiwidjIiLCJpc0FycmF5IiwiaW5jbHVkZXMiLCJpdGVtcyIsImluZGV4T2YiLCJhc2NpaUluaXQiLCJ2ZXJzaW9uIiwic3BsaXQiLCJsaW5lMSIsImxpbmUyIiwiam9pbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLE1BQVIsQ0FBYjtBQUNBLElBQU1DLFlBQVlELFFBQVEsV0FBUixDQUFsQjtBQUNBRSxRQUFRQyxJQUFSLEdBQWUsT0FBT0EsSUFBUCxLQUFnQixXQUFoQixHQUE4QkMsT0FBT0MsZ0JBQVAsQ0FBd0IsTUFBeEIsQ0FBOUIsR0FBZ0VGLEtBQUtHLElBQUwsQ0FBVUMsTUFBVixDQUEvRTtBQUNBTCxRQUFRTSxJQUFSLEdBQWUsT0FBT0EsSUFBUCxLQUFnQixXQUFoQixHQUE4QkosT0FBT0MsZ0JBQVAsQ0FBd0IsTUFBeEIsQ0FBOUIsR0FBZ0VHLEtBQUtGLElBQUwsQ0FBVUMsTUFBVixDQUEvRTtBQUNBLElBQU1FLGtCQUFrQixPQUFPQyxVQUFQLEtBQXNCLFdBQXRCLEdBQW9DTixPQUFPQyxnQkFBUCxDQUF3QixZQUF4QixDQUFwQyxHQUE0RUssVUFBcEc7O0FBR0E7Ozs7OztBQU1BUixRQUFRUyxZQUFSLEdBQXVCWixLQUFLYSxFQUE1Qjs7QUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBa0JBVixRQUFRVyxVQUFSLEdBQXFCLFVBQUNDLEVBQUQsRUFBUTtBQUMzQixNQUFNQyxVQUFVRCxHQUFHRSxLQUFILENBQVMsbUJBQVQsQ0FBaEI7QUFDQSxTQUFPRCxVQUFVQSxR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Q0FBQ0EsT0FBTCxFQUFjLE9BQU8saUJBQVA7O0FBRWQsTUFBTUMsUUFBUUQsUUFBUUMsS0FBUixDQUFjLEdBQWQsQ0FBZDtBQUNBLE1BQUlDLFFBQVFELE1BQU0sQ0FBTixLQUFZLEVBQXhCO0FBQUEsTUFDRUUsUUFBUUYsTUFBTSxDQUFOLEtBQVksRUFEdEI7O0FBR0FDLFdBQVMsSUFBSXBDLEtBQUosQ0FBVSxLQUFLb0MsTUFBTWxGLE1BQXJCLEVBQTZCb0YsSUFBN0IsQ0FBa0MsR0FBbEMsQ0FBVDtBQUNBRCxXQUFTLElBQUlyQyxLQUFKLENBQVUsS0FBS3FDLE1BQU1uRixNQUFyQixFQUE2Qm9GLElBQTdCLENBQWtDLEdBQWxDLENBQVQ7O0FBRUEsdU5BT2FGLEtBUGIsMEJBUVlDLEtBUlo7QUFjRCxDQXhCRCIsImZpbGUiOiJjbGllbnQtdXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFV0aWxpdHkgbWV0aG9kc1xuICpcbiAqIEBjbGFzcyBsYXllci5DbGllbnRVdGlsc1xuICovXG5cbmNvbnN0IHV1aWQgPSByZXF1aXJlKCd1dWlkJyk7XG5jb25zdCBiYXNlNjR1cmwgPSByZXF1aXJlKCdiYXNlNjR1cmwnKTtcbmV4cG9ydHMuYXRvYiA9IHR5cGVvZiBhdG9iID09PSAndW5kZWZpbmVkJyA/IGdsb2JhbC5nZXROYXRpdmVTdXBwb3J0KCdhdG9iJykgOiBhdG9iLmJpbmQod2luZG93KTtcbmV4cG9ydHMuYnRvYSA9IHR5cGVvZiBidG9hID09PSAndW5kZWZpbmVkJyA/IGdsb2JhbC5nZXROYXRpdmVTdXBwb3J0KCdidG9hJykgOiBidG9hLmJpbmQod2luZG93KTtcbmNvbnN0IExvY2FsRmlsZVJlYWRlciA9IHR5cGVvZiBGaWxlUmVhZGVyID09PSAndW5kZWZpbmVkJyA/IGdsb2JhbC5nZXROYXRpdmVTdXBwb3J0KCdGaWxlUmVhZGVyJykgOiBGaWxlUmVhZGVyO1xuXG5cbi8qKlxuICogR2VuZXJhdGUgYSByYW5kb20gVVVJRFxuICpcbiAqIEBtZXRob2RcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZXhwb3J0cy5nZW5lcmF0ZVVVSUQgPSB1dWlkLnY0O1xuXG4vKipcbiAqIFJldHVybnMgdGhlICd0eXBlJyBwb3J0aW9uIG9mIGEgTGF5ZXIgSUQuXG4gKlxuICogICAgICAgICBzd2l0Y2goVXRpbHMudHlwZUZyb21JRChpZCkpIHtcbiAqICAgICAgICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICogICAgICAgICAgICAgICAgIC4uLlxuICogICAgICAgICAgICAgY2FzZSAnbWVzc2FnZSc6XG4gKiAgICAgICAgICAgICAgICAgLi4uXG4gKiAgICAgICAgICAgICBjYXNlOiAncXVlcmllcyc6XG4gKiAgICAgICAgICAgICAgICAgLi4uXG4gKiAgICAgICAgIH1cbiAqXG4gKiBEb2VzIG5vdCBjdXJyZW50bHkgaGFuZGxlIExheWVyIEFwcCBJRHMuXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5leHBvcnRzLnR5cGVGcm9tSUQgPSAoaWQpID0+IHtcbiAgY29uc3QgbWF0Y2hlcyA9IGlkLm1hdGNoKC8oW14vXSopKFxcL1teL10qKSQvKTtcbiAgcmV0dXJuIG1hdGNoZXMgPyBtYXRjaGVzWzFdIDogJyc7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIFVVSUQgcG9ydGlvbiBvZiBhIExheWVyIElEXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5leHBvcnRzLnV1aWQgPSBpZCA9PiAoaWQgfHwgJycpLnJlcGxhY2UoL14uKlxcLy8sICcnKTtcblxuZXhwb3J0cy5pc0VtcHR5ID0gb2JqID0+IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuYXBwbHkob2JqKSA9PT0gJ1tvYmplY3QgT2JqZWN0XScgJiYgT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDA7XG5cbi8qKlxuICogU2ltcGxpZmllZCBzb3J0IG1ldGhvZC5cbiAqXG4gKiBQcm92aWRlcyBhIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgdmFsdWUgdG8gY29tcGFyZSByYXRoZXIgdGhhbiBkbyB0aGUgY29tcGFyaXNvbi5cbiAqXG4gKiAgICAgIHNvcnRCeShbe3Y6IDN9LCB7djogMX0sIHY6IDMzfV0sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gKiAgICAgICAgICByZXR1cm4gdmFsdWUudjtcbiAqICAgICAgfSwgZmFsc2UpO1xuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge01peGVkW119ICAgaW5BcnJheSAgICAgIEFycmF5IHRvIHNvcnRcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgICAgICAgICAgIEZ1bmN0aW9uIHRoYXQgd2lsbCByZXR1cm4gYSB2YWx1ZSB0byBjb21wYXJlXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm4udmFsdWUgICAgICBDdXJyZW50IHZhbHVlIGZyb20gaW5BcnJheSB3ZSBhcmUgY29tcGFyaW5nLCBhbmQgZnJvbSB3aGljaCBhIHZhbHVlIHNob3VsZCBiZSBleHRyYWN0ZWRcbiAqIEBwYXJhbSAge2Jvb2xlYW59ICBbcmV2ZXJzZT1mYWxzZV0gU29ydCBhc2NlbmRpbmcgKGZhbHNlKSBvciBkZXNjZW5kaW5nICh0cnVlKVxuICovXG5leHBvcnRzLnNvcnRCeSA9IChpbkFycmF5LCBmbiwgcmV2ZXJzZSkgPT4ge1xuICByZXZlcnNlID0gcmV2ZXJzZSA/IC0xIDogMTtcbiAgcmV0dXJuIGluQXJyYXkuc29ydCgodmFsdWVBLCB2YWx1ZUIpID0+IHtcbiAgICBjb25zdCBhYSA9IGZuKHZhbHVlQSk7XG4gICAgY29uc3QgYmIgPSBmbih2YWx1ZUIpO1xuICAgIGlmIChhYSA9PT0gdW5kZWZpbmVkICYmIGJiID09PSB1bmRlZmluZWQpIHJldHVybiAwO1xuICAgIGlmIChhYSA9PT0gdW5kZWZpbmVkICYmIGJiICE9PSB1bmRlZmluZWQpIHJldHVybiAxO1xuICAgIGlmIChhYSAhPT0gdW5kZWZpbmVkICYmIGJiID09PSB1bmRlZmluZWQpIHJldHVybiAtMTtcbiAgICBpZiAoYWEgPiBiYikgcmV0dXJuIDEgKiByZXZlcnNlO1xuICAgIGlmIChhYSA8IGJiKSByZXR1cm4gLTEgKiByZXZlcnNlO1xuICAgIHJldHVybiAwO1xuICB9KTtcbn07XG5cbi8qKlxuICogUXVpY2sgYW5kIGVhc3kgY2xvbmUgbWV0aG9kLlxuICpcbiAqIERvZXMgbm90IHdvcmsgb24gY2lyY3VsYXIgcmVmZXJlbmNlczsgc2hvdWxkIG5vdCBiZSB1c2VkXG4gKiBvbiBvYmplY3RzIHdpdGggZXZlbnQgbGlzdGVuZXJzLlxuICpcbiAqICAgICAgdmFyIG5ld09iaiA9IFV0aWxzLmNsb25lKG9sZE9iaik7XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7T2JqZWN0fSAgICAgT2JqZWN0IHRvIGNsb25lXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICBOZXcgT2JqZWN0XG4gKi9cbmV4cG9ydHMuY2xvbmUgPSBvYmogPT4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcblxuXG4vKipcbiAqIFVSTCBEZWNvZGUgYSBVUkwgRW5jb2RlZCBiYXNlNjQgc3RyaW5nXG4gKlxuICogQ29waWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2F1dGgwLWJsb2cvYW5ndWxhci10b2tlbi1hdXRoLCBidXRcbiAqIGFwcGVhcnMgaW4gbWFueSBwbGFjZXMgb24gdGhlIHdlYi5cbiAqXG4gKiBAbWV0aG9kIGRlY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciAgIGJhc2U2NCBzdHJpbmdcbiAqIEByZXR1cm4gc3RyICAgRGVjb2RlZCBzdHJpbmdcbiAqL1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmV4cG9ydHMuZGVjb2RlID0gKHN0cikgPT4ge1xuICBjb25zdCByZXN1bHQgPSBiYXNlNjR1cmwuZGVjb2RlKHN0cik7XG4gIGlmICghcmVzdWx0KSB0aHJvdyBuZXcgRXJyb3IoXCJJbGxlZ2FsIGJhc2U2NHVybCBzdHJpbmchXCIpO1xuICByZXR1cm4gcmVzdWx0O1xufTtcblxuXG4vKipcbiAqIFJldHVybnMgYSBkZWxheSBpbiBzZWNvbmRzIG5lZWRlZCB0byBmb2xsb3cgYW4gZXhwb25lbnRpYWxcbiAqIGJhY2tvZmYgcGF0dGVybiBvZiBkZWxheXMgZm9yIHJldHJ5aW5nIGEgY29ubmVjdGlvbi5cbiAqXG4gKiBBbGdvcml0aG0gaGFzIHR3byBtb3RpdmF0aW9uczpcbiAqXG4gKiAxLiBSZXRyeSB3aXRoIGluY3JlYXNpbmdseSBsb25nIGludGVydmFscyB1cCB0byBzb21lIG1heGltdW0gaW50ZXJ2YWxcbiAqIDIuIFJhbmRvbWl6ZSB0aGUgcmV0cnkgaW50ZXJ2YWwgZW5vdWdoIHNvIHRoYXQgYSB0aG91c2FuZCBjbGllbnRzXG4gKiBhbGwgZm9sbG93aW5nIHRoZSBzYW1lIGFsZ29yaXRobSBhdCB0aGUgc2FtZSB0aW1lIHdpbGwgbm90IGhpdCB0aGVcbiAqIHNlcnZlciBhdCB0aGUgZXhhY3Qgc2FtZSB0aW1lcy5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIGFyZSByZXN1bHRzIGJlZm9yZSBqaXR0ZXIgZm9yIHNvbWUgdmFsdWVzIG9mIGNvdW50ZXI6XG5cbiAgICAgIDA6IDAuMVxuICAgICAgMTogMC4yXG4gICAgICAyOiAwLjRcbiAgICAgIDM6IDAuOFxuICAgICAgNDogMS42XG4gICAgICA1OiAzLjJcbiAgICAgIDY6IDYuNFxuICAgICAgNzogMTIuOFxuICAgICAgODogMjUuNlxuICAgICAgOTogNTEuMlxuICAgICAgMTA6IDEwMi40XG4gICAgICAxMS4gMjA0LjhcbiAgICAgIDEyLiA0MDkuNlxuICAgICAgMTMuIDgxOS4yXG4gICAgICAxNC4gMTYzOC40ICgyNyBtaW51dGVzKVxuXG4gKiBAbWV0aG9kIGdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHNcbiAqIEBwYXJhbSAge251bWJlcn0gbWF4U2Vjb25kcyAtIFRoaXMgaXMgbm90IHRoZSBtYXhpbXVtIHNlY29uZHMgZGVsYXksIGJ1dCByYXRoZXJcbiAqIHRoZSBtYXhpbXVtIHNlY29uZHMgZGVsYXkgQkVGT1JFIGFkZGluZyBhIHJhbmRvbWl6ZWQgdmFsdWUuXG4gKiBAcGFyYW0gIHtudW1iZXJ9IGNvdW50ZXIgLSBDdXJyZW50IGNvdW50ZXIgdG8gdXNlIGZvciBjYWxjdWxhdGluZyB0aGUgZGVsYXk7IHNob3VsZCBiZSBpbmNyZW1lbnRlZCB1cCB0byBzb21lIHJlYXNvbmFibGUgbWF4aW11bSB2YWx1ZSBmb3IgZWFjaCB1c2UuXG4gKiBAcmV0dXJuIHtudW1iZXJ9ICAgICBEZWxheSBpbiBzZWNvbmRzL2ZyYWN0aW9ucyBvZiBhIHNlY29uZFxuICovXG5leHBvcnRzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMgPSBmdW5jdGlvbiBnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzKG1heFNlY29uZHMsIGNvdW50ZXIpIHtcbiAgbGV0IHNlY29uZHNXYWl0VGltZSA9IChNYXRoLnBvdygyLCBjb3VudGVyKSkgLyAxMCxcbiAgICBzZWNvbmRzT2Zmc2V0ID0gTWF0aC5yYW5kb20oKTsgLy8gdmFsdWUgYmV0d2VlbiAwLTEgc2Vjb25kcy5cbiAgaWYgKGNvdW50ZXIgPCAyKSBzZWNvbmRzT2Zmc2V0ID0gc2Vjb25kc09mZnNldCAvIDQ7IC8vIHZhbHVlcyBsZXNzIHRoYW4gMC4yIHNob3VsZCBiZSBvZmZzZXQgYnkgMC0wLjI1IHNlY29uZHNcbiAgZWxzZSBpZiAoY291bnRlciA8IDYpIHNlY29uZHNPZmZzZXQgPSBzZWNvbmRzT2Zmc2V0IC8gMjsgLy8gdmFsdWVzIGJldHdlZW4gMC4yIGFuZCAxLjAgc2hvdWxkIGJlIG9mZnNldCBieSAwLTAuNSBzZWNvbmRzXG5cbiAgaWYgKHNlY29uZHNXYWl0VGltZSA+PSBtYXhTZWNvbmRzKSBzZWNvbmRzV2FpdFRpbWUgPSBtYXhTZWNvbmRzO1xuXG4gIHJldHVybiBzZWNvbmRzV2FpdFRpbWUgKyBzZWNvbmRzT2Zmc2V0O1xufTtcblxuLyoqXG4gKiBJcyB0aGlzIGRhdGEgYSBibG9iP1xuICpcbiAqIEBtZXRob2QgaXNCbG9iXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICogQHJldHVybnMge0Jvb2xlYW59IC0gVHJ1ZSBpZiBpdHMgYSBibG9iLCBmYWxzZSBpZiBub3QuXG4gKi9cbmV4cG9ydHMuaXNCbG9iID0gdmFsdWUgPT4gdHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlIGluc3RhbmNlb2YgQmxvYjtcblxuLyoqXG4gKiBHaXZlbiBhIGJsb2IgcmV0dXJuIGEgYmFzZTY0IHN0cmluZy5cbiAqXG4gKiBAbWV0aG9kIGJsb2JUb0Jhc2U2NFxuICogQHBhcmFtIHtCbG9ifSBibG9iIC0gZGF0YSB0byBjb252ZXJ0IHRvIGJhc2U2NFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7U3RyaW5nfSBjYWxsYmFjay5yZXN1bHQgLSBZb3VyIGJhc2U2NCBzdHJpbmcgcmVzdWx0XG4gKi9cbmV4cG9ydHMuYmxvYlRvQmFzZTY0ID0gKGJsb2IsIGNhbGxiYWNrKSA9PiB7XG4gIGNvbnN0IHJlYWRlciA9IG5ldyBMb2NhbEZpbGVSZWFkZXIoKTtcbiAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiBjYWxsYmFjayhyZWFkZXIucmVzdWx0LnJlcGxhY2UoL14uKj8sLywgJycpKTtcbn07XG5cblxuLyoqXG4gKiBHaXZlbiBhIGJhc2U2NCBzdHJpbmcgcmV0dXJuIGEgYmxvYi5cbiAqXG4gKiBAbWV0aG9kIGJhc2U2NFRvQmxvYlxuICogQHBhcmFtIHtTdHJpbmd9IGI2NERhdGEgLSBiYXNlNjQgc3RyaW5nIGRhdGEgd2l0aG91dCBhbnkgdHlwZSBwcmVmaXhlc1xuICogQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnRUeXBlIC0gbWltZSB0eXBlIG9mIHRoZSBkYXRhXG4gKiBAcmV0dXJucyB7QmxvYn1cbiAqL1xuZXhwb3J0cy5iYXNlNjRUb0Jsb2IgPSAoYjY0RGF0YSwgY29udGVudFR5cGUpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzbGljZVNpemUgPSA1MTI7XG4gICAgY29uc3QgYnl0ZUNoYXJhY3RlcnMgPSBleHBvcnRzLmF0b2IoYjY0RGF0YSk7XG4gICAgY29uc3QgYnl0ZUFycmF5cyA9IFtdO1xuICAgIGxldCBvZmZzZXQ7XG5cbiAgICBmb3IgKG9mZnNldCA9IDA7IG9mZnNldCA8IGJ5dGVDaGFyYWN0ZXJzLmxlbmd0aDsgb2Zmc2V0ICs9IHNsaWNlU2l6ZSkge1xuICAgICAgbGV0IGk7XG4gICAgICBjb25zdCBzbGljZSA9IGJ5dGVDaGFyYWN0ZXJzLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgc2xpY2VTaXplKTtcbiAgICAgIGNvbnN0IGJ5dGVOdW1iZXJzID0gbmV3IEFycmF5KHNsaWNlLmxlbmd0aCk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgc2xpY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnl0ZU51bWJlcnNbaV0gPSBzbGljZS5jaGFyQ29kZUF0KGkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBieXRlQXJyYXkgPSBuZXcgVWludDhBcnJheShieXRlTnVtYmVycyk7XG5cbiAgICAgIGJ5dGVBcnJheXMucHVzaChieXRlQXJyYXkpO1xuICAgIH1cblxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihieXRlQXJyYXlzLCB7IHR5cGU6IGNvbnRlbnRUeXBlIH0pO1xuICAgIHJldHVybiBibG9iO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gbm9vcFxuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuLyoqXG4gKiBEb2VzIHdpbmRvdy5idGFvKCkgaW4gYSB1bmljb2RlLXNhZmUgd2F5XG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvd0Jhc2U2NC9idG9hI1VuaWNvZGVfc3RyaW5nc1xuICpcbiAqIEBtZXRob2QgdXRvYVxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnRzLnV0b2EgPSBzdHIgPT4gZXhwb3J0cy5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChzdHIpKSk7XG5cbi8qKlxuICogRG9lcyB3aW5kb3cuYXRvYigpIGluIGEgd2F5IHRoYXQgY2FuIGRlY29kZSBkYXRhIGZyb20gdXRvYSgpXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvd0Jhc2U2NC9idG9hI1VuaWNvZGVfc3RyaW5nc1xuICpcbiAqIEBtZXRob2QgYXRvdVxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnRzLmF0b3UgPSBzdHIgPT4gZGVjb2RlVVJJQ29tcG9uZW50KGVzY2FwZShleHBvcnRzLmF0b2Ioc3RyKSkpO1xuXG5cbi8qKlxuICogR2l2ZW4gYSBGaWxlL0Jsb2IgcmV0dXJuIGEgc3RyaW5nLlxuICpcbiAqIEFzc3VtZXMgYmxvYiByZXByZXNlbnRzIHRleHR1YWwgZGF0YS5cbiAqXG4gKiBAbWV0aG9kIGZldGNoVGV4dEZyb21GaWxlXG4gKiBAcGFyYW0ge0Jsb2J9IGZpbGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge1N0cmluZ30gY2FsbGJhY2sucmVzdWx0XG4gKi9cbmV4cG9ydHMuZmV0Y2hUZXh0RnJvbUZpbGUgPSAoZmlsZSwgY2FsbGJhY2spID0+IHtcbiAgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykgcmV0dXJuIGNhbGxiYWNrKGZpbGUpO1xuICBjb25zdCByZWFkZXIgPSBuZXcgTG9jYWxGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5hZGRFdmVudExpc3RlbmVyKCdsb2FkZW5kJywgKCkgPT4ge1xuICAgIGNhbGxiYWNrKHJlYWRlci5yZXN1bHQpO1xuICB9KTtcbiAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG59O1xuXG5cbi8qKlxuICogRXhlY3V0ZSB0aGlzIGZ1bmN0aW9uIGltbWVkaWF0ZWx5IGFmdGVyIGN1cnJlbnQgcHJvY2Vzc2luZyBpcyBjb21wbGV0ZSAoc2V0SW1tZWRpYXRlIHJlcGxhY2VtZW50KS5cbiAqXG4gKiBBIGRlcHRoIG9mIHVwIHRvIDEwIGlzIGFsbG93ZWQuICBUaGF0IG1lYW5zIHRoYXQgZnVuY3Rpb25zIHlvdSBzY2hlZHVsZSB1c2luZyBkZWZlclxuICogY2FuIGluIHR1cm4gc2NoZWR1bGUgZnVydGhlciBhY3Rpb25zLiAgVGhlIG9yaWdpbmFsIGFjdGlvbnMgYXJlIGRlcHRoID0gMDsgdGhlIGFjdGlvbnMgc2NoZWR1bGVkXG4gKiBieSB5b3VyIGFjdGlvbnMgYXJlIGRlcHRoID0gMS4gIFRoZXNlIG5ldyBhY3Rpb25zIG1heSBpbiB0dXJuIHNjaGVkdWxlIGZ1cnRoZXIgYWN0aW9ucywgd2hpY2ggaGFwcGVuIGF0IGRlcHRoID0gMy5cbiAqIEJ1dCB0byBhdm9pZCBpbmZpbml0ZSBsb29wcywgaWYgZGVwdGggcmVhY2hlcyAxMCwgaXQgY2xlYXJzIHRoZSBxdWV1ZSBhbmQgaWdub3JlcyB0aGVtLlxuICpcbiAqIEBtZXRob2QgZGVmZXJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZcbiAqL1xuZXhwb3J0cy5kZWZlciA9IHJlcXVpcmUoJy4vdXRpbHMvZGVmZXInKTtcblxuLyoqXG4gKiBSdW4gdGhlIExheWVyIFBhcnNlciBvbiB0aGUgcmVxdWVzdC5cbiAqXG4gKiBQYXJhbWV0ZXJzIGhlcmVcbiAqIGFyZSB0aGUgcGFyYW1ldGVycyBzcGVjaWVkIGluIFtMYXllci1QYXRjaF0oaHR0cHM6Ly9naXRodWIuY29tL2xheWVyaHEvbm9kZS1sYXllci1wYXRjaCksIHBsdXNcbiAqIGEgY2xpZW50IG9iamVjdC5cbiAqXG4gKiAgICAgIFV0aWwubGF5ZXJQYXJzZSh7XG4gKiAgICAgICAgICBvYmplY3Q6IGNvbnZlcnNhdGlvbixcbiAqICAgICAgICAgIHR5cGU6ICdDb252ZXJzYXRpb24nLFxuICogICAgICAgICAgb3BlcmF0aW9uczogbGF5ZXJQYXRjaE9wZXJhdGlvbnMsXG4gKiAgICAgICAgICBjbGllbnQ6IGNsaWVudFxuICogICAgICB9KTtcbiAqXG4gKiBAbWV0aG9kXG4gKiBAZGVwcmVjYXRlZCBVc2UgJ3V0aWxzL2xheWVyLXBhcnNlcicgaW5zdGVhZFxuICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgLSBsYXllci1wYXRjaCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdC5vYmplY3QgLSBPYmplY3QgYmVpbmcgdXBkYXRlZCAgYnkgdGhlIG9wZXJhdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0LnR5cGUgLSBUeXBlIG9mIG9iamVjdCBiZWluZyB1cGRhdGVkXG4gKiBAcGFyYW0ge09iamVjdFtdfSByZXF1ZXN0Lm9wZXJhdGlvbnMgLSBBcnJheSBvZiBjaGFuZ2Ugb3BlcmF0aW9ucyB0byBwZXJmb3JtIHVwb24gdGhlIG9iamVjdFxuICogQHBhcmFtIHtsYXllci5DbGllbnR9IHJlcXVlc3QuY2xpZW50XG4gKi9cbmV4cG9ydHMubGF5ZXJQYXJzZSA9IHJlcXVpcmUoJy4vdXRpbHMvbGF5ZXItcGFyc2VyJyk7XG5cblxuLyoqXG4gKiBPYmplY3QgY29tcGFyaXNvbi5cbiAqXG4gKiBEb2VzIGEgcmVjdXJzaXZlIHRyYXZlcnNhbCBvZiB0d28gb2JqZWN0cyB2ZXJpZnlpbmcgdGhhdCB0aGV5IGFyZSB0aGUgc2FtZS5cbiAqIElzIGFibGUgdG8gbWFrZSBtZXRhZGF0YS1yZXN0cmljdGVkIGFzc3VtcHRpb25zIHN1Y2ggYXMgdGhhdFxuICogYWxsIHZhbHVlcyBhcmUgZWl0aGVyIHBsYWluIE9iamVjdHMgb3Igc3RyaW5ncy5cbiAqXG4gKiAgICAgIGlmIChVdGlscy5kb2VzT2JqZWN0TWF0Y2goY29udjEubWV0YWRhdGEsIGNvbnYyLm1ldGFkYXRhKSkge1xuICogICAgICAgICAgYWxlcnQoJ1RoZXNlIHR3byBtZXRhZGF0YSBvYmplY3RzIGFyZSB0aGUgc2FtZScpO1xuICogICAgICB9XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7T2JqZWN0fSByZXF1ZXN0ZWREYXRhXG4gKiBAcGFyYW0gIHtPYmplY3R9IGFjdHVhbERhdGFcbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuZG9lc09iamVjdE1hdGNoID0gKHJlcXVlc3RlZERhdGEsIGFjdHVhbERhdGEpID0+IHtcbiAgaWYgKCghcmVxdWVzdGVkRGF0YSAmJiBhY3R1YWxEYXRhKSB8fCAocmVxdWVzdGVkRGF0YSAmJiAhYWN0dWFsRGF0YSkpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgcmVxdWVzdGVkS2V5cyA9IE9iamVjdC5rZXlzKHJlcXVlc3RlZERhdGEpLnNvcnQoKTtcbiAgY29uc3QgYWN0dWFsS2V5cyA9IE9iamVjdC5rZXlzKGFjdHVhbERhdGEpLnNvcnQoKTtcblxuICAvLyBJZiB0aGVyZSBhcmUgYSBkaWZmZXJlbnQgbnVtYmVyIG9mIGtleXMsIGZhaWwuXG4gIGlmIChyZXF1ZXN0ZWRLZXlzLmxlbmd0aCAhPT0gYWN0dWFsS2V5cy5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICAvLyBDb21wYXJlIGtleSBuYW1lIGFuZCB2YWx1ZSBhdCBlYWNoIGluZGV4XG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCByZXF1ZXN0ZWRLZXlzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIGNvbnN0IGsxID0gcmVxdWVzdGVkS2V5c1tpbmRleF07XG4gICAgY29uc3QgazIgPSBhY3R1YWxLZXlzW2luZGV4XTtcbiAgICBjb25zdCB2MSA9IHJlcXVlc3RlZERhdGFbazFdO1xuICAgIGNvbnN0IHYyID0gYWN0dWFsRGF0YVtrMl07XG4gICAgaWYgKGsxICE9PSBrMikgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh2MSAmJiB0eXBlb2YgdjEgPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBBcnJheSBjb21wYXJpc29uIGlzIG5vdCB1c2VkIGJ5IHRoZSBXZWIgU0RLIGF0IHRoaXMgdGltZS5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHYxKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FycmF5IGNvbXBhcmlzb24gbm90IGhhbmRsZWQgeWV0Jyk7XG4gICAgICB9IGVsc2UgaWYgKCFleHBvcnRzLmRvZXNPYmplY3RNYXRjaCh2MSwgdjIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHYxICE9PSB2Mikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2ltcGxlIGFycmF5IGluY2x1c2lvbiB0ZXN0XG4gKiBAbWV0aG9kIGluY2x1ZGVzXG4gKiBAcGFyYW0ge01peGVkW119IGl0ZW1zXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuaW5jbHVkZXMgPSAoaXRlbXMsIHZhbHVlKSA9PiBpdGVtcy5pbmRleE9mKHZhbHVlKSAhPT0gLTE7XG5cbi8qKlxuICogU29tZSBBU0NJSSBhcnQgd2hlbiBjbGllbnQgaW5pdGlhbGl6ZXNcbiAqL1xuZXhwb3J0cy5hc2NpaUluaXQgPSAodmVyc2lvbikgPT4ge1xuICBpZiAoIXZlcnNpb24pIHJldHVybiAnTWlzc2luZyB2ZXJzaW9uJztcblxuICBjb25zdCBzcGxpdCA9IHZlcnNpb24uc3BsaXQoJy0nKTtcbiAgbGV0IGxpbmUxID0gc3BsaXRbMF0gfHwgJycsXG4gICAgbGluZTIgPSBzcGxpdFsxXSB8fCAnJztcblxuICBsaW5lMSArPSBuZXcgQXJyYXkoMTMgLSBsaW5lMS5sZW5ndGgpLmpvaW4oJyAnKTtcbiAgbGluZTIgKz0gbmV3IEFycmF5KDE0IC0gbGluZTIubGVuZ3RoKS5qb2luKCcgJyk7XG5cbiAgcmV0dXJuIGBcbiAgICAvaE5NTU1NTU1NTU1NTU1NTU1NTU1NbXMuXG4gIGhNTXkrLy8vLy8vLy8vLy8vLy8vLy9vbU1OLVxuICBNTU4gICAgICAgICAgICAgICAgICAgIG9NTW9cbiAgTU1OICAgICAgICBMYXllciAgICAgICBvTU1vXG4gIE1NTiAgICAgICBXZWIgU0RLICAgICAgb01Nb1xuICBNTU0tICAgICAgICAgICAgICAgICAgIG9NTW9cbiAgTU1NeSAgICAgIHYke2xpbmUxfW9NTW9cbiAgTU1NTW8gICAgICR7bGluZTJ9b01Nb1xuICBNTU1NTXkuICAgICAgICAgICAgICAgIG9NTW9cbiAgTU1NTU1NTnk6JyAgICAgICAgICAgICBvTU1vXG4gIE5NTU1NTU1NTW15KzotLicgICAgICAneU1NL1xuICA6ZE1NTU1NTU1NTU1NTU5OTk5OTk5OTk1Oc1xuICAgLS8rKysrKysrKysrKysrKysrKysrOidgO1xufTtcbiJdfQ==
