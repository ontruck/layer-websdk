'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Announcements
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2Fubm91bmNlbWVudHMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJRdWVyeSIsIk1lc3NhZ2VzUXVlcnkiLCJBbm5vdW5jZW1lbnRzUXVlcnkiLCJpblZhbHVlIiwicHJvdG90eXBlIiwiX2ZpeFByZWRpY2F0ZSIsImFwcGx5IiwicGFnZVNpemUiLCJjbGllbnQiLCJkYk1hbmFnZXIiLCJsb2FkQW5ub3VuY2VtZW50cyIsIl9uZXh0REJGcm9tSWQiLCJtZXNzYWdlcyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJNYXhQYWdlU2l6ZSIsIm1vZGVsIiwiQW5ub3VuY2VtZW50IiwiaW5pdENsYXNzIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7QUFNQSxJQUFNQSxPQUFPQyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU1DLFFBQVFELFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBTUUsZ0JBQWdCRixRQUFRLGtCQUFSLENBQXRCOztJQUVNRyxrQjs7Ozs7Ozs7Ozs7a0NBQ1VDLE8sRUFBUztBQUNyQixhQUFPSCxNQUFNSSxTQUFOLENBQWdCQyxhQUFoQixDQUE4QkMsS0FBOUIsQ0FBb0MsSUFBcEMsRUFBMEMsQ0FBQ0gsT0FBRCxDQUExQyxDQUFQO0FBQ0Q7OzsrQkFFVUksUSxFQUFVO0FBQUE7O0FBQ25CO0FBQ0EsV0FBS0MsTUFBTCxDQUFZQyxTQUFaLENBQXNCQyxpQkFBdEIsQ0FBd0MsS0FBS0MsYUFBN0MsRUFBNERKLFFBQTVELEVBQXNFLFVBQUNLLFFBQUQsRUFBYztBQUNsRixZQUFJQSxTQUFTQyxNQUFiLEVBQXFCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsUUFBUixFQUFwQixFQUF3QyxJQUF4QztBQUN0QixPQUZEOztBQUlBLFVBQU1JLGFBQWEsNkJBQTJCVCxRQUEzQixJQUNoQixLQUFLVSxpQkFBTCxHQUF5QixjQUFjLEtBQUtBLGlCQUE1QyxHQUFnRSxFQURoRCxDQUFuQjs7QUFHQTtBQUNBLFVBQUlELGVBQWUsS0FBS0UsY0FBeEIsRUFBd0M7QUFDdEMsYUFBS0MsUUFBTCxHQUFnQixJQUFoQjtBQUNBLGFBQUtELGNBQUwsR0FBc0JGLFVBQXRCO0FBQ0EsYUFBS1IsTUFBTCxDQUFZWSxHQUFaLENBQWdCO0FBQ2RDLGVBQUtMLFVBRFM7QUFFZE0sa0JBQVEsS0FGTTtBQUdkQyxnQkFBTTtBQUhRLFNBQWhCLEVBSUc7QUFBQSxpQkFBVyxPQUFLQyxrQkFBTCxDQUF3QkMsT0FBeEIsRUFBaUNULFVBQWpDLEVBQTZDVCxRQUE3QyxDQUFYO0FBQUEsU0FKSDtBQUtEO0FBQ0Y7Ozs7RUF4QjhCTixhOztBQTJCakNDLG1CQUFtQndCLGdCQUFuQixHQUFzQyxHQUNwQ0MsTUFEb0MsQ0FDN0IxQixjQUFjeUIsZ0JBRGUsQ0FBdEM7O0FBSUF4QixtQkFBbUIwQixXQUFuQixHQUFpQyxHQUFqQzs7QUFFQTFCLG1CQUFtQkUsU0FBbkIsQ0FBNkJ5QixLQUE3QixHQUFxQzdCLE1BQU04QixZQUEzQzs7QUFFQWhDLEtBQUtpQyxTQUFMLENBQWV6QixLQUFmLENBQXFCSixrQkFBckIsRUFBeUMsQ0FBQ0Esa0JBQUQsRUFBcUIsb0JBQXJCLENBQXpDOztBQUVBOEIsT0FBT0MsT0FBUCxHQUFpQi9CLGtCQUFqQiIsImZpbGUiOiJhbm5vdW5jZW1lbnRzLXF1ZXJ5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBRdWVyeSBjbGFzcyBmb3IgcnVubmluZyBhIFF1ZXJ5IG9uIEFubm91bmNlbWVudHNcbiAqXG4gKiBAY2xhc3MgIGxheWVyLkFubm91bmNlbWVudHNRdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUXVlcnlcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuY29uc3QgTWVzc2FnZXNRdWVyeSA9IHJlcXVpcmUoJy4vbWVzc2FnZXMtcXVlcnknKTtcblxuY2xhc3MgQW5ub3VuY2VtZW50c1F1ZXJ5IGV4dGVuZHMgTWVzc2FnZXNRdWVyeSB7XG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIHJldHVybiBRdWVyeS5wcm90b3R5cGUuX2ZpeFByZWRpY2F0ZS5hcHBseSh0aGlzLCBbaW5WYWx1ZV0pO1xuICB9XG5cbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIC8vIFJldHJpZXZlIGRhdGEgZnJvbSBkYiBjYWNoZSBpbiBwYXJhbGxlbCB3aXRoIGxvYWRpbmcgZGF0YSBmcm9tIHNlcnZlclxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQW5ub3VuY2VtZW50cyh0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgYW5ub3VuY2VtZW50cz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxufVxuXG5Bbm5vdW5jZW1lbnRzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbl0uY29uY2F0KE1lc3NhZ2VzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuQW5ub3VuY2VtZW50c1F1ZXJ5Lk1heFBhZ2VTaXplID0gMTAwO1xuXG5Bbm5vdW5jZW1lbnRzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuQW5ub3VuY2VtZW50O1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShBbm5vdW5jZW1lbnRzUXVlcnksIFtBbm5vdW5jZW1lbnRzUXVlcnksICdBbm5vdW5jZW1lbnRzUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQW5ub3VuY2VtZW50c1F1ZXJ5O1xuIl19
