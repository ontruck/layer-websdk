'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Layer Client.  Access the layer by calling create and receiving it
 * from the "ready" callback.

  var client = new layer.Client({
    appId: "layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff",
    isTrustedDevice: false,
    challenge: function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    },
    ready: function(client) {
      alert("Yay, I finally got my client!");
    }
  }).connect("sampleuserId");

 * The Layer Client/ClientAuthenticator classes have been divided into:
 *
 * 1. ClientAuthenticator: Manages all authentication and connectivity related issues
 * 2. Client: Manages access to Conversations, Queries, Messages, Events, etc...
 *
 * @class layer.ClientAuthenticator
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 *
 */

var xhr = require('./xhr');
var Root = require('./root');
var SocketManager = require('./websockets/socket-manager');
var WebsocketChangeManager = require('./websockets/change-manager');
var WebsocketRequestManager = require('./websockets/request-manager');
var LayerError = require('./layer-error');
var OnlineManager = require('./online-state-manager');
var SyncManager = require('./sync-manager');
var DbManager = require('./db-manager');
var Identity = require('./models/identity');

var _require = require('./sync-event'),
    XHRSyncEvent = _require.XHRSyncEvent,
    WebsocketSyncEvent = _require.WebsocketSyncEvent;

var _require2 = require('./const'),
    ACCEPT = _require2.ACCEPT,
    LOCALSTORAGE_KEYS = _require2.LOCALSTORAGE_KEYS;

var logger = require('./logger');
var Util = require('./client-utils');

var MAX_XHR_RETRIES = 3;

var ClientAuthenticator = function (_Root) {
  _inherits(ClientAuthenticator, _Root);

  /**
   * Create a new Client.
   *
   * The appId is the only required parameter:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid"
   *      });
   *
   * For trusted devices, you can enable storage of data to indexedDB and localStorage with the `isTrustedDevice` and `isPersistenceEnabled` property:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid",
   *          isTrustedDevice: true,
   *          isPersistenceEnabled: true
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.appId           - "layer:///apps/production/uuid"; Identifies what
   *                                            application we are connecting to.
   * @param  {string} [options.url=https://api.layer.com] - URL to log into a different REST server
   * @param {number} [options.logLevel=ERROR] - Provide a log level that is one of layer.Constants.LOG.NONE, layer.Constants.LOG.ERROR,
   *                                            layer.Constants.LOG.WARN, layer.Constants.LOG.INFO, layer.Constants.LOG.DEBUG
   * @param {boolean} [options.isTrustedDevice=false] - If this is not a trusted device, no data will be written to indexedDB nor localStorage,
   *                                            regardless of any values in layer.Client.persistenceFeatures.
   * @param {Object} [options.isPersistenceEnabled=false] If layer.Client.isPersistenceEnabled is true, then indexedDB will be used to manage a cache
   *                                            allowing Query results, messages sent, and all local modifications to be persisted between page reloads.
   */
  function ClientAuthenticator(options) {
    _classCallCheck(this, ClientAuthenticator);

    // Validate required parameters
    if (!options.appId) throw new Error(LayerError.dictionary.appIdMissing);

    return _possibleConstructorReturn(this, (ClientAuthenticator.__proto__ || Object.getPrototypeOf(ClientAuthenticator)).call(this, options));
  }

  /**
   * Initialize the subcomponents of the ClientAuthenticator
   *
   * @method _initComponents
   * @private
   */


  _createClass(ClientAuthenticator, [{
    key: '_initComponents',
    value: function _initComponents() {
      // Setup the websocket manager; won't connect until we trigger an authenticated event
      this.socketManager = new SocketManager({
        client: this
      });

      this.socketChangeManager = new WebsocketChangeManager({
        client: this,
        socketManager: this.socketManager
      });

      this.socketRequestManager = new WebsocketRequestManager({
        client: this,
        socketManager: this.socketManager
      });

      this.onlineManager = new OnlineManager({
        socketManager: this.socketManager,
        testUrl: this.url + '/nonces?connection-test',
        connected: this._handleOnlineChange.bind(this),
        disconnected: this._handleOnlineChange.bind(this)
      });

      this.syncManager = new SyncManager({
        onlineManager: this.onlineManager,
        socketManager: this.socketManager,
        requestManager: this.socketRequestManager,
        client: this
      });
    }

    /**
     * Destroy the subcomponents of the ClientAuthenticator
     *
     * @method _destroyComponents
     * @private
     */

  }, {
    key: '_destroyComponents',
    value: function _destroyComponents() {
      this.syncManager.destroy();
      this.onlineManager.destroy();
      this.socketManager.destroy();
      this.socketChangeManager.destroy();
      this.socketRequestManager.destroy();
      if (this.dbManager) this.dbManager.destroy();
    }

    /**
     * Is Persisted Session Tokens disabled?
     *
     * @method _isPersistedSessionsDisabled
     * @returns {Boolean}
     * @private
     */

  }, {
    key: '_isPersistedSessionsDisabled',
    value: function _isPersistedSessionsDisabled() {
      return !global.localStorage || this.persistenceFeatures && !this.persistenceFeatures.sessionToken;
    }

    /**
     * Restore the sessionToken from localStorage.
     *
     * This sets the sessionToken rather than returning the token.
     *
     * @method _restoreLastSession
     * @private
     */

  }, {
    key: '_restoreLastSession',
    value: function _restoreLastSession() {
      if (this._isPersistedSessionsDisabled()) return;
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return;
        var parsedData = JSON.parse(sessionData);
        if (parsedData.expires < Date.now()) {
          global.localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        } else {
          this.sessionToken = parsedData.sessionToken;
        }
      } catch (error) {
        // No-op
      }
    }

    /**
       * Restore the Identity for the session owner from localStorage.
       *
       * @method _restoreLastSession
       * @private
       * @return {layer.Identity}
       */

  }, {
    key: '_restoreLastUser',
    value: function _restoreLastUser() {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return null;
        var userObj = JSON.parse(sessionData).user;
        return new Identity({
          clientId: this.appId,
          sessionOwner: true,
          fromServer: userObj
        });
      } catch (error) {
        return null;
      }
    }

    /**
     * Has the userID changed since the last login?
     *
     * @method _hasUserIdChanged
     * @param {string} userId
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_hasUserIdChanged',
    value: function _hasUserIdChanged(userId) {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return true;
        return JSON.parse(sessionData).user.user_id !== userId;
      } catch (error) {
        return true;
      }
    }

    /**
     * Initiates the connection.
     *
     * Called by constructor().
     *
     * Will either attempt to validate the cached sessionToken by getting conversations,
     * or if no sessionToken, will call /nonces to start process of getting a new one.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connect('Frodo-the-Dodo');
     * ```
     *
     * @method connect
     * @param {string} userId - User ID of the user you are logging in as
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      var userId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      var user = void 0;
      this.isConnected = false;
      this.user = null;
      this.onlineManager.start();
      if (!this.isTrustedDevice || !userId || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }

      if (this.isTrustedDevice && userId) {
        this._restoreLastSession(userId);
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: userId ? Identity.prefixUUID + encodeURIComponent(userId) : ''
        });
      }

      if (this.sessionToken && this.user.userId) {
        this._sessionTokenRestored();
      } else {
        this.xhr({
          url: '/nonces',
          method: 'POST',
          sync: false
        }, function (result) {
          return _this2._connectionResponse(result);
        });
      }
      return this;
    }

    /**
     * Initiates the connection with a session token.
     *
     * This call is for use when you have received a Session Token from some other source; such as your server,
     * and wish to use that instead of doing a full auth process.
     *
     * The Client will presume the token to be valid, and will asynchronously trigger the `ready` event.
     * If the token provided is NOT valid, this won't be detected until a request is made using this token,
     * at which point the `challenge` method will trigger.
     *
     * NOTE: The `connected` event will not be triggered on this path.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connectWithSession('Frodo-the-Dodo', mySessionToken);
     * ```
     *
     * @method connectWithSession
     * @param {String} userId
     * @param {String} sessionToken
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connectWithSession',
    value: function connectWithSession(userId, sessionToken) {
      var _this3 = this;

      var user = void 0;
      this.user = null;
      if (!userId || !sessionToken) throw new Error(LayerError.dictionary.sessionAndUserRequired);
      if (!this.isTrustedDevice || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }
      if (this.isTrustedDevice) {
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      this.onlineManager.start();

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: Identity.prefixUUID + encodeURIComponent(userId)
        });
      }

      this.isConnected = true;
      setTimeout(function () {
        return _this3._authComplete({ session_token: sessionToken }, false);
      }, 1);
      return this;
    }

    /**
     * Called when our request for a nonce gets a response.
     *
     * If there is an error, calls _connectionError.
     *
     * If there is nonce, calls _connectionComplete.
     *
     * @method _connectionResponse
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_connectionResponse',
    value: function _connectionResponse(result) {
      if (!result.success) {
        this._connectionError(result.data);
      } else {
        this._connectionComplete(result.data);
      }
    }

    /**
     * We are now connected (we have a nonce).
     *
     * If we have successfully retrieved a nonce, then
     * we have entered a "connected" but not "authenticated" state.
     * Set the state, trigger any events, and then start authentication.
     *
     * @method _connectionComplete
     * @private
     * @param  {Object} result
     * @param  {string} result.nonce - The nonce provided by the server
     *
     * @fires connected
     */

  }, {
    key: '_connectionComplete',
    value: function _connectionComplete(result) {
      this.isConnected = true;
      this.trigger('connected');
      this._authenticate(result.nonce);
    }

    /**
     * Called when we fail to get a nonce.
     *
     * @method _connectionError
     * @private
     * @param  {layer.LayerError} err
     *
     * @fires connected-error
     */

  }, {
    key: '_connectionError',
    value: function _connectionError(error) {
      this.trigger('connected-error', { error: error });
    }

    /* CONNECT METHODS END */

    /* AUTHENTICATE METHODS BEGIN */

    /**
     * Start the authentication step.
     *
     * We start authentication by triggering a "challenge" event that
     * tells the app to use the nonce to obtain an identity_token.
     *
     * @method _authenticate
     * @private
     * @param  {string} nonce - The nonce to provide your identity provider service
     *
     * @fires challenge
     */

  }, {
    key: '_authenticate',
    value: function _authenticate(nonce) {
      if (nonce) {
        this.trigger('challenge', {
          nonce: nonce,
          callback: this.answerAuthenticationChallenge.bind(this)
        });
      }
    }

    /**
     * Accept an identityToken and use it to create a session.
     *
     * Typically, this method is called using the function pointer provided by
     * the challenge event, but it can also be called directly.
     *
     *      getIdentityToken(nonce, function(identityToken) {
     *          client.answerAuthenticationChallenge(identityToken);
     *      });
     *
     * @method answerAuthenticationChallenge
     * @param  {string} identityToken - Identity token provided by your identity provider service
     */

  }, {
    key: 'answerAuthenticationChallenge',
    value: function answerAuthenticationChallenge(identityToken) {
      var _this4 = this;

      // Report an error if no identityToken provided
      if (!identityToken) {
        throw new Error(LayerError.dictionary.identityTokenMissing);
      } else {
        var userData = Util.decode(identityToken.split('.')[1]);
        var identityObj = JSON.parse(userData);

        if (this.user.userId && this.user.userId !== identityObj.prn) {
          throw new Error(LayerError.dictionary.invalidUserIdChange);
        }

        this.user._setUserId(identityObj.prn);

        if (identityObj.display_name) this.user.displayName = identityObj.display_name;
        if (identityObj.avatar_url) this.user.avatarUrl = identityObj.avatar_url;

        this.xhr({
          url: '/sessions',
          method: 'POST',
          sync: false,
          data: {
            identity_token: identityToken,
            app_id: this.appId
          }
        }, function (result) {
          return _this4._authResponse(result, identityToken);
        });
      }
    }

    /**
     * Called when our request for a sessionToken receives a response.
     *
     * @private
     * @method _authResponse
     * @param  {Object} result
     * @param  {string} identityToken
     */

  }, {
    key: '_authResponse',
    value: function _authResponse(result, identityToken) {
      if (!result.success) {
        this._authError(result.data, identityToken);
      } else {
        this._authComplete(result.data, false);
      }
    }

    /**
     * Authentication is completed, update state and trigger events.
     *
     * @method _authComplete
     * @private
     * @param  {Object} result
     * @param  {Boolean} fromPersistence
     * @param  {string} result.session_token - Session token received from the server
     *
     * @fires authenticated
     */

  }, {
    key: '_authComplete',
    value: function _authComplete(result, fromPersistence) {
      if (!result || !result.session_token) {
        throw new Error(LayerError.dictionary.sessionTokenMissing);
      }
      this.sessionToken = result.session_token;

      // If _authComplete was called because we accepted an auth loaded from storage
      // we don't need to update storage.
      if (!this._isPersistedSessionsDisabled() && !fromPersistence) {
        try {
          global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId] = JSON.stringify({
            sessionToken: this.sessionToken || '',
            user: DbManager.prototype._getIdentityData([this.user], true)[0],
            expires: Date.now() + 30 * 60 * 60 * 24 * 1000
          });
        } catch (e) {
          // Do nothing
        }
      }

      this._clientAuthenticated();
    }

    /**
     * Authentication has failed.
     *
     * @method _authError
     * @private
     * @param  {layer.LayerError} result
     * @param  {string} identityToken Not currently used
     *
     * @fires authenticated-error
     */

  }, {
    key: '_authError',
    value: function _authError(error, identityToken) {
      this.trigger('authenticated-error', { error: error });
    }

    /**
     * Sets state and triggers events for both connected and authenticated.
     *
     * If reusing a sessionToken cached in localStorage,
     * use this method rather than _authComplete.
     *
     * @method _sessionTokenRestored
     * @private
     *
     * @fires connected, authenticated
     */

  }, {
    key: '_sessionTokenRestored',
    value: function _sessionTokenRestored() {
      this.isConnected = true;
      this.trigger('connected');
      this._clientAuthenticated();
    }

    /**
     * The client is now authenticated, and doing some setup
     * before calling _clientReady.
     *
     * @method _clientAuthenticated
     * @private
     */

  }, {
    key: '_clientAuthenticated',
    value: function _clientAuthenticated() {
      var _this5 = this;

      // Update state and trigger the event
      this.isAuthenticated = true;
      this.trigger('authenticated');

      if (!this.isTrustedDevice) this.isPersistenceEnabled = false;

      // If no persistenceFeatures are specified, set them all
      // to true or false to match isTrustedDevice.
      if (!this.persistenceFeatures || !this.isPersistenceEnabled) {
        var sessionToken = void 0;
        if (this.persistenceFeatures && 'sessionToken' in this.persistenceFeatures) {
          sessionToken = Boolean(this.persistenceFeatures.sessionToken);
        } else {
          sessionToken = this.isTrustedDevice;
        }
        this.persistenceFeatures = {
          conversations: this.isPersistenceEnabled,
          channels: this.isPersistenceEnabled,
          messages: this.isPersistenceEnabled,
          identities: this.isPersistenceEnabled,
          syncQueue: this.isPersistenceEnabled,
          sessionToken: sessionToken
        };
      }

      // Setup the Database Manager
      if (!this.dbManager) {
        this.dbManager = new DbManager({
          client: this,
          tables: this.persistenceFeatures
        });
      }

      // Before calling _clientReady, load the session owner's full Identity.
      if (this.isPersistenceEnabled) {
        this.dbManager.onOpen(function () {
          return _this5._loadUser();
        });
      } else {
        this._loadUser();
      }
    }

    /**
     * Load the session owner's full identity.
     *
     * Note that failure to load the identity will not prevent
     * _clientReady, but is certainly not a desired outcome.
     *
     * @method _loadUser
     */

  }, {
    key: '_loadUser',
    value: function _loadUser() {
      var _this6 = this;

      // We're done if we got the full identity from localStorage.
      if (this.user.isFullIdentity) {
        this._clientReady();
      } else {
        // load the user's full Identity and update localStorage
        this.user._load();
        this.user.once('identities:loaded', function () {
          if (!_this6._isPersistedSessionsDisabled()) {
            try {
              // Update the session data in localStorage with our full Identity.
              var sessionData = JSON.parse(global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId]);
              sessionData.user = DbManager.prototype._getIdentityData([_this6.user])[0];
              global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId] = JSON.stringify(sessionData);
            } catch (e) {
              // no-op
            }
          }
          _this6._clientReady();
        }).once('identities:loaded-error', function () {
          if (!_this6.user.displayName) _this6.user.displayName = _this6.defaultOwnerDisplayName;
          _this6._clientReady();
        });
      }
    }

    /**
     * Called to flag the client as ready for action.
     *
     * This method is called after authenication AND
     * after initial conversations have been loaded.
     *
     * @method _clientReady
     * @private
     * @fires ready
     */

  }, {
    key: '_clientReady',
    value: function _clientReady() {
      if (!this.isReady) {
        this.isReady = true;
        this.trigger('ready');
      }
    }

    /* CONNECT METHODS END */

    /* START SESSION MANAGEMENT METHODS */

    /**
     * Deletes your sessionToken from the server, and removes all user data from the Client.
     * Call `client.connect()` to restart the authentication process.
     *
     * This call is asynchronous; some browsers (ahem, safari...) may not have completed the deletion of
     * persisted data if you
     * navigate away from the page.  Use the callback to determine when all necessary cleanup has completed
     * prior to navigating away.
     *
     * Note that while all data should be purged from the browser/device, if you are offline when this is called,
     * your session token will NOT be deleted from the web server.  Why not? Because it would involve retaining the
     * request after all of the user's data has been deleted, or NOT deleting the user's data until we are online.
     *
     * @method logout
     * @param {Function} callback
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'logout',
    value: function logout(callback) {
      var callbackCount = 1,
          counter = 0;
      if (this.isAuthenticated) {
        callbackCount++;
        this.xhr({
          method: 'DELETE',
          url: '/sessions/' + escape(this.sessionToken),
          sync: false
        }, function () {
          counter++;
          if (counter === callbackCount && callback) callback();
        });
      }

      // Clear data even if isAuthenticated is false
      // Session may have expired, but data still cached.
      this._clearStoredData(function () {
        counter++;
        if (counter === callbackCount && callback) callback();
      });

      this._resetSession();
      return this;
    }
  }, {
    key: '_clearStoredData',
    value: function _clearStoredData(callback) {
      if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
      if (this.dbManager) {
        this.dbManager.deleteTables(callback);
      } else if (callback) {
        callback();
      }
    }

    /**
     * Log out/clear session information.
     *
     * Use this to clear the sessionToken and all information from this session.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this.isReady = false;
      if (this.sessionToken) {
        this.sessionToken = '';
        if (global.localStorage) {
          localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        }
      }

      this.isConnected = false;
      this.isAuthenticated = false;

      this.trigger('deauthenticated');
      this.onlineManager.stop();
    }

    /**
     * Register your IOS device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerIOSPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.iosVersion - Your IOS device's version number
     * @param {string} options.token - Your Apple APNS Token
     * @param {string} [options.bundleId] - Your Apple APNS Bundle ID ("com.layer.bundleid")
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerIOSPushToken',
    value: function registerIOSPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'apns',
          device_id: options.deviceId,
          ios_version: options.iosVersion,
          apns_bundle_id: options.bundleId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerAndroidPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.token - Your GCM push Token
     * @param {string} options.senderId - Your GCM Sender ID/Project Number
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerAndroidPushToken',
    value: function registerAndroidPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'gcm',
          device_id: options.deviceId,
          gcm_sender_id: options.senderId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method unregisterPushToken
     * @param {string} deviceId - Your IOS device's device ID
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'unregisterPushToken',
    value: function unregisterPushToken(deviceId, callback) {
      this.xhr({
        url: 'push_tokens/' + deviceId,
        method: 'DELETE'
      }, function (result) {
        return callback(result.data);
      });
    }

    /* SESSION MANAGEMENT METHODS END */

    /* ACCESSOR METHODS BEGIN */

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.userAppId = 'xxx'` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustAppId
     * @param {string} value - New appId value
     */

  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.isConnected) throw new Error(LayerError.dictionary.cantChangeIfConnected);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.user = userIdentity` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustUser
     * @param {string} user - new Identity object
     */

  }, {
    key: '__adjustUser',
    value: function __adjustUser(user) {
      if (this.isConnected) {
        throw new Error(LayerError.dictionary.cantChangeIfConnected);
      }
    }

    // Virtual methods

  }, {
    key: '_addIdentity',
    value: function _addIdentity(identity) {}
  }, {
    key: '_removeIdentity',
    value: function _removeIdentity(identity) {}

    /* ACCESSOR METHODS END */

    /* COMMUNICATIONS METHODS BEGIN */

  }, {
    key: 'sendSocketRequest',
    value: function sendSocketRequest(params, callback) {
      if (params.sync) {
        var target = params.sync.target;
        var depends = params.sync.depends;
        if (target && !depends) depends = [target];

        this.syncManager.request(new WebsocketSyncEvent({
          data: params.body,
          operation: params.method,
          target: target,
          depends: depends,
          callback: callback
        }));
      } else {
        if (typeof params.data === 'function') params.data = params.data();
        this.socketRequestManager.sendRequest(params, callback);
      }
    }

    /**
     * This event handler receives events from the Online State Manager and generates an event for those subscribed
     * to client.on('online')
     *
     * @method _handleOnlineChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleOnlineChange',
    value: function _handleOnlineChange(evt) {
      if (!this.isAuthenticated) return;
      var duration = evt.offlineDuration;
      var isOnline = evt.eventName === 'connected';
      var obj = { isOnline: isOnline };
      if (isOnline) {
        obj.reset = duration > ClientAuthenticator.ResetAfterOfflineDuration;
      }
      this.trigger('online', obj);
    }

    /**
     * Main entry point for sending xhr requests or for queing them in the syncManager.
     *
     * This call adjust arguments for our REST server.
     *
     * @method xhr
     * @protected
     * @param  {Object}   options
     * @param  {string}   options.url - URL relative client's url: "/conversations"
     * @param  {Function} callback
     * @param  {Object}   callback.result
     * @param  {Mixed}    callback.result.data - If an error occurred, this is a layer.LayerError;
     *                                          If the response was application/json, this will be an object
     *                                          If the response was text/empty, this will be text/empty
     * @param  {XMLHttpRequest} callback.result.xhr - Native xhr request object for detailed analysis
     * @param  {Object}         callback.result.Links - Hash of Link headers
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'xhr',
    value: function xhr(options, callback) {
      if (!options.sync || !options.sync.target) {
        options.url = this._xhrFixRelativeUrls(options.url || '');
      }

      options.withCredentials = true;
      if (!options.method) options.method = 'GET';
      if (!options.headers) options.headers = {};
      this._xhrFixHeaders(options.headers);
      this._xhrFixAuth(options.headers);

      // Note: this is not sync vs async; this is syncManager vs fire it now
      if (options.sync === false) {
        this._nonsyncXhr(options, callback, 0);
      } else {
        this._syncXhr(options, callback);
      }
      return this;
    }

    /**
     * For xhr calls that go through the sync manager, queue it up.
     *
     * @method _syncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     */

  }, {
    key: '_syncXhr',
    value: function _syncXhr(options, callback) {
      var _this7 = this;

      if (!options.sync) options.sync = {};
      var innerCallback = function innerCallback(result) {
        _this7._xhrResult(result, callback);
      };
      var target = options.sync.target;
      var depends = options.sync.depends;
      if (target && !depends) depends = [target];

      this.syncManager.request(new XHRSyncEvent({
        url: options.url,
        data: options.data,
        method: options.method,
        operation: options.sync.operation || options.method,
        headers: options.headers,
        callback: innerCallback,
        target: target,
        depends: depends
      }));
    }

    /**
     * For xhr calls that don't go through the sync manager,
     * fire the request, and if it fails, refire it up to 3 tries
     * before reporting an error.  1 second delay between requests
     * so whatever issue is occuring is a tiny bit more likely to resolve,
     * and so we don't hammer the server every time there's a problem.
     *
     * @method _nonsyncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     * @param  {number}   retryCount
     */

  }, {
    key: '_nonsyncXhr',
    value: function _nonsyncXhr(options, callback, retryCount) {
      var _this8 = this;

      xhr(options, function (result) {
        if ([502, 503, 504].indexOf(result.status) !== -1 && retryCount < MAX_XHR_RETRIES) {
          setTimeout(function () {
            return _this8._nonsyncXhr(options, callback, retryCount + 1);
          }, 1000);
        } else {
          _this8._xhrResult(result, callback);
        }
      });
    }

    /**
     * Fix authentication header for an xhr request
     *
     * @method _xhrFixAuth
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixAuth',
    value: function _xhrFixAuth(headers) {
      if (this.sessionToken && !headers.Authorization) {
        headers.authorization = 'Layer session-token="' + this.sessionToken + '"'; // eslint-disable-line
      }
    }

    /**
     * Fix relative URLs to create absolute URLs needed for CORS requests.
     *
     * @method _xhrFixRelativeUrls
     * @private
     * @param  {string} relative or absolute url
     * @return {string} absolute url
     */

  }, {
    key: '_xhrFixRelativeUrls',
    value: function _xhrFixRelativeUrls(url) {
      var result = url;
      if (url.indexOf('https://') === -1) {
        if (url[0] === '/') {
          result = this.url + url;
        } else {
          result = this.url + '/' + url;
        }
      }
      return result;
    }

    /**
     * Fixup all headers in preparation for an xhr call.
     *
     * 1. All headers use lower case names for standard/easy lookup
     * 2. Set the accept header
     * 3. If needed, set the content-type header
     *
     * @method _xhrFixHeaders
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixHeaders',
    value: function _xhrFixHeaders(headers) {
      // Replace all headers in arbitrary case with all lower case
      // for easy matching.
      var headerNameList = Object.keys(headers);
      headerNameList.forEach(function (headerName) {
        if (headerName !== headerName.toLowerCase()) {
          headers[headerName.toLowerCase()] = headers[headerName];
          delete headers[headerName];
        }
      });

      if (!headers.accept) headers.accept = ACCEPT;

      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }

    /**
     * Handle the result of an xhr call
     *
     * @method _xhrResult
     * @private
     * @param  {Object}   result     Standard xhr response object from the xhr lib
     * @param  {Function} [callback] Callback on completion
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, callback) {
      if (this.isDestroyed) return;

      if (!result.success) {
        // Replace the response with a LayerError instance
        if (result.data && _typeof(result.data) === 'object') {
          this._generateError(result);
        }

        // If its an authentication error, reauthenticate
        // don't call _resetSession as that wipes all data and screws with UIs, and the user
        // is still authenticated on the customer's app even if not on Layer.
        if (result.status === 401 && this.isAuthenticated) {
          logger.warn('SESSION EXPIRED!');
          this.isAuthenticated = false;
          if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
          this.trigger('deauthenticated');
          this._authenticate(result.data.getNonce());
        }
      }
      if (callback) callback(result);
    }

    /**
     * Transforms xhr error response into a layer.LayerError instance.
     *
     * Adds additional information to the result object including
     *
     * * url
     * * data
     *
     * @method _generateError
     * @private
     * @param  {Object} result - Result of the xhr call
     */

  }, {
    key: '_generateError',
    value: function _generateError(result) {
      result.data = new LayerError(result.data);
      if (!result.data.httpStatus) result.data.httpStatus = result.status;
      result.data.log();
    }

    /* END COMMUNICATIONS METHODS */

  }]);

  return ClientAuthenticator;
}(Root);

