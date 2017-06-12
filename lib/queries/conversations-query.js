'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Conversations.
 *
 *
 *      var conversationQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Conversation,
 *        sortBy: [{'createdAt': 'desc'}]
 *      });
 *
 *
 * You can change the `paginationWindow` and `sortBy` properties at any time using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 * You can release data held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### sortBy
 *
 * Note that the `sortBy` property is only supported for Conversations at this time and only
 * supports "createdAt" and "lastMessage.sentAt" as sort fields, and only supports `desc` sort direction.
 *
 *      query.update({
 *        sortBy: [{'lastMessage.sentAt': 'desc'}]
 *      });
 *
 *
 * @class  layer.ConversationsQuery
 * @extends layer.Query
 */
var Root = require('../root');
var Util = require('../client-utils');

var _require = require('../const'),
    SYNC_STATE = _require.SYNC_STATE;

var Query = require('./query');

var ConversationsQuery = function (_Query) {
  _inherits(ConversationsQuery, _Query);

  function ConversationsQuery() {
    _classCallCheck(this, ConversationsQuery);

    return _possibleConstructorReturn(this, (ConversationsQuery.__proto__ || Object.getPrototypeOf(ConversationsQuery)).apply(this, arguments));
  }

  _createClass(ConversationsQuery, [{
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var _this2 = this;

      var sortBy = this._getSortField();

      this.client.dbManager.loadConversations(sortBy, this._nextDBFromId, pageSize, function (conversations) {
        if (conversations.length) _this2._appendResults({ data: conversations }, true);
      });

      var newRequest = 'conversations?sort_by=' + sortBy + '&page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          telemetry: {
            name: 'conversation_query_time'
          },
          url: this._firingRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, newRequest, pageSize);
        });
      }
    }
  }, {
    key: '_getSortField',
    value: function _getSortField() {
      if (this.sortBy && this.sortBy[0] && this.sortBy[0]['lastMessage.sentAt']) {
        return 'last_message';
      } else {
        return 'created_at';
      }
    }
  }, {
    key: '_getItem',
    value: function _getItem(id) {
      switch (Util.typeFromID(id)) {
        case 'messages':
          for (var index = 0; index < this.data.length; index++) {
            var conversation = this.data[index];
            if (conversation.lastMessage && conversation.lastMessage.id === id) return conversation.lastMessage;
          }
          return null;
        case 'conversations':
          return _get(ConversationsQuery.prototype.__proto__ || Object.getPrototypeOf(ConversationsQuery.prototype), '_getItem', this).call(this, id);
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
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {
      switch (eventName) {

        // If a Conversation's property has changed, and the Conversation is in this
        // Query's data, then update it.
        case 'conversations:change':
          this._handleChangeEvent('conversations', evt);
          break;

        // If a Conversation is added, and it isn't already in the Query,
        // add it and trigger an event
        case 'conversations:add':
          this._handleAddEvent('conversations', evt);
          break;

        // If a Conversation is deleted, and its still in our data,
        // remove it and trigger an event.
        case 'conversations:remove':
          this._handleRemoveEvent('conversations', evt);
          break;
      }
    }

    // TODO WEB-968: Refactor this into functions for instance, object, sortBy createdAt, sortBy lastMessage

  }, {
    key: '_handleChangeEvent',
    value: function _handleChangeEvent(name, evt) {
      var index = this._getIndex(evt.target.id);

      // If its an ID change (matching Distinct Conversation returned by server) make sure to update our data.
      // If dataType is an instance, its been updated for us.
      if (this.dataType === Query.ObjectDataType) {
        var idChanges = evt.getChangesFor('id');
        if (idChanges.length) {
          index = this._getIndex(idChanges[0].oldValue);
        }
      }

      // If dataType is "object" then update the object and our array;
      // else the object is already updated.
      // Ignore results that aren't already in our data; Results are added via
      // conversations:add events.  Websocket Manager automatically loads anything that receives an event
      // for which we have no object, so we'll get the add event at that time.
      if (index !== -1) {
        var sortField = this._getSortField();
        var reorder = evt.hasProperty('lastMessage') && sortField === 'last_message';
        var newIndex = void 0;

        if (this.dataType === Query.ObjectDataType) {
          if (!reorder) {
            // Replace the changed Conversation with a new immutable object
            this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
          } else {
            newIndex = this._getInsertIndex(evt.target, this.data);
            this.data.splice(index, 1);
            this.data.splice(newIndex, 0, this._getData(evt.target));
            this.data = this.data.concat([]);
          }
        }

        // Else dataType is instance not object
        else if (reorder) {
            newIndex = this._getInsertIndex(evt.target, this.data);
            if (newIndex !== index) {
              this.data.splice(index, 1);
              this.data.splice(newIndex, 0, evt.target);
            }
          }

        // Trigger a 'property' event
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });

        if (reorder && newIndex !== index) {
          this._triggerChange({
            type: 'move',
            target: this._getData(evt.target),
            query: this,
            isChange: false,
            fromIndex: index,
            toIndex: newIndex
          });
        }
      }
    }
  }, {
    key: '_getInsertIndex',
    value: function _getInsertIndex(conversation, data) {
      if (!conversation.isSaved()) return 0;
      var sortField = this._getSortField();
      var index = void 0;
      if (sortField === 'created_at') {
        for (index = 0; index < data.length; index++) {
          var item = data[index];
          if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) {
            // No-op do not insert server data before new and unsaved data
          } else if (conversation.createdAt >= item.createdAt) {
            break;
          }
        }
        return index;
      } else {
        var oldIndex = -1;
        var d1 = conversation.lastMessage ? conversation.lastMessage.sentAt : conversation.createdAt;
        for (index = 0; index < data.length; index++) {
          var _item = data[index];
          if (_item.id === conversation.id) {
            oldIndex = index;
          } else if (_item.syncState === SYNC_STATE.NEW || _item.syncState === SYNC_STATE.SAVING) {
            // No-op do not insert server data before new and unsaved data
          } else {
            var d2 = _item.lastMessage ? _item.lastMessage.sentAt : _item.createdAt;
            if (d1 >= d2) break;
          }
        }
        return oldIndex === -1 || oldIndex > index ? index : index - 1;
      }
    }
  }, {
    key: '_handleAddEvent',
    value: function _handleAddEvent(name, evt) {
      var _this3 = this;

      // Filter out any Conversations already in our data
      var list = evt[name].filter(function (conversation) {
        return _this3._getIndex(conversation.id) === -1;
      });

      if (list.length) {
        var data = this.data;

        // typically bulk inserts happen via _appendResults(); so this array typically iterates over an array of length 1
        list.forEach(function (conversation) {
          var newIndex = _this3._getInsertIndex(conversation, data);
          data.splice(newIndex, 0, _this3._getData(conversation));

          if (_this3.dataType === Query.ObjectDataType) {
            _this3.data = [].concat(data);
          }
          _this3.totalSize += 1;

          var item = _this3._getData(conversation);
          _this3._triggerChange({
            type: 'insert',
            index: newIndex,
            target: item,
            query: _this3
          });
        });
      }
    }
  }, {
    key: '_handleRemoveEvent',
    value: function _handleRemoveEvent(name, evt) {
      var _this4 = this;

      var removed = [];
      evt[name].forEach(function (conversation) {
        var index = _this4._getIndex(conversation.id);
        if (index !== -1) {
          if (conversation.id === _this4._nextDBFromId) _this4._nextDBFromId = _this4._updateNextFromId(index);
          if (conversation.id === _this4._nextServerFromId) _this4._nextServerFromId = _this4._updateNextFromId(index);
          removed.push({
            data: conversation,
            index: index
          });
          if (_this4.dataType === Query.ObjectDataType) {
            _this4.data = [].concat(_toConsumableArray(_this4.data.slice(0, index)), _toConsumableArray(_this4.data.slice(index + 1)));
          } else {
            _this4.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this4._triggerChange({
          type: 'remove',
          index: removedObj.index,
          target: _this4._getData(removedObj.data),
          query: _this4
        });
      });
    }
  }]);

  return ConversationsQuery;
}(Query);

