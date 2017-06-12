'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Utility methods
 *
 * @class layer.ClientUtils
 */

var LayerParser = require('layer-patch');
var uuid = require('uuid');
var atob = typeof window === 'undefined' ? require('atob') : window.atob;

/* istanbul ignore next */
var LocalFileReader = typeof window === 'undefined' ? require('filereader') : window.FileReader;

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
 * Execute this function immediately after current processing is complete.
 *
 * A depth of up to 10 is allowed.  That means that functions you schedule using defer
 * can in turn schedule further actions.  The original actions are depth = 0; the actions scheduled
 * by your actions are depth = 1.  These new actions may in turn schedule further actions, which happen at depth = 3.
 * But to avoid infinite loops, if depth reaches 10, it clears the queue and ignores them.
 *
 * @method defer
 * @param {Function} f
 */
var setImmediateId = 0,
    setImmediateDepth = 0,


// Have we scheduled the queue to be processed? If not, this is false
setImmediateIsPending = false,


// Queue of functions to call and depth integers
setImmediateQueue = [];

// If a setImmediate callback itself calls setImmediate which in turn calls setImmediate, at what point do we suspect we have an infinite loop?
// A depth of 10 is currently considered OK, but this may need to be increased.
var setImmediateMaxDepth = 10;

// Process all callbacks in the setImmediateQueue
function setImmediateProcessor() {
  // Processing the queue is no longer scheduled; clear any scheduling info.
  setImmediateIsPending = false;
  clearTimeout(setImmediateId);
  setImmediateId = 0;

  // Our initial depth is depth 0
  setImmediateDepth = 0;
  setImmediateQueue.push(setImmediateDepth);

  // Process all functions and depths in the queue starting always with the item at index 0,
  // and removing them from the queue before processing them.
  while (setImmediateQueue.length) {
    var item = setImmediateQueue.shift();
    if (typeof item === 'function') {
      try {
        item();
      } catch (err) {
        console.error(err);
      }
    } else if (item >= setImmediateMaxDepth) {
      setImmediateQueue = [];
      console.error('Layer Error: setImmediate Max Queue Depth Exceded');
    }
  }
}

// Schedule the function to be called by adding it to the queue, and setting up scheduling if its needed.
function defer(func) {
  if (typeof func !== 'function') throw new Error('Function expected in defer');
  setImmediateQueue.push(func);

  // If postMessage has not already been called, call it
  if (!setImmediateIsPending) {
    setImmediateIsPending = true;
    if (typeof document !== 'undefined') {
      window.postMessage({ type: 'layer-set-immediate' }, '*');
    } else {
      // React Native reportedly lacks a document, and throws errors on the second parameter
      window.postMessage({ type: 'layer-set-immediate' });
    }

    // Having seen scenarios where postMessage failed to trigger, set a backup using setTimeout that will be canceled
    // if postMessage is succesfully called.
    setImmediateId = setTimeout(setImmediateProcessor, 0);
  }
}

// For Unit Testing
defer.flush = function () {
  return setImmediateProcessor();
};

addEventListener('message', function (event) {
  if (event.data.type !== 'layer-set-immediate') return;
  setImmediateProcessor();
});

exports.defer = defer;

/**
 * URL Decode a URL Encoded base64 string
 *
 * Copied from https://github.com/auth0-blog/angular-token-auth, but
 * appears in many places on the web.
 */
/* istanbul ignore next */
exports.decode = function (str) {
  var output = str.replace('-', '+').replace('_', '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!');
  }
  return atob(output);
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
    var byteCharacters = atob(b64Data);
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
  return btoa(unescape(encodeURIComponent(str)));
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
  return decodeURIComponent(escape(atob(str)));
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

var parser = void 0;

/**
 * Creates a LayerParser
 *
 * @method
 * @private
 * @param {Object} request - see layer.ClientUtils.layerParse
 */
function createParser(request) {
  request.client.once('destroy', function () {
    return parser = null;
  });

  parser = new LayerParser({
    camelCase: true,
    getObjectCallback: function getObjectCallback(id) {
      return request.client.getObject(id);
    },
    createObjectCallback: function createObjectCallback(id, obj) {
      return request.client._createObject(obj);
    },
    propertyNameMap: {
      Conversation: {
        unreadMessageCount: 'unreadCount'
      }
    },
    changeCallbacks: {
      Message: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Conversation: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      }
    }
  });
}

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
 * @param {Object} request - layer-patch parameters
 * @param {Object} request.object - Object being updated  by the operations
 * @param {string} request.type - Type of object being updated
 * @param {Object[]} request.operations - Array of change operations to perform upon the object
 * @param {layer.Client} request.client
 */