/**
 * State variable; indicates that client is currently authenticated by the server.
 * Should never be true if isConnected is false.
 * @type {Boolean}
 * @readonly
 */


ClientAuthenticator.prototype.isAuthenticated = false;

/**
 * State variable; indicates that client is currently connected to server
 * (may not be authenticated yet)
 * @type {Boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isConnected = false;

/**
 * State variable; indicates that client is ready for the app to use.
 * Use the 'ready' event to be notified when this value changes to true.
 *
 * @type {boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isReady = false;

/**
 * Your Layer Application ID. This value can not be changed once connected.
 * To find your Layer Application ID, see your Layer Developer Dashboard.
 *
 * @type {String}
 */
ClientAuthenticator.prototype.appId = '';

/**
 * Identity information about the authenticated user.
 *
 * @type {layer.Identity}
 */
ClientAuthenticator.prototype.user = null;

/**
 * Your current session token that authenticates your requests.
 *
 * @type {String}
 * @readonly
 */
ClientAuthenticator.prototype.sessionToken = '';

/**
 * URL to Layer's Web API server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.url = 'https://api.layer.com';

/**
 * URL to Layer's Websocket server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.websocketUrl = 'wss://websockets.layer.com';

/**
 * Web Socket Manager
 * @type {layer.Websockets.SocketManager}
 */
ClientAuthenticator.prototype.socketManager = null;

/**
 * Web Socket Request Manager
* @type {layer.Websockets.RequestManager}
 */
ClientAuthenticator.prototype.socketRequestManager = null;

/**
 * Web Socket Manager
 * @type {layer.Websockets.ChangeManager}
 */
ClientAuthenticator.prototype.socketChangeManager = null;

/**
 * Service for managing online as well as offline server requests
 * @type {layer.SyncManager}
 */
ClientAuthenticator.prototype.syncManager = null;

/**
 * Service for managing online/offline state and events
 * @type {layer.OnlineStateManager}
 */
ClientAuthenticator.prototype.onlineManager = null;

/**
 * If this is a trusted device, then we can write personal data to persistent memory.
 * @type {boolean}
 */
ClientAuthenticator.prototype.isTrustedDevice = false;

/**
 * To enable indexedDB storage of query data, set this true.  Experimental.
 *
 * @property {boolean}
 */
ClientAuthenticator.prototype.isPersistenceEnabled = false;

/**
 * If this layer.Client.isTrustedDevice is true, then you can control which types of data are persisted.
 *
 * Note that values here are ignored if `isPersistenceEnabled` hasn't been set to `true`.
 *
 * Properties of this Object can be:
 *
 * * identities: Write identities to indexedDB? This allows for faster initialization.
 * * conversations: Write conversations to indexedDB? This allows for faster rendering
 *                  of a Conversation List
 * * messages: Write messages to indexedDB? This allows for full offline access
 * * syncQueue: Write requests made while offline to indexedDB?  This allows the app
 *              to complete sending messages after being relaunched.
 * * sessionToken: Write the session token to localStorage for quick reauthentication on relaunching the app.
 *
 *      new layer.Client({
 *        isTrustedDevice: true,
 *        persistenceFeatures: {
 *          conversations: true,
 *          identities: true,
 *          messages: false,
 *          syncQueue: false,
 *          sessionToken: true
 *        }
 *      });
 *
 * @type {Object}
 */
ClientAuthenticator.prototype.persistenceFeatures = null;

/**
 * Database Manager for read/write to IndexedDB
 * @type {layer.DbManager}
 */
ClientAuthenticator.prototype.dbManager = null;

/**
 * If a display name is not loaded for the session owner, use this name.
 *
 * @type {string}
 */
ClientAuthenticator.prototype.defaultOwnerDisplayName = 'You';

/**
 * Is true if the client is authenticated and connected to the server;
 *
 * Typically used to determine if there is a connection to the server.
 *
 * Typically used in conjunction with the `online` event.
 *
 * @type {boolean}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'isOnline', {
  enumerable: true,
  get: function get() {
    return this.onlineManager && this.onlineManager.isOnline;
  }
});

/**
 * Log levels; one of:
 *
 *    * layer.Constants.LOG.NONE
 *    * layer.Constants.LOG.ERROR
 *    * layer.Constants.LOG.WARN
 *    * layer.Constants.LOG.INFO
 *    * layer.Constants.LOG.DEBUG
 *
 * @type {number}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'logLevel', {
  enumerable: false,
  get: function get() {
    return logger.level;
  },
  set: function set(value) {
    logger.level = value;
  }
});

/**
 * Short hand for getting the userId of the authenticated user.
 *
 * Could also just use client.user.userId
 *
 * @type {string} userId
 */
Object.defineProperty(ClientAuthenticator.prototype, 'userId', {
  enumerable: true,
  get: function get() {
    return this.user ? this.user.userId : '';
  },
  set: function set() {}
});

/**
 * Time to be offline after which we don't do a WebSocket Events.replay,
 * but instead just refresh all our Query data.  Defaults to 30 hours.
 *
 * @type {number}
 * @static
 */
ClientAuthenticator.ResetAfterOfflineDuration = 1000 * 60 * 60 * 30;

/**
 * List of events supported by this class
 * @static
 * @protected
 * @type {string[]}
 */
ClientAuthenticator._supportedEvents = [
/**
 * The client is ready for action
 *
 *      client.on('ready', function(evt) {
 *          renderMyUI();
 *      });
 *
 * @event
 */
'ready',

/**
 * Fired when connected to the server.
 * Currently just means we have a nonce.
 * Not recommended for typical applications.
 * @event connected
 */
'connected',

/**
 * Fired when unsuccessful in obtaining a nonce.
 *
 * Not recommended for typical applications.
 * @event connected-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'connected-error',

/**
 * We now have a session and any requests we send aught to work.
 * Typically you should use the ready event instead of the authenticated event.
 * @event authenticated
 */
'authenticated',

/**
 * Failed to authenticate your client.
 *
 * Either your identity-token was invalid, or something went wrong
 * using your identity-token.
 *
 * @event authenticated-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'authenticated-error',

/**
 * This event fires when a session has expired or when `layer.Client.logout` is called.
 * Typically, it is enough to subscribe to the challenge event
 * which will let you reauthenticate; typical applications do not need
 * to subscribe to this.
 *
 * @event deauthenticated
 */
'deauthenticated',

/**
 * @event challenge
 * Verify the user's identity.
 *
 * This event is where you verify that the user is who we all think the user is,
 * and provide an identity token to validate that.
 *
 * ```javascript
 * client.on('challenge', function(evt) {
 *    myGetIdentityForNonce(evt.nonce, function(identityToken) {
 *      evt.callback(identityToken);
 *    });
 * });
 * ```
 *
 * @param {Object} event
 * @param {string} event.nonce - A nonce for you to provide to your identity provider
 * @param {Function} event.callback - Call this once you have an identity-token
 * @param {string} event.callback.identityToken - Identity token provided by your identity provider service
 */
'challenge',

/**
 * @event session-terminated
 * If your session has been terminated in such a way as to prevent automatic reconnect,
 *
 * this event will fire.  Common scenario: user has two tabs open;
 * one tab the user logs out (or you call client.logout()).
 * The other tab will detect that the sessionToken has been removed,
 * and will terminate its session as well.  In this scenario we do not want
 * to automatically trigger a challenge and restart the login process.
 */
'session-terminated',

/**
 * @event online
 *
 * This event is used to detect when the client is online (connected to the server)
 * or offline (still able to accept API calls but no longer able to sync to the server).
 *
 *      client.on('online', function(evt) {
 *         if (evt.isOnline) {
 *             statusDiv.style.backgroundColor = 'green';
 *         } else {
 *             statusDiv.style.backgroundColor = 'red';
 *         }
 *      });
 *
 * @param {Object} event
 * @param {boolean} event.isOnline
 */
'online'].concat(Root._supportedEvents);

Root.initClass.apply(ClientAuthenticator, [ClientAuthenticator, 'ClientAuthenticator']);

