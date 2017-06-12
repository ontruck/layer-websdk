'use strict';

/**
 * Adds Message handling to the layer.Client.
 *
 * @class layer.mixins.ClientMessages
 */

var Syncable = require('../models/syncable');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [
  /**
   * A new message has been received for which a notification may be suitable.
   *
   * This event is triggered for messages that are:
   *
   * 1. Added via websocket rather than other IO
   * 2. Not yet been marked as read
   * 3. Not sent by this user
   *
          client.on('messages:notify', function(evt) {
              myNotify(evt.message);
          })
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Message} evt.Message
  */
  'messages:notify',

  /**
   * Messages have been added to a conversation.
   *
   * May also fire when new Announcements are received.
   *
   * This event is triggered on
   *
   * * creating/sending a new message
   * * Receiving a new layer.Message or layer.Announcement via websocket
   * * Querying/downloading a set of Messages
   *
          client.on('messages:add', function(evt) {
              evt.messages.forEach(function(message) {
                  myView.addMessage(message);
              });
          });
  *
  * NOTE: Such rendering would typically be done using events on layer.Query.
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Message[]} evt.messages
  */
  'messages:add',

  /**
   * A message has been removed from a conversation.
   *
   * A removed Message is not necessarily deleted,
   * just no longer being held in memory.
   *
   * Note that typically you will want the messages:delete event
   * rather than messages:remove.
   *
   *      client.on('messages:remove', function(evt) {
   *          evt.messages.forEach(function(message) {
   *              myView.removeMessage(message);
   *          });
   *      });
   *
   * NOTE: Such rendering would typically be done using events on layer.Query.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.message
   */
  'messages:remove',

  /**
   * A message has been sent.
   *
   *      client.on('messages:sent', function(evt) {
   *          alert(evt.target.getText() + ' has been sent');
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.target
   */
  'messages:sent',

  /**
   * A message is about to be sent.
   *
   * Useful if you want to
   * add parts to the message before it goes out.
   *
   *      client.on('messages:sending', function(evt) {
   *          evt.target.addPart({
   *              mimeType: 'text/plain',
   *              body: 'this is just a test'
   *          });
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.target
   */
  'messages:sending',

  /**
   * Server failed to receive a Message.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.LayerError} evt.error
   */
  'messages:sent-error',

  /**
   * A message has had a change in its properties.
   *
   * This change may have been delivered from a remote user
   * or as a result of a local operation.
   *
   *      client.on('messages:change', function(evt) {
   *          var recpientStatusChanges = evt.getChangesFor('recipientStatus');
   *          if (recpientStatusChanges.length) {
   *              myView.renderStatus(evt.target);
   *          }
   *      });
   *
   * NOTE: Such rendering would typically be done using events on layer.Query.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.target
   * @param {Object[]} evt.changes
   * @param {Mixed} evt.changes.newValue
   * @param {Mixed} evt.changes.oldValue
   * @param {string} evt.changes.property - Name of the property that has changed
   */
  'messages:change',

  /**
   * A call to layer.Message.load has completed successfully
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.target
   */
  'messages:loaded',

  /**
   * A Message has been deleted from the server.
   *
   * Caused by either a successful call to layer.Message.delete() on the Message
   * or by a remote user.
   *
   *      client.on('messages:delete', function(evt) {
   *          myView.removeMessage(evt.target);
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Message} evt.target
   */
  'messages:delete'],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.messages = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.messages).forEach(function (id) {
        var message = _this._models.messages[id];
        if (message && !message.isDestroyed) {
          message.destroy();
        }
      });
      this._models.messages = null;
    },
    reset: function reset() {
      this._models.messages = {};
    }
  },
  methods: {
    /**
     * Retrieve the message or announcement by ID.
     *
     * Useful for finding a message when you have only the ID.
     *
     * If the message is not found, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Message instance that has no data; the messages:loaded/messages:loaded-error events
     * will let you know when the message has finished/failed loading from the server.
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          // Render the Message with all of its details loaded
     *          myrerender(m);
     *      });
     *      // Render a placeholder for m until the details of m have loaded
     *      myrender(m);
     *
     *
     * @method getMessage
     * @param  {string} id              - layer:///messages/uuid
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a message from the server if not found
     * @return {layer.Message}
     */
    getMessage: function getMessage(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      if (this._models.messages[id]) {
        return this._models.messages[id];
      } else if (canLoad) {
        return Syncable.load(id, this);
      }
      return null;
    },


    /**
     * Get a MessagePart by ID
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getMessagePart
     * @param {String} id - ID of the Message Part; layer:///messages/uuid/parts/5
     */
    getMessagePart: function getMessagePart(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      var messageId = id.replace(/\/parts.*$/, '');
      var message = this.getMessage(messageId);
      if (message) return message.getPartById(id);
      return null;
    },


    /**
     * Registers a message in _models.messages and triggers events.
     *
     * May also update Conversation.lastMessage.
     *
     * @method _addMessage
     * @protected
     * @param  {layer.Message} message
     */
    _addMessage: function _addMessage(message) {
      if (!this._models.messages[message.id]) {
        this._models.messages[message.id] = message;
        this._triggerAsync('messages:add', { messages: [message] });
        if (message._notify) {
          this._triggerAsync('messages:notify', { message: message });
          message._notify = false;
        }

        var conversation = message.getConversation(false);
        if (conversation && (!conversation.lastMessage || conversation.lastMessage.position < message.position)) {
          var lastMessageWas = conversation.lastMessage;
          conversation.lastMessage = message;
          if (lastMessageWas) this._scheduleCheckAndPurgeCache(lastMessageWas);
        } else {
          this._scheduleCheckAndPurgeCache(message);
        }
      }
    },


    /**
     * Removes message from _models.messages.
     *
     * Accepts IDs or Message instances
     *
     * TODO: Remove support for remove by ID
     *
     * @method _removeMessage
     * @private
     * @param  {layer.Message|string} message or Message ID
     */
    _removeMessage: function _removeMessage(message) {
      var id = typeof message === 'string' ? message : message.id;
      message = this._models.messages[id];
      if (message) {
        delete this._models.messages[id];
        if (!this._inCleanup) {
          this._triggerAsync('messages:remove', { messages: [message] });
          var conv = message.getConversation(false);
          if (conv && conv.lastMessage === message) conv.lastMessage = null;
        }
      }
    },


    /**
     * Handles delete from position event from Websocket.
     *
     * A WebSocket may deliver a `delete` Conversation event with a
     * from_position field indicating that all Messages at the specified position
     * and earlier should be deleted.
     *
     * @method _purgeMessagesByPosition
     * @private
     * @param {string} conversationId
     * @param {number} fromPosition
     */
    _purgeMessagesByPosition: function _purgeMessagesByPosition(conversationId, fromPosition) {
      var _this2 = this;

      Object.keys(this._models.messages).forEach(function (id) {
        var message = _this2._models.messages[id];
        if (message.conversationId === conversationId && message.position <= fromPosition) {
          message.destroy();
        }
      });
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LW1lc3NhZ2VzLmpzIl0sIm5hbWVzIjpbIlN5bmNhYmxlIiwicmVxdWlyZSIsIkVycm9yRGljdGlvbmFyeSIsImRpY3Rpb25hcnkiLCJtb2R1bGUiLCJleHBvcnRzIiwiZXZlbnRzIiwibGlmZWN5Y2xlIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX21vZGVscyIsIm1lc3NhZ2VzIiwiY2xlYW51cCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiaWQiLCJtZXNzYWdlIiwiaXNEZXN0cm95ZWQiLCJkZXN0cm95IiwicmVzZXQiLCJtZXRob2RzIiwiZ2V0TWVzc2FnZSIsImNhbkxvYWQiLCJFcnJvciIsImlkUGFyYW1SZXF1aXJlZCIsImxvYWQiLCJnZXRNZXNzYWdlUGFydCIsIm1lc3NhZ2VJZCIsInJlcGxhY2UiLCJnZXRQYXJ0QnlJZCIsIl9hZGRNZXNzYWdlIiwiX3RyaWdnZXJBc3luYyIsIl9ub3RpZnkiLCJjb252ZXJzYXRpb24iLCJnZXRDb252ZXJzYXRpb24iLCJsYXN0TWVzc2FnZSIsInBvc2l0aW9uIiwibGFzdE1lc3NhZ2VXYXMiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUiLCJfcmVtb3ZlTWVzc2FnZSIsIl9pbkNsZWFudXAiLCJjb252IiwiX3B1cmdlTWVzc2FnZXNCeVBvc2l0aW9uIiwiY29udmVyc2F0aW9uSWQiLCJmcm9tUG9zaXRpb24iXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztBQU1BLElBQU1BLFdBQVdDLFFBQVEsb0JBQVIsQ0FBakI7QUFDQSxJQUFNQyxrQkFBa0JELFFBQVEsZ0JBQVIsRUFBMEJFLFVBQWxEOztBQUVBQyxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFVBQVE7QUFDTjs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsbUJBbEJNOztBQW9CTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1QkEsZ0JBM0NNOztBQTZDTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBcUJBLG1C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O0FBQ2pELFlBQU1DLFVBQVUsT0FBS1AsT0FBTCxDQUFhQyxRQUFiLENBQXNCSyxFQUF0QixDQUFoQjtBQUNBLFlBQUlDLFFBQVEyQixjQUFSLEtBQTJCQSxjQUEzQixJQUE2QzNCLFFBQVFvQixRQUFSLElBQW9CUSxZQUFyRSxFQUFtRjtBQUNqRjVCLGtCQUFRRSxPQUFSO0FBQ0Q7QUFDRixPQUxEO0FBTUQ7QUFqSU07QUFsTE0sQ0FBakIiLCJmaWxlIjoiY2xpZW50LW1lc3NhZ2VzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZGRzIE1lc3NhZ2UgaGFuZGxpbmcgdG8gdGhlIGxheWVyLkNsaWVudC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIubWl4aW5zLkNsaWVudE1lc3NhZ2VzXG4gKi9cblxuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuLi9tb2RlbHMvc3luY2FibGUnKTtcbmNvbnN0IEVycm9yRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJykuZGljdGlvbmFyeTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV2ZW50czogW1xuICAgIC8qKlxuICAgICAqIEEgbmV3IG1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQgZm9yIHdoaWNoIGEgbm90aWZpY2F0aW9uIG1heSBiZSBzdWl0YWJsZS5cbiAgICAgKlxuICAgICAqIFRoaXMgZXZlbnQgaXMgdHJpZ2dlcmVkIGZvciBtZXNzYWdlcyB0aGF0IGFyZTpcbiAgICAgKlxuICAgICAqIDEuIEFkZGVkIHZpYSB3ZWJzb2NrZXQgcmF0aGVyIHRoYW4gb3RoZXIgSU9cbiAgICAgKiAyLiBOb3QgeWV0IGJlZW4gbWFya2VkIGFzIHJlYWRcbiAgICAgKiAzLiBOb3Qgc2VudCBieSB0aGlzIHVzZXJcbiAgICAgKlxuICAgICAgICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczpub3RpZnknLCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgICBteU5vdGlmeShldnQubWVzc2FnZSk7XG4gICAgICAgICAgICB9KVxuICAgICpcbiAgICAqIEBldmVudFxuICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0Lk1lc3NhZ2VcbiAgICAqL1xuICAgICdtZXNzYWdlczpub3RpZnknLFxuXG4gICAgLyoqXG4gICAgICogTWVzc2FnZXMgaGF2ZSBiZWVuIGFkZGVkIHRvIGEgY29udmVyc2F0aW9uLlxuICAgICAqXG4gICAgICogTWF5IGFsc28gZmlyZSB3aGVuIG5ldyBBbm5vdW5jZW1lbnRzIGFyZSByZWNlaXZlZC5cbiAgICAgKlxuICAgICAqIFRoaXMgZXZlbnQgaXMgdHJpZ2dlcmVkIG9uXG4gICAgICpcbiAgICAgKiAqIGNyZWF0aW5nL3NlbmRpbmcgYSBuZXcgbWVzc2FnZVxuICAgICAqICogUmVjZWl2aW5nIGEgbmV3IGxheWVyLk1lc3NhZ2Ugb3IgbGF5ZXIuQW5ub3VuY2VtZW50IHZpYSB3ZWJzb2NrZXRcbiAgICAgKiAqIFF1ZXJ5aW5nL2Rvd25sb2FkaW5nIGEgc2V0IG9mIE1lc3NhZ2VzXG4gICAgICpcbiAgICAgICAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgICAgZXZ0Lm1lc3NhZ2VzLmZvckVhY2goZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgICAgICBteVZpZXcuYWRkTWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICpcbiAgICAqIE5PVEU6IFN1Y2ggcmVuZGVyaW5nIHdvdWxkIHR5cGljYWxseSBiZSBkb25lIHVzaW5nIGV2ZW50cyBvbiBsYXllci5RdWVyeS5cbiAgICAqXG4gICAgKiBAZXZlbnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VbXX0gZXZ0Lm1lc3NhZ2VzXG4gICAgKi9cbiAgICAnbWVzc2FnZXM6YWRkJyxcblxuICAgIC8qKlxuICAgICAqIEEgbWVzc2FnZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gYSBjb252ZXJzYXRpb24uXG4gICAgICpcbiAgICAgKiBBIHJlbW92ZWQgTWVzc2FnZSBpcyBub3QgbmVjZXNzYXJpbHkgZGVsZXRlZCxcbiAgICAgKiBqdXN0IG5vIGxvbmdlciBiZWluZyBoZWxkIGluIG1lbW9yeS5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCB0eXBpY2FsbHkgeW91IHdpbGwgd2FudCB0aGUgbWVzc2FnZXM6ZGVsZXRlIGV2ZW50XG4gICAgICogcmF0aGVyIHRoYW4gbWVzc2FnZXM6cmVtb3ZlLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIGV2dC5tZXNzYWdlcy5mb3JFYWNoKGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbW92ZU1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICogICAgICAgICAgfSk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIE5PVEU6IFN1Y2ggcmVuZGVyaW5nIHdvdWxkIHR5cGljYWxseSBiZSBkb25lIHVzaW5nIGV2ZW50cyBvbiBsYXllci5RdWVyeS5cbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQubWVzc2FnZVxuICAgICAqL1xuICAgICdtZXNzYWdlczpyZW1vdmUnLFxuXG4gICAgLyoqXG4gICAgICogQSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuZ2V0VGV4dCgpICsgJyBoYXMgYmVlbiBzZW50Jyk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ21lc3NhZ2VzOnNlbnQnLFxuXG4gICAgLyoqXG4gICAgICogQSBtZXNzYWdlIGlzIGFib3V0IHRvIGJlIHNlbnQuXG4gICAgICpcbiAgICAgKiBVc2VmdWwgaWYgeW91IHdhbnQgdG9cbiAgICAgKiBhZGQgcGFydHMgdG8gdGhlIG1lc3NhZ2UgYmVmb3JlIGl0IGdvZXMgb3V0LlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOnNlbmRpbmcnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBldnQudGFyZ2V0LmFkZFBhcnQoe1xuICAgICAqICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nLFxuICAgICAqICAgICAgICAgICAgICBib2R5OiAndGhpcyBpcyBqdXN0IGEgdGVzdCdcbiAgICAgKiAgICAgICAgICB9KTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICAgKi9cbiAgICAnbWVzc2FnZXM6c2VuZGluZycsXG5cbiAgICAvKipcbiAgICAgKiBTZXJ2ZXIgZmFpbGVkIHRvIHJlY2VpdmUgYSBNZXNzYWdlLlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2dC5lcnJvclxuICAgICAqL1xuICAgICdtZXNzYWdlczpzZW50LWVycm9yJyxcblxuICAgIC8qKlxuICAgICAqIEEgbWVzc2FnZSBoYXMgaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgICAqXG4gICAgICogVGhpcyBjaGFuZ2UgbWF5IGhhdmUgYmVlbiBkZWxpdmVyZWQgZnJvbSBhIHJlbW90ZSB1c2VyXG4gICAgICogb3IgYXMgYSByZXN1bHQgb2YgYSBsb2NhbCBvcGVyYXRpb24uXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6Y2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgdmFyIHJlY3BpZW50U3RhdHVzQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdyZWNpcGllbnRTdGF0dXMnKTtcbiAgICAgKiAgICAgICAgICBpZiAocmVjcGllbnRTdGF0dXNDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyU3RhdHVzKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogTk9URTogU3VjaCByZW5kZXJpbmcgd291bGQgdHlwaWNhbGx5IGJlIGRvbmUgdXNpbmcgZXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICAgKiBAcGFyYW0ge09iamVjdFtdfSBldnQuY2hhbmdlc1xuICAgICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMub2xkVmFsdWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZ0LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGhhcyBjaGFuZ2VkXG4gICAgICovXG4gICAgJ21lc3NhZ2VzOmNoYW5nZScsXG5cblxuICAgIC8qKlxuICAgICAqIEEgY2FsbCB0byBsYXllci5NZXNzYWdlLmxvYWQgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHlcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ21lc3NhZ2VzOmxvYWRlZCcsXG5cbiAgICAvKipcbiAgICAgKiBBIE1lc3NhZ2UgaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGxheWVyLk1lc3NhZ2UuZGVsZXRlKCkgb24gdGhlIE1lc3NhZ2VcbiAgICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOmRlbGV0ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIG15Vmlldy5yZW1vdmVNZXNzYWdlKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0LnRhcmdldFxuICAgICAqL1xuICAgICdtZXNzYWdlczpkZWxldGUnLFxuICBdLFxuICBsaWZlY3ljbGU6IHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICB0aGlzLl9tb2RlbHMubWVzc2FnZXMgPSB7fTtcbiAgICB9LFxuICAgIGNsZWFudXAoKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMubWVzc2FnZXMpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9tb2RlbHMubWVzc2FnZXNbaWRdO1xuICAgICAgICBpZiAobWVzc2FnZSAmJiAhbWVzc2FnZS5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIG1lc3NhZ2UuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX21vZGVscy5tZXNzYWdlcyA9IG51bGw7XG4gICAgfSxcbiAgICByZXNldCgpIHtcbiAgICAgIHRoaXMuX21vZGVscy5tZXNzYWdlcyA9IHt9O1xuICAgIH0sXG4gIH0sXG4gIG1ldGhvZHM6IHtcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSB0aGUgbWVzc2FnZSBvciBhbm5vdW5jZW1lbnQgYnkgSUQuXG4gICAgICpcbiAgICAgKiBVc2VmdWwgZm9yIGZpbmRpbmcgYSBtZXNzYWdlIHdoZW4geW91IGhhdmUgb25seSB0aGUgSUQuXG4gICAgICpcbiAgICAgKiBJZiB0aGUgbWVzc2FnZSBpcyBub3QgZm91bmQsIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBJZiB5b3Ugd2FudCBpdCB0byBsb2FkIGl0IGZyb20gY2FjaGUgYW5kIHRoZW4gZnJvbSBzZXJ2ZXIgaWYgbm90IGluIGNhY2hlLCB1c2UgdGhlIGBjYW5Mb2FkYCBwYXJhbWV0ZXIuXG4gICAgICogSWYgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIsIHRoZSBtZXRob2Qgd2lsbCByZXR1cm5cbiAgICAgKiBhIGxheWVyLk1lc3NhZ2UgaW5zdGFuY2UgdGhhdCBoYXMgbm8gZGF0YTsgdGhlIG1lc3NhZ2VzOmxvYWRlZC9tZXNzYWdlczpsb2FkZWQtZXJyb3IgZXZlbnRzXG4gICAgICogd2lsbCBsZXQgeW91IGtub3cgd2hlbiB0aGUgbWVzc2FnZSBoYXMgZmluaXNoZWQvZmFpbGVkIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICB2YXIgbSA9IGNsaWVudC5nZXRNZXNzYWdlKCdsYXllcjovLy9tZXNzYWdlcy8xMjMnLCB0cnVlKVxuICAgICAqICAgICAgLm9uKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgICAvLyBSZW5kZXIgdGhlIE1lc3NhZ2Ugd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAgICogICAgICAgICAgbXlyZXJlbmRlcihtKTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIG0gdW50aWwgdGhlIGRldGFpbHMgb2YgbSBoYXZlIGxvYWRlZFxuICAgICAqICAgICAgbXlyZW5kZXIobSk7XG4gICAgICpcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZ2V0TWVzc2FnZVxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gaWQgICAgICAgICAgICAgIC0gbGF5ZXI6Ly8vbWVzc2FnZXMvdXVpZFxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX1cbiAgICAgKi9cbiAgICBnZXRNZXNzYWdlKGlkLCBjYW5Mb2FkKSB7XG4gICAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuXG4gICAgICBpZiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gU3luY2FibGUubG9hZChpZCwgdGhpcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgTWVzc2FnZVBhcnQgYnkgSURcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIHZhciBwYXJ0ID0gY2xpZW50LmdldE1lc3NhZ2VQYXJ0KCdsYXllcjovLy9tZXNzYWdlcy82ZjA4YWNmYS0zMjY4LTRhZTUtODNkOS02Y2EwMDAwMDAwMC9wYXJ0cy8wJyk7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGdldE1lc3NhZ2VQYXJ0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGlkIC0gSUQgb2YgdGhlIE1lc3NhZ2UgUGFydDsgbGF5ZXI6Ly8vbWVzc2FnZXMvdXVpZC9wYXJ0cy81XG4gICAgICovXG4gICAgZ2V0TWVzc2FnZVBhcnQoaWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG5cbiAgICAgIGNvbnN0IG1lc3NhZ2VJZCA9IGlkLnJlcGxhY2UoL1xcL3BhcnRzLiokLywgJycpO1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZ2V0TWVzc2FnZShtZXNzYWdlSWQpO1xuICAgICAgaWYgKG1lc3NhZ2UpIHJldHVybiBtZXNzYWdlLmdldFBhcnRCeUlkKGlkKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBtZXNzYWdlIGluIF9tb2RlbHMubWVzc2FnZXMgYW5kIHRyaWdnZXJzIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIE1heSBhbHNvIHVwZGF0ZSBDb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9hZGRNZXNzYWdlXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2V9IG1lc3NhZ2VcbiAgICAgKi9cbiAgICBfYWRkTWVzc2FnZShtZXNzYWdlKSB7XG4gICAgICBpZiAoIXRoaXMuX21vZGVscy5tZXNzYWdlc1ttZXNzYWdlLmlkXSkge1xuICAgICAgICB0aGlzLl9tb2RlbHMubWVzc2FnZXNbbWVzc2FnZS5pZF0gPSBtZXNzYWdlO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmFkZCcsIHsgbWVzc2FnZXM6IFttZXNzYWdlXSB9KTtcbiAgICAgICAgaWYgKG1lc3NhZ2UuX25vdGlmeSkge1xuICAgICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6bm90aWZ5JywgeyBtZXNzYWdlIH0pO1xuICAgICAgICAgIG1lc3NhZ2UuX25vdGlmeSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gbWVzc2FnZS5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uICYmICghY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlIHx8IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5wb3NpdGlvbiA8IG1lc3NhZ2UucG9zaXRpb24pKSB7XG4gICAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2VXYXMgPSBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2U7XG4gICAgICAgICAgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgICBpZiAobGFzdE1lc3NhZ2VXYXMpIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKGxhc3RNZXNzYWdlV2FzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIG1lc3NhZ2UgZnJvbSBfbW9kZWxzLm1lc3NhZ2VzLlxuICAgICAqXG4gICAgICogQWNjZXB0cyBJRHMgb3IgTWVzc2FnZSBpbnN0YW5jZXNcbiAgICAgKlxuICAgICAqIFRPRE86IFJlbW92ZSBzdXBwb3J0IGZvciByZW1vdmUgYnkgSURcbiAgICAgKlxuICAgICAqIEBtZXRob2QgX3JlbW92ZU1lc3NhZ2VcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2V8c3RyaW5nfSBtZXNzYWdlIG9yIE1lc3NhZ2UgSURcbiAgICAgKi9cbiAgICBfcmVtb3ZlTWVzc2FnZShtZXNzYWdlKSB7XG4gICAgICBjb25zdCBpZCA9ICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpID8gbWVzc2FnZSA6IG1lc3NhZ2UuaWQ7XG4gICAgICBtZXNzYWdlID0gdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXTtcbiAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMubWVzc2FnZXNbaWRdO1xuICAgICAgICBpZiAoIXRoaXMuX2luQ2xlYW51cCkge1xuICAgICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6cmVtb3ZlJywgeyBtZXNzYWdlczogW21lc3NhZ2VdIH0pO1xuICAgICAgICAgIGNvbnN0IGNvbnYgPSBtZXNzYWdlLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICAgICAgaWYgKGNvbnYgJiYgY29udi5sYXN0TWVzc2FnZSA9PT0gbWVzc2FnZSkgY29udi5sYXN0TWVzc2FnZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlcyBkZWxldGUgZnJvbSBwb3NpdGlvbiBldmVudCBmcm9tIFdlYnNvY2tldC5cbiAgICAgKlxuICAgICAqIEEgV2ViU29ja2V0IG1heSBkZWxpdmVyIGEgYGRlbGV0ZWAgQ29udmVyc2F0aW9uIGV2ZW50IHdpdGggYVxuICAgICAqIGZyb21fcG9zaXRpb24gZmllbGQgaW5kaWNhdGluZyB0aGF0IGFsbCBNZXNzYWdlcyBhdCB0aGUgc3BlY2lmaWVkIHBvc2l0aW9uXG4gICAgICogYW5kIGVhcmxpZXIgc2hvdWxkIGJlIGRlbGV0ZWQuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9wdXJnZU1lc3NhZ2VzQnlQb3NpdGlvblxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZyb21Qb3NpdGlvblxuICAgICAqL1xuICAgIF9wdXJnZU1lc3NhZ2VzQnlQb3NpdGlvbihjb252ZXJzYXRpb25JZCwgZnJvbVBvc2l0aW9uKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMubWVzc2FnZXMpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9tb2RlbHMubWVzc2FnZXNbaWRdO1xuICAgICAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQgJiYgbWVzc2FnZS5wb3NpdGlvbiA8PSBmcm9tUG9zaXRpb24pIHtcbiAgICAgICAgICBtZXNzYWdlLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcblxuICB9LFxufTtcbiJdfQ==
