'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @class  layer.SyncManager
 * @extends layer.Root
 * @protected
 *
 * This class manages
 *
 * 1. a queue of requests that need to be made
 * 2. when a request should be fired, based on authentication state, online state, websocket connection state, and position in the queue
 * 3. when a request should be aborted
 * 4. triggering any request callbacks
 *
 * TODO: In the event of a DNS error, we may have a valid websocket receiving events and telling us we are online,
 * and be unable to create a REST call.  This will be handled wrong because evidence will suggest that we are online.
 * This issue goes away when we use bidirectional websockets for all requests.
 *
 * Applications do not typically interact with this class, but may subscribe to its events
 * to get richer detailed information than is available from the layer.Client instance.
 */
var Root = require('./root');

var _require = require('./sync-event'),
    WebsocketSyncEvent = _require.WebsocketSyncEvent;

var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var MAX_RECEIPT_CONNECTIONS = 4;

var SyncManager = function (_Root) {
  _inherits(SyncManager, _Root);

  /**
   * Creates a new SyncManager.
   *
   * An Application is expected to only have one SyncManager.
   *
   *      var socketManager = new layer.Websockets.SocketManager({client: client});
   *      var requestManager = new layer.Websockets.RequestManager({client: client, socketManager: socketManager});
   *
   *      var onlineManager = new layer.OnlineManager({
   *          socketManager: socketManager
   *      });
   *
   *      // Now we can instantiate this thing...
   *      var SyncManager = new layer.SyncManager({
   *          client: client,
   *          onlineManager: onlineManager,
   *          socketManager: socketManager,
   *          requestManager: requestManager
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param {layer.OnlineStateManager} options.onlineManager
   * @param {layer.Websockets.RequestManager} options.requestManager
   * @param {layer.Client} options.client
   */
  function SyncManager(options) {
    _classCallCheck(this, SyncManager);

    var _this = _possibleConstructorReturn(this, (SyncManager.__proto__ || Object.getPrototypeOf(SyncManager)).call(this, options));

    _this.client = options.client;

    // Note we do not store a pointer to client... it is not needed.
    if (_this.client) {
      _this.client.on('ready', function () {
        _this._processNextRequest();
        _this._loadPersistedQueue();
      }, _this);
    }
    _this.queue = [];
    _this.receiptQueue = [];

    // Rather than listen for onlineManager 'connected', let the socketManager listen for that, connect, and the syncManager
    // waits until its actually connected
    _this.onlineManager.on('disconnected', _this._onlineStateChange, _this);
    _this.socketManager.on('connected disconnected', _this._onlineStateChange, _this);
    return _this;
  }

  /**
   * Returns whether the Client is online/offline.
   *
   * For internal use; applications should use layer.Client.isOnline.
   *
   * @method isOnline
   * @returns {Boolean}
   */


  _createClass(SyncManager, [{
    key: 'isOnline',
    value: function isOnline() {
      return this.onlineManager.isOnline;
    }

    /**
     * Process sync request when connection is restored.
     *
     * Any time we go back online (as signaled by the onlineStateManager),
     * Process the next Sync Event (will do nothing if one is already firing)
     *
     * @method _onlineStateChange
     * @private
     * @param  {string} evtName - 'connected' or 'disconnected'
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_onlineStateChange',
    value: function _onlineStateChange(evt) {
      var _this2 = this;

      if (evt.eventName === 'connected') {
        if (this.queue.length) this.queue[0].returnToOnlineCount++;
        setTimeout(function () {
          return _this2._processNextRequest();
        }, 100);
      } else if (evt.eventName === 'disconnected') {
        if (this.queue.length) {
          this.queue[0].isFiring = false;
        }
        if (this.receiptQueue.length) {
          this.receiptQueue.forEach(function (syncEvt) {
            return syncEvt.isFiring = false;
          });
        }
      }
    }

    /**
     * Adds a new xhr request to the queue.
     *
     * If the queue is empty, this will be fired immediately; else it will be added to the queue and wait its turn.
     *
     * If its a read/delivery receipt request, it will typically be fired immediately unless there are many receipt
     * requests already in-flight.
     *
     * @method request
     * @param  {layer.SyncEvent} requestEvt - A SyncEvent specifying the request to be made
     */

  }, {
    key: 'request',
    value: function request(requestEvt) {
      // If its a PATCH request on an object that isn't yet created,
      // do not add it to the queue.
      if (requestEvt.operation !== 'PATCH' || !this._findUnfiredCreate(requestEvt)) {
        logger.info('Sync Manager Request ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        if (requestEvt.operation === 'RECEIPT') {
          this.receiptQueue.push(requestEvt);
        } else {
          this.queue.push(requestEvt);
        }
        this.trigger('sync:add', {
          request: requestEvt,
          target: requestEvt.target
        });
      } else {
        logger.info('Sync Manager Request PATCH ' + requestEvt.target + ' request ignored; create request still enqueued', requestEvt.toObject());
      }

      // If its a DELETE request, purge all other requests on that target.
      if (requestEvt.operation === 'DELETE') {
        this._purgeOnDelete(requestEvt);
      }

      this._processNextRequest(requestEvt);
    }
  }, {
    key: '_processNextRequest',
    value: function _processNextRequest(requestEvt) {
      var _this3 = this;

      // Fire the request if there aren't any existing requests already firing
      if (this.queue.length && !this.queue[0].isFiring) {
        if (requestEvt) {
          this.client.dbManager.writeSyncEvents([requestEvt], function () {
            return _this3._processNextStandardRequest();
          });
        } else {
          this._processNextStandardRequest();
        }
      }

      // If we have anything in the receipts queue, fire it
      if (this.receiptQueue.length) {
        this._processNextReceiptRequest();
      }
    }

    /**
     * Find create request for this resource.
     *
     * Determine if the given target has a POST request waiting to create
     * the resource, and return any matching requests. Used
     * for folding PATCH requests into an unfired CREATE/POST request.
     *
     * @method _findUnfiredCreate
     * @private
     * @param  {layer.SyncEvent} requestEvt
     * @return {Boolean}
     */

  }, {
    key: '_findUnfiredCreate',
    value: function _findUnfiredCreate(requestEvt) {
      return Boolean(this.queue.filter(function (evt) {
        return evt.target === requestEvt.target && evt.operation === 'POST' && !evt.isFiring;
      }).length);
    }

    /**
     * Process the next request in the queue.
     *
     * Request is dequeued on completing the process.
     * If the first request in the queue is firing, do nothing.
     *
     * @method _processNextRequest
     * @private
     */

  }, {
    key: '_processNextStandardRequest',
    value: function _processNextStandardRequest() {
      var _this4 = this;

      if (this.isDestroyed || !this.client.isAuthenticated) return;
      var requestEvt = this.queue[0];
      if (this.isOnline() && requestEvt && !requestEvt.isFiring && !requestEvt._isValidating) {
        requestEvt._isValidating = true;
        this._validateRequest(requestEvt, function (isValid) {
          requestEvt._isValidating = false;
          if (!isValid) {
            _this4._removeRequest(requestEvt, false);
            return _this4._processNextStandardRequest();
          } else {
            _this4._fireRequest(requestEvt);
          }
        });
      }
    }

    /**
     * Process up to MAX_RECEIPT_CONNECTIONS worth of receipts.
     *
     * These requests have no interdependencies. Just fire them all
     * as fast as we can, in parallel.
     *
     * @method _processNextReceiptRequest
     * @private
     */

  }, {
    key: '_processNextReceiptRequest',
    value: function _processNextReceiptRequest() {
      var _this5 = this;

      var firingReceipts = 0;
      this.receiptQueue.forEach(function (receiptEvt) {
        if (_this5.isOnline() && receiptEvt) {
          if (receiptEvt.isFiring || receiptEvt._isValidating) {
            firingReceipts++;
          } else if (firingReceipts < MAX_RECEIPT_CONNECTIONS) {
            firingReceipts++;
            _this5._fireRequest(receiptEvt);
          }
        }
      });
    }

    /**
     * Directly fire this sync request.
     *
     * This is intended to be called only after careful analysis of our state to make sure its safe to send the request.
     * See `_processNextRequest()`
     *
     * @method _fireRequest
     * @private
     * @param {layer.SyncEvent} requestEvt
     */

  }, {
    key: '_fireRequest',
    value: function _fireRequest(requestEvt) {
      if (requestEvt instanceof WebsocketSyncEvent) {
        this._fireRequestWebsocket(requestEvt);
      } else {
        this._fireRequestXHR(requestEvt);
      }
    }

    /**
     * Directly fire this XHR Sync request.
     *
     * @method _fireRequestXHR
     * @private
     * @param {layer.SyncEvent.XHRSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestXHR',
    value: function _fireRequestXHR(requestEvt) {
      var _this6 = this;

      requestEvt.isFiring = true;
      if (!requestEvt.headers) requestEvt.headers = {};
      requestEvt.headers.authorization = 'Layer session-token="' + this.client.sessionToken + '"';
      logger.info('Sync Manager XHR Request Firing ' + requestEvt.operation + ' ' + requestEvt.target + ' at ' + new Date().toISOString(), requestEvt.toObject());
      xhr(requestEvt._getRequestData(this.client), function (result) {
        return _this6._xhrResult(result, requestEvt);
      });
    }

    /**
     * Directly fire this Websocket Sync request.
     *
     * @method _fireRequestWebsocket
     * @private
     * @param {layer.SyncEvent.WebsocketSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestWebsocket',
    value: function _fireRequestWebsocket(requestEvt) {
      var _this7 = this;

      if (this.socketManager && this.socketManager._isOpen()) {
        logger.debug('Sync Manager Websocket Request Firing ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        requestEvt.isFiring = true;
        this.requestManager.sendRequest(requestEvt._getRequestData(this.client), function (result) {
          return _this7._xhrResult(result, requestEvt);
        });
      } else {
        logger.debug('Sync Manager Websocket Request skipped; socket closed');
      }
    }

    /**
     * Is the syncEvent still valid?
     *
     * This method specifically tests to see if some other tab has already sent this request.
     * If persistence of the syncQueue is not enabled, then the callback is immediately called with true.
     * If another tab has already sent the request, then the entry will no longer be in indexedDB and the callback
     * will call false.
     *
     * @method _validateRequest
     * @param {layer.SyncEvent} syncEvent
     * @param {Function} callback
     * @param {Function} callback.isValid - The request is still valid
     * @private
     */

  }, {
    key: '_validateRequest',
    value: function _validateRequest(syncEvent, callback) {
      this.client.dbManager.claimSyncEvent(syncEvent, function (isFound) {
        return callback(isFound);
      });
    }

    /**
     * Turn deduplication errors into success messages.
     *
     * If this request has already been made but we failed to get a response the first time and we retried the request,
     * we will reissue the request.  If the prior request was successful we'll get back a deduplication error
     * with the created object. As far as the WebSDK is concerned, this is a success.
     *
     * @method _handleDeduplicationErrors
     * @private
     */

  }, {
    key: '_handleDeduplicationErrors',
    value: function _handleDeduplicationErrors(result) {
      if (result.data && result.data.id === 'id_in_use' && result.data.data && result.data.data.id === result.request._getCreateId()) {
        result.success = true;
        result.data = result.data.data;
      }
    }

    /**
     * Process the result of an xhr call, routing it to the appropriate handler.
     *
     * @method _xhrResult
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, requestEvt) {
      if (this.isDestroyed) return;
      result.request = requestEvt;
      requestEvt.isFiring = false;
      this._handleDeduplicationErrors(result);
      if (!result.success) {
        this._xhrError(result);
      } else {
        this._xhrSuccess(result);
      }
    }

    /**
     * Categorize the error for handling.
     *
     * @method _getErrorState
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     * @param  {boolean} isOnline - Is our app state set to online
     * @returns {String}
     */

  }, {
    key: '_getErrorState',
    value: function _getErrorState(result, requestEvt, isOnline) {
      var errId = result.data ? result.data.id : '';
      if (!isOnline) {
        // CORS errors look identical to offline; but if our online state has transitioned from false to true repeatedly while processing this request,
        // thats a hint that that its a CORS error
        if (requestEvt.returnToOnlineCount >= SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR) {
          return 'CORS';
        } else {
          return 'offline';
        }
      } else if (errId === 'not_found') {
        return 'notFound';
      } else if (errId === 'id_in_use') {
        return 'invalidId'; // This only fires if we get `id_in_use` but no Resource, which means the UUID was used by another user/app.
      } else if (result.status === 408 || errId === 'request_timeout') {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'validateOnlineAndRetry';
        }
      } else if ([502, 503, 504].indexOf(result.status) !== -1) {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'serverUnavailable';
        }
      } else if (errId === 'authentication_required' && result.data.data && result.data.data.nonce) {
        return 'reauthorize';
      } else {
        return 'serverRejectedRequest';
      }
    }

    /**
     * Handle failed requests.
     *
     * 1. If there was an error from the server, then the request has problems
     * 2. If we determine we are not in fact online, call the connectionError handler
     * 3. If we think we are online, verify we are online and then determine how to handle it.
     *
     * @method _xhrError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrError',
    value: function _xhrError(result) {
      var requestEvt = result.request;

      logger.warn('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Failed'), requestEvt.toObject());

      var errState = this._getErrorState(result, requestEvt, this.isOnline());
      logger.warn('Sync Manager Error State: ' + errState);
      switch (errState) {
        case 'tooManyFailuresWhileOnline':
          this._xhrHandleServerError(result, 'Sync Manager Server Unavailable Too Long; removing request', false);
          break;
        case 'notFound':
          this._xhrHandleServerError(result, 'Resource not found; presumably deleted', false);
          break;
        case 'invalidId':
          this._xhrHandleServerError(result, 'ID was not unique; request failed', false);
          break;
        case 'validateOnlineAndRetry':
          // Server appears to be hung but will eventually recover.
          // Retry a few times and then error out.
          // this._xhrValidateIsOnline(requestEvt);
          this._xhrHandleServerUnavailableError(requestEvt);
          break;
        case 'serverUnavailable':
          // Server is in a bad state but will eventually recover;
          // keep retrying.
          this._xhrHandleServerUnavailableError(requestEvt);
          break;
        case 'reauthorize':
          // sessionToken appears to no longer be valid; forward response
          // on to client-authenticator to process.
          // Do not retry nor advance to next request.
          if (requestEvt.callback) requestEvt.callback(result);

          break;
        case 'serverRejectedRequest':
          // Server presumably did not like the arguments to this call
          // or the url was invalid.  Do not retry; trigger the callback
          // and let the caller handle it.
          this._xhrHandleServerError(result, 'Sync Manager Server Rejects Request; removing request', true);
          break;
        case 'CORS':
          // A pattern of offline-like failures that suggests its actually a CORs error
          this._xhrHandleServerError(result, 'Sync Manager Server detects CORS-like errors; removing request', false);
          break;
        case 'offline':
          this._xhrHandleConnectionError();
          break;
      }

      // Write the sync event back to the database if we haven't completed processing it
      if (this.queue.indexOf(requestEvt) !== -1 || this.receiptQueue.indexOf(requestEvt) !== -1) {
        this.client.dbManager.writeSyncEvents([requestEvt]);
      }
    }

    /**
     * Handle a server unavailable error.
     *
     * In the event of a 502 (Bad Gateway), 503 (service unavailable)
     * or 504 (gateway timeout) error from the server
     * assume we have an error that is self correcting on the server.
     * Use exponential backoff to retry the request.
     *
     * Note that each call will increment retryCount; there is a maximum
     * of MAX_RETRIES before it is treated as an error
     *
     * @method  _xhrHandleServerUnavailableError
     * @private
     * @param {layer.SyncEvent} request
     */

  }, {
    key: '_xhrHandleServerUnavailableError',
    value: function _xhrHandleServerUnavailableError(request) {
      var maxDelay = SyncManager.MAX_UNAVAILABLE_RETRY_WAIT;
      var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, request.retryCount++));
      logger.warn('Sync Manager Server Unavailable; retry count ' + request.retryCount + '; retrying in ' + delay + ' seconds');
      setTimeout(this._processNextRequest.bind(this), delay * 1000);
    }

    /**
     * Handle a server error in response to firing sync event.
     *
     * If there is a server error, its presumably non-recoverable/non-retryable error, so
     * we're going to abort this request.
     *
     * 1. If a callback was provided, call it to handle the error
     * 2. If a rollback call is provided, call it to undo any patch/delete/etc... changes
     * 3. If the request was to create a resource, remove from the queue all requests
     *    that depended upon that resource.
     * 4. Advance to next request
     *
     * @method _xhrHandleServerError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {string} logMsg - Message to display in console
     * @param  {boolean} stringify - log object for quick debugging
     *
     */

  }, {
    key: '_xhrHandleServerError',
    value: function _xhrHandleServerError(result, logMsg, stringify) {
      // Execute all callbacks provided by the request
      if (result.request.callback) result.request.callback(result);
      if (stringify) {
        logger.error(logMsg + '\nREQUEST: ' + JSON.stringify(result.request.toObject(), null, 4) + '\nRESPONSE: ' + JSON.stringify(result.data, null, 4));
      } else {
        logger.error(logMsg, result);
      }
      this.trigger('sync:error', {
        target: result.request.target,
        request: result.request,
        error: result.data
      });

      result.request.success = false;

      // If a POST request fails, all requests that depend upon this object
      // must be purged
      if (result.request.operation === 'POST') {
        this._purgeDependentRequests(result.request);
      }

      // Remove this request as well (side-effect: rolls back the operation)
      this._removeRequest(result.request, true);

      // And finally, we are ready to try the next request
      this._processNextRequest();
    }

    /**
     * If there is a connection error, wait for retry.
     *
     * In the event of what appears to be a connection error,
     * Wait until a 'connected' event before processing the next request (actually reprocessing the current event)
     *
     * @method _xhrHandleConnectionError
     * @private
     */

  }, {
    key: '_xhrHandleConnectionError',
    value: function _xhrHandleConnectionError() {}
    // Nothing to be done; we already have the below event handler setup
    // this.onlineManager.once('connected', () => this._processNextRequest());


    /**
     * Verify that we are online and retry request.
     *
     * This method is called when we think we're online, but
     * have determined we need to validate that assumption.
     *
     * Test that we have a connection; if we do,
     * retry the request once, and if it fails again,
     * _xhrError() will determine it to have failed and remove it from the queue.
     *
     * If we are offline, then let _xhrHandleConnectionError handle it.
     *
     * @method _xhrValidateIsOnline
     * @private
     */

  }, {
    key: '_xhrValidateIsOnline',
    value: function _xhrValidateIsOnline(requestEvt) {
      var _this8 = this;

      logger.debug('Sync Manager verifying online state');
      this.onlineManager.checkOnlineStatus(function (isOnline) {
        return _this8._xhrValidateIsOnlineCallback(isOnline, requestEvt);
      });
    }

    /**
     * If we have verified we are online, retry request.
     *
     * We should have received a response to our /nonces call
     * which assuming the server is actually alive,
     * will tell us if the connection is working.
     *
     * If we are offline, flag us as offline and let the ConnectionError handler handle this
     * If we are online, give the request a single retry (there is never more than one retry)
     *
     * @method _xhrValidateIsOnlineCallback
     * @private
     * @param  {boolean} isOnline  - Response object returned by xhr call
     * @param {layer.SyncEvent} requestEvt - The request that failed triggering this call
     */

  }, {
    key: '_xhrValidateIsOnlineCallback',
    value: function _xhrValidateIsOnlineCallback(isOnline, requestEvt) {
      logger.debug('Sync Manager online check result is ' + isOnline);
      if (!isOnline) {
        // Treat this as a Connection Error
        this._xhrHandleConnectionError();
      } else {
        // Retry the request in case we were offline, but are now online.
        // Of course, if this fails, give it up entirely.
        requestEvt.retryCount++;
        this._processNextRequest();
      }
    }

    /**
     * The XHR request was successful.
     *
     * Any xhr request that actually succedes:
     *
     * 1. Remove it from the queue
     * 2. Call any callbacks
     * 3. Advance to next request
     *
     * @method _xhrSuccess
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrSuccess',
    value: function _xhrSuccess(result) {
      var requestEvt = result.request;
      logger.debug('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Succeeded'), requestEvt.toObject());
      if (result.data) logger.debug(result.data);
      requestEvt.success = true;
      this._removeRequest(requestEvt, true);
      if (requestEvt.callback) requestEvt.callback(result);
      this._processNextRequest();

      this.trigger('sync:success', {
        target: requestEvt.target,
        request: requestEvt,
        response: result.data
      });
    }

    /**
     * Remove the SyncEvent request from the queue.
     *
     * @method _removeRequest
     * @private
     * @param  {layer.SyncEvent} requestEvt - SyncEvent Request to remove
     * @param {Boolean} deleteDB - Delete from indexedDB
     */

  }, {
    key: '_removeRequest',
    value: function _removeRequest(requestEvt, deleteDB) {
      var queue = requestEvt.operation === 'RECEIPT' ? this.receiptQueue : this.queue;
      var index = queue.indexOf(requestEvt);
      if (index !== -1) queue.splice(index, 1);
      if (deleteDB) this.client.dbManager.deleteObjects('syncQueue', [requestEvt]);
    }

    /**
     * Remove requests from queue that depend on specified resource.
     *
     * If there is a POST request to create a new resource, and there are PATCH, DELETE, etc...
     * requests on that resource, if the POST request fails, then all PATCH, DELETE, etc
     * requests must be removed from the queue.
     *
     * Note that we do not call the rollback on these dependent requests because the expected
     * rollback is to destroy the thing that was created, which means any other rollback has no effect.
     *
     * @method _purgeDependentRequests
     * @private
     * @param  {layer.SyncEvent} request - Request whose target is no longer valid
     */

  }, {
    key: '_purgeDependentRequests',
    value: function _purgeDependentRequests(request) {
      this.queue = this.queue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
      this.receiptQueue = this.receiptQueue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
    }

    /**
     * Remove from queue all events that operate upon the deleted object.
     *
     * @method _purgeOnDelete
     * @private
     * @param  {layer.SyncEvent} evt - Delete event that requires removal of other events
     */

  }, {
    key: '_purgeOnDelete',
    value: function _purgeOnDelete(evt) {
      var _this9 = this;

      this.queue.filter(function (request) {
        return request.depends.indexOf(evt.target) !== -1 && evt !== request;
      }).forEach(function (requestEvt) {
        _this9.trigger('sync:abort', {
          target: requestEvt.target,
          request: requestEvt
        });
        _this9._removeRequest(requestEvt, true);
      });
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.queue.forEach(function (evt) {
        return evt.destroy();
      });
      this.queue = null;
      this.receiptQueue.forEach(function (evt) {
        return evt.destroy();
      });
      this.receiptQueue = null;
      _get(SyncManager.prototype.__proto__ || Object.getPrototypeOf(SyncManager.prototype), 'destroy', this).call(this);
    }

    /**
     * Load any unsent requests from indexedDB.
     *
     * If persistence is disabled, nothing will happen;
     * else all requests found in the database will be added to the queue.
     * @method _loadPersistedQueue
     * @private
     */

  }, {
    key: '_loadPersistedQueue',
    value: function _loadPersistedQueue() {
      var _this10 = this;

      this.client.dbManager.loadSyncQueue(function (data) {
        if (data.length) {
          _this10.queue = _this10.queue.concat(data);
          _this10._processNextRequest();
        }
      });
    }
  }]);

  return SyncManager;
}(Root);

