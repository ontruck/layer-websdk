'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Syncable abstract clas represents resources that are syncable with the server.
 * This is currently used for Messages and Conversations.
 * It represents the state of the object's sync, as one of:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @class layer.Syncable
 * @extends layer.Root
 * @abstract
 */

var Root = require('../root');

var _require = require('../const'),
    SYNC_STATE = _require.SYNC_STATE;

var LayerError = require('../layer-error');
var ClientRegistry = require('../client-registry');
var Constants = require('../const');

var Syncable = function (_Root) {
  _inherits(Syncable, _Root);

  function Syncable() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Syncable);

    var _this = _possibleConstructorReturn(this, (Syncable.__proto__ || Object.getPrototypeOf(Syncable)).call(this, options));

    _this.localCreatedAt = new Date();
    return _this;
  }

  /**
   * Get the client associated with this Object.
   *
   * @method getClient
   * @return {layer.Client}
   */


  _createClass(Syncable, [{
    key: 'getClient',
    value: function getClient() {
      return ClientRegistry.get(this.clientId);
    }

    /**
     * Fire an XHR request using the URL for this resource.
     *
     * For more info on xhr method parameters see {@link layer.ClientAuthenticator#xhr}
     *
     * @method _xhr
     * @protected
     * @return {layer.Syncable} this
     */

  }, {
    key: '_xhr',
    value: function _xhr(options, callback) {
      var _this2 = this;

      // initialize
      if (!options.url) options.url = '';
      if (!options.method) options.method = 'GET';
      var client = this.getClient();

      // Validatation
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      if (!client) throw new Error(LayerError.dictionary.clientMissing);
      if (!this.constructor.enableOpsIfNew && options.method !== 'POST' && options.method !== 'GET' && this.syncState === Constants.SYNC_STATE.NEW) return this;

      if (!options.url.match(/^http(s):\/\//)) {
        if (options.url && !options.url.match(/^(\/|\?)/)) options.url = '/' + options.url;
        if (!options.sync) options.url = this.url + options.url;
      }

      // Setup sync structure
      options.sync = this._setupSyncObject(options.sync);

      if (options.method !== 'GET') {
        this._setSyncing();
      }

      client.xhr(options, function (result) {
        if (result.success && options.method !== 'GET' && !_this2.isDestroyed) {
          _this2._setSynced();
        }
        if (callback) callback(result);
      });
      return this;
    }

    /**
     * Setup an object to pass in the `sync` parameter for any sync requests.
     *
     * @method _setupSyncObject
     * @private
     * @param {Object} sync - Known parameters of the sync object to be returned; or null.
     * @return {Object} fleshed out sync object
     */

  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        if (!sync) sync = {};
        if (!sync.target) sync.target = this.id;
      }
      return sync;
    }

    /**
     * A websocket event has been received specifying that this resource
     * has been deleted.
     *
     * @method handleWebsocketDelete
     * @protected
     * @param {Object} data
     */

  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      this._deleted();
      this.destroy();
    }

    /**
     * The Object has been deleted.
     *
     * Destroy must be called separately, and handles most cleanup.
     *
     * @method _deleted
     * @protected
     */

  }, {
    key: '_deleted',
    value: function _deleted() {
      this.trigger(this.constructor.eventPrefix + ':delete');
    }

    /**
     * Load the resource identified via a Layer ID.
     *
     * Will load the requested resource from persistence or server as needed,
     * and trigger `type-name:loaded` when its loaded.  Instance returned by this
     * method will have only ID and URL properties, all others are unset until
     * the `conversations:loaded`, `messages:loaded`, etc... event has fired.
     *
     * ```
     * var message = layer.Message.load(messageId, client);
     * message.once('messages:loaded', function(evt) {
     *    alert("Message loaded");
     * });
     * ```
     *
     * @method load
     * @static
     * @param {string} id - `layer:///messages/UUID`
     * @param {layer.Client} client
     * @return {layer.Syncable} - Returns an empty object that will be populated once data is loaded.
     */

  }, {
    key: '_load',


    /**
     * Load this resource from the server.
     *
     * Called from the static layer.Syncable.load() method
     *
     * @method _load
     * @private
     */
    value: function _load() {
      var _this3 = this;

      this.syncState = SYNC_STATE.LOADING;
      this._xhr({
        method: 'GET',
        sync: false
      }, function (result) {
        return _this3._loadResult(result);
      });
    }
  }, {
    key: '_loadResult',
    value: function _loadResult(result) {
      var _this4 = this;

      var prefix = this.constructor.eventPrefix;
      if (!result.success) {
        this.syncState = SYNC_STATE.NEW;
        this._triggerAsync(prefix + ':loaded-error', { error: result.data });
        setTimeout(function () {
          if (!_this4.isDestroyed) _this4.destroy();
        }, 100); // Insure destroyed AFTER loaded-error event has triggered
      } else {
        this._populateFromServer(result.data);
        this._loaded(result.data);
        this.trigger(prefix + ':loaded');
      }
    }

    /**
     * Processing the result of a _load() call.
     *
     * Typically used to register the object and cleanup any properties not handled by _populateFromServer.
     *
     * @method _loaded
     * @private
     * @param  {Object} data - Response data from server
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {}

    /**
     * Object is new, and is queued for syncing, but does not yet exist on the server.
     *
     * That means it is currently out of sync with the server.
     *
     * @method _setSyncing
     * @private
     */

  }, {
    key: '_setSyncing',
    value: function _setSyncing() {
      this._clearObject();
      switch (this.syncState) {
        case SYNC_STATE.SYNCED:
          this.syncState = SYNC_STATE.SYNCING;
          break;
        case SYNC_STATE.NEW:
          this.syncState = SYNC_STATE.SAVING;
          break;
      }
      this._syncCounter++;
    }

    /**
     * Object is synced with the server and up to date.
     *
     * @method _setSynced
     * @private
     */

  }, {
    key: '_setSynced',
    value: function _setSynced() {
      this._clearObject();
      if (this._syncCounter > 0) this._syncCounter--;

      this.syncState = this._syncCounter === 0 ? SYNC_STATE.SYNCED : SYNC_STATE.SYNCING;
      this.isSending = false;
    }

    /**
     * Any time the instance changes, we should clear the cached toObject value
     *
     * @method _clearObject
     * @private
     */

  }, {
    key: '_clearObject',
    value: function _clearObject() {
      this._toObject = null;
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Syncable instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Syncable.prototype.__proto__ || Object.getPrototypeOf(Syncable.prototype), 'toObject', this).call(this);
        this._toObject.isNew = this.isNew();
        this._toObject.isSaving = this.isSaving();
        this._toObject.isSaved = this.isSaved();
        this._toObject.isSynced = this.isSynced();
      }
      return this._toObject;
    }

    /**
     * Object is new, and is not yet queued for syncing
     *
     * @method isNew
     * @returns {boolean}
     */

  }, {
    key: 'isNew',
    value: function isNew() {
      return this.syncState === SYNC_STATE.NEW;
    }

    /**
     * Object is new, and is queued for syncing
     *
     * @method isSaving
     * @returns {boolean}
     */

  }, {
    key: 'isSaving',
    value: function isSaving() {
      return this.syncState === SYNC_STATE.SAVING;
    }

    /**
     * Object exists on server.
     *
     * @method isSaved
     * @returns {boolean}
     */

  }, {
    key: 'isSaved',
    value: function isSaved() {
      return !(this.isNew() || this.isSaving());
    }

    /**
     * Object is fully synced.
     *
     * As best we know, server and client have the same values.
     *
     * @method isSynced
     * @returns {boolean}
     */

  }, {
    key: 'isSynced',
    value: function isSynced() {
      return this.syncState === SYNC_STATE.SYNCED;
    }
  }], [{
    key: 'load',
    value: function load(id, client) {
      if (!client || !(client instanceof Root)) throw new Error(LayerError.dictionary.clientMissing);

      var obj = {
        id: id,
        url: client.url + id.substring(8),
        clientId: client.appId
      };

      if (!Syncable.sortedSubclasses) {
        Syncable.sortedSubclasses = Syncable.subclasses.filter(function (item) {
          return item.prefixUUID;
        }).sort(function (a, b) {
          return a.prefixUUID.length - b.prefixUUID.length;
        });
      }

      var ConstructorClass = Syncable.sortedSubclasses.filter(function (aClass) {
        if (aClass.prefixUUID.indexOf('layer:///') === 0) {
          return obj.id.indexOf(aClass.prefixUUID) === 0;
        } else {
          return obj.id.indexOf(aClass.prefixUUID) !== -1;
        }
      })[0];
      var syncItem = new ConstructorClass(obj);
      var typeName = ConstructorClass.eventPrefix;

      if (typeName) {
        client.dbManager.getObject(typeName, id, function (item) {
          if (syncItem.isDestroyed) return;
          if (item) {
            syncItem._populateFromServer(item);
            syncItem.trigger(typeName + ':loaded');
          } else {
            syncItem._load();
          }
        });
      } else {
        syncItem._load();
      }

      syncItem.syncState = SYNC_STATE.LOADING;
      return syncItem;
    }
  }]);

  return Syncable;
}(Root);

