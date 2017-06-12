'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* Feature is tested but not available on server
 * A Channel object represents a dialog amongst a large set
 * of participants.
 *
 * ```
 * var channel = client.createChannel({
 *   name: "frodo-the-dodo",
 *   members: ["layer:///identities/samwise", "layer:///identities/orc-army"],
 *   metadata: {
 *     subtopic: "Sauruman is the man.  And a Saurian",
 *     tooMuchInfo: {
 *       nose: "stuffed"
 *     }
 *   }
 * });
 *
 * channel.createMessage("Please don't eat me").send();
 * ```
 * NOTE: Sending a Message creates the Channel; this avoids having lots of unused channels being created.
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Channel.id: this property is worth being familiar with; it identifies the
 *   Channel and can be used in `client.getChannel(id)` to retrieve it.
 * * layer.Channel.name: this property names the channel; this may be human readable, though for localization purposes,
 *   you may instead want to use a common name that is distinct from your displayed name.  There can only be a single
 *   channel with a given name per app.
 * * layer.Channel.membership: Contains status information about your user's role in this Channel.
 * * layer.Channel.isCurrentParticipant: Shorthand for determining if your user is a member of the Channel.
 *
 * Methods:
 *
 * * layer.Channel.join() to join the Channel
 * * layer.Channel.leave() to leave the Channel
 * * layer.Channel.on() and layer.Channel.off(): event listeners built on top of the `backbone-events-standalone` npm project
 * * layer.Channel.createMessage() to send a message on the Channel.
 *
 * Events:
 *
 * * `channels:change`: Useful for observing changes to Channel name
 *   and updating rendering of your Channel
 *
 * Finally, to access a list of Messages in a Channel, see layer.Query.
 *
 * @class  layer.Channel
 * @extends layer.Container
 * @author  Michael Kantor
 */

var Root = require('../root');
var Syncable = require('./syncable');
var Container = require('./container');
var ChannelMessage = require('./channel-message');
var LayerError = require('../layer-error');
var LayerEvent = require('../layer-event');
var Util = require('../client-utils');
var Constants = require('../const');

