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

      var adjustedParts = void 0;
      if (typeof parts === 'string') {
        adjustedParts = [new MessagePart({
          body: parts,
          mimeType: 'text/plain',
          clientId: this.clientId
        })];
      } else if (Array.isArray(parts)) {
        adjustedParts = parts.map(function (part) {
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
        adjustedParts = [new MessagePart(parts)];
      }
      this._setupPartIds(adjustedParts);
      if (adjustedParts) {
        adjustedParts.forEach(function (part) {
          part.off('messageparts:change', _this2._onMessagePartChange, _this2); // if we already subscribed, don't create a redundant subscription
          part.on('messageparts:change', _this2._onMessagePartChange, _this2);
        });
      }
      return adjustedParts;
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
        var index = this.parts.length - 1;
        var thePart = this.parts[index];

        thePart.off('messageparts:change', this._onMessagePartChange, this); // if we already subscribed, don't create a redundant subscription
        thePart.on('messageparts:change', this._onMessagePartChange, this);
        if (!part.id) part.id = this.id + '/parts/' + index;
      }
      return this;
    }

    /**
     * Any time a Part changes, the Message has changed; trigger the `messages:change` event.
     *
     * Currently, this only looks at changes to body or mimeType, and does not handle changes to url/rich content.
     *
     * @method _onMessagePartChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_onMessagePartChange',
    value: function _onMessagePartChange(evt) {
      var _this3 = this;

      evt.changes.forEach(function (change) {
        _this3._triggerAsync('messages:change', {
          property: 'parts.' + change.property,
          oldValue: change.oldValue,
          newValue: change.newValue,
          part: evt.target
        });
      });
    }

    /**
     * Your unsent Message will show up in Query results and be rendered in Message Lists.
     *
     * This method is only needed for Messages that should show up in a Message List Widget that
     * is driven by Query data, but where the layer.Message.send method has not yet been called.
     *
     * Once you have called `presend` your message should show up in your Message List.  However,
     * typically you want to be able to edit and rerender that Message. After making changes to the Message,
     * you can trigger change events:
     *
     * ```
     * var message = conversation.createMessage({parts: [{mimeType: 'custom/card', body: null}]});
     * message.presend();
     *
     * message.parts[0].body = 'Frodo is a Dodo';
     * message.trigger('messages:change');
     * ```
     *
     * Note that if using Layer UI for Web, the `messages:change` event will trigger an `onRerender` call,
     * not an `onRender` call, so the capacity to handle editing of messages will require the ability to render
     * all possible edits within `onRerender`.
     *
     * It is assumed that at some point either `send()` or `destroy()` will be called on this message
     * to complete or cancel this process.
     *
     * @method presend
     */

  }, {
    key: 'presend',
    value: function presend() {
      var _this4 = this;

      var client = this.getClient();
      if (!client) {
        throw new Error(LayerError.dictionary.clientMissing);
      }

      var conversation = this.getConversation(false);

      if (!conversation) {
        throw new Error(LayerError.dictionary.conversationMissing);
      }

      if (this.syncState !== Constants.SYNC_STATE.NEW) {
        throw new Error(LayerError.dictionary.alreadySent);
      }
      conversation._setupMessage(this);

      // Make sure all data is in the right format for being rendered
      this._readAllBlobs(function () {
        client._addMessage(_this4);
      });
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
      var _this5 = this;

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
          return _this5.send(notification);
        });
        conversation._setupMessage(this);
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
        client._addMessage(_this5);

        // allow for modification of message before sending
        _this5.trigger('messages:sending');

        var data = {
          parts: new Array(_this5.parts.length),
          id: _this5.id
        };
        if (notification && _this5.conversationId) data.notification = notification;

        _this5._preparePartsForSending(data);
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
      var _this6 = this;

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
          if (count === _this6.parts.length) {
            _this6._send(data);
          }
        }, _this6);
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
      var _this7 = this;

      var client = this.getClient();
      var conversation = this.getConversation(false);

      this.getClient()._triggerAsync('state-change', {
        started: true,
        type: 'send_' + Util.typeFromID(this.id),
        telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
        id: this.id
      });
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
        return _this7._sendResult(success, socketData);
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

      this.getClient()._triggerAsync('state-change', {
        ended: true,
        type: 'send_' + Util.typeFromID(this.id),
        telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
        result: success,
        id: this.id
      });
      if (this.isDestroyed) return;

      if (success) {
        this._populateFromServer(data);
        this._triggerAsync('messages:sent');
        this._triggerAsync('messages:change', {
          property: 'syncState',
          oldValue: Constants.SYNC_STATE.SAVING,
          newValue: Constants.SYNC_STATE.SYNCED
        });
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
     * Setup message-part ids for parts that lack that id; for locally created parts.
     *
     * @private
     * @method
     * @param {layer.MessagePart[]} parts
     */

  }, {
    key: '_setupPartIds',
    value: function _setupPartIds(parts) {
      var _this8 = this;

      // Assign IDs to preexisting Parts so that we can call getPartById()
      if (parts) {
        parts.forEach(function (part, index) {
          if (!part.id) part.id = _this8.id + '/parts/' + index;
        });
      }
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
      var _this9 = this;

      this._inPopulateFromServer = true;
      var client = this.getClient();

      this.id = message.id;
      this.url = message.url;
      var oldPosition = this.position;
      this.position = message.position;
      this._setupPartIds(message.parts);
      this.parts = message.parts.map(function (part) {
        var existingPart = _this9.getPartById(part.id);
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

/**
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVzc2FnZS5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlN5bmNhYmxlIiwiTWVzc2FnZVBhcnQiLCJMYXllckVycm9yIiwiQ29uc3RhbnRzIiwiVXRpbCIsIklkZW50aXR5IiwiTWVzc2FnZSIsIm9wdGlvbnMiLCJmcm9tU2VydmVyIiwiaXNSZWFkIiwiaXNVbnJlYWQiLCJpc191bnJlYWQiLCJpZCIsImNsaWVudCIsImNsaWVudElkIiwiYXBwSWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwicGFydHMiLCJnZXRDbGllbnQiLCJpc0luaXRpYWxpemluZyIsIl9wb3B1bGF0ZUZyb21TZXJ2ZXIiLCJzZW5kZXIiLCJ1c2VyIiwic2VudEF0IiwiRGF0ZSIsImFkanVzdGVkUGFydHMiLCJib2R5IiwibWltZVR5cGUiLCJBcnJheSIsImlzQXJyYXkiLCJtYXAiLCJwYXJ0IiwicmVzdWx0IiwiX3NldHVwUGFydElkcyIsImZvckVhY2giLCJvZmYiLCJfb25NZXNzYWdlUGFydENoYW5nZSIsIm9uIiwicHVzaCIsImluZGV4IiwibGVuZ3RoIiwidGhlUGFydCIsImV2dCIsImNoYW5nZXMiLCJjaGFuZ2UiLCJfdHJpZ2dlckFzeW5jIiwicHJvcGVydHkiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwidGFyZ2V0IiwiY29udmVyc2F0aW9uIiwiZ2V0Q29udmVyc2F0aW9uIiwiY29udmVyc2F0aW9uTWlzc2luZyIsInN5bmNTdGF0ZSIsIlNZTkNfU1RBVEUiLCJORVciLCJhbHJlYWR5U2VudCIsIl9zZXR1cE1lc3NhZ2UiLCJfcmVhZEFsbEJsb2JzIiwiX2FkZE1lc3NhZ2UiLCJub3RpZmljYXRpb24iLCJpc0xvYWRpbmciLCJvbmNlIiwiY29uc3RydWN0b3IiLCJldmVudFByZWZpeCIsInNlbmQiLCJwYXJ0c01pc3NpbmciLCJfc2V0U3luY2luZyIsInRyaWdnZXIiLCJkYXRhIiwiY29udmVyc2F0aW9uSWQiLCJfcHJlcGFyZVBhcnRzRm9yU2VuZGluZyIsImNhbGxiYWNrIiwiY291bnQiLCJmaWx0ZXIiLCJpc0Jsb2IiLCJpc1RleHR1YWxNaW1lVHlwZSIsImZldGNoVGV4dEZyb21GaWxlIiwidGV4dCIsIm1pbWVfdHlwZSIsImNvbnRlbnQiLCJlbmNvZGluZyIsIl9zZW5kIiwic3RhcnRlZCIsInR5cGUiLCJ0eXBlRnJvbUlEIiwidGVsZW1ldHJ5SWQiLCJzZW5kU29ja2V0UmVxdWVzdCIsIm1ldGhvZCIsIm9iamVjdF9pZCIsInN5bmMiLCJkZXBlbmRzIiwic3VjY2VzcyIsInNvY2tldERhdGEiLCJfc2VuZFJlc3VsdCIsImVuZGVkIiwiaXNEZXN0cm95ZWQiLCJTQVZJTkciLCJTWU5DRUQiLCJlcnJvciIsImRlc3Ryb3kiLCJfc2V0U3luY2VkIiwibmFtZSIsImNvbnRleHQiLCJoYXNMb2FkZWRFdnQiLCJjYWxsTm93IiwiZGVmZXIiLCJhcHBseSIsIl9yZW1vdmVNZXNzYWdlIiwiX19wYXJ0cyIsIm1lc3NhZ2UiLCJfaW5Qb3B1bGF0ZUZyb21TZXJ2ZXIiLCJ1cmwiLCJvbGRQb3NpdGlvbiIsInBvc2l0aW9uIiwiZXhpc3RpbmdQYXJ0IiwiZ2V0UGFydEJ5SWQiLCJfY3JlYXRlRnJvbVNlcnZlciIsInJlY2lwaWVudFN0YXR1cyIsInJlY2lwaWVudF9zdGF0dXMiLCJzZW50X2F0IiwicmVjZWl2ZWRBdCIsInJlY2VpdmVkX2F0IiwidW5kZWZpbmVkIiwiZ2V0SWRlbnRpdHkiLCJwYXJ0SWQiLCJhUGFydCIsInBhdGhzIiwiX2luTGF5ZXJQYXJzZXIiLCJpbmRleE9mIiwiX191cGRhdGVSZWNpcGllbnRTdGF0dXMiLCJqb2luU3RyIiwidGV4dEFycmF5Iiwiam9pbiIsIl90b09iamVjdCIsImV2dE5hbWUiLCJhcmdzIiwiX2NsZWFyT2JqZWN0IiwicGF0Y2hEYXRhIiwicHJvdG90eXBlIiwiX25vdGlmeSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsImdldCIsInByZWZpeFVVSUQiLCJpbk9iamVjdElnbm9yZSIsImJ1YmJsZUV2ZW50UGFyZW50IiwiaW1hZ2VUeXBlcyIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJzdWJjbGFzc2VzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1SEEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxXQUFXRCxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNRSxjQUFjRixRQUFRLGdCQUFSLENBQXBCO0FBQ0EsSUFBTUcsYUFBYUgsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1JLFlBQVlKLFFBQVEsVUFBUixDQUFsQjtBQUNBLElBQU1LLE9BQU9MLFFBQVEsaUJBQVIsQ0FBYjtBQUNBLElBQU1NLFdBQVdOLFFBQVEsWUFBUixDQUFqQjs7SUFFTU8sTzs7O0FBQ0o7Ozs7OztBQU1BLHFCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQTtBQUNBLFFBQUksQ0FBQ0EsUUFBUUMsVUFBYixFQUF5QjtBQUN2QixVQUFJLGNBQWNELE9BQWxCLEVBQTJCO0FBQ3pCQSxnQkFBUUUsTUFBUixHQUFpQixDQUFDRixRQUFRRyxRQUFULElBQXFCLENBQUNILFFBQVFJLFNBQS9DO0FBQ0EsZUFBT0osUUFBUUcsUUFBZjtBQUNELE9BSEQsTUFHTztBQUNMSCxnQkFBUUUsTUFBUixHQUFpQixJQUFqQjtBQUNEO0FBQ0YsS0FQRCxNQU9PO0FBQ0xGLGNBQVFLLEVBQVIsR0FBYUwsUUFBUUMsVUFBUixDQUFtQkksRUFBaEM7QUFDRDs7QUFFRCxRQUFJTCxRQUFRTSxNQUFaLEVBQW9CTixRQUFRTyxRQUFSLEdB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b250ZW50IjpbIi8qKlxuICogVGhlIE1lc3NhZ2UgQ2xhc3MgcmVwcmVzZW50cyBNZXNzYWdlcyBzZW50IGFtb25nc3QgcGFydGljaXBhbnRzXG4gKiBvZiBvZiBhIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBUaGUgc2ltcGxlc3Qgd2F5IHRvIGNyZWF0ZSBhbmQgc2VuZCBhIG1lc3NhZ2UgaXM6XG4gKlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdIZWxsbyB0aGVyZScpLnNlbmQoKTtcbiAqICAgICAgdmFyIG0gPSBjaGFubmVsLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvIHRoZXJlJykuc2VuZCgpO1xuICpcbiAqIEZvciBjb252ZXJzYXRpb25zIHRoYXQgaW52b2x2ZSBub3RpZmljYXRpb25zIChwcmltYXJpbHkgZm9yIEFuZHJvaWQgYW5kIElPUyksIHRoZSBtb3JlIGNvbW1vbiBwYXR0ZXJuIGlzOlxuICpcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnSGVsbG8gdGhlcmUnKS5zZW5kKHt0ZXh0OiBcIk1lc3NhZ2UgZnJvbSBGcmVkOiBIZWxsbyB0aGVyZVwifSk7XG4gKlxuICogQ2hhbm5lbHMgZG8gbm90IGF0IHRoaXMgdGltZSBzdXBwb3J0IG5vdGlmaWNhdGlvbnMuXG4gKlxuICogVHlwaWNhbGx5LCByZW5kZXJpbmcgd291bGQgYmUgZG9uZSBhcyBmb2xsb3dzOlxuICpcbiAqICAgICAgLy8gQ3JlYXRlIGEgbGF5ZXIuUXVlcnkgdGhhdCBsb2FkcyBNZXNzYWdlcyBmb3IgdGhlXG4gKiAgICAgIC8vIHNwZWNpZmllZCBDb252ZXJzYXRpb24uXG4gKiAgICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgICAgbW9kZWw6IFF1ZXJ5Lk1lc3NhZ2UsXG4gKiAgICAgICAgcHJlZGljYXRlOiAnY29udmVyc2F0aW9uID0gXCInICsgY29udmVyc2F0aW9uLmlkICsgJ1wiJ1xuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIEFueSB0aW1lIHRoZSBRdWVyeSdzIGRhdGEgY2hhbmdlcyB0aGUgJ2NoYW5nZSdcbiAqICAgICAgLy8gZXZlbnQgd2lsbCBmaXJlLlxuICogICAgICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24obGF5ZXJFdnQpIHtcbiAqICAgICAgICByZW5kZXJOZXdNZXNzYWdlcyhxdWVyeS5kYXRhKTtcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBUaGlzIHdpbGwgY2FsbCB3aWxsIGNhdXNlIHRoZSBhYm92ZSBldmVudCBoYW5kbGVyIHRvIHJlY2VpdmVcbiAqICAgICAgLy8gYSBjaGFuZ2UgZXZlbnQsIGFuZCB3aWxsIHVwZGF0ZSBxdWVyeS5kYXRhLlxuICogICAgICBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnSGVsbG8gdGhlcmUnKS5zZW5kKCk7XG4gKlxuICogVGhlIGFib3ZlIGNvZGUgd2lsbCB0cmlnZ2VyIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICpcbiAqICAqIE1lc3NhZ2UgSW5zdGFuY2UgZmlyZXNcbiAqICAgICogbWVzc2FnZXM6c2VuZGluZzogQW4gZXZlbnQgdGhhdCBsZXRzIHlvdSBtb2RpZnkgdGhlIG1lc3NhZ2UgcHJpb3IgdG8gc2VuZGluZ1xuICogICAgKiBtZXNzYWdlczpzZW50OiBUaGUgbWVzc2FnZSB3YXMgcmVjZWl2ZWQgYnkgdGhlIHNlcnZlclxuICogICogUXVlcnkgSW5zdGFuY2UgZmlyZXNcbiAqICAgICogY2hhbmdlOiBUaGUgcXVlcnkgaGFzIHJlY2VpdmVkIGEgbmV3IE1lc3NhZ2VcbiAqICAgICogY2hhbmdlOmFkZDogU2FtZSBhcyB0aGUgY2hhbmdlIGV2ZW50IGJ1dCBkb2VzIG5vdCByZWNlaXZlIG90aGVyIHR5cGVzIG9mIGNoYW5nZSBldmVudHNcbiAqXG4gKiBXaGVuIGNyZWF0aW5nIGEgTWVzc2FnZSB0aGVyZSBhcmUgYSBudW1iZXIgb2Ygd2F5cyB0byBzdHJ1Y3R1cmUgaXQuXG4gKiBBbGwgb2YgdGhlc2UgYXJlIHZhbGlkIGFuZCBjcmVhdGUgdGhlIHNhbWUgZXhhY3QgTWVzc2FnZTpcbiAqXG4gKiAgICAgIC8vIEZ1bGwgQVBJIHN0eWxlOlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgIHBhcnRzOiBbbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtcbiAqICAgICAgICAgICAgICBib2R5OiAnSGVsbG8gdGhlcmUnLFxuICogICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAqICAgICAgICAgIH0pXVxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiAxOiBQYXNzIGluIGFuIE9iamVjdCBpbnN0ZWFkIG9mIGFuIGFycmF5IG9mIGxheWVyLk1lc3NhZ2VQYXJ0c1xuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgIHBhcnRzOiB7XG4gKiAgICAgICAgICAgICAgYm9keTogJ0hlbGxvIHRoZXJlJyxcbiAqICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gKiAgICAgICAgICB9XG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDI6IFBhc3MgaW4gYW4gYXJyYXkgb2YgT2JqZWN0cyBpbnN0ZWFkIG9mIGFuIGFycmF5IG9mIGxheWVyLk1lc3NhZ2VQYXJ0c1xuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgIHBhcnRzOiBbe1xuICogICAgICAgICAgICAgIGJvZHk6ICdIZWxsbyB0aGVyZScsXG4gKiAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICogICAgICAgICAgfV1cbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gMzogUGFzcyBpbiBhIHN0cmluZyAoYXV0b21hdGljYWxseSBhc3N1bWVzIG1pbWVUeXBlIGlzIHRleHQvcGxhaW4pXG4gKiAgICAgIC8vIGluc3RlYWQgb2YgYW4gYXJyYXkgb2Ygb2JqZWN0cy5cbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogJ0hlbGxvJ1xuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiA0OiBQYXNzIGluIGFuIGFycmF5IG9mIHN0cmluZ3MgKGF1dG9tYXRpY2FsbHkgYXNzdW1lcyBtaW1lVHlwZSBpcyB0ZXh0L3BsYWluKVxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgIHBhcnRzOiBbJ0hlbGxvJ11cbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gNTogUGFzcyBpbiBqdXN0IGEgc3RyaW5nIGFuZCBub3RoaW5nIGVsc2VcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnSGVsbG8nKTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiA2OiBVc2UgYWRkUGFydC5cbiAqICAgICAgdmFyIG0gPSBjb252ZXJzZWF0aW9uLmNyZWF0ZU1lc3NhZ2UoKTtcbiAqICAgICAgbS5hZGRQYXJ0KHtib2R5OiBcImhlbGxvXCIsIG1pbWVUeXBlOiBcInRleHQvcGxhaW5cIn0pO1xuICpcbiAqIEtleSBtZXRob2RzLCBldmVudHMgYW5kIHByb3BlcnRpZXMgZm9yIGdldHRpbmcgc3RhcnRlZDpcbiAqXG4gKiBQcm9wZXJ0aWVzOlxuICpcbiAqICogbGF5ZXIuTWVzc2FnZS5pZDogdGhpcyBwcm9wZXJ0eSBpcyB3b3J0aCBiZWluZyBmYW1pbGlhciB3aXRoOyBpdCBpZGVudGlmaWVzIHRoZVxuICogICBNZXNzYWdlIGFuZCBjYW4gYmUgdXNlZCBpbiBgY2xpZW50LmdldE1lc3NhZ2UoaWQpYCB0byByZXRyaWV2ZSBpdFxuICogICBhdCBhbnkgdGltZS5cbiAqICogbGF5ZXIuTWVzc2FnZS5pbnRlcm5hbElkOiBUaGlzIHByb3BlcnR5IG1ha2VzIGZvciBhIGhhbmR5IHVuaXF1ZSBJRCBmb3IgdXNlIGluIGRvbSBub2Rlcy5cbiAqICAgSXQgaXMgZ2F1cmVudGVlZCBub3QgdG8gY2hhbmdlIGR1cmluZyB0aGlzIHNlc3Npb24uXG4gKiAqIGxheWVyLk1lc3NhZ2UuaXNSZWFkOiBJbmRpY2F0ZXMgaWYgdGhlIE1lc3NhZ2UgaGFzIGJlZW4gcmVhZCB5ZXQ7IHNldCBgbS5pc1JlYWQgPSB0cnVlYFxuICogICB0byB0ZWxsIHRoZSBjbGllbnQgYW5kIHNlcnZlciB0aGF0IHRoZSBtZXNzYWdlIGhhcyBiZWVuIHJlYWQuXG4gKiAqIGxheWVyLk1lc3NhZ2UucGFydHM6IEFuIGFycmF5IG9mIGxheWVyLk1lc3NhZ2VQYXJ0IGNsYXNzZXMgcmVwcmVzZW50aW5nIHRoZSBjb250ZW50cyBvZiB0aGUgTWVzc2FnZS5cbiAqICogbGF5ZXIuTWVzc2FnZS5zZW50QXQ6IERhdGUgdGhlIG1lc3NhZ2Ugd2FzIHNlbnRcbiAqICogbGF5ZXIuTWVzc2FnZS5zZW5kZXIgYHVzZXJJZGA6IENvbnZlcnNhdGlvbiBwYXJ0aWNpcGFudCB3aG8gc2VudCB0aGUgTWVzc2FnZS4gWW91IG1heVxuICogICBuZWVkIHRvIGRvIGEgbG9va3VwIG9uIHRoaXMgaWQgaW4geW91ciBvd24gc2VydmVycyB0byBmaW5kIGFcbiAqICAgZGlzcGxheWFibGUgbmFtZSBmb3IgaXQuXG4gKlxuICogTWV0aG9kczpcbiAqXG4gKiAqIGxheWVyLk1lc3NhZ2Uuc2VuZCgpOiBTZW5kcyB0aGUgbWVzc2FnZSB0byB0aGUgc2VydmVyIGFuZCB0aGUgb3RoZXIgcGFydGljaXBhbnRzLlxuICogKiBsYXllci5NZXNzYWdlLm9uKCkgYW5kIGxheWVyLk1lc3NhZ2Uub2ZmKCk7IGV2ZW50IGxpc3RlbmVycyBidWlsdCBvbiB0b3Agb2YgdGhlIGBiYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZWAgbnBtIHByb2plY3RcbiAqXG4gKiBFdmVudHM6XG4gKlxuICogKiBgbWVzc2FnZXM6c2VudGA6IFRoZSBtZXNzYWdlIGhhcyBiZWVuIHJlY2VpdmVkIGJ5IHRoZSBzZXJ2ZXIuIENhbiBhbHNvIHN1YnNjcmliZSB0b1xuICogICB0aGlzIGV2ZW50IGZyb20gdGhlIGxheWVyLkNsaWVudCB3aGljaCBpcyB1c3VhbGx5IHNpbXBsZXIuXG4gKlxuICogQGNsYXNzICBsYXllci5NZXNzYWdlXG4gKiBAZXh0ZW5kcyBsYXllci5TeW5jYWJsZVxuICovXG5cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBTeW5jYWJsZSA9IHJlcXVpcmUoJy4vc3luY2FibGUnKTtcbmNvbnN0IE1lc3NhZ2VQYXJ0ID0gcmVxdWlyZSgnLi9tZXNzYWdlLXBhcnQnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IElkZW50aXR5ID0gcmVxdWlyZSgnLi9pZGVudGl0eScpO1xuXG5jbGFzcyBNZXNzYWdlIGV4dGVuZHMgU3luY2FibGUge1xuICAvKipcbiAgICogU2VlIGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKClcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVW5sZXNzIHRoaXMgaXMgYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIHRoaXMgaXMgYSBkZXZlbG9wZXIncyBzaG9ydGhhbmQ7XG4gICAgLy8gZmlsbCBpbiB0aGUgbWlzc2luZyBwcm9wZXJ0aWVzIGFyb3VuZCBpc1JlYWQvaXNVbnJlYWQgYmVmb3JlIGluaXRpYWxpemluZy5cbiAgICBpZiAoIW9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgaWYgKCdpc1VucmVhZCcgaW4gb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zLmlzUmVhZCA9ICFvcHRpb25zLmlzVW5yZWFkICYmICFvcHRpb25zLmlzX3VucmVhZDtcbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuaXNVbnJlYWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLmlzUmVhZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMuaWQgPSBvcHRpb25zLmZyb21TZXJ2ZXIuaWQ7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgLy8gSW5zdXJlIF9fYWRqdXN0UGFydHMgaXMgc2V0IEFGVEVSIGNsaWVudElkIGlzIHNldC5cbiAgICBjb25zdCBwYXJ0cyA9IG9wdGlvbnMucGFydHM7XG4gICAgb3B0aW9ucy5wYXJ0cyA9IG51bGw7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnBhcnRzID0gcGFydHM7XG5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKG9wdGlvbnMuZnJvbVNlcnZlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjbGllbnQpIHRoaXMuc2VuZGVyID0gY2xpZW50LnVzZXI7XG4gICAgICB0aGlzLnNlbnRBdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhcnRzKSB0aGlzLnBhcnRzID0gW107XG4gIH1cblxuICAvKipcbiAgICogVHVybiBpbnB1dCBpbnRvIHZhbGlkIGxheWVyLk1lc3NhZ2VQYXJ0cy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgYXV0b21hdGljYWxseSBjYWxsZWQgYW55IHRpbWUgdGhlIHBhcnRzXG4gICAqIHByb3BlcnR5IGlzIHNldCAoaW5jbHVkaW5nIGR1cmluZyBpbnRpYWxpemF0aW9uKS4gIFRoaXNcbiAgICogaXMgd2hlcmUgd2UgY29udmVydCBzdHJpbmdzIGludG8gTWVzc2FnZVBhcnRzLCBhbmQgaW5zdGFuY2VzXG4gICAqIGludG8gYXJyYXlzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fYWRqdXN0UGFydHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7TWl4ZWR9IHBhcnRzIC0tIENvdWxkIGJlIGEgc3RyaW5nLCBhcnJheSwgb2JqZWN0IG9yIE1lc3NhZ2VQYXJ0IGluc3RhbmNlXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2VQYXJ0W119XG4gICAqL1xuICBfX2FkanVzdFBhcnRzKHBhcnRzKSB7XG4gICAgbGV0IGFkanVzdGVkUGFydHM7XG4gICAgaWYgKHR5cGVvZiBwYXJ0cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGFkanVzdGVkUGFydHMgPSBbbmV3IE1lc3NhZ2VQYXJ0KHtcbiAgICAgICAgYm9keTogcGFydHMsXG4gICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbicsXG4gICAgICAgIGNsaWVudElkOiB0aGlzLmNsaWVudElkLFxuICAgICAgfSldO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwYXJ0cykpIHtcbiAgICAgIGFkanVzdGVkUGFydHMgPSBwYXJ0cy5tYXAoKHBhcnQpID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgaWYgKHBhcnQgaW5zdGFuY2VvZiBNZXNzYWdlUGFydCkge1xuICAgICAgICAgIHJlc3VsdCA9IHBhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gbmV3IE1lc3NhZ2VQYXJ0KHBhcnQpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHBhcnRzICYmIHR5cGVvZiBwYXJ0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHBhcnRzLmNsaWVudElkID0gdGhpcy5jbGllbnRJZDtcbiAgICAgIGFkanVzdGVkUGFydHMgPSBbbmV3IE1lc3NhZ2VQYXJ0KHBhcnRzKV07XG4gICAgfVxuICAgIHRoaXMuX3NldHVwUGFydElkcyhhZGp1c3RlZFBhcnRzKTtcbiAgICBpZiAoYWRqdXN0ZWRQYXJ0cykge1xuICAgICAgYWRqdXN0ZWRQYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICAgIHBhcnQub2ZmKCdtZXNzYWdlcGFydHM6Y2hhbmdlJywgdGhpcy5fb25NZXNzYWdlUGFydENoYW5nZSwgdGhpcyk7IC8vIGlmIHdlIGFscmVhZHkgc3Vic2NyaWJlZCwgZG9uJ3QgY3JlYXRlIGEgcmVkdW5kYW50IHN1YnNjcmlwdGlvblxuICAgICAgICBwYXJ0Lm9uKCdtZXNzYWdlcGFydHM6Y2hhbmdlJywgdGhpcy5fb25NZXNzYWdlUGFydENoYW5nZSwgdGhpcyk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGFkanVzdGVkUGFydHM7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgbGF5ZXIuTWVzc2FnZVBhcnQgdG8gdGhpcyBNZXNzYWdlLlxuICAgKlxuICAgKiBTaG91bGQgb25seSBiZSBjYWxsZWQgb24gYW4gdW5zZW50IE1lc3NhZ2UuXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlLmFkZFBhcnQoe21pbWVUeXBlOiAndGV4dC9wbGFpbicsIGJvZHk6ICdGcm9kbyByZWFsbHkgaXMgYSBEb2RvJ30pO1xuICAgKlxuICAgKiAvLyBPUlxuICAgKiBtZXNzYWdlLmFkZFBhcnQobmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHttaW1lVHlwZTogJ3RleHQvcGxhaW4nLCBib2R5OiAnRnJvZG8gcmVhbGx5IGlzIGEgRG9kbyd9KSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGFkZFBhcnRcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZVBhcnQvT2JqZWN0fSBwYXJ0IC0gQSBsYXllci5NZXNzYWdlUGFydCBpbnN0YW5jZSBvciBhIGB7bWltZVR5cGU6ICd0ZXh0L3BsYWluJywgYm9keTogJ0hlbGxvJ31gIGZvcm1hdHRlZCBPYmplY3QuXG4gICAqIEByZXR1cm5zIHtsYXllci5NZXNzYWdlfSB0aGlzXG4gICAqL1xuICBhZGRQYXJ0KHBhcnQpIHtcbiAgICBpZiAocGFydCkge1xuICAgICAgcGFydC5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgICBpZiAocGFydCBpbnN0YW5jZW9mIE1lc3NhZ2VQYXJ0KSB7XG4gICAgICAgIHRoaXMucGFydHMucHVzaChwYXJ0KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHBhcnQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRoaXMucGFydHMucHVzaChuZXcgTWVzc2FnZVBhcnQocGFydCkpO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnBhcnRzLmxlbmd0aCAtIDE7XG4gICAgICBjb25zdCB0aGVQYXJ0ID0gdGhpcy5wYXJ0c1tpbmRleF07XG5cbiAgICAgIHRoZVBhcnQub2ZmKCdtZXNzYWdlcGFydHM6Y2hhbmdlJywgdGhpcy5fb25NZXNzYWdlUGFydENoYW5nZSwgdGhpcyk7IC8vIGlmIHdlIGFscmVhZHkgc3Vic2NyaWJlZCwgZG9uJ3QgY3JlYXRlIGEgcmVkdW5kYW50IHN1YnNjcmlwdGlvblxuICAgICAgdGhlUGFydC5vbignbWVzc2FnZXBhcnRzOmNoYW5nZScsIHRoaXMuX29uTWVzc2FnZVBhcnRDaGFuZ2UsIHRoaXMpO1xuICAgICAgaWYgKCFwYXJ0LmlkKSBwYXJ0LmlkID0gYCR7dGhpcy5pZH0vcGFydHMvJHtpbmRleH1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBbnkgdGltZSBhIFBhcnQgY2hhbmdlcywgdGhlIE1lc3NhZ2UgaGFzIGNoYW5nZWQ7IHRyaWdnZXIgdGhlIGBtZXNzYWdlczpjaGFuZ2VgIGV2ZW50LlxuICAgKlxuICAgKiBDdXJyZW50bHksIHRoaXMgb25seSBsb29rcyBhdCBjaGFuZ2VzIHRvIGJvZHkgb3IgbWltZVR5cGUsIGFuZCBkb2VzIG5vdCBoYW5kbGUgY2hhbmdlcyB0byB1cmwvcmljaCBjb250ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9vbk1lc3NhZ2VQYXJ0Q2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NZXNzYWdlUGFydENoYW5nZShldnQpIHtcbiAgICBldnQuY2hhbmdlcy5mb3JFYWNoKChjaGFuZ2UpID0+IHtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgICBwcm9wZXJ0eTogJ3BhcnRzLicgKyBjaGFuZ2UucHJvcGVydHksXG4gICAgICAgIG9sZFZhbHVlOiBjaGFuZ2Uub2xkVmFsdWUsXG4gICAgICAgIG5ld1ZhbHVlOiBjaGFuZ2UubmV3VmFsdWUsXG4gICAgICAgIHBhcnQ6IGV2dC50YXJnZXQsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBZb3VyIHVuc2VudCBNZXNzYWdlIHdpbGwgc2hvdyB1cCBpbiBRdWVyeSByZXN1bHRzIGFuZCBiZSByZW5kZXJlZCBpbiBNZXNzYWdlIExpc3RzLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBvbmx5IG5lZWRlZCBmb3IgTWVzc2FnZXMgdGhhdCBzaG91bGQgc2hvdyB1cCBpbiBhIE1lc3NhZ2UgTGlzdCBXaWRnZXQgdGhhdFxuICAgKiBpcyBkcml2ZW4gYnkgUXVlcnkgZGF0YSwgYnV0IHdoZXJlIHRoZSBsYXllci5NZXNzYWdlLnNlbmQgbWV0aG9kIGhhcyBub3QgeWV0IGJlZW4gY2FsbGVkLlxuICAgKlxuICAgKiBPbmNlIHlvdSBoYXZlIGNhbGxlZCBgcHJlc2VuZGAgeW91ciBtZXNzYWdlIHNob3VsZCBzaG93IHVwIGluIHlvdXIgTWVzc2FnZSBMaXN0LiAgSG93ZXZlcixcbiAgICogdHlwaWNhbGx5IHlvdSB3YW50IHRvIGJlIGFibGUgdG8gZWRpdCBhbmQgcmVyZW5kZXIgdGhhdCBNZXNzYWdlLiBBZnRlciBtYWtpbmcgY2hhbmdlcyB0byB0aGUgTWVzc2FnZSxcbiAgICogeW91IGNhbiB0cmlnZ2VyIGNoYW5nZSBldmVudHM6XG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgbWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtwYXJ0czogW3ttaW1lVHlwZTogJ2N1c3RvbS9jYXJkJywgYm9keTogbnVsbH1dfSk7XG4gICAqIG1lc3NhZ2UucHJlc2VuZCgpO1xuICAgKlxuICAgKiBtZXNzYWdlLnBhcnRzWzBdLmJvZHkgPSAnRnJvZG8gaXMgYSBEb2RvJztcbiAgICogbWVzc2FnZS50cmlnZ2VyKCdtZXNzYWdlczpjaGFuZ2UnKTtcbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCBpZiB1c2luZyBMYXllciBVSSBmb3IgV2ViLCB0aGUgYG1lc3NhZ2VzOmNoYW5nZWAgZXZlbnQgd2lsbCB0cmlnZ2VyIGFuIGBvblJlcmVuZGVyYCBjYWxsLFxuICAgKiBub3QgYW4gYG9uUmVuZGVyYCBjYWxsLCBzbyB0aGUgY2FwYWNpdHkgdG8gaGFuZGxlIGVkaXRpbmcgb2YgbWVzc2FnZXMgd2lsbCByZXF1aXJlIHRoZSBhYmlsaXR5IHRvIHJlbmRlclxuICAgKiBhbGwgcG9zc2libGUgZWRpdHMgd2l0aGluIGBvblJlcmVuZGVyYC5cbiAgICpcbiAgICogSXQgaXMgYXNzdW1lZCB0aGF0IGF0IHNvbWUgcG9pbnQgZWl0aGVyIGBzZW5kKClgIG9yIGBkZXN0cm95KClgIHdpbGwgYmUgY2FsbGVkIG9uIHRoaXMgbWVzc2FnZVxuICAgKiB0byBjb21wbGV0ZSBvciBjYW5jZWwgdGhpcyBwcm9jZXNzLlxuICAgKlxuICAgKiBAbWV0aG9kIHByZXNlbmRcbiAgICovXG4gIHByZXNlbmQoKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jb252ZXJzYXRpb25NaXNzaW5nKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zeW5jU3RhdGUgIT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hbHJlYWR5U2VudCk7XG4gICAgfVxuICAgIGNvbnZlcnNhdGlvbi5fc2V0dXBNZXNzYWdlKHRoaXMpO1xuXG4gICAgLy8gTWFrZSBzdXJlIGFsbCBkYXRhIGlzIGluIHRoZSByaWdodCBmb3JtYXQgZm9yIGJlaW5nIHJlbmRlcmVkXG4gICAgdGhpcy5fcmVhZEFsbEJsb2JzKCgpID0+IHtcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIHRoZSBtZXNzYWdlIHRvIGFsbCBwYXJ0aWNpcGFudHMgb2YgdGhlIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogTWVzc2FnZSBtdXN0IGhhdmUgcGFydHMgYW5kIGEgdmFsaWQgY29udmVyc2F0aW9uIHRvIHNlbmQgc3VjY2Vzc2Z1bGx5LlxuICAgKlxuICAgKiBUaGUgc2VuZCBtZXRob2QgdGFrZXMgYSBgbm90aWZpY2F0aW9uYCBvYmplY3QuIEluIG5vcm1hbCB1c2UsIGl0IHByb3ZpZGVzIHRoZSBzYW1lIG5vdGlmaWNhdGlvbiB0byBBTExcbiAgICogcmVjaXBpZW50cywgYnV0IHlvdSBjYW4gY3VzdG9taXplIG5vdGlmaWNhdGlvbnMgb24gYSBwZXIgcmVjaXBpZW50IGJhc2lzLCBhcyB3ZWxsIGFzIGVtYmVkIGFjdGlvbnMgaW50byB0aGUgbm90aWZpY2F0aW9uLlxuICAgKiBGb3IgdGhlIEZ1bGwgQVBJLCBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubGF5ZXIuY29tL2RvY3MvcGxhdGZvcm0vbWVzc2FnZXMjbm90aWZpY2F0aW9uLWN1c3RvbWl6YXRpb24uXG4gICAqXG4gICAqIEZvciB0aGUgRnVsbCBBUEksIHNlZSBbU2VydmVyIERvY3NdKGh0dHBzOi8vZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL3BsYXRmb3JtL21lc3NhZ2VzI25vdGlmaWNhdGlvbi1jdXN0b21pemF0aW9uKS5cbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NhZ2Uuc2VuZCh7XG4gICAqICAgIHRpdGxlOiBcIk5ldyBIb2JiaXQgTWVzc2FnZVwiLFxuICAgKiAgICB0ZXh0OiBcIkZyb2RvLXRoZS1Eb2RvOiBIZWxsbyBTYW0sIHdoYXQgc2F5IHdlIHdhbHR6IGludG8gTW9yZG9yIGxpa2Ugd2Ugb3duIHRoZSBwbGFjZT9cIixcbiAgICogICAgc291bmQ6IFwid2hpbnlob2JiaXQuYWlmZlwiXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbbm90aWZpY2F0aW9uXSAtIFBhcmFtZXRlcnMgZm9yIGNvbnRyb2xpbmcgaG93IHRoZSBwaG9uZXMgbWFuYWdlIG5vdGlmaWNhdGlvbnMgb2YgdGhlIG5ldyBNZXNzYWdlLlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgU2VlIElPUyBhbmQgQW5kcm9pZCBkb2NzIGZvciBkZXRhaWxzLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW25vdGlmaWNhdGlvbi50aXRsZV0gLSBUaXRsZSB0byBzaG93IG9uIGxvY2sgc2NyZWVuIGFuZCBub3RpZmljYXRpb24gYmFyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbbm90aWZpY2F0aW9uLnRleHRdIC0gVGV4dCBvZiB5b3VyIG5vdGlmaWNhdGlvblxuICAgKiBAcGFyYW0ge3N0cmluZ30gW25vdGlmaWNhdGlvbi5zb3VuZF0gLSBOYW1lIG9mIGFuIGF1ZGlvIGZpbGUgb3Igb3RoZXIgc291bmQtcmVsYXRlZCBoaW50XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9IHRoaXNcbiAgICovXG4gIHNlbmQobm90aWZpY2F0aW9uKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbih0cnVlKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNvbnZlcnNhdGlvbk1pc3NpbmcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnN5bmNTdGF0ZSAhPT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmFscmVhZHlTZW50KTtcbiAgICB9XG5cblxuICAgIGlmIChjb252ZXJzYXRpb24uaXNMb2FkaW5nKSB7XG4gICAgICBjb252ZXJzYXRpb24ub25jZShjb252ZXJzYXRpb24uY29uc3RydWN0b3IuZXZlbnRQcmVmaXggKyAnOmxvYWRlZCcsICgpID0+IHRoaXMuc2VuZChub3RpZmljYXRpb24pKTtcbiAgICAgIGNvbnZlcnNhdGlvbi5fc2V0dXBNZXNzYWdlKHRoaXMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhcnRzIHx8ICF0aGlzLnBhcnRzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5wYXJ0c01pc3NpbmcpO1xuICAgIH1cblxuICAgIHRoaXMuX3NldFN5bmNpbmcoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBDb252ZXJzYXRpb24gaGFzIGJlZW4gY3JlYXRlZCBvbiB0aGUgc2VydmVyXG4gICAgLy8gYW5kIHVwZGF0ZSB0aGUgbGFzdE1lc3NhZ2UgcHJvcGVydHlcbiAgICBjb252ZXJzYXRpb24uc2VuZCh0aGlzKTtcblxuICAgIC8vIElmIHdlIGFyZSBzZW5kaW5nIGFueSBGaWxlL0Jsb2Igb2JqZWN0cywgYW5kIHRoZWlyIE1pbWUgVHlwZXMgbWF0Y2ggb3VyIHRlc3QsXG4gICAgLy8gd2FpdCB1bnRpbCB0aGUgYm9keSBpcyB1cGRhdGVkIHRvIGJlIGEgc3RyaW5nIHJhdGhlciB0aGFuIEZpbGUgYmVmb3JlIGNhbGxpbmcgX2FkZE1lc3NhZ2VcbiAgICAvLyB3aGljaCB3aWxsIGFkZCBpdCB0byB0aGUgUXVlcnkgUmVzdWx0cyBhbmQgcGFzcyB0aGlzIG9uIHRvIGEgcmVuZGVyZXIgdGhhdCBleHBlY3RzIFwidGV4dC9wbGFpblwiIHRvIGJlIGEgc3RyaW5nXG4gICAgLy8gcmF0aGVyIHRoYW4gYSBibG9iLlxuICAgIHRoaXMuX3JlYWRBbGxCbG9icygoKSA9PiB7XG4gICAgICAvLyBDYWxsaW5nIHRoaXMgd2lsbCBhZGQgdGhpcyB0byBhbnkgbGlzdGVuaW5nIFF1ZXJpZXMuLi4gc28gcG9zaXRpb24gbmVlZHMgdG8gaGF2ZSBiZWVuIHNldCBmaXJzdDtcbiAgICAgIC8vIGhhbmRsZWQgaW4gY29udmVyc2F0aW9uLnNlbmQodGhpcylcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcblxuICAgICAgLy8gYWxsb3cgZm9yIG1vZGlmaWNhdGlvbiBvZiBtZXNzYWdlIGJlZm9yZSBzZW5kaW5nXG4gICAgICB0aGlzLnRyaWdnZXIoJ21lc3NhZ2VzOnNlbmRpbmcnKTtcblxuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgcGFydHM6IG5ldyBBcnJheSh0aGlzLnBhcnRzLmxlbmd0aCksXG4gICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgfTtcbiAgICAgIGlmIChub3RpZmljYXRpb24gJiYgdGhpcy5jb252ZXJzYXRpb25JZCkgZGF0YS5ub3RpZmljYXRpb24gPSBub3RpZmljYXRpb247XG5cbiAgICAgIHRoaXMuX3ByZXBhcmVQYXJ0c0ZvclNlbmRpbmcoZGF0YSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQW55IE1lc3NhZ2VQYXJ0IHRoYXQgY29udGFpbnMgYSB0ZXh0dWFsIGJsb2Igc2hvdWxkIGNvbnRhaW4gYSBzdHJpbmcgYmVmb3JlIHdlIHNlbmQuXG4gICAqXG4gICAqIElmIGEgTWVzc2FnZVBhcnQgd2l0aCBhIEJsb2Igb3IgRmlsZSBhcyBpdHMgYm9keSB3ZXJlIHRvIGJlIGFkZGVkIHRvIHRoZSBDbGllbnQsXG4gICAqIFRoZSBRdWVyeSB3b3VsZCByZWNlaXZlIHRoaXMsIGRlbGl2ZXIgaXQgdG8gYXBwcyBhbmQgdGhlIGFwcCB3b3VsZCBjcmFzaC5cbiAgICogTW9zdCByZW5kZXJpbmcgY29kZSBleHBlY3RpbmcgdGV4dC9wbGFpbiB3b3VsZCBleHBlY3QgYSBzdHJpbmcgbm90IGEgRmlsZS5cbiAgICpcbiAgICogV2hlbiB0aGlzIHVzZXIgaXMgc2VuZGluZyBhIGZpbGUsIGFuZCB0aGF0IGZpbGUgaXMgdGV4dHVhbCwgbWFrZSBzdXJlXG4gICAqIGl0cyBhY3R1YWwgdGV4dCBkZWxpdmVyZWQgdG8gdGhlIFVJLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZWFkQWxsQmxvYnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZWFkQWxsQmxvYnMoY2FsbGJhY2spIHtcbiAgICBsZXQgY291bnQgPSAwO1xuICAgIGNvbnN0IHBhcnRzID0gdGhpcy5wYXJ0cy5maWx0ZXIocGFydCA9PiBVdGlsLmlzQmxvYihwYXJ0LmJvZHkpICYmIHBhcnQuaXNUZXh0dWFsTWltZVR5cGUoKSk7XG4gICAgcGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgVXRpbC5mZXRjaFRleHRGcm9tRmlsZShwYXJ0LmJvZHksICh0ZXh0KSA9PiB7XG4gICAgICAgIHBhcnQuYm9keSA9IHRleHQ7XG4gICAgICAgIGNvdW50Kys7XG4gICAgICAgIGlmIChjb3VudCA9PT0gcGFydHMubGVuZ3RoKSBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKCFwYXJ0cy5sZW5ndGgpIGNhbGxiYWNrKCk7XG4gIH1cblxuICAvKipcbiAgICogSW5zdXJlcyB0aGF0IGVhY2ggcGFydCBpcyByZWFkeSB0byBzZW5kIGJlZm9yZSBhY3R1YWxseSBzZW5kaW5nIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcmVwYXJlUGFydHNGb3JTZW5kaW5nXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RydWN0dXJlIHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlclxuICAgKi9cbiAgX3ByZXBhcmVQYXJ0c0ZvclNlbmRpbmcoZGF0YSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICB0aGlzLnBhcnRzLmZvckVhY2goKHBhcnQsIGluZGV4KSA9PiB7XG4gICAgICBwYXJ0Lm9uY2UoJ3BhcnRzOnNlbmQnLCAoZXZ0KSA9PiB7XG4gICAgICAgIGRhdGEucGFydHNbaW5kZXhdID0ge1xuICAgICAgICAgIG1pbWVfdHlwZTogZXZ0Lm1pbWVfdHlwZSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGV2dC5jb250ZW50KSBkYXRhLnBhcnRzW2luZGV4XS5jb250ZW50ID0gZXZ0LmNvbnRlbnQ7XG4gICAgICAgIGlmIChldnQuYm9keSkgZGF0YS5wYXJ0c1tpbmRleF0uYm9keSA9IGV2dC5ib2R5O1xuICAgICAgICBpZiAoZXZ0LmVuY29kaW5nKSBkYXRhLnBhcnRzW2luZGV4XS5lbmNvZGluZyA9IGV2dC5lbmNvZGluZztcblxuICAgICAgICBjb3VudCsrO1xuICAgICAgICBpZiAoY291bnQgPT09IHRoaXMucGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgdGhpcy5fc2VuZChkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgICBwYXJ0Ll9zZW5kKGNsaWVudCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIHRoZSBhY3R1YWwgc2VuZGluZy5cbiAgICpcbiAgICogbGF5ZXIuTWVzc2FnZS5zZW5kIGhhcyBzb21lIHBvdGVudGlhbGx5IGFzeW5jaHJvbm91c1xuICAgKiBwcmVwcm9jZXNzaW5nIHRvIGRvIGJlZm9yZSBzZW5kaW5nIChSaWNoIENvbnRlbnQpOyBhY3R1YWwgc2VuZGluZ1xuICAgKiBpcyBkb25lIGhlcmUuXG4gICAqXG4gICAqIEBtZXRob2QgX3NlbmRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZW5kKGRhdGEpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcblxuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX3RyaWdnZXJBc3luYygnc3RhdGUtY2hhbmdlJywge1xuICAgICAgc3RhcnRlZDogdHJ1ZSxcbiAgICAgIHR5cGU6ICdzZW5kXycgKyBVdGlsLnR5cGVGcm9tSUQodGhpcy5pZCksXG4gICAgICB0ZWxlbWV0cnlJZDogJ3NlbmRfJyArIFV0aWwudHlwZUZyb21JRCh0aGlzLmlkKSArICdfdGltZScsXG4gICAgICBpZDogdGhpcy5pZCxcbiAgICB9KTtcbiAgICB0aGlzLnNlbnRBdCA9IG5ldyBEYXRlKCk7XG4gICAgY2xpZW50LnNlbmRTb2NrZXRSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keToge1xuICAgICAgICBtZXRob2Q6ICdNZXNzYWdlLmNyZWF0ZScsXG4gICAgICAgIG9iamVjdF9pZDogY29udmVyc2F0aW9uLmlkLFxuICAgICAgICBkYXRhLFxuICAgICAgfSxcbiAgICAgIHN5bmM6IHtcbiAgICAgICAgZGVwZW5kczogW3RoaXMuY29udmVyc2F0aW9uSWQsIHRoaXMuaWRdLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuaWQsXG4gICAgICB9LFxuICAgIH0sIChzdWNjZXNzLCBzb2NrZXREYXRhKSA9PiB0aGlzLl9zZW5kUmVzdWx0KHN1Y2Nlc3MsIHNvY2tldERhdGEpKTtcbiAgfVxuXG4gIF9nZXRTZW5kRGF0YShkYXRhKSB7XG4gICAgZGF0YS5vYmplY3RfaWQgPSB0aGlzLmNvbnZlcnNhdGlvbklkO1xuICAgIHJldHVybiBkYXRhO1xuICB9XG5cbiAgLyoqXG4gICAgKiBsYXllci5NZXNzYWdlLnNlbmQoKSBTdWNjZXNzIENhbGxiYWNrLlxuICAgICpcbiAgICAqIElmIHN1Y2Nlc3NmdWxseSBzZW5kaW5nIHRoZSBtZXNzYWdlOyB0cmlnZ2VycyBhICdzZW50JyBldmVudCxcbiAgICAqIGFuZCB1cGRhdGVzIHRoZSBtZXNzYWdlLmlkL3VybFxuICAgICpcbiAgICAqIEBtZXRob2QgX3NlbmRSZXN1bHRcbiAgICAqIEBwcml2YXRlXG4gICAgKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZURhdGEgLSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgdGhlIG1lc3NhZ2VcbiAgICAqL1xuICBfc2VuZFJlc3VsdCh7IHN1Y2Nlc3MsIGRhdGEgfSkge1xuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX3RyaWdnZXJBc3luYygnc3RhdGUtY2hhbmdlJywge1xuICAgICAgZW5kZWQ6IHRydWUsXG4gICAgICB0eXBlOiAnc2VuZF8nICsgVXRpbC50eXBlRnJvbUlEKHRoaXMuaWQpLFxuICAgICAgdGVsZW1ldHJ5SWQ6ICdzZW5kXycgKyBVdGlsLnR5cGVGcm9tSUQodGhpcy5pZCkgKyAnX3RpbWUnLFxuICAgICAgcmVzdWx0OiBzdWNjZXNzLFxuICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIoZGF0YSk7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOnNlbnQnKTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgICBwcm9wZXJ0eTogJ3N5bmNTdGF0ZScsXG4gICAgICAgIG9sZFZhbHVlOiBDb25zdGFudHMuU1lOQ19TVEFURS5TQVZJTkcsXG4gICAgICAgIG5ld1ZhbHVlOiBDb25zdGFudHMuU1lOQ19TVEFURS5TWU5DRUQsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKCdtZXNzYWdlczpzZW50LWVycm9yJywgeyBlcnJvcjogZGF0YSB9KTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcbiAgfVxuXG4gIC8qIE5PVCBGT1IgSlNEVUNLXG4gICAqIFN0YW5kYXJkIGBvbigpYCBwcm92aWRlZCBieSBsYXllci5Sb290LlxuICAgKlxuICAgKiBBZGRzIHNvbWUgc3BlY2lhbCBoYW5kbGluZyBvZiAnbWVzc2FnZXM6bG9hZGVkJyBzbyB0aGF0IGNhbGxzIHN1Y2ggYXNcbiAgICpcbiAgICogICAgICB2YXIgbSA9IGNsaWVudC5nZXRNZXNzYWdlKCdsYXllcjovLy9tZXNzYWdlcy8xMjMnLCB0cnVlKVxuICAgKiAgICAgIC5vbignbWVzc2FnZXM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIG15cmVyZW5kZXIobSk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgbXlyZW5kZXIobSk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBtIHVudGlsIHRoZSBkZXRhaWxzIG9mIG0gaGF2ZSBsb2FkZWRcbiAgICpcbiAgICogY2FuIGZpcmUgdGhlaXIgY2FsbGJhY2sgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjbGllbnQgbG9hZHMgb3IgaGFzXG4gICAqIGFscmVhZHkgbG9hZGVkIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIG9uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZlbnROYW1lXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBldmVudEhhbmRsZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgY29uc3QgaGFzTG9hZGVkRXZ0ID0gbmFtZSA9PT0gJ21lc3NhZ2VzOmxvYWRlZCcgfHxcbiAgICAgIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyAmJiBuYW1lWydtZXNzYWdlczpsb2FkZWQnXSk7XG5cbiAgICBpZiAoaGFzTG9hZGVkRXZ0ICYmICF0aGlzLmlzTG9hZGluZykge1xuICAgICAgY29uc3QgY2FsbE5vdyA9IG5hbWUgPT09ICdtZXNzYWdlczpsb2FkZWQnID8gY2FsbGJhY2sgOiBuYW1lWydtZXNzYWdlczpsb2FkZWQnXTtcbiAgICAgIFV0aWwuZGVmZXIoKCkgPT4gY2FsbE5vdy5hcHBseShjb250ZXh0KSk7XG4gICAgfVxuICAgIHN1cGVyLm9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhpcyBNZXNzYWdlIGZyb20gdGhlIHN5c3RlbS5cbiAgICpcbiAgICogVGhpcyB3aWxsIGRlcmVnaXN0ZXIgdGhlIE1lc3NhZ2UsIHJlbW92ZSBhbGwgZXZlbnRzXG4gICAqIGFuZCBhbGxvdyBnYXJiYWdlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIGNsaWVudC5fcmVtb3ZlTWVzc2FnZSh0aGlzKTtcbiAgICB0aGlzLnBhcnRzLmZvckVhY2gocGFydCA9PiBwYXJ0LmRlc3Ryb3koKSk7XG4gICAgdGhpcy5fX3BhcnRzID0gbnVsbDtcblxuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR1cCBtZXNzYWdlLXBhcnQgaWRzIGZvciBwYXJ0cyB0aGF0IGxhY2sgdGhhdCBpZDsgZm9yIGxvY2FsbHkgY3JlYXRlZCBwYXJ0cy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VQYXJ0W119IHBhcnRzXG4gICAqL1xuICBfc2V0dXBQYXJ0SWRzKHBhcnRzKSB7XG4gICAgLy8gQXNzaWduIElEcyB0byBwcmVleGlzdGluZyBQYXJ0cyBzbyB0aGF0IHdlIGNhbiBjYWxsIGdldFBhcnRCeUlkKClcbiAgICBpZiAocGFydHMpIHtcbiAgICAgIHBhcnRzLmZvckVhY2goKHBhcnQsIGluZGV4KSA9PiB7XG4gICAgICAgIGlmICghcGFydC5pZCkgcGFydC5pZCA9IGAke3RoaXMuaWR9L3BhcnRzLyR7aW5kZXh9YDtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhpcyBpbnN0YW5jZSB3aXRoIHRoZSBkZXNjcmlwdGlvbiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbiBiZSB1c2VkIGZvciBjcmVhdGluZyBvciBmb3IgdXBkYXRpbmcgdGhlIGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG0gLSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgdGhlIG1lc3NhZ2VcbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIobWVzc2FnZSkge1xuICAgIHRoaXMuX2luUG9wdWxhdGVGcm9tU2VydmVyID0gdHJ1ZTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgdGhpcy5pZCA9IG1lc3NhZ2UuaWQ7XG4gICAgdGhpcy51cmwgPSBtZXNzYWdlLnVybDtcbiAgICBjb25zdCBvbGRQb3NpdGlvbiA9IHRoaXMucG9zaXRpb247XG4gICAgdGhpcy5wb3NpdGlvbiA9IG1lc3NhZ2UucG9zaXRpb247XG4gICAgdGhpcy5fc2V0dXBQYXJ0SWRzKG1lc3NhZ2UucGFydHMpO1xuICAgIHRoaXMucGFydHMgPSBtZXNzYWdlLnBhcnRzLm1hcCgocGFydCkgPT4ge1xuICAgICAgY29uc3QgZXhpc3RpbmdQYXJ0ID0gdGhpcy5nZXRQYXJ0QnlJZChwYXJ0LmlkKTtcbiAgICAgIGlmIChleGlzdGluZ1BhcnQpIHtcbiAgICAgICAgZXhpc3RpbmdQYXJ0Ll9wb3B1bGF0ZUZyb21TZXJ2ZXIocGFydCk7XG4gICAgICAgIHJldHVybiBleGlzdGluZ1BhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gTWVzc2FnZVBhcnQuX2NyZWF0ZUZyb21TZXJ2ZXIocGFydCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlY2lwaWVudFN0YXR1cyA9IG1lc3NhZ2UucmVjaXBpZW50X3N0YXR1cyB8fCB7fTtcblxuICAgIHRoaXMuaXNSZWFkID0gJ2lzX3VucmVhZCcgaW4gbWVzc2FnZSA/ICFtZXNzYWdlLmlzX3VucmVhZCA6IHRydWU7XG5cbiAgICB0aGlzLnNlbnRBdCA9IG5ldyBEYXRlKG1lc3NhZ2Uuc2VudF9hdCk7XG4gICAgdGhpcy5yZWNlaXZlZEF0ID0gbWVzc2FnZS5yZWNlaXZlZF9hdCA/IG5ldyBEYXRlKG1lc3NhZ2UucmVjZWl2ZWRfYXQpIDogdW5kZWZpbmVkO1xuXG4gICAgbGV0IHNlbmRlcjtcbiAgICBpZiAobWVzc2FnZS5zZW5kZXIuaWQpIHtcbiAgICAgIHNlbmRlciA9IGNsaWVudC5nZXRJZGVudGl0eShtZXNzYWdlLnNlbmRlci5pZCk7XG4gICAgfVxuXG4gICAgLy8gQmVjYXVzZSB0aGVyZSBtYXkgYmUgbm8gSUQsIHdlIGhhdmUgdG8gYnlwYXNzIGNsaWVudC5fY3JlYXRlT2JqZWN0IGFuZCBpdHMgc3dpdGNoIHN0YXRlbWVudC5cbiAgICBpZiAoIXNlbmRlcikge1xuICAgICAgc2VuZGVyID0gSWRlbnRpdHkuX2NyZWF0ZUZyb21TZXJ2ZXIobWVzc2FnZS5zZW5kZXIsIGNsaWVudCk7XG4gICAgfVxuICAgIHRoaXMuc2VuZGVyID0gc2VuZGVyO1xuXG4gICAgdGhpcy5fc2V0U3luY2VkKCk7XG5cbiAgICBpZiAob2xkUG9zaXRpb24gJiYgb2xkUG9zaXRpb24gIT09IHRoaXMucG9zaXRpb24pIHtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgICBvbGRWYWx1ZTogb2xkUG9zaXRpb24sXG4gICAgICAgIG5ld1ZhbHVlOiB0aGlzLnBvc2l0aW9uLFxuICAgICAgICBwcm9wZXJ0eTogJ3Bvc2l0aW9uJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIE1lc3NhZ2UncyBsYXllci5NZXNzYWdlUGFydCB3aXRoIHRoZSBzcGVjaWZpZWQgdGhlIHBhcnQgSUQuXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgcGFydCA9IGNsaWVudC5nZXRNZXNzYWdlUGFydCgnbGF5ZXI6Ly8vbWVzc2FnZXMvNmYwOGFjZmEtMzI2OC00YWU1LTgzZDktNmNhMDAwMDAwMDAvcGFydHMvMCcpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBnZXRQYXJ0QnlJZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGFydElkXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2VQYXJ0fVxuICAgKi9cbiAgZ2V0UGFydEJ5SWQocGFydElkKSB7XG4gICAgY29uc3QgcGFydCA9IHRoaXMucGFydHMgPyB0aGlzLnBhcnRzLmZpbHRlcihhUGFydCA9PiBhUGFydC5pZCA9PT0gcGFydElkKVswXSA6IG51bGw7XG4gICAgcmV0dXJuIHBhcnQgfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY2NlcHRzIGpzb24tcGF0Y2ggb3BlcmF0aW9ucyBmb3IgbW9kaWZ5aW5nIHJlY2lwaWVudFN0YXR1cy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUGF0Y2hFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3RbXX0gZGF0YSAtIEFycmF5IG9mIG9wZXJhdGlvbnNcbiAgICovXG4gIF9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpIHtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgaWYgKHBhdGhzWzBdLmluZGV4T2YoJ3JlY2lwaWVudF9zdGF0dXMnKSA9PT0gMCkge1xuICAgICAgdGhpcy5fX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyh0aGlzLnJlY2lwaWVudFN0YXR1cywgb2xkVmFsdWUpO1xuICAgIH1cbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFic29sdXRlIFVSTCBmb3IgdGhpcyByZXNvdXJjZS5cbiAgICogVXNlZCBieSBzeW5jIG1hbmFnZXIgYmVjYXVzZSB0aGUgdXJsIG1heSBub3QgYmUga25vd25cbiAgICogYXQgdGhlIHRpbWUgdGhlIHN5bmMgcmVxdWVzdCBpcyBlbnF1ZXVlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0VXJsXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgLSByZWxhdGl2ZSB1cmwgYW5kIHF1ZXJ5IHN0cmluZyBwYXJhbWV0ZXJzXG4gICAqIEByZXR1cm4ge1N0cmluZ30gZnVsbCB1cmxcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsICsgKHVybCB8fCAnJyk7XG4gIH1cblxuICBfc2V0dXBTeW5jT2JqZWN0KHN5bmMpIHtcbiAgICBpZiAoc3luYyAhPT0gZmFsc2UpIHtcbiAgICAgIHN5bmMgPSBzdXBlci5fc2V0dXBTeW5jT2JqZWN0KHN5bmMpO1xuICAgICAgaWYgKCFzeW5jLmRlcGVuZHMpIHtcbiAgICAgICAgc3luYy5kZXBlbmRzID0gW3RoaXMuY29udmVyc2F0aW9uSWRdO1xuICAgICAgfSBlbHNlIGlmIChzeW5jLmRlcGVuZHMuaW5kZXhPZih0aGlzLmlkKSA9PT0gLTEpIHtcbiAgICAgICAgc3luYy5kZXBlbmRzLnB1c2godGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzeW5jO1xuICB9XG5cblxuICAvKipcbiAgICogR2V0IGFsbCB0ZXh0IHBhcnRzIG9mIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBVdGlsaXR5IG1ldGhvZCBmb3IgZXh0cmFjdGluZyBhbGwgb2YgdGhlIHRleHQvcGxhaW4gcGFydHNcbiAgICogYW5kIGNvbmNhdGVuYXRpbmcgYWxsIG9mIHRoZWlyIGJvZHlzIHRvZ2V0aGVyIGludG8gYSBzaW5nbGUgc3RyaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldFRleHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtqb2luU3RyPScuICAnXSBJZiBtdWx0aXBsZSBtZXNzYWdlIHBhcnRzIG9mIHR5cGUgdGV4dC9wbGFpbiwgaG93IGRvIHlvdSB3YW50IHRoZW0gam9pbmVkIHRvZ2V0aGVyP1xuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KGpvaW5TdHIgPSAnLiAnKSB7XG4gICAgbGV0IHRleHRBcnJheSA9IHRoaXMucGFydHNcbiAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lm1pbWVUeXBlID09PSAndGV4dC9wbGFpbicpXG4gICAgICAubWFwKHBhcnQgPT4gcGFydC5ib2R5KTtcbiAgICB0ZXh0QXJyYXkgPSB0ZXh0QXJyYXkuZmlsdGVyKGRhdGEgPT4gZGF0YSk7XG4gICAgcmV0dXJuIHRleHRBcnJheS5qb2luKGpvaW5TdHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwbGFpbiBvYmplY3QuXG4gICAqXG4gICAqIE9iamVjdCB3aWxsIGhhdmUgYWxsIHRoZSBzYW1lIHB1YmxpYyBwcm9wZXJ0aWVzIGFzIHRoaXNcbiAgICogTWVzc2FnZSBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcyBvYmplY3QuXG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICBpZiAoIXRoaXMuX3RvT2JqZWN0KSB7XG4gICAgICB0aGlzLl90b09iamVjdCA9IHN1cGVyLnRvT2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZGVudGlmaWVzIHdoZXRoZXIgYSBNZXNzYWdlIHJlY2VpdmluZyB0aGUgc3BlY2lmaWVkIHBhdGNoIGRhdGEgc2hvdWxkIGJlIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEFwcGxpZXMgb25seSB0byBNZXNzYWdlcyB0aGF0IGFyZW4ndCBhbHJlYWR5IGxvYWRlZDsgdXNlZCB0byBpbmRpY2F0ZSBpZiBhIGNoYW5nZSBldmVudCBpc1xuICAgKiBzaWduaWZpY2FudCBlbm91Z2ggdG8gbG9hZCB0aGUgTWVzc2FnZSBhbmQgdHJpZ2dlciBjaGFuZ2UgZXZlbnRzIG9uIHRoYXQgTWVzc2FnZS5cbiAgICpcbiAgICogQXQgdGhpcyB0aW1lIHRoZXJlIGFyZSBubyBwcm9wZXJ0aWVzIHRoYXQgYXJlIHBhdGNoZWQgb24gTWVzc2FnZXMgdmlhIHdlYnNvY2tldHNcbiAgICogdGhhdCB3b3VsZCBqdXN0aWZ5IGxvYWRpbmcgdGhlIE1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyIHNvIGFzIHRvIG5vdGlmeSB0aGUgYXBwLlxuICAgKlxuICAgKiBPbmx5IHJlY2lwaWVudCBzdGF0dXMgY2hhbmdlcyBhbmQgbWF5YmUgaXNfdW5yZWFkIGNoYW5nZXMgYXJlIHNlbnQ7XG4gICAqIG5laXRoZXIgb2Ygd2hpY2ggYXJlIHJlbGV2YW50IHRvIGFuIGFwcCB0aGF0IGlzbid0IHJlbmRlcmluZyB0aGF0IG1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRSZXNvdXJjZUZvclBhdGNoXG4gICAqIEBzdGF0aWNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBfbG9hZFJlc291cmNlRm9yUGF0Y2gocGF0Y2hEYXRhKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogQ2xpZW50IHRoYXQgdGhlIE1lc3NhZ2UgYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmNsaWVudElkID0gJyc7XG5cbi8qKlxuICogQ29udmVyc2F0aW9uIElEIG9yIENoYW5uZWwgSUQgdGhhdCB0aGlzIE1lc3NhZ2UgYmVsb25ncyB0by5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmNvbnZlcnNhdGlvbklkID0gJyc7XG5cbi8qKlxuICogQXJyYXkgb2YgbGF5ZXIuTWVzc2FnZVBhcnQgb2JqZWN0cy5cbiAqXG4gKiBVc2UgbGF5ZXIuTWVzc2FnZS5hZGRQYXJ0IHRvIG1vZGlmeSB0aGlzIGFycmF5LlxuICpcbiAqIEB0eXBlIHtsYXllci5NZXNzYWdlUGFydFtdfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnBhcnRzID0gbnVsbDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIG1lc3NhZ2Ugd2FzIHNlbnQuXG4gKlxuICogIE5vdGUgdGhhdCBhIGxvY2FsbHkgY3JlYXRlZCBsYXllci5NZXNzYWdlIHdpbGwgaGF2ZSBhIGBzZW50QXRgIHZhbHVlIGV2ZW5cbiAqIHRob3VnaCBpdHMgbm90IHlldCBzZW50OyB0aGlzIGlzIHNvIHRoYXQgYW55IHJlbmRlcmluZyBjb2RlIGRvZXNuJ3QgbmVlZFxuICogdG8gYWNjb3VudCBmb3IgYG51bGxgIHZhbHVlcy4gIFNlbmRpbmcgdGhlIE1lc3NhZ2UgbWF5IGNhdXNlIGEgc2xpZ2h0IGNoYW5nZVxuICogaW4gdGhlIGBzZW50QXRgIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtEYXRlfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnNlbnRBdCA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBmaXJzdCBkZWxpdmVyeSByZWNlaXB0IHdhcyBzZW50IGJ5IHlvdXJcbiAqIHVzZXIgYWNrbm93bGVkZ2luZyByZWNlaXB0IG9mIHRoZSBtZXNzYWdlLlxuICogQHR5cGUge0RhdGV9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUucmVjZWl2ZWRBdCA9IG51bGw7XG5cbi8qKlxuICogSWRlbnRpdHkgb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgc2VuZGVyIG9mIHRoZSBNZXNzYWdlLlxuICpcbiAqIE1vc3QgY29tbW9ubHkgdXNlZCBwcm9wZXJ0aWVzIG9mIElkZW50aXR5IGFyZTpcbiAqICogZGlzcGxheU5hbWU6IEEgbmFtZSBmb3IgeW91ciBVSVxuICogKiB1c2VySWQ6IE5hbWUgZm9yIHRoZSB1c2VyIGFzIHJlcHJlc2VudGVkIG9uIHlvdXIgc3lzdGVtXG4gKiAqIG5hbWU6IFJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBzZXJ2aWNlIGlmIHRoZSBzZW5kZXIgd2FzIGFuIGF1dG9tYXRlZCBzeXN0ZW0uXG4gKlxuICogICAgICA8c3BhbiBjbGFzcz0nc2VudC1ieSc+XG4gKiAgICAgICAge21lc3NhZ2Uuc2VuZGVyLmRpc3BsYXlOYW1lIHx8IG1lc3NhZ2Uuc2VuZGVyLm5hbWV9XG4gKiAgICAgIDwvc3Bhbj5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuSWRlbnRpdHl9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuc2VuZGVyID0gbnVsbDtcblxuLyoqXG4gKiBQb3NpdGlvbiBvZiB0aGlzIG1lc3NhZ2Ugd2l0aGluIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogTk9URVM6XG4gKlxuICogMS4gRGVsZXRpbmcgYSBtZXNzYWdlIGRvZXMgbm90IGFmZmVjdCBwb3NpdGlvbiBvZiBvdGhlciBNZXNzYWdlcy5cbiAqIDIuIEEgcG9zaXRpb24gaXMgbm90IGdhdXJlbnRlZWQgdG8gYmUgdW5pcXVlIChtdWx0aXBsZSBtZXNzYWdlcyBzZW50IGF0IHRoZSBzYW1lIHRpbWUgY291bGRcbiAqIGFsbCBjbGFpbSB0aGUgc2FtZSBwb3NpdGlvbilcbiAqIDMuIEVhY2ggc3VjY2Vzc2l2ZSBtZXNzYWdlIHdpdGhpbiBhIGNvbnZlcnNhdGlvbiBzaG91bGQgZXhwZWN0IGEgaGlnaGVyIHBvc2l0aW9uLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUucG9zaXRpb24gPSAwO1xuXG4vKipcbiAqIEhpbnQgdXNlZCBieSBsYXllci5DbGllbnQgb24gd2hldGhlciB0byB0cmlnZ2VyIGEgbWVzc2FnZXM6bm90aWZ5IGV2ZW50LlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuX25vdGlmeSA9IGZhbHNlO1xuXG4vKipcbiAqIFRoaXMgcHJvcGVydHkgaXMgaGVyZSBmb3IgY29udmVuaWVuY2Ugb25seTsgaXQgd2lsbCBhbHdheXMgYmUgdGhlIG9wcG9zaXRlIG9mIGlzUmVhZC5cbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNZXNzYWdlLnByb3RvdHlwZSwgJ2lzVW5yZWFkJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNSZWFkO1xuICB9LFxufSk7XG5cblxuTWVzc2FnZS5wcm90b3R5cGUuX3RvT2JqZWN0ID0gbnVsbDtcblxuTWVzc2FnZS5wcm90b3R5cGUuX2luUG9wdWxhdGVGcm9tU2VydmVyID0gZmFsc2U7XG5cbk1lc3NhZ2UuZXZlbnRQcmVmaXggPSAnbWVzc2FnZXMnO1xuXG5NZXNzYWdlLmV2ZW50UHJlZml4ID0gJ21lc3NhZ2VzJztcblxuTWVzc2FnZS5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL21lc3NhZ2VzLyc7XG5cbk1lc3NhZ2UuaW5PYmplY3RJZ25vcmUgPSBTeW5jYWJsZS5pbk9iamVjdElnbm9yZTtcblxuTWVzc2FnZS5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG5NZXNzYWdlLmltYWdlVHlwZXMgPSBbXG4gICdpbWFnZS9naWYnLFxuICAnaW1hZ2UvcG5nJyxcbiAgJ2ltYWdlL2pwZWcnLFxuICAnaW1hZ2UvanBnJyxcbl07XG5cbk1lc3NhZ2UuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuICAvKipcbiAgICogTWVzc2FnZSBoYXMgYmVlbiBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLk1lc3NhZ2UubG9hZCgpIG1ldGhvZC5cbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UoJ2xheWVyOi8vL21lc3NhZ2VzLzEyMycsIHRydWUpXG4gICAqICAgIC5vbignbWVzc2FnZXM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICBteXJlcmVuZGVyKG0pO1xuICAgKiAgICB9KTtcbiAgICogbXlyZW5kZXIobSk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBtIHVudGlsIHRoZSBkZXRhaWxzIG9mIG0gaGF2ZSBsb2FkZWRcbiAgICogYGBgXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOmxvYWRlZCcsXG5cbiAgLyoqXG4gICAqIFRoZSBsb2FkIG1ldGhvZCBmYWlsZWQgdG8gbG9hZCB0aGUgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuTWVzc2FnZS5sb2FkKCkgbWV0aG9kLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpsb2FkZWQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBNZXNzYWdlIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYXVzZWQgYnkgYSBjYWxsIHRvIGxheWVyLk1lc3NhZ2UuZGVsZXRlKCkgb3IgYSB3ZWJzb2NrZXQgZXZlbnQuXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBldmVudFxuICAgKi9cbiAgJ21lc3NhZ2VzOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgaXMgYWJvdXQgdG8gYmUgc2VudC5cbiAgICpcbiAgICogTGFzdCBjaGFuY2UgdG8gbW9kaWZ5IG9yIHZhbGlkYXRlIHRoZSBtZXNzYWdlIHByaW9yIHRvIHNlbmRpbmcuXG4gICAqXG4gICAqICAgICBtZXNzYWdlLm9uKCdtZXNzYWdlczpzZW5kaW5nJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICBtZXNzYWdlLmFkZFBhcnQoe21pbWVUeXBlOiAnYXBwbGljYXRpb24vbG9jYXRpb24nLCBib2R5OiBKU09OLnN0cmluZ2lmeShnZXRHUFNMb2NhdGlvbigpKX0pO1xuICAgKiAgICAgfSk7XG4gICAqXG4gICAqIFR5cGljYWxseSwgeW91IHdvdWxkIGxpc3RlbiB0byB0aGlzIGV2ZW50IG1vcmUgYnJvYWRseSB1c2luZyBgY2xpZW50Lm9uKCdtZXNzYWdlczpzZW5kaW5nJylgXG4gICAqIHdoaWNoIHdvdWxkIHRyaWdnZXIgYmVmb3JlIHNlbmRpbmcgQU5ZIE1lc3NhZ2VzLlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpzZW5kaW5nJyxcblxuICAvKipcbiAgICogTWVzc2FnZSBoYXMgYmVlbiByZWNlaXZlZCBieSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBJdCBkb2VzIE5PVCBpbmRpY2F0ZSBkZWxpdmVyeSB0byBvdGhlciB1c2Vycy5cbiAgICpcbiAgICogSXQgZG9lcyBOT1QgaW5kaWNhdGUgbWVzc2FnZXMgc2VudCBieSBvdGhlciB1c2Vycy5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6c2VudCcsXG5cbiAgLyoqXG4gICAqIFNlcnZlciBmYWlsZWQgdG8gcmVjZWl2ZSB0aGUgTWVzc2FnZS5cbiAgICpcbiAgICogTWVzc2FnZSB3aWxsIGJlIGRlbGV0ZWQgaW1tZWRpYXRlbHkgYWZ0ZXIgZmlyaW5nIHRoaXMgZXZlbnQuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2dC5lcnJvclxuICAgKi9cbiAgJ21lc3NhZ2VzOnNlbnQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBUaGUgcmVjaXBpZW50U3RhdHVzIHByb3BlcnR5IGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBUaGlzIGhhcHBlbnMgaW4gcmVzcG9uc2UgdG8gYW4gdXBkYXRlXG4gICAqIGZyb20gdGhlIHNlcnZlci4uLiBidXQgaXMgYWxzbyBjYXVzZWQgYnkgbWFya2luZyB0aGUgY3VycmVudCB1c2VyIGFzIGhhdmluZyByZWFkXG4gICAqIG9yIHJlY2VpdmVkIHRoZSBtZXNzYWdlLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpjaGFuZ2UnLFxuXG5cbl0uY29uY2F0KFN5bmNhYmxlLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShNZXNzYWdlLCBbTWVzc2FnZSwgJ01lc3NhZ2UnXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goTWVzc2FnZSk7XG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2U7XG4iXX0=
