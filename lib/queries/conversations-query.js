'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Conversations
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
        list.forEach(function (conversation) {
          var newIndex = _this3._getInsertIndex(conversation, data);
          data.splice(newIndex, 0, _this3._getData(conversation));
        });

        // Whether sorting by last_message or created_at, new results go at the top of the list
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(data);
        }
        this.totalSize += list.length;

        // Trigger an 'insert' event for each item added;
        // typically bulk inserts happen via _appendResults().
        list.forEach(function (conversation) {
          var item = _this3._getData(conversation);
          _this3._triggerChange({
            type: 'insert',
            index: _this3.data.indexOf(item),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2NvbnZlcnNhdGlvbnMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJVdGlsIiwiU1lOQ19TVEFURSIsIlF1ZXJ5IiwiQ29udmVyc2F0aW9uc1F1ZXJ5IiwicGFnZVNpemUiLCJzb3J0QnkiLCJfZ2V0U29ydEZpZWxkIiwiY2xpZW50IiwiZGJNYW5hZ2VyIiwibG9hZENvbnZlcnNhdGlvbnMiLCJfbmV4dERCRnJvbUlkIiwiY29udmVyc2F0aW9ucyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsImlkIiwidHlwZUZyb21JRCIsImluZGV4IiwiY29udmVyc2F0aW9uIiwibGFzdE1lc3NhZ2UiLCJpdGVtIiwiX2dldEluc2VydEluZGV4Iiwic3BsaWNlIiwiX2dldERhdGEiLCJldmVudE5hbWUiLCJldnQiLCJfaGFuZGxlQ2hhbmdlRXZlbnQiLCJfaGFuZGxlQWRkRXZlbnQiLCJfaGFuZGxlUmVtb3ZlRXZlbnQiLCJuYW1lIiwiX2dldEluZGV4IiwidGFyZ2V0IiwiZGF0YVR5cGUiLCJPYmplY3REYXRhVHlwZSIsImlkQ2hhbmdlcyIsImdldENoYW5nZXNGb3IiLCJvbGRWYWx1ZSIsInNvcnRGaWVsZCIsInJlb3JkZXIiLCJoYXNQcm9wZXJ0eSIsIm5ld0luZGV4Iiwic2xpY2UiLCJ0b09iamVjdCIsImNvbmNhdCIsIl90cmlnZ2VyQ2hhbmdlIiwidHlwZSIsInF1ZXJ5IiwiaXNDaGFuZ2UiLCJjaGFuZ2VzIiwiZnJvbUluZGV4IiwidG9JbmRleCIsImlzU2F2ZWQiLCJzeW5jU3RhdGUiLCJORVciLCJTQVZJTkciLCJjcmVhdGVkQXQiLCJvbGRJbmRleCIsImQxIiwic2VudEF0IiwiZDIiLCJsaXN0IiwiZmlsdGVyIiwiZm9yRWFjaCIsInRvdGFsU2l6ZSIsImluZGV4T2YiLCJyZW1vdmVkIiwiX3VwZGF0ZU5leHRGcm9tSWQiLCJwdXNoIiwicmVtb3ZlZE9iaiIsIl9zdXBwb3J0ZWRFdmVudHMiLCJNYXhQYWdlU2l6ZSIsInByb3RvdHlwZSIsIm1vZGVsIiwiQ29udmVyc2F0aW9uIiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLE9BQU9ELFFBQVEsaUJBQVIsQ0FBYjs7ZUFDdUJBLFFBQVEsVUFBUixDO0lBQWZFLFUsWUFBQUEsVTs7QUFDUixJQUFNQyxRQUFRSCxRQUFRLFNBQVIsQ0FBZDs7SUFFTUksa0I7Ozs7Ozs7Ozs7OytCQUVPQyxRLEVBQVU7QUFBQTs7QUFDbkIsVUFBTUMsU0FBUyxLQUFLQyxhQUFMLEVBQWY7O0FBRUEsV0FBS0MsTUFBTCxDQUFZQyxTQUFaLENBQXNCQyxpQkFBdEIsQ0FBd0NKLE1BQXhDLEVBQWdELEtBQUtLLGFBQXJELEVBQW9FTixRQUFwRSxFQUE4RSxVQUFDTyxhQUFELEVBQW1CO0FBQy9GLFlBQUlBLGNBQWNDLE1BQWxCLEVBQTBCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsYUFBUixFQUFwQixFQUE2QyxJQUE3QztBQUMzQixPQUZEOztBQUlBLFVBQU1JLGFBQWEsMkJBQXlCVixNQUF6QixtQkFBNkNELFFBQTdDLElBQ2hCLEtBQUtZLGlCQUFMLEdBQXlCLGNBQWMsS0FBS0EsaUJBQTVDLEdBQWdFLEVBRGhELENBQW5COztBQUdBLFVBQUlELGVBQWUsS0FBS0UsY0FBeEIsRUFBd0M7QUFDdEMsYUFBS0MsUUFBTCxHQUFnQixJQUFoQjtBQUNBLGFBQUtELGNBQUwsR0FBc0JGLFVBQXRCO0FBQ0EsYUFBS1IsTUFBTCxDQUFZWSxHQUFaLENBQWdCO0FBQ2RDLGVBQUss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QUNGLE9BZkQ7O0FBaUJBLFdBQUs4QyxTQUFMLElBQWtCRSxRQUFRL0QsTUFBMUI7QUFDQStELGNBQVFILE9BQVIsQ0FBZ0IsVUFBQ00sVUFBRCxFQUFnQjtBQUM5QixlQUFLeEIsY0FBTCxDQUFvQjtBQUNsQkMsZ0JBQU0sUUFEWTtBQUVsQjVCLGlCQUFPbUQsV0FBV25ELEtBRkE7QUFHbEJjLGtCQUFRLE9BQUtSLFFBQUwsQ0FBYzZDLFdBQVdoRSxJQUF6QixDQUhVO0FBSWxCMEM7QUFKa0IsU0FBcEI7QUFNRCxPQVBEO0FBUUQ7Ozs7RUEzTzhCdEQsSzs7QUE4T2pDQyxtQkFBbUI0RSxnQkFBbkIsR0FBc0MsR0FFcEMxQixNQUZvQyxDQUU3Qm5ELE1BQU02RSxnQkFGdUIsQ0FBdEM7O0FBS0E1RSxtQkFBbUI2RSxXQUFuQixHQUFpQyxHQUFqQzs7QUFFQTdFLG1CQUFtQjhFLFNBQW5CLENBQTZCQyxLQUE3QixHQUFxQ2hGLE1BQU1pRixZQUEzQzs7QUFFQXJGLEtBQUtzRixTQUFMLENBQWVDLEtBQWYsQ0FBcUJsRixrQkFBckIsRUFBeUMsQ0FBQ0Esa0JBQUQsRUFBcUIsb0JBQXJCLENBQXpDOztBQUVBbUYsT0FBT0MsT0FBUCxHQUFpQnBGLGtCQUFqQiIsImZpbGUiOiJjb252ZXJzYXRpb25zLXF1ZXJ5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBRdWVyeSBjbGFzcyBmb3IgcnVubmluZyBhIFF1ZXJ5IG9uIENvbnZlcnNhdGlvbnNcbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNvbnZlcnNhdGlvbnNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IHsgU1lOQ19TVEFURSB9ID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuXG5jbGFzcyBDb252ZXJzYXRpb25zUXVlcnkgZXh0ZW5kcyBRdWVyeSB7XG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHNvcnRCeSA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuXG4gICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRDb252ZXJzYXRpb25zKHNvcnRCeSwgdGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKGNvbnZlcnNhdGlvbnMpID0+IHtcbiAgICAgIGlmIChjb252ZXJzYXRpb25zLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IGNvbnZlcnNhdGlvbnMgfSwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGNvbnZlcnNhdGlvbnM/c29ydF9ieT0ke3NvcnRCeX0mcGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIGlmIChuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiB0aGlzLl9maXJpbmdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U29ydEZpZWxkKCkge1xuICAgIGlmICh0aGlzLnNvcnRCeSAmJiB0aGlzLnNvcnRCeVswXSAmJiB0aGlzLnNvcnRCeVswXVsnbGFzdE1lc3NhZ2Uuc2VudEF0J10pIHtcbiAgICAgIHJldHVybiAnbGFzdF9tZXNzYWdlJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdjcmVhdGVkX2F0JztcbiAgICB9XG4gIH1cblxuICBfZ2V0SXRlbShpZCkge1xuICAgIHN3aXRjaCAoVXRpbC50eXBlRnJvbUlEKGlkKSkge1xuICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZGF0YVtpbmRleF07XG4gICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSAmJiBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UuaWQgPT09IGlkKSByZXR1cm4gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gICAgICAgIHJldHVybiBzdXBlci5fZ2V0SXRlbShpZCk7XG4gICAgfVxuICB9XG5cbiAgX2FwcGVuZFJlc3VsdHNTcGxpY2UoaXRlbSkge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbnNlcnRJbmRleChpdGVtLCBkYXRhKTtcbiAgICBkYXRhLnNwbGljZShpbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuICBfaGFuZGxlRXZlbnRzKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgc3dpdGNoIChldmVudE5hbWUpIHtcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24ncyBwcm9wZXJ0eSBoYXMgY2hhbmdlZCwgYW5kIHRoZSBDb252ZXJzYXRpb24gaXMgaW4gdGhpc1xuICAgICAgLy8gUXVlcnkncyBkYXRhLCB0aGVuIHVwZGF0ZSBpdC5cbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ2hhbmdlRXZlbnQoJ2NvbnZlcnNhdGlvbnMnLCBldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24gaXMgYWRkZWQsIGFuZCBpdCBpc24ndCBhbHJlYWR5IGluIHRoZSBRdWVyeSxcbiAgICAgIC8vIGFkZCBpdCBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnY29udmVyc2F0aW9ucycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbiBpcyBkZWxldGVkLCBhbmQgaXRzIHN0aWxsIGluIG91ciBkYXRhLFxuICAgICAgLy8gcmVtb3ZlIGl0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50LlxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVSZW1vdmVFdmVudCgnY29udmVyc2F0aW9ucycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE8gV0VCLTk2ODogUmVmYWN0b3IgdGhpcyBpbnRvIGZ1bmN0aW9ucyBmb3IgaW5zdGFuY2UsIG9iamVjdCwgc29ydEJ5IGNyZWF0ZWRBdCwgc29ydEJ5IGxhc3RNZXNzYWdlXG4gIF9oYW5kbGVDaGFuZ2VFdmVudChuYW1lLCBldnQpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLl9nZXRJbmRleChldnQudGFyZ2V0LmlkKTtcblxuICAgIC8vIElmIGl0cyBhbiBJRCBjaGFuZ2UgKG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiByZXR1cm5lZCBieSBzZXJ2ZXIpIG1ha2Ugc3VyZSB0byB1cGRhdGUgb3VyIGRhdGEuXG4gICAgLy8gSWYgZGF0YVR5cGUgaXMgYW4gaW5zdGFuY2UsIGl0cyBiZWVuIHVwZGF0ZWQgZm9yIHVzLlxuICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgY29uc3QgaWRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2lkJyk7XG4gICAgICBpZiAoaWRDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgICBpbmRleCA9IHRoaXMuX2dldEluZGV4KGlkQ2hhbmdlc1swXS5vbGRWYWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgZGF0YVR5cGUgaXMgXCJvYmplY3RcIiB0aGVuIHVwZGF0ZSB0aGUgb2JqZWN0IGFuZCBvdXIgYXJyYXk7XG4gICAgLy8gZWxzZSB0aGUgb2JqZWN0IGlzIGFscmVhZHkgdXBkYXRlZC5cbiAgICAvLyBJZ25vcmUgcmVzdWx0cyB0aGF0IGFyZW4ndCBhbHJlYWR5IGluIG91ciBkYXRhOyBSZXN1bHRzIGFyZSBhZGRlZCB2aWFcbiAgICAvLyBjb252ZXJzYXRpb25zOmFkZCBldmVudHMuICBXZWJzb2NrZXQgTWFuYWdlciBhdXRvbWF0aWNhbGx5IGxvYWRzIGFueXRoaW5nIHRoYXQgcmVjZWl2ZXMgYW4gZXZlbnRcbiAgICAvLyBmb3Igd2hpY2ggd2UgaGF2ZSBubyBvYmplY3QsIHNvIHdlJ2xsIGdldCB0aGUgYWRkIGV2ZW50IGF0IHRoYXQgdGltZS5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBzb3J0RmllbGQgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcbiAgICAgIGNvbnN0IHJlb3JkZXIgPSBldnQuaGFzUHJvcGVydHkoJ2xhc3RNZXNzYWdlJykgJiYgc29ydEZpZWxkID09PSAnbGFzdF9tZXNzYWdlJztcbiAgICAgIGxldCBuZXdJbmRleDtcblxuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIGlmICghcmVvcmRlcikge1xuICAgICAgICAgIC8vIFJlcGxhY2UgdGhlIGNoYW5nZWQgQ29udmVyc2F0aW9uIHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgICBldnQudGFyZ2V0LnRvT2JqZWN0KCksXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoZXZ0LnRhcmdldCwgdGhpcy5kYXRhKTtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpKTtcbiAgICAgICAgICB0aGlzLmRhdGEgPSB0aGlzLmRhdGEuY29uY2F0KFtdKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBFbHNlIGRhdGFUeXBlIGlzIGluc3RhbmNlIG5vdCBvYmplY3RcbiAgICAgIGVsc2UgaWYgKHJlb3JkZXIpIHtcbiAgICAgICAgbmV3SW5kZXggPSB0aGlzLl9nZXRJbnNlcnRJbmRleChldnQudGFyZ2V0LCB0aGlzLmRhdGEpO1xuICAgICAgICBpZiAobmV3SW5kZXggIT09IGluZGV4KSB7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgZXZ0LnRhcmdldCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVHJpZ2dlciBhICdwcm9wZXJ0eScgZXZlbnRcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlb3JkZXIgJiYgbmV3SW5kZXggIT09IGluZGV4KSB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdtb3ZlJyxcbiAgICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgICAgaXNDaGFuZ2U6IGZhbHNlLFxuICAgICAgICAgIGZyb21JbmRleDogaW5kZXgsXG4gICAgICAgICAgdG9JbmRleDogbmV3SW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9nZXRJbnNlcnRJbmRleChjb252ZXJzYXRpb24sIGRhdGEpIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbi5pc1NhdmVkKCkpIHJldHVybiAwO1xuICAgIGNvbnN0IHNvcnRGaWVsZCA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuICAgIGxldCBpbmRleDtcbiAgICBpZiAoc29ydEZpZWxkID09PSAnY3JlYXRlZF9hdCcpIHtcbiAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBkYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIHtcbiAgICAgICAgICAvLyBOby1vcCBkbyBub3QgaW5zZXJ0IHNlcnZlciBkYXRhIGJlZm9yZSBuZXcgYW5kIHVuc2F2ZWQgZGF0YVxuICAgICAgICB9IGVsc2UgaWYgKGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQgPj0gaXRlbS5jcmVhdGVkQXQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgb2xkSW5kZXggPSAtMTtcbiAgICAgIGNvbnN0IGQxID0gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID8gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLnNlbnRBdCA6IGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQ7XG4gICAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBkYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBpdGVtID0gZGF0YVtpbmRleF07XG4gICAgICAgIGlmIChpdGVtLmlkID09PSBjb252ZXJzYXRpb24uaWQpIHtcbiAgICAgICAgICBvbGRJbmRleCA9IGluZGV4O1xuICAgICAgICB9IGVsc2UgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIHtcbiAgICAgICAgICAvLyBOby1vcCBkbyBub3QgaW5zZXJ0IHNlcnZlciBkYXRhIGJlZm9yZSBuZXcgYW5kIHVuc2F2ZWQgZGF0YVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGQyID0gaXRlbS5sYXN0TWVzc2FnZSA/IGl0ZW0ubGFzdE1lc3NhZ2Uuc2VudEF0IDogaXRlbS5jcmVhdGVkQXQ7XG4gICAgICAgICAgaWYgKGQxID49IGQyKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9sZEluZGV4ID09PSAtMSB8fCBvbGRJbmRleCA+IGluZGV4ID8gaW5kZXggOiBpbmRleCAtIDE7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZUFkZEV2ZW50KG5hbWUsIGV2dCkge1xuICAgIC8vIEZpbHRlciBvdXQgYW55IENvbnZlcnNhdGlvbnMgYWxyZWFkeSBpbiBvdXIgZGF0YVxuICAgIGNvbnN0IGxpc3QgPSBldnRbbmFtZV0uZmlsdGVyKGNvbnZlcnNhdGlvbiA9PiB0aGlzLl9nZXRJbmRleChjb252ZXJzYXRpb24uaWQpID09PSAtMSk7XG5cbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICBsaXN0LmZvckVhY2goKGNvbnZlcnNhdGlvbikgPT4ge1xuICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGNvbnZlcnNhdGlvbiwgZGF0YSk7XG4gICAgICAgIGRhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCB0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbikpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFdoZXRoZXIgc29ydGluZyBieSBsYXN0X21lc3NhZ2Ugb3IgY3JlYXRlZF9hdCwgbmV3IHJlc3VsdHMgZ28gYXQgdGhlIHRvcCBvZiB0aGUgbGlzdFxuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtdLmNvbmNhdChkYXRhKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudG90YWxTaXplICs9IGxpc3QubGVuZ3RoO1xuXG4gICAgICAvLyBUcmlnZ2VyIGFuICdpbnNlcnQnIGV2ZW50IGZvciBlYWNoIGl0ZW0gYWRkZWQ7XG4gICAgICAvLyB0eXBpY2FsbHkgYnVsayBpbnNlcnRzIGhhcHBlbiB2aWEgX2FwcGVuZFJlc3VsdHMoKS5cbiAgICAgIGxpc3QuZm9yRWFjaCgoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbik7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgIGluZGV4OiB0aGlzLmRhdGEuaW5kZXhPZihpdGVtKSxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cblxuICBfaGFuZGxlUmVtb3ZlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dFtuYW1lXS5mb3JFYWNoKChjb252ZXJzYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoY29udmVyc2F0aW9uLmlkKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgaWYgKGNvbnZlcnNhdGlvbi5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKGNvbnZlcnNhdGlvbi5pZCA9PT0gdGhpcy5fbmV4dFNlcnZlckZyb21JZCkgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICByZW1vdmVkLnB1c2goe1xuICAgICAgICAgIGRhdGE6IGNvbnZlcnNhdGlvbixcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFsuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLCAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMudG90YWxTaXplIC09IHJlbW92ZWQubGVuZ3RoO1xuICAgIHJlbW92ZWQuZm9yRWFjaCgocmVtb3ZlZE9iaikgPT4ge1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICBpbmRleDogcmVtb3ZlZE9iai5pbmRleCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKHJlbW92ZWRPYmouZGF0YSksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuQ29udmVyc2F0aW9uc1F1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG5cbl0uY29uY2F0KFF1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5cbkNvbnZlcnNhdGlvbnNRdWVyeS5NYXhQYWdlU2l6ZSA9IDEwMDtcblxuQ29udmVyc2F0aW9uc1F1ZXJ5LnByb3RvdHlwZS5tb2RlbCA9IFF1ZXJ5LkNvbnZlcnNhdGlvbjtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ29udmVyc2F0aW9uc1F1ZXJ5LCBbQ29udmVyc2F0aW9uc1F1ZXJ5LCAnQ29udmVyc2F0aW9uc1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvbnNRdWVyeTtcbiJdfQ==
