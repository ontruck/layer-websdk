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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWNvbnZlcnNhdGlvbnMuanMiXSwibmFtZXMiOlsiQ29udmVyc2F0aW9uIiwicmVxdWlyZSIsIkVycm9yRGljdGlvbmFyeSIsImRpY3Rpb25hcnkiLCJtb2R1bGUiLCJleHBvcnRzIiwiZXZlbnRzIiwibGlmZWN5Y2xlIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX21vZGVscyIsImNvbnZlcnNhdGlvbnMiLCJjbGVhbnVwIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpZCIsImNvbnZlcnNhdGlvbiIsImlzRGVzdHJveWVkIiwiZGVzdHJveSIsInJlc2V0IiwibWV0aG9kcyIsImdldENvbnZlcnNhdGlvbiIsImNhbkxvYWQiLCJFcnJvciIsImlkUGFyYW1SZXF1aXJlZCIsImxvYWQiLCJfYWRkQ29udmVyc2F0aW9uIiwiY2xpZW50SWQiLCJhcHBJZCIsIl90cmlnZ2VyQXN5bmMiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUiLCJfcmVtb3ZlQ29udmVyc2F0aW9uIiwib2ZmIiwibWVzc2FnZXMiLCJjb252ZXJzYXRpb25JZCIsIl91cGRhdGVDb252ZXJzYXRpb25JZCIsIm9sZElkIiwiZmlsdGVyIiwiZmluZENhY2hlZENvbnZlcnNhdGlvbiIsImZ1bmMiLCJjb250ZXh0IiwidGVzdCIsImJpbmQiLCJsaXN0IiwibGVuIiwibGVuZ3RoIiwiaW5kZXgiLCJrZXkiLCJjcmVhdGVDb252ZXJzYXRpb24iLCJpc0F1dGhlbnRpY2F0ZWQiLCJjbGllbnRNdXN0QmVSZWFkeSIsImRpc3RpbmN0IiwiY2xpZW50IiwiY3JlYXRlIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxlQUFlQyxRQUFRLHdCQUFSLENBQXJCO0FBQ0EsSUFBTUMsa0JBQWtCRCxRQUFRLGdCQUFSLEVBQTBCRSxVQUFsRDs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxVQUFRO0FBQ047Ozs7Ozs7Ozs7Ozs7Ozs7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LE9BQU9ELFVBQVVELEtBQUtHLElBQUwsQ0FBVUYsT0FBVixDQUFWLEdBQStCRCxJQUE1QztBQUNBLFVBQU1JLE9BQU8vQixPQUFPQyxJQUFQLENBQVksS0FBS0osT0FBTCxDQUFhQyxhQUF6QixDQUFiO0FBQ0EsVUFBTWtDLE1BQU1ELEtBQUtFLE1BQWpCO0FBQ0EsV0FBSyxJQUFJQyxRQUFRLENBQWpCLEVBQW9CQSxRQUFRRixHQUE1QixFQUFpQ0UsT0FBakMsRUFBMEM7QUFDeEMsWUFBTUMsTUFBTUosS0FBS0csS0FBTCxDQUFaO0FBQ0EsWUFBTTlCLGVBQWUsS0FBS1AsT0FBTCxDQUFhQyxhQUFiLENBQTJCcUMsR0FBM0IsQ0FBckI7QUFDQSxZQUFJTixLQUFLekIsWUFBTCxFQUFtQjhCLEtBQW5CLENBQUosRUFBK0IsT0FBTzlCLFlBQVA7QUFDaEM7QUFDRCxhQUFPLElBQVA7QUFDRCxLQXpKTTs7O0FBMkpQOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUErREFnQyxzQkExTk8sOEJBME5ZeEMsT0ExTlosRUEwTnFCO0FBQzFCO0FBQ0EsVUFBSSxDQUFDLEtBQUt5QyxlQUFWLEVBQTJCLE1BQU0sSUFBSTFCLEtBQUosQ0FBVXRCLGdCQUFnQmlELGlCQUExQixDQUFOO0FBQzNCLFVBQUksRUFBRSxjQUFjMUMsT0FBaEIsQ0FBSixFQUE4QkEsUUFBUTJDLFFBQVIsR0FBbUIsSUFBbkI7QUFDOUIzQyxjQUFRNEMsTUFBUixHQUFpQixJQUFqQjtBQUNBLGFBQU9yRCxhQUFhc0QsTUFBYixDQUFvQjdDLE9BQXBCLENBQVA7QUFDRDtBQWhPTTtBQW5LTSxDQUFqQiIsImZpbGUiOiJjbGllbnQtY29udmVyc2F0aW9ucy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWRkcyBDb252ZXJzYXRpb24gaGFuZGxpbmcgdG8gdGhlIGxheWVyLkNsaWVudC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIubWl4aW5zLkNsaWVudENvbnZlcnNhdGlvbnNcbiAqL1xuXG5jb25zdCBDb252ZXJzYXRpb24gPSByZXF1aXJlKCcuLi9tb2RlbHMvY29udmVyc2F0aW9uJyk7XG5jb25zdCBFcnJvckRpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpLmRpY3Rpb25hcnk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBldmVudHM6IFtcbiAgICAvKipcbiAgICAgKiBPbmUgb3IgbW9yZSBsYXllci5Db252ZXJzYXRpb24gb2JqZWN0cyBoYXZlIGJlZW4gYWRkZWQgdG8gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFRoZXkgbWF5IGhhdmUgYmVlbiBhZGRlZCB2aWEgdGhlIHdlYnNvY2tldCwgb3IgdmlhIHRoZSB1c2VyIGNyZWF0aW5nXG4gICAgICogYSBuZXcgQ29udmVyc2F0aW9uIGxvY2FsbHkuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBldnQuY29udmVyc2F0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcuYWRkQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbik7XG4gICAgICogICAgICAgICAgfSk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudCBjb252ZXJzYXRpb25zX2FkZFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gZXZ0LmNvbnZlcnNhdGlvbnMgLSBBcnJheSBvZiBjb252ZXJzYXRpb25zIGFkZGVkXG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6YWRkJyxcblxuICAgIC8qKlxuICAgICAqIE9uZSBvciBtb3JlIGxheWVyLkNvbnZlcnNhdGlvbiBvYmplY3RzIGhhdmUgYmVlbiByZW1vdmVkLlxuICAgICAqXG4gICAgICogQSByZW1vdmVkIENvbnZlcnNhdGlvbiBpcyBub3QgbmVjZXNzYXJpbHkgZGVsZXRlZCwgaXRzIGp1c3RcbiAgICAgKiBubyBsb25nZXIgYmVpbmcgaGVsZCBpbiBsb2NhbCBtZW1vcnkuXG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgdHlwaWNhbGx5IHlvdSB3aWxsIHdhbnQgdGhlIGNvbnZlcnNhdGlvbnM6ZGVsZXRlIGV2ZW50XG4gICAgICogcmF0aGVyIHRoYW4gY29udmVyc2F0aW9uczpyZW1vdmUuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpyZW1vdmUnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBldnQuY29udmVyc2F0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVtb3ZlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbik7XG4gICAgICogICAgICAgICAgfSk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gZXZ0LmNvbnZlcnNhdGlvbnMgLSBBcnJheSBvZiBjb252ZXJzYXRpb25zIHJlbW92ZWRcbiAgICAgKi9cbiAgICAnY29udmVyc2F0aW9uczpyZW1vdmUnLFxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqIENhbGxlZCBhZnRlciBjcmVhdGluZyB0aGUgY29udmVyc2F0aW9uXG4gICAgICogb24gdGhlIHNlcnZlci4gIFRoZSBSZXN1bHQgcHJvcGVydHkgaXMgb25lIG9mOlxuICAgICAqXG4gICAgICogKiBsYXllci5Db252ZXJzYXRpb24uQ1JFQVRFRDogQSBuZXcgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICAgKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5GT1VORDogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICAgKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQTogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgYnV0IG5vdGUgdGhhdCB0aGUgbWV0YWRhdGEgaXMgTk9UIHdoYXQgeW91IHJlcXVlc3RlZC5cbiAgICAgKlxuICAgICAqIEFsbCBvZiB0aGVzZSByZXN1bHRzIHdpbGwgYWxzbyBtZWFuIHRoYXQgdGhlIHVwZGF0ZWQgcHJvcGVydHkgdmFsdWVzIGhhdmUgYmVlblxuICAgICAqIGNvcGllZCBpbnRvIHlvdXIgQ29udmVyc2F0aW9uIG9iamVjdC4gIFRoYXQgbWVhbnMgeW91ciBtZXRhZGF0YSBwcm9wZXJ0eSBtYXkgbm9cbiAgICAgKiBsb25nZXIgYmUgaXRzIGluaXRpYWwgdmFsdWU7IGl0IHdpbGwgYmUgdGhlIHZhbHVlIGZvdW5kIG9uIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpzZW50JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICAgKiAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uQ1JFQVRFRDpcbiAgICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIENyZWF0ZWQhJyk7XG4gICAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkQ6XG4gICAgICogICAgICAgICAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmlkICsgJyBGb3VuZCEnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQTpcbiAgICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIEZvdW5kLCBidXQgZG9lcyBub3QgaGF2ZSB0aGUgcmVxdWVzdGVkIG1ldGFkYXRhIScpO1xuICAgICAqICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LnJlc3VsdFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0YXJnZXRcbiAgICAgKi9cbiAgICAnY29udmVyc2F0aW9uczpzZW50JyxcblxuICAgIC8qKlxuICAgICAqIEEgY29udmVyc2F0aW9uIGZhaWxlZCB0byBsb2FkIG9yIGNyZWF0ZSBvbiB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6c2VudC1lcnJvcicsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIGFsZXJ0KGV2dC5kYXRhLm1lc3NhZ2UpO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZ0LmRhdGFcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGFyZ2V0XG4gICAgICovXG4gICAgJ2NvbnZlcnNhdGlvbnM6c2VudC1lcnJvcicsXG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnZlcnNhdGlvbiBoYWQgYSBjaGFuZ2UgaW4gaXRzIHByb3BlcnRpZXMuXG4gICAgICpcbiAgICAgKiBUaGlzIGNoYW5nZSBtYXkgaGF2ZSBiZWVuIGRlbGl2ZXJlZCBmcm9tIGEgcmVtb3RlIHVzZXJcbiAgICAgKiBvciBhcyBhIHJlc3VsdCBvZiBhIGxvY2FsIG9wZXJhdGlvbi5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHZhciBtZXRhZGF0YUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignbWV0YWRhdGEnKTtcbiAgICAgKiAgICAgICAgICB2YXIgcGFydGljaXBhbnRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3BhcnRpY2lwYW50cycpO1xuICAgICAqICAgICAgICAgIGlmIChtZXRhZGF0YUNoYW5nZXMubGVuZ3RoKSB7XG4gICAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJUaXRsZShldnQudGFyZ2V0Lm1ldGFkYXRhLnRpdGxlKTtcbiAgICAgKiAgICAgICAgICB9XG4gICAgICogICAgICAgICAgaWYgKHBhcnRpY2lwYW50Q2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbmRlclBhcnRpY2lwYW50cyhldnQudGFyZ2V0LnBhcnRpY2lwYW50cyk7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBOT1RFOiBUeXBpY2FsbHkgc3VjaCByZW5kZXJpbmcgaXMgZG9uZSB1c2luZyBFdmVudHMgb24gbGF5ZXIuUXVlcnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldnQudGFyZ2V0XG4gICAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgICAqL1xuICAgICdjb252ZXJzYXRpb25zOmNoYW5nZScsXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGwgdG8gbGF5ZXIuQ29udmVyc2F0aW9uLmxvYWQgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHlcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2dC50YXJnZXRcbiAgICAgKi9cbiAgICAnY29udmVyc2F0aW9uczpsb2FkZWQnLFxuXG4gICAgLyoqXG4gICAgICogQSBDb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGxheWVyLkNvbnZlcnNhdGlvbi5kZWxldGUoKSBvbiB0aGUgQ29udmVyc2F0aW9uXG4gICAgICogb3IgYnkgYSByZW1vdGUgdXNlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmRlbGV0ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIG15Vmlldy5yZW1vdmVDb252ZXJzYXRpb24oZXZ0LnRhcmdldCk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2dC50YXJnZXRcbiAgICAgKi9cbiAgICAnY29udmVyc2F0aW9uczpkZWxldGUnLFxuICBdLFxuICBsaWZlY3ljbGU6IHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9ucyA9IHt9O1xuICAgIH0sXG4gICAgY2xlYW51cCgpIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF07XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24gJiYgIWNvbnZlcnNhdGlvbi5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIGNvbnZlcnNhdGlvbi5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnMgPSBudWxsO1xuICAgIH0sXG5cbiAgICByZXNldCgpIHtcbiAgICAgIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zID0ge307XG4gICAgfSxcbiAgfSxcbiAgbWV0aG9kczoge1xuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIGEgY29udmVyc2F0aW9uIGJ5IElkZW50aWZpZXIuXG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjID0gY2xpZW50LmdldENvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJyk7XG4gICAgICpcbiAgICAgKiBJZiB0aGVyZSBpcyBub3QgYSBjb252ZXJzYXRpb24gd2l0aCB0aGF0IGlkLCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogSWYgeW91IHdhbnQgaXQgdG8gbG9hZCBpdCBmcm9tIGNhY2hlIGFuZCB0aGVuIGZyb20gc2VydmVyIGlmIG5vdCBpbiBjYWNoZSwgdXNlIHRoZSBgY2FuTG9hZGAgcGFyYW1ldGVyLlxuICAgICAqIElmIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLCB0aGUgbWV0aG9kIHdpbGwgcmV0dXJuXG4gICAgICogYSBsYXllci5Db252ZXJzYXRpb24gaW5zdGFuY2UgdGhhdCBoYXMgbm8gZGF0YTsgdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAgLyBgY29udmVyc2F0aW9uczpsb2FkZWQtZXJyb3JgIGV2ZW50c1xuICAgICAqIHdpbGwgbGV0IHlvdSBrbm93IHdoZW4gdGhlIGNvbnZlcnNhdGlvbiBoYXMgZmluaXNoZWQvZmFpbGVkIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvMTIzJywgdHJ1ZSlcbiAgICAgKiAgICAgIC5vbignY29udmVyc2F0aW9uczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgICAvLyBSZW5kZXIgdGhlIENvbnZlcnNhdGlvbiB3aXRoIGFsbCBvZiBpdHMgZGV0YWlscyBsb2FkZWRcbiAgICAgKiAgICAgICAgICBteXJlcmVuZGVyKGMpO1xuICAgICAqICAgICAgfSk7XG4gICAgICogICAgICAvLyBSZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgYyB1bnRpbCB0aGUgZGV0YWlscyBvZiBjIGhhdmUgbG9hZGVkXG4gICAgICogICAgICBteXJlbmRlcihjKTtcbiAgICAgKlxuICAgICAqIE5vdGUgaW4gdGhlIGFib3ZlIGV4YW1wbGUgdGhhdCB0aGUgYGNvbnZlcnNhdGlvbnM6bG9hZGVkYCBldmVudCB3aWxsIHRyaWdnZXIgZXZlbiBpZiB0aGUgQ29udmVyc2F0aW9uIGhhcyBwcmV2aW91c2x5IGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgZ2V0Q29udmVyc2F0aW9uXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgY29udmVyc2F0aW9uIGZyb21cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgICAqL1xuICAgIGdldENvbnZlcnNhdGlvbihpZCwgY2FuTG9hZCkge1xuICAgICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gQ29udmVyc2F0aW9uLmxvYWQoaWQsIHRoaXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjb252ZXJzYXRpb24gdG8gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfYWRkQ29udmVyc2F0aW9uIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjb252ID0gbmV3IGxheWVyLkNvbnZlcnNhdGlvbih7XG4gICAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddXG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqICAgICAgLy8gT1I6XG4gICAgICogICAgICB2YXIgY29udiA9IGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oWydhJywgJ2InXSk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9hZGRDb252ZXJzYXRpb25cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAgICovXG4gICAgX2FkZENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgIGNvbnN0IGlkID0gY29udmVyc2F0aW9uLmlkO1xuICAgICAgaWYgKCF0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0pIHtcbiAgICAgICAgLy8gUmVnaXN0ZXIgdGhlIENvbnZlcnNhdGlvblxuICAgICAgICB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tpZF0gPSBjb252ZXJzYXRpb247XG5cbiAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBjbGllbnQgaXMgc2V0IHNvIHRoYXQgdGhlIG5leHQgZXZlbnQgYnViYmxlcyB1cFxuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmNsaWVudElkICE9PSB0aGlzLmFwcElkKSBjb252ZXJzYXRpb24uY2xpZW50SWQgPSB0aGlzLmFwcElkO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6YWRkJywgeyBjb252ZXJzYXRpb25zOiBbY29udmVyc2F0aW9uXSB9KTtcblxuICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShjb252ZXJzYXRpb24pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY29udmVyc2F0aW9uIGZyb20gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfcmVtb3ZlQ29udmVyc2F0aW9uIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIGNvbnZlcnNhdGlvbi5kZXN0cm95KCk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9yZW1vdmVDb252ZXJzYXRpb25cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAgICovXG4gICAgX3JlbW92ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICAgIC8vIEluc3VyZSB3ZSBkbyBub3QgZ2V0IGFueSBldmVudHMsIHN1Y2ggYXMgbWVzc2FnZTpyZW1vdmVcbiAgICAgIGNvbnZlcnNhdGlvbi5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG5cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tjb252ZXJzYXRpb24uaWRdKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tjb252ZXJzYXRpb24uaWRdO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJywgeyBjb252ZXJzYXRpb25zOiBbY29udmVyc2F0aW9uXSB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtb3ZlIGFueSBNZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIENvbnZlcnNhdGlvblxuICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLm1lc3NhZ2VzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uLmlkKSB7XG4gICAgICAgICAgdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgQ29udmVyc2F0aW9uIElEIGNoYW5nZXMsIHdlIG5lZWQgdG8gcmVyZWdpc3RlciB0aGUgQ29udmVyc2F0aW9uXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF91cGRhdGVDb252ZXJzYXRpb25JZFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGNvbnZlcnNhdGlvbiAtIENvbnZlcnNhdGlvbiB3aG9zZSBJRCBoYXMgY2hhbmdlZFxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gb2xkSWQgLSBQcmV2aW91cyBJRFxuICAgICAqL1xuICAgIF91cGRhdGVDb252ZXJzYXRpb25JZChjb252ZXJzYXRpb24sIG9sZElkKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnNbb2xkSWRdKSB7XG4gICAgICAgIHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zW2NvbnZlcnNhdGlvbi5pZF0gPSBjb252ZXJzYXRpb247XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuY29udmVyc2F0aW9uc1tvbGRJZF07XG5cbiAgICAgICAgLy8gVGhpcyBpcyBhIG5hc3R5IHdheSB0byB3b3JrLi4uIGJ1dCBuZWVkIHRvIGZpbmQgYW5kIHVwZGF0ZSBhbGxcbiAgICAgICAgLy8gY29udmVyc2F0aW9uSWQgcHJvcGVydGllcyBvZiBhbGwgTWVzc2FnZXMgb3IgdGhlIFF1ZXJ5J3Mgd29uJ3RcbiAgICAgICAgLy8gc2VlIHRoZXNlIGFzIG1hdGNoaW5nIHRoZSBxdWVyeS5cbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLm1lc3NhZ2VzKVxuICAgICAgICAgICAgICAuZmlsdGVyKGlkID0+IHRoaXMuX21vZGVscy5tZXNzYWdlc1tpZF0uY29udmVyc2F0aW9uSWQgPT09IG9sZElkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChpZCA9PiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9IGNvbnZlcnNhdGlvbi5pZCkpO1xuICAgICAgfVxuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGxvY2FsbHkgY2FjaGVkIGNvbnZlcnNhdGlvbnMgZm9yIGEgbWF0Y2hpbmcgY29udmVyc2F0aW9uLlxuICAgICAqXG4gICAgICogSXRlcmF0ZXMgb3ZlciBjb252ZXJzYXRpb25zIGNhbGxpbmcgYSBtYXRjaGluZyBmdW5jdGlvbiB1bnRpbFxuICAgICAqIHRoZSBjb252ZXJzYXRpb24gaXMgZm91bmQgb3IgYWxsIGNvbnZlcnNhdGlvbnMgdGVzdGVkLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5maW5kQ2FjaGVkQ29udmVyc2F0aW9uKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgICAqICAgICAgICAgIGlmIChjb252ZXJzYXRpb24ucGFydGljaXBhbnRzLmluZGV4T2YoJ2EnKSAhPSAtMSkgcmV0dXJuIHRydWU7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZmluZENhY2hlZENvbnZlcnNhdGlvblxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmIC0gRnVuY3Rpb24gdG8gY2FsbCB1bnRpbCB3ZSBmaW5kIGEgbWF0Y2hcbiAgICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGYuY29udmVyc2F0aW9uIC0gQSBjb252ZXJzYXRpb24gdG8gdGVzdFxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IGYucmV0dXJuIC0gUmV0dXJuIHRydWUgaWYgdGhlIGNvbnZlcnNhdGlvbiBpcyBhIG1hdGNoXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgKnRoaXMqIG9iamVjdFxuICAgICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogVGhpcyBzaG91bGQgYmUgcmVwbGFjZWQgYnkgaXRlcmF0aW5nIG92ZXIgeW91ciBsYXllci5RdWVyeSBkYXRhLlxuICAgICAqL1xuICAgIGZpbmRDYWNoZWRDb252ZXJzYXRpb24oZnVuYywgY29udGV4dCkge1xuICAgICAgY29uc3QgdGVzdCA9IGNvbnRleHQgPyBmdW5jLmJpbmQoY29udGV4dCkgOiBmdW5jO1xuICAgICAgY29uc3QgbGlzdCA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5jb252ZXJzYXRpb25zKTtcbiAgICAgIGNvbnN0IGxlbiA9IGxpc3QubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxlbjsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBrZXkgPSBsaXN0W2luZGV4XTtcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5fbW9kZWxzLmNvbnZlcnNhdGlvbnNba2V5XTtcbiAgICAgICAgaWYgKHRlc3QoY29udmVyc2F0aW9uLCBpbmRleCkpIHJldHVybiBjb252ZXJzYXRpb247XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgcmVjb21tZW5kZWQgd2F5IHRvIGNyZWF0ZSBhIENvbnZlcnNhdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSBhIGZldyB3YXlzIHRvIGludm9rZSBpdDsgbm90ZSB0aGF0IHRoZSBkZWZhdWx0IGJlaGF2aW9yIGlzIHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvblxuICAgICAqIHVubGVzcyBvdGhlcndpc2Ugc3RhdGVkIHZpYSB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmRpc3RpbmN0IHByb3BlcnR5LlxuICAgICAqXG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtwYXJ0aWNpcGFudHM6IFsnYScsICdiJ119KTtcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe3BhcnRpY2lwYW50czogW3VzZXJJZGVudGl0eUEsIHVzZXJJZGVudGl0eUJdfSk7XG4gICAgICpcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe1xuICAgICAqICAgICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICAgKiAgICAgICAgICAgICBkaXN0aW5jdDogZmFsc2VcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqXG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICAgKiAgICAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAgICogICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgKiAgICAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIGEgdGl0bGUnXG4gICAgICogICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBJZiB5b3UgdHJ5IHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvbiB0aGF0IGFscmVhZHkgZXhpc3RzLFxuICAgICAqIHlvdSB3aWxsIGdldCBiYWNrIGFuIGV4aXN0aW5nIENvbnZlcnNhdGlvbiwgYW5kIGFueSByZXF1ZXN0ZWQgbWV0YWRhdGFcbiAgICAgKiB3aWxsIE5PVCBiZSBzZXQ7IHlvdSB3aWxsIGdldCB3aGF0ZXZlciBtZXRhZGF0YSB0aGUgbWF0Y2hpbmcgQ29udmVyc2F0aW9uXG4gICAgICogYWxyZWFkeSBoYWQuXG4gICAgICpcbiAgICAgKiBUaGUgZGVmYXVsdCB2YWx1ZSBmb3IgZGlzdGluY3QgaXMgYHRydWVgLlxuICAgICAqXG4gICAgICogV2hldGhlciB0aGUgQ29udmVyc2F0aW9uIGFscmVhZHkgZXhpc3RzIG9yIG5vdCwgYSAnY29udmVyc2F0aW9uczpzZW50JyBldmVudFxuICAgICAqIHdpbGwgYmUgdHJpZ2dlcmVkIGFzeW5jaHJvbm91c2x5IGFuZCB0aGUgQ29udmVyc2F0aW9uIG9iamVjdCB3aWxsIGJlIHJlYWR5XG4gICAgICogYXQgdGhhdCB0aW1lLiAgRnVydGhlciwgdGhlIGV2ZW50IHdpbGwgcHJvdmlkZSBkZXRhaWxzIG9uIHRoZSByZXN1bHQ6XG4gICAgICpcbiAgICAgKiAgICAgICB2YXIgY29udmVyc2F0aW9uID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgICAqICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICogICAgICAgICAgICB0aXRsZTogJ0kgYW0gYSB0aXRsZSdcbiAgICAgKiAgICAgICAgICB9XG4gICAgICogICAgICAgfSk7XG4gICAgICogICAgICAgY29udmVyc2F0aW9uLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkNSRUFURUQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgY3JlYXRlZCcpO1xuICAgICAqICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgICAgY2FzZSBDb252ZXJzYXRpb24uRk9VTkQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgZm91bmQnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBOlxuICAgICAqICAgICAgICAgICAgICAgICAgIGFsZXJ0KGNvbnZlcnNhdGlvbi5pZCArICcgd2FzIGZvdW5kIGJ1dCBpdCBhbHJlYWR5IGhhcyBhIHRpdGxlIHNvIHlvdXIgcmVxdWVzdGVkIHRpdGxlIHdhcyBub3Qgc2V0Jyk7XG4gICAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgICB9XG4gICAgICogICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBXYXJuaW5nOiBUaGlzIG1ldGhvZCB3aWxsIHRocm93IGFuIGVycm9yIGlmIGNhbGxlZCB3aGVuIHlvdSBhcmUgbm90IChvciBhcmUgbm8gbG9uZ2VyKSBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgICogVGhhdCBtZWFucyBpZiBhdXRoZW50aWNhdGlvbiBoYXMgZXhwaXJlZCwgYW5kIHlvdSBoYXZlIG5vdCB5ZXQgcmVhdXRoZW50aWNhdGVkIHRoZSB1c2VyLCB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gICAgICpcbiAgICAgKlxuICAgICAqIEBtZXRob2QgY3JlYXRlQ29udmVyc2F0aW9uXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBVc2VySURzIG9yIFVzZXJJZGVudGl0aWVzXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSBJcyB0aGlzIGEgZGlzdGluY3QgQ29udmVyc2F0aW9uP1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5tZXRhZGF0YT17fV0gTWV0YWRhdGEgZm9yIHlvdXIgQ29udmVyc2F0aW9uXG4gICAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgICAqL1xuICAgIGNyZWF0ZUNvbnZlcnNhdGlvbihvcHRpb25zKSB7XG4gICAgICAvLyBJZiB3ZSBhcmVuJ3QgYXV0aGVudGljYXRlZCwgdGhlbiB3ZSBkb24ndCB5ZXQgaGF2ZSBhIFVzZXJJRCwgYW5kIHdvbid0IGNyZWF0ZSB0aGUgY29ycmVjdCBDb252ZXJzYXRpb25cbiAgICAgIGlmICghdGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuY2xpZW50TXVzdEJlUmVhZHkpO1xuICAgICAgaWYgKCEoJ2Rpc3RpbmN0JyBpbiBvcHRpb25zKSkgb3B0aW9ucy5kaXN0aW5jdCA9IHRydWU7XG4gICAgICBvcHRpb25zLmNsaWVudCA9IHRoaXM7XG4gICAgICByZXR1cm4gQ29udmVyc2F0aW9uLmNyZWF0ZShvcHRpb25zKTtcbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
