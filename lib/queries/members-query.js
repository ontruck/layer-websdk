'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* Feature is tested but not available on server
 * Query class for running a Query on Channel Members
 *
 * @class  layer.MembersQuery
 * @extends layer.Query
 */
var Root = require('../root');
var LayerError = require('../layer-error');
var Logger = require('../logger');
var Query = require('./query');

var findChannelIdRegex = new RegExp(/^channel.id\s*=\s*['"]((layer:\/\/\/channels\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);

var MembersQuery = function (_Query) {
  _inherits(MembersQuery, _Query);

  function MembersQuery() {
    _classCallCheck(this, MembersQuery);

    return _possibleConstructorReturn(this, (MembersQuery.__proto__ || Object.getPrototypeOf(MembersQuery)).apply(this, arguments));
  }

  _createClass(MembersQuery, [{
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      if (inValue === '') return '';
      if (inValue.indexOf('channel.id') !== -1) {
        var channelId = inValue.match(findChannelIdRegex) ? inValue.replace(findChannelIdRegex, '$1') : null;
        if (!channelId) throw new Error(LayerError.dictionary.invalidPredicate);
        if (channelId.indexOf('layer:///channels/') !== 0) channelId = 'layer:///channels/' + channelId;
        return 'channel.id = \'' + channelId + '\'';
      } else {
        throw new Error(LayerError.dictionary.invalidPredicate);
      }
    }

    /**
    * Get the Channel UUID from the predicate property.
    *
    * Extract the Channel's UUID from the predicate... or returned the cached value.
    *
    * @method _getChannelPredicateIds
    * @private
    */

  }, {
    key: '_getChannelPredicateIds',
    value: function _getChannelPredicateIds() {
      if (this.predicate.match(findChannelIdRegex)) {
        var channelId = this.predicate.replace(findChannelIdRegex, '$1');

        // We will already have a this._predicate if we are paging; else we need to extract the UUID from
        // the channelId.
        var uuid = (this._predicate || channelId).replace(/^layer:\/\/\/channels\//, '');
        if (uuid) {
          return {
            uuid: uuid,
            id: channelId,
            type: Query.Channel
          };
        }
      }
    }
  }, {
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var _this2 = this;

      var predicateIds = this._getChannelPredicateIds();

      // Do nothing if we don't have a conversation to query on
      if (!predicateIds) {
        if (!this.predicate.match(/['"]/)) {
          Logger.error('This query may need to quote its value');
        }
        return;
      }

      var channelId = 'layer:///channels/' + predicateIds.uuid;
      if (!this._predicate) this._predicate = predicateIds.id;
      var channel = this.client.getChannel(channelId);

      var newRequest = 'channels/' + predicateIds.uuid + '/members?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't query on unsaved channels, nor repeat still firing queries
      if ((!channel || channel.isSaved()) && newRequest !== this._firingRequest) {
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
    }
  }, {
    key: '_appendResultsSplice',
    value: function _appendResultsSplice(item) {
      this.data.push(this._getData(item));
    }
  }, {
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {
      switch (eventName) {

        // If a member has changed and its in our result set, replace
        // it with a new immutable object
        case 'members:change':
          this._handleChangeEvent('members', evt);
          break;

        // If members are added, and they aren't already in our result set
        // add them.
        case 'members:add':
          this._handleAddEvent('members', evt);
          break;

        // If a Identity is deleted and its in our result set, remove it
        // and trigger an event
        case 'members:remove':
          this._handleRemoveEvent('members', evt);
          break;
      }
    }
  }]);

  return MembersQuery;
}(Query);

MembersQuery._supportedEvents = [].concat(Query._supportedEvents);

MembersQuery.MaxPageSize = 500;

MembersQuery.prototype.model = Query.Membership;

Root.initClass.apply(MembersQuery, [MembersQuery, 'MembersQuery']);

module.exports = MembersQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL21lbWJlcnMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJMYXllckVycm9yIiwiTG9nZ2VyIiwiUXVlcnkiLCJmaW5kQ2hhbm5lbElkUmVnZXgiLCJSZWdFeHAiLCJNZW1iZXJzUXVlcnkiLCJpblZhbHVlIiwiaW5kZXhPZiIsImNoYW5uZWxJZCIsIm1hdGNoIiwicmVwbGFjZSIsIkVycm9yIiwiZGljdGlvbmFyeSIsImludmFsaWRQcmVkaWNhdGUiLCJwcmVkaWNhdGUiLCJ1dWlkIiwiX3ByZWRpY2F0ZSIsImlkIiwidHlwZSIsIkNoYW5uZWwiLCJwYWdlU2l6ZSIsInByZWRpY2F0ZUlkcyIsIl9nZXRDaGFubmVsUHJlZGljYXRlSWRzIiwiZXJyb3IiLCJjaGFubmVsIiwiY2xpZW50IiwiZ2V0Q2hhbm5lbCIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsImlzU2F2ZWQiLCJfZmlyaW5nUmVxdWVzdCIsImlzRmlyaW5nIiwieGhyIiwidXJsIiwibWV0aG9kIiwic3luYyIsIl9wcm9jZXNzUnVuUmVzdWx0cyIsInJlc3VsdHMiLCJpdGVtIiwiZGF0YSIsInB1c2giLCJfZ2V0RGF0YSIsImV2ZW50TmFtZSIsImV2dCIsIl9oYW5kbGVDaGFuZ2VFdmVudCIsIl9oYW5kbGVBZGRFdmVudCIsIl9oYW5kbGVSZW1vdmVFdmVudCIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJNYXhQYWdlU2l6ZSIsInByb3RvdHlwZSIsIm1vZGVsIiwiTWVtYmVyc2hpcCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLGFBQWFELFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNRSxTQUFTRixRQUFRLFdBQVIsQ0FBZjtBQUNBLElBQU1HLFFBQVFI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LEcsRUFBSztBQUM1QixjQUFRRCxTQUFSOztBQUVFO0FBQ0E7QUFDQSxhQUFLLGdCQUFMO0FBQ0UsZUFBS0Usa0JBQUwsQ0FBd0IsU0FBeEIsRUFBbUNELEdBQW5DO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssYUFBTDtBQUNFLGVBQUtFLGVBQUwsQ0FBcUIsU0FBckIsRUFBZ0NGLEdBQWhDO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssZ0JBQUw7QUFDRSxlQUFLRyxrQkFBTCxDQUF3QixTQUF4QixFQUFtQ0gsR0FBbkM7QUFDQTtBQWxCSjtBQW9CRDs7OztFQS9Gd0J6QyxLOztBQWtHM0JHLGFBQWEwQyxnQkFBYixHQUFnQyxHQUU5QkMsTUFGOEIsQ0FFdkI5QyxNQUFNNkMsZ0JBRmlCLENBQWhDOztBQUtBMUMsYUFBYTRDLFdBQWIsR0FBMkIsR0FBM0I7O0FBRUE1QyxhQUFhNkMsU0FBYixDQUF1QkMsS0FBdkIsR0FBK0JqRCxNQUFNa0QsVUFBckM7O0FBRUF0RCxLQUFLdUQsU0FBTCxDQUFlQyxLQUFmLENBQXFCakQsWUFBckIsRUFBbUMsQ0FBQ0EsWUFBRCxFQUFlLGNBQWYsQ0FBbkM7O0FBRUFrRCxPQUFPQyxPQUFQLEdBQWlCbkQsWUFBakIiLCJmaWxlIjoibWVtYmVycy1xdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIEZlYXR1cmUgaXMgdGVzdGVkIGJ1dCBub3QgYXZhaWxhYmxlIG9uIHNlcnZlclxuICogUXVlcnkgY2xhc3MgZm9yIHJ1bm5pbmcgYSBRdWVyeSBvbiBDaGFubmVsIE1lbWJlcnNcbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lbWJlcnNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5jb25zdCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcblxuY29uc3QgZmluZENoYW5uZWxJZFJlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgL15jaGFubmVsLmlkXFxzKj1cXHMqWydcIl0oKGxheWVyOlxcL1xcL1xcL2NoYW5uZWxzXFwvKT8uezh9LS57NH0tLns0fS0uezR9LS57MTJ9KVsnXCJdJC8pO1xuXG5cbmNsYXNzIE1lbWJlcnNRdWVyeSBleHRlbmRzIFF1ZXJ5IHtcbiAgX2ZpeFByZWRpY2F0ZShpblZhbHVlKSB7XG4gICAgaWYgKGluVmFsdWUgPT09ICcnKSByZXR1cm4gJyc7XG4gICAgaWYgKGluVmFsdWUuaW5kZXhPZignY2hhbm5lbC5pZCcpICE9PSAtMSkge1xuICAgICAgbGV0IGNoYW5uZWxJZCA9IGluVmFsdWUubWF0Y2goZmluZENoYW5uZWxJZFJlZ2V4KSA/IGluVmFsdWUucmVwbGFjZShmaW5kQ2hhbm5lbElkUmVnZXgsICckMScpIDogbnVsbDtcbiAgICAgIGlmICghY2hhbm5lbElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmludmFsaWRQcmVkaWNhdGUpO1xuICAgICAgaWYgKGNoYW5uZWxJZC5pbmRleE9mKCdsYXllcjovLy9jaGFubmVscy8nKSAhPT0gMCkgY2hhbm5lbElkID0gJ2xheWVyOi8vL2NoYW5uZWxzLycgKyBjaGFubmVsSWQ7XG4gICAgICByZXR1cm4gYGNoYW5uZWwuaWQgPSAnJHtjaGFubmVsSWR9J2A7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaW52YWxpZFByZWRpY2F0ZSk7XG4gICAgfVxuICB9XG5cbiAgIC8qKlxuICAgKiBHZXQgdGhlIENoYW5uZWwgVVVJRCBmcm9tIHRoZSBwcmVkaWNhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEV4dHJhY3QgdGhlIENoYW5uZWwncyBVVUlEIGZyb20gdGhlIHByZWRpY2F0ZS4uLiBvciByZXR1cm5lZCB0aGUgY2FjaGVkIHZhbHVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDaGFubmVsUHJlZGljYXRlSWRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0Q2hhbm5lbFByZWRpY2F0ZUlkcygpIHtcbiAgICBpZiAodGhpcy5wcmVkaWNhdGUubWF0Y2goZmluZENoYW5uZWxJZFJlZ2V4KSkge1xuICAgICAgY29uc3QgY2hhbm5lbElkID0gdGhpcy5wcmVkaWNhdGUucmVwbGFjZShmaW5kQ2hhbm5lbElkUmVnZXgsICckMScpO1xuXG4gICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAvLyB0aGUgY2hhbm5lbElkLlxuICAgICAgY29uc3QgdXVpZCA9ICh0aGlzLl9wcmVkaWNhdGUgfHwgY2hhbm5lbElkKS5yZXBsYWNlKC9ebGF5ZXI6XFwvXFwvXFwvY2hhbm5lbHNcXC8vLCAnJyk7XG4gICAgICBpZiAodXVpZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgaWQ6IGNoYW5uZWxJZCxcbiAgICAgICAgICB0eXBlOiBRdWVyeS5DaGFubmVsLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHByZWRpY2F0ZUlkcyA9IHRoaXMuX2dldENoYW5uZWxQcmVkaWNhdGVJZHMoKTtcblxuICAgIC8vIERvIG5vdGhpbmcgaWYgd2UgZG9uJ3QgaGF2ZSBhIGNvbnZlcnNhdGlvbiB0byBxdWVyeSBvblxuICAgIGlmICghcHJlZGljYXRlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMucHJlZGljYXRlLm1hdGNoKC9bJ1wiXS8pKSB7XG4gICAgICAgIExvZ2dlci5lcnJvcignVGhpcyBxdWVyeSBtYXkgbmVlZCB0byBxdW90ZSBpdHMgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjaGFubmVsSWQgPSAnbGF5ZXI6Ly8vY2hhbm5lbHMvJyArIHByZWRpY2F0ZUlkcy51dWlkO1xuICAgIGlmICghdGhpcy5fcHJlZGljYXRlKSB0aGlzLl9wcmVkaWNhdGUgPSBwcmVkaWNhdGVJZHMuaWQ7XG4gICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuY2xpZW50LmdldENoYW5uZWwoY2hhbm5lbElkKTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY2hhbm5lbHMvJHtwcmVkaWNhdGVJZHMudXVpZH0vbWVtYmVycz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcXVlcnkgb24gdW5zYXZlZCBjaGFubmVscywgbm9yIHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgIGlmICgoIWNoYW5uZWwgfHwgY2hhbm5lbC5pc1NhdmVkKCkpICYmIG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9hcHBlbmRSZXN1bHRzU3BsaWNlKGl0ZW0pIHtcbiAgICB0aGlzLmRhdGEucHVzaCh0aGlzLl9nZXREYXRhKGl0ZW0pKTtcbiAgfVxuXG5cbiAgX2hhbmRsZUV2ZW50cyhldmVudE5hbWUsIGV2dCkge1xuICAgIHN3aXRjaCAoZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgbWVtYmVyIGhhcyBjaGFuZ2VkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlcGxhY2VcbiAgICAgIC8vIGl0IHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgY2FzZSAnbWVtYmVyczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDaGFuZ2VFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBtZW1iZXJzIGFyZSBhZGRlZCwgYW5kIHRoZXkgYXJlbid0IGFscmVhZHkgaW4gb3VyIHJlc3VsdCBzZXRcbiAgICAgIC8vIGFkZCB0aGVtLlxuICAgICAgY2FzZSAnbWVtYmVyczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnbWVtYmVyczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVSZW1vdmVFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5NZW1iZXJzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuTWVtYmVyc1F1ZXJ5Lk1heFBhZ2VTaXplID0gNTAwO1xuXG5NZW1iZXJzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuTWVtYmVyc2hpcDtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVtYmVyc1F1ZXJ5LCBbTWVtYmVyc1F1ZXJ5LCAnTWVtYmVyc1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lbWJlcnNRdWVyeTtcbiJdfQ==
