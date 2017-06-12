'use strict';

/**
 * Adds Conversation handling to the layer.Client.
 *
 * @class layer.mixins.ClientConversations
 */

var Conversation = require('../models/conversation');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [
  /**
   * One or more layer.Conversation objects have been added to the client.
   *
   * They may have been added via the websocket, or via the user creating
   * a new Conversation locally.
   *
   *      client.on('conversations:add', function(evt) {
   *          evt.conversations.forEach(function(conversation) {
   *              myView.addConversation(conversation);
   *          });
   *      });
   *
   * @event conversations_add
   * @param {layer.LayerEvent} evt
   * @param {layer.Conversation[]} evt.conversations - Array of conversations added
   */
  'conversations:add',

  /**
   * One or more layer.Conversation objects have been removed.
   *
   * A removed Conversation is not necessarily deleted, its just
   * no longer being held in local memory.
   *
   * Note that typically you will want the conversations:delete event
   * rather than conversations:remove.
   *
   *      client.on('conversations:remove', function(evt) {
   *          evt.conversations.forEach(function(conversation) {
   *              myView.removeConversation(conversation);
   *          });
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Conversation[]} evt.conversations - Array of conversations removed
   */
  'conversations:remove',

  /**
   * The conversation is now on the server.
   *
   * Called after creating the conversation
   * on the server.  The Result property is one of:
   *
   * * layer.Conversation.CREATED: A new Conversation has been created
   * * layer.Conversation.FOUND: A matching Distinct Conversation has been found
   * * layer.Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
   *                       but note that the metadata is NOT what you requested.
   *
   * All of these results will also mean that the updated property values have been
   * copied into your Conversation object.  That means your metadata property may no
   * longer be its initial value; it will be the value found on the server.
   *
   *      client.on('conversations:sent', function(evt) {
   *          switch(evt.result) {
   *              case Conversation.CREATED:
   *                  alert(evt.target.id + ' Created!');
   *                  break;
   *              case Conversation.FOUND:
   *                  alert(evt.target.id + ' Found!');
   *                  break;
   *              case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
   *                  alert(evt.target.id + ' Found, but does not have the requested metadata!');
   *                  break;
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} event
   * @param {string} event.result
   * @param {layer.Conversation} target
   */
  'conversations:sent',

  /**
   * A conversation failed to load or create on the server.
   *
   *      client.on('conversations:sent-error', function(evt) {
   *          alert(evt.data.message);
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.LayerError} evt.data
   * @param {layer.Conversation} target
   */
  'conversations:sent-error',

  /**
   * A conversation had a change in its properties.
   *
   * This change may have been delivered from a remote user
   * or as a result of a local operation.
   *
   *      client.on('conversations:change', function(evt) {
   *          var metadataChanges = evt.getChangesFor('metadata');
   *          var participantChanges = evt.getChangesFor('participants');
   *          if (metadataChanges.length) {
   *              myView.renderTitle(evt.target.metadata.title);
   *          }
   *          if (participantChanges.length) {
   *              myView.renderParticipants(evt.target.participants);
   *          }
   *      });
   *
   * NOTE: Typically such rendering is done using Events on layer.Query.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Conversation} evt.target
   * @param {Object[]} evt.changes
   * @param {Mixed} evt.changes.newValue
   * @param {Mixed} evt.changes.oldValue
   * @param {string} evt.changes.property - Name of the property that has changed
   */
  'conversations:change',

  /**
   * A call to layer.Conversation.load has completed successfully
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Conversation} evt.target
   */
  'conversations:loaded',

  /**
   * A Conversation has been deleted from the server.
   *
   * Caused by either a successful call to layer.Conversation.delete() on the Conversation
   * or by a remote user.
   *
   *      client.on('conversations:delete', function(evt) {
   *          myView.removeConversation(evt.target);
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Conversation} evt.target
   */
  'conversations:delete'],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.conversations = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.conversations).forEach(function (id) {
        var conversation = _this._models.conversations[id];
        if (conversation && !conversation.isDestroyed) {
          conversation.destroy();
        }
      });
      this._models.conversations = null;
    },
    reset: function reset() {
      this._models.conversations = {};
    }
  },
  methods: {
    /**
     * Retrieve a conversation by Identifier.
     *
     *      var c = client.getConversation('layer:///conversations/uuid');
     *
     * If there is not a conversation with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Conversation instance that has no data; the `conversations:loaded` / `conversations:loaded-error` events
     * will let you know when the conversation has finished/failed loading from the server.
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          // Render the Conversation with all of its details loaded
     *          myrerender(c);
     *      });
     *      // Render a placeholder for c until the details of c have loaded
     *      myrender(c);
     *
     * Note in the above example that the `conversations:loaded` event will trigger even if the Conversation has previously loaded.
     *
     * @method getConversation
     * @param  {string} id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a conversation from
     *                                    the server if not found
     * @return {layer.Conversation}
     */
    getConversation: function getConversation(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (!Conversation.isValidId(id)) {
        id = Conversation.prefixUUID + id;
      }
      if (this._models.conversations[id]) {
        return this._models.conversations[id];
      } else if (canLoad) {
        return Conversation.load(id, this);
      }
      return null;
    },


    /**
     * Adds a conversation to the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _addConversation for you:
     *
     *      var conv = new layer.Conversation({
     *          client: client,
     *          participants: ['a', 'b']
     *      });
     *
     *      // OR:
     *      var conv = client.createConversation(['a', 'b']);
     *
     * @method _addConversation
     * @protected
     * @param  {layer.Conversation} c
     */
    _addConversation: function _addConversation(conversation) {
      var id = conversation.id;
      if (!this._models.conversations[id]) {
        // Register the Conversation
        this._models.conversations[id] = conversation;

        // Make sure the client is set so that the next event bubbles up
        if (conversation.clientId !== this.appId) conversation.clientId = this.appId;
        this._triggerAsync('conversations:add', { conversations: [conversation] });

        this._scheduleCheckAndPurgeCache(conversation);
      }
    },


    /**
     * Removes a conversation from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeConversation for you:
     *
     *      conversation.destroy();
     *
     * @method _removeConversation
     * @protected
     * @param  {layer.Conversation} c
     */
    _removeConversation: function _removeConversation(conversation) {
      var _this2 = this;

      // Insure we do not get any events, such as message:remove
      conversation.off(null, null, this);

      if (this._models.conversations[conversation.id]) {
        delete this._models.conversations[conversation.id];
        this._triggerAsync('conversations:remove', { conversations: [conversation] });
      }

      // Remove any Message associated with this Conversation
      Object.keys(this._models.messages).forEach(function (id) {
        if (_this2._models.messages[id].conversationId === conversation.id) {
          _this2._models.messages[id].destroy();
        }
      });
    },


    /**
     * If the Conversation ID changes, we need to reregister the Conversation
     *
     * @method _updateConversationId
     * @protected
     * @param  {layer.Conversation} conversation - Conversation whose ID has changed
     * @param  {string} oldId - Previous ID
     */
    _updateConversationId: function _updateConversationId(conversation, oldId) {
      var _this3 = this;

      if (this._models.conversations[oldId]) {
        this._models.conversations[conversation.id] = conversation;
        delete this._models.conversations[oldId];

        // This is a nasty way to work... but need to find and update all
        // conversationId properties of all Messages or the Query's won't
        // see these as matching the query.
        Object.keys(this._models.messages).filter(function (id) {
          return _this3._models.messages[id].conversationId === oldId;
        }).forEach(function (id) {
          return _this3._models.messages[id].conversationId = conversation.id;
        });
      }
    },


    /**
     * Searches locally cached conversations for a matching conversation.
     *
     * Iterates over conversations calling a matching function until
     * the conversation is found or all conversations tested.
     *
     *      var c = client.findCachedConversation(function(conversation) {
     *          if (conversation.participants.indexOf('a') != -1) return true;
     *      });
     *
     * @method findCachedConversation
     * @param  {Function} f - Function to call until we find a match
     * @param  {layer.Conversation} f.conversation - A conversation to test
     * @param  {boolean} f.return - Return true if the conversation is a match
     * @param  {Object} [context] - Optional context for the *this* object
     * @return {layer.Conversation}
     *
     * @deprecated
     * This should be replaced by iterating over your layer.Query data.
     */
    findCachedConversation: function findCachedConversation(func, context) {
      var test = context ? func.bind(context) : func;
      var list = Object.keys(this._models.conversations);
      var len = list.length;
      for (var index = 0; index < len; index++) {
        var key = list[index];
        var conversation = this._models.conversations[key];
        if (test(conversation, index)) return conversation;
      }
      return null;
    },


    /**
     * This method is recommended way to create a Conversation.
     *
     * There are a few ways to invoke it; note that the default behavior is to create a Distinct Conversation
     * unless otherwise stated via the layer.Conversation.distinct property.
     *
     *         client.createConversation({participants: ['a', 'b']});
     *         client.createConversation({participants: [userIdentityA, userIdentityB]});
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             distinct: false
     *         });
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             metadata: {
     *                 title: 'I am a title'
     *             }
     *         });
     *
     * If you try to create a Distinct Conversation that already exists,
     * you will get back an existing Conversation, and any requested metadata
     * will NOT be set; you will get whatever metadata the matching Conversation
     * already had.
     *
     * The default value for distinct is `true`.
     *
     * Whether the Conversation already exists or not, a 'conversations:sent' event
     * will be triggered asynchronously and the Conversation object will be ready
     * at that time.  Further, the event will provide details on the result:
     *
     *       var conversation = client.createConversation({
     *          participants: ['a', 'b'],
     *          metadata: {
     *            title: 'I am a title'
     *          }
     *       });
     *       conversation.on('conversations:sent', function(evt) {
     *           switch(evt.result) {
     *               case Conversation.CREATED:
     *                   alert(conversation.id + ' was created');
     *                   break;
     *               case Conversation.FOUND:
     *                   alert(conversation.id + ' was found');
     *                   break;
     *               case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
     *                   alert(conversation.id + ' was found but it already has a title so your requested title was not set');
     *                   break;
     *            }
     *       });
     *
     * Warning: This method will throw an error if called when you are not (or are no longer) an authenticated user.
     * That means if authentication has expired, and you have not yet reauthenticated the user, this will throw an error.
     *
     *
     * @method createConversation
     * @param  {Object} options
     * @param {string[]/layer.Identity[]} participants - Array of UserIDs or UserIdentities
     * @param {Boolean} [options.distinct=true] Is this a distinct Conversation?
     * @param {Object} [options.metadata={}] Metadata for your Conversation
     * @return {layer.Conversation}
     */
    createConversation: function createConversation(options) {
      // If we aren't authenticated, then we don't yet have a UserID, and won't create the correct Conversation
      if (!this.isAuthenticated) throw new Error(ErrorDictionary.clientMustBeReady);
      if (!('distinct' in options)) options.distinct = true;
      options.client = this;
      return Conversation.create(options);
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWNvbnZlcnNhdGlvbnMuanMiXSwibmFtZXMiOlsiQ29udmVyc2F0aW9uIiwicmVxdWlyZSIsIkVycm9yRGljdGlvbmFyeSIsImRpY3Rpb25hcnkiLCJtb2R1bGUiLCJleHBvcnRzIiwiZXZlbnRzIiwibGlmZWN5Y2xlIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX21vZGVscyIsImNvbnZlcnNhdGlvbnMiLCJjbGVhbnVwIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpZCIsImNvbnZlcnNhdGlvbiIsImlzRGVzdHJveWVkIiwiZGVzdHJveSIsInJlc2V0IiwibWV0aG9kcyIsImdldENvbnZlcnNhdGlvbiIsImNhbkxvYWQiLCJFcnJvciIsImlkUGFyYW1SZXF1aXJlZCIsImlzVmFsaWRJZCIsInByZWZpeFVVSUQiLCJsb2FkIiwiX2FkZENvbnZlcnNhdGlvbiIsImNsaWVudElkIiwiYXBwSWQiLCJfdHJpZ2dlckFzeW5jIiwiX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlIiwiX3JlbW92ZUNvbnZlcnNhdGlvbiIsIm9mZiIsIm1lc3NhZ2VzIiwiY29udmVyc2F0aW9uSWQiLCJfdXBkYXRlQ29udmVyc2F0aW9uSWQiLCJvbGRJZCIsImZpbHRlciIsImZpbmRDYWNoZWRDb252ZXJzYXRpb24iLCJmdW5jIiwiY29udGV4dCIsInRlc3QiLCJiaW5kIiwibGlzdCIsImxlbiIsImxlbmd0aCIsImluZGV4Iiwia2V5IiwiY3JlYXRlQ29udmVyc2F0aW9uIiwiaXNBdXRoZW50aWNhdGVkIiwiY2xpZW50TXVzdEJlUmVhZHkiLCJkaXN0aW5jdCIsImNsaWVudCIsImNyZWF0ZSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0FBTUEsSUFBTUEsZUFBZUMsUUFBUSx3QkFBUixDQUFyQjtBQUNBLElBQU1DLGtCQUFrQkQsUUFBUSxnQkFBUixFQUEwQkUsVUFBbEQ7O0FBRUFDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMs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dGlvbnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFkZHMgQ29udmVyc2F0aW9uIGhhbmRsaW5nIHRvIHRoZSBsYXllci5DbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLm1peGlucy5DbGllbnRDb252ZXJzYXRpb25zXG4gKi9cblxuY29uc3QgQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi4vbW9kZWxzL2NvbnZlcnNhdGlvbicpO1xuY29uc3QgRXJyb3JEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKS5kaWN0aW9uYXJ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXZlbnRzOiBbXG4gICAgLyoqXG4gICAgICogT25lIG9yIG1vcmUgbGF5ZXIuQ29udmVyc2F0aW9uIG9iamVjdHMgaGF2ZSBiZWVuIGFkZGVkIHRvIHRoZSBjbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGV5IG1heSBoYXZlIGJlZW4gYWRkZWQgdmlhIHRoZSB3ZWJzb2NrZXQsIG9yIHZpYSB0aGUgdXNlciBjcmVhdGluZ1xuICAgICAqIGEgbmV3IENvbnZlcnNhdGlvbiBsb2NhbGx5LlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgZXZ0LmNvbnZlcnNhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LmFkZENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pO1xuICAgICAqICAgICAgICAgIH0pO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnQgY29udmVyc2F0aW9uc19hZGRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGV2dC5jb252ZXJzYXRpb25zIC0gQXJyYXkgb2YgY29udmVyc2F0aW9ucyBhZGRlZFxuICAgICAqL1xuICAgICdjb252ZXJzYXRpb25zOmFkZCcsXG5cbiAgICAvKipcbiAgICAgKiBPbmUgb3IgbW9yZSBsYXllci5Db252ZXJzYXRpb24gb2JqZWN0cyBoYXZlIGJlZW4gcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEEgcmVtb3ZlZCBDb252ZXJzYXRpb24gaXMgbm90IG5lY2Vzc2FyaWx5IGRlbGV0ZWQsIGl0cyBqdXN0XG4gICAgICogbm8gbG9uZ2VyIGJlaW5nIGhlbGQgaW4gbG9jYWwgbWVtb3J5LlxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IHR5cGljYWxseSB5b3Ugd2lsbCB3YW50IHRoZSBjb252ZXJzYXRpb25zOmRlbGV0ZSBldmVudFxuICAgICAqIHJhdGhlciB0aGFuIGNvbnZlcnNhdGlvbnM6cmVtb3ZlLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgZXZ0LmNvbnZlcnNhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbW92ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pO1xuICAgICAqICAgICAgICAgIH0pO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGV2dC5jb252ZXJzYXRpb25zIC0gQXJyYXkgb2YgY29udmVyc2F0aW9ucyByZW1vdmVkXG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJyxcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IG9uIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiBDYWxsZWQgYWZ0ZXIgY3JlYXRpbmcgdGhlIGNvbnZlcnNhdGlvblxuICAgICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICAgKlxuICAgICAqICogbGF5ZXIuQ29udmVyc2F0aW9uLkNSRUFURUQ6IEEgbmV3IENvbnZlcnNhdGlvbiBoYXMgYmVlbiBjcmVhdGVkXG4gICAgICogKiBsYXllci5Db252ZXJzYXRpb24uRk9VTkQ6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAgICogKiBsYXllci5Db252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgIGJ1dCBub3RlIHRoYXQgdGhlIG1ldGFkYXRhIGlzIE5PVCB3aGF0IHlvdSByZXF1ZXN0ZWQuXG4gICAgICpcbiAgICAgKiBBbGwgb2YgdGhlc2UgcmVzdWx0cyB3aWxsIGFsc28gbWVhbiB0aGF0IHRoZSB1cGRhdGVkIHByb3BlcnR5IHZhbHVlcyBoYXZlIGJlZW5cbiAgICAgKiBjb3BpZWQgaW50byB5b3VyIENvbnZlcnNhdGlvbiBvYmplY3QuICBUaGF0IG1lYW5zIHlvdXIgbWV0YWRhdGEgcHJvcGVydHkgbWF5IG5vXG4gICAgICogbG9uZ2VyIGJlIGl0cyBpbml0aWFsIHZhbHVlOyBpdCB3aWxsIGJlIHRoZSB2YWx1ZSBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHN3aXRjaChldnQucmVzdWx0KSB7XG4gICAgICogICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkNSRUFURUQ6XG4gICAgICogICAgICAgICAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmlkICsgJyBDcmVhdGVkIScpO1xuICAgICAqICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EOlxuICAgICAqICAgICAgICAgICAgICAgICAgYWxlcnQoZXZ0LnRhcmdldC5pZCArICcgRm91bmQhJyk7XG4gICAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6XG4gICAgICogICAgICAgICAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmlkICsgJyBGb3VuZCwgYnV0IGRvZXMgbm90IGhhdmUgdGhlIHJlcXVlc3RlZCBtZXRhZGF0YSEnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5yZXN1bHRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGFyZ2V0XG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6c2VudCcsXG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnZlcnNhdGlvbiBmYWlsZWQgdG8gbG9hZCBvciBjcmVhdGUgb24gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBhbGVydChldnQuZGF0YS5tZXNzYWdlKTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2dC5kYXRhXG4gICAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IHRhcmdldFxuICAgICAqL1xuICAgICdjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLFxuXG4gICAgLyoqXG4gICAgICogQSBjb252ZXJzYXRpb24gaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgICAqXG4gICAgICogVGhpcyBjaGFuZ2UgbWF5IGhhdmUgYmVlbiBkZWxpdmVyZWQgZnJvbSBhIHJlbW90ZSB1c2VyXG4gICAgICogb3IgYXMgYSByZXN1bHQgb2YgYSBsb2NhbCBvcGVyYXRpb24uXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICB2YXIgbWV0YWRhdGFDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ21ldGFkYXRhJyk7XG4gICAgICogICAgICAgICAgdmFyIHBhcnRpY2lwYW50Q2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdwYXJ0aWNpcGFudHMnKTtcbiAgICAgKiAgICAgICAgICBpZiAobWV0YWRhdGFDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyVGl0bGUoZXZ0LnRhcmdldC5tZXRhZGF0YS50aXRsZSk7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgICAgIGlmIChwYXJ0aWNpcGFudENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJQYXJ0aWNpcGFudHMoZXZ0LnRhcmdldC5wYXJ0aWNpcGFudHMpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogTk9URTogVHlwaWNhbGx5IHN1Y2ggcmVuZGVyaW5nIGlzIGRvbmUgdXNpbmcgRXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gZXZ0LnRhcmdldFxuICAgICAqIEBwYXJhbSB7T2JqZWN0W119IGV2dC5jaGFuZ2VzXG4gICAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5vbGRWYWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgaGFzIGNoYW5nZWRcbiAgICAgKi9cbiAgICAnY29udmVyc2F0aW9uczpjaGFuZ2UnLFxuXG4gICAgLyoqXG4gICAgICogQSBjYWxsIHRvIGxheWVyLkNvbnZlcnNhdGlvbi5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyxcblxuICAgIC8qKlxuICAgICAqIEEgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogQ2F1c2VkIGJ5IGVpdGhlciBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlKCkgb24gdGhlIENvbnZlcnNhdGlvblxuICAgICAqIG9yIGJ5IGEgcmVtb3RlIHVzZXIuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpkZWxldGUnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBteVZpZXcucmVtb3ZlQ29udmVyc2F0aW9uKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlJyxcbiAgXSxcbiAgbGlmZWN5Y2xlOiB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgdGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnMgPSB7fTtcbiAgICB9LFxuICAgIGNsZWFudXAoKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9ucykuZm9yRWFjaCgoaWQpID0+IHtcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnNbaWRdO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uICYmICFjb252ZXJzYXRpb24uaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICBjb252ZXJzYXRpb24uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zID0gbnVsbDtcbiAgICB9LFxuXG4gICAgcmVzZXQoKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9ucyA9IHt9O1xuICAgIH0sXG4gIH0sXG4gIG1ldGhvZHM6IHtcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhIGNvbnZlcnNhdGlvbiBieSBJZGVudGlmaWVyLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCcpO1xuICAgICAqXG4gICAgICogSWYgdGhlcmUgaXMgbm90IGEgY29udmVyc2F0aW9uIHdpdGggdGhhdCBpZCwgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICAgKiBJZiBsb2FkaW5nIGZyb20gdGhlIHNlcnZlciwgdGhlIG1ldGhvZCB3aWxsIHJldHVyblxuICAgICAqIGEgbGF5ZXIuQ29udmVyc2F0aW9uIGluc3RhbmNlIHRoYXQgaGFzIG5vIGRhdGE7IHRoZSBgY29udmVyc2F0aW9uczpsb2FkZWRgIC8gYGNvbnZlcnNhdGlvbnM6bG9hZGVkLWVycm9yYCBldmVudHNcbiAgICAgKiB3aWxsIGxldCB5b3Uga25vdyB3aGVuIHRoZSBjb252ZXJzYXRpb24gaGFzIGZpbmlzaGVkL2ZhaWxlZCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgdmFyIGMgPSBjbGllbnQuZ2V0Q29udmVyc2F0aW9uKCdsYXllcjovLy9jb252ZXJzYXRpb25zLzEyMycsIHRydWUpXG4gICAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSBDb252ZXJzYXRpb24gd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAgICogICAgICAgICAgbXlyZXJlbmRlcihjKTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIGMgdW50aWwgdGhlIGRldGFpbHMgb2YgYyBoYXZlIGxvYWRlZFxuICAgICAqICAgICAgbXlyZW5kZXIoYyk7XG4gICAgICpcbiAgICAgKiBOb3RlIGluIHRoZSBhYm92ZSBleGFtcGxlIHRoYXQgdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAgZXZlbnQgd2lsbCB0cmlnZ2VyIGV2ZW4gaWYgdGhlIENvbnZlcnNhdGlvbiBoYXMgcHJldmlvdXNseSBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGdldENvbnZlcnNhdGlvblxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAgICAgKiBAcGFyYW0gIHtib29sZWFufSBbY2FuTG9hZD1mYWxzZV0gLSBQYXNzIHRydWUgdG8gYWxsb3cgbG9hZGluZyBhIGNvbnZlcnNhdGlvbiBmcm9tXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgc2VydmVyIGlmIG5vdCBmb3VuZFxuICAgICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICAgKi9cbiAgICBnZXRDb252ZXJzYXRpb24oaWQsIGNhbkxvYWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG4gICAgICBpZiAoIUNvbnZlcnNhdGlvbi5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICAgIGlkID0gQ29udmVyc2F0aW9uLnByZWZpeFVVSUQgKyBpZDtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uLmxvYWQoaWQsIHRoaXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjb252ZXJzYXRpb24gdG8gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfYWRkQ29udmVyc2F0aW9uIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjb252ID0gbmV3IGxheWVyLkNvbnZlcnNhdGlvbih7XG4gICAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddXG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqICAgICAgLy8gT1I6XG4gICAgICogICAgICB2YXIgY29udiA9IGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oWydhJywgJ2InXSk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9hZGRDb252ZXJzYXRpb25cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAgICovXG4gICAgX2FkZENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgIGNvbnN0IGlkID0gY29udmVyc2F0aW9uLmlkO1xuICAgICAgaWYgKCF0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0pIHtcbiAgICAgICAgLy8gUmVnaXN0ZXIgdGhlIENvbnZlcnNhdGlvblxuICAgICAgICB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0gPSBjb252ZXJzYXRpb247XG5cbiAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBjbGllbnQgaXMgc2V0IHNvIHRoYXQgdGhlIG5leHQgZXZlbnQgYnViYmxlcyB1cFxuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmNsaWVudElkICE9PSB0aGlzLmFwcElkKSBjb252ZXJzYXRpb24uY2xpZW50SWQgPSB0aGlzLmFwcElkO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6YWRkJywgeyBjb252ZXJzYXRpb25zOiBbY29udmVyc2F0aW9uXSB9KTtcblxuICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShjb252ZXJzYXRpb24pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY29udmVyc2F0aW9uIGZyb20gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfcmVtb3ZlQ29udmVyc2F0aW9uIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIGNvbnZlcnNhdGlvbi5kZXN0cm95KCk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9yZW1vdmVDb252ZXJzYXRpb25cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAgICovXG4gICAgX3JlbW92ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgIC8vIEluc3VyZSB3ZSBkbyBub3QgZ2V0IGFueSBldmVudHMsIHN1Y2ggYXMgbWVzc2FnZTpyZW1vdmVcbiAgICAgIGNvbnZlcnNhdGlvbi5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG5cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tjb252ZXJzYXRpb24uaWRdKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tjb252ZXJzYXRpb24uaWRdO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJywgeyBjb252ZXJzYXRpb25zOiBbY29udmVyc2F0aW9uXSB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtb3ZlIGFueSBNZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIENvbnZlcnNhdGlvblxuICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLm1lc3NhZ2VzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uLmlkKSB7XG4gICAgICAgICAgdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIElEIGNoYW5nZXMsIHdlIG5lZWQgdG8gcmVyZWdpc3RlciB0aGUgQ29udmVyc2F0aW9uXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF91cGRhdGVDb252ZXJzYXRpb25JZFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGNvbnZlcnNhdGlvbiAtIENvbnZlcnNhdGlvbiB3aG9zZSBJRCBoYXMgY2hhbmdlZFxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gb2xkSWQgLSBQcmV2aW91cyBJRFxuICAgICAqL1xuICAgIF91cGRhdGVDb252ZXJzYXRpb25JZChjb252ZXJzYXRpb24sIG9sZElkKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnNbb2xkSWRdKSB7XG4gICAgICAgIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zW2NvbnZlcnNhdGlvbi5pZF0gPSBjb252ZXJzYXRpb247XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tvbGRJZF07XG5cbiAgICAgICAgLy8gVGhpcyBpcyBhIG5hc3R5IHdheSB0byB3b3JrLi4uIGJ1dCBuZWVkIHRvIGZpbmQgYW5kIHVwZGF0ZSBhbGxcbiAgICAgICAgLy8gY29udmVyc2F0aW9uSWQgcHJvcGVydGllcyBvZiBhbGwgTWVzc2FnZXMgb3IgdGhlIFF1ZXJ5J3Mgd29uJ3RcbiAgICAgICAgLy8gc2VlIHRoZXNlIGFzIG1hdGNoaW5nIHRoZSBxdWVyeS5cbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLm1lc3NhZ2VzKVxuICAgICAgICAgICAgICAuZmlsdGVyKGlkID0+IHRoaXMuX21vZGVscy5tZXNzYWdlc1tpZF0uY29udmVyc2F0aW9uSWQgPT09IG9sZElkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChpZCA9PiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9IGNvbnZlcnNhdGlvbi5pZCkpO1xuICAgICAgfVxuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGxvY2FsbHkgY2FjaGVkIGNvbnZlcnNhdGlvbnMgZm9yIGEgbWF0Y2hpbmcgY29udmVyc2F0aW9uLlxuICAgICAqXG4gICAgICogSXRlcmF0ZXMgb3ZlciBjb252ZXJzYXRpb25zIGNhbGxpbmcgYSBtYXRjaGluZyBmdW5jdGlvbiB1bnRpbFxuICAgICAqIHRoZSBjb252ZXJzYXRpb24gaXMgZm91bmQgb3IgYWxsIGNvbnZlcnNhdGlvbnMgdGVzdGVkLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5maW5kQ2FjaGVkQ29udmVyc2F0aW9uKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgICAqICAgICAgICAgIGlmIChjb252ZXJzYXRpb24ucGFydGljaXBhbnRzLmluZGV4T2YoJ2EnKSAhPSAtMSkgcmV0dXJuIHRydWU7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZmluZENhY2hlZENvbnZlcnNhdGlvblxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmIC0gRnVuY3Rpb24gdG8gY2FsbCB1bnRpbCB3ZSBmaW5kIGEgbWF0Y2hcbiAgICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGYuY29udmVyc2F0aW9uIC0gQSBjb252ZXJzYXRpb24gdG8gdGVzdFxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IGYucmV0dXJuIC0gUmV0dXJuIHRydWUgaWYgdGhlIGNvbnZlcnNhdGlvbiBpcyBhIG1hdGNoXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgKnRoaXMqIG9iamVjdFxuICAgICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogVGhpcyBzaG91bGQgYmUgcmVwbGFjZWQgYnkgaXRlcmF0aW5nIG92ZXIgeW91ciBsYXllci5RdWVyeSBkYXRhLlxuICAgICAqL1xuICAgIGZpbmRDYWNoZWRDb252ZXJzYXRpb24oZnVuYywgY29udGV4dCkge1xuICAgICAgY29uc3QgdGVzdCA9IGNvbnRleHQgPyBmdW5jLmJpbmQoY29udGV4dCkgOiBmdW5jO1xuICAgICAgY29uc3QgbGlzdCA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zKTtcbiAgICAgIGNvbnN0IGxlbiA9IGxpc3QubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxlbjsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBrZXkgPSBsaXN0W2luZGV4XTtcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnNba2V5XTtcbiAgICAgICAgaWYgKHRlc3QoY29udmVyc2F0aW9uLCBpbmRleCkpIHJldHVybiBjb252ZXJzYXRpb247XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgcmVjb21tZW5kZWQgd2F5IHRvIGNyZWF0ZSBhIENvbnZlcnNhdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSBhIGZldyB3YXlzIHRvIGludm9rZSBpdDsgbm90ZSB0aGF0IHRoZSBkZWZhdWx0IGJlaGF2aW9yIGlzIHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvblxuICAgICAqIHVubGVzcyBvdGhlcndpc2Ugc3RhdGVkIHZpYSB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmRpc3RpbmN0IHByb3BlcnR5LlxuICAgICAqXG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtwYXJ0aWNpcGFudHM6IFsnYScsICdiJ119KTtcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe3BhcnRpY2lwYW50czogW3VzZXJJZGVudGl0eUEsIHVzZXJJZGVudGl0eUJdfSk7XG4gICAgICpcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe1xuICAgICAqICAgICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICAgKiAgICAgICAgICAgICBkaXN0aW5jdDogZmFsc2VcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqXG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICAgKiAgICAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAgICogICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgKiAgICAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIGEgdGl0bGUnXG4gICAgICogICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBJZiB5b3UgdHJ5IHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvbiB0aGF0IGFscmVhZHkgZXhpc3RzLFxuICAgICAqIHlvdSB3aWxsIGdldCBiYWNrIGFuIGV4aXN0aW5nIENvbnZlcnNhdGlvbiwgYW5kIGFueSByZXF1ZXN0ZWQgbWV0YWRhdGFcbiAgICAgKiB3aWxsIE5PVCBiZSBzZXQ7IHlvdSB3aWxsIGdldCB3aGF0ZXZlciBtZXRhZGF0YSB0aGUgbWF0Y2hpbmcgQ29udmVyc2F0aW9uXG4gICAgICogYWxyZWFkeSBoYWQuXG4gICAgICpcbiAgICAgKiBUaGUgZGVmYXVsdCB2YWx1ZSBmb3IgZGlzdGluY3QgaXMgYHRydWVgLlxuICAgICAqXG4gICAgICogV2hldGhlciB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzIG9yIG5vdCwgYSAnY29udmVyc2F0aW9uczpzZW50JyBldmVudFxuICAgICAqIHdpbGwgYmUgdHJpZ2dlcmVkIGFzeW5jaHJvbm91c2x5IGFuZCB0aGUgQ29udmVyc2F0aW9uIG9iamVjdCB3aWxsIGJlIHJlYWR5XG4gICAgICogYXQgdGhhdCB0aW1lLiAgRnVydGhlciwgdGhlIGV2ZW50IHdpbGwgcHJvdmlkZSBkZXRhaWxzIG9uIHRoZSByZXN1bHQ6XG4gICAgICpcbiAgICAgKiAgICAgICB2YXIgY29udmVyc2F0aW9uID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgICAqICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICogICAgICAgICAgICB0aXRsZTogJ0kgYW0gYSB0aXRsZSdcbiAgICAgKiAgICAgICAgICB9XG4gICAgICogICAgICAgfSk7XG4gICAgICogICAgICAgY29udmVyc2F0aW9uLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkNSRUFURUQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgY3JlYXRlZCcpO1xuICAgICAqICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgZm91bmQnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBOlxuICAgICAqICAgICAgICAgICAgICAgICAgIGFsZXJ0KGNvbnZlcnNhdGlvbi5pZCArICcgd2FzIGZvdW5kIGJ1dCBpdCBhbHJlYWR5IGhhcyBhIHRpdGxlIHNvIHlvdXIgcmVxdWVzdGVkIHRpdGxlIHdhcyBub3Qgc2V0Jyk7XG4gICAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgICB9XG4gICAgICogICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBXYXJuaW5nOiBUaGlzIG1ldGhvZCB3aWxsIHRocm93IGFuIGVycm9yIGlmIGNhbGxlZCB3aGVuIHlvdSBhcmUgbm90IChvciBhcmUgbm8gbG9uZ2VyKSBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgICogVGhhdCBtZWFucyBpZiBhdXRoZW50aWNhdGlvbiBoYXMgZXhwaXJlZCwgYW5kIHlvdSBoYXZlIG5vdCB5ZXQgcmVhdXRoZW50aWNhdGVkIHRoZSB1c2VyLCB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gICAgICpcbiAgICAgKlxuICAgICAqIEBtZXRob2QgY3JlYXRlQ29udmVyc2F0aW9uXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBVc2VySURzIG9yIFVzZXJJZGVudGl0aWVzXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSBJcyB0aGlzIGEgZGlzdGluY3QgQ29udmVyc2F0aW9uP1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5tZXRhZGF0YT17fV0gTWV0YWRhdGEgZm9yIHlvdXIgQ29udmVyc2F0aW9uXG4gICAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgICAqL1xuICAgIGNyZWF0ZUNvbnZlcnNhdGlvbihvcHRpb25zKSB7XG4gICAgICAvLyBJZiB3ZSBhcmVuJ3QgYXV0aGVudGljYXRlZCwgdGhlbiB3ZSBkb24ndCB5ZXQgaGF2ZSBhIFVzZXJJRCwgYW5kIHdvbid0IGNyZWF0ZSB0aGUgY29ycmVjdCBDb252ZXJzYXRpb25cbiAgICAgIGlmICghdGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuY2xpZW50TXVzdEJlUmVhZHkpO1xuICAgICAgaWYgKCEoJ2Rpc3RpbmN0JyBpbiBvcHRpb25zKSkgb3B0aW9ucy5kaXN0aW5jdCA9IHRydWU7XG4gICAgICBvcHRpb25zLmNsaWVudCA9IHRoaXM7XG4gICAgICByZXR1cm4gQ29udmVyc2F0aW9uLmNyZWF0ZShvcHRpb25zKTtcbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
