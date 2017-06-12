'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * A Sync Event represents a request to the server.
 * A Sync Event may fire immediately, or may wait in the layer.SyncManager's
 * queue for a long duration before firing.
 *
 * DO NOT confuse this with layer.LayerEvent which represents a change notification
 * to your application.  layer.SyncEvent represents a request to the server that
 * is either in progress or in queue.
 *
 * GET requests are typically NOT done via a SyncEvent as these are typically
 * needed to render a UI and should either fail or succeed promptly.
 *
 * Applications typically do not interact with these objects.
 *
 * @class  layer.SyncEvent
 * @extends layer.Root
 */
var Utils = require('./client-utils');

var SyncEvent = function () {
  /**
   * Create a layer.SyncEvent.  See layer.ClientAuthenticator for examples of usage.
   *
   * @method  constructor
   * @private
   * @return {layer.SyncEvent}
   */
  function SyncEvent(options) {
    _classCallCheck(this, SyncEvent);

    var key = void 0;
    for (key in options) {
      if (key in this) {
        this[key] = options[key];
      }
    }
    if (!this.depends) this.depends = [];
    if (!this.id) this.id = 'layer:///syncevents/' + Utils.generateUUID();
    if (!this.createdAt) this.createdAt = Date.now();
  }

  /**
   * Not strictly required, but nice to clean things up.
   *
   * @method destroy
   */


  _createClass(SyncEvent, [{
    key: 'destroy',
    value: function destroy() {
      this.target = null;
      this.depends = null;
      this.callback = null;
      this.data = null;
    }

    /**
     * Get the Real parameters for the request.
     *
     * @method _updateData
     * @private
     */

  }, {
    key: '_updateData',
    value: function _updateData(client) {
      if (!this.target) return;
      var target = client.getObject(this.target);
      if (target && this.operation === 'POST' && target._getSendData) {
        this.data = target._getSendData(this.data);
      }
    }

    /**
     * Returns a POJO version of this object suitable for serializing for the network
     * @method toObject
     * @returns {Object}
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      return { data: this.data };
    }
  }]);

  return SyncEvent;
}();

/**
 * The type of operation being performed.
 *
 * Either GET, PATCH, DELETE, POST or PUT
 *
 * @property {String}
 */


SyncEvent.prototype.operation = '';

SyncEvent.prototype.fromDB = false;

SyncEvent.prototype.createdAt = 0;

/**
 * Indicates whether this request currently in-flight.
 *
 * * Set to true by _xhr() method,
 * * set to false on completion by layer.SyncManager.
 * * set to false automatically after 2 minutes
 *
 * @property {Boolean}
 */
Object.defineProperty(SyncEvent.prototype, 'isFiring', {
  enumerable: true,
  set: function set(value) {
    this.__isFiring = value;
    if (value) this.__firedAt = Date.now();
  },
  get: function get() {
    return Boolean(this.__isFiring && Date.now() - this.__firedAt < SyncEvent.FIRING_EXPIRATION);
  }
});

/**
 * Indicates whether this request currently being validated to insure it wasn't read
 * from IndexedDB and fired by another tab.
 *
 * @property {Boolean}
 */
Object.defineProperty(SyncEvent.prototype, '_isValidating', {
  enumerable: true,
  set: function set(value) {
    this.__isValidating = value;
    if (value) this.__validatedAt = Date.now();
  },
  get: function get() {
    return Boolean(this.__isValidating && Date.now() - this.__validatedAt < SyncEvent.VALIDATION_EXPIRATION);
  }
});

SyncEvent.prototype.id = '';

/**
 * Indicates whether the request completed successfully.
 *
 * Set by layer.SyncManager.
 * @type {Boolean}
 */
SyncEvent.prototype.success = null;

/**
 * Callback to fire on completing this sync event.
 *
 * WARNING: The nature of this callback may change;
 * a persistence layer that persists the SyncManager's queue
 * must have serializable callbacks (object id + method name; not a function)
 * or must accept that callbacks are not always fired.
 * @type {Function}
 */
SyncEvent.prototype.callback = null;

/**
 * Number of retries on this request.
 *
 * Retries are only counted if its a 502 or 503
 * error.  Set and managed by layer.SyncManager.
 * @type {Number}
 */
SyncEvent.prototype.retryCount = 0;

/**
 * The target of the request.
 *
 * Any Component; typically a Conversation or Message.
 * @type {layer.Root}
 */
SyncEvent.prototype.target = null;

/**
 * Components that this request depends upon.
 *
 * A message cannot be sent if its
 * Conversation fails to get created.
 *
 * NOTE: May prove redundant with the target property and needs further review.
 * @type {layer.Root[]}
 */
SyncEvent.prototype.depends = null;

/**
 * Data field of the xhr call; can be an Object or string (including JSON string)
 * @type {Object}
 */
SyncEvent.prototype.data = null;

/**
 * After firing a request, if that firing state fails to clear after this number of miliseconds,
 * consider it to no longer be firing.  Under normal conditions, firing will be set to false explicitly.
 * This check insures that any failure of that process does not leave us stuck with a firing request
 * blocking the queue.
 * @type {number}
 * @static
 */
SyncEvent.FIRING_EXPIRATION = 1000 * 15;

/**
 * After checking the database to see if this event has been claimed by another browser tab,
 * how long to wait before flagging it as failed, in the event of no-response.  Measured in ms.
 * @type {number}
 * @static
 */
SyncEvent.VALIDATION_EXPIRATION = 500;

/**
 * A layer.SyncEvent intended to be fired as an XHR request.
 *
 * @class layer.SyncEvent.XHRSyncEvent
 * @extends layer.SyncEvent
 */

var XHRSyncEvent = function (_SyncEvent) {
  _inherits(XHRSyncEvent, _SyncEvent);

  function XHRSyncEvent() {
    _classCallCheck(this, XHRSyncEvent);

    return _possibleConstructorReturn(this, (XHRSyncEvent.__proto__ || Object.getPrototypeOf(XHRSyncEvent)).apply(this, arguments));
  }

  _createClass(XHRSyncEvent, [{
    key: '_getRequestData',


    /**
     * Fire the request associated with this instance.
     *
     * Actually it just returns the parameters needed to make the xhr call:
     *
     *      var xhr = require('./xhr');
     *      xhr(event._getRequestData(client));
     *
     * @method _getRequestData
     * @param {layer.Client} client
     * @protected
     * @returns {Object}
     */
    value: function _getRequestData(client) {
      this._updateUrl(client);
      this._updateData(client);
      return {
        url: this.url,
        method: this.method,
        headers: this.headers,
        data: this.data,
        telemetry: this.telemetry
      };
    }

    /**
     * Get the Real URL.
     *
     * If the url property is a function, call it to set the actual url.
     * Used when the URL is unknown until a prior SyncEvent has completed.
     *
     * @method _updateUrl
     * @private
     */

  }, {
    key: '_updateUrl',
    value: function _updateUrl(client) {
      if (!this.target) return;
      var target = client.getObject(this.target);
      if (target && !this.url.match(/^http(s):\/\//)) {
        this.url = target._getUrl(this.url);
      }
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      return {
        data: this.data,
        url: this.url,
        method: this.method
      };
    }
  }, {
    key: '_getCreateId',
    value: function _getCreateId() {
      return this.operation === 'POST' && this.data ? this.data.id : '';
    }
  }]);

  return XHRSyncEvent;
}(SyncEvent);

/**
 * How long before the request times out?
 * @type {Number} [timeout=15000]
 */


XHRSyncEvent.prototype.timeout = 15000;

/**
 * URL to send the request to
 */
XHRSyncEvent.prototype.url = '';

/**
 * Counts number of online state changes.
 *
 * If this number becomes high in a short time period, its probably
 * failing due to a CORS error.
 */
XHRSyncEvent.prototype.returnToOnlineCount = 0;

/**
 * Headers for the request
 */
XHRSyncEvent.prototype.headers = null;

/**
 * Request method.
 */
XHRSyncEvent.prototype.method = 'GET';

/**
 * Telemetry data to go with the request.
 */
XHRSyncEvent.prototype.telemetry = null;

/**
 * A layer.SyncEvent intended to be fired as a websocket request.
 *
 * @class layer.SyncEvent.WebsocketSyncEvent
 * @extends layer.SyncEvent
 */

var WebsocketSyncEvent = function (_SyncEvent2) {
  _inherits(WebsocketSyncEvent, _SyncEvent2);

  function WebsocketSyncEvent() {
    _classCallCheck(this, WebsocketSyncEvent);

    return _possibleConstructorReturn(this, (WebsocketSyncEvent.__proto__ || Object.getPrototypeOf(WebsocketSyncEvent)).apply(this, arguments));
  }

  _createClass(WebsocketSyncEvent, [{
    key: '_getRequestData',


    /**
     * Get the websocket request object.
     *
     * @method _getRequestData
     * @private
     * @param {layer.Client} client
     * @return {Object}
     */
    value: function _getRequestData(client) {
      this._updateData(client);
      return this.data;
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      return this.data;
    }
  }, {
    key: '_getCreateId',
    value: function _getCreateId() {
      return this.operation === 'POST' && this.data.data ? this.data.data.id : '';
    }
  }]);

  return WebsocketSyncEvent;
}(SyncEvent);

/**
 * Does this websocket request return a changes array to be processed by the request-manager?
 */


WebsocketSyncEvent.prototype.returnChangesArray = false;

module.exports = { SyncEvent: SyncEvent, XHRSyncEvent: XHRSyncEvent, WebsocketSyncEvent: WebsocketSyncEvent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLWV2ZW50LmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsIlN5bmNFdmVudCIsIm9wdGlvbnMiLCJrZXkiLCJkZXBlbmRzIiwiaWQiLCJnZW5lcmF0ZVVVSUQiLCJjcmVhdGVkQXQiLCJEYXRlIiwibm93IiwidGFyZ2V0IiwiY2FsbGJhY2siLCJkYXRhIiwiY2xpZW50IiwiZ2V0T2JqZWN0Iiwib3BlcmF0aW9uIiwiX2dldFNlbmREYXRhIiwicHJvdG90eXBlIiwiZnJvbURCIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwic2V0IiwidmFsdWUiLCJfX2lzRmlyaW5nIiwiX19maXJlZEF0IiwiZ2V0IiwiQm9vbGVhbiIsIkZJUklOR19FWFBJUkFUSU9OIiwiX19pc1ZhbGlkYXRpbmciLCJfX3ZhbGlkYXRlZEF0IiwiVkFMSURBVElPTl9FWFBJUkFUSU9OIiwic3VjY2VzcyIsInJldHJ5Q291bnQiLCJYSFJTeW5jRXZlbnQiLCJfdXBkYXRlVXJsIiwiX3VwZGF0ZURhdGEiLCJ1cmwiLCJtZXRob2QiLCJoZWFkZXJzIiwidGVsZW1ldHJ5IiwibWF0Y2giLCJfZ2V0VXJsIiwidGltZW91dCIsInJldHVyblRvT25saW5lQ291bnQiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJyZXR1cm5DaGFuZ2VzQXJyYXkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLElBQU1BLFFBQVFDLFFBQVEsZ0JBQVIsQ0FBZDs7SUFFTUMsUztBQUNKOzs7Ozs7O0FBT0EscUJBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFDbkIsUUFBSUMsWUFBSjtBQUNBLFNBQUtBLEdBQUwsSUFBWUQsT0FBWixFQUFxQjtBQUNuQixVQUFJQyxPQUFPLElBQVgsRUFBaUI7QUFDZixhQUFLQSxHQUFMLElBQVlELFFBQVFDLEdBQVIsQ0FBWjtBQUNEO0FBQ0Y7QUFDRCxRQUFJ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O0FBeUQzQjs7Ozs7O0FBSUFpQyxhQUFhakIsU0FBYixDQUF1QjBCLE9BQXZCLEdBQWlDLEtBQWpDOztBQUVBOzs7QUFHQVQsYUFBYWpCLFNBQWIsQ0FBdUJvQixHQUF2QixHQUE2QixFQUE3Qjs7QUFFQTs7Ozs7O0FBTUFILGFBQWFqQixTQUFiLENBQXVCMkIsbUJBQXZCLEdBQTZDLENBQTdDOztBQUVBOzs7QUFHQVYsYUFBYWpCLFNBQWIsQ0FBdUJzQixPQUF2QixHQUFpQyxJQUFqQzs7QUFFQTs7O0FBR0FMLGFBQWFqQixTQUFiLENBQXVCcUIsTUFBdkIsR0FBZ0MsS0FBaEM7O0FBR0E7OztBQUdBSixhQUFhakIsU0FBYixDQUF1QnVCLFNBQXZCLEdBQW1DLElBQW5DOztBQUVBOzs7Ozs7O0lBTU1LLGtCOzs7Ozs7Ozs7Ozs7O0FBRUo7Ozs7Ozs7O29DQVFnQmhDLE0sRUFBUTtBQUN0QixXQUFLdUIsV0FBTCxDQUFpQnZCLE1BQWpCO0FBQ0EsYUFBTyxLQUFLRCxJQUFaO0FBQ0Q7OzsrQkFFVTtBQUNULGFBQU8sS0FBS0EsSUFBWjtBQUNEOzs7bUNBRWM7QUFDYixhQUFPLEtBQUtHLFNBQUwsS0FBbUIsTUFBbkIsSUFBNkIsS0FBS0gsSUFBTCxDQUFVQSxJQUF2QyxHQUE4QyxLQUFLQSxJQUFMLENBQVVBLElBQVYsQ0FBZVAsRUFBN0QsR0FBa0UsRUFBekU7QUFDRDs7OztFQXJCOEJKLFM7O0FBd0JqQzs7Ozs7QUFHQTRDLG1CQUFtQjVCLFNBQW5CLENBQTZCNkIsa0JBQTdCLEdBQWtELEtBQWxEOztBQUVBQyxPQUFPQyxPQUFQLEdBQWlCLEVBQUUvQyxvQkFBRixFQUFhaUMsMEJBQWIsRUFBMkJXLHNDQUEzQixFQUFqQiIsImZpbGUiOiJzeW5jLWV2ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIFN5bmMgRXZlbnQgcmVwcmVzZW50cyBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAqIEEgU3luYyBFdmVudCBtYXkgZmlyZSBpbW1lZGlhdGVseSwgb3IgbWF5IHdhaXQgaW4gdGhlIGxheWVyLlN5bmNNYW5hZ2VyJ3NcbiAqIHF1ZXVlIGZvciBhIGxvbmcgZHVyYXRpb24gYmVmb3JlIGZpcmluZy5cbiAqXG4gKiBETyBOT1QgY29uZnVzZSB0aGlzIHdpdGggbGF5ZXIuTGF5ZXJFdmVudCB3aGljaCByZXByZXNlbnRzIGEgY2hhbmdlIG5vdGlmaWNhdGlvblxuICogdG8geW91ciBhcHBsaWNhdGlvbi4gIGxheWVyLlN5bmNFdmVudCByZXByZXNlbnRzIGEgcmVxdWVzdCB0byB0aGUgc2VydmVyIHRoYXRcbiAqIGlzIGVpdGhlciBpbiBwcm9ncmVzcyBvciBpbiBxdWV1ZS5cbiAqXG4gKiBHRVQgcmVxdWVzdHMgYXJlIHR5cGljYWxseSBOT1QgZG9uZSB2aWEgYSBTeW5jRXZlbnQgYXMgdGhlc2UgYXJlIHR5cGljYWxseVxuICogbmVlZGVkIHRvIHJlbmRlciBhIFVJIGFuZCBzaG91bGQgZWl0aGVyIGZhaWwgb3Igc3VjY2VlZCBwcm9tcHRseS5cbiAqXG4gKiBBcHBsaWNhdGlvbnMgdHlwaWNhbGx5IGRvIG5vdCBpbnRlcmFjdCB3aXRoIHRoZXNlIG9iamVjdHMuXG4gKlxuICogQGNsYXNzICBsYXllci5TeW5jRXZlbnRcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqL1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuXG5jbGFzcyBTeW5jRXZlbnQge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbGF5ZXIuU3luY0V2ZW50LiAgU2VlIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3IgZm9yIGV4YW1wbGVzIG9mIHVzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kICBjb25zdHJ1Y3RvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5TeW5jRXZlbnR9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgbGV0IGtleTtcbiAgICBmb3IgKGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAoa2V5IGluIHRoaXMpIHtcbiAgICAgICAgdGhpc1trZXldID0gb3B0aW9uc1trZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRoaXMuZGVwZW5kcykgdGhpcy5kZXBlbmRzID0gW107XG4gICAgaWYgKCF0aGlzLmlkKSB0aGlzLmlkID0gJ2xheWVyOi8vL3N5bmNldmVudHMvJyArIFV0aWxzLmdlbmVyYXRlVVVJRCgpO1xuICAgIGlmICghdGhpcy5jcmVhdGVkQXQpIHRoaXMuY3JlYXRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3Qgc3RyaWN0bHkgcmVxdWlyZWQsIGJ1dCBuaWNlIHRvIGNsZWFuIHRoaW5ncyB1cC5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLmRlcGVuZHMgPSBudWxsO1xuICAgIHRoaXMuY2FsbGJhY2sgPSBudWxsO1xuICAgIHRoaXMuZGF0YSA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBSZWFsIHBhcmFtZXRlcnMgZm9yIHRoZSByZXF1ZXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVEYXRhXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdXBkYXRlRGF0YShjbGllbnQpIHtcbiAgICBpZiAoIXRoaXMudGFyZ2V0KSByZXR1cm47XG4gICAgY29uc3QgdGFyZ2V0ID0gY2xpZW50LmdldE9iamVjdCh0aGlzLnRhcmdldCk7XG4gICAgaWYgKHRhcmdldCAmJiB0aGlzLm9wZXJhdGlvbiA9PT0gJ1BPU1QnICYmIHRhcmdldC5fZ2V0U2VuZERhdGEpIHtcbiAgICAgIHRoaXMuZGF0YSA9IHRhcmdldC5fZ2V0U2VuZERhdGEodGhpcy5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIFBPSk8gdmVyc2lvbiBvZiB0aGlzIG9iamVjdCBzdWl0YWJsZSBmb3Igc2VyaWFsaXppbmcgZm9yIHRoZSBuZXR3b3JrXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIHRvT2JqZWN0KCkge1xuICAgIHJldHVybiB7IGRhdGE6IHRoaXMuZGF0YSB9O1xuICB9XG59XG5cblxuLyoqXG4gKiBUaGUgdHlwZSBvZiBvcGVyYXRpb24gYmVpbmcgcGVyZm9ybWVkLlxuICpcbiAqIEVpdGhlciBHRVQsIFBBVENILCBERUxFVEUsIFBPU1Qgb3IgUFVUXG4gKlxuICogQHByb3BlcnR5IHtTdHJpbmd9XG4gKi9cblN5bmNFdmVudC5wcm90b3R5cGUub3BlcmF0aW9uID0gJyc7XG5cblN5bmNFdmVudC5wcm90b3R5cGUuZnJvbURCID0gZmFsc2U7XG5cblN5bmNFdmVudC5wcm90b3R5cGUuY3JlYXRlZEF0ID0gMDtcblxuXG4vKipcbiAqIEluZGljYXRlcyB3aGV0aGVyIHRoaXMgcmVxdWVzdCBjdXJyZW50bHkgaW4tZmxpZ2h0LlxuICpcbiAqICogU2V0IHRvIHRydWUgYnkgX3hocigpIG1ldGhvZCxcbiAqICogc2V0IHRvIGZhbHNlIG9uIGNvbXBsZXRpb24gYnkgbGF5ZXIuU3luY01hbmFnZXIuXG4gKiAqIHNldCB0byBmYWxzZSBhdXRvbWF0aWNhbGx5IGFmdGVyIDIgbWludXRlc1xuICpcbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN5bmNFdmVudC5wcm90b3R5cGUsICdpc0ZpcmluZycsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgc2V0OiBmdW5jdGlvbiBzZXQodmFsdWUpIHtcbiAgICB0aGlzLl9faXNGaXJpbmcgPSB2YWx1ZTtcbiAgICBpZiAodmFsdWUpIHRoaXMuX19maXJlZEF0ID0gRGF0ZS5ub3coKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIEJvb2xlYW4odGhpcy5fX2lzRmlyaW5nICYmIERhdGUubm93KCkgLSB0aGlzLl9fZmlyZWRBdCA8IFN5bmNFdmVudC5GSVJJTkdfRVhQSVJBVElPTik7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBJbmRpY2F0ZXMgd2hldGhlciB0aGlzIHJlcXVlc3QgY3VycmVudGx5IGJlaW5nIHZhbGlkYXRlZCB0byBpbnN1cmUgaXQgd2Fzbid0IHJlYWRcbiAqIGZyb20gSW5kZXhlZERCIGFuZCBmaXJlZCBieSBhbm90aGVyIHRhYi5cbiAqXG4gKiBAcHJvcGVydHkge0Jvb2xlYW59XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTeW5jRXZlbnQucHJvdG90eXBlLCAnX2lzVmFsaWRhdGluZycsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgc2V0OiBmdW5jdGlvbiBzZXQodmFsdWUpIHtcbiAgICB0aGlzLl9faXNWYWxpZGF0aW5nID0gdmFsdWU7XG4gICAgaWYgKHZhbHVlKSB0aGlzLl9fdmFsaWRhdGVkQXQgPSBEYXRlLm5vdygpO1xuICB9LFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gQm9vbGVhbih0aGlzLl9faXNWYWxpZGF0aW5nICYmIERhdGUubm93KCkgLSB0aGlzLl9fdmFsaWRhdGVkQXQgPCBTeW5jRXZlbnQuVkFMSURBVElPTl9FWFBJUkFUSU9OKTtcbiAgfSxcbn0pO1xuXG5TeW5jRXZlbnQucHJvdG90eXBlLmlkID0gJyc7XG5cblxuLyoqXG4gKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgcmVxdWVzdCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LlxuICpcbiAqIFNldCBieSBsYXllci5TeW5jTWFuYWdlci5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5TeW5jRXZlbnQucHJvdG90eXBlLnN1Y2Nlc3MgPSBudWxsO1xuXG5cbi8qKlxuICogQ2FsbGJhY2sgdG8gZmlyZSBvbiBjb21wbGV0aW5nIHRoaXMgc3luYyBldmVudC5cbiAqXG4gKiBXQVJOSU5HOiBUaGUgbmF0dXJlIG9mIHRoaXMgY2FsbGJhY2sgbWF5IGNoYW5nZTtcbiAqIGEgcGVyc2lzdGVuY2UgbGF5ZXIgdGhhdCBwZXJzaXN0cyB0aGUgU3luY01hbmFnZXIncyBxdWV1ZVxuICogbXVzdCBoYXZlIHNlcmlhbGl6YWJsZSBjYWxsYmFja3MgKG9iamVjdCBpZCArIG1ldGhvZCBuYW1lOyBub3QgYSBmdW5jdGlvbilcbiAqIG9yIG11c3QgYWNjZXB0IHRoYXQgY2FsbGJhY2tzIGFyZSBub3QgYWx3YXlzIGZpcmVkLlxuICogQHR5cGUge0Z1bmN0aW9ufVxuICovXG5TeW5jRXZlbnQucHJvdG90eXBlLmNhbGxiYWNrID0gbnVsbDtcblxuLyoqXG4gKiBOdW1iZXIgb2YgcmV0cmllcyBvbiB0aGlzIHJlcXVlc3QuXG4gKlxuICogUmV0cmllcyBhcmUgb25seSBjb3VudGVkIGlmIGl0cyBhIDUwMiBvciA1MDNcbiAqIGVycm9yLiAgU2V0IGFuZCBtYW5hZ2VkIGJ5IGxheWVyLlN5bmNNYW5hZ2VyLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuU3luY0V2ZW50LnByb3RvdHlwZS5yZXRyeUNvdW50ID0gMDtcblxuLyoqXG4gKiBUaGUgdGFyZ2V0IG9mIHRoZSByZXF1ZXN0LlxuICpcbiAqIEFueSBDb21wb25lbnQ7IHR5cGljYWxseSBhIENvbnZlcnNhdGlvbiBvciBNZXNzYWdlLlxuICogQHR5cGUge2xheWVyLlJvb3R9XG4gKi9cblN5bmNFdmVudC5wcm90b3R5cGUudGFyZ2V0ID0gbnVsbDtcblxuLyoqXG4gKiBDb21wb25lbnRzIHRoYXQgdGhpcyByZXF1ZXN0IGRlcGVuZHMgdXBvbi5cbiAqXG4gKiBBIG1lc3NhZ2UgY2Fubm90IGJlIHNlbnQgaWYgaXRzXG4gKiBDb252ZXJzYXRpb24gZmFpbHMgdG8gZ2V0IGNyZWF0ZWQuXG4gKlxuICogTk9URTogTWF5IHByb3ZlIHJlZHVuZGFudCB3aXRoIHRoZSB0YXJnZXQgcHJvcGVydHkgYW5kIG5lZWRzIGZ1cnRoZXIgcmV2aWV3LlxuICogQHR5cGUge2xheWVyLlJvb3RbXX1cbiAqL1xuU3luY0V2ZW50LnByb3RvdHlwZS5kZXBlbmRzID0gbnVsbDtcblxuLyoqXG4gKiBEYXRhIGZpZWxkIG9mIHRoZSB4aHIgY2FsbDsgY2FuIGJlIGFuIE9iamVjdCBvciBzdHJpbmcgKGluY2x1ZGluZyBKU09OIHN0cmluZylcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblN5bmNFdmVudC5wcm90b3R5cGUuZGF0YSA9IG51bGw7XG5cbi8qKlxuICogQWZ0ZXIgZmlyaW5nIGEgcmVxdWVzdCwgaWYgdGhhdCBmaXJpbmcgc3RhdGUgZmFpbHMgdG8gY2xlYXIgYWZ0ZXIgdGhpcyBudW1iZXIgb2YgbWlsaXNlY29uZHMsXG4gKiBjb25zaWRlciBpdCB0byBubyBsb25nZXIgYmUgZmlyaW5nLiAgVW5kZXIgbm9ybWFsIGNvbmRpdGlvbnMsIGZpcmluZyB3aWxsIGJlIHNldCB0byBmYWxzZSBleHBsaWNpdGx5LlxuICogVGhpcyBjaGVjayBpbnN1cmVzIHRoYXQgYW55IGZhaWx1cmUgb2YgdGhhdCBwcm9jZXNzIGRvZXMgbm90IGxlYXZlIHVzIHN0dWNrIHdpdGggYSBmaXJpbmcgcmVxdWVzdFxuICogYmxvY2tpbmcgdGhlIHF1ZXVlLlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuU3luY0V2ZW50LkZJUklOR19FWFBJUkFUSU9OID0gMTAwMCAqIDE1O1xuXG4vKipcbiAqIEFmdGVyIGNoZWNraW5nIHRoZSBkYXRhYmFzZSB0byBzZWUgaWYgdGhpcyBldmVudCBoYXMgYmVlbiBjbGFpbWVkIGJ5IGFub3RoZXIgYnJvd3NlciB0YWIsXG4gKiBob3cgbG9uZyB0byB3YWl0IGJlZm9yZSBmbGFnZ2luZyBpdCBhcyBmYWlsZWQsIGluIHRoZSBldmVudCBvZiBuby1yZXNwb25zZS4gIE1lYXN1cmVkIGluIG1zLlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuU3luY0V2ZW50LlZBTElEQVRJT05fRVhQSVJBVElPTiA9IDUwMDtcblxuLyoqXG4gKiBBIGxheWVyLlN5bmNFdmVudCBpbnRlbmRlZCB0byBiZSBmaXJlZCBhcyBhbiBYSFIgcmVxdWVzdC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuU3luY0V2ZW50LlhIUlN5bmNFdmVudFxuICogQGV4dGVuZHMgbGF5ZXIuU3luY0V2ZW50XG4gKi9cbmNsYXNzIFhIUlN5bmNFdmVudCBleHRlbmRzIFN5bmNFdmVudCB7XG5cbiAgLyoqXG4gICAqIEZpcmUgdGhlIHJlcXVlc3QgYXNzb2NpYXRlZCB3aXRoIHRoaXMgaW5zdGFuY2UuXG4gICAqXG4gICAqIEFjdHVhbGx5IGl0IGp1c3QgcmV0dXJucyB0aGUgcGFyYW1ldGVycyBuZWVkZWQgdG8gbWFrZSB0aGUgeGhyIGNhbGw6XG4gICAqXG4gICAqICAgICAgdmFyIHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG4gICAqICAgICAgeGhyKGV2ZW50Ll9nZXRSZXF1ZXN0RGF0YShjbGllbnQpKTtcbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0UmVxdWVzdERhdGFcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAqL1xuICBfZ2V0UmVxdWVzdERhdGEoY2xpZW50KSB7XG4gICAgdGhpcy5fdXBkYXRlVXJsKGNsaWVudCk7XG4gICAgdGhpcy5fdXBkYXRlRGF0YShjbGllbnQpO1xuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHRoaXMudXJsLFxuICAgICAgbWV0aG9kOiB0aGlzLm1ldGhvZCxcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVycyxcbiAgICAgIGRhdGE6IHRoaXMuZGF0YSxcbiAgICAgIHRlbGVtZXRyeTogdGhpcy50ZWxlbWV0cnksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIFJlYWwgVVJMLlxuICAgKlxuICAgKiBJZiB0aGUgdXJsIHByb3BlcnR5IGlzIGEgZnVuY3Rpb24sIGNhbGwgaXQgdG8gc2V0IHRoZSBhY3R1YWwgdXJsLlxuICAgKiBVc2VkIHdoZW4gdGhlIFVSTCBpcyB1bmtub3duIHVudGlsIGEgcHJpb3IgU3luY0V2ZW50IGhhcyBjb21wbGV0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVVybFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3VwZGF0ZVVybChjbGllbnQpIHtcbiAgICBpZiAoIXRoaXMudGFyZ2V0KSByZXR1cm47XG4gICAgY29uc3QgdGFyZ2V0ID0gY2xpZW50LmdldE9iamVjdCh0aGlzLnRhcmdldCk7XG4gICAgaWYgKHRhcmdldCAmJiAhdGhpcy51cmwubWF0Y2goL15odHRwKHMpOlxcL1xcLy8pKSB7XG4gICAgICB0aGlzLnVybCA9IHRhcmdldC5fZ2V0VXJsKHRoaXMudXJsKTtcbiAgICB9XG4gIH1cblxuICB0b09iamVjdCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5kYXRhLFxuICAgICAgdXJsOiB0aGlzLnVybCxcbiAgICAgIG1ldGhvZDogdGhpcy5tZXRob2QsXG4gICAgfTtcbiAgfVxuXG4gIF9nZXRDcmVhdGVJZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vcGVyYXRpb24gPT09ICdQT1NUJyAmJiB0aGlzLmRhdGEgPyB0aGlzLmRhdGEuaWQgOiAnJztcbiAgfVxufVxuXG4vKipcbiAqIEhvdyBsb25nIGJlZm9yZSB0aGUgcmVxdWVzdCB0aW1lcyBvdXQ/XG4gKiBAdHlwZSB7TnVtYmVyfSBbdGltZW91dD0xNTAwMF1cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS50aW1lb3V0ID0gMTUwMDA7XG5cbi8qKlxuICogVVJMIHRvIHNlbmQgdGhlIHJlcXVlc3QgdG9cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBDb3VudHMgbnVtYmVyIG9mIG9ubGluZSBzdGF0ZSBjaGFuZ2VzLlxuICpcbiAqIElmIHRoaXMgbnVtYmVyIGJlY29tZXMgaGlnaCBpbiBhIHNob3J0IHRpbWUgcGVyaW9kLCBpdHMgcHJvYmFibHlcbiAqIGZhaWxpbmcgZHVlIHRvIGEgQ09SUyBlcnJvci5cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS5yZXR1cm5Ub09ubGluZUNvdW50ID0gMDtcblxuLyoqXG4gKiBIZWFkZXJzIGZvciB0aGUgcmVxdWVzdFxuICovXG5YSFJTeW5jRXZlbnQucHJvdG90eXBlLmhlYWRlcnMgPSBudWxsO1xuXG4vKipcbiAqIFJlcXVlc3QgbWV0aG9kLlxuICovXG5YSFJTeW5jRXZlbnQucHJvdG90eXBlLm1ldGhvZCA9ICdHRVQnO1xuXG5cbi8qKlxuICogVGVsZW1ldHJ5IGRhdGEgdG8gZ28gd2l0aCB0aGUgcmVxdWVzdC5cbiAqL1xuWEhSU3luY0V2ZW50LnByb3RvdHlwZS50ZWxlbWV0cnkgPSBudWxsO1xuXG4vKipcbiAqIEEgbGF5ZXIuU3luY0V2ZW50IGludGVuZGVkIHRvIGJlIGZpcmVkIGFzIGEgd2Vic29ja2V0IHJlcXVlc3QuXG4gKlxuICogQGNsYXNzIGxheWVyLlN5bmNFdmVudC5XZWJzb2NrZXRTeW5jRXZlbnRcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNFdmVudFxuICovXG5jbGFzcyBXZWJzb2NrZXRTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQge1xuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHdlYnNvY2tldCByZXF1ZXN0IG9iamVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0UmVxdWVzdERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBfZ2V0UmVxdWVzdERhdGEoY2xpZW50KSB7XG4gICAgdGhpcy5fdXBkYXRlRGF0YShjbGllbnQpO1xuICAgIHJldHVybiB0aGlzLmRhdGE7XG4gIH1cblxuICB0b09iamVjdCgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhO1xuICB9XG5cbiAgX2dldENyZWF0ZUlkKCkge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvbiA9PT0gJ1BPU1QnICYmIHRoaXMuZGF0YS5kYXRhID8gdGhpcy5kYXRhLmRhdGEuaWQgOiAnJztcbiAgfVxufVxuXG4vKipcbiAqIERvZXMgdGhpcyB3ZWJzb2NrZXQgcmVxdWVzdCByZXR1cm4gYSBjaGFuZ2VzIGFycmF5IHRvIGJlIHByb2Nlc3NlZCBieSB0aGUgcmVxdWVzdC1tYW5hZ2VyP1xuICovXG5XZWJzb2NrZXRTeW5jRXZlbnQucHJvdG90eXBlLnJldHVybkNoYW5nZXNBcnJheSA9IGZhbHNlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHsgU3luY0V2ZW50LCBYSFJTeW5jRXZlbnQsIFdlYnNvY2tldFN5bmNFdmVudCB9O1xuIl19
