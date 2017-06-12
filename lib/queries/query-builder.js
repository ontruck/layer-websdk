'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Query = require('./query');

/**
 * Query builder class generating queries for a set of messages.
 * Used in Creating and Updating layer.Query instances.
 *
 * Using the Query Builder, we should be able to instantiate a Query
 *
 *      var qBuilder = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MessagesQuery
 */

var MessagesQuery = function () {

  /**
   * Creates a new query builder for a set of messages.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function MessagesQuery(query) {
    _classCallCheck(this, MessagesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Message,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }

    // TODO remove when messages can be fetched via query API rather than `GET /messages`
    this._conversationIdSet = false;
  }

  /**
   * Query for messages in this Conversation or Channel.
   *
   * @method forConversation
   * @param  {String} conversationId  Accepts a Conversation ID or Channel ID
   */


  _createClass(MessagesQuery, [{
    key: 'forConversation',
    value: function forConversation(conversationId) {
      if (conversationId.indexOf('layer:///channels/') === 0) {
        this._query.predicate = 'channel.id = \'' + conversationId + '\'';
        this._conversationIdSet = true;
      } else if (conversationId.indexOf('layer:///conversations/') === 0) {
        this._query.predicate = 'conversation.id = \'' + conversationId + '\'';
        this._conversationIdSet = true;
      } else {
        this._query.predicate = '';
        this._conversationIdSet = false;
      }
      return this;
    }

    /**
     * Sets the pagination window/number of messages to fetch from the local cache or server.
     *
     * Currently only positive integers are supported.
     *
     * @method paginationWindow
     * @param  {number} win
     */

  }, {
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return MessagesQuery;
}();

/**
 * Query builder class generating queries for a set of Announcements.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .announcements()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.AnnouncementsQuery
 * @extends layer.QueryBuilder.MessagesQuery
 */


var AnnouncementsQuery = function (_MessagesQuery) {
  _inherits(AnnouncementsQuery, _MessagesQuery);

  function AnnouncementsQuery(options) {
    _classCallCheck(this, AnnouncementsQuery);

    var _this = _possibleConstructorReturn(this, (AnnouncementsQuery.__proto__ || Object.getPrototypeOf(AnnouncementsQuery)).call(this, options));

    _this._query.model = Query.Announcement;
    return _this;
  }

  _createClass(AnnouncementsQuery, [{
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return AnnouncementsQuery;
}(MessagesQuery);

/**
 * Query builder class generating queries for a set of Conversations.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .conversations()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ConversationsQuery
 */


var ConversationsQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function ConversationsQuery(query) {
    _classCallCheck(this, ConversationsQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: query.sortBy
      };
    } else {
      this._query = {
        model: Query.Conversation,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(ConversationsQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Sets the sorting options for the Conversation.
     *
     * Currently only supports descending order
     * Currently only supports fieldNames of "createdAt" and "lastMessage.sentAt"
     *
     * @method sortBy
     * @param  {string} fieldName  - field to sort by
     * @param  {boolean} asc - Is an ascending sort?
     * @return {layer.QueryBuilder} this
     */

  }, {
    key: 'sortBy',
    value: function sortBy(fieldName) {
      var asc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      this._query.sortBy = [_defineProperty({}, fieldName, asc ? 'asc' : 'desc')];
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return ConversationsQuery;
}();

/**
 * Query builder class generating queries for a set of Channels.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .channels()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ChannelsQuery
 */


var ChannelsQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function ChannelsQuery(query) {
    _classCallCheck(this, ChannelsQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: null
      };
    } else {
      this._query = {
        model: Query.Channel,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(ChannelsQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return ChannelsQuery;
}();

/**
 * Query builder class generating queries for getting members of a Channel.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .members()
 *       .forChannel(channelId)
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .members()
 *       .forChannel(channelId)
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MembersQuery
 */


var MembersQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function MembersQuery(query) {
    _classCallCheck(this, MembersQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: null
      };
    } else {
      this._query = {
        model: Query.Membership,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(MembersQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Query for members in this Channel.
     *
     * @method forChannel
     * @param  {String} channelId
     */

  }, {
    key: 'forChannel',
    value: function forChannel(channelId) {
      if (channelId.indexOf('layer:///channels/') === 0) {
        this._query.predicate = 'channel.id = \'' + channelId + '\'';
      } else {
        this._query.predicate = '';
      }
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return MembersQuery;
}();

/**
 * Query builder class generating queries for a set of Identities followed by this user.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .identities()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.IdentitiesQuery
 */


var IdentitiesQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function IdentitiesQuery(query) {
    _classCallCheck(this, IdentitiesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Identity,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(IdentitiesQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return IdentitiesQuery;
}();

/**
 * Query builder class. Used with layer.Query to specify what local/remote
 * data changes to subscribe to.  For examples, see layer.QueryBuilder.MessagesQuery
 * and layer.QueryBuilder.ConversationsQuery.  This static class is used to instantiate
 * MessagesQuery and ConversationsQuery Builder instances:
 *
 *      var conversationsQueryBuilder = QueryBuilder.conversations();
 *      var messagesQueryBuidler = QueryBuilder.messages();
 *
 * Should you use these instead of directly using the layer.Query class?
 * That is a matter of programming style and preference, there is no
 * correct answer.
 *
 * @class layer.QueryBuilder
 */


var QueryBuilder = {

  /**
   * Create a new layer.MessagesQuery instance.
   *
   * @method messages
   * @static
   * @returns {layer.QueryBuilder.MessagesQuery}
   */
  messages: function messages() {
    return new MessagesQuery();
  },


  /**
   * Create a new layer.AnnouncementsQuery instance.
   *
   * @method announcements
   * @static
   * @returns {layer.QueryBuilder.AnnouncementsQuery}
   */
  announcements: function announcements() {
    return new AnnouncementsQuery();
  },


  /**
   * Create a new layer.ConversationsQuery instance.
   *
   * @method conversations
   * @static
   * @returns {layer.QueryBuilder.ConversationsQuery}
   */
  conversations: function conversations() {
    return new ConversationsQuery();
  },


  /**
   * Create a new layer.ChannelsQuery instance.
   *
   * @method channels
   * @static
   * @returns {layer.QueryBuilder.ChannelsQuery}
   */
  channels: function channels() {
    return new ChannelsQuery();
  },


  /**
   * Create a new layer.MembersQuery instance.
   *
   * @method members
   * @static
   * @returns {layer.QueryBuilder.MembersQuery}
   */
  members: function members() {
    return new MembersQuery();
  },


  /**
   * Create a new layer.IdentitiesQuery instance.
   *
   * @method identities
   * @static
   * @returns {layer.QueryBuilder.IdentitiesQuery}
   */
  identities: function identities() {
    return new IdentitiesQuery();
  },


  /**
   * Takes the return value of QueryBuilder.prototype.build and creates a
   * new QueryBuilder.
   *
   * Used within layer.Query.prototype.toBuilder.
   *
   * @method fromQueryObject
   * @private
   * @param {Object} obj
   * @static
   */
  fromQueryObject: function fromQueryObject(obj) {
    switch (obj.model) {
      case Query.Message:
        return new MessagesQuery(obj);
      case Query.Announcement:
        return new AnnouncementsQuery(obj);
      case Query.Conversation:
        return new ConversationsQuery(obj);
      case Query.Channel:
        return new ChannelsQuery(obj);
      case Query.Identity:
        return new IdentitiesQuery(obj);
      case Query.Membership:
        return new MembersQuery(obj);
      default:
        return null;
    }
  }
};

module.exports = QueryBuilder;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL3F1ZXJ5LWJ1aWxkZXIuanMiXSwibmFtZXMiOlsiUXVlcnkiLCJyZXF1aXJlIiwiTWVzc2FnZXNRdWVyeSIsInF1ZXJ5IiwiX3F1ZXJ5IiwibW9kZWwiLCJyZXR1cm5UeXBlIiwiZGF0YVR5cGUiLCJwYWdpbmF0aW9uV2luZG93IiwiTWVzc2FnZSIsInByb3RvdHlwZSIsIl9jb252ZXJzYXRpb25JZFNldCIsImNvbnZlcnNhdGlvbklkIiwiaW5kZXhPZiIsInByZWRpY2F0ZSIsIndpbiIsIkFubm91bmNlbWVudHNRdWVyeSIsIm9wdGlvbnMiLCJBbm5vdW5jZW1lbnQiLCJDb252ZXJzYXRpb25zUXVlcnkiLCJzb3J0QnkiLCJDb252ZXJzYXRpb24iLCJmaWVsZE5hbWUiLCJhc2MiLCJDaGFubmVsc1F1ZXJ5IiwiQ2hhbm5lbCIsIk1lbWJlcnNRdWVyeSIsIk1lbWJlcnNoaXAiLCJjaGFubmVsSWQiLCJJZGVudGl0aWVzUXVlcnkiLCJJZGVudGl0eSIsIlF1ZXJ5QnVpbGRlciIsIm1lc3NhZ2VzIiwiYW5ub3VuY2VtZW50cyIsImNvbnZlcnNhdGlvbnMiLCJjaGFubmVscyIsIm1lbWJlcnMiLCJpZGVudGl0aWVzIiwiZnJvbVF1ZXJ5T2JqZWN0Iiwib2JqIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsSUFBTUEsUUFBUUMsUUFBUSxTQUFSLENBQWQ7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQXVCTUMsYTs7QUFFSjs7Ozs7Ozs7QUFRQSx5QkFBWUMsS0FBWixFQUFtQjtBQUFBOztBQUNqQixRQUFJQSxLQUFKLEVBQVc7QUFDVCxXQUFLQyxNQUFMLEdBQWM7QUFDWkMsZUFBT0YsTUFBTUUsS0FERDtBQUVaQyxvQkFBWUgsTUFBTUcsVUFGTjtBQUdaQyxrQkFBVUosTUFBTUksUUFISjtBQUlaQywwQkFBa0JMLE1BQU1LO0FBSlosT0FBZDtBQU1ELEtBUEQsTUFPTztBQUNM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ZW50IjpbImNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuXG4vKipcbiAqIFF1ZXJ5IGJ1aWxkZXIgY2xhc3MgZ2VuZXJhdGluZyBxdWVyaWVzIGZvciBhIHNldCBvZiBtZXNzYWdlcy5cbiAqIFVzZWQgaW4gQ3JlYXRpbmcgYW5kIFVwZGF0aW5nIGxheWVyLlF1ZXJ5IGluc3RhbmNlcy5cbiAqXG4gKiBVc2luZyB0aGUgUXVlcnkgQnVpbGRlciwgd2Ugc2hvdWxkIGJlIGFibGUgdG8gaW5zdGFudGlhdGUgYSBRdWVyeVxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAubWVzc2FnZXMoKVxuICogICAgICAgLmZvckNvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKlxuICogWW91IGNhbiB0aGVuIGNyZWF0ZSBhZGRpdGlvbmFsIGJ1aWxkZXJzIGFuZCB1cGRhdGUgdGhlIHF1ZXJ5OlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyMiA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLm1lc3NhZ2VzKClcbiAqICAgICAgIC5mb3JDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvYmJiYmJiYmItYmJiYi1iYmJiLWJiYmItYmJiYmJiYmJiYmJiJylcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZShxQnVpbGRlcik7XG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5XG4gKi9cbmNsYXNzIE1lc3NhZ2VzUXVlcnkge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IHF1ZXJ5IGJ1aWxkZXIgZm9yIGEgc2V0IG9mIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBTdGFuZGFyZCB1c2UgaXMgd2l0aG91dCBhbnkgYXJndW1lbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3F1ZXJ5PW51bGxdXG4gICAqL1xuICBjb25zdHJ1Y3RvcihxdWVyeSkge1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBxdWVyeS5tb2RlbCxcbiAgICAgICAgcmV0dXJuVHlwZTogcXVlcnkucmV0dXJuVHlwZSxcbiAgICAgICAgZGF0YVR5cGU6IHF1ZXJ5LmRhdGFUeXBlLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBxdWVyeS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBRdWVyeS5NZXNzYWdlLFxuICAgICAgICByZXR1cm5UeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgZGF0YVR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBRdWVyeS5wcm90b3R5cGUucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVE9ETyByZW1vdmUgd2hlbiBtZXNzYWdlcyBjYW4gYmUgZmV0Y2hlZCB2aWEgcXVlcnkgQVBJIHJhdGhlciB0aGFuIGBHRVQgL21lc3NhZ2VzYFxuICAgIHRoaXMuX2NvbnZlcnNhdGlvbklkU2V0ID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUXVlcnkgZm9yIG1lc3NhZ2VzIGluIHRoaXMgQ29udmVyc2F0aW9uIG9yIENoYW5uZWwuXG4gICAqXG4gICAqIEBtZXRob2QgZm9yQ29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSAge1N0cmluZ30gY29udmVyc2F0aW9uSWQgIEFjY2VwdHMgYSBDb252ZXJzYXRpb24gSUQgb3IgQ2hhbm5lbCBJRFxuICAgKi9cbiAgZm9yQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkKSB7XG4gICAgaWYgKGNvbnZlcnNhdGlvbklkLmluZGV4T2YoJ2xheWVyOi8vL2NoYW5uZWxzLycpID09PSAwKSB7XG4gICAgICB0aGlzLl9xdWVyeS5wcmVkaWNhdGUgPSBgY2hhbm5lbC5pZCA9ICcke2NvbnZlcnNhdGlvbklkfSdgO1xuICAgICAgdGhpcy5fY29udmVyc2F0aW9uSWRTZXQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uSWQuaW5kZXhPZignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy8nKSA9PT0gMCkge1xuICAgICAgdGhpcy5fcXVlcnkucHJlZGljYXRlID0gYGNvbnZlcnNhdGlvbi5pZCA9ICcke2NvbnZlcnNhdGlvbklkfSdgO1xuICAgICAgdGhpcy5fY29udmVyc2F0aW9uSWRTZXQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9xdWVyeS5wcmVkaWNhdGUgPSAnJztcbiAgICAgIHRoaXMuX2NvbnZlcnNhdGlvbklkU2V0ID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBhZ2luYXRpb24gd2luZG93L251bWJlciBvZiBtZXNzYWdlcyB0byBmZXRjaCBmcm9tIHRoZSBsb2NhbCBjYWNoZSBvciBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSBvbmx5IHBvc2l0aXZlIGludGVnZXJzIGFyZSBzdXBwb3J0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgcGFnaW5hdGlvbldpbmRvd1xuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHdpblxuICAgKi9cbiAgcGFnaW5hdGlvbldpbmRvdyh3aW4pIHtcbiAgICB0aGlzLl9xdWVyeS5wYWdpbmF0aW9uV2luZG93ID0gd2luO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJ1aWx0IHF1ZXJ5IG9iamVjdCB0byBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBieSBsYXllci5RdWVyeUJ1aWxkZXIuIFlvdSBzaG91bGQgbm90IG5lZWQgdG8gY2FsbCB0aGlzLlxuICAgKlxuICAgKiBAbWV0aG9kIGJ1aWxkXG4gICAqL1xuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnk7XG4gIH1cbn1cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgQW5ub3VuY2VtZW50cy5cbiAqXG4gKiBUbyBnZXQgc3RhcnRlZDpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlciA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLmFubm91bmNlbWVudHMoKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuUXVlcnlCdWlsZGVyLkFubm91bmNlbWVudHNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlCdWlsZGVyLk1lc3NhZ2VzUXVlcnlcbiAqL1xuY2xhc3MgQW5ub3VuY2VtZW50c1F1ZXJ5IGV4dGVuZHMgTWVzc2FnZXNRdWVyeSB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9xdWVyeS5tb2RlbCA9IFF1ZXJ5LkFubm91bmNlbWVudDtcbiAgfVxuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnk7XG4gIH1cbn1cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgQ29udmVyc2F0aW9ucy5cbiAqXG4gKiBVc2VkIGluIENyZWF0aW5nIGFuZCBVcGRhdGluZyBsYXllci5RdWVyeSBpbnN0YW5jZXMuXG4gKlxuICogVG8gZ2V0IHN0YXJ0ZWQ6XG4gKlxuICogICAgICB2YXIgcUJ1aWxkZXIgPSBRdWVyeUJ1aWxkZXJcbiAqICAgICAgIC5jb252ZXJzYXRpb25zKClcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDEwMCk7XG4gKiAgICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeShxQnVpbGRlcik7XG4gKlxuICogWW91IGNhbiB0aGVuIGNyZWF0ZSBhZGRpdGlvbmFsIGJ1aWxkZXJzIGFuZCB1cGRhdGUgdGhlIHF1ZXJ5OlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyMiA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLmNvbnZlcnNhdGlvbnMoKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMjAwKTtcbiAqICAgICAgcXVlcnkudXBkYXRlKHFCdWlsZGVyKTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuUXVlcnlCdWlsZGVyLkNvbnZlcnNhdGlvbnNRdWVyeVxuICovXG5jbGFzcyBDb252ZXJzYXRpb25zUXVlcnkge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IHF1ZXJ5IGJ1aWxkZXIgZm9yIGEgc2V0IG9mIGNvbnZlcnNhdGlvbnMuXG4gICAqXG4gICAqIFN0YW5kYXJkIHVzZSBpcyB3aXRob3V0IGFueSBhcmd1bWVudHMuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbcXVlcnk9bnVsbF1cbiAgICovXG4gIGNvbnN0cnVjdG9yKHF1ZXJ5KSB7XG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IHF1ZXJ5Lm1vZGVsLFxuICAgICAgICByZXR1cm5UeXBlOiBxdWVyeS5yZXR1cm5UeXBlLFxuICAgICAgICBkYXRhVHlwZTogcXVlcnkuZGF0YVR5cGUsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IHF1ZXJ5LnBhZ2luYXRpb25XaW5kb3csXG4gICAgICAgIHNvcnRCeTogcXVlcnkuc29ydEJ5LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBRdWVyeS5Db252ZXJzYXRpb24sXG4gICAgICAgIHJldHVyblR5cGU6ICdvYmplY3QnLFxuICAgICAgICBkYXRhVHlwZTogJ29iamVjdCcsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IFF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IG51bGwsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYWdpbmF0aW9uIHdpbmRvdy9udW1iZXIgb2YgbWVzc2FnZXMgdG8gZmV0Y2ggZnJvbSB0aGUgbG9jYWwgY2FjaGUgb3Igc2VydmVyLlxuICAgKlxuICAgKiBDdXJyZW50bHkgb25seSBwb3NpdGl2ZSBpbnRlZ2VycyBhcmUgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHBhZ2luYXRpb25XaW5kb3dcbiAgICogQHBhcmFtICB7bnVtYmVyfSB3aW5cbiAgICogQHJldHVybiB7bGF5ZXIuUXVlcnlCdWlsZGVyfSB0aGlzXG4gICAqL1xuICBwYWdpbmF0aW9uV2luZG93KHdpbikge1xuICAgIHRoaXMuX3F1ZXJ5LnBhZ2luYXRpb25XaW5kb3cgPSB3aW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgc29ydGluZyBvcHRpb25zIGZvciB0aGUgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBDdXJyZW50bHkgb25seSBzdXBwb3J0cyBkZXNjZW5kaW5nIG9yZGVyXG4gICAqIEN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGZpZWxkTmFtZXMgb2YgXCJjcmVhdGVkQXRcIiBhbmQgXCJsYXN0TWVzc2FnZS5zZW50QXRcIlxuICAgKlxuICAgKiBAbWV0aG9kIHNvcnRCeVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGZpZWxkTmFtZSAgLSBmaWVsZCB0byBzb3J0IGJ5XG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IGFzYyAtIElzIGFuIGFzY2VuZGluZyBzb3J0P1xuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeUJ1aWxkZXJ9IHRoaXNcbiAgICovXG4gIHNvcnRCeShmaWVsZE5hbWUsIGFzYyA9IGZhbHNlKSB7XG4gICAgdGhpcy5fcXVlcnkuc29ydEJ5ID0gW3sgW2ZpZWxkTmFtZV06IGFzYyA/ICdhc2MnIDogJ2Rlc2MnIH1dO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJ1aWx0IHF1ZXJ5IG9iamVjdCB0byBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBieSBsYXllci5RdWVyeUJ1aWxkZXIuIFlvdSBzaG91bGQgbm90IG5lZWQgdG8gY2FsbCB0aGlzLlxuICAgKlxuICAgKiBAbWV0aG9kIGJ1aWxkXG4gICAqL1xuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnk7XG4gIH1cbn1cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgQ2hhbm5lbHMuXG4gKlxuICogVXNlZCBpbiBDcmVhdGluZyBhbmQgVXBkYXRpbmcgbGF5ZXIuUXVlcnkgaW5zdGFuY2VzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuY2hhbm5lbHMoKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKiBZb3UgY2FuIHRoZW4gY3JlYXRlIGFkZGl0aW9uYWwgYnVpbGRlcnMgYW5kIHVwZGF0ZSB0aGUgcXVlcnk6XG4gKlxuICogICAgICB2YXIgcUJ1aWxkZXIyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuY29udmVyc2F0aW9ucygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygyMDApO1xuICogICAgICBxdWVyeS51cGRhdGUocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuQ2hhbm5lbHNRdWVyeVxuICovXG5jbGFzcyBDaGFubmVsc1F1ZXJ5IHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBxdWVyeSBidWlsZGVyIGZvciBhIHNldCBvZiBjb252ZXJzYXRpb25zLlxuICAgKlxuICAgKiBTdGFuZGFyZCB1c2UgaXMgd2l0aG91dCBhbnkgYXJndW1lbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3F1ZXJ5PW51bGxdXG4gICAqL1xuICBjb25zdHJ1Y3RvcihxdWVyeSkge1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBxdWVyeS5tb2RlbCxcbiAgICAgICAgcmV0dXJuVHlwZTogcXVlcnkucmV0dXJuVHlwZSxcbiAgICAgICAgZGF0YVR5cGU6IHF1ZXJ5LmRhdGFUeXBlLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBxdWVyeS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IG51bGwsXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IFF1ZXJ5LkNoYW5uZWwsXG4gICAgICAgIHJldHVyblR5cGU6ICdvYmplY3QnLFxuICAgICAgICBkYXRhVHlwZTogJ29iamVjdCcsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IFF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IG51bGwsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYWdpbmF0aW9uIHdpbmRvdy9udW1iZXIgb2YgbWVzc2FnZXMgdG8gZmV0Y2ggZnJvbSB0aGUgbG9jYWwgY2FjaGUgb3Igc2VydmVyLlxuICAgKlxuICAgKiBDdXJyZW50bHkgb25seSBwb3NpdGl2ZSBpbnRlZ2VycyBhcmUgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHBhZ2luYXRpb25XaW5kb3dcbiAgICogQHBhcmFtICB7bnVtYmVyfSB3aW5cbiAgICogQHJldHVybiB7bGF5ZXIuUXVlcnlCdWlsZGVyfSB0aGlzXG4gICAqL1xuICBwYWdpbmF0aW9uV2luZG93KHdpbikge1xuICAgIHRoaXMuX3F1ZXJ5LnBhZ2luYXRpb25XaW5kb3cgPSB3aW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYnVpbHQgcXVlcnkgb2JqZWN0IHRvIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGJ5IGxheWVyLlF1ZXJ5QnVpbGRlci4gWW91IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMuXG4gICAqXG4gICAqIEBtZXRob2QgYnVpbGRcbiAgICovXG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeTtcbiAgfVxufVxuXG5cbi8qKlxuICogUXVlcnkgYnVpbGRlciBjbGFzcyBnZW5lcmF0aW5nIHF1ZXJpZXMgZm9yIGdldHRpbmcgbWVtYmVycyBvZiBhIENoYW5uZWwuXG4gKlxuICogVXNlZCBpbiBDcmVhdGluZyBhbmQgVXBkYXRpbmcgbGF5ZXIuUXVlcnkgaW5zdGFuY2VzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAubWVtYmVycygpXG4gKiAgICAgICAuZm9yQ2hhbm5lbChjaGFubmVsSWQpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygxMDApO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICpcbiAqIFlvdSBjYW4gdGhlbiBjcmVhdGUgYWRkaXRpb25hbCBidWlsZGVycyBhbmQgdXBkYXRlIHRoZSBxdWVyeTpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlcjIgPSBRdWVyeUJ1aWxkZXJcbiAqICAgICAgIC5tZW1iZXJzKClcbiAqICAgICAgIC5mb3JDaGFubmVsKGNoYW5uZWxJZClcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZShxQnVpbGRlcik7XG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlci5NZW1iZXJzUXVlcnlcbiAqL1xuY2xhc3MgTWVtYmVyc1F1ZXJ5IHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBxdWVyeSBidWlsZGVyIGZvciBhIHNldCBvZiBjb252ZXJzYXRpb25zLlxuICAgKlxuICAgKiBTdGFuZGFyZCB1c2UgaXMgd2l0aG91dCBhbnkgYXJndW1lbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3F1ZXJ5PW51bGxdXG4gICAqL1xuICBjb25zdHJ1Y3RvcihxdWVyeSkge1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBxdWVyeS5tb2RlbCxcbiAgICAgICAgcmV0dXJuVHlwZTogcXVlcnkucmV0dXJuVHlwZSxcbiAgICAgICAgZGF0YVR5cGU6IHF1ZXJ5LmRhdGFUeXBlLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBxdWVyeS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IG51bGwsXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9xdWVyeSA9IHtcbiAgICAgICAgbW9kZWw6IFF1ZXJ5Lk1lbWJlcnNoaXAsXG4gICAgICAgIHJldHVyblR5cGU6ICdvYmplY3QnLFxuICAgICAgICBkYXRhVHlwZTogJ29iamVjdCcsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IFF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IG51bGwsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYWdpbmF0aW9uIHdpbmRvdy9udW1iZXIgb2YgbWVzc2FnZXMgdG8gZmV0Y2ggZnJvbSB0aGUgbG9jYWwgY2FjaGUgb3Igc2VydmVyLlxuICAgKlxuICAgKiBDdXJyZW50bHkgb25seSBwb3NpdGl2ZSBpbnRlZ2VycyBhcmUgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHBhZ2luYXRpb25XaW5kb3dcbiAgICogQHBhcmFtICB7bnVtYmVyfSB3aW5cbiAgICogQHJldHVybiB7bGF5ZXIuUXVlcnlCdWlsZGVyfSB0aGlzXG4gICAqL1xuICBwYWdpbmF0aW9uV2luZG93KHdpbikge1xuICAgIHRoaXMuX3F1ZXJ5LnBhZ2luYXRpb25XaW5kb3cgPSB3aW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUXVlcnkgZm9yIG1lbWJlcnMgaW4gdGhpcyBDaGFubmVsLlxuICAgKlxuICAgKiBAbWV0aG9kIGZvckNoYW5uZWxcbiAgICogQHBhcmFtICB7U3RyaW5nfSBjaGFubmVsSWRcbiAgICovXG4gIGZvckNoYW5uZWwoY2hhbm5lbElkKSB7XG4gICAgaWYgKGNoYW5uZWxJZC5pbmRleE9mKCdsYXllcjovLy9jaGFubmVscy8nKSA9PT0gMCkge1xuICAgICAgdGhpcy5fcXVlcnkucHJlZGljYXRlID0gYGNoYW5uZWwuaWQgPSAnJHtjaGFubmVsSWR9J2A7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5LnByZWRpY2F0ZSA9ICcnO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBidWlsdCBxdWVyeSBvYmplY3QgdG8gc2VuZCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYnkgbGF5ZXIuUXVlcnlCdWlsZGVyLiBZb3Ugc2hvdWxkIG5vdCBuZWVkIHRvIGNhbGwgdGhpcy5cbiAgICpcbiAgICogQG1ldGhvZCBidWlsZFxuICAgKi9cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5O1xuICB9XG59XG5cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgSWRlbnRpdGllcyBmb2xsb3dlZCBieSB0aGlzIHVzZXIuXG4gKlxuICogVXNlZCBpbiBDcmVhdGluZyBhbmQgVXBkYXRpbmcgbGF5ZXIuUXVlcnkgaW5zdGFuY2VzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuaWRlbnRpdGllcygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygxMDApO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuSWRlbnRpdGllc1F1ZXJ5XG4gKi9cbmNsYXNzIElkZW50aXRpZXNRdWVyeSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgcXVlcnkgYnVpbGRlciBmb3IgYSBzZXQgb2YgY29udmVyc2F0aW9ucy5cbiAgICpcbiAgICogU3RhbmRhcmQgdXNlIGlzIHdpdGhvdXQgYW55IGFyZ3VtZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtxdWVyeT1udWxsXVxuICAgKi9cbiAgY29uc3RydWN0b3IocXVlcnkpIHtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogcXVlcnkubW9kZWwsXG4gICAgICAgIHJldHVyblR5cGU6IHF1ZXJ5LnJldHVyblR5cGUsXG4gICAgICAgIGRhdGFUeXBlOiBxdWVyeS5kYXRhVHlwZSxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogcXVlcnkucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogUXVlcnkuSWRlbnRpdHksXG4gICAgICAgIHJldHVyblR5cGU6ICdvYmplY3QnLFxuICAgICAgICBkYXRhVHlwZTogJ29iamVjdCcsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IFF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFnaW5hdGlvbiB3aW5kb3cvbnVtYmVyIG9mIG1lc3NhZ2VzIHRvIGZldGNoIGZyb20gdGhlIGxvY2FsIGNhY2hlIG9yIHNlcnZlci5cbiAgICpcbiAgICogQ3VycmVudGx5IG9ubHkgcG9zaXRpdmUgaW50ZWdlcnMgYXJlIHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBwYWdpbmF0aW9uV2luZG93XG4gICAqIEBwYXJhbSAge251bWJlcn0gd2luXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5QnVpbGRlcn0gdGhpc1xuICAgKi9cbiAgcGFnaW5hdGlvbldpbmRvdyh3aW4pIHtcbiAgICB0aGlzLl9xdWVyeS5wYWdpbmF0aW9uV2luZG93ID0gd2luO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJ1aWx0IHF1ZXJ5IG9iamVjdCB0byBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBieSBsYXllci5RdWVyeUJ1aWxkZXIuIFlvdSBzaG91bGQgbm90IG5lZWQgdG8gY2FsbCB0aGlzLlxuICAgKlxuICAgKiBAbWV0aG9kIGJ1aWxkXG4gICAqL1xuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnk7XG4gIH1cbn1cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzLiBVc2VkIHdpdGggbGF5ZXIuUXVlcnkgdG8gc3BlY2lmeSB3aGF0IGxvY2FsL3JlbW90ZVxuICogZGF0YSBjaGFuZ2VzIHRvIHN1YnNjcmliZSB0by4gIEZvciBleGFtcGxlcywgc2VlIGxheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5XG4gKiBhbmQgbGF5ZXIuUXVlcnlCdWlsZGVyLkNvbnZlcnNhdGlvbnNRdWVyeS4gIFRoaXMgc3RhdGljIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGVcbiAqIE1lc3NhZ2VzUXVlcnkgYW5kIENvbnZlcnNhdGlvbnNRdWVyeSBCdWlsZGVyIGluc3RhbmNlczpcbiAqXG4gKiAgICAgIHZhciBjb252ZXJzYXRpb25zUXVlcnlCdWlsZGVyID0gUXVlcnlCdWlsZGVyLmNvbnZlcnNhdGlvbnMoKTtcbiAqICAgICAgdmFyIG1lc3NhZ2VzUXVlcnlCdWlkbGVyID0gUXVlcnlCdWlsZGVyLm1lc3NhZ2VzKCk7XG4gKlxuICogU2hvdWxkIHlvdSB1c2UgdGhlc2UgaW5zdGVhZCBvZiBkaXJlY3RseSB1c2luZyB0aGUgbGF5ZXIuUXVlcnkgY2xhc3M/XG4gKiBUaGF0IGlzIGEgbWF0dGVyIG9mIHByb2dyYW1taW5nIHN0eWxlIGFuZCBwcmVmZXJlbmNlLCB0aGVyZSBpcyBub1xuICogY29ycmVjdCBhbnN3ZXIuXG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlclxuICovXG5jb25zdCBRdWVyeUJ1aWxkZXIgPSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5NZXNzYWdlc1F1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIG1lc3NhZ2VzXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5fVxuICAgKi9cbiAgbWVzc2FnZXMoKSB7XG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlc1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5Bbm5vdW5jZW1lbnRzUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgYW5ub3VuY2VtZW50c1xuICAgKiBAc3RhdGljXG4gICAqIEByZXR1cm5zIHtsYXllci5RdWVyeUJ1aWxkZXIuQW5ub3VuY2VtZW50c1F1ZXJ5fVxuICAgKi9cbiAgYW5ub3VuY2VtZW50cygpIHtcbiAgICByZXR1cm4gbmV3IEFubm91bmNlbWVudHNRdWVyeSgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uc1F1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnZlcnNhdGlvbnNcbiAgICogQHN0YXRpY1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuUXVlcnlCdWlsZGVyLkNvbnZlcnNhdGlvbnNRdWVyeX1cbiAgICovXG4gIGNvbnZlcnNhdGlvbnMoKSB7XG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb25zUXVlcnkoKTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGxheWVyLkNoYW5uZWxzUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgY2hhbm5lbHNcbiAgICogQHN0YXRpY1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuUXVlcnlCdWlsZGVyLkNoYW5uZWxzUXVlcnl9XG4gICAqL1xuICBjaGFubmVscygpIHtcbiAgICByZXR1cm4gbmV3IENoYW5uZWxzUXVlcnkoKTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGxheWVyLk1lbWJlcnNRdWVyeSBpbnN0YW5jZS5cbiAgICpcbiAgICogQG1ldGhvZCBtZW1iZXJzXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5NZW1iZXJzUXVlcnl9XG4gICAqL1xuICBtZW1iZXJzKCkge1xuICAgIHJldHVybiBuZXcgTWVtYmVyc1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5JZGVudGl0aWVzUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgaWRlbnRpdGllc1xuICAgKiBAc3RhdGljXG4gICAqIEByZXR1cm5zIHtsYXllci5RdWVyeUJ1aWxkZXIuSWRlbnRpdGllc1F1ZXJ5fVxuICAgKi9cbiAgaWRlbnRpdGllcygpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXRpZXNRdWVyeSgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUYWtlcyB0aGUgcmV0dXJuIHZhbHVlIG9mIFF1ZXJ5QnVpbGRlci5wcm90b3R5cGUuYnVpbGQgYW5kIGNyZWF0ZXMgYVxuICAgKiBuZXcgUXVlcnlCdWlsZGVyLlxuICAgKlxuICAgKiBVc2VkIHdpdGhpbiBsYXllci5RdWVyeS5wcm90b3R5cGUudG9CdWlsZGVyLlxuICAgKlxuICAgKiBAbWV0aG9kIGZyb21RdWVyeU9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gICAqIEBzdGF0aWNcbiAgICovXG4gIGZyb21RdWVyeU9iamVjdChvYmopIHtcbiAgICBzd2l0Y2ggKG9iai5tb2RlbCkge1xuICAgICAgY2FzZSBRdWVyeS5NZXNzYWdlOlxuICAgICAgICByZXR1cm4gbmV3IE1lc3NhZ2VzUXVlcnkob2JqKTtcbiAgICAgIGNhc2UgUXVlcnkuQW5ub3VuY2VtZW50OlxuICAgICAgICByZXR1cm4gbmV3IEFubm91bmNlbWVudHNRdWVyeShvYmopO1xuICAgICAgY2FzZSBRdWVyeS5Db252ZXJzYXRpb246XG4gICAgICAgIHJldHVybiBuZXcgQ29udmVyc2F0aW9uc1F1ZXJ5KG9iaik7XG4gICAgICBjYXNlIFF1ZXJ5LkNoYW5uZWw6XG4gICAgICAgIHJldHVybiBuZXcgQ2hhbm5lbHNRdWVyeShvYmopO1xuICAgICAgY2FzZSBRdWVyeS5JZGVudGl0eTpcbiAgICAgICAgcmV0dXJuIG5ldyBJZGVudGl0aWVzUXVlcnkob2JqKTtcbiAgICAgIGNhc2UgUXVlcnkuTWVtYmVyc2hpcDpcbiAgICAgICAgcmV0dXJuIG5ldyBNZW1iZXJzUXVlcnkob2JqKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSxcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVlcnlCdWlsZGVyO1xuXG4iXX0=
