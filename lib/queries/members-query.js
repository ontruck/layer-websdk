'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Channel Members
 *
 *      var membersQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Membership,
 *        predicate: 'channel.id = "layer:///channels/UUID"'
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
 * Note that the `predicate` property is only supported for Messages and Membership, and only supports
 * querying by Channel.
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
        if (this.predicate && !this.predicate.match(/['"]/)) {
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
          telemetry: {
            name: 'member_query_time'
          },
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL21lbWJlcnMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJMYXllckVycm9yIiwiTG9nZ2VyIiwiUXVlcnkiLCJmaW5kQ2hhbm5lbElkUmVnZXgiLCJSZWdFeHAiLCJNZW1iZXJzUXVlcnkiLCJpblZhbHVlIiwiaW5kZXhPZiIsImNoYW5uZWxJZCIsIm1hdGNoIiwicmVwbGFjZSIsIkVycm9yIiwiZGljdGlvbmFyeSIsImludmFsaWRQcmVkaWNhdGUiLCJwcmVkaWNhdGUiLCJ1dWlkIiwiX3ByZWRpY2F0ZSIsImlkIiwidHlwZSIsIkNoYW5uZWwiLCJwYWdlU2l6ZSIsInByZWRpY2F0ZUlkcyIsIl9nZXRDaGFubmVsUHJlZGljYXRlSWRzIiwiZXJyb3IiLCJjaGFubmVsIiwiY2xpZW50IiwiZ2V0Q2hhbm5lbCIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsImlzU2F2ZWQiLCJfZmlyaW5nUmVxdWVzdCIsImlzRmlyaW5nIiwieGhyIiwidGVsZW1ldHJ5IiwibmFtZSIsInVybCIsIm1ldGhvZCIsInN5bmMiLCJfcHJvY2Vzc1J1blJlc3VsdHMiLCJyZXN1bHRzIiwiaXRlbSIsImRhdGEiLCJwdXNoIiwiX2dldERhdGEiLCJldmVudE5hbWUiLCJldnQiLCJfaGFuZGxlQ2hhbmdlRXZlbnQiLCJfaGFuZGxlQWRkRXZlbnQiLCJfaGFuZGxlUmVtb3ZlRXZlbnQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiTWF4UGFnZVNpemUiLCJwcm90b3R5cGUiLCJtb2RlbCIsIk1lbWJlcnNoaXAiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMkJBLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsYUFBYUQsUUFBUSxnQkFBUixDQUFuQjtBQUNBLElB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b0JvQixJLEVBQU07QUFDekIsV0FBS0MsSUFBTCxDQUFVQyxJQUFWLENBQWUsS0FBS0MsUUFBTCxDQUFjSCxJQUFkLENBQWY7QUFDRDs7O2tDQUdhSSxTLEVBQVdDLEcsRUFBSztBQUM1QixjQUFRRCxTQUFSOztBQUVFO0FBQ0E7QUFDQSxhQUFLLGdCQUFMO0FBQ0UsZUFBS0Usa0JBQUwsQ0FBd0IsU0FBeEIsRUFBbUNELEdBQW5DO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssYUFBTDtBQUNFLGVBQUtFLGVBQUwsQ0FBcUIsU0FBckIsRUFBZ0NGLEdBQWhDO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssZ0JBQUw7QUFDRSxlQUFLRyxrQkFBTCxDQUF3QixTQUF4QixFQUFtQ0gsR0FBbkM7QUFDQTtBQWxCSjtBQW9CRDs7OztFQWxHd0IzQyxLOztBQXFHM0JHLGFBQWE0QyxnQkFBYixHQUFnQyxHQUU5QkMsTUFGOEIsQ0FFdkJoRCxNQUFNK0MsZ0JBRmlCLENBQWhDOztBQUtBNUMsYUFBYThDLFdBQWIsR0FBMkIsR0FBM0I7O0FBRUE5QyxhQUFhK0MsU0FBYixDQUF1QkMsS0FBdkIsR0FBK0JuRCxNQUFNb0QsVUFBckM7O0FBRUF4RCxLQUFLeUQsU0FBTCxDQUFlQyxLQUFmLENBQXFCbkQsWUFBckIsRUFBbUMsQ0FBQ0EsWUFBRCxFQUFlLGNBQWYsQ0FBbkM7O0FBRUFvRCxPQUFPQyxPQUFQLEdBQWlCckQsWUFBakIiLCJmaWxlIjoibWVtYmVycy1xdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUXVlcnkgY2xhc3MgZm9yIHJ1bm5pbmcgYSBRdWVyeSBvbiBDaGFubmVsIE1lbWJlcnNcbiAqXG4gKiAgICAgIHZhciBtZW1iZXJzUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZW1iZXJzaGlwLFxuICogICAgICAgIHByZWRpY2F0ZTogJ2NoYW5uZWwuaWQgPSBcImxheWVyOi8vL2NoYW5uZWxzL1VVSURcIidcbiAqICAgICAgfSk7XG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGRhdGEgc2VsZWN0ZWQgYnkgeW91ciBxdWVyeSBhbnkgdGltZSB5b3Ugd2FudCB1c2luZzpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgcHJlZGljYXRlOiAnY2hhbm5lbC5pZCA9IFwibGF5ZXI6Ly8vY2hhbm5lbHMvVVVJRDJcIidcbiAqICAgICAgfSk7XG4gKlxuICogWW91IGNhbiByZWxlYXNlIGRhdGEgaGVsZCBpbiBtZW1vcnkgYnkgeW91ciBxdWVyaWVzIHdoZW4gZG9uZSB3aXRoIHRoZW06XG4gKlxuICogICAgICBxdWVyeS5kZXN0cm95KCk7XG4gKlxuICogIyMjIyBwcmVkaWNhdGVcbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGBwcmVkaWNhdGVgIHByb3BlcnR5IGlzIG9ubHkgc3VwcG9ydGVkIGZvciBNZXNzYWdlcyBhbmQgTWVtYmVyc2hpcCwgYW5kIG9ubHkgc3VwcG9ydHNcbiAqIHF1ZXJ5aW5nIGJ5IENoYW5uZWwuXG4gKlxuICogQGNsYXNzICBsYXllci5NZW1iZXJzUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5XG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5cbmNvbnN0IGZpbmRDaGFubmVsSWRSZWdleCA9IG5ldyBSZWdFeHAoXG4gIC9eY2hhbm5lbC5pZFxccyo9XFxzKlsnXCJdKChsYXllcjpcXC9cXC9cXC9jaGFubmVsc1xcLyk/Lns4fS0uezR9LS57NH0tLns0fS0uezEyfSlbJ1wiXSQvKTtcblxuXG5jbGFzcyBNZW1iZXJzUXVlcnkgZXh0ZW5kcyBRdWVyeSB7XG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIGlmIChpblZhbHVlID09PSAnJykgcmV0dXJuICcnO1xuICAgIGlmIChpblZhbHVlLmluZGV4T2YoJ2NoYW5uZWwuaWQnKSAhPT0gLTEpIHtcbiAgICAgIGxldCBjaGFubmVsSWQgPSBpblZhbHVlLm1hdGNoKGZpbmRDaGFubmVsSWRSZWdleCkgPyBpblZhbHVlLnJlcGxhY2UoZmluZENoYW5uZWxJZFJlZ2V4LCAnJDEnKSA6IG51bGw7XG4gICAgICBpZiAoIWNoYW5uZWxJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjaGFubmVsSWQuaW5kZXhPZignbGF5ZXI6Ly8vY2hhbm5lbHMvJykgIT09IDApIGNoYW5uZWxJZCA9ICdsYXllcjovLy9jaGFubmVscy8nICsgY2hhbm5lbElkO1xuICAgICAgcmV0dXJuIGBjaGFubmVsLmlkID0gJyR7Y2hhbm5lbElkfSdgO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmludmFsaWRQcmVkaWNhdGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIENoYW5uZWwgVVVJRCBmcm9tIHRoZSBwcmVkaWNhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEV4dHJhY3QgdGhlIENoYW5uZWwncyBVVUlEIGZyb20gdGhlIHByZWRpY2F0ZS4uLiBvciByZXR1cm5lZCB0aGUgY2FjaGVkIHZhbHVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDaGFubmVsUHJlZGljYXRlSWRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0Q2hhbm5lbFByZWRpY2F0ZUlkcygpIHtcbiAgICBpZiAodGhpcy5wcmVkaWNhdGUubWF0Y2goZmluZENoYW5uZWxJZFJlZ2V4KSkge1xuICAgICAgY29uc3QgY2hhbm5lbElkID0gdGhpcy5wcmVkaWNhdGUucmVwbGFjZShmaW5kQ2hhbm5lbElkUmVnZXgsICckMScpO1xuXG4gICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAvLyB0aGUgY2hhbm5lbElkLlxuICAgICAgY29uc3QgdXVpZCA9ICh0aGlzLl9wcmVkaWNhdGUgfHwgY2hhbm5lbElkKS5yZXBsYWNlKC9ebGF5ZXI6XFwvXFwvXFwvY2hhbm5lbHNcXC8vLCAnJyk7XG4gICAgICBpZiAodXVpZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgaWQ6IGNoYW5uZWxJZCxcbiAgICAgICAgICB0eXBlOiBRdWVyeS5DaGFubmVsLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHByZWRpY2F0ZUlkcyA9IHRoaXMuX2dldENoYW5uZWxQcmVkaWNhdGVJZHMoKTtcblxuICAgIC8vIERvIG5vdGhpbmcgaWYgd2UgZG9uJ3QgaGF2ZSBhIGNvbnZlcnNhdGlvbiB0byBxdWVyeSBvblxuICAgIGlmICghcHJlZGljYXRlSWRzKSB7XG4gICAgICBpZiAodGhpcy5wcmVkaWNhdGUgJiYgIXRoaXMucHJlZGljYXRlLm1hdGNoKC9bJ1wiXS8pKSB7XG4gICAgICAgIExvZ2dlci5lcnJvcignVGhpcyBxdWVyeSBtYXkgbmVlZCB0byBxdW90ZSBpdHMgdmFsdWUnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjaGFubmVsSWQgPSAnbGF5ZXI6Ly8vY2hhbm5lbHMvJyArIHByZWRpY2F0ZUlkcy51dWlkO1xuICAgIGlmICghdGhpcy5fcHJlZGljYXRlKSB0aGlzLl9wcmVkaWNhdGUgPSBwcmVkaWNhdGVJZHMuaWQ7XG4gICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuY2xpZW50LmdldENoYW5uZWwoY2hhbm5lbElkKTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY2hhbm5lbHMvJHtwcmVkaWNhdGVJZHMudXVpZH0vbWVtYmVycz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcXVlcnkgb24gdW5zYXZlZCBjaGFubmVscywgbm9yIHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgIGlmICgoIWNoYW5uZWwgfHwgY2hhbm5lbC5pc1NhdmVkKCkpICYmIG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB0ZWxlbWV0cnk6IHtcbiAgICAgICAgICBuYW1lOiAnbWVtYmVyX3F1ZXJ5X3RpbWUnLFxuICAgICAgICB9LFxuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG4gIF9hcHBlbmRSZXN1bHRzU3BsaWNlKGl0ZW0pIHtcbiAgICB0aGlzLmRhdGEucHVzaCh0aGlzLl9nZXREYXRhKGl0ZW0pKTtcbiAgfVxuXG5cbiAgX2hhbmRsZUV2ZW50cyhldmVudE5hbWUsIGV2dCkge1xuICAgIHN3aXRjaCAoZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgbWVtYmVyIGhhcyBjaGFuZ2VkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlcGxhY2VcbiAgICAgIC8vIGl0IHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgY2FzZSAnbWVtYmVyczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDaGFuZ2VFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBtZW1iZXJzIGFyZSBhZGRlZCwgYW5kIHRoZXkgYXJlbid0IGFscmVhZHkgaW4gb3VyIHJlc3VsdCBzZXRcbiAgICAgIC8vIGFkZCB0aGVtLlxuICAgICAgY2FzZSAnbWVtYmVyczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnbWVtYmVyczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVSZW1vdmVFdmVudCgnbWVtYmVycycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5NZW1iZXJzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuTWVtYmVyc1F1ZXJ5Lk1heFBhZ2VTaXplID0gNTAwO1xuXG5NZW1iZXJzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuTWVtYmVyc2hpcDtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVtYmVyc1F1ZXJ5LCBbTWVtYmVyc1F1ZXJ5LCAnTWVtYmVyc1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lbWJlcnNRdWVyeTtcbiJdfQ==
