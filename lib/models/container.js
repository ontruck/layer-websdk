'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A Container is a parent class representing a container that manages a set of Messages.
 *
 * @class  layer.Container
 * @abstract
 * @extends layer.Syncable
 * @author  Michael Kantor
 */
var Syncable = require('./syncable');
var LayerError = require('../layer-error');
var Util = require('../client-utils');
var Constants = require('../const');
var Root = require('../root');

var Container = function (_Syncable) {
  _inherits(Container, _Syncable);

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
  function Container() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Container);

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) options.id = options.fromServer.id;

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;
    if (!options.metadata) options.metadata = {};

    var _this = _possibleConstructorReturn(this, (Container.__proto__ || Object.getPrototypeOf(Container)).call(this, options));

    if (!_this.clientId) throw new Error(LayerError.dictionary.clientMissing);
    _this.isInitializing = true;

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Conversation
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    if (!_this.metadata) _this.metadata = {};

    if (!_this.createdAt) {
      _this.createdAt = new Date();
    }
    _this.isInitializing = false;
    return _this;
  }

  _createClass(Container, [{
    key: 'send',
    value: function send(message) {
      var _this2 = this;

      if (this.isNew()) {
        this.createdAt = new Date();

        // Update the syncState
        this._setSyncing();

        this.getClient()._triggerAsync('state-change', {
          started: true,
          type: 'send_' + Util.typeFromID(this.id),
          telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
          id: this.id
        });
        this.getClient().sendSocketRequest({
          method: 'POST',
          body: {}, // see _getSendData
          sync: {
            depends: this.id,
            target: this.id
          }
        }, function (result) {
          return _this2._createResult(result);
        });
      }
      if (message) this._setupMessage(message);
      return this;
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} container - Server representation of the container
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(container) {
      var client = this.getClient();

      this._setSynced();

      var id = this.id;
      this.id = container.id;

      // IDs change if the server returns a matching Container
      if (id !== this.id) {
        client._updateContainerId(this, id);
        this._triggerAsync(this.constructor.eventPrefix + ':change', {
          oldValue: id,
          newValue: this.id,
          property: 'id'
        });
      }

      this.url = container.url;
      this.createdAt = new Date(container.created_at);
      this.metadata = container.metadata;
    }

    /**
     * Process result of send method.
     *
     * Note that we use _triggerAsync so that
     * events reporting changes to the layer.Conversation.id can
     * be applied before reporting on it being sent.
     *
     * Example: Query will now have the resolved Distinct IDs rather than the proposed ID
     * when this event is triggered.
     *
     * @method _createResult
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_createResult',
    value: function _createResult(_ref) {
      var success = _ref.success,
          data = _ref.data;

      this.getClient()._triggerAsync('state-change', {
        ended: true,
        type: 'send_' + Util.typeFromID(this.id),
        telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
        id: this.id
      });
      if (this.isDestroyed) return;
      if (success) {
        this._createSuccess(data);
      } else if (data.id === 'conflict') {
        this._createResultConflict(data);
      } else {
        this.trigger(this.constructor.eventPrefix + ':sent-error', { error: data });
        this.destroy();
      }
    }

    /**
     * Process the successful result of a create call
     *
     * @method _createSuccess
     * @private
     * @param  {Object} data Server description of Conversation/Channel
     */

  }, {
    key: '_createSuccess',
    value: function _createSuccess(data) {
      var id = this.id;
      this._populateFromServer(data);
      this._triggerAsync(this.constructor.eventPrefix + ':sent', {
        result: id === this.id ? Container.CREATED : Container.FOUND
      });
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
      var _this3 = this;

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
        if (!result.success && !_this3.isDestroyed && result.data.id !== 'authentication_required') _this3._load();
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
      var _this4 = this;

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
        if (!result.success && result.data.id !== 'authentication_required') _this4._load();
      });

      return this;
    }

    /**
     * Delete the Conversation from the server (internal version).
     *
     * This version of Delete takes a Query String that is packaged up by
     * layer.Conversation.delete and layer.Conversation.leave.
     *
     * @method _delete
     * @private
     * @param {string} queryStr - Query string for the DELETE request
     */

  }, {
    key: '_delete',
    value: function _delete(queryStr) {
      var _this5 = this;

      var id = this.id;
      this._xhr({
        method: 'DELETE',
        url: '?' + queryStr
      }, function (result) {
        return _this5._deleteResult(result, id);
      });

      this._deleted();
      this.destroy();
    }
  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      if (data.mode === Constants.DELETION_MODE.MY_DEVICES && data.from_position) {
        this.getClient()._purgeMessagesByPosition(this.id, data.from_position);
      } else {
        _get(Container.prototype.__proto__ || Object.getPrototypeOf(Container.prototype), '_handleWebsocketDelete', this).call(this);
      }
    }
  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this._register(this);
    }

    /**
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'conversations:loaded' so that calls such as
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          myrerender(c);
     *      });
     *      myrender(c); // render a placeholder for c until the details of c have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Conversation.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} callback
     * @param  {Object} context
     * @return {layer.Conversation} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var evtName = this.constructor.eventPrefix + ':loaded';
      var hasLoadedEvt = name === evtName || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name[evtName];

      if (hasLoadedEvt && !this.isLoading) {
        var callNow = name === evtName ? callback : name[evtName];
        Util.defer(function () {
          return callNow.apply(context);
        });
      }
      _get(Container.prototype.__proto__ || Object.getPrototypeOf(Container.prototype), 'on', this).call(this, name, callback, context);

      return this;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Container.prototype.__proto__ || Object.getPrototypeOf(Container.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Container.prototype.__proto__ || Object.getPrototypeOf(Container.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the metadata property will call this method and fire a
     * change event.  Changes to the metadata object that don't replace the object
     * with a new object will require directly calling this method.
     *
     * @method __updateMetadata
     * @private
     * @param  {Object} newValue
     * @param  {Object} oldValue
     */

  }, {
    key: '__updateMetadata',
    value: function __updateMetadata(newValue, oldValue, paths) {
      if (this._inLayerParser) return;
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        this._triggerAsync(this.constructor.eventPrefix + ':change', {
          property: 'metadata',
          newValue: newValue,
          oldValue: oldValue,
          paths: paths
        });
      }
    }
  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      if (paths[0].indexOf('metadata') === 0) {
        this.__updateMetadata(newValue, oldValue, paths);
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
        this._toObject = _get(Container.prototype.__proto__ || Object.getPrototypeOf(Container.prototype), 'toObject', this).call(this);
        this._toObject.metadata = Util.clone(this.metadata);
      }
      return this._toObject;
    }

    /**
     * Identifies whether a Conversation receiving the specified patch data should be loaded from the server.
     *
     * Any change to a Conversation indicates that the Conversation is active and of potential interest; go ahead and load that
     * Conversation in case the app has need of it.  In the future we may ignore changes to unread count.  Only relevant
     * when we get Websocket events for a Conversation that has not been loaded/cached on Client.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }], [{
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return true;
    }
  }]);

  return Container;
}(Syncable);

/**
 * Time that the conversation was created on the server.
 *
 * @type {Date}
 */


