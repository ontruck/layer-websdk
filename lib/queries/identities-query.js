'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Identities
 *
 * @class  layer.IdentitiesQuery
 * @extends layer.Query
 */
var Root = require('../root');
var Query = require('./query');

var IdentitiesQuery = function (_Query) {
  _inherits(IdentitiesQuery, _Query);

  function IdentitiesQuery() {
    _classCallCheck(this, IdentitiesQuery);

    return _possibleConstructorReturn(this, (IdentitiesQuery.__proto__ || Object.getPrototypeOf(IdentitiesQuery)).apply(this, arguments));
  }

  _createClass(IdentitiesQuery, [{
    key: '_fetchData',
    value: function _fetchData(pageSize) {
      var _this2 = this;

      // There is not yet support for paging Identities;  as all identities are loaded,
      // if there is a _nextDBFromId, we no longer need to get any more from the database
      if (!this._nextDBFromId) {
        this.client.dbManager.loadIdentities(function (identities) {
          if (identities.length) _this2._appendResults({ data: identities }, true);
        });
      }

      var newRequest = 'identities?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

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
  }, {
    key: '_appendResultsSplice',
    value: function _appendResultsSplice(item) {
      this.data.push(this._getData(item));
    }
  }, {
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {
      switch (eventName) {

        // If a Identity has changed and its in our result set, replace
        // it with a new immutable object
        case 'identities:change':
          this._handleChangeEvent('identities', evt);
          break;

        // If Identities are added, and they aren't already in our result set
        // add them.
        case 'identities:add':
          this._handleAddEvent('identities', evt);
          break;

        // If a Identity is deleted and its in our result set, remove it
        // and trigger an event
        case 'identities:remove':
          this._handleRemoveEvent('identities', evt);
          break;
      }
    }
  }]);

  return IdentitiesQuery;
}(Query);

IdentitiesQuery._supportedEvents = [].concat(Query._supportedEvents);

IdentitiesQuery.MaxPageSize = 500;

IdentitiesQuery.prototype.model = Query.Identity;

Root.initClass.apply(IdentitiesQuery, [IdentitiesQuery, 'IdentitiesQuery']);

module.exports = IdentitiesQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2lkZW50aXRpZXMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJRdWVyeSIsIklkZW50aXRpZXNRdWVyeSIsInBhZ2VTaXplIiwiX25leHREQkZyb21JZCIsImNsaWVudCIsImRiTWFuYWdlciIsImxvYWRJZGVudGl0aWVzIiwiaWRlbnRpdGllcyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsIml0ZW0iLCJwdXNoIiwiX2dldERhdGEiLCJldmVudE5hbWUiLCJldnQiLCJfaGFuZGxlQ2hhbmdlRXZlbnQiLCJfaGFuZGxlQWRkRXZlbnQiLCJfaGFuZGxlUmVtb3ZlRXZlbnQiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiTWF4UGFnZVNpemUiLCJwcm90b3R5cGUiLCJtb2RlbCIsIklkZW50aXR5IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7Ozs7OztBQU1BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsUUFBUUQsUUFBUSxTQUFSLENBQWQ7O0lBRU1FLGU7Ozs7Ozs7Ozs7OytCQUNPQyxRLEVBQVU7QUFBQTs7QUFDbkI7QUFDQTtBQUNBLFVBQUksQ0FBQyxLQUFLQyxhQUFWLEVBQXlCO0FBQ3ZCLGFBQUtDLE1BQUwsQ0FBWUMsU0FBWixDQUFzQkMsY0FBdEIsQ0FBcUMsVUFBQ0MsVUFBRCxFQUFnQjtBQUNuRCxjQUFJQSxXQUFXQyxNQUFmLEVBQXVCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsVUFBUixFQUFwQixFQUEwQyxJQUExQztBQUN4QixTQUZEO0FBR0Q7O0FBRUQsVUFBTUksYUFBYSwwQkFBd0JULFFBQXhCLElBQ2hCLEtBQUtVLGlCQUFMLEdBQXlCLGNBQWMsS0FBS0EsaUJBQTVDLEdBQWdFLEVBRGhELENBQW5COztBQUdBO0FBQ0EsVUFBSUQsZUFBZSxLQUFLRSxjQUF4QixFQUF3QztBQUN0QyxhQUFLQyxRQUFMLEdBQWdCLElBQWhCO0FBQ0EsYUFBS0QsY0FBTCxHQUFzQkYsVUFBdEI7QUFDQSxhQUFLUCxNQUFMLENBQVlXLEdBQVosQ0FBZ0I7QUFDZEMsZUFBS0wsVUFEUztBQUVkTSxrQkFBUSxLQUZNO0FBR2RDLGdCQUFNO0FBSFEsU0FBaEIsRUFJRztBQUFBLGlCQUFXLE9BQUtDLGtCQUFMLENBQXdCQyxPQUF4QixFQUFpQ1QsVUFBakMsRUFBNkNULFFBQTdDLENBQVg7QUFBQSxTQUpIO0FBS0Q7QUFDRjs7O3lDQUVvQm1CLEksRUFBTTtBQUN6QixXQUFLWCxJQUFMLENBQVVZLElBQVYsQ0FBZSxLQUFLQyxRQUFMLENBQWNGLElBQWQsQ0FBZjtBQUNEOzs7a0NBR2FHLFMsRUFBV0MsRyxFQUFLO0FBQzVCLGNBQVFELFNBQVI7O0FBRUU7QUFDQTtBQUNBLGFBQUssbUJBQUw7QUFDRSxlQUFLRSxrQkFBTCxDQUF3QixZQUF4QixFQUFzQ0QsR0FBdEM7QUFDQTs7QUFFRjtBQUNBO0FBQ0EsYUFBSyxnQkFBTDtBQUNFLGVBQUtFLGVBQUwsQ0FBcUIsWUFBckIsRUFBbUNGLEdBQW5DO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssbUJBQUw7QUFDRSxlQUFLRyxrQkFBTCxDQUF3QixZQUF4QixFQUFzQ0gsR0FBdEM7QUFDQTtBQWxCSjtBQW9CRDs7OztFQW5EMkJ6QixLOztBQXNEOUJDLGdCQUFnQjRCLGdCQUFoQixHQUFtQyxHQUVqQ0MsTUFGaUMsQ0FFMUI5QixNQUFNNkIsZ0JBRm9CLENBQW5DOztBQUtBNUIsZ0JBQWdCOEIsV0FBaEIsR0FBOEIsR0FBOUI7O0FBRUE5QixnQkFBZ0IrQixTQUFoQixDQUEwQkMsS0FBMUIsR0FBa0NqQyxNQUFNa0MsUUFBeEM7O0FBRUFwQyxLQUFLcUMsU0FBTCxDQUFlQyxLQUFmLENBQXFCbkMsZUFBckIsRUFBc0MsQ0FBQ0EsZUFBRCxFQUFrQixpQkFBbEIsQ0FBdEM7O0FBRUFvQyxPQUFPQyxPQUFQLEdBQWlCckMsZUFBakIiLCJmaWxlIjoiaWRlbnRpdGllcy1xdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUXVlcnkgY2xhc3MgZm9yIHJ1bm5pbmcgYSBRdWVyeSBvbiBJZGVudGl0aWVzXG4gKlxuICogQGNsYXNzICBsYXllci5JZGVudGl0aWVzUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5XG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcblxuY2xhc3MgSWRlbnRpdGllc1F1ZXJ5IGV4dGVuZHMgUXVlcnkge1xuICBfZmV0Y2hEYXRhKHBhZ2VTaXplKSB7XG4gICAgLy8gVGhlcmUgaXMgbm90IHlldCBzdXBwb3J0IGZvciBwYWdpbmcgSWRlbnRpdGllczsgIGFzIGFsbCBpZGVudGl0aWVzIGFyZSBsb2FkZWQsXG4gICAgLy8gaWYgdGhlcmUgaXMgYSBfbmV4dERCRnJvbUlkLCB3ZSBubyBsb25nZXIgbmVlZCB0byBnZXQgYW55IG1vcmUgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICBpZiAoIXRoaXMuX25leHREQkZyb21JZCkge1xuICAgICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRJZGVudGl0aWVzKChpZGVudGl0aWVzKSA9PiB7XG4gICAgICAgIGlmIChpZGVudGl0aWVzLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IGlkZW50aXRpZXMgfSwgdHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGlkZW50aXRpZXM/cGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIC8vIERvbid0IHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgIGlmIChuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgdGhpcy5kYXRhLnB1c2godGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuXG4gIF9oYW5kbGVFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGhhcyBjaGFuZ2VkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlcGxhY2VcbiAgICAgIC8vIGl0IHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgY2FzZSAnaWRlbnRpdGllczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDaGFuZ2VFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBJZGVudGl0aWVzIGFyZSBhZGRlZCwgYW5kIHRoZXkgYXJlbid0IGFscmVhZHkgaW4gb3VyIHJlc3VsdCBzZXRcbiAgICAgIC8vIGFkZCB0aGVtLlxuICAgICAgY2FzZSAnaWRlbnRpdGllczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnaWRlbnRpdGllczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVSZW1vdmVFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5JZGVudGl0aWVzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuSWRlbnRpdGllc1F1ZXJ5Lk1heFBhZ2VTaXplID0gNTAwO1xuXG5JZGVudGl0aWVzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuSWRlbnRpdHk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KElkZW50aXRpZXNRdWVyeSwgW0lkZW50aXRpZXNRdWVyeSwgJ0lkZW50aXRpZXNRdWVyeSddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBJZGVudGl0aWVzUXVlcnk7XG4iXX0=
