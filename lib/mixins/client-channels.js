'use strict';

/**
 * Adds Channel handling to the layer.Client.
 *
 * @class layer.mixins.ClientChannels
 */

var Channel = require('../models/channel');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [
  /**
   * One or more layer.Channel objects have been added to the client.
   *
   * They may have been added via the websocket, or via the user creating
   * a new Channel locally.
   *
   *      client.on('channels:add', function(evt) {
   *          evt.channels.forEach(function(channel) {
   *              myView.addChannel(channel);
   *          });
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Channel[]} evt.channels - Array of channels added
   */
  'channels:add',

  /**
   * One or more layer.Channel objects have been removed.
   *
   * A removed Channel is not necessarily deleted, its just
   * no longer being held in local memory.
   *
   * Note that typically you will want the channels:delete event
   * rather than channels:remove.
   *
   *      client.on('channels:remove', function(evt) {
   *          evt.channels.forEach(function(channel) {
   *              myView.removeChannel(channel);
   *          });
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Channel[]} evt.channels - Array of channels removed
   */
  'channels:remove',

  /**
   * A channel had a change in its properties.
   *
   * This change may have been delivered from a remote user
   * or as a result of a local operation.
   *
   *      client.on('channels:change', function(evt) {
   *          var metadataChanges = evt.getChangesFor('metadata');
   *          var participantChanges = evt.getChangesFor('members');
   *          if (metadataChanges.length) {
   *              myView.renderTitle(evt.target.metadata.title);
   *          }
   *          if (participantChanges.length) {
   *              myView.rendermembers(evt.target.members);
   *          }
   *      });
   *
   * NOTE: Typically such rendering is done using Events on layer.Query.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Channel} evt.target
   * @param {Object[]} evt.changes
   * @param {Mixed} evt.changes.newValue
   * @param {Mixed} evt.changes.oldValue
   * @param {string} evt.changes.property - Name of the property that has changed
   */
  'channels:change',

  /**
   * A call to layer.Channel.load has completed successfully
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Channel} evt.target
   */
  'channels:loaded',

  /**
   * A Channel has been deleted from the server.
   *
   * Caused by either a successful call to layer.Channel.delete() on the Channel
   * or by a remote user.
   *
   *      client.on('channels:delete', function(evt) {
   *          myView.removeChannel(evt.target);
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Channel} evt.target
   */
  'channels:delete',

  /**
   * The channel is now on the server.
   *
   * Called after creating the channel
   * on the server.  The Result property is one of:
   *
   * * layer.Channel.CREATED: A new Channel has been created
   * * layer.Channel.FOUND: A matching Channel has been found
   *
   * All of these results will also mean that the updated property values have been
   * copied into your Channel object.  That means your metadata property may no
   * longer be its initial value; it will be the value found on the server.
   *
   *      client.on('channels:sent', function(evt) {
   *          switch(evt.result) {
   *              case Channel.CREATED:
   *                  alert(evt.target.id + ' Created!');
   *                  break;
   *              case Channel.FOUND:
   *                  alert(evt.target.id + ' Found!');
   *                  break;
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} event
   * @param {string} event.result
   * @param {layer.Channel} target
   */
  'channels:sent',

  /**
   * A channel failed to load or create on the server.
   *
   *      client.on('channels:sent-error', function(evt) {
   *          alert(evt.data.message);
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.LayerError} evt.data
   * @param {layer.Channel} target
   */
  'channels:sent-error'],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.channels = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.channels).forEach(function (id) {
        var channel = _this._models.channels[id];
        if (channel && !channel.isDestroyed) {
          channel.destroy();
        }
      });
      this._models.channels = null;
    },
    reset: function reset() {
      this._models.channels = {};
    }
  },
  methods: {
    /**
     * Retrieve a channel by Identifier.
     *
     *      var c = client.getChannel('layer:///channels/uuid');
     *
     * If there is not a channel with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Channel instance that has no data; the `channels:loaded` / `channels:loaded-error` events
     * will let you know when the channel has finished/failed loading from the server.
     *
     *      var c = client.getChannel('layer:///channels/123', true)
     *      .on('channels:loaded', function() {
     *          // Render the Channel with all of its details loaded
     *          myrerender(c);
     *      });
     *      // Render a placeholder for c until the details of c have loaded
     *      myrender(c);
     *
     * Note in the above example that the `channels:loaded` event will trigger even if the Channel has previously loaded.
     *
     * @method getChannel
     * @param  {string} id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a channel from
     *                                    the server if not found
     * @return {layer.Channel}
     */
    getChannel: function getChannel(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (!Channel.isValidId(id)) {
        id = Channel.prefixUUID + id;
      }
      if (this._models.channels[id]) {
        return this._models.channels[id];
      } else if (canLoad) {
        return Channel.load(id, this);
      }
      return null;
    },


    /**
     * Adds a channel to the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _addChannel for you:
     *
     *      var conv = new layer.Channel({
     *          client: client,
     *          members: ['a', 'b']
     *      });
     *
     *      // OR:
     *      var conv = client.createChannel(['a', 'b']);
     *
     * @method _addChannel
     * @protected
     * @param  {layer.Channel} c
     */
    _addChannel: function _addChannel(channel) {
      var id = channel.id;
      if (!this._models.channels[id]) {
        // Register the Channel
        this._models.channels[id] = channel;

        // Make sure the client is set so that the next event bubbles up
        if (channel.clientId !== this.appId) channel.clientId = this.appId;
        this._triggerAsync('channels:add', { channels: [channel] });

        this._scheduleCheckAndPurgeCache(channel);
      }
    },


    /**
     * Removes a channel from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeChannel for you:
     *
     *      channel.destroy();
     *
     * @method _removeChannel
     * @protected
     * @param  {layer.Channel} c
     */
    _removeChannel: function _removeChannel(channel) {
      var _this2 = this;

      // Insure we do not get any events, such as message:remove
      channel.off(null, null, this);

      if (this._models.channels[channel.id]) {
        delete this._models.channels[channel.id];
        this._triggerAsync('channels:remove', { channels: [channel] });
      }

      // Remove any Message associated with this Channel
      Object.keys(this._models.messages).forEach(function (id) {
        if (_this2._models.messages[id].channelId === channel.id) {
          _this2._models.messages[id].destroy();
        }
      });
    },


    /**
     * If the Channel ID changes, we need to reregister the Channel
     *
     * @method _updateChannelId
     * @protected
     * @param  {layer.Channel} channel - Channel whose ID has changed
     * @param  {string} oldId - Previous ID
     */
    _updateChannelId: function _updateChannelId(channel, oldId) {
      var _this3 = this;

      if (this._models.channels[oldId]) {
        this._models.channels[channel.id] = channel;
        delete this._models.channels[oldId];

        // This is a nasty way to work... but need to find and update all
        // channelId properties of all Messages or the Query's won't
        // see these as matching the query.
        Object.keys(this._models.messages).filter(function (id) {
          return _this3._models.messages[id].conversationId === oldId;
        }).forEach(function (id) {
          return _this3._models.messages[id].conversationId = channel.id;
        });
      }
    },


    /**
     * Searches locally cached channels for a matching channel.
     *
     * Iterates over channels calling a matching function until
     * the channel is found or all channels tested.
     *
     *      var c = client.findCachedChannel(function(channel) {
     *          if (channel.participants.indexOf('a') != -1) return true;
     *      });
     *
     * @method findCachedChannel
     * @param  {Function} f - Function to call until we find a match
     * @param  {layer.Channel} f.channel - A channel to test
     * @param  {boolean} f.return - Return true if the channel is a match
     * @param  {Object} [context] - Optional context for the *this* object
     * @return {layer.Channel}
     *
     * @deprecated
     * This should be replaced by iterating over your layer.Query data.
     */
    findCachedChannel: function findCachedChannel(func, context) {
      var test = context ? func.bind(context) : func;
      var list = Object.keys(this._models.channels);
      var len = list.length;
      for (var index = 0; index < len; index++) {
        var key = list[index];
        var channel = this._models.channels[key];
        if (test(channel, index)) return channel;
      }
      return null;
    },


    /**
     * This method is recommended way to create a Channel.
     *
     * ```
     *         client.createChannel({
     *             members: ['layer:///identities/a', 'layer:///identities/b'],
     *             name: 'a-channel'
     *         });
     *         client.createChannel({
     *             members: [userIdentityObjectA, userIdentityObjectB],
     *             name: 'another-channel'
     *         });
     *
     *         client.createChannel({
     *             members: ['layer:///identities/a', 'layer:///identities/b'],
     *             name: 'a-channel-with-metadata',
     *             metadata: {
     *                 topicDetails: 'I am a detail'
     *             }
     *         });
     * ```
     *
     * If you try to create a Channel with a name that already exists,
     * you will get back an existing Channel, and any requested metadata and members
     * will NOT be set; you will get whatever metadata the matching Conversation
     * already had, and no members will be added/removed.
     *
     * Whether the Channel already exists or not, a 'channels:sent' event
     * will be triggered asynchronously and the Channel object will be ready
     * at that time.  Further, the event will provide details on the result:
     *
     * ```
     *       var channel = client.createChannel({
     *          members: ['a', 'b'],
     *          name: 'yet-another-channel-with-metadata',
     *          metadata: {
     *                 topicDetails: 'I am a detail'
     *          }
     *       });
     *       channel.on('channels:sent', function(evt) {
     *           switch(evt.result) {
     *               case Channel.CREATED:
     *                   alert(channel.id + ' was created');
     *                   break;
     *               case Channel.FOUND:
     *                   alert(channel.id + ' was found');
     *                   break;
     *               case Channel.FOUND_WITHOUT_REQUESTED_METADATA:
     *                   alert(channel.id + ' was found but it already has a topicDetails so your requested detail was not set');
     *                   break;
     *            }
     *       });
     * ```
     *
     * Warning: This method will throw an error if called when you are not (or are no longer) an authenticated user.
     * That means if authentication has expired, and you have not yet reauthenticated the user, this will throw an error.
     *
     *
     * @method createChannel
     * @param  {Object} options
     * @param {string[]/layer.Identity[]} options.members - Array of UserIDs or UserIdentities
     * @param {String} options.name - The unique name for this Channel
     * @param {Object} [options.metadata={}] Metadata for your Channel
     * @return {layer.Channel}
     */
    createChannel: function createChannel(options) {
      // If we aren't authenticated, then we don't yet have a UserID, and won't create the correct Channel
      if (!this.isAuthenticated) throw new Error(ErrorDictionary.clientMustBeReady);
      if (!('private' in options)) options.private = false;
      options.client = this;
      return Channel.create(options);
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWNoYW5uZWxzLmpzIl0sIm5hbWVzIjpbIkNoYW5uZWwiLCJyZXF1aXJlIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIm1vZHVsZSIsImV4cG9ydHMiLCJldmVudHMiLCJsaWZlY3ljbGUiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJfbW9kZWxzIiwiY2hhbm5lbHMiLCJjbGVhbnVwIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpZCIsImNoYW5uZWwiLCJpc0Rlc3Ryb3llZCIsImRlc3Ryb3kiLCJyZXNldCIsIm1ldGhvZHMiLCJnZXRDaGFubmVsIiwiY2FuTG9hZCIsIkVycm9yIiwiaWRQYXJhbVJlcXVpcmVkIiwiaXNWYWxpZElkIiwicHJlZml4VVVJRCIsImxvYWQiLCJfYWRkQ2hhbm5lbCIsImNsaWVudElkIiwiYXBwSWQiLCJfdHJpZ2dlckFzeW5jIiwiX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlIiwiX3JlbW92ZUNoYW5uZWwiLCJvZmYiLCJtZXNzYWdlcyIsImNoYW5uZWxJZCIsIl91cGRhdGVDaGFubmVsSWQiLCJvbGRJZCIsImZpbHRlciIsImNvbnZlcnNhdGlvbklkIiwiZmluZENhY2hlZENoYW5uZWwiLCJmdW5jIiwiY29udGV4dCIsInRlc3QiLCJiaW5kIiwibGlzdCIsImxlbiIsImxlbmd0aCIsImluZGV4Iiwia2V5IiwiY3JlYXRlQ2hhbm5lbCIsImlzQXV0aGVudGljYXRlZCIsImNsaWVudE11c3RCZVJlYWR5IiwicHJpdmF0ZSIsImNsaWVudCIsImNyZWF0ZSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0FBTUEsSUFBTUEsVUFBVUMsUUFBUSxtQkFBUixDQUFoQjtBQUNBLElBQU1DLGtCQUFrQkQsUUFBUSxnQkFBUixFQUEwQkUsVUFBbEQ7O0FBRUFDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsVUFBUTtBQUNOOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLGdCQWpCTTs7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Ozs7Ozs7QUFvQkEwQixxQkFqSk8sNkJBaUpXQyxJQWpKWCxFQWlKaUJDLE9BakpqQixFQWlKMEI7QUFDL0IsVUFBTUMsT0FBT0QsVUFBVUQsS0FBS0csSUFBTCxDQUFVRixPQUFWLENBQVYsR0FBK0JELElBQTVDO0FBQ0EsVUFBTUksT0FBT2xDLE9BQU9DLElBQVAsQ0FBWSxLQUFLSixPQUFMLENBQWFDLFFBQXpCLENBQWI7QUFDQSxVQUFNcUMsTUFBTUQsS0FBS0UsTUFBakI7QUFDQSxXQUFLLElBQUlDLFFBQVEsQ0FBakIsRUFBb0JBLFFBQVFGLEdBQTVCLEVBQWlDRSxPQUFqQyxFQUEwQztBQUN4QyxZQUFNQyxNQUFNSixLQUFLRyxLQUFMLENBQVo7QUFDQSxZQUFNakMsVUFBVSxLQUFLUCxPQUFMLENBQWFDLFFBQWIsQ0FBc0J3QyxHQUF0QixDQUFoQjtBQUNBLFlBQUlOLEtBQUs1QixPQUFMLEVBQWNpQyxLQUFkLENBQUosRUFBMEIsT0FBT2pDLE9BQVA7QUFDM0I7QUFDRCxhQUFPLElBQVA7QUFDRCxLQTNKTTs7O0FBNkpQOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWlFQW1DLGlCQTlOTyx5QkE4Tk8zQyxPQTlOUCxFQThOZ0I7QUFDckI7QUFDQSxVQUFJLENBQUMsS0FBSzRDLGVBQVYsRUFBMkIsTUFBTSxJQUFJN0IsS0FBSixDQUFVdEIsZ0JBQWdCb0QsaUJBQTFCLENBQU47QUFDM0IsVUFBSSxFQUFFLGFBQWE3QyxPQUFmLENBQUosRUFBNkJBLFFBQVE4QyxPQUFSLEdBQWtCLEtBQWxCO0FBQzdCOUMsY0FBUStDLE1BQVIsR0FBaUIsSUFBakI7QUFDQSxhQUFPeEQsUUFBUXlELE1BQVIsQ0FBZWhELE9BQWYsQ0FBUDtBQUNEO0FBcE9NO0FBaEtNLENBQWpCIiwiZmlsZSI6ImNsaWVudC1jaGFubmVscy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWRkcyBDaGFubmVsIGhhbmRsaW5nIHRvIHRoZSBsYXllci5DbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLm1peGlucy5DbGllbnRDaGFubmVsc1xuICovXG5cbmNvbnN0IENoYW5uZWwgPSByZXF1aXJlKCcuLi9tb2RlbHMvY2hhbm5lbCcpO1xuY29uc3QgRXJyb3JEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKS5kaWN0aW9uYXJ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXZlbnRzOiBbXG4gICAgLyoqXG4gICAgICogT25lIG9yIG1vcmUgbGF5ZXIuQ2hhbm5lbCBvYmplY3RzIGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgY2xpZW50LlxuICAgICAqXG4gICAgICogVGhleSBtYXkgaGF2ZSBiZWVuIGFkZGVkIHZpYSB0aGUgd2Vic29ja2V0LCBvciB2aWEgdGhlIHVzZXIgY3JlYXRpbmdcbiAgICAgKiBhIG5ldyBDaGFubmVsIGxvY2FsbHkuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY2hhbm5lbHM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgZXZ0LmNoYW5uZWxzLmZvckVhY2goZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcuYWRkQ2hhbm5lbChjaGFubmVsKTtcbiAgICAgKiAgICAgICAgICB9KTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWxbXX0gZXZ0LmNoYW5uZWxzIC0gQXJyYXkgb2YgY2hhbm5lbHMgYWRkZWRcbiAgICAgKi9cbiAgICAnY2hhbm5lbHM6YWRkJyxcblxuICAgIC8qKlxuICAgICAqIE9uZSBvciBtb3JlIGxheWVyLkNoYW5uZWwgb2JqZWN0cyBoYXZlIGJlZW4gcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEEgcmVtb3ZlZCBDaGFubmVsIGlzIG5vdCBuZWNlc3NhcmlseSBkZWxldGVkLCBpdHMganVzdFxuICAgICAqIG5vIGxvbmdlciBiZWluZyBoZWxkIGluIGxvY2FsIG1lbW9yeS5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCB0eXBpY2FsbHkgeW91IHdpbGwgd2FudCB0aGUgY2hhbm5lbHM6ZGVsZXRlIGV2ZW50XG4gICAgICogcmF0aGVyIHRoYW4gY2hhbm5lbHM6cmVtb3ZlLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NoYW5uZWxzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIGV2dC5jaGFubmVscy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5uZWwpIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbW92ZUNoYW5uZWwoY2hhbm5lbCk7XG4gICAgICogICAgICAgICAgfSk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5DaGFubmVsW119IGV2dC5jaGFubmVscyAtIEFycmF5IG9mIGNoYW5uZWxzIHJlbW92ZWRcbiAgICAgKi9cbiAgICAnY2hhbm5lbHM6cmVtb3ZlJyxcblxuICAgIC8qKlxuICAgICAqIEEgY2hhbm5lbCBoYWQgYSBjaGFuZ2UgaW4gaXRzIHByb3BlcnRpZXMuXG4gICAgICpcbiAgICAgKiBUaGlzIGNoYW5nZSBtYXkgaGF2ZSBiZWVuIGRlbGl2ZXJlZCBmcm9tIGEgcmVtb3RlIHVzZXJcbiAgICAgKiBvciBhcyBhIHJlc3VsdCBvZiBhIGxvY2FsIG9wZXJhdGlvbi5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjaGFubmVsczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICB2YXIgbWV0YWRhdGFDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ21ldGFkYXRhJyk7XG4gICAgICogICAgICAgICAgdmFyIHBhcnRpY2lwYW50Q2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdtZW1iZXJzJyk7XG4gICAgICogICAgICAgICAgaWYgKG1ldGFkYXRhQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgKiAgICAgICAgICAgICAgbXlWaWV3LnJlbmRlclRpdGxlKGV2dC50YXJnZXQubWV0YWRhdGEudGl0bGUpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgICAgICBpZiAocGFydGljaXBhbnRDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVybWVtYmVycyhldnQudGFyZ2V0Lm1lbWJlcnMpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogTk9URTogVHlwaWNhbGx5IHN1Y2ggcmVuZGVyaW5nIGlzIGRvbmUgdXNpbmcgRXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWx9IGV2dC50YXJnZXRcbiAgICAgKiBAcGFyYW0ge09iamVjdFtdfSBldnQuY2hhbmdlc1xuICAgICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMub2xkVmFsdWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZ0LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGhhcyBjaGFuZ2VkXG4gICAgICovXG4gICAgJ2NoYW5uZWxzOmNoYW5nZScsXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGwgdG8gbGF5ZXIuQ2hhbm5lbC5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbH0gZXZ0LnRhcmdldFxuICAgICAqL1xuICAgICdjaGFubmVsczpsb2FkZWQnLFxuXG4gICAgLyoqXG4gICAgICogQSBDaGFubmVsIGhhcyBiZWVuIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogQ2F1c2VkIGJ5IGVpdGhlciBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBsYXllci5DaGFubmVsLmRlbGV0ZSgpIG9uIHRoZSBDaGFubmVsXG4gICAgICogb3IgYnkgYSByZW1vdGUgdXNlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjaGFubmVsczpkZWxldGUnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBteVZpZXcucmVtb3ZlQ2hhbm5lbChldnQudGFyZ2V0KTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWx9IGV2dC50YXJnZXRcbiAgICAgKi9cbiAgICAnY2hhbm5lbHM6ZGVsZXRlJyxcblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNoYW5uZWwgaXMgbm93IG9uIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiBDYWxsZWQgYWZ0ZXIgY3JlYXRpbmcgdGhlIGNoYW5uZWxcbiAgICAgKiBvbiB0aGUgc2VydmVyLiAgVGhlIFJlc3VsdCBwcm9wZXJ0eSBpcyBvbmUgb2Y6XG4gICAgICpcbiAgICAgKiAqIGxheWVyLkNoYW5uZWwuQ1JFQVRFRDogQSBuZXcgQ2hhbm5lbCBoYXMgYmVlbiBjcmVhdGVkXG4gICAgICogKiBsYXllci5DaGFubmVsLkZPVU5EOiBBIG1hdGNoaW5nIENoYW5uZWwgaGFzIGJlZW4gZm91bmRcbiAgICAgKlxuICAgICAqIEFsbCBvZiB0aGVzZSByZXN1bHRzIHdpbGwgYWxzbyBtZWFuIHRoYXQgdGhlIHVwZGF0ZWQgcHJvcGVydHkgdmFsdWVzIGhhdmUgYmVlblxuICAgICAqIGNvcGllZCBpbnRvIHlvdXIgQ2hhbm5lbCBvYmplY3QuICBUaGF0IG1lYW5zIHlvdXIgbWV0YWRhdGEgcHJvcGVydHkgbWF5IG5vXG4gICAgICogbG9uZ2VyIGJlIGl0cyBpbml0aWFsIHZhbHVlOyBpdCB3aWxsIGJlIHRoZSB2YWx1ZSBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NoYW5uZWxzOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBzd2l0Y2goZXZ0LnJlc3VsdCkge1xuICAgICAqICAgICAgICAgICAgICBjYXNlIENoYW5uZWwuQ1JFQVRFRDpcbiAgICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIENyZWF0ZWQhJyk7XG4gICAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgY2FzZSBDaGFubmVsLkZPVU5EOlxuICAgICAqICAgICAgICAgICAgICAgICAgYWxlcnQoZXZ0LnRhcmdldC5pZCArICcgRm91bmQhJyk7XG4gICAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICB9XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQucmVzdWx0XG4gICAgICogQHBhcmFtIHtsYXllci5DaGFubmVsfSB0YXJnZXRcbiAgICAgKi9cbiAgICAnY2hhbm5lbHM6c2VudCcsXG5cbiAgICAvKipcbiAgICAgKiBBIGNoYW5uZWwgZmFpbGVkIHRvIGxvYWQgb3IgY3JlYXRlIG9uIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY2hhbm5lbHM6c2VudC1lcnJvcicsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIGFsZXJ0KGV2dC5kYXRhLm1lc3NhZ2UpO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZ0LmRhdGFcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWx9IHRhcmdldFxuICAgICAqL1xuICAgICdjaGFubmVsczpzZW50LWVycm9yJyxcbiAgXSxcbiAgbGlmZWN5Y2xlOiB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgdGhpcy5fbW9kZWxzLmNoYW5uZWxzID0ge307XG4gICAgfSxcbiAgICBjbGVhbnVwKCkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLmNoYW5uZWxzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBjaGFubmVsID0gdGhpcy5fbW9kZWxzLmNoYW5uZWxzW2lkXTtcbiAgICAgICAgaWYgKGNoYW5uZWwgJiYgIWNoYW5uZWwuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICBjaGFubmVsLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9tb2RlbHMuY2hhbm5lbHMgPSBudWxsO1xuICAgIH0sXG5cbiAgICByZXNldCgpIHtcbiAgICAgIHRoaXMuX21vZGVscy5jaGFubmVscyA9IHt9O1xuICAgIH0sXG5cbiAgfSxcbiAgbWV0aG9kczoge1xuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIGEgY2hhbm5lbCBieSBJZGVudGlmaWVyLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDaGFubmVsKCdsYXllcjovLy9jaGFubmVscy91dWlkJyk7XG4gICAgICpcbiAgICAgKiBJZiB0aGVyZSBpcyBub3QgYSBjaGFubmVsIHdpdGggdGhhdCBpZCwgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICAgKiBJZiBsb2FkaW5nIGZyb20gdGhlIHNlcnZlciwgdGhlIG1ldGhvZCB3aWxsIHJldHVyblxuICAgICAqIGEgbGF5ZXIuQ2hhbm5lbCBpbnN0YW5jZSB0aGF0IGhhcyBubyBkYXRhOyB0aGUgYGNoYW5uZWxzOmxvYWRlZGAgLyBgY2hhbm5lbHM6bG9hZGVkLWVycm9yYCBldmVudHNcbiAgICAgKiB3aWxsIGxldCB5b3Uga25vdyB3aGVuIHRoZSBjaGFubmVsIGhhcyBmaW5pc2hlZC9mYWlsZWQgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjID0gY2xpZW50LmdldENoYW5uZWwoJ2xheWVyOi8vL2NoYW5uZWxzLzEyMycsIHRydWUpXG4gICAgICogICAgICAub24oJ2NoYW5uZWxzOmxvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAqICAgICAgICAgIC8vIFJlbmRlciB0aGUgQ2hhbm5lbCB3aXRoIGFsbCBvZiBpdHMgZGV0YWlscyBsb2FkZWRcbiAgICAgKiAgICAgICAgICBteXJlcmVuZGVyKGMpO1xuICAgICAqICAgICAgfSk7XG4gICAgICogICAgICAvLyBSZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgYyB1bnRpbCB0aGUgZGV0YWlscyBvZiBjIGhhdmUgbG9hZGVkXG4gICAgICogICAgICBteXJlbmRlcihjKTtcbiAgICAgKlxuICAgICAqIE5vdGUgaW4gdGhlIGFib3ZlIGV4YW1wbGUgdGhhdCB0aGUgYGNoYW5uZWxzOmxvYWRlZGAgZXZlbnQgd2lsbCB0cmlnZ2VyIGV2ZW4gaWYgdGhlIENoYW5uZWwgaGFzIHByZXZpb3VzbHkgbG9hZGVkLlxuICAgICAqXG4gICAgICogQG1ldGhvZCBnZXRDaGFubmVsXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICAgICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgY2hhbm5lbCBmcm9tXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgc2VydmVyIGlmIG5vdCBmb3VuZFxuICAgICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9XG4gICAgICovXG4gICAgZ2V0Q2hhbm5lbChpZCwgY2FuTG9hZCkge1xuICAgICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcbiAgICAgIGlmICghQ2hhbm5lbC5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICAgIGlkID0gQ2hhbm5lbC5wcmVmaXhVVUlEICsgaWQ7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmNoYW5uZWxzW2lkXSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWxzLmNoYW5uZWxzW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gQ2hhbm5lbC5sb2FkKGlkLCB0aGlzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgY2hhbm5lbCB0byB0aGUgY2xpZW50LlxuICAgICAqXG4gICAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgZm9sbG93aW5nIGNvZGVcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGNhbGxzIF9hZGRDaGFubmVsIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjb252ID0gbmV3IGxheWVyLkNoYW5uZWwoe1xuICAgICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgICAqICAgICAgICAgIG1lbWJlcnM6IFsnYScsICdiJ11cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogICAgICAvLyBPUjpcbiAgICAgKiAgICAgIHZhciBjb252ID0gY2xpZW50LmNyZWF0ZUNoYW5uZWwoWydhJywgJ2InXSk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9hZGRDaGFubmVsXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBwYXJhbSAge2xheWVyLkNoYW5uZWx9IGNcbiAgICAgKi9cbiAgICBfYWRkQ2hhbm5lbChjaGFubmVsKSB7XG4gICAgICBjb25zdCBpZCA9IGNoYW5uZWwuaWQ7XG4gICAgICBpZiAoIXRoaXMuX21vZGVscy5jaGFubmVsc1tpZF0pIHtcbiAgICAgICAgLy8gUmVnaXN0ZXIgdGhlIENoYW5uZWxcbiAgICAgICAgdGhpcy5fbW9kZWxzLmNoYW5uZWxzW2lkXSA9IGNoYW5uZWw7XG5cbiAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBjbGllbnQgaXMgc2V0IHNvIHRoYXQgdGhlIG5leHQgZXZlbnQgYnViYmxlcyB1cFxuICAgICAgICBpZiAoY2hhbm5lbC5jbGllbnRJZCAhPT0gdGhpcy5hcHBJZCkgY2hhbm5lbC5jbGllbnRJZCA9IHRoaXMuYXBwSWQ7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY2hhbm5lbHM6YWRkJywgeyBjaGFubmVsczogW2NoYW5uZWxdIH0pO1xuXG4gICAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKGNoYW5uZWwpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY2hhbm5lbCBmcm9tIHRoZSBjbGllbnQuXG4gICAgICpcbiAgICAgKiBUeXBpY2FsbHksIHlvdSBkbyBub3QgbmVlZCB0byBjYWxsIHRoaXM7IHRoZSBmb2xsb3dpbmcgY29kZVxuICAgICAqIGF1dG9tYXRpY2FsbHkgY2FsbHMgX3JlbW92ZUNoYW5uZWwgZm9yIHlvdTpcbiAgICAgKlxuICAgICAqICAgICAgY2hhbm5lbC5kZXN0cm95KCk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9yZW1vdmVDaGFubmVsXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBwYXJhbSAge2xheWVyLkNoYW5uZWx9IGNcbiAgICAgKi9cbiAgICBfcmVtb3ZlQ2hhbm5lbChjaGFubmVsKSB7XG4gICAgICAvLyBJbnN1cmUgd2UgZG8gbm90IGdldCBhbnkgZXZlbnRzLCBzdWNoIGFzIG1lc3NhZ2U6cmVtb3ZlXG4gICAgICBjaGFubmVsLm9mZihudWxsLCBudWxsLCB0aGlzKTtcblxuICAgICAgaWYgKHRoaXMuX21vZGVscy5jaGFubmVsc1tjaGFubmVsLmlkXSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWxzLmNoYW5uZWxzW2NoYW5uZWwuaWRdO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NoYW5uZWxzOnJlbW92ZScsIHsgY2hhbm5lbHM6IFtjaGFubmVsXSB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtb3ZlIGFueSBNZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIENoYW5uZWxcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5tZXNzYWdlcykuZm9yRWFjaCgoaWQpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVscy5tZXNzYWdlc1tpZF0uY2hhbm5lbElkID09PSBjaGFubmVsLmlkKSB7XG4gICAgICAgICAgdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgQ2hhbm5lbCBJRCBjaGFuZ2VzLCB3ZSBuZWVkIHRvIHJlcmVnaXN0ZXIgdGhlIENoYW5uZWxcbiAgICAgKlxuICAgICAqIEBtZXRob2QgX3VwZGF0ZUNoYW5uZWxJZFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5DaGFubmVsfSBjaGFubmVsIC0gQ2hhbm5lbCB3aG9zZSBJRCBoYXMgY2hhbmdlZFxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gb2xkSWQgLSBQcmV2aW91cyBJRFxuICAgICAqL1xuICAgIF91cGRhdGVDaGFubmVsSWQoY2hhbm5lbCwgb2xkSWQpIHtcbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY2hhbm5lbHNbb2xkSWRdKSB7XG4gICAgICAgIHRoaXMuX21vZGVscy5jaGFubmVsc1tjaGFubmVsLmlkXSA9IGNoYW5uZWw7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuY2hhbm5lbHNbb2xkSWRdO1xuXG4gICAgICAgIC8vIFRoaXMgaXMgYSBuYXN0eSB3YXkgdG8gd29yay4uLiBidXQgbmVlZCB0byBmaW5kIGFuZCB1cGRhdGUgYWxsXG4gICAgICAgIC8vIGNoYW5uZWxJZCBwcm9wZXJ0aWVzIG9mIGFsbCBNZXNzYWdlcyBvciB0aGUgUXVlcnkncyB3b24ndFxuICAgICAgICAvLyBzZWUgdGhlc2UgYXMgbWF0Y2hpbmcgdGhlIHF1ZXJ5LlxuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMubWVzc2FnZXMpXG4gICAgICAgICAgICAgIC5maWx0ZXIoaWQgPT4gdGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9PT0gb2xkSWQpXG4gICAgICAgICAgICAgIC5mb3JFYWNoKGlkID0+ICh0aGlzLl9tb2RlbHMubWVzc2FnZXNbaWRdLmNvbnZlcnNhdGlvbklkID0gY2hhbm5lbC5pZCkpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBsb2NhbGx5IGNhY2hlZCBjaGFubmVscyBmb3IgYSBtYXRjaGluZyBjaGFubmVsLlxuICAgICAqXG4gICAgICogSXRlcmF0ZXMgb3ZlciBjaGFubmVscyBjYWxsaW5nIGEgbWF0Y2hpbmcgZnVuY3Rpb24gdW50aWxcbiAgICAgKiB0aGUgY2hhbm5lbCBpcyBmb3VuZCBvciBhbGwgY2hhbm5lbHMgdGVzdGVkLlxuICAgICAqXG4gICAgICogICAgICB2YXIgYyA9IGNsaWVudC5maW5kQ2FjaGVkQ2hhbm5lbChmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgICogICAgICAgICAgaWYgKGNoYW5uZWwucGFydGljaXBhbnRzLmluZGV4T2YoJ2EnKSAhPSAtMSkgcmV0dXJuIHRydWU7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZmluZENhY2hlZENoYW5uZWxcbiAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZiAtIEZ1bmN0aW9uIHRvIGNhbGwgdW50aWwgd2UgZmluZCBhIG1hdGNoXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ2hhbm5lbH0gZi5jaGFubmVsIC0gQSBjaGFubmVsIHRvIHRlc3RcbiAgICAgKiBAcGFyYW0gIHtib29sZWFufSBmLnJldHVybiAtIFJldHVybiB0cnVlIGlmIHRoZSBjaGFubmVsIGlzIGEgbWF0Y2hcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IFtjb250ZXh0XSAtIE9wdGlvbmFsIGNvbnRleHQgZm9yIHRoZSAqdGhpcyogb2JqZWN0XG4gICAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH1cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogVGhpcyBzaG91bGQgYmUgcmVwbGFjZWQgYnkgaXRlcmF0aW5nIG92ZXIgeW91ciBsYXllci5RdWVyeSBkYXRhLlxuICAgICAqL1xuICAgIGZpbmRDYWNoZWRDaGFubmVsKGZ1bmMsIGNvbnRleHQpIHtcbiAgICAgIGNvbnN0IHRlc3QgPSBjb250ZXh0ID8gZnVuYy5iaW5kKGNvbnRleHQpIDogZnVuYztcbiAgICAgIGNvbnN0IGxpc3QgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMuY2hhbm5lbHMpO1xuICAgICAgY29uc3QgbGVuID0gbGlzdC5sZW5ndGg7XG4gICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IGxpc3RbaW5kZXhdO1xuICAgICAgICBjb25zdCBjaGFubmVsID0gdGhpcy5fbW9kZWxzLmNoYW5uZWxzW2tleV07XG4gICAgICAgIGlmICh0ZXN0KGNoYW5uZWwsIGluZGV4KSkgcmV0dXJuIGNoYW5uZWw7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgcmVjb21tZW5kZWQgd2F5IHRvIGNyZWF0ZSBhIENoYW5uZWwuXG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDaGFubmVsKHtcbiAgICAgKiAgICAgICAgICAgICBtZW1iZXJzOiBbJ2xheWVyOi8vL2lkZW50aXRpZXMvYScsICdsYXllcjovLy9pZGVudGl0aWVzL2InXSxcbiAgICAgKiAgICAgICAgICAgICBuYW1lOiAnYS1jaGFubmVsJ1xuICAgICAqICAgICAgICAgfSk7XG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ2hhbm5lbCh7XG4gICAgICogICAgICAgICAgICAgbWVtYmVyczogW3VzZXJJZGVudGl0eU9iamVjdEEsIHVzZXJJZGVudGl0eU9iamVjdEJdLFxuICAgICAqICAgICAgICAgICAgIG5hbWU6ICdhbm90aGVyLWNoYW5uZWwnXG4gICAgICogICAgICAgICB9KTtcbiAgICAgKlxuICAgICAqICAgICAgICAgY2xpZW50LmNyZWF0ZUNoYW5uZWwoe1xuICAgICAqICAgICAgICAgICAgIG1lbWJlcnM6IFsnbGF5ZXI6Ly8vaWRlbnRpdGllcy9hJywgJ2xheWVyOi8vL2lkZW50aXRpZXMvYiddLFxuICAgICAqICAgICAgICAgICAgIG5hbWU6ICdhLWNoYW5uZWwtd2l0aC1tZXRhZGF0YScsXG4gICAgICogICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgKiAgICAgICAgICAgICAgICAgdG9waWNEZXRhaWxzOiAnSSBhbSBhIGRldGFpbCdcbiAgICAgKiAgICAgICAgICAgICB9XG4gICAgICogICAgICAgICB9KTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIElmIHlvdSB0cnkgdG8gY3JlYXRlIGEgQ2hhbm5lbCB3aXRoIGEgbmFtZSB0aGF0IGFscmVhZHkgZXhpc3RzLFxuICAgICAqIHlvdSB3aWxsIGdldCBiYWNrIGFuIGV4aXN0aW5nIENoYW5uZWwsIGFuZCBhbnkgcmVxdWVzdGVkIG1ldGFkYXRhIGFuZCBtZW1iZXJzXG4gICAgICogd2lsbCBOT1QgYmUgc2V0OyB5b3Ugd2lsbCBnZXQgd2hhdGV2ZXIgbWV0YWRhdGEgdGhlIG1hdGNoaW5nIENvbnZlcnNhdGlvblxuICAgICAqIGFscmVhZHkgaGFkLCBhbmQgbm8gbWVtYmVycyB3aWxsIGJlIGFkZGVkL3JlbW92ZWQuXG4gICAgICpcbiAgICAgKiBXaGV0aGVyIHRoZSBDaGFubmVsIGFscmVhZHkgZXhpc3RzIG9yIG5vdCwgYSAnY2hhbm5lbHM6c2VudCcgZXZlbnRcbiAgICAgKiB3aWxsIGJlIHRyaWdnZXJlZCBhc3luY2hyb25vdXNseSBhbmQgdGhlIENoYW5uZWwgb2JqZWN0IHdpbGwgYmUgcmVhZHlcbiAgICAgKiBhdCB0aGF0IHRpbWUuICBGdXJ0aGVyLCB0aGUgZXZlbnQgd2lsbCBwcm92aWRlIGRldGFpbHMgb24gdGhlIHJlc3VsdDpcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqICAgICAgIHZhciBjaGFubmVsID0gY2xpZW50LmNyZWF0ZUNoYW5uZWwoe1xuICAgICAqICAgICAgICAgIG1lbWJlcnM6IFsnYScsICdiJ10sXG4gICAgICogICAgICAgICAgbmFtZTogJ3lldC1hbm90aGVyLWNoYW5uZWwtd2l0aC1tZXRhZGF0YScsXG4gICAgICogICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgKiAgICAgICAgICAgICAgICAgdG9waWNEZXRhaWxzOiAnSSBhbSBhIGRldGFpbCdcbiAgICAgKiAgICAgICAgICB9XG4gICAgICogICAgICAgfSk7XG4gICAgICogICAgICAgY2hhbm5lbC5vbignY2hhbm5lbHM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgICBzd2l0Y2goZXZ0LnJlc3VsdCkge1xuICAgICAqICAgICAgICAgICAgICAgY2FzZSBDaGFubmVsLkNSRUFURUQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY2hhbm5lbC5pZCArICcgd2FzIGNyZWF0ZWQnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ2hhbm5lbC5GT1VORDpcbiAgICAgKiAgICAgICAgICAgICAgICAgICBhbGVydChjaGFubmVsLmlkICsgJyB3YXMgZm91bmQnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ2hhbm5lbC5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQTpcbiAgICAgKiAgICAgICAgICAgICAgICAgICBhbGVydChjaGFubmVsLmlkICsgJyB3YXMgZm91bmQgYnV0IGl0IGFscmVhZHkgaGFzIGEgdG9waWNEZXRhaWxzIHNvIHlvdXIgcmVxdWVzdGVkIGRldGFpbCB3YXMgbm90IHNldCcpO1xuICAgICAqICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgfVxuICAgICAqICAgICAgIH0pO1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogV2FybmluZzogVGhpcyBtZXRob2Qgd2lsbCB0aHJvdyBhbiBlcnJvciBpZiBjYWxsZWQgd2hlbiB5b3UgYXJlIG5vdCAob3IgYXJlIG5vIGxvbmdlcikgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgICAqIFRoYXQgbWVhbnMgaWYgYXV0aGVudGljYXRpb24gaGFzIGV4cGlyZWQsIGFuZCB5b3UgaGF2ZSBub3QgeWV0IHJlYXV0aGVudGljYXRlZCB0aGUgdXNlciwgdGhpcyB3aWxsIHRocm93IGFuIGVycm9yLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGNyZWF0ZUNoYW5uZWxcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMubWVtYmVycyAtIEFycmF5IG9mIFVzZXJJRHMgb3IgVXNlcklkZW50aXRpZXNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIC0gVGhlIHVuaXF1ZSBuYW1lIGZvciB0aGlzIENoYW5uZWxcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGE9e31dIE1ldGFkYXRhIGZvciB5b3VyIENoYW5uZWxcbiAgICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfVxuICAgICAqL1xuICAgIGNyZWF0ZUNoYW5uZWwob3B0aW9ucykge1xuICAgICAgLy8gSWYgd2UgYXJlbid0IGF1dGhlbnRpY2F0ZWQsIHRoZW4gd2UgZG9uJ3QgeWV0IGhhdmUgYSBVc2VySUQsIGFuZCB3b24ndCBjcmVhdGUgdGhlIGNvcnJlY3QgQ2hhbm5lbFxuICAgICAgaWYgKCF0aGlzLmlzQXV0aGVudGljYXRlZCkgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5jbGllbnRNdXN0QmVSZWFkeSk7XG4gICAgICBpZiAoISgncHJpdmF0ZScgaW4gb3B0aW9ucykpIG9wdGlvbnMucHJpdmF0ZSA9IGZhbHNlO1xuICAgICAgb3B0aW9ucy5jbGllbnQgPSB0aGlzO1xuICAgICAgcmV0dXJuIENoYW5uZWwuY3JlYXRlKG9wdGlvbnMpO1xuICAgIH0sXG4gIH0sXG59O1xuIl19
