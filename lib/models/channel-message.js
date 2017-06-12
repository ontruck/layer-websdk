'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
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
        if (!result.success && (!result.data || result.data.id !== 'not_found' && result.data.id !== 'authentication_required')) {
          Message.load(id, client);
        }
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

    /**
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY2hhbm5lbC1tZXNzYWdlLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTWVzc2FnZSIsIkNsaWVudFJlZ2lzdHJ5IiwiTGF5ZXJFcnJvciIsIkNvbnN0YW50cyIsImxvZ2dlciIsIkNoYW5uZWxNZXNzYWdlIiwib3B0aW9ucyIsImNoYW5uZWwiLCJjb252ZXJzYXRpb25JZCIsImlkIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiaXNJbml0aWFsaXppbmciLCJmcm9tU2VydmVyIiwiX2FkZE1lc3NhZ2UiLCJsb2FkIiwiZ2V0IiwiY2xpZW50SWQiLCJnZXRDaGFubmVsIiwidHlwZSIsIlJFQ0VJUFRfU1RBVEUiLCJSRUFEIiwid2FybiIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiX3hociIsInVybCIsIm1ldGhvZCIsInJlc3VsdCIsInN1Y2Nlc3MiLCJkYXRhIiwiX2RlbGV0ZWQiLCJkZXN0cm95IiwibWVzc2FnZSIsImZyb21XZWJzb2NrZXQiLCJhcHBJZCIsIl9mcm9tREIiLCJfbm90aWZ5IiwiaXNfdW5yZWFkIiwic2VuZGVyIiwidXNlcl9pZCIsInVzZXIiLCJ1c2VySWQiLCJwcm90b3R5cGUiLCJpc1JlYWQiLCJpbk9iamVjdElnbm9yZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7OztBQU9BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsVUFBVUQsUUFBUSxXQUFSLENBQWhCO0FBQ0EsSUFBTUUsaUJBQWlCRixRQUFRLG9CQUFSLENBQXZCO0FBQ0EsSUFBTUcsYUFBYUgsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1JLFlBQVlKLFFBQVEsVUFBUixDQUFsQjtBQUNBLElBQU1LLFNBQVNMLFFBQVEsV0FBUixDQUFmOztJQUVNTSxj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bUQsU0FBTCxDQUFlQyxLQUFmLENBQXFCN0MsY0FBckIsRUFBcUMsQ0FBQ0EsY0FBRCxFQUFpQixnQkFBakIsQ0FBckM7QUFDQThDLE9BQU9DLE9BQVAsR0FBaUIvQyxjQUFqQiIsImZpbGUiOiJjaGFubmVsLW1lc3NhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZvciBwdXJwb3NlcyBvZiBBUEkgY29uc2lzdGVuY3kgYWNyb3NzIFNES3MsIHRoaXMgY2xhc3MgaXMgbm90IGV4cG9zZWQuXG4gKiBJbnN0ZWFkLCBjdXN0b21lcnMgd2lsbCBzZWUgb25seSB0aGUgbGF5ZXIuTWVzc2FnZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZVxuICogQGV4dGVuZHMgbGF5ZXIuTWVzc2FnZVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZScpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuXG5jbGFzcyBDaGFubmVsTWVzc2FnZSBleHRlbmRzIE1lc3NhZ2Uge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY2hhbm5lbCkgb3B0aW9ucy5jb252ZXJzYXRpb25JZCA9IG9wdGlvbnMuY2hhbm5lbC5pZDtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgY2xpZW50Ll9hZGRNZXNzYWdlKHRoaXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxheWVyLkNoYW5uZWwgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDb252ZXJzYXRpb25cbiAgICogQHBhcmFtIHtCb29sZWFufSBsb2FkICAgICAgIFBhc3MgaW4gdHJ1ZSBpZiB0aGUgbGF5ZXIuQ2hhbm5lbCBzaG91bGQgYmUgbG9hZGVkIGlmIG5vdCBmb3VuZCBsb2NhbGx5XG4gICAqIEByZXR1cm4ge2xheWVyLkNoYW5uZWx9XG4gICAqL1xuICBnZXRDb252ZXJzYXRpb24obG9hZCkge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpLmdldENoYW5uZWwodGhpcy5jb252ZXJzYXRpb25JZCwgbG9hZCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgYSBSZWFkIG9yIERlbGl2ZXJ5IFJlY2VpcHQgdG8gdGhlIHNlcnZlcjsgbm90IHN1cHBvcnRlZCB5ZXQuXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFJlY2VpcHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlPWxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQURdIC0gT25lIG9mIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgb3IgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUllcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgc2VuZFJlY2VpcHQodHlwZSA9IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpIHtcbiAgICBsb2dnZXIud2FybignUmVjZWlwdHMgbm90IHN1cHBvcnRlZCBmb3IgQ2hhbm5lbCBNZXNzYWdlcyB5ZXQnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIE1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZS5kZWxldGUoKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqL1xuICBkZWxldGUoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgY29uc3QgaWQgPSB0aGlzLmlkO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgKCFyZXN1bHQuZGF0YSB8fCAocmVzdWx0LmRhdGEuaWQgIT09ICdub3RfZm91bmQnICYmIHJlc3VsdC5kYXRhLmlkICE9PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnKSkpIHtcbiAgICAgICAgTWVzc2FnZS5sb2FkKGlkLCBjbGllbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fZGVsZXRlZCgpO1xuICAgIHRoaXMuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIE9uIGxvYWRpbmcgdGhpcyBvbmUgaXRlbSBmcm9tIHRoZSBzZXJ2ZXIsIGFmdGVyIF9wb3B1bGF0ZUZyb21TZXJ2ZXIgaGFzIGJlZW4gY2FsbGVkLCBkdWUgZmluYWwgc2V0dXAuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAgRGF0YSBmcm9tIHNlcnZlclxuICAgKi9cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGRhdGEuY2hhbm5lbC5pZDtcbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRNZXNzYWdlKHRoaXMpO1xuICB9XG5cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyJ3MgcmVwcmVzZW50YXRpb24gb2YgYSBtZXNzYWdlLlxuICAgKlxuICAgKiBTaW1pbGFyIHRvIF9wb3B1bGF0ZUZyb21TZXJ2ZXIsIGhvd2V2ZXIsIHRoaXMgbWV0aG9kIHRha2VzIGFcbiAgICogbWVzc2FnZSBkZXNjcmlwdGlvbiBhbmQgcmV0dXJucyBhIG5ldyBtZXNzYWdlIGluc3RhbmNlIHVzaW5nIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogdG8gc2V0dXAgdGhlIHZhbHVlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtZXNzYWdlIC0gU2VydmVyJ3MgcmVwcmVzZW50YXRpb24gb2YgdGhlIG1lc3NhZ2VcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZS5DaGFubmVsTWVzc2FnZX1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLCBjbGllbnQpIHtcbiAgICBjb25zdCBmcm9tV2Vic29ja2V0ID0gbWVzc2FnZS5mcm9tV2Vic29ja2V0O1xuICAgIGxldCBjb252ZXJzYXRpb25JZDtcbiAgICBpZiAobWVzc2FnZS5jaGFubmVsKSB7XG4gICAgICBjb252ZXJzYXRpb25JZCA9IG1lc3NhZ2UuY2hhbm5lbC5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udmVyc2F0aW9uSWQgPSBtZXNzYWdlLmNvbnZlcnNhdGlvbklkO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQ2hhbm5lbE1lc3NhZ2Uoe1xuICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICBmcm9tU2VydmVyOiBtZXNzYWdlLFxuICAgICAgY2xpZW50SWQ6IGNsaWVudC5hcHBJZCxcbiAgICAgIF9mcm9tREI6IG1lc3NhZ2UuX2Zyb21EQixcbiAgICAgIF9ub3RpZnk6IGZyb21XZWJzb2NrZXQgJiYgbWVzc2FnZS5pc191bnJlYWQgJiYgbWVzc2FnZS5zZW5kZXIudXNlcl9pZCAhPT0gY2xpZW50LnVzZXIudXNlcklkLFxuICAgIH0pO1xuICB9XG59XG5cbi8qXG4gKiBUcnVlIGlmIHRoaXMgTWVzc2FnZSBoYXMgYmVlbiByZWFkIGJ5IHRoaXMgdXNlci5cbiAqXG4gKiBZb3UgY2FuIGNoYW5nZSBpc1JlYWQgcHJvZ3JhbWF0aWNhbGx5XG4gKlxuICogICAgICBtLmlzUmVhZCA9IHRydWU7XG4gKlxuICogVGhpcyB3aWxsIGF1dG9tYXRpY2FsbHkgbm90aWZ5IHRoZSBzZXJ2ZXIgdGhhdCB0aGUgbWVzc2FnZSB3YXMgcmVhZCBieSB5b3VyIHVzZXIuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuQ2hhbm5lbE1lc3NhZ2UucHJvdG90eXBlLmlzUmVhZCA9IGZhbHNlO1xuXG5DaGFubmVsTWVzc2FnZS5pbk9iamVjdElnbm9yZSA9IE1lc3NhZ2UuaW5PYmplY3RJZ25vcmU7XG5DaGFubmVsTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzID0gW10uY29uY2F0KE1lc3NhZ2UuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShDaGFubmVsTWVzc2FnZSwgW0NoYW5uZWxNZXNzYWdlLCAnQ2hhbm5lbE1lc3NhZ2UnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENoYW5uZWxNZXNzYWdlO1xuIl19
