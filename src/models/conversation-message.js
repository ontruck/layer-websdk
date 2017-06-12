/**
 * A layer.Message instance for use within layer.Conversation.
 *
 * @class layer.Message.ConversationMessage
 * @extends layer.Message
 */
const Root = require('../root');
const Message = require('./message');
const ClientRegistry = require('../client-registry');
const LayerError = require('../layer-error');
const Constants = require('../const');
const Util = require('../client-utils');

class ConversationMessage extends Message {
  constructor(options) {
    if (options.conversation) options.conversationId = options.conversation.id;
    super(options);

    this._disableEvents = true;
    if (!options.fromServer) this.recipientStatus = {};
    else this.__updateRecipientStatus(this.recipientStatus);
    this._disableEvents = false;

    const client = this.getClient();
    this.isInitializing = false;
    if (options && options.fromServer) {
      client._addMessage(this);
      const status = this.recipientStatus[client.user.id];
      if (status && status !== Constants.RECEIPT_STATE.READ && status !== Constants.RECEIPT_STATE.DELIVERED) {
        Util.defer(() => this._sendReceipt('delivery'));
      }
    }
  }

  /**
   * Get the layer.Conversation associated with this layer.Message.ConversationMessage.
   *
   * @method getConversation
   * @param {Boolean} load       Pass in true if the layer.Conversation should be loaded if not found locally
   * @return {layer.Conversation}
   */
  getConversation(load) {
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
  _loaded(data) {
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
  __getRecipientStatus(pKey) {
    const value = this[pKey] || {};
    const client = this.getClient();
    if (client) {
      const id = client.user.id;
      const conversation = this.getConversation(false);
      if (conversation) {
        conversation.participants.forEach((participant) => {
          if (!value[participant.id]) {
            value[participant.id] = participant.id === id ?
              Constants.RECEIPT_STATE.READ : Constants.RECEIPT_STATE.PENDING;
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
  __updateRecipientStatus(status, oldStatus) {
    const conversation = this.getConversation(false);
    const client = this.getClient();

    if (!conversation || Util.doesObjectMatch(status, oldStatus)) return;

    const id = client.user.id;
    const isSender = this.sender.sessionOwner;
    const userHasRead = status[id] === Constants.RECEIPT_STATE.READ;

    try {
      // -1 so we don't count this user
      const userCount = conversation.participants.length - 1;

      // If sent by this user or read by this user, update isRead/unread
      if (!this.__isRead && (isSender || userHasRead)) {
        this.__isRead = true; // no __updateIsRead event fired
      }

      // Update the readStatus/deliveryStatus properties
      const { readCount, deliveredCount } = this._getReceiptStatus(status, id);
      this._setReceiptStatus(readCount, deliveredCount, userCount);
    } catch (error) {
      // Do nothing
    }

    // Only trigger an event
    // 1. we're not initializing a new Message
    // 2. the user's state has been updated to read; we don't care about updates from other users if we aren't the sender.
    //    We also don't care about state changes to delivered; these do not inform rendering as the fact we are processing it
    //    proves its delivered.
    // 3. The user is the sender; in that case we do care about rendering receipts from other users
    if (!this.isInitializing && oldStatus) {
      const usersStateUpdatedToRead = userHasRead && oldStatus[id] !== Constants.RECEIPT_STATE.READ;
      // if (usersStateUpdatedToRead || isSender) {
        this._triggerAsync('messages:change', {
          oldValue: oldStatus,
          newValue: status,
          property: 'recipientStatus',
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
  _getReceiptStatus(status, id) {
    let readCount = 0,
      deliveredCount = 0;
    Object.keys(status)
      .filter(participant => participant !== id)
      .forEach((participant) => {
        if (status[participant] === Constants.RECEIPT_STATE.READ) {
          readCount++;
          deliveredCount++;
        } else if (status[participant] === Constants.RECEIPT_STATE.DELIVERED) {
          deliveredCount++;
        }
      });

    return {
      readCount,
      deliveredCount,
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
  _setReceiptStatus(readCount, deliveredCount, userCount) {
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
  __updateIsRead(value) {
    if (value) {
      if (!this._inPopulateFromServer) {
        this._sendReceipt(Constants.RECEIPT_STATE.READ);
      }
      this._triggerMessageRead();
      const conversation = this.getConversation(false);
      if (conversation) conversation.unreadCount--;
    }
  }

  /**
   * Trigger events indicating changes to the isRead/isUnread properties.
   *
   * @method _triggerMessageRead
   * @private
   */
  _triggerMessageRead() {
    const value = this.isRead;
    this._triggerAsync('messages:change', {
      property: 'isRead',
      oldValue: !value,
      newValue: value,
    });
    this._triggerAsync('messages:change', {
      property: 'isUnread',
      oldValue: value,
      newValue: !value,
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
  sendReceipt(type = Constants.RECEIPT_STATE.READ) {
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
        const conversation = this.getConversation(false);
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
  _sendReceipt(type) {
    // This little test exists so that we don't send receipts on Conversations we are no longer
    // participants in (participants = [] if we are not a participant)
    const conversation = this.getConversation(false);
    if (conversation && conversation.participants.length === 0) return;

    this._setSyncing();
    this._xhr({
      url: '/receipts',
      method: 'POST',
      data: {
        type,
      },
      sync: {
        // This should not be treated as a POST/CREATE request on the Message
        operation: 'RECEIPT',
      },
    }, () => this._setSynced());
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
  delete(mode) {
    if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
    let queryStr;
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

    const id = this.id;
    const client = this.getClient();
    this._xhr({
      url: '?' + queryStr,
      method: 'DELETE',
    }, (result) => {
      if (!result.success && (!result.data || (result.data.id !== 'not_found' && result.data.id !== 'authentication_required'))) {
        Message.load(id, client);
      }
    });

    this._deleted();
    this.destroy();
  }


  toObject() {
    if (!this._toObject) {
      this._toObject = super.toObject();
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
  static _createFromServer(message, client) {
    const fromWebsocket = message.fromWebsocket;
    let conversationId;
    if (message.conversation) {
      conversationId = message.conversation.id;
    } else {
      conversationId = message.conversationId;
    }

    return new ConversationMessage({
      conversationId,
      fromServer: message,
      clientId: client.appId,
      _fromDB: message._fromDB,
      _notify: fromWebsocket && message.is_unread && message.sender.user_id !== client.user.userId,
    });
  }
}

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
