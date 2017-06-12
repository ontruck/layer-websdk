'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Messages
 *
 *      var messageQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Message,
 *        predicate: 'conversation.id = "layer:///conversations/UUID"'
 *      });
 *
 * You can change the data selected by your query any time you want using:
 *
 *      query.update({
 *        predicate: 'channel.id = "layer:///channels/UUID2"'
 *      });
 *
 * You can release data held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### predicate
 *
 * Note that the `predicate` property is only supported for Messages and layer.Membership, and only supports
 * querying by Conversation or Channel:
 *
 * * `conversation.id = 'layer:///conversations/UUIUD'`
 * * `channel.id = 'layer:///channels/UUIUD'`
 *
 * @class  layer.MessagesQuery
 * @extends layer.Query
 */
var Root = require('../root');
var LayerError = require('../layer-error');
var Util = require('../client-utils');
var Logger = require('../logger');
var Query = require('./query');

var findConvIdRegex = new RegExp(/^conversation.id\s*=\s*['"]((layer:\/\/\/conversations\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);
var findChannelIdRegex = new RegExp(/^channel.id\s*=\s*['"]((layer:\/\/\/channels\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);

var MessagesQuery = function (_Query) {
  _inherits(MessagesQuery, _Query);

  function MessagesQuery() {
    _classCallCheck(this, MessagesQuery);

    return _possibleConstructorReturn(this, (MessagesQuery.__proto__ || Object.getPrototypeOf(MessagesQuery)).apply(this, arguments));
  }

  _createClass(MessagesQuery, [{
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      if (inValue === '') return '';
      if (inValue.indexOf('conversation.id') !== -1) {
        var conversationId = inValue.match(findConvIdRegex) ? inValue.replace(findConvIdRegex, '$1') : null;
        if (!conversationId) throw new Error(LayerError.dictionary.invalidPredicate);
        if (conversationId.indexOf('layer:///conversations/') !== 0) conversationId = 'layer:///conversations/' + conversationId;
        return 'conversation.id = \'' + conversationId + '\'';
      } else if (inValue.indexOf('channel.id') !== -1) {
        var channelId = inValue.match(findChannelIdRegex) ? inValue.replace(findChannelIdRegex, '$1') : null;
        if (!channelId) throw new Error(LayerError.dictionary.invalidPredicate);
        if (channelId.indexOf('layer:///channels/') !== 0) channelId = 'layer:///channels/' + channelId;
        return 'channel.id = \'' + channelId + '\'';
      } else {
        throw new Error(LayerError.dictionary.invalidPredicate);
      }
    }
  }, {
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var predicateIds = this._getConversationPredicateIds();

      // Do nothing if we don't have a conversation to query on
      if (!predicateIds) {
        if (this.predicate && !this.predicate.match(/['"]/)) {
          Logger.error('This query may need to quote its value');
        }
        return;
      }

      switch (predicateIds.type) {
        case Query.Conversation:
          this._fetchConversationMessages(pageSize, predicateIds);
          break;
        case Query.Channel:
          this._fetchChannelMessages(pageSize, predicateIds);
          break;
      }
    }
  }, {
    key: '_getSortField',
    value: function _getSortField() {
      return 'position';
    }

    /**
     * Get the Conversation UUID from the predicate property.
     *
     * Extract the Conversation's UUID from the predicate... or returned the cached value.
     *
     * @method _getConversationPredicateIds
     * @private
     */

  }, {
    key: '_getConversationPredicateIds',
    value: function _getConversationPredicateIds() {
      if (this.predicate.indexOf('conversation.id') !== -1) {
        if (this.predicate.match(findConvIdRegex)) {
          var conversationId = this.predicate.replace(findConvIdRegex, '$1');

          // We will already have a this._predicate if we are paging; else we need to extract the UUID from
          // the conversationId.
          var uuid = (this._predicate || conversationId).replace(/^layer:\/\/\/conversations\//, '');
          if (uuid) {
            return {
              uuid: uuid,
              id: conversationId,
              type: Query.Conversation
            };
          }
        }
      } else if (this.predicate.indexOf('channel.id') !== -1) {
        if (this.predicate.match(findChannelIdRegex)) {
          var channelId = this.predicate.replace(findChannelIdRegex, '$1');

          // We will already have a this._predicate if we are paging; else we need to extract the UUID from
          // the channelId.
          var _uuid = (this._predicate || channelId).replace(/^layer:\/\/\/channels\//, '');
          if (_uuid) {
            return {
              uuid: _uuid,
              id: channelId,
              type: Query.Channel
            };
          }
        }
      }
    }
  }, {
    key: '_fetchConversationMessages',
    value: function _fetchConversationMessages(pageSize, predicateIds) {
      var _this2 = this;

      var conversationId = 'layer:///conversations/' + predicateIds.uuid;
      if (!this._predicate) this._predicate = predicateIds.id;
      var conversation = this.client.getConversation(conversationId);

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadMessages(conversationId, this._nextDBFromId, pageSize, function (messages) {
        if (messages.length) _this2._appendResults({ data: messages }, true);
      });

      var newRequest = 'conversations/' + predicateIds.uuid + '/messages?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't query on unsaved conversations, nor repeat still firing queries
      if ((!conversation || conversation.isSaved()) && newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          telemetry: {
            name: 'message_query_time'
          },
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, newRequest, pageSize);
        });
      }

      // If there are no results, then its a new query; automatically populate it with the Conversation's lastMessage.
      if (this.data.length === 0) {
        if (conversation && conversation.lastMessage) {
          this.data = [this._getData(conversation.lastMessage)];
          // Trigger the change event
          this._triggerChange({
            type: 'data',
            data: [this._getData(conversation.lastMessage)],
            query: this,
            target: this.client
          });
        }
      }
    }
  }, {
    key: '_fetchChannelMessages',
    value: function _fetchChannelMessages(pageSize, predicateIds) {
      var _this3 = this;

      var channelId = 'layer:///channels/' + predicateIds.uuid;
      if (!this._predicate) this._predicate = predicateIds.id;
      var channel = this.client.getChannel(channelId);

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadMessages(channelId, this._nextDBFromId, pageSize, function (messages) {
        if (messages.length) _this3._appendResults({ data: messages }, true);
      });

      var newRequest = 'channels/' + predicateIds.uuid + '/messages?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't query on unsaved channels, nor repeat still firing queries
      if ((!channel || channel.isSaved()) && newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this3._processRunResults(results, newRequest, pageSize);
        });
      }
    }
  }, {
    key: '_appendResultsSplice',
    value: function _appendResultsSplice(item) {
      var data = this.data;
      var index = this._getInsertIndex(item, data);
      data.splice(index, 0, this._getData(item));
    }
  }, {
    key: '_getInsertIndex',
    value: function _getInsertIndex(message, data) {
      var index = void 0;
      for (index = 0; index < data.length; index++) {
        if (message.position > data[index].position) {
          break;
        }
      }
      return index;
    }
  }, {
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {
      switch (eventName) {

        // If a Conversation's ID has changed, check our predicate, and update it automatically if needed.
        case 'conversations:change':
          this._handleConvIdChangeEvent(evt);
          break;

        // If a Message has changed and its in our result set, replace
        // it with a new immutable object
        case 'messages:change':
        case 'messages:read':
          this._handleChangeEvent('messages', evt);
          break;

        // If Messages are added, and they aren't already in our result set
        // add them.
        case 'messages:add':
          this._handleAddEvent('messages', evt);
          break;

        // If a Message is deleted and its in our result set, remove it
        // and trigger an event
        case 'messages:remove':
          this._handleRemoveEvent('messages', evt);
          break;
      }
    }

    /**
     * A Conversation or Channel ID changes if a matching Distinct Conversation or named Channel was found on the server.
     *
     * If this Query's Conversation's ID has changed, update the predicate.
     *
     * @method _handleConvIdChangeEvent
     * @param {layer.LayerEvent} evt - A Message Change Event
     * @private
     */

  }, {
    key: '_handleConvIdChangeEvent',
    value: function _handleConvIdChangeEvent(evt) {
      var cidChanges = evt.getChangesFor('id');
      if (cidChanges.length) {
        if (this._predicate === cidChanges[0].oldValue) {
          this._predicate = cidChanges[0].newValue;
          this.predicate = "conversation.id = '" + this._predicate + "'";
          this._run();
        }
      }
    }

    /**
     * If the ID of the message has changed, then the position property has likely changed as well.
     *
     * This method tests to see if changes to the position property have impacted the message's position in the
     * data array... and updates the array if it has.
     *
     * @method _handlePositionChange
     * @private
     * @param {layer.LayerEvent} evt  A Message Change event
     * @param {number} index  Index of the message in the current data array
     * @return {boolean} True if a data was changed and a change event was emitted
     */

  }, {
    key: '_handlePositionChange',
    value: function _handlePositionChange(evt, index) {
      // If the message is not in the current data, then there is no change to our query results.
      if (index === -1) return false;

      // Create an array without our data item and then find out where the data item Should be inserted.
      // Note: we could just lookup the position in our current data array, but its too easy to introduce
      // errors where comparing this message to itself may yield index or index + 1.
      var newData = [].concat(_toConsumableArray(this.data.slice(0, index)), _toConsumableArray(this.data.slice(index + 1)));
      var newIndex = this._getInsertIndex(evt.target, newData);

      // If the data item goes in the same index as before, then there is no change to be handled here;
      // else insert the item at the right index, update this.data and fire a change event
      if (newIndex !== index) {
        newData.splice(newIndex, 0, this._getData(evt.target));
        this.data = newData;
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
        return true;
      }
      return false;
    }
  }, {
    key: '_handleChangeEvent',
    value: function _handleChangeEvent(name, evt) {
      var index = this._getIndex(evt.target.id);
      var positionChanges = evt.getChangesFor('position');

      // If there are position changes, handle them.  If all the changes are position changes,
      // exit when done.
      if (positionChanges.length) {
        if (this._handlePositionChange(evt, index)) {
          if (positionChanges.length === evt.changes.length) return;
          index = this._getIndex(evt.target.id); // Get the updated position
        }
      }

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }

    /*
     * Note: Earlier versions of this iterated over each item, inserted it and when all items were inserted,
     * triggered events indicating the index at which they were inserted.
     *
     * This caused the following problem:
     *
     * 1. Insert messages newest message at position 0 and second newest message at position 1
     * 2. Trigger events in the order they arrive: second newest gets inserted at index 1, newest gets inserted at index 0
     * 3. UI on receiving the second newest event does yet have the newest event, and on inserting it at position 1
     *    is actually inserting it at the wrong place because position 0 is occupied by an older message at this time.
     *
     * Solution: We must iterate over all items, and process them entirely one at a time.
     * Drawback: After an Event.replay we may get a lot of add events, we may need a way to do an event that inserts a set of messages
     * instead of triggering lots of individual rendering-causing events
     */

  }, {
    key: '_handleAddEvent',
    value: function _handleAddEvent(name, evt) {
      var _this4 = this;

      // Only use added messages that are part of this Conversation
      // and not already in our result set
      var list = evt[name]
      // Filter so that we only see Messages if doing a Messages query or Announcements if doing an Announcements Query.
      .filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'messages' && _this4.model === Query.Message || type === 'announcements' && _this4.model === Query.Announcement;
      }
      // Filter out Messages that aren't part of this Conversation
      ).filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'announcements' || message.conversationId === _this4._predicate;
      }
      // Filter out Messages that are already in our data set
      ).filter(function (message) {
        return _this4._getIndex(message.id) === -1;
      }).map(function (message) {
        return _this4._getData(message);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        var data = this.data = this.dataType === Query.ObjectDataType ? [].concat(this.data) : this.data;
        list.forEach(function (item) {
          var index = _this4._getInsertIndex(item, data);
          data.splice(index, 0, item);
          if (index !== 0) Logger.warn('Index of ' + item.id + ' is ' + index + '; position is ' + item.position + '; compared to ' + data[0].position);

          _this4.totalSize += 1;

          _this4._triggerChange({
            type: 'insert',
            target: item,
            query: _this4,
            index: index
          });
        });
      }
    }
  }, {
    key: '_handleRemoveEvent',
    value: function _handleRemoveEvent(name, evt) {
      var _this5 = this;

      var removed = [];
      evt[name].forEach(function (message) {
        var index = _this5._getIndex(message.id);
        if (index !== -1) {
          if (message.id === _this5._nextDBFromId) _this5._nextDBFromId = _this5._updateNextFromId(index);
          if (message.id === _this5._nextServerFromId) _this5._nextServerFromId = _this5._updateNextFromId(index);
          removed.push({
            data: message,
            index: index
          });
          if (_this5.dataType === Query.ObjectDataType) {
            _this5.data = [].concat(_toConsumableArray(_this5.data.slice(0, index)), _toConsumableArray(_this5.data.slice(index + 1)));
          } else {
            _this5.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this5._triggerChange({
          type: 'remove',
          target: _this5._getData(removedObj.data),
          index: removedObj.index,
          query: _this5
        });
      });
    }
  }]);

  return MessagesQuery;
}(Query);

