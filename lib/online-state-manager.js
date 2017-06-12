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
 * 3. Any time there is a browser `online` or `offline` event, check to see if we can in fact reach the server.  Do not trust either event to be wholly accurate.
 *    We may be online, but still unable to reach any services.  And Chrome tabs in our tests have shown `navigator.onLine` to sometimes be `false` even while connected.
 * 4. Trigger events `connected` and `disconnected` to let the rest of the system know when we are/are not connected.
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
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {layer.Websockets.SocketManager} options.socketManager - A websocket manager to monitor for messages
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
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', _this._handleOnlineEvent.bind(_this));
      window.addEventListener('offline', _this._handleOnlineEvent.bind(_this));
    } else {
      var OnlineEvents = global.getNativeSupport('OnlineEvents');
      if (OnlineEvents) {
        OnlineEvents.addEventListener('change', _this._handleOnlineEvent.bind(_this));
      }
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
      if (!connectionFailure && this.isOnline) {
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
      var client = this.socketManager.client;

      logger.info('OnlineStateManager: Firing XHR for online check');
      this._lastCheckOnlineStatus = new Date();
      // Ping the server and see if we're connected.
      xhr({
        url: client.url + '/ping?client=' + client.constructor.version,
        method: 'HEAD',
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
 * A Websocket manager whose 'message' event we will listen to
 * in order to know that we are still online.
 * @type {layer.Websockets.SocketManager}
 */
OnlineStateManager.prototype.socketManager = null;

/**
 * Number of test requests we've been offline for.
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
OnlineStateManager.prototype.maxOfflineWait = 60;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9vbmxpbmUtc3RhdGUtbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsInhociIsImxvZ2dlciIsIlV0aWxzIiwiQUNDRVBUIiwiT25saW5lU3RhdGVNYW5hZ2VyIiwib3B0aW9ucyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsIl9jb25uZWN0aW9uTGlzdGVuZXIiLCJldnQiLCJzb2NrZXRNYW5hZ2VyIiwib24iLCJzdGF0dXMiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwiX2hhbmRsZU9ubGluZUV2ZW50IiwiYmluZCIsIk9ubGluZUV2ZW50cyIsImdsb2JhbCIsImdldE5hdGl2ZVN1cHBvcnQiLCJpbmZvIiwiaXNDbGllbnRSZWFkeSIsImlzT25saW5lIiwiY2hlY2tPbmxpbmVTdGF0dXMiLCJfY2xlYXJDaGVjayIsIl9jaGFuZ2VUb09mZmxpbmUiLCJjb25uZWN0aW9uRmFpbHVyZSIsImNhbGxiYWNrIiwiZGVidWciLCJpc0Rlc3Ryb3llZCIsIm9ubGluZUNoZWNrSWQiLCJzZXRUaW1lb3V0IiwiX29ubGluZUV4cGlyZWQiLCJwaW5nRnJlcXVlbmN5IiwiZHVyYXRpb24iLCJnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIiwibWF4T2ZmbGluZVdhaXQiLCJNYXRoIiwibWluIiwib2ZmbGluZUNvdW50ZXIiLCJmbG9vciIsImNsZWFyVGltZW91dCIsIl9zY2hlZHVsZU5leHRPbmxpbmVDaGVjayIsImNsaWVudCIsIl9sYXN0Q2hlY2tPbmxpbmVTdGF0dXMiLCJEYXRlIiwidXJsIiwiY29uc3RydWN0b3IiLCJ2ZXJzaW9uIiwibWV0aG9kIiwiaGVhZGVycyIsImFjY2VwdCIsInRyaWdnZXIiLCJmYWlsZWQiLCJsYXN0VGltZSIsImxhc3RNZXNzYWdlVGltZSIsIm9mZmxpbmVEdXJhdGlvbiIsIm5vdyIsImNvbm5lY3RlZENvdW50ZXIiLCJ1bmRlZmluZWQiLCJyZXN1bHQiLCJwcm90b3R5cGUiLCJtaW5CYWNrb2ZmV2FpdCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyQkEsSUFBTUEsT0FBT0MsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNQyxNQUFNRCxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQU1FLFNBQVNGLFFBQVEsVUFBUixDQUFmO0FBQ0EsSUFBTUcsUUFBUUgsUUFBUSxnQkFBUixDQUFkOztlQUNtQkEsUUFBUSxTQUFSLEM7SUFBWEksTSxZQUFBQSxNOztJQUVGQyxrQjs7O0FBQ0o7Ozs7Ozs7Ozs7Ozs7QUFhQSw4QkFBWUMsT0FBWixFQUFxQjtBQUFBOztBQUduQjtBQUhtQix3SUFDYkEsT0FEYTs7QUFJbkJMLFFBQUlNLHFCQUFKLENBQTBCO0FBQUEsYUFBTyxNQUFLQyxtQkFBTCxDQUF5QkMsR0FBekIsQ0FBUDtBQUFBLEtBQTFCO0FBQ0EsVUFBS0MsYUFBTCxDQUFtQkMsRUFBbkIsQ0FBc0IsU0FBdEIsRUFBaUM7QUFBQSxhQUFNLE1BQUtILG1CQUFMLENBQXlCLEVBQUVJLFFBQVEsb0JBQVYsRUFBekIsQ0FBTjtBQUFBLEtBQWpDOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQUssT0FBT0MsTUFBUCxLQUFrQixXQUFuQixJQUFtQ0EsT0FBT0MsZ0JBQTlDLEVBQWdFO0FBQzlERCxhQUFPQyxnQkFBUCxDQUF3QixRQUF4QixFQUFrQyxNQUFLQyxrQkFBTCxDQUF3QkMsSUFBeEIsT0FBbEM7QUFDQUgsYUFBT0MsZ0JBQVAsQ0FBd0IsU0FBeEIsRUFBbUMsTUFBS0Msa0JBQUwsQ0FBd0JDLElBQXhCLE9BQW5DO0FBQ0QsS0FIRCxNQUdPO0FBQ0wsVUFBTUMsZUFBZUMsT0FBT0MsZ0JBQVAsQ0FBd0IsY0FBeEIsQ0FBckI7QUFDQSxVQUFJRixZQUFKLEVBQWtCO0FBQ2hCQSxxQkFBYUgsZ0JBQWIsQ0FBOEIsUUFBOUIsRUFB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d0QsU0FBbkIsQ0FBNkJDLGNBQTdCLEdBQThDLEdBQTlDOztBQUVBOzs7O0FBSUF6RCxtQkFBbUJ3RCxTQUFuQixDQUE2Qk4sZUFBN0IsR0FBK0MsSUFBL0M7O0FBRUE7Ozs7QUFJQWxELG1CQUFtQndELFNBQW5CLENBQTZCakIsc0JBQTdCLEdBQXNELElBQXREOztBQUVBOzs7O0FBSUF2QyxtQkFBbUJ3RCxTQUFuQixDQUE2QnZDLFFBQTdCLEdBQXdDLEtBQXhDOztBQUVBOzs7O0FBSUFqQixtQkFBbUJ3RCxTQUFuQixDQUE2Qi9CLGFBQTdCLEdBQTZDLENBQTdDOztBQUVBOzs7Ozs7Ozs7QUFTQXpCLG1CQUFtQndELFNBQW5CLENBQTZCNUIsYUFBN0IsR0FBNkMsTUFBTSxJQUFuRDs7QUFFQTVCLG1CQUFtQjBELGdCQUFuQixHQUFzQztBQUNwQzs7Ozs7QUFLQSxXQU5vQzs7QUFRcEM7Ozs7QUFJQSxjQVpvQyxFQWFwQ0MsTUFib0MsQ0FhN0JqRSxLQUFLZ0UsZ0JBYndCLENBQXRDO0FBY0FoRSxLQUFLa0UsU0FBTCxDQUFlQyxLQUFmLENBQXFCN0Qsa0JBQXJCLEVBQXlDLENBQUNBLGtCQUFELEVBQXFCLG9CQUFyQixDQUF6QztBQUNBOEQsT0FBT0MsT0FBUCxHQUFpQi9ELGtCQUFqQiIsImZpbGUiOiJvbmxpbmUtc3RhdGUtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhpcyBjbGFzcyBtYW5hZ2VzIGEgc3RhdGUgdmFyaWFibGUgZm9yIHdoZXRoZXIgd2UgYXJlIG9ubGluZS9vZmZsaW5lLCB0cmlnZ2VycyBldmVudHNcbiAqIHdoZW4gdGhlIHN0YXRlIGNoYW5nZXMsIGFuZCBkZXRlcm1pbmVzIHdoZW4gdG8gcGVyZm9ybSB0ZXN0cyB0byB2YWxpZGF0ZSBvdXIgb25saW5lIHN0YXR1cy5cbiAqXG4gKiBJdCBwZXJmb3JtcyB0aGUgZm9sbG93aW5nIHRhc2tzOlxuICpcbiAqIDEuIEFueSB0aW1lIHdlIGdvIG1vcmUgdGhhbiB0aGlzLnBpbmdGcmVxdWVuY3kgKDEwMCBzZWNvbmRzKSB3aXRob3V0IGFueSBkYXRhIGZyb20gdGhlIHNlcnZlciwgZmxhZyB1cyBhcyBiZWluZyBvZmZsaW5lLlxuICogICAgUmF0aW9uYWxlOiBUaGUgd2Vic29ja2V0IG1hbmFnZXIgaXMgY2FsbGluZyBgZ2V0Q291bnRlcmAgZXZlcnkgMzAgc2Vjb25kczsgc28gaXQgd291bGQgaGF2ZSBoYWQgdG8gZmFpbCB0byBnZXQgYW55IHJlc3BvbnNlXG4gKiAgICAzIHRpbWVzIGJlZm9yZSB3ZSBnaXZlIHVwLlxuICogMi4gV2hpbGUgd2UgYXJlIG9mZmxpbmUsIHBpbmcgdGhlIHNlcnZlciB1bnRpbCB3ZSBkZXRlcm1pbmUgd2UgYXJlIGluIGZhY3QgYWJsZSB0byBjb25uZWN0IHRvIHRoZSBzZXJ2ZXJcbiAqIDMuIEFueSB0aW1lIHRoZXJlIGlzIGEgYnJvd3NlciBgb25saW5lYCBvciBgb2ZmbGluZWAgZXZlbnQsIGNoZWNrIHRvIHNlZSBpZiB3ZSBjYW4gaW4gZmFjdCByZWFjaCB0aGUgc2VydmVyLiAgRG8gbm90IHRydXN0IGVpdGhlciBldmVudCB0byBiZSB3aG9sbHkgYWNjdXJhdGUuXG4gKiAgICBXZSBtYXkgYmUgb25saW5lLCBidXQgc3RpbGwgdW5hYmxlIHRvIHJlYWNoIGFueSBzZXJ2aWNlcy4gIEFuZCBDaHJvbWUgdGFicyBpbiBvdXIgdGVzdHMgaGF2ZSBzaG93biBgbmF2aWdhdG9yLm9uTGluZWAgdG8gc29tZXRpbWVzIGJlIGBmYWxzZWAgZXZlbiB3aGlsZSBjb25uZWN0ZWQuXG4gKiA0LiBUcmlnZ2VyIGV2ZW50cyBgY29ubmVjdGVkYCBhbmQgYGRpc2Nvbm5lY3RlZGAgdG8gbGV0IHRoZSByZXN0IG9mIHRoZSBzeXN0ZW0ga25vdyB3aGVuIHdlIGFyZS9hcmUgbm90IGNvbm5lY3RlZC5cbiAqICAgIE5PVEU6IFRoZSBXZWJzb2NrZXQgbWFuYWdlciB3aWxsIHVzZSB0aGF0IHRvIHJlY29ubmVjdCBpdHMgd2Vic29ja2V0LCBhbmQgcmVzdW1lIGl0cyBgZ2V0Q291bnRlcmAgY2FsbCBldmVyeSAzMCBzZWNvbmRzLlxuICpcbiAqIE5PVEU6IEFwcHMgdGhhdCB3YW50IHRvIGJlIG5vdGlmaWVkIG9mIGNoYW5nZXMgdG8gb25saW5lL29mZmxpbmUgc3RhdGUgc2hvdWxkIHNlZSBsYXllci5DbGllbnQncyBgb25saW5lYCBldmVudC5cbiAqXG4gKiBOT1RFOiBPbmUgaXRlcmF0aW9uIG9mIHRoaXMgY2xhc3MgdHJlYXRlZCBuYXZpZ2F0b3Iub25MaW5lID0gZmFsc2UgYXMgZmFjdC4gIElmIG9uTGluZSBpcyBmYWxzZSwgdGhlbiB3ZSBkb24ndCBuZWVkIHRvIHRlc3RcbiAqIGFueXRoaW5nLiAgSWYgaXRzIHRydWUsIHRoZW4gdGhpcyBjbGFzcyB2ZXJpZmllcyBpdCBjYW4gcmVhY2ggbGF5ZXIncyBzZXJ2ZXJzLiAgSG93ZXZlciwgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTI3NzM3MiBoYXMgcmVwbGljYXRlZCBtdWx0aXBsZSB0aW1lcyBpbiBjaHJvbWU7IHRoaXMgYnVnIGNhdXNlcyBvbmUgdGFiIG9mIGNocm9tZSB0byBoYXZlIG5hdmlnYXRvci5vbkxpbmU9ZmFsc2Ugd2hpbGUgYWxsIG90aGVyIHRhYnNcbiAqIGNvcnJlY3RseSByZXBvcnQgbmF2aWdhdG9yLm9uTGluZT10cnVlLiAgQXMgYSByZXN1bHQsIHdlIGNhbid0IHJlbHkgb24gdGhpcyB2YWx1ZSBhbmQgdGhpcyBjbGFzcyBtdXN0IGNvbnRpbnVlIHRvIHBvbGwgdGhlIHNlcnZlciB3aGlsZVxuICogb2ZmbGluZSBhbmQgdG8gaWdub3JlIHZhbHVlcyBmcm9tIG5hdmlnYXRvci5vbkxpbmUuICBGdXR1cmUgV29yazogQWxsb3cgbm9uLWNocm9tZSBicm93c2VycyB0byB1c2UgbmF2aWdhdG9yLm9uTGluZS5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLk9ubGluZVN0YXRlTWFuYWdlclxuICogQHByaXZhdGVcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqXG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuY29uc3QgeyBBQ0NFUFQgfSA9IHJlcXVpcmUoJy4vY29uc3QnKTtcblxuY2xhc3MgT25saW5lU3RhdGVNYW5hZ2VyIGV4dGVuZHMgUm9vdCB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IE9ubGluZVN0YXRlTWFuYWdlci5cbiAgICpcbiAgICogQW4gQXBwbGljYXRpb24gaXMgZXhwZWN0ZWQgdG8gb25seSBoYXZlIG9uZSBvZiB0aGVzZS5cbiAgICpcbiAgICogICAgICB2YXIgb25saW5lU3RhdGVNYW5hZ2VyID0gbmV3IGxheWVyLk9ubGluZVN0YXRlTWFuYWdlcih7XG4gICAqICAgICAgICAgIHNvY2tldE1hbmFnZXI6IHNvY2tldE1hbmFnZXIsXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn0gb3B0aW9ucy5zb2NrZXRNYW5hZ2VyIC0gQSB3ZWJzb2NrZXQgbWFuYWdlciB0byBtb25pdG9yIGZvciBtZXNzYWdlc1xuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gTGlzdGVuIHRvIGFsbCB4aHIgZXZlbnRzIGFuZCB3ZWJzb2NrZXQgbWVzc2FnZXMgZm9yIG9ubGluZS1zdGF0dXMgaW5mb1xuICAgIHhoci5hZGRDb25uZWN0aW9uTGlzdGVuZXIoZXZ0ID0+IHRoaXMuX2Nvbm5lY3Rpb25MaXN0ZW5lcihldnQpKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIub24oJ21lc3NhZ2UnLCAoKSA9PiB0aGlzLl9jb25uZWN0aW9uTGlzdGVuZXIoeyBzdGF0dXM6ICdjb25uZWN0aW9uOnN1Y2Nlc3MnIH0pLCB0aGlzKTtcblxuICAgIC8vIEFueSBjaGFuZ2UgaW4gb25saW5lIHN0YXR1cyByZXBvcnRlZCBieSB0aGUgYnJvd3NlciBzaG91bGQgcmVzdWx0IGluXG4gICAgLy8gYW4gaW1tZWRpYXRlIHVwZGF0ZSB0byBvdXIgb25saW5lL29mZmxpbmUgc3RhdGVcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICgodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb25saW5lJywgdGhpcy5faGFuZGxlT25saW5lRXZlbnQuYmluZCh0aGlzKSk7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb2ZmbGluZScsIHRoaXMuX2hhbmRsZU9ubGluZUV2ZW50LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBPbmxpbmVFdmVudHMgPSBnbG9iYWwuZ2V0TmF0aXZlU3VwcG9ydCgnT25saW5lRXZlbnRzJyk7XG4gICAgICBpZiAoT25saW5lRXZlbnRzKSB7XG4gICAgICAgIE9ubGluZUV2ZW50cy5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9oYW5kbGVPbmxpbmVFdmVudC5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2UgZG9uJ3QgYWN0dWFsbHkgc3RhcnQgbWFuYWdpbmcgb3VyIG9ubGluZSBzdGF0ZSB1bnRpbCBhZnRlciB0aGUgY2xpZW50IGhhcyBhdXRoZW50aWNhdGVkLlxuICAgKiBDYWxsIHN0YXJ0KCkgd2hlbiB3ZSBhcmUgcmVhZHkgZm9yIHRoZSBjbGllbnQgdG8gc3RhcnQgbWFuYWdpbmcgb3VyIHN0YXRlLlxuICAgKlxuICAgKiBUaGUgY2xpZW50IHdvbid0IGNhbGwgc3RhcnQoKSB3aXRob3V0IGZpcnN0IHZhbGlkYXRpbmcgdGhhdCB3ZSBoYXZlIGEgdmFsaWQgc2Vzc2lvbiwgc28gYnkgZGVmaW5pdGlvbixcbiAgICogY2FsbGluZyBzdGFydCBtZWFucyB3ZSBhcmUgb25saW5lLlxuICAgKlxuICAgKiBAbWV0aG9kIHN0YXJ0XG4gICAqL1xuICBzdGFydCgpIHtcbiAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBzdGFydCcpO1xuICAgIHRoaXMuaXNDbGllbnRSZWFkeSA9IHRydWU7XG4gICAgdGhpcy5pc09ubGluZSA9IHRydWU7XG5cbiAgICB0aGlzLmNoZWNrT25saW5lU3RhdHVzKCk7XG4gIH1cblxuICAvKipcbiAgICogSWYgdGhlIGNsaWVudCBiZWNvbWVzIHVuYXV0aGVudGljYXRlZCwgc3RvcCBjaGVja2luZyBpZiB3ZSBhcmUgb25saW5lLCBhbmQgYW5ub3VuY2UgdGhhdCB3ZSBhcmUgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBzdG9wXG4gICAqL1xuICBzdG9wKCkge1xuICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IHN0b3AnKTtcbiAgICB0aGlzLmlzQ2xpZW50UmVhZHkgPSBmYWxzZTtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZXMgb3VyIG5leHQgY2FsbCB0byBfb25saW5lRXhwaXJlZCBpZiBvbmxpbmUgb3IgY2hlY2tPbmxpbmVTdGF0dXMgaWYgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVOZXh0T25saW5lQ2hlY2tcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZU5leHRPbmxpbmVDaGVjayhjb25uZWN0aW9uRmFpbHVyZSwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIuZGVidWcoJ09ubGluZVN0YXRlTWFuYWdlcjogc2tpcCBzY2hlZHVsZScpO1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLmlzQ2xpZW50UmVhZHkpIHJldHVybjtcblxuICAgIC8vIFJlcGxhY2UgYW55IHNjaGVkdWxlZCBjYWxscyB3aXRoIHRoZSBuZXdseSBzY2hlZHVsZWQgY2FsbDpcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGNhbGxlZCB3aGlsZSB3ZSBhcmUgb25saW5lLCB0aGVuIHdlIGFyZSB1c2luZyB0aGlzIHRvIGRldGVjdCB3aGVuIHdlJ3ZlIGdvbmUgd2l0aG91dCBkYXRhIGZvciBtb3JlIHRoYW4gcGluZ0ZyZXF1ZW5jeS5cbiAgICAvLyBDYWxsIHRoaXMuX29ubGluZUV4cGlyZWQgYWZ0ZXIgcGluZ0ZyZXF1ZW5jeSBvZiBubyBzZXJ2ZXIgcmVzcG9uc2VzLlxuICAgIGlmICghY29ubmVjdGlvbkZhaWx1cmUgJiYgdGhpcy5pc09ubGluZSkge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IFNjaGVkdWxlZCBvbmxpbmVFeHBpcmVkJyk7XG4gICAgICB0aGlzLm9ubGluZUNoZWNrSWQgPSBzZXRUaW1lb3V0KHRoaXMuX29ubGluZUV4cGlyZWQuYmluZCh0aGlzKSwgdGhpcy5waW5nRnJlcXVlbmN5KTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGNhbGxlZCB3aGlsZSB3ZSBhcmUgb2ZmbGluZSwgd2UncmUgZG9pbmcgZXhwb25lbnRpYWwgYmFja29mZiBwaW5naW5nIHRoZSBzZXJ2ZXIgdG8gc2VlIGlmIHdlJ3ZlIGNvbWUgYmFjayBvbmxpbmUuXG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBTY2hlZHVsZWQgY2hlY2tPbmxpbmVTdGF0dXMnKTtcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyh0aGlzLm1heE9mZmxpbmVXYWl0LCBNYXRoLm1pbigxMCwgdGhpcy5vZmZsaW5lQ291bnRlcisrKSk7XG4gICAgICB0aGlzLm9ubGluZUNoZWNrSWQgPSBzZXRUaW1lb3V0KHRoaXMuY2hlY2tPbmxpbmVTdGF0dXMuYmluZCh0aGlzLCBjYWxsYmFjayksIE1hdGguZmxvb3IoZHVyYXRpb24gKiAxMDAwKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbmNlbHMgYW55IHVwY29taW5nIGNhbGxzIHRvIGNoZWNrT25saW5lU3RhdHVzXG4gICAqXG4gICAqIEBtZXRob2QgX2NsZWFyQ2hlY2tcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jbGVhckNoZWNrKCkge1xuICAgIGlmICh0aGlzLm9ubGluZUNoZWNrSWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLm9ubGluZUNoZWNrSWQpO1xuICAgICAgdGhpcy5vbmxpbmVDaGVja0lkID0gMDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzcG9uZCB0byB0aGUgYnJvd3NlcidzIG9ubGluZS9vZmZsaW5lIGV2ZW50cy5cbiAgICpcbiAgICogT3VyIHJlc3BvbnNlIGlzIG5vdCB0byB0cnVzdCB0aGVtLCBidXQgdG8gdXNlIHRoZW0gYXNcbiAgICogYSB0cmlnZ2VyIHRvIGluZGljYXRlIHdlIHNob3VsZCBpbW1lZGlhdGVseSBkbyBvdXIgb3duXG4gICAqIHZhbGlkYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZU9ubGluZUV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge0V2ZW50fSBldnQgLSBCcm93c2VyIG9ubGluZS9vZmZsaW5lIGV2ZW50IG9iamVjdFxuICAgKi9cbiAgX2hhbmRsZU9ubGluZUV2ZW50KGV2dCkge1xuICAgIC8vIFJlc2V0IHRoZSBjb3VudGVyIGJlY2F1c2Ugb3VyIGZpcnN0IHJlcXVlc3QgbWF5IGZhaWwgYXMgdGhleSBtYXkgbm90IGJlXG4gICAgLy8gZnVsbHkgY29ubmVjdGVkIHlldFxuICAgIHRoaXMub2ZmbGluZUNvdW50ZXIgPSAwO1xuICAgIHRoaXMuY2hlY2tPbmxpbmVTdGF0dXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPdXIgb25saW5lIHN0YXRlIGhhcyBleHBpcmVkOyB3ZSBhcmUgbm93IG9mZmxpbmUuXG4gICAqXG4gICAqIElmIHRoaXMgbWV0aG9kIGdldHMgY2FsbGVkLCBpdCBtZWFucyB0aGF0IG91ciBjb25uZWN0aW9uIGhhcyBnb25lIHRvbyBsb25nIHdpdGhvdXQgYW55IGRhdGFcbiAgICogYW5kIGlzIG5vdyBjb25zaWRlcmVkIHRvIGJlIGRpc2Nvbm5lY3RlZC4gIFN0YXJ0IHNjaGVkdWxpbmcgdGVzdHMgdG8gc2VlIHdoZW4gd2UgYXJlIGJhY2sgb25saW5lLlxuICAgKlxuICAgKiBAbWV0aG9kIF9vbmxpbmVFeHBpcmVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfb25saW5lRXhwaXJlZCgpIHtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gICAgdGhpcy5fc2NoZWR1bGVOZXh0T25saW5lQ2hlY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBub25jZSB0byBzZWUgaWYgd2UgY2FuIHJlYWNoIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHJlc3VsdCxcbiAgICogd2UganVzdCBjYXJlIGFib3V0IHRyaWdnZXJpbmcgYSAnY29ubmVjdGlvbjpzdWNjZXNzJyBvciAnY29ubmVjdGlvbjplcnJvcicgZXZlbnRcbiAgICogd2hpY2ggY29ubmVjdGlvbkxpc3RlbmVyIHdpbGwgcmVzcG9uZCB0by5cbiAgICpcbiAgICogICAgICBjbGllbnQub25saW5lTWFuYWdlci5jaGVja09ubGluZVN0YXR1cyhmdW5jdGlvbihyZXN1bHQpIHtcbiAgICogICAgICAgICAgYWxlcnQocmVzdWx0ID8gJ1dlJ3JlIG9ubGluZSEnIDogJ0RvaCEnKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBjaGVja09ubGluZVN0YXR1c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGNhbGxiYWNrLmlzT25saW5lIC0gQ2FsbGJhY2sgaXMgY2FsbGVkIHdpdGggdHJ1ZSBpZiBvbmxpbmUsIGZhbHNlIGlmIG5vdFxuICAgKi9cbiAgY2hlY2tPbmxpbmVTdGF0dXMoY2FsbGJhY2spIHtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5zb2NrZXRNYW5hZ2VyLmNsaWVudDtcblxuICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IEZpcmluZyBYSFIgZm9yIG9ubGluZSBjaGVjaycpO1xuICAgIHRoaXMuX2xhc3RDaGVja09ubGluZVN0YXR1cyA9IG5ldyBEYXRlKCk7XG4gICAgLy8gUGluZyB0aGUgc2VydmVyIGFuZCBzZWUgaWYgd2UncmUgY29ubmVjdGVkLlxuICAgIHhocih7XG4gICAgICB1cmw6IGAke2NsaWVudC51cmx9L3Bpbmc/Y2xpZW50PSR7Y2xpZW50LmNvbnN0cnVjdG9yLnZlcnNpb259YCxcbiAgICAgIG1ldGhvZDogJ0hFQUQnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBhY2NlcHQ6IEFDQ0VQVCxcbiAgICAgIH0sXG4gICAgfSwgKHsgc3RhdHVzIH0pID0+IHtcbiAgICAgIC8vIHRoaXMuaXNPbmxpbmUgd2lsbCBiZSB1cGRhdGVkIHZpYSBfY29ubmVjdGlvbkxpc3RlbmVyIHByaW9yIHRvIHRoaXMgbGluZSBleGVjdXRpbmdcbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soc3RhdHVzICE9PSA0MDgpO1xuICAgIH0pO1xuICB9XG5cblxuICAvKipcbiAgICogT24gZGV0ZXJtaW5pbmcgdGhhdCB3ZSBhcmUgb2ZmbGluZSwgaGFuZGxlcyB0aGUgc3RhdGUgdHJhbnNpdGlvbiBhbmQgbG9nZ2luZy5cbiAgICpcbiAgICogQG1ldGhvZCBfY2hhbmdlVG9PZmZsaW5lXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2hhbmdlVG9PZmZsaW5lKCkge1xuICAgIGlmICh0aGlzLmlzT25saW5lKSB7XG4gICAgICB0aGlzLmlzT25saW5lID0gZmFsc2U7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogQ29ubmVjdGlvbiBsb3N0Jyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuZXZlciBhIHdlYnNvY2tldCBldmVudCBhcnJpdmVzLCBvciBhbiB4aHIgY2FsbCBjb21wbGV0ZXM7IHVwZGF0ZXMgb3VyIGlzT25saW5lIHN0YXRlLlxuICAgKlxuICAgKiBBbnkgY2FsbCB0byB0aGlzIG1ldGhvZCB3aWxsIHJlc2NoZWR1bGUgb3VyIG5leHQgaXMtb25saW5lIHRlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkxpc3RlbmVyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZ0IC0gTmFtZSBvZiB0aGUgZXZlbnQ7IGVpdGhlciAnY29ubmVjdGlvbjpzdWNjZXNzJyBvciAnY29ubmVjdGlvbjplcnJvcidcbiAgICovXG4gIF9jb25uZWN0aW9uTGlzdGVuZXIoZXZ0KSB7XG4gICAgLy8gSWYgZXZlbnQgaXMgYSBzdWNjZXNzLCBjaGFuZ2UgdXMgdG8gb25saW5lXG4gICAgY29uc3QgZmFpbGVkID0gZXZ0LnN0YXR1cyAhPT0gJ2Nvbm5lY3Rpb246c3VjY2Vzcyc7XG4gICAgaWYgKCFmYWlsZWQpIHtcbiAgICAgIGNvbnN0IGxhc3RUaW1lID0gdGhpcy5sYXN0TWVzc2FnZVRpbWU7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlVGltZSA9IG5ldyBEYXRlKCk7XG4gICAgICBpZiAoIXRoaXMuaXNPbmxpbmUpIHtcbiAgICAgICAgdGhpcy5pc09ubGluZSA9IHRydWU7XG4gICAgICAgIHRoaXMub2ZmbGluZUNvdW50ZXIgPSAwO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcsIHsgb2ZmbGluZUR1cmF0aW9uOiBsYXN0VGltZSA/IERhdGUubm93KCkgLSBsYXN0VGltZSA6IDAgfSk7XG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3RlZENvdW50ZXIgPT09IHVuZGVmaW5lZCkgdGhpcy5jb25uZWN0ZWRDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5jb25uZWN0ZWRDb3VudGVyKys7XG4gICAgICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IENvbm5lY3RlZCByZXN0b3JlZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX3NjaGVkdWxlTmV4dE9ubGluZUNoZWNrKGZhaWxlZCwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQpIHRoaXMuX2NoYW5nZVRvT2ZmbGluZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAvc2h1dGRvd25cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuX2NsZWFyQ2hlY2soKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxufVxuXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLmlzQ2xpZW50UmVhZHkgPSBmYWxzZTtcblxuLyoqXG4gKiBBIFdlYnNvY2tldCBtYW5hZ2VyIHdob3NlICdtZXNzYWdlJyBldmVudCB3ZSB3aWxsIGxpc3RlbiB0b1xuICogaW4gb3JkZXIgdG8ga25vdyB0aGF0IHdlIGFyZSBzdGlsbCBvbmxpbmUuXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIE51bWJlciBvZiB0ZXN0IHJlcXVlc3RzIHdlJ3ZlIGJlZW4gb2ZmbGluZSBmb3IuXG4gKlxuICogV2lsbCBzdG9wIGdyb3dpbmcgb25jZSB0aGUgbnVtYmVyIGlzIHN1aXRhYmx5IGxhcmdlICgxMC0yMCkuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLm9mZmxpbmVDb3VudGVyID0gMDtcblxuLyoqXG4gKiBNYXhpbXVtIHdhaXQgZHVyaW5nIGV4cG9uZW50aWFsIGJhY2tvZmYgd2hpbGUgb2ZmbGluZS5cbiAqXG4gKiBXaGlsZSBvZmZsaW5lLCBleHBvbmVudGlhbCBiYWNrb2ZmIGlzIHVzZWQgdG8gY2FsY3VsYXRlIGhvdyBsb25nIHRvIHdhaXQgYmV0d2VlbiBjaGVja2luZyB3aXRoIHRoZSBzZXJ2ZXJcbiAqIHRvIHNlZSBpZiB3ZSBhcmUgb25saW5lIGFnYWluLiBUaGlzIHZhbHVlIGRldGVybWluZXMgdGhlIG1heGltdW0gd2FpdDsgYW55IGhpZ2hlciB2YWx1ZSByZXR1cm5lZCBieSBleHBvbmVudGlhbCBiYWNrb2ZmXG4gKiBhcmUgaWdub3JlZCBhbmQgdGhpcyB2YWx1ZSB1c2VkIGluc3RlYWQuXG4gKiBWYWx1ZSBpcyBtZWFzdXJlZCBpbiBzZWNvbmRzLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5tYXhPZmZsaW5lV2FpdCA9IDYwO1xuXG4vKipcbiAqIE1pbmltdW0gd2FpdCBiZXR3ZWVuIHRyaWVzIGluIG1zLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5taW5CYWNrb2ZmV2FpdCA9IDEwMDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIGxhc3Qgc3VjY2Vzc2Z1bCBtZXNzYWdlIHdhcyBvYnNlcnZlZC5cbiAqIEB0eXBlIHtEYXRlfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLmxhc3RNZXNzYWdlVGltZSA9IG51bGw7XG5cbi8qKlxuICogRm9yIGRlYnVnZ2luZywgdHJhY2tzIHRoZSBsYXN0IHRpbWUgd2UgY2hlY2tlZCBpZiB3ZSBhcmUgb25saW5lLlxuICogQHR5cGUge0RhdGV9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUuX2xhc3RDaGVja09ubGluZVN0YXR1cyA9IG51bGw7XG5cbi8qKlxuICogQXJlIHdlIGN1cnJlbnRseSBvbmxpbmU/XG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5pc09ubGluZSA9IGZhbHNlO1xuXG4vKipcbiAqIHNldFRpbWVvdXRJZCBmb3IgdGhlIG5leHQgY2hlY2tPbmxpbmVTdGF0dXMoKSBjYWxsLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5vbmxpbmVDaGVja0lkID0gMDtcblxuLyoqXG4gKiBJZiB3ZSBhcmUgb25saW5lLCBob3cgb2Z0ZW4gZG8gd2UgbmVlZCB0byBwaW5nIHRvIHZlcmlmeSB3ZSBhcmUgc3RpbGwgb25saW5lLlxuICpcbiAqIFZhbHVlIGlzIHJlc2V0IGFueSB0aW1lIHdlIG9ic2VydmUgYW55IG1lc3NhZ2VzIGZyb20gdGhlIHNlcnZlci5cbiAqIE1lYXN1cmVkIGluIG1pbGlzZWNvbmRzLiBOT1RFOiBXZWJzb2NrZXQgaGFzIGEgc2VwYXJhdGUgcGluZyB3aGljaCBtb3N0bHkgbWFrZXNcbiAqIHRoaXMgb25lIHVubmVjZXNzYXJ5LiAgTWF5IGVuZCB1cCByZW1vdmluZyB0aGlzIG9uZS4uLiB0aG91Z2ggd2UnZCBrZWVwIHRoZVxuICogcGluZyBmb3Igd2hlbiBvdXIgc3RhdGUgaXMgb2ZmbGluZS5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUucGluZ0ZyZXF1ZW5jeSA9IDEwMCAqIDEwMDA7XG5cbk9ubGluZVN0YXRlTWFuYWdlci5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAvKipcbiAgICogV2UgYXBwZWFyIHRvIGJlIG9ubGluZSBhbmQgYWJsZSB0byBzZW5kIGFuZCByZWNlaXZlXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICogQHBhcmFtIHtudW1iZXJ9IG9ubGluZUR1cmF0aW9uIC0gTnVtYmVyIG9mIG1pbGlzZWNvbmRzIHNpbmNlIHdlIHdlcmUgbGFzdCBrbm93biB0byBiZSBvbmxpbmVcbiAgICovXG4gICdjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBXZSBhcHBlYXIgdG8gYmUgb2ZmbGluZSBhbmQgdW5hYmxlIHRvIHNlbmQgb3IgcmVjZWl2ZVxuICAgKiBAZXZlbnQgZGlzY29ubmVjdGVkXG4gICAqL1xuICAnZGlzY29ubmVjdGVkJyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShPbmxpbmVTdGF0ZU1hbmFnZXIsIFtPbmxpbmVTdGF0ZU1hbmFnZXIsICdPbmxpbmVTdGF0ZU1hbmFnZXInXSk7XG5tb2R1bGUuZXhwb3J0cyA9IE9ubGluZVN0YXRlTWFuYWdlcjtcbiJdfQ==
