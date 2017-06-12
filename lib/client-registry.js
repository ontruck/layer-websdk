'use strict';

var _clientUtils = require('./client-utils');

/**
 * Allows all components to have a clientId instead of a client pointer.
 * Allows an app to have multiple Clients, each with its own appId.
 * Provides a global utility that can be required by all modules for accessing
 * the client.
 *
 * @class  layer.ClientRegistry
 * @private
 */

var registry = {};
var listeners = [];

/**
 * Register a new Client; will destroy any previous client with the same appId.
 *
 * @method register
 * @param  {layer.Client} client
 */
function register(client) {
  var appId = client.appId;
  if (registry[appId] && !registry[appId].isDestroyed) {
    registry[appId].destroy();
  }
  registry[appId] = client;

  (0, _clientUtils.defer)(function () {
    return listeners.forEach(function (listener) {
      return listener(client);
    });
  });
}

/**
 * Removes a Client.
 *
 * @method unregister
 * @param  {layer.Client} client
 */
function unregister(client) {
  if (registry[client.appId]) delete registry[client.appId];
}

/**
 * Get a Client by appId
 *
 * @method get
 * @param  {string} appId
 * @return {layer.Client}
 */
function get(appId) {
  return registry[appId] || null;
}

function getAll() {
  return Object.keys(registry).map(function (key) {
    return registry[key];
  });
}

/**
 * Register a listener to be called whenever a new client is registered.
 *
 * @method addListener
 * @param {Function} listener
 * @param {layer.Client} listener.client
 */
function addListener(listener) {
  listeners.push(listener);
}

/**
 * Remove a registered listener or all listeners.
 *
 * If called with no arguments or null arguments, removes all listeners.
 * @method removeListener
 * @param {Function}
 */
function removeListener(listener) {
  if (listener) {
    var index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  } else {
    listeners.splice(0, listeners.length);
  }
}

