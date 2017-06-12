'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Layer Client; this is the top level component for any Layer based application.

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
      challenge: function(evt) {
        myAuthenticator({
          nonce: evt.nonce,
          onSuccess: evt.callback
        });
      },
      ready: function(client) {
        alert('I am Client; Server: Serve me!');
      }
    }).connect('Fred')
 *
 * You can also initialize this as

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff'
    });

    client.on('challenge', function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    });

    client.on('ready', function(client) {
      alert('I am Client; Server: Serve me!');
    });

    client.connect('Fred');
 *
 * ## API Synopsis:
 *
 * The following Properties, Methods and Events are the most commonly used ones.  See the full API below
 * for the rest of the API.
 *
 * ### Properties:
 *
 * * layer.Client.userId: User ID of the authenticated user
 * * layer.Client.appId: The ID for your application
 *
 *
 * ### Methods:
 *
 * * layer.Client.createConversation(): Create a new layer.Conversation.
 * * layer.Client.createQuery(): Create a new layer.Query.
 * * layer.Client.getMessage(): Input a Message ID, and output a layer.Message or layer.Announcement from cache.
 * * layer.Client.getConversation(): Input a Conversation ID, and output a layer.Conversation from cache.
 * * layer.Client.on() and layer.Conversation.off(): event listeners
 * * layer.Client.destroy(): Cleanup all resources used by this client, including all Messages and Conversations.
 *
 * ### Events:
 *
 * * `challenge`: Provides a nonce and a callback; you call the callback once you have an Identity Token.
 * * `ready`: Your application can now start using the Layer services
 * * `messages:notify`: Used to notify your application of new messages for which a local notification may be suitable.
 *
 * ## Logging:
 *
 * There are two ways to change the log level for Layer's logger:
 *
 *     layer.Client.prototype.logLevel = layer.Constants.LOG.INFO;
 *
 * or
 *
 *     var client = new layer.Client({
 *        appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
 *        logLevel: layer.Constants.LOG.INFO
 *     });
 *
 * @class  layer.Client
 * @extends layer.ClientAuthenticator
 * @mixin layer.mixins.ClientIdentities
 * //@ mixin layer.mixins.ClientMembership
 * @mixin layer.mixins.ClientConversations
 * //@ mixin layer.mixins.ClientChannels
 * @mixin layer.mixins.ClientMessages
 * @mixin layer.mixins.ClientQueries
 */

var ClientAuth = require('./client-authenticator');
var Conversation = require('./models/conversation');
var Channel = require('./models/channel');
var ErrorDictionary = require('./layer-error').dictionary;
var ConversationMessage = require('./models/conversation-message');
var ChannelMessage = require('./models/channel-message');
var Announcement = require('./models/announcement');
var Identity = require('./models/identity');
var Membership = require('./models/membership');
var TypingIndicatorListener = require('./typing-indicators/typing-indicator-listener');
var Util = require('./client-utils');
var Root = require('./root');
var ClientRegistry = require('./client-registry');
var logger = require('./logger');
var TypingListener = require('./typing-indicators/typing-listener');
var TypingPublisher = require('./typing-indicators/typing-publisher');
var TelemetryMonitor = require('./telemetry-monitor');

