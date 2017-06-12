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
  }, {
    key: '_setupMessage',
    value: function _setupMessage(message) {
      // Setting a position is required if its going to get sorted correctly by query.
      // The correct position will be written by _populateFromServer when the object
      // is returned from the server.
      // NOTE: We have a special case where messages are sent from multiple tabs, written to indexedDB, but not yet sent,
      // they will have conflicting positions.
      // Attempts to fix this by offsetting the position by time resulted in unexpected behaviors
      // as multiple messages end up with positions greater than returned by the server.
      var position = void 0;
      if (this.lastMessage) {
        position = this.lastMessage.position + 1;
      } else if (this._lastMessagePosition) {
        position = this._lastMessagePosition + 1;
        this._lastMessagePosition = 0;
      } else {
        position = 0;
      }
      message.position = position;
      this.lastMessage = message;
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

      // If the Conversation is already on the server, don't send.
      if (wasLocalDistinct || this.syncState !== Constants.SYNC_STATE.NEW) {
        if (message) this._setupMessage(message);
        return this;
      }

      // Make sure this user is a participant (server does this for us, but
      // this insures the local copy is correct until we get a response from
      // the server
      if (this.participants.indexOf(client.user) === -1) {
        this.participants.push(client.user);
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
      var _this2 = this;

      var client = this.getClient();

      // Disable events if creating a new Conversation
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this.participants = client._fixIdentities(conversation.participants);
      this.participants.forEach(function (identity) {
        return identity.on('identities:change', _this2._handleParticipantChangeEvent, _this2);
      });
      this.distinct = conversation.distinct;
      this.unreadCount = conversation.unread_message_count;
      this.isCurrentParticipant = this.participants.indexOf(client.user) !== -1;
      _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), '_populateFromServer', this).call(this, conversation);

      if (typeof conversation.last_message === 'string') {
        this.lastMessage = client.getMessage(conversation.last_message);
      } else if (conversation.last_message) {
        this.lastMessage = client._createObject(conversation.last_message);
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
      var _this3 = this;

      // Only add those that aren't already in the list.
      var client = this.getClient();
      var identities = client._fixIdentities(participants);
      var adding = identities.filter(function (identity) {
        return _this3.participants.indexOf(identity) === -1;
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
      var _this4 = this;

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
        if (!result.success && result.data.id !== 'authentication_required') _this4._load();
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
        if (paths[0] === 'participants') {
          var client = this.getClient();
          // oldValue/newValue come as a Basic Identity POJO; lets deliver events with actual instances
          oldValue = oldValue.map(function (identity) {
            return client.getIdentity(identity.id);
          });
          newValue = newValue.map(function (identity) {
            return client.getIdentity(identity.id);
          });
          this.__updateParticipants(newValue, oldValue);
        } else {
          _get(Conversation.prototype.__proto__ || Object.getPrototypeOf(Conversation.prototype), '_handlePatchEvent', this).call(this, newValue, oldValue, paths);
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
  }, {
    key: '_deleteResult',
    value: function _deleteResult(result, id) {
      var client = this.getClient();
      if (!result.success && (!result.data || result.data.id !== 'not_found' && result.data.id !== 'authentication_required')) {
        Conversation.load(id, client);
      }
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
      var _this5 = this;

      if (this._inLayerParser) {
        if (this._oldUnreadCount === undefined) this._oldUnreadCount = oldValue;
        if (this._updateUnreadCountTimeout) clearTimeout(this._updateUnreadCountTimeout);
        this._updateUnreadCountTimeout = setTimeout(function () {
          return _this5._updateUnreadCountEvent();
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
      var _this6 = this;

      if (this._inLayerParser) return;
      var change = this._getParticipantChange(newValue, oldValue);
      change.add.forEach(function (identity) {
        return identity.on('identities:change', _this6._handleParticipantChangeEvent, _this6);
      });
      change.remove.forEach(function (identity) {
        return identity.off('identities:change', _this6._handleParticipantChangeEvent, _this6);
      });
      if (change.add.length || change.remove.length) {
        change.property = 'participants';
        change.oldValue = oldValue;
        change.newValue = newValue;
        this._triggerAsync('conversations:change', change);
      }
    }
  }, {
    key: '_handleParticipantChangeEvent',
    value: function _handleParticipantChangeEvent(evt) {
      var _this7 = this;

      evt.changes.forEach(function (change) {
        _this7._triggerAsync('conversations:change', {
          property: 'participants.' + change.property,
          identity: evt.target,
          oldValue: change.oldValue,
          newValue: change.newValue
        });
      });
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

/**
 * The position of the last known message.
 *
 * Used in the event that lastMessage has been deleted.
 *
 * @private
 * @property {Number}
 */
Conversation.prototype._lastMessagePosition = 0;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udmVyc2F0aW9uLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiU3luY2FibGUiLCJDb250YWluZXIiLCJDb252ZXJzYXRpb25NZXNzYWdlIiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJDb25zdGFudHMiLCJMYXllckV2ZW50IiwiQ29udmVyc2F0aW9uIiwib3B0aW9ucyIsInBhcnRpY2lwYW50cyIsImlzSW5pdGlhbGl6aW5nIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiZnJvbVNlcnZlciIsIl9maXhJZGVudGl0aWVzIiwiaW5kZXhPZiIsInVzZXIiLCJwdXNoIiwiX3JlZ2lzdGVyIiwibGFzdE1lc3NhZ2UiLCJjbGllbnRJZCIsIl9yZW1vdmVDb252ZXJzYXRpb24iLCJtZXRhZGF0YSIsIm1lc3NhZ2VDb25maWciLCJwYXJ0cyIsImJvZHkiLCJtaW1lVHlwZSIsImNvbnZlcnNhdGlvbklkIiwiaWQiLCJtZXNzYWdlIiwicG9zaXRpb24iLCJfbGFzdE1lc3NhZ2VQb3NpdGlvbiIsIkVycm9yIiwiZGljdGlvbmFyeSIsImNsaWVudE1pc3NpbmciLCJ3YXNMb2NhbERpc3RpbmN0IiwiQm9vbGVhbiIsIl9zZW5kRGlzdGluY3RFdmVudCIsIl9oYW5kbGVMb2NhbERpc3RpbmN0Q29udmVyc2F0aW9uIiwic3luY1N0YXRlIiwiU1lOQ19TVEFURSIsIk5FVyIsIl9zZXR1cE1lc3NhZ2UiLCJldnQiLCJfdHJpZ2dlckFzeW5jIiwiZGF0YSIsImlzTWV0YWRhdGFFbXB0eSIsImlzRW1wdHkiLCJtZXRob2QiLCJtYXAiLCJpZGVudGl0eSIsImRpc3RpbmN0IiwiY29udmVyc2F0aW9uIiwiX2Rpc2FibGVFdmVudHMiLCJmb3JFYWNoIiwib24iLCJfaGFuZGxlUGFydGljaXBhbnRDaGFuZ2VFdmVudCIsInVucmVhZENvdW50IiwidW5yZWFkX21lc3NhZ2VfY291bnQiLCJpc0N1cnJlbnRQYXJ0aWNpcGFudCIsImxhc3RfbWVzc2FnZSIsImdldE1lc3NhZ2UiLCJfY3JlYXRlT2JqZWN0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsImNvbnN0cnVjdG9yIiwiZXZlbnRQcmVmaXgiLCJyZXN1bHQiLCJGT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSIsImlkZW50aXRpZXMiLCJhZGRpbmciLCJmaWx0ZXIiLCJfcGF0Y2hQYXJ0aWNpcGFudHMiLCJhZGQiLCJyZW1vdmUiLCJjdXJyZW50UGFydGljaXBhbnRzIiwicGFydGljaXBhbnQiLCJyZW1vdmluZyIsImxlbmd0aCIsIm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCIsImNoYW5nZSIsIl9nZXRQYXJ0aWNpcGFudENoYW5nZSIsIl9hcHBseVBhcnRpY2lwYW50Q2hhbmdlIiwib3BzIiwib3BlcmF0aW9uIiwicHJvcGVydHkiLCJfeGhyIiwidXJsIiwiSlNPTiIsInN0cmluZ2lmeSIsImhlYWRlcnMiLCJzdWNjZXNzIiwiX2xvYWQiLCJjb25jYXQiLCJpbmRleCIsInNwbGljZSIsImlzRGVzdHJveWVkIiwiX2RlbGV0ZSIsIkRFTEVUSU9OX01PREUiLCJNWV9ERVZJQ0VTIiwibW9kZSIsInF1ZXJ5U3RyIiwiQUxMIiwiZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQiLCJuZXdWYWx1ZSIsIm9sZFZhbHVlIiwicGF0aHMiLCJfaW5MYXllclBhcnNlciIsImV2ZW50cyIsImdldElkZW50aXR5IiwiX191cGRhdGVQYXJ0aWNpcGFudHMiLCJlcnIiLCJsb2FkIiwiX2FkZENvbnZlcnNhdGlvbiIsIl9vbGRVbnJlYWRDb3VudCIsInVuZGVmaW5lZCIsIl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiX3VwZGF0ZVVucmVhZENvdW50RXZlbnQiLCJfX3VucmVhZENvdW50Iiwib2ZmIiwiY2hhbmdlcyIsInRhcmdldCIsIl9mcm9tREIiLCJuZXdPcHRpb25zIiwiY29udiIsIl9jcmVhdGVEaXN0aW5jdCIsInBhcnRpY2lwYW50c0hhc2giLCJmaW5kQ2FjaGVkQ29udmVyc2F0aW9uIiwiYUNvbnYiLCJkb2VzT2JqZWN0TWF0Y2giLCJGT1VORCIsInByb3RvdHlwZSIsInByZWZpeFVVSUQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiaW5pdENsYXNzIiwiYXBwbHkiLCJzdWJjbGFzc2VzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvREEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxXQUFXRCxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNRSxZQUFZRixRQUFRLGFBQVIsQ0FBbEI7QUFDQSxJQUFNRyxzQkFBc0JILFFBQVEsd0JBQVIsQ0FBNUI7QUFDQSxJQUFNSSxhQUFhSixRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTUssT0FBT0wsUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTU0sWUFBWU4sUUFBUSxVQUFSLENBQWxCO0FBQ0EsSUFBTU8sYUFBYVAsUUFBUSxnQkFBUixDQUFuQjs7SUFFTVEsWTs7O0FBQ0o7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLDBCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQSxRQUFJLENBQUNBLFFBQVFDLFlBQWIsRUFBMkJELFFBQVFDLFlBQVIsR0FBdUIsRUFBdkI7O0FBRkgsNEhBR2xCRCxPQUhrQjs7QUFJeEIsVUFBS0UsY0FBTCxHQUFzQixJQUF0QjtBQUNBLFFBQU1DLFNBQVMsTUFBS0MsU0FBTCxFQUFmOztBQUVBO0FBQ0EsUUFBSSxDQUFDSixPQUFELElBQVksQ0FBQ0EsUUFBUUssVUFBekIsRUFBcUM7QUFDbkMsWUFBS0osWUFBTCxHQUFvQkUsT0FBT0csY0FBUCxDQUFzQixNQUFLTCxZQUEzQixDQUFwQjtBQUNBLFVBQUksTUFBS0EsWUFBTCxDQUFrQk0sT0FBbEIsQ0FBMEJKLE9BQU9LLElBQWpDLE1BQTJD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Q0FBdUIzRSxXQUF2QixHQUFxQyxDQUFyQzs7QUFFQTs7Ozs7Ozs7O0FBU0FsRCxhQUFhNkgsU0FBYixDQUF1QmpGLFFBQXZCLEdBQWtDLElBQWxDOztBQUVBOzs7Ozs7QUFNQTVDLGFBQWE2SCxTQUFiLENBQXVCakgsV0FBdkIsR0FBcUMsSUFBckM7O0FBR0E7Ozs7Ozs7O0FBUUFaLGFBQWE2SCxTQUFiLENBQXVCckcsb0JBQXZCLEdBQThDLENBQTlDOztBQUVBeEIsYUFBYTBELFdBQWIsR0FBMkIsZUFBM0I7O0FBRUE7Ozs7Ozs7Ozs7O0FBV0ExRCxhQUFhNEQsZ0NBQWIsR0FBZ0QsZUFBaEQ7O0FBR0E7Ozs7OztBQU1BNUQsYUFBYThILFVBQWIsR0FBMEIseUJBQTFCOztBQUVBOUgsYUFBYStILGdCQUFiLEdBQWdDO0FBQzlCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLG9CQXBCOEI7O0FBc0I5Qjs7Ozs7O0FBTUEsMEJBNUI4Qjs7QUE4QjlCOzs7Ozs7OztBQVFBLHNCQXRDOEI7O0FBd0M5Qjs7Ozs7Ozs7QUFRQSw0QkFoRDhCOztBQWtEOUI7Ozs7Ozs7O0FBUUEsc0JBMUQ4Qjs7QUE0RDlCOzs7Ozs7Ozs7OztBQVdBLHNCQXZFOEIsRUF1RU4xQyxNQXZFTSxDQXVFQzVGLFNBQVNzSSxnQkF2RVYsQ0FBaEM7O0FBeUVBeEksS0FBS3lJLFNBQUwsQ0FBZUMsS0FBZixDQUFxQmpJLFlBQXJCLEVBQW1DLENBQUNBLFlBQUQsRUFBZSxjQUFmLENBQW5DO0FBQ0FQLFNBQVN5SSxVQUFULENBQW9CeEgsSUFBcEIsQ0FBeUJWLFlBQXpCO0FBQ0FtSSxPQUFPQyxPQUFQLEdBQWlCcEksWUFBakIiLCJmaWxlIjoiY29udmVyc2F0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIENvbnZlcnNhdGlvbiBvYmplY3QgcmVwcmVzZW50cyBhIGRpYWxvZyBhbW9uZ3N0IGEgc21hbGwgc2V0XG4gKiBvZiBwYXJ0aWNpcGFudHMuXG4gKlxuICogQ3JlYXRlIGEgQ29udmVyc2F0aW9uIHVzaW5nIHRoZSBjbGllbnQ6XG4gKlxuICogICAgICB2YXIgY29udmVyc2F0aW9uID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsJ2InXSxcbiAqICAgICAgICAgIGRpc3RpbmN0OiB0cnVlXG4gKiAgICAgIH0pO1xuICpcbiAqIE5PVEU6ICAgRG8gbm90IGNyZWF0ZSBhIGNvbnZlcnNhdGlvbiB3aXRoIG5ldyBsYXllci5Db252ZXJzYXRpb24oLi4uKSxcbiAqICAgICAgICAgVGhpcyB3aWxsIGZhaWwgdG8gaGFuZGxlIHRoZSBkaXN0aW5jdCBwcm9wZXJ0eSBzaG9ydCBvZiBnb2luZyB0byB0aGUgc2VydmVyIGZvciBldmFsdWF0aW9uLlxuICpcbiAqIE5PVEU6ICAgQ3JlYXRpbmcgYSBDb252ZXJzYXRpb24gaXMgYSBsb2NhbCBhY3Rpb24uICBBIENvbnZlcnNhdGlvbiB3aWxsIG5vdCBiZVxuICogICAgICAgICBzZW50IHRvIHRoZSBzZXJ2ZXIgdW50aWwgZWl0aGVyOlxuICpcbiAqIDEuIEEgbWVzc2FnZSBpcyBzZW50IG9uIHRoYXQgQ29udmVyc2F0aW9uXG4gKiAyLiBgQ29udmVyc2F0aW9uLnNlbmQoKWAgaXMgY2FsbGVkIChub3QgcmVjb21tZW5kZWQgYXMgbW9iaWxlIGNsaWVudHNcbiAqICAgIGV4cGVjdCBhdCBsZWFzdCBvbmUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlIGluIGEgQ29udmVyc2F0aW9uKVxuICpcbiAqIEtleSBtZXRob2RzLCBldmVudHMgYW5kIHByb3BlcnRpZXMgZm9yIGdldHRpbmcgc3RhcnRlZDpcbiAqXG4gKiBQcm9wZXJ0aWVzOlxuICpcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmlkOiB0aGlzIHByb3BlcnR5IGlzIHdvcnRoIGJlaW5nIGZhbWlsaWFyIHdpdGg7IGl0IGlkZW50aWZpZXMgdGhlXG4gKiAgIENvbnZlcnNhdGlvbiBhbmQgY2FuIGJlIHVzZWQgaW4gYGNsaWVudC5nZXRDb252ZXJzYXRpb24oaWQpYCB0byByZXRyaWV2ZSBpdC5cbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmxhc3RNZXNzYWdlOiBUaGlzIHByb3BlcnR5IG1ha2VzIGl0IGVhc3kgdG8gc2hvdyBpbmZvIGFib3V0IHRoZSBtb3N0IHJlY2VudCBNZXNzYWdlXG4gKiAgICB3aGVuIHJlbmRlcmluZyBhIGxpc3Qgb2YgQ29udmVyc2F0aW9ucy5cbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLm1ldGFkYXRhOiBDdXN0b20gZGF0YSBmb3IgeW91ciBDb252ZXJzYXRpb247IGNvbW1vbmx5IHVzZWQgdG8gc3RvcmUgYSAndGl0bGUnIHByb3BlcnR5XG4gKiAgICB0byBuYW1lIHlvdXIgQ29udmVyc2F0aW9uLlxuICpcbiAqIE1ldGhvZHM6XG4gKlxuICogKiBsYXllci5Db252ZXJzYXRpb24uYWRkUGFydGljaXBhbnRzIGFuZCBsYXllci5Db252ZXJzYXRpb24ucmVtb3ZlUGFydGljaXBhbnRzOiBDaGFuZ2UgdGhlIHBhcnRpY2lwYW50cyBvZiB0aGUgQ29udmVyc2F0aW9uXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXM6IFNldCBtZXRhZGF0YS50aXRsZSB0byAnTXkgQ29udmVyc2F0aW9uIHdpdGggTGF5ZXIgU3VwcG9ydCcgKHVoIG9oKVxuICogKiBsYXllci5Db252ZXJzYXRpb24ub24oKSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLm9mZigpOiBldmVudCBsaXN0ZW5lcnMgYnVpbHQgb24gdG9wIG9mIHRoZSBgYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmVgIG5wbSBwcm9qZWN0XG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5sZWF2ZSgpIHRvIGxlYXZlIHRoZSBDb252ZXJzYXRpb25cbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmRlbGV0ZSgpIHRvIGRlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZvciBhbGwgdXNlcnMgKG9yIGZvciBqdXN0IHRoaXMgdXNlcilcbiAqXG4gKiBFdmVudHM6XG4gKlxuICogKiBgY29udmVyc2F0aW9uczpjaGFuZ2VgOiBVc2VmdWwgZm9yIG9ic2VydmluZyBjaGFuZ2VzIHRvIHBhcnRpY2lwYW50cyBhbmQgbWV0YWRhdGFcbiAqICAgYW5kIHVwZGF0aW5nIHJlbmRlcmluZyBvZiB5b3VyIG9wZW4gQ29udmVyc2F0aW9uXG4gKlxuICogRmluYWxseSwgdG8gYWNjZXNzIGEgbGlzdCBvZiBNZXNzYWdlcyBpbiBhIENvbnZlcnNhdGlvbiwgc2VlIGxheWVyLlF1ZXJ5LlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ29udmVyc2F0aW9uXG4gKiBAZXh0ZW5kcyBsYXllci5Db250YWluZXJcbiAqIEBhdXRob3IgIE1pY2hhZWwgS2FudG9yXG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgQ29udGFpbmVyID0gcmVxdWlyZSgnLi9jb250YWluZXInKTtcbmNvbnN0IENvbnZlcnNhdGlvbk1lc3NhZ2UgPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbi1tZXNzYWdlJyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBMYXllckV2ZW50ID0gcmVxdWlyZSgnLi4vbGF5ZXItZXZlbnQnKTtcblxuY2xhc3MgQ29udmVyc2F0aW9uIGV4dGVuZHMgQ29udGFpbmVyIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqIFRoZSBzdGF0aWMgYGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoKWAgbWV0aG9kXG4gICAqIHdpbGwgY29ycmVjdGx5IGxvb2t1cCBkaXN0aW5jdCBDb252ZXJzYXRpb25zIGFuZFxuICAgKiByZXR1cm4gdGhlbTsgYG5ldyBsYXllci5Db252ZXJzYXRpb24oKWAgd2lsbCBub3QuXG4gICAqXG4gICAqIERldmVsb3BlcnMgc2hvdWxkIHVzZSBgbGF5ZXIuQ29udmVyc2F0aW9uLmNyZWF0ZSgpYC5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMucGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIGxheWVyLklkZW50aXR5IGluc3RhbmNlc1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRpc3RpbmN0PXRydWVdIC0gSXMgdGhlIGNvbnZlcnNhdGlvbiBkaXN0aW5jdFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGFdIC0gQW4gb2JqZWN0IGNvbnRhaW5pbmcgQ29udmVyc2F0aW9uIE1ldGFkYXRhLlxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyBTZXR1cCBkZWZhdWx0IHZhbHVlc1xuICAgIGlmICghb3B0aW9ucy5wYXJ0aWNpcGFudHMpIG9wdGlvbnMucGFydGljaXBhbnRzID0gW107XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zIGRvZXNuJ3QgY29udGFpbiBzZXJ2ZXIgb2JqZWN0LCBzZXR1cCBwYXJ0aWNpcGFudHMuXG4gICAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMucGFydGljaXBhbnRzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHRoaXMucGFydGljaXBhbnRzKTtcbiAgICAgIGlmICh0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKGNsaWVudC51c2VyKSA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5wYXJ0aWNpcGFudHMucHVzaChjbGllbnQudXNlcik7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3JlZ2lzdGVyKCk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgdGhlIGxvY2FsIGNvcHkgb2YgdGhpcyBDb252ZXJzYXRpb24sIGNsZWFuaW5nIHVwIGFsbCByZXNvdXJjZXNcbiAgICogaXQgY29uc3VtZXMuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmxhc3RNZXNzYWdlID0gbnVsbDtcblxuICAgIC8vIENsaWVudCBmaXJlcyAnY29udmVyc2F0aW9uczpyZW1vdmUnIGFuZCB0aGVuIHJlbW92ZXMgdGhlIENvbnZlcnNhdGlvbi5cbiAgICBpZiAodGhpcy5jbGllbnRJZCkgdGhpcy5nZXRDbGllbnQoKS5fcmVtb3ZlQ29udmVyc2F0aW9uKHRoaXMpO1xuXG4gICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBudWxsO1xuICAgIHRoaXMubWV0YWRhdGEgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UgaW5zdGFuY2Ugd2l0aGluIHRoaXMgY29udmVyc2F0aW9uXG4gICAqXG4gICAqICAgICAgdmFyIG1lc3NhZ2UgPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSgnaGVsbG8nKTtcbiAgICpcbiAgICogICAgICB2YXIgbWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAgICogICAgICAgICAgcGFydHM6IFtuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe1xuICAgKiAgICAgICAgICAgICAgICAgICAgICBib2R5OiAnaGVsbG8nLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gICAqICAgICAgICAgICAgICAgICAgfSldXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIFNlZSBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UgZm9yIG1vcmUgb3B0aW9ucyBmb3IgY3JlYXRpbmcgdGhlIG1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlTWVzc2FnZVxuICAgKiBAcGFyYW0gIHtTdHJpbmd8T2JqZWN0fSBvcHRpb25zIC0gSWYgaXRzIGEgc3RyaW5nLCBhIE1lc3NhZ2VQYXJ0IGlzIGNyZWF0ZWQgYXJvdW5kIHRoYXQgc3RyaW5nLlxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VQYXJ0W119IG9wdGlvbnMucGFydHMgLSBBbiBhcnJheSBvZiBNZXNzYWdlUGFydHMuICBUaGVyZSBpcyBzb21lIHRvbGVyYW5jZSBmb3JcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0IG5vdCBiZWluZyBhbiBhcnJheSwgb3IgZm9yIGl0IGJlaW5nIGEgc3RyaW5nIHRvIGJlIHR1cm5lZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50byBhIE1lc3NhZ2VQYXJ0LlxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2V9XG4gICAqL1xuICBjcmVhdGVNZXNzYWdlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IG1lc3NhZ2VDb25maWcgPSAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSA/IHtcbiAgICAgIHBhcnRzOiBbeyBib2R5OiBvcHRpb25zLCBtaW1lVHlwZTogJ3RleHQvcGxhaW4nIH1dLFxuICAgIH0gOiBvcHRpb25zO1xuICAgIG1lc3NhZ2VDb25maWcuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgIG1lc3NhZ2VDb25maWcuY29udmVyc2F0aW9uSWQgPSB0aGlzLmlkO1xuXG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb25NZXNzYWdlKG1lc3NhZ2VDb25maWcpO1xuICB9XG5cblxuICBfc2V0dXBNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICAvLyBTZXR0aW5nIGEgcG9zaXRpb24gaXMgcmVxdWlyZWQgaWYgaXRzIGdvaW5nIHRvIGdldCBzb3J0ZWQgY29ycmVjdGx5IGJ5IHF1ZXJ5LlxuICAgIC8vIFRoZSBjb3JyZWN0IHBvc2l0aW9uIHdpbGwgYmUgd3JpdHRlbiBieSBfcG9wdWxhdGVGcm9tU2VydmVyIHdoZW4gdGhlIG9iamVjdFxuICAgIC8vIGlzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlci5cbiAgICAvLyBOT1RFOiBXZSBoYXZlIGEgc3BlY2lhbCBjYXNlIHdoZXJlIG1lc3NhZ2VzIGFyZSBzZW50IGZyb20gbXVsdGlwbGUgdGFicywgd3JpdHRlbiB0byBpbmRleGVkREIsIGJ1dCBub3QgeWV0IHNlbnQsXG4gICAgLy8gdGhleSB3aWxsIGhhdmUgY29uZmxpY3RpbmcgcG9zaXRpb25zLlxuICAgIC8vIEF0dGVtcHRzIHRvIGZpeCB0aGlzIGJ5IG9mZnNldHRpbmcgdGhlIHBvc2l0aW9uIGJ5IHRpbWUgcmVzdWx0ZWQgaW4gdW5leHBlY3RlZCBiZWhhdmlvcnNcbiAgICAvLyBhcyBtdWx0aXBsZSBtZXNzYWdlcyBlbmQgdXAgd2l0aCBwb3NpdGlvbnMgZ3JlYXRlciB0aGFuIHJldHVybmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gICAgbGV0IHBvc2l0aW9uO1xuICAgIGlmICh0aGlzLmxhc3RNZXNzYWdlKSB7XG4gICAgICBwb3NpdGlvbiA9IHRoaXMubGFzdE1lc3NhZ2UucG9zaXRpb24gKyAxO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fbGFzdE1lc3NhZ2VQb3NpdGlvbikge1xuICAgICAgcG9zaXRpb24gPSB0aGlzLl9sYXN0TWVzc2FnZVBvc2l0aW9uICsgMTtcbiAgICAgIHRoaXMuX2xhc3RNZXNzYWdlUG9zaXRpb24gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3NpdGlvbiA9IDA7XG4gICAgfVxuICAgIG1lc3NhZ2UucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB0aGlzLmxhc3RNZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgdGhpcyBDb252ZXJzYXRpb24gb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogT24gY29tcGxldGlvbiwgdGhpcyBpbnN0YW5jZSB3aWxsIHJlY2VpdmVcbiAgICogYW4gaWQsIHVybCBhbmQgY3JlYXRlZEF0LiAgSXQgbWF5IGFsc28gcmVjZWl2ZSBtZXRhZGF0YVxuICAgKiBpZiB0aGVyZSB3YXMgYSBGT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSByZXN1bHQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgb3B0aW9uYWwgTWVzc2FnZSBwYXJhbWV0ZXIgc2hvdWxkIE5PVCBiZSB1c2VkIGV4Y2VwdFxuICAgKiBieSB0aGUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlIGNsYXNzIGl0c2VsZi5cbiAgICpcbiAgICogTm90ZSB0aGF0IHJlY29tbWVuZGVkIHByYWN0aWNlIGlzIHRvIHNlbmQgdGhlIENvbnZlcnNhdGlvbiBieSBzZW5kaW5nIGEgTWVzc2FnZSBpbiB0aGUgQ29udmVyc2F0aW9uLFxuICAgKiBhbmQgTk9UIGJ5IGNhbGxpbmcgQ29udmVyc2F0aW9uLnNlbmQuXG4gICAqXG4gICAqICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgZGlzdGluY3Q6IGZhbHNlXG4gICAqICAgICAgfSlcbiAgICogICAgICAuc2VuZCgpXG4gICAqICAgICAgLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgYWxlcnQoJ0RvbmUnKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlfSBbbWVzc2FnZV0gVGVsbHMgdGhlIENvbnZlcnNhdGlvbiB3aGF0IGl0cyBsYXN0X21lc3NhZ2Ugd2lsbCBiZVxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIHNlbmQobWVzc2FnZSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFjbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIHBhcnQgb2YgYSBjcmVhdGUoe2Rpc3RpbmN0OnRydWV9KS5zZW5kKCkgY2FsbCB3aGVyZVxuICAgIC8vIHRoZSBkaXN0aW5jdCBjb252ZXJzYXRpb24gd2FzIGZvdW5kLCBqdXN0IHRyaWdnZXIgdGhlIGNhY2hlZCBldmVudCBhbmQgZXhpdFxuICAgIGNvbnN0IHdhc0xvY2FsRGlzdGluY3QgPSBCb29sZWFuKHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50KTtcbiAgICBpZiAodGhpcy5fc2VuZERpc3RpbmN0RXZlbnQpIHRoaXMuX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb24oKTtcblxuICAgIC8vIElmIHRoZSBDb252ZXJzYXRpb24gaXMgYWxyZWFkeSBvbiB0aGUgc2VydmVyLCBkb24ndCBzZW5kLlxuICAgIGlmICh3YXNMb2NhbERpc3RpbmN0IHx8IHRoaXMuc3luY1N0YXRlICE9PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpIHtcbiAgICAgIGlmIChtZXNzYWdlKSB0aGlzLl9zZXR1cE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhpcyB1c2VyIGlzIGEgcGFydGljaXBhbnQgKHNlcnZlciBkb2VzIHRoaXMgZm9yIHVzLCBidXRcbiAgICAvLyB0aGlzIGluc3VyZXMgdGhlIGxvY2FsIGNvcHkgaXMgY29ycmVjdCB1bnRpbCB3ZSBnZXQgYSByZXNwb25zZSBmcm9tXG4gICAgLy8gdGhlIHNlcnZlclxuICAgIGlmICh0aGlzLnBhcnRpY2lwYW50cy5pbmRleE9mKGNsaWVudC51c2VyKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMucGFydGljaXBhbnRzLnB1c2goY2xpZW50LnVzZXIpO1xuICAgIH1cblxuICAgIHJldHVybiBzdXBlci5zZW5kKG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgdGhlIGNhc2Ugd2hlcmUgYSBEaXN0aW5jdCBDcmVhdGUgQ29udmVyc2F0aW9uIGZvdW5kIGEgbG9jYWwgbWF0Y2guXG4gICAqXG4gICAqIFdoZW4gYW4gYXBwIGNhbGxzIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oWy4uLl0pXG4gICAqIGFuZCByZXF1ZXN0cyBhIERpc3RpbmN0IENvbnZlcnNhdGlvbiAoZGVmYXVsdCBzZXR0aW5nKSxcbiAgICogYW5kIHRoZSBDb252ZXJzYXRpb24gYWxyZWFkeSBleGlzdHMsIHdoYXQgZG8gd2UgZG8gdG8gaGVscFxuICAgKiB0aGVtIGFjY2VzcyBpdD9cbiAgICpcbiAgICogICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKFtcImZyZWRcIl0pLm9uKFwiY29udmVyc2F0aW9uczpzZW50XCIsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgcmVuZGVyKCk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIFVuZGVyIG5vcm1hbCBjb25kaXRpb25zLCBjYWxsaW5nIGBjLnNlbmQoKWAgb24gYSBtYXRjaGluZyBkaXN0aW5jdCBDb252ZXJzYXRpb25cbiAgICogd291bGQgZWl0aGVyIHRocm93IGFuIGVycm9yIG9yIGp1c3QgYmUgYSBuby1vcC4gIFdlIHVzZSB0aGlzIG1ldGhvZCB0byB0cmlnZ2VyXG4gICAqIHRoZSBleHBlY3RlZCBcImNvbnZlcnNhdGlvbnM6c2VudFwiIGV2ZW50IGV2ZW4gdGhvdWdoIGl0cyBhbHJlYWR5IGJlZW4gc2VudCBhbmRcbiAgICogd2UgZGlkIG5vdGhpbmcuICBVc2UgdGhlIGV2dC5yZXN1bHQgcHJvcGVydHkgaWYgeW91IHdhbnQgdG8ga25vdyB3aGV0aGVyIHRoZVxuICAgKiByZXN1bHQgd2FzIGEgbmV3IGNvbnZlcnNhdGlvbiBvciBtYXRjaGluZyBvbmUuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb25cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYW5kbGVMb2NhbERpc3RpbmN0Q29udmVyc2F0aW9uKCkge1xuICAgIGNvbnN0IGV2dCA9IHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50O1xuICAgIHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50ID0gbnVsbDtcblxuICAgIC8vIGRlbGF5IHNvIHRoZXJlIGlzIHRpbWUgdG8gc2V0dXAgYW4gZXZlbnQgbGlzdGVuZXIgb24gdGhpcyBjb252ZXJzYXRpb25cbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6c2VudCcsIGV2dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBkYXRhIGZvciBhIENyZWF0ZSByZXF1ZXN0LlxuICAgKlxuICAgKiBUaGUgbGF5ZXIuU3luY01hbmFnZXIgbmVlZHMgYSBjYWxsYmFjayB0byBjcmVhdGUgdGhlIENvbnZlcnNhdGlvbiBhcyBpdFxuICAgKiBsb29rcyBOT1csIG5vdCBiYWNrIHdoZW4gYHNlbmQoKWAgd2FzIGNhbGxlZC4gIFRoaXMgbWV0aG9kIGlzIGNhbGxlZFxuICAgKiBieSB0aGUgbGF5ZXIuU3luY01hbmFnZXIgdG8gcG9wdWxhdGUgdGhlIFBPU1QgZGF0YSBvZiB0aGUgY2FsbC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0U2VuZERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7T2JqZWN0fSBXZWJzb2NrZXQgZGF0YSBmb3IgdGhlIHJlcXVlc3RcbiAgICovXG4gIF9nZXRTZW5kRGF0YShkYXRhKSB7XG4gICAgY29uc3QgaXNNZXRhZGF0YUVtcHR5ID0gVXRpbC5pc0VtcHR5KHRoaXMubWV0YWRhdGEpO1xuICAgIHJldHVybiB7XG4gICAgICBtZXRob2Q6ICdDb252ZXJzYXRpb24uY3JlYXRlJyxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgcGFydGljaXBhbnRzOiB0aGlzLnBhcnRpY2lwYW50cy5tYXAoaWRlbnRpdHkgPT4gaWRlbnRpdHkuaWQpLFxuICAgICAgICBkaXN0aW5jdDogdGhpcy5kaXN0aW5jdCxcbiAgICAgICAgbWV0YWRhdGE6IGlzTWV0YWRhdGFFbXB0eSA/IG51bGwgOiB0aGlzLm1ldGFkYXRhLFxuICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIoY29udmVyc2F0aW9uKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIERpc2FibGUgZXZlbnRzIGlmIGNyZWF0aW5nIGEgbmV3IENvbnZlcnNhdGlvblxuICAgIC8vIFdlIHN0aWxsIHdhbnQgcHJvcGVydHkgY2hhbmdlIGV2ZW50cyBmb3IgYW55dGhpbmcgdGhhdCBET0VTIGNoYW5nZVxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVyk7XG5cbiAgICB0aGlzLnBhcnRpY2lwYW50cyA9IGNsaWVudC5fZml4SWRlbnRpdGllcyhjb252ZXJzYXRpb24ucGFydGljaXBhbnRzKTtcbiAgICB0aGlzLnBhcnRpY2lwYW50cy5mb3JFYWNoKGlkZW50aXR5ID0+IGlkZW50aXR5Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIHRoaXMuX2hhbmRsZVBhcnRpY2lwYW50Q2hhbmdlRXZlbnQsIHRoaXMpKTtcbiAgICB0aGlzLmRpc3RpbmN0ID0gY29udmVyc2F0aW9uLmRpc3RpbmN0O1xuICAgIHRoaXMudW5yZWFkQ291bnQgPSBjb252ZXJzYXRpb24udW5yZWFkX21lc3NhZ2VfY291bnQ7XG4gICAgdGhpcy5pc0N1cnJlbnRQYXJ0aWNpcGFudCA9IHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoY2xpZW50LnVzZXIpICE9PSAtMTtcbiAgICBzdXBlci5fcG9wdWxhdGVGcm9tU2VydmVyKGNvbnZlcnNhdGlvbik7XG5cbiAgICBpZiAodHlwZW9mIGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gY2xpZW50LmdldE1lc3NhZ2UoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb24ubGFzdF9tZXNzYWdlKSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gY2xpZW50Ll9jcmVhdGVPYmplY3QoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSk7XG4gICAgfVxuICAgIHRoaXMuX3JlZ2lzdGVyKCk7XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gIH1cblxuICBfY3JlYXRlUmVzdWx0Q29uZmxpY3QoZGF0YSkge1xuICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihkYXRhLmRhdGEpO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYyh0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpzZW50Jywge1xuICAgICAgcmVzdWx0OiBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFuIGFycmF5IG9mIHBhcnRpY2lwYW50IGlkcyB0byB0aGUgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5hZGRQYXJ0aWNpcGFudHMoWydhJywgJ2InXSk7XG4gICAqXG4gICAqIE5ldyBwYXJ0aWNpcGFudHMgd2lsbCBpbW1lZGlhdGVseSBzaG93IHVwIGluIHRoZSBDb252ZXJzYXRpb24sXG4gICAqIGJ1dCBtYXkgbm90IGhhdmUgc3luY2VkIHdpdGggdGhlIHNlcnZlciB5ZXQuXG4gICAqXG4gICAqIFRPRE8gV0VCLTk2NzogUm9sbCBwYXJ0aWNpcGFudHMgYmFjayBvbiBnZXR0aW5nIGEgc2VydmVyIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgYWRkUGFydGljaXBhbnRzXG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IHBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBJZGVudGl0eSBvYmplY3RzXG4gICAqIEByZXR1cm5zIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIGFkZFBhcnRpY2lwYW50cyhwYXJ0aWNpcGFudHMpIHtcbiAgICAvLyBPbmx5IGFkZCB0aG9zZSB0aGF0IGFyZW4ndCBhbHJlYWR5IGluIHRoZSBsaXN0LlxuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY29uc3QgaWRlbnRpdGllcyA9IGNsaWVudC5fZml4SWRlbnRpdGllcyhwYXJ0aWNpcGFudHMpO1xuICAgIGNvbnN0IGFkZGluZyA9IGlkZW50aXRpZXMuZmlsdGVyKGlkZW50aXR5ID0+IHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoaWRlbnRpdHkpID09PSAtMSk7XG4gICAgdGhpcy5fcGF0Y2hQYXJ0aWNpcGFudHMoeyBhZGQ6IGFkZGluZywgcmVtb3ZlOiBbXSB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFuIGFycmF5IG9mIHBhcnRpY2lwYW50IGlkcyBmcm9tIHRoZSBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnJlbW92ZVBhcnRpY2lwYW50cyhbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogUmVtb3ZlZCBwYXJ0aWNpcGFudHMgd2lsbCBpbW1lZGlhdGVseSBiZSByZW1vdmVkIGZyb20gdGhpcyBDb252ZXJzYXRpb24sXG4gICAqIGJ1dCBtYXkgbm90IGhhdmUgc3luY2VkIHdpdGggdGhlIHNlcnZlciB5ZXQuXG4gICAqXG4gICAqIFRocm93cyBlcnJvciBpZiB5b3UgYXR0ZW1wdCB0byByZW1vdmUgQUxMIHBhcnRpY2lwYW50cy5cbiAgICpcbiAgICogVE9ETyAgV0VCLTk2NzogUm9sbCBwYXJ0aWNpcGFudHMgYmFjayBvbiBnZXR0aW5nIGEgc2VydmVyIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgcmVtb3ZlUGFydGljaXBhbnRzXG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IHBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBJZGVudGl0eSBvYmplY3RzXG4gICAqIEByZXR1cm5zIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIHJlbW92ZVBhcnRpY2lwYW50cyhwYXJ0aWNpcGFudHMpIHtcbiAgICBjb25zdCBjdXJyZW50UGFydGljaXBhbnRzID0ge307XG4gICAgdGhpcy5wYXJ0aWNpcGFudHMuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiAoY3VycmVudFBhcnRpY2lwYW50c1twYXJ0aWNpcGFudC5pZF0gPSB0cnVlKSk7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjb25zdCBpZGVudGl0aWVzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHBhcnRpY2lwYW50cyk7XG5cbiAgICBjb25zdCByZW1vdmluZyA9IGlkZW50aXRpZXMuZmlsdGVyKHBhcnRpY2lwYW50ID0+IGN1cnJlbnRQYXJ0aWNpcGFudHNbcGFydGljaXBhbnQuaWRdKTtcbiAgICBpZiAocmVtb3ZpbmcubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcztcbiAgICBpZiAocmVtb3ZpbmcubGVuZ3RoID09PSB0aGlzLnBhcnRpY2lwYW50cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkubW9yZVBhcnRpY2lwYW50c1JlcXVpcmVkKTtcbiAgICB9XG4gICAgdGhpcy5fcGF0Y2hQYXJ0aWNpcGFudHMoeyBhZGQ6IFtdLCByZW1vdmU6IHJlbW92aW5nIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBwYXJ0aWNpcGFudHMgd2l0aCBhIG5ldyBhcnJheSBvZiBvZiBwYXJ0aWNpcGFudCBpZHMuXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnJlcGxhY2VQYXJ0aWNpcGFudHMoWydhJywgJ2InXSk7XG4gICAqXG4gICAqIENoYW5nZWQgcGFydGljaXBhbnRzIHdpbGwgaW1tZWRpYXRlbHkgc2hvdyB1cCBpbiB0aGUgQ29udmVyc2F0aW9uLFxuICAgKiBidXQgbWF5IG5vdCBoYXZlIHN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgeWV0LlxuICAgKlxuICAgKiBUT0RPIFdFQi05Njc6IFJvbGwgcGFydGljaXBhbnRzIGJhY2sgb24gZ2V0dGluZyBhIHNlcnZlciBlcnJvclxuICAgKlxuICAgKiBAbWV0aG9kIHJlcGxhY2VQYXJ0aWNpcGFudHNcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIElkZW50aXR5IG9iamVjdHNcbiAgICogQHJldHVybnMge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgcmVwbGFjZVBhcnRpY2lwYW50cyhwYXJ0aWNpcGFudHMpIHtcbiAgICBpZiAoIXBhcnRpY2lwYW50cyB8fCAhcGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5tb3JlUGFydGljaXBhbnRzUmVxdWlyZWQpO1xuICAgIH1cblxuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY29uc3QgaWRlbnRpdGllcyA9IGNsaWVudC5fZml4SWRlbnRpdGllcyhwYXJ0aWNpcGFudHMpO1xuXG4gICAgY29uc3QgY2hhbmdlID0gdGhpcy5fZ2V0UGFydGljaXBhbnRDaGFuZ2UoaWRlbnRpdGllcywgdGhpcy5wYXJ0aWNpcGFudHMpO1xuICAgIHRoaXMuX3BhdGNoUGFydGljaXBhbnRzKGNoYW5nZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBzZXJ2ZXIgd2l0aCB0aGUgbmV3IHBhcnRpY2lwYW50IGxpc3QuXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIDEuIFVwZGF0ZXMgdGhlIHBhcnRpY2lwYW50cyBwcm9wZXJ0eSBvZiB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDIuIFRyaWdnZXJzIGEgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnRcbiAgICogMy4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIHVwZGF0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDQuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IGFub3RoZXJcbiAgICogICAgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnQgaXMgZmlyZWQgYXMgdGhlIGNoYW5nZSBpcyByb2xsZWQgYmFjay5cbiAgICpcbiAgICogQG1ldGhvZCBfcGF0Y2hQYXJ0aWNpcGFudHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0W119IG9wZXJhdGlvbnMgLSBBcnJheSBvZiBKU09OIHBhdGNoIG9wZXJhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGV2ZW50RGF0YSAtIERhdGEgZGVzY3JpYmluZyB0aGUgY2hhbmdlIGZvciB1c2UgaW4gYW4gZXZlbnRcbiAgICovXG4gIF9wYXRjaFBhcnRpY2lwYW50cyhjaGFuZ2UpIHtcbiAgICB0aGlzLl9hcHBseVBhcnRpY2lwYW50Q2hhbmdlKGNoYW5nZSk7XG4gICAgdGhpcy5pc0N1cnJlbnRQYXJ0aWNpcGFudCA9IHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YodGhpcy5nZXRDbGllbnQoKS51c2VyKSAhPT0gLTE7XG5cbiAgICBjb25zdCBvcHMgPSBbXTtcbiAgICBjaGFuZ2UucmVtb3ZlLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICBvcHMucHVzaCh7XG4gICAgICAgIG9wZXJhdGlvbjogJ3JlbW92ZScsXG4gICAgICAgIHByb3BlcnR5OiAncGFydGljaXBhbnRzJyxcbiAgICAgICAgaWQ6IHBhcnRpY2lwYW50LmlkLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjaGFuZ2UuYWRkLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICBvcHMucHVzaCh7XG4gICAgICAgIG9wZXJhdGlvbjogJ2FkZCcsXG4gICAgICAgIHByb3BlcnR5OiAncGFydGljaXBhbnRzJyxcbiAgICAgICAgaWQ6IHBhcnRpY2lwYW50LmlkLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KG9wcyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmxheWVyLXBhdGNoK2pzb24nLFxuICAgICAgfSxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5kYXRhLmlkICE9PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWxseSB3ZSB1c2UgYHthZGQ6IFtdLCByZW1vdmU6IFtdfWAgaW5zdGVhZCBvZiBMYXllck9wZXJhdGlvbnMuXG4gICAqXG4gICAqIFNvIGNvbnRyb2wgaXMgaGFuZGVkIG9mZiB0byB0aGlzIG1ldGhvZCB0byBhY3R1YWxseSBhcHBseSB0aGUgY2hhbmdlc1xuICAgKiB0byB0aGUgcGFydGljaXBhbnRzIGFycmF5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9hcHBseVBhcnRpY2lwYW50Q2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gY2hhbmdlXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5W119IGNoYW5nZS5hZGQgLSBBcnJheSBvZiB1c2VyaWRzIHRvIGFkZFxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBjaGFuZ2UucmVtb3ZlIC0gQXJyYXkgb2YgdXNlcmlkcyB0byByZW1vdmVcbiAgICovXG4gIF9hcHBseVBhcnRpY2lwYW50Q2hhbmdlKGNoYW5nZSkge1xuICAgIGNvbnN0IHBhcnRpY2lwYW50cyA9IFtdLmNvbmNhdCh0aGlzLnBhcnRpY2lwYW50cyk7XG4gICAgY2hhbmdlLmFkZC5mb3JFYWNoKChwYXJ0aWNpcGFudCkgPT4ge1xuICAgICAgaWYgKHBhcnRpY2lwYW50cy5pbmRleE9mKHBhcnRpY2lwYW50KSA9PT0gLTEpIHBhcnRpY2lwYW50cy5wdXNoKHBhcnRpY2lwYW50KTtcbiAgICB9KTtcbiAgICBjaGFuZ2UucmVtb3ZlLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHBhcnRpY2lwYW50cy5pbmRleE9mKHBhcnRpY2lwYW50KTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHBhcnRpY2lwYW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0pO1xuICAgIHRoaXMucGFydGljaXBhbnRzID0gcGFydGljaXBhbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciBhbmQgcmVtb3ZlcyB0aGlzIHVzZXIgYXMgYSBwYXJ0aWNpcGFudC5cbiAgICpcbiAgICogQG1ldGhvZCBsZWF2ZVxuICAgKi9cbiAgbGVhdmUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgIHRoaXMuX2RlbGV0ZShgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVN9JmxlYXZlPXRydWVgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIENvbnZlcnNhdGlvbiBmcm9tIHRoZSBzZXJ2ZXIsIGJ1dCBkZWxldGlvbiBtb2RlIG1heSBjYXVzZSB1c2VyIHRvIHJlbWFpbiBhIHBhcnRpY2lwYW50LlxuICAgKlxuICAgKiBUaGlzIGNhbGwgd2lsbCBzdXBwb3J0IHZhcmlvdXMgZGVsZXRpb24gbW9kZXMuXG4gICAqXG4gICAqIERlbGV0aW9uIE1vZGVzOlxuICAgKlxuICAgKiAqIGxheWVyLkNvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTDogVGhpcyBkZWxldGVzIHRoZSBsb2NhbCBjb3B5IGltbWVkaWF0ZWx5LCBhbmQgYXR0ZW1wdHMgdG8gYWxzb1xuICAgKiAgIGRlbGV0ZSB0aGUgc2VydmVyJ3MgY29weS5cbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOiBEZWxldGVzIHRoZSBsb2NhbCBjb3B5IGltbWVkaWF0ZWx5LCBhbmQgYXR0ZW1wdHMgdG8gZGVsZXRlIGl0IGZyb20gYWxsXG4gICAqICAgb2YgbXkgZGV2aWNlcy4gIE90aGVyIHVzZXJzIHJldGFpbiBhY2Nlc3MuXG4gICAqICogdHJ1ZTogRm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHRoaSBpcyB0aGUgc2FtZSBhcyBBTEwuXG4gICAqXG4gICAqIE1ZX0RFVklDRVMgZG9lcyBub3QgcmVtb3ZlIHRoaXMgdXNlciBhcyBhIHBhcnRpY2lwYW50LiAgVGhhdCBtZWFucyBhIG5ldyBNZXNzYWdlIG9uIHRoaXMgQ29udmVyc2F0aW9uIHdpbGwgcmVjcmVhdGUgdGhlXG4gICAqIENvbnZlcnNhdGlvbiBmb3IgdGhpcyB1c2VyLiAgU2VlIGxheWVyLkNvbnZlcnNhdGlvbi5sZWF2ZSgpIGluc3RlYWQuXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIDEuIFN1Ym1pdHMgYSByZXF1ZXN0IHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlciB0byBkZWxldGUgdGhlIHNlcnZlcidzIG9iamVjdFxuICAgKiAyLiBEZWxldGUncyB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDMuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IHRoZSBDb252ZXJzYXRpb24gd2lsbCBiZSByZWxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIsXG4gICAqICAgIHRyaWdnZXJpbmcgYSBjb252ZXJzYXRpb25zOmFkZCBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGRlbGV0aW9uTW9kZVxuICAgKi9cbiAgZGVsZXRlKG1vZGUpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pc0Rlc3Ryb3llZCk7XG5cbiAgICBsZXQgcXVlcnlTdHI7XG4gICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICBjYXNlIENvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTDpcbiAgICAgIGNhc2UgdHJ1ZTpcbiAgICAgICAgcXVlcnlTdHIgPSBgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTH1gO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzpcbiAgICAgICAgcXVlcnlTdHIgPSBgbW9kZT0ke0NvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVN9JmxlYXZlPWZhbHNlYDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9kZWxldGUocXVlcnlTdHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIExheWVyUGF0Y2ggd2lsbCBjYWxsIHRoaXMgYWZ0ZXIgY2hhbmdpbmcgYW55IHByb3BlcnRpZXMuXG4gICAqXG4gICAqIFRyaWdnZXIgYW55IGNsZWFudXAgb3IgZXZlbnRzIG5lZWRlZCBhZnRlciB0aGVzZSBjaGFuZ2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVQYXRjaEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge01peGVkfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICogQHBhcmFtICB7TWl4ZWR9IG9sZFZhbHVlIC0gUHJpb3IgdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdfSBwYXRocyAtIEFycmF5IG9mIHBhdGhzIHNwZWNpZmljYWxseSBtb2RpZmllZDogWydwYXJ0aWNpcGFudHMnXSwgWydtZXRhZGF0YS5rZXlBJywgJ21ldGFkYXRhLmtleUInXVxuICAgKi9cbiAgX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykge1xuICAgIC8vIENlcnRhaW4gdHlwZXMgb2YgX191cGRhdGUgaGFuZGxlcnMgYXJlIGRpc2FibGVkIHdoaWxlIHZhbHVlcyBhcmUgYmVpbmcgc2V0IGJ5XG4gICAgLy8gbGF5ZXIgcGF0Y2ggcGFyc2VyIGJlY2F1c2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBzZXR0aW5nIGEgdmFsdWUgKHRyaWdnZXJzIGFuIGV2ZW50KVxuICAgIC8vIGFuZCBjaGFuZ2UgYSBwcm9wZXJ0eSBvZiBhIHZhbHVlICh0cmlnZ2VycyBvbmx5IHRoaXMgY2FsbGJhY2spIHJlc3VsdCBpbiBpbmNvbnNpc3RlbnRcbiAgICAvLyBiZWhhdmlvcnMuICBFbmFibGUgdGhlbSBsb25nIGVub3VnaCB0byBhbGxvdyBfX3VwZGF0ZSBjYWxscyB0byBiZSBtYWRlXG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBldmVudHMgPSB0aGlzLl9kaXNhYmxlRXZlbnRzO1xuICAgICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuICAgICAgaWYgKHBhdGhzWzBdID09PSAncGFydGljaXBhbnRzJykge1xuICAgICAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgICAgICAvLyBvbGRWYWx1ZS9uZXdWYWx1ZSBjb21lIGFzIGEgQmFzaWMgSWRlbnRpdHkgUE9KTzsgbGV0cyBkZWxpdmVyIGV2ZW50cyB3aXRoIGFjdHVhbCBpbnN0YW5jZXNcbiAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZS5tYXAoaWRlbnRpdHkgPT4gY2xpZW50LmdldElkZW50aXR5KGlkZW50aXR5LmlkKSk7XG4gICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUubWFwKGlkZW50aXR5ID0+IGNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpO1xuICAgICAgICB0aGlzLl9fdXBkYXRlUGFydGljaXBhbnRzKG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdXBlci5faGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBldmVudHM7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBkbyBub3RoaW5nXG4gICAgfVxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBvbGRWYWx1ZSBhbmQgbmV3VmFsdWUgZm9yIHBhcnRpY2lwYW50cyxcbiAgICogZ2VuZXJhdGUgYSBsaXN0IG9mIHdob20gd2FzIGFkZGVkIGFuZCB3aG9tIHdhcyByZW1vdmVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRQYXJ0aWNpcGFudENoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eVtdfSBvbGRWYWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFJldHVybnMgY2hhbmdlcyBpbiB0aGUgZm9ybSBvZiBge2FkZDogWy4uLl0sIHJlbW92ZTogWy4uLl19YFxuICAgKi9cbiAgX2dldFBhcnRpY2lwYW50Q2hhbmdlKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIGNvbnN0IGNoYW5nZSA9IHt9O1xuICAgIGNoYW5nZS5hZGQgPSBuZXdWYWx1ZS5maWx0ZXIocGFydGljaXBhbnQgPT4gb2xkVmFsdWUuaW5kZXhPZihwYXJ0aWNpcGFudCkgPT09IC0xKTtcbiAgICBjaGFuZ2UucmVtb3ZlID0gb2xkVmFsdWUuZmlsdGVyKHBhcnRpY2lwYW50ID0+IG5ld1ZhbHVlLmluZGV4T2YocGFydGljaXBhbnQpID09PSAtMSk7XG4gICAgcmV0dXJuIGNoYW5nZTtcbiAgfVxuXG5cbiAgX2RlbGV0ZVJlc3VsdChyZXN1bHQsIGlkKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICghcmVzdWx0LmRhdGEgfHwgKHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJyAmJiByZXN1bHQuZGF0YS5pZCAhPT0gJ2F1dGhlbnRpY2F0aW9uX3JlcXVpcmVkJykpKSB7XG4gICAgICBDb252ZXJzYXRpb24ubG9hZChpZCwgY2xpZW50KTtcbiAgICB9XG4gIH1cblxuXG4gIF9yZWdpc3RlcigpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIGNsaWVudC5fYWRkQ29udmVyc2F0aW9uKHRoaXMpO1xuICB9XG5cblxuICAvKlxuICAgKiBJbnN1cmUgdGhhdCBjb252ZXJzYXRpb24udW5yZWFkQ291bnQtLSBjYW4gbmV2ZXIgcmVkdWNlIHRoZSB2YWx1ZSB0byBuZWdhdGl2ZSB2YWx1ZXMuXG4gICAqL1xuICBfX2FkanVzdFVucmVhZENvdW50KG5ld1ZhbHVlKSB7XG4gICAgaWYgKG5ld1ZhbHVlIDwgMCkgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGNoYW5nZSBpbiB0aGUgdW5yZWFkQ291bnQgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LlxuICAgKlxuICAgKiBBbnkgdHJpZ2dlcmluZyBvZiB0aGlzIGZyb20gYSB3ZWJzb2NrZXQgcGF0Y2ggdW5yZWFkX21lc3NhZ2VfY291bnQgc2hvdWxkIHdhaXQgYSBzZWNvbmQgYmVmb3JlIGZpcmluZyBhbnkgZXZlbnRzXG4gICAqIHNvIHRoYXQgaWYgdGhlcmUgYXJlIGEgc2VyaWVzIG9mIHRoZXNlIHVwZGF0ZXMsIHdlIGRvbid0IHNlZSBhIGxvdCBvZiBqaXR0ZXIuXG4gICAqXG4gICAqIE5PVEU6IF9vbGRVbnJlYWRDb3VudCBpcyB1c2VkIHRvIHBhc3MgZGF0YSB0byBfdXBkYXRlVW5yZWFkQ291bnRFdmVudCBiZWNhdXNlIHRoaXMgbWV0aG9kIGNhbiBiZSBjYWxsZWQgbWFueSB0aW1lc1xuICAgKiBhIHNlY29uZCwgYW5kIHdlIG9ubHkgd2FudCB0byB0cmlnZ2VyIHRoaXMgd2l0aCBhIHN1bW1hcnkgb2YgY2hhbmdlcyByYXRoZXIgdGhhbiBlYWNoIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlVW5yZWFkQ291bnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bnVtYmVyfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZVVucmVhZENvdW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIGlmICh0aGlzLl9pbkxheWVyUGFyc2VyKSB7XG4gICAgICBpZiAodGhpcy5fb2xkVW5yZWFkQ291bnQgPT09IHVuZGVmaW5lZCkgdGhpcy5fb2xkVW5yZWFkQ291bnQgPSBvbGRWYWx1ZTtcbiAgICAgIGlmICh0aGlzLl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQpIGNsZWFyVGltZW91dCh0aGlzLl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQpO1xuICAgICAgdGhpcy5fdXBkYXRlVW5yZWFkQ291bnRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl91cGRhdGVVbnJlYWRDb3VudEV2ZW50KCksIDEwMDApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91cGRhdGVVbnJlYWRDb3VudEV2ZW50KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpcmUgZXZlbnRzIHJlbGF0ZWQgdG8gY2hhbmdlcyB0byB1bnJlYWRDb3VudFxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVVbnJlYWRDb3VudEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdXBkYXRlVW5yZWFkQ291bnRFdmVudCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fb2xkVW5yZWFkQ291bnQ7XG4gICAgY29uc3QgbmV3VmFsdWUgPSB0aGlzLl9fdW5yZWFkQ291bnQ7XG4gICAgdGhpcy5fb2xkVW5yZWFkQ291bnQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAobmV3VmFsdWUgPT09IG9sZFZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgIG5ld1ZhbHVlLFxuICAgICAgb2xkVmFsdWUsXG4gICAgICBwcm9wZXJ0eTogJ3VucmVhZENvdW50JyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBsYXN0TWVzc2FnZSBwb2ludGVyIHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC4gIENoYW5nZXMgdG8gcHJvcGVydGllcyB3aXRoaW4gdGhlIGxhc3RNZXNzYWdlIG9iamVjdCB3aWxsXG4gICAqIG5vdCB0cmlnZ2VyIHRoaXMgY2FsbC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZUxhc3RNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVMYXN0TWVzc2FnZShuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAobmV3VmFsdWUgJiYgb2xkVmFsdWUgJiYgbmV3VmFsdWUuaWQgPT09IG9sZFZhbHVlLmlkKSByZXR1cm47XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbGFzdE1lc3NhZ2UnLFxuICAgICAgbmV3VmFsdWUsXG4gICAgICBvbGRWYWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBwYXJ0aWNpcGFudHMgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LiAgQ2hhbmdlcyB0byB0aGUgcGFydGljaXBhbnRzIGFycmF5IHRoYXQgZG9uJ3QgcmVwbGFjZSB0aGUgYXJyYXlcbiAgICogd2l0aCBhIG5ldyBhcnJheSB3aWxsIHJlcXVpcmUgZGlyZWN0bHkgY2FsbGluZyB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZVBhcnRpY2lwYW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmdbXX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7c3RyaW5nW119IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZVBhcnRpY2lwYW50cyhuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICBpZiAodGhpcy5faW5MYXllclBhcnNlcikgcmV0dXJuO1xuICAgIGNvbnN0IGNoYW5nZSA9IHRoaXMuX2dldFBhcnRpY2lwYW50Q2hhbmdlKG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgY2hhbmdlLmFkZC5mb3JFYWNoKGlkZW50aXR5ID0+IGlkZW50aXR5Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIHRoaXMuX2hhbmRsZVBhcnRpY2lwYW50Q2hhbmdlRXZlbnQsIHRoaXMpKTtcbiAgICBjaGFuZ2UucmVtb3ZlLmZvckVhY2goaWRlbnRpdHkgPT4gaWRlbnRpdHkub2ZmKCdpZGVudGl0aWVzOmNoYW5nZScsIHRoaXMuX2hhbmRsZVBhcnRpY2lwYW50Q2hhbmdlRXZlbnQsIHRoaXMpKTtcbiAgICBpZiAoY2hhbmdlLmFkZC5sZW5ndGggfHwgY2hhbmdlLnJlbW92ZS5sZW5ndGgpIHtcbiAgICAgIGNoYW5nZS5wcm9wZXJ0eSA9ICdwYXJ0aWNpcGFudHMnO1xuICAgICAgY2hhbmdlLm9sZFZhbHVlID0gb2xkVmFsdWU7XG4gICAgICBjaGFuZ2UubmV3VmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpjaGFuZ2UnLCBjaGFuZ2UpO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVQYXJ0aWNpcGFudENoYW5nZUV2ZW50KGV2dCkge1xuICAgIGV2dC5jaGFuZ2VzLmZvckVhY2goKGNoYW5nZSkgPT4ge1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgICAgcHJvcGVydHk6ICdwYXJ0aWNpcGFudHMuJyArIGNoYW5nZS5wcm9wZXJ0eSxcbiAgICAgICAgaWRlbnRpdHk6IGV2dC50YXJnZXQsXG4gICAgICAgIG9sZFZhbHVlOiBjaGFuZ2Uub2xkVmFsdWUsXG4gICAgICAgIG5ld1ZhbHVlOiBjaGFuZ2UubmV3VmFsdWUsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb252ZXJzYXRpb24gaW5zdGFuY2UgZnJvbSBhIHNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzLCB3aWxsIHVwZGF0ZSB0aGUgZXhpc3RpbmcgY29weSB3aXRoXG4gICAqIHByZXN1bWFibHkgbmV3ZXIgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnZlcnNhdGlvbiAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoY29udmVyc2F0aW9uLCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbih7XG4gICAgICBjbGllbnQsXG4gICAgICBmcm9tU2VydmVyOiBjb252ZXJzYXRpb24sXG4gICAgICBfZnJvbURCOiBjb252ZXJzYXRpb24uX2Zyb21EQixcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIG9yIGNyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqICAgICAgdmFyIGNvbnZlcnNhdGlvbiA9IGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoe1xuICAgKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAqICAgICAgICAgIGRpc3RpbmN0OiB0cnVlLFxuICAgKiAgICAgICAgICBtZXRhZGF0YToge1xuICAgKiAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIG5vdCBhIHRpdGxlISdcbiAgICogICAgICAgICAgfSxcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgICdjb252ZXJzYXRpb25zOmxvYWRlZCc6IGZ1bmN0aW9uKGV2dCkge1xuICAgKlxuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE9ubHkgdHJpZXMgdG8gZmluZCBhIENvbnZlcnNhdGlvbiBpZiBpdHMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqIERpc3RpbmN0IGRlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIFJlY29tbWVuZCB1c2luZyBgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7Li4ufSlgXG4gICAqIGluc3RlYWQgb2YgYENvbnZlcnNhdGlvbi5jcmVhdGUoey4uLn0pYC5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMucGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIGxheWVyLklkZW50aXR5IG9iamVjdHMgdG8gY3JlYXRlIGEgY29udmVyc2F0aW9uIHdpdGguXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGlzdGluY3Q9dHJ1ZV0gLSBDcmVhdGUgYSBkaXN0aW5jdCBjb252ZXJzYXRpb25cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhPXt9XSAtIEluaXRpYWwgbWV0YWRhdGEgZm9yIENvbnZlcnNhdGlvblxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSB7XG4gICAgICBkaXN0aW5jdDogb3B0aW9ucy5kaXN0aW5jdCxcbiAgICAgIHBhcnRpY2lwYW50czogb3B0aW9ucy5jbGllbnQuX2ZpeElkZW50aXRpZXMob3B0aW9ucy5wYXJ0aWNpcGFudHMpLFxuICAgICAgbWV0YWRhdGE6IG9wdGlvbnMubWV0YWRhdGEsXG4gICAgICBjbGllbnQ6IG9wdGlvbnMuY2xpZW50LFxuICAgIH07XG4gICAgaWYgKG5ld09wdGlvbnMuZGlzdGluY3QpIHtcbiAgICAgIGNvbnN0IGNvbnYgPSB0aGlzLl9jcmVhdGVEaXN0aW5jdChuZXdPcHRpb25zKTtcbiAgICAgIGlmIChjb252KSByZXR1cm4gY29udjtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb24obmV3T3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIG9yIEZpbmQgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIElmIHRoZSBzdGF0aWMgQ29udmVyc2F0aW9uLmNyZWF0ZSBtZXRob2QgZ2V0cyBhIHJlcXVlc3QgZm9yIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uLFxuICAgKiBzZWUgaWYgd2UgaGF2ZSBvbmUgY2FjaGVkLlxuICAgKlxuICAgKiBXaWxsIGZpcmUgdGhlICdjb252ZXJzYXRpb25zOmxvYWRlZCcgZXZlbnQgaWYgb25lIGlzIHByb3ZpZGVkIGluIHRoaXMgY2FsbCxcbiAgICogYW5kIGEgQ29udmVyc2F0aW9uIGlzIGZvdW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVEaXN0aW5jdFxuICAgKiBAc3RhdGljXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIFNlZSBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlIG9wdGlvbnM7IHBhcnRpY2lwYW50cyBtdXN0IGJlIGxheWVyLklkZW50aXR5W11cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVEaXN0aW5jdChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMucGFydGljaXBhbnRzLmluZGV4T2Yob3B0aW9ucy5jbGllbnQudXNlcikgPT09IC0xKSB7XG4gICAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5wdXNoKG9wdGlvbnMuY2xpZW50LnVzZXIpO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnRpY2lwYW50c0hhc2ggPSB7fTtcbiAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5mb3JFYWNoKChwYXJ0aWNpcGFudCkgPT4ge1xuICAgICAgcGFydGljaXBhbnRzSGFzaFtwYXJ0aWNpcGFudC5pZF0gPSBwYXJ0aWNpcGFudDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnYgPSBvcHRpb25zLmNsaWVudC5maW5kQ2FjaGVkQ29udmVyc2F0aW9uKChhQ29udikgPT4ge1xuICAgICAgaWYgKGFDb252LmRpc3RpbmN0ICYmIGFDb252LnBhcnRpY2lwYW50cy5sZW5ndGggPT09IG9wdGlvbnMucGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgYUNvbnYucGFydGljaXBhbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgIGlmICghcGFydGljaXBhbnRzSGFzaFthQ29udi5wYXJ0aWNpcGFudHNbaW5kZXhdLmlkXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGNvbnYpIHtcbiAgICAgIGNvbnYuX3NlbmREaXN0aW5jdEV2ZW50ID0gbmV3IExheWVyRXZlbnQoe1xuICAgICAgICB0YXJnZXQ6IGNvbnYsXG4gICAgICAgIHJlc3VsdDogIW9wdGlvbnMubWV0YWRhdGEgfHwgVXRpbC5kb2VzT2JqZWN0TWF0Y2gob3B0aW9ucy5tZXRhZGF0YSwgY29udi5tZXRhZGF0YSkgP1xuICAgICAgICAgIENvbnZlcnNhdGlvbi5GT1VORCA6IENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSxcbiAgICAgIH0sICdjb252ZXJzYXRpb25zOnNlbnQnKTtcbiAgICAgIHJldHVybiBjb252O1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFycmF5IG9mIHBhcnRpY2lwYW50IGlkcy5cbiAqXG4gKiBEbyBub3QgZGlyZWN0bHkgbWFuaXB1bGF0ZTtcbiAqIHVzZSBhZGRQYXJ0aWNpcGFudHMsIHJlbW92ZVBhcnRpY2lwYW50cyBhbmQgcmVwbGFjZVBhcnRpY2lwYW50c1xuICogdG8gbWFuaXB1bGF0ZSB0aGUgYXJyYXkuXG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5W119XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUucGFydGljaXBhbnRzID0gbnVsbDtcblxuXG4vKipcbiAqIE51bWJlciBvZiB1bnJlYWQgbWVzc2FnZXMgaW4gdGhlIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLnVucmVhZENvdW50ID0gMDtcblxuLyoqXG4gKiBUaGlzIGlzIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uLlxuICpcbiAqIFlvdSBjYW4gaGF2ZSAxIGRpc3RpbmN0IGNvbnZlcnNhdGlvbiBhbW9uZyBhIHNldCBvZiBwYXJ0aWNpcGFudHMuXG4gKiBUaGVyZSBhcmUgbm8gbGltaXRzIHRvIGhvdyBtYW55IG5vbi1kaXN0aW5jdCBDb252ZXJzYXRpb25zIHlvdSBoYXZlIGhhdmVcbiAqIGFtb25nIGEgc2V0IG9mIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5kaXN0aW5jdCA9IHRydWU7XG5cbi8qKlxuICogVGhlIGxhc3QgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlIHRvIGJlIHNlbnQvcmVjZWl2ZWQgZm9yIHRoaXMgQ29udmVyc2F0aW9uLlxuICpcbiAqIFZhbHVlIG1heSBiZSBhIE1lc3NhZ2UgdGhhdCBoYXMgYmVlbiBsb2NhbGx5IGNyZWF0ZWQgYnV0IG5vdCB5ZXQgcmVjZWl2ZWQgYnkgc2VydmVyLlxuICogQHR5cGUge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5sYXN0TWVzc2FnZSA9IG51bGw7XG5cblxuLyoqXG4gKiBUaGUgcG9zaXRpb24gb2YgdGhlIGxhc3Qga25vd24gbWVzc2FnZS5cbiAqXG4gKiBVc2VkIGluIHRoZSBldmVudCB0aGF0IGxhc3RNZXNzYWdlIGhhcyBiZWVuIGRlbGV0ZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLl9sYXN0TWVzc2FnZVBvc2l0aW9uID0gMDtcblxuQ29udmVyc2F0aW9uLmV2ZW50UHJlZml4ID0gJ2NvbnZlcnNhdGlvbnMnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24gdGhhdCB3YXMgcmVxdWVzdGVkIGhhcyBiZWVuIGZvdW5kLCBidXQgdGhlcmUgd2FzIGEgbWlzbWF0Y2ggaW4gbWV0YWRhdGEuXG4gKlxuICogSWYgdGhlIGNyZWF0ZUNvbnZlcnNhdGlvbiByZXF1ZXN0IGNvbnRhaW5lZCBtZXRhZGF0YSBhbmQgaXQgZGlkIG5vdCBtYXRjaCB0aGUgRGlzdGluY3QgQ29udmVyc2F0aW9uXG4gKiB0aGF0IG1hdGNoZWQgdGhlIHJlcXVlc3RlZCBwYXJ0aWNpcGFudHMsIHRoZW4gdGhpcyB2YWx1ZSBpcyBwYXNzZWQgdG8gbm90aWZ5IHlvdXIgYXBwIHRoYXQgdGhlIENvbnZlcnNhdGlvblxuICogd2FzIHJldHVybmVkIGJ1dCBkb2VzIG5vdCBleGFjdGx5IG1hdGNoIHlvdXIgcmVxdWVzdC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSA9ICdGb3VuZE1pc21hdGNoJztcblxuXG4vKipcbiAqIFByZWZpeCB0byB1c2Ugd2hlbiBnZW5lcmF0aW5nIGFuIElEIGZvciBpbnN0YW5jZXMgb2YgdGhpcyBjbGFzc1xuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbkNvbnZlcnNhdGlvbi5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvJztcblxuQ29udmVyc2F0aW9uLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgY29udmVyc2F0aW9uIGlzIG5vdyBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYWZ0ZXIgc3VjY2Vzc2Z1bGx5IGNyZWF0aW5nIHRoZSBjb252ZXJzYXRpb25cbiAgICogb24gdGhlIHNlcnZlci4gIFRoZSBSZXN1bHQgcHJvcGVydHkgaXMgb25lIG9mOlxuICAgKlxuICAgKiAqIENvbnZlcnNhdGlvbi5DUkVBVEVEOiBBIG5ldyBDb252ZXJzYXRpb24gaGFzIGJlZW4gY3JlYXRlZFxuICAgKiAqIENvbnZlcnNhdGlvbi5GT1VORDogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICogKiBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBidXQgbm90ZSB0aGF0IHRoZSBtZXRhZGF0YSBpcyBOT1Qgd2hhdCB5b3UgcmVxdWVzdGVkLlxuICAgKlxuICAgKiBBbGwgb2YgdGhlc2UgcmVzdWx0cyB3aWxsIGFsc28gbWVhbiB0aGF0IHRoZSB1cGRhdGVkIHByb3BlcnR5IHZhbHVlcyBoYXZlIGJlZW5cbiAgICogY29waWVkIGludG8geW91ciBDb252ZXJzYXRpb24gb2JqZWN0LiAgVGhhdCBtZWFucyB5b3VyIG1ldGFkYXRhIHByb3BlcnR5IG1heSBub1xuICAgKiBsb25nZXIgYmUgaXRzIGluaXRpYWwgdmFsdWU7IGl0IG1heSBiZSB0aGUgdmFsdWUgZm91bmQgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LnJlc3VsdFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEFuIGF0dGVtcHQgdG8gc2VuZCB0aGlzIGNvbnZlcnNhdGlvbiB0byB0aGUgc2VydmVyIGhhcyBmYWlsZWQuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLFxuXG4gIC8qKlxuICAgKiBUaGUgY29udmVyc2F0aW9uIGlzIG5vdyBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLkNvbnZlcnNhdGlvbi5sb2FkKCkgbWV0aG9kLlxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpsb2FkZWQnLFxuXG4gIC8qKlxuICAgKiBBbiBhdHRlbXB0IHRvIGxvYWQgdGhpcyBjb252ZXJzYXRpb24gZnJvbSB0aGUgc2VydmVyIGhhcyBmYWlsZWQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmxvYWQoKSBtZXRob2QuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBlaXRoZXIgYSBzdWNjZXNzZnVsIGNhbGwgdG8gZGVsZXRlKCkgb24gdGhpcyBpbnN0YW5jZVxuICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlJyxcblxuICAvKipcbiAgICogVGhpcyBjb252ZXJzYXRpb24gaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGV2ZW50LmNoYW5nZXMgLSBBcnJheSBvZiBjaGFuZ2VzIHJlcG9ydGVkIGJ5IHRoaXMgZXZlbnRcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZlbnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgKiBAcGFyYW0ge01peGVkfSBldmVudC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBjaGFuZ2VkXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldmVudC50YXJnZXRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmNoYW5nZSddLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ29udmVyc2F0aW9uLCBbQ29udmVyc2F0aW9uLCAnQ29udmVyc2F0aW9uJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKENvbnZlcnNhdGlvbik7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvbjtcbiJdfQ==
