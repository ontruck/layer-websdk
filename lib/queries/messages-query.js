'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Messages
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
        if (!this.predicate.match(/['"]/)) {
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
        });

        this.totalSize += list.length;

        // Index calculated above may shift after additional insertions.  This has
        // to be done after the above insertions have completed.
        list.forEach(function (item) {
          _this4._triggerChange({
            type: 'insert',
            index: _this4.data.indexOf(item),
            target: item,
            query: _this4
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL21lc3NhZ2VzLXF1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJMb2dnZXIiLCJRdWVyeSIsImZpbmRDb252SWRSZWdleCIsIlJlZ0V4cCIsImZpbmRDaGFubmVsSWRSZWdleCIsIk1lc3NhZ2VzUXVlcnkiLCJpblZhbHVlIiwiaW5kZXhPZiIsImNvbnZlcnNhdGlvbklkIiwibWF0Y2giLCJyZXBsYWNlIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiaW52YWxpZFByZWRpY2F0ZSIsImNoYW5uZWxJZCIsInBhZ2VTaXplIiwicHJlZGljYXRlSWRzIiwiX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcyIsInByZWRpY2F0ZSIsImVycm9yIiwidHlwZSIsIkNvbnZlcnNhdGlvbiIsIl9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzIiwiQ2hhbm5lbCIsIl9mZXRjaENoYW5uZWxNZXNzYWdlcyIsInV1aWQiLCJfcHJlZGljYXRlIiwiaWQiLCJjb252ZXJzYXRpb24iLCJjbGllbnQiLCJnZXRDb252ZXJzYXRpb24iLCJkYk1hbmFnZXIiLCJsb2FkTWVzc2FnZXMiLCJfbmV4dERCRnJvbUlkIiwibWVzc2FnZXMiLCJsZW5ndGgiLCJfYXBwZW5kUmVzdWx0cyIsImRhdGEiLCJuZXdSZXF1ZXN0IiwiX25leHRTZXJ2ZXJGcm9tSWQiLCJpc1NhdmVkIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0ZpcmluZyIsInhociIsInVybCIsIm1ldGhvZCIsInN5bmMiLCJfcHJvY2Vzc1J1blJlc3VsdHMiLCJyZXN1bHRzIiwibGFzdE1lc3NhZ2UiLCJfZ2V0RGF0YSIsIl90cmlnZ2VyQ2hhbmdlIiwicXVlcnkiLCJ0YXJnZXQiLCJjaGFubmVsIiwiZ2V0Q2hhbm5lbCIsIml0ZW0iLCJpbmRleCIsIl9nZXRJbnNlcnRJbmRleCIsInNwbGljZSIsIm1lc3NhZ2UiLCJwb3NpdGlvbiIsImV2ZW50TmFtZSIsImV2dCIsIl9oYW5kbGVDb252SWRDaGFuZ2VFdmVudCIsIl9oYW5kbGVDaGFuZ2VFdmVudCIsIl9oYW5kbGVBZGRFdmVudCIsIl9oYW5kbGVSZW1vdmVFdmVudCIsImNpZENoYW5nZXMiLCJnZXRDaGFuZ2VzRm9yIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsIl9ydW4iLCJuZXdEYXRhIiwic2xpY2UiLCJuZXdJbmRleCIsImlzQ2hhbmdlIiwiY2hhbmdlcyIsIm5hbWUiLCJfZ2V0SW5kZXgiLCJwb3NpdGlvbkNoYW5nZXMiLCJfaGFuZGxlUG9zaXRpb25DaGFuZ2UiLCJkYXRhVHlwZSIsIk9iamVjdERhdGFUeXBlIiwidG9PYmplY3QiLCJsaXN0IiwiZmlsdGVyIiwidHlwZUZyb21JRCIsIm1vZGVsIiwiTWVzc2FnZSIsIkFubm91bmNlbWVudCIsIm1hcCIsImNvbmNhdCIsImZvckVhY2giLCJ0b3RhbFNpemUiLCJyZW1vdmVkIiwiX3VwZGF0ZU5leHRGcm9tSWQiLCJwdXNoIiwicmVtb3ZlZE9iaiIsIl9zdXBwb3J0ZWRFdmVudHMiLCJNYXhQYWdlU2l6ZSIsInByb3RvdHlwZSIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7OztBQU1BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsYUFBYUQsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElBQU1FLE9BQU9GLFFBQVEsaUJBQVIsQ0FBYjtBQUNBLElBQU1HLFNBQVNILFFBQVEsV0FBUixDQUFmO0FBQ0EsSUFBTUksUUFBUUosUUFBUSxTQUFSLENBQWQ7O0FBRUEsSUFBTUssa0JBQWtCLElBQUlDLE1BQUosQ0FDdEIsMkZBRHNCLENBQXhCO0FBRUEsSUFBTUMscUJBQXFCLElBQUlELE1BQUosQ0FDekIsaUZBRHlCLENBQTNCOztJQUdNRSxhOzs7Ozs7Ozs7OztrQ0FDVUMsTyxFQUFTO0FBQ3JCLFVBQUlBLFlBQVksRUFBaEIsRUFBb0IsT0FBTyxFQUFQO0FBQ3BCLFVBQUlBLFFBQVFDLE9BQVIsQ0FBZ0IsaUJBQWhCLE1BQXVDLENBQUMsQ0FBNUMsRUFBK0M7QUFDN0MsWUFBSUMsaUJBQWlCRixRQUFRRyxLQUFSLENBQWNQLGVBQWQsSUFBaUNJLFFBQVFJLE9BQVIsQ0FBZ0JSLGVBQWhCLEVBQWlDLElBQWpDLENBQWpDLEdBQTBFLElBQS9GO0FBQ0EsWUFBSSxDQUFDTSxjQUFMLEVBQXFCLE1BQU0sSUFBSUcsS0FBSixDQUFVYixXQUFXYyxVQUFYLENBQXNCQyxnQkFBaEMsQ0FBTjtBQUNyQixZQUFJTCxlQUFlRCxPQUFmLENBQXVCLHlCQUF2QixNQUFzRCxDQUExRCxFQUE2REMsaUJBQWlCLDRCQUE0QkEsY0FBN0M7QUFDN0Qsd0NBQTZCQSxjQUE3QjtBQUNELE9BTEQsTUFLTyxJQUFJRixRQUFRQyxPQUFSLENBQWdCLFlBQWhCLE1BQWtDLENBQUMsQ0FBdkMsRUFBMEM7QUFDL0MsWUFBSU8sWUFBWVIsUUFBUUcsS0FBUixDQUFjTCxrQkFBZCxJQUFvQ0UsUUFBUUksT0FBUixDQUFnQk4sa0JBQWhCLEVBQW9DLElBQXBDLENBQXBDLEdBQWdGLElBQWhHO0FBQ0EsWUFBSSxDQUFDVSxTQUFMLEVBQWdCLE1BQU0sSUFBSUgsS0FBSixDQUFVYixXQUFXYyxVQUFYLENBQXNCQyxnQkFBaEMsQ0FBTjtBQUNoQixZQUFJQyxVQUFVUCxPQUFWLENBQWtCLG9CQUFsQixNQUE0QyxDQUFoRCxFQUFtRE8sWUFBWSx1QkFBdUJBLFNBQW5DO0FBQ25ELG1DQUF3QkEsU0FBeEI7QUFDRCxPQUxNLE1BS0E7QUFDTCxjQUFNLElBQUlILEtBQUosQ0FBVWIsV0FBV2MsVUFBWCxDQUFzQkMsZ0JBQWhDLENBQU47QUFDRDtBQUNGOzs7K0JBR1VFLFEsRUFBVTtBQUNuQixVQUFNQyxlQUFlLEtBQUtDLDRCQUFMLEVBQXJCOztBQUVBO0FBQ0EsVUFBSSxDQUFDRCxZQUFMLEVBQW1CO0FBQ2pCLFlBQUksQ0FBQyxLQUFLRSxTQUFMLENBQWVULEtBQWYsQ0FBcUIsTUFBckIsQ0FBTCxFQUFtQztBQUNqQ1QsaUJBQU9tQixLQUFQLENBQWEsd0NBQWI7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQsY0FBUUgsYUFBYUksSUFBckI7QUFDRSxhQUFLbkIsTUFBTW9CLFlBQVg7QUFDRSxlQUFLQywwQkFBTCxDQUFnQ1AsUUFBaEMsRUFBMENDLFlBQTFDO0FBQ0E7QUFDRixhQUFLZixNQUFNc0IsT0FBWDtBQUNFLGVBQUtDLHFCQUFMLENBQTJCVCxRQUEzQixFQUFxQ0MsWUFBckM7QUFDQTtBQU5KO0FBUUQ7OztvQ0FFZTtBQUNkLGFBQU8sVUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzttREFRK0I7QUFDN0IsVUFBSSxLQUFLRSxTQUFMLENBQWVYLE9BQWYsQ0FBdUIsaUJBQXZCLE1BQThDLENBQUMsQ0FBbkQsRUFBc0Q7QUFDcEQsWUFBSSxLQUFLVyxTQUFMLENBQWVULEtBQWYsQ0FBcUJQLGVBQXJCLENBQUosRUFBMkM7QUFDekMsY0FBTU0saUJBQWlCLEtBQUtVLFNBQUwsQ0FBZVIsT0FBZixDQUF1QlIsZUFBdkIsRUFBd0MsSUFBeEMsQ0FBdkI7O0FBRUE7QUFDQTtBQUNBLGNBQU11QixPQUFPLENBQUMsS0FBS0MsVUFBTCxJQUFtQmxCLGNBQXBCLEVBQW9DRSxPQUFwQyxDQUE0Qyw4QkFBNUMsRUFBNEUsRUFBNUUsQ0FBYjtBQUNBLGNBQUllLElBQUosRUFBVTtBQUNSLG1CQUFPO0FBQ0xBLHdCQURLO0FBRUxFLGtCQUFJbkIsY0FGQztBQUdMWSxvQkFBTW5CLE1BQU1vQjtBQUhQLGFBQVA7QUFLRDtBQUNGO0FBQ0YsT0FmRCxNQWVPLElBQUksS0FBS0gsU0FBTCxDQUFlWCxPQUFmLENBQXVCLFlBQXZCLE1BQXlDLENBQUMsQ0FBOUMsRUFBaUQ7QUFDdEQsWUFBSSxLQUFLVyxTQUFMLENBQWVULEtBQWYsQ0FBcUJMLGtCQUFyQixDQUFKLEVBQThDO0FBQzVDLGNBQU1VLFlBQVksS0FBS0ksU0FBTCxDQUFlUixPQUFmLENBQXVCTixrQkFBdkIsRUFBMkMsSUFBM0MsQ0FBbEI7O0FBRUE7QUFDQTtBQUNBLGNBQU1xQixRQUFPLENBQUMsS0FBS0MsVUFBTCxJQUFtQlosU0FBcEIsRUFBK0JKLE9BQS9CLENBQXVDLHlCQUF2QyxFQUFrRSxFQUFsRSxDQUFiO0FBQ0EsY0FBSWUsS0FBSixFQUFVO0FBQ1IsbUJBQU87QUFDTEEseUJBREs7QUFFTEUsa0JBQUliLFNBRkM7QUFHTE0sb0JBQU1uQixNQUFNc0I7QUFIUCxhQUFQO0FBS0Q7QUFDRjtBQUNGO0FBQ0Y7OzsrQ0FFMEJSLFEsRUFBVUMsWSxFQUFjO0FBQUE7O0FBQ2pELFVBQU1SLGlCQUFpQiw0QkFBNEJRLGFBQWFTLElBQWhFO0FBQ0EsVUFBSSxDQUFDLEtBQUtDLFVBQVYsRUFBc0IsS0FBS0EsVUFBTCxHQUFrQlYsYUFBYVcsRUFBL0I7QUFDdEIsVUFBTUMsZUFBZSxLQUFLQyxNQUFMLENBQVlDLGVBQVosQ0FBNEJ0QixjQUE1QixDQUFyQjs7QUFFQTtBQUNBLFdBQUtxQixNQUFMLENBQVlFLFNBQVosQ0FBc0JDLFlBQXRCLENBQW1DeEIsY0FBbkMsRUFBbUQsS0FBS3lCLGFBQXhELEVBQXVFbEIsUUFBdkUsRUFBaUYsVUFBQ21CLFFBQUQsRUFBYztBQUM3RixZQUFJQSxTQUFTQyxNQUFiLEVBQXFCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsUUFBUixFQUFwQixFQUF3QyxJQUF4QztBQUN0QixPQUZEOztBQUlBLFVBQU1JLGFBQWEsbUJBQWlCdEIsYUFBYVMsSUFBOUIsNEJBQXlEVixRQUF6RCxJQUNoQixLQUFLd0IsaUJBQUwsR0FBeUIsY0FBYyxLQUFLQSxpQkFBNUMsR0FBZ0UsRUFEaEQsQ0FBbkI7O0FBR0E7QUFDQSxVQUFJLENBQUMsQ0FBQ1gsWUFBRCxJQUFpQkEsYUFBYVksT0FBYixFQUFsQixLQUE2Q0YsZUFBZSxLQUFLRyxjQUFyRSxFQUFxRjtBQUNuRixhQUFLQyxRQUFMLEdBQWdCLElBQWhCO0FBQ0EsYUFBS0QsY0FBTCxHQUFzQkgsVUFBdEI7QUFDQSxhQUFLVCxNQUFMLENBQVljLEdBQVosQ0FBZ0I7QUFDZEMsZUFBS04sVUFEUztBQUVkTyxrQkFBUSxLQUZNO0FBR2RDLGdCQUFNO0FBSFEsU0FBaEIsRUFJRztBQUFBLGlCQUFXLE9BQUtDLGtCQUFMLENBQXdCQyxPQUF4QixFQUFpQ1YsVUFBakMsRUFBNkN2QixRQUE3QyxDQUFYO0FBQUEsU0FKSDtBQUtEOztBQUVEO0FBQ0EsVUFBSSxLQUFLc0IsSUFBTCxDQUFVRixNQUFWLEtBQXFCLENBQXpCLEVBQTRCO0FBQzFCLFlBQUlQLGdCQUFnQkEsYUFBYXFCLFdBQWpDLEVBQThDO0FBQzVDLGVBQUtaLElBQUwsR0FBWSxDQUFDLEtBQUthLFFBQUwsQ0FBY3RCLGFBQWFxQixXQUEzQixDQUFELENBQVo7QUFDQTtBQUNBLGVBQUtFLGNBQUwsQ0FBb0I7QUFDbEIvQixrQkFBTSxNQURZO0FBRWxCaUIsa0JBQU0sQ0FBQyxLQUFLYSxRQUFMLENBQWN0QixhQUFhcUIsV0FBM0IsQ0FBRCxDQUZZO0FBR2xCRyxtQkFBTyxJQUhXO0FBSWxCQyxvQkFBUSxLQUFLeEI7QUFKSyxXQUFwQjtBQU1EO0FBQ0Y7QUFDRjs7OzBDQUVxQmQsUSxFQUFVQyxZLEVBQWM7QUFBQTs7QUFDNUMsVUFBTUYsWUFBWSx1QkFBdUJFLGFBQWFTLElBQXREO0FBQ0EsVUFBSSxDQUFDLEtBQUtDLFVBQVYsRUFBc0IsS0FBS0EsVUFBTCxHQUFrQlYsYUFBYVcsRUFBL0I7QUFDdEIsVUFBTTJCLFVBQVUsS0FBS3pCLE1BQUwsQ0FBWTBCLFVBQVosQ0FBdUJ6QyxTQUF2QixDQUFoQjs7QUFFQTtBQUNBLFdBQUtlLE1BQUwsQ0FBWUUsU0FBWixDQUFzQkMsWUFBdEIsQ0FBbUNsQixTQUFuQyxFQUE4QyxLQUFLbUIsYUFBbkQsRUFBa0VsQixRQUFsRSxFQUE0RSxVQUFDbUIsUUFBRCxFQUFjO0FBQ3hGLFlBQUlBLFNBQVNDLE1BQWIsRUFBcUIsT0FBS0MsY0FBTCxDQUFvQixFQUFFQyxNQUFNSCxRQUFSLEVBQXBCLEVBQXdDLElBQXhDO0FBQ3RCLE9BRkQ7O0FBSUEsVUFBTUksYUFBYSxjQUFZdEIsYUFBYVMsSUFBekIsNEJBQW9EVixRQUFwRCxJQUNoQixLQUFLd0IsaUJBQUwsR0FBeUIsY0FBYyxLQUFLQSxpQkFBNUMsR0FBZ0UsRUFEaEQsQ0FBbkI7O0FBR0E7QUFDQSxVQUFJLENBQUMsQ0FBQ2UsT0FBRCxJQUFZQSxRQUFRZCxPQUFSLEVBQWIsS0FBbUNGLGVBQWUsS0FBS0csY0FBM0QsRUFBMkU7QUFDekUsYUFBS0MsUUFBTCxHQUFnQixJQUFoQjtBQUNBLGFBQUtELGNBQUwsR0FBc0JILFVBQXRCO0FBQ0EsYUFBS1QsTUFBTCxDQUFZYyxHQUFaLENBQWdCO0FBQ2RDLGVBQUtOLFVBRFM7QUFFZE8sa0JBQVEsS0FGTTtBQUdkQyxnQkFBTTtBQUhRLFNBQWhCLEVBSUc7QUFBQSxpQkFBVyxPQUFLQyxrQkFBTCxDQUF3QkMsT0FBeEIsRUFBaUNWLFVBQWpDLEVBQTZDdkIsUUFBN0MsQ0FBWDtBQUFBLFNBSkg7QUFLRDtBQUNGOzs7eUNBRW9CeUMsSSxFQUFNO0FBQ3pCLFVBQU1uQixPQUFPLEtBQUtBLElBQWxCO0FBQ0EsVUFBTW9CLFFBQVEsS0FBS0MsZUFBTCxDQUFxQkYsSUFBckIsRUFBMkJuQixJQUEzQixDQUFkO0FBQ0FBLFdBQUtzQixNQUFMLENBQVlGLEtBQVosRUFBbUIsQ0FBbkIsRUFBc0IsS0FBS1AsUUFBTCxDQUFjTSxJQUFkLENBQXRCO0FBQ0Q7OztvQ0FFZUksTyxFQUFTdkIsSSxFQUFNO0FBQzdCLFVBQUlvQixjQUFKO0FBQ0EsV0FBS0EsUUFBUSxDQUFiLEVBQWdCQSxRQUFRcEIsS0FBS0YsTUFBN0IsRUFBcUNzQixPQUFyQyxFQUE4QztBQUM1QyxZQUFJRyxRQUFRQyxRQUFSLEdBQW1CeEIsS0FBS29CLEtBQUwsRUFBWUksUUFBbkMsRUFBNkM7QUFDM0M7QUFDRDtBQUNGO0FBQ0QsYUFBT0osS0FBUDtBQUNEOzs7a0NBR2FLLFMsRUFBV0MsRyxFQUFLO0FBQzVCLGNBQVFELFNBQVI7O0FBRUU7QUFDQSxhQUFLLHNCQUFMO0FBQ0UsZUFBS0Usd0JBQUwsQ0FBOEJELEdBQTlCO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssaUJBQUw7QUFDQSxhQUFLLGVBQUw7QUFDRSxlQUFLRSxrQkFBTCxDQUF3QixVQUF4QixFQUFvQ0YsR0FBcEM7QUFDQTs7QUFFRjtBQUNBO0FBQ0EsYUFBSyxjQUFMO0FBQ0UsZUFBS0csZUFBTCxDQUFxQixVQUFyQixFQUFpQ0gsR0FBakM7QUFDQTs7QUFFRjtBQUNBO0FBQ0EsYUFBSyxpQkFBTDtBQUNFLGVBQUtJLGtCQUFMLENBQXdCLFVBQXhCLEVBQW9DSixHQUFwQztBQUNBO0FBeEJKO0FBMEJEOztBQUVEOzs7Ozs7Ozs7Ozs7NkNBU3lCQSxHLEVBQUs7QUFDNUIsVUFBTUssYUFBYUwsSUFBSU0sYUFBSixDQUFrQixJQUFsQixDQUFuQjtBQUNBLFVBQUlELFdBQVdqQyxNQUFmLEVBQXVCO0FBQ3JCLFlBQUksS0FBS1QsVUFBTCxLQUFvQjBDLFdBQVcsQ0FBWCxFQUFjRSxRQUF0QyxFQUFnRDtBQUM5QyxlQUFLNUMsVUFBTCxHQUFrQjBDLFdBQVcsQ0FBWCxFQUFjRyxRQUFoQztBQUNBLGVBQUtyRCxTQUFMLEdBQWlCLHdCQUF3QixLQUFLUSxVQUE3QixHQUEwQyxHQUEzRDtBQUNBLGVBQUs4QyxJQUFMO0FBQ0Q7QUFDRjtBQUNGOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7MENBWXNCVCxHLEVBQUtOLEssRUFBTztBQUNoQztBQUNBLFVBQUlBLFVBQVUsQ0FBQyxDQUFmLEVBQWtCLE9BQU8sS0FBUDs7QUFFbEI7QUFDQTtBQUNBO0FBQ0EsVUFBTWdCLHVDQUNELEtBQUtwQyxJQUFMLENBQVVxQyxLQUFWLENBQWdCLENBQWhCLEVBQW1CakIsS0FBbkIsQ0FEQyxzQkFFRCxLQUFLcEIsSUFBTCxDQUFVcUMsS0FBVixDQUFnQmpCLFFBQVEsQ0FBeEIsQ0FGQyxFQUFOO0FBSUEsVUFBTWtCLFdBQVcsS0FBS2pCLGVBQUwsQ0FBcUJLLElBQUlWLE1BQXpCLEVBQWlDb0IsT0FBakMsQ0FBakI7O0FBRUE7QUFDQTtBQUNBLFVBQUlFLGFBQWFsQixLQUFqQixFQUF3QjtBQUN0QmdCLGdCQUFRZCxNQUFSLENBQWVnQixRQUFmLEVBQXlCLENBQXpCLEVBQTRCLEtBQUt6QixRQUFMLENBQWNhLElBQUlWLE1BQWxCLENBQTVCO0FBQ0EsYUFBS2hCLElBQUwsR0FBWW9DLE9BQVo7QUFDQSxhQUFLdEIsY0FBTCxDQUFvQjtBQUNsQi9CLGdCQUFNLFVBRFk7QUFFbEJpQyxrQkFBUSxLQUFLSCxRQUFMLENBQWNhLElBQUlWLE1BQWxCLENBRlU7QUFHbEJELGlCQUFPLElBSFc7QUFJbEJ3QixvQkFBVSxJQUpRO0FBS2xCQyxtQkFBU2QsSUFBSWM7QUFMSyxTQUFwQjtBQU9BLGVBQU8sSUFBUDtBQUNEO0FBQ0QsYUFBTyxLQUFQO0FBQ0Q7Ozt1Q0FFa0JDLEksRUFBTWYsRyxFQUFLO0FBQzVCLFVBQUlOLFFBQVEsS0FBS3NCLFNBQUwsQ0FBZWhCLElBQUlWLE1BQUosQ0FBVzFCLEVBQTFCLENBQVo7QUFDQSxVQUFNcUQsa0JBQWtCakIsSUFBSU0sYUFBSixDQUFrQixVQUFsQixDQUF4Qjs7QUFFQTtBQUNBO0FBQ0EsVUFBSVcsZ0JBQWdCN0MsTUFBcEIsRUFBNEI7QUFDMUIsWUFBSSxLQUFLOEMscUJBQUwsQ0FBMkJsQixHQUEzQixFQUFnQ04sS0FBaEMsQ0FBSixFQUE0QztBQUMxQyxjQUFJdUIsZ0JBQWdCN0MsTUFBaEIsS0FBMkI0QixJQUFJYyxPQUFKLENBQVkxQyxNQUEzQyxFQUFtRDtBQUNuRHNCLGtCQUFRLEtBQUtzQixTQUFMLENBQWVoQixJQUFJVixNQUFKLENBQVcxQixFQUExQixDQUFSLENBRjBDLENBRUg7QUFDeEM7QUFDRjs7QUFFRCxVQUFJOEIsVUFBVSxDQUFDLENBQWYsRUFBa0I7QUFDaEIsWUFBSSxLQUFLeUIsUUFBTCxLQUFrQmpGLE1BQU1rRixjQUE1QixFQUE0QztBQUMxQyxlQUFLOUMsSUFBTCxnQ0FDSyxLQUFLQSxJQUFMLENBQVVxQyxLQUFWLENBQWdCLENBQWhCLEVBQW1CakIsS0FBbkIsQ0FETCxJQUVFTSxJQUFJVixNQUFKLENBQVcrQixRQUFYLEVBRkYsc0JBR0ssS0FBSy9DLElBQUwsQ0FBVXFDLEtBQVYsQ0FBZ0JqQixRQUFRLENBQXhCLENBSEw7QUFLRDtBQUNELGFBQUtOLGNBQUwsQ0FBb0I7QUFDbEIvQixnQkFBTSxVQURZO0FBRWxCaUMsa0JBQVEsS0FBS0gsUUFBTCxDQUFjYSxJQUFJVixNQUFsQixDQUZVO0FBR2xCRCxpQkFBTyxJQUhXO0FBSWxCd0Isb0JBQVUsSUFKUTtBQUtsQkMsbUJBQVNkLElBQUljO0FBTEssU0FBcEI7QUFPRDtBQUNGOzs7b0NBRWVDLEksRUFBTWYsRyxFQUFLO0FBQUE7O0FBQ3pCO0FBQ0E7QUFDQSxVQUFNc0IsT0FBT3RCLElBQUllLElBQUo7QUFDWDtBQURXLE9BRVZRLE1BRlUsQ0FFSCxVQUFDMUIsT0FBRCxFQUFhO0FBQ25CLFlBQU14QyxPQUFPckIsS0FBS3dGLFVBQUwsQ0FBZ0IzQixRQUFRakMsRUFBeEIsQ0FBYjtBQUNBLGVBQVFQLFNBQVMsVUFBVCxJQUF1QixPQUFLb0UsS0FBTCxLQUFldkYsTUFBTXdGLE9BQTdDLElBQ0VyRSxTQUFTLGVBQVQsSUFBNEIsT0FBS29FLEtBQUwsS0FBZXZGLE1BQU15RixZQUQxRDtBQUVEO0FBQ0Q7QUFQVyxRQVFWSixNQVJVLENBUUgsVUFBQzFCLE9BQUQsRUFBYTtBQUNuQixZQUFNeEMsT0FBT3JCLEtBQUt3RixVQUFMLENBQWdCM0IsUUFBUWpDLEVBQXhCLENBQWI7QUFDQSxlQUFPUCxTQUFTLGVBQVQsSUFBNEJ3QyxRQUFRcEQsY0FBUixLQUEyQixPQUFLa0IsVUFBbkU7QUFDRDtBQUNEO0FBWlcsUUFhVjRELE1BYlUsQ0FhSDtBQUFBLGVBQVcsT0FBS1AsU0FBTCxDQUFlbkIsUUFBUWpDLEVBQXZCLE1BQStCLENBQUMsQ0FBM0M7QUFBQSxPQWJHLEVBY1ZnRSxHQWRVLENBY047QUFBQSxlQUFXLE9BQUt6QyxRQUFMLENBQWNVLE9BQWQsQ0FBWDtBQUFBLE9BZE0sQ0FBYjs7QUFnQkE7QUFDQSxVQUFJeUIsS0FBS2xELE1BQVQsRUFBaUI7QUFDZixZQUFNRSxPQUFPLEtBQUtBLElBQUwsR0FBWSxLQUFLNkMsUUFBTCxLQUFrQmpGLE1BQU1rRixjQUF4QixHQUF5QyxHQUFHUyxNQUFILENBQVUsS0FBS3ZELElBQWYsQ0FBekMsR0FBZ0UsS0FBS0EsSUFBOUY7QUFDQWdELGFBQUtRLE9BQUwsQ0FBYSxVQUFDckMsSUFBRCxFQUFVO0FBQ3JCLGNBQU1DLFFBQVEsT0FBS0MsZUFBTCxDQUFxQkYsSUFBckIsRUFBMkJuQixJQUEzQixDQUFkO0FBQ0FBLGVBQUtzQixNQUFMLENBQVlGLEtBQVosRUFBbUIsQ0FBbkIsRUFBc0JELElBQXRCO0FBQ0QsU0FIRDs7QUFLQSxhQUFLc0MsU0FBTCxJQUFrQlQsS0FBS2xELE1BQXZCOztBQUVBO0FBQ0E7QUFDQWtELGFBQUtRLE9BQUwsQ0FBYSxVQUFDckMsSUFBRCxFQUFVO0FBQ3JCLGlCQUFLTCxjQUFMLENBQW9CO0FBQ2xCL0Isa0JBQU0sUUFEWTtBQUVsQnFDLG1CQUFPLE9BQUtwQixJQUFMLENBQVU5QixPQUFWLENBQWtCaUQsSUFBbEIsQ0FGVztBQUdsQkgsb0JBQVFHLElBSFU7QUFJbEJKO0FBSmtCLFdBQXBCO0FBTUQsU0FQRDtBQVFEO0FBQ0Y7Ozt1Q0FFa0IwQixJLEVBQU1mLEcsRUFBSztBQUFBOztBQUM1QixVQUFNZ0MsVUFBVSxFQUFoQjtBQUNBaEMsVUFBSWUsSUFBSixFQUFVZSxPQUFWLENBQWtCLFVBQUNqQyxPQUFELEVBQWE7QUFDN0IsWUFBTUgsUUFBUSxPQUFLc0IsU0FBTCxDQUFlbkIsUUFBUWpDLEVBQXZCLENBQWQ7QUFDQSxZQUFJOEIsVUFBVSxDQUFDLENBQWYsRUFBa0I7QUFDaEIsY0FBSUcsUUFBUWpDLEVBQVIsS0FBZSxPQUFLTSxhQUF4QixFQUF1QyxPQUFLQSxhQUFMLEdBQXFCLE9BQUsrRCxpQkFBTCxDQUF1QnZDLEtBQXZCLENBQXJCO0FBQ3ZDLGNBQUlHLFFBQVFqQyxFQUFSLEtBQWUsT0FBS1ksaUJBQXhCLEVBQTJDLE9BQUtBLGlCQUFMLEdBQXlCLE9BQUt5RCxpQkFBTCxDQUF1QnZDLEtBQXZCLENBQXpCO0FBQzNDc0Msa0JBQVFFLElBQVIsQ0FBYTtBQUNYNUQsa0JBQU11QixPQURLO0FBRVhIO0FBRlcsV0FBYjtBQUlBLGNBQUksT0FBS3lCLFFBQUwsS0FBa0JqRixNQUFNa0YsY0FBNUIsRUFBNEM7QUFDMUMsbUJBQUs5QyxJQUFMLGdDQUNLLE9BQUtBLElBQUwsQ0FBVXFDLEtBQVYsQ0FBZ0IsQ0FBaEIsRUFBbUJqQixLQUFuQixDQURMLHNCQUVLLE9BQUtwQixJQUFMLENBQVVxQyxLQUFWLENBQWdCakIsUUFBUSxDQUF4QixDQUZMO0FBSUQsV0FMRCxNQUtPO0FBQ0wsbUJBQUtwQixJQUFMLENBQVVzQixNQUFWLENBQWlCRixLQUFqQixFQUF3QixDQUF4QjtBQUNEO0FBQ0Y7QUFDRixPQWxCRDs7QUFvQkEsV0FBS3FDLFNBQUwsSUFBa0JDLFFBQVE1RCxNQUExQjtBQUNBNEQsY0FBUUYsT0FBUixDQUFnQixVQUFDSyxVQUFELEVBQWdCO0FBQzlCLGVBQUsvQyxjQUFMLENBQW9CO0FBQ2xCL0IsZ0JBQU0sUUFEWTtBQUVsQmlDLGtCQUFRLE9BQUtILFFBQUwsQ0FBY2dELFdBQVc3RCxJQUF6QixDQUZVO0FBR2xCb0IsaUJBQU95QyxXQUFXekMsS0FIQTtBQUlsQkw7QUFKa0IsU0FBcEI7QUFNRCxPQVBEO0FBUUQ7Ozs7RUExV3lCbkQsSzs7QUE2VzVCSSxjQUFjOEYsZ0JBQWQsR0FBaUMsR0FDL0JQLE1BRCtCLENBQ3hCM0YsTUFBTWtHLGdCQURrQixDQUFqQzs7QUFJQTlGLGNBQWMrRixXQUFkLEdBQTRCLEdBQTVCOztBQUVBL0YsY0FBY2dHLFNBQWQsQ0FBd0JiLEtBQXhCLEdBQWdDdkYsTUFBTXdGLE9BQXRDOztBQUVBN0YsS0FBSzBHLFNBQUwsQ0FBZUMsS0FBZixDQUFxQmxHLGFBQXJCLEVBQW9DLENBQUNBLGFBQUQsRUFBZ0IsZUFBaEIsQ0FBcEM7O0FBRUFtRyxPQUFPQyxPQUFQLEdBQWlCcEcsYUFBakIiLCJmaWxlIjoibWVzc2FnZXMtcXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFF1ZXJ5IGNsYXNzIGZvciBydW5uaW5nIGEgUXVlcnkgb24gTWVzc2FnZXNcbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lc3NhZ2VzUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5XG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5cbmNvbnN0IGZpbmRDb252SWRSZWdleCA9IG5ldyBSZWdFeHAoXG4gIC9eY29udmVyc2F0aW9uLmlkXFxzKj1cXHMqWydcIl0oKGxheWVyOlxcL1xcL1xcL2NvbnZlcnNhdGlvbnNcXC8pPy57OH0tLns0fS0uezR9LS57NH0tLnsxMn0pWydcIl0kLyk7XG5jb25zdCBmaW5kQ2hhbm5lbElkUmVnZXggPSBuZXcgUmVnRXhwKFxuICAvXmNoYW5uZWwuaWRcXHMqPVxccypbJ1wiXSgobGF5ZXI6XFwvXFwvXFwvY2hhbm5lbHNcXC8pPy57OH0tLns0fS0uezR9LS57NH0tLnsxMn0pWydcIl0kLyk7XG5cbmNsYXNzIE1lc3NhZ2VzUXVlcnkgZXh0ZW5kcyBRdWVyeSB7XG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIGlmIChpblZhbHVlID09PSAnJykgcmV0dXJuICcnO1xuICAgIGlmIChpblZhbHVlLmluZGV4T2YoJ2NvbnZlcnNhdGlvbi5pZCcpICE9PSAtMSkge1xuICAgICAgbGV0IGNvbnZlcnNhdGlvbklkID0gaW5WYWx1ZS5tYXRjaChmaW5kQ29udklkUmVnZXgpID8gaW5WYWx1ZS5yZXBsYWNlKGZpbmRDb252SWRSZWdleCwgJyQxJykgOiBudWxsO1xuICAgICAgaWYgKCFjb252ZXJzYXRpb25JZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb25JZC5pbmRleE9mKCdsYXllcjovLy9jb252ZXJzYXRpb25zLycpICE9PSAwKSBjb252ZXJzYXRpb25JZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLycgKyBjb252ZXJzYXRpb25JZDtcbiAgICAgIHJldHVybiBgY29udmVyc2F0aW9uLmlkID0gJyR7Y29udmVyc2F0aW9uSWR9J2A7XG4gICAgfSBlbHNlIGlmIChpblZhbHVlLmluZGV4T2YoJ2NoYW5uZWwuaWQnKSAhPT0gLTEpIHtcbiAgICAgIGxldCBjaGFubmVsSWQgPSBpblZhbHVlLm1hdGNoKGZpbmRDaGFubmVsSWRSZWdleCkgPyBpblZhbHVlLnJlcGxhY2UoZmluZENoYW5uZWxJZFJlZ2V4LCAnJDEnKSA6IG51bGw7XG4gICAgICBpZiAoIWNoYW5uZWxJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjaGFubmVsSWQuaW5kZXhPZignbGF5ZXI6Ly8vY2hhbm5lbHMvJykgIT09IDApIGNoYW5uZWxJZCA9ICdsYXllcjovLy9jaGFubmVscy8nICsgY2hhbm5lbElkO1xuICAgICAgcmV0dXJuIGBjaGFubmVsLmlkID0gJyR7Y2hhbm5lbElkfSdgO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmludmFsaWRQcmVkaWNhdGUpO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHByZWRpY2F0ZUlkcyA9IHRoaXMuX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpO1xuXG4gICAgLy8gRG8gbm90aGluZyBpZiB3ZSBkb24ndCBoYXZlIGEgY29udmVyc2F0aW9uIHRvIHF1ZXJ5IG9uXG4gICAgaWYgKCFwcmVkaWNhdGVJZHMpIHtcbiAgICAgIGlmICghdGhpcy5wcmVkaWNhdGUubWF0Y2goL1snXCJdLykpIHtcbiAgICAgICAgTG9nZ2VyLmVycm9yKCdUaGlzIHF1ZXJ5IG1heSBuZWVkIHRvIHF1b3RlIGl0cyB2YWx1ZScpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN3aXRjaCAocHJlZGljYXRlSWRzLnR5cGUpIHtcbiAgICAgIGNhc2UgUXVlcnkuQ29udmVyc2F0aW9uOlxuICAgICAgICB0aGlzLl9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzKHBhZ2VTaXplLCBwcmVkaWNhdGVJZHMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgUXVlcnkuQ2hhbm5lbDpcbiAgICAgICAgdGhpcy5fZmV0Y2hDaGFubmVsTWVzc2FnZXMocGFnZVNpemUsIHByZWRpY2F0ZUlkcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTb3J0RmllbGQoKSB7XG4gICAgcmV0dXJuICdwb3NpdGlvbic7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBDb252ZXJzYXRpb24gVVVJRCBmcm9tIHRoZSBwcmVkaWNhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEV4dHJhY3QgdGhlIENvbnZlcnNhdGlvbidzIFVVSUQgZnJvbSB0aGUgcHJlZGljYXRlLi4uIG9yIHJldHVybmVkIHRoZSBjYWNoZWQgdmFsdWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpIHtcbiAgICBpZiAodGhpcy5wcmVkaWNhdGUuaW5kZXhPZignY29udmVyc2F0aW9uLmlkJykgIT09IC0xKSB7XG4gICAgICBpZiAodGhpcy5wcmVkaWNhdGUubWF0Y2goZmluZENvbnZJZFJlZ2V4KSkge1xuICAgICAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IHRoaXMucHJlZGljYXRlLnJlcGxhY2UoZmluZENvbnZJZFJlZ2V4LCAnJDEnKTtcblxuICAgICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAgIC8vIHRoZSBjb252ZXJzYXRpb25JZC5cbiAgICAgICAgY29uc3QgdXVpZCA9ICh0aGlzLl9wcmVkaWNhdGUgfHwgY29udmVyc2F0aW9uSWQpLnJlcGxhY2UoL15sYXllcjpcXC9cXC9cXC9jb252ZXJzYXRpb25zXFwvLywgJycpO1xuICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgaWQ6IGNvbnZlcnNhdGlvbklkLFxuICAgICAgICAgICAgdHlwZTogUXVlcnkuQ29udmVyc2F0aW9uLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMucHJlZGljYXRlLmluZGV4T2YoJ2NoYW5uZWwuaWQnKSAhPT0gLTEpIHtcbiAgICAgIGlmICh0aGlzLnByZWRpY2F0ZS5tYXRjaChmaW5kQ2hhbm5lbElkUmVnZXgpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IHRoaXMucHJlZGljYXRlLnJlcGxhY2UoZmluZENoYW5uZWxJZFJlZ2V4LCAnJDEnKTtcblxuICAgICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAgIC8vIHRoZSBjaGFubmVsSWQuXG4gICAgICAgIGNvbnN0IHV1aWQgPSAodGhpcy5fcHJlZGljYXRlIHx8IGNoYW5uZWxJZCkucmVwbGFjZSgvXmxheWVyOlxcL1xcL1xcL2NoYW5uZWxzXFwvLywgJycpO1xuICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgaWQ6IGNoYW5uZWxJZCxcbiAgICAgICAgICAgIHR5cGU6IFF1ZXJ5LkNoYW5uZWwsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mZXRjaENvbnZlcnNhdGlvbk1lc3NhZ2VzKHBhZ2VTaXplLCBwcmVkaWNhdGVJZHMpIHtcbiAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLycgKyBwcmVkaWNhdGVJZHMudXVpZDtcbiAgICBpZiAoIXRoaXMuX3ByZWRpY2F0ZSkgdGhpcy5fcHJlZGljYXRlID0gcHJlZGljYXRlSWRzLmlkO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCk7XG5cbiAgICAvLyBSZXRyaWV2ZSBkYXRhIGZyb20gZGIgY2FjaGUgaW4gcGFyYWxsZWwgd2l0aCBsb2FkaW5nIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY29udmVyc2F0aW9ucy8ke3ByZWRpY2F0ZUlkcy51dWlkfS9tZXNzYWdlcz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcXVlcnkgb24gdW5zYXZlZCBjb252ZXJzYXRpb25zLCBub3IgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKCghY29udmVyc2F0aW9uIHx8IGNvbnZlcnNhdGlvbi5pc1NhdmVkKCkpICYmIG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGFyZSBubyByZXN1bHRzLCB0aGVuIGl0cyBhIG5ldyBxdWVyeTsgYXV0b21hdGljYWxseSBwb3B1bGF0ZSBpdCB3aXRoIHRoZSBDb252ZXJzYXRpb24ncyBsYXN0TWVzc2FnZS5cbiAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGNvbnZlcnNhdGlvbiAmJiBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW3RoaXMuX2dldERhdGEoY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKV07XG4gICAgICAgIC8vIFRyaWdnZXIgdGhlIGNoYW5nZSBldmVudFxuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnZGF0YScsXG4gICAgICAgICAgZGF0YTogW3RoaXMuX2dldERhdGEoY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKV0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLmNsaWVudCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZldGNoQ2hhbm5lbE1lc3NhZ2VzKHBhZ2VTaXplLCBwcmVkaWNhdGVJZHMpIHtcbiAgICBjb25zdCBjaGFubmVsSWQgPSAnbGF5ZXI6Ly8vY2hhbm5lbHMvJyArIHByZWRpY2F0ZUlkcy51dWlkO1xuICAgIGlmICghdGhpcy5fcHJlZGljYXRlKSB0aGlzLl9wcmVkaWNhdGUgPSBwcmVkaWNhdGVJZHMuaWQ7XG4gICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuY2xpZW50LmdldENoYW5uZWwoY2hhbm5lbElkKTtcblxuICAgIC8vIFJldHJpZXZlIGRhdGEgZnJvbSBkYiBjYWNoZSBpbiBwYXJhbGxlbCB3aXRoIGxvYWRpbmcgZGF0YSBmcm9tIHNlcnZlclxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkTWVzc2FnZXMoY2hhbm5lbElkLCB0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY2hhbm5lbHMvJHtwcmVkaWNhdGVJZHMudXVpZH0vbWVzc2FnZXM/cGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIC8vIERvbid0IHF1ZXJ5IG9uIHVuc2F2ZWQgY2hhbm5lbHMsIG5vciByZXBlYXQgc3RpbGwgZmlyaW5nIHF1ZXJpZXNcbiAgICBpZiAoKCFjaGFubmVsIHx8IGNoYW5uZWwuaXNTYXZlZCgpKSAmJiBuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGl0ZW0sIGRhdGEpO1xuICAgIGRhdGEuc3BsaWNlKGluZGV4LCAwLCB0aGlzLl9nZXREYXRhKGl0ZW0pKTtcbiAgfVxuXG4gIF9nZXRJbnNlcnRJbmRleChtZXNzYWdlLCBkYXRhKSB7XG4gICAgbGV0IGluZGV4O1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBpZiAobWVzc2FnZS5wb3NpdGlvbiA+IGRhdGFbaW5kZXhdLnBvc2l0aW9uKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG4gIH1cblxuXG4gIF9oYW5kbGVFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbidzIElEIGhhcyBjaGFuZ2VkLCBjaGVjayBvdXIgcHJlZGljYXRlLCBhbmQgdXBkYXRlIGl0IGF1dG9tYXRpY2FsbHkgaWYgbmVlZGVkLlxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDb252SWRDaGFuZ2VFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBNZXNzYWdlIGhhcyBjaGFuZ2VkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlcGxhY2VcbiAgICAgIC8vIGl0IHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgY2FzZSAnbWVzc2FnZXM6Y2hhbmdlJzpcbiAgICAgIGNhc2UgJ21lc3NhZ2VzOnJlYWQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDaGFuZ2VFdmVudCgnbWVzc2FnZXMnLCBldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgTWVzc2FnZXMgYXJlIGFkZGVkLCBhbmQgdGhleSBhcmVuJ3QgYWxyZWFkeSBpbiBvdXIgcmVzdWx0IHNldFxuICAgICAgLy8gYWRkIHRoZW0uXG4gICAgICBjYXNlICdtZXNzYWdlczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnbWVzc2FnZXMnLCBldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBNZXNzYWdlIGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnbWVzc2FnZXM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlUmVtb3ZlRXZlbnQoJ21lc3NhZ2VzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEEgQ29udmVyc2F0aW9uIG9yIENoYW5uZWwgSUQgY2hhbmdlcyBpZiBhIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiBvciBuYW1lZCBDaGFubmVsIHdhcyBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBJZiB0aGlzIFF1ZXJ5J3MgQ29udmVyc2F0aW9uJ3MgSUQgaGFzIGNoYW5nZWQsIHVwZGF0ZSB0aGUgcHJlZGljYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVDb252SWRDaGFuZ2VFdmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dCAtIEEgTWVzc2FnZSBDaGFuZ2UgRXZlbnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYW5kbGVDb252SWRDaGFuZ2VFdmVudChldnQpIHtcbiAgICBjb25zdCBjaWRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2lkJyk7XG4gICAgaWYgKGNpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICBpZiAodGhpcy5fcHJlZGljYXRlID09PSBjaWRDaGFuZ2VzWzBdLm9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ByZWRpY2F0ZSA9IGNpZENoYW5nZXNbMF0ubmV3VmFsdWU7XG4gICAgICAgIHRoaXMucHJlZGljYXRlID0gXCJjb252ZXJzYXRpb24uaWQgPSAnXCIgKyB0aGlzLl9wcmVkaWNhdGUgKyBcIidcIjtcbiAgICAgICAgdGhpcy5fcnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBJRCBvZiB0aGUgbWVzc2FnZSBoYXMgY2hhbmdlZCwgdGhlbiB0aGUgcG9zaXRpb24gcHJvcGVydHkgaGFzIGxpa2VseSBjaGFuZ2VkIGFzIHdlbGwuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHRlc3RzIHRvIHNlZSBpZiBjaGFuZ2VzIHRvIHRoZSBwb3NpdGlvbiBwcm9wZXJ0eSBoYXZlIGltcGFjdGVkIHRoZSBtZXNzYWdlJ3MgcG9zaXRpb24gaW4gdGhlXG4gICAqIGRhdGEgYXJyYXkuLi4gYW5kIHVwZGF0ZXMgdGhlIGFycmF5IGlmIGl0IGhhcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUG9zaXRpb25DaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgIEEgTWVzc2FnZSBDaGFuZ2UgZXZlbnRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4ICBJbmRleCBvZiB0aGUgbWVzc2FnZSBpbiB0aGUgY3VycmVudCBkYXRhIGFycmF5XG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgYSBkYXRhIHdhcyBjaGFuZ2VkIGFuZCBhIGNoYW5nZSBldmVudCB3YXMgZW1pdHRlZFxuICAgKi9cbiAgX2hhbmRsZVBvc2l0aW9uQ2hhbmdlKGV2dCwgaW5kZXgpIHtcbiAgICAvLyBJZiB0aGUgbWVzc2FnZSBpcyBub3QgaW4gdGhlIGN1cnJlbnQgZGF0YSwgdGhlbiB0aGVyZSBpcyBubyBjaGFuZ2UgdG8gb3VyIHF1ZXJ5IHJlc3VsdHMuXG4gICAgaWYgKGluZGV4ID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gQ3JlYXRlIGFuIGFycmF5IHdpdGhvdXQgb3VyIGRhdGEgaXRlbSBhbmQgdGhlbiBmaW5kIG91dCB3aGVyZSB0aGUgZGF0YSBpdGVtIFNob3VsZCBiZSBpbnNlcnRlZC5cbiAgICAvLyBOb3RlOiB3ZSBjb3VsZCBqdXN0IGxvb2t1cCB0aGUgcG9zaXRpb24gaW4gb3VyIGN1cnJlbnQgZGF0YSBhcnJheSwgYnV0IGl0cyB0b28gZWFzeSB0byBpbnRyb2R1Y2VcbiAgICAvLyBlcnJvcnMgd2hlcmUgY29tcGFyaW5nIHRoaXMgbWVzc2FnZSB0byBpdHNlbGYgbWF5IHlpZWxkIGluZGV4IG9yIGluZGV4ICsgMS5cbiAgICBjb25zdCBuZXdEYXRhID0gW1xuICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgIF07XG4gICAgY29uc3QgbmV3SW5kZXggPSB0aGlzLl9nZXRJbnNlcnRJbmRleChldnQudGFyZ2V0LCBuZXdEYXRhKTtcblxuICAgIC8vIElmIHRoZSBkYXRhIGl0ZW0gZ29lcyBpbiB0aGUgc2FtZSBpbmRleCBhcyBiZWZvcmUsIHRoZW4gdGhlcmUgaXMgbm8gY2hhbmdlIHRvIGJlIGhhbmRsZWQgaGVyZTtcbiAgICAvLyBlbHNlIGluc2VydCB0aGUgaXRlbSBhdCB0aGUgcmlnaHQgaW5kZXgsIHVwZGF0ZSB0aGlzLmRhdGEgYW5kIGZpcmUgYSBjaGFuZ2UgZXZlbnRcbiAgICBpZiAobmV3SW5kZXggIT09IGluZGV4KSB7XG4gICAgICBuZXdEYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICB0aGlzLmRhdGEgPSBuZXdEYXRhO1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdwcm9wZXJ0eScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIGlzQ2hhbmdlOiB0cnVlLFxuICAgICAgICBjaGFuZ2VzOiBldnQuY2hhbmdlcyxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9oYW5kbGVDaGFuZ2VFdmVudChuYW1lLCBldnQpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLl9nZXRJbmRleChldnQudGFyZ2V0LmlkKTtcbiAgICBjb25zdCBwb3NpdGlvbkNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcigncG9zaXRpb24nKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBwb3NpdGlvbiBjaGFuZ2VzLCBoYW5kbGUgdGhlbS4gIElmIGFsbCB0aGUgY2hhbmdlcyBhcmUgcG9zaXRpb24gY2hhbmdlcyxcbiAgICAvLyBleGl0IHdoZW4gZG9uZS5cbiAgICBpZiAocG9zaXRpb25DaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgaWYgKHRoaXMuX2hhbmRsZVBvc2l0aW9uQ2hhbmdlKGV2dCwgaW5kZXgpKSB7XG4gICAgICAgIGlmIChwb3NpdGlvbkNoYW5nZXMubGVuZ3RoID09PSBldnQuY2hhbmdlcy5sZW5ndGgpIHJldHVybjtcbiAgICAgICAgaW5kZXggPSB0aGlzLl9nZXRJbmRleChldnQudGFyZ2V0LmlkKTsgLy8gR2V0IHRoZSB1cGRhdGVkIHBvc2l0aW9uXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgIGV2dC50YXJnZXQudG9PYmplY3QoKSxcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQWRkRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgLy8gT25seSB1c2UgYWRkZWQgbWVzc2FnZXMgdGhhdCBhcmUgcGFydCBvZiB0aGlzIENvbnZlcnNhdGlvblxuICAgIC8vIGFuZCBub3QgYWxyZWFkeSBpbiBvdXIgcmVzdWx0IHNldFxuICAgIGNvbnN0IGxpc3QgPSBldnRbbmFtZV1cbiAgICAgIC8vIEZpbHRlciBzbyB0aGF0IHdlIG9ubHkgc2VlIE1lc3NhZ2VzIGlmIGRvaW5nIGEgTWVzc2FnZXMgcXVlcnkgb3IgQW5ub3VuY2VtZW50cyBpZiBkb2luZyBhbiBBbm5vdW5jZW1lbnRzIFF1ZXJ5LlxuICAgICAgLmZpbHRlcigobWVzc2FnZSkgPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gVXRpbC50eXBlRnJvbUlEKG1lc3NhZ2UuaWQpO1xuICAgICAgICByZXR1cm4gKHR5cGUgPT09ICdtZXNzYWdlcycgJiYgdGhpcy5tb2RlbCA9PT0gUXVlcnkuTWVzc2FnZSkgfHxcbiAgICAgICAgICAgICAgICAodHlwZSA9PT0gJ2Fubm91bmNlbWVudHMnICYmIHRoaXMubW9kZWwgPT09IFF1ZXJ5LkFubm91bmNlbWVudCk7XG4gICAgICB9KVxuICAgICAgLy8gRmlsdGVyIG91dCBNZXNzYWdlcyB0aGF0IGFyZW4ndCBwYXJ0IG9mIHRoaXMgQ29udmVyc2F0aW9uXG4gICAgICAuZmlsdGVyKChtZXNzYWdlKSA9PiB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBVdGlsLnR5cGVGcm9tSUQobWVzc2FnZS5pZCk7XG4gICAgICAgIHJldHVybiB0eXBlID09PSAnYW5ub3VuY2VtZW50cycgfHwgbWVzc2FnZS5jb252ZXJzYXRpb25JZCA9PT0gdGhpcy5fcHJlZGljYXRlO1xuICAgICAgfSlcbiAgICAgIC8vIEZpbHRlciBvdXQgTWVzc2FnZXMgdGhhdCBhcmUgYWxyZWFkeSBpbiBvdXIgZGF0YSBzZXRcbiAgICAgIC5maWx0ZXIobWVzc2FnZSA9PiB0aGlzLl9nZXRJbmRleChtZXNzYWdlLmlkKSA9PT0gLTEpXG4gICAgICAubWFwKG1lc3NhZ2UgPT4gdGhpcy5fZ2V0RGF0YShtZXNzYWdlKSk7XG5cbiAgICAvLyBBZGQgdGhlbSB0byBvdXIgcmVzdWx0IHNldCBhbmQgdHJpZ2dlciBhbiBldmVudCBmb3IgZWFjaCBvbmVcbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGEgPSB0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSA/IFtdLmNvbmNhdCh0aGlzLmRhdGEpIDogdGhpcy5kYXRhO1xuICAgICAgbGlzdC5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoaXRlbSwgZGF0YSk7XG4gICAgICAgIGRhdGEuc3BsaWNlKGluZGV4LCAwLCBpdGVtKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRvdGFsU2l6ZSArPSBsaXN0Lmxlbmd0aDtcblxuICAgICAgLy8gSW5kZXggY2FsY3VsYXRlZCBhYm92ZSBtYXkgc2hpZnQgYWZ0ZXIgYWRkaXRpb25hbCBpbnNlcnRpb25zLiAgVGhpcyBoYXNcbiAgICAgIC8vIHRvIGJlIGRvbmUgYWZ0ZXIgdGhlIGFib3ZlIGluc2VydGlvbnMgaGF2ZSBjb21wbGV0ZWQuXG4gICAgICBsaXN0LmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgaW5kZXg6IHRoaXMuZGF0YS5pbmRleE9mKGl0ZW0pLFxuICAgICAgICAgIHRhcmdldDogaXRlbSxcbiAgICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlUmVtb3ZlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dFtuYW1lXS5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KG1lc3NhZ2UuaWQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBpZiAobWVzc2FnZS5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKG1lc3NhZ2UuaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBtZXNzYWdlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gW1xuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgICAgICAgIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMudG90YWxTaXplIC09IHJlbW92ZWQubGVuZ3RoO1xuICAgIHJlbW92ZWQuZm9yRWFjaCgocmVtb3ZlZE9iaikgPT4ge1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEocmVtb3ZlZE9iai5kYXRhKSxcbiAgICAgICAgaW5kZXg6IHJlbW92ZWRPYmouaW5kZXgsXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuTWVzc2FnZXNRdWVyeS5fc3VwcG9ydGVkRXZlbnRzID0gW1xuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuTWVzc2FnZXNRdWVyeS5NYXhQYWdlU2l6ZSA9IDEwMDtcblxuTWVzc2FnZXNRdWVyeS5wcm90b3R5cGUubW9kZWwgPSBRdWVyeS5NZXNzYWdlO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShNZXNzYWdlc1F1ZXJ5LCBbTWVzc2FnZXNRdWVyeSwgJ01lc3NhZ2VzUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZXNRdWVyeTtcbiJdfQ==
