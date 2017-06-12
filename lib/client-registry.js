"use strict";

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

module.exports = {
  get: get,
  getAll: getAll,
  register: register,
  unregister: unregister
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtcmVnaXN0cnkuanMiXSwibmFtZXMiOlsicmVnaXN0cnkiLCJyZWdpc3RlciIsImNsaWVudCIsImFwcElkIiwiaXNEZXN0cm95ZWQiLCJkZXN0cm95IiwidW5yZWdpc3RlciIsImdldCIsImdldEFsbCIsIk9iamVjdCIsImtleXMiLCJtYXAiLCJrZXkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7O0FBVUEsSUFBTUEsV0FBVyxFQUFqQjs7QUFFQTs7Ozs7O0FBTUEsU0FBU0MsUUFBVCxDQUFrQkMsTUFBbEIsRUFBMEI7QUFDeEIsTUFBTUMsUUFBUUQsT0FBT0MsS0FBckI7QUFDQSxNQUFJSCxTQUFTRyxLQUFULEtBQW1CLENBQUNILFNBQVNHLEtBQVQsRUFBZ0JDLFdBQXhDLEVBQXFEO0FBQ25ESixhQUFTRyxLQUFULEVBQWdCRSxPQUFoQjtBQUNEO0FBQ0RMLFdBQVNHLEtBQVQsSUFBa0JELE1BQWxCO0FBQ0Q7O0FBRUQ7Ozs7OztBQU1BLFNBQVNJLFVBQVQsQ0FBb0JKLE1BQXBCLEVBQTRCO0FBQzFCLE1BQUlGLFNBQVNFLE9BQU9DLEtBQWhCLENBQUosRUFBNEIsT0FBT0gsU0FBU0UsT0FBT0MsS0FBaEIsQ0FBUDtBQUM3Qjs7QUFFRDs7Ozs7OztBQU9BLFNBQVNJLEdBQVQsQ0FBYUosS0FBYixFQUFvQjtBQUNsQixTQUFPSCxTQUFTRyxLQUFULEtBQW1CLElBQTFCO0FBQ0Q7O0FBRUQsU0FBU0ssTUFBVCxHQUFrQjtBQUNoQixTQUFPQyxPQUFPQyxJQUFQLENBQVlWLFFBQVosRUFBc0JXLEdBQXRCLENBQTBCO0FBQUEsV0FBT1gsU0FBU1ksR0FBVCxDQUFQO0FBQUEsR0FBMUIsQ0FBUDtBQUNEOztBQUVEQyxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZQLFVBRGU7QUFFZkMsZ0JBRmU7QUFHZlAsb0JBSGU7QUFJZks7QUFKZSxDQUFqQiIsImZpbGUiOiJjbGllbnQtcmVnaXN0cnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFsbG93cyBhbGwgY29tcG9uZW50cyB0byBoYXZlIGEgY2xpZW50SWQgaW5zdGVhZCBvZiBhIGNsaWVudCBwb2ludGVyLlxuICogQWxsb3dzIGFuIGFwcCB0byBoYXZlIG11bHRpcGxlIENsaWVudHMsIGVhY2ggd2l0aCBpdHMgb3duIGFwcElkLlxuICogUHJvdmlkZXMgYSBnbG9iYWwgdXRpbGl0eSB0aGF0IGNhbiBiZSByZXF1aXJlZCBieSBhbGwgbW9kdWxlcyBmb3IgYWNjZXNzaW5nXG4gKiB0aGUgY2xpZW50LlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ2xpZW50UmVnaXN0cnlcbiAqIEBwcml2YXRlXG4gKi9cblxuY29uc3QgcmVnaXN0cnkgPSB7fTtcblxuLyoqXG4gKiBSZWdpc3RlciBhIG5ldyBDbGllbnQ7IHdpbGwgZGVzdHJveSBhbnkgcHJldmlvdXMgY2xpZW50IHdpdGggdGhlIHNhbWUgYXBwSWQuXG4gKlxuICogQG1ldGhvZCByZWdpc3RlclxuICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAqL1xuZnVuY3Rpb24gcmVnaXN0ZXIoY2xpZW50KSB7XG4gIGNvbnN0IGFwcElkID0gY2xpZW50LmFwcElkO1xuICBpZiAocmVnaXN0cnlbYXBwSWRdICYmICFyZWdpc3RyeVthcHBJZF0uaXNEZXN0cm95ZWQpIHtcbiAgICByZWdpc3RyeVthcHBJZF0uZGVzdHJveSgpO1xuICB9XG4gIHJlZ2lzdHJ5W2FwcElkXSA9IGNsaWVudDtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGEgQ2xpZW50LlxuICpcbiAqIEBtZXRob2QgdW5yZWdpc3RlclxuICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAqL1xuZnVuY3Rpb24gdW5yZWdpc3RlcihjbGllbnQpIHtcbiAgaWYgKHJlZ2lzdHJ5W2NsaWVudC5hcHBJZF0pIGRlbGV0ZSByZWdpc3RyeVtjbGllbnQuYXBwSWRdO1xufVxuXG4vKipcbiAqIEdldCBhIENsaWVudCBieSBhcHBJZFxuICpcbiAqIEBtZXRob2QgZ2V0XG4gKiBAcGFyYW0gIHtzdHJpbmd9IGFwcElkXG4gKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gKi9cbmZ1bmN0aW9uIGdldChhcHBJZCkge1xuICByZXR1cm4gcmVnaXN0cnlbYXBwSWRdIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldEFsbCgpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHJlZ2lzdHJ5KS5tYXAoa2V5ID0+IHJlZ2lzdHJ5W2tleV0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0LFxuICBnZXRBbGwsXG4gIHJlZ2lzdGVyLFxuICB1bnJlZ2lzdGVyLFxufTtcbiJdfQ==
