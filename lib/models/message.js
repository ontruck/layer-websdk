'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Message Class represents Messages sent amongst participants
 * of of a Conversation.
 *
 * The simplest way to create and send a message is:
 *
 *      var m = conversation.createMessage('Hello there').send();
 *      var m = channel.createMessage('Hello there').send();
 *
 * For conversations that involve notifications (primarily for Android and IOS), the more common pattern is:
 *
 *      var m = conversation.createMessage('Hello there').send({text: "Message from Fred: Hello there"});
 *
 * Channels do not at this time support notifications.
 *
 * Typically, rendering would be done as follows:
 *
 *      // Create a layer.Query that loads Messages for the
 *      // specified Conversation.
 *      var query = client.createQuery({
 *        model: Query.Message,
 *        predicate: 'conversation = "' + conversation.id + '"'
 *      });
 *
 *      // Any time the Query's data changes the 'change'
 *      // event will fire.
 *      query.on('change', function(layerEvt) {
 *        renderNewMessages(query.data);
 *      });
 *
 *      // This will call will cause the above event handler to receive
 *      // a change event, and will update query.data.
 *      conversation.createMessage('Hello there').send();
 *
 * The above code will trigger the following events:
 *
 *  * Message Instance fires
 *    * messages:sending: An event that lets you modify the message prior to sending
 *    * messages:sent: The message was received by the server
 *  * Query Instance fires
 *    * change: The query has received a new Message
 *    * change:add: Same as the change event but does not receive other types of change events
 *
 * When creating a Message there are a number of ways to structure it.
 * All of these are valid and create the same exact Message:
 *
 *      // Full API style:
 *      var m = conversation.createMessage({
 *          parts: [new layer.MessagePart({
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          })]
 *      });
 *
 *      // Option 1: Pass in an Object instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: {
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }
 *      });
 *
 *      // Option 2: Pass in an array of Objects instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: [{
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }]
 *      });
 *
 *      // Option 3: Pass in a string (automatically assumes mimeType is text/plain)
 *      // instead of an array of objects.
 *      var m = conversation.createMessage({
 *          parts: 'Hello'
 *      });
 *
 *      // Option 4: Pass in an array of strings (automatically assumes mimeType is text/plain)
 *      var m = conversation.createMessage({
 *          parts: ['Hello']
 *      });
 *
 *      // Option 5: Pass in just a string and nothing else
 *      var m = conversation.createMessage('Hello');
 *
 *      // Option 6: Use addPart.
 *      var m = converseation.createMessage();
 *      m.addPart({body: "hello", mimeType: "text/plain"});
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Message.id: this property is worth being familiar with; it identifies the
 *   Message and can be used in `client.getMessage(id)` to retrieve it
 *   at any time.
 * * layer.Message.internalId: This property makes for a handy unique ID for use in dom nodes.
 *   It is gaurenteed not to change during this session.
 * * layer.Message.isRead: Indicates if the Message has been read yet; set `m.isRead = true`
 *   to tell the client and server that the message has been read.
 * * layer.Message.parts: An array of layer.MessagePart classes representing the contents of the Message.
 * * layer.Message.sentAt: Date the message was sent
 * * layer.Message.sender `userId`: Conversation participant who sent the Message. You may
 *   need to do a lookup on this id in your own servers to find a
 *   displayable name for it.
 *
 * Methods:
 *
 * * layer.Message.send(): Sends the message to the server and the other participants.
 * * layer.Message.on() and layer.Message.off(); event listeners built on top of the `backbone-events-standalone` npm project
 *
 * Events:
 *
 * * `messages:sent`: The message has been received by the server. Can also subscribe to
 *   this event from the layer.Client which is usually simpler.
 *
 * @class  layer.Message
 * @extends layer.Syncable
 */

var Root = require('../root');
var Syncable = require('./syncable');
var MessagePart = require('./message-part');
var LayerError = require('../layer-error');
var Constants = require('../const');
var Util = require('../client-utils');
var Identity = require('./identity');

