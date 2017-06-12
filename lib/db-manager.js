'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Persistence manager.
 *
 * This class manages all indexedDB access.  It is not responsible for any localStorage access, though it may
 * receive configurations related to data stored in localStorage.  It will simply ignore those configurations.
 *
 * Rich Content will be written to IndexedDB as long as its small; see layer.DbManager.MaxPartSize for more info.
 *
 * TODO:
 * 0. Redesign this so that knowledge of the data is not hard-coded in
 * @class layer.DbManager
 * @protected
 */

var Root = require('./root');
var logger = require('./logger');
var SyncEvent = require('./sync-event');
var Constants = require('./const');
var Util = require('./client-utils');
var Announcement = require('./models/announcement');

var DB_VERSION = 5;
var MAX_SAFE_INTEGER = 9007199254740991;
var SYNC_NEW = Constants.SYNC_STATE.NEW;

function getDate(inDate) {
  return inDate ? inDate.toISOString() : null;
}

var TABLES = [{
  name: 'conversations',
  indexes: {
    created_at: ['created_at'],
    last_message_sent: ['last_message_sent']
  }
}, {
  name: 'channels',
  indexes: {
    created_at: ['created_at']
  }
}, {
  name: 'messages',
  indexes: {
    conversationId: ['conversationId', 'position']
  }
}, {
  name: 'identities',
  indexes: {}
}, {
  name: 'syncQueue',
  indexes: {}
}];

