'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class  layer.Websockets.RequestManager
 * @private
 *
 * This class allows one to send requests to the websocket server, and provide a callback,
 * And have that callback either called by the correct websocket server response, or
 * be called with a timeout.
 */
var Utils = require('../client-utils');
var logger = require('../logger');
var LayerError = require('../layer-error');

// Wait 15 seconds for a response and then give up
var DELAY_UNTIL_TIMEOUT = 15 * 1000;

var WebsocketRequestManager = function () {
  /**
   * Create a new websocket change manager
   *
   *      var websocketRequestManager = new layer.Websockets.RequestManager({
   *          client: client,
   *          socketManager: client.Websockets.SocketManager
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @param {layer.Websockets.SocketManager} socketManager
   * @returns {layer.Websockets.RequestManager}
   */
  function WebsocketRequestManager(options) {
    _classCallCheck(this, WebsocketRequestManager);

    this.client = options.client;
    this.socketManager = options.socketManager;
    this.socketManager.on({
      message: this._handleResponse,
      disconnected: this._reset
    }, this);

    this._requestCallbacks = {};
  }

  _createClass(WebsocketRequestManager, [{
    key: '_reset',
    value: function _reset() {
      this._requestCallbacks = {};
    }

    /**
     * This is an imprecise method; it will cancel ALL requests of a given type.
     *
     * @method cancelOperation
     * @param {String} methodName    `Message.create`, `Event.sync`, etc...
     */

  }, {
    key: 'cancelOperation',
    value: function cancelOperation(methodName) {
      var _this = this;

      Object.keys(this._requestCallbacks).forEach(function (key) {
        var requestConfig = _this._requestCallbacks[key];
        if (requestConfig.method === methodName) delete _this._requestCallbacks[key];
      });
    }

    /**
     * Handle a response to a request.
     *
     * @method _handleResponse
     * @private
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_handleResponse',
    value: function _handleResponse(evt) {
      if (evt.data.type === 'response') {
        var msg = evt.data.body;
        var requestId = msg.request_id;
        logger.debug('Websocket response ' + requestId + ' ' + (msg.success ? 'Successful' : 'Failed'));

        if (requestId && this._requestCallbacks[requestId]) {
          this._processResponse(requestId, evt);
        }
      }
    }

    /**
     * Process a response to a request; used by _handleResponse.
     *
     * Refactored out of _handleResponse so that unit tests can easily
     * use it to trigger completion of a request.
     *
     * @method _processResponse
     * @private
     * @param {String} requestId
     * @param {Object} evt   Data from the server
     */

  }, {
    key: '_processResponse',
    value: function _processResponse(requestId, evt) {
      var request = this._requestCallbacks[requestId];
      var msg = evt.data.body;
      var data = (msg.success ? msg.data : new LayerError(msg.data)) || {};

      if (msg.success) {
        if (request.isChangesArray) {
          this._handleChangesArray(data.changes);
        }
        if ('batch' in data) {
          request.batchTotal = data.batch.count;
          request.batchIndex = data.batch.index;
          if (request.isChangesArray) {
            request.results = request.results.concat(data.changes);
          } else if ('results' in data && Array.isArray(data.results)) {
            request.results = request.results.concat(data.results);
          }
          if (data.batch.index < data.batch.count - 1) return;
        }
      }
      request.callback({
        success: msg.success,
        fullData: 'batch' in data ? request.results : evt.data,
        data: data
      });
      delete this._requestCallbacks[requestId];
    }

    /**
     * Any request that contains an array of changes should deliver each change
     * to the socketChangeManager.
     *
     * @method _handleChangesArray
     * @private
     * @param {Object[]} changes   "create", "update", and "delete" requests from server.
     */

  }, {
    key: '_handleChangesArray',
    value: function _handleChangesArray(changes) {
      var _this2 = this;

      changes.forEach(function (change) {
        return _this2.client.socketChangeManager._processChange(change);
      });
    }

    /**
     * Shortcut for sending a request; builds in handling for callbacks
     *
     *    manager.sendRequest({
     *      data: {
     *        operation: "delete",
     *        object: {id: "layer:///conversations/uuid"},
     *        data: {deletion_mode: "all_participants"}
     *      },
     *      callback: function(result) {
     *        alert(result.success ? "Yay" : "Boo");
     *      },
     *      isChangesArray: false
     *    });
     *
     * @method sendRequest
     * @param  {Object} options
     * @param  {Object} otions.data                     Data to send to the server
     * @param  {Function} [options.callback=null]       Handler for success/failure callback
     * @param  {Boolean} [options.isChangesArray=false] Response contains a changes array that can be fed directly to change-manager.
     * @returns the request callback object if there is one; primarily for use in testing.
     */

  }, {
    key: 'sendRequest',
    value: function sendRequest(_ref) {
      var data = _ref.data,
          callback = _ref.callback,
          _ref$isChangesArray = _ref.isChangesArray,
          isChangesArray = _ref$isChangesArray === undefined ? false : _ref$isChangesArray;

      if (!this._isOpen()) {
        return !callback ? undefined : callback(new LayerError({
          success: false,
          data: { id: 'not_connected', code: 0, message: 'WebSocket not connected' }
        }));
      }
      var body = Utils.clone(data);
      body.request_id = 'r' + this._nextRequestId++;
      logger.debug('Request ' + body.request_id + ' is sending');
      if (callback) {
        this._requestCallbacks[body.request_id] = {
          request_id: body.request_id,
          date: Date.now(),
          callback: callback,
          isChangesArray: isChangesArray,
          method: data.method,
          batchIndex: -1,
          batchTotal: -1,
          results: []
        };
      }

      this.socketManager.send({
        type: 'request',
        body: body
      });
      this._scheduleCallbackCleanup();
      if (body.request_id) return this._requestCallbacks[body.request_id];
    }

    /**
     * Flags a request as having failed if no response within 2 minutes
     *
     * @method _scheduleCallbackCleanup
     * @private
     */

  }, {
    key: '_scheduleCallbackCleanup',
    value: function _scheduleCallbackCleanup() {
      if (!this._callbackCleanupId) {
        this._callbackCleanupId = setTimeout(this._runCallbackCleanup.bind(this), DELAY_UNTIL_TIMEOUT + 50);
      }
    }

    /**
     * Calls callback with an error.
     *
     * NOTE: Because we call requests that expect responses serially instead of in parallel,
     * currently there should only ever be a single entry in _requestCallbacks.  This may change in the future.
     *
     * @method _runCallbackCleanup
     * @private
     */

  }, {
    key: '_runCallbackCleanup',
    value: function _runCallbackCleanup() {
      var _this3 = this;

      this._callbackCleanupId = 0;
      // If the websocket is closed, ignore all callbacks.  The Sync Manager will reissue these requests as soon as it gets
      // a 'connected' event... they have not failed.  May need to rethink this for cases where third parties are directly
      // calling the websocket manager bypassing the sync manager.
      if (this.isDestroyed || !this._isOpen()) return;
      var count = 0,
          abort = false;
      var now = Date.now();
      Object.keys(this._requestCallbacks).forEach(function (requestId) {
        var callbackConfig = _this3._requestCallbacks[requestId];
        if (abort) return;

        // If the request hasn't expired, we'll need to reschedule callback cleanup; else if its expired...
        if (callbackConfig && now < callbackConfig.date + DELAY_UNTIL_TIMEOUT) {
          count++;
        }

        // If there has been no data from the server, there's probably a problem with the websocket; reconnect.
        else if (now > _this3.socketManager._lastDataFromServerTimestamp + DELAY_UNTIL_TIMEOUT) {
            // Retrying isn't currently handled here; its handled by the caller (typically sync-manager); so clear out all requests,
            // notifying the callers that they have failed.
            abort = true;
            _this3._failAll();
            _this3.socketManager._reconnect(false);
          } else {
            // The request isn't responding and the socket is good; fail the request.
            _this3._timeoutRequest(requestId);
          }
      });
      if (count) this._scheduleCallbackCleanup();
    }

    /**
     * Any requests that have not had responses are considered as failed if we disconnect without a response.
     *
     * Call all callbacks with a `server_unavailable` error.  The caller may retry,
     * but this component does not have built-in retry.
     *
     * @method
     * @private
     */

  }, {
    key: '_failAll',
    value: function _failAll() {
      var _this4 = this;

      Object.keys(this._requestCallbacks).forEach(function (requestId) {
        try {
          logger.warn('Websocket request aborted due to reconnect');
          _this4._requestCallbacks[requestId].callback({
            success: false,
            status: 503,
            data: new LayerError({
              id: 'socket_dead',
              message: 'Websocket appears to be dead. Reconnecting.',
              url: 'https:/developer.layer.com/docs/websdk',
              code: 0,
              status: 503,
              httpStatus: 503
            })
          });
        } catch (err) {
          // Do nothing
        }
        delete _this4._requestCallbacks[requestId];
      });
    }
  }, {
    key: '_timeoutRequest',
    value: function _timeoutRequest(requestId) {
      try {
        logger.warn('Websocket request timeout');
        this._requestCallbacks[requestId].callback({
          success: false,
          data: new LayerError({
            id: 'request_timeout',
            message: 'The server is not responding. We know how much that sucks.',
            url: 'https:/developer.layer.com/docs/websdk',
            code: 0,
            status: 408,
            httpStatus: 408
          })
        });
      } catch (err) {
        // Do nothing
      }
      delete this._requestCallbacks[requestId];
    }
  }, {
    key: '_isOpen',
    value: function _isOpen() {
      return this.socketManager._isOpen();
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.isDestroyed = true;
      if (this._callbackCleanupId) clearTimeout(this._callbackCleanupId);
      this._requestCallbacks = null;
    }
  }]);

  return WebsocketRequestManager;
}();

