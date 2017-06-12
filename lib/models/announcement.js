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
 * @class  layer.Message.Announcement
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
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Syncable.load(id, client);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvYW5ub3VuY2VtZW50LmpzIl0sIm5hbWVzIjpbIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJyZXF1aXJlIiwiU3luY2FibGUiLCJSb290IiwiTGF5ZXJFcnJvciIsIkFubm91bmNlbWVudCIsImRhdGEiLCJnZXRDbGllbnQiLCJfYWRkTWVzc2FnZSIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiaWQiLCJjbGllbnQiLCJfeGhyIiwidXJsIiwibWV0aG9kIiwicmVzdWx0Iiwic3VjY2VzcyIsImxvYWQiLCJfZGVsZXRlZCIsImRlc3Ryb3kiLCJtZXNzYWdlIiwiZnJvbVdlYnNvY2tldCIsImZyb21TZXJ2ZXIiLCJjbGllbnRJZCIsImFwcElkIiwiX25vdGlmeSIsImlzX3VucmVhZCIsInByZWZpeFVVSUQiLCJidWJibGVFdmVudFBhcmVudCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbk9iamVjdElnbm9yZSIsImluaXRDbGFzcyIsImFwcGx5Iiwic3ViY2xhc3NlcyIsInB1c2giLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7QUFhQSxJQUFNQSxzQkFBc0JDLFFBQVEsd0JBQVIsQ0FBNUI7QUFDQSxJQUFNQyxXQUFXRCxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNRSxPQUFPRixRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7O0lBR01JLFk7Ozs7Ozs7Ozs7Ozs7QUFFSjs7OzsyQkFJTyxDQUFFOztBQUVUOzs7Ozs7OzRCQUlRLENBQUU7O0FBRVY7Ozs7Ozs7c0NBSWtCLENBQUU7Ozs0QkFFWkMsSSxFQUFNO0FBQ1osV0FBS0MsU0FBTCxHQUFpQkMsV0FBakIsQ0FBNkIsSUFBN0I7QUFDRDs7QUFFRDs7Ozs7Ozs7OEJBS1M7QUFDUCxVQUFJLEtBQUtDLFdBQVQsRUFBc0IsTUFBTSxJQUFJQyxLQUFKLENBQVVOLFdBQVdPLFVBQVgsQ0FBc0JGLFdBQWhDLENBQU47O0FBRXRCLFVBQU1HLEtBQUssS0FBS0EsRUFBaEI7QUFDQSxVQUFNQyxTQUFTLEtBQUtOLFNBQUwsRUFBZjtBQUNBLFdBQUtPLElBQUwsQ0FBVTtBQUNSQyxhQUFLLEVBREc7QUFFUkMsZ0JBQVE7QUFGQSxPQUFWLEVBR0csVUFBQ0MsTUFBRCxFQUFZO0FBQ2IsWUFBSSxDQUFDQSxPQUFPQyxPQUFSLEtBQW9CLENBQUNELE9BQU9YLElBQVIsSUFBZ0JXLE9BQU9YLElBQVAsQ0FBWU0sRUFBWixLQUFtQixXQUF2RCxDQUFKLEVBQXlFVixTQUFTaUIsSUFBVCxDQUFjUCxFQUFkLEVBQWtCQyxNQUFsQjtBQUMxRSxPQUxEOztBQU9BLFdBQUtPLFFBQUw7QUFDQSxXQUFLQyxPQUFMO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7c0NBYXlCQyxPLEVBQVNULE0sRUFBUTtBQUN4QyxVQUFNVSxnQkFBZ0JELFFBQVFDLGFBQTlCO0FBQ0EsYUFBTyxJQUFJbEIsWUFBSixDQUFpQjtBQUN0Qm1CLG9CQUFZRixPQURVO0FBRXRCRyxrQkFBVVosT0FBT2EsS0FGSztBQUd0QkMsaUJBQVNKLGlCQUFpQkQsUUFBUU07QUFIWixPQUFqQixDQUFQO0FBS0Q7Ozs7RUFqRXdCNUIsbUI7O0FBb0UzQjs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQTs7Ozs7QUFLQUssYUFBYXdCLFVBQWIsR0FBMEIseUJBQTFCOztBQUVBeEIsYUFBYXlCLGlCQUFiLEdBQWlDLFdBQWpDOztBQUVBekIsYUFBYTBCLGdCQUFiLEdBQWdDLEdBQUdDLE1BQUgsQ0FBVWhDLG9CQUFvQitCLGdCQUE5QixDQUFoQzs7QUFFQTFCLGFBQWE0QixjQUFiLEdBQThCakMsb0JBQW9CaUMsY0FBbEQ7QUFDQTlCLEtBQUsrQixTQUFMLENBQWVDLEtBQWYsQ0FBcUI5QixZQUFyQixFQUFtQyxDQUFDQSxZQUFELEVBQWUsY0FBZixDQUFuQztBQUNBSCxTQUFTa0MsVUFBVCxDQUFvQkMsSUFBcEIsQ0FBeUJoQyxZQUF6QjtBQUNBaUMsT0FBT0MsT0FBUCxHQUFpQmxDLFlBQWpCIiwiZmlsZSI6ImFubm91bmNlbWVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuLyoqXG4gKiBUaGUgQW5ub3VuY2VtZW50IGNsYXNzIHJlcHJlc2VudHMgYSB0eXBlIG9mIE1lc3NhZ2Ugc2VudCBieSBhIHNlcnZlci5cbiAqXG4gKiBBbm5vdW5jZW1lbnRzIGNhbiBub3QgYmUgc2VudCB1c2luZyB0aGUgV2ViU0RLLCBvbmx5IHJlY2VpdmVkLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byBpbnN0YW50aWF0ZSBhbiBBbm5vdW5jZW1lbnQ7IHRoZXkgc2hvdWxkIG9ubHkgYmVcbiAqIGRlbGl2ZXJlZCB2aWEgYG1lc3NhZ2VzOmFkZGAgZXZlbnRzIHdoZW4gYW4gQW5ub3VuY2VtZW50IGlzIHByb3ZpZGVkIHZpYVxuICogd2Vic29ja2V0IHRvIHRoZSBjbGllbnQsIGFuZCBgY2hhbmdlYCBldmVudHMgb24gYW4gQW5ub3VuY2VtZW50cyBRdWVyeS5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lc3NhZ2UuQW5ub3VuY2VtZW50XG4gKiBAZXh0ZW5kcyBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2VcbiAqL1xuXG5jb25zdCBDb252ZXJzYXRpb25NZXNzYWdlID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb24tbWVzc2FnZScpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5cblxuY2xhc3MgQW5ub3VuY2VtZW50IGV4dGVuZHMgQ29udmVyc2F0aW9uTWVzc2FnZSB7XG5cbiAgLyoqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAaGlkZVxuICAgKi9cbiAgc2VuZCgpIHt9XG5cbiAgLyoqXG4gICAqIEBtZXRob2QgX3NlbmRcbiAgICogQGhpZGVcbiAgICovXG4gIF9zZW5kKCkge31cblxuICAvKipcbiAgICogQG1ldGhvZCBnZXRDb252ZXJzYXRpb25cbiAgICogQGhpZGVcbiAgICovXG4gIGdldENvbnZlcnNhdGlvbigpIHt9XG5cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIEFubm91bmNlbWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqL1xuICBkZWxldGUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgY29uc3QgaWQgPSB0aGlzLmlkO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgKCFyZXN1bHQuZGF0YSB8fCByZXN1bHQuZGF0YS5pZCAhPT0gJ25vdF9mb3VuZCcpKSBTeW5jYWJsZS5sb2FkKGlkLCBjbGllbnQpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fZGVsZXRlZCgpO1xuICAgIHRoaXMuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gQW5ub3VuY2VtZW50IGZyb20gdGhlIHNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIGFuIEFubm91bmNlbWVudC5cbiAgICpcbiAgICogU2ltaWxhciB0byBfcG9wdWxhdGVGcm9tU2VydmVyLCBob3dldmVyLCB0aGlzIG1ldGhvZCB0YWtlcyBhXG4gICAqIG1lc3NhZ2UgZGVzY3JpcHRpb24gYW5kIHJldHVybnMgYSBuZXcgbWVzc2FnZSBpbnN0YW5jZSB1c2luZyBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIHRvIHNldHVwIHRoZSB2YWx1ZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gbWVzc2FnZSAtIFNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBhbm5vdW5jZW1lbnRcbiAgICogQHJldHVybiB7bGF5ZXIuQW5ub3VuY2VtZW50fVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKG1lc3NhZ2UsIGNsaWVudCkge1xuICAgIGNvbnN0IGZyb21XZWJzb2NrZXQgPSBtZXNzYWdlLmZyb21XZWJzb2NrZXQ7XG4gICAgcmV0dXJuIG5ldyBBbm5vdW5jZW1lbnQoe1xuICAgICAgZnJvbVNlcnZlcjogbWVzc2FnZSxcbiAgICAgIGNsaWVudElkOiBjbGllbnQuYXBwSWQsXG4gICAgICBfbm90aWZ5OiBmcm9tV2Vic29ja2V0ICYmIG1lc3NhZ2UuaXNfdW5yZWFkLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQHByb3BlcnR5IHtTdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQHByb3BlcnR5IHtPYmplY3R9IGRlbGl2ZXJ5U3RhdHVzXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQHByb3BlcnR5IHtPYmplY3R9IHJlYWRTdGF0dXNcbiAqIEBoaWRlXG4gKi9cblxuLyoqXG4gKiBAcHJvcGVydHkge09iamVjdH0gcmVjaXBpZW50U3RhdHVzXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQG1ldGhvZCBhZGRQYXJ0XG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQG1ldGhvZCBzZW5kXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQG1ldGhvZCBpc1NhdmVkXG4gKiBAaGlkZVxuICovXG5cbi8qKlxuICogQG1ldGhvZCBpc1NhdmluZ1xuICogQGhpZGVcbiAqL1xuXG5Bbm5vdW5jZW1lbnQucHJlZml4VVVJRCA9ICdsYXllcjovLy9hbm5vdW5jZW1lbnRzLyc7XG5cbkFubm91bmNlbWVudC5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG5Bbm5vdW5jZW1lbnQuX3N1cHBvcnRlZEV2ZW50cyA9IFtdLmNvbmNhdChDb252ZXJzYXRpb25NZXNzYWdlLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Bbm5vdW5jZW1lbnQuaW5PYmplY3RJZ25vcmUgPSBDb252ZXJzYXRpb25NZXNzYWdlLmluT2JqZWN0SWdub3JlO1xuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQW5ub3VuY2VtZW50LCBbQW5ub3VuY2VtZW50LCAnQW5ub3VuY2VtZW50J10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKEFubm91bmNlbWVudCk7XG5tb2R1bGUuZXhwb3J0cyA9IEFubm91bmNlbWVudDtcbiJdfQ==