var DbManager = function (_Root) {
  _inherits(DbManager, _Root);

  /**
   * Create the DB Manager
   *
   * Key configuration is the layer.DbManager.persistenceFeatures property.
   *
   * @method constructor
   * @param {Object} options
   * @param {layer.Client} options.client
   * @param {Object} options.persistenceFeatures
   * @return {layer.DbManager} this
   */
  function DbManager(options) {
    _classCallCheck(this, DbManager);

    // If no indexedDB, treat everything as disabled.
    var _this = _possibleConstructorReturn(this, (DbManager.__proto__ || Object.getPrototypeOf(DbManager)).call(this, options));

    if (!window.indexedDB || !options.enabled) {
      options.tables = {};
    } else {
      // Test if Arrays as keys supported, disable persistence if not
      var enabled = true;

      /* istanbul ignore next */
      try {
        window.IDBKeyRange.bound(['announcement', 0], ['announcement', MAX_SAFE_INTEGER]);
      } catch (e) {
        options.tables = {};
        enabled = false;
      }

      // If Client is a layer.ClientAuthenticator, it won't support these events; this affects Unit Tests
      if (enabled && _this.client.constructor._supportedEvents.indexOf('conversations:add') !== -1) {
        _this.client.on('conversations:add', function (evt) {
          return _this.writeConversations(evt.conversations);
        }, _this);
        _this.client.on('conversations:change', function (evt) {
          return _this._updateConversation(evt.target, evt.changes);
        }, _this);
        _this.client.on('conversations:delete conversations:sent-error', function (evt) {
          return _this.deleteObjects('conversations', [evt.target]);
        }, _this);

        _this.client.on('channels:add', function (evt) {
          return _this.writeChannels(evt.channels);
        }, _this);
        _this.client.on('channels:change', function (evt) {
          return _this._updateChannel(evt.target, evt.changes);
        }, _this);
        _this.client.on('channels:delete channels:sent-error', function (evt) {
          return _this.deleteObjects('channels', [evt.target]);
        }, _this);

        _this.client.on('messages:add', function (evt) {
          return _this.writeMessages(evt.messages);
        }, _this);
        _this.client.on('messages:change', function (evt) {
          return _this.writeMessages([evt.target]);
        }, _this);
        _this.client.on('messages:delete messages:sent-error', function (evt) {
          return _this.deleteObjects('messages', [evt.target]);
        }, _this);

        _this.client.on('identities:add', function (evt) {
          return _this.writeIdentities(evt.identities);
        }, _this);
        _this.client.on('identities:change', function (evt) {
          return _this.writeIdentities([evt.target]);
        }, _this);
        _this.client.on('identities:unfollow', function (evt) {
          return _this.deleteObjects('identities', [evt.target]);
        }, _this);
      }

      // Sync Queue only really works properly if we have the Messages and Conversations written to the DB; turn it off
      // if that won't be the case.
      if (!options.tables.conversations && !options.tables.channels || !options.tables.messages) {
        options.tables.syncQueue = false;
      }
    }

    TABLES.forEach(function (tableDef) {
      _this['_permission_' + tableDef.name] = Boolean(options.tables[tableDef.name]);
    });
    _this._open(false);
    return _this;
  }

  _createClass(DbManager, [{
    key: '_getDbName',
    value: function _getDbName() {
      return 'LayerWebSDK_' + this.client.appId;
    }

    /**
     * Open the Database Connection.
     *
     * This is only called by the constructor.
     * @method _open
     * @param {Boolean} retry
     * @private
     */

  }, {
    key: '_open',
    value: function _open(retry) {
      var _this2 = this;

      if (this.db) {
        this.db.close();
        delete this.db;
      }

      // Abort if all tables are disabled
      var enabledTables = TABLES.filter(function (tableDef) {
        return _this2['_permission_' + tableDef.name];
      });
      if (enabledTables.length === 0) {
        this._isOpenError = true;
        this.trigger('error', { error: 'Persistence is disabled by application' });
        return;
      }

      // Open the database
      var request = window.indexedDB.open(this._getDbName(), DB_VERSION);

      try {
        /* istanbul ignore next */
        request.onerror = function (evt) {
          if (!retry) {
            _this2.deleteTables(function () {
              return _this2._open(true);
            });
          }

          // Triggered by Firefox private browsing window
          else {
              _this2._isOpenError = true;
              logger.warn('Database Unable to Open (common cause: private browsing window)', evt.target.error);
              _this2.trigger('error', { error: evt });
            }
        };

        request.onupgradeneeded = function (evt) {
          return _this2._onUpgradeNeeded(evt);
        };
        request.onsuccess = function (evt) {
          _this2.db = evt.target.result;
          _this2.isOpen = true;
          _this2.trigger('open');

          _this2.db.onversionchange = function () {
            _this2.db.close();
            _this2.isOpen = false;
          };

          _this2.db.onerror = function (err) {
            return logger.error('db-manager Error: ', err);
          };
        };
      }

      /* istanbul ignore next */
      catch (err) {
        // Safari Private Browsing window will fail on request.onerror
        this._isOpenError = true;
        logger.error('Database Unable to Open: ', err);
        this.trigger('error', { error: err });
      }
    }

    /**
     * Use this to setup a call to happen as soon as the database is open.
     *
     * Typically, this call will immediately, synchronously call your callback.
     * But if the DB is not open yet, your callback will be called once its open.
     * @method onOpen
     * @param {Function} callback
     */

  }, {
    key: 'onOpen',
    value: function onOpen(callback) {
      if (this.isOpen || this._isOpenError) callback();else this.once('open error', callback);
    }

    /**
     * The onUpgradeNeeded function is called by IndexedDB any time DB_VERSION is incremented.
     *
     * This invocation is part of the built-in lifecycle of IndexedDB.
     *
     * @method _onUpgradeNeeded
     * @param {IDBVersionChangeEvent} event
     * @private
     */
    /* istanbul ignore next */

  }, {
    key: '_onUpgradeNeeded',
    value: function _onUpgradeNeeded(event) {
      var _this3 = this;

      var db = event.target.result;
      var isComplete = false;

      // This appears to only get called once; its presumed this is because we're creating but not using a lot of transactions.
      var onComplete = function onComplete(evt) {
        if (!isComplete) {
          _this3.db = db;
          _this3.isComplete = true;
          _this3.isOpen = true;
          _this3.trigger('open');
        }
      };

      var currentTables = Array.prototype.slice.call(db.objectStoreNames);
      TABLES.forEach(function (tableDef) {
        try {
          if (currentTables.indexOf(tableDef.name) !== -1) db.deleteObjectStore(tableDef.name);
        } catch (e) {
          // Noop
        }
        try {
          var store = db.createObjectStore(tableDef.name, { keyPath: 'id' });
          Object.keys(tableDef.indexes).forEach(function (indexName) {
            return store.createIndex(indexName, tableDef.indexes[indexName], { unique: false });
          });
          store.transaction.oncomplete = onComplete;
        } catch (e) {
          // Noop
          /* istanbul ignore next */
          logger.error('Failed to create object store ' + tableDef.name, e);
        }
      });
    }

    /**
     * Convert array of Conversation instances into Conversation DB Entries.
     *
     * A Conversation DB entry looks a lot like the server representation, but
     * includes a sync_state property, and `last_message` contains a message ID not
     * a Message object.
     *
     * @method _getConversationData
     * @private
     * @param {layer.Conversation[]} conversations
     * @return {Object[]} conversations
     */

  }, {
    key: '_getConversationData',
    value: function _getConversationData(conversations) {
      var _this4 = this;

      return conversations.filter(function (conversation) {
        if (conversation._fromDB) {
          conversation._fromDB = false;
          return false;
        } else if (conversation.isLoading || conversation.syncState === SYNC_NEW) {
          return false;
        } else {
          return true;
        }
      }).map(function (conversation) {
        var item = {
          id: conversation.id,
          url: conversation.url,
          participants: _this4._getIdentityData(conversation.participants, true),
          distinct: conversation.distinct,
          created_at: getDate(conversation.createdAt),
          metadata: conversation.metadata,
          unread_message_count: conversation.unreadCount,
          last_message: conversation.lastMessage ? conversation.lastMessage.id : '',
          last_message_sent: conversation.lastMessage ? getDate(conversation.lastMessage.sentAt) : getDate(conversation.createdAt),
          sync_state: conversation.syncState
        };
        return item;
      });
    }
  }, {
    key: '_updateConversation',
    value: function _updateConversation(conversation, changes) {
      var _this5 = this;

      var idChanges = changes.filter(function (item) {
        return item.property === 'id';
      });
      if (idChanges.length) {
        this.deleteObjects('conversations', [{ id: idChanges[0].oldValue }], function () {
          _this5.writeConversations([conversation]);
        });
      } else {
        this.writeConversations([conversation]);
      }
    }

    /**
     * Writes an array of Conversations to the Database.
     *
     * @method writeConversations
     * @param {layer.Conversation[]} conversations - Array of Conversations to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeConversations',
    value: function writeConversations(conversations, callback) {
      this._writeObjects('conversations', this._getConversationData(conversations.filter(function (conversation) {
        return !conversation.isDestroyed;
      })), callback);
    }

    /**
     * Convert array of Channel instances into Channel DB Entries.
     *
     * A Channel DB entry looks a lot like the server representation, but
     * includes a sync_state property, and `last_message` contains a message ID not
     * a Message object.
     *
     * @method _getChannelData
     * @private
     * @param {layer.Channel[]} channels
     * @return {Object[]} channels
     */

  }, {
    key: '_getChannelData',
    value: function _getChannelData(channels) {
      return channels.filter(function (channel) {
        if (channel._fromDB) {
          channel._fromDB = false;
          return false;
        } else if (channel.isLoading || channel.syncState === SYNC_NEW) {
          return false;
        } else {
          return true;
        }
      }).map(function (channel) {
        var item = {
          id: channel.id,
          url: channel.url,
          created_at: getDate(channel.createdAt),
          sync_state: channel.syncState,
          // TODO: membership object should be written... but spec incomplete
          membership: null,
          name: channel.name,
          metadata: channel.metadata
        };
        return item;
      });
    }
  }, {
    key: '_updateChannel',
    value: function _updateChannel(channel, changes) {
      var _this6 = this;

      var idChanges = changes.filter(function (item) {
        return item.property === 'id';
      });
      if (idChanges.length) {
        this.deleteObjects('channels', [{ id: idChanges[0].oldValue }], function () {
          _this6.writeChannels([channel]);
        });
      } else {
        this.writeChannels([channel]);
      }
    }

    /**
     * Writes an array of Conversations to the Database.
     *
     * @method writeChannels
     * @param {layer.Channel[]} channels - Array of Channels to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeChannels',
    value: function writeChannels(channels, callback) {
      this._writeObjects('channels', this._getChannelData(channels.filter(function (channel) {
        return !channel.isDestroyed;
      })), callback);
    }

    /**
     * Convert array of Identity instances into Identity DB Entries.
     *
     * @method _getIdentityData
     * @private
     * @param {layer.Identity[]} identities
     * @param {boolean} writeBasicIdentity - Forces output as a Basic Identity
     * @return {Object[]} identities
     */

  }, {
    key: '_getIdentityData',
    value: function _getIdentityData(identities, writeBasicIdentity) {
      return identities.filter(function (identity) {
        if (identity.isDestroyed || !identity.isFullIdentity && !writeBasicIdentity) return false;

        if (identity._fromDB) {
          identity._fromDB = false;
          return false;
        } else if (identity.isLoading) {
          return false;
        } else {
          return true;
        }
      }).map(function (identity) {
        if (identity.isFullIdentity && !writeBasicIdentity) {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            first_name: identity.firstName,
            last_name: identity.lastName,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl,
            metadata: identity.metadata,
            public_key: identity.publicKey,
            phone_number: identity.phoneNumber,
            email_address: identity.emailAddress,
            sync_state: identity.syncState,
            type: identity.type
          };
        } else {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl
          };
        }
      });
    }

    /**
     * Writes an array of Identities to the Database.
     *
     * @method writeIdentities
     * @param {layer.Identity[]} identities - Array of Identities to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeIdentities',
    value: function writeIdentities(identities, callback) {
      this._writeObjects('identities', this._getIdentityData(identities), callback);
    }

    /**
     * Convert array of Message instances into Message DB Entries.
     *
     * A Message DB entry looks a lot like the server representation, but
     * includes a sync_state property.
     *
     * @method _getMessageData
     * @private
     * @param {layer.Message[]} messages
     * @param {Function} callback
     * @return {Object[]} messages
     */

  }, {
    key: '_getMessageData',
    value: function _getMessageData(messages, callback) {
      var _this7 = this;

      var dbMessages = messages.filter(function (message) {
        if (message._fromDB) {
          message._fromDB = false;
          return false;
        } else if (message.syncState === Constants.SYNC_STATE.LOADING) {
          return false;
        } else {
          return true;
        }
      }).map(function (message) {
        return {
          id: message.id,
          url: message.url,
          parts: message.parts.map(function (part) {
            var body = Util.isBlob(part.body) && part.body.size > DbManager.MaxPartSize ? null : part.body;
            return {
              body: body,
              id: part.id,
              encoding: part.encoding,
              mime_type: part.mimeType,
              content: !part._content ? null : {
                id: part._content.id,
                download_url: part._content.downloadUrl,
                expiration: part._content.expiration,
                refresh_url: part._content.refreshUrl,
                size: part._content.size
              }
            };
          }),
          position: message.position,
          sender: _this7._getIdentityData([message.sender], true)[0],
          recipient_status: message.recipientStatus,
          sent_at: getDate(message.sentAt),
          received_at: getDate(message.receivedAt),
          conversationId: message instanceof Announcement ? 'announcement' : message.conversationId,
          sync_state: message.syncState,
          is_unread: message.isUnread
        };
      });

      // Find all blobs and convert them to base64... because Safari 9.1 doesn't support writing blobs those Frelling Smurfs.
      var count = 0;
      var parts = [];
      dbMessages.forEach(function (message) {
        message.parts.forEach(function (part) {
          if (Util.isBlob(part.body)) parts.push(part);
        });
      });
      if (parts.length === 0) {
        callback(dbMessages);
      } else {
        parts.forEach(function (part) {
          Util.blobToBase64(part.body, function (base64) {
            part.body = base64;
            part.useBlob = true;
            count++;
            if (count === parts.length) callback(dbMessages);
          });
        });
      }
    }

    /**
     * Writes an array of Messages to the Database.
     *
     * @method writeMessages
     * @param {layer.Message[]} messages - Array of Messages to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeMessages',
    value: function writeMessages(messages, callback) {
      var _this8 = this;

      this._getMessageData(messages.filter(function (message) {
        return !message.isDestroyed;
      }), function (dbMessageData) {
        return _this8._writeObjects('messages', dbMessageData, callback);
      });
    }

    /**
     * Convert array of SyncEvent instances into SyncEvent DB Entries.
     *
     * @method _getSyncEventData
     * @param {layer.SyncEvent[]} syncEvents
     * @return {Object[]} syncEvents
     * @private
     */

  }, {
    key: '_getSyncEventData',
    value: function _getSyncEventData(syncEvents) {
      return syncEvents.filter(function (syncEvt) {
        if (syncEvt.fromDB) {
          syncEvt.fromDB = false;
          return false;
        } else {
          return true;
        }
      }).map(function (syncEvent) {
        var item = {
          id: syncEvent.id,
          target: syncEvent.target,
          depends: syncEvent.depends,
          isWebsocket: syncEvent instanceof SyncEvent.WebsocketSyncEvent,
          operation: syncEvent.operation,
          data: syncEvent.data,
          url: syncEvent.url || '',
          headers: syncEvent.headers || null,
          method: syncEvent.method || null,
          created_at: syncEvent.createdAt
        };
        return item;
      });
    }

    /**
     * Writes an array of SyncEvent to the Database.
     *
     * @method writeSyncEvents
     * @param {layer.SyncEvent[]} syncEvents - Array of Sync Events to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeSyncEvents',
    value: function writeSyncEvents(syncEvents, callback) {
      this._writeObjects('syncQueue', this._getSyncEventData(syncEvents), callback);
    }

    /**
     * Write an array of data to the specified Database table.
     *
     * @method _writeObjects
     * @param {string} tableName - The name of the table to write to
     * @param {Object[]} data - Array of POJO data to write
     * @param {Function} [callback] - Called when all data is written
     * @protected
     */

  }, {
    key: '_writeObjects',
    value: function _writeObjects(tableName, data, callback) {
      var _this9 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;

      // Just quit if no data to write
      if (!data.length) {
        if (callback) callback();
        return;
      }

      // PUT (udpate) or ADD (insert) each item of data one at a time, but all as part of one large transaction.
      this.onOpen(function () {
        _this9.getObjects(tableName, data.map(function (item) {
          return item.id;
        }), function (foundItems) {
          var updateIds = {};
          foundItems.forEach(function (item) {
            updateIds[item.id] = item;
          });

          var transaction = _this9.db.transaction([tableName], 'readwrite');
          var store = transaction.objectStore(tableName);
          transaction.oncomplete = transaction.onerror = callback;

          data.forEach(function (item) {
            try {
              if (updateIds[item.id]) {
                store.put(item);
              } else {
                store.add(item);
              }
            } catch (e) {
              /* istanbul ignore next */
              // Safari throws an error rather than use the onerror event.
              logger.error(e);
            }
          });
        });
      });
    }

    /**
     * Load all conversations from the database.
     *
     * @method loadConversations
     * @param {string} sortBy       - One of 'last_message' or 'created_at'; always sorts in DESC order
     * @param {string} [fromId=]    - For pagination, provide the conversationId to get Conversations after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]  - Callback for getting results
     * @param {layer.Conversation[]} callback.result
     */

  }, {
    key: 'loadConversations',
    value: function loadConversations(sortBy, fromId, pageSize, callback) {
      var _this10 = this;

      try {
        var sortIndex = void 0,
            range = null;
        var fromConversation = fromId ? this.client.getConversation(fromId) : null;
        if (sortBy === 'last_message') {
          sortIndex = 'last_message_sent';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([fromConversation.lastMessage ? getDate(fromConversation.lastMessage.sentAt) : getDate(fromConversation.createdAt)]);
          }
        } else {
          sortIndex = 'created_at';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([getDate(fromConversation.createdAt)]);
          }
        }

        // Step 1: Get all Conversations
        this._loadByIndex('conversations', sortIndex, range, Boolean(fromId), pageSize, function (data) {
          // Step 2: Gather all Message IDs needed to initialize these Conversation's lastMessage properties.
          var messagesToLoad = data.map(function (item) {
            return item.last_message;
          }).filter(function (messageId) {
            return messageId && !_this10.client.getMessage(messageId);
          });

          // Step 3: Load all Messages needed to initialize these Conversation's lastMessage properties.
          _this10.getObjects('messages', messagesToLoad, function (messages) {
            _this10._loadConversationsResult(data, messages, callback);
          });
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }

    /**
     * Assemble all LastMessages and Conversation POJOs into layer.Message and layer.Conversation instances.
     *
     * @method _loadConversationsResult
     * @private
     * @param {Object[]} conversations
     * @param {Object[]} messages
     * @param {Function} callback
     * @param {layer.Conversation[]} callback.result
     */

  }, {
    key: '_loadConversationsResult',
    value: function _loadConversationsResult(conversations, messages, callback) {
      var _this11 = this;

      // Instantiate and Register each Message
      messages.forEach(function (message) {
        return _this11._createMessage(message);
      });

      // Instantiate and Register each Conversation; will find any lastMessage that was registered.
      var newData = conversations.map(function (conversation) {
        return _this11._createConversation(conversation) || _this11.client.getConversation(conversation.id);
      }).filter(function (conversation) {
        return conversation;
      });

      // Return the data
      if (callback) callback(newData);
    }

    /**
     * Load all channels from the database.
     *
     * @method loadChannels
     * @param {string} sortBy       - One of 'last_message' or 'created_at'; always sorts in DESC order
     * @param {string} [fromId=]    - For pagination, provide the channelId to get Channel after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]  - Callback for getting results
     * @param {layer.Channel[]} callback.result
     */

  }, {
    key: 'loadChannels',
    value: function loadChannels(fromId, pageSize, callback) {
      var _this12 = this;

      try {
        var sortIndex = 'created_at';
        var range = null;
        var fromChannel = fromId ? this.client.getChannel(fromId) : null;
        if (fromChannel) {
          range = window.IDBKeyRange.upperBound([getDate(fromChannel.createdAt)]);
        }

        this._loadByIndex('channels', sortIndex, range, Boolean(fromId), pageSize, function (data) {
          _this12._loadChannelsResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }

    /**
     * Assemble all LastMessages and Conversation POJOs into layer.Message and layer.Conversation instances.
     *
     * @method _loadChannelsResult
     * @private
     * @param {Object[]} channels
     * @param {Function} callback
     * @param {layer.Channel[]} callback.result
     */

  }, {
    key: '_loadChannelsResult',
    value: function _loadChannelsResult(channels, callback) {
      var _this13 = this;

      // Instantiate and Register each Conversation; will find any lastMessage that was registered.
      var newData = channels.map(function (channel) {
        return _this13._createChannel(channel) || _this13.client.getChannel(channel.id);
      }).filter(function (conversation) {
        return conversation;
      });

      // Return the data
      if (callback) callback(newData);
    }

    /**
     * Load all messages for a given Conversation ID from the database.
     *
     * Use _loadAll if loading All Messages rather than all Messages for a Conversation.
     *
     * @method loadMessages
     * @param {string} conversationId - ID of the Conversation whose Messages are of interest.
     * @param {string} [fromId=]    - For pagination, provide the messageId to get Messages after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]   - Callback for getting results
     * @param {layer.Message[]} callback.result
     */

  }, {
    key: 'loadMessages',
    value: function loadMessages(conversationId, fromId, pageSize, callback) {
      var _this14 = this;

      if (!this['_permission_messages'] || this._isOpenError) return callback([]);
      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound([conversationId, 0], [conversationId, fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversationId', query, Boolean(fromId), pageSize, function (data) {
          _this14._loadMessagesResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }

    /**
     * Load all Announcements from the database.
     *
     * @method loadAnnouncements
     * @param {string} [fromId=]    - For pagination, provide the messageId to get Announcements after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]
     * @param {layer.Announcement[]} callback.result
     */

  }, {
    key: 'loadAnnouncements',
    value: function loadAnnouncements(fromId, pageSize, callback) {
      var _this15 = this;

      if (!this['_permission_messages'] || this._isOpenError) return callback([]);
      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound(['announcement', 0], ['announcement', fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversationId', query, Boolean(fromId), pageSize, function (data) {
          _this15._loadMessagesResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }
  }, {
    key: '_blobifyPart',
    value: function _blobifyPart(part) {
      if (part.useBlob) {
        part.body = Util.base64ToBlob(part.body);
        delete part.useBlob;
        part.encoding = null;
      }
    }

    /**
     * Registers and sorts the message objects from the database.
     *
     * TODO: Encode limits on this, else we are sorting tens of thousands
     * of messages in javascript.
     *
     * @method _loadMessagesResult
     * @private
     * @param {Object[]} Message objects from the database.
     * @param {Function} callback
     * @param {layer.Message} callback.result - Message instances created from the database
     */

  }, {
    key: '_loadMessagesResult',
    value: function _loadMessagesResult(messages, callback) {
      var _this16 = this;

      // Convert base64 to blob before sending it along...
      messages.forEach(function (message) {
        return message.parts.forEach(function (part) {
          return _this16._blobifyPart(part);
        });
      });

      // Instantiate and Register each Message
      var newData = messages.map(function (message) {
        return _this16._createMessage(message) || _this16.client.getMessage(message.id);
      }).filter(function (message) {
        return message;
      });

      // Return the results
      if (callback) callback(newData);
    }

    /**
     * Load all Identities from the database.
     *
     * @method loadIdentities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: 'loadIdentities',
    value: function loadIdentities(callback) {
      var _this17 = this;

      this._loadAll('identities', function (data) {
        _this17._loadIdentitiesResult(data, callback);
      });
    }

    /**
     * Assemble all LastMessages and Identityy POJOs into layer.Message and layer.Identityy instances.
     *
     * @method _loadIdentitiesResult
     * @private
     * @param {Object[]} identities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: '_loadIdentitiesResult',
    value: function _loadIdentitiesResult(identities, callback) {
      var _this18 = this;

      // Instantiate and Register each Identity.
      var newData = identities.map(function (identity) {
        return _this18._createIdentity(identity) || _this18.client.getIdentity(identity.id);
      }).filter(function (identity) {
        return identity;
      });

      // Return the data
      if (callback) callback(newData);
    }

    /**
     * Instantiate and Register the Conversation from a conversation DB Entry.
     *
     * If the layer.Conversation already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * Attempts to assign the lastMessage property to refer to appropriate Message.  If it fails,
     * it will be set to null.
     *
     * @method _createConversation
     * @private
     * @param {Object} conversation
     * @returns {layer.Conversation}
     */

  }, {
    key: '_createConversation',
    value: function _createConversation(conversation) {
      if (!this.client.getConversation(conversation.id)) {
        conversation._fromDB = true;
        var newConversation = this.client._createObject(conversation);
        newConversation.syncState = conversation.sync_state;
        return newConversation;
      }
    }

    /**
     * Instantiate and Register the Channel from a Channel DB Entry.
     *
     * If the layer.Channel already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * Attempts to assign the lastMessage property to refer to appropriate Message.  If it fails,
     * it will be set to null.
     *
     * @method _createChannel
     * @private
     * @param {Object} channel
     * @returns {layer.Channel}
     */

  }, {
    key: '_createChannel',
    value: function _createChannel(channel) {
      if (!this.client.getChannel(channel.id)) {
        channel._fromDB = true;
        var newChannel = this.client._createObject(channel);
        newChannel.syncState = channel.sync_state;
        return newChannel;
      }
    }

    /**
     * Instantiate and Register the Message from a message DB Entry.
     *
     * If the layer.Message already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * @method _createMessage
     * @private
     * @param {Object} message
     * @returns {layer.Message}
     */

  }, {
    key: '_createMessage',
    value: function _createMessage(message) {
      if (!this.client.getMessage(message.id)) {
        message._fromDB = true;
        if (message.conversationId.indexOf('layer:///conversations')) {
          message.conversation = {
            id: message.conversationId
          };
        } else if (message.conversationId.indexOf('layer:///channels')) {
          message.channel = {
            id: message.conversationId
          };
        }
        delete message.conversationId;
        var newMessage = this.client._createObject(message);
        newMessage.syncState = message.sync_state;
        return newMessage;
      }
    }

    /**
     * Instantiate and Register the Identity from an identities DB Entry.
     *
     * If the layer.Identity already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * @method _createIdentity
     * @param {Object} identity
     * @returns {layer.Identity}
     */

  }, {
    key: '_createIdentity',
    value: function _createIdentity(identity) {
      if (!this.client.getIdentity(identity.id)) {
        identity._fromDB = true;
        var newidentity = this.client._createObject(identity);
        newidentity.syncState = identity.sync_state;
        return newidentity;
      }
    }

    /**
     * Load all Sync Events from the database.
     *
     * @method loadSyncQueue
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: 'loadSyncQueue',
    value: function loadSyncQueue(callback) {
      var _this19 = this;

      this._loadAll('syncQueue', function (syncEvents) {
        return _this19._loadSyncEventRelatedData(syncEvents, callback);
      });
    }

    /**
     * Validate that we have appropriate data for each SyncEvent and instantiate it.
     *
     * Any operation that is not a DELETE must have a valid target found in the database or javascript cache,
     * otherwise it can not be executed.
     *
     * TODO: Need to cleanup sync entries that have invalid targets
     *
     * @method _loadSyncEventRelatedData
     * @private
     * @param {Object[]} syncEvents
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: '_loadSyncEventRelatedData',
    value: function _loadSyncEventRelatedData(syncEvents, callback) {
      var _this20 = this;

      // Gather all Message IDs that are targets of operations.
      var messageIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/messages/);
      }).map(function (item) {
        return item.target;
      });

      // Gather all Conversation IDs that are targets of operations.
      var conversationIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/conversations/);
      }).map(function (item) {
        return item.target;
      });

      var identityIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/identities/);
      }).map(function (item) {
        return item.target;
      });

      // Load any Messages/Conversations that are targets of operations.
      // Call _createMessage or _createConversation on all targets found.
      var counter = 0;
      var maxCounter = 3;
      this.getObjects('messages', messageIds, function (messages) {
        messages.forEach(function (message) {
          return _this20._createMessage(message);
        });
        counter++;
        if (counter === maxCounter) _this20._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('conversations', conversationIds, function (conversations) {
        conversations.forEach(function (conversation) {
          return _this20._createConversation(conversation);
        });
        counter++;
        if (counter === maxCounter) _this20._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('identities', identityIds, function (identities) {
        identities.forEach(function (identity) {
          return _this20._createIdentity(identity);
        });
        counter++;
        if (counter === maxCounter) _this20._loadSyncEventResults(syncEvents, callback);
      });
    }

    /**
     * Turn an array of Sync Event DB Entries into an array of layer.SyncEvent.
     *
     * @method _loadSyncEventResults
     * @private
     * @param {Object[]} syncEvents
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: '_loadSyncEventResults',
    value: function _loadSyncEventResults(syncEvents, callback) {
      var _this21 = this;

      // If the target is present in the sync event, but does not exist in the system,
      // do NOT attempt to instantiate this event... unless its a DELETE operation.
      var newData = syncEvents.filter(function (syncEvent) {
        var hasTarget = Boolean(syncEvent.target && _this21.client.getObject(syncEvent.target));
        return syncEvent.operation === 'DELETE' || hasTarget;
      }).map(function (syncEvent) {
        if (syncEvent.isWebsocket) {
          return new SyncEvent.WebsocketSyncEvent({
            target: syncEvent.target,
            depends: syncEvent.depends,
            operation: syncEvent.operation,
            id: syncEvent.id,
            data: syncEvent.data,
            fromDB: true,
            createdAt: syncEvent.created_at
          });
        } else {
          return new SyncEvent.XHRSyncEvent({
            target: syncEvent.target,
            depends: syncEvent.depends,
            operation: syncEvent.operation,
            id: syncEvent.id,
            data: syncEvent.data,
            method: syncEvent.method,
            headers: syncEvent.headers,
            url: syncEvent.url,
            fromDB: true,
            createdAt: syncEvent.created_at
          });
        }
      });

      // Sort the results and then return them.
      // TODO: Query results should come back sorted by database with proper Index
      Util.sortBy(newData, function (item) {
        return item.createdAt;
      });
      callback(newData);
    }

    /**
     * Load all data from the specified table.
     *
     * @method _loadAll
     * @protected
     * @param {String} tableName
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: '_loadAll',
    value: function _loadAll(tableName, callback) {
      var _this22 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      this.onOpen(function () {
        var data = [];
        _this22.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          /* istanbul ignore next */
          if (_this22.isDestroyed) return;
          var cursor = evt.target.result;
          if (cursor) {
            data.push(cursor.value);
            cursor.continue();
          } else if (!_this22.isDestroyed) {
            /* istanbul ignore next */
            callback(data);
          }
        };
      });
    }

    /**
     * Load all data from the specified table and with the specified index value.
     *
     * Results are always sorted in DESC order at this time.
     *
     * @method _loadByIndex
     * @protected
     * @param {String} tableName - 'messages', 'conversations', 'identities'
     * @param {String} indexName - Name of the index to query on
     * @param {IDBKeyRange} range - Range to Query for (null ok)
     * @param {Boolean} isFromId - If querying for results after a specified ID, then we want to skip the first result (which will be that ID) ("" is OK)
     * @param {number} pageSize - If a value is provided, return at most that number of results; else return all results.
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: '_loadByIndex',
    value: function _loadByIndex(tableName, indexName, range, isFromId, pageSize, callback) {
      var _this23 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var shouldSkipNext = isFromId;
      this.onOpen(function () {
        var data = [];
        _this23.db.transaction([tableName], 'readonly').objectStore(tableName).index(indexName).openCursor(range, 'prev').onsuccess = function (evt) {
          /* istanbul ignore next */
          if (_this23.isDestroyed) return;
          var cursor = evt.target.result;
          if (cursor) {
            if (shouldSkipNext) {
              shouldSkipNext = false;
            } else {
              data.push(cursor.value);
            }
            if (pageSize && data.length >= pageSize) {
              callback(data);
            } else {
              cursor.continue();
            }
          } else {
            callback(data);
          }
        };
      });
    }

    /**
     * Deletes the specified objects from the specified table.
     *
     * Currently takes an array of data to delete rather than an array of IDs;
     * If you only have an ID, [{id: myId}] should work.
     *
     * @method deleteObjects
     * @param {String} tableName
     * @param {Object[]} data
     * @param {Function} [callback]
     */

  }, {
    key: 'deleteObjects',
    value: function deleteObjects(tableName, data, callback) {
      var _this24 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;
      this.onOpen(function () {
        var transaction = _this24.db.transaction([tableName], 'readwrite');
        var store = transaction.objectStore(tableName);
        transaction.oncomplete = callback;
        data.forEach(function (item) {
          return store.delete(item.id);
        });
      });
    }

    /**
     * Retrieve the identified objects from the specified database table.
     *
     * Turning these into instances is the responsibility of the caller.
     *
     * Inspired by http://www.codeproject.com/Articles/744986/How-to-do-some-magic-with-indexedDB
     *
     * @method getObjects
     * @param {String} tableName
     * @param {String[]} ids
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: 'getObjects',
    value: function getObjects(tableName, ids, callback) {
      var _this25 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var data = [];

      // Gather, sort, and filter replica IDs
      var sortedIds = ids.sort();
      for (var i = sortedIds.length - 1; i > 0; i--) {
        if (sortedIds[i] === sortedIds[i - 1]) sortedIds.splice(i, 1);
      }
      var index = 0;

      // Iterate over the table searching for the specified IDs
      this.onOpen(function () {
        _this25.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          /* istanbul ignore next */
          if (_this25.isDestroyed) return;
          var cursor = evt.target.result;
          if (!cursor) {
            callback(data);
            return;
          }
          var key = cursor.key;

          // The cursor has passed beyond this key. Check next.
          while (key > sortedIds[index]) {
            index++;
          } // The cursor is pointing at one of our IDs, get it and check next.
          if (key === sortedIds[index]) {
            data.push(cursor.value);
            index++;
          }

          // Done or check next
          if (index === sortedIds.length) {
            /* istanbul ignore else */
            if (!_this25.isDestroyed) callback(data);
          } else {
            cursor.continue(sortedIds[index]);
          }
        };
      });
    }

    /**
     * A simplified getObjects() method that gets a single object, and also gets its related objects.
     *
     * @method getObject
     * @param {string} tableName
     * @param {string} id
     * @param {Function} callback
     * @param {Object} callback.data
     */

  }, {
    key: 'getObject',
    value: function getObject(tableName, id, callback) {
      var _this26 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback();

      this.onOpen(function () {
        _this26.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor(window.IDBKeyRange.only(id)).onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (!cursor) return callback(null);

          switch (tableName) {
            case 'messages':
              // Convert base64 to blob before sending it along...
              cursor.value.parts.forEach(function (part) {
                return _this26._blobifyPart(part);
              });
              return callback(cursor.value);
            case 'identities':
            case 'channels':
              return callback(cursor.value);
            case 'conversations':
              if (cursor.value.last_message) {
                var lastMessage = _this26.client.getMessage(cursor.value.last_message);
                if (lastMessage) {
                  return _this26._getMessageData([lastMessage], function (messages) {
                    cursor.value.last_message = messages[0];
                    callback(cursor.value);
                  });
                } else {
                  return _this26.getObject('messages', cursor.value.last_message, function (message) {
                    cursor.value.last_message = message;
                    callback(cursor.value);
                  });
                }
              } else {
                return callback(cursor.value);
              }
          }
        };
      });
    }

    /**
     * Claim a Sync Event.
     *
     * A sync event is claimed by locking the table,  validating that it is still in the table... and then deleting it from the table.
     *
     * @method claimSyncEvent
     * @param {layer.SyncEvent} syncEvent
     * @param {Function} callback
     * @param {Boolean} callback.result
     */

  }, {
    key: 'claimSyncEvent',
    value: function claimSyncEvent(syncEvent, callback) {
      var _this27 = this;

      if (!this._permission_syncQueue || this._isOpenError) return callback(true);
      this.onOpen(function () {
        var transaction = _this27.db.transaction(['syncQueue'], 'readwrite');
        var store = transaction.objectStore('syncQueue');
        store.get(syncEvent.id).onsuccess = function (evt) {
          return callback(Boolean(evt.target.result));
        };
        store.delete(syncEvent.id);
      });
    }

    /**
     * Delete all data from all tables.
     *
     * This should be called from layer.Client.logout()
     *
     * @method deleteTables
     * @param {Function} [calllback]
     */

  }, {
    key: 'deleteTables',
    value: function deleteTables() {
      var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

      try {
        var request = window.indexedDB.deleteDatabase(this._getDbName());
        request.onsuccess = request.onerror = callback;
        delete this.db;
      } catch (e) {
        logger.error('Failed to delete database', e);
        if (callback) callback(e);
      }
    }
  }]);

  return DbManager;
}(Root);