var Channel = function (_Container) {
  _inherits(Channel, _Container);

  function Channel() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Channel);

    // Setup default values
    if (!options.membership) options.membership = {};

    var _this = _possibleConstructorReturn(this, (Channel.__proto__ || Object.getPrototypeOf(Channel)).call(this, options));

    _this._members = _this.getClient()._fixIdentities(options.members || []).map(function (item) {
      return item.id;
    });
    _this._register();
    return _this;
  }

  /**
   * Destroy the local copy of this Channel, cleaning up all resources
   * it consumes.
   *
   * @method destroy
   */


  _createClass(Channel, [{
    key: 'destroy',
    value: function destroy() {
      this.lastMessage = null;
      this.getClient()._removeChannel(this);
      _get(Channel.prototype.__proto__ || Object.getPrototypeOf(Channel.prototype), 'destroy', this).call(this);
      this.membership = null;
    }

    /**
     * Create a new layer.Message.ChannelMessage instance within this conversation
     *
     *      var message = channel.createMessage('hello');
     *
     *      var message = channel.createMessage({
     *          parts: [new layer.MessagePart({
     *                      body: 'hello',
     *                      mimeType: 'text/plain'
     *                  })]
     *      });
     *
     * See layer.Message.ChannelMessage for more options for creating the message.
     *
     * @method createMessage
     * @param  {String|Object} options - If its a string, a MessagePart is created around that string.
     * @param {layer.MessagePart[]} options.parts - An array of MessageParts.  There is some tolerance for
     *                                               it not being an array, or for it being a string to be turned
     *                                               into a MessagePart.
     * @return {layer.Message.ChannelMessage}
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

      return new ChannelMessage(messageConfig);
    }

    /**
     * Create this Conversation on the server.
     *
     * Called my layer.Message.send to insure its Conversation exists
     * on the server.
     *
     * @method send
     * @param {layer.Message.ChannelMessage} [message] Tells the Conversation what its last_message will be
     * @return {layer.Conversation} this
     */

  }, {
    key: 'send',
    value: function send(message) {
      // Conversations can just check the lastMessage position and increment it.
      // Channels must do a hackier calculation that sets the next position to a number larger than the server
      // could ever deliver, and then increment that floating point position by a large enough increment
      // that we need not worry about Floating point rounding errors.  Lots of guesswork here.
      if (message) {
        message.position = Channel.nextPosition;
        Channel.nextPosition += 8192;
      }
      return _get(Channel.prototype.__proto__ || Object.getPrototypeOf(Channel.prototype), 'send', this).call(this, message);
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
      var members = this._members || [];
      if (members.indexOf(this.getClient().user.id) === -1) members.push(this.getClient().user.id);
      return {
        method: 'Channel.create',
        data: {
          name: this.name,
          metadata: isMetadataEmpty ? null : this.metadata,
          id: this.id,
          members: members
        }
      };
    }
  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(channel) {
      // Disable events if creating a new Conversation
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;
      this.name = channel.name;

      this.isCurrentParticipant = Boolean(channel.membership);
      this.membership = !channel.membership || !channel.membership.id ? null : this.getClient()._createObject(channel.membership);

      _get(Channel.prototype.__proto__ || Object.getPrototypeOf(Channel.prototype), '_populateFromServer', this).call(this, channel);
      this._register();

      this._disableEvents = false;
    }
  }, {
    key: '_createResultConflict',
    value: function _createResultConflict(data) {
      this._createSuccess(data.data);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the name property will call this method and fire a
     * change event.
     *
     * @method __updateName
     * @private
     * @param  {string} newValue
     * @param  {string} oldValue
     */

  }, {
    key: '__updateName',
    value: function __updateName(newValue, oldValue) {
      if (this._inLayerParser) return;
      this._triggerAsync('channels:change', {
        property: 'name',
        oldValue: oldValue,
        newValue: newValue
      });
    }

    /**
     * Add the following members to the Channel.
     *
     * Unlike Conversations, Channels do not maintain state information about their members.
     * As such, if the operation fails there is no actual state change
     * for the channel.  Currently the only errors exposed are from the layer.Client.SyncManager.
     *
     * @method addMembers
     * @param {String[]} members   Identity IDs of users to add to this Channel
     * @return {layer.Channel} this
     *
     *
     *
     *
     *
     * @ignore until server supports it
     */

  }, {
    key: 'addMembers',
    value: function addMembers(members) {
      var _this2 = this;

      members = this.getClient()._fixIdentities(members).map(function (item) {
        return item.id;
      });
      if (this.syncState === Constants.SYNC_STATE.NEW) {
        this._members = this._members.concat(members);
        return this;
      }

      // TODO: Should use the bulk operation when it becomes available.
      members.forEach(function (identityId) {
        _this2._xhr({
          url: '/members/' + identityId.replace(/^layer:\/\/\/identities\//, ''),
          method: 'PUT'
        });
      });
      return this;
    }

    /**
     * Remove the following members from the Channel.
     *
     * Not yet supported.
     *
     * @method removeMembers
     * @param {String[]} members   Identity IDs of users to remove from this Channel
     * @return {layer.Channel} this
     *
     *
     *
     *
     *
     * @ignore until server supports it
     */

  }, {
    key: 'removeMembers',
    value: function removeMembers(members) {
      var _this3 = this;

      members = this.getClient()._fixIdentities(members).map(function (item) {
        return item.id;
      });

      if (this.syncState === Constants.SYNC_STATE.NEW) {
        members.forEach(function (id) {
          var index = _this3._members.indexOf(id);
          if (index !== -1) _this3._members.splice(index, 1);
        });
        return this;
      }

      // TODO: Should use the bulk operation when it becomes available.
      members.forEach(function (identityId) {
        _this3._xhr({
          url: '/members/' + identityId.replace(/^layer:\/\/\/identities\//, ''),
          method: 'DELETE'
        });
      });
      return this;
    }

    /**
     * Add the current user to this channel.
     *
     * @method join
     * @return {layer.Channel} this
     *
     *
     *
     *
     *
     * @ignore until server supports it
     */

  }, {
    key: 'join',
    value: function join() {
      return this.addMembers([this.getClient().user.id]);
    }

    /**
     * remove the current user from this channel.
     *
     * @method leave
     * @return {layer.Channel} this
     *
     *
     *
     *
     * @ignore until server supports it
     */

  }, {
    key: 'leave',
    value: function leave() {
      return this.removeMembers([this.getClient().user.id]);
    }

    /**
     * Return a Membership object for the specified Identity ID.
     *
     * If `members:loaded` is triggered, then your membership object
     * has been populated with data.
     *
     * If `members:loaded-error` is triggered, then your membership object
     * could not be loaded, either you have a connection error, or the user is not a member.
     *
     * ```
     * var membership = channel.getMember('FrodoTheDodo');
     * membership.on('membership:loaded', function(evt) {
     *    alert('He IS a member, quick, kick him out!');
     * });
     * membership.on('membership:loaded-error', function(evt) {
     *    if (evt.error.id === 'not_found') {
     *      alert('Sauruman, he is with the Elves!');
     *    } else {
     *      alert('Sauruman, would you please pick up your Palantir already? I can't connect!');
     *    }
     * });
     * ```
     * @method getMember
     * @param {String} identityId
     * @returns {layer.Membership}
     */

  }, {
    key: 'getMember',
    value: function getMember(identityId) {
      identityId = this.getClient()._fixIdentities([identityId])[0].id;
      var membershipId = this.id + '/members/' + identityId.replace(/layer:\/\/\/identities\//, '');
      return this.getClient().getMember(membershipId, true);
    }

    /**
     * Delete the channel; not currently supported.
     *
     * @method delete
     */

  }, {
    key: 'delete',
    value: function _delete() {
      this._delete('');
    }

    /**
     * Register this Channel with the Client
     *
     * @method _register
     * @private
     */

  }, {
    key: '_register',
    value: function _register() {
      var client = this.getClient();
      client._addChannel(this);
    }
  }, {
    key: '_deleteResult',
    value: function _deleteResult(result, id) {
      var client = this.getClient();
      if (!result.success && (!result.data || result.data.id !== 'not_found')) Channel.load(id, client);
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Conversation instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Channel.prototype.__proto__ || Object.getPrototypeOf(Channel.prototype), 'toObject', this).call(this);
        this._toObject.membership = Util.clone(this.membership);
      }
      return this._toObject;
    }

    /**
     * Create a channel instance from a server representation of the channel.
     *
     * If the Channel already exists, will update the existing copy with
     * presumably newer values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} channel - Server representation of a Channel
     * @param  {layer.Client} client
     * @return {layer.Channel}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(channel, client) {
      return new Channel({
        client: client,
        fromServer: channel,
        _fromDB: channel._fromDB
      });
    }

    /**
     * Find or create a new Channel.
     *
     *      var channel = layer.Channel.create({
     *          members: ['a', 'b'],
     *          private: true,
     *          metadata: {
     *              titleDetails: 'I am not a detail!'
     *          },
     *          client: client,
     *          'channels:loaded': function(evt) {
     *
     *          }
     *      });
     *
     * Recommend using `client.createChannel({...})`
     * instead of `Channel.create({...})`.
     *
     * @method create
     * @static
     * @protected
     * @param  {Object} options
     * @param  {layer.Client} options.client
     * @param  {string[]/layer.Identity[]} options.members - Array of Participant IDs or layer.Identity objects to create a channel with.
     * @param {boolean} [options.private=false] - Create a private channel
     * @param {Object} [options.metadata={}] - Initial metadata for Channel
     * @return {layer.Channel}
     */

  }, {
    key: 'create',
    value: function create(options) {
      if (!options.client) throw new Error(LayerError.dictionary.clientMissing);
      if (!options.name) options.name = 'channel-' + String(Math.random()).replace(/\./, '');
      var newOptions = {
        name: options.name,
        private: options.private,
        members: options.members ? options.client._fixIdentities(options.members).map(function (item) {
          return item.id;
        }) : [],
        metadata: options.metadata,
        client: options.client
      };

      var channel = options.client.findCachedChannel(function (aChannel) {
        return aChannel.name === newOptions.name;
      });

      if (channel) {
        channel._sendDistinctEvent = new LayerEvent({
          target: channel,
          result: !options.metadata || Util.doesObjectMatch(options.metadata, channel.metadata) ? Channel.FOUND : Channel.FOUND_WITHOUT_REQUESTED_METADATA
        }, 'channels:sent');
      }

      return channel || new Channel(newOptions);
    }
  }]);

  return Channel;
}(Container);

/**
 * The Channel's name; this must be unique.
 *
 * Note that while you can use a displayable human readable name, you may also choose to use this
 * as an ID that you can easily localize to different languages.
 *
 * Must not be a UUID.
 *
 * @property {String} name
 */


Channel.prototype.name = '';

/**
 * The `membership` object contains details of this user's membership within this channel.
 *
 * NOTE: Initially, only `isMember` will be available.
 *
 * ```
 * {
 *     "isMember": true,
 *     "role": "user",
 *     "lastUnreadMessageId: "layer:///messages/UUID"
 * }
 * ```
 * @property {Object}
 */
Channel.prototype.membership = null;

Channel.prototype._members = null;

Channel.eventPrefix = 'channels';

// Math.pow(2, 64); a number larger than Number.MAX_SAFE_INTEGER, and larger than Java's Max Unsigned Long. And an easy to work with
// factor of 2
Channel.nextPosition = 18446744073709552000;

/**
 * Prefix to use when generating an ID for instances of this class
 * @type {String}
 * @static
 * @private
 */
Channel.prefixUUID = 'layer:///channels/';

Channel._supportedEvents = [

/**
 * The conversation is now on the server.
 *
 * Called after successfully creating the conversation
 * on the server.  The Result property is one of:
 *
 * * Channel.CREATED: A new Channel has been created
 * * Channel.FOUND: A matching named Channel has been found
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 */
'channels:sent',

/**
 * An attempt to send this channel to the server has failed.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'channels:sent-error',

/**
 * The conversation is now loaded from the server.
 *
 * Note that this is only used in response to the layer.Channel.load() method.
 * from the server.
 * @event
 * @param {layer.LayerEvent} event
 */
'channels:loaded',

/**
 * An attempt to load this conversation from the server has failed.
 *
 * Note that this is only used in response to the layer.Channel.load() method.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'channels:loaded-error',

/**
 * The conversation has been deleted from the server.
 *
 * Caused by either a successful call to delete() on this instance
 * or by a remote user.
 * @event
 * @param {layer.LayerEvent} event
 */
'channels:delete',

/**
 * This channel has changed.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {Object[]} event.changes - Array of changes reported by this event
 * @param {Mixed} event.changes.newValue
 * @param {Mixed} event.changes.oldValue
 * @param {string} event.changes.property - Name of the property that changed
 * @param {layer.Conversation} event.target
 */
'channels:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Channel, [Channel, 'Channel']);
Syncable.subclasses.push(Channel);
module.exports = Channel;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY2hhbm5lbC5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlN5bmNhYmxlIiwiQ29udGFpbmVyIiwiQ2hhbm5lbE1lc3NhZ2UiLCJMYXllckVycm9yIiwiTGF5ZXJFdmVudCIsIlV0aWwiLCJDb25zdGFudHMiLCJDaGFubmVsIiwib3B0aW9ucyIsIm1lbWJlcnNoaXAiLCJfbWVtYmVycyIsImdldENsaWVudCIsIl9maXhJZGVudGl0aWVzIiwibWVtYmVycyIsIm1hcCIsIml0ZW0iLCJpZCIsIl9yZWdpc3RlciIsImxhc3RNZXNzYWdlIiwiX3JlbW92ZUNoYW5uZWwiLCJtZXNzYWdlQ29uZmlnIiwicGFydHMiLCJib2R5IiwibWltZVR5cGUiLCJjbGllbnRJZCIsImNvbnZlcnNhdGlvbklkIiwibWVzc2FnZSIsInBvc2l0aW9uIiwibmV4dFBvc2l0aW9uIiwiZGF0YSIsImlzTWV0YWRhdGFFbXB0eSIsImlzRW1wdHkiLCJtZXRhZGF0YSIsImluZGV4T2YiLCJ1c2VyIiwicHVzaCIsIm1ldGhvZCIsIm5hbWUiLCJjaGFubmVsIiwiX2Rpc2FibGVFdmVudHMiLCJzeW5jU3RhdGUiLCJTWU5DX1NUQVRFIiwiTkVXIiwiaXNDdXJyZW50UGFydGljaXBhbnQiLCJCb29sZWFuIiwiX2NyZWF0ZU9iamVjdCIsIl9jcmVhdGVTdWNjZXNzIiwibmV3VmFsdWUiLCJvbGRWYWx1ZSIsIl9pbkxheWVyUGFyc2VyIiwiX3RyaWdnZXJBc3luYyIsInByb3BlcnR5IiwiY29uY2F0IiwiZm9yRWFjaCIsImlkZW50aXR5SWQiLCJfeGhyIiwidXJsIiwicmVwbGFjZSIsImluZGV4Iiwic3BsaWNlIiwiYWRkTWVtYmVycyIsInJlbW92ZU1lbWJlcnMiLCJtZW1iZXJzaGlwSWQiLCJnZXRNZW1iZXIiLCJfZGVsZXRlIiwiY2xpZW50IiwiX2FkZENoYW5uZWwiLCJyZXN1bHQiLCJzdWNjZXNzIiwibG9hZCIsIl90b09iamVjdCIsImNsb25lIiwiZnJvbVNlcnZlciIsIl9mcm9tREIiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiU3RyaW5nIiwiTWF0aCIsInJhbmRvbSIsIm5ld09wdGlvbnMiLCJwcml2YXRlIiwiZmluZENhY2hlZENoYW5uZWwiLCJhQ2hhbm5lbCIsIl9zZW5kRGlzdGluY3RFdmVudCIsInRhcmdldCIsImRvZXNPYmplY3RNYXRjaCIsIkZPVU5EIiwiRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEiLCJwcm90b3R5cGUiLCJldmVudFByZWZpeCIsInByZWZpeFVVSUQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiaW5pdENsYXNzIiwiYXBwbHkiLCJzdWJjbGFzc2VzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1EQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFdBQVdELFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1FLFlBQVlGLFFBQVEsYUFBUixDQUFsQjtBQUNBLElBQU1HLGlCQUFpQkgsUUFBUSxtQkFBUixDQUF2QjtBQUNBLElBQU1JLGFBQWFKLFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNSyxhQUFhTCxRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTU0sT0FBT04sUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTU8sWUFBWVAsUUFBUSxVQUFSLENBQWxCOztJQUVNUSxPOzs7QUFDSixxQkFBMEI7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ3hCO0FBQ0EsUUFBSSxDQUFDQSxRQUFRQyxVQUFiLEVBQXlCRCxRQUFRQyxVQUFSLEdBQXFCLEVBQXJCOztBQUZELGtIQUdsQkQsT0FIa0I7O0FBSXhCLFVBQUtFLFFBQUwsR0FBZ0IsTUFBS0MsU0FBTCxHQUFpQkMsY0FBakIsQ0FBZ0NKLFFBQVFLLE9BQVIsSUFBbUIsRUFBbkQsRUFBdURDLEdBQXZELENBQTJEO0FBQUEsYUFBUUMsS0FBS0MsRUFBYjtBQUFBLEtBQTNELENBQWhCO0FBQ0EsVUFBS0MsU0FBTDtBQUx3QjtBQU16Qjs7QUFFRDs7Ozs7Ozs7Ozs4QkFNVTtBQUNSLFdBQUtDLFdBQUwsR0FBbUIsSUFBbkI7QUFDQSxXQUFLUCxTQUFMLEdBQWlCUSxjQUFqQixDQUFnQyxJQUFoQztBQUNBO0FBQ0EsV0FBS1YsVUFBTCxHQUFrQixJQUFsQjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7b0NBcUI0QjtBQUFBLFVBQWRELE9BQWMsdUVBQUosRUFBSTs7QUFDMUIsVUFBTVksZ0JBQWlCLE9BQU9aLE9BQVAsS0FBbUIsUUFBcEIsR0FBZ0M7QUFDcERhLGVBQU8sQ0FBQyxFQUFFQyxNQUFNZCxPQUFSLEVBQWlCZSxVQUFVLFlBQTNCLEVBQUQ7QUFENkMsT0FBaEMsR0FFbEJmLE9BRko7QUFHQVksb0JBQWNJLFFBQWQsR0FBeUIsS0FBS0EsUUFBOUI7QUFDQUosb0JBQWNLLGNBQWQsR0FBK0IsS0FBS1QsRUFBcEM7O0FBRUEsYUFBTyxJQUFJZCxjQUFKLENBQW1Ca0IsYUFBbkIsQ0FBUDtBQUNEOztBQUdEOzs7Ozs7Ozs7Ozs7O3lCQVVLTSxPLEVBQVM7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQUlBLE9BQUosRUFBYTtBQUNYQSxnQkFBUUMsUUFBUixHQUFtQnBCLFFBQVFxQixZQUEzQjtBQUNBckIsZ0JBQVFxQixZQUFSLElBQXdCLElBQXhCO0FBQ0Q7QUFDRCxvSEFBa0JGLE9BQWxCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O2lDQVdhRyxJLEVBQU07QUFDakIsVUFBTUMsa0JBQWtCekIsS0FBSzBCLE9BQUwsQ0FBYSxLQUFLQyxRQUFsQixDQUF4QjtBQUNBLFVBQU1uQixVQUFVLEtBQUtILFFBQUwsSUFBaUIsRUFBakM7QUFDQSxVQUFJRyxRQUFRb0IsT0FBUixDQUFnQixLQUFLdEIsU0FBTCxHQUFpQnVCLElBQWpCLENBQXNCbEIsRUFBdEMsTUFBOEMsQ0FBQyxDQUFuRCxFQUFzREgsUUFBUXNCLElBQVIsQ0FBYSxLQUFLeEIsU0FBTCxHQUFpQnVCLElBQWpCLENBQXNCbEIsRUFBbkM7QUFDdEQsYUFBTztBQUNMb0IsZ0JBQVEsZ0JBREg7QUFFTFAsY0FBTTtBQUNKUSxnQkFBTSxLQUFLQSxJQURQO0FBRUpMLG9CQUFVRixrQkFBa0IsSUFBbEIsR0FBeUIsS0FBS0UsUUFGcEM7QUFHSmhCLGNBQUksS0FBS0EsRUFITDtBQUlKSDtBQUpJO0FBRkQsT0FBUDtBQVNEOzs7d0NBR21CeUIsTyxFQUFTO0FBQzNCO0FBQ0E7QUFDQSxXQUFLQyxjQUFMLEdBQXVCLEtBQUtDLFNBQUwsS0FBbUJsQyxVQUFVbUMsVUFBVixDQUFxQkMsR0FBL0Q7QUFDQSxXQUFLTCxJQUFMLEdBQVlDLFFBQVFELElBQXBCOztBQUVBLFdBQUtNLG9CQUFMLEdBQTRCQyxRQUFRTixRQUFRN0IsVUFBaEIsQ0FBNUI7QUFDQSxXQUFLQSxVQUFMLEdBQWtCLENBQUM2QixRQUFRN0IsVUFBVCxJQUNoQixDQUFDNkIsUUFBUTdCLFVBQVIsQ0FBbUJPLEVBREosR0FDUyxJQURULEdBQ2dCLEtBQUtMLFNBQUwsR0FBaUJrQyxhQUFqQixDQUErQlAsUUFBUTdCLFVBQXZDLENBRGxDOztBQUdBLDRIQUEwQjZCLE9BQTFCO0FBQ0EsV0FBS3JCLFNBQUw7O0FBRUEsV0FBS3NCLGNBQUwsR0FBc0IsS0FBdEI7QUFDRDs7OzBDQUVxQlYsSSxFQUFNO0FBQzFCLFdBQUtpQixjQUFMLENBQW9CakIsS0FBS0EsSUFBekI7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7aUNBV2FrQixRLEVBQVVDLFEsRUFBVTtBQUMvQixVQUFJLEtBQUtDLGNBQVQsRUFBeUI7QUFDekIsV0FBS0MsYUFBTCxDQUFtQixpQkFBbkIsRUFBc0M7QUFDcENDLGtCQUFVLE1BRDBCO0FBRXBDSCwwQkFGb0M7QUFHcENEO0FBSG9DLE9BQXRDO0FBS0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OytCQWlCV2xDLE8sRUFBUztBQUFBOztBQUNsQkEsZ0JBQVUsS0FBS0YsU0FBTCxHQUFpQkMsY0FBakIsQ0FBZ0NDLE9BQWhDLEVBQXlDQyxHQUF6QyxDQUE2QztBQUFBLGVBQVFDLEtBQUtDLEVBQWI7QUFBQSxPQUE3QyxDQUFWO0FBQ0EsVUFBSSxLQUFLd0IsU0FBTCxLQUFtQmxDLFVBQVVtQyxVQUFWLENBQXFCQyxHQUE1QyxFQUFpRDtBQUMvQyxhQUFLaEMsUUFBTCxHQUFnQixLQUFLQSxRQUFMLENBQWMwQyxNQUFkLENBQXFCdkMsT0FBckIsQ0FBaEI7QUFDQSxlQUFPLElBQVA7QUFDRDs7QUFFRDtBQUNBQSxjQUFRd0MsT0FBUixDQUFnQixVQUFDQyxVQUFELEVBQWdCO0FBQzlCLGVBQUtDLElBQUwsQ0FBVTtBQUNSQyxlQUFLLGNBQWNGLFdBQVdHLE9BQVgsQ0FBbUIsMkJBQW5CLEVBQWdELEVBQWhELENBRFg7QUFFUnJCLGtCQUFRO0FBRkEsU0FBVjtBQUlELE9BTEQ7QUFNQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7O2tDQWVjdkIsTyxFQUFTO0FBQUE7O0FBQ3JCQSxnQkFBVSxLQUFLRixTQUFMLEdBQWlCQyxjQUFqQixDQUFnQ0MsT0FBaEMsRUFBeUNDLEdBQXpDLENBQTZDO0FBQUEsZUFBUUMsS0FBS0MsRUFBYjtBQUFBLE9BQTdDLENBQVY7O0FBRUEsVUFBSSxLQUFLd0IsU0FBTCxLQUFtQmxDLFVBQVVtQyxVQUFWLENBQXFCQyxHQUE1QyxFQUFpRDtBQUMvQzdCLGdCQUFRd0MsT0FBUixDQUFnQixVQUFDckMsRUFBRCxFQUFRO0FBQ3RCLGNBQU0wQyxRQUFRLE9BQUtoRCxRQUFMLENBQWN1QixPQUFkLENBQXNCakIsRUFBdEIsQ0FBZDtBQUNBLGNBQUkwQyxVQUFVLENBQUMsQ0FBZixFQUFrQixPQUFLaEQsUUFBTCxDQUFjaUQsTUFBZCxDQUFxQkQsS0FBckIsRUFBNEIsQ0FBNUI7QUFDbkIsU0FIRDtBQUlBLGVBQU8sSUFBUDtBQUNEOztBQUVEO0FBQ0E3QyxjQUFRd0MsT0FBUixDQUFnQixVQUFDQyxVQUFELEVBQWdCO0FBQzlCLGVBQUtDLElBQUwsQ0FBVTtBQUNSQyxlQUFLLGNBQWNGLFdBQVdHLE9BQVgsQ0FBbUIsMkJBQW5CLEVBQWdELEVBQWhELENBRFg7QUFFUnJCLGtCQUFRO0FBRkEsU0FBVjtBQUlELE9BTEQ7QUFNQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OzJCQVlPO0FBQ0wsYUFBTyxLQUFLd0IsVUFBTCxDQUFnQixDQUFDLEtBQUtqRCxTQUFMLEdBQWlCdUIsSUFBakIsQ0FBc0JsQixFQUF2QixDQUFoQixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7OzRCQVdRO0FBQ04sYUFBTyxLQUFLNkMsYUFBTCxDQUFtQixDQUFDLEtBQUtsRCxTQUFMLEdBQWlCdUIsSUFBakIsQ0FBc0JsQixFQUF2QixDQUFuQixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzhCQTBCVXNDLFUsRUFBWTtBQUNwQkEsbUJBQWEsS0FBSzNDLFNBQUwsR0FBaUJDLGNBQWpCLENBQWdDLENBQUMwQyxVQUFELENBQWhDLEVBQThDLENBQTlDLEVBQWlEdEMsRUFBOUQ7QUFDQSxVQUFNOEMsZUFBZSxLQUFLOUMsRUFBTCxHQUFVLFdBQVYsR0FBd0JzQyxXQUFXRyxPQUFYLENBQW1CLDBCQUFuQixFQUErQyxFQUEvQyxDQUE3QztBQUNBLGFBQU8sS0FBSzlDLFNBQUwsR0FBaUJvRCxTQUFqQixDQUEyQkQsWUFBM0IsRUFBeUMsSUFBekMsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs4QkFLUztBQUNQLFdBQUtFLE9BQUwsQ0FBYSxFQUFiO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OztnQ0FNWTtBQUNWLFVBQU1DLFNBQVMsS0FBS3RELFNBQUwsRUFBZjtBQUNBc0QsYUFBT0MsV0FBUCxDQUFtQixJQUFuQjtBQUNEOzs7a0NBRWFDLE0sRUFBUW5ELEUsRUFBSTtBQUN4QixVQUFNaUQsU0FBUyxLQUFLdEQsU0FBTCxFQUFmO0FBQ0EsVUFBSSxDQUFDd0QsT0FBT0MsT0FBUixLQUFvQixDQUFDRCxPQUFPdEMsSUFBUixJQUFnQnNDLE9BQU90QyxJQUFQLENBQVliLEVBQVosS0FBbUIsV0FBdkQsQ0FBSixFQUF5RVQsUUFBUThELElBQVIsQ0FBYXJELEVBQWIsRUFBaUJpRCxNQUFqQjtBQUMxRTs7QUFFRDs7Ozs7Ozs7Ozs7OzsrQkFVVztBQUNULFVBQUksQ0FBQyxLQUFLSyxTQUFWLEVBQXFCO0FBQ25CLGFBQUtBLFNBQUw7QUFDQSxhQUFLQSxTQUFMLENBQWU3RCxVQUFmLEdBQTRCSixLQUFLa0UsS0FBTCxDQUFXLEtBQUs5RCxVQUFoQixDQUE1QjtBQUNEO0FBQ0QsYUFBTyxLQUFLNkQsU0FBWjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7O3NDQWF5QmhDLE8sRUFBUzJCLE0sRUFBUTtBQUN4QyxhQUFPLElBQUkxRCxPQUFKLENBQVk7QUFDakIwRCxzQkFEaUI7QUFFakJPLG9CQUFZbEMsT0FGSztBQUdqQm1DLGlCQUFTbkMsUUFBUW1DO0FBSEEsT0FBWixDQUFQO0FBS0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7MkJBNEJjakUsTyxFQUFTO0FBQ3JCLFVBQUksQ0FBQ0EsUUFBUXlELE1BQWIsRUFBcUIsTUFBTSxJQUFJUyxLQUFKLENBQVV2RSxXQUFXd0UsVUFBWCxDQUFzQkMsYUFBaEMsQ0FBTjtBQUNyQixVQUFJLENBQUNwRSxRQUFRNkIsSUFBYixFQUFtQjdCLFFBQVE2QixJQUFSLEdBQWUsYUFBYXdDLE9BQU9DLEtBQUtDLE1BQUwsRUFBUCxFQUFzQnRCLE9BQXRCLENBQThCLElBQTlCLEVBQW9DLEVBQXBDLENBQTVCO0FBQ25CLFVBQU11QixhQUFhO0FBQ2pCM0MsY0FBTTdCLFFBQVE2QixJQURHO0FBRWpCNEMsaUJBQVN6RSxRQUFReUUsT0FGQTtBQUdqQnBFLGlCQUFTTCxRQUFRSyxPQUFSLEdBQWtCTCxRQUFReUQsTUFBUixDQUFlckQsY0FBZixDQUE4QkosUUFBUUssT0FBdEMsRUFBK0NDLEdBQS9DLENBQW1EO0FBQUEsaUJBQVFDLEtBQUtDLEVBQWI7QUFBQSxTQUFuRCxDQUFsQixHQUF3RixFQUhoRjtBQUlqQmdCLGtCQUFVeEIsUUFBUXdCLFFBSkQ7QUFLakJpQyxnQkFBUXpELFFBQVF5RDtBQUxDLE9BQW5COztBQVFBLFVBQU0zQixVQUFVOUIsUUFBUXlELE1BQVIsQ0FBZWlCLGlCQUFmLENBQWlDO0FBQUEsZUFBWUMsU0FBUzlDLElBQVQsS0FBa0IyQyxXQUFXM0MsSUFBekM7QUFBQSxPQUFqQyxDQUFoQjs7QUFFQSxVQUFJQyxPQUFKLEVBQWE7QUFDWEEsZ0JBQVE4QyxrQkFBUixHQUE2QixJQUFJaEYsVUFBSixDQUFlO0FBQzFDaUYsa0JBQVEvQyxPQURrQztBQUUxQzZCLGtCQUFRLENBQUMzRCxRQUFRd0IsUUFBVCxJQUFxQjNCLEtBQUtpRixlQUFMLENBQXFCOUUsUUFBUXdCLFFBQTdCLEVBQXVDTSxRQUFRTixRQUEvQyxDQUFyQixHQUNOekIsUUFBUWdGLEtBREYsR0FDVWhGLFFBQVFpRjtBQUhnQixTQUFmLEVBSTFCLGVBSjBCLENBQTdCO0FBS0Q7O0FBRUQsYUFBT2xELFdBQVcsSUFBSS9CLE9BQUosQ0FBWXlFLFVBQVosQ0FBbEI7QUFDRDs7OztFQXRZbUIvRSxTOztBQXlZdEI7Ozs7Ozs7Ozs7OztBQVVBTSxRQUFRa0YsU0FBUixDQUFrQnBELElBQWxCLEdBQXlCLEVBQXpCOztBQUVBOzs7Ozs7Ozs7Ozs7OztBQWNBOUIsUUFBUWtGLFNBQVIsQ0FBa0JoRixVQUFsQixHQUErQixJQUEvQjs7QUFFQUYsUUFBUWtGLFNBQVIsQ0FBa0IvRSxRQUFsQixHQUE2QixJQUE3Qjs7QUFFQUgsUUFBUW1GLFdBQVIsR0FBc0IsVUFBdEI7O0FBRUE7QUFDQTtBQUNBbkYsUUFBUXFCLFlBQVIsR0FBdUIsb0JBQXZCOztBQUVBOzs7Ozs7QUFNQXJCLFFBQVFvRixVQUFSLEdBQXFCLG9CQUFyQjs7QUFFQXBGLFFBQVFxRixnQkFBUixHQUEyQjs7QUFFekI7Ozs7Ozs7Ozs7Ozs7QUFhQSxlQWZ5Qjs7QUFpQnpCOzs7Ozs7QUFNQSxxQkF2QnlCOztBQXlCekI7Ozs7Ozs7O0FBUUEsaUJBakN5Qjs7QUFtQ3pCOzs7Ozs7OztBQVFBLHVCQTNDeUI7O0FBNkN6Qjs7Ozs7Ozs7QUFRQSxpQkFyRHlCOztBQXVEekI7Ozs7Ozs7Ozs7O0FBV0EsaUJBbEV5QixFQWtFTnhDLE1BbEVNLENBa0VDcEQsU0FBUzRGLGdCQWxFVixDQUEzQjs7QUFxRUE5RixLQUFLK0YsU0FBTCxDQUFlQyxLQUFmLENBQXFCdkYsT0FBckIsRUFBOEIsQ0FBQ0EsT0FBRCxFQUFVLFNBQVYsQ0FBOUI7QUFDQVAsU0FBUytGLFVBQVQsQ0FBb0I1RCxJQUFwQixDQUF5QjVCLE9BQXpCO0FBQ0F5RixPQUFPQyxPQUFQLEdBQWlCMUYsT0FBakIiLCJmaWxlIjoiY2hhbm5lbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIEZlYXR1cmUgaXMgdGVzdGVkIGJ1dCBub3QgYXZhaWxhYmxlIG9uIHNlcnZlclxuICogQSBDaGFubmVsIG9iamVjdCByZXByZXNlbnRzIGEgZGlhbG9nIGFtb25nc3QgYSBsYXJnZSBzZXRcbiAqIG9mIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBgYGBcbiAqIHZhciBjaGFubmVsID0gY2xpZW50LmNyZWF0ZUNoYW5uZWwoe1xuICogICBuYW1lOiBcImZyb2RvLXRoZS1kb2RvXCIsXG4gKiAgIG1lbWJlcnM6IFtcImxheWVyOi8vL2lkZW50aXRpZXMvc2Ftd2lzZVwiLCBcImxheWVyOi8vL2lkZW50aXRpZXMvb3JjLWFybXlcIl0sXG4gKiAgIG1ldGFkYXRhOiB7XG4gKiAgICAgc3VidG9waWM6IFwiU2F1cnVtYW4gaXMgdGhlIG1hbi4gIEFuZCBhIFNhdXJpYW5cIixcbiAqICAgICB0b29NdWNoSW5mbzoge1xuICogICAgICAgbm9zZTogXCJzdHVmZmVkXCJcbiAqICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIGNoYW5uZWwuY3JlYXRlTWVzc2FnZShcIlBsZWFzZSBkb24ndCBlYXQgbWVcIikuc2VuZCgpO1xuICogYGBgXG4gKiBOT1RFOiBTZW5kaW5nIGEgTWVzc2FnZSBjcmVhdGVzIHRoZSBDaGFubmVsOyB0aGlzIGF2b2lkcyBoYXZpbmcgbG90cyBvZiB1bnVzZWQgY2hhbm5lbHMgYmVpbmcgY3JlYXRlZC5cbiAqXG4gKiBLZXkgbWV0aG9kcywgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIGZvciBnZXR0aW5nIHN0YXJ0ZWQ6XG4gKlxuICogUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLkNoYW5uZWwuaWQ6IHRoaXMgcHJvcGVydHkgaXMgd29ydGggYmVpbmcgZmFtaWxpYXIgd2l0aDsgaXQgaWRlbnRpZmllcyB0aGVcbiAqICAgQ2hhbm5lbCBhbmQgY2FuIGJlIHVzZWQgaW4gYGNsaWVudC5nZXRDaGFubmVsKGlkKWAgdG8gcmV0cmlldmUgaXQuXG4gKiAqIGxheWVyLkNoYW5uZWwubmFtZTogdGhpcyBwcm9wZXJ0eSBuYW1lcyB0aGUgY2hhbm5lbDsgdGhpcyBtYXkgYmUgaHVtYW4gcmVhZGFibGUsIHRob3VnaCBmb3IgbG9jYWxpemF0aW9uIHB1cnBvc2VzLFxuICogICB5b3UgbWF5IGluc3RlYWQgd2FudCB0byB1c2UgYSBjb21tb24gbmFtZSB0aGF0IGlzIGRpc3RpbmN0IGZyb20geW91ciBkaXNwbGF5ZWQgbmFtZS4gIFRoZXJlIGNhbiBvbmx5IGJlIGEgc2luZ2xlXG4gKiAgIGNoYW5uZWwgd2l0aCBhIGdpdmVuIG5hbWUgcGVyIGFwcC5cbiAqICogbGF5ZXIuQ2hhbm5lbC5tZW1iZXJzaGlwOiBDb250YWlucyBzdGF0dXMgaW5mb3JtYXRpb24gYWJvdXQgeW91ciB1c2VyJ3Mgcm9sZSBpbiB0aGlzIENoYW5uZWwuXG4gKiAqIGxheWVyLkNoYW5uZWwuaXNDdXJyZW50UGFydGljaXBhbnQ6IFNob3J0aGFuZCBmb3IgZGV0ZXJtaW5pbmcgaWYgeW91ciB1c2VyIGlzIGEgbWVtYmVyIG9mIHRoZSBDaGFubmVsLlxuICpcbiAqIE1ldGhvZHM6XG4gKlxuICogKiBsYXllci5DaGFubmVsLmpvaW4oKSB0byBqb2luIHRoZSBDaGFubmVsXG4gKiAqIGxheWVyLkNoYW5uZWwubGVhdmUoKSB0byBsZWF2ZSB0aGUgQ2hhbm5lbFxuICogKiBsYXllci5DaGFubmVsLm9uKCkgYW5kIGxheWVyLkNoYW5uZWwub2ZmKCk6IGV2ZW50IGxpc3RlbmVycyBidWlsdCBvbiB0b3Agb2YgdGhlIGBiYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZWAgbnBtIHByb2plY3RcbiAqICogbGF5ZXIuQ2hhbm5lbC5jcmVhdGVNZXNzYWdlKCkgdG8gc2VuZCBhIG1lc3NhZ2Ugb24gdGhlIENoYW5uZWwuXG4gKlxuICogRXZlbnRzOlxuICpcbiAqICogYGNoYW5uZWxzOmNoYW5nZWA6IFVzZWZ1bCBmb3Igb2JzZXJ2aW5nIGNoYW5nZXMgdG8gQ2hhbm5lbCBuYW1lXG4gKiAgIGFuZCB1cGRhdGluZyByZW5kZXJpbmcgb2YgeW91ciBDaGFubmVsXG4gKlxuICogRmluYWxseSwgdG8gYWNjZXNzIGEgbGlzdCBvZiBNZXNzYWdlcyBpbiBhIENoYW5uZWwsIHNlZSBsYXllci5RdWVyeS5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNoYW5uZWxcbiAqIEBleHRlbmRzIGxheWVyLkNvbnRhaW5lclxuICogQGF1dGhvciAgTWljaGFlbCBLYW50b3JcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBDb250YWluZXIgPSByZXF1aXJlKCcuL2NvbnRhaW5lcicpO1xuY29uc3QgQ2hhbm5lbE1lc3NhZ2UgPSByZXF1aXJlKCcuL2NoYW5uZWwtbWVzc2FnZScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5jb25zdCBMYXllckV2ZW50ID0gcmVxdWlyZSgnLi4vbGF5ZXItZXZlbnQnKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5cbmNsYXNzIENoYW5uZWwgZXh0ZW5kcyBDb250YWluZXIge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyBTZXR1cCBkZWZhdWx0IHZhbHVlc1xuICAgIGlmICghb3B0aW9ucy5tZW1iZXJzaGlwKSBvcHRpb25zLm1lbWJlcnNoaXAgPSB7fTtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9tZW1iZXJzID0gdGhpcy5nZXRDbGllbnQoKS5fZml4SWRlbnRpdGllcyhvcHRpb25zLm1lbWJlcnMgfHwgW10pLm1hcChpdGVtID0+IGl0ZW0uaWQpO1xuICAgIHRoaXMuX3JlZ2lzdGVyKCk7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgbG9jYWwgY29weSBvZiB0aGlzIENoYW5uZWwsIGNsZWFuaW5nIHVwIGFsbCByZXNvdXJjZXNcbiAgICogaXQgY29uc3VtZXMuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmxhc3RNZXNzYWdlID0gbnVsbDtcbiAgICB0aGlzLmdldENsaWVudCgpLl9yZW1vdmVDaGFubmVsKHRoaXMpO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLm1lbWJlcnNoaXAgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5NZXNzYWdlLkNoYW5uZWxNZXNzYWdlIGluc3RhbmNlIHdpdGhpbiB0aGlzIGNvbnZlcnNhdGlvblxuICAgKlxuICAgKiAgICAgIHZhciBtZXNzYWdlID0gY2hhbm5lbC5jcmVhdGVNZXNzYWdlKCdoZWxsbycpO1xuICAgKlxuICAgKiAgICAgIHZhciBtZXNzYWdlID0gY2hhbm5lbC5jcmVhdGVNZXNzYWdlKHtcbiAgICogICAgICAgICAgcGFydHM6IFtuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe1xuICAgKiAgICAgICAgICAgICAgICAgICAgICBib2R5OiAnaGVsbG8nLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gICAqICAgICAgICAgICAgICAgICAgfSldXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIFNlZSBsYXllci5NZXNzYWdlLkNoYW5uZWxNZXNzYWdlIGZvciBtb3JlIG9wdGlvbnMgZm9yIGNyZWF0aW5nIHRoZSBtZXNzYWdlLlxuICAgKlxuICAgKiBAbWV0aG9kIGNyZWF0ZU1lc3NhZ2VcbiAgICogQHBhcmFtICB7U3RyaW5nfE9iamVjdH0gb3B0aW9ucyAtIElmIGl0cyBhIHN0cmluZywgYSBNZXNzYWdlUGFydCBpcyBjcmVhdGVkIGFyb3VuZCB0aGF0IHN0cmluZy5cbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlUGFydFtdfSBvcHRpb25zLnBhcnRzIC0gQW4gYXJyYXkgb2YgTWVzc2FnZVBhcnRzLiAgVGhlcmUgaXMgc29tZSB0b2xlcmFuY2UgZm9yXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdCBub3QgYmVpbmcgYW4gYXJyYXksIG9yIGZvciBpdCBiZWluZyBhIHN0cmluZyB0byBiZSB0dXJuZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludG8gYSBNZXNzYWdlUGFydC5cbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZX1cbiAgICovXG4gIGNyZWF0ZU1lc3NhZ2Uob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbWVzc2FnZUNvbmZpZyA9ICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpID8ge1xuICAgICAgcGFydHM6IFt7IGJvZHk6IG9wdGlvbnMsIG1pbWVUeXBlOiAndGV4dC9wbGFpbicgfV0sXG4gICAgfSA6IG9wdGlvbnM7XG4gICAgbWVzc2FnZUNvbmZpZy5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgbWVzc2FnZUNvbmZpZy5jb252ZXJzYXRpb25JZCA9IHRoaXMuaWQ7XG5cbiAgICByZXR1cm4gbmV3IENoYW5uZWxNZXNzYWdlKG1lc3NhZ2VDb25maWcpO1xuICB9XG5cblxuICAvKipcbiAgICogQ3JlYXRlIHRoaXMgQ29udmVyc2F0aW9uIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBteSBsYXllci5NZXNzYWdlLnNlbmQgdG8gaW5zdXJlIGl0cyBDb252ZXJzYXRpb24gZXhpc3RzXG4gICAqIG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2UuQ2hhbm5lbE1lc3NhZ2V9IFttZXNzYWdlXSBUZWxscyB0aGUgQ29udmVyc2F0aW9uIHdoYXQgaXRzIGxhc3RfbWVzc2FnZSB3aWxsIGJlXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgc2VuZChtZXNzYWdlKSB7XG4gICAgLy8gQ29udmVyc2F0aW9ucyBjYW4ganVzdCBjaGVjayB0aGUgbGFzdE1lc3NhZ2UgcG9zaXRpb24gYW5kIGluY3JlbWVudCBpdC5cbiAgICAvLyBDaGFubmVscyBtdXN0IGRvIGEgaGFja2llciBjYWxjdWxhdGlvbiB0aGF0IHNldHMgdGhlIG5leHQgcG9zaXRpb24gdG8gYSBudW1iZXIgbGFyZ2VyIHRoYW4gdGhlIHNlcnZlclxuICAgIC8vIGNvdWxkIGV2ZXIgZGVsaXZlciwgYW5kIHRoZW4gaW5jcmVtZW50IHRoYXQgZmxvYXRpbmcgcG9pbnQgcG9zaXRpb24gYnkgYSBsYXJnZSBlbm91Z2ggaW5jcmVtZW50XG4gICAgLy8gdGhhdCB3ZSBuZWVkIG5vdCB3b3JyeSBhYm91dCBGbG9hdGluZyBwb2ludCByb3VuZGluZyBlcnJvcnMuICBMb3RzIG9mIGd1ZXNzd29yayBoZXJlLlxuICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICBtZXNzYWdlLnBvc2l0aW9uID0gQ2hhbm5lbC5uZXh0UG9zaXRpb247XG4gICAgICBDaGFubmVsLm5leHRQb3NpdGlvbiArPSA4MTkyO1xuICAgIH1cbiAgICByZXR1cm4gc3VwZXIuc2VuZChtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBkYXRhIGZvciBhIENyZWF0ZSByZXF1ZXN0LlxuICAgKlxuICAgKiBUaGUgbGF5ZXIuU3luY01hbmFnZXIgbmVlZHMgYSBjYWxsYmFjayB0byBjcmVhdGUgdGhlIENvbnZlcnNhdGlvbiBhcyBpdFxuICAgKiBsb29rcyBOT1csIG5vdCBiYWNrIHdoZW4gYHNlbmQoKWAgd2FzIGNhbGxlZC4gIFRoaXMgbWV0aG9kIGlzIGNhbGxlZFxuICAgKiBieSB0aGUgbGF5ZXIuU3luY01hbmFnZXIgdG8gcG9wdWxhdGUgdGhlIFBPU1QgZGF0YSBvZiB0aGUgY2FsbC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0U2VuZERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7T2JqZWN0fSBXZWJzb2NrZXQgZGF0YSBmb3IgdGhlIHJlcXVlc3RcbiAgICovXG4gIF9nZXRTZW5kRGF0YShkYXRhKSB7XG4gICAgY29uc3QgaXNNZXRhZGF0YUVtcHR5ID0gVXRpbC5pc0VtcHR5KHRoaXMubWV0YWRhdGEpO1xuICAgIGNvbnN0IG1lbWJlcnMgPSB0aGlzLl9tZW1iZXJzIHx8IFtdO1xuICAgIGlmIChtZW1iZXJzLmluZGV4T2YodGhpcy5nZXRDbGllbnQoKS51c2VyLmlkKSA9PT0gLTEpIG1lbWJlcnMucHVzaCh0aGlzLmdldENsaWVudCgpLnVzZXIuaWQpO1xuICAgIHJldHVybiB7XG4gICAgICBtZXRob2Q6ICdDaGFubmVsLmNyZWF0ZScsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgICAgbWV0YWRhdGE6IGlzTWV0YWRhdGFFbXB0eSA/IG51bGwgOiB0aGlzLm1ldGFkYXRhLFxuICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgbWVtYmVycyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG5cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihjaGFubmVsKSB7XG4gICAgLy8gRGlzYWJsZSBldmVudHMgaWYgY3JlYXRpbmcgYSBuZXcgQ29udmVyc2F0aW9uXG4gICAgLy8gV2Ugc3RpbGwgd2FudCBwcm9wZXJ0eSBjaGFuZ2UgZXZlbnRzIGZvciBhbnl0aGluZyB0aGF0IERPRVMgY2hhbmdlXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9ICh0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKTtcbiAgICB0aGlzLm5hbWUgPSBjaGFubmVsLm5hbWU7XG5cbiAgICB0aGlzLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gQm9vbGVhbihjaGFubmVsLm1lbWJlcnNoaXApO1xuICAgIHRoaXMubWVtYmVyc2hpcCA9ICFjaGFubmVsLm1lbWJlcnNoaXAgfHxcbiAgICAgICFjaGFubmVsLm1lbWJlcnNoaXAuaWQgPyBudWxsIDogdGhpcy5nZXRDbGllbnQoKS5fY3JlYXRlT2JqZWN0KGNoYW5uZWwubWVtYmVyc2hpcCk7XG5cbiAgICBzdXBlci5fcG9wdWxhdGVGcm9tU2VydmVyKGNoYW5uZWwpO1xuICAgIHRoaXMuX3JlZ2lzdGVyKCk7XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gIH1cblxuICBfY3JlYXRlUmVzdWx0Q29uZmxpY3QoZGF0YSkge1xuICAgIHRoaXMuX2NyZWF0ZVN1Y2Nlc3MoZGF0YS5kYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBuYW1lIHByb3BlcnR5IHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZU5hbWVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBuZXdWYWx1ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZU5hbWUobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2luTGF5ZXJQYXJzZXIpIHJldHVybjtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NoYW5uZWxzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbmFtZScsXG4gICAgICBvbGRWYWx1ZSxcbiAgICAgIG5ld1ZhbHVlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgZm9sbG93aW5nIG1lbWJlcnMgdG8gdGhlIENoYW5uZWwuXG4gICAqXG4gICAqIFVubGlrZSBDb252ZXJzYXRpb25zLCBDaGFubmVscyBkbyBub3QgbWFpbnRhaW4gc3RhdGUgaW5mb3JtYXRpb24gYWJvdXQgdGhlaXIgbWVtYmVycy5cbiAgICogQXMgc3VjaCwgaWYgdGhlIG9wZXJhdGlvbiBmYWlscyB0aGVyZSBpcyBubyBhY3R1YWwgc3RhdGUgY2hhbmdlXG4gICAqIGZvciB0aGUgY2hhbm5lbC4gIEN1cnJlbnRseSB0aGUgb25seSBlcnJvcnMgZXhwb3NlZCBhcmUgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50LlN5bmNNYW5hZ2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIGFkZE1lbWJlcnNcbiAgICogQHBhcmFtIHtTdHJpbmdbXX0gbWVtYmVycyAgIElkZW50aXR5IElEcyBvZiB1c2VycyB0byBhZGQgdG8gdGhpcyBDaGFubmVsXG4gICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9IHRoaXNcbiAgICpcbiAgICpcbiAgICpcbiAgICpcbiAgICpcbiAgICogQGlnbm9yZSB1bnRpbCBzZXJ2ZXIgc3VwcG9ydHMgaXRcbiAgICovXG4gIGFkZE1lbWJlcnMobWVtYmVycykge1xuICAgIG1lbWJlcnMgPSB0aGlzLmdldENsaWVudCgpLl9maXhJZGVudGl0aWVzKG1lbWJlcnMpLm1hcChpdGVtID0+IGl0ZW0uaWQpO1xuICAgIGlmICh0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSB7XG4gICAgICB0aGlzLl9tZW1iZXJzID0gdGhpcy5fbWVtYmVycy5jb25jYXQobWVtYmVycyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBTaG91bGQgdXNlIHRoZSBidWxrIG9wZXJhdGlvbiB3aGVuIGl0IGJlY29tZXMgYXZhaWxhYmxlLlxuICAgIG1lbWJlcnMuZm9yRWFjaCgoaWRlbnRpdHlJZCkgPT4ge1xuICAgICAgdGhpcy5feGhyKHtcbiAgICAgICAgdXJsOiAnL21lbWJlcnMvJyArIGlkZW50aXR5SWQucmVwbGFjZSgvXmxheWVyOlxcL1xcL1xcL2lkZW50aXRpZXNcXC8vLCAnJyksXG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGZvbGxvd2luZyBtZW1iZXJzIGZyb20gdGhlIENoYW5uZWwuXG4gICAqXG4gICAqIE5vdCB5ZXQgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHJlbW92ZU1lbWJlcnNcbiAgICogQHBhcmFtIHtTdHJpbmdbXX0gbWVtYmVycyAgIElkZW50aXR5IElEcyBvZiB1c2VycyB0byByZW1vdmUgZnJvbSB0aGlzIENoYW5uZWxcbiAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH0gdGhpc1xuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKiBAaWdub3JlIHVudGlsIHNlcnZlciBzdXBwb3J0cyBpdFxuICAgKi9cbiAgcmVtb3ZlTWVtYmVycyhtZW1iZXJzKSB7XG4gICAgbWVtYmVycyA9IHRoaXMuZ2V0Q2xpZW50KCkuX2ZpeElkZW50aXRpZXMobWVtYmVycykubWFwKGl0ZW0gPT4gaXRlbS5pZCk7XG5cbiAgICBpZiAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykge1xuICAgICAgbWVtYmVycy5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX21lbWJlcnMuaW5kZXhPZihpZCk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHRoaXMuX21lbWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogU2hvdWxkIHVzZSB0aGUgYnVsayBvcGVyYXRpb24gd2hlbiBpdCBiZWNvbWVzIGF2YWlsYWJsZS5cbiAgICBtZW1iZXJzLmZvckVhY2goKGlkZW50aXR5SWQpID0+IHtcbiAgICAgIHRoaXMuX3hocih7XG4gICAgICAgIHVybDogJy9tZW1iZXJzLycgKyBpZGVudGl0eUlkLnJlcGxhY2UoL15sYXllcjpcXC9cXC9cXC9pZGVudGl0aWVzXFwvLywgJycpLFxuICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkIHRoZSBjdXJyZW50IHVzZXIgdG8gdGhpcyBjaGFubmVsLlxuICAgKlxuICAgKiBAbWV0aG9kIGpvaW5cbiAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH0gdGhpc1xuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKiBAaWdub3JlIHVudGlsIHNlcnZlciBzdXBwb3J0cyBpdFxuICAgKi9cbiAgam9pbigpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRNZW1iZXJzKFt0aGlzLmdldENsaWVudCgpLnVzZXIuaWRdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiByZW1vdmUgdGhlIGN1cnJlbnQgdXNlciBmcm9tIHRoaXMgY2hhbm5lbC5cbiAgICpcbiAgICogQG1ldGhvZCBsZWF2ZVxuICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfSB0aGlzXG4gICAqXG4gICAqXG4gICAqXG4gICAqXG4gICAqIEBpZ25vcmUgdW50aWwgc2VydmVyIHN1cHBvcnRzIGl0XG4gICAqL1xuICBsZWF2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdmVNZW1iZXJzKFt0aGlzLmdldENsaWVudCgpLnVzZXIuaWRdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBNZW1iZXJzaGlwIG9iamVjdCBmb3IgdGhlIHNwZWNpZmllZCBJZGVudGl0eSBJRC5cbiAgICpcbiAgICogSWYgYG1lbWJlcnM6bG9hZGVkYCBpcyB0cmlnZ2VyZWQsIHRoZW4geW91ciBtZW1iZXJzaGlwIG9iamVjdFxuICAgKiBoYXMgYmVlbiBwb3B1bGF0ZWQgd2l0aCBkYXRhLlxuICAgKlxuICAgKiBJZiBgbWVtYmVyczpsb2FkZWQtZXJyb3JgIGlzIHRyaWdnZXJlZCwgdGhlbiB5b3VyIG1lbWJlcnNoaXAgb2JqZWN0XG4gICAqIGNvdWxkIG5vdCBiZSBsb2FkZWQsIGVpdGhlciB5b3UgaGF2ZSBhIGNvbm5lY3Rpb24gZXJyb3IsIG9yIHRoZSB1c2VyIGlzIG5vdCBhIG1lbWJlci5cbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBtZW1iZXJzaGlwID0gY2hhbm5lbC5nZXRNZW1iZXIoJ0Zyb2RvVGhlRG9kbycpO1xuICAgKiBtZW1iZXJzaGlwLm9uKCdtZW1iZXJzaGlwOmxvYWRlZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBhbGVydCgnSGUgSVMgYSBtZW1iZXIsIHF1aWNrLCBraWNrIGhpbSBvdXQhJyk7XG4gICAqIH0pO1xuICAgKiBtZW1iZXJzaGlwLm9uKCdtZW1iZXJzaGlwOmxvYWRlZC1lcnJvcicsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBpZiAoZXZ0LmVycm9yLmlkID09PSAnbm90X2ZvdW5kJykge1xuICAgKiAgICAgIGFsZXJ0KCdTYXVydW1hbiwgaGUgaXMgd2l0aCB0aGUgRWx2ZXMhJyk7XG4gICAqICAgIH0gZWxzZSB7XG4gICAqICAgICAgYWxlcnQoJ1NhdXJ1bWFuLCB3b3VsZCB5b3UgcGxlYXNlIHBpY2sgdXAgeW91ciBQYWxhbnRpciBhbHJlYWR5PyBJIGNhbid0IGNvbm5lY3QhJyk7XG4gICAqICAgIH1cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKiBAbWV0aG9kIGdldE1lbWJlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWRlbnRpdHlJZFxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVtYmVyc2hpcH1cbiAgICovXG4gIGdldE1lbWJlcihpZGVudGl0eUlkKSB7XG4gICAgaWRlbnRpdHlJZCA9IHRoaXMuZ2V0Q2xpZW50KCkuX2ZpeElkZW50aXRpZXMoW2lkZW50aXR5SWRdKVswXS5pZDtcbiAgICBjb25zdCBtZW1iZXJzaGlwSWQgPSB0aGlzLmlkICsgJy9tZW1iZXJzLycgKyBpZGVudGl0eUlkLnJlcGxhY2UoL2xheWVyOlxcL1xcL1xcL2lkZW50aXRpZXNcXC8vLCAnJyk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q2xpZW50KCkuZ2V0TWVtYmVyKG1lbWJlcnNoaXBJZCwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBjaGFubmVsOyBub3QgY3VycmVudGx5IHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVcbiAgICovXG4gIGRlbGV0ZSgpIHtcbiAgICB0aGlzLl9kZWxldGUoJycpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHRoaXMgQ2hhbm5lbCB3aXRoIHRoZSBDbGllbnRcbiAgICpcbiAgICogQG1ldGhvZCBfcmVnaXN0ZXJcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZWdpc3RlcigpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNsaWVudC5fYWRkQ2hhbm5lbCh0aGlzKTtcbiAgfVxuXG4gIF9kZWxldGVSZXN1bHQocmVzdWx0LCBpZCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJykpIENoYW5uZWwubG9hZChpZCwgY2xpZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIENvbnZlcnNhdGlvbiBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcy5cbiAgICovXG4gIHRvT2JqZWN0KCkge1xuICAgIGlmICghdGhpcy5fdG9PYmplY3QpIHtcbiAgICAgIHRoaXMuX3RvT2JqZWN0ID0gc3VwZXIudG9PYmplY3QoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0Lm1lbWJlcnNoaXAgPSBVdGlsLmNsb25lKHRoaXMubWVtYmVyc2hpcCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjaGFubmVsIGluc3RhbmNlIGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNoYW5uZWwuXG4gICAqXG4gICAqIElmIHRoZSBDaGFubmVsIGFscmVhZHkgZXhpc3RzLCB3aWxsIHVwZGF0ZSB0aGUgZXhpc3RpbmcgY29weSB3aXRoXG4gICAqIHByZXN1bWFibHkgbmV3ZXIgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNoYW5uZWwgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBDaGFubmVsXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoY2hhbm5lbCwgY2xpZW50KSB7XG4gICAgcmV0dXJuIG5ldyBDaGFubmVsKHtcbiAgICAgIGNsaWVudCxcbiAgICAgIGZyb21TZXJ2ZXI6IGNoYW5uZWwsXG4gICAgICBfZnJvbURCOiBjaGFubmVsLl9mcm9tREIsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBvciBjcmVhdGUgYSBuZXcgQ2hhbm5lbC5cbiAgICpcbiAgICogICAgICB2YXIgY2hhbm5lbCA9IGxheWVyLkNoYW5uZWwuY3JlYXRlKHtcbiAgICogICAgICAgICAgbWVtYmVyczogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgcHJpdmF0ZTogdHJ1ZSxcbiAgICogICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICogICAgICAgICAgICAgIHRpdGxlRGV0YWlsczogJ0kgYW0gbm90IGEgZGV0YWlsISdcbiAgICogICAgICAgICAgfSxcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgICdjaGFubmVsczpsb2FkZWQnOiBmdW5jdGlvbihldnQpIHtcbiAgICpcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBSZWNvbW1lbmQgdXNpbmcgYGNsaWVudC5jcmVhdGVDaGFubmVsKHsuLi59KWBcbiAgICogaW5zdGVhZCBvZiBgQ2hhbm5lbC5jcmVhdGUoey4uLn0pYC5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMubWVtYmVycyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBsYXllci5JZGVudGl0eSBvYmplY3RzIHRvIGNyZWF0ZSBhIGNoYW5uZWwgd2l0aC5cbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcml2YXRlPWZhbHNlXSAtIENyZWF0ZSBhIHByaXZhdGUgY2hhbm5lbFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGE9e31dIC0gSW5pdGlhbCBtZXRhZGF0YSBmb3IgQ2hhbm5lbFxuICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfVxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZShvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkgb3B0aW9ucy5uYW1lID0gJ2NoYW5uZWwtJyArIFN0cmluZyhNYXRoLnJhbmRvbSgpKS5yZXBsYWNlKC9cXC4vLCAnJyk7XG4gICAgY29uc3QgbmV3T3B0aW9ucyA9IHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHByaXZhdGU6IG9wdGlvbnMucHJpdmF0ZSxcbiAgICAgIG1lbWJlcnM6IG9wdGlvbnMubWVtYmVycyA/IG9wdGlvbnMuY2xpZW50Ll9maXhJZGVudGl0aWVzKG9wdGlvbnMubWVtYmVycykubWFwKGl0ZW0gPT4gaXRlbS5pZCkgOiBbXSxcbiAgICAgIG1ldGFkYXRhOiBvcHRpb25zLm1ldGFkYXRhLFxuICAgICAgY2xpZW50OiBvcHRpb25zLmNsaWVudCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2hhbm5lbCA9IG9wdGlvbnMuY2xpZW50LmZpbmRDYWNoZWRDaGFubmVsKGFDaGFubmVsID0+IGFDaGFubmVsLm5hbWUgPT09IG5ld09wdGlvbnMubmFtZSk7XG5cbiAgICBpZiAoY2hhbm5lbCkge1xuICAgICAgY2hhbm5lbC5fc2VuZERpc3RpbmN0RXZlbnQgPSBuZXcgTGF5ZXJFdmVudCh7XG4gICAgICAgIHRhcmdldDogY2hhbm5lbCxcbiAgICAgICAgcmVzdWx0OiAhb3B0aW9ucy5tZXRhZGF0YSB8fCBVdGlsLmRvZXNPYmplY3RNYXRjaChvcHRpb25zLm1ldGFkYXRhLCBjaGFubmVsLm1ldGFkYXRhKSA/XG4gICAgICAgICAgQ2hhbm5lbC5GT1VORCA6IENoYW5uZWwuRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEsXG4gICAgICB9LCAnY2hhbm5lbHM6c2VudCcpO1xuICAgIH1cblxuICAgIHJldHVybiBjaGFubmVsIHx8IG5ldyBDaGFubmVsKG5ld09wdGlvbnMpO1xuICB9XG59XG5cbi8qKlxuICogVGhlIENoYW5uZWwncyBuYW1lOyB0aGlzIG11c3QgYmUgdW5pcXVlLlxuICpcbiAqIE5vdGUgdGhhdCB3aGlsZSB5b3UgY2FuIHVzZSBhIGRpc3BsYXlhYmxlIGh1bWFuIHJlYWRhYmxlIG5hbWUsIHlvdSBtYXkgYWxzbyBjaG9vc2UgdG8gdXNlIHRoaXNcbiAqIGFzIGFuIElEIHRoYXQgeW91IGNhbiBlYXNpbHkgbG9jYWxpemUgdG8gZGlmZmVyZW50IGxhbmd1YWdlcy5cbiAqXG4gKiBNdXN0IG5vdCBiZSBhIFVVSUQuXG4gKlxuICogQHByb3BlcnR5IHtTdHJpbmd9IG5hbWVcbiAqL1xuQ2hhbm5lbC5wcm90b3R5cGUubmFtZSA9ICcnO1xuXG4vKipcbiAqIFRoZSBgbWVtYmVyc2hpcGAgb2JqZWN0IGNvbnRhaW5zIGRldGFpbHMgb2YgdGhpcyB1c2VyJ3MgbWVtYmVyc2hpcCB3aXRoaW4gdGhpcyBjaGFubmVsLlxuICpcbiAqIE5PVEU6IEluaXRpYWxseSwgb25seSBgaXNNZW1iZXJgIHdpbGwgYmUgYXZhaWxhYmxlLlxuICpcbiAqIGBgYFxuICoge1xuICogICAgIFwiaXNNZW1iZXJcIjogdHJ1ZSxcbiAqICAgICBcInJvbGVcIjogXCJ1c2VyXCIsXG4gKiAgICAgXCJsYXN0VW5yZWFkTWVzc2FnZUlkOiBcImxheWVyOi8vL21lc3NhZ2VzL1VVSURcIlxuICogfVxuICogYGBgXG4gKiBAcHJvcGVydHkge09iamVjdH1cbiAqL1xuQ2hhbm5lbC5wcm90b3R5cGUubWVtYmVyc2hpcCA9IG51bGw7XG5cbkNoYW5uZWwucHJvdG90eXBlLl9tZW1iZXJzID0gbnVsbDtcblxuQ2hhbm5lbC5ldmVudFByZWZpeCA9ICdjaGFubmVscyc7XG5cbi8vIE1hdGgucG93KDIsIDY0KTsgYSBudW1iZXIgbGFyZ2VyIHRoYW4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIGFuZCBsYXJnZXIgdGhhbiBKYXZhJ3MgTWF4IFVuc2lnbmVkIExvbmcuIEFuZCBhbiBlYXN5IHRvIHdvcmsgd2l0aFxuLy8gZmFjdG9yIG9mIDJcbkNoYW5uZWwubmV4dFBvc2l0aW9uID0gMTg0NDY3NDQwNzM3MDk1NTIwMDA7XG5cbi8qKlxuICogUHJlZml4IHRvIHVzZSB3aGVuIGdlbmVyYXRpbmcgYW4gSUQgZm9yIGluc3RhbmNlcyBvZiB0aGlzIGNsYXNzXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqL1xuQ2hhbm5lbC5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2NoYW5uZWxzLyc7XG5cbkNoYW5uZWwuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGFmdGVyIHN1Y2Nlc3NmdWxseSBjcmVhdGluZyB0aGUgY29udmVyc2F0aW9uXG4gICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICpcbiAgICogKiBDaGFubmVsLkNSRUFURUQ6IEEgbmV3IENoYW5uZWwgaGFzIGJlZW4gY3JlYXRlZFxuICAgKiAqIENoYW5uZWwuRk9VTkQ6IEEgbWF0Y2hpbmcgbmFtZWQgQ2hhbm5lbCBoYXMgYmVlbiBmb3VuZFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQucmVzdWx0XG4gICAqL1xuICAnY2hhbm5lbHM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEFuIGF0dGVtcHQgdG8gc2VuZCB0aGlzIGNoYW5uZWwgdG8gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnY2hhbm5lbHM6c2VudC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuQ2hhbm5lbC5sb2FkKCkgbWV0aG9kLlxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqL1xuICAnY2hhbm5lbHM6bG9hZGVkJyxcblxuICAvKipcbiAgICogQW4gYXR0ZW1wdCB0byBsb2FkIHRoaXMgY29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLkNoYW5uZWwubG9hZCgpIG1ldGhvZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2NoYW5uZWxzOmxvYWRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBlaXRoZXIgYSBzdWNjZXNzZnVsIGNhbGwgdG8gZGVsZXRlKCkgb24gdGhpcyBpbnN0YW5jZVxuICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKi9cbiAgJ2NoYW5uZWxzOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIFRoaXMgY2hhbm5lbCBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZlbnQuY2hhbmdlcyAtIEFycmF5IG9mIGNoYW5nZXMgcmVwb3J0ZWQgYnkgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBldmVudC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2ZW50LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGNoYW5nZWRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2ZW50LnRhcmdldFxuICAgKi9cbiAgJ2NoYW5uZWxzOmNoYW5nZSddLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuXG5Sb290LmluaXRDbGFzcy5hcHBseShDaGFubmVsLCBbQ2hhbm5lbCwgJ0NoYW5uZWwnXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQ2hhbm5lbCk7XG5tb2R1bGUuZXhwb3J0cyA9IENoYW5uZWw7XG4iXX0=
