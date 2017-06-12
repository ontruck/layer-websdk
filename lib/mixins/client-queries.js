'use strict';

/**
 *
 * Adds Query handling to the layer.Client.
 *
 * @class layer.mixins.ClientQueries
 */

var Query = require('../queries/query');
var IdentitiesQuery = require('../queries/identities-query');
var ConversationsQuery = require('../queries/conversations-query');
var ChannelsQuery = require('../queries/channels-query');
var MembersQuery = require('../queries/members-query');
var MessagesQuery = require('../queries/messages-query');
var AnnouncementsQuery = require('../queries/announcements-query');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.queries = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.queries).forEach(function (id) {
        var query = _this._models.queries[id];
        if (query && !query.isDestroyed) {
          query.destroy();
        }
      });
      this._models.queries = null;
    },
    reset: function reset() {
      this._models.queries = {};
    }
  },
  methods: {
    /**
     * Retrieve the query by query id.
     *
     * Useful for finding a Query when you only have the ID
     *
     * @method getQuery
     * @param  {string} id              - layer:///queries/uuid
     * @return {layer.Query}
     */
    getQuery: function getQuery(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      return this._models.queries[id] || null;
    },


    /**
     * There are two options to create a new layer.Query instance.
     *
     * The direct way:
     *
     *     var query = client.createQuery({
     *         model: layer.Query.Message,
     *         predicate: 'conversation.id = '' + conv.id + ''',
     *         paginationWindow: 50
     *     });
     *
     * A Builder approach that allows for a simpler syntax:
     *
     *     var qBuilder = QueryBuilder
     *      .messages()
     *      .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
     *      .paginationWindow(100);
     *     var query = client.createQuery(qBuilder);
     *
     * @method createQuery
     * @param  {layer.QueryBuilder|Object} options - Either a layer.QueryBuilder instance, or parameters for the layer.Query constructor
     * @return {layer.Query}
     */
    createQuery: function createQuery(options) {
      var query = void 0;

      if (typeof options.build === 'function') {
        options = options.build();
      }
      options.client = this;
      switch (options.model) {
        case Query.Identity:
          query = new IdentitiesQuery(options);
          break;
        case Query.Conversation:
          query = new ConversationsQuery(options);
          break;
        case Query.Channel:
          query = new ChannelsQuery(options);
          break;
        case Query.Membership:
          query = new MembersQuery(options);
          break;
        case Query.Message:
          query = new MessagesQuery(options);
          break;
        case Query.Announcement:
          query = new AnnouncementsQuery(options);
          break;

        default:
          query = new Query(options);
      }
      this._addQuery(query);
      return query;
    },


    /**
     * Register the layer.Query.
     *
     * @method _addQuery
     * @private
     * @param  {layer.Query} query
     */
    _addQuery: function _addQuery(query) {
      this._models.queries[query.id] = query;
    },


    /**
     * Deregister the layer.Query.
     *
     * @method _removeQuery
     * @private
     * @param  {layer.Query} query [description]
     */
    _removeQuery: function _removeQuery(query) {
      var _this2 = this;

      if (query) {
        delete this._models.queries[query.id];
        if (!this._inCleanup) {
          var data = query.data.map(function (obj) {
            return _this2.getObject(obj.id);
          }).filter(function (obj) {
            return obj;
          });
          this._checkAndPurgeCache(data);
        }
        this.off(null, null, query);
      }
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LXF1ZXJpZXMuanMiXSwibmFtZXMiOlsiUXVlcnkiLCJyZXF1aXJlIiwiSWRlbnRpdGllc1F1ZXJ5IiwiQ29udmVyc2F0aW9uc1F1ZXJ5IiwiQ2hhbm5lbHNRdWVyeSIsIk1lbWJlcnNRdWVyeSIsIk1lc3NhZ2VzUXVlcnkiLCJBbm5vdW5jZW1lbnRzUXVlcnkiLCJFcnJvckRpY3Rpb25hcnkiLCJkaWN0aW9uYXJ5IiwibW9kdWxlIiwiZXhwb3J0cyIsImV2ZW50cyIsImxpZmVjeWNsZSIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsIl9tb2RlbHMiLCJxdWVyaWVzIiwiY2xlYW51cCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiaWQiLCJxdWVyeSIsImlzRGVzdHJveWVkIiwiZGVzdHJveSIsInJlc2V0IiwibWV0aG9kcyIsImdldFF1ZXJ5IiwiRXJyb3IiLCJpZFBhcmFtUmVxdWlyZWQiLCJjcmVhdGVRdWVyeSIsImJ1aWxkIiwiY2xpZW50IiwibW9kZWwiLCJJZGVudGl0eSIsIkNvbnZlcnNhdGlvbiIsIkNoYW5uZWwiLCJNZW1iZXJzaGlwIiwiTWVzc2FnZSIsIkFubm91bmNlbWVudCIsIl9hZGRRdWVyeSIsIl9yZW1vdmVRdWVyeSIsIl9pbkNsZWFudXAiLCJkYXRhIiwibWFwIiwiZ2V0T2JqZWN0Iiwib2JqIiwiZmlsdGVyIiwiX2NoZWNrQW5kUHVyZ2VDYWNoZSIsIm9mZiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7OztBQU9BLElBQU1BLFFBQVFDLFFBQVEsa0JBQVIsQ0FBZDtBQUNBLElBQU1DLGtCQUFrQkQsUUFBUSw2QkFBUixDQUF4QjtBQUNBLElBQU1FLHFCQUFxQkYsUUFBUSxnQ0FBUixDQUEzQjtBQUNBLElBQU1HLGdCQUFnQkgsUUFBUSwyQkFBUixDQUF0QjtBQUNBLElBQU1JLGVBQWVKLFFBQVEsMEJBQVIsQ0FBckI7QUFDQSxJQUFNSyxnQkFBZ0JMLFFBQVEsMkJBQVIsQ0FBdEI7QUFD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QUNwQixjQUFNQyxPQUFPckIsTUFBTXFCLElBQU4sQ0FDVkMsR0FEVSxDQUNOO0FBQUEsbUJBQU8sT0FBS0MsU0FBTCxDQUFlQyxJQUFJekIsRUFBbkIsQ0FBUDtBQUFBLFdBRE0sRUFFVjBCLE1BRlUsQ0FFSDtBQUFBLG1CQUFPRCxHQUFQO0FBQUEsV0FGRyxDQUFiO0FBR0EsZUFBS0UsbUJBQUwsQ0FBeUJMLElBQXpCO0FBQ0Q7QUFDRCxhQUFLTSxHQUFMLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUIzQixLQUFyQjtBQUNEO0FBQ0Y7QUFyR007QUF0Qk0sQ0FBakIiLCJmaWxlIjoiY2xpZW50LXF1ZXJpZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqXG4gKiBBZGRzIFF1ZXJ5IGhhbmRsaW5nIHRvIHRoZSBsYXllci5DbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLm1peGlucy5DbGllbnRRdWVyaWVzXG4gKi9cblxuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuLi9xdWVyaWVzL3F1ZXJ5Jyk7XG5jb25zdCBJZGVudGl0aWVzUXVlcnkgPSByZXF1aXJlKCcuLi9xdWVyaWVzL2lkZW50aXRpZXMtcXVlcnknKTtcbmNvbnN0IENvbnZlcnNhdGlvbnNRdWVyeSA9IHJlcXVpcmUoJy4uL3F1ZXJpZXMvY29udmVyc2F0aW9ucy1xdWVyeScpO1xuY29uc3QgQ2hhbm5lbHNRdWVyeSA9IHJlcXVpcmUoJy4uL3F1ZXJpZXMvY2hhbm5lbHMtcXVlcnknKTtcbmNvbnN0IE1lbWJlcnNRdWVyeSA9IHJlcXVpcmUoJy4uL3F1ZXJpZXMvbWVtYmVycy1xdWVyeScpO1xuY29uc3QgTWVzc2FnZXNRdWVyeSA9IHJlcXVpcmUoJy4uL3F1ZXJpZXMvbWVzc2FnZXMtcXVlcnknKTtcbmNvbnN0IEFubm91bmNlbWVudHNRdWVyeSA9IHJlcXVpcmUoJy4uL3F1ZXJpZXMvYW5ub3VuY2VtZW50cy1xdWVyeScpO1xuY29uc3QgRXJyb3JEaWN0aW9uYXJ5ID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKS5kaWN0aW9uYXJ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXZlbnRzOiBbXG5cbiAgXSxcbiAgbGlmZWN5Y2xlOiB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgdGhpcy5fbW9kZWxzLnF1ZXJpZXMgPSB7fTtcbiAgICB9LFxuICAgIGNsZWFudXAoKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMucXVlcmllcykuZm9yRWFjaCgoaWQpID0+IHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLl9tb2RlbHMucXVlcmllc1tpZF07XG4gICAgICAgIGlmIChxdWVyeSAmJiAhcXVlcnkuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICBxdWVyeS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbW9kZWxzLnF1ZXJpZXMgPSBudWxsO1xuICAgIH0sXG4gICAgcmVzZXQoKSB7XG4gICAgICB0aGlzLl9tb2RlbHMucXVlcmllcyA9IHt9O1xuICAgIH0sXG5cbiAgfSxcbiAgbWV0aG9kczoge1xuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIHRoZSBxdWVyeSBieSBxdWVyeSBpZC5cbiAgICAgKlxuICAgICAqIFVzZWZ1bCBmb3IgZmluZGluZyBhIFF1ZXJ5IHdoZW4geW91IG9ubHkgaGF2ZSB0aGUgSURcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZ2V0UXVlcnlcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkICAgICAgICAgICAgICAtIGxheWVyOi8vL3F1ZXJpZXMvdXVpZFxuICAgICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fVxuICAgICAqL1xuICAgIGdldFF1ZXJ5KGlkKSB7XG4gICAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5xdWVyaWVzW2lkXSB8fCBudWxsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGVyZSBhcmUgdHdvIG9wdGlvbnMgdG8gY3JlYXRlIGEgbmV3IGxheWVyLlF1ZXJ5IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogVGhlIGRpcmVjdCB3YXk6XG4gICAgICpcbiAgICAgKiAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAgICAgKiAgICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZXNzYWdlLFxuICAgICAqICAgICAgICAgcHJlZGljYXRlOiAnY29udmVyc2F0aW9uLmlkID0gJycgKyBjb252LmlkICsgJycnLFxuICAgICAqICAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogNTBcbiAgICAgKiAgICAgfSk7XG4gICAgICpcbiAgICAgKiBBIEJ1aWxkZXIgYXBwcm9hY2ggdGhhdCBhbGxvd3MgZm9yIGEgc2ltcGxlciBzeW50YXg6XG4gICAgICpcbiAgICAgKiAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gICAgICogICAgICAubWVzc2FnZXMoKVxuICAgICAqICAgICAgLmZvckNvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnKVxuICAgICAqICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAgICAgKiAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgY3JlYXRlUXVlcnlcbiAgICAgKiBAcGFyYW0gIHtsYXllci5RdWVyeUJ1aWxkZXJ8T2JqZWN0fSBvcHRpb25zIC0gRWl0aGVyIGEgbGF5ZXIuUXVlcnlCdWlsZGVyIGluc3RhbmNlLCBvciBwYXJhbWV0ZXJzIGZvciB0aGUgbGF5ZXIuUXVlcnkgY29uc3RydWN0b3JcbiAgICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeX1cbiAgICAgKi9cbiAgICBjcmVhdGVRdWVyeShvcHRpb25zKSB7XG4gICAgICBsZXQgcXVlcnk7XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5idWlsZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucy5idWlsZCgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5jbGllbnQgPSB0aGlzO1xuICAgICAgc3dpdGNoIChvcHRpb25zLm1vZGVsKSB7XG4gICAgICAgIGNhc2UgUXVlcnkuSWRlbnRpdHk6XG4gICAgICAgICAgcXVlcnkgPSBuZXcgSWRlbnRpdGllc1F1ZXJ5KG9wdGlvbnMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFF1ZXJ5LkNvbnZlcnNhdGlvbjpcbiAgICAgICAgICBxdWVyeSA9IG5ldyBDb252ZXJzYXRpb25zUXVlcnkob3B0aW9ucyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgUXVlcnkuQ2hhbm5lbDpcbiAgICAgICAgICBxdWVyeSA9IG5ldyBDaGFubmVsc1F1ZXJ5KG9wdGlvbnMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFF1ZXJ5Lk1lbWJlcnNoaXA6XG4gICAgICAgICAgcXVlcnkgPSBuZXcgTWVtYmVyc1F1ZXJ5KG9wdGlvbnMpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFF1ZXJ5Lk1lc3NhZ2U6XG4gICAgICAgICAgcXVlcnkgPSBuZXcgTWVzc2FnZXNRdWVyeShvcHRpb25zKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBRdWVyeS5Bbm5vdW5jZW1lbnQ6XG4gICAgICAgICAgcXVlcnkgPSBuZXcgQW5ub3VuY2VtZW50c1F1ZXJ5KG9wdGlvbnMpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcXVlcnkgPSBuZXcgUXVlcnkob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9hZGRRdWVyeShxdWVyeSk7XG4gICAgICByZXR1cm4gcXVlcnk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIHRoZSBsYXllci5RdWVyeS5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgX2FkZFF1ZXJ5XG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0gIHtsYXllci5RdWVyeX0gcXVlcnlcbiAgICAgKi9cbiAgICBfYWRkUXVlcnkocXVlcnkpIHtcbiAgICAgIHRoaXMuX21vZGVscy5xdWVyaWVzW3F1ZXJ5LmlkXSA9IHF1ZXJ5O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEZXJlZ2lzdGVyIHRoZSBsYXllci5RdWVyeS5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgX3JlbW92ZVF1ZXJ5XG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0gIHtsYXllci5RdWVyeX0gcXVlcnkgW2Rlc2NyaXB0aW9uXVxuICAgICAqL1xuICAgIF9yZW1vdmVRdWVyeShxdWVyeSkge1xuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMucXVlcmllc1txdWVyeS5pZF07XG4gICAgICAgIGlmICghdGhpcy5faW5DbGVhbnVwKSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IHF1ZXJ5LmRhdGFcbiAgICAgICAgICAgIC5tYXAob2JqID0+IHRoaXMuZ2V0T2JqZWN0KG9iai5pZCkpXG4gICAgICAgICAgICAuZmlsdGVyKG9iaiA9PiBvYmopO1xuICAgICAgICAgIHRoaXMuX2NoZWNrQW5kUHVyZ2VDYWNoZShkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9mZihudWxsLCBudWxsLCBxdWVyeSk7XG4gICAgICB9XG4gICAgfSxcbiAgfSxcbn07XG4iXX0=
