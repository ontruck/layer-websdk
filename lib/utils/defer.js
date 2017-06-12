'use strict';

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
var setImmediate = global.getNativeSupport && global.getNativeSupport('setImmediate');
if (setImmediate) {
  module.exports = setImmediate;
} else {

  // Process all callbacks in the setImmediateQueue
  var setImmediateProcessor = function setImmediateProcessor() {
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
  };
  // Schedule the function to be called by adding it to the queue, and setting up scheduling if its needed.


  var setImmediateId = 0,
      setImmediateDepth = 0,


  // Have we scheduled the queue to be processed? If not, this is false
  setImmediateIsPending = false,


  // Queue of functions to call and depth integers
  setImmediateQueue = [];

  // If a setImmediate callback itself calls setImmediate which in turn calls setImmediate, at what point do we suspect we have an infinite loop?
  // A depth of 10 is currently considered OK, but this may need to be increased.
  var setImmediateMaxDepth = 10;module.exports = function defer(func) {
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
  };

  // For Unit Testing
  module.exports.flush = function () {
    return setImmediateProcessor();
  };
  module.exports.reset = function () {
    setImmediateQueue = [];
  };

  addEventListener('message', function (event) {
    if (event.data.type !== 'layer-set-immediate') return;
    setImmediateProcessor();
  });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9kZWZlci5qcyJdLCJuYW1lcyI6WyJzZXRJbW1lZGlhdGUiLCJnbG9iYWwiLCJnZXROYXRpdmVTdXBwb3J0IiwibW9kdWxlIiwiZXhwb3J0cyIsInNldEltbWVkaWF0ZVByb2Nlc3NvciIsInNldEltbWVkaWF0ZUlzUGVuZGluZyIsImNsZWFyVGltZW91dCIsInNldEltbWVkaWF0ZUlkIiwic2V0SW1tZWRpYXRlRGVwdGgiLCJzZXRJbW1lZGlhdGVRdWV1ZSIsInB1c2giLCJsZW5ndGgiLCJpdGVtIiwic2hpZnQiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJzZXRJbW1lZGlhdGVNYXhEZXB0aCIsImRlZmVyIiwiZnVuYyIsIkVycm9yIiwiZG9jdW1lbnQiLCJ3aW5kb3ciLCJwb3N0TWVzc2FnZSIsInR5cGUiLCJzZXRUaW1lb3V0IiwiZmx1c2giLCJyZXNldCIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsImRhdGEiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7O0FBV0EsSUFBTUEsZUFBZUMsT0FBT0MsZ0JBQVAsSUFBMkJELE9BQU9DLGdCQUFQLENBQXdCLGNBQXhCLENBQWhEO0FBQ0EsSUFBSUYsWUFBSixFQUFrQjtBQUNoQkcsU0FBT0MsT0FBUCxHQUFpQkosWUFBakI7QUFDRCxDQUZELE1BRU87O0FBY0w7QUFkSyxNQWVJSyxxQkFmSixHQWVMLFNBQVNBLHFCQUFULEdBQWlDO0FBQy9CO0FBQ0FDLDRCQUF3QixLQUF4QjtBQUNBQyxpQkFBYUMsY0FBYjtBQUNBQSxxQkFBaUIsQ0FBakI7O0FBRUE7QUFDQUMsd0JBQW9CLENBQXBCO0FBQ0FDLHNCQUFrQkMsSUFBbEIsQ0FBdUJGLGlCQUF2Qjs7QUFFQTtBQUNBO0FBQ0EsV0FBT0Msa0JBQWtCRSxNQUF6QixFQUFpQztBQUMvQixVQUFNQyxPQUFPSCxrQkFBa0JJLEtBQWxCLEVBQWI7QUFDQSxVQUFJLE9BQU9ELElBQVAsS0FBZ0IsVUFBcEIsRUFBZ0M7QUFDOUIsWUFBSTtBQUNGQTtBQUNELFNBRkQsQ0FFRSxPQUFPRSxHQUFQLEVBQVk7QUFDWkMsa0JBQVFDLEtBQVIsQ0FBY0YsR0FBZDtBQUNEO0FBQ0YsT0FORCxNQU1PLElBQUlGLFFBQVFLLG9CQUFaLEVBQWtDO0FBQ3ZDUiw0QkFBb0IsRUFBcEI7QUFDQU0sZ0JBQVFDLEtBQVIsQ0FBYyxtREFBZDtBQUNEO0FBQ0Y7QUFDRixHQXhDSTtBQXlDTDs7O0FBeENBLE1BQUlULGlCQUFpQixDQUFyQjtBQUFBLE1BQ0VDLG9CQUFvQixDQUR0Qjs7O0FBR0U7QUFDQUgsMEJBQXdCLEtBSjFCOzs7QUFNRTtBQUNBSSxzQkFBb0IsRUFQdEI7O0FBU0E7QUFDQTtBQUNBLE1BQU1RLHVCQUF1QixFQUE3QixDQThCQWYsT0FBT0MsT0FBUCxHQUFpQixTQUFTZSxLQUFULENBQWVDLElBQWYsRUFBcUI7QUFDcEMsUUFBSSxPQUFPQSxJQUFQLEtBQWdCLFVBQXBCLEVBQWdDLE1BQU0sSUFBSUMsS0FBSixDQUFVLDRCQUFWLENBQU47O0FBRWhDWCxzQkFBa0JDLElBQWxCLENBQXVCUyxJQUF2Qjs7QUFFQTtBQUNBLFFBQUksQ0FBQ2QscUJBQUwsRUFBNEI7QUFDMUJBLDhCQUF3QixJQUF4QjtBQUNBLFVBQUksT0FBT2dCLFFBQVAsS0FBb0IsV0FBeEIsRUFBcUM7QUFDbkNDLGVBQU9DLFdBQVAsQ0FBbUIsRUFBRUMsTUFBTSxxQkFBUixFQUFuQixFQUFvRCxHQUFwRDtBQUNELE9BRkQsTUFFTztBQUNMO0FBQ0FGLGVBQU9DLFdBQVAsQ0FBbUIsRUFBRUMsTUFBTSxxQkFBUixFQUFuQjtBQUNEOztBQUVEO0FBQ0E7QUFDQWpCLHVCQUFpQmtCLFdBQVdyQixxQkFBWCxFQUFrQyxDQUFsQyxDQUFqQjtBQUNEO0FBQ0YsR0FuQkQ7O0FBcUJBO0FBQ0FGLFNBQU9DLE9BQVAsQ0FBZXVCLEtBQWYsR0FBdUI7QUFBQSxXQUFNdEIsdUJBQU47QUFBQSxHQUF2QjtBQUNBRixTQUFPQyxPQUFQLENBQWV3QixLQUFmLEdBQXVCLFlBQU07QUFBRWxCLHdCQUFvQixFQUFwQjtBQUF5QixHQUF4RDs7QUFFQW1CLG1CQUFpQixTQUFqQixFQUE0QixVQUFDQyxLQUFELEVBQVc7QUFDckMsUUFBSUEsTUFBTUMsSUFBTixDQUFXTixJQUFYLEtBQW9CLHFCQUF4QixFQUErQztBQUMvQ3BCO0FBQ0QsR0FIRDtBQUlEIiwiZmlsZSI6ImRlZmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFeGVjdXRlIHRoaXMgZnVuY3Rpb24gaW1tZWRpYXRlbHkgYWZ0ZXIgY3VycmVudCBwcm9jZXNzaW5nIGlzIGNvbXBsZXRlIChzZXRJbW1lZGlhdGUgcmVwbGFjZW1lbnQpLlxuICpcbiAqIEEgZGVwdGggb2YgdXAgdG8gMTAgaXMgYWxsb3dlZC4gIFRoYXQgbWVhbnMgdGhhdCBmdW5jdGlvbnMgeW91IHNjaGVkdWxlIHVzaW5nIGRlZmVyXG4gKiBjYW4gaW4gdHVybiBzY2hlZHVsZSBmdXJ0aGVyIGFjdGlvbnMuICBUaGUgb3JpZ2luYWwgYWN0aW9ucyBhcmUgZGVwdGggPSAwOyB0aGUgYWN0aW9ucyBzY2hlZHVsZWRcbiAqIGJ5IHlvdXIgYWN0aW9ucyBhcmUgZGVwdGggPSAxLiAgVGhlc2UgbmV3IGFjdGlvbnMgbWF5IGluIHR1cm4gc2NoZWR1bGUgZnVydGhlciBhY3Rpb25zLCB3aGljaCBoYXBwZW4gYXQgZGVwdGggPSAzLlxuICogQnV0IHRvIGF2b2lkIGluZmluaXRlIGxvb3BzLCBpZiBkZXB0aCByZWFjaGVzIDEwLCBpdCBjbGVhcnMgdGhlIHF1ZXVlIGFuZCBpZ25vcmVzIHRoZW0uXG4gKlxuICogQG1ldGhvZCBkZWZlclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZlxuICovXG5jb25zdCBzZXRJbW1lZGlhdGUgPSBnbG9iYWwuZ2V0TmF0aXZlU3VwcG9ydCAmJiBnbG9iYWwuZ2V0TmF0aXZlU3VwcG9ydCgnc2V0SW1tZWRpYXRlJyk7XG5pZiAoc2V0SW1tZWRpYXRlKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gc2V0SW1tZWRpYXRlO1xufSBlbHNlIHtcbiAgbGV0IHNldEltbWVkaWF0ZUlkID0gMCxcbiAgICBzZXRJbW1lZGlhdGVEZXB0aCA9IDAsXG5cbiAgICAvLyBIYXZlIHdlIHNjaGVkdWxlZCB0aGUgcXVldWUgdG8gYmUgcHJvY2Vzc2VkPyBJZiBub3QsIHRoaXMgaXMgZmFsc2VcbiAgICBzZXRJbW1lZGlhdGVJc1BlbmRpbmcgPSBmYWxzZSxcblxuICAgIC8vIFF1ZXVlIG9mIGZ1bmN0aW9ucyB0byBjYWxsIGFuZCBkZXB0aCBpbnRlZ2Vyc1xuICAgIHNldEltbWVkaWF0ZVF1ZXVlID0gW107XG5cbiAgLy8gSWYgYSBzZXRJbW1lZGlhdGUgY2FsbGJhY2sgaXRzZWxmIGNhbGxzIHNldEltbWVkaWF0ZSB3aGljaCBpbiB0dXJuIGNhbGxzIHNldEltbWVkaWF0ZSwgYXQgd2hhdCBwb2ludCBkbyB3ZSBzdXNwZWN0IHdlIGhhdmUgYW4gaW5maW5pdGUgbG9vcD9cbiAgLy8gQSBkZXB0aCBvZiAxMCBpcyBjdXJyZW50bHkgY29uc2lkZXJlZCBPSywgYnV0IHRoaXMgbWF5IG5lZWQgdG8gYmUgaW5jcmVhc2VkLlxuICBjb25zdCBzZXRJbW1lZGlhdGVNYXhEZXB0aCA9IDEwO1xuXG4gIC8vIFByb2Nlc3MgYWxsIGNhbGxiYWNrcyBpbiB0aGUgc2V0SW1tZWRpYXRlUXVldWVcbiAgZnVuY3Rpb24gc2V0SW1tZWRpYXRlUHJvY2Vzc29yKCkge1xuICAgIC8vIFByb2Nlc3NpbmcgdGhlIHF1ZXVlIGlzIG5vIGxvbmdlciBzY2hlZHVsZWQ7IGNsZWFyIGFueSBzY2hlZHVsaW5nIGluZm8uXG4gICAgc2V0SW1tZWRpYXRlSXNQZW5kaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHNldEltbWVkaWF0ZUlkKTtcbiAgICBzZXRJbW1lZGlhdGVJZCA9IDA7XG5cbiAgICAvLyBPdXIgaW5pdGlhbCBkZXB0aCBpcyBkZXB0aCAwXG4gICAgc2V0SW1tZWRpYXRlRGVwdGggPSAwO1xuICAgIHNldEltbWVkaWF0ZVF1ZXVlLnB1c2goc2V0SW1tZWRpYXRlRGVwdGgpO1xuXG4gICAgLy8gUHJvY2VzcyBhbGwgZnVuY3Rpb25zIGFuZCBkZXB0aHMgaW4gdGhlIHF1ZXVlIHN0YXJ0aW5nIGFsd2F5cyB3aXRoIHRoZSBpdGVtIGF0IGluZGV4IDAsXG4gICAgLy8gYW5kIHJlbW92aW5nIHRoZW0gZnJvbSB0aGUgcXVldWUgYmVmb3JlIHByb2Nlc3NpbmcgdGhlbS5cbiAgICB3aGlsZSAoc2V0SW1tZWRpYXRlUXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCBpdGVtID0gc2V0SW1tZWRpYXRlUXVldWUuc2hpZnQoKTtcbiAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGl0ZW0oKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0gPj0gc2V0SW1tZWRpYXRlTWF4RGVwdGgpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlUXVldWUgPSBbXTtcbiAgICAgICAgY29uc29sZS5lcnJvcignTGF5ZXIgRXJyb3I6IHNldEltbWVkaWF0ZSBNYXggUXVldWUgRGVwdGggRXhjZWRlZCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBTY2hlZHVsZSB0aGUgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGJ5IGFkZGluZyBpdCB0byB0aGUgcXVldWUsIGFuZCBzZXR0aW5nIHVwIHNjaGVkdWxpbmcgaWYgaXRzIG5lZWRlZC5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWZlcihmdW5jKSB7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgRXJyb3IoJ0Z1bmN0aW9uIGV4cGVjdGVkIGluIGRlZmVyJyk7XG5cbiAgICBzZXRJbW1lZGlhdGVRdWV1ZS5wdXNoKGZ1bmMpO1xuXG4gICAgLy8gSWYgcG9zdE1lc3NhZ2UgaGFzIG5vdCBhbHJlYWR5IGJlZW4gY2FsbGVkLCBjYWxsIGl0XG4gICAgaWYgKCFzZXRJbW1lZGlhdGVJc1BlbmRpbmcpIHtcbiAgICAgIHNldEltbWVkaWF0ZUlzUGVuZGluZyA9IHRydWU7XG4gICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAnbGF5ZXItc2V0LWltbWVkaWF0ZScgfSwgJyonKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJlYWN0IE5hdGl2ZSByZXBvcnRlZGx5IGxhY2tzIGEgZG9jdW1lbnQsIGFuZCB0aHJvd3MgZXJyb3JzIG9uIHRoZSBzZWNvbmQgcGFyYW1ldGVyXG4gICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSh7IHR5cGU6ICdsYXllci1zZXQtaW1tZWRpYXRlJyB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gSGF2aW5nIHNlZW4gc2NlbmFyaW9zIHdoZXJlIHBvc3RNZXNzYWdlIGZhaWxlZCB0byB0cmlnZ2VyLCBzZXQgYSBiYWNrdXAgdXNpbmcgc2V0VGltZW91dCB0aGF0IHdpbGwgYmUgY2FuY2VsZWRcbiAgICAgIC8vIGlmIHBvc3RNZXNzYWdlIGlzIHN1Y2Nlc2Z1bGx5IGNhbGxlZC5cbiAgICAgIHNldEltbWVkaWF0ZUlkID0gc2V0VGltZW91dChzZXRJbW1lZGlhdGVQcm9jZXNzb3IsIDApO1xuICAgIH1cbiAgfTtcblxuICAvLyBGb3IgVW5pdCBUZXN0aW5nXG4gIG1vZHVsZS5leHBvcnRzLmZsdXNoID0gKCkgPT4gc2V0SW1tZWRpYXRlUHJvY2Vzc29yKCk7XG4gIG1vZHVsZS5leHBvcnRzLnJlc2V0ID0gKCkgPT4geyBzZXRJbW1lZGlhdGVRdWV1ZSA9IFtdOyB9O1xuXG4gIGFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICBpZiAoZXZlbnQuZGF0YS50eXBlICE9PSAnbGF5ZXItc2V0LWltbWVkaWF0ZScpIHJldHVybjtcbiAgICBzZXRJbW1lZGlhdGVQcm9jZXNzb3IoKTtcbiAgfSk7XG59XG4iXX0=