MessagesQuery._supportedEvents = [].concat(Query._supportedEvents);

MessagesQuery.MaxPageSize = 100;

MessagesQuery.prototype.model = Query.Message;

Root.initClass.apply(MessagesQuery, [MessagesQuery, 'MessagesQuery']);

module.exports = MessagesQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL21lc3NhZ2VzLXF1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJMb2dnZXIiLCJRdWVyeSIsImZpbmRDb252SWRSZWdleCIsIlJlZ0V4cCIsImZpbmRDaGFubmVsSWRSZWdleCIsIk1lc3NhZ2VzUXVlcnkiLCJpblZhbHVlIiwiaW5kZXhPZiIsImNvbnZlcnNhdGlvbklkIiwibWF0Y2giLCJyZXBsYWNlIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiaW52YWxpZFByZWRpY2F0ZSIsImNoYW5uZWxJZCIsInBhZ2VTaXplIiwicHJlZGljYXRlSWRzIiwiX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcyIsInByZWRpY2F0ZSIsImVycm9yIiwidHlwZSIsIkNvbnZlcnNhdGlvbiIsIl9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzIiwiQ2hhbm5lbCIsIl9mZXRjaENoYW5uZWxNZXNzYWdlcyIsInV1aWQiLCJfcHJlZGljYXRlIiwiaWQiLCJjb252ZXJzYXRpb24iLCJjbGllbnQiLCJnZXRDb252ZXJzYXRpb24iLCJkYk1hbmFnZXIiLCJsb2FkTWVzc2FnZXMiLCJfbmV4dERCRnJvbUlkIiwibWVzc2FnZXMiLCJsZW5ndGgiLCJfYXBwZW5kUmVzdWx0cyIsImRhdGEiLCJuZXdSZXF1ZXN0IiwiX25leHRTZXJ2ZXJGcm9tSWQiLCJpc1NhdmVkIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0ZpcmluZyIsInhociIsInRlbGVtZXRyeSIsIm5hbWUiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsImxhc3RNZXNzYWdlIiwiX2dldERhdGEiLCJfdHJpZ2dlckNoYW5nZSIsInF1ZXJ5IiwidGFyZ2V0IiwiY2hhbm5lbCIsImdldENoYW5uZWwiLCJpdGVtIiwiaW5kZXgiLCJfZ2V0SW5zZXJ0SW5kZXgiLCJzcGxpY2UiLCJtZXNzYWdlIiwicG9zaXRpb24iLCJldmVudE5hbWUiLCJldnQiLCJfaGFuZGxlQ29udklkQ2hhbmdlRXZlbnQiLCJfaGFuZGxlQ2hhbmdlRXZlbnQiLCJfaGFuZGxlQWRkRXZlbnQiLCJfaGFuZGxlUmVtb3ZlRXZlbnQiLCJjaWRDaGFuZ2VzIiwiZ2V0Q2hhbmdlc0ZvciIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJfcnVuIiwibmV3RGF0YSIsInNsaWNlIiwibmV3SW5kZXgiLCJpc0NoYW5nZSIsImNoYW5nZXMiLCJfZ2V0SW5kZXgiLCJwb3NpdGlvbkNoYW5nZXMiLCJfaGFuZGxlUG9zaXRpb25DaGFuZ2UiLCJkYXRhVHlwZSIsIk9iamVjdERhdGFUeXBlIiwidG9PYmplY3QiLCJsaXN0IiwiZmlsdGVyIiwidHlwZUZyb21JRCIsIm1vZGVsIiwiTWVzc2FnZSIsIkFubm91bmNlbWVudCIsIm1hcCIsImNvbmNhdCIsImZvckVhY2giLCJ3YXJuIiwidG90YWxTaXplIiwicmVtb3ZlZCIsIl91cGRhdGVOZXh0RnJvbUlkIiwicHVzaCIsInJlbW92ZWRPYmoiLCJfc3VwcG9ydGVkRXZlbnRzIiwiTWF4UGFnZVNpemUiLCJwcm90b3R5cGUiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE4QkEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxhQUFhRCxRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTUUsT0FBT0YsUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTUcsU0FBU0gsUUFBUSxXQUFSLENBQWY7QUFDQSxJQUFNSSxRQUFRSixRQUFRLFNBQVIsQ0FBZDs7QUFFQSxJQUFNSyxrQkFBa0IsSUFBSUMsTUFBSixDQUN0QiwyRkFEc0IsQ0FBeEI7QUFFQSxJQUFNQyxxQkFBcUIsSUFBSUQsTUFBSixDQUN6QixpRkFEeUIsQ0FBM0I7O0lBR01FLGE7Ozs7Ozs7Ozs7O2tDQUNVQyxP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QWQsQ0FBd0JkLEtBQXhCLEdBQWdDeEYsTUFBTXlGLE9BQXRDOztBQUVBOUYsS0FBSzRHLFNBQUwsQ0FBZUMsS0FBZixDQUFxQnBHLGFBQXJCLEVBQW9DLENBQUNBLGFBQUQsRUFBZ0IsZUFBaEIsQ0FBcEM7O0FBRUFxRyxPQUFPQyxPQUFQLEdBQWlCdEcsYUFBakIiLCJmaWxlIjoibWVzc2FnZXMtcXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFF1ZXJ5IGNsYXNzIGZvciBydW5uaW5nIGEgUXVlcnkgb24gTWVzc2FnZXNcbiAqXG4gKiAgICAgIHZhciBtZXNzYWdlUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZXNzYWdlLFxuICogICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbi5pZCA9IFwibGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9VVUlEXCInXG4gKiAgICAgIH0pO1xuICpcbiAqIFlvdSBjYW4gY2hhbmdlIHRoZSBkYXRhIHNlbGVjdGVkIGJ5IHlvdXIgcXVlcnkgYW55IHRpbWUgeW91IHdhbnQgdXNpbmc6XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe1xuICogICAgICAgIHByZWRpY2F0ZTogJ2NoYW5uZWwuaWQgPSBcImxheWVyOi8vL2NoYW5uZWxzL1VVSUQyXCInXG4gKiAgICAgIH0pO1xuICpcbiAqIFlvdSBjYW4gcmVsZWFzZSBkYXRhIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqICMjIyMgcHJlZGljYXRlXG4gKlxuICogTm90ZSB0aGF0IHRoZSBgcHJlZGljYXRlYCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgTWVzc2FnZXMgYW5kIGxheWVyLk1lbWJlcnNoaXAsIGFuZCBvbmx5IHN1cHBvcnRzXG4gKiBxdWVyeWluZyBieSBDb252ZXJzYXRpb24gb3IgQ2hhbm5lbDpcbiAqXG4gKiAqIGBjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9VVUlVRCdgXG4gKiAqIGBjaGFubmVsLmlkID0gJ2xheWVyOi8vL2NoYW5uZWxzL1VVSVVEJ2BcbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lc3NhZ2VzUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5XG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5cbmNvbnN0IGZpbmRDb252SWRSZWdleCA9IG5ldyBSZWdFeHAoXG4gIC9eY29udmVyc2F0aW9uLmlkXFxzKj1cXHMqWydcIl0oKGxheWVyOlxcL1xcL1xcL2NvbnZlcnNhdGlvbnNcXC8pPy57OH0tLns0fS0uezR9LS57NH0tLnsxMn0pWydcIl0kLyk7XG5jb25zdCBmaW5kQ2hhbm5lbElkUmVnZXggPSBuZXcgUmVnRXhwKFxuICAvXmNoYW5uZWwuaWRcXHMqPVxccypbJ1wiXSgobGF5ZXI6XFwvXFwvXFwvY2hhbm5lbHNcXC8pPy57OH0tLns0fS0uezR9LS57NH0tLnsxMn0pWydcIl0kLyk7XG5cbmNsYXNzIE1lc3NhZ2VzUXVlcnkgZXh0ZW5kcyBRdWVyeSB7XG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIGlmIChpblZhbHVlID09PSAnJykgcmV0dXJuICcnO1xuICAgIGlmIChpblZhbHVlLmluZGV4T2YoJ2NvbnZlcnNhdGlvbi5pZCcpICE9PSAtMSkge1xuICAgICAgbGV0IGNvbnZlcnNhdGlvbklkID0gaW5WYWx1ZS5tYXRjaChmaW5kQ29udklkUmVnZXgpID8gaW5WYWx1ZS5yZXBsYWNlKGZpbmRDb252SWRSZWdleCwgJyQxJykgOiBudWxsO1xuICAgICAgaWYgKCFjb252ZXJzYXRpb25JZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb25JZC5pbmRleE9mKCdsYXllcjovLy9jb252ZXJzYXRpb25zLycpICE9PSAwKSBjb252ZXJzYXRpb25JZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLycgKyBjb252ZXJzYXRpb25JZDtcbiAgICAgIHJldHVybiBgY29udmVyc2F0aW9uLmlkID0gJyR7Y29udmVyc2F0aW9uSWR9J2A7XG4gICAgfSBlbHNlIGlmIChpblZhbHVlLmluZGV4T2YoJ2NoYW5uZWwuaWQnKSAhPT0gLTEpIHtcbiAgICAgIGxldCBjaGFubmVsSWQgPSBpblZhbHVlLm1hdGNoKGZpbmRDaGFubmVsSWRSZWdleCkgPyBpblZhbHVlLnJlcGxhY2UoZmluZENoYW5uZWxJZFJlZ2V4LCAnJDEnKSA6IG51bGw7XG4gICAgICBpZiAoIWNoYW5uZWxJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjaGFubmVsSWQuaW5kZXhPZignbGF5ZXI6Ly8vY2hhbm5lbHMvJykgIT09IDApIGNoYW5uZWxJZCA9ICdsYXllcjovLy9jaGFubmVscy8nICsgY2hhbm5lbElkO1xuICAgICAgcmV0dXJuIGBjaGFubmVsLmlkID0gJyR7Y2hhbm5lbElkfSdgO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmludmFsaWRQcmVkaWNhdGUpO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHByZWRpY2F0ZUlkcyA9IHRoaXMuX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpO1xuXG4gICAgLy8gRG8gbm90aGluZyBpZiB3ZSBkb24ndCBoYXZlIGEgY29udmVyc2F0aW9uIHRvIHF1ZXJ5IG9uXG4gICAgaWYgKCFwcmVkaWNhdGVJZHMpIHtcbiAgICAgIGlmICh0aGlzLnByZWRpY2F0ZSAmJiAhdGhpcy5wcmVkaWNhdGUubWF0Y2goL1snXCJdLykpIHtcbiAgICAgICAgTG9nZ2VyLmVycm9yKCdUaGlzIHF1ZXJ5IG1heSBuZWVkIHRvIHF1b3RlIGl0cyB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN3aXRjaCAocHJlZGljYXRlSWRzLnR5cGUpIHtcbiAgICAgIGNhc2UgUXVlcnkuQ29udmVyc2F0aW9uOlxuICAgICAgICB0aGlzLl9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzKHBhZ2VTaXplLCBwcmVkaWNhdGVJZHMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgUXVlcnkuQ2hhbm5lbDpcbiAgICAgICAgdGhpcy5fZmV0Y2hDaGFubmVsTWVzc2FnZXMocGFnZVNpemUsIHByZWRpY2F0ZUlkcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTb3J0RmllbGQoKSB7XG4gICAgcmV0dXJuICdwb3NpdGlvbic7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBDb252ZXJzYXRpb24gVVVJRCBmcm9tIHRoZSBwcmVkaWNhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEV4dHJhY3QgdGhlIENvbnZlcnNhdGlvbidzIFVVSUQgZnJvbSB0aGUgcHJlZGljYXRlLi4uIG9yIHJldHVybmVkIHRoZSBjYWNoZWQgdmFsdWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpIHtcbiAgICBpZiAodGhpcy5wcmVkaWNhdGUuaW5kZXhPZignY29udmVyc2F0aW9uLmlkJykgIT09IC0xKSB7XG4gICAgICBpZiAodGhpcy5wcmVkaWNhdGUubWF0Y2goZmluZENvbnZJZFJlZ2V4KSkge1xuICAgICAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IHRoaXMucHJlZGljYXRlLnJlcGxhY2UoZmluZENvbnZJZFJlZ2V4LCAnJDEnKTtcblxuICAgICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAgIC8vIHRoZSBjb252ZXJzYXRpb25JZC5cbiAgICAgICAgY29uc3QgdXVpZCA9ICh0aGlzLl9wcmVkaWNhdGUgfHwgY29udmVyc2F0aW9uSWQpLnJlcGxhY2UoL15sYXllcjpcXC9cXC9cXC9jb252ZXJzYXRpb25zXFwvLywgJycpO1xuICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgaWQ6IGNvbnZlcnNhdGlvbklkLFxuICAgICAgICAgICAgdHlwZTogUXVlcnkuQ29udmVyc2F0aW9uLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMucHJlZGljYXRlLmluZGV4T2YoJ2NoYW5uZWwuaWQnKSAhPT0gLTEpIHtcbiAgICAgIGlmICh0aGlzLnByZWRpY2F0ZS5tYXRjaChmaW5kQ2hhbm5lbElkUmVnZXgpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IHRoaXMucHJlZGljYXRlLnJlcGxhY2UoZmluZENoYW5uZWxJZFJlZ2V4LCAnJDEnKTtcblxuICAgICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAgIC8vIHRoZSBjaGFubmVsSWQuXG4gICAgICAgIGNvbnN0IHV1aWQgPSAodGhpcy5fcHJlZGljYXRlIHx8IGNoYW5uZWxJZCkucmVwbGFjZSgvXmxheWVyOlxcL1xcL1xcL2NoYW5uZWxzXFwvLywgJycpO1xuICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgaWQ6IGNoYW5uZWxJZCxcbiAgICAgICAgICAgIHR5cGU6IFF1ZXJ5LkNoYW5uZWwsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzKHBhZ2VTaXplLCBwcmVkaWNhdGVJZHMpIHtcbiAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLycgKyBwcmVkaWNhdGVJZHMudXVpZDtcbiAgICBpZiAoIXRoaXMuX3ByZWRpY2F0ZSkgdGhpcy5fcHJlZGljYXRlID0gcHJlZGljYXRlSWRzLmlkO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCk7XG5cbiAgICAvLyBSZXRyaWV2ZSBkYXRhIGZyb20gZGIgY2FjaGUgaW4gcGFyYWxsZWwgd2l0aCBsb2FkaW5nIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY29udmVyc2F0aW9ucy8ke3ByZWRpY2F0ZUlkcy51dWlkfS9tZXNzYWdlcz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcXVlcnkgb24gdW5zYXZlZCBjb252ZXJzYXRpb25zLCBub3IgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKCghY29udmVyc2F0aW9uIHx8IGNvbnZlcnNhdGlvbi5pc1NhdmVkKCkpICYmIG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB0ZWxlbWV0cnk6IHtcbiAgICAgICAgICBuYW1lOiAnbWVzc2FnZV9xdWVyeV90aW1lJyxcbiAgICAgICAgfSxcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgbm8gcmVzdWx0cywgdGhlbiBpdHMgYSBuZXcgcXVlcnk7IGF1dG9tYXRpY2FsbHkgcG9wdWxhdGUgaXQgd2l0aCB0aGUgQ29udmVyc2F0aW9uJ3MgbGFzdE1lc3NhZ2UuXG4gICAgaWYgKHRoaXMuZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgIGlmIChjb252ZXJzYXRpb24gJiYgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFt0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSldO1xuICAgICAgICAvLyBUcmlnZ2VyIHRoZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgdHlwZTogJ2RhdGEnLFxuICAgICAgICAgIGRhdGE6IFt0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSldLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mZXRjaENoYW5uZWxNZXNzYWdlcyhwYWdlU2l6ZSwgcHJlZGljYXRlSWRzKSB7XG4gICAgY29uc3QgY2hhbm5lbElkID0gJ2xheWVyOi8vL2NoYW5uZWxzLycgKyBwcmVkaWNhdGVJZHMudXVpZDtcbiAgICBpZiAoIXRoaXMuX3ByZWRpY2F0ZSkgdGhpcy5fcHJlZGljYXRlID0gcHJlZGljYXRlSWRzLmlkO1xuICAgIGNvbnN0IGNoYW5uZWwgPSB0aGlzLmNsaWVudC5nZXRDaGFubmVsKGNoYW5uZWxJZCk7XG5cbiAgICAvLyBSZXRyaWV2ZSBkYXRhIGZyb20gZGIgY2FjaGUgaW4gcGFyYWxsZWwgd2l0aCBsb2FkaW5nIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZE1lc3NhZ2VzKGNoYW5uZWxJZCwgdGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICBpZiAobWVzc2FnZXMubGVuZ3RoKSB0aGlzLl9hcHBlbmRSZXN1bHRzKHsgZGF0YTogbWVzc2FnZXMgfSwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGNoYW5uZWxzLyR7cHJlZGljYXRlSWRzLnV1aWR9L21lc3NhZ2VzP3BhZ2Vfc2l6ZT0ke3BhZ2VTaXplfWAgK1xuICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICAvLyBEb24ndCBxdWVyeSBvbiB1bnNhdmVkIGNoYW5uZWxzLCBub3IgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKCghY2hhbm5lbCB8fCBjaGFubmVsLmlzU2F2ZWQoKSkgJiYgbmV3UmVxdWVzdCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCkge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHVybDogbmV3UmVxdWVzdCxcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICB9LCByZXN1bHRzID0+IHRoaXMuX3Byb2Nlc3NSdW5SZXN1bHRzKHJlc3VsdHMsIG5ld1JlcXVlc3QsIHBhZ2VTaXplKSk7XG4gICAgfVxuICB9XG5cbiAgX2FwcGVuZFJlc3VsdHNTcGxpY2UoaXRlbSkge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbnNlcnRJbmRleChpdGVtLCBkYXRhKTtcbiAgICBkYXRhLnNwbGljZShpbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuICBfZ2V0SW5zZXJ0SW5kZXgobWVzc2FnZSwgZGF0YSkge1xuICAgIGxldCBpbmRleDtcbiAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBkYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgaWYgKG1lc3NhZ2UucG9zaXRpb24gPiBkYXRhW2luZGV4XS5wb3NpdGlvbikge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluZGV4O1xuICB9XG5cblxuICBfaGFuZGxlRXZlbnRzKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgc3dpdGNoIChldmVudE5hbWUpIHtcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24ncyBJRCBoYXMgY2hhbmdlZCwgY2hlY2sgb3VyIHByZWRpY2F0ZSwgYW5kIHVwZGF0ZSBpdCBhdXRvbWF0aWNhbGx5IGlmIG5lZWRlZC5cbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ29udklkQ2hhbmdlRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgTWVzc2FnZSBoYXMgY2hhbmdlZCBhbmQgaXRzIGluIG91ciByZXN1bHQgc2V0LCByZXBsYWNlXG4gICAgICAvLyBpdCB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgIGNhc2UgJ21lc3NhZ2VzOmNoYW5nZSc6XG4gICAgICBjYXNlICdtZXNzYWdlczpyZWFkJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ2hhbmdlRXZlbnQoJ21lc3NhZ2VzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIE1lc3NhZ2VzIGFyZSBhZGRlZCwgYW5kIHRoZXkgYXJlbid0IGFscmVhZHkgaW4gb3VyIHJlc3VsdCBzZXRcbiAgICAgIC8vIGFkZCB0aGVtLlxuICAgICAgY2FzZSAnbWVzc2FnZXM6YWRkJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQWRkRXZlbnQoJ21lc3NhZ2VzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgTWVzc2FnZSBpcyBkZWxldGVkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlbW92ZSBpdFxuICAgICAgLy8gYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ21lc3NhZ2VzOnJlbW92ZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZVJlbW92ZUV2ZW50KCdtZXNzYWdlcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIENvbnZlcnNhdGlvbiBvciBDaGFubmVsIElEIGNoYW5nZXMgaWYgYSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gb3IgbmFtZWQgQ2hhbm5lbCB3YXMgZm91bmQgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogSWYgdGhpcyBRdWVyeSdzIENvbnZlcnNhdGlvbidzIElEIGhhcyBjaGFuZ2VkLCB1cGRhdGUgdGhlIHByZWRpY2F0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ29udklkQ2hhbmdlRXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgLSBBIE1lc3NhZ2UgQ2hhbmdlIEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFuZGxlQ29udklkQ2hhbmdlRXZlbnQoZXZ0KSB7XG4gICAgY29uc3QgY2lkQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdpZCcpO1xuICAgIGlmIChjaWRDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgaWYgKHRoaXMuX3ByZWRpY2F0ZSA9PT0gY2lkQ2hhbmdlc1swXS5vbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLl9wcmVkaWNhdGUgPSBjaWRDaGFuZ2VzWzBdLm5ld1ZhbHVlO1xuICAgICAgICB0aGlzLnByZWRpY2F0ZSA9IFwiY29udmVyc2F0aW9uLmlkID0gJ1wiICsgdGhpcy5fcHJlZGljYXRlICsgXCInXCI7XG4gICAgICAgIHRoaXMuX3J1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgSUQgb2YgdGhlIG1lc3NhZ2UgaGFzIGNoYW5nZWQsIHRoZW4gdGhlIHBvc2l0aW9uIHByb3BlcnR5IGhhcyBsaWtlbHkgY2hhbmdlZCBhcyB3ZWxsLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCB0ZXN0cyB0byBzZWUgaWYgY2hhbmdlcyB0byB0aGUgcG9zaXRpb24gcHJvcGVydHkgaGF2ZSBpbXBhY3RlZCB0aGUgbWVzc2FnZSdzIHBvc2l0aW9uIGluIHRoZVxuICAgKiBkYXRhIGFycmF5Li4uIGFuZCB1cGRhdGVzIHRoZSBhcnJheSBpZiBpdCBoYXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBvc2l0aW9uQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0ICBBIE1lc3NhZ2UgQ2hhbmdlIGV2ZW50XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAgSW5kZXggb2YgdGhlIG1lc3NhZ2UgaW4gdGhlIGN1cnJlbnQgZGF0YSBhcnJheVxuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGEgZGF0YSB3YXMgY2hhbmdlZCBhbmQgYSBjaGFuZ2UgZXZlbnQgd2FzIGVtaXR0ZWRcbiAgICovXG4gIF9oYW5kbGVQb3NpdGlvbkNoYW5nZShldnQsIGluZGV4KSB7XG4gICAgLy8gSWYgdGhlIG1lc3NhZ2UgaXMgbm90IGluIHRoZSBjdXJyZW50IGRhdGEsIHRoZW4gdGhlcmUgaXMgbm8gY2hhbmdlIHRvIG91ciBxdWVyeSByZXN1bHRzLlxuICAgIGlmIChpbmRleCA9PT0gLTEpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIENyZWF0ZSBhbiBhcnJheSB3aXRob3V0IG91ciBkYXRhIGl0ZW0gYW5kIHRoZW4gZmluZCBvdXQgd2hlcmUgdGhlIGRhdGEgaXRlbSBTaG91bGQgYmUgaW5zZXJ0ZWQuXG4gICAgLy8gTm90ZTogd2UgY291bGQganVzdCBsb29rdXAgdGhlIHBvc2l0aW9uIGluIG91ciBjdXJyZW50IGRhdGEgYXJyYXksIGJ1dCBpdHMgdG9vIGVhc3kgdG8gaW50cm9kdWNlXG4gICAgLy8gZXJyb3JzIHdoZXJlIGNvbXBhcmluZyB0aGlzIG1lc3NhZ2UgdG8gaXRzZWxmIG1heSB5aWVsZCBpbmRleCBvciBpbmRleCArIDEuXG4gICAgY29uc3QgbmV3RGF0YSA9IFtcbiAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICBdO1xuICAgIGNvbnN0IG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoZXZ0LnRhcmdldCwgbmV3RGF0YSk7XG5cbiAgICAvLyBJZiB0aGUgZGF0YSBpdGVtIGdvZXMgaW4gdGhlIHNhbWUgaW5kZXggYXMgYmVmb3JlLCB0aGVuIHRoZXJlIGlzIG5vIGNoYW5nZSB0byBiZSBoYW5kbGVkIGhlcmU7XG4gICAgLy8gZWxzZSBpbnNlcnQgdGhlIGl0ZW0gYXQgdGhlIHJpZ2h0IGluZGV4LCB1cGRhdGUgdGhpcy5kYXRhIGFuZCBmaXJlIGEgY2hhbmdlIGV2ZW50XG4gICAgaWYgKG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgbmV3RGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCkpO1xuICAgICAgdGhpcy5kYXRhID0gbmV3RGF0YTtcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfaGFuZGxlQ2hhbmdlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG4gICAgY29uc3QgcG9zaXRpb25DaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3Bvc2l0aW9uJyk7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgcG9zaXRpb24gY2hhbmdlcywgaGFuZGxlIHRoZW0uICBJZiBhbGwgdGhlIGNoYW5nZXMgYXJlIHBvc2l0aW9uIGNoYW5nZXMsXG4gICAgLy8gZXhpdCB3aGVuIGRvbmUuXG4gICAgaWYgKHBvc2l0aW9uQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgIGlmICh0aGlzLl9oYW5kbGVQb3NpdGlvbkNoYW5nZShldnQsIGluZGV4KSkge1xuICAgICAgICBpZiAocG9zaXRpb25DaGFuZ2VzLmxlbmd0aCA9PT0gZXZ0LmNoYW5nZXMubGVuZ3RoKSByZXR1cm47XG4gICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7IC8vIEdldCB0aGUgdXBkYXRlZCBwb3NpdGlvblxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgICAgICBldnQudGFyZ2V0LnRvT2JqZWN0KCksXG4gICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogTm90ZTogRWFybGllciB2ZXJzaW9ucyBvZiB0aGlzIGl0ZXJhdGVkIG92ZXIgZWFjaCBpdGVtLCBpbnNlcnRlZCBpdCBhbmQgd2hlbiBhbGwgaXRlbXMgd2VyZSBpbnNlcnRlZCxcbiAgICogdHJpZ2dlcmVkIGV2ZW50cyBpbmRpY2F0aW5nIHRoZSBpbmRleCBhdCB3aGljaCB0aGV5IHdlcmUgaW5zZXJ0ZWQuXG4gICAqXG4gICAqIFRoaXMgY2F1c2VkIHRoZSBmb2xsb3dpbmcgcHJvYmxlbTpcbiAgICpcbiAgICogMS4gSW5zZXJ0IG1lc3NhZ2VzIG5ld2VzdCBtZXNzYWdlIGF0IHBvc2l0aW9uIDAgYW5kIHNlY29uZCBuZXdlc3QgbWVzc2FnZSBhdCBwb3NpdGlvbiAxXG4gICAqIDIuIFRyaWdnZXIgZXZlbnRzIGluIHRoZSBvcmRlciB0aGV5IGFycml2ZTogc2Vjb25kIG5ld2VzdCBnZXRzIGluc2VydGVkIGF0IGluZGV4IDEsIG5ld2VzdCBnZXRzIGluc2VydGVkIGF0IGluZGV4IDBcbiAgICogMy4gVUkgb24gcmVjZWl2aW5nIHRoZSBzZWNvbmQgbmV3ZXN0IGV2ZW50IGRvZXMgeWV0IGhhdmUgdGhlIG5ld2VzdCBldmVudCwgYW5kIG9uIGluc2VydGluZyBpdCBhdCBwb3NpdGlvbiAxXG4gICAqICAgIGlzIGFjdHVhbGx5IGluc2VydGluZyBpdCBhdCB0aGUgd3JvbmcgcGxhY2UgYmVjYXVzZSBwb3NpdGlvbiAwIGlzIG9jY3VwaWVkIGJ5IGFuIG9sZGVyIG1lc3NhZ2UgYXQgdGhpcyB0aW1lLlxuICAgKlxuICAgKiBTb2x1dGlvbjogV2UgbXVzdCBpdGVyYXRlIG92ZXIgYWxsIGl0ZW1zLCBhbmQgcHJvY2VzcyB0aGVtIGVudGlyZWx5IG9uZSBhdCBhIHRpbWUuXG4gICAqIERyYXdiYWNrOiBBZnRlciBhbiBFdmVudC5yZXBsYXkgd2UgbWF5IGdldCBhIGxvdCBvZiBhZGQgZXZlbnRzLCB3ZSBtYXkgbmVlZCBhIHdheSB0byBkbyBhbiBldmVudCB0aGF0IGluc2VydHMgYSBzZXQgb2YgbWVzc2FnZXNcbiAgICogaW5zdGVhZCBvZiB0cmlnZ2VyaW5nIGxvdHMgb2YgaW5kaXZpZHVhbCByZW5kZXJpbmctY2F1c2luZyBldmVudHNcbiAgICovXG4gIF9oYW5kbGVBZGRFdmVudChuYW1lLCBldnQpIHtcbiAgICAvLyBPbmx5IHVzZSBhZGRlZCBtZXNzYWdlcyB0aGF0IGFyZSBwYXJ0IG9mIHRoaXMgQ29udmVyc2F0aW9uXG4gICAgLy8gYW5kIG5vdCBhbHJlYWR5IGluIG91ciByZXN1bHQgc2V0XG4gICAgY29uc3QgbGlzdCA9IGV2dFtuYW1lXVxuICAgICAgLy8gRmlsdGVyIHNvIHRoYXQgd2Ugb25seSBzZWUgTWVzc2FnZXMgaWYgZG9pbmcgYSBNZXNzYWdlcyBxdWVyeSBvciBBbm5vdW5jZW1lbnRzIGlmIGRvaW5nIGFuIEFubm91bmNlbWVudHMgUXVlcnkuXG4gICAgICAuZmlsdGVyKChtZXNzYWdlKSA9PiB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBVdGlsLnR5cGVGcm9tSUQobWVzc2FnZS5pZCk7XG4gICAgICAgIHJldHVybiAodHlwZSA9PT0gJ21lc3NhZ2VzJyAmJiB0aGlzLm1vZGVsID09PSBRdWVyeS5NZXNzYWdlKSB8fFxuICAgICAgICAgICAgICAgICh0eXBlID09PSAnYW5ub3VuY2VtZW50cycgJiYgdGhpcy5tb2RlbCA9PT0gUXVlcnkuQW5ub3VuY2VtZW50KTtcbiAgICAgIH0pXG4gICAgICAvLyBGaWx0ZXIgb3V0IE1lc3NhZ2VzIHRoYXQgYXJlbid0IHBhcnQgb2YgdGhpcyBDb252ZXJzYXRpb25cbiAgICAgIC5maWx0ZXIoKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgY29uc3QgdHlwZSA9IFV0aWwudHlwZUZyb21JRChtZXNzYWdlLmlkKTtcbiAgICAgICAgcmV0dXJuIHR5cGUgPT09ICdhbm5vdW5jZW1lbnRzJyB8fCBtZXNzYWdlLmNvbnZlcnNhdGlvbklkID09PSB0aGlzLl9wcmVkaWNhdGU7XG4gICAgICB9KVxuICAgICAgLy8gRmlsdGVyIG91dCBNZXNzYWdlcyB0aGF0IGFyZSBhbHJlYWR5IGluIG91ciBkYXRhIHNldFxuICAgICAgLmZpbHRlcihtZXNzYWdlID0+IHRoaXMuX2dldEluZGV4KG1lc3NhZ2UuaWQpID09PSAtMSlcbiAgICAgIC5tYXAobWVzc2FnZSA9PiB0aGlzLl9nZXREYXRhKG1lc3NhZ2UpKTtcblxuICAgIC8vIEFkZCB0aGVtIHRvIG91ciByZXN1bHQgc2V0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50IGZvciBlYWNoIG9uZVxuICAgIGlmIChsaXN0Lmxlbmd0aCkge1xuICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YSA9IHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlID8gW10uY29uY2F0KHRoaXMuZGF0YSkgOiB0aGlzLmRhdGE7XG4gICAgICBsaXN0LmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbnNlcnRJbmRleChpdGVtLCBkYXRhKTtcbiAgICAgICAgZGF0YS5zcGxpY2UoaW5kZXgsIDAsIGl0ZW0pO1xuICAgICAgICBpZiAoaW5kZXggIT09IDApIExvZ2dlci53YXJuKCdJbmRleCBvZiAnICsgaXRlbS5pZCArICcgaXMgJyArIGluZGV4ICsgJzsgcG9zaXRpb24gaXMgJyArIGl0ZW0ucG9zaXRpb24gKyAnOyBjb21wYXJlZCB0byAnICsgZGF0YVswXS5wb3NpdGlvbik7XG5cbiAgICAgICAgdGhpcy50b3RhbFNpemUgKz0gMTtcblxuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZVJlbW92ZUV2ZW50KG5hbWUsIGV2dCkge1xuICAgIGNvbnN0IHJlbW92ZWQgPSBbXTtcbiAgICBldnRbbmFtZV0uZm9yRWFjaCgobWVzc2FnZSkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChtZXNzYWdlLmlkKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgaWYgKG1lc3NhZ2UuaWQgPT09IHRoaXMuX25leHREQkZyb21JZCkgdGhpcy5fbmV4dERCRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIGlmIChtZXNzYWdlLmlkID09PSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkKSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIHJlbW92ZWQucHVzaCh7XG4gICAgICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvdGFsU2l6ZSAtPSByZW1vdmVkLmxlbmd0aDtcbiAgICByZW1vdmVkLmZvckVhY2goKHJlbW92ZWRPYmopID0+IHtcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncmVtb3ZlJyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKHJlbW92ZWRPYmouZGF0YSksXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbk1lc3NhZ2VzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbl0uY29uY2F0KFF1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5cbk1lc3NhZ2VzUXVlcnkuTWF4UGFnZVNpemUgPSAxMDA7XG5cbk1lc3NhZ2VzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuTWVzc2FnZTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVzc2FnZXNRdWVyeSwgW01lc3NhZ2VzUXVlcnksICdNZXNzYWdlc1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2VzUXVlcnk7XG4iXX0=