var Client = function (_ClientAuth) {
  _inherits(Client, _ClientAuth);

  /*
   * Adds conversations, messages and websockets on top of the authentication client.
   * jsdocs on parent class constructor.
   */
  function Client(options) {
    _classCallCheck(this, Client);

    var _this = _possibleConstructorReturn(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this, options));

    ClientRegistry.register(_this);
    _this._models = {};
    _this._runMixins('constructor', [options]);

    // Initialize Properties
    _this._scheduleCheckAndPurgeCacheItems = [];

    _this._initComponents();

    _this.on('online', _this._connectionRestored.bind(_this));

    logger.info(Util.asciiInit(Client.version));
    return _this;
  }

  /* See parent method docs */


  _createClass(Client, [{
    key: '_initComponents',
    value: function _initComponents() {
      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_initComponents', this).call(this);

      this._typingIndicators = new TypingIndicatorListener({
        clientId: this.appId
      });
      this.telemetryMonitor = new TelemetryMonitor({
        client: this,
        enabled: this.telemetryEnabled
      });
    }

    /**
     * Cleanup all resources (Conversations, Messages, etc...) prior to destroy or reauthentication.
     *
     * @method _cleanup
     * @private
     */

  }, {
    key: '_cleanup',
    value: function _cleanup() {
      if (this.isDestroyed) return;
      this._inCleanup = true;

      try {
        this._runMixins('cleanup', []);
      } catch (e) {
        logger.error(e);
      }

      if (this.socketManager) this.socketManager.close();
      this._inCleanup = false;
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      // Cleanup all resources (Conversations, Messages, etc...)
      this._cleanup();

      this._destroyComponents();

      ClientRegistry.unregister(this);

      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), 'destroy', this).call(this);
      this._inCleanup = false;
    }
  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.appId) throw new Error(ErrorDictionary.appIdImmutable);
    }

    /**
     * Takes an array of Identity instances, User IDs, Identity IDs, Identity objects,
     * or Server formatted Identity Objects and returns an array of Identity instances.
     *
     * @method _fixIdentities
     * @private
     * @param {Mixed[]} identities - Something that tells us what Identity to return
     * @return {layer.Identity[]}
     */

  }, {
    key: '_fixIdentities',
    value: function _fixIdentities(identities) {
      var _this2 = this;

      return identities.map(function (identity) {
        if (identity instanceof Identity) return identity;
        if (typeof identity === 'string') {
          return _this2.getIdentity(identity, true);
        } else if (identity && (typeof identity === 'undefined' ? 'undefined' : _typeof(identity)) === 'object') {
          if ('userId' in identity) {
            return _this2.getIdentity(identity.id || identity.userId);
          } else if ('user_id' in identity) {
            return _this2._createObject(identity);
          }
        }
        return null;
      });
    }

    /**
     * Takes as input an object id, and either calls getConversation() or getMessage() as needed.
     *
     * Will only get cached objects, will not get objects from the server.
     *
     * This is not a public method mostly so there's no ambiguity over using getXXX
     * or getObject.  getXXX typically has an option to load the resource, which this
     * does not.
     *
     * @method getObject
     * @param  {string} id - Message, Conversation or Query id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a object from
     *                                     the server if not found (not supported for all objects)
     * @return {layer.Message|layer.Conversation|layer.Query}
     */

  }, {
    key: 'getObject',
    value: function getObject(id) {
      var canLoad = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      switch (Util.typeFromID(id)) {
        case 'messages':
        case 'announcements':
          return this.getMessage(id, canLoad);
        case 'conversations':
          return this.getConversation(id, canLoad);
        case 'channels':
          return this.getChannel(id, canLoad);
        case 'queries':
          return this.getQuery(id);
        case 'identities':
          return this.getIdentity(id, canLoad);
        case 'members':
          return this.getMember(id, canLoad);
      }
      return null;
    }

    /**
     * Takes an object description from the server and either updates it (if cached)
     * or creates and caches it .
     *
     * @method _createObject
     * @protected
     * @param  {Object} obj - Plain javascript object representing a Message or Conversation
     */

  }, {
    key: '_createObject',
    value: function _createObject(obj) {
      var item = this.getObject(obj.id);
      if (item) {
        item._populateFromServer(obj);
        return item;
      } else {
        switch (Util.typeFromID(obj.id)) {
          case 'messages':
            if (obj.conversation) {
              return ConversationMessage._createFromServer(obj, this);
            } else if (obj.channel) {
              return ChannelMessage._createFromServer(obj, this);
            }
            break;
          case 'announcements':
            return Announcement._createFromServer(obj, this);
          case 'conversations':
            return Conversation._createFromServer(obj, this);
          case 'channels':
            return Channel._createFromServer(obj, this);
          case 'identities':
            return Identity._createFromServer(obj, this);
          case 'members':
            return Membership._createFromServer(obj, this);
        }
      }
      return null;
    }

    /**
     * When a layer.Container's ID changes, we need to update
     * a variety of things and trigger events.
     *
     * @method _updateContainerId
     * @param {layer.Container} container
     * @param {String} oldId
     */

  }, {
    key: '_updateContainerId',
    value: function _updateContainerId(container, oldId) {
      if (container instanceof Conversation) {
        this._updateConversationId(container, oldId);
      } else {
        this._updateChannelId(container, oldId);
      }
    }

    /**
     * Merge events into smaller numbers of more complete events.
     *
     * Before any delayed triggers are fired, fold together all of the conversations:add
     * and conversations:remove events so that 100 conversations:add events can be fired as
     * a single event.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;

      var addConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:add';
      });
      var removeConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:remove';
      });
      this._foldEvents(addConversations, 'conversations', this);
      this._foldEvents(removeConversations, 'conversations', this);

      var addMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:add';
      });
      var removeMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:remove';
      });

      this._foldEvents(addMessages, 'messages', this);
      this._foldEvents(removeMessages, 'messages', this);

      var addIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:add';
      });
      var removeIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:remove';
      });

      this._foldEvents(addIdentities, 'identities', this);
      this._foldEvents(removeIdentities, 'identities', this);

      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_processDelayedTriggers', this).call(this);
    }
  }, {
    key: 'trigger',
    value: function trigger(eventName, evt) {
      this._triggerLogger(eventName, evt);
      _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), 'trigger', this).call(this, eventName, evt);
    }

    /**
     * Does logging on all triggered events.
     *
     * All logging is done at `debug` or `info` levels.
     *
     * @method _triggerLogger
     * @private
     */

  }, {
    key: '_triggerLogger',
    value: function _triggerLogger(eventName, evt) {
      var infoEvents = ['conversations:add', 'conversations:remove', 'conversations:change', 'messages:add', 'messages:remove', 'messages:change', 'identities:add', 'identities:remove', 'identities:change', 'challenge', 'ready'];
      if (infoEvents.indexOf(eventName) !== -1) {
        if (evt && evt.isChange) {
          logger.info('Client Event: ' + eventName + ' ' + evt.changes.map(function (change) {
            return change.property;
          }).join(', '));
        } else {
          var text = '';
          if (evt) {
            // If the triggered event has these messages, use a simpler way of rendering info about them
            if (evt.message) text = evt.message.id;
            if (evt.messages) text = evt.messages.length + ' messages';
            if (evt.conversation) text = evt.conversation.id;
            if (evt.conversations) text = evt.conversations.length + ' conversations';
            if (evt.channel) text = evt.channel.id;
            if (evt.channels) text = evt.channels.length + ' channels';
          }
          logger.info('Client Event: ' + eventName + ' ' + text);
        }
        if (evt) logger.debug(evt);
      } else {
        logger.debug(eventName, evt);
      }
    }

    /**
     * If the session has been reset, dump all data.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this._cleanup();
      this._runMixins('reset', []);
      return _get(Client.prototype.__proto__ || Object.getPrototypeOf(Client.prototype), '_resetSession', this).call(this);
    }

    /**
     * Check to see if the specified objects can safely be removed from cache.
     *
     * Removes from cache if an object is not part of any Query's result set.
     *
     * @method _checkAndPurgeCache
     * @private
     * @param  {layer.Root[]} objects - Array of Messages or Conversations
     */

  }, {
    key: '_checkAndPurgeCache',
    value: function _checkAndPurgeCache(objects) {
      var _this3 = this;

      this._inCheckAndPurgeCache = true;
      objects.forEach(function (obj) {
        if (!obj.isDestroyed && !_this3._isCachedObject(obj)) {
          if (obj instanceof Root === false) obj = _this3.getObject(obj.id);
          if (obj) obj.destroy();
        }
      });
      this._inCheckAndPurgeCache = false;
    }

    /**
     * Schedules _runScheduledCheckAndPurgeCache if needed, and adds this object
     * to the list of objects it will validate for uncaching.
     *
     * Note that any object that does not exist on the server (!isSaved()) is an object that the
     * app created and can only be purged by the app and not by the SDK.  Once its been
     * saved, and can be reloaded from the server when needed, its subject to standard caching.
     *
     * @method _scheduleCheckAndPurgeCache
     * @private
     * @param {layer.Root} object
     */

  }, {
    key: '_scheduleCheckAndPurgeCache',
    value: function _scheduleCheckAndPurgeCache(object) {
      var _this4 = this;

      if (object.isSaved()) {
        if (this._scheduleCheckAndPurgeCacheAt < Date.now()) {
          this._scheduleCheckAndPurgeCacheAt = Date.now() + Client.CACHE_PURGE_INTERVAL;
          setTimeout(function () {
            return _this4._runScheduledCheckAndPurgeCache();
          }, Client.CACHE_PURGE_INTERVAL);
        }
        this._scheduleCheckAndPurgeCacheItems.push(object);
      }
    }

    /**
     * Calls _checkAndPurgeCache on accumulated objects and resets its state.
     *
     * @method _runScheduledCheckAndPurgeCache
     * @private
     */

  }, {
    key: '_runScheduledCheckAndPurgeCache',
    value: function _runScheduledCheckAndPurgeCache() {
      var list = this._scheduleCheckAndPurgeCacheItems;
      this._scheduleCheckAndPurgeCacheItems = [];
      this._checkAndPurgeCache(list);
      this._scheduleCheckAndPurgeCacheAt = 0;
    }

    /**
     * Returns true if the specified object should continue to be part of the cache.
     *
     * Result is based on whether the object is part of the data for a Query.
     *
     * @method _isCachedObject
     * @private
     * @param  {layer.Root} obj - A Message or Conversation Instance
     * @return {Boolean}
     */

  }, {
    key: '_isCachedObject',
    value: function _isCachedObject(obj) {
      var list = Object.keys(this._models.queries);
      for (var i = 0; i < list.length; i++) {
        var query = this._models.queries[list[i]];
        if (query._getItem(obj.id)) return true;
      }
      return false;
    }

    /**
     * On restoring a connection, determine what steps need to be taken to update our data.
     *
     * A reset boolean property is passed; set based on  layer.ClientAuthenticator.ResetAfterOfflineDuration.
     *
     * Note it is possible for an application to have logic that causes queries to be created/destroyed
     * as a side-effect of layer.Query.reset destroying all data. So we must test to see if queries exist.
     *
     * @method _connectionRestored
     * @private
     * @param {boolean} reset - Should the session reset/reload all data or attempt to resume where it left off?
     */

  }, {
    key: '_connectionRestored',
    value: function _connectionRestored(evt) {
      var _this5 = this;

      if (evt.reset) {
        logger.debug('Client Connection Restored; Resetting all Queries');
        this.dbManager.deleteTables(function () {
          _this5.dbManager._open();
          Object.keys(_this5._models.queries).forEach(function (id) {
            var query = _this5._models.queries[id];
            if (query) query.reset();
          });
        });
      }
    }

    /**
     * Creates a layer.TypingIndicators.TypingListener instance
     * bound to the specified dom node.
     *
     *      var typingListener = client.createTypingListener(document.getElementById('myTextBox'));
     *      typingListener.setConversation(mySelectedConversation);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingListener.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * @method createTypingListener
     * @param  {HTMLElement} inputNode - Text input to watch for keystrokes
     * @return {layer.TypingIndicators.TypingListener}
     */

  }, {
    key: 'createTypingListener',
    value: function createTypingListener(inputNode) {
      return new TypingListener({
        clientId: this.appId,
        input: inputNode
      });
    }

    /**
     * Creates a layer.TypingIndicators.TypingPublisher.
     *
     * The TypingPublisher lets you manage your Typing Indicators without using
     * the layer.TypingIndicators.TypingListener.
     *
     *      var typingPublisher = client.createTypingPublisher();
     *      typingPublisher.setConversation(mySelectedConversation);
     *      typingPublisher.setState(layer.TypingIndicators.STARTED);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingPublisher.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * Use layer.TypingIndicators.TypingPublisher.setState to inform other users of your current state.
     * Note that the `STARTED` state only lasts for 2.5 seconds, so you
     * must repeatedly call setState for as long as this state should continue.
     * This is typically done by simply calling it every time a user hits
     * a key.
     *
     * @method createTypingPublisher
     * @return {layer.TypingIndicators.TypingPublisher}
     */

  }, {
    key: 'createTypingPublisher',
    value: function createTypingPublisher() {
      return new TypingPublisher({
        clientId: this.appId
      });
    }

    /**
     * Get the current typing indicator state of a specified Conversation.
     *
     * Typically used to see if anyone is currently typing when first opening a Conversation.
     *
     * @method getTypingState
     * @param {String} conversationId
     */

  }, {
    key: 'getTypingState',
    value: function getTypingState(conversationId) {
      return this._typingIndicators.getState(conversationId);
    }

    /**
     * Accessor for getting a Client by appId.
     *
     * Most apps will only have one client,
     * and will not need this method.
     *
     * @method getClient
     * @static
     * @param  {string} appId
     * @return {layer.Client}
     */

  }], [{
    key: 'getClient',
    value: function getClient(appId) {
      return ClientRegistry.get(appId);
    }
  }, {
    key: 'destroyAllClients',
    value: function destroyAllClients() {
      ClientRegistry.getAll().forEach(function (client) {
        return client.destroy();
      });
    }

    /**
     * Listen for a new Client to be registered.
     *
     * If your code needs a client, and it doesn't yet exist, you
     * can use this to get called when the client exists.
     *
     * ```
     * layer.Client.addListenerForNewClient(function(client) {
     *    mycomponent.setClient(client);
     * });
     * ```
     *
     * @method addListenerForNewClient
     * @static
     * @param {Function} listener
     * @param {layer.Client} listener.client
     */

  }, {
    key: 'addListenerForNewClient',
    value: function addListenerForNewClient(listener) {
      ClientRegistry.addListener(listener);
    }

    /**
     * Remove listener for a new Client.
     *
     *
     * ```
     * var f = function(client) {
     *    mycomponent.setClient(client);
     *    layer.Client.removeListenerForNewClient(f);
     * };
     *
     * layer.Client.addListenerForNewClient(f);
     * ```
     *
     * Calling with null will remove all listeners.
     *
     * @method removeListenerForNewClient
     * @static
     * @param {Function} listener
     */

  }, {
    key: 'removeListenerForNewClient',
    value: function removeListenerForNewClient(listener) {
      ClientRegistry.removeListener(listener);
    }
  }]);

  return Client;
}(ClientAuth);

/**
 * Array of items to be checked to see if they can be uncached.
 *
 * @private
 * @type {layer.Root[]}
 */


