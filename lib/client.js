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

      objects.forEach(function (obj) {
        if (!obj.isDestroyed && !_this3._isCachedObject(obj)) {
          if (obj instanceof Root === false) obj = _this3.getObject(obj.id);
          if (obj) obj.destroy();
        }
      });
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
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.1.1';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQuanMiXSwibmFtZXMiOlsiQ2xpZW50QXV0aCIsInJlcXVpcmUiLCJDb252ZXJzYXRpb24iLCJDaGFubmVsIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJDaGFubmVsTWVzc2FnZSIsIkFubm91bmNlbWVudCIsIklkZW50aXR5IiwiTWVtYmVyc2hpcCIsIlR5cGluZ0luZGljYXRvckxpc3RlbmVyIiwiVXRpbCIsIlJvb3QiLCJDbGllbnRSZWdpc3RyeSIsImxvZ2dlciIsIlR5cGluZ0xpc3RlbmVyIiwiVHlwaW5nUHVibGlzaGVyIiwiQ2xpZW50Iiwib3B0aW9ucyIsInJlZ2lzdGVyIiwiX21vZGVscyIsIl9ydW5NaXhpbnMiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyIsIl9pbml0Q29tcG9uZW50cyIsIm9uIiwiX2Nvbm5lY3Rpb25SZXN0b3JlZCIsImJpbmQiLCJpbmZvIiwiYXNjaWlJbml0IiwidmVyc2lvbiIsIl90eXBpbmdJbmRpY2F0b3JzIiwiY2xpZW50SWQiLCJhcHBJZCIsImlzRGVzdHJveWVkIiwiX2luQ2xlYW51cCIsImUiLCJlcnJvciIsInNvY2tldE1hbmFnZXIiLCJjbG9zZSIsIl9jbGVhbnVwIiwiX2Rlc3Ryb3lDb21wb25lbnRzIiwidW5yZWdpc3RlciIsIkVycm9yIiwiYXBwSWRJbW11dGFibGUiLCJpZGVudGl0aWVzIiwibWFwIiwiaWRlbnRpdHkiLCJnZXRJZGVudGl0eSIsImlkIiwidXNlcklkIiwiX2NyZWF0ZU9iamVjdCIsImNhbkxvYWQiLCJ0eXBlRnJvbUlEIiwiZ2V0TWVzc2FnZSIsImdldENvbnZlcnNhdGlvbiIsImdldENoYW5uZWwiLCJnZXRRdWVyeSIsImdldE1lbWJlciIsIm9iaiIsIml0ZW0iLCJnZXRPYmplY3QiLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwiY29udmVyc2F0aW9uIiwiX2NyZWF0ZUZyb21TZXJ2ZXIiLCJjaGFubmVsIiwiY29udGFpbmVyIiwib2xkSWQiLCJfdXBkYXRlQ29udmVyc2F0aW9uSWQiLCJfdXBkYXRlQ2hhbm5lbElkIiwiYWRkQ29udmVyc2F0aW9ucyIsIl9kZWxheWVkVHJpZ2dlcnMiLCJmaWx0ZXIiLCJldnQiLCJyZW1vdmVDb252ZXJzYXRpb25zIiwiX2ZvbGRFdmVudHMiLCJhZGRNZXNzYWdlcyIsInJlbW92ZU1lc3NhZ2VzIiwiYWRkSWRlbnRpdGllcyIsInJlbW92ZUlkZW50aXRpZXMiLCJldmVudE5hbWUiLCJfdHJpZ2dlckxvZ2dlciIsImluZm9FdmVudHMiLCJpbmRleE9mIiwiaXNDaGFuZ2UiLCJjaGFuZ2VzIiwiY2hhbmdlIiwicHJvcGVydHkiLCJqb2luIiwidGV4dCIsIm1lc3NhZ2UiLCJtZXNzYWdlcyIsImxlbmd0aCIsImNvbnZlcnNhdGlvbnMiLCJjaGFubmVscyIsImRlYnVnIiwib2JqZWN0cyIsImZvckVhY2giLCJfaXNDYWNoZWRPYmplY3QiLCJkZXN0cm95Iiwib2JqZWN0IiwiaXNTYXZlZCIsIl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUF0IiwiRGF0ZSIsIm5vdyIsIkNBQ0hFX1BVUkdFX0lOVEVSVkFMIiwic2V0VGltZW91dCIsIl9ydW5TY2hlZHVsZWRDaGVja0FuZFB1cmdlQ2FjaGUiLCJwdXNoIiwibGlzdCIsIl9jaGVja0FuZFB1cmdlQ2FjaGUiLCJPYmplY3QiLCJrZXlzIiwicXVlcmllcyIsImkiLCJxdWVyeSIsIl9nZXRJdGVtIiwicmVzZXQiLCJkYk1hbmFnZXIiLCJkZWxldGVUYWJsZXMiLCJfb3BlbiIsImlucHV0Tm9kZSIsImlucHV0IiwiY29udmVyc2F0aW9uSWQiLCJnZXRTdGF0ZSIsImdldCIsImdldEFsbCIsImNsaWVudCIsInByb3RvdHlwZSIsIl9pZ25vcmVkRXZlbnRzIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsIm1peGlucyIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7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UCxHQUF3QixDQUN0QixzQkFEc0IsRUFFdEIsNEJBRnNCLENBQXhCOztBQUtBL0csT0FBT2dILGdCQUFQLEdBQTBCO0FBQ3hCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9CQSx5QkFyQndCLEVBd0J4QkMsTUF4QndCLENBd0JqQm5JLFdBQVdrSSxnQkF4Qk0sQ0FBMUI7O0FBMEJBaEgsT0FBT2tILE1BQVAsR0FBZ0IsQ0FDZG5JLFFBQVEseUJBQVIsQ0FEYyxFQUVkQSxRQUFRLDRCQUFSLENBRmMsRUFHZEEsUUFBUSx5QkFBUixDQUhjLEVBSWRBLFFBQVEsK0JBQVIsQ0FKYyxFQUtkQSxRQUFRLDBCQUFSLENBTGMsRUFNZEEsUUFBUSwwQkFBUixDQU5jLENBQWhCO0FBUUFZLEtBQUt3SCxTQUFMLENBQWVDLEtBQWYsQ0FBcUJwSCxNQUFyQixFQUE2QixDQUFDQSxNQUFELEVBQVMsUUFBVCxDQUE3QjtBQUNBcUgsT0FBT0MsT0FBUCxHQUFpQnRILE1BQWpCIiwiZmlsZSI6ImNsaWVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIExheWVyIENsaWVudDsgdGhpcyBpcyB0aGUgdG9wIGxldmVsIGNvbXBvbmVudCBmb3IgYW55IExheWVyIGJhc2VkIGFwcGxpY2F0aW9uLlxuXG4gICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJyxcbiAgICAgIGNoYWxsZW5nZTogZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgICAgbm9uY2U6IGV2dC5ub25jZSxcbiAgICAgICAgICBvblN1Y2Nlc3M6IGV2dC5jYWxsYmFja1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICByZWFkeTogZnVuY3Rpb24oY2xpZW50KSB7XG4gICAgICAgIGFsZXJ0KCdJIGFtIENsaWVudDsgU2VydmVyOiBTZXJ2ZSBtZSEnKTtcbiAgICAgIH1cbiAgICB9KS5jb25uZWN0KCdGcmVkJylcbiAqXG4gKiBZb3UgY2FuIGFsc28gaW5pdGlhbGl6ZSB0aGlzIGFzXG5cbiAgICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gICAgICBhcHBJZDogJ2xheWVyOi8vL2FwcHMvc3RhZ2luZy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnXG4gICAgfSk7XG5cbiAgICBjbGllbnQub24oJ2NoYWxsZW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgbXlBdXRoZW50aWNhdG9yKHtcbiAgICAgICAgbm9uY2U6IGV2dC5ub25jZSxcbiAgICAgICAgb25TdWNjZXNzOiBldnQuY2FsbGJhY2tcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY2xpZW50Lm9uKCdyZWFkeScsIGZ1bmN0aW9uKGNsaWVudCkge1xuICAgICAgYWxlcnQoJ0kgYW0gQ2xpZW50OyBTZXJ2ZXI6IFNlcnZlIG1lIScpO1xuICAgIH0pO1xuXG4gICAgY2xpZW50LmNvbm5lY3QoJ0ZyZWQnKTtcbiAqXG4gKiAjIyBBUEkgU3lub3BzaXM6XG4gKlxuICogVGhlIGZvbGxvd2luZyBQcm9wZXJ0aWVzLCBNZXRob2RzIGFuZCBFdmVudHMgYXJlIHRoZSBtb3N0IGNvbW1vbmx5IHVzZWQgb25lcy4gIFNlZSB0aGUgZnVsbCBBUEkgYmVsb3dcbiAqIGZvciB0aGUgcmVzdCBvZiB0aGUgQVBJLlxuICpcbiAqICMjIyBQcm9wZXJ0aWVzOlxuICpcbiAqICogbGF5ZXIuQ2xpZW50LnVzZXJJZDogVXNlciBJRCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyXG4gKiAqIGxheWVyLkNsaWVudC5hcHBJZDogVGhlIElEIGZvciB5b3VyIGFwcGxpY2F0aW9uXG4gKlxuICpcbiAqICMjIyBNZXRob2RzOlxuICpcbiAqICogbGF5ZXIuQ2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbigpOiBDcmVhdGUgYSBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uLlxuICogKiBsYXllci5DbGllbnQuY3JlYXRlUXVlcnkoKTogQ3JlYXRlIGEgbmV3IGxheWVyLlF1ZXJ5LlxuICogKiBsYXllci5DbGllbnQuZ2V0TWVzc2FnZSgpOiBJbnB1dCBhIE1lc3NhZ2UgSUQsIGFuZCBvdXRwdXQgYSBsYXllci5NZXNzYWdlIG9yIGxheWVyLkFubm91bmNlbWVudCBmcm9tIGNhY2hlLlxuICogKiBsYXllci5DbGllbnQuZ2V0Q29udmVyc2F0aW9uKCk6IElucHV0IGEgQ29udmVyc2F0aW9uIElELCBhbmQgb3V0cHV0IGEgbGF5ZXIuQ29udmVyc2F0aW9uIGZyb20gY2FjaGUuXG4gKiAqIGxheWVyLkNsaWVudC5vbigpIGFuZCBsYXllci5Db252ZXJzYXRpb24ub2ZmKCk6IGV2ZW50IGxpc3RlbmVyc1xuICogKiBsYXllci5DbGllbnQuZGVzdHJveSgpOiBDbGVhbnVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGlzIGNsaWVudCwgaW5jbHVkaW5nIGFsbCBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucy5cbiAqXG4gKiAjIyMgRXZlbnRzOlxuICpcbiAqICogYGNoYWxsZW5nZWA6IFByb3ZpZGVzIGEgbm9uY2UgYW5kIGEgY2FsbGJhY2s7IHlvdSBjYWxsIHRoZSBjYWxsYmFjayBvbmNlIHlvdSBoYXZlIGFuIElkZW50aXR5IFRva2VuLlxuICogKiBgcmVhZHlgOiBZb3VyIGFwcGxpY2F0aW9uIGNhbiBub3cgc3RhcnQgdXNpbmcgdGhlIExheWVyIHNlcnZpY2VzXG4gKiAqIGBtZXNzYWdlczpub3RpZnlgOiBVc2VkIHRvIG5vdGlmeSB5b3VyIGFwcGxpY2F0aW9uIG9mIG5ldyBtZXNzYWdlcyBmb3Igd2hpY2ggYSBsb2NhbCBub3RpZmljYXRpb24gbWF5IGJlIHN1aXRhYmxlLlxuICpcbiAqICMjIExvZ2dpbmc6XG4gKlxuICogVGhlcmUgYXJlIHR3byB3YXlzIHRvIGNoYW5nZSB0aGUgbG9nIGxldmVsIGZvciBMYXllcidzIGxvZ2dlcjpcbiAqXG4gKiAgICAgbGF5ZXIuQ2xpZW50LnByb3RvdHlwZS5sb2dMZXZlbCA9IGxheWVyLkNvbnN0YW50cy5MT0cuSU5GTztcbiAqXG4gKiBvclxuICpcbiAqICAgICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gKiAgICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJyxcbiAqICAgICAgICBsb2dMZXZlbDogbGF5ZXIuQ29uc3RhbnRzLkxPRy5JTkZPXG4gKiAgICAgfSk7XG4gKlxuICogQGNsYXNzICBsYXllci5DbGllbnRcbiAqIEBleHRlbmRzIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3JcbiAqIEBtaXhpbiBsYXllci5taXhpbnMuQ2xpZW50SWRlbnRpdGllc1xuICogLy9AIG1peGluIGxheWVyLm1peGlucy5DbGllbnRNZW1iZXJzaGlwXG4gKiBAbWl4aW4gbGF5ZXIubWl4aW5zLkNsaWVudENvbnZlcnNhdGlvbnNcbiAqIC8vQCBtaXhpbiBsYXllci5taXhpbnMuQ2xpZW50Q2hhbm5lbHNcbiAqIEBtaXhpbiBsYXllci5taXhpbnMuQ2xpZW50TWVzc2FnZXNcbiAqIEBtaXhpbiBsYXllci5taXhpbnMuQ2xpZW50UXVlcmllc1xuICovXG5cbmNvbnN0IENsaWVudEF1dGggPSByZXF1aXJlKCcuL2NsaWVudC1hdXRoZW50aWNhdG9yJyk7XG5jb25zdCBDb252ZXJzYXRpb24gPSByZXF1aXJlKCcuL21vZGVscy9jb252ZXJzYXRpb24nKTtcbmNvbnN0IENoYW5uZWwgPSByZXF1aXJlKCcuL21vZGVscy9jaGFubmVsJyk7XG5jb25zdCBFcnJvckRpY3Rpb25hcnkgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJykuZGljdGlvbmFyeTtcbmNvbnN0IENvbnZlcnNhdGlvbk1lc3NhZ2UgPSByZXF1aXJlKCcuL21vZGVscy9jb252ZXJzYXRpb24tbWVzc2FnZScpO1xuY29uc3QgQ2hhbm5lbE1lc3NhZ2UgPSByZXF1aXJlKCcuL21vZGVscy9jaGFubmVsLW1lc3NhZ2UnKTtcbmNvbnN0IEFubm91bmNlbWVudCA9IHJlcXVpcmUoJy4vbW9kZWxzL2Fubm91bmNlbWVudCcpO1xuY29uc3QgSWRlbnRpdHkgPSByZXF1aXJlKCcuL21vZGVscy9pZGVudGl0eScpO1xuY29uc3QgTWVtYmVyc2hpcCA9IHJlcXVpcmUoJy4vbW9kZWxzL21lbWJlcnNoaXAnKTtcbmNvbnN0IFR5cGluZ0luZGljYXRvckxpc3RlbmVyID0gcmVxdWlyZSgnLi90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctaW5kaWNhdG9yLWxpc3RlbmVyJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBUeXBpbmdMaXN0ZW5lciA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMvdHlwaW5nLWxpc3RlbmVyJyk7XG5jb25zdCBUeXBpbmdQdWJsaXNoZXIgPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzL3R5cGluZy1wdWJsaXNoZXInKTtcblxuY2xhc3MgQ2xpZW50IGV4dGVuZHMgQ2xpZW50QXV0aCB7XG5cbiAgLypcbiAgICogQWRkcyBjb252ZXJzYXRpb25zLCBtZXNzYWdlcyBhbmQgd2Vic29ja2V0cyBvbiB0b3Agb2YgdGhlIGF1dGhlbnRpY2F0aW9uIGNsaWVudC5cbiAgICoganNkb2NzIG9uIHBhcmVudCBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBDbGllbnRSZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgICB0aGlzLl9tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9ydW5NaXhpbnMoJ2NvbnN0cnVjdG9yJywgW29wdGlvbnNdKTtcblxuICAgIC8vIEluaXRpYWxpemUgUHJvcGVydGllc1xuICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMgPSBbXTtcblxuICAgIHRoaXMuX2luaXRDb21wb25lbnRzKCk7XG5cbiAgICB0aGlzLm9uKCdvbmxpbmUnLCB0aGlzLl9jb25uZWN0aW9uUmVzdG9yZWQuYmluZCh0aGlzKSk7XG5cbiAgICBsb2dnZXIuaW5mbyhVdGlsLmFzY2lpSW5pdChDbGllbnQudmVyc2lvbikpO1xuICB9XG5cbiAgLyogU2VlIHBhcmVudCBtZXRob2QgZG9jcyAqL1xuICBfaW5pdENvbXBvbmVudHMoKSB7XG4gICAgc3VwZXIuX2luaXRDb21wb25lbnRzKCk7XG5cbiAgICB0aGlzLl90eXBpbmdJbmRpY2F0b3JzID0gbmV3IFR5cGluZ0luZGljYXRvckxpc3RlbmVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAgYWxsIHJlc291cmNlcyAoQ29udmVyc2F0aW9ucywgTWVzc2FnZXMsIGV0Yy4uLikgcHJpb3IgdG8gZGVzdHJveSBvciByZWF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGVhbnVwXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYW51cCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIHRoaXMuX2luQ2xlYW51cCA9IHRydWU7XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5fcnVuTWl4aW5zKCdjbGVhbnVwJywgW10pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zb2NrZXRNYW5hZ2VyKSB0aGlzLnNvY2tldE1hbmFnZXIuY2xvc2UoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgLy8gQ2xlYW51cCBhbGwgcmVzb3VyY2VzIChDb252ZXJzYXRpb25zLCBNZXNzYWdlcywgZXRjLi4uKVxuICAgIHRoaXMuX2NsZWFudXAoKTtcblxuICAgIHRoaXMuX2Rlc3Ryb3lDb21wb25lbnRzKCk7XG5cbiAgICBDbGllbnRSZWdpc3RyeS51bnJlZ2lzdGVyKHRoaXMpO1xuXG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuX2luQ2xlYW51cCA9IGZhbHNlO1xuICB9XG5cbiAgX19hZGp1c3RBcHBJZCgpIHtcbiAgICBpZiAodGhpcy5hcHBJZCkgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5hcHBJZEltbXV0YWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogVGFrZXMgYW4gYXJyYXkgb2YgSWRlbnRpdHkgaW5zdGFuY2VzLCBVc2VyIElEcywgSWRlbnRpdHkgSURzLCBJZGVudGl0eSBvYmplY3RzLFxuICAgKiBvciBTZXJ2ZXIgZm9ybWF0dGVkIElkZW50aXR5IE9iamVjdHMgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgSWRlbnRpdHkgaW5zdGFuY2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9maXhJZGVudGl0aWVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TWl4ZWRbXX0gaWRlbnRpdGllcyAtIFNvbWV0aGluZyB0aGF0IHRlbGxzIHVzIHdoYXQgSWRlbnRpdHkgdG8gcmV0dXJuXG4gICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5W119XG4gICAqL1xuICBfZml4SWRlbnRpdGllcyhpZGVudGl0aWVzKSB7XG4gICAgcmV0dXJuIGlkZW50aXRpZXMubWFwKChpZGVudGl0eSkgPT4ge1xuICAgICAgaWYgKGlkZW50aXR5IGluc3RhbmNlb2YgSWRlbnRpdHkpIHJldHVybiBpZGVudGl0eTtcbiAgICAgIGlmICh0eXBlb2YgaWRlbnRpdHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldElkZW50aXR5KGlkZW50aXR5LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAoaWRlbnRpdHkgJiYgdHlwZW9mIGlkZW50aXR5ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoJ3VzZXJJZCcgaW4gaWRlbnRpdHkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRJZGVudGl0eShpZGVudGl0eS5pZCB8fCBpZGVudGl0eS51c2VySWQpO1xuICAgICAgICB9IGVsc2UgaWYgKCd1c2VyX2lkJyBpbiBpZGVudGl0eSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9jcmVhdGVPYmplY3QoaWRlbnRpdHkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFRha2VzIGFzIGlucHV0IGFuIG9iamVjdCBpZCwgYW5kIGVpdGhlciBjYWxscyBnZXRDb252ZXJzYXRpb24oKSBvciBnZXRNZXNzYWdlKCkgYXMgbmVlZGVkLlxuICAgKlxuICAgKiBXaWxsIG9ubHkgZ2V0IGNhY2hlZCBvYmplY3RzLCB3aWxsIG5vdCBnZXQgb2JqZWN0cyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IGEgcHVibGljIG1ldGhvZCBtb3N0bHkgc28gdGhlcmUncyBubyBhbWJpZ3VpdHkgb3ZlciB1c2luZyBnZXRYWFhcbiAgICogb3IgZ2V0T2JqZWN0LiAgZ2V0WFhYIHR5cGljYWxseSBoYXMgYW4gb3B0aW9uIHRvIGxvYWQgdGhlIHJlc291cmNlLCB3aGljaCB0aGlzXG4gICAqIGRvZXMgbm90LlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE9iamVjdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gTWVzc2FnZSwgQ29udmVyc2F0aW9uIG9yIFF1ZXJ5IGlkXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgb2JqZWN0IGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIHNlcnZlciBpZiBub3QgZm91bmQgKG5vdCBzdXBwb3J0ZWQgZm9yIGFsbCBvYmplY3RzKVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfGxheWVyLkNvbnZlcnNhdGlvbnxsYXllci5RdWVyeX1cbiAgICovXG4gIGdldE9iamVjdChpZCwgY2FuTG9hZCA9IGZhbHNlKSB7XG4gICAgc3dpdGNoIChVdGlsLnR5cGVGcm9tSUQoaWQpKSB7XG4gICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0TWVzc2FnZShpZCwgY2FuTG9hZCk7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udmVyc2F0aW9uKGlkLCBjYW5Mb2FkKTtcbiAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q2hhbm5lbChpZCwgY2FuTG9hZCk7XG4gICAgICBjYXNlICdxdWVyaWVzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoaWQpO1xuICAgICAgY2FzZSAnaWRlbnRpdGllcyc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldElkZW50aXR5KGlkLCBjYW5Mb2FkKTtcbiAgICAgIGNhc2UgJ21lbWJlcnMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRNZW1iZXIoaWQsIGNhbkxvYWQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFRha2VzIGFuIG9iamVjdCBkZXNjcmlwdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGVpdGhlciB1cGRhdGVzIGl0IChpZiBjYWNoZWQpXG4gICAqIG9yIGNyZWF0ZXMgYW5kIGNhY2hlcyBpdCAuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZU9iamVjdFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2JqIC0gUGxhaW4gamF2YXNjcmlwdCBvYmplY3QgcmVwcmVzZW50aW5nIGEgTWVzc2FnZSBvciBDb252ZXJzYXRpb25cbiAgICovXG4gIF9jcmVhdGVPYmplY3Qob2JqKSB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuZ2V0T2JqZWN0KG9iai5pZCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGl0ZW0uX3BvcHVsYXRlRnJvbVNlcnZlcihvYmopO1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoVXRpbC50eXBlRnJvbUlEKG9iai5pZCkpIHtcbiAgICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAgIGlmIChvYmouY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uTWVzc2FnZS5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICAgIH0gZWxzZSBpZiAob2JqLmNoYW5uZWwpIHtcbiAgICAgICAgICAgIHJldHVybiBDaGFubmVsTWVzc2FnZS5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYW5ub3VuY2VtZW50cyc6XG4gICAgICAgICAgcmV0dXJuIEFubm91bmNlbWVudC5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uLl9jcmVhdGVGcm9tU2VydmVyKG9iaiwgdGhpcyk7XG4gICAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgICByZXR1cm4gQ2hhbm5lbC5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdpZGVudGl0aWVzJzpcbiAgICAgICAgICByZXR1cm4gSWRlbnRpdHkuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgICAgY2FzZSAnbWVtYmVycyc6XG4gICAgICAgICAgcmV0dXJuIE1lbWJlcnNoaXAuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogV2hlbiBhIGxheWVyLkNvbnRhaW5lcidzIElEIGNoYW5nZXMsIHdlIG5lZWQgdG8gdXBkYXRlXG4gICAqIGEgdmFyaWV0eSBvZiB0aGluZ3MgYW5kIHRyaWdnZXIgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVDb250YWluZXJJZFxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnRhaW5lcn0gY29udGFpbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvbGRJZFxuICAgKi9cbiAgX3VwZGF0ZUNvbnRhaW5lcklkKGNvbnRhaW5lciwgb2xkSWQpIHtcbiAgICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uKSB7XG4gICAgICB0aGlzLl91cGRhdGVDb252ZXJzYXRpb25JZChjb250YWluZXIsIG9sZElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdXBkYXRlQ2hhbm5lbElkKGNvbnRhaW5lciwgb2xkSWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZSBldmVudHMgaW50byBzbWFsbGVyIG51bWJlcnMgb2YgbW9yZSBjb21wbGV0ZSBldmVudHMuXG4gICAqXG4gICAqIEJlZm9yZSBhbnkgZGVsYXllZCB0cmlnZ2VycyBhcmUgZmlyZWQsIGZvbGQgdG9nZXRoZXIgYWxsIG9mIHRoZSBjb252ZXJzYXRpb25zOmFkZFxuICAgKiBhbmQgY29udmVyc2F0aW9uczpyZW1vdmUgZXZlbnRzIHNvIHRoYXQgMTAwIGNvbnZlcnNhdGlvbnM6YWRkIGV2ZW50cyBjYW4gYmUgZmlyZWQgYXNcbiAgICogYSBzaW5nbGUgZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG5cbiAgICBjb25zdCBhZGRDb252ZXJzYXRpb25zID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVDb252ZXJzYXRpb25zID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczpyZW1vdmUnKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKGFkZENvbnZlcnNhdGlvbnMsICdjb252ZXJzYXRpb25zJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVDb252ZXJzYXRpb25zLCAnY29udmVyc2F0aW9ucycsIHRoaXMpO1xuXG4gICAgY29uc3QgYWRkTWVzc2FnZXMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKGV2dCA9PiBldnRbMF0gPT09ICdtZXNzYWdlczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVNZXNzYWdlcyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoZXZ0ID0+IGV2dFswXSA9PT0gJ21lc3NhZ2VzOnJlbW92ZScpO1xuXG4gICAgdGhpcy5fZm9sZEV2ZW50cyhhZGRNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG5cbiAgICBjb25zdCBhZGRJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnaWRlbnRpdGllczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzBdID09PSAnaWRlbnRpdGllczpyZW1vdmUnKTtcblxuICAgIHRoaXMuX2ZvbGRFdmVudHMoYWRkSWRlbnRpdGllcywgJ2lkZW50aXRpZXMnLCB0aGlzKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKHJlbW92ZUlkZW50aXRpZXMsICdpZGVudGl0aWVzJywgdGhpcyk7XG5cbiAgICBzdXBlci5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycygpO1xuICB9XG5cbiAgdHJpZ2dlcihldmVudE5hbWUsIGV2dCkge1xuICAgIHRoaXMuX3RyaWdnZXJMb2dnZXIoZXZlbnROYW1lLCBldnQpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZlbnROYW1lLCBldnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvZXMgbG9nZ2luZyBvbiBhbGwgdHJpZ2dlcmVkIGV2ZW50cy5cbiAgICpcbiAgICogQWxsIGxvZ2dpbmcgaXMgZG9uZSBhdCBgZGVidWdgIG9yIGBpbmZvYCBsZXZlbHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3RyaWdnZXJMb2dnZXJcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF90cmlnZ2VyTG9nZ2VyKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgaW5mb0V2ZW50cyA9IFtcbiAgICAgICdjb252ZXJzYXRpb25zOmFkZCcsICdjb252ZXJzYXRpb25zOnJlbW92ZScsICdjb252ZXJzYXRpb25zOmNoYW5nZScsXG4gICAgICAnbWVzc2FnZXM6YWRkJywgJ21lc3NhZ2VzOnJlbW92ZScsICdtZXNzYWdlczpjaGFuZ2UnLFxuICAgICAgJ2lkZW50aXRpZXM6YWRkJywgJ2lkZW50aXRpZXM6cmVtb3ZlJywgJ2lkZW50aXRpZXM6Y2hhbmdlJyxcbiAgICAgICdjaGFsbGVuZ2UnLCAncmVhZHknLFxuICAgIF07XG4gICAgaWYgKGluZm9FdmVudHMuaW5kZXhPZihldmVudE5hbWUpICE9PSAtMSkge1xuICAgICAgaWYgKGV2dCAmJiBldnQuaXNDaGFuZ2UpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oYENsaWVudCBFdmVudDogJHtldmVudE5hbWV9ICR7ZXZ0LmNoYW5nZXMubWFwKGNoYW5nZSA9PiBjaGFuZ2UucHJvcGVydHkpLmpvaW4oJywgJyl9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGV4dCA9ICcnO1xuICAgICAgICBpZiAoZXZ0KSB7XG4gICAgICAgICAgLy8gSWYgdGhlIHRyaWdnZXJlZCBldmVudCBoYXMgdGhlc2UgbWVzc2FnZXMsIHVzZSBhIHNpbXBsZXIgd2F5IG9mIHJlbmRlcmluZyBpbmZvIGFib3V0IHRoZW1cbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2UpIHRleHQgPSBldnQubWVzc2FnZS5pZDtcbiAgICAgICAgICBpZiAoZXZ0Lm1lc3NhZ2VzKSB0ZXh0ID0gZXZ0Lm1lc3NhZ2VzLmxlbmd0aCArICcgbWVzc2FnZXMnO1xuICAgICAgICAgIGlmIChldnQuY29udmVyc2F0aW9uKSB0ZXh0ID0gZXZ0LmNvbnZlcnNhdGlvbi5pZDtcbiAgICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbnMpIHRleHQgPSBldnQuY29udmVyc2F0aW9ucy5sZW5ndGggKyAnIGNvbnZlcnNhdGlvbnMnO1xuICAgICAgICAgIGlmIChldnQuY2hhbm5lbCkgdGV4dCA9IGV2dC5jaGFubmVsLmlkO1xuICAgICAgICAgIGlmIChldnQuY2hhbm5lbHMpIHRleHQgPSBldnQuY2hhbm5lbHMubGVuZ3RoICsgJyBjaGFubmVscyc7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmluZm8oYENsaWVudCBFdmVudDogJHtldmVudE5hbWV9ICR7dGV4dH1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChldnQpIGxvZ2dlci5kZWJ1ZyhldnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZGVidWcoZXZlbnROYW1lLCBldnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgc2Vzc2lvbiBoYXMgYmVlbiByZXNldCwgZHVtcCBhbGwgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzZXRTZXNzaW9uKCkge1xuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLl9ydW5NaXhpbnMoJ3Jlc2V0JywgW10pO1xuICAgIHJldHVybiBzdXBlci5fcmVzZXRTZXNzaW9uKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDaGVjayB0byBzZWUgaWYgdGhlIHNwZWNpZmllZCBvYmplY3RzIGNhbiBzYWZlbHkgYmUgcmVtb3ZlZCBmcm9tIGNhY2hlLlxuICAgKlxuICAgKiBSZW1vdmVzIGZyb20gY2FjaGUgaWYgYW4gb2JqZWN0IGlzIG5vdCBwYXJ0IG9mIGFueSBRdWVyeSdzIHJlc3VsdCBzZXQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NoZWNrQW5kUHVyZ2VDYWNoZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290W119IG9iamVjdHMgLSBBcnJheSBvZiBNZXNzYWdlcyBvciBDb252ZXJzYXRpb25zXG4gICAqL1xuICBfY2hlY2tBbmRQdXJnZUNhY2hlKG9iamVjdHMpIHtcbiAgICBvYmplY3RzLmZvckVhY2goKG9iaikgPT4ge1xuICAgICAgaWYgKCFvYmouaXNEZXN0cm95ZWQgJiYgIXRoaXMuX2lzQ2FjaGVkT2JqZWN0KG9iaikpIHtcbiAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIFJvb3QgPT09IGZhbHNlKSBvYmogPSB0aGlzLmdldE9iamVjdChvYmouaWQpO1xuICAgICAgICBpZiAob2JqKSBvYmouZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlcyBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlIGlmIG5lZWRlZCwgYW5kIGFkZHMgdGhpcyBvYmplY3RcbiAgICogdG8gdGhlIGxpc3Qgb2Ygb2JqZWN0cyBpdCB3aWxsIHZhbGlkYXRlIGZvciB1bmNhY2hpbmcuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBhbnkgb2JqZWN0IHRoYXQgZG9lcyBub3QgZXhpc3Qgb24gdGhlIHNlcnZlciAoIWlzU2F2ZWQoKSkgaXMgYW4gb2JqZWN0IHRoYXQgdGhlXG4gICAqIGFwcCBjcmVhdGVkIGFuZCBjYW4gb25seSBiZSBwdXJnZWQgYnkgdGhlIGFwcCBhbmQgbm90IGJ5IHRoZSBTREsuICBPbmNlIGl0cyBiZWVuXG4gICAqIHNhdmVkLCBhbmQgY2FuIGJlIHJlbG9hZGVkIGZyb20gdGhlIHNlcnZlciB3aGVuIG5lZWRlZCwgaXRzIHN1YmplY3QgdG8gc3RhbmRhcmQgY2FjaGluZy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Sb290fSBvYmplY3RcbiAgICovXG4gIF9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0LmlzU2F2ZWQoKSkge1xuICAgICAgaWYgKHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPCBEYXRlLm5vdygpKSB7XG4gICAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlQXQgPSBEYXRlLm5vdygpICsgQ2xpZW50LkNBQ0hFX1BVUkdFX0lOVEVSVkFMO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3J1blNjaGVkdWxlZENoZWNrQW5kUHVyZ2VDYWNoZSgpLCBDbGllbnQuQ0FDSEVfUFVSR0VfSU5URVJWQUwpO1xuICAgICAgfVxuICAgICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcy5wdXNoKG9iamVjdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxzIF9jaGVja0FuZFB1cmdlQ2FjaGUgb24gYWNjdW11bGF0ZWQgb2JqZWN0cyBhbmQgcmVzZXRzIGl0cyBzdGF0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlKCkge1xuICAgIGNvbnN0IGxpc3QgPSB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUl0ZW1zO1xuICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXMgPSBbXTtcbiAgICB0aGlzLl9jaGVja0FuZFB1cmdlQ2FjaGUobGlzdCk7XG4gICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgb2JqZWN0IHNob3VsZCBjb250aW51ZSB0byBiZSBwYXJ0IG9mIHRoZSBjYWNoZS5cbiAgICpcbiAgICogUmVzdWx0IGlzIGJhc2VkIG9uIHdoZXRoZXIgdGhlIG9iamVjdCBpcyBwYXJ0IG9mIHRoZSBkYXRhIGZvciBhIFF1ZXJ5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9pc0NhY2hlZE9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290fSBvYmogLSBBIE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uIEluc3RhbmNlXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBfaXNDYWNoZWRPYmplY3Qob2JqKSB7XG4gICAgY29uc3QgbGlzdCA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5xdWVyaWVzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5fbW9kZWxzLnF1ZXJpZXNbbGlzdFtpXV07XG4gICAgICBpZiAocXVlcnkuX2dldEl0ZW0ob2JqLmlkKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPbiByZXN0b3JpbmcgYSBjb25uZWN0aW9uLCBkZXRlcm1pbmUgd2hhdCBzdGVwcyBuZWVkIHRvIGJlIHRha2VuIHRvIHVwZGF0ZSBvdXIgZGF0YS5cbiAgICpcbiAgICogQSByZXNldCBib29sZWFuIHByb3BlcnR5IGlzIHBhc3NlZDsgc2V0IGJhc2VkIG9uICBsYXllci5DbGllbnRBdXRoZW50aWNhdG9yLlJlc2V0QWZ0ZXJPZmZsaW5lRHVyYXRpb24uXG4gICAqXG4gICAqIE5vdGUgaXQgaXMgcG9zc2libGUgZm9yIGFuIGFwcGxpY2F0aW9uIHRvIGhhdmUgbG9naWMgdGhhdCBjYXVzZXMgcXVlcmllcyB0byBiZSBjcmVhdGVkL2Rlc3Ryb3llZFxuICAgKiBhcyBhIHNpZGUtZWZmZWN0IG9mIGxheWVyLlF1ZXJ5LnJlc2V0IGRlc3Ryb3lpbmcgYWxsIGRhdGEuIFNvIHdlIG11c3QgdGVzdCB0byBzZWUgaWYgcXVlcmllcyBleGlzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvblJlc3RvcmVkXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzZXQgLSBTaG91bGQgdGhlIHNlc3Npb24gcmVzZXQvcmVsb2FkIGFsbCBkYXRhIG9yIGF0dGVtcHQgdG8gcmVzdW1lIHdoZXJlIGl0IGxlZnQgb2ZmP1xuICAgKi9cbiAgX2Nvbm5lY3Rpb25SZXN0b3JlZChldnQpIHtcbiAgICBpZiAoZXZ0LnJlc2V0KSB7XG4gICAgICBsb2dnZXIuZGVidWcoJ0NsaWVudCBDb25uZWN0aW9uIFJlc3RvcmVkOyBSZXNldHRpbmcgYWxsIFF1ZXJpZXMnKTtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyLmRlbGV0ZVRhYmxlcygoKSA9PiB7XG4gICAgICAgIHRoaXMuZGJNYW5hZ2VyLl9vcGVuKCk7XG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5xdWVyaWVzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5fbW9kZWxzLnF1ZXJpZXNbaWRdO1xuICAgICAgICAgIGlmIChxdWVyeSkgcXVlcnkucmVzZXQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nTGlzdGVuZXIgaW5zdGFuY2VcbiAgICogYm91bmQgdG8gdGhlIHNwZWNpZmllZCBkb20gbm9kZS5cbiAgICpcbiAgICogICAgICB2YXIgdHlwaW5nTGlzdGVuZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nTGlzdGVuZXIoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215VGV4dEJveCcpKTtcbiAgICogICAgICB0eXBpbmdMaXN0ZW5lci5zZXRDb252ZXJzYXRpb24obXlTZWxlY3RlZENvbnZlcnNhdGlvbik7XG4gICAqXG4gICAqIFVzZSB0aGlzIG1ldGhvZCB0byBpbnN0YW50aWF0ZSBhIGxpc3RlbmVyLCBhbmQgY2FsbFxuICAgKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nTGlzdGVuZXJcbiAgICogQHBhcmFtICB7SFRNTEVsZW1lbnR9IGlucHV0Tm9kZSAtIFRleHQgaW5wdXQgdG8gd2F0Y2ggZm9yIGtleXN0cm9rZXNcbiAgICogQHJldHVybiB7bGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lcn1cbiAgICovXG4gIGNyZWF0ZVR5cGluZ0xpc3RlbmVyKGlucHV0Tm9kZSkge1xuICAgIHJldHVybiBuZXcgVHlwaW5nTGlzdGVuZXIoe1xuICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICBpbnB1dDogaW5wdXROb2RlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5cbiAgICpcbiAgICogVGhlIFR5cGluZ1B1Ymxpc2hlciBsZXRzIHlvdSBtYW5hZ2UgeW91ciBUeXBpbmcgSW5kaWNhdG9ycyB3aXRob3V0IHVzaW5nXG4gICAqIHRoZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLlxuICAgKlxuICAgKiAgICAgIHZhciB0eXBpbmdQdWJsaXNoZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyKCk7XG4gICAqICAgICAgdHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbihteVNlbGVjdGVkQ29udmVyc2F0aW9uKTtcbiAgICogICAgICB0eXBpbmdQdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtcbiAgICpcbiAgICogVXNlIHRoaXMgbWV0aG9kIHRvIGluc3RhbnRpYXRlIGEgbGlzdGVuZXIsIGFuZCBjYWxsXG4gICAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIFVzZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5zZXRTdGF0ZSB0byBpbmZvcm0gb3RoZXIgdXNlcnMgb2YgeW91ciBjdXJyZW50IHN0YXRlLlxuICAgKiBOb3RlIHRoYXQgdGhlIGBTVEFSVEVEYCBzdGF0ZSBvbmx5IGxhc3RzIGZvciAyLjUgc2Vjb25kcywgc28geW91XG4gICAqIG11c3QgcmVwZWF0ZWRseSBjYWxsIHNldFN0YXRlIGZvciBhcyBsb25nIGFzIHRoaXMgc3RhdGUgc2hvdWxkIGNvbnRpbnVlLlxuICAgKiBUaGlzIGlzIHR5cGljYWxseSBkb25lIGJ5IHNpbXBseSBjYWxsaW5nIGl0IGV2ZXJ5IHRpbWUgYSB1c2VyIGhpdHNcbiAgICogYSBrZXkuXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nUHVibGlzaGVyXG4gICAqIEByZXR1cm4ge2xheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyfVxuICAgKi9cbiAgY3JlYXRlVHlwaW5nUHVibGlzaGVyKCkge1xuICAgIHJldHVybiBuZXcgVHlwaW5nUHVibGlzaGVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIG9mIGEgc3BlY2lmaWVkIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogVHlwaWNhbGx5IHVzZWQgdG8gc2VlIGlmIGFueW9uZSBpcyBjdXJyZW50bHkgdHlwaW5nIHdoZW4gZmlyc3Qgb3BlbmluZyBhIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUeXBpbmdTdGF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29udmVyc2F0aW9uSWRcbiAgICovXG4gIGdldFR5cGluZ1N0YXRlKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3R5cGluZ0luZGljYXRvcnMuZ2V0U3RhdGUoY29udmVyc2F0aW9uSWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc29yIGZvciBnZXR0aW5nIGEgQ2xpZW50IGJ5IGFwcElkLlxuICAgKlxuICAgKiBNb3N0IGFwcHMgd2lsbCBvbmx5IGhhdmUgb25lIGNsaWVudCxcbiAgICogYW5kIHdpbGwgbm90IG5lZWQgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q2xpZW50XG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBhcHBJZFxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBzdGF0aWMgZ2V0Q2xpZW50KGFwcElkKSB7XG4gICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldChhcHBJZCk7XG4gIH1cblxuICBzdGF0aWMgZGVzdHJveUFsbENsaWVudHMoKSB7XG4gICAgQ2xpZW50UmVnaXN0cnkuZ2V0QWxsKCkuZm9yRWFjaChjbGllbnQgPT4gY2xpZW50LmRlc3Ryb3koKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBcnJheSBvZiBpdGVtcyB0byBiZSBjaGVja2VkIHRvIHNlZSBpZiB0aGV5IGNhbiBiZSB1bmNhY2hlZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge2xheWVyLlJvb3RbXX1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBuZXh0IGNhbGwgdG8gX3J1bkNoZWNrQW5kUHVyZ2VDYWNoZSgpIGlzIHNjaGVkdWxlZCBmb3IgaW4gbXMgc2luY2UgMTk3MC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA9IDA7XG5cbi8qKlxuICogR2V0IHRoZSB2ZXJzaW9uIG9mIHRoZSBDbGllbnQgbGlicmFyeS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5DbGllbnQudmVyc2lvbiA9ICczLjEuMSc7XG5cbi8qKlxuICogQW55IENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIHRoYXQgaXMgcGFydCBvZiBhIFF1ZXJ5J3MgcmVzdWx0cyBhcmUga2VwdCBpbiBtZW1vcnkgZm9yIGFzIGxvbmcgYXMgaXRcbiAqIHJlbWFpbnMgaW4gdGhhdCBRdWVyeS4gIEhvd2V2ZXIsIHdoZW4gYSB3ZWJzb2NrZXQgZXZlbnQgZGVsaXZlcnMgbmV3IE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb25zIHRoYXRcbiAqIGFyZSBOT1QgcGFydCBvZiBhIFF1ZXJ5LCBob3cgbG9uZyBzaG91bGQgdGhleSBzdGljayBhcm91bmQgaW4gbWVtb3J5PyAgV2h5IGhhdmUgdGhlbSBzdGljayBhcm91bmQ/XG4gKiBQZXJoYXBzIGFuIGFwcCB3YW50cyB0byBwb3N0IGEgbm90aWZpY2F0aW9uIG9mIGEgbmV3IE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uLi4uIGFuZCB3YW50cyB0byBrZWVwXG4gKiB0aGUgb2JqZWN0IGxvY2FsIGZvciBhIGxpdHRsZSB3aGlsZS4gIERlZmF1bHQgaXMgMTAgbWludXRlcyBiZWZvcmUgY2hlY2tpbmcgdG8gc2VlIGlmXG4gKiB0aGUgb2JqZWN0IGlzIHBhcnQgb2YgYSBRdWVyeSBvciBjYW4gYmUgdW5jYWNoZWQuICBWYWx1ZSBpcyBpbiBtaWxpc2Vjb25kcy5cbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbkNsaWVudC5DQUNIRV9QVVJHRV9JTlRFUlZBTCA9IDEwICogNjAgKiAxMDAwO1xuXG5DbGllbnQuX2lnbm9yZWRFdmVudHMgPSBbXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZCcsXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZC1lcnJvcicsXG5dO1xuXG5DbGllbnQuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIEEgVHlwaW5nIEluZGljYXRvciBzdGF0ZSBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogRWl0aGVyIGEgY2hhbmdlIGhhcyBiZWVuIHJlY2VpdmVkXG4gICAqIGZyb20gdGhlIHNlcnZlciwgb3IgYSB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIGhhcyBleHBpcmVkLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbigndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgaWYgKGV2dC5jb252ZXJzYXRpb25JZCA9PT0gbXlDb252ZXJzYXRpb25JZCkge1xuICAgKiAgICAgICAgICAgICAgYWxlcnQoZXZ0LnR5cGluZy5qb2luKCcsICcpICsgJyBhcmUgdHlwaW5nJyk7XG4gICAqICAgICAgICAgICAgICBhbGVydChldnQucGF1c2VkLmpvaW4oJywgJykgKyAnIGFyZSBwYXVzZWQnKTtcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNvbnZlcnNhdGlvbklkIC0gSUQgb2YgdGhlIENvbnZlcnNhdGlvbiB1c2VycyBhcmUgdHlwaW5nIGludG9cbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gdHlwaW5nIC0gQXJyYXkgb2YgdXNlciBJRHMgd2hvIGFyZSBjdXJyZW50bHkgdHlwaW5nXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IHBhdXNlZCAtIEFycmF5IG9mIHVzZXIgSURzIHdobyBhcmUgY3VycmVudGx5IHBhdXNlZDtcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgQSBwYXVzZWQgdXNlciBzdGlsbCBoYXMgdGV4dCBpbiB0aGVpciB0ZXh0IGJveC5cbiAgICovXG4gICd0eXBpbmctaW5kaWNhdG9yLWNoYW5nZScsXG5cblxuXS5jb25jYXQoQ2xpZW50QXV0aC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuQ2xpZW50Lm1peGlucyA9IFtcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LXF1ZXJpZXMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWlkZW50aXRpZXMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LW1lbWJlcnMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWNvbnZlcnNhdGlvbnMnKSxcbiAgcmVxdWlyZSgnLi9taXhpbnMvY2xpZW50LWNoYW5uZWxzJyksXG4gIHJlcXVpcmUoJy4vbWl4aW5zL2NsaWVudC1tZXNzYWdlcycpLFxuXTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KENsaWVudCwgW0NsaWVudCwgJ0NsaWVudCddKTtcbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50O1xuXG4iXX0=