/**
 * Unique identifier.
 *
 * @type {string}
 */


Syncable.prototype.id = '';

/**
 * URL to access the object on the server.
 *
 * @type {string}
 * @readonly
 * @protected
 */
Syncable.prototype.url = '';

/**
 * The time that this client created this instance.
 *
 * This value is not tied to when it was first created on the server.  Creating a new instance
 * based on server data will result in a new `localCreateAt` value.
 *
 * @type {Date}
 */
Syncable.prototype.localCreatedAt = null;

/**
 * layer.Client that the object belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @protected
 * @readonly
 */
Syncable.prototype.clientId = '';

/**
 * Temporary property indicating that the instance was loaded from local database rather than server.
 *
 * @type {boolean}
 * @private
 */
Syncable.prototype._fromDB = false;

/**
 * The current sync state of this object.
 *
 * Possible values are:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @type {string}
 */
Syncable.prototype.syncState = SYNC_STATE.NEW;

/**
 * Number of sync requests that have been requested.
 *
 * Counts down to zero; once it reaches zero, all sync
 * requests have been completed.
 *
 * @type {Number}
 * @private
 */
Syncable.prototype._syncCounter = 0;

/**
 * Prefix to use when triggering events
 * @private
 * @static
 */
Syncable.eventPrefix = '';

Syncable.enableOpsIfNew = false;

/**
 * Is the object loading from the server?
 *
 * @type {boolean}
 */
Object.defineProperty(Syncable.prototype, 'isLoading', {
  enumerable: true,
  get: function get() {
    return this.syncState === SYNC_STATE.LOADING;
  }
});

/**
 * Array of classes that are subclasses of Syncable.
 *
 * Used by Factory function.
 * @private
 */
Syncable.subclasses = [];

