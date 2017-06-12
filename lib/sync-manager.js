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
        this.requestManager.sendRequest({
          data: requestEvt._getRequestData(this.client),
          callback: function callback(result) {
            return _this7._xhrResult(result, requestEvt);
          },
          isChangesArray: requestEvt.returnChangesArray
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
          this._xhrHandleServerUnavailableError(result);
          break;
        case 'serverUnavailable':
          // Server is in a bad state but will eventually recover;
          // keep retrying.
          this._xhrHandleServerUnavailableError(result);
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
     * @param  {Object} result             Response object returned by xhr call
     */

  }, {
    key: '_xhrHandleServerUnavailableError',
    value: function _xhrHandleServerUnavailableError(result) {
      var request = result.request;
      this.trigger('sync:error-will-retry', {
        target: request.target,
        request: request,
        error: result.data,
        retryCount: request.retryCount
      });
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
 * should never wait longer than this number of seconds (60 seconds)
 * @type {Number}
 * @static
 */
SyncManager.MAX_UNAVAILABLE_RETRY_WAIT = 60;

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
 *    console.error(evt.target + ' failed to send changes to server: ', evt.error.message);
 *    console.log('Request Event:', evt.request);
 * });
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt          Standard Layer Event object generated by all calls to `trigger`
 * @param {layer.LayerError} evt.error    An error object representing the server's response
 * @param {String} evt.target             ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt.request  The original request object
 */
'sync:error',

/**
 * A sync request has but will be retried soon.
 *
 * ```
 * client.syncManager.on('sync:error-will-retry', function(evt) {
 *    console.error(evt.target + ' failed to send changes to server: ', evt.error.message);
 *    console.log('Request Event:', evt.request);
 *    console.log('Number of retries:', evt.retryCount);
 * });
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt          Standard Layer Event object generated by all calls to `trigger`
 * @param {layer.LayerError} evt.error    An error object representing the server's response
 * @param {String} evt.target             ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt.request   The original request object
 * @param {Number} evt.retryCount         Number of retries performed on this request; for the first event this will be 0
 */
'sync:error-will-retry',

/**
 * A sync layer request has completed successfully.
 *
 * ```
 * client.syncManager.on('sync:success', function(evt) {
 *    console.log(evt.target + ' changes sent to server successfully');
 *    console.log('Request Event:', evt.request);
 *    console.log('Server Response:', evt.response);
 * });
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt          Standard Layer Event object generated by all calls to `trigger`
 * @param {String} evt.target             ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt.request   The original request
 * @param {Object} evt.response           null or any data returned by the call
 */
'sync:success',

/**
 * A new sync request has been added.
 *
 * ```
 * client.syncManager.on('sync:add', function(evt) {
 *    console.log(evt.target + ' has changes queued for the server');
 *    console.log('Request Event:', evt.request);
 * });
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt          Standard Layer Event object generated by all calls to `trigger`
 * @param {String} evt.target             ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt.request   The original request
 */
'sync:add',

/**
 * A sync request has been canceled.
 *
 * Typically caused by a new SyncEvent that deletes the target of this SyncEvent
 *
 * @event
 * @param {layer.LayerEvent} evt          Standard Layer Event object generated by all calls to `trigger`
 * @param {String} evt.target             ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt.request   The original request
 */
'sync:abort'].concat(Root._supportedEvents);

