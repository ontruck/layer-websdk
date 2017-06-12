'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This component manages
 *
 * 1. recieving websocket events
 * 2. Processing them
 * 3. Triggering events on completing them
 * 4. Sending them
 *
 * Applications typically do not interact with this component, but may subscribe
 * to the `message` event if they want richer event information than is available
 * through the layer.Client class.
 *
 * @class  layer.Websockets.SocketManager
 * @extends layer.Root
 * @private
 */
var Root = require('../root');
var Utils = require('../client-utils');
var logger = require('../logger');

var _require = require('../const'),
    WEBSOCKET_PROTOCOL = _require.WEBSOCKET_PROTOCOL;

var SocketManager = function (_Root) {
  _inherits(SocketManager, _Root);

  /**
   * Create a new websocket manager
   *
   *      var socketManager = new layer.Websockets.SocketManager({
   *          client: client,
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @return {layer.Websockets.SocketManager}
   */
  function SocketManager(options) {
    _classCallCheck(this, SocketManager);

    var _this = _possibleConstructorReturn(this, (SocketManager.__proto__ || Object.getPrototypeOf(SocketManager)).call(this, options));

    if (!_this.client) throw new Error('SocketManager requires a client');

    // Insure that on/off methods don't need to call bind, therefore making it easy
    // to add/remove functions as event listeners.
    _this._onMessage = _this._onMessage.bind(_this);
    _this._onOpen = _this._onOpen.bind(_this);
    _this._onSocketClose = _this._onSocketClose.bind(_this);
    _this._onError = _this._onError.bind(_this);

    // If the client is authenticated, start it up.
    if (_this.client.isAuthenticated && _this.client.onlineManager.isOnline) {
      _this.connect();
    }

    _this.client.on('online', _this._onlineStateChange, _this);

    // Any time the Client triggers a ready event we need to reconnect.
    _this.client.on('authenticated', _this.connect, _this);

    _this._lastTimestamp = Date.now();
    return _this;
  }

  /**
   * Call this when we want to reset all websocket state; this would be done after a lengthy period
   * of being disconnected.  This prevents Event.replay from being called on reconnecting.
   *
   * @method _reset
   * @private
   */


  _createClass(SocketManager, [{
    key: '_reset',
    value: function _reset() {
      this._lastTimestamp = 0;
      this._lastDataFromServerTimestamp = 0;
      this._lastCounter = null;
      this._hasCounter = false;

      this._inReplay = false;
      this._needsReplayFrom = null;
    }

    /**
     * Event handler is triggered any time the client's online state changes.
     * If going online we need to reconnect (i.e. will close any existing websocket connections and then open a new connection)
     * If going offline, close the websocket as its no longer useful/relevant.
     * @method _onlineStateChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_onlineStateChange',
    value: function _onlineStateChange(evt) {
      if (!this.client.isAuthenticated) return;
      if (evt.isOnline) {
        this._reconnect(evt.reset);
      } else {
        this.close();
      }
    }

    /**
     * Reconnect to the server, optionally resetting all data if needed.
     * @method _reconnect
     * @private
     * @param {boolean} reset
     */

  }, {
    key: '_reconnect',
    value: function _reconnect(reset) {
      // The sync manager will reissue any requests once it receives a 'connect' event from the websocket manager.
      // There is no need to have an error callback at this time.
      // Note that calls that come from sources other than the sync manager may suffer from this.
      // Once the websocket implements retry rather than the sync manager, we may need to enable it
      // to trigger a callback after sufficient time.  Just delete all callbacks.
      this.close();
      if (reset) this._reset();
      this.connect();
    }

    /**
     * Connect to the websocket server
     *
     * @method connect
     * @param  {layer.SyncEvent} evt - Ignored parameter
     */

  }, {
    key: 'connect',
    value: function connect(evt) {
      if (this.client.isDestroyed || !this.client.isOnline) return;

      this._closing = false;

      this._lastCounter = -1;

      // Get the URL and connect to it
      var url = this.client.websocketUrl + '/?session_token=' + this.client.sessionToken;

      // Load up our websocket component or shim
      /* istanbul ignore next */
      var WS = typeof WebSocket === 'undefined' ? require('websocket').w3cwebsocket : WebSocket;

      this._socket = new WS(url, WEBSOCKET_PROTOCOL);

      // If its the shim, set the event hanlers
      /* istanbul ignore if */
      if (typeof WebSocket === 'undefined') {
        this._socket.onmessage = this._onMessage;
        this._socket.onclose = this._onSocketClose;
        this._socket.onopen = this._onOpen;
        this._socket.onerror = this._onError;
      }

      // If its a real websocket, add the event handlers
      else {
          this._socket.addEventListener('message', this._onMessage);
          this._socket.addEventListener('close', this._onSocketClose);
          this._socket.addEventListener('open', this._onOpen);
          this._socket.addEventListener('error', this._onError);
        }

      // Trigger a failure if it takes >= 5 seconds to establish a connection
      this._connectionFailedId = setTimeout(this._connectionFailed.bind(this), 5000);
    }

    /**
     * Clears the scheduled call to _connectionFailed that is used to insure the websocket does not get stuck
     * in CONNECTING state. This call is used after the call has completed or failed.
     *
     * @method _clearConnectionFailed
     * @private
     */

  }, {
    key: '_clearConnectionFailed',
    value: function _clearConnectionFailed() {
      if (this._connectionFailedId) {
        clearTimeout(this._connectionFailedId);
        this._connectionFailedId = 0;
      }
    }

    /**
     * Called after 5 seconds of entering CONNECTING state without getting an error or a connection.
     * Calls _onError which will cause this attempt to be stopped and another connection attempt to be scheduled.
     *
     * @method _connectionFailed
     * @private
     */

  }, {
    key: '_connectionFailed',
    value: function _connectionFailed() {
      this._connectionFailedId = 0;
      var msg = 'Websocket failed to connect to server';
      logger.warn(msg);

      // TODO: At this time there is little information on what happens when closing a websocket connection that is stuck in
      // readyState=CONNECTING.  Does it throw an error?  Does it call the onClose or onError event handlers?
      // Remove all event handlers so that calling close won't trigger any calls.
      try {
        this.isOpen = false;
        this._removeSocketEvents();
        if (this._socket) {
          this._socket.close();
          this._socket = null;
        }
      } catch (e) {}
      // No-op


      // Now we can call our error handler.
      this._onError(new Error(msg));
    }

    /**
     * The websocket connection is reporting that its now open.
     *
     * @method _onOpen
     * @private
     */

  }, {
    key: '_onOpen',
    value: function _onOpen() {
      this._clearConnectionFailed();
      if (this._isOpen()) {
        this._lostConnectionCount = 0;
        this.isOpen = true;
        this.trigger('connected');
        logger.debug('Websocket Connected');
        if (this._hasCounter) {
          this.replayEvents(this._lastTimestamp, true);
        } else {
          this._reschedulePing();
        }
      }
    }

    /**
     * Tests to see if the websocket connection is open.  Use the isOpen property
     * for external tests.
     * @method _isOpen
     * @private
     * @returns {Boolean}
     */

  }, {
    key: '_isOpen',
    value: function _isOpen() {
      if (!this._socket) return false;
      /* istanbul ignore if */
      if (typeof WebSocket === 'undefined') return true;
      return this._socket && this._socket.readyState === WebSocket.OPEN;
    }

    /**
     * If not isOpen, presumably failed to connect
     * Any other error can be ignored... if the connection has
     * failed, onClose will handle it.
     *
     * @method _onError
     * @private
     * @param  {Error} err - Websocket error
     */

  }, {
    key: '_onError',
    value: function _onError(err) {
      if (this._closing) return;
      this._clearConnectionFailed();
      logger.debug('Websocket Error causing websocket to close', err);
      if (!this.isOpen) {
        this._removeSocketEvents();
        this._lostConnectionCount++;
        this._scheduleReconnect();
      } else {
        this._onSocketClose();
        this._socket.close();
        this._socket = null;
      }
    }

    /**
     * Shortcut method for sending a signal
     *
     *    manager.sendSignal({
            'type': 'typing_indicator',
            'object': {
              'id': this.conversation.id
            },
            'data': {
              'action': state
            }
          });
     *
     * @method sendSignal
     * @param  {Object} body - Signal body
     */

  }, {
    key: 'sendSignal',
    value: function sendSignal(body) {
      if (this._isOpen()) {
        this._socket.send(JSON.stringify({
          type: 'signal',
          body: body
        }));
      }
    }

    /**
     * Shortcut to sending a Counter.read request
     *
     * @method getCounter
     * @param  {Function} callback
     * @param {boolean} callback.success
     * @param {number} callback.lastCounter
     * @param {number} callback.newCounter
     */

  }, {
    key: 'getCounter',
    value: function getCounter(callback) {
      logger.debug('Websocket request: getCounter');
      this.client.socketRequestManager.sendRequest({
        method: 'Counter.read'
      }, function (result) {
        logger.debug('Websocket response: getCounter ' + result.data.counter);
        if (callback) {
          if (result.success) {
            callback(true, result.data.counter, result.fullData.counter);
          } else {
            callback(false);
          }
        }
      });
    }

    /**
     * Replays all missed change packets since the specified timestamp
     *
     * @method replayEvents
     * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
     * @param  {boolean} [force=false] - if true, cancel any in progress replayEvents and start a new one
     * @param  {Function} [callback] - Optional callback for completion
     */

  }, {
    key: 'replayEvents',
    value: function replayEvents(timestamp, force, callback) {
      var _this2 = this;

      if (!timestamp) return;
      if (force) this._inReplay = false;
      if (typeof timestamp === 'number') timestamp = new Date(timestamp).toISOString();

      // If we are already waiting for a replay to complete, record the timestamp from which we
      // need to replay on our next replay request
      // If we are simply unable to replay because we're disconnected, capture the _needsReplayFrom
      if (this._inReplay || !this._isOpen()) {
        if (!this._needsReplayFrom) {
          logger.debug('Websocket request: replayEvents updating _needsReplayFrom');
          this._needsReplayFrom = timestamp;
        }
      } else {
        this._inReplay = true;
        logger.info('Websocket request: replayEvents');
        this.client.socketRequestManager.sendRequest({
          method: 'Event.replay',
          data: {
            from_timestamp: timestamp
          }
        }, function (result) {
          return _this2._replayEventsComplete(timestamp, callback, result.success);
        });
      }
    }

    /**
     * Callback for handling completion of replay.
     *
     * @method _replayEventsComplete
     * @private
     * @param  {Date}     timestamp
     * @param  {Function} callback
     * @param  {Boolean}   success
     */

  }, {
    key: '_replayEventsComplete',
    value: function _replayEventsComplete(timestamp, callback, success) {
      var _this3 = this;

      this._inReplay = false;

      if (success) {
        // If replay was completed, and no other requests for replay, then trigger synced;
        // we're done.
        if (!this._needsReplayFrom) {
          logger.info('Websocket replay complete');
          this.trigger('synced');
          if (callback) callback();
        }

        // If replayEvents was called during a replay, then replay
        // from the given timestamp.  If request failed, then we need to retry from _lastTimestamp
        else if (this._needsReplayFrom) {
            logger.info('Websocket replay partially complete');
            var t = this._needsReplayFrom;
            this._needsReplayFrom = null;
            this.replayEvents(t);
          }
      }

      // We never got a done event; but either got an error from the server or the request timed out.
      // Use exponential backoff incremented integers that getExponentialBackoffSeconds mapping to roughly
      // 0.4 seconds - 12.8 seconds, and then stops retrying.
      else if (this._replayRetryCount < 8) {
          var maxDelay = 20;
          var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, this._replayRetryCount + 2));
          logger.info('Websocket replay retry in ' + delay + ' seconds');
          setTimeout(function () {
            return _this3.replayEvents(timestamp);
          }, delay * 1000);
          this._replayRetryCount++;
        } else {
          logger.error('Websocket Event.replay has failed');
        }
    }

    /**
     * Handles a new websocket packet from the server
     *
     * @method _onMessage
     * @private
     * @param  {Object} evt - Message from the server
     */

  }, {
    key: '_onMessage',
    value: function _onMessage(evt) {
      this._lostConnectionCount = 0;
      try {
        var msg = JSON.parse(evt.data);
        var skippedCounter = this._lastCounter + 1 !== msg.counter;
        this._hasCounter = true;
        this._lastCounter = msg.counter;
        this._lastDataFromServerTimestamp = Date.now();

        // If we've missed a counter, replay to get; note that we had to update _lastCounter
        // for replayEvents to work correctly.
        if (skippedCounter) {
          this.replayEvents(this._lastTimestamp);
        } else {
          this._lastTimestamp = new Date(msg.timestamp).getTime();
        }

        this.trigger('message', {
          data: msg
        });

        this._reschedulePing();
      } catch (err) {
        logger.error('Layer-Websocket: Failed to handle websocket message: ' + err + '\n', evt.data);
      }
    }

    /**
     * Reschedule a ping request which helps us verify that the connection is still alive,
     * and that we haven't missed any events.
     *
     * @method _reschedulePing
     * @private
     */

  }, {
    key: '_reschedulePing',
    value: function _reschedulePing() {
      if (this._nextPingId) {
        clearTimeout(this._nextPingId);
      }
      this._nextPingId = setTimeout(this._ping.bind(this), this.pingFrequency);
    }

    /**
     * Send a counter request to the server to verify that we are still connected and
     * have not missed any events.
     *
     * @method _ping
     * @private
     */

  }, {
    key: '_ping',
    value: function _ping() {
      logger.debug('Websocket ping');
      this._nextPingId = 0;
      if (this._isOpen()) {
        // NOTE: onMessage will already have called reschedulePing, but if there was no response, then the error handler would NOT have called it.
        this.getCounter(this._reschedulePing.bind(this));
      }
    }

    /**
     * Close the websocket.
     *
     * @method close
     */

  }, {
    key: 'close',
    value: function close() {
      logger.debug('Websocket close requested');
      this._closing = true;
      this.isOpen = false;
      if (this._socket) {
        // Close all event handlers and set socket to null
        // without waiting for browser event to call
        // _onSocketClose as the next command after close
        // might require creating a new socket
        this._onSocketClose();
        this._socket.close();
        this._socket = null;
      }
    }

    /**
     * Send a packet across the websocket
     * @method send
     * @param {Object} obj
     */

  }, {
    key: 'send',
    value: function send(obj) {
      this._socket.send(JSON.stringify(obj));
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.close();
      if (this._nextPingId) clearTimeout(this._nextPingId);
      _get(SocketManager.prototype.__proto__ || Object.getPrototypeOf(SocketManager.prototype), 'destroy', this).call(this);
    }

    /**
     * If the socket has closed (or if the close method forces it closed)
     * Remove all event handlers and if appropriate, schedule a retry.
     *
     * @method _onSocketClose
     * @private
     */

  }, {
    key: '_onSocketClose',
    value: function _onSocketClose() {
      logger.debug('Websocket closed');
      this.isOpen = false;
      if (!this._closing) {
        this._scheduleReconnect();
      }

      this._removeSocketEvents();
      this.trigger('disconnected');
    }

    /**
     * Removes all event handlers on the current socket.
     *
     * @method _removeSocketEvents
     * @private
     */

  }, {
    key: '_removeSocketEvents',
    value: function _removeSocketEvents() {
      /* istanbul ignore if */
      if (typeof WebSocket !== 'undefined' && this._socket) {
        this._socket.removeEventListener('message', this._onMessage);
        this._socket.removeEventListener('close', this._onSocketClose);
        this._socket.removeEventListener('open', this._onOpen);
        this._socket.removeEventListener('error', this._onError);
      } else if (this._socket) {
        this._socket.onmessage = null;
        this._socket.onclose = null;
        this._socket.onopen = null;
        this._socket.onerror = null;
      }
    }

    /**
     * Schedule an attempt to reconnect to the server.  If the onlineManager
     * declares us to be offline, don't bother reconnecting.  A reconnect
     * attempt will be triggered as soon as the online manager reports we are online again.
     *
     * Note that the duration of our delay can not excede the onlineManager's ping frequency
     * or it will declare us to be offline while we attempt a reconnect.
     *
     * @method _scheduleReconnect
     * @private
     */

  }, {
    key: '_scheduleReconnect',
    value: function _scheduleReconnect() {
      var _this4 = this;

      if (this.isDestroyed || !this.client.isOnline) return;

      var maxDelay = (this.client.onlineManager.pingFrequency - 1000) / 1000;
      var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, this._lostConnectionCount));
      logger.debug('Websocket Reconnect in ' + delay + ' seconds');
      if (!this._reconnectId) {
        this._reconnectId = setTimeout(function () {
          _this4._reconnectId = 0;
          _this4._validateSessionBeforeReconnect();
        }, delay * 1000);
      }
    }

    /**
     * Before the scheduled reconnect can call `connect()` validate that we didn't lose the websocket
     * due to loss of authentication.
     *
     * @method _validateSessionBeforeReconnect
     * @private
     */

  }, {
    key: '_validateSessionBeforeReconnect',
    value: function _validateSessionBeforeReconnect() {
      var _this5 = this;

      if (this.isDestroyed || !this.client.isOnline) return;

      var maxDelay = 30 * 1000; // maximum delay of 30 seconds per ping
      var diff = Date.now() - this._lastValidateSessionRequest - maxDelay;
      if (diff < 0) {
        // This is identical to whats in _scheduleReconnect and could be cleaner
        if (!this._reconnectId) {
          this._reconnectId = setTimeout(function () {
            _this5._reconnectId = 0;
            _this5._validateSessionBeforeReconnect();
          }, Math.abs(diff) + 1000);
        }
      } else {
        this._lastValidateSessionRequest = Date.now();
        this.client.xhr({
          url: '/?action=validateConnectionForWebsocket&client=' + this.client.constructor.version,
          method: 'GET',
          sync: false
        }, function (result) {
          if (result.success) _this5.connect();
          // if not successful, the this.client.xhr will handle reauthentication
        });
      }
    }
  }]);

  return SocketManager;
}(Root);

