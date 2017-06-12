'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A layer.Message instance for use within layer.Conversation.
 *
 * @class layer.Message.ConversationMessage
 * @extends layer.Message
 */
var Root = require('../root');
var Message = require('./message');
var ClientRegistry = require('../client-registry');
var LayerError = require('../layer-error');
var Constants = require('../const');
var Util = require('../client-utils');

var ConversationMessage = function (_Message) {
  _inherits(ConversationMessage, _Message);

  function ConversationMessage(options) {
    _classCallCheck(this, ConversationMessage);

    if (options.conversation) options.conversationId = options.conversation.id;

    var _this = _possibleConstructorReturn(this, (ConversationMessage.__proto__ || Object.getPrototypeOf(ConversationMessage)).call(this, options));

    _this._disableEvents = true;
    if (!options.fromServer) _this.recipientStatus = {};else _this.__updateRecipientStatus(_this.recipientStatus);
    _this._disableEvents = false;

    var client = _this.getClient();
    _this.isInitializing = false;
    if (options && options.fromServer) {
      client._addMessage(_this);
      var status = _this.recipientStatus[client.user.id];
      if (status && status !== Constants.RECEIPT_STATE.READ && status !== Constants.RECEIPT_STATE.DELIVERED) {
        Util.defer(function () {
          return _this._sendReceipt('delivery');
        });
      }
    }
    return _this;
  }

  /**
   * Get the layer.Conversation associated with this layer.Message.ConversationMessage.
   *
   * @method getConversation
   * @param {Boolean} load       Pass in true if the layer.Conversation should be loaded if not found locally
   * @return {layer.Conversation}
   */


  _createClass(ConversationMessage, [{
    key: 'getConversation',
    value: function getConversation(load) {
      if (this.conversationId) {
        return ClientRegistry.get(this.clientId).getConversation(this.conversationId, load);
      }
      return null;
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
      this.conversationId = data.conversation.id;
      this.getClient()._addMessage(this);
    }

    /**
     * Accessor called whenever the app accesses `message.recipientStatus`.
     *
     * Insures that participants who haven't yet been sent the Message are marked as layer.Constants.RECEIPT_STATE.PENDING
     *
     * @method __getRecipientStatus
     * @param {string} pKey - The actual property key where the value is stored
     * @private
     * @return {Object}
     */

  }, {
    key: '__getRecipientStatus',
    value: function __getRecipientStatus(pKey) {
      var value = this[pKey] || {};
      var client = this.getClient();
      if (client) {
        var id = client.user.id;
        var conversation = this.getConversation(false);
        if (conversation) {
          conversation.participants.forEach(function (participant) {
            if (!value[participant.id]) {
              value[participant.id] = participant.id === id ? Constants.RECEIPT_STATE.READ : Constants.RECEIPT_STATE.PENDING;
            }
          });
        }
      }
      return value;
    }

    /**
     * Handle changes to the recipientStatus property.
     *
     * Any time the recipientStatus property is set,
     * Recalculate all of the receipt related properties:
     *
     * 1. isRead
     * 2. readStatus
     * 3. deliveryStatus
     *
     * @method __updateRecipientStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     *
     */

  }, {
    key: '__updateRecipientStatus',
    value: function __updateRecipientStatus(status, oldStatus) {
      var conversation = this.getConversation(false);
      var client = this.getClient();

      if (!conversation || Util.doesObjectMatch(status, oldStatus)) return;

      var id = client.user.id;
      var isSender = this.sender.sessionOwner;
      var userHasRead = status[id] === Constants.RECEIPT_STATE.READ;

      try {
        // -1 so we don't count this user
        var userCount = conversation.participants.length - 1;

        // If sent by this user or read by this user, update isRead/unread
        if (!this.__isRead && (isSender || userHasRead)) {
          this.__isRead = true; // no __updateIsRead event fired
        }

        // Update the readStatus/deliveryStatus properties

        var _getReceiptStatus2 = this._getReceiptStatus(status, id),
            readCount = _getReceiptStatus2.readCount,
            deliveredCount = _getReceiptStatus2.deliveredCount;

        this._setReceiptStatus(readCount, deliveredCount, userCount);
      } catch (error) {}
      // Do nothing


      // Only trigger an event
      // 1. we're not initializing a new Message
      // 2. the user's state has been updated to read; we don't care about updates from other users if we aren't the sender.
      //    We also don't care about state changes to delivered; these do not inform rendering as the fact we are processing it
      //    proves its delivered.
      // 3. The user is the sender; in that case we do care about rendering receipts from other users
      if (!this.isInitializing && oldStatus) {
        var usersStateUpdatedToRead = userHasRead && oldStatus[id] !== Constants.RECEIPT_STATE.READ;
        // if (usersStateUpdatedToRead || isSender) {
        this._triggerAsync('messages:change', {
          oldValue: oldStatus,
          newValue: status,
          property: 'recipientStatus'
        });
        // }
      }
    }

    /**
     * Get the number of participants who have read and been delivered
     * this Message
     *
     * @method _getReceiptStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     * @param  {string} id - Identity ID for this user; not counted when reporting on how many people have read/received.
     * @return {Object} result
     * @return {number} result.readCount
     * @return {number} result.deliveredCount
     */

  }, {
    key: '_getReceiptStatus',
    value: function _getReceiptStatus(status, id) {
      var readCount = 0,
          deliveredCount = 0;
      Object.keys(status).filter(function (participant) {
        return participant !== id;
      }).forEach(function (participant) {
        if (status[participant] === Constants.RECEIPT_STATE.READ) {
          readCount++;
          deliveredCount++;
        } else if (status[participant] === Constants.RECEIPT_STATE.DELIVERED) {
          deliveredCount++;
        }
      });

      return {
        readCount: readCount,
        deliveredCount: deliveredCount
      };
    }

    /**
     * Sets the layer.Message.ConversationMessage.readStatus and layer.Message.ConversationMessage.deliveryStatus properties.
     *
     * @method _setReceiptStatus
     * @private
     * @param  {number} readCount
     * @param  {number} deliveredCount
     * @param  {number} userCount
     */

  }, {
    key: '_setReceiptStatus',
    value: function _setReceiptStatus(readCount, deliveredCount, userCount) {
      if (readCount === userCount) {
        this.readStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (readCount > 0) {
        this.readStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.readStatus = Constants.RECIPIENT_STATE.NONE;
      }
      if (deliveredCount === userCount) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (deliveredCount > 0) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.deliveryStatus = Constants.RECIPIENT_STATE.NONE;
      }
    }

    /**
     * Handle changes to the isRead property.
     *
     * If someone called m.isRead = true, AND
     * if it was previously false, AND
     * if the call didn't come from layer.Message.ConversationMessage.__updateRecipientStatus,
     * Then notify the server that the message has been read.
     *
     *
     * @method __updateIsRead
     * @private
     * @param  {boolean} value - True if isRead is true.
     */

  }, {
    key: '__updateIsRead',
    value: function __updateIsRead(value) {
      if (value) {
        if (!this._inPopulateFromServer) {
          this._sendReceipt(Constants.RECEIPT_STATE.READ);
        }
        this._triggerMessageRead();
        var conversation = this.getConversation(false);
        if (conversation) conversation.unreadCount--;
      }
    }

    /**
     * Trigger events indicating changes to the isRead/isUnread properties.
     *
     * @method _triggerMessageRead
     * @private
     */

  }, {
    key: '_triggerMessageRead',
    value: function _triggerMessageRead() {
      var value = this.isRead;
      this._triggerAsync('messages:change', {
        property: 'isRead',
        oldValue: !value,
        newValue: value
      });
      this._triggerAsync('messages:change', {
        property: 'isUnread',
        oldValue: value,
        newValue: !value
      });
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * For Read Receipt, you can also just write:
     *
     * ```
     * message.isRead = true;
     * ```
     *
     * You can retract a Delivery or Read Receipt; once marked as Delivered or Read, it can't go back.
     *
     * ```
     * messsage.sendReceipt(layer.Constants.RECEIPT_STATE.READ);
     * ```
     *
     * @method sendReceipt
     * @param {string} [type=layer.Constants.RECEIPT_STATE.READ] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     * @return {layer.Message.ConversationMessage} this
     */

  }, {
    key: 'sendReceipt',
    value: function sendReceipt() {
      var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Constants.RECEIPT_STATE.READ;

      if (type === Constants.RECEIPT_STATE.READ) {
        if (this.isRead) {
          return this;
        } else {
          // Without triggering the event, clearObject isn't called,
          // which means those using the toObject() data will have an isRead that doesn't match
          // this instance.  Which typically leads to lots of extra attempts
          // to mark the message as read.
          this.__isRead = true;
          this._triggerMessageRead();
          var conversation = this.getConversation(false);
          if (conversation) conversation.unreadCount--;
        }
      }
      this._sendReceipt(type);
      return this;
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * This bypasses any validation and goes direct to sending to the server.
     *
     * NOTE: Server errors are not handled; the local receipt state is suitable even
     * if out of sync with the server.
     *
     * @method _sendReceipt
     * @private
     * @param {string} [type=read] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     */

  }, {
    key: '_sendReceipt',
    value: function _sendReceipt(type) {
      var _this2 = this;

      // This little test exists so that we don't send receipts on Conversations we are no longer
      // participants in (participants = [] if we are not a participant)
      var conversation = this.getConversation(false);
      if (conversation && conversation.participants.length === 0) return;

      this._setSyncing();
      this._xhr({
        url: '/receipts',
        method: 'POST',
        data: {
          type: type
        },
        sync: {
          // This should not be treated as a POST/CREATE request on the Message
          operation: 'RECEIPT'
        }
      }, function () {
        return _this2._setSynced();
      });
    }

    /**
     * Delete the Message from the server.
     *
     * This call will support various deletion modes.  Calling without a deletion mode is deprecated.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes this Message from all of my devices; no effect on other users.
     *
     * @method delete
     * @param {String} deletionMode
     */
    // Abstract Method

  }, {
    key: 'delete',
    value: function _delete(mode) {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      var queryStr = void 0;
      switch (mode) {
        case Constants.DELETION_MODE.ALL:
        case true:
          queryStr = 'mode=all_participants';
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=my_devices';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '?' + queryStr,
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found' && result.data.id !== 'authentication_required')) {
          Message.load(id, client);
        }
      });

      this._deleted();
      this.destroy();
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(ConversationMessage.prototype.__proto__ || Object.getPrototypeOf(ConversationMessage.prototype), 'toObject', this).call(this);
        this._toObject.recipientStatus = Util.clone(this.recipientStatus);
      }
      return this._toObject;
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
     * @return {layer.Message.ConversationMessage}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      var conversationId = void 0;
      if (message.conversation) {
        conversationId = message.conversation.id;
      } else {
        conversationId = message.conversationId;
      }

      return new ConversationMessage({
        conversationId: conversationId,
        fromServer: message,
        clientId: client.appId,
        _fromDB: message._fromDB,
        _notify: fromWebsocket && message.is_unread && message.sender.user_id !== client.user.userId
      });
    }
  }]);

  return ConversationMessage;
}(Message);