var Message = function (_Syncable) {
  _inherits(Message, _Syncable);

  /**
   * See layer.Conversation.createMessage()
   *
   * @method constructor
   * @return {layer.Message}
   */
  function Message() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Message);

    // Unless this is a server representation, this is a developer's shorthand;
    // fill in the missing properties around isRead/isUnread before initializing.
    if (!options.fromServer) {
      if ('isUnread' in options) {
        options.isRead = !options.isUnread && !options.is_unread;
        delete options.isUnread;
      } else {
        options.isRead = true;
      }
    } else {
      options.id = options.fromServer.id;
    }

    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error(LayerError.dictionary.clientMissing);

    // Insure __adjustParts is set AFTER clientId is set.
    var parts = options.parts;
    options.parts = null;

    var _this = _possibleConstructorReturn(this, (Message.__proto__ || Object.getPrototypeOf(Message)).call(this, options));

    _this.parts = parts;

    var client = _this.getClient();
    _this.isInitializing = true;
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    } else {
      if (client) _this.sender = client.user;
      _this.sentAt = new Date();
    }

    if (!_this.parts) _this.parts = [];
    return _this;
  }

  /**
   * Turn input into valid layer.MessageParts.
   *
   * This method is automatically called any time the parts
   * property is set (including during intialization).  This
   * is where we convert strings into MessageParts, and instances
   * into arrays.
   *
   * @method __adjustParts
   * @private
   * @param  {Mixed} parts -- Could be a string, array, object or MessagePart instance
   * @return {layer.MessagePart[]}
   */


  _createClass(Message, [{
    key: '__adjustParts',
    value: function __adjustParts(parts) {
      var _this2 = this;

      if (typeof parts === 'string') {
        return [new MessagePart({
          body: parts,
          mimeType: 'text/plain',
          clientId: this.clientId
        })];
      } else if (Array.isArray(parts)) {
        return parts.map(function (part) {
          var result = void 0;
          if (part instanceof MessagePart) {
            result = part;
          } else {
            result = new MessagePart(part);
          }
          result.clientId = _this2.clientId;
          return result;
        });
      } else if (parts && (typeof parts === 'undefined' ? 'undefined' : _typeof(parts)) === 'object') {
        parts.clientId = this.clientId;
        return [new MessagePart(parts)];
      }
    }

    /**
     * Add a layer.MessagePart to this Message.
     *
     * Should only be called on an unsent Message.
     *
     * ```
     * message.addPart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'});
     *
     * // OR
     * message.addPart(new layer.MessagePart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'}));
     * ```
     *
     * @method addPart
     * @param  {layer.MessagePart/Object} part - A layer.MessagePart instance or a `{mimeType: 'text/plain', body: 'Hello'}` formatted Object.
     * @returns {layer.Message} this
     */

  }, {
    key: 'addPart',
    value: function addPart(part) {
      if (part) {
        part.clientId = this.clientId;
        if (part instanceof MessagePart) {
          this.parts.push(part);
        } else if ((typeof part === 'undefined' ? 'undefined' : _typeof(part)) === 'object') {
          this.parts.push(new MessagePart(part));
        }
      }
      return this;
    }

    /**
     * Send the message to all participants of the Conversation.
     *
     * Message must have parts and a valid conversation to send successfully.
     *
     * The send method takes a `notification` object. In normal use, it provides the same notification to ALL
     * recipients, but you can customize notifications on a per recipient basis, as well as embed actions into the notification.
     * For the Full API, see https://developer.layer.com/docs/platform/messages#notification-customization.
     *
     * For the Full API, see [Server Docs](https://developer.layer.com/docs/platform/messages#notification-customization).
     *
     * ```
     * message.send({
     *    title: "New Hobbit Message",
     *    text: "Frodo-the-Dodo: Hello Sam, what say we waltz into Mordor like we own the place?",
     *    sound: "whinyhobbit.aiff"
     * });
     * ```
     *
     * @method send
     * @param {Object} [notification] - Parameters for controling how the phones manage notifications of the new Message.
     *                          See IOS and Android docs for details.
     * @param {string} [notification.title] - Title to show on lock screen and notification bar
     * @param {string} [notification.text] - Text of your notification
     * @param {string} [notification.sound] - Name of an audio file or other sound-related hint
     * @return {layer.Message} this
     */

  }, {
    key: 'send',
    value: function send(notification) {
      var _this3 = this;

      var client = this.getClient();
      if (!client) {
        throw new Error(LayerError.dictionary.clientMissing);
      }

      var conversation = this.getConversation(true);

      if (!conversation) {
        throw new Error(LayerError.dictionary.conversationMissing);
      }

      if (this.syncState !== Constants.SYNC_STATE.NEW) {
        throw new Error(LayerError.dictionary.alreadySent);
      }

      if (conversation.isLoading) {
        conversation.once(conversation.constructor.eventPrefix + ':loaded', function () {
          return _this3.send(notification);
        });
        return this;
      }

      if (!this.parts || !this.parts.length) {
        throw new Error(LayerError.dictionary.partsMissing);
      }

      this._setSyncing();

      // Make sure that the Conversation has been created on the server
      // and update the lastMessage property
      conversation.send(this);

      // If we are sending any File/Blob objects, and their Mime Types match our test,
      // wait until the body is updated to be a string rather than File before calling _addMessage
      // which will add it to the Query Results and pass this on to a renderer that expects "text/plain" to be a string
      // rather than a blob.
      this._readAllBlobs(function () {
        // Calling this will add this to any listening Queries... so position needs to have been set first;
        // handled in conversation.send(this)
        client._addMessage(_this3);

        // allow for modification of message before sending
        _this3.trigger('messages:sending');

        var data = {
          parts: new Array(_this3.parts.length),
          id: _this3.id
        };
        if (notification && _this3.conversationId) data.notification = notification;

        _this3._preparePartsForSending(data);
      });
      return this;
    }

    /**
     * Any MessagePart that contains a textual blob should contain a string before we send.
     *
     * If a MessagePart with a Blob or File as its body were to be added to the Client,
     * The Query would receive this, deliver it to apps and the app would crash.
     * Most rendering code expecting text/plain would expect a string not a File.
     *
     * When this user is sending a file, and that file is textual, make sure
     * its actual text delivered to the UI.
     *
     * @method _readAllBlobs
     * @private
     */

  }, {
    key: '_readAllBlobs',
    value: function _readAllBlobs(callback) {
      var count = 0;
      var parts = this.parts.filter(function (part) {
        return Util.isBlob(part.body) && part.isTextualMimeType();
      });
      parts.forEach(function (part) {
        Util.fetchTextFromFile(part.body, function (text) {
          part.body = text;
          count++;
          if (count === parts.length) callback();
        });
      });
      if (!parts.length) callback();
    }

    /**
     * Insures that each part is ready to send before actually sending the Message.
     *
     * @method _preparePartsForSending
     * @private
     * @param  {Object} structure to be sent to the server
     */

  }, {
    key: '_preparePartsForSending',
    value: function _preparePartsForSending(data) {
      var _this4 = this;

      var client = this.getClient();
      var count = 0;
      this.parts.forEach(function (part, index) {
        part.once('parts:send', function (evt) {
          data.parts[index] = {
            mime_type: evt.mime_type
          };
          if (evt.content) data.parts[index].content = evt.content;
          if (evt.body) data.parts[index].body = evt.body;
          if (evt.encoding) data.parts[index].encoding = evt.encoding;

          count++;
          if (count === _this4.parts.length) {
            _this4._send(data);
          }
        }, _this4);
        part._send(client);
      });
    }

    /**
     * Handle the actual sending.
     *
     * layer.Message.send has some potentially asynchronous
     * preprocessing to do before sending (Rich Content); actual sending
     * is done here.
     *
     * @method _send
     * @private
     */

  }, {
    key: '_send',
    value: function _send(data) {
      var _this5 = this;

      var client = this.getClient();
      var conversation = this.getConversation(false);

      this.sentAt = new Date();
      client.sendSocketRequest({
        method: 'POST',
        body: {
          method: 'Message.create',
          object_id: conversation.id,
          data: data
        },
        sync: {
          depends: [this.conversationId, this.id],
          target: this.id
        }
      }, function (success, socketData) {
        return _this5._sendResult(success, socketData);
      });
    }
  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      data.object_id = this.conversationId;
      return data;
    }

    /**
      * layer.Message.send() Success Callback.
      *
      * If successfully sending the message; triggers a 'sent' event,
      * and updates the message.id/url
      *
      * @method _sendResult
      * @private
      * @param {Object} messageData - Server description of the message
      */

  }, {
    key: '_sendResult',
    value: function _sendResult(_ref) {
      var success = _ref.success,
          data = _ref.data;

      if (this.isDestroyed) return;

      if (success) {
        this._populateFromServer(data);
        this._triggerAsync('messages:sent');
      } else {
        this.trigger('messages:sent-error', { error: data });
        this.destroy();
      }
      this._setSynced();
    }

    /* NOT FOR JSDUCK
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'messages:loaded' so that calls such as
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          myrerender(m);
     *      });
     *      myrender(m); // render a placeholder for m until the details of m have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Message.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} eventHandler
     * @param  {Object} context
     * @return {layer.Message} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var hasLoadedEvt = name === 'messages:loaded' || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name['messages:loaded'];

      if (hasLoadedEvt && !this.isLoading) {
        var callNow = name === 'messages:loaded' ? callback : name['messages:loaded'];
        Util.defer(function () {
          return callNow.apply(context);
        });
      }
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'on', this).call(this, name, callback, context);
      return this;
    }

    /**
     * Remove this Message from the system.
     *
     * This will deregister the Message, remove all events
     * and allow garbage collection.
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeMessage(this);
      this.parts.forEach(function (part) {
        return part.destroy();
      });
      this.__parts = null;

      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'destroy', this).call(this);
    }

    /**
     * Populates this instance with the description from the server.
     *
     * Can be used for creating or for updating the instance.
     *
     * @method _populateFromServer
     * @protected
     * @param  {Object} m - Server description of the message
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(message) {
      var _this6 = this;

      this._inPopulateFromServer = true;
      var client = this.getClient();

      this.id = message.id;
      this.url = message.url;
      var oldPosition = this.position;
      this.position = message.position;

      // Assign IDs to preexisting Parts so that we can call getPartById()
      if (this.parts) {
        this.parts.forEach(function (part, index) {
          if (!part.id) part.id = _this6.id + '/parts/' + index;
        });
      }

      this.parts = message.parts.map(function (part) {
        var existingPart = _this6.getPartById(part.id);
        if (existingPart) {
          existingPart._populateFromServer(part);
          return existingPart;
        } else {
          return MessagePart._createFromServer(part);
        }
      });

      this.recipientStatus = message.recipient_status || {};

      this.isRead = 'is_unread' in message ? !message.is_unread : true;

      this.sentAt = new Date(message.sent_at);
      this.receivedAt = message.received_at ? new Date(message.received_at) : undefined;

      var sender = void 0;
      if (message.sender.id) {
        sender = client.getIdentity(message.sender.id);
      }

      // Because there may be no ID, we have to bypass client._createObject and its switch statement.
      if (!sender) {
        sender = Identity._createFromServer(message.sender, client);
      }
      this.sender = sender;

      this._setSynced();

      if (oldPosition && oldPosition !== this.position) {
        this._triggerAsync('messages:change', {
          oldValue: oldPosition,
          newValue: this.position,
          property: 'position'
        });
      }
      this._inPopulateFromServer = false;
    }

    /**
     * Returns the Message's layer.MessagePart with the specified the part ID.
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getPartById
     * @param {string} partId
     * @return {layer.MessagePart}
     */

  }, {
    key: 'getPartById',
    value: function getPartById(partId) {
      var part = this.parts ? this.parts.filter(function (aPart) {
        return aPart.id === partId;
      })[0] : null;
      return part || null;
    }

    /**
     * Accepts json-patch operations for modifying recipientStatus.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Object[]} data - Array of operations
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      this._inLayerParser = false;
      if (paths[0].indexOf('recipient_status') === 0) {
        this.__updateRecipientStatus(this.recipientStatus, oldValue);
      }
      this._inLayerParser = true;
    }

    /**
     * Returns absolute URL for this resource.
     * Used by sync manager because the url may not be known
     * at the time the sync request is enqueued.
     *
     * @method _getUrl
     * @param {String} url - relative url and query string parameters
     * @return {String} full url
     * @private
     */

  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        sync = _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), '_setupSyncObject', this).call(this, sync);
        if (!sync.depends) {
          sync.depends = [this.conversationId];
        } else if (sync.depends.indexOf(this.id) === -1) {
          sync.depends.push(this.conversationId);
        }
      }
      return sync;
    }

    /**
     * Get all text parts of the Message.
     *
     * Utility method for extracting all of the text/plain parts
     * and concatenating all of their bodys together into a single string.
     *
     * @method getText
     * @param {string} [joinStr='.  '] If multiple message parts of type text/plain, how do you want them joined together?
     * @return {string}
     */

  }, {
    key: 'getText',
    value: function getText() {
      var joinStr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '. ';

      var textArray = this.parts.filter(function (part) {
        return part.mimeType === 'text/plain';
      }).map(function (part) {
        return part.body;
      });
      textArray = textArray.filter(function (data) {
        return data;
      });
      return textArray.join(joinStr);
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Message instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'toObject', this).call(this);
      }
      return this._toObject;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Message.prototype.__proto__ || Object.getPrototypeOf(Message.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Identifies whether a Message receiving the specified patch data should be loaded from the server.
     *
     * Applies only to Messages that aren't already loaded; used to indicate if a change event is
     * significant enough to load the Message and trigger change events on that Message.
     *
     * At this time there are no properties that are patched on Messages via websockets
     * that would justify loading the Message from the server so as to notify the app.
     *
     * Only recipient status changes and maybe is_unread changes are sent;
     * neither of which are relevant to an app that isn't rendering that message.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }], [{
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return false;
    }
  }]);

  return Message;
}(Syncable);

/**
 * Client that the Message belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @readonly
 */


Message.prototype.clientId = '';

/* Feature is tested but not available on server
 * Conversation ID or Channel ID that this Message belongs to.
 *
 * @type {string}
 * @readonly
 */
Message.prototype.conversationId = '';

/**
 * Array of layer.MessagePart objects.
 *
 * Use layer.Message.addPart to modify this array.
 *
 * @type {layer.MessagePart[]}
 * @readonly
 */
Message.prototype.parts = null;

/**
 * Time that the message was sent.
 *
 *  Note that a locally created layer.Message will have a `sentAt` value even
 * though its not yet sent; this is so that any rendering code doesn't need
 * to account for `null` values.  Sending the Message may cause a slight change
 * in the `sentAt` value.
 *
 * @type {Date}
 * @readonly
 */
Message.prototype.sentAt = null;

/**
 * Time that the first delivery receipt was sent by your
 * user acknowledging receipt of the message.
 * @type {Date}
 * @readonly
 */
Message.prototype.receivedAt = null;

/**
 * Identity object representing the sender of the Message.
 *
 * Most commonly used properties of Identity are:
 * * displayName: A name for your UI
 * * userId: Name for the user as represented on your system
 * * name: Represents the name of a service if the sender was an automated system.
 *
 *      <span class='sent-by'>
 *        {message.sender.displayName || message.sender.name}
 *      </span>
 *
 * @type {layer.Identity}
 * @readonly
 */
Message.prototype.sender = null;

/**
 * Position of this message within the conversation.
 *
 * NOTES:
 *
 * 1. Deleting a message does not affect position of other Messages.
 * 2. A position is not gaurenteed to be unique (multiple messages sent at the same time could
 * all claim the same position)
 * 3. Each successive message within a conversation should expect a higher position.
 *
 * @type {Number}
 * @readonly
 */
Message.prototype.position = 0;

/**
 * Hint used by layer.Client on whether to trigger a messages:notify event.
 *
 * @type {boolean}
 * @private
 */
Message.prototype._notify = false;

/**
 * This property is here for convenience only; it will always be the opposite of isRead.
 * @type {Boolean}
 * @readonly
 */
Object.defineProperty(Message.prototype, 'isUnread', {
  enumerable: true,
  get: function get() {
    return !this.isRead;
  }
});

Message.prototype._toObject = null;

Message.prototype._inPopulateFromServer = false;

Message.eventPrefix = 'messages';

Message.eventPrefix = 'messages';

Message.prefixUUID = 'layer:///messages/';

Message.inObjectIgnore = Syncable.inObjectIgnore;

Message.bubbleEventParent = 'getClient';

Message.imageTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg'];