Container.prototype.createdAt = null;

/**
 * Metadata for the conversation.
 *
 * Metadata values can be plain objects and strings, but
 * no arrays, numbers, booleans or dates.
 * @type {Object}
 */
Container.prototype.metadata = null;

/**
 * The authenticated user is a current participant in this Conversation.
 *
 * Set to false if the authenticated user has been removed from this conversation.
 *
 * A removed user can see messages up to the time they were removed,
 * but can no longer interact with the conversation.
 *
 * A removed user can no longer see the participant list.
 *
 * Read and Delivery receipts will fail on any Message in such a Conversation.
 *
 * @type {Boolean}
 */
Container.prototype.isCurrentParticipant = true;

/**
 * Cache's a Distinct Event.
 *
 * On creating a Channel or Conversation that already exists,
 * when the send() method is called, we should trigger
 * specific events detailing the results.  Results
 * may be determined locally or on the server, but same Event may be needed.
 *
 * @type {layer.LayerEvent}
 * @private
 */
Container.prototype._sendDistinctEvent = null;

/**
 * Caches last result of toObject()
 * @type {Object}
 * @private
 */
Container.prototype._toObject = null;

/**
 * Property to look for when bubbling up events.
 * @type {String}
 * @static
 * @private
 */
Container.bubbleEventParent = 'getClient';

