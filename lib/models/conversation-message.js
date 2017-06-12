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
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Message.load(id, client);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udmVyc2F0aW9uLW1lc3NhZ2UuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJNZXNzYWdlIiwiQ2xpZW50UmVnaXN0cnkiLCJMYXllckVycm9yIiwiQ29uc3RhbnRzIiwiVXRpbCIsIkNvbnZlcnNhdGlvbk1lc3NhZ2UiLCJvcHRpb25zIiwiY29udmVyc2F0aW9uIiwiY29udmVyc2F0aW9uSWQiLCJpZCIsIl9kaXNhYmxlRXZlbnRzIiwiZnJvbVNlcnZlciIsInJlY2lwaWVudFN0YXR1cyIsIl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzIiwiY2xpZW50IiwiZ2V0Q2xpZW50IiwiaXNJbml0aWFsaXppbmciLCJfYWRkTWVzc2FnZSIsInN0YXR1cyIsInVzZXIiLCJSRUNFSVBUX1NUQVRFIiwiUkVBRCIsIkRFTElWRVJFRCIsImRlZmVyIiwiX3NlbmRSZWNlaXB0IiwibG9hZCIsImdldCIsImNsaWVudElkIiwiZ2V0Q29udmVyc2F0aW9uIiwiZGF0YSIsInBLZXkiLCJ2YWx1ZSIsInBhcnRpY2lwYW50cyIsImZvckVhY2giLCJwYXJ0aWNpcGFudCIsIlBFTkRJTkciLCJvbGRTdGF0dXMiLCJkb2VzT2JqZWN0TWF0Y2giLCJpc1NlbmRlciIsInNlbmRlciIsInNlc3Npb25Pd25lciIsInVzZXJIYXNSZWFkIiwidXNlckNvdW50IiwibGVuZ3RoIiwiX19pc1JlYWQiLCJfZ2V0UmVjZWlwdFN0YXR1cyIsInJlYWRDb3VudCIsImRlbGl2ZXJlZENvdW50IiwiX3NldFJlY2VpcHRTdGF0dXMiLCJlcnJvciIsInVzZXJzU3RhdGVVcGRhdGVkVG9SZWFkIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJwcm9wZXJ0eSIsIk9iamVjdCIsImtleXMiLCJmaWx0ZXIiLCJyZWFkU3RhdHVzIiwiUkVDSVBJRU5UX1NUQVRFIiwiQUxMIiwiU09NRSIsIk5PTkUiLCJkZWxpdmVyeVN0YXR1cyIsIl9pblBvcHVsYXRlRnJvbVNlcnZlciIsIl90cmlnZ2VyTWVzc2FnZVJlYWQiLCJ1bnJlYWRDb3VudCIsImlzUmVhZCIsInR5cGUiLCJfc2V0U3luY2luZyIsIl94aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwib3BlcmF0aW9uIiwiX3NldFN5bmNlZCIsIm1vZGUiLCJpc0Rlc3Ryb3llZCIsIkVycm9yIiwiZGljdGlvbmFyeSIsInF1ZXJ5U3RyIiwiREVMRVRJT05fTU9ERSIsIk1ZX0RFVklDRVMiLCJkZWxldGlvbk1vZGVVbnN1cHBvcnRlZCIsInJlc3VsdCIsInN1Y2Nlc3MiLCJfZGVsZXRlZCIsImRlc3Ryb3kiLCJfdG9PYmplY3QiLCJjbG9uZSIsIm1lc3NhZ2UiLCJmcm9tV2Vic29ja2V0IiwiYXBwSWQiLCJfZnJvbURCIiwiX25vdGlmeSIsImlzX3VucmVhZCIsInVzZXJfaWQiLCJ1c2VySWQiLCJwcm90b3R5cGUiLCJpbk9iamVjdElnbm9yZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFVBQVVELFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU1FLGlCQUFpQkYsUUFBUSxvQkFBUixDQUF2QjtBQUNBLElBQU1HLGFBQWFILFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNSSxZQUFZSixRQUFRLFVBQVIsQ0FBbEI7QUFDQSxJQUFNSyxPQUFPTCxRQUFRLGlCQUFSLENBQWI7O0lBRU1NLG1COzs7QUFDSiwrQkFBWUMsT0FBWixFQUFxQjtBQUFBOztBQUNuQixRQUFJQSxRQUFRQyxZQUFaLEVBQTBCRCxRQUFRRSxjQUFSLEdBQXlCRixRQUFRQyxZQUFSLENBQXFCRSxFQUE5Qzs7QUFEUCwwSUFFYkgsT0FGYTs7QUFJbkIsVUFBS0ksY0FBTCxHQUFzQixJQUF0QjtBQUNBLFFBQUksQ0FBQ0osUUFB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QVFvRyxnQkFBbEIsQ0FBdkM7QUFDQXRHLEtBQUt3RyxTQUFMLENBQWVDLEtBQWYsQ0FBcUJsRyxtQkFBckIsRUFBMEMsQ0FBQ0EsbUJBQUQsRUFBc0IscUJBQXRCLENBQTFDO0FBQ0FtRyxPQUFPQyxPQUFQLEdBQWlCcEcsbUJBQWpCIiwiZmlsZSI6ImNvbnZlcnNhdGlvbi1tZXNzYWdlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIGxheWVyLk1lc3NhZ2UgaW5zdGFuY2UgZm9yIHVzZSB3aXRoaW4gbGF5ZXIuQ29udmVyc2F0aW9uLlxuICpcbiAqIEBjbGFzcyBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2VcbiAqIEBleHRlbmRzIGxheWVyLk1lc3NhZ2VcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IE1lc3NhZ2UgPSByZXF1aXJlKCcuL21lc3NhZ2UnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IENvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5cbmNsYXNzIENvbnZlcnNhdGlvbk1lc3NhZ2UgZXh0ZW5kcyBNZXNzYWdlIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLmNvbnZlcnNhdGlvbikgb3B0aW9ucy5jb252ZXJzYXRpb25JZCA9IG9wdGlvbnMuY29udmVyc2F0aW9uLmlkO1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IHRydWU7XG4gICAgaWYgKCFvcHRpb25zLmZyb21TZXJ2ZXIpIHRoaXMucmVjaXBpZW50U3RhdHVzID0ge307XG4gICAgZWxzZSB0aGlzLl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzKHRoaXMucmVjaXBpZW50U3RhdHVzKTtcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHRoaXMucmVjaXBpZW50U3RhdHVzW2NsaWVudC51c2VyLmlkXTtcbiAgICAgIGlmIChzdGF0dXMgJiYgc3RhdHVzICE9PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEICYmIHN0YXR1cyAhPT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUkVEKSB7XG4gICAgICAgIFV0aWwuZGVmZXIoKCkgPT4gdGhpcy5fc2VuZFJlY2VpcHQoJ2RlbGl2ZXJ5JykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxheWVyLkNvbnZlcnNhdGlvbiBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gbG9hZCAgICAgICBQYXNzIGluIHRydWUgaWYgdGhlIGxheWVyLkNvbnZlcnNhdGlvbiBzaG91bGQgYmUgbG9hZGVkIGlmIG5vdCBmb3VuZCBsb2NhbGx5XG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIGdldENvbnZlcnNhdGlvbihsb2FkKSB7XG4gICAgaWYgKHRoaXMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCkuZ2V0Q29udmVyc2F0aW9uKHRoaXMuY29udmVyc2F0aW9uSWQsIGxvYWQpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBPbiBsb2FkaW5nIHRoaXMgb25lIGl0ZW0gZnJvbSB0aGUgc2VydmVyLCBhZnRlciBfcG9wdWxhdGVGcm9tU2VydmVyIGhhcyBiZWVuIGNhbGxlZCwgZHVlIGZpbmFsIHNldHVwLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkZWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgIERhdGEgZnJvbSBzZXJ2ZXJcbiAgICovXG4gIF9sb2FkZWQoZGF0YSkge1xuICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBkYXRhLmNvbnZlcnNhdGlvbi5pZDtcbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRNZXNzYWdlKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc29yIGNhbGxlZCB3aGVuZXZlciB0aGUgYXBwIGFjY2Vzc2VzIGBtZXNzYWdlLnJlY2lwaWVudFN0YXR1c2AuXG4gICAqXG4gICAqIEluc3VyZXMgdGhhdCBwYXJ0aWNpcGFudHMgd2hvIGhhdmVuJ3QgeWV0IGJlZW4gc2VudCB0aGUgTWVzc2FnZSBhcmUgbWFya2VkIGFzIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlBFTkRJTkdcbiAgICpcbiAgICogQG1ldGhvZCBfX2dldFJlY2lwaWVudFN0YXR1c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcEtleSAtIFRoZSBhY3R1YWwgcHJvcGVydHkga2V5IHdoZXJlIHRoZSB2YWx1ZSBpcyBzdG9yZWRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgX19nZXRSZWNpcGllbnRTdGF0dXMocEtleSkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpc1twS2V5XSB8fCB7fTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIHtcbiAgICAgIGNvbnN0IGlkID0gY2xpZW50LnVzZXIuaWQ7XG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICBpZiAoY29udmVyc2F0aW9uKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMuZm9yRWFjaCgocGFydGljaXBhbnQpID0+IHtcbiAgICAgICAgICBpZiAoIXZhbHVlW3BhcnRpY2lwYW50LmlkXSkge1xuICAgICAgICAgICAgdmFsdWVbcGFydGljaXBhbnQuaWRdID0gcGFydGljaXBhbnQuaWQgPT09IGlkID9cbiAgICAgICAgICAgICAgQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCA6IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlBFTkRJTkc7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBjaGFuZ2VzIHRvIHRoZSByZWNpcGllbnRTdGF0dXMgcHJvcGVydHkuXG4gICAqXG4gICAqIEFueSB0aW1lIHRoZSByZWNpcGllbnRTdGF0dXMgcHJvcGVydHkgaXMgc2V0LFxuICAgKiBSZWNhbGN1bGF0ZSBhbGwgb2YgdGhlIHJlY2VpcHQgcmVsYXRlZCBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAxLiBpc1JlYWRcbiAgICogMi4gcmVhZFN0YXR1c1xuICAgKiAzLiBkZWxpdmVyeVN0YXR1c1xuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlUmVjaXBpZW50U3RhdHVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdHVzIC0gT2JqZWN0IGRlc2NyaWJpbmcgdGhlIGRlbGl2ZXJlZC9yZWFkL3NlbnQgdmFsdWUgZm9yIGVhY2ggcGFydGljaXBhbnRcbiAgICpcbiAgICovXG4gIF9fdXBkYXRlUmVjaXBpZW50U3RhdHVzKHN0YXR1cywgb2xkU3RhdHVzKSB7XG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbiB8fCBVdGlsLmRvZXNPYmplY3RNYXRjaChzdGF0dXMsIG9sZFN0YXR1cykpIHJldHVybjtcblxuICAgIGNvbnN0IGlkID0gY2xpZW50LnVzZXIuaWQ7XG4gICAgY29uc3QgaXNTZW5kZXIgPSB0aGlzLnNlbmRlci5zZXNzaW9uT3duZXI7XG4gICAgY29uc3QgdXNlckhhc1JlYWQgPSBzdGF0dXNbaWRdID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIC0xIHNvIHdlIGRvbid0IGNvdW50IHRoaXMgdXNlclxuICAgICAgY29uc3QgdXNlckNvdW50ID0gY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAvLyBJZiBzZW50IGJ5IHRoaXMgdXNlciBvciByZWFkIGJ5IHRoaXMgdXNlciwgdXBkYXRlIGlzUmVhZC91bnJlYWRcbiAgICAgIGlmICghdGhpcy5fX2lzUmVhZCAmJiAoaXNTZW5kZXIgfHwgdXNlckhhc1JlYWQpKSB7XG4gICAgICAgIHRoaXMuX19pc1JlYWQgPSB0cnVlOyAvLyBubyBfX3VwZGF0ZUlzUmVhZCBldmVudCBmaXJlZFxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHJlYWRTdGF0dXMvZGVsaXZlcnlTdGF0dXMgcHJvcGVydGllc1xuICAgICAgY29uc3QgeyByZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50IH0gPSB0aGlzLl9nZXRSZWNlaXB0U3RhdHVzKHN0YXR1cywgaWQpO1xuICAgICAgdGhpcy5fc2V0UmVjZWlwdFN0YXR1cyhyZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50LCB1c2VyQ291bnQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBEbyBub3RoaW5nXG4gICAgfVxuXG4gICAgLy8gT25seSB0cmlnZ2VyIGFuIGV2ZW50XG4gICAgLy8gMS4gd2UncmUgbm90IGluaXRpYWxpemluZyBhIG5ldyBNZXNzYWdlXG4gICAgLy8gMi4gdGhlIHVzZXIncyBzdGF0ZSBoYXMgYmVlbiB1cGRhdGVkIHRvIHJlYWQ7IHdlIGRvbid0IGNhcmUgYWJvdXQgdXBkYXRlcyBmcm9tIG90aGVyIHVzZXJzIGlmIHdlIGFyZW4ndCB0aGUgc2VuZGVyLlxuICAgIC8vICAgIFdlIGFsc28gZG9uJ3QgY2FyZSBhYm91dCBzdGF0ZSBjaGFuZ2VzIHRvIGRlbGl2ZXJlZDsgdGhlc2UgZG8gbm90IGluZm9ybSByZW5kZXJpbmcgYXMgdGhlIGZhY3Qgd2UgYXJlIHByb2Nlc3NpbmcgaXRcbiAgICAvLyAgICBwcm92ZXMgaXRzIGRlbGl2ZXJlZC5cbiAgICAvLyAzLiBUaGUgdXNlciBpcyB0aGUgc2VuZGVyOyBpbiB0aGF0IGNhc2Ugd2UgZG8gY2FyZSBhYm91dCByZW5kZXJpbmcgcmVjZWlwdHMgZnJvbSBvdGhlciB1c2Vyc1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZyAmJiBvbGRTdGF0dXMpIHtcbiAgICAgIGNvbnN0IHVzZXJzU3RhdGVVcGRhdGVkVG9SZWFkID0gdXNlckhhc1JlYWQgJiYgb2xkU3RhdHVzW2lkXSAhPT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRDtcbiAgICAgIC8vIGlmICh1c2Vyc1N0YXRlVXBkYXRlZFRvUmVhZCB8fCBpc1NlbmRlcikge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgICAgICBvbGRWYWx1ZTogb2xkU3RhdHVzLFxuICAgICAgICAgIG5ld1ZhbHVlOiBzdGF0dXMsXG4gICAgICAgICAgcHJvcGVydHk6ICdyZWNpcGllbnRTdGF0dXMnLFxuICAgICAgICB9KTtcbiAgICAgIC8vIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBudW1iZXIgb2YgcGFydGljaXBhbnRzIHdobyBoYXZlIHJlYWQgYW5kIGJlZW4gZGVsaXZlcmVkXG4gICAqIHRoaXMgTWVzc2FnZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRSZWNlaXB0U3RhdHVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdHVzIC0gT2JqZWN0IGRlc2NyaWJpbmcgdGhlIGRlbGl2ZXJlZC9yZWFkL3NlbnQgdmFsdWUgZm9yIGVhY2ggcGFydGljaXBhbnRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIElkZW50aXR5IElEIGZvciB0aGlzIHVzZXI7IG5vdCBjb3VudGVkIHdoZW4gcmVwb3J0aW5nIG9uIGhvdyBtYW55IHBlb3BsZSBoYXZlIHJlYWQvcmVjZWl2ZWQuXG4gICAqIEByZXR1cm4ge09iamVjdH0gcmVzdWx0XG4gICAqIEByZXR1cm4ge251bWJlcn0gcmVzdWx0LnJlYWRDb3VudFxuICAgKiBAcmV0dXJuIHtudW1iZXJ9IHJlc3VsdC5kZWxpdmVyZWRDb3VudFxuICAgKi9cbiAgX2dldFJlY2VpcHRTdGF0dXMoc3RhdHVzLCBpZCkge1xuICAgIGxldCByZWFkQ291bnQgPSAwLFxuICAgICAgZGVsaXZlcmVkQ291bnQgPSAwO1xuICAgIE9iamVjdC5rZXlzKHN0YXR1cylcbiAgICAgIC5maWx0ZXIocGFydGljaXBhbnQgPT4gcGFydGljaXBhbnQgIT09IGlkKVxuICAgICAgLmZvckVhY2goKHBhcnRpY2lwYW50KSA9PiB7XG4gICAgICAgIGlmIChzdGF0dXNbcGFydGljaXBhbnRdID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKSB7XG4gICAgICAgICAgcmVhZENvdW50Kys7XG4gICAgICAgICAgZGVsaXZlcmVkQ291bnQrKztcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0dXNbcGFydGljaXBhbnRdID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5ERUxJVkVSRUQpIHtcbiAgICAgICAgICBkZWxpdmVyZWRDb3VudCsrO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICByZWFkQ291bnQsXG4gICAgICBkZWxpdmVyZWRDb3VudCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5yZWFkU3RhdHVzIGFuZCBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UuZGVsaXZlcnlTdGF0dXMgcHJvcGVydGllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2V0UmVjZWlwdFN0YXR1c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHJlYWRDb3VudFxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IGRlbGl2ZXJlZENvdW50XG4gICAqIEBwYXJhbSAge251bWJlcn0gdXNlckNvdW50XG4gICAqL1xuICBfc2V0UmVjZWlwdFN0YXR1cyhyZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50LCB1c2VyQ291bnQpIHtcbiAgICBpZiAocmVhZENvdW50ID09PSB1c2VyQ291bnQpIHtcbiAgICAgIHRoaXMucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuQUxMO1xuICAgIH0gZWxzZSBpZiAocmVhZENvdW50ID4gMCkge1xuICAgICAgdGhpcy5yZWFkU3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5TT01FO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlYWRTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG4gICAgfVxuICAgIGlmIChkZWxpdmVyZWRDb3VudCA9PT0gdXNlckNvdW50KSB7XG4gICAgICB0aGlzLmRlbGl2ZXJ5U3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTEw7XG4gICAgfSBlbHNlIGlmIChkZWxpdmVyZWRDb3VudCA+IDApIHtcbiAgICAgIHRoaXMuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLlNPTUU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBjaGFuZ2VzIHRvIHRoZSBpc1JlYWQgcHJvcGVydHkuXG4gICAqXG4gICAqIElmIHNvbWVvbmUgY2FsbGVkIG0uaXNSZWFkID0gdHJ1ZSwgQU5EXG4gICAqIGlmIGl0IHdhcyBwcmV2aW91c2x5IGZhbHNlLCBBTkRcbiAgICogaWYgdGhlIGNhbGwgZGlkbid0IGNvbWUgZnJvbSBsYXllci5NZXNzYWdlLkNvbnZlcnNhdGlvbk1lc3NhZ2UuX191cGRhdGVSZWNpcGllbnRTdGF0dXMsXG4gICAqIFRoZW4gbm90aWZ5IHRoZSBzZXJ2ZXIgdGhhdCB0aGUgbWVzc2FnZSBoYXMgYmVlbiByZWFkLlxuICAgKlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlSXNSZWFkXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IHZhbHVlIC0gVHJ1ZSBpZiBpc1JlYWQgaXMgdHJ1ZS5cbiAgICovXG4gIF9fdXBkYXRlSXNSZWFkKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMuX2luUG9wdWxhdGVGcm9tU2VydmVyKSB7XG4gICAgICAgIHRoaXMuX3NlbmRSZWNlaXB0KENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpO1xuICAgICAgfVxuICAgICAgdGhpcy5fdHJpZ2dlck1lc3NhZ2VSZWFkKCk7XG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICBpZiAoY29udmVyc2F0aW9uKSBjb252ZXJzYXRpb24udW5yZWFkQ291bnQtLTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVHJpZ2dlciBldmVudHMgaW5kaWNhdGluZyBjaGFuZ2VzIHRvIHRoZSBpc1JlYWQvaXNVbnJlYWQgcHJvcGVydGllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfdHJpZ2dlck1lc3NhZ2VSZWFkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdHJpZ2dlck1lc3NhZ2VSZWFkKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pc1JlYWQ7XG4gICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBwcm9wZXJ0eTogJ2lzUmVhZCcsXG4gICAgICBvbGRWYWx1ZTogIXZhbHVlLFxuICAgICAgbmV3VmFsdWU6IHZhbHVlLFxuICAgIH0pO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgcHJvcGVydHk6ICdpc1VucmVhZCcsXG4gICAgICBvbGRWYWx1ZTogdmFsdWUsXG4gICAgICBuZXdWYWx1ZTogIXZhbHVlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgYSBSZWFkIG9yIERlbGl2ZXJ5IFJlY2VpcHQgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogRm9yIFJlYWQgUmVjZWlwdCwgeW91IGNhbiBhbHNvIGp1c3Qgd3JpdGU6XG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlLmlzUmVhZCA9IHRydWU7XG4gICAqIGBgYFxuICAgKlxuICAgKiBZb3UgY2FuIHJldHJhY3QgYSBEZWxpdmVyeSBvciBSZWFkIFJlY2VpcHQ7IG9uY2UgbWFya2VkIGFzIERlbGl2ZXJlZCBvciBSZWFkLCBpdCBjYW4ndCBnbyBiYWNrLlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc3NhZ2Uuc2VuZFJlY2VpcHQobGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRSZWNlaXB0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbdHlwZT1sYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEXSAtIE9uZSBvZiBsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEIG9yIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLkRFTElWRVJZXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgc2VuZFJlY2VpcHQodHlwZSA9IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpIHtcbiAgICBpZiAodHlwZSA9PT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCkge1xuICAgICAgaWYgKHRoaXMuaXNSZWFkKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2l0aG91dCB0cmlnZ2VyaW5nIHRoZSBldmVudCwgY2xlYXJPYmplY3QgaXNuJ3QgY2FsbGVkLFxuICAgICAgICAvLyB3aGljaCBtZWFucyB0aG9zZSB1c2luZyB0aGUgdG9PYmplY3QoKSBkYXRhIHdpbGwgaGF2ZSBhbiBpc1JlYWQgdGhhdCBkb2Vzbid0IG1hdGNoXG4gICAgICAgIC8vIHRoaXMgaW5zdGFuY2UuICBXaGljaCB0eXBpY2FsbHkgbGVhZHMgdG8gbG90cyBvZiBleHRyYSBhdHRlbXB0c1xuICAgICAgICAvLyB0byBtYXJrIHRoZSBtZXNzYWdlIGFzIHJlYWQuXG4gICAgICAgIHRoaXMuX19pc1JlYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl90cmlnZ2VyTWVzc2FnZVJlYWQoKTtcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uKSBjb252ZXJzYXRpb24udW5yZWFkQ291bnQtLTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fc2VuZFJlY2VpcHQodHlwZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIFJlYWQgb3IgRGVsaXZlcnkgUmVjZWlwdCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGlzIGJ5cGFzc2VzIGFueSB2YWxpZGF0aW9uIGFuZCBnb2VzIGRpcmVjdCB0byBzZW5kaW5nIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5PVEU6IFNlcnZlciBlcnJvcnMgYXJlIG5vdCBoYW5kbGVkOyB0aGUgbG9jYWwgcmVjZWlwdCBzdGF0ZSBpcyBzdWl0YWJsZSBldmVuXG4gICAqIGlmIG91dCBvZiBzeW5jIHdpdGggdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFJlY2VpcHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IFt0eXBlPXJlYWRdIC0gT25lIG9mIGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQgb3IgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUllcbiAgICovXG4gIF9zZW5kUmVjZWlwdCh0eXBlKSB7XG4gICAgLy8gVGhpcyBsaXR0bGUgdGVzdCBleGlzdHMgc28gdGhhdCB3ZSBkb24ndCBzZW5kIHJlY2VpcHRzIG9uIENvbnZlcnNhdGlvbnMgd2UgYXJlIG5vIGxvbmdlclxuICAgIC8vIHBhcnRpY2lwYW50cyBpbiAocGFydGljaXBhbnRzID0gW10gaWYgd2UgYXJlIG5vdCBhIHBhcnRpY2lwYW50KVxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICBpZiAoY29udmVyc2F0aW9uICYmIGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJy9yZWNlaXB0cycsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdHlwZSxcbiAgICAgIH0sXG4gICAgICBzeW5jOiB7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIG5vdCBiZSB0cmVhdGVkIGFzIGEgUE9TVC9DUkVBVEUgcmVxdWVzdCBvbiB0aGUgTWVzc2FnZVxuICAgICAgICBvcGVyYXRpb246ICdSRUNFSVBUJyxcbiAgICAgIH0sXG4gICAgfSwgKCkgPT4gdGhpcy5fc2V0U3luY2VkKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSB0aGUgTWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgY2FsbCB3aWxsIHN1cHBvcnQgdmFyaW91cyBkZWxldGlvbiBtb2Rlcy4gIENhbGxpbmcgd2l0aG91dCBhIGRlbGV0aW9uIG1vZGUgaXMgZGVwcmVjYXRlZC5cbiAgICpcbiAgICogRGVsZXRpb24gTW9kZXM6XG4gICAqXG4gICAqICogbGF5ZXIuQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMOiBUaGlzIGRlbGV0ZXMgdGhlIGxvY2FsIGNvcHkgaW1tZWRpYXRlbHksIGFuZCBhdHRlbXB0cyB0byBhbHNvXG4gICAqICAgZGVsZXRlIHRoZSBzZXJ2ZXIncyBjb3B5LlxuICAgKiAqIGxheWVyLkNvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVM6IERlbGV0ZXMgdGhpcyBNZXNzYWdlIGZyb20gYWxsIG9mIG15IGRldmljZXM7IG5vIGVmZmVjdCBvbiBvdGhlciB1c2Vycy5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGRlbGV0aW9uTW9kZVxuICAgKi9cbiAgLy8gQWJzdHJhY3QgTWV0aG9kXG4gIGRlbGV0ZShtb2RlKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgIGxldCBxdWVyeVN0cjtcbiAgICBzd2l0Y2ggKG1vZGUpIHtcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuQUxMOlxuICAgICAgY2FzZSB0cnVlOlxuICAgICAgICBxdWVyeVN0ciA9ICdtb2RlPWFsbF9wYXJ0aWNpcGFudHMnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzpcbiAgICAgICAgcXVlcnlTdHIgPSAnbW9kZT1teV9kZXZpY2VzJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmRlbGV0aW9uTW9kZVVuc3VwcG9ydGVkKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnPycgKyBxdWVyeVN0cixcbiAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJykpIE1lc3NhZ2UubG9hZChpZCwgY2xpZW50KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG5cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QucmVjaXBpZW50U3RhdHVzID0gVXRpbC5jbG9uZSh0aGlzLnJlY2lwaWVudFN0YXR1cyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qXG4gICAqIENyZWF0ZXMgYSBtZXNzYWdlIGZyb20gdGhlIHNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIGEgbWVzc2FnZS5cbiAgICpcbiAgICogU2ltaWxhciB0byBfcG9wdWxhdGVGcm9tU2VydmVyLCBob3dldmVyLCB0aGlzIG1ldGhvZCB0YWtlcyBhXG4gICAqIG1lc3NhZ2UgZGVzY3JpcHRpb24gYW5kIHJldHVybnMgYSBuZXcgbWVzc2FnZSBpbnN0YW5jZSB1c2luZyBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIHRvIHNldHVwIHRoZSB2YWx1ZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gbWVzc2FnZSAtIFNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZX1cbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihtZXNzYWdlLCBjbGllbnQpIHtcbiAgICBjb25zdCBmcm9tV2Vic29ja2V0ID0gbWVzc2FnZS5mcm9tV2Vic29ja2V0O1xuICAgIGxldCBjb252ZXJzYXRpb25JZDtcbiAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb24pIHtcbiAgICAgIGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jb252ZXJzYXRpb24uaWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnZlcnNhdGlvbklkID0gbWVzc2FnZS5jb252ZXJzYXRpb25JZDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbk1lc3NhZ2Uoe1xuICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICBmcm9tU2VydmVyOiBtZXNzYWdlLFxuICAgICAgY2xpZW50SWQ6IGNsaWVudC5hcHBJZCxcbiAgICAgIF9mcm9tREI6IG1lc3NhZ2UuX2Zyb21EQixcbiAgICAgIF9ub3RpZnk6IGZyb21XZWJzb2NrZXQgJiYgbWVzc2FnZS5pc191bnJlYWQgJiYgbWVzc2FnZS5zZW5kZXIudXNlcl9pZCAhPT0gY2xpZW50LnVzZXIudXNlcklkLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogVHJ1ZSBpZiB0aGlzIE1lc3NhZ2UgaGFzIGJlZW4gcmVhZCBieSB0aGlzIHVzZXIuXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgaXNSZWFkIHByb2dyYW1hdGljYWxseVxuICpcbiAqICAgICAgbS5pc1JlYWQgPSB0cnVlO1xuICpcbiAqIFRoaXMgd2lsbCBhdXRvbWF0aWNhbGx5IG5vdGlmeSB0aGUgc2VydmVyIHRoYXQgdGhlIG1lc3NhZ2Ugd2FzIHJlYWQgYnkgeW91ciB1c2VyLlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbkNvbnZlcnNhdGlvbk1lc3NhZ2UucHJvdG90eXBlLmlzUmVhZCA9IGZhbHNlO1xuXG4vKipcbiAqIFJlYWQvZGVsaXZlcnkgU3RhdGUgb2YgYWxsIHBhcnRpY2lwYW50cy5cbiAqXG4gKiBUaGlzIGlzIGFuIG9iamVjdCBjb250YWluaW5nIGtleXMgZm9yIGVhY2ggcGFydGljaXBhbnQsXG4gKiBhbmQgYSB2YWx1ZSBvZjpcbiAqXG4gKiAqIGxheWVyLlJFQ0VJUFRfU1RBVEUuU0VOVFxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLkRFTElWRVJFRFxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLlJFQURcbiAqICogbGF5ZXIuUkVDRUlQVF9TVEFURS5QRU5ESU5HXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUucmVjaXBpZW50U3RhdHVzID0gbnVsbDtcblxuLyoqXG4gKiBIYXZlIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMgcmVhZCB0aGlzIE1lc3NhZ2UgeWV0LlxuICpcbiAqIFRoaXMgdmFsdWUgaXMgb25lIG9mOlxuICpcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuQUxMXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLlNPTUVcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORVxuICpcbiAqICBUaGlzIHZhbHVlIGlzIHVwZGF0ZWQgYW55IHRpbWUgcmVjaXBpZW50U3RhdHVzIGNoYW5nZXMuXG4gKlxuICogU2VlIGxheWVyLk1lc3NhZ2UuQ29udmVyc2F0aW9uTWVzc2FnZS5yZWNpcGllbnRTdGF0dXMgZm9yIGEgbW9yZSBkZXRhaWxlZCByZXBvcnQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuTk9ORTtcblxuLyoqXG4gKiBIYXZlIHRoZSBvdGhlciBwYXJ0aWNpcGFudHMgcmVjZWl2ZWQgdGhpcyBNZXNzYWdlIHlldC5cbiAqXG4gICogVGhpcyB2YWx1ZSBpcyBvbmUgb2Y6XG4gKlxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTExcbiAqICAqIGxheWVyLkNvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuU09NRVxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FXG4gKlxuICogIFRoaXMgdmFsdWUgaXMgdXBkYXRlZCBhbnkgdGltZSByZWNpcGllbnRTdGF0dXMgY2hhbmdlcy5cbiAqXG4gKiBTZWUgbGF5ZXIuTWVzc2FnZS5Db252ZXJzYXRpb25NZXNzYWdlLnJlY2lwaWVudFN0YXR1cyBmb3IgYSBtb3JlIGRldGFpbGVkIHJlcG9ydC5cbiAqXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ29udmVyc2F0aW9uTWVzc2FnZS5wcm90b3R5cGUuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG5cbkNvbnZlcnNhdGlvbk1lc3NhZ2UuaW5PYmplY3RJZ25vcmUgPSBNZXNzYWdlLmluT2JqZWN0SWdub3JlO1xuQ29udmVyc2F0aW9uTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzID0gW10uY29uY2F0KE1lc3NhZ2UuX3N1cHBvcnRlZEV2ZW50cyk7XG5Sb290LmluaXRDbGFzcy5hcHBseShDb252ZXJzYXRpb25NZXNzYWdlLCBbQ29udmVyc2F0aW9uTWVzc2FnZSwgJ0NvbnZlcnNhdGlvbk1lc3NhZ2UnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvbk1lc3NhZ2U7XG4iXX0=
