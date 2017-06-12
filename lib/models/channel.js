'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
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
 * @experimental This feature is incomplete, and available as Preview only.
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
  }, {
    key: '_setupMessage',
    value: function _setupMessage(message) {
      message.position = Channel.nextPosition;
      Channel.nextPosition += 8192;
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
      this._inPopulateFromServer = true;

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
      var channel = data.data;
      if (channel) {
        this._createSuccess(channel);
      } else {
        this.syncState = Constants.SYNC_STATE.NEW;
        this._syncCounter = 0;
        this.trigger('channels:sent-error', { error: data });
      }

      this._inPopulateFromServer = false;
    }
  }, {
    key: '__adjustName',
    value: function __adjustName(newValue) {
      if (this._inPopulateFromServer || this._inLayerParser || this.isNew() || this.isLoading) return;
      throw new Error(LayerError.dictionary.permissionDenied);
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
     * LayerPatch will call this after changing any properties.
     *
     * Trigger any cleanup or events needed after these changes.
     *
     * TODO: Move this to layer.Container
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
        _get(Channel.prototype.__proto__ || Object.getPrototypeOf(Channel.prototype), '_handlePatchEvent', this).call(this, newValue, oldValue, paths);
        this._disableEvents = events;
      } catch (err) {
        // do nothing
      }
      this._inLayerParser = true;
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
      if (!result.success && (!result.data || result.data.id !== 'not_found' && result.data.id !== 'authentication_required')) {
        Channel.load(id, client);
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY2hhbm5lbC5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlN5bmNhYmxlIiwiQ29udGFpbmVyIiwiQ2hhbm5lbE1lc3NhZ2UiLCJMYXllckVycm9yIiwiTGF5ZXJFdmVudCIsIlV0aWwiLCJDb25zdGFudHMiLCJDaGFubmVsIiwib3B0aW9ucyIsIm1lbWJlcnNoaXAiLCJfbWVtYmVycyIsImdldENsaWVudCIsIl9maXhJZGVudGl0aWVzIiwibWVtYmVycyIsIm1hcCIsIml0ZW0iLCJpZCIsIl9yZWdpc3RlciIsImxhc3RNZXNzYWdlIiwiX3JlbW92ZUNoYW5uZWwiLCJtZXNzYWdlQ29uZmlnIiwicGFydHMiLCJib2R5IiwibWltZVR5cGUiLCJjbGllbnRJZCIsImNvbnZlcnNhdGlvbklkIiwibWVzc2FnZSIsInBvc2l0aW9uIiwibmV4dFBvc2l0aW9uIiwiZGF0YSIsImlzTWV0YWRhdGFFbXB0eSIsImlzRW1wdHkiLCJtZXRhZGF0YSIsImluZGV4T2YiLCJ1c2VyIiwicHVzaCIsIm1ldGhvZCIsIm5hbWUiLCJjaGFubmVsIiwiX2luUG9wdWxhdGVGcm9tU2VydmVyIiwiX2Rpc2FibGVFdmVudHMiLCJzeW5jU3RhdGUiLCJTWU5DX1NUQVRFIiwiTkVXIiwiaXNDdXJyZW50UGFydGljaXBhbnQiLCJCb29sZWFuIiwiX2NyZWF0ZU9iamVjdCIsIl9jcmVhdGVTdWNjZXNzIiwiX3N5bmNDb3VudGVyIiwidHJpZ2dlciIsImVycm9yIiwibmV3VmFsdWUiLCJfaW5MYXllclBhcnNlciIsImlzTmV3IiwiaXNMb2FkaW5nIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwicGVybWlzc2lvbkRlbmllZCIsIm9sZFZhbHVlIiwiX3RyaWdnZXJBc3luYyIsInByb3BlcnR5IiwiY29uY2F0IiwiZm9yRWFjaCIsImlkZW50aXR5SWQiLCJfeGhyIiwidXJsIiwicmVwbGFjZSIsImluZGV4Iiwic3BsaWNlIiwiYWRkTWVtYmVycyIsInJlbW92ZU1lbWJlcnMiLCJtZW1iZXJzaGlwSWQiLCJnZXRNZW1iZXIiLCJfZGVsZXRlIiwicGF0aHMiLCJldmVudHMiLCJlcnIiLCJjbGllbnQiLCJfYWRkQ2hhbm5lbCIsInJlc3VsdCIsInN1Y2Nlc3MiLCJsb2FkIiwiX3RvT2JqZWN0IiwiY2xvbmUiLCJmcm9tU2VydmVyIiwiX2Zyb21EQiIsImNsaWVudE1pc3NpbmciLCJTdHJpbmciLCJNYXRoIiwicmFuZG9tIiwibmV3T3B0aW9ucyIsInByaXZhdGUiLCJmaW5kQ2FjaGVkQ2hhbm5lbCIsImFDaGFubmVsIiwiX3NlbmREaXN0aW5jdEV2ZW50IiwidGFyZ2V0IiwiZG9lc09iamVjdE1hdGNoIiwiRk9VTkQiLCJGT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSIsInByb3RvdHlwZSIsImV2ZW50UHJlZml4IiwicHJlZml4VVVJRCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJpbml0Q2xhc3MiLCJhcHBseSIsInN1YmNsYXNzZXMiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbURBLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsV0FBV0QsUUFBUSxZQUFSLENBQWpCO0FBQ0EsSUFBTUUsWUFBWUYsUUFBUSxhQUFSLENBQWxCO0FBQ0EsSUFBTUcsaUJBQWlCSCxRQUFRLG1CQUFSLENBQXZCO0FBQ0EsSUFBTUksYUFBYUosUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1LLGFBQWFMLFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNTSxPQUFPTixRQUFRLGlCQUFSLENBQWI7QUFDQSxJQUFNTyxZQUFZUCxRQUFRLFVBQVIsQ0FBbEI7O0lBRU1RLE87OztBQUNKLHFCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQSxRQUFJLENBQUNBLFFBQVFDLFVBQWIsRUFB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UUEsaUJBckR5Qjs7QUF1RHpCOzs7Ozs7Ozs7OztBQVdBLGlCQWxFeUIsRUFrRU56QyxNQWxFTSxDQWtFQzdELFNBQVNzRyxnQkFsRVYsQ0FBM0I7O0FBcUVBeEcsS0FBS3lHLFNBQUwsQ0FBZUMsS0FBZixDQUFxQmpHLE9BQXJCLEVBQThCLENBQUNBLE9BQUQsRUFBVSxTQUFWLENBQTlCO0FBQ0FQLFNBQVN5RyxVQUFULENBQW9CdEUsSUFBcEIsQ0FBeUI1QixPQUF6QjtBQUNBbUcsT0FBT0MsT0FBUCxHQUFpQnBHLE9BQWpCIiwiZmlsZSI6ImNoYW5uZWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgQ2hhbm5lbCBvYmplY3QgcmVwcmVzZW50cyBhIGRpYWxvZyBhbW9uZ3N0IGEgbGFyZ2Ugc2V0XG4gKiBvZiBwYXJ0aWNpcGFudHMuXG4gKlxuICogYGBgXG4gKiB2YXIgY2hhbm5lbCA9IGNsaWVudC5jcmVhdGVDaGFubmVsKHtcbiAqICAgbmFtZTogXCJmcm9kby10aGUtZG9kb1wiLFxuICogICBtZW1iZXJzOiBbXCJsYXllcjovLy9pZGVudGl0aWVzL3NhbXdpc2VcIiwgXCJsYXllcjovLy9pZGVudGl0aWVzL29yYy1hcm15XCJdLFxuICogICBtZXRhZGF0YToge1xuICogICAgIHN1YnRvcGljOiBcIlNhdXJ1bWFuIGlzIHRoZSBtYW4uICBBbmQgYSBTYXVyaWFuXCIsXG4gKiAgICAgdG9vTXVjaEluZm86IHtcbiAqICAgICAgIG5vc2U6IFwic3R1ZmZlZFwiXG4gKiAgICAgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiBjaGFubmVsLmNyZWF0ZU1lc3NhZ2UoXCJQbGVhc2UgZG9uJ3QgZWF0IG1lXCIpLnNlbmQoKTtcbiAqIGBgYFxuICogTk9URTogU2VuZGluZyBhIE1lc3NhZ2UgY3JlYXRlcyB0aGUgQ2hhbm5lbDsgdGhpcyBhdm9pZHMgaGF2aW5nIGxvdHMgb2YgdW51c2VkIGNoYW5uZWxzIGJlaW5nIGNyZWF0ZWQuXG4gKlxuICogS2V5IG1ldGhvZHMsIGV2ZW50cyBhbmQgcHJvcGVydGllcyBmb3IgZ2V0dGluZyBzdGFydGVkOlxuICpcbiAqIFByb3BlcnRpZXM6XG4gKlxuICogKiBsYXllci5DaGFubmVsLmlkOiB0aGlzIHByb3BlcnR5IGlzIHdvcnRoIGJlaW5nIGZhbWlsaWFyIHdpdGg7IGl0IGlkZW50aWZpZXMgdGhlXG4gKiAgIENoYW5uZWwgYW5kIGNhbiBiZSB1c2VkIGluIGBjbGllbnQuZ2V0Q2hhbm5lbChpZClgIHRvIHJldHJpZXZlIGl0LlxuICogKiBsYXllci5DaGFubmVsLm5hbWU6IHRoaXMgcHJvcGVydHkgbmFtZXMgdGhlIGNoYW5uZWw7IHRoaXMgbWF5IGJlIGh1bWFuIHJlYWRhYmxlLCB0aG91Z2ggZm9yIGxvY2FsaXphdGlvbiBwdXJwb3NlcyxcbiAqICAgeW91IG1heSBpbnN0ZWFkIHdhbnQgdG8gdXNlIGEgY29tbW9uIG5hbWUgdGhhdCBpcyBkaXN0aW5jdCBmcm9tIHlvdXIgZGlzcGxheWVkIG5hbWUuICBUaGVyZSBjYW4gb25seSBiZSBhIHNpbmdsZVxuICogICBjaGFubmVsIHdpdGggYSBnaXZlbiBuYW1lIHBlciBhcHAuXG4gKiAqIGxheWVyLkNoYW5uZWwubWVtYmVyc2hpcDogQ29udGFpbnMgc3RhdHVzIGluZm9ybWF0aW9uIGFib3V0IHlvdXIgdXNlcidzIHJvbGUgaW4gdGhpcyBDaGFubmVsLlxuICogKiBsYXllci5DaGFubmVsLmlzQ3VycmVudFBhcnRpY2lwYW50OiBTaG9ydGhhbmQgZm9yIGRldGVybWluaW5nIGlmIHlvdXIgdXNlciBpcyBhIG1lbWJlciBvZiB0aGUgQ2hhbm5lbC5cbiAqXG4gKiBNZXRob2RzOlxuICpcbiAqICogbGF5ZXIuQ2hhbm5lbC5qb2luKCkgdG8gam9pbiB0aGUgQ2hhbm5lbFxuICogKiBsYXllci5DaGFubmVsLmxlYXZlKCkgdG8gbGVhdmUgdGhlIENoYW5uZWxcbiAqICogbGF5ZXIuQ2hhbm5lbC5vbigpIGFuZCBsYXllci5DaGFubmVsLm9mZigpOiBldmVudCBsaXN0ZW5lcnMgYnVpbHQgb24gdG9wIG9mIHRoZSBgYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmVgIG5wbSBwcm9qZWN0XG4gKiAqIGxheWVyLkNoYW5uZWwuY3JlYXRlTWVzc2FnZSgpIHRvIHNlbmQgYSBtZXNzYWdlIG9uIHRoZSBDaGFubmVsLlxuICpcbiAqIEV2ZW50czpcbiAqXG4gKiAqIGBjaGFubmVsczpjaGFuZ2VgOiBVc2VmdWwgZm9yIG9ic2VydmluZyBjaGFuZ2VzIHRvIENoYW5uZWwgbmFtZVxuICogICBhbmQgdXBkYXRpbmcgcmVuZGVyaW5nIG9mIHlvdXIgQ2hhbm5lbFxuICpcbiAqIEZpbmFsbHksIHRvIGFjY2VzcyBhIGxpc3Qgb2YgTWVzc2FnZXMgaW4gYSBDaGFubmVsLCBzZWUgbGF5ZXIuUXVlcnkuXG4gKlxuICogQGNsYXNzICBsYXllci5DaGFubmVsXG4gKiBAZXhwZXJpbWVudGFsIFRoaXMgZmVhdHVyZSBpcyBpbmNvbXBsZXRlLCBhbmQgYXZhaWxhYmxlIGFzIFByZXZpZXcgb25seS5cbiAqIEBleHRlbmRzIGxheWVyLkNvbnRhaW5lclxuICogQGF1dGhvciAgTWljaGFlbCBLYW50b3JcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgQ29udGFpbmVyID0gcmVxdWlyZSgnLi9jb250YWluZXInKTtcbmNvbnN0IENoYW5uZWxNZXNzYWdlID0gcmVxdWlyZSgnLi9jaGFubmVsLW1lc3NhZ2UnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgTGF5ZXJFdmVudCA9IHJlcXVpcmUoJy4uL2xheWVyLWV2ZW50Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuXG5jbGFzcyBDaGFubmVsIGV4dGVuZHMgQ29udGFpbmVyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gU2V0dXAgZGVmYXVsdCB2YWx1ZXNcbiAgICBpZiAoIW9wdGlvbnMubWVtYmVyc2hpcCkgb3B0aW9ucy5tZW1iZXJzaGlwID0ge307XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbWVtYmVycyA9IHRoaXMuZ2V0Q2xpZW50KCkuX2ZpeElkZW50aXRpZXMob3B0aW9ucy5tZW1iZXJzIHx8IFtdKS5tYXAoaXRlbSA9PiBpdGVtLmlkKTtcbiAgICB0aGlzLl9yZWdpc3RlcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgdGhlIGxvY2FsIGNvcHkgb2YgdGhpcyBDaGFubmVsLCBjbGVhbmluZyB1cCBhbGwgcmVzb3VyY2VzXG4gICAqIGl0IGNvbnN1bWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5sYXN0TWVzc2FnZSA9IG51bGw7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fcmVtb3ZlQ2hhbm5lbCh0aGlzKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgdGhpcy5tZW1iZXJzaGlwID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZSBpbnN0YW5jZSB3aXRoaW4gdGhpcyBjb252ZXJzYXRpb25cbiAgICpcbiAgICogICAgICB2YXIgbWVzc2FnZSA9IGNoYW5uZWwuY3JlYXRlTWVzc2FnZSgnaGVsbG8nKTtcbiAgICpcbiAgICogICAgICB2YXIgbWVzc2FnZSA9IGNoYW5uZWwuY3JlYXRlTWVzc2FnZSh7XG4gICAqICAgICAgICAgIHBhcnRzOiBbbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtcbiAgICogICAgICAgICAgICAgICAgICAgICAgYm9keTogJ2hlbGxvJyxcbiAgICogICAgICAgICAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICAgKiAgICAgICAgICAgICAgICAgIH0pXVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBTZWUgbGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZSBmb3IgbW9yZSBvcHRpb25zIGZvciBjcmVhdGluZyB0aGUgbWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVNZXNzYWdlXG4gICAqIEBwYXJhbSAge1N0cmluZ3xPYmplY3R9IG9wdGlvbnMgLSBJZiBpdHMgYSBzdHJpbmcsIGEgTWVzc2FnZVBhcnQgaXMgY3JlYXRlZCBhcm91bmQgdGhhdCBzdHJpbmcuXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVBhcnRbXX0gb3B0aW9ucy5wYXJ0cyAtIEFuIGFycmF5IG9mIE1lc3NhZ2VQYXJ0cy4gIFRoZXJlIGlzIHNvbWUgdG9sZXJhbmNlIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgbm90IGJlaW5nIGFuIGFycmF5LCBvciBmb3IgaXQgYmVpbmcgYSBzdHJpbmcgdG8gYmUgdHVybmVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRvIGEgTWVzc2FnZVBhcnQuXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ2hhbm5lbE1lc3NhZ2V9XG4gICAqL1xuICBjcmVhdGVNZXNzYWdlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IG1lc3NhZ2VDb25maWcgPSAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSA/IHtcbiAgICAgIHBhcnRzOiBbeyBib2R5OiBvcHRpb25zLCBtaW1lVHlwZTogJ3RleHQvcGxhaW4nIH1dLFxuICAgIH0gOiBvcHRpb25zO1xuICAgIG1lc3NhZ2VDb25maWcuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgIG1lc3NhZ2VDb25maWcuY29udmVyc2F0aW9uSWQgPSB0aGlzLmlkO1xuXG4gICAgcmV0dXJuIG5ldyBDaGFubmVsTWVzc2FnZShtZXNzYWdlQ29uZmlnKTtcbiAgfVxuXG4gIF9zZXR1cE1lc3NhZ2UobWVzc2FnZSkge1xuICAgIG1lc3NhZ2UucG9zaXRpb24gPSBDaGFubmVsLm5leHRQb3NpdGlvbjtcbiAgICBDaGFubmVsLm5leHRQb3NpdGlvbiArPSA4MTkyO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGRhdGEgZm9yIGEgQ3JlYXRlIHJlcXVlc3QuXG4gICAqXG4gICAqIFRoZSBsYXllci5TeW5jTWFuYWdlciBuZWVkcyBhIGNhbGxiYWNrIHRvIGNyZWF0ZSB0aGUgQ29udmVyc2F0aW9uIGFzIGl0XG4gICAqIGxvb2tzIE5PVywgbm90IGJhY2sgd2hlbiBgc2VuZCgpYCB3YXMgY2FsbGVkLiAgVGhpcyBtZXRob2QgaXMgY2FsbGVkXG4gICAqIGJ5IHRoZSBsYXllci5TeW5jTWFuYWdlciB0byBwb3B1bGF0ZSB0aGUgUE9TVCBkYXRhIG9mIHRoZSBjYWxsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRTZW5kRGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFdlYnNvY2tldCBkYXRhIGZvciB0aGUgcmVxdWVzdFxuICAgKi9cbiAgX2dldFNlbmREYXRhKGRhdGEpIHtcbiAgICBjb25zdCBpc01ldGFkYXRhRW1wdHkgPSBVdGlsLmlzRW1wdHkodGhpcy5tZXRhZGF0YSk7XG4gICAgY29uc3QgbWVtYmVycyA9IHRoaXMuX21lbWJlcnMgfHwgW107XG4gICAgaWYgKG1lbWJlcnMuaW5kZXhPZih0aGlzLmdldENsaWVudCgpLnVzZXIuaWQpID09PSAtMSkgbWVtYmVycy5wdXNoKHRoaXMuZ2V0Q2xpZW50KCkudXNlci5pZCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1ldGhvZDogJ0NoYW5uZWwuY3JlYXRlJyxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgICBtZXRhZGF0YTogaXNNZXRhZGF0YUVtcHR5ID8gbnVsbCA6IHRoaXMubWV0YWRhdGEsXG4gICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICBtZW1iZXJzLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cblxuICBfcG9wdWxhdGVGcm9tU2VydmVyKGNoYW5uZWwpIHtcbiAgICB0aGlzLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IHRydWU7XG5cbiAgICAvLyBEaXNhYmxlIGV2ZW50cyBpZiBjcmVhdGluZyBhIG5ldyBDb252ZXJzYXRpb25cbiAgICAvLyBXZSBzdGlsbCB3YW50IHByb3BlcnR5IGNoYW5nZSBldmVudHMgZm9yIGFueXRoaW5nIHRoYXQgRE9FUyBjaGFuZ2VcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gKHRoaXMuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpO1xuICAgIHRoaXMubmFtZSA9IGNoYW5uZWwubmFtZTtcblxuICAgIHRoaXMuaXNDdXJyZW50UGFydGljaXBhbnQgPSBCb29sZWFuKGNoYW5uZWwubWVtYmVyc2hpcCk7XG4gICAgdGhpcy5tZW1iZXJzaGlwID0gIWNoYW5uZWwubWVtYmVyc2hpcCB8fFxuICAgICAgIWNoYW5uZWwubWVtYmVyc2hpcC5pZCA/IG51bGwgOiB0aGlzLmdldENsaWVudCgpLl9jcmVhdGVPYmplY3QoY2hhbm5lbC5tZW1iZXJzaGlwKTtcblxuICAgIHN1cGVyLl9wb3B1bGF0ZUZyb21TZXJ2ZXIoY2hhbm5lbCk7XG4gICAgdGhpcy5fcmVnaXN0ZXIoKTtcblxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAgfVxuXG4gIF9jcmVhdGVSZXN1bHRDb25mbGljdChkYXRhKSB7XG4gICAgY29uc3QgY2hhbm5lbCA9IGRhdGEuZGF0YTtcbiAgICBpZiAoY2hhbm5lbCkge1xuICAgICAgdGhpcy5fY3JlYXRlU3VjY2VzcyhjaGFubmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zeW5jU3RhdGUgPSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVc7XG4gICAgICB0aGlzLl9zeW5jQ291bnRlciA9IDA7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5uZWxzOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgIH1cblxuICAgIHRoaXMuX2luUG9wdWxhdGVGcm9tU2VydmVyID0gZmFsc2U7XG4gIH1cblxuICBfX2FkanVzdE5hbWUobmV3VmFsdWUpIHtcbiAgICBpZiAodGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIgfHwgdGhpcy5faW5MYXllclBhcnNlciB8fCB0aGlzLmlzTmV3KCkgfHwgdGhpcy5pc0xvYWRpbmcpIHJldHVybjtcbiAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnBlcm1pc3Npb25EZW5pZWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgaW4gdGhlIG5hbWUgcHJvcGVydHkgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlTmFtZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb2xkVmFsdWVcbiAgICovXG4gIF9fdXBkYXRlTmFtZShuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NoYW5uZWxzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbmFtZScsXG4gICAgICBvbGRWYWx1ZSxcbiAgICAgIG5ld1ZhbHVlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgZm9sbG93aW5nIG1lbWJlcnMgdG8gdGhlIENoYW5uZWwuXG4gICAqXG4gICAqIFVubGlrZSBDb252ZXJzYXRpb25zLCBDaGFubmVscyBkbyBub3QgbWFpbnRhaW4gc3RhdGUgaW5mb3JtYXRpb24gYWJvdXQgdGhlaXIgbWVtYmVycy5cbiAgICogQXMgc3VjaCwgaWYgdGhlIG9wZXJhdGlvbiBmYWlscyB0aGVyZSBpcyBubyBhY3R1YWwgc3RhdGUgY2hhbmdlXG4gICAqIGZvciB0aGUgY2hhbm5lbC4gIEN1cnJlbnRseSB0aGUgb25seSBlcnJvcnMgZXhwb3NlZCBhcmUgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50LlN5bmNNYW5hZ2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIGFkZE1lbWJlcnNcbiAgICogQHBhcmFtIHtTdHJpbmdbXX0gbWVtYmVycyAgIElkZW50aXR5IElEcyBvZiB1c2VycyB0byBhZGQgdG8gdGhpcyBDaGFubmVsXG4gICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9IHRoaXNcbiAgICpcbiAgICpcbiAgICpcbiAgICpcbiAgICpcbiAgICogQGlnbm9yZSB1bnRpbCBzZXJ2ZXIgc3VwcG9ydHMgaXRcbiAgICovXG4gIGFkZE1lbWJlcnMobWVtYmVycykge1xuICAgIG1lbWJlcnMgPSB0aGlzLmdldENsaWVudCgpLl9maXhJZGVudGl0aWVzKG1lbWJlcnMpLm1hcChpdGVtID0+IGl0ZW0uaWQpO1xuICAgIGlmICh0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSB7XG4gICAgICB0aGlzLl9tZW1iZXJzID0gdGhpcy5fbWVtYmVycy5jb25jYXQobWVtYmVycyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBTaG91bGQgdXNlIHRoZSBidWxrIG9wZXJhdGlvbiB3aGVuIGl0IGJlY29tZXMgYXZhaWxhYmxlLlxuICAgIG1lbWJlcnMuZm9yRWFjaCgoaWRlbnRpdHlJZCkgPT4ge1xuICAgICAgdGhpcy5feGhyKHtcbiAgICAgICAgdXJsOiAnL21lbWJlcnMvJyArIGlkZW50aXR5SWQucmVwbGFjZSgvXmxheWVyOlxcL1xcL1xcL2lkZW50aXRpZXNcXC8vLCAnJyksXG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGZvbGxvd2luZyBtZW1iZXJzIGZyb20gdGhlIENoYW5uZWwuXG4gICAqXG4gICAqIE5vdCB5ZXQgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHJlbW92ZU1lbWJlcnNcbiAgICogQHBhcmFtIHtTdHJpbmdbXX0gbWVtYmVycyAgIElkZW50aXR5IElEcyBvZiB1c2VycyB0byByZW1vdmUgZnJvbSB0aGlzIENoYW5uZWxcbiAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH0gdGhpc1xuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKiBAaWdub3JlIHVudGlsIHNlcnZlciBzdXBwb3J0cyBpdFxuICAgKi9cbiAgcmVtb3ZlTWVtYmVycyhtZW1iZXJzKSB7XG4gICAgbWVtYmVycyA9IHRoaXMuZ2V0Q2xpZW50KCkuX2ZpeElkZW50aXRpZXMobWVtYmVycykubWFwKGl0ZW0gPT4gaXRlbS5pZCk7XG5cbiAgICBpZiAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykge1xuICAgICAgbWVtYmVycy5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX21lbWJlcnMuaW5kZXhPZihpZCk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHRoaXMuX21lbWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogU2hvdWxkIHVzZSB0aGUgYnVsayBvcGVyYXRpb24gd2hlbiBpdCBiZWNvbWVzIGF2YWlsYWJsZS5cbiAgICBtZW1iZXJzLmZvckVhY2goKGlkZW50aXR5SWQpID0+IHtcbiAgICAgIHRoaXMuX3hocih7XG4gICAgICAgIHVybDogJy9tZW1iZXJzLycgKyBpZGVudGl0eUlkLnJlcGxhY2UoL15sYXllcjpcXC9cXC9cXC9pZGVudGl0aWVzXFwvLywgJycpLFxuICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkIHRoZSBjdXJyZW50IHVzZXIgdG8gdGhpcyBjaGFubmVsLlxuICAgKlxuICAgKiBAbWV0aG9kIGpvaW5cbiAgICogQHJldHVybiB7bGF5ZXIuQ2hhbm5lbH0gdGhpc1xuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKlxuICAgKiBAaWdub3JlIHVudGlsIHNlcnZlciBzdXBwb3J0cyBpdFxuICAgKi9cbiAgam9pbigpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRNZW1iZXJzKFt0aGlzLmdldENsaWVudCgpLnVzZXIuaWRdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiByZW1vdmUgdGhlIGN1cnJlbnQgdXNlciBmcm9tIHRoaXMgY2hhbm5lbC5cbiAgICpcbiAgICogQG1ldGhvZCBsZWF2ZVxuICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfSB0aGlzXG4gICAqXG4gICAqXG4gICAqXG4gICAqXG4gICAqIEBpZ25vcmUgdW50aWwgc2VydmVyIHN1cHBvcnRzIGl0XG4gICAqL1xuICBsZWF2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdmVNZW1iZXJzKFt0aGlzLmdldENsaWVudCgpLnVzZXIuaWRdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBNZW1iZXJzaGlwIG9iamVjdCBmb3IgdGhlIHNwZWNpZmllZCBJZGVudGl0eSBJRC5cbiAgICpcbiAgICogSWYgYG1lbWJlcnM6bG9hZGVkYCBpcyB0cmlnZ2VyZWQsIHRoZW4geW91ciBtZW1iZXJzaGlwIG9iamVjdFxuICAgKiBoYXMgYmVlbiBwb3B1bGF0ZWQgd2l0aCBkYXRhLlxuICAgKlxuICAgKiBJZiBgbWVtYmVyczpsb2FkZWQtZXJyb3JgIGlzIHRyaWdnZXJlZCwgdGhlbiB5b3VyIG1lbWJlcnNoaXAgb2JqZWN0XG4gICAqIGNvdWxkIG5vdCBiZSBsb2FkZWQsIGVpdGhlciB5b3UgaGF2ZSBhIGNvbm5lY3Rpb24gZXJyb3IsIG9yIHRoZSB1c2VyIGlzIG5vdCBhIG1lbWJlci5cbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBtZW1iZXJzaGlwID0gY2hhbm5lbC5nZXRNZW1iZXIoJ0Zyb2RvVGhlRG9kbycpO1xuICAgKiBtZW1iZXJzaGlwLm9uKCdtZW1iZXJzaGlwOmxvYWRlZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBhbGVydCgnSGUgSVMgYSBtZW1iZXIsIHF1aWNrLCBraWNrIGhpbSBvdXQhJyk7XG4gICAqIH0pO1xuICAgKiBtZW1iZXJzaGlwLm9uKCdtZW1iZXJzaGlwOmxvYWRlZC1lcnJvcicsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBpZiAoZXZ0LmVycm9yLmlkID09PSAnbm90X2ZvdW5kJykge1xuICAgKiAgICAgIGFsZXJ0KCdTYXVydW1hbiwgaGUgaXMgd2l0aCB0aGUgRWx2ZXMhJyk7XG4gICAqICAgIH0gZWxzZSB7XG4gICAqICAgICAgYWxlcnQoJ1NhdXJ1bWFuLCB3b3VsZCB5b3UgcGxlYXNlIHBpY2sgdXAgeW91ciBQYWxhbnRpciBhbHJlYWR5PyBJIGNhbid0IGNvbm5lY3QhJyk7XG4gICAqICAgIH1cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKiBAbWV0aG9kIGdldE1lbWJlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWRlbnRpdHlJZFxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVtYmVyc2hpcH1cbiAgICovXG4gIGdldE1lbWJlcihpZGVudGl0eUlkKSB7XG4gICAgaWRlbnRpdHlJZCA9IHRoaXMuZ2V0Q2xpZW50KCkuX2ZpeElkZW50aXRpZXMoW2lkZW50aXR5SWRdKVswXS5pZDtcbiAgICBjb25zdCBtZW1iZXJzaGlwSWQgPSB0aGlzLmlkICsgJy9tZW1iZXJzLycgKyBpZGVudGl0eUlkLnJlcGxhY2UoL2xheWVyOlxcL1xcL1xcL2lkZW50aXRpZXNcXC8vLCAnJyk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q2xpZW50KCkuZ2V0TWVtYmVyKG1lbWJlcnNoaXBJZCwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBjaGFubmVsOyBub3QgY3VycmVudGx5IHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVcbiAgICovXG4gIGRlbGV0ZSgpIHtcbiAgICB0aGlzLl9kZWxldGUoJycpO1xuICB9XG5cbiAgLyoqXG4gICAqIExheWVyUGF0Y2ggd2lsbCBjYWxsIHRoaXMgYWZ0ZXIgY2hhbmdpbmcgYW55IHByb3BlcnRpZXMuXG4gICAqXG4gICAqIFRyaWdnZXIgYW55IGNsZWFudXAgb3IgZXZlbnRzIG5lZWRlZCBhZnRlciB0aGVzZSBjaGFuZ2VzLlxuICAgKlxuICAgKiBUT0RPOiBNb3ZlIHRoaXMgdG8gbGF5ZXIuQ29udGFpbmVyXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBhdGNoRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7TWl4ZWR9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0gIHtNaXhlZH0gb2xkVmFsdWUgLSBQcmlvciB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICogQHBhcmFtICB7c3RyaW5nW119IHBhdGhzIC0gQXJyYXkgb2YgcGF0aHMgc3BlY2lmaWNhbGx5IG1vZGlmaWVkOiBbJ3BhcnRpY2lwYW50cyddLCBbJ21ldGFkYXRhLmtleUEnLCAnbWV0YWRhdGEua2V5QiddXG4gICAqL1xuICBfaGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSB7XG4gICAgLy8gQ2VydGFpbiB0eXBlcyBvZiBfX3VwZGF0ZSBoYW5kbGVycyBhcmUgZGlzYWJsZWQgd2hpbGUgdmFsdWVzIGFyZSBiZWluZyBzZXQgYnlcbiAgICAvLyBsYXllciBwYXRjaCBwYXJzZXIgYmVjYXVzZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHNldHRpbmcgYSB2YWx1ZSAodHJpZ2dlcnMgYW4gZXZlbnQpXG4gICAgLy8gYW5kIGNoYW5nZSBhIHByb3BlcnR5IG9mIGEgdmFsdWUgKHRyaWdnZXJzIG9ubHkgdGhpcyBjYWxsYmFjaykgcmVzdWx0IGluIGluY29uc2lzdGVudFxuICAgIC8vIGJlaGF2aW9ycy4gIEVuYWJsZSB0aGVtIGxvbmcgZW5vdWdoIHRvIGFsbG93IF9fdXBkYXRlIGNhbGxzIHRvIGJlIG1hZGVcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX2Rpc2FibGVFdmVudHM7XG4gICAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gICAgICBzdXBlci5faGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBldmVudHM7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBkbyBub3RoaW5nXG4gICAgfVxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHRoaXMgQ2hhbm5lbCB3aXRoIHRoZSBDbGllbnRcbiAgICpcbiAgICogQG1ldGhvZCBfcmVnaXN0ZXJcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZWdpc3RlcigpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNsaWVudC5fYWRkQ2hhbm5lbCh0aGlzKTtcbiAgfVxuXG4gIF9kZWxldGVSZXN1bHQocmVzdWx0LCBpZCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IChyZXN1bHQuZGF0YS5pZCAhPT0gJ25vdF9mb3VuZCcgJiYgcmVzdWx0LmRhdGEuaWQgIT09ICdhdXRoZW50aWNhdGlvbl9yZXF1aXJlZCcpKSkge1xuICAgICAgQ2hhbm5lbC5sb2FkKGlkLCBjbGllbnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIENvbnZlcnNhdGlvbiBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcy5cbiAgICovXG4gIHRvT2JqZWN0KCkge1xuICAgIGlmICghdGhpcy5fdG9PYmplY3QpIHtcbiAgICAgIHRoaXMuX3RvT2JqZWN0ID0gc3VwZXIudG9PYmplY3QoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0Lm1lbWJlcnNoaXAgPSBVdGlsLmNsb25lKHRoaXMubWVtYmVyc2hpcCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjaGFubmVsIGluc3RhbmNlIGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNoYW5uZWwuXG4gICAqXG4gICAqIElmIHRoZSBDaGFubmVsIGFscmVhZHkgZXhpc3RzLCB3aWxsIHVwZGF0ZSB0aGUgZXhpc3RpbmcgY29weSB3aXRoXG4gICAqIHByZXN1bWFibHkgbmV3ZXIgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNoYW5uZWwgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBDaGFubmVsXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoY2hhbm5lbCwgY2xpZW50KSB7XG4gICAgcmV0dXJuIG5ldyBDaGFubmVsKHtcbiAgICAgIGNsaWVudCxcbiAgICAgIGZyb21TZXJ2ZXI6IGNoYW5uZWwsXG4gICAgICBfZnJvbURCOiBjaGFubmVsLl9mcm9tREIsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBvciBjcmVhdGUgYSBuZXcgQ2hhbm5lbC5cbiAgICpcbiAgICogICAgICB2YXIgY2hhbm5lbCA9IGxheWVyLkNoYW5uZWwuY3JlYXRlKHtcbiAgICogICAgICAgICAgbWVtYmVyczogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgcHJpdmF0ZTogdHJ1ZSxcbiAgICogICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICogICAgICAgICAgICAgIHRpdGxlRGV0YWlsczogJ0kgYW0gbm90IGEgZGV0YWlsISdcbiAgICogICAgICAgICAgfSxcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgICdjaGFubmVsczpsb2FkZWQnOiBmdW5jdGlvbihldnQpIHtcbiAgICpcbiAgICogICAgICAgICAgfVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBSZWNvbW1lbmQgdXNpbmcgYGNsaWVudC5jcmVhdGVDaGFubmVsKHsuLi59KWBcbiAgICogaW5zdGVhZCBvZiBgQ2hhbm5lbC5jcmVhdGUoey4uLn0pYC5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMubWVtYmVycyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBsYXllci5JZGVudGl0eSBvYmplY3RzIHRvIGNyZWF0ZSBhIGNoYW5uZWwgd2l0aC5cbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcml2YXRlPWZhbHNlXSAtIENyZWF0ZSBhIHByaXZhdGUgY2hhbm5lbFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubWV0YWRhdGE9e31dIC0gSW5pdGlhbCBtZXRhZGF0YSBmb3IgQ2hhbm5lbFxuICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfVxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZShvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkgb3B0aW9ucy5uYW1lID0gJ2NoYW5uZWwtJyArIFN0cmluZyhNYXRoLnJhbmRvbSgpKS5yZXBsYWNlKC9cXC4vLCAnJyk7XG4gICAgY29uc3QgbmV3T3B0aW9ucyA9IHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHByaXZhdGU6IG9wdGlvbnMucHJpdmF0ZSxcbiAgICAgIG1lbWJlcnM6IG9wdGlvbnMubWVtYmVycyA/IG9wdGlvbnMuY2xpZW50Ll9maXhJZGVudGl0aWVzKG9wdGlvbnMubWVtYmVycykubWFwKGl0ZW0gPT4gaXRlbS5pZCkgOiBbXSxcbiAgICAgIG1ldGFkYXRhOiBvcHRpb25zLm1ldGFkYXRhLFxuICAgICAgY2xpZW50OiBvcHRpb25zLmNsaWVudCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2hhbm5lbCA9IG9wdGlvbnMuY2xpZW50LmZpbmRDYWNoZWRDaGFubmVsKGFDaGFubmVsID0+IGFDaGFubmVsLm5hbWUgPT09IG5ld09wdGlvbnMubmFtZSk7XG5cbiAgICBpZiAoY2hhbm5lbCkge1xuICAgICAgY2hhbm5lbC5fc2VuZERpc3RpbmN0RXZlbnQgPSBuZXcgTGF5ZXJFdmVudCh7XG4gICAgICAgIHRhcmdldDogY2hhbm5lbCxcbiAgICAgICAgcmVzdWx0OiAhb3B0aW9ucy5tZXRhZGF0YSB8fCBVdGlsLmRvZXNPYmplY3RNYXRjaChvcHRpb25zLm1ldGFkYXRhLCBjaGFubmVsLm1ldGFkYXRhKSA/XG4gICAgICAgICAgQ2hhbm5lbC5GT1VORCA6IENoYW5uZWwuRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEsXG4gICAgICB9LCAnY2hhbm5lbHM6c2VudCcpO1xuICAgIH1cblxuICAgIHJldHVybiBjaGFubmVsIHx8IG5ldyBDaGFubmVsKG5ld09wdGlvbnMpO1xuICB9XG59XG5cbi8qKlxuICogVGhlIENoYW5uZWwncyBuYW1lOyB0aGlzIG11c3QgYmUgdW5pcXVlLlxuICpcbiAqIE5vdGUgdGhhdCB3aGlsZSB5b3UgY2FuIHVzZSBhIGRpc3BsYXlhYmxlIGh1bWFuIHJlYWRhYmxlIG5hbWUsIHlvdSBtYXkgYWxzbyBjaG9vc2UgdG8gdXNlIHRoaXNcbiAqIGFzIGFuIElEIHRoYXQgeW91IGNhbiBlYXNpbHkgbG9jYWxpemUgdG8gZGlmZmVyZW50IGxhbmd1YWdlcy5cbiAqXG4gKiBNdXN0IG5vdCBiZSBhIFVVSUQuXG4gKlxuICogQHByb3BlcnR5IHtTdHJpbmd9IG5hbWVcbiAqL1xuQ2hhbm5lbC5wcm90b3R5cGUubmFtZSA9ICcnO1xuXG4vKipcbiAqIFRoZSBgbWVtYmVyc2hpcGAgb2JqZWN0IGNvbnRhaW5zIGRldGFpbHMgb2YgdGhpcyB1c2VyJ3MgbWVtYmVyc2hpcCB3aXRoaW4gdGhpcyBjaGFubmVsLlxuICpcbiAqIE5PVEU6IEluaXRpYWxseSwgb25seSBgaXNNZW1iZXJgIHdpbGwgYmUgYXZhaWxhYmxlLlxuICpcbiAqIGBgYFxuICoge1xuICogICAgIFwiaXNNZW1iZXJcIjogdHJ1ZSxcbiAqICAgICBcInJvbGVcIjogXCJ1c2VyXCIsXG4gKiAgICAgXCJsYXN0VW5yZWFkTWVzc2FnZUlkOiBcImxheWVyOi8vL21lc3NhZ2VzL1VVSURcIlxuICogfVxuICogYGBgXG4gKiBAcHJvcGVydHkge09iamVjdH1cbiAqL1xuQ2hhbm5lbC5wcm90b3R5cGUubWVtYmVyc2hpcCA9IG51bGw7XG5cbkNoYW5uZWwucHJvdG90eXBlLl9tZW1iZXJzID0gbnVsbDtcblxuQ2hhbm5lbC5ldmVudFByZWZpeCA9ICdjaGFubmVscyc7XG5cbi8vIE1hdGgucG93KDIsIDY0KTsgYSBudW1iZXIgbGFyZ2VyIHRoYW4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIGFuZCBsYXJnZXIgdGhhbiBKYXZhJ3MgTWF4IFVuc2lnbmVkIExvbmcuIEFuZCBhbiBlYXN5IHRvIHdvcmsgd2l0aFxuLy8gZmFjdG9yIG9mIDJcbkNoYW5uZWwubmV4dFBvc2l0aW9uID0gMTg0NDY3NDQwNzM3MDk1NTIwMDA7XG5cbi8qKlxuICogUHJlZml4IHRvIHVzZSB3aGVuIGdlbmVyYXRpbmcgYW4gSUQgZm9yIGluc3RhbmNlcyBvZiB0aGlzIGNsYXNzXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqL1xuQ2hhbm5lbC5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2NoYW5uZWxzLyc7XG5cbkNoYW5uZWwuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBpcyBub3cgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGFmdGVyIHN1Y2Nlc3NmdWxseSBjcmVhdGluZyB0aGUgY29udmVyc2F0aW9uXG4gICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICpcbiAgICogKiBDaGFubmVsLkNSRUFURUQ6IEEgbmV3IENoYW5uZWwgaGFzIGJlZW4gY3JlYXRlZFxuICAgKiAqIENoYW5uZWwuRk9VTkQ6IEEgbWF0Y2hpbmcgbmFtZWQgQ2hhbm5lbCBoYXMgYmVlbiBmb3VuZFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQucmVzdWx0XG4gICAqL1xuICAnY2hhbm5lbHM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEFuIGF0dGVtcHQgdG8gc2VuZCB0aGlzIGNoYW5uZWwgdG8gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGV2ZW50LmVycm9yXG4gICAqL1xuICAnY2hhbm5lbHM6c2VudC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuQ2hhbm5lbC5sb2FkKCkgbWV0aG9kLlxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqL1xuICAnY2hhbm5lbHM6bG9hZGVkJyxcblxuICAvKipcbiAgICogQW4gYXR0ZW1wdCB0byBsb2FkIHRoaXMgY29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciBoYXMgZmFpbGVkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLkNoYW5uZWwubG9hZCgpIG1ldGhvZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2NoYW5uZWxzOmxvYWRlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaGFzIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhdXNlZCBieSBlaXRoZXIgYSBzdWNjZXNzZnVsIGNhbGwgdG8gZGVsZXRlKCkgb24gdGhpcyBpbnN0YW5jZVxuICAgKiBvciBieSBhIHJlbW90ZSB1c2VyLlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKi9cbiAgJ2NoYW5uZWxzOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIFRoaXMgY2hhbm5lbCBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZlbnQuY2hhbmdlcyAtIEFycmF5IG9mIGNoYW5nZXMgcmVwb3J0ZWQgYnkgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBldmVudC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2ZW50LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGNoYW5nZWRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2ZW50LnRhcmdldFxuICAgKi9cbiAgJ2NoYW5uZWxzOmNoYW5nZSddLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuXG5Sb290LmluaXRDbGFzcy5hcHBseShDaGFubmVsLCBbQ2hhbm5lbCwgJ0NoYW5uZWwnXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQ2hhbm5lbCk7XG5tb2R1bGUuZXhwb3J0cyA9IENoYW5uZWw7XG4iXX0=