/**
 * The Conversation/Channel that was requested has been created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Container.CREATED = 'Created';

/**
 * The Conversation/Channel that was requested has been found.
 *
 * This means that it did not need to be created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Container.FOUND = 'Found';

/**
 * The Conversation/Channel that was requested has been found, but there was a mismatch in metadata.
 *
 * If the createConversation request contained metadata and it did not match the Distinct Conversation
 * that matched the requested participants, then this value is passed to notify your app that the Conversation
 * was returned but does not exactly match your request.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Container.FOUND_WITHOUT_REQUESTED_METADATA = 'FoundMismatch';

Root.initClass.apply(Container, [Container, 'Container']);
Syncable.subclasses.push(Container);
module.exports = Container;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udGFpbmVyLmpzIl0sIm5hbWVzIjpbIlN5bmNhYmxlIiwicmVxdWlyZSIsIkxheWVyRXJyb3IiLCJVdGlsIiwiQ29uc3RhbnRzIiwiUm9vdCIsIkNvbnRhaW5lciIsIm9wdGlvbnMiLCJmcm9tU2VydmVyIiwiaWQiLCJjbGllbnQiLCJjbGllbnRJZCIsImFwcElkIiwibWV0YWRhdGEiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiaXNJbml0aWFsaXppbmciLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwiY3JlYXRlZEF0IiwiRGF0ZSIsIm1lc3NhZ2UiLCJpc05ldyIsIl9zZXRTeW5jaW5nIiwiZ2V0Q2xpZW50IiwiX3RyaWdnZXJBc3luYyIsInN0YXJ0ZWQiLCJ0eXBlIiwidHlwZUZyb21JRCIsInRlbGVtZXRyeUlkIiwic2VuZFNvY2tldFJlcXVlc3QiLCJtZXRob2QiLCJib2R5Iiwic3luYyIsImRlcGVuZHMiLCJ0YXJnZXQiLCJfY3JlYXRlUmVzdWx0IiwicmVzdWx0IiwiX3NldHVwTWVzc2FnZSIsImNvbnRhaW5lciIsIl9zZXRTeW5jZWQiLCJfdXBkYXRlQ29udGFpbmVySWQiLCJjb25zdHJ1Y3RvciIsImV2ZW50UHJlZml4Iiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwidXJsIiwiY3JlYXRlZF9hdCIsInN1Y2Nlc3MiLCJkYXRhIiwiZW5kZWQiLCJpc0Rlc3Ryb3llZCIsIl9jcmVhdGVTdWNjZXNzIiwiX2NyZWF0ZVJlc3VsdENvbmZsaWN0IiwidHJpZ2dlciIsImVycm9yIiwiZGVzdHJveSIsIkNSRUFURUQiLCJGT1VORCIsInByb3BzIiwibGF5ZXJQYXRjaE9wZXJhdGlvbnMiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsIm5hbWUiLCJmdWxsTmFtZSIsImluZGV4T2YiLCJwdXNoIiwib3BlcmF0aW9uIiwidmFsdWUiLCJfaW5MYXllclBhcnNlciIsImxheWVyUGFyc2UiLCJvYmplY3QiLCJvcGVyYXRpb25zIiwiX3hociIsIkpTT04iLCJzdHJpbmdpZnkiLCJoZWFkZXJzIiwiX2xvYWQiLCJxdWVyeVN0ciIsIl9kZWxldGVSZXN1bHQiLCJfZGVsZXRlZCIsIm1vZGUiLCJERUxFVElPTl9NT0RFIiwiTVlfREVWSUNFUyIsImZyb21fcG9zaXRpb24iLCJfcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb24iLCJfcmVnaXN0ZXIiLCJjYWxsYmFjayIsImNvbnRleHQiLCJldnROYW1lIiwiaGFzTG9hZGVkRXZ0IiwiaXNMb2FkaW5nIiwiY2FsbE5vdyIsImRlZmVyIiwiYXBwbHkiLCJhcmdzIiwiX2NsZWFyT2JqZWN0IiwicGF0aHMiLCJfX3VwZGF0ZU1ldGFkYXRhIiwiX3RvT2JqZWN0IiwiY2xvbmUiLCJwYXRjaERhdGEiLCJwcm90b3R5cGUiLCJpc0N1cnJlbnRQYXJ0aWNpcGFudCIsIl9zZW5kRGlzdGluY3RFdmVudCIsImJ1YmJsZUV2ZW50UGFyZW50IiwiRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEiLCJpbml0Q2xhc3MiLCJzdWJjbGFzc2VzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7QUFRQSxJQUFNQSxXQUFXQyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNQyxhQUFhRCxRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTUUsT0FBT0YsUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTUcsWUFBWUgsUUFBUSxVQUFSLENBQWxCO0FBQ0EsSUFBTUksT0FBT0osUUFBUSxTQUFSLENBQWI7O0lBRU1LLFM7OztBQUVKOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSx1QkFBMEI7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ3hCO0FBQ0EsUUFBSUEsUUFBUUMsVUFBWixFQUF3QkQsUUFBUUUsRUFBUixHQUFhRixRQUFRQyxVQUFSLENBQW1CQyxFQUFoQzs7QUFFeEI7QUFDQSxRQUFJRixRQUFRRyxN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OztBQUtBcEcsVUFBVWtHLFNBQVYsQ0FBb0JILFNBQXBCLEdBQWdDLElBQWhDOztBQUlBOzs7Ozs7QUFNQS9GLFVBQVVxRyxpQkFBVixHQUE4QixXQUE5Qjs7QUFFQTs7Ozs7OztBQU9BckcsVUFBVW9ELE9BQVYsR0FBb0IsU0FBcEI7O0FBRUE7Ozs7Ozs7OztBQVNBcEQsVUFBVXFELEtBQVYsR0FBa0IsT0FBbEI7O0FBRUE7Ozs7Ozs7Ozs7O0FBV0FyRCxVQUFVc0csZ0NBQVYsR0FBNkMsZUFBN0M7O0FBR0F2RyxLQUFLd0csU0FBTCxDQUFlYixLQUFmLENBQXFCMUYsU0FBckIsRUFBZ0MsQ0FBQ0EsU0FBRCxFQUFZLFdBQVosQ0FBaEM7QUFDQU4sU0FBUzhHLFVBQVQsQ0FBb0IxQyxJQUFwQixDQUF5QjlELFNBQXpCO0FBQ0F5RyxPQUFPQyxPQUFQLEdBQWlCMUcsU0FBakIiLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIENvbnRhaW5lciBpcyBhIHBhcmVudCBjbGFzcyByZXByZXNlbnRpbmcgYSBjb250YWluZXIgdGhhdCBtYW5hZ2VzIGEgc2V0IG9mIE1lc3NhZ2VzLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ29udGFpbmVyXG4gKiBAYWJzdHJhY3RcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNhYmxlXG4gKiBAYXV0aG9yICBNaWNoYWVsIEthbnRvclxuICovXG5jb25zdCBTeW5jYWJsZSA9IHJlcXVpcmUoJy4vc3luY2FibGUnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5cbmNsYXNzIENvbnRhaW5lciBleHRlbmRzIFN5bmNhYmxlIHtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogVGhlIHN0YXRpYyBgbGF5ZXIuQ29udmVyc2F0aW9uLmNyZWF0ZSgpYCBtZXRob2RcbiAgICogd2lsbCBjb3JyZWN0bHkgbG9va3VwIGRpc3RpbmN0IENvbnZlcnNhdGlvbnMgYW5kXG4gICAqIHJldHVybiB0aGVtOyBgbmV3IGxheWVyLkNvbnZlcnNhdGlvbigpYCB3aWxsIG5vdC5cbiAgICpcbiAgICogRGV2ZWxvcGVycyBzaG91bGQgdXNlIGBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlKClgLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gb3B0aW9ucy5wYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgbGF5ZXIuSWRlbnRpdHkgaW5zdGFuY2VzXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGlzdGluY3Q9dHJ1ZV0gLSBJcyB0aGUgY29udmVyc2F0aW9uIGRpc3RpbmN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5tZXRhZGF0YV0gLSBBbiBvYmplY3QgY29udGFpbmluZyBDb252ZXJzYXRpb24gTWV0YWRhdGEuXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgSUQgZnJvbSBoYW5kbGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIgaXMgdXNlZCBieSB0aGUgUm9vdC5jb25zdHJ1Y3RvclxuICAgIGlmIChvcHRpb25zLmZyb21TZXJ2ZXIpIG9wdGlvbnMuaWQgPSBvcHRpb25zLmZyb21TZXJ2ZXIuaWQ7XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBhbiBjbGllbnRJZCBwcm9wZXJ0eVxuICAgIGlmIChvcHRpb25zLmNsaWVudCkgb3B0aW9ucy5jbGllbnRJZCA9IG9wdGlvbnMuY2xpZW50LmFwcElkO1xuICAgIGlmICghb3B0aW9ucy5tZXRhZGF0YSkgb3B0aW9ucy5tZXRhZGF0YSA9IHt9O1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICBpZiAoIXRoaXMuY2xpZW50SWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGUgb3B0aW9ucyBjb250YWlucyBhIGZ1bGwgc2VydmVyIGRlZmluaXRpb24gb2YgdGhlIG9iamVjdCxcbiAgICAvLyBjb3B5IGl0IGluIHdpdGggX3BvcHVsYXRlRnJvbVNlcnZlcjsgdGhpcyB3aWxsIGFkZCB0aGUgQ29udmVyc2F0aW9uXG4gICAgLy8gdG8gdGhlIENsaWVudCBhcyB3ZWxsLlxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKG9wdGlvbnMuZnJvbVNlcnZlcik7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLm1ldGFkYXRhKSB0aGlzLm1ldGFkYXRhID0ge307XG5cbiAgICBpZiAoIXRoaXMuY3JlYXRlZEF0KSB7XG4gICAgICB0aGlzLmNyZWF0ZWRBdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgfVxuXG5cbiAgc2VuZChtZXNzYWdlKSB7XG4gICAgaWYgKHRoaXMuaXNOZXcoKSkge1xuICAgICAgdGhpcy5jcmVhdGVkQXQgPSBuZXcgRGF0ZSgpO1xuXG4gICAgICAvLyBVcGRhdGUgdGhlIHN5bmNTdGF0ZVxuICAgICAgdGhpcy5fc2V0U3luY2luZygpO1xuXG4gICAgICB0aGlzLmdldENsaWVudCgpLl90cmlnZ2VyQXN5bmMoJ3N0YXRlLWNoYW5nZScsIHtcbiAgICAgICAgc3RhcnRlZDogdHJ1ZSxcbiAgICAgICAgdHlwZTogJ3NlbmRfJyArIFV0aWwudHlwZUZyb21JRCh0aGlzLmlkKSxcbiAgICAgICAgdGVsZW1ldHJ5SWQ6ICdzZW5kXycgKyBVdGlsLnR5cGVGcm9tSUQodGhpcy5pZCkgKyAnX3RpbWUnLFxuICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5nZXRDbGllbnQoKS5zZW5kU29ja2V0UmVxdWVzdCh7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBib2R5OiB7fSwgLy8gc2VlIF9nZXRTZW5kRGF0YVxuICAgICAgICBzeW5jOiB7XG4gICAgICAgICAgZGVwZW5kczogdGhpcy5pZCxcbiAgICAgICAgICB0YXJnZXQ6IHRoaXMuaWQsXG4gICAgICAgIH0sXG4gICAgICB9LCByZXN1bHQgPT4gdGhpcy5fY3JlYXRlUmVzdWx0KHJlc3VsdCkpO1xuICAgIH1cbiAgICBpZiAobWVzc2FnZSkgdGhpcy5fc2V0dXBNZXNzYWdlKG1lc3NhZ2UpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2UgdXNpbmcgc2VydmVyLWRhdGEuXG4gICAqXG4gICAqIFNpZGUgZWZmZWN0cyBhZGQgdGhpcyB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250YWluZXIgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNvbnRhaW5lclxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihjb250YWluZXIpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgdGhpcy5fc2V0U3luY2VkKCk7XG5cbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgdGhpcy5pZCA9IGNvbnRhaW5lci5pZDtcblxuICAgIC8vIElEcyBjaGFuZ2UgaWYgdGhlIHNlcnZlciByZXR1cm5zIGEgbWF0Y2hpbmcgQ29udGFpbmVyXG4gICAgaWYgKGlkICE9PSB0aGlzLmlkKSB7XG4gICAgICBjbGllbnQuX3VwZGF0ZUNvbnRhaW5lcklkKHRoaXMsIGlkKTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYyhgJHt0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4fTpjaGFuZ2VgLCB7XG4gICAgICAgIG9sZFZhbHVlOiBpZCxcbiAgICAgICAgbmV3VmFsdWU6IHRoaXMuaWQsXG4gICAgICAgIHByb3BlcnR5OiAnaWQnLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy51cmwgPSBjb250YWluZXIudXJsO1xuICAgIHRoaXMuY3JlYXRlZEF0ID0gbmV3IERhdGUoY29udGFpbmVyLmNyZWF0ZWRfYXQpO1xuICAgIHRoaXMubWV0YWRhdGEgPSBjb250YWluZXIubWV0YWRhdGE7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyByZXN1bHQgb2Ygc2VuZCBtZXRob2QuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB3ZSB1c2UgX3RyaWdnZXJBc3luYyBzbyB0aGF0XG4gICAqIGV2ZW50cyByZXBvcnRpbmcgY2hhbmdlcyB0byB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmlkIGNhblxuICAgKiBiZSBhcHBsaWVkIGJlZm9yZSByZXBvcnRpbmcgb24gaXQgYmVpbmcgc2VudC5cbiAgICpcbiAgICogRXhhbXBsZTogUXVlcnkgd2lsbCBub3cgaGF2ZSB0aGUgcmVzb2x2ZWQgRGlzdGluY3QgSURzIHJhdGhlciB0aGFuIHRoZSBwcm9wb3NlZCBJRFxuICAgKiB3aGVuIHRoaXMgZXZlbnQgaXMgdHJpZ2dlcmVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICovXG4gIF9jcmVhdGVSZXN1bHQoeyBzdWNjZXNzLCBkYXRhIH0pIHtcbiAgICB0aGlzLmdldENsaWVudCgpLl90cmlnZ2VyQXN5bmMoJ3N0YXRlLWNoYW5nZScsIHtcbiAgICAgIGVuZGVkOiB0cnVlLFxuICAgICAgdHlwZTogJ3NlbmRfJyArIFV0aWwudHlwZUZyb21JRCh0aGlzLmlkKSxcbiAgICAgIHRlbGVtZXRyeUlkOiAnc2VuZF8nICsgVXRpbC50eXBlRnJvbUlEKHRoaXMuaWQpICsgJ190aW1lJyxcbiAgICAgIGlkOiB0aGlzLmlkLFxuICAgIH0pO1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZVN1Y2Nlc3MoZGF0YSk7XG4gICAgfSBlbHNlIGlmIChkYXRhLmlkID09PSAnY29uZmxpY3QnKSB7XG4gICAgICB0aGlzLl9jcmVhdGVSZXN1bHRDb25mbGljdChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKHRoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXggKyAnOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgc3VjY2Vzc2Z1bCByZXN1bHQgb2YgYSBjcmVhdGUgY2FsbFxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVTdWNjZXNzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgQ29udmVyc2F0aW9uL0NoYW5uZWxcbiAgICovXG4gIF9jcmVhdGVTdWNjZXNzKGRhdGEpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKGRhdGEpO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYyh0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpzZW50Jywge1xuICAgICAgcmVzdWx0OiBpZCA9PT0gdGhpcy5pZCA/IENvbnRhaW5lci5DUkVBVEVEIDogQ29udGFpbmVyLkZPVU5ELFxuICAgIH0pO1xuICB9XG5cblxuICAvKipcbiAgICogVXBkYXRlcyBzcGVjaWZpZWQgbWV0YWRhdGEga2V5cy5cbiAgICpcbiAgICogVXBkYXRlcyB0aGUgbG9jYWwgb2JqZWN0J3MgbWV0YWRhdGEgYW5kIHN5bmNzIHRoZSBjaGFuZ2UgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uc2V0TWV0YWRhdGFQcm9wZXJ0aWVzKHtcbiAgICogICAgICAgICAgJ3RpdGxlJzogJ0kgYW0gYSB0aXRsZScsXG4gICAqICAgICAgICAgICdjb2xvcnMuYmFja2dyb3VuZCc6ICdyZWQnLFxuICAgKiAgICAgICAgICAnY29sb3JzLnRleHQnOiB7XG4gICAqICAgICAgICAgICAgICAnZmlsbCc6ICdibHVlJyxcbiAgICogICAgICAgICAgICAgICdzaGFkb3cnOiAnYmxhY2snXG4gICAqICAgICAgICAgICB9LFxuICAgKiAgICAgICAgICAgJ2NvbG9ycy50aXRsZS5maWxsJzogJ3JlZCdcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogVXNlIHNldE1ldGFkYXRhUHJvcGVydGllcyB0byBzcGVjaWZ5IHRoZSBwYXRoIHRvIGEgcHJvcGVydHksIGFuZCBhIG5ldyB2YWx1ZSBmb3IgdGhhdCBwcm9wZXJ0eS5cbiAgICogTXVsdGlwbGUgcHJvcGVydGllcyBjYW4gYmUgY2hhbmdlZCB0aGlzIHdheS4gIFdoYXRldmVyIHZhbHVlIHdhcyB0aGVyZSBiZWZvcmUgaXNcbiAgICogcmVwbGFjZWQgd2l0aCB0aGUgbmV3IHZhbHVlOyBzbyBpbiB0aGUgYWJvdmUgZXhhbXBsZSwgd2hhdGV2ZXIgb3RoZXIga2V5cyBtYXkgaGF2ZVxuICAgKiBleGlzdGVkIHVuZGVyIGBjb2xvcnMudGV4dGAgaGF2ZSBiZWVuIHJlcGxhY2VkIGJ5IHRoZSBuZXcgb2JqZWN0IGB7ZmlsbDogJ2JsdWUnLCBzaGFkb3c6ICdibGFjayd9YC5cbiAgICpcbiAgICogTm90ZSBhbHNvIHRoYXQgb25seSBzdHJpbmcgYW5kIHN1Ym9iamVjdHMgYXJlIGFjY2VwdGVkIGFzIHZhbHVlcy5cbiAgICpcbiAgICogS2V5cyB3aXRoICcuJyB3aWxsIHVwZGF0ZSBhIGZpZWxkIG9mIGFuIG9iamVjdCAoYW5kIGNyZWF0ZSBhbiBvYmplY3QgaWYgaXQgd2Fzbid0IHRoZXJlKTpcbiAgICpcbiAgICogSW5pdGlhbCBtZXRhZGF0YToge31cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uc2V0TWV0YWRhdGFQcm9wZXJ0aWVzKHtcbiAgICogICAgICAgICAgJ2NvbG9ycy5iYWNrZ3JvdW5kJzogJ3JlZCcsXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE1ldGFkYXRhIGlzIG5vdzogYHtjb2xvcnM6IHtiYWNrZ3JvdW5kOiAncmVkJ319YFxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXMoe1xuICAgKiAgICAgICAgICAnY29sb3JzLmZvcmVncm91bmQnOiAnYmxhY2snLFxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBNZXRhZGF0YSBpcyBub3c6IGB7Y29sb3JzOiB7YmFja2dyb3VuZDogJ3JlZCcsIGZvcmVncm91bmQ6ICdibGFjayd9fWBcbiAgICpcbiAgICogRXhlY3V0ZXMgYXMgZm9sbG93czpcbiAgICpcbiAgICogMS4gVXBkYXRlcyB0aGUgbWV0YWRhdGEgcHJvcGVydHkgb2YgdGhlIGxvY2FsIG9iamVjdFxuICAgKiAyLiBUcmlnZ2VycyBhIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50XG4gICAqIDMuIFN1Ym1pdHMgYSByZXF1ZXN0IHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlciB0byB1cGRhdGUgdGhlIHNlcnZlcidzIG9iamVjdFxuICAgKiA0LiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgbm8gZXJyb3JzIGFyZSBmaXJlZCBleGNlcHQgYnkgbGF5ZXIuU3luY01hbmFnZXIsIGJ1dCBhbm90aGVyXG4gICAqICAgIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50IGlzIGZpcmVkIGFzIHRoZSBjaGFuZ2UgaXMgcm9sbGVkIGJhY2suXG4gICAqXG4gICAqIEBtZXRob2Qgc2V0TWV0YWRhdGFQcm9wZXJ0aWVzXG4gICAqIEBwYXJhbSAge09iamVjdH0gcHJvcGVydGllc1xuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICpcbiAgICovXG4gIHNldE1ldGFkYXRhUHJvcGVydGllcyhwcm9wcykge1xuICAgIGNvbnN0IGxheWVyUGF0Y2hPcGVyYXRpb25zID0gW107XG4gICAgT2JqZWN0LmtleXMocHJvcHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGxldCBmdWxsTmFtZSA9IG5hbWU7XG4gICAgICBpZiAobmFtZSkge1xuICAgICAgICBpZiAobmFtZSAhPT0gJ21ldGFkYXRhJyAmJiBuYW1lLmluZGV4T2YoJ21ldGFkYXRhLicpICE9PSAwKSB7XG4gICAgICAgICAgZnVsbE5hbWUgPSAnbWV0YWRhdGEuJyArIG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgbGF5ZXJQYXRjaE9wZXJhdGlvbnMucHVzaCh7XG4gICAgICAgICAgb3BlcmF0aW9uOiAnc2V0JyxcbiAgICAgICAgICBwcm9wZXJ0eTogZnVsbE5hbWUsXG4gICAgICAgICAgdmFsdWU6IHByb3BzW25hbWVdLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuXG4gICAgLy8gRG8gdGhpcyBiZWZvcmUgc2V0U3luY2luZyBhcyBpZiB0aGVyZSBhcmUgYW55IGVycm9ycywgd2Ugc2hvdWxkIG5ldmVyIGV2ZW5cbiAgICAvLyBzdGFydCBzZXR0aW5nIHVwIGEgcmVxdWVzdC5cbiAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgdHlwZTogJ0NvbnZlcnNhdGlvbicsXG4gICAgICBvcGVyYXRpb25zOiBsYXllclBhdGNoT3BlcmF0aW9ucyxcbiAgICAgIGNsaWVudDogdGhpcy5nZXRDbGllbnQoKSxcbiAgICB9KTtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGxheWVyUGF0Y2hPcGVyYXRpb25zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicsXG4gICAgICB9LFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgIXRoaXMuaXNEZXN0cm95ZWQgJiYgcmVzdWx0LmRhdGEuaWQgIT09ICdhdXRoZW50aWNhdGlvbl9yZXF1aXJlZCcpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogRGVsZXRlcyBzcGVjaWZpZWQgbWV0YWRhdGEga2V5cy5cbiAgICpcbiAgICogVXBkYXRlcyB0aGUgbG9jYWwgb2JqZWN0J3MgbWV0YWRhdGEgYW5kIHN5bmNzIHRoZSBjaGFuZ2UgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24uZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzKFxuICAgKiAgICAgICAgICBbJ3RpdGxlJywgJ2NvbG9ycy5iYWNrZ3JvdW5kJywgJ2NvbG9ycy50aXRsZS5maWxsJ11cbiAgICogICAgICApO1xuICAgKlxuICAgKiBVc2UgZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzIHRvIHNwZWNpZnkgcGF0aHMgdG8gcHJvcGVydGllcyB0byBiZSBkZWxldGVkLlxuICAgKiBNdWx0aXBsZSBwcm9wZXJ0aWVzIGNhbiBiZSBkZWxldGVkLlxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBVcGRhdGVzIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSBvZiB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDIuIFRyaWdnZXJzIGEgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnRcbiAgICogMy4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIHVwZGF0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDQuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IGFub3RoZXJcbiAgICogICAgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnQgaXMgZmlyZWQgYXMgdGhlIGNoYW5nZSBpcyByb2xsZWQgYmFjay5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVNZXRhZGF0YVByb3BlcnRpZXNcbiAgICogQHBhcmFtICB7c3RyaW5nW119IHByb3BlcnRpZXNcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICBkZWxldGVNZXRhZGF0YVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBjb25zdCBsYXllclBhdGNoT3BlcmF0aW9ucyA9IFtdO1xuICAgIHByb3BzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICBpZiAocHJvcGVydHkgIT09ICdtZXRhZGF0YScgJiYgcHJvcGVydHkuaW5kZXhPZignbWV0YWRhdGEuJykgIT09IDApIHtcbiAgICAgICAgcHJvcGVydHkgPSAnbWV0YWRhdGEuJyArIHByb3BlcnR5O1xuICAgICAgfVxuICAgICAgbGF5ZXJQYXRjaE9wZXJhdGlvbnMucHVzaCh7XG4gICAgICAgIG9wZXJhdGlvbjogJ2RlbGV0ZScsXG4gICAgICAgIHByb3BlcnR5LFxuICAgICAgfSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcblxuICAgIC8vIERvIHRoaXMgYmVmb3JlIHNldFN5bmNpbmcgYXMgaWYgdGhlcmUgYXJlIGFueSBlcnJvcnMsIHdlIHNob3VsZCBuZXZlciBldmVuXG4gICAgLy8gc3RhcnQgc2V0dGluZyB1cCBhIHJlcXVlc3QuXG4gICAgVXRpbC5sYXllclBhcnNlKHtcbiAgICAgIG9iamVjdDogdGhpcyxcbiAgICAgIHR5cGU6ICdDb252ZXJzYXRpb24nLFxuICAgICAgb3BlcmF0aW9uczogbGF5ZXJQYXRjaE9wZXJhdGlvbnMsXG4gICAgICBjbGllbnQ6IHRoaXMuZ2V0Q2xpZW50KCksXG4gICAgfSk7XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IGZhbHNlO1xuXG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeShsYXllclBhdGNoT3BlcmF0aW9ucyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmxheWVyLXBhdGNoK2pzb24nLFxuICAgICAgfSxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5kYXRhLmlkICE9PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciAoaW50ZXJuYWwgdmVyc2lvbikuXG4gICAqXG4gICAqIFRoaXMgdmVyc2lvbiBvZiBEZWxldGUgdGFrZXMgYSBRdWVyeSBTdHJpbmcgdGhhdCBpcyBwYWNrYWdlZCB1cCBieVxuICAgKiBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlIGFuZCBsYXllci5Db252ZXJzYXRpb24ubGVhdmUuXG4gICAqXG4gICAqIEBtZXRob2QgX2RlbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gcXVlcnlTdHIgLSBRdWVyeSBzdHJpbmcgZm9yIHRoZSBERUxFVEUgcmVxdWVzdFxuICAgKi9cbiAgX2RlbGV0ZShxdWVyeVN0cikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHVybDogJz8nICsgcXVlcnlTdHIsXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX2RlbGV0ZVJlc3VsdChyZXN1bHQsIGlkKSk7XG5cbiAgICB0aGlzLl9kZWxldGVkKCk7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH1cblxuICBfaGFuZGxlV2Vic29ja2V0RGVsZXRlKGRhdGEpIHtcbiAgICBpZiAoZGF0YS5tb2RlID09PSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTICYmIGRhdGEuZnJvbV9wb3NpdGlvbikge1xuICAgICAgdGhpcy5nZXRDbGllbnQoKS5fcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb24odGhpcy5pZCwgZGF0YS5mcm9tX3Bvc2l0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VwZXIuX2hhbmRsZVdlYnNvY2tldERlbGV0ZSgpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsICsgKHVybCB8fCAnJyk7XG4gIH1cblxuICBfbG9hZGVkKGRhdGEpIHtcbiAgICB0aGlzLl9yZWdpc3Rlcih0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFuZGFyZCBgb24oKWAgcHJvdmlkZWQgYnkgbGF5ZXIuUm9vdC5cbiAgICpcbiAgICogQWRkcyBzb21lIHNwZWNpYWwgaGFuZGxpbmcgb2YgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyBzbyB0aGF0IGNhbGxzIHN1Y2ggYXNcbiAgICpcbiAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIG15cmVyZW5kZXIoYyk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgbXlyZW5kZXIoYyk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBjIHVudGlsIHRoZSBkZXRhaWxzIG9mIGMgaGF2ZSBsb2FkZWRcbiAgICpcbiAgICogY2FuIGZpcmUgdGhlaXIgY2FsbGJhY2sgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjbGllbnQgbG9hZHMgb3IgaGFzXG4gICAqIGFscmVhZHkgbG9hZGVkIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgY29uc3QgZXZ0TmFtZSA9IGAke3RoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXh9OmxvYWRlZGA7XG4gICAgY29uc3QgaGFzTG9hZGVkRXZ0ID0gbmFtZSA9PT0gZXZ0TmFtZSB8fCAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgJiYgbmFtZVtldnROYW1lXSk7XG5cbiAgICBpZiAoaGFzTG9hZGVkRXZ0ICYmICF0aGlzLmlzTG9hZGluZykge1xuICAgICAgY29uc3QgY2FsbE5vdyA9IG5hbWUgPT09IGV2dE5hbWUgPyBjYWxsYmFjayA6IG5hbWVbZXZ0TmFtZV07XG4gICAgICBVdGlsLmRlZmVyKCgpID0+IGNhbGxOb3cuYXBwbHkoY29udGV4dCkpO1xuICAgIH1cbiAgICBzdXBlci5vbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSB3aWxsIGNhbGwgdGhpcyBtZXRob2QgYW5kIGZpcmUgYVxuICAgKiBjaGFuZ2UgZXZlbnQuICBDaGFuZ2VzIHRvIHRoZSBtZXRhZGF0YSBvYmplY3QgdGhhdCBkb24ndCByZXBsYWNlIHRoZSBvYmplY3RcbiAgICogd2l0aCBhIG5ldyBvYmplY3Qgd2lsbCByZXF1aXJlIGRpcmVjdGx5IGNhbGxpbmcgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVNZXRhZGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2xkVmFsdWVcbiAgICovXG4gIF9fdXBkYXRlTWV0YWRhdGEobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykge1xuICAgIGlmICh0aGlzLl9pbkxheWVyUGFyc2VyKSByZXR1cm47XG4gICAgaWYgKEpTT04uc3RyaW5naWZ5KG5ld1ZhbHVlKSAhPT0gSlNPTi5zdHJpbmdpZnkob2xkVmFsdWUpKSB7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoYCR7dGhpcy5jb25zdHJ1Y3Rvci5ldmVudFByZWZpeH06Y2hhbmdlYCwge1xuICAgICAgICBwcm9wZXJ0eTogJ21ldGFkYXRhJyxcbiAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgIG9sZFZhbHVlLFxuICAgICAgICBwYXRocyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpIHtcbiAgICBpZiAocGF0aHNbMF0uaW5kZXhPZignbWV0YWRhdGEnKSA9PT0gMCkge1xuICAgICAgdGhpcy5fX3VwZGF0ZU1ldGFkYXRhKG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIENvbnZlcnNhdGlvbiBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcy5cbiAgICovXG4gIHRvT2JqZWN0KCkge1xuICAgIGlmICghdGhpcy5fdG9PYmplY3QpIHtcbiAgICAgIHRoaXMuX3RvT2JqZWN0ID0gc3VwZXIudG9PYmplY3QoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0Lm1ldGFkYXRhID0gVXRpbC5jbG9uZSh0aGlzLm1ldGFkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3RvT2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgd2hldGhlciBhIENvbnZlcnNhdGlvbiByZWNlaXZpbmcgdGhlIHNwZWNpZmllZCBwYXRjaCBkYXRhIHNob3VsZCBiZSBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIHRvIGEgQ29udmVyc2F0aW9uIGluZGljYXRlcyB0aGF0IHRoZSBDb252ZXJzYXRpb24gaXMgYWN0aXZlIGFuZCBvZiBwb3RlbnRpYWwgaW50ZXJlc3Q7IGdvIGFoZWFkIGFuZCBsb2FkIHRoYXRcbiAgICogQ29udmVyc2F0aW9uIGluIGNhc2UgdGhlIGFwcCBoYXMgbmVlZCBvZiBpdC4gIEluIHRoZSBmdXR1cmUgd2UgbWF5IGlnbm9yZSBjaGFuZ2VzIHRvIHVucmVhZCBjb3VudC4gIE9ubHkgcmVsZXZhbnRcbiAgICogd2hlbiB3ZSBnZXQgV2Vic29ja2V0IGV2ZW50cyBmb3IgYSBDb252ZXJzYXRpb24gdGhhdCBoYXMgbm90IGJlZW4gbG9hZGVkL2NhY2hlZCBvbiBDbGllbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRSZXNvdXJjZUZvclBhdGNoXG4gICAqIEBzdGF0aWNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBfbG9hZFJlc291cmNlRm9yUGF0Y2gocGF0Y2hEYXRhKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIGNvbnZlcnNhdGlvbiB3YXMgY3JlYXRlZCBvbiB0aGUgc2VydmVyLlxuICpcbiAqIEB0eXBlIHtEYXRlfVxuICovXG5Db250YWluZXIucHJvdG90eXBlLmNyZWF0ZWRBdCA9IG51bGw7XG5cbi8qKlxuICogTWV0YWRhdGEgZm9yIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogTWV0YWRhdGEgdmFsdWVzIGNhbiBiZSBwbGFpbiBvYmplY3RzIGFuZCBzdHJpbmdzLCBidXRcbiAqIG5vIGFycmF5cywgbnVtYmVycywgYm9vbGVhbnMgb3IgZGF0ZXMuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5Db250YWluZXIucHJvdG90eXBlLm1ldGFkYXRhID0gbnVsbDtcblxuXG4vKipcbiAqIFRoZSBhdXRoZW50aWNhdGVkIHVzZXIgaXMgYSBjdXJyZW50IHBhcnRpY2lwYW50IGluIHRoaXMgQ29udmVyc2F0aW9uLlxuICpcbiAqIFNldCB0byBmYWxzZSBpZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyIGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGlzIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBBIHJlbW92ZWQgdXNlciBjYW4gc2VlIG1lc3NhZ2VzIHVwIHRvIHRoZSB0aW1lIHRoZXkgd2VyZSByZW1vdmVkLFxuICogYnV0IGNhbiBubyBsb25nZXIgaW50ZXJhY3Qgd2l0aCB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIEEgcmVtb3ZlZCB1c2VyIGNhbiBubyBsb25nZXIgc2VlIHRoZSBwYXJ0aWNpcGFudCBsaXN0LlxuICpcbiAqIFJlYWQgYW5kIERlbGl2ZXJ5IHJlY2VpcHRzIHdpbGwgZmFpbCBvbiBhbnkgTWVzc2FnZSBpbiBzdWNoIGEgQ29udmVyc2F0aW9uLlxuICpcbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5Db250YWluZXIucHJvdG90eXBlLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gdHJ1ZTtcblxuXG4vKipcbiAqIENhY2hlJ3MgYSBEaXN0aW5jdCBFdmVudC5cbiAqXG4gKiBPbiBjcmVhdGluZyBhIENoYW5uZWwgb3IgQ29udmVyc2F0aW9uIHRoYXQgYWxyZWFkeSBleGlzdHMsXG4gKiB3aGVuIHRoZSBzZW5kKCkgbWV0aG9kIGlzIGNhbGxlZCwgd2Ugc2hvdWxkIHRyaWdnZXJcbiAqIHNwZWNpZmljIGV2ZW50cyBkZXRhaWxpbmcgdGhlIHJlc3VsdHMuICBSZXN1bHRzXG4gKiBtYXkgYmUgZGV0ZXJtaW5lZCBsb2NhbGx5IG9yIG9uIHRoZSBzZXJ2ZXIsIGJ1dCBzYW1lIEV2ZW50IG1heSBiZSBuZWVkZWQuXG4gKlxuICogQHR5cGUge2xheWVyLkxheWVyRXZlbnR9XG4gKiBAcHJpdmF0ZVxuICovXG5Db250YWluZXIucHJvdG90eXBlLl9zZW5kRGlzdGluY3RFdmVudCA9IG51bGw7XG5cbi8qKlxuICogQ2FjaGVzIGxhc3QgcmVzdWx0IG9mIHRvT2JqZWN0KClcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5Db250YWluZXIucHJvdG90eXBlLl90b09iamVjdCA9IG51bGw7XG5cblxuXG4vKipcbiAqIFByb3BlcnR5IHRvIGxvb2sgZm9yIHdoZW4gYnViYmxpbmcgdXAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbkNvbnRhaW5lci5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24vQ2hhbm5lbCB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gY3JlYXRlZC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnRhaW5lci5DUkVBVEVEID0gJ0NyZWF0ZWQnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24vQ2hhbm5lbCB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gZm91bmQuXG4gKlxuICogVGhpcyBtZWFucyB0aGF0IGl0IGRpZCBub3QgbmVlZCB0byBiZSBjcmVhdGVkLlxuICpcbiAqIFVzZWQgaW4gYGNvbnZlcnNhdGlvbnM6c2VudGAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuQ29udGFpbmVyLkZPVU5EID0gJ0ZvdW5kJztcblxuLyoqXG4gKiBUaGUgQ29udmVyc2F0aW9uL0NoYW5uZWwgdGhhdCB3YXMgcmVxdWVzdGVkIGhhcyBiZWVuIGZvdW5kLCBidXQgdGhlcmUgd2FzIGEgbWlzbWF0Y2ggaW4gbWV0YWRhdGEuXG4gKlxuICogSWYgdGhlIGNyZWF0ZUNvbnZlcnNhdGlvbiByZXF1ZXN0IGNvbnRhaW5lZCBtZXRhZGF0YSBhbmQgaXQgZGlkIG5vdCBtYXRjaCB0aGUgRGlzdGluY3QgQ29udmVyc2F0aW9uXG4gKiB0aGF0IG1hdGNoZWQgdGhlIHJlcXVlc3RlZCBwYXJ0aWNpcGFudHMsIHRoZW4gdGhpcyB2YWx1ZSBpcyBwYXNzZWQgdG8gbm90aWZ5IHlvdXIgYXBwIHRoYXQgdGhlIENvbnZlcnNhdGlvblxuICogd2FzIHJldHVybmVkIGJ1dCBkb2VzIG5vdCBleGFjdGx5IG1hdGNoIHlvdXIgcmVxdWVzdC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnRhaW5lci5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSA9ICdGb3VuZE1pc21hdGNoJztcblxuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb250YWluZXIsIFtDb250YWluZXIsICdDb250YWluZXInXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQ29udGFpbmVyKTtcbm1vZHVsZS5leHBvcnRzID0gQ29udGFpbmVyO1xuIl19