ConversationsQuery._supportedEvents = [].concat(Query._supportedEvents);

ConversationsQuery.MaxPageSize = 100;

ConversationsQuery.prototype.model = Query.Conversation;

Root.initClass.apply(ConversationsQuery, [ConversationsQuery, 'ConversationsQuery']);

module.exports = ConversationsQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2NvbnZlcnNhdGlvbnMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJVdGlsIiwiU1lOQ19TVEFURSIsIlF1ZXJ5IiwiQ29udmVyc2F0aW9uc1F1ZXJ5IiwicGFnZVNpemUiLCJzb3J0QnkiLCJfZ2V0U29ydEZpZWxkIiwiY2xpZW50IiwiZGJNYW5hZ2VyIiwibG9hZENvbnZlcnNhdGlvbnMiLCJfbmV4dERCRnJvbUlkIiwiY29udmVyc2F0aW9ucyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ0ZWxlbWV0cnkiLCJuYW1lIiwidXJsIiwibWV0aG9kIiwic3luYyIsIl9wcm9jZXNzUnVuUmVzdWx0cyIsInJlc3VsdHMiLCJpZCIsInR5cGVGcm9tSUQiLCJpbmRleCIsImNvbnZlcnNhdGlvbiIsImxhc3RNZXNzYWdlIiwiaXRlbSIsIl9nZXRJbnNlcnRJbmRleCIsInNwbGljZSIsIl9nZXREYXRhIiwiZXZlbnROYW1lIiwiZXZ0IiwiX2hhbmRsZUNoYW5nZUV2ZW50IiwiX2hhbmRsZUFkZEV2ZW50IiwiX2hhbmRsZVJlbW92ZUV2ZW50IiwiX2dldEluZGV4IiwidGFyZ2V0IiwiZGF0YVR5cGUiLCJPYmplY3REYXRhVHlwZSIsImlkQ2hhbmdlcyIsImdldENoYW5nZXNGb3IiLCJvbGRWYWx1ZSIsInNvcnRGaWVsZCIsInJlb3JkZXIiLCJoYXNQcm9wZXJ0eSIsIm5ld0luZGV4Iiwic2xpY2UiLCJ0b09iamVjdCIsImNvbmNhdCIsIl90cmlnZ2VyQ2hhbmdlIiwidHlwZSIsInF1ZXJ5IiwiaXNDaGFuZ2UiLCJjaGFuZ2VzIiwiZnJvbUluZGV4IiwidG9JbmRleCIsImlzU2F2ZWQiLCJzeW5jU3RhdGUiLCJORVciLCJTQVZJTkciLCJjcmVhdGVkQXQiLCJvbGRJbmRleCIsImQxIiwic2VudEF0IiwiZDIiLCJsaXN0IiwiZmlsdGVyIiwiZm9yRWFjaCIsInRvdGFsU2l6ZSIsInJlbW92ZWQiLCJfdXBkYXRlTmV4dEZyb21JZCIsInB1c2giLCJyZW1vdmVkT2JqIiwiX3N1cHBvcnRlZEV2ZW50cyIsIk1heFBhZ2VTaXplIiwicHJvdG90eXBlIiwibW9kZWwiLCJDb252ZXJzYXRpb24iLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFrQ0EsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxPQUFPRCxRQUFRLGlCQUFSLENBQWI7O2VBQ3VCQSxRQUFRLFVBQVIsQztJQUFmRSxVLFlBQUFBLFU7O0FBQ1IsSUFBTUMsUUFBUUgsUUFBUSxTQUFSLENBQWQ7O0lBRU1JLGtCOzs7Ozs7Ozs7OzsrQkFFT0MsUSxFQUFVO0FBQUE7O0FBQ25CLFVBQU1DLFNBQVMsS0FBS0MsYUFBTCxFQUFmOztBQUVBLFdBQUtDLE1BQUwsQ0FBWUMsU0FBWixDQUFzQkMsaUJBQXRCLENBQXdDSixNQUF4QyxFQUFnRCxLQUFLSyxhQUFyRCxFQUFvRU4sUUFBcEUsRUFBOEUsVUFBQ08sYUFBRCxFQUFtQjtBQUMvRixZQUFJQSxjQUFjQyxNQUFsQixFQUEwQixPQUFLQyxjQUFMLENBQW9CLEVBQUVDLE1BQU1ILGFBQVIsRUFBcEIsRUFBNkMsSUFBN0M7QUFDM0IsT0FGRDs7QUFJQSxVQUFNSSxhQUFhLDJCQUF5QlYsTUFBekIsbUJBQTZDRCxRQUE3QyxJQUNoQixLQUFLWSxpQkFBTCxHQUF5QixjQUFjLEtBQUtBLGlCQUE1QyxHQUFnRSxFQURoRCxDQUFuQjs7QUFHQSxVQUFJRCxlQUFlLEtBQUtFLGNBQXhCLEVBQXdDO0FBQ3RDLGFBQUtDLFFBQUwsR0FBZ0IsSUFBaEI7QUFDQSxhQUFLRCxjQUFMLEdBQXNCRixVQUF0QjtBQUNBLGFBQUtSLE1B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SzZDLFNBQUwsSUFBa0JDLFFBQVEvRCxNQUExQjtBQUNBK0QsY0FBUUYsT0FBUixDQUFnQixVQUFDSyxVQUFELEVBQWdCO0FBQzlCLGVBQUt2QixjQUFMLENBQW9CO0FBQ2xCQyxnQkFBTSxRQURZO0FBRWxCM0IsaUJBQU9pRCxXQUFXakQsS0FGQTtBQUdsQmEsa0JBQVEsT0FBS1AsUUFBTCxDQUFjMkMsV0FBV2hFLElBQXpCLENBSFU7QUFJbEIyQztBQUprQixTQUFwQjtBQU1ELE9BUEQ7QUFRRDs7OztFQTdPOEJ2RCxLOztBQWdQakNDLG1CQUFtQjRFLGdCQUFuQixHQUFzQyxHQUVwQ3pCLE1BRm9DLENBRTdCcEQsTUFBTTZFLGdCQUZ1QixDQUF0Qzs7QUFLQTVFLG1CQUFtQjZFLFdBQW5CLEdBQWlDLEdBQWpDOztBQUVBN0UsbUJBQW1COEUsU0FBbkIsQ0FBNkJDLEtBQTdCLEdBQXFDaEYsTUFBTWlGLFlBQTNDOztBQUVBckYsS0FBS3NGLFNBQUwsQ0FBZUMsS0FBZixDQUFxQmxGLGtCQUFyQixFQUF5QyxDQUFDQSxrQkFBRCxFQUFxQixvQkFBckIsQ0FBekM7O0FBRUFtRixPQUFPQyxPQUFQLEdBQWlCcEYsa0JBQWpCIiwiZmlsZSI6ImNvbnZlcnNhdGlvbnMtcXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFF1ZXJ5IGNsYXNzIGZvciBydW5uaW5nIGEgUXVlcnkgb24gQ29udmVyc2F0aW9ucy5cbiAqXG4gKlxuICogICAgICB2YXIgY29udmVyc2F0aW9uUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5Db252ZXJzYXRpb24sXG4gKiAgICAgICAgc29ydEJ5OiBbeydjcmVhdGVkQXQnOiAnZGVzYyd9XVxuICogICAgICB9KTtcbiAqXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGBwYWdpbmF0aW9uV2luZG93YCBhbmQgYHNvcnRCeWAgcHJvcGVydGllcyBhdCBhbnkgdGltZSB1c2luZzpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gKiAgICAgIH0pO1xuICpcbiAqIFlvdSBjYW4gcmVsZWFzZSBkYXRhIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqICMjIyMgc29ydEJ5XG4gKlxuICogTm90ZSB0aGF0IHRoZSBgc29ydEJ5YCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgQ29udmVyc2F0aW9ucyBhdCB0aGlzIHRpbWUgYW5kIG9ubHlcbiAqIHN1cHBvcnRzIFwiY3JlYXRlZEF0XCIgYW5kIFwibGFzdE1lc3NhZ2Uuc2VudEF0XCIgYXMgc29ydCBmaWVsZHMsIGFuZCBvbmx5IHN1cHBvcnRzIGBkZXNjYCBzb3J0IGRpcmVjdGlvbi5cbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgc29ydEJ5OiBbeydsYXN0TWVzc2FnZS5zZW50QXQnOiAnZGVzYyd9XVxuICogICAgICB9KTtcbiAqXG4gKlxuICogQGNsYXNzICBsYXllci5Db252ZXJzYXRpb25zUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5XG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCB7IFNZTkNfU1RBVEUgfSA9IHJlcXVpcmUoJy4uL2NvbnN0Jyk7XG5jb25zdCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcblxuY2xhc3MgQ29udmVyc2F0aW9uc1F1ZXJ5IGV4dGVuZHMgUXVlcnkge1xuXG4gIF9mZXRjaERhdGEocGFnZVNpemUpIHtcbiAgICBjb25zdCBzb3J0QnkgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcblxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQ29udmVyc2F0aW9ucyhzb3J0QnksIHRoaXMuX25leHREQkZyb21JZCwgcGFnZVNpemUsIChjb252ZXJzYXRpb25zKSA9PiB7XG4gICAgICBpZiAoY29udmVyc2F0aW9ucy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBjb252ZXJzYXRpb25zIH0sIHRydWUpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3UmVxdWVzdCA9IGBjb252ZXJzYXRpb25zP3NvcnRfYnk9JHtzb3J0Qnl9JnBhZ2Vfc2l6ZT0ke3BhZ2VTaXplfWAgK1xuICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICBpZiAobmV3UmVxdWVzdCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCkge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHRlbGVtZXRyeToge1xuICAgICAgICAgIG5hbWU6ICdjb252ZXJzYXRpb25fcXVlcnlfdGltZScsXG4gICAgICAgIH0sXG4gICAgICAgIHVybDogdGhpcy5fZmlyaW5nUmVxdWVzdCxcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICB9LCByZXN1bHRzID0+IHRoaXMuX3Byb2Nlc3NSdW5SZXN1bHRzKHJlc3VsdHMsIG5ld1JlcXVlc3QsIHBhZ2VTaXplKSk7XG4gICAgfVxuICB9XG5cbiAgX2dldFNvcnRGaWVsZCgpIHtcbiAgICBpZiAodGhpcy5zb3J0QnkgJiYgdGhpcy5zb3J0QnlbMF0gJiYgdGhpcy5zb3J0QnlbMF1bJ2xhc3RNZXNzYWdlLnNlbnRBdCddKSB7XG4gICAgICByZXR1cm4gJ2xhc3RfbWVzc2FnZSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnY3JlYXRlZF9hdCc7XG4gICAgfVxuICB9XG5cbiAgX2dldEl0ZW0oaWQpIHtcbiAgICBzd2l0Y2ggKFV0aWwudHlwZUZyb21JRChpZCkpIHtcbiAgICAgIGNhc2UgJ21lc3NhZ2VzJzpcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmRhdGFbaW5kZXhdO1xuICAgICAgICAgIGlmIChjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgJiYgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLmlkID09PSBpZCkgcmV0dXJuIGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICByZXR1cm4gc3VwZXIuX2dldEl0ZW0oaWQpO1xuICAgIH1cbiAgfVxuXG4gIF9hcHBlbmRSZXN1bHRzU3BsaWNlKGl0ZW0pIHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoaXRlbSwgZGF0YSk7XG4gICAgZGF0YS5zcGxpY2UoaW5kZXgsIDAsIHRoaXMuX2dldERhdGEoaXRlbSkpO1xuICB9XG5cbiAgX2hhbmRsZUV2ZW50cyhldmVudE5hbWUsIGV2dCkge1xuICAgIHN3aXRjaCAoZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uJ3MgcHJvcGVydHkgaGFzIGNoYW5nZWQsIGFuZCB0aGUgQ29udmVyc2F0aW9uIGlzIGluIHRoaXNcbiAgICAgIC8vIFF1ZXJ5J3MgZGF0YSwgdGhlbiB1cGRhdGUgaXQuXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zOmNoYW5nZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUNoYW5nZUV2ZW50KCdjb252ZXJzYXRpb25zJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uIGlzIGFkZGVkLCBhbmQgaXQgaXNuJ3QgYWxyZWFkeSBpbiB0aGUgUXVlcnksXG4gICAgICAvLyBhZGQgaXQgYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnM6YWRkJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQWRkRXZlbnQoJ2NvbnZlcnNhdGlvbnMnLCBldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24gaXMgZGVsZXRlZCwgYW5kIGl0cyBzdGlsbCBpbiBvdXIgZGF0YSxcbiAgICAgIC8vIHJlbW92ZSBpdCBhbmQgdHJpZ2dlciBhbiBldmVudC5cbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlUmVtb3ZlRXZlbnQoJ2NvbnZlcnNhdGlvbnMnLCBldnQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPIFdFQi05Njg6IFJlZmFjdG9yIHRoaXMgaW50byBmdW5jdGlvbnMgZm9yIGluc3RhbmNlLCBvYmplY3QsIHNvcnRCeSBjcmVhdGVkQXQsIHNvcnRCeSBsYXN0TWVzc2FnZVxuICBfaGFuZGxlQ2hhbmdlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG5cbiAgICAvLyBJZiBpdHMgYW4gSUQgY2hhbmdlIChtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gcmV0dXJuZWQgYnkgc2VydmVyKSBtYWtlIHN1cmUgdG8gdXBkYXRlIG91ciBkYXRhLlxuICAgIC8vIElmIGRhdGFUeXBlIGlzIGFuIGluc3RhbmNlLCBpdHMgYmVlbiB1cGRhdGVkIGZvciB1cy5cbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIGNvbnN0IGlkQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdpZCcpO1xuICAgICAgaWYgKGlkQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZENoYW5nZXNbMF0ub2xkVmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIGRhdGFUeXBlIGlzIFwib2JqZWN0XCIgdGhlbiB1cGRhdGUgdGhlIG9iamVjdCBhbmQgb3VyIGFycmF5O1xuICAgIC8vIGVsc2UgdGhlIG9iamVjdCBpcyBhbHJlYWR5IHVwZGF0ZWQuXG4gICAgLy8gSWdub3JlIHJlc3VsdHMgdGhhdCBhcmVuJ3QgYWxyZWFkeSBpbiBvdXIgZGF0YTsgUmVzdWx0cyBhcmUgYWRkZWQgdmlhXG4gICAgLy8gY29udmVyc2F0aW9uczphZGQgZXZlbnRzLiAgV2Vic29ja2V0IE1hbmFnZXIgYXV0b21hdGljYWxseSBsb2FkcyBhbnl0aGluZyB0aGF0IHJlY2VpdmVzIGFuIGV2ZW50XG4gICAgLy8gZm9yIHdoaWNoIHdlIGhhdmUgbm8gb2JqZWN0LCBzbyB3ZSdsbCBnZXQgdGhlIGFkZCBldmVudCBhdCB0aGF0IHRpbWUuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3Qgc29ydEZpZWxkID0gdGhpcy5fZ2V0U29ydEZpZWxkKCk7XG4gICAgICBjb25zdCByZW9yZGVyID0gZXZ0Lmhhc1Byb3BlcnR5KCdsYXN0TWVzc2FnZScpICYmIHNvcnRGaWVsZCA9PT0gJ2xhc3RfbWVzc2FnZSc7XG4gICAgICBsZXQgbmV3SW5kZXg7XG5cbiAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICBpZiAoIXJlb3JkZXIpIHtcbiAgICAgICAgICAvLyBSZXBsYWNlIHRoZSBjaGFuZ2VkIENvbnZlcnNhdGlvbiB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGV2dC50YXJnZXQsIHRoaXMuZGF0YSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChbXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRWxzZSBkYXRhVHlwZSBpcyBpbnN0YW5jZSBub3Qgb2JqZWN0XG4gICAgICBlbHNlIGlmIChyZW9yZGVyKSB7XG4gICAgICAgIG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoZXZ0LnRhcmdldCwgdGhpcy5kYXRhKTtcbiAgICAgICAgaWYgKG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIGV2dC50YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRyaWdnZXIgYSAncHJvcGVydHknIGV2ZW50XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZW9yZGVyICYmIG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnbW92ZScsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgICAgICBmcm9tSW5kZXg6IGluZGV4LFxuICAgICAgICAgIHRvSW5kZXg6IG5ld0luZGV4LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZ2V0SW5zZXJ0SW5kZXgoY29udmVyc2F0aW9uLCBkYXRhKSB7XG4gICAgaWYgKCFjb252ZXJzYXRpb24uaXNTYXZlZCgpKSByZXR1cm4gMDtcbiAgICBjb25zdCBzb3J0RmllbGQgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcbiAgICBsZXQgaW5kZXg7XG4gICAgaWYgKHNvcnRGaWVsZCA9PT0gJ2NyZWF0ZWRfYXQnKSB7XG4gICAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBkYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBpdGVtID0gZGF0YVtpbmRleF07XG4gICAgICAgIGlmIChpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5ORVcgfHwgaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuU0FWSU5HKSB7XG4gICAgICAgICAgLy8gTm8tb3AgZG8gbm90IGluc2VydCBzZXJ2ZXIgZGF0YSBiZWZvcmUgbmV3IGFuZCB1bnNhdmVkIGRhdGFcbiAgICAgICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb24uY3JlYXRlZEF0ID49IGl0ZW0uY3JlYXRlZEF0KSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9sZEluZGV4ID0gLTE7XG4gICAgICBjb25zdCBkMSA9IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSA/IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5zZW50QXQgOiBjb252ZXJzYXRpb24uY3JlYXRlZEF0O1xuICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoaXRlbS5pZCA9PT0gY29udmVyc2F0aW9uLmlkKSB7XG4gICAgICAgICAgb2xkSW5kZXggPSBpbmRleDtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5ORVcgfHwgaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuU0FWSU5HKSB7XG4gICAgICAgICAgLy8gTm8tb3AgZG8gbm90IGluc2VydCBzZXJ2ZXIgZGF0YSBiZWZvcmUgbmV3IGFuZCB1bnNhdmVkIGRhdGFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBkMiA9IGl0ZW0ubGFzdE1lc3NhZ2UgPyBpdGVtLmxhc3RNZXNzYWdlLnNlbnRBdCA6IGl0ZW0uY3JlYXRlZEF0O1xuICAgICAgICAgIGlmIChkMSA+PSBkMikgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvbGRJbmRleCA9PT0gLTEgfHwgb2xkSW5kZXggPiBpbmRleCA/IGluZGV4IDogaW5kZXggLSAxO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVBZGRFdmVudChuYW1lLCBldnQpIHtcbiAgICAvLyBGaWx0ZXIgb3V0IGFueSBDb252ZXJzYXRpb25zIGFscmVhZHkgaW4gb3VyIGRhdGFcbiAgICBjb25zdCBsaXN0ID0gZXZ0W25hbWVdLmZpbHRlcihjb252ZXJzYXRpb24gPT4gdGhpcy5fZ2V0SW5kZXgoY29udmVyc2F0aW9uLmlkKSA9PT0gLTEpO1xuXG5cbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG5cbiAgICAgIC8vIHR5cGljYWxseSBidWxrIGluc2VydHMgaGFwcGVuIHZpYSBfYXBwZW5kUmVzdWx0cygpOyBzbyB0aGlzIGFycmF5IHR5cGljYWxseSBpdGVyYXRlcyBvdmVyIGFuIGFycmF5IG9mIGxlbmd0aCAxXG4gICAgICBsaXN0LmZvckVhY2goKGNvbnZlcnNhdGlvbikgPT4ge1xuICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGNvbnZlcnNhdGlvbiwgZGF0YSk7XG4gICAgICAgIGRhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCB0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbikpO1xuXG5cbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gW10uY29uY2F0KGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudG90YWxTaXplICs9IDE7XG5cbiAgICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX2dldERhdGEoY29udmVyc2F0aW9uKTtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgaW5kZXg6IG5ld0luZGV4LFxuICAgICAgICAgIHRhcmdldDogaXRlbSxcbiAgICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuXG4gIF9oYW5kbGVSZW1vdmVFdmVudChuYW1lLCBldnQpIHtcbiAgICBjb25zdCByZW1vdmVkID0gW107XG4gICAgZXZ0W25hbWVdLmZvckVhY2goKGNvbnZlcnNhdGlvbikgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChjb252ZXJzYXRpb24uaWQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmlkID09PSB0aGlzLl9uZXh0REJGcm9tSWQpIHRoaXMuX25leHREQkZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmlkID09PSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkKSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIHJlbW92ZWQucHVzaCh7XG4gICAgICAgICAgZGF0YTogY29udmVyc2F0aW9uLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gWy4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEocmVtb3ZlZE9iai5kYXRhKSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5Db252ZXJzYXRpb25zUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuQ29udmVyc2F0aW9uc1F1ZXJ5Lk1heFBhZ2VTaXplID0gMTAwO1xuXG5Db252ZXJzYXRpb25zUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuQ29udmVyc2F0aW9uO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb252ZXJzYXRpb25zUXVlcnksIFtDb252ZXJzYXRpb25zUXVlcnksICdDb252ZXJzYXRpb25zUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29udmVyc2F0aW9uc1F1ZXJ5O1xuIl19
