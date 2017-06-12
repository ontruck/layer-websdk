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
        socketManager: this.socketManager
      });

      this.onlineManager.on('connected', this._handleOnlineChange, this);
      this.onlineManager.on('disconnected', this._handleOnlineChange, this);

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
     * Get a nonce and start the authentication process
     *
     * @method
     * @private
     */

  }, {
    key: '_connect',
    value: function _connect() {
      var _this2 = this;

      this._triggerAsync('state-change', {
        started: true,
        type: 'authentication',
        telemetryId: 'auth_time',
        id: null
      });
      this.xhr({
        url: '/nonces',
        method: 'POST',
        sync: false
      }, function (result) {
        return _this2._connectionResponse(result);
      });
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
      var userId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      var user = void 0;
      this.isConnected = false;
      this._lastChallengeTime = 0;
      this._wantsToBeAuthenticated = true;
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
        this._connect();
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
      this.isConnected = false;
      this.user = null;
      this._lastChallengeTime = 0;
      this._wantsToBeAuthenticated = true;
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
        return _this3._authComplete({
          session_token: sessionToken
        }, false);
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
      this._lastChallengeTime = Date.now();
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

        if (!identityObj.prn) {
          throw new Error('Your identity token prn (user id) is empty');
        }

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
      this._triggerAsync('state-change', {
        ended: true,
        type: 'authentication',
        telemetryId: 'auth_time',
        result: result.success
      });
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
          tables: this.persistenceFeatures,
          enabled: this.isPersistenceEnabled
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
        // load the user's full Identity so we have presence;
        this.user._load();
        this.user.once('identities:loaded', function () {
          if (!_this6._isPersistedSessionsDisabled()) {
            _this6._writeSessionOwner();
            _this6.user.on('identities:change', _this6._writeSessionOwner, _this6);
          }
          _this6._clientReady();
        }).once('identities:loaded-error', function () {
          if (!_this6.user.displayName) _this6.user.displayName = _this6.defaultOwnerDisplayName;
          _this6._clientReady();
        });
      }
    }

    /**
     * Write the latest state of the Session's Identity object to localStorage
     *
     * @method _writeSessionOwner
     * @private
     */

  }, {
    key: '_writeSessionOwner',
    value: function _writeSessionOwner() {
      try {
        // Update the session data in localStorage with our full Identity.
        var sessionData = JSON.parse(global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId]);
        sessionData.user = DbManager.prototype._getIdentityData([this.user])[0];
        global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId] = JSON.stringify(sessionData);
      } catch (e) {
        // no-op
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
      this._wantsToBeAuthenticated = false;
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
      this.isConnected = false;
      this.isAuthenticated = false;

      if (this.sessionToken) {
        this.sessionToken = '';
        if (global.localStorage) {
          localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        }
      }

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
    value: function sendSocketRequest(data, callback) {
      var isChangesArray = Boolean(data.isChangesArray);
      if (this._wantsToBeAuthenticated && !this.isAuthenticated) this._connect();

      if (data.sync) {
        var target = data.sync.target;
        var depends = data.sync.depends;
        if (target && !depends) depends = [target];

        this.syncManager.request(new WebsocketSyncEvent({
          data: data.body,
          operation: data.method,
          returnChangesArray: isChangesArray,
          target: target,
          depends: depends,
          callback: callback
        }));
      } else {
        if (typeof data.data === 'function') data.data = data.data();
        this.socketRequestManager.sendRequest({ data: data, isChangesArray: isChangesArray, callback: callback });
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
      if (!this._wantsToBeAuthenticated) return;
      var duration = evt.offlineDuration;
      var isOnline = evt.eventName === 'connected';
      var obj = { isOnline: isOnline };
      if (isOnline) {
        obj.reset = duration > ClientAuthenticator.ResetAfterOfflineDuration;

        // TODO: Use a cached nonce if it hasn't expired
        if (!this.isAuthenticated) this._connect();
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
      if (this._wantsToBeAuthenticated && !this.isAuthenticated) this._connect();

      var innerCallback = function innerCallback(result) {
        _this7._xhrResult(result, callback);
      };
      var target = options.sync.target;
      var depends = options.sync.depends;
      if (target && !depends) depends = [target];

      this.syncManager.request(new XHRSyncEvent({
        url: options.url,
        data: options.data,
        telemetry: options.telemetry,
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
        if (result.status === 401 && this._wantsToBeAuthenticated) {
          if (this.isAuthenticated) {
            logger.warn('SESSION EXPIRED!');
            this.isAuthenticated = false;
            this.isReady = false;
            if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
            this.trigger('deauthenticated');
            this._authenticate(result.data.getNonce());
          } else if (this._lastChallengeTime > Date.now() + ClientAuthenticator.TimeBetweenReauths) {
            this._authenticate(result.data.getNonce());
          }
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
 * State variable; indicates if the WebSDK thinks that the app WANTS to be connected.
 *
 * An app wants to be connected if it has called `connect()` or `connectWithSession()`
 * and has not called `logout()`.  A client that is connected will receive reauthentication
 * events in the form of `challenge` events.
 *
 * @type {boolean}
 * @readonly
 */
ClientAuthenticator.prototype._wantsToBeAuthenticated = false;

/**
 * If presence is enabled, then your presence can be set/restored.
 *
 * @type {Boolean} [isPresenceEnabled=true]
 */
ClientAuthenticator.prototype.isPresenceEnabled = true;

/**
 * Your Layer Application ID. Can not be changed once connected.
 *
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
 * Time that the last challenge was issued
 *
 * @type {Number}
 * @private
 */
ClientAuthenticator.prototype._lastChallengeTime = 0;

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
 * Number of miliseconds delay must pass before a subsequent challenge is issued.
 *
 * This value is here to insure apps don't get challenge requests while they are
 * still processing the last challenge event.
 *
 * @property {Number}
 * @static
 */
ClientAuthenticator.TimeBetweenReauths = 30 * 1000;

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
'online',

/**
 * State change events are used for internal communications.
 *
 * Primarily used so that the Telemetry component can monitor and report on
 * system activity.
 *
 * @event
 * @private
 */
'state-change'].concat(Root._supportedEvents);

Root.initClass.apply(ClientAuthenticator, [ClientAuthenticator, 'ClientAuthenticator']);

module.exports = ClientAuthenticator;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtYXV0aGVudGljYXRvci5qcyJdLCJuYW1lcyI6WyJ4aHIiLCJyZXF1aXJlIiwiUm9vdCIsIlNvY2tldE1hbmFnZXIiLCJXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIiwiV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIiLCJMYXllckVycm9yIiwiT25saW5lTWFuYWdlciIsIlN5bmNNYW5hZ2VyIiwiRGJNYW5hZ2VyIiwiSWRlbnRpdHkiLCJYSFJTeW5jRXZlbnQiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJBQ0NFUFQiLCJMT0NBTFNUT1JBR0VfS0VZUyIsImxvZ2dlciIsIlV0aWwiLCJNQVhfWEhSX1JFVFJJRVMiLCJDbGllbnRBdXRoZW50aWNhdG9yIiwib3B0aW9ucyIsImFwcElkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiYXBwSWRNaXNzaW5nIiwic29ja2V0TWFuYWdlciIsImNsaWVudCIsInNvY2tldENoYW5nZU1hbmFnZXIiLCJzb2NrZXRSZXF1ZXN0TWFuYWdlciIsIm9ubGluZU1hbmFnZXIiLCJvbiIsIl9oYW5kbGVPbmxpbmVDaGFuZ2UiLCJzeW5jTWFuYWdlciIsInJlcXVlc3RNYW5hZ2VyIiwiZGVzdHJveSIsImRiTWFuYWdlciIsImdsb2JhbCIsImxvY2FsU3RvcmFnZSIsInBlcnNpc3RlbmNlRmVhdHVyZXMiLCJzZXNzaW9uVG9rZW4iLCJfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkIiwic2Vzc2lvbkRhdGEiLCJTRVNTSU9OREFUQSIsInBhcnNlZERhdGEiLCJKU09OIiwicGFyc2UiLCJleHBpcmVzIiwiRGF0ZSIsIm5vdyIsInJlbW92ZUl0ZW0iLCJlcnJvciIsInVzZXJPYmoiLCJ1c2VyIiwiY2xpZW50SWQiLCJzZXNzaW9uT3duZXIiLCJmcm9tU2VydmVyIiwidXNlcklkIiwidXNlcl9pZCIsIl90cmlnZ2VyQXN5bmMiLCJzdGFydGVkIiwidHlwZSIsInRlbGVtZXRyeUlkIiwiaWQiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX2Nvbm5lY3Rpb25SZXNwb25zZSIsInJlc3VsdCIsImlzQ29ubmVjdGVkIiwiX2xhc3RDaGFsbGVuZ2VUaW1lIiwiX3dhbnRzVG9CZUF1dGhlbnRpY2F0ZWQiLCJzdGFydCIsImlzVHJ1c3RlZERldmljZSIsIl9oYXNVc2VySWRDaGFuZ2VkIiwiX2NsZWFyU3RvcmVkRGF0YSIsIl9yZXN0b3JlTGFzdFNlc3Npb24iLCJfcmVzdG9yZUxhc3RVc2VyIiwicHJlZml4VVVJRCIsImVuY29kZVVSSUNvbXBvbmVudCIsIl9zZXNzaW9uVG9rZW5SZXN0b3JlZCIsIl9jb25uZWN0Iiwic2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCIsInNldFRpbWVvdXQiLCJfYXV0aENvbXBsZXRlIiwic2Vzc2lvbl90b2tlbiIsInN1Y2Nlc3MiLCJfY29ubmVjdGlvbkVycm9yIiwiZGF0YSIsIl9jb25uZWN0aW9uQ29tcGxldGUiLCJ0cmlnZ2VyIiwiX2F1dGhlbnRpY2F0ZSIsIm5vbmNlIiwiY2FsbGJhY2siLCJhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZSIsImJpbmQiLCJpZGVudGl0eVRva2VuIiwiaWRlbnRpdHlUb2tlbk1pc3NpbmciLCJ1c2VyRGF0YSIsImRlY29kZSIsInNwbGl0IiwiaWRlbnRpdHlPYmoiLCJwcm4iLCJpbnZhbGlkVXNlcklkQ2hhbmdlIiwiX3NldFVzZXJJZCIsImRpc3BsYXlfbmFtZSIsImRpc3BsYXlOYW1lIiwiYXZhdGFyX3VybCIsImF2YXRhclVybCIsImlkZW50aXR5X3Rva2VuIiwiYXBwX2lkIiwiX2F1dGhSZXNwb25zZSIsImVuZGVkIiwiX2F1dGhFcnJvciIsImZyb21QZXJzaXN0ZW5jZSIsInNlc3Npb25Ub2tlbk1pc3NpbmciLCJzdHJpbmdpZnkiLCJwcm90b3R5cGUiLCJfZ2V0SWRlbnRpdHlEYXRhIiwiZSIsIl9jbGllbnRBdXRoZW50aWNhdGVkIiwiaXNBdXRoZW50aWNhdGVkIiwiaXNQZXJzaXN0ZW5jZUVuYWJsZWQiLCJCb29sZWFuIiwiY29udmVyc2F0aW9ucyIsImNoYW5uZWxzIiwibWVzc2FnZXMiLCJpZGVudGl0aWVzIiwic3luY1F1ZXVlIiwidGFibGVzIiwiZW5hYmxlZCIsIm9uT3BlbiIsIl9sb2FkVXNlciIsImlzRnVsbElkZW50aXR5IiwiX2NsaWVudFJlYWR5IiwiX2xvYWQiLCJvbmNlIiwiX3dyaXRlU2Vzc2lvbk93bmVyIiwiZGVmYXVsdE93bmVyRGlzcGxheU5hbWUiLCJpc1JlYWR5IiwiY2FsbGJhY2tDb3VudCIsImNvdW50ZXIiLCJlc2NhcGUiLCJfcmVzZXRTZXNzaW9uIiwiZGVsZXRlVGFibGVzIiwic3RvcCIsInRva2VuIiwiZGV2aWNlX2lkIiwiZGV2aWNlSWQiLCJpb3NfdmVyc2lvbiIsImlvc1ZlcnNpb24iLCJhcG5zX2J1bmRsZV9pZCIsImJ1bmRsZUlkIiwiZ2NtX3NlbmRlcl9pZCIsInNlbmRlcklkIiwiY2FudENoYW5nZUlmQ29ubmVjdGVkIiwiaWRlbnRpdHkiLCJpc0NoYW5nZXNBcnJheSIsInRhcmdldCIsImRlcGVuZHMiLCJyZXF1ZXN0IiwiYm9keSIsIm9wZXJhdGlvbiIsInJldHVybkNoYW5nZXNBcnJheSIsInNlbmRSZXF1ZXN0IiwiZXZ0IiwiZHVyYXRpb24iLCJvZmZsaW5lRHVyYXRpb24iLCJpc09ubGluZSIsImV2ZW50TmFtZSIsIm9iaiIsInJlc2V0IiwiUmVzZXRBZnRlck9mZmxpbmVEdXJhdGlvbiIsIl94aHJGaXhSZWxhdGl2ZVVybHMiLCJ3aXRoQ3JlZGVudGlhbHMiLCJoZWFkZXJzIiwiX3hockZpeEhlYWRlcnMiLCJfeGhyRml4QXV0aCIsIl9ub25zeW5jWGhyIiwiX3N5bmNYaHIiLCJpbm5lckNhbGxiYWNrIiwiX3hoclJlc3VsdCIsInRlbGVtZXRyeSIsInJldHJ5Q291bnQiLCJpbmRleE9mIiwic3RhdHVzIiwiQXV0aG9yaXphdGlvbiIsImF1dGhvcml6YXRpb24iLCJoZWFkZXJOYW1lTGlzdCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiaGVhZGVyTmFtZSIsInRvTG93ZXJDYXNlIiwiYWNjZXB0IiwiaXNEZXN0cm95ZWQiLCJfZ2VuZXJhdGVFcnJvciIsIndhcm4iLCJnZXROb25jZSIsIlRpbWVCZXR3ZWVuUmVhdXRocyIsImh0dHBTdGF0dXMiLCJsb2ciLCJpc1ByZXNlbmNlRW5hYmxlZCIsIndlYnNvY2tldFVybCIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsImdldCIsImxldmVsIiwic2V0IiwidmFsdWUiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBOEJBLElBQU1BLE1BQU1DLFFBQVEsT0FBUixDQUFaO0FBQ0EsSUFBTUMsT0FBT0QsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNRSxnQkFBZ0JGLFFBQVEsNkJBQVIsQ0FBdEI7QUFDQSxJQUFNRyx5QkFBeUJILFFBQVEsNkJBQVIsQ0FBL0I7QUFDQSxJQUFNSSwwQkFBMEJKLFFBQVEsOEJBQVIsQ0FBaEM7QUFDQSxJQUFNSyxhQUFhTCxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNTSxnQkFBZ0JOLFFBQVEsd0JBQVIsQ0FBdEI7QUFDQSxJQUFNTyxjQUFjUCxRQUFRLGdCQUFSLENBQXBCO0FBQ0EsSUFBTVEsWUFBWVIsUUFBUSxjQUFSLENBQWxCO0FBQ0EsSUFBTVMsV0FBV1QsUUFBUSxtQkFBUixDQUFqQjs7ZUFDNkNBLFFBQVEsY0FBUixDO0lBQXJDVSxZLFlBQUFBLFk7SUFBY0Msa0IsWUFBQUEsa0I7O2dCQUNnQlgsUUFBUSxTQUFSLEM7SUFBOUJZLE0sYUFBQUEsTTtJQUFRQyxpQixhQUFBQSxpQjs7QUFDaEIsSUFBTUMsU0FBU2QsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNZSxPQUFPZixRQUFRLGdCQUFSLENBQWI7O0FBRUEsSUFBTWdCLGtCQUFrQixDQUF4Qjs7SUFFTUMsbUI7OztBQUVKOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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Ozs7Ozs7QUFRQSxpQkF6RHFDOztBQTJEckM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLFdBL0VxQzs7QUFpRnJDOzs7Ozs7Ozs7O0FBVUEsb0JBM0ZxQzs7QUE2RnJDOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSxRQTlHcUM7O0FBaUhyQzs7Ozs7Ozs7O0FBU0EsY0ExSHFDLEVBMkhyQ0MsTUEzSHFDLENBMkg5Qi9NLEtBQUs4TSxnQkEzSHlCLENBQXZDOztBQTZIQTlNLEtBQUtnTixTQUFMLENBQWVDLEtBQWYsQ0FBcUJqTSxtQkFBckIsRUFBMEMsQ0FBQ0EsbUJBQUQsRUFBc0IscUJBQXRCLENBQTFDOztBQUVBa00sT0FBT0MsT0FBUCxHQUFpQm5NLG1CQUFqQiIsImZpbGUiOiJjbGllbnQtYXV0aGVudGljYXRvci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGF5ZXIgQ2xpZW50LiAgQWNjZXNzIHRoZSBsYXllciBieSBjYWxsaW5nIGNyZWF0ZSBhbmQgcmVjZWl2aW5nIGl0XG4gKiBmcm9tIHRoZSBcInJlYWR5XCIgY2FsbGJhY2suXG5cbiAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICAgIGFwcElkOiBcImxheWVyOi8vL2FwcHMvc3RhZ2luZy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmZcIixcbiAgICBpc1RydXN0ZWREZXZpY2U6IGZhbHNlLFxuICAgIGNoYWxsZW5nZTogZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBteUF1dGhlbnRpY2F0b3Ioe1xuICAgICAgICBub25jZTogZXZ0Lm5vbmNlLFxuICAgICAgICBvblN1Y2Nlc3M6IGV2dC5jYWxsYmFja1xuICAgICAgfSk7XG4gICAgfSxcbiAgICByZWFkeTogZnVuY3Rpb24oY2xpZW50KSB7XG4gICAgICBhbGVydChcIllheSwgSSBmaW5hbGx5IGdvdCBteSBjbGllbnQhXCIpO1xuICAgIH1cbiAgfSkuY29ubmVjdChcInNhbXBsZXVzZXJJZFwiKTtcblxuICogVGhlIExheWVyIENsaWVudC9DbGllbnRBdXRoZW50aWNhdG9yIGNsYXNzZXMgaGF2ZSBiZWVuIGRpdmlkZWQgaW50bzpcbiAqXG4gKiAxLiBDbGllbnRBdXRoZW50aWNhdG9yOiBNYW5hZ2VzIGFsbCBhdXRoZW50aWNhdGlvbiBhbmQgY29ubmVjdGl2aXR5IHJlbGF0ZWQgaXNzdWVzXG4gKiAyLiBDbGllbnQ6IE1hbmFnZXMgYWNjZXNzIHRvIENvbnZlcnNhdGlvbnMsIFF1ZXJpZXMsIE1lc3NhZ2VzLCBFdmVudHMsIGV0Yy4uLlxuICpcbiAqIEBjbGFzcyBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yXG4gKiBAcHJpdmF0ZVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQGF1dGhvciBNaWNoYWVsIEthbnRvclxuICpcbiAqL1xuXG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgU29ja2V0TWFuYWdlciA9IHJlcXVpcmUoJy4vd2Vic29ja2V0cy9zb2NrZXQtbWFuYWdlcicpO1xuY29uc3QgV2Vic29ja2V0Q2hhbmdlTWFuYWdlciA9IHJlcXVpcmUoJy4vd2Vic29ja2V0cy9jaGFuZ2UtbWFuYWdlcicpO1xuY29uc3QgV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIgPSByZXF1aXJlKCcuL3dlYnNvY2tldHMvcmVxdWVzdC1tYW5hZ2VyJyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgT25saW5lTWFuYWdlciA9IHJlcXVpcmUoJy4vb25saW5lLXN0YXRlLW1hbmFnZXInKTtcbmNvbnN0IFN5bmNNYW5hZ2VyID0gcmVxdWlyZSgnLi9zeW5jLW1hbmFnZXInKTtcbmNvbnN0IERiTWFuYWdlciA9IHJlcXVpcmUoJy4vZGItbWFuYWdlcicpO1xuY29uc3QgSWRlbnRpdHkgPSByZXF1aXJlKCcuL21vZGVscy9pZGVudGl0eScpO1xuY29uc3QgeyBYSFJTeW5jRXZlbnQsIFdlYnNvY2tldFN5bmNFdmVudCB9ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCB7IEFDQ0VQVCwgTE9DQUxTVE9SQUdFX0tFWVMgfSA9IHJlcXVpcmUoJy4vY29uc3QnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuY29uc3QgTUFYX1hIUl9SRVRSSUVTID0gMztcblxuY2xhc3MgQ2xpZW50QXV0aGVudGljYXRvciBleHRlbmRzIFJvb3Qge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgQ2xpZW50LlxuICAgKlxuICAgKiBUaGUgYXBwSWQgaXMgdGhlIG9ubHkgcmVxdWlyZWQgcGFyYW1ldGVyOlxuICAgKlxuICAgKiAgICAgIHZhciBjbGllbnQgPSBuZXcgQ2xpZW50KHtcbiAgICogICAgICAgICAgYXBwSWQ6IFwibGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL3V1aWRcIlxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBGb3IgdHJ1c3RlZCBkZXZpY2VzLCB5b3UgY2FuIGVuYWJsZSBzdG9yYWdlIG9mIGRhdGEgdG8gaW5kZXhlZERCIGFuZCBsb2NhbFN0b3JhZ2Ugd2l0aCB0aGUgYGlzVHJ1c3RlZERldmljZWAgYW5kIGBpc1BlcnNpc3RlbmNlRW5hYmxlZGAgcHJvcGVydHk6XG4gICAqXG4gICAqICAgICAgdmFyIGNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgKiAgICAgICAgICBhcHBJZDogXCJsYXllcjovLy9hcHBzL3N0YWdpbmcvdXVpZFwiLFxuICAgKiAgICAgICAgICBpc1RydXN0ZWREZXZpY2U6IHRydWUsXG4gICAqICAgICAgICAgIGlzUGVyc2lzdGVuY2VFbmFibGVkOiB0cnVlXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy5hcHBJZCAgICAgICAgICAgLSBcImxheWVyOi8vL2FwcHMvcHJvZHVjdGlvbi91dWlkXCI7IElkZW50aWZpZXMgd2hhdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb24gd2UgYXJlIGNvbm5lY3RpbmcgdG8uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMudXJsPWh0dHBzOi8vYXBpLmxheWVyLmNvbV0gLSBVUkwgdG8gbG9nIGludG8gYSBkaWZmZXJlbnQgUkVTVCBzZXJ2ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmxvZ0xldmVsPUVSUk9SXSAtIFByb3ZpZGUgYSBsb2cgbGV2ZWwgdGhhdCBpcyBvbmUgb2YgbGF5ZXIuQ29uc3RhbnRzLkxPRy5OT05FLCBsYXllci5Db25zdGFudHMuTE9HLkVSUk9SLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuQ29uc3RhbnRzLkxPRy5XQVJOLCBsYXllci5Db25zdGFudHMuTE9HLklORk8sIGxheWVyLkNvbnN0YW50cy5MT0cuREVCVUdcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pc1RydXN0ZWREZXZpY2U9ZmFsc2VdIC0gSWYgdGhpcyBpcyBub3QgYSB0cnVzdGVkIGRldmljZSwgbm8gZGF0YSB3aWxsIGJlIHdyaXR0ZW4gdG8gaW5kZXhlZERCIG5vciBsb2NhbFN0b3JhZ2UsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWdhcmRsZXNzIG9mIGFueSB2YWx1ZXMgaW4gbGF5ZXIuQ2xpZW50LnBlcnNpc3RlbmNlRmVhdHVyZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5pc1BlcnNpc3RlbmNlRW5hYmxlZD1mYWxzZV0gSWYgbGF5ZXIuQ2xpZW50LmlzUGVyc2lzdGVuY2VFbmFibGVkIGlzIHRydWUsIHRoZW4gaW5kZXhlZERCIHdpbGwgYmUgdXNlZCB0byBtYW5hZ2UgYSBjYWNoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dpbmcgUXVlcnkgcmVzdWx0cywgbWVzc2FnZXMgc2VudCwgYW5kIGFsbCBsb2NhbCBtb2RpZmljYXRpb25zIHRvIGJlIHBlcnNpc3RlZCBiZXR3ZWVuIHBhZ2UgcmVsb2Fkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBwYXJhbWV0ZXJzXG4gICAgaWYgKCFvcHRpb25zLmFwcElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmFwcElkTWlzc2luZyk7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBzdWJjb21wb25lbnRzIG9mIHRoZSBDbGllbnRBdXRoZW50aWNhdG9yXG4gICAqXG4gICAqIEBtZXRob2QgX2luaXRDb21wb25lbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaW5pdENvbXBvbmVudHMoKSB7XG4gICAgLy8gU2V0dXAgdGhlIHdlYnNvY2tldCBtYW5hZ2VyOyB3b24ndCBjb25uZWN0IHVudGlsIHdlIHRyaWdnZXIgYW4gYXV0aGVudGljYXRlZCBldmVudFxuICAgIHRoaXMuc29ja2V0TWFuYWdlciA9IG5ldyBTb2NrZXRNYW5hZ2VyKHtcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0Q2hhbmdlTWFuYWdlciA9IG5ldyBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyKHtcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgIHNvY2tldE1hbmFnZXI6IHRoaXMuc29ja2V0TWFuYWdlcixcbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIgPSBuZXcgV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIoe1xuICAgICAgY2xpZW50OiB0aGlzLFxuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgIH0pO1xuXG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyID0gbmV3IE9ubGluZU1hbmFnZXIoe1xuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgIH0pO1xuXG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLm9uKCdjb25uZWN0ZWQnLCB0aGlzLl9oYW5kbGVPbmxpbmVDaGFuZ2UsIHRoaXMpO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5vbignZGlzY29ubmVjdGVkJywgdGhpcy5faGFuZGxlT25saW5lQ2hhbmdlLCB0aGlzKTtcblxuICAgIHRoaXMuc3luY01hbmFnZXIgPSBuZXcgU3luY01hbmFnZXIoe1xuICAgICAgb25saW5lTWFuYWdlcjogdGhpcy5vbmxpbmVNYW5hZ2VyLFxuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgICAgcmVxdWVzdE1hbmFnZXI6IHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIsXG4gICAgICBjbGllbnQ6IHRoaXMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgc3ViY29tcG9uZW50cyBvZiB0aGUgQ2xpZW50QXV0aGVudGljYXRvclxuICAgKlxuICAgKiBAbWV0aG9kIF9kZXN0cm95Q29tcG9uZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2Rlc3Ryb3lDb21wb25lbnRzKCkge1xuICAgIHRoaXMuc3luY01hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnNvY2tldENoYW5nZU1hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIuZGVzdHJveSgpO1xuICAgIGlmICh0aGlzLmRiTWFuYWdlcikgdGhpcy5kYk1hbmFnZXIuZGVzdHJveSgpO1xuICB9XG5cblxuICAvKipcbiAgICogSXMgUGVyc2lzdGVkIFNlc3Npb24gVG9rZW5zIGRpc2FibGVkP1xuICAgKlxuICAgKiBAbWV0aG9kIF9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWRcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkge1xuICAgIHJldHVybiAhZ2xvYmFsLmxvY2FsU3RvcmFnZSB8fCAodGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzICYmICF0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMuc2Vzc2lvblRva2VuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXN0b3JlIHRoZSBzZXNzaW9uVG9rZW4gZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAqXG4gICAqIFRoaXMgc2V0cyB0aGUgc2Vzc2lvblRva2VuIHJhdGhlciB0aGFuIHJldHVybmluZyB0aGUgdG9rZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX3Jlc3RvcmVMYXN0U2Vzc2lvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc3RvcmVMYXN0U2Vzc2lvbigpIHtcbiAgICBpZiAodGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm47XG4gICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShzZXNzaW9uRGF0YSk7XG4gICAgICBpZiAocGFyc2VkRGF0YS5leHBpcmVzIDwgRGF0ZS5ub3coKSkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2Vzc2lvblRva2VuID0gcGFyc2VkRGF0YS5zZXNzaW9uVG9rZW47XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE5vLW9wXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc3RvcmUgdGhlIElkZW50aXR5IGZvciB0aGUgc2Vzc2lvbiBvd25lciBmcm9tIGxvY2FsU3RvcmFnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzdG9yZUxhc3RTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgX3Jlc3RvcmVMYXN0VXNlcigpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm4gbnVsbDtcbiAgICAgIGNvbnN0IHVzZXJPYmogPSBKU09OLnBhcnNlKHNlc3Npb25EYXRhKS51c2VyO1xuICAgICAgcmV0dXJuIG5ldyBJZGVudGl0eSh7XG4gICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICBzZXNzaW9uT3duZXI6IHRydWUsXG4gICAgICAgIGZyb21TZXJ2ZXI6IHVzZXJPYmosXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhcyB0aGUgdXNlcklEIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgbG9naW4/XG4gICAqXG4gICAqIEBtZXRob2QgX2hhc1VzZXJJZENoYW5nZWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXTtcbiAgICAgIGlmICghc2Vzc2lvbkRhdGEpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc2Vzc2lvbkRhdGEpLnVzZXIudXNlcl9pZCAhPT0gdXNlcklkO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgbm9uY2UgYW5kIHN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBwcm9jZXNzXG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jb25uZWN0KCkge1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnc3RhdGUtY2hhbmdlJywge1xuICAgICAgc3RhcnRlZDogdHJ1ZSxcbiAgICAgIHR5cGU6ICdhdXRoZW50aWNhdGlvbicsXG4gICAgICB0ZWxlbWV0cnlJZDogJ2F1dGhfdGltZScsXG4gICAgICBpZDogbnVsbCxcbiAgICB9KTtcbiAgICB0aGlzLnhocih7XG4gICAgICB1cmw6ICcvbm9uY2VzJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgc3luYzogZmFsc2UsXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX2Nvbm5lY3Rpb25SZXNwb25zZShyZXN1bHQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWF0ZXMgdGhlIGNvbm5lY3Rpb24uXG4gICAqXG4gICAqIENhbGxlZCBieSBjb25zdHJ1Y3RvcigpLlxuICAgKlxuICAgKiBXaWxsIGVpdGhlciBhdHRlbXB0IHRvIHZhbGlkYXRlIHRoZSBjYWNoZWQgc2Vzc2lvblRva2VuIGJ5IGdldHRpbmcgY29udmVyc2F0aW9ucyxcbiAgICogb3IgaWYgbm8gc2Vzc2lvblRva2VuLCB3aWxsIGNhbGwgL25vbmNlcyB0byBzdGFydCBwcm9jZXNzIG9mIGdldHRpbmcgYSBuZXcgb25lLlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHthcHBJZDogbXlBcHBJZH0pO1xuICAgKiBjbGllbnQuY29ubmVjdCgnRnJvZG8tdGhlLURvZG8nKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgY29ubmVjdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXNlcklkIC0gVXNlciBJRCBvZiB0aGUgdXNlciB5b3UgYXJlIGxvZ2dpbmcgaW4gYXNcbiAgICogQHJldHVybnMge2xheWVyLkNsaWVudEF1dGhlbnRpY2F0b3J9IHRoaXNcbiAgICovXG4gIGNvbm5lY3QodXNlcklkID0gJycpIHtcbiAgICBsZXQgdXNlcjtcbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gZmFsc2U7XG4gICAgdGhpcy5fbGFzdENoYWxsZW5nZVRpbWUgPSAwO1xuICAgIHRoaXMuX3dhbnRzVG9CZUF1dGhlbnRpY2F0ZWQgPSB0cnVlO1xuICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLnN0YXJ0KCk7XG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSB8fCAhdXNlcklkIHx8IHRoaXMuX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpIHx8IHRoaXMuX2hhc1VzZXJJZENoYW5nZWQodXNlcklkKSkge1xuICAgICAgdGhpcy5fY2xlYXJTdG9yZWREYXRhKCk7XG4gICAgfVxuXG5cbiAgICBpZiAodGhpcy5pc1RydXN0ZWREZXZpY2UgJiYgdXNlcklkKSB7XG4gICAgICB0aGlzLl9yZXN0b3JlTGFzdFNlc3Npb24odXNlcklkKTtcbiAgICAgIHVzZXIgPSB0aGlzLl9yZXN0b3JlTGFzdFVzZXIoKTtcbiAgICAgIGlmICh1c2VyKSB0aGlzLnVzZXIgPSB1c2VyO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51c2VyKSB7XG4gICAgICB0aGlzLnVzZXIgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHNlc3Npb25Pd25lcjogdHJ1ZSxcbiAgICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIGlkOiB1c2VySWQgPyBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KHVzZXJJZCkgOiAnJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbiAmJiB0aGlzLnVzZXIudXNlcklkKSB7XG4gICAgICB0aGlzLl9zZXNzaW9uVG9rZW5SZXN0b3JlZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jb25uZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYXRlcyB0aGUgY29ubmVjdGlvbiB3aXRoIGEgc2Vzc2lvbiB0b2tlbi5cbiAgICpcbiAgICogVGhpcyBjYWxsIGlzIGZvciB1c2Ugd2hlbiB5b3UgaGF2ZSByZWNlaXZlZCBhIFNlc3Npb24gVG9rZW4gZnJvbSBzb21lIG90aGVyIHNvdXJjZTsgc3VjaCBhcyB5b3VyIHNlcnZlcixcbiAgICogYW5kIHdpc2ggdG8gdXNlIHRoYXQgaW5zdGVhZCBvZiBkb2luZyBhIGZ1bGwgYXV0aCBwcm9jZXNzLlxuICAgKlxuICAgKiBUaGUgQ2xpZW50IHdpbGwgcHJlc3VtZSB0aGUgdG9rZW4gdG8gYmUgdmFsaWQsIGFuZCB3aWxsIGFzeW5jaHJvbm91c2x5IHRyaWdnZXIgdGhlIGByZWFkeWAgZXZlbnQuXG4gICAqIElmIHRoZSB0b2tlbiBwcm92aWRlZCBpcyBOT1QgdmFsaWQsIHRoaXMgd29uJ3QgYmUgZGV0ZWN0ZWQgdW50aWwgYSByZXF1ZXN0IGlzIG1hZGUgdXNpbmcgdGhpcyB0b2tlbixcbiAgICogYXQgd2hpY2ggcG9pbnQgdGhlIGBjaGFsbGVuZ2VgIG1ldGhvZCB3aWxsIHRyaWdnZXIuXG4gICAqXG4gICAqIE5PVEU6IFRoZSBgY29ubmVjdGVkYCBldmVudCB3aWxsIG5vdCBiZSB0cmlnZ2VyZWQgb24gdGhpcyBwYXRoLlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHthcHBJZDogbXlBcHBJZH0pO1xuICAgKiBjbGllbnQuY29ubmVjdFdpdGhTZXNzaW9uKCdGcm9kby10aGUtRG9kbycsIG15U2Vzc2lvblRva2VuKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgY29ubmVjdFdpdGhTZXNzaW9uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNlc3Npb25Ub2tlblxuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgY29ubmVjdFdpdGhTZXNzaW9uKHVzZXJJZCwgc2Vzc2lvblRva2VuKSB7XG4gICAgbGV0IHVzZXI7XG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgdGhpcy5fbGFzdENoYWxsZW5nZVRpbWUgPSAwO1xuICAgIHRoaXMuX3dhbnRzVG9CZUF1dGhlbnRpY2F0ZWQgPSB0cnVlO1xuICAgIGlmICghdXNlcklkIHx8ICFzZXNzaW9uVG9rZW4pIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuc2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCk7XG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSB8fCB0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSB8fCB0aGlzLl9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkpIHtcbiAgICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1RydXN0ZWREZXZpY2UpIHtcbiAgICAgIHVzZXIgPSB0aGlzLl9yZXN0b3JlTGFzdFVzZXIoKTtcbiAgICAgIGlmICh1c2VyKSB0aGlzLnVzZXIgPSB1c2VyO1xuICAgIH1cblxuICAgIHRoaXMub25saW5lTWFuYWdlci5zdGFydCgpO1xuXG4gICAgaWYgKCF0aGlzLnVzZXIpIHtcbiAgICAgIHRoaXMudXNlciA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgaWQ6IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQodXNlcklkKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fYXV0aENvbXBsZXRlKHtcbiAgICAgIHNlc3Npb25fdG9rZW46IHNlc3Npb25Ub2tlbixcbiAgICB9LCBmYWxzZSksIDEpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIG91ciByZXF1ZXN0IGZvciBhIG5vbmNlIGdldHMgYSByZXNwb25zZS5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGNhbGxzIF9jb25uZWN0aW9uRXJyb3IuXG4gICAqXG4gICAqIElmIHRoZXJlIGlzIG5vbmNlLCBjYWxscyBfY29ubmVjdGlvbkNvbXBsZXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uUmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICovXG4gIF9jb25uZWN0aW9uUmVzcG9uc2UocmVzdWx0KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkVycm9yKHJlc3VsdC5kYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbkNvbXBsZXRlKHJlc3VsdC5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2UgYXJlIG5vdyBjb25uZWN0ZWQgKHdlIGhhdmUgYSBub25jZSkuXG4gICAqXG4gICAqIElmIHdlIGhhdmUgc3VjY2Vzc2Z1bGx5IHJldHJpZXZlZCBhIG5vbmNlLCB0aGVuXG4gICAqIHdlIGhhdmUgZW50ZXJlZCBhIFwiY29ubmVjdGVkXCIgYnV0IG5vdCBcImF1dGhlbnRpY2F0ZWRcIiBzdGF0ZS5cbiAgICogU2V0IHRoZSBzdGF0ZSwgdHJpZ2dlciBhbnkgZXZlbnRzLCBhbmQgdGhlbiBzdGFydCBhdXRoZW50aWNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkNvbXBsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVzdWx0Lm5vbmNlIC0gVGhlIG5vbmNlIHByb3ZpZGVkIGJ5IHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQGZpcmVzIGNvbm5lY3RlZFxuICAgKi9cbiAgX2Nvbm5lY3Rpb25Db21wbGV0ZShyZXN1bHQpIHtcbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gdHJ1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2Nvbm5lY3RlZCcpO1xuICAgIHRoaXMuX2F1dGhlbnRpY2F0ZShyZXN1bHQubm9uY2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIHdlIGZhaWwgdG8gZ2V0IGEgbm9uY2UuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25FcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckVycm9yfSBlcnJcbiAgICpcbiAgICogQGZpcmVzIGNvbm5lY3RlZC1lcnJvclxuICAgKi9cbiAgX2Nvbm5lY3Rpb25FcnJvcihlcnJvcikge1xuICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkLWVycm9yJywgeyBlcnJvciB9KTtcbiAgfVxuXG5cbiAgLyogQ09OTkVDVCBNRVRIT0RTIEVORCAqL1xuXG4gIC8qIEFVVEhFTlRJQ0FURSBNRVRIT0RTIEJFR0lOICovXG5cbiAgLyoqXG4gICAqIFN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBzdGVwLlxuICAgKlxuICAgKiBXZSBzdGFydCBhdXRoZW50aWNhdGlvbiBieSB0cmlnZ2VyaW5nIGEgXCJjaGFsbGVuZ2VcIiBldmVudCB0aGF0XG4gICAqIHRlbGxzIHRoZSBhcHAgdG8gdXNlIHRoZSBub25jZSB0byBvYnRhaW4gYW4gaWRlbnRpdHlfdG9rZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX2F1dGhlbnRpY2F0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5vbmNlIC0gVGhlIG5vbmNlIHRvIHByb3ZpZGUgeW91ciBpZGVudGl0eSBwcm92aWRlciBzZXJ2aWNlXG4gICAqXG4gICAqIEBmaXJlcyBjaGFsbGVuZ2VcbiAgICovXG4gIF9hdXRoZW50aWNhdGUobm9uY2UpIHtcbiAgICB0aGlzLl9sYXN0Q2hhbGxlbmdlVGltZSA9IERhdGUubm93KCk7XG4gICAgaWYgKG5vbmNlKSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYWxsZW5nZScsIHtcbiAgICAgICAgbm9uY2UsXG4gICAgICAgIGNhbGxiYWNrOiB0aGlzLmFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlLmJpbmQodGhpcyksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWNjZXB0IGFuIGlkZW50aXR5VG9rZW4gYW5kIHVzZSBpdCB0byBjcmVhdGUgYSBzZXNzaW9uLlxuICAgKlxuICAgKiBUeXBpY2FsbHksIHRoaXMgbWV0aG9kIGlzIGNhbGxlZCB1c2luZyB0aGUgZnVuY3Rpb24gcG9pbnRlciBwcm92aWRlZCBieVxuICAgKiB0aGUgY2hhbGxlbmdlIGV2ZW50LCBidXQgaXQgY2FuIGFsc28gYmUgY2FsbGVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgIGdldElkZW50aXR5VG9rZW4obm9uY2UsIGZ1bmN0aW9uKGlkZW50aXR5VG9rZW4pIHtcbiAgICogICAgICAgICAgY2xpZW50LmFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlKGlkZW50aXR5VG9rZW4pO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRlbnRpdHlUb2tlbiAtIElkZW50aXR5IHRva2VuIHByb3ZpZGVkIGJ5IHlvdXIgaWRlbnRpdHkgcHJvdmlkZXIgc2VydmljZVxuICAgKi9cbiAgYW5zd2VyQXV0aGVudGljYXRpb25DaGFsbGVuZ2UoaWRlbnRpdHlUb2tlbikge1xuICAgIC8vIFJlcG9ydCBhbiBlcnJvciBpZiBubyBpZGVudGl0eVRva2VuIHByb3ZpZGVkXG4gICAgaWYgKCFpZGVudGl0eVRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlkZW50aXR5VG9rZW5NaXNzaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdXNlckRhdGEgPSBVdGlsLmRlY29kZShpZGVudGl0eVRva2VuLnNwbGl0KCcuJylbMV0pO1xuICAgICAgY29uc3QgaWRlbnRpdHlPYmogPSBKU09OLnBhcnNlKHVzZXJEYXRhKTtcblxuICAgICAgaWYgKCFpZGVudGl0eU9iai5wcm4pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3VyIGlkZW50aXR5IHRva2VuIHBybiAodXNlciBpZCkgaXMgZW1wdHknKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudXNlci51c2VySWQgJiYgdGhpcy51c2VyLnVzZXJJZCAhPT0gaWRlbnRpdHlPYmoucHJuKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaW52YWxpZFVzZXJJZENoYW5nZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudXNlci5fc2V0VXNlcklkKGlkZW50aXR5T2JqLnBybik7XG5cbiAgICAgIGlmIChpZGVudGl0eU9iai5kaXNwbGF5X25hbWUpIHRoaXMudXNlci5kaXNwbGF5TmFtZSA9IGlkZW50aXR5T2JqLmRpc3BsYXlfbmFtZTtcbiAgICAgIGlmIChpZGVudGl0eU9iai5hdmF0YXJfdXJsKSB0aGlzLnVzZXIuYXZhdGFyVXJsID0gaWRlbnRpdHlPYmouYXZhdGFyX3VybDtcblxuICAgICAgdGhpcy54aHIoe1xuICAgICAgICB1cmw6ICcvc2Vzc2lvbnMnLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpZGVudGl0eV90b2tlbjogaWRlbnRpdHlUb2tlbixcbiAgICAgICAgICBhcHBfaWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgIH0sXG4gICAgICB9LCByZXN1bHQgPT4gdGhpcy5fYXV0aFJlc3BvbnNlKHJlc3VsdCwgaWRlbnRpdHlUb2tlbikpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgd2hlbiBvdXIgcmVxdWVzdCBmb3IgYSBzZXNzaW9uVG9rZW4gcmVjZWl2ZXMgYSByZXNwb25zZS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfYXV0aFJlc3BvbnNlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRlbnRpdHlUb2tlblxuICAgKi9cbiAgX2F1dGhSZXNwb25zZShyZXN1bHQsIGlkZW50aXR5VG9rZW4pIHtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ3N0YXRlLWNoYW5nZScsIHtcbiAgICAgIGVuZGVkOiB0cnVlLFxuICAgICAgdHlwZTogJ2F1dGhlbnRpY2F0aW9uJyxcbiAgICAgIHRlbGVtZXRyeUlkOiAnYXV0aF90aW1lJyxcbiAgICAgIHJlc3VsdDogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgfSk7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5fYXV0aEVycm9yKHJlc3VsdC5kYXRhLCBpZGVudGl0eVRva2VuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXV0aENvbXBsZXRlKHJlc3VsdC5kYXRhLCBmYWxzZSk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogQXV0aGVudGljYXRpb24gaXMgY29tcGxldGVkLCB1cGRhdGUgc3RhdGUgYW5kIHRyaWdnZXIgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hdXRoQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gZnJvbVBlcnNpc3RlbmNlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVzdWx0LnNlc3Npb25fdG9rZW4gLSBTZXNzaW9uIHRva2VuIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAZmlyZXMgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgX2F1dGhDb21wbGV0ZShyZXN1bHQsIGZyb21QZXJzaXN0ZW5jZSkge1xuICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQuc2Vzc2lvbl90b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5zZXNzaW9uVG9rZW5NaXNzaW5nKTtcbiAgICB9XG4gICAgdGhpcy5zZXNzaW9uVG9rZW4gPSByZXN1bHQuc2Vzc2lvbl90b2tlbjtcblxuICAgIC8vIElmIF9hdXRoQ29tcGxldGUgd2FzIGNhbGxlZCBiZWNhdXNlIHdlIGFjY2VwdGVkIGFuIGF1dGggbG9hZGVkIGZyb20gc3RvcmFnZVxuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gdXBkYXRlIHN0b3JhZ2UuXG4gICAgaWYgKCF0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSAmJiAhZnJvbVBlcnNpc3RlbmNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2Vzc2lvblRva2VuOiB0aGlzLnNlc3Npb25Ub2tlbiB8fCAnJyxcbiAgICAgICAgICB1c2VyOiBEYk1hbmFnZXIucHJvdG90eXBlLl9nZXRJZGVudGl0eURhdGEoW3RoaXMudXNlcl0sIHRydWUpWzBdLFxuICAgICAgICAgIGV4cGlyZXM6IERhdGUubm93KCkgKyAoMzAgKiA2MCAqIDYwICogMjQgKiAxMDAwKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIERvIG5vdGhpbmdcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9jbGllbnRBdXRoZW50aWNhdGVkKCk7XG4gIH1cblxuICAvKipcbiAgICogQXV0aGVudGljYXRpb24gaGFzIGZhaWxlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfYXV0aEVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXJyb3J9IHJlc3VsdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW4gTm90IGN1cnJlbnRseSB1c2VkXG4gICAqXG4gICAqIEBmaXJlcyBhdXRoZW50aWNhdGVkLWVycm9yXG4gICAqL1xuICBfYXV0aEVycm9yKGVycm9yLCBpZGVudGl0eVRva2VuKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdhdXRoZW50aWNhdGVkLWVycm9yJywgeyBlcnJvciB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHN0YXRlIGFuZCB0cmlnZ2VycyBldmVudHMgZm9yIGJvdGggY29ubmVjdGVkIGFuZCBhdXRoZW50aWNhdGVkLlxuICAgKlxuICAgKiBJZiByZXVzaW5nIGEgc2Vzc2lvblRva2VuIGNhY2hlZCBpbiBsb2NhbFN0b3JhZ2UsXG4gICAqIHVzZSB0aGlzIG1ldGhvZCByYXRoZXIgdGhhbiBfYXV0aENvbXBsZXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXNzaW9uVG9rZW5SZXN0b3JlZFxuICAgKiBAcHJpdmF0ZVxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkLCBhdXRoZW50aWNhdGVkXG4gICAqL1xuICBfc2Vzc2lvblRva2VuUmVzdG9yZWQoKSB7XG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IHRydWU7XG4gICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQnKTtcbiAgICB0aGlzLl9jbGllbnRBdXRoZW50aWNhdGVkKCk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGNsaWVudCBpcyBub3cgYXV0aGVudGljYXRlZCwgYW5kIGRvaW5nIHNvbWUgc2V0dXBcbiAgICogYmVmb3JlIGNhbGxpbmcgX2NsaWVudFJlYWR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGllbnRBdXRoZW50aWNhdGVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xpZW50QXV0aGVudGljYXRlZCgpIHtcbiAgICAvLyBVcGRhdGUgc3RhdGUgYW5kIHRyaWdnZXIgdGhlIGV2ZW50XG4gICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignYXV0aGVudGljYXRlZCcpO1xuXG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSkgdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCA9IGZhbHNlO1xuXG5cbiAgICAvLyBJZiBubyBwZXJzaXN0ZW5jZUZlYXR1cmVzIGFyZSBzcGVjaWZpZWQsIHNldCB0aGVtIGFsbFxuICAgIC8vIHRvIHRydWUgb3IgZmFsc2UgdG8gbWF0Y2ggaXNUcnVzdGVkRGV2aWNlLlxuICAgIGlmICghdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzIHx8ICF0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkKSB7XG4gICAgICBsZXQgc2Vzc2lvblRva2VuO1xuICAgICAgaWYgKHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcyAmJiAnc2Vzc2lvblRva2VuJyBpbiB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMpIHtcbiAgICAgICAgc2Vzc2lvblRva2VuID0gQm9vbGVhbih0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMuc2Vzc2lvblRva2VuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlc3Npb25Ub2tlbiA9IHRoaXMuaXNUcnVzdGVkRGV2aWNlO1xuICAgICAgfVxuICAgICAgdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzID0ge1xuICAgICAgICBjb252ZXJzYXRpb25zOiB0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkLFxuICAgICAgICBjaGFubmVsczogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgbWVzc2FnZXM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIGlkZW50aXRpZXM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIHN5bmNRdWV1ZTogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgc2Vzc2lvblRva2VuLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBTZXR1cCB0aGUgRGF0YWJhc2UgTWFuYWdlclxuICAgIGlmICghdGhpcy5kYk1hbmFnZXIpIHtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyID0gbmV3IERiTWFuYWdlcih7XG4gICAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgICAgdGFibGVzOiB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMsXG4gICAgICAgIGVuYWJsZWQ6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCZWZvcmUgY2FsbGluZyBfY2xpZW50UmVhZHksIGxvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIElkZW50aXR5LlxuICAgIGlmICh0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlci5vbk9wZW4oKCkgPT4gdGhpcy5fbG9hZFVzZXIoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xvYWRVc2VyKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIGlkZW50aXR5LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgZmFpbHVyZSB0byBsb2FkIHRoZSBpZGVudGl0eSB3aWxsIG5vdCBwcmV2ZW50XG4gICAqIF9jbGllbnRSZWFkeSwgYnV0IGlzIGNlcnRhaW5seSBub3QgYSBkZXNpcmVkIG91dGNvbWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRVc2VyXG4gICAqL1xuICBfbG9hZFVzZXIoKSB7XG4gICAgLy8gV2UncmUgZG9uZSBpZiB3ZSBnb3QgdGhlIGZ1bGwgaWRlbnRpdHkgZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAgaWYgKHRoaXMudXNlci5pc0Z1bGxJZGVudGl0eSkge1xuICAgICAgdGhpcy5fY2xpZW50UmVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbG9hZCB0aGUgdXNlcidzIGZ1bGwgSWRlbnRpdHkgc28gd2UgaGF2ZSBwcmVzZW5jZTtcbiAgICAgIHRoaXMudXNlci5fbG9hZCgpO1xuICAgICAgdGhpcy51c2VyLm9uY2UoJ2lkZW50aXRpZXM6bG9hZGVkJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpKSB7XG4gICAgICAgICAgdGhpcy5fd3JpdGVTZXNzaW9uT3duZXIoKTtcbiAgICAgICAgICB0aGlzLnVzZXIub24oJ2lkZW50aXRpZXM6Y2hhbmdlJywgdGhpcy5fd3JpdGVTZXNzaW9uT3duZXIsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsaWVudFJlYWR5KCk7XG4gICAgICB9KVxuICAgICAgLm9uY2UoJ2lkZW50aXRpZXM6bG9hZGVkLWVycm9yJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMudXNlci5kaXNwbGF5TmFtZSkgdGhpcy51c2VyLmRpc3BsYXlOYW1lID0gdGhpcy5kZWZhdWx0T3duZXJEaXNwbGF5TmFtZTtcbiAgICAgICAgdGhpcy5fY2xpZW50UmVhZHkoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSB0aGUgbGF0ZXN0IHN0YXRlIG9mIHRoZSBTZXNzaW9uJ3MgSWRlbnRpdHkgb2JqZWN0IHRvIGxvY2FsU3RvcmFnZVxuICAgKlxuICAgKiBAbWV0aG9kIF93cml0ZVNlc3Npb25Pd25lclxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3dyaXRlU2Vzc2lvbk93bmVyKCkge1xuICAgIHRyeSB7XG4gICAgICAvLyBVcGRhdGUgdGhlIHNlc3Npb24gZGF0YSBpbiBsb2NhbFN0b3JhZ2Ugd2l0aCBvdXIgZnVsbCBJZGVudGl0eS5cbiAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gSlNPTi5wYXJzZShnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0pO1xuICAgICAgc2Vzc2lvbkRhdGEudXNlciA9IERiTWFuYWdlci5wcm90b3R5cGUuX2dldElkZW50aXR5RGF0YShbdGhpcy51c2VyXSlbMF07XG4gICAgICBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0gPSBKU09OLnN0cmluZ2lmeShzZXNzaW9uRGF0YSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gbm8tb3BcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHRvIGZsYWcgdGhlIGNsaWVudCBhcyByZWFkeSBmb3IgYWN0aW9uLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgYWZ0ZXIgYXV0aGVuaWNhdGlvbiBBTkRcbiAgICogYWZ0ZXIgaW5pdGlhbCBjb252ZXJzYXRpb25zIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NsaWVudFJlYWR5XG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyByZWFkeVxuICAgKi9cbiAgX2NsaWVudFJlYWR5KCkge1xuICAgIGlmICghdGhpcy5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmlzUmVhZHkgPSB0cnVlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdyZWFkeScpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyogQ09OTkVDVCBNRVRIT0RTIEVORCAqL1xuXG5cbiAgLyogU1RBUlQgU0VTU0lPTiBNQU5BR0VNRU5UIE1FVEhPRFMgKi9cblxuICAvKipcbiAgICogRGVsZXRlcyB5b3VyIHNlc3Npb25Ub2tlbiBmcm9tIHRoZSBzZXJ2ZXIsIGFuZCByZW1vdmVzIGFsbCB1c2VyIGRhdGEgZnJvbSB0aGUgQ2xpZW50LlxuICAgKiBDYWxsIGBjbGllbnQuY29ubmVjdCgpYCB0byByZXN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBwcm9jZXNzLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgaXMgYXN5bmNocm9ub3VzOyBzb21lIGJyb3dzZXJzIChhaGVtLCBzYWZhcmkuLi4pIG1heSBub3QgaGF2ZSBjb21wbGV0ZWQgdGhlIGRlbGV0aW9uIG9mXG4gICAqIHBlcnNpc3RlZCBkYXRhIGlmIHlvdVxuICAgKiBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhlIHBhZ2UuICBVc2UgdGhlIGNhbGxiYWNrIHRvIGRldGVybWluZSB3aGVuIGFsbCBuZWNlc3NhcnkgY2xlYW51cCBoYXMgY29tcGxldGVkXG4gICAqIHByaW9yIHRvIG5hdmlnYXRpbmcgYXdheS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdoaWxlIGFsbCBkYXRhIHNob3VsZCBiZSBwdXJnZWQgZnJvbSB0aGUgYnJvd3Nlci9kZXZpY2UsIGlmIHlvdSBhcmUgb2ZmbGluZSB3aGVuIHRoaXMgaXMgY2FsbGVkLFxuICAgKiB5b3VyIHNlc3Npb24gdG9rZW4gd2lsbCBOT1QgYmUgZGVsZXRlZCBmcm9tIHRoZSB3ZWIgc2VydmVyLiAgV2h5IG5vdD8gQmVjYXVzZSBpdCB3b3VsZCBpbnZvbHZlIHJldGFpbmluZyB0aGVcbiAgICogcmVxdWVzdCBhZnRlciBhbGwgb2YgdGhlIHVzZXIncyBkYXRhIGhhcyBiZWVuIGRlbGV0ZWQsIG9yIE5PVCBkZWxldGluZyB0aGUgdXNlcidzIGRhdGEgdW50aWwgd2UgYXJlIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2dvdXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgbG9nb3V0KGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd2FudHNUb0JlQXV0aGVudGljYXRlZCA9IGZhbHNlO1xuICAgIGxldCBjYWxsYmFja0NvdW50ID0gMSxcbiAgICAgIGNvdW50ZXIgPSAwO1xuICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCkge1xuICAgICAgY2FsbGJhY2tDb3VudCsrO1xuICAgICAgdGhpcy54aHIoe1xuICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgICB1cmw6ICcvc2Vzc2lvbnMvJyArIGVzY2FwZSh0aGlzLnNlc3Npb25Ub2tlbiksXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgKCkgPT4ge1xuICAgICAgICBjb3VudGVyKys7XG4gICAgICAgIGlmIChjb3VudGVyID09PSBjYWxsYmFja0NvdW50ICYmIGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgZGF0YSBldmVuIGlmIGlzQXV0aGVudGljYXRlZCBpcyBmYWxzZVxuICAgIC8vIFNlc3Npb24gbWF5IGhhdmUgZXhwaXJlZCwgYnV0IGRhdGEgc3RpbGwgY2FjaGVkLlxuICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgoKSA9PiB7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gY2FsbGJhY2tDb3VudCAmJiBjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICB9KTtcblxuICAgIHRoaXMuX3Jlc2V0U2Vzc2lvbigpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICBfY2xlYXJTdG9yZWREYXRhKGNhbGxiYWNrKSB7XG4gICAgaWYgKGdsb2JhbC5sb2NhbFN0b3JhZ2UpIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKExPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZCk7XG4gICAgaWYgKHRoaXMuZGJNYW5hZ2VyKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlci5kZWxldGVUYWJsZXMoY2FsbGJhY2spO1xuICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvZyBvdXQvY2xlYXIgc2Vzc2lvbiBpbmZvcm1hdGlvbi5cbiAgICpcbiAgICogVXNlIHRoaXMgdG8gY2xlYXIgdGhlIHNlc3Npb25Ub2tlbiBhbmQgYWxsIGluZm9ybWF0aW9uIGZyb20gdGhpcyBzZXNzaW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNldFNlc3Npb25cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldFNlc3Npb24oKSB7XG4gICAgdGhpcy5pc1JlYWR5ID0gZmFsc2U7XG4gICAgdGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5zZXNzaW9uVG9rZW4pIHtcbiAgICAgIHRoaXMuc2Vzc2lvblRva2VuID0gJyc7XG4gICAgICBpZiAoZ2xvYmFsLmxvY2FsU3RvcmFnZSkge1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcignZGVhdXRoZW50aWNhdGVkJyk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLnN0b3AoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB5b3VyIElPUyBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHJlZ2lzdGVySU9TUHVzaFRva2VuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLmRldmljZUlkIC0gWW91ciBJT1MgZGV2aWNlJ3MgZGV2aWNlIElEXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLmlvc1ZlcnNpb24gLSBZb3VyIElPUyBkZXZpY2UncyB2ZXJzaW9uIG51bWJlclxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy50b2tlbiAtIFlvdXIgQXBwbGUgQVBOUyBUb2tlblxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuYnVuZGxlSWRdIC0gWW91ciBBcHBsZSBBUE5TIEJ1bmRsZSBJRCAoXCJjb20ubGF5ZXIuYnVuZGxlaWRcIilcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPW51bGxdIC0gT3B0aW9uYWwgY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBjYWxsYmFjay5lcnJvciAtIExheWVyRXJyb3IgaWYgdGhlcmUgd2FzIGFuIGVycm9yOyBudWxsIGlmIHN1Y2Nlc3NmdWxcbiAgICovXG4gIHJlZ2lzdGVySU9TUHVzaFRva2VuKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy54aHIoe1xuICAgICAgdXJsOiAncHVzaF90b2tlbnMnLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdG9rZW46IG9wdGlvbnMudG9rZW4sXG4gICAgICAgIHR5cGU6ICdhcG5zJyxcbiAgICAgICAgZGV2aWNlX2lkOiBvcHRpb25zLmRldmljZUlkLFxuICAgICAgICBpb3NfdmVyc2lvbjogb3B0aW9ucy5pb3NWZXJzaW9uLFxuICAgICAgICBhcG5zX2J1bmRsZV9pZDogb3B0aW9ucy5idW5kbGVJZCxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IGNhbGxiYWNrKHJlc3VsdC5kYXRhKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgeW91ciBBbmRyb2lkIGRldmljZSB0byByZWNlaXZlIG5vdGlmaWNhdGlvbnMuXG4gICAqIEZvciB1c2Ugd2l0aCBuYXRpdmUgY29kZSBvbmx5IChDb3Jkb3ZhLCBSZWFjdCBOYXRpdmUsIFRpdGFuaXVtLCBldGMuLi4pXG4gICAqXG4gICAqIEBtZXRob2QgcmVnaXN0ZXJBbmRyb2lkUHVzaFRva2VuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLmRldmljZUlkIC0gWW91ciBJT1MgZGV2aWNlJ3MgZGV2aWNlIElEXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLnRva2VuIC0gWW91ciBHQ00gcHVzaCBUb2tlblxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy5zZW5kZXJJZCAtIFlvdXIgR0NNIFNlbmRlciBJRC9Qcm9qZWN0IE51bWJlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9bnVsbF0gLSBPcHRpb25hbCBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGNhbGxiYWNrLmVycm9yIC0gTGF5ZXJFcnJvciBpZiB0aGVyZSB3YXMgYW4gZXJyb3I7IG51bGwgaWYgc3VjY2Vzc2Z1bFxuICAgKi9cbiAgcmVnaXN0ZXJBbmRyb2lkUHVzaFRva2VuKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy54aHIoe1xuICAgICAgdXJsOiAncHVzaF90b2tlbnMnLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdG9rZW46IG9wdGlvbnMudG9rZW4sXG4gICAgICAgIHR5cGU6ICdnY20nLFxuICAgICAgICBkZXZpY2VfaWQ6IG9wdGlvbnMuZGV2aWNlSWQsXG4gICAgICAgIGdjbV9zZW5kZXJfaWQ6IG9wdGlvbnMuc2VuZGVySWQsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiBjYWxsYmFjayhyZXN1bHQuZGF0YSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHlvdXIgQW5kcm9pZCBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHVucmVnaXN0ZXJQdXNoVG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGRldmljZUlkIC0gWW91ciBJT1MgZGV2aWNlJ3MgZGV2aWNlIElEXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1udWxsXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gY2FsbGJhY2suZXJyb3IgLSBMYXllckVycm9yIGlmIHRoZXJlIHdhcyBhbiBlcnJvcjsgbnVsbCBpZiBzdWNjZXNzZnVsXG4gICAqL1xuICB1bnJlZ2lzdGVyUHVzaFRva2VuKGRldmljZUlkLCBjYWxsYmFjaykge1xuICAgIHRoaXMueGhyKHtcbiAgICAgIHVybDogJ3B1c2hfdG9rZW5zLycgKyBkZXZpY2VJZCxcbiAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgfSwgcmVzdWx0ID0+IGNhbGxiYWNrKHJlc3VsdC5kYXRhKSk7XG4gIH1cblxuICAvKiBTRVNTSU9OIE1BTkFHRU1FTlQgTUVUSE9EUyBFTkQgKi9cblxuXG4gIC8qIEFDQ0VTU09SIE1FVEhPRFMgQkVHSU4gKi9cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGF0dGVtcHQgdG8gZXhlY3V0ZSBgdGhpcy51c2VyQXBwSWQgPSAneHh4J2Agd2lsbCBjYXVzZSBhbiBlcnJvciB0byBiZSB0aHJvd25cbiAgICogaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfX2FkanVzdEFwcElkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIE5ldyBhcHBJZCB2YWx1ZVxuICAgKi9cbiAgX19hZGp1c3RBcHBJZCgpIHtcbiAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jYW50Q2hhbmdlSWZDb25uZWN0ZWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBhdHRlbXB0IHRvIGV4ZWN1dGUgYHRoaXMudXNlciA9IHVzZXJJZGVudGl0eWAgd2lsbCBjYXVzZSBhbiBlcnJvciB0byBiZSB0aHJvd25cbiAgICogaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfX2FkanVzdFVzZXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXIgLSBuZXcgSWRlbnRpdHkgb2JqZWN0XG4gICAqL1xuICBfX2FkanVzdFVzZXIodXNlcikge1xuICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNhbnRDaGFuZ2VJZkNvbm5lY3RlZCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmlydHVhbCBtZXRob2RzXG4gIF9hZGRJZGVudGl0eShpZGVudGl0eSkge31cbiAgX3JlbW92ZUlkZW50aXR5KGlkZW50aXR5KSB7fVxuXG5cbiAgLyogQUNDRVNTT1IgTUVUSE9EUyBFTkQgKi9cblxuXG4gIC8qIENPTU1VTklDQVRJT05TIE1FVEhPRFMgQkVHSU4gKi9cbiAgc2VuZFNvY2tldFJlcXVlc3QoZGF0YSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBpc0NoYW5nZXNBcnJheSA9IEJvb2xlYW4oZGF0YS5pc0NoYW5nZXNBcnJheSk7XG4gICAgaWYgKHRoaXMuX3dhbnRzVG9CZUF1dGhlbnRpY2F0ZWQgJiYgIXRoaXMuaXNBdXRoZW50aWNhdGVkKSB0aGlzLl9jb25uZWN0KCk7XG5cbiAgICBpZiAoZGF0YS5zeW5jKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBkYXRhLnN5bmMudGFyZ2V0O1xuICAgICAgbGV0IGRlcGVuZHMgPSBkYXRhLnN5bmMuZGVwZW5kcztcbiAgICAgIGlmICh0YXJnZXQgJiYgIWRlcGVuZHMpIGRlcGVuZHMgPSBbdGFyZ2V0XTtcblxuICAgICAgdGhpcy5zeW5jTWFuYWdlci5yZXF1ZXN0KG5ldyBXZWJzb2NrZXRTeW5jRXZlbnQoe1xuICAgICAgICBkYXRhOiBkYXRhLmJvZHksXG4gICAgICAgIG9wZXJhdGlvbjogZGF0YS5tZXRob2QsXG4gICAgICAgIHJldHVybkNoYW5nZXNBcnJheTogaXNDaGFuZ2VzQXJyYXksXG4gICAgICAgIHRhcmdldCxcbiAgICAgICAgZGVwZW5kcyxcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICB9KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgZGF0YS5kYXRhID09PSAnZnVuY3Rpb24nKSBkYXRhLmRhdGEgPSBkYXRhLmRhdGEoKTtcbiAgICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3QoeyBkYXRhLCBpc0NoYW5nZXNBcnJheSwgY2FsbGJhY2sgfSk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogVGhpcyBldmVudCBoYW5kbGVyIHJlY2VpdmVzIGV2ZW50cyBmcm9tIHRoZSBPbmxpbmUgU3RhdGUgTWFuYWdlciBhbmQgZ2VuZXJhdGVzIGFuIGV2ZW50IGZvciB0aG9zZSBzdWJzY3JpYmVkXG4gICAqIHRvIGNsaWVudC5vbignb25saW5lJylcbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlT25saW5lQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlT25saW5lQ2hhbmdlKGV2dCkge1xuICAgIGlmICghdGhpcy5fd2FudHNUb0JlQXV0aGVudGljYXRlZCkgcmV0dXJuO1xuICAgIGNvbnN0IGR1cmF0aW9uID0gZXZ0Lm9mZmxpbmVEdXJhdGlvbjtcbiAgICBjb25zdCBpc09ubGluZSA9IGV2dC5ldmVudE5hbWUgPT09ICdjb25uZWN0ZWQnO1xuICAgIGNvbnN0IG9iaiA9IHsgaXNPbmxpbmUgfTtcbiAgICBpZiAoaXNPbmxpbmUpIHtcbiAgICAgIG9iai5yZXNldCA9IGR1cmF0aW9uID4gQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uO1xuXG4gICAgICAvLyBUT0RPOiBVc2UgYSBjYWNoZWQgbm9uY2UgaWYgaXQgaGFzbid0IGV4cGlyZWRcbiAgICAgIGlmICghdGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHRoaXMuX2Nvbm5lY3QoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdvbmxpbmUnLCBvYmopO1xuICB9XG5cbiAgLyoqXG4gICAqIE1haW4gZW50cnkgcG9pbnQgZm9yIHNlbmRpbmcgeGhyIHJlcXVlc3RzIG9yIGZvciBxdWVpbmcgdGhlbSBpbiB0aGUgc3luY01hbmFnZXIuXG4gICAqXG4gICAqIFRoaXMgY2FsbCBhZGp1c3QgYXJndW1lbnRzIGZvciBvdXIgUkVTVCBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgeGhyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIG9wdGlvbnNcbiAgICogQHBhcmFtICB7c3RyaW5nfSAgIG9wdGlvbnMudXJsIC0gVVJMIHJlbGF0aXZlIGNsaWVudCdzIHVybDogXCIvY29udmVyc2F0aW9uc1wiXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgY2FsbGJhY2sucmVzdWx0XG4gICAqIEBwYXJhbSAge01peGVkfSAgICBjYWxsYmFjay5yZXN1bHQuZGF0YSAtIElmIGFuIGVycm9yIG9jY3VycmVkLCB0aGlzIGlzIGEgbGF5ZXIuTGF5ZXJFcnJvcjtcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZiB0aGUgcmVzcG9uc2Ugd2FzIGFwcGxpY2F0aW9uL2pzb24sIHRoaXMgd2lsbCBiZSBhbiBvYmplY3RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZiB0aGUgcmVzcG9uc2Ugd2FzIHRleHQvZW1wdHksIHRoaXMgd2lsbCBiZSB0ZXh0L2VtcHR5XG4gICAqIEBwYXJhbSAge1hNTEh0dHBSZXF1ZXN0fSBjYWxsYmFjay5yZXN1bHQueGhyIC0gTmF0aXZlIHhociByZXF1ZXN0IG9iamVjdCBmb3IgZGV0YWlsZWQgYW5hbHlzaXNcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgIGNhbGxiYWNrLnJlc3VsdC5MaW5rcyAtIEhhc2ggb2YgTGluayBoZWFkZXJzXG4gICAqIEByZXR1cm4ge2xheWVyLkNsaWVudEF1dGhlbnRpY2F0b3J9IHRoaXNcbiAgICovXG4gIHhocihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghb3B0aW9ucy5zeW5jIHx8ICFvcHRpb25zLnN5bmMudGFyZ2V0KSB7XG4gICAgICBvcHRpb25zLnVybCA9IHRoaXMuX3hockZpeFJlbGF0aXZlVXJscyhvcHRpb25zLnVybCB8fCAnJyk7XG4gICAgfVxuXG4gICAgb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgIGlmICghb3B0aW9ucy5tZXRob2QpIG9wdGlvbnMubWV0aG9kID0gJ0dFVCc7XG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIG9wdGlvbnMuaGVhZGVycyA9IHt9O1xuICAgIHRoaXMuX3hockZpeEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKTtcbiAgICB0aGlzLl94aHJGaXhBdXRoKG9wdGlvbnMuaGVhZGVycyk7XG5cblxuICAgIC8vIE5vdGU6IHRoaXMgaXMgbm90IHN5bmMgdnMgYXN5bmM7IHRoaXMgaXMgc3luY01hbmFnZXIgdnMgZmlyZSBpdCBub3dcbiAgICBpZiAob3B0aW9ucy5zeW5jID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5fbm9uc3luY1hocihvcHRpb25zLCBjYWxsYmFjaywgMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N5bmNYaHIob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgeGhyIGNhbGxzIHRoYXQgZ28gdGhyb3VnaCB0aGUgc3luYyBtYW5hZ2VyLCBxdWV1ZSBpdCB1cC5cbiAgICpcbiAgICogQG1ldGhvZCBfc3luY1hoclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIF9zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFvcHRpb25zLnN5bmMpIG9wdGlvbnMuc3luYyA9IHt9O1xuICAgIGlmICh0aGlzLl93YW50c1RvQmVBdXRoZW50aWNhdGVkICYmICF0aGlzLmlzQXV0aGVudGljYXRlZCkgdGhpcy5fY29ubmVjdCgpO1xuXG4gICAgY29uc3QgaW5uZXJDYWxsYmFjayA9IChyZXN1bHQpID0+IHtcbiAgICAgIHRoaXMuX3hoclJlc3VsdChyZXN1bHQsIGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNvbnN0IHRhcmdldCA9IG9wdGlvbnMuc3luYy50YXJnZXQ7XG4gICAgbGV0IGRlcGVuZHMgPSBvcHRpb25zLnN5bmMuZGVwZW5kcztcbiAgICBpZiAodGFyZ2V0ICYmICFkZXBlbmRzKSBkZXBlbmRzID0gW3RhcmdldF07XG5cbiAgICB0aGlzLnN5bmNNYW5hZ2VyLnJlcXVlc3QobmV3IFhIUlN5bmNFdmVudCh7XG4gICAgICB1cmw6IG9wdGlvbnMudXJsLFxuICAgICAgZGF0YTogb3B0aW9ucy5kYXRhLFxuICAgICAgdGVsZW1ldHJ5OiBvcHRpb25zLnRlbGVtZXRyeSxcbiAgICAgIG1ldGhvZDogb3B0aW9ucy5tZXRob2QsXG4gICAgICBvcGVyYXRpb246IG9wdGlvbnMuc3luYy5vcGVyYXRpb24gfHwgb3B0aW9ucy5tZXRob2QsXG4gICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICBjYWxsYmFjazogaW5uZXJDYWxsYmFjayxcbiAgICAgIHRhcmdldCxcbiAgICAgIGRlcGVuZHMsXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciB4aHIgY2FsbHMgdGhhdCBkb24ndCBnbyB0aHJvdWdoIHRoZSBzeW5jIG1hbmFnZXIsXG4gICAqIGZpcmUgdGhlIHJlcXVlc3QsIGFuZCBpZiBpdCBmYWlscywgcmVmaXJlIGl0IHVwIHRvIDMgdHJpZXNcbiAgICogYmVmb3JlIHJlcG9ydGluZyBhbiBlcnJvci4gIDEgc2Vjb25kIGRlbGF5IGJldHdlZW4gcmVxdWVzdHNcbiAgICogc28gd2hhdGV2ZXIgaXNzdWUgaXMgb2NjdXJpbmcgaXMgYSB0aW55IGJpdCBtb3JlIGxpa2VseSB0byByZXNvbHZlLFxuICAgKiBhbmQgc28gd2UgZG9uJ3QgaGFtbWVyIHRoZSBzZXJ2ZXIgZXZlcnkgdGltZSB0aGVyZSdzIGEgcHJvYmxlbS5cbiAgICpcbiAgICogQG1ldGhvZCBfbm9uc3luY1hoclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHJldHJ5Q291bnRcbiAgICovXG4gIF9ub25zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrLCByZXRyeUNvdW50KSB7XG4gICAgeGhyKG9wdGlvbnMsIChyZXN1bHQpID0+IHtcbiAgICAgIGlmIChbNTAyLCA1MDMsIDUwNF0uaW5kZXhPZihyZXN1bHQuc3RhdHVzKSAhPT0gLTEgJiYgcmV0cnlDb3VudCA8IE1BWF9YSFJfUkVUUklFUykge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX25vbnN5bmNYaHIob3B0aW9ucywgY2FsbGJhY2ssIHJldHJ5Q291bnQgKyAxKSwgMTAwMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRml4IGF1dGhlbnRpY2F0aW9uIGhlYWRlciBmb3IgYW4geGhyIHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRml4QXV0aFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGhlYWRlcnNcbiAgICovXG4gIF94aHJGaXhBdXRoKGhlYWRlcnMpIHtcbiAgICBpZiAodGhpcy5zZXNzaW9uVG9rZW4gJiYgIWhlYWRlcnMuQXV0aG9yaXphdGlvbikge1xuICAgICAgaGVhZGVycy5hdXRob3JpemF0aW9uID0gJ0xheWVyIHNlc3Npb24tdG9rZW49XCInICsgdGhpcy5zZXNzaW9uVG9rZW4gKyAnXCInOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpeCByZWxhdGl2ZSBVUkxzIHRvIGNyZWF0ZSBhYnNvbHV0ZSBVUkxzIG5lZWRlZCBmb3IgQ09SUyByZXF1ZXN0cy5cbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRml4UmVsYXRpdmVVcmxzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVsYXRpdmUgb3IgYWJzb2x1dGUgdXJsXG4gICAqIEByZXR1cm4ge3N0cmluZ30gYWJzb2x1dGUgdXJsXG4gICAqL1xuICBfeGhyRml4UmVsYXRpdmVVcmxzKHVybCkge1xuICAgIGxldCByZXN1bHQgPSB1cmw7XG4gICAgaWYgKHVybC5pbmRleE9mKCdodHRwczovLycpID09PSAtMSkge1xuICAgICAgaWYgKHVybFswXSA9PT0gJy8nKSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMudXJsICsgdXJsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gdGhpcy51cmwgKyAnLycgKyB1cmw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogRml4dXAgYWxsIGhlYWRlcnMgaW4gcHJlcGFyYXRpb24gZm9yIGFuIHhociBjYWxsLlxuICAgKlxuICAgKiAxLiBBbGwgaGVhZGVycyB1c2UgbG93ZXIgY2FzZSBuYW1lcyBmb3Igc3RhbmRhcmQvZWFzeSBsb29rdXBcbiAgICogMi4gU2V0IHRoZSBhY2NlcHQgaGVhZGVyXG4gICAqIDMuIElmIG5lZWRlZCwgc2V0IHRoZSBjb250ZW50LXR5cGUgaGVhZGVyXG4gICAqXG4gICAqIEBtZXRob2QgX3hockZpeEhlYWRlcnNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBoZWFkZXJzXG4gICAqL1xuICBfeGhyRml4SGVhZGVycyhoZWFkZXJzKSB7XG4gICAgLy8gUmVwbGFjZSBhbGwgaGVhZGVycyBpbiBhcmJpdHJhcnkgY2FzZSB3aXRoIGFsbCBsb3dlciBjYXNlXG4gICAgLy8gZm9yIGVhc3kgbWF0Y2hpbmcuXG4gICAgY29uc3QgaGVhZGVyTmFtZUxpc3QgPSBPYmplY3Qua2V5cyhoZWFkZXJzKTtcbiAgICBoZWFkZXJOYW1lTGlzdC5mb3JFYWNoKChoZWFkZXJOYW1lKSA9PiB7XG4gICAgICBpZiAoaGVhZGVyTmFtZSAhPT0gaGVhZGVyTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgIGhlYWRlcnNbaGVhZGVyTmFtZS50b0xvd2VyQ2FzZSgpXSA9IGhlYWRlcnNbaGVhZGVyTmFtZV07XG4gICAgICAgIGRlbGV0ZSBoZWFkZXJzW2hlYWRlck5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCFoZWFkZXJzLmFjY2VwdCkgaGVhZGVycy5hY2NlcHQgPSBBQ0NFUFQ7XG5cbiAgICBpZiAoIWhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSBoZWFkZXJzWydjb250ZW50LXR5cGUnXSA9ICdhcHBsaWNhdGlvbi9qc29uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgdGhlIHJlc3VsdCBvZiBhbiB4aHIgY2FsbFxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlc3VsdCAgICAgU3RhbmRhcmQgeGhyIHJlc3BvbnNlIG9iamVjdCBmcm9tIHRoZSB4aHIgbGliXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIENhbGxiYWNrIG9uIGNvbXBsZXRpb25cbiAgICovXG4gIF94aHJSZXN1bHQocmVzdWx0LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG5cbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAvLyBSZXBsYWNlIHRoZSByZXNwb25zZSB3aXRoIGEgTGF5ZXJFcnJvciBpbnN0YW5jZVxuICAgICAgaWYgKHJlc3VsdC5kYXRhICYmIHR5cGVvZiByZXN1bHQuZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5fZ2VuZXJhdGVFcnJvcihyZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBpdHMgYW4gYXV0aGVudGljYXRpb24gZXJyb3IsIHJlYXV0aGVudGljYXRlXG4gICAgICAvLyBkb24ndCBjYWxsIF9yZXNldFNlc3Npb24gYXMgdGhhdCB3aXBlcyBhbGwgZGF0YSBhbmQgc2NyZXdzIHdpdGggVUlzLCBhbmQgdGhlIHVzZXJcbiAgICAgIC8vIGlzIHN0aWxsIGF1dGhlbnRpY2F0ZWQgb24gdGhlIGN1c3RvbWVyJ3MgYXBwIGV2ZW4gaWYgbm90IG9uIExheWVyLlxuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDQwMSAmJiB0aGlzLl93YW50c1RvQmVBdXRoZW50aWNhdGVkKSB7XG4gICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKCdTRVNTSU9OIEVYUElSRUQhJyk7XG4gICAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmlzUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoZ2xvYmFsLmxvY2FsU3RvcmFnZSkgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2RlYXV0aGVudGljYXRlZCcpO1xuICAgICAgICAgIHRoaXMuX2F1dGhlbnRpY2F0ZShyZXN1bHQuZGF0YS5nZXROb25jZSgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuX2xhc3RDaGFsbGVuZ2VUaW1lID4gRGF0ZS5ub3coKSArIENsaWVudEF1dGhlbnRpY2F0b3IuVGltZUJldHdlZW5SZWF1dGhzKSB7XG4gICAgICAgICAgdGhpcy5fYXV0aGVudGljYXRlKHJlc3VsdC5kYXRhLmdldE5vbmNlKCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm1zIHhociBlcnJvciByZXNwb25zZSBpbnRvIGEgbGF5ZXIuTGF5ZXJFcnJvciBpbnN0YW5jZS5cbiAgICpcbiAgICogQWRkcyBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIHRvIHRoZSByZXN1bHQgb2JqZWN0IGluY2x1ZGluZ1xuICAgKlxuICAgKiAqIHVybFxuICAgKiAqIGRhdGFcbiAgICpcbiAgICogQG1ldGhvZCBfZ2VuZXJhdGVFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAtIFJlc3VsdCBvZiB0aGUgeGhyIGNhbGxcbiAgICovXG4gIF9nZW5lcmF0ZUVycm9yKHJlc3VsdCkge1xuICAgIHJlc3VsdC5kYXRhID0gbmV3IExheWVyRXJyb3IocmVzdWx0LmRhdGEpO1xuICAgIGlmICghcmVzdWx0LmRhdGEuaHR0cFN0YXR1cykgcmVzdWx0LmRhdGEuaHR0cFN0YXR1cyA9IHJlc3VsdC5zdGF0dXM7XG4gICAgcmVzdWx0LmRhdGEubG9nKCk7XG4gIH1cblxuICAvKiBFTkQgQ09NTVVOSUNBVElPTlMgTUVUSE9EUyAqL1xuXG59XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyBjdXJyZW50bHkgYXV0aGVudGljYXRlZCBieSB0aGUgc2VydmVyLlxuICogU2hvdWxkIG5ldmVyIGJlIHRydWUgaWYgaXNDb25uZWN0ZWQgaXMgZmFsc2UuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcblxuLyoqXG4gKiBTdGF0ZSB2YXJpYWJsZTsgaW5kaWNhdGVzIHRoYXQgY2xpZW50IGlzIGN1cnJlbnRseSBjb25uZWN0ZWQgdG8gc2VydmVyXG4gKiAobWF5IG5vdCBiZSBhdXRoZW50aWNhdGVkIHlldClcbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZmFsc2U7XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyByZWFkeSBmb3IgdGhlIGFwcCB0byB1c2UuXG4gKiBVc2UgdGhlICdyZWFkeScgZXZlbnQgdG8gYmUgbm90aWZpZWQgd2hlbiB0aGlzIHZhbHVlIGNoYW5nZXMgdG8gdHJ1ZS5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1JlYWR5ID0gZmFsc2U7XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyBpZiB0aGUgV2ViU0RLIHRoaW5rcyB0aGF0IHRoZSBhcHAgV0FOVFMgdG8gYmUgY29ubmVjdGVkLlxuICpcbiAqIEFuIGFwcCB3YW50cyB0byBiZSBjb25uZWN0ZWQgaWYgaXQgaGFzIGNhbGxlZCBgY29ubmVjdCgpYCBvciBgY29ubmVjdFdpdGhTZXNzaW9uKClgXG4gKiBhbmQgaGFzIG5vdCBjYWxsZWQgYGxvZ291dCgpYC4gIEEgY2xpZW50IHRoYXQgaXMgY29ubmVjdGVkIHdpbGwgcmVjZWl2ZSByZWF1dGhlbnRpY2F0aW9uXG4gKiBldmVudHMgaW4gdGhlIGZvcm0gb2YgYGNoYWxsZW5nZWAgZXZlbnRzLlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLl93YW50c1RvQmVBdXRoZW50aWNhdGVkID0gZmFsc2U7XG5cbi8qKlxuICogSWYgcHJlc2VuY2UgaXMgZW5hYmxlZCwgdGhlbiB5b3VyIHByZXNlbmNlIGNhbiBiZSBzZXQvcmVzdG9yZWQuXG4gKlxuICogQHR5cGUge0Jvb2xlYW59IFtpc1ByZXNlbmNlRW5hYmxlZD10cnVlXVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1ByZXNlbmNlRW5hYmxlZCA9IHRydWU7XG5cbi8qKlxuICogWW91ciBMYXllciBBcHBsaWNhdGlvbiBJRC4gQ2FuIG5vdCBiZSBjaGFuZ2VkIG9uY2UgY29ubmVjdGVkLlxuICpcbiAqIFRvIGZpbmQgeW91ciBMYXllciBBcHBsaWNhdGlvbiBJRCwgc2VlIHlvdXIgTGF5ZXIgRGV2ZWxvcGVyIERhc2hib2FyZC5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5hcHBJZCA9ICcnO1xuXG4vKipcbiAqIElkZW50aXR5IGluZm9ybWF0aW9uIGFib3V0IHRoZSBhdXRoZW50aWNhdGVkIHVzZXIuXG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5fVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS51c2VyID0gbnVsbDtcblxuLyoqXG4gKiBZb3VyIGN1cnJlbnQgc2Vzc2lvbiB0b2tlbiB0aGF0IGF1dGhlbnRpY2F0ZXMgeW91ciByZXF1ZXN0cy5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnNlc3Npb25Ub2tlbiA9ICcnO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgbGFzdCBjaGFsbGVuZ2Ugd2FzIGlzc3VlZFxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5fbGFzdENoYWxsZW5nZVRpbWUgPSAwO1xuXG4vKipcbiAqIFVSTCB0byBMYXllcidzIFdlYiBBUEkgc2VydmVyLlxuICpcbiAqIE9ubHkgbXVjayB3aXRoIHRoaXMgaWYgdG9sZCB0byBieSBMYXllciBTdGFmZi5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnVybCA9ICdodHRwczovL2FwaS5sYXllci5jb20nO1xuXG4vKipcbiAqIFVSTCB0byBMYXllcidzIFdlYnNvY2tldCBzZXJ2ZXIuXG4gKlxuICogT25seSBtdWNrIHdpdGggdGhpcyBpZiB0b2xkIHRvIGJ5IExheWVyIFN0YWZmLlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUud2Vic29ja2V0VXJsID0gJ3dzczovL3dlYnNvY2tldHMubGF5ZXIuY29tJztcblxuLyoqXG4gKiBXZWIgU29ja2V0IE1hbmFnZXJcbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFdlYiBTb2NrZXQgUmVxdWVzdCBNYW5hZ2VyXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0UmVxdWVzdE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFdlYiBTb2NrZXQgTWFuYWdlclxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0Q2hhbmdlTWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogU2VydmljZSBmb3IgbWFuYWdpbmcgb25saW5lIGFzIHdlbGwgYXMgb2ZmbGluZSBzZXJ2ZXIgcmVxdWVzdHNcbiAqIEB0eXBlIHtsYXllci5TeW5jTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc3luY01hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIG9ubGluZS9vZmZsaW5lIHN0YXRlIGFuZCBldmVudHNcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLm9ubGluZU1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIElmIHRoaXMgaXMgYSB0cnVzdGVkIGRldmljZSwgdGhlbiB3ZSBjYW4gd3JpdGUgcGVyc29uYWwgZGF0YSB0byBwZXJzaXN0ZW50IG1lbW9yeS5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1RydXN0ZWREZXZpY2UgPSBmYWxzZTtcblxuLyoqXG4gKiBUbyBlbmFibGUgaW5kZXhlZERCIHN0b3JhZ2Ugb2YgcXVlcnkgZGF0YSwgc2V0IHRoaXMgdHJ1ZS4gIEV4cGVyaW1lbnRhbC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzUGVyc2lzdGVuY2VFbmFibGVkID0gZmFsc2U7XG5cbi8qKlxuICogSWYgdGhpcyBsYXllci5DbGllbnQuaXNUcnVzdGVkRGV2aWNlIGlzIHRydWUsIHRoZW4geW91IGNhbiBjb250cm9sIHdoaWNoIHR5cGVzIG9mIGRhdGEgYXJlIHBlcnNpc3RlZC5cbiAqXG4gKiBOb3RlIHRoYXQgdmFsdWVzIGhlcmUgYXJlIGlnbm9yZWQgaWYgYGlzUGVyc2lzdGVuY2VFbmFibGVkYCBoYXNuJ3QgYmVlbiBzZXQgdG8gYHRydWVgLlxuICpcbiAqIFByb3BlcnRpZXMgb2YgdGhpcyBPYmplY3QgY2FuIGJlOlxuICpcbiAqICogaWRlbnRpdGllczogV3JpdGUgaWRlbnRpdGllcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmYXN0ZXIgaW5pdGlhbGl6YXRpb24uXG4gKiAqIGNvbnZlcnNhdGlvbnM6IFdyaXRlIGNvbnZlcnNhdGlvbnMgdG8gaW5kZXhlZERCPyBUaGlzIGFsbG93cyBmb3IgZmFzdGVyIHJlbmRlcmluZ1xuICogICAgICAgICAgICAgICAgICBvZiBhIENvbnZlcnNhdGlvbiBMaXN0XG4gKiAqIG1lc3NhZ2VzOiBXcml0ZSBtZXNzYWdlcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmdWxsIG9mZmxpbmUgYWNjZXNzXG4gKiAqIHN5bmNRdWV1ZTogV3JpdGUgcmVxdWVzdHMgbWFkZSB3aGlsZSBvZmZsaW5lIHRvIGluZGV4ZWREQj8gIFRoaXMgYWxsb3dzIHRoZSBhcHBcbiAqICAgICAgICAgICAgICB0byBjb21wbGV0ZSBzZW5kaW5nIG1lc3NhZ2VzIGFmdGVyIGJlaW5nIHJlbGF1bmNoZWQuXG4gKiAqIHNlc3Npb25Ub2tlbjogV3JpdGUgdGhlIHNlc3Npb24gdG9rZW4gdG8gbG9jYWxTdG9yYWdlIGZvciBxdWljayByZWF1dGhlbnRpY2F0aW9uIG9uIHJlbGF1bmNoaW5nIHRoZSBhcHAuXG4gKlxuICogICAgICBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAqICAgICAgICBpc1RydXN0ZWREZXZpY2U6IHRydWUsXG4gKiAgICAgICAgcGVyc2lzdGVuY2VGZWF0dXJlczoge1xuICogICAgICAgICAgY29udmVyc2F0aW9uczogdHJ1ZSxcbiAqICAgICAgICAgIGlkZW50aXRpZXM6IHRydWUsXG4gKiAgICAgICAgICBtZXNzYWdlczogZmFsc2UsXG4gKiAgICAgICAgICBzeW5jUXVldWU6IGZhbHNlLFxuICogICAgICAgICAgc2Vzc2lvblRva2VuOiB0cnVlXG4gKiAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5wZXJzaXN0ZW5jZUZlYXR1cmVzID0gbnVsbDtcblxuLyoqXG4gKiBEYXRhYmFzZSBNYW5hZ2VyIGZvciByZWFkL3dyaXRlIHRvIEluZGV4ZWREQlxuICogQHR5cGUge2xheWVyLkRiTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuZGJNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBJZiBhIGRpc3BsYXkgbmFtZSBpcyBub3QgbG9hZGVkIGZvciB0aGUgc2Vzc2lvbiBvd25lciwgdXNlIHRoaXMgbmFtZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5kZWZhdWx0T3duZXJEaXNwbGF5TmFtZSA9ICdZb3UnO1xuXG4vKipcbiAqIElzIHRydWUgaWYgdGhlIGNsaWVudCBpcyBhdXRoZW50aWNhdGVkIGFuZCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlcjtcbiAqXG4gKiBUeXBpY2FsbHkgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlcmUgaXMgYSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogVHlwaWNhbGx5IHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCB0aGUgYG9ubGluZWAgZXZlbnQuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2lzT25saW5lJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbmxpbmVNYW5hZ2VyICYmIHRoaXMub25saW5lTWFuYWdlci5pc09ubGluZTtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIExvZyBsZXZlbHM7IG9uZSBvZjpcbiAqXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuTk9ORVxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLkVSUk9SXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuV0FSTlxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLklORk9cbiAqICAgICogbGF5ZXIuQ29uc3RhbnRzLkxPRy5ERUJVR1xuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2xvZ0xldmVsJywge1xuICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7IHJldHVybiBsb2dnZXIubGV2ZWw7IH0sXG4gIHNldDogZnVuY3Rpb24gc2V0KHZhbHVlKSB7IGxvZ2dlci5sZXZlbCA9IHZhbHVlOyB9LFxufSk7XG5cbi8qKlxuICogU2hvcnQgaGFuZCBmb3IgZ2V0dGluZyB0aGUgdXNlcklkIG9mIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIuXG4gKlxuICogQ291bGQgYWxzbyBqdXN0IHVzZSBjbGllbnQudXNlci51c2VySWRcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfSB1c2VySWRcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KENsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLCAndXNlcklkJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VyID8gdGhpcy51c2VyLnVzZXJJZCA6ICcnO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uIHNldCgpIHt9LFxufSk7XG5cbi8qKlxuICogVGltZSB0byBiZSBvZmZsaW5lIGFmdGVyIHdoaWNoIHdlIGRvbid0IGRvIGEgV2ViU29ja2V0IEV2ZW50cy5yZXBsYXksXG4gKiBidXQgaW5zdGVhZCBqdXN0IHJlZnJlc2ggYWxsIG91ciBRdWVyeSBkYXRhLiAgRGVmYXVsdHMgdG8gMzAgaG91cnMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uID0gMTAwMCAqIDYwICogNjAgKiAzMDtcblxuLyoqXG4gKiBOdW1iZXIgb2YgbWlsaXNlY29uZHMgZGVsYXkgbXVzdCBwYXNzIGJlZm9yZSBhIHN1YnNlcXVlbnQgY2hhbGxlbmdlIGlzIGlzc3VlZC5cbiAqXG4gKiBUaGlzIHZhbHVlIGlzIGhlcmUgdG8gaW5zdXJlIGFwcHMgZG9uJ3QgZ2V0IGNoYWxsZW5nZSByZXF1ZXN0cyB3aGlsZSB0aGV5IGFyZVxuICogc3RpbGwgcHJvY2Vzc2luZyB0aGUgbGFzdCBjaGFsbGVuZ2UgZXZlbnQuXG4gKlxuICogQHByb3BlcnR5IHtOdW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IuVGltZUJldHdlZW5SZWF1dGhzID0gMzAgKiAxMDAwO1xuXG4vKipcbiAqIExpc3Qgb2YgZXZlbnRzIHN1cHBvcnRlZCBieSB0aGlzIGNsYXNzXG4gKiBAc3RhdGljXG4gKiBAcHJvdGVjdGVkXG4gKiBAdHlwZSB7c3RyaW5nW119XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIFRoZSBjbGllbnQgaXMgcmVhZHkgZm9yIGFjdGlvblxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbigncmVhZHknLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgcmVuZGVyTXlVSSgpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICovXG4gICdyZWFkeScsXG5cbiAgLyoqXG4gICAqIEZpcmVkIHdoZW4gY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEN1cnJlbnRseSBqdXN0IG1lYW5zIHdlIGhhdmUgYSBub25jZS5cbiAgICogTm90IHJlY29tbWVuZGVkIGZvciB0eXBpY2FsIGFwcGxpY2F0aW9ucy5cbiAgICogQGV2ZW50IGNvbm5lY3RlZFxuICAgKi9cbiAgJ2Nvbm5lY3RlZCcsXG5cbiAgLyoqXG4gICAqIEZpcmVkIHdoZW4gdW5zdWNjZXNzZnVsIGluIG9idGFpbmluZyBhIG5vbmNlLlxuICAgKlxuICAgKiBOb3QgcmVjb21tZW5kZWQgZm9yIHR5cGljYWwgYXBwbGljYXRpb25zLlxuICAgKiBAZXZlbnQgY29ubmVjdGVkLWVycm9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnY29ubmVjdGVkLWVycm9yJyxcblxuICAvKipcbiAgICogV2Ugbm93IGhhdmUgYSBzZXNzaW9uIGFuZCBhbnkgcmVxdWVzdHMgd2Ugc2VuZCBhdWdodCB0byB3b3JrLlxuICAgKiBUeXBpY2FsbHkgeW91IHNob3VsZCB1c2UgdGhlIHJlYWR5IGV2ZW50IGluc3RlYWQgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgZXZlbnQuXG4gICAqIEBldmVudCBhdXRoZW50aWNhdGVkXG4gICAqL1xuICAnYXV0aGVudGljYXRlZCcsXG5cbiAgLyoqXG4gICAqIEZhaWxlZCB0byBhdXRoZW50aWNhdGUgeW91ciBjbGllbnQuXG4gICAqXG4gICAqIEVpdGhlciB5b3VyIGlkZW50aXR5LXRva2VuIHdhcyBpbnZhbGlkLCBvciBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgKiB1c2luZyB5b3VyIGlkZW50aXR5LXRva2VuLlxuICAgKlxuICAgKiBAZXZlbnQgYXV0aGVudGljYXRlZC1lcnJvclxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2F1dGhlbnRpY2F0ZWQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBUaGlzIGV2ZW50IGZpcmVzIHdoZW4gYSBzZXNzaW9uIGhhcyBleHBpcmVkIG9yIHdoZW4gYGxheWVyLkNsaWVudC5sb2dvdXRgIGlzIGNhbGxlZC5cbiAgICogVHlwaWNhbGx5LCBpdCBpcyBlbm91Z2ggdG8gc3Vic2NyaWJlIHRvIHRoZSBjaGFsbGVuZ2UgZXZlbnRcbiAgICogd2hpY2ggd2lsbCBsZXQgeW91IHJlYXV0aGVudGljYXRlOyB0eXBpY2FsIGFwcGxpY2F0aW9ucyBkbyBub3QgbmVlZFxuICAgKiB0byBzdWJzY3JpYmUgdG8gdGhpcy5cbiAgICpcbiAgICogQGV2ZW50IGRlYXV0aGVudGljYXRlZFxuICAgKi9cbiAgJ2RlYXV0aGVudGljYXRlZCcsXG5cbiAgLyoqXG4gICAqIEBldmVudCBjaGFsbGVuZ2VcbiAgICogVmVyaWZ5IHRoZSB1c2VyJ3MgaWRlbnRpdHkuXG4gICAqXG4gICAqIFRoaXMgZXZlbnQgaXMgd2hlcmUgeW91IHZlcmlmeSB0aGF0IHRoZSB1c2VyIGlzIHdobyB3ZSBhbGwgdGhpbmsgdGhlIHVzZXIgaXMsXG4gICAqIGFuZCBwcm92aWRlIGFuIGlkZW50aXR5IHRva2VuIHRvIHZhbGlkYXRlIHRoYXQuXG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogY2xpZW50Lm9uKCdjaGFsbGVuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgbXlHZXRJZGVudGl0eUZvck5vbmNlKGV2dC5ub25jZSwgZnVuY3Rpb24oaWRlbnRpdHlUb2tlbikge1xuICAgKiAgICAgIGV2dC5jYWxsYmFjayhpZGVudGl0eVRva2VuKTtcbiAgICogICAgfSk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5ub25jZSAtIEEgbm9uY2UgZm9yIHlvdSB0byBwcm92aWRlIHRvIHlvdXIgaWRlbnRpdHkgcHJvdmlkZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXZlbnQuY2FsbGJhY2sgLSBDYWxsIHRoaXMgb25jZSB5b3UgaGF2ZSBhbiBpZGVudGl0eS10b2tlblxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQuY2FsbGJhY2suaWRlbnRpdHlUb2tlbiAtIElkZW50aXR5IHRva2VuIHByb3ZpZGVkIGJ5IHlvdXIgaWRlbnRpdHkgcHJvdmlkZXIgc2VydmljZVxuICAgKi9cbiAgJ2NoYWxsZW5nZScsXG5cbiAgLyoqXG4gICAqIEBldmVudCBzZXNzaW9uLXRlcm1pbmF0ZWRcbiAgICogSWYgeW91ciBzZXNzaW9uIGhhcyBiZWVuIHRlcm1pbmF0ZWQgaW4gc3VjaCBhIHdheSBhcyB0byBwcmV2ZW50IGF1dG9tYXRpYyByZWNvbm5lY3QsXG4gICAqXG4gICAqIHRoaXMgZXZlbnQgd2lsbCBmaXJlLiAgQ29tbW9uIHNjZW5hcmlvOiB1c2VyIGhhcyB0d28gdGFicyBvcGVuO1xuICAgKiBvbmUgdGFiIHRoZSB1c2VyIGxvZ3Mgb3V0IChvciB5b3UgY2FsbCBjbGllbnQubG9nb3V0KCkpLlxuICAgKiBUaGUgb3RoZXIgdGFiIHdpbGwgZGV0ZWN0IHRoYXQgdGhlIHNlc3Npb25Ub2tlbiBoYXMgYmVlbiByZW1vdmVkLFxuICAgKiBhbmQgd2lsbCB0ZXJtaW5hdGUgaXRzIHNlc3Npb24gYXMgd2VsbC4gIEluIHRoaXMgc2NlbmFyaW8gd2UgZG8gbm90IHdhbnRcbiAgICogdG8gYXV0b21hdGljYWxseSB0cmlnZ2VyIGEgY2hhbGxlbmdlIGFuZCByZXN0YXJ0IHRoZSBsb2dpbiBwcm9jZXNzLlxuICAgKi9cbiAgJ3Nlc3Npb24tdGVybWluYXRlZCcsXG5cbiAgLyoqXG4gICAqIEBldmVudCBvbmxpbmVcbiAgICpcbiAgICogVGhpcyBldmVudCBpcyB1c2VkIHRvIGRldGVjdCB3aGVuIHRoZSBjbGllbnQgaXMgb25saW5lIChjb25uZWN0ZWQgdG8gdGhlIHNlcnZlcilcbiAgICogb3Igb2ZmbGluZSAoc3RpbGwgYWJsZSB0byBhY2NlcHQgQVBJIGNhbGxzIGJ1dCBubyBsb25nZXIgYWJsZSB0byBzeW5jIHRvIHRoZSBzZXJ2ZXIpLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignb25saW5lJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgaWYgKGV2dC5pc09ubGluZSkge1xuICAgKiAgICAgICAgICAgICBzdGF0dXNEaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2dyZWVuJztcbiAgICogICAgICAgICB9IGVsc2Uge1xuICAgKiAgICAgICAgICAgICBzdGF0dXNEaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JlZCc7XG4gICAqICAgICAgICAgfVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHtib29sZWFufSBldmVudC5pc09ubGluZVxuICAgKi9cbiAgJ29ubGluZScsXG5cblxuICAvKipcbiAgICogU3RhdGUgY2hhbmdlIGV2ZW50cyBhcmUgdXNlZCBmb3IgaW50ZXJuYWwgY29tbXVuaWNhdGlvbnMuXG4gICAqXG4gICAqIFByaW1hcmlseSB1c2VkIHNvIHRoYXQgdGhlIFRlbGVtZXRyeSBjb21wb25lbnQgY2FuIG1vbml0b3IgYW5kIHJlcG9ydCBvblxuICAgKiBzeXN0ZW0gYWN0aXZpdHkuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgJ3N0YXRlLWNoYW5nZScsXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDbGllbnRBdXRoZW50aWNhdG9yLCBbQ2xpZW50QXV0aGVudGljYXRvciwgJ0NsaWVudEF1dGhlbnRpY2F0b3InXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50QXV0aGVudGljYXRvcjtcbiJdfQ==