/**
 * True if this Message has been read by this user.
 *
 * You can change isRead programatically
 *
 *      m.isRead = true;
 *
 * This will automatically notify the server that the message was read by your user.
 * @type {Boolean}
 */


ConversationMessage.prototype.isRead = false;

/**
 * Read/delivery State of all participants.
 *
 * This is an object containing keys for each participant,
 * and a value of:
 *
 * * layer.RECEIPT_STATE.SENT
 * * layer.RECEIPT_STATE.DELIVERED
 * * layer.RECEIPT_STATE.READ
 * * layer.RECEIPT_STATE.PENDING
 *
 * @type {Object}
 */
ConversationMessage.prototype.recipientStatus = null;

/**
 * Have the other participants read this Message yet.
 *
 * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.ConversationMessage.recipientStatus for a more detailed report.
 *
 * @type {String}
 */
ConversationMessage.prototype.readStatus = Constants.RECIPIENT_STATE.NONE;

/**
 * Have the other participants received this Message yet.
 *
  * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.ConversationMessage.recipientStatus for a more detailed report.
 *
 *
 * @type {String}
 */
ConversationMessage.prototype.deliveryStatus = Constants.RECIPIENT_STATE.NONE;

ConversationMessage.inObjectIgnore = Message.inObjectIgnore;
ConversationMessage._supportedEvents = [].concat(Message._supportedEvents);
Root.initClass.apply(ConversationMessage, [ConversationMessage, 'ConversationMessage']);
module.exports = ConversationMessage;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udmVyc2F0aW9uLW1lc3NhZ2UuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJNZXNzYWdlIiwiQ2xpZW50UmVnaXN0cnkiLCJMYXllckVycm9yIiwiQ29uc3RhbnRzIiwiVXRpbCIsIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJvcHRpb25zIiwiY29udmVyc2F0aW9uIiwiY29udmVyc2F0aW9uSWQiLCJpZCIsIl9kaXNhYmxlRXZlbnRzIiwiZnJvbVNlcnZlciIsInJlY2lwaWVudFN0YXR1cyIsIl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiaXNJbml0aWFsaXppbmciLCJfYWRkTWVzc2FnZSIsInN0YXR1cyIsInVzZXIiLCJSRUNFSVBUX1NUQVRFIiwiUkVBRCIsIkRFTElWRVJFRCIsImRlZmVyIiwiX3NlbmRSZWNlaXB0IiwibG9hZCIsImdldCIsImNsaWVudElkIiwiZ2V0Q29udmVyc2F0aW9uIiwiZGF0YSIsInBLZXkiLCJ2YWx1ZSIsInBhcnRpY2lwYW50cyIsImZvckVhY2giLCJwYXJ0aWNpcGFudCIsIlBFTkRJTkciLCJvbGRTdGF0dXMiLCJkb2VzT2JqZWN0TWF0Y2giLCJpc1NlbmRlciIsInNlbmRlciIsInNlc3Npb25Pd25lciIsInVzZXJIYXNSZWFkIiwidXNlckNvdW50IiwibGVuZ3RoIiwiX19pc1JlYWQiLCJfZ2V0UmVjZWlwdFN0YXR1cyIsInJlYWRDb3VudCIsImRlbGl2ZXJlZENvdW50IiwiX3NldFJlY2VpcHRTdGF0dXMiLCJlcnJvciIsInVzZXJzU3RhdGVVcGRhdGVkVG9SZWFkIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJwcm9wZXJ0eSIsIk9iamVjdCIsImtleXMiLCJmaWx0ZXIiLCJyZWFkU3RhdHVzIiwiUkVDSVBJRU5UX1NUQVRFIiwiQUxMIiwiU09NRSIsIk5PTkUiLCJkZWxpdmVyeVN0YXR1cyIsIl9pblBvcHVsYXRlRnJvbVNlcnZlciIsIl90cmlnZ2VyTWVzc2FnZVJlYWQiLCJ1bnJlYWRDb3VudCIsImlzUmVhZCIsInR5cGUiLCJfc2V0U3luY2luZyIsIl94aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwib3BlcmF0aW9uIiwiX3NldFN5bmNlZCIsIm1vZGUiLCJpc0Rlc3Ryb3llZCIsIkVycm9yIiwiZGljdGlvbmFyeSIsInF1ZXJ5U3RyIiwiREVMRVRJT05fTU9ERSIsIk1ZX0RFVklDRVMiLCJkZWxldGlvbk1vZGVVbnN1cHBvcnRlZCIsInJlc3VsdCIsInN1Y2Nlc3MiLCJfZGVsZXRlZCIsImRlc3Ryb3kiLCJfdG9PYmplY3QiLCJjbG9uZSIsIm1lc3NhZ2UiLCJmcm9tV2Vic29ja2V0IiwiYXBwSWQiLCJfZnJvbURCIiwiX25vdGlmeSIsImlzX3VucmVhZCIsInVzZXJfaWQiLCJ1c2VySWQiLCJwcm90b3R5cGUiLCJpbk9iamVjdElnbm9yZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFVBQVVELFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU1FLGlCQUFpQkYsUUFBUSxvQkFBUixDQUF2QjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNSSxZQUFZSixRQUFRLFVBQVIsQ0FBbEI7QUFDQSxJQUFNSyxPQUFPTCxRQUFRLGlCQUFSLENBQWI7O0lBRU1NLG1COzs7QUFDSiwrQkFBWUMsT0FBWixFQUFxQjtBQUFBOztBQUNuQixRQUFJQSxRQUFRQyxZQUFaLEVBQTBCRCxRQUFRRSxjQUFSLEdBQXlCRixRQUFRQyxZQUFSLENBQXFCRSxFQUE5Qzs7QUFEUCwwSUFFYkgsT0FGYTs7QUFJbkIsVUFBS0ksY0FBTCxHQUFzQixJQUF0QjtBQUNBLFFBQUksQ0FBQ0osUUFB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LGNBQTdDO0FBQ0E5RixvQkFBb0IrRixnQkFBcEIsR0FBdUMsR0FBR0MsTUFBSCxDQUFVckcsUUFBUW9HLGdCQUFsQixDQUF2QztBQUNBdEcsS0FBS3dHLFNBQUwsQ0FBZUMsS0FBZixDQUFxQmxHLG1CQUFyQixFQUEwQyxDQUFDQSxtQkFBRCxFQUFzQixxQkFBdEIsQ0FBMUM7QUFDQW1HLE9BQU9DLE9BQVAsR0FBaUJwRyxtQkFBakIiLCJmaWxlIjoiY29udmVyc2F0aW9uLW1lc3NhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgbGF5ZXIuTWVzc2FnZSBpbnN0YW5jZSBmb3IgdXNlIHdpdGhpbiBsYXllci5Db252ZXJzYXRpb24uXG4gKlxuICogQGNsYXNzIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZVxuICogQGV4dGVuZHMgbGF5ZXIuTWVzc2FnZVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZScpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcblxuY2xhc3MgQ29udmVyc2F0aW9uTWVzc2FnZSBleHRlbmRzIE1lc3NhZ2Uge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29udmVyc2F0aW9uKSBvcHRpb25zLmNvbnZlcnNhdGlvbklkID0gb3B0aW9ucy5jb252ZXJzYXRpb24uaWQ7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gdHJ1ZTtcbiAgICBpZiAoIW9wdGlvbnMuZnJvbVNlcnZlcikgdGhpcy5yZWNpcGllbnRTdGF0dXMgPSB7fTtcbiAgICBlbHNlIHRoaXMuX191cGRhdGVSZWNpcGllbnRTdGF0dXModGhpcy5yZWNpcGllbnRTdGF0dXMpO1xuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcblxuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgY2xpZW50Ll9hZGRNZXNzYWdlKHRoaXMpO1xuICAgICAgY29uc3Qgc3RhdHVzID0gdGhpcy5yZWNpcGllbnRTdGF0dXNbY2xpZW50LnVzZXIuaWRdO1xuICAgICAgaWYgKHN0YXR1cyAmJiBzdGF0dXMgIT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgJiYgc3RhdHVzICE9PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5ERUxJVkVSRUQpIHtcbiAgICAgICAgVXRpbC5kZWZlcigoKSA9PiB0aGlzLl9zZW5kUmVjZWlwdCgnZGVsaXZlcnknKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDb252ZXJzYXRpb25cbiAgICogQHBhcmFtIHtCb29sZWFufSBsb2FkICAgICAgIFBhc3MgaW4gdHJ1ZSBpZiB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uIHNob3VsZCBiZSBsb2FkZWQgaWYgbm90IGZvdW5kIGxvY2FsbHlcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgZ2V0Q29udmVyc2F0aW9uKGxvYWQpIHtcbiAgICBpZiAodGhpcy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldCh0aGlzLmNsaWVudElkKS5nZXRDb252ZXJzYXRpb24odGhpcy5jb252ZXJzYXRpb25JZCwgbG9hZCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIE9uIGxvYWRpbmcgdGhpcyBvbmUgaXRlbSBmcm9tIHRoZSBzZXJ2ZXIsIGFmdGVyIF9wb3B1bGF0ZUZyb21TZXJ2ZXIgaGFzIGJlZW4gY2FsbGVkLCBkdWUgZmluYWwgc2V0dXAuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAgRGF0YSBmcm9tIHNlcnZlclxuICAgKi9cbiAgX2xvYWRlZChkYXRhKSB7XG4gICAgdGhpcy5jb252ZXJzYXRpb25JZCA9IGRhdGEuY29udmVyc2F0aW9uLmlkO1xuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX2FkZE1lc3NhZ2UodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogQWNjZXNzb3IgY2FsbGVkIHdoZW5ldmVyIHRoZSBhcHAgYWNjZXNzZXMgYG1lc3NhZ2UucmVjaXBpZW50U3RhdHVzYC5cbiAgICpcbiAgICogSW5zdXJlcyB0aGF0IHBhcnRpY2lwYW50cyB3aG8gaGF2ZW4ndCB5ZXQgYmVlbiBzZW50IHRoZSBNZXNzYWdlIGFyZSBtYXJrZWQgYXMgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUEVORElOR1xuICAgKlxuICAgKiBAbWV0aG9kIF9fZ2V0UmVjaXBpZW50U3RhdHVzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwS2V5IC0gVGhlIGFjdHVhbCBwcm9wZXJ0eSBrZXkgd2hlcmUgdGhlIHZhbHVlIGlzIHN0b3JlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBfX2dldFJlY2lwaWVudFN0YXR1cyhwS2V5KSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzW3BLZXldIHx8IHt9O1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkge1xuICAgICAgY29uc3QgaWQgPSBjbGllbnQudXNlci5pZDtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb24pIHtcbiAgICAgICAgY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5mb3JFYWNoKChwYXJ0aWNpcGFudCkgPT4ge1xuICAgICAgICAgIGlmICghdmFsdWVbcGFydGljaXBhbnQuaWRdKSB7XG4gICAgICAgICAgICB2YWx1ZVtwYXJ0aWNpcGFudC5pZF0gPSBwYXJ0aWNpcGFudC5pZCA9PT0gaWQgP1xuICAgICAgICAgICAgICBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEIDogQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGNoYW5nZXMgdG8gdGhlIHJlY2lwaWVudFN0YXR1cyBwcm9wZXJ0eS5cbiAgICpcbiAgICogQW55IHRpbWUgdGhlIHJlY2lwaWVudFN0YXR1cyBwcm9wZXJ0eSBpcyBzZXQsXG4gICAqIFJlY2FsY3VsYXRlIGFsbCBvZiB0aGUgcmVjZWlwdCByZWxhdGVkIHByb3BlcnRpZXM6XG4gICAqXG4gICAqIDEuIGlzUmVhZFxuICAgKiAyLiByZWFkU3RhdHVzXG4gICAqIDMuIGRlbGl2ZXJ5U3RhdHVzXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVSZWNpcGllbnRTdGF0dXNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBzdGF0dXMgLSBPYmplY3QgZGVzY3JpYmluZyB0aGUgZGVsaXZlcmVkL3JlYWQvc2VudCB2YWx1ZSBmb3IgZWFjaCBwYXJ0aWNpcGFudFxuICAgKlxuICAgKi9cbiAgX191cGRhdGVSZWNpcGllbnRTdGF0dXMoc3RhdHVzLCBvbGRTdGF0dXMpIHtcbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uIHx8IFV0aWwuZG9lc09iamVjdE1hdGNoKHN0YXR1cywgb2xkU3RhdHVzKSkgcmV0dXJuO1xuXG4gICAgY29uc3QgaWQgPSBjbGllbnQudXNlci5pZDtcbiAgICBjb25zdCBpc1NlbmRlciA9IHRoaXMuc2VuZGVyLnNlc3Npb25Pd25lcjtcbiAgICBjb25zdCB1c2VySGFzUmVhZCA9IHN0YXR1c1tpZF0gPT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gLTEgc28gd2UgZG9uJ3QgY291bnQgdGhpcyB1c2VyXG4gICAgICBjb25zdCB1c2VyQ291bnQgPSBjb252ZXJzYXRpb24ucGFydGljaXBhbnRzLmxlbmd0aCAtIDE7XG5cbiAgICAgIC8vIElmIHNlbnQgYnkgdGhpcyB1c2VyIG9yIHJlYWQgYnkgdGhpcyB1c2VyLCB1cGRhdGUgaXNSZWFkL3VucmVhZFxuICAgICAgaWYgKCF0aGlzLl9faXNSZWFkICYmIChpc1NlbmRlciB8fCB1c2VySGFzUmVhZCkpIHtcbiAgICAgICAgdGhpcy5fX2lzUmVhZCA9IHRydWU7IC8vIG5vIF9fdXBkYXRlSXNSZWFkIGV2ZW50IGZpcmVkXG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgcmVhZFN0YXR1cy9kZWxpdmVyeVN0YXR1cyBwcm9wZXJ0aWVzXG4gICAgICBjb25zdCB7IHJlYWRDb3VudCwgZGVsaXZlcmVkQ291bnQgfSA9IHRoaXMuX2dldFJlY2VpcHRTdGF0dXMoc3RhdHVzLCBpZCk7XG4gICAgICB0aGlzLl9zZXRSZWNlaXB0U3RhdHVzKHJlYWRDb3VudCwgZGVsaXZlcmVkQ291bnQsIHVzZXJDb3VudCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIERvIG5vdGhpbmdcbiAgICB9XG5cbiAgICAvLyBPbmx5IHRyaWdnZXIgYW4gZXZlbnRcbiAgICAvLyAxLiB3ZSdyZSBub3QgaW5pdGlhbGl6aW5nIGEgbmV3IE1lc3NhZ2VcbiAgICAvLyAyLiB0aGUgdXNlcidzIHN0YXRlIGhhcyBiZWVuIHVwZGF0ZWQgdG8gcmVhZDsgd2UgZG9uJ3QgY2FyZSBhYm91dCB1cGRhdGVzIGZyb20gb3RoZXIgdXNlcnMgaWYgd2UgYXJlbid0IHRoZSBzZW5kZXIuXG4gICAgLy8gICAgV2UgYWxzbyBkb24ndCBjYXJlIGFib3V0IHN0YXRlIGNoYW5nZXMgdG8gZGVsaXZlcmVkOyB0aGVzZSBkbyBub3QgaW5mb3JtIHJlbmRlcmluZyBhcyB0aGUgZmFjdCB3ZSBhcmUgcHJvY2Vzc2luZyBpdFxuICAgIC8vICAgIHByb3ZlcyBpdHMgZGVsaXZlcmVkLlxuICAgIC8vIDMuIFRoZSB1c2VyIGlzIHRoZSBzZW5kZXI7IGluIHRoYXQgY2FzZSB3ZSBkbyBjYXJlIGFib3V0IHJlbmRlcmluZyByZWNlaXB0cyBmcm9tIG90aGVyIHVzZXJzXG4gICAgaWYgKCF0aGlzLmlzSW5pdGlhbGl6aW5nICYmIG9sZFN0YXR1cykge1xuICAgICAgY29uc3QgdXNlcnNTdGF0ZVVwZGF0ZWRUb1JlYWQgPSB1c2VySGFzUmVhZCAmJiBvbGRTdGF0dXNbaWRdICE9PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEO1xuICAgICAgLy8gaWYgKHVzZXJzU3RhdGVVcGRhdGVkVG9SZWFkIHx8IGlzU2VuZGVyKSB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgICAgIG9sZFZhbHVlOiBvbGRTdGF0dXMsXG4gICAgICAgICAgbmV3VmFsdWU6IHN0YXR1cyxcbiAgICAgICAgICBwcm9wZXJ0eTogJ3JlY2lwaWVudFN0YXR1cycsXG4gICAgICAgIH0pO1xuICAgICAgLy8gfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG51bWJlciBvZiBwYXJ0aWNpcGFudHMgd2hvIGhhdmUgcmVhZCBhbmQgYmVlbiBkZWxpdmVyZWRcbiAgICogdGhpcyBNZXNzYWdlXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFJlY2VpcHRTdGF0dXNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBzdGF0dXMgLSBPYmplY3QgZGVzY3JpYmluZyB0aGUgZGVsaXZlcmVkL3JlYWQvc2VudCB2YWx1ZSBmb3IgZWFjaCBwYXJ0aWNpcGFudFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gSWRlbnRpdHkgSUQgZm9yIHRoaXMgdXNlcjsgbm90IGNvdW50ZWQgd2hlbiByZXBvcnRpbmcgb24gaG93IG1hbnkgcGVvcGxlIGhhdmUgcmVhZC9yZWNlaXZlZC5cbiAgICogQHJldHVybiB7T2JqZWN0fSByZXN1bHRcbiAgICogQHJldHVybiB7bnVtYmVyfSByZXN1bHQucmVhZENvdW50XG4gICAqIEByZXR1cm4ge251bWJlcn0gcmVzdWx0LmRlbGl2ZXJlZENvdW50XG4gICAqL1xuICBfZ2V0UmVjZWlwdFN0YXR1cyhzdGF0dXMsIGlkKSB7XG4gICAgbGV0IHJlYWRDb3VudCA9IDAsXG4gICAgICBkZWxpdmVyZWRDb3VudCA9IDA7XG4gICAgT2JqZWN0LmtleXMoc3RhdHVzKVxuICAgICAgLmZpbHRlcihwYXJ0aWNpcGFudCA9PiBwYXJ0aWNpcGFudCAhPT0gaWQpXG4gICAgICAuZm9yRWFjaCgocGFydGljaXBhbnQpID0+IHtcbiAgICAgICAgaWYgKHN0YXR1c1twYXJ0aWNpcGFudF0gPT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpIHtcbiAgICAgICAgICByZWFkQ291bnQrKztcbiAgICAgICAgICBkZWxpdmVyZWRDb3VudCsrO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXR1c1twYXJ0aWNpcGFudF0gPT09IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLkRFTElWRVJFRCkge1xuICAgICAgICAgIGRlbGl2ZXJlZENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYWRDb3VudCxcbiAgICAgIGRlbGl2ZXJlZENvdW50LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlLnJlYWRTdGF0dXMgYW5kIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5kZWxpdmVyeVN0YXR1cyBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZXRSZWNlaXB0U3RhdHVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gcmVhZENvdW50XG4gICAqIEBwYXJhbSAge251bWJlcn0gZGVsaXZlcmVkQ291bnRcbiAgICogQHBhcmFtICB7bnVtYmVyfSB1c2VyQ291bnRcbiAgICovXG4gIF9zZXRSZWNlaXB0U3RhdHVzKHJlYWRDb3VudCwgZGVsaXZlcmVkQ291bnQsIHVzZXJDb3VudCkge1xuICAgIGlmIChyZWFkQ291bnQgPT09IHVzZXJDb3VudCkge1xuICAgICAgdGhpcy5yZWFkU3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTEw7XG4gICAgfSBlbHNlIGlmIChyZWFkQ291bnQgPiAwKSB7XG4gICAgICB0aGlzLnJlYWRTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLlNPTUU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORTtcbiAgICB9XG4gICAgaWYgKGRlbGl2ZXJlZENvdW50ID09PSB1c2VyQ291bnQpIHtcbiAgICAgIHRoaXMuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLkFMTDtcbiAgICB9IGVsc2UgaWYgKGRlbGl2ZXJlZENvdW50ID4gMCkge1xuICAgICAgdGhpcy5kZWxpdmVyeVN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZWxpdmVyeVN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGNoYW5nZXMgdG8gdGhlIGlzUmVhZCBwcm9wZXJ0eS5cbiAgICpcbiAgICogSWYgc29tZW9uZSBjYWxsZWQgbS5pc1JlYWQgPSB0cnVlLCBBTkRcbiAgICogaWYgaXQgd2FzIHByZXZpb3VzbHkgZmFsc2UsIEFORFxuICAgKiBpZiB0aGUgY2FsbCBkaWRuJ3QgY29tZSBmcm9tIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5fX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyxcbiAgICogVGhlbiBub3RpZnkgdGhlIHNlcnZlciB0aGF0IHRoZSBtZXNzYWdlIGhhcyBiZWVuIHJlYWQuXG4gICAqXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVJc1JlYWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gdmFsdWUgLSBUcnVlIGlmIGlzUmVhZCBpcyB0cnVlLlxuICAgKi9cbiAgX191cGRhdGVJc1JlYWQodmFsdWUpIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGlmICghdGhpcy5faW5Qb3B1bGF0ZUZyb21TZXJ2ZXIpIHtcbiAgICAgICAgdGhpcy5fc2VuZFJlY2VpcHQoQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCk7XG4gICAgICB9XG4gICAgICB0aGlzLl90cmlnZ2VyTWVzc2FnZVJlYWQoKTtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb24pIGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudC0tO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGV2ZW50cyBpbmRpY2F0aW5nIGNoYW5nZXMgdG8gdGhlIGlzUmVhZC9pc1VucmVhZCBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF90cmlnZ2VyTWVzc2FnZVJlYWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF90cmlnZ2VyTWVzc2FnZVJlYWQoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmlzUmVhZDtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnaXNSZWFkJyxcbiAgICAgIG9sZFZhbHVlOiAhdmFsdWUsXG4gICAgICBuZXdWYWx1ZTogdmFsdWUsXG4gICAgfSk7XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBwcm9wZXJ0eTogJ2lzVW5yZWFkJyxcbiAgICAgIG9sZFZhbHVlOiB2YWx1ZSxcbiAgICAgIG5ld1ZhbHVlOiAhdmFsdWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIFJlYWQgb3IgRGVsaXZlcnkgUmVjZWlwdCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBGb3IgUmVhZCBSZWNlaXB0LCB5b3UgY2FuIGFsc28ganVzdCB3cml0ZTpcbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NhZ2UuaXNSZWFkID0gdHJ1ZTtcbiAgICogYGBgXG4gICAqXG4gICAqIFlvdSBjYW4gcmV0cmFjdCBhIERlbGl2ZXJ5IG9yIFJlYWQgUmVjZWlwdDsgb25jZSBtYXJrZWQgYXMgRGVsaXZlcmVkIG9yIFJlYWQsIGl0IGNhbid0IGdvIGJhY2suXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzc2FnZS5zZW5kUmVjZWlwdChsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFJlY2VpcHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlPWxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQURdIC0gT25lIG9mIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgb3IgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUllcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlfSB0aGlzXG4gICAqL1xuICBzZW5kUmVjZWlwdCh0eXBlID0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCkge1xuICAgIGlmICh0eXBlID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKSB7XG4gICAgICBpZiAodGhpcy5pc1JlYWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXaXRob3V0IHRyaWdnZXJpbmcgdGhlIGV2ZW50LCBjbGVhck9iamVjdCBpc24ndCBjYWxsZWQsXG4gICAgICAgIC8vIHdoaWNoIG1lYW5zIHRob3NlIHVzaW5nIHRoZSB0b09iamVjdCgpIGRhdGEgd2lsbCBoYXZlIGFuIGlzUmVhZCB0aGF0IGRvZXNuJ3QgbWF0Y2hcbiAgICAgICAgLy8gdGhpcyBpbnN0YW5jZS4gIFdoaWNoIHR5cGljYWxseSBsZWFkcyB0byBsb3RzIG9mIGV4dHJhIGF0dGVtcHRzXG4gICAgICAgIC8vIHRvIG1hcmsgdGhlIG1lc3NhZ2UgYXMgcmVhZC5cbiAgICAgICAgdGhpcy5fX2lzUmVhZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJNZXNzYWdlUmVhZCgpO1xuICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24pIGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudC0tO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9zZW5kUmVjZWlwdCh0eXBlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgUmVhZCBvciBEZWxpdmVyeSBSZWNlaXB0IHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgYnlwYXNzZXMgYW55IHZhbGlkYXRpb24gYW5kIGdvZXMgZGlyZWN0IHRvIHNlbmRpbmcgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTk9URTogU2VydmVyIGVycm9ycyBhcmUgbm90IGhhbmRsZWQ7IHRoZSBsb2NhbCByZWNlaXB0IHN0YXRlIGlzIHN1aXRhYmxlIGV2ZW5cbiAgICogaWYgb3V0IG9mIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZW5kUmVjZWlwdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGU9cmVhZF0gLSBPbmUgb2YgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCBvciBsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5ERUxJVkVSWVxuICAgKi9cbiAgX3NlbmRSZWNlaXB0KHR5cGUpIHtcbiAgICAvLyBUaGlzIGxpdHRsZSB0ZXN0IGV4aXN0cyBzbyB0aGF0IHdlIGRvbid0IHNlbmQgcmVjZWlwdHMgb24gQ29udmVyc2F0aW9ucyB3ZSBhcmUgbm8gbG9uZ2VyXG4gICAgLy8gcGFydGljaXBhbnRzIGluIChwYXJ0aWNpcGFudHMgPSBbXSBpZiB3ZSBhcmUgbm90IGEgcGFydGljaXBhbnQpXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgIGlmIChjb252ZXJzYXRpb24gJiYgY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIHRoaXMuX3NldFN5bmNpbmcoKTtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnL3JlY2VpcHRzJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgZGF0YToge1xuICAgICAgICB0eXBlLFxuICAgICAgfSxcbiAgICAgIHN5bmM6IHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgYSBQT1NUL0NSRUFURSByZXF1ZXN0IG9uIHRoZSBNZXNzYWdlXG4gICAgICAgIG9wZXJhdGlvbjogJ1JFQ0VJUFQnLFxuICAgICAgfSxcbiAgICB9LCAoKSA9PiB0aGlzLl9zZXRTeW5jZWQoKSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBNZXNzYWdlIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogVGhpcyBjYWxsIHdpbGwgc3VwcG9ydCB2YXJpb3VzIGRlbGV0aW9uIG1vZGVzLiAgQ2FsbGluZyB3aXRob3V0IGEgZGVsZXRpb24gbW9kZSBpcyBkZXByZWNhdGVkLlxuICAgKlxuICAgKiBEZWxldGlvbiBNb2RlczpcbiAgICpcbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6IFRoaXMgZGVsZXRlcyB0aGUgbG9jYWwgY29weSBpbW1lZGlhdGVseSwgYW5kIGF0dGVtcHRzIHRvIGFsc29cbiAgICogICBkZWxldGUgdGhlIHNlcnZlcidzIGNvcHkuXG4gICAqICogbGF5ZXIuQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzogRGVsZXRlcyB0aGlzIE1lc3NhZ2UgZnJvbSBhbGwgb2YgbXkgZGV2aWNlczsgbm8gZWZmZWN0IG9uIG90aGVyIHVzZXJzLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gZGVsZXRpb25Nb2RlXG4gICAqL1xuICAvLyBBYnN0cmFjdCBNZXRob2RcbiAgZGVsZXRlKG1vZGUpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pc0Rlc3Ryb3llZCk7XG4gICAgbGV0IHF1ZXJ5U3RyO1xuICAgIHN3aXRjaCAobW9kZSkge1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6XG4gICAgICBjYXNlIHRydWU6XG4gICAgICAgIHF1ZXJ5U3RyID0gJ21vZGU9YWxsX3BhcnRpY2lwYW50cyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOlxuICAgICAgICBxdWVyeVN0ciA9ICdtb2RlPW15X2RldmljZXMnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQpO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICc/JyArIHF1ZXJ5U3RyLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICghcmVzdWx0LmRhdGEgfHwgKHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJyAmJiByZXN1bHQuZGF0YS5pZCAhPT0gJ2F1dGhlbnRpY2F0aW9uX3JlcXVpcmVkJykpKSB7XG4gICAgICAgIE1lc3NhZ2UubG9hZChpZCwgY2xpZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG5cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QucmVjaXBpZW50U3RhdHVzID0gVXRpbC5jbG9uZSh0aGlzLnJlY2lwaWVudFN0YXR1cyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qXG4gICAqIENyZWF0ZXMgYSBtZXNzYWdlIGZyb20gdGhlIHNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIGEgbWVzc2FnZS5cbiAgICpcbiAgICogU2ltaWxhciB0byBfcG9wdWxhdGVGcm9tU2VydmVyLCBob3dldmVyLCB0aGlzIG1ldGhvZCB0YWtlcyBhXG4gICAqIG1lc3NhZ2UgZGVzY3JpcHRpb24gYW5kIHJldHVybnMgYSBuZXcgbWVzc2FnZSBpbnN0YW5jZSB1c2luZyBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIHRvIHNldHVwIHRoZSB2YWx1ZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gbWVzc2FnZSAtIFNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLCBjbGllbnQpIHtcbiAgICBjb25zdCBmcm9tV2Vic29ja2V0ID0gbWVzc2FnZS5mcm9tV2Vic29ja2V0O1xuICAgIGxldCBjb252ZXJzYXRpb25JZDtcbiAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb24pIHtcbiAgICAgIGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jb252ZXJzYXRpb24uaWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jb252ZXJzYXRpb25JZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbk1lc3NhZ2Uoe1xuICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICBmcm9tU2VydmVyOiBtZXNzYWdlLFxuICAgICAgY2xpZW50SWQ6IGNsaWVudC5hcHBJZCxcbiAgICAgIF9mcm9tREI6IG1lc3NhZ2UuX2Zyb21EQixcbiAgICAgIF9ub3RpZnk6IGZyb21XZWJzb2NrZXQgJiYgbWVzc2FnZS5pc191bnJlYWQgJiYgbWVzc2FnZS5zZW5kZXIudXNlcl9pZCAhPT0gY2xpZW50LnVzZXIudXNlcklkLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogVHJ1ZSBpZiB0aGlzIE1lc3NhZ2UgaGFzIGJlZW4gcmVhZCBieSB0aGlzIHVzZXIuXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgaXNSZWFkIHByb2dyYW1hdGljYWxseVxuICpcbiAqICAgICAgbS5pc1JlYWQgPSB0cnVlO1xuICpcbiAqIFRoaXMgd2lsbCBhdXRvbWF0aWNhbGx5IG5vdGlmeSB0aGUgc2VydmVyIHRoYXQgdGhlIG1lc3NhZ2Ugd2FzIHJlYWQgYnkgeW91ciB1c2VyLlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbkNvbnZlcnNhdGlvbk1lc3NhZ2UucHJvdG90eXBlLmlzUmVhZCA9IGZhbHNlO1xuXG4vKipcbiAqIFJlYWQvZGVsaXZlcnkgU3RhdGUgb2YgYWxsIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBUaGlzIGlzIGFuIG9iamVjdCBjb250YWluaW5nIGtleXMgZm9yIGVhY2ggcGFydGljaXBhbnQsXG4gKiBhbmQgYSB2YWx1ZSBvZjpcbiAqXG4gKiAqIGxheWVyLlJFQ0VJUFRfU1RBVEUuU0VOVFxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLkRFTElWRVJFRFxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLlJFQURcbiAqICogbGF5ZXIuUkVDRUlQVF9TVEFURS5QRU5ESU5HXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUucmVjaXBpZW50U3RhdHVzID0gbnVsbDtcblxuLyoqXG4gKiBIYXZlIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMgcmVhZCB0aGlzIE1lc3NhZ2UgeWV0LlxuICpcbiAqIFRoaXMgdmFsdWUgaXMgb25lIG9mOlxuICpcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuQUxMXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLlNPTUVcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORVxuICpcbiAqICBUaGlzIHZhbHVlIGlzIHVwZGF0ZWQgYW55IHRpbWUgcmVjaXBpZW50U3RhdHVzIGNoYW5nZXMuXG4gKlxuICogU2VlIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5yZWNpcGllbnRTdGF0dXMgZm9yIGEgbW9yZSBkZXRhaWxlZCByZXBvcnQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORTtcblxuLyoqXG4gKiBIYXZlIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMgcmVjZWl2ZWQgdGhpcyBNZXNzYWdlIHlldC5cbiAqXG4gICogVGhpcyB2YWx1ZSBpcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTExcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRVxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FXG4gKlxuICogIFRoaXMgdmFsdWUgaXMgdXBkYXRlZCBhbnkgdGltZSByZWNpcGllbnRTdGF0dXMgY2hhbmdlcy5cbiAqXG4gKiBTZWUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlLnJlY2lwaWVudFN0YXR1cyBmb3IgYSBtb3JlIGRldGFpbGVkIHJlcG9ydC5cbiAqXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG5cbkNvbnZlcnNhdGlvbk1lc3NhZ2UuaW5PYmplY3RJZ25vcmUgPSBNZXNzYWdlLmluT2JqZWN0SWdub3JlO1xuQ29udmVyc2F0aW9uTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzID0gW10uY29uY2F0KE1lc3NhZ2UuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShDb252ZXJzYXRpb25NZXNzYWdlLCBbQ29udmVyc2F0aW9uTWVzc2FnZSwgJ0NvbnZlcnNhdGlvbk1lc3NhZ2UnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvbk1lc3NhZ2U7XG4iXX0=