/**
 * Is the websocket connection currently open?
 * @type {Boolean}
 */


SocketManager.prototype.isOpen = false;

/**
 * setTimeout ID for calling connect()
 * @private
 * @type {Number}
 */
SocketManager.prototype._reconnectId = 0;

/**
 * setTimeout ID for calling _connectionFailed()
 * @private
 * @type {Number}
 */
SocketManager.prototype._connectionFailedId = 0;

SocketManager.prototype._lastTimestamp = 0;
SocketManager.prototype._lastDataFromServerTimestamp = 0;
SocketManager.prototype._lastCounter = null;
SocketManager.prototype._hasCounter = false;

SocketManager.prototype._inReplay = false;
SocketManager.prototype._needsReplayFrom = null;

SocketManager.prototype._replayRetryCount = 0;

/**
 * Time in miliseconds since the last call to _validateSessionBeforeReconnect
 * @type {Number}
 */
SocketManager.prototype._lastValidateSessionRequest = 0;

/**
 * Frequency with which the websocket checks to see if any websocket notifications
 * have been missed.
 * @type {Number}
 */
SocketManager.prototype.pingFrequency = 30000;

/**
 * The Client that owns this.
 * @type {layer.Client}
 */
SocketManager.prototype.client = null;

/**
 * The Socket Connection instance
 * @type {Websocket}
 */
