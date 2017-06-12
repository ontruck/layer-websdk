'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This class manages a state variable for whether we are online/offline, triggers events
 * when the state changes, and determines when to perform tests to validate our online status.
 *
 * It performs the following tasks:
 *
 * 1. Any time we go more than this.pingFrequency (100 seconds) without any data from the server, flag us as being offline.
 *    Rationale: The websocket manager is calling `getCounter` every 30 seconds; so it would have had to fail to get any response
 *    3 times before we give up.
 * 2. While we are offline, ping the server until we determine we are in fact able to connect to the server
 * 3. Trigger events `connected` and `disconnected` to let the rest of the system know when we are/are not connected.
 *    NOTE: The Websocket manager will use that to reconnect its websocket, and resume its `getCounter` call every 30 seconds.
 *
 * NOTE: Apps that want to be notified of changes to online/offline state should see layer.Client's `online` event.
 *
 * NOTE: One iteration of this class treated navigator.onLine = false as fact.  If onLine is false, then we don't need to test
 * anything.  If its true, then this class verifies it can reach layer's servers.  However, https://code.google.com/p/chromium/issues/detail?id=277372 has replicated multiple times in chrome; this bug causes one tab of chrome to have navigator.onLine=false while all other tabs
 * correctly report navigator.onLine=true.  As a result, we can't rely on this value and this class must continue to poll the server while
 * offline and to ignore values from navigator.onLine.  Future Work: Allow non-chrome browsers to use navigator.onLine.
 *
 * @class  layer.OnlineStateManager
 * @private
 * @extends layer.Root
 *
 */
var Root = require('./root');
var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var _require = require('./const'),
    ACCEPT = _require.ACCEPT;