Client.prototype._scheduleCheckAndPurgeCacheItems = null;

/**
 * Time that the next call to _runCheckAndPurgeCache() is scheduled for in ms since 1970.
 *
 * @private
 * @type {number}
 */
Client.prototype._scheduleCheckAndPurgeCacheAt = 0;

/**
 * Set to false to disable telemetry gathering.
 *
 * No content nor identifiable information is gathered, only
 * usage and performance metrics.
 *
 * @type {Boolean}
 */
Client.prototype.telemetryEnabled = true;

/**
 * Gather usage and responsiveness statistics
 *
 * @private
 */
Client.prototype.telemetryMonitor = null;

/**
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.3.2';

/**
 * Any Conversation or Message that is part of a Query's results are kept in memory for as long as it
 * remains in that Query.  However, when a websocket event delivers new Messages and Conversations that
 * are NOT part of a Query, how long should they stick around in memory?  Why have them stick around?
 * Perhaps an app wants to post a notification of a new Message or Conversation... and wants to keep
 * the object local for a little while.  Default is 10 minutes before checking to see if
 * the object is part of a Query or can be uncached.  Value is in miliseconds.
 * @static
 * @type {number}
 */
Client.CACHE_PURGE_INTERVAL = 10 * 60 * 1000;

Client._ignoredEvents = ['conversations:loaded', 'conversations:loaded-error'];

Client._supportedEvents = [
/**
 * A Typing Indicator state has changed.
 *
 * Either a change has been received
 * from the server, or a typing indicator state has expired.
 *
 *      client.on('typing-indicator-change', function(evt) {
 *          if (evt.conversationId === myConversationId) {
 *              alert(evt.typing.join(', ') + ' are typing');
 *              alert(evt.paused.join(', ') + ' are paused');
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {string} conversationId - ID of the Conversation users are typing into
 * @param {string[]} typing - Array of user IDs who are currently typing
 * @param {string[]} paused - Array of user IDs who are currently paused;
 *                            A paused user still has text in their text box.
 */
'typing-indicator-change'].concat(ClientAuth._supportedEvents);