SocketManager.prototype._socket = null;

/**
 * Is the websocket connection being closed by a call to close()?
 * If so, we can ignore any errors that signal the socket as closing.
 * @type {Boolean}
 */
SocketManager.prototype._closing = false;

/**
 * Number of failed attempts to reconnect.
 * @type {Number}
 */
SocketManager.prototype._lostConnectionCount = 0;

SocketManager._supportedEvents = [
/**
 * A data packet has been received from the server.
 * @event message
 * @param {layer.LayerEvent} layerEvent
 * @param {Object} layerEvent.data - The data that was received from the server
 */
'message',

/**
 * The websocket is now connected.
 * @event connected
 * @protected
 */
'connected',

/**
 * The websocket is no longer connected
 * @event disconnected
 * @protected
 */
'disconnected',

/**
 * Websocket events were missed; we are resyncing with the server
 * @event replay-begun
 */
'syncing',

/**
 * Websocket events were missed; we resynced with the server and are now done
 * @event replay-begun
 */
'synced'].concat(Root._supportedEvents);
Root.initClass.apply(SocketManager, [SocketManager, 'SocketManager']);
module.exports = SocketManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3NvY2tldC1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiVXRpbHMiLCJsb2dnZXIiLCJXRUJTT0NLRVRfUFJPVE9DT0wiLCJTb2NrZXRNYW5hZ2VyIiwib3B0aW9ucyIsImNsaWVudCIsIkVycm9yIiwiX29uTWVzc2FnZSIsImJpbmQiLCJfb25PcGVuIiwiX29uU29ja2V0Q2xvc2UiLCJfb25FcnJvciIsImlzQXV0aGVudGljYXRlZCIsIm9ubGluZU1hbmFnZXIiLCJpc09ubGluZSIsImNvbm5lY3QiLCJvbiIsIl9vbmxpbmVTdGF0ZUNoYW5nZSIsIl9sYXN0VGltZXN0YW1wIiwiRGF0ZSIsIm5vdyIsIl9sYXN0RGF0YUZyb21TZXJ2ZXJUaW1lc3RhbXAiLCJfbGFzdENvdW50ZXIiLCJfaGFzQ291bnRlciIsIl9pblJlcGxheSIsIl9uZWVkc1JlcGxheUZyb20iLCJldnQiLCJfcmVjb25uZWN0IiwicmVzZXQiLCJjbG9zZSIsIl9yZXNldCIsImlzRGVzdHJveWVkIiwiX2Nsb3NpbmciLCJ1cmwiLCJ3ZWJzb2NrZXRVcmwiLCJzZXNzaW9uVG9rZW4iLCJXUyIsIldlYlNvY2tldCIsInczY3dlYnNvY2tldCIsIl9zb2NrZXQiLCJvbm1lc3NhZ2UiLCJvbmNsb3NlIiwib25vcGVuIiwib25lcnJvciIsImFkZEV2ZW50TGlzdGVuZXIiLCJfY29ubmVjdGlvbkZhaWxlZElkIiwic2V0VGltZW91dCIsIl9jb25uZWN0aW9uRmFpbGVkIiwiY2xlYXJUaW1lb3V0IiwibXNnIiwid2FybiIsImlzT3BlbiIsIl9yZW1vdmVTb2NrZXRFdmVudHMiLCJlIiwiX2NsZWFyQ29ubmVjdGlvbkZhaWxlZCIsIl9pc09wZW4iLCJfbG9zdENvbm5lY3Rpb25Db3VudCIsInRyaWdnZXIiLCJkZWJ1ZyIsInJlcGxheUV2ZW50cyIsIl9yZXNjaGVkdWxlUGluZyIsInJlYWR5U3RhdGUiLCJPUEVOIiwiZXJyIiwiX3NjaGVkdWxlUmVjb25uZWN0IiwiYm9keSIsInNlbmQiLCJKU09OIiwic3RyaW5naWZ5IiwidHlwZSIsImNhbGxiYWNrIiwic29ja2V0UmVxdWVzdE1hbmFnZXIiLCJzZW5kUmVxdWVzdCIsIm1ldGhvZCIsInJlc3VsdCIsImRhdGEiLCJjb3VudGVyIiwic3VjY2VzcyIsImZ1bGxEYXRhIiwidGltZXN0YW1wIiwiZm9yY2UiLCJ0b0lTT1N0cmluZyIsImluZm8iLCJmcm9tX3RpbWVzdGFtcCIsIl9yZXBsYXlFdmVudHNDb21wbGV0ZSIsInQiLCJfcmVwbGF5UmV0cnlDb3VudCIsIm1heERlbGF5IiwiZGVsYXkiLCJnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIiwiTWF0aCIsIm1pbiIsImVycm9yIiwicGFyc2UiLCJza2lwcGVkQ291bnRlciIsImdldFRpbWUiLCJfbmV4dFBpbmdJZCIsIl9waW5nIiwicGluZ0ZyZXF1ZW5jeSIsImdldENvdW50ZXIiLCJvYmoiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiX3JlY29ubmVjdElkIiwiX3ZhbGlkYXRlU2Vzc2lvbkJlZm9yZVJlY29ubmVjdCIsImRpZmYiLCJfbGFzdFZhbGlkYXRlU2Vzc2lvblJlcXVlc3QiLCJhYnMiLCJ4aHIiLCJjb25zdHJ1Y3RvciIsInZlcnNpb24iLCJzeW5jIiwicHJvdG90eXBlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxRQUFRRCxRQUFRLGlCQUFSLENBQWQ7QUFDQSxJQUFNRSxTQUFTRixRQUFRLFdBQVIsQ0FBZjs7ZUFDK0JBLFFBQVEsVUFBUixDO0lBQXZCRyxrQixZQUFBQSxrQjs7SUFFRkMsYTs7O0FBQ0o7Ozs7Ozs7Ozs7OztBQVlBLHlCQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQUEs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SCxhQUFqQiIsImZpbGUiOiJzb2NrZXQtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhpcyBjb21wb25lbnQgbWFuYWdlc1xuICpcbiAqIDEuIHJlY2lldmluZyB3ZWJzb2NrZXQgZXZlbnRzXG4gKiAyLiBQcm9jZXNzaW5nIHRoZW1cbiAqIDMuIFRyaWdnZXJpbmcgZXZlbnRzIG9uIGNvbXBsZXRpbmcgdGhlbVxuICogNC4gU2VuZGluZyB0aGVtXG4gKlxuICogQXBwbGljYXRpb25zIHR5cGljYWxseSBkbyBub3QgaW50ZXJhY3Qgd2l0aCB0aGlzIGNvbXBvbmVudCwgYnV0IG1heSBzdWJzY3JpYmVcbiAqIHRvIHRoZSBgbWVzc2FnZWAgZXZlbnQgaWYgdGhleSB3YW50IHJpY2hlciBldmVudCBpbmZvcm1hdGlvbiB0aGFuIGlzIGF2YWlsYWJsZVxuICogdGhyb3VnaCB0aGUgbGF5ZXIuQ2xpZW50IGNsYXNzLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgeyBXRUJTT0NLRVRfUFJPVE9DT0wgfSA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5cbmNsYXNzIFNvY2tldE1hbmFnZXIgZXh0ZW5kcyBSb290IHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyB3ZWJzb2NrZXQgbWFuYWdlclxuICAgKlxuICAgKiAgICAgIHZhciBzb2NrZXRNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoJ1NvY2tldE1hbmFnZXIgcmVxdWlyZXMgYSBjbGllbnQnKTtcblxuICAgIC8vIEluc3VyZSB0aGF0IG9uL29mZiBtZXRob2RzIGRvbid0IG5lZWQgdG8gY2FsbCBiaW5kLCB0aGVyZWZvcmUgbWFraW5nIGl0IGVhc3lcbiAgICAvLyB0byBhZGQvcmVtb3ZlIGZ1bmN0aW9ucyBhcyBldmVudCBsaXN0ZW5lcnMuXG4gICAgdGhpcy5fb25NZXNzYWdlID0gdGhpcy5fb25NZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fb25PcGVuID0gdGhpcy5fb25PcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fb25Tb2NrZXRDbG9zZSA9IHRoaXMuX29uU29ja2V0Q2xvc2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9vbkVycm9yID0gdGhpcy5fb25FcnJvci5iaW5kKHRoaXMpO1xuXG4gICAgLy8gSWYgdGhlIGNsaWVudCBpcyBhdXRoZW50aWNhdGVkLCBzdGFydCBpdCB1cC5cbiAgICBpZiAodGhpcy5jbGllbnQuaXNBdXRoZW50aWNhdGVkICYmIHRoaXMuY2xpZW50Lm9ubGluZU1hbmFnZXIuaXNPbmxpbmUpIHtcbiAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgIH1cblxuICAgIHRoaXMuY2xpZW50Lm9uKCdvbmxpbmUnLCB0aGlzLl9vbmxpbmVTdGF0ZUNoYW5nZSwgdGhpcyk7XG5cbiAgICAvLyBBbnkgdGltZSB0aGUgQ2xpZW50IHRyaWdnZXJzIGEgcmVhZHkgZXZlbnQgd2UgbmVlZCB0byByZWNvbm5lY3QuXG4gICAgdGhpcy5jbGllbnQub24oJ2F1dGhlbnRpY2F0ZWQnLCB0aGlzLmNvbm5lY3QsIHRoaXMpO1xuXG4gICAgdGhpcy5fbGFzdFRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCB0aGlzIHdoZW4gd2Ugd2FudCB0byByZXNldCBhbGwgd2Vic29ja2V0IHN0YXRlOyB0aGlzIHdvdWxkIGJlIGRvbmUgYWZ0ZXIgYSBsZW5ndGh5IHBlcmlvZFxuICAgKiBvZiBiZWluZyBkaXNjb25uZWN0ZWQuICBUaGlzIHByZXZlbnRzIEV2ZW50LnJlcGxheSBmcm9tIGJlaW5nIGNhbGxlZCBvbiByZWNvbm5lY3RpbmcuXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc2V0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzZXQoKSB7XG4gICAgdGhpcy5fbGFzdFRpbWVzdGFtcCA9IDA7XG4gICAgdGhpcy5fbGFzdERhdGFGcm9tU2VydmVyVGltZXN0YW1wID0gMDtcbiAgICB0aGlzLl9sYXN0Q291bnRlciA9IG51bGw7XG4gICAgdGhpcy5faGFzQ291bnRlciA9IGZhbHNlO1xuXG4gICAgdGhpcy5faW5SZXBsYXkgPSBmYWxzZTtcbiAgICB0aGlzLl9uZWVkc1JlcGxheUZyb20gPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEV2ZW50IGhhbmRsZXIgaXMgdHJpZ2dlcmVkIGFueSB0aW1lIHRoZSBjbGllbnQncyBvbmxpbmUgc3RhdGUgY2hhbmdlcy5cbiAgICogSWYgZ29pbmcgb25saW5lIHdlIG5lZWQgdG8gcmVjb25uZWN0IChpLmUuIHdpbGwgY2xvc2UgYW55IGV4aXN0aW5nIHdlYnNvY2tldCBjb25uZWN0aW9ucyBhbmQgdGhlbiBvcGVuIGEgbmV3IGNvbm5lY3Rpb24pXG4gICAqIElmIGdvaW5nIG9mZmxpbmUsIGNsb3NlIHRoZSB3ZWJzb2NrZXQgYXMgaXRzIG5vIGxvbmdlciB1c2VmdWwvcmVsZXZhbnQuXG4gICAqIEBtZXRob2QgX29ubGluZVN0YXRlQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfb25saW5lU3RhdGVDaGFuZ2UoZXZ0KSB7XG4gICAgaWYgKCF0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcbiAgICBpZiAoZXZ0LmlzT25saW5lKSB7XG4gICAgICB0aGlzLl9yZWNvbm5lY3QoZXZ0LnJlc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvbm5lY3QgdG8gdGhlIHNlcnZlciwgb3B0aW9uYWxseSByZXNldHRpbmcgYWxsIGRhdGEgaWYgbmVlZGVkLlxuICAgKiBAbWV0aG9kIF9yZWNvbm5lY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtib29sZWFufSByZXNldFxuICAgKi9cbiAgX3JlY29ubmVjdChyZXNldCkge1xuICAgIC8vIFRoZSBzeW5jIG1hbmFnZXIgd2lsbCByZWlzc3VlIGFueSByZXF1ZXN0cyBvbmNlIGl0IHJlY2VpdmVzIGEgJ2Nvbm5lY3QnIGV2ZW50IGZyb20gdGhlIHdlYnNvY2tldCBtYW5hZ2VyLlxuICAgIC8vIFRoZXJlIGlzIG5vIG5lZWQgdG8gaGF2ZSBhbiBlcnJvciBjYWxsYmFjayBhdCB0aGlzIHRpbWUuXG4gICAgLy8gTm90ZSB0aGF0IGNhbGxzIHRoYXQgY29tZSBmcm9tIHNvdXJjZXMgb3RoZXIgdGhhbiB0aGUgc3luYyBtYW5hZ2VyIG1heSBzdWZmZXIgZnJvbSB0aGlzLlxuICAgIC8vIE9uY2UgdGhlIHdlYnNvY2tldCBpbXBsZW1lbnRzIHJldHJ5IHJhdGhlciB0aGFuIHRoZSBzeW5jIG1hbmFnZXIsIHdlIG1heSBuZWVkIHRvIGVuYWJsZSBpdFxuICAgIC8vIHRvIHRyaWdnZXIgYSBjYWxsYmFjayBhZnRlciBzdWZmaWNpZW50IHRpbWUuICBKdXN0IGRlbGV0ZSBhbGwgY2FsbGJhY2tzLlxuICAgIHRoaXMuY2xvc2UoKTtcbiAgICBpZiAocmVzZXQpIHRoaXMuX3Jlc2V0KCk7XG4gICAgdGhpcy5jb25uZWN0KCk7XG4gIH1cblxuICAvKipcbiAgICogQ29ubmVjdCB0byB0aGUgd2Vic29ja2V0IHNlcnZlclxuICAgKlxuICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSBldnQgLSBJZ25vcmVkIHBhcmFtZXRlclxuICAgKi9cbiAgY29ubmVjdChldnQpIHtcbiAgICBpZiAodGhpcy5jbGllbnQuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lKSByZXR1cm47XG5cbiAgICB0aGlzLl9jbG9zaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLl9sYXN0Q291bnRlciA9IC0xO1xuXG4gICAgLy8gR2V0IHRoZSBVUkwgYW5kIGNvbm5lY3QgdG8gaXRcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmNsaWVudC53ZWJzb2NrZXRVcmx9Lz9zZXNzaW9uX3Rva2VuPSR7dGhpcy5jbGllbnQuc2Vzc2lvblRva2VufWA7XG5cbiAgICAvLyBMb2FkIHVwIG91ciB3ZWJzb2NrZXQgY29tcG9uZW50IG9yIHNoaW1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGNvbnN0IFdTID0gdHlwZW9mIFdlYlNvY2tldCA9PT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKCd3ZWJzb2NrZXQnKS53M2N3ZWJzb2NrZXQgOiBXZWJTb2NrZXQ7XG5cbiAgICB0aGlzLl9zb2NrZXQgPSBuZXcgV1ModXJsLCBXRUJTT0NLRVRfUFJPVE9DT0wpO1xuXG4gICAgLy8gSWYgaXRzIHRoZSBzaGltLCBzZXQgdGhlIGV2ZW50IGhhbmxlcnNcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX3NvY2tldC5vbm1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2U7XG4gICAgICB0aGlzLl9zb2NrZXQub25jbG9zZSA9IHRoaXMuX29uU29ja2V0Q2xvc2U7XG4gICAgICB0aGlzLl9zb2NrZXQub25vcGVuID0gdGhpcy5fb25PcGVuO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uZXJyb3IgPSB0aGlzLl9vbkVycm9yO1xuICAgIH1cblxuICAgIC8vIElmIGl0cyBhIHJlYWwgd2Vic29ja2V0LCBhZGQgdGhlIGV2ZW50IGhhbmRsZXJzXG4gICAgZWxzZSB7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZSk7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlKTtcbiAgICAgIHRoaXMuX3NvY2tldC5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25PcGVuKTtcbiAgICAgIHRoaXMuX3NvY2tldC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uRXJyb3IpO1xuICAgIH1cblxuICAgIC8vIFRyaWdnZXIgYSBmYWlsdXJlIGlmIGl0IHRha2VzID49IDUgc2Vjb25kcyB0byBlc3RhYmxpc2ggYSBjb25uZWN0aW9uXG4gICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gc2V0VGltZW91dCh0aGlzLl9jb25uZWN0aW9uRmFpbGVkLmJpbmQodGhpcyksIDUwMDApO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFycyB0aGUgc2NoZWR1bGVkIGNhbGwgdG8gX2Nvbm5lY3Rpb25GYWlsZWQgdGhhdCBpcyB1c2VkIHRvIGluc3VyZSB0aGUgd2Vic29ja2V0IGRvZXMgbm90IGdldCBzdHVja1xuICAgKiBpbiBDT05ORUNUSU5HIHN0YXRlLiBUaGlzIGNhbGwgaXMgdXNlZCBhZnRlciB0aGUgY2FsbCBoYXMgY29tcGxldGVkIG9yIGZhaWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYXJDb25uZWN0aW9uRmFpbGVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJDb25uZWN0aW9uRmFpbGVkKCkge1xuICAgIGlmICh0aGlzLl9jb25uZWN0aW9uRmFpbGVkSWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9jb25uZWN0aW9uRmFpbGVkSWQpO1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gMDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIGFmdGVyIDUgc2Vjb25kcyBvZiBlbnRlcmluZyBDT05ORUNUSU5HIHN0YXRlIHdpdGhvdXQgZ2V0dGluZyBhbiBlcnJvciBvciBhIGNvbm5lY3Rpb24uXG4gICAqIENhbGxzIF9vbkVycm9yIHdoaWNoIHdpbGwgY2F1c2UgdGhpcyBhdHRlbXB0IHRvIGJlIHN0b3BwZWQgYW5kIGFub3RoZXIgY29ubmVjdGlvbiBhdHRlbXB0IHRvIGJlIHNjaGVkdWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkZhaWxlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2Nvbm5lY3Rpb25GYWlsZWQoKSB7XG4gICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gMDtcbiAgICBjb25zdCBtc2cgPSAnV2Vic29ja2V0IGZhaWxlZCB0byBjb25uZWN0IHRvIHNlcnZlcic7XG4gICAgbG9nZ2VyLndhcm4obXNnKTtcblxuICAgIC8vIFRPRE86IEF0IHRoaXMgdGltZSB0aGVyZSBpcyBsaXR0bGUgaW5mb3JtYXRpb24gb24gd2hhdCBoYXBwZW5zIHdoZW4gY2xvc2luZyBhIHdlYnNvY2tldCBjb25uZWN0aW9uIHRoYXQgaXMgc3R1Y2sgaW5cbiAgICAvLyByZWFkeVN0YXRlPUNPTk5FQ1RJTkcuICBEb2VzIGl0IHRocm93IGFuIGVycm9yPyAgRG9lcyBpdCBjYWxsIHRoZSBvbkNsb3NlIG9yIG9uRXJyb3IgZXZlbnQgaGFuZGxlcnM/XG4gICAgLy8gUmVtb3ZlIGFsbCBldmVudCBoYW5kbGVycyBzbyB0aGF0IGNhbGxpbmcgY2xvc2Ugd29uJ3QgdHJpZ2dlciBhbnkgY2FsbHMuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuaXNPcGVuID0gZmFsc2U7XG4gICAgICB0aGlzLl9yZW1vdmVTb2NrZXRFdmVudHMoKTtcbiAgICAgIGlmICh0aGlzLl9zb2NrZXQpIHtcbiAgICAgICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgICAgIHRoaXMuX3NvY2tldCA9IG51bGw7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm8tb3BcbiAgICB9XG5cbiAgICAvLyBOb3cgd2UgY2FuIGNhbGwgb3VyIGVycm9yIGhhbmRsZXIuXG4gICAgdGhpcy5fb25FcnJvcihuZXcgRXJyb3IobXNnKSk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHdlYnNvY2tldCBjb25uZWN0aW9uIGlzIHJlcG9ydGluZyB0aGF0IGl0cyBub3cgb3Blbi5cbiAgICpcbiAgICogQG1ldGhvZCBfb25PcGVuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfb25PcGVuKCkge1xuICAgIHRoaXMuX2NsZWFyQ29ubmVjdGlvbkZhaWxlZCgpO1xuICAgIGlmICh0aGlzLl9pc09wZW4oKSkge1xuICAgICAgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCA9IDA7XG4gICAgICB0aGlzLmlzT3BlbiA9IHRydWU7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcpO1xuICAgICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgQ29ubmVjdGVkJyk7XG4gICAgICBpZiAodGhpcy5faGFzQ291bnRlcikge1xuICAgICAgICB0aGlzLnJlcGxheUV2ZW50cyh0aGlzLl9sYXN0VGltZXN0YW1wLCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Jlc2NoZWR1bGVQaW5nKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3RzIHRvIHNlZSBpZiB0aGUgd2Vic29ja2V0IGNvbm5lY3Rpb24gaXMgb3Blbi4gIFVzZSB0aGUgaXNPcGVuIHByb3BlcnR5XG4gICAqIGZvciBleHRlcm5hbCB0ZXN0cy5cbiAgICogQG1ldGhvZCBfaXNPcGVuXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgX2lzT3BlbigpIHtcbiAgICBpZiAoIXRoaXMuX3NvY2tldCkgcmV0dXJuIGZhbHNlO1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICh0eXBlb2YgV2ViU29ja2V0ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIHRoaXMuX3NvY2tldCAmJiB0aGlzLl9zb2NrZXQucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU47XG4gIH1cblxuICAvKipcbiAgICogSWYgbm90IGlzT3BlbiwgcHJlc3VtYWJseSBmYWlsZWQgdG8gY29ubmVjdFxuICAgKiBBbnkgb3RoZXIgZXJyb3IgY2FuIGJlIGlnbm9yZWQuLi4gaWYgdGhlIGNvbm5lY3Rpb24gaGFzXG4gICAqIGZhaWxlZCwgb25DbG9zZSB3aWxsIGhhbmRsZSBpdC5cbiAgICpcbiAgICogQG1ldGhvZCBfb25FcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtFcnJvcn0gZXJyIC0gV2Vic29ja2V0IGVycm9yXG4gICAqL1xuICBfb25FcnJvcihlcnIpIHtcbiAgICBpZiAodGhpcy5fY2xvc2luZykgcmV0dXJuO1xuICAgIHRoaXMuX2NsZWFyQ29ubmVjdGlvbkZhaWxlZCgpO1xuICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IEVycm9yIGNhdXNpbmcgd2Vic29ja2V0IHRvIGNsb3NlJywgZXJyKTtcbiAgICBpZiAoIXRoaXMuaXNPcGVuKSB7XG4gICAgICB0aGlzLl9yZW1vdmVTb2NrZXRFdmVudHMoKTtcbiAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uQ291bnQrKztcbiAgICAgIHRoaXMuX3NjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX29uU29ja2V0Q2xvc2UoKTtcbiAgICAgIHRoaXMuX3NvY2tldC5jbG9zZSgpO1xuICAgICAgdGhpcy5fc29ja2V0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2hvcnRjdXQgbWV0aG9kIGZvciBzZW5kaW5nIGEgc2lnbmFsXG4gICAqXG4gICAqICAgIG1hbmFnZXIuc2VuZFNpZ25hbCh7XG4gICAgICAgICAgJ3R5cGUnOiAndHlwaW5nX2luZGljYXRvcicsXG4gICAgICAgICAgJ29iamVjdCc6IHtcbiAgICAgICAgICAgICdpZCc6IHRoaXMuY29udmVyc2F0aW9uLmlkXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnZGF0YSc6IHtcbiAgICAgICAgICAgICdhY3Rpb24nOiBzdGF0ZVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFNpZ25hbFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGJvZHkgLSBTaWduYWwgYm9keVxuICAgKi9cbiAgc2VuZFNpZ25hbChib2R5KSB7XG4gICAgaWYgKHRoaXMuX2lzT3BlbigpKSB7XG4gICAgICB0aGlzLl9zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHR5cGU6ICdzaWduYWwnLFxuICAgICAgICBib2R5LFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTaG9ydGN1dCB0byBzZW5kaW5nIGEgQ291bnRlci5yZWFkIHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBnZXRDb3VudGVyXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGNhbGxiYWNrLnN1Y2Nlc3NcbiAgICogQHBhcmFtIHtudW1iZXJ9IGNhbGxiYWNrLmxhc3RDb3VudGVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBjYWxsYmFjay5uZXdDb3VudGVyXG4gICAqL1xuICBnZXRDb3VudGVyKGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgcmVxdWVzdDogZ2V0Q291bnRlcicpO1xuICAgIHRoaXMuY2xpZW50LnNvY2tldFJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ0NvdW50ZXIucmVhZCcsXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgcmVzcG9uc2U6IGdldENvdW50ZXIgJyArIHJlc3VsdC5kYXRhLmNvdW50ZXIpO1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIGNhbGxiYWNrKHRydWUsIHJlc3VsdC5kYXRhLmNvdW50ZXIsIHJlc3VsdC5mdWxsRGF0YS5jb3VudGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYXlzIGFsbCBtaXNzZWQgY2hhbmdlIHBhY2tldHMgc2luY2UgdGhlIHNwZWNpZmllZCB0aW1lc3RhbXBcbiAgICpcbiAgICogQG1ldGhvZCByZXBsYXlFdmVudHNcbiAgICogQHBhcmFtICB7c3RyaW5nfG51bWJlcn0gICB0aW1lc3RhbXAgLSBJc28gZm9ybWF0dGVkIGRhdGUgc3RyaW5nOyBpZiBudW1iZXIgd2lsbCBiZSB0cmFuc2Zvcm1lZCBpbnRvIGZvcm1hdHRlZCBkYXRlIHN0cmluZy5cbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gW2ZvcmNlPWZhbHNlXSAtIGlmIHRydWUsIGNhbmNlbCBhbnkgaW4gcHJvZ3Jlc3MgcmVwbGF5RXZlbnRzIGFuZCBzdGFydCBhIG5ldyBvbmVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYWxsYmFja10gLSBPcHRpb25hbCBjYWxsYmFjayBmb3IgY29tcGxldGlvblxuICAgKi9cbiAgcmVwbGF5RXZlbnRzKHRpbWVzdGFtcCwgZm9yY2UsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aW1lc3RhbXApIHJldHVybjtcbiAgICBpZiAoZm9yY2UpIHRoaXMuX2luUmVwbGF5ID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB0aW1lc3RhbXAgPT09ICdudW1iZXInKSB0aW1lc3RhbXAgPSBuZXcgRGF0ZSh0aW1lc3RhbXApLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAvLyBJZiB3ZSBhcmUgYWxyZWFkeSB3YWl0aW5nIGZvciBhIHJlcGxheSB0byBjb21wbGV0ZSwgcmVjb3JkIHRoZSB0aW1lc3RhbXAgZnJvbSB3aGljaCB3ZVxuICAgIC8vIG5lZWQgdG8gcmVwbGF5IG9uIG91ciBuZXh0IHJlcGxheSByZXF1ZXN0XG4gICAgLy8gSWYgd2UgYXJlIHNpbXBseSB1bmFibGUgdG8gcmVwbGF5IGJlY2F1c2Ugd2UncmUgZGlzY29ubmVjdGVkLCBjYXB0dXJlIHRoZSBfbmVlZHNSZXBsYXlGcm9tXG4gICAgaWYgKHRoaXMuX2luUmVwbGF5IHx8ICF0aGlzLl9pc09wZW4oKSkge1xuICAgICAgaWYgKCF0aGlzLl9uZWVkc1JlcGxheUZyb20pIHtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgcmVxdWVzdDogcmVwbGF5RXZlbnRzIHVwZGF0aW5nIF9uZWVkc1JlcGxheUZyb20nKTtcbiAgICAgICAgdGhpcy5fbmVlZHNSZXBsYXlGcm9tID0gdGltZXN0YW1wO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9pblJlcGxheSA9IHRydWU7XG4gICAgICBsb2dnZXIuaW5mbygnV2Vic29ja2V0IHJlcXVlc3Q6IHJlcGxheUV2ZW50cycpO1xuICAgICAgdGhpcy5jbGllbnQuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgICAgICBtZXRob2Q6ICdFdmVudC5yZXBsYXknLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgZnJvbV90aW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICAgICAgfSxcbiAgICAgIH0sIHJlc3VsdCA9PiB0aGlzLl9yZXBsYXlFdmVudHNDb21wbGV0ZSh0aW1lc3RhbXAsIGNhbGxiYWNrLCByZXN1bHQuc3VjY2VzcykpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBmb3IgaGFuZGxpbmcgY29tcGxldGlvbiBvZiByZXBsYXkuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlcGxheUV2ZW50c0NvbXBsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge0RhdGV9ICAgICB0aW1lc3RhbXBcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICAgc3VjY2Vzc1xuICAgKi9cbiAgX3JlcGxheUV2ZW50c0NvbXBsZXRlKHRpbWVzdGFtcCwgY2FsbGJhY2ssIHN1Y2Nlc3MpIHtcbiAgICB0aGlzLl9pblJlcGxheSA9IGZhbHNlO1xuXG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgLy8gSWYgcmVwbGF5IHdhcyBjb21wbGV0ZWQsIGFuZCBubyBvdGhlciByZXF1ZXN0cyBmb3IgcmVwbGF5LCB0aGVuIHRyaWdnZXIgc3luY2VkO1xuICAgICAgLy8gd2UncmUgZG9uZS5cbiAgICAgIGlmICghdGhpcy5fbmVlZHNSZXBsYXlGcm9tKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKCdXZWJzb2NrZXQgcmVwbGF5IGNvbXBsZXRlJyk7XG4gICAgICAgIHRoaXMudHJpZ2dlcignc3luY2VkJyk7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgcmVwbGF5RXZlbnRzIHdhcyBjYWxsZWQgZHVyaW5nIGEgcmVwbGF5LCB0aGVuIHJlcGxheVxuICAgICAgLy8gZnJvbSB0aGUgZ2l2ZW4gdGltZXN0YW1wLiAgSWYgcmVxdWVzdCBmYWlsZWQsIHRoZW4gd2UgbmVlZCB0byByZXRyeSBmcm9tIF9sYXN0VGltZXN0YW1wXG4gICAgICBlbHNlIGlmICh0aGlzLl9uZWVkc1JlcGxheUZyb20pIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oJ1dlYnNvY2tldCByZXBsYXkgcGFydGlhbGx5IGNvbXBsZXRlJyk7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLl9uZWVkc1JlcGxheUZyb207XG4gICAgICAgIHRoaXMuX25lZWRzUmVwbGF5RnJvbSA9IG51bGw7XG4gICAgICAgIHRoaXMucmVwbGF5RXZlbnRzKHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdlIG5ldmVyIGdvdCBhIGRvbmUgZXZlbnQ7IGJ1dCBlaXRoZXIgZ290IGFuIGVycm9yIGZyb20gdGhlIHNlcnZlciBvciB0aGUgcmVxdWVzdCB0aW1lZCBvdXQuXG4gICAgLy8gVXNlIGV4cG9uZW50aWFsIGJhY2tvZmYgaW5jcmVtZW50ZWQgaW50ZWdlcnMgdGhhdCBnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIG1hcHBpbmcgdG8gcm91Z2hseVxuICAgIC8vIDAuNCBzZWNvbmRzIC0gMTIuOCBzZWNvbmRzLCBhbmQgdGhlbiBzdG9wcyByZXRyeWluZy5cbiAgICBlbHNlIGlmICh0aGlzLl9yZXBsYXlSZXRyeUNvdW50IDwgOCkge1xuICAgICAgY29uc3QgbWF4RGVsYXkgPSAyMDtcbiAgICAgIGNvbnN0IGRlbGF5ID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyhtYXhEZWxheSwgTWF0aC5taW4oMTUsIHRoaXMuX3JlcGxheVJldHJ5Q291bnQgKyAyKSk7XG4gICAgICBsb2dnZXIuaW5mbygnV2Vic29ja2V0IHJlcGxheSByZXRyeSBpbiAnICsgZGVsYXkgKyAnIHNlY29uZHMnKTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5yZXBsYXlFdmVudHModGltZXN0YW1wKSwgZGVsYXkgKiAxMDAwKTtcbiAgICAgIHRoaXMuX3JlcGxheVJldHJ5Q291bnQrKztcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmVycm9yKCdXZWJzb2NrZXQgRXZlbnQucmVwbGF5IGhhcyBmYWlsZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBhIG5ldyB3ZWJzb2NrZXQgcGFja2V0IGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAbWV0aG9kIF9vbk1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBldnQgLSBNZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKi9cbiAgX29uTWVzc2FnZShldnQpIHtcbiAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbkNvdW50ID0gMDtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShldnQuZGF0YSk7XG4gICAgICBjb25zdCBza2lwcGVkQ291bnRlciA9IHRoaXMuX2xhc3RDb3VudGVyICsgMSAhPT0gbXNnLmNvdW50ZXI7XG4gICAgICB0aGlzLl9oYXNDb3VudGVyID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2xhc3RDb3VudGVyID0gbXNnLmNvdW50ZXI7XG4gICAgICB0aGlzLl9sYXN0RGF0YUZyb21TZXJ2ZXJUaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAvLyBJZiB3ZSd2ZSBtaXNzZWQgYSBjb3VudGVyLCByZXBsYXkgdG8gZ2V0OyBub3RlIHRoYXQgd2UgaGFkIHRvIHVwZGF0ZSBfbGFzdENvdW50ZXJcbiAgICAgIC8vIGZvciByZXBsYXlFdmVudHMgdG8gd29yayBjb3JyZWN0bHkuXG4gICAgICBpZiAoc2tpcHBlZENvdW50ZXIpIHtcbiAgICAgICAgdGhpcy5yZXBsYXlFdmVudHModGhpcy5fbGFzdFRpbWVzdGFtcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9sYXN0VGltZXN0YW1wID0gbmV3IERhdGUobXNnLnRpbWVzdGFtcCkuZ2V0VGltZSgpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnRyaWdnZXIoJ21lc3NhZ2UnLCB7XG4gICAgICAgIGRhdGE6IG1zZyxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9yZXNjaGVkdWxlUGluZygpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdMYXllci1XZWJzb2NrZXQ6IEZhaWxlZCB0byBoYW5kbGUgd2Vic29ja2V0IG1lc3NhZ2U6ICcgKyBlcnIgKyAnXFxuJywgZXZ0LmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNjaGVkdWxlIGEgcGluZyByZXF1ZXN0IHdoaWNoIGhlbHBzIHVzIHZlcmlmeSB0aGF0IHRoZSBjb25uZWN0aW9uIGlzIHN0aWxsIGFsaXZlLFxuICAgKiBhbmQgdGhhdCB3ZSBoYXZlbid0IG1pc3NlZCBhbnkgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNjaGVkdWxlUGluZ1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc2NoZWR1bGVQaW5nKCkge1xuICAgIGlmICh0aGlzLl9uZXh0UGluZ0lkKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fbmV4dFBpbmdJZCk7XG4gICAgfVxuICAgIHRoaXMuX25leHRQaW5nSWQgPSBzZXRUaW1lb3V0KHRoaXMuX3BpbmcuYmluZCh0aGlzKSwgdGhpcy5waW5nRnJlcXVlbmN5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgY291bnRlciByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdG8gdmVyaWZ5IHRoYXQgd2UgYXJlIHN0aWxsIGNvbm5lY3RlZCBhbmRcbiAgICogaGF2ZSBub3QgbWlzc2VkIGFueSBldmVudHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3BpbmdcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9waW5nKCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IHBpbmcnKTtcbiAgICB0aGlzLl9uZXh0UGluZ0lkID0gMDtcbiAgICBpZiAodGhpcy5faXNPcGVuKCkpIHtcbiAgICAgIC8vIE5PVEU6IG9uTWVzc2FnZSB3aWxsIGFscmVhZHkgaGF2ZSBjYWxsZWQgcmVzY2hlZHVsZVBpbmcsIGJ1dCBpZiB0aGVyZSB3YXMgbm8gcmVzcG9uc2UsIHRoZW4gdGhlIGVycm9yIGhhbmRsZXIgd291bGQgTk9UIGhhdmUgY2FsbGVkIGl0LlxuICAgICAgdGhpcy5nZXRDb3VudGVyKHRoaXMuX3Jlc2NoZWR1bGVQaW5nLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIENsb3NlIHRoZSB3ZWJzb2NrZXQuXG4gICAqXG4gICAqIEBtZXRob2QgY2xvc2VcbiAgICovXG4gIGNsb3NlKCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IGNsb3NlIHJlcXVlc3RlZCcpO1xuICAgIHRoaXMuX2Nsb3NpbmcgPSB0cnVlO1xuICAgIHRoaXMuaXNPcGVuID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuX3NvY2tldCkge1xuICAgICAgLy8gQ2xvc2UgYWxsIGV2ZW50IGhhbmRsZXJzIGFuZCBzZXQgc29ja2V0IHRvIG51bGxcbiAgICAgIC8vIHdpdGhvdXQgd2FpdGluZyBmb3IgYnJvd3NlciBldmVudCB0byBjYWxsXG4gICAgICAvLyBfb25Tb2NrZXRDbG9zZSBhcyB0aGUgbmV4dCBjb21tYW5kIGFmdGVyIGNsb3NlXG4gICAgICAvLyBtaWdodCByZXF1aXJlIGNyZWF0aW5nIGEgbmV3IHNvY2tldFxuICAgICAgdGhpcy5fb25Tb2NrZXRDbG9zZSgpO1xuICAgICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgICB0aGlzLl9zb2NrZXQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgcGFja2V0IGFjcm9zcyB0aGUgd2Vic29ja2V0XG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gICAqL1xuICBzZW5kKG9iaikge1xuICAgIHRoaXMuX3NvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsb3NlKCk7XG4gICAgaWYgKHRoaXMuX25leHRQaW5nSWQpIGNsZWFyVGltZW91dCh0aGlzLl9uZXh0UGluZ0lkKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogSWYgdGhlIHNvY2tldCBoYXMgY2xvc2VkIChvciBpZiB0aGUgY2xvc2UgbWV0aG9kIGZvcmNlcyBpdCBjbG9zZWQpXG4gICAqIFJlbW92ZSBhbGwgZXZlbnQgaGFuZGxlcnMgYW5kIGlmIGFwcHJvcHJpYXRlLCBzY2hlZHVsZSBhIHJldHJ5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9vblNvY2tldENsb3NlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfb25Tb2NrZXRDbG9zZSgpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBjbG9zZWQnKTtcbiAgICB0aGlzLmlzT3BlbiA9IGZhbHNlO1xuICAgIGlmICghdGhpcy5fY2xvc2luZykge1xuICAgICAgdGhpcy5fc2NoZWR1bGVSZWNvbm5lY3QoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZW1vdmVTb2NrZXRFdmVudHMoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2Rpc2Nvbm5lY3RlZCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYWxsIGV2ZW50IGhhbmRsZXJzIG9uIHRoZSBjdXJyZW50IHNvY2tldC5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVtb3ZlU29ja2V0RXZlbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVtb3ZlU29ja2V0RXZlbnRzKCkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICh0eXBlb2YgV2ViU29ja2V0ICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLl9zb2NrZXQpIHtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5fb25NZXNzYWdlKTtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbG9zZScsIHRoaXMuX29uU29ja2V0Q2xvc2UpO1xuICAgICAgdGhpcy5fc29ja2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ29wZW4nLCB0aGlzLl9vbk9wZW4pO1xuICAgICAgdGhpcy5fc29ja2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5fb25FcnJvcik7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9zb2NrZXQpIHtcbiAgICAgIHRoaXMuX3NvY2tldC5vbm1lc3NhZ2UgPSBudWxsO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uY2xvc2UgPSBudWxsO1xuICAgICAgdGhpcy5fc29ja2V0Lm9ub3BlbiA9IG51bGw7XG4gICAgICB0aGlzLl9zb2NrZXQub25lcnJvciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIGFuIGF0dGVtcHQgdG8gcmVjb25uZWN0IHRvIHRoZSBzZXJ2ZXIuICBJZiB0aGUgb25saW5lTWFuYWdlclxuICAgKiBkZWNsYXJlcyB1cyB0byBiZSBvZmZsaW5lLCBkb24ndCBib3RoZXIgcmVjb25uZWN0aW5nLiAgQSByZWNvbm5lY3RcbiAgICogYXR0ZW1wdCB3aWxsIGJlIHRyaWdnZXJlZCBhcyBzb29uIGFzIHRoZSBvbmxpbmUgbWFuYWdlciByZXBvcnRzIHdlIGFyZSBvbmxpbmUgYWdhaW4uXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgZHVyYXRpb24gb2Ygb3VyIGRlbGF5IGNhbiBub3QgZXhjZWRlIHRoZSBvbmxpbmVNYW5hZ2VyJ3MgcGluZyBmcmVxdWVuY3lcbiAgICogb3IgaXQgd2lsbCBkZWNsYXJlIHVzIHRvIGJlIG9mZmxpbmUgd2hpbGUgd2UgYXR0ZW1wdCBhIHJlY29ubmVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVSZWNvbm5lY3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZVJlY29ubmVjdCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCB8fCAhdGhpcy5jbGllbnQuaXNPbmxpbmUpIHJldHVybjtcblxuICAgIGNvbnN0IG1heERlbGF5ID0gKHRoaXMuY2xpZW50Lm9ubGluZU1hbmFnZXIucGluZ0ZyZXF1ZW5jeSAtIDEwMDApIC8gMTAwMDtcbiAgICBjb25zdCBkZWxheSA9IFV0aWxzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMobWF4RGVsYXksIE1hdGgubWluKDE1LCB0aGlzLl9sb3N0Q29ubmVjdGlvbkNvdW50KSk7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgUmVjb25uZWN0IGluICcgKyBkZWxheSArICcgc2Vjb25kcycpO1xuICAgIGlmICghdGhpcy5fcmVjb25uZWN0SWQpIHtcbiAgICAgIHRoaXMuX3JlY29ubmVjdElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdElkID0gMDtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0KCk7XG4gICAgICB9LCBkZWxheSAqIDEwMDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCZWZvcmUgdGhlIHNjaGVkdWxlZCByZWNvbm5lY3QgY2FuIGNhbGwgYGNvbm5lY3QoKWAgdmFsaWRhdGUgdGhhdCB3ZSBkaWRuJ3QgbG9zZSB0aGUgd2Vic29ja2V0XG4gICAqIGR1ZSB0byBsb3NzIG9mIGF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF92YWxpZGF0ZVNlc3Npb25CZWZvcmVSZWNvbm5lY3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF92YWxpZGF0ZVNlc3Npb25CZWZvcmVSZWNvbm5lY3QoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lKSByZXR1cm47XG5cbiAgICBjb25zdCBtYXhEZWxheSA9IDMwICogMTAwMDsgLy8gbWF4aW11bSBkZWxheSBvZiAzMCBzZWNvbmRzIHBlciBwaW5nXG4gICAgY29uc3QgZGlmZiA9IERhdGUubm93KCkgLSB0aGlzLl9sYXN0VmFsaWRhdGVTZXNzaW9uUmVxdWVzdCAtIG1heERlbGF5O1xuICAgIGlmIChkaWZmIDwgMCkge1xuICAgICAgLy8gVGhpcyBpcyBpZGVudGljYWwgdG8gd2hhdHMgaW4gX3NjaGVkdWxlUmVjb25uZWN0IGFuZCBjb3VsZCBiZSBjbGVhbmVyXG4gICAgICBpZiAoIXRoaXMuX3JlY29ubmVjdElkKSB7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fcmVjb25uZWN0SWQgPSAwO1xuICAgICAgICAgIHRoaXMuX3ZhbGlkYXRlU2Vzc2lvbkJlZm9yZVJlY29ubmVjdCgpO1xuICAgICAgICB9LCBNYXRoLmFicyhkaWZmKSArIDEwMDApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9sYXN0VmFsaWRhdGVTZXNzaW9uUmVxdWVzdCA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6ICcvP2FjdGlvbj12YWxpZGF0ZUNvbm5lY3Rpb25Gb3JXZWJzb2NrZXQmY2xpZW50PScgKyB0aGlzLmNsaWVudC5jb25zdHJ1Y3Rvci52ZXJzaW9uLFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB0aGlzLmNvbm5lY3QoKTtcbiAgICAgICAgLy8gaWYgbm90IHN1Y2Nlc3NmdWwsIHRoZSB0aGlzLmNsaWVudC54aHIgd2lsbCBoYW5kbGUgcmVhdXRoZW50aWNhdGlvblxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSXMgdGhlIHdlYnNvY2tldCBjb25uZWN0aW9uIGN1cnJlbnRseSBvcGVuP1xuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLmlzT3BlbiA9IGZhbHNlO1xuXG4vKipcbiAqIHNldFRpbWVvdXQgSUQgZm9yIGNhbGxpbmcgY29ubmVjdCgpXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge051bWJlcn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX3JlY29ubmVjdElkID0gMDtcblxuLyoqXG4gKiBzZXRUaW1lb3V0IElEIGZvciBjYWxsaW5nIF9jb25uZWN0aW9uRmFpbGVkKClcbiAqIEBwcml2YXRlXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fY29ubmVjdGlvbkZhaWxlZElkID0gMDtcblxuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xhc3RUaW1lc3RhbXAgPSAwO1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCA9IDA7XG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdENvdW50ZXIgPSBudWxsO1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2hhc0NvdW50ZXIgPSBmYWxzZTtcblxuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2luUmVwbGF5ID0gZmFsc2U7XG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbmVlZHNSZXBsYXlGcm9tID0gbnVsbDtcblxuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX3JlcGxheVJldHJ5Q291bnQgPSAwO1xuXG4vKipcbiAqIFRpbWUgaW4gbWlsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgY2FsbCB0byBfdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0XG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdFZhbGlkYXRlU2Vzc2lvblJlcXVlc3QgPSAwO1xuXG4vKipcbiAqIEZyZXF1ZW5jeSB3aXRoIHdoaWNoIHRoZSB3ZWJzb2NrZXQgY2hlY2tzIHRvIHNlZSBpZiBhbnkgd2Vic29ja2V0IG5vdGlmaWNhdGlvbnNcbiAqIGhhdmUgYmVlbiBtaXNzZWQuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5waW5nRnJlcXVlbmN5ID0gMzAwMDA7XG5cbi8qKlxuICogVGhlIENsaWVudCB0aGF0IG93bnMgdGhpcy5cbiAqIEB0eXBlIHtsYXllci5DbGllbnR9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogVGhlIFNvY2tldCBDb25uZWN0aW9uIGluc3RhbmNlXG4gKiBAdHlwZSB7V2Vic29ja2V0fVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fc29ja2V0ID0gbnVsbDtcblxuLyoqXG4gKiBJcyB0aGUgd2Vic29ja2V0IGNvbm5lY3Rpb24gYmVpbmcgY2xvc2VkIGJ5IGEgY2FsbCB0byBjbG9zZSgpP1xuICogSWYgc28sIHdlIGNhbiBpZ25vcmUgYW55IGVycm9ycyB0aGF0IHNpZ25hbCB0aGUgc29ja2V0IGFzIGNsb3NpbmcuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2Nsb3NpbmcgPSBmYWxzZTtcblxuLyoqXG4gKiBOdW1iZXIgb2YgZmFpbGVkIGF0dGVtcHRzIHRvIHJlY29ubmVjdC5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9sb3N0Q29ubmVjdGlvbkNvdW50ID0gMDtcblxuXG5Tb2NrZXRNYW5hZ2VyLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBBIGRhdGEgcGFja2V0IGhhcyBiZWVuIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlci5cbiAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBsYXllckV2ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBsYXllckV2ZW50LmRhdGEgLSBUaGUgZGF0YSB0aGF0IHdhcyByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICovXG4gICdtZXNzYWdlJyxcblxuICAvKipcbiAgICogVGhlIHdlYnNvY2tldCBpcyBub3cgY29ubmVjdGVkLlxuICAgKiBAZXZlbnQgY29ubmVjdGVkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gICdjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBUaGUgd2Vic29ja2V0IGlzIG5vIGxvbmdlciBjb25uZWN0ZWRcbiAgICogQGV2ZW50IGRpc2Nvbm5lY3RlZFxuICAgKiBAcHJvdGVjdGVkXG4gICAqL1xuICAnZGlzY29ubmVjdGVkJyxcblxuICAvKipcbiAgICogV2Vic29ja2V0IGV2ZW50cyB3ZXJlIG1pc3NlZDsgd2UgYXJlIHJlc3luY2luZyB3aXRoIHRoZSBzZXJ2ZXJcbiAgICogQGV2ZW50IHJlcGxheS1iZWd1blxuICAgKi9cbiAgJ3N5bmNpbmcnLFxuXG4gIC8qKlxuICAgKiBXZWJzb2NrZXQgZXZlbnRzIHdlcmUgbWlzc2VkOyB3ZSByZXN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgYW5kIGFyZSBub3cgZG9uZVxuICAgKiBAZXZlbnQgcmVwbGF5LWJlZ3VuXG4gICAqL1xuICAnc3luY2VkJyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShTb2NrZXRNYW5hZ2VyLCBbU29ja2V0TWFuYWdlciwgJ1NvY2tldE1hbmFnZXInXSk7XG5tb2R1bGUuZXhwb3J0cyA9IFNvY2tldE1hbmFnZXI7XG4iXX0=
