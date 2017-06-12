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
var LayerError = require('../layer-error');

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
     * Note that if you'd like to see how dead websockets are handled, you can try something like this:
     *
     * ```
     * var WS = function WebSocket(url) {
        this.url = url;
        this.close = function() {};
        this.send = function(msg) {console.log("SEND ", msg);};
        this.addEventListener = function(name, callback) {
          this["on" + name] = callback;
        };
        this.removeEventListener = function() {};
        this.readyState = 1;
        setTimeout(function() {this.onopen();}.bind(this), 100);
      };
      WS.CONNECTING = 0;
      WS.OPEN = 1;
      WS.CLOSING = 2;
      WS.CLOSED = 3;
      ```
     *
     * @method connect
     * @param  {layer.SyncEvent} evt - Ignored parameter
     */

  }, {
    key: 'connect',
    value: function connect(evt) {
      if (this.client.isDestroyed || !this.client.isOnline) return;
      if (this._isOpen()) return this._reconnect();

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
        if (this._hasCounter && this._lastTimestamp) {
          this.resync(this._lastTimestamp);
        } else {
          this._enablePresence();
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
    value: function getCounter(_callback) {
      var _this2 = this;

      var tooSoon = Date.now() - this._lastGetCounterRequest < 1000;
      if (tooSoon) {
        if (!this._lastGetCounterId) {
          this._lastGetCounterId = setTimeout(function () {
            _this2._lastGetCounterId = 0;
            _this2.getCounter(_callback);
          }, Date.now() - this._lastGetCounterRequest - 1000);
        }
        return;
      }
      this._lastGetCounterRequest = Date.now();
      if (this._lastGetCounterId) {
        clearTimeout(this._lastGetCounterId);
        this._lastGetCounterId = 0;
      }

      logger.debug('Websocket request: getCounter');
      this.client.socketRequestManager.sendRequest({
        data: {
          method: 'Counter.read'
        },
        callback: function callback(result) {
          logger.debug('Websocket response: getCounter ' + result.data.counter);
          if (_callback) {
            if (result.success) {
              _callback(true, result.data.counter, result.fullData.counter);
            } else {
              _callback(false);
            }
          }
        },
        isChangesArray: false
      });
    }

    /**
     * Replays all missed change packets since the specified timestamp
     *
     * @method resync
     * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
     * @param  {Function} [callback] - Optional callback for completion
     */

  }, {
    key: 'resync',
    value: function resync(timestamp, callback) {
      var _this3 = this;

      if (!timestamp) throw new Error(LayerError.dictionary.valueNotSupported);
      if (typeof timestamp === 'number') timestamp = new Date(timestamp).toISOString();

      // Cancel any prior operation; presumably we lost connection and they're dead anyways,
      // but the callback triggering on these could be disruptive.
      this.client.socketRequestManager.cancelOperation('Event.replay');
      this.client.socketRequestManager.cancelOperation('Presence.sync');
      this._replayEvents(timestamp, function () {
        _this3._enablePresence(timestamp, function () {
          _this3.trigger('synced');
          if (callback) callback();
        });
      });
    }

    /**
     * Replays all missed change packets since the specified timestamp
     *
     * @method _replayEvents
     * @private
     * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
     * @param  {Function} [callback] - Optional callback for completion
     */

  }, {
    key: '_replayEvents',
    value: function _replayEvents(timestamp, _callback2) {
      var _this4 = this;

      // If we are simply unable to replay because we're disconnected, capture the _needsReplayFrom
      if (!this._isOpen() && !this._needsReplayFrom) {
        logger.debug('Websocket request: _replayEvents updating _needsReplayFrom');
        this._needsReplayFrom = timestamp;
      } else {
        logger.info('Websocket request: _replayEvents');
        this.client.socketRequestManager.sendRequest({
          data: {
            method: 'Event.replay',
            data: {
              from_timestamp: timestamp
            }
          },
          callback: function callback(result) {
            return _this4._replayEventsComplete(timestamp, _callback2, result.success);
          },
          isChangesArray: false
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
      var _this5 = this;

      if (success) {
        this._replayRetryCount = 0;

        // If replay was completed, and no other requests for replay, then we're done.
        if (!this._needsReplayFrom) {
          logger.info('Websocket replay complete');
          if (callback) callback();
        }

        // If replayEvents was called during a replay, then replay
        // from the given timestamp.  If request failed, then we need to retry from _lastTimestamp
        else if (this._needsReplayFrom) {
            logger.info('Websocket replay partially complete');
            var t = this._needsReplayFrom;
            this._needsReplayFrom = null;
            this._replayEvents(t);
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
            return _this5._replayEvents(timestamp);
          }, delay * 1000);
          this._replayRetryCount++;
        } else {
          logger.error('Websocket Event.replay has failed');
        }
    }

    /**
     * Resubscribe to presence and replay missed presence changes.
     *
     * @method _enablePresence
     * @private
     * @param  {Date}     timestamp
     * @param  {Function} callback
     */

  }, {
    key: '_enablePresence',
    value: function _enablePresence(timestamp, callback) {
      this.client.socketRequestManager.sendRequest({
        data: {
          method: 'Presence.subscribe'
        },
        callback: null,
        isChangesArray: false
      });

      if (this.client.isPresenceEnabled) {
        this.client.socketRequestManager.sendRequest({
          data: {
            method: 'Presence.update',
            data: [{ operation: 'set', property: 'status', value: 'auto' }]
          },
          callback: null,
          isChangesArray: false
        });
      }

      if (timestamp) {
        this.syncPresence(timestamp, callback);
      } else if (callback) {
        callback({ success: true });
      }
    }

    /**
     * Synchronize all presence data or catch up on missed presence data.
     *
     * Typically this is called by layer.Websockets.SocketManager._enablePresence automatically,
     * but there may be occasions where an app wants to directly trigger this action.
     *
     * @method syncPresence
     * @param {String} timestamp    `Date.toISOString()` formatted string, returns all presence changes since that timestamp.  Returns all followed presence
     *       if no timestamp is provided.
     * @param {Function} [callback]   Function to call when sync is completed.
     */

  }, {
    key: 'syncPresence',
    value: function syncPresence(timestamp, callback) {
      if (timestamp) {
        // Return value for use in unit tests
        return this.client.socketRequestManager.sendRequest({
          data: {
            method: 'Presence.sync',
            data: {
              since: timestamp
            }
          },
          isChangesArray: true,
          callback: callback
        });
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
          this.resync(this._lastTimestamp);
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
      var _this6 = this;

      if (this.isDestroyed || !this.client.isOnline || !this.client.isAuthenticated) return;

      var delay = Utils.getExponentialBackoffSeconds(this.maxDelaySecondsBetweenReconnect, Math.min(15, this._lostConnectionCount));
      logger.debug('Websocket Reconnect in ' + delay + ' seconds');
      if (!this._reconnectId) {
        this._reconnectId = setTimeout(function () {
          _this6._reconnectId = 0;
          _this6._validateSessionBeforeReconnect();
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
      var _this7 = this;

      if (this.isDestroyed || !this.client.isOnline || !this.client.isAuthenticated) return;

      var maxDelay = this.maxDelaySecondsBetweenReconnect * 1000;
      var diff = Date.now() - this._lastValidateSessionRequest - maxDelay;
      if (diff < 0) {
        // This is identical to whats in _scheduleReconnect and could be cleaner
        if (!this._reconnectId) {
          this._reconnectId = setTimeout(function () {
            _this7._reconnectId = 0;
            _this7._validateSessionBeforeReconnect();
          }, Math.abs(diff) + 1000);
        }
      } else {
        this._lastValidateSessionRequest = Date.now();
        this.client.xhr({
          url: '/?action=validateConnectionForWebsocket&client=' + this.client.constructor.version,
          method: 'GET',
          sync: false
        }, function (result) {
          if (result.success) _this7.connect();
          if (result.status === 401) {
            // client-authenticator.js captures this state and handles it; `connect()` will be called once reauthentication completes
          } else {
            _this7._scheduleReconnect();
          }
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

SocketManager.prototype._needsReplayFrom = null;

SocketManager.prototype._replayRetryCount = 0;

SocketManager.prototype._lastGetCounterRequest = 0;
SocketManager.prototype._lastGetCounterId = 0;

/**
 * Time in miliseconds since the last call to _validateSessionBeforeReconnect
 * @type {Number}
 */
SocketManager.prototype._lastValidateSessionRequest = 0;

/**
 * Frequency with which the websocket checks to see if any websocket notifications
 * have been missed.  This test is done by calling `getCounter`
 *
 * @type {Number}
 */
SocketManager.prototype.pingFrequency = 30000;

/**
 * Delay between reconnect attempts
 *
 * @type {Number}
 */
SocketManager.prototype.maxDelaySecondsBetweenReconnect = 30;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3NvY2tldC1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiVXRpbHMiLCJsb2dnZXIiLCJMYXllckVycm9yIiwiV0VCU09DS0VUX1BST1RPQ09MIiwiU29ja2V0TWFuYWdlciIsIm9wdGlvbnMiLCJjbGllbnQiLCJFcnJvciIsIl9vbk1lc3NhZ2UiLCJiaW5kIiwiX29uT3BlbiIsIl9vblNvY2tldENsb3NlIiwiX29uRXJyb3IiLCJpc0F1dGhlbnRpY2F0ZWQiLCJvbmxpbmVNYW5hZ2VyIiwiaXNPbmxpbmUiLCJjb25uZWN0Iiwib24iLCJfb25saW5lU3RhdGVDaGFuZ2UiLCJfbGFzdFRpbWVzdGFtcCIsIkRhdGUiLCJub3ciLCJfbGFzdERhdGFGcm9tU2VydmVyVGltZXN0YW1wIiwiX2xhc3RDb3VudGVyIiwiX2hhc0NvdW50ZXIiLCJfbmVlZHNSZXBsYXlGcm9tIiwiZXZ0IiwiX3JlY29ubmVjdCIsInJlc2V0IiwiY2xvc2UiLCJfcmVzZXQiLCJpc0Rlc3Ryb3llZCIsIl9pc09wZW4iLCJfY2xvc2luZyIsInVybCIsIndlYnNvY2tldFVybCIsInNlc3Npb25Ub2tlbiIsIldTIiwiV2ViU29ja2V0IiwidzNjd2Vic29ja2V0IiwiX3NvY2tldCIsIm9ubWVzc2FnZSIsIm9uY2xvc2UiLCJvbm9wZW4iLCJvbmVycm9yIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9jb25uZWN0aW9uRmFpbGVkSWQiLCJzZXRUaW1lb3V0IiwiX2Nvbm5lY3Rpb25GYWlsZWQiLCJjbGVhclRpbWVvdXQiLCJtc2ciLCJ3YXJuIiwiaXNPcGVuIiwiX3JlbW92ZVNvY2tldEV2ZW50cyIsImUiLCJfY2xlYXJDb25uZWN0aW9uRmFpbGVkIiwiX2xvc3RDb25uZWN0aW9uQ291bnQiLCJ0cmlnZ2VyIiwiZGVidWciLCJyZXN5bmMiLCJfZW5hYmxlUHJlc2VuY2UiLCJfcmVzY2hlZHVsZVBpbmciLCJyZWFkeVN0YXRlIiwiT1BFTiIsImVyciIsIl9zY2hlZHVsZVJlY29ubmVjdCIsImJvZHkiLCJzZW5kIiwiSlNPTiIsInN0cmluZ2lmeSIsInR5cGUiLCJjYWxsYmFjayIsInRvb1Nvb24iLCJfbGFzdEdldENvdW50ZXJSZXF1ZXN0IiwiX2xhc3RHZXRDb3VudGVySWQiLCJnZXRDb3VudGVyIiwic29ja2V0UmVxdWVzdE1hbmFnZXIiLCJzZW5kUmVxdWVzdCIsImRhdGEiLCJtZXRob2QiLCJyZXN1bHQiLCJjb3VudGVyIiwic3VjY2VzcyIsImZ1bGxEYXRhIiwiaXNDaGFuZ2VzQXJyYXkiLCJ0aW1lc3RhbXAiLCJkaWN0aW9uYXJ5IiwidmFsdWVOb3RTdXBwb3J0ZWQiLCJ0b0lTT1N0cmluZyIsImNhbmNlbE9wZXJhdGlvbiIsIl9yZXBsYXlFdmVudHMiLCJpbmZvIiwiZnJvbV90aW1lc3RhbXAiLCJfcmVwbGF5RXZlbnRzQ29tcGxldGUiLCJfcmVwbGF5UmV0cnlDb3VudCIsInQiLCJtYXhEZWxheSIsImRlbGF5IiwiZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyIsIk1hdGgiLCJtaW4iLCJlcnJvciIsImlzUHJlc2VuY2VFbmFibGVkIiwib3BlcmF0aW9uIiwicHJvcGVydHkiLCJ2YWx1ZSIsInN5bmNQcmVzZW5jZSIsInNpbmNlIiwicGFyc2UiLCJza2lwcGVkQ291bnRlciIsImdldFRpbWUiLCJfbmV4dFBpbmdJZCIsIl9waW5nIiwicGluZ0ZyZXF1ZW5jeSIsIm9iaiIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJtYXhEZWxheVNlY29uZHNCZXR3ZWVuUmVjb25uZWN0IiwiX3JlY29ubmVjdElkIiwiX3ZhbGlkYXRlU2Vzc2lvbkJlZm9yZVJlY29ubmVjdCIsImRpZmYiLCJfbGFzdFZhbGlkYXRlU2Vzc2lvblJlcXVlc3QiLCJhYnMiLCJ4aHIiLCJjb25zdHJ1Y3RvciIsInZlcnNpb24iLCJzeW5jIiwic3RhdHVzIiwicHJvdG90eXBlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5Iiwi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dkUsb0JBQXhCLEdBQStDLENBQS9DOztBQUdBcEQsY0FBYzRILGdCQUFkLEdBQWlDO0FBQy9COzs7Ozs7QUFNQSxTQVArQjs7QUFTL0I7Ozs7O0FBS0EsV0FkK0I7O0FBZ0IvQjs7Ozs7QUFLQSxjQXJCK0I7O0FBdUIvQjs7OztBQUlBLFNBM0IrQjs7QUE2Qi9COzs7O0FBSUEsUUFqQytCLEVBa0MvQkMsTUFsQytCLENBa0N4Qm5JLEtBQUtrSSxnQkFsQ21CLENBQWpDO0FBbUNBbEksS0FBS29JLFNBQUwsQ0FBZUMsS0FBZixDQUFxQi9ILGFBQXJCLEVBQW9DLENBQUNBLGFBQUQsRUFBZ0IsZUFBaEIsQ0FBcEM7QUFDQWdJLE9BQU9DLE9BQVAsR0FBaUJqSSxhQUFqQiIsImZpbGUiOiJzb2NrZXQtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhpcyBjb21wb25lbnQgbWFuYWdlc1xuICpcbiAqIDEuIHJlY2lldmluZyB3ZWJzb2NrZXQgZXZlbnRzXG4gKiAyLiBQcm9jZXNzaW5nIHRoZW1cbiAqIDMuIFRyaWdnZXJpbmcgZXZlbnRzIG9uIGNvbXBsZXRpbmcgdGhlbVxuICogNC4gU2VuZGluZyB0aGVtXG4gKlxuICogQXBwbGljYXRpb25zIHR5cGljYWxseSBkbyBub3QgaW50ZXJhY3Qgd2l0aCB0aGlzIGNvbXBvbmVudCwgYnV0IG1heSBzdWJzY3JpYmVcbiAqIHRvIHRoZSBgbWVzc2FnZWAgZXZlbnQgaWYgdGhleSB3YW50IHJpY2hlciBldmVudCBpbmZvcm1hdGlvbiB0aGFuIGlzIGF2YWlsYWJsZVxuICogdGhyb3VnaCB0aGUgbGF5ZXIuQ2xpZW50IGNsYXNzLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5jb25zdCB7IFdFQlNPQ0tFVF9QUk9UT0NPTCB9ID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcblxuY2xhc3MgU29ja2V0TWFuYWdlciBleHRlbmRzIFJvb3Qge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHdlYnNvY2tldCBtYW5hZ2VyXG4gICAqXG4gICAqICAgICAgdmFyIHNvY2tldE1hbmFnZXIgPSBuZXcgbGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyKHtcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGllbnQpIHRocm93IG5ldyBFcnJvcignU29ja2V0TWFuYWdlciByZXF1aXJlcyBhIGNsaWVudCcpO1xuXG4gICAgLy8gSW5zdXJlIHRoYXQgb24vb2ZmIG1ldGhvZHMgZG9uJ3QgbmVlZCB0byBjYWxsIGJpbmQsIHRoZXJlZm9yZSBtYWtpbmcgaXQgZWFzeVxuICAgIC8vIHRvIGFkZC9yZW1vdmUgZnVuY3Rpb25zIGFzIGV2ZW50IGxpc3RlbmVycy5cbiAgICB0aGlzLl9vbk1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9vbk9wZW4gPSB0aGlzLl9vbk9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLl9vblNvY2tldENsb3NlID0gdGhpcy5fb25Tb2NrZXRDbG9zZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX29uRXJyb3IgPSB0aGlzLl9vbkVycm9yLmJpbmQodGhpcyk7XG5cbiAgICAvLyBJZiB0aGUgY2xpZW50IGlzIGF1dGhlbnRpY2F0ZWQsIHN0YXJ0IGl0IHVwLlxuICAgIGlmICh0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQgJiYgdGhpcy5jbGllbnQub25saW5lTWFuYWdlci5pc09ubGluZSkge1xuICAgICAgdGhpcy5jb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5jbGllbnQub24oJ29ubGluZScsIHRoaXMuX29ubGluZVN0YXRlQ2hhbmdlLCB0aGlzKTtcblxuICAgIC8vIEFueSB0aW1lIHRoZSBDbGllbnQgdHJpZ2dlcnMgYSByZWFkeSBldmVudCB3ZSBuZWVkIHRvIHJlY29ubmVjdC5cbiAgICB0aGlzLmNsaWVudC5vbignYXV0aGVudGljYXRlZCcsIHRoaXMuY29ubmVjdCwgdGhpcyk7XG5cbiAgICB0aGlzLl9sYXN0VGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsIHRoaXMgd2hlbiB3ZSB3YW50IHRvIHJlc2V0IGFsbCB3ZWJzb2NrZXQgc3RhdGU7IHRoaXMgd291bGQgYmUgZG9uZSBhZnRlciBhIGxlbmd0aHkgcGVyaW9kXG4gICAqIG9mIGJlaW5nIGRpc2Nvbm5lY3RlZC4gIFRoaXMgcHJldmVudHMgRXZlbnQucmVwbGF5IGZyb20gYmVpbmcgY2FsbGVkIG9uIHJlY29ubmVjdGluZy5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLl9sYXN0VGltZXN0YW1wID0gMDtcbiAgICB0aGlzLl9sYXN0RGF0YUZyb21TZXJ2ZXJUaW1lc3RhbXAgPSAwO1xuICAgIHRoaXMuX2xhc3RDb3VudGVyID0gbnVsbDtcbiAgICB0aGlzLl9oYXNDb3VudGVyID0gZmFsc2U7XG5cbiAgICB0aGlzLl9uZWVkc1JlcGxheUZyb20gPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEV2ZW50IGhhbmRsZXIgaXMgdHJpZ2dlcmVkIGFueSB0aW1lIHRoZSBjbGllbnQncyBvbmxpbmUgc3RhdGUgY2hhbmdlcy5cbiAgICogSWYgZ29pbmcgb25saW5lIHdlIG5lZWQgdG8gcmVjb25uZWN0IChpLmUuIHdpbGwgY2xvc2UgYW55IGV4aXN0aW5nIHdlYnNvY2tldCBjb25uZWN0aW9ucyBhbmQgdGhlbiBvcGVuIGEgbmV3IGNvbm5lY3Rpb24pXG4gICAqIElmIGdvaW5nIG9mZmxpbmUsIGNsb3NlIHRoZSB3ZWJzb2NrZXQgYXMgaXRzIG5vIGxvbmdlciB1c2VmdWwvcmVsZXZhbnQuXG4gICAqIEBtZXRob2QgX29ubGluZVN0YXRlQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfb25saW5lU3RhdGVDaGFuZ2UoZXZ0KSB7XG4gICAgaWYgKCF0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcbiAgICBpZiAoZXZ0LmlzT25saW5lKSB7XG4gICAgICB0aGlzLl9yZWNvbm5lY3QoZXZ0LnJlc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvbm5lY3QgdG8gdGhlIHNlcnZlciwgb3B0aW9uYWxseSByZXNldHRpbmcgYWxsIGRhdGEgaWYgbmVlZGVkLlxuICAgKiBAbWV0aG9kIF9yZWNvbm5lY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtib29sZWFufSByZXNldFxuICAgKi9cbiAgX3JlY29ubmVjdChyZXNldCkge1xuICAgIC8vIFRoZSBzeW5jIG1hbmFnZXIgd2lsbCByZWlzc3VlIGFueSByZXF1ZXN0cyBvbmNlIGl0IHJlY2VpdmVzIGEgJ2Nvbm5lY3QnIGV2ZW50IGZyb20gdGhlIHdlYnNvY2tldCBtYW5hZ2VyLlxuICAgIC8vIFRoZXJlIGlzIG5vIG5lZWQgdG8gaGF2ZSBhbiBlcnJvciBjYWxsYmFjayBhdCB0aGlzIHRpbWUuXG4gICAgLy8gTm90ZSB0aGF0IGNhbGxzIHRoYXQgY29tZSBmcm9tIHNvdXJjZXMgb3RoZXIgdGhhbiB0aGUgc3luYyBtYW5hZ2VyIG1heSBzdWZmZXIgZnJvbSB0aGlzLlxuICAgIC8vIE9uY2UgdGhlIHdlYnNvY2tldCBpbXBsZW1lbnRzIHJldHJ5IHJhdGhlciB0aGFuIHRoZSBzeW5jIG1hbmFnZXIsIHdlIG1heSBuZWVkIHRvIGVuYWJsZSBpdFxuICAgIC8vIHRvIHRyaWdnZXIgYSBjYWxsYmFjayBhZnRlciBzdWZmaWNpZW50IHRpbWUuICBKdXN0IGRlbGV0ZSBhbGwgY2FsbGJhY2tzLlxuICAgIHRoaXMuY2xvc2UoKTtcbiAgICBpZiAocmVzZXQpIHRoaXMuX3Jlc2V0KCk7XG4gICAgdGhpcy5jb25uZWN0KCk7XG4gIH1cblxuICAvKipcbiAgICogQ29ubmVjdCB0byB0aGUgd2Vic29ja2V0IHNlcnZlclxuICAgKlxuICAgKiBOb3RlIHRoYXQgaWYgeW91J2QgbGlrZSB0byBzZWUgaG93IGRlYWQgd2Vic29ja2V0cyBhcmUgaGFuZGxlZCwgeW91IGNhbiB0cnkgc29tZXRoaW5nIGxpa2UgdGhpczpcbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBXUyA9IGZ1bmN0aW9uIFdlYlNvY2tldCh1cmwpIHtcbiAgICAgIHRoaXMudXJsID0gdXJsO1xuICAgICAgdGhpcy5jbG9zZSA9IGZ1bmN0aW9uKCkge307XG4gICAgICB0aGlzLnNlbmQgPSBmdW5jdGlvbihtc2cpIHtjb25zb2xlLmxvZyhcIlNFTkQgXCIsIG1zZyk7fTtcbiAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXNbXCJvblwiICsgbmFtZV0gPSBjYWxsYmFjaztcbiAgICAgIH07XG4gICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbigpIHt9O1xuICAgICAgdGhpcy5yZWFkeVN0YXRlID0gMTtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7dGhpcy5vbm9wZW4oKTt9LmJpbmQodGhpcyksIDEwMCk7XG4gICAgfTtcbiAgICBXUy5DT05ORUNUSU5HID0gMDtcbiAgICBXUy5PUEVOID0gMTtcbiAgICBXUy5DTE9TSU5HID0gMjtcbiAgICBXUy5DTE9TRUQgPSAzO1xuICAgIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSBldnQgLSBJZ25vcmVkIHBhcmFtZXRlclxuICAgKi9cbiAgY29ubmVjdChldnQpIHtcbiAgICBpZiAodGhpcy5jbGllbnQuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lKSByZXR1cm47XG4gICAgaWYgKHRoaXMuX2lzT3BlbigpKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0KCk7XG5cbiAgICB0aGlzLl9jbG9zaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLl9sYXN0Q291bnRlciA9IC0xO1xuXG4gICAgLy8gR2V0IHRoZSBVUkwgYW5kIGNvbm5lY3QgdG8gaXRcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmNsaWVudC53ZWJzb2NrZXRVcmx9Lz9zZXNzaW9uX3Rva2VuPSR7dGhpcy5jbGllbnQuc2Vzc2lvblRva2VufWA7XG5cbiAgICAvLyBMb2FkIHVwIG91ciB3ZWJzb2NrZXQgY29tcG9uZW50IG9yIHNoaW1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGNvbnN0IFdTID0gdHlwZW9mIFdlYlNvY2tldCA9PT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKCd3ZWJzb2NrZXQnKS53M2N3ZWJzb2NrZXQgOiBXZWJTb2NrZXQ7XG5cbiAgICB0aGlzLl9zb2NrZXQgPSBuZXcgV1ModXJsLCBXRUJTT0NLRVRfUFJPVE9DT0wpO1xuXG4gICAgLy8gSWYgaXRzIHRoZSBzaGltLCBzZXQgdGhlIGV2ZW50IGhhbmxlcnNcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX3NvY2tldC5vbm1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2U7XG4gICAgICB0aGlzLl9zb2NrZXQub25jbG9zZSA9IHRoaXMuX29uU29ja2V0Q2xvc2U7XG4gICAgICB0aGlzLl9zb2NrZXQub25vcGVuID0gdGhpcy5fb25PcGVuO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uZXJyb3IgPSB0aGlzLl9vbkVycm9yO1xuICAgIH1cblxuICAgIC8vIElmIGl0cyBhIHJlYWwgd2Vic29ja2V0LCBhZGQgdGhlIGV2ZW50IGhhbmRsZXJzXG4gICAgZWxzZSB7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZSk7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlKTtcbiAgICAgIHRoaXMuX3NvY2tldC5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25PcGVuKTtcbiAgICAgIHRoaXMuX3NvY2tldC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uRXJyb3IpO1xuICAgIH1cblxuICAgIC8vIFRyaWdnZXIgYSBmYWlsdXJlIGlmIGl0IHRha2VzID49IDUgc2Vjb25kcyB0byBlc3RhYmxpc2ggYSBjb25uZWN0aW9uXG4gICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gc2V0VGltZW91dCh0aGlzLl9jb25uZWN0aW9uRmFpbGVkLmJpbmQodGhpcyksIDUwMDApO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFycyB0aGUgc2NoZWR1bGVkIGNhbGwgdG8gX2Nvbm5lY3Rpb25GYWlsZWQgdGhhdCBpcyB1c2VkIHRvIGluc3VyZSB0aGUgd2Vic29ja2V0IGRvZXMgbm90IGdldCBzdHVja1xuICAgKiBpbiBDT05ORUNUSU5HIHN0YXRlLiBUaGlzIGNhbGwgaXMgdXNlZCBhZnRlciB0aGUgY2FsbCBoYXMgY29tcGxldGVkIG9yIGZhaWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYXJDb25uZWN0aW9uRmFpbGVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJDb25uZWN0aW9uRmFpbGVkKCkge1xuICAgIGlmICh0aGlzLl9jb25uZWN0aW9uRmFpbGVkSWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9jb25uZWN0aW9uRmFpbGVkSWQpO1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gMDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIGFmdGVyIDUgc2Vjb25kcyBvZiBlbnRlcmluZyBDT05ORUNUSU5HIHN0YXRlIHdpdGhvdXQgZ2V0dGluZyBhbiBlcnJvciBvciBhIGNvbm5lY3Rpb24uXG4gICAqIENhbGxzIF9vbkVycm9yIHdoaWNoIHdpbGwgY2F1c2UgdGhpcyBhdHRlbXB0IHRvIGJlIHN0b3BwZWQgYW5kIGFub3RoZXIgY29ubmVjdGlvbiBhdHRlbXB0IHRvIGJlIHNjaGVkdWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkZhaWxlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2Nvbm5lY3Rpb25GYWlsZWQoKSB7XG4gICAgdGhpcy5fY29ubmVjdGlvbkZhaWxlZElkID0gMDtcbiAgICBjb25zdCBtc2cgPSAnV2Vic29ja2V0IGZhaWxlZCB0byBjb25uZWN0IHRvIHNlcnZlcic7XG4gICAgbG9nZ2VyLndhcm4obXNnKTtcblxuICAgIC8vIFRPRE86IEF0IHRoaXMgdGltZSB0aGVyZSBpcyBsaXR0bGUgaW5mb3JtYXRpb24gb24gd2hhdCBoYXBwZW5zIHdoZW4gY2xvc2luZyBhIHdlYnNvY2tldCBjb25uZWN0aW9uIHRoYXQgaXMgc3R1Y2sgaW5cbiAgICAvLyByZWFkeVN0YXRlPUNPTk5FQ1RJTkcuICBEb2VzIGl0IHRocm93IGFuIGVycm9yPyAgRG9lcyBpdCBjYWxsIHRoZSBvbkNsb3NlIG9yIG9uRXJyb3IgZXZlbnQgaGFuZGxlcnM/XG4gICAgLy8gUmVtb3ZlIGFsbCBldmVudCBoYW5kbGVycyBzbyB0aGF0IGNhbGxpbmcgY2xvc2Ugd29uJ3QgdHJpZ2dlciBhbnkgY2FsbHMuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuaXNPcGVuID0gZmFsc2U7XG4gICAgICB0aGlzLl9yZW1vdmVTb2NrZXRFdmVudHMoKTtcbiAgICAgIGlmICh0aGlzLl9zb2NrZXQpIHtcbiAgICAgICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgICAgIHRoaXMuX3NvY2tldCA9IG51bGw7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm8tb3BcbiAgICB9XG5cbiAgICAvLyBOb3cgd2UgY2FuIGNhbGwgb3VyIGVycm9yIGhhbmRsZXIuXG4gICAgdGhpcy5fb25FcnJvcihuZXcgRXJyb3IobXNnKSk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHdlYnNvY2tldCBjb25uZWN0aW9uIGlzIHJlcG9ydGluZyB0aGF0IGl0cyBub3cgb3Blbi5cbiAgICpcbiAgICogQG1ldGhvZCBfb25PcGVuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfb25PcGVuKCkge1xuICAgIHRoaXMuX2NsZWFyQ29ubmVjdGlvbkZhaWxlZCgpO1xuICAgIGlmICh0aGlzLl9pc09wZW4oKSkge1xuICAgICAgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCA9IDA7XG4gICAgICB0aGlzLmlzT3BlbiA9IHRydWU7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcpO1xuICAgICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgQ29ubmVjdGVkJyk7XG4gICAgICBpZiAodGhpcy5faGFzQ291bnRlciAmJiB0aGlzLl9sYXN0VGltZXN0YW1wKSB7XG4gICAgICAgIHRoaXMucmVzeW5jKHRoaXMuX2xhc3RUaW1lc3RhbXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZW5hYmxlUHJlc2VuY2UoKTtcbiAgICAgICAgdGhpcy5fcmVzY2hlZHVsZVBpbmcoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdHMgdG8gc2VlIGlmIHRoZSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpcyBvcGVuLiAgVXNlIHRoZSBpc09wZW4gcHJvcGVydHlcbiAgICogZm9yIGV4dGVybmFsIHRlc3RzLlxuICAgKiBAbWV0aG9kIF9pc09wZW5cbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqL1xuICBfaXNPcGVuKCkge1xuICAgIGlmICghdGhpcy5fc29ja2V0KSByZXR1cm4gZmFsc2U7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHR5cGVvZiBXZWJTb2NrZXQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5fc29ja2V0ICYmIHRoaXMuX3NvY2tldC5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTjtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiBub3QgaXNPcGVuLCBwcmVzdW1hYmx5IGZhaWxlZCB0byBjb25uZWN0XG4gICAqIEFueSBvdGhlciBlcnJvciBjYW4gYmUgaWdub3JlZC4uLiBpZiB0aGUgY29ubmVjdGlvbiBoYXNcbiAgICogZmFpbGVkLCBvbkNsb3NlIHdpbGwgaGFuZGxlIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9vbkVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge0Vycm9yfSBlcnIgLSBXZWJzb2NrZXQgZXJyb3JcbiAgICovXG4gIF9vbkVycm9yKGVycikge1xuICAgIGlmICh0aGlzLl9jbG9zaW5nKSByZXR1cm47XG4gICAgdGhpcy5fY2xlYXJDb25uZWN0aW9uRmFpbGVkKCk7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgRXJyb3IgY2F1c2luZyB3ZWJzb2NrZXQgdG8gY2xvc2UnLCBlcnIpO1xuICAgIGlmICghdGhpcy5pc09wZW4pIHtcbiAgICAgIHRoaXMuX3JlbW92ZVNvY2tldEV2ZW50cygpO1xuICAgICAgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCsrO1xuICAgICAgdGhpcy5fc2NoZWR1bGVSZWNvbm5lY3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fb25Tb2NrZXRDbG9zZSgpO1xuICAgICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgICB0aGlzLl9zb2NrZXQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTaG9ydGN1dCBtZXRob2QgZm9yIHNlbmRpbmcgYSBzaWduYWxcbiAgICpcbiAgICogICAgbWFuYWdlci5zZW5kU2lnbmFsKHtcbiAgICAgICAgICAndHlwZSc6ICd0eXBpbmdfaW5kaWNhdG9yJyxcbiAgICAgICAgICAnb2JqZWN0Jzoge1xuICAgICAgICAgICAgJ2lkJzogdGhpcy5jb252ZXJzYXRpb24uaWRcbiAgICAgICAgICB9LFxuICAgICAgICAgICdkYXRhJzoge1xuICAgICAgICAgICAgJ2FjdGlvbic6IHN0YXRlXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kU2lnbmFsXG4gICAqIEBwYXJhbSAge09iamVjdH0gYm9keSAtIFNpZ25hbCBib2R5XG4gICAqL1xuICBzZW5kU2lnbmFsKGJvZHkpIHtcbiAgICBpZiAodGhpcy5faXNPcGVuKCkpIHtcbiAgICAgIHRoaXMuX3NvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdHlwZTogJ3NpZ25hbCcsXG4gICAgICAgIGJvZHksXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IHRvIHNlbmRpbmcgYSBDb3VudGVyLnJlYWQgcmVxdWVzdFxuICAgKlxuICAgKiBAbWV0aG9kIGdldENvdW50ZXJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2FsbGJhY2suc3VjY2Vzc1xuICAgKiBAcGFyYW0ge251bWJlcn0gY2FsbGJhY2subGFzdENvdW50ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IGNhbGxiYWNrLm5ld0NvdW50ZXJcbiAgICovXG4gIGdldENvdW50ZXIoY2FsbGJhY2spIHtcbiAgICBjb25zdCB0b29Tb29uID0gRGF0ZS5ub3coKSAtIHRoaXMuX2xhc3RHZXRDb3VudGVyUmVxdWVzdCA8IDEwMDA7XG4gICAgaWYgKHRvb1Nvb24pIHtcbiAgICAgIGlmICghdGhpcy5fbGFzdEdldENvdW50ZXJJZCkge1xuICAgICAgICB0aGlzLl9sYXN0R2V0Q291bnRlcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbGFzdEdldENvdW50ZXJJZCA9IDA7XG4gICAgICAgICAgdGhpcy5nZXRDb3VudGVyKGNhbGxiYWNrKTtcbiAgICAgICAgfSwgRGF0ZS5ub3coKSAtIHRoaXMuX2xhc3RHZXRDb3VudGVyUmVxdWVzdCAtIDEwMDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9sYXN0R2V0Q291bnRlclJlcXVlc3QgPSBEYXRlLm5vdygpO1xuICAgIGlmICh0aGlzLl9sYXN0R2V0Q291bnRlcklkKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fbGFzdEdldENvdW50ZXJJZCk7XG4gICAgICB0aGlzLl9sYXN0R2V0Q291bnRlcklkID0gMDtcbiAgICB9XG5cbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCByZXF1ZXN0OiBnZXRDb3VudGVyJyk7XG4gICAgdGhpcy5jbGllbnQuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgICAgZGF0YToge1xuICAgICAgICBtZXRob2Q6ICdDb3VudGVyLnJlYWQnLFxuICAgICAgfSxcbiAgICAgIGNhbGxiYWNrOiAocmVzdWx0KSA9PiB7XG4gICAgICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IHJlc3BvbnNlOiBnZXRDb3VudGVyICcgKyByZXN1bHQuZGF0YS5jb3VudGVyKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBjYWxsYmFjayh0cnVlLCByZXN1bHQuZGF0YS5jb3VudGVyLCByZXN1bHQuZnVsbERhdGEuY291bnRlcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBpc0NoYW5nZXNBcnJheTogZmFsc2UsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGF5cyBhbGwgbWlzc2VkIGNoYW5nZSBwYWNrZXRzIHNpbmNlIHRoZSBzcGVjaWZpZWQgdGltZXN0YW1wXG4gICAqXG4gICAqIEBtZXRob2QgcmVzeW5jXG4gICAqIEBwYXJhbSAge3N0cmluZ3xudW1iZXJ9ICAgdGltZXN0YW1wIC0gSXNvIGZvcm1hdHRlZCBkYXRlIHN0cmluZzsgaWYgbnVtYmVyIHdpbGwgYmUgdHJhbnNmb3JtZWQgaW50byBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmcuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZm9yIGNvbXBsZXRpb25cbiAgICovXG4gIHJlc3luYyh0aW1lc3RhbXAsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aW1lc3RhbXApIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkudmFsdWVOb3RTdXBwb3J0ZWQpO1xuICAgIGlmICh0eXBlb2YgdGltZXN0YW1wID09PSAnbnVtYmVyJykgdGltZXN0YW1wID0gbmV3IERhdGUodGltZXN0YW1wKS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gQ2FuY2VsIGFueSBwcmlvciBvcGVyYXRpb247IHByZXN1bWFibHkgd2UgbG9zdCBjb25uZWN0aW9uIGFuZCB0aGV5J3JlIGRlYWQgYW55d2F5cyxcbiAgICAvLyBidXQgdGhlIGNhbGxiYWNrIHRyaWdnZXJpbmcgb24gdGhlc2UgY291bGQgYmUgZGlzcnVwdGl2ZS5cbiAgICB0aGlzLmNsaWVudC5zb2NrZXRSZXF1ZXN0TWFuYWdlci5jYW5jZWxPcGVyYXRpb24oJ0V2ZW50LnJlcGxheScpO1xuICAgIHRoaXMuY2xpZW50LnNvY2tldFJlcXVlc3RNYW5hZ2VyLmNhbmNlbE9wZXJhdGlvbignUHJlc2VuY2Uuc3luYycpO1xuICAgIHRoaXMuX3JlcGxheUV2ZW50cyh0aW1lc3RhbXAsICgpID0+IHtcbiAgICAgIHRoaXMuX2VuYWJsZVByZXNlbmNlKHRpbWVzdGFtcCwgKCkgPT4ge1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ3N5bmNlZCcpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBsYXlzIGFsbCBtaXNzZWQgY2hhbmdlIHBhY2tldHMgc2luY2UgdGhlIHNwZWNpZmllZCB0aW1lc3RhbXBcbiAgICpcbiAgICogQG1ldGhvZCBfcmVwbGF5RXZlbnRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ3xudW1iZXJ9ICAgdGltZXN0YW1wIC0gSXNvIGZvcm1hdHRlZCBkYXRlIHN0cmluZzsgaWYgbnVtYmVyIHdpbGwgYmUgdHJhbnNmb3JtZWQgaW50byBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmcuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZm9yIGNvbXBsZXRpb25cbiAgICovXG4gIF9yZXBsYXlFdmVudHModGltZXN0YW1wLCBjYWxsYmFjaykge1xuICAgIC8vIElmIHdlIGFyZSBzaW1wbHkgdW5hYmxlIHRvIHJlcGxheSBiZWNhdXNlIHdlJ3JlIGRpc2Nvbm5lY3RlZCwgY2FwdHVyZSB0aGUgX25lZWRzUmVwbGF5RnJvbVxuICAgIGlmICghdGhpcy5faXNPcGVuKCkgJiYgIXRoaXMuX25lZWRzUmVwbGF5RnJvbSkge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgcmVxdWVzdDogX3JlcGxheUV2ZW50cyB1cGRhdGluZyBfbmVlZHNSZXBsYXlGcm9tJyk7XG4gICAgICB0aGlzLl9uZWVkc1JlcGxheUZyb20gPSB0aW1lc3RhbXA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5pbmZvKCdXZWJzb2NrZXQgcmVxdWVzdDogX3JlcGxheUV2ZW50cycpO1xuICAgICAgdGhpcy5jbGllbnQuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgbWV0aG9kOiAnRXZlbnQucmVwbGF5JyxcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBmcm9tX3RpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGNhbGxiYWNrOiByZXN1bHQgPT4gdGhpcy5fcmVwbGF5RXZlbnRzQ29tcGxldGUodGltZXN0YW1wLCBjYWxsYmFjaywgcmVzdWx0LnN1Y2Nlc3MpLFxuICAgICAgICBpc0NoYW5nZXNBcnJheTogZmFsc2UsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgZm9yIGhhbmRsaW5nIGNvbXBsZXRpb24gb2YgcmVwbGF5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXBsYXlFdmVudHNDb21wbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtEYXRlfSAgICAgdGltZXN0YW1wXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgIHN1Y2Nlc3NcbiAgICovXG4gIF9yZXBsYXlFdmVudHNDb21wbGV0ZSh0aW1lc3RhbXAsIGNhbGxiYWNrLCBzdWNjZXNzKSB7XG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX3JlcGxheVJldHJ5Q291bnQgPSAwO1xuXG4gICAgICAvLyBJZiByZXBsYXkgd2FzIGNvbXBsZXRlZCwgYW5kIG5vIG90aGVyIHJlcXVlc3RzIGZvciByZXBsYXksIHRoZW4gd2UncmUgZG9uZS5cbiAgICAgIGlmICghdGhpcy5fbmVlZHNSZXBsYXlGcm9tKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKCdXZWJzb2NrZXQgcmVwbGF5IGNvbXBsZXRlJyk7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgcmVwbGF5RXZlbnRzIHdhcyBjYWxsZWQgZHVyaW5nIGEgcmVwbGF5LCB0aGVuIHJlcGxheVxuICAgICAgLy8gZnJvbSB0aGUgZ2l2ZW4gdGltZXN0YW1wLiAgSWYgcmVxdWVzdCBmYWlsZWQsIHRoZW4gd2UgbmVlZCB0byByZXRyeSBmcm9tIF9sYXN0VGltZXN0YW1wXG4gICAgICBlbHNlIGlmICh0aGlzLl9uZWVkc1JlcGxheUZyb20pIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oJ1dlYnNvY2tldCByZXBsYXkgcGFydGlhbGx5IGNvbXBsZXRlJyk7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLl9uZWVkc1JlcGxheUZyb207XG4gICAgICAgIHRoaXMuX25lZWRzUmVwbGF5RnJvbSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3JlcGxheUV2ZW50cyh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXZSBuZXZlciBnb3QgYSBkb25lIGV2ZW50OyBidXQgZWl0aGVyIGdvdCBhbiBlcnJvciBmcm9tIHRoZSBzZXJ2ZXIgb3IgdGhlIHJlcXVlc3QgdGltZWQgb3V0LlxuICAgIC8vIFVzZSBleHBvbmVudGlhbCBiYWNrb2ZmIGluY3JlbWVudGVkIGludGVnZXJzIHRoYXQgZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyBtYXBwaW5nIHRvIHJvdWdobHlcbiAgICAvLyAwLjQgc2Vjb25kcyAtIDEyLjggc2Vjb25kcywgYW5kIHRoZW4gc3RvcHMgcmV0cnlpbmcuXG4gICAgZWxzZSBpZiAodGhpcy5fcmVwbGF5UmV0cnlDb3VudCA8IDgpIHtcbiAgICAgIGNvbnN0IG1heERlbGF5ID0gMjA7XG4gICAgICBjb25zdCBkZWxheSA9IFV0aWxzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMobWF4RGVsYXksIE1hdGgubWluKDE1LCB0aGlzLl9yZXBsYXlSZXRyeUNvdW50ICsgMikpO1xuICAgICAgbG9nZ2VyLmluZm8oJ1dlYnNvY2tldCByZXBsYXkgcmV0cnkgaW4gJyArIGRlbGF5ICsgJyBzZWNvbmRzJyk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3JlcGxheUV2ZW50cyh0aW1lc3RhbXApLCBkZWxheSAqIDEwMDApO1xuICAgICAgdGhpcy5fcmVwbGF5UmV0cnlDb3VudCsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ1dlYnNvY2tldCBFdmVudC5yZXBsYXkgaGFzIGZhaWxlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXN1YnNjcmliZSB0byBwcmVzZW5jZSBhbmQgcmVwbGF5IG1pc3NlZCBwcmVzZW5jZSBjaGFuZ2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9lbmFibGVQcmVzZW5jZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtEYXRlfSAgICAgdGltZXN0YW1wXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cbiAgX2VuYWJsZVByZXNlbmNlKHRpbWVzdGFtcCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmNsaWVudC5zb2NrZXRSZXF1ZXN0TWFuYWdlci5zZW5kUmVxdWVzdCh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIG1ldGhvZDogJ1ByZXNlbmNlLnN1YnNjcmliZScsXG4gICAgICB9LFxuICAgICAgY2FsbGJhY2s6IG51bGwsXG4gICAgICBpc0NoYW5nZXNBcnJheTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5jbGllbnQuaXNQcmVzZW5jZUVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY2xpZW50LnNvY2tldFJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIG1ldGhvZDogJ1ByZXNlbmNlLnVwZGF0ZScsXG4gICAgICAgICAgZGF0YTogW1xuICAgICAgICAgICAgeyBvcGVyYXRpb246ICdzZXQnLCBwcm9wZXJ0eTogJ3N0YXR1cycsIHZhbHVlOiAnYXV0bycgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBjYWxsYmFjazogbnVsbCxcbiAgICAgICAgaXNDaGFuZ2VzQXJyYXk6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRpbWVzdGFtcCkge1xuICAgICAgdGhpcy5zeW5jUHJlc2VuY2UodGltZXN0YW1wLCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbml6ZSBhbGwgcHJlc2VuY2UgZGF0YSBvciBjYXRjaCB1cCBvbiBtaXNzZWQgcHJlc2VuY2UgZGF0YS5cbiAgICpcbiAgICogVHlwaWNhbGx5IHRoaXMgaXMgY2FsbGVkIGJ5IGxheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlci5fZW5hYmxlUHJlc2VuY2UgYXV0b21hdGljYWxseSxcbiAgICogYnV0IHRoZXJlIG1heSBiZSBvY2Nhc2lvbnMgd2hlcmUgYW4gYXBwIHdhbnRzIHRvIGRpcmVjdGx5IHRyaWdnZXIgdGhpcyBhY3Rpb24uXG4gICAqXG4gICAqIEBtZXRob2Qgc3luY1ByZXNlbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0aW1lc3RhbXAgICAgYERhdGUudG9JU09TdHJpbmcoKWAgZm9ybWF0dGVkIHN0cmluZywgcmV0dXJucyBhbGwgcHJlc2VuY2UgY2hhbmdlcyBzaW5jZSB0aGF0IHRpbWVzdGFtcC4gIFJldHVybnMgYWxsIGZvbGxvd2VkIHByZXNlbmNlXG4gICAqICAgICAgIGlmIG5vIHRpbWVzdGFtcCBpcyBwcm92aWRlZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgIEZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBzeW5jIGlzIGNvbXBsZXRlZC5cbiAgICovXG4gIHN5bmNQcmVzZW5jZSh0aW1lc3RhbXAsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRpbWVzdGFtcCkge1xuICAgICAgLy8gUmV0dXJuIHZhbHVlIGZvciB1c2UgaW4gdW5pdCB0ZXN0c1xuICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnNvY2tldFJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIG1ldGhvZDogJ1ByZXNlbmNlLnN5bmMnLFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHNpbmNlOiB0aW1lc3RhbXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaXNDaGFuZ2VzQXJyYXk6IHRydWUsXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgYSBuZXcgd2Vic29ja2V0IHBhY2tldCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQG1ldGhvZCBfb25NZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZXZ0IC0gTWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXJcbiAgICovXG4gIF9vbk1lc3NhZ2UoZXZ0KSB7XG4gICAgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCA9IDA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgICAgY29uc3Qgc2tpcHBlZENvdW50ZXIgPSB0aGlzLl9sYXN0Q291bnRlciArIDEgIT09IG1zZy5jb3VudGVyO1xuICAgICAgdGhpcy5faGFzQ291bnRlciA9IHRydWU7XG4gICAgICB0aGlzLl9sYXN0Q291bnRlciA9IG1zZy5jb3VudGVyO1xuICAgICAgdGhpcy5fbGFzdERhdGFGcm9tU2VydmVyVGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgICAgLy8gSWYgd2UndmUgbWlzc2VkIGEgY291bnRlciwgcmVwbGF5IHRvIGdldDsgbm90ZSB0aGF0IHdlIGhhZCB0byB1cGRhdGUgX2xhc3RDb3VudGVyXG4gICAgICAvLyBmb3IgcmVwbGF5RXZlbnRzIHRvIHdvcmsgY29ycmVjdGx5LlxuICAgICAgaWYgKHNraXBwZWRDb3VudGVyKSB7XG4gICAgICAgIHRoaXMucmVzeW5jKHRoaXMuX2xhc3RUaW1lc3RhbXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fbGFzdFRpbWVzdGFtcCA9IG5ldyBEYXRlKG1zZy50aW1lc3RhbXApLmdldFRpbWUoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy50cmlnZ2VyKCdtZXNzYWdlJywge1xuICAgICAgICBkYXRhOiBtc2csXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fcmVzY2hlZHVsZVBpbmcoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignTGF5ZXItV2Vic29ja2V0OiBGYWlsZWQgdG8gaGFuZGxlIHdlYnNvY2tldCBtZXNzYWdlOiAnICsgZXJyICsgJ1xcbicsIGV2dC5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzY2hlZHVsZSBhIHBpbmcgcmVxdWVzdCB3aGljaCBoZWxwcyB1cyB2ZXJpZnkgdGhhdCB0aGUgY29ubmVjdGlvbiBpcyBzdGlsbCBhbGl2ZSxcbiAgICogYW5kIHRoYXQgd2UgaGF2ZW4ndCBtaXNzZWQgYW55IGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzY2hlZHVsZVBpbmdcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNjaGVkdWxlUGluZygpIHtcbiAgICBpZiAodGhpcy5fbmV4dFBpbmdJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX25leHRQaW5nSWQpO1xuICAgIH1cbiAgICB0aGlzLl9uZXh0UGluZ0lkID0gc2V0VGltZW91dCh0aGlzLl9waW5nLmJpbmQodGhpcyksIHRoaXMucGluZ0ZyZXF1ZW5jeSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIGNvdW50ZXIgcmVxdWVzdCB0byB0aGUgc2VydmVyIHRvIHZlcmlmeSB0aGF0IHdlIGFyZSBzdGlsbCBjb25uZWN0ZWQgYW5kXG4gICAqIGhhdmUgbm90IG1pc3NlZCBhbnkgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9waW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcGluZygpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBwaW5nJyk7XG4gICAgdGhpcy5fbmV4dFBpbmdJZCA9IDA7XG4gICAgaWYgKHRoaXMuX2lzT3BlbigpKSB7XG4gICAgICAvLyBOT1RFOiBvbk1lc3NhZ2Ugd2lsbCBhbHJlYWR5IGhhdmUgY2FsbGVkIHJlc2NoZWR1bGVQaW5nLCBidXQgaWYgdGhlcmUgd2FzIG5vIHJlc3BvbnNlLCB0aGVuIHRoZSBlcnJvciBoYW5kbGVyIHdvdWxkIE5PVCBoYXZlIGNhbGxlZCBpdC5cbiAgICAgIHRoaXMuZ2V0Q291bnRlcih0aGlzLl9yZXNjaGVkdWxlUGluZy5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDbG9zZSB0aGUgd2Vic29ja2V0LlxuICAgKlxuICAgKiBAbWV0aG9kIGNsb3NlXG4gICAqL1xuICBjbG9zZSgpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBjbG9zZSByZXF1ZXN0ZWQnKTtcbiAgICB0aGlzLl9jbG9zaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmlzT3BlbiA9IGZhbHNlO1xuICAgIGlmICh0aGlzLl9zb2NrZXQpIHtcbiAgICAgIC8vIENsb3NlIGFsbCBldmVudCBoYW5kbGVycyBhbmQgc2V0IHNvY2tldCB0byBudWxsXG4gICAgICAvLyB3aXRob3V0IHdhaXRpbmcgZm9yIGJyb3dzZXIgZXZlbnQgdG8gY2FsbFxuICAgICAgLy8gX29uU29ja2V0Q2xvc2UgYXMgdGhlIG5leHQgY29tbWFuZCBhZnRlciBjbG9zZVxuICAgICAgLy8gbWlnaHQgcmVxdWlyZSBjcmVhdGluZyBhIG5ldyBzb2NrZXRcbiAgICAgIHRoaXMuX29uU29ja2V0Q2xvc2UoKTtcbiAgICAgIHRoaXMuX3NvY2tldC5jbG9zZSgpO1xuICAgICAgdGhpcy5fc29ja2V0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHBhY2tldCBhY3Jvc3MgdGhlIHdlYnNvY2tldFxuICAgKiBAbWV0aG9kIHNlbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IG9ialxuICAgKi9cbiAgc2VuZChvYmopIHtcbiAgICB0aGlzLl9zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbG9zZSgpO1xuICAgIGlmICh0aGlzLl9uZXh0UGluZ0lkKSBjbGVhclRpbWVvdXQodGhpcy5fbmV4dFBpbmdJZCk7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBzb2NrZXQgaGFzIGNsb3NlZCAob3IgaWYgdGhlIGNsb3NlIG1ldGhvZCBmb3JjZXMgaXQgY2xvc2VkKVxuICAgKiBSZW1vdmUgYWxsIGV2ZW50IGhhbmRsZXJzIGFuZCBpZiBhcHByb3ByaWF0ZSwgc2NoZWR1bGUgYSByZXRyeS5cbiAgICpcbiAgICogQG1ldGhvZCBfb25Tb2NrZXRDbG9zZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX29uU29ja2V0Q2xvc2UoKSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgY2xvc2VkJyk7XG4gICAgdGhpcy5pc09wZW4gPSBmYWxzZTtcbiAgICBpZiAoIXRoaXMuX2Nsb3NpbmcpIHtcbiAgICAgIHRoaXMuX3NjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVtb3ZlU29ja2V0RXZlbnRzKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdkaXNjb25uZWN0ZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFsbCBldmVudCBoYW5kbGVycyBvbiB0aGUgY3VycmVudCBzb2NrZXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZVNvY2tldEV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3JlbW92ZVNvY2tldEV2ZW50cygpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5fc29ja2V0KSB7XG4gICAgICB0aGlzLl9zb2NrZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZSk7XG4gICAgICB0aGlzLl9zb2NrZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlKTtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25PcGVuKTtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uRXJyb3IpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fc29ja2V0KSB7XG4gICAgICB0aGlzLl9zb2NrZXQub25tZXNzYWdlID0gbnVsbDtcbiAgICAgIHRoaXMuX3NvY2tldC5vbmNsb3NlID0gbnVsbDtcbiAgICAgIHRoaXMuX3NvY2tldC5vbm9wZW4gPSBudWxsO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uZXJyb3IgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBhbiBhdHRlbXB0IHRvIHJlY29ubmVjdCB0byB0aGUgc2VydmVyLiAgSWYgdGhlIG9ubGluZU1hbmFnZXJcbiAgICogZGVjbGFyZXMgdXMgdG8gYmUgb2ZmbGluZSwgZG9uJ3QgYm90aGVyIHJlY29ubmVjdGluZy4gIEEgcmVjb25uZWN0XG4gICAqIGF0dGVtcHQgd2lsbCBiZSB0cmlnZ2VyZWQgYXMgc29vbiBhcyB0aGUgb25saW5lIG1hbmFnZXIgcmVwb3J0cyB3ZSBhcmUgb25saW5lIGFnYWluLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIGR1cmF0aW9uIG9mIG91ciBkZWxheSBjYW4gbm90IGV4Y2VkZSB0aGUgb25saW5lTWFuYWdlcidzIHBpbmcgZnJlcXVlbmN5XG4gICAqIG9yIGl0IHdpbGwgZGVjbGFyZSB1cyB0byBiZSBvZmZsaW5lIHdoaWxlIHdlIGF0dGVtcHQgYSByZWNvbm5lY3QuXG4gICAqXG4gICAqIEBtZXRob2QgX3NjaGVkdWxlUmVjb25uZWN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc2NoZWR1bGVSZWNvbm5lY3QoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lIHx8ICF0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcblxuICAgIGNvbnN0IGRlbGF5ID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyh0aGlzLm1heERlbGF5U2Vjb25kc0JldHdlZW5SZWNvbm5lY3QsIE1hdGgubWluKDE1LCB0aGlzLl9sb3N0Q29ubmVjdGlvbkNvdW50KSk7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgUmVjb25uZWN0IGluICcgKyBkZWxheSArICcgc2Vjb25kcycpO1xuICAgIGlmICghdGhpcy5fcmVjb25uZWN0SWQpIHtcbiAgICAgIHRoaXMuX3JlY29ubmVjdElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdElkID0gMDtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0KCk7XG4gICAgICB9LCBkZWxheSAqIDEwMDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCZWZvcmUgdGhlIHNjaGVkdWxlZCByZWNvbm5lY3QgY2FuIGNhbGwgYGNvbm5lY3QoKWAgdmFsaWRhdGUgdGhhdCB3ZSBkaWRuJ3QgbG9zZSB0aGUgd2Vic29ja2V0XG4gICAqIGR1ZSB0byBsb3NzIG9mIGF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF92YWxpZGF0ZVNlc3Npb25CZWZvcmVSZWNvbm5lY3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF92YWxpZGF0ZVNlc3Npb25CZWZvcmVSZWNvbm5lY3QoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lIHx8ICF0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcblxuICAgIGNvbnN0IG1heERlbGF5ID0gdGhpcy5tYXhEZWxheVNlY29uZHNCZXR3ZWVuUmVjb25uZWN0ICogMTAwMDtcbiAgICBjb25zdCBkaWZmID0gRGF0ZS5ub3coKSAtIHRoaXMuX2xhc3RWYWxpZGF0ZVNlc3Npb25SZXF1ZXN0IC0gbWF4RGVsYXk7XG4gICAgaWYgKGRpZmYgPCAwKSB7XG4gICAgICAvLyBUaGlzIGlzIGlkZW50aWNhbCB0byB3aGF0cyBpbiBfc2NoZWR1bGVSZWNvbm5lY3QgYW5kIGNvdWxkIGJlIGNsZWFuZXJcbiAgICAgIGlmICghdGhpcy5fcmVjb25uZWN0SWQpIHtcbiAgICAgICAgdGhpcy5fcmVjb25uZWN0SWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9yZWNvbm5lY3RJZCA9IDA7XG4gICAgICAgICAgdGhpcy5fdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0KCk7XG4gICAgICAgIH0sIE1hdGguYWJzKGRpZmYpICsgMTAwMCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xhc3RWYWxpZGF0ZVNlc3Npb25SZXF1ZXN0ID0gRGF0ZS5ub3coKTtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHVybDogJy8/YWN0aW9uPXZhbGlkYXRlQ29ubmVjdGlvbkZvcldlYnNvY2tldCZjbGllbnQ9JyArIHRoaXMuY2xpZW50LmNvbnN0cnVjdG9yLnZlcnNpb24sXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHRoaXMuY29ubmVjdCgpO1xuICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gNDAxKSB7XG4gICAgICAgICAgLy8gY2xpZW50LWF1dGhlbnRpY2F0b3IuanMgY2FwdHVyZXMgdGhpcyBzdGF0ZSBhbmQgaGFuZGxlcyBpdDsgYGNvbm5lY3QoKWAgd2lsbCBiZSBjYWxsZWQgb25jZSByZWF1dGhlbnRpY2F0aW9uIGNvbXBsZXRlc1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3NjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIElzIHRoZSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBjdXJyZW50bHkgb3Blbj9cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5pc09wZW4gPSBmYWxzZTtcblxuLyoqXG4gKiBzZXRUaW1lb3V0IElEIGZvciBjYWxsaW5nIGNvbm5lY3QoKVxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9yZWNvbm5lY3RJZCA9IDA7XG5cbi8qKlxuICogc2V0VGltZW91dCBJRCBmb3IgY2FsbGluZyBfY29ubmVjdGlvbkZhaWxlZCgpXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge051bWJlcn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2Nvbm5lY3Rpb25GYWlsZWRJZCA9IDA7XG5cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9sYXN0VGltZXN0YW1wID0gMDtcblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9sYXN0RGF0YUZyb21TZXJ2ZXJUaW1lc3RhbXAgPSAwO1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xhc3RDb3VudGVyID0gbnVsbDtcblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9oYXNDb3VudGVyID0gZmFsc2U7XG5cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9uZWVkc1JlcGxheUZyb20gPSBudWxsO1xuXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fcmVwbGF5UmV0cnlDb3VudCA9IDA7XG5cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9sYXN0R2V0Q291bnRlclJlcXVlc3QgPSAwO1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xhc3RHZXRDb3VudGVySWQgPSAwO1xuXG4vKipcbiAqIFRpbWUgaW4gbWlsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgY2FsbCB0byBfdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0XG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdFZhbGlkYXRlU2Vzc2lvblJlcXVlc3QgPSAwO1xuXG4vKipcbiAqIEZyZXF1ZW5jeSB3aXRoIHdoaWNoIHRoZSB3ZWJzb2NrZXQgY2hlY2tzIHRvIHNlZSBpZiBhbnkgd2Vic29ja2V0IG5vdGlmaWNhdGlvbnNcbiAqIGhhdmUgYmVlbiBtaXNzZWQuICBUaGlzIHRlc3QgaXMgZG9uZSBieSBjYWxsaW5nIGBnZXRDb3VudGVyYFxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLnBpbmdGcmVxdWVuY3kgPSAzMDAwMDtcblxuLyoqXG4gKiBEZWxheSBiZXR3ZWVuIHJlY29ubmVjdCBhdHRlbXB0c1xuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLm1heERlbGF5U2Vjb25kc0JldHdlZW5SZWNvbm5lY3QgPSAzMDtcblxuLyoqXG4gKiBUaGUgQ2xpZW50IHRoYXQgb3ducyB0aGlzLlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgU29ja2V0IENvbm5lY3Rpb24gaW5zdGFuY2VcbiAqIEB0eXBlIHtXZWJzb2NrZXR9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9zb2NrZXQgPSBudWxsO1xuXG4vKipcbiAqIElzIHRoZSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBiZWluZyBjbG9zZWQgYnkgYSBjYWxsIHRvIGNsb3NlKCk/XG4gKiBJZiBzbywgd2UgY2FuIGlnbm9yZSBhbnkgZXJyb3JzIHRoYXQgc2lnbmFsIHRoZSBzb2NrZXQgYXMgY2xvc2luZy5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fY2xvc2luZyA9IGZhbHNlO1xuXG4vKipcbiAqIE51bWJlciBvZiBmYWlsZWQgYXR0ZW1wdHMgdG8gcmVjb25uZWN0LlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xvc3RDb25uZWN0aW9uQ291bnQgPSAwO1xuXG5cblNvY2tldE1hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIEEgZGF0YSBwYWNrZXQgaGFzIGJlZW4gcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGxheWVyRXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IGxheWVyRXZlbnQuZGF0YSAtIFRoZSBkYXRhIHRoYXQgd2FzIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAgKi9cbiAgJ21lc3NhZ2UnLFxuXG4gIC8qKlxuICAgKiBUaGUgd2Vic29ja2V0IGlzIG5vdyBjb25uZWN0ZWQuXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgJ2Nvbm5lY3RlZCcsXG5cbiAgLyoqXG4gICAqIFRoZSB3ZWJzb2NrZXQgaXMgbm8gbG9uZ2VyIGNvbm5lY3RlZFxuICAgKiBAZXZlbnQgZGlzY29ubmVjdGVkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gICdkaXNjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBXZWJzb2NrZXQgZXZlbnRzIHdlcmUgbWlzc2VkOyB3ZSBhcmUgcmVzeW5jaW5nIHdpdGggdGhlIHNlcnZlclxuICAgKiBAZXZlbnQgcmVwbGF5LWJlZ3VuXG4gICAqL1xuICAnc3luY2luZycsXG5cbiAgLyoqXG4gICAqIFdlYnNvY2tldCBldmVudHMgd2VyZSBtaXNzZWQ7IHdlIHJlc3luY2VkIHdpdGggdGhlIHNlcnZlciBhbmQgYXJlIG5vdyBkb25lXG4gICAqIEBldmVudCByZXBsYXktYmVndW5cbiAgICovXG4gICdzeW5jZWQnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KFNvY2tldE1hbmFnZXIsIFtTb2NrZXRNYW5hZ2VyLCAnU29ja2V0TWFuYWdlciddKTtcbm1vZHVsZS5leHBvcnRzID0gU29ja2V0TWFuYWdlcjtcblxuIl19