var OnlineStateManager = function (_Root) {
  _inherits(OnlineStateManager, _Root);

  /**
   * Creates a new OnlineStateManager.
   *
   * An Application is expected to only have one of these.
   *
   *      var onlineStateManager = new layer.OnlineStateManager({
   *          socketManager: socketManager,
   *          testUrl: 'https://api.layer.com/nonces'
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {layer.Websockets.SocketManager} options.socketManager - A websocket manager to monitor for messages
   * @param  {string} options.testUrl - A url to send requests to when testing if we are online
   */
  function OnlineStateManager(options) {
    _classCallCheck(this, OnlineStateManager);

    // Listen to all xhr events and websocket messages for online-status info
    var _this = _possibleConstructorReturn(this, (OnlineStateManager.__proto__ || Object.getPrototypeOf(OnlineStateManager)).call(this, options));

    xhr.addConnectionListener(function (evt) {
      return _this._connectionListener(evt);
    });
    _this.socketManager.on('message', function () {
      return _this._connectionListener({ status: 'connection:success' });
    }, _this);

    // Any change in online status reported by the browser should result in
    // an immediate update to our online/offline state
    /* istanbul ignore else */
    if (typeof window !== 'undefined') {
      window.addEventListener('online', _this._handleOnlineEvent.bind(_this));
      window.addEventListener('offline', _this._handleOnlineEvent.bind(_this));
    }
    return _this;
  }

  /**
   * We don't actually start managing our online state until after the client has authenticated.
   * Call start() when we are ready for the client to start managing our state.
   *
   * The client won't call start() without first validating that we have a valid session, so by definition,
   * calling start means we are online.
   *
   * @method start
   */


  _createClass(OnlineStateManager, [{
    key: 'start',
    value: function start() {
      logger.info('OnlineStateManager: start');
      this.isClientReady = true;
      this.isOnline = true;

      this.checkOnlineStatus();
    }

    /**
     * If the client becomes unauthenticated, stop checking if we are online, and announce that we are offline.
     *
     * @method stop
     */

  }, {
    key: 'stop',
    value: function stop() {
      logger.info('OnlineStateManager: stop');
      this.isClientReady = false;
      this._clearCheck();
      this._changeToOffline();
    }

    /**
     * Schedules our next call to _onlineExpired if online or checkOnlineStatus if offline.
     *
     * @method _scheduleNextOnlineCheck
     * @private
     */

  }, {
    key: '_scheduleNextOnlineCheck',
    value: function _scheduleNextOnlineCheck(connectionFailure, callback) {
      logger.debug('OnlineStateManager: skip schedule');
      if (this.isDestroyed || !this.isClientReady) return;

      // Replace any scheduled calls with the newly scheduled call:
      this._clearCheck();

      // If this is called while we are online, then we are using this to detect when we've gone without data for more than pingFrequency.
      // Call this._onlineExpired after pingFrequency of no server responses.
      if (!connectionFailure) {
        logger.debug('OnlineStateManager: Scheduled onlineExpired');
        this.onlineCheckId = setTimeout(this._onlineExpired.bind(this), this.pingFrequency);
      }

      // If this is called while we are offline, we're doing exponential backoff pinging the server to see if we've come back online.
      else {
          logger.info('OnlineStateManager: Scheduled checkOnlineStatus');
          var duration = Utils.getExponentialBackoffSeconds(this.maxOfflineWait, Math.min(10, this.offlineCounter++));
          this.onlineCheckId = setTimeout(this.checkOnlineStatus.bind(this, callback), Math.floor(duration * 1000));
        }
    }

    /**
     * Cancels any upcoming calls to checkOnlineStatus
     *
     * @method _clearCheck
     * @private
     */

  }, {
    key: '_clearCheck',
    value: function _clearCheck() {
      if (this.onlineCheckId) {
        clearTimeout(this.onlineCheckId);
        this.onlineCheckId = 0;
      }
    }

    /**
     * Respond to the browser's online/offline events.
     *
     * Our response is not to trust them, but to use them as
     * a trigger to indicate we should immediately do our own
     * validation.
     *
     * @method _handleOnlineEvent
     * @private
     * @param  {Event} evt - Browser online/offline event object
     */

  }, {
    key: '_handleOnlineEvent',
    value: function _handleOnlineEvent(evt) {
      // Reset the counter because our first request may fail as they may not be
      // fully connected yet
      this.offlineCounter = 0;
      this.checkOnlineStatus();
    }

    /**
     * Our online state has expired; we are now offline.
     *
     * If this method gets called, it means that our connection has gone too long without any data
     * and is now considered to be disconnected.  Start scheduling tests to see when we are back online.
     *
     * @method _onlineExpired
     * @private
     */

  }, {
    key: '_onlineExpired',
    value: function _onlineExpired() {
      this._clearCheck();
      this._changeToOffline();
      this._scheduleNextOnlineCheck();
    }

    /**
     * Get a nonce to see if we can reach the server.
     *
     * We don't care about the result,
     * we just care about triggering a 'connection:success' or 'connection:error' event
     * which connectionListener will respond to.
     *
     *      client.onlineManager.checkOnlineStatus(function(result) {
     *          alert(result ? 'We're online!' : 'Doh!');
     *      });
     *
     * @method checkOnlineStatus
     * @param {Function} callback
     * @param {boolean} callback.isOnline - Callback is called with true if online, false if not
     */

  }, {
    key: 'checkOnlineStatus',
    value: function checkOnlineStatus(callback) {
      this._clearCheck();

      logger.info('OnlineStateManager: Firing XHR for online check');
      this._lastCheckOnlineStatus = new Date();
      // Ping the server and see if we're connected.
      xhr({
        url: this.socketManager.client.url + '/?action=validateIsOnline&client=' + this.socketManager.client.constructor.version,
        method: 'GET',
        headers: {
          accept: ACCEPT
        }
      }, function (_ref) {
        var status = _ref.status;

        // this.isOnline will be updated via _connectionListener prior to this line executing
        if (callback) callback(status !== 408);
      });
    }

    /**
     * On determining that we are offline, handles the state transition and logging.
     *
     * @method _changeToOffline
     * @private
     */

  }, {
    key: '_changeToOffline',
    value: function _changeToOffline() {
      if (this.isOnline) {
        this.isOnline = false;
        this.trigger('disconnected');
        logger.info('OnlineStateManager: Connection lost');
      }
    }

    /**
     * Called whenever a websocket event arrives, or an xhr call completes; updates our isOnline state.
     *
     * Any call to this method will reschedule our next is-online test
     *
     * @method _connectionListener
     * @private
     * @param  {string} evt - Name of the event; either 'connection:success' or 'connection:error'
     */

  }, {
    key: '_connectionListener',
    value: function _connectionListener(evt) {
      var _this2 = this;

      // If event is a success, change us to online
      var failed = evt.status !== 'connection:success';
      if (!failed) {
        var lastTime = this.lastMessageTime;
        this.lastMessageTime = new Date();
        if (!this.isOnline) {
          this.isOnline = true;
          this.offlineCounter = 0;
          this.trigger('connected', { offlineDuration: lastTime ? Date.now() - lastTime : 0 });
          if (this.connectedCounter === undefined) this.connectedCounter = 0;
          this.connectedCounter++;
          logger.info('OnlineStateManager: Connected restored');
        }
      }

      this._scheduleNextOnlineCheck(failed, function (result) {
        if (!result) _this2._changeToOffline();
      });
    }

    /**
     * Cleanup/shutdown
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this._clearCheck();
      this.socketManager = null;
      _get(OnlineStateManager.prototype.__proto__ || Object.getPrototypeOf(OnlineStateManager.prototype), 'destroy', this).call(this);
    }
  }]);

  return OnlineStateManager;
}(Root);

OnlineStateManager.prototype.isClientReady = false;

/**
 * URL To fire when testing to see if we are online.
 * @type {String}
 */
OnlineStateManager.prototype.testUrl = '';

/**
 * A Websocket manager whose 'message' event we will listen to
 * in order to know that we are still online.
 * @type {layer.Websockets.SocketManager}
 */
OnlineStateManager.prototype.socketManager = null;

/**
 * Number of testUrl requests we've been offline for.
 *
 * Will stop growing once the number is suitably large (10-20).
 * @type {Number}
 */
OnlineStateManager.prototype.offlineCounter = 0;

/**
 * Maximum wait during exponential backoff while offline.
 *
 * While offline, exponential backoff is used to calculate how long to wait between checking with the server
 * to see if we are online again. This value determines the maximum wait; any higher value returned by exponential backoff
 * are ignored and this value used instead.
 * Value is measured in seconds.
 * @type {Number}
 */
OnlineStateManager.prototype.maxOfflineWait = 5 * 60;

/**
 * Minimum wait between tries in ms.
 * @type {Number}
 */
OnlineStateManager.prototype.minBackoffWait = 100;

/**
 * Time that the last successful message was observed.
 * @type {Date}
 */
OnlineStateManager.prototype.lastMessageTime = null;

/**
 * For debugging, tracks the last time we checked if we are online.
 * @type {Date}
 */
OnlineStateManager.prototype._lastCheckOnlineStatus = null;

/**
 * Are we currently online?
 * @type {Boolean}
 */
OnlineStateManager.prototype.isOnline = false;

/**
 * setTimeoutId for the next checkOnlineStatus() call.
 * @type {Number}
 */
OnlineStateManager.prototype.onlineCheckId = 0;

/**
 * If we are online, how often do we need to ping to verify we are still online.
 *
 * Value is reset any time we observe any messages from the server.
 * Measured in miliseconds. NOTE: Websocket has a separate ping which mostly makes
 * this one unnecessary.  May end up removing this one... though we'd keep the
 * ping for when our state is offline.
 * @type {Number}
 */
OnlineStateManager.prototype.pingFrequency = 100 * 1000;

OnlineStateManager._supportedEvents = [
/**
 * We appear to be online and able to send and receive
 * @event connected
 * @param {number} onlineDuration - Number of miliseconds since we were last known to be online
 */
'connected',

/**
 * We appear to be offline and unable to send or receive
 * @event disconnected
 */
'disconnected'].concat(Root._supportedEvents);
Root.initClass.apply(OnlineStateManager, [OnlineStateManager, 'OnlineStateManager']);
module.exports = OnlineStateManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9vbmxpbmUtc3RhdGUtbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsInhociIsImxvZ2dlciIsIlV0aWxzIiwiQUNDRVBUIiwiT25saW5lU3RhdGVNYW5hZ2VyIiwib3B0aW9ucyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsIl9jb25uZWN0aW9uTGlzdGVuZXIiLCJldnQiLCJzb2NrZXRNYW5hZ2VyIiwib24iLCJzdGF0dXMiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwiX2hhbmRsZU9ubGluZUV2ZW50IiwiYmluZCIsImluZm8iLCJpc0NsaWVudFJlYWR5IiwiaXNPbmxpbmUiLCJjaGVja09ubGluZVN0YXR1cyIsIl9jbGVhckNoZWNrIiwiX2NoYW5nZVRvT2ZmbGluZSIsImNvbm5lY3Rpb25GYWlsdXJlIiwiY2FsbGJhY2siLCJkZWJ1ZyIsImlzRGVzdHJveWVkIiwib25saW5lQ2hlY2tJZCIsInNldFRpbWVvdXQiLCJfb25saW5lRXhwaXJlZCIsInBpbmdGcmVxdWVuY3kiLCJkdXJhdGlvbiIsImdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMiLCJtYXhPZmZsaW5lV2FpdCIsIk1hdGgiLCJtaW4iLCJvZmZsaW5lQ291bnRlciIsImZsb29yIiwiY2xlYXJUaW1lb3V0IiwiX3NjaGVkdWxlTmV4dE9ubGluZUNoZWNrIiwiX2xhc3RDaGVja09ubGluZVN0YXR1cyIsIkRhdGUiLCJ1cmwiLCJjbGllbnQiLCJjb25zdHJ1Y3RvciIsInZlcnNpb24iLCJtZXRob2QiLCJoZWFkZXJzIiwiYWNjZXB0IiwidHJpZ2dlciIsImZhaWxlZCIsImxhc3RUaW1lIiwibGFzdE1lc3NhZ2VUaW1lIiwib2ZmbGluZUR1cmF0aW9uIiwibm93IiwiY29ubmVjdGVkQ291bnRlciIsInVuZGVmaW5lZCIsInJlc3VsdCIsInByb3RvdHlwZSIsInRlc3RVcmwiLCJtaW5CYWNrb2ZmV2FpdCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25j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bUJxRCxTQUFuQixDQUE2QnZDLFFBQTdCLEdBQXdDLEtBQXhDOztBQUVBOzs7O0FBSUFkLG1CQUFtQnFELFNBQW5CLENBQTZCL0IsYUFBN0IsR0FBNkMsQ0FBN0M7O0FBRUE7Ozs7Ozs7OztBQVNBdEIsbUJBQW1CcUQsU0FBbkIsQ0FBNkI1QixhQUE3QixHQUE2QyxNQUFNLElBQW5EOztBQUVBekIsbUJBQW1Cd0QsZ0JBQW5CLEdBQXNDO0FBQ3BDOzs7OztBQUtBLFdBTm9DOztBQVFwQzs7OztBQUlBLGNBWm9DLEVBYXBDQyxNQWJvQyxDQWE3Qi9ELEtBQUs4RCxnQkFid0IsQ0FBdEM7QUFjQTlELEtBQUtnRSxTQUFMLENBQWVDLEtBQWYsQ0FBcUIzRCxrQkFBckIsRUFBeUMsQ0FBQ0Esa0JBQUQsRUFBcUIsb0JBQXJCLENBQXpDO0FBQ0E0RCxPQUFPQyxPQUFQLEdBQWlCN0Qsa0JBQWpCIiwiZmlsZSI6Im9ubGluZS1zdGF0ZS1tYW5hZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXMgYSBzdGF0ZSB2YXJpYWJsZSBmb3Igd2hldGhlciB3ZSBhcmUgb25saW5lL29mZmxpbmUsIHRyaWdnZXJzIGV2ZW50c1xuICogd2hlbiB0aGUgc3RhdGUgY2hhbmdlcywgYW5kIGRldGVybWluZXMgd2hlbiB0byBwZXJmb3JtIHRlc3RzIHRvIHZhbGlkYXRlIG91ciBvbmxpbmUgc3RhdHVzLlxuICpcbiAqIEl0IHBlcmZvcm1zIHRoZSBmb2xsb3dpbmcgdGFza3M6XG4gKlxuICogMS4gQW55IHRpbWUgd2UgZ28gbW9yZSB0aGFuIHRoaXMucGluZ0ZyZXF1ZW5jeSAoMTAwIHNlY29uZHMpIHdpdGhvdXQgYW55IGRhdGEgZnJvbSB0aGUgc2VydmVyLCBmbGFnIHVzIGFzIGJlaW5nIG9mZmxpbmUuXG4gKiAgICBSYXRpb25hbGU6IFRoZSB3ZWJzb2NrZXQgbWFuYWdlciBpcyBjYWxsaW5nIGBnZXRDb3VudGVyYCBldmVyeSAzMCBzZWNvbmRzOyBzbyBpdCB3b3VsZCBoYXZlIGhhZCB0byBmYWlsIHRvIGdldCBhbnkgcmVzcG9uc2VcbiAqICAgIDMgdGltZXMgYmVmb3JlIHdlIGdpdmUgdXAuXG4gKiAyLiBXaGlsZSB3ZSBhcmUgb2ZmbGluZSwgcGluZyB0aGUgc2VydmVyIHVudGlsIHdlIGRldGVybWluZSB3ZSBhcmUgaW4gZmFjdCBhYmxlIHRvIGNvbm5lY3QgdG8gdGhlIHNlcnZlclxuICogMy4gVHJpZ2dlciBldmVudHMgYGNvbm5lY3RlZGAgYW5kIGBkaXNjb25uZWN0ZWRgIHRvIGxldCB0aGUgcmVzdCBvZiB0aGUgc3lzdGVtIGtub3cgd2hlbiB3ZSBhcmUvYXJlIG5vdCBjb25uZWN0ZWQuXG4gKiAgICBOT1RFOiBUaGUgV2Vic29ja2V0IG1hbmFnZXIgd2lsbCB1c2UgdGhhdCB0byByZWNvbm5lY3QgaXRzIHdlYnNvY2tldCwgYW5kIHJlc3VtZSBpdHMgYGdldENvdW50ZXJgIGNhbGwgZXZlcnkgMzAgc2Vjb25kcy5cbiAqXG4gKiBOT1RFOiBBcHBzIHRoYXQgd2FudCB0byBiZSBub3RpZmllZCBvZiBjaGFuZ2VzIHRvIG9ubGluZS9vZmZsaW5lIHN0YXRlIHNob3VsZCBzZWUgbGF5ZXIuQ2xpZW50J3MgYG9ubGluZWAgZXZlbnQuXG4gKlxuICogTk9URTogT25lIGl0ZXJhdGlvbiBvZiB0aGlzIGNsYXNzIHRyZWF0ZWQgbmF2aWdhdG9yLm9uTGluZSA9IGZhbHNlIGFzIGZhY3QuICBJZiBvbkxpbmUgaXMgZmFsc2UsIHRoZW4gd2UgZG9uJ3QgbmVlZCB0byB0ZXN0XG4gKiBhbnl0aGluZy4gIElmIGl0cyB0cnVlLCB0aGVuIHRoaXMgY2xhc3MgdmVyaWZpZXMgaXQgY2FuIHJlYWNoIGxheWVyJ3Mgc2VydmVycy4gIEhvd2V2ZXIsIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNzczNzIgaGFzIHJlcGxpY2F0ZWQgbXVsdGlwbGUgdGltZXMgaW4gY2hyb21lOyB0aGlzIGJ1ZyBjYXVzZXMgb25lIHRhYiBvZiBjaHJvbWUgdG8gaGF2ZSBuYXZpZ2F0b3Iub25MaW5lPWZhbHNlIHdoaWxlIGFsbCBvdGhlciB0YWJzXG4gKiBjb3JyZWN0bHkgcmVwb3J0IG5hdmlnYXRvci5vbkxpbmU9dHJ1ZS4gIEFzIGEgcmVzdWx0LCB3ZSBjYW4ndCByZWx5IG9uIHRoaXMgdmFsdWUgYW5kIHRoaXMgY2xhc3MgbXVzdCBjb250aW51ZSB0byBwb2xsIHRoZSBzZXJ2ZXIgd2hpbGVcbiAqIG9mZmxpbmUgYW5kIHRvIGlnbm9yZSB2YWx1ZXMgZnJvbSBuYXZpZ2F0b3Iub25MaW5lLiAgRnV0dXJlIFdvcms6IEFsbG93IG5vbi1jaHJvbWUgYnJvd3NlcnMgdG8gdXNlIG5hdmlnYXRvci5vbkxpbmUuXG4gKlxuICogQGNsYXNzICBsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKlxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IHsgQUNDRVBUIH0gPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5cbmNsYXNzIE9ubGluZVN0YXRlTWFuYWdlciBleHRlbmRzIFJvb3Qge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBPbmxpbmVTdGF0ZU1hbmFnZXIuXG4gICAqXG4gICAqIEFuIEFwcGxpY2F0aW9uIGlzIGV4cGVjdGVkIHRvIG9ubHkgaGF2ZSBvbmUgb2YgdGhlc2UuXG4gICAqXG4gICAqICAgICAgdmFyIG9ubGluZVN0YXRlTWFuYWdlciA9IG5ldyBsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyLFxuICAgKiAgICAgICAgICB0ZXN0VXJsOiAnaHR0cHM6Ly9hcGkubGF5ZXIuY29tL25vbmNlcydcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtICB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfSBvcHRpb25zLnNvY2tldE1hbmFnZXIgLSBBIHdlYnNvY2tldCBtYW5hZ2VyIHRvIG1vbml0b3IgZm9yIG1lc3NhZ2VzXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy50ZXN0VXJsIC0gQSB1cmwgdG8gc2VuZCByZXF1ZXN0cyB0byB3aGVuIHRlc3RpbmcgaWYgd2UgYXJlIG9ubGluZVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gTGlzdGVuIHRvIGFsbCB4aHIgZXZlbnRzIGFuZCB3ZWJzb2NrZXQgbWVzc2FnZXMgZm9yIG9ubGluZS1zdGF0dXMgaW5mb1xuICAgIHhoci5hZGRDb25uZWN0aW9uTGlzdGVuZXIoZXZ0ID0+IHRoaXMuX2Nvbm5lY3Rpb25MaXN0ZW5lcihldnQpKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIub24oJ21lc3NhZ2UnLCAoKSA9PiB0aGlzLl9jb25uZWN0aW9uTGlzdGVuZXIoeyBzdGF0dXM6ICdjb25uZWN0aW9uOnN1Y2Nlc3MnIH0pLCB0aGlzKTtcblxuICAgIC8vIEFueSBjaGFuZ2UgaW4gb25saW5lIHN0YXR1cyByZXBvcnRlZCBieSB0aGUgYnJvd3NlciBzaG91bGQgcmVzdWx0IGluXG4gICAgLy8gYW4gaW1tZWRpYXRlIHVwZGF0ZSB0byBvdXIgb25saW5lL29mZmxpbmUgc3RhdGVcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsIHRoaXMuX2hhbmRsZU9ubGluZUV2ZW50LmJpbmQodGhpcykpO1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29mZmxpbmUnLCB0aGlzLl9oYW5kbGVPbmxpbmVFdmVudC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2UgZG9uJ3QgYWN0dWFsbHkgc3RhcnQgbWFuYWdpbmcgb3VyIG9ubGluZSBzdGF0ZSB1bnRpbCBhZnRlciB0aGUgY2xpZW50IGhhcyBhdXRoZW50aWNhdGVkLlxuICAgKiBDYWxsIHN0YXJ0KCkgd2hlbiB3ZSBhcmUgcmVhZHkgZm9yIHRoZSBjbGllbnQgdG8gc3RhcnQgbWFuYWdpbmcgb3VyIHN0YXRlLlxuICAgKlxuICAgKiBUaGUgY2xpZW50IHdvbid0IGNhbGwgc3RhcnQoKSB3aXRob3V0IGZpcnN0IHZhbGlkYXRpbmcgdGhhdCB3ZSBoYXZlIGEgdmFsaWQgc2Vzc2lvbiwgc28gYnkgZGVmaW5pdGlvbixcbiAgICogY2FsbGluZyBzdGFydCBtZWFucyB3ZSBhcmUgb25saW5lLlxuICAgKlxuICAgKiBAbWV0aG9kIHN0YXJ0XG4gICAqL1xuICBzdGFydCgpIHtcbiAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBzdGFydCcpO1xuICAgIHRoaXMuaXNDbGllbnRSZWFkeSA9IHRydWU7XG4gICAgdGhpcy5pc09ubGluZSA9IHRydWU7XG5cbiAgICB0aGlzLmNoZWNrT25saW5lU3RhdHVzKCk7XG4gIH1cblxuICAvKipcbiAgICogSWYgdGhlIGNsaWVudCBiZWNvbWVzIHVuYXV0aGVudGljYXRlZCwgc3RvcCBjaGVja2luZyBpZiB3ZSBhcmUgb25saW5lLCBhbmQgYW5ub3VuY2UgdGhhdCB3ZSBhcmUgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBzdG9wXG4gICAqL1xuICBzdG9wKCkge1xuICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IHN0b3AnKTtcbiAgICB0aGlzLmlzQ2xpZW50UmVhZHkgPSBmYWxzZTtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZXMgb3VyIG5leHQgY2FsbCB0byBfb25saW5lRXhwaXJlZCBpZiBvbmxpbmUgb3IgY2hlY2tPbmxpbmVTdGF0dXMgaWYgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVOZXh0T25saW5lQ2hlY2tcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZU5leHRPbmxpbmVDaGVjayhjb25uZWN0aW9uRmFpbHVyZSwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIuZGVidWcoJ09ubGluZVN0YXRlTWFuYWdlcjogc2tpcCBzY2hlZHVsZScpO1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLmlzQ2xpZW50UmVhZHkpIHJldHVybjtcblxuICAgIC8vIFJlcGxhY2UgYW55IHNjaGVkdWxlZCBjYWxscyB3aXRoIHRoZSBuZXdseSBzY2hlZHVsZWQgY2FsbDpcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGNhbGxlZCB3aGlsZSB3ZSBhcmUgb25saW5lLCB0aGVuIHdlIGFyZSB1c2luZyB0aGlzIHRvIGRldGVjdCB3aGVuIHdlJ3ZlIGdvbmUgd2l0aG91dCBkYXRhIGZvciBtb3JlIHRoYW4gcGluZ0ZyZXF1ZW5jeS5cbiAgICAvLyBDYWxsIHRoaXMuX29ubGluZUV4cGlyZWQgYWZ0ZXIgcGluZ0ZyZXF1ZW5jeSBvZiBubyBzZXJ2ZXIgcmVzcG9uc2VzLlxuICAgIGlmICghY29ubmVjdGlvbkZhaWx1cmUpIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnT25saW5lU3RhdGVNYW5hZ2VyOiBTY2hlZHVsZWQgb25saW5lRXhwaXJlZCcpO1xuICAgICAgdGhpcy5vbmxpbmVDaGVja0lkID0gc2V0VGltZW91dCh0aGlzLl9vbmxpbmVFeHBpcmVkLmJpbmQodGhpcyksIHRoaXMucGluZ0ZyZXF1ZW5jeSk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhpcyBpcyBjYWxsZWQgd2hpbGUgd2UgYXJlIG9mZmxpbmUsIHdlJ3JlIGRvaW5nIGV4cG9uZW50aWFsIGJhY2tvZmYgcGluZ2luZyB0aGUgc2VydmVyIHRvIHNlZSBpZiB3ZSd2ZSBjb21lIGJhY2sgb25saW5lLlxuICAgIGVsc2Uge1xuICAgICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogU2NoZWR1bGVkIGNoZWNrT25saW5lU3RhdHVzJyk7XG4gICAgICBjb25zdCBkdXJhdGlvbiA9IFV0aWxzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHModGhpcy5tYXhPZmZsaW5lV2FpdCwgTWF0aC5taW4oMTAsIHRoaXMub2ZmbGluZUNvdW50ZXIrKykpO1xuICAgICAgdGhpcy5vbmxpbmVDaGVja0lkID0gc2V0VGltZW91dCh0aGlzLmNoZWNrT25saW5lU3RhdHVzLmJpbmQodGhpcywgY2FsbGJhY2spLCBNYXRoLmZsb29yKGR1cmF0aW9uICogMTAwMCkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYW5jZWxzIGFueSB1cGNvbWluZyBjYWxscyB0byBjaGVja09ubGluZVN0YXR1c1xuICAgKlxuICAgKiBAbWV0aG9kIF9jbGVhckNoZWNrXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJDaGVjaygpIHtcbiAgICBpZiAodGhpcy5vbmxpbmVDaGVja0lkKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5vbmxpbmVDaGVja0lkKTtcbiAgICAgIHRoaXMub25saW5lQ2hlY2tJZCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc3BvbmQgdG8gdGhlIGJyb3dzZXIncyBvbmxpbmUvb2ZmbGluZSBldmVudHMuXG4gICAqXG4gICAqIE91ciByZXNwb25zZSBpcyBub3QgdG8gdHJ1c3QgdGhlbSwgYnV0IHRvIHVzZSB0aGVtIGFzXG4gICAqIGEgdHJpZ2dlciB0byBpbmRpY2F0ZSB3ZSBzaG91bGQgaW1tZWRpYXRlbHkgZG8gb3VyIG93blxuICAgKiB2YWxpZGF0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVPbmxpbmVFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtFdmVudH0gZXZ0IC0gQnJvd3NlciBvbmxpbmUvb2ZmbGluZSBldmVudCBvYmplY3RcbiAgICovXG4gIF9oYW5kbGVPbmxpbmVFdmVudChldnQpIHtcbiAgICAvLyBSZXNldCB0aGUgY291bnRlciBiZWNhdXNlIG91ciBmaXJzdCByZXF1ZXN0IG1heSBmYWlsIGFzIHRoZXkgbWF5IG5vdCBiZVxuICAgIC8vIGZ1bGx5IGNvbm5lY3RlZCB5ZXRcbiAgICB0aGlzLm9mZmxpbmVDb3VudGVyID0gMDtcbiAgICB0aGlzLmNoZWNrT25saW5lU3RhdHVzKCk7XG4gIH1cblxuICAvKipcbiAgICogT3VyIG9ubGluZSBzdGF0ZSBoYXMgZXhwaXJlZDsgd2UgYXJlIG5vdyBvZmZsaW5lLlxuICAgKlxuICAgKiBJZiB0aGlzIG1ldGhvZCBnZXRzIGNhbGxlZCwgaXQgbWVhbnMgdGhhdCBvdXIgY29ubmVjdGlvbiBoYXMgZ29uZSB0b28gbG9uZyB3aXRob3V0IGFueSBkYXRhXG4gICAqIGFuZCBpcyBub3cgY29uc2lkZXJlZCB0byBiZSBkaXNjb25uZWN0ZWQuICBTdGFydCBzY2hlZHVsaW5nIHRlc3RzIHRvIHNlZSB3aGVuIHdlIGFyZSBiYWNrIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBfb25saW5lRXhwaXJlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX29ubGluZUV4cGlyZWQoKSB7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuICAgIHRoaXMuX2NoYW5nZVRvT2ZmbGluZSgpO1xuICAgIHRoaXMuX3NjaGVkdWxlTmV4dE9ubGluZUNoZWNrKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgbm9uY2UgdG8gc2VlIGlmIHdlIGNhbiByZWFjaCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSByZXN1bHQsXG4gICAqIHdlIGp1c3QgY2FyZSBhYm91dCB0cmlnZ2VyaW5nIGEgJ2Nvbm5lY3Rpb246c3VjY2Vzcycgb3IgJ2Nvbm5lY3Rpb246ZXJyb3InIGV2ZW50XG4gICAqIHdoaWNoIGNvbm5lY3Rpb25MaXN0ZW5lciB3aWxsIHJlc3BvbmQgdG8uXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9ubGluZU1hbmFnZXIuY2hlY2tPbmxpbmVTdGF0dXMoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAqICAgICAgICAgIGFsZXJ0KHJlc3VsdCA/ICdXZSdyZSBvbmxpbmUhJyA6ICdEb2ghJyk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY2hlY2tPbmxpbmVTdGF0dXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtib29sZWFufSBjYWxsYmFjay5pc09ubGluZSAtIENhbGxiYWNrIGlzIGNhbGxlZCB3aXRoIHRydWUgaWYgb25saW5lLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIGNoZWNrT25saW5lU3RhdHVzKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuXG4gICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogRmlyaW5nIFhIUiBmb3Igb25saW5lIGNoZWNrJyk7XG4gICAgdGhpcy5fbGFzdENoZWNrT25saW5lU3RhdHVzID0gbmV3IERhdGUoKTtcbiAgICAvLyBQaW5nIHRoZSBzZXJ2ZXIgYW5kIHNlZSBpZiB3ZSdyZSBjb25uZWN0ZWQuXG4gICAgeGhyKHtcbiAgICAgIHVybDogYCR7dGhpcy5zb2NrZXRNYW5hZ2VyLmNsaWVudC51cmx9Lz9hY3Rpb249dmFsaWRhdGVJc09ubGluZSZjbGllbnQ9JHt0aGlzLnNvY2tldE1hbmFnZXIuY2xpZW50LmNvbnN0cnVjdG9yLnZlcnNpb259YCxcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIGFjY2VwdDogQUNDRVBULFxuICAgICAgfSxcbiAgICB9LCAoeyBzdGF0dXMgfSkgPT4ge1xuICAgICAgLy8gdGhpcy5pc09ubGluZSB3aWxsIGJlIHVwZGF0ZWQgdmlhIF9jb25uZWN0aW9uTGlzdGVuZXIgcHJpb3IgdG8gdGhpcyBsaW5lIGV4ZWN1dGluZ1xuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhzdGF0dXMgIT09IDQwOCk7XG4gICAgfSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBPbiBkZXRlcm1pbmluZyB0aGF0IHdlIGFyZSBvZmZsaW5lLCBoYW5kbGVzIHRoZSBzdGF0ZSB0cmFuc2l0aW9uIGFuZCBsb2dnaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jaGFuZ2VUb09mZmxpbmVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jaGFuZ2VUb09mZmxpbmUoKSB7XG4gICAgaWYgKHRoaXMuaXNPbmxpbmUpIHtcbiAgICAgIHRoaXMuaXNPbmxpbmUgPSBmYWxzZTtcbiAgICAgIHRoaXMudHJpZ2dlcignZGlzY29ubmVjdGVkJyk7XG4gICAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBDb25uZWN0aW9uIGxvc3QnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW5ldmVyIGEgd2Vic29ja2V0IGV2ZW50IGFycml2ZXMsIG9yIGFuIHhociBjYWxsIGNvbXBsZXRlczsgdXBkYXRlcyBvdXIgaXNPbmxpbmUgc3RhdGUuXG4gICAqXG4gICAqIEFueSBjYWxsIHRvIHRoaXMgbWV0aG9kIHdpbGwgcmVzY2hlZHVsZSBvdXIgbmV4dCBpcy1vbmxpbmUgdGVzdFxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uTGlzdGVuZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBldnQgLSBOYW1lIG9mIHRoZSBldmVudDsgZWl0aGVyICdjb25uZWN0aW9uOnN1Y2Nlc3MnIG9yICdjb25uZWN0aW9uOmVycm9yJ1xuICAgKi9cbiAgX2Nvbm5lY3Rpb25MaXN0ZW5lcihldnQpIHtcbiAgICAvLyBJZiBldmVudCBpcyBhIHN1Y2Nlc3MsIGNoYW5nZSB1cyB0byBvbmxpbmVcbiAgICBjb25zdCBmYWlsZWQgPSBldnQuc3RhdHVzICE9PSAnY29ubmVjdGlvbjpzdWNjZXNzJztcbiAgICBpZiAoIWZhaWxlZCkge1xuICAgICAgY29uc3QgbGFzdFRpbWUgPSB0aGlzLmxhc3RNZXNzYWdlVGltZTtcbiAgICAgIHRoaXMubGFzdE1lc3NhZ2VUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgIGlmICghdGhpcy5pc09ubGluZSkge1xuICAgICAgICB0aGlzLmlzT25saW5lID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5vZmZsaW5lQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkJywgeyBvZmZsaW5lRHVyYXRpb246IGxhc3RUaW1lID8gRGF0ZS5ub3coKSAtIGxhc3RUaW1lIDogMCB9KTtcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGVkQ291bnRlciA9PT0gdW5kZWZpbmVkKSB0aGlzLmNvbm5lY3RlZENvdW50ZXIgPSAwO1xuICAgICAgICB0aGlzLmNvbm5lY3RlZENvdW50ZXIrKztcbiAgICAgICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogQ29ubmVjdGVkIHJlc3RvcmVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fc2NoZWR1bGVOZXh0T25saW5lQ2hlY2soZmFpbGVkLCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdCkgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW51cC9zaHV0ZG93blxuICAgKlxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuICAgIHRoaXMuc29ja2V0TWFuYWdlciA9IG51bGw7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG59XG5cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUuaXNDbGllbnRSZWFkeSA9IGZhbHNlO1xuXG4vKipcbiAqIFVSTCBUbyBmaXJlIHdoZW4gdGVzdGluZyB0byBzZWUgaWYgd2UgYXJlIG9ubGluZS5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUudGVzdFVybCA9ICcnO1xuXG4vKipcbiAqIEEgV2Vic29ja2V0IG1hbmFnZXIgd2hvc2UgJ21lc3NhZ2UnIGV2ZW50IHdlIHdpbGwgbGlzdGVuIHRvXG4gKiBpbiBvcmRlciB0byBrbm93IHRoYXQgd2UgYXJlIHN0aWxsIG9ubGluZS5cbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUuc29ja2V0TWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogTnVtYmVyIG9mIHRlc3RVcmwgcmVxdWVzdHMgd2UndmUgYmVlbiBvZmZsaW5lIGZvci5cbiAqXG4gKiBXaWxsIHN0b3AgZ3Jvd2luZyBvbmNlIHRoZSBudW1iZXIgaXMgc3VpdGFibHkgbGFyZ2UgKDEwLTIwKS5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUub2ZmbGluZUNvdW50ZXIgPSAwO1xuXG4vKipcbiAqIE1heGltdW0gd2FpdCBkdXJpbmcgZXhwb25lbnRpYWwgYmFja29mZiB3aGlsZSBvZmZsaW5lLlxuICpcbiAqIFdoaWxlIG9mZmxpbmUsIGV4cG9uZW50aWFsIGJhY2tvZmYgaXMgdXNlZCB0byBjYWxjdWxhdGUgaG93IGxvbmcgdG8gd2FpdCBiZXR3ZWVuIGNoZWNraW5nIHdpdGggdGhlIHNlcnZlclxuICogdG8gc2VlIGlmIHdlIGFyZSBvbmxpbmUgYWdhaW4uIFRoaXMgdmFsdWUgZGV0ZXJtaW5lcyB0aGUgbWF4aW11bSB3YWl0OyBhbnkgaGlnaGVyIHZhbHVlIHJldHVybmVkIGJ5IGV4cG9uZW50aWFsIGJhY2tvZmZcbiAqIGFyZSBpZ25vcmVkIGFuZCB0aGlzIHZhbHVlIHVzZWQgaW5zdGVhZC5cbiAqIFZhbHVlIGlzIG1lYXN1cmVkIGluIHNlY29uZHMuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLm1heE9mZmxpbmVXYWl0ID0gNSAqIDYwO1xuXG4vKipcbiAqIE1pbmltdW0gd2FpdCBiZXR3ZWVuIHRyaWVzIGluIG1zLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5taW5CYWNrb2ZmV2FpdCA9IDEwMDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIGxhc3Qgc3VjY2Vzc2Z1bCBtZXNzYWdlIHdhcyBvYnNlcnZlZC5cbiAqIEB0eXBlIHtEYXRlfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLmxhc3RNZXNzYWdlVGltZSA9IG51bGw7XG5cbi8qKlxuICogRm9yIGRlYnVnZ2luZywgdHJhY2tzIHRoZSBsYXN0IHRpbWUgd2UgY2hlY2tlZCBpZiB3ZSBhcmUgb25saW5lLlxuICogQHR5cGUge0RhdGV9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUuX2xhc3RDaGVja09ubGluZVN0YXR1cyA9IG51bGw7XG5cbi8qKlxuICogQXJlIHdlIGN1cnJlbnRseSBvbmxpbmU/XG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5pc09ubGluZSA9IGZhbHNlO1xuXG4vKipcbiAqIHNldFRpbWVvdXRJZCBmb3IgdGhlIG5leHQgY2hlY2tPbmxpbmVTdGF0dXMoKSBjYWxsLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5vbmxpbmVDaGVja0lkID0gMDtcblxuLyoqXG4gKiBJZiB3ZSBhcmUgb25saW5lLCBob3cgb2Z0ZW4gZG8gd2UgbmVlZCB0byBwaW5nIHRvIHZlcmlmeSB3ZSBhcmUgc3RpbGwgb25saW5lLlxuICpcbiAqIFZhbHVlIGlzIHJlc2V0IGFueSB0aW1lIHdlIG9ic2VydmUgYW55IG1lc3NhZ2VzIGZyb20gdGhlIHNlcnZlci5cbiAqIE1lYXN1cmVkIGluIG1pbGlzZWNvbmRzLiBOT1RFOiBXZWJzb2NrZXQgaGFzIGEgc2VwYXJhdGUgcGluZyB3aGljaCBtb3N0bHkgbWFrZXNcbiAqIHRoaXMgb25lIHVubmVjZXNzYXJ5LiAgTWF5IGVuZCB1cCByZW1vdmluZyB0aGlzIG9uZS4uLiB0aG91Z2ggd2UnZCBrZWVwIHRoZVxuICogcGluZyBmb3Igd2hlbiBvdXIgc3RhdGUgaXMgb2ZmbGluZS5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUucGluZ0ZyZXF1ZW5jeSA9IDEwMCAqIDEwMDA7XG5cbk9ubGluZVN0YXRlTWFuYWdlci5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAvKipcbiAgICogV2UgYXBwZWFyIHRvIGJlIG9ubGluZSBhbmQgYWJsZSB0byBzZW5kIGFuZCByZWNlaXZlXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICogQHBhcmFtIHtudW1iZXJ9IG9ubGluZUR1cmF0aW9uIC0gTnVtYmVyIG9mIG1pbGlzZWNvbmRzIHNpbmNlIHdlIHdlcmUgbGFzdCBrbm93biB0byBiZSBvbmxpbmVcbiAgICovXG4gICdjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBXZSBhcHBlYXIgdG8gYmUgb2ZmbGluZSBhbmQgdW5hYmxlIHRvIHNlbmQgb3IgcmVjZWl2ZVxuICAgKiBAZXZlbnQgZGlzY29ubmVjdGVkXG4gICAqL1xuICAnZGlzY29ubmVjdGVkJyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShPbmxpbmVTdGF0ZU1hbmFnZXIsIFtPbmxpbmVTdGF0ZU1hbmFnZXIsICdPbmxpbmVTdGF0ZU1hbmFnZXInXSk7XG5tb2R1bGUuZXhwb3J0cyA9IE9ubGluZVN0YXRlTWFuYWdlcjtcbiJdfQ==
