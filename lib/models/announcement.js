'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Announcement class represents a type of Message sent by a server.
 *
 * Announcements can not be sent using the WebSDK, only received.
 *
 * You should never need to instantiate an Announcement; they should only be
 * delivered via `messages:add` events when an Announcement is provided via
 * websocket to the client, and `change` events on an Announcements Query.
 *
 * @class  layer.Announcement
 * @extends layer.Message.ConversationMessage
 */

var ConversationMessage = require('./conversation-message');
var Syncable = require('./syncable');
var Root = require('../root');
var LayerError = require('../layer-error');

var Announcement = function (_ConversationMessage) {
  _inherits(Announcement, _ConversationMessage);

  function Announcement() {
    _classCallCheck(this, Announcement);

    return _possibleConstructorReturn(this, (Announcement.__proto__ || Object.getPrototypeOf(Announcement)).apply(this, arguments));
  }

  _createClass(Announcement, [{
    key: 'send',


    /**
     * @method send
     * @hide
     */
    value: function send() {}

    /**
     * @method _send
     * @hide
     */

  }, {
    key: '_send',
    value: function _send() {}

    /**
     * @method getConversation
     * @hide
     */

  }, {
    key: 'getConversation',
    value: function getConversation() {}
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.getClient()._addMessage(this);
    }

    /**
     * Delete the Announcement from the server.
     *
     * @method delete
     */

  }, {
    key: 'delete',
    value: function _delete() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '',
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found' && result.data.id !== 'authentication_required')) {
          Syncable.load(id, client);
        }
      });

      this._deleted();
      this.destroy();
    }

    /**
     * Creates an Announcement from the server's representation of an Announcement.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the announcement
     * @return {layer.Announcement}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      return new Announcement({
        fromServer: message,
        clientId: client.appId,
        _notify: fromWebsocket && message.is_unread
      });
    }
  }]);

  return Announcement;
}(ConversationMessage);

/**
 * @property {String} conversationId
 * @hide
 */

/**
 * @property {Object} deliveryStatus
 * @hide
 */

/**
 * @property {Object} readStatus
 * @hide
 */

/**
 * @property {Object} recipientStatus
 * @hide
 */

/**
 * @method addPart
 * @hide
 */

/**
 * @method send
 * @hide
 */

/**
 * @method isSaved
 * @hide
 */

/**
 * @method isSaving
 * @hide
 */

Announcement.prefixUUID = 'layer:///announcements/';

Announcement.bubbleEventParent = 'getClient';

Announcement._supportedEvents = [].concat(ConversationMessage._supportedEvents);