Message._supportedEvents = [

/**
 * Message has been loaded from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 *
 * ```
 * var m = client.getMessage('layer:///messages/123', true)
 *    .on('messages:loaded', function() {
 *        myrerender(m);
 *    });
 * myrender(m); // render a placeholder for m until the details of m have loaded
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded',

/**
 * The load method failed to load the message from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded-error',

/**
 * Message deleted from the server.
 *
 * Caused by a call to layer.Message.delete() or a websocket event.
 * @param {layer.LayerEvent} evt
 * @event
 */
'messages:delete',

/**
 * Message is about to be sent.
 *
 * Last chance to modify or validate the message prior to sending.
 *
 *     message.on('messages:sending', function(evt) {
 *        message.addPart({mimeType: 'application/location', body: JSON.stringify(getGPSLocation())});
 *     });
 *
 * Typically, you would listen to this event more broadly using `client.on('messages:sending')`
 * which would trigger before sending ANY Messages.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sending',

/**
 * Message has been received by the server.
 *
 * It does NOT indicate delivery to other users.
 *
 * It does NOT indicate messages sent by other users.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sent',

/**
 * Server failed to receive the Message.
 *
 * Message will be deleted immediately after firing this event.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.error
 */
'messages:sent-error',

/**
 * The recipientStatus property has changed.
 *
 * This happens in response to an update
 * from the server... but is also caused by marking the current user as having read
 * or received the message.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Message, [Message, 'Message']);
Syncable.subclasses.push(Message);
module.exports = Message;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVzc2FnZS5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlN5bmNhYmxlIiwiTWVzc2FnZVBhcnQiLCJMYXllckVycm9yIiwiQ29uc3RhbnRzIiwiVXRpbCIsIklkZW50aXR5IiwiTWVzc2FnZSIsIm9wdGlvbnMiLCJmcm9tU2VydmVyIiwiaXNSZWFkIiwiaXNVbnJlYWQiLCJpc191bnJlYWQiLCJpZCIsImNsaWVudCIsImNsaWVudElkIiwiYXBwSWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwicGFydHMiLCJnZXRDbGllbnQiLCJpc0luaXRpYWxpemluZyIsIl9wb3B1bGF0ZUZyb21TZXJ2ZXIiLCJzZW5kZXIiLCJ1c2VyIiwic2VudEF0IiwiRGF0ZSIsImJvZHkiLCJtaW1lVHlwZSIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsInBhcnQiLCJyZXN1bHQiLCJwdXNoIiwibm90aWZpY2F0aW9uIiwiY29udmVyc2F0aW9uIiwiZ2V0Q29udmVyc2F0aW9uIiwiY29udmVyc2F0aW9uTWlzc2luZyIsInN5bmNTdGF0ZSIsIlNZTkNfU1RBVEUiLCJORVciLCJhbHJlYWR5U2VudCIsImlzTG9hZGluZyIsIm9uY2UiLCJjb25zdHJ1Y3RvciIsImV2ZW50UHJlZml4Iiwic2VuZCIsImxlbmd0aCIsInBhcnRzTWlzc2luZyIsIl9zZXRTeW5jaW5nIiwiX3JlYWRBbGxCbG9icyIsIl9hZGRNZXNzYWdlIiwidHJpZ2dlciIsImRhdGEiLCJjb252ZXJzYXRpb25JZCIsIl9wcmVwYXJlUGFydHNGb3JTZW5kaW5nIiwiY2FsbGJhY2siLCJjb3VudCIsImZpbHRlciIsImlzQmxvYiIsImlzVGV4dHVhbE1pbWVUeXBlIiwiZm9yRWFjaCIsImZldGNoVGV4dEZyb21GaWxlIiwidGV4dCIsImluZGV4IiwiZXZ0IiwibWltZV90eXBlIiwiY29udGVudCIsImVuY29kaW5nIiwiX3NlbmQiLCJzZW5kU29ja2V0UmVxdWVzdCIsIm1ldGhvZCIsIm9iamVjdF9pZCIsInN5bmMiLCJkZXBlbmRzIiwidGFyZ2V0Iiwic3VjY2VzcyIsInNvY2tldERhdGEiLCJfc2VuZFJlc3VsdCIsImlzRGVzdHJveWVkIiwiX3RyaWdnZXJBc3luYyIsImVycm9yIiwiZGVzdHJveSIsIl9zZXRTeW5jZWQiLCJuYW1lIiwiY29udGV4dCIsImhhc0xvYWRlZEV2dCIsImNhbGxOb3ciLCJkZWZlciIsImFwcGx5IiwiX3JlbW92ZU1lc3NhZ2UiLCJfX3BhcnRzIiwibWVzc2FnZSIsIl9pblBvcHVsYXRlRnJvbVNlcnZlciIsInVybCIsIm9sZFBvc2l0aW9uIiwicG9zaXRpb24iLCJleGlzdGluZ1BhcnQiLCJnZXRQYXJ0QnlJZCIsIl9jcmVhdGVGcm9tU2VydmVyIiwicmVjaXBpZW50U3RhdHVzIiwicmVjaXBpZW50X3N0YXR1cyIsInNlbnRfYXQiLCJyZWNlaXZlZEF0IiwicmVjZWl2ZWRfYXQiLCJ1bmRlZmluZWQiLCJnZXRJZGVudGl0eSIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJwcm9wZXJ0eSIsInBhcnRJZCIsImFQYXJ0IiwicGF0aHMiLCJfaW5MYXllclBhcnNlciIsImluZGV4T2YiLCJfX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyIsImpvaW5TdHIiLCJ0ZXh0QXJyYXkiLCJqb2luIiwiX3RvT2JqZWN0IiwiZXZ0TmFtZSIsImFyZ3MiLCJfY2xlYXJPYmplY3QiLCJwYXRjaERhdGEiLCJwcm90b3R5cGUiLCJfbm90aWZ5IiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiZ2V0IiwicHJlZml4VVVJRCIsImluT2JqZWN0SWdub3JlIiwiYnViYmxlRXZlbnRQYXJlbnQiLCJpbWFnZVR5cGVzIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsInN1YmNsYXNzZXMiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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QTJCOztBQUV6Qjs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxpQkFsQnlCOztBQW9CekI7Ozs7Ozs7QUFPQSx1QkEzQnlCOztBQTZCekI7Ozs7Ozs7QUFPQSxpQkFwQ3lCOztBQXNDekI7Ozs7Ozs7Ozs7Ozs7OztBQWVBLGtCQXJEeUI7O0FBdUR6Qjs7Ozs7Ozs7OztBQVVBLGVBakV5Qjs7QUFtRXpCOzs7Ozs7Ozs7QUFTQSxxQkE1RXlCOztBQThFekI7Ozs7Ozs7OztBQVNBLGlCQXZGeUIsRUEwRnpCQyxNQTFGeUIsQ0EwRmxCeEksU0FBU3VJLGdCQTFGUyxDQUEzQjs7QUE0RkF6SSxLQUFLMkksU0FBTCxDQUFlL0MsS0FBZixDQUFxQnBGLE9BQXJCLEVBQThCLENBQUNBLE9BQUQsRUFBVSxTQUFWLENBQTlCO0FBQ0FOLFNBQVMwSSxVQUFULENBQW9CeEcsSUFBcEIsQ0FBeUI1QixPQUF6QjtBQUNBcUksT0FBT0MsT0FBUCxHQUFpQnRJLE9BQWpCIiwiZmlsZSI6Im1lc3NhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBNZXNzYWdlIENsYXNzIHJlcHJlc2VudHMgTWVzc2FnZXMgc2VudCBhbW9uZ3N0IHBhcnRpY2lwYW50c1xuICogb2Ygb2YgYSBDb252ZXJzYXRpb24uXG4gKlxuICogVGhlIHNpbXBsZXN0IHdheSB0byBjcmVhdGUgYW5kIHNlbmQgYSBtZXNzYWdlIGlzOlxuICpcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnSGVsbG8gdGhlcmUnKS5zZW5kKCk7XG4gKiAgICAgIHZhciBtID0gY2hhbm5lbC5jcmVhdGVNZXNzYWdlKCdIZWxsbyB0aGVyZScpLnNlbmQoKTtcbiAqXG4gKiBGb3IgY29udmVyc2F0aW9ucyB0aGF0IGludm9sdmUgbm90aWZpY2F0aW9ucyAocHJpbWFyaWx5IGZvciBBbmRyb2lkIGFuZCBJT1MpLCB0aGUgbW9yZSBjb21tb24gcGF0dGVybiBpczpcbiAqXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvIHRoZXJlJykuc2VuZCh7dGV4dDogXCJNZXNzYWdlIGZyb20gRnJlZDogSGVsbG8gdGhlcmVcIn0pO1xuICpcbiAqIENoYW5uZWxzIGRvIG5vdCBhdCB0aGlzIHRpbWUgc3VwcG9ydCBub3RpZmljYXRpb25zLlxuICpcbiAqIFR5cGljYWxseSwgcmVuZGVyaW5nIHdvdWxkIGJlIGRvbmUgYXMgZm9sbG93czpcbiAqXG4gKiAgICAgIC8vIENyZWF0ZSBhIGxheWVyLlF1ZXJ5IHRoYXQgbG9hZHMgTWVzc2FnZXMgZm9yIHRoZVxuICogICAgICAvLyBzcGVjaWZpZWQgQ29udmVyc2F0aW9uLlxuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIG1vZGVsOiBRdWVyeS5NZXNzYWdlLFxuICogICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbiA9IFwiJyArIGNvbnZlcnNhdGlvbi5pZCArICdcIidcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBBbnkgdGltZSB0aGUgUXVlcnkncyBkYXRhIGNoYW5nZXMgdGhlICdjaGFuZ2UnXG4gKiAgICAgIC8vIGV2ZW50IHdpbGwgZmlyZS5cbiAqICAgICAgcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGxheWVyRXZ0KSB7XG4gKiAgICAgICAgcmVuZGVyTmV3TWVzc2FnZXMocXVlcnkuZGF0YSk7XG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gVGhpcyB3aWxsIGNhbGwgd2lsbCBjYXVzZSB0aGUgYWJvdmUgZXZlbnQgaGFuZGxlciB0byByZWNlaXZlXG4gKiAgICAgIC8vIGEgY2hhbmdlIGV2ZW50LCBhbmQgd2lsbCB1cGRhdGUgcXVlcnkuZGF0YS5cbiAqICAgICAgY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvIHRoZXJlJykuc2VuZCgpO1xuICpcbiAqIFRoZSBhYm92ZSBjb2RlIHdpbGwgdHJpZ2dlciB0aGUgZm9sbG93aW5nIGV2ZW50czpcbiAqXG4gKiAgKiBNZXNzYWdlIEluc3RhbmNlIGZpcmVzXG4gKiAgICAqIG1lc3NhZ2VzOnNlbmRpbmc6IEFuIGV2ZW50IHRoYXQgbGV0cyB5b3UgbW9kaWZ5IHRoZSBtZXNzYWdlIHByaW9yIHRvIHNlbmRpbmdcbiAqICAgICogbWVzc2FnZXM6c2VudDogVGhlIG1lc3NhZ2Ugd2FzIHJlY2VpdmVkIGJ5IHRoZSBzZXJ2ZXJcbiAqICAqIFF1ZXJ5IEluc3RhbmNlIGZpcmVzXG4gKiAgICAqIGNoYW5nZTogVGhlIHF1ZXJ5IGhhcyByZWNlaXZlZCBhIG5ldyBNZXNzYWdlXG4gKiAgICAqIGNoYW5nZTphZGQ6IFNhbWUgYXMgdGhlIGNoYW5nZSBldmVudCBidXQgZG9lcyBub3QgcmVjZWl2ZSBvdGhlciB0eXBlcyBvZiBjaGFuZ2UgZXZlbnRzXG4gKlxuICogV2hlbiBjcmVhdGluZyBhIE1lc3NhZ2UgdGhlcmUgYXJlIGEgbnVtYmVyIG9mIHdheXMgdG8gc3RydWN0dXJlIGl0LlxuICogQWxsIG9mIHRoZXNlIGFyZSB2YWxpZCBhbmQgY3JlYXRlIHRoZSBzYW1lIGV4YWN0IE1lc3NhZ2U6XG4gKlxuICogICAgICAvLyBGdWxsIEFQSSBzdHlsZTpcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogW25ldyBsYXllci5NZXNzYWdlUGFydCh7XG4gKiAgICAgICAgICAgICAgYm9keTogJ0hlbGxvIHRoZXJlJyxcbiAqICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gKiAgICAgICAgICB9KV1cbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gMTogUGFzcyBpbiBhbiBPYmplY3QgaW5zdGVhZCBvZiBhbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydHNcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czoge1xuICogICAgICAgICAgICAgIGJvZHk6ICdIZWxsbyB0aGVyZScsXG4gKiAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICogICAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiAyOiBQYXNzIGluIGFuIGFycmF5IG9mIE9iamVjdHMgaW5zdGVhZCBvZiBhbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydHNcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogW3tcbiAqICAgICAgICAgICAgICBib2R5OiAnSGVsbG8gdGhlcmUnLFxuICogICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAqICAgICAgICAgIH1dXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDM6IFBhc3MgaW4gYSBzdHJpbmcgKGF1dG9tYXRpY2FsbHkgYXNzdW1lcyBtaW1lVHlwZSBpcyB0ZXh0L3BsYWluKVxuICogICAgICAvLyBpbnN0ZWFkIG9mIGFuIGFycmF5IG9mIG9iamVjdHMuXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6ICdIZWxsbydcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gNDogUGFzcyBpbiBhbiBhcnJheSBvZiBzdHJpbmdzIChhdXRvbWF0aWNhbGx5IGFzc3VtZXMgbWltZVR5cGUgaXMgdGV4dC9wbGFpbilcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogWydIZWxsbyddXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDU6IFBhc3MgaW4ganVzdCBhIHN0cmluZyBhbmQgbm90aGluZyBlbHNlXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvJyk7XG4gKlxuICogICAgICAvLyBPcHRpb24gNjogVXNlIGFkZFBhcnQuXG4gKiAgICAgIHZhciBtID0gY29udmVyc2VhdGlvbi5jcmVhdGVNZXNzYWdlKCk7XG4gKiAgICAgIG0uYWRkUGFydCh7Ym9keTogXCJoZWxsb1wiLCBtaW1lVHlwZTogXCJ0ZXh0L3BsYWluXCJ9KTtcbiAqXG4gKiBLZXkgbWV0aG9kcywgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIGZvciBnZXR0aW5nIHN0YXJ0ZWQ6XG4gKlxuICogUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLk1lc3NhZ2UuaWQ6IHRoaXMgcHJvcGVydHkgaXMgd29ydGggYmVpbmcgZmFtaWxpYXIgd2l0aDsgaXQgaWRlbnRpZmllcyB0aGVcbiAqICAgTWVzc2FnZSBhbmQgY2FuIGJlIHVzZWQgaW4gYGNsaWVudC5nZXRNZXNzYWdlKGlkKWAgdG8gcmV0cmlldmUgaXRcbiAqICAgYXQgYW55IHRpbWUuXG4gKiAqIGxheWVyLk1lc3NhZ2UuaW50ZXJuYWxJZDogVGhpcyBwcm9wZXJ0eSBtYWtlcyBmb3IgYSBoYW5keSB1bmlxdWUgSUQgZm9yIHVzZSBpbiBkb20gbm9kZXMuXG4gKiAgIEl0IGlzIGdhdXJlbnRlZWQgbm90IHRvIGNoYW5nZSBkdXJpbmcgdGhpcyBzZXNzaW9uLlxuICogKiBsYXllci5NZXNzYWdlLmlzUmVhZDogSW5kaWNhdGVzIGlmIHRoZSBNZXNzYWdlIGhhcyBiZWVuIHJlYWQgeWV0OyBzZXQgYG0uaXNSZWFkID0gdHJ1ZWBcbiAqICAgdG8gdGVsbCB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIgdGhhdCB0aGUgbWVzc2FnZSBoYXMgYmVlbiByZWFkLlxuICogKiBsYXllci5NZXNzYWdlLnBhcnRzOiBBbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydCBjbGFzc2VzIHJlcHJlc2VudGluZyB0aGUgY29udGVudHMgb2YgdGhlIE1lc3NhZ2UuXG4gKiAqIGxheWVyLk1lc3NhZ2Uuc2VudEF0OiBEYXRlIHRoZSBtZXNzYWdlIHdhcyBzZW50XG4gKiAqIGxheWVyLk1lc3NhZ2Uuc2VuZGVyIGB1c2VySWRgOiBDb252ZXJzYXRpb24gcGFydGljaXBhbnQgd2hvIHNlbnQgdGhlIE1lc3NhZ2UuIFlvdSBtYXlcbiAqICAgbmVlZCB0byBkbyBhIGxvb2t1cCBvbiB0aGlzIGlkIGluIHlvdXIgb3duIHNlcnZlcnMgdG8gZmluZCBhXG4gKiAgIGRpc3BsYXlhYmxlIG5hbWUgZm9yIGl0LlxuICpcbiAqIE1ldGhvZHM6XG4gKlxuICogKiBsYXllci5NZXNzYWdlLnNlbmQoKTogU2VuZHMgdGhlIG1lc3NhZ2UgdG8gdGhlIHNlcnZlciBhbmQgdGhlIG90aGVyIHBhcnRpY2lwYW50cy5cbiAqICogbGF5ZXIuTWVzc2FnZS5vbigpIGFuZCBsYXllci5NZXNzYWdlLm9mZigpOyBldmVudCBsaXN0ZW5lcnMgYnVpbHQgb24gdG9wIG9mIHRoZSBgYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmVgIG5wbSBwcm9qZWN0XG4gKlxuICogRXZlbnRzOlxuICpcbiAqICogYG1lc3NhZ2VzOnNlbnRgOiBUaGUgbWVzc2FnZSBoYXMgYmVlbiByZWNlaXZlZCBieSB0aGUgc2VydmVyLiBDYW4gYWxzbyBzdWJzY3JpYmUgdG9cbiAqICAgdGhpcyBldmVudCBmcm9tIHRoZSBsYXllci5DbGllbnQgd2hpY2ggaXMgdXN1YWxseSBzaW1wbGVyLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuTWVzc2FnZVxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBNZXNzYWdlUGFydCA9IHJlcXVpcmUoJy4vbWVzc2FnZS1wYXJ0Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBJZGVudGl0eSA9IHJlcXVpcmUoJy4vaWRlbnRpdHknKTtcblxuY2xhc3MgTWVzc2FnZSBleHRlbmRzIFN5bmNhYmxlIHtcbiAgLyoqXG4gICAqIFNlZSBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgpXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFVubGVzcyB0aGlzIGlzIGEgc2VydmVyIHJlcHJlc2VudGF0aW9uLCB0aGlzIGlzIGEgZGV2ZWxvcGVyJ3Mgc2hvcnRoYW5kO1xuICAgIC8vIGZpbGwgaW4gdGhlIG1pc3NpbmcgcHJvcGVydGllcyBhcm91bmQgaXNSZWFkL2lzVW5yZWFkIGJlZm9yZSBpbml0aWFsaXppbmcuXG4gICAgaWYgKCFvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIGlmICgnaXNVbnJlYWQnIGluIG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucy5pc1JlYWQgPSAhb3B0aW9ucy5pc1VucmVhZCAmJiAhb3B0aW9ucy5pc191bnJlYWQ7XG4gICAgICAgIGRlbGV0ZSBvcHRpb25zLmlzVW5yZWFkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5pc1JlYWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zLmlkID0gb3B0aW9ucy5mcm9tU2VydmVyLmlkO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmNsaWVudCkgb3B0aW9ucy5jbGllbnRJZCA9IG9wdGlvbnMuY2xpZW50LmFwcElkO1xuICAgIGlmICghb3B0aW9ucy5jbGllbnRJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcblxuICAgIC8vIEluc3VyZSBfX2FkanVzdFBhcnRzIGlzIHNldCBBRlRFUiBjbGllbnRJZCBpcyBzZXQuXG4gICAgY29uc3QgcGFydHMgPSBvcHRpb25zLnBhcnRzO1xuICAgIG9wdGlvbnMucGFydHMgPSBudWxsO1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5wYXJ0cyA9IHBhcnRzO1xuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihvcHRpb25zLmZyb21TZXJ2ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2xpZW50KSB0aGlzLnNlbmRlciA9IGNsaWVudC51c2VyO1xuICAgICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZSgpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5wYXJ0cykgdGhpcy5wYXJ0cyA9IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFR1cm4gaW5wdXQgaW50byB2YWxpZCBsYXllci5NZXNzYWdlUGFydHMuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGFueSB0aW1lIHRoZSBwYXJ0c1xuICAgKiBwcm9wZXJ0eSBpcyBzZXQgKGluY2x1ZGluZyBkdXJpbmcgaW50aWFsaXphdGlvbikuICBUaGlzXG4gICAqIGlzIHdoZXJlIHdlIGNvbnZlcnQgc3RyaW5ncyBpbnRvIE1lc3NhZ2VQYXJ0cywgYW5kIGluc3RhbmNlc1xuICAgKiBpbnRvIGFycmF5cy5cbiAgICpcbiAgICogQG1ldGhvZCBfX2FkanVzdFBhcnRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge01peGVkfSBwYXJ0cyAtLSBDb3VsZCBiZSBhIHN0cmluZywgYXJyYXksIG9iamVjdCBvciBNZXNzYWdlUGFydCBpbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlUGFydFtdfVxuICAgKi9cbiAgX19hZGp1c3RQYXJ0cyhwYXJ0cykge1xuICAgIGlmICh0eXBlb2YgcGFydHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gW25ldyBNZXNzYWdlUGFydCh7XG4gICAgICAgIGJvZHk6IHBhcnRzLFxuICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIH0pXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgICByZXR1cm4gcGFydHMubWFwKChwYXJ0KSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIGlmIChwYXJ0IGluc3RhbmNlb2YgTWVzc2FnZVBhcnQpIHtcbiAgICAgICAgICByZXN1bHQgPSBwYXJ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBNZXNzYWdlUGFydChwYXJ0KTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChwYXJ0cyAmJiB0eXBlb2YgcGFydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICBwYXJ0cy5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgICByZXR1cm4gW25ldyBNZXNzYWdlUGFydChwYXJ0cyldO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFkZCBhIGxheWVyLk1lc3NhZ2VQYXJ0IHRvIHRoaXMgTWVzc2FnZS5cbiAgICpcbiAgICogU2hvdWxkIG9ubHkgYmUgY2FsbGVkIG9uIGFuIHVuc2VudCBNZXNzYWdlLlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZS5hZGRQYXJ0KHttaW1lVHlwZTogJ3RleHQvcGxhaW4nLCBib2R5OiAnRnJvZG8gcmVhbGx5IGlzIGEgRG9kbyd9KTtcbiAgICpcbiAgICogLy8gT1JcbiAgICogbWVzc2FnZS5hZGRQYXJ0KG5ldyBsYXllci5NZXNzYWdlUGFydCh7bWltZVR5cGU6ICd0ZXh0L3BsYWluJywgYm9keTogJ0Zyb2RvIHJlYWxseSBpcyBhIERvZG8nfSkpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBhZGRQYXJ0XG4gICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2VQYXJ0L09iamVjdH0gcGFydCAtIEEgbGF5ZXIuTWVzc2FnZVBhcnQgaW5zdGFuY2Ugb3IgYSBge21pbWVUeXBlOiAndGV4dC9wbGFpbicsIGJvZHk6ICdIZWxsbyd9YCBmb3JtYXR0ZWQgT2JqZWN0LlxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgYWRkUGFydChwYXJ0KSB7XG4gICAgaWYgKHBhcnQpIHtcbiAgICAgIHBhcnQuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgICAgaWYgKHBhcnQgaW5zdGFuY2VvZiBNZXNzYWdlUGFydCkge1xuICAgICAgICB0aGlzLnBhcnRzLnB1c2gocGFydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBwYXJ0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLnBhcnRzLnB1c2gobmV3IE1lc3NhZ2VQYXJ0KHBhcnQpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCB0aGUgbWVzc2FnZSB0byBhbGwgcGFydGljaXBhbnRzIG9mIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIE1lc3NhZ2UgbXVzdCBoYXZlIHBhcnRzIGFuZCBhIHZhbGlkIGNvbnZlcnNhdGlvbiB0byBzZW5kIHN1Y2Nlc3NmdWxseS5cbiAgICpcbiAgICogVGhlIHNlbmQgbWV0aG9kIHRha2VzIGEgYG5vdGlmaWNhdGlvbmAgb2JqZWN0LiBJbiBub3JtYWwgdXNlLCBpdCBwcm92aWRlcyB0aGUgc2FtZSBub3RpZmljYXRpb24gdG8gQUxMXG4gICAqIHJlY2lwaWVudHMsIGJ1dCB5b3UgY2FuIGN1c3RvbWl6ZSBub3RpZmljYXRpb25zIG9uIGEgcGVyIHJlY2lwaWVudCBiYXNpcywgYXMgd2VsbCBhcyBlbWJlZCBhY3Rpb25zIGludG8gdGhlIG5vdGlmaWNhdGlvbi5cbiAgICogRm9yIHRoZSBGdWxsIEFQSSwgc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL3BsYXRmb3JtL21lc3NhZ2VzI25vdGlmaWNhdGlvbi1jdXN0b21pemF0aW9uLlxuICAgKlxuICAgKiBGb3IgdGhlIEZ1bGwgQVBJLCBzZWUgW1NlcnZlciBEb2NzXShodHRwczovL2RldmVsb3Blci5sYXllci5jb20vZG9jcy9wbGF0Zm9ybS9tZXNzYWdlcyNub3RpZmljYXRpb24tY3VzdG9taXphdGlvbikuXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlLnNlbmQoe1xuICAgKiAgICB0aXRsZTogXCJOZXcgSG9iYml0IE1lc3NhZ2VcIixcbiAgICogICAgdGV4dDogXCJGcm9kby10aGUtRG9kbzogSGVsbG8gU2FtLCB3aGF0IHNheSB3ZSB3YWx0eiBpbnRvIE1vcmRvciBsaWtlIHdlIG93biB0aGUgcGxhY2U/XCIsXG4gICAqICAgIHNvdW5kOiBcIndoaW55aG9iYml0LmFpZmZcIlxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcGFyYW0ge09iamVjdH0gW25vdGlmaWNhdGlvbl0gLSBQYXJhbWV0ZXJzIGZvciBjb250cm9saW5nIGhvdyB0aGUgcGhvbmVzIG1hbmFnZSBub3RpZmljYXRpb25zIG9mIHRoZSBuZXcgTWVzc2FnZS5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgIFNlZSBJT1MgYW5kIEFuZHJvaWQgZG9jcyBmb3IgZGV0YWlscy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtub3RpZmljYXRpb24udGl0bGVdIC0gVGl0bGUgdG8gc2hvdyBvbiBsb2NrIHNjcmVlbiBhbmQgbm90aWZpY2F0aW9uIGJhclxuICAgKiBAcGFyYW0ge3N0cmluZ30gW25vdGlmaWNhdGlvbi50ZXh0XSAtIFRleHQgb2YgeW91ciBub3RpZmljYXRpb25cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtub3RpZmljYXRpb24uc291bmRdIC0gTmFtZSBvZiBhbiBhdWRpbyBmaWxlIG9yIG90aGVyIHNvdW5kLXJlbGF0ZWQgaGludFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfSB0aGlzXG4gICAqL1xuICBzZW5kKG5vdGlmaWNhdGlvbikge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24odHJ1ZSk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jb252ZXJzYXRpb25NaXNzaW5nKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zeW5jU3RhdGUgIT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hbHJlYWR5U2VudCk7XG4gICAgfVxuXG5cbiAgICBpZiAoY29udmVyc2F0aW9uLmlzTG9hZGluZykge1xuICAgICAgY29udmVyc2F0aW9uLm9uY2UoY29udmVyc2F0aW9uLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpsb2FkZWQnLCAoKSA9PiB0aGlzLnNlbmQobm90aWZpY2F0aW9uKSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucGFydHMgfHwgIXRoaXMucGFydHMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnBhcnRzTWlzc2luZyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2V0U3luY2luZygpO1xuXG4gICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIENvbnZlcnNhdGlvbiBoYXMgYmVlbiBjcmVhdGVkIG9uIHRoZSBzZXJ2ZXJcbiAgICAvLyBhbmQgdXBkYXRlIHRoZSBsYXN0TWVzc2FnZSBwcm9wZXJ0eVxuICAgIGNvbnZlcnNhdGlvbi5zZW5kKHRoaXMpO1xuXG4gICAgLy8gSWYgd2UgYXJlIHNlbmRpbmcgYW55IEZpbGUvQmxvYiBvYmplY3RzLCBhbmQgdGhlaXIgTWltZSBUeXBlcyBtYXRjaCBvdXIgdGVzdCxcbiAgICAvLyB3YWl0IHVudGlsIHRoZSBib2R5IGlzIHVwZGF0ZWQgdG8gYmUgYSBzdHJpbmcgcmF0aGVyIHRoYW4gRmlsZSBiZWZvcmUgY2FsbGluZyBfYWRkTWVzc2FnZVxuICAgIC8vIHdoaWNoIHdpbGwgYWRkIGl0IHRvIHRoZSBRdWVyeSBSZXN1bHRzIGFuZCBwYXNzIHRoaXMgb24gdG8gYSByZW5kZXJlciB0aGF0IGV4cGVjdHMgXCJ0ZXh0L3BsYWluXCIgdG8gYmUgYSBzdHJpbmdcbiAgICAvLyByYXRoZXIgdGhhbiBhIGJsb2IuXG4gICAgdGhpcy5fcmVhZEFsbEJsb2JzKCgpID0+IHtcbiAgICAgIC8vIENhbGxpbmcgdGhpcyB3aWxsIGFkZCB0aGlzIHRvIGFueSBsaXN0ZW5pbmcgUXVlcmllcy4uLiBzbyBwb3NpdGlvbiBuZWVkcyB0byBoYXZlIGJlZW4gc2V0IGZpcnN0O1xuICAgICAgLy8gaGFuZGxlZCBpbiBjb252ZXJzYXRpb24uc2VuZCh0aGlzKVxuICAgICAgY2xpZW50Ll9hZGRNZXNzYWdlKHRoaXMpO1xuXG4gICAgICAvLyBhbGxvdyBmb3IgbW9kaWZpY2F0aW9uIG9mIG1lc3NhZ2UgYmVmb3JlIHNlbmRpbmdcbiAgICAgIHRoaXMudHJpZ2dlcignbWVzc2FnZXM6c2VuZGluZycpO1xuXG4gICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICBwYXJ0czogbmV3IEFycmF5KHRoaXMucGFydHMubGVuZ3RoKSxcbiAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICB9O1xuICAgICAgaWYgKG5vdGlmaWNhdGlvbiAmJiB0aGlzLmNvbnZlcnNhdGlvbklkKSBkYXRhLm5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbjtcblxuICAgICAgdGhpcy5fcHJlcGFyZVBhcnRzRm9yU2VuZGluZyhkYXRhKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBbnkgTWVzc2FnZVBhcnQgdGhhdCBjb250YWlucyBhIHRleHR1YWwgYmxvYiBzaG91bGQgY29udGFpbiBhIHN0cmluZyBiZWZvcmUgd2Ugc2VuZC5cbiAgICpcbiAgICogSWYgYSBNZXNzYWdlUGFydCB3aXRoIGEgQmxvYiBvciBGaWxlIGFzIGl0cyBib2R5IHdlcmUgdG8gYmUgYWRkZWQgdG8gdGhlIENsaWVudCxcbiAgICogVGhlIFF1ZXJ5IHdvdWxkIHJlY2VpdmUgdGhpcywgZGVsaXZlciBpdCB0byBhcHBzIGFuZCB0aGUgYXBwIHdvdWxkIGNyYXNoLlxuICAgKiBNb3N0IHJlbmRlcmluZyBjb2RlIGV4cGVjdGluZyB0ZXh0L3BsYWluIHdvdWxkIGV4cGVjdCBhIHN0cmluZyBub3QgYSBGaWxlLlxuICAgKlxuICAgKiBXaGVuIHRoaXMgdXNlciBpcyBzZW5kaW5nIGEgZmlsZSwgYW5kIHRoYXQgZmlsZSBpcyB0ZXh0dWFsLCBtYWtlIHN1cmVcbiAgICogaXRzIGFjdHVhbCB0ZXh0IGRlbGl2ZXJlZCB0byB0aGUgVUkuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlYWRBbGxCbG9ic1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3JlYWRBbGxCbG9icyhjYWxsYmFjaykge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgY29uc3QgcGFydHMgPSB0aGlzLnBhcnRzLmZpbHRlcihwYXJ0ID0+IFV0aWwuaXNCbG9iKHBhcnQuYm9keSkgJiYgcGFydC5pc1RleHR1YWxNaW1lVHlwZSgpKTtcbiAgICBwYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICBVdGlsLmZldGNoVGV4dEZyb21GaWxlKHBhcnQuYm9keSwgKHRleHQpID0+IHtcbiAgICAgICAgcGFydC5ib2R5ID0gdGV4dDtcbiAgICAgICAgY291bnQrKztcbiAgICAgICAgaWYgKGNvdW50ID09PSBwYXJ0cy5sZW5ndGgpIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoIXBhcnRzLmxlbmd0aCkgY2FsbGJhY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN1cmVzIHRoYXQgZWFjaCBwYXJ0IGlzIHJlYWR5IHRvIHNlbmQgYmVmb3JlIGFjdHVhbGx5IHNlbmRpbmcgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3ByZXBhcmVQYXJ0c0ZvclNlbmRpbmdcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBzdHJ1Y3R1cmUgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyXG4gICAqL1xuICBfcHJlcGFyZVBhcnRzRm9yU2VuZGluZyhkYXRhKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBsZXQgY291bnQgPSAwO1xuICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCwgaW5kZXgpID0+IHtcbiAgICAgIHBhcnQub25jZSgncGFydHM6c2VuZCcsIChldnQpID0+IHtcbiAgICAgICAgZGF0YS5wYXJ0c1tpbmRleF0gPSB7XG4gICAgICAgICAgbWltZV90eXBlOiBldnQubWltZV90eXBlLFxuICAgICAgICB9O1xuICAgICAgICBpZiAoZXZ0LmNvbnRlbnQpIGRhdGEucGFydHNbaW5kZXhdLmNvbnRlbnQgPSBldnQuY29udGVudDtcbiAgICAgICAgaWYgKGV2dC5ib2R5KSBkYXRhLnBhcnRzW2luZGV4XS5ib2R5ID0gZXZ0LmJvZHk7XG4gICAgICAgIGlmIChldnQuZW5jb2RpbmcpIGRhdGEucGFydHNbaW5kZXhdLmVuY29kaW5nID0gZXZ0LmVuY29kaW5nO1xuXG4gICAgICAgIGNvdW50Kys7XG4gICAgICAgIGlmIChjb3VudCA9PT0gdGhpcy5wYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLl9zZW5kKGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9LCB0aGlzKTtcbiAgICAgIHBhcnQuX3NlbmQoY2xpZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgdGhlIGFjdHVhbCBzZW5kaW5nLlxuICAgKlxuICAgKiBsYXllci5NZXNzYWdlLnNlbmQgaGFzIHNvbWUgcG90ZW50aWFsbHkgYXN5bmNocm9ub3VzXG4gICAqIHByZXByb2Nlc3NpbmcgdG8gZG8gYmVmb3JlIHNlbmRpbmcgKFJpY2ggQ29udGVudCk7IGFjdHVhbCBzZW5kaW5nXG4gICAqIGlzIGRvbmUgaGVyZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NlbmQoZGF0YSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuXG4gICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZSgpO1xuICAgIGNsaWVudC5zZW5kU29ja2V0UmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgbWV0aG9kOiAnTWVzc2FnZS5jcmVhdGUnLFxuICAgICAgICBvYmplY3RfaWQ6IGNvbnZlcnNhdGlvbi5pZCxcbiAgICAgICAgZGF0YSxcbiAgICAgIH0sXG4gICAgICBzeW5jOiB7XG4gICAgICAgIGRlcGVuZHM6IFt0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLmlkXSxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLmlkLFxuICAgICAgfSxcbiAgICB9LCAoc3VjY2Vzcywgc29ja2V0RGF0YSkgPT4gdGhpcy5fc2VuZFJlc3VsdChzdWNjZXNzLCBzb2NrZXREYXRhKSk7XG4gIH1cblxuICBfZ2V0U2VuZERhdGEoZGF0YSkge1xuICAgIGRhdGEub2JqZWN0X2lkID0gdGhpcy5jb252ZXJzYXRpb25JZDtcbiAgICByZXR1cm4gZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgICogbGF5ZXIuTWVzc2FnZS5zZW5kKCkgU3VjY2VzcyBDYWxsYmFjay5cbiAgICAqXG4gICAgKiBJZiBzdWNjZXNzZnVsbHkgc2VuZGluZyB0aGUgbWVzc2FnZTsgdHJpZ2dlcnMgYSAnc2VudCcgZXZlbnQsXG4gICAgKiBhbmQgdXBkYXRlcyB0aGUgbWVzc2FnZS5pZC91cmxcbiAgICAqXG4gICAgKiBAbWV0aG9kIF9zZW5kUmVzdWx0XG4gICAgKiBAcHJpdmF0ZVxuICAgICogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2VEYXRhIC0gU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAgKi9cbiAgX3NlbmRSZXN1bHQoeyBzdWNjZXNzLCBkYXRhIH0pIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihkYXRhKTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6c2VudCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ21lc3NhZ2VzOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuICB9XG5cbiAgLyogTk9UIEZPUiBKU0RVQ0tcbiAgICogU3RhbmRhcmQgYG9uKClgIHByb3ZpZGVkIGJ5IGxheWVyLlJvb3QuXG4gICAqXG4gICAqIEFkZHMgc29tZSBzcGVjaWFsIGhhbmRsaW5nIG9mICdtZXNzYWdlczpsb2FkZWQnIHNvIHRoYXQgY2FsbHMgc3VjaCBhc1xuICAgKlxuICAgKiAgICAgIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UoJ2xheWVyOi8vL21lc3NhZ2VzLzEyMycsIHRydWUpXG4gICAqICAgICAgLm9uKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgbXlyZXJlbmRlcihtKTtcbiAgICogICAgICB9KTtcbiAgICogICAgICBteXJlbmRlcihtKTsgLy8gcmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIG0gdW50aWwgdGhlIGRldGFpbHMgb2YgbSBoYXZlIGxvYWRlZFxuICAgKlxuICAgKiBjYW4gZmlyZSB0aGVpciBjYWxsYmFjayByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGNsaWVudCBsb2FkcyBvciBoYXNcbiAgICogYWxyZWFkeSBsb2FkZWQgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGV2ZW50SGFuZGxlclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnRleHRcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBjb25zdCBoYXNMb2FkZWRFdnQgPSBuYW1lID09PSAnbWVzc2FnZXM6bG9hZGVkJyB8fFxuICAgICAgKG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmIG5hbWVbJ21lc3NhZ2VzOmxvYWRlZCddKTtcblxuICAgIGlmIChoYXNMb2FkZWRFdnQgJiYgIXRoaXMuaXNMb2FkaW5nKSB7XG4gICAgICBjb25zdCBjYWxsTm93ID0gbmFtZSA9PT0gJ21lc3NhZ2VzOmxvYWRlZCcgPyBjYWxsYmFjayA6IG5hbWVbJ21lc3NhZ2VzOmxvYWRlZCddO1xuICAgICAgVXRpbC5kZWZlcigoKSA9PiBjYWxsTm93LmFwcGx5KGNvbnRleHQpKTtcbiAgICB9XG4gICAgc3VwZXIub24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGlzIE1lc3NhZ2UgZnJvbSB0aGUgc3lzdGVtLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgZGVyZWdpc3RlciB0aGUgTWVzc2FnZSwgcmVtb3ZlIGFsbCBldmVudHNcbiAgICogYW5kIGFsbG93IGdhcmJhZ2UgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkgY2xpZW50Ll9yZW1vdmVNZXNzYWdlKHRoaXMpO1xuICAgIHRoaXMucGFydHMuZm9yRWFjaChwYXJ0ID0+IHBhcnQuZGVzdHJveSgpKTtcbiAgICB0aGlzLl9fcGFydHMgPSBudWxsO1xuXG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBvcHVsYXRlcyB0aGlzIGluc3RhbmNlIHdpdGggdGhlIGRlc2NyaXB0aW9uIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FuIGJlIHVzZWQgZm9yIGNyZWF0aW5nIG9yIGZvciB1cGRhdGluZyB0aGUgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gbSAtIFNlcnZlciBkZXNjcmlwdGlvbiBvZiB0aGUgbWVzc2FnZVxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihtZXNzYWdlKSB7XG4gICAgdGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIgPSB0cnVlO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICB0aGlzLmlkID0gbWVzc2FnZS5pZDtcbiAgICB0aGlzLnVybCA9IG1lc3NhZ2UudXJsO1xuICAgIGNvbnN0IG9sZFBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbjtcbiAgICB0aGlzLnBvc2l0aW9uID0gbWVzc2FnZS5wb3NpdGlvbjtcblxuXG4gICAgLy8gQXNzaWduIElEcyB0byBwcmVleGlzdGluZyBQYXJ0cyBzbyB0aGF0IHdlIGNhbiBjYWxsIGdldFBhcnRCeUlkKClcbiAgICBpZiAodGhpcy5wYXJ0cykge1xuICAgICAgdGhpcy5wYXJ0cy5mb3JFYWNoKChwYXJ0LCBpbmRleCkgPT4ge1xuICAgICAgICBpZiAoIXBhcnQuaWQpIHBhcnQuaWQgPSBgJHt0aGlzLmlkfS9wYXJ0cy8ke2luZGV4fWA7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnBhcnRzID0gbWVzc2FnZS5wYXJ0cy5tYXAoKHBhcnQpID0+IHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nUGFydCA9IHRoaXMuZ2V0UGFydEJ5SWQocGFydC5pZCk7XG4gICAgICBpZiAoZXhpc3RpbmdQYXJ0KSB7XG4gICAgICAgIGV4aXN0aW5nUGFydC5fcG9wdWxhdGVGcm9tU2VydmVyKHBhcnQpO1xuICAgICAgICByZXR1cm4gZXhpc3RpbmdQYXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIE1lc3NhZ2VQYXJ0Ll9jcmVhdGVGcm9tU2VydmVyKHBhcnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWNpcGllbnRTdGF0dXMgPSBtZXNzYWdlLnJlY2lwaWVudF9zdGF0dXMgfHwge307XG5cbiAgICB0aGlzLmlzUmVhZCA9ICdpc191bnJlYWQnIGluIG1lc3NhZ2UgPyAhbWVzc2FnZS5pc191bnJlYWQgOiB0cnVlO1xuXG4gICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZShtZXNzYWdlLnNlbnRfYXQpO1xuICAgIHRoaXMucmVjZWl2ZWRBdCA9IG1lc3NhZ2UucmVjZWl2ZWRfYXQgPyBuZXcgRGF0ZShtZXNzYWdlLnJlY2VpdmVkX2F0KSA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBzZW5kZXI7XG4gICAgaWYgKG1lc3NhZ2Uuc2VuZGVyLmlkKSB7XG4gICAgICBzZW5kZXIgPSBjbGllbnQuZ2V0SWRlbnRpdHkobWVzc2FnZS5zZW5kZXIuaWQpO1xuICAgIH1cblxuICAgIC8vIEJlY2F1c2UgdGhlcmUgbWF5IGJlIG5vIElELCB3ZSBoYXZlIHRvIGJ5cGFzcyBjbGllbnQuX2NyZWF0ZU9iamVjdCBhbmQgaXRzIHN3aXRjaCBzdGF0ZW1lbnQuXG4gICAgaWYgKCFzZW5kZXIpIHtcbiAgICAgIHNlbmRlciA9IElkZW50aXR5Ll9jcmVhdGVGcm9tU2VydmVyKG1lc3NhZ2Uuc2VuZGVyLCBjbGllbnQpO1xuICAgIH1cbiAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcblxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuXG4gICAgaWYgKG9sZFBvc2l0aW9uICYmIG9sZFBvc2l0aW9uICE9PSB0aGlzLnBvc2l0aW9uKSB7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgICAgb2xkVmFsdWU6IG9sZFBvc2l0aW9uLFxuICAgICAgICBuZXdWYWx1ZTogdGhpcy5wb3NpdGlvbixcbiAgICAgICAgcHJvcGVydHk6ICdwb3NpdGlvbicsXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBNZXNzYWdlJ3MgbGF5ZXIuTWVzc2FnZVBhcnQgd2l0aCB0aGUgc3BlY2lmaWVkIHRoZSBwYXJ0IElELlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIHBhcnQgPSBjbGllbnQuZ2V0TWVzc2FnZVBhcnQoJ2xheWVyOi8vL21lc3NhZ2VzLzZmMDhhY2ZhLTMyNjgtNGFlNS04M2Q5LTZjYTAwMDAwMDAwL3BhcnRzLzAnKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0UGFydEJ5SWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhcnRJZFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlUGFydH1cbiAgICovXG4gIGdldFBhcnRCeUlkKHBhcnRJZCkge1xuICAgIGNvbnN0IHBhcnQgPSB0aGlzLnBhcnRzID8gdGhpcy5wYXJ0cy5maWx0ZXIoYVBhcnQgPT4gYVBhcnQuaWQgPT09IHBhcnRJZClbMF0gOiBudWxsO1xuICAgIHJldHVybiBwYXJ0IHx8IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQWNjZXB0cyBqc29uLXBhdGNoIG9wZXJhdGlvbnMgZm9yIG1vZGlmeWluZyByZWNpcGllbnRTdGF0dXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBhdGNoRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0W119IGRhdGEgLSBBcnJheSBvZiBvcGVyYXRpb25zXG4gICAqL1xuICBfaGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSB7XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IGZhbHNlO1xuICAgIGlmIChwYXRoc1swXS5pbmRleE9mKCdyZWNpcGllbnRfc3RhdHVzJykgPT09IDApIHtcbiAgICAgIHRoaXMuX191cGRhdGVSZWNpcGllbnRTdGF0dXModGhpcy5yZWNpcGllbnRTdGF0dXMsIG9sZFZhbHVlKTtcbiAgICB9XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhYnNvbHV0ZSBVUkwgZm9yIHRoaXMgcmVzb3VyY2UuXG4gICAqIFVzZWQgYnkgc3luYyBtYW5hZ2VyIGJlY2F1c2UgdGhlIHVybCBtYXkgbm90IGJlIGtub3duXG4gICAqIGF0IHRoZSB0aW1lIHRoZSBzeW5jIHJlcXVlc3QgaXMgZW5xdWV1ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFVybFxuICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIC0gcmVsYXRpdmUgdXJsIGFuZCBxdWVyeSBzdHJpbmcgcGFyYW1ldGVyc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGZ1bGwgdXJsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0VXJsKHVybCkge1xuICAgIHJldHVybiB0aGlzLnVybCArICh1cmwgfHwgJycpO1xuICB9XG5cbiAgX3NldHVwU3luY09iamVjdChzeW5jKSB7XG4gICAgaWYgKHN5bmMgIT09IGZhbHNlKSB7XG4gICAgICBzeW5jID0gc3VwZXIuX3NldHVwU3luY09iamVjdChzeW5jKTtcbiAgICAgIGlmICghc3luYy5kZXBlbmRzKSB7XG4gICAgICAgIHN5bmMuZGVwZW5kcyA9IFt0aGlzLmNvbnZlcnNhdGlvbklkXTtcbiAgICAgIH0gZWxzZSBpZiAoc3luYy5kZXBlbmRzLmluZGV4T2YodGhpcy5pZCkgPT09IC0xKSB7XG4gICAgICAgIHN5bmMuZGVwZW5kcy5wdXNoKHRoaXMuY29udmVyc2F0aW9uSWQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3luYztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEdldCBhbGwgdGV4dCBwYXJ0cyBvZiB0aGUgTWVzc2FnZS5cbiAgICpcbiAgICogVXRpbGl0eSBtZXRob2QgZm9yIGV4dHJhY3RpbmcgYWxsIG9mIHRoZSB0ZXh0L3BsYWluIHBhcnRzXG4gICAqIGFuZCBjb25jYXRlbmF0aW5nIGFsbCBvZiB0aGVpciBib2R5cyB0b2dldGhlciBpbnRvIGEgc2luZ2xlIHN0cmluZy5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUZXh0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbam9pblN0cj0nLiAgJ10gSWYgbXVsdGlwbGUgbWVzc2FnZSBwYXJ0cyBvZiB0eXBlIHRleHQvcGxhaW4sIGhvdyBkbyB5b3Ugd2FudCB0aGVtIGpvaW5lZCB0b2dldGhlcj9cbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgZ2V0VGV4dChqb2luU3RyID0gJy4gJykge1xuICAgIGxldCB0ZXh0QXJyYXkgPSB0aGlzLnBhcnRzXG4gICAgICAuZmlsdGVyKHBhcnQgPT4gcGFydC5taW1lVHlwZSA9PT0gJ3RleHQvcGxhaW4nKVxuICAgICAgLm1hcChwYXJ0ID0+IHBhcnQuYm9keSk7XG4gICAgdGV4dEFycmF5ID0gdGV4dEFycmF5LmZpbHRlcihkYXRhID0+IGRhdGEpO1xuICAgIHJldHVybiB0ZXh0QXJyYXkuam9pbihqb2luU3RyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIE1lc3NhZ2UgaW5zdGFuY2UuICBOZXcgb2JqZWN0IGlzIHJldHVybmVkIGFueSB0aW1lXG4gICAqIGFueSBvZiB0aGlzIG9iamVjdCdzIHByb3BlcnRpZXMgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gUE9KTyB2ZXJzaW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgKi9cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdG9PYmplY3Q7XG4gIH1cblxuICBfdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLl90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICB0cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogSWRlbnRpZmllcyB3aGV0aGVyIGEgTWVzc2FnZSByZWNlaXZpbmcgdGhlIHNwZWNpZmllZCBwYXRjaCBkYXRhIHNob3VsZCBiZSBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBBcHBsaWVzIG9ubHkgdG8gTWVzc2FnZXMgdGhhdCBhcmVuJ3QgYWxyZWFkeSBsb2FkZWQ7IHVzZWQgdG8gaW5kaWNhdGUgaWYgYSBjaGFuZ2UgZXZlbnQgaXNcbiAgICogc2lnbmlmaWNhbnQgZW5vdWdoIHRvIGxvYWQgdGhlIE1lc3NhZ2UgYW5kIHRyaWdnZXIgY2hhbmdlIGV2ZW50cyBvbiB0aGF0IE1lc3NhZ2UuXG4gICAqXG4gICAqIEF0IHRoaXMgdGltZSB0aGVyZSBhcmUgbm8gcHJvcGVydGllcyB0aGF0IGFyZSBwYXRjaGVkIG9uIE1lc3NhZ2VzIHZpYSB3ZWJzb2NrZXRzXG4gICAqIHRoYXQgd291bGQganVzdGlmeSBsb2FkaW5nIHRoZSBNZXNzYWdlIGZyb20gdGhlIHNlcnZlciBzbyBhcyB0byBub3RpZnkgdGhlIGFwcC5cbiAgICpcbiAgICogT25seSByZWNpcGllbnQgc3RhdHVzIGNoYW5nZXMgYW5kIG1heWJlIGlzX3VucmVhZCBjaGFuZ2VzIGFyZSBzZW50O1xuICAgKiBuZWl0aGVyIG9mIHdoaWNoIGFyZSByZWxldmFudCB0byBhbiBhcHAgdGhhdCBpc24ndCByZW5kZXJpbmcgdGhhdCBtZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkUmVzb3VyY2VGb3JQYXRjaFxuICAgKiBAc3RhdGljXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgX2xvYWRSZXNvdXJjZUZvclBhdGNoKHBhdGNoRGF0YSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vKipcbiAqIENsaWVudCB0aGF0IHRoZSBNZXNzYWdlIGJlbG9uZ3MgdG8uXG4gKlxuICogQWN0dWFsIHZhbHVlIG9mIHRoaXMgc3RyaW5nIG1hdGNoZXMgdGhlIGFwcElkLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5jbGllbnRJZCA9ICcnO1xuXG4vKiBGZWF0dXJlIGlzIHRlc3RlZCBidXQgbm90IGF2YWlsYWJsZSBvbiBzZXJ2ZXJcbiAqIENvbnZlcnNhdGlvbiBJRCBvciBDaGFubmVsIElEIHRoYXQgdGhpcyBNZXNzYWdlIGJlbG9uZ3MgdG8uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5jb252ZXJzYXRpb25JZCA9ICcnO1xuXG4vKipcbiAqIEFycmF5IG9mIGxheWVyLk1lc3NhZ2VQYXJ0IG9iamVjdHMuXG4gKlxuICogVXNlIGxheWVyLk1lc3NhZ2UuYWRkUGFydCB0byBtb2RpZnkgdGhpcyBhcnJheS5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuTWVzc2FnZVBhcnRbXX1cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5wYXJ0cyA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBtZXNzYWdlIHdhcyBzZW50LlxuICpcbiAqICBOb3RlIHRoYXQgYSBsb2NhbGx5IGNyZWF0ZWQgbGF5ZXIuTWVzc2FnZSB3aWxsIGhhdmUgYSBgc2VudEF0YCB2YWx1ZSBldmVuXG4gKiB0aG91Z2ggaXRzIG5vdCB5ZXQgc2VudDsgdGhpcyBpcyBzbyB0aGF0IGFueSByZW5kZXJpbmcgY29kZSBkb2Vzbid0IG5lZWRcbiAqIHRvIGFjY291bnQgZm9yIGBudWxsYCB2YWx1ZXMuICBTZW5kaW5nIHRoZSBNZXNzYWdlIG1heSBjYXVzZSBhIHNsaWdodCBjaGFuZ2VcbiAqIGluIHRoZSBgc2VudEF0YCB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7RGF0ZX1cbiAqIEByZWFkb25seVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5zZW50QXQgPSBudWxsO1xuXG4vKipcbiAqIFRpbWUgdGhhdCB0aGUgZmlyc3QgZGVsaXZlcnkgcmVjZWlwdCB3YXMgc2VudCBieSB5b3VyXG4gKiB1c2VyIGFja25vd2xlZGdpbmcgcmVjZWlwdCBvZiB0aGUgbWVzc2FnZS5cbiAqIEB0eXBlIHtEYXRlfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnJlY2VpdmVkQXQgPSBudWxsO1xuXG4vKipcbiAqIElkZW50aXR5IG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHNlbmRlciBvZiB0aGUgTWVzc2FnZS5cbiAqXG4gKiBNb3N0IGNvbW1vbmx5IHVzZWQgcHJvcGVydGllcyBvZiBJZGVudGl0eSBhcmU6XG4gKiAqIGRpc3BsYXlOYW1lOiBBIG5hbWUgZm9yIHlvdXIgVUlcbiAqICogdXNlcklkOiBOYW1lIGZvciB0aGUgdXNlciBhcyByZXByZXNlbnRlZCBvbiB5b3VyIHN5c3RlbVxuICogKiBuYW1lOiBSZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgc2VydmljZSBpZiB0aGUgc2VuZGVyIHdhcyBhbiBhdXRvbWF0ZWQgc3lzdGVtLlxuICpcbiAqICAgICAgPHNwYW4gY2xhc3M9J3NlbnQtYnknPlxuICogICAgICAgIHttZXNzYWdlLnNlbmRlci5kaXNwbGF5TmFtZSB8fCBtZXNzYWdlLnNlbmRlci5uYW1lfVxuICogICAgICA8L3NwYW4+XG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5fVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnNlbmRlciA9IG51bGw7XG5cbi8qKlxuICogUG9zaXRpb24gb2YgdGhpcyBtZXNzYWdlIHdpdGhpbiB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIE5PVEVTOlxuICpcbiAqIDEuIERlbGV0aW5nIGEgbWVzc2FnZSBkb2VzIG5vdCBhZmZlY3QgcG9zaXRpb24gb2Ygb3RoZXIgTWVzc2FnZXMuXG4gKiAyLiBBIHBvc2l0aW9uIGlzIG5vdCBnYXVyZW50ZWVkIHRvIGJlIHVuaXF1ZSAobXVsdGlwbGUgbWVzc2FnZXMgc2VudCBhdCB0aGUgc2FtZSB0aW1lIGNvdWxkXG4gKiBhbGwgY2xhaW0gdGhlIHNhbWUgcG9zaXRpb24pXG4gKiAzLiBFYWNoIHN1Y2Nlc3NpdmUgbWVzc2FnZSB3aXRoaW4gYSBjb252ZXJzYXRpb24gc2hvdWxkIGV4cGVjdCBhIGhpZ2hlciBwb3NpdGlvbi5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnBvc2l0aW9uID0gMDtcblxuLyoqXG4gKiBIaW50IHVzZWQgYnkgbGF5ZXIuQ2xpZW50IG9uIHdoZXRoZXIgdG8gdHJpZ2dlciBhIG1lc3NhZ2VzOm5vdGlmeSBldmVudC5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLl9ub3RpZnkgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGlzIHByb3BlcnR5IGlzIGhlcmUgZm9yIGNvbnZlbmllbmNlIG9ubHk7IGl0IHdpbGwgYWx3YXlzIGJlIHRoZSBvcHBvc2l0ZSBvZiBpc1JlYWQuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWVzc2FnZS5wcm90b3R5cGUsICdpc1VucmVhZCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzUmVhZDtcbiAgfSxcbn0pO1xuXG5cbk1lc3NhZ2UucHJvdG90eXBlLl90b09iamVjdCA9IG51bGw7XG5cbk1lc3NhZ2UucHJvdG90eXBlLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IGZhbHNlO1xuXG5NZXNzYWdlLmV2ZW50UHJlZml4ID0gJ21lc3NhZ2VzJztcblxuTWVzc2FnZS5ldmVudFByZWZpeCA9ICdtZXNzYWdlcyc7XG5cbk1lc3NhZ2UucHJlZml4VVVJRCA9ICdsYXllcjovLy9tZXNzYWdlcy8nO1xuXG5NZXNzYWdlLmluT2JqZWN0SWdub3JlID0gU3luY2FibGUuaW5PYmplY3RJZ25vcmU7XG5cbk1lc3NhZ2UuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuTWVzc2FnZS5pbWFnZVR5cGVzID0gW1xuICAnaW1hZ2UvZ2lmJyxcbiAgJ2ltYWdlL3BuZycsXG4gICdpbWFnZS9qcGVnJyxcbiAgJ2ltYWdlL2pwZycsXG5dO1xuXG5NZXNzYWdlLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgaGFzIGJlZW4gbG9hZGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIHRoZSBsYXllci5NZXNzYWdlLmxvYWQoKSBtZXRob2QuXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgbSA9IGNsaWVudC5nZXRNZXNzYWdlKCdsYXllcjovLy9tZXNzYWdlcy8xMjMnLCB0cnVlKVxuICAgKiAgICAub24oJ21lc3NhZ2VzOmxvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICAgbXlyZXJlbmRlcihtKTtcbiAgICogICAgfSk7XG4gICAqIG15cmVuZGVyKG0pOyAvLyByZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgbSB1bnRpbCB0aGUgZGV0YWlscyBvZiBtIGhhdmUgbG9hZGVkXG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpsb2FkZWQnLFxuXG4gIC8qKlxuICAgKiBUaGUgbG9hZCBtZXRob2QgZmFpbGVkIHRvIGxvYWQgdGhlIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLk1lc3NhZ2UubG9hZCgpIG1ldGhvZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6bG9hZGVkLWVycm9yJyxcblxuICAvKipcbiAgICogTWVzc2FnZSBkZWxldGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2F1c2VkIGJ5IGEgY2FsbCB0byBsYXllci5NZXNzYWdlLmRlbGV0ZSgpIG9yIGEgd2Vic29ja2V0IGV2ZW50LlxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAZXZlbnRcbiAgICovXG4gICdtZXNzYWdlczpkZWxldGUnLFxuXG4gIC8qKlxuICAgKiBNZXNzYWdlIGlzIGFib3V0IHRvIGJlIHNlbnQuXG4gICAqXG4gICAqIExhc3QgY2hhbmNlIHRvIG1vZGlmeSBvciB2YWxpZGF0ZSB0aGUgbWVzc2FnZSBwcmlvciB0byBzZW5kaW5nLlxuICAgKlxuICAgKiAgICAgbWVzc2FnZS5vbignbWVzc2FnZXM6c2VuZGluZycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgbWVzc2FnZS5hZGRQYXJ0KHttaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2xvY2F0aW9uJywgYm9keTogSlNPTi5zdHJpbmdpZnkoZ2V0R1BTTG9jYXRpb24oKSl9KTtcbiAgICogICAgIH0pO1xuICAgKlxuICAgKiBUeXBpY2FsbHksIHlvdSB3b3VsZCBsaXN0ZW4gdG8gdGhpcyBldmVudCBtb3JlIGJyb2FkbHkgdXNpbmcgYGNsaWVudC5vbignbWVzc2FnZXM6c2VuZGluZycpYFxuICAgKiB3aGljaCB3b3VsZCB0cmlnZ2VyIGJlZm9yZSBzZW5kaW5nIEFOWSBNZXNzYWdlcy5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6c2VuZGluZycsXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQgYnkgdGhlIHNlcnZlci5cbiAgICpcbiAgICogSXQgZG9lcyBOT1QgaW5kaWNhdGUgZGVsaXZlcnkgdG8gb3RoZXIgdXNlcnMuXG4gICAqXG4gICAqIEl0IGRvZXMgTk9UIGluZGljYXRlIG1lc3NhZ2VzIHNlbnQgYnkgb3RoZXIgdXNlcnMuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOnNlbnQnLFxuXG4gIC8qKlxuICAgKiBTZXJ2ZXIgZmFpbGVkIHRvIHJlY2VpdmUgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIE1lc3NhZ2Ugd2lsbCBiZSBkZWxldGVkIGltbWVkaWF0ZWx5IGFmdGVyIGZpcmluZyB0aGlzIGV2ZW50LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZXJyb3JcbiAgICovXG4gICdtZXNzYWdlczpzZW50LWVycm9yJyxcblxuICAvKipcbiAgICogVGhlIHJlY2lwaWVudFN0YXR1cyBwcm9wZXJ0eSBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogVGhpcyBoYXBwZW5zIGluIHJlc3BvbnNlIHRvIGFuIHVwZGF0ZVxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuLi4gYnV0IGlzIGFsc28gY2F1c2VkIGJ5IG1hcmtpbmcgdGhlIGN1cnJlbnQgdXNlciBhcyBoYXZpbmcgcmVhZFxuICAgKiBvciByZWNlaXZlZCB0aGUgbWVzc2FnZS5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6Y2hhbmdlJyxcblxuXG5dLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVzc2FnZSwgW01lc3NhZ2UsICdNZXNzYWdlJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKE1lc3NhZ2UpO1xubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlO1xuIl19
