'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Channels
 *
 *      var channelQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Channel
 *      });
 *
 *
 * You can change the `paginationWindow` property at any time using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 * You can release data held in memory by your queries when done with them:
 *
 *      query.destroy();
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
          telemetry: {
            name: 'channel_query_time'
          },
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

        // typically bulk inserts happen via _appendResults(); so this array typically iterates over an array of length 1
        list.forEach(function (channel) {
          var newIndex = _this3._getInsertIndex(channel, data);
          data.splice(newIndex, 0, _this3._getData(channel));

          // Typically this loop only iterates once; but each iteration is gaurenteed a unique object if needed
          if (_this3.dataType === Query.ObjectDataType) {
            _this3.data = [].concat(data);
          }
          _this3.totalSize += 1;

          var item = _this3._getData(channel);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2NoYW5uZWxzLXF1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiU1lOQ19TVEFURSIsIlF1ZXJ5IiwiQ29udmVyc2F0aW9uc1F1ZXJ5IiwiQ2hhbm5lbHNRdWVyeSIsInBhZ2VTaXplIiwiY2xpZW50IiwiZGJNYW5hZ2VyIiwibG9hZENoYW5uZWxzIiwiX25leHREQkZyb21JZCIsImNoYW5uZWxzIiwibGVuZ3RoIiwiX2FwcGVuZFJlc3VsdHMiLCJkYXRhIiwibmV3UmVxdWVzdCIsIl9uZXh0U2VydmVyRnJvbUlkIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0ZpcmluZyIsInhociIsInRlbGVtZXRyeSIsIm5hbWUiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsImlkIiwicHJvdG90eXBlIiwiX2dldEl0ZW0iLCJhcHBseSIsImV2ZW50TmFtZSIsImV2dCIsIl9oYW5kbGVDaGFuZ2VFdmVudCIsIl9oYW5kbGVBZGRFdmVudCIsIl9oYW5kbGVSZW1vdmVFdmVudCIsIml0ZW0iLCJ1bnNoaWZ0IiwiX2dldERhdGEiLCJpbmRleCIsIl9nZXRJbmRleCIsInRhcmdldCIsImRhdGFUeXBlIiwiT2JqZWN0RGF0YVR5cGUiLCJpZENoYW5nZXMiLCJnZXRDaGFuZ2VzRm9yIiwib2xkVmFsdWUiLCJzb3J0RmllbGQiLCJfZ2V0U29ydEZpZWxkIiwicmVvcmRlciIsImhhc1Byb3BlcnR5IiwibmV3SW5kZXgiLCJzbGljZSIsInRvT2JqZWN0IiwiX2dldEluc2VydEluZGV4Iiwic3BsaWNlIiwiY29uY2F0IiwiX3RyaWdnZXJDaGFuZ2UiLCJ0eXBlIiwicXVlcnkiLCJpc0NoYW5nZSIsImNoYW5nZXMiLCJmcm9tSW5kZXgiLCJ0b0luZGV4IiwiY2hhbm5lbCIsImlzU2F2ZWQiLCJzeW5jU3RhdGUiLCJORVciLCJTQVZJTkciLCJjcmVhdGVkQXQiLCJvbGRJbmRleCIsImQxIiwibGFzdE1lc3NhZ2UiLCJzZW50QXQiLCJkMiIsImxpc3QiLCJmaWx0ZXIiLCJmb3JFYWNoIiwidG90YWxTaXplIiwicmVtb3ZlZCIsIl91cGRhdGVOZXh0RnJvbUlkIiwicHVzaCIsInJlbW92ZWRPYmoiLCJfc3VwcG9ydGVkRXZlbnRzIiwiTWF4UGFnZVNpemUiLCJtb2RlbCIsIkNoYW5uZWwiLCJpbml0Q2xhc3MiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjs7ZUFDdUJBLFFBQVEsVUFBUixDO0lBQWZDLFUsWUFBQUEsVTs7QUFDUixJQUFNQyxRQUFRRixRQUFRLFNBQVIsQ0FBZDtBQUNBLElBQU1HLHFCQUFxQkgsUUFBUSx1QkFBUixDQUEzQjs7SUFFTUksYTs7Ozs7Ozs7Ozs7K0JBRU9DLFEsRUFBVTtBQUFBOztBQUNuQixXQUFLQyxNQUFMLENBQVlDLFNBQVosQ0FBc0JDLFlBQXRCLENBQW1DLEtBQUtDLGFBQXhDLEVBQXVESixRQUF2RCxFQUFpRSxVQUFDSyxRQUFELEVBQWM7QUFDN0UsWUFBSUEsU0FBU0MsTUFBYixFQUFxQixPQUFLQyxjQUFMLENBQW9CLEVBQUVDLE1BQU1ILFFBQVIsRUFBcEIsRUFBd0MsSUFBeEM7QUFDdEIsT0FGRDs7QUFJQSxVQUFNSSxhQUFhLHdCQUFzQlQsUUFBdEIsSUFDaEIsS0FBS1UsaUJBQUwsR0FBeUIsY0FBYyxLQUFLQSxpQkFBNUMsR0FBZ0UsRUFEaEQsQ0FBbkI7O0FBR0EsVUFBSUQsZUFBZSxLQUFLRSxjQUF4QixFQUF3QztBQUN0QyxhQUFLQyxRQUFMLEdBQWdCLElBQWhCO0FBQ0EsYUFBS0QsY0FBTCxHQUFzQkYsVUFBdEI7QUFDQSxhQUFLUixNQUFMLENBQVlZLEdBQVosQ0FBZ0I7QUFDZEMscUJBQVc7QUFDVEMsa0JBQU07QUFERyxXQURHO0FBSWRDLGVBQUssS0FBS0wsY0FKSTtBQUtkTSxrQkFBUSxLQUxN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bkUsa0JBQU1rRCxPQURLO0FBRVh6QjtBQUZXLFdBQWI7QUFJQSxjQUFJLE9BQUtHLFFBQUwsS0FBa0J2QyxNQUFNd0MsY0FBNUIsRUFBNEM7QUFDMUMsbUJBQUs3QixJQUFMLGdDQUFnQixPQUFLQSxJQUFMLENBQVVzQyxLQUFWLENBQWdCLENBQWhCLEVBQW1CYixLQUFuQixDQUFoQixzQkFBOEMsT0FBS3pCLElBQUwsQ0FBVXNDLEtBQVYsQ0FBZ0JiLFFBQVEsQ0FBeEIsQ0FBOUM7QUFDRCxXQUZELE1BRU87QUFDTCxtQkFBS3pCLElBQUwsQ0FBVXlDLE1BQVYsQ0FBaUJoQixLQUFqQixFQUF3QixDQUF4QjtBQUNEO0FBQ0Y7QUFDRixPQWZEOztBQWlCQSxXQUFLdUMsU0FBTCxJQUFrQkMsUUFBUW5FLE1BQTFCO0FBQ0FtRSxjQUFRRixPQUFSLENBQWdCLFVBQUNLLFVBQUQsRUFBZ0I7QUFDOUIsZUFBS3pCLGNBQUwsQ0FBb0I7QUFDbEJDLGdCQUFNLFFBRFk7QUFFbEJuQixpQkFBTzJDLFdBQVczQyxLQUZBO0FBR2xCRSxrQkFBUSxPQUFLSCxRQUFMLENBQWM0QyxXQUFXcEUsSUFBekIsQ0FIVTtBQUlsQjZDO0FBSmtCLFNBQXBCO0FBTUQsT0FQRDtBQVFEOzs7O0VBM055QnZELGtCOztBQThONUJDLGNBQWM4RSxnQkFBZCxHQUFpQyxHQUUvQjNCLE1BRitCLENBRXhCcEQsbUJBQW1CK0UsZ0JBRkssQ0FBakM7O0FBS0E5RSxjQUFjK0UsV0FBZCxHQUE0QixHQUE1Qjs7QUFFQS9FLGNBQWN1QixTQUFkLENBQXdCeUQsS0FBeEIsR0FBZ0NsRixNQUFNbUYsT0FBdEM7O0FBRUF0RixLQUFLdUYsU0FBTCxDQUFlekQsS0FBZixDQUFxQnpCLGFBQXJCLEVBQW9DLENBQUNBLGFBQUQsRUFBZ0IsZUFBaEIsQ0FBcEM7O0FBRUFtRixPQUFPQyxPQUFQLEdBQWlCcEYsYUFBakIiLCJmaWxlIjoiY2hhbm5lbHMtcXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFF1ZXJ5IGNsYXNzIGZvciBydW5uaW5nIGEgUXVlcnkgb24gQ2hhbm5lbHNcbiAqXG4gKiAgICAgIHZhciBjaGFubmVsUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5DaGFubmVsXG4gKiAgICAgIH0pO1xuICpcbiAqXG4gKiBZb3UgY2FuIGNoYW5nZSB0aGUgYHBhZ2luYXRpb25XaW5kb3dgIHByb3BlcnR5IGF0IGFueSB0aW1lIHVzaW5nOlxuICpcbiAqICAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgICBwYWdpbmF0aW9uV2luZG93OiAyMDBcbiAqICAgICAgfSk7XG4gKlxuICogWW91IGNhbiByZWxlYXNlIGRhdGEgaGVsZCBpbiBtZW1vcnkgYnkgeW91ciBxdWVyaWVzIHdoZW4gZG9uZSB3aXRoIHRoZW06XG4gKlxuICogICAgICBxdWVyeS5kZXN0cm95KCk7XG4gKlxuICogQGNsYXNzICBsYXllci5DaGFubmVsc1F1ZXJ5XG4gKiBAZXh0ZW5kcyBsYXllci5RdWVyeVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgeyBTWU5DX1NUQVRFIH0gPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5jb25zdCBDb252ZXJzYXRpb25zUXVlcnkgPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbnMtcXVlcnknKTtcblxuY2xhc3MgQ2hhbm5lbHNRdWVyeSBleHRlbmRzIENvbnZlcnNhdGlvbnNRdWVyeSB7XG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQ2hhbm5lbHModGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKGNoYW5uZWxzKSA9PiB7XG4gICAgICBpZiAoY2hhbm5lbHMubGVuZ3RoKSB0aGlzLl9hcHBlbmRSZXN1bHRzKHsgZGF0YTogY2hhbm5lbHMgfSwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGNoYW5uZWxzP3BhZ2Vfc2l6ZT0ke3BhZ2VTaXplfWAgK1xuICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICBpZiAobmV3UmVxdWVzdCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCkge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHRlbGVtZXRyeToge1xuICAgICAgICAgIG5hbWU6ICdjaGFubmVsX3F1ZXJ5X3RpbWUnLFxuICAgICAgICB9LFxuICAgICAgICB1cmw6IHRoaXMuX2ZpcmluZ1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCB0aGlzLl9maXJpbmdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTb3J0RmllbGQoKSB7XG4gICAgcmV0dXJuICdjcmVhdGVkX2F0JztcbiAgfVxuXG4gIF9nZXRJdGVtKGlkKSB7XG4gICAgcmV0dXJuIFF1ZXJ5LnByb3RvdHlwZS5fZ2V0SXRlbS5hcHBseSh0aGlzLCBbaWRdKTtcbiAgfVxuXG4gIF9oYW5kbGVFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbidzIHByb3BlcnR5IGhhcyBjaGFuZ2VkLCBhbmQgdGhlIENvbnZlcnNhdGlvbiBpcyBpbiB0aGlzXG4gICAgICAvLyBRdWVyeSdzIGRhdGEsIHRoZW4gdXBkYXRlIGl0LlxuICAgICAgY2FzZSAnY2hhbm5lbHM6Y2hhbmdlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ2hhbmdlRXZlbnQoJ2NoYW5uZWxzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uIGlzIGFkZGVkLCBhbmQgaXQgaXNuJ3QgYWxyZWFkeSBpbiB0aGUgUXVlcnksXG4gICAgICAvLyBhZGQgaXQgYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ2NoYW5uZWxzOmFkZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUFkZEV2ZW50KCdjaGFubmVscycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbiBpcyBkZWxldGVkLCBhbmQgaXRzIHN0aWxsIGluIG91ciBkYXRhLFxuICAgICAgLy8gcmVtb3ZlIGl0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50LlxuICAgICAgY2FzZSAnY2hhbm5lbHM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlUmVtb3ZlRXZlbnQoJ2NoYW5uZWxzJywgZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgdGhpcy5kYXRhLnVuc2hpZnQodGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuICBfaGFuZGxlQ2hhbmdlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG5cbiAgICAvLyBJZiBpdHMgYW4gSUQgY2hhbmdlIChtYXRjaGluZyBuYW1lZCBjaGFubmVsIHJldHVybmVkIGJ5IHNlcnZlcikgbWFrZSBzdXJlIHRvIHVwZGF0ZSBvdXIgZGF0YS5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBhbiBpbnN0YW5jZSwgaXRzIGJlZW4gdXBkYXRlZCBmb3IgdXMuXG4gICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICBjb25zdCBpZENoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignaWQnKTtcbiAgICAgIGlmIChpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWRDaGFuZ2VzWzBdLm9sZFZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBcIm9iamVjdFwiIHRoZW4gdXBkYXRlIHRoZSBvYmplY3QgYW5kIG91ciBhcnJheTtcbiAgICAvLyBlbHNlIHRoZSBvYmplY3QgaXMgYWxyZWFkeSB1cGRhdGVkLlxuICAgIC8vIElnbm9yZSByZXN1bHRzIHRoYXQgYXJlbid0IGFscmVhZHkgaW4gb3VyIGRhdGE7IFJlc3VsdHMgYXJlIGFkZGVkIHZpYVxuICAgIC8vIGNoYW5uZWxzOmFkZCBldmVudHMuICBXZWJzb2NrZXQgTWFuYWdlciBhdXRvbWF0aWNhbGx5IGxvYWRzIGFueXRoaW5nIHRoYXQgcmVjZWl2ZXMgYW4gZXZlbnRcbiAgICAvLyBmb3Igd2hpY2ggd2UgaGF2ZSBubyBvYmplY3QsIHNvIHdlJ2xsIGdldCB0aGUgYWRkIGV2ZW50IGF0IHRoYXQgdGltZS5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBjb25zdCBzb3J0RmllbGQgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcbiAgICAgIGNvbnN0IHJlb3JkZXIgPSBldnQuaGFzUHJvcGVydHkoJ2xhc3RNZXNzYWdlJykgJiYgc29ydEZpZWxkID09PSAnbGFzdF9tZXNzYWdlJztcbiAgICAgIGxldCBuZXdJbmRleDtcblxuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIGlmICghcmVvcmRlcikge1xuICAgICAgICAgIC8vIFJlcGxhY2UgdGhlIGNoYW5nZWQgQ2hhbm5lbCB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGV2dC50YXJnZXQsIHRoaXMuZGF0YSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChbXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRWxzZSBkYXRhVHlwZSBpcyBpbnN0YW5jZSBub3Qgb2JqZWN0XG4gICAgICBlbHNlIGlmIChyZW9yZGVyKSB7XG4gICAgICAgIG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0SW5kZXgoZXZ0LnRhcmdldCwgdGhpcy5kYXRhKTtcbiAgICAgICAgaWYgKG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIGV2dC50YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRyaWdnZXIgYSAncHJvcGVydHknIGV2ZW50XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZW9yZGVyICYmIG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnbW92ZScsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgICAgICBmcm9tSW5kZXg6IGluZGV4LFxuICAgICAgICAgIHRvSW5kZXg6IG5ld0luZGV4LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZ2V0SW5zZXJ0SW5kZXgoY2hhbm5lbCwgZGF0YSkge1xuICAgIGlmICghY2hhbm5lbC5pc1NhdmVkKCkpIHJldHVybiAwO1xuICAgIGNvbnN0IHNvcnRGaWVsZCA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuICAgIGxldCBpbmRleDtcbiAgICBpZiAoc29ydEZpZWxkID09PSAnY3JlYXRlZF9hdCcpIHtcbiAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBkYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIHtcbiAgICAgICAgICAvLyBOby1vcCBkbyBub3QgaW5zZXJ0IHNlcnZlciBkYXRhIGJlZm9yZSBuZXcgYW5kIHVuc2F2ZWQgZGF0YVxuICAgICAgICB9IGVsc2UgaWYgKGNoYW5uZWwuY3JlYXRlZEF0ID49IGl0ZW0uY3JlYXRlZEF0KSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9sZEluZGV4ID0gLTE7XG4gICAgICBjb25zdCBkMSA9IGNoYW5uZWwubGFzdE1lc3NhZ2UgPyBjaGFubmVsLmxhc3RNZXNzYWdlLnNlbnRBdCA6IGNoYW5uZWwuY3JlYXRlZEF0O1xuICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoaXRlbS5pZCA9PT0gY2hhbm5lbC5pZCkge1xuICAgICAgICAgIG9sZEluZGV4ID0gaW5kZXg7XG4gICAgICAgIH0gZWxzZSBpZiAoaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXIHx8IGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORykge1xuICAgICAgICAgIC8vIE5vLW9wIGRvIG5vdCBpbnNlcnQgc2VydmVyIGRhdGEgYmVmb3JlIG5ldyBhbmQgdW5zYXZlZCBkYXRhXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZDIgPSBpdGVtLmxhc3RNZXNzYWdlID8gaXRlbS5sYXN0TWVzc2FnZS5zZW50QXQgOiBpdGVtLmNyZWF0ZWRBdDtcbiAgICAgICAgICBpZiAoZDEgPj0gZDIpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gb2xkSW5kZXggPT09IC0xIHx8IG9sZEluZGV4ID4gaW5kZXggPyBpbmRleCA6IGluZGV4IC0gMTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQWRkRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgLy8gRmlsdGVyIG91dCBhbnkgQ2hhbm5lbHMgYWxyZWFkeSBpbiBvdXIgZGF0YVxuICAgIGNvbnN0IGxpc3QgPSBldnRbbmFtZV0uZmlsdGVyKGNoYW5uZWwgPT4gdGhpcy5fZ2V0SW5kZXgoY2hhbm5lbC5pZCkgPT09IC0xKTtcblxuICAgIGlmIChsaXN0Lmxlbmd0aCkge1xuICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcblxuICAgICAgLy8gdHlwaWNhbGx5IGJ1bGsgaW5zZXJ0cyBoYXBwZW4gdmlhIF9hcHBlbmRSZXN1bHRzKCk7IHNvIHRoaXMgYXJyYXkgdHlwaWNhbGx5IGl0ZXJhdGVzIG92ZXIgYW4gYXJyYXkgb2YgbGVuZ3RoIDFcbiAgICAgIGxpc3QuZm9yRWFjaCgoY2hhbm5lbCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydEluZGV4KGNoYW5uZWwsIGRhdGEpO1xuICAgICAgICBkYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShjaGFubmVsKSk7XG5cbiAgICAgICAgLy8gVHlwaWNhbGx5IHRoaXMgbG9vcCBvbmx5IGl0ZXJhdGVzIG9uY2U7IGJ1dCBlYWNoIGl0ZXJhdGlvbiBpcyBnYXVyZW50ZWVkIGEgdW5pcXVlIG9iamVjdCBpZiBuZWVkZWRcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gW10uY29uY2F0KGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudG90YWxTaXplICs9IDE7XG5cbiAgICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX2dldERhdGEoY2hhbm5lbCk7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgIGluZGV4OiBuZXdJbmRleCxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cblxuICBfaGFuZGxlUmVtb3ZlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dFtuYW1lXS5mb3JFYWNoKChjaGFubmVsKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGNoYW5uZWwuaWQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBpZiAoY2hhbm5lbC5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKGNoYW5uZWwuaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBjaGFubmVsLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gWy4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEocmVtb3ZlZE9iai5kYXRhKSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5DaGFubmVsc1F1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG5cbl0uY29uY2F0KENvbnZlcnNhdGlvbnNRdWVyeS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuXG5DaGFubmVsc1F1ZXJ5Lk1heFBhZ2VTaXplID0gMTAwO1xuXG5DaGFubmVsc1F1ZXJ5LnByb3RvdHlwZS5tb2RlbCA9IFF1ZXJ5LkNoYW5uZWw7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KENoYW5uZWxzUXVlcnksIFtDaGFubmVsc1F1ZXJ5LCAnQ2hhbm5lbHNRdWVyeSddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDaGFubmVsc1F1ZXJ5O1xuIl19
