'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Identity class represents an Identity of a user of your application.
 *
 * Identities are created by the System, never directly by apps.
 *
 * @class layer.Identity
 * @extends layer.Syncable
 */

/*
 * How Identities fit into the system:
 *
 * 1. As part of initialization, load the authenticated user's full Identity record so that the Client knows more than just the `userId` of its user.
 *    client.user = <Identity>
 * 2. Any time we get a Basic Identity via `message.sender` or Conversations, see if we have an Identity for that sender,
 *    and if not create one using the Basic Identity.  There should never be a duplicate Identity.
 * 3. Websocket CHANGE events will update Identity objects, as well as add new Full Identities, and downgrade Full Identities to Basic Identities.
 * 4. The Query API supports querying and paging through Identities
 * 5. The Query API loads Full Identities; these results will update the client._models.identities;
 *    upgrading Basic Identities if they match, and adding new Identities if they don't.
 * 6. DbManager will persist only UserIdentities, and only those that are Full Identities.  Basic Identities will be written
 *    to the Messages and Conversations tables anyways as part of those larger objects.
 * 7. API For explicit follows/unfollows
 */

var Syncable = require('./syncable');
var Root = require('../root');

var _require = require('../const'),
    SYNC_STATE = _require.SYNC_STATE;

var LayerError = require('../layer-error');

