'use strict';

/* Feature is tested but not available on server
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWNoYW5uZWxzLmpzIl0sIm5hbWVzIjpbIkNoYW5uZWwiLCJyZXF1aXJlIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIm1vZHVsZSIsImV4cG9ydHMiLCJldmVudHMiLCJsaWZlY3ljbGUiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJfbW9kZWxzIiwiY2hhbm5lbHMiLCJjbGVhbnVwIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpZCIsImNoYW5uZWwiLCJpc0Rlc3Ryb3llZCIsImRlc3Ryb3kiLCJyZXNldCIsIm1ldGhvZHMiLCJnZXRDaGFubmVsIiwiY2FuTG9hZCIsIkVycm9yIiwiaWRQYXJhbVJlcXVpcmVkIiwibG9hZCIsIl9hZGRDaGFubmVsIiwiY2xpZW50SWQiLCJhcHBJZCIsIl90cmlnZ2VyQXN5bmMiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUiLCJfcmVtb3ZlQ2hhbm5lbCIsIm9mZiIsIm1lc3NhZ2VzIiwiY2hhbm5lbElkIiwiX3VwZGF0ZUNoYW5uZWxJZCIsIm9sZElkIiwiZmlsdGVyIiwiY29udmVyc2F0aW9uSWQiLCJmaW5kQ2FjaGVkQ2hhbm5lbCIsImZ1bmMiLCJjb250ZXh0IiwidGVzdCIsImJpbmQiLCJsaXN0IiwibGVuIiwibGVuZ3RoIiwiaW5kZXgiLCJrZXkiLCJjcmVhdGVDaGFubmVsIiwiaXNBdXRoZW50aWNhdGVkIiwiY2xpZW50TXVzdEJlUmVhZHkiLCJwcml2YXRlIiwiY2xpZW50IiwiY3JlYXRlIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxVQUFVQyxRQUFRLG1CQUFSLENBQWhCO0FBQ0EsSUFBTUMsa0JBQWtCRCxRQUFRLGdCQUFSLEVBQTBCRSxVQUFsRDs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxVQUFRO0FBQ047Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsZ0JBakJNOztBQW1CTjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztB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QUFNSSxPQUFPaEMsT0FBT0MsSUFBUCxDQUFZLEtBQUtKLE9BQUwsQ0FBYUMsUUFBekIsQ0FBYjtBQUNBLFVBQU1tQyxNQUFNRCxLQUFLRSxNQUFqQjtBQUNBLFdBQUssSUFBSUMsUUFBUSxDQUFqQixFQUFvQkEsUUFBUUYsR0FBNUIsRUFBaUNFLE9BQWpDLEVBQTBDO0FBQ3hDLFlBQU1DLE1BQU1KLEtBQUtHLEtBQUwsQ0FBWjtBQUNBLFlBQU0vQixVQUFVLEtBQUtQLE9BQUwsQ0FBYUMsUUFBYixDQUFzQnNDLEdBQXRCLENBQWhCO0FBQ0EsWUFBSU4sS0FBSzFCLE9BQUwsRUFBYytCLEtBQWQsQ0FBSixFQUEwQixPQUFPL0IsT0FBUDtBQUMzQjtBQUNELGFBQU8sSUFBUDtBQUNELEtBeEpNOzs7QUEwSlA7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUVBaUMsaUJBM05PLHlCQTJOT3pDLE9BM05QLEVBMk5nQjtBQUNyQjtBQUNBLFVBQUksQ0FBQyxLQUFLMEMsZUFBVixFQUEyQixNQUFNLElBQUkzQixLQUFKLENBQVV0QixnQkFBZ0JrRCxpQkFBMUIsQ0FBTjtBQUMzQixVQUFJLEVBQUUsYUFBYTNDLE9BQWYsQ0FBSixFQUE2QkEsUUFBUTRDLE9BQVIsR0FBa0IsS0FBbEI7QUFDN0I1QyxjQUFRNkMsTUFBUixHQUFpQixJQUFqQjtBQUNBLGFBQU90RCxRQUFRdUQsTUFBUixDQUFlOUMsT0FBZixDQUFQO0FBQ0Q7QUFqT007QUFoS00sQ0FBakIiLCJmaWxlIjoiY2xpZW50LWNoYW5uZWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogRmVhdHVyZSBpcyB0ZXN0ZWQgYnV0IG5vdCBhdmFpbGFibGUgb24gc2VydmVyXG4gKiBBZGRzIENoYW5uZWwgaGFuZGxpbmcgdG8gdGhlIGxheWVyLkNsaWVudC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIubWl4aW5zLkNsaWVudENoYW5uZWxzXG4gKi9cblxuY29uc3QgQ2hhbm5lbCA9IHJlcXVpcmUoJy4uL21vZGVscy9jaGFubmVsJyk7XG5jb25zdCBFcnJvckRpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpLmRpY3Rpb25hcnk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBldmVudHM6IFtcbiAgICAvKipcbiAgICAgKiBPbmUgb3IgbW9yZSBsYXllci5DaGFubmVsIG9iamVjdHMgaGF2ZSBiZWVuIGFkZGVkIHRvIHRoZSBjbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGV5IG1heSBoYXZlIGJlZW4gYWRkZWQgdmlhIHRoZSB3ZWJzb2NrZXQsIG9yIHZpYSB0aGUgdXNlciBjcmVhdGluZ1xuICAgICAqIGEgbmV3IENoYW5uZWwgbG9jYWxseS5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjaGFubmVsczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICBldnQuY2hhbm5lbHMuZm9yRWFjaChmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgICogICAgICAgICAgICAgIG15Vmlldy5hZGRDaGFubmVsKGNoYW5uZWwpO1xuICAgICAqICAgICAgICAgIH0pO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbFtdfSBldnQuY2hhbm5lbHMgLSBBcnJheSBvZiBjaGFubmVscyBhZGRlZFxuICAgICAqL1xuICAgICdjaGFubmVsczphZGQnLFxuXG4gICAgLyoqXG4gICAgICogT25lIG9yIG1vcmUgbGF5ZXIuQ2hhbm5lbCBvYmplY3RzIGhhdmUgYmVlbiByZW1vdmVkLlxuICAgICAqXG4gICAgICogQSByZW1vdmVkIENoYW5uZWwgaXMgbm90IG5lY2Vzc2FyaWx5IGRlbGV0ZWQsIGl0cyBqdXN0XG4gICAgICogbm8gbG9uZ2VyIGJlaW5nIGhlbGQgaW4gbG9jYWwgbWVtb3J5LlxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IHR5cGljYWxseSB5b3Ugd2lsbCB3YW50IHRoZSBjaGFubmVsczpkZWxldGUgZXZlbnRcbiAgICAgKiByYXRoZXIgdGhhbiBjaGFubmVsczpyZW1vdmUuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY2hhbm5lbHM6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgZXZ0LmNoYW5uZWxzLmZvckVhY2goZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVtb3ZlQ2hhbm5lbChjaGFubmVsKTtcbiAgICAgKiAgICAgICAgICB9KTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWxbXX0gZXZ0LmNoYW5uZWxzIC0gQXJyYXkgb2YgY2hhbm5lbHMgcmVtb3ZlZFxuICAgICAqL1xuICAgICdjaGFubmVsczpyZW1vdmUnLFxuXG4gICAgLyoqXG4gICAgICogQSBjaGFubmVsIGhhZCBhIGNoYW5nZSBpbiBpdHMgcHJvcGVydGllcy5cbiAgICAgKlxuICAgICAqIFRoaXMgY2hhbmdlIG1heSBoYXZlIGJlZW4gZGVsaXZlcmVkIGZyb20gYSByZW1vdGUgdXNlclxuICAgICAqIG9yIGFzIGEgcmVzdWx0IG9mIGEgbG9jYWwgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NoYW5uZWxzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHZhciBtZXRhZGF0YUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignbWV0YWRhdGEnKTtcbiAgICAgKiAgICAgICAgICB2YXIgcGFydGljaXBhbnRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ21lbWJlcnMnKTtcbiAgICAgKiAgICAgICAgICBpZiAobWV0YWRhdGFDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyVGl0bGUoZXZ0LnRhcmdldC5tZXRhZGF0YS50aXRsZSk7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgICAgIGlmIChwYXJ0aWNpcGFudENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJtZW1iZXJzKGV2dC50YXJnZXQubWVtYmVycyk7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBOT1RFOiBUeXBpY2FsbHkgc3VjaCByZW5kZXJpbmcgaXMgZG9uZSB1c2luZyBFdmVudHMgb24gbGF5ZXIuUXVlcnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbH0gZXZ0LnRhcmdldFxuICAgICAqIEBwYXJhbSB7T2JqZWN0W119IGV2dC5jaGFuZ2VzXG4gICAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5vbGRWYWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgaGFzIGNoYW5nZWRcbiAgICAgKi9cbiAgICAnY2hhbm5lbHM6Y2hhbmdlJyxcblxuICAgIC8qKlxuICAgICAqIEEgY2FsbCB0byBsYXllci5DaGFubmVsLmxvYWQgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHlcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5DaGFubmVsfSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2NoYW5uZWxzOmxvYWRlZCcsXG5cbiAgICAvKipcbiAgICAgKiBBIENoYW5uZWwgaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGxheWVyLkNoYW5uZWwuZGVsZXRlKCkgb24gdGhlIENoYW5uZWxcbiAgICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ2NoYW5uZWxzOmRlbGV0ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIG15Vmlldy5yZW1vdmVDaGFubmVsKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbH0gZXZ0LnRhcmdldFxuICAgICAqL1xuICAgICdjaGFubmVsczpkZWxldGUnLFxuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2hhbm5lbCBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqIENhbGxlZCBhZnRlciBjcmVhdGluZyB0aGUgY2hhbm5lbFxuICAgICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICAgKlxuICAgICAqICogbGF5ZXIuQ2hhbm5lbC5DUkVBVEVEOiBBIG5ldyBDaGFubmVsIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICAgKiAqIGxheWVyLkNoYW5uZWwuRk9VTkQ6IEEgbWF0Y2hpbmcgQ2hhbm5lbCBoYXMgYmVlbiBmb3VuZFxuICAgICAqXG4gICAgICogQWxsIG9mIHRoZXNlIHJlc3VsdHMgd2lsbCBhbHNvIG1lYW4gdGhhdCB0aGUgdXBkYXRlZCBwcm9wZXJ0eSB2YWx1ZXMgaGF2ZSBiZWVuXG4gICAgICogY29waWVkIGludG8geW91ciBDaGFubmVsIG9iamVjdC4gIFRoYXQgbWVhbnMgeW91ciBtZXRhZGF0YSBwcm9wZXJ0eSBtYXkgbm9cbiAgICAgKiBsb25nZXIgYmUgaXRzIGluaXRpYWwgdmFsdWU7IGl0IHdpbGwgYmUgdGhlIHZhbHVlIGZvdW5kIG9uIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiAgICAgIGNsaWVudC5vbignY2hhbm5lbHM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHN3aXRjaChldnQucmVzdWx0KSB7XG4gICAgICogICAgICAgICAgICAgIGNhc2UgQ2hhbm5lbC5DUkVBVEVEOlxuICAgICAqICAgICAgICAgICAgICAgICAgYWxlcnQoZXZ0LnRhcmdldC5pZCArICcgQ3JlYXRlZCEnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgICBjYXNlIENoYW5uZWwuRk9VTkQ6XG4gICAgICogICAgICAgICAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmlkICsgJyBGb3VuZCEnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5yZXN1bHRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWx9IHRhcmdldFxuICAgICAqL1xuICAgICdjaGFubmVsczpzZW50JyxcblxuICAgIC8qKlxuICAgICAqIEEgY2hhbm5lbCBmYWlsZWQgdG8gbG9hZCBvciBjcmVhdGUgb24gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdjaGFubmVsczpzZW50LWVycm9yJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgYWxlcnQoZXZ0LmRhdGEubWVzc2FnZSk7XG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZGF0YVxuICAgICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbH0gdGFyZ2V0XG4gICAgICovXG4gICAgJ2NoYW5uZWxzOnNlbnQtZXJyb3InLFxuICBdLFxuICBsaWZlY3ljbGU6IHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuY2hhbm5lbHMgPSB7fTtcbiAgICB9LFxuICAgIGNsZWFudXAoKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMuY2hhbm5lbHMpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSB0aGlzLl9tb2RlbHMuY2hhbm5lbHNbaWRdO1xuICAgICAgICBpZiAoY2hhbm5lbCAmJiAhY2hhbm5lbC5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIGNoYW5uZWwuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX21vZGVscy5jaGFubmVscyA9IG51bGw7XG4gICAgfSxcblxuICAgIHJlc2V0KCkge1xuICAgICAgdGhpcy5fbW9kZWxzLmNoYW5uZWxzID0ge307XG4gICAgfSxcblxuICB9LFxuICBtZXRob2RzOiB7XG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYSBjaGFubmVsIGJ5IElkZW50aWZpZXIuXG4gICAgICpcbiAgICAgKiAgICAgIHZhciBjID0gY2xpZW50LmdldENoYW5uZWwoJ2xheWVyOi8vL2NoYW5uZWxzL3V1aWQnKTtcbiAgICAgKlxuICAgICAqIElmIHRoZXJlIGlzIG5vdCBhIGNoYW5uZWwgd2l0aCB0aGF0IGlkLCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogSWYgeW91IHdhbnQgaXQgdG8gbG9hZCBpdCBmcm9tIGNhY2hlIGFuZCB0aGVuIGZyb20gc2VydmVyIGlmIG5vdCBpbiBjYWNoZSwgdXNlIHRoZSBgY2FuTG9hZGAgcGFyYW1ldGVyLlxuICAgICAqIElmIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLCB0aGUgbWV0aG9kIHdpbGwgcmV0dXJuXG4gICAgICogYSBsYXllci5DaGFubmVsIGluc3RhbmNlIHRoYXQgaGFzIG5vIGRhdGE7IHRoZSBgY2hhbm5lbHM6bG9hZGVkYCAvIGBjaGFubmVsczpsb2FkZWQtZXJyb3JgIGV2ZW50c1xuICAgICAqIHdpbGwgbGV0IHlvdSBrbm93IHdoZW4gdGhlIGNoYW5uZWwgaGFzIGZpbmlzaGVkL2ZhaWxlZCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgdmFyIGMgPSBjbGllbnQuZ2V0Q2hhbm5lbCgnbGF5ZXI6Ly8vY2hhbm5lbHMvMTIzJywgdHJ1ZSlcbiAgICAgKiAgICAgIC5vbignY2hhbm5lbHM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSBDaGFubmVsIHdpdGggYWxsIG9mIGl0cyBkZXRhaWxzIGxvYWRlZFxuICAgICAqICAgICAgICAgIG15cmVyZW5kZXIoYyk7XG4gICAgICogICAgICB9KTtcbiAgICAgKiAgICAgIC8vIFJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBjIHVudGlsIHRoZSBkZXRhaWxzIG9mIGMgaGF2ZSBsb2FkZWRcbiAgICAgKiAgICAgIG15cmVuZGVyKGMpO1xuICAgICAqXG4gICAgICogTm90ZSBpbiB0aGUgYWJvdmUgZXhhbXBsZSB0aGF0IHRoZSBgY2hhbm5lbHM6bG9hZGVkYCBldmVudCB3aWxsIHRyaWdnZXIgZXZlbiBpZiB0aGUgQ2hhbm5lbCBoYXMgcHJldmlvdXNseSBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGdldENoYW5uZWxcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAgICogQHBhcmFtICB7Ym9vbGVhbn0gW2NhbkxvYWQ9ZmFsc2VdIC0gUGFzcyB0cnVlIHRvIGFsbG93IGxvYWRpbmcgYSBjaGFubmVsIGZyb21cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH1cbiAgICAgKi9cbiAgICBnZXRDaGFubmVsKGlkLCBjYW5Mb2FkKSB7XG4gICAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgICAgaWYgKHRoaXMuX21vZGVscy5jaGFubmVsc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5jaGFubmVsc1tpZF07XG4gICAgICB9IGVsc2UgaWYgKGNhbkxvYWQpIHtcbiAgICAgICAgcmV0dXJuIENoYW5uZWwubG9hZChpZCwgdGhpcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNoYW5uZWwgdG8gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfYWRkQ2hhbm5lbCBmb3IgeW91OlxuICAgICAqXG4gICAgICogICAgICB2YXIgY29udiA9IG5ldyBsYXllci5DaGFubmVsKHtcbiAgICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICAgKiAgICAgICAgICBtZW1iZXJzOiBbJ2EnLCAnYiddXG4gICAgICogICAgICB9KTtcbiAgICAgKlxuICAgICAqICAgICAgLy8gT1I6XG4gICAgICogICAgICB2YXIgY29udiA9IGNsaWVudC5jcmVhdGVDaGFubmVsKFsnYScsICdiJ10pO1xuICAgICAqXG4gICAgICogQG1ldGhvZCBfYWRkQ2hhbm5lbFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5DaGFubmVsfSBjXG4gICAgICovXG4gICAgX2FkZENoYW5uZWwoY2hhbm5lbCkge1xuICAgICAgY29uc3QgaWQgPSBjaGFubmVsLmlkO1xuICAgICAgaWYgKCF0aGlzLl9tb2RlbHMuY2hhbm5lbHNbaWRdKSB7XG4gICAgICAgIC8vIFJlZ2lzdGVyIHRoZSBDaGFubmVsXG4gICAgICAgIHRoaXMuX21vZGVscy5jaGFubmVsc1tpZF0gPSBjaGFubmVsO1xuXG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgY2xpZW50IGlzIHNldCBzbyB0aGF0IHRoZSBuZXh0IGV2ZW50IGJ1YmJsZXMgdXBcbiAgICAgICAgaWYgKGNoYW5uZWwuY2xpZW50SWQgIT09IHRoaXMuYXBwSWQpIGNoYW5uZWwuY2xpZW50SWQgPSB0aGlzLmFwcElkO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NoYW5uZWxzOmFkZCcsIHsgY2hhbm5lbHM6IFtjaGFubmVsXSB9KTtcblxuICAgICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZShjaGFubmVsKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNoYW5uZWwgZnJvbSB0aGUgY2xpZW50LlxuICAgICAqXG4gICAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgZm9sbG93aW5nIGNvZGVcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGNhbGxzIF9yZW1vdmVDaGFubmVsIGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIGNoYW5uZWwuZGVzdHJveSgpO1xuICAgICAqXG4gICAgICogQG1ldGhvZCBfcmVtb3ZlQ2hhbm5lbFxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5DaGFubmVsfSBjXG4gICAgICovXG4gICAgX3JlbW92ZUNoYW5uZWwoY2hhbm5lbCkge1xuICAgICAgLy8gSW5zdXJlIHdlIGRvIG5vdCBnZXQgYW55IGV2ZW50cywgc3VjaCBhcyBtZXNzYWdlOnJlbW92ZVxuICAgICAgY2hhbm5lbC5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG5cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuY2hhbm5lbHNbY2hhbm5lbC5pZF0pIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX21vZGVscy5jaGFubmVsc1tjaGFubmVsLmlkXTtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjaGFubmVsczpyZW1vdmUnLCB7IGNoYW5uZWxzOiBbY2hhbm5lbF0gfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBhbnkgTWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBDaGFubmVsXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMubWVzc2FnZXMpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbHMubWVzc2FnZXNbaWRdLmNoYW5uZWxJZCA9PT0gY2hhbm5lbC5pZCkge1xuICAgICAgICAgIHRoaXMuX21vZGVscy5tZXNzYWdlc1tpZF0uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIENoYW5uZWwgSUQgY2hhbmdlcywgd2UgbmVlZCB0byByZXJlZ2lzdGVyIHRoZSBDaGFubmVsXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF91cGRhdGVDaGFubmVsSWRcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuQ2hhbm5lbH0gY2hhbm5lbCAtIENoYW5uZWwgd2hvc2UgSUQgaGFzIGNoYW5nZWRcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9sZElkIC0gUHJldmlvdXMgSURcbiAgICAgKi9cbiAgICBfdXBkYXRlQ2hhbm5lbElkKGNoYW5uZWwsIG9sZElkKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmNoYW5uZWxzW29sZElkXSkge1xuICAgICAgICB0aGlzLl9tb2RlbHMuY2hhbm5lbHNbY2hhbm5lbC5pZF0gPSBjaGFubmVsO1xuICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWxzLmNoYW5uZWxzW29sZElkXTtcblxuICAgICAgICAvLyBUaGlzIGlzIGEgbmFzdHkgd2F5IHRvIHdvcmsuLi4gYnV0IG5lZWQgdG8gZmluZCBhbmQgdXBkYXRlIGFsbFxuICAgICAgICAvLyBjaGFubmVsSWQgcHJvcGVydGllcyBvZiBhbGwgTWVzc2FnZXMgb3IgdGhlIFF1ZXJ5J3Mgd29uJ3RcbiAgICAgICAgLy8gc2VlIHRoZXNlIGFzIG1hdGNoaW5nIHRoZSBxdWVyeS5cbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLm1lc3NhZ2VzKVxuICAgICAgICAgICAgICAuZmlsdGVyKGlkID0+IHRoaXMuX21vZGVscy5tZXNzYWdlc1tpZF0uY29udmVyc2F0aW9uSWQgPT09IG9sZElkKVxuICAgICAgICAgICAgICAuZm9yRWFjaChpZCA9PiAodGhpcy5fbW9kZWxzLm1lc3NhZ2VzW2lkXS5jb252ZXJzYXRpb25JZCA9IGNoYW5uZWwuaWQpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgbG9jYWxseSBjYWNoZWQgY2hhbm5lbHMgZm9yIGEgbWF0Y2hpbmcgY2hhbm5lbC5cbiAgICAgKlxuICAgICAqIEl0ZXJhdGVzIG92ZXIgY2hhbm5lbHMgY2FsbGluZyBhIG1hdGNoaW5nIGZ1bmN0aW9uIHVudGlsXG4gICAgICogdGhlIGNoYW5uZWwgaXMgZm91bmQgb3IgYWxsIGNoYW5uZWxzIHRlc3RlZC5cbiAgICAgKlxuICAgICAqICAgICAgdmFyIGMgPSBjbGllbnQuZmluZENhY2hlZENoYW5uZWwoZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAqICAgICAgICAgIGlmIChjaGFubmVsLnBhcnRpY2lwYW50cy5pbmRleE9mKCdhJykgIT0gLTEpIHJldHVybiB0cnVlO1xuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGZpbmRDYWNoZWRDaGFubmVsXG4gICAgICogQHBhcmFtICB7RnVuY3Rpb259IGYgLSBGdW5jdGlvbiB0byBjYWxsIHVudGlsIHdlIGZpbmQgYSBtYXRjaFxuICAgICAqIEBwYXJhbSAge2xheWVyLkNoYW5uZWx9IGYuY2hhbm5lbCAtIEEgY2hhbm5lbCB0byB0ZXN0XG4gICAgICogQHBhcmFtICB7Ym9vbGVhbn0gZi5yZXR1cm4gLSBSZXR1cm4gdHJ1ZSBpZiB0aGUgY2hhbm5lbCBpcyBhIG1hdGNoXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgKnRoaXMqIG9iamVjdFxuICAgICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9XG4gICAgICpcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIFRoaXMgc2hvdWxkIGJlIHJlcGxhY2VkIGJ5IGl0ZXJhdGluZyBvdmVyIHlvdXIgbGF5ZXIuUXVlcnkgZGF0YS5cbiAgICAgKi9cbiAgICBmaW5kQ2FjaGVkQ2hhbm5lbChmdW5jLCBjb250ZXh0KSB7XG4gICAgICBjb25zdCB0ZXN0ID0gY29udGV4dCA/IGZ1bmMuYmluZChjb250ZXh0KSA6IGZ1bmM7XG4gICAgICBjb25zdCBsaXN0ID0gT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLmNoYW5uZWxzKTtcbiAgICAgIGNvbnN0IGxlbiA9IGxpc3QubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxlbjsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBrZXkgPSBsaXN0W2luZGV4XTtcbiAgICAgICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuX21vZGVscy5jaGFubmVsc1trZXldO1xuICAgICAgICBpZiAodGVzdChjaGFubmVsLCBpbmRleCkpIHJldHVybiBjaGFubmVsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIGlzIHJlY29tbWVuZGVkIHdheSB0byBjcmVhdGUgYSBDaGFubmVsLlxuICAgICAqXG4gICAgICogYGBgXG4gICAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ2hhbm5lbCh7XG4gICAgICogICAgICAgICAgICAgbWVtYmVyczogWydsYXllcjovLy9pZGVudGl0aWVzL2EnLCAnbGF5ZXI6Ly8vaWRlbnRpdGllcy9iJ10sXG4gICAgICogICAgICAgICAgICAgbmFtZTogJ2EtY2hhbm5lbCdcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICAgICAgY2xpZW50LmNyZWF0ZUNoYW5uZWwoe1xuICAgICAqICAgICAgICAgICAgIG1lbWJlcnM6IFt1c2VySWRlbnRpdHlPYmplY3RBLCB1c2VySWRlbnRpdHlPYmplY3RCXSxcbiAgICAgKiAgICAgICAgICAgICBuYW1lOiAnYW5vdGhlci1jaGFubmVsJ1xuICAgICAqICAgICAgICAgfSk7XG4gICAgICpcbiAgICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDaGFubmVsKHtcbiAgICAgKiAgICAgICAgICAgICBtZW1iZXJzOiBbJ2xheWVyOi8vL2lkZW50aXRpZXMvYScsICdsYXllcjovLy9pZGVudGl0aWVzL2InXSxcbiAgICAgKiAgICAgICAgICAgICBuYW1lOiAnYS1jaGFubmVsLXdpdGgtbWV0YWRhdGEnLFxuICAgICAqICAgICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICogICAgICAgICAgICAgICAgIHRvcGljRGV0YWlsczogJ0kgYW0gYSBkZXRhaWwnXG4gICAgICogICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgfSk7XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBJZiB5b3UgdHJ5IHRvIGNyZWF0ZSBhIENoYW5uZWwgd2l0aCBhIG5hbWUgdGhhdCBhbHJlYWR5IGV4aXN0cyxcbiAgICAgKiB5b3Ugd2lsbCBnZXQgYmFjayBhbiBleGlzdGluZyBDaGFubmVsLCBhbmQgYW55IHJlcXVlc3RlZCBtZXRhZGF0YSBhbmQgbWVtYmVyc1xuICAgICAqIHdpbGwgTk9UIGJlIHNldDsgeW91IHdpbGwgZ2V0IHdoYXRldmVyIG1ldGFkYXRhIHRoZSBtYXRjaGluZyBDb252ZXJzYXRpb25cbiAgICAgKiBhbHJlYWR5IGhhZCwgYW5kIG5vIG1lbWJlcnMgd2lsbCBiZSBhZGRlZC9yZW1vdmVkLlxuICAgICAqXG4gICAgICogV2hldGhlciB0aGUgQ2hhbm5lbCBhbHJlYWR5IGV4aXN0cyBvciBub3QsIGEgJ2NoYW5uZWxzOnNlbnQnIGV2ZW50XG4gICAgICogd2lsbCBiZSB0cmlnZ2VyZWQgYXN5bmNocm9ub3VzbHkgYW5kIHRoZSBDaGFubmVsIG9iamVjdCB3aWxsIGJlIHJlYWR5XG4gICAgICogYXQgdGhhdCB0aW1lLiAgRnVydGhlciwgdGhlIGV2ZW50IHdpbGwgcHJvdmlkZSBkZXRhaWxzIG9uIHRoZSByZXN1bHQ6XG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiAgICAgICB2YXIgY2hhbm5lbCA9IGNsaWVudC5jcmVhdGVDaGFubmVsKHtcbiAgICAgKiAgICAgICAgICBtZW1iZXJzOiBbJ2EnLCAnYiddLFxuICAgICAqICAgICAgICAgIG5hbWU6ICd5ZXQtYW5vdGhlci1jaGFubmVsLXdpdGgtbWV0YWRhdGEnLFxuICAgICAqICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICogICAgICAgICAgICAgICAgIHRvcGljRGV0YWlsczogJ0kgYW0gYSBkZXRhaWwnXG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgIH0pO1xuICAgICAqICAgICAgIGNoYW5uZWwub24oJ2NoYW5uZWxzOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgKiAgICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICAgKiAgICAgICAgICAgICAgIGNhc2UgQ2hhbm5lbC5DUkVBVEVEOlxuICAgICAqICAgICAgICAgICAgICAgICAgIGFsZXJ0KGNoYW5uZWwuaWQgKyAnIHdhcyBjcmVhdGVkJyk7XG4gICAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgICAgICBjYXNlIENoYW5uZWwuRk9VTkQ6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY2hhbm5lbC5pZCArICcgd2FzIGZvdW5kJyk7XG4gICAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICogICAgICAgICAgICAgICBjYXNlIENoYW5uZWwuRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEE6XG4gICAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY2hhbm5lbC5pZCArICcgd2FzIGZvdW5kIGJ1dCBpdCBhbHJlYWR5IGhhcyBhIHRvcGljRGV0YWlscyBzbyB5b3VyIHJlcXVlc3RlZCBkZXRhaWwgd2FzIG5vdCBzZXQnKTtcbiAgICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgIH1cbiAgICAgKiAgICAgICB9KTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIFdhcm5pbmc6IFRoaXMgbWV0aG9kIHdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgY2FsbGVkIHdoZW4geW91IGFyZSBub3QgKG9yIGFyZSBubyBsb25nZXIpIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICAgKiBUaGF0IG1lYW5zIGlmIGF1dGhlbnRpY2F0aW9uIGhhcyBleHBpcmVkLCBhbmQgeW91IGhhdmUgbm90IHlldCByZWF1dGhlbnRpY2F0ZWQgdGhlIHVzZXIsIHRoaXMgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAgICAgKlxuICAgICAqXG4gICAgICogQG1ldGhvZCBjcmVhdGVDaGFubmVsXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBvcHRpb25zLm1lbWJlcnMgLSBBcnJheSBvZiBVc2VySURzIG9yIFVzZXJJZGVudGl0aWVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMubmFtZSAtIFRoZSB1bmlxdWUgbmFtZSBmb3IgdGhpcyBDaGFubmVsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhPXt9XSBNZXRhZGF0YSBmb3IgeW91ciBDaGFubmVsXG4gICAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH1cbiAgICAgKi9cbiAgICBjcmVhdGVDaGFubmVsKG9wdGlvbnMpIHtcbiAgICAgIC8vIElmIHdlIGFyZW4ndCBhdXRoZW50aWNhdGVkLCB0aGVuIHdlIGRvbid0IHlldCBoYXZlIGEgVXNlcklELCBhbmQgd29uJ3QgY3JlYXRlIHRoZSBjb3JyZWN0IENoYW5uZWxcbiAgICAgIGlmICghdGhpcy5pc0F1dGhlbnRpY2F0ZWQpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuY2xpZW50TXVzdEJlUmVhZHkpO1xuICAgICAgaWYgKCEoJ3ByaXZhdGUnIGluIG9wdGlvbnMpKSBvcHRpb25zLnByaXZhdGUgPSBmYWxzZTtcbiAgICAgIG9wdGlvbnMuY2xpZW50ID0gdGhpcztcbiAgICAgIHJldHVybiBDaGFubmVsLmNyZWF0ZShvcHRpb25zKTtcbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
