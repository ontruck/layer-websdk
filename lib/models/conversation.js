'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A Conversation object represents a dialog amongst a small set
 * of participants.
 *
 * Create a Conversation using the client:
 *
 *      var conversation = client.createConversation({
 *          participants: ['a','b'],
 *          distinct: true
 *      });
 *
 * NOTE:   Do not create a conversation with new layer.Conversation(...),
 *         This will fail to handle the distinct property short of going to the server for evaluation.
 *
 * NOTE:   Creating a Conversation is a local action.  A Conversation will not be
 *         sent to the server until either:
 *
 * 1. A message is sent on that Conversation
 * 2. `Conversation.send()` is called (not recommended as mobile clients
 *    expect at least one layer.Message.ConversationMessage in a Conversation)
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Conversation.id: this property is worth being familiar with; it identifies the
 *   Conversation and can be used in `client.getConversation(id)` to retrieve it.
 * * layer.Conversation.lastMessage: This property makes it easy to show info about the most recent Message
 *    when rendering a list of Conversations.
 * * layer.Conversation.metadata: Custom data for your Conversation; commonly used to store a 'title' property
 *    to name your Conversation.
 *
 * Methods:
 *
 * * layer.Conversation.addParticipants and layer.Conversation.removeParticipants: Change the participants of the Conversation
 * * layer.Conversation.setMetadataProperties: Set metadata.title to 'My Conversation with Layer Support' (uh oh)
 * * layer.Conversation.on() and layer.Conversation.off(): event listeners built on top of the `backbone-events-standalone` npm project
 * * layer.Conversation.leave() to leave the Conversation
 * * layer.Conversation.delete() to delete the Conversation for all users (or for just this user)
 *
 * Events:
 *
 * * `conversations:change`: Useful for observing changes to participants and metadata
 *   and updating rendering of your open Conversation
 *
 * Finally, to access a list of Messages in a Conversation, see layer.Query.
 *
 * @class  layer.Conversation
 * @extends layer.Container
 * @author  Michael Kantor
 */

var Root = require('../root');
var Syncable = require('./syncable');
var Container = require('./container');
var ConversationMessage = require('./conversation-message');
var LayerError = require('../layer-error');
var Util = require('../client-utils');
var Constants = require('../const');
var LayerEvent = require('../layer-event');