Client.mixins = [require('./mixins/client-queries'), require('./mixins/client-identities'), require('./mixins/client-members'), require('./mixins/client-conversations'), require('./mixins/client-channels'), require('./mixins/client-messages')];
Root.initClass.apply(Client, [Client, 'Client']);
module.exports = Client;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQuanMiXSwibmFtZXMiOlsiQ2xpZW50QXV0aCIsInJlcXVpcmUiLCJDb252ZXJzYXRpb24iLCJDaGFubmVsIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJDaGFubmVsTWVzc2FnZSIsIkFubm91bmNlbWVudCIsIklkZW50aXR5IiwiTWVtYmVyc2hpcCIsIlR5cGluZ0luZGljYXRvckxpc3RlbmVyIiwiVXRpbCIsIlJvb3QiLCJDbGllbnRSZWdpc3RyeSIsImxvZ2dlciIsIlR5cGluZ0xpc3RlbmVyIiwiVHlwaW5nUHVibGlzaGVyIiwiVGVsZW1ldHJ5TW9uaXRvciIsIkNsaWVudCIsIm9wdGlvbnMiLCJyZWdpc3RlciIsIl9tb2RlbHMiLCJfcnVuTWl4aW5zIiwiX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMiLCJfaW5pdENvbXBvbmVudHMiLCJvbiIsIl9jb25uZWN0aW9uUmVzdG9yZWQiLCJiaW5kIiwiaW5mbyIsImFzY2lpSW5pdCIsInZlcnNpb24iLCJfdHlwaW5nSW5kaWNhdG9ycyIsImNsaWVudElkIiwiYXBwSWQiLCJ0ZWxlbWV0cnlNb25pdG9yIiwiY2xpZW50IiwiZW5hYmxlZCIsInRlbGVtZXRyeUVuYWJsZWQiLCJpc0Rlc3Ryb3llZCIsIl9pbkNsZWFudXAiLCJlIiwiZXJyb3IiLCJzb2NrZXRNYW5hZ2VyIiwiY2xvc2UiLCJfY2xlYW51cCIsIl9kZXN0cm95Q29tcG9uZW50cyIsInVucmVnaXN0ZXIiLCJFcnJvciIsImFwcElkSW1tdXRhYmxlIiwiaWRlbnRpdGllcyIsIm1hcCIsImlkZW50aXR5IiwiZ2V0SWRlbnRpdHkiLCJpZCIsInVzZXJJZCIsIl9jcmVhdGVPYmplY3QiLCJjYW5Mb2FkIiwidHlwZUZyb21JRCIsImdldE1lc3NhZ2UiLCJnZXRDb252ZXJzYXRpb24iLCJnZXRDaGFubmVsIiwiZ2V0UXVlcnkiLCJnZXRNZW1iZXIiLCJvYmoiLCJpdGVtIiwiZ2V0T2JqZWN0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsImNvbnZlcnNhdGlvbiIsIl9jcmVhdGVGcm9tU2VydmVyIiwiY2hhbm5lbCIsImNvbnRhaW5lciIsIm9sZElkIiwiX3VwZGF0ZUNvbnZlcnNhdGlvbklkIiwiX3VwZGF0ZUNoYW5uZWxJZCIsImFkZENvbnZlcnNhdGlvbnMiLCJfZGVsYXllZFRyaWdnZXJzIiwiZmlsdGVyIiwiZXZ0IiwicmVtb3ZlQ29udmVyc2F0aW9ucyIsIl9mb2xkRXZlbnRzIiwiYWRkTWVzc2FnZXMiLCJyZW1vdmVNZXNzYWdlcyIsImFkZElkZW50aXRpZXMiLCJyZW1vdmVJZGVudGl0aWVzIiwiZXZlbnROYW1lIiwiX3RyaWdnZXJMb2dnZXIiLCJpbmZvRXZlbnRzIiwiaW5kZXhPZiIsImlzQ2hhbmdlIiwiY2hhbmdlcyIsImNoYW5nZSIsInByb3BlcnR5Iiwiam9pbiIsInRleHQiLCJtZXNzYWdlIiwibWVzc2FnZXMiLCJsZW5ndGgiLCJjb252ZXJzYXRpb25zIiwiY2hhbm5lbHMiLCJkZWJ1ZyIsIm9iamVjdHMiLCJfaW5DaGVja0FuZFB1cmdlQ2FjaGUiLCJmb3JFYWNoIiwiX2lzQ2FjaGVkT2JqZWN0IiwiZGVzdHJveSIsIm9iamVjdCIsImlzU2F2ZWQiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCIsIkRhdGUiLCJub3ciLCJDQUNIRV9QVVJHRV9JTlRFUlZBTCIsInNldFRpbWVvdXQiLCJfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlIiwicHVzaCIsImxpc3QiLCJfY2hlY2tBbmRQdXJnZUNhY2hlIiwiT2JqZWN0Iiwia2V5cyIsInF1ZXJpZXMiLCJpIiwicXVlcnkiLCJfZ2V0SXRlbSIsInJlc2V0IiwiZGJNYW5hZ2VyIiwiZGVsZXRlVGFibGVzIiwiX29wZW4iLCJpbnB1dE5vZGUiLCJpbnB1dCIsImNvbnZlcnNhdGlvbklkIiwiZ2V0U3RhdGUiLCJnZXQiLCJnZXRBbGwiLCJsaXN0ZW5lciIsImFkZExpc3RlbmVyIiwicmVtb3ZlTGlzdGVuZXIiLCJwcm90b3R5cGUiLCJfaWdub3JlZEV2ZW50cyIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJtaXhpbnMiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9GQSxJQUFNQSxhQUFhQyxRQUFRLHdCQUFSLENBQW5CO0FBQ0EsSUFBTUMsZUFBZUQsUUFBUSx1QkFBUixDQUFyQjtBQUNBLElBQU1FLFVBQVVGLFFBQVEsa0JBQVIsQ0FBaEI7QUFDQSxJQUFNRyxrQkFBa0JILFFBQVEsZUFBUixFQUF5QkksVUFBakQ7QUFDQSxJQUFNQyxzQkFBc0JMLFFBQVEsK0JBQVIsQ0FBNUI7QUFDQSxJQUFNTSxpQkFBaUJOLFFBQVEsMEJBQVIsQ0FBdkI7QUFDQSxJQUFNTyxlQUFlUCxRQUFRLHVCQUFSLENBQXJCO0FBQ0EsSUFBTVEsV0FBV1IsUUFBUSxtQkFBUixDQUFqQjtBQUNBLElBQU1TLGFBQWFULFFBQVEscUJBQVIsQ0FBbkI7QUFDQSxJQUFNVSwwQkFBMEJWLFFBQVEsK0NBQVIsQ0FBaEM7QUFDQSxJQUFNVyxPQUFPWCxRQUFRLGdCQUFSLENBQWI7QUFDQSxJQUFNWSxPQUFPWixRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU1hLGlCQUFpQmIsUUFBUSxtQkFBUixDQUF2QjtBQUNBLElBQU1jLFNBQVNkLFFBQVEsVUFBUixDQUFmO0FBQ0EsSUFBTWUsaUJBQWlCZixRQUFRLHFDQUFSLENBQXZCO0FBQ0EsSUFBTWdCLGtCQUFrQmhCLFFBQVEsc0NBQVIsQ0FBeEI7QUFDQSxJQUFNaUIsbUJBQW1CakIsUUFBUSxxQkFBUixDQUF6Qjs7SUFFTWtCLE07OztBQUVKOzs7O0FBSUEsa0JBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFBQSxnSEFDYkEsT0FEYTs7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SmMsRUFLZEEsUUFBUSwwQkFBUixDQUxjLEVBTWRBLFFBQVEsMEJBQVIsQ0FOYyxDQUFoQjtBQVFBWSxLQUFLZ0ksU0FBTCxDQUFlQyxLQUFmLENBQXFCM0gsTUFBckIsRUFBNkIsQ0FBQ0EsTUFBRCxFQUFTLFFBQVQsQ0FBN0I7QUFDQTRILE9BQU9DLE9BQVAsR0FBaUI3SCxNQUFqQiIsImZpbGUiOiJjbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBMYXllciBDbGllbnQ7IHRoaXMgaXMgdGhlIHRvcCBsZXZlbCBjb21wb25lbnQgZm9yIGFueSBMYXllciBiYXNlZCBhcHBsaWNhdGlvbi5cblxuICAgIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAgICAgIGFwcElkOiAnbGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZicsXG4gICAgICBjaGFsbGVuZ2U6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICBteUF1dGhlbnRpY2F0b3Ioe1xuICAgICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgICAgb25TdWNjZXNzOiBldnQuY2FsbGJhY2tcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgcmVhZHk6IGZ1bmN0aW9uKGNsaWVudCkge1xuICAgICAgICBhbGVydCgnSSBhbSBDbGllbnQ7IFNlcnZlcjogU2VydmUgbWUhJyk7XG4gICAgICB9XG4gICAgfSkuY29ubmVjdCgnRnJlZCcpXG4gKlxuICogWW91IGNhbiBhbHNvIGluaXRpYWxpemUgdGhpcyBhc1xuXG4gICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJ1xuICAgIH0pO1xuXG4gICAgY2xpZW50Lm9uKCdjaGFsbGVuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgIG5vbmNlOiBldnQubm9uY2UsXG4gICAgICAgIG9uU3VjY2VzczogZXZ0LmNhbGxiYWNrXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNsaWVudC5vbigncmVhZHknLCBmdW5jdGlvbihjbGllbnQpIHtcbiAgICAgIGFsZXJ0KCdJIGFtIENsaWVudDsgU2VydmVyOiBTZXJ2ZSBtZSEnKTtcbiAgICB9KTtcblxuICAgIGNsaWVudC5jb25uZWN0KCdGcmVkJyk7XG4gKlxuICogIyMgQVBJIFN5bm9wc2lzOlxuICpcbiAqIFRoZSBmb2xsb3dpbmcgUHJvcGVydGllcywgTWV0aG9kcyBhbmQgRXZlbnRzIGFyZSB0aGUgbW9zdCBjb21tb25seSB1c2VkIG9uZXMuICBTZWUgdGhlIGZ1bGwgQVBJIGJlbG93XG4gKiBmb3IgdGhlIHJlc3Qgb2YgdGhlIEFQSS5cbiAqXG4gKiAjIyMgUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLkNsaWVudC51c2VySWQ6IFVzZXIgSUQgb2YgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlclxuICogKiBsYXllci5DbGllbnQuYXBwSWQ6IFRoZSBJRCBmb3IgeW91ciBhcHBsaWNhdGlvblxuICpcbiAqXG4gKiAjIyMgTWV0aG9kczpcbiAqXG4gKiAqIGxheWVyLkNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oKTogQ3JlYXRlIGEgbmV3IGxheWVyLkNvbnZlcnNhdGlvbi5cbiAqICogbGF5ZXIuQ2xpZW50LmNyZWF0ZVF1ZXJ5KCk6IENyZWF0ZSBhIG5ldyBsYXllci5RdWVyeS5cbiAqICogbGF5ZXIuQ2xpZW50LmdldE1lc3NhZ2UoKTogSW5wdXQgYSBNZXNzYWdlIElELCBhbmQgb3V0cHV0IGEgbGF5ZXIuTWVzc2FnZSBvciBsYXllci5Bbm5vdW5jZW1lbnQgZnJvbSBjYWNoZS5cbiAqICogbGF5ZXIuQ2xpZW50LmdldENvbnZlcnNhdGlvbigpOiBJbnB1dCBhIENvbnZlcnNhdGlvbiBJRCwgYW5kIG91dHB1dCBhIGxheWVyLkNvbnZlcnNhdGlvbiBmcm9tIGNhY2hlLlxuICogKiBsYXllci5DbGllbnQub24oKSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLm9mZigpOiBldmVudCBsaXN0ZW5lcnNcbiAqICogbGF5ZXIuQ2xpZW50LmRlc3Ryb3koKTogQ2xlYW51cCBhbGwgcmVzb3VyY2VzIHVzZWQgYnkgdGhpcyBjbGllbnQsIGluY2x1ZGluZyBhbGwgTWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbnMuXG4gKlxuICogIyMjIEV2ZW50czpcbiAqXG4gKiAqIGBjaGFsbGVuZ2VgOiBQcm92aWRlcyBhIG5vbmNlIGFuZCBhIGNhbGxiYWNrOyB5b3UgY2FsbCB0aGUgY2FsbGJhY2sgb25jZSB5b3UgaGF2ZSBhbiBJZGVudGl0eSBUb2tlbi5cbiAqICogYHJlYWR5YDogWW91ciBhcHBsaWNhdGlvbiBjYW4gbm93IHN0YXJ0IHVzaW5nIHRoZSBMYXllciBzZXJ2aWNlc1xuICogKiBgbWVzc2FnZXM6bm90aWZ5YDogVXNlZCB0byBub3RpZnkgeW91ciBhcHBsaWNhdGlvbiBvZiBuZXcgbWVzc2FnZXMgZm9yIHdoaWNoIGEgbG9jYWwgbm90aWZpY2F0aW9uIG1heSBiZSBzdWl0YWJsZS5cbiAqXG4gKiAjIyBMb2dnaW5nOlxuICpcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyB0byBjaGFuZ2UgdGhlIGxvZyBsZXZlbCBmb3IgTGF5ZXIncyBsb2dnZXI6XG4gKlxuICogICAgIGxheWVyLkNsaWVudC5wcm90b3R5cGUubG9nTGV2ZWwgPSBsYXllci5Db25zdGFudHMuTE9HLklORk87XG4gKlxuICogb3JcbiAqXG4gKiAgICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICogICAgICAgIGFwcElkOiAnbGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZicsXG4gKiAgICAgICAgbG9nTGV2ZWw6IGxheWVyLkNvbnN0YW50cy5MT0cuSU5GT1xuICogICAgIH0pO1xuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ2xpZW50XG4gKiBAZXh0ZW5kcyBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yXG4gKiBAbWl4aW4gbGF5ZXIubWl4aW5zLkNsaWVudElkZW50aXRpZXNcbiAqIC8vQCBtaXhpbiBsYXllci5taXhpbnMuQ2xpZW50TWVtYmVyc2hpcFxuICogQG1peGluIGxheWVyLm1peGlucy5DbGllbnRDb252ZXJzYXRpb25zXG4gKiAvL0AgbWl4aW4gbGF5ZXIubWl4aW5zLkNsaWVudENoYW5uZWxzXG4gKiBAbWl4aW4gbGF5ZXIubWl4aW5zLkNsaWVudE1lc3NhZ2VzXG4gKiBAbWl4aW4gbGF5ZXIubWl4aW5zLkNsaWVudFF1ZXJpZXNcbiAqL1xuXG5jb25zdCBDbGllbnRBdXRoID0gcmVxdWlyZSgnLi9jbGllbnQtYXV0aGVudGljYXRvcicpO1xuY29uc3QgQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9tb2RlbHMvY29udmVyc2F0aW9uJyk7XG5jb25zdCBDaGFubmVsID0gcmVxdWlyZSgnLi9tb2RlbHMvY2hhbm5lbCcpO1xuY29uc3QgRXJyb3JEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpLmRpY3Rpb25hcnk7XG5jb25zdCBDb252ZXJzYXRpb25NZXNzYWdlID0gcmVxdWlyZSgnLi9tb2RlbHMvY29udmVyc2F0aW9uLW1lc3NhZ2UnKTtcbmNvbnN0IENoYW5uZWxNZXNzYWdlID0gcmVxdWlyZSgnLi9tb2RlbHMvY2hhbm5lbC1tZXNzYWdlJyk7XG5jb25zdCBBbm5vdW5jZW1lbnQgPSByZXF1aXJlKCcuL21vZGVscy9hbm5vdW5jZW1lbnQnKTtcbmNvbnN0IElkZW50aXR5ID0gcmVxdWlyZSgnLi9tb2RlbHMvaWRlbnRpdHknKTtcbmNvbnN0IE1lbWJlcnNoaXAgPSByZXF1aXJlKCcuL21vZGVscy9tZW1iZXJzaGlwJyk7XG5jb25zdCBUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lciA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMvdHlwaW5nLWluZGljYXRvci1saXN0ZW5lcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY29uc3QgVHlwaW5nTGlzdGVuZXIgPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzL3R5cGluZy1saXN0ZW5lcicpO1xuY29uc3QgVHlwaW5nUHVibGlzaGVyID0gcmVxdWlyZSgnLi90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctcHVibGlzaGVyJyk7XG5jb25zdCBUZWxlbWV0cnlNb25pdG9yID0gcmVxdWlyZSgnLi90ZWxlbWV0cnktbW9uaXRvcicpO1xuXG5jbGFzcyBDbGllbnQgZXh0ZW5kcyBDbGllbnRBdXRoIHtcblxuICAvKlxuICAgKiBBZGRzIGNvbnZlcnNhdGlvbnMsIG1lc3NhZ2VzIGFuZCB3ZWJzb2NrZXRzIG9uIHRvcCBvZiB0aGUgYXV0aGVudGljYXRpb24gY2xpZW50LlxuICAgKiBqc2RvY3Mgb24gcGFyZW50IGNsYXNzIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIENsaWVudFJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICAgIHRoaXMuX21vZGVscyA9IHt9O1xuICAgIHRoaXMuX3J1bk1peGlucygnY29uc3RydWN0b3InLCBbb3B0aW9uc10pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBQcm9wZXJ0aWVzXG4gICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyA9IFtdO1xuXG4gICAgdGhpcy5faW5pdENvbXBvbmVudHMoKTtcblxuICAgIHRoaXMub24oJ29ubGluZScsIHRoaXMuX2Nvbm5lY3Rpb25SZXN0b3JlZC5iaW5kKHRoaXMpKTtcblxuICAgIGxvZ2dlci5pbmZvKFV0aWwuYXNjaWlJbml0KENsaWVudC52ZXJzaW9uKSk7XG4gIH1cblxuICAvKiBTZWUgcGFyZW50IG1ldGhvZCBkb2NzICovXG4gIF9pbml0Q29tcG9uZW50cygpIHtcbiAgICBzdXBlci5faW5pdENvbXBvbmVudHMoKTtcblxuICAgIHRoaXMuX3R5cGluZ0luZGljYXRvcnMgPSBuZXcgVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIoe1xuICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgfSk7XG4gICAgdGhpcy50ZWxlbWV0cnlNb25pdG9yID0gbmV3IFRlbGVtZXRyeU1vbml0b3Ioe1xuICAgICAgY2xpZW50OiB0aGlzLFxuICAgICAgZW5hYmxlZDogdGhpcy50ZWxlbWV0cnlFbmFibGVkLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAgYWxsIHJlc291cmNlcyAoQ29udmVyc2F0aW9ucywgTWVzc2FnZXMsIGV0Yy4uLikgcHJpb3IgdG8gZGVzdHJveSBvciByZWF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGVhbnVwXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYW51cCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIHRoaXMuX2luQ2xlYW51cCA9IHRydWU7XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5fcnVuTWl4aW5zKCdjbGVhbnVwJywgW10pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zb2NrZXRNYW5hZ2VyKSB0aGlzLnNvY2tldE1hbmFnZXIuY2xvc2UoKTtcbiAgICB0aGlzLl9pbkNsZWFudXAgPSBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gQ2xlYW51cCBhbGwgcmVzb3VyY2VzIChDb252ZXJzYXRpb25zLCBNZXNzYWdlcywgZXRjLi4uKVxuICAgIHRoaXMuX2NsZWFudXAoKTtcblxuICAgIHRoaXMuX2Rlc3Ryb3lDb21wb25lbnRzKCk7XG5cbiAgICBDbGllbnRSZWdpc3RyeS51bnJlZ2lzdGVyKHRoaXMpO1xuXG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuX2luQ2xlYW51cCA9IGZhbHNlO1xuICB9XG5cbiAgX19hZGp1c3RBcHBJZCgpIHtcbiAgICBpZiAodGhpcy5hcHBJZCkgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5hcHBJZEltbXV0YWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogVGFrZXMgYW4gYXJyYXkgb2YgSWRlbnRpdHkgaW5zdGFuY2VzLCBVc2VyIElEcywgSWRlbnRpdHkgSURzLCBJZGVudGl0eSBvYmplY3RzLFxuICAgKiBvciBTZXJ2ZXIgZm9ybWF0dGVkIElkZW50aXR5IE9iamVjdHMgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgSWRlbnRpdHkgaW5zdGFuY2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9maXhJZGVudGl0aWVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TWl4ZWRbXX0gaWRlbnRpdGllcyAtIFNvbWV0aGluZyB0aGF0IHRlbGxzIHVzIHdoYXQgSWRlbnRpdHkgdG8gcmV0dXJuXG4gICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5W119XG4gICAqL1xuICBfZml4SWRlbnRpdGllcyhpZGVudGl0aWVzKSB7XG4gICAgcmV0dXJuIGlkZW50aXRpZXMubWFwKChpZGVudGl0eSkgPT4ge1xuICAgICAgaWYgKGlkZW50aXR5IGluc3RhbmNlb2YgSWRlbnRpdHkpIHJldHVybiBpZGVudGl0eTtcbiAgICAgIGlmICh0eXBlb2YgaWRlbnRpdHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldElkZW50aXR5KGlkZW50aXR5LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAoaWRlbnRpdHkgJiYgdHlwZW9mIGlkZW50aXR5ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoJ3VzZXJJZCcgaW4gaWRlbnRpdHkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRJZGVudGl0eShpZGVudGl0eS5pZCB8fCBpZGVudGl0eS51c2VySWQpO1xuICAgICAgICB9IGVsc2UgaWYgKCd1c2VyX2lkJyBpbiBpZGVudGl0eSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9jcmVhdGVPYmplY3QoaWRlbnRpdHkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFRha2VzIGFzIGlucHV0IGFuIG9iamVjdCBpZCwgYW5kIGVpdGhlciBjYWxscyBnZXRDb252ZXJzYXRpb24oKSBvciBnZXRNZXNzYWdlKCkgYXMgbmVlZGVkLlxuICAgKlxuICAgKiBXaWxsIG9ubHkgZ2V0IGNhY2hlZCBvYmplY3RzLCB3aWxsIG5vdCBnZXQgb2JqZWN0cyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IGEgcHVibGljIG1ldGhvZCBtb3N0bHkgc28gdGhlcmUncyBubyBhbWJpZ3VpdHkgb3ZlciB1c2luZyBnZXRYWFhcbiAgICogb3IgZ2V0T2JqZWN0LiAgZ2V0WFhYIHR5cGljYWxseSBoYXMgYW4gb3B0aW9uIHRvIGxvYWQgdGhlIHJlc291cmNlLCB3aGljaCB0aGlzXG4gICAqIGRvZXMgbm90LlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE9iamVjdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gTWVzc2FnZSwgQ29udmVyc2F0aW9uIG9yIFF1ZXJ5IGlkXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgb2JqZWN0IGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIHNlcnZlciBpZiBub3QgZm91bmQgKG5vdCBzdXBwb3J0ZWQgZm9yIGFsbCBvYmplY3RzKVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfGxheWVyLkNvbnZlcnNhdGlvbnxsYXllci5RdWVyeX1cbiAgICovXG4gIGdldE9iamVjdChpZCwgY2FuTG9hZCA9IGZhbHNlKSB7XG4gICAgc3dpdGNoIChVdGlsLnR5cGVGcm9tSUQoaWQpKSB7XG4gICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0TWVzc2FnZShpZCwgY2FuTG9hZCk7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udmVyc2F0aW9uKGlkLCBjYW5Mb2FkKTtcbiAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q2hhbm5lbChpZCwgY2FuTG9hZCk7XG4gICAgICBjYXNlICdxdWVyaWVzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoaWQpO1xuICAgICAgY2FzZSAnaWRlbnRpdGllcyc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldElkZW50aXR5KGlkLCBjYW5Mb2FkKTtcbiAgICAgIGNhc2UgJ21lbWJlcnMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRNZW1iZXIoaWQsIGNhbkxvYWQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFRha2VzIGFuIG9iamVjdCBkZXNjcmlwdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGVpdGhlciB1cGRhdGVzIGl0IChpZiBjYWNoZWQpXG4gICAqIG9yIGNyZWF0ZXMgYW5kIGNhY2hlcyBpdCAuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZU9iamVjdFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2JqIC0gUGxhaW4gamF2YXNjcmlwdCBvYmplY3QgcmVwcmVzZW50aW5nIGEgTWVzc2FnZSBvciBDb252ZXJzYXRpb25cbiAgICovXG4gIF9jcmVhdGVPYmplY3Qob2JqKSB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuZ2V0T2JqZWN0KG9iai5pZCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGl0ZW0uX3BvcHVsYXRlRnJvbVNlcnZlcihvYmopO1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoVXRpbC50eXBlRnJvbUlEKG9iai5pZCkpIHtcbiAgICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAgIGlmIChvYmouY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uTWVzc2FnZS5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICAgIH0gZWxzZSBpZiAob2JqLmNoYW5uZWwpIHtcbiAgICAgICAgICAgIHJldHVybiBDaGFubmVsTWVzc2FnZS5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYW5ub3VuY2VtZW50cyc6XG4gICAgICAgICAgcmV0dXJuIEFubm91bmNlbWVudC5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uLl9jcmVhdGVGcm9tU2VydmVyKG9iaiwgdGhpcyk7XG4gICAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgICByZXR1cm4gQ2hhbm5lbC5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdpZGVudGl0aWVzJzpcbiAgICAgICAgICByZXR1cm4gSWRlbnRpdHkuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgICAgY2FzZSAnbWVtYmVycyc6XG4gICAgICAgICAgcmV0dXJuIE1lbWJlcnNoaXAuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogV2hlbiBhIGxheWVyLkNvbnRhaW5lcidzIElEIGNoYW5nZXMsIHdlIG5lZWQgdG8gdXBkYXRlXG4gICAqIGEgdmFyaWV0eSBvZiB0aGluZ3MgYW5kIHRyaWdnZXIgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVDb250YWluZXJJZFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnRhaW5lcn0gY29udGFpbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvbGRJZFxuICAgKi9cbiAgX3VwZGF0ZUNvbnRhaW5lcklkKGNvbnRhaW5lciwgb2xkSWQpIHtcbiAgICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uKSB7XG4gICAgICB0aGlzLl91cGRhdGVDb252ZXJzYXRpb25JZChjb250YWluZXIsIG9sZElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdXBkYXRlQ2hhbm5lbElkKGNvbnRhaW5lciwgb2xkSWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZSBldmVudHMgaW50byBzbWFsbGVyIG51bWJlcnMgb2YgbW9yZSBjb21wbGV0ZSBldmVudHMuXG4gICAqXG4gICAqIEJlZm9yZSBhbnkgZGVsYXllZCB0cmlnZ2VycyBhcmUgZmlyZWQsIGZvbGQgdG9nZXRoZXIgYWxsIG9mIHRoZSBjb252ZXJzYXRpb25zOmFkZFxuICAgKiBhbmQgY29udmVyc2F0aW9uczpyZW1vdmUgZXZlbnRzIHNvIHRoYXQgMTAwIGNvbnZlcnNhdGlvbnM6YWRkIGV2ZW50cyBjYW4gYmUgZmlyZWQgYXNcbiAgICogYSBzaW5nbGUgZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG5cbiAgICBjb25zdCBhZGRDb252ZXJzYXRpb25zID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVDb252ZXJzYXRpb25zID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczpyZW1vdmUnKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKGFkZENvbnZlcnNhdGlvbnMsICdjb252ZXJzYXRpb25zJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVDb252ZXJzYXRpb25zLCAnY29udmVyc2F0aW9ucycsIHRoaXMpO1xuXG4gICAgY29uc3QgYWRkTWVzc2FnZXMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKGV2dCA9PiBldnRbMF0gPT09ICdtZXNzYWdlczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVNZXNzYWdlcyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoZXZ0ID0+IGV2dFswXSA9PT0gJ21lc3NhZ2VzOnJlbW92ZScpO1xuXG4gICAgdGhpcy5fZm9sZEV2ZW50cyhhZGRNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG5cbiAgICBjb25zdCBhZGRJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnaWRlbnRpdGllczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnaWRlbnRpdGllczpyZW1vdmUnKTtcblxuICAgIHRoaXMuX2ZvbGRFdmVudHMoYWRkSWRlbnRpdGllcywgJ2lkZW50aXRpZXMnLCB0aGlzKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKHJlbW92ZUlkZW50aXRpZXMsICdpZGVudGl0aWVzJywgdGhpcyk7XG5cbiAgICBzdXBlci5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycygpO1xuICB9XG5cbiAgdHJpZ2dlcihldmVudE5hbWUsIGV2dCkge1xuICAgIHRoaXMuX3RyaWdnZXJMb2dnZXIoZXZlbnROYW1lLCBldnQpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZlbnROYW1lLCBldnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvZXMgbG9nZ2luZyBvbiBhbGwgdHJpZ2dlcmVkIGV2ZW50cy5cbiAgICpcbiAgICogQWxsIGxvZ2dpbmcgaXMgZG9uZSBhdCBgZGVidWdgIG9yIGBpbmZvYCBsZXZlbHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3RyaWdnZXJMb2dnZXJcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF90cmlnZ2VyTG9nZ2VyKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgaW5mb0V2ZW50cyA9IFtcbiAgICAgICdjb252ZXJzYXRpb25zOmFkZCcsICdjb252ZXJzYXRpb25zOnJlbW92ZScsICdjb252ZXJzYXRpb25zOmNoYW5nZScsXG4gICAgICAnbWVzc2FnZXM6YWRkJywgJ21lc3NhZ2VzOnJlbW92ZScsICdtZXNzYWdlczpjaGFuZ2UnLFxuICAgICAgJ2lkZW50aXRpZXM6YWRkJywgJ2lkZW50aXRpZXM6cmVtb3ZlJywgJ2lkZW50aXRpZXM6Y2hhbmdlJyxcbiAgICAgICdjaGFsbGVuZ2UnLCAncmVhZHknLFxuICAgIF07XG4gICAgaWYgKGluZm9FdmVudHMuaW5kZXhPZihldmVudE5hbWUpICE9PSAtMSkge1xuICAgICAgaWYgKGV2dCAmJiBldnQuaXNDaGFuZ2UpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oYENsaWVudCBFdmVudDogJHtldmVudE5hbWV9ICR7ZXZ0LmNoYW5nZXMubWFwKGNoYW5nZSA9PiBjaGFuZ2UucHJvcGVydHkpLmpvaW4oJywgJyl9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGV4dCA9ICcnO1xuICAgICAgICBpZiAoZXZ0KSB7XG4gICAgICAgICAgLy8gSWYgdGhlIHRyaWdnZXJlZCBldmVudCBoYXMgdGhlc2UgbWVzc2FnZXMsIHVzZSBhIHNpbXBsZXIgd2F5IG9mIHJlbmRlcmluZyBpbmZvIGFib3V0IHRoZW1cbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2UpIHRleHQgPSBldnQubWVzc2FnZS5pZDtcbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2VzKSB0ZXh0ID0gZXZ0Lm1lc3NhZ2VzLmxlbmd0aCArICcgbWVzc2FnZXMnO1xuICAgICAgICAgIGlmIChldnQuY29udmVyc2F0aW9uKSB0ZXh0ID0gZXZ0LmNvbnZlcnNhdGlvbi5pZDtcbiAgICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbnMpIHRleHQgPSBldnQuY29udmVyc2F0aW9ucy5sZW5ndGggKyAnIGNvbnZlcnNhdGlvbnMnO1xuICAgICAgICAgIGlmIChldnQuY2hhbm5lbCkgdGV4dCA9IGV2dC5jaGFubmVsLmlkO1xuICAgICAgICAgIGlmIChldnQuY2hhbm5lbHMpIHRleHQgPSBldnQuY2hhbm5lbHMubGVuZ3RoICsgJyBjaGFubmVscyc7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmluZm8oYENsaWVudCBFdmVudDogJHtldmVudE5hbWV9ICR7dGV4dH1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChldnQpIGxvZ2dlci5kZWJ1ZyhldnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZGVidWcoZXZlbnROYW1lLCBldnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgc2Vzc2lvbiBoYXMgYmVlbiByZXNldCwgZHVtcCBhbGwgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzZXRTZXNzaW9uKCkge1xuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLl9ydW5NaXhpbnMoJ3Jlc2V0JywgW10pO1xuICAgIHJldHVybiBzdXBlci5fcmVzZXRTZXNzaW9uKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDaGVjayB0byBzZWUgaWYgdGhlIHNwZWNpZmllZCBvYmplY3RzIGNhbiBzYWZlbHkgYmUgcmVtb3ZlZCBmcm9tIGNhY2hlLlxuICAgKlxuICAgKiBSZW1vdmVzIGZyb20gY2FjaGUgaWYgYW4gb2JqZWN0IGlzIG5vdCBwYXJ0IG9mIGFueSBRdWVyeSdzIHJlc3VsdCBzZXQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NoZWNrQW5kUHVyZ2VDYWNoZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290W119IG9iamVjdHMgLSBBcnJheSBvZiBNZXNzYWdlcyBvciBDb252ZXJzYXRpb25zXG4gICAqL1xuICBfY2hlY2tBbmRQdXJnZUNhY2hlKG9iamVjdHMpIHtcbiAgICB0aGlzLl9pbkNoZWNrQW5kUHVyZ2VDYWNoZSA9IHRydWU7XG4gICAgb2JqZWN0cy5mb3JFYWNoKChvYmopID0+IHtcbiAgICAgIGlmICghb2JqLmlzRGVzdHJveWVkICYmICF0aGlzLl9pc0NhY2hlZE9iamVjdChvYmopKSB7XG4gICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBSb290ID09PSBmYWxzZSkgb2JqID0gdGhpcy5nZXRPYmplY3Qob2JqLmlkKTtcbiAgICAgICAgaWYgKG9iaikgb2JqLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9pbkNoZWNrQW5kUHVyZ2VDYWNoZSA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlcyBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlIGlmIG5lZWRlZCwgYW5kIGFkZHMgdGhpcyBvYmplY3RcbiAgICogdG8gdGhlIGxpc3Qgb2Ygb2JqZWN0cyBpdCB3aWxsIHZhbGlkYXRlIGZvciB1bmNhY2hpbmcuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBhbnkgb2JqZWN0IHRoYXQgZG9lcyBub3QgZXhpc3Qgb24gdGhlIHNlcnZlciAoIWlzU2F2ZWQoKSkgaXMgYW4gb2JqZWN0IHRoYXQgdGhlXG4gICAqIGFwcCBjcmVhdGVkIGFuZCBjYW4gb25seSBiZSBwdXJnZWQgYnkgdGhlIGFwcCBhbmQgbm90IGJ5IHRoZSBTREsuICBPbmNlIGl0cyBiZWVuXG4gICAqIHNhdmVkLCBhbmQgY2FuIGJlIHJlbG9hZGVkIGZyb20gdGhlIHNlcnZlciB3aGVuIG5lZWRlZCwgaXRzIHN1YmplY3QgdG8gc3RhbmRhcmQgY2FjaGluZy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Sb290fSBvYmplY3RcbiAgICovXG4gIF9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0LmlzU2F2ZWQoKSkge1xuICAgICAgaWYgKHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPCBEYXRlLm5vdygpKSB7XG4gICAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPSBEYXRlLm5vdygpICsgQ2xpZW50LkNBQ0hFX1BVUkdFX0lOVEVSVkFMO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3J1blNjaGVkdWxlZENoZWNrQW5kUHVyZ2VDYWNoZSgpLCBDbGllbnQuQ0FDSEVfUFVSR0VfSU5URVJWQUwpO1xuICAgICAgfVxuICAgICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcy5wdXNoKG9iamVjdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxzIF9jaGVja0FuZFB1cmdlQ2FjaGUgb24gYWNjdW11bGF0ZWQgb2JqZWN0cyBhbmQgcmVzZXRzIGl0cyBzdGF0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlKCkge1xuICAgIGNvbnN0IGxpc3QgPSB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUl0ZW1zO1xuICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMgPSBbXTtcbiAgICB0aGlzLl9jaGVja0FuZFB1cmdlQ2FjaGUobGlzdCk7XG4gICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgb2JqZWN0IHNob3VsZCBjb250aW51ZSB0byBiZSBwYXJ0IG9mIHRoZSBjYWNoZS5cbiAgICpcbiAgICogUmVzdWx0IGlzIGJhc2VkIG9uIHdoZXRoZXIgdGhlIG9iamVjdCBpcyBwYXJ0IG9mIHRoZSBkYXRhIGZvciBhIFF1ZXJ5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9pc0NhY2hlZE9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290fSBvYmogLSBBIE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uIEluc3RhbmNlXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBfaXNDYWNoZWRPYmplY3Qob2JqKSB7XG4gICAgY29uc3QgbGlzdCA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5xdWVyaWVzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5fbW9kZWxzLnF1ZXJpZXNbbGlzdFtpXV07XG4gICAgICBpZiAocXVlcnkuX2dldEl0ZW0ob2JqLmlkKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPbiByZXN0b3JpbmcgYSBjb25uZWN0aW9uLCBkZXRlcm1pbmUgd2hhdCBzdGVwcyBuZWVkIHRvIGJlIHRha2VuIHRvIHVwZGF0ZSBvdXIgZGF0YS5cbiAgICpcbiAgICogQSByZXNldCBib29sZWFuIHByb3BlcnR5IGlzIHBhc3NlZDsgc2V0IGJhc2VkIG9uICBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yLlJlc2V0QWZ0ZXJPZmZsaW5lRHVyYXRpb24uXG4gICAqXG4gICAqIE5vdGUgaXQgaXMgcG9zc2libGUgZm9yIGFuIGFwcGxpY2F0aW9uIHRvIGhhdmUgbG9naWMgdGhhdCBjYXVzZXMgcXVlcmllcyB0byBiZSBjcmVhdGVkL2Rlc3Ryb3llZFxuICAgKiBhcyBhIHNpZGUtZWZmZWN0IG9mIGxheWVyLlF1ZXJ5LnJlc2V0IGRlc3Ryb3lpbmcgYWxsIGRhdGEuIFNvIHdlIG11c3QgdGVzdCB0byBzZWUgaWYgcXVlcmllcyBleGlzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvblJlc3RvcmVkXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzZXQgLSBTaG91bGQgdGhlIHNlc3Npb24gcmVzZXQvcmVsb2FkIGFsbCBkYXRhIG9yIGF0dGVtcHQgdG8gcmVzdW1lIHdoZXJlIGl0IGxlZnQgb2ZmP1xuICAgKi9cbiAgX2Nvbm5lY3Rpb25SZXN0b3JlZChldnQpIHtcbiAgICBpZiAoZXZ0LnJlc2V0KSB7XG4gICAgICBsb2dnZXIuZGVidWcoJ0NsaWVudCBDb25uZWN0aW9uIFJlc3RvcmVkOyBSZXNldHRpbmcgYWxsIFF1ZXJpZXMnKTtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyLmRlbGV0ZVRhYmxlcygoKSA9PiB7XG4gICAgICAgIHRoaXMuZGJNYW5hZ2VyLl9vcGVuKCk7XG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5xdWVyaWVzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5fbW9kZWxzLnF1ZXJpZXNbaWRdO1xuICAgICAgICAgIGlmIChxdWVyeSkgcXVlcnkucmVzZXQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nTGlzdGVuZXIgaW5zdGFuY2VcbiAgICogYm91bmQgdG8gdGhlIHNwZWNpZmllZCBkb20gbm9kZS5cbiAgICpcbiAgICogICAgICB2YXIgdHlwaW5nTGlzdGVuZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nTGlzdGVuZXIoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215VGV4dEJveCcpKTtcbiAgICogICAgICB0eXBpbmdMaXN0ZW5lci5zZXRDb252ZXJzYXRpb24obXlTZWxlY3RlZENvbnZlcnNhdGlvbik7XG4gICAqXG4gICAqIFVzZSB0aGlzIG1ldGhvZCB0byBpbnN0YW50aWF0ZSBhIGxpc3RlbmVyLCBhbmQgY2FsbFxuICAgKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nTGlzdGVuZXJcbiAgICogQHBhcmFtICB7SFRNTEVsZW1lbnR9IGlucHV0Tm9kZSAtIFRleHQgaW5wdXQgdG8gd2F0Y2ggZm9yIGtleXN0cm9rZXNcbiAgICogQHJldHVybiB7bGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lcn1cbiAgICovXG4gIGNyZWF0ZVR5cGluZ0xpc3RlbmVyKGlucHV0Tm9kZSkge1xuICAgIHJldHVybiBuZXcgVHlwaW5nTGlzdGVuZXIoe1xuICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICBpbnB1dDogaW5wdXROb2RlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5cbiAgICpcbiAgICogVGhlIFR5cGluZ1B1Ymxpc2hlciBsZXRzIHlvdSBtYW5hZ2UgeW91ciBUeXBpbmcgSW5kaWNhdG9ycyB3aXRob3V0IHVzaW5nXG4gICAqIHRoZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLlxuICAgKlxuICAgKiAgICAgIHZhciB0eXBpbmdQdWJsaXNoZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyKCk7XG4gICAqICAgICAgdHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbihteVNlbGVjdGVkQ29udmVyc2F0aW9uKTtcbiAgICogICAgICB0eXBpbmdQdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtcbiAgICpcbiAgICogVXNlIHRoaXMgbWV0aG9kIHRvIGluc3RhbnRpYXRlIGEgbGlzdGVuZXIsIGFuZCBjYWxsXG4gICAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIFVzZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5zZXRTdGF0ZSB0byBpbmZvcm0gb3RoZXIgdXNlcnMgb2YgeW91ciBjdXJyZW50IHN0YXRlLlxuICAgKiBOb3RlIHRoYXQgdGhlIGBTVEFSVEVEYCBzdGF0ZSBvbmx5IGxhc3RzIGZvciAyLjUgc2Vjb25kcywgc28geW91XG4gICAqIG11c3QgcmVwZWF0ZWRseSBjYWxsIHNldFN0YXRlIGZvciBhcyBsb25nIGFzIHRoaXMgc3RhdGUgc2hvdWxkIGNvbnRpbnVlLlxuICAgKiBUaGlzIGlzIHR5cGljYWxseSBkb25lIGJ5IHNpbXBseSBjYWxsaW5nIGl0IGV2ZXJ5IHRpbWUgYSB1c2VyIGhpdHNcbiAgICogYSBrZXkuXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nUHVibGlzaGVyXG4gICAqIEByZXR1cm4ge2xheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyfVxuICAgKi9cbiAgY3JlYXRlVHlwaW5nUHVibGlzaGVyKCkge1xuICAgIHJldHVybiBuZXcgVHlwaW5nUHVibGlzaGVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIG9mIGEgc3BlY2lmaWVkIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogVHlwaWNhbGx5IHVzZWQgdG8gc2VlIGlmIGFueW9uZSBpcyBjdXJyZW50bHkgdHlwaW5nIHdoZW4gZmlyc3Qgb3BlbmluZyBhIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUeXBpbmdTdGF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29udmVyc2F0aW9uSWRcbiAgICovXG4gIGdldFR5cGluZ1N0YXRlKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3R5cGluZ0luZGljYXRvcnMuZ2V0U3RhdGUoY29udmVyc2F0aW9uSWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc29yIGZvciBnZXR0aW5nIGEgQ2xpZW50IGJ5IGFwcElkLlxuICAgKlxuICAgKiBNb3N0IGFwcHMgd2lsbCBvbmx5IGhhdmUgb25lIGNsaWVudCxcbiAgICogYW5kIHdpbGwgbm90IG5lZWQgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q2xpZW50XG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBhcHBJZFxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBzdGF0aWMgZ2V0Q2xpZW50KGFwcElkKSB7XG4gICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldChhcHBJZCk7XG4gIH1cblxuICBzdGF0aWMgZGVzdHJveUFsbENsaWVudHMoKSB7XG4gICAgQ2xpZW50UmVnaXN0cnkuZ2V0QWxsKCkuZm9yRWFjaChjbGllbnQgPT4gY2xpZW50LmRlc3Ryb3koKSk7XG4gIH1cblxuICAvKipcbiAgICogTGlzdGVuIGZvciBhIG5ldyBDbGllbnQgdG8gYmUgcmVnaXN0ZXJlZC5cbiAgICpcbiAgICogSWYgeW91ciBjb2RlIG5lZWRzIGEgY2xpZW50LCBhbmQgaXQgZG9lc24ndCB5ZXQgZXhpc3QsIHlvdVxuICAgKiBjYW4gdXNlIHRoaXMgdG8gZ2V0IGNhbGxlZCB3aGVuIHRoZSBjbGllbnQgZXhpc3RzLlxuICAgKlxuICAgKiBgYGBcbiAgICogbGF5ZXIuQ2xpZW50LmFkZExpc3RlbmVyRm9yTmV3Q2xpZW50KGZ1bmN0aW9uKGNsaWVudCkge1xuICAgKiAgICBteWNvbXBvbmVudC5zZXRDbGllbnQoY2xpZW50KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGFkZExpc3RlbmVyRm9yTmV3Q2xpZW50XG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGxpc3RlbmVyLmNsaWVudFxuICAgKi9cbiAgc3RhdGljIGFkZExpc3RlbmVyRm9yTmV3Q2xpZW50KGxpc3RlbmVyKSB7XG4gICAgQ2xpZW50UmVnaXN0cnkuYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBsaXN0ZW5lciBmb3IgYSBuZXcgQ2xpZW50LlxuICAgKlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIGYgPSBmdW5jdGlvbihjbGllbnQpIHtcbiAgICogICAgbXljb21wb25lbnQuc2V0Q2xpZW50KGNsaWVudCk7XG4gICAqICAgIGxheWVyLkNsaWVudC5yZW1vdmVMaXN0ZW5lckZvck5ld0NsaWVudChmKTtcbiAgICogfTtcbiAgICpcbiAgICogbGF5ZXIuQ2xpZW50LmFkZExpc3RlbmVyRm9yTmV3Q2xpZW50KGYpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQ2FsbGluZyB3aXRoIG51bGwgd2lsbCByZW1vdmUgYWxsIGxpc3RlbmVycy5cbiAgICpcbiAgICogQG1ldGhvZCByZW1vdmVMaXN0ZW5lckZvck5ld0NsaWVudFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAqL1xuICBzdGF0aWMgcmVtb3ZlTGlzdGVuZXJGb3JOZXdDbGllbnQobGlzdGVuZXIpIHtcbiAgICBDbGllbnRSZWdpc3RyeS5yZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gIH1cbn1cblxuLyoqXG4gKiBBcnJheSBvZiBpdGVtcyB0byBiZSBjaGVja2VkIHRvIHNlZSBpZiB0aGV5IGNhbiBiZSB1bmNhY2hlZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge2xheWVyLlJvb3RbXX1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBuZXh0IGNhbGwgdG8gX3J1bkNoZWNrQW5kUHVyZ2VDYWNoZSgpIGlzIHNjaGVkdWxlZCBmb3IgaW4gbXMgc2luY2UgMTk3MC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA9IDA7XG5cblxuLyoqXG4gKiBTZXQgdG8gZmFsc2UgdG8gZGlzYWJsZSB0ZWxlbWV0cnkgZ2F0aGVyaW5nLlxuICpcbiAqIE5vIGNvbnRlbnQgbm9yIGlkZW50aWZpYWJsZSBpbmZvcm1hdGlvbiBpcyBnYXRoZXJlZCwgb25seVxuICogdXNhZ2UgYW5kIHBlcmZvcm1hbmNlIG1ldHJpY3MuXG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbkNsaWVudC5wcm90b3R5cGUudGVsZW1ldHJ5RW5hYmxlZCA9IHRydWU7XG5cbi8qKlxuICogR2F0aGVyIHVzYWdlIGFuZCByZXNwb25zaXZlbmVzcyBzdGF0aXN0aWNzXG4gKlxuICogQHByaXZhdGVcbiAqL1xuQ2xpZW50LnByb3RvdHlwZS50ZWxlbWV0cnlNb25pdG9yID0gbnVsbDtcblxuLyoqXG4gKiBHZXQgdGhlIHZlcnNpb24gb2YgdGhlIENsaWVudCBsaWJyYXJ5LlxuICpcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudC52ZXJzaW9uID0gJzMuMy4yJztcblxuLyoqXG4gKiBBbnkgQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2UgdGhhdCBpcyBwYXJ0IG9mIGEgUXVlcnkncyByZXN1bHRzIGFyZSBrZXB0IGluIG1lbW9yeSBmb3IgYXMgbG9uZyBhcyBpdFxuICogcmVtYWlucyBpbiB0aGF0IFF1ZXJ5LiAgSG93ZXZlciwgd2hlbiBhIHdlYnNvY2tldCBldmVudCBkZWxpdmVycyBuZXcgTWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbnMgdGhhdFxuICogYXJlIE5PVCBwYXJ0IG9mIGEgUXVlcnksIGhvdyBsb25nIHNob3VsZCB0aGV5IHN0aWNrIGFyb3VuZCBpbiBtZW1vcnk/ICBXaHkgaGF2ZSB0aGVtIHN0aWNrIGFyb3VuZD9cbiAqIFBlcmhhcHMgYW4gYXBwIHdhbnRzIHRvIHBvc3QgYSBub3RpZmljYXRpb24gb2YgYSBuZXcgTWVzc2FnZSBvciBDb252ZXJzYXRpb24uLi4gYW5kIHdhbnRzIHRvIGtlZXBcbiAqIHRoZSBvYmplY3QgbG9jYWwgZm9yIGEgbGl0dGxlIHdoaWxlLiAgRGVmYXVsdCBpcyAxMCBtaW51dGVzIGJlZm9yZSBjaGVja2luZyB0byBzZWUgaWZcbiAqIHRoZSBvYmplY3QgaXMgcGFydCBvZiBhIFF1ZXJ5IG9yIGNhbiBiZSB1bmNhY2hlZC4gIFZhbHVlIGlzIGluIG1pbGlzZWNvbmRzLlxuICogQHN0YXRpY1xuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ2xpZW50LkNBQ0hFX1BVUkdFX0lOVEVSVkFMID0gMTAgKiA2MCAqIDEwMDA7XG5cbkNsaWVudC5faWdub3JlZEV2ZW50cyA9IFtcbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyxcbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkLWVycm9yJyxcbl07XG5cbkNsaWVudC5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAvKipcbiAgICogQSBUeXBpbmcgSW5kaWNhdG9yIHN0YXRlIGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBFaXRoZXIgYSBjaGFuZ2UgaGFzIGJlZW4gcmVjZWl2ZWRcbiAgICogZnJvbSB0aGUgc2VydmVyLCBvciBhIHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgaGFzIGV4cGlyZWQuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCd0eXBpbmctaW5kaWNhdG9yLWNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbklkID09PSBteUNvbnZlcnNhdGlvbklkKSB7XG4gICAqICAgICAgICAgICAgICBhbGVydChldnQudHlwaW5nLmpvaW4oJywgJykgKyAnIGFyZSB0eXBpbmcnKTtcbiAgICogICAgICAgICAgICAgIGFsZXJ0KGV2dC5wYXVzZWQuam9pbignLCAnKSArICcgYXJlIHBhdXNlZCcpO1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge3N0cmluZ30gY29udmVyc2F0aW9uSWQgLSBJRCBvZiB0aGUgQ29udmVyc2F0aW9uIHVzZXJzIGFyZSB0eXBpbmcgaW50b1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSB0eXBpbmcgLSBBcnJheSBvZiB1c2VyIElEcyB3aG8gYXJlIGN1cnJlbnRseSB0eXBpbmdcbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gcGF1c2VkIC0gQXJyYXkgb2YgdXNlciBJRHMgd2hvIGFyZSBjdXJyZW50bHkgcGF1c2VkO1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBIHBhdXNlZCB1c2VyIHN0aWxsIGhhcyB0ZXh0IGluIHRoZWlyIHRleHQgYm94LlxuICAgKi9cbiAgJ3R5cGluZy1pbmRpY2F0b3ItY2hhbmdlJyxcblxuXS5jb25jYXQoQ2xpZW50QXV0aC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuQ2xpZW50Lm1peGlucyA9IFtcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LXF1ZXJpZXMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWlkZW50aXRpZXMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LW1lbWJlcnMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWNvbnZlcnNhdGlvbnMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWNoYW5uZWxzJyksXG4gIHJlcXVpcmUoJy4vbWl4aW5zL2NsaWVudC1tZXNzYWdlcycpLFxuXTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KENsaWVudCwgW0NsaWVudCwgJ0NsaWVudCddKTtcbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50O1xuXG4iXX0=