Root.initClass(SyncManager);
module.exports = SyncManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLW1hbmFnZXIuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJ4aHIiLCJsb2dnZXIiLCJVdGlscyIsIk1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TIiwiU3luY01hbmFnZXIiLCJvcHRpb25zIiwiY2xpZW50Iiwib24iLCJfcHJvY2Vzc05leHRSZXF1ZXN0IiwiX2xvYWRQZXJzaXN0ZWRRdWV1ZSIsInF1ZXVlIiwicmVjZWlwdFF1ZXVlIiwib25saW5lTWFuYWdlciIsIl9vbmxpbmVTdGF0ZUNoYW5nZSIsInNvY2tldE1hbmFnZXIiLCJpc09ubGluZSIsImV2dCIsImV2ZW50TmFtZSIsImxlbmd0aCIsInJldHVyblRvT25saW5lQ291bnQiLCJzZXRUaW1lb3V0IiwiaXNGaXJpbmciLCJmb3JFYWNoIiwic3luY0V2dCIsInJlcXVlc3RFdnQiLCJvcGVyYXRpb24iLCJfZmluZFVuZmlyZWRDcmVhdGUiLCJpbmZvIiwidGFyZ2V0IiwidG9PYmplY3QiLCJwdXNoIiwidHJpZ2dlciIsInJlcXVlc3QiLCJfcHVyZ2VPbkRlbGV0ZSIsImRiTWFuYWdlciIsIndyaXRlU3luY0V2ZW50cyIsIl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCIsIl9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0IiwiQm9vbGVhbiIsImZpbHRlciIsImlzRGVzdHJveWVkIiwiaXNBdXRoZW50aWNhdGVkIiwiX2lzVmFsaWRhdGluZyIsIl92YWxpZGF0ZVJlcXVlc3QiLCJpc1ZhbGlkIiwiX3JlbW92ZVJlcXVlc3QiLCJfZmlyZVJlcXVlc3QiLCJmaXJpbmdSZWNlaXB0cyIsInJlY2VpcHRFdnQiLCJfZmlyZVJlcXVlc3RXZWJzb2NrZXQiLCJfZmlyZVJlcXVlc3RYSFIiLCJoZWFkZXJzIiwiYXV0aG9yaXphdGlvbiIsInNlc3Npb25Ub2tlbiIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsIl9nZXRSZXF1ZXN0RGF0YSIsIl94aHJSZXN1bHQiLCJyZXN1bHQiLCJfaXNPcGVuIiwiZGVidWciLCJyZXF1ZXN0TWFuYWdlciIsInNlbmRSZXF1ZXN0IiwiZGF0YSIsImNhbGxiYWNrIiwiaXNDaGFuZ2VzQXJyYXkiLCJyZXR1cm5DaGFuZ2VzQXJyYXkiLCJzeW5jRXZlbnQiLCJjbGFpbVN5bmNFdmVudCIsImlzRm91bmQiLCJpZCIsIl9nZXRDcmVhdGVJZCIsInN1Y2Nlc3MiLCJfaGFuZGxlRGVkdXBsaWNhdGlvbkVycm9ycyIsIl94aHJFcnJvciIsIl94aHJTdWNjZXNzIiwiZXJySWQiLCJNQVhfUkVUUklFU19CRUZPUkVfQ09SU19FUlJPUiIsInN0YXR1cyIsInJldHJ5Q291bnQiLCJNQVhfUkVUUklFUyIsImluZGV4T2YiLCJub25jZSIsIndhcm4iLCJlcnJTdGF0ZSIsIl9nZXRFcnJvclN0YXRlIiwiX3hockhhbmRsZVNlcnZlckVycm9yIiwiX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3IiLCJfeGhySGFuZGxlQ29ubmVjdGlvbkVycm9yIiwiZXJyb3IiLCJtYXhEZWxheSIsIk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUIiwiZGVsYXkiLCJnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIiwiTWF0aCIsIm1pbiIsImJpbmQiLCJsb2dNc2ciLCJzdHJpbmdpZnkiLCJKU09OIiwiX3B1cmdlRGVwZW5kZW50UmVxdWVzdHMiLCJjaGVja09ubGluZVN0YXR1cyIsIl94aHJWYWxpZGF0ZUlzT25saW5lQ2FsbGJhY2siLCJyZXNwb25zZSIsImRlbGV0ZURCIiwiaW5kZXgiLCJzcGxpY2UiLCJkZWxldGVPYmplY3RzIiwiZGVwZW5kcyIsImRlc3Ryb3kiLCJsb2FkU3luY1F1ZXVlIiwiY29uY2F0IiwicHJvdG90eXBlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImluaXRDbGFzcyIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLElBQU1BLE9BQU9D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L0I7O0FBd0ZBcEgsS0FBS3FILFNBQUwsQ0FBZTlHLFdBQWY7QUFDQStHLE9BQU9DLE9BQVAsR0FBaUJoSCxXQUFqQiIsImZpbGUiOiJzeW5jLW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyAgbGF5ZXIuU3luY01hbmFnZXJcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqIEBwcm90ZWN0ZWRcbiAqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXNcbiAqXG4gKiAxLiBhIHF1ZXVlIG9mIHJlcXVlc3RzIHRoYXQgbmVlZCB0byBiZSBtYWRlXG4gKiAyLiB3aGVuIGEgcmVxdWVzdCBzaG91bGQgYmUgZmlyZWQsIGJhc2VkIG9uIGF1dGhlbnRpY2F0aW9uIHN0YXRlLCBvbmxpbmUgc3RhdGUsIHdlYnNvY2tldCBjb25uZWN0aW9uIHN0YXRlLCBhbmQgcG9zaXRpb24gaW4gdGhlIHF1ZXVlXG4gKiAzLiB3aGVuIGEgcmVxdWVzdCBzaG91bGQgYmUgYWJvcnRlZFxuICogNC4gdHJpZ2dlcmluZyBhbnkgcmVxdWVzdCBjYWxsYmFja3NcbiAqXG4gKiBUT0RPOiBJbiB0aGUgZXZlbnQgb2YgYSBETlMgZXJyb3IsIHdlIG1heSBoYXZlIGEgdmFsaWQgd2Vic29ja2V0IHJlY2VpdmluZyBldmVudHMgYW5kIHRlbGxpbmcgdXMgd2UgYXJlIG9ubGluZSxcbiAqIGFuZCBiZSB1bmFibGUgdG8gY3JlYXRlIGEgUkVTVCBjYWxsLiAgVGhpcyB3aWxsIGJlIGhhbmRsZWQgd3JvbmcgYmVjYXVzZSBldmlkZW5jZSB3aWxsIHN1Z2dlc3QgdGhhdCB3ZSBhcmUgb25saW5lLlxuICogVGhpcyBpc3N1ZSBnb2VzIGF3YXkgd2hlbiB3ZSB1c2UgYmlkaXJlY3Rpb25hbCB3ZWJzb2NrZXRzIGZvciBhbGwgcmVxdWVzdHMuXG4gKlxuICogQXBwbGljYXRpb25zIGRvIG5vdCB0eXBpY2FsbHkgaW50ZXJhY3Qgd2l0aCB0aGlzIGNsYXNzLCBidXQgbWF5IHN1YnNjcmliZSB0byBpdHMgZXZlbnRzXG4gKiB0byBnZXQgcmljaGVyIGRldGFpbGVkIGluZm9ybWF0aW9uIHRoYW4gaXMgYXZhaWxhYmxlIGZyb20gdGhlIGxheWVyLkNsaWVudCBpbnN0YW5jZS5cbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgeyBXZWJzb2NrZXRTeW5jRXZlbnQgfSA9IHJlcXVpcmUoJy4vc3luYy1ldmVudCcpO1xuY29uc3QgeGhyID0gcmVxdWlyZSgnLi94aHInKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5cbmNvbnN0IE1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TID0gNDtcblxuY2xhc3MgU3luY01hbmFnZXIgZXh0ZW5kcyBSb290IHtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgU3luY01hbmFnZXIuXG4gICAqXG4gICAqIEFuIEFwcGxpY2F0aW9uIGlzIGV4cGVjdGVkIHRvIG9ubHkgaGF2ZSBvbmUgU3luY01hbmFnZXIuXG4gICAqXG4gICAqICAgICAgdmFyIHNvY2tldE1hbmFnZXIgPSBuZXcgbGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyKHtjbGllbnQ6IGNsaWVudH0pO1xuICAgKiAgICAgIHZhciByZXF1ZXN0TWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLlJlcXVlc3RNYW5hZ2VyKHtjbGllbnQ6IGNsaWVudCwgc29ja2V0TWFuYWdlcjogc29ja2V0TWFuYWdlcn0pO1xuICAgKlxuICAgKiAgICAgIHZhciBvbmxpbmVNYW5hZ2VyID0gbmV3IGxheWVyLk9ubGluZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqICAgICAgLy8gTm93IHdlIGNhbiBpbnN0YW50aWF0ZSB0aGlzIHRoaW5nLi4uXG4gICAqICAgICAgdmFyIFN5bmNNYW5hZ2VyID0gbmV3IGxheWVyLlN5bmNNYW5hZ2VyKHtcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgIG9ubGluZU1hbmFnZXI6IG9ubGluZU1hbmFnZXIsXG4gICAqICAgICAgICAgIHNvY2tldE1hbmFnZXI6IHNvY2tldE1hbmFnZXIsXG4gICAqICAgICAgICAgIHJlcXVlc3RNYW5hZ2VyOiByZXF1ZXN0TWFuYWdlclxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLk9ubGluZVN0YXRlTWFuYWdlcn0gb3B0aW9ucy5vbmxpbmVNYW5hZ2VyXG4gICAqIEBwYXJhbSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn0gb3B0aW9ucy5yZXF1ZXN0TWFuYWdlclxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gb3B0aW9ucy5jbGllbnRcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmNsaWVudCA9IG9wdGlvbnMuY2xpZW50O1xuXG4gICAgLy8gTm90ZSB3ZSBkbyBub3Qgc3RvcmUgYSBwb2ludGVyIHRvIGNsaWVudC4uLiBpdCBpcyBub3QgbmVlZGVkLlxuICAgIGlmICh0aGlzLmNsaWVudCkge1xuICAgICAgdGhpcy5jbGllbnQub24oJ3JlYWR5JywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICAgICAgdGhpcy5fbG9hZFBlcnNpc3RlZFF1ZXVlKCk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gW107XG5cbiAgICAvLyBSYXRoZXIgdGhhbiBsaXN0ZW4gZm9yIG9ubGluZU1hbmFnZXIgJ2Nvbm5lY3RlZCcsIGxldCB0aGUgc29ja2V0TWFuYWdlciBsaXN0ZW4gZm9yIHRoYXQsIGNvbm5lY3QsIGFuZCB0aGUgc3luY01hbmFnZXJcbiAgICAvLyB3YWl0cyB1bnRpbCBpdHMgYWN0dWFsbHkgY29ubmVjdGVkXG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLm9uKCdkaXNjb25uZWN0ZWQnLCB0aGlzLl9vbmxpbmVTdGF0ZUNoYW5nZSwgdGhpcyk7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLm9uKCdjb25uZWN0ZWQgZGlzY29ubmVjdGVkJywgdGhpcy5fb25saW5lU3RhdGVDaGFuZ2UsIHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgd2hldGhlciB0aGUgQ2xpZW50IGlzIG9ubGluZS9vZmZsaW5lLlxuICAgKlxuICAgKiBGb3IgaW50ZXJuYWwgdXNlOyBhcHBsaWNhdGlvbnMgc2hvdWxkIHVzZSBsYXllci5DbGllbnQuaXNPbmxpbmUuXG4gICAqXG4gICAqIEBtZXRob2QgaXNPbmxpbmVcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqL1xuICBpc09ubGluZSgpIHtcbiAgICByZXR1cm4gdGhpcy5vbmxpbmVNYW5hZ2VyLmlzT25saW5lO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3Mgc3luYyByZXF1ZXN0IHdoZW4gY29ubmVjdGlvbiBpcyByZXN0b3JlZC5cbiAgICpcbiAgICogQW55IHRpbWUgd2UgZ28gYmFjayBvbmxpbmUgKGFzIHNpZ25hbGVkIGJ5IHRoZSBvbmxpbmVTdGF0ZU1hbmFnZXIpLFxuICAgKiBQcm9jZXNzIHRoZSBuZXh0IFN5bmMgRXZlbnQgKHdpbGwgZG8gbm90aGluZyBpZiBvbmUgaXMgYWxyZWFkeSBmaXJpbmcpXG4gICAqXG4gICAqIEBtZXRob2QgX29ubGluZVN0YXRlQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZ0TmFtZSAtICdjb25uZWN0ZWQnIG9yICdkaXNjb25uZWN0ZWQnXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgX29ubGluZVN0YXRlQ2hhbmdlKGV2dCkge1xuICAgIGlmIChldnQuZXZlbnROYW1lID09PSAnY29ubmVjdGVkJykge1xuICAgICAgaWYgKHRoaXMucXVldWUubGVuZ3RoKSB0aGlzLnF1ZXVlWzBdLnJldHVyblRvT25saW5lQ291bnQrKztcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KCksIDEwMCk7XG4gICAgfSBlbHNlIGlmIChldnQuZXZlbnROYW1lID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgaWYgKHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMucXVldWVbMF0uaXNGaXJpbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnJlY2VpcHRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5yZWNlaXB0UXVldWUuZm9yRWFjaChzeW5jRXZ0ID0+IChzeW5jRXZ0LmlzRmlyaW5nID0gZmFsc2UpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIG5ldyB4aHIgcmVxdWVzdCB0byB0aGUgcXVldWUuXG4gICAqXG4gICAqIElmIHRoZSBxdWV1ZSBpcyBlbXB0eSwgdGhpcyB3aWxsIGJlIGZpcmVkIGltbWVkaWF0ZWx5OyBlbHNlIGl0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIHF1ZXVlIGFuZCB3YWl0IGl0cyB0dXJuLlxuICAgKlxuICAgKiBJZiBpdHMgYSByZWFkL2RlbGl2ZXJ5IHJlY2VpcHQgcmVxdWVzdCwgaXQgd2lsbCB0eXBpY2FsbHkgYmUgZmlyZWQgaW1tZWRpYXRlbHkgdW5sZXNzIHRoZXJlIGFyZSBtYW55IHJlY2VpcHRcbiAgICogcmVxdWVzdHMgYWxyZWFkeSBpbi1mbGlnaHQuXG4gICAqXG4gICAqIEBtZXRob2QgcmVxdWVzdFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBBIFN5bmNFdmVudCBzcGVjaWZ5aW5nIHRoZSByZXF1ZXN0IHRvIGJlIG1hZGVcbiAgICovXG4gIHJlcXVlc3QocmVxdWVzdEV2dCkge1xuICAgIC8vIElmIGl0cyBhIFBBVENIIHJlcXVlc3Qgb24gYW4gb2JqZWN0IHRoYXQgaXNuJ3QgeWV0IGNyZWF0ZWQsXG4gICAgLy8gZG8gbm90IGFkZCBpdCB0byB0aGUgcXVldWUuXG4gICAgaWYgKHJlcXVlc3RFdnQub3BlcmF0aW9uICE9PSAnUEFUQ0gnIHx8ICF0aGlzLl9maW5kVW5maXJlZENyZWF0ZShyZXF1ZXN0RXZ0KSkge1xuICAgICAgbG9nZ2VyLmluZm8oYFN5bmMgTWFuYWdlciBSZXF1ZXN0ICR7cmVxdWVzdEV2dC5vcGVyYXRpb259IG9uIHRhcmdldCAke3JlcXVlc3RFdnQudGFyZ2V0fWAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgICBpZiAocmVxdWVzdEV2dC5vcGVyYXRpb24gPT09ICdSRUNFSVBUJykge1xuICAgICAgICB0aGlzLnJlY2VpcHRRdWV1ZS5wdXNoKHJlcXVlc3RFdnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5xdWV1ZS5wdXNoKHJlcXVlc3RFdnQpO1xuICAgICAgfVxuICAgICAgdGhpcy50cmlnZ2VyKCdzeW5jOmFkZCcsIHtcbiAgICAgICAgcmVxdWVzdDogcmVxdWVzdEV2dCxcbiAgICAgICAgdGFyZ2V0OiByZXF1ZXN0RXZ0LnRhcmdldCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbyhgU3luYyBNYW5hZ2VyIFJlcXVlc3QgUEFUQ0ggJHtyZXF1ZXN0RXZ0LnRhcmdldH0gcmVxdWVzdCBpZ25vcmVkOyBjcmVhdGUgcmVxdWVzdCBzdGlsbCBlbnF1ZXVlZGAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgfVxuXG4gICAgLy8gSWYgaXRzIGEgREVMRVRFIHJlcXVlc3QsIHB1cmdlIGFsbCBvdGhlciByZXF1ZXN0cyBvbiB0aGF0IHRhcmdldC5cbiAgICBpZiAocmVxdWVzdEV2dC5vcGVyYXRpb24gPT09ICdERUxFVEUnKSB7XG4gICAgICB0aGlzLl9wdXJnZU9uRGVsZXRlKHJlcXVlc3RFdnQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdChyZXF1ZXN0RXZ0KTtcbiAgfVxuXG4gIF9wcm9jZXNzTmV4dFJlcXVlc3QocmVxdWVzdEV2dCkge1xuICAgIC8vIEZpcmUgdGhlIHJlcXVlc3QgaWYgdGhlcmUgYXJlbid0IGFueSBleGlzdGluZyByZXF1ZXN0cyBhbHJlYWR5IGZpcmluZ1xuICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCAmJiAhdGhpcy5xdWV1ZVswXS5pc0ZpcmluZykge1xuICAgICAgaWYgKHJlcXVlc3RFdnQpIHtcbiAgICAgICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLndyaXRlU3luY0V2ZW50cyhbcmVxdWVzdEV2dF0sICgpID0+IHRoaXMuX3Byb2Nlc3NOZXh0U3RhbmRhcmRSZXF1ZXN0KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcHJvY2Vzc05leHRTdGFuZGFyZFJlcXVlc3QoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBoYXZlIGFueXRoaW5nIGluIHRoZSByZWNlaXB0cyBxdWV1ZSwgZmlyZSBpdFxuICAgIGlmICh0aGlzLnJlY2VpcHRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVjZWlwdFJlcXVlc3QoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRmluZCBjcmVhdGUgcmVxdWVzdCBmb3IgdGhpcyByZXNvdXJjZS5cbiAgICpcbiAgICogRGV0ZXJtaW5lIGlmIHRoZSBnaXZlbiB0YXJnZXQgaGFzIGEgUE9TVCByZXF1ZXN0IHdhaXRpbmcgdG8gY3JlYXRlXG4gICAqIHRoZSByZXNvdXJjZSwgYW5kIHJldHVybiBhbnkgbWF0Y2hpbmcgcmVxdWVzdHMuIFVzZWRcbiAgICogZm9yIGZvbGRpbmcgUEFUQ0ggcmVxdWVzdHMgaW50byBhbiB1bmZpcmVkIENSRUFURS9QT1NUIHJlcXVlc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpbmRVbmZpcmVkQ3JlYXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgX2ZpbmRVbmZpcmVkQ3JlYXRlKHJlcXVlc3RFdnQpIHtcbiAgICByZXR1cm4gQm9vbGVhbih0aGlzLnF1ZXVlLmZpbHRlcihldnQgPT5cbiAgICAgIGV2dC50YXJnZXQgPT09IHJlcXVlc3RFdnQudGFyZ2V0ICYmIGV2dC5vcGVyYXRpb24gPT09ICdQT1NUJyAmJiAhZXZ0LmlzRmlyaW5nKS5sZW5ndGhcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIG5leHQgcmVxdWVzdCBpbiB0aGUgcXVldWUuXG4gICAqXG4gICAqIFJlcXVlc3QgaXMgZGVxdWV1ZWQgb24gY29tcGxldGluZyB0aGUgcHJvY2Vzcy5cbiAgICogSWYgdGhlIGZpcnN0IHJlcXVlc3QgaW4gdGhlIHF1ZXVlIGlzIGZpcmluZywgZG8gbm90aGluZy5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc05leHRSZXF1ZXN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJvY2Vzc05leHRTdGFuZGFyZFJlcXVlc3QoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzQXV0aGVudGljYXRlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHJlcXVlc3RFdnQgPSB0aGlzLnF1ZXVlWzBdO1xuICAgIGlmICh0aGlzLmlzT25saW5lKCkgJiYgcmVxdWVzdEV2dCAmJiAhcmVxdWVzdEV2dC5pc0ZpcmluZyAmJiAhcmVxdWVzdEV2dC5faXNWYWxpZGF0aW5nKSB7XG4gICAgICByZXF1ZXN0RXZ0Ll9pc1ZhbGlkYXRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fdmFsaWRhdGVSZXF1ZXN0KHJlcXVlc3RFdnQsIChpc1ZhbGlkKSA9PiB7XG4gICAgICAgIHJlcXVlc3RFdnQuX2lzVmFsaWRhdGluZyA9IGZhbHNlO1xuICAgICAgICBpZiAoIWlzVmFsaWQpIHtcbiAgICAgICAgICB0aGlzLl9yZW1vdmVSZXF1ZXN0KHJlcXVlc3RFdnQsIGZhbHNlKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc05leHRTdGFuZGFyZFJlcXVlc3QoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9maXJlUmVxdWVzdChyZXF1ZXN0RXZ0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdXAgdG8gTUFYX1JFQ0VJUFRfQ09OTkVDVElPTlMgd29ydGggb2YgcmVjZWlwdHMuXG4gICAqXG4gICAqIFRoZXNlIHJlcXVlc3RzIGhhdmUgbm8gaW50ZXJkZXBlbmRlbmNpZXMuIEp1c3QgZmlyZSB0aGVtIGFsbFxuICAgKiBhcyBmYXN0IGFzIHdlIGNhbiwgaW4gcGFyYWxsZWwuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NOZXh0UmVjZWlwdFJlcXVlc3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0KCkge1xuICAgIGxldCBmaXJpbmdSZWNlaXB0cyA9IDA7XG4gICAgdGhpcy5yZWNlaXB0UXVldWUuZm9yRWFjaCgocmVjZWlwdEV2dCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNPbmxpbmUoKSAmJiByZWNlaXB0RXZ0KSB7XG4gICAgICAgIGlmIChyZWNlaXB0RXZ0LmlzRmlyaW5nIHx8IHJlY2VpcHRFdnQuX2lzVmFsaWRhdGluZykge1xuICAgICAgICAgIGZpcmluZ1JlY2VpcHRzKys7XG4gICAgICAgIH0gZWxzZSBpZiAoZmlyaW5nUmVjZWlwdHMgPCBNQVhfUkVDRUlQVF9DT05ORUNUSU9OUykge1xuICAgICAgICAgIGZpcmluZ1JlY2VpcHRzKys7XG4gICAgICAgICAgdGhpcy5fZmlyZVJlcXVlc3QocmVjZWlwdEV2dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgc3luYyByZXF1ZXN0LlxuICAgKlxuICAgKiBUaGlzIGlzIGludGVuZGVkIHRvIGJlIGNhbGxlZCBvbmx5IGFmdGVyIGNhcmVmdWwgYW5hbHlzaXMgb2Ygb3VyIHN0YXRlIHRvIG1ha2Ugc3VyZSBpdHMgc2FmZSB0byBzZW5kIHRoZSByZXF1ZXN0LlxuICAgKiBTZWUgYF9wcm9jZXNzTmV4dFJlcXVlc3QoKWBcbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnRcbiAgICovXG4gIF9maXJlUmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgaWYgKHJlcXVlc3RFdnQgaW5zdGFuY2VvZiBXZWJzb2NrZXRTeW5jRXZlbnQpIHtcbiAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0V2Vic29ja2V0KHJlcXVlc3RFdnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9maXJlUmVxdWVzdFhIUihyZXF1ZXN0RXZ0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlyZWN0bHkgZmlyZSB0aGlzIFhIUiBTeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpcmVSZXF1ZXN0WEhSXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50LlhIUlN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0WEhSKHJlcXVlc3RFdnQpIHtcbiAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gdHJ1ZTtcbiAgICBpZiAoIXJlcXVlc3RFdnQuaGVhZGVycykgcmVxdWVzdEV2dC5oZWFkZXJzID0ge307XG4gICAgcmVxdWVzdEV2dC5oZWFkZXJzLmF1dGhvcml6YXRpb24gPSAnTGF5ZXIgc2Vzc2lvbi10b2tlbj1cIicgKyB0aGlzLmNsaWVudC5zZXNzaW9uVG9rZW4gKyAnXCInO1xuICAgIGxvZ2dlci5pbmZvKGBTeW5jIE1hbmFnZXIgWEhSIFJlcXVlc3QgRmlyaW5nICR7cmVxdWVzdEV2dC5vcGVyYXRpb259ICR7cmVxdWVzdEV2dC50YXJnZXR9IGF0ICR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfWAsXG4gICAgICByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgIHhocihyZXF1ZXN0RXZ0Ll9nZXRSZXF1ZXN0RGF0YSh0aGlzLmNsaWVudCksIHJlc3VsdCA9PiB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCByZXF1ZXN0RXZ0KSk7XG4gIH1cblxuICAvKipcbiAgICogRGlyZWN0bHkgZmlyZSB0aGlzIFdlYnNvY2tldCBTeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpcmVSZXF1ZXN0V2Vic29ja2V0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0V2Vic29ja2V0KHJlcXVlc3RFdnQpIHtcbiAgICBpZiAodGhpcy5zb2NrZXRNYW5hZ2VyICYmIHRoaXMuc29ja2V0TWFuYWdlci5faXNPcGVuKCkpIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgU3luYyBNYW5hZ2VyIFdlYnNvY2tldCBSZXF1ZXN0IEZpcmluZyAke3JlcXVlc3RFdnQub3BlcmF0aW9ufSBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH1gLFxuICAgICAgICByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgICAgcmVxdWVzdEV2dC5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHtcbiAgICAgICAgZGF0YTogcmVxdWVzdEV2dC5fZ2V0UmVxdWVzdERhdGEodGhpcy5jbGllbnQpLFxuICAgICAgICBjYWxsYmFjazogcmVzdWx0ID0+IHRoaXMuX3hoclJlc3VsdChyZXN1bHQsIHJlcXVlc3RFdnQpLFxuICAgICAgICBpc0NoYW5nZXNBcnJheTogcmVxdWVzdEV2dC5yZXR1cm5DaGFuZ2VzQXJyYXksXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdTeW5jIE1hbmFnZXIgV2Vic29ja2V0IFJlcXVlc3Qgc2tpcHBlZDsgc29ja2V0IGNsb3NlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgc3luY0V2ZW50IHN0aWxsIHZhbGlkP1xuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBzcGVjaWZpY2FsbHkgdGVzdHMgdG8gc2VlIGlmIHNvbWUgb3RoZXIgdGFiIGhhcyBhbHJlYWR5IHNlbnQgdGhpcyByZXF1ZXN0LlxuICAgKiBJZiBwZXJzaXN0ZW5jZSBvZiB0aGUgc3luY1F1ZXVlIGlzIG5vdCBlbmFibGVkLCB0aGVuIHRoZSBjYWxsYmFjayBpcyBpbW1lZGlhdGVseSBjYWxsZWQgd2l0aCB0cnVlLlxuICAgKiBJZiBhbm90aGVyIHRhYiBoYXMgYWxyZWFkeSBzZW50IHRoZSByZXF1ZXN0LCB0aGVuIHRoZSBlbnRyeSB3aWxsIG5vIGxvbmdlciBiZSBpbiBpbmRleGVkREIgYW5kIHRoZSBjYWxsYmFja1xuICAgKiB3aWxsIGNhbGwgZmFsc2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3ZhbGlkYXRlUmVxdWVzdFxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gc3luY0V2ZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrLmlzVmFsaWQgLSBUaGUgcmVxdWVzdCBpcyBzdGlsbCB2YWxpZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ZhbGlkYXRlUmVxdWVzdChzeW5jRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmNsYWltU3luY0V2ZW50KHN5bmNFdmVudCwgaXNGb3VuZCA9PiBjYWxsYmFjayhpc0ZvdW5kKSk7XG4gIH1cblxuICAvKipcbiAgICogVHVybiBkZWR1cGxpY2F0aW9uIGVycm9ycyBpbnRvIHN1Y2Nlc3MgbWVzc2FnZXMuXG4gICAqXG4gICAqIElmIHRoaXMgcmVxdWVzdCBoYXMgYWxyZWFkeSBiZWVuIG1hZGUgYnV0IHdlIGZhaWxlZCB0byBnZXQgYSByZXNwb25zZSB0aGUgZmlyc3QgdGltZSBhbmQgd2UgcmV0cmllZCB0aGUgcmVxdWVzdCxcbiAgICogd2Ugd2lsbCByZWlzc3VlIHRoZSByZXF1ZXN0LiAgSWYgdGhlIHByaW9yIHJlcXVlc3Qgd2FzIHN1Y2Nlc3NmdWwgd2UnbGwgZ2V0IGJhY2sgYSBkZWR1cGxpY2F0aW9uIGVycm9yXG4gICAqIHdpdGggdGhlIGNyZWF0ZWQgb2JqZWN0LiBBcyBmYXIgYXMgdGhlIFdlYlNESyBpcyBjb25jZXJuZWQsIHRoaXMgaXMgYSBzdWNjZXNzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVEZWR1cGxpY2F0aW9uRXJyb3JzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFuZGxlRGVkdXBsaWNhdGlvbkVycm9ycyhyZXN1bHQpIHtcbiAgICBpZiAocmVzdWx0LmRhdGEgJiYgcmVzdWx0LmRhdGEuaWQgPT09ICdpZF9pbl91c2UnICYmXG4gICAgICAgIHJlc3VsdC5kYXRhLmRhdGEgJiYgcmVzdWx0LmRhdGEuZGF0YS5pZCA9PT0gcmVzdWx0LnJlcXVlc3QuX2dldENyZWF0ZUlkKCkpIHtcbiAgICAgIHJlc3VsdC5zdWNjZXNzID0gdHJ1ZTtcbiAgICAgIHJlc3VsdC5kYXRhID0gcmVzdWx0LmRhdGEuZGF0YTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgcmVzdWx0IG9mIGFuIHhociBjYWxsLCByb3V0aW5nIGl0IHRvIHRoZSBhcHByb3ByaWF0ZSBoYW5kbGVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICBfeGhyUmVzdWx0KHJlc3VsdCwgcmVxdWVzdEV2dCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgcmVzdWx0LnJlcXVlc3QgPSByZXF1ZXN0RXZ0O1xuICAgIHJlcXVlc3RFdnQuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9oYW5kbGVEZWR1cGxpY2F0aW9uRXJyb3JzKHJlc3VsdCk7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5feGhyRXJyb3IocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5feGhyU3VjY2VzcyhyZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYXRlZ29yaXplIHRoZSBlcnJvciBmb3IgaGFuZGxpbmcuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldEVycm9yU3RhdGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IGlzT25saW5lIC0gSXMgb3VyIGFwcCBzdGF0ZSBzZXQgdG8gb25saW5lXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9XG4gICAqL1xuICBfZ2V0RXJyb3JTdGF0ZShyZXN1bHQsIHJlcXVlc3RFdnQsIGlzT25saW5lKSB7XG4gICAgY29uc3QgZXJySWQgPSByZXN1bHQuZGF0YSA/IHJlc3VsdC5kYXRhLmlkIDogJyc7XG4gICAgaWYgKCFpc09ubGluZSkge1xuICAgICAgLy8gQ09SUyBlcnJvcnMgbG9vayBpZGVudGljYWwgdG8gb2ZmbGluZTsgYnV0IGlmIG91ciBvbmxpbmUgc3RhdGUgaGFzIHRyYW5zaXRpb25lZCBmcm9tIGZhbHNlIHRvIHRydWUgcmVwZWF0ZWRseSB3aGlsZSBwcm9jZXNzaW5nIHRoaXMgcmVxdWVzdCxcbiAgICAgIC8vIHRoYXRzIGEgaGludCB0aGF0IHRoYXQgaXRzIGEgQ09SUyBlcnJvclxuICAgICAgaWYgKHJlcXVlc3RFdnQucmV0dXJuVG9PbmxpbmVDb3VudCA+PSBTeW5jTWFuYWdlci5NQVhfUkVUUklFU19CRUZPUkVfQ09SU19FUlJPUikge1xuICAgICAgICByZXR1cm4gJ0NPUlMnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdvZmZsaW5lJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVycklkID09PSAnbm90X2ZvdW5kJykge1xuICAgICAgcmV0dXJuICdub3RGb3VuZCc7XG4gICAgfSBlbHNlIGlmIChlcnJJZCA9PT0gJ2lkX2luX3VzZScpIHtcbiAgICAgIHJldHVybiAnaW52YWxpZElkJzsgLy8gVGhpcyBvbmx5IGZpcmVzIGlmIHdlIGdldCBgaWRfaW5fdXNlYCBidXQgbm8gUmVzb3VyY2UsIHdoaWNoIG1lYW5zIHRoZSBVVUlEIHdhcyB1c2VkIGJ5IGFub3RoZXIgdXNlci9hcHAuXG4gICAgfSBlbHNlIGlmIChyZXN1bHQuc3RhdHVzID09PSA0MDggfHwgZXJySWQgPT09ICdyZXF1ZXN0X3RpbWVvdXQnKSB7XG4gICAgICBpZiAocmVxdWVzdEV2dC5yZXRyeUNvdW50ID49IFN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTKSB7XG4gICAgICAgIHJldHVybiAndG9vTWFueUZhaWx1cmVzV2hpbGVPbmxpbmUnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICd2YWxpZGF0ZU9ubGluZUFuZFJldHJ5JztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFs1MDIsIDUwMywgNTA0XS5pbmRleE9mKHJlc3VsdC5zdGF0dXMpICE9PSAtMSkge1xuICAgICAgaWYgKHJlcXVlc3RFdnQucmV0cnlDb3VudCA+PSBTeW5jTWFuYWdlci5NQVhfUkVUUklFUykge1xuICAgICAgICByZXR1cm4gJ3Rvb01hbnlGYWlsdXJlc1doaWxlT25saW5lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc2VydmVyVW5hdmFpbGFibGUnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJySWQgPT09ICdhdXRoZW50aWNhdGlvbl9yZXF1aXJlZCcgJiYgcmVzdWx0LmRhdGEuZGF0YSAmJiByZXN1bHQuZGF0YS5kYXRhLm5vbmNlKSB7XG4gICAgICByZXR1cm4gJ3JlYXV0aG9yaXplJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdzZXJ2ZXJSZWplY3RlZFJlcXVlc3QnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgZmFpbGVkIHJlcXVlc3RzLlxuICAgKlxuICAgKiAxLiBJZiB0aGVyZSB3YXMgYW4gZXJyb3IgZnJvbSB0aGUgc2VydmVyLCB0aGVuIHRoZSByZXF1ZXN0IGhhcyBwcm9ibGVtc1xuICAgKiAyLiBJZiB3ZSBkZXRlcm1pbmUgd2UgYXJlIG5vdCBpbiBmYWN0IG9ubGluZSwgY2FsbCB0aGUgY29ubmVjdGlvbkVycm9yIGhhbmRsZXJcbiAgICogMy4gSWYgd2UgdGhpbmsgd2UgYXJlIG9ubGluZSwgdmVyaWZ5IHdlIGFyZSBvbmxpbmUgYW5kIHRoZW4gZGV0ZXJtaW5lIGhvdyB0byBoYW5kbGUgaXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3hockVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgX3hockVycm9yKHJlc3VsdCkge1xuICAgIGNvbnN0IHJlcXVlc3RFdnQgPSByZXN1bHQucmVxdWVzdDtcblxuICAgIGxvZ2dlci53YXJuKGBTeW5jIE1hbmFnZXIgJHtyZXF1ZXN0RXZ0IGluc3RhbmNlb2YgV2Vic29ja2V0U3luY0V2ZW50ID8gJ1dlYnNvY2tldCcgOiAnWEhSJ30gYCArXG4gICAgICBgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gUmVxdWVzdCBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH0gaGFzIEZhaWxlZGAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG5cblxuICAgIGNvbnN0IGVyclN0YXRlID0gdGhpcy5fZ2V0RXJyb3JTdGF0ZShyZXN1bHQsIHJlcXVlc3RFdnQsIHRoaXMuaXNPbmxpbmUoKSk7XG4gICAgbG9nZ2VyLndhcm4oJ1N5bmMgTWFuYWdlciBFcnJvciBTdGF0ZTogJyArIGVyclN0YXRlKTtcbiAgICBzd2l0Y2ggKGVyclN0YXRlKSB7XG4gICAgICBjYXNlICd0b29NYW55RmFpbHVyZXNXaGlsZU9ubGluZSc6XG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgVW5hdmFpbGFibGUgVG9vIExvbmc7IHJlbW92aW5nIHJlcXVlc3QnLCBmYWxzZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbm90Rm91bmQnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdSZXNvdXJjZSBub3QgZm91bmQ7IHByZXN1bWFibHkgZGVsZXRlZCcsIGZhbHNlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdpbnZhbGlkSWQnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdJRCB3YXMgbm90IHVuaXF1ZTsgcmVxdWVzdCBmYWlsZWQnLCBmYWxzZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAndmFsaWRhdGVPbmxpbmVBbmRSZXRyeSc6XG4gICAgICAgIC8vIFNlcnZlciBhcHBlYXJzIHRvIGJlIGh1bmcgYnV0IHdpbGwgZXZlbnR1YWxseSByZWNvdmVyLlxuICAgICAgICAvLyBSZXRyeSBhIGZldyB0aW1lcyBhbmQgdGhlbiBlcnJvciBvdXQuXG4gICAgICAgIC8vIHRoaXMuX3hoclZhbGlkYXRlSXNPbmxpbmUocmVxdWVzdEV2dCk7XG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3IocmVzdWx0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzZXJ2ZXJVbmF2YWlsYWJsZSc6XG4gICAgICAgIC8vIFNlcnZlciBpcyBpbiBhIGJhZCBzdGF0ZSBidXQgd2lsbCBldmVudHVhbGx5IHJlY292ZXI7XG4gICAgICAgIC8vIGtlZXAgcmV0cnlpbmcuXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3IocmVzdWx0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZWF1dGhvcml6ZSc6XG4gICAgICAgIC8vIHNlc3Npb25Ub2tlbiBhcHBlYXJzIHRvIG5vIGxvbmdlciBiZSB2YWxpZDsgZm9yd2FyZCByZXNwb25zZVxuICAgICAgICAvLyBvbiB0byBjbGllbnQtYXV0aGVudGljYXRvciB0byBwcm9jZXNzLlxuICAgICAgICAvLyBEbyBub3QgcmV0cnkgbm9yIGFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0LlxuICAgICAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2VydmVyUmVqZWN0ZWRSZXF1ZXN0JzpcbiAgICAgICAgLy8gU2VydmVyIHByZXN1bWFibHkgZGlkIG5vdCBsaWtlIHRoZSBhcmd1bWVudHMgdG8gdGhpcyBjYWxsXG4gICAgICAgIC8vIG9yIHRoZSB1cmwgd2FzIGludmFsaWQuICBEbyBub3QgcmV0cnk7IHRyaWdnZXIgdGhlIGNhbGxiYWNrXG4gICAgICAgIC8vIGFuZCBsZXQgdGhlIGNhbGxlciBoYW5kbGUgaXQuXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgUmVqZWN0cyBSZXF1ZXN0OyByZW1vdmluZyByZXF1ZXN0JywgdHJ1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnQ09SUyc6XG4gICAgICAgIC8vIEEgcGF0dGVybiBvZiBvZmZsaW5lLWxpa2UgZmFpbHVyZXMgdGhhdCBzdWdnZXN0cyBpdHMgYWN0dWFsbHkgYSBDT1JzIGVycm9yXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgZGV0ZWN0cyBDT1JTLWxpa2UgZXJyb3JzOyByZW1vdmluZyByZXF1ZXN0JywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ29mZmxpbmUnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gV3JpdGUgdGhlIHN5bmMgZXZlbnQgYmFjayB0byB0aGUgZGF0YWJhc2UgaWYgd2UgaGF2ZW4ndCBjb21wbGV0ZWQgcHJvY2Vzc2luZyBpdFxuICAgIGlmICh0aGlzLnF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xIHx8IHRoaXMucmVjZWlwdFF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xKSB7XG4gICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIud3JpdGVTeW5jRXZlbnRzKFtyZXF1ZXN0RXZ0XSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIHNlcnZlciB1bmF2YWlsYWJsZSBlcnJvci5cbiAgICpcbiAgICogSW4gdGhlIGV2ZW50IG9mIGEgNTAyIChCYWQgR2F0ZXdheSksIDUwMyAoc2VydmljZSB1bmF2YWlsYWJsZSlcbiAgICogb3IgNTA0IChnYXRld2F5IHRpbWVvdXQpIGVycm9yIGZyb20gdGhlIHNlcnZlclxuICAgKiBhc3N1bWUgd2UgaGF2ZSBhbiBlcnJvciB0aGF0IGlzIHNlbGYgY29ycmVjdGluZyBvbiB0aGUgc2VydmVyLlxuICAgKiBVc2UgZXhwb25lbnRpYWwgYmFja29mZiB0byByZXRyeSB0aGUgcmVxdWVzdC5cbiAgICpcbiAgICogTm90ZSB0aGF0IGVhY2ggY2FsbCB3aWxsIGluY3JlbWVudCByZXRyeUNvdW50OyB0aGVyZSBpcyBhIG1heGltdW1cbiAgICogb2YgTUFYX1JFVFJJRVMgYmVmb3JlIGl0IGlzIHRyZWF0ZWQgYXMgYW4gZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCAgX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgICAgICAgICAgICAgUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqL1xuICBfeGhySGFuZGxlU2VydmVyVW5hdmFpbGFibGVFcnJvcihyZXN1bHQpIHtcbiAgICB2YXIgcmVxdWVzdCA9IHJlc3VsdC5yZXF1ZXN0O1xuICAgIHRoaXMudHJpZ2dlcignc3luYzplcnJvci13aWxsLXJldHJ5Jywge1xuICAgICAgdGFyZ2V0OiByZXF1ZXN0LnRhcmdldCxcbiAgICAgIHJlcXVlc3Q6IHJlcXVlc3QsXG4gICAgICBlcnJvcjogcmVzdWx0LmRhdGEsXG4gICAgICByZXRyeUNvdW50OiByZXF1ZXN0LnJldHJ5Q291bnRcbiAgICB9KTtcbiAgICBjb25zdCBtYXhEZWxheSA9IFN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUO1xuICAgIGNvbnN0IGRlbGF5ID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyhtYXhEZWxheSwgTWF0aC5taW4oMTUsIHJlcXVlc3QucmV0cnlDb3VudCsrKSk7XG4gICAgbG9nZ2VyLndhcm4oYFN5bmMgTWFuYWdlciBTZXJ2ZXIgVW5hdmFpbGFibGU7IHJldHJ5IGNvdW50ICR7cmVxdWVzdC5yZXRyeUNvdW50fTsgcmV0cnlpbmcgaW4gJHtkZWxheX0gc2Vjb25kc2ApO1xuICAgIHNldFRpbWVvdXQodGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0LmJpbmQodGhpcyksIGRlbGF5ICogMTAwMCk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgc2VydmVyIGVycm9yIGluIHJlc3BvbnNlIHRvIGZpcmluZyBzeW5jIGV2ZW50LlxuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBhIHNlcnZlciBlcnJvciwgaXRzIHByZXN1bWFibHkgbm9uLXJlY292ZXJhYmxlL25vbi1yZXRyeWFibGUgZXJyb3IsIHNvXG4gICAqIHdlJ3JlIGdvaW5nIHRvIGFib3J0IHRoaXMgcmVxdWVzdC5cbiAgICpcbiAgICogMS4gSWYgYSBjYWxsYmFjayB3YXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgKiAyLiBJZiBhIHJvbGxiYWNrIGNhbGwgaXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gdW5kbyBhbnkgcGF0Y2gvZGVsZXRlL2V0Yy4uLiBjaGFuZ2VzXG4gICAqIDMuIElmIHRoZSByZXF1ZXN0IHdhcyB0byBjcmVhdGUgYSByZXNvdXJjZSwgcmVtb3ZlIGZyb20gdGhlIHF1ZXVlIGFsbCByZXF1ZXN0c1xuICAgKiAgICB0aGF0IGRlcGVuZGVkIHVwb24gdGhhdCByZXNvdXJjZS5cbiAgICogNC4gQWR2YW5jZSB0byBuZXh0IHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfeGhySGFuZGxlU2VydmVyRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbG9nTXNnIC0gTWVzc2FnZSB0byBkaXNwbGF5IGluIGNvbnNvbGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gc3RyaW5naWZ5IC0gbG9nIG9iamVjdCBmb3IgcXVpY2sgZGVidWdnaW5nXG4gICAqXG4gICAqL1xuICBfeGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCBsb2dNc2csIHN0cmluZ2lmeSkge1xuICAgIC8vIEV4ZWN1dGUgYWxsIGNhbGxiYWNrcyBwcm92aWRlZCBieSB0aGUgcmVxdWVzdFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5jYWxsYmFjaykgcmVzdWx0LnJlcXVlc3QuY2FsbGJhY2socmVzdWx0KTtcbiAgICBpZiAoc3RyaW5naWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IobG9nTXNnICtcbiAgICAgICAgJ1xcblJFUVVFU1Q6ICcgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQucmVxdWVzdC50b09iamVjdCgpLCBudWxsLCA0KSArXG4gICAgICAgICdcXG5SRVNQT05TRTogJyArIEpTT04uc3RyaW5naWZ5KHJlc3VsdC5kYXRhLCBudWxsLCA0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihsb2dNc2csIHJlc3VsdCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignc3luYzplcnJvcicsIHtcbiAgICAgIHRhcmdldDogcmVzdWx0LnJlcXVlc3QudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVzdWx0LnJlcXVlc3QsXG4gICAgICBlcnJvcjogcmVzdWx0LmRhdGEsXG4gICAgfSk7XG5cbiAgICByZXN1bHQucmVxdWVzdC5zdWNjZXNzID0gZmFsc2U7XG5cbiAgICAvLyBJZiBhIFBPU1QgcmVxdWVzdCBmYWlscywgYWxsIHJlcXVlc3RzIHRoYXQgZGVwZW5kIHVwb24gdGhpcyBvYmplY3RcbiAgICAvLyBtdXN0IGJlIHB1cmdlZFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5vcGVyYXRpb24gPT09ICdQT1NUJykge1xuICAgICAgdGhpcy5fcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0cyhyZXN1bHQucmVxdWVzdCk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHRoaXMgcmVxdWVzdCBhcyB3ZWxsIChzaWRlLWVmZmVjdDogcm9sbHMgYmFjayB0aGUgb3BlcmF0aW9uKVxuICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVzdWx0LnJlcXVlc3QsIHRydWUpO1xuXG4gICAgLy8gQW5kIGZpbmFsbHksIHdlIGFyZSByZWFkeSB0byB0cnkgdGhlIG5leHQgcmVxdWVzdFxuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiBlcnJvciwgd2FpdCBmb3IgcmV0cnkuXG4gICAqXG4gICAqIEluIHRoZSBldmVudCBvZiB3aGF0IGFwcGVhcnMgdG8gYmUgYSBjb25uZWN0aW9uIGVycm9yLFxuICAgKiBXYWl0IHVudGlsIGEgJ2Nvbm5lY3RlZCcgZXZlbnQgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIG5leHQgcmVxdWVzdCAoYWN0dWFsbHkgcmVwcm9jZXNzaW5nIHRoZSBjdXJyZW50IGV2ZW50KVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKSB7XG4gICAgLy8gTm90aGluZyB0byBiZSBkb25lOyB3ZSBhbHJlYWR5IGhhdmUgdGhlIGJlbG93IGV2ZW50IGhhbmRsZXIgc2V0dXBcbiAgICAvLyB0aGlzLm9ubGluZU1hbmFnZXIub25jZSgnY29ubmVjdGVkJywgKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmeSB0aGF0IHdlIGFyZSBvbmxpbmUgYW5kIHJldHJ5IHJlcXVlc3QuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGNhbGxlZCB3aGVuIHdlIHRoaW5rIHdlJ3JlIG9ubGluZSwgYnV0XG4gICAqIGhhdmUgZGV0ZXJtaW5lZCB3ZSBuZWVkIHRvIHZhbGlkYXRlIHRoYXQgYXNzdW1wdGlvbi5cbiAgICpcbiAgICogVGVzdCB0aGF0IHdlIGhhdmUgYSBjb25uZWN0aW9uOyBpZiB3ZSBkbyxcbiAgICogcmV0cnkgdGhlIHJlcXVlc3Qgb25jZSwgYW5kIGlmIGl0IGZhaWxzIGFnYWluLFxuICAgKiBfeGhyRXJyb3IoKSB3aWxsIGRldGVybWluZSBpdCB0byBoYXZlIGZhaWxlZCBhbmQgcmVtb3ZlIGl0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgdGhlbiBsZXQgX3hockhhbmRsZUNvbm5lY3Rpb25FcnJvciBoYW5kbGUgaXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJWYWxpZGF0ZUlzT25saW5lKHJlcXVlc3RFdnQpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1N5bmMgTWFuYWdlciB2ZXJpZnlpbmcgb25saW5lIHN0YXRlJyk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLmNoZWNrT25saW5lU3RhdHVzKGlzT25saW5lID0+IHRoaXMuX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHdlIGhhdmUgdmVyaWZpZWQgd2UgYXJlIG9ubGluZSwgcmV0cnkgcmVxdWVzdC5cbiAgICpcbiAgICogV2Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSByZXNwb25zZSB0byBvdXIgL25vbmNlcyBjYWxsXG4gICAqIHdoaWNoIGFzc3VtaW5nIHRoZSBzZXJ2ZXIgaXMgYWN0dWFsbHkgYWxpdmUsXG4gICAqIHdpbGwgdGVsbCB1cyBpZiB0aGUgY29ubmVjdGlvbiBpcyB3b3JraW5nLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgZmxhZyB1cyBhcyBvZmZsaW5lIGFuZCBsZXQgdGhlIENvbm5lY3Rpb25FcnJvciBoYW5kbGVyIGhhbmRsZSB0aGlzXG4gICAqIElmIHdlIGFyZSBvbmxpbmUsIGdpdmUgdGhlIHJlcXVlc3QgYSBzaW5nbGUgcmV0cnkgKHRoZXJlIGlzIG5ldmVyIG1vcmUgdGhhbiBvbmUgcmV0cnkpXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFja1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtib29sZWFufSBpc09ubGluZSAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBUaGUgcmVxdWVzdCB0aGF0IGZhaWxlZCB0cmlnZ2VyaW5nIHRoaXMgY2FsbFxuICAgKi9cbiAgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnU3luYyBNYW5hZ2VyIG9ubGluZSBjaGVjayByZXN1bHQgaXMgJyArIGlzT25saW5lKTtcbiAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAvLyBUcmVhdCB0aGlzIGFzIGEgQ29ubmVjdGlvbiBFcnJvclxuICAgICAgdGhpcy5feGhySGFuZGxlQ29ubmVjdGlvbkVycm9yKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJldHJ5IHRoZSByZXF1ZXN0IGluIGNhc2Ugd2Ugd2VyZSBvZmZsaW5lLCBidXQgYXJlIG5vdyBvbmxpbmUuXG4gICAgICAvLyBPZiBjb3Vyc2UsIGlmIHRoaXMgZmFpbHMsIGdpdmUgaXQgdXAgZW50aXJlbHkuXG4gICAgICByZXF1ZXN0RXZ0LnJldHJ5Q291bnQrKztcbiAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgWEhSIHJlcXVlc3Qgd2FzIHN1Y2Nlc3NmdWwuXG4gICAqXG4gICAqIEFueSB4aHIgcmVxdWVzdCB0aGF0IGFjdHVhbGx5IHN1Y2NlZGVzOlxuICAgKlxuICAgKiAxLiBSZW1vdmUgaXQgZnJvbSB0aGUgcXVldWVcbiAgICogMi4gQ2FsbCBhbnkgY2FsbGJhY2tzXG4gICAqIDMuIEFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hoclN1Y2Nlc3NcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICBfeGhyU3VjY2VzcyhyZXN1bHQpIHtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gcmVzdWx0LnJlcXVlc3Q7XG4gICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgJHtyZXF1ZXN0RXZ0IGluc3RhbmNlb2YgV2Vic29ja2V0U3luY0V2ZW50ID8gJ1dlYnNvY2tldCcgOiAnWEhSJ30gYCArXG4gICAgICBgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gUmVxdWVzdCBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH0gaGFzIFN1Y2NlZWRlZGAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgaWYgKHJlc3VsdC5kYXRhKSBsb2dnZXIuZGVidWcocmVzdWx0LmRhdGEpO1xuICAgIHJlcXVlc3RFdnQuc3VjY2VzcyA9IHRydWU7XG4gICAgdGhpcy5fcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCB0cnVlKTtcbiAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdzeW5jOnN1Y2Nlc3MnLCB7XG4gICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVxdWVzdEV2dCxcbiAgICAgIHJlc3BvbnNlOiByZXN1bHQuZGF0YSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIFN5bmNFdmVudCByZXF1ZXN0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVSZXF1ZXN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFN5bmNFdmVudCBSZXF1ZXN0IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGRlbGV0ZURCIC0gRGVsZXRlIGZyb20gaW5kZXhlZERCXG4gICAqL1xuICBfcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCBkZWxldGVEQikge1xuICAgIGNvbnN0IHF1ZXVlID0gcmVxdWVzdEV2dC5vcGVyYXRpb24gPT09ICdSRUNFSVBUJyA/IHRoaXMucmVjZWlwdFF1ZXVlIDogdGhpcy5xdWV1ZTtcbiAgICBjb25zdCBpbmRleCA9IHF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkgcXVldWUuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBpZiAoZGVsZXRlREIpIHRoaXMuY2xpZW50LmRiTWFuYWdlci5kZWxldGVPYmplY3RzKCdzeW5jUXVldWUnLCBbcmVxdWVzdEV2dF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSByZXF1ZXN0cyBmcm9tIHF1ZXVlIHRoYXQgZGVwZW5kIG9uIHNwZWNpZmllZCByZXNvdXJjZS5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYSBQT1NUIHJlcXVlc3QgdG8gY3JlYXRlIGEgbmV3IHJlc291cmNlLCBhbmQgdGhlcmUgYXJlIFBBVENILCBERUxFVEUsIGV0Yy4uLlxuICAgKiByZXF1ZXN0cyBvbiB0aGF0IHJlc291cmNlLCBpZiB0aGUgUE9TVCByZXF1ZXN0IGZhaWxzLCB0aGVuIGFsbCBQQVRDSCwgREVMRVRFLCBldGNcbiAgICogcmVxdWVzdHMgbXVzdCBiZSByZW1vdmVkIGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgd2UgZG8gbm90IGNhbGwgdGhlIHJvbGxiYWNrIG9uIHRoZXNlIGRlcGVuZGVudCByZXF1ZXN0cyBiZWNhdXNlIHRoZSBleHBlY3RlZFxuICAgKiByb2xsYmFjayBpcyB0byBkZXN0cm95IHRoZSB0aGluZyB0aGF0IHdhcyBjcmVhdGVkLCB3aGljaCBtZWFucyBhbnkgb3RoZXIgcm9sbGJhY2sgaGFzIG5vIGVmZmVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3QgLSBSZXF1ZXN0IHdob3NlIHRhcmdldCBpcyBubyBsb25nZXIgdmFsaWRcbiAgICovXG4gIF9wdXJnZURlcGVuZGVudFJlcXVlc3RzKHJlcXVlc3QpIHtcbiAgICB0aGlzLnF1ZXVlID0gdGhpcy5xdWV1ZS5maWx0ZXIoZXZ0ID0+IGV2dC5kZXBlbmRzLmluZGV4T2YocmVxdWVzdC50YXJnZXQpID09PSAtMSB8fCBldnQgPT09IHJlcXVlc3QpO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gdGhpcy5yZWNlaXB0UXVldWUuZmlsdGVyKGV2dCA9PiBldnQuZGVwZW5kcy5pbmRleE9mKHJlcXVlc3QudGFyZ2V0KSA9PT0gLTEgfHwgZXZ0ID09PSByZXF1ZXN0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBmcm9tIHF1ZXVlIGFsbCBldmVudHMgdGhhdCBvcGVyYXRlIHVwb24gdGhlIGRlbGV0ZWQgb2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wdXJnZU9uRGVsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gRGVsZXRlIGV2ZW50IHRoYXQgcmVxdWlyZXMgcmVtb3ZhbCBvZiBvdGhlciBldmVudHNcbiAgICovXG4gIF9wdXJnZU9uRGVsZXRlKGV2dCkge1xuICAgIHRoaXMucXVldWUuZmlsdGVyKHJlcXVlc3QgPT4gcmVxdWVzdC5kZXBlbmRzLmluZGV4T2YoZXZ0LnRhcmdldCkgIT09IC0xICYmIGV2dCAhPT0gcmVxdWVzdClcbiAgICAgIC5mb3JFYWNoKChyZXF1ZXN0RXZ0KSA9PiB7XG4gICAgICAgIHRoaXMudHJpZ2dlcignc3luYzphYm9ydCcsIHtcbiAgICAgICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RFdnQsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9yZW1vdmVSZXF1ZXN0KHJlcXVlc3RFdnQsIHRydWUpO1xuICAgICAgfSk7XG4gIH1cblxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5xdWV1ZS5mb3JFYWNoKGV2dCA9PiBldnQuZGVzdHJveSgpKTtcbiAgICB0aGlzLnF1ZXVlID0gbnVsbDtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKGV2dCA9PiBldnQuZGVzdHJveSgpKTtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZSA9IG51bGw7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYW55IHVuc2VudCByZXF1ZXN0cyBmcm9tIGluZGV4ZWREQi5cbiAgICpcbiAgICogSWYgcGVyc2lzdGVuY2UgaXMgZGlzYWJsZWQsIG5vdGhpbmcgd2lsbCBoYXBwZW47XG4gICAqIGVsc2UgYWxsIHJlcXVlc3RzIGZvdW5kIGluIHRoZSBkYXRhYmFzZSB3aWxsIGJlIGFkZGVkIHRvIHRoZSBxdWV1ZS5cbiAgICogQG1ldGhvZCBfbG9hZFBlcnNpc3RlZFF1ZXVlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbG9hZFBlcnNpc3RlZFF1ZXVlKCkge1xuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkU3luY1F1ZXVlKChkYXRhKSA9PiB7XG4gICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IHRoaXMucXVldWUuY29uY2F0KGRhdGEpO1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIFdlYnNvY2tldCBNYW5hZ2VyIGZvciBnZXR0aW5nIHNvY2tldCBzdGF0ZS5cbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWJzb2NrZXQgUmVxdWVzdCBNYW5hZ2VyIGZvciBzZW5kaW5nIHJlcXVlc3RzLlxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZXF1ZXN0TWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIHRoZSBPbmxpbmUgU3RhdGUgTWFuYWdlci5cbiAqXG4gKiBTeW5jIE1hbmFnZXIgdXNlcyBvbmxpbmUgc3RhdHVzIHRvIGRldGVybWluZSBpZiBpdCBjYW4gZmlyZSBzeW5jLXJlcXVlc3RzLlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5vbmxpbmVNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqIEB0eXBlIHtsYXllci5TeW5jRXZlbnRbXX1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnF1ZXVlID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqXG4gKiBSZWNlaXB0cyBjYW4gZ2VuZXJhbGx5IGp1c3QgYmUgZmlyZWQgb2ZmIGFsbCBhdCBvbmNlIHdpdGhvdXQgbXVjaCBmcmV0dGluZyBhYm91dCBvcmRlcmluZyBvciBkZXBlbmRlbmNpZXMuXG4gKiBAdHlwZSB7bGF5ZXIuU3luY0V2ZW50W119XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZWNlaXB0UXVldWUgPSBudWxsO1xuXG4vKipcbiAqIFJlZmVyZW5jZSB0byB0aGUgQ2xpZW50IHNvIHRoYXQgd2UgY2FuIHBhc3MgaXQgdG8gU3luY0V2ZW50cyAgd2hpY2ggbWF5IG5lZWQgdG8gbG9va3VwIHRoZWlyIHRhcmdldHNcbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogTWF4aW11bSBleHBvbmVudGlhbCBiYWNrb2ZmIHdhaXQuXG4gKlxuICogSWYgdGhlIHNlcnZlciBpcyByZXR1cm5pbmcgNTAyLCA1MDMgb3IgNTA0IGVycm9ycywgZXhwb25lbnRpYWwgYmFja29mZlxuICogc2hvdWxkIG5ldmVyIHdhaXQgbG9uZ2VyIHRoYW4gdGhpcyBudW1iZXIgb2Ygc2Vjb25kcyAoNjAgc2Vjb25kcylcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUID0gNjA7XG5cbi8qKlxuICogUmV0cmllcyBiZWZvcmUgc3VzcGVjdCBDT1JTIGVycm9yLlxuICpcbiAqIEhvdyBtYW55IHRpbWVzIGNhbiB3ZSB0cmFuc2l0aW9uIGZyb20gb2ZmbGluZSB0byBvbmxpbmUgc3RhdGVcbiAqIHdpdGggdGhpcyByZXF1ZXN0IGF0IHRoZSBmcm9udCBvZiB0aGUgcXVldWUgYmVmb3JlIHdlIGNvbmNsdWRlXG4gKiB0aGF0IHRoZSByZWFzb24gd2Uga2VlcCB0aGlua2luZyB3ZSdyZSBnb2luZyBvZmZsaW5lIGlzXG4gKiBhIENPUlMgZXJyb3IgcmV0dXJuaW5nIGEgc3RhdHVzIG9mIDAuICBJZiB0aGF0IHBhdHRlcm5cbiAqIHNob3dzIDMgdGltZXMgaW4gYSByb3csIHRoZXJlIGlzIGxpa2VseSBhIENPUlMgZXJyb3IuXG4gKiBOb3RlIHRoYXQgQ09SUyBlcnJvcnMgYXBwZWFyIHRvIGphdmFzY3JpcHQgYXMgYSBzdGF0dXM9MCBlcnJvcixcbiAqIHdoaWNoIGlzIHRoZSBzYW1lIGFzIGlmIHRoZSBjbGllbnQgd2VyZSBvZmZsaW5lLlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuU3luY01hbmFnZXIuTUFYX1JFVFJJRVNfQkVGT1JFX0NPUlNfRVJST1IgPSAzO1xuXG4vKipcbiAqIEFib3J0IHJlcXVlc3QgYWZ0ZXIgdGhpcyBudW1iZXIgb2YgcmV0cmllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5TeW5jTWFuYWdlci5NQVhfUkVUUklFUyA9IDIwO1xuXG5cblN5bmNNYW5hZ2VyLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBBIHN5bmMgcmVxdWVzdCBoYXMgZmFpbGVkLlxuICAgKlxuICAgKiBgYGBcbiAgICogY2xpZW50LnN5bmNNYW5hZ2VyLm9uKCdzeW5jOmVycm9yJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIGNvbnNvbGUuZXJyb3IoZXZ0LnRhcmdldCArICcgZmFpbGVkIHRvIHNlbmQgY2hhbmdlcyB0byBzZXJ2ZXI6ICcsIGV2dC5lcnJvci5tZXNzYWdlKTtcbiAgICogICAgY29uc29sZS5sb2coJ1JlcXVlc3QgRXZlbnQ6JywgZXZ0LnJlcXVlc3QpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dCAgICAgICAgICBTdGFuZGFyZCBMYXllciBFdmVudCBvYmplY3QgZ2VuZXJhdGVkIGJ5IGFsbCBjYWxscyB0byBgdHJpZ2dlcmBcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZXJyb3IgICAgQW4gZXJyb3Igb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgc2VydmVyJ3MgcmVzcG9uc2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2dC50YXJnZXQgICAgICAgICAgICAgSUQgb2YgdGhlIG1lc3NhZ2UvY29udmVyc2F0aW9uL2V0Yy4gYmVpbmcgb3BlcmF0ZWQgdXBvblxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gZXZ0LnJlcXVlc3QgIFRoZSBvcmlnaW5hbCByZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgJ3N5bmM6ZXJyb3InLFxuXG4gIC8qKlxuICAgKiBBIHN5bmMgcmVxdWVzdCBoYXMgYnV0IHdpbGwgYmUgcmV0cmllZCBzb29uLlxuICAgKlxuICAgKiBgYGBcbiAgICogY2xpZW50LnN5bmNNYW5hZ2VyLm9uKCdzeW5jOmVycm9yLXdpbGwtcmV0cnknLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgY29uc29sZS5lcnJvcihldnQudGFyZ2V0ICsgJyBmYWlsZWQgdG8gc2VuZCBjaGFuZ2VzIHRvIHNlcnZlcjogJywgZXZ0LmVycm9yLm1lc3NhZ2UpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCBldnQucmVxdWVzdCk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdOdW1iZXIgb2YgcmV0cmllczonLCBldnQucmV0cnlDb3VudCk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0ICAgICAgICAgIFN0YW5kYXJkIExheWVyIEV2ZW50IG9iamVjdCBnZW5lcmF0ZWQgYnkgYWxsIGNhbGxzIHRvIGB0cmlnZ2VyYFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2dC5lcnJvciAgICBBbiBlcnJvciBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBzZXJ2ZXIncyByZXNwb25zZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZ0LnRhcmdldCAgICAgICAgICAgICBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSBldnQucmVxdWVzdCAgIFRoZSBvcmlnaW5hbCByZXF1ZXN0IG9iamVjdFxuICAgKiBAcGFyYW0ge051bWJlcn0gZXZ0LnJldHJ5Q291bnQgICAgICAgICBOdW1iZXIgb2YgcmV0cmllcyBwZXJmb3JtZWQgb24gdGhpcyByZXF1ZXN0OyBmb3IgdGhlIGZpcnN0IGV2ZW50IHRoaXMgd2lsbCBiZSAwXG4gICAqL1xuICAnc3luYzplcnJvci13aWxsLXJldHJ5JyxcblxuICAvKipcbiAgICogQSBzeW5jIGxheWVyIHJlcXVlc3QgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6c3VjY2VzcycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBjb25zb2xlLmxvZyhldnQudGFyZ2V0ICsgJyBjaGFuZ2VzIHNlbnQgdG8gc2VydmVyIHN1Y2Nlc3NmdWxseScpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCBldnQucmVxdWVzdCk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdTZXJ2ZXIgUmVzcG9uc2U6JywgZXZ0LnJlc3BvbnNlKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgICAgICAgICAgU3RhbmRhcmQgTGF5ZXIgRXZlbnQgb2JqZWN0IGdlbmVyYXRlZCBieSBhbGwgY2FsbHMgdG8gYHRyaWdnZXJgXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldnQudGFyZ2V0ICAgICAgICAgICAgIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dC5yZXF1ZXN0ICAgVGhlIG9yaWdpbmFsIHJlcXVlc3RcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2dC5yZXNwb25zZSAgICAgICAgICAgbnVsbCBvciBhbnkgZGF0YSByZXR1cm5lZCBieSB0aGUgY2FsbFxuICAgKi9cbiAgJ3N5bmM6c3VjY2VzcycsXG5cbiAgLyoqXG4gICAqIEEgbmV3IHN5bmMgcmVxdWVzdCBoYXMgYmVlbiBhZGRlZC5cbiAgICpcbiAgICogYGBgXG4gICAqIGNsaWVudC5zeW5jTWFuYWdlci5vbignc3luYzphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgY29uc29sZS5sb2coZXZ0LnRhcmdldCArICcgaGFzIGNoYW5nZXMgcXVldWVkIGZvciB0aGUgc2VydmVyJyk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdSZXF1ZXN0IEV2ZW50OicsIGV2dC5yZXF1ZXN0KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgICAgICAgICAgU3RhbmRhcmQgTGF5ZXIgRXZlbnQgb2JqZWN0IGdlbmVyYXRlZCBieSBhbGwgY2FsbHMgdG8gYHRyaWdnZXJgXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldnQudGFyZ2V0ICAgICAgICAgICAgIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dC5yZXF1ZXN0ICAgVGhlIG9yaWdpbmFsIHJlcXVlc3RcbiAgICovXG4gICdzeW5jOmFkZCcsXG5cbiAgLyoqXG4gICAqIEEgc3luYyByZXF1ZXN0IGhhcyBiZWVuIGNhbmNlbGVkLlxuICAgKlxuICAgKiBUeXBpY2FsbHkgY2F1c2VkIGJ5IGEgbmV3IFN5bmNFdmVudCB0aGF0IGRlbGV0ZXMgdGhlIHRhcmdldCBvZiB0aGlzIFN5bmNFdmVudFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgICAgICAgICAgU3RhbmRhcmQgTGF5ZXIgRXZlbnQgb2JqZWN0IGdlbmVyYXRlZCBieSBhbGwgY2FsbHMgdG8gYHRyaWdnZXJgXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldnQudGFyZ2V0ICAgICAgICAgICAgIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dC5yZXF1ZXN0ICAgVGhlIG9yaWdpbmFsIHJlcXVlc3RcbiAgICovXG4gICdzeW5jOmFib3J0Jyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzKFN5bmNNYW5hZ2VyKTtcbm1vZHVsZS5leHBvcnRzID0gU3luY01hbmFnZXI7XG4iXX0=
