'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Membership class represents an Membership of a user within a channel.
 *
 * Identities are created by the System, never directly by apps.
 *
 * @class layer.Membership
 * @experimental This feature is incomplete, and available as Preview only.
 * @extends layer.Syncable
 */

var Syncable = require('./syncable');
var Root = require('../root');
var Constants = require('../const');
var LayerError = require('../layer-error');

var Membership = function (_Syncable) {
  _inherits(Membership, _Syncable);

  function Membership() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Membership);

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) {
      options.id = options.fromServer.id;
    } else if (options.id && !options.userId) {
      options.userId = options.id.replace(/^.*\//, '');
    }

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error(LayerError.dictionary.clientMissing);

    var _this = _possibleConstructorReturn(this, (Membership.__proto__ || Object.getPrototypeOf(Membership)).call(this, options));

    _this.isInitializing = true;

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Membership
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    if (!_this.url && _this.id) {
      _this.url = _this.getClient().url + '/' + _this.id.substring(9);
    } else if (!_this.url) {
      _this.url = '';
    }
    _this.getClient()._addMembership(_this);

    _this.isInitializing = false;
    return _this;
  }

  _createClass(Membership, [{
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeMembership(this);
      _get(Membership.prototype.__proto__ || Object.getPrototypeOf(Membership.prototype), 'destroy', this).call(this);
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Membership.prototype.__proto__ || Object.getPrototypeOf(Membership.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Membership.prototype.__proto__ || Object.getPrototypeOf(Membership.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} membership - Server representation of the membership
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(membership) {
      var _this2 = this;

      var client = this.getClient();

      // Disable events if creating a new Membership
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      this.userId = membership.identity ? membership.identity.user_id || '' : client.user.userId;
      this.channelId = membership.channel.id;

      // this.role = client._createObject(membership.role);

      this.identity = membership.identity ? client._createObject(membership.identity) : client.user;
      this.identity.on('identities:change', function (evt) {
        _this2.trigger('members:change', {
          property: 'identity'
        });
      }, this);

      if (!this.url && this.id) {
        this.url = this.getClient().url + this.id.substring(8);
      }

      this._disableEvents = false;
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
          this._triggerAsync('members:change', {
            property: key,
            oldValue: this[key],
            newValue: value
          });
        }
        this[key] = value;
      }
    }
  }, {
    key: '__getUserId',
    value: function __getUserId() {
      return this.identity ? this.identity.userId : '';
    }
  }, {
    key: '__updateIdentity',
    value: function __updateIdentity(newIdentity, oldIdentity) {
      if (oldIdentity) oldIdentity.off(null, null, this);
    }

    /**
     * Create a new Membership based on a Server description of the user.
     *
     * @method _createFromServer
     * @static
     * @param {Object} membership - Server Membership Object
     * @param {layer.Client} client
     * @returns {layer.Membership}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(membership, client) {
      return new Membership({
        client: client,
        fromServer: membership,
        _fromDB: membership._fromDB
      });
    }
  }]);

  return Membership;
}(Syncable);

/**
 * User ID that the Membership describes.
 *
 * @type {string}
 */


Membership.prototype.userId = '';

/**
 * Channel ID that the membership describes.
 *
 * @type {string}
 */
Membership.prototype.channelId = '';

/**
 * The user's role within the channel
 *
 * @ignore
 * @type {layer.Role}
 */
Membership.prototype.role = null;

/**
 * Identity associated with the membership
 *
 * @type {layer.Identity}
 */
Membership.prototype.identity = '';

Membership.inObjectIgnore = Root.inObjectIgnore;

Membership.bubbleEventParent = 'getClient';

Membership._supportedEvents = ['members:change', 'members:loaded', 'members:loaded-error'].concat(Syncable._supportedEvents);

Membership.eventPrefix = 'members';
Membership.prefixUUID = '/members/';

Root.initClass.apply(Membership, [Membership, 'Membership']);
Syncable.subclasses.push(Membership);

module.exports = Membership;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVtYmVyc2hpcC5qcyJdLCJuYW1lcyI6WyJTeW5jYWJsZSIsInJlcXVpcmUiLCJSb290IiwiQ29uc3RhbnRzIiwiTGF5ZXJFcnJvciIsIk1lbWJlcnNoaXAiLCJvcHRpb25zIiwiZnJvbVNlcnZlciIsImlkIiwidXNlcklkIiwicmVwbGFjZSIsImNsaWVudCIsImNsaWVudElkIiwiYXBwSWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiaXNJbml0aWFsaXppbmciLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwidXJsIiwiZ2V0Q2xpZW50Iiwic3Vic3RyaW5nIiwiX2FkZE1lbWJlcnNoaXAiLCJfcmVtb3ZlTWVtYmVyc2hpcCIsImV2dE5hbWUiLCJhcmdzIiwiX2NsZWFyT2JqZWN0IiwibWVtYmVyc2hpcCIsIl9kaXNhYmxlRXZlbnRzIiwic3luY1N0YXRlIiwiU1lOQ19TVEFURSIsIk5FVyIsIl9zZXRTeW5jZWQiLCJpZGVudGl0eSIsInVzZXJfaWQiLCJ1c2VyIiwiY2hhbm5lbElkIiwiY2hhbm5lbCIsIl9jcmVhdGVPYmplY3QiLCJvbiIsImV2dCIsInRyaWdnZXIiLCJwcm9wZXJ0eSIsImtleSIsInZhbHVlIiwidW5kZWZpbmVkIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJuZXdJZGVudGl0eSIsIm9sZElkZW50aXR5Iiwib2ZmIiwiX2Zyb21EQiIsInByb3RvdHlwZSIsInJvbGUiLCJpbk9iamVjdElnbm9yZSIsImJ1YmJsZUV2ZW50UGFyZW50IiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImV2ZW50UHJlZml4IiwicHJlZml4VVVJRCIsImluaXRDbGFzcyIsImFwcGx5Iiwic3ViY2xhc3NlcyIsInB1c2giLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7OztBQVVBLElBQU1BLFdBQVdDLFFBQVEsWUFBUixD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QixFQUE5Qjs7QUFFQTs7Ozs7QUFLQUosV0FBV2dELFNBQVgsQ0FBcUJqQixTQUFyQixHQUFpQyxFQUFqQzs7QUFFQTs7Ozs7O0FBTUEvQixXQUFXZ0QsU0FBWCxDQUFxQkMsSUFBckIsR0FBNEIsSUFBNUI7O0FBRUE7Ozs7O0FBS0FqRCxXQUFXZ0QsU0FBWCxDQUFxQnBCLFFBQXJCLEdBQWdDLEVBQWhDOztBQUVBNUIsV0FBV2tELGNBQVgsR0FBNEJyRCxLQUFLcUQsY0FBakM7O0FBRUFsRCxXQUFXbUQsaUJBQVgsR0FBK0IsV0FBL0I7O0FBRUFuRCxXQUFXb0QsZ0JBQVgsR0FBOEIsQ0FDNUIsZ0JBRDRCLEVBRTVCLGdCQUY0QixFQUc1QixzQkFINEIsRUFJNUJDLE1BSjRCLENBSXJCMUQsU0FBU3lELGdCQUpZLENBQTlCOztBQU1BcEQsV0FBV3NELFdBQVgsR0FBeUIsU0FBekI7QUFDQXRELFdBQVd1RCxVQUFYLEdBQXdCLFdBQXhCOztBQUVBMUQsS0FBSzJELFNBQUwsQ0FBZUMsS0FBZixDQUFxQnpELFVBQXJCLEVBQWlDLENBQUNBLFVBQUQsRUFBYSxZQUFiLENBQWpDO0FBQ0FMLFNBQVMrRCxVQUFULENBQW9CQyxJQUFwQixDQUF5QjNELFVBQXpCOztBQUVBNEQsT0FBT0MsT0FBUCxHQUFpQjdELFVBQWpCIiwiZmlsZSI6Im1lbWJlcnNoaXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBNZW1iZXJzaGlwIGNsYXNzIHJlcHJlc2VudHMgYW4gTWVtYmVyc2hpcCBvZiBhIHVzZXIgd2l0aGluIGEgY2hhbm5lbC5cbiAqXG4gKiBJZGVudGl0aWVzIGFyZSBjcmVhdGVkIGJ5IHRoZSBTeXN0ZW0sIG5ldmVyIGRpcmVjdGx5IGJ5IGFwcHMuXG4gKlxuICogQGNsYXNzIGxheWVyLk1lbWJlcnNoaXBcbiAqIEBleHBlcmltZW50YWwgVGhpcyBmZWF0dXJlIGlzIGluY29tcGxldGUsIGFuZCBhdmFpbGFibGUgYXMgUHJldmlldyBvbmx5LlxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqL1xuXG5jb25zdCBTeW5jYWJsZSA9IHJlcXVpcmUoJy4vc3luY2FibGUnKTtcbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5cbmNsYXNzIE1lbWJlcnNoaXAgZXh0ZW5kcyBTeW5jYWJsZSB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgSUQgZnJvbSBoYW5kbGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIgaXMgdXNlZCBieSB0aGUgUm9vdC5jb25zdHJ1Y3RvclxuICAgIGlmIChvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIG9wdGlvbnMuaWQgPSBvcHRpb25zLmZyb21TZXJ2ZXIuaWQ7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmlkICYmICFvcHRpb25zLnVzZXJJZCkge1xuICAgICAgb3B0aW9ucy51c2VySWQgPSBvcHRpb25zLmlkLnJlcGxhY2UoL14uKlxcLy8sICcnKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBhbiBjbGllbnRJZCBwcm9wZXJ0eVxuICAgIGlmIChvcHRpb25zLmNsaWVudCkgb3B0aW9ucy5jbGllbnRJZCA9IG9wdGlvbnMuY2xpZW50LmFwcElkO1xuICAgIGlmICghb3B0aW9ucy5jbGllbnRJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGUgb3B0aW9ucyBjb250YWlucyBhIGZ1bGwgc2VydmVyIGRlZmluaXRpb24gb2YgdGhlIG9iamVjdCxcbiAgICAvLyBjb3B5IGl0IGluIHdpdGggX3BvcHVsYXRlRnJvbVNlcnZlcjsgdGhpcyB3aWxsIGFkZCB0aGUgTWVtYmVyc2hpcFxuICAgIC8vIHRvIHRoZSBDbGllbnQgYXMgd2VsbC5cbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihvcHRpb25zLmZyb21TZXJ2ZXIpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51cmwgJiYgdGhpcy5pZCkge1xuICAgICAgdGhpcy51cmwgPSBgJHt0aGlzLmdldENsaWVudCgpLnVybH0vJHt0aGlzLmlkLnN1YnN0cmluZyg5KX1gO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMudXJsKSB7XG4gICAgICB0aGlzLnVybCA9ICcnO1xuICAgIH1cbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRNZW1iZXJzaGlwKHRoaXMpO1xuXG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIGNsaWVudC5fcmVtb3ZlTWVtYmVyc2hpcCh0aGlzKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICBfdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLl90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICB0cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2UgdXNpbmcgc2VydmVyLWRhdGEuXG4gICAqXG4gICAqIFNpZGUgZWZmZWN0cyBhZGQgdGhpcyB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtZW1iZXJzaGlwIC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtZW1iZXJzaGlwXG4gICAqL1xuICBfcG9wdWxhdGVGcm9tU2VydmVyKG1lbWJlcnNoaXApIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gRGlzYWJsZSBldmVudHMgaWYgY3JlYXRpbmcgYSBuZXcgTWVtYmVyc2hpcFxuICAgIC8vIFdlIHN0aWxsIHdhbnQgcHJvcGVydHkgY2hhbmdlIGV2ZW50cyBmb3IgYW55dGhpbmcgdGhhdCBET0VTIGNoYW5nZVxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVyk7XG5cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcblxuICAgIHRoaXMudXNlcklkID0gbWVtYmVyc2hpcC5pZGVudGl0eSA/IG1lbWJlcnNoaXAuaWRlbnRpdHkudXNlcl9pZCB8fCAnJyA6IGNsaWVudC51c2VyLnVzZXJJZDtcbiAgICB0aGlzLmNoYW5uZWxJZCA9IG1lbWJlcnNoaXAuY2hhbm5lbC5pZDtcblxuICAgIC8vIHRoaXMucm9sZSA9IGNsaWVudC5fY3JlYXRlT2JqZWN0KG1lbWJlcnNoaXAucm9sZSk7XG5cbiAgICB0aGlzLmlkZW50aXR5ID0gbWVtYmVyc2hpcC5pZGVudGl0eSA/IGNsaWVudC5fY3JlYXRlT2JqZWN0KG1lbWJlcnNoaXAuaWRlbnRpdHkpIDogY2xpZW50LnVzZXI7XG4gICAgdGhpcy5pZGVudGl0eS5vbignaWRlbnRpdGllczpjaGFuZ2UnLCAoZXZ0KSA9PiB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ21lbWJlcnM6Y2hhbmdlJywge1xuICAgICAgICBwcm9wZXJ0eTogJ2lkZW50aXR5JyxcbiAgICAgIH0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLnVybCAmJiB0aGlzLmlkKSB7XG4gICAgICB0aGlzLnVybCA9IHRoaXMuZ2V0Q2xpZW50KCkudXJsICsgdGhpcy5pZC5zdWJzdHJpbmcoOCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgcHJvcGVydHk7IHRyaWdnZXIgYSBjaGFuZ2UgZXZlbnQsIElGIHRoZSB2YWx1ZSBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfdXBkYXRlVmFsdWVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFByb3BlcnR5IG5hbWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgLSBQcm9wZXJ0eSB2YWx1ZVxuICAgKi9cbiAgX3VwZGF0ZVZhbHVlKGtleSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgdmFsdWUgPSAnJztcbiAgICBpZiAodGhpc1trZXldICE9PSB2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmlzSW5pdGlhbGl6aW5nKSB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVtYmVyczpjaGFuZ2UnLCB7XG4gICAgICAgICAgcHJvcGVydHk6IGtleSxcbiAgICAgICAgICBvbGRWYWx1ZTogdGhpc1trZXldLFxuICAgICAgICAgIG5ld1ZhbHVlOiB2YWx1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICB0aGlzW2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBfX2dldFVzZXJJZCgpIHtcbiAgICByZXR1cm4gdGhpcy5pZGVudGl0eSA/IHRoaXMuaWRlbnRpdHkudXNlcklkIDogJyc7XG4gIH1cblxuICBfX3VwZGF0ZUlkZW50aXR5KG5ld0lkZW50aXR5LCBvbGRJZGVudGl0eSkge1xuICAgIGlmIChvbGRJZGVudGl0eSkgb2xkSWRlbnRpdHkub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBNZW1iZXJzaGlwIGJhc2VkIG9uIGEgU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSB1c2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtPYmplY3R9IG1lbWJlcnNoaXAgLSBTZXJ2ZXIgTWVtYmVyc2hpcCBPYmplY3RcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVtYmVyc2hpcH1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZW1iZXJzaGlwLCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IE1lbWJlcnNoaXAoe1xuICAgICAgY2xpZW50LFxuICAgICAgZnJvbVNlcnZlcjogbWVtYmVyc2hpcCxcbiAgICAgIF9mcm9tREI6IG1lbWJlcnNoaXAuX2Zyb21EQixcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIFVzZXIgSUQgdGhhdCB0aGUgTWVtYmVyc2hpcCBkZXNjcmliZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuTWVtYmVyc2hpcC5wcm90b3R5cGUudXNlcklkID0gJyc7XG5cbi8qKlxuICogQ2hhbm5lbCBJRCB0aGF0IHRoZSBtZW1iZXJzaGlwIGRlc2NyaWJlcy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZW1iZXJzaGlwLnByb3RvdHlwZS5jaGFubmVsSWQgPSAnJztcblxuLyoqXG4gKiBUaGUgdXNlcidzIHJvbGUgd2l0aGluIHRoZSBjaGFubmVsXG4gKlxuICogQGlnbm9yZVxuICogQHR5cGUge2xheWVyLlJvbGV9XG4gKi9cbk1lbWJlcnNoaXAucHJvdG90eXBlLnJvbGUgPSBudWxsO1xuXG4vKipcbiAqIElkZW50aXR5IGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVtYmVyc2hpcFxuICpcbiAqIEB0eXBlIHtsYXllci5JZGVudGl0eX1cbiAqL1xuTWVtYmVyc2hpcC5wcm90b3R5cGUuaWRlbnRpdHkgPSAnJztcblxuTWVtYmVyc2hpcC5pbk9iamVjdElnbm9yZSA9IFJvb3QuaW5PYmplY3RJZ25vcmU7XG5cbk1lbWJlcnNoaXAuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuTWVtYmVyc2hpcC5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAnbWVtYmVyczpjaGFuZ2UnLFxuICAnbWVtYmVyczpsb2FkZWQnLFxuICAnbWVtYmVyczpsb2FkZWQtZXJyb3InLFxuXS5jb25jYXQoU3luY2FibGUuX3N1cHBvcnRlZEV2ZW50cyk7XG5cbk1lbWJlcnNoaXAuZXZlbnRQcmVmaXggPSAnbWVtYmVycyc7XG5NZW1iZXJzaGlwLnByZWZpeFVVSUQgPSAnL21lbWJlcnMvJztcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVtYmVyc2hpcCwgW01lbWJlcnNoaXAsICdNZW1iZXJzaGlwJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKE1lbWJlcnNoaXApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lbWJlcnNoaXA7XG4iXX0=
