'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Announcements
 *
 *      var announcementQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Announcement
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
 * @class  layer.AnnouncementsQuery
 * @extends layer.Query
 */
var Root = require('../root');
var Query = require('./query');
var MessagesQuery = require('./messages-query');

var AnnouncementsQuery = function (_MessagesQuery) {
  _inherits(AnnouncementsQuery, _MessagesQuery);

  function AnnouncementsQuery() {
    _classCallCheck(this, AnnouncementsQuery);

    return _possibleConstructorReturn(this, (AnnouncementsQuery.__proto__ || Object.getPrototypeOf(AnnouncementsQuery)).apply(this, arguments));
  }

  _createClass(AnnouncementsQuery, [{
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      return Query.prototype._fixPredicate.apply(this, [inValue]);
    }
  }, {
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var _this2 = this;

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadAnnouncements(this._nextDBFromId, pageSize, function (messages) {
        if (messages.length) _this2._appendResults({ data: messages }, true);
      });

      var newRequest = 'announcements?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't repeat still firing queries
      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          telemetry: {
            name: 'announcement_query_time'
          },
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, newRequest, pageSize);
        });
      }
    }
  }]);

  return AnnouncementsQuery;
}(MessagesQuery);

AnnouncementsQuery._supportedEvents = [].concat(MessagesQuery._supportedEvents);

AnnouncementsQuery.MaxPageSize = 100;

AnnouncementsQuery.prototype.model = Query.Announcement;

Root.initClass.apply(AnnouncementsQuery, [AnnouncementsQuery, 'AnnouncementsQuery']);

