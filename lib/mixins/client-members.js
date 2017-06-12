'use strict';

/* Feature is tested but not available on server
 * Adds Channel Membership handling to the layer.Client.
 *
 * @class layer.mixins.ClientMembership
 */

var Syncable = require('../models/syncable');
var Membership = require('../models/membership');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [
  /**
   * A call to layer.Membership.load has completed successfully
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Membership} evt.target
   */
  'members:loaded',

  /**
   * An Identity has had a change in its properties.
   *
   * Changes occur when new data arrives from the server.
   *
   *      client.on('members:change', function(evt) {
   *          var displayNameChanges = evt.getChangesFor('displayName');
   *          if (displayNameChanges.length) {
   *              myView.renderStatus(evt.target);
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Membership} evt.target
   * @param {Object[]} evt.changes
   * @param {Mixed} evt.changes.newValue
   * @param {Mixed} evt.changes.oldValue
   * @param {string} evt.changes.property - Name of the property that has changed
   */
  'members:change',

  /**
   * A new Member has been added to the Client.
   *
   * This event is triggered whenever a new layer.Membership (Full identity or not)
   * has been received by the Client.
   *
          client.on('members:add', function(evt) {
              evt.membership.forEach(function(identity) {
                  myView.addIdentity(identity);
              });
          });
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Membership[]} evt.membership
  */
  'members:add',

  /**
   * A Member has been removed from the Client.
   *
   * This does not typically occur.
   *
          client.on('members:remove', function(evt) {
              evt.membership.forEach(function(identity) {
                  myView.addIdentity(identity);
              });
          });
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Membership[]} evt.membership
  */
  'members:remove'],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.members = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.members).forEach(function (id) {
        var member = _this._models.members[id];
        if (member && !member.isDestroyed) {
          member.destroy();
        }
      });
      this._models.members = null;
    },
    reset: function reset() {
      this._models.members = {};
    }
  },
  methods: {
    /**
     * Retrieve the membership info by ID.
     *
     * Not for use in typical apps.
     *
     * @method getMember
     * @param  {string} id               - layer:///channels/uuid/members/user_id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a member from the server if not found
     * @return {layer.Membership}
     */
    getMember: function getMember(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      if (this._models.members[id]) {
        return this._models.members[id];
      } else if (canLoad) {
        return Syncable.load(id, this);
      }
      return null;
    },


    /**
     * Report that a new Membership has been added.
     *
     * @method _addMembership
     * @protected
     * @param  {layer.Membership} member
     *
     */
    _addMembership: function _addMembership(member) {
      if (!this._models.members[member.id]) {
        this._models.members[member.id] = member;
        this._triggerAsync('members:add', { members: [member] });
        this._scheduleCheckAndPurgeCache(member);
      }
    },


    /**
     * Report that a member has been removed from the client.
     *
     * @method _removeMembership
     * @protected
     * @param  {layer.Membership} member
     */
    _removeMembership: function _removeMembership(member) {
      var id = typeof member === 'string' ? member : member.id;
      member = this._models.members[id];
      if (member) {
        delete this._models.members[id];
        if (!this._inCleanup) {
          member.off(null, null, this);
          this._triggerAsync('members:remove', { members: [member] });
        }
      }
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LW1lbWJlcnMuanMiXSwibmFtZXMiOlsiU3luY2FibGUiLCJyZXF1aXJlIiwiTWVtYmVyc2hpcCIsIkVycm9yRGljdGlvbmFyeSIsImRpY3Rpb25hcnkiLCJtb2R1bGUiLCJleHBvcnRzIiwiZXZlbnRzIiwibGlmZWN5Y2xlIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX21vZGVscyIsIm1lbWJlcnMiLCJjbGVhbnVwIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJpZCIsIm1lbWJlciIsImlzRGVzdHJveWVkIiwiZGVzdHJveSIsInJlc2V0IiwibWV0aG9kcyIsImdldE1lbWJlciIsImNhbkxvYWQiLCJFcnJvciIsImlkUGFyYW1SZXF1aXJlZCIsImxvYWQiLCJfYWRkTWVtYmVyc2hpcCIsIl90cmlnZ2VyQXN5bmMiLCJfc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUiLCJfcmVtb3ZlTWVtYmVyc2hpcCIsIl9pbkNsZWFudXAiLCJvZmYiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztBQU1BLElBQU1BLFdBQVdDLFFBQVEsb0JBQVIsQ0FBakI7QUFDQSxJQUFNQyxhQUFhRCxRQUFRLHNCQUFSLENBQW5CO0FBQ0EsSUFBTUUsa0JBQWtCRixRQUFRLGdCQUFSLEVBQTBCRyxVQUFsRDs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxVQUFRO0FBQ047Ozs7Ozs7QUFPQSxrQkFSTTs7QUFVTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsa0JBOUJNOztBQWdDTjs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxlQWhETTs7QUFrRE47Ozs7Ozs7Ozs7Ozs7OztBQWVBLGtCQWpFTSxDQURPO0FBb0VmQyxhQUFXO0FBQ1RDLGVBRFMsdUJBQ0dDLE9BREgsRUFDWTtBQUNuQixXQUFLQyxPQUFMLENBQWFDLE9BQWIsR0FBdUIsRUFBdkI7QUFDRCxLQUhRO0FBSVRDLFdBSlMscUJBSUM7QUFBQTs7QUFDUkMsYUFBT0MsSUFBUCxDQUFZLEtBQUtKLE9BQUwsQ0FBYUMsT0FBekIsRUFBa0NJLE9BQWxDLENBQTBDLFVBQUNDLEVBQUQsRUFBUTtBQUNoRCxZQUFNQyxTQUFTLE1BQUtQLE9BQUwsQ0FBYUMsT0FBYixDQUFxQkssRUFBckIsQ0FBZjtBQUNBLFlBQUlDLFVBQVUsQ0FBQ0EsT0FBT0MsV0FBdEIsRUFBbUM7QUFDakNELGlCQUFPRSxPQUFQO0FBQ0Q7QUFDRixPQUxEO0FBTUEsV0FBS1QsT0FBTCxDQUFhQyxPQUFiLEdBQXVCLElBQXZCO0FBQ0QsS0FaUTtBQWFUUyxTQWJTLG1CQWFEO0FBQ04sV0FBS1YsT0FBTCxDQUFhQyxPQUFiLEdBQXVCLEVBQXZCO0FBQ0Q7QUFmUSxHQXBFSTtBQXFGZlUsV0FBUztBQUNQOzs7Ozs7Ozs7O0FBVUFDLGFBWE8scUJBV0dOLEVBWEgsRUFXT08sT0FYUCxFQVdnQjtBQUNyQixVQUFJLE9BQU9QLEVBQVAsS0FBYyxRQUFsQixFQUE0QixNQUFNLElBQUlRLEtBQUosQ0FBVXRCLGdCQUFnQnVCLGVBQTFCLENBQU47O0FBRTVCLFVBQUksS0FBS2YsT0FBTCxDQUFhQyxPQUFiLENBQXFCSyxFQUFyQixDQUFKLEVBQThCO0FBQzVCLGVBQU8sS0FBS04sT0FBTCxDQUFhQyxPQUFiLENBQXFCSyxFQUFyQixDQUFQO0FBQ0QsT0FGRCxNQUVPLElBQUlPLE9BQUosRUFBYTtBQUNsQixlQUFPeEIsU0FBUzJCLElBQVQsQ0FBY1YsRUFBZCxFQUFrQixJQUFsQixDQUFQO0FBQ0Q7QUFDRCxhQUFPLElBQVA7QUFDRCxLQXBCTTs7O0FBc0JQOzs7Ozs7OztBQVFBVyxrQkE5Qk8sMEJBOEJRVixNQTlCUixFQThCZ0I7QUFDckIsVUFBSSxDQUFDLEtBQUtQLE9BQUwsQ0FBYUMsT0FBYixDQUFxQk0sT0FBT0QsRUFBNUIsQ0FBTCxFQUFzQztBQUNwQyxhQUFLTixPQUFMLENBQWFDLE9BQWIsQ0FBcUJNLE9BQU9ELEVBQTVCLElBQWtDQyxNQUFsQztBQUNBLGFBQUtXLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0MsRUFBRWpCLFNBQVMsQ0FBQ00sTUFBRCxDQUFYLEVBQWxDO0FBQ0EsYUFBS1ksMkJBQUwsQ0FBaUNaLE1BQWpDO0FBQ0Q7QUFDRixLQXBDTTs7O0FBc0NQOzs7Ozs7O0FBT0FhLHFCQTdDTyw2QkE2Q1diLE1BN0NYLEVBNkNtQjtBQUN4QixVQUFNRCxLQUFNLE9BQU9DLE1BQVAsS0FBa0IsUUFBbkIsR0FBK0JBLE1BQS9CLEdBQXdDQSxPQUFPRCxFQUExRDtBQUNBQyxlQUFTLEtBQUtQLE9BQUwsQ0FBYUMsT0FBYixDQUFxQkssRUFBckIsQ0FBVDtBQUNBLFVBQUlDLE1BQUosRUFBWTtBQUNWLGVBQU8sS0FBS1AsT0FBTCxDQUFhQyxPQUFiLENBQXFCSyxFQUFyQixDQUFQO0FBQ0EsWUFBSSxDQUFDLEtBQUtlLFVBQVYsRUFBc0I7QUFDcEJkLGlCQUFPZSxHQUFQLENBQVcsSUFBWCxFQUFpQixJQUFqQixFQUF1QixJQUF2QjtBQUNBLGVBQUtKLGFBQUwsQ0FBbUIsZ0JBQW5CLEVBQXFDLEVBQUVqQixTQUFTLENBQUNNLE1BQUQsQ0FBWCxFQUFyQztBQUNEO0FBQ0Y7QUFDRjtBQXZETTtBQXJGTSxDQUFqQiIsImZpbGUiOiJjbGllbnQtbWVtYmVycy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIEZlYXR1cmUgaXMgdGVzdGVkIGJ1dCBub3QgYXZhaWxhYmxlIG9uIHNlcnZlclxuICogQWRkcyBDaGFubmVsIE1lbWJlcnNoaXAgaGFuZGxpbmcgdG8gdGhlIGxheWVyLkNsaWVudC5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIubWl4aW5zLkNsaWVudE1lbWJlcnNoaXBcbiAqL1xuXG5jb25zdCBTeW5jYWJsZSA9IHJlcXVpcmUoJy4uL21vZGVscy9zeW5jYWJsZScpO1xuY29uc3QgTWVtYmVyc2hpcCA9IHJlcXVpcmUoJy4uL21vZGVscy9tZW1iZXJzaGlwJyk7XG5jb25zdCBFcnJvckRpY3Rpb25hcnkgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpLmRpY3Rpb25hcnk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBldmVudHM6IFtcbiAgICAvKipcbiAgICAgKiBBIGNhbGwgdG8gbGF5ZXIuTWVtYmVyc2hpcC5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTWVtYmVyc2hpcH0gZXZ0LnRhcmdldFxuICAgICAqL1xuICAgICdtZW1iZXJzOmxvYWRlZCcsXG5cbiAgICAvKipcbiAgICAgKiBBbiBJZGVudGl0eSBoYXMgaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgICAqXG4gICAgICogQ2hhbmdlcyBvY2N1ciB3aGVuIG5ldyBkYXRhIGFycml2ZXMgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqXG4gICAgICogICAgICBjbGllbnQub24oJ21lbWJlcnM6Y2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICogICAgICAgICAgdmFyIGRpc3BsYXlOYW1lQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdkaXNwbGF5TmFtZScpO1xuICAgICAqICAgICAgICAgIGlmIChkaXNwbGF5TmFtZUNoYW5nZXMubGVuZ3RoKSB7XG4gICAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJTdGF0dXMoZXZ0LnRhcmdldCk7XG4gICAgICogICAgICAgICAgfVxuICAgICAqICAgICAgfSk7XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTWVtYmVyc2hpcH0gZXZ0LnRhcmdldFxuICAgICAqIEBwYXJhbSB7T2JqZWN0W119IGV2dC5jaGFuZ2VzXG4gICAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5vbGRWYWx1ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgaGFzIGNoYW5nZWRcbiAgICAgKi9cbiAgICAnbWVtYmVyczpjaGFuZ2UnLFxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgTWVtYmVyIGhhcyBiZWVuIGFkZGVkIHRvIHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGlzIGV2ZW50IGlzIHRyaWdnZXJlZCB3aGVuZXZlciBhIG5ldyBsYXllci5NZW1iZXJzaGlwIChGdWxsIGlkZW50aXR5IG9yIG5vdClcbiAgICAgKiBoYXMgYmVlbiByZWNlaXZlZCBieSB0aGUgQ2xpZW50LlxuICAgICAqXG4gICAgICAgICAgICBjbGllbnQub24oJ21lbWJlcnM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgICAgZXZ0Lm1lbWJlcnNoaXAuZm9yRWFjaChmdW5jdGlvbihpZGVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICBteVZpZXcuYWRkSWRlbnRpdHkoaWRlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgKlxuICAgICogQGV2ZW50XG4gICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICogQHBhcmFtIHtsYXllci5NZW1iZXJzaGlwW119IGV2dC5tZW1iZXJzaGlwXG4gICAgKi9cbiAgICAnbWVtYmVyczphZGQnLFxuXG4gICAgLyoqXG4gICAgICogQSBNZW1iZXIgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGlzIGRvZXMgbm90IHR5cGljYWxseSBvY2N1ci5cbiAgICAgKlxuICAgICAgICAgICAgY2xpZW50Lm9uKCdtZW1iZXJzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICAgIGV2dC5tZW1iZXJzaGlwLmZvckVhY2goZnVuY3Rpb24oaWRlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgbXlWaWV3LmFkZElkZW50aXR5KGlkZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICpcbiAgICAqIEBldmVudFxuICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuTWVtYmVyc2hpcFtdfSBldnQubWVtYmVyc2hpcFxuICAgICovXG4gICAgJ21lbWJlcnM6cmVtb3ZlJyxcbiAgXSxcbiAgbGlmZWN5Y2xlOiB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgdGhpcy5fbW9kZWxzLm1lbWJlcnMgPSB7fTtcbiAgICB9LFxuICAgIGNsZWFudXAoKSB7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMubWVtYmVycykuZm9yRWFjaCgoaWQpID0+IHtcbiAgICAgICAgY29uc3QgbWVtYmVyID0gdGhpcy5fbW9kZWxzLm1lbWJlcnNbaWRdO1xuICAgICAgICBpZiAobWVtYmVyICYmICFtZW1iZXIuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICBtZW1iZXIuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX21vZGVscy5tZW1iZXJzID0gbnVsbDtcbiAgICB9LFxuICAgIHJlc2V0KCkge1xuICAgICAgdGhpcy5fbW9kZWxzLm1lbWJlcnMgPSB7fTtcbiAgICB9LFxuICB9LFxuICBtZXRob2RzOiB7XG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgdGhlIG1lbWJlcnNoaXAgaW5mbyBieSBJRC5cbiAgICAgKlxuICAgICAqIE5vdCBmb3IgdXNlIGluIHR5cGljYWwgYXBwcy5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgZ2V0TWVtYmVyXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAgICAgICAgICAgICAgIC0gbGF5ZXI6Ly8vY2hhbm5lbHMvdXVpZC9tZW1iZXJzL3VzZXJfaWRcbiAgICAgKiBAcGFyYW0gIHtib29sZWFufSBbY2FuTG9hZD1mYWxzZV0gLSBQYXNzIHRydWUgdG8gYWxsb3cgbG9hZGluZyBhIG1lbWJlciBmcm9tIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAgICogQHJldHVybiB7bGF5ZXIuTWVtYmVyc2hpcH1cbiAgICAgKi9cbiAgICBnZXRNZW1iZXIoaWQsIGNhbkxvYWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG5cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMubWVtYmVyc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5tZW1iZXJzW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gU3luY2FibGUubG9hZChpZCwgdGhpcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0IHRoYXQgYSBuZXcgTWVtYmVyc2hpcCBoYXMgYmVlbiBhZGRlZC5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgX2FkZE1lbWJlcnNoaXBcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuTWVtYmVyc2hpcH0gbWVtYmVyXG4gICAgICpcbiAgICAgKi9cbiAgICBfYWRkTWVtYmVyc2hpcChtZW1iZXIpIHtcbiAgICAgIGlmICghdGhpcy5fbW9kZWxzLm1lbWJlcnNbbWVtYmVyLmlkXSkge1xuICAgICAgICB0aGlzLl9tb2RlbHMubWVtYmVyc1ttZW1iZXIuaWRdID0gbWVtYmVyO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lbWJlcnM6YWRkJywgeyBtZW1iZXJzOiBbbWVtYmVyXSB9KTtcbiAgICAgICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUobWVtYmVyKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0IHRoYXQgYSBtZW1iZXIgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBjbGllbnQuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9yZW1vdmVNZW1iZXJzaGlwXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBwYXJhbSAge2xheWVyLk1lbWJlcnNoaXB9IG1lbWJlclxuICAgICAqL1xuICAgIF9yZW1vdmVNZW1iZXJzaGlwKG1lbWJlcikge1xuICAgICAgY29uc3QgaWQgPSAodHlwZW9mIG1lbWJlciA9PT0gJ3N0cmluZycpID8gbWVtYmVyIDogbWVtYmVyLmlkO1xuICAgICAgbWVtYmVyID0gdGhpcy5fbW9kZWxzLm1lbWJlcnNbaWRdO1xuICAgICAgaWYgKG1lbWJlcikge1xuICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWxzLm1lbWJlcnNbaWRdO1xuICAgICAgICBpZiAoIXRoaXMuX2luQ2xlYW51cCkge1xuICAgICAgICAgIG1lbWJlci5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG4gICAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZW1iZXJzOnJlbW92ZScsIHsgbWVtYmVyczogW21lbWJlcl0gfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
