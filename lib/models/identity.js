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
var Constants = require('../const');
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
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      this.userId = identity.user_id || '';

      this._updateValue('avatarUrl', identity.avatar_url);
      this._updateValue('displayName', identity.display_name);

      var isFullIdentity = 'metadata' in identity;

      // Handle Full Identity vs Basic Identity
      if (isFullIdentity) {
        this.url = identity.url;
        this.type = identity.type;

        this._updateValue('emailAddress', identity.email_address);
        this._updateValue('lastName', identity.last_name);
        this._updateValue('firstName', identity.first_name);
        this._updateValue('metadata', identity.metadata);
        this._updateValue('publicKey', identity.public_key);
        this._updateValue('phoneNumber', identity.phone_number);
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
     * @param {string} key - Property name
     * @param {Mixed} value - Property value
     */

  }, {
    key: '_updateValue',
    value: function _updateValue(key, value) {
      if (value === null || value === undefined) value = '';
      if (this[key] !== value) {
        if (!this.isInitializing) {
          this._triggerAsync('identities:change', {
            property: key,
            oldValue: this[key],
            newValue: value
          });
        }
        this[key] = value;
      }
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
      var _this3 = this;

      if (this.isFullIdentity) return;
      this._xhr({
        method: 'PUT',
        url: this.url.replace(/identities/, 'following/users'),
        syncable: {}
      }, function (result) {
        if (result.success) _this3._load();
      });
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
      var _this4 = this;

      this.getClient().dbManager.deleteObjects('identities', [this]);
      ['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'metadata', 'publicKey', 'isFullIdentity', 'type'].forEach(function (key) {
        return delete _this4[key];
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
 * Is this Identity a bot?
 *
 * If the layer.Identity.type field is equal to layer.Identity.BotType then this will return true.
 * @type {boolean}
 */
Object.defineProperty(Identity.prototype, 'isBot', {
  enumerable: true,
  get: function get() {
    return this.type === Identity.BotType;
  }
});

Identity.inObjectIgnore = Root.inObjectIgnore;

Identity.bubbleEventParent = 'getClient';

Identity._supportedEvents = ['identities:change', 'identities:loaded', 'identities:loaded-error', 'identities:unfollow'].concat(Syncable._supportedEvents);

Identity.eventPrefix = 'identities';
Identity.prefixUUID = 'layer:///identities/';
Identity.enableOpsIfNew = true;

Root.initClass.apply(Identity, [Identity, 'Identity']);
Syncable.subclasses.push(Identity);

module.exports = Identity;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvaWRlbnRpdHkuanMiXSwibmFtZXMiOlsiU3luY2FibGUiLCJyZXF1aXJlIiwiUm9vdCIsIkNvbnN0YW50cyIsIkxheWVyRXJyb3IiLCJJZGVudGl0eSIsIm9wdGlvbnMiLCJmcm9tU2VydmVyIiwiaWQiLCJ1c2VySWQiLCJwcmVmaXhVVUlEIiwiZW5jb2RlVVJJQ29tcG9uZW50Iiwic3Vic3RyaW5nIiwibGVuZ3RoIiwiY2xpZW50IiwiY2xpZW50SWQiLCJhcHBJZCIsIkVycm9yIiwiZGljdGlvbmFyeSIsImNsaWVudE1pc3NpbmciLCJpc0luaXRpYWxpemluZyIsIl9wb3B1bGF0ZUZyb21TZXJ2ZXIiLCJ1cmwiLCJnZXRDbGllbnQiLCJfYWRkSWRlbnRpdHkiLCJfcmVtb3ZlSWRlbnRpdHkiLCJldnROYW1lIiwiYXJncyIsIl9jbGVhck9iamVjdCIsImlkZW50aXR5IiwiX2Rpc2FibGVFdmVudHMiLCJzeW5jU3RhdGUiLCJTWU5DX1NUQVRFIiwiTkVXIiwiX3NldFN5bmNlZCIsInVzZXJfaWQiLCJfdXBkYXRlVmFsdWUiLCJhdmF0YXJfdXJsIiwiZGlzcGxheV9uYW1lIiwiaXNGdWxsSWRlbnRpdHkiLCJ0eXBlIiwiZW1haWxfYWRkcmVzcyIsImxhc3RfbmFtZSIsImZpcnN0X25hbWUiLCJtZXRhZGF0YSIsInB1YmxpY19rZXkiLCJwaG9uZV9udW1iZXIiLCJpc0F1dGhlbnRpY2F0ZWQiLCJkYk1hbmFnZXIiLCJnZXRPYmplY3RzIiwicmVzdWx0Iiwia2V5IiwidmFsdWUiLCJ1bmRlZmluZWQiLCJfdHJpZ2dlckFzeW5jIiwicHJvcGVydHkiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiX3hociIsIm1ldGhvZCIsInJlcGxhY2UiLCJzeW5jYWJsZSIsInN1Y2Nlc3MiLCJfbG9hZCIsIl9fdXNlcklkIiwiZW5jb2RlZCIsImNhbnRDaGFuZ2VVc2VySWQiLCJkYXRhIiwiZGVsZXRlT2JqZWN0cyIsImZvckVhY2giLCJfZnJvbURCIiwicHJvdG90eXBlIiwiZGlzcGxheU5hbWUiLCJzZXNzaW9uT3duZXIiLCJhdmF0YXJVcmwiLCJmaXJzdE5hbWUiLCJsYXN0TmFtZSIsImVtYWlsQWRkcmVzcyIsInBob25lTnVtYmVyIiwicHVibGljS2V5IiwiVXNlclR5cGUiLCJCb3RUeXBlIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiZ2V0IiwiaW5PYmplY3RJZ25vcmUiLCJidWJibGVFdmVudFBhcmVudCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJldmVudFByZWZpeCIsImVuYWJsZU9wc0lmTmV3IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJzdWJjbGFzc2VzIiwicHVzaCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7QUFTQTs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxJQUFNQSxXQUFXQyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNQyxPQUFPRCxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1FLFlBQVlGLFFBQVEsVUFBUixDQUFsQjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7O0lBRU1JLFE7OztBQUNKLHNCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQSxRQUFJQSxRQUFRQyxVQUFaLEVBQXdCO0FBQ3RCRCxjQUFRRSxFQUFSLEdBQWFGLFFBQVFDLFVBQVIsQ0FBbUJDLEVBQW5CLElBQXlCLEdBQXRDO0FBQ0QsS0FGRCxNQUVPLElBQUksQ0FBQ0YsUUFBUUUsRUFBVCxJQUFlRixRQUFRRyxNQUEzQixFQUFtQztBQUN4Q0gsY0FBUUUsRUFBUixHQUFhSCxTQUFTSyxVQUFULEdBQXNCQyxtQkFBbUJMLFFBQVFHLE1BQTNCLENBQW5DO0FBQ0QsS0FGTSxNQUVBLElBQUlILFFBQVFFLEVBQVIsSUFBYyxDQUFDRixRQUFRRyxNQUEzQixFQUFtQztBQUN4Q0gsY0FBUUcsTUFBUixHQUFpQkgsUUFB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QXBCOztBQUVBOzs7O0FBSUEzRSxTQUFTNEUsT0FBVCxHQUFtQixLQUFuQjs7QUFFQTs7Ozs7OztBQU9BNUUsU0FBU2tFLFNBQVQsQ0FBbUIvQixJQUFuQixHQUEwQm5DLFNBQVMyRSxRQUFuQzs7QUFFQTs7Ozs7O0FBTUFFLE9BQU9DLGNBQVAsQ0FBc0I5RSxTQUFTa0UsU0FBL0IsRUFBMEMsT0FBMUMsRUFBbUQ7QUFDakRhLGNBQVksSUFEcUM7QUFFakRDLE9BQUssU0FBU0EsR0FBVCxHQUFlO0FBQ2xCLFdBQU8sS0FBSzdDLElBQUwsS0FBY25DLFNBQVM0RSxPQUE5QjtBQUNEO0FBSmdELENBQW5EOztBQU9BNUUsU0FBU2lGLGNBQVQsR0FBMEJwRixLQUFLb0YsY0FBL0I7O0FBRUFqRixTQUFTa0YsaUJBQVQsR0FBNkIsV0FBN0I7O0FBRUFsRixTQUFTbUYsZ0JBQVQsR0FBNEIsQ0FDMUIsbUJBRDBCLEVBRTFCLG1CQUYwQixFQUcxQix5QkFIMEIsRUFJMUIscUJBSjBCLEVBSzFCQyxNQUwwQixDQUtuQnpGLFNBQVN3RixnQkFMVSxDQUE1Qjs7QUFPQW5GLFNBQVNxRixXQUFULEdBQXVCLFlBQXZCO0FBQ0FyRixTQUFTSyxVQUFULEdBQXNCLHNCQUF0QjtBQUNBTCxTQUFTc0YsY0FBVCxHQUEwQixJQUExQjs7QUFFQXpGLEtBQUswRixTQUFMLENBQWVDLEtBQWYsQ0FBcUJ4RixRQUFyQixFQUErQixDQUFDQSxRQUFELEVBQVcsVUFBWCxDQUEvQjtBQUNBTCxTQUFTOEYsVUFBVCxDQUFvQkMsSUFBcEIsQ0FBeUIxRixRQUF6Qjs7QUFFQTJGLE9BQU9DLE9BQVAsR0FBaUI1RixRQUFqQiIsImZpbGUiOiJpZGVudGl0eS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIElkZW50aXR5IGNsYXNzIHJlcHJlc2VudHMgYW4gSWRlbnRpdHkgb2YgYSB1c2VyIG9mIHlvdXIgYXBwbGljYXRpb24uXG4gKlxuICogSWRlbnRpdGllcyBhcmUgY3JlYXRlZCBieSB0aGUgU3lzdGVtLCBuZXZlciBkaXJlY3RseSBieSBhcHBzLlxuICpcbiAqIEBjbGFzcyBsYXllci5JZGVudGl0eVxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqL1xuXG4vKlxuICogSG93IElkZW50aXRpZXMgZml0IGludG8gdGhlIHN5c3RlbTpcbiAqXG4gKiAxLiBBcyBwYXJ0IG9mIGluaXRpYWxpemF0aW9uLCBsb2FkIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIncyBmdWxsIElkZW50aXR5IHJlY29yZCBzbyB0aGF0IHRoZSBDbGllbnQga25vd3MgbW9yZSB0aGFuIGp1c3QgdGhlIGB1c2VySWRgIG9mIGl0cyB1c2VyLlxuICogICAgY2xpZW50LnVzZXIgPSA8SWRlbnRpdHk+XG4gKiAyLiBBbnkgdGltZSB3ZSBnZXQgYSBCYXNpYyBJZGVudGl0eSB2aWEgYG1lc3NhZ2Uuc2VuZGVyYCBvciBDb252ZXJzYXRpb25zLCBzZWUgaWYgd2UgaGF2ZSBhbiBJZGVudGl0eSBmb3IgdGhhdCBzZW5kZXIsXG4gKiAgICBhbmQgaWYgbm90IGNyZWF0ZSBvbmUgdXNpbmcgdGhlIEJhc2ljIElkZW50aXR5LiAgVGhlcmUgc2hvdWxkIG5ldmVyIGJlIGEgZHVwbGljYXRlIElkZW50aXR5LlxuICogMy4gV2Vic29ja2V0IENIQU5HRSBldmVudHMgd2lsbCB1cGRhdGUgSWRlbnRpdHkgb2JqZWN0cywgYXMgd2VsbCBhcyBhZGQgbmV3IEZ1bGwgSWRlbnRpdGllcywgYW5kIGRvd25ncmFkZSBGdWxsIElkZW50aXRpZXMgdG8gQmFzaWMgSWRlbnRpdGllcy5cbiAqIDQuIFRoZSBRdWVyeSBBUEkgc3VwcG9ydHMgcXVlcnlpbmcgYW5kIHBhZ2luZyB0aHJvdWdoIElkZW50aXRpZXNcbiAqIDUuIFRoZSBRdWVyeSBBUEkgbG9hZHMgRnVsbCBJZGVudGl0aWVzOyB0aGVzZSByZXN1bHRzIHdpbGwgdXBkYXRlIHRoZSBjbGllbnQuX21vZGVscy5pZGVudGl0aWVzO1xuICogICAgdXBncmFkaW5nIEJhc2ljIElkZW50aXRpZXMgaWYgdGhleSBtYXRjaCwgYW5kIGFkZGluZyBuZXcgSWRlbnRpdGllcyBpZiB0aGV5IGRvbid0LlxuICogNi4gRGJNYW5hZ2VyIHdpbGwgcGVyc2lzdCBvbmx5IFVzZXJJZGVudGl0aWVzLCBhbmQgb25seSB0aG9zZSB0aGF0IGFyZSBGdWxsIElkZW50aXRpZXMuICBCYXNpYyBJZGVudGl0aWVzIHdpbGwgYmUgd3JpdHRlblxuICogICAgdG8gdGhlIE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb25zIHRhYmxlcyBhbnl3YXlzIGFzIHBhcnQgb2YgdGhvc2UgbGFyZ2VyIG9iamVjdHMuXG4gKiA3LiBBUEkgRm9yIGV4cGxpY2l0IGZvbGxvd3MvdW5mb2xsb3dzXG4gKi9cblxuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuXG5jbGFzcyBJZGVudGl0eSBleHRlbmRzIFN5bmNhYmxlIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoZSBJRCBmcm9tIGhhbmRsZSBmcm9tU2VydmVyIHBhcmFtZXRlciBpcyB1c2VkIGJ5IHRoZSBSb290LmNvbnN0cnVjdG9yXG4gICAgaWYgKG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgb3B0aW9ucy5pZCA9IG9wdGlvbnMuZnJvbVNlcnZlci5pZCB8fCAnLSc7XG4gICAgfSBlbHNlIGlmICghb3B0aW9ucy5pZCAmJiBvcHRpb25zLnVzZXJJZCkge1xuICAgICAgb3B0aW9ucy5pZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQob3B0aW9ucy51c2VySWQpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5pZCAmJiAhb3B0aW9ucy51c2VySWQpIHtcbiAgICAgIG9wdGlvbnMudXNlcklkID0gb3B0aW9ucy5pZC5zdWJzdHJpbmcoSWRlbnRpdHkucHJlZml4VVVJRC5sZW5ndGgpO1xuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGNsaWVudElkIHByb3BlcnR5XG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBUaGUgLSBpcyBoZXJlIHRvIHByZXZlbnQgUm9vdCBmcm9tIGdlbmVyYXRpbmcgYSBVVUlEIGZvciBhbiBJRC4gIElEIG11c3QgbWFwIHRvIFVzZXJJRFxuICAgIC8vIGFuZCBjYW4ndCBiZSByYW5kb21seSBnZW5lcmF0ZWQuICBUaGlzIG9ubHkgb2NjdXJzIGZyb20gUGxhdGZvcm0gQVBJIHNlbmRpbmcgd2l0aCBgc2VuZGVyLm5hbWVgIGFuZCBubyBpZGVudGl0eS5cbiAgICBpZiAodGhpcy5pZCA9PT0gJy0nKSB0aGlzLmlkID0gJyc7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zIGNvbnRhaW5zIGEgZnVsbCBzZXJ2ZXIgZGVmaW5pdGlvbiBvZiB0aGUgb2JqZWN0LFxuICAgIC8vIGNvcHkgaXQgaW4gd2l0aCBfcG9wdWxhdGVGcm9tU2VydmVyOyB0aGlzIHdpbGwgYWRkIHRoZSBJZGVudGl0eVxuICAgIC8vIHRvIHRoZSBDbGllbnQgYXMgd2VsbC5cbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihvcHRpb25zLmZyb21TZXJ2ZXIpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51cmwgJiYgdGhpcy5pZCkge1xuICAgICAgdGhpcy51cmwgPSBgJHt0aGlzLmdldENsaWVudCgpLnVybH0vJHt0aGlzLmlkLnN1YnN0cmluZyg5KX1gO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMudXJsKSB7XG4gICAgICB0aGlzLnVybCA9ICcnO1xuICAgIH1cbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRJZGVudGl0eSh0aGlzKTtcblxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBpZiAoY2xpZW50KSBjbGllbnQuX3JlbW92ZUlkZW50aXR5KHRoaXMpO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhpcyBpbnN0YW5jZSB1c2luZyBzZXJ2ZXItZGF0YS5cbiAgICpcbiAgICogU2lkZSBlZmZlY3RzIGFkZCB0aGlzIHRvIHRoZSBDbGllbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGlkZW50aXR5IC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBpZGVudGl0eVxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihpZGVudGl0eSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICAvLyBEaXNhYmxlIGV2ZW50cyBpZiBjcmVhdGluZyBhIG5ldyBJZGVudGl0eVxuICAgIC8vIFdlIHN0aWxsIHdhbnQgcHJvcGVydHkgY2hhbmdlIGV2ZW50cyBmb3IgYW55dGhpbmcgdGhhdCBET0VTIGNoYW5nZVxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVyk7XG5cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcblxuICAgIHRoaXMudXNlcklkID0gaWRlbnRpdHkudXNlcl9pZCB8fCAnJztcblxuICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdhdmF0YXJVcmwnLCBpZGVudGl0eS5hdmF0YXJfdXJsKTtcbiAgICB0aGlzLl91cGRhdGVWYWx1ZSgnZGlzcGxheU5hbWUnLCBpZGVudGl0eS5kaXNwbGF5X25hbWUpO1xuXG4gICAgY29uc3QgaXNGdWxsSWRlbnRpdHkgPSAnbWV0YWRhdGEnIGluIGlkZW50aXR5O1xuXG4gICAgLy8gSGFuZGxlIEZ1bGwgSWRlbnRpdHkgdnMgQmFzaWMgSWRlbnRpdHlcbiAgICBpZiAoaXNGdWxsSWRlbnRpdHkpIHtcbiAgICAgIHRoaXMudXJsID0gaWRlbnRpdHkudXJsO1xuICAgICAgdGhpcy50eXBlID0gaWRlbnRpdHkudHlwZTtcblxuICAgICAgdGhpcy5fdXBkYXRlVmFsdWUoJ2VtYWlsQWRkcmVzcycsIGlkZW50aXR5LmVtYWlsX2FkZHJlc3MpO1xuICAgICAgdGhpcy5fdXBkYXRlVmFsdWUoJ2xhc3ROYW1lJywgaWRlbnRpdHkubGFzdF9uYW1lKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdmaXJzdE5hbWUnLCBpZGVudGl0eS5maXJzdF9uYW1lKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdtZXRhZGF0YScsIGlkZW50aXR5Lm1ldGFkYXRhKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdwdWJsaWNLZXknLCBpZGVudGl0eS5wdWJsaWNfa2V5KTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdwaG9uZU51bWJlcicsIGlkZW50aXR5LnBob25lX251bWJlcik7XG4gICAgICB0aGlzLmlzRnVsbElkZW50aXR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudXJsICYmIHRoaXMuaWQpIHtcbiAgICAgIHRoaXMudXJsID0gdGhpcy5nZXRDbGllbnQoKS51cmwgKyB0aGlzLmlkLnN1YnN0cmluZyg4KTtcbiAgICB9XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG5cbiAgICAvLyBTZWUgaWYgd2UgaGF2ZSB0aGUgRnVsbCBJZGVudGl0eSBPYmplY3QgaW4gZGF0YWJhc2VcbiAgICBpZiAoIXRoaXMuaXNGdWxsSWRlbnRpdHkgJiYgY2xpZW50LmlzQXV0aGVudGljYXRlZCkge1xuICAgICAgY2xpZW50LmRiTWFuYWdlci5nZXRPYmplY3RzKCdpZGVudGl0aWVzJywgW3RoaXMuaWRdLCAocmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChyZXN1bHQubGVuZ3RoKSB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIocmVzdWx0WzBdKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHByb3BlcnR5OyB0cmlnZ2VyIGEgY2hhbmdlIGV2ZW50LCBJRiB0aGUgdmFsdWUgaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVZhbHVlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBQcm9wZXJ0eSBuYW1lXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIC0gUHJvcGVydHkgdmFsdWVcbiAgICovXG4gIF91cGRhdGVWYWx1ZShrZXksIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHZhbHVlID0gJyc7XG4gICAgaWYgKHRoaXNba2V5XSAhPT0gdmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZykge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2lkZW50aXRpZXM6Y2hhbmdlJywge1xuICAgICAgICAgIHByb3BlcnR5OiBrZXksXG4gICAgICAgICAgb2xkVmFsdWU6IHRoaXNba2V5XSxcbiAgICAgICAgICBuZXdWYWx1ZTogdmFsdWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpc1trZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZvbGxvdyB0aGlzIFVzZXIuXG4gICAqXG4gICAqIEZvbGxvd2luZyBhIHVzZXIgZ3JhbnRzIGFjY2VzcyB0byB0aGVpciBGdWxsIElkZW50aXR5LFxuICAgKiBhcyB3ZWxsIGFzIHdlYnNvY2tldCBldmVudHMgdGhhdCB1cGRhdGUgdGhlIElkZW50aXR5LlxuICAgKiBAbWV0aG9kIGZvbGxvd1xuICAgKi9cbiAgZm9sbG93KCkge1xuICAgIGlmICh0aGlzLmlzRnVsbElkZW50aXR5KSByZXR1cm47XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICB1cmw6IHRoaXMudXJsLnJlcGxhY2UoL2lkZW50aXRpZXMvLCAnZm9sbG93aW5nL3VzZXJzJyksXG4gICAgICBzeW5jYWJsZToge30sXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVW5mb2xsb3cgdGhpcyBVc2VyLlxuICAgKlxuICAgKiBVbmZvbGxvd2luZyB0aGUgdXNlciB3aWxsIHJlZHVjZSB5b3VyIGFjY2VzcyB0byBvbmx5IGhhdmluZyB0aGVpciBCYXNpYyBJZGVudGl0eSxcbiAgICogYW5kIHRoaXMgQmFzaWMgSWRlbnRpdHkgd2lsbCBvbmx5IHNob3cgdXAgd2hlbiBhIHJlbGV2YW50IE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGxvYWRlZC5cbiAgICpcbiAgICogV2Vic29ja2V0IGNoYW5nZSBub3RpZmljYXRpb25zIGZvciB0aGlzIHVzZXIgd2lsbCBub3QgYXJyaXZlLlxuICAgKlxuICAgKiBAbWV0aG9kIHVuZm9sbG93XG4gICAqL1xuICB1bmZvbGxvdygpIHtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiB0aGlzLnVybC5yZXBsYWNlKC9pZGVudGl0aWVzLywgJ2ZvbGxvd2luZy91c2VycycpLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHN5bmNhYmxlOiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gLyoqXG4gKiBVcGRhdGUgdGhlIFVzZXJJRC5cbiAqXG4gKiBUaGlzIHdpbGwgbm90IG9ubHkgdXBkYXRlIHRoZSBVc2VyIElELCBidXQgYWxzbyB0aGUgSUQsXG4gKiBVUkwsIGFuZCByZXJlZ2lzdGVyIGl0IHdpdGggdGhlIENsaWVudC5cbiAqXG4gKiBAbWV0aG9kIF9zZXRVc2VySWRcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30gdXNlcklkXG4gKi9cbiAgX3NldFVzZXJJZCh1c2VySWQpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNsaWVudC5fcmVtb3ZlSWRlbnRpdHkodGhpcyk7XG4gICAgdGhpcy5fX3VzZXJJZCA9IHVzZXJJZDtcbiAgICBjb25zdCBlbmNvZGVkID0gZW5jb2RlVVJJQ29tcG9uZW50KHVzZXJJZCk7XG4gICAgdGhpcy5pZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVkO1xuICAgIHRoaXMudXJsID0gYCR7dGhpcy5nZXRDbGllbnQoKS51cmx9L2lkZW50aXRpZXMvJHtlbmNvZGVkfWA7XG4gICAgY2xpZW50Ll9hZGRJZGVudGl0eSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICpcbiAgKiBBbnkgYXR0ZW1wdCB0byBleGVjdXRlIGB0aGlzLnVzZXJJZCA9ICd4eHgnYCB3aWxsIGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93bi5cbiAgKiBUaGVzZSBhcmUgbm90IGludGVuZGVkIHRvIGJlIHdyaXRhYmxlIHByb3BlcnRpZXNcbiAgKlxuICAqIEBwcml2YXRlXG4gICogQG1ldGhvZCBfX2FkanVzdFVzZXJJZFxuICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIE5ldyBhcHBJZCB2YWx1ZVxuICAqL1xuICBfX2FkanVzdFVzZXJJZCh1c2VySWQpIHtcbiAgICBpZiAodGhpcy5fX3VzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jYW50Q2hhbmdlVXNlcklkKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgV2Vic29ja2V0IERFTEVURSBldmVudCByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEEgREVMRVRFIGV2ZW50IG1lYW5zIHdlIGhhdmUgdW5mb2xsb3dlZCB0aGlzIHVzZXI7IGFuZCBzaG91bGQgZG93bmdyYWRlIHRvIGEgQmFzaWMgSWRlbnRpdHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVdlYnNvY2tldERlbGV0ZVxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIC0gRGVsZXRpb24gcGFyYW1ldGVyczsgdHlwaWNhbGx5IG51bGwgaW4gdGhpcyBjYXNlLlxuICAqL1xuICAvLyBUdXJuIGEgRnVsbCBJZGVudGl0eSBpbnRvIGEgQmFzaWMgSWRlbnRpdHkgYW5kIGRlbGV0ZSB0aGUgRnVsbCBJZGVudGl0eSBmcm9tIHRoZSBkYXRhYmFzZVxuICBfaGFuZGxlV2Vic29ja2V0RGVsZXRlKGRhdGEpIHtcbiAgICB0aGlzLmdldENsaWVudCgpLmRiTWFuYWdlci5kZWxldGVPYmplY3RzKCdpZGVudGl0aWVzJywgW3RoaXNdKTtcbiAgICBbJ2ZpcnN0TmFtZScsICdsYXN0TmFtZScsICdlbWFpbEFkZHJlc3MnLCAncGhvbmVOdW1iZXInLCAnbWV0YWRhdGEnLCAncHVibGljS2V5JywgJ2lzRnVsbElkZW50aXR5JywgJ3R5cGUnXVxuICAgICAgLmZvckVhY2goa2V5ID0+IGRlbGV0ZSB0aGlzW2tleV0pO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnaWRlbnRpdGllczp1bmZvbGxvdycpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBJZGVudGl0eSBiYXNlZCBvbiBhIFNlcnZlciBkZXNjcmlwdGlvbiBvZiB0aGUgdXNlci5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpZGVudGl0eSAtIFNlcnZlciBJZGVudGl0eSBPYmplY3RcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJucyB7bGF5ZXIuSWRlbnRpdHl9XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIoaWRlbnRpdHksIGNsaWVudCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHkoe1xuICAgICAgY2xpZW50LFxuICAgICAgZnJvbVNlcnZlcjogaWRlbnRpdHksXG4gICAgICBfZnJvbURCOiBpZGVudGl0eS5fZnJvbURCLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogRGlzcGxheSBuYW1lIGZvciB0aGUgVXNlciBvciBTeXN0ZW0gSWRlbnRpdHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuZGlzcGxheU5hbWUgPSAnJztcblxuLyoqXG4gKiBUaGUgSWRlbnRpdHkgbWF0Y2hpbmcgYGxheWVyLkNsaWVudC51c2VyYCB3aWxsIGhhdmUgdGhpcyBiZSB0cnVlLlxuICpcbiAqIEFsbCBvdGhlciBJZGVudGl0aWVzIHdpbGwgaGF2ZSB0aGlzIGFzIGZhbHNlLlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5zZXNzaW9uT3duZXIgPSBmYWxzZTtcblxuLyoqXG4gKiBJRCBvZiB0aGUgQ2xpZW50IHRoaXMgSWRlbnRpdHkgaXMgYXNzb2NpYXRlZCB3aXRoLlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmNsaWVudElkID0gJyc7XG5cbi8qKlxuICogSXMgdGhpcyBhIEZ1bGwgSWRlbnRpdHkgb3IgQmFzaWMgSWRlbnRpdHk/XG4gKlxuICogTm90ZSB0aGF0IFNlcnZpY2UgSWRlbnRpdGllcyBhcmUgYWx3YXlzIGNvbnNpZGVyZWQgdG8gYmUgQmFzaWMuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmlzRnVsbElkZW50aXR5ID0gZmFsc2U7XG5cbi8qKlxuICogVW5pcXVlIElEIGZvciB0aGlzIFVzZXIuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUudXNlcklkID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgVVJMIGZvciB0aGUgdXNlcidzIGljb24uXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuYXZhdGFyVXJsID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgZmlyc3QgbmFtZSBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIEZ1bGwgSWRlbnRpdGllcyBPbmx5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5maXJzdE5hbWUgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBsYXN0IG5hbWUgZm9yIHRoaXMgdXNlci5cbiAqXG4gKiBGdWxsIElkZW50aXRpZXMgT25seS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUubGFzdE5hbWUgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBlbWFpbCBhZGRyZXNzIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmVtYWlsQWRkcmVzcyA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIHBob25lIG51bWJlciBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIEZ1bGwgSWRlbnRpdGllcyBPbmx5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5waG9uZU51bWJlciA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIG1ldGFkYXRhIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLm1ldGFkYXRhID0gbnVsbDtcblxuLyoqXG4gKiBPcHRpb25hbCBwdWJsaWMga2V5IGZvciBlbmNyeXB0aW5nIG1lc3NhZ2UgdGV4dCBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIEZ1bGwgSWRlbnRpdGllcyBPbmx5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5wdWJsaWNLZXkgPSAnJztcblxuLyoqXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7c3RyaW5nfSBUaGUgSWRlbnRpdHkgcmVwcmVzZW50cyBhIHVzZXIuICBWYWx1ZSB1c2VkIGluIHRoZSBsYXllci5JZGVudGl0eS50eXBlIGZpZWxkLlxuICovXG5JZGVudGl0eS5Vc2VyVHlwZSA9ICd1c2VyJztcblxuLyoqXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7c3RyaW5nfSBUaGUgSWRlbnRpdHkgcmVwcmVzZW50cyBhIGJvdC4gIFZhbHVlIHVzZWQgaW4gdGhlIGxheWVyLklkZW50aXR5LnR5cGUgZmllbGQuXG4gKi9cbklkZW50aXR5LkJvdFR5cGUgPSAnYm90JztcblxuLyoqXG4gKiBXaGF0IHR5cGUgb2YgSWRlbnRpdHkgZG9lcyB0aGlzIHJlcHJlc2VudD9cbiAqXG4gKiAqIEEgYm90PyBVc2UgbGF5ZXIuSWRlbnRpdHkuQm90VHlwZVxuICogKiBBIFVzZXI/IFVzZSBsYXllci5JZGVudGl0eS5Vc2VyVHlwZVxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnR5cGUgPSBJZGVudGl0eS5Vc2VyVHlwZTtcblxuLyoqXG4gKiBJcyB0aGlzIElkZW50aXR5IGEgYm90P1xuICpcbiAqIElmIHRoZSBsYXllci5JZGVudGl0eS50eXBlIGZpZWxkIGlzIGVxdWFsIHRvIGxheWVyLklkZW50aXR5LkJvdFR5cGUgdGhlbiB0aGlzIHdpbGwgcmV0dXJuIHRydWUuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KElkZW50aXR5LnByb3RvdHlwZSwgJ2lzQm90Jywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJZGVudGl0eS5Cb3RUeXBlO1xuICB9LFxufSk7XG5cbklkZW50aXR5LmluT2JqZWN0SWdub3JlID0gUm9vdC5pbk9iamVjdElnbm9yZTtcblxuSWRlbnRpdHkuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuSWRlbnRpdHkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgJ2lkZW50aXRpZXM6Y2hhbmdlJyxcbiAgJ2lkZW50aXRpZXM6bG9hZGVkJyxcbiAgJ2lkZW50aXRpZXM6bG9hZGVkLWVycm9yJyxcbiAgJ2lkZW50aXRpZXM6dW5mb2xsb3cnLFxuXS5jb25jYXQoU3luY2FibGUuX3N1cHBvcnRlZEV2ZW50cyk7XG5cbklkZW50aXR5LmV2ZW50UHJlZml4ID0gJ2lkZW50aXRpZXMnO1xuSWRlbnRpdHkucHJlZml4VVVJRCA9ICdsYXllcjovLy9pZGVudGl0aWVzLyc7XG5JZGVudGl0eS5lbmFibGVPcHNJZk5ldyA9IHRydWU7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KElkZW50aXR5LCBbSWRlbnRpdHksICdJZGVudGl0eSddKTtcblN5bmNhYmxlLnN1YmNsYXNzZXMucHVzaChJZGVudGl0eSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSWRlbnRpdHk7XG4iXX0=