WebsocketRequestManager.prototype._nextRequestId = 1;

/**
 * The Client that owns this.
 * @type {layer.Client}
 */
WebsocketRequestManager.prototype.client = null;

WebsocketRequestManager.prototype._requestCallbacks = null;

WebsocketRequestManager.prototype._callbackCleanupId = 0;

WebsocketRequestManager.prototype.socketManager = null;

module.exports = WebsocketRequestManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3JlcXVlc3QtbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJVdGlscyIsInJlcXVpcmUiLCJsb2dnZXIiLCJMYXllckVycm9yIiwiREVMQVlfVU5USUxfVElNRU9VVCIsIldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyIiwib3B0aW9ucyIsImNsaWVudCIsInNvY2tldE1hbmFnZXIiLCJvbiIsIm1lc3NhZ2UiLCJfaGFuZGxlUmVzcG9uc2UiLCJkaXNjb25uZWN0ZWQiLCJfcmVzZXQiLCJfcmVxdWVzdENhbGxiYWNrcyIsIm1ldGhvZE5hbWUiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInJlcXVlc3RDb25maWciLCJtZXRob2QiLCJldnQiLCJkYXRhIiwidHlwZSIsIm1zZyIsImJvZHkiLCJyZXF1ZXN0SWQiLCJyZXF1ZXN0X2lkIiwiZGVidWciLCJzdWNjZXNzIiwiX3Byb2Nlc3NSZXNwb25zZSIsInJlcXVlc3QiLCJpc0NoYW5nZXNBcnJheSIsIl9oYW5kbGVDaGFuZ2VzQXJyYXkiLCJjaGFuZ2VzIiwiYmF0Y2hUb3RhbCIsImJhdGNoIiwiY291bnQiLCJiYXRjaEluZGV4IiwiaW5kZXgiLCJyZXN1bHRzIiwiY29uY2F0IiwiQXJyYXkiLCJpc0FycmF5IiwiY2FsbGJhY2siLCJmdWxsRGF0YSIsInNvY2tldENoYW5nZU1hbmFnZXIiLCJfcHJvY2Vzc0NoYW5nZSIsImNoYW5nZSIsIl9pc09wZW4iLCJ1bmRlZmluZWQiLCJpZCIsImNvZGUiLCJjbG9uZSIsIl9uZXh0UmVxdWVzdElkIiwiZGF0ZSIsIkRhdGUiLCJub3ciLCJzZW5kIiwiX3NjaGVkdWxlQ2FsbGJhY2tDbGVhbnVwIiwiX2NhbGxiYWNrQ2xlYW51cElkIiwic2V0VGltZW91dCIsIl9ydW5DYWxsYmFja0NsZWFudXAiLCJiaW5kIiwiaXNEZXN0cm95ZWQiLCJhYm9ydCIsImNhbGxiYWNrQ29uZmlnIiwiX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCIsIl9mYWlsQWxsIiwiX3JlY29ubmVjdCIsIl90aW1lb3V0UmVxdWVzdCIsIndhcm4iLCJzdGF0dXMiLCJ1cmwiLCJodHRwU3RhdHVzIiwiZXJyIiwiY2xlYXJUaW1lb3V0IiwicHJvdG90eXBlIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7Ozs7O0FBUUEsSUFBTUEsUUFBUUMsUUFBUSxpQkFBUixDQUFkO0FBQ0EsSUFBTUMsU0FBU0QsUUFBUSxXQUFSLENBQWY7QUFDQSxJQUFNRSxhQUFhRixRQUFRLGdCQUFSLENBQW5COztBQUVBO0FBQ0EsSUFBTUcsc0JBQXNCLEtBQUssSUFBakM7O0lBRU1DLHVCO0FBQ0o7Ozs7Ozs7Ozs7Ozs7O0FBY0EsbUNBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFDbkIsU0FBS0MsTUFBTCxHQUFjRCxRQUFRQyxNQUF0QjtBQUNBLFNBQUtDLGFBQUwsR0FBcUJGLFFBQVFFLGFBQTdCO0FBQ0EsU0FBS0EsYUFBTCxDQUFtQkMsRUFBbkIsQ0FBc0I7QUFDcEJDLGVBQVMsS0FBS0MsZUFETTtBQUVwQkMsb0JBQWMsS0FBS0M7QUFGQyxLQUF0QixFQUdHLElBSEg7O0FBS0EsU0FBS0MsaUJBQUwsR0FBeUIsRUFBekI7QUFDRDs7Ozs2QkFFUTtBQUNQLFdBQUtBLGlCQUFMLEdBQXlCLEVBQXpCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OztvQ0FNZ0JDLFUsRUFBWTtBQUFBOztBQUMxQkMsYUFBT0MsSUFBUCxDQUFZLEtBQUtILGlCQUFqQixFQUFvQ0ksT0FBcEMsQ0FBNEMsVUFBQ0MsR0FBRCxFQUFTO0FBQ25ELFlBQU1DLGdCQUFnQixNQUFLTixpQkFBTCxDQUF1QkssR0FBdkIsQ0FBdEI7QUFDQSxZQUFJQyxjQUFjQyxNQUFkLEtBQXlCTixVQUE3QixFQUF5QyxPQUFPLE1BQUtELGlCQUFMLENBQXVCSyxHQUF2QixDQUFQO0FBQzFDLE9BSEQ7QUFJRDs7QUFFRDs7Ozs7Ozs7OztvQ0FPZ0JHLEcsRUFBSztBQUNuQixVQUFJQSxJQUFJQyxJQUFK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LGFBQWxDLEdBQWtELElBQWxEOztBQUVBdUUsT0FBT0MsT0FBUCxHQUFpQjNFLHVCQUFqQiIsImZpbGUiOiJyZXF1ZXN0LW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyAgbGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlclxuICogQHByaXZhdGVcbiAqXG4gKiBUaGlzIGNsYXNzIGFsbG93cyBvbmUgdG8gc2VuZCByZXF1ZXN0cyB0byB0aGUgd2Vic29ja2V0IHNlcnZlciwgYW5kIHByb3ZpZGUgYSBjYWxsYmFjayxcbiAqIEFuZCBoYXZlIHRoYXQgY2FsbGJhY2sgZWl0aGVyIGNhbGxlZCBieSB0aGUgY29ycmVjdCB3ZWJzb2NrZXQgc2VydmVyIHJlc3BvbnNlLCBvclxuICogYmUgY2FsbGVkIHdpdGggYSB0aW1lb3V0LlxuICovXG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcblxuLy8gV2FpdCAxNSBzZWNvbmRzIGZvciBhIHJlc3BvbnNlIGFuZCB0aGVuIGdpdmUgdXBcbmNvbnN0IERFTEFZX1VOVElMX1RJTUVPVVQgPSAxNSAqIDEwMDA7XG5cbmNsYXNzIFdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyB3ZWJzb2NrZXQgY2hhbmdlIG1hbmFnZXJcbiAgICpcbiAgICogICAgICB2YXIgd2Vic29ja2V0UmVxdWVzdE1hbmFnZXIgPSBuZXcgbGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBjbGllbnQuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9IHNvY2tldE1hbmFnZXJcbiAgICogQHJldHVybnMge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5jbGllbnQgPSBvcHRpb25zLmNsaWVudDtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIgPSBvcHRpb25zLnNvY2tldE1hbmFnZXI7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLm9uKHtcbiAgICAgIG1lc3NhZ2U6IHRoaXMuX2hhbmRsZVJlc3BvbnNlLFxuICAgICAgZGlzY29ubmVjdGVkOiB0aGlzLl9yZXNldCxcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3MgPSB7fTtcbiAgfVxuXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzID0ge307XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBpcyBhbiBpbXByZWNpc2UgbWV0aG9kOyBpdCB3aWxsIGNhbmNlbCBBTEwgcmVxdWVzdHMgb2YgYSBnaXZlbiB0eXBlLlxuICAgKlxuICAgKiBAbWV0aG9kIGNhbmNlbE9wZXJhdGlvblxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kTmFtZSAgICBgTWVzc2FnZS5jcmVhdGVgLCBgRXZlbnQuc3luY2AsIGV0Yy4uLlxuICAgKi9cbiAgY2FuY2VsT3BlcmF0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGNvbnN0IHJlcXVlc3RDb25maWcgPSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW2tleV07XG4gICAgICBpZiAocmVxdWVzdENvbmZpZy5tZXRob2QgPT09IG1ldGhvZE5hbWUpIGRlbGV0ZSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW2tleV07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgcmVzcG9uc2UgdG8gYSByZXF1ZXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVSZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVSZXNwb25zZShldnQpIHtcbiAgICBpZiAoZXZ0LmRhdGEudHlwZSA9PT0gJ3Jlc3BvbnNlJykge1xuICAgICAgY29uc3QgbXNnID0gZXZ0LmRhdGEuYm9keTtcbiAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IG1zZy5yZXF1ZXN0X2lkO1xuICAgICAgbG9nZ2VyLmRlYnVnKGBXZWJzb2NrZXQgcmVzcG9uc2UgJHtyZXF1ZXN0SWR9ICR7bXNnLnN1Y2Nlc3MgPyAnU3VjY2Vzc2Z1bCcgOiAnRmFpbGVkJ31gKTtcblxuICAgICAgaWYgKHJlcXVlc3RJZCAmJiB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF0pIHtcbiAgICAgICAgdGhpcy5fcHJvY2Vzc1Jlc3BvbnNlKHJlcXVlc3RJZCwgZXZ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHJlc3BvbnNlIHRvIGEgcmVxdWVzdDsgdXNlZCBieSBfaGFuZGxlUmVzcG9uc2UuXG4gICAqXG4gICAqIFJlZmFjdG9yZWQgb3V0IG9mIF9oYW5kbGVSZXNwb25zZSBzbyB0aGF0IHVuaXQgdGVzdHMgY2FuIGVhc2lseVxuICAgKiB1c2UgaXQgdG8gdHJpZ2dlciBjb21wbGV0aW9uIG9mIGEgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc1Jlc3BvbnNlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSByZXF1ZXN0SWRcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2dCAgIERhdGEgZnJvbSB0aGUgc2VydmVyXG4gICAqL1xuICBfcHJvY2Vzc1Jlc3BvbnNlKHJlcXVlc3RJZCwgZXZ0KSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXTtcbiAgICBjb25zdCBtc2cgPSBldnQuZGF0YS5ib2R5O1xuICAgIGNvbnN0IGRhdGEgPSAobXNnLnN1Y2Nlc3MgPyBtc2cuZGF0YSA6IG5ldyBMYXllckVycm9yKG1zZy5kYXRhKSkgfHwge307XG5cbiAgICBpZiAobXNnLnN1Y2Nlc3MpIHtcbiAgICAgIGlmIChyZXF1ZXN0LmlzQ2hhbmdlc0FycmF5KSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZUNoYW5nZXNBcnJheShkYXRhLmNoYW5nZXMpO1xuICAgICAgfVxuICAgICAgaWYgKCdiYXRjaCcgaW4gZGF0YSkge1xuICAgICAgICByZXF1ZXN0LmJhdGNoVG90YWwgPSBkYXRhLmJhdGNoLmNvdW50O1xuICAgICAgICByZXF1ZXN0LmJhdGNoSW5kZXggPSBkYXRhLmJhdGNoLmluZGV4O1xuICAgICAgICBpZiAocmVxdWVzdC5pc0NoYW5nZXNBcnJheSkge1xuICAgICAgICAgIHJlcXVlc3QucmVzdWx0cyA9IHJlcXVlc3QucmVzdWx0cy5jb25jYXQoZGF0YS5jaGFuZ2VzKTtcbiAgICAgICAgfSBlbHNlIGlmICgncmVzdWx0cycgaW4gZGF0YSAmJiBBcnJheS5pc0FycmF5KGRhdGEucmVzdWx0cykpIHtcbiAgICAgICAgICByZXF1ZXN0LnJlc3VsdHMgPSByZXF1ZXN0LnJlc3VsdHMuY29uY2F0KGRhdGEucmVzdWx0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEuYmF0Y2guaW5kZXggPCBkYXRhLmJhdGNoLmNvdW50IC0gMSkgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0LmNhbGxiYWNrKHtcbiAgICAgIHN1Y2Nlc3M6IG1zZy5zdWNjZXNzLFxuICAgICAgZnVsbERhdGE6ICdiYXRjaCcgaW4gZGF0YSA/IHJlcXVlc3QucmVzdWx0cyA6IGV2dC5kYXRhLFxuICAgICAgZGF0YSxcbiAgICB9KTtcbiAgICBkZWxldGUgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdO1xuICB9XG5cbiAgLyoqXG4gICAqIEFueSByZXF1ZXN0IHRoYXQgY29udGFpbnMgYW4gYXJyYXkgb2YgY2hhbmdlcyBzaG91bGQgZGVsaXZlciBlYWNoIGNoYW5nZVxuICAgKiB0byB0aGUgc29ja2V0Q2hhbmdlTWFuYWdlci5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlc0FycmF5XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNoYW5nZXMgICBcImNyZWF0ZVwiLCBcInVwZGF0ZVwiLCBhbmQgXCJkZWxldGVcIiByZXF1ZXN0cyBmcm9tIHNlcnZlci5cbiAgICovXG4gIF9oYW5kbGVDaGFuZ2VzQXJyYXkoY2hhbmdlcykge1xuICAgIGNoYW5nZXMuZm9yRWFjaChjaGFuZ2UgPT4gdGhpcy5jbGllbnQuc29ja2V0Q2hhbmdlTWFuYWdlci5fcHJvY2Vzc0NoYW5nZShjaGFuZ2UpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaG9ydGN1dCBmb3Igc2VuZGluZyBhIHJlcXVlc3Q7IGJ1aWxkcyBpbiBoYW5kbGluZyBmb3IgY2FsbGJhY2tzXG4gICAqXG4gICAqICAgIG1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgKiAgICAgIGRhdGE6IHtcbiAgICogICAgICAgIG9wZXJhdGlvbjogXCJkZWxldGVcIixcbiAgICogICAgICAgIG9iamVjdDoge2lkOiBcImxheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZFwifSxcbiAgICogICAgICAgIGRhdGE6IHtkZWxldGlvbl9tb2RlOiBcImFsbF9wYXJ0aWNpcGFudHNcIn1cbiAgICogICAgICB9LFxuICAgKiAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICogICAgICAgIGFsZXJ0KHJlc3VsdC5zdWNjZXNzID8gXCJZYXlcIiA6IFwiQm9vXCIpO1xuICAgKiAgICAgIH0sXG4gICAqICAgICAgaXNDaGFuZ2VzQXJyYXk6IGZhbHNlXG4gICAqICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRSZXF1ZXN0XG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG90aW9ucy5kYXRhICAgICAgICAgICAgICAgICAgICAgRGF0YSB0byBzZW5kIHRvIHRoZSBzZXJ2ZXJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtvcHRpb25zLmNhbGxiYWNrPW51bGxdICAgICAgIEhhbmRsZXIgZm9yIHN1Y2Nlc3MvZmFpbHVyZSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtCb29sZWFufSBbb3B0aW9ucy5pc0NoYW5nZXNBcnJheT1mYWxzZV0gUmVzcG9uc2UgY29udGFpbnMgYSBjaGFuZ2VzIGFycmF5IHRoYXQgY2FuIGJlIGZlZCBkaXJlY3RseSB0byBjaGFuZ2UtbWFuYWdlci5cbiAgICogQHJldHVybnMgdGhlIHJlcXVlc3QgY2FsbGJhY2sgb2JqZWN0IGlmIHRoZXJlIGlzIG9uZTsgcHJpbWFyaWx5IGZvciB1c2UgaW4gdGVzdGluZy5cbiAgICovXG4gIHNlbmRSZXF1ZXN0KHsgZGF0YSwgY2FsbGJhY2ssIGlzQ2hhbmdlc0FycmF5ID0gZmFsc2UgfSkge1xuICAgIGlmICghdGhpcy5faXNPcGVuKCkpIHtcbiAgICAgIHJldHVybiAhY2FsbGJhY2sgPyB1bmRlZmluZWQgOiBjYWxsYmFjayhuZXcgTGF5ZXJFcnJvcih7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBkYXRhOiB7IGlkOiAnbm90X2Nvbm5lY3RlZCcsIGNvZGU6IDAsIG1lc3NhZ2U6ICdXZWJTb2NrZXQgbm90IGNvbm5lY3RlZCcgfSxcbiAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgYm9keSA9IFV0aWxzLmNsb25lKGRhdGEpO1xuICAgIGJvZHkucmVxdWVzdF9pZCA9ICdyJyArIHRoaXMuX25leHRSZXF1ZXN0SWQrKztcbiAgICBsb2dnZXIuZGVidWcoYFJlcXVlc3QgJHtib2R5LnJlcXVlc3RfaWR9IGlzIHNlbmRpbmdgKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbYm9keS5yZXF1ZXN0X2lkXSA9IHtcbiAgICAgICAgcmVxdWVzdF9pZDogYm9keS5yZXF1ZXN0X2lkLFxuICAgICAgICBkYXRlOiBEYXRlLm5vdygpLFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgaXNDaGFuZ2VzQXJyYXksXG4gICAgICAgIG1ldGhvZDogZGF0YS5tZXRob2QsXG4gICAgICAgIGJhdGNoSW5kZXg6IC0xLFxuICAgICAgICBiYXRjaFRvdGFsOiAtMSxcbiAgICAgICAgcmVzdWx0czogW10sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRoaXMuc29ja2V0TWFuYWdlci5zZW5kKHtcbiAgICAgIHR5cGU6ICdyZXF1ZXN0JyxcbiAgICAgIGJvZHksXG4gICAgfSk7XG4gICAgdGhpcy5fc2NoZWR1bGVDYWxsYmFja0NsZWFudXAoKTtcbiAgICBpZiAoYm9keS5yZXF1ZXN0X2lkKSByZXR1cm4gdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tib2R5LnJlcXVlc3RfaWRdO1xuICB9XG5cbiAgLyoqXG4gICAqIEZsYWdzIGEgcmVxdWVzdCBhcyBoYXZpbmcgZmFpbGVkIGlmIG5vIHJlc3BvbnNlIHdpdGhpbiAyIG1pbnV0ZXNcbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVDYWxsYmFja0NsZWFudXBcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cCgpIHtcbiAgICBpZiAoIXRoaXMuX2NhbGxiYWNrQ2xlYW51cElkKSB7XG4gICAgICB0aGlzLl9jYWxsYmFja0NsZWFudXBJZCA9IHNldFRpbWVvdXQodGhpcy5fcnVuQ2FsbGJhY2tDbGVhbnVwLmJpbmQodGhpcyksIERFTEFZX1VOVElMX1RJTUVPVVQgKyA1MCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxzIGNhbGxiYWNrIHdpdGggYW4gZXJyb3IuXG4gICAqXG4gICAqIE5PVEU6IEJlY2F1c2Ugd2UgY2FsbCByZXF1ZXN0cyB0aGF0IGV4cGVjdCByZXNwb25zZXMgc2VyaWFsbHkgaW5zdGVhZCBvZiBpbiBwYXJhbGxlbCxcbiAgICogY3VycmVudGx5IHRoZXJlIHNob3VsZCBvbmx5IGV2ZXIgYmUgYSBzaW5nbGUgZW50cnkgaW4gX3JlcXVlc3RDYWxsYmFja3MuICBUaGlzIG1heSBjaGFuZ2UgaW4gdGhlIGZ1dHVyZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuQ2FsbGJhY2tDbGVhbnVwXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcnVuQ2FsbGJhY2tDbGVhbnVwKCkge1xuICAgIHRoaXMuX2NhbGxiYWNrQ2xlYW51cElkID0gMDtcbiAgICAvLyBJZiB0aGUgd2Vic29ja2V0IGlzIGNsb3NlZCwgaWdub3JlIGFsbCBjYWxsYmFja3MuICBUaGUgU3luYyBNYW5hZ2VyIHdpbGwgcmVpc3N1ZSB0aGVzZSByZXF1ZXN0cyBhcyBzb29uIGFzIGl0IGdldHNcbiAgICAvLyBhICdjb25uZWN0ZWQnIGV2ZW50Li4uIHRoZXkgaGF2ZSBub3QgZmFpbGVkLiAgTWF5IG5lZWQgdG8gcmV0aGluayB0aGlzIGZvciBjYXNlcyB3aGVyZSB0aGlyZCBwYXJ0aWVzIGFyZSBkaXJlY3RseVxuICAgIC8vIGNhbGxpbmcgdGhlIHdlYnNvY2tldCBtYW5hZ2VyIGJ5cGFzc2luZyB0aGUgc3luYyBtYW5hZ2VyLlxuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLl9pc09wZW4oKSkgcmV0dXJuO1xuICAgIGxldCBjb3VudCA9IDAsXG4gICAgICBhYm9ydCA9IGZhbHNlO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgT2JqZWN0LmtleXModGhpcy5fcmVxdWVzdENhbGxiYWNrcykuZm9yRWFjaCgocmVxdWVzdElkKSA9PiB7XG4gICAgICBjb25zdCBjYWxsYmFja0NvbmZpZyA9IHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXTtcbiAgICAgIGlmIChhYm9ydCkgcmV0dXJuO1xuXG4gICAgICAvLyBJZiB0aGUgcmVxdWVzdCBoYXNuJ3QgZXhwaXJlZCwgd2UnbGwgbmVlZCB0byByZXNjaGVkdWxlIGNhbGxiYWNrIGNsZWFudXA7IGVsc2UgaWYgaXRzIGV4cGlyZWQuLi5cbiAgICAgIGlmIChjYWxsYmFja0NvbmZpZyAmJiBub3cgPCBjYWxsYmFja0NvbmZpZy5kYXRlICsgREVMQVlfVU5USUxfVElNRU9VVCkge1xuICAgICAgICBjb3VudCsrO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBoYXMgYmVlbiBubyBkYXRhIGZyb20gdGhlIHNlcnZlciwgdGhlcmUncyBwcm9iYWJseSBhIHByb2JsZW0gd2l0aCB0aGUgd2Vic29ja2V0OyByZWNvbm5lY3QuXG4gICAgICBlbHNlIGlmIChub3cgPiB0aGlzLnNvY2tldE1hbmFnZXIuX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCArIERFTEFZX1VOVElMX1RJTUVPVVQpIHtcbiAgICAgICAgLy8gUmV0cnlpbmcgaXNuJ3QgY3VycmVudGx5IGhhbmRsZWQgaGVyZTsgaXRzIGhhbmRsZWQgYnkgdGhlIGNhbGxlciAodHlwaWNhbGx5IHN5bmMtbWFuYWdlcik7IHNvIGNsZWFyIG91dCBhbGwgcmVxdWVzdHMsXG4gICAgICAgIC8vIG5vdGlmeWluZyB0aGUgY2FsbGVycyB0aGF0IHRoZXkgaGF2ZSBmYWlsZWQuXG4gICAgICAgIGFib3J0ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZmFpbEFsbCgpO1xuICAgICAgICB0aGlzLnNvY2tldE1hbmFnZXIuX3JlY29ubmVjdChmYWxzZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgcmVxdWVzdCBpc24ndCByZXNwb25kaW5nIGFuZCB0aGUgc29ja2V0IGlzIGdvb2Q7IGZhaWwgdGhlIHJlcXVlc3QuXG4gICAgICAgIHRoaXMuX3RpbWVvdXRSZXF1ZXN0KHJlcXVlc3RJZCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGNvdW50KSB0aGlzLl9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFueSByZXF1ZXN0cyB0aGF0IGhhdmUgbm90IGhhZCByZXNwb25zZXMgYXJlIGNvbnNpZGVyZWQgYXMgZmFpbGVkIGlmIHdlIGRpc2Nvbm5lY3Qgd2l0aG91dCBhIHJlc3BvbnNlLlxuICAgKlxuICAgKiBDYWxsIGFsbCBjYWxsYmFja3Mgd2l0aCBhIGBzZXJ2ZXJfdW5hdmFpbGFibGVgIGVycm9yLiAgVGhlIGNhbGxlciBtYXkgcmV0cnksXG4gICAqIGJ1dCB0aGlzIGNvbXBvbmVudCBkb2VzIG5vdCBoYXZlIGJ1aWx0LWluIHJldHJ5LlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZmFpbEFsbCgpIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzKS5mb3JFYWNoKChyZXF1ZXN0SWQpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdXZWJzb2NrZXQgcmVxdWVzdCBhYm9ydGVkIGR1ZSB0byByZWNvbm5lY3QnKTtcbiAgICAgICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdLmNhbGxiYWNrKHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBzdGF0dXM6IDUwMyxcbiAgICAgICAgICBkYXRhOiBuZXcgTGF5ZXJFcnJvcih7XG4gICAgICAgICAgICBpZDogJ3NvY2tldF9kZWFkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdXZWJzb2NrZXQgYXBwZWFycyB0byBiZSBkZWFkLiBSZWNvbm5lY3RpbmcuJyxcbiAgICAgICAgICAgIHVybDogJ2h0dHBzOi9kZXZlbG9wZXIubGF5ZXIuY29tL2RvY3Mvd2Vic2RrJyxcbiAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICBzdGF0dXM6IDUwMyxcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDUwMyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZ1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXTtcbiAgICB9KTtcbiAgfVxuXG4gIF90aW1lb3V0UmVxdWVzdChyZXF1ZXN0SWQpIHtcbiAgICB0cnkge1xuICAgICAgbG9nZ2VyLndhcm4oJ1dlYnNvY2tldCByZXF1ZXN0IHRpbWVvdXQnKTtcbiAgICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXS5jYWxsYmFjayh7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBkYXRhOiBuZXcgTGF5ZXJFcnJvcih7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3RpbWVvdXQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdUaGUgc2VydmVyIGlzIG5vdCByZXNwb25kaW5nLiBXZSBrbm93IGhvdyBtdWNoIHRoYXQgc3Vja3MuJyxcbiAgICAgICAgICB1cmw6ICdodHRwczovZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL3dlYnNkaycsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICBzdGF0dXM6IDQwOCxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDgsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBEbyBub3RoaW5nXG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF07XG4gIH1cblxuICBfaXNPcGVuKCkge1xuICAgIHJldHVybiB0aGlzLnNvY2tldE1hbmFnZXIuX2lzT3BlbigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmlzRGVzdHJveWVkID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5fY2FsbGJhY2tDbGVhbnVwSWQpIGNsZWFyVGltZW91dCh0aGlzLl9jYWxsYmFja0NsZWFudXBJZCk7XG4gICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrcyA9IG51bGw7XG4gIH1cbn1cblxuV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIucHJvdG90eXBlLl9uZXh0UmVxdWVzdElkID0gMTtcblxuLyoqXG4gKiBUaGUgQ2xpZW50IHRoYXQgb3ducyB0aGlzLlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqL1xuV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5fcmVxdWVzdENhbGxiYWNrcyA9IG51bGw7XG5cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5fY2FsbGJhY2tDbGVhbnVwSWQgPSAwO1xuXG5XZWJzb2NrZXRSZXF1ZXN0TWFuYWdlci5wcm90b3R5cGUuc29ja2V0TWFuYWdlciA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzID0gV2Vic29ja2V0UmVxdWVzdE1hbmFnZXI7XG5cbiJdfQ==