module.exports = {
  get: get,
  getAll: getAll,
  register: register,
  unregister: unregister,
  addListener: addListener,
  removeListener: removeListener
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtcmVnaXN0cnkuanMiXSwibmFtZXMiOlsicmVnaXN0cnkiLCJsaXN0ZW5lcnMiLCJyZWdpc3RlciIsImNsaWVudCIsImFwcElkIiwiaXNEZXN0cm95ZWQiLCJkZXN0cm95IiwiZm9yRWFjaCIsImxpc3RlbmVyIiwidW5yZWdpc3RlciIsImdldCIsImdldEFsbCIsIk9iamVjdCIsImtleXMiLCJtYXAiLCJrZXkiLCJhZGRMaXN0ZW5lciIsInB1c2giLCJyZW1vdmVMaXN0ZW5lciIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsImxlbmd0aCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7O0FBWUE7O0FBWkE7Ozs7Ozs7Ozs7QUFVQSxJQUFNQSxXQUFXLEVBQWpCO0FBQ0EsSUFBTUMsWUFBWSxFQUFsQjs7QUFFQTs7Ozs7O0FBTUEsU0FBU0MsUUFBVCxDQUFrQkMsTUFBbEIsRUFBMEI7QUFDeEIsTUFBTUMsUUFBUUQsT0FBT0MsS0FBckI7QUFDQSxNQUFJSixTQUFTSSxLQUFULEtBQW1CLENBQUNKLFNBQVNJLEtBQVQsRUFBZ0JDLFdBQXhDLEVBQXFEO0FBQ25ETCxhQUFTSSxLQUFULEVBQWdCRSxPQUFoQjtBQUNEO0FBQ0ROLFdBQVNJLEtBQVQsSUFBa0JELE1BQWxCOztBQUVBLDBCQUFNO0FBQUEsV0FBTUYsVUFBVU0sT0FBVixDQUFrQjtBQUFBLGFBQVlDLFNBQVNMLE1BQVQsQ0FBWjtBQUFBLEtBQWxCLENBQU47QUFBQSxHQUFOO0FBQ0Q7O0FBRUQ7Ozs7OztBQU1BLFNBQVNNLFVBQVQsQ0FBb0JOLE1BQXBCLEVBQTRCO0FBQzFCLE1BQUlILFNBQVNHLE9BQU9DLEtBQWhCLENBQUosRUFBNEIsT0FBT0osU0FBU0csT0FBT0MsS0FBaEIsQ0FBUDtBQUM3Qjs7QUFFRDs7Ozs7OztBQU9BLFNBQVNNLEdBQVQsQ0FBYU4sS0FBYixFQUFvQjtBQUNsQixTQUFPSixTQUFTSSxLQUFULEtBQW1CLElBQTFCO0FBQ0Q7O0FBRUQsU0FBU08sTUFBVCxHQUFrQjtBQUNoQixTQUFPQyxPQUFPQyxJQUFQLENBQVliLFFBQVosRUFBc0JjLEdBQXRCLENBQTBCO0FBQUEsV0FBT2QsU0FBU2UsR0FBVCxDQUFQO0FBQUEsR0FBMUIsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7O0FBT0EsU0FBU0MsV0FBVCxDQUFxQlIsUUFBckIsRUFBK0I7QUFDN0JQLFlBQVVnQixJQUFWLENBQWVULFFBQWY7QUFDRDs7QUFFRDs7Ozs7OztBQU9BLFNBQVNVLGNBQVQsQ0FBd0JWLFFBQXhCLEVBQWtDO0FBQ2hDLE1BQUlBLFFBQUosRUFBYztBQUNaLFFBQU1XLFFBQVFsQixVQUFVbUIsT0FBVixDQUFrQlosUUFBbEIsQ0FBZDtBQUNBLFFBQUlXLFNBQVMsQ0FBYixFQUFnQmxCLFVBQVVvQixNQUFWLENBQWlCRixLQUFqQixFQUF3QixDQUF4QjtBQUNqQixHQUhELE1BR087QUFDTGxCLGNBQVVvQixNQUFWLENBQWlCLENBQWpCLEVBQW9CcEIsVUFBVXFCLE1BQTlCO0FBQ0Q7QUFDRjs7QUFHREMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmZCxVQURlO0FBRWZDLGdCQUZlO0FBR2ZULG9CQUhlO0FBSWZPLHdCQUplO0FBS2ZPLDBCQUxlO0FBTWZFO0FBTmUsQ0FBakIiLCJmaWxlIjoiY2xpZW50LXJlZ2lzdHJ5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbGxvd3MgYWxsIGNvbXBvbmVudHMgdG8gaGF2ZSBhIGNsaWVudElkIGluc3RlYWQgb2YgYSBjbGllbnQgcG9pbnRlci5cbiAqIEFsbG93cyBhbiBhcHAgdG8gaGF2ZSBtdWx0aXBsZSBDbGllbnRzLCBlYWNoIHdpdGggaXRzIG93biBhcHBJZC5cbiAqIFByb3ZpZGVzIGEgZ2xvYmFsIHV0aWxpdHkgdGhhdCBjYW4gYmUgcmVxdWlyZWQgYnkgYWxsIG1vZHVsZXMgZm9yIGFjY2Vzc2luZ1xuICogdGhlIGNsaWVudC5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNsaWVudFJlZ2lzdHJ5XG4gKiBAcHJpdmF0ZVxuICovXG5cbmNvbnN0IHJlZ2lzdHJ5ID0ge307XG5jb25zdCBsaXN0ZW5lcnMgPSBbXTtcbmltcG9ydCB7IGRlZmVyIH0gZnJvbSAnLi9jbGllbnQtdXRpbHMnO1xuLyoqXG4gKiBSZWdpc3RlciBhIG5ldyBDbGllbnQ7IHdpbGwgZGVzdHJveSBhbnkgcHJldmlvdXMgY2xpZW50IHdpdGggdGhlIHNhbWUgYXBwSWQuXG4gKlxuICogQG1ldGhvZCByZWdpc3RlclxuICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAqL1xuZnVuY3Rpb24gcmVnaXN0ZXIoY2xpZW50KSB7XG4gIGNvbnN0IGFwcElkID0gY2xpZW50LmFwcElkO1xuICBpZiAocmVnaXN0cnlbYXBwSWRdICYmICFyZWdpc3RyeVthcHBJZF0uaXNEZXN0cm95ZWQpIHtcbiAgICByZWdpc3RyeVthcHBJZF0uZGVzdHJveSgpO1xuICB9XG4gIHJlZ2lzdHJ5W2FwcElkXSA9IGNsaWVudDtcblxuICBkZWZlcigoKSA9PiBsaXN0ZW5lcnMuZm9yRWFjaChsaXN0ZW5lciA9PiBsaXN0ZW5lcihjbGllbnQpKSk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhIENsaWVudC5cbiAqXG4gKiBAbWV0aG9kIHVucmVnaXN0ZXJcbiAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gKi9cbmZ1bmN0aW9uIHVucmVnaXN0ZXIoY2xpZW50KSB7XG4gIGlmIChyZWdpc3RyeVtjbGllbnQuYXBwSWRdKSBkZWxldGUgcmVnaXN0cnlbY2xpZW50LmFwcElkXTtcbn1cblxuLyoqXG4gKiBHZXQgYSBDbGllbnQgYnkgYXBwSWRcbiAqXG4gKiBAbWV0aG9kIGdldFxuICogQHBhcmFtICB7c3RyaW5nfSBhcHBJZFxuICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICovXG5mdW5jdGlvbiBnZXQoYXBwSWQpIHtcbiAgcmV0dXJuIHJlZ2lzdHJ5W2FwcElkXSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRBbGwoKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhyZWdpc3RyeSkubWFwKGtleSA9PiByZWdpc3RyeVtrZXldKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIGxpc3RlbmVyIHRvIGJlIGNhbGxlZCB3aGVuZXZlciBhIG5ldyBjbGllbnQgaXMgcmVnaXN0ZXJlZC5cbiAqXG4gKiBAbWV0aG9kIGFkZExpc3RlbmVyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICogQHBhcmFtIHtsYXllci5DbGllbnR9IGxpc3RlbmVyLmNsaWVudFxuICovXG5mdW5jdGlvbiBhZGRMaXN0ZW5lcihsaXN0ZW5lcikge1xuICBsaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG59XG5cbi8qKlxuICogUmVtb3ZlIGEgcmVnaXN0ZXJlZCBsaXN0ZW5lciBvciBhbGwgbGlzdGVuZXJzLlxuICpcbiAqIElmIGNhbGxlZCB3aXRoIG5vIGFyZ3VtZW50cyBvciBudWxsIGFyZ3VtZW50cywgcmVtb3ZlcyBhbGwgbGlzdGVuZXJzLlxuICogQG1ldGhvZCByZW1vdmVMaXN0ZW5lclxuICogQHBhcmFtIHtGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIobGlzdGVuZXIpIHtcbiAgaWYgKGxpc3RlbmVyKSB7XG4gICAgY29uc3QgaW5kZXggPSBsaXN0ZW5lcnMuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgaWYgKGluZGV4ID49IDApIGxpc3RlbmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9IGVsc2Uge1xuICAgIGxpc3RlbmVycy5zcGxpY2UoMCwgbGlzdGVuZXJzLmxlbmd0aCk7XG4gIH1cbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0LFxuICBnZXRBbGwsXG4gIHJlZ2lzdGVyLFxuICB1bnJlZ2lzdGVyLFxuICBhZGRMaXN0ZW5lcixcbiAgcmVtb3ZlTGlzdGVuZXIsXG59O1xuIl19