/**
 * @type {layer.Client} Layer Client instance
 */


DbManager.prototype.client = null;

/**
 * @type {boolean} is the db connection open
 */
DbManager.prototype.isOpen = false;

/**
 * @type {boolean} is the db connection will not open
 * @private
 */
DbManager.prototype._isOpenError = false;

/**
 * @type {boolean} Is reading/writing messages allowed?
 * @private
 */
DbManager.prototype._permission_messages = false;

/**
 * @type {boolean} Is reading/writing conversations allowed?
 * @private
 */
DbManager.prototype._permission_conversations = false;

/**
 * @type {boolean} Is reading/writing channels allowed?
 * @private
 */
DbManager.prototype._permission_channels = false;

/**
 * @type {boolean} Is reading/writing identities allowed?
 * @private
 */
DbManager.prototype._permission_identities = false;

/**
 * @type {boolean} Is reading/writing unsent server requests allowed?
 * @private
 */
DbManager.prototype._permission_syncQueue = false;

/**
 * @type IDBDatabase
 */
DbManager.prototype.db = null;

/**
 * Rich Content may be written to indexeddb and persisted... if its size is less than this number of bytes.
 *
 * This value can be customized; this example only writes Rich Content that is less than 5000 bytes
 *
 *    layer.DbManager.MaxPartSize = 5000;
 *
 * @static
 * @type {Number}
 */
DbManager.MaxPartSize = 250000;

DbManager._supportedEvents = ['open', 'error'].concat(Root._supportedEvents);

