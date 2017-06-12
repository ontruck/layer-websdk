'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* Feature is tested but not available on server
 * The Membership class represents an Membership of a user within a channel.
 *
 * Identities are created by the System, never directly by apps.
 *
 * @class layer.Membership
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
      var client = this.getClient();

      // Disable events if creating a new Membership
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      this.userId = membership.identity ? membership.identity.user_id || '' : client.user.userId;
      this.channelId = membership.channel.id;

      // this.role = client._createObject(membership.role);

      this.identity = membership.identity ? client._createObject(membership.identity) : client.user;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVtYmVyc2hpcC5qcyJdLCJuYW1lcyI6WyJTeW5jYWJsZSIsInJlcXVpcmUiLCJSb290IiwiQ29uc3RhbnRzIiwiTGF5ZXJFcnJvciIsIk1lbWJlcnNoaXAiLCJvcHRpb25zIiwiZnJvbVNlcnZlciIsImlkIiwidXNlcklkIiwicmVwbGFjZSIsImNsaWVudCIsImNsaWVudElkIiwiYXBwSWQiLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwiaXNJbml0aWFsaXppbmciLCJfcG9wdWxhdGVGcm9tU2VydmVyIiwidXJsIiwiZ2V0Q2xpZW50Iiwic3Vic3RyaW5nIiwiX2FkZE1lbWJlcnNoaXAiLCJfcmVtb3ZlTWVtYmVyc2hpcCIsImV2dE5hbWUiLCJhcmdzIiwiX2NsZWFyT2JqZWN0IiwibWVtYmVyc2hpcCIsIl9kaXNhYmxlRXZlbnRzIiwic3luY1N0YXRlIiwiU1lOQ19TVEFURSIsIk5FVyIsIl9zZXRTeW5jZWQiLCJpZGVudGl0eSIsInVzZXJfaWQiLCJ1c2VyIiwiY2hhbm5lbElkIiwiY2hhbm5lbCIsIl9jcmVhdGVPYmplY3QiLCJrZXkiLCJ2YWx1ZSIsInVuZGVmaW5lZCIsIl90cmlnZ2VyQXN5bmMiLCJwcm9wZXJ0eSIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJfZnJvbURCIiwicHJvdG90eXBlIiwicm9sZSIsImluT2JqZWN0SWdub3JlIiwiYnViYmxlRXZlbnRQYXJlbnQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiZXZlbnRQcmVmaXgiLCJwcmVmaXhVVUlEIiwiaW5pdENsYXNzIiwiYXBwbHkiLCJzdWJjbGFzc2VzIiwicHVzaCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7QUFTQSxJQUFNQSxXQUFXQyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNQyxPQUFPRCxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1FLFlBQVlGLFFBQVEsVUFBUixDQUFsQjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7O0lBRU1JLFU7OztBQUNKLHdCQUEwQjtBQUFBLFFBQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQSxRQUFJQSxRQUFRQyxVQUFaLEVBQXdCO0FBQ3RCRCxjQUFRRSxFQUFSLEdBQWFGLFFBQVFDLFVBQVIsQ0FBbUJDLEVBQWhDO0FBQ0QsS0FGRCxNQUVPLElBQUlGLFFBQVFFLEVBQVIsSUFBYyxDQUFDRixRQUFRRyxNQUEzQixFQUFtQztBQUN4Q0gsY0FBUUcsTUFBUixHQUFpQkgsUUFBUUUsRUFBUixDQUFXRSxPQUFYLENBQW1CLE9BQW5CLEVBQTRCLEVBQTVCLENBQWpCO0FBQ0Q7O0FBRUQ7QUFDQSxRQUFJSixRQUFRSyxNQUFaLEVBQW9CTCxRQUFRTSxRQUFSLEdBQW1CTixRQUFRSyxNQUFSLENBQWVFLEtBQWxDO0FBQ3BCLFFBQUksQ0FBQ1AsUUFBUU0sUUFBYixFQUF1QixNQUFNLElBQUlFLEtBQUosQ0FBVVYsV0FBV1csVUFBWCxDQUFzQkMsYUFBaEMsQ0FBTjs7QUFWQyx3SEFZbEJWLE9BWmtCOztBQWN4QixVQUFLVyxjQUFMLEdBQXNCLElBQXRCOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFFBQUlYLFdBQVdBLFFBQVFDLFVBQXZCLEVBQW1DO0FBQ2pDLFlBQUtXLG1CQUFMLENBQXlCWixRQUFRQyxVQUFqQztBQUNEOztBQUVELFFBQUksQ0FBQyxNQUFLWSxHQUFOLElBQWEsTUFBS1gsRUFBdEIsRUFBMEI7QUFDeEIsWUFBS1csR0FBTCxHQUFjLE1BQUtDLFNBQUwsR0FBaUJELEdBQS9CLFNBQXNDLE1BQUtYLEVBQUwsQ0FBUWEsU0FBUixDQUFrQixDQUFsQixDQUF0QztBQUNELEtBRkQsTUFFTyxJQUFJLENBQUMsTUFBS0YsR0FBVixFQUFlO0FBQ3BCLFlBQUtBLEdBQUwsR0FBVyxFQUFYO0FBQ0Q7QUFDRCxVQUFLQyxTQUFMLEdBQWlCRSxjQUFqQjs7QUFFQSxVQUFLTCxjQUFMLEdBQXNCLEtBQXRCO0FBOUJ3QjtBQStCekI7Ozs7OEJBRVM7QUFDUixVQUFNTixTQUFTLEtBQUtTLFNBQUwsRUFBZjtBQUNBLFVBQUlULE1BQUosRUFBWUEsT0FBT1ksaUJBQVAsQ0FBeUIsSUFBekI7QUFDWjtBQUNEOzs7a0NBRWFDLE8sRUFBU0MsSSxFQUFNO0FBQzNCLFdBQUtDLFlBQUw7QUFDQSw0SEFBb0JGLE9BQXBCLEVBQTZCQyxJQUE3QjtBQUNEOzs7NEJBRU9ELE8sRUFBU0MsSSxFQUFNO0FBQ3JCLFdBQUtDLFlBQUw7QUFDQSxzSEFBY0YsT0FBZCxFQUF1QkMsSUFBdkI7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O3dDQVNvQkUsVSxFQUFZO0FBQzlCLFVBQU1oQixTQUFTLEtBQUtTLFNBQUwsRUFBZjs7QUFFQTtBQUNBO0FBQ0EsV0FBS1EsY0FBTCxHQUF1QixLQUFLQyxTQUFMLEtBQW1CMUIsVUFBVTJCLFVBQVYsQ0FBcUJDLEdBQS9EOztBQUVBLFdBQUtDLFVBQUw7O0FBRUEsV0FBS3ZCLE1BQUwsR0FBY2tCLFdBQVdNLFFBQVgsR0FBc0JOLFdBQVdNLFFBQVgsQ0FBb0JDLE9BQXBCLElBQStCLEVBQXJELEdBQTBEdkIsT0FBT3dCLElBQVAsQ0FBWTFCLE1BQXBGO0FBQ0EsV0FBSzJCLFNBQUwsR0FBaUJULFdBQVdVLE9BQVgsQ0FBbUI3QixFQUFwQzs7QUFFQTs7QUFFQSxXQUFLeUIsUUFBTCxHQUFnQk4sV0FBV00sUUFBWCxHQUFzQnRCLE9BQU8yQixhQUFQLENBQXFCWCxXQUFXTSxRQUFoQyxDQUF0QixHQUFrRXRCLE9BQU93QixJQUF6Rjs7QUFFQSxVQUFJLENBQUMsS0FBS2hCLEdBQU4sSUFBYSxLQUFLWCxFQUF0QixFQUEwQjtBQUN4QixhQUFLVyxHQUFMLEdBQVcsS0FBS0MsU0FBTCxHQUFpQkQsR0FBakIsR0FBdUIsS0FBS1gsRUFBTCxDQUFRYSxTQUFSLENBQWtCLENBQWxCLENBQWxDO0FBQ0Q7O0FBRUQsV0FBS08sY0FBTCxHQUFzQixLQUF0QjtBQUNEOztBQUVEOzs7Ozs7Ozs7OztpQ0FRYVcsRyxFQUFLQyxLLEVBQU87QUFDdkIsVUFBSUEsVUFBVSxJQUFWLElBQWtCQSxVQUFVQyxTQUFoQyxFQUEyQ0QsUUFBUSxFQUFSO0FBQzNDLFVBQUksS0FBS0QsR0FBTCxNQUFjQyxLQUFsQixFQUF5QjtBQUN2QixZQUFJLENBQUMsS0FBS3ZCLGNBQVYsRUFBMEI7QUFDeEIsZUFBS3lCLGFBQUwsQ0FBbUIsZ0JBQW5CLEVBQXFDO0FBQ25DQyxzQkFBVUosR0FEeUI7QUFFbkNLLHNCQUFVLEtBQUtMLEdBQUwsQ0FGeUI7QUFHbkNNLHNCQUFVTDtBQUh5QixXQUFyQztBQUtEO0FBQ0QsYUFBS0QsR0FBTCxJQUFZQyxLQUFaO0FBQ0Q7QUFDRjs7O2tDQUVhO0FBQ1osYUFBTyxLQUFLUCxRQUFMLEdBQWdCLEtBQUtBLFFBQUwsQ0FBY3hCLE1BQTlCLEdBQXVDLEVBQTlDO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OztzQ0FTeUJrQixVLEVBQVloQixNLEVBQVE7QUFDM0MsYUFBTyxJQUFJTixVQUFKLENBQWU7QUFDcEJNLHNCQURvQjtBQUVwQkosb0JBQVlvQixVQUZRO0FBR3BCbUIsaUJBQVNuQixXQUFXbUI7QUFIQSxPQUFmLENBQVA7QUFLRDs7OztFQTNIc0I5QyxROztBQThIekI7Ozs7Ozs7QUFLQUssV0FBVzBDLFNBQVgsQ0FBcUJ0QyxNQUFyQixHQUE4QixFQUE5Qjs7QUFFQTs7Ozs7QUFLQUosV0FBVzBDLFNBQVgsQ0FBcUJYLFNBQXJCLEdBQWlDLEVBQWpDOztBQUVBOzs7Ozs7QUFNQS9CLFdBQVcwQyxTQUFYLENBQXFCQyxJQUFyQixHQUE0QixJQUE1Qjs7QUFFQTs7Ozs7QUFLQTNDLFdBQVcwQyxTQUFYLENBQXFCZCxRQUFyQixHQUFnQyxFQUFoQzs7QUFFQTVCLFdBQVc0QyxjQUFYLEdBQTRCL0MsS0FBSytDLGNBQWpDOztBQUVBNUMsV0FBVzZDLGlCQUFYLEdBQStCLFdBQS9COztBQUVBN0MsV0FBVzhDLGdCQUFYLEdBQThCLENBQzVCLGdCQUQ0QixFQUU1QixnQkFGNEIsRUFHNUIsc0JBSDRCLEVBSTVCQyxNQUo0QixDQUlyQnBELFNBQVNtRCxnQkFKWSxDQUE5Qjs7QUFNQTlDLFdBQVdnRCxXQUFYLEdBQXlCLFNBQXpCO0FBQ0FoRCxXQUFXaUQsVUFBWCxHQUF3QixXQUF4Qjs7QUFFQXBELEtBQUtxRCxTQUFMLENBQWVDLEtBQWYsQ0FBcUJuRCxVQUFyQixFQUFpQyxDQUFDQSxVQUFELEVBQWEsWUFBYixDQUFqQztBQUNBTCxTQUFTeUQsVUFBVCxDQUFvQkMsSUFBcEIsQ0FBeUJyRCxVQUF6Qjs7QUFFQXNELE9BQU9DLE9BQVAsR0FBaUJ2RCxVQUFqQiIsImZpbGUiOiJtZW1iZXJzaGlwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogRmVhdHVyZSBpcyB0ZXN0ZWQgYnV0IG5vdCBhdmFpbGFibGUgb24gc2VydmVyXG4gKiBUaGUgTWVtYmVyc2hpcCBjbGFzcyByZXByZXNlbnRzIGFuIE1lbWJlcnNoaXAgb2YgYSB1c2VyIHdpdGhpbiBhIGNoYW5uZWwuXG4gKlxuICogSWRlbnRpdGllcyBhcmUgY3JlYXRlZCBieSB0aGUgU3lzdGVtLCBuZXZlciBkaXJlY3RseSBieSBhcHBzLlxuICpcbiAqIEBjbGFzcyBsYXllci5NZW1iZXJzaGlwXG4gKiBAZXh0ZW5kcyBsYXllci5TeW5jYWJsZVxuICovXG5cbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcblxuY2xhc3MgTWVtYmVyc2hpcCBleHRlbmRzIFN5bmNhYmxlIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoZSBJRCBmcm9tIGhhbmRsZSBmcm9tU2VydmVyIHBhcmFtZXRlciBpcyB1c2VkIGJ5IHRoZSBSb290LmNvbnN0cnVjdG9yXG4gICAgaWYgKG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgb3B0aW9ucy5pZCA9IG9wdGlvbnMuZnJvbVNlcnZlci5pZDtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaWQgJiYgIW9wdGlvbnMudXNlcklkKSB7XG4gICAgICBvcHRpb25zLnVzZXJJZCA9IG9wdGlvbnMuaWQucmVwbGFjZSgvXi4qXFwvLywgJycpO1xuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGNsaWVudElkIHByb3BlcnR5XG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG4gICAgaWYgKCFvcHRpb25zLmNsaWVudElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zIGNvbnRhaW5zIGEgZnVsbCBzZXJ2ZXIgZGVmaW5pdGlvbiBvZiB0aGUgb2JqZWN0LFxuICAgIC8vIGNvcHkgaXQgaW4gd2l0aCBfcG9wdWxhdGVGcm9tU2VydmVyOyB0aGlzIHdpbGwgYWRkIHRoZSBNZW1iZXJzaGlwXG4gICAgLy8gdG8gdGhlIENsaWVudCBhcyB3ZWxsLlxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKG9wdGlvbnMuZnJvbVNlcnZlcik7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVybCAmJiB0aGlzLmlkKSB7XG4gICAgICB0aGlzLnVybCA9IGAke3RoaXMuZ2V0Q2xpZW50KCkudXJsfS8ke3RoaXMuaWQuc3Vic3RyaW5nKDkpfWA7XG4gICAgfSBlbHNlIGlmICghdGhpcy51cmwpIHtcbiAgICAgIHRoaXMudXJsID0gJyc7XG4gICAgfVxuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX2FkZE1lbWJlcnNoaXAodGhpcyk7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkgY2xpZW50Ll9yZW1vdmVNZW1iZXJzaGlwKHRoaXMpO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIF90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIuX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZ0TmFtZSwgYXJncykge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3VwZXIudHJpZ2dlcihldnROYW1lLCBhcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhpcyBpbnN0YW5jZSB1c2luZyBzZXJ2ZXItZGF0YS5cbiAgICpcbiAgICogU2lkZSBlZmZlY3RzIGFkZCB0aGlzIHRvIHRoZSBDbGllbnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1lbWJlcnNoaXAgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIG1lbWJlcnNoaXBcbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIobWVtYmVyc2hpcCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICAvLyBEaXNhYmxlIGV2ZW50cyBpZiBjcmVhdGluZyBhIG5ldyBNZW1iZXJzaGlwXG4gICAgLy8gV2Ugc3RpbGwgd2FudCBwcm9wZXJ0eSBjaGFuZ2UgZXZlbnRzIGZvciBhbnl0aGluZyB0aGF0IERPRVMgY2hhbmdlXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9ICh0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKTtcblxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuXG4gICAgdGhpcy51c2VySWQgPSBtZW1iZXJzaGlwLmlkZW50aXR5ID8gbWVtYmVyc2hpcC5pZGVudGl0eS51c2VyX2lkIHx8ICcnIDogY2xpZW50LnVzZXIudXNlcklkO1xuICAgIHRoaXMuY2hhbm5lbElkID0gbWVtYmVyc2hpcC5jaGFubmVsLmlkO1xuXG4gICAgLy8gdGhpcy5yb2xlID0gY2xpZW50Ll9jcmVhdGVPYmplY3QobWVtYmVyc2hpcC5yb2xlKTtcblxuICAgIHRoaXMuaWRlbnRpdHkgPSBtZW1iZXJzaGlwLmlkZW50aXR5ID8gY2xpZW50Ll9jcmVhdGVPYmplY3QobWVtYmVyc2hpcC5pZGVudGl0eSkgOiBjbGllbnQudXNlcjtcblxuICAgIGlmICghdGhpcy51cmwgJiYgdGhpcy5pZCkge1xuICAgICAgdGhpcy51cmwgPSB0aGlzLmdldENsaWVudCgpLnVybCArIHRoaXMuaWQuc3Vic3RyaW5nKDgpO1xuICAgIH1cblxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHByb3BlcnR5OyB0cmlnZ2VyIGEgY2hhbmdlIGV2ZW50LCBJRiB0aGUgdmFsdWUgaGFzIGNoYW5nZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVZhbHVlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBQcm9wZXJ0eSBuYW1lXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIC0gUHJvcGVydHkgdmFsdWVcbiAgICovXG4gIF91cGRhdGVWYWx1ZShrZXksIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHZhbHVlID0gJyc7XG4gICAgaWYgKHRoaXNba2V5XSAhPT0gdmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZykge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lbWJlcnM6Y2hhbmdlJywge1xuICAgICAgICAgIHByb3BlcnR5OiBrZXksXG4gICAgICAgICAgb2xkVmFsdWU6IHRoaXNba2V5XSxcbiAgICAgICAgICBuZXdWYWx1ZTogdmFsdWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpc1trZXldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgX19nZXRVc2VySWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaWRlbnRpdHkgPyB0aGlzLmlkZW50aXR5LnVzZXJJZCA6ICcnO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBNZW1iZXJzaGlwIGJhc2VkIG9uIGEgU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSB1c2VyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtPYmplY3R9IG1lbWJlcnNoaXAgLSBTZXJ2ZXIgTWVtYmVyc2hpcCBPYmplY3RcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVtYmVyc2hpcH1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZW1iZXJzaGlwLCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IE1lbWJlcnNoaXAoe1xuICAgICAgY2xpZW50LFxuICAgICAgZnJvbVNlcnZlcjogbWVtYmVyc2hpcCxcbiAgICAgIF9mcm9tREI6IG1lbWJlcnNoaXAuX2Zyb21EQixcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIFVzZXIgSUQgdGhhdCB0aGUgTWVtYmVyc2hpcCBkZXNjcmliZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuTWVtYmVyc2hpcC5wcm90b3R5cGUudXNlcklkID0gJyc7XG5cbi8qKlxuICogQ2hhbm5lbCBJRCB0aGF0IHRoZSBtZW1iZXJzaGlwIGRlc2NyaWJlcy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZW1iZXJzaGlwLnByb3RvdHlwZS5jaGFubmVsSWQgPSAnJztcblxuLyoqXG4gKiBUaGUgdXNlcidzIHJvbGUgd2l0aGluIHRoZSBjaGFubmVsXG4gKlxuICogQGlnbm9yZVxuICogQHR5cGUge2xheWVyLlJvbGV9XG4gKi9cbk1lbWJlcnNoaXAucHJvdG90eXBlLnJvbGUgPSBudWxsO1xuXG4vKipcbiAqIElkZW50aXR5IGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVtYmVyc2hpcFxuICpcbiAqIEB0eXBlIHtsYXllci5JZGVudGl0eX1cbiAqL1xuTWVtYmVyc2hpcC5wcm90b3R5cGUuaWRlbnRpdHkgPSAnJztcblxuTWVtYmVyc2hpcC5pbk9iamVjdElnbm9yZSA9IFJvb3QuaW5PYmplY3RJZ25vcmU7XG5cbk1lbWJlcnNoaXAuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuTWVtYmVyc2hpcC5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAnbWVtYmVyczpjaGFuZ2UnLFxuICAnbWVtYmVyczpsb2FkZWQnLFxuICAnbWVtYmVyczpsb2FkZWQtZXJyb3InLFxuXS5jb25jYXQoU3luY2FibGUuX3N1cHBvcnRlZEV2ZW50cyk7XG5cbk1lbWJlcnNoaXAuZXZlbnRQcmVmaXggPSAnbWVtYmVycyc7XG5NZW1iZXJzaGlwLnByZWZpeFVVSUQgPSAnL21lbWJlcnMvJztcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVtYmVyc2hpcCwgW01lbWJlcnNoaXAsICdNZW1iZXJzaGlwJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKE1lbWJlcnNoaXApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lbWJlcnNoaXA7XG4iXX0=
