'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * For purposes of API consistency across SDKs, this class is not exposed.
 * Instead, customers will see only the layer.Message class.
 *
 * @class layer.Message.ChannelMessage
 * @extends layer.Message
 */
var Root = require('../root');
var Message = require('./message');
var ClientRegistry = require('../client-registry');
var LayerError = require('../layer-error');
var Constants = require('../const');
var logger = require('../logger');

var ChannelMessage = function (_Message) {
  _inherits(ChannelMessage, _Message);

  function ChannelMessage(options) {
    _classCallCheck(this, ChannelMessage);

    if (options.channel) options.conversationId = options.channel.id;

    var _this = _possibleConstructorReturn(this, (ChannelMessage.__proto__ || Object.getPrototypeOf(ChannelMessage)).call(this, options));

    var client = _this.getClient();
    _this.isInitializing = false;
    if (options && options.fromServer) {
      client._addMessage(_this);
    }
    return _this;
  }

  /**
   * Get the layer.Channel associated with this layer.Message.ChannelMessage.
   *
   * @method getConversation
   * @param {Boolean} load       Pass in true if the layer.Channel should be loaded if not found locally
   * @return {layer.Channel}
   */


  _createClass(ChannelMessage, [{
    key: 'getConversation',
    value: function getConversation(load) {
      if (this.conversationId) {
        return ClientRegistry.get(this.clientId).getChannel(this.conversationId, load);
      }
      return null;
    }

    /**
     * Send a Read or Delivery Receipt to the server; not supported yet.
     *
     * @method sendReceipt
     * @param {string} [type=layer.Constants.RECEIPT_STATE.READ] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     * @return {layer.Message.ChannelMessage} this
     */

  }, {
    key: 'sendReceipt',
    value: function sendReceipt() {
      var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Constants.RECEIPT_STATE.READ;

      logger.warn('Receipts not supported for Channel Messages yet');
      return this;
    }

    /**
     * Delete the Message from the server.
     *
     * ```
     * message.delete();
     * ```
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
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Message.load(id, client);
      });

      this._deleted();
      this.destroy();
    }

    /**
     * On loading this one item from the server, after _populateFromServer has been called, due final setup.
     *
     * @method _loaded
     * @private
     * @param {Object} data  Data from server
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.conversationId = data.channel.id;
      this.getClient()._addMessage(this);
    }

    /*
     * Creates a message from the server's representation of a message.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the message
     * @param  {layer.Client} client
     * @return {layer.Message.ChannelMessage}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      var conversationId = void 0;
      if (message.channel) {
        conversationId = message.channel.id;
      } else {
        conversationId = message.conversationId;
      }

      return new ChannelMessage({
        conversationId: conversationId,
        fromServer: message,
        clientId: client.appId,
        _fromDB: message._fromDB,
        _notify: fromWebsocket && message.is_unread && message.sender.user_id !== client.user.userId
      });
    }
  }]);

  return ChannelMessage;
}(Message);

/*
 * True if this Message has been read by this user.
 *
 * You can change isRead programatically
 *
 *      m.isRead = true;
 *
 * This will automatically notify the server that the message was read by your user.
 * @type {Boolean}
 */


ChannelMessage.prototype.isRead = false;

ChannelMessage.inObjectIgnore = Message.inObjectIgnore;
ChannelMessage._supportedEvents = [].concat(Message._supportedEvents);
Root.initClass.apply(ChannelMessage, [ChannelMessage, 'ChannelMessage']);
module.exports = ChannelMessage;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY2hhbm5lbC1tZXNzYWdlLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTWVzc2FnZSIsIkNsaWVudFJlZ2lzdHJ5IiwiTGF5ZXJFcnJvciIsIkNvbnN0YW50cyIsImxvZ2dlciIsIkNoYW5uZWxNZXNzYWdlIiwib3B0aW9ucyIsImNoYW5uZWwiLCJjb252ZXJzYXRpb25JZCIsImlkIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiaXNJbml0aWFsaXppbmciLCJmcm9tU2VydmVyIiwiX2FkZE1lc3NhZ2UiLCJsb2FkIiwiZ2V0IiwiY2xpZW50SWQiLCJnZXRDaGFubmVsIiwidHlwZSIsIlJFQ0VJUFRfU1RBVEUiLCJSRUFEIiwid2FybiIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiX3hociIsInVybCIsIm1ldGhvZCIsInJlc3VsdCIsInN1Y2Nlc3MiLCJkYXRhIiwiX2RlbGV0ZWQiLCJkZXN0cm95IiwibWVzc2FnZSIsImZyb21XZWJzb2NrZXQiLCJhcHBJZCIsIl9mcm9tREIiLCJfbm90aWZ5IiwiaXNfdW5yZWFkIiwic2VuZGVyIiwidXNlcl9pZCIsInVzZXIiLCJ1c2VySWQiLCJwcm90b3R5cGUiLCJpc1JlYWQiLCJpbk9iamVjdElnbm9yZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7OztBQU9BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsVUFBVUQsUUFBUSxXQUFSLENBQWhCO0FBQ0EsSUFBTUUsaUJBQWlCRixRQUFRLG9CQUFSLENBQXZCO0FBQ0EsSUFBTUcsYUFBYUgsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1JLFlBQVlKLFFBQVEsVUFBUixDQUFsQjtBQUNBLElBQU1LLFNBQVNMLFFBQVEsV0FBUixDQUFmOztJQUVNTSxj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LGdCQUFqQixDQUFyQztBQUNBOEMsT0FBT0MsT0FBUCxHQUFpQi9DLGNBQWpCIiwiZmlsZSI6ImNoYW5uZWwtbWVzc2FnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBGb3IgcHVycG9zZXMgb2YgQVBJIGNvbnNpc3RlbmN5IGFjcm9zcyBTREtzLCB0aGlzIGNsYXNzIGlzIG5vdCBleHBvc2VkLlxuICogSW5zdGVhZCwgY3VzdG9tZXJzIHdpbGwgc2VlIG9ubHkgdGhlIGxheWVyLk1lc3NhZ2UgY2xhc3MuXG4gKlxuICogQGNsYXNzIGxheWVyLk1lc3NhZ2UuQ2hhbm5lbE1lc3NhZ2VcbiAqIEBleHRlbmRzIGxheWVyLk1lc3NhZ2VcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IE1lc3NhZ2UgPSByZXF1aXJlKCcuL21lc3NhZ2UnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXInKTtcblxuY2xhc3MgQ2hhbm5lbE1lc3NhZ2UgZXh0ZW5kcyBNZXNzYWdlIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLmNoYW5uZWwpIG9wdGlvbnMuY29udmVyc2F0aW9uSWQgPSBvcHRpb25zLmNoYW5uZWwuaWQ7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5DaGFubmVsIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGxheWVyLk1lc3NhZ2UuQ2hhbm5lbE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gbG9hZCAgICAgICBQYXNzIGluIHRydWUgaWYgdGhlIGxheWVyLkNoYW5uZWwgc2hvdWxkIGJlIGxvYWRlZCBpZiBub3QgZm91bmQgbG9jYWxseVxuICAgKiBAcmV0dXJuIHtsYXllci5DaGFubmVsfVxuICAgKi9cbiAgZ2V0Q29udmVyc2F0aW9uKGxvYWQpIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldCh0aGlzLmNsaWVudElkKS5nZXRDaGFubmVsKHRoaXMuY29udmVyc2F0aW9uSWQsIGxvYWQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgUmVhZCBvciBEZWxpdmVyeSBSZWNlaXB0IHRvIHRoZSBzZXJ2ZXI7IG5vdCBzdXBwb3J0ZWQgeWV0LlxuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRSZWNlaXB0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbdHlwZT1sYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEXSAtIE9uZSBvZiBsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEIG9yIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLkRFTElWRVJZXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ2hhbm5lbE1lc3NhZ2V9IHRoaXNcbiAgICovXG4gIHNlbmRSZWNlaXB0KHR5cGUgPSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKSB7XG4gICAgbG9nZ2VyLndhcm4oJ1JlY2VpcHRzIG5vdCBzdXBwb3J0ZWQgZm9yIENoYW5uZWwgTWVzc2FnZXMgeWV0Jyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBNZXNzYWdlIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NhZ2UuZGVsZXRlKCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVxuICAgKi9cbiAgZGVsZXRlKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICghcmVzdWx0LmRhdGEgfHwgcmVzdWx0LmRhdGEuaWQgIT09ICdub3RfZm91bmQnKSkgTWVzc2FnZS5sb2FkKGlkLCBjbGllbnQpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fZGVsZXRlZCgpO1xuICAgIHRoaXMuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIE9uIGxvYWRpbmcgdGhpcyBvbmUgaXRlbSBmcm9tIHRoZSBzZXJ2ZXIsIGFmdGVyIF9wb3B1bGF0ZUZyb21TZXJ2ZXIgaGFzIGJlZW4gY2FsbGVkLCBkdWUgZmluYWwgc2V0dXAuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAgRGF0YSBmcm9tIHNlcnZlclxuICAgKi9cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGRhdGEuY2hhbm5lbC5pZDtcbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRNZXNzYWdlKHRoaXMpO1xuICB9XG5cblxuICAvKlxuICAgKiBDcmVhdGVzIGEgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiBhIG1lc3NhZ2UuXG4gICAqXG4gICAqIFNpbWlsYXIgdG8gX3BvcHVsYXRlRnJvbVNlcnZlciwgaG93ZXZlciwgdGhpcyBtZXRob2QgdGFrZXMgYVxuICAgKiBtZXNzYWdlIGRlc2NyaXB0aW9uIGFuZCByZXR1cm5zIGEgbmV3IG1lc3NhZ2UgaW5zdGFuY2UgdXNpbmcgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiB0byBzZXR1cCB0aGUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1lc3NhZ2UgLSBTZXJ2ZXIncyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbWVzc2FnZVxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlLkNoYW5uZWxNZXNzYWdlfVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKG1lc3NhZ2UsIGNsaWVudCkge1xuICAgIGNvbnN0IGZyb21XZWJzb2NrZXQgPSBtZXNzYWdlLmZyb21XZWJzb2NrZXQ7XG4gICAgbGV0IGNvbnZlcnNhdGlvbklkO1xuICAgIGlmIChtZXNzYWdlLmNoYW5uZWwpIHtcbiAgICAgIGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jaGFubmVsLmlkO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb252ZXJzYXRpb25JZCA9IG1lc3NhZ2UuY29udmVyc2F0aW9uSWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBDaGFubmVsTWVzc2FnZSh7XG4gICAgICBjb252ZXJzYXRpb25JZCxcbiAgICAgIGZyb21TZXJ2ZXI6IG1lc3NhZ2UsXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgICAgX2Zyb21EQjogbWVzc2FnZS5fZnJvbURCLFxuICAgICAgX25vdGlmeTogZnJvbVdlYnNvY2tldCAmJiBtZXNzYWdlLmlzX3VucmVhZCAmJiBtZXNzYWdlLnNlbmRlci51c2VyX2lkICE9PSBjbGllbnQudXNlci51c2VySWQsXG4gICAgfSk7XG4gIH1cbn1cblxuLypcbiAqIFRydWUgaWYgdGhpcyBNZXNzYWdlIGhhcyBiZWVuIHJlYWQgYnkgdGhpcyB1c2VyLlxuICpcbiAqIFlvdSBjYW4gY2hhbmdlIGlzUmVhZCBwcm9ncmFtYXRpY2FsbHlcbiAqXG4gKiAgICAgIG0uaXNSZWFkID0gdHJ1ZTtcbiAqXG4gKiBUaGlzIHdpbGwgYXV0b21hdGljYWxseSBub3RpZnkgdGhlIHNlcnZlciB0aGF0IHRoZSBtZXNzYWdlIHdhcyByZWFkIGJ5IHlvdXIgdXNlci5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5DaGFubmVsTWVzc2FnZS5wcm90b3R5cGUuaXNSZWFkID0gZmFsc2U7XG5cbkNoYW5uZWxNZXNzYWdlLmluT2JqZWN0SWdub3JlID0gTWVzc2FnZS5pbk9iamVjdElnbm9yZTtcbkNoYW5uZWxNZXNzYWdlLl9zdXBwb3J0ZWRFdmVudHMgPSBbXS5jb25jYXQoTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KENoYW5uZWxNZXNzYWdlLCBbQ2hhbm5lbE1lc3NhZ2UsICdDaGFubmVsTWVzc2FnZSddKTtcbm1vZHVsZS5leHBvcnRzID0gQ2hhbm5lbE1lc3NhZ2U7XG4iXX0=