var Identity = function (_Syncable) {
  _inherits(Identity, _Syncable);

  function Identity() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Identity);

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) {
      options.id = options.fromServer.id || '-';
    } else if (!options.id && options.userId) {
      options.id = Identity.prefixUUID + encodeURIComponent(options.userId);
    } else if (options.id && !options.userId) {
      options.userId = options.id.substring(Identity.prefixUUID.length);
    }

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error(LayerError.dictionary.clientMissing);

    // The - is here to prevent Root from generating a UUID for an ID.  ID must map to UserID
    // and can't be randomly generated.  This only occurs from Platform API sending with `sender.name` and no identity.
    var _this = _possibleConstructorReturn(this, (Identity.__proto__ || Object.getPrototypeOf(Identity)).call(this, options));

    if (_this.id === '-') _this.id = '';

    _this.isInitializing = true;

    if (!_this._presence) {
      _this._presence = {
        status: null,
        lastSeenAt: null
      };
    }

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Identity
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    if (!_this.url && _this.id) {
      _this.url = _this.getClient().url + '/' + _this.id.substring(9);
    } else if (!_this.url) {
      _this.url = '';
    }
    _this.getClient()._addIdentity(_this);

    _this.getClient().on('online', function (evt) {
      if (!evt.isOnline) _this._updateValue(['_presence', 'status'], Identity.STATUS.OFFLINE);
    }, _this);

    _this.isInitializing = false;
    return _this;
  }

  _createClass(Identity, [{
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeIdentity(this);
      _get(Identity.prototype.__proto__ || Object.getPrototypeOf(Identity.prototype), 'destroy', this).call(this);
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Identity.prototype.__proto__ || Object.getPrototypeOf(Identity.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Identity.prototype.__proto__ || Object.getPrototypeOf(Identity.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} identity - Server representation of the identity
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(identity) {
      var _this2 = this;

      var client = this.getClient();

      // Disable events if creating a new Identity
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === SYNC_STATE.NEW;

      this._setSynced();

      this.userId = identity.user_id || '';

      this._updateValue(['avatarUrl'], identity.avatar_url);
      this._updateValue(['displayName'], identity.display_name);

      var isFullIdentity = 'metadata' in identity;

      // Handle Full Identity vs Basic Identity
      if (isFullIdentity) {
        this.url = identity.url;
        this.type = identity.type;

        this._updateValue(['emailAddress'], identity.email_address);
        this._updateValue(['lastName'], identity.last_name);
        this._updateValue(['firstName'], identity.first_name);
        this._updateValue(['metadata'], identity.metadata);
        this._updateValue(['publicKey'], identity.public_key);
        this._updateValue(['phoneNumber'], identity.phone_number);
        this.isFullIdentity = true;
      }

      if (!this.url && this.id) {
        this.url = this.getClient().url + this.id.substring(8);
      }

      this._disableEvents = false;

      // See if we have the Full Identity Object in database
      if (!this.isFullIdentity && client.isAuthenticated) {
        client.dbManager.getObjects('identities', [this.id], function (result) {
          if (result.length) _this2._populateFromServer(result[0]);
        });
      }
    }

    /**
     * Update the property; trigger a change event, IF the value has changed.
     *
     * @method _updateValue
     * @private
     * @param {string[]} keys - Property name parts
     * @param {Mixed} value - Property value
     */

  }, {
    key: '_updateValue',
    value: function _updateValue(keys, value) {
      if (value === null || value === undefined) value = '';
      var pointer = this;
      for (var i = 0; i < keys.length - 1; i++) {
        pointer = pointer[keys[i]];
      }
      var lastKey = keys[keys.length - 1];

      if (pointer[lastKey] !== value) {
        if (!this.isInitializing) {
          if (keys[0] === '_presence') keys = [keys[1]];
          this._triggerAsync('identities:change', {
            property: keys.join('.'),
            oldValue: pointer[lastKey],
            newValue: value
          });
        }
        pointer[lastKey] = value;
      }
    }

    /**
     * Accepts json-patch operations for modifying recipientStatus.
     *
     * Note that except for a camelcase error in last_seen_at,
     * all properties are set prior to calling this method.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Object[]} data - Array of operations
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValueIn, oldValueIn, paths) {
      var _this3 = this;

      paths.forEach(function (path) {
        var newValue = newValueIn,
            oldValue = oldValueIn;
        if (path === 'presence.last_seen_at') {
          _this3._presence.lastSeenAt = new Date(newValue.last_seen_at);
          newValue = _this3._presence.lastSeenAt;
          oldValue = oldValue.lastSeenAt;
          delete _this3._presence.last_seen_at; // Flaw in layer-patch assumes that subproperties don't get camel cased (correct assumption for `recipient_status` and `metadata`)
        } else if (path === 'presence.status') {
          newValue = _this3._presence.status;
          oldValue = oldValue.status;
        }
        var property = path.replace(/_(.)/g, function (match, value) {
          return value.toUpperCase();
        }).replace(/^presence\./, '');

        _this3._triggerAsync('identities:change', {
          property: property,
          oldValue: oldValue,
          newValue: newValue
        });
      });
    }

    /**
     * Follow this User.
     *
     * Following a user grants access to their Full Identity,
     * as well as websocket events that update the Identity.
     * @method follow
     */

  }, {
    key: 'follow',
    value: function follow() {
      var _this4 = this;

      if (this.isFullIdentity) return;
      this._xhr({
        method: 'PUT',
        url: this.url.replace(/identities/, 'following/users'),
        syncable: {}
      }, function (result) {
        if (result.success) _this4._load();
      });
      this.syncState = SYNC_STATE.LOADING;
    }

    /**
     * Unfollow this User.
     *
     * Unfollowing the user will reduce your access to only having their Basic Identity,
     * and this Basic Identity will only show up when a relevant Message or Conversation has been loaded.
     *
     * Websocket change notifications for this user will not arrive.
     *
     * @method unfollow
     */

  }, {
    key: 'unfollow',
    value: function unfollow() {
      this._xhr({
        url: this.url.replace(/identities/, 'following/users'),
        method: 'DELETE',
        syncable: {}
      });
    }

    /**
     * Set the status of the current user.
     *
     * @method setStatus
     * @param {String} status    One of layer.Identity.STATUS.AVAILABLE, layer.Identity.STATUS.AWAY,
     *        layer.Identity.STATUS.BUSY, layer.Identity.STATUS.OFLINE
     */

  }, {
    key: 'setStatus',
    value: function setStatus(status) {
      var _this5 = this;

      status = (status || '').toLowerCase();
      if (!Identity.STATUS[status.toUpperCase()]) throw new Error(LayerError.dictionary.valueNotSupported);
      if (this !== this.getClient().user) throw new Error(LayerError.dictionary.permissionDenied);
      if (status === Identity.STATUS.INVISIBLE) status = Identity.STATUS.OFFLINE; // these are equivalent; only one supported by server

      var oldValue = this._presence.status;
      this.getClient().sendSocketRequest({
        method: 'PATCH',
        body: {
          method: 'Presence.update',
          data: [{ operation: 'set', property: 'status', value: status }]
        },
        sync: {
          depends: [this.id],
          target: this.id
        }
      }, function (result) {
        if (!result.success && result.data.id !== 'authentication_required') _this5._updateValue(['_presence', 'status'], oldValue);
      });

      // these are equivalent; only one is useful for understanding your state given that your still connected/online.
      if (status === Identity.STATUS.OFFLINE) status = Identity.STATUS.INVISIBLE;

      this._updateValue(['_presence', 'status'], status);
    }

    /**
     * Update the UserID.
     *
     * This will not only update the User ID, but also the ID,
     * URL, and reregister it with the Client.
     *
     * @method _setUserId
     * @private
     * @param {string} userId
     */

  }, {
    key: '_setUserId',
    value: function _setUserId(userId) {
      var client = this.getClient();
      client._removeIdentity(this);
      this.__userId = userId;
      var encoded = encodeURIComponent(userId);
      this.id = Identity.prefixUUID + encoded;
      this.url = this.getClient().url + '/identities/' + encoded;
      client._addIdentity(this);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.userId = 'xxx'` will cause an error to be thrown.
     * These are not intended to be writable properties
     *
     * @private
     * @method __adjustUserId
     * @param {string} value - New appId value
     */

  }, {
    key: '__adjustUserId',
    value: function __adjustUserId(userId) {
      if (this.__userId) {
        throw new Error(LayerError.dictionary.cantChangeUserId);
      }
    }

    /**
     * Handle a Websocket DELETE event received from the server.
     *
     * A DELETE event means we have unfollowed this user; and should downgrade to a Basic Identity.
     *
     * @method _handleWebsocketDelete
     * @protected
     * @param {Object} data - Deletion parameters; typically null in this case.
    */
    // Turn a Full Identity into a Basic Identity and delete the Full Identity from the database

  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      var _this6 = this;

      this.getClient().dbManager.deleteObjects('identities', [this]);
      ['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'metadata', 'publicKey', 'isFullIdentity', 'type'].forEach(function (key) {
        return delete _this6[key];
      });
      this._triggerAsync('identities:unfollow');
    }

    /**
     * Create a new Identity based on a Server description of the user.
     *
     * @method _createFromServer
     * @static
     * @param {Object} identity - Server Identity Object
     * @param {layer.Client} client
     * @returns {layer.Identity}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(identity, client) {
      return new Identity({
        client: client,
        fromServer: identity,
        _fromDB: identity._fromDB
      });
    }
  }]);

  return Identity;
}(Syncable);

/**
 * Display name for the User or System Identity.
 * @type {string}
 */


Identity.prototype.displayName = '';

/**
 * The Identity matching `layer.Client.user` will have this be true.
 *
 * All other Identities will have this as false.
 * @type {boolean}
 */
Identity.prototype.sessionOwner = false;

/**
 * ID of the Client this Identity is associated with.
 * @type {string}
 */
Identity.prototype.clientId = '';

/**
 * Is this a Full Identity or Basic Identity?
 *
 * Note that Service Identities are always considered to be Basic.
 * @type {boolean}
 */
Identity.prototype.isFullIdentity = false;

/**
 * Unique ID for this User.
 * @type {string}
 */
Identity.prototype.userId = '';

/**
 * Optional URL for the user's icon.
 * @type {string}
 */
Identity.prototype.avatarUrl = '';

/**
 * Optional first name for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.firstName = '';

/**
 * Optional last name for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.lastName = '';

/**
 * Optional email address for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.emailAddress = '';

/**
 * Optional phone number for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.phoneNumber = '';

/**
 * Optional metadata for this user.
 *
 * Full Identities Only.
 *
 * @type {Object}
 */
Identity.prototype.metadata = null;

/**
 * Optional public key for encrypting message text for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.publicKey = '';

/**
 * @static
 * @type {string} The Identity represents a user.  Value used in the layer.Identity.type field.
 */
Identity.UserType = 'user';

/**
 * @static
 * @type {string} The Identity represents a bot.  Value used in the layer.Identity.type field.
 */
Identity.BotType = 'bot';

/**
 * What type of Identity does this represent?
 *
 * * A bot? Use layer.Identity.BotType
 * * A User? Use layer.Identity.UserType
 * @type {string}
 */
Identity.prototype.type = Identity.UserType;

/**
 * Presence object contains presence information for this user.
 *
 * Properties of the sub-object are:
 *
 * * `status`: has the following possible values:
 * ** `available`: User has set their status to `available`.  This is the default initial state
 * ** `away`: App or User has changed their status to `away`
 * ** `busy`: App or User has changed their status to `busy`
 * ** `offline`: User is not connected or has set their status to `offline`
 * ** `invisible`: When a user has set their status to `offline` they instead see a status of `invisible` so that they know
 *    that they have deliberately set their status to `offline` but are still connected.
 * * `lastSeenAt`: Approximate time that the user was last known to be connected (and not `invisible`)
 *
 * @property {Object} _presence
 * @property {String} _presence.status
 * @property {Date} _presence.lastSeenAt
 * @private
 */
Identity.prototype._presence = null;

/**
 * The user's current status or availability.
 *
 * Value is one of:
 *
 * * `layer.Identity.STATUS.AVAILABLE`: User has set their status to `available`.  This is the default initial state
 * * `layer.Identity.STATUS.AWAY`: App or User has changed their status to `away`
 * * `layer.Identity.STATUS.BUSY`: App or User has changed their status to `busy`
 * * `layer.Identity.STATUS.OFFLINE`: User is not connected or has set their status to `offline`
 * * `layer.Identity.STATUS.INVISIBLE`: When a user has set their status to `offline` they instead see a status of `invisible` so that they know
 *    that they have deliberately set their status to `offline` but are still connected.
 *
 * This property can only be set on the session owner's identity, not on other identities via:
 *
 * ```
 * client.user.setStatus(layer.Identity.STATUS.AVAILABLE);
 * ```
 *
 * @property {String} status
 * @readonly
 */
Object.defineProperty(Identity.prototype, 'status', {
  enumerable: true,
  get: function get() {
    return this._presence && this._presence.status || Identity.STATUS.OFFLINE;
  }
});

/**
 * Time that the user was last known to be online.
 *
 * Accurate to within about 15 minutes.  User's who are online, but set their status
 * to `layer.Identity.STATUS.INVISIBLE` will not have their `lastSeenAt` value updated.
 *
 * @property {Date} lastSeenAt
 * @readonly
 */
Object.defineProperty(Identity.prototype, 'lastSeenAt', {
  enumerable: true,
  get: function get() {
    return this._presence && this._presence.lastSeenAt;
  }
});

/**
 * Is this Identity a bot?
 *
 * If the layer.Identity.type field is equal to layer.Identity.BotType then this will return true.
 * @property {boolean} isBot
 */
Object.defineProperty(Identity.prototype, 'isBot', {
  enumerable: true,
  get: function get() {
    return this.type === Identity.BotType;
  }
});

/**
 * Possible values for layer.Identity.status field to be used in `setStatus()`
 *
 * @property {Object} STATUS
 * @property {String} STATUS.AVAILABLE   User has set their status to `available`.  This is the default initial state
 * @property {String} STATUS.AWAY        App or User has changed their status to `away`
 * @property {String} STATUS.BUSY     App or User has changed their status to `busy`
 * @property {String} STATUS.OFFLINE  User is not connected or has set their status to `offline`
 * @property {String} STATUS.INVISIBLE  When a user has set their status to `offline` they instead see a status of `invisible` so that they know
 *    that they have deliberately set their status to `offline` but are still connected.
 * @static
 */
Identity.STATUS = {
  AVAILABLE: 'available',
  AWAY: 'away',
  OFFLINE: 'offline',
  BUSY: 'busy',
  INVISIBLE: 'invisible'
};

Identity.inObjectIgnore = Root.inObjectIgnore;

Identity.bubbleEventParent = 'getClient';

Identity._supportedEvents = ['identities:change', 'identities:loaded', 'identities:loaded-error', 'identities:unfollow'].concat(Syncable._supportedEvents);

Identity.eventPrefix = 'identities';
Identity.prefixUUID = 'layer:///identities/';
Identity.enableOpsIfNew = true;

Root.initClass.apply(Identity, [Identity, 'Identity']);
Syncable.subclasses.push(Identity);

module.exports = Identity;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvaWRlbnRpdHkuanMiXSwibmFtZXMiOlsiU3luY2FibGUiLCJyZXF1aXJlIiwiUm9vdCIsIlNZTkNfU1RBVEUiLCJMYXllckVycm9yIiwiSWRlbnRpdHkiLCJvcHRpb25zIiwiZnJvbVNlcnZlciIsImlkIiwidXNlcklkIiwicHJlZml4VVVJRCIsImVuY29kZVVSSUNvbXBvbmVudCIsInN1YnN0cmluZyIsImxlbmd0aCIsImNsaWVudCIsImNsaWVudElkIiwiYXBwSWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiaXNJbml0aWFsaXppbmciLCJfcHJlc2VuY2UiLCJzdGF0dXMiLCJsYXN0U2VlbkF0IiwiX3BvcHVsYXRlRnJvbVNlcnZlciIsInVybCIsImdldENsaWVudCIsIl9hZGRJZGVudGl0eSIsIm9uIiwiZXZ0IiwiaXNPbmxpbmUiLCJfdXBkYXRlVmFsdWUiLCJTVEFUVVMiLCJPRkZMSU5FIiwiX3JlbW92ZUlkZW50aXR5IiwiZXZ0TmFtZSIsImFyZ3MiLCJfY2xlYXJPYmplY3QiLCJpZGVudGl0eSIsIl9kaXNhYmxlRXZlbnRzIiwic3luY1N0YXRlIiwiTkVXIiwiX3NldFN5bmNlZCIsInVzZXJfaWQiLCJhdmF0YXJfdXJsIiwiZGlzcGxheV9uYW1lIiwiaXNGdWxsSWRlbnRpdHkiLCJ0eXBlIiwiZW1haWxfYWRkcmVzcyIsImxhc3RfbmFtZSIsImZpcnN0X25hbWUiLCJtZXRhZGF0YSIsInB1YmxpY19rZXkiLCJwaG9uZV9udW1iZXIiLCJpc0F1dGhlbnRpY2F0ZWQiLCJkYk1hbmFnZXIiLCJnZXRPYmplY3RzIiwicmVzdWx0Iiwia2V5cyIsInZhbHVlIiwidW5kZWZpbmVkIiwicG9pbnRlciIsImkiLCJsYXN0S2V5IiwiX3RyaWdnZXJBc3luYyIsInByb3BlcnR5Iiwiam9pbiIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJuZXdWYWx1ZUluIiwib2xkVmFsdWVJbiIsInBhdGhzIiwiZm9yRWFjaCIsInBhdGgiLCJEYXRlIiwibGFzdF9zZWVuX2F0IiwicmVwbGFjZSIsIm1hdGNoIiwidG9VcHBlckNhc2UiLCJfeGhyIiwibWV0aG9kIiwic3luY2FibGUiLCJzdWNjZXNzIiwiX2xvYWQiLCJMT0FESU5HIiwidG9Mb3dlckNhc2UiLCJ2YWx1ZU5vdFN1cHBvcnRlZCIsInVzZXIiLCJwZXJtaXNzaW9uRGVuaWVkIiwiSU5WSVNJQkxFIiwic2VuZFNvY2tldFJlcXVlc3QiLCJib2R5IiwiZGF0YSIsIm9wZXJhdGlvbiIsInN5bmMiLCJkZXBlbmRzIiwidGFyZ2V0IiwiX191c2VySWQiLCJlbmNvZGVkIiwiY2FudENoYW5nZVVzZXJJZCIsImRlbGV0ZU9iamVjdHMiLCJrZXkiLCJfZnJvbURCIiwicHJvdG90eXBlIiwiZGlzcGxheU5hbWUiLCJzZXNzaW9uT3duZXIiLCJhdmF0YXJVcmwiLCJmaXJzdE5hbWUiLCJsYXN0TmFtZSIsImVtYWlsQWRkcmVzcyIsInBob25lTnVtYmVyIiwicHVibGljS2V5IiwiVXNlclR5cGUiLCJCb3RUeXBlIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiZ2V0IiwiQVZBSUxBQkxFIiwiQVdBWSIsIkJVU1kiLCJpbk9iamVjdElnbm9yZSIsImJ1YmJsZUV2ZW50UGFyZW50IiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImV2ZW50UHJlZml4IiwiZW5hYmxlT3BzSWZOZXciLCJpbml0Q2xhc3MiLCJhcHBseSIsInN1YmNsYXNzZXMiLCJwdXNoIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7OztBQVNBOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLElBQU1BLFdBQVdDLFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU1DLE9BQU9ELFFBQVEsU0FBUixDQUFiOztlQUN1QkEsUUFBUSxVQUFSLEM7SUFBZkUsVSxZQUFBQSxVOztBQUNSLElBQU1DLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7O0lBRU1J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O0FBWUE1RyxTQUFTMkIsTUFBVCxHQUFrQjtBQUNoQnNGLGFBQVcsV0FESztBQUVoQkMsUUFBTSxNQUZVO0FBR2hCdEYsV0FBUyxTQUhPO0FBSWhCdUYsUUFBTSxNQUpVO0FBS2hCL0IsYUFBVztBQUxLLENBQWxCOztBQVFBcEYsU0FBU29ILGNBQVQsR0FBMEJ2SCxLQUFLdUgsY0FBL0I7O0FBRUFwSCxTQUFTcUgsaUJBQVQsR0FBNkIsV0FBN0I7O0FBRUFySCxTQUFTc0gsZ0JBQVQsR0FBNEIsQ0FDMUIsbUJBRDBCLEVBRTFCLG1CQUYwQixFQUcxQix5QkFIMEIsRUFJMUIscUJBSjBCLEVBSzFCQyxNQUwwQixDQUtuQjVILFNBQVMySCxnQkFMVSxDQUE1Qjs7QUFPQXRILFNBQVN3SCxXQUFULEdBQXVCLFlBQXZCO0FBQ0F4SCxTQUFTSyxVQUFULEdBQXNCLHNCQUF0QjtBQUNBTCxTQUFTeUgsY0FBVCxHQUEwQixJQUExQjs7QUFFQTVILEtBQUs2SCxTQUFMLENBQWVDLEtBQWYsQ0FBcUIzSCxRQUFyQixFQUErQixDQUFDQSxRQUFELEVBQVcsVUFBWCxDQUEvQjtBQUNBTCxTQUFTaUksVUFBVCxDQUFvQkMsSUFBcEIsQ0FBeUI3SCxRQUF6Qjs7QUFFQThILE9BQU9DLE9BQVAsR0FBaUIvSCxRQUFqQiIsImZpbGUiOiJpZGVudGl0eS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIElkZW50aXR5IGNsYXNzIHJlcHJlc2VudHMgYW4gSWRlbnRpdHkgb2YgYSB1c2VyIG9mIHlvdXIgYXBwbGljYXRpb24uXG4gKlxuICogSWRlbnRpdGllcyBhcmUgY3JlYXRlZCBieSB0aGUgU3lzdGVtLCBuZXZlciBkaXJlY3RseSBieSBhcHBzLlxuICpcbiAqIEBjbGFzcyBsYXllci5JZGVudGl0eVxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqL1xuXG4vKlxuICogSG93IElkZW50aXRpZXMgZml0IGludG8gdGhlIHN5c3RlbTpcbiAqXG4gKiAxLiBBcyBwYXJ0IG9mIGluaXRpYWxpemF0aW9uLCBsb2FkIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIncyBmdWxsIElkZW50aXR5IHJlY29yZCBzbyB0aGF0IHRoZSBDbGllbnQga25vd3MgbW9yZSB0aGFuIGp1c3QgdGhlIGB1c2VySWRgIG9mIGl0cyB1c2VyLlxuICogICAgY2xpZW50LnVzZXIgPSA8SWRlbnRpdHk+XG4gKiAyLiBBbnkgdGltZSB3ZSBnZXQgYSBCYXNpYyBJZGVudGl0eSB2aWEgYG1lc3NhZ2Uuc2VuZGVyYCBvciBDb252ZXJzYXRpb25zLCBzZWUgaWYgd2UgaGF2ZSBhbiBJZGVudGl0eSBmb3IgdGhhdCBzZW5kZXIsXG4gKiAgICBhbmQgaWYgbm90IGNyZWF0ZSBvbmUgdXNpbmcgdGhlIEJhc2ljIElkZW50aXR5LiAgVGhlcmUgc2hvdWxkIG5ldmVyIGJlIGEgZHVwbGljYXRlIElkZW50aXR5LlxuICogMy4gV2Vic29ja2V0IENIQU5HRSBldmVudHMgd2lsbCB1cGRhdGUgSWRlbnRpdHkgb2JqZWN0cywgYXMgd2VsbCBhcyBhZGQgbmV3IEZ1bGwgSWRlbnRpdGllcywgYW5kIGRvd25ncmFkZSBGdWxsIElkZW50aXRpZXMgdG8gQmFzaWMgSWRlbnRpdGllcy5cbiAqIDQuIFRoZSBRdWVyeSBBUEkgc3VwcG9ydHMgcXVlcnlpbmcgYW5kIHBhZ2luZyB0aHJvdWdoIElkZW50aXRpZXNcbiAqIDUuIFRoZSBRdWVyeSBBUEkgbG9hZHMgRnVsbCBJZGVudGl0aWVzOyB0aGVzZSByZXN1bHRzIHdpbGwgdXBkYXRlIHRoZSBjbGllbnQuX21vZGVscy5pZGVudGl0aWVzO1xuICogICAgdXBncmFkaW5nIEJhc2ljIElkZW50aXRpZXMgaWYgdGhleSBtYXRjaCwgYW5kIGFkZGluZyBuZXcgSWRlbnRpdGllcyBpZiB0aGV5IGRvbid0LlxuICogNi4gRGJNYW5hZ2VyIHdpbGwgcGVyc2lzdCBvbmx5IFVzZXJJZGVudGl0aWVzLCBhbmQgb25seSB0aG9zZSB0aGF0IGFyZSBGdWxsIElkZW50aXRpZXMuICBCYXNpYyBJZGVudGl0aWVzIHdpbGwgYmUgd3JpdHRlblxuICogICAgdG8gdGhlIE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb25zIHRhYmxlcyBhbnl3YXlzIGFzIHBhcnQgb2YgdGhvc2UgbGFyZ2VyIG9iamVjdHMuXG4gKiA3LiBBUEkgRm9yIGV4cGxpY2l0IGZvbGxvd3MvdW5mb2xsb3dzXG4gKi9cblxuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgeyBTWU5DX1NUQVRFIH0gPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5cbmNsYXNzIElkZW50aXR5IGV4dGVuZHMgU3luY2FibGUge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyBNYWtlIHN1cmUgdGhlIElEIGZyb20gaGFuZGxlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyIGlzIHVzZWQgYnkgdGhlIFJvb3QuY29uc3RydWN0b3JcbiAgICBpZiAob3B0aW9ucy5mcm9tU2VydmVyKSB7XG4gICAgICBvcHRpb25zLmlkID0gb3B0aW9ucy5mcm9tU2VydmVyLmlkIHx8ICctJztcbiAgICB9IGVsc2UgaWYgKCFvcHRpb25zLmlkICYmIG9wdGlvbnMudXNlcklkKSB7XG4gICAgICBvcHRpb25zLmlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudChvcHRpb25zLnVzZXJJZCk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmlkICYmICFvcHRpb25zLnVzZXJJZCkge1xuICAgICAgb3B0aW9ucy51c2VySWQgPSBvcHRpb25zLmlkLnN1YnN0cmluZyhJZGVudGl0eS5wcmVmaXhVVUlELmxlbmd0aCk7XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHdlIGhhdmUgYW4gY2xpZW50SWQgcHJvcGVydHlcbiAgICBpZiAob3B0aW9ucy5jbGllbnQpIG9wdGlvbnMuY2xpZW50SWQgPSBvcHRpb25zLmNsaWVudC5hcHBJZDtcbiAgICBpZiAoIW9wdGlvbnMuY2xpZW50SWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIFRoZSAtIGlzIGhlcmUgdG8gcHJldmVudCBSb290IGZyb20gZ2VuZXJhdGluZyBhIFVVSUQgZm9yIGFuIElELiAgSUQgbXVzdCBtYXAgdG8gVXNlcklEXG4gICAgLy8gYW5kIGNhbid0IGJlIHJhbmRvbWx5IGdlbmVyYXRlZC4gIFRoaXMgb25seSBvY2N1cnMgZnJvbSBQbGF0Zm9ybSBBUEkgc2VuZGluZyB3aXRoIGBzZW5kZXIubmFtZWAgYW5kIG5vIGlkZW50aXR5LlxuICAgIGlmICh0aGlzLmlkID09PSAnLScpIHRoaXMuaWQgPSAnJztcblxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuXG4gICAgaWYgKCF0aGlzLl9wcmVzZW5jZSkge1xuICAgICAgdGhpcy5fcHJlc2VuY2UgPSB7XG4gICAgICAgIHN0YXR1czogbnVsbCxcbiAgICAgICAgbGFzdFNlZW5BdDogbnVsbCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIG9wdGlvbnMgY29udGFpbnMgYSBmdWxsIHNlcnZlciBkZWZpbml0aW9uIG9mIHRoZSBvYmplY3QsXG4gICAgLy8gY29weSBpdCBpbiB3aXRoIF9wb3B1bGF0ZUZyb21TZXJ2ZXI7IHRoaXMgd2lsbCBhZGQgdGhlIElkZW50aXR5XG4gICAgLy8gdG8gdGhlIENsaWVudCBhcyB3ZWxsLlxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKG9wdGlvbnMuZnJvbVNlcnZlcik7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVybCAmJiB0aGlzLmlkKSB7XG4gICAgICB0aGlzLnVybCA9IGAke3RoaXMuZ2V0Q2xpZW50KCkudXJsfS8ke3RoaXMuaWQuc3Vic3RyaW5nKDkpfWA7XG4gICAgfSBlbHNlIGlmICghdGhpcy51cmwpIHtcbiAgICAgIHRoaXMudXJsID0gJyc7XG4gICAgfVxuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX2FkZElkZW50aXR5KHRoaXMpO1xuXG4gICAgdGhpcy5nZXRDbGllbnQoKS5vbignb25saW5lJywgKGV2dCkgPT4ge1xuICAgICAgaWYgKCFldnQuaXNPbmxpbmUpIHRoaXMuX3VwZGF0ZVZhbHVlKFsnX3ByZXNlbmNlJywgJ3N0YXR1cyddLCBJZGVudGl0eS5TVEFUVVMuT0ZGTElORSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkgY2xpZW50Ll9yZW1vdmVJZGVudGl0eSh0aGlzKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICBfdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLl90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICB0cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2UgdXNpbmcgc2VydmVyLWRhdGEuXG4gICAqXG4gICAqIFNpZGUgZWZmZWN0cyBhZGQgdGhpcyB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBpZGVudGl0eSAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgaWRlbnRpdHlcbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIoaWRlbnRpdHkpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gRGlzYWJsZSBldmVudHMgaWYgY3JlYXRpbmcgYSBuZXcgSWRlbnRpdHlcbiAgICAvLyBXZSBzdGlsbCB3YW50IHByb3BlcnR5IGNoYW5nZSBldmVudHMgZm9yIGFueXRoaW5nIHRoYXQgRE9FUyBjaGFuZ2VcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gKHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyk7XG5cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcblxuICAgIHRoaXMudXNlcklkID0gaWRlbnRpdHkudXNlcl9pZCB8fCAnJztcblxuICAgIHRoaXMuX3VwZGF0ZVZhbHVlKFsnYXZhdGFyVXJsJ10sIGlkZW50aXR5LmF2YXRhcl91cmwpO1xuICAgIHRoaXMuX3VwZGF0ZVZhbHVlKFsnZGlzcGxheU5hbWUnXSwgaWRlbnRpdHkuZGlzcGxheV9uYW1lKTtcblxuICAgIGNvbnN0IGlzRnVsbElkZW50aXR5ID0gJ21ldGFkYXRhJyBpbiBpZGVudGl0eTtcblxuICAgIC8vIEhhbmRsZSBGdWxsIElkZW50aXR5IHZzIEJhc2ljIElkZW50aXR5XG4gICAgaWYgKGlzRnVsbElkZW50aXR5KSB7XG4gICAgICB0aGlzLnVybCA9IGlkZW50aXR5LnVybDtcbiAgICAgIHRoaXMudHlwZSA9IGlkZW50aXR5LnR5cGU7XG5cbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKFsnZW1haWxBZGRyZXNzJ10sIGlkZW50aXR5LmVtYWlsX2FkZHJlc3MpO1xuICAgICAgdGhpcy5fdXBkYXRlVmFsdWUoWydsYXN0TmFtZSddLCBpZGVudGl0eS5sYXN0X25hbWUpO1xuICAgICAgdGhpcy5fdXBkYXRlVmFsdWUoWydmaXJzdE5hbWUnXSwgaWRlbnRpdHkuZmlyc3RfbmFtZSk7XG4gICAgICB0aGlzLl91cGRhdGVWYWx1ZShbJ21ldGFkYXRhJ10sIGlkZW50aXR5Lm1ldGFkYXRhKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKFsncHVibGljS2V5J10sIGlkZW50aXR5LnB1YmxpY19rZXkpO1xuICAgICAgdGhpcy5fdXBkYXRlVmFsdWUoWydwaG9uZU51bWJlciddLCBpZGVudGl0eS5waG9uZV9udW1iZXIpO1xuICAgICAgdGhpcy5pc0Z1bGxJZGVudGl0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVybCAmJiB0aGlzLmlkKSB7XG4gICAgICB0aGlzLnVybCA9IHRoaXMuZ2V0Q2xpZW50KCkudXJsICsgdGhpcy5pZC5zdWJzdHJpbmcoOCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuXG4gICAgLy8gU2VlIGlmIHdlIGhhdmUgdGhlIEZ1bGwgSWRlbnRpdHkgT2JqZWN0IGluIGRhdGFiYXNlXG4gICAgaWYgKCF0aGlzLmlzRnVsbElkZW50aXR5ICYmIGNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIGNsaWVudC5kYk1hbmFnZXIuZ2V0T2JqZWN0cygnaWRlbnRpdGllcycsIFt0aGlzLmlkXSwgKHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAocmVzdWx0Lmxlbmd0aCkgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKHJlc3VsdFswXSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBwcm9wZXJ0eTsgdHJpZ2dlciBhIGNoYW5nZSBldmVudCwgSUYgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVWYWx1ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlzIC0gUHJvcGVydHkgbmFtZSBwYXJ0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSAtIFByb3BlcnR5IHZhbHVlXG4gICAqL1xuICBfdXBkYXRlVmFsdWUoa2V5cywgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgdmFsdWUgPSAnJztcbiAgICBsZXQgcG9pbnRlciA9IHRoaXM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgcG9pbnRlciA9IHBvaW50ZXJba2V5c1tpXV07XG4gICAgfVxuICAgIGNvbnN0IGxhc3RLZXkgPSBrZXlzW2tleXMubGVuZ3RoIC0gMV07XG5cbiAgICBpZiAocG9pbnRlcltsYXN0S2V5XSAhPT0gdmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZykge1xuICAgICAgICBpZiAoa2V5c1swXSA9PT0gJ19wcmVzZW5jZScpIGtleXMgPSBba2V5c1sxXV07XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnaWRlbnRpdGllczpjaGFuZ2UnLCB7XG4gICAgICAgICAgcHJvcGVydHk6IGtleXMuam9pbignLicpLFxuICAgICAgICAgIG9sZFZhbHVlOiBwb2ludGVyW2xhc3RLZXldLFxuICAgICAgICAgIG5ld1ZhbHVlOiB2YWx1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBwb2ludGVyW2xhc3RLZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFjY2VwdHMganNvbi1wYXRjaCBvcGVyYXRpb25zIGZvciBtb2RpZnlpbmcgcmVjaXBpZW50U3RhdHVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgZXhjZXB0IGZvciBhIGNhbWVsY2FzZSBlcnJvciBpbiBsYXN0X3NlZW5fYXQsXG4gICAqIGFsbCBwcm9wZXJ0aWVzIGFyZSBzZXQgcHJpb3IgdG8gY2FsbGluZyB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUGF0Y2hFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3RbXX0gZGF0YSAtIEFycmF5IG9mIG9wZXJhdGlvbnNcbiAgICovXG4gIF9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlSW4sIG9sZFZhbHVlSW4sIHBhdGhzKSB7XG4gICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgbGV0IG5ld1ZhbHVlID0gbmV3VmFsdWVJbixcbiAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZUluO1xuICAgICAgaWYgKHBhdGggPT09ICdwcmVzZW5jZS5sYXN0X3NlZW5fYXQnKSB7XG4gICAgICAgIHRoaXMuX3ByZXNlbmNlLmxhc3RTZWVuQXQgPSBuZXcgRGF0ZShuZXdWYWx1ZS5sYXN0X3NlZW5fYXQpO1xuICAgICAgICBuZXdWYWx1ZSA9IHRoaXMuX3ByZXNlbmNlLmxhc3RTZWVuQXQ7XG4gICAgICAgIG9sZFZhbHVlID0gb2xkVmFsdWUubGFzdFNlZW5BdDtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXNlbmNlLmxhc3Rfc2Vlbl9hdDsgLy8gRmxhdyBpbiBsYXllci1wYXRjaCBhc3N1bWVzIHRoYXQgc3VicHJvcGVydGllcyBkb24ndCBnZXQgY2FtZWwgY2FzZWQgKGNvcnJlY3QgYXNzdW1wdGlvbiBmb3IgYHJlY2lwaWVudF9zdGF0dXNgIGFuZCBgbWV0YWRhdGFgKVxuICAgICAgfSBlbHNlIGlmIChwYXRoID09PSAncHJlc2VuY2Uuc3RhdHVzJykge1xuICAgICAgICBuZXdWYWx1ZSA9IHRoaXMuX3ByZXNlbmNlLnN0YXR1cztcbiAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZS5zdGF0dXM7XG4gICAgICB9XG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IHBhdGhcbiAgICAgICAgLnJlcGxhY2UoL18oLikvZywgKG1hdGNoLCB2YWx1ZSkgPT4gdmFsdWUudG9VcHBlckNhc2UoKSlcbiAgICAgICAgLnJlcGxhY2UoL15wcmVzZW5jZVxcLi8sICcnKTtcblxuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOmNoYW5nZScsIHtcbiAgICAgICAgcHJvcGVydHksXG4gICAgICAgIG9sZFZhbHVlLFxuICAgICAgICBuZXdWYWx1ZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvbGxvdyB0aGlzIFVzZXIuXG4gICAqXG4gICAqIEZvbGxvd2luZyBhIHVzZXIgZ3JhbnRzIGFjY2VzcyB0byB0aGVpciBGdWxsIElkZW50aXR5LFxuICAgKiBhcyB3ZWxsIGFzIHdlYnNvY2tldCBldmVudHMgdGhhdCB1cGRhdGUgdGhlIElkZW50aXR5LlxuICAgKiBAbWV0aG9kIGZvbGxvd1xuICAgKi9cbiAgZm9sbG93KCkge1xuICAgIGlmICh0aGlzLmlzRnVsbElkZW50aXR5KSByZXR1cm47XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICB1cmw6IHRoaXMudXJsLnJlcGxhY2UoL2lkZW50aXRpZXMvLCAnZm9sbG93aW5nL3VzZXJzJyksXG4gICAgICBzeW5jYWJsZToge30sXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG4gICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLkxPQURJTkc7XG4gIH1cblxuICAvKipcbiAgICogVW5mb2xsb3cgdGhpcyBVc2VyLlxuICAgKlxuICAgKiBVbmZvbGxvd2luZyB0aGUgdXNlciB3aWxsIHJlZHVjZSB5b3VyIGFjY2VzcyB0byBvbmx5IGhhdmluZyB0aGVpciBCYXNpYyBJZGVudGl0eSxcbiAgICogYW5kIHRoaXMgQmFzaWMgSWRlbnRpdHkgd2lsbCBvbmx5IHNob3cgdXAgd2hlbiBhIHJlbGV2YW50IE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGxvYWRlZC5cbiAgICpcbiAgICogV2Vic29ja2V0IGNoYW5nZSBub3RpZmljYXRpb25zIGZvciB0aGlzIHVzZXIgd2lsbCBub3QgYXJyaXZlLlxuICAgKlxuICAgKiBAbWV0aG9kIHVuZm9sbG93XG4gICAqL1xuICB1bmZvbGxvdygpIHtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiB0aGlzLnVybC5yZXBsYWNlKC9pZGVudGl0aWVzLywgJ2ZvbGxvd2luZy91c2VycycpLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHN5bmNhYmxlOiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhlIHN0YXR1cyBvZiB0aGUgY3VycmVudCB1c2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIHNldFN0YXR1c1xuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RhdHVzICAgIE9uZSBvZiBsYXllci5JZGVudGl0eS5TVEFUVVMuQVZBSUxBQkxFLCBsYXllci5JZGVudGl0eS5TVEFUVVMuQVdBWSxcbiAgICogICAgICAgIGxheWVyLklkZW50aXR5LlNUQVRVUy5CVVNZLCBsYXllci5JZGVudGl0eS5TVEFUVVMuT0ZMSU5FXG4gICAqL1xuICBzZXRTdGF0dXMoc3RhdHVzKSB7XG4gICAgc3RhdHVzID0gKHN0YXR1cyB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIUlkZW50aXR5LlNUQVRVU1tzdGF0dXMudG9VcHBlckNhc2UoKV0pIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkudmFsdWVOb3RTdXBwb3J0ZWQpO1xuICAgIGlmICh0aGlzICE9PSB0aGlzLmdldENsaWVudCgpLnVzZXIpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkucGVybWlzc2lvbkRlbmllZCk7XG4gICAgaWYgKHN0YXR1cyA9PT0gSWRlbnRpdHkuU1RBVFVTLklOVklTSUJMRSkgc3RhdHVzID0gSWRlbnRpdHkuU1RBVFVTLk9GRkxJTkU7IC8vIHRoZXNlIGFyZSBlcXVpdmFsZW50OyBvbmx5IG9uZSBzdXBwb3J0ZWQgYnkgc2VydmVyXG5cbiAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX3ByZXNlbmNlLnN0YXR1cztcbiAgICB0aGlzLmdldENsaWVudCgpLnNlbmRTb2NrZXRSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgbWV0aG9kOiAnUHJlc2VuY2UudXBkYXRlJyxcbiAgICAgICAgZGF0YTogW1xuICAgICAgICAgIHsgb3BlcmF0aW9uOiAnc2V0JywgcHJvcGVydHk6ICdzdGF0dXMnLCB2YWx1ZTogc3RhdHVzIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgc3luYzoge1xuICAgICAgICBkZXBlbmRzOiBbdGhpcy5pZF0sXG4gICAgICAgIHRhcmdldDogdGhpcy5pZCxcbiAgICAgIH0sXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQuZGF0YS5pZCAhPT0gJ2F1dGhlbnRpY2F0aW9uX3JlcXVpcmVkJykgdGhpcy5fdXBkYXRlVmFsdWUoWydfcHJlc2VuY2UnLCAnc3RhdHVzJ10sIG9sZFZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIHRoZXNlIGFyZSBlcXVpdmFsZW50OyBvbmx5IG9uZSBpcyB1c2VmdWwgZm9yIHVuZGVyc3RhbmRpbmcgeW91ciBzdGF0ZSBnaXZlbiB0aGF0IHlvdXIgc3RpbGwgY29ubmVjdGVkL29ubGluZS5cbiAgICBpZiAoc3RhdHVzID09PSBJZGVudGl0eS5TVEFUVVMuT0ZGTElORSkgc3RhdHVzID0gSWRlbnRpdHkuU1RBVFVTLklOVklTSUJMRTtcblxuICAgIHRoaXMuX3VwZGF0ZVZhbHVlKFsnX3ByZXNlbmNlJywgJ3N0YXR1cyddLCBzdGF0dXMpO1xuICB9XG5cbiAvKipcbiAgKiBVcGRhdGUgdGhlIFVzZXJJRC5cbiAgKlxuICAqIFRoaXMgd2lsbCBub3Qgb25seSB1cGRhdGUgdGhlIFVzZXIgSUQsIGJ1dCBhbHNvIHRoZSBJRCxcbiAgKiBVUkwsIGFuZCByZXJlZ2lzdGVyIGl0IHdpdGggdGhlIENsaWVudC5cbiAgKlxuICAqIEBtZXRob2QgX3NldFVzZXJJZFxuICAqIEBwcml2YXRlXG4gICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZFxuICAqL1xuICBfc2V0VXNlcklkKHVzZXJJZCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY2xpZW50Ll9yZW1vdmVJZGVudGl0eSh0aGlzKTtcbiAgICB0aGlzLl9fdXNlcklkID0gdXNlcklkO1xuICAgIGNvbnN0IGVuY29kZWQgPSBlbmNvZGVVUklDb21wb25lbnQodXNlcklkKTtcbiAgICB0aGlzLmlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZWQ7XG4gICAgdGhpcy51cmwgPSBgJHt0aGlzLmdldENsaWVudCgpLnVybH0vaWRlbnRpdGllcy8ke2VuY29kZWR9YDtcbiAgICBjbGllbnQuX2FkZElkZW50aXR5KHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBhdHRlbXB0IHRvIGV4ZWN1dGUgYHRoaXMudXNlcklkID0gJ3h4eCdgIHdpbGwgY2F1c2UgYW4gZXJyb3IgdG8gYmUgdGhyb3duLlxuICAgKiBUaGVzZSBhcmUgbm90IGludGVuZGVkIHRvIGJlIHdyaXRhYmxlIHByb3BlcnRpZXNcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfX2FkanVzdFVzZXJJZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBOZXcgYXBwSWQgdmFsdWVcbiAgICovXG4gIF9fYWRqdXN0VXNlcklkKHVzZXJJZCkge1xuICAgIGlmICh0aGlzLl9fdXNlcklkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNhbnRDaGFuZ2VVc2VySWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgYSBXZWJzb2NrZXQgREVMRVRFIGV2ZW50IHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQSBERUxFVEUgZXZlbnQgbWVhbnMgd2UgaGF2ZSB1bmZvbGxvd2VkIHRoaXMgdXNlcjsgYW5kIHNob3VsZCBkb3duZ3JhZGUgdG8gYSBCYXNpYyBJZGVudGl0eS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlV2Vic29ja2V0RGVsZXRlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgLSBEZWxldGlvbiBwYXJhbWV0ZXJzOyB0eXBpY2FsbHkgbnVsbCBpbiB0aGlzIGNhc2UuXG4gICovXG4gIC8vIFR1cm4gYSBGdWxsIElkZW50aXR5IGludG8gYSBCYXNpYyBJZGVudGl0eSBhbmQgZGVsZXRlIHRoZSBGdWxsIElkZW50aXR5IGZyb20gdGhlIGRhdGFiYXNlXG4gIF9oYW5kbGVXZWJzb2NrZXREZWxldGUoZGF0YSkge1xuICAgIHRoaXMuZ2V0Q2xpZW50KCkuZGJNYW5hZ2VyLmRlbGV0ZU9iamVjdHMoJ2lkZW50aXRpZXMnLCBbdGhpc10pO1xuICAgIFsnZmlyc3ROYW1lJywgJ2xhc3ROYW1lJywgJ2VtYWlsQWRkcmVzcycsICdwaG9uZU51bWJlcicsICdtZXRhZGF0YScsICdwdWJsaWNLZXknLCAnaXNGdWxsSWRlbnRpdHknLCAndHlwZSddXG4gICAgICAuZm9yRWFjaChrZXkgPT4gZGVsZXRlIHRoaXNba2V5XSk7XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOnVuZm9sbG93Jyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IElkZW50aXR5IGJhc2VkIG9uIGEgU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSB1c2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtPYmplY3R9IGlkZW50aXR5IC0gU2VydmVyIElkZW50aXR5IE9iamVjdFxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm5zIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihpZGVudGl0eSwgY2xpZW50KSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eSh7XG4gICAgICBjbGllbnQsXG4gICAgICBmcm9tU2VydmVyOiBpZGVudGl0eSxcbiAgICAgIF9mcm9tREI6IGlkZW50aXR5Ll9mcm9tREIsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNwbGF5IG5hbWUgZm9yIHRoZSBVc2VyIG9yIFN5c3RlbSBJZGVudGl0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5kaXNwbGF5TmFtZSA9ICcnO1xuXG4vKipcbiAqIFRoZSBJZGVudGl0eSBtYXRjaGluZyBgbGF5ZXIuQ2xpZW50LnVzZXJgIHdpbGwgaGF2ZSB0aGlzIGJlIHRydWUuXG4gKlxuICogQWxsIG90aGVyIElkZW50aXRpZXMgd2lsbCBoYXZlIHRoaXMgYXMgZmFsc2UuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnNlc3Npb25Pd25lciA9IGZhbHNlO1xuXG4vKipcbiAqIElEIG9mIHRoZSBDbGllbnQgdGhpcyBJZGVudGl0eSBpcyBhc3NvY2lhdGVkIHdpdGguXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBJcyB0aGlzIGEgRnVsbCBJZGVudGl0eSBvciBCYXNpYyBJZGVudGl0eT9cbiAqXG4gKiBOb3RlIHRoYXQgU2VydmljZSBJZGVudGl0aWVzIGFyZSBhbHdheXMgY29uc2lkZXJlZCB0byBiZSBCYXNpYy5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuaXNGdWxsSWRlbnRpdHkgPSBmYWxzZTtcblxuLyoqXG4gKiBVbmlxdWUgSUQgZm9yIHRoaXMgVXNlci5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS51c2VySWQgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBVUkwgZm9yIHRoZSB1c2VyJ3MgaWNvbi5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5hdmF0YXJVcmwgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBmaXJzdCBuYW1lIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmZpcnN0TmFtZSA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIGxhc3QgbmFtZSBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIEZ1bGwgSWRlbnRpdGllcyBPbmx5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5sYXN0TmFtZSA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIGVtYWlsIGFkZHJlc3MgZm9yIHRoaXMgdXNlci5cbiAqXG4gKiBGdWxsIElkZW50aXRpZXMgT25seS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuZW1haWxBZGRyZXNzID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgcGhvbmUgbnVtYmVyIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnBob25lTnVtYmVyID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgbWV0YWRhdGEgZm9yIHRoaXMgdXNlci5cbiAqXG4gKiBGdWxsIElkZW50aXRpZXMgT25seS5cbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUubWV0YWRhdGEgPSBudWxsO1xuXG4vKipcbiAqIE9wdGlvbmFsIHB1YmxpYyBrZXkgZm9yIGVuY3J5cHRpbmcgbWVzc2FnZSB0ZXh0IGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnB1YmxpY0tleSA9ICcnO1xuXG4vKipcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtzdHJpbmd9IFRoZSBJZGVudGl0eSByZXByZXNlbnRzIGEgdXNlci4gIFZhbHVlIHVzZWQgaW4gdGhlIGxheWVyLklkZW50aXR5LnR5cGUgZmllbGQuXG4gKi9cbklkZW50aXR5LlVzZXJUeXBlID0gJ3VzZXInO1xuXG4vKipcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtzdHJpbmd9IFRoZSBJZGVudGl0eSByZXByZXNlbnRzIGEgYm90LiAgVmFsdWUgdXNlZCBpbiB0aGUgbGF5ZXIuSWRlbnRpdHkudHlwZSBmaWVsZC5cbiAqL1xuSWRlbnRpdHkuQm90VHlwZSA9ICdib3QnO1xuXG4vKipcbiAqIFdoYXQgdHlwZSBvZiBJZGVudGl0eSBkb2VzIHRoaXMgcmVwcmVzZW50P1xuICpcbiAqICogQSBib3Q/IFVzZSBsYXllci5JZGVudGl0eS5Cb3RUeXBlXG4gKiAqIEEgVXNlcj8gVXNlIGxheWVyLklkZW50aXR5LlVzZXJUeXBlXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUudHlwZSA9IElkZW50aXR5LlVzZXJUeXBlO1xuXG4vKipcbiAqIFByZXNlbmNlIG9iamVjdCBjb250YWlucyBwcmVzZW5jZSBpbmZvcm1hdGlvbiBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIFByb3BlcnRpZXMgb2YgdGhlIHN1Yi1vYmplY3QgYXJlOlxuICpcbiAqICogYHN0YXR1c2A6IGhhcyB0aGUgZm9sbG93aW5nIHBvc3NpYmxlIHZhbHVlczpcbiAqICoqIGBhdmFpbGFibGVgOiBVc2VyIGhhcyBzZXQgdGhlaXIgc3RhdHVzIHRvIGBhdmFpbGFibGVgLiAgVGhpcyBpcyB0aGUgZGVmYXVsdCBpbml0aWFsIHN0YXRlXG4gKiAqKiBgYXdheWA6IEFwcCBvciBVc2VyIGhhcyBjaGFuZ2VkIHRoZWlyIHN0YXR1cyB0byBgYXdheWBcbiAqICoqIGBidXN5YDogQXBwIG9yIFVzZXIgaGFzIGNoYW5nZWQgdGhlaXIgc3RhdHVzIHRvIGBidXN5YFxuICogKiogYG9mZmxpbmVgOiBVc2VyIGlzIG5vdCBjb25uZWN0ZWQgb3IgaGFzIHNldCB0aGVpciBzdGF0dXMgdG8gYG9mZmxpbmVgXG4gKiAqKiBgaW52aXNpYmxlYDogV2hlbiBhIHVzZXIgaGFzIHNldCB0aGVpciBzdGF0dXMgdG8gYG9mZmxpbmVgIHRoZXkgaW5zdGVhZCBzZWUgYSBzdGF0dXMgb2YgYGludmlzaWJsZWAgc28gdGhhdCB0aGV5IGtub3dcbiAqICAgIHRoYXQgdGhleSBoYXZlIGRlbGliZXJhdGVseSBzZXQgdGhlaXIgc3RhdHVzIHRvIGBvZmZsaW5lYCBidXQgYXJlIHN0aWxsIGNvbm5lY3RlZC5cbiAqICogYGxhc3RTZWVuQXRgOiBBcHByb3hpbWF0ZSB0aW1lIHRoYXQgdGhlIHVzZXIgd2FzIGxhc3Qga25vd24gdG8gYmUgY29ubmVjdGVkIChhbmQgbm90IGBpbnZpc2libGVgKVxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBfcHJlc2VuY2VcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBfcHJlc2VuY2Uuc3RhdHVzXG4gKiBAcHJvcGVydHkge0RhdGV9IF9wcmVzZW5jZS5sYXN0U2VlbkF0XG4gKiBAcHJpdmF0ZVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuX3ByZXNlbmNlID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgdXNlcidzIGN1cnJlbnQgc3RhdHVzIG9yIGF2YWlsYWJpbGl0eS5cbiAqXG4gKiBWYWx1ZSBpcyBvbmUgb2Y6XG4gKlxuICogKiBgbGF5ZXIuSWRlbnRpdHkuU1RBVFVTLkFWQUlMQUJMRWA6IFVzZXIgaGFzIHNldCB0aGVpciBzdGF0dXMgdG8gYGF2YWlsYWJsZWAuICBUaGlzIGlzIHRoZSBkZWZhdWx0IGluaXRpYWwgc3RhdGVcbiAqICogYGxheWVyLklkZW50aXR5LlNUQVRVUy5BV0FZYDogQXBwIG9yIFVzZXIgaGFzIGNoYW5nZWQgdGhlaXIgc3RhdHVzIHRvIGBhd2F5YFxuICogKiBgbGF5ZXIuSWRlbnRpdHkuU1RBVFVTLkJVU1lgOiBBcHAgb3IgVXNlciBoYXMgY2hhbmdlZCB0aGVpciBzdGF0dXMgdG8gYGJ1c3lgXG4gKiAqIGBsYXllci5JZGVudGl0eS5TVEFUVVMuT0ZGTElORWA6IFVzZXIgaXMgbm90IGNvbm5lY3RlZCBvciBoYXMgc2V0IHRoZWlyIHN0YXR1cyB0byBgb2ZmbGluZWBcbiAqICogYGxheWVyLklkZW50aXR5LlNUQVRVUy5JTlZJU0lCTEVgOiBXaGVuIGEgdXNlciBoYXMgc2V0IHRoZWlyIHN0YXR1cyB0byBgb2ZmbGluZWAgdGhleSBpbnN0ZWFkIHNlZSBhIHN0YXR1cyBvZiBgaW52aXNpYmxlYCBzbyB0aGF0IHRoZXkga25vd1xuICogICAgdGhhdCB0aGV5IGhhdmUgZGVsaWJlcmF0ZWx5IHNldCB0aGVpciBzdGF0dXMgdG8gYG9mZmxpbmVgIGJ1dCBhcmUgc3RpbGwgY29ubmVjdGVkLlxuICpcbiAqIFRoaXMgcHJvcGVydHkgY2FuIG9ubHkgYmUgc2V0IG9uIHRoZSBzZXNzaW9uIG93bmVyJ3MgaWRlbnRpdHksIG5vdCBvbiBvdGhlciBpZGVudGl0aWVzIHZpYTpcbiAqXG4gKiBgYGBcbiAqIGNsaWVudC51c2VyLnNldFN0YXR1cyhsYXllci5JZGVudGl0eS5TVEFUVVMuQVZBSUxBQkxFKTtcbiAqIGBgYFxuICpcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBzdGF0dXNcbiAqIEByZWFkb25seVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSWRlbnRpdHkucHJvdG90eXBlLCAnc3RhdHVzJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gKHRoaXMuX3ByZXNlbmNlICYmIHRoaXMuX3ByZXNlbmNlLnN0YXR1cykgfHwgSWRlbnRpdHkuU1RBVFVTLk9GRkxJTkU7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIHVzZXIgd2FzIGxhc3Qga25vd24gdG8gYmUgb25saW5lLlxuICpcbiAqIEFjY3VyYXRlIHRvIHdpdGhpbiBhYm91dCAxNSBtaW51dGVzLiAgVXNlcidzIHdobyBhcmUgb25saW5lLCBidXQgc2V0IHRoZWlyIHN0YXR1c1xuICogdG8gYGxheWVyLklkZW50aXR5LlNUQVRVUy5JTlZJU0lCTEVgIHdpbGwgbm90IGhhdmUgdGhlaXIgYGxhc3RTZWVuQXRgIHZhbHVlIHVwZGF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtEYXRlfSBsYXN0U2VlbkF0XG4gKiBAcmVhZG9ubHlcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KElkZW50aXR5LnByb3RvdHlwZSwgJ2xhc3RTZWVuQXQnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiB0aGlzLl9wcmVzZW5jZSAmJiB0aGlzLl9wcmVzZW5jZS5sYXN0U2VlbkF0O1xuICB9LFxufSk7XG5cbi8qKlxuICogSXMgdGhpcyBJZGVudGl0eSBhIGJvdD9cbiAqXG4gKiBJZiB0aGUgbGF5ZXIuSWRlbnRpdHkudHlwZSBmaWVsZCBpcyBlcXVhbCB0byBsYXllci5JZGVudGl0eS5Cb3RUeXBlIHRoZW4gdGhpcyB3aWxsIHJldHVybiB0cnVlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBpc0JvdFxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSWRlbnRpdHkucHJvdG90eXBlLCAnaXNCb3QnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IElkZW50aXR5LkJvdFR5cGU7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBQb3NzaWJsZSB2YWx1ZXMgZm9yIGxheWVyLklkZW50aXR5LnN0YXR1cyBmaWVsZCB0byBiZSB1c2VkIGluIGBzZXRTdGF0dXMoKWBcbiAqXG4gKiBAcHJvcGVydHkge09iamVjdH0gU1RBVFVTXG4gKiBAcHJvcGVydHkge1N0cmluZ30gU1RBVFVTLkFWQUlMQUJMRSAgIFVzZXIgaGFzIHNldCB0aGVpciBzdGF0dXMgdG8gYGF2YWlsYWJsZWAuICBUaGlzIGlzIHRoZSBkZWZhdWx0IGluaXRpYWwgc3RhdGVcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBTVEFUVVMuQVdBWSAgICAgICAgQXBwIG9yIFVzZXIgaGFzIGNoYW5nZWQgdGhlaXIgc3RhdHVzIHRvIGBhd2F5YFxuICogQHByb3BlcnR5IHtTdHJpbmd9IFNUQVRVUy5CVVNZICAgICBBcHAgb3IgVXNlciBoYXMgY2hhbmdlZCB0aGVpciBzdGF0dXMgdG8gYGJ1c3lgXG4gKiBAcHJvcGVydHkge1N0cmluZ30gU1RBVFVTLk9GRkxJTkUgIFVzZXIgaXMgbm90IGNvbm5lY3RlZCBvciBoYXMgc2V0IHRoZWlyIHN0YXR1cyB0byBgb2ZmbGluZWBcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBTVEFUVVMuSU5WSVNJQkxFICBXaGVuIGEgdXNlciBoYXMgc2V0IHRoZWlyIHN0YXR1cyB0byBgb2ZmbGluZWAgdGhleSBpbnN0ZWFkIHNlZSBhIHN0YXR1cyBvZiBgaW52aXNpYmxlYCBzbyB0aGF0IHRoZXkga25vd1xuICogICAgdGhhdCB0aGV5IGhhdmUgZGVsaWJlcmF0ZWx5IHNldCB0aGVpciBzdGF0dXMgdG8gYG9mZmxpbmVgIGJ1dCBhcmUgc3RpbGwgY29ubmVjdGVkLlxuICogQHN0YXRpY1xuICovXG5JZGVudGl0eS5TVEFUVVMgPSB7XG4gIEFWQUlMQUJMRTogJ2F2YWlsYWJsZScsXG4gIEFXQVk6ICdhd2F5JyxcbiAgT0ZGTElORTogJ29mZmxpbmUnLFxuICBCVVNZOiAnYnVzeScsXG4gIElOVklTSUJMRTogJ2ludmlzaWJsZScsXG59O1xuXG5JZGVudGl0eS5pbk9iamVjdElnbm9yZSA9IFJvb3QuaW5PYmplY3RJZ25vcmU7XG5cbklkZW50aXR5LmJ1YmJsZUV2ZW50UGFyZW50ID0gJ2dldENsaWVudCc7XG5cbklkZW50aXR5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gICdpZGVudGl0aWVzOmNoYW5nZScsXG4gICdpZGVudGl0aWVzOmxvYWRlZCcsXG4gICdpZGVudGl0aWVzOmxvYWRlZC1lcnJvcicsXG4gICdpZGVudGl0aWVzOnVuZm9sbG93Jyxcbl0uY29uY2F0KFN5bmNhYmxlLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5JZGVudGl0eS5ldmVudFByZWZpeCA9ICdpZGVudGl0aWVzJztcbklkZW50aXR5LnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vaWRlbnRpdGllcy8nO1xuSWRlbnRpdHkuZW5hYmxlT3BzSWZOZXcgPSB0cnVlO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShJZGVudGl0eSwgW0lkZW50aXR5LCAnSWRlbnRpdHknXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goSWRlbnRpdHkpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IElkZW50aXR5O1xuIl19