var Conversation = function (_Container) {
  _inherits(Conversation, _Container);

  /**
   * Create a new conversation.
   *
   * The static `layer.Conversation.create()` method
   * will correctly lookup distinct Conversations and
   * return them; `new layer.Conversation()` will not.
   *
   * Developers should use `layer.Conversation.create()`.
   *
   * @method constructor
   * @protected
   * @param  {Object} options
   * @param {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity instances
   * @param {boolean} [options.distinct=true] - Is the conversation distinct
   * @param {Object} [options.metadata] - An object containing Conversation Metadata.
   * @return {layer.Conversation}
   */
  function Conversation() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Conversation);

    // Setup default values
    if (!options.participants) options.participants = [];
    if (!options.metadata) options.metadata = {};

    var _this = _possibleConstructorReturn(this, (Conversation.__proto__ || Object.getPrototypeOf(Conversation)).call(this, options));

    _this.isInitializing = true;
    var client = _this.getClient();

    // If the options doesn't contain server object, setup participants.
    if (!options || !options.fromServer) {
      _this.participants = client._fixIdentities(_this.participants);
      if (_this.participants.indexOf(client.user) === -1) {
        _this.participants.push(client.user);
      }
    }
    _this._register();
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroy the local copy of this Conversation, cleaning up all resources
   * it consumes.
   *
   * @method destroy
   */


  _createClass(Conversation, [{
    key: 'destroy',
    value: function destroy() {
      this.lastMessage = null;

      // Client fires 'conversations:remove' and then removes the Conversation.
      if (this.clientId) this.getClient()._removeConversation(this);

      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'destroy', this).call(this);

      this.participants = null;
      this.metadata = null;
    }

    /**
     * Create a new layer.Message.ConversationMessage instance within this conversation
     *
     *      var message = conversation.createMessage('hello');
     *
     *      var message = conversation.createMessage({
     *          parts: [new layer.MessagePart({
     *                      body: 'hello',
     *                      mimeType: 'text/plain'
     *                  })]
     *      });
     *
     * See layer.Message.ConversationMessage for more options for creating the message.
     *
     * @method createMessage
     * @param  {String|Object} options - If its a string, a MessagePart is created around that string.
     * @param {layer.MessagePart[]} options.parts - An array of MessageParts.  There is some tolerance for
     *                                               it not being an array, or for it being a string to be turned
     *                                               into a MessagePart.
     * @return {layer.Message.ConversationMessage}
     */

  }, {
    key: 'createMessage',
    value: function createMessage() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var messageConfig = typeof options === 'string' ? {
        parts: [{ body: options, mimeType: 'text/plain' }]
      } : options;
      messageConfig.clientId = this.clientId;
      messageConfig.conversationId = this.id;

      return new ConversationMessage(messageConfig);
    }

    /**
     * Create this Conversation on the server.
     *
     * On completion, this instance will receive
     * an id, url and createdAt.  It may also receive metadata
     * if there was a FOUND_WITHOUT_REQUESTED_METADATA result.
     *
     * Note that the optional Message parameter should NOT be used except
     * by the layer.Message.ConversationMessage class itself.
     *
     * Note that recommended practice is to send the Conversation by sending a Message in the Conversation,
     * and NOT by calling Conversation.send.
     *
     *      client.createConversation({
     *          participants: ['a', 'b'],
     *          distinct: false
     *      })
     *      .send()
     *      .on('conversations:sent', function(evt) {
     *          alert('Done');
     *      });
     *
     * @method send
     * @param {layer.Message.ConversationMessage} [message] Tells the Conversation what its last_message will be
     * @return {layer.Conversation} this
     */

  }, {
    key: 'send',
    value: function send(message) {
      var client = this.getClient();
      if (!client) throw new Error(LayerError.dictionary.clientMissing);

      // If this is part of a create({distinct:true}).send() call where
      // the distinct conversation was found, just trigger the cached event and exit
      var wasLocalDistinct = Boolean(this._sendDistinctEvent);
      if (this._sendDistinctEvent) this._handleLocalDistinctConversation();

      // If a message is passed in, then that message is being sent, and is our
      // new lastMessage (until the websocket tells us otherwise)
      if (message) {
        // Setting a position is required if its going to get sorted correctly by query.
        // The correct position will be written by _populateFromServer when the object
        // is returned from the server.  We increment the position by the time since the prior lastMessage was sent
        // so that if multiple tabs are sending messages and writing them to indexedDB, they will have positions in correct chronological order.
        // WARNING: The query will NOT be resorted using the server's position value.
        var position = void 0;
        if (this.lastMessage) {
          position = this.lastMessage.position + Date.now() - this.lastMessage.sentAt.getTime();
          if (position === this.lastMessage.position) position++;
        } else {
          position = 0;
        }
        message.position = position;
        this.lastMessage = message;
      }

      // If the Conversation is already on the server, don't send.
      if (wasLocalDistinct || this.syncState !== Constants.SYNC_STATE.NEW) return this;

      // Make sure this user is a participant (server does this for us, but
      // this insures the local copy is correct until we get a response from
      // the server
      if (this.participants.indexOf(client.user) === -1) {
        this.participants.push(client.user);
      }

      // If there is only one participant, its client.user.userId.  Not enough
      // for us to have a good Conversation on the server.  Abort.
      if (this.participants.length === 1) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      return _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), 'send', this).call(this, message);
    }

    /**
     * Handles the case where a Distinct Create Conversation found a local match.
     *
     * When an app calls client.createConversation([...])
     * and requests a Distinct Conversation (default setting),
     * and the Conversation already exists, what do we do to help
     * them access it?
     *
     *      client.createConversation(["fred"]).on("conversations:sent", function(evt) {
     *        render();
     *      });
     *
     * Under normal conditions, calling `c.send()` on a matching distinct Conversation
     * would either throw an error or just be a no-op.  We use this method to trigger
     * the expected "conversations:sent" event even though its already been sent and
     * we did nothing.  Use the evt.result property if you want to know whether the
     * result was a new conversation or matching one.
     *
     * @method _handleLocalDistinctConversation
     * @private
     */

  }, {
    key: '_handleLocalDistinctConversation',
    value: function _handleLocalDistinctConversation() {
      var evt = this._sendDistinctEvent;
      this._sendDistinctEvent = null;

      // delay so there is time to setup an event listener on this conversation
      this._triggerAsync('conversations:sent', evt);
      return this;
    }

    /**
     * Gets the data for a Create request.
     *
     * The layer.SyncManager needs a callback to create the Conversation as it
     * looks NOW, not back when `send()` was called.  This method is called
     * by the layer.SyncManager to populate the POST data of the call.
     *
     * @method _getSendData
     * @private
     * @return {Object} Websocket data for the request
     */

  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      var isMetadataEmpty = Util.isEmpty(this.metadata);
      return {
        method: 'Conversation.create',
        data: {
          participants: this.participants.map(function (identity) {
            return identity.id;
          }),
          distinct: this.distinct,
          metadata: isMetadataEmpty ? null : this.metadata,
          id: this.id
        }
      };
    }
  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(conversation) {
      var client = this.getClient();

      // Disable events if creating a new Conversation
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this.participants = client._fixIdentities(conversation.participants);
      this.distinct = conversation.distinct;
      this.unreadCount = conversation.unread_message_count;
      this.isCurrentParticipant = this.participants.indexOf(client.user) !== -1;
      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), '_populateFromServer', this).call(this, conversation);

      if (typeof conversation.last_message === 'string') {
        this.lastMessage = client.getMessage(conversation.last_message);
      } else if (conversation.last_message) {
        this.lastMessage = client._createObject(conversation.last_message);
      } else {
        this.lastMessage = null;
      }
      this._register();

      this._disableEvents = false;
    }
  }, {
    key: '_createResultConflict',
    value: function _createResultConflict(data) {
      this._populateFromServer(data.data);
      this._triggerAsync(this.constructor.eventPrefix + ':sent', {
        result: Conversation.FOUND_WITHOUT_REQUESTED_METADATA
      });
    }

    /**
     * Add an array of participant ids to the conversation.
     *
     *      conversation.addParticipants(['a', 'b']);
     *
     * New participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method addParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'addParticipants',
    value: function addParticipants(participants) {
      var _this2 = this;

      // Only add those that aren't already in the list.
      var client = this.getClient();
      var identities = client._fixIdentities(participants);
      var adding = identities.filter(function (identity) {
        return _this2.participants.indexOf(identity) === -1;
      });
      this._patchParticipants({ add: adding, remove: [] });
      return this;
    }

    /**
     * Removes an array of participant ids from the conversation.
     *
     *      conversation.removeParticipants(['a', 'b']);
     *
     * Removed participants will immediately be removed from this Conversation,
     * but may not have synced with the server yet.
     *
     * Throws error if you attempt to remove ALL participants.
     *
     * TODO  WEB-967: Roll participants back on getting a server error
     *
     * @method removeParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'removeParticipants',
    value: function removeParticipants(participants) {
      var currentParticipants = {};
      this.participants.forEach(function (participant) {
        return currentParticipants[participant.id] = true;
      });
      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var removing = identities.filter(function (participant) {
        return currentParticipants[participant.id];
      });
      if (removing.length === 0) return this;
      if (removing.length === this.participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }
      this._patchParticipants({ add: [], remove: removing });
      return this;
    }

    /**
     * Replaces all participants with a new array of of participant ids.
     *
     *      conversation.replaceParticipants(['a', 'b']);
     *
     * Changed participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method replaceParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'replaceParticipants',
    value: function replaceParticipants(participants) {
      if (!participants || !participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var change = this._getParticipantChange(identities, this.participants);
      this._patchParticipants(change);
      return this;
    }

    /**
     * Update the server with the new participant list.
     *
     * Executes as follows:
     *
     * 1. Updates the participants property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method _patchParticipants
     * @private
     * @param  {Object[]} operations - Array of JSON patch operation
     * @param  {Object} eventData - Data describing the change for use in an event
     */

  }, {
    key: '_patchParticipants',
    value: function _patchParticipants(change) {
      var _this3 = this;

      this._applyParticipantChange(change);
      this.isCurrentParticipant = this.participants.indexOf(this.getClient().user) !== -1;

      var ops = [];
      change.remove.forEach(function (participant) {
        ops.push({
          operation: 'remove',
          property: 'participants',
          id: participant.id
        });
      });

      change.add.forEach(function (participant) {
        ops.push({
          operation: 'add',
          property: 'participants',
          id: participant.id
        });
      });

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(ops),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this3._load();
      });
    }

    /**
     * Internally we use `{add: [], remove: []}` instead of LayerOperations.
     *
     * So control is handed off to this method to actually apply the changes
     * to the participants array.
     *
     * @method _applyParticipantChange
     * @private
     * @param  {Object} change
     * @param  {layer.Identity[]} change.add - Array of userids to add
     * @param  {layer.Identity[]} change.remove - Array of userids to remove
     */

  }, {
    key: '_applyParticipantChange',
    value: function _applyParticipantChange(change) {
      var participants = [].concat(this.participants);
      change.add.forEach(function (participant) {
        if (participants.indexOf(participant) === -1) participants.push(participant);
      });
      change.remove.forEach(function (participant) {
        var index = participants.indexOf(participant);
        if (index !== -1) participants.splice(index, 1);
      });
      this.participants = participants;
    }

    /**
     * Delete the Conversation from the server and removes this user as a participant.
     *
     * @method leave
     */

  }, {
    key: 'leave',
    value: function leave() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      this._delete('mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=true');
    }

    /**
     * Delete the Conversation from the server, but deletion mode may cause user to remain a participant.
     *
     * This call will support various deletion modes.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes the local copy immediately, and attempts to delete it from all
     *   of my devices.  Other users retain access.
     * * true: For backwards compatibility thi is the same as ALL.
     *
     * MY_DEVICES does not remove this user as a participant.  That means a new Message on this Conversation will recreate the
     * Conversation for this user.  See layer.Conversation.leave() instead.
     *
     * Executes as follows:
     *
     * 1. Submits a request to be sent to the server to delete the server's object
     * 2. Delete's the local object
     * 3. If there is an error, no errors are fired except by layer.SyncManager, but the Conversation will be reloaded from the server,
     *    triggering a conversations:add event.
     *
     * @method delete
     * @param {String} deletionMode
     */

  }, {
    key: 'delete',
    value: function _delete(mode) {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var queryStr = void 0;
      switch (mode) {
        case Constants.DELETION_MODE.ALL:
        case true:
          queryStr = 'mode=' + Constants.DELETION_MODE.ALL;
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=false';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      this._delete(queryStr);
    }

    /**
    * LayerPatch will call this after changing any properties.
    *
    * Trigger any cleanup or events needed after these changes.
    *
    * @method _handlePatchEvent
    * @private
    * @param  {Mixed} newValue - New value of the property
    * @param  {Mixed} oldValue - Prior value of the property
    * @param  {string[]} paths - Array of paths specifically modified: ['participants'], ['metadata.keyA', 'metadata.keyB']
    */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      // Certain types of __update handlers are disabled while values are being set by
      // layer patch parser because the difference between setting a value (triggers an event)
      // and change a property of a value (triggers only this callback) result in inconsistent
      // behaviors.  Enable them long enough to allow __update calls to be made
      this._inLayerParser = false;
      try {
        var events = this._disableEvents;
        this._disableEvents = false;
        if (paths[0].indexOf('metadata') === 0) {
          this.__updateMetadata(newValue, oldValue, paths);
        } else if (paths[0] === 'participants') {
          var client = this.getClient();
          // oldValue/newValue come as a Basic Identity POJO; lets deliver events with actual instances
          oldValue = oldValue.map(function (identity) {
            return client.getIdentity(identity.id);
          });
          newValue = newValue.map(function (identity) {
            return client.getIdentity(identity.id);
          });
          this.__updateParticipants(newValue, oldValue);
        }
        this._disableEvents = events;
      } catch (err) {
        // do nothing
      }
      this._inLayerParser = true;
    }

    /**
     * Given the oldValue and newValue for participants,
     * generate a list of whom was added and whom was removed.
     *
     * @method _getParticipantChange
     * @private
     * @param  {layer.Identity[]} newValue
     * @param  {layer.Identity[]} oldValue
     * @return {Object} Returns changes in the form of `{add: [...], remove: [...]}`
     */

  }, {
    key: '_getParticipantChange',
    value: function _getParticipantChange(newValue, oldValue) {
      var change = {};
      change.add = newValue.filter(function (participant) {
        return oldValue.indexOf(participant) === -1;
      });
      change.remove = oldValue.filter(function (participant) {
        return newValue.indexOf(participant) === -1;
      });
      return change;
    }

    /**
     * Updates specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.setMetadataProperties({
     *          'title': 'I am a title',
     *          'colors.background': 'red',
     *          'colors.text': {
     *              'fill': 'blue',
     *              'shadow': 'black'
     *           },
     *           'colors.title.fill': 'red'
     *      });
     *
     * Use setMetadataProperties to specify the path to a property, and a new value for that property.
     * Multiple properties can be changed this way.  Whatever value was there before is
     * replaced with the new value; so in the above example, whatever other keys may have
     * existed under `colors.text` have been replaced by the new object `{fill: 'blue', shadow: 'black'}`.
     *
     * Note also that only string and subobjects are accepted as values.
     *
     * Keys with '.' will update a field of an object (and create an object if it wasn't there):
     *
     * Initial metadata: {}
     *
     *      conversation.setMetadataProperties({
     *          'colors.background': 'red',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red'}}`
     *
     *      conversation.setMetadataProperties({
     *          'colors.foreground': 'black',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red', foreground: 'black'}}`
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method setMetadataProperties
     * @param  {Object} properties
     * @return {layer.Conversation} this
     *
     */

  }, {
    key: 'setMetadataProperties',
    value: function setMetadataProperties(props) {
      var _this4 = this;

      var layerPatchOperations = [];
      Object.keys(props).forEach(function (name) {
        var fullName = name;
        if (name) {
          if (name !== 'metadata' && name.indexOf('metadata.') !== 0) {
            fullName = 'metadata.' + name;
          }
          layerPatchOperations.push({
            operation: 'set',
            property: fullName,
            value: props[name]
          });
        }
      });

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success && !_this4.isDestroyed) _this4._load();
      });

      return this;
    }

    /**
     * Deletes specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.deleteMetadataProperties(
     *          ['title', 'colors.background', 'colors.title.fill']
     *      );
     *
     * Use deleteMetadataProperties to specify paths to properties to be deleted.
     * Multiple properties can be deleted.
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method deleteMetadataProperties
     * @param  {string[]} properties
     * @return {layer.Conversation} this
     */

  }, {
    key: 'deleteMetadataProperties',
    value: function deleteMetadataProperties(props) {
      var _this5 = this;

      var layerPatchOperations = [];
      props.forEach(function (property) {
        if (property !== 'metadata' && property.indexOf('metadata.') !== 0) {
          property = 'metadata.' + property;
        }
        layerPatchOperations.push({
          operation: 'delete',
          property: property
        });
      }, this);

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this5._load();
      });

      return this;
    }
  }, {
    key: '_deleteResult',
    value: function _deleteResult(result, id) {
      var client = this.getClient();
      if (!result.success && (!result.data || result.data.id !== 'not_found')) Conversation.load(id, client);
    }
  }, {
    key: '_register',
    value: function _register() {
      var client = this.getClient();
      if (client) client._addConversation(this);
    }

    /*
     * Insure that conversation.unreadCount-- can never reduce the value to negative values.
     */

  }, {
    key: '__adjustUnreadCount',
    value: function __adjustUnreadCount(newValue) {
      if (newValue < 0) return 0;
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the unreadCount property will call this method and fire a
     * change event.
     *
     * Any triggering of this from a websocket patch unread_message_count should wait a second before firing any events
     * so that if there are a series of these updates, we don't see a lot of jitter.
     *
     * NOTE: _oldUnreadCount is used to pass data to _updateUnreadCountEvent because this method can be called many times
     * a second, and we only want to trigger this with a summary of changes rather than each individual change.
     *
     * @method __updateUnreadCount
     * @private
     * @param  {number} newValue
     * @param  {number} oldValue
     */

  }, {
    key: '__updateUnreadCount',
    value: function __updateUnreadCount(newValue, oldValue) {
      var _this6 = this;

      if (this._inLayerParser) {
        if (this._oldUnreadCount === undefined) this._oldUnreadCount = oldValue;
        if (this._updateUnreadCountTimeout) clearTimeout(this._updateUnreadCountTimeout);
        this._updateUnreadCountTimeout = setTimeout(function () {
          return _this6._updateUnreadCountEvent();
        }, 1000);
      } else {
        this._updateUnreadCountEvent();
      }
    }

    /**
     * Fire events related to changes to unreadCount
     *
     * @method _updateUnreadCountEvent
     * @private
     */

  }, {
    key: '_updateUnreadCountEvent',
    value: function _updateUnreadCountEvent() {
      if (this.isDestroyed) return;
      var oldValue = this._oldUnreadCount;
      var newValue = this.__unreadCount;
      this._oldUnreadCount = undefined;

      if (newValue === oldValue) return;
      this._triggerAsync('conversations:change', {
        newValue: newValue,
        oldValue: oldValue,
        property: 'unreadCount'
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the lastMessage pointer will call this method and fire a
     * change event.  Changes to properties within the lastMessage object will
     * not trigger this call.
     *
     * @method __updateLastMessage
     * @private
     * @param  {layer.Message.ConversationMessage} newValue
     * @param  {layer.Message.ConversationMessage} oldValue
     */

  }, {
    key: '__updateLastMessage',
    value: function __updateLastMessage(newValue, oldValue) {
      if (newValue && oldValue && newValue.id === oldValue.id) return;
      this._triggerAsync('conversations:change', {
        property: 'lastMessage',
        newValue: newValue,
        oldValue: oldValue
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the participants property will call this method and fire a
     * change event.  Changes to the participants array that don't replace the array
     * with a new array will require directly calling this method.
     *
     * @method __updateParticipants
     * @private
     * @param  {string[]} newValue
     * @param  {string[]} oldValue
     */

  }, {
    key: '__updateParticipants',
    value: function __updateParticipants(newValue, oldValue) {
      if (this._inLayerParser) return;
      var change = this._getParticipantChange(newValue, oldValue);
      if (change.add.length || change.remove.length) {
        change.property = 'participants';
        change.oldValue = oldValue;
        change.newValue = newValue;
        this._triggerAsync('conversations:change', change);
      }
    }

    /**
     * Create a conversation instance from a server representation of the conversation.
     *
     * If the Conversation already exists, will update the existing copy with
     * presumably newer values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} conversation - Server representation of a Conversation
     * @param  {layer.Client} client
     * @return {layer.Conversation}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(conversation, client) {
      return new Conversation({
        client: client,
        fromServer: conversation,
        _fromDB: conversation._fromDB
      });
    }

    /**
     * Find or create a new conversation.
     *
     *      var conversation = layer.Conversation.create({
     *          participants: ['a', 'b'],
     *          distinct: true,
     *          metadata: {
     *              title: 'I am not a title!'
     *          },
     *          client: client,
     *          'conversations:loaded': function(evt) {
     *
     *          }
     *      });
     *
     * Only tries to find a Conversation if its a Distinct Conversation.
     * Distinct defaults to true.
     *
     * Recommend using `client.createConversation({...})`
     * instead of `Conversation.create({...})`.
     *
     * @method create
     * @static
     * @protected
     * @param  {Object} options
     * @param  {layer.Client} options.client
     * @param  {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity objects to create a conversation with.
     * @param {boolean} [options.distinct=true] - Create a distinct conversation
     * @param {Object} [options.metadata={}] - Initial metadata for Conversation
     * @return {layer.Conversation}
     */

  }, {
    key: 'create',
    value: function create(options) {
      if (!options.client) throw new Error(LayerError.dictionary.clientMissing);
      var newOptions = {
        distinct: options.distinct,
        participants: options.client._fixIdentities(options.participants),
        metadata: options.metadata,
        client: options.client
      };
      if (newOptions.distinct) {
        var conv = this._createDistinct(newOptions);
        if (conv) return conv;
      }
      return new Conversation(newOptions);
    }

    /**
     * Create or Find a Distinct Conversation.
     *
     * If the static Conversation.create method gets a request for a Distinct Conversation,
     * see if we have one cached.
     *
     * Will fire the 'conversations:loaded' event if one is provided in this call,
     * and a Conversation is found.
     *
     * @method _createDistinct
     * @static
     * @private
     * @param  {Object} options - See layer.Conversation.create options; participants must be layer.Identity[]
     * @return {layer.Conversation}
     */

  }, {
    key: '_createDistinct',
    value: function _createDistinct(options) {
      if (options.participants.indexOf(options.client.user) === -1) {
        options.participants.push(options.client.user);
      }

      var participantsHash = {};
      options.participants.forEach(function (participant) {
        participantsHash[participant.id] = participant;
      });

      var conv = options.client.findCachedConversation(function (aConv) {
        if (aConv.distinct && aConv.participants.length === options.participants.length) {
          for (var index = 0; index < aConv.participants.length; index++) {
            if (!participantsHash[aConv.participants[index].id]) return false;
          }
          return true;
        }
      });

      if (conv) {
        conv._sendDistinctEvent = new LayerEvent({
          target: conv,
          result: !options.metadata || Util.doesObjectMatch(options.metadata, conv.metadata) ? Conversation.FOUND : Conversation.FOUND_WITHOUT_REQUESTED_METADATA
        }, 'conversations:sent');
        return conv;
      }
    }
  }]);

  return Conversation;
}(Container);

/**
 * Array of participant ids.
 *
 * Do not directly manipulate;
 * use addParticipants, removeParticipants and replaceParticipants
 * to manipulate the array.
 *
 * @type {layer.Identity[]}
 */


Conversation.prototype.participants = null;

/**
 * Number of unread messages in the conversation.
 *
 * @type {number}
 */
Conversation.prototype.unreadCount = 0;

/**
 * This is a Distinct Conversation.
 *
 * You can have 1 distinct conversation among a set of participants.
 * There are no limits to how many non-distinct Conversations you have have
 * among a set of participants.
 *
 * @type {boolean}
 */
Conversation.prototype.distinct = true;

/**
 * The last layer.Message.ConversationMessage to be sent/received for this Conversation.
 *
 * Value may be a Message that has been locally created but not yet received by server.
 * @type {layer.Message.ConversationMessage}
 */
Conversation.prototype.lastMessage = null;

Conversation.eventPrefix = 'conversations';

/**
 * The Conversation that was requested has been found, but there was a mismatch in metadata.
 *
 * If the createConversation request contained metadata and it did not match the Distinct Conversation
 * that matched the requested participants, then this value is passed to notify your app that the Conversation
 * was returned but does not exactly match your request.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.FOUND_WITHOUT_REQUESTED_METADATA = 'FoundMismatch';

/**
 * Prefix to use when generating an ID for instances of this class
 * @type {String}
 * @static
 * @private
 */
Conversation.prefixUUID = 'layer:///conversations/';

Conversation._supportedEvents = [
/**
 * The conversation is now on the server.
 *
 * Called after successfully creating the conversation
 * on the server.  The Result property is one of:
 *
 * * Conversation.CREATED: A new Conversation has been created
 * * Conversation.FOUND: A matching Distinct Conversation has been found
 * * Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
 *                       but note that the metadata is NOT what you requested.
 *
 * All of these results will also mean that the updated property values have been
 * copied into your Conversation object.  That means your metadata property may no
 * longer be its initial value; it may be the value found on the server.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 */
'conversations:sent',

/**
 * An attempt to send this conversation to the server has failed.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:sent-error',

/**
 * The conversation is now loaded from the server.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * from the server.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:loaded',

/**
 * An attempt to load this conversation from the server has failed.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:loaded-error',

/**
 * The conversation has been deleted from the server.
 *
 * Caused by either a successful call to delete() on this instance
 * or by a remote user.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:delete',

/**
 * This conversation has changed.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {Object[]} event.changes - Array of changes reported by this event
 * @param {Mixed} event.changes.newValue
 * @param {Mixed} event.changes.oldValue
 * @param {string} event.changes.property - Name of the property that changed
 * @param {layer.Conversation} event.target
 */
'conversations:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Conversation, [Conversation, 'Conversation']);
Syncable.subclasses.push(Conversation);
module.exports = Conversation;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udmVyc2F0aW9uLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiU3luY2FibGUiLCJDb250YWluZXIiLCJDb252ZXJzYXRpb25NZXNzYWdlIiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJDb25zdGFudHMiLCJMYXllckV2ZW50IiwiQ29udmVyc2F0aW9uIiwib3B0aW9ucyIsInBhcnRpY2lwYW50cyIsIm1ldGFkYXRhIiwiaXNJbml0aWFsaXppbmciLCJjbGllbnQiLCJnZXRDbGllbnQiLCJmcm9tU2VydmVyIiwiX2ZpeElkZW50aXRpZXMiLCJpbmRleE9mIiwidXNlciIsInB1c2giLCJfcmVnaXN0ZXIiLCJsYXN0TWVzc2FnZSIsImNsaWVudElkIiwiX3JlbW92ZUNvbnZlcnNhdGlvbiIsIm1lc3NhZ2VDb25maWciLCJwYXJ0cyIsImJvZHkiLCJtaW1lVHlwZSIsImNvbnZlcnNhdGlvbklkIiwiaWQiLCJtZXNzYWdlIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsIndhc0xvY2FsRGlzdGluY3QiLCJCb29sZWFuIiwiX3NlbmREaXN0aW5jdEV2ZW50IiwiX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb24iLCJwb3NpdGlvbiIsIkRhdGUiLCJub3ciLCJzZW50QXQiLCJnZXRUaW1lIiwic3luY1N0YXRlIiwiU1lOQ19TVEFURSIsIk5FVyIsImxlbmd0aCIsIm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCIsImV2dCIsIl90cmlnZ2VyQXN5bmMiLCJkYXRhIiwiaXNNZXRhZGF0YUVtcHR5IiwiaXNFbXB0eSIsIm1ldGhvZCIsIm1hcCIsImlkZW50aXR5IiwiZGlzdGluY3QiLCJjb252ZXJzYXRpb24iLCJfZGlzYWJsZUV2ZW50cyIsInVucmVhZENvdW50IiwidW5yZWFkX21lc3NhZ2VfY291bnQiLCJpc0N1cnJlbnRQYXJ0aWNpcGFudCIsImxhc3RfbWVzc2FnZSIsImdldE1lc3NhZ2UiLCJfY3JlYXRlT2JqZWN0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsImNvbnN0cnVjdG9yIiwiZXZlbnRQcmVmaXgiLCJyZXN1bHQiLCJGT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSIsImlkZW50aXRpZXMiLCJhZGRpbmciLCJmaWx0ZXIiLCJfcGF0Y2hQYXJ0aWNpcGFudHMiLCJhZGQiLCJyZW1vdmUiLCJjdXJyZW50UGFydGljaXBhbnRzIiwiZm9yRWFjaCIsInBhcnRpY2lwYW50IiwicmVtb3ZpbmciLCJjaGFuZ2UiLCJfZ2V0UGFydGljaXBhbnRDaGFuZ2UiLCJfYXBwbHlQYXJ0aWNpcGFudENoYW5nZSIsIm9wcyIsIm9wZXJhdGlvbiIsInByb3BlcnR5IiwiX3hociIsInVybCIsIkpTT04iLCJzdHJpbmdpZnkiLCJoZWFkZXJzIiwic3VjY2VzcyIsIl9sb2FkIiwiY29uY2F0IiwiaW5kZXgiLCJzcGxpY2UiLCJpc0Rlc3Ryb3llZCIsIl9kZWxldGUiLCJERUxFVElPTl9NT0RFIiwiTVlfREVWSUNFUyIsIm1vZGUiLCJxdWVyeVN0ciIsIkFMTCIsImRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkIiwibmV3VmFsdWUiLCJvbGRWYWx1ZSIsInBhdGhzIiwiX2luTGF5ZXJQYXJzZXIiLCJldmVudHMiLCJfX3VwZGF0ZU1ldGFkYXRhIiwiZ2V0SWRlbnRpdHkiLCJfX3VwZGF0ZVBhcnRpY2lwYW50cyIsImVyciIsInByb3BzIiwibGF5ZXJQYXRjaE9wZXJhdGlvbnMiLCJPYmplY3QiLCJrZXlzIiwibmFtZSIsImZ1bGxOYW1lIiwidmFsdWUiLCJsYXllclBhcnNlIiwib2JqZWN0IiwidHlwZSIsIm9wZXJhdGlvbnMiLCJsb2FkIiwiX2FkZENvbnZlcnNhdGlvbiIsIl9vbGRVbnJlYWRDb3VudCIsInVuZGVmaW5lZCIsIl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiX3VwZGF0ZVVucmVhZENvdW50RXZlbnQiLCJfX3VucmVhZENvdW50IiwiX2Zyb21EQiIsIm5ld09wdGlvbnMiLCJjb252IiwiX2NyZWF0ZURpc3RpbmN0IiwicGFydGljaXBhbnRzSGFzaCIsImZpbmRDYWNoZWRDb252ZXJzYXRpb24iLCJhQ29udiIsInRhcmdldCIsImRvZXNPYmplY3RNYXRjaCIsIkZPVU5EIiwicHJvdG90eXBlIiwicHJlZml4VVVJRCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJpbml0Q2xhc3MiLCJhcHBseSIsInN1YmNsYXNzZXMiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9EQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFdBQVdELFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1FLFlBQVlGLFFBQVEsYUFBUixDQUFsQjtBQUNBLElBQU1HLHNCQUFzQkgsUUFBUSx3QkFBUixDQUE1QjtBQUNBLElBQU1JLGFBQWFKLFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNSyxPQUFPTCxRQUFRLGlCQUFSLENBQWI7QUFDQSxJQUFNTSxZQUFZTixRQUFRLFVBQVIsQ0FBbEI7QUFDQSxJQUFNTyxhQUFhUCxRQUFRLGdCQUFSLENBQW5COztJQUVNUSxZOzs7QUFDSjs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsMEJBQTBCO0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUN4QjtBQUNBLFFBQUksQ0FBQ0EsUUFBUUMsWUFBYixFQUEyQkQsUUFBUUMsWUFBUixHQUF1QixFQUF2QjtBQUMzQixRQUFJLENBQUNELFFBQVFFLFFBQWIsRUFBdUJGLFFBQVFFLFFBQVIsR0FBbUIsRUFBbkI7O0FBSEMsNEhBSWxCRixPQUprQjs7QUFLeEIsVUFBS0csY0FBTCxHQUFzQixJQUF0QjtBQUNBLFFBQU1DLFNBQVMsTUFBS0MsU0FBTCxFQUFmOztBQUVBO0FBQ0EsUUFBSSxDQUFDTCxPQUFELElBQVksQ0FBQ0EsUUFB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QyxLQUFmLENBQXFCM0ksWUFBckIsRUFBbUMsQ0FBQ0EsWUFBRCxFQUFlLGNBQWYsQ0FBbkM7QUFDQVAsU0FBU21KLFVBQVQsQ0FBb0JqSSxJQUFwQixDQUF5QlgsWUFBekI7QUFDQTZJLE9BQU9DLE9BQVAsR0FBaUI5SSxZQUFqQiIsImZpbGUiOiJjb252ZXJzYXRpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgQ29udmVyc2F0aW9uIG9iamVjdCByZXByZXNlbnRzIGEgZGlhbG9nIGFtb25nc3QgYSBzbWFsbCBzZXRcbiAqIG9mIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBDcmVhdGUgYSBDb252ZXJzYXRpb24gdXNpbmcgdGhlIGNsaWVudDpcbiAqXG4gKiAgICAgIHZhciBjb252ZXJzYXRpb24gPSBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywnYiddLFxuICogICAgICAgICAgZGlzdGluY3Q6IHRydWVcbiAqICAgICAgfSk7XG4gKlxuICogTk9URTogICBEbyBub3QgY3JlYXRlIGEgY29udmVyc2F0aW9uIHdpdGggbmV3IGxheWVyLkNvbnZlcnNhdGlvbiguLi4pLFxuICogICAgICAgICBUaGlzIHdpbGwgZmFpbCB0byBoYW5kbGUgdGhlIGRpc3RpbmN0IHByb3BlcnR5IHNob3J0IG9mIGdvaW5nIHRvIHRoZSBzZXJ2ZXIgZm9yIGV2YWx1YXRpb24uXG4gKlxuICogTk9URTogICBDcmVhdGluZyBhIENvbnZlcnNhdGlvbiBpcyBhIGxvY2FsIGFjdGlvbi4gIEEgQ29udmVyc2F0aW9uIHdpbGwgbm90IGJlXG4gKiAgICAgICAgIHNlbnQgdG8gdGhlIHNlcnZlciB1bnRpbCBlaXRoZXI6XG4gKlxuICogMS4gQSBtZXNzYWdlIGlzIHNlbnQgb24gdGhhdCBDb252ZXJzYXRpb25cbiAqIDIuIGBDb252ZXJzYXRpb24uc2VuZCgpYCBpcyBjYWxsZWQgKG5vdCByZWNvbW1lbmRlZCBhcyBtb2JpbGUgY2xpZW50c1xuICogICAgZXhwZWN0IGF0IGxlYXN0IG9uZSBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UgaW4gYSBDb252ZXJzYXRpb24pXG4gKlxuICogS2V5IG1ldGhvZHMsIGV2ZW50cyBhbmQgcHJvcGVydGllcyBmb3IgZ2V0dGluZyBzdGFydGVkOlxuICpcbiAqIFByb3BlcnRpZXM6XG4gKlxuICogKiBsYXllci5Db252ZXJzYXRpb24uaWQ6IHRoaXMgcHJvcGVydHkgaXMgd29ydGggYmVpbmcgZmFtaWxpYXIgd2l0aDsgaXQgaWRlbnRpZmllcyB0aGVcbiAqICAgQ29udmVyc2F0aW9uIGFuZCBjYW4gYmUgdXNlZCBpbiBgY2xpZW50LmdldENvbnZlcnNhdGlvbihpZClgIHRvIHJldHJpZXZlIGl0LlxuICogKiBsYXllci5Db252ZXJzYXRpb24ubGFzdE1lc3NhZ2U6IFRoaXMgcHJvcGVydHkgbWFrZXMgaXQgZWFzeSB0byBzaG93IGluZm8gYWJvdXQgdGhlIG1vc3QgcmVjZW50IE1lc3NhZ2VcbiAqICAgIHdoZW4gcmVuZGVyaW5nIGEgbGlzdCBvZiBDb252ZXJzYXRpb25zLlxuICogKiBsYXllci5Db252ZXJzYXRpb24ubWV0YWRhdGE6IEN1c3RvbSBkYXRhIGZvciB5b3VyIENvbnZlcnNhdGlvbjsgY29tbW9ubHkgdXNlZCB0byBzdG9yZSBhICd0aXRsZScgcHJvcGVydHlcbiAqICAgIHRvIG5hbWUgeW91ciBDb252ZXJzYXRpb24uXG4gKlxuICogTWV0aG9kczpcbiAqXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5hZGRQYXJ0aWNpcGFudHMgYW5kIGxheWVyLkNvbnZlcnNhdGlvbi5yZW1vdmVQYXJ0aWNpcGFudHM6IENoYW5nZSB0aGUgcGFydGljaXBhbnRzIG9mIHRoZSBDb252ZXJzYXRpb25cbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllczogU2V0IG1ldGFkYXRhLnRpdGxlIHRvICdNeSBDb252ZXJzYXRpb24gd2l0aCBMYXllciBTdXBwb3J0JyAodWggb2gpXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5vbigpIGFuZCBsYXllci5Db252ZXJzYXRpb24ub2ZmKCk6IGV2ZW50IGxpc3RlbmVycyBidWlsdCBvbiB0b3Agb2YgdGhlIGBiYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZWAgbnBtIHByb2plY3RcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmxlYXZlKCkgdG8gbGVhdmUgdGhlIENvbnZlcnNhdGlvblxuICogKiBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlKCkgdG8gZGVsZXRlIHRoZSBDb252ZXJzYXRpb24gZm9yIGFsbCB1c2VycyAob3IgZm9yIGp1c3QgdGhpcyB1c2VyKVxuICpcbiAqIEV2ZW50czpcbiAqXG4gKiAqIGBjb252ZXJzYXRpb25zOmNoYW5nZWA6IFVzZWZ1bCBmb3Igb2JzZXJ2aW5nIGNoYW5nZXMgdG8gcGFydGljaXBhbnRzIGFuZCBtZXRhZGF0YVxuICogICBhbmQgdXBkYXRpbmcgcmVuZGVyaW5nIG9mIHlvdXIgb3BlbiBDb252ZXJzYXRpb25cbiAqXG4gKiBGaW5hbGx5LCB0byBhY2Nlc3MgYSBsaXN0IG9mIE1lc3NhZ2VzIGluIGEgQ29udmVyc2F0aW9uLCBzZWUgbGF5ZXIuUXVlcnkuXG4gKlxuICogQGNsYXNzICBsYXllci5Db252ZXJzYXRpb25cbiAqIEBleHRlbmRzIGxheWVyLkNvbnRhaW5lclxuICogQGF1dGhvciAgTWljaGFlbCBLYW50b3JcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBDb250YWluZXIgPSByZXF1aXJlKCcuL2NvbnRhaW5lcicpO1xuY29uc3QgQ29udmVyc2F0aW9uTWVzc2FnZSA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uLW1lc3NhZ2UnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IExheWVyRXZlbnQgPSByZXF1aXJlKCcuLi9sYXllci1ldmVudCcpO1xuXG5jbGFzcyBDb252ZXJzYXRpb24gZXh0ZW5kcyBDb250YWluZXIge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogVGhlIHN0YXRpYyBgbGF5ZXIuQ29udmVyc2F0aW9uLmNyZWF0ZSgpYCBtZXRob2RcbiAgICogd2lsbCBjb3JyZWN0bHkgbG9va3VwIGRpc3RpbmN0IENvbnZlcnNhdGlvbnMgYW5kXG4gICAqIHJldHVybiB0aGVtOyBgbmV3IGxheWVyLkNvbnZlcnNhdGlvbigpYCB3aWxsIG5vdC5cbiAgICpcbiAgICogRGV2ZWxvcGVycyBzaG91bGQgdXNlIGBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlKClgLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gb3B0aW9ucy5wYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgbGF5ZXIuSWRlbnRpdHkgaW5zdGFuY2VzXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGlzdGluY3Q9dHJ1ZV0gLSBJcyB0aGUgY29udmVyc2F0aW9uIGRpc3RpbmN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5tZXRhZGF0YV0gLSBBbiBvYmplY3QgY29udGFpbmluZyBDb252ZXJzYXRpb24gTWV0YWRhdGEuXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFNldHVwIGRlZmF1bHQgdmFsdWVzXG4gICAgaWYgKCFvcHRpb25zLnBhcnRpY2lwYW50cykgb3B0aW9ucy5wYXJ0aWNpcGFudHMgPSBbXTtcbiAgICBpZiAoIW9wdGlvbnMubWV0YWRhdGEpIG9wdGlvbnMubWV0YWRhdGEgPSB7fTtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gSWYgdGhlIG9wdGlvbnMgZG9lc24ndCBjb250YWluIHNlcnZlciBvYmplY3QsIHNldHVwIHBhcnRpY2lwYW50cy5cbiAgICBpZiAoIW9wdGlvbnMgfHwgIW9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXModGhpcy5wYXJ0aWNpcGFudHMpO1xuICAgICAgaWYgKHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoY2xpZW50LnVzZXIpID09PSAtMSkge1xuICAgICAgICB0aGlzLnBhcnRpY2lwYW50cy5wdXNoKGNsaWVudC51c2VyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fcmVnaXN0ZXIoKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgbG9jYWwgY29weSBvZiB0aGlzIENvbnZlcnNhdGlvbiwgY2xlYW5pbmcgdXAgYWxsIHJlc291cmNlc1xuICAgKiBpdCBjb25zdW1lcy5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMubGFzdE1lc3NhZ2UgPSBudWxsO1xuXG4gICAgLy8gQ2xpZW50IGZpcmVzICdjb252ZXJzYXRpb25zOnJlbW92ZScgYW5kIHRoZW4gcmVtb3ZlcyB0aGUgQ29udmVyc2F0aW9uLlxuICAgIGlmICh0aGlzLmNsaWVudElkKSB0aGlzLmdldENsaWVudCgpLl9yZW1vdmVDb252ZXJzYXRpb24odGhpcyk7XG5cbiAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICB0aGlzLnBhcnRpY2lwYW50cyA9IG51bGw7XG4gICAgdGhpcy5tZXRhZGF0YSA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZSBpbnN0YW5jZSB3aXRoaW4gdGhpcyBjb252ZXJzYXRpb25cbiAgICpcbiAgICogICAgICB2YXIgbWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdoZWxsbycpO1xuICAgKlxuICAgKiAgICAgIHZhciBtZXNzYWdlID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICAgKiAgICAgICAgICBwYXJ0czogW25ldyBsYXllci5NZXNzYWdlUGFydCh7XG4gICAqICAgICAgICAgICAgICAgICAgICAgIGJvZHk6ICdoZWxsbycsXG4gICAqICAgICAgICAgICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAgICogICAgICAgICAgICAgICAgICB9KV1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogU2VlIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZSBmb3IgbW9yZSBvcHRpb25zIGZvciBjcmVhdGluZyB0aGUgbWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVNZXNzYWdlXG4gICAqIEBwYXJhbSAge1N0cmluZ3xPYmplY3R9IG9wdGlvbnMgLSBJZiBpdHMgYSBzdHJpbmcsIGEgTWVzc2FnZVBhcnQgaXMgY3JlYXRlZCBhcm91bmQgdGhhdCBzdHJpbmcuXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVBhcnRbXX0gb3B0aW9ucy5wYXJ0cyAtIEFuIGFycmF5IG9mIE1lc3NhZ2VQYXJ0cy4gIFRoZXJlIGlzIHNvbWUgdG9sZXJhbmNlIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgbm90IGJlaW5nIGFuIGFycmF5LCBvciBmb3IgaXQgYmVpbmcgYSBzdHJpbmcgdG8gYmUgdHVybmVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRvIGEgTWVzc2FnZVBhcnQuXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX1cbiAgICovXG4gIGNyZWF0ZU1lc3NhZ2Uob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbWVzc2FnZUNvbmZpZyA9ICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpID8ge1xuICAgICAgcGFydHM6IFt7IGJvZHk6IG9wdGlvbnMsIG1pbWVUeXBlOiAndGV4dC9wbGFpbicgfV0sXG4gICAgfSA6IG9wdGlvbnM7XG4gICAgbWVzc2FnZUNvbmZpZy5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgbWVzc2FnZUNvbmZpZy5jb252ZXJzYXRpb25JZCA9IHRoaXMuaWQ7XG5cbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbk1lc3NhZ2UobWVzc2FnZUNvbmZpZyk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgdGhpcyBDb252ZXJzYXRpb24gb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogT24gY29tcGxldGlvbiwgdGhpcyBpbnN0YW5jZSB3aWxsIHJlY2VpdmVcbiAgICogYW4gaWQsIHVybCBhbmQgY3JlYXRlZEF0LiAgSXQgbWF5IGFsc28gcmVjZWl2ZSBtZXRhZGF0YVxuICAgKiBpZiB0aGVyZSB3YXMgYSBGT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSByZXN1bHQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgb3B0aW9uYWwgTWVzc2FnZSBwYXJhbWV0ZXIgc2hvdWxkIE5PVCBiZSB1c2VkIGV4Y2VwdFxuICAgKiBieSB0aGUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlIGNsYXNzIGl0c2VsZi5cbiAgICpcbiAgICogTm90ZSB0aGF0IHJlY29tbWVuZGVkIHByYWN0aWNlIGlzIHRvIHNlbmQgdGhlIENvbnZlcnNhdGlvbiBieSBzZW5kaW5nIGEgTWVzc2FnZSBpbiB0aGUgQ29udmVyc2F0aW9uLFxuICAgKiBhbmQgTk9UIGJ5IGNhbGxpbmcgQ29udmVyc2F0aW9uLnNlbmQuXG4gICAqXG4gICAqICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgZGlzdGluY3Q6IGZhbHNlXG4gICAqICAgICAgfSlcbiAgICogICAgICAuc2VuZCgpXG4gICAqICAgICAgLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgYWxlcnQoJ0RvbmUnKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlfSBbbWVzc2FnZV0gVGVsbHMgdGhlIENvbnZlcnNhdGlvbiB3aGF0IGl0cyBsYXN0X21lc3NhZ2Ugd2lsbCBiZVxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIHNlbmQobWVzc2FnZSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFjbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIHBhcnQgb2YgYSBjcmVhdGUoe2Rpc3RpbmN0OnRydWV9KS5zZW5kKCkgY2FsbCB3aGVyZVxuICAgIC8vIHRoZSBkaXN0aW5jdCBjb252ZXJzYXRpb24gd2FzIGZvdW5kLCBqdXN0IHRyaWdnZXIgdGhlIGNhY2hlZCBldmVudCBhbmQgZXhpdFxuICAgIGNvbnN0IHdhc0xvY2FsRGlzdGluY3QgPSBCb29sZWFuKHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50KTtcbiAgICBpZiAodGhpcy5fc2VuZERpc3RpbmN0RXZlbnQpIHRoaXMuX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb24oKTtcblxuICAgIC8vIElmIGEgbWVzc2FnZSBpcyBwYXNzZWQgaW4sIHRoZW4gdGhhdCBtZXNzYWdlIGlzIGJlaW5nIHNlbnQsIGFuZCBpcyBvdXJcbiAgICAvLyBuZXcgbGFzdE1lc3NhZ2UgKHVudGlsIHRoZSB3ZWJzb2NrZXQgdGVsbHMgdXMgb3RoZXJ3aXNlKVxuICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAvLyBTZXR0aW5nIGEgcG9zaXRpb24gaXMgcmVxdWlyZWQgaWYgaXRzIGdvaW5nIHRvIGdldCBzb3J0ZWQgY29ycmVjdGx5IGJ5IHF1ZXJ5LlxuICAgICAgLy8gVGhlIGNvcnJlY3QgcG9zaXRpb24gd2lsbCBiZSB3cml0dGVuIGJ5IF9wb3B1bGF0ZUZyb21TZXJ2ZXIgd2hlbiB0aGUgb2JqZWN0XG4gICAgICAvLyBpcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXIuICBXZSBpbmNyZW1lbnQgdGhlIHBvc2l0aW9uIGJ5IHRoZSB0aW1lIHNpbmNlIHRoZSBwcmlvciBsYXN0TWVzc2FnZSB3YXMgc2VudFxuICAgICAgLy8gc28gdGhhdCBpZiBtdWx0aXBsZSB0YWJzIGFyZSBzZW5kaW5nIG1lc3NhZ2VzIGFuZCB3cml0aW5nIHRoZW0gdG8gaW5kZXhlZERCLCB0aGV5IHdpbGwgaGF2ZSBwb3NpdGlvbnMgaW4gY29ycmVjdCBjaHJvbm9sb2dpY2FsIG9yZGVyLlxuICAgICAgLy8gV0FSTklORzogVGhlIHF1ZXJ5IHdpbGwgTk9UIGJlIHJlc29ydGVkIHVzaW5nIHRoZSBzZXJ2ZXIncyBwb3NpdGlvbiB2YWx1ZS5cbiAgICAgIGxldCBwb3NpdGlvbjtcbiAgICAgIGlmICh0aGlzLmxhc3RNZXNzYWdlKSB7XG4gICAgICAgIHBvc2l0aW9uID0gKHRoaXMubGFzdE1lc3NhZ2UucG9zaXRpb24gKyBEYXRlLm5vdygpKSAtIHRoaXMubGFzdE1lc3NhZ2Uuc2VudEF0LmdldFRpbWUoKTtcbiAgICAgICAgaWYgKHBvc2l0aW9uID09PSB0aGlzLmxhc3RNZXNzYWdlLnBvc2l0aW9uKSBwb3NpdGlvbisrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcG9zaXRpb24gPSAwO1xuICAgICAgfVxuICAgICAgbWVzc2FnZS5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIENvbnZlcnNhdGlvbiBpcyBhbHJlYWR5IG9uIHRoZSBzZXJ2ZXIsIGRvbid0IHNlbmQuXG4gICAgaWYgKHdhc0xvY2FsRGlzdGluY3QgfHwgdGhpcy5zeW5jU3RhdGUgIT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykgcmV0dXJuIHRoaXM7XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhpcyB1c2VyIGlzIGEgcGFydGljaXBhbnQgKHNlcnZlciBkb2VzIHRoaXMgZm9yIHVzLCBidXRcbiAgICAvLyB0aGlzIGluc3VyZXMgdGhlIGxvY2FsIGNvcHkgaXMgY29ycmVjdCB1bnRpbCB3ZSBnZXQgYSByZXNwb25zZSBmcm9tXG4gICAgLy8gdGhlIHNlcnZlclxuICAgIGlmICh0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKGNsaWVudC51c2VyKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMucGFydGljaXBhbnRzLnB1c2goY2xpZW50LnVzZXIpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIG9ubHkgb25lIHBhcnRpY2lwYW50LCBpdHMgY2xpZW50LnVzZXIudXNlcklkLiAgTm90IGVub3VnaFxuICAgIC8vIGZvciB1cyB0byBoYXZlIGEgZ29vZCBDb252ZXJzYXRpb24gb24gdGhlIHNlcnZlci4gIEFib3J0LlxuICAgIGlmICh0aGlzLnBhcnRpY2lwYW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkubW9yZVBhcnRpY2lwYW50c1JlcXVpcmVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VwZXIuc2VuZChtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIHRoZSBjYXNlIHdoZXJlIGEgRGlzdGluY3QgQ3JlYXRlIENvbnZlcnNhdGlvbiBmb3VuZCBhIGxvY2FsIG1hdGNoLlxuICAgKlxuICAgKiBXaGVuIGFuIGFwcCBjYWxscyBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKFsuLi5dKVxuICAgKiBhbmQgcmVxdWVzdHMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24gKGRlZmF1bHQgc2V0dGluZyksXG4gICAqIGFuZCB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzLCB3aGF0IGRvIHdlIGRvIHRvIGhlbHBcbiAgICogdGhlbSBhY2Nlc3MgaXQ/XG4gICAqXG4gICAqICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbihbXCJmcmVkXCJdKS5vbihcImNvbnZlcnNhdGlvbnM6c2VudFwiLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgIHJlbmRlcigpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBVbmRlciBub3JtYWwgY29uZGl0aW9ucywgY2FsbGluZyBgYy5zZW5kKClgIG9uIGEgbWF0Y2hpbmcgZGlzdGluY3QgQ29udmVyc2F0aW9uXG4gICAqIHdvdWxkIGVpdGhlciB0aHJvdyBhbiBlcnJvciBvciBqdXN0IGJlIGEgbm8tb3AuICBXZSB1c2UgdGhpcyBtZXRob2QgdG8gdHJpZ2dlclxuICAgKiB0aGUgZXhwZWN0ZWQgXCJjb252ZXJzYXRpb25zOnNlbnRcIiBldmVudCBldmVuIHRob3VnaCBpdHMgYWxyZWFkeSBiZWVuIHNlbnQgYW5kXG4gICAqIHdlIGRpZCBub3RoaW5nLiAgVXNlIHRoZSBldnQucmVzdWx0IHByb3BlcnR5IGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVcbiAgICogcmVzdWx0IHdhcyBhIG5ldyBjb252ZXJzYXRpb24gb3IgbWF0Y2hpbmcgb25lLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVMb2NhbERpc3RpbmN0Q29udmVyc2F0aW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFuZGxlTG9jYWxEaXN0aW5jdENvbnZlcnNhdGlvbigpIHtcbiAgICBjb25zdCBldnQgPSB0aGlzLl9zZW5kRGlzdGluY3RFdmVudDtcbiAgICB0aGlzLl9zZW5kRGlzdGluY3RFdmVudCA9IG51bGw7XG5cbiAgICAvLyBkZWxheSBzbyB0aGVyZSBpcyB0aW1lIHRvIHNldHVwIGFuIGV2ZW50IGxpc3RlbmVyIG9uIHRoaXMgY29udmVyc2F0aW9uXG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOnNlbnQnLCBldnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogR2V0cyB0aGUgZGF0YSBmb3IgYSBDcmVhdGUgcmVxdWVzdC5cbiAgICpcbiAgICogVGhlIGxheWVyLlN5bmNNYW5hZ2VyIG5lZWRzIGEgY2FsbGJhY2sgdG8gY3JlYXRlIHRoZSBDb252ZXJzYXRpb24gYXMgaXRcbiAgICogbG9va3MgTk9XLCBub3QgYmFjayB3aGVuIGBzZW5kKClgIHdhcyBjYWxsZWQuICBUaGlzIG1ldGhvZCBpcyBjYWxsZWRcbiAgICogYnkgdGhlIGxheWVyLlN5bmNNYW5hZ2VyIHRvIHBvcHVsYXRlIHRoZSBQT1NUIGRhdGEgb2YgdGhlIGNhbGwuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFNlbmREYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge09iamVjdH0gV2Vic29ja2V0IGRhdGEgZm9yIHRoZSByZXF1ZXN0XG4gICAqL1xuICBfZ2V0U2VuZERhdGEoZGF0YSkge1xuICAgIGNvbnN0IGlzTWV0YWRhdGFFbXB0eSA9IFV0aWwuaXNFbXB0eSh0aGlzLm1ldGFkYXRhKTtcbiAgICByZXR1cm4ge1xuICAgICAgbWV0aG9kOiAnQ29udmVyc2F0aW9uLmNyZWF0ZScsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHBhcnRpY2lwYW50czogdGhpcy5wYXJ0aWNpcGFudHMubWFwKGlkZW50aXR5ID0+IGlkZW50aXR5LmlkKSxcbiAgICAgICAgZGlzdGluY3Q6IHRoaXMuZGlzdGluY3QsXG4gICAgICAgIG1ldGFkYXRhOiBpc01ldGFkYXRhRW1wdHkgPyBudWxsIDogdGhpcy5tZXRhZGF0YSxcbiAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBfcG9wdWxhdGVGcm9tU2VydmVyKGNvbnZlcnNhdGlvbikge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICAvLyBEaXNhYmxlIGV2ZW50cyBpZiBjcmVhdGluZyBhIG5ldyBDb252ZXJzYXRpb25cbiAgICAvLyBXZSBzdGlsbCB3YW50IHByb3BlcnR5IGNoYW5nZSBldmVudHMgZm9yIGFueXRoaW5nIHRoYXQgRE9FUyBjaGFuZ2VcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gKHRoaXMuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpO1xuXG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMoY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cyk7XG4gICAgdGhpcy5kaXN0aW5jdCA9IGNvbnZlcnNhdGlvbi5kaXN0aW5jdDtcbiAgICB0aGlzLnVucmVhZENvdW50ID0gY29udmVyc2F0aW9uLnVucmVhZF9tZXNzYWdlX2NvdW50O1xuICAgIHRoaXMuaXNDdXJyZW50UGFydGljaXBhbnQgPSB0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKGNsaWVudC51c2VyKSAhPT0gLTE7XG4gICAgc3VwZXIuX3BvcHVsYXRlRnJvbVNlcnZlcihjb252ZXJzYXRpb24pO1xuXG4gICAgaWYgKHR5cGVvZiBjb252ZXJzYXRpb24ubGFzdF9tZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IGNsaWVudC5nZXRNZXNzYWdlKGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSkge1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IGNsaWVudC5fY3JlYXRlT2JqZWN0KGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5fcmVnaXN0ZXIoKTtcblxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAgfVxuXG4gIF9jcmVhdGVSZXN1bHRDb25mbGljdChkYXRhKSB7XG4gICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKGRhdGEuZGF0YSk7XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKHRoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXggKyAnOnNlbnQnLCB7XG4gICAgICByZXN1bHQ6IENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gYXJyYXkgb2YgcGFydGljaXBhbnQgaWRzIHRvIHRoZSBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLmFkZFBhcnRpY2lwYW50cyhbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogTmV3IHBhcnRpY2lwYW50cyB3aWxsIGltbWVkaWF0ZWx5IHNob3cgdXAgaW4gdGhlIENvbnZlcnNhdGlvbixcbiAgICogYnV0IG1heSBub3QgaGF2ZSBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIHlldC5cbiAgICpcbiAgICogVE9ETyBXRUItOTY3OiBSb2xsIHBhcnRpY2lwYW50cyBiYWNrIG9uIGdldHRpbmcgYSBzZXJ2ZXIgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCBhZGRQYXJ0aWNpcGFudHNcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIElkZW50aXR5IG9iamVjdHNcbiAgICogQHJldHVybnMge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgYWRkUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIC8vIE9ubHkgYWRkIHRob3NlIHRoYXQgYXJlbid0IGFscmVhZHkgaW4gdGhlIGxpc3QuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjb25zdCBpZGVudGl0aWVzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHBhcnRpY2lwYW50cyk7XG4gICAgY29uc3QgYWRkaW5nID0gaWRlbnRpdGllcy5maWx0ZXIoaWRlbnRpdHkgPT4gdGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZihpZGVudGl0eSkgPT09IC0xKTtcbiAgICB0aGlzLl9wYXRjaFBhcnRpY2lwYW50cyh7IGFkZDogYWRkaW5nLCByZW1vdmU6IFtdIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYW4gYXJyYXkgb2YgcGFydGljaXBhbnQgaWRzIGZyb20gdGhlIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24ucmVtb3ZlUGFydGljaXBhbnRzKFsnYScsICdiJ10pO1xuICAgKlxuICAgKiBSZW1vdmVkIHBhcnRpY2lwYW50cyB3aWxsIGltbWVkaWF0ZWx5IGJlIHJlbW92ZWQgZnJvbSB0aGlzIENvbnZlcnNhdGlvbixcbiAgICogYnV0IG1heSBub3QgaGF2ZSBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIHlldC5cbiAgICpcbiAgICogVGhyb3dzIGVycm9yIGlmIHlvdSBhdHRlbXB0IHRvIHJlbW92ZSBBTEwgcGFydGljaXBhbnRzLlxuICAgKlxuICAgKiBUT0RPICBXRUItOTY3OiBSb2xsIHBhcnRpY2lwYW50cyBiYWNrIG9uIGdldHRpbmcgYSBzZXJ2ZXIgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCByZW1vdmVQYXJ0aWNpcGFudHNcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIElkZW50aXR5IG9iamVjdHNcbiAgICogQHJldHVybnMge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgcmVtb3ZlUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIGNvbnN0IGN1cnJlbnRQYXJ0aWNpcGFudHMgPSB7fTtcbiAgICB0aGlzLnBhcnRpY2lwYW50cy5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IChjdXJyZW50UGFydGljaXBhbnRzW3BhcnRpY2lwYW50LmlkXSA9IHRydWUpKTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGlkZW50aXRpZXMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMocGFydGljaXBhbnRzKTtcblxuICAgIGNvbnN0IHJlbW92aW5nID0gaWRlbnRpdGllcy5maWx0ZXIocGFydGljaXBhbnQgPT4gY3VycmVudFBhcnRpY2lwYW50c1twYXJ0aWNpcGFudC5pZF0pO1xuICAgIGlmIChyZW1vdmluZy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzO1xuICAgIGlmIChyZW1vdmluZy5sZW5ndGggPT09IHRoaXMucGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5tb3JlUGFydGljaXBhbnRzUmVxdWlyZWQpO1xuICAgIH1cbiAgICB0aGlzLl9wYXRjaFBhcnRpY2lwYW50cyh7IGFkZDogW10sIHJlbW92ZTogcmVtb3ZpbmcgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgYWxsIHBhcnRpY2lwYW50cyB3aXRoIGEgbmV3IGFycmF5IG9mIG9mIHBhcnRpY2lwYW50IGlkcy5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24ucmVwbGFjZVBhcnRpY2lwYW50cyhbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogQ2hhbmdlZCBwYXJ0aWNpcGFudHMgd2lsbCBpbW1lZGlhdGVseSBzaG93IHVwIGluIHRoZSBDb252ZXJzYXRpb24sXG4gICAqIGJ1dCBtYXkgbm90IGhhdmUgc3luY2VkIHdpdGggdGhlIHNlcnZlciB5ZXQuXG4gICAqXG4gICAqIFRPRE8gV0VCLTk2NzogUm9sbCBwYXJ0aWNpcGFudHMgYmFjayBvbiBnZXR0aW5nIGEgc2VydmVyIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgcmVwbGFjZVBhcnRpY2lwYW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgSWRlbnRpdHkgb2JqZWN0c1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICByZXBsYWNlUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIGlmICghcGFydGljaXBhbnRzIHx8ICFwYXJ0aWNpcGFudHMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5Lm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCk7XG4gICAgfVxuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjb25zdCBpZGVudGl0aWVzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHBhcnRpY2lwYW50cyk7XG5cbiAgICBjb25zdCBjaGFuZ2UgPSB0aGlzLl9nZXRQYXJ0aWNpcGFudENoYW5nZShpZGVudGl0aWVzLCB0aGlzLnBhcnRpY2lwYW50cyk7XG4gICAgdGhpcy5fcGF0Y2hQYXJ0aWNpcGFudHMoY2hhbmdlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHNlcnZlciB3aXRoIHRoZSBuZXcgcGFydGljaXBhbnQgbGlzdC5cbiAgICpcbiAgICogRXhlY3V0ZXMgYXMgZm9sbG93czpcbiAgICpcbiAgICogMS4gVXBkYXRlcyB0aGUgcGFydGljaXBhbnRzIHByb3BlcnR5IG9mIHRoZSBsb2NhbCBvYmplY3RcbiAgICogMi4gVHJpZ2dlcnMgYSBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudFxuICAgKiAzLiBTdWJtaXRzIGEgcmVxdWVzdCB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIgdG8gdXBkYXRlIHRoZSBzZXJ2ZXIncyBvYmplY3RcbiAgICogNC4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIG5vIGVycm9ycyBhcmUgZmlyZWQgZXhjZXB0IGJ5IGxheWVyLlN5bmNNYW5hZ2VyLCBidXQgYW5vdGhlclxuICAgKiAgICBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudCBpcyBmaXJlZCBhcyB0aGUgY2hhbmdlIGlzIHJvbGxlZCBiYWNrLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wYXRjaFBhcnRpY2lwYW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3RbXX0gb3BlcmF0aW9ucyAtIEFycmF5IG9mIEpTT04gcGF0Y2ggb3BlcmF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZXZlbnREYXRhIC0gRGF0YSBkZXNjcmliaW5nIHRoZSBjaGFuZ2UgZm9yIHVzZSBpbiBhbiBldmVudFxuICAgKi9cbiAgX3BhdGNoUGFydGljaXBhbnRzKGNoYW5nZSkge1xuICAgIHRoaXMuX2FwcGx5UGFydGljaXBhbnRDaGFuZ2UoY2hhbmdlKTtcbiAgICB0aGlzLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gdGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZih0aGlzLmdldENsaWVudCgpLnVzZXIpICE9PSAtMTtcblxuICAgIGNvbnN0IG9wcyA9IFtdO1xuICAgIGNoYW5nZS5yZW1vdmUuZm9yRWFjaCgocGFydGljaXBhbnQpID0+IHtcbiAgICAgIG9wcy5wdXNoKHtcbiAgICAgICAgb3BlcmF0aW9uOiAncmVtb3ZlJyxcbiAgICAgICAgcHJvcGVydHk6ICdwYXJ0aWNpcGFudHMnLFxuICAgICAgICBpZDogcGFydGljaXBhbnQuaWQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNoYW5nZS5hZGQuZm9yRWFjaCgocGFydGljaXBhbnQpID0+IHtcbiAgICAgIG9wcy5wdXNoKHtcbiAgICAgICAgb3BlcmF0aW9uOiAnYWRkJyxcbiAgICAgICAgcHJvcGVydHk6ICdwYXJ0aWNpcGFudHMnLFxuICAgICAgICBpZDogcGFydGljaXBhbnQuaWQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkob3BzKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicsXG4gICAgICB9LFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbGx5IHdlIHVzZSBge2FkZDogW10sIHJlbW92ZTogW119YCBpbnN0ZWFkIG9mIExheWVyT3BlcmF0aW9ucy5cbiAgICpcbiAgICogU28gY29udHJvbCBpcyBoYW5kZWQgb2ZmIHRvIHRoaXMgbWV0aG9kIHRvIGFjdHVhbGx5IGFwcGx5IHRoZSBjaGFuZ2VzXG4gICAqIHRvIHRoZSBwYXJ0aWNpcGFudHMgYXJyYXkuXG4gICAqXG4gICAqIEBtZXRob2QgX2FwcGx5UGFydGljaXBhbnRDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjaGFuZ2VcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHlbXX0gY2hhbmdlLmFkZCAtIEFycmF5IG9mIHVzZXJpZHMgdG8gYWRkXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5W119IGNoYW5nZS5yZW1vdmUgLSBBcnJheSBvZiB1c2VyaWRzIHRvIHJlbW92ZVxuICAgKi9cbiAgX2FwcGx5UGFydGljaXBhbnRDaGFuZ2UoY2hhbmdlKSB7XG4gICAgY29uc3QgcGFydGljaXBhbnRzID0gW10uY29uY2F0KHRoaXMucGFydGljaXBhbnRzKTtcbiAgICBjaGFuZ2UuYWRkLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICBpZiAocGFydGljaXBhbnRzLmluZGV4T2YocGFydGljaXBhbnQpID09PSAtMSkgcGFydGljaXBhbnRzLnB1c2gocGFydGljaXBhbnQpO1xuICAgIH0pO1xuICAgIGNoYW5nZS5yZW1vdmUuZm9yRWFjaCgocGFydGljaXBhbnQpID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gcGFydGljaXBhbnRzLmluZGV4T2YocGFydGljaXBhbnQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkgcGFydGljaXBhbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfSk7XG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudHM7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBDb252ZXJzYXRpb24gZnJvbSB0aGUgc2VydmVyIGFuZCByZW1vdmVzIHRoaXMgdXNlciBhcyBhIHBhcnRpY2lwYW50LlxuICAgKlxuICAgKiBAbWV0aG9kIGxlYXZlXG4gICAqL1xuICBsZWF2ZSgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pc0Rlc3Ryb3llZCk7XG4gICAgdGhpcy5fZGVsZXRlKGBtb2RlPSR7Q29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFU30mbGVhdmU9dHJ1ZWApO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciwgYnV0IGRlbGV0aW9uIG1vZGUgbWF5IGNhdXNlIHVzZXIgdG8gcmVtYWluIGEgcGFydGljaXBhbnQuXG4gICAqXG4gICAqIFRoaXMgY2FsbCB3aWxsIHN1cHBvcnQgdmFyaW91cyBkZWxldGlvbiBtb2Rlcy5cbiAgICpcbiAgICogRGVsZXRpb24gTW9kZXM6XG4gICAqXG4gICAqICogbGF5ZXIuQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMOiBUaGlzIGRlbGV0ZXMgdGhlIGxvY2FsIGNvcHkgaW1tZWRpYXRlbHksIGFuZCBhdHRlbXB0cyB0byBhbHNvXG4gICAqICAgZGVsZXRlIHRoZSBzZXJ2ZXIncyBjb3B5LlxuICAgKiAqIGxheWVyLkNvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVM6IERlbGV0ZXMgdGhlIGxvY2FsIGNvcHkgaW1tZWRpYXRlbHksIGFuZCBhdHRlbXB0cyB0byBkZWxldGUgaXQgZnJvbSBhbGxcbiAgICogICBvZiBteSBkZXZpY2VzLiAgT3RoZXIgdXNlcnMgcmV0YWluIGFjY2Vzcy5cbiAgICogKiB0cnVlOiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgdGhpIGlzIHRoZSBzYW1lIGFzIEFMTC5cbiAgICpcbiAgICogTVlfREVWSUNFUyBkb2VzIG5vdCByZW1vdmUgdGhpcyB1c2VyIGFzIGEgcGFydGljaXBhbnQuICBUaGF0IG1lYW5zIGEgbmV3IE1lc3NhZ2Ugb24gdGhpcyBDb252ZXJzYXRpb24gd2lsbCByZWNyZWF0ZSB0aGVcbiAgICogQ29udmVyc2F0aW9uIGZvciB0aGlzIHVzZXIuICBTZWUgbGF5ZXIuQ29udmVyc2F0aW9uLmxlYXZlKCkgaW5zdGVhZC5cbiAgICpcbiAgICogRXhlY3V0ZXMgYXMgZm9sbG93czpcbiAgICpcbiAgICogMS4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIGRlbGV0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDIuIERlbGV0ZSdzIHRoZSBsb2NhbCBvYmplY3RcbiAgICogMy4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIG5vIGVycm9ycyBhcmUgZmlyZWQgZXhjZXB0IGJ5IGxheWVyLlN5bmNNYW5hZ2VyLCBidXQgdGhlIENvbnZlcnNhdGlvbiB3aWxsIGJlIHJlbG9hZGVkIGZyb20gdGhlIHNlcnZlcixcbiAgICogICAgdHJpZ2dlcmluZyBhIGNvbnZlcnNhdGlvbnM6YWRkIGV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gZGVsZXRpb25Nb2RlXG4gICAqL1xuICBkZWxldGUobW9kZSkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcblxuICAgIGxldCBxdWVyeVN0cjtcbiAgICBzd2l0Y2ggKG1vZGUpIHtcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMOlxuICAgICAgY2FzZSB0cnVlOlxuICAgICAgICBxdWVyeVN0ciA9IGBtb2RlPSR7Q29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOlxuICAgICAgICBxdWVyeVN0ciA9IGBtb2RlPSR7Q29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFU30mbGVhdmU9ZmFsc2VgO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQpO1xuICAgIH1cblxuICAgIHRoaXMuX2RlbGV0ZShxdWVyeVN0cik7XG4gIH1cblxuICAgIC8qKlxuICAgKiBMYXllclBhdGNoIHdpbGwgY2FsbCB0aGlzIGFmdGVyIGNoYW5naW5nIGFueSBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBUcmlnZ2VyIGFueSBjbGVhbnVwIG9yIGV2ZW50cyBuZWVkZWQgYWZ0ZXIgdGhlc2UgY2hhbmdlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUGF0Y2hFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtNaXhlZH0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAqIEBwYXJhbSAge01peGVkfSBvbGRWYWx1ZSAtIFByaW9yIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0gIHtzdHJpbmdbXX0gcGF0aHMgLSBBcnJheSBvZiBwYXRocyBzcGVjaWZpY2FsbHkgbW9kaWZpZWQ6IFsncGFydGljaXBhbnRzJ10sIFsnbWV0YWRhdGEua2V5QScsICdtZXRhZGF0YS5rZXlCJ11cbiAgICovXG4gIF9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpIHtcbiAgICAvLyBDZXJ0YWluIHR5cGVzIG9mIF9fdXBkYXRlIGhhbmRsZXJzIGFyZSBkaXNhYmxlZCB3aGlsZSB2YWx1ZXMgYXJlIGJlaW5nIHNldCBieVxuICAgIC8vIGxheWVyIHBhdGNoIHBhcnNlciBiZWNhdXNlIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gc2V0dGluZyBhIHZhbHVlICh0cmlnZ2VycyBhbiBldmVudClcbiAgICAvLyBhbmQgY2hhbmdlIGEgcHJvcGVydHkgb2YgYSB2YWx1ZSAodHJpZ2dlcnMgb25seSB0aGlzIGNhbGxiYWNrKSByZXN1bHQgaW4gaW5jb25zaXN0ZW50XG4gICAgLy8gYmVoYXZpb3JzLiAgRW5hYmxlIHRoZW0gbG9uZyBlbm91Z2ggdG8gYWxsb3cgX191cGRhdGUgY2FsbHMgdG8gYmUgbWFkZVxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZXZlbnRzID0gdGhpcy5fZGlzYWJsZUV2ZW50cztcbiAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAgICAgIGlmIChwYXRoc1swXS5pbmRleE9mKCdtZXRhZGF0YScpID09PSAwKSB7XG4gICAgICAgIHRoaXMuX191cGRhdGVNZXRhZGF0YShuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgIH0gZWxzZSBpZiAocGF0aHNbMF0gPT09ICdwYXJ0aWNpcGFudHMnKSB7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgICAgIC8vIG9sZFZhbHVlL25ld1ZhbHVlIGNvbWUgYXMgYSBCYXNpYyBJZGVudGl0eSBQT0pPOyBsZXRzIGRlbGl2ZXIgZXZlbnRzIHdpdGggYWN0dWFsIGluc3RhbmNlc1xuICAgICAgICBvbGRWYWx1ZSA9IG9sZFZhbHVlLm1hcChpZGVudGl0eSA9PiBjbGllbnQuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQpKTtcbiAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5tYXAoaWRlbnRpdHkgPT4gY2xpZW50LmdldElkZW50aXR5KGlkZW50aXR5LmlkKSk7XG4gICAgICAgIHRoaXMuX191cGRhdGVQYXJ0aWNpcGFudHMobmV3VmFsdWUsIG9sZFZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBldmVudHM7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBkbyBub3RoaW5nXG4gICAgfVxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBvbGRWYWx1ZSBhbmQgbmV3VmFsdWUgZm9yIHBhcnRpY2lwYW50cyxcbiAgICogZ2VuZXJhdGUgYSBsaXN0IG9mIHdob20gd2FzIGFkZGVkIGFuZCB3aG9tIHdhcyByZW1vdmVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRQYXJ0aWNpcGFudENoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBvbGRWYWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFJldHVybnMgY2hhbmdlcyBpbiB0aGUgZm9ybSBvZiBge2FkZDogWy4uLl0sIHJlbW92ZTogWy4uLl19YFxuICAgKi9cbiAgX2dldFBhcnRpY2lwYW50Q2hhbmdlKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIGNvbnN0IGNoYW5nZSA9IHt9O1xuICAgIGNoYW5nZS5hZGQgPSBuZXdWYWx1ZS5maWx0ZXIocGFydGljaXBhbnQgPT4gb2xkVmFsdWUuaW5kZXhPZihwYXJ0aWNpcGFudCkgPT09IC0xKTtcbiAgICBjaGFuZ2UucmVtb3ZlID0gb2xkVmFsdWUuZmlsdGVyKHBhcnRpY2lwYW50ID0+IG5ld1ZhbHVlLmluZGV4T2YocGFydGljaXBhbnQpID09PSAtMSk7XG4gICAgcmV0dXJuIGNoYW5nZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHNwZWNpZmllZCBtZXRhZGF0YSBrZXlzLlxuICAgKlxuICAgKiBVcGRhdGVzIHRoZSBsb2NhbCBvYmplY3QncyBtZXRhZGF0YSBhbmQgc3luY3MgdGhlIGNoYW5nZSB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXMoe1xuICAgKiAgICAgICAgICAndGl0bGUnOiAnSSBhbSBhIHRpdGxlJyxcbiAgICogICAgICAgICAgJ2NvbG9ycy5iYWNrZ3JvdW5kJzogJ3JlZCcsXG4gICAqICAgICAgICAgICdjb2xvcnMudGV4dCc6IHtcbiAgICogICAgICAgICAgICAgICdmaWxsJzogJ2JsdWUnLFxuICAgKiAgICAgICAgICAgICAgJ3NoYWRvdyc6ICdibGFjaydcbiAgICogICAgICAgICAgIH0sXG4gICAqICAgICAgICAgICAnY29sb3JzLnRpdGxlLmZpbGwnOiAncmVkJ1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBVc2Ugc2V0TWV0YWRhdGFQcm9wZXJ0aWVzIHRvIHNwZWNpZnkgdGhlIHBhdGggdG8gYSBwcm9wZXJ0eSwgYW5kIGEgbmV3IHZhbHVlIGZvciB0aGF0IHByb3BlcnR5LlxuICAgKiBNdWx0aXBsZSBwcm9wZXJ0aWVzIGNhbiBiZSBjaGFuZ2VkIHRoaXMgd2F5LiAgV2hhdGV2ZXIgdmFsdWUgd2FzIHRoZXJlIGJlZm9yZSBpc1xuICAgKiByZXBsYWNlZCB3aXRoIHRoZSBuZXcgdmFsdWU7IHNvIGluIHRoZSBhYm92ZSBleGFtcGxlLCB3aGF0ZXZlciBvdGhlciBrZXlzIG1heSBoYXZlXG4gICAqIGV4aXN0ZWQgdW5kZXIgYGNvbG9ycy50ZXh0YCBoYXZlIGJlZW4gcmVwbGFjZWQgYnkgdGhlIG5ldyBvYmplY3QgYHtmaWxsOiAnYmx1ZScsIHNoYWRvdzogJ2JsYWNrJ31gLlxuICAgKlxuICAgKiBOb3RlIGFsc28gdGhhdCBvbmx5IHN0cmluZyBhbmQgc3Vib2JqZWN0cyBhcmUgYWNjZXB0ZWQgYXMgdmFsdWVzLlxuICAgKlxuICAgKiBLZXlzIHdpdGggJy4nIHdpbGwgdXBkYXRlIGEgZmllbGQgb2YgYW4gb2JqZWN0IChhbmQgY3JlYXRlIGFuIG9iamVjdCBpZiBpdCB3YXNuJ3QgdGhlcmUpOlxuICAgKlxuICAgKiBJbml0aWFsIG1ldGFkYXRhOiB7fVxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXMoe1xuICAgKiAgICAgICAgICAnY29sb3JzLmJhY2tncm91bmQnOiAncmVkJyxcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTWV0YWRhdGEgaXMgbm93OiBge2NvbG9yczoge2JhY2tncm91bmQ6ICdyZWQnfX1gXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllcyh7XG4gICAqICAgICAgICAgICdjb2xvcnMuZm9yZWdyb3VuZCc6ICdibGFjaycsXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE1ldGFkYXRhIGlzIG5vdzogYHtjb2xvcnM6IHtiYWNrZ3JvdW5kOiAncmVkJywgZm9yZWdyb3VuZDogJ2JsYWNrJ319YFxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBVcGRhdGVzIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSBvZiB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDIuIFRyaWdnZXJzIGEgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnRcbiAgICogMy4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIHVwZGF0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDQuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IGFub3RoZXJcbiAgICogICAgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnQgaXMgZmlyZWQgYXMgdGhlIGNoYW5nZSBpcyByb2xsZWQgYmFjay5cbiAgICpcbiAgICogQG1ldGhvZCBzZXRNZXRhZGF0YVByb3BlcnRpZXNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwcm9wZXJ0aWVzXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKlxuICAgKi9cbiAgc2V0TWV0YWRhdGFQcm9wZXJ0aWVzKHByb3BzKSB7XG4gICAgY29uc3QgbGF5ZXJQYXRjaE9wZXJhdGlvbnMgPSBbXTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgbGV0IGZ1bGxOYW1lID0gbmFtZTtcbiAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lICE9PSAnbWV0YWRhdGEnICYmIG5hbWUuaW5kZXhPZignbWV0YWRhdGEuJykgIT09IDApIHtcbiAgICAgICAgICBmdWxsTmFtZSA9ICdtZXRhZGF0YS4nICsgbmFtZTtcbiAgICAgICAgfVxuICAgICAgICBsYXllclBhdGNoT3BlcmF0aW9ucy5wdXNoKHtcbiAgICAgICAgICBvcGVyYXRpb246ICdzZXQnLFxuICAgICAgICAgIHByb3BlcnR5OiBmdWxsTmFtZSxcbiAgICAgICAgICB2YWx1ZTogcHJvcHNbbmFtZV0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG5cbiAgICAvLyBEbyB0aGlzIGJlZm9yZSBzZXRTeW5jaW5nIGFzIGlmIHRoZXJlIGFyZSBhbnkgZXJyb3JzLCB3ZSBzaG91bGQgbmV2ZXIgZXZlblxuICAgIC8vIHN0YXJ0IHNldHRpbmcgdXAgYSByZXF1ZXN0LlxuICAgIFV0aWwubGF5ZXJQYXJzZSh7XG4gICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICB0eXBlOiAnQ29udmVyc2F0aW9uJyxcbiAgICAgIG9wZXJhdGlvbnM6IGxheWVyUGF0Y2hPcGVyYXRpb25zLFxuICAgICAgY2xpZW50OiB0aGlzLmdldENsaWVudCgpLFxuICAgIH0pO1xuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcblxuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkobGF5ZXJQYXRjaE9wZXJhdGlvbnMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5sYXllci1wYXRjaCtqc29uJyxcbiAgICAgIH0sXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAhdGhpcy5pc0Rlc3Ryb3llZCkgdGhpcy5fbG9hZCgpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBEZWxldGVzIHNwZWNpZmllZCBtZXRhZGF0YSBrZXlzLlxuICAgKlxuICAgKiBVcGRhdGVzIHRoZSBsb2NhbCBvYmplY3QncyBtZXRhZGF0YSBhbmQgc3luY3MgdGhlIGNoYW5nZSB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5kZWxldGVNZXRhZGF0YVByb3BlcnRpZXMoXG4gICAqICAgICAgICAgIFsndGl0bGUnLCAnY29sb3JzLmJhY2tncm91bmQnLCAnY29sb3JzLnRpdGxlLmZpbGwnXVxuICAgKiAgICAgICk7XG4gICAqXG4gICAqIFVzZSBkZWxldGVNZXRhZGF0YVByb3BlcnRpZXMgdG8gc3BlY2lmeSBwYXRocyB0byBwcm9wZXJ0aWVzIHRvIGJlIGRlbGV0ZWQuXG4gICAqIE11bHRpcGxlIHByb3BlcnRpZXMgY2FuIGJlIGRlbGV0ZWQuXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIDEuIFVwZGF0ZXMgdGhlIG1ldGFkYXRhIHByb3BlcnR5IG9mIHRoZSBsb2NhbCBvYmplY3RcbiAgICogMi4gVHJpZ2dlcnMgYSBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudFxuICAgKiAzLiBTdWJtaXRzIGEgcmVxdWVzdCB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIgdG8gdXBkYXRlIHRoZSBzZXJ2ZXIncyBvYmplY3RcbiAgICogNC4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIG5vIGVycm9ycyBhcmUgZmlyZWQgZXhjZXB0IGJ5IGxheWVyLlN5bmNNYW5hZ2VyLCBidXQgYW5vdGhlclxuICAgKiAgICBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudCBpcyBmaXJlZCBhcyB0aGUgY2hhbmdlIGlzIHJvbGxlZCBiYWNrLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZU1ldGFkYXRhUHJvcGVydGllc1xuICAgKiBAcGFyYW0gIHtzdHJpbmdbXX0gcHJvcGVydGllc1xuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIGRlbGV0ZU1ldGFkYXRhUHJvcGVydGllcyhwcm9wcykge1xuICAgIGNvbnN0IGxheWVyUGF0Y2hPcGVyYXRpb25zID0gW107XG4gICAgcHJvcHMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcbiAgICAgIGlmIChwcm9wZXJ0eSAhPT0gJ21ldGFkYXRhJyAmJiBwcm9wZXJ0eS5pbmRleE9mKCdtZXRhZGF0YS4nKSAhPT0gMCkge1xuICAgICAgICBwcm9wZXJ0eSA9ICdtZXRhZGF0YS4nICsgcHJvcGVydHk7XG4gICAgICB9XG4gICAgICBsYXllclBhdGNoT3BlcmF0aW9ucy5wdXNoKHtcbiAgICAgICAgb3BlcmF0aW9uOiAnZGVsZXRlJyxcbiAgICAgICAgcHJvcGVydHksXG4gICAgICB9KTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuXG4gICAgLy8gRG8gdGhpcyBiZWZvcmUgc2V0U3luY2luZyBhcyBpZiB0aGVyZSBhcmUgYW55IGVycm9ycywgd2Ugc2hvdWxkIG5ldmVyIGV2ZW5cbiAgICAvLyBzdGFydCBzZXR0aW5nIHVwIGEgcmVxdWVzdC5cbiAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgdHlwZTogJ0NvbnZlcnNhdGlvbicsXG4gICAgICBvcGVyYXRpb25zOiBsYXllclBhdGNoT3BlcmF0aW9ucyxcbiAgICAgIGNsaWVudDogdGhpcy5nZXRDbGllbnQoKSxcbiAgICB9KTtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGxheWVyUGF0Y2hPcGVyYXRpb25zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicsXG4gICAgICB9LFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgX2RlbGV0ZVJlc3VsdChyZXN1bHQsIGlkKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICghcmVzdWx0LmRhdGEgfHwgcmVzdWx0LmRhdGEuaWQgIT09ICdub3RfZm91bmQnKSkgQ29udmVyc2F0aW9uLmxvYWQoaWQsIGNsaWVudCk7XG4gIH1cblxuXG4gIF9yZWdpc3RlcigpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIGNsaWVudC5fYWRkQ29udmVyc2F0aW9uKHRoaXMpO1xuICB9XG5cblxuICAvKlxuICAgKiBJbnN1cmUgdGhhdCBjb252ZXJzYXRpb24udW5yZWFkQ291bnQtLSBjYW4gbmV2ZXIgcmVkdWNlIHRoZSB2YWx1ZSB0byBuZWdhdGl2ZSB2YWx1ZXMuXG4gICAqL1xuICBfX2FkanVzdFVucmVhZENvdW50KG5ld1ZhbHVlKSB7XG4gICAgaWYgKG5ld1ZhbHVlIDwgMCkgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGNoYW5nZSBpbiB0aGUgdW5yZWFkQ291bnQgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LlxuICAgKlxuICAgKiBBbnkgdHJpZ2dlcmluZyBvZiB0aGlzIGZyb20gYSB3ZWJzb2NrZXQgcGF0Y2ggdW5yZWFkX21lc3NhZ2VfY291bnQgc2hvdWxkIHdhaXQgYSBzZWNvbmQgYmVmb3JlIGZpcmluZyBhbnkgZXZlbnRzXG4gICAqIHNvIHRoYXQgaWYgdGhlcmUgYXJlIGEgc2VyaWVzIG9mIHRoZXNlIHVwZGF0ZXMsIHdlIGRvbid0IHNlZSBhIGxvdCBvZiBqaXR0ZXIuXG4gICAqXG4gICAqIE5PVEU6IF9vbGRVbnJlYWRDb3VudCBpcyB1c2VkIHRvIHBhc3MgZGF0YSB0byBfdXBkYXRlVW5yZWFkQ291bnRFdmVudCBiZWNhdXNlIHRoaXMgbWV0aG9kIGNhbiBiZSBjYWxsZWQgbWFueSB0aW1lc1xuICAgKiBhIHNlY29uZCwgYW5kIHdlIG9ubHkgd2FudCB0byB0cmlnZ2VyIHRoaXMgd2l0aCBhIHN1bW1hcnkgb2YgY2hhbmdlcyByYXRoZXIgdGhhbiBlYWNoIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlVW5yZWFkQ291bnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bnVtYmVyfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZVVucmVhZENvdW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIGlmICh0aGlzLl9pbkxheWVyUGFyc2VyKSB7XG4gICAgICBpZiAodGhpcy5fb2xkVW5yZWFkQ291bnQgPT09IHVuZGVmaW5lZCkgdGhpcy5fb2xkVW5yZWFkQ291bnQgPSBvbGRWYWx1ZTtcbiAgICAgIGlmICh0aGlzLl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQpIGNsZWFyVGltZW91dCh0aGlzLl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQpO1xuICAgICAgdGhpcy5fdXBkYXRlVW5yZWFkQ291bnRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl91cGRhdGVVbnJlYWRDb3VudEV2ZW50KCksIDEwMDApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91cGRhdGVVbnJlYWRDb3VudEV2ZW50KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpcmUgZXZlbnRzIHJlbGF0ZWQgdG8gY2hhbmdlcyB0byB1bnJlYWRDb3VudFxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVVbnJlYWRDb3VudEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdXBkYXRlVW5yZWFkQ291bnRFdmVudCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fb2xkVW5yZWFkQ291bnQ7XG4gICAgY29uc3QgbmV3VmFsdWUgPSB0aGlzLl9fdW5yZWFkQ291bnQ7XG4gICAgdGhpcy5fb2xkVW5yZWFkQ291bnQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAobmV3VmFsdWUgPT09IG9sZFZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgIG5ld1ZhbHVlLFxuICAgICAgb2xkVmFsdWUsXG4gICAgICBwcm9wZXJ0eTogJ3VucmVhZENvdW50JyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBsYXN0TWVzc2FnZSBwb2ludGVyIHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC4gIENoYW5nZXMgdG8gcHJvcGVydGllcyB3aXRoaW4gdGhlIGxhc3RNZXNzYWdlIG9iamVjdCB3aWxsXG4gICAqIG5vdCB0cmlnZ2VyIHRoaXMgY2FsbC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZUxhc3RNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVMYXN0TWVzc2FnZShuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAobmV3VmFsdWUgJiYgb2xkVmFsdWUgJiYgbmV3VmFsdWUuaWQgPT09IG9sZFZhbHVlLmlkKSByZXR1cm47XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbGFzdE1lc3NhZ2UnLFxuICAgICAgbmV3VmFsdWUsXG4gICAgICBvbGRWYWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBwYXJ0aWNpcGFudHMgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LiAgQ2hhbmdlcyB0byB0aGUgcGFydGljaXBhbnRzIGFycmF5IHRoYXQgZG9uJ3QgcmVwbGFjZSB0aGUgYXJyYXlcbiAgICogd2l0aCBhIG5ldyBhcnJheSB3aWxsIHJlcXVpcmUgZGlyZWN0bHkgY2FsbGluZyB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZVBhcnRpY2lwYW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmdbXX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7c3RyaW5nW119IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZVBhcnRpY2lwYW50cyhuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAodGhpcy5faW5MYXllclBhcnNlcikgcmV0dXJuO1xuICAgIGNvbnN0IGNoYW5nZSA9IHRoaXMuX2dldFBhcnRpY2lwYW50Q2hhbmdlKG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgaWYgKGNoYW5nZS5hZGQubGVuZ3RoIHx8IGNoYW5nZS5yZW1vdmUubGVuZ3RoKSB7XG4gICAgICBjaGFuZ2UucHJvcGVydHkgPSAncGFydGljaXBhbnRzJztcbiAgICAgIGNoYW5nZS5vbGRWYWx1ZSA9IG9sZFZhbHVlO1xuICAgICAgY2hhbmdlLm5ld1ZhbHVlID0gbmV3VmFsdWU7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywgY2hhbmdlKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb252ZXJzYXRpb24gaW5zdGFuY2UgZnJvbSBhIHNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzLCB3aWxsIHVwZGF0ZSB0aGUgZXhpc3RpbmcgY29weSB3aXRoXG4gICAqIHByZXN1bWFibHkgbmV3ZXIgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnZlcnNhdGlvbiAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoY29udmVyc2F0aW9uLCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbih7XG4gICAgICBjbGllbnQsXG4gICAgICBmcm9tU2VydmVyOiBjb252ZXJzYXRpb24sXG4gICAgICBfZnJvbURCOiBjb252ZXJzYXRpb24uX2Zyb21EQixcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIG9yIGNyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqICAgICAgdmFyIGNvbnZlcnNhdGlvbiA9IGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoe1xuICAgKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAqICAgICAgICAgIGRpc3RpbmN0OiB0cnVlLFxuICAgKiAgICAgICAgICBtZXRhZGF0YToge1xuICAgKiAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIG5vdCBhIHRpdGxlISdcbiAgICogICAgICAgICAgfSxcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgICdjb252ZXJzYXRpb25zOmxvYWRlZCc6IGZ1bmN0aW9uKGV2dCkge1xuICAgKlxuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE9ubHkgdHJpZXMgdG8gZmluZCBhIENvbnZlcnNhdGlvbiBpZiBpdHMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqIERpc3RpbmN0IGRlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIFJlY29tbWVuZCB1c2luZyBgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7Li4ufSlgXG4gICAqIGluc3RlYWQgb2YgYENvbnZlcnNhdGlvbi5jcmVhdGUoey4uLn0pYC5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMucGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIGxheWVyLklkZW50aXR5IG9iamVjdHMgdG8gY3JlYXRlIGEgY29udmVyc2F0aW9uIHdpdGguXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGlzdGluY3Q9dHJ1ZV0gLSBDcmVhdGUgYSBkaXN0aW5jdCBjb252ZXJzYXRpb25cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhPXt9XSAtIEluaXRpYWwgbWV0YWRhdGEgZm9yIENvbnZlcnNhdGlvblxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSB7XG4gICAgICBkaXN0aW5jdDogb3B0aW9ucy5kaXN0aW5jdCxcbiAgICAgIHBhcnRpY2lwYW50czogb3B0aW9ucy5jbGllbnQuX2ZpeElkZW50aXRpZXMob3B0aW9ucy5wYXJ0aWNpcGFudHMpLFxuICAgICAgbWV0YWRhdGE6IG9wdGlvbnMubWV0YWRhdGEsXG4gICAgICBjbGllbnQ6IG9wdGlvbnMuY2xpZW50LFxuICAgIH07XG4gICAgaWYgKG5ld09wdGlvbnMuZGlzdGluY3QpIHtcbiAgICAgIGNvbnN0IGNvbnYgPSB0aGlzLl9jcmVhdGVEaXN0aW5jdChuZXdPcHRpb25zKTtcbiAgICAgIGlmIChjb252KSByZXR1cm4gY29udjtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb24obmV3T3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIG9yIEZpbmQgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIElmIHRoZSBzdGF0aWMgQ29udmVyc2F0aW9uLmNyZWF0ZSBtZXRob2QgZ2V0cyBhIHJlcXVlc3QgZm9yIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uLFxuICAgKiBzZWUgaWYgd2UgaGF2ZSBvbmUgY2FjaGVkLlxuICAgKlxuICAgKiBXaWxsIGZpcmUgdGhlICdjb252ZXJzYXRpb25zOmxvYWRlZCcgZXZlbnQgaWYgb25lIGlzIHByb3ZpZGVkIGluIHRoaXMgY2FsbCxcbiAgICogYW5kIGEgQ29udmVyc2F0aW9uIGlzIGZvdW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVEaXN0aW5jdFxuICAgKiBAc3RhdGljXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIFNlZSBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlIG9wdGlvbnM7IHBhcnRpY2lwYW50cyBtdXN0IGJlIGxheWVyLklkZW50aXR5W11cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVEaXN0aW5jdChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMucGFydGljaXBhbnRzLmluZGV4T2Yob3B0aW9ucy5jbGllbnQudXNlcikgPT09IC0xKSB7XG4gICAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5wdXNoKG9wdGlvbnMuY2xpZW50LnVzZXIpO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnRpY2lwYW50c0hhc2ggPSB7fTtcbiAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5mb3JFYWNoKChwYXJ0aWNpcGFudCkgPT4ge1xuICAgICAgcGFydGljaXBhbnRzSGFzaFtwYXJ0aWNpcGFudC5pZF0gPSBwYXJ0aWNpcGFudDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnYgPSBvcHRpb25zLmNsaWVudC5maW5kQ2FjaGVkQ29udmVyc2F0aW9uKChhQ29udikgPT4ge1xuICAgICAgaWYgKGFDb252LmRpc3RpbmN0ICYmIGFDb252LnBhcnRpY2lwYW50cy5sZW5ndGggPT09IG9wdGlvbnMucGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgYUNvbnYucGFydGljaXBhbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgIGlmICghcGFydGljaXBhbnRzSGFzaFthQ29udi5wYXJ0aWNpcGFudHNbaW5kZXhdLmlkXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGNvbnYpIHtcbiAgICAgIGNvbnYuX3NlbmREaXN0aW5jdEV2ZW50ID0gbmV3IExheWVyRXZlbnQoe1xuICAgICAgICB0YXJnZXQ6IGNvbnYsXG4gICAgICAgIHJlc3VsdDogIW9wdGlvbnMubWV0YWRhdGEgfHwgVXRpbC5kb2VzT2JqZWN0TWF0Y2gob3B0aW9ucy5tZXRhZGF0YSwgY29udi5tZXRhZGF0YSkgP1xuICAgICAgICAgIENvbnZlcnNhdGlvbi5GT1VORCA6IENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSxcbiAgICAgIH0sICdjb252ZXJzYXRpb25zOnNlbnQnKTtcbiAgICAgIHJldHVybiBjb252O1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFycmF5IG9mIHBhcnRpY2lwYW50IGlkcy5cbiAqXG4gKiBEbyBub3QgZGlyZWN0bHkgbWFuaXB1bGF0ZTtcbiAqIHVzZSBhZGRQYXJ0aWNpcGFudHMsIHJlbW92ZVBhcnRpY2lwYW50cyBhbmQgcmVwbGFjZVBhcnRpY2lwYW50c1xuICogdG8gbWFuaXB1bGF0ZSB0aGUgYXJyYXkuXG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5W119XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUucGFydGljaXBhbnRzID0gbnVsbDtcblxuXG4vKipcbiAqIE51bWJlciBvZiB1bnJlYWQgbWVzc2FnZXMgaW4gdGhlIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLnVucmVhZENvdW50ID0gMDtcblxuLyoqXG4gKiBUaGlzIGlzIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uLlxuICpcbiAqIFlvdSBjYW4gaGF2ZSAxIGRpc3RpbmN0IGNvbnZlcnNhdGlvbiBhbW9uZyBhIHNldCBvZiBwYXJ0aWNpcGFudHMuXG4gKiBUaGVyZSBhcmUgbm8gbGltaXRzIHRvIGhvdyBtYW55IG5vbi1kaXN0aW5jdCBDb252ZXJzYXRpb25zIHlvdSBoYXZlIGhhdmVcbiAqIGFtb25nIGEgc2V0IG9mIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5kaXN0aW5jdCA9IHRydWU7XG5cbi8qKlxuICogVGhlIGxhc3QgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlIHRvIGJlIHNlbnQvcmVjZWl2ZWQgZm9yIHRoaXMgQ29udmVyc2F0aW9uLlxuICpcbiAqIFZhbHVlIG1heSBiZSBhIE1lc3NhZ2UgdGhhdCBoYXMgYmVlbiBsb2NhbGx5IGNyZWF0ZWQgYnV0IG5vdCB5ZXQgcmVjZWl2ZWQgYnkgc2VydmVyLlxuICogQHR5cGUge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5sYXN0TWVzc2FnZSA9IG51bGw7XG5cblxuQ29udmVyc2F0aW9uLmV2ZW50UHJlZml4ID0gJ2NvbnZlcnNhdGlvbnMnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24gdGhhdCB3YXMgcmVxdWVzdGVkIGhhcyBiZWVuIGZvdW5kLCBidXQgdGhlcmUgd2FzIGEgbWlzbWF0Y2ggaW4gbWV0YWRhdGEuXG4gKlxuICogSWYgdGhlIGNyZWF0ZUNvbnZlcnNhdGlvbiByZXF1ZXN0IGNvbnRhaW5lZCBtZXRhZGF0YSBhbmQgaXQgZGlkIG5vdCBtYXRjaCB0aGUgRGlzdGluY3QgQ29udmVyc2F0aW9uXG4gKiB0aGF0IG1hdGNoZWQgdGhlIHJlcXVlc3RlZCBwYXJ0aWNpcGFudHMsIHRoZW4gdGhpcyB2YWx1ZSBpcyBwYXNzZWQgdG8gbm90aWZ5IHlvdXIgYXBwIHRoYXQgdGhlIENvbnZlcnNhdGlvblxuICogd2FzIHJldHVybmVkIGJ1dCBkb2VzIG5vdCBleGFjdGx5IG1hdGNoIHlvdXIgcmVxdWVzdC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSA9ICdGb3VuZE1pc21hdGNoJztcblxuXG4vKipcbiAqIFByZWZpeCB0byB1c2Ugd2hlbiBnZW5lcmF0aW5nIGFuIElEIGZvciBpbnN0YW5jZXMgb2YgdGhpcyBjbGFzc1xuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbkNvbnZlcnNhdGlvbi5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvJztcblxuQ29udmVyc2F0aW9uLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgY29udmVyc2F0aW9uIGlzIG5vdyBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYWZ0ZXIgc3VjY2Vzc2Z1bGx5IGNyZWF0aW5nIHRoZSBjb252ZXJzYXRpb25cbiAgICogb24gdGhlIHNlcnZlci4gIFRoZSBSZXN1bHQgcHJvcGVydHkgaXMgb25lIG9mOlxuICAgKlxuICAgKiAqIENvbnZlcnNhdGlvbi5DUkVBVEVEOiBBIG5ldyBDb252ZXJzYXRpb24gaGFzIGJlZW4gY3JlYXRlZFxuICAgKiAqIENvbnZlcnNhdGlvbi5GT1VORDogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICogKiBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBidXQgbm90ZSB0aGF0IHRoZSBtZXRhZGF0YSBpcyBOT1Qgd2hhdCB5b3UgcmVxdWVzdGVkLlxuICAgKlxuICAgKiBBbGwgb2YgdGhlc2UgcmVzdWx0cyB3aWxsIGFsc28gbWVhbiB0aGF0IHRoZSB1cGRhdGVkIHByb3BlcnR5IHZhbHVlcyBoYXZlIGJlZW5cbiAgICogY29waWVkIGludG8geW91ciBDb252ZXJzYXRpb24gb2JqZWN0LiAgVGhhdCBtZWFucyB5b3VyIG1ldGFkYXRhIHByb3BlcnR5IG1heSBub1xuICAgKiBsb25nZXIgYmUgaXRzIGluaXRpYWwgdmFsdWU7IGl0IG1heSBiZSB0aGUgdmFsdWUgZm91bmQgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LnJlc3VsdFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEFuIGF0dGVtcHQgdG8gc2VuZCB0aGlzIGNvbnZlcnNhdGlvbiB0byB0aGUgc2VydmVyIGhhcyBmYWlsZWQuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBUaGUgY29udmVyc2F0aW9uIGlzIG5vdyBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLkNvbnZlcnNhdGlvbi5sb2FkKCkgbWV0aG9kLlxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpsb2FkZWQnLFxuXG4gIC8qKlxuICAgKiBBbiBhdHRlbXB0IHRvIGxvYWQgdGhpcyBjb252ZXJzYXRpb24gZnJvbSB0aGUgc2VydmVyIGhhcyBmYWlsZWQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmxvYWQoKSBtZXRob2QuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBlaXRoZXIgYSBzdWNjZXNzZnVsIGNhbGwgdG8gZGVsZXRlKCkgb24gdGhpcyBpbnN0YW5jZVxuICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlJyxcblxuICAvKipcbiAgICogVGhpcyBjb252ZXJzYXRpb24gaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGV2ZW50LmNoYW5nZXMgLSBBcnJheSBvZiBjaGFuZ2VzIHJlcG9ydGVkIGJ5IHRoaXMgZXZlbnRcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZlbnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgKiBAcGFyYW0ge01peGVkfSBldmVudC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBjaGFuZ2VkXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldmVudC50YXJnZXRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmNoYW5nZSddLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ29udmVyc2F0aW9uLCBbQ29udmVyc2F0aW9uLCAnQ29udmVyc2F0aW9uJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKENvbnZlcnNhdGlvbik7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvbjtcbiJdfQ==