module.exports = AnnouncementsQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2Fubm91bmNlbWVudHMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJRdWVyeSIsIk1lc3NhZ2VzUXVlcnkiLCJBbm5vdW5jZW1lbnRzUXVlcnkiLCJpblZhbHVlIiwicHJvdG90eXBlIiwiX2ZpeFByZWRpY2F0ZSIsImFwcGx5IiwicGFnZVNpemUiLCJjbGllbnQiLCJkYk1hbmFnZXIiLCJsb2FkQW5ub3VuY2VtZW50cyIsIl9uZXh0REJGcm9tSWQiLCJtZXNzYWdlcyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ0ZWxlbWV0cnkiLCJuYW1lIiwidXJsIiwibWV0aG9kIiwic3luYyIsIl9wcm9jZXNzUnVuUmVzdWx0cyIsInJlc3VsdHMiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiTWF4UGFnZVNpemUiLCJtb2RlbCIsIkFubm91bmNlbWVudCIsImluaXRDbGFzcyIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFFBQVFELFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBTUUsZ0JBQWdCRixRQUFRLGtCQUFSLENBQXRCOztJQUVNRyxrQjs7Ozs7Ozs7Ozs7a0NBQ1VDLE8sRUFBUztBQUNyQixhQUFPSCxNQUFNSSxTQUFOLENBQWdCQyxhQUFoQixDQUE4QkMsS0FBOUIsQ0FBb0MsSUFBcEMsRUFBMEMsQ0FBQ0gsT0FBRCxDQUExQyxDQUFQO0FBQ0Q7OzsrQkFFVUksUSxFQUFVO0FBQUE7O0FBQ25CO0FBQ0EsV0FBS0MsTUFBTCxDQUFZQyxTQUFaLENBQXNCQyxpQkFBdEIsQ0FBd0MsS0FBS0MsYUFBN0MsRUFBNERKLFFBQTVELEVBQXNFLFVBQUNLLFFBQUQsRUFBYztBQUNsRixZQUFJQSxTQUFTQyxNQUFiLEVBQXFCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsUUFBUixFQUFwQixFQUF3QyxJQUF4QztBQUN0QixPQUZEOztBQUlBLFVBQU1JLGFBQWEsNkJBQTJCVCxRQUEzQixJQUNoQixLQUFLVSxpQkFBTCxHQUF5QixjQUFjLEtBQUtBLGlCQUE1QyxHQUFnRSxFQURoRCxDQUFuQjs7QUFHQTtBQUNBLFVBQUlELGVBQWUsS0FBS0UsY0FBeEIsRUFBd0M7QUFDdEMsYUFBS0MsUUFBTCxHQUFnQixJQUFoQjtBQUNBLGFBQUtELGNBQUwsR0FBc0JGLFVBQXRCO0FBQ0EsYUFBS1IsTUFBTCxDQUFZWSxHQUFaLENBQWdCO0FBQ2RDLHFCQUFXO0FBQ1RDLGtCQUFNO0FBREcsV0FERztBQUlkQyxlQUFLUCxVQUpTO0FBS2RRLGtCQUFRLEtBTE07QUFNZEMsZ0JBQU07QUFOUSxTQUFoQixFQU9HO0FBQUEsaUJBQVcsT0FBS0Msa0JBQUwsQ0FBd0JDLE9BQXhCLEVBQWlDWCxVQUFqQyxFQUE2Q1QsUUFBN0MsQ0FBWDtBQUFBLFNBUEg7QUFRRDtBQUNGOzs7O0VBM0I4Qk4sYTs7QUE4QmpDQyxtQkFBbUIwQixnQkFBbkIsR0FBc0MsR0FDcENDLE1BRG9DLENBQzdCNUIsY0FBYzJCLGdCQURlLENBQXRDOztBQUlBMUIsbUJBQW1CNEIsV0FBbkIsR0FBaUMsR0FBakM7O0FBRUE1QixtQkFBbUJFLFNBQW5CLENBQTZCMkIsS0FBN0IsR0FBcUMvQixNQUFNZ0MsWUFBM0M7O0FBRUFsQyxLQUFLbUMsU0FBTCxDQUFlM0IsS0FBZixDQUFxQkosa0JBQXJCLEVBQXlDLENBQUNBLGtCQUFELEVBQXFCLG9CQUFyQixDQUF6Qzs7QUFFQWdDLE9BQU9DLE9BQVAsR0FBaUJqQyxrQkFBakIiLCJmaWxlIjoiYW5ub3VuY2VtZW50cy1xdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUXVlcnkgY2xhc3MgZm9yIHJ1bm5pbmcgYSBRdWVyeSBvbiBBbm5vdW5jZW1lbnRzXG4gKlxuICogICAgICB2YXIgYW5ub3VuY2VtZW50UXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5Bbm5vdW5jZW1lbnRcbiAqICAgICAgfSk7XG4gKlxuICpcbiAqIFlvdSBjYW4gY2hhbmdlIHRoZSBgcGFnaW5hdGlvbldpbmRvd2AgcHJvcGVydHkgYXQgYW55IHRpbWUgdXNpbmc6XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe1xuICogICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IDIwMFxuICogICAgICB9KTtcbiAqXG4gKiBZb3UgY2FuIHJlbGVhc2UgZGF0YSBoZWxkIGluIG1lbW9yeSBieSB5b3VyIHF1ZXJpZXMgd2hlbiBkb25lIHdpdGggdGhlbTpcbiAqXG4gKiAgICAgIHF1ZXJ5LmRlc3Ryb3koKTtcbiAqXG4gKiBAY2xhc3MgIGxheWVyLkFubm91bmNlbWVudHNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuY29uc3QgTWVzc2FnZXNRdWVyeSA9IHJlcXVpcmUoJy4vbWVzc2FnZXMtcXVlcnknKTtcblxuY2xhc3MgQW5ub3VuY2VtZW50c1F1ZXJ5IGV4dGVuZHMgTWVzc2FnZXNRdWVyeSB7XG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIHJldHVybiBRdWVyeS5wcm90b3R5cGUuX2ZpeFByZWRpY2F0ZS5hcHBseSh0aGlzLCBbaW5WYWx1ZV0pO1xuICB9XG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIC8vIFJldHJpZXZlIGRhdGEgZnJvbSBkYiBjYWNoZSBpbiBwYXJhbGxlbCB3aXRoIGxvYWRpbmcgZGF0YSBmcm9tIHNlcnZlclxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQW5ub3VuY2VtZW50cyh0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgYW5ub3VuY2VtZW50cz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB0ZWxlbWV0cnk6IHtcbiAgICAgICAgICBuYW1lOiAnYW5ub3VuY2VtZW50X3F1ZXJ5X3RpbWUnLFxuICAgICAgICB9LFxuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxufVxuXG5Bbm5vdW5jZW1lbnRzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbl0uY29uY2F0KE1lc3NhZ2VzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuQW5ub3VuY2VtZW50c1F1ZXJ5Lk1heFBhZ2VTaXplID0gMTAwO1xuXG5Bbm5vdW5jZW1lbnRzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuQW5ub3VuY2VtZW50O1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShBbm5vdW5jZW1lbnRzUXVlcnksIFtBbm5vdW5jZW1lbnRzUXVlcnksICdBbm5vdW5jZW1lbnRzUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQW5ub3VuY2VtZW50c1F1ZXJ5O1xuIl19
