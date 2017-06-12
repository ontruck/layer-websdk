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
      var _this3 = this;

      var id = this.id;
      this._xhr({
        method: 'DELETE',
        url: '?' + queryStr
      }, function (result) {
        return _this3._deleteResult(result, id);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udGFpbmVyLmpzIl0sIm5hbWVzIjpbIlN5bmNhYmxlIiwicmVxdWlyZSIsIkxheWVyRXJyb3IiLCJVdGlsIiwiQ29uc3RhbnRzIiwiUm9vdCIsIkNvbnRhaW5lciIsIm9wdGlvbnMiLCJmcm9tU2VydmVyIiwiaWQiLCJjbGllbnQiLCJjbGllbnRJZCIsImFwcElkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsImlzSW5pdGlhbGl6aW5nIiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsIm1ldGFkYXRhIiwiY3JlYXRlZEF0IiwiRGF0ZSIsIm1lc3NhZ2UiLCJpc05ldyIsIl9zZXRTeW5jaW5nIiwiZ2V0Q2xpZW50Iiwic2VuZFNvY2tldFJlcXVlc3QiLCJtZXRob2QiLCJib2R5Iiwic3luYyIsImRlcGVuZHMiLCJ0YXJnZXQiLCJfY3JlYXRlUmVzdWx0IiwicmVzdWx0IiwiY29udGFpbmVyIiwiX3NldFN5bmNlZCIsIl91cGRhdGVDb250YWluZXJJZCIsIl90cmlnZ2VyQXN5bmMiLCJjb25zdHJ1Y3RvciIsImV2ZW50UHJlZml4Iiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwidXJsIiwiY3JlYXRlZF9hdCIsInN1Y2Nlc3MiLCJkYXRhIiwiaXNEZXN0cm95ZWQiLCJfY3JlYXRlU3VjY2VzcyIsIl9jcmVhdGVSZXN1bHRDb25mbGljdCIsInRyaWdnZXIiLCJlcnJvciIsImRlc3Ryb3kiLCJDUkVBVEVEIiwiRk9VTkQiLCJxdWVyeVN0ciIsIl94aHIiLCJfZGVsZXRlUmVzdWx0IiwiX2RlbGV0ZWQiLCJtb2RlIiwiREVMRVRJT05fTU9ERSIsIk1ZX0RFVklDRVMiLCJmcm9tX3Bvc2l0aW9uIiwiX3B1cmdlTWVzc2FnZXNCeVBvc2l0aW9uIiwiX3JlZ2lzdGVyIiwibmFtZSIsImNhbGxiYWNrIiwiY29udGV4dCIsImV2dE5hbWUiLCJoYXNMb2FkZWRFdnQiLCJpc0xvYWRpbmciLCJjYWxsTm93IiwiZGVmZXIiLCJhcHBseSIsImFyZ3MiLCJfY2xlYXJPYmplY3QiLCJwYXRocyIsIl9pbkxheWVyUGFyc2VyIiwiSlNPTiIsInN0cmluZ2lmeSIsIl90b09iamVjdCIsImNsb25lIiwicGF0Y2hEYXRhIiwicHJvdG90eXBlIiwiaXNDdXJyZW50UGFydGljaXBhbnQiLCJfc2VuZERpc3RpbmN0RXZlbnQiLCJidWJibGVFdmVudFBhcmVudCIsIkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBIiwiaW5pdENsYXNzIiwic3ViY2xhc3NlcyIsInB1c2giLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7QUFTQSxJQUFNQSxXQUFXQyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNQyxhQUFhRCxRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTUUsT0FBT0YsUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTUcsWUFBWUgsUUFBUSxVQUFSLENBQWxCO0FBQ0EsSUFBTUksT0FBT0osUUFBUSxTQUFSLENBQWI7O0lBRU1LLFM7OztBQUVKOzs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQSx1QkFBMEI7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ3hCO0FBQ0EsUUFBSUEsUUFBUUMsVUFBWixFQUF3QkQsUUFBUUUsRUFBUixHQUFhRixRQUFRQyxVQUFSLENBQW1CQyxFQUFoQzs7QUFFeEI7QUFDQSxRQUFJRixRQUFRRyxNQUFaLEVBQW9CSCxRQUFRSSxRQUFSLEdBQW1CSixRQUFRRyxNQUFSLENBQWVFLEtBQWxDOztBQUxJLHNIQU9sQkwsT0FQa0I7O0FBU3hCLFFBQUksQ0FBQyxNQUFLSSxRQUFWLEVBQW9CLE1BQU0sSUFBSUUsS0FBSixDQUFVWCxXQUFXWSxVQUFYLENBQXNCQyxhQUFoQyxDQUFOO0FBQ3BCLFVBQUtDLGNBQUwsR0FBc0IsSUFBdEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBSVQsV0FBV0EsUUFBUUMsVUFBdkIsRUFBbUM7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b0JFLGtCQUFwQixHQUF5QyxJQUF6Qzs7QUFFQTs7Ozs7QUFLQTlFLFVBQVU0RSxTQUFWLENBQW9CSCxTQUFwQixHQUFnQyxJQUFoQzs7QUFJQTs7Ozs7O0FBTUF6RSxVQUFVK0UsaUJBQVYsR0FBOEIsV0FBOUI7O0FBRUE7Ozs7Ozs7QUFPQS9FLFVBQVU4QyxPQUFWLEdBQW9CLFNBQXBCOztBQUVBOzs7Ozs7Ozs7QUFTQTlDLFVBQVUrQyxLQUFWLEdBQWtCLE9BQWxCOztBQUVBOzs7Ozs7Ozs7OztBQVdBL0MsVUFBVWdGLGdDQUFWLEdBQTZDLGVBQTdDOztBQUdBakYsS0FBS2tGLFNBQUwsQ0FBZWYsS0FBZixDQUFxQmxFLFNBQXJCLEVBQWdDLENBQUNBLFNBQUQsRUFBWSxXQUFaLENBQWhDO0FBQ0FOLFNBQVN3RixVQUFULENBQW9CQyxJQUFwQixDQUF5Qm5GLFNBQXpCO0FBQ0FvRixPQUFPQyxPQUFQLEdBQWlCckYsU0FBakIiLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIENvbnRhaW5lciBpcyBhIHBhcmVudCBjbGFzcyByZXByZXNlbnRpbmcgYSBjb250YWluZXIgdGhhdCBtYW5hZ2VzIGEgc2V0IG9mIE1lc3NhZ2VzLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ29udGFpbmVyXG4gKiBAYWJzdHJhY3RcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNhYmxlXG4gKiBAYXV0aG9yICBNaWNoYWVsIEthbnRvclxuICovXG5cbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcblxuY2xhc3MgQ29udGFpbmVyIGV4dGVuZHMgU3luY2FibGUge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBUaGUgc3RhdGljIGBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlKClgIG1ldGhvZFxuICAgKiB3aWxsIGNvcnJlY3RseSBsb29rdXAgZGlzdGluY3QgQ29udmVyc2F0aW9ucyBhbmRcbiAgICogcmV0dXJuIHRoZW07IGBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uKClgIHdpbGwgbm90LlxuICAgKlxuICAgKiBEZXZlbG9wZXJzIHNob3VsZCB1c2UgYGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoKWAuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBvcHRpb25zLnBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBsYXllci5JZGVudGl0eSBpbnN0YW5jZXNcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSAtIElzIHRoZSBjb252ZXJzYXRpb24gZGlzdGluY3RcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhXSAtIEFuIG9iamVjdCBjb250YWluaW5nIENvbnZlcnNhdGlvbiBNZXRhZGF0YS5cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoZSBJRCBmcm9tIGhhbmRsZSBmcm9tU2VydmVyIHBhcmFtZXRlciBpcyB1c2VkIGJ5IHRoZSBSb290LmNvbnN0cnVjdG9yXG4gICAgaWYgKG9wdGlvbnMuZnJvbVNlcnZlcikgb3B0aW9ucy5pZCA9IG9wdGlvbnMuZnJvbVNlcnZlci5pZDtcblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGNsaWVudElkIHByb3BlcnR5XG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIGlmICghdGhpcy5jbGllbnRJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zIGNvbnRhaW5zIGEgZnVsbCBzZXJ2ZXIgZGVmaW5pdGlvbiBvZiB0aGUgb2JqZWN0LFxuICAgIC8vIGNvcHkgaXQgaW4gd2l0aCBfcG9wdWxhdGVGcm9tU2VydmVyOyB0aGlzIHdpbGwgYWRkIHRoZSBDb252ZXJzYXRpb25cbiAgICAvLyB0byB0aGUgQ2xpZW50IGFzIHdlbGwuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5mcm9tU2VydmVyKSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIob3B0aW9ucy5mcm9tU2VydmVyKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMubWV0YWRhdGEpIHRoaXMubWV0YWRhdGEgPSB7fTtcblxuICAgIGlmICghdGhpcy5jcmVhdGVkQXQpIHtcbiAgICAgIHRoaXMuY3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcbiAgICB9XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICB9XG5cblxuICBzZW5kKG1lc3NhZ2UpIHtcbiAgICBpZiAodGhpcy5pc05ldygpKSB7XG4gICAgICB0aGlzLmNyZWF0ZWRBdCA9IG5ldyBEYXRlKCk7XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgc3luY1N0YXRlXG4gICAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG5cbiAgICAgIHRoaXMuZ2V0Q2xpZW50KCkuc2VuZFNvY2tldFJlcXVlc3Qoe1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgYm9keToge30sIC8vIHNlZSBfZ2V0U2VuZERhdGFcbiAgICAgICAgc3luYzoge1xuICAgICAgICAgIGRlcGVuZHM6IHRoaXMuaWQsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLmlkLFxuICAgICAgICB9LFxuICAgICAgfSwgcmVzdWx0ID0+IHRoaXMuX2NyZWF0ZVJlc3VsdChyZXN1bHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhpcyBpbnN0YW5jZSB1c2luZyBzZXJ2ZXItZGF0YS5cbiAgICpcbiAgICogU2lkZSBlZmZlY3RzIGFkZCB0aGlzIHRvIHRoZSBDbGllbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnRhaW5lciAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgY29udGFpbmVyXG4gICAqL1xuICBfcG9wdWxhdGVGcm9tU2VydmVyKGNvbnRhaW5lcikge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICB0aGlzLmlkID0gY29udGFpbmVyLmlkO1xuXG4gICAgLy8gSURzIGNoYW5nZSBpZiB0aGUgc2VydmVyIHJldHVybnMgYSBtYXRjaGluZyBDb250YWluZXJcbiAgICBpZiAoaWQgIT09IHRoaXMuaWQpIHtcbiAgICAgIGNsaWVudC5fdXBkYXRlQ29udGFpbmVySWQodGhpcywgaWQpO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKGAke3RoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXh9OmNoYW5nZWAsIHtcbiAgICAgICAgb2xkVmFsdWU6IGlkLFxuICAgICAgICBuZXdWYWx1ZTogdGhpcy5pZCxcbiAgICAgICAgcHJvcGVydHk6ICdpZCcsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVybCA9IGNvbnRhaW5lci51cmw7XG4gICAgdGhpcy5jcmVhdGVkQXQgPSBuZXcgRGF0ZShjb250YWluZXIuY3JlYXRlZF9hdCk7XG4gICAgdGhpcy5tZXRhZGF0YSA9IGNvbnRhaW5lci5tZXRhZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHJlc3VsdCBvZiBzZW5kIG1ldGhvZC5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdlIHVzZSBfdHJpZ2dlckFzeW5jIHNvIHRoYXRcbiAgICogZXZlbnRzIHJlcG9ydGluZyBjaGFuZ2VzIHRvIHRoZSBsYXllci5Db252ZXJzYXRpb24uaWQgY2FuXG4gICAqIGJlIGFwcGxpZWQgYmVmb3JlIHJlcG9ydGluZyBvbiBpdCBiZWluZyBzZW50LlxuICAgKlxuICAgKiBFeGFtcGxlOiBRdWVyeSB3aWxsIG5vdyBoYXZlIHRoZSByZXNvbHZlZCBEaXN0aW5jdCBJRHMgcmF0aGVyIHRoYW4gdGhlIHByb3Bvc2VkIElEXG4gICAqIHdoZW4gdGhpcyBldmVudCBpcyB0cmlnZ2VyZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZVJlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdFxuICAgKi9cbiAgX2NyZWF0ZVJlc3VsdCh7IHN1Y2Nlc3MsIGRhdGEgfSkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZVN1Y2Nlc3MoZGF0YSk7XG4gICAgfSBlbHNlIGlmIChkYXRhLmlkID09PSAnY29uZmxpY3QnKSB7XG4gICAgICB0aGlzLl9jcmVhdGVSZXN1bHRDb25mbGljdChkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKHRoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXggKyAnOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgc3VjY2Vzc2Z1bCByZXN1bHQgb2YgYSBjcmVhdGUgY2FsbFxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVTdWNjZXNzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgQ29udmVyc2F0aW9uL0NoYW5uZWxcbiAgICovXG4gIF9jcmVhdGVTdWNjZXNzKGRhdGEpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKGRhdGEpO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYyh0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpzZW50Jywge1xuICAgICAgcmVzdWx0OiBpZCA9PT0gdGhpcy5pZCA/IENvbnRhaW5lci5DUkVBVEVEIDogQ29udGFpbmVyLkZPVU5ELFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgQ29udmVyc2F0aW9uIGZyb20gdGhlIHNlcnZlciAoaW50ZXJuYWwgdmVyc2lvbikuXG4gICAqXG4gICAqIFRoaXMgdmVyc2lvbiBvZiBEZWxldGUgdGFrZXMgYSBRdWVyeSBTdHJpbmcgdGhhdCBpcyBwYWNrYWdlZCB1cCBieVxuICAgKiBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlIGFuZCBsYXllci5Db252ZXJzYXRpb24ubGVhdmUuXG4gICAqXG4gICAqIEBtZXRob2QgX2RlbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gcXVlcnlTdHIgLSBRdWVyeSBzdHJpbmcgZm9yIHRoZSBERUxFVEUgcmVxdWVzdFxuICAgKi9cbiAgX2RlbGV0ZShxdWVyeVN0cikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHVybDogJz8nICsgcXVlcnlTdHIsXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX2RlbGV0ZVJlc3VsdChyZXN1bHQsIGlkKSk7XG5cbiAgICB0aGlzLl9kZWxldGVkKCk7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH1cblxuICBfaGFuZGxlV2Vic29ja2V0RGVsZXRlKGRhdGEpIHtcbiAgICBpZiAoZGF0YS5tb2RlID09PSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTICYmIGRhdGEuZnJvbV9wb3NpdGlvbikge1xuICAgICAgdGhpcy5nZXRDbGllbnQoKS5fcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb24odGhpcy5pZCwgZGF0YS5mcm9tX3Bvc2l0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VwZXIuX2hhbmRsZVdlYnNvY2tldERlbGV0ZSgpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsICsgKHVybCB8fCAnJyk7XG4gIH1cblxuICBfbG9hZGVkKGRhdGEpIHtcbiAgICB0aGlzLl9yZWdpc3Rlcih0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFuZGFyZCBgb24oKWAgcHJvdmlkZWQgYnkgbGF5ZXIuUm9vdC5cbiAgICpcbiAgICogQWRkcyBzb21lIHNwZWNpYWwgaGFuZGxpbmcgb2YgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyBzbyB0aGF0IGNhbGxzIHN1Y2ggYXNcbiAgICpcbiAgICogICAgICB2YXIgYyA9IGNsaWVudC5nZXRDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIG15cmVyZW5kZXIoYyk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgbXlyZW5kZXIoYyk7IC8vIHJlbmRlciBhIHBsYWNlaG9sZGVyIGZvciBjIHVudGlsIHRoZSBkZXRhaWxzIG9mIGMgaGF2ZSBsb2FkZWRcbiAgICpcbiAgICogY2FuIGZpcmUgdGhlaXIgY2FsbGJhY2sgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjbGllbnQgbG9hZHMgb3IgaGFzXG4gICAqIGFscmVhZHkgbG9hZGVkIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dFxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgY29uc3QgZXZ0TmFtZSA9IGAke3RoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXh9OmxvYWRlZGA7XG4gICAgY29uc3QgaGFzTG9hZGVkRXZ0ID0gbmFtZSA9PT0gZXZ0TmFtZSB8fCAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgJiYgbmFtZVtldnROYW1lXSk7XG5cbiAgICBpZiAoaGFzTG9hZGVkRXZ0ICYmICF0aGlzLmlzTG9hZGluZykge1xuICAgICAgY29uc3QgY2FsbE5vdyA9IG5hbWUgPT09IGV2dE5hbWUgPyBjYWxsYmFjayA6IG5hbWVbZXZ0TmFtZV07XG4gICAgICBVdGlsLmRlZmVyKCgpID0+IGNhbGxOb3cuYXBwbHkoY29udGV4dCkpO1xuICAgIH1cbiAgICBzdXBlci5vbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSB3aWxsIGNhbGwgdGhpcyBtZXRob2QgYW5kIGZpcmUgYVxuICAgKiBjaGFuZ2UgZXZlbnQuICBDaGFuZ2VzIHRvIHRoZSBtZXRhZGF0YSBvYmplY3QgdGhhdCBkb24ndCByZXBsYWNlIHRoZSBvYmplY3RcbiAgICogd2l0aCBhIG5ldyBvYmplY3Qgd2lsbCByZXF1aXJlIGRpcmVjdGx5IGNhbGxpbmcgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVNZXRhZGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2xkVmFsdWVcbiAgICovXG4gIF9fdXBkYXRlTWV0YWRhdGEobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykge1xuICAgIGlmICh0aGlzLl9pbkxheWVyUGFyc2VyKSByZXR1cm47XG4gICAgaWYgKEpTT04uc3RyaW5naWZ5KG5ld1ZhbHVlKSAhPT0gSlNPTi5zdHJpbmdpZnkob2xkVmFsdWUpKSB7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoYCR7dGhpcy5jb25zdHJ1Y3Rvci5ldmVudFByZWZpeH06Y2hhbmdlYCwge1xuICAgICAgICBwcm9wZXJ0eTogJ21ldGFkYXRhJyxcbiAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgIG9sZFZhbHVlLFxuICAgICAgICBwYXRocyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcGxhaW4gb2JqZWN0LlxuICAgKlxuICAgKiBPYmplY3Qgd2lsbCBoYXZlIGFsbCB0aGUgc2FtZSBwdWJsaWMgcHJvcGVydGllcyBhcyB0aGlzXG4gICAqIENvbnZlcnNhdGlvbiBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcy5cbiAgICovXG4gIHRvT2JqZWN0KCkge1xuICAgIGlmICghdGhpcy5fdG9PYmplY3QpIHtcbiAgICAgIHRoaXMuX3RvT2JqZWN0ID0gc3VwZXIudG9PYmplY3QoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0Lm1ldGFkYXRhID0gVXRpbC5jbG9uZSh0aGlzLm1ldGFkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3RvT2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgd2hldGhlciBhIENvbnZlcnNhdGlvbiByZWNlaXZpbmcgdGhlIHNwZWNpZmllZCBwYXRjaCBkYXRhIHNob3VsZCBiZSBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIHRvIGEgQ29udmVyc2F0aW9uIGluZGljYXRlcyB0aGF0IHRoZSBDb252ZXJzYXRpb24gaXMgYWN0aXZlIGFuZCBvZiBwb3RlbnRpYWwgaW50ZXJlc3Q7IGdvIGFoZWFkIGFuZCBsb2FkIHRoYXRcbiAgICogQ29udmVyc2F0aW9uIGluIGNhc2UgdGhlIGFwcCBoYXMgbmVlZCBvZiBpdC4gIEluIHRoZSBmdXR1cmUgd2UgbWF5IGlnbm9yZSBjaGFuZ2VzIHRvIHVucmVhZCBjb3VudC4gIE9ubHkgcmVsZXZhbnRcbiAgICogd2hlbiB3ZSBnZXQgV2Vic29ja2V0IGV2ZW50cyBmb3IgYSBDb252ZXJzYXRpb24gdGhhdCBoYXMgbm90IGJlZW4gbG9hZGVkL2NhY2hlZCBvbiBDbGllbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRSZXNvdXJjZUZvclBhdGNoXG4gICAqIEBzdGF0aWNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBfbG9hZFJlc291cmNlRm9yUGF0Y2gocGF0Y2hEYXRhKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIGNvbnZlcnNhdGlvbiB3YXMgY3JlYXRlZCBvbiB0aGUgc2VydmVyLlxuICpcbiAqIEB0eXBlIHtEYXRlfVxuICovXG5Db250YWluZXIucHJvdG90eXBlLmNyZWF0ZWRBdCA9IG51bGw7XG5cbi8qKlxuICogTWV0YWRhdGEgZm9yIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogTWV0YWRhdGEgdmFsdWVzIGNhbiBiZSBwbGFpbiBvYmplY3RzIGFuZCBzdHJpbmdzLCBidXRcbiAqIG5vIGFycmF5cywgbnVtYmVycywgYm9vbGVhbnMgb3IgZGF0ZXMuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5Db250YWluZXIucHJvdG90eXBlLm1ldGFkYXRhID0gbnVsbDtcblxuXG4vKipcbiAqIFRoZSBhdXRoZW50aWNhdGVkIHVzZXIgaXMgYSBjdXJyZW50IHBhcnRpY2lwYW50IGluIHRoaXMgQ29udmVyc2F0aW9uLlxuICpcbiAqIFNldCB0byBmYWxzZSBpZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyIGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGlzIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBBIHJlbW92ZWQgdXNlciBjYW4gc2VlIG1lc3NhZ2VzIHVwIHRvIHRoZSB0aW1lIHRoZXkgd2VyZSByZW1vdmVkLFxuICogYnV0IGNhbiBubyBsb25nZXIgaW50ZXJhY3Qgd2l0aCB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIEEgcmVtb3ZlZCB1c2VyIGNhbiBubyBsb25nZXIgc2VlIHRoZSBwYXJ0aWNpcGFudCBsaXN0LlxuICpcbiAqIFJlYWQgYW5kIERlbGl2ZXJ5IHJlY2VpcHRzIHdpbGwgZmFpbCBvbiBhbnkgTWVzc2FnZSBpbiBzdWNoIGEgQ29udmVyc2F0aW9uLlxuICpcbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5Db250YWluZXIucHJvdG90eXBlLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gdHJ1ZTtcblxuXG4vKipcbiAqIENhY2hlJ3MgYSBEaXN0aW5jdCBFdmVudC5cbiAqXG4gKiBPbiBjcmVhdGluZyBhIENoYW5uZWwgb3IgQ29udmVyc2F0aW9uIHRoYXQgYWxyZWFkeSBleGlzdHMsXG4gKiB3aGVuIHRoZSBzZW5kKCkgbWV0aG9kIGlzIGNhbGxlZCwgd2Ugc2hvdWxkIHRyaWdnZXJcbiAqIHNwZWNpZmljIGV2ZW50cyBkZXRhaWxpbmcgdGhlIHJlc3VsdHMuICBSZXN1bHRzXG4gKiBtYXkgYmUgZGV0ZXJtaW5lZCBsb2NhbGx5IG9yIG9uIHRoZSBzZXJ2ZXIsIGJ1dCBzYW1lIEV2ZW50IG1heSBiZSBuZWVkZWQuXG4gKlxuICogQHR5cGUge2xheWVyLkxheWVyRXZlbnR9XG4gKiBAcHJpdmF0ZVxuICovXG5Db250YWluZXIucHJvdG90eXBlLl9zZW5kRGlzdGluY3RFdmVudCA9IG51bGw7XG5cbi8qKlxuICogQ2FjaGVzIGxhc3QgcmVzdWx0IG9mIHRvT2JqZWN0KClcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5Db250YWluZXIucHJvdG90eXBlLl90b09iamVjdCA9IG51bGw7XG5cblxuXG4vKipcbiAqIFByb3BlcnR5IHRvIGxvb2sgZm9yIHdoZW4gYnViYmxpbmcgdXAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKi9cbkNvbnRhaW5lci5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24vQ2hhbm5lbCB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gY3JlYXRlZC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnRhaW5lci5DUkVBVEVEID0gJ0NyZWF0ZWQnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24vQ2hhbm5lbCB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gZm91bmQuXG4gKlxuICogVGhpcyBtZWFucyB0aGF0IGl0IGRpZCBub3QgbmVlZCB0byBiZSBjcmVhdGVkLlxuICpcbiAqIFVzZWQgaW4gYGNvbnZlcnNhdGlvbnM6c2VudGAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuQ29udGFpbmVyLkZPVU5EID0gJ0ZvdW5kJztcblxuLyoqXG4gKiBUaGUgQ29udmVyc2F0aW9uL0NoYW5uZWwgdGhhdCB3YXMgcmVxdWVzdGVkIGhhcyBiZWVuIGZvdW5kLCBidXQgdGhlcmUgd2FzIGEgbWlzbWF0Y2ggaW4gbWV0YWRhdGEuXG4gKlxuICogSWYgdGhlIGNyZWF0ZUNvbnZlcnNhdGlvbiByZXF1ZXN0IGNvbnRhaW5lZCBtZXRhZGF0YSBhbmQgaXQgZGlkIG5vdCBtYXRjaCB0aGUgRGlzdGluY3QgQ29udmVyc2F0aW9uXG4gKiB0aGF0IG1hdGNoZWQgdGhlIHJlcXVlc3RlZCBwYXJ0aWNpcGFudHMsIHRoZW4gdGhpcyB2YWx1ZSBpcyBwYXNzZWQgdG8gbm90aWZ5IHlvdXIgYXBwIHRoYXQgdGhlIENvbnZlcnNhdGlvblxuICogd2FzIHJldHVybmVkIGJ1dCBkb2VzIG5vdCBleGFjdGx5IG1hdGNoIHlvdXIgcmVxdWVzdC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnRhaW5lci5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQSA9ICdGb3VuZE1pc21hdGNoJztcblxuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb250YWluZXIsIFtDb250YWluZXIsICdDb250YWluZXInXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQ29udGFpbmVyKTtcbm1vZHVsZS5leHBvcnRzID0gQ29udGFpbmVyO1xuIl19
