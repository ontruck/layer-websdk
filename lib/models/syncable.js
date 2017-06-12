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

      if (this.isDestroyed) return;
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
        if (!client.dbManager) {
          syncItem.syncState = SYNC_STATE.LOADING;
          client.once('ready', function () {
            return syncItem._load();
          });
        } else {
          client.dbManager.getObject(typeName, id, function (item) {
            if (syncItem.isDestroyed) return;
            if (item) {
              syncItem._populateFromServer(item);
              syncItem.trigger(typeName + ':loaded');
            } else if (!client.isReady) {
              syncItem.syncState = SYNC_STATE.LOADING;
              client.once('ready', function () {
                return syncItem._load();
              });
            } else {
              syncItem._load();
            }
          });
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvc3luY2FibGUuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJTWU5DX1NUQVRFIiwiTGF5ZXJFcnJvciIsIkNsaWVudFJlZ2lzdHJ5IiwiQ29uc3RhbnRzIiwiU3luY2FibGUiLCJvcHRpb25zIiwibG9jYWxDcmVhdGVkQXQiLCJEYXRlIiwiZ2V0IiwiY2xpZW50SWQiLCJjYWxsYmFjayIsInVybCIsIm1ldGhvZCIsImNsaWVudCIsImdldENsaWVudCIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsImNvbnN0cnVjdG9yIiwiZW5hYmxlT3BzSWZOZXciLCJzeW5jU3RhdGUiLCJORVciLCJtYXRjaCIsInN5bmMiLCJfc2V0dXBTeW5jT2JqZWN0IiwiX3NldFN5bmNpbmciLCJ4aHIiLCJyZXN1bHQiLCJzdWNjZXNzIiwiX3NldFN5bmNlZCIsInRhcmdldCIsImlkIiwiZGF0YSIsIl9kZWxldGVkIiwiZGVzdHJveSIsInRyaWdnZXIiLCJldmVudFByZWZpeCIsIkxPQURJTkciLCJfeGhyIiwiX2xvYWRSZXN1bHQiLCJwcmVmaXgiLCJfdHJpZ2dlckFzeW5jIiwiZXJyb3IiLCJzZXRUaW1lb3V0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsIl9sb2FkZWQiLCJfY2xlYXJPYmplY3QiLCJTWU5DRUQiLCJTWU5DSU5HIiwiU0FWSU5HIiwiX3N5bmNDb3VudGVyIiwiaXNTZW5kaW5nIiwiX3RvT2JqZWN0IiwiaXNOZXciLCJpc1NhdmluZyIsImlzU2F2ZWQiLCJpc1N5bmNlZCIsIm9iaiIsInN1YnN0cmluZyIsImFwcElkIiwic29ydGVkU3ViY2xhc3NlcyIsInN1YmNsYXNzZXMiLCJmaWx0ZXIiLCJpdGVtIiwicHJlZml4VVVJRCIsInNvcnQiLCJhIiwiYiIsImxlbmd0aCIsIkNvbnN0cnVjdG9yQ2xhc3MiLCJhQ2xhc3MiLCJpbmRleE9mIiwic3luY0l0ZW0iLCJ0eXBlTmFtZSIsImRiTWFuYWdlciIsIm9uY2UiLCJfbG9hZCIsImdldE9iamVjdCIsImlzUmVhZHkiLCJwcm90b3R5cGUiLCJfZnJvbURCIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluT2JqZWN0SWdub3JlIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7O2VBQ3VCQSxRQUFRLFVBQVIsQztJQUFmQyxVLFlBQUFBLFU7O0FBQ1IsSUFBTUMsYUFBYUYsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1HLGlCQUFpQkgsUUFBUSxvQkFBUixDQUF2QjtBQUNBLElBQU1JLFlBQVlKLFFBQVEsVUFBUixDQUFsQjs7SUFFTUssUTs7O0FBQ0osc0JBQTBCO0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUFBLG9IQUNsQkEsT0FEa0I7O0FBRXhCLFVBQUtDLGNBQUwsR0FBc0IsSUFBSUMsSUFBSixFQUF0QjtBQUZ3QjtBQUd6Qjs7QUFFRDs7Ozs7Ozs7OztnQ0FNWTtBQUNWLGFBQU9MLGVBQWVNLEdBQWYsQ0FBbUIsS0FBS0MsUUFBeEIsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7eUJBU0tKLE8sRUFBU0ssUSxFQUFVO0FBQUE7O0FBQ3RCO0FBQ0EsVUFBSSxDQUFDTCxRQUFRTSxHQUFiLEVBQWtCTixRQUFRTSxHQUFSLEdBQWMsRUFBZDtBQUNsQixVQUFJLENBQUNOLFFBQVFPLE1BQWIsRUFBcUJQLFFBQVFPLE1BQVIsR0FBaUIsS0FBakI7QUFDckIsVUFBTUMsU0FBUyxLQUFLQyxTQUFMLEVBQWY7O0FBRUE7QUFDQSxVQUFJLEtBQUtDLFdBQVQsRUFBc0IsTUFBTSxJQUFJQyxLQUFKLENBQVVmLFdBQVdnQixVQUFYLENBQXNCRixXQUFoQyxDQUFOO0FBQ3RCLFVBQUksQ0FBQ0YsTUFBTCxFQUFh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QnpGLEtBQUt5RixjQUEvQjtBQUNBQyxPQUFPQyxPQUFQLEdBQWlCckYsUUFBakIiLCJmaWxlIjoic3luY2FibGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBTeW5jYWJsZSBhYnN0cmFjdCBjbGFzIHJlcHJlc2VudHMgcmVzb3VyY2VzIHRoYXQgYXJlIHN5bmNhYmxlIHdpdGggdGhlIHNlcnZlci5cbiAqIFRoaXMgaXMgY3VycmVudGx5IHVzZWQgZm9yIE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb25zLlxuICogSXQgcmVwcmVzZW50cyB0aGUgc3RhdGUgb2YgdGhlIG9iamVjdCdzIHN5bmMsIGFzIG9uZSBvZjpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5ORVc6IE5ld2x5IGNyZWF0ZWQ7IGxvY2FsIG9ubHkuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TQVZJTkc6IE5ld2x5IGNyZWF0ZWQ7IGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlclxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU1lOQ0lORzogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIsIGJ1dCBjaGFuZ2VzIGFyZSBiZWluZyBzZW50IHRvIHNlcnZlci5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNFRDogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIgYW5kIGlzIHN5bmNlZC5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLkxPQURJTkc6IEV4aXN0cyBvbiBzZXJ2ZXI7IGxvYWRpbmcgaXQgaW50byBjbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLlN5bmNhYmxlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYWJzdHJhY3RcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgeyBTWU5DX1NUQVRFIH0gPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4uL2NsaWVudC1yZWdpc3RyeScpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcblxuY2xhc3MgU3luY2FibGUgZXh0ZW5kcyBSb290IHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5sb2NhbENyZWF0ZWRBdCA9IG5ldyBEYXRlKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjbGllbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgT2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIGdldENsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBnZXRDbGllbnQoKSB7XG4gICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldCh0aGlzLmNsaWVudElkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaXJlIGFuIFhIUiByZXF1ZXN0IHVzaW5nIHRoZSBVUkwgZm9yIHRoaXMgcmVzb3VyY2UuXG4gICAqXG4gICAqIEZvciBtb3JlIGluZm8gb24geGhyIG1ldGhvZCBwYXJhbWV0ZXJzIHNlZSB7QGxpbmsgbGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvciN4aHJ9XG4gICAqXG4gICAqIEBtZXRob2QgX3hoclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEByZXR1cm4ge2xheWVyLlN5bmNhYmxlfSB0aGlzXG4gICAqL1xuICBfeGhyKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gaW5pdGlhbGl6ZVxuICAgIGlmICghb3B0aW9ucy51cmwpIG9wdGlvbnMudXJsID0gJyc7XG4gICAgaWYgKCFvcHRpb25zLm1ldGhvZCkgb3B0aW9ucy5tZXRob2QgPSAnR0VUJztcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gVmFsaWRhdGF0aW9uXG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgIGlmICghY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIGlmICghdGhpcy5jb25zdHJ1Y3Rvci5lbmFibGVPcHNJZk5ldyAmJlxuICAgICAgb3B0aW9ucy5tZXRob2QgIT09ICdQT1NUJyAmJiBvcHRpb25zLm1ldGhvZCAhPT0gJ0dFVCcgJiZcbiAgICAgIHRoaXMuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKCFvcHRpb25zLnVybC5tYXRjaCgvXmh0dHAocyk6XFwvXFwvLykpIHtcbiAgICAgIGlmIChvcHRpb25zLnVybCAmJiAhb3B0aW9ucy51cmwubWF0Y2goL14oXFwvfFxcPykvKSkgb3B0aW9ucy51cmwgPSAnLycgKyBvcHRpb25zLnVybDtcbiAgICAgIGlmICghb3B0aW9ucy5zeW5jKSBvcHRpb25zLnVybCA9IHRoaXMudXJsICsgb3B0aW9ucy51cmw7XG4gICAgfVxuXG4gICAgLy8gU2V0dXAgc3luYyBzdHJ1Y3R1cmVcbiAgICBvcHRpb25zLnN5bmMgPSB0aGlzLl9zZXR1cFN5bmNPYmplY3Qob3B0aW9ucy5zeW5jKTtcblxuICAgIGlmIChvcHRpb25zLm1ldGhvZCAhPT0gJ0dFVCcpIHtcbiAgICAgIHRoaXMuX3NldFN5bmNpbmcoKTtcbiAgICB9XG5cbiAgICBjbGllbnQueGhyKG9wdGlvbnMsIChyZXN1bHQpID0+IHtcbiAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiBvcHRpb25zLm1ldGhvZCAhPT0gJ0dFVCcgJiYgIXRoaXMuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgdGhpcy5fc2V0U3luY2VkKCk7XG4gICAgICB9XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0dXAgYW4gb2JqZWN0IHRvIHBhc3MgaW4gdGhlIGBzeW5jYCBwYXJhbWV0ZXIgZm9yIGFueSBzeW5jIHJlcXVlc3RzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXR1cFN5bmNPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IHN5bmMgLSBLbm93biBwYXJhbWV0ZXJzIG9mIHRoZSBzeW5jIG9iamVjdCB0byBiZSByZXR1cm5lZDsgb3IgbnVsbC5cbiAgICogQHJldHVybiB7T2JqZWN0fSBmbGVzaGVkIG91dCBzeW5jIG9iamVjdFxuICAgKi9cbiAgX3NldHVwU3luY09iamVjdChzeW5jKSB7XG4gICAgaWYgKHN5bmMgIT09IGZhbHNlKSB7XG4gICAgICBpZiAoIXN5bmMpIHN5bmMgPSB7fTtcbiAgICAgIGlmICghc3luYy50YXJnZXQpIHN5bmMudGFyZ2V0ID0gdGhpcy5pZDtcbiAgICB9XG4gICAgcmV0dXJuIHN5bmM7XG4gIH1cblxuICAvKipcbiAgICogQSB3ZWJzb2NrZXQgZXZlbnQgaGFzIGJlZW4gcmVjZWl2ZWQgc3BlY2lmeWluZyB0aGF0IHRoaXMgcmVzb3VyY2VcbiAgICogaGFzIGJlZW4gZGVsZXRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBoYW5kbGVXZWJzb2NrZXREZWxldGVcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxuICAgKi9cbiAgX2hhbmRsZVdlYnNvY2tldERlbGV0ZShkYXRhKSB7XG4gICAgdGhpcy5fZGVsZXRlZCgpO1xuICAgIHRoaXMuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBPYmplY3QgaGFzIGJlZW4gZGVsZXRlZC5cbiAgICpcbiAgICogRGVzdHJveSBtdXN0IGJlIGNhbGxlZCBzZXBhcmF0ZWx5LCBhbmQgaGFuZGxlcyBtb3N0IGNsZWFudXAuXG4gICAqXG4gICAqIEBtZXRob2QgX2RlbGV0ZWRcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgX2RlbGV0ZWQoKSB7XG4gICAgdGhpcy50cmlnZ2VyKHRoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXggKyAnOmRlbGV0ZScpO1xuICB9XG5cblxuICAvKipcbiAgICogTG9hZCB0aGUgcmVzb3VyY2UgaWRlbnRpZmllZCB2aWEgYSBMYXllciBJRC5cbiAgICpcbiAgICogV2lsbCBsb2FkIHRoZSByZXF1ZXN0ZWQgcmVzb3VyY2UgZnJvbSBwZXJzaXN0ZW5jZSBvciBzZXJ2ZXIgYXMgbmVlZGVkLFxuICAgKiBhbmQgdHJpZ2dlciBgdHlwZS1uYW1lOmxvYWRlZGAgd2hlbiBpdHMgbG9hZGVkLiAgSW5zdGFuY2UgcmV0dXJuZWQgYnkgdGhpc1xuICAgKiBtZXRob2Qgd2lsbCBoYXZlIG9ubHkgSUQgYW5kIFVSTCBwcm9wZXJ0aWVzLCBhbGwgb3RoZXJzIGFyZSB1bnNldCB1bnRpbFxuICAgKiB0aGUgYGNvbnZlcnNhdGlvbnM6bG9hZGVkYCwgYG1lc3NhZ2VzOmxvYWRlZGAsIGV0Yy4uLiBldmVudCBoYXMgZmlyZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgbWVzc2FnZSA9IGxheWVyLk1lc3NhZ2UubG9hZChtZXNzYWdlSWQsIGNsaWVudCk7XG4gICAqIG1lc3NhZ2Uub25jZSgnbWVzc2FnZXM6bG9hZGVkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIGFsZXJ0KFwiTWVzc2FnZSBsb2FkZWRcIik7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBsb2FkXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkIC0gYGxheWVyOi8vL21lc3NhZ2VzL1VVSURgXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuU3luY2FibGV9IC0gUmV0dXJucyBhbiBlbXB0eSBvYmplY3QgdGhhdCB3aWxsIGJlIHBvcHVsYXRlZCBvbmNlIGRhdGEgaXMgbG9hZGVkLlxuICAgKi9cbiAgc3RhdGljIGxvYWQoaWQsIGNsaWVudCkge1xuICAgIGlmICghY2xpZW50IHx8ICEoY2xpZW50IGluc3RhbmNlb2YgUm9vdCkpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG5cbiAgICBjb25zdCBvYmogPSB7XG4gICAgICBpZCxcbiAgICAgIHVybDogY2xpZW50LnVybCArIGlkLnN1YnN0cmluZyg4KSxcbiAgICAgIGNsaWVudElkOiBjbGllbnQuYXBwSWQsXG4gICAgfTtcblxuICAgIGlmICghU3luY2FibGUuc29ydGVkU3ViY2xhc3Nlcykge1xuICAgICAgU3luY2FibGUuc29ydGVkU3ViY2xhc3NlcyA9IFN5bmNhYmxlLnN1YmNsYXNzZXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5wcmVmaXhVVUlEKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5wcmVmaXhVVUlELmxlbmd0aCAtIGIucHJlZml4VVVJRC5sZW5ndGgpO1xuICAgIH1cblxuICAgIGNvbnN0IENvbnN0cnVjdG9yQ2xhc3MgPSBTeW5jYWJsZS5zb3J0ZWRTdWJjbGFzc2VzLmZpbHRlcigoYUNsYXNzKSA9PiB7XG4gICAgICBpZiAoYUNsYXNzLnByZWZpeFVVSUQuaW5kZXhPZignbGF5ZXI6Ly8vJykgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIG9iai5pZC5pbmRleE9mKGFDbGFzcy5wcmVmaXhVVUlEKSA9PT0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBvYmouaWQuaW5kZXhPZihhQ2xhc3MucHJlZml4VVVJRCkgIT09IC0xO1xuICAgICAgfVxuICAgIH0pWzBdO1xuICAgIGNvbnN0IHN5bmNJdGVtID0gbmV3IENvbnN0cnVjdG9yQ2xhc3Mob2JqKTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IENvbnN0cnVjdG9yQ2xhc3MuZXZlbnRQcmVmaXg7XG5cbiAgICBpZiAodHlwZU5hbWUpIHtcbiAgICAgIGlmICghY2xpZW50LmRiTWFuYWdlcikge1xuICAgICAgICBzeW5jSXRlbS5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gICAgICAgIGNsaWVudC5vbmNlKCdyZWFkeScsICgpID0+IHN5bmNJdGVtLl9sb2FkKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xpZW50LmRiTWFuYWdlci5nZXRPYmplY3QodHlwZU5hbWUsIGlkLCAoaXRlbSkgPT4ge1xuICAgICAgICAgIGlmIChzeW5jSXRlbS5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgICAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgICAgICBzeW5jSXRlbS5fcG9wdWxhdGVGcm9tU2VydmVyKGl0ZW0pO1xuICAgICAgICAgICAgc3luY0l0ZW0udHJpZ2dlcih0eXBlTmFtZSArICc6bG9hZGVkJyk7XG4gICAgICAgICAgfSBlbHNlIGlmICghY2xpZW50LmlzUmVhZHkpIHtcbiAgICAgICAgICAgIHN5bmNJdGVtLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTE9BRElORztcbiAgICAgICAgICAgIGNsaWVudC5vbmNlKCdyZWFkeScsICgpID0+IHN5bmNJdGVtLl9sb2FkKCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzeW5jSXRlbS5fbG9hZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN5bmNJdGVtLl9sb2FkKCk7XG4gICAgfVxuXG4gICAgc3luY0l0ZW0uc3luY1N0YXRlID0gU1lOQ19TVEFURS5MT0FESU5HO1xuICAgIHJldHVybiBzeW5jSXRlbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIHRoaXMgcmVzb3VyY2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgZnJvbSB0aGUgc3RhdGljIGxheWVyLlN5bmNhYmxlLmxvYWQoKSBtZXRob2RcbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2xvYWQoKSB7XG4gICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICB9LCByZXN1bHQgPT4gdGhpcy5fbG9hZFJlc3VsdChyZXN1bHQpKTtcbiAgfVxuXG5cbiAgX2xvYWRSZXN1bHQocmVzdWx0KSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICBjb25zdCBwcmVmaXggPSB0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4O1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5ORVc7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMocHJlZml4ICsgJzpsb2FkZWQtZXJyb3InLCB7IGVycm9yOiByZXN1bHQuZGF0YSB9KTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuaXNEZXN0cm95ZWQpIHRoaXMuZGVzdHJveSgpO1xuICAgICAgfSwgMTAwKTsgLy8gSW5zdXJlIGRlc3Ryb3llZCBBRlRFUiBsb2FkZWQtZXJyb3IgZXZlbnQgaGFzIHRyaWdnZXJlZFxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIocmVzdWx0LmRhdGEpO1xuICAgICAgdGhpcy5fbG9hZGVkKHJlc3VsdC5kYXRhKTtcbiAgICAgIHRoaXMudHJpZ2dlcihwcmVmaXggKyAnOmxvYWRlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzaW5nIHRoZSByZXN1bHQgb2YgYSBfbG9hZCgpIGNhbGwuXG4gICAqXG4gICAqIFR5cGljYWxseSB1c2VkIHRvIHJlZ2lzdGVyIHRoZSBvYmplY3QgYW5kIGNsZWFudXAgYW55IHByb3BlcnRpZXMgbm90IGhhbmRsZWQgYnkgX3BvcHVsYXRlRnJvbVNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZGVkXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSAtIFJlc3BvbnNlIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICovXG4gIF9sb2FkZWQoZGF0YSkge1xuXG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIHF1ZXVlZCBmb3Igc3luY2luZywgYnV0IGRvZXMgbm90IHlldCBleGlzdCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGF0IG1lYW5zIGl0IGlzIGN1cnJlbnRseSBvdXQgb2Ygc3luYyB3aXRoIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldFN5bmNpbmdcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZXRTeW5jaW5nKCkge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3dpdGNoICh0aGlzLnN5bmNTdGF0ZSkge1xuICAgICAgY2FzZSBTWU5DX1NUQVRFLlNZTkNFRDpcbiAgICAgICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLlNZTkNJTkc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTWU5DX1NUQVRFLk5FVzpcbiAgICAgICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLlNBVklORztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuX3N5bmNDb3VudGVyKys7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIHN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgYW5kIHVwIHRvIGRhdGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldFN5bmNlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NldFN5bmNlZCgpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIGlmICh0aGlzLl9zeW5jQ291bnRlciA+IDApIHRoaXMuX3N5bmNDb3VudGVyLS07XG5cbiAgICB0aGlzLnN5bmNTdGF0ZSA9IHRoaXMuX3N5bmNDb3VudGVyID09PSAwID8gU1lOQ19TVEFURS5TWU5DRUQgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTWU5DX1NUQVRFLlNZTkNJTkc7XG4gICAgdGhpcy5pc1NlbmRpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbnkgdGltZSB0aGUgaW5zdGFuY2UgY2hhbmdlcywgd2Ugc2hvdWxkIGNsZWFyIHRoZSBjYWNoZWQgdG9PYmplY3QgdmFsdWVcbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYXJPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jbGVhck9iamVjdCgpIHtcbiAgICB0aGlzLl90b09iamVjdCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHBsYWluIG9iamVjdC5cbiAgICpcbiAgICogT2JqZWN0IHdpbGwgaGF2ZSBhbGwgdGhlIHNhbWUgcHVibGljIHByb3BlcnRpZXMgYXMgdGhpc1xuICAgKiBTeW5jYWJsZSBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcyBvYmplY3QuXG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICBpZiAoIXRoaXMuX3RvT2JqZWN0KSB7XG4gICAgICB0aGlzLl90b09iamVjdCA9IHN1cGVyLnRvT2JqZWN0KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5pc05ldyA9IHRoaXMuaXNOZXcoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU2F2aW5nID0gdGhpcy5pc1NhdmluZygpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNTYXZlZCA9IHRoaXMuaXNTYXZlZCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNTeW5jZWQgPSB0aGlzLmlzU3luY2VkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgaXMgbmV3LCBhbmQgaXMgbm90IHlldCBxdWV1ZWQgZm9yIHN5bmNpbmdcbiAgICpcbiAgICogQG1ldGhvZCBpc05ld1xuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzTmV3KCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5ORVc7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIHF1ZXVlZCBmb3Igc3luY2luZ1xuICAgKlxuICAgKiBAbWV0aG9kIGlzU2F2aW5nXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTYXZpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORztcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgZXhpc3RzIG9uIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBpc1NhdmVkXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTYXZlZCgpIHtcbiAgICByZXR1cm4gISh0aGlzLmlzTmV3KCkgfHwgdGhpcy5pc1NhdmluZygpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgaXMgZnVsbHkgc3luY2VkLlxuICAgKlxuICAgKiBBcyBiZXN0IHdlIGtub3csIHNlcnZlciBhbmQgY2xpZW50IGhhdmUgdGhlIHNhbWUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzU3luY2VkXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTeW5jZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNZTkNFRDtcbiAgfVxufVxuXG4vKipcbiAqIFVuaXF1ZSBpZGVudGlmaWVyLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5pZCA9ICcnO1xuXG4vKipcbiAqIFVSTCB0byBhY2Nlc3MgdGhlIG9iamVjdCBvbiB0aGUgc2VydmVyLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqIEBwcm90ZWN0ZWRcbiAqL1xuU3luY2FibGUucHJvdG90eXBlLnVybCA9ICcnO1xuXG4vKipcbiAqIFRoZSB0aW1lIHRoYXQgdGhpcyBjbGllbnQgY3JlYXRlZCB0aGlzIGluc3RhbmNlLlxuICpcbiAqIFRoaXMgdmFsdWUgaXMgbm90IHRpZWQgdG8gd2hlbiBpdCB3YXMgZmlyc3QgY3JlYXRlZCBvbiB0aGUgc2VydmVyLiAgQ3JlYXRpbmcgYSBuZXcgaW5zdGFuY2VcbiAqIGJhc2VkIG9uIHNlcnZlciBkYXRhIHdpbGwgcmVzdWx0IGluIGEgbmV3IGBsb2NhbENyZWF0ZUF0YCB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7RGF0ZX1cbiAqL1xuU3luY2FibGUucHJvdG90eXBlLmxvY2FsQ3JlYXRlZEF0ID0gbnVsbDtcblxuXG4vKipcbiAqIGxheWVyLkNsaWVudCB0aGF0IHRoZSBvYmplY3QgYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHByb3RlY3RlZFxuICogQHJlYWRvbmx5XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5jbGllbnRJZCA9ICcnO1xuXG4vKipcbiAqIFRlbXBvcmFyeSBwcm9wZXJ0eSBpbmRpY2F0aW5nIHRoYXQgdGhlIGluc3RhbmNlIHdhcyBsb2FkZWQgZnJvbSBsb2NhbCBkYXRhYmFzZSByYXRoZXIgdGhhbiBzZXJ2ZXIuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuX2Zyb21EQiA9IGZhbHNlO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50IHN5bmMgc3RhdGUgb2YgdGhpcyBvYmplY3QuXG4gKlxuICogUG9zc2libGUgdmFsdWVzIGFyZTpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5ORVc6IE5ld2x5IGNyZWF0ZWQ7IGxvY2FsIG9ubHkuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TQVZJTkc6IE5ld2x5IGNyZWF0ZWQ7IGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlclxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU1lOQ0lORzogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIsIGJ1dCBjaGFuZ2VzIGFyZSBiZWluZyBzZW50IHRvIHNlcnZlci5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNFRDogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIgYW5kIGlzIHN5bmNlZC5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLkxPQURJTkc6IEV4aXN0cyBvbiBzZXJ2ZXI7IGxvYWRpbmcgaXQgaW50byBjbGllbnQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuU3luY2FibGUucHJvdG90eXBlLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTkVXO1xuXG4vKipcbiAqIE51bWJlciBvZiBzeW5jIHJlcXVlc3RzIHRoYXQgaGF2ZSBiZWVuIHJlcXVlc3RlZC5cbiAqXG4gKiBDb3VudHMgZG93biB0byB6ZXJvOyBvbmNlIGl0IHJlYWNoZXMgemVybywgYWxsIHN5bmNcbiAqIHJlcXVlc3RzIGhhdmUgYmVlbiBjb21wbGV0ZWQuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEBwcml2YXRlXG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5fc3luY0NvdW50ZXIgPSAwO1xuXG4vKipcbiAqIFByZWZpeCB0byB1c2Ugd2hlbiB0cmlnZ2VyaW5nIGV2ZW50c1xuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqL1xuU3luY2FibGUuZXZlbnRQcmVmaXggPSAnJztcblxuU3luY2FibGUuZW5hYmxlT3BzSWZOZXcgPSBmYWxzZTtcblxuLyoqXG4gKiBJcyB0aGUgb2JqZWN0IGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyP1xuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU3luY2FibGUucHJvdG90eXBlLCAnaXNMb2FkaW5nJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTE9BRElORztcbiAgfSxcbn0pO1xuXG4vKipcbiAqIEFycmF5IG9mIGNsYXNzZXMgdGhhdCBhcmUgc3ViY2xhc3NlcyBvZiBTeW5jYWJsZS5cbiAqXG4gKiBVc2VkIGJ5IEZhY3RvcnkgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5zdWJjbGFzc2VzID0gW107XG5cblN5bmNhYmxlLl9zdXBwb3J0ZWRFdmVudHMgPSBbXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblN5bmNhYmxlLmluT2JqZWN0SWdub3JlID0gUm9vdC5pbk9iamVjdElnbm9yZTtcbm1vZHVsZS5leHBvcnRzID0gU3luY2FibGU7XG4iXX0=