/**
 * Websocket Manager for getting socket state.
 * @type {layer.Websockets.SocketManager}
 */


SyncManager.prototype.socketManager = null;

/**
 * Websocket Request Manager for sending requests.
 * @type {layer.Websockets.RequestManager}
 */
SyncManager.prototype.requestManager = null;

/**
 * Reference to the Online State Manager.
 *
 * Sync Manager uses online status to determine if it can fire sync-requests.
 * @private
 * @type {layer.OnlineStateManager}
 */
SyncManager.prototype.onlineManager = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.queue = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 *
 * Receipts can generally just be fired off all at once without much fretting about ordering or dependencies.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.receiptQueue = null;

/**
 * Reference to the Client so that we can pass it to SyncEvents  which may need to lookup their targets
 */
SyncManager.prototype.client = null;

/**
 * Maximum exponential backoff wait.
 *
 * If the server is returning 502, 503 or 504 errors, exponential backoff
 * should never wait longer than this number of seconds (15 minutes)
 * @type {Number}
 * @static
 */
SyncManager.MAX_UNAVAILABLE_RETRY_WAIT = 60 * 15;

/**
 * Retries before suspect CORS error.
 *
 * How many times can we transition from offline to online state
 * with this request at the front of the queue before we conclude
 * that the reason we keep thinking we're going offline is
 * a CORS error returning a status of 0.  If that pattern
 * shows 3 times in a row, there is likely a CORS error.
 * Note that CORS errors appear to javascript as a status=0 error,
 * which is the same as if the client were offline.
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR = 3;

/**
 * Abort request after this number of retries.
 *
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES = 20;

SyncManager._supportedEvents = [
/**
 * A sync request has failed.
 *
 * ```
 * client.syncManager.on('sync:error', function(evt) {
 *    console.error(evt.target.id + ' failed to send changes to server: ', result.data.message);
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.error - The error object {id, code, message, url}
 */
