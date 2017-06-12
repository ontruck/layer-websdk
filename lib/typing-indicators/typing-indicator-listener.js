'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The TypingIndicatorListener receives Typing Indicator state
 * for other users via a websocket, and notifies
 * the client of the updated state.  Typical applications
 * do not access this component directly, but DO subscribe
 * to events produced by this component:
 *
 *      client.on('typing-indicator-change', function(evt) {
 *        if (evt.conversationId == conversationICareAbout) {
 *          console.log('The following users are typing: ' + evt.typing.join(', '));
 *          console.log('The following users are paused: ' + evt.paused.join(', '));
 *        }
 *      });
 *
 * @class layer.TypingIndicators.TypingIndicatorListener
 * @extends {layer.Root}
 */

var Root = require('../root');
var ClientRegistry = require('../client-registry');

var _require = require('./typing-indicators'),
    STARTED = _require.STARTED,
    PAUSED = _require.PAUSED,
    FINISHED = _require.FINISHED;

var TypingIndicatorListener = function (_Root) {
  _inherits(TypingIndicatorListener, _Root);

  /**
   * Creates a Typing Indicator Listener for this Client.
   *
   * @method constructor
   * @protected
   * @param  {Object} args
   * @param {string} args.clientId - ID of the client this belongs to
   */
  function TypingIndicatorListener(args) {
    _classCallCheck(this, TypingIndicatorListener);

    /**
     * Stores the state of all Conversations, indicating who is typing and who is paused.
     *
     * People who are stopped are removed from this state.
     * @property {Object} state
     */
    var _this = _possibleConstructorReturn(this, (TypingIndicatorListener.__proto__ || Object.getPrototypeOf(TypingIndicatorListener)).call(this, args));

    _this.state = {};
    _this._pollId = 0;
    var client = _this._getClient();
    client.on('ready', function () {
      return _this._clientReady();
    });
    return _this;
  }

  /**
   * Called when the client is ready
   *
   * @method _clientReady
   * @private
   */


  _createClass(TypingIndicatorListener, [{
    key: '_clientReady',
    value: function _clientReady() {
      var client = this._getClient();
      this.user = client.user;
      var ws = client.socketManager;
      ws.on('message', this._handleSocketEvent, this);
      this._startPolling();
    }

    /**
     * Determines if this event is relevant to report on.
     * Must be a typing indicator signal that is reporting on
     * someone other than this user.
     *
     * @method _isRelevantEvent
     * @private
     * @param  {Object}  Websocket event data
     * @return {Boolean}
     */

  }, {
    key: '_isRelevantEvent',
    value: function _isRelevantEvent(evt) {
      return evt.type === 'signal' && evt.body.type === 'typing_indicator' && evt.body.data.sender.id !== this.user.id;
    }

    /**
     * This method receives websocket events and
     * if they are typing indicator events, updates its state.
     *
     * @method _handleSocketEvent
     * @private
     * @param {layer.LayerEvent} evtIn - All websocket events
     */

  }, {
    key: '_handleSocketEvent',
    value: function _handleSocketEvent(evtIn) {
      var evt = evtIn.data;

      if (this._isRelevantEvent(evt)) {
        // Could just do _createObject() but for ephemeral events, going through _createObject and updating
        // objects for every typing indicator seems a bit much.  Try getIdentity and only create if needed.
        var identity = this._getClient().getIdentity(evt.body.data.sender.id) || this._getClient()._createObject(evt.body.data.sender);
        var state = evt.body.data.action;
        var conversationId = evt.body.object.id;
        var stateEntry = this.state[conversationId];
        if (!stateEntry) {
          stateEntry = this.state[conversationId] = {
            users: {},
            typing: [],
            paused: []
          };
        }
        stateEntry.users[identity.id] = {
          startTime: Date.now(),
          state: state,
          identity: identity
        };
        if (stateEntry.users[identity.id].state === FINISHED) {
          delete stateEntry.users[identity.id];
        }

        this._updateState(stateEntry, state, identity.id);

        this.trigger('typing-indicator-change', {
          conversationId: conversationId,
          typing: stateEntry.typing.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          }),
          paused: stateEntry.paused.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          })
        });
      }
    }

    /**
     * Get the current typing indicator state of a specified Conversation.
     *
     * Typically used to see if anyone is currently typing when first opening a Conversation.
     * Typically accessed via `client.getTypingState(conversationId)`
     *
     * @method getState
     * @param {String} conversationId
     */

  }, {
    key: 'getState',
    value: function getState(conversationId) {
      var stateEntry = this.state[conversationId];
      if (stateEntry) {
        return {
          typing: stateEntry.typing.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          }),
          paused: stateEntry.paused.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          })
        };
      } else {
        return {
          typing: [],
          paused: []
        };
      }
    }

    /**
     * Updates the state of a single stateEntry; a stateEntry
     * represents a single Conversation's typing indicator data.
     *
     * Updates typing and paused arrays following immutable strategies
     * in hope that this will help Flex based architectures.
     *
     * @method _updateState
     * @private
     * @param  {Object} stateEntry - A Conversation's typing indicator state
     * @param  {string} newState   - started, paused or finished
     * @param  {string} identityId     - ID of the user whose state has changed
     */

  }, {
    key: '_updateState',
    value: function _updateState(stateEntry, newState, identityId) {
      var typingIndex = stateEntry.typing.indexOf(identityId);
      if (newState !== STARTED && typingIndex !== -1) {
        stateEntry.typing = [].concat(_toConsumableArray(stateEntry.typing.slice(0, typingIndex)), _toConsumableArray(stateEntry.typing.slice(typingIndex + 1)));
      }
      var pausedIndex = stateEntry.paused.indexOf(identityId);
      if (newState !== PAUSED && pausedIndex !== -1) {
        stateEntry.paused = [].concat(_toConsumableArray(stateEntry.paused.slice(0, pausedIndex)), _toConsumableArray(stateEntry.paused.slice(pausedIndex + 1)));
      }

      if (newState === STARTED && typingIndex === -1) {
        stateEntry.typing = [].concat(_toConsumableArray(stateEntry.typing), [identityId]);
      } else if (newState === PAUSED && pausedIndex === -1) {
        stateEntry.paused = [].concat(_toConsumableArray(stateEntry.paused), [identityId]);
      }
    }

    /**
     * Any time a state change becomes more than 6 seconds stale,
     * assume that the user is 'finished'.
     *
     * In theory, we should
     * receive a new event every 2.5 seconds.  If the current user
     * has gone offline, lack of this code would cause the people
     * currently flagged as typing as still typing hours from now.
     *
     * For this first pass, we just mark the user as 'finished'
     * but a future pass may move from 'started' to 'paused'
     * and 'paused to 'finished'
     *
     * @method _startPolling
     * @private
     */

  }, {
    key: '_startPolling',
    value: function _startPolling() {
      var _this2 = this;

      if (this._pollId) return;
      this._pollId = setInterval(function () {
        return _this2._poll();
      }, 5000);
    }
  }, {
    key: '_poll',
    value: function _poll() {
      var _this3 = this;

      var conversationIds = Object.keys(this.state);

      conversationIds.forEach(function (id) {
        var state = _this3.state[id];
        Object.keys(state.users).forEach(function (identityId) {
          if (Date.now() >= state.users[identityId].startTime + 6000) {
            _this3._updateState(state, FINISHED, identityId);
            delete state.users[identityId];
            _this3.trigger('typing-indicator-change', {
              conversationId: id,
              typing: state.typing.map(function (aIdentityId) {
                return state.users[aIdentityId].identity.toObject();
              }),
              paused: state.paused.map(function (aIdentityId) {
                return state.users[aIdentityId].identity.toObject();
              })
            });
          }
        });
      });
    }

    /**
     * Get the Client associated with this class.  Uses the clientId
     * property.
     *
     * @method _getClient
     * @protected
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }
  }]);

  return TypingIndicatorListener;
}(Root);

/**
 * setTimeout ID for polling for states to transition
 * @type {Number}
 * @private
 */


TypingIndicatorListener.prototype._pollId = 0;

/**
 * ID of the client this instance is associated with
 * @type {String}
 */
TypingIndicatorListener.prototype.clientId = '';

TypingIndicatorListener.bubbleEventParent = '_getClient';

TypingIndicatorListener._supportedEvents = [
/**
 * There has been a change in typing indicator state of other users.
 * @event change
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.typing - Array of Identities of people who are typing
 * @param {layer.Identity[]} evt.paused - Array of Identities of people who are paused
 * @param {string} evt.conversationId - ID of the Conversation that has changed typing indicator state
 */
'typing-indicator-change'].concat(Root._supportedEvents);

Root.initClass.apply(TypingIndicatorListener, [TypingIndicatorListener, 'TypingIndicatorListener']);
module.exports = TypingIndicatorListener;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctaW5kaWNhdG9yLWxpc3RlbmVyLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiQ2xpZW50UmVnaXN0cnkiLCJTVEFSVEVEIiwiUEFVU0VEIiwiRklOSVNIRUQiLCJUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lciIsImFyZ3MiLCJzdGF0ZSIsIl9wb2xsSWQiLCJjbGllbnQiLCJfZ2V0Q2xpZW50Iiwib24iLCJfY2xpZW50UmVhZHkiLCJ1c2VyIiwid3MiLCJzb2NrZXRNYW5hZ2VyIiwiX2hhbmRsZVNvY2tldEV2ZW50IiwiX3N0YXJ0UG9sbGluZyIsImV2dCIsInR5cGUiLCJib2R5IiwiZGF0YSIsInNlbmRlciIsImlkIiwiZXZ0SW4iLCJfaXNSZWxldmFudEV2ZW50IiwiaWRlbnRpdHkiLCJnZXRJZGVudGl0eSIsIl9jcmVhdGVPYmplY3QiLCJhY3Rpb24iLCJjb252ZXJzYXRpb25JZCIsIm9iamVjdCIsInN0YXRlRW50cnkiLCJ1c2VycyIsInR5cGluZyIsInBhdXNlZCIsInN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJfdXBkYXRlU3RhdGUiLCJ0cmlnZ2VyIiwibWFwIiwidG9PYmplY3QiLCJuZXdTdGF0ZSIsImlkZW50aXR5SWQiLCJ0eXBpbmdJbmRleCIsImluZGV4T2YiLCJzbGljZSIsInBhdXNlZEluZGV4Iiwic2V0SW50ZXJ2YWwiLCJfcG9sbCIsImNvbnZlcnNhdGlvbklkcyIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiYUlkZW50aXR5SWQiLCJnZXQiLCJjbGllbnRJZCIsInByb3RvdHlwZSIsImJ1YmJsZUV2ZW50UGFyZW50IiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtCQSxJQUFNQSxPQUFPQyxRQUFR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QXJCLEVBQThDLENBQUNBLHVCQUFELEVBQTBCLHlCQUExQixDQUE5QztBQUNBMkQsT0FBT0MsT0FBUCxHQUFpQjVELHVCQUFqQiIsImZpbGUiOiJ0eXBpbmctaW5kaWNhdG9yLWxpc3RlbmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIgcmVjZWl2ZXMgVHlwaW5nIEluZGljYXRvciBzdGF0ZVxuICogZm9yIG90aGVyIHVzZXJzIHZpYSBhIHdlYnNvY2tldCwgYW5kIG5vdGlmaWVzXG4gKiB0aGUgY2xpZW50IG9mIHRoZSB1cGRhdGVkIHN0YXRlLiAgVHlwaWNhbCBhcHBsaWNhdGlvbnNcbiAqIGRvIG5vdCBhY2Nlc3MgdGhpcyBjb21wb25lbnQgZGlyZWN0bHksIGJ1dCBETyBzdWJzY3JpYmVcbiAqIHRvIGV2ZW50cyBwcm9kdWNlZCBieSB0aGlzIGNvbXBvbmVudDpcbiAqXG4gKiAgICAgIGNsaWVudC5vbigndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbklkID09IGNvbnZlcnNhdGlvbklDYXJlQWJvdXQpIHtcbiAqICAgICAgICAgIGNvbnNvbGUubG9nKCdUaGUgZm9sbG93aW5nIHVzZXJzIGFyZSB0eXBpbmc6ICcgKyBldnQudHlwaW5nLmpvaW4oJywgJykpO1xuICogICAgICAgICAgY29uc29sZS5sb2coJ1RoZSBmb2xsb3dpbmcgdXNlcnMgYXJlIHBhdXNlZDogJyArIGV2dC5wYXVzZWQuam9pbignLCAnKSk7XG4gKiAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdJbmRpY2F0b3JMaXN0ZW5lclxuICogQGV4dGVuZHMge2xheWVyLlJvb3R9XG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCB7IFNUQVJURUQsIFBBVVNFRCwgRklOSVNIRUQgfSA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMnKTtcblxuY2xhc3MgVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIFR5cGluZyBJbmRpY2F0b3IgTGlzdGVuZXIgZm9yIHRoaXMgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBhcmdzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhcmdzLmNsaWVudElkIC0gSUQgb2YgdGhlIGNsaWVudCB0aGlzIGJlbG9uZ3MgdG9cbiAgICovXG4gIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICBzdXBlcihhcmdzKTtcblxuICAgIC8qKlxuICAgICAqIFN0b3JlcyB0aGUgc3RhdGUgb2YgYWxsIENvbnZlcnNhdGlvbnMsIGluZGljYXRpbmcgd2hvIGlzIHR5cGluZyBhbmQgd2hvIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIFBlb3BsZSB3aG8gYXJlIHN0b3BwZWQgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIHN0YXRlLlxuICAgICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBzdGF0ZVxuICAgICAqL1xuICAgIHRoaXMuc3RhdGUgPSB7fTtcbiAgICB0aGlzLl9wb2xsSWQgPSAwO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuX2dldENsaWVudCgpO1xuICAgIGNsaWVudC5vbigncmVhZHknLCAoKSA9PiB0aGlzLl9jbGllbnRSZWFkeSgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgd2hlbiB0aGUgY2xpZW50IGlzIHJlYWR5XG4gICAqXG4gICAqIEBtZXRob2QgX2NsaWVudFJlYWR5XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xpZW50UmVhZHkoKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5fZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy51c2VyID0gY2xpZW50LnVzZXI7XG4gICAgY29uc3Qgd3MgPSBjbGllbnQuc29ja2V0TWFuYWdlcjtcbiAgICB3cy5vbignbWVzc2FnZScsIHRoaXMuX2hhbmRsZVNvY2tldEV2ZW50LCB0aGlzKTtcbiAgICB0aGlzLl9zdGFydFBvbGxpbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIGlmIHRoaXMgZXZlbnQgaXMgcmVsZXZhbnQgdG8gcmVwb3J0IG9uLlxuICAgKiBNdXN0IGJlIGEgdHlwaW5nIGluZGljYXRvciBzaWduYWwgdGhhdCBpcyByZXBvcnRpbmcgb25cbiAgICogc29tZW9uZSBvdGhlciB0aGFuIHRoaXMgdXNlci5cbiAgICpcbiAgICogQG1ldGhvZCBfaXNSZWxldmFudEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFdlYnNvY2tldCBldmVudCBkYXRhXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBfaXNSZWxldmFudEV2ZW50KGV2dCkge1xuICAgIHJldHVybiBldnQudHlwZSA9PT0gJ3NpZ25hbCcgJiZcbiAgICAgIGV2dC5ib2R5LnR5cGUgPT09ICd0eXBpbmdfaW5kaWNhdG9yJyAmJlxuICAgICAgZXZ0LmJvZHkuZGF0YS5zZW5kZXIuaWQgIT09IHRoaXMudXNlci5pZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCByZWNlaXZlcyB3ZWJzb2NrZXQgZXZlbnRzIGFuZFxuICAgKiBpZiB0aGV5IGFyZSB0eXBpbmcgaW5kaWNhdG9yIGV2ZW50cywgdXBkYXRlcyBpdHMgc3RhdGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVNvY2tldEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0SW4gLSBBbGwgd2Vic29ja2V0IGV2ZW50c1xuICAgKi9cbiAgX2hhbmRsZVNvY2tldEV2ZW50KGV2dEluKSB7XG4gICAgY29uc3QgZXZ0ID0gZXZ0SW4uZGF0YTtcblxuICAgIGlmICh0aGlzLl9pc1JlbGV2YW50RXZlbnQoZXZ0KSkge1xuICAgICAgLy8gQ291bGQganVzdCBkbyBfY3JlYXRlT2JqZWN0KCkgYnV0IGZvciBlcGhlbWVyYWwgZXZlbnRzLCBnb2luZyB0aHJvdWdoIF9jcmVhdGVPYmplY3QgYW5kIHVwZGF0aW5nXG4gICAgICAvLyBvYmplY3RzIGZvciBldmVyeSB0eXBpbmcgaW5kaWNhdG9yIHNlZW1zIGEgYml0IG11Y2guICBUcnkgZ2V0SWRlbnRpdHkgYW5kIG9ubHkgY3JlYXRlIGlmIG5lZWRlZC5cbiAgICAgIGNvbnN0IGlkZW50aXR5ID0gdGhpcy5fZ2V0Q2xpZW50KCkuZ2V0SWRlbnRpdHkoZXZ0LmJvZHkuZGF0YS5zZW5kZXIuaWQpIHx8XG4gICAgICAgIHRoaXMuX2dldENsaWVudCgpLl9jcmVhdGVPYmplY3QoZXZ0LmJvZHkuZGF0YS5zZW5kZXIpO1xuICAgICAgY29uc3Qgc3RhdGUgPSBldnQuYm9keS5kYXRhLmFjdGlvbjtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gZXZ0LmJvZHkub2JqZWN0LmlkO1xuICAgICAgbGV0IHN0YXRlRW50cnkgPSB0aGlzLnN0YXRlW2NvbnZlcnNhdGlvbklkXTtcbiAgICAgIGlmICghc3RhdGVFbnRyeSkge1xuICAgICAgICBzdGF0ZUVudHJ5ID0gdGhpcy5zdGF0ZVtjb252ZXJzYXRpb25JZF0gPSB7XG4gICAgICAgICAgdXNlcnM6IHt9LFxuICAgICAgICAgIHR5cGluZzogW10sXG4gICAgICAgICAgcGF1c2VkOiBbXSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHN0YXRlRW50cnkudXNlcnNbaWRlbnRpdHkuaWRdID0ge1xuICAgICAgICBzdGFydFRpbWU6IERhdGUubm93KCksXG4gICAgICAgIHN0YXRlLFxuICAgICAgICBpZGVudGl0eSxcbiAgICAgIH07XG4gICAgICBpZiAoc3RhdGVFbnRyeS51c2Vyc1tpZGVudGl0eS5pZF0uc3RhdGUgPT09IEZJTklTSEVEKSB7XG4gICAgICAgIGRlbGV0ZSBzdGF0ZUVudHJ5LnVzZXJzW2lkZW50aXR5LmlkXTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fdXBkYXRlU3RhdGUoc3RhdGVFbnRyeSwgc3RhdGUsIGlkZW50aXR5LmlkKTtcblxuICAgICAgdGhpcy50cmlnZ2VyKCd0eXBpbmctaW5kaWNhdG9yLWNoYW5nZScsIHtcbiAgICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICAgIHR5cGluZzogc3RhdGVFbnRyeS50eXBpbmcubWFwKGlkID0+IHN0YXRlRW50cnkudXNlcnNbaWRdLmlkZW50aXR5LnRvT2JqZWN0KCkpLFxuICAgICAgICBwYXVzZWQ6IHN0YXRlRW50cnkucGF1c2VkLm1hcChpZCA9PiBzdGF0ZUVudHJ5LnVzZXJzW2lkXS5pZGVudGl0eS50b09iamVjdCgpKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgdHlwaW5nIGluZGljYXRvciBzdGF0ZSBvZiBhIHNwZWNpZmllZCBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIFR5cGljYWxseSB1c2VkIHRvIHNlZSBpZiBhbnlvbmUgaXMgY3VycmVudGx5IHR5cGluZyB3aGVuIGZpcnN0IG9wZW5pbmcgYSBDb252ZXJzYXRpb24uXG4gICAqIFR5cGljYWxseSBhY2Nlc3NlZCB2aWEgYGNsaWVudC5nZXRUeXBpbmdTdGF0ZShjb252ZXJzYXRpb25JZClgXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0U3RhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gICAqL1xuICBnZXRTdGF0ZShjb252ZXJzYXRpb25JZCkge1xuICAgIGNvbnN0IHN0YXRlRW50cnkgPSB0aGlzLnN0YXRlW2NvbnZlcnNhdGlvbklkXTtcbiAgICBpZiAoc3RhdGVFbnRyeSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwaW5nOiBzdGF0ZUVudHJ5LnR5cGluZy5tYXAoaWQgPT4gc3RhdGVFbnRyeS51c2Vyc1tpZF0uaWRlbnRpdHkudG9PYmplY3QoKSksXG4gICAgICAgIHBhdXNlZDogc3RhdGVFbnRyeS5wYXVzZWQubWFwKGlkID0+IHN0YXRlRW50cnkudXNlcnNbaWRdLmlkZW50aXR5LnRvT2JqZWN0KCkpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwaW5nOiBbXSxcbiAgICAgICAgcGF1c2VkOiBbXSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHN0YXRlIG9mIGEgc2luZ2xlIHN0YXRlRW50cnk7IGEgc3RhdGVFbnRyeVxuICAgKiByZXByZXNlbnRzIGEgc2luZ2xlIENvbnZlcnNhdGlvbidzIHR5cGluZyBpbmRpY2F0b3IgZGF0YS5cbiAgICpcbiAgICogVXBkYXRlcyB0eXBpbmcgYW5kIHBhdXNlZCBhcnJheXMgZm9sbG93aW5nIGltbXV0YWJsZSBzdHJhdGVnaWVzXG4gICAqIGluIGhvcGUgdGhhdCB0aGlzIHdpbGwgaGVscCBGbGV4IGJhc2VkIGFyY2hpdGVjdHVyZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVN0YXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdGVFbnRyeSAtIEEgQ29udmVyc2F0aW9uJ3MgdHlwaW5nIGluZGljYXRvciBzdGF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5ld1N0YXRlICAgLSBzdGFydGVkLCBwYXVzZWQgb3IgZmluaXNoZWRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZGVudGl0eUlkICAgICAtIElEIG9mIHRoZSB1c2VyIHdob3NlIHN0YXRlIGhhcyBjaGFuZ2VkXG4gICAqL1xuICBfdXBkYXRlU3RhdGUoc3RhdGVFbnRyeSwgbmV3U3RhdGUsIGlkZW50aXR5SWQpIHtcbiAgICBjb25zdCB0eXBpbmdJbmRleCA9IHN0YXRlRW50cnkudHlwaW5nLmluZGV4T2YoaWRlbnRpdHlJZCk7XG4gICAgaWYgKG5ld1N0YXRlICE9PSBTVEFSVEVEICYmIHR5cGluZ0luZGV4ICE9PSAtMSkge1xuICAgICAgc3RhdGVFbnRyeS50eXBpbmcgPSBbXG4gICAgICAgIC4uLnN0YXRlRW50cnkudHlwaW5nLnNsaWNlKDAsIHR5cGluZ0luZGV4KSxcbiAgICAgICAgLi4uc3RhdGVFbnRyeS50eXBpbmcuc2xpY2UodHlwaW5nSW5kZXggKyAxKSxcbiAgICAgIF07XG4gICAgfVxuICAgIGNvbnN0IHBhdXNlZEluZGV4ID0gc3RhdGVFbnRyeS5wYXVzZWQuaW5kZXhPZihpZGVudGl0eUlkKTtcbiAgICBpZiAobmV3U3RhdGUgIT09IFBBVVNFRCAmJiBwYXVzZWRJbmRleCAhPT0gLTEpIHtcbiAgICAgIHN0YXRlRW50cnkucGF1c2VkID0gW1xuICAgICAgICAuLi5zdGF0ZUVudHJ5LnBhdXNlZC5zbGljZSgwLCBwYXVzZWRJbmRleCksXG4gICAgICAgIC4uLnN0YXRlRW50cnkucGF1c2VkLnNsaWNlKHBhdXNlZEluZGV4ICsgMSksXG4gICAgICBdO1xuICAgIH1cblxuXG4gICAgaWYgKG5ld1N0YXRlID09PSBTVEFSVEVEICYmIHR5cGluZ0luZGV4ID09PSAtMSkge1xuICAgICAgc3RhdGVFbnRyeS50eXBpbmcgPSBbLi4uc3RhdGVFbnRyeS50eXBpbmcsIGlkZW50aXR5SWRdO1xuICAgIH0gZWxzZSBpZiAobmV3U3RhdGUgPT09IFBBVVNFRCAmJiBwYXVzZWRJbmRleCA9PT0gLTEpIHtcbiAgICAgIHN0YXRlRW50cnkucGF1c2VkID0gWy4uLnN0YXRlRW50cnkucGF1c2VkLCBpZGVudGl0eUlkXTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQW55IHRpbWUgYSBzdGF0ZSBjaGFuZ2UgYmVjb21lcyBtb3JlIHRoYW4gNiBzZWNvbmRzIHN0YWxlLFxuICAgKiBhc3N1bWUgdGhhdCB0aGUgdXNlciBpcyAnZmluaXNoZWQnLlxuICAgKlxuICAgKiBJbiB0aGVvcnksIHdlIHNob3VsZFxuICAgKiByZWNlaXZlIGEgbmV3IGV2ZW50IGV2ZXJ5IDIuNSBzZWNvbmRzLiAgSWYgdGhlIGN1cnJlbnQgdXNlclxuICAgKiBoYXMgZ29uZSBvZmZsaW5lLCBsYWNrIG9mIHRoaXMgY29kZSB3b3VsZCBjYXVzZSB0aGUgcGVvcGxlXG4gICAqIGN1cnJlbnRseSBmbGFnZ2VkIGFzIHR5cGluZyBhcyBzdGlsbCB0eXBpbmcgaG91cnMgZnJvbSBub3cuXG4gICAqXG4gICAqIEZvciB0aGlzIGZpcnN0IHBhc3MsIHdlIGp1c3QgbWFyayB0aGUgdXNlciBhcyAnZmluaXNoZWQnXG4gICAqIGJ1dCBhIGZ1dHVyZSBwYXNzIG1heSBtb3ZlIGZyb20gJ3N0YXJ0ZWQnIHRvICdwYXVzZWQnXG4gICAqIGFuZCAncGF1c2VkIHRvICdmaW5pc2hlZCdcbiAgICpcbiAgICogQG1ldGhvZCBfc3RhcnRQb2xsaW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc3RhcnRQb2xsaW5nKCkge1xuICAgIGlmICh0aGlzLl9wb2xsSWQpIHJldHVybjtcbiAgICB0aGlzLl9wb2xsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLl9wb2xsKCksIDUwMDApO1xuICB9XG5cbiAgX3BvbGwoKSB7XG4gICAgY29uc3QgY29udmVyc2F0aW9uSWRzID0gT2JqZWN0LmtleXModGhpcy5zdGF0ZSk7XG5cbiAgICBjb252ZXJzYXRpb25JZHMuZm9yRWFjaCgoaWQpID0+IHtcbiAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZVtpZF07XG4gICAgICBPYmplY3Qua2V5cyhzdGF0ZS51c2VycylcbiAgICAgICAgLmZvckVhY2goKGlkZW50aXR5SWQpID0+IHtcbiAgICAgICAgICBpZiAoRGF0ZS5ub3coKSA+PSBzdGF0ZS51c2Vyc1tpZGVudGl0eUlkXS5zdGFydFRpbWUgKyA2MDAwKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTdGF0ZShzdGF0ZSwgRklOSVNIRUQsIGlkZW50aXR5SWQpO1xuICAgICAgICAgICAgZGVsZXRlIHN0YXRlLnVzZXJzW2lkZW50aXR5SWRdO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCd0eXBpbmctaW5kaWNhdG9yLWNoYW5nZScsIHtcbiAgICAgICAgICAgICAgY29udmVyc2F0aW9uSWQ6IGlkLFxuICAgICAgICAgICAgICB0eXBpbmc6IHN0YXRlLnR5cGluZy5tYXAoYUlkZW50aXR5SWQgPT4gc3RhdGUudXNlcnNbYUlkZW50aXR5SWRdLmlkZW50aXR5LnRvT2JqZWN0KCkpLFxuICAgICAgICAgICAgICBwYXVzZWQ6IHN0YXRlLnBhdXNlZC5tYXAoYUlkZW50aXR5SWQgPT4gc3RhdGUudXNlcnNbYUlkZW50aXR5SWRdLmlkZW50aXR5LnRvT2JqZWN0KCkpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIENsaWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBjbGFzcy4gIFVzZXMgdGhlIGNsaWVudElkXG4gICAqIHByb3BlcnR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDbGllbnRcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBfZ2V0Q2xpZW50KCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBzZXRUaW1lb3V0IElEIGZvciBwb2xsaW5nIGZvciBzdGF0ZXMgdG8gdHJhbnNpdGlvblxuICogQHR5cGUge051bWJlcn1cbiAqIEBwcml2YXRlXG4gKi9cblR5cGluZ0luZGljYXRvckxpc3RlbmVyLnByb3RvdHlwZS5fcG9sbElkID0gMDtcblxuLyoqXG4gKiBJRCBvZiB0aGUgY2xpZW50IHRoaXMgaW5zdGFuY2UgaXMgYXNzb2NpYXRlZCB3aXRoXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5UeXBpbmdJbmRpY2F0b3JMaXN0ZW5lci5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIuYnViYmxlRXZlbnRQYXJlbnQgPSAnX2dldENsaWVudCc7XG5cblxuVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIFRoZXJlIGhhcyBiZWVuIGEgY2hhbmdlIGluIHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgb2Ygb3RoZXIgdXNlcnMuXG4gICAqIEBldmVudCBjaGFuZ2VcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBldnQudHlwaW5nIC0gQXJyYXkgb2YgSWRlbnRpdGllcyBvZiBwZW9wbGUgd2hvIGFyZSB0eXBpbmdcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBldnQucGF1c2VkIC0gQXJyYXkgb2YgSWRlbnRpdGllcyBvZiBwZW9wbGUgd2hvIGFyZSBwYXVzZWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jb252ZXJzYXRpb25JZCAtIElEIG9mIHRoZSBDb252ZXJzYXRpb24gdGhhdCBoYXMgY2hhbmdlZCB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlXG4gICAqL1xuICAndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIsIFtUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lciwgJ1R5cGluZ0luZGljYXRvckxpc3RlbmVyJ10pO1xubW9kdWxlLmV4cG9ydHMgPSBUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lcjtcbiJdfQ==