Announcement.inObjectIgnore = ConversationMessage.inObjectIgnore;
Root.initClass.apply(Announcement, [Announcement, 'Announcement']);
Syncable.subclasses.push(Announcement);
module.exports = Announcement;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvYW5ub3VuY2VtZW50LmpzIl0sIm5hbWVzIjpbIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJyZXF1aXJlIiwiU3luY2FibGUiLCJSb290IiwiTGF5ZXJFcnJvciIsIkFubm91bmNlbWVudCIsImRhdGEiLCJnZXRDbGllbnQiLCJfYWRkTWVzc2FnZSIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiaWQiLCJjbGllbnQiLCJfeGhyIiwidXJsIiwibWV0aG9kIiwicmVzdWx0Iiwic3VjY2VzcyIsImxvYWQiLCJfZGVsZXRlZCIsImRlc3Ryb3kiLCJtZXNzYWdlIiwiZnJvbVdlYnNvY2tldCIsImZyb21TZXJ2ZXIiLCJjbGllbnRJZCIsImFwcElkIiwiX25vdGlmeSIsImlzX3VucmVhZCIsInByZWZpeFVVSUQiLCJidWJibGVFdmVudFBhcmVudCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbk9iamVjdElnbm9yZSIsImluaXRDbGFzcyIsImFwcGx5Iiwic3ViY2xhc3NlcyIsInB1c2giLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUFhQSxJQUFNQSxzQkFBc0JDLFFBQVEsd0JBQVIsQ0FBNUI7QUFDQSxJQUFNQyxXQUFXRCxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNRSxPQUFPRixRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7O0lBR01JLFk7Ozs7Ozs7Ozs7Ozs7QUFFSjs7OzsyQkFJTyxDQUFFOztBQUVUOzs7Ozs7OzRCQUlRLENBQUU7O0FBRVY7Ozs7Ozs7c0NBSWtCLENBQUU7Ozs0QkFFWkMsSSxFQUFNO0FBQ1osV0FBS0MsU0FBTCxHQUFpQkMsV0FBakIsQ0FBNkIsSUFBN0I7QUFDRDs7QUFFRDs7Ozs7Ozs7OEJBS1M7QUFDUCxVQUFJLEtBQUtDLFdBQVQsRUFBc0IsTUFBTSxJQUFJQyxLQUFKLENBQVVOLFdBQVdPLFVBQVgsQ0FBc0JGLFdBQWhDLENBQU47O0FBRXRCLFVBQU1HLEtBQUssS0FBS0EsRUFBaEI7QUFDQSxVQUFNQyxTQUFTLEtBQUtOLFNBQUwsRUFBZjtBQUNBLFdBQUtPLElBQUwsQ0FBVTtBQUNSQyxhQUFLLEVBREc7QUFFUkMsZ0JBQVE7QUFGQSxPQUFWLEVBR0csVUFBQ0MsTUFBRCxFQUFZO0FBQ2IsWUFBSSxDQUFDQSxPQUFPQyxPQUFSLEtBQW9CLENBQUNELE9BQU9YLElBQVIsSUFBaUJXLE9BQU9YLElBQVAsQ0FBWU0sRUFBWixLQUFtQixXQUFuQixJQUFrQ0ssT0FBT1gsSUFBUCxDQUFZTSxFQUFaLEtBQW1CLHlCQUExRixDQUFKLEVBQTJIO0FBQ3pIVixtQkFBU2lCLElBQVQsQ0FBY1AsRUFBZCxFQUFrQkMsTUFBbEI7QUFDRDtBQUNGLE9BUEQ7O0FBU0EsV0FBS08sUUFBTDtBQUNBLFdBQUtDLE9BQUw7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztzQ0FheUJDLE8sRUFBU1QsTSxFQUFRO0FBQ3hDLFVBQU1VLGdCQUFnQkQsUUFBUUMsYUFBOUI7QUFDQSxhQUFPLElBQUlsQixZQUFKLENBQWlCO0FBQ3RCbUIsb0JBQVlGLE9BRFU7QUFFdEJHLGtCQUFVWixPQUFPYSxLQUZLO0FBR3RCQyxpQkFBU0osaUJBQWlCRCxRQUFRTTtBQUhaLE9BQWpCLENBQVA7QUFLRDs7OztFQW5Fd0I1QixtQjs7QUFzRTNCOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBOzs7OztBQUtBSyxhQUFhd0IsVUFBYixHQUEwQix5QkFBMUI7O0FBRUF4QixhQUFheUIsaUJBQWIsR0FBaUMsV0FBakM7O0FBRUF6QixhQUFhMEIsZ0JBQWIsR0FBZ0MsR0FBR0MsTUFBSCxDQUFVaEMsb0JBQW9CK0IsZ0JBQTlCLENBQWhDOztBQUVBMUIsYUFBYTRCLGNBQWIsR0FBOEJqQyxvQkFBb0JpQyxjQUFsRDtBQUNBOUIsS0FBSytCLFNBQUwsQ0FBZUMsS0FBZixDQUFxQjlCLFlBQXJCLEVBQW1DLENBQUNBLFlBQUQsRUFBZSxjQUFmLENBQW5DO0FBQ0FILFNBQVNrQyxVQUFULENBQW9CQyxJQUFwQixDQUF5QmhDLFlBQXpCO0FBQ0FpQyxPQUFPQyxPQUFQLEdBQWlCbEMsWUFBakIiLCJmaWxlIjoiYW5ub3VuY2VtZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG4vKipcbiAqIFRoZSBBbm5vdW5jZW1lbnQgY2xhc3MgcmVwcmVzZW50cyBhIHR5cGUgb2YgTWVzc2FnZSBzZW50IGJ5IGEgc2VydmVyLlxuICpcbiAqIEFubm91bmNlbWVudHMgY2FuIG5vdCBiZSBzZW50IHVzaW5nIHRoZSBXZWJTREssIG9ubHkgcmVjZWl2ZWQuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIGluc3RhbnRpYXRlIGFuIEFubm91bmNlbWVudDsgdGhleSBzaG91bGQgb25seSBiZVxuICogZGVsaXZlcmVkIHZpYSBgbWVzc2FnZXM6YWRkYCBldmVudHMgd2hlbiBhbiBBbm5vdW5jZW1lbnQgaXMgcHJvdmlkZWQgdmlhXG4gKiB3ZWJzb2NrZXQgdG8gdGhlIGNsaWVudCwgYW5kIGBjaGFuZ2VgIGV2ZW50cyBvbiBhbiBBbm5vdW5jZW1lbnRzIFF1ZXJ5LlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQW5ub3VuY2VtZW50XG4gKiBAZXh0ZW5kcyBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2VcbiAqL1xuXG5jb25zdCBDb252ZXJzYXRpb25NZXNzYWdlID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb24tbWVzc2FnZScpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5cblxuY2xhc3MgQW5ub3VuY2VtZW50IGV4dGVuZHMgQ29udmVyc2F0aW9uTWVzc2FnZSB7XG5cbiAgLyoqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAaGlkZVxuICAgKi9cbiAgc2VuZCgpIHt9XG5cbiAgLyoqXG4gICAqIEBtZXRob2QgX3NlbmRcbiAgICogQGhpZGVcbiAgICovXG4gIF9zZW5kKCkge31cblxuICAvKipcbiAgICogQG1ldGhvZCBnZXRDb252ZXJzYXRpb25cbiAgICogQGhpZGVcbiAgICovXG4gIGdldENvbnZlcnNhdGlvbigpIHt9XG5cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIEFubm91bmNlbWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqL1xuICBkZWxldGUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgY29uc3QgaWQgPSB0aGlzLmlkO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgKCFyZXN1bHQuZGF0YSB8fCAocmVzdWx0LmRhdGEuaWQgIT09ICdub3RfZm91bmQnICYmIHJlc3VsdC5kYXRhLmlkICE9PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnKSkpIHtcbiAgICAgICAgU3luY2FibGUubG9hZChpZCwgY2xpZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIEFubm91bmNlbWVudCBmcm9tIHRoZSBzZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiBhbiBBbm5vdW5jZW1lbnQuXG4gICAqXG4gICAqIFNpbWlsYXIgdG8gX3BvcHVsYXRlRnJvbVNlcnZlciwgaG93ZXZlciwgdGhpcyBtZXRob2QgdGFrZXMgYVxuICAgKiBtZXNzYWdlIGRlc2NyaXB0aW9uIGFuZCByZXR1cm5zIGEgbmV3IG1lc3NhZ2UgaW5zdGFuY2UgdXNpbmcgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiB0byBzZXR1cCB0aGUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1lc3NhZ2UgLSBTZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiB0aGUgYW5ub3VuY2VtZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkFubm91bmNlbWVudH1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLCBjbGllbnQpIHtcbiAgICBjb25zdCBmcm9tV2Vic29ja2V0ID0gbWVzc2FnZS5mcm9tV2Vic29ja2V0O1xuICAgIHJldHVybiBuZXcgQW5ub3VuY2VtZW50KHtcbiAgICAgIGZyb21TZXJ2ZXI6IG1lc3NhZ2UsXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgICAgX25vdGlmeTogZnJvbVdlYnNvY2tldCAmJiBtZXNzYWdlLmlzX3VucmVhZCxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBjb252ZXJzYXRpb25JZFxuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBkZWxpdmVyeVN0YXR1c1xuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSByZWFkU3RhdHVzXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQHByb3BlcnR5IHtPYmplY3R9IHJlY2lwaWVudFN0YXR1c1xuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBtZXRob2QgYWRkUGFydFxuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBtZXRob2Qgc2VuZFxuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBtZXRob2QgaXNTYXZlZFxuICogQGhpZGVcbiAqL1xuXG4vKipcbiAqIEBtZXRob2QgaXNTYXZpbmdcbiAqIEBoaWRlXG4gKi9cblxuQW5ub3VuY2VtZW50LnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vYW5ub3VuY2VtZW50cy8nO1xuXG5Bbm5vdW5jZW1lbnQuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuQW5ub3VuY2VtZW50Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXS5jb25jYXQoQ29udmVyc2F0aW9uTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuQW5ub3VuY2VtZW50LmluT2JqZWN0SWdub3JlID0gQ29udmVyc2F0aW9uTWVzc2FnZS5pbk9iamVjdElnbm9yZTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KEFubm91bmNlbWVudCwgW0Fubm91bmNlbWVudCwgJ0Fubm91bmNlbWVudCddKTtcblN5bmNhYmxlLnN1YmNsYXNzZXMucHVzaChBbm5vdW5jZW1lbnQpO1xubW9kdWxlLmV4cG9ydHMgPSBBbm5vdW5jZW1lbnQ7XG4iXX0=