exports.layerParse = function (request) {
  if (!parser) createParser(request);
  parser.parse(request);
};

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

  return '\n    /hNMMMMMMMMMMMMMMMMMMMms.\n  hMMy+/////////////////omMN-        \'oo.\n  MMN                    oMMo        .MM/\n  MMN                    oMMo        .MM/              ....                       ....            ...\n  MMN       Web SDK      oMMo        .MM/           ohdddddddo\' +md.      smy  -sddddddho.   hmosddmm.\n  MMM-                   oMMo        .MM/           ::.\'  \'.mM+ \'hMd\'    +Mm. +Nm/\'   .+Nm-  mMNs-\'.\n  MMMy      v' + line1 + 'oMMo        .MM/             .-:/+yNMs  .mMs   /MN: .MMs///////dMh  mMy\n  MMMMo     ' + line2 + 'oMMo        .MM/          .ymhyso+:hMs   :MM/ -NM/  :MMsooooooooo+  mM+\n  MMMMMy.                oMMo        .MM/          dMy\'    \'dMs    +MN:mM+   \'NMo            mM+\n  MMMMMMNy:\'             oMMo        .MMy++++++++: sMm/---/dNMs     yMMMs     -dMd+:-:/smy\'  mM+\n  NMMMMMMMMmy+:-.\'      \'yMM/        \'yyyyyyyyyyyo  :shhhys:+y/     .MMh       \'-oyhhhys:\'   sy:\n  :dMMMMMMMMMMMMNNNNNNNNNMNs                                        hMd\'\n   -/+++++++++++++++++++:\'                                      sNmdo\'';
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtdXRpbHMuanMiXSwibmFtZXMiOlsiTGF5ZXJQYXJzZXIiLCJyZXF1aXJlIiwidXVpZCIsImF0b2IiLCJ3aW5kb3ciLCJMb2NhbEZpbGVSZWFkZXIiLCJGaWxlUmVhZGVyIiwiZXhwb3J0cyIsImdlbmVyYXRlVVVJRCIsInY0IiwidHlwZUZyb21JRCIsImlkIiwibWF0Y2hlcyIsIm1hdGNoIiwicmVwbGFjZSIsImlzRW1wdHkiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsImFwcGx5Iiwib2JqIiwia2V5cyIsImxlbmd0aCIsInNvcnRCeSIsImluQXJyYXkiLCJmbiIsInJldmVyc2UiLCJzb3J0IiwidmFsdWVBIiwidmFsdWVCIiwiYWEiLCJiYiIsInVuZGVmaW5lZCIsImNsb25lIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5Iiwic2V0SW1tZWRpYXRlSWQiLCJzZXRJbW1lZGlhdGVEZXB0aCIsInNldEltbWVkaWF0ZUlzUGVuZGluZyIsInNldEltbWVkaWF0ZVF1ZXVlIiwic2V0SW1tZWRpYXRlTWF4RGVwdGgiLCJzZXRJbW1lZGlhdGVQcm9jZXNzb3IiLCJjbGVhclRpbWVvdXQiLCJwdXNoIiwiaXRlbSIsInNoaWZ0IiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwiZGVmZXIiLCJmdW5jIiwiRXJyb3IiLCJkb2N1bWVudCIsInBvc3RNZXNzYWdlIiwidHlwZSIsInNldFRpbWVvdXQiLCJmbHVzaCIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsImRhdGEiLCJkZWNvZGUiLCJzdHIiLCJvdXRwdXQiLCJnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIiwibWF4U2Vjb25kcyIsImNvdW50ZXIiLCJzZWNvbmRzV2FpdFRpbWUiLCJNYXRoIiwicG93Iiwic2Vjb25kc09mZnNldCIsInJhbmRvbSIsImlzQmxvYiIsIkJsb2IiLCJ2YWx1ZSIsImJsb2JUb0Jhc2U2NCIsImJsb2IiLCJjYWxsYmFjayIsInJlYWRlciIsInJlYWRBc0RhdGFVUkwiLCJvbmxvYWRlbmQiLCJyZXN1bHQiLCJiYXNlNjRUb0Jsb2IiLCJiNjREYXRhIiwiY29udGVudFR5cGUiLCJzbGljZVNpemUiLCJieXRlQ2hhcmFjdGVycyIsImJ5dGVBcnJheXMiLCJvZmZzZXQiLCJpIiwic2xpY2UiLCJieXRlTnVtYmVycyIsIkFycmF5IiwiY2hhckNvZGVBdCIsImJ5dGVBcnJheSIsIlVpbnQ4QXJyYXkiLCJlIiwidXRvYSIsImJ0b2EiLCJ1bmVzY2FwZSIsImVuY29kZVVSSUNvbXBvbmVudCIsImF0b3UiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJmZXRjaFRleHRGcm9tRmlsZSIsImZpbGUiLCJyZWFkQXNUZXh0IiwicGFyc2VyIiwiY3JlYXRlUGFyc2VyIiwicmVxdWVzdCIsImNsaWVudCIsIm9uY2UiLCJjYW1lbENhc2UiLCJnZXRPYmplY3RDYWxsYmFjayIsImdldE9iamVjdCIsImNyZWF0ZU9iamVjdENhbGxiYWNrIiwiX2NyZWF0ZU9iamVjdCIsInByb3BlcnR5TmFtZU1hcCIsIkNvbnZlcnNhdGlvbiIsInVucmVhZE1lc3NhZ2VDb3VudCIsImNoYW5nZUNhbGxiYWNrcyIsIk1lc3NhZ2UiLCJhbGwiLCJ1cGRhdGVPYmplY3QiLCJuZXdWYWx1ZSIsIm9sZFZhbHVlIiwicGF0aHMiLCJfaGFuZGxlUGF0Y2hFdmVudCIsImxheWVyUGFyc2UiLCJkb2VzT2JqZWN0TWF0Y2giLCJyZXF1ZXN0ZWREYXRhIiwiYWN0dWFsRGF0YSIsInJlcXVlc3RlZEtleXMiLCJhY3R1YWxLZXlzIiwiaW5kZXgiLCJrMSIsImsyIiwidjEiLCJ2MiIsImlzQXJyYXkiLCJpbmNsdWRlcyIsIml0ZW1zIiwiaW5kZXhPZiIsImFzY2lpSW5pdCIsInZlcnNpb24iLCJzcGxpdCIsImxpbmUxIiwibGluZTIiLCJqb2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7OztBQU1BLElBQU1BLGNBQWNDLFFBQVEsYUFBUixDQUFwQjtBQUNBLElBQU1DLE9BQU9ELFFB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QUtzRCxNQUFNNUgsTUFBckIsRUFBNkI4SCxJQUE3QixDQUFrQyxHQUFsQyxDQUFUO0FBQ0FELFdBQVMsSUFBSXZELEtBQUosQ0FBVSxLQUFLdUQsTUFBTTdILE1BQXJCLEVBQTZCOEgsSUFBN0IsQ0FBa0MsR0FBbEMsQ0FBVDs7QUFFQSwrY0FPYUYsS0FQYiw2RkFRWUMsS0FSWjtBQWNELENBeEJEIiwiZmlsZSI6ImNsaWVudC11dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVXRpbGl0eSBtZXRob2RzXG4gKlxuICogQGNsYXNzIGxheWVyLkNsaWVudFV0aWxzXG4gKi9cblxuY29uc3QgTGF5ZXJQYXJzZXIgPSByZXF1aXJlKCdsYXllci1wYXRjaCcpO1xuY29uc3QgdXVpZCA9IHJlcXVpcmUoJ3V1aWQnKTtcbmNvbnN0IGF0b2IgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHJlcXVpcmUoJ2F0b2InKSA6IHdpbmRvdy5hdG9iO1xuXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuY29uc3QgTG9jYWxGaWxlUmVhZGVyID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKCdmaWxlcmVhZGVyJykgOiB3aW5kb3cuRmlsZVJlYWRlcjtcblxuLyoqXG4gKiBHZW5lcmF0ZSBhIHJhbmRvbSBVVUlEXG4gKlxuICogQG1ldGhvZFxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5leHBvcnRzLmdlbmVyYXRlVVVJRCA9IHV1aWQudjQ7XG5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSAndHlwZScgcG9ydGlvbiBvZiBhIExheWVyIElELlxuICpcbiAqICAgICAgICAgc3dpdGNoKFV0aWxzLnR5cGVGcm9tSUQoaWQpKSB7XG4gKiAgICAgICAgICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAqICAgICAgICAgICAgICAgICAuLi5cbiAqICAgICAgICAgICAgIGNhc2UgJ21lc3NhZ2UnOlxuICogICAgICAgICAgICAgICAgIC4uLlxuICogICAgICAgICAgICAgY2FzZTogJ3F1ZXJpZXMnOlxuICogICAgICAgICAgICAgICAgIC4uLlxuICogICAgICAgICB9XG4gKlxuICogRG9lcyBub3QgY3VycmVudGx5IGhhbmRsZSBMYXllciBBcHAgSURzLlxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZXhwb3J0cy50eXBlRnJvbUlEID0gKGlkKSA9PiB7XG4gIGNvbnN0IG1hdGNoZXMgPSBpZC5tYXRjaCgvKFteL10qKShcXC9bXi9dKikkLyk7XG4gIHJldHVybiBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6ICcnO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBVVUlEIHBvcnRpb24gb2YgYSBMYXllciBJRFxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZXhwb3J0cy51dWlkID0gaWQgPT4gKGlkIHx8ICcnKS5yZXBsYWNlKC9eLipcXC8vLCAnJyk7XG5cbmV4cG9ydHMuaXNFbXB0eSA9IG9iaiA9PiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmFwcGx5KG9iaikgPT09ICdbb2JqZWN0IE9iamVjdF0nICYmIE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwO1xuXG4vKipcbiAqIFNpbXBsaWZpZWQgc29ydCBtZXRob2QuXG4gKlxuICogUHJvdmlkZXMgYSBmdW5jdGlvbiB0byByZXR1cm4gdGhlIHZhbHVlIHRvIGNvbXBhcmUgcmF0aGVyIHRoYW4gZG8gdGhlIGNvbXBhcmlzb24uXG4gKlxuICogICAgICBzb3J0QnkoW3t2OiAzfSwge3Y6IDF9LCB2OiAzM31dLCBmdW5jdGlvbih2YWx1ZSkge1xuICogICAgICAgICAgcmV0dXJuIHZhbHVlLnY7XG4gKiAgICAgIH0sIGZhbHNlKTtcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0gIHtNaXhlZFtdfSAgIGluQXJyYXkgICAgICBBcnJheSB0byBzb3J0XG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm4gICAgICAgICAgICBGdW5jdGlvbiB0aGF0IHdpbGwgcmV0dXJuIGEgdmFsdWUgdG8gY29tcGFyZVxuICogQHBhcmFtICB7RnVuY3Rpb259IGZuLnZhbHVlICAgICAgQ3VycmVudCB2YWx1ZSBmcm9tIGluQXJyYXkgd2UgYXJlIGNvbXBhcmluZywgYW5kIGZyb20gd2hpY2ggYSB2YWx1ZSBzaG91bGQgYmUgZXh0cmFjdGVkXG4gKiBAcGFyYW0gIHtib29sZWFufSAgW3JldmVyc2U9ZmFsc2VdIFNvcnQgYXNjZW5kaW5nIChmYWxzZSkgb3IgZGVzY2VuZGluZyAodHJ1ZSlcbiAqL1xuZXhwb3J0cy5zb3J0QnkgPSAoaW5BcnJheSwgZm4sIHJldmVyc2UpID0+IHtcbiAgcmV2ZXJzZSA9IHJldmVyc2UgPyAtMSA6IDE7XG4gIHJldHVybiBpbkFycmF5LnNvcnQoKHZhbHVlQSwgdmFsdWVCKSA9PiB7XG4gICAgY29uc3QgYWEgPSBmbih2YWx1ZUEpO1xuICAgIGNvbnN0IGJiID0gZm4odmFsdWVCKTtcbiAgICBpZiAoYWEgPT09IHVuZGVmaW5lZCAmJiBiYiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gMDtcbiAgICBpZiAoYWEgPT09IHVuZGVmaW5lZCAmJiBiYiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gMTtcbiAgICBpZiAoYWEgIT09IHVuZGVmaW5lZCAmJiBiYiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gLTE7XG4gICAgaWYgKGFhID4gYmIpIHJldHVybiAxICogcmV2ZXJzZTtcbiAgICBpZiAoYWEgPCBiYikgcmV0dXJuIC0xICogcmV2ZXJzZTtcbiAgICByZXR1cm4gMDtcbiAgfSk7XG59O1xuXG4vKipcbiAqIFF1aWNrIGFuZCBlYXN5IGNsb25lIG1ldGhvZC5cbiAqXG4gKiBEb2VzIG5vdCB3b3JrIG9uIGNpcmN1bGFyIHJlZmVyZW5jZXM7IHNob3VsZCBub3QgYmUgdXNlZFxuICogb24gb2JqZWN0cyB3aXRoIGV2ZW50IGxpc3RlbmVycy5cbiAqXG4gKiAgICAgIHZhciBuZXdPYmogPSBVdGlscy5jbG9uZShvbGRPYmopO1xuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge09iamVjdH0gICAgIE9iamVjdCB0byBjbG9uZVxuICogQHJldHVybiB7T2JqZWN0fSAgICAgTmV3IE9iamVjdFxuICovXG5leHBvcnRzLmNsb25lID0gb2JqID0+IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG5cbi8qKlxuICogRXhlY3V0ZSB0aGlzIGZ1bmN0aW9uIGltbWVkaWF0ZWx5IGFmdGVyIGN1cnJlbnQgcHJvY2Vzc2luZyBpcyBjb21wbGV0ZS5cbiAqXG4gKiBBIGRlcHRoIG9mIHVwIHRvIDEwIGlzIGFsbG93ZWQuICBUaGF0IG1lYW5zIHRoYXQgZnVuY3Rpb25zIHlvdSBzY2hlZHVsZSB1c2luZyBkZWZlclxuICogY2FuIGluIHR1cm4gc2NoZWR1bGUgZnVydGhlciBhY3Rpb25zLiAgVGhlIG9yaWdpbmFsIGFjdGlvbnMgYXJlIGRlcHRoID0gMDsgdGhlIGFjdGlvbnMgc2NoZWR1bGVkXG4gKiBieSB5b3VyIGFjdGlvbnMgYXJlIGRlcHRoID0gMS4gIFRoZXNlIG5ldyBhY3Rpb25zIG1heSBpbiB0dXJuIHNjaGVkdWxlIGZ1cnRoZXIgYWN0aW9ucywgd2hpY2ggaGFwcGVuIGF0IGRlcHRoID0gMy5cbiAqIEJ1dCB0byBhdm9pZCBpbmZpbml0ZSBsb29wcywgaWYgZGVwdGggcmVhY2hlcyAxMCwgaXQgY2xlYXJzIHRoZSBxdWV1ZSBhbmQgaWdub3JlcyB0aGVtLlxuICpcbiAqIEBtZXRob2QgZGVmZXJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZcbiAqL1xubGV0IHNldEltbWVkaWF0ZUlkID0gMCxcbiAgc2V0SW1tZWRpYXRlRGVwdGggPSAwLFxuXG4gIC8vIEhhdmUgd2Ugc2NoZWR1bGVkIHRoZSBxdWV1ZSB0byBiZSBwcm9jZXNzZWQ/IElmIG5vdCwgdGhpcyBpcyBmYWxzZVxuICBzZXRJbW1lZGlhdGVJc1BlbmRpbmcgPSBmYWxzZSxcblxuICAvLyBRdWV1ZSBvZiBmdW5jdGlvbnMgdG8gY2FsbCBhbmQgZGVwdGggaW50ZWdlcnNcbiAgc2V0SW1tZWRpYXRlUXVldWUgPSBbXTtcblxuLy8gSWYgYSBzZXRJbW1lZGlhdGUgY2FsbGJhY2sgaXRzZWxmIGNhbGxzIHNldEltbWVkaWF0ZSB3aGljaCBpbiB0dXJuIGNhbGxzIHNldEltbWVkaWF0ZSwgYXQgd2hhdCBwb2ludCBkbyB3ZSBzdXNwZWN0IHdlIGhhdmUgYW4gaW5maW5pdGUgbG9vcD9cbi8vIEEgZGVwdGggb2YgMTAgaXMgY3VycmVudGx5IGNvbnNpZGVyZWQgT0ssIGJ1dCB0aGlzIG1heSBuZWVkIHRvIGJlIGluY3JlYXNlZC5cbmNvbnN0IHNldEltbWVkaWF0ZU1heERlcHRoID0gMTA7XG5cbi8vIFByb2Nlc3MgYWxsIGNhbGxiYWNrcyBpbiB0aGUgc2V0SW1tZWRpYXRlUXVldWVcbmZ1bmN0aW9uIHNldEltbWVkaWF0ZVByb2Nlc3NvcigpIHtcbiAgLy8gUHJvY2Vzc2luZyB0aGUgcXVldWUgaXMgbm8gbG9uZ2VyIHNjaGVkdWxlZDsgY2xlYXIgYW55IHNjaGVkdWxpbmcgaW5mby5cbiAgc2V0SW1tZWRpYXRlSXNQZW5kaW5nID0gZmFsc2U7XG4gIGNsZWFyVGltZW91dChzZXRJbW1lZGlhdGVJZCk7XG4gIHNldEltbWVkaWF0ZUlkID0gMDtcblxuICAvLyBPdXIgaW5pdGlhbCBkZXB0aCBpcyBkZXB0aCAwXG4gIHNldEltbWVkaWF0ZURlcHRoID0gMDtcbiAgc2V0SW1tZWRpYXRlUXVldWUucHVzaChzZXRJbW1lZGlhdGVEZXB0aCk7XG5cbiAgLy8gUHJvY2VzcyBhbGwgZnVuY3Rpb25zIGFuZCBkZXB0aHMgaW4gdGhlIHF1ZXVlIHN0YXJ0aW5nIGFsd2F5cyB3aXRoIHRoZSBpdGVtIGF0IGluZGV4IDAsXG4gIC8vIGFuZCByZW1vdmluZyB0aGVtIGZyb20gdGhlIHF1ZXVlIGJlZm9yZSBwcm9jZXNzaW5nIHRoZW0uXG4gIHdoaWxlIChzZXRJbW1lZGlhdGVRdWV1ZS5sZW5ndGgpIHtcbiAgICBjb25zdCBpdGVtID0gc2V0SW1tZWRpYXRlUXVldWUuc2hpZnQoKTtcbiAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGl0ZW0oKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpdGVtID49IHNldEltbWVkaWF0ZU1heERlcHRoKSB7XG4gICAgICBzZXRJbW1lZGlhdGVRdWV1ZSA9IFtdO1xuICAgICAgY29uc29sZS5lcnJvcignTGF5ZXIgRXJyb3I6IHNldEltbWVkaWF0ZSBNYXggUXVldWUgRGVwdGggRXhjZWRlZCcpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBTY2hlZHVsZSB0aGUgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGJ5IGFkZGluZyBpdCB0byB0aGUgcXVldWUsIGFuZCBzZXR0aW5nIHVwIHNjaGVkdWxpbmcgaWYgaXRzIG5lZWRlZC5cbmZ1bmN0aW9uIGRlZmVyKGZ1bmMpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgRXJyb3IoJ0Z1bmN0aW9uIGV4cGVjdGVkIGluIGRlZmVyJyk7XG4gIHNldEltbWVkaWF0ZVF1ZXVlLnB1c2goZnVuYyk7XG5cbiAgLy8gSWYgcG9zdE1lc3NhZ2UgaGFzIG5vdCBhbHJlYWR5IGJlZW4gY2FsbGVkLCBjYWxsIGl0XG4gIGlmICghc2V0SW1tZWRpYXRlSXNQZW5kaW5nKSB7XG4gICAgc2V0SW1tZWRpYXRlSXNQZW5kaW5nID0gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ2xheWVyLXNldC1pbW1lZGlhdGUnIH0sICcqJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlYWN0IE5hdGl2ZSByZXBvcnRlZGx5IGxhY2tzIGEgZG9jdW1lbnQsIGFuZCB0aHJvd3MgZXJyb3JzIG9uIHRoZSBzZWNvbmQgcGFyYW1ldGVyXG4gICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAnbGF5ZXItc2V0LWltbWVkaWF0ZScgfSk7XG4gICAgfVxuXG4gICAgLy8gSGF2aW5nIHNlZW4gc2NlbmFyaW9zIHdoZXJlIHBvc3RNZXNzYWdlIGZhaWxlZCB0byB0cmlnZ2VyLCBzZXQgYSBiYWNrdXAgdXNpbmcgc2V0VGltZW91dCB0aGF0IHdpbGwgYmUgY2FuY2VsZWRcbiAgICAvLyBpZiBwb3N0TWVzc2FnZSBpcyBzdWNjZXNmdWxseSBjYWxsZWQuXG4gICAgc2V0SW1tZWRpYXRlSWQgPSBzZXRUaW1lb3V0KHNldEltbWVkaWF0ZVByb2Nlc3NvciwgMCk7XG4gIH1cbn1cblxuLy8gRm9yIFVuaXQgVGVzdGluZ1xuZGVmZXIuZmx1c2ggPSAoKSA9PiBzZXRJbW1lZGlhdGVQcm9jZXNzb3IoKTtcblxuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChldmVudCkgPT4ge1xuICBpZiAoZXZlbnQuZGF0YS50eXBlICE9PSAnbGF5ZXItc2V0LWltbWVkaWF0ZScpIHJldHVybjtcbiAgc2V0SW1tZWRpYXRlUHJvY2Vzc29yKCk7XG59KTtcblxuZXhwb3J0cy5kZWZlciA9IGRlZmVyO1xuXG4vKipcbiAqIFVSTCBEZWNvZGUgYSBVUkwgRW5jb2RlZCBiYXNlNjQgc3RyaW5nXG4gKlxuICogQ29waWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2F1dGgwLWJsb2cvYW5ndWxhci10b2tlbi1hdXRoLCBidXRcbiAqIGFwcGVhcnMgaW4gbWFueSBwbGFjZXMgb24gdGhlIHdlYi5cbiAqL1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmV4cG9ydHMuZGVjb2RlID0gKHN0cikgPT4ge1xuICBsZXQgb3V0cHV0ID0gc3RyLnJlcGxhY2UoJy0nLCAnKycpLnJlcGxhY2UoJ18nLCAnLycpO1xuICBzd2l0Y2ggKG91dHB1dC5sZW5ndGggJSA0KSB7XG4gICAgY2FzZSAwOlxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAyOlxuICAgICAgb3V0cHV0ICs9ICc9PSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDM6XG4gICAgICBvdXRwdXQgKz0gJz0nO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBiYXNlNjR1cmwgc3RyaW5nIScpO1xuICB9XG4gIHJldHVybiBhdG9iKG91dHB1dCk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBkZWxheSBpbiBzZWNvbmRzIG5lZWRlZCB0byBmb2xsb3cgYW4gZXhwb25lbnRpYWxcbiAqIGJhY2tvZmYgcGF0dGVybiBvZiBkZWxheXMgZm9yIHJldHJ5aW5nIGEgY29ubmVjdGlvbi5cbiAqXG4gKiBBbGdvcml0aG0gaGFzIHR3byBtb3RpdmF0aW9uczpcbiAqXG4gKiAxLiBSZXRyeSB3aXRoIGluY3JlYXNpbmdseSBsb25nIGludGVydmFscyB1cCB0byBzb21lIG1heGltdW0gaW50ZXJ2YWxcbiAqIDIuIFJhbmRvbWl6ZSB0aGUgcmV0cnkgaW50ZXJ2YWwgZW5vdWdoIHNvIHRoYXQgYSB0aG91c2FuZCBjbGllbnRzXG4gKiBhbGwgZm9sbG93aW5nIHRoZSBzYW1lIGFsZ29yaXRobSBhdCB0aGUgc2FtZSB0aW1lIHdpbGwgbm90IGhpdCB0aGVcbiAqIHNlcnZlciBhdCB0aGUgZXhhY3Qgc2FtZSB0aW1lcy5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIGFyZSByZXN1bHRzIGJlZm9yZSBqaXR0ZXIgZm9yIHNvbWUgdmFsdWVzIG9mIGNvdW50ZXI6XG5cbiAgICAgIDA6IDAuMVxuICAgICAgMTogMC4yXG4gICAgICAyOiAwLjRcbiAgICAgIDM6IDAuOFxuICAgICAgNDogMS42XG4gICAgICA1OiAzLjJcbiAgICAgIDY6IDYuNFxuICAgICAgNzogMTIuOFxuICAgICAgODogMjUuNlxuICAgICAgOTogNTEuMlxuICAgICAgMTA6IDEwMi40XG4gICAgICAxMS4gMjA0LjhcbiAgICAgIDEyLiA0MDkuNlxuICAgICAgMTMuIDgxOS4yXG4gICAgICAxNC4gMTYzOC40ICgyNyBtaW51dGVzKVxuXG4gKiBAbWV0aG9kIGdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHNcbiAqIEBwYXJhbSAge251bWJlcn0gbWF4U2Vjb25kcyAtIFRoaXMgaXMgbm90IHRoZSBtYXhpbXVtIHNlY29uZHMgZGVsYXksIGJ1dCByYXRoZXJcbiAqIHRoZSBtYXhpbXVtIHNlY29uZHMgZGVsYXkgQkVGT1JFIGFkZGluZyBhIHJhbmRvbWl6ZWQgdmFsdWUuXG4gKiBAcGFyYW0gIHtudW1iZXJ9IGNvdW50ZXIgLSBDdXJyZW50IGNvdW50ZXIgdG8gdXNlIGZvciBjYWxjdWxhdGluZyB0aGUgZGVsYXk7IHNob3VsZCBiZSBpbmNyZW1lbnRlZCB1cCB0byBzb21lIHJlYXNvbmFibGUgbWF4aW11bSB2YWx1ZSBmb3IgZWFjaCB1c2UuXG4gKiBAcmV0dXJuIHtudW1iZXJ9ICAgICBEZWxheSBpbiBzZWNvbmRzL2ZyYWN0aW9ucyBvZiBhIHNlY29uZFxuICovXG5leHBvcnRzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMgPSBmdW5jdGlvbiBnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzKG1heFNlY29uZHMsIGNvdW50ZXIpIHtcbiAgbGV0IHNlY29uZHNXYWl0VGltZSA9IChNYXRoLnBvdygyLCBjb3VudGVyKSkgLyAxMCxcbiAgICBzZWNvbmRzT2Zmc2V0ID0gTWF0aC5yYW5kb20oKTsgLy8gdmFsdWUgYmV0d2VlbiAwLTEgc2Vjb25kcy5cbiAgaWYgKGNvdW50ZXIgPCAyKSBzZWNvbmRzT2Zmc2V0ID0gc2Vjb25kc09mZnNldCAvIDQ7IC8vIHZhbHVlcyBsZXNzIHRoYW4gMC4yIHNob3VsZCBiZSBvZmZzZXQgYnkgMC0wLjI1IHNlY29uZHNcbiAgZWxzZSBpZiAoY291bnRlciA8IDYpIHNlY29uZHNPZmZzZXQgPSBzZWNvbmRzT2Zmc2V0IC8gMjsgLy8gdmFsdWVzIGJldHdlZW4gMC4yIGFuZCAxLjAgc2hvdWxkIGJlIG9mZnNldCBieSAwLTAuNSBzZWNvbmRzXG5cbiAgaWYgKHNlY29uZHNXYWl0VGltZSA+PSBtYXhTZWNvbmRzKSBzZWNvbmRzV2FpdFRpbWUgPSBtYXhTZWNvbmRzO1xuXG4gIHJldHVybiBzZWNvbmRzV2FpdFRpbWUgKyBzZWNvbmRzT2Zmc2V0O1xufTtcblxuLyoqXG4gKiBJcyB0aGlzIGRhdGEgYSBibG9iP1xuICpcbiAqIEBtZXRob2QgaXNCbG9iXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICogQHJldHVybnMge0Jvb2xlYW59IC0gVHJ1ZSBpZiBpdHMgYSBibG9iLCBmYWxzZSBpZiBub3QuXG4gKi9cbmV4cG9ydHMuaXNCbG9iID0gdmFsdWUgPT4gdHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlIGluc3RhbmNlb2YgQmxvYjtcblxuLyoqXG4gKiBHaXZlbiBhIGJsb2IgcmV0dXJuIGEgYmFzZTY0IHN0cmluZy5cbiAqXG4gKiBAbWV0aG9kIGJsb2JUb0Jhc2U2NFxuICogQHBhcmFtIHtCbG9ifSBibG9iIC0gZGF0YSB0byBjb252ZXJ0IHRvIGJhc2U2NFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7U3RyaW5nfSBjYWxsYmFjay5yZXN1bHQgLSBZb3VyIGJhc2U2NCBzdHJpbmcgcmVzdWx0XG4gKi9cbmV4cG9ydHMuYmxvYlRvQmFzZTY0ID0gKGJsb2IsIGNhbGxiYWNrKSA9PiB7XG4gIGNvbnN0IHJlYWRlciA9IG5ldyBMb2NhbEZpbGVSZWFkZXIoKTtcbiAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG4gIHJlYWRlci5vbmxvYWRlbmQgPSAoKSA9PiBjYWxsYmFjayhyZWFkZXIucmVzdWx0LnJlcGxhY2UoL14uKj8sLywgJycpKTtcbn07XG5cblxuLyoqXG4gKiBHaXZlbiBhIGJhc2U2NCBzdHJpbmcgcmV0dXJuIGEgYmxvYi5cbiAqXG4gKiBAbWV0aG9kIGJhc2U2NFRvQmxvYlxuICogQHBhcmFtIHtTdHJpbmd9IGI2NERhdGEgLSBiYXNlNjQgc3RyaW5nIGRhdGEgd2l0aG91dCBhbnkgdHlwZSBwcmVmaXhlc1xuICogQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnRUeXBlIC0gbWltZSB0eXBlIG9mIHRoZSBkYXRhXG4gKiBAcmV0dXJucyB7QmxvYn1cbiAqL1xuZXhwb3J0cy5iYXNlNjRUb0Jsb2IgPSAoYjY0RGF0YSwgY29udGVudFR5cGUpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzbGljZVNpemUgPSA1MTI7XG4gICAgY29uc3QgYnl0ZUNoYXJhY3RlcnMgPSBhdG9iKGI2NERhdGEpO1xuICAgIGNvbnN0IGJ5dGVBcnJheXMgPSBbXTtcbiAgICBsZXQgb2Zmc2V0O1xuXG4gICAgZm9yIChvZmZzZXQgPSAwOyBvZmZzZXQgPCBieXRlQ2hhcmFjdGVycy5sZW5ndGg7IG9mZnNldCArPSBzbGljZVNpemUpIHtcbiAgICAgIGxldCBpO1xuICAgICAgY29uc3Qgc2xpY2UgPSBieXRlQ2hhcmFjdGVycy5zbGljZShvZmZzZXQsIG9mZnNldCArIHNsaWNlU2l6ZSk7XG4gICAgICBjb25zdCBieXRlTnVtYmVycyA9IG5ldyBBcnJheShzbGljZS5sZW5ndGgpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHNsaWNlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGJ5dGVOdW1iZXJzW2ldID0gc2xpY2UuY2hhckNvZGVBdChpKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYnl0ZUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZU51bWJlcnMpO1xuXG4gICAgICBieXRlQXJyYXlzLnB1c2goYnl0ZUFycmF5KTtcbiAgICB9XG5cbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoYnl0ZUFycmF5cywgeyB0eXBlOiBjb250ZW50VHlwZSB9KTtcbiAgICByZXR1cm4gYmxvYjtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIG5vb3BcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbi8qKlxuICogRG9lcyB3aW5kb3cuYnRhbygpIGluIGEgdW5pY29kZS1zYWZlIHdheVxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XaW5kb3dCYXNlNjQvYnRvYSNVbmljb2RlX3N0cmluZ3NcbiAqXG4gKiBAbWV0aG9kIHV0b2FcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuZXhwb3J0cy51dG9hID0gc3RyID0+IGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHN0cikpKTtcblxuLyoqXG4gKiBEb2VzIHdpbmRvdy5hdG9iKCkgaW4gYSB3YXkgdGhhdCBjYW4gZGVjb2RlIGRhdGEgZnJvbSB1dG9hKClcbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93QmFzZTY0L2J0b2EjVW5pY29kZV9zdHJpbmdzXG4gKlxuICogQG1ldGhvZCBhdG91XG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmV4cG9ydHMuYXRvdSA9IHN0ciA9PiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKGF0b2Ioc3RyKSkpO1xuXG5cbi8qKlxuICogR2l2ZW4gYSBGaWxlL0Jsb2IgcmV0dXJuIGEgc3RyaW5nLlxuICpcbiAqIEFzc3VtZXMgYmxvYiByZXByZXNlbnRzIHRleHR1YWwgZGF0YS5cbiAqXG4gKiBAbWV0aG9kIGZldGNoVGV4dEZyb21GaWxlXG4gKiBAcGFyYW0ge0Jsb2J9IGZpbGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge1N0cmluZ30gY2FsbGJhY2sucmVzdWx0XG4gKi9cbmV4cG9ydHMuZmV0Y2hUZXh0RnJvbUZpbGUgPSAoZmlsZSwgY2FsbGJhY2spID0+IHtcbiAgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykgcmV0dXJuIGNhbGxiYWNrKGZpbGUpO1xuICBjb25zdCByZWFkZXIgPSBuZXcgTG9jYWxGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5hZGRFdmVudExpc3RlbmVyKCdsb2FkZW5kJywgKCkgPT4ge1xuICAgIGNhbGxiYWNrKHJlYWRlci5yZXN1bHQpO1xuICB9KTtcbiAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG59O1xuXG5cbmxldCBwYXJzZXI7XG5cbi8qKlxuICogQ3JlYXRlcyBhIExheWVyUGFyc2VyXG4gKlxuICogQG1ldGhvZFxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0IC0gc2VlIGxheWVyLkNsaWVudFV0aWxzLmxheWVyUGFyc2VcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFyc2VyKHJlcXVlc3QpIHtcbiAgcmVxdWVzdC5jbGllbnQub25jZSgnZGVzdHJveScsICgpID0+IChwYXJzZXIgPSBudWxsKSk7XG5cbiAgcGFyc2VyID0gbmV3IExheWVyUGFyc2VyKHtcbiAgICBjYW1lbENhc2U6IHRydWUsXG4gICAgZ2V0T2JqZWN0Q2FsbGJhY2s6IGlkID0+IHJlcXVlc3QuY2xpZW50LmdldE9iamVjdChpZCksXG4gICAgY3JlYXRlT2JqZWN0Q2FsbGJhY2s6IChpZCwgb2JqKSA9PiByZXF1ZXN0LmNsaWVudC5fY3JlYXRlT2JqZWN0KG9iaiksXG4gICAgcHJvcGVydHlOYW1lTWFwOiB7XG4gICAgICBDb252ZXJzYXRpb246IHtcbiAgICAgICAgdW5yZWFkTWVzc2FnZUNvdW50OiAndW5yZWFkQ291bnQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGNoYW5nZUNhbGxiYWNrczoge1xuICAgICAgTWVzc2FnZToge1xuICAgICAgICBhbGw6ICh1cGRhdGVPYmplY3QsIG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpID0+IHtcbiAgICAgICAgICB1cGRhdGVPYmplY3QuX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgQ29udmVyc2F0aW9uOiB7XG4gICAgICAgIGFsbDogKHVwZGF0ZU9iamVjdCwgbmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykgPT4ge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdC5faGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59XG5cbi8qKlxuICogUnVuIHRoZSBMYXllciBQYXJzZXIgb24gdGhlIHJlcXVlc3QuXG4gKlxuICogUGFyYW1ldGVycyBoZXJlXG4gKiBhcmUgdGhlIHBhcmFtZXRlcnMgc3BlY2llZCBpbiBbTGF5ZXItUGF0Y2hdKGh0dHBzOi8vZ2l0aHViLmNvbS9sYXllcmhxL25vZGUtbGF5ZXItcGF0Y2gpLCBwbHVzXG4gKiBhIGNsaWVudCBvYmplY3QuXG4gKlxuICogICAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICogICAgICAgICAgb2JqZWN0OiBjb252ZXJzYXRpb24sXG4gKiAgICAgICAgICB0eXBlOiAnQ29udmVyc2F0aW9uJyxcbiAqICAgICAgICAgIG9wZXJhdGlvbnM6IGxheWVyUGF0Y2hPcGVyYXRpb25zLFxuICogICAgICAgICAgY2xpZW50OiBjbGllbnRcbiAqICAgICAgfSk7XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgLSBsYXllci1wYXRjaCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdC5vYmplY3QgLSBPYmplY3QgYmVpbmcgdXBkYXRlZCAgYnkgdGhlIG9wZXJhdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0LnR5cGUgLSBUeXBlIG9mIG9iamVjdCBiZWluZyB1cGRhdGVkXG4gKiBAcGFyYW0ge09iamVjdFtdfSByZXF1ZXN0Lm9wZXJhdGlvbnMgLSBBcnJheSBvZiBjaGFuZ2Ugb3BlcmF0aW9ucyB0byBwZXJmb3JtIHVwb24gdGhlIG9iamVjdFxuICogQHBhcmFtIHtsYXllci5DbGllbnR9IHJlcXVlc3QuY2xpZW50XG4gKi9cbmV4cG9ydHMubGF5ZXJQYXJzZSA9IChyZXF1ZXN0KSA9PiB7XG4gIGlmICghcGFyc2VyKSBjcmVhdGVQYXJzZXIocmVxdWVzdCk7XG4gIHBhcnNlci5wYXJzZShyZXF1ZXN0KTtcbn07XG5cbi8qKlxuICogT2JqZWN0IGNvbXBhcmlzb24uXG4gKlxuICogRG9lcyBhIHJlY3Vyc2l2ZSB0cmF2ZXJzYWwgb2YgdHdvIG9iamVjdHMgdmVyaWZ5aW5nIHRoYXQgdGhleSBhcmUgdGhlIHNhbWUuXG4gKiBJcyBhYmxlIHRvIG1ha2UgbWV0YWRhdGEtcmVzdHJpY3RlZCBhc3N1bXB0aW9ucyBzdWNoIGFzIHRoYXRcbiAqIGFsbCB2YWx1ZXMgYXJlIGVpdGhlciBwbGFpbiBPYmplY3RzIG9yIHN0cmluZ3MuXG4gKlxuICogICAgICBpZiAoVXRpbHMuZG9lc09iamVjdE1hdGNoKGNvbnYxLm1ldGFkYXRhLCBjb252Mi5tZXRhZGF0YSkpIHtcbiAqICAgICAgICAgIGFsZXJ0KCdUaGVzZSB0d28gbWV0YWRhdGEgb2JqZWN0cyBhcmUgdGhlIHNhbWUnKTtcbiAqICAgICAgfVxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge09iamVjdH0gcmVxdWVzdGVkRGF0YVxuICogQHBhcmFtICB7T2JqZWN0fSBhY3R1YWxEYXRhXG4gKiBAcmV0dXJuIHtib29sZWFufVxuICovXG5leHBvcnRzLmRvZXNPYmplY3RNYXRjaCA9IChyZXF1ZXN0ZWREYXRhLCBhY3R1YWxEYXRhKSA9PiB7XG4gIGlmICgoIXJlcXVlc3RlZERhdGEgJiYgYWN0dWFsRGF0YSkgfHwgKHJlcXVlc3RlZERhdGEgJiYgIWFjdHVhbERhdGEpKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHJlcXVlc3RlZEtleXMgPSBPYmplY3Qua2V5cyhyZXF1ZXN0ZWREYXRhKS5zb3J0KCk7XG4gIGNvbnN0IGFjdHVhbEtleXMgPSBPYmplY3Qua2V5cyhhY3R1YWxEYXRhKS5zb3J0KCk7XG5cbiAgLy8gSWYgdGhlcmUgYXJlIGEgZGlmZmVyZW50IG51bWJlciBvZiBrZXlzLCBmYWlsLlxuICBpZiAocmVxdWVzdGVkS2V5cy5sZW5ndGggIT09IGFjdHVhbEtleXMubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gQ29tcGFyZSBrZXkgbmFtZSBhbmQgdmFsdWUgYXQgZWFjaCBpbmRleFxuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcmVxdWVzdGVkS2V5cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICBjb25zdCBrMSA9IHJlcXVlc3RlZEtleXNbaW5kZXhdO1xuICAgIGNvbnN0IGsyID0gYWN0dWFsS2V5c1tpbmRleF07XG4gICAgY29uc3QgdjEgPSByZXF1ZXN0ZWREYXRhW2sxXTtcbiAgICBjb25zdCB2MiA9IGFjdHVhbERhdGFbazJdO1xuICAgIGlmIChrMSAhPT0gazIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodjEgJiYgdHlwZW9mIHYxID09PSAnb2JqZWN0Jykge1xuICAgICAgLy8gQXJyYXkgY29tcGFyaXNvbiBpcyBub3QgdXNlZCBieSB0aGUgV2ViIFNESyBhdCB0aGlzIHRpbWUuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh2MSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBcnJheSBjb21wYXJpc29uIG5vdCBoYW5kbGVkIHlldCcpO1xuICAgICAgfSBlbHNlIGlmICghZXhwb3J0cy5kb2VzT2JqZWN0TWF0Y2godjEsIHYyKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh2MSAhPT0gdjIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqIFNpbXBsZSBhcnJheSBpbmNsdXNpb24gdGVzdFxuICogQG1ldGhvZCBpbmNsdWRlc1xuICogQHBhcmFtIHtNaXhlZFtdfSBpdGVtc1xuICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5leHBvcnRzLmluY2x1ZGVzID0gKGl0ZW1zLCB2YWx1ZSkgPT4gaXRlbXMuaW5kZXhPZih2YWx1ZSkgIT09IC0xO1xuXG4vKipcbiAqIFNvbWUgQVNDSUkgYXJ0IHdoZW4gY2xpZW50IGluaXRpYWxpemVzXG4gKi9cbmV4cG9ydHMuYXNjaWlJbml0ID0gKHZlcnNpb24pID0+IHtcbiAgaWYgKCF2ZXJzaW9uKSByZXR1cm4gJ01pc3NpbmcgdmVyc2lvbic7XG5cbiAgY29uc3Qgc3BsaXQgPSB2ZXJzaW9uLnNwbGl0KCctJyk7XG4gIGxldCBsaW5lMSA9IHNwbGl0WzBdIHx8ICcnLFxuICAgIGxpbmUyID0gc3BsaXRbMV0gfHwgJyc7XG5cbiAgbGluZTEgKz0gbmV3IEFycmF5KDEzIC0gbGluZTEubGVuZ3RoKS5qb2luKCcgJyk7XG4gIGxpbmUyICs9IG5ldyBBcnJheSgxNCAtIGxpbmUyLmxlbmd0aCkuam9pbignICcpO1xuXG4gIHJldHVybiBgXG4gICAgL2hOTU1NTU1NTU1NTU1NTU1NTU1NTW1zLlxuICBoTU15Ky8vLy8vLy8vLy8vLy8vLy8vb21NTi0gICAgICAgICdvby5cbiAgTU1OICAgICAgICAgICAgICAgICAgICBvTU1vICAgICAgICAuTU0vXG4gIE1NTiAgICAgICAgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NLyAgICAgICAgICAgICAgLi4uLiAgICAgICAgICAgICAgICAgICAgICAgLi4uLiAgICAgICAgICAgIC4uLlxuICBNTU4gICAgICAgV2ViIFNESyAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgIG9oZGRkZGRkZG8nICttZC4gICAgICBzbXkgIC1zZGRkZGRkaG8uICAgaG1vc2RkbW0uXG4gIE1NTS0gICAgICAgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NLyAgICAgICAgICAgOjouJyAgJy5tTSsgJ2hNZCcgICAgK01tLiArTm0vJyAgIC4rTm0tICBtTU5zLScuXG4gIE1NTXkgICAgICB2JHtsaW5lMX1vTU1vICAgICAgICAuTU0vICAgICAgICAgICAgIC4tOi8reU5NcyAgLm1NcyAgIC9NTjogLk1Ncy8vLy8vLy9kTWggIG1NeVxuICBNTU1NbyAgICAgJHtsaW5lMn1vTU1vICAgICAgICAuTU0vICAgICAgICAgIC55bWh5c28rOmhNcyAgIDpNTS8gLU5NLyAgOk1Nc29vb29vb29vbysgIG1NK1xuICBNTU1NTXkuICAgICAgICAgICAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgZE15JyAgICAnZE1zICAgICtNTjptTSsgICAnTk1vICAgICAgICAgICAgbU0rXG4gIE1NTU1NTU55OicgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NeSsrKysrKysrOiBzTW0vLS0tL2ROTXMgICAgIHlNTU1zICAgICAtZE1kKzotOi9zbXknICBtTStcbiAgTk1NTU1NTU1NbXkrOi0uJyAgICAgICd5TU0vICAgICAgICAneXl5eXl5eXl5eXlvICA6c2hoaHlzOit5LyAgICAgLk1NaCAgICAgICAnLW95aGhoeXM6JyAgIHN5OlxuICA6ZE1NTU1NTU1NTU1NTU5OTk5OTk5OTk1OcyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoTWQnXG4gICAtLysrKysrKysrKysrKysrKysrKys6JyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc05tZG8nYDtcbn07XG4iXX0=
