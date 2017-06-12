'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* Feature is tested but not available on server
 * Query class for running a Query on Channels
 *
 * @class  layer.ChannelsQuery
 * @extends layer.Query
 */
var Root = require('../root');

var _require = require('../const'),
    SYNC_STATE = _require.SYNC_STATE;

var Query = require('./query');
var ConversationsQuery = require('./conversations-query');

var ChannelsQuery = function (_ConversationsQuery) {
  _inherits(ChannelsQuery, _ConversationsQuery);

  function ChannelsQuery() {
    _classCallCheck(this, ChannelsQuery);

    return _possibleConstructorReturn(this, (ChannelsQuery.__proto__ || Object.getPrototypeOf(ChannelsQuery)).apply(this, arguments));
  }

  _createClass(ChannelsQuery, [{
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var _this2 = this;

      this.client.dbManager.loadChannels(this._nextDBFromId, pageSize, function (channels) {
        if (channels.length) _this2._appendResults({ data: channels }, true);
      });

      var newRequest = 'channels?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: this._firingRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, _this2._firingRequest, pageSize);
        });
      }
    }
  }, {
    key: '_getSortField',
    value: function _getSortField() {
      return 'created_at';
    }
  }, {
    key: '_getItem',
    value: function _getItem(id) {
      return Query.prototype._getItem.apply(this, [id]);
    }
  }, {
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {
      switch (eventName) {

        // If a Conversation's property has changed, and the Conversation is in this
        // Query's data, then update it.
        case 'channels:change':
          this._handleChangeEvent('channels', evt);
          break;

        // If a Conversation is added, and it isn't already in the Query,
        // add it and trigger an event
        case 'channels:add':
          this._handleAddEvent('channels', evt);
          break;

        // If a Conversation is deleted, and its still in our data,
        // remove it and trigger an event.
        case 'channels:remove':
          this._handleRemoveEvent('channels', evt);
          break;
      }
    }
  }, {
    key: '_appendResultsSplice',
    value: function _appendResultsSplice(item) {
      this.data.unshift(this._getData(item));
    }
  }, {
    key: '_handleChangeEvent',
    value: function _handleChangeEvent(name, evt) {
      var index = this._getIndex(evt.target.id);

      // If its an ID change (matching named channel returned by server) make sure to update our data.
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
      // channels:add events.  Websocket Manager automatically loads anything that receives an event
      // for which we have no object, so we'll get the add event at that time.
      if (index !== -1) {
        var sortField = this._getSortField();
        var reorder = evt.hasProperty('lastMessage') && sortField === 'last_message';
        var newIndex = void 0;

        if (this.dataType === Query.ObjectDataType) {
          if (!reorder) {
            // Replace the changed Channel with a new immutable object
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
    value: function _getInsertIndex(channel, data) {
      if (!channel.isSaved()) return 0;
      var sortField = this._getSortField();
      var index = void 0;
      if (sortField === 'created_at') {
        for (index = 0; index < data.length; index++) {
          var item = data[index];
          if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) {
            // No-op do not insert server data before new and unsaved data
          } else if (channel.createdAt >= item.createdAt) {
            break;
          }
        }
        return index;
      } else {
        var oldIndex = -1;
        var d1 = channel.lastMessage ? channel.lastMessage.sentAt : channel.createdAt;
        for (index = 0; index < data.length; index++) {
          var _item = data[index];
          if (_item.id === channel.id) {
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

      // Filter out any Channels already in our data
      var list = evt[name].filter(function (channel) {
        return _this3._getIndex(channel.id) === -1;
      });

      if (list.length) {
        var data = this.data;
        list.forEach(function (channel) {
          var newIndex = _this3._getInsertIndex(channel, data);
          data.splice(newIndex, 0, _this3._getData(channel));
        });

        // Whether sorting by last_message or created_at, new results go at the top of the list
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(data);
        }
        this.totalSize += list.length;

        // Trigger an 'insert' event for each item added;
        // typically bulk inserts happen via _appendResults().
        list.forEach(function (channel) {
          var item = _this3._getData(channel);
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
      evt[name].forEach(function (channel) {
        var index = _this4._getIndex(channel.id);
        if (index !== -1) {
          if (channel.id === _this4._nextDBFromId) _this4._nextDBFromId = _this4._updateNextFromId(index);
          if (channel.id === _this4._nextServerFromId) _this4._nextServerFromId = _this4._updateNextFromId(index);
          removed.push({
            data: channel,
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

  return ChannelsQuery;
}(ConversationsQuery);

ChannelsQuery._supportedEvents = [].concat(ConversationsQuery._supportedEvents);

ChannelsQuery.MaxPageSize = 100;

ChannelsQuery.prototype.model = Query.Channel;

Root.initClass.apply(ChannelsQuery, [ChannelsQuery, 'ChannelsQuery']);

module.exports = ChannelsQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2NoYW5uZWxzLXF1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiU1lOQ19TVEFURSIsIlF1ZXJ5IiwiQ29udmVyc2F0aW9uc1F1ZXJ5IiwiQ2hhbm5lbHNRdWVyeSIsInBhZ2VTaXplIiwiY2xpZW50IiwiZGJNYW5hZ2VyIiwibG9hZENoYW5uZWxzIiwiX25leHREQkZyb21JZCIsImNoYW5uZWxzIiwibGVuZ3RoIiwiX2FwcGVuZFJlc3VsdHMiLCJkYXRhIiwibmV3UmVxdWVzdCIsIl9uZXh0U2VydmVyRnJvbUlkIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0ZpcmluZyIsInhociIsInVybCIsIm1ldGhvZCIsInN5bmMiLCJfcHJvY2Vzc1J1blJlc3VsdHMiLCJyZXN1bHRzIiwiaWQiLCJwcm90b3R5cGUiLCJfZ2V0SXRlbSIsImFwcGx5IiwiZXZlbnROYW1lIiwiZXZ0IiwiX2hhbmRsZUNoYW5nZUV2ZW50IiwiX2hhbmRsZUFkZEV2ZW50IiwiX2hhbmRsZVJlbW92ZUV2ZW50IiwiaXRlbSIsInVuc2hpZnQiLCJfZ2V0RGF0YSIsIm5hbWUiLCJpbmRleCIsIl9nZXRJbmRleCIsInRhcmdldCIsImRhdGFUeXBlIiwiT2JqZWN0RGF0YVR5cGUiLCJpZENoYW5nZXMiLCJnZXRDaGFuZ2VzRm9yIiwib2xkVmFsdWUiLCJzb3J0RmllbGQiLCJfZ2V0U29ydEZpZWxkIiwicmVvcmRlciIsImhhc1Byb3BlcnR5IiwibmV3SW5kZXgiLCJzbGljZSIsInRvT2JqZWN0IiwiX2dldEluc2VydEluZGV4Iiwic3BsaWNlIiwiY29uY2F0IiwiX3RyaWdnZXJDaGFuZ2UiLCJ0eXBlIiwicXVlcnkiLCJpc0NoYW5nZSIsImNoYW5nZXMiLCJmcm9tSW5kZXgiLCJ0b0luZGV4IiwiY2hhbm5lbCIsImlzU2F2ZWQiLCJzeW5jU3RhdGUiLCJORVciLCJTQVZJTkciLCJjcmVhdGVkQXQiLCJvbGRJbmRleCIsImQxIiwibGFzdE1lc3NhZ2UiLCJzZW50QXQiLCJkMiIsImxpc3QiLCJmaWx0ZXIiLCJmb3JFYWNoIiwidG90YWxTaXplIiwiaW5kZXhPZiIsInJlbW92ZWQiLCJfdXBkYXRlTmV4dEZyb21JZCIsInB1c2giLCJyZW1vdmVkT2JqIiwiX3N1cHBvcnRlZEV2ZW50cyIsIk1heFBhZ2VTaXplIiwibW9kZWwiLCJDaGFubmVsIiwiaW5pdENsYXNzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7OztBQU1BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiOztlQUN1QkEsUUFBUSxVQUFSLEM7SUFBZkMsVSxZQUFBQSxVOztBQUNSLElBQU1DLFFBQVFGLFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBTUcscUJBQXFCSCxRQUFRLHVCQUFSLENBQTNCOztJQUVNSSxhOzs7Ozs7Ozs7OzsrQkFFT0MsUSxFQUFVO0FBQUE7O0FBQ25CLFdBQUtDLE1BQUwsQ0FBWUMsU0FBWixDQUFzQkMsWUFBdEIsQ0FBbUMsS0FBS0MsYUFBeEMsRUFBdURKLFFBQXZELEVBQWlFLFVBQUNLLFFBQUQsRUFBYztBQUM3RSxZQUFJQSxTQUFTQyxNQUFiLEVBQXFCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsUUFBUixFQUFwQixFQUF3QyxJQUF4QztBQUN0QixPQUZEOztBQUlBLFVBQU1JLGFBQWEsd0JBQXNCVCxRQUF0QixJQUNoQixLQUFLVSxpQkFBTCxHQUF5QixjQUFjLEtBQUtBLGlCQUE1QyxHQUFnRSxFQURoRCxDQUFuQjs7QUFHQSxVQUFJRCxlQUFlLEtBQUtFLGNBQXhCLEVBQXdDO0FBQ3RDLGFBQUtDLFFBQUwsR0FBZ0IsSUFBaEI7QUFDQSxhQUFLRCxjQUFMLEdBQXNCRixVQUF0QjtBQUNBLGFBQUtSLE1BQUwsQ0FBWVksR0FBWixDQUFnQjtBQUNkQyxlQUFLLEtBQUtILGNBREk7QUFFZEksa0JBQVEsS0FGTTtBQUdkQyxnQkFBTTtBQUhRLFNBQWhCLEVBSUc7QUFBQSxpQkFBVyxPQUFLQyxrQkFBTCxDQUF3QkMsT0FBeEIsRUFBaUMsT0FBS1AsY0FBdEMsRUFBc0RYLFFBQXRELENBQVg7QUFBQSxTQUpIO0FBS0Q7QUFDRjs7O29DQUVlO0FBQ2QsYUFBTyxZQUFQO0FBQ0Q7Ozs2QkFFUW1CLEUsRUFBSTtBQUNYLGFBQU90QixNQUFNdUIsU0FBTixDQUFnQkMsUUFBaEIsQ0FBeUJDLEtBQXpCLENBQStCLElBQS9CLEVBQXFDLENBQUNILEVBQUQsQ0FBckMsQ0FBUDtBQUNEOzs7a0NBRWFJLFMsRUFBV0MsRyxFQUFLO0FBQzVCLGNBQVFELFNBQVI7O0FBRUU7QUFDQTtBQUNBLGFBQUssaUJBQUw7QUFDRSxlQUFLRSxrQkFBTCxDQUF3QixVQUF4QixFQUFvQ0QsR0FBcEM7QUFDQTs7QUFFRjtBQUNBO0FBQ0EsYUFBSyxjQUFMO0FBQ0UsZUFBS0UsZUFBTCxDQUFxQixVQUFyQixFQUFpQ0YsR0FBakM7QUFDQTs7QUFFRjtBQUNBO0FBQ0EsYUFBSyxpQkFBTDtBQUNFLGVBQUtHLGtCQUFMLENBQXdCLFVBQXhCLEVBQW9DSCxHQUFwQztBQUNBO0FBbEJKO0FBb0JEOzs7eUNBR29CSSxJLEVBQU07QUFDekIsV0FBS3BCLElBQUwsQ0FBVXFCLE9BQVYsQ0FBa0IsS0FBS0MsUUFBTCxDQUFjRixJQUFkLENBQWxCO0FBQ0Q7Ozt1Q0FFa0JHLEksRUFBTVAsRyxFQUFLO0FBQzVCLFVBQUlRLFFBQVEsS0FBS0MsU0FBTCxDQUFlVCxJQUFJVSxNQUFKLENBQVdmLEVBQTFCLENBQVo7O0FBRUE7QUFDQTtBQUNBLFVBQUksS0FBS2dCLFFBQUwsS0FBa0J0QyxNQUFNdUMsY0FBNUIsRUFBNEM7QUFDMUMsWUFBTUMsWUFBWWIsSUFBSWMsYUFBSixDQUFrQixJQUFsQixDQUFsQjtBQUNBLFlBQUlELFVBQVUvQixNQUFkLEVBQXNCO0FBQ3BCMEIsa0JBQVEsS0FBS0MsU0FBTCxDQUFlSSxVQUFVLENBQVYsRUFBYUUsUUFBNUIsQ0FBUjtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQUlQLFVBQVUsQ0FBQyxDQUFmLEVBQWtCO0FBQ2hCLFlBQU1RLFlBQVksS0FBS0MsYUFBTCxFQUFsQjtBQUNBLFlBQU1DLFVBQVVsQixJQUFJbUIsV0FBSixDQUFnQixhQUFoQixLQUFrQ0gsY0FBYyxjQUFoRTtBQUNBLFlBQUlJLGlCQUFKOztBQUVBLFlBQUksS0FBS1QsUUFBTCxLQUFrQnRDLE1BQU11QyxjQUE1QixFQUE0QztBQUMxQyxjQUFJLENBQUNNLE9BQUwsRUFBYztBQUNaO0FBQ0EsaUJBQUtsQyxJQUFMLGdDQUNLLEtBQUtBLElBQUwsQ0FBVXFDLEtBQVYsQ0FBZ0IsQ0FBaEIsRUFBbUJiLEtBQW5CLENBREwsSUFFRVIsSUFBSVUsTUFBSixDQUFXWSxRQUFYLEVBRkYsc0JBR0ssS0FBS3RDLElBQUwsQ0FBVXFDLEtBQVYsQ0FBZ0JiLFFBQVEsQ0FBeEIsQ0FITDtBQUtELFdBUEQsTUFPTztBQUNMWSx1QkFBVyxLQUFLRyxlQUFMLENBQXFCdkIsSUFBSVUsTUFBekIsRUFBaUMsS0FBSzFCLElBQXRDLENBQVg7QUFDQSxpQkFBS0EsSUFBTCxDQUFVd0MsTUFBVixDQUFpQmhCLEtBQWpCLEVBQXdCLENBQXhCO0FBQ0EsaUJBQUt4QixJQUFMLENBQVV3QyxNQUFWLENBQWlCSixRQUFqQixFQUEyQixDQUEzQixFQUE4QixLQUFLZCxRQUFMLENBQWNOLElBQUlVLE1BQWxCLENBQTlCO0FBQ0EsaUJBQUsxQixJQUFMLEdBQVksS0FBS0EsSUFBTCxDQUFVeUMsTUFBVixDQUFpQixFQUFqQixDQUFaO0FBQ0Q7QUFDRjs7QUFFRDtBQWhCQSxhQWlCSyxJQUFJUCxPQUFKLEVBQWE7QUFDaEJFLHVCQUFXLEtBQUtHLGVBQUwsQ0FBcUJ2QixJQUFJVSxNQUF6QixFQUFpQyxLQUFLMUIsSUFBdEMsQ0FBWDtBQUNBLGdCQUFJb0MsYUFBYVosS0FBakIsRUFBd0I7QUFDdEIsbUJBQUt4QixJQUFMLENBQVV3QyxNQUFWLENBQWlCaEIsS0FBakIsRUFBd0IsQ0FBeEI7QUFDQSxtQkFBS3hCLElBQUwsQ0FBVXdDLE1BQVYsQ0FBaUJKLFFBQWpCLEVBQTJCLENBQTNCLEVBQThCcEIsSUFBSVUsTUFBbEM7QUFDRDtBQUNGOztBQUVEO0FBQ0EsYUFBS2dCLGNBQUwsQ0FBb0I7QUFDbEJDLGdCQUFNLFVBRFk7QUFFbEJqQixrQkFBUSxLQUFLSixRQUFMLENBQWNOLElBQUlVLE1BQWxCLENBRlU7QUFHbEJrQixpQkFBTyxJQUhXO0FBSWxCQyxvQkFBVSxJQUpRO0FBS2xCQyxtQkFBUzlCLElBQUk4QjtBQUxLLFNBQXBCOztBQVFBLFlBQUlaLFdBQVdFLGFBQWFaLEtBQTVCLEVBQW1DO0FBQ2pDLGVBQUtrQixjQUFMLENBQW9CO0FBQ2xCQyxrQkFBTSxNQURZO0FBRWxCakIsb0JBQVEsS0FBS0osUUFBTCxDQUFjTixJQUFJVSxNQUFsQixDQUZVO0FBR2xCa0IsbUJBQU8sSUFIVztBQUlsQkMsc0JBQVUsS0FKUTtBQUtsQkUsdUJBQVd2QixLQUxPO0FBTWxCd0IscUJBQVNaO0FBTlMsV0FBcEI7QUFRRDtBQUNGO0FBQ0Y7OztvQ0FFZWEsTyxFQUFTakQsSSxFQUFNO0FBQzdCLFVBQUksQ0FBQ2lELFFBQVFDLE9BQVIsRUFBTCxFQUF3QixPQUFPLENBQVA7QUFDeEIsVUFBTWxCLFlBQVksS0FBS0MsYUFBTCxFQUFsQjtBQUNBLFVBQUlULGNBQUo7QUFDQSxVQUFJUSxjQUFjLFlBQWxCLEVBQWdDO0FBQzlCLGFBQUtSLFFBQVEsQ0FBYixFQUFnQkEsUUFBUXhCLEtBQUtGLE1BQTdCLEVBQXFDMEIsT0FBckMsRUFBOEM7QUFDNUMsY0FBTUosT0FBT3BCLEtBQUt3QixLQUFMLENBQWI7QUFDQSxjQUFJSixLQUFLK0IsU0FBTCxLQUFtQi9ELFdBQVdnRSxHQUE5QixJQUFxQ2hDLEtBQUsrQixTQUFMLEtBQW1CL0QsV0FBV2lFLE1BQXZFLEVBQStFO0FBQzdFO0FBQ0QsV0FGRCxNQUVPLElBQUlKLFFBQVFLLFNBQVIsSUFBcUJsQyxLQUFLa0MsU0FBOUIsRUFBeUM7QUFDOUM7QUFDRDtBQUNGO0FBQ0QsZUFBTzlCLEtBQVA7QUFDRCxPQVZELE1BVU87QUFDTCxZQUFJK0IsV0FBVyxDQUFDLENBQWhCO0FBQ0EsWUFBTUMsS0FBS1AsUUFBUVEsV0FBUixHQUFzQlIsUUFBUVEsV0FBUixDQUFvQkMsTUFBMUMsR0FBbURULFFBQVFLLFNBQXRFO0FBQ0EsYUFBSzlCLFFBQVEsQ0FBYixFQUFnQkEsUUFBUXhCLEtBQUtGLE1BQTdCLEVBQXFDMEIsT0FBckMsRUFBOEM7QUFDNUMsY0FBTUosUUFBT3BCLEtBQUt3QixLQUFMLENBQWI7QUFDQSxjQUFJSixNQUFLVCxFQUFMLEtBQVlzQyxRQUFRdEMsRUFBeEIsRUFBNEI7QUFDMUI0Qyx1QkFBVy9CLEtBQVg7QUFDRCxXQUZELE1BRU8sSUFBSUosTUFBSytCLFNBQUwsS0FBbUIvRCxXQUFXZ0UsR0FBOUIsSUFBcUNoQyxNQUFLK0IsU0FBTCxLQUFtQi9ELFdBQVdpRSxNQUF2RSxFQUErRTtBQUNwRjtBQUNELFdBRk0sTUFFQTtBQUNMLGdCQUFNTSxLQUFLdkMsTUFBS3FDLFdBQUwsR0FBbUJyQyxNQUFLcUMsV0FBTCxDQUFpQkMsTUFBcEMsR0FBNkN0QyxNQUFLa0MsU0FBN0Q7QUFDQSxnQkFBSUUsTUFBTUcsRUFBVixFQUFjO0FBQ2Y7QUFDRjtBQUNELGVBQU9KLGFBQWEsQ0FBQyxDQUFkLElBQW1CQSxXQUFXL0IsS0FBOUIsR0FBc0NBLEtBQXRDLEdBQThDQSxRQUFRLENBQTdEO0FBQ0Q7QUFDRjs7O29DQUVlRCxJLEVBQU1QLEcsRUFBSztBQUFBOztBQUN6QjtBQUNBLFVBQU00QyxPQUFPNUMsSUFBSU8sSUFBSixFQUFVc0MsTUFBVixDQUFpQjtBQUFBLGVBQVcsT0FBS3BDLFNBQUwsQ0FBZXdCLFFBQVF0QyxFQUF2QixNQUErQixDQUFDLENBQTNDO0FBQUEsT0FBakIsQ0FBYjs7QUFFQSxVQUFJaUQsS0FBSzlELE1BQVQsRUFBaUI7QUFDZixZQUFNRSxPQUFPLEtBQUtBLElBQWxCO0FBQ0E0RCxhQUFLRSxPQUFMLENBQWEsVUFBQ2IsT0FBRCxFQUFhO0FBQ3hCLGNBQU1iLFdBQVcsT0FBS0csZUFBTCxDQUFxQlUsT0FBckIsRUFBOEJqRCxJQUE5QixDQUFqQjtBQUNBQSxlQUFLd0MsTUFBTCxDQUFZSixRQUFaLEVBQXNCLENBQXRCLEVBQXlCLE9BQUtkLFFBQUwsQ0FBYzJCLE9BQWQsQ0FBekI7QUFDRCxTQUhEOztBQUtBO0FBQ0EsWUFBSSxLQUFLdEIsUUFBTCxLQUFrQnRDLE1BQU11QyxjQUE1QixFQUE0QztBQUMxQyxlQUFLNUIsSUFBTCxHQUFZLEdBQUd5QyxNQUFILENBQVV6QyxJQUFWLENBQVo7QUFDRDtBQUNELGFBQUsrRCxTQUFMLElBQWtCSCxLQUFLOUQsTUFBdkI7O0FBRUE7QUFDQTtBQUNBOEQsYUFBS0UsT0FBTCxDQUFhLFVBQUNiLE9BQUQsRUFBYTtBQUN4QixjQUFNN0IsT0FBTyxPQUFLRSxRQUFMLENBQWMyQixPQUFkLENBQWI7QUFDQSxpQkFBS1AsY0FBTCxDQUFvQjtBQUNsQkMsa0JBQU0sUUFEWTtBQUVsQm5CLG1CQUFPLE9BQUt4QixJQUFMLENBQVVnRSxPQUFWLENBQWtCNUMsSUFBbEIsQ0FGVztBQUdsQk0sb0JBQVFOLElBSFU7QUFJbEJ3QjtBQUprQixXQUFwQjtBQU1ELFNBUkQ7QUFTRDtBQUNGOzs7dUNBR2tCckIsSSxFQUFNUCxHLEVBQUs7QUFBQTs7QUFDNUIsVUFBTWlELFVBQVUsRUFBaEI7QUFDQWpELFVBQUlPLElBQUosRUFBVXVDLE9BQVYsQ0FBa0IsVUFBQ2IsT0FBRCxFQUFhO0FBQzdCLFlBQU16QixRQUFRLE9BQUtDLFNBQUwsQ0FBZXdCLFFBQVF0QyxFQUF2QixDQUFkO0FBQ0EsWUFBSWEsVUFBVSxDQUFDLENBQWYsRUFBa0I7QUFDaEIsY0FBSXlCLFFBQVF0QyxFQUFSLEtBQWUsT0FBS2YsYUFBeEIsRUFBdUMsT0FBS0EsYUFBTCxHQUFxQixPQUFLc0UsaUJBQUwsQ0FBdUIxQyxLQUF2QixDQUFyQjtBQUN2QyxjQUFJeUIsUUFBUXRDLEVBQVIsS0FBZSxPQUFLVCxpQkFBeEIsRUFBMkMsT0FBS0EsaUJBQUwsR0FBeUIsT0FBS2dFLGlCQUFMLENBQXVCMUMsS0FBdkIsQ0FBekI7QUFDM0N5QyxrQkFBUUUsSUFBUixDQUFhO0FBQ1huRSxrQkFBTWlELE9BREs7QUFFWHpCO0FBRlcsV0FBYjtBQUlBLGNBQUksT0FBS0csUUFBTCxLQUFrQnRDLE1BQU11QyxjQUE1QixFQUE0QztBQUMxQyxtQkFBSzVCLElBQUwsZ0NBQWdCLE9BQUtBLElBQUwsQ0FBVXFDLEtBQVYsQ0FBZ0IsQ0FBaEIsRUFBbUJiLEtBQW5CLENBQWhCLHNCQUE4QyxPQUFLeEIsSUFBTCxDQUFVcUMsS0FBVixDQUFnQmIsUUFBUSxDQUF4QixDQUE5QztBQUNELFdBRkQsTUFFTztBQUNMLG1CQUFLeEIsSUFBTCxDQUFVd0MsTUFBVixDQUFpQmhCLEtBQWpCLEVBQXdCLENBQXhCO0FBQ0Q7QUFDRjtBQUNGLE9BZkQ7O0FBaUJBLFdBQUt1QyxTQUFMLElBQWtCRSxRQUFRbkUsTUFBMUI7QUFDQW1FLGNBQVFILE9BQVIsQ0FBZ0IsVUFBQ00sVUFBRCxFQUFnQjtBQUM5QixlQUFLMUIsY0FBTCxDQUFvQjtBQUNsQkMsZ0JBQU0sUUFEWTtBQUVsQm5CLGlCQUFPNEMsV0FBVzVDLEtBRkE7QUFHbEJFLGtCQUFRLE9BQUtKLFFBQUwsQ0FBYzhDLFdBQVdwRSxJQUF6QixDQUhVO0FBSWxCNEM7QUFKa0IsU0FBcEI7QUFNRCxPQVBEO0FBUUQ7Ozs7RUExTnlCdEQsa0I7O0FBNk41QkMsY0FBYzhFLGdCQUFkLEdBQWlDLEdBRS9CNUIsTUFGK0IsQ0FFeEJuRCxtQkFBbUIrRSxnQkFGSyxDQUFqQzs7QUFLQTlFLGNBQWMrRSxXQUFkLEdBQTRCLEdBQTVCOztBQUVBL0UsY0FBY3FCLFNBQWQsQ0FBd0IyRCxLQUF4QixHQUFnQ2xGLE1BQU1tRixPQUF0Qzs7QUFFQXRGLEtBQUt1RixTQUFMLENBQWUzRCxLQUFmLENBQXFCdkIsYUFBckIsRUFBb0MsQ0FBQ0EsYUFBRCxFQUFnQixlQUFoQixDQUFwQzs7QUFFQW1GLE9BQU9DLE9BQVAsR0FBaUJwRixhQUFqQiIsImZpbGUiOiJjaGFubmVscy1xdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIEZlYXR1cmUgaXMgdGVzdGVkIGJ1dCBub3QgYXZhaWxhYmxlIG9uIHNlcnZlclxuICogUXVlcnkgY2xhc3MgZm9yIHJ1bm5pbmcgYSBRdWVyeSBvbiBDaGFubmVsc1xuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQ2hhbm5lbHNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IHsgU1lOQ19TVEFURSB9ID0gcmVxdWlyZSgnLi4vY29uc3QnKTtcbmNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuY29uc3QgQ29udmVyc2F0aW9uc1F1ZXJ5ID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25zLXF1ZXJ5Jyk7XG5cbmNsYXNzIENoYW5uZWxzUXVlcnkgZXh0ZW5kcyBDb252ZXJzYXRpb25zUXVlcnkge1xuXG4gIF9mZXRjaERhdGEocGFnZVNpemUpIHtcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZENoYW5uZWxzKHRoaXMuX25leHREQkZyb21JZCwgcGFnZVNpemUsIChjaGFubmVscykgPT4ge1xuICAgICAgaWYgKGNoYW5uZWxzLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IGNoYW5uZWxzIH0sIHRydWUpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3UmVxdWVzdCA9IGBjaGFubmVscz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgaWYgKG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IHRoaXMuX2ZpcmluZ1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCB0aGlzLl9maXJpbmdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTb3J0RmllbGQoKSB7XG4gICAgcmV0dXJuICdjcmVhdGVkX2F0JztcbiAgfVxuXG4gIF9nZXRJdGVtKGlkKSB7XG4gICAgcmV0dXJuIFF1ZXJ5LnByb3RvdHlwZS5fZ2V0SXRlbS5hcHBseSh0aGlzLCBbaWRdKTtcbiAgfVxuXG4gIF9oYW5kbGVFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbidzIHByb3BlcnR5IGhhcyBjaGFuZ2VkLCBhbmQgdGhlIENvbnZlcnNhdGlvbiBpcyBpbiB0aGlzXG4gICAgICAvLyBRdWVyeSdzIGRhdGEsIHRoZW4gdXBkYXRlIGl0LlxuICAgICAgY2FzZSAnY2hhbm5lbHM6Y2hhbmdlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ2hhbmdlRXZlbnQoJ2NoYW5uZWxzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uIGlzIGFkZGVkLCBhbmQgaXQgaXNuJ3QgYWxyZWFkeSBpbiB0aGUgUXVlcnksXG4gICAgICAvLyBhZGQgaXQgYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ2NoYW5uZWxzOmFkZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUFkZEV2ZW50KCdjaGFubmVscycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbiBpcyBkZWxldGVkLCBhbmQgaXRzIHN0aWxsIGluIG91ciBkYXRhLFxuICAgICAgLy8gcmVtb3ZlIGl0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50LlxuICAgICAgY2FzZSAnY2hhbm5lbHM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlUmVtb3ZlRXZlbnQoJ2NoYW5uZWxzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgdGhpcy5kYXRhLnVuc2hpZnQodGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuICBfaGFuZGxlQ2hhbmdlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG5cbiAgICAvLyBJZiBpdHMgYW4gSUQgY2hhbmdlIChtYXRjaGluZyBuYW1lZCBjaGFubmVsIHJldHVybmVkIGJ5IHNlcnZlcikgbWFrZSBzdXJlIHRvIHVwZGF0ZSBvdXIgZGF0YS5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBhbiBpbnN0YW5jZSwgaXRzIGJlZW4gdXBkYXRlZCBmb3IgdXMuXG4gICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICBjb25zdCBpZENoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignaWQnKTtcbiAgICAgIGlmIChpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWRDaGFuZ2VzWzBdLm9sZFZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBcIm9iamVjdFwiIHRoZW4gdXBkYXRlIHRoZSBvYmplY3QgYW5kIG91ciBhcnJheTtcbiAgICAvLyBlbHNlIHRoZSBvYmplY3QgaXMgYWxyZWFkeSB1cGRhdGVkLlxuICAgIC8vIElnbm9yZSByZXN1bHRzIHRoYXQgYXJlbid0IGFscmVhZHkgaW4gb3VyIGRhdGE7IFJlc3VsdHMgYXJlIGFkZGVkIHZpYVxuICAgIC8vIGNoYW5uZWxzOmFkZCBldmVudHMuICBXZWJzb2NrZXQgTWFuYWdlciBhdXRvbWF0aWNhbGx5IGxvYWRzIGFueXRoaW5nIHRoYXQgcmVjZWl2ZXMgYW4gZXZlbnRcbiAgICAvLyBmb3Igd2hpY2ggd2UgaGF2ZSBubyBvYmplY3QsIHNvIHdlJ2xsIGdldCB0aGUgYWRkIGV2ZW50IGF0IHRoYXQgdGltZS5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBzb3J0RmllbGQgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcbiAgICAgIGNvbnN0IHJlb3JkZXIgPSBldnQuaGFzUHJvcGVydHkoJ2xhc3RNZXNzYWdlJykgJiYgc29ydEZpZWxkID09PSAnbGFzdF9tZXNzYWdlJztcbiAgICAgIGxldCBuZXdJbmRleDtcblxuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIGlmICghcmVvcmRlcikge1xuICAgICAgICAgIC8vIFJlcGxhY2UgdGhlIGNoYW5nZWQgQ2hhbm5lbCB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGV2dC50YXJnZXQsIHRoaXMuZGF0YSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChbXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRWxzZSBkYXRhVHlwZSBpcyBpbnN0YW5jZSBub3Qgb2JqZWN0XG4gICAgICBlbHNlIGlmIChyZW9yZGVyKSB7XG4gICAgICAgIG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoZXZ0LnRhcmdldCwgdGhpcy5kYXRhKTtcbiAgICAgICAgaWYgKG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIGV2dC50YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRyaWdnZXIgYSAncHJvcGVydHknIGV2ZW50XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZW9yZGVyICYmIG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnbW92ZScsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgICAgICBmcm9tSW5kZXg6IGluZGV4LFxuICAgICAgICAgIHRvSW5kZXg6IG5ld0luZGV4LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZ2V0SW5zZXJ0SW5kZXgoY2hhbm5lbCwgZGF0YSkge1xuICAgIGlmICghY2hhbm5lbC5pc1NhdmVkKCkpIHJldHVybiAwO1xuICAgIGNvbnN0IHNvcnRGaWVsZCA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuICAgIGxldCBpbmRleDtcbiAgICBpZiAoc29ydEZpZWxkID09PSAnY3JlYXRlZF9hdCcpIHtcbiAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBkYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIHtcbiAgICAgICAgICAvLyBOby1vcCBkbyBub3QgaW5zZXJ0IHNlcnZlciBkYXRhIGJlZm9yZSBuZXcgYW5kIHVuc2F2ZWQgZGF0YVxuICAgICAgICB9IGVsc2UgaWYgKGNoYW5uZWwuY3JlYXRlZEF0ID49IGl0ZW0uY3JlYXRlZEF0KSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9sZEluZGV4ID0gLTE7XG4gICAgICBjb25zdCBkMSA9IGNoYW5uZWwubGFzdE1lc3NhZ2UgPyBjaGFubmVsLmxhc3RNZXNzYWdlLnNlbnRBdCA6IGNoYW5uZWwuY3JlYXRlZEF0O1xuICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoaXRlbS5pZCA9PT0gY2hhbm5lbC5pZCkge1xuICAgICAgICAgIG9sZEluZGV4ID0gaW5kZXg7XG4gICAgICAgIH0gZWxzZSBpZiAoaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXIHx8IGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORykge1xuICAgICAgICAgIC8vIE5vLW9wIGRvIG5vdCBpbnNlcnQgc2VydmVyIGRhdGEgYmVmb3JlIG5ldyBhbmQgdW5zYXZlZCBkYXRhXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZDIgPSBpdGVtLmxhc3RNZXNzYWdlID8gaXRlbS5sYXN0TWVzc2FnZS5zZW50QXQgOiBpdGVtLmNyZWF0ZWRBdDtcbiAgICAgICAgICBpZiAoZDEgPj0gZDIpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gb2xkSW5kZXggPT09IC0xIHx8IG9sZEluZGV4ID4gaW5kZXggPyBpbmRleCA6IGluZGV4IC0gMTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQWRkRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgLy8gRmlsdGVyIG91dCBhbnkgQ2hhbm5lbHMgYWxyZWFkeSBpbiBvdXIgZGF0YVxuICAgIGNvbnN0IGxpc3QgPSBldnRbbmFtZV0uZmlsdGVyKGNoYW5uZWwgPT4gdGhpcy5fZ2V0SW5kZXgoY2hhbm5lbC5pZCkgPT09IC0xKTtcblxuICAgIGlmIChsaXN0Lmxlbmd0aCkge1xuICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaCgoY2hhbm5lbCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGNoYW5uZWwsIGRhdGEpO1xuICAgICAgICBkYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShjaGFubmVsKSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gV2hldGhlciBzb3J0aW5nIGJ5IGxhc3RfbWVzc2FnZSBvciBjcmVhdGVkX2F0LCBuZXcgcmVzdWx0cyBnbyBhdCB0aGUgdG9wIG9mIHRoZSBsaXN0XG4gICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW10uY29uY2F0KGRhdGEpO1xuICAgICAgfVxuICAgICAgdGhpcy50b3RhbFNpemUgKz0gbGlzdC5sZW5ndGg7XG5cbiAgICAgIC8vIFRyaWdnZXIgYW4gJ2luc2VydCcgZXZlbnQgZm9yIGVhY2ggaXRlbSBhZGRlZDtcbiAgICAgIC8vIHR5cGljYWxseSBidWxrIGluc2VydHMgaGFwcGVuIHZpYSBfYXBwZW5kUmVzdWx0cygpLlxuICAgICAgbGlzdC5mb3JFYWNoKChjaGFubmVsKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl9nZXREYXRhKGNoYW5uZWwpO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICBpbmRleDogdGhpcy5kYXRhLmluZGV4T2YoaXRlbSksXG4gICAgICAgICAgdGFyZ2V0OiBpdGVtLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG5cbiAgX2hhbmRsZVJlbW92ZUV2ZW50KG5hbWUsIGV2dCkge1xuICAgIGNvbnN0IHJlbW92ZWQgPSBbXTtcbiAgICBldnRbbmFtZV0uZm9yRWFjaCgoY2hhbm5lbCkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChjaGFubmVsLmlkKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgaWYgKGNoYW5uZWwuaWQgPT09IHRoaXMuX25leHREQkZyb21JZCkgdGhpcy5fbmV4dERCRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIGlmIChjaGFubmVsLmlkID09PSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkKSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIHJlbW92ZWQucHVzaCh7XG4gICAgICAgICAgZGF0YTogY2hhbm5lbCxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFsuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLCAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMudG90YWxTaXplIC09IHJlbW92ZWQubGVuZ3RoO1xuICAgIHJlbW92ZWQuZm9yRWFjaCgocmVtb3ZlZE9iaikgPT4ge1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICBpbmRleDogcmVtb3ZlZE9iai5pbmRleCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKHJlbW92ZWRPYmouZGF0YSksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuQ2hhbm5lbHNRdWVyeS5fc3VwcG9ydGVkRXZlbnRzID0gW1xuXG5dLmNvbmNhdChDb252ZXJzYXRpb25zUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuQ2hhbm5lbHNRdWVyeS5NYXhQYWdlU2l6ZSA9IDEwMDtcblxuQ2hhbm5lbHNRdWVyeS5wcm90b3R5cGUubW9kZWwgPSBRdWVyeS5DaGFubmVsO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDaGFubmVsc1F1ZXJ5LCBbQ2hhbm5lbHNRdWVyeSwgJ0NoYW5uZWxzUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hhbm5lbHNRdWVyeTtcbiJdfQ==