'sync:error',

/**
 * A sync layer request has completed successfully.
 *
 * ```
 * client.syncManager.on('sync:success', function(evt) {
 *    console.log(evt.target.id + ' changes sent to server successfully');
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.data - null or any data returned by the call
 */
'sync:success',

/**
 * A new sync request has been added.
 *
 * ```
 * client.syncManager.on('sync:add', function(evt) {
 *    console.log(evt.target.id + ' has changes queued for the server');
 *    console.log('Request Event:', requestEvt);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt - The request object
 */
'sync:add',

/**
 * A sync request has been canceled.
 *
 * Typically caused by a new SyncEvent that deletes the target of this SyncEvent
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 */
'sync:abort'].concat(Root._supportedEvents);

Root.initClass(SyncManager);
module.exports = SyncManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLW1hbmFnZXIuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJ4aHIiLCJsb2dnZXIiLCJVdGlscyIsIk1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TIiwiU3luY01hbmFnZXIiLCJvcHRpb25zIiwiY2xpZW50Iiwib24iLCJfcHJvY2Vzc05leHRSZXF1ZXN0IiwiX2xvYWRQZXJzaXN0ZWRRdWV1ZSIsInF1ZXVlIiwicmVjZWlwdFF1ZXVlIiwib25saW5lTWFuYWdlciIsIl9vbmxpbmVTdGF0ZUNoYW5nZSIsInNvY2tldE1hbmFnZXIiLCJpc09ubGluZSIsImV2dCIsImV2ZW50TmFtZSIsImxlbmd0aCIsInJldHVyblRvT25saW5lQ291bnQiLCJzZXRUaW1lb3V0IiwiaXNGaXJpbmciLCJmb3JFYWNoIiwic3luY0V2dCIsInJlcXVlc3RFdnQiLCJvcGVyYXRpb24iLCJfZmluZFVuZmlyZWRDcmVhdGUiLCJpbmZvIiwidGFyZ2V0IiwidG9PYmplY3QiLCJwdXNoIiwidHJpZ2dlciIsInJlcXVlc3QiLCJfcHVyZ2VPbkRlbGV0ZSIsImRiTWFuYWdlciIsIndyaXRlU3luY0V2ZW50cyIsIl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCIsIl9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0IiwiQm9vbGVhbiIsImZpbHRlciIsImlzRGVzdHJveWVkIiwiaXNBdXRoZW50aWNhdGVkIiwiX2lzVmFsaWRhdGluZyIsIl92YWxpZGF0ZVJlcXVlc3QiLCJpc1ZhbGlkIiwiX3JlbW92ZVJlcXVlc3QiLCJfZmlyZVJlcXVlc3QiLCJmaXJpbmdSZWNlaXB0cyIsInJlY2VpcHRFdnQiLCJfZmlyZVJlcXVlc3RXZWJzb2NrZXQiLCJfZmlyZVJlcXVlc3RYSFIiLCJoZWFkZXJzIiwiYXV0aG9yaXphdGlvbiIsInNlc3Npb25Ub2tlbiIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsIl9nZXRSZXF1ZXN0RGF0YSIsIl94aHJSZXN1bHQiLCJyZXN1bHQiLCJfaXNPcGVuIiwiZGVidWciLCJyZXF1ZXN0TWFuYWdlciIsInNlbmRSZXF1ZXN0Iiwic3luY0V2ZW50IiwiY2FsbGJhY2siLCJjbGFpbVN5bmNFdmVudCIsImlzRm91bmQiLCJkYXRhIiwiaWQiLCJfZ2V0Q3JlYXRlSWQiLCJzdWNjZXNzIiwiX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnMiLCJfeGhyRXJyb3IiLCJfeGhyU3VjY2VzcyIsImVycklkIiwiTUFYX1JFVFJJRVNfQkVGT1JFX0NPUlNfRVJST1IiLCJzdGF0dXMiLCJyZXRyeUNvdW50IiwiTUFYX1JFVFJJRVMiLCJpbmRleE9mIiwibm9uY2UiLCJ3YXJuIiwiZXJyU3RhdGUiLCJfZ2V0RXJyb3JTdGF0ZSIsIl94aHJIYW5kbGVTZXJ2ZXJFcnJvciIsIl94aHJIYW5kbGVTZXJ2ZXJVbmF2YWlsYWJsZUVycm9yIiwiX3hockhhbmRsZUNvbm5lY3Rpb25FcnJvciIsIm1heERlbGF5IiwiTUFYX1VOQVZBSUxBQkxFX1JFVFJZX1dBSVQiLCJkZWxheSIsImdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMiLCJNYXRoIiwibWluIiwiYmluZCIsImxvZ01zZyIsInN0cmluZ2lmeSIsImVycm9yIiwiSlNPTiIsIl9wdXJnZURlcGVuZGVudFJlcXVlc3RzIiwiY2hlY2tPbmxpbmVTdGF0dXMiLCJfeGhyVmFsaWRhdGVJc09ubGluZUNhbGxiYWNrIiwicmVzcG9uc2UiLCJkZWxldGVEQiIsImluZGV4Iiwic3BsaWNlIiwiZGVsZXRlT2JqZWN0cyIsImRlcGVuZHMiLCJkZXN0cm95IiwibG9hZFN5bmNRdWV1ZSIsImNvbmNhdCIsInByb3RvdHlwZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJpbml0Q2xhc3MiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1CQSxJQUFNQSxPQUFPQyxRQUFRLFFBQVIsQ0FBYjs7ZUFDK0JBLFFBQVEsY0FBUixDO0lB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LFNBQVosQ0FBc0JqRCxjQUF0QixHQUF1QyxJQUF2Qzs7QUFFQTs7Ozs7OztBQU9BekQsWUFBWTBHLFNBQVosQ0FBc0JsRyxhQUF0QixHQUFzQyxJQUF0Qzs7QUFFQTs7OztBQUlBUixZQUFZMEcsU0FBWixDQUFzQnBHLEtBQXRCLEdBQThCLElBQTlCOztBQUVBOzs7Ozs7QUFNQU4sWUFBWTBHLFNBQVosQ0FBc0JuRyxZQUF0QixHQUFxQyxJQUFyQzs7QUFFQTs7O0FBR0FQLFlBQVkwRyxTQUFaLENBQXNCeEcsTUFBdEIsR0FBK0IsSUFBL0I7O0FBRUE7Ozs7Ozs7O0FBUUFGLFlBQVlvRiwwQkFBWixHQUF5QyxLQUFLLEVBQTlDOztBQUVBOzs7Ozs7Ozs7Ozs7O0FBYUFwRixZQUFZdUUsNkJBQVosR0FBNEMsQ0FBNUM7O0FBRUE7Ozs7OztBQU1BdkUsWUFBWTBFLFdBQVosR0FBMEIsRUFBMUI7O0FBR0ExRSxZQUFZMkcsZ0JBQVosR0FBK0I7QUFDN0I7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtCQSxZQW5CNkI7O0FBcUI3Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsY0F0QzZCOztBQXdDN0I7Ozs7Ozs7Ozs7Ozs7OztBQWVBLFVBdkQ2Qjs7QUF5RDdCOzs7Ozs7Ozs7OztBQVdBLFlBcEU2QixFQXFFN0JGLE1BckU2QixDQXFFdEJoSCxLQUFLa0gsZ0JBckVpQixDQUEvQjs7QUF1RUFsSCxLQUFLbUgsU0FBTCxDQUFlNUcsV0FBZjtBQUNBNkcsT0FBT0MsT0FBUCxHQUFpQjlHLFdBQWpCIiwiZmlsZSI6InN5bmMtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzICBsYXllci5TeW5jTWFuYWdlclxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQHByb3RlY3RlZFxuICpcbiAqIFRoaXMgY2xhc3MgbWFuYWdlc1xuICpcbiAqIDEuIGEgcXVldWUgb2YgcmVxdWVzdHMgdGhhdCBuZWVkIHRvIGJlIG1hZGVcbiAqIDIuIHdoZW4gYSByZXF1ZXN0IHNob3VsZCBiZSBmaXJlZCwgYmFzZWQgb24gYXV0aGVudGljYXRpb24gc3RhdGUsIG9ubGluZSBzdGF0ZSwgd2Vic29ja2V0IGNvbm5lY3Rpb24gc3RhdGUsIGFuZCBwb3NpdGlvbiBpbiB0aGUgcXVldWVcbiAqIDMuIHdoZW4gYSByZXF1ZXN0IHNob3VsZCBiZSBhYm9ydGVkXG4gKiA0LiB0cmlnZ2VyaW5nIGFueSByZXF1ZXN0IGNhbGxiYWNrc1xuICpcbiAqIFRPRE86IEluIHRoZSBldmVudCBvZiBhIEROUyBlcnJvciwgd2UgbWF5IGhhdmUgYSB2YWxpZCB3ZWJzb2NrZXQgcmVjZWl2aW5nIGV2ZW50cyBhbmQgdGVsbGluZyB1cyB3ZSBhcmUgb25saW5lLFxuICogYW5kIGJlIHVuYWJsZSB0byBjcmVhdGUgYSBSRVNUIGNhbGwuICBUaGlzIHdpbGwgYmUgaGFuZGxlZCB3cm9uZyBiZWNhdXNlIGV2aWRlbmNlIHdpbGwgc3VnZ2VzdCB0aGF0IHdlIGFyZSBvbmxpbmUuXG4gKiBUaGlzIGlzc3VlIGdvZXMgYXdheSB3aGVuIHdlIHVzZSBiaWRpcmVjdGlvbmFsIHdlYnNvY2tldHMgZm9yIGFsbCByZXF1ZXN0cy5cbiAqXG4gKiBBcHBsaWNhdGlvbnMgZG8gbm90IHR5cGljYWxseSBpbnRlcmFjdCB3aXRoIHRoaXMgY2xhc3MsIGJ1dCBtYXkgc3Vic2NyaWJlIHRvIGl0cyBldmVudHNcbiAqIHRvIGdldCByaWNoZXIgZGV0YWlsZWQgaW5mb3JtYXRpb24gdGhhbiBpcyBhdmFpbGFibGUgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50IGluc3RhbmNlLlxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCB7IFdlYnNvY2tldFN5bmNFdmVudCB9ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuY29uc3QgTUFYX1JFQ0VJUFRfQ09OTkVDVElPTlMgPSA0O1xuXG5jbGFzcyBTeW5jTWFuYWdlciBleHRlbmRzIFJvb3Qge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBTeW5jTWFuYWdlci5cbiAgICpcbiAgICogQW4gQXBwbGljYXRpb24gaXMgZXhwZWN0ZWQgdG8gb25seSBoYXZlIG9uZSBTeW5jTWFuYWdlci5cbiAgICpcbiAgICogICAgICB2YXIgc29ja2V0TWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXIoe2NsaWVudDogY2xpZW50fSk7XG4gICAqICAgICAgdmFyIHJlcXVlc3RNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXIoe2NsaWVudDogY2xpZW50LCBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyfSk7XG4gICAqXG4gICAqICAgICAgdmFyIG9ubGluZU1hbmFnZXIgPSBuZXcgbGF5ZXIuT25saW5lTWFuYWdlcih7XG4gICAqICAgICAgICAgIHNvY2tldE1hbmFnZXI6IHNvY2tldE1hbmFnZXJcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogICAgICAvLyBOb3cgd2UgY2FuIGluc3RhbnRpYXRlIHRoaXMgdGhpbmcuLi5cbiAgICogICAgICB2YXIgU3luY01hbmFnZXIgPSBuZXcgbGF5ZXIuU3luY01hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgb25saW5lTWFuYWdlcjogb25saW5lTWFuYWdlcixcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogc29ja2V0TWFuYWdlcixcbiAgICogICAgICAgICAgcmVxdWVzdE1hbmFnZXI6IHJlcXVlc3RNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuT25saW5lU3RhdGVNYW5hZ2VyfSBvcHRpb25zLm9ubGluZU1hbmFnZXJcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlJlcXVlc3RNYW5hZ2VyfSBvcHRpb25zLnJlcXVlc3RNYW5hZ2VyXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBvcHRpb25zLmNsaWVudFxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuY2xpZW50ID0gb3B0aW9ucy5jbGllbnQ7XG5cbiAgICAvLyBOb3RlIHdlIGRvIG5vdCBzdG9yZSBhIHBvaW50ZXIgdG8gY2xpZW50Li4uIGl0IGlzIG5vdCBuZWVkZWQuXG4gICAgaWYgKHRoaXMuY2xpZW50KSB7XG4gICAgICB0aGlzLmNsaWVudC5vbigncmVhZHknLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgICAgICB0aGlzLl9sb2FkUGVyc2lzdGVkUXVldWUoKTtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgdGhpcy5yZWNlaXB0UXVldWUgPSBbXTtcblxuICAgIC8vIFJhdGhlciB0aGFuIGxpc3RlbiBmb3Igb25saW5lTWFuYWdlciAnY29ubmVjdGVkJywgbGV0IHRoZSBzb2NrZXRNYW5hZ2VyIGxpc3RlbiBmb3IgdGhhdCwgY29ubmVjdCwgYW5kIHRoZSBzeW5jTWFuYWdlclxuICAgIC8vIHdhaXRzIHVudGlsIGl0cyBhY3R1YWxseSBjb25uZWN0ZWRcbiAgICB0aGlzLm9ubGluZU1hbmFnZXIub24oJ2Rpc2Nvbm5lY3RlZCcsIHRoaXMuX29ubGluZVN0YXRlQ2hhbmdlLCB0aGlzKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIub24oJ2Nvbm5lY3RlZCBkaXNjb25uZWN0ZWQnLCB0aGlzLl9vbmxpbmVTdGF0ZUNoYW5nZSwgdGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB3aGV0aGVyIHRoZSBDbGllbnQgaXMgb25saW5lL29mZmxpbmUuXG4gICAqXG4gICAqIEZvciBpbnRlcm5hbCB1c2U7IGFwcGxpY2F0aW9ucyBzaG91bGQgdXNlIGxheWVyLkNsaWVudC5pc09ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBpc09ubGluZVxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICovXG4gIGlzT25saW5lKCkge1xuICAgIHJldHVybiB0aGlzLm9ubGluZU1hbmFnZXIuaXNPbmxpbmU7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBzeW5jIHJlcXVlc3Qgd2hlbiBjb25uZWN0aW9uIGlzIHJlc3RvcmVkLlxuICAgKlxuICAgKiBBbnkgdGltZSB3ZSBnbyBiYWNrIG9ubGluZSAoYXMgc2lnbmFsZWQgYnkgdGhlIG9ubGluZVN0YXRlTWFuYWdlciksXG4gICAqIFByb2Nlc3MgdGhlIG5leHQgU3luYyBFdmVudCAod2lsbCBkbyBub3RoaW5nIGlmIG9uZSBpcyBhbHJlYWR5IGZpcmluZylcbiAgICpcbiAgICogQG1ldGhvZCBfb25saW5lU3RhdGVDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBldnROYW1lIC0gJ2Nvbm5lY3RlZCcgb3IgJ2Rpc2Nvbm5lY3RlZCdcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfb25saW5lU3RhdGVDaGFuZ2UoZXZ0KSB7XG4gICAgaWYgKGV2dC5ldmVudE5hbWUgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGgpIHRoaXMucXVldWVbMF0ucmV0dXJuVG9PbmxpbmVDb3VudCsrO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKSwgMTAwKTtcbiAgICB9IGVsc2UgaWYgKGV2dC5ldmVudE5hbWUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5xdWV1ZVswXS5pc0ZpcmluZyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMucmVjZWlwdFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKHN5bmNFdnQgPT4gKHN5bmNFdnQuaXNGaXJpbmcgPSBmYWxzZSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbmV3IHhociByZXF1ZXN0IHRvIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogSWYgdGhlIHF1ZXVlIGlzIGVtcHR5LCB0aGlzIHdpbGwgYmUgZmlyZWQgaW1tZWRpYXRlbHk7IGVsc2UgaXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgcXVldWUgYW5kIHdhaXQgaXRzIHR1cm4uXG4gICAqXG4gICAqIElmIGl0cyBhIHJlYWQvZGVsaXZlcnkgcmVjZWlwdCByZXF1ZXN0LCBpdCB3aWxsIHR5cGljYWxseSBiZSBmaXJlZCBpbW1lZGlhdGVseSB1bmxlc3MgdGhlcmUgYXJlIG1hbnkgcmVjZWlwdFxuICAgKiByZXF1ZXN0cyBhbHJlYWR5IGluLWZsaWdodC5cbiAgICpcbiAgICogQG1ldGhvZCByZXF1ZXN0XG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIEEgU3luY0V2ZW50IHNwZWNpZnlpbmcgdGhlIHJlcXVlc3QgdG8gYmUgbWFkZVxuICAgKi9cbiAgcmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgLy8gSWYgaXRzIGEgUEFUQ0ggcmVxdWVzdCBvbiBhbiBvYmplY3QgdGhhdCBpc24ndCB5ZXQgY3JlYXRlZCxcbiAgICAvLyBkbyBub3QgYWRkIGl0IHRvIHRoZSBxdWV1ZS5cbiAgICBpZiAocmVxdWVzdEV2dC5vcGVyYXRpb24gIT09ICdQQVRDSCcgfHwgIXRoaXMuX2ZpbmRVbmZpcmVkQ3JlYXRlKHJlcXVlc3RFdnQpKSB7XG4gICAgICBsb2dnZXIuaW5mbyhgU3luYyBNYW5hZ2VyIFJlcXVlc3QgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gb24gdGFyZ2V0ICR7cmVxdWVzdEV2dC50YXJnZXR9YCwgcmVxdWVzdEV2dC50b09iamVjdCgpKTtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0Lm9wZXJhdGlvbiA9PT0gJ1JFQ0VJUFQnKSB7XG4gICAgICAgIHRoaXMucmVjZWlwdFF1ZXVlLnB1c2gocmVxdWVzdEV2dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnF1ZXVlLnB1c2gocmVxdWVzdEV2dCk7XG4gICAgICB9XG4gICAgICB0aGlzLnRyaWdnZXIoJ3N5bmM6YWRkJywge1xuICAgICAgICByZXF1ZXN0OiByZXF1ZXN0RXZ0LFxuICAgICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5pbmZvKGBTeW5jIE1hbmFnZXIgUmVxdWVzdCBQQVRDSCAke3JlcXVlc3RFdnQudGFyZ2V0fSByZXF1ZXN0IGlnbm9yZWQ7IGNyZWF0ZSByZXF1ZXN0IHN0aWxsIGVucXVldWVkYCwgcmVxdWVzdEV2dC50b09iamVjdCgpKTtcbiAgICB9XG5cbiAgICAvLyBJZiBpdHMgYSBERUxFVEUgcmVxdWVzdCwgcHVyZ2UgYWxsIG90aGVyIHJlcXVlc3RzIG9uIHRoYXQgdGFyZ2V0LlxuICAgIGlmIChyZXF1ZXN0RXZ0Lm9wZXJhdGlvbiA9PT0gJ0RFTEVURScpIHtcbiAgICAgIHRoaXMuX3B1cmdlT25EZWxldGUocmVxdWVzdEV2dCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KHJlcXVlc3RFdnQpO1xuICB9XG5cbiAgX3Byb2Nlc3NOZXh0UmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgLy8gRmlyZSB0aGUgcmVxdWVzdCBpZiB0aGVyZSBhcmVuJ3QgYW55IGV4aXN0aW5nIHJlcXVlc3RzIGFscmVhZHkgZmlyaW5nXG4gICAgaWYgKHRoaXMucXVldWUubGVuZ3RoICYmICF0aGlzLnF1ZXVlWzBdLmlzRmlyaW5nKSB7XG4gICAgICBpZiAocmVxdWVzdEV2dCkge1xuICAgICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIud3JpdGVTeW5jRXZlbnRzKFtyZXF1ZXN0RXZ0XSwgKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRTdGFuZGFyZFJlcXVlc3QoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIGhhdmUgYW55dGhpbmcgaW4gdGhlIHJlY2VpcHRzIHF1ZXVlLCBmaXJlIGl0XG4gICAgaWYgKHRoaXMucmVjZWlwdFF1ZXVlLmxlbmd0aCkge1xuICAgICAgdGhpcy5fcHJvY2Vzc05leHRSZWNlaXB0UmVxdWVzdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIGNyZWF0ZSByZXF1ZXN0IGZvciB0aGlzIHJlc291cmNlLlxuICAgKlxuICAgKiBEZXRlcm1pbmUgaWYgdGhlIGdpdmVuIHRhcmdldCBoYXMgYSBQT1NUIHJlcXVlc3Qgd2FpdGluZyB0byBjcmVhdGVcbiAgICogdGhlIHJlc291cmNlLCBhbmQgcmV0dXJuIGFueSBtYXRjaGluZyByZXF1ZXN0cy4gVXNlZFxuICAgKiBmb3IgZm9sZGluZyBQQVRDSCByZXF1ZXN0cyBpbnRvIGFuIHVuZmlyZWQgQ1JFQVRFL1BPU1QgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmluZFVuZmlyZWRDcmVhdGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBfZmluZFVuZmlyZWRDcmVhdGUocmVxdWVzdEV2dCkge1xuICAgIHJldHVybiBCb29sZWFuKHRoaXMucXVldWUuZmlsdGVyKGV2dCA9PlxuICAgICAgZXZ0LnRhcmdldCA9PT0gcmVxdWVzdEV2dC50YXJnZXQgJiYgZXZ0Lm9wZXJhdGlvbiA9PT0gJ1BPU1QnICYmICFldnQuaXNGaXJpbmcpLmxlbmd0aFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgbmV4dCByZXF1ZXN0IGluIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogUmVxdWVzdCBpcyBkZXF1ZXVlZCBvbiBjb21wbGV0aW5nIHRoZSBwcm9jZXNzLlxuICAgKiBJZiB0aGUgZmlyc3QgcmVxdWVzdCBpbiB0aGUgcXVldWUgaXMgZmlyaW5nLCBkbyBub3RoaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcm9jZXNzTmV4dFJlcXVlc3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCB8fCAhdGhpcy5jbGllbnQuaXNBdXRoZW50aWNhdGVkKSByZXR1cm47XG4gICAgY29uc3QgcmVxdWVzdEV2dCA9IHRoaXMucXVldWVbMF07XG4gICAgaWYgKHRoaXMuaXNPbmxpbmUoKSAmJiByZXF1ZXN0RXZ0ICYmICFyZXF1ZXN0RXZ0LmlzRmlyaW5nICYmICFyZXF1ZXN0RXZ0Ll9pc1ZhbGlkYXRpbmcpIHtcbiAgICAgIHJlcXVlc3RFdnQuX2lzVmFsaWRhdGluZyA9IHRydWU7XG4gICAgICB0aGlzLl92YWxpZGF0ZVJlcXVlc3QocmVxdWVzdEV2dCwgKGlzVmFsaWQpID0+IHtcbiAgICAgICAgcmVxdWVzdEV2dC5faXNWYWxpZGF0aW5nID0gZmFsc2U7XG4gICAgICAgIGlmICghaXNWYWxpZCkge1xuICAgICAgICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVxdWVzdEV2dCwgZmFsc2UpO1xuICAgICAgICAgIHJldHVybiB0aGlzLl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0KHJlcXVlc3RFdnQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB1cCB0byBNQVhfUkVDRUlQVF9DT05ORUNUSU9OUyB3b3J0aCBvZiByZWNlaXB0cy5cbiAgICpcbiAgICogVGhlc2UgcmVxdWVzdHMgaGF2ZSBubyBpbnRlcmRlcGVuZGVuY2llcy4gSnVzdCBmaXJlIHRoZW0gYWxsXG4gICAqIGFzIGZhc3QgYXMgd2UgY2FuLCBpbiBwYXJhbGxlbC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc05leHRSZWNlaXB0UmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Byb2Nlc3NOZXh0UmVjZWlwdFJlcXVlc3QoKSB7XG4gICAgbGV0IGZpcmluZ1JlY2VpcHRzID0gMDtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKChyZWNlaXB0RXZ0KSA9PiB7XG4gICAgICBpZiAodGhpcy5pc09ubGluZSgpICYmIHJlY2VpcHRFdnQpIHtcbiAgICAgICAgaWYgKHJlY2VpcHRFdnQuaXNGaXJpbmcgfHwgcmVjZWlwdEV2dC5faXNWYWxpZGF0aW5nKSB7XG4gICAgICAgICAgZmlyaW5nUmVjZWlwdHMrKztcbiAgICAgICAgfSBlbHNlIGlmIChmaXJpbmdSZWNlaXB0cyA8IE1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TKSB7XG4gICAgICAgICAgZmlyaW5nUmVjZWlwdHMrKztcbiAgICAgICAgICB0aGlzLl9maXJlUmVxdWVzdChyZWNlaXB0RXZ0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERpcmVjdGx5IGZpcmUgdGhpcyBzeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIFRoaXMgaXMgaW50ZW5kZWQgdG8gYmUgY2FsbGVkIG9ubHkgYWZ0ZXIgY2FyZWZ1bCBhbmFseXNpcyBvZiBvdXIgc3RhdGUgdG8gbWFrZSBzdXJlIGl0cyBzYWZlIHRvIHNlbmQgdGhlIHJlcXVlc3QuXG4gICAqIFNlZSBgX3Byb2Nlc3NOZXh0UmVxdWVzdCgpYFxuICAgKlxuICAgKiBAbWV0aG9kIF9maXJlUmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0KHJlcXVlc3RFdnQpIHtcbiAgICBpZiAocmVxdWVzdEV2dCBpbnN0YW5jZW9mIFdlYnNvY2tldFN5bmNFdmVudCkge1xuICAgICAgdGhpcy5fZmlyZVJlcXVlc3RXZWJzb2NrZXQocmVxdWVzdEV2dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0WEhSKHJlcXVlc3RFdnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgWEhSIFN5bmMgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RYSFJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnQuWEhSU3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqL1xuICBfZmlyZVJlcXVlc3RYSFIocmVxdWVzdEV2dCkge1xuICAgIHJlcXVlc3RFdnQuaXNGaXJpbmcgPSB0cnVlO1xuICAgIGlmICghcmVxdWVzdEV2dC5oZWFkZXJzKSByZXF1ZXN0RXZ0LmhlYWRlcnMgPSB7fTtcbiAgICByZXF1ZXN0RXZ0LmhlYWRlcnMuYXV0aG9yaXphdGlvbiA9ICdMYXllciBzZXNzaW9uLXRva2VuPVwiJyArIHRoaXMuY2xpZW50LnNlc3Npb25Ub2tlbiArICdcIic7XG4gICAgbG9nZ2VyLmluZm8oYFN5bmMgTWFuYWdlciBYSFIgUmVxdWVzdCBGaXJpbmcgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gJHtyZXF1ZXN0RXZ0LnRhcmdldH0gYXQgJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9YCxcbiAgICAgIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgeGhyKHJlcXVlc3RFdnQuX2dldFJlcXVlc3REYXRhKHRoaXMuY2xpZW50KSwgcmVzdWx0ID0+IHRoaXMuX3hoclJlc3VsdChyZXN1bHQsIHJlcXVlc3RFdnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgV2Vic29ja2V0IFN5bmMgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RXZWJzb2NrZXRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnQuV2Vic29ja2V0U3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqL1xuICBfZmlyZVJlcXVlc3RXZWJzb2NrZXQocmVxdWVzdEV2dCkge1xuICAgIGlmICh0aGlzLnNvY2tldE1hbmFnZXIgJiYgdGhpcy5zb2NrZXRNYW5hZ2VyLl9pc09wZW4oKSkge1xuICAgICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgV2Vic29ja2V0IFJlcXVlc3QgRmlyaW5nICR7cmVxdWVzdEV2dC5vcGVyYXRpb259IG9uIHRhcmdldCAke3JlcXVlc3RFdnQudGFyZ2V0fWAsXG4gICAgICAgIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3QocmVxdWVzdEV2dC5fZ2V0UmVxdWVzdERhdGEodGhpcy5jbGllbnQpLFxuICAgICAgICAgIHJlc3VsdCA9PiB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCByZXF1ZXN0RXZ0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnU3luYyBNYW5hZ2VyIFdlYnNvY2tldCBSZXF1ZXN0IHNraXBwZWQ7IHNvY2tldCBjbG9zZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIHN5bmNFdmVudCBzdGlsbCB2YWxpZD9cbiAgICpcbiAgICogVGhpcyBtZXRob2Qgc3BlY2lmaWNhbGx5IHRlc3RzIHRvIHNlZSBpZiBzb21lIG90aGVyIHRhYiBoYXMgYWxyZWFkeSBzZW50IHRoaXMgcmVxdWVzdC5cbiAgICogSWYgcGVyc2lzdGVuY2Ugb2YgdGhlIHN5bmNRdWV1ZSBpcyBub3QgZW5hYmxlZCwgdGhlbiB0aGUgY2FsbGJhY2sgaXMgaW1tZWRpYXRlbHkgY2FsbGVkIHdpdGggdHJ1ZS5cbiAgICogSWYgYW5vdGhlciB0YWIgaGFzIGFscmVhZHkgc2VudCB0aGUgcmVxdWVzdCwgdGhlbiB0aGUgZW50cnkgd2lsbCBubyBsb25nZXIgYmUgaW4gaW5kZXhlZERCIGFuZCB0aGUgY2FsbGJhY2tcbiAgICogd2lsbCBjYWxsIGZhbHNlLlxuICAgKlxuICAgKiBAbWV0aG9kIF92YWxpZGF0ZVJlcXVlc3RcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHN5bmNFdmVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjay5pc1ZhbGlkIC0gVGhlIHJlcXVlc3QgaXMgc3RpbGwgdmFsaWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF92YWxpZGF0ZVJlcXVlc3Qoc3luY0V2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5jbGFpbVN5bmNFdmVudChzeW5jRXZlbnQsIGlzRm91bmQgPT4gY2FsbGJhY2soaXNGb3VuZCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFR1cm4gZGVkdXBsaWNhdGlvbiBlcnJvcnMgaW50byBzdWNjZXNzIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBJZiB0aGlzIHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBtYWRlIGJ1dCB3ZSBmYWlsZWQgdG8gZ2V0IGEgcmVzcG9uc2UgdGhlIGZpcnN0IHRpbWUgYW5kIHdlIHJldHJpZWQgdGhlIHJlcXVlc3QsXG4gICAqIHdlIHdpbGwgcmVpc3N1ZSB0aGUgcmVxdWVzdC4gIElmIHRoZSBwcmlvciByZXF1ZXN0IHdhcyBzdWNjZXNzZnVsIHdlJ2xsIGdldCBiYWNrIGEgZGVkdXBsaWNhdGlvbiBlcnJvclxuICAgKiB3aXRoIHRoZSBjcmVhdGVkIG9iamVjdC4gQXMgZmFyIGFzIHRoZSBXZWJTREsgaXMgY29uY2VybmVkLCB0aGlzIGlzIGEgc3VjY2Vzcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlRGVkdXBsaWNhdGlvbkVycm9yc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnMocmVzdWx0KSB7XG4gICAgaWYgKHJlc3VsdC5kYXRhICYmIHJlc3VsdC5kYXRhLmlkID09PSAnaWRfaW5fdXNlJyAmJlxuICAgICAgICByZXN1bHQuZGF0YS5kYXRhICYmIHJlc3VsdC5kYXRhLmRhdGEuaWQgPT09IHJlc3VsdC5yZXF1ZXN0Ll9nZXRDcmVhdGVJZCgpKSB7XG4gICAgICByZXN1bHQuc3VjY2VzcyA9IHRydWU7XG4gICAgICByZXN1bHQuZGF0YSA9IHJlc3VsdC5kYXRhLmRhdGE7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIHJlc3VsdCBvZiBhbiB4aHIgY2FsbCwgcm91dGluZyBpdCB0byB0aGUgYXBwcm9wcmlhdGUgaGFuZGxlci5cbiAgICpcbiAgICogQG1ldGhvZCBfeGhyUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgX3hoclJlc3VsdChyZXN1bHQsIHJlcXVlc3RFdnQpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIHJlc3VsdC5yZXF1ZXN0ID0gcmVxdWVzdEV2dDtcbiAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gZmFsc2U7XG4gICAgdGhpcy5faGFuZGxlRGVkdXBsaWNhdGlvbkVycm9ycyhyZXN1bHQpO1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX3hockVycm9yKHJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3hoclN1Y2Nlc3MocmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2F0ZWdvcml6ZSB0aGUgZXJyb3IgZm9yIGhhbmRsaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRFcnJvclN0YXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKiBAcGFyYW0gIHtib29sZWFufSBpc09ubGluZSAtIElzIG91ciBhcHAgc3RhdGUgc2V0IHRvIG9ubGluZVxuICAgKiBAcmV0dXJucyB7U3RyaW5nfVxuICAgKi9cbiAgX2dldEVycm9yU3RhdGUocmVzdWx0LCByZXF1ZXN0RXZ0LCBpc09ubGluZSkge1xuICAgIGNvbnN0IGVycklkID0gcmVzdWx0LmRhdGEgPyByZXN1bHQuZGF0YS5pZCA6ICcnO1xuICAgIGlmICghaXNPbmxpbmUpIHtcbiAgICAgIC8vIENPUlMgZXJyb3JzIGxvb2sgaWRlbnRpY2FsIHRvIG9mZmxpbmU7IGJ1dCBpZiBvdXIgb25saW5lIHN0YXRlIGhhcyB0cmFuc2l0aW9uZWQgZnJvbSBmYWxzZSB0byB0cnVlIHJlcGVhdGVkbHkgd2hpbGUgcHJvY2Vzc2luZyB0aGlzIHJlcXVlc3QsXG4gICAgICAvLyB0aGF0cyBhIGhpbnQgdGhhdCB0aGF0IGl0cyBhIENPUlMgZXJyb3JcbiAgICAgIGlmIChyZXF1ZXN0RXZ0LnJldHVyblRvT25saW5lQ291bnQgPj0gU3luY01hbmFnZXIuTUFYX1JFVFJJRVNfQkVGT1JFX0NPUlNfRVJST1IpIHtcbiAgICAgICAgcmV0dXJuICdDT1JTJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnb2ZmbGluZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlcnJJZCA9PT0gJ25vdF9mb3VuZCcpIHtcbiAgICAgIHJldHVybiAnbm90Rm91bmQnO1xuICAgIH0gZWxzZSBpZiAoZXJySWQgPT09ICdpZF9pbl91c2UnKSB7XG4gICAgICByZXR1cm4gJ2ludmFsaWRJZCc7IC8vIFRoaXMgb25seSBmaXJlcyBpZiB3ZSBnZXQgYGlkX2luX3VzZWAgYnV0IG5vIFJlc291cmNlLCB3aGljaCBtZWFucyB0aGUgVVVJRCB3YXMgdXNlZCBieSBhbm90aGVyIHVzZXIvYXBwLlxuICAgIH0gZWxzZSBpZiAocmVzdWx0LnN0YXR1cyA9PT0gNDA4IHx8IGVycklkID09PSAncmVxdWVzdF90aW1lb3V0Jykge1xuICAgICAgaWYgKHJlcXVlc3RFdnQucmV0cnlDb3VudCA+PSBTeW5jTWFuYWdlci5NQVhfUkVUUklFUykge1xuICAgICAgICByZXR1cm4gJ3Rvb01hbnlGYWlsdXJlc1doaWxlT25saW5lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAndmFsaWRhdGVPbmxpbmVBbmRSZXRyeSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChbNTAyLCA1MDMsIDUwNF0uaW5kZXhPZihyZXN1bHQuc3RhdHVzKSAhPT0gLTEpIHtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0LnJldHJ5Q291bnQgPj0gU3luY01hbmFnZXIuTUFYX1JFVFJJRVMpIHtcbiAgICAgICAgcmV0dXJuICd0b29NYW55RmFpbHVyZXNXaGlsZU9ubGluZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NlcnZlclVuYXZhaWxhYmxlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVycklkID09PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnICYmIHJlc3VsdC5kYXRhLmRhdGEgJiYgcmVzdWx0LmRhdGEuZGF0YS5ub25jZSkge1xuICAgICAgcmV0dXJuICdyZWF1dGhvcml6ZSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnc2VydmVyUmVqZWN0ZWRSZXF1ZXN0JztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGZhaWxlZCByZXF1ZXN0cy5cbiAgICpcbiAgICogMS4gSWYgdGhlcmUgd2FzIGFuIGVycm9yIGZyb20gdGhlIHNlcnZlciwgdGhlbiB0aGUgcmVxdWVzdCBoYXMgcHJvYmxlbXNcbiAgICogMi4gSWYgd2UgZGV0ZXJtaW5lIHdlIGFyZSBub3QgaW4gZmFjdCBvbmxpbmUsIGNhbGwgdGhlIGNvbm5lY3Rpb25FcnJvciBoYW5kbGVyXG4gICAqIDMuIElmIHdlIHRoaW5rIHdlIGFyZSBvbmxpbmUsIHZlcmlmeSB3ZSBhcmUgb25saW5lIGFuZCB0aGVuIGRldGVybWluZSBob3cgdG8gaGFuZGxlIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gUmVxdWVzdCBvYmplY3RcbiAgICovXG4gIF94aHJFcnJvcihyZXN1bHQpIHtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gcmVzdWx0LnJlcXVlc3Q7XG5cbiAgICBsb2dnZXIud2FybihgU3luYyBNYW5hZ2VyICR7cmVxdWVzdEV2dCBpbnN0YW5jZW9mIFdlYnNvY2tldFN5bmNFdmVudCA/ICdXZWJzb2NrZXQnIDogJ1hIUid9IGAgK1xuICAgICAgYCR7cmVxdWVzdEV2dC5vcGVyYXRpb259IFJlcXVlc3Qgb24gdGFyZ2V0ICR7cmVxdWVzdEV2dC50YXJnZXR9IGhhcyBGYWlsZWRgLCByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuXG5cbiAgICBjb25zdCBlcnJTdGF0ZSA9IHRoaXMuX2dldEVycm9yU3RhdGUocmVzdWx0LCByZXF1ZXN0RXZ0LCB0aGlzLmlzT25saW5lKCkpO1xuICAgIGxvZ2dlci53YXJuKCdTeW5jIE1hbmFnZXIgRXJyb3IgU3RhdGU6ICcgKyBlcnJTdGF0ZSk7XG4gICAgc3dpdGNoIChlcnJTdGF0ZSkge1xuICAgICAgY2FzZSAndG9vTWFueUZhaWx1cmVzV2hpbGVPbmxpbmUnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdTeW5jIE1hbmFnZXIgU2VydmVyIFVuYXZhaWxhYmxlIFRvbyBMb25nOyByZW1vdmluZyByZXF1ZXN0JywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ25vdEZvdW5kJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCAnUmVzb3VyY2Ugbm90IGZvdW5kOyBwcmVzdW1hYmx5IGRlbGV0ZWQnLCBmYWxzZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnaW52YWxpZElkJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCAnSUQgd2FzIG5vdCB1bmlxdWU7IHJlcXVlc3QgZmFpbGVkJywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3ZhbGlkYXRlT25saW5lQW5kUmV0cnknOlxuICAgICAgICAvLyBTZXJ2ZXIgYXBwZWFycyB0byBiZSBodW5nIGJ1dCB3aWxsIGV2ZW50dWFsbHkgcmVjb3Zlci5cbiAgICAgICAgLy8gUmV0cnkgYSBmZXcgdGltZXMgYW5kIHRoZW4gZXJyb3Igb3V0LlxuICAgICAgICAvLyB0aGlzLl94aHJWYWxpZGF0ZUlzT25saW5lKHJlcXVlc3RFdnQpO1xuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJVbmF2YWlsYWJsZUVycm9yKHJlcXVlc3RFdnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NlcnZlclVuYXZhaWxhYmxlJzpcbiAgICAgICAgLy8gU2VydmVyIGlzIGluIGEgYmFkIHN0YXRlIGJ1dCB3aWxsIGV2ZW50dWFsbHkgcmVjb3ZlcjtcbiAgICAgICAgLy8ga2VlcCByZXRyeWluZy5cbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyVW5hdmFpbGFibGVFcnJvcihyZXF1ZXN0RXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZWF1dGhvcml6ZSc6XG4gICAgICAgIC8vIHNlc3Npb25Ub2tlbiBhcHBlYXJzIHRvIG5vIGxvbmdlciBiZSB2YWxpZDsgZm9yd2FyZCByZXNwb25zZVxuICAgICAgICAvLyBvbiB0byBjbGllbnQtYXV0aGVudGljYXRvciB0byBwcm9jZXNzLlxuICAgICAgICAvLyBEbyBub3QgcmV0cnkgbm9yIGFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0LlxuICAgICAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2VydmVyUmVqZWN0ZWRSZXF1ZXN0JzpcbiAgICAgICAgLy8gU2VydmVyIHByZXN1bWFibHkgZGlkIG5vdCBsaWtlIHRoZSBhcmd1bWVudHMgdG8gdGhpcyBjYWxsXG4gICAgICAgIC8vIG9yIHRoZSB1cmwgd2FzIGludmFsaWQuICBEbyBub3QgcmV0cnk7IHRyaWdnZXIgdGhlIGNhbGxiYWNrXG4gICAgICAgIC8vIGFuZCBsZXQgdGhlIGNhbGxlciBoYW5kbGUgaXQuXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgUmVqZWN0cyBSZXF1ZXN0OyByZW1vdmluZyByZXF1ZXN0JywgdHJ1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnQ09SUyc6XG4gICAgICAgIC8vIEEgcGF0dGVybiBvZiBvZmZsaW5lLWxpa2UgZmFpbHVyZXMgdGhhdCBzdWdnZXN0cyBpdHMgYWN0dWFsbHkgYSBDT1JzIGVycm9yXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgZGV0ZWN0cyBDT1JTLWxpa2UgZXJyb3JzOyByZW1vdmluZyByZXF1ZXN0JywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ29mZmxpbmUnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gV3JpdGUgdGhlIHN5bmMgZXZlbnQgYmFjayB0byB0aGUgZGF0YWJhc2UgaWYgd2UgaGF2ZW4ndCBjb21wbGV0ZWQgcHJvY2Vzc2luZyBpdFxuICAgIGlmICh0aGlzLnF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xIHx8IHRoaXMucmVjZWlwdFF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xKSB7XG4gICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIud3JpdGVTeW5jRXZlbnRzKFtyZXF1ZXN0RXZ0XSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIHNlcnZlciB1bmF2YWlsYWJsZSBlcnJvci5cbiAgICpcbiAgICogSW4gdGhlIGV2ZW50IG9mIGEgNTAyIChCYWQgR2F0ZXdheSksIDUwMyAoc2VydmljZSB1bmF2YWlsYWJsZSlcbiAgICogb3IgNTA0IChnYXRld2F5IHRpbWVvdXQpIGVycm9yIGZyb20gdGhlIHNlcnZlclxuICAgKiBhc3N1bWUgd2UgaGF2ZSBhbiBlcnJvciB0aGF0IGlzIHNlbGYgY29ycmVjdGluZyBvbiB0aGUgc2VydmVyLlxuICAgKiBVc2UgZXhwb25lbnRpYWwgYmFja29mZiB0byByZXRyeSB0aGUgcmVxdWVzdC5cbiAgICpcbiAgICogTm90ZSB0aGF0IGVhY2ggY2FsbCB3aWxsIGluY3JlbWVudCByZXRyeUNvdW50OyB0aGVyZSBpcyBhIG1heGltdW1cbiAgICogb2YgTUFYX1JFVFJJRVMgYmVmb3JlIGl0IGlzIHRyZWF0ZWQgYXMgYW4gZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCAgX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RcbiAgICovXG4gIF94aHJIYW5kbGVTZXJ2ZXJVbmF2YWlsYWJsZUVycm9yKHJlcXVlc3QpIHtcbiAgICBjb25zdCBtYXhEZWxheSA9IFN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUO1xuICAgIGNvbnN0IGRlbGF5ID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyhtYXhEZWxheSwgTWF0aC5taW4oMTUsIHJlcXVlc3QucmV0cnlDb3VudCsrKSk7XG4gICAgbG9nZ2VyLndhcm4oYFN5bmMgTWFuYWdlciBTZXJ2ZXIgVW5hdmFpbGFibGU7IHJldHJ5IGNvdW50ICR7cmVxdWVzdC5yZXRyeUNvdW50fTsgcmV0cnlpbmcgaW4gJHtkZWxheX0gc2Vjb25kc2ApO1xuICAgIHNldFRpbWVvdXQodGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0LmJpbmQodGhpcyksIGRlbGF5ICogMTAwMCk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgc2VydmVyIGVycm9yIGluIHJlc3BvbnNlIHRvIGZpcmluZyBzeW5jIGV2ZW50LlxuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBhIHNlcnZlciBlcnJvciwgaXRzIHByZXN1bWFibHkgbm9uLXJlY292ZXJhYmxlL25vbi1yZXRyeWFibGUgZXJyb3IsIHNvXG4gICAqIHdlJ3JlIGdvaW5nIHRvIGFib3J0IHRoaXMgcmVxdWVzdC5cbiAgICpcbiAgICogMS4gSWYgYSBjYWxsYmFjayB3YXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgKiAyLiBJZiBhIHJvbGxiYWNrIGNhbGwgaXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gdW5kbyBhbnkgcGF0Y2gvZGVsZXRlL2V0Yy4uLiBjaGFuZ2VzXG4gICAqIDMuIElmIHRoZSByZXF1ZXN0IHdhcyB0byBjcmVhdGUgYSByZXNvdXJjZSwgcmVtb3ZlIGZyb20gdGhlIHF1ZXVlIGFsbCByZXF1ZXN0c1xuICAgKiAgICB0aGF0IGRlcGVuZGVkIHVwb24gdGhhdCByZXNvdXJjZS5cbiAgICogNC4gQWR2YW5jZSB0byBuZXh0IHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfeGhySGFuZGxlU2VydmVyRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbG9nTXNnIC0gTWVzc2FnZSB0byBkaXNwbGF5IGluIGNvbnNvbGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gc3RyaW5naWZ5IC0gbG9nIG9iamVjdCBmb3IgcXVpY2sgZGVidWdnaW5nXG4gICAqXG4gICAqL1xuICBfeGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCBsb2dNc2csIHN0cmluZ2lmeSkge1xuICAgIC8vIEV4ZWN1dGUgYWxsIGNhbGxiYWNrcyBwcm92aWRlZCBieSB0aGUgcmVxdWVzdFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5jYWxsYmFjaykgcmVzdWx0LnJlcXVlc3QuY2FsbGJhY2socmVzdWx0KTtcbiAgICBpZiAoc3RyaW5naWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IobG9nTXNnICtcbiAgICAgICAgJ1xcblJFUVVFU1Q6ICcgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQucmVxdWVzdC50b09iamVjdCgpLCBudWxsLCA0KSArXG4gICAgICAgICdcXG5SRVNQT05TRTogJyArIEpTT04uc3RyaW5naWZ5KHJlc3VsdC5kYXRhLCBudWxsLCA0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihsb2dNc2csIHJlc3VsdCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignc3luYzplcnJvcicsIHtcbiAgICAgIHRhcmdldDogcmVzdWx0LnJlcXVlc3QudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVzdWx0LnJlcXVlc3QsXG4gICAgICBlcnJvcjogcmVzdWx0LmRhdGEsXG4gICAgfSk7XG5cbiAgICByZXN1bHQucmVxdWVzdC5zdWNjZXNzID0gZmFsc2U7XG5cbiAgICAvLyBJZiBhIFBPU1QgcmVxdWVzdCBmYWlscywgYWxsIHJlcXVlc3RzIHRoYXQgZGVwZW5kIHVwb24gdGhpcyBvYmplY3RcbiAgICAvLyBtdXN0IGJlIHB1cmdlZFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5vcGVyYXRpb24gPT09ICdQT1NUJykge1xuICAgICAgdGhpcy5fcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0cyhyZXN1bHQucmVxdWVzdCk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHRoaXMgcmVxdWVzdCBhcyB3ZWxsIChzaWRlLWVmZmVjdDogcm9sbHMgYmFjayB0aGUgb3BlcmF0aW9uKVxuICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVzdWx0LnJlcXVlc3QsIHRydWUpO1xuXG4gICAgLy8gQW5kIGZpbmFsbHksIHdlIGFyZSByZWFkeSB0byB0cnkgdGhlIG5leHQgcmVxdWVzdFxuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiBlcnJvciwgd2FpdCBmb3IgcmV0cnkuXG4gICAqXG4gICAqIEluIHRoZSBldmVudCBvZiB3aGF0IGFwcGVhcnMgdG8gYmUgYSBjb25uZWN0aW9uIGVycm9yLFxuICAgKiBXYWl0IHVudGlsIGEgJ2Nvbm5lY3RlZCcgZXZlbnQgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIG5leHQgcmVxdWVzdCAoYWN0dWFsbHkgcmVwcm9jZXNzaW5nIHRoZSBjdXJyZW50IGV2ZW50KVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKSB7XG4gICAgLy8gTm90aGluZyB0byBiZSBkb25lOyB3ZSBhbHJlYWR5IGhhdmUgdGhlIGJlbG93IGV2ZW50IGhhbmRsZXIgc2V0dXBcbiAgICAvLyB0aGlzLm9ubGluZU1hbmFnZXIub25jZSgnY29ubmVjdGVkJywgKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmeSB0aGF0IHdlIGFyZSBvbmxpbmUgYW5kIHJldHJ5IHJlcXVlc3QuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGNhbGxlZCB3aGVuIHdlIHRoaW5rIHdlJ3JlIG9ubGluZSwgYnV0XG4gICAqIGhhdmUgZGV0ZXJtaW5lZCB3ZSBuZWVkIHRvIHZhbGlkYXRlIHRoYXQgYXNzdW1wdGlvbi5cbiAgICpcbiAgICogVGVzdCB0aGF0IHdlIGhhdmUgYSBjb25uZWN0aW9uOyBpZiB3ZSBkbyxcbiAgICogcmV0cnkgdGhlIHJlcXVlc3Qgb25jZSwgYW5kIGlmIGl0IGZhaWxzIGFnYWluLFxuICAgKiBfeGhyRXJyb3IoKSB3aWxsIGRldGVybWluZSBpdCB0byBoYXZlIGZhaWxlZCBhbmQgcmVtb3ZlIGl0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgdGhlbiBsZXQgX3hockhhbmRsZUNvbm5lY3Rpb25FcnJvciBoYW5kbGUgaXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJWYWxpZGF0ZUlzT25saW5lKHJlcXVlc3RFdnQpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1N5bmMgTWFuYWdlciB2ZXJpZnlpbmcgb25saW5lIHN0YXRlJyk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLmNoZWNrT25saW5lU3RhdHVzKGlzT25saW5lID0+IHRoaXMuX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHdlIGhhdmUgdmVyaWZpZWQgd2UgYXJlIG9ubGluZSwgcmV0cnkgcmVxdWVzdC5cbiAgICpcbiAgICogV2Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSByZXNwb25zZSB0byBvdXIgL25vbmNlcyBjYWxsXG4gICAqIHdoaWNoIGFzc3VtaW5nIHRoZSBzZXJ2ZXIgaXMgYWN0dWFsbHkgYWxpdmUsXG4gICAqIHdpbGwgdGVsbCB1cyBpZiB0aGUgY29ubmVjdGlvbiBpcyB3b3JraW5nLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgZmxhZyB1cyBhcyBvZmZsaW5lIGFuZCBsZXQgdGhlIENvbm5lY3Rpb25FcnJvciBoYW5kbGVyIGhhbmRsZSB0aGlzXG4gICAqIElmIHdlIGFyZSBvbmxpbmUsIGdpdmUgdGhlIHJlcXVlc3QgYSBzaW5nbGUgcmV0cnkgKHRoZXJlIGlzIG5ldmVyIG1vcmUgdGhhbiBvbmUgcmV0cnkpXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFja1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtib29sZWFufSBpc09ubGluZSAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBUaGUgcmVxdWVzdCB0aGF0IGZhaWxlZCB0cmlnZ2VyaW5nIHRoaXMgY2FsbFxuICAgKi9cbiAgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnU3luYyBNYW5hZ2VyIG9ubGluZSBjaGVjayByZXN1bHQgaXMgJyArIGlzT25saW5lKTtcbiAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAvLyBUcmVhdCB0aGlzIGFzIGEgQ29ubmVjdGlvbiBFcnJvclxuICAgICAgdGhpcy5feGhySGFuZGxlQ29ubmVjdGlvbkVycm9yKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJldHJ5IHRoZSByZXF1ZXN0IGluIGNhc2Ugd2Ugd2VyZSBvZmZsaW5lLCBidXQgYXJlIG5vdyBvbmxpbmUuXG4gICAgICAvLyBPZiBjb3Vyc2UsIGlmIHRoaXMgZmFpbHMsIGdpdmUgaXQgdXAgZW50aXJlbHkuXG4gICAgICByZXF1ZXN0RXZ0LnJldHJ5Q291bnQrKztcbiAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgWEhSIHJlcXVlc3Qgd2FzIHN1Y2Nlc3NmdWwuXG4gICAqXG4gICAqIEFueSB4aHIgcmVxdWVzdCB0aGF0IGFjdHVhbGx5IHN1Y2NlZGVzOlxuICAgKlxuICAgKiAxLiBSZW1vdmUgaXQgZnJvbSB0aGUgcXVldWVcbiAgICogMi4gQ2FsbCBhbnkgY2FsbGJhY2tzXG4gICAqIDMuIEFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hoclN1Y2Nlc3NcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICBfeGhyU3VjY2VzcyhyZXN1bHQpIHtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gcmVzdWx0LnJlcXVlc3Q7XG4gICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgJHtyZXF1ZXN0RXZ0IGluc3RhbmNlb2YgV2Vic29ja2V0U3luY0V2ZW50ID8gJ1dlYnNvY2tldCcgOiAnWEhSJ30gYCArXG4gICAgICBgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gUmVxdWVzdCBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH0gaGFzIFN1Y2NlZWRlZGAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgaWYgKHJlc3VsdC5kYXRhKSBsb2dnZXIuZGVidWcocmVzdWx0LmRhdGEpO1xuICAgIHJlcXVlc3RFdnQuc3VjY2VzcyA9IHRydWU7XG4gICAgdGhpcy5fcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCB0cnVlKTtcbiAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdzeW5jOnN1Y2Nlc3MnLCB7XG4gICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVxdWVzdEV2dCxcbiAgICAgIHJlc3BvbnNlOiByZXN1bHQuZGF0YSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIFN5bmNFdmVudCByZXF1ZXN0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVSZXF1ZXN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFN5bmNFdmVudCBSZXF1ZXN0IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGRlbGV0ZURCIC0gRGVsZXRlIGZyb20gaW5kZXhlZERCXG4gICAqL1xuICBfcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCBkZWxldGVEQikge1xuICAgIGNvbnN0IHF1ZXVlID0gcmVxdWVzdEV2dC5vcGVyYXRpb24gPT09ICdSRUNFSVBUJyA/IHRoaXMucmVjZWlwdFF1ZXVlIDogdGhpcy5xdWV1ZTtcbiAgICBjb25zdCBpbmRleCA9IHF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkgcXVldWUuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBpZiAoZGVsZXRlREIpIHRoaXMuY2xpZW50LmRiTWFuYWdlci5kZWxldGVPYmplY3RzKCdzeW5jUXVldWUnLCBbcmVxdWVzdEV2dF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSByZXF1ZXN0cyBmcm9tIHF1ZXVlIHRoYXQgZGVwZW5kIG9uIHNwZWNpZmllZCByZXNvdXJjZS5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYSBQT1NUIHJlcXVlc3QgdG8gY3JlYXRlIGEgbmV3IHJlc291cmNlLCBhbmQgdGhlcmUgYXJlIFBBVENILCBERUxFVEUsIGV0Yy4uLlxuICAgKiByZXF1ZXN0cyBvbiB0aGF0IHJlc291cmNlLCBpZiB0aGUgUE9TVCByZXF1ZXN0IGZhaWxzLCB0aGVuIGFsbCBQQVRDSCwgREVMRVRFLCBldGNcbiAgICogcmVxdWVzdHMgbXVzdCBiZSByZW1vdmVkIGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgd2UgZG8gbm90IGNhbGwgdGhlIHJvbGxiYWNrIG9uIHRoZXNlIGRlcGVuZGVudCByZXF1ZXN0cyBiZWNhdXNlIHRoZSBleHBlY3RlZFxuICAgKiByb2xsYmFjayBpcyB0byBkZXN0cm95IHRoZSB0aGluZyB0aGF0IHdhcyBjcmVhdGVkLCB3aGljaCBtZWFucyBhbnkgb3RoZXIgcm9sbGJhY2sgaGFzIG5vIGVmZmVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3QgLSBSZXF1ZXN0IHdob3NlIHRhcmdldCBpcyBubyBsb25nZXIgdmFsaWRcbiAgICovXG4gIF9wdXJnZURlcGVuZGVudFJlcXVlc3RzKHJlcXVlc3QpIHtcbiAgICB0aGlzLnF1ZXVlID0gdGhpcy5xdWV1ZS5maWx0ZXIoZXZ0ID0+IGV2dC5kZXBlbmRzLmluZGV4T2YocmVxdWVzdC50YXJnZXQpID09PSAtMSB8fCBldnQgPT09IHJlcXVlc3QpO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gdGhpcy5yZWNlaXB0UXVldWUuZmlsdGVyKGV2dCA9PiBldnQuZGVwZW5kcy5pbmRleE9mKHJlcXVlc3QudGFyZ2V0KSA9PT0gLTEgfHwgZXZ0ID09PSByZXF1ZXN0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBmcm9tIHF1ZXVlIGFsbCBldmVudHMgdGhhdCBvcGVyYXRlIHVwb24gdGhlIGRlbGV0ZWQgb2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wdXJnZU9uRGVsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gRGVsZXRlIGV2ZW50IHRoYXQgcmVxdWlyZXMgcmVtb3ZhbCBvZiBvdGhlciBldmVudHNcbiAgICovXG4gIF9wdXJnZU9uRGVsZXRlKGV2dCkge1xuICAgIHRoaXMucXVldWUuZmlsdGVyKHJlcXVlc3QgPT4gcmVxdWVzdC5kZXBlbmRzLmluZGV4T2YoZXZ0LnRhcmdldCkgIT09IC0xICYmIGV2dCAhPT0gcmVxdWVzdClcbiAgICAgIC5mb3JFYWNoKChyZXF1ZXN0RXZ0KSA9PiB7XG4gICAgICAgIHRoaXMudHJpZ2dlcignc3luYzphYm9ydCcsIHtcbiAgICAgICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RFdnQsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9yZW1vdmVSZXF1ZXN0KHJlcXVlc3RFdnQsIHRydWUpO1xuICAgICAgfSk7XG4gIH1cblxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5xdWV1ZS5mb3JFYWNoKGV2dCA9PiBldnQuZGVzdHJveSgpKTtcbiAgICB0aGlzLnF1ZXVlID0gbnVsbDtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKGV2dCA9PiBldnQuZGVzdHJveSgpKTtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZSA9IG51bGw7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYW55IHVuc2VudCByZXF1ZXN0cyBmcm9tIGluZGV4ZWREQi5cbiAgICpcbiAgICogSWYgcGVyc2lzdGVuY2UgaXMgZGlzYWJsZWQsIG5vdGhpbmcgd2lsbCBoYXBwZW47XG4gICAqIGVsc2UgYWxsIHJlcXVlc3RzIGZvdW5kIGluIHRoZSBkYXRhYmFzZSB3aWxsIGJlIGFkZGVkIHRvIHRoZSBxdWV1ZS5cbiAgICogQG1ldGhvZCBfbG9hZFBlcnNpc3RlZFF1ZXVlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbG9hZFBlcnNpc3RlZFF1ZXVlKCkge1xuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkU3luY1F1ZXVlKChkYXRhKSA9PiB7XG4gICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IHRoaXMucXVldWUuY29uY2F0KGRhdGEpO1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIFdlYnNvY2tldCBNYW5hZ2VyIGZvciBnZXR0aW5nIHNvY2tldCBzdGF0ZS5cbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWJzb2NrZXQgUmVxdWVzdCBNYW5hZ2VyIGZvciBzZW5kaW5nIHJlcXVlc3RzLlxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZXF1ZXN0TWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIHRoZSBPbmxpbmUgU3RhdGUgTWFuYWdlci5cbiAqXG4gKiBTeW5jIE1hbmFnZXIgdXNlcyBvbmxpbmUgc3RhdHVzIHRvIGRldGVybWluZSBpZiBpdCBjYW4gZmlyZSBzeW5jLXJlcXVlc3RzLlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5vbmxpbmVNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqIEB0eXBlIHtsYXllci5TeW5jRXZlbnRbXX1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnF1ZXVlID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqXG4gKiBSZWNlaXB0cyBjYW4gZ2VuZXJhbGx5IGp1c3QgYmUgZmlyZWQgb2ZmIGFsbCBhdCBvbmNlIHdpdGhvdXQgbXVjaCBmcmV0dGluZyBhYm91dCBvcmRlcmluZyBvciBkZXBlbmRlbmNpZXMuXG4gKiBAdHlwZSB7bGF5ZXIuU3luY0V2ZW50W119XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZWNlaXB0UXVldWUgPSBudWxsO1xuXG4vKipcbiAqIFJlZmVyZW5jZSB0byB0aGUgQ2xpZW50IHNvIHRoYXQgd2UgY2FuIHBhc3MgaXQgdG8gU3luY0V2ZW50cyAgd2hpY2ggbWF5IG5lZWQgdG8gbG9va3VwIHRoZWlyIHRhcmdldHNcbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogTWF4aW11bSBleHBvbmVudGlhbCBiYWNrb2ZmIHdhaXQuXG4gKlxuICogSWYgdGhlIHNlcnZlciBpcyByZXR1cm5pbmcgNTAyLCA1MDMgb3IgNTA0IGVycm9ycywgZXhwb25lbnRpYWwgYmFja29mZlxuICogc2hvdWxkIG5ldmVyIHdhaXQgbG9uZ2VyIHRoYW4gdGhpcyBudW1iZXIgb2Ygc2Vjb25kcyAoMTUgbWludXRlcylcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUID0gNjAgKiAxNTtcblxuLyoqXG4gKiBSZXRyaWVzIGJlZm9yZSBzdXNwZWN0IENPUlMgZXJyb3IuXG4gKlxuICogSG93IG1hbnkgdGltZXMgY2FuIHdlIHRyYW5zaXRpb24gZnJvbSBvZmZsaW5lIHRvIG9ubGluZSBzdGF0ZVxuICogd2l0aCB0aGlzIHJlcXVlc3QgYXQgdGhlIGZyb250IG9mIHRoZSBxdWV1ZSBiZWZvcmUgd2UgY29uY2x1ZGVcbiAqIHRoYXQgdGhlIHJlYXNvbiB3ZSBrZWVwIHRoaW5raW5nIHdlJ3JlIGdvaW5nIG9mZmxpbmUgaXNcbiAqIGEgQ09SUyBlcnJvciByZXR1cm5pbmcgYSBzdGF0dXMgb2YgMC4gIElmIHRoYXQgcGF0dGVyblxuICogc2hvd3MgMyB0aW1lcyBpbiBhIHJvdywgdGhlcmUgaXMgbGlrZWx5IGEgQ09SUyBlcnJvci5cbiAqIE5vdGUgdGhhdCBDT1JTIGVycm9ycyBhcHBlYXIgdG8gamF2YXNjcmlwdCBhcyBhIHN0YXR1cz0wIGVycm9yLFxuICogd2hpY2ggaXMgdGhlIHNhbWUgYXMgaWYgdGhlIGNsaWVudCB3ZXJlIG9mZmxpbmUuXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5TeW5jTWFuYWdlci5NQVhfUkVUUklFU19CRUZPUkVfQ09SU19FUlJPUiA9IDM7XG5cbi8qKlxuICogQWJvcnQgcmVxdWVzdCBhZnRlciB0aGlzIG51bWJlciBvZiByZXRyaWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTID0gMjA7XG5cblxuU3luY01hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIEEgc3luYyByZXF1ZXN0IGhhcyBmYWlsZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6ZXJyb3InLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgY29uc29sZS5lcnJvcihldnQudGFyZ2V0LmlkICsgJyBmYWlsZWQgdG8gc2VuZCBjaGFuZ2VzIHRvIHNlcnZlcjogJywgcmVzdWx0LmRhdGEubWVzc2FnZSk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdSZXF1ZXN0IEV2ZW50OicsIHJlcXVlc3RFdnQpO1xuICAgKiAgICBjb25zb2xlLmxvZygnU2VydmVyIFJlc3BvbnNlOicsIHJlc3VsdC5kYXRhKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dCAtIFRoZSByZXF1ZXN0IG9iamVjdFxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSByZXN1bHQudGFyZ2V0IC0gSUQgb2YgdGhlIG1lc3NhZ2UvY29udmVyc2F0aW9uL2V0Yy4gYmVpbmcgb3BlcmF0ZWQgdXBvblxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gcmVzdWx0LnJlcXVlc3QgLSBUaGUgb3JpZ2luYWwgcmVxdWVzdFxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0LmVycm9yIC0gVGhlIGVycm9yIG9iamVjdCB7aWQsIGNvZGUsIG1lc3NhZ2UsIHVybH1cbiAgICovXG4gICdzeW5jOmVycm9yJyxcblxuICAvKipcbiAgICogQSBzeW5jIGxheWVyIHJlcXVlc3QgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6c3VjY2VzcycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBjb25zb2xlLmxvZyhldnQudGFyZ2V0LmlkICsgJyBjaGFuZ2VzIHNlbnQgdG8gc2VydmVyIHN1Y2Nlc3NmdWxseScpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCByZXF1ZXN0RXZ0KTtcbiAgICogICAgY29uc29sZS5sb2coJ1NlcnZlciBSZXNwb25zZTonLCByZXN1bHQuZGF0YSk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc3VsdC50YXJnZXQgLSBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXN1bHQucmVxdWVzdCAtIFRoZSBvcmlnaW5hbCByZXF1ZXN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQuZGF0YSAtIG51bGwgb3IgYW55IGRhdGEgcmV0dXJuZWQgYnkgdGhlIGNhbGxcbiAgICovXG4gICdzeW5jOnN1Y2Nlc3MnLFxuXG4gIC8qKlxuICAgKiBBIG5ldyBzeW5jIHJlcXVlc3QgaGFzIGJlZW4gYWRkZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIGNvbnNvbGUubG9nKGV2dC50YXJnZXQuaWQgKyAnIGhhcyBjaGFuZ2VzIHF1ZXVlZCBmb3IgdGhlIHNlcnZlcicpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCByZXF1ZXN0RXZ0KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVzdWx0LnRhcmdldCAtIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dCAtIFRoZSByZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgJ3N5bmM6YWRkJyxcblxuICAvKipcbiAgICogQSBzeW5jIHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWQuXG4gICAqXG4gICAqIFR5cGljYWxseSBjYXVzZWQgYnkgYSBuZXcgU3luY0V2ZW50IHRoYXQgZGVsZXRlcyB0aGUgdGFyZ2V0IG9mIHRoaXMgU3luY0V2ZW50XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gVGhlIHJlcXVlc3Qgb2JqZWN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc3VsdC50YXJnZXQgLSBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXN1bHQucmVxdWVzdCAtIFRoZSBvcmlnaW5hbCByZXF1ZXN0XG4gICAqL1xuICAnc3luYzphYm9ydCcsXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcyhTeW5jTWFuYWdlcik7XG5tb2R1bGUuZXhwb3J0cyA9IFN5bmNNYW5hZ2VyO1xuIl19