Syncable._supportedEvents = [].concat(Root._supportedEvents);
Syncable.inObjectIgnore = Root.inObjectIgnore;
module.exports = Syncable;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvc3luY2FibGUuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJTWU5DX1NUQVRFIiwiTGF5ZXJFcnJvciIsIkNsaWVudFJlZ2lzdHJ5IiwiQ29uc3RhbnRzIiwiU3luY2FibGUiLCJvcHRpb25zIiwibG9jYWxDcmVhdGVkQXQiLCJEYXRlIiwiZ2V0IiwiY2xpZW50SWQiLCJjYWxsYmFjayIsInVybCIsIm1ldGhvZCIsImNsaWVudCIsImdldENsaWVudCIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsImNvbnN0cnVjdG9yIiwiZW5hYmxlT3BzSWZOZXciLCJzeW5jU3RhdGUiLCJORVciLCJtYXRjaCIsInN5bmMiLCJfc2V0dXBTeW5jT2JqZWN0IiwiX3NldFN5bmNpbmciLCJ4aHIiLCJyZXN1bHQiLCJzdWNjZXNzIiwiX3NldFN5bmNlZCIsInRhcmdldCIsImlkIiwiZGF0YSIsIl9kZWxldGVkIiwiZGVzdHJveSIsInRyaWdnZXIiLCJldmVudFByZWZpeCIsIkxPQURJTkciLCJfeGhyIiwiX2xvYWRSZXN1bHQiLCJwcmVmaXgiLCJfdHJpZ2dlckFzeW5jIiwiZXJyb3IiLCJzZXRUaW1lb3V0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsIl9sb2FkZWQiLCJfY2xlYXJPYmplY3QiLCJTWU5DRUQiLCJTWU5DSU5HIiwiU0FWSU5HIiwiX3N5bmNDb3VudGVyIiwiaXNTZW5kaW5nIiwiX3RvT2JqZWN0IiwiaXNOZXciLCJpc1NhdmluZyIsImlzU2F2ZWQiLCJpc1N5bmNlZCIsIm9iaiIsInN1YnN0cmluZyIsImFwcElkIiwic29ydGVkU3ViY2xhc3NlcyIsInN1YmNsYXNzZXMiLCJmaWx0ZXIiLCJpdGVtIiwicHJlZml4VVVJRCIsInNvcnQiLCJhIiwiYiIsImxlbmd0aCIsIkNvbnN0cnVjdG9yQ2xhc3MiLCJhQ2xhc3MiLCJpbmRleE9mIiwic3luY0l0ZW0iLCJ0eXBlTmFtZSIsImRiTWFuYWdlciIsImdldE9iamVjdCIsIl9sb2FkIiwicHJvdG90eXBlIiwiX2Zyb21EQiIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbk9iamVjdElnbm9yZSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiOztlQUN1QkEsUUFBUSxVQUFSLEM7SUFBZkMsVSxZQUFBQSxVOztBQUNSLElBQU1DLGFBQWFGLFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNRyxpQkFBaUJILFFBQVEsb0JBQVIsQ0FBdkI7QUFDQSxJQUFNSSxZQUFZSixRQUFRLFVBQVIsQ0FBbEI7O0lBRU1LLFE7OztBQUNKLHNCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFBQSxvSEFDbEJBLE9BRGtCOztBQUV4QixVQUFLQyxjQUFMLEdBQXNCLElBQUlDLElBQUosRUFBdEI7QUFGd0I7QUFHekI7O0FBRUQ7Ozs7Ozs7Ozs7Z0NBTVk7QUFDVixhQUFPTCxlQUFlTSxHQUFmLENBQW1CLEtBQUtDLFFBQXhCLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O3lCQVNLSixPLEVBQVNLLFEsRUFBVTtBQUFBOztBQUN0QjtBQUNBLFVBQUksQ0FBQ0wsUUFBUU0sR0FBYixFQUFrQk4sUUFBUU0sR0FBUixHQUFjLEVBQWQ7QUFDbEIsVUFBSSxDQUFDTixRQUFRTyxNQUFiLEVBQXFCUCxRQUFRTyxNQUFSLEdBQWlCLEtBQWpCO0FBQ3JCLFVBQU1DLFNBQVMsS0FBS0MsU0FBTCxFQUFmOztBQUVBO0FBQ0EsVUFBSSxLQUFLQyxXQUFULEVBQXNCLE1BQU0sSUFBSUMsS0FBSixDQUFVZixXQUFXZ0IsVUFBWCxDQUFzQkYsV0FBaEMsQ0FBTjtBQUN0QixVQUFJLENBQUNGLE1BQUwsRUFBYSxNQUFNLElBQUlHLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0JDLGFBQWhDLENBQU47QUFDYixVQUFJLENBQUMsS0FBS0MsV0FBTCxDQUFpQkMsY0FBbEIsSUFDRmYsUUFBUU8sTUFBUixLQUFtQixNQURqQixJQUMyQlAsUUFBUU8sTUFBUixLQUFtQixLQUQ5QyxJQUVGLEtBQUtTLFNBQUwsS0FBbUJsQixVQUFVSCxVQUFWLENBQXFCc0IsR0FGMUMsRUFFK0MsT0FBTyxJQUFQOztBQUUvQyxVQUFJLENBQUNqQixRQUFRTSxHQUFSLENBQVlZLEtBQVosQ0FBa0IsZUFBbEIsQ0FBTCxFQUF5QztBQUN2QyxZQUFJbEIsUUFBUU0sR0FBUixJQUFlLENBQUNOLFFBQVFNLEdBQVIsQ0FBWVksS0FBWixDQUFrQixVQUFsQixDQUFwQixFQUFtRGxCLFFBQVFNLEdBQVIsR0FBYyxNQUFNTixRQUFRTSxHQUE1QjtBQUNuRCxZQUFJLENBQUNOLFFBQVFtQixJQUFiLEVBQW1CbkIsUUFBUU0sR0FBUixHQUFjLEtBQUtBLEdBQUwsR0FBV04sUUFBUU0sR0FBakM7QUFDcEI7O0FBRUQ7QUFDQU4sY0FBUW1CLElBQVIsR0FBZSxLQUFLQyxnQkFBTCxDQUFzQnBCLFFBQVFtQixJQUE5QixDQUFmOztBQUVBLFVBQUluQixRQUFRTyxNQUFSLEtBQW1CLEtBQXZCLEVBQThCO0FBQzVCLGFBQUtjLFdBQUw7QUFDRDs7QUFFRGIsYUFBT2MsR0FBUCxDQUFXdEIsT0FBWCxFQUFvQixVQUFDdUIsTUFBRCxFQUFZO0FBQzlCLFlBQUlBLE9BQU9DLE9BQVAsSUFBa0J4QixRQUFRTyxNQUFSLEtBQW1CLEtBQXJDLElBQThDLENBQUMsT0FBS0csV0FBeEQsRUFBcUU7QUFDbkUsaUJBQUtlLFVBQUw7QUFDRDtBQUNELFlBQUlwQixRQUFKLEVBQWNBLFNBQVNrQixNQUFUO0FBQ2YsT0FMRDtBQU1BLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OztxQ0FRaUJKLEksRUFBTTtBQUNyQixVQUFJQSxTQUFTLEtBQWIsRUFBb0I7QUFDbEIsWUFBSSxDQUFDQSxJQUFMLEVBQVdBLE9BQU8sRUFBUDtBQUNYLFlBQUksQ0FBQ0EsS0FBS08sTUFBVixFQUFrQlAsS0FBS08sTUFBTCxHQUFjLEtBQUtDLEVBQW5CO0FBQ25CO0FBQ0QsYUFBT1IsSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzsyQ0FRdUJTLEksRUFBTTtBQUMzQixXQUFLQyxRQUFMO0FBQ0EsV0FBS0MsT0FBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzsrQkFRVztBQUNULFdBQUtDLE9BQUwsQ0FBYSxLQUFLakIsV0FBTCxDQUFpQmtCLFdBQWpCLEdBQStCLFNBQTVDO0FBQ0Q7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0RBOzs7Ozs7Ozs0QkFRUTtBQUFBOztBQUNOLFdBQUtoQixTQUFMLEdBQWlCckIsV0FBV3NDLE9BQTVCO0FBQ0EsV0FBS0MsSUFBTCxDQUFVO0FBQ1IzQixnQkFBUSxLQURBO0FBRVJZLGNBQU07QUFGRSxPQUFWLEVBR0c7QUFBQSxlQUFVLE9BQUtnQixXQUFMLENBQWlCWixNQUFqQixDQUFWO0FBQUEsT0FISDtBQUlEOzs7Z0NBR1dBLE0sRUFBUTtBQUFBOztBQUNsQixVQUFNYSxTQUFTLEtBQUt0QixXQUFMLENBQWlCa0IsV0FBaEM7QUFDQSxVQUFJLENBQUNULE9BQU9DLE9BQVosRUFBcUI7QUFDbkIsYUFBS1IsU0FBTCxHQUFpQnJCLFdBQVdzQixHQUE1QjtBQUNBLGFBQUtvQixhQUFMLENBQW1CRCxTQUFTLGVBQTVCLEVBQTZDLEVBQUVFLE9BQU9mLE9BQU9LLElBQWhCLEVBQTdDO0FBQ0FXLG1CQUFXLFlBQU07QUFDZixjQUFJLENBQUMsT0FBSzdCLFdBQVYsRUFBdUIsT0FBS29CLE9BQUw7QUFDeEIsU0FGRCxFQUVHLEdBRkgsRUFIbUIsQ0FLVjtBQUNWLE9BTkQsTUFNTztBQUNMLGFBQUtVLG1CQUFMLENBQXlCakIsT0FBT0ssSUFBaEM7QUFDQSxhQUFLYSxPQUFMLENBQWFsQixPQUFPSyxJQUFwQjtBQUNBLGFBQUtHLE9BQUwsQ0FBYUssU0FBUyxTQUF0QjtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs0QkFTUVIsSSxFQUFNLENBRWI7O0FBRUQ7Ozs7Ozs7Ozs7O2tDQVFjO0FBQ1osV0FBS2MsWUFBTDtBQUNBLGNBQVEsS0FBSzFCLFNBQWI7QUFDRSxhQUFLckIsV0FBV2dELE1BQWhCO0FBQ0UsZUFBSzNCLFNBQUwsR0FBaUJyQixXQUFXaUQsT0FBNUI7QUFDQTtBQUNGLGFBQUtqRCxXQUFXc0IsR0FBaEI7QUFDRSxlQUFLRCxTQUFMLEdBQWlCckIsV0FBV2tELE1BQTVCO0FBQ0E7QUFOSjtBQVFBLFdBQUtDLFlBQUw7QUFDRDs7QUFFRDs7Ozs7Ozs7O2lDQU1hO0FBQ1gsV0FBS0osWUFBTDtBQUNBLFVBQUksS0FBS0ksWUFBTCxHQUFvQixDQUF4QixFQUEyQixLQUFLQSxZQUFMOztBQUUzQixXQUFLOUIsU0FBTCxHQUFpQixLQUFLOEIsWUFBTCxLQUFzQixDQUF0QixHQUEwQm5ELFdBQVdnRCxNQUFyQyxHQUNLaEQsV0FBV2lELE9BRGpDO0FBRUEsV0FBS0csU0FBTCxHQUFpQixLQUFqQjtBQUNEOztBQUVEOzs7Ozs7Ozs7bUNBTWU7QUFDYixXQUFLQyxTQUFMLEdBQWlCLElBQWpCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7K0JBVVc7QUFDVCxVQUFJLENBQUMsS0FBS0EsU0FBVixFQUFxQjtBQUNuQixhQUFLQSxTQUFMO0FBQ0EsYUFBS0EsU0FBTCxDQUFlQyxLQUFmLEdBQXVCLEtBQUtBLEtBQUwsRUFBdkI7QUFDQSxhQUFLRCxTQUFMLENBQWVFLFFBQWYsR0FBMEIsS0FBS0EsUUFBTCxFQUExQjtBQUNBLGFBQUtGLFNBQUwsQ0FBZUcsT0FBZixHQUF5QixLQUFLQSxPQUFMLEVBQXpCO0FBQ0EsYUFBS0gsU0FBTCxDQUFlSSxRQUFmLEdBQTBCLEtBQUtBLFFBQUwsRUFBMUI7QUFDRDtBQUNELGFBQU8sS0FBS0osU0FBWjtBQUNEOztBQUVEOzs7Ozs7Ozs7NEJBTVE7QUFDTixhQUFPLEtBQUtoQyxTQUFMLEtBQW1CckIsV0FBV3NCLEdBQXJDO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OzsrQkFNVztBQUNULGFBQU8sS0FBS0QsU0FBTCxLQUFtQnJCLFdBQVdrRCxNQUFyQztBQUNEOztBQUVEOzs7Ozs7Ozs7OEJBTVU7QUFDUixhQUFPLEVBQUUsS0FBS0ksS0FBTCxNQUFnQixLQUFLQyxRQUFMLEVBQWxCLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7K0JBUVc7QUFDVCxhQUFPLEtBQUtsQyxTQUFMLEtBQW1CckIsV0FBV2dELE1BQXJDO0FBQ0Q7Ozt5QkFsTVdoQixFLEVBQUluQixNLEVBQVE7QUFDdEIsVUFBSSxDQUFDQSxNQUFELElBQVcsRUFBRUEsa0JBQWtCZixJQUFwQixDQUFmLEVBQTBDLE1BQU0sSUFBSWtCLEtBQUosQ0FBVWYsV0FBV2dCLFVBQVgsQ0FBc0JDLGFBQWhDLENBQU47O0FBRTFDLFVBQU13QyxNQUFNO0FBQ1YxQixjQURVO0FBRVZyQixhQUFLRSxPQUFPRixHQUFQLEdBQWFxQixHQUFHMkIsU0FBSCxDQUFhLENBQWIsQ0FGUjtBQUdWbEQsa0JBQVVJLE9BQU8rQztBQUhQLE9BQVo7O0FBTUEsVUFBSSxDQUFDeEQsU0FBU3lELGdCQUFkLEVBQWdDO0FBQzlCekQsaUJBQVN5RCxnQkFBVCxHQUE0QnpELFNBQVMwRCxVQUFULENBQW9CQyxNQUFwQixDQUEyQjtBQUFBLGlCQUFRQyxLQUFLQyxVQUFiO0FBQUEsU0FBM0IsRUFDekJDLElBRHlCLENBQ3BCLFVBQUNDLENBQUQsRUFBSUMsQ0FBSjtBQUFBLGlCQUFVRCxFQUFFRixVQUFGLENBQWFJLE1BQWIsR0FBc0JELEVBQUVILFVBQUYsQ0FBYUksTUFBN0M7QUFBQSxTQURvQixDQUE1QjtBQUVEOztBQUVELFVBQU1DLG1CQUFtQmxFLFNBQVN5RCxnQkFBVCxDQUEwQkUsTUFBMUIsQ0FBaUMsVUFBQ1EsTUFBRCxFQUFZO0FBQ3BFLFlBQUlBLE9BQU9OLFVBQVAsQ0FBa0JPLE9BQWxCLENBQTBCLFdBQTFCLE1BQTJDLENBQS9DLEVBQWtEO0FBQ2hELGlCQUFPZCxJQUFJMUIsRUFBSixDQUFPd0MsT0FBUCxDQUFlRCxPQUFPTixVQUF0QixNQUFzQyxDQUE3QztBQUNELFNBRkQsTUFFTztBQUNMLGlCQUFPUCxJQUFJMUIsRUFBSixDQUFPd0MsT0FBUCxDQUFlRCxPQUFPTixVQUF0QixNQUFzQyxDQUFDLENBQTlDO0FBQ0Q7QUFDRixPQU53QixFQU10QixDQU5zQixDQUF6QjtBQU9BLFVBQU1RLFdBQVcsSUFBSUgsZ0JBQUosQ0FBcUJaLEdBQXJCLENBQWpCO0FBQ0EsVUFBTWdCLFdBQVdKLGlCQUFpQmpDLFdBQWxDOztBQUVBLFVBQUlxQyxRQUFKLEVBQWM7QUFDWjdELGVBQU84RCxTQUFQLENBQWlCQyxTQUFqQixDQUEyQkYsUUFBM0IsRUFBcUMxQyxFQUFyQyxFQUF5QyxVQUFDZ0MsSUFBRCxFQUFVO0FBQ2pELGNBQUlTLFNBQVMxRCxXQUFiLEVBQTBCO0FBQzFCLGNBQUlpRCxJQUFKLEVBQVU7QUFDUlMscUJBQVM1QixtQkFBVCxDQUE2Qm1CLElBQTdCO0FBQ0FTLHFCQUFTckMsT0FBVCxDQUFpQnNDLFdBQVcsU0FBNUI7QUFDRCxXQUhELE1BR087QUFDTEQscUJBQVNJLEtBQVQ7QUFDRDtBQUNGLFNBUkQ7QUFTRCxPQVZELE1BVU87QUFDTEosaUJBQVNJLEtBQVQ7QUFDRDs7QUFFREosZUFBU3BELFNBQVQsR0FBcUJyQixXQUFXc0MsT0FBaEM7QUFDQSxhQUFPbUMsUUFBUDtBQUNEOzs7O0VBbEtvQjNFLEk7O0FBK1R2Qjs7Ozs7OztBQUtBTSxTQUFTMEUsU0FBVCxDQUFtQjlDLEVBQW5CLEdBQXdCLEVBQXhCOztBQUVBOzs7Ozs7O0FBT0E1QixTQUFTMEUsU0FBVCxDQUFtQm5FLEdBQW5CLEdBQXlCLEVBQXpCOztBQUVBOzs7Ozs7OztBQVFBUCxTQUFTMEUsU0FBVCxDQUFtQnhFLGNBQW5CLEdBQW9DLElBQXBDOztBQUdBOzs7Ozs7OztBQVFBRixTQUFTMEUsU0FBVCxDQUFtQnJFLFFBQW5CLEdBQThCLEVBQTlCOztBQUVBOzs7Ozs7QUFNQUwsU0FBUzBFLFNBQVQsQ0FBbUJDLE9BQW5CLEdBQTZCLEtBQTdCOztBQUVBOzs7Ozs7Ozs7Ozs7O0FBYUEzRSxTQUFTMEUsU0FBVCxDQUFtQnpELFNBQW5CLEdBQStCckIsV0FBV3NCLEdBQTFDOztBQUVBOzs7Ozs7Ozs7QUFTQWxCLFNBQVMwRSxTQUFULENBQW1CM0IsWUFBbkIsR0FBa0MsQ0FBbEM7O0FBRUE7Ozs7O0FBS0EvQyxTQUFTaUMsV0FBVCxHQUF1QixFQUF2Qjs7QUFFQWpDLFNBQVNnQixjQUFULEdBQTBCLEtBQTFCOztBQUVBOzs7OztBQUtBNEQsT0FBT0MsY0FBUCxDQUFzQjdFLFNBQVMwRSxTQUEvQixFQUEwQyxXQUExQyxFQUF1RDtBQUNyREksY0FBWSxJQUR5QztBQUVyRDFFLE9BQUssU0FBU0EsR0FBVCxHQUFlO0FBQ2xCLFdBQU8sS0FBS2EsU0FBTCxLQUFtQnJCLFdBQVdzQyxPQUFyQztBQUNEO0FBSm9ELENBQXZEOztBQU9BOzs7Ozs7QUFNQWxDLFNBQVMwRCxVQUFULEdBQXNCLEVBQXRCOztBQUVBMUQsU0FBUytFLGdCQUFULEdBQTRCLEdBQUdDLE1BQUgsQ0FBVXRGLEtBQUtxRixnQkFBZixDQUE1QjtBQUNBL0UsU0FBU2lGLGNBQVQsR0FBMEJ2RixLQUFLdUYsY0FBL0I7QUFDQUMsT0FBT0MsT0FBUCxHQUFpQm5GLFFBQWpCIiwiZmlsZSI6InN5bmNhYmxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgU3luY2FibGUgYWJzdHJhY3QgY2xhcyByZXByZXNlbnRzIHJlc291cmNlcyB0aGF0IGFyZSBzeW5jYWJsZSB3aXRoIHRoZSBzZXJ2ZXIuXG4gKiBUaGlzIGlzIGN1cnJlbnRseSB1c2VkIGZvciBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucy5cbiAqIEl0IHJlcHJlc2VudHMgdGhlIHN0YXRlIG9mIHRoZSBvYmplY3QncyBzeW5jLCBhcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXOiBOZXdseSBjcmVhdGVkOyBsb2NhbCBvbmx5LlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU0FWSU5HOiBOZXdseSBjcmVhdGVkOyBiZWluZyBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNJTkc6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyLCBidXQgY2hhbmdlcyBhcmUgYmVpbmcgc2VudCB0byBzZXJ2ZXIuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TWU5DRUQ6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyIGFuZCBpcyBzeW5jZWQuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HOiBFeGlzdHMgb24gc2VydmVyOyBsb2FkaW5nIGl0IGludG8gY2xpZW50LlxuICpcbiAqIEBjbGFzcyBsYXllci5TeW5jYWJsZVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQGFic3RyYWN0XG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IHsgU1lOQ19TVEFURSB9ID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5cbmNsYXNzIFN5bmNhYmxlIGV4dGVuZHMgUm9vdCB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMubG9jYWxDcmVhdGVkQXQgPSBuZXcgRGF0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2xpZW50IGFzc29jaWF0ZWQgd2l0aCB0aGlzIE9iamVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgZ2V0Q2xpZW50KCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCk7XG4gIH1cblxuICAvKipcbiAgICogRmlyZSBhbiBYSFIgcmVxdWVzdCB1c2luZyB0aGUgVVJMIGZvciB0aGlzIHJlc291cmNlLlxuICAgKlxuICAgKiBGb3IgbW9yZSBpbmZvIG9uIHhociBtZXRob2QgcGFyYW1ldGVycyBzZWUge0BsaW5rIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3IjeGhyfVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcmV0dXJuIHtsYXllci5TeW5jYWJsZX0gdGhpc1xuICAgKi9cbiAgX3hocihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIC8vIGluaXRpYWxpemVcbiAgICBpZiAoIW9wdGlvbnMudXJsKSBvcHRpb25zLnVybCA9ICcnO1xuICAgIGlmICghb3B0aW9ucy5tZXRob2QpIG9wdGlvbnMubWV0aG9kID0gJ0dFVCc7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIFZhbGlkYXRhdGlvblxuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcbiAgICBpZiAoIWNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICBpZiAoIXRoaXMuY29uc3RydWN0b3IuZW5hYmxlT3BzSWZOZXcgJiZcbiAgICAgIG9wdGlvbnMubWV0aG9kICE9PSAnUE9TVCcgJiYgb3B0aW9ucy5tZXRob2QgIT09ICdHRVQnICYmXG4gICAgICB0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSByZXR1cm4gdGhpcztcblxuICAgIGlmICghb3B0aW9ucy51cmwubWF0Y2goL15odHRwKHMpOlxcL1xcLy8pKSB7XG4gICAgICBpZiAob3B0aW9ucy51cmwgJiYgIW9wdGlvbnMudXJsLm1hdGNoKC9eKFxcL3xcXD8pLykpIG9wdGlvbnMudXJsID0gJy8nICsgb3B0aW9ucy51cmw7XG4gICAgICBpZiAoIW9wdGlvbnMuc3luYykgb3B0aW9ucy51cmwgPSB0aGlzLnVybCArIG9wdGlvbnMudXJsO1xuICAgIH1cblxuICAgIC8vIFNldHVwIHN5bmMgc3RydWN0dXJlXG4gICAgb3B0aW9ucy5zeW5jID0gdGhpcy5fc2V0dXBTeW5jT2JqZWN0KG9wdGlvbnMuc3luYyk7XG5cbiAgICBpZiAob3B0aW9ucy5tZXRob2QgIT09ICdHRVQnKSB7XG4gICAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG4gICAgfVxuXG4gICAgY2xpZW50LnhocihvcHRpb25zLCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgb3B0aW9ucy5tZXRob2QgIT09ICdHRVQnICYmICF0aGlzLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXN1bHQpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHVwIGFuIG9iamVjdCB0byBwYXNzIGluIHRoZSBgc3luY2AgcGFyYW1ldGVyIGZvciBhbnkgc3luYyByZXF1ZXN0cy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2V0dXBTeW5jT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBzeW5jIC0gS25vd24gcGFyYW1ldGVycyBvZiB0aGUgc3luYyBvYmplY3QgdG8gYmUgcmV0dXJuZWQ7IG9yIG51bGwuXG4gICAqIEByZXR1cm4ge09iamVjdH0gZmxlc2hlZCBvdXQgc3luYyBvYmplY3RcbiAgICovXG4gIF9zZXR1cFN5bmNPYmplY3Qoc3luYykge1xuICAgIGlmIChzeW5jICE9PSBmYWxzZSkge1xuICAgICAgaWYgKCFzeW5jKSBzeW5jID0ge307XG4gICAgICBpZiAoIXN5bmMudGFyZ2V0KSBzeW5jLnRhcmdldCA9IHRoaXMuaWQ7XG4gICAgfVxuICAgIHJldHVybiBzeW5jO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgd2Vic29ja2V0IGV2ZW50IGhhcyBiZWVuIHJlY2VpdmVkIHNwZWNpZnlpbmcgdGhhdCB0aGlzIHJlc291cmNlXG4gICAqIGhhcyBiZWVuIGRlbGV0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgaGFuZGxlV2Vic29ja2V0RGVsZXRlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtIHtPYmplY3R9IGRhdGFcbiAgICovXG4gIF9oYW5kbGVXZWJzb2NrZXREZWxldGUoZGF0YSkge1xuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgT2JqZWN0IGhhcyBiZWVuIGRlbGV0ZWQuXG4gICAqXG4gICAqIERlc3Ryb3kgbXVzdCBiZSBjYWxsZWQgc2VwYXJhdGVseSwgYW5kIGhhbmRsZXMgbW9zdCBjbGVhbnVwLlxuICAgKlxuICAgKiBAbWV0aG9kIF9kZWxldGVkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIF9kZWxldGVkKCkge1xuICAgIHRoaXMudHJpZ2dlcih0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpkZWxldGUnKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIExvYWQgdGhlIHJlc291cmNlIGlkZW50aWZpZWQgdmlhIGEgTGF5ZXIgSUQuXG4gICAqXG4gICAqIFdpbGwgbG9hZCB0aGUgcmVxdWVzdGVkIHJlc291cmNlIGZyb20gcGVyc2lzdGVuY2Ugb3Igc2VydmVyIGFzIG5lZWRlZCxcbiAgICogYW5kIHRyaWdnZXIgYHR5cGUtbmFtZTpsb2FkZWRgIHdoZW4gaXRzIGxvYWRlZC4gIEluc3RhbmNlIHJldHVybmVkIGJ5IHRoaXNcbiAgICogbWV0aG9kIHdpbGwgaGF2ZSBvbmx5IElEIGFuZCBVUkwgcHJvcGVydGllcywgYWxsIG90aGVycyBhcmUgdW5zZXQgdW50aWxcbiAgICogdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAsIGBtZXNzYWdlczpsb2FkZWRgLCBldGMuLi4gZXZlbnQgaGFzIGZpcmVkLlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIG1lc3NhZ2UgPSBsYXllci5NZXNzYWdlLmxvYWQobWVzc2FnZUlkLCBjbGllbnQpO1xuICAgKiBtZXNzYWdlLm9uY2UoJ21lc3NhZ2VzOmxvYWRlZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBhbGVydChcIk1lc3NhZ2UgbG9hZGVkXCIpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgbG9hZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBpZCAtIGBsYXllcjovLy9tZXNzYWdlcy9VVUlEYFxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLlN5bmNhYmxlfSAtIFJldHVybnMgYW4gZW1wdHkgb2JqZWN0IHRoYXQgd2lsbCBiZSBwb3B1bGF0ZWQgb25jZSBkYXRhIGlzIGxvYWRlZC5cbiAgICovXG4gIHN0YXRpYyBsb2FkKGlkLCBjbGllbnQpIHtcbiAgICBpZiAoIWNsaWVudCB8fCAhKGNsaWVudCBpbnN0YW5jZW9mIFJvb3QpKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgY29uc3Qgb2JqID0ge1xuICAgICAgaWQsXG4gICAgICB1cmw6IGNsaWVudC51cmwgKyBpZC5zdWJzdHJpbmcoOCksXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgIH07XG5cbiAgICBpZiAoIVN5bmNhYmxlLnNvcnRlZFN1YmNsYXNzZXMpIHtcbiAgICAgIFN5bmNhYmxlLnNvcnRlZFN1YmNsYXNzZXMgPSBTeW5jYWJsZS5zdWJjbGFzc2VzLmZpbHRlcihpdGVtID0+IGl0ZW0ucHJlZml4VVVJRClcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEucHJlZml4VVVJRC5sZW5ndGggLSBiLnByZWZpeFVVSUQubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBjb25zdCBDb25zdHJ1Y3RvckNsYXNzID0gU3luY2FibGUuc29ydGVkU3ViY2xhc3Nlcy5maWx0ZXIoKGFDbGFzcykgPT4ge1xuICAgICAgaWYgKGFDbGFzcy5wcmVmaXhVVUlELmluZGV4T2YoJ2xheWVyOi8vLycpID09PSAwKSB7XG4gICAgICAgIHJldHVybiBvYmouaWQuaW5kZXhPZihhQ2xhc3MucHJlZml4VVVJRCkgPT09IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb2JqLmlkLmluZGV4T2YoYUNsYXNzLnByZWZpeFVVSUQpICE9PSAtMTtcbiAgICAgIH1cbiAgICB9KVswXTtcbiAgICBjb25zdCBzeW5jSXRlbSA9IG5ldyBDb25zdHJ1Y3RvckNsYXNzKG9iaik7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBDb25zdHJ1Y3RvckNsYXNzLmV2ZW50UHJlZml4O1xuXG4gICAgaWYgKHR5cGVOYW1lKSB7XG4gICAgICBjbGllbnQuZGJNYW5hZ2VyLmdldE9iamVjdCh0eXBlTmFtZSwgaWQsIChpdGVtKSA9PiB7XG4gICAgICAgIGlmIChzeW5jSXRlbS5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgICAgICBpZiAoaXRlbSkge1xuICAgICAgICAgIHN5bmNJdGVtLl9wb3B1bGF0ZUZyb21TZXJ2ZXIoaXRlbSk7XG4gICAgICAgICAgc3luY0l0ZW0udHJpZ2dlcih0eXBlTmFtZSArICc6bG9hZGVkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3luY0l0ZW0uX2xvYWQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN5bmNJdGVtLl9sb2FkKCk7XG4gICAgfVxuXG4gICAgc3luY0l0ZW0uc3luY1N0YXRlID0gU1lOQ19TVEFURS5MT0FESU5HO1xuICAgIHJldHVybiBzeW5jSXRlbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIHRoaXMgcmVzb3VyY2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgZnJvbSB0aGUgc3RhdGljIGxheWVyLlN5bmNhYmxlLmxvYWQoKSBtZXRob2RcbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2xvYWQoKSB7XG4gICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICB9LCByZXN1bHQgPT4gdGhpcy5fbG9hZFJlc3VsdChyZXN1bHQpKTtcbiAgfVxuXG5cbiAgX2xvYWRSZXN1bHQocmVzdWx0KSB7XG4gICAgY29uc3QgcHJlZml4ID0gdGhpcy5jb25zdHJ1Y3Rvci5ldmVudFByZWZpeDtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICB0aGlzLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTkVXO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKHByZWZpeCArICc6bG9hZGVkLWVycm9yJywgeyBlcnJvcjogcmVzdWx0LmRhdGEgfSk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0sIDEwMCk7IC8vIEluc3VyZSBkZXN0cm95ZWQgQUZURVIgbG9hZGVkLWVycm9yIGV2ZW50IGhhcyB0cmlnZ2VyZWRcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKHJlc3VsdC5kYXRhKTtcbiAgICAgIHRoaXMuX2xvYWRlZChyZXN1bHQuZGF0YSk7XG4gICAgICB0aGlzLnRyaWdnZXIocHJlZml4ICsgJzpsb2FkZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2Vzc2luZyB0aGUgcmVzdWx0IG9mIGEgX2xvYWQoKSBjYWxsLlxuICAgKlxuICAgKiBUeXBpY2FsbHkgdXNlZCB0byByZWdpc3RlciB0aGUgb2JqZWN0IGFuZCBjbGVhbnVwIGFueSBwcm9wZXJ0aWVzIG5vdCBoYW5kbGVkIGJ5IF9wb3B1bGF0ZUZyb21TZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgLSBSZXNwb25zZSBkYXRhIGZyb20gc2VydmVyXG4gICAqL1xuICBfbG9hZGVkKGRhdGEpIHtcblxuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBuZXcsIGFuZCBpcyBxdWV1ZWQgZm9yIHN5bmNpbmcsIGJ1dCBkb2VzIG5vdCB5ZXQgZXhpc3Qgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogVGhhdCBtZWFucyBpdCBpcyBjdXJyZW50bHkgb3V0IG9mIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXRTeW5jaW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc2V0U3luY2luZygpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN3aXRjaCAodGhpcy5zeW5jU3RhdGUpIHtcbiAgICAgIGNhc2UgU1lOQ19TVEFURS5TWU5DRUQ6XG4gICAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5TWU5DSU5HO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU1lOQ19TVEFURS5ORVc6XG4gICAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5TQVZJTkc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICB0aGlzLl9zeW5jQ291bnRlcisrO1xuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIGFuZCB1cCB0byBkYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXRTeW5jZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZXRTeW5jZWQoKSB7XG4gICAgdGhpcy5fY2xlYXJPYmplY3QoKTtcbiAgICBpZiAodGhpcy5fc3luY0NvdW50ZXIgPiAwKSB0aGlzLl9zeW5jQ291bnRlci0tO1xuXG4gICAgdGhpcy5zeW5jU3RhdGUgPSB0aGlzLl9zeW5jQ291bnRlciA9PT0gMCA/IFNZTkNfU1RBVEUuU1lOQ0VEIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgU1lOQ19TVEFURS5TWU5DSU5HO1xuICAgIHRoaXMuaXNTZW5kaW5nID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQW55IHRpbWUgdGhlIGluc3RhbmNlIGNoYW5nZXMsIHdlIHNob3VsZCBjbGVhciB0aGUgY2FjaGVkIHRvT2JqZWN0IHZhbHVlXG4gICAqXG4gICAqIEBtZXRob2QgX2NsZWFyT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJPYmplY3QoKSB7XG4gICAgdGhpcy5fdG9PYmplY3QgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwbGFpbiBvYmplY3QuXG4gICAqXG4gICAqIE9iamVjdCB3aWxsIGhhdmUgYWxsIHRoZSBzYW1lIHB1YmxpYyBwcm9wZXJ0aWVzIGFzIHRoaXNcbiAgICogU3luY2FibGUgaW5zdGFuY2UuICBOZXcgb2JqZWN0IGlzIHJldHVybmVkIGFueSB0aW1lXG4gICAqIGFueSBvZiB0aGlzIG9iamVjdCdzIHByb3BlcnRpZXMgY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gUE9KTyB2ZXJzaW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgKi9cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNOZXcgPSB0aGlzLmlzTmV3KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5pc1NhdmluZyA9IHRoaXMuaXNTYXZpbmcoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU2F2ZWQgPSB0aGlzLmlzU2F2ZWQoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU3luY2VkID0gdGhpcy5pc1N5bmNlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdG9PYmplY3Q7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIG5vdCB5ZXQgcXVldWVkIGZvciBzeW5jaW5nXG4gICAqXG4gICAqIEBtZXRob2QgaXNOZXdcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqL1xuICBpc05ldygpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXO1xuICB9XG5cbiAgLyoqXG4gICAqIE9iamVjdCBpcyBuZXcsIGFuZCBpcyBxdWV1ZWQgZm9yIHN5bmNpbmdcbiAgICpcbiAgICogQG1ldGhvZCBpc1NhdmluZ1xuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU2F2aW5nKCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkc7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGV4aXN0cyBvbiBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgaXNTYXZlZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU2F2ZWQoKSB7XG4gICAgcmV0dXJuICEodGhpcy5pc05ldygpIHx8IHRoaXMuaXNTYXZpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIGZ1bGx5IHN5bmNlZC5cbiAgICpcbiAgICogQXMgYmVzdCB3ZSBrbm93LCBzZXJ2ZXIgYW5kIGNsaWVudCBoYXZlIHRoZSBzYW1lIHZhbHVlcy5cbiAgICpcbiAgICogQG1ldGhvZCBpc1N5bmNlZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzU3luY2VkKCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TWU5DRUQ7XG4gIH1cbn1cblxuLyoqXG4gKiBVbmlxdWUgaWRlbnRpZmllci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuaWQgPSAnJztcblxuLyoqXG4gKiBVUkwgdG8gYWNjZXNzIHRoZSBvYmplY3Qgb24gdGhlIHNlcnZlci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKiBAcHJvdGVjdGVkXG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBUaGUgdGltZSB0aGF0IHRoaXMgY2xpZW50IGNyZWF0ZWQgdGhpcyBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIHZhbHVlIGlzIG5vdCB0aWVkIHRvIHdoZW4gaXQgd2FzIGZpcnN0IGNyZWF0ZWQgb24gdGhlIHNlcnZlci4gIENyZWF0aW5nIGEgbmV3IGluc3RhbmNlXG4gKiBiYXNlZCBvbiBzZXJ2ZXIgZGF0YSB3aWxsIHJlc3VsdCBpbiBhIG5ldyBgbG9jYWxDcmVhdGVBdGAgdmFsdWUuXG4gKlxuICogQHR5cGUge0RhdGV9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5sb2NhbENyZWF0ZWRBdCA9IG51bGw7XG5cblxuLyoqXG4gKiBsYXllci5DbGllbnQgdGhhdCB0aGUgb2JqZWN0IGJlbG9uZ3MgdG8uXG4gKlxuICogQWN0dWFsIHZhbHVlIG9mIHRoaXMgc3RyaW5nIG1hdGNoZXMgdGhlIGFwcElkLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBwcm90ZWN0ZWRcbiAqIEByZWFkb25seVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBUZW1wb3JhcnkgcHJvcGVydHkgaW5kaWNhdGluZyB0aGF0IHRoZSBpbnN0YW5jZSB3YXMgbG9hZGVkIGZyb20gbG9jYWwgZGF0YWJhc2UgcmF0aGVyIHRoYW4gc2VydmVyLlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuU3luY2FibGUucHJvdG90eXBlLl9mcm9tREIgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgY3VycmVudCBzeW5jIHN0YXRlIG9mIHRoaXMgb2JqZWN0LlxuICpcbiAqIFBvc3NpYmxlIHZhbHVlcyBhcmU6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXOiBOZXdseSBjcmVhdGVkOyBsb2NhbCBvbmx5LlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU0FWSU5HOiBOZXdseSBjcmVhdGVkOyBiZWluZyBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNJTkc6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyLCBidXQgY2hhbmdlcyBhcmUgYmVpbmcgc2VudCB0byBzZXJ2ZXIuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TWU5DRUQ6IEV4aXN0cyBvbiBib3RoIGNsaWVudCBhbmQgc2VydmVyIGFuZCBpcyBzeW5jZWQuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HOiBFeGlzdHMgb24gc2VydmVyOyBsb2FkaW5nIGl0IGludG8gY2xpZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLk5FVztcblxuLyoqXG4gKiBOdW1iZXIgb2Ygc3luYyByZXF1ZXN0cyB0aGF0IGhhdmUgYmVlbiByZXF1ZXN0ZWQuXG4gKlxuICogQ291bnRzIGRvd24gdG8gemVybzsgb25jZSBpdCByZWFjaGVzIHplcm8sIGFsbCBzeW5jXG4gKiByZXF1ZXN0cyBoYXZlIGJlZW4gY29tcGxldGVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuX3N5bmNDb3VudGVyID0gMDtcblxuLyoqXG4gKiBQcmVmaXggdG8gdXNlIHdoZW4gdHJpZ2dlcmluZyBldmVudHNcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKi9cblN5bmNhYmxlLmV2ZW50UHJlZml4ID0gJyc7XG5cblN5bmNhYmxlLmVuYWJsZU9wc0lmTmV3ID0gZmFsc2U7XG5cbi8qKlxuICogSXMgdGhlIG9iamVjdCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlcj9cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN5bmNhYmxlLnByb3RvdHlwZSwgJ2lzTG9hZGluZycsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBBcnJheSBvZiBjbGFzc2VzIHRoYXQgYXJlIHN1YmNsYXNzZXMgb2YgU3luY2FibGUuXG4gKlxuICogVXNlZCBieSBGYWN0b3J5IGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuU3luY2FibGUuc3ViY2xhc3NlcyA9IFtdO1xuXG5TeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzID0gW10uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5TeW5jYWJsZS5pbk9iamVjdElnbm9yZSA9IFJvb3QuaW5PYmplY3RJZ25vcmU7XG5tb2R1bGUuZXhwb3J0cyA9IFN5bmNhYmxlO1xuIl19
