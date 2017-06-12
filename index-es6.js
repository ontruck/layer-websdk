/* eslint-disable global-require */
module.exports = {
  Root: require('./src/root'),
  Client: require('./src/client'),
  ClientAuthenticator: require('./src/client-authenticator'),
  Syncable: require('./src/models/syncable'),
  Conversation: require('./src/models/conversation'),
  Channel: require('./src/models/channel'),
  Container: require('./src/models/container'),
  Message: require('./src/models/message'),
  Announcement: require('./src/models/announcement'),
  MessagePart: require('./src/models/message-part'),
  Content: require('./src/models/content'),
  Query: require('./src/queries/query'),
  QueryBuilder: require('./src/queries/query-builder'),
  xhr: require('./src/xhr'),
  Identity: require('./src/models/identity'),
  Membership: require('./src/models/membership'),
  LayerError: require('./src/layer-error'),
  LayerEvent: require('./src/layer-event'),
  SyncManager: require('./src/sync-manager'),
  SyncEvent: require('./src/sync-event').SyncEvent,
  XHRSyncEvent: require('./src/sync-event').XHRSyncEvent,
  WebsocketSyncEvent: require('./src/sync-event').WebsocketSyncEvent,
  Websockets: {
    SocketManager: require('./src/websockets/socket-manager'),
    RequestManager: require('./src/websockets/request-manager'),
    ChangeManager: require('./src/websockets/change-manager'),
  },
  OnlineStateManager: require('./src/online-state-manager'),
  DbManager: require('./src/db-manager'),
  Constants: require('./src/const'),
  Util: require('./src/client-utils'),
  TypingIndicators: require('./src/typing-indicators/typing-indicators'),
};
module.exports.TypingIndicators.TypingListener = require('./src/typing-indicators/typing-listener');
module.exports.TypingIndicators.TypingPublisher = require('./src/typing-indicators/typing-publisher');
module.exports.Message.ConversationMessage = require('./src/models/conversation-message');
module.exports.Message.ChannelMessage = require('./src/models/channel-message');