module.exports = ClientAuthenticator;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtYXV0aGVudGljYXRvci5qcyJdLCJuYW1lcyI6WyJ4aHIiLCJyZXF1aXJlIiwiUm9vdCIsIlNvY2tldE1hbmFnZXIiLCJXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIiwiV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIiLCJMYXllckVycm9yIiwiT25saW5lTWFuYWdlciIsIlN5bmNNYW5hZ2VyIiwiRGJNYW5hZ2VyIiwiSWRlbnRpdHkiLCJYSFJTeW5jRXZlbnQiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJBQ0NFUFQiLCJMT0NBTFNUT1JBR0VfS0VZUyIsImxvZ2dlciIsIlV0aWwiLCJNQVhfWEhSX1JFVFJJRVMiLCJDbGllbnRBdXRoZW50aWNhdG9yIiwib3B0aW9ucyIsImFwcElkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiYXBwSWRNaXNzaW5nIiwic29ja2V0TWFuYWdlciIsImNsaWVudCIsInNvY2tldENoYW5nZU1hbmFnZXIiLCJzb2NrZXRSZXF1ZXN0TWFuYWdlciIsIm9ubGluZU1hbmFnZXIiLCJ0ZXN0VXJsIiwidXJsIiwiY29ubmVjdGVkIiwiX2hhbmRsZU9ubGluZUNoYW5nZSIsImJpbmQiLCJkaXNjb25uZWN0ZWQiLCJzeW5jTWFuYWdlciIsInJlcXVlc3RNYW5hZ2VyIiwiZGVzdHJveSIsImRiTWFuYWdlciIsImdsb2JhbCIsImxvY2FsU3RvcmFnZSIsInBlcnNpc3RlbmNlRmVhdHVyZXMiLCJzZXNzaW9uVG9rZW4iLCJfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkIiwic2Vzc2lvbkRhdGEiLCJTRVNTSU9OREFUQSIsInBhcnNlZERhdGEiLCJKU09OIiwicGFyc2UiLCJleHBpcmVzIiwiRGF0ZSIsIm5vdyIsInJlbW92ZUl0ZW0iLCJlcnJvciIsInVzZXJPYmoiLCJ1c2VyIiwiY2xpZW50SWQiLCJzZXNzaW9uT3duZXIiLCJmcm9tU2VydmVyIiwidXNlcklkIiwidXNlcl9pZCIsImlzQ29ubmVjdGVkIiwic3RhcnQiLCJpc1RydXN0ZWREZXZpY2UiLCJfaGFzVXNlcklkQ2hhbmdlZCIsIl9jbGVhclN0b3JlZERhdGEiLCJfcmVzdG9yZUxhc3RTZXNzaW9uIiwiX3Jlc3RvcmVMYXN0VXNlciIsImlkIiwicHJlZml4VVVJRCIsImVuY29kZVVSSUNvbXBvbmVudCIsIl9zZXNzaW9uVG9rZW5SZXN0b3JlZCIsIm1ldGhvZCIsInN5bmMiLCJfY29ubmVjdGlvblJlc3BvbnNlIiwicmVzdWx0Iiwic2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCIsInNldFRpbWVvdXQiLCJfYXV0aENvbXBsZXRlIiwic2Vzc2lvbl90b2tlbiIsInN1Y2Nlc3MiLCJfY29ubmVjdGlvbkVycm9yIiwiZGF0YSIsIl9jb25uZWN0aW9uQ29tcGxldGUiLCJ0cmlnZ2VyIiwiX2F1dGhlbnRpY2F0ZSIsIm5vbmNlIiwiY2FsbGJhY2siLCJhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZSIsImlkZW50aXR5VG9rZW4iLCJpZGVudGl0eVRva2VuTWlzc2luZyIsInVzZXJEYXRhIiwiZGVjb2RlIiwic3BsaXQiLCJpZGVudGl0eU9iaiIsInBybiIsImludmFsaWRVc2VySWRDaGFuZ2UiLCJfc2V0VXNlcklkIiwiZGlzcGxheV9uYW1lIiwiZGlzcGxheU5hbWUiLCJhdmF0YXJfdXJsIiwiYXZhdGFyVXJsIiwiaWRlbnRpdHlfdG9rZW4iLCJhcHBfaWQiLCJfYXV0aFJlc3BvbnNlIiwiX2F1dGhFcnJvciIsImZyb21QZXJzaXN0ZW5jZSIsInNlc3Npb25Ub2tlbk1pc3NpbmciLCJzdHJpbmdpZnkiLCJwcm90b3R5cGUiLCJfZ2V0SWRlbnRpdHlEYXRhIiwiZSIsIl9jbGllbnRBdXRoZW50aWNhdGVkIiwiaXNBdXRoZW50aWNhdGVkIiwiaXNQZXJzaXN0ZW5jZUVuYWJsZWQiLCJCb29sZWFuIiwiY29udmVyc2F0aW9ucyIsImNoYW5uZWxzIiwibWVzc2FnZXMiLCJpZGVudGl0aWVzIiwic3luY1F1ZXVlIiwidGFibGVzIiwib25PcGVuIiwiX2xvYWRVc2VyIiwiaXNGdWxsSWRlbnRpdHkiLCJfY2xpZW50UmVhZHkiLCJfbG9hZCIsIm9uY2UiLCJkZWZhdWx0T3duZXJEaXNwbGF5TmFtZSIsImlzUmVhZHkiLCJjYWxsYmFja0NvdW50IiwiY291bnRlciIsImVzY2FwZSIsIl9yZXNldFNlc3Npb24iLCJkZWxldGVUYWJsZXMiLCJzdG9wIiwidG9rZW4iLCJ0eXBlIiwiZGV2aWNlX2lkIiwiZGV2aWNlSWQiLCJpb3NfdmVyc2lvbiIsImlvc1ZlcnNpb24iLCJhcG5zX2J1bmRsZV9pZCIsImJ1bmRsZUlkIiwiZ2NtX3NlbmRlcl9pZCIsInNlbmRlcklkIiwiY2FudENoYW5nZUlmQ29ubmVjdGVkIiwiaWRlbnRpdHkiLCJwYXJhbXMiLCJ0YXJnZXQiLCJkZXBlbmRzIiwicmVxdWVzdCIsImJvZHkiLCJvcGVyYXRpb24iLCJzZW5kUmVxdWVzdCIsImV2dCIsImR1cmF0aW9uIiwib2ZmbGluZUR1cmF0aW9uIiwiaXNPbmxpbmUiLCJldmVudE5hbWUiLCJvYmoiLCJyZXNldCIsIlJlc2V0QWZ0ZXJPZmZsaW5lRHVyYXRpb24iLCJfeGhyRml4UmVsYXRpdmVVcmxzIiwid2l0aENyZWRlbnRpYWxzIiwiaGVhZGVycyIsIl94aHJGaXhIZWFkZXJzIiwiX3hockZpeEF1dGgiLCJfbm9uc3luY1hociIsIl9zeW5jWGhyIiwiaW5uZXJDYWxsYmFjayIsIl94aHJSZXN1bHQiLCJyZXRyeUNvdW50IiwiaW5kZXhPZiIsInN0YXR1cyIsIkF1dGhvcml6YXRpb24iLCJhdXRob3JpemF0aW9uIiwiaGVhZGVyTmFtZUxpc3QiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImhlYWRlck5hbWUiLCJ0b0xvd2VyQ2FzZSIsImFjY2VwdCIsImlzRGVzdHJveWVkIiwiX2dlbmVyYXRlRXJyb3IiLCJ3YXJuIiwiZ2V0Tm9uY2UiLCJodHRwU3RhdHVzIiwibG9nIiwid2Vic29ja2V0VXJsIiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiZ2V0IiwibGV2ZWwiLCJzZXQiLCJ2YWx1ZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE4QkEsSUFBTUEsTUFBTUMsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFNQyxPQUFPRCxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU1FLGdCQUFnQkYsUUFBUSw2QkFBUixDQUF0QjtBQUNBLElBQU1HLHlCQUF5QkgsUUFBUSw2QkFBUixDQUEvQjtBQUNBLElBQU1JLDBCQUEwQkosUUFBUSw4QkFBUixDQUFoQztBQUNBLElBQU1LLGFBQWFMLFFBQVEsZUFBUixDQUFuQjtBQUNBLElBQU1NLGdCQUFnQk4sUUFBUSx3QkFBUixDQUF0QjtBQUNBLElBQU1PLGNBQWNQLFFBQVEsZ0JBQVIsQ0FBcEI7QUFDQSxJQUFNUSxZQUFZUixRQUFRLGNBQVIsQ0FBbEI7QUFDQSxJQUFNUyxXQUFXVCxRQUFRLG1CQUFSLENBQWpCOztlQUM2Q0EsUUFBUSxjQUFSLEM7SUFBckNVLFksWUFBQUEsWTtJQUFjQyxrQixZQUFBQSxrQjs7Z0JBQ2dCWCxRQUFRLFNBQVIsQztJQUE5QlksTSxhQUFBQSxNO0lBQVFDLGlCLGFBQUFBLGlCOztBQUNoQixJQUFNQyxTQUFTZCxRQUFRLFVBQVIsQ0FBZjtBQUNBLElBQU1lLE9BQU9mLFFBQVEsZ0JBQVIsQ0FBYjs7QUFFQSxJQUFNZ0Isa0JBQWtCLENBQXhCOztJQUVNQyxtQjs7O0FBRUo7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNkJBLCtCQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CO0FBQ0EsUUFBSSxDQUFDQSxRQUFRQyxLQUFiLEVBQW9CLE1BQU0sSUFBSUMsS0FBSixDQUFVZixXQUFXZ0IsVUFBWCxDQUFzQkMsWUFBaEMsQ0FBTjs7QUFGRCxxSUFJYkosT0FKYTtBQUtwQjs7QUFFRDs7Ozs7Ozs7OztzQ0FNa0I7QUFDaEI7QUFDQSxXQUFLSyxhQUFMLEdBQXFCLElBQUlyQixhQUFKLENBQWtCO0FBQ3JDc0IsZ0JBQVE7QUFENkIsT0FBbEIsQ0FBckI7O0FBSUEsV0FBS0MsbUJBQUwsR0FBMkIsSUFBSXRCLHNCQUFKLENBQTJCO0FBQ3BEcUIsZ0JBQVEsSUFENEM7QUFFcERELHVCQUFlLEtBQUtBO0FBRmdDLE9BQTNCLENBQTNCOztBQUtBLFdBQUtHLG9CQUFMLEdBQTRCLElBQUl0Qix1QkFBSixDQUE0QjtBQUN0RG9CLGdCQUFRLElBRDhDO0FBRXRERCx1QkFBZSxLQUFLQTtBQUZrQyxPQUE1QixDQUE1Qjs7QUFLQSxXQUFLSSxhQUFMLEdBQXFCLElBQUlyQixhQUFKLENBQWtCO0FBQ3JDaUIsdUJBQWUsS0FBS0EsYUFEaUI7QUFFckNLLGlCQUFTLEtBQUtDLEdBQUwsR0FBVyx5QkFGaUI7QUFHckNDLG1CQUFXLEtBQUtDLG1CQUFMLENBQXlCQyxJQUF6QixDQUE4QixJQUE5QixDQUgwQjtBQUlyQ0Msc0JBQWMsS0FBS0YsbUJBQUwsQ0FBeUJDLElBQXpCLENBQThCLElBQTlCO0FBSnVCLE9BQWxCLENBQXJCOztBQU9BLFdBQUtFLFdBQUwsR0FBbUIsSUFBSTNCLFdBQUosQ0FBZ0I7QUFDakNvQix1QkFBZSxLQUFLQSxhQURhO0FBRWpDSix1QkFBZSxLQUFLQSxhQUZhO0FBR2pDWSx3QkFBZ0IsS0FBS1Qsb0JBSFk7QUFJakNGLGdCQUFRO0FBSnlCLE9BQWhCLENBQW5CO0FBTUQ7O0FBRUQ7Ozs7Ozs7Ozt5Q0FNcUI7QUFDbkIsV0FBS1UsV0FBTCxDQUFpQkUsT0FBakI7QUFDQSxXQUFLVCxhQUFMLENBQW1CUyxPQUFuQjtBQUNBLFdBQUtiLGFBQUwsQ0FBbUJhLE9BQW5CO0FBQ0EsV0FBS1gsbUJBQUwsQ0FBeUJXLE9BQXpCO0FBQ0EsV0FBS1Ysb0JBQUwsQ0FBMEJVLE9BQTFCO0FBQ0EsVUFBSSxLQUFLQyxTQUFULEVBQW9CLEtBQUtBLFNBQUwsQ0FBZUQsT0FBZjtBQUNyQjs7QUFHRDs7Ozs7Ozs7OzttREFPK0I7QUFDN0IsYUFBTyxDQUFDRSxPQUFPQyxZQUFSLElBQXlCLEtBQUtDLG1CQUFMLElBQTRCLENBQUMsS0FBS0EsbUJBQUwsQ0FBeUJDLFlBQXRGO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OzBDQVFzQjtBQUNwQixVQUFJLEtBQUtDLDRCQUFMLEVBQUosRUFBeUM7QUFDekMsVUFBSTtBQUNGLFlBQU1DLGNBQWNMLE9BQU9DLFlBQVAsQ0FBb0IxQixrQkFBa0IrQixXQUFsQixHQUFnQyxLQUFLekIsS0FBekQsQ0FBcEI7QUFDQSxZQUFJLENBQUN3QixXQUFMLEVBQWtCO0FBQ2xCLFlBQU1FLGFBQWFDLEtBQUtDLEtBQUwsQ0FBV0osV0FBWCxDQUFuQjtBQUNBLFlBQUlFLFdBQVdHLE9BQVgsR0FBcUJDLEtBQUtDLEdBQUwsRUFBekIsRUFBcUM7QUFDbkNaLGlCQUFPQyxZQUFQLENBQW9CWSxVQUFwQixDQUErQnRDLGtCQUFrQitCLFdBQWxCLEdBQWdDLEtBQUt6QixLQUFwRTtBQUNELFNBRkQsTUFFTztBQUNMLGVBQUtzQixZQUFMLEdBQW9CSSxXQUFXSixZQUEvQjtBQUNEO0FBQ0YsT0FURCxDQVNFLE9BQU9XLEtBQVAsRUFBYztBQUNkO0FBQ0Q7QUFDRjs7QUFFSDs7Ozs7Ozs7Ozt1Q0FPcUI7QUFDakIsVUFBSTtBQUNGLFlBQU1ULGNBQWNMLE9BQU9DLFlBQVAsQ0FBb0IxQixrQkFBa0IrQixXQUFsQixHQUFnQyxLQUFLekIsS0FBekQsQ0FBcEI7QUFDQSxZQUFJLENBQUN3QixXQUFMLEVBQWtCLE9BQU8sSUFBUDtBQUNsQixZQUFNVSxVQUFVUCxLQUFLQyxLQUFMLENBQVdKLFdBQVgsRUFBd0JXLElBQXhDO0FBQ0EsZUFBTyxJQUFJN0MsUUFBSixDQUFhO0FBQ2xCOEMsb0JBQVUsS0FBS3BDLEtBREc7QUFFbEJxQyx3QkFBYyxJQUZJO0FBR2xCQyxzQkFBWUo7QUFITSxTQUFiLENBQVA7QUFLRCxPQVRELENBU0UsT0FBT0QsS0FBUCxFQUFjO0FBQ2QsZUFBTyxJQUFQO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7c0NBUWtCTSxNLEVBQVE7QUFDeEIsVUFBSTtBQUNGLFlBQU1mLGNBQWNMLE9BQU9DLFlBQVAsQ0FBb0IxQixrQkFBa0IrQixXQUFsQixHQUFnQyxLQUFLekIsS0FBekQsQ0FBcEI7QUFDQSxZQUFJLENBQUN3QixXQUFMLEVBQWtCLE9BQU8sSUFBUDtBQUNsQixlQUFPRyxLQUFLQyxLQUFMLENBQVdKLFdBQVgsRUFBd0JXLElBQXhCLENBQTZCSyxPQUE3QixLQUF5Q0QsTUFBaEQ7QUFDRCxPQUpELENBSUUsT0FBT04sS0FBUCxFQUFjO0FBQ2QsZUFBTyxJQUFQO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OEJBaUJxQjtBQUFBOztBQUFBLFVBQWJNLE1BQWEsdUVBQUosRUFBSTs7QUFDbkIsVUFBSUosYUFBSjtBQUNBLFdBQUtNLFdBQUwsR0FBbUIsS0FBbkI7QUFDQSxXQUFLTixJQUFMLEdBQVksSUFBWjtBQUNBLFdBQUszQixhQUFMLENBQW1Ca0MsS0FBbkI7QUFDQSxVQUFJLENBQUMsS0FBS0MsZUFBTixJQUF5QixDQUFDSixNQUExQixJQUFvQyxLQUFLaEIsNEJBQUwsRUFBcEMsSUFBMkUsS0FBS3FCLGlCQUFMLENBQXVCTCxNQUF2QixDQUEvRSxFQUErRztBQUM3RyxhQUFLTSxnQkFBTDtBQUNEOztBQUdELFVBQUksS0FBS0YsZUFBTCxJQUF3QkosTUFBNUIsRUFBb0M7QUFDbEMsYUFBS08sbUJBQUwsQ0FBeUJQLE1BQXpCO0FBQ0FKLGVBQU8sS0FBS1ksZ0JBQUwsRUFBUDtBQUNBLFlBQUlaLElBQUosRUFBVSxLQUFLQSxJQUFMLEdBQVlBLElBQVo7QUFDWDs7QUFFRCxVQUFJLENBQUMsS0FBS0EsSUFBVixFQUFnQjtBQUNkLGFBQUtBLElBQUwsR0FBWSxJQUFJN0MsUUFBSixDQUFhO0FBQ3ZCaUQsd0JBRHVCO0FBRXZCRix3QkFBYyxJQUZTO0FBR3ZCRCxvQkFBVSxLQUFLcEMsS0FIUTtBQUl2QmdELGNBQUlULFNBQVNqRCxTQUFTMkQsVUFBVCxHQUFzQkMsbUJBQW1CWCxNQUFuQixDQUEvQixHQUE0RDtBQUp6QyxTQUFiLENBQVo7QUFNRDs7QUFFRCxVQUFJLEtBQUtqQixZQUFMLElBQXFCLEtBQUthLElBQUwsQ0FBVUksTUFBbkMsRUFBMkM7QUFDekMsYUFBS1kscUJBQUw7QUFDRCxPQUZELE1BRU87QUFDTCxhQUFLdkUsR0FBTCxDQUFTO0FBQ1A4QixlQUFLLFNBREU7QUFFUDBDLGtCQUFRLE1BRkQ7QUFHUEMsZ0JBQU07QUFIQyxTQUFULEVBSUc7QUFBQSxpQkFBVSxPQUFLQyxtQkFBTCxDQUF5QkMsTUFBekIsQ0FBVjtBQUFBLFNBSkg7QUFLRDtBQUNELGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O3VDQXNCbUJoQixNLEVBQVFqQixZLEVBQWM7QUFBQTs7QUFDdkMsVUFBSWEsYUFBSjtBQUNBLFdBQUtBLElBQUwsR0FBWSxJQUFaO0FBQ0EsVUFBSSxDQUFDSSxNQUFELElBQVcsQ0FBQ2pCLFlBQWhCLEVBQThCLE1BQU0sSUFBSXJCLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0JzRCxzQkFBaEMsQ0FBTjtBQUM5QixVQUFJLENBQUMsS0FBS2IsZUFBTixJQUF5QixLQUFLcEIsNEJBQUwsRUFBekIsSUFBZ0UsS0FBS3FCLGlCQUFMLENBQXVCTCxNQUF2QixDQUFwRSxFQUFvRztBQUNsRyxhQUFLTSxnQkFBTDtBQUNEO0FBQ0QsVUFBSSxLQUFLRixlQUFULEVBQTBCO0FBQ3hCUixlQUFPLEtBQUtZLGdCQUFMLEVBQVA7QUFDQSxZQUFJWixJQUFKLEVBQVUsS0FBS0EsSUFBTCxHQUFZQSxJQUFaO0FBQ1g7O0FBRUQsV0FBSzNCLGFBQUwsQ0FBbUJrQyxLQUFuQjs7QUFFQSxVQUFJLENBQUMsS0FBS1AsSUFBVixFQUFnQjtBQUNkLGFBQUtBLElBQUwsR0FBWSxJQUFJN0MsUUFBSixDQUFhO0FBQ3ZCaUQsd0JBRHVCO0FBRXZCRix3QkFBYyxJQUZTO0FBR3ZCRCxvQkFBVSxLQUFLcEMsS0FIUTtBQUl2QmdELGNBQUkxRCxTQUFTMkQsVUFBVCxHQUFzQkMsbUJBQW1CWCxNQUFuQjtBQUpILFNBQWIsQ0FBWjtBQU1EOztBQUVELFdBQUtFLFdBQUwsR0FBbUIsSUFBbkI7QUFDQWdCLGlCQUFXO0FBQUEsZUFBTSxPQUFLQyxhQUFMLENBQW1CLEVBQUVDLGVBQWVyQyxZQUFqQixFQUFuQixFQUFvRCxLQUFwRCxDQUFOO0FBQUEsT0FBWCxFQUE2RSxDQUE3RTtBQUNBLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozt3Q0FXb0JpQyxNLEVBQVE7QUFDMUIsVUFBSSxDQUFDQSxPQUFPSyxPQUFaLEVBQXFCO0FBQ25CLGFBQUtDLGdCQUFMLENBQXNCTixPQUFPTyxJQUE3QjtBQUNELE9BRkQsTUFFTztBQUNMLGFBQUtDLG1CQUFMLENBQXlCUixPQUFPTyxJQUFoQztBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O3dDQWNvQlAsTSxFQUFRO0FBQzFCLFdBQUtkLFdBQUwsR0FBbUIsSUFBbkI7QUFDQSxXQUFLdUIsT0FBTCxDQUFhLFdBQWI7QUFDQSxXQUFLQyxhQUFMLENBQW1CVixPQUFPVyxLQUExQjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7cUNBU2lCakMsSyxFQUFPO0FBQ3RCLFdBQUsrQixPQUFMLENBQWEsaUJBQWIsRUFBZ0MsRUFBRS9CLFlBQUYsRUFBaEM7QUFDRDs7QUFHRDs7QUFFQTs7QUFFQTs7Ozs7Ozs7Ozs7Ozs7O2tDQVljaUMsSyxFQUFPO0FBQ25CLFVBQUlBLEtBQUosRUFBVztBQUNULGFBQUtGLE9BQUwsQ0FBYSxXQUFiLEVBQTBCO0FBQ3hCRSxzQkFEd0I7QUFFeEJDLG9CQUFVLEtBQUtDLDZCQUFMLENBQW1DdkQsSUFBbkMsQ0FBd0MsSUFBeEM7QUFGYyxTQUExQjtBQUlEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7a0RBYThCd0QsYSxFQUFlO0FBQUE7O0FBQzNDO0FBQ0EsVUFBSSxDQUFDQSxhQUFMLEVBQW9CO0FBQ2xCLGNBQU0sSUFBSXBFLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0JvRSxvQkFBaEMsQ0FBTjtBQUNELE9BRkQsTUFFTztBQUNMLFlBQU1DLFdBQVczRSxLQUFLNEUsTUFBTCxDQUFZSCxjQUFjSSxLQUFkLENBQW9CLEdBQXBCLEVBQXlCLENBQXpCLENBQVosQ0FBakI7QUFDQSxZQUFNQyxjQUFjL0MsS0FBS0MsS0FBTCxDQUFXMkMsUUFBWCxDQUFwQjs7QUFFQSxZQUFJLEtBQUtwQyxJQUFMLENBQVVJLE1BQVYsSUFBb0IsS0FBS0osSUFBTCxDQUFVSSxNQUFWLEtBQXFCbUMsWUFBWUMsR0FBekQsRUFBOEQ7QUFDNUQsZ0JBQU0sSUFBSTFFLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0IwRSxtQkFBaEMsQ0FBTjtBQUNEOztBQUVELGFBQUt6QyxJQUFMLENBQVUwQyxVQUFWLENBQXFCSCxZQUFZQyxHQUFqQzs7QUFFQSxZQUFJRCxZQUFZSSxZQUFoQixFQUE4QixLQUFLM0MsSUFBTCxDQUFVNEMsV0FBVixHQUF3QkwsWUFBWUksWUFBcEM7QUFDOUIsWUFBSUosWUFBWU0sVUFBaEIsRUFBNEIsS0FBSzdDLElBQUwsQ0FBVThDLFNBQVYsR0FBc0JQLFlBQVlNLFVBQWxDOztBQUU1QixhQUFLcEcsR0FBTCxDQUFTO0FBQ1A4QixlQUFLLFdBREU7QUFFUDBDLGtCQUFRLE1BRkQ7QUFHUEMsZ0JBQU0sS0FIQztBQUlQUyxnQkFBTTtBQUNKb0IsNEJBQWdCYixhQURaO0FBRUpjLG9CQUFRLEtBQUtuRjtBQUZUO0FBSkMsU0FBVCxFQVFHO0FBQUEsaUJBQVUsT0FBS29GLGFBQUwsQ0FBbUI3QixNQUFuQixFQUEyQmMsYUFBM0IsQ0FBVjtBQUFBLFNBUkg7QUFTRDtBQUNGOztBQUVEOzs7Ozs7Ozs7OztrQ0FRY2QsTSxFQUFRYyxhLEVBQWU7QUFDbkMsVUFBSSxDQUFDZCxPQUFPSyxPQUFaLEVBQXFCO0FBQ25CLGFBQUt5QixVQUFMLENBQWdCOUIsT0FBT08sSUFBdkIsRUFBNkJPLGFBQTdCO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsYUFBS1gsYUFBTCxDQUFtQkgsT0FBT08sSUFBMUIsRUFBZ0MsS0FBaEM7QUFDRDtBQUNGOztBQUdEOzs7Ozs7Ozs7Ozs7OztrQ0FXY1AsTSxFQUFRK0IsZSxFQUFpQjtBQUNyQyxVQUFJLENBQUMvQixNQUFELElBQVcsQ0FBQ0EsT0FBT0ksYUFBdkIsRUFBc0M7QUFDcEMsY0FBTSxJQUFJMUQsS0FBSixDQUFVZixXQUFXZ0IsVUFBWCxDQUFzQnFGLG1CQUFoQyxDQUFOO0FBQ0Q7QUFDRCxXQUFLakUsWUFBTCxHQUFvQmlDLE9BQU9JLGFBQTNCOztBQUVBO0FBQ0E7QUFDQSxVQUFJLENBQUMsS0FBS3BDLDRCQUFMLEVBQUQsSUFBd0MsQ0FBQytELGVBQTdDLEVBQThEO0FBQzVELFlBQUk7QUFDRm5FLGlCQUFPQyxZQUFQLENBQW9CMUIsa0JBQWtCK0IsV0FBbEIsR0FBZ0MsS0FBS3pCLEtBQXpELElBQWtFMkIsS0FBSzZELFNBQUwsQ0FBZTtBQUMvRWxFLDBCQUFjLEtBQUtBLFlBQUwsSUFBcUIsRUFENEM7QUFFL0VhLGtCQUFNOUMsVUFBVW9HLFNBQVYsQ0FBb0JDLGdCQUFwQixDQUFxQyxDQUFDLEtBQUt2RCxJQUFOLENBQXJDLEVBQWtELElBQWxELEVBQXdELENBQXhELENBRnlFO0FBRy9FTixxQkFBU0MsS0FBS0MsR0FBTCxLQUFjLEtBQUssRUFBTCxHQUFVLEVBQVYsR0FBZSxFQUFmLEdBQW9CO0FBSG9DLFdBQWYsQ0FBbEU7QUFLRCxTQU5ELENBTUUsT0FBTzRELENBQVAsRUFBVTtBQUNWO0FBQ0Q7QUFDRjs7QUFFRCxXQUFLQyxvQkFBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7OytCQVVXM0QsSyxFQUFPb0MsYSxFQUFlO0FBQy9CLFdBQUtMLE9BQUwsQ0FBYSxxQkFBYixFQUFvQyxFQUFFL0IsWUFBRixFQUFwQztBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs0Q0FXd0I7QUFDdEIsV0FBS1EsV0FBTCxHQUFtQixJQUFuQjtBQUNBLFdBQUt1QixPQUFMLENBQWEsV0FBYjtBQUNBLFdBQUs0QixvQkFBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzJDQU91QjtBQUFBOztBQUNyQjtBQUNBLFdBQUtDLGVBQUwsR0FBdUIsSUFBdkI7QUFDQSxXQUFLN0IsT0FBTCxDQUFhLGVBQWI7O0FBRUEsVUFBSSxDQUFDLEtBQUtyQixlQUFWLEVBQTJCLEtBQUttRCxvQkFBTCxHQUE0QixLQUE1Qjs7QUFHM0I7QUFDQTtBQUNBLFVBQUksQ0FBQyxLQUFLekUsbUJBQU4sSUFBNkIsQ0FBQyxLQUFLeUUsb0JBQXZDLEVBQTZEO0FBQzNELFlBQUl4RSxxQkFBSjtBQUNBLFlBQUksS0FBS0QsbUJBQUwsSUFBNEIsa0JBQWtCLEtBQUtBLG1CQUF2RCxFQUE0RTtBQUMxRUMseUJBQWV5RSxRQUFRLEtBQUsxRSxtQkFBTCxDQUF5QkMsWUFBakMsQ0FBZjtBQUNELFNBRkQsTUFFTztBQUNMQSx5QkFBZSxLQUFLcUIsZUFBcEI7QUFDRDtBQUNELGFBQUt0QixtQkFBTCxHQUEyQjtBQUN6QjJFLHlCQUFlLEtBQUtGLG9CQURLO0FBRXpCRyxvQkFBVSxLQUFLSCxvQkFGVTtBQUd6Qkksb0JBQVUsS0FBS0osb0JBSFU7QUFJekJLLHNCQUFZLEtBQUtMLG9CQUpRO0FBS3pCTSxxQkFBVyxLQUFLTixvQkFMUztBQU16QnhFO0FBTnlCLFNBQTNCO0FBUUQ7O0FBRUQ7QUFDQSxVQUFJLENBQUMsS0FBS0osU0FBVixFQUFxQjtBQUNuQixhQUFLQSxTQUFMLEdBQWlCLElBQUk3QixTQUFKLENBQWM7QUFDN0JnQixrQkFBUSxJQURxQjtBQUU3QmdHLGtCQUFRLEtBQUtoRjtBQUZnQixTQUFkLENBQWpCO0FBSUQ7O0FBRUQ7QUFDQSxVQUFJLEtBQUt5RSxvQkFBVCxFQUErQjtBQUM3QixhQUFLNUUsU0FBTCxDQUFlb0YsTUFBZixDQUFzQjtBQUFBLGlCQUFNLE9BQUtDLFNBQUwsRUFBTjtBQUFBLFNBQXRCO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsYUFBS0EsU0FBTDtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7O2dDQVFZO0FBQUE7O0FBQ1Y7QUFDQSxVQUFJLEtBQUtwRSxJQUFMLENBQVVxRSxjQUFkLEVBQThCO0FBQzVCLGFBQUtDLFlBQUw7QUFDRCxPQUZELE1BRU87QUFDTDtBQUNBLGFBQUt0RSxJQUFMLENBQVV1RSxLQUFWO0FBQ0EsYUFBS3ZFLElBQUwsQ0FBVXdFLElBQVYsQ0FBZSxtQkFBZixFQUFvQyxZQUFNO0FBQ3hDLGNBQUksQ0FBQyxPQUFLcEYsNEJBQUwsRUFBTCxFQUEwQztBQUN4QyxnQkFBSTtBQUNGO0FBQ0Esa0JBQU1DLGNBQWNHLEtBQUtDLEtBQUwsQ0FBV1QsT0FBT0MsWUFBUCxDQUFvQjFCLGtCQUFrQitCLFdBQWxCLEdBQWdDLE9BQUt6QixLQUF6RCxDQUFYLENBQXBCO0FBQ0F3QiwwQkFBWVcsSUFBWixHQUFtQjlDLFVBQVVvRyxTQUFWLENBQW9CQyxnQkFBcEIsQ0FBcUMsQ0FBQyxPQUFLdkQsSUFBTixDQUFyQyxFQUFrRCxDQUFsRCxDQUFuQjtBQUNBaEIscUJBQU9DLFlBQVAsQ0FBb0IxQixrQkFBa0IrQixXQUFsQixHQUFnQyxPQUFLekIsS0FBekQsSUFBa0UyQixLQUFLNkQsU0FBTCxDQUFlaEUsV0FBZixDQUFsRTtBQUNELGFBTEQsQ0FLRSxPQUFPbUUsQ0FBUCxFQUFVO0FBQ1Y7QUFDRDtBQUNGO0FBQ0QsaUJBQUtjLFlBQUw7QUFDRCxTQVpELEVBYUNFLElBYkQsQ0FhTSx5QkFiTixFQWFpQyxZQUFNO0FBQ3JDLGNBQUksQ0FBQyxPQUFLeEUsSUFBTCxDQUFVNEMsV0FBZixFQUE0QixPQUFLNUMsSUFBTCxDQUFVNEMsV0FBVixHQUF3QixPQUFLNkIsdUJBQTdCO0FBQzVCLGlCQUFLSCxZQUFMO0FBQ0QsU0FoQkQ7QUFpQkQ7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7OzttQ0FVZTtBQUNiLFVBQUksQ0FBQyxLQUFLSSxPQUFWLEVBQW1CO0FBQ2pCLGFBQUtBLE9BQUwsR0FBZSxJQUFmO0FBQ0EsYUFBSzdDLE9BQUwsQ0FBYSxPQUFiO0FBQ0Q7QUFDRjs7QUFHRDs7QUFHQTs7QUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7MkJBaUJPRyxRLEVBQVU7QUFDZixVQUFJMkMsZ0JBQWdCLENBQXBCO0FBQUEsVUFDRUMsVUFBVSxDQURaO0FBRUEsVUFBSSxLQUFLbEIsZUFBVCxFQUEwQjtBQUN4QmlCO0FBQ0EsYUFBS2xJLEdBQUwsQ0FBUztBQUNQd0Usa0JBQVEsUUFERDtBQUVQMUMsZUFBSyxlQUFlc0csT0FBTyxLQUFLMUYsWUFBWixDQUZiO0FBR1ArQixnQkFBTTtBQUhDLFNBQVQsRUFJRyxZQUFNO0FBQ1AwRDtBQUNBLGNBQUlBLFlBQVlELGFBQVosSUFBNkIzQyxRQUFqQyxFQUEyQ0E7QUFDNUMsU0FQRDtBQVFEOztBQUVEO0FBQ0E7QUFDQSxXQUFLdEIsZ0JBQUwsQ0FBc0IsWUFBTTtBQUMxQmtFO0FBQ0EsWUFBSUEsWUFBWUQsYUFBWixJQUE2QjNDLFFBQWpDLEVBQTJDQTtBQUM1QyxPQUhEOztBQUtBLFdBQUs4QyxhQUFMO0FBQ0EsYUFBTyxJQUFQO0FBQ0Q7OztxQ0FHZ0I5QyxRLEVBQVU7QUFDekIsVUFBSWhELE9BQU9DLFlBQVgsRUFBeUJBLGFBQWFZLFVBQWIsQ0FBd0J0QyxrQkFBa0IrQixXQUFsQixHQUFnQyxLQUFLekIsS0FBN0Q7QUFDekIsVUFBSSxLQUFLa0IsU0FBVCxFQUFvQjtBQUNsQixhQUFLQSxTQUFMLENBQWVnRyxZQUFmLENBQTRCL0MsUUFBNUI7QUFDRCxPQUZELE1BRU8sSUFBSUEsUUFBSixFQUFjO0FBQ25CQTtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7O29DQVFnQjtBQUNkLFdBQUswQyxPQUFMLEdBQWUsS0FBZjtBQUNBLFVBQUksS0FBS3ZGLFlBQVQsRUFBdUI7QUFDckIsYUFBS0EsWUFBTCxHQUFvQixFQUFwQjtBQUNBLFlBQUlILE9BQU9DLFlBQVgsRUFBeUI7QUFDdkJBLHVCQUFhWSxVQUFiLENBQXdCdEMsa0JBQWtCK0IsV0FBbEIsR0FBZ0MsS0FBS3pCLEtBQTdEO0FBQ0Q7QUFDRjs7QUFFRCxXQUFLeUMsV0FBTCxHQUFtQixLQUFuQjtBQUNBLFdBQUtvRCxlQUFMLEdBQXVCLEtBQXZCOztBQUVBLFdBQUs3QixPQUFMLENBQWEsaUJBQWI7QUFDQSxXQUFLeEQsYUFBTCxDQUFtQjJHLElBQW5CO0FBQ0Q7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7eUNBYXFCcEgsTyxFQUFTb0UsUSxFQUFVO0FBQ3RDLFdBQUt2RixHQUFMLENBQVM7QUFDUDhCLGFBQUssYUFERTtBQUVQMEMsZ0JBQVEsTUFGRDtBQUdQQyxjQUFNLEtBSEM7QUFJUFMsY0FBTTtBQUNKc0QsaUJBQU9ySCxRQUFRcUgsS0FEWDtBQUVKQyxnQkFBTSxNQUZGO0FBR0pDLHFCQUFXdkgsUUFBUXdILFFBSGY7QUFJSkMsdUJBQWF6SCxRQUFRMEgsVUFKakI7QUFLSkMsMEJBQWdCM0gsUUFBUTRIO0FBTHBCO0FBSkMsT0FBVCxFQVdHO0FBQUEsZUFBVXhELFNBQVNaLE9BQU9PLElBQWhCLENBQVY7QUFBQSxPQVhIO0FBWUQ7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs2Q0FZeUIvRCxPLEVBQVNvRSxRLEVBQVU7QUFDMUMsV0FBS3ZGLEdBQUwsQ0FBUztBQUNQOEIsYUFBSyxhQURFO0FBRVAwQyxnQkFBUSxNQUZEO0FBR1BDLGNBQU0sS0FIQztBQUlQUyxjQUFNO0FBQ0pzRCxpQkFBT3JILFFBQVFxSCxLQURYO0FBRUpDLGdCQUFNLEtBRkY7QUFHSkMscUJBQVd2SCxRQUFRd0gsUUFIZjtBQUlKSyx5QkFBZTdILFFBQVE4SDtBQUpuQjtBQUpDLE9BQVQsRUFVRztBQUFBLGVBQVUxRCxTQUFTWixPQUFPTyxJQUFoQixDQUFWO0FBQUEsT0FWSDtBQVdEOztBQUVEOzs7Ozs7Ozs7Ozs7d0NBU29CeUQsUSxFQUFVcEQsUSxFQUFVO0FBQ3RDLFdBQUt2RixHQUFMLENBQVM7QUFDUDhCLGFBQUssaUJBQWlCNkcsUUFEZjtBQUVQbkUsZ0JBQVE7QUFGRCxPQUFULEVBR0c7QUFBQSxlQUFVZSxTQUFTWixPQUFPTyxJQUFoQixDQUFWO0FBQUEsT0FISDtBQUlEOztBQUVEOztBQUdBOztBQUVBOzs7Ozs7Ozs7Ozs7O29DQVVnQjtBQUNkLFVBQUksS0FBS3JCLFdBQVQsRUFBc0IsTUFBTSxJQUFJeEMsS0FBSixDQUFVZixXQUFXZ0IsVUFBWCxDQUFzQjRILHFCQUFoQyxDQUFOO0FBQ3ZCOztBQUVGOzs7Ozs7Ozs7Ozs7O2lDQVVjM0YsSSxFQUFNO0FBQ2pCLFVBQUksS0FBS00sV0FBVCxFQUFzQjtBQUNwQixjQUFNLElBQUl4QyxLQUFKLENBQVVmLFdBQVdnQixVQUFYLENBQXNCNEgscUJBQWhDLENBQU47QUFDRDtBQUNGOztBQUVEOzs7O2lDQUNhQyxRLEVBQVUsQ0FBRTs7O29DQUNUQSxRLEVBQVUsQ0FBRTs7QUFHNUI7O0FBR0E7Ozs7c0NBQ2tCQyxNLEVBQVE3RCxRLEVBQVU7QUFDbEMsVUFBSTZELE9BQU8zRSxJQUFYLEVBQWlCO0FBQ2YsWUFBTTRFLFNBQVNELE9BQU8zRSxJQUFQLENBQVk0RSxNQUEzQjtBQUNBLFlBQUlDLFVBQVVGLE9BQU8zRSxJQUFQLENBQVk2RSxPQUExQjtBQUNBLFlBQUlELFVBQVUsQ0FBQ0MsT0FBZixFQUF3QkEsVUFBVSxDQUFDRCxNQUFELENBQVY7O0FBRXhCLGFBQUtsSCxXQUFMLENBQWlCb0gsT0FBakIsQ0FBeUIsSUFBSTNJLGtCQUFKLENBQXVCO0FBQzlDc0UsZ0JBQU1rRSxPQUFPSSxJQURpQztBQUU5Q0MscUJBQVdMLE9BQU81RSxNQUY0QjtBQUc5QzZFLHdCQUg4QztBQUk5Q0MsMEJBSjhDO0FBSzlDL0Q7QUFMOEMsU0FBdkIsQ0FBekI7QUFPRCxPQVpELE1BWU87QUFDTCxZQUFJLE9BQU82RCxPQUFPbEUsSUFBZCxLQUF1QixVQUEzQixFQUF1Q2tFLE9BQU9sRSxJQUFQLEdBQWNrRSxPQUFPbEUsSUFBUCxFQUFkO0FBQ3ZDLGFBQUt2RCxvQkFBTCxDQUEwQitILFdBQTFCLENBQXNDTixNQUF0QyxFQUE4QzdELFFBQTlDO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7d0NBUW9Cb0UsRyxFQUFLO0FBQ3ZCLFVBQUksQ0FBQyxLQUFLMUMsZUFBVixFQUEyQjtBQUMzQixVQUFNMkMsV0FBV0QsSUFBSUUsZUFBckI7QUFDQSxVQUFNQyxXQUFXSCxJQUFJSSxTQUFKLEtBQWtCLFdBQW5DO0FBQ0EsVUFBTUMsTUFBTSxFQUFFRixrQkFBRixFQUFaO0FBQ0EsVUFBSUEsUUFBSixFQUFjO0FBQ1pFLFlBQUlDLEtBQUosR0FBWUwsV0FBVzFJLG9CQUFvQmdKLHlCQUEzQztBQUNEO0FBQ0QsV0FBSzlFLE9BQUwsQ0FBYSxRQUFiLEVBQXVCNEUsR0FBdkI7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O3dCQWtCSTdJLE8sRUFBU29FLFEsRUFBVTtBQUNyQixVQUFJLENBQUNwRSxRQUFRc0QsSUFBVCxJQUFpQixDQUFDdEQsUUFBUXNELElBQVIsQ0FBYTRFLE1BQW5DLEVBQTJDO0FBQ3pDbEksZ0JBQVFXLEdBQVIsR0FBYyxLQUFLcUksbUJBQUwsQ0FBeUJoSixRQUFRVyxHQUFSLElBQWUsRUFBeEMsQ0FBZDtBQUNEOztBQUVEWCxjQUFRaUosZUFBUixHQUEwQixJQUExQjtBQUNBLFVBQUksQ0FBQ2pKLFFBQVFxRCxNQUFiLEVBQXFCckQsUUFBUXFELE1BQVIsR0FBaUIsS0FBakI7QUFDckIsVUFBSSxDQUFDckQsUUFBUWtKLE9BQWIsRUFBc0JsSixRQUFRa0osT0FBUixHQUFrQixFQUFsQjtBQUN0QixXQUFLQyxjQUFMLENBQW9CbkosUUFBUWtKLE9BQTVCO0FBQ0EsV0FBS0UsV0FBTCxDQUFpQnBKLFFBQVFrSixPQUF6Qjs7QUFHQTtBQUNBLFVBQUlsSixRQUFRc0QsSUFBUixLQUFpQixLQUFyQixFQUE0QjtBQUMxQixhQUFLK0YsV0FBTCxDQUFpQnJKLE9BQWpCLEVBQTBCb0UsUUFBMUIsRUFBb0MsQ0FBcEM7QUFDRCxPQUZELE1BRU87QUFDTCxhQUFLa0YsUUFBTCxDQUFjdEosT0FBZCxFQUF1Qm9FLFFBQXZCO0FBQ0Q7QUFDRCxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7NkJBUVNwRSxPLEVBQVNvRSxRLEVBQVU7QUFBQTs7QUFDMUIsVUFBSSxDQUFDcEUsUUFBUXNELElBQWIsRUFBbUJ0RCxRQUFRc0QsSUFBUixHQUFlLEVBQWY7QUFDbkIsVUFBTWlHLGdCQUFnQixTQUFoQkEsYUFBZ0IsQ0FBQy9GLE1BQUQsRUFBWTtBQUNoQyxlQUFLZ0csVUFBTCxDQUFnQmhHLE1BQWhCLEVBQXdCWSxRQUF4QjtBQUNELE9BRkQ7QUFHQSxVQUFNOEQsU0FBU2xJLFFBQVFzRCxJQUFSLENBQWE0RSxNQUE1QjtBQUNBLFVBQUlDLFVBQVVuSSxRQUFRc0QsSUFBUixDQUFhNkUsT0FBM0I7QUFDQSxVQUFJRCxVQUFVLENBQUNDLE9BQWYsRUFBd0JBLFVBQVUsQ0FBQ0QsTUFBRCxDQUFWOztBQUV4QixXQUFLbEgsV0FBTCxDQUFpQm9ILE9BQWpCLENBQXlCLElBQUk1SSxZQUFKLENBQWlCO0FBQ3hDbUIsYUFBS1gsUUFBUVcsR0FEMkI7QUFFeENvRCxjQUFNL0QsUUFBUStELElBRjBCO0FBR3hDVixnQkFBUXJELFFBQVFxRCxNQUh3QjtBQUl4Q2lGLG1CQUFXdEksUUFBUXNELElBQVIsQ0FBYWdGLFNBQWIsSUFBMEJ0SSxRQUFRcUQsTUFKTDtBQUt4QzZGLGlCQUFTbEosUUFBUWtKLE9BTHVCO0FBTXhDOUUsa0JBQVVtRixhQU44QjtBQU94Q3JCLHNCQVB3QztBQVF4Q0M7QUFSd0MsT0FBakIsQ0FBekI7QUFVRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztnQ0FhWW5JLE8sRUFBU29FLFEsRUFBVXFGLFUsRUFBWTtBQUFBOztBQUN6QzVLLFVBQUltQixPQUFKLEVBQWEsVUFBQ3dELE1BQUQsRUFBWTtBQUN2QixZQUFJLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCa0csT0FBaEIsQ0FBd0JsRyxPQUFPbUcsTUFBL0IsTUFBMkMsQ0FBQyxDQUE1QyxJQUFpREYsYUFBYTNKLGVBQWxFLEVBQW1GO0FBQ2pGNEQscUJBQVc7QUFBQSxtQkFBTSxPQUFLMkYsV0FBTCxDQUFpQnJKLE9BQWpCLEVBQTBCb0UsUUFBMUIsRUFBb0NxRixhQUFhLENBQWpELENBQU47QUFBQSxXQUFYLEVBQXNFLElBQXRFO0FBQ0QsU0FGRCxNQUVPO0FBQ0wsaUJBQUtELFVBQUwsQ0FBZ0JoRyxNQUFoQixFQUF3QlksUUFBeEI7QUFDRDtBQUNGLE9BTkQ7QUFPRDs7QUFFRDs7Ozs7Ozs7OztnQ0FPWThFLE8sRUFBUztBQUNuQixVQUFJLEtBQUszSCxZQUFMLElBQXFCLENBQUMySCxRQUFRVSxhQUFsQyxFQUFpRDtBQUMvQ1YsZ0JBQVFXLGFBQVIsR0FBd0IsMEJBQTJCLEtBQUt0SSxZQUFoQyxHQUErQyxHQUF2RSxDQUQrQyxDQUM2QjtBQUM3RTtBQUNGOztBQUVEOzs7Ozs7Ozs7Ozt3Q0FRb0JaLEcsRUFBSztBQUN2QixVQUFJNkMsU0FBUzdDLEdBQWI7QUFDQSxVQUFJQSxJQUFJK0ksT0FBSixDQUFZLFVBQVosTUFBNEIsQ0FBQyxDQUFqQyxFQUFvQztBQUNsQyxZQUFJL0ksSUFBSSxDQUFKLE1BQVcsR0FBZixFQUFvQjtBQUNsQjZDLG1CQUFTLEtBQUs3QyxHQUFMLEdBQVdBLEdBQXBCO0FBQ0QsU0FGRCxNQUVPO0FBQ0w2QyxtQkFBUyxLQUFLN0MsR0FBTCxHQUFXLEdBQVgsR0FBaUJBLEdBQTFCO0FBQ0Q7QUFDRjtBQUNELGFBQU82QyxNQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O21DQVdlMEYsTyxFQUFTO0FBQ3RCO0FBQ0E7QUFDQSxVQUFNWSxpQkFBaUJDLE9BQU9DLElBQVAsQ0FBWWQsT0FBWixDQUF2QjtBQUNBWSxxQkFBZUcsT0FBZixDQUF1QixVQUFDQyxVQUFELEVBQWdCO0FBQ3JDLFlBQUlBLGVBQWVBLFdBQVdDLFdBQVgsRUFBbkIsRUFBNkM7QUFDM0NqQixrQkFBUWdCLFdBQVdDLFdBQVgsRUFBUixJQUFvQ2pCLFFBQVFnQixVQUFSLENBQXBDO0FBQ0EsaUJBQU9oQixRQUFRZ0IsVUFBUixDQUFQO0FBQ0Q7QUFDRixPQUxEOztBQU9BLFVBQUksQ0FBQ2hCLFFBQVFrQixNQUFiLEVBQXFCbEIsUUFBUWtCLE1BQVIsR0FBaUIxSyxNQUFqQjs7QUFFckIsVUFBSSxDQUFDd0osUUFBUSxjQUFSLENBQUwsRUFBOEJBLFFBQVEsY0FBUixJQUEwQixrQkFBMUI7QUFDL0I7O0FBRUQ7Ozs7Ozs7Ozs7OytCQVFXMUYsTSxFQUFRWSxRLEVBQVU7QUFDM0IsVUFBSSxLQUFLaUcsV0FBVCxFQUFzQjs7QUFFdEIsVUFBSSxDQUFDN0csT0FBT0ssT0FBWixFQUFxQjtBQUNuQjtBQUNBLFlBQUlMLE9BQU9PLElBQVAsSUFBZSxRQUFPUCxPQUFPTyxJQUFkLE1BQXVCLFFBQTFDLEVBQW9EO0FBQ2xELGVBQUt1RyxjQUFMLENBQW9COUcsTUFBcEI7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7QUFDQSxZQUFJQSxPQUFPbUcsTUFBUCxLQUFrQixHQUFsQixJQUF5QixLQUFLN0QsZUFBbEMsRUFBbUQ7QUFDakRsRyxpQkFBTzJLLElBQVAsQ0FBWSxrQkFBWjtBQUNBLGVBQUt6RSxlQUFMLEdBQXVCLEtBQXZCO0FBQ0EsY0FBSTFFLE9BQU9DLFlBQVgsRUFBeUJBLGFBQWFZLFVBQWIsQ0FBd0J0QyxrQkFBa0IrQixXQUFsQixHQUFnQyxLQUFLekIsS0FBN0Q7QUFDekIsZUFBS2dFLE9BQUwsQ0FBYSxpQkFBYjtBQUNBLGVBQUtDLGFBQUwsQ0FBbUJWLE9BQU9PLElBQVAsQ0FBWXlHLFFBQVosRUFBbkI7QUFDRDtBQUNGO0FBQ0QsVUFBSXBHLFFBQUosRUFBY0EsU0FBU1osTUFBVDtBQUNmOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7bUNBWWVBLE0sRUFBUTtBQUNyQkEsYUFBT08sSUFBUCxHQUFjLElBQUk1RSxVQUFKLENBQWVxRSxPQUFPTyxJQUF0QixDQUFkO0FBQ0EsVUFBSSxDQUFDUCxPQUFPTyxJQUFQLENBQVkwRyxVQUFqQixFQUE2QmpILE9BQU9PLElBQVAsQ0FBWTBHLFVBQVosR0FBeUJqSCxPQUFPbUcsTUFBaEM7QUFDN0JuRyxhQUFPTyxJQUFQLENBQVkyRyxHQUFaO0FBQ0Q7O0FBRUQ7Ozs7O0VBbC9CZ0MzTCxJOztBQXMvQmxDOzs7Ozs7OztBQU1BZ0Isb0JBQW9CMkYsU0FBcEIsQ0FBOEJJLGVBQTlCLEdBQWdELEtBQWhEOztBQUVBOzs7Ozs7QUFNQS9GLG9CQUFvQjJGLFNBQXBCLENBQThCaEQsV0FBOUIsR0FBNEMsS0FBNUM7O0FBRUE7Ozs7Ozs7QUFPQTNDLG9CQUFvQjJGLFNBQXBCLENBQThCb0IsT0FBOUIsR0FBd0MsS0FBeEM7O0FBRUE7Ozs7OztBQU1BL0csb0JBQW9CMkYsU0FBcEIsQ0FBOEJ6RixLQUE5QixHQUFzQyxFQUF0Qzs7QUFFQTs7Ozs7QUFLQUYsb0JBQW9CMkYsU0FBcEIsQ0FBOEJ0RCxJQUE5QixHQUFxQyxJQUFyQzs7QUFFQTs7Ozs7O0FBTUFyQyxvQkFBb0IyRixTQUFwQixDQUE4Qm5FLFlBQTlCLEdBQTZDLEVBQTdDOztBQUVBOzs7Ozs7QUFNQXhCLG9CQUFvQjJGLFNBQXBCLENBQThCL0UsR0FBOUIsR0FBb0MsdUJBQXBDOztBQUVBOzs7Ozs7QUFNQVosb0JBQW9CMkYsU0FBcEIsQ0FBOEJpRixZQUE5QixHQUE2Qyw0QkFBN0M7O0FBRUE7Ozs7QUFJQTVLLG9CQUFvQjJGLFNBQXBCLENBQThCckYsYUFBOUIsR0FBOEMsSUFBOUM7O0FBRUE7Ozs7QUFJQU4sb0JBQW9CMkYsU0FBcEIsQ0FBOEJsRixvQkFBOUIsR0FBcUQsSUFBckQ7O0FBRUE7Ozs7QUFJQVQsb0JBQW9CMkYsU0FBcEIsQ0FBOEJuRixtQkFBOUIsR0FBb0QsSUFBcEQ7O0FBRUE7Ozs7QUFJQVIsb0JBQW9CMkYsU0FBcEIsQ0FBOEIxRSxXQUE5QixHQUE0QyxJQUE1Qzs7QUFFQTs7OztBQUlBakIsb0JBQW9CMkYsU0FBcEIsQ0FBOEJqRixhQUE5QixHQUE4QyxJQUE5Qzs7QUFFQTs7OztBQUlBVixvQkFBb0IyRixTQUFwQixDQUE4QjlDLGVBQTlCLEdBQWdELEtBQWhEOztBQUVBOzs7OztBQUtBN0Msb0JBQW9CMkYsU0FBcEIsQ0FBOEJLLG9CQUE5QixHQUFxRCxLQUFyRDs7QUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTRCQWhHLG9CQUFvQjJGLFNBQXBCLENBQThCcEUsbUJBQTlCLEdBQW9ELElBQXBEOztBQUVBOzs7O0FBSUF2QixvQkFBb0IyRixTQUFwQixDQUE4QnZFLFNBQTlCLEdBQTBDLElBQTFDOztBQUVBOzs7OztBQUtBcEIsb0JBQW9CMkYsU0FBcEIsQ0FBOEJtQix1QkFBOUIsR0FBd0QsS0FBeEQ7O0FBRUE7Ozs7Ozs7OztBQVNBa0QsT0FBT2EsY0FBUCxDQUFzQjdLLG9CQUFvQjJGLFNBQTFDLEVBQXFELFVBQXJELEVBQWlFO0FBQy9EbUYsY0FBWSxJQURtRDtBQUUvREMsT0FBSyxTQUFTQSxHQUFULEdBQWU7QUFDbEIsV0FBTyxLQUFLckssYUFBTCxJQUFzQixLQUFLQSxhQUFMLENBQW1Ca0ksUUFBaEQ7QUFDRDtBQUo4RCxDQUFqRTs7QUFPQTs7Ozs7Ozs7Ozs7QUFXQW9CLE9BQU9hLGNBQVAsQ0FBc0I3SyxvQkFBb0IyRixTQUExQyxFQUFxRCxVQUFyRCxFQUFpRTtBQUMvRG1GLGNBQVksS0FEbUQ7QUFFL0RDLE9BQUssU0FBU0EsR0FBVCxHQUFlO0FBQUUsV0FBT2xMLE9BQU9tTCxLQUFkO0FBQXNCLEdBRm1CO0FBRy9EQyxPQUFLLFNBQVNBLEdBQVQsQ0FBYUMsS0FBYixFQUFvQjtBQUFFckwsV0FBT21MLEtBQVAsR0FBZUUsS0FBZjtBQUF1QjtBQUhhLENBQWpFOztBQU1BOzs7Ozs7O0FBT0FsQixPQUFPYSxjQUFQLENBQXNCN0ssb0JBQW9CMkYsU0FBMUMsRUFBcUQsUUFBckQsRUFBK0Q7QUFDN0RtRixjQUFZLElBRGlEO0FBRTdEQyxPQUFLLFNBQVNBLEdBQVQsR0FBZTtBQUNsQixXQUFPLEtBQUsxSSxJQUFMLEdBQVksS0FBS0EsSUFBTCxDQUFVSSxNQUF0QixHQUErQixFQUF0QztBQUNELEdBSjREO0FBSzdEd0ksT0FBSyxTQUFTQSxHQUFULEdBQWUsQ0FBRTtBQUx1QyxDQUEvRDs7QUFRQTs7Ozs7OztBQU9Bakwsb0JBQW9CZ0oseUJBQXBCLEdBQWdELE9BQU8sRUFBUCxHQUFZLEVBQVosR0FBaUIsRUFBakU7O0FBRUE7Ozs7OztBQU1BaEosb0JBQW9CbUwsZ0JBQXBCLEdBQXVDO0FBQ3JDOzs7Ozs7Ozs7QUFTQSxPQVZxQzs7QUFZckM7Ozs7OztBQU1BLFdBbEJxQzs7QUFvQnJDOzs7Ozs7OztBQVFBLGlCQTVCcUM7O0FBOEJyQzs7Ozs7QUFLQSxlQW5DcUM7O0FBcUNyQzs7Ozs7Ozs7OztBQVVBLHFCQS9DcUM7O0FBaURyQzs7Ozs7Ozs7QUFRQSxpQkF6RHFDOztBQTJEckM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLFdBL0VxQzs7QUFpRnJDOzs7Ozs7Ozs7O0FBVUEsb0JBM0ZxQzs7QUE2RnJDOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxRQTlHcUMsRUErR3JDQyxNQS9HcUMsQ0ErRzlCcE0sS0FBS21NLGdCQS9HeUIsQ0FBdkM7O0FBaUhBbk0sS0FBS3FNLFNBQUwsQ0FBZUMsS0FBZixDQUFxQnRMLG1CQUFyQixFQUEwQyxDQUFDQSxtQkFBRCxFQUFzQixxQkFBdEIsQ0FBMUM7O0FBRUF1TCxPQUFPQyxPQUFQLEdBQWlCeEwsbUJBQWpCIiwiZmlsZSI6ImNsaWVudC1hdXRoZW50aWNhdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMYXllciBDbGllbnQuICBBY2Nlc3MgdGhlIGxheWVyIGJ5IGNhbGxpbmcgY3JlYXRlIGFuZCByZWNlaXZpbmcgaXRcbiAqIGZyb20gdGhlIFwicmVhZHlcIiBjYWxsYmFjay5cblxuICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gICAgYXBwSWQ6IFwibGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZlwiLFxuICAgIGlzVHJ1c3RlZERldmljZTogZmFsc2UsXG4gICAgY2hhbGxlbmdlOiBmdW5jdGlvbihldnQpIHtcbiAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgIG9uU3VjY2VzczogZXZ0LmNhbGxiYWNrXG4gICAgICB9KTtcbiAgICB9LFxuICAgIHJlYWR5OiBmdW5jdGlvbihjbGllbnQpIHtcbiAgICAgIGFsZXJ0KFwiWWF5LCBJIGZpbmFsbHkgZ290IG15IGNsaWVudCFcIik7XG4gICAgfVxuICB9KS5jb25uZWN0KFwic2FtcGxldXNlcklkXCIpO1xuXG4gKiBUaGUgTGF5ZXIgQ2xpZW50L0NsaWVudEF1dGhlbnRpY2F0b3IgY2xhc3NlcyBoYXZlIGJlZW4gZGl2aWRlZCBpbnRvOlxuICpcbiAqIDEuIENsaWVudEF1dGhlbnRpY2F0b3I6IE1hbmFnZXMgYWxsIGF1dGhlbnRpY2F0aW9uIGFuZCBjb25uZWN0aXZpdHkgcmVsYXRlZCBpc3N1ZXNcbiAqIDIuIENsaWVudDogTWFuYWdlcyBhY2Nlc3MgdG8gQ29udmVyc2F0aW9ucywgUXVlcmllcywgTWVzc2FnZXMsIEV2ZW50cywgZXRjLi4uXG4gKlxuICogQGNsYXNzIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3JcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKlxuICovXG5cbmNvbnN0IHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBTb2NrZXRNYW5hZ2VyID0gcmVxdWlyZSgnLi93ZWJzb2NrZXRzL3NvY2tldC1tYW5hZ2VyJyk7XG5jb25zdCBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyID0gcmVxdWlyZSgnLi93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyJyk7XG5jb25zdCBXZWJzb2NrZXRSZXF1ZXN0TWFuYWdlciA9IHJlcXVpcmUoJy4vd2Vic29ja2V0cy9yZXF1ZXN0LW1hbmFnZXInKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJyk7XG5jb25zdCBPbmxpbmVNYW5hZ2VyID0gcmVxdWlyZSgnLi9vbmxpbmUtc3RhdGUtbWFuYWdlcicpO1xuY29uc3QgU3luY01hbmFnZXIgPSByZXF1aXJlKCcuL3N5bmMtbWFuYWdlcicpO1xuY29uc3QgRGJNYW5hZ2VyID0gcmVxdWlyZSgnLi9kYi1tYW5hZ2VyJyk7XG5jb25zdCBJZGVudGl0eSA9IHJlcXVpcmUoJy4vbW9kZWxzL2lkZW50aXR5Jyk7XG5jb25zdCB7IFhIUlN5bmNFdmVudCwgV2Vic29ja2V0U3luY0V2ZW50IH0gPSByZXF1aXJlKCcuL3N5bmMtZXZlbnQnKTtcbmNvbnN0IHsgQUNDRVBULCBMT0NBTFNUT1JBR0VfS0VZUyB9ID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuXG5jb25zdCBNQVhfWEhSX1JFVFJJRVMgPSAzO1xuXG5jbGFzcyBDbGllbnRBdXRoZW50aWNhdG9yIGV4dGVuZHMgUm9vdCB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBDbGllbnQuXG4gICAqXG4gICAqIFRoZSBhcHBJZCBpcyB0aGUgb25seSByZXF1aXJlZCBwYXJhbWV0ZXI6XG4gICAqXG4gICAqICAgICAgdmFyIGNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgKiAgICAgICAgICBhcHBJZDogXCJsYXllcjovLy9hcHBzL3N0YWdpbmcvdXVpZFwiXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEZvciB0cnVzdGVkIGRldmljZXMsIHlvdSBjYW4gZW5hYmxlIHN0b3JhZ2Ugb2YgZGF0YSB0byBpbmRleGVkREIgYW5kIGxvY2FsU3RvcmFnZSB3aXRoIHRoZSBgaXNUcnVzdGVkRGV2aWNlYCBhbmQgYGlzUGVyc2lzdGVuY2VFbmFibGVkYCBwcm9wZXJ0eTpcbiAgICpcbiAgICogICAgICB2YXIgY2xpZW50ID0gbmV3IENsaWVudCh7XG4gICAqICAgICAgICAgIGFwcElkOiBcImxheWVyOi8vL2FwcHMvc3RhZ2luZy91dWlkXCIsXG4gICAqICAgICAgICAgIGlzVHJ1c3RlZERldmljZTogdHJ1ZSxcbiAgICogICAgICAgICAgaXNQZXJzaXN0ZW5jZUVuYWJsZWQ6IHRydWVcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBvcHRpb25zLmFwcElkICAgICAgICAgICAtIFwibGF5ZXI6Ly8vYXBwcy9wcm9kdWN0aW9uL3V1aWRcIjsgSWRlbnRpZmllcyB3aGF0XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbiB3ZSBhcmUgY29ubmVjdGluZyB0by5cbiAgICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy51cmw9aHR0cHM6Ly9hcGkubGF5ZXIuY29tXSAtIFVSTCB0byBsb2cgaW50byBhIGRpZmZlcmVudCBSRVNUIHNlcnZlclxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubG9nTGV2ZWw9RVJST1JdIC0gUHJvdmlkZSBhIGxvZyBsZXZlbCB0aGF0IGlzIG9uZSBvZiBsYXllci5Db25zdGFudHMuTE9HLk5PTkUsIGxheWVyLkNvbnN0YW50cy5MT0cuRVJST1IsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5Db25zdGFudHMuTE9HLldBUk4sIGxheWVyLkNvbnN0YW50cy5MT0cuSU5GTywgbGF5ZXIuQ29uc3RhbnRzLkxPRy5ERUJVR1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmlzVHJ1c3RlZERldmljZT1mYWxzZV0gLSBJZiB0aGlzIGlzIG5vdCBhIHRydXN0ZWQgZGV2aWNlLCBubyBkYXRhIHdpbGwgYmUgd3JpdHRlbiB0byBpbmRleGVkREIgbm9yIGxvY2FsU3RvcmFnZSxcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2FyZGxlc3Mgb2YgYW55IHZhbHVlcyBpbiBsYXllci5DbGllbnQucGVyc2lzdGVuY2VGZWF0dXJlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmlzUGVyc2lzdGVuY2VFbmFibGVkPWZhbHNlXSBJZiBsYXllci5DbGllbnQuaXNQZXJzaXN0ZW5jZUVuYWJsZWQgaXMgdHJ1ZSwgdGhlbiBpbmRleGVkREIgd2lsbCBiZSB1c2VkIHRvIG1hbmFnZSBhIGNhY2hlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2luZyBRdWVyeSByZXN1bHRzLCBtZXNzYWdlcyBzZW50LCBhbmQgYWxsIGxvY2FsIG1vZGlmaWNhdGlvbnMgdG8gYmUgcGVyc2lzdGVkIGJldHdlZW4gcGFnZSByZWxvYWRzLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIC8vIFZhbGlkYXRlIHJlcXVpcmVkIHBhcmFtZXRlcnNcbiAgICBpZiAoIW9wdGlvbnMuYXBwSWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuYXBwSWRNaXNzaW5nKTtcblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIHN1YmNvbXBvbmVudHMgb2YgdGhlIENsaWVudEF1dGhlbnRpY2F0b3JcbiAgICpcbiAgICogQG1ldGhvZCBfaW5pdENvbXBvbmVudHNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9pbml0Q29tcG9uZW50cygpIHtcbiAgICAvLyBTZXR1cCB0aGUgd2Vic29ja2V0IG1hbmFnZXI7IHdvbid0IGNvbm5lY3QgdW50aWwgd2UgdHJpZ2dlciBhbiBhdXRoZW50aWNhdGVkIGV2ZW50XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyID0gbmV3IFNvY2tldE1hbmFnZXIoe1xuICAgICAgY2xpZW50OiB0aGlzLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zb2NrZXRDaGFuZ2VNYW5hZ2VyID0gbmV3IFdlYnNvY2tldENoYW5nZU1hbmFnZXIoe1xuICAgICAgY2xpZW50OiB0aGlzLFxuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zb2NrZXRSZXF1ZXN0TWFuYWdlciA9IG5ldyBXZWJzb2NrZXRSZXF1ZXN0TWFuYWdlcih7XG4gICAgICBjbGllbnQ6IHRoaXMsXG4gICAgICBzb2NrZXRNYW5hZ2VyOiB0aGlzLnNvY2tldE1hbmFnZXIsXG4gICAgfSk7XG5cbiAgICB0aGlzLm9ubGluZU1hbmFnZXIgPSBuZXcgT25saW5lTWFuYWdlcih7XG4gICAgICBzb2NrZXRNYW5hZ2VyOiB0aGlzLnNvY2tldE1hbmFnZXIsXG4gICAgICB0ZXN0VXJsOiB0aGlzLnVybCArICcvbm9uY2VzP2Nvbm5lY3Rpb24tdGVzdCcsXG4gICAgICBjb25uZWN0ZWQ6IHRoaXMuX2hhbmRsZU9ubGluZUNoYW5nZS5iaW5kKHRoaXMpLFxuICAgICAgZGlzY29ubmVjdGVkOiB0aGlzLl9oYW5kbGVPbmxpbmVDaGFuZ2UuYmluZCh0aGlzKSxcbiAgICB9KTtcblxuICAgIHRoaXMuc3luY01hbmFnZXIgPSBuZXcgU3luY01hbmFnZXIoe1xuICAgICAgb25saW5lTWFuYWdlcjogdGhpcy5vbmxpbmVNYW5hZ2VyLFxuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgICAgcmVxdWVzdE1hbmFnZXI6IHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIsXG4gICAgICBjbGllbnQ6IHRoaXMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgc3ViY29tcG9uZW50cyBvZiB0aGUgQ2xpZW50QXV0aGVudGljYXRvclxuICAgKlxuICAgKiBAbWV0aG9kIF9kZXN0cm95Q29tcG9uZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2Rlc3Ryb3lDb21wb25lbnRzKCkge1xuICAgIHRoaXMuc3luY01hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnNvY2tldENoYW5nZU1hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIuZGVzdHJveSgpO1xuICAgIGlmICh0aGlzLmRiTWFuYWdlcikgdGhpcy5kYk1hbmFnZXIuZGVzdHJveSgpO1xuICB9XG5cblxuICAvKipcbiAgICogSXMgUGVyc2lzdGVkIFNlc3Npb24gVG9rZW5zIGRpc2FibGVkP1xuICAgKlxuICAgKiBAbWV0aG9kIF9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWRcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkge1xuICAgIHJldHVybiAhZ2xvYmFsLmxvY2FsU3RvcmFnZSB8fCAodGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzICYmICF0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMuc2Vzc2lvblRva2VuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXN0b3JlIHRoZSBzZXNzaW9uVG9rZW4gZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAqXG4gICAqIFRoaXMgc2V0cyB0aGUgc2Vzc2lvblRva2VuIHJhdGhlciB0aGFuIHJldHVybmluZyB0aGUgdG9rZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc3RvcmVMYXN0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc3RvcmVMYXN0U2Vzc2lvbigpIHtcbiAgICBpZiAodGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm47XG4gICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShzZXNzaW9uRGF0YSk7XG4gICAgICBpZiAocGFyc2VkRGF0YS5leHBpcmVzIDwgRGF0ZS5ub3coKSkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2Vzc2lvblRva2VuID0gcGFyc2VkRGF0YS5zZXNzaW9uVG9rZW47XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE5vLW9wXG4gICAgfVxuICB9XG5cbi8qKlxuICAgKiBSZXN0b3JlIHRoZSBJZGVudGl0eSBmb3IgdGhlIHNlc3Npb24gb3duZXIgZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc3RvcmVMYXN0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIF9yZXN0b3JlTGFzdFVzZXIoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gZ2xvYmFsLmxvY2FsU3RvcmFnZVtMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWRdO1xuICAgICAgaWYgKCFzZXNzaW9uRGF0YSkgcmV0dXJuIG51bGw7XG4gICAgICBjb25zdCB1c2VyT2JqID0gSlNPTi5wYXJzZShzZXNzaW9uRGF0YSkudXNlcjtcbiAgICAgIHJldHVybiBuZXcgSWRlbnRpdHkoe1xuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBmcm9tU2VydmVyOiB1c2VyT2JqLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYXMgdGhlIHVzZXJJRCBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGxvZ2luP1xuICAgKlxuICAgKiBAbWV0aG9kIF9oYXNVc2VySWRDaGFuZ2VkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWRcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFzVXNlcklkQ2hhbmdlZCh1c2VySWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHNlc3Npb25EYXRhKS51c2VyLnVzZXJfaWQgIT09IHVzZXJJZDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlcyB0aGUgY29ubmVjdGlvbi5cbiAgICpcbiAgICogQ2FsbGVkIGJ5IGNvbnN0cnVjdG9yKCkuXG4gICAqXG4gICAqIFdpbGwgZWl0aGVyIGF0dGVtcHQgdG8gdmFsaWRhdGUgdGhlIGNhY2hlZCBzZXNzaW9uVG9rZW4gYnkgZ2V0dGluZyBjb252ZXJzYXRpb25zLFxuICAgKiBvciBpZiBubyBzZXNzaW9uVG9rZW4sIHdpbGwgY2FsbCAvbm9uY2VzIHRvIHN0YXJ0IHByb2Nlc3Mgb2YgZ2V0dGluZyBhIG5ldyBvbmUuXG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe2FwcElkOiBteUFwcElkfSk7XG4gICAqIGNsaWVudC5jb25uZWN0KCdGcm9kby10aGUtRG9kbycpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBjb25uZWN0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWQgLSBVc2VyIElEIG9mIHRoZSB1c2VyIHlvdSBhcmUgbG9nZ2luZyBpbiBhc1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgY29ubmVjdCh1c2VySWQgPSAnJykge1xuICAgIGxldCB1c2VyO1xuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5zdGFydCgpO1xuICAgIGlmICghdGhpcy5pc1RydXN0ZWREZXZpY2UgfHwgIXVzZXJJZCB8fCB0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSB8fCB0aGlzLl9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkpIHtcbiAgICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgpO1xuICAgIH1cblxuXG4gICAgaWYgKHRoaXMuaXNUcnVzdGVkRGV2aWNlICYmIHVzZXJJZCkge1xuICAgICAgdGhpcy5fcmVzdG9yZUxhc3RTZXNzaW9uKHVzZXJJZCk7XG4gICAgICB1c2VyID0gdGhpcy5fcmVzdG9yZUxhc3RVc2VyKCk7XG4gICAgICBpZiAodXNlcikgdGhpcy51c2VyID0gdXNlcjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudXNlcikge1xuICAgICAgdGhpcy51c2VyID0gbmV3IElkZW50aXR5KHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBzZXNzaW9uT3duZXI6IHRydWUsXG4gICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICBpZDogdXNlcklkID8gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudCh1c2VySWQpIDogJycsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zZXNzaW9uVG9rZW4gJiYgdGhpcy51c2VyLnVzZXJJZCkge1xuICAgICAgdGhpcy5fc2Vzc2lvblRva2VuUmVzdG9yZWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy54aHIoe1xuICAgICAgICB1cmw6ICcvbm9uY2VzJyxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0ID0+IHRoaXMuX2Nvbm5lY3Rpb25SZXNwb25zZShyZXN1bHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhdGVzIHRoZSBjb25uZWN0aW9uIHdpdGggYSBzZXNzaW9uIHRva2VuLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgaXMgZm9yIHVzZSB3aGVuIHlvdSBoYXZlIHJlY2VpdmVkIGEgU2Vzc2lvbiBUb2tlbiBmcm9tIHNvbWUgb3RoZXIgc291cmNlOyBzdWNoIGFzIHlvdXIgc2VydmVyLFxuICAgKiBhbmQgd2lzaCB0byB1c2UgdGhhdCBpbnN0ZWFkIG9mIGRvaW5nIGEgZnVsbCBhdXRoIHByb2Nlc3MuXG4gICAqXG4gICAqIFRoZSBDbGllbnQgd2lsbCBwcmVzdW1lIHRoZSB0b2tlbiB0byBiZSB2YWxpZCwgYW5kIHdpbGwgYXN5bmNocm9ub3VzbHkgdHJpZ2dlciB0aGUgYHJlYWR5YCBldmVudC5cbiAgICogSWYgdGhlIHRva2VuIHByb3ZpZGVkIGlzIE5PVCB2YWxpZCwgdGhpcyB3b24ndCBiZSBkZXRlY3RlZCB1bnRpbCBhIHJlcXVlc3QgaXMgbWFkZSB1c2luZyB0aGlzIHRva2VuLFxuICAgKiBhdCB3aGljaCBwb2ludCB0aGUgYGNoYWxsZW5nZWAgbWV0aG9kIHdpbGwgdHJpZ2dlci5cbiAgICpcbiAgICogTk9URTogVGhlIGBjb25uZWN0ZWRgIGV2ZW50IHdpbGwgbm90IGJlIHRyaWdnZXJlZCBvbiB0aGlzIHBhdGguXG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe2FwcElkOiBteUFwcElkfSk7XG4gICAqIGNsaWVudC5jb25uZWN0V2l0aFNlc3Npb24oJ0Zyb2RvLXRoZS1Eb2RvJywgbXlTZXNzaW9uVG9rZW4pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBjb25uZWN0V2l0aFNlc3Npb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IHVzZXJJZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2Vzc2lvblRva2VuXG4gICAqIEByZXR1cm5zIHtsYXllci5DbGllbnRBdXRoZW50aWNhdG9yfSB0aGlzXG4gICAqL1xuICBjb25uZWN0V2l0aFNlc3Npb24odXNlcklkLCBzZXNzaW9uVG9rZW4pIHtcbiAgICBsZXQgdXNlcjtcbiAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgIGlmICghdXNlcklkIHx8ICFzZXNzaW9uVG9rZW4pIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuc2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCk7XG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSB8fCB0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSB8fCB0aGlzLl9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkpIHtcbiAgICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1RydXN0ZWREZXZpY2UpIHtcbiAgICAgIHVzZXIgPSB0aGlzLl9yZXN0b3JlTGFzdFVzZXIoKTtcbiAgICAgIGlmICh1c2VyKSB0aGlzLnVzZXIgPSB1c2VyO1xuICAgIH1cblxuICAgIHRoaXMub25saW5lTWFuYWdlci5zdGFydCgpO1xuXG4gICAgaWYgKCF0aGlzLnVzZXIpIHtcbiAgICAgIHRoaXMudXNlciA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgaWQ6IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQodXNlcklkKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fYXV0aENvbXBsZXRlKHsgc2Vzc2lvbl90b2tlbjogc2Vzc2lvblRva2VuIH0sIGZhbHNlKSwgMSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gb3VyIHJlcXVlc3QgZm9yIGEgbm9uY2UgZ2V0cyBhIHJlc3BvbnNlLlxuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgY2FsbHMgX2Nvbm5lY3Rpb25FcnJvci5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgbm9uY2UsIGNhbGxzIF9jb25uZWN0aW9uQ29tcGxldGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25SZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdFxuICAgKi9cbiAgX2Nvbm5lY3Rpb25SZXNwb25zZShyZXN1bHQpIHtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uRXJyb3IocmVzdWx0LmRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uQ29tcGxldGUocmVzdWx0LmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXZSBhcmUgbm93IGNvbm5lY3RlZCAod2UgaGF2ZSBhIG5vbmNlKS5cbiAgICpcbiAgICogSWYgd2UgaGF2ZSBzdWNjZXNzZnVsbHkgcmV0cmlldmVkIGEgbm9uY2UsIHRoZW5cbiAgICogd2UgaGF2ZSBlbnRlcmVkIGEgXCJjb25uZWN0ZWRcIiBidXQgbm90IFwiYXV0aGVudGljYXRlZFwiIHN0YXRlLlxuICAgKiBTZXQgdGhlIHN0YXRlLCB0cmlnZ2VyIGFueSBldmVudHMsIGFuZCB0aGVuIHN0YXJ0IGF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7c3RyaW5nfSByZXN1bHQubm9uY2UgLSBUaGUgbm9uY2UgcHJvdmlkZWQgYnkgdGhlIHNlcnZlclxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkXG4gICAqL1xuICBfY29ubmVjdGlvbkNvbXBsZXRlKHJlc3VsdCkge1xuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkJyk7XG4gICAgdGhpcy5fYXV0aGVudGljYXRlKHJlc3VsdC5ub25jZSk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gd2UgZmFpbCB0byBnZXQgYSBub25jZS5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXJyb3J9IGVyclxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkLWVycm9yXG4gICAqL1xuICBfY29ubmVjdGlvbkVycm9yKGVycm9yKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQtZXJyb3InLCB7IGVycm9yIH0pO1xuICB9XG5cblxuICAvKiBDT05ORUNUIE1FVEhPRFMgRU5EICovXG5cbiAgLyogQVVUSEVOVElDQVRFIE1FVEhPRFMgQkVHSU4gKi9cblxuICAvKipcbiAgICogU3RhcnQgdGhlIGF1dGhlbnRpY2F0aW9uIHN0ZXAuXG4gICAqXG4gICAqIFdlIHN0YXJ0IGF1dGhlbnRpY2F0aW9uIGJ5IHRyaWdnZXJpbmcgYSBcImNoYWxsZW5nZVwiIGV2ZW50IHRoYXRcbiAgICogdGVsbHMgdGhlIGFwcCB0byB1c2UgdGhlIG5vbmNlIHRvIG9idGFpbiBhbiBpZGVudGl0eV90b2tlbi5cbiAgICpcbiAgICogQG1ldGhvZCBfYXV0aGVudGljYXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbm9uY2UgLSBUaGUgbm9uY2UgdG8gcHJvdmlkZSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICpcbiAgICogQGZpcmVzIGNoYWxsZW5nZVxuICAgKi9cbiAgX2F1dGhlbnRpY2F0ZShub25jZSkge1xuICAgIGlmIChub25jZSkge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFsbGVuZ2UnLCB7XG4gICAgICAgIG5vbmNlLFxuICAgICAgICBjYWxsYmFjazogdGhpcy5hbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZS5iaW5kKHRoaXMpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFjY2VwdCBhbiBpZGVudGl0eVRva2VuIGFuZCB1c2UgaXQgdG8gY3JlYXRlIGEgc2Vzc2lvbi5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB0aGlzIG1ldGhvZCBpcyBjYWxsZWQgdXNpbmcgdGhlIGZ1bmN0aW9uIHBvaW50ZXIgcHJvdmlkZWQgYnlcbiAgICogdGhlIGNoYWxsZW5nZSBldmVudCwgYnV0IGl0IGNhbiBhbHNvIGJlIGNhbGxlZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgICBnZXRJZGVudGl0eVRva2VuKG5vbmNlLCBmdW5jdGlvbihpZGVudGl0eVRva2VuKSB7XG4gICAqICAgICAgICAgIGNsaWVudC5hbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZShpZGVudGl0eVRva2VuKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW4gLSBJZGVudGl0eSB0b2tlbiBwcm92aWRlZCBieSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICovXG4gIGFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlKGlkZW50aXR5VG9rZW4pIHtcbiAgICAvLyBSZXBvcnQgYW4gZXJyb3IgaWYgbm8gaWRlbnRpdHlUb2tlbiBwcm92aWRlZFxuICAgIGlmICghaWRlbnRpdHlUb2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pZGVudGl0eVRva2VuTWlzc2luZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHVzZXJEYXRhID0gVXRpbC5kZWNvZGUoaWRlbnRpdHlUb2tlbi5zcGxpdCgnLicpWzFdKTtcbiAgICAgIGNvbnN0IGlkZW50aXR5T2JqID0gSlNPTi5wYXJzZSh1c2VyRGF0YSk7XG5cbiAgICAgIGlmICh0aGlzLnVzZXIudXNlcklkICYmIHRoaXMudXNlci51c2VySWQgIT09IGlkZW50aXR5T2JqLnBybikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmludmFsaWRVc2VySWRDaGFuZ2UpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVzZXIuX3NldFVzZXJJZChpZGVudGl0eU9iai5wcm4pO1xuXG4gICAgICBpZiAoaWRlbnRpdHlPYmouZGlzcGxheV9uYW1lKSB0aGlzLnVzZXIuZGlzcGxheU5hbWUgPSBpZGVudGl0eU9iai5kaXNwbGF5X25hbWU7XG4gICAgICBpZiAoaWRlbnRpdHlPYmouYXZhdGFyX3VybCkgdGhpcy51c2VyLmF2YXRhclVybCA9IGlkZW50aXR5T2JqLmF2YXRhcl91cmw7XG5cbiAgICAgIHRoaXMueGhyKHtcbiAgICAgICAgdXJsOiAnL3Nlc3Npb25zJyxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgaWRlbnRpdHlfdG9rZW46IGlkZW50aXR5VG9rZW4sXG4gICAgICAgICAgYXBwX2lkOiB0aGlzLmFwcElkLFxuICAgICAgICB9LFxuICAgICAgfSwgcmVzdWx0ID0+IHRoaXMuX2F1dGhSZXNwb25zZShyZXN1bHQsIGlkZW50aXR5VG9rZW4pKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gb3VyIHJlcXVlc3QgZm9yIGEgc2Vzc2lvblRva2VuIHJlY2VpdmVzIGEgcmVzcG9uc2UuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX2F1dGhSZXNwb25zZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW5cbiAgICovXG4gIF9hdXRoUmVzcG9uc2UocmVzdWx0LCBpZGVudGl0eVRva2VuKSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5fYXV0aEVycm9yKHJlc3VsdC5kYXRhLCBpZGVudGl0eVRva2VuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXV0aENvbXBsZXRlKHJlc3VsdC5kYXRhLCBmYWxzZSk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogQXV0aGVudGljYXRpb24gaXMgY29tcGxldGVkLCB1cGRhdGUgc3RhdGUgYW5kIHRyaWdnZXIgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hdXRoQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gZnJvbVBlcnNpc3RlbmNlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVzdWx0LnNlc3Npb25fdG9rZW4gLSBTZXNzaW9uIHRva2VuIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAZmlyZXMgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgX2F1dGhDb21wbGV0ZShyZXN1bHQsIGZyb21QZXJzaXN0ZW5jZSkge1xuICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQuc2Vzc2lvbl90b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5zZXNzaW9uVG9rZW5NaXNzaW5nKTtcbiAgICB9XG4gICAgdGhpcy5zZXNzaW9uVG9rZW4gPSByZXN1bHQuc2Vzc2lvbl90b2tlbjtcblxuICAgIC8vIElmIF9hdXRoQ29tcGxldGUgd2FzIGNhbGxlZCBiZWNhdXNlIHdlIGFjY2VwdGVkIGFuIGF1dGggbG9hZGVkIGZyb20gc3RvcmFnZVxuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gdXBkYXRlIHN0b3JhZ2UuXG4gICAgaWYgKCF0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSAmJiAhZnJvbVBlcnNpc3RlbmNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2Vzc2lvblRva2VuOiB0aGlzLnNlc3Npb25Ub2tlbiB8fCAnJyxcbiAgICAgICAgICB1c2VyOiBEYk1hbmFnZXIucHJvdG90eXBlLl9nZXRJZGVudGl0eURhdGEoW3RoaXMudXNlcl0sIHRydWUpWzBdLFxuICAgICAgICAgIGV4cGlyZXM6IERhdGUubm93KCkgKyAoMzAgKiA2MCAqIDYwICogMjQgKiAxMDAwKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIERvIG5vdGhpbmdcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9jbGllbnRBdXRoZW50aWNhdGVkKCk7XG4gIH1cblxuICAvKipcbiAgICogQXV0aGVudGljYXRpb24gaGFzIGZhaWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfYXV0aEVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXJyb3J9IHJlc3VsdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW4gTm90IGN1cnJlbnRseSB1c2VkXG4gICAqXG4gICAqIEBmaXJlcyBhdXRoZW50aWNhdGVkLWVycm9yXG4gICAqL1xuICBfYXV0aEVycm9yKGVycm9yLCBpZGVudGl0eVRva2VuKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdhdXRoZW50aWNhdGVkLWVycm9yJywgeyBlcnJvciB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHN0YXRlIGFuZCB0cmlnZ2VycyBldmVudHMgZm9yIGJvdGggY29ubmVjdGVkIGFuZCBhdXRoZW50aWNhdGVkLlxuICAgKlxuICAgKiBJZiByZXVzaW5nIGEgc2Vzc2lvblRva2VuIGNhY2hlZCBpbiBsb2NhbFN0b3JhZ2UsXG4gICAqIHVzZSB0aGlzIG1ldGhvZCByYXRoZXIgdGhhbiBfYXV0aENvbXBsZXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXNzaW9uVG9rZW5SZXN0b3JlZFxuICAgKiBAcHJpdmF0ZVxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkLCBhdXRoZW50aWNhdGVkXG4gICAqL1xuICBfc2Vzc2lvblRva2VuUmVzdG9yZWQoKSB7XG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IHRydWU7XG4gICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQnKTtcbiAgICB0aGlzLl9jbGllbnRBdXRoZW50aWNhdGVkKCk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGNsaWVudCBpcyBub3cgYXV0aGVudGljYXRlZCwgYW5kIGRvaW5nIHNvbWUgc2V0dXBcbiAgICogYmVmb3JlIGNhbGxpbmcgX2NsaWVudFJlYWR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGllbnRBdXRoZW50aWNhdGVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xpZW50QXV0aGVudGljYXRlZCgpIHtcbiAgICAvLyBVcGRhdGUgc3RhdGUgYW5kIHRyaWdnZXIgdGhlIGV2ZW50XG4gICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignYXV0aGVudGljYXRlZCcpO1xuXG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSkgdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCA9IGZhbHNlO1xuXG5cbiAgICAvLyBJZiBubyBwZXJzaXN0ZW5jZUZlYXR1cmVzIGFyZSBzcGVjaWZpZWQsIHNldCB0aGVtIGFsbFxuICAgIC8vIHRvIHRydWUgb3IgZmFsc2UgdG8gbWF0Y2ggaXNUcnVzdGVkRGV2aWNlLlxuICAgIGlmICghdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzIHx8ICF0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkKSB7XG4gICAgICBsZXQgc2Vzc2lvblRva2VuO1xuICAgICAgaWYgKHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcyAmJiAnc2Vzc2lvblRva2VuJyBpbiB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMpIHtcbiAgICAgICAgc2Vzc2lvblRva2VuID0gQm9vbGVhbih0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMuc2Vzc2lvblRva2VuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlc3Npb25Ub2tlbiA9IHRoaXMuaXNUcnVzdGVkRGV2aWNlO1xuICAgICAgfVxuICAgICAgdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzID0ge1xuICAgICAgICBjb252ZXJzYXRpb25zOiB0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkLFxuICAgICAgICBjaGFubmVsczogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgbWVzc2FnZXM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIGlkZW50aXRpZXM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIHN5bmNRdWV1ZTogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgc2Vzc2lvblRva2VuLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBTZXR1cCB0aGUgRGF0YWJhc2UgTWFuYWdlclxuICAgIGlmICghdGhpcy5kYk1hbmFnZXIpIHtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyID0gbmV3IERiTWFuYWdlcih7XG4gICAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgICAgdGFibGVzOiB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCZWZvcmUgY2FsbGluZyBfY2xpZW50UmVhZHksIGxvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIElkZW50aXR5LlxuICAgIGlmICh0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlci5vbk9wZW4oKCkgPT4gdGhpcy5fbG9hZFVzZXIoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xvYWRVc2VyKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIGlkZW50aXR5LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgZmFpbHVyZSB0byBsb2FkIHRoZSBpZGVudGl0eSB3aWxsIG5vdCBwcmV2ZW50XG4gICAqIF9jbGllbnRSZWFkeSwgYnV0IGlzIGNlcnRhaW5seSBub3QgYSBkZXNpcmVkIG91dGNvbWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRVc2VyXG4gICAqL1xuICBfbG9hZFVzZXIoKSB7XG4gICAgLy8gV2UncmUgZG9uZSBpZiB3ZSBnb3QgdGhlIGZ1bGwgaWRlbnRpdHkgZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAgaWYgKHRoaXMudXNlci5pc0Z1bGxJZGVudGl0eSkge1xuICAgICAgdGhpcy5fY2xpZW50UmVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbG9hZCB0aGUgdXNlcidzIGZ1bGwgSWRlbnRpdHkgYW5kIHVwZGF0ZSBsb2NhbFN0b3JhZ2VcbiAgICAgIHRoaXMudXNlci5fbG9hZCgpO1xuICAgICAgdGhpcy51c2VyLm9uY2UoJ2lkZW50aXRpZXM6bG9hZGVkJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc2Vzc2lvbiBkYXRhIGluIGxvY2FsU3RvcmFnZSB3aXRoIG91ciBmdWxsIElkZW50aXR5LlxuICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBKU09OLnBhcnNlKGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXSk7XG4gICAgICAgICAgICBzZXNzaW9uRGF0YS51c2VyID0gRGJNYW5hZ2VyLnByb3RvdHlwZS5fZ2V0SWRlbnRpdHlEYXRhKFt0aGlzLnVzZXJdKVswXTtcbiAgICAgICAgICAgIGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXSA9IEpTT04uc3RyaW5naWZ5KHNlc3Npb25EYXRhKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBuby1vcFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGllbnRSZWFkeSgpO1xuICAgICAgfSlcbiAgICAgIC5vbmNlKCdpZGVudGl0aWVzOmxvYWRlZC1lcnJvcicsICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLnVzZXIuZGlzcGxheU5hbWUpIHRoaXMudXNlci5kaXNwbGF5TmFtZSA9IHRoaXMuZGVmYXVsdE93bmVyRGlzcGxheU5hbWU7XG4gICAgICAgIHRoaXMuX2NsaWVudFJlYWR5KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHRvIGZsYWcgdGhlIGNsaWVudCBhcyByZWFkeSBmb3IgYWN0aW9uLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgYWZ0ZXIgYXV0aGVuaWNhdGlvbiBBTkRcbiAgICogYWZ0ZXIgaW5pdGlhbCBjb252ZXJzYXRpb25zIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NsaWVudFJlYWR5XG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyByZWFkeVxuICAgKi9cbiAgX2NsaWVudFJlYWR5KCkge1xuICAgIGlmICghdGhpcy5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmlzUmVhZHkgPSB0cnVlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdyZWFkeScpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyogQ09OTkVDVCBNRVRIT0RTIEVORCAqL1xuXG5cbiAgLyogU1RBUlQgU0VTU0lPTiBNQU5BR0VNRU5UIE1FVEhPRFMgKi9cblxuICAvKipcbiAgICogRGVsZXRlcyB5b3VyIHNlc3Npb25Ub2tlbiBmcm9tIHRoZSBzZXJ2ZXIsIGFuZCByZW1vdmVzIGFsbCB1c2VyIGRhdGEgZnJvbSB0aGUgQ2xpZW50LlxuICAgKiBDYWxsIGBjbGllbnQuY29ubmVjdCgpYCB0byByZXN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBwcm9jZXNzLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgaXMgYXN5bmNocm9ub3VzOyBzb21lIGJyb3dzZXJzIChhaGVtLCBzYWZhcmkuLi4pIG1heSBub3QgaGF2ZSBjb21wbGV0ZWQgdGhlIGRlbGV0aW9uIG9mXG4gICAqIHBlcnNpc3RlZCBkYXRhIGlmIHlvdVxuICAgKiBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhlIHBhZ2UuICBVc2UgdGhlIGNhbGxiYWNrIHRvIGRldGVybWluZSB3aGVuIGFsbCBuZWNlc3NhcnkgY2xlYW51cCBoYXMgY29tcGxldGVkXG4gICAqIHByaW9yIHRvIG5hdmlnYXRpbmcgYXdheS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdoaWxlIGFsbCBkYXRhIHNob3VsZCBiZSBwdXJnZWQgZnJvbSB0aGUgYnJvd3Nlci9kZXZpY2UsIGlmIHlvdSBhcmUgb2ZmbGluZSB3aGVuIHRoaXMgaXMgY2FsbGVkLFxuICAgKiB5b3VyIHNlc3Npb24gdG9rZW4gd2lsbCBOT1QgYmUgZGVsZXRlZCBmcm9tIHRoZSB3ZWIgc2VydmVyLiAgV2h5IG5vdD8gQmVjYXVzZSBpdCB3b3VsZCBpbnZvbHZlIHJldGFpbmluZyB0aGVcbiAgICogcmVxdWVzdCBhZnRlciBhbGwgb2YgdGhlIHVzZXIncyBkYXRhIGhhcyBiZWVuIGRlbGV0ZWQsIG9yIE5PVCBkZWxldGluZyB0aGUgdXNlcidzIGRhdGEgdW50aWwgd2UgYXJlIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2dvdXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgbG9nb3V0KGNhbGxiYWNrKSB7XG4gICAgbGV0IGNhbGxiYWNrQ291bnQgPSAxLFxuICAgICAgY291bnRlciA9IDA7XG4gICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKSB7XG4gICAgICBjYWxsYmFja0NvdW50Kys7XG4gICAgICB0aGlzLnhocih7XG4gICAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICAgIHVybDogJy9zZXNzaW9ucy8nICsgZXNjYXBlKHRoaXMuc2Vzc2lvblRva2VuKSxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICB9LCAoKSA9PiB7XG4gICAgICAgIGNvdW50ZXIrKztcbiAgICAgICAgaWYgKGNvdW50ZXIgPT09IGNhbGxiYWNrQ291bnQgJiYgY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBkYXRhIGV2ZW4gaWYgaXNBdXRoZW50aWNhdGVkIGlzIGZhbHNlXG4gICAgLy8gU2Vzc2lvbiBtYXkgaGF2ZSBleHBpcmVkLCBidXQgZGF0YSBzdGlsbCBjYWNoZWQuXG4gICAgdGhpcy5fY2xlYXJTdG9yZWREYXRhKCgpID0+IHtcbiAgICAgIGNvdW50ZXIrKztcbiAgICAgIGlmIChjb3VudGVyID09PSBjYWxsYmFja0NvdW50ICYmIGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fcmVzZXRTZXNzaW9uKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIF9jbGVhclN0b3JlZERhdGEoY2FsbGJhY2spIHtcbiAgICBpZiAoZ2xvYmFsLmxvY2FsU3RvcmFnZSkgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICBpZiAodGhpcy5kYk1hbmFnZXIpIHtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyLmRlbGV0ZVRhYmxlcyhjYWxsYmFjayk7XG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9nIG91dC9jbGVhciBzZXNzaW9uIGluZm9ybWF0aW9uLlxuICAgKlxuICAgKiBVc2UgdGhpcyB0byBjbGVhciB0aGUgc2Vzc2lvblRva2VuIGFuZCBhbGwgaW5mb3JtYXRpb24gZnJvbSB0aGlzIHNlc3Npb24uXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc2V0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc2V0U2Vzc2lvbigpIHtcbiAgICB0aGlzLmlzUmVhZHkgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5zZXNzaW9uVG9rZW4pIHtcbiAgICAgIHRoaXMuc2Vzc2lvblRva2VuID0gJyc7XG4gICAgICBpZiAoZ2xvYmFsLmxvY2FsU3RvcmFnZSkge1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZhbHNlO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdkZWF1dGhlbnRpY2F0ZWQnKTtcbiAgICB0aGlzLm9ubGluZU1hbmFnZXIuc3RvcCgpO1xuICB9XG5cblxuICAvKipcbiAgICogUmVnaXN0ZXIgeW91ciBJT1MgZGV2aWNlIHRvIHJlY2VpdmUgbm90aWZpY2F0aW9ucy5cbiAgICogRm9yIHVzZSB3aXRoIG5hdGl2ZSBjb2RlIG9ubHkgKENvcmRvdmEsIFJlYWN0IE5hdGl2ZSwgVGl0YW5pdW0sIGV0Yy4uLilcbiAgICpcbiAgICogQG1ldGhvZCByZWdpc3RlcklPU1B1c2hUb2tlblxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy5kZXZpY2VJZCAtIFlvdXIgSU9TIGRldmljZSdzIGRldmljZSBJRFxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy5pb3NWZXJzaW9uIC0gWW91ciBJT1MgZGV2aWNlJ3MgdmVyc2lvbiBudW1iZXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMudG9rZW4gLSBZb3VyIEFwcGxlIEFQTlMgVG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmJ1bmRsZUlkXSAtIFlvdXIgQXBwbGUgQVBOUyBCdW5kbGUgSUQgKFwiY29tLmxheWVyLmJ1bmRsZWlkXCIpXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1udWxsXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gY2FsbGJhY2suZXJyb3IgLSBMYXllckVycm9yIGlmIHRoZXJlIHdhcyBhbiBlcnJvcjsgbnVsbCBpZiBzdWNjZXNzZnVsXG4gICAqL1xuICByZWdpc3RlcklPU1B1c2hUb2tlbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHRoaXMueGhyKHtcbiAgICAgIHVybDogJ3B1c2hfdG9rZW5zJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgc3luYzogZmFsc2UsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHRva2VuOiBvcHRpb25zLnRva2VuLFxuICAgICAgICB0eXBlOiAnYXBucycsXG4gICAgICAgIGRldmljZV9pZDogb3B0aW9ucy5kZXZpY2VJZCxcbiAgICAgICAgaW9zX3ZlcnNpb246IG9wdGlvbnMuaW9zVmVyc2lvbixcbiAgICAgICAgYXBuc19idW5kbGVfaWQ6IG9wdGlvbnMuYnVuZGxlSWQsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiBjYWxsYmFjayhyZXN1bHQuZGF0YSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHlvdXIgQW5kcm9pZCBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHJlZ2lzdGVyQW5kcm9pZFB1c2hUb2tlblxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy5kZXZpY2VJZCAtIFlvdXIgSU9TIGRldmljZSdzIGRldmljZSBJRFxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy50b2tlbiAtIFlvdXIgR0NNIHB1c2ggVG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMuc2VuZGVySWQgLSBZb3VyIEdDTSBTZW5kZXIgSUQvUHJvamVjdCBOdW1iZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPW51bGxdIC0gT3B0aW9uYWwgY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBjYWxsYmFjay5lcnJvciAtIExheWVyRXJyb3IgaWYgdGhlcmUgd2FzIGFuIGVycm9yOyBudWxsIGlmIHN1Y2Nlc3NmdWxcbiAgICovXG4gIHJlZ2lzdGVyQW5kcm9pZFB1c2hUb2tlbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHRoaXMueGhyKHtcbiAgICAgIHVybDogJ3B1c2hfdG9rZW5zJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgc3luYzogZmFsc2UsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHRva2VuOiBvcHRpb25zLnRva2VuLFxuICAgICAgICB0eXBlOiAnZ2NtJyxcbiAgICAgICAgZGV2aWNlX2lkOiBvcHRpb25zLmRldmljZUlkLFxuICAgICAgICBnY21fc2VuZGVyX2lkOiBvcHRpb25zLnNlbmRlcklkLFxuICAgICAgfSxcbiAgICB9LCByZXN1bHQgPT4gY2FsbGJhY2socmVzdWx0LmRhdGEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB5b3VyIEFuZHJvaWQgZGV2aWNlIHRvIHJlY2VpdmUgbm90aWZpY2F0aW9ucy5cbiAgICogRm9yIHVzZSB3aXRoIG5hdGl2ZSBjb2RlIG9ubHkgKENvcmRvdmEsIFJlYWN0IE5hdGl2ZSwgVGl0YW5pdW0sIGV0Yy4uLilcbiAgICpcbiAgICogQG1ldGhvZCB1bnJlZ2lzdGVyUHVzaFRva2VuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkZXZpY2VJZCAtIFlvdXIgSU9TIGRldmljZSdzIGRldmljZSBJRFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9bnVsbF0gLSBPcHRpb25hbCBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGNhbGxiYWNrLmVycm9yIC0gTGF5ZXJFcnJvciBpZiB0aGVyZSB3YXMgYW4gZXJyb3I7IG51bGwgaWYgc3VjY2Vzc2Z1bFxuICAgKi9cbiAgdW5yZWdpc3RlclB1c2hUb2tlbihkZXZpY2VJZCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnhocih7XG4gICAgICB1cmw6ICdwdXNoX3Rva2Vucy8nICsgZGV2aWNlSWQsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIHJlc3VsdCA9PiBjYWxsYmFjayhyZXN1bHQuZGF0YSkpO1xuICB9XG5cbiAgLyogU0VTU0lPTiBNQU5BR0VNRU5UIE1FVEhPRFMgRU5EICovXG5cblxuICAvKiBBQ0NFU1NPUiBNRVRIT0RTIEJFR0lOICovXG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBhdHRlbXB0IHRvIGV4ZWN1dGUgYHRoaXMudXNlckFwcElkID0gJ3h4eCdgIHdpbGwgY2F1c2UgYW4gZXJyb3IgdG8gYmUgdGhyb3duXG4gICAqIGlmIHRoZSBjbGllbnQgaXMgYWxyZWFkeSBjb25uZWN0ZWQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX19hZGp1c3RBcHBJZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBOZXcgYXBwSWQgdmFsdWVcbiAgICovXG4gIF9fYWRqdXN0QXBwSWQoKSB7XG4gICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2FudENoYW5nZUlmQ29ubmVjdGVkKTtcbiAgfVxuXG4gLyoqXG4gICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgKlxuICAqIEFueSBhdHRlbXB0IHRvIGV4ZWN1dGUgYHRoaXMudXNlciA9IHVzZXJJZGVudGl0eWAgd2lsbCBjYXVzZSBhbiBlcnJvciB0byBiZSB0aHJvd25cbiAgKiBpZiB0aGUgY2xpZW50IGlzIGFscmVhZHkgY29ubmVjdGVkLlxuICAqXG4gICogQHByaXZhdGVcbiAgKiBAbWV0aG9kIF9fYWRqdXN0VXNlclxuICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VyIC0gbmV3IElkZW50aXR5IG9iamVjdFxuICAqL1xuICBfX2FkanVzdFVzZXIodXNlcikge1xuICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNhbnRDaGFuZ2VJZkNvbm5lY3RlZCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmlydHVhbCBtZXRob2RzXG4gIF9hZGRJZGVudGl0eShpZGVudGl0eSkge31cbiAgX3JlbW92ZUlkZW50aXR5KGlkZW50aXR5KSB7fVxuXG5cbiAgLyogQUNDRVNTT1IgTUVUSE9EUyBFTkQgKi9cblxuXG4gIC8qIENPTU1VTklDQVRJT05TIE1FVEhPRFMgQkVHSU4gKi9cbiAgc2VuZFNvY2tldFJlcXVlc3QocGFyYW1zLCBjYWxsYmFjaykge1xuICAgIGlmIChwYXJhbXMuc3luYykge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gcGFyYW1zLnN5bmMudGFyZ2V0O1xuICAgICAgbGV0IGRlcGVuZHMgPSBwYXJhbXMuc3luYy5kZXBlbmRzO1xuICAgICAgaWYgKHRhcmdldCAmJiAhZGVwZW5kcykgZGVwZW5kcyA9IFt0YXJnZXRdO1xuXG4gICAgICB0aGlzLnN5bmNNYW5hZ2VyLnJlcXVlc3QobmV3IFdlYnNvY2tldFN5bmNFdmVudCh7XG4gICAgICAgIGRhdGE6IHBhcmFtcy5ib2R5LFxuICAgICAgICBvcGVyYXRpb246IHBhcmFtcy5tZXRob2QsXG4gICAgICAgIHRhcmdldCxcbiAgICAgICAgZGVwZW5kcyxcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICB9KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgcGFyYW1zLmRhdGEgPT09ICdmdW5jdGlvbicpIHBhcmFtcy5kYXRhID0gcGFyYW1zLmRhdGEoKTtcbiAgICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3QocGFyYW1zLCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgZXZlbnQgaGFuZGxlciByZWNlaXZlcyBldmVudHMgZnJvbSB0aGUgT25saW5lIFN0YXRlIE1hbmFnZXIgYW5kIGdlbmVyYXRlcyBhbiBldmVudCBmb3IgdGhvc2Ugc3Vic2NyaWJlZFxuICAgKiB0byBjbGllbnQub24oJ29ubGluZScpXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZU9ubGluZUNoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgX2hhbmRsZU9ubGluZUNoYW5nZShldnQpIHtcbiAgICBpZiAoIXRoaXMuaXNBdXRoZW50aWNhdGVkKSByZXR1cm47XG4gICAgY29uc3QgZHVyYXRpb24gPSBldnQub2ZmbGluZUR1cmF0aW9uO1xuICAgIGNvbnN0IGlzT25saW5lID0gZXZ0LmV2ZW50TmFtZSA9PT0gJ2Nvbm5lY3RlZCc7XG4gICAgY29uc3Qgb2JqID0geyBpc09ubGluZSB9O1xuICAgIGlmIChpc09ubGluZSkge1xuICAgICAgb2JqLnJlc2V0ID0gZHVyYXRpb24gPiBDbGllbnRBdXRoZW50aWNhdG9yLlJlc2V0QWZ0ZXJPZmZsaW5lRHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignb25saW5lJywgb2JqKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWluIGVudHJ5IHBvaW50IGZvciBzZW5kaW5nIHhociByZXF1ZXN0cyBvciBmb3IgcXVlaW5nIHRoZW0gaW4gdGhlIHN5bmNNYW5hZ2VyLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgYWRqdXN0IGFyZ3VtZW50cyBmb3Igb3VyIFJFU1Qgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIHhoclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBvcHRpb25zXG4gICAqIEBwYXJhbSAge3N0cmluZ30gICBvcHRpb25zLnVybCAtIFVSTCByZWxhdGl2ZSBjbGllbnQncyB1cmw6IFwiL2NvbnZlcnNhdGlvbnNcIlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIGNhbGxiYWNrLnJlc3VsdFxuICAgKiBAcGFyYW0gIHtNaXhlZH0gICAgY2FsbGJhY2sucmVzdWx0LmRhdGEgLSBJZiBhbiBlcnJvciBvY2N1cnJlZCwgdGhpcyBpcyBhIGxheWVyLkxheWVyRXJyb3I7XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWYgdGhlIHJlc3BvbnNlIHdhcyBhcHBsaWNhdGlvbi9qc29uLCB0aGlzIHdpbGwgYmUgYW4gb2JqZWN0XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWYgdGhlIHJlc3BvbnNlIHdhcyB0ZXh0L2VtcHR5LCB0aGlzIHdpbGwgYmUgdGV4dC9lbXB0eVxuICAgKiBAcGFyYW0gIHtYTUxIdHRwUmVxdWVzdH0gY2FsbGJhY2sucmVzdWx0LnhociAtIE5hdGl2ZSB4aHIgcmVxdWVzdCBvYmplY3QgZm9yIGRldGFpbGVkIGFuYWx5c2lzXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICBjYWxsYmFjay5yZXN1bHQuTGlua3MgLSBIYXNoIG9mIExpbmsgaGVhZGVyc1xuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnRBdXRoZW50aWNhdG9yfSB0aGlzXG4gICAqL1xuICB4aHIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIW9wdGlvbnMuc3luYyB8fCAhb3B0aW9ucy5zeW5jLnRhcmdldCkge1xuICAgICAgb3B0aW9ucy51cmwgPSB0aGlzLl94aHJGaXhSZWxhdGl2ZVVybHMob3B0aW9ucy51cmwgfHwgJycpO1xuICAgIH1cblxuICAgIG9wdGlvbnMud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICBpZiAoIW9wdGlvbnMubWV0aG9kKSBvcHRpb25zLm1ldGhvZCA9ICdHRVQnO1xuICAgIGlmICghb3B0aW9ucy5oZWFkZXJzKSBvcHRpb25zLmhlYWRlcnMgPSB7fTtcbiAgICB0aGlzLl94aHJGaXhIZWFkZXJzKG9wdGlvbnMuaGVhZGVycyk7XG4gICAgdGhpcy5feGhyRml4QXV0aChvcHRpb25zLmhlYWRlcnMpO1xuXG5cbiAgICAvLyBOb3RlOiB0aGlzIGlzIG5vdCBzeW5jIHZzIGFzeW5jOyB0aGlzIGlzIHN5bmNNYW5hZ2VyIHZzIGZpcmUgaXQgbm93XG4gICAgaWYgKG9wdGlvbnMuc3luYyA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuX25vbnN5bmNYaHIob3B0aW9ucywgY2FsbGJhY2ssIDApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogRm9yIHhociBjYWxscyB0aGF0IGdvIHRocm91Z2ggdGhlIHN5bmMgbWFuYWdlciwgcXVldWUgaXQgdXAuXG4gICAqXG4gICAqIEBtZXRob2QgX3N5bmNYaHJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdGlvbnNcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBfc3luY1hocihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghb3B0aW9ucy5zeW5jKSBvcHRpb25zLnN5bmMgPSB7fTtcbiAgICBjb25zdCBpbm5lckNhbGxiYWNrID0gKHJlc3VsdCkgPT4ge1xuICAgICAgdGhpcy5feGhyUmVzdWx0KHJlc3VsdCwgY2FsbGJhY2spO1xuICAgIH07XG4gICAgY29uc3QgdGFyZ2V0ID0gb3B0aW9ucy5zeW5jLnRhcmdldDtcbiAgICBsZXQgZGVwZW5kcyA9IG9wdGlvbnMuc3luYy5kZXBlbmRzO1xuICAgIGlmICh0YXJnZXQgJiYgIWRlcGVuZHMpIGRlcGVuZHMgPSBbdGFyZ2V0XTtcblxuICAgIHRoaXMuc3luY01hbmFnZXIucmVxdWVzdChuZXcgWEhSU3luY0V2ZW50KHtcbiAgICAgIHVybDogb3B0aW9ucy51cmwsXG4gICAgICBkYXRhOiBvcHRpb25zLmRhdGEsXG4gICAgICBtZXRob2Q6IG9wdGlvbnMubWV0aG9kLFxuICAgICAgb3BlcmF0aW9uOiBvcHRpb25zLnN5bmMub3BlcmF0aW9uIHx8IG9wdGlvbnMubWV0aG9kLFxuICAgICAgaGVhZGVyczogb3B0aW9ucy5oZWFkZXJzLFxuICAgICAgY2FsbGJhY2s6IGlubmVyQ2FsbGJhY2ssXG4gICAgICB0YXJnZXQsXG4gICAgICBkZXBlbmRzLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgeGhyIGNhbGxzIHRoYXQgZG9uJ3QgZ28gdGhyb3VnaCB0aGUgc3luYyBtYW5hZ2VyLFxuICAgKiBmaXJlIHRoZSByZXF1ZXN0LCBhbmQgaWYgaXQgZmFpbHMsIHJlZmlyZSBpdCB1cCB0byAzIHRyaWVzXG4gICAqIGJlZm9yZSByZXBvcnRpbmcgYW4gZXJyb3IuICAxIHNlY29uZCBkZWxheSBiZXR3ZWVuIHJlcXVlc3RzXG4gICAqIHNvIHdoYXRldmVyIGlzc3VlIGlzIG9jY3VyaW5nIGlzIGEgdGlueSBiaXQgbW9yZSBsaWtlbHkgdG8gcmVzb2x2ZSxcbiAgICogYW5kIHNvIHdlIGRvbid0IGhhbW1lciB0aGUgc2VydmVyIGV2ZXJ5IHRpbWUgdGhlcmUncyBhIHByb2JsZW0uXG4gICAqXG4gICAqIEBtZXRob2QgX25vbnN5bmNYaHJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdGlvbnNcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge251bWJlcn0gICByZXRyeUNvdW50XG4gICAqL1xuICBfbm9uc3luY1hocihvcHRpb25zLCBjYWxsYmFjaywgcmV0cnlDb3VudCkge1xuICAgIHhocihvcHRpb25zLCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoWzUwMiwgNTAzLCA1MDRdLmluZGV4T2YocmVzdWx0LnN0YXR1cykgIT09IC0xICYmIHJldHJ5Q291bnQgPCBNQVhfWEhSX1JFVFJJRVMpIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9ub25zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrLCByZXRyeUNvdW50ICsgMSksIDEwMDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5feGhyUmVzdWx0KHJlc3VsdCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeCBhdXRoZW50aWNhdGlvbiBoZWFkZXIgZm9yIGFuIHhociByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hockZpeEF1dGhcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBoZWFkZXJzXG4gICAqL1xuICBfeGhyRml4QXV0aChoZWFkZXJzKSB7XG4gICAgaWYgKHRoaXMuc2Vzc2lvblRva2VuICYmICFoZWFkZXJzLkF1dGhvcml6YXRpb24pIHtcbiAgICAgIGhlYWRlcnMuYXV0aG9yaXphdGlvbiA9ICdMYXllciBzZXNzaW9uLXRva2VuPVwiJyArICB0aGlzLnNlc3Npb25Ub2tlbiArICdcIic7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRml4IHJlbGF0aXZlIFVSTHMgdG8gY3JlYXRlIGFic29sdXRlIFVSTHMgbmVlZGVkIGZvciBDT1JTIHJlcXVlc3RzLlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJGaXhSZWxhdGl2ZVVybHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSByZWxhdGl2ZSBvciBhYnNvbHV0ZSB1cmxcbiAgICogQHJldHVybiB7c3RyaW5nfSBhYnNvbHV0ZSB1cmxcbiAgICovXG4gIF94aHJGaXhSZWxhdGl2ZVVybHModXJsKSB7XG4gICAgbGV0IHJlc3VsdCA9IHVybDtcbiAgICBpZiAodXJsLmluZGV4T2YoJ2h0dHBzOi8vJykgPT09IC0xKSB7XG4gICAgICBpZiAodXJsWzBdID09PSAnLycpIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy51cmwgKyB1cmw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnVybCArICcvJyArIHVybDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaXh1cCBhbGwgaGVhZGVycyBpbiBwcmVwYXJhdGlvbiBmb3IgYW4geGhyIGNhbGwuXG4gICAqXG4gICAqIDEuIEFsbCBoZWFkZXJzIHVzZSBsb3dlciBjYXNlIG5hbWVzIGZvciBzdGFuZGFyZC9lYXN5IGxvb2t1cFxuICAgKiAyLiBTZXQgdGhlIGFjY2VwdCBoZWFkZXJcbiAgICogMy4gSWYgbmVlZGVkLCBzZXQgdGhlIGNvbnRlbnQtdHlwZSBoZWFkZXJcbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRml4SGVhZGVyc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGhlYWRlcnNcbiAgICovXG4gIF94aHJGaXhIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAvLyBSZXBsYWNlIGFsbCBoZWFkZXJzIGluIGFyYml0cmFyeSBjYXNlIHdpdGggYWxsIGxvd2VyIGNhc2VcbiAgICAvLyBmb3IgZWFzeSBtYXRjaGluZy5cbiAgICBjb25zdCBoZWFkZXJOYW1lTGlzdCA9IE9iamVjdC5rZXlzKGhlYWRlcnMpO1xuICAgIGhlYWRlck5hbWVMaXN0LmZvckVhY2goKGhlYWRlck5hbWUpID0+IHtcbiAgICAgIGlmIChoZWFkZXJOYW1lICE9PSBoZWFkZXJOYW1lLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgaGVhZGVyc1toZWFkZXJOYW1lLnRvTG93ZXJDYXNlKCldID0gaGVhZGVyc1toZWFkZXJOYW1lXTtcbiAgICAgICAgZGVsZXRlIGhlYWRlcnNbaGVhZGVyTmFtZV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIWhlYWRlcnMuYWNjZXB0KSBoZWFkZXJzLmFjY2VwdCA9IEFDQ0VQVDtcblxuICAgIGlmICghaGVhZGVyc1snY29udGVudC10eXBlJ10pIGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSB0aGUgcmVzdWx0IG9mIGFuIHhociBjYWxsXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclJlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcmVzdWx0ICAgICBTdGFuZGFyZCB4aHIgcmVzcG9uc2Ugb2JqZWN0IGZyb20gdGhlIHhociBsaWJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYWxsYmFja10gQ2FsbGJhY2sgb24gY29tcGxldGlvblxuICAgKi9cbiAgX3hoclJlc3VsdChyZXN1bHQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcblxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIC8vIFJlcGxhY2UgdGhlIHJlc3BvbnNlIHdpdGggYSBMYXllckVycm9yIGluc3RhbmNlXG4gICAgICBpZiAocmVzdWx0LmRhdGEgJiYgdHlwZW9mIHJlc3VsdC5kYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLl9nZW5lcmF0ZUVycm9yKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIGl0cyBhbiBhdXRoZW50aWNhdGlvbiBlcnJvciwgcmVhdXRoZW50aWNhdGVcbiAgICAgIC8vIGRvbid0IGNhbGwgX3Jlc2V0U2Vzc2lvbiBhcyB0aGF0IHdpcGVzIGFsbCBkYXRhIGFuZCBzY3Jld3Mgd2l0aCBVSXMsIGFuZCB0aGUgdXNlclxuICAgICAgLy8gaXMgc3RpbGwgYXV0aGVudGljYXRlZCBvbiB0aGUgY3VzdG9tZXIncyBhcHAgZXZlbiBpZiBub3Qgb24gTGF5ZXIuXG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gNDAxICYmIHRoaXMuaXNBdXRoZW50aWNhdGVkKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdTRVNTSU9OIEVYUElSRUQhJyk7XG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZmFsc2U7XG4gICAgICAgIGlmIChnbG9iYWwubG9jYWxTdG9yYWdlKSBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ2RlYXV0aGVudGljYXRlZCcpO1xuICAgICAgICB0aGlzLl9hdXRoZW50aWNhdGUocmVzdWx0LmRhdGEuZ2V0Tm9uY2UoKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm1zIHhociBlcnJvciByZXNwb25zZSBpbnRvIGEgbGF5ZXIuTGF5ZXJFcnJvciBpbnN0YW5jZS5cbiAgICpcbiAgICogQWRkcyBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIHRvIHRoZSByZXN1bHQgb2JqZWN0IGluY2x1ZGluZ1xuICAgKlxuICAgKiAqIHVybFxuICAgKiAqIGRhdGFcbiAgICpcbiAgICogQG1ldGhvZCBfZ2VuZXJhdGVFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAtIFJlc3VsdCBvZiB0aGUgeGhyIGNhbGxcbiAgICovXG4gIF9nZW5lcmF0ZUVycm9yKHJlc3VsdCkge1xuICAgIHJlc3VsdC5kYXRhID0gbmV3IExheWVyRXJyb3IocmVzdWx0LmRhdGEpO1xuICAgIGlmICghcmVzdWx0LmRhdGEuaHR0cFN0YXR1cykgcmVzdWx0LmRhdGEuaHR0cFN0YXR1cyA9IHJlc3VsdC5zdGF0dXM7XG4gICAgcmVzdWx0LmRhdGEubG9nKCk7XG4gIH1cblxuICAvKiBFTkQgQ09NTVVOSUNBVElPTlMgTUVUSE9EUyAqL1xuXG59XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyBjdXJyZW50bHkgYXV0aGVudGljYXRlZCBieSB0aGUgc2VydmVyLlxuICogU2hvdWxkIG5ldmVyIGJlIHRydWUgaWYgaXNDb25uZWN0ZWQgaXMgZmFsc2UuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcblxuLyoqXG4gKiBTdGF0ZSB2YXJpYWJsZTsgaW5kaWNhdGVzIHRoYXQgY2xpZW50IGlzIGN1cnJlbnRseSBjb25uZWN0ZWQgdG8gc2VydmVyXG4gKiAobWF5IG5vdCBiZSBhdXRoZW50aWNhdGVkIHlldClcbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZmFsc2U7XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyByZWFkeSBmb3IgdGhlIGFwcCB0byB1c2UuXG4gKiBVc2UgdGhlICdyZWFkeScgZXZlbnQgdG8gYmUgbm90aWZpZWQgd2hlbiB0aGlzIHZhbHVlIGNoYW5nZXMgdG8gdHJ1ZS5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1JlYWR5ID0gZmFsc2U7XG5cbi8qKlxuICogWW91ciBMYXllciBBcHBsaWNhdGlvbiBJRC4gVGhpcyB2YWx1ZSBjYW4gbm90IGJlIGNoYW5nZWQgb25jZSBjb25uZWN0ZWQuXG4gKiBUbyBmaW5kIHlvdXIgTGF5ZXIgQXBwbGljYXRpb24gSUQsIHNlZSB5b3VyIExheWVyIERldmVsb3BlciBEYXNoYm9hcmQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuYXBwSWQgPSAnJztcblxuLyoqXG4gKiBJZGVudGl0eSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgYXV0aGVudGljYXRlZCB1c2VyLlxuICpcbiAqIEB0eXBlIHtsYXllci5JZGVudGl0eX1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUudXNlciA9IG51bGw7XG5cbi8qKlxuICogWW91ciBjdXJyZW50IHNlc3Npb24gdG9rZW4gdGhhdCBhdXRoZW50aWNhdGVzIHlvdXIgcmVxdWVzdHMuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5zZXNzaW9uVG9rZW4gPSAnJztcblxuLyoqXG4gKiBVUkwgdG8gTGF5ZXIncyBXZWIgQVBJIHNlcnZlci5cbiAqXG4gKiBPbmx5IG11Y2sgd2l0aCB0aGlzIGlmIHRvbGQgdG8gYnkgTGF5ZXIgU3RhZmYuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS51cmwgPSAnaHR0cHM6Ly9hcGkubGF5ZXIuY29tJztcblxuLyoqXG4gKiBVUkwgdG8gTGF5ZXIncyBXZWJzb2NrZXQgc2VydmVyLlxuICpcbiAqIE9ubHkgbXVjayB3aXRoIHRoaXMgaWYgdG9sZCB0byBieSBMYXllciBTdGFmZi5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLndlYnNvY2tldFVybCA9ICd3c3M6Ly93ZWJzb2NrZXRzLmxheWVyLmNvbSc7XG5cbi8qKlxuICogV2ViIFNvY2tldCBNYW5hZ2VyXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWIgU29ja2V0IFJlcXVlc3QgTWFuYWdlclxuKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0UmVxdWVzdE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFdlYiBTb2NrZXQgTWFuYWdlclxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0Q2hhbmdlTWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogU2VydmljZSBmb3IgbWFuYWdpbmcgb25saW5lIGFzIHdlbGwgYXMgb2ZmbGluZSBzZXJ2ZXIgcmVxdWVzdHNcbiAqIEB0eXBlIHtsYXllci5TeW5jTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc3luY01hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIG9ubGluZS9vZmZsaW5lIHN0YXRlIGFuZCBldmVudHNcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLm9ubGluZU1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIElmIHRoaXMgaXMgYSB0cnVzdGVkIGRldmljZSwgdGhlbiB3ZSBjYW4gd3JpdGUgcGVyc29uYWwgZGF0YSB0byBwZXJzaXN0ZW50IG1lbW9yeS5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1RydXN0ZWREZXZpY2UgPSBmYWxzZTtcblxuLyoqXG4gKiBUbyBlbmFibGUgaW5kZXhlZERCIHN0b3JhZ2Ugb2YgcXVlcnkgZGF0YSwgc2V0IHRoaXMgdHJ1ZS4gIEV4cGVyaW1lbnRhbC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzUGVyc2lzdGVuY2VFbmFibGVkID0gZmFsc2U7XG5cbi8qKlxuICogSWYgdGhpcyBsYXllci5DbGllbnQuaXNUcnVzdGVkRGV2aWNlIGlzIHRydWUsIHRoZW4geW91IGNhbiBjb250cm9sIHdoaWNoIHR5cGVzIG9mIGRhdGEgYXJlIHBlcnNpc3RlZC5cbiAqXG4gKiBOb3RlIHRoYXQgdmFsdWVzIGhlcmUgYXJlIGlnbm9yZWQgaWYgYGlzUGVyc2lzdGVuY2VFbmFibGVkYCBoYXNuJ3QgYmVlbiBzZXQgdG8gYHRydWVgLlxuICpcbiAqIFByb3BlcnRpZXMgb2YgdGhpcyBPYmplY3QgY2FuIGJlOlxuICpcbiAqICogaWRlbnRpdGllczogV3JpdGUgaWRlbnRpdGllcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmYXN0ZXIgaW5pdGlhbGl6YXRpb24uXG4gKiAqIGNvbnZlcnNhdGlvbnM6IFdyaXRlIGNvbnZlcnNhdGlvbnMgdG8gaW5kZXhlZERCPyBUaGlzIGFsbG93cyBmb3IgZmFzdGVyIHJlbmRlcmluZ1xuICogICAgICAgICAgICAgICAgICBvZiBhIENvbnZlcnNhdGlvbiBMaXN0XG4gKiAqIG1lc3NhZ2VzOiBXcml0ZSBtZXNzYWdlcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmdWxsIG9mZmxpbmUgYWNjZXNzXG4gKiAqIHN5bmNRdWV1ZTogV3JpdGUgcmVxdWVzdHMgbWFkZSB3aGlsZSBvZmZsaW5lIHRvIGluZGV4ZWREQj8gIFRoaXMgYWxsb3dzIHRoZSBhcHBcbiAqICAgICAgICAgICAgICB0byBjb21wbGV0ZSBzZW5kaW5nIG1lc3NhZ2VzIGFmdGVyIGJlaW5nIHJlbGF1bmNoZWQuXG4gKiAqIHNlc3Npb25Ub2tlbjogV3JpdGUgdGhlIHNlc3Npb24gdG9rZW4gdG8gbG9jYWxTdG9yYWdlIGZvciBxdWljayByZWF1dGhlbnRpY2F0aW9uIG9uIHJlbGF1bmNoaW5nIHRoZSBhcHAuXG4gKlxuICogICAgICBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAqICAgICAgICBpc1RydXN0ZWREZXZpY2U6IHRydWUsXG4gKiAgICAgICAgcGVyc2lzdGVuY2VGZWF0dXJlczoge1xuICogICAgICAgICAgY29udmVyc2F0aW9uczogdHJ1ZSxcbiAqICAgICAgICAgIGlkZW50aXRpZXM6IHRydWUsXG4gKiAgICAgICAgICBtZXNzYWdlczogZmFsc2UsXG4gKiAgICAgICAgICBzeW5jUXVldWU6IGZhbHNlLFxuICogICAgICAgICAgc2Vzc2lvblRva2VuOiB0cnVlXG4gKiAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5wZXJzaXN0ZW5jZUZlYXR1cmVzID0gbnVsbDtcblxuLyoqXG4gKiBEYXRhYmFzZSBNYW5hZ2VyIGZvciByZWFkL3dyaXRlIHRvIEluZGV4ZWREQlxuICogQHR5cGUge2xheWVyLkRiTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuZGJNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBJZiBhIGRpc3BsYXkgbmFtZSBpcyBub3QgbG9hZGVkIGZvciB0aGUgc2Vzc2lvbiBvd25lciwgdXNlIHRoaXMgbmFtZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5kZWZhdWx0T3duZXJEaXNwbGF5TmFtZSA9ICdZb3UnO1xuXG4vKipcbiAqIElzIHRydWUgaWYgdGhlIGNsaWVudCBpcyBhdXRoZW50aWNhdGVkIGFuZCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlcjtcbiAqXG4gKiBUeXBpY2FsbHkgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlcmUgaXMgYSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogVHlwaWNhbGx5IHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCB0aGUgYG9ubGluZWAgZXZlbnQuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2lzT25saW5lJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbmxpbmVNYW5hZ2VyICYmIHRoaXMub25saW5lTWFuYWdlci5pc09ubGluZTtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIExvZyBsZXZlbHM7IG9uZSBvZjpcbiAqXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuTk9ORVxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLkVSUk9SXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuV0FSTlxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLklORk9cbiAqICAgICogbGF5ZXIuQ29uc3RhbnRzLkxPRy5ERUJVR1xuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2xvZ0xldmVsJywge1xuICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7IHJldHVybiBsb2dnZXIubGV2ZWw7IH0sXG4gIHNldDogZnVuY3Rpb24gc2V0KHZhbHVlKSB7IGxvZ2dlci5sZXZlbCA9IHZhbHVlOyB9LFxufSk7XG5cbi8qKlxuICogU2hvcnQgaGFuZCBmb3IgZ2V0dGluZyB0aGUgdXNlcklkIG9mIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIuXG4gKlxuICogQ291bGQgYWxzbyBqdXN0IHVzZSBjbGllbnQudXNlci51c2VySWRcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfSB1c2VySWRcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KENsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLCAndXNlcklkJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VyID8gdGhpcy51c2VyLnVzZXJJZCA6ICcnO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uIHNldCgpIHt9LFxufSk7XG5cbi8qKlxuICogVGltZSB0byBiZSBvZmZsaW5lIGFmdGVyIHdoaWNoIHdlIGRvbid0IGRvIGEgV2ViU29ja2V0IEV2ZW50cy5yZXBsYXksXG4gKiBidXQgaW5zdGVhZCBqdXN0IHJlZnJlc2ggYWxsIG91ciBRdWVyeSBkYXRhLiAgRGVmYXVsdHMgdG8gMzAgaG91cnMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uID0gMTAwMCAqIDYwICogNjAgKiAzMDtcblxuLyoqXG4gKiBMaXN0IG9mIGV2ZW50cyBzdXBwb3J0ZWQgYnkgdGhpcyBjbGFzc1xuICogQHN0YXRpY1xuICogQHByb3RlY3RlZFxuICogQHR5cGUge3N0cmluZ1tdfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgY2xpZW50IGlzIHJlYWR5IGZvciBhY3Rpb25cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ3JlYWR5JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIHJlbmRlck15VUkoKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqL1xuICAncmVhZHknLFxuXG4gIC8qKlxuICAgKiBGaXJlZCB3aGVuIGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLlxuICAgKiBDdXJyZW50bHkganVzdCBtZWFucyB3ZSBoYXZlIGEgbm9uY2UuXG4gICAqIE5vdCByZWNvbW1lbmRlZCBmb3IgdHlwaWNhbCBhcHBsaWNhdGlvbnMuXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICovXG4gICdjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBGaXJlZCB3aGVuIHVuc3VjY2Vzc2Z1bCBpbiBvYnRhaW5pbmcgYSBub25jZS5cbiAgICpcbiAgICogTm90IHJlY29tbWVuZGVkIGZvciB0eXBpY2FsIGFwcGxpY2F0aW9ucy5cbiAgICogQGV2ZW50IGNvbm5lY3RlZC1lcnJvclxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2Nvbm5lY3RlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFdlIG5vdyBoYXZlIGEgc2Vzc2lvbiBhbmQgYW55IHJlcXVlc3RzIHdlIHNlbmQgYXVnaHQgdG8gd29yay5cbiAgICogVHlwaWNhbGx5IHlvdSBzaG91bGQgdXNlIHRoZSByZWFkeSBldmVudCBpbnN0ZWFkIG9mIHRoZSBhdXRoZW50aWNhdGVkIGV2ZW50LlxuICAgKiBAZXZlbnQgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgJ2F1dGhlbnRpY2F0ZWQnLFxuXG4gIC8qKlxuICAgKiBGYWlsZWQgdG8gYXV0aGVudGljYXRlIHlvdXIgY2xpZW50LlxuICAgKlxuICAgKiBFaXRoZXIgeW91ciBpZGVudGl0eS10b2tlbiB3YXMgaW52YWxpZCwgb3Igc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICogdXNpbmcgeW91ciBpZGVudGl0eS10b2tlbi5cbiAgICpcbiAgICogQGV2ZW50IGF1dGhlbnRpY2F0ZWQtZXJyb3JcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdhdXRoZW50aWNhdGVkLWVycm9yJyxcblxuICAvKipcbiAgICogVGhpcyBldmVudCBmaXJlcyB3aGVuIGEgc2Vzc2lvbiBoYXMgZXhwaXJlZCBvciB3aGVuIGBsYXllci5DbGllbnQubG9nb3V0YCBpcyBjYWxsZWQuXG4gICAqIFR5cGljYWxseSwgaXQgaXMgZW5vdWdoIHRvIHN1YnNjcmliZSB0byB0aGUgY2hhbGxlbmdlIGV2ZW50XG4gICAqIHdoaWNoIHdpbGwgbGV0IHlvdSByZWF1dGhlbnRpY2F0ZTsgdHlwaWNhbCBhcHBsaWNhdGlvbnMgZG8gbm90IG5lZWRcbiAgICogdG8gc3Vic2NyaWJlIHRvIHRoaXMuXG4gICAqXG4gICAqIEBldmVudCBkZWF1dGhlbnRpY2F0ZWRcbiAgICovXG4gICdkZWF1dGhlbnRpY2F0ZWQnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgY2hhbGxlbmdlXG4gICAqIFZlcmlmeSB0aGUgdXNlcidzIGlkZW50aXR5LlxuICAgKlxuICAgKiBUaGlzIGV2ZW50IGlzIHdoZXJlIHlvdSB2ZXJpZnkgdGhhdCB0aGUgdXNlciBpcyB3aG8gd2UgYWxsIHRoaW5rIHRoZSB1c2VyIGlzLFxuICAgKiBhbmQgcHJvdmlkZSBhbiBpZGVudGl0eSB0b2tlbiB0byB2YWxpZGF0ZSB0aGF0LlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIGNsaWVudC5vbignY2hhbGxlbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIG15R2V0SWRlbnRpdHlGb3JOb25jZShldnQubm9uY2UsIGZ1bmN0aW9uKGlkZW50aXR5VG9rZW4pIHtcbiAgICogICAgICBldnQuY2FsbGJhY2soaWRlbnRpdHlUb2tlbik7XG4gICAqICAgIH0pO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQubm9uY2UgLSBBIG5vbmNlIGZvciB5b3UgdG8gcHJvdmlkZSB0byB5b3VyIGlkZW50aXR5IHByb3ZpZGVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGV2ZW50LmNhbGxiYWNrIC0gQ2FsbCB0aGlzIG9uY2UgeW91IGhhdmUgYW4gaWRlbnRpdHktdG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LmNhbGxiYWNrLmlkZW50aXR5VG9rZW4gLSBJZGVudGl0eSB0b2tlbiBwcm92aWRlZCBieSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICovXG4gICdjaGFsbGVuZ2UnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgc2Vzc2lvbi10ZXJtaW5hdGVkXG4gICAqIElmIHlvdXIgc2Vzc2lvbiBoYXMgYmVlbiB0ZXJtaW5hdGVkIGluIHN1Y2ggYSB3YXkgYXMgdG8gcHJldmVudCBhdXRvbWF0aWMgcmVjb25uZWN0LFxuICAgKlxuICAgKiB0aGlzIGV2ZW50IHdpbGwgZmlyZS4gIENvbW1vbiBzY2VuYXJpbzogdXNlciBoYXMgdHdvIHRhYnMgb3BlbjtcbiAgICogb25lIHRhYiB0aGUgdXNlciBsb2dzIG91dCAob3IgeW91IGNhbGwgY2xpZW50LmxvZ291dCgpKS5cbiAgICogVGhlIG90aGVyIHRhYiB3aWxsIGRldGVjdCB0aGF0IHRoZSBzZXNzaW9uVG9rZW4gaGFzIGJlZW4gcmVtb3ZlZCxcbiAgICogYW5kIHdpbGwgdGVybWluYXRlIGl0cyBzZXNzaW9uIGFzIHdlbGwuICBJbiB0aGlzIHNjZW5hcmlvIHdlIGRvIG5vdCB3YW50XG4gICAqIHRvIGF1dG9tYXRpY2FsbHkgdHJpZ2dlciBhIGNoYWxsZW5nZSBhbmQgcmVzdGFydCB0aGUgbG9naW4gcHJvY2Vzcy5cbiAgICovXG4gICdzZXNzaW9uLXRlcm1pbmF0ZWQnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgb25saW5lXG4gICAqXG4gICAqIFRoaXMgZXZlbnQgaXMgdXNlZCB0byBkZXRlY3Qgd2hlbiB0aGUgY2xpZW50IGlzIG9ubGluZSAoY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIpXG4gICAqIG9yIG9mZmxpbmUgKHN0aWxsIGFibGUgdG8gYWNjZXB0IEFQSSBjYWxscyBidXQgbm8gbG9uZ2VyIGFibGUgdG8gc3luYyB0byB0aGUgc2VydmVyKS5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ29ubGluZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgIGlmIChldnQuaXNPbmxpbmUpIHtcbiAgICogICAgICAgICAgICAgc3RhdHVzRGl2LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdncmVlbic7XG4gICAqICAgICAgICAgfSBlbHNlIHtcbiAgICogICAgICAgICAgICAgc3RhdHVzRGl2LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuICAgKiAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gZXZlbnQuaXNPbmxpbmVcbiAgICovXG4gICdvbmxpbmUnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ2xpZW50QXV0aGVudGljYXRvciwgW0NsaWVudEF1dGhlbnRpY2F0b3IsICdDbGllbnRBdXRoZW50aWNhdG9yJ10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsaWVudEF1dGhlbnRpY2F0b3I7XG4iXX0=