Root.initClass.apply(DbManager, [DbManager, 'DbManager']);
module.exports = DbManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kYi1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwibG9nZ2VyIiwiU3luY0V2ZW50IiwiQ29uc3RhbnRzIiwiVXRpbCIsIkFubm91bmNlbWVudCIsIkRCX1ZFUlNJT04iLCJNQVhfU0FGRV9JTlRFR0VSIiwiU1lOQ19ORVciLCJTWU5DX1NUQVRFIiwiTkVXIiwiZ2V0RGF0ZSIsImluRGF0ZSIsInRvSVNPU3RyaW5nIiwiVEFCTEVTIiwibmFtZSIsImluZGV4ZXMiLCJjcmVhdGVkX2F0IiwibGFzdF9tZXNzYWdlX3NlbnQiLCJjb252ZXJzYXRpb25JZCIsIkRiTWFuYWdlciIsIm9wdGlvbnMiLCJ3aW5kb3ciLCJpbmRleGVkREIiLCJlbmFibGVkIiwidGFibGVzIiwiSURCS2V5UmFuZ2UiLCJib3VuZCIsImUiLCJjbGllbnQiLCJjb25zdHJ1Y3RvciIsIl9zdXBwb3J0ZWRFdmVudHMiLCJpbmRleE9mIiwib24iLCJ3cml0ZUNvbnZlcnNhdGlvbnMiLCJldnQiLCJjb252ZXJzYXRpb25zIiwiX3VwZGF0ZUNvbnZlcnNhdGlvbiIsInRhcmdldCIsImNoYW5nZXMiLCJkZWxldGVPYmplY3RzIiwid3JpdGVDaGFubmVscyIsImNoYW5uZWxzIiwiX3VwZGF0ZUNoYW5uZWwiLCJ3cml0ZU1lc3NhZ2VzIiwibWVzc2FnZXMiLCJ3cml0ZUlkZW50aXRpZXMiLCJpZGVudGl0aWVzIiwic3luY1F1ZXVlIiwiZm9yRWFjaCIsInRhYmxlRGVmIiwiQm9vbGVhbiIsIl9vcGVuIiwiYXBwSWQiLCJyZXRyeSIsImRiIiwiY2xvc2UiLCJlbmFibGVkVGFibGVzIiwiZmlsdGVyIiwibGVuZ3RoIiwiX2lzT3BlbkVycm9yIiwidHJpZ2dlciIsImVycm9yIiwicmVxdWVzdCIsIm9wZW4iLCJfZ2V0RGJOYW1lIiwib25lcnJvciIsImRlbGV0ZVRhYmxlcyIsIndhcm4iLCJvbnVwZ3JhZGVuZWVkZWQiLCJfb25VcGdyYWRlTmVlZGVkIiwib25zdWNjZXNzIiwicmVzdWx0IiwiaXNPcGVuIiwib252ZXJzaW9uY2hhbmdlIiwiZXJyIiwiY2FsbGJhY2siLCJvbmNlIiwiZXZlbnQiLCJpc0NvbXBsZXRlIiwib25Db21wbGV0ZSIsImN1cnJlbnRUYWJsZXMiLCJBcnJheSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsIm9iamVjdFN0b3JlTmFtZXMiLCJkZWxldGVPYmplY3RTdG9yZSIsInN0b3JlIiwiY3JlYXRlT2JqZWN0U3RvcmUiLCJrZXlQYXRoIiwiT2JqZWN0Iiwia2V5cyIsImNyZWF0ZUluZGV4IiwiaW5kZXhOYW1lIiwidW5pcXVlIiwidHJhbnNhY3Rpb24iLCJvbmNvbXBsZXRlIiwiY29udmVyc2F0aW9uIiwiX2Zyb21EQiIsImlzTG9hZGluZyIsInN5bmNTdGF0ZSIsIm1hcCIsIml0ZW0iLCJpZCIsInVybCIsInBhcnRpY2lwYW50cyIsIl9nZXRJZGVudGl0eURhdGEiLCJkaXN0aW5jdCIsImNyZWF0ZWRBdCIsIm1ldGFkYXRhIiwidW5yZWFkX21lc3NhZ2VfY291bnQiLCJ1bnJlYWRDb3VudCIsImxhc3RfbWVzc2FnZSIsImxhc3RNZXNzYWdlIiwic2VudEF0Iiwic3luY19zdGF0ZSIsImlkQ2hhbmdlcyIsInByb3BlcnR5Iiwib2xkVmFsdWUiLCJfd3JpdGVPYmplY3RzIiwiX2dldENvbnZlcnNhdGlvbkRhdGEiLCJpc0Rlc3Ryb3llZCIsImNoYW5uZWwiLCJtZW1iZXJzaGlwIiwiX2dldENoYW5uZWxEYXRhIiwid3JpdGVCYXNpY0lkZW50aXR5IiwiaWRlbnRpdHkiLCJpc0Z1bGxJZGVudGl0eSIsInVzZXJfaWQiLCJ1c2VySWQiLCJmaXJzdF9uYW1lIiwiZmlyc3ROYW1lIiwibGFzdF9uYW1lIiwibGFzdE5hbWUiLCJkaXNwbGF5X25hbWUiLCJkaXNwbGF5TmFtZSIsImF2YXRhcl91cmwiLCJhdmF0YXJVcmwiLCJwdWJsaWNfa2V5IiwicHVibGljS2V5IiwicGhvbmVfbnVtYmVyIiwicGhvbmVOdW1iZXIiLCJlbWFpbF9hZGRyZXNzIiwiZW1haWxBZGRyZXNzIiwidHlwZSIsImRiTWVzc2FnZXMiLCJtZXNzYWdlIiwiTE9BRElORyIsInBhcnRzIiwicGFydCIsImJvZHkiLCJpc0Jsb2IiLCJzaXplIiwiTWF4UGFydFNpemUiLCJlbmNvZGluZyIsIm1pbWVfdHlwZSIsIm1pbWVUeXBlIiwiY29udGVudCIsIl9jb250ZW50IiwiZG93bmxvYWRfdXJsIiwiZG93bmxvYWRVcmwiLCJleHBpcmF0aW9uIiwicmVmcmVzaF91cmwiLCJyZWZyZXNoVXJsIiwicG9zaXRpb24iLCJzZW5kZXIiLCJyZWNpcGllbnRfc3RhdHVzIiwicmVjaXBpZW50U3RhdHVzIiwic2VudF9hdCIsInJlY2VpdmVkX2F0IiwicmVjZWl2ZWRBdCIsImlzX3VucmVhZCIsImlzVW5yZWFkIiwiY291bnQiLCJwdXNoIiwiYmxvYlRvQmFzZTY0IiwiYmFzZTY0IiwidXNlQmxvYiIsIl9nZXRNZXNzYWdlRGF0YSIsImRiTWVzc2FnZURhdGEiLCJzeW5jRXZlbnRzIiwic3luY0V2dCIsImZyb21EQiIsInN5bmNFdmVudCIsImRlcGVuZHMiLCJpc1dlYnNvY2tldCIsIldlYnNvY2tldFN5bmNFdmVudCIsIm9wZXJhdGlvbiIsImRhdGEiLCJoZWFkZXJzIiwibWV0aG9kIiwiX2dldFN5bmNFdmVudERhdGEiLCJ0YWJsZU5hbWUiLCJvbk9wZW4iLCJnZXRPYmplY3RzIiwiZm91bmRJdGVtcyIsInVwZGF0ZUlkcyIsIm9iamVjdFN0b3JlIiwicHV0IiwiYWRkIiwic29ydEJ5IiwiZnJvbUlkIiwicGFnZVNpemUiLCJzb3J0SW5kZXgiLCJyYW5nZSIsImZyb21Db252ZXJzYXRpb24iLCJnZXRDb252ZXJzYXRpb24iLCJ1cHBlckJvdW5kIiwiX2xvYWRCeUluZGV4IiwibWVzc2FnZXNUb0xvYWQiLCJtZXNzYWdlSWQiLCJnZXRNZXNzYWdlIiwiX2xvYWRDb252ZXJzYXRpb25zUmVzdWx0IiwiX2NyZWF0ZU1lc3NhZ2UiLCJuZXdEYXRhIiwiX2NyZWF0ZUNvbnZlcnNhdGlvbiIsImZyb21DaGFubmVsIiwiZ2V0Q2hhbm5lbCIsIl9sb2FkQ2hhbm5lbHNSZXN1bHQiLCJfY3JlYXRlQ2hhbm5lbCIsImZyb21NZXNzYWdlIiwicXVlcnkiLCJfbG9hZE1lc3NhZ2VzUmVzdWx0IiwiYmFzZTY0VG9CbG9iIiwiX2Jsb2JpZnlQYXJ0IiwiX2xvYWRBbGwiLCJfbG9hZElkZW50aXRpZXNSZXN1bHQiLCJfY3JlYXRlSWRlbnRpdHkiLCJnZXRJZGVudGl0eSIsIm5ld0NvbnZlcnNhdGlvbiIsIl9jcmVhdGVPYmplY3QiLCJuZXdDaGFubmVsIiwibmV3TWVzc2FnZSIsIm5ld2lkZW50aXR5IiwiX2xvYWRTeW5jRXZlbnRSZWxhdGVkRGF0YSIsIm1lc3NhZ2VJZHMiLCJtYXRjaCIsImNvbnZlcnNhdGlvbklkcyIsImlkZW50aXR5SWRzIiwiY291bnRlciIsIm1heENvdW50ZXIiLCJfbG9hZFN5bmNFdmVudFJlc3VsdHMiLCJoYXNUYXJnZXQiLCJnZXRPYmplY3QiLCJYSFJTeW5jRXZlbnQiLCJvcGVuQ3Vyc29yIiwiY3Vyc29yIiwidmFsdWUiLCJjb250aW51ZSIsImlzRnJvbUlkIiwic2hvdWxkU2tpcE5leHQiLCJpbmRleCIsImRlbGV0ZSIsImlkcyIsInNvcnRlZElkcyIsInNvcnQiLCJpIiwic3BsaWNlIiwia2V5Iiwib25seSIsIl9wZXJtaXNzaW9uX3N5bmNRdWV1ZSIsImdldCIsImRlbGV0ZURhdGFiYXNlIiwiX3Blcm1pc3Npb25fbWVzc2FnZXMiLCJfcGVybWlzc2lvbl9jb252ZXJzYXRpb25zIiwiX3Blcm1pc3Npb25fY2hhbm5lbHMiLCJfcGVybWlzc2lvbl9pZGVudGl0aWVzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7O0FBY0EsSUFBTUEsT0FBT0MsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNQyxTQUFTRCxRQUFRLFVBQVIsQ0FBZjtBQUNBLElBQU1FLFlBQVlGLFFB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QUF5QixJQUF6Qjs7QUFFQTs7Ozs7Ozs7OztBQVVBbkMsVUFBVXNJLFdBQVYsR0FBd0IsTUFBeEI7O0FBRUF0SSxVQUFVVyxnQkFBVixHQUE2QixDQUMzQixNQUQyQixFQUNuQixPQURtQixFQUUzQjZPLE1BRjJCLENBRXBCN1EsS0FBS2dDLGdCQUZlLENBQTdCOztBQUlBaEMsS0FBSzhRLFNBQUwsQ0FBZUMsS0FBZixDQUFxQjFQLFNBQXJCLEVBQWdDLENBQUNBLFNBQUQsRUFBWSxXQUFaLENBQWhDO0FBQ0EyUCxPQUFPQyxPQUFQLEdBQWlCNVAsU0FBakIiLCJmaWxlIjoiZGItbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGVyc2lzdGVuY2UgbWFuYWdlci5cbiAqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXMgYWxsIGluZGV4ZWREQiBhY2Nlc3MuICBJdCBpcyBub3QgcmVzcG9uc2libGUgZm9yIGFueSBsb2NhbFN0b3JhZ2UgYWNjZXNzLCB0aG91Z2ggaXQgbWF5XG4gKiByZWNlaXZlIGNvbmZpZ3VyYXRpb25zIHJlbGF0ZWQgdG8gZGF0YSBzdG9yZWQgaW4gbG9jYWxTdG9yYWdlLiAgSXQgd2lsbCBzaW1wbHkgaWdub3JlIHRob3NlIGNvbmZpZ3VyYXRpb25zLlxuICpcbiAqIFJpY2ggQ29udGVudCB3aWxsIGJlIHdyaXR0ZW4gdG8gSW5kZXhlZERCIGFzIGxvbmcgYXMgaXRzIHNtYWxsOyBzZWUgbGF5ZXIuRGJNYW5hZ2VyLk1heFBhcnRTaXplIGZvciBtb3JlIGluZm8uXG4gKlxuICogVE9ETzpcbiAqIDAuIFJlZGVzaWduIHRoaXMgc28gdGhhdCBrbm93bGVkZ2Ugb2YgdGhlIGRhdGEgaXMgbm90IGhhcmQtY29kZWQgaW5cbiAqIEBjbGFzcyBsYXllci5EYk1hbmFnZXJcbiAqIEBwcm90ZWN0ZWRcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY29uc3QgU3luY0V2ZW50ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IEFubm91bmNlbWVudCA9IHJlcXVpcmUoJy4vbW9kZWxzL2Fubm91bmNlbWVudCcpO1xuXG5jb25zdCBEQl9WRVJTSU9OID0gNTtcbmNvbnN0IE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuY29uc3QgU1lOQ19ORVcgPSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVc7XG5cbmZ1bmN0aW9uIGdldERhdGUoaW5EYXRlKSB7XG4gIHJldHVybiBpbkRhdGUgPyBpbkRhdGUudG9JU09TdHJpbmcoKSA6IG51bGw7XG59XG5cbmNvbnN0IFRBQkxFUyA9IFtcbiAge1xuICAgIG5hbWU6ICdjb252ZXJzYXRpb25zJyxcbiAgICBpbmRleGVzOiB7XG4gICAgICBjcmVhdGVkX2F0OiBbJ2NyZWF0ZWRfYXQnXSxcbiAgICAgIGxhc3RfbWVzc2FnZV9zZW50OiBbJ2xhc3RfbWVzc2FnZV9zZW50J10sXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdjaGFubmVscycsXG4gICAgaW5kZXhlczoge1xuICAgICAgY3JlYXRlZF9hdDogWydjcmVhdGVkX2F0J10sXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdtZXNzYWdlcycsXG4gICAgaW5kZXhlczoge1xuICAgICAgY29udmVyc2F0aW9uSWQ6IFsnY29udmVyc2F0aW9uSWQnLCAncG9zaXRpb24nXSxcbiAgICB9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ2lkZW50aXRpZXMnLFxuICAgIGluZGV4ZXM6IHt9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ3N5bmNRdWV1ZScsXG4gICAgaW5kZXhlczoge30sXG4gIH0sXG5dO1xuXG5jbGFzcyBEYk1hbmFnZXIgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ3JlYXRlIHRoZSBEQiBNYW5hZ2VyXG4gICAqXG4gICAqIEtleSBjb25maWd1cmF0aW9uIGlzIHRoZSBsYXllci5EYk1hbmFnZXIucGVyc2lzdGVuY2VGZWF0dXJlcyBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gb3B0aW9ucy5jbGllbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucGVyc2lzdGVuY2VGZWF0dXJlc1xuICAgKiBAcmV0dXJuIHtsYXllci5EYk1hbmFnZXJ9IHRoaXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIElmIG5vIGluZGV4ZWREQiwgdHJlYXQgZXZlcnl0aGluZyBhcyBkaXNhYmxlZC5cbiAgICBpZiAoIXdpbmRvdy5pbmRleGVkREIgfHwgIW9wdGlvbnMuZW5hYmxlZCkge1xuICAgICAgb3B0aW9ucy50YWJsZXMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGVzdCBpZiBBcnJheXMgYXMga2V5cyBzdXBwb3J0ZWQsIGRpc2FibGUgcGVyc2lzdGVuY2UgaWYgbm90XG4gICAgICBsZXQgZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cuSURCS2V5UmFuZ2UuYm91bmQoWydhbm5vdW5jZW1lbnQnLCAwXSwgWydhbm5vdW5jZW1lbnQnLCBNQVhfU0FGRV9JTlRFR0VSXSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVzID0ge307XG4gICAgICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgQ2xpZW50IGlzIGEgbGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvciwgaXQgd29uJ3Qgc3VwcG9ydCB0aGVzZSBldmVudHM7IHRoaXMgYWZmZWN0cyBVbml0IFRlc3RzXG4gICAgICBpZiAoZW5hYmxlZCAmJiB0aGlzLmNsaWVudC5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLmluZGV4T2YoJ2NvbnZlcnNhdGlvbnM6YWRkJykgIT09IC0xKSB7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmFkZCcsIGV2dCA9PiB0aGlzLndyaXRlQ29udmVyc2F0aW9ucyhldnQuY29udmVyc2F0aW9ucyksIHRoaXMpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbignY29udmVyc2F0aW9uczpjaGFuZ2UnLCBldnQgPT4gdGhpcy5fdXBkYXRlQ29udmVyc2F0aW9uKGV2dC50YXJnZXQsIGV2dC5jaGFuZ2VzKSwgdGhpcyk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmRlbGV0ZSBjb252ZXJzYXRpb25zOnNlbnQtZXJyb3InLFxuICAgICAgICAgIGV2dCA9PiB0aGlzLmRlbGV0ZU9iamVjdHMoJ2NvbnZlcnNhdGlvbnMnLCBbZXZ0LnRhcmdldF0pLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignY2hhbm5lbHM6YWRkJywgZXZ0ID0+IHRoaXMud3JpdGVDaGFubmVscyhldnQuY2hhbm5lbHMpLCB0aGlzKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2NoYW5uZWxzOmNoYW5nZScsIGV2dCA9PiB0aGlzLl91cGRhdGVDaGFubmVsKGV2dC50YXJnZXQsIGV2dC5jaGFuZ2VzKSwgdGhpcyk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdjaGFubmVsczpkZWxldGUgY2hhbm5lbHM6c2VudC1lcnJvcicsXG4gICAgICAgICAgZXZ0ID0+IHRoaXMuZGVsZXRlT2JqZWN0cygnY2hhbm5lbHMnLCBbZXZ0LnRhcmdldF0pLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZXM6YWRkJywgZXZ0ID0+IHRoaXMud3JpdGVNZXNzYWdlcyhldnQubWVzc2FnZXMpLCB0aGlzKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2VzOmNoYW5nZScsIGV2dCA9PiB0aGlzLndyaXRlTWVzc2FnZXMoW2V2dC50YXJnZXRdKSwgdGhpcyk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlczpkZWxldGUgbWVzc2FnZXM6c2VudC1lcnJvcicsXG4gICAgICAgICAgZXZ0ID0+IHRoaXMuZGVsZXRlT2JqZWN0cygnbWVzc2FnZXMnLCBbZXZ0LnRhcmdldF0pLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignaWRlbnRpdGllczphZGQnLCBldnQgPT4gdGhpcy53cml0ZUlkZW50aXRpZXMoZXZ0LmlkZW50aXRpZXMpLCB0aGlzKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2lkZW50aXRpZXM6Y2hhbmdlJywgZXZ0ID0+IHRoaXMud3JpdGVJZGVudGl0aWVzKFtldnQudGFyZ2V0XSksIHRoaXMpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbignaWRlbnRpdGllczp1bmZvbGxvdycsIGV2dCA9PiB0aGlzLmRlbGV0ZU9iamVjdHMoJ2lkZW50aXRpZXMnLCBbZXZ0LnRhcmdldF0pLCB0aGlzKTtcbiAgICAgIH1cblxuICAgICAgLy8gU3luYyBRdWV1ZSBvbmx5IHJlYWxseSB3b3JrcyBwcm9wZXJseSBpZiB3ZSBoYXZlIHRoZSBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucyB3cml0dGVuIHRvIHRoZSBEQjsgdHVybiBpdCBvZmZcbiAgICAgIC8vIGlmIHRoYXQgd29uJ3QgYmUgdGhlIGNhc2UuXG4gICAgICBpZiAoKCFvcHRpb25zLnRhYmxlcy5jb252ZXJzYXRpb25zICYmICFvcHRpb25zLnRhYmxlcy5jaGFubmVscykgfHwgIW9wdGlvbnMudGFibGVzLm1lc3NhZ2VzKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVzLnN5bmNRdWV1ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIFRBQkxFUy5mb3JFYWNoKCh0YWJsZURlZikgPT4ge1xuICAgICAgdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlRGVmLm5hbWVdID0gQm9vbGVhbihvcHRpb25zLnRhYmxlc1t0YWJsZURlZi5uYW1lXSk7XG4gICAgfSk7XG4gICAgdGhpcy5fb3BlbihmYWxzZSk7XG4gIH1cblxuICBfZ2V0RGJOYW1lKCkge1xuICAgIHJldHVybiAnTGF5ZXJXZWJTREtfJyArIHRoaXMuY2xpZW50LmFwcElkO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wZW4gdGhlIERhdGFiYXNlIENvbm5lY3Rpb24uXG4gICAqXG4gICAqIFRoaXMgaXMgb25seSBjYWxsZWQgYnkgdGhlIGNvbnN0cnVjdG9yLlxuICAgKiBAbWV0aG9kIF9vcGVuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gcmV0cnlcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9vcGVuKHJldHJ5KSB7XG4gICAgaWYgKHRoaXMuZGIpIHtcbiAgICAgIHRoaXMuZGIuY2xvc2UoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmRiO1xuICAgIH1cblxuICAgIC8vIEFib3J0IGlmIGFsbCB0YWJsZXMgYXJlIGRpc2FibGVkXG4gICAgY29uc3QgZW5hYmxlZFRhYmxlcyA9IFRBQkxFUy5maWx0ZXIodGFibGVEZWYgPT4gdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlRGVmLm5hbWVdKTtcbiAgICBpZiAoZW5hYmxlZFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuX2lzT3BlbkVycm9yID0gdHJ1ZTtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiAnUGVyc2lzdGVuY2UgaXMgZGlzYWJsZWQgYnkgYXBwbGljYXRpb24nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9wZW4gdGhlIGRhdGFiYXNlXG4gICAgY29uc3QgcmVxdWVzdCA9IHdpbmRvdy5pbmRleGVkREIub3Blbih0aGlzLl9nZXREYk5hbWUoKSwgREJfVkVSU0lPTik7XG5cbiAgICB0cnkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldnQpID0+IHtcbiAgICAgICAgaWYgKCFyZXRyeSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlVGFibGVzKCgpID0+IHRoaXMuX29wZW4odHJ1ZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJpZ2dlcmVkIGJ5IEZpcmVmb3ggcHJpdmF0ZSBicm93c2luZyB3aW5kb3dcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5faXNPcGVuRXJyb3IgPSB0cnVlO1xuICAgICAgICAgIGxvZ2dlci53YXJuKCdEYXRhYmFzZSBVbmFibGUgdG8gT3BlbiAoY29tbW9uIGNhdXNlOiBwcml2YXRlIGJyb3dzaW5nIHdpbmRvdyknLCBldnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogZXZ0IH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9udXBncmFkZW5lZWRlZCA9IGV2dCA9PiB0aGlzLl9vblVwZ3JhZGVOZWVkZWQoZXZ0KTtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICB0aGlzLmRiID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgIHRoaXMuaXNPcGVuID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdvcGVuJyk7XG5cbiAgICAgICAgdGhpcy5kYi5vbnZlcnNpb25jaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5kYi5jbG9zZSgpO1xuICAgICAgICAgIHRoaXMuaXNPcGVuID0gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kYi5vbmVycm9yID0gZXJyID0+IGxvZ2dlci5lcnJvcignZGItbWFuYWdlciBFcnJvcjogJywgZXJyKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBTYWZhcmkgUHJpdmF0ZSBCcm93c2luZyB3aW5kb3cgd2lsbCBmYWlsIG9uIHJlcXVlc3Qub25lcnJvclxuICAgICAgdGhpcy5faXNPcGVuRXJyb3IgPSB0cnVlO1xuICAgICAgbG9nZ2VyLmVycm9yKCdEYXRhYmFzZSBVbmFibGUgdG8gT3BlbjogJywgZXJyKTtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiBlcnIgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVzZSB0aGlzIHRvIHNldHVwIGEgY2FsbCB0byBoYXBwZW4gYXMgc29vbiBhcyB0aGUgZGF0YWJhc2UgaXMgb3Blbi5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB0aGlzIGNhbGwgd2lsbCBpbW1lZGlhdGVseSwgc3luY2hyb25vdXNseSBjYWxsIHlvdXIgY2FsbGJhY2suXG4gICAqIEJ1dCBpZiB0aGUgREIgaXMgbm90IG9wZW4geWV0LCB5b3VyIGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIG9uY2UgaXRzIG9wZW4uXG4gICAqIEBtZXRob2Qgb25PcGVuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBvbk9wZW4oY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5pc09wZW4gfHwgdGhpcy5faXNPcGVuRXJyb3IpIGNhbGxiYWNrKCk7XG4gICAgZWxzZSB0aGlzLm9uY2UoJ29wZW4gZXJyb3InLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9uVXBncmFkZU5lZWRlZCBmdW5jdGlvbiBpcyBjYWxsZWQgYnkgSW5kZXhlZERCIGFueSB0aW1lIERCX1ZFUlNJT04gaXMgaW5jcmVtZW50ZWQuXG4gICAqXG4gICAqIFRoaXMgaW52b2NhdGlvbiBpcyBwYXJ0IG9mIHRoZSBidWlsdC1pbiBsaWZlY3ljbGUgb2YgSW5kZXhlZERCLlxuICAgKlxuICAgKiBAbWV0aG9kIF9vblVwZ3JhZGVOZWVkZWRcbiAgICogQHBhcmFtIHtJREJWZXJzaW9uQ2hhbmdlRXZlbnR9IGV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBfb25VcGdyYWRlTmVlZGVkKGV2ZW50KSB7XG4gICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgIGNvbnN0IGlzQ29tcGxldGUgPSBmYWxzZTtcblxuICAgIC8vIFRoaXMgYXBwZWFycyB0byBvbmx5IGdldCBjYWxsZWQgb25jZTsgaXRzIHByZXN1bWVkIHRoaXMgaXMgYmVjYXVzZSB3ZSdyZSBjcmVhdGluZyBidXQgbm90IHVzaW5nIGEgbG90IG9mIHRyYW5zYWN0aW9ucy5cbiAgICBjb25zdCBvbkNvbXBsZXRlID0gKGV2dCkgPT4ge1xuICAgICAgaWYgKCFpc0NvbXBsZXRlKSB7XG4gICAgICAgIHRoaXMuZGIgPSBkYjtcbiAgICAgICAgdGhpcy5pc0NvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pc09wZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ29wZW4nKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgY3VycmVudFRhYmxlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRiLm9iamVjdFN0b3JlTmFtZXMpO1xuICAgIFRBQkxFUy5mb3JFYWNoKCh0YWJsZURlZikgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKGN1cnJlbnRUYWJsZXMuaW5kZXhPZih0YWJsZURlZi5uYW1lKSAhPT0gLTEpIGRiLmRlbGV0ZU9iamVjdFN0b3JlKHRhYmxlRGVmLm5hbWUpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb29wXG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKHRhYmxlRGVmLm5hbWUsIHsga2V5UGF0aDogJ2lkJyB9KTtcbiAgICAgICAgT2JqZWN0LmtleXModGFibGVEZWYuaW5kZXhlcylcbiAgICAgICAgICAuZm9yRWFjaChpbmRleE5hbWUgPT4gc3RvcmUuY3JlYXRlSW5kZXgoaW5kZXhOYW1lLCB0YWJsZURlZi5pbmRleGVzW2luZGV4TmFtZV0sIHsgdW5pcXVlOiBmYWxzZSB9KSk7XG4gICAgICAgIHN0b3JlLnRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBvbkNvbXBsZXRlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb29wXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGxvZ2dlci5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBvYmplY3Qgc3RvcmUgJHt0YWJsZURlZi5uYW1lfWAsIGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgQ29udmVyc2F0aW9uIGluc3RhbmNlcyBpbnRvIENvbnZlcnNhdGlvbiBEQiBFbnRyaWVzLlxuICAgKlxuICAgKiBBIENvbnZlcnNhdGlvbiBEQiBlbnRyeSBsb29rcyBhIGxvdCBsaWtlIHRoZSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIGJ1dFxuICAgKiBpbmNsdWRlcyBhIHN5bmNfc3RhdGUgcHJvcGVydHksIGFuZCBgbGFzdF9tZXNzYWdlYCBjb250YWlucyBhIG1lc3NhZ2UgSUQgbm90XG4gICAqIGEgTWVzc2FnZSBvYmplY3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENvbnZlcnNhdGlvbkRhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gY29udmVyc2F0aW9uc1xuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gY29udmVyc2F0aW9uc1xuICAgKi9cbiAgX2dldENvbnZlcnNhdGlvbkRhdGEoY29udmVyc2F0aW9ucykge1xuICAgIHJldHVybiBjb252ZXJzYXRpb25zLmZpbHRlcigoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICBpZiAoY29udmVyc2F0aW9uLl9mcm9tREIpIHtcbiAgICAgICAgY29udmVyc2F0aW9uLl9mcm9tREIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb24uaXNMb2FkaW5nIHx8IGNvbnZlcnNhdGlvbi5zeW5jU3RhdGUgPT09IFNZTkNfTkVXKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pLm1hcCgoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0ge1xuICAgICAgICBpZDogY29udmVyc2F0aW9uLmlkLFxuICAgICAgICB1cmw6IGNvbnZlcnNhdGlvbi51cmwsXG4gICAgICAgIHBhcnRpY2lwYW50czogdGhpcy5fZ2V0SWRlbnRpdHlEYXRhKGNvbnZlcnNhdGlvbi5wYXJ0aWNpcGFudHMsIHRydWUpLFxuICAgICAgICBkaXN0aW5jdDogY29udmVyc2F0aW9uLmRpc3RpbmN0LFxuICAgICAgICBjcmVhdGVkX2F0OiBnZXREYXRlKGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpLFxuICAgICAgICBtZXRhZGF0YTogY29udmVyc2F0aW9uLm1ldGFkYXRhLFxuICAgICAgICB1bnJlYWRfbWVzc2FnZV9jb3VudDogY29udmVyc2F0aW9uLnVucmVhZENvdW50LFxuICAgICAgICBsYXN0X21lc3NhZ2U6IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSA/IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5pZCA6ICcnLFxuICAgICAgICBsYXN0X21lc3NhZ2Vfc2VudDogY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID9cbiAgICAgICAgICBnZXREYXRlKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5zZW50QXQpIDogZ2V0RGF0ZShjb252ZXJzYXRpb24uY3JlYXRlZEF0KSxcbiAgICAgICAgc3luY19zdGF0ZTogY29udmVyc2F0aW9uLnN5bmNTdGF0ZSxcbiAgICAgIH07XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcbiAgfVxuXG4gIF91cGRhdGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uLCBjaGFuZ2VzKSB7XG4gICAgY29uc3QgaWRDaGFuZ2VzID0gY2hhbmdlcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnByb3BlcnR5ID09PSAnaWQnKTtcbiAgICBpZiAoaWRDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgdGhpcy5kZWxldGVPYmplY3RzKCdjb252ZXJzYXRpb25zJywgW3sgaWQ6IGlkQ2hhbmdlc1swXS5vbGRWYWx1ZSB9XSwgKCkgPT4ge1xuICAgICAgICB0aGlzLndyaXRlQ29udmVyc2F0aW9ucyhbY29udmVyc2F0aW9uXSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy53cml0ZUNvbnZlcnNhdGlvbnMoW2NvbnZlcnNhdGlvbl0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gYXJyYXkgb2YgQ29udmVyc2F0aW9ucyB0byB0aGUgRGF0YWJhc2UuXG4gICAqXG4gICAqIEBtZXRob2Qgd3JpdGVDb252ZXJzYXRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGNvbnZlcnNhdGlvbnMgLSBBcnJheSBvZiBDb252ZXJzYXRpb25zIHRvIHdyaXRlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICovXG4gIHdyaXRlQ29udmVyc2F0aW9ucyhjb252ZXJzYXRpb25zLCBjYWxsYmFjaykge1xuICAgIHRoaXMuX3dyaXRlT2JqZWN0cygnY29udmVyc2F0aW9ucycsXG4gICAgICB0aGlzLl9nZXRDb252ZXJzYXRpb25EYXRhKGNvbnZlcnNhdGlvbnMuZmlsdGVyKGNvbnZlcnNhdGlvbiA9PiAhY29udmVyc2F0aW9uLmlzRGVzdHJveWVkKSksIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGFycmF5IG9mIENoYW5uZWwgaW5zdGFuY2VzIGludG8gQ2hhbm5lbCBEQiBFbnRyaWVzLlxuICAgKlxuICAgKiBBIENoYW5uZWwgREIgZW50cnkgbG9va3MgYSBsb3QgbGlrZSB0aGUgc2VydmVyIHJlcHJlc2VudGF0aW9uLCBidXRcbiAgICogaW5jbHVkZXMgYSBzeW5jX3N0YXRlIHByb3BlcnR5LCBhbmQgYGxhc3RfbWVzc2FnZWAgY29udGFpbnMgYSBtZXNzYWdlIElEIG5vdFxuICAgKiBhIE1lc3NhZ2Ugb2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDaGFubmVsRGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkNoYW5uZWxbXX0gY2hhbm5lbHNcbiAgICogQHJldHVybiB7T2JqZWN0W119IGNoYW5uZWxzXG4gICAqL1xuICBfZ2V0Q2hhbm5lbERhdGEoY2hhbm5lbHMpIHtcbiAgICByZXR1cm4gY2hhbm5lbHMuZmlsdGVyKChjaGFubmVsKSA9PiB7XG4gICAgICBpZiAoY2hhbm5lbC5fZnJvbURCKSB7XG4gICAgICAgIGNoYW5uZWwuX2Zyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGNoYW5uZWwuaXNMb2FkaW5nIHx8IGNoYW5uZWwuc3luY1N0YXRlID09PSBTWU5DX05FVykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAoKGNoYW5uZWwpID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB7XG4gICAgICAgIGlkOiBjaGFubmVsLmlkLFxuICAgICAgICB1cmw6IGNoYW5uZWwudXJsLFxuICAgICAgICBjcmVhdGVkX2F0OiBnZXREYXRlKGNoYW5uZWwuY3JlYXRlZEF0KSxcbiAgICAgICAgc3luY19zdGF0ZTogY2hhbm5lbC5zeW5jU3RhdGUsXG4gICAgICAgIC8vIFRPRE86IG1lbWJlcnNoaXAgb2JqZWN0IHNob3VsZCBiZSB3cml0dGVuLi4uIGJ1dCBzcGVjIGluY29tcGxldGVcbiAgICAgICAgbWVtYmVyc2hpcDogbnVsbCxcbiAgICAgICAgbmFtZTogY2hhbm5lbC5uYW1lLFxuICAgICAgICBtZXRhZGF0YTogY2hhbm5lbC5tZXRhZGF0YSxcbiAgICAgIH07XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcbiAgfVxuXG4gIF91cGRhdGVDaGFubmVsKGNoYW5uZWwsIGNoYW5nZXMpIHtcbiAgICBjb25zdCBpZENoYW5nZXMgPSBjaGFuZ2VzLmZpbHRlcihpdGVtID0+IGl0ZW0ucHJvcGVydHkgPT09ICdpZCcpO1xuICAgIGlmIChpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmRlbGV0ZU9iamVjdHMoJ2NoYW5uZWxzJywgW3sgaWQ6IGlkQ2hhbmdlc1swXS5vbGRWYWx1ZSB9XSwgKCkgPT4ge1xuICAgICAgICB0aGlzLndyaXRlQ2hhbm5lbHMoW2NoYW5uZWxdKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLndyaXRlQ2hhbm5lbHMoW2NoYW5uZWxdKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGFuIGFycmF5IG9mIENvbnZlcnNhdGlvbnMgdG8gdGhlIERhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIHdyaXRlQ2hhbm5lbHNcbiAgICogQHBhcmFtIHtsYXllci5DaGFubmVsW119IGNoYW5uZWxzIC0gQXJyYXkgb2YgQ2hhbm5lbHMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVDaGFubmVscyhjaGFubmVscywgY2FsbGJhY2spIHtcbiAgICB0aGlzLl93cml0ZU9iamVjdHMoJ2NoYW5uZWxzJyxcbiAgICAgIHRoaXMuX2dldENoYW5uZWxEYXRhKGNoYW5uZWxzLmZpbHRlcihjaGFubmVsID0+ICFjaGFubmVsLmlzRGVzdHJveWVkKSksIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGFycmF5IG9mIElkZW50aXR5IGluc3RhbmNlcyBpbnRvIElkZW50aXR5IERCIEVudHJpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldElkZW50aXR5RGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5W119IGlkZW50aXRpZXNcbiAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUJhc2ljSWRlbnRpdHkgLSBGb3JjZXMgb3V0cHV0IGFzIGEgQmFzaWMgSWRlbnRpdHlcbiAgICogQHJldHVybiB7T2JqZWN0W119IGlkZW50aXRpZXNcbiAgICovXG4gIF9nZXRJZGVudGl0eURhdGEoaWRlbnRpdGllcywgd3JpdGVCYXNpY0lkZW50aXR5KSB7XG4gICAgcmV0dXJuIGlkZW50aXRpZXMuZmlsdGVyKChpZGVudGl0eSkgPT4ge1xuICAgICAgaWYgKGlkZW50aXR5LmlzRGVzdHJveWVkIHx8ICghaWRlbnRpdHkuaXNGdWxsSWRlbnRpdHkgJiYgIXdyaXRlQmFzaWNJZGVudGl0eSkpIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKGlkZW50aXR5Ll9mcm9tREIpIHtcbiAgICAgICAgaWRlbnRpdHkuX2Zyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGlkZW50aXR5LmlzTG9hZGluZykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAoKGlkZW50aXR5KSA9PiB7XG4gICAgICBpZiAoaWRlbnRpdHkuaXNGdWxsSWRlbnRpdHkgJiYgIXdyaXRlQmFzaWNJZGVudGl0eSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlkOiBpZGVudGl0eS5pZCxcbiAgICAgICAgICB1cmw6IGlkZW50aXR5LnVybCxcbiAgICAgICAgICB1c2VyX2lkOiBpZGVudGl0eS51c2VySWQsXG4gICAgICAgICAgZmlyc3RfbmFtZTogaWRlbnRpdHkuZmlyc3ROYW1lLFxuICAgICAgICAgIGxhc3RfbmFtZTogaWRlbnRpdHkubGFzdE5hbWUsXG4gICAgICAgICAgZGlzcGxheV9uYW1lOiBpZGVudGl0eS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICBhdmF0YXJfdXJsOiBpZGVudGl0eS5hdmF0YXJVcmwsXG4gICAgICAgICAgbWV0YWRhdGE6IGlkZW50aXR5Lm1ldGFkYXRhLFxuICAgICAgICAgIHB1YmxpY19rZXk6IGlkZW50aXR5LnB1YmxpY0tleSxcbiAgICAgICAgICBwaG9uZV9udW1iZXI6IGlkZW50aXR5LnBob25lTnVtYmVyLFxuICAgICAgICAgIGVtYWlsX2FkZHJlc3M6IGlkZW50aXR5LmVtYWlsQWRkcmVzcyxcbiAgICAgICAgICBzeW5jX3N0YXRlOiBpZGVudGl0eS5zeW5jU3RhdGUsXG4gICAgICAgICAgdHlwZTogaWRlbnRpdHkudHlwZSxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGlkZW50aXR5LmlkLFxuICAgICAgICAgIHVybDogaWRlbnRpdHkudXJsLFxuICAgICAgICAgIHVzZXJfaWQ6IGlkZW50aXR5LnVzZXJJZCxcbiAgICAgICAgICBkaXNwbGF5X25hbWU6IGlkZW50aXR5LmRpc3BsYXlOYW1lLFxuICAgICAgICAgIGF2YXRhcl91cmw6IGlkZW50aXR5LmF2YXRhclVybCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gYXJyYXkgb2YgSWRlbnRpdGllcyB0byB0aGUgRGF0YWJhc2UuXG4gICAqXG4gICAqIEBtZXRob2Qgd3JpdGVJZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gaWRlbnRpdGllcyAtIEFycmF5IG9mIElkZW50aXRpZXMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVJZGVudGl0aWVzKGlkZW50aXRpZXMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd3JpdGVPYmplY3RzKCdpZGVudGl0aWVzJyxcbiAgICAgIHRoaXMuX2dldElkZW50aXR5RGF0YShpZGVudGl0aWVzKSwgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgTWVzc2FnZSBpbnN0YW5jZXMgaW50byBNZXNzYWdlIERCIEVudHJpZXMuXG4gICAqXG4gICAqIEEgTWVzc2FnZSBEQiBlbnRyeSBsb29rcyBhIGxvdCBsaWtlIHRoZSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIGJ1dFxuICAgKiBpbmNsdWRlcyBhIHN5bmNfc3RhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldE1lc3NhZ2VEYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVtdfSBtZXNzYWdlc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gbWVzc2FnZXNcbiAgICovXG4gIF9nZXRNZXNzYWdlRGF0YShtZXNzYWdlcywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkYk1lc3NhZ2VzID0gbWVzc2FnZXMuZmlsdGVyKChtZXNzYWdlKSA9PiB7XG4gICAgICBpZiAobWVzc2FnZS5fZnJvbURCKSB7XG4gICAgICAgIG1lc3NhZ2UuX2Zyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKG1lc3NhZ2Uuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5MT0FESU5HKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pLm1hcChtZXNzYWdlID0+ICh7XG4gICAgICBpZDogbWVzc2FnZS5pZCxcbiAgICAgIHVybDogbWVzc2FnZS51cmwsXG4gICAgICBwYXJ0czogbWVzc2FnZS5wYXJ0cy5tYXAoKHBhcnQpID0+IHtcbiAgICAgICAgY29uc3QgYm9keSA9IFV0aWwuaXNCbG9iKHBhcnQuYm9keSkgJiYgcGFydC5ib2R5LnNpemUgPiBEYk1hbmFnZXIuTWF4UGFydFNpemUgPyBudWxsIDogcGFydC5ib2R5O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJvZHksXG4gICAgICAgICAgaWQ6IHBhcnQuaWQsXG4gICAgICAgICAgZW5jb2Rpbmc6IHBhcnQuZW5jb2RpbmcsXG4gICAgICAgICAgbWltZV90eXBlOiBwYXJ0Lm1pbWVUeXBlLFxuICAgICAgICAgIGNvbnRlbnQ6ICFwYXJ0Ll9jb250ZW50ID8gbnVsbCA6IHtcbiAgICAgICAgICAgIGlkOiBwYXJ0Ll9jb250ZW50LmlkLFxuICAgICAgICAgICAgZG93bmxvYWRfdXJsOiBwYXJ0Ll9jb250ZW50LmRvd25sb2FkVXJsLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogcGFydC5fY29udGVudC5leHBpcmF0aW9uLFxuICAgICAgICAgICAgcmVmcmVzaF91cmw6IHBhcnQuX2NvbnRlbnQucmVmcmVzaFVybCxcbiAgICAgICAgICAgIHNpemU6IHBhcnQuX2NvbnRlbnQuc2l6ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSksXG4gICAgICBwb3NpdGlvbjogbWVzc2FnZS5wb3NpdGlvbixcbiAgICAgIHNlbmRlcjogdGhpcy5fZ2V0SWRlbnRpdHlEYXRhKFttZXNzYWdlLnNlbmRlcl0sIHRydWUpWzBdLFxuICAgICAgcmVjaXBpZW50X3N0YXR1czogbWVzc2FnZS5yZWNpcGllbnRTdGF0dXMsXG4gICAgICBzZW50X2F0OiBnZXREYXRlKG1lc3NhZ2Uuc2VudEF0KSxcbiAgICAgIHJlY2VpdmVkX2F0OiBnZXREYXRlKG1lc3NhZ2UucmVjZWl2ZWRBdCksXG4gICAgICBjb252ZXJzYXRpb25JZDogbWVzc2FnZSBpbnN0YW5jZW9mIEFubm91bmNlbWVudCA/ICdhbm5vdW5jZW1lbnQnIDogbWVzc2FnZS5jb252ZXJzYXRpb25JZCxcbiAgICAgIHN5bmNfc3RhdGU6IG1lc3NhZ2Uuc3luY1N0YXRlLFxuICAgICAgaXNfdW5yZWFkOiBtZXNzYWdlLmlzVW5yZWFkLFxuICAgIH0pKTtcblxuICAgIC8vIEZpbmQgYWxsIGJsb2JzIGFuZCBjb252ZXJ0IHRoZW0gdG8gYmFzZTY0Li4uIGJlY2F1c2UgU2FmYXJpIDkuMSBkb2Vzbid0IHN1cHBvcnQgd3JpdGluZyBibG9icyB0aG9zZSBGcmVsbGluZyBTbXVyZnMuXG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBjb25zdCBwYXJ0cyA9IFtdO1xuICAgIGRiTWVzc2FnZXMuZm9yRWFjaCgobWVzc2FnZSkgPT4ge1xuICAgICAgbWVzc2FnZS5wYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICAgIGlmIChVdGlsLmlzQmxvYihwYXJ0LmJvZHkpKSBwYXJ0cy5wdXNoKHBhcnQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY2FsbGJhY2soZGJNZXNzYWdlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcbiAgICAgICAgVXRpbC5ibG9iVG9CYXNlNjQocGFydC5ib2R5LCAoYmFzZTY0KSA9PiB7XG4gICAgICAgICAgcGFydC5ib2R5ID0gYmFzZTY0O1xuICAgICAgICAgIHBhcnQudXNlQmxvYiA9IHRydWU7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgICBpZiAoY291bnQgPT09IHBhcnRzLmxlbmd0aCkgY2FsbGJhY2soZGJNZXNzYWdlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhbiBhcnJheSBvZiBNZXNzYWdlcyB0byB0aGUgRGF0YWJhc2UuXG4gICAqXG4gICAqIEBtZXRob2Qgd3JpdGVNZXNzYWdlc1xuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VbXX0gbWVzc2FnZXMgLSBBcnJheSBvZiBNZXNzYWdlcyB0byB3cml0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICB3cml0ZU1lc3NhZ2VzKG1lc3NhZ2VzLCBjYWxsYmFjaykge1xuICAgIHRoaXMuX2dldE1lc3NhZ2VEYXRhKFxuICAgICAgbWVzc2FnZXMuZmlsdGVyKG1lc3NhZ2UgPT4gIW1lc3NhZ2UuaXNEZXN0cm95ZWQpLFxuICAgICAgZGJNZXNzYWdlRGF0YSA9PiB0aGlzLl93cml0ZU9iamVjdHMoJ21lc3NhZ2VzJywgZGJNZXNzYWdlRGF0YSwgY2FsbGJhY2spXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGFycmF5IG9mIFN5bmNFdmVudCBpbnN0YW5jZXMgaW50byBTeW5jRXZlbnQgREIgRW50cmllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0U3luY0V2ZW50RGF0YVxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBzeW5jRXZlbnRzXG4gICAqIEByZXR1cm4ge09iamVjdFtdfSBzeW5jRXZlbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0U3luY0V2ZW50RGF0YShzeW5jRXZlbnRzKSB7XG4gICAgcmV0dXJuIHN5bmNFdmVudHMuZmlsdGVyKChzeW5jRXZ0KSA9PiB7XG4gICAgICBpZiAoc3luY0V2dC5mcm9tREIpIHtcbiAgICAgICAgc3luY0V2dC5mcm9tREIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSkubWFwKChzeW5jRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB7XG4gICAgICAgIGlkOiBzeW5jRXZlbnQuaWQsXG4gICAgICAgIHRhcmdldDogc3luY0V2ZW50LnRhcmdldCxcbiAgICAgICAgZGVwZW5kczogc3luY0V2ZW50LmRlcGVuZHMsXG4gICAgICAgIGlzV2Vic29ja2V0OiBzeW5jRXZlbnQgaW5zdGFuY2VvZiBTeW5jRXZlbnQuV2Vic29ja2V0U3luY0V2ZW50LFxuICAgICAgICBvcGVyYXRpb246IHN5bmNFdmVudC5vcGVyYXRpb24sXG4gICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICB1cmw6IHN5bmNFdmVudC51cmwgfHwgJycsXG4gICAgICAgIGhlYWRlcnM6IHN5bmNFdmVudC5oZWFkZXJzIHx8IG51bGwsXG4gICAgICAgIG1ldGhvZDogc3luY0V2ZW50Lm1ldGhvZCB8fCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0OiBzeW5jRXZlbnQuY3JlYXRlZEF0LFxuICAgICAgfTtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhbiBhcnJheSBvZiBTeW5jRXZlbnQgdG8gdGhlIERhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIHdyaXRlU3luY0V2ZW50c1xuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBzeW5jRXZlbnRzIC0gQXJyYXkgb2YgU3luYyBFdmVudHMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVTeW5jRXZlbnRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd3JpdGVPYmplY3RzKCdzeW5jUXVldWUnLCB0aGlzLl9nZXRTeW5jRXZlbnREYXRhKHN5bmNFdmVudHMpLCBjYWxsYmFjayk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBXcml0ZSBhbiBhcnJheSBvZiBkYXRhIHRvIHRoZSBzcGVjaWZpZWQgRGF0YWJhc2UgdGFibGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3dyaXRlT2JqZWN0c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gdGFibGVOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHRhYmxlIHRvIHdyaXRlIHRvXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGRhdGEgLSBBcnJheSBvZiBQT0pPIGRhdGEgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAtIENhbGxlZCB3aGVuIGFsbCBkYXRhIGlzIHdyaXR0ZW5cbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgX3dyaXRlT2JqZWN0cyh0YWJsZU5hbWUsIGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl8nICsgdGFibGVOYW1lXSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrID8gY2FsbGJhY2soKSA6IG51bGw7XG5cbiAgICAvLyBKdXN0IHF1aXQgaWYgbm8gZGF0YSB0byB3cml0ZVxuICAgIGlmICghZGF0YS5sZW5ndGgpIHtcbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBQVVQgKHVkcGF0ZSkgb3IgQUREIChpbnNlcnQpIGVhY2ggaXRlbSBvZiBkYXRhIG9uZSBhdCBhIHRpbWUsIGJ1dCBhbGwgYXMgcGFydCBvZiBvbmUgbGFyZ2UgdHJhbnNhY3Rpb24uXG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgdGhpcy5nZXRPYmplY3RzKHRhYmxlTmFtZSwgZGF0YS5tYXAoaXRlbSA9PiBpdGVtLmlkKSwgKGZvdW5kSXRlbXMpID0+IHtcbiAgICAgICAgY29uc3QgdXBkYXRlSWRzID0ge307XG4gICAgICAgIGZvdW5kSXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4geyB1cGRhdGVJZHNbaXRlbS5pZF0gPSBpdGVtOyB9KTtcblxuICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkd3JpdGUnKTtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZSh0YWJsZU5hbWUpO1xuICAgICAgICB0cmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gdHJhbnNhY3Rpb24ub25lcnJvciA9IGNhbGxiYWNrO1xuXG4gICAgICAgIGRhdGEuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodXBkYXRlSWRzW2l0ZW0uaWRdKSB7XG4gICAgICAgICAgICAgIHN0b3JlLnB1dChpdGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0b3JlLmFkZChpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgICAgLy8gU2FmYXJpIHRocm93cyBhbiBlcnJvciByYXRoZXIgdGhhbiB1c2UgdGhlIG9uZXJyb3IgZXZlbnQuXG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYWxsIGNvbnZlcnNhdGlvbnMgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAqXG4gICAqIEBtZXRob2QgbG9hZENvbnZlcnNhdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNvcnRCeSAgICAgICAtIE9uZSBvZiAnbGFzdF9tZXNzYWdlJyBvciAnY3JlYXRlZF9hdCc7IGFsd2F5cyBzb3J0cyBpbiBERVNDIG9yZGVyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgY29udmVyc2F0aW9uSWQgdG8gZ2V0IENvbnZlcnNhdGlvbnMgYWZ0ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtwYWdlU2l6ZT1dICAtIFRvIGxpbWl0IHRoZSBudW1iZXIgb2YgcmVzdWx0cywgcHJvdmlkZSBhIG51bWJlciBmb3IgaG93IG1hbnkgcmVzdWx0cyB0byByZXR1cm4uXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gIC0gQ2FsbGJhY2sgZm9yIGdldHRpbmcgcmVzdWx0c1xuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbltdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIGxvYWRDb252ZXJzYXRpb25zKHNvcnRCeSwgZnJvbUlkLCBwYWdlU2l6ZSwgY2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHNvcnRJbmRleCxcbiAgICAgICAgcmFuZ2UgPSBudWxsO1xuICAgICAgY29uc3QgZnJvbUNvbnZlcnNhdGlvbiA9IGZyb21JZCA/IHRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihmcm9tSWQpIDogbnVsbDtcbiAgICAgIGlmIChzb3J0QnkgPT09ICdsYXN0X21lc3NhZ2UnKSB7XG4gICAgICAgIHNvcnRJbmRleCA9ICdsYXN0X21lc3NhZ2Vfc2VudCc7XG4gICAgICAgIGlmIChmcm9tQ29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgcmFuZ2UgPSB3aW5kb3cuSURCS2V5UmFuZ2UudXBwZXJCb3VuZChbZnJvbUNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSA/XG4gICAgICAgICAgICBnZXREYXRlKGZyb21Db252ZXJzYXRpb24ubGFzdE1lc3NhZ2Uuc2VudEF0KSA6IGdldERhdGUoZnJvbUNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNvcnRJbmRleCA9ICdjcmVhdGVkX2F0JztcbiAgICAgICAgaWYgKGZyb21Db252ZXJzYXRpb24pIHtcbiAgICAgICAgICByYW5nZSA9IHdpbmRvdy5JREJLZXlSYW5nZS51cHBlckJvdW5kKFtnZXREYXRlKGZyb21Db252ZXJzYXRpb24uY3JlYXRlZEF0KV0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFN0ZXAgMTogR2V0IGFsbCBDb252ZXJzYXRpb25zXG4gICAgICB0aGlzLl9sb2FkQnlJbmRleCgnY29udmVyc2F0aW9ucycsIHNvcnRJbmRleCwgcmFuZ2UsIEJvb2xlYW4oZnJvbUlkKSwgcGFnZVNpemUsIChkYXRhKSA9PiB7XG4gICAgICAgIC8vIFN0ZXAgMjogR2F0aGVyIGFsbCBNZXNzYWdlIElEcyBuZWVkZWQgdG8gaW5pdGlhbGl6ZSB0aGVzZSBDb252ZXJzYXRpb24ncyBsYXN0TWVzc2FnZSBwcm9wZXJ0aWVzLlxuICAgICAgICBjb25zdCBtZXNzYWdlc1RvTG9hZCA9IGRhdGFcbiAgICAgICAgICAubWFwKGl0ZW0gPT4gaXRlbS5sYXN0X21lc3NhZ2UpXG4gICAgICAgICAgLmZpbHRlcihtZXNzYWdlSWQgPT4gbWVzc2FnZUlkICYmICF0aGlzLmNsaWVudC5nZXRNZXNzYWdlKG1lc3NhZ2VJZCkpO1xuXG4gICAgICAgIC8vIFN0ZXAgMzogTG9hZCBhbGwgTWVzc2FnZXMgbmVlZGVkIHRvIGluaXRpYWxpemUgdGhlc2UgQ29udmVyc2F0aW9uJ3MgbGFzdE1lc3NhZ2UgcHJvcGVydGllcy5cbiAgICAgICAgdGhpcy5nZXRPYmplY3RzKCdtZXNzYWdlcycsIG1lc3NhZ2VzVG9Mb2FkLCAobWVzc2FnZXMpID0+IHtcbiAgICAgICAgICB0aGlzLl9sb2FkQ29udmVyc2F0aW9uc1Jlc3VsdChkYXRhLCBtZXNzYWdlcywgY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vb3AgLS0gaGFuZGxlIGJyb3dzZXJzIGxpa2UgSUUgdGhhdCBkb24ndCBsaWtlIHRoZXNlIElEQktleVJhbmdlc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlbWJsZSBhbGwgTGFzdE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb24gUE9KT3MgaW50byBsYXllci5NZXNzYWdlIGFuZCBsYXllci5Db252ZXJzYXRpb24gaW5zdGFuY2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkQ29udmVyc2F0aW9uc1Jlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBjb252ZXJzYXRpb25zXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IG1lc3NhZ2VzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgX2xvYWRDb252ZXJzYXRpb25zUmVzdWx0KGNvbnZlcnNhdGlvbnMsIG1lc3NhZ2VzLCBjYWxsYmFjaykge1xuICAgIC8vIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciBlYWNoIE1lc3NhZ2VcbiAgICBtZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4gdGhpcy5fY3JlYXRlTWVzc2FnZShtZXNzYWdlKSk7XG5cbiAgICAvLyBJbnN0YW50aWF0ZSBhbmQgUmVnaXN0ZXIgZWFjaCBDb252ZXJzYXRpb247IHdpbGwgZmluZCBhbnkgbGFzdE1lc3NhZ2UgdGhhdCB3YXMgcmVnaXN0ZXJlZC5cbiAgICBjb25zdCBuZXdEYXRhID0gY29udmVyc2F0aW9uc1xuICAgICAgLm1hcChjb252ZXJzYXRpb24gPT4gdGhpcy5fY3JlYXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikgfHwgdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbi5pZCkpXG4gICAgICAuZmlsdGVyKGNvbnZlcnNhdGlvbiA9PiBjb252ZXJzYXRpb24pO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBkYXRhXG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXdEYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBjaGFubmVscyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkQ2hhbm5lbHNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNvcnRCeSAgICAgICAtIE9uZSBvZiAnbGFzdF9tZXNzYWdlJyBvciAnY3JlYXRlZF9hdCc7IGFsd2F5cyBzb3J0cyBpbiBERVNDIG9yZGVyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgY2hhbm5lbElkIHRvIGdldCBDaGFubmVsIGFmdGVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFnZVNpemU9XSAgLSBUbyBsaW1pdCB0aGUgbnVtYmVyIG9mIHJlc3VsdHMsIHByb3ZpZGUgYSBudW1iZXIgZm9yIGhvdyBtYW55IHJlc3VsdHMgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdICAtIENhbGxiYWNrIGZvciBnZXR0aW5nIHJlc3VsdHNcbiAgICogQHBhcmFtIHtsYXllci5DaGFubmVsW119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZENoYW5uZWxzKGZyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvcnRJbmRleCA9ICdjcmVhdGVkX2F0JztcbiAgICAgIGxldCByYW5nZSA9IG51bGw7XG4gICAgICBjb25zdCBmcm9tQ2hhbm5lbCA9IGZyb21JZCA/IHRoaXMuY2xpZW50LmdldENoYW5uZWwoZnJvbUlkKSA6IG51bGw7XG4gICAgICBpZiAoZnJvbUNoYW5uZWwpIHtcbiAgICAgICAgcmFuZ2UgPSB3aW5kb3cuSURCS2V5UmFuZ2UudXBwZXJCb3VuZChbZ2V0RGF0ZShmcm9tQ2hhbm5lbC5jcmVhdGVkQXQpXSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2xvYWRCeUluZGV4KCdjaGFubmVscycsIHNvcnRJbmRleCwgcmFuZ2UsIEJvb2xlYW4oZnJvbUlkKSwgcGFnZVNpemUsIChkYXRhKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvYWRDaGFubmVsc1Jlc3VsdChkYXRhLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb29wIC0tIGhhbmRsZSBicm93c2VycyBsaWtlIElFIHRoYXQgZG9uJ3QgbGlrZSB0aGVzZSBJREJLZXlSYW5nZXNcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXNzZW1ibGUgYWxsIExhc3RNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9uIFBPSk9zIGludG8gbGF5ZXIuTWVzc2FnZSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uIGluc3RhbmNlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZENoYW5uZWxzUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNoYW5uZWxzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2hhbm5lbFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkQ2hhbm5lbHNSZXN1bHQoY2hhbm5lbHMsIGNhbGxiYWNrKSB7XG4gICAgLy8gSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIGVhY2ggQ29udmVyc2F0aW9uOyB3aWxsIGZpbmQgYW55IGxhc3RNZXNzYWdlIHRoYXQgd2FzIHJlZ2lzdGVyZWQuXG4gICAgY29uc3QgbmV3RGF0YSA9IGNoYW5uZWxzXG4gICAgICAubWFwKGNoYW5uZWwgPT4gdGhpcy5fY3JlYXRlQ2hhbm5lbChjaGFubmVsKSB8fCB0aGlzLmNsaWVudC5nZXRDaGFubmVsKGNoYW5uZWwuaWQpKVxuICAgICAgLmZpbHRlcihjb252ZXJzYXRpb24gPT4gY29udmVyc2F0aW9uKTtcblxuICAgIC8vIFJldHVybiB0aGUgZGF0YVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgbWVzc2FnZXMgZm9yIGEgZ2l2ZW4gQ29udmVyc2F0aW9uIElEIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBVc2UgX2xvYWRBbGwgaWYgbG9hZGluZyBBbGwgTWVzc2FnZXMgcmF0aGVyIHRoYW4gYWxsIE1lc3NhZ2VzIGZvciBhIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkTWVzc2FnZXNcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNvbnZlcnNhdGlvbklkIC0gSUQgb2YgdGhlIENvbnZlcnNhdGlvbiB3aG9zZSBNZXNzYWdlcyBhcmUgb2YgaW50ZXJlc3QuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgbWVzc2FnZUlkIHRvIGdldCBNZXNzYWdlcyBhZnRlclxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2VTaXplPV0gIC0gVG8gbGltaXQgdGhlIG51bWJlciBvZiByZXN1bHRzLCBwcm92aWRlIGEgbnVtYmVyIGZvciBob3cgbWFueSByZXN1bHRzIHRvIHJldHVybi5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgIC0gQ2FsbGJhY2sgZm9yIGdldHRpbmcgcmVzdWx0c1xuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2VbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkTWVzc2FnZXMoY29udmVyc2F0aW9uSWQsIGZyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl9tZXNzYWdlcyddIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBmcm9tTWVzc2FnZSA9IGZyb21JZCA/IHRoaXMuY2xpZW50LmdldE1lc3NhZ2UoZnJvbUlkKSA6IG51bGw7XG4gICAgICBjb25zdCBxdWVyeSA9IHdpbmRvdy5JREJLZXlSYW5nZS5ib3VuZChbY29udmVyc2F0aW9uSWQsIDBdLFxuICAgICAgICBbY29udmVyc2F0aW9uSWQsIGZyb21NZXNzYWdlID8gZnJvbU1lc3NhZ2UucG9zaXRpb24gOiBNQVhfU0FGRV9JTlRFR0VSXSk7XG4gICAgICB0aGlzLl9sb2FkQnlJbmRleCgnbWVzc2FnZXMnLCAnY29udmVyc2F0aW9uSWQnLCBxdWVyeSwgQm9vbGVhbihmcm9tSWQpLCBwYWdlU2l6ZSwgKGRhdGEpID0+IHtcbiAgICAgICAgdGhpcy5fbG9hZE1lc3NhZ2VzUmVzdWx0KGRhdGEsIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vb3AgLS0gaGFuZGxlIGJyb3dzZXJzIGxpa2UgSUUgdGhhdCBkb24ndCBsaWtlIHRoZXNlIElEQktleVJhbmdlc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBBbm5vdW5jZW1lbnRzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRBbm5vdW5jZW1lbnRzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbZnJvbUlkPV0gICAgLSBGb3IgcGFnaW5hdGlvbiwgcHJvdmlkZSB0aGUgbWVzc2FnZUlkIHRvIGdldCBBbm5vdW5jZW1lbnRzIGFmdGVyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFnZVNpemU9XSAgLSBUbyBsaW1pdCB0aGUgbnVtYmVyIG9mIHJlc3VsdHMsIHByb3ZpZGUgYSBudW1iZXIgZm9yIGhvdyBtYW55IHJlc3VsdHMgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7bGF5ZXIuQW5ub3VuY2VtZW50W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZEFubm91bmNlbWVudHMoZnJvbUlkLCBwYWdlU2l6ZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uX21lc3NhZ2VzJ10gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZyb21NZXNzYWdlID0gZnJvbUlkID8gdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShmcm9tSWQpIDogbnVsbDtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gd2luZG93LklEQktleVJhbmdlLmJvdW5kKFsnYW5ub3VuY2VtZW50JywgMF0sXG4gICAgICAgIFsnYW5ub3VuY2VtZW50JywgZnJvbU1lc3NhZ2UgPyBmcm9tTWVzc2FnZS5wb3NpdGlvbiA6IE1BWF9TQUZFX0lOVEVHRVJdKTtcbiAgICAgIHRoaXMuX2xvYWRCeUluZGV4KCdtZXNzYWdlcycsICdjb252ZXJzYXRpb25JZCcsIHF1ZXJ5LCBCb29sZWFuKGZyb21JZCksIHBhZ2VTaXplLCAoZGF0YSkgPT4ge1xuICAgICAgICB0aGlzLl9sb2FkTWVzc2FnZXNSZXN1bHQoZGF0YSwgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm9vcCAtLSBoYW5kbGUgYnJvd3NlcnMgbGlrZSBJRSB0aGF0IGRvbid0IGxpa2UgdGhlc2UgSURCS2V5UmFuZ2VzXG4gICAgfVxuICB9XG5cbiAgX2Jsb2JpZnlQYXJ0KHBhcnQpIHtcbiAgICBpZiAocGFydC51c2VCbG9iKSB7XG4gICAgICBwYXJ0LmJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYihwYXJ0LmJvZHkpO1xuICAgICAgZGVsZXRlIHBhcnQudXNlQmxvYjtcbiAgICAgIHBhcnQuZW5jb2RpbmcgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYW5kIHNvcnRzIHRoZSBtZXNzYWdlIG9iamVjdHMgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAqXG4gICAqIFRPRE86IEVuY29kZSBsaW1pdHMgb24gdGhpcywgZWxzZSB3ZSBhcmUgc29ydGluZyB0ZW5zIG9mIHRob3VzYW5kc1xuICAgKiBvZiBtZXNzYWdlcyBpbiBqYXZhc2NyaXB0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkTWVzc2FnZXNSZXN1bHRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gTWVzc2FnZSBvYmplY3RzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGNhbGxiYWNrLnJlc3VsdCAtIE1lc3NhZ2UgaW5zdGFuY2VzIGNyZWF0ZWQgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gIF9sb2FkTWVzc2FnZXNSZXN1bHQobWVzc2FnZXMsIGNhbGxiYWNrKSB7XG4gICAgLy8gQ29udmVydCBiYXNlNjQgdG8gYmxvYiBiZWZvcmUgc2VuZGluZyBpdCBhbG9uZy4uLlxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiBtZXNzYWdlLnBhcnRzLmZvckVhY2gocGFydCA9PiB0aGlzLl9ibG9iaWZ5UGFydChwYXJ0KSkpO1xuXG4gICAgLy8gSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIGVhY2ggTWVzc2FnZVxuICAgIGNvbnN0IG5ld0RhdGEgPSBtZXNzYWdlc1xuICAgICAgLm1hcChtZXNzYWdlID0+IHRoaXMuX2NyZWF0ZU1lc3NhZ2UobWVzc2FnZSkgfHwgdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtZXNzYWdlLmlkKSlcbiAgICAgIC5maWx0ZXIobWVzc2FnZSA9PiBtZXNzYWdlKTtcblxuICAgIC8vIFJldHVybiB0aGUgcmVzdWx0c1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBJZGVudGl0aWVzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRJZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBsb2FkSWRlbnRpdGllcyhjYWxsYmFjaykge1xuICAgIHRoaXMuX2xvYWRBbGwoJ2lkZW50aXRpZXMnLCAoZGF0YSkgPT4ge1xuICAgICAgdGhpcy5fbG9hZElkZW50aXRpZXNSZXN1bHQoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VtYmxlIGFsbCBMYXN0TWVzc2FnZXMgYW5kIElkZW50aXR5eSBQT0pPcyBpbnRvIGxheWVyLk1lc3NhZ2UgYW5kIGxheWVyLklkZW50aXR5eSBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRJZGVudGl0aWVzUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGlkZW50aXRpZXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5JZGVudGl0eVtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkSWRlbnRpdGllc1Jlc3VsdChpZGVudGl0aWVzLCBjYWxsYmFjaykge1xuICAgIC8vIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciBlYWNoIElkZW50aXR5LlxuICAgIGNvbnN0IG5ld0RhdGEgPSBpZGVudGl0aWVzXG4gICAgICAubWFwKGlkZW50aXR5ID0+IHRoaXMuX2NyZWF0ZUlkZW50aXR5KGlkZW50aXR5KSB8fCB0aGlzLmNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpXG4gICAgICAuZmlsdGVyKGlkZW50aXR5ID0+IGlkZW50aXR5KTtcblxuICAgIC8vIFJldHVybiB0aGUgZGF0YVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIHRoZSBDb252ZXJzYXRpb24gZnJvbSBhIGNvbnZlcnNhdGlvbiBEQiBFbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIGxheWVyLkNvbnZlcnNhdGlvbiBhbHJlYWR5IGV4aXN0cywgdGhlbiBpdHMgcHJlc3VtZWQgdGhhdCB3aGF0ZXZlciBpcyBpblxuICAgKiBqYXZhc2NyaXB0IGNhY2hlIGlzIG1vcmUgdXAgdG8gZGF0ZSB0aGFuIHdoYXRzIGluIEluZGV4ZWREQiBjYWNoZS5cbiAgICpcbiAgICogQXR0ZW1wdHMgdG8gYXNzaWduIHRoZSBsYXN0TWVzc2FnZSBwcm9wZXJ0eSB0byByZWZlciB0byBhcHByb3ByaWF0ZSBNZXNzYWdlLiAgSWYgaXQgZmFpbHMsXG4gICAqIGl0IHdpbGwgYmUgc2V0IHRvIG51bGwuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUNvbnZlcnNhdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY29udmVyc2F0aW9uXG4gICAqIEByZXR1cm5zIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBfY3JlYXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbi5pZCkpIHtcbiAgICAgIGNvbnZlcnNhdGlvbi5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG5ld0NvbnZlcnNhdGlvbiA9IHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QoY29udmVyc2F0aW9uKTtcbiAgICAgIG5ld0NvbnZlcnNhdGlvbi5zeW5jU3RhdGUgPSBjb252ZXJzYXRpb24uc3luY19zdGF0ZTtcbiAgICAgIHJldHVybiBuZXdDb252ZXJzYXRpb247XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciB0aGUgQ2hhbm5lbCBmcm9tIGEgQ2hhbm5lbCBEQiBFbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIGxheWVyLkNoYW5uZWwgYWxyZWFkeSBleGlzdHMsIHRoZW4gaXRzIHByZXN1bWVkIHRoYXQgd2hhdGV2ZXIgaXMgaW5cbiAgICogamF2YXNjcmlwdCBjYWNoZSBpcyBtb3JlIHVwIHRvIGRhdGUgdGhhbiB3aGF0cyBpbiBJbmRleGVkREIgY2FjaGUuXG4gICAqXG4gICAqIEF0dGVtcHRzIHRvIGFzc2lnbiB0aGUgbGFzdE1lc3NhZ2UgcHJvcGVydHkgdG8gcmVmZXIgdG8gYXBwcm9wcmlhdGUgTWVzc2FnZS4gIElmIGl0IGZhaWxzLFxuICAgKiBpdCB3aWxsIGJlIHNldCB0byBudWxsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVDaGFubmVsXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjaGFubmVsXG4gICAqIEByZXR1cm5zIHtsYXllci5DaGFubmVsfVxuICAgKi9cbiAgX2NyZWF0ZUNoYW5uZWwoY2hhbm5lbCkge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0Q2hhbm5lbChjaGFubmVsLmlkKSkge1xuICAgICAgY2hhbm5lbC5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG5ld0NoYW5uZWwgPSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KGNoYW5uZWwpO1xuICAgICAgbmV3Q2hhbm5lbC5zeW5jU3RhdGUgPSBjaGFubmVsLnN5bmNfc3RhdGU7XG4gICAgICByZXR1cm4gbmV3Q2hhbm5lbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIHRoZSBNZXNzYWdlIGZyb20gYSBtZXNzYWdlIERCIEVudHJ5LlxuICAgKlxuICAgKiBJZiB0aGUgbGF5ZXIuTWVzc2FnZSBhbHJlYWR5IGV4aXN0cywgdGhlbiBpdHMgcHJlc3VtZWQgdGhhdCB3aGF0ZXZlciBpcyBpblxuICAgKiBqYXZhc2NyaXB0IGNhY2hlIGlzIG1vcmUgdXAgdG8gZGF0ZSB0aGFuIHdoYXRzIGluIEluZGV4ZWREQiBjYWNoZS5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlTWVzc2FnZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZVxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVzc2FnZX1cbiAgICovXG4gIF9jcmVhdGVNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICBpZiAoIXRoaXMuY2xpZW50LmdldE1lc3NhZ2UobWVzc2FnZS5pZCkpIHtcbiAgICAgIG1lc3NhZ2UuX2Zyb21EQiA9IHRydWU7XG4gICAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb25JZC5pbmRleE9mKCdsYXllcjovLy9jb252ZXJzYXRpb25zJykpIHtcbiAgICAgICAgbWVzc2FnZS5jb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgaWQ6IG1lc3NhZ2UuY29udmVyc2F0aW9uSWQsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UuY29udmVyc2F0aW9uSWQuaW5kZXhPZignbGF5ZXI6Ly8vY2hhbm5lbHMnKSkge1xuICAgICAgICBtZXNzYWdlLmNoYW5uZWwgPSB7XG4gICAgICAgICAgaWQ6IG1lc3NhZ2UuY29udmVyc2F0aW9uSWQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBkZWxldGUgbWVzc2FnZS5jb252ZXJzYXRpb25JZDtcbiAgICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KG1lc3NhZ2UpO1xuICAgICAgbmV3TWVzc2FnZS5zeW5jU3RhdGUgPSBtZXNzYWdlLnN5bmNfc3RhdGU7XG4gICAgICByZXR1cm4gbmV3TWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIHRoZSBJZGVudGl0eSBmcm9tIGFuIGlkZW50aXRpZXMgREIgRW50cnkuXG4gICAqXG4gICAqIElmIHRoZSBsYXllci5JZGVudGl0eSBhbHJlYWR5IGV4aXN0cywgdGhlbiBpdHMgcHJlc3VtZWQgdGhhdCB3aGF0ZXZlciBpcyBpblxuICAgKiBqYXZhc2NyaXB0IGNhY2hlIGlzIG1vcmUgdXAgdG8gZGF0ZSB0aGFuIHdoYXRzIGluIEluZGV4ZWREQiBjYWNoZS5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlSWRlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IGlkZW50aXR5XG4gICAqIEByZXR1cm5zIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIF9jcmVhdGVJZGVudGl0eShpZGVudGl0eSkge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQpKSB7XG4gICAgICBpZGVudGl0eS5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG5ld2lkZW50aXR5ID0gdGhpcy5jbGllbnQuX2NyZWF0ZU9iamVjdChpZGVudGl0eSk7XG4gICAgICBuZXdpZGVudGl0eS5zeW5jU3RhdGUgPSBpZGVudGl0eS5zeW5jX3N0YXRlO1xuICAgICAgcmV0dXJuIG5ld2lkZW50aXR5O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBTeW5jIEV2ZW50cyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkU3luY1F1ZXVlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZFN5bmNRdWV1ZShjYWxsYmFjaykge1xuICAgIHRoaXMuX2xvYWRBbGwoJ3N5bmNRdWV1ZScsIHN5bmNFdmVudHMgPT4gdGhpcy5fbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhKHN5bmNFdmVudHMsIGNhbGxiYWNrKSk7XG4gIH1cblxuICAvKipcbiAgICogVmFsaWRhdGUgdGhhdCB3ZSBoYXZlIGFwcHJvcHJpYXRlIGRhdGEgZm9yIGVhY2ggU3luY0V2ZW50IGFuZCBpbnN0YW50aWF0ZSBpdC5cbiAgICpcbiAgICogQW55IG9wZXJhdGlvbiB0aGF0IGlzIG5vdCBhIERFTEVURSBtdXN0IGhhdmUgYSB2YWxpZCB0YXJnZXQgZm91bmQgaW4gdGhlIGRhdGFiYXNlIG9yIGphdmFzY3JpcHQgY2FjaGUsXG4gICAqIG90aGVyd2lzZSBpdCBjYW4gbm90IGJlIGV4ZWN1dGVkLlxuICAgKlxuICAgKiBUT0RPOiBOZWVkIHRvIGNsZWFudXAgc3luYyBlbnRyaWVzIHRoYXQgaGF2ZSBpbnZhbGlkIHRhcmdldHNcbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IHN5bmNFdmVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnRbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBfbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhKHN5bmNFdmVudHMsIGNhbGxiYWNrKSB7XG4gICAgLy8gR2F0aGVyIGFsbCBNZXNzYWdlIElEcyB0aGF0IGFyZSB0YXJnZXRzIG9mIG9wZXJhdGlvbnMuXG4gICAgY29uc3QgbWVzc2FnZUlkcyA9IHN5bmNFdmVudHNcbiAgICAgIC5maWx0ZXIoaXRlbSA9PiBpdGVtLm9wZXJhdGlvbiAhPT0gJ0RFTEVURScgJiYgaXRlbS50YXJnZXQgJiYgaXRlbS50YXJnZXQubWF0Y2goL21lc3NhZ2VzLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgLy8gR2F0aGVyIGFsbCBDb252ZXJzYXRpb24gSURzIHRoYXQgYXJlIHRhcmdldHMgb2Ygb3BlcmF0aW9ucy5cbiAgICBjb25zdCBjb252ZXJzYXRpb25JZHMgPSBzeW5jRXZlbnRzXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbS5vcGVyYXRpb24gIT09ICdERUxFVEUnICYmIGl0ZW0udGFyZ2V0ICYmIGl0ZW0udGFyZ2V0Lm1hdGNoKC9jb252ZXJzYXRpb25zLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgY29uc3QgaWRlbnRpdHlJZHMgPSBzeW5jRXZlbnRzXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbS5vcGVyYXRpb24gIT09ICdERUxFVEUnICYmIGl0ZW0udGFyZ2V0ICYmIGl0ZW0udGFyZ2V0Lm1hdGNoKC9pZGVudGl0aWVzLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgLy8gTG9hZCBhbnkgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyB0aGF0IGFyZSB0YXJnZXRzIG9mIG9wZXJhdGlvbnMuXG4gICAgLy8gQ2FsbCBfY3JlYXRlTWVzc2FnZSBvciBfY3JlYXRlQ29udmVyc2F0aW9uIG9uIGFsbCB0YXJnZXRzIGZvdW5kLlxuICAgIGxldCBjb3VudGVyID0gMDtcbiAgICBjb25zdCBtYXhDb3VudGVyID0gMztcbiAgICB0aGlzLmdldE9iamVjdHMoJ21lc3NhZ2VzJywgbWVzc2FnZUlkcywgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICBtZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4gdGhpcy5fY3JlYXRlTWVzc2FnZShtZXNzYWdlKSk7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gbWF4Q291bnRlcikgdGhpcy5fbG9hZFN5bmNFdmVudFJlc3VsdHMoc3luY0V2ZW50cywgY2FsbGJhY2spO1xuICAgIH0pO1xuICAgIHRoaXMuZ2V0T2JqZWN0cygnY29udmVyc2F0aW9ucycsIGNvbnZlcnNhdGlvbklkcywgKGNvbnZlcnNhdGlvbnMpID0+IHtcbiAgICAgIGNvbnZlcnNhdGlvbnMuZm9yRWFjaChjb252ZXJzYXRpb24gPT4gdGhpcy5fY3JlYXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikpO1xuICAgICAgY291bnRlcisrO1xuICAgICAgaWYgKGNvdW50ZXIgPT09IG1heENvdW50ZXIpIHRoaXMuX2xvYWRTeW5jRXZlbnRSZXN1bHRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgICB0aGlzLmdldE9iamVjdHMoJ2lkZW50aXRpZXMnLCBpZGVudGl0eUlkcywgKGlkZW50aXRpZXMpID0+IHtcbiAgICAgIGlkZW50aXRpZXMuZm9yRWFjaChpZGVudGl0eSA9PiB0aGlzLl9jcmVhdGVJZGVudGl0eShpZGVudGl0eSkpO1xuICAgICAgY291bnRlcisrO1xuICAgICAgaWYgKGNvdW50ZXIgPT09IG1heENvdW50ZXIpIHRoaXMuX2xvYWRTeW5jRXZlbnRSZXN1bHRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUdXJuIGFuIGFycmF5IG9mIFN5bmMgRXZlbnQgREIgRW50cmllcyBpbnRvIGFuIGFycmF5IG9mIGxheWVyLlN5bmNFdmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFN5bmNFdmVudFJlc3VsdHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gc3luY0V2ZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkU3luY0V2ZW50UmVzdWx0cyhzeW5jRXZlbnRzLCBjYWxsYmFjaykge1xuICAgIC8vIElmIHRoZSB0YXJnZXQgaXMgcHJlc2VudCBpbiB0aGUgc3luYyBldmVudCwgYnV0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBzeXN0ZW0sXG4gICAgLy8gZG8gTk9UIGF0dGVtcHQgdG8gaW5zdGFudGlhdGUgdGhpcyBldmVudC4uLiB1bmxlc3MgaXRzIGEgREVMRVRFIG9wZXJhdGlvbi5cbiAgICBjb25zdCBuZXdEYXRhID0gc3luY0V2ZW50c1xuICAgIC5maWx0ZXIoKHN5bmNFdmVudCkgPT4ge1xuICAgICAgY29uc3QgaGFzVGFyZ2V0ID0gQm9vbGVhbihzeW5jRXZlbnQudGFyZ2V0ICYmIHRoaXMuY2xpZW50LmdldE9iamVjdChzeW5jRXZlbnQudGFyZ2V0KSk7XG4gICAgICByZXR1cm4gc3luY0V2ZW50Lm9wZXJhdGlvbiA9PT0gJ0RFTEVURScgfHwgaGFzVGFyZ2V0O1xuICAgIH0pXG4gICAgLm1hcCgoc3luY0V2ZW50KSA9PiB7XG4gICAgICBpZiAoc3luY0V2ZW50LmlzV2Vic29ja2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudCh7XG4gICAgICAgICAgdGFyZ2V0OiBzeW5jRXZlbnQudGFyZ2V0LFxuICAgICAgICAgIGRlcGVuZHM6IHN5bmNFdmVudC5kZXBlbmRzLFxuICAgICAgICAgIG9wZXJhdGlvbjogc3luY0V2ZW50Lm9wZXJhdGlvbixcbiAgICAgICAgICBpZDogc3luY0V2ZW50LmlkLFxuICAgICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICAgIGZyb21EQjogdHJ1ZSxcbiAgICAgICAgICBjcmVhdGVkQXQ6IHN5bmNFdmVudC5jcmVhdGVkX2F0LFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgU3luY0V2ZW50LlhIUlN5bmNFdmVudCh7XG4gICAgICAgICAgdGFyZ2V0OiBzeW5jRXZlbnQudGFyZ2V0LFxuICAgICAgICAgIGRlcGVuZHM6IHN5bmNFdmVudC5kZXBlbmRzLFxuICAgICAgICAgIG9wZXJhdGlvbjogc3luY0V2ZW50Lm9wZXJhdGlvbixcbiAgICAgICAgICBpZDogc3luY0V2ZW50LmlkLFxuICAgICAgICAgIGRhdGE6IHN5bmNFdmVudC5kYXRhLFxuICAgICAgICAgIG1ldGhvZDogc3luY0V2ZW50Lm1ldGhvZCxcbiAgICAgICAgICBoZWFkZXJzOiBzeW5jRXZlbnQuaGVhZGVycyxcbiAgICAgICAgICB1cmw6IHN5bmNFdmVudC51cmwsXG4gICAgICAgICAgZnJvbURCOiB0cnVlLFxuICAgICAgICAgIGNyZWF0ZWRBdDogc3luY0V2ZW50LmNyZWF0ZWRfYXQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU29ydCB0aGUgcmVzdWx0cyBhbmQgdGhlbiByZXR1cm4gdGhlbS5cbiAgICAvLyBUT0RPOiBRdWVyeSByZXN1bHRzIHNob3VsZCBjb21lIGJhY2sgc29ydGVkIGJ5IGRhdGFiYXNlIHdpdGggcHJvcGVyIEluZGV4XG4gICAgVXRpbC5zb3J0QnkobmV3RGF0YSwgaXRlbSA9PiBpdGVtLmNyZWF0ZWRBdCk7XG4gICAgY2FsbGJhY2sobmV3RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgZGF0YSBmcm9tIHRoZSBzcGVjaWZpZWQgdGFibGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRBbGxcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFibGVOYW1lXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgX2xvYWRBbGwodGFibGVOYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IFtdO1xuICAgICAgdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWRvbmx5Jykub2JqZWN0U3RvcmUodGFibGVOYW1lKS5vcGVuQ3Vyc29yKCkub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBjdXJzb3IgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICAgIGRhdGEucHVzaChjdXJzb3IudmFsdWUpO1xuICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSB7XG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBkYXRhIGZyb20gdGhlIHNwZWNpZmllZCB0YWJsZSBhbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGluZGV4IHZhbHVlLlxuICAgKlxuICAgKiBSZXN1bHRzIGFyZSBhbHdheXMgc29ydGVkIGluIERFU0Mgb3JkZXIgYXQgdGhpcyB0aW1lLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkQnlJbmRleFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWJsZU5hbWUgLSAnbWVzc2FnZXMnLCAnY29udmVyc2F0aW9ucycsICdpZGVudGl0aWVzJ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gaW5kZXhOYW1lIC0gTmFtZSBvZiB0aGUgaW5kZXggdG8gcXVlcnkgb25cbiAgICogQHBhcmFtIHtJREJLZXlSYW5nZX0gcmFuZ2UgLSBSYW5nZSB0byBRdWVyeSBmb3IgKG51bGwgb2spXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNGcm9tSWQgLSBJZiBxdWVyeWluZyBmb3IgcmVzdWx0cyBhZnRlciBhIHNwZWNpZmllZCBJRCwgdGhlbiB3ZSB3YW50IHRvIHNraXAgdGhlIGZpcnN0IHJlc3VsdCAod2hpY2ggd2lsbCBiZSB0aGF0IElEKSAoXCJcIiBpcyBPSylcbiAgICogQHBhcmFtIHtudW1iZXJ9IHBhZ2VTaXplIC0gSWYgYSB2YWx1ZSBpcyBwcm92aWRlZCwgcmV0dXJuIGF0IG1vc3QgdGhhdCBudW1iZXIgb2YgcmVzdWx0czsgZWxzZSByZXR1cm4gYWxsIHJlc3VsdHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgX2xvYWRCeUluZGV4KHRhYmxlTmFtZSwgaW5kZXhOYW1lLCByYW5nZSwgaXNGcm9tSWQsIHBhZ2VTaXplLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgbGV0IHNob3VsZFNraXBOZXh0ID0gaXNGcm9tSWQ7XG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IFtdO1xuICAgICAgdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWRvbmx5JylcbiAgICAgICAgICAub2JqZWN0U3RvcmUodGFibGVOYW1lKVxuICAgICAgICAgIC5pbmRleChpbmRleE5hbWUpXG4gICAgICAgICAgLm9wZW5DdXJzb3IocmFuZ2UsICdwcmV2JylcbiAgICAgICAgICAub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjdXJzb3IgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgIGlmIChjdXJzb3IpIHtcbiAgICAgICAgICAgICAgaWYgKHNob3VsZFNraXBOZXh0KSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkU2tpcE5leHQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXRhLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAocGFnZVNpemUgJiYgZGF0YS5sZW5ndGggPj0gcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGVzIHRoZSBzcGVjaWZpZWQgb2JqZWN0cyBmcm9tIHRoZSBzcGVjaWZpZWQgdGFibGUuXG4gICAqXG4gICAqIEN1cnJlbnRseSB0YWtlcyBhbiBhcnJheSBvZiBkYXRhIHRvIGRlbGV0ZSByYXRoZXIgdGhhbiBhbiBhcnJheSBvZiBJRHM7XG4gICAqIElmIHlvdSBvbmx5IGhhdmUgYW4gSUQsIFt7aWQ6IG15SWR9XSBzaG91bGQgd29yay5cbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVPYmplY3RzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWJsZU5hbWVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZGF0YVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICBkZWxldGVPYmplY3RzKHRhYmxlTmFtZSwgZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2sgPyBjYWxsYmFjaygpIDogbnVsbDtcbiAgICB0aGlzLm9uT3BlbigoKSA9PiB7XG4gICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkd3JpdGUnKTtcbiAgICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUodGFibGVOYW1lKTtcbiAgICAgIHRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBjYWxsYmFjaztcbiAgICAgIGRhdGEuZm9yRWFjaChpdGVtID0+IHN0b3JlLmRlbGV0ZShpdGVtLmlkKSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGlkZW50aWZpZWQgb2JqZWN0cyBmcm9tIHRoZSBzcGVjaWZpZWQgZGF0YWJhc2UgdGFibGUuXG4gICAqXG4gICAqIFR1cm5pbmcgdGhlc2UgaW50byBpbnN0YW5jZXMgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjYWxsZXIuXG4gICAqXG4gICAqIEluc3BpcmVkIGJ5IGh0dHA6Ly93d3cuY29kZXByb2plY3QuY29tL0FydGljbGVzLzc0NDk4Ni9Ib3ctdG8tZG8tc29tZS1tYWdpYy13aXRoLWluZGV4ZWREQlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE9iamVjdHNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhYmxlTmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBpZHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBnZXRPYmplY3RzKHRhYmxlTmFtZSwgaWRzLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgY29uc3QgZGF0YSA9IFtdO1xuXG4gICAgLy8gR2F0aGVyLCBzb3J0LCBhbmQgZmlsdGVyIHJlcGxpY2EgSURzXG4gICAgY29uc3Qgc29ydGVkSWRzID0gaWRzLnNvcnQoKTtcbiAgICBmb3IgKGxldCBpID0gc29ydGVkSWRzLmxlbmd0aCAtIDE7IGkgPiAwOyBpLS0pIHtcbiAgICAgIGlmIChzb3J0ZWRJZHNbaV0gPT09IHNvcnRlZElkc1tpIC0gMV0pIHNvcnRlZElkcy5zcGxpY2UoaSwgMSk7XG4gICAgfVxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgdGhlIHRhYmxlIHNlYXJjaGluZyBmb3IgdGhlIHNwZWNpZmllZCBJRHNcbiAgICB0aGlzLm9uT3BlbigoKSA9PiB7XG4gICAgICB0aGlzLmRiLnRyYW5zYWN0aW9uKFt0YWJsZU5hbWVdLCAncmVhZG9ubHknKVxuICAgICAgICAub2JqZWN0U3RvcmUodGFibGVOYW1lKVxuICAgICAgICAub3BlbkN1cnNvcigpLm9uc3VjY2VzcyA9IChldnQpID0+IHtcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgICAgICAgY29uc3QgY3Vyc29yID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBrZXkgPSBjdXJzb3Iua2V5O1xuXG4gICAgICAgICAgLy8gVGhlIGN1cnNvciBoYXMgcGFzc2VkIGJleW9uZCB0aGlzIGtleS4gQ2hlY2sgbmV4dC5cbiAgICAgICAgICB3aGlsZSAoa2V5ID4gc29ydGVkSWRzW2luZGV4XSkgaW5kZXgrKztcblxuICAgICAgICAgIC8vIFRoZSBjdXJzb3IgaXMgcG9pbnRpbmcgYXQgb25lIG9mIG91ciBJRHMsIGdldCBpdCBhbmQgY2hlY2sgbmV4dC5cbiAgICAgICAgICBpZiAoa2V5ID09PSBzb3J0ZWRJZHNbaW5kZXhdKSB7XG4gICAgICAgICAgICBkYXRhLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uZSBvciBjaGVjayBuZXh0XG4gICAgICAgICAgaWYgKGluZGV4ID09PSBzb3J0ZWRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgICAgICAgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKHNvcnRlZElkc1tpbmRleF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsaWZpZWQgZ2V0T2JqZWN0cygpIG1ldGhvZCB0aGF0IGdldHMgYSBzaW5nbGUgb2JqZWN0LCBhbmQgYWxzbyBnZXRzIGl0cyByZWxhdGVkIG9iamVjdHMuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0T2JqZWN0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0YWJsZU5hbWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFjay5kYXRhXG4gICAqL1xuICBnZXRPYmplY3QodGFibGVOYW1lLCBpZCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soKTtcblxuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkb25seScpXG4gICAgICAgIC5vYmplY3RTdG9yZSh0YWJsZU5hbWUpXG4gICAgICAgIC5vcGVuQ3Vyc29yKHdpbmRvdy5JREJLZXlSYW5nZS5vbmx5KGlkKSkub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGN1cnNvciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgIGlmICghY3Vyc29yKSByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgICBzd2l0Y2ggKHRhYmxlTmFtZSkge1xuICAgICAgICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAgICAgICAvLyBDb252ZXJ0IGJhc2U2NCB0byBibG9iIGJlZm9yZSBzZW5kaW5nIGl0IGFsb25nLi4uXG4gICAgICAgICAgICAgIGN1cnNvci52YWx1ZS5wYXJ0cy5mb3JFYWNoKHBhcnQgPT4gdGhpcy5fYmxvYmlmeVBhcnQocGFydCkpO1xuICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2lkZW50aXRpZXMnOlxuICAgICAgICAgICAgY2FzZSAnY2hhbm5lbHMnOlxuICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICAgICAgICBpZiAoY3Vyc29yLnZhbHVlLmxhc3RfbWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBpZiAobGFzdE1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXRNZXNzYWdlRGF0YShbbGFzdE1lc3NhZ2VdLCAobWVzc2FnZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yLnZhbHVlLmxhc3RfbWVzc2FnZSA9IG1lc3NhZ2VzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldE9iamVjdCgnbWVzc2FnZXMnLCBjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGFpbSBhIFN5bmMgRXZlbnQuXG4gICAqXG4gICAqIEEgc3luYyBldmVudCBpcyBjbGFpbWVkIGJ5IGxvY2tpbmcgdGhlIHRhYmxlLCAgdmFsaWRhdGluZyB0aGF0IGl0IGlzIHN0aWxsIGluIHRoZSB0YWJsZS4uLiBhbmQgdGhlbiBkZWxldGluZyBpdCBmcm9tIHRoZSB0YWJsZS5cbiAgICpcbiAgICogQG1ldGhvZCBjbGFpbVN5bmNFdmVudFxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gc3luY0V2ZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBjbGFpbVN5bmNFdmVudChzeW5jRXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9wZXJtaXNzaW9uX3N5bmNRdWV1ZSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrKHRydWUpO1xuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gdGhpcy5kYi50cmFuc2FjdGlvbihbJ3N5bmNRdWV1ZSddLCAncmVhZHdyaXRlJyk7XG4gICAgICBjb25zdCBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKCdzeW5jUXVldWUnKTtcbiAgICAgIHN0b3JlLmdldChzeW5jRXZlbnQuaWQpLm9uc3VjY2VzcyA9IGV2dCA9PiBjYWxsYmFjayhCb29sZWFuKGV2dC50YXJnZXQucmVzdWx0KSk7XG4gICAgICBzdG9yZS5kZWxldGUoc3luY0V2ZW50LmlkKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYWxsIGRhdGEgZnJvbSBhbGwgdGFibGVzLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBiZSBjYWxsZWQgZnJvbSBsYXllci5DbGllbnQubG9nb3V0KClcbiAgICpcbiAgICogQG1ldGhvZCBkZWxldGVUYWJsZXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxsYmFja11cbiAgICovXG4gIGRlbGV0ZVRhYmxlcyhjYWxsYmFjayA9ICgpID0+IHt9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSB3aW5kb3cuaW5kZXhlZERCLmRlbGV0ZURhdGFiYXNlKHRoaXMuX2dldERiTmFtZSgpKTtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gcmVxdWVzdC5vbmVycm9yID0gY2FsbGJhY2s7XG4gICAgICBkZWxldGUgdGhpcy5kYjtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byBkZWxldGUgZGF0YWJhc2UnLCBlKTtcbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQHR5cGUge2xheWVyLkNsaWVudH0gTGF5ZXIgQ2xpZW50IGluc3RhbmNlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gaXMgdGhlIGRiIGNvbm5lY3Rpb24gb3BlblxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLmlzT3BlbiA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBpcyB0aGUgZGIgY29ubmVjdGlvbiB3aWxsIG5vdCBvcGVuXG4gKiBAcHJpdmF0ZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLl9pc09wZW5FcnJvciA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBJcyByZWFkaW5nL3dyaXRpbmcgbWVzc2FnZXMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25fbWVzc2FnZXMgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gSXMgcmVhZGluZy93cml0aW5nIGNvbnZlcnNhdGlvbnMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25fY29udmVyc2F0aW9ucyA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBJcyByZWFkaW5nL3dyaXRpbmcgY2hhbm5lbHMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25fY2hhbm5lbHMgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gSXMgcmVhZGluZy93cml0aW5nIGlkZW50aXRpZXMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25faWRlbnRpdGllcyA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBJcyByZWFkaW5nL3dyaXRpbmcgdW5zZW50IHNlcnZlciByZXF1ZXN0cyBhbGxvd2VkP1xuICogQHByaXZhdGVcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5fcGVybWlzc2lvbl9zeW5jUXVldWUgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSBJREJEYXRhYmFzZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLmRiID0gbnVsbDtcblxuLyoqXG4gKiBSaWNoIENvbnRlbnQgbWF5IGJlIHdyaXR0ZW4gdG8gaW5kZXhlZGRiIGFuZCBwZXJzaXN0ZWQuLi4gaWYgaXRzIHNpemUgaXMgbGVzcyB0aGFuIHRoaXMgbnVtYmVyIG9mIGJ5dGVzLlxuICpcbiAqIFRoaXMgdmFsdWUgY2FuIGJlIGN1c3RvbWl6ZWQ7IHRoaXMgZXhhbXBsZSBvbmx5IHdyaXRlcyBSaWNoIENvbnRlbnQgdGhhdCBpcyBsZXNzIHRoYW4gNTAwMCBieXRlc1xuICpcbiAqICAgIGxheWVyLkRiTWFuYWdlci5NYXhQYXJ0U2l6ZSA9IDUwMDA7XG4gKlxuICogQHN0YXRpY1xuICogQHR5cGUge051bWJlcn1cbiAqL1xuRGJNYW5hZ2VyLk1heFBhcnRTaXplID0gMjUwMDAwO1xuXG5EYk1hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgJ29wZW4nLCAnZXJyb3InLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoRGJNYW5hZ2VyLCBbRGJNYW5hZ2VyLCAnRGJNYW5hZ2VyJ10pO1xubW9kdWxlLmV4cG9ydHMgPSBEYk1hbmFnZXI7XG4iXX0=
