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
        var data = msg.success ? msg.data : new LayerError(msg.data);
        logger.debug('Websocket response ' + requestId + ' ' + (msg.success ? 'Successful' : 'Failed'));
        if (requestId && this._requestCallbacks[requestId]) {
          this._requestCallbacks[requestId].callback({
            success: msg.success,
            fullData: evt.data,
            data: data
          });
          delete this._requestCallbacks[requestId];
        }
      }
    }

    /**
     * Shortcut for sending a request; builds in handling for callbacks
     *
     *    manager.sendRequest({
     *      operation: "delete",
     *      object: {id: "layer:///conversations/uuid"},
     *      data: {deletion_mode: "all_participants"}
     *    }, function(result) {
     *        alert(result.success ? "Yay" : "Boo");
     *    });
     *
     * @method sendRequest
     * @param  {Object} data - Data to send to the server
     * @param  {Function} callback - Handler for success/failure callback
     */

  }, {
    key: 'sendRequest',
    value: function sendRequest(data, callback) {
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
          date: Date.now(),
          callback: callback
        };
      }

      this.socketManager.send({
        type: 'request',
        body: body
      });
      this._scheduleCallbackCleanup();
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
      var _this = this;

      this._callbackCleanupId = 0;
      // If the websocket is closed, ignore all callbacks.  The Sync Manager will reissue these requests as soon as it gets
      // a 'connected' event... they have not failed.  May need to rethink this for cases where third parties are directly
      // calling the websocket manager bypassing the sync manager.
      if (this.isDestroyed || !this._isOpen()) return;
      var count = 0;
      var now = Date.now();
      Object.keys(this._requestCallbacks).forEach(function (requestId) {
        var callbackConfig = _this._requestCallbacks[requestId];
        // If the request hasn't expired, we'll need to reschedule callback cleanup; else if its expired...
        if (callbackConfig && now < callbackConfig.date + DELAY_UNTIL_TIMEOUT) {
          count++;
        }

        // If there has been no data from the server, there's probably a problem with the websocket; reconnect.
        else if (now > _this.socketManager._lastDataFromServerTimestamp + DELAY_UNTIL_TIMEOUT) {
            _this.socketManager._reconnect(false);
            _this._scheduleCallbackCleanup();
          } else {
            // The request isn't responding and the socket is good; fail the request.
            _this._timeoutRequest(requestId);
          }
      });
      if (count) this._scheduleCallbackCleanup();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3JlcXVlc3QtbWFuYWdlci5qcyJdLCJuYW1lcyI6WyJVdGlscyIsInJlcXVpcmUiLCJsb2dnZXIiLCJMYXllckVycm9yIiwiREVMQVlfVU5USUxfVElNRU9VVCIsIldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyIiwib3B0aW9ucyIsImNsaWVudCIsInNvY2tldE1hbmFnZXIiLCJvbiIsIm1lc3NhZ2UiLCJfaGFuZGxlUmVzcG9uc2UiLCJkaXNjb25uZWN0ZWQiLCJfcmVzZXQiLCJfcmVxdWVzdENhbGxiYWNrcyIsImV2dCIsImRhdGEiLCJ0eXBlIiwibXNnIiwiYm9keSIsInJlcXVlc3RJZCIsInJlcXVlc3RfaWQiLCJzdWNjZXNzIiwiZGVidWciLCJjYWxsYmFjayIsImZ1bGxEYXRhIiwiX2lzT3BlbiIsInVuZGVmaW5lZCIsImlkIiwiY29kZSIsImNsb25lIiwiX25leHRSZXF1ZXN0SWQiLCJkYXRlIiwiRGF0ZSIsIm5vdyIsInNlbmQiLCJfc2NoZWR1bGVDYWxsYmFja0NsZWFudXAiLCJfY2FsbGJhY2tDbGVhbnVwSWQiLCJzZXRUaW1lb3V0IiwiX3J1bkNhbGxiYWNrQ2xlYW51cCIsImJpbmQiLCJpc0Rlc3Ryb3llZCIsImNvdW50IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJjYWxsYmFja0NvbmZpZyIsIl9sYXN0RGF0YUZyb21TZXJ2ZXJUaW1lc3RhbXAiLCJfcmVjb25uZWN0IiwiX3RpbWVvdXRSZXF1ZXN0Iiwid2FybiIsInVybCIsInN0YXR1cyIsImh0dHBTdGF0dXMiLCJlcnIiLCJjbGVhclRpbWVvdXQiLCJwcm90b3R5cGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7Ozs7QUFRQSxJQUFNQSxRQUFRQyxRQUFRLGlCQUFSLENBQWQ7QUFDQSxJQUFNQyxTQUFTRCxRQUFRLFdBQVIsQ0FBZjtBQUNBLElBQU1FLGFBQWFGLFFBQVEsZ0JBQVIsQ0FBbkI7O0FBRUE7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RDs7OzhCQUVTO0FBQ1IsV0FBS2UsV0FBTCxHQUFtQixJQUFuQjtBQUNBLFVBQUksS0FBS0osa0JBQVQsRUFBNkJrQixhQUFhLEtBQUtsQixrQkFBbEI7QUFDN0IsV0FBS3ZCLGlCQUFMLEdBQXlCLElBQXpCO0FBQ0Q7Ozs7OztBQUdIVCx3QkFBd0JtRCxTQUF4QixDQUFrQ3pCLGNBQWxDLEdBQW1ELENBQW5EOztBQUVBOzs7O0FBSUExQix3QkFBd0JtRCxTQUF4QixDQUFrQ2pELE1BQWxDLEdBQTJDLElBQTNDOztBQUVBRix3QkFBd0JtRCxTQUF4QixDQUFrQzFDLGlCQUFsQyxHQUFzRCxJQUF0RDs7QUFFQVQsd0JBQXdCbUQsU0FBeEIsQ0FBa0NuQixrQkFBbEMsR0FBdUQsQ0FBdkQ7O0FBRUFoQyx3QkFBd0JtRCxTQUF4QixDQUFrQ2hELGFBQWxDLEdBQWtELElBQWxEOztBQUVBaUQsT0FBT0MsT0FBUCxHQUFpQnJELHVCQUFqQiIsImZpbGUiOiJyZXF1ZXN0LW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyAgbGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlclxuICogQHByaXZhdGVcbiAqXG4gKiBUaGlzIGNsYXNzIGFsbG93cyBvbmUgdG8gc2VuZCByZXF1ZXN0cyB0byB0aGUgd2Vic29ja2V0IHNlcnZlciwgYW5kIHByb3ZpZGUgYSBjYWxsYmFjayxcbiAqIEFuZCBoYXZlIHRoYXQgY2FsbGJhY2sgZWl0aGVyIGNhbGxlZCBieSB0aGUgY29ycmVjdCB3ZWJzb2NrZXQgc2VydmVyIHJlc3BvbnNlLCBvclxuICogYmUgY2FsbGVkIHdpdGggYSB0aW1lb3V0LlxuICovXG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcblxuLy8gV2FpdCAxNSBzZWNvbmRzIGZvciBhIHJlc3BvbnNlIGFuZCB0aGVuIGdpdmUgdXBcbmNvbnN0IERFTEFZX1VOVElMX1RJTUVPVVQgPSAxNSAqIDEwMDA7XG5cbmNsYXNzIFdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyB3ZWJzb2NrZXQgY2hhbmdlIG1hbmFnZXJcbiAgICpcbiAgICogICAgICB2YXIgd2Vic29ja2V0UmVxdWVzdE1hbmFnZXIgPSBuZXcgbGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBjbGllbnQuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9IHNvY2tldE1hbmFnZXJcbiAgICogQHJldHVybnMge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5jbGllbnQgPSBvcHRpb25zLmNsaWVudDtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIgPSBvcHRpb25zLnNvY2tldE1hbmFnZXI7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLm9uKHtcbiAgICAgIG1lc3NhZ2U6IHRoaXMuX2hhbmRsZVJlc3BvbnNlLFxuICAgICAgZGlzY29ubmVjdGVkOiB0aGlzLl9yZXNldCxcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3MgPSB7fTtcbiAgfVxuXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzID0ge307XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgcmVzcG9uc2UgdG8gYSByZXF1ZXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVSZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVSZXNwb25zZShldnQpIHtcbiAgICBpZiAoZXZ0LmRhdGEudHlwZSA9PT0gJ3Jlc3BvbnNlJykge1xuICAgICAgY29uc3QgbXNnID0gZXZ0LmRhdGEuYm9keTtcbiAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IG1zZy5yZXF1ZXN0X2lkO1xuICAgICAgY29uc3QgZGF0YSA9IG1zZy5zdWNjZXNzID8gbXNnLmRhdGEgOiBuZXcgTGF5ZXJFcnJvcihtc2cuZGF0YSk7XG4gICAgICBsb2dnZXIuZGVidWcoYFdlYnNvY2tldCByZXNwb25zZSAke3JlcXVlc3RJZH0gJHttc2cuc3VjY2VzcyA/ICdTdWNjZXNzZnVsJyA6ICdGYWlsZWQnfWApO1xuICAgICAgaWYgKHJlcXVlc3RJZCAmJiB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF0pIHtcbiAgICAgICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdLmNhbGxiYWNrKHtcbiAgICAgICAgICBzdWNjZXNzOiBtc2cuc3VjY2VzcyxcbiAgICAgICAgICBmdWxsRGF0YTogZXZ0LmRhdGEsXG4gICAgICAgICAgZGF0YSxcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IGZvciBzZW5kaW5nIGEgcmVxdWVzdDsgYnVpbGRzIGluIGhhbmRsaW5nIGZvciBjYWxsYmFja3NcbiAgICpcbiAgICogICAgbWFuYWdlci5zZW5kUmVxdWVzdCh7XG4gICAqICAgICAgb3BlcmF0aW9uOiBcImRlbGV0ZVwiLFxuICAgKiAgICAgIG9iamVjdDoge2lkOiBcImxheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZFwifSxcbiAgICogICAgICBkYXRhOiB7ZGVsZXRpb25fbW9kZTogXCJhbGxfcGFydGljaXBhbnRzXCJ9XG4gICAqICAgIH0sIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgKiAgICAgICAgYWxlcnQocmVzdWx0LnN1Y2Nlc3MgPyBcIllheVwiIDogXCJCb29cIik7XG4gICAqICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRSZXF1ZXN0XG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSAtIERhdGEgdG8gc2VuZCB0byB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayAtIEhhbmRsZXIgZm9yIHN1Y2Nlc3MvZmFpbHVyZSBjYWxsYmFja1xuICAgKi9cbiAgc2VuZFJlcXVlc3QoZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXMuX2lzT3BlbigpKSB7XG4gICAgICByZXR1cm4gIWNhbGxiYWNrID8gdW5kZWZpbmVkIDogY2FsbGJhY2sobmV3IExheWVyRXJyb3Ioe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZGF0YTogeyBpZDogJ25vdF9jb25uZWN0ZWQnLCBjb2RlOiAwLCBtZXNzYWdlOiAnV2ViU29ja2V0IG5vdCBjb25uZWN0ZWQnIH0sXG4gICAgICB9KSk7XG4gICAgfVxuICAgIGNvbnN0IGJvZHkgPSBVdGlscy5jbG9uZShkYXRhKTtcbiAgICBib2R5LnJlcXVlc3RfaWQgPSAncicgKyB0aGlzLl9uZXh0UmVxdWVzdElkKys7XG4gICAgbG9nZ2VyLmRlYnVnKGBSZXF1ZXN0ICR7Ym9keS5yZXF1ZXN0X2lkfSBpcyBzZW5kaW5nYCk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW2JvZHkucmVxdWVzdF9pZF0gPSB7XG4gICAgICAgIGRhdGU6IERhdGUubm93KCksXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLnNvY2tldE1hbmFnZXIuc2VuZCh7XG4gICAgICB0eXBlOiAncmVxdWVzdCcsXG4gICAgICBib2R5LFxuICAgIH0pO1xuICAgIHRoaXMuX3NjaGVkdWxlQ2FsbGJhY2tDbGVhbnVwKCk7XG4gIH1cblxuICAvKipcbiAgICogRmxhZ3MgYSByZXF1ZXN0IGFzIGhhdmluZyBmYWlsZWQgaWYgbm8gcmVzcG9uc2Ugd2l0aGluIDIgbWludXRlc1xuICAgKlxuICAgKiBAbWV0aG9kIF9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NjaGVkdWxlQ2FsbGJhY2tDbGVhbnVwKCkge1xuICAgIGlmICghdGhpcy5fY2FsbGJhY2tDbGVhbnVwSWQpIHtcbiAgICAgIHRoaXMuX2NhbGxiYWNrQ2xlYW51cElkID0gc2V0VGltZW91dCh0aGlzLl9ydW5DYWxsYmFja0NsZWFudXAuYmluZCh0aGlzKSwgREVMQVlfVU5USUxfVElNRU9VVCArIDUwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgY2FsbGJhY2sgd2l0aCBhbiBlcnJvci5cbiAgICpcbiAgICogTk9URTogQmVjYXVzZSB3ZSBjYWxsIHJlcXVlc3RzIHRoYXQgZXhwZWN0IHJlc3BvbnNlcyBzZXJpYWxseSBpbnN0ZWFkIG9mIGluIHBhcmFsbGVsLFxuICAgKiBjdXJyZW50bHkgdGhlcmUgc2hvdWxkIG9ubHkgZXZlciBiZSBhIHNpbmdsZSBlbnRyeSBpbiBfcmVxdWVzdENhbGxiYWNrcy4gIFRoaXMgbWF5IGNoYW5nZSBpbiB0aGUgZnV0dXJlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ydW5DYWxsYmFja0NsZWFudXBcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9ydW5DYWxsYmFja0NsZWFudXAoKSB7XG4gICAgdGhpcy5fY2FsbGJhY2tDbGVhbnVwSWQgPSAwO1xuICAgIC8vIElmIHRoZSB3ZWJzb2NrZXQgaXMgY2xvc2VkLCBpZ25vcmUgYWxsIGNhbGxiYWNrcy4gIFRoZSBTeW5jIE1hbmFnZXIgd2lsbCByZWlzc3VlIHRoZXNlIHJlcXVlc3RzIGFzIHNvb24gYXMgaXQgZ2V0c1xuICAgIC8vIGEgJ2Nvbm5lY3RlZCcgZXZlbnQuLi4gdGhleSBoYXZlIG5vdCBmYWlsZWQuICBNYXkgbmVlZCB0byByZXRoaW5rIHRoaXMgZm9yIGNhc2VzIHdoZXJlIHRoaXJkIHBhcnRpZXMgYXJlIGRpcmVjdGx5XG4gICAgLy8gY2FsbGluZyB0aGUgd2Vic29ja2V0IG1hbmFnZXIgYnlwYXNzaW5nIHRoZSBzeW5jIG1hbmFnZXIuXG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuX2lzT3BlbigpKSByZXR1cm47XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX3JlcXVlc3RDYWxsYmFja3MpLmZvckVhY2goKHJlcXVlc3RJZCkgPT4ge1xuICAgICAgY29uc3QgY2FsbGJhY2tDb25maWcgPSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF07XG4gICAgICAvLyBJZiB0aGUgcmVxdWVzdCBoYXNuJ3QgZXhwaXJlZCwgd2UnbGwgbmVlZCB0byByZXNjaGVkdWxlIGNhbGxiYWNrIGNsZWFudXA7IGVsc2UgaWYgaXRzIGV4cGlyZWQuLi5cbiAgICAgIGlmIChjYWxsYmFja0NvbmZpZyAmJiBub3cgPCBjYWxsYmFja0NvbmZpZy5kYXRlICsgREVMQVlfVU5USUxfVElNRU9VVCkge1xuICAgICAgICBjb3VudCsrO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBoYXMgYmVlbiBubyBkYXRhIGZyb20gdGhlIHNlcnZlciwgdGhlcmUncyBwcm9iYWJseSBhIHByb2JsZW0gd2l0aCB0aGUgd2Vic29ja2V0OyByZWNvbm5lY3QuXG4gICAgICBlbHNlIGlmIChub3cgPiB0aGlzLnNvY2tldE1hbmFnZXIuX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCArIERFTEFZX1VOVElMX1RJTUVPVVQpIHtcbiAgICAgICAgdGhpcy5zb2NrZXRNYW5hZ2VyLl9yZWNvbm5lY3QoZmFsc2UpO1xuICAgICAgICB0aGlzLl9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIHJlcXVlc3QgaXNuJ3QgcmVzcG9uZGluZyBhbmQgdGhlIHNvY2tldCBpcyBnb29kOyBmYWlsIHRoZSByZXF1ZXN0LlxuICAgICAgICB0aGlzLl90aW1lb3V0UmVxdWVzdChyZXF1ZXN0SWQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChjb3VudCkgdGhpcy5fc2NoZWR1bGVDYWxsYmFja0NsZWFudXAoKTtcbiAgfVxuXG4gIF90aW1lb3V0UmVxdWVzdChyZXF1ZXN0SWQpIHtcbiAgICB0cnkge1xuICAgICAgbG9nZ2VyLndhcm4oJ1dlYnNvY2tldCByZXF1ZXN0IHRpbWVvdXQnKTtcbiAgICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXS5jYWxsYmFjayh7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBkYXRhOiBuZXcgTGF5ZXJFcnJvcih7XG4gICAgICAgICAgaWQ6ICdyZXF1ZXN0X3RpbWVvdXQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdUaGUgc2VydmVyIGlzIG5vdCByZXNwb25kaW5nLiBXZSBrbm93IGhvdyBtdWNoIHRoYXQgc3Vja3MuJyxcbiAgICAgICAgICB1cmw6ICdodHRwczovZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL3dlYnNkaycsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICBzdGF0dXM6IDQwOCxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDgsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBEbyBub3RoaW5nXG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF07XG4gIH1cblxuICBfaXNPcGVuKCkge1xuICAgIHJldHVybiB0aGlzLnNvY2tldE1hbmFnZXIuX2lzT3BlbigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmlzRGVzdHJveWVkID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5fY2FsbGJhY2tDbGVhbnVwSWQpIGNsZWFyVGltZW91dCh0aGlzLl9jYWxsYmFja0NsZWFudXBJZCk7XG4gICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrcyA9IG51bGw7XG4gIH1cbn1cblxuV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIucHJvdG90eXBlLl9uZXh0UmVxdWVzdElkID0gMTtcblxuLyoqXG4gKiBUaGUgQ2xpZW50IHRoYXQgb3ducyB0aGlzLlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqL1xuV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5fcmVxdWVzdENhbGxiYWNrcyA9IG51bGw7XG5cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5fY2FsbGJhY2tDbGVhbnVwSWQgPSAwO1xuXG5XZWJzb2NrZXRSZXF1ZXN0TWFuYWdlci5wcm90b3R5cGUuc29ja2V0TWFuYWdlciA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzID0gV2Vic29ja2V0UmVxdWVzdE1hbmFnZXI7XG5cbiJdfQ==
