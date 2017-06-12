'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Query class for running a Query on Identities
 *
 *      var identityQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Identity
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
          telemetry: {
            name: 'identity_query_time'
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL2lkZW50aXRpZXMtcXVlcnkuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJRdWVyeSIsIklkZW50aXRpZXNRdWVyeSIsInBhZ2VTaXplIiwiX25leHREQkZyb21JZCIsImNsaWVudCIsImRiTWFuYWdlciIsImxvYWRJZGVudGl0aWVzIiwiaWRlbnRpdGllcyIsImxlbmd0aCIsIl9hcHBlbmRSZXN1bHRzIiwiZGF0YSIsIm5ld1JlcXVlc3QiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9maXJpbmdSZXF1ZXN0IiwiaXNGaXJpbmciLCJ4aHIiLCJ0ZWxlbWV0cnkiLCJuYW1lIiwidXJsIiwibWV0aG9kIiwic3luYyIsIl9wcm9jZXNzUnVuUmVzdWx0cyIsInJlc3VsdHMiLCJpdGVtIiwicHVzaCIsIl9nZXREYXRhIiwiZXZlbnROYW1lIiwiZXZ0IiwiX2hhbmRsZUNoYW5nZUV2ZW50IiwiX2hhbmRsZUFkZEV2ZW50IiwiX2hhbmRsZVJlbW92ZUV2ZW50IiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsIk1heFBhZ2VTaXplIiwicHJvdG90eXBlIiwibW9kZWwiLCJJZGVudGl0eSIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0JBLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsUUFBUUQsUUFBUSxTQUFSLENBQWQ7O0lBRU1FLGU7Ozs7Ozs7Ozs7OytCQUNPQyxRLEVBQVU7QUFBQTs7QUFDbkI7QUFDQTtBQUNBLFVBQUksQ0FBQyxLQUFLQyxhQUFWLEVBQXlCO0FBQ3ZCLGFBQUtDLE1BQUwsQ0FBWUMsU0FBWixDQUFzQkMsY0FBdEIsQ0FBcUMsVUFBQ0MsVUFBRCxFQUFnQjtBQUNuRCxjQUFJQSxXQUFXQyxNQUFmLEVBQXVCLE9BQUtDLGNBQUwsQ0FBb0IsRUFBRUMsTUFBTUgsVUFBUixFQUFwQixFQUEwQyxJQUExQztBQUN4QixTQUZEO0FBR0Q7O0FBRUQsVUFBTUksYUFBYSwwQkFBd0JULFFBQXhCLElBQ2hCLEtBQUtVLGlCQUFMLEdBQXlCLGNBQWMsS0FBS0EsaUJBQTVDLEdBQWdFLEVBRGhELENBQW5COztBQUdBO0FBQ0EsVUFBSUQsZUFBZSxLQUFLRSxjQUF4QixFQUF3QztBQUN0QyxhQUFLQyxRQUFMLEdBQWdCLElBQWhCO0FBQ0EsYUFBS0QsY0FBTCxHQUFzQkYsVUFBdEI7QUFDQSxhQUFLUCxNQUFMLENBQVlXLEdBQVosQ0FBZ0I7QUFDZEMscUJBQVc7QUFDVEMsa0JBQU07QUFERyxXQURHO0FBSWRDLGVBQUtQLFVBSlM7QUFLZFEsa0JBQVEsS0FMTTtBQU1kQyxnQkFBTTtBQU5RLFNBQWhCLEVBT0c7QUFBQSxpQkFBVyxPQUFLQyxrQkFBTCxDQUF3QkMsT0FBeEIsRUFBaUNYLFVBQWpDLEVBQTZDVCxRQUE3QyxDQUFYO0FBQUEsU0FQSDtBQVFEO0FBQ0Y7Ozt5Q0FFb0JxQixJLEVBQU07QUFDekIsV0FBS2IsSUFBTCxDQUFVYyxJQUFWLENBQWUsS0FBS0MsUUFBTCxDQUFjRixJQUFkLENBQWY7QUFDRDs7O2tDQUdhRyxTLEVBQVdDLEcsRUFBSztBQUM1QixjQUFRRCxTQUFSOztBQUVFO0FBQ0E7QUFDQSxhQUFLLG1CQUFMO0FBQ0UsZUFBS0Usa0JBQUwsQ0FBd0IsWUFBeEIsRUFBc0NELEdBQXRDO0FBQ0E7O0FBRUY7QUFDQTtBQUNBLGFBQUssZ0JBQUw7QUFDRSxlQUFLRSxlQUFMLENBQXFCLFlBQXJCLEVBQW1DRixHQUFuQztBQUNBOztBQUVGO0FBQ0E7QUFDQSxhQUFLLG1CQUFMO0FBQ0UsZUFBS0csa0JBQUwsQ0FBd0IsWUFBeEIsRUFBc0NILEdBQXRDO0FBQ0E7QUFsQko7QUFvQkQ7Ozs7RUF0RDJCM0IsSzs7QUF5RDlCQyxnQkFBZ0I4QixnQkFBaEIsR0FBbUMsR0FFakNDLE1BRmlDLENBRTFCaEMsTUFBTStCLGdCQUZvQixDQUFuQzs7QUFLQTlCLGdCQUFnQmdDLFdBQWhCLEdBQThCLEdBQTlCOztBQUVBaEMsZ0JBQWdCaUMsU0FBaEIsQ0FBMEJDLEtBQTFCLEdBQWtDbkMsTUFBTW9DLFFBQXhDOztBQUVBdEMsS0FBS3VDLFNBQUwsQ0FBZUMsS0FBZixDQUFxQnJDLGVBQXJCLEVBQXNDLENBQUNBLGVBQUQsRUFBa0IsaUJBQWxCLENBQXRDOztBQUVBc0MsT0FBT0MsT0FBUCxHQUFpQnZDLGVBQWpCIiwiZmlsZSI6ImlkZW50aXRpZXMtcXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFF1ZXJ5IGNsYXNzIGZvciBydW5uaW5nIGEgUXVlcnkgb24gSWRlbnRpdGllc1xuICpcbiAqICAgICAgdmFyIGlkZW50aXR5UXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5JZGVudGl0eVxuICogICAgICB9KTtcbiAqXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGBwYWdpbmF0aW9uV2luZG93YCBwcm9wZXJ0eSBhdCBhbnkgdGltZSB1c2luZzpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gKiAgICAgIH0pO1xuICpcbiAqIFlvdSBjYW4gcmVsZWFzZSBkYXRhIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqIEBjbGFzcyAgbGF5ZXIuSWRlbnRpdGllc1F1ZXJ5XG4gKiBAZXh0ZW5kcyBsYXllci5RdWVyeVxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5cbmNsYXNzIElkZW50aXRpZXNRdWVyeSBleHRlbmRzIFF1ZXJ5IHtcbiAgX2ZldGNoRGF0YShwYWdlU2l6ZSkge1xuICAgIC8vIFRoZXJlIGlzIG5vdCB5ZXQgc3VwcG9ydCBmb3IgcGFnaW5nIElkZW50aXRpZXM7ICBhcyBhbGwgaWRlbnRpdGllcyBhcmUgbG9hZGVkLFxuICAgIC8vIGlmIHRoZXJlIGlzIGEgX25leHREQkZyb21JZCwgd2Ugbm8gbG9uZ2VyIG5lZWQgdG8gZ2V0IGFueSBtb3JlIGZyb20gdGhlIGRhdGFiYXNlXG4gICAgaWYgKCF0aGlzLl9uZXh0REJGcm9tSWQpIHtcbiAgICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkSWRlbnRpdGllcygoaWRlbnRpdGllcykgPT4ge1xuICAgICAgICBpZiAoaWRlbnRpdGllcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBpZGVudGl0aWVzIH0sIHRydWUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV3UmVxdWVzdCA9IGBpZGVudGl0aWVzP3BhZ2Vfc2l6ZT0ke3BhZ2VTaXplfWAgK1xuICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICAvLyBEb24ndCByZXBlYXQgc3RpbGwgZmlyaW5nIHF1ZXJpZXNcbiAgICBpZiAobmV3UmVxdWVzdCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCkge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHRlbGVtZXRyeToge1xuICAgICAgICAgIG5hbWU6ICdpZGVudGl0eV9xdWVyeV90aW1lJyxcbiAgICAgICAgfSxcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgdGhpcy5kYXRhLnB1c2godGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gIH1cblxuXG4gIF9oYW5kbGVFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGhhcyBjaGFuZ2VkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlcGxhY2VcbiAgICAgIC8vIGl0IHdpdGggYSBuZXcgaW1tdXRhYmxlIG9iamVjdFxuICAgICAgY2FzZSAnaWRlbnRpdGllczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDaGFuZ2VFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBJZGVudGl0aWVzIGFyZSBhZGRlZCwgYW5kIHRoZXkgYXJlbid0IGFscmVhZHkgaW4gb3VyIHJlc3VsdCBzZXRcbiAgICAgIC8vIGFkZCB0aGVtLlxuICAgICAgY2FzZSAnaWRlbnRpdGllczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVBZGRFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIElkZW50aXR5IGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnaWRlbnRpdGllczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVSZW1vdmVFdmVudCgnaWRlbnRpdGllcycsIGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5JZGVudGl0aWVzUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXS5jb25jYXQoUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblxuSWRlbnRpdGllc1F1ZXJ5Lk1heFBhZ2VTaXplID0gNTAwO1xuXG5JZGVudGl0aWVzUXVlcnkucHJvdG90eXBlLm1vZGVsID0gUXVlcnkuSWRlbnRpdHk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KElkZW50aXRpZXNRdWVyeSwgW0lkZW50aXRpZXNRdWVyeSwgJ0lkZW50aXRpZXNRdWVyeSddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBJZGVudGl0aWVzUXVlcnk7XG4iXX0=
