'use strict';

/**
 * Adds Identity handling to the layer.Client.
 *
 * @class layer.mixins.ClientIdentities
 */

var Identity = require('../models/identity');
var ErrorDictionary = require('../layer-error').dictionary;

module.exports = {
  events: [
  /**
   * A call to layer.Identity.load has completed successfully
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Identity} evt.target
   */
  'identities:loaded',

  /**
   * An Identity has had a change in its properties.
   *
   * Changes occur when new data arrives from the server.
   *
   *      client.on('identities:change', function(evt) {
   *          var displayNameChanges = evt.getChangesFor('displayName');
   *          if (displayNameChanges.length) {
   *              myView.renderStatus(evt.target);
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Identity} evt.target
   * @param {Object[]} evt.changes
   * @param {Mixed} evt.changes.newValue
   * @param {Mixed} evt.changes.oldValue
   * @param {string} evt.changes.property - Name of the property that has changed
   */
  'identities:change',

  /**
   * Identities have been added to the Client.
   *
   * This event is triggered whenever a new layer.Identity (Full identity or not)
   * has been received by the Client.
   *
          client.on('identities:add', function(evt) {
              evt.identities.forEach(function(identity) {
                  myView.addIdentity(identity);
              });
          });
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Identity[]} evt.identities
  */
  'identities:add',

  /**
   * Identities have been removed from the Client.
   *
   * This does not typically occur.
   *
          client.on('identities:remove', function(evt) {
              evt.identities.forEach(function(identity) {
                  myView.addIdentity(identity);
              });
          });
  *
  * @event
  * @param {layer.LayerEvent} evt
  * @param {layer.Identity[]} evt.identities
  */
  'identities:remove',

  /**
   * An Identity has been unfollowed or deleted.
   *
   * We do not delete such Identities entirely from the Client as
   * there are still Messages from these Identities to be rendered,
   * but we do downgrade them from Full Identity to Basic Identity.
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.Identity} evt.target
   */
  'identities:unfollow'],
  lifecycle: {
    constructor: function constructor(options) {
      this._models.identities = {};
    },
    cleanup: function cleanup() {
      var _this = this;

      Object.keys(this._models.identities).forEach(function (id) {
        var identity = _this._models.identities[id];
        if (identity && !identity.isDestroyed) {
          identity.destroy();
        }
      });
      this._models.identities = null;
    },
    reset: function reset() {
      this._models.identities = {};
    }
  },
  methods: {
    /**
     * Retrieve a identity by Identifier.
     *
     *      var identity = client.getIdentity('layer:///identities/user_id');
     *
     * If there is not an Identity with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * This is only supported for User Identities, not Service Identities.
     *
     * If loading from the server, the method will return
     * a layer.Identity instance that has no data; the identities:loaded/identities:loaded-error events
     * will let you know when the identity has finished/failed loading from the server.
     *
     *      var user = client.getIdentity('layer:///identities/123', true)
     *      .on('identities:loaded', function() {
     *          // Render the user list with all of its details loaded
     *          myrerender(user);
     *      });
     *      // Render a placeholder for user until the details of user have loaded
     *      myrender(user);
     *
     * @method getIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @param  {boolean} [canLoad=false] - Pass true to allow loading an identity from
     *                                    the server if not found
     * @return {layer.Identity}
     */
    getIdentity: function getIdentity(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }

      if (this._models.identities[id]) {
        return this._models.identities[id];
      } else if (canLoad) {
        return Identity.load(id, this);
      }
      return null;
    },


    /**
     * Adds an identity to the client.
     *
     * Typically, you do not need to call this; the Identity constructor will call this.
     *
     * @method _addIdentity
     * @protected
     * @param  {layer.Identity} identity
     *
     * TODO: It should be possible to add an Identity whose userId is populated, but
     * other values are not yet loaded from the server.  Should add to _models.identities now
     * but trigger `identities:add` only when its got enough data to be renderable.
     */
    _addIdentity: function _addIdentity(identity) {
      var id = identity.id;
      if (id && !this._models.identities[id]) {
        // Register the Identity
        this._models.identities[id] = identity;
        this._triggerAsync('identities:add', { identities: [identity] });
      }
    },


    /**
     * Removes an identity from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeIdentity for you:
     *
     *      identity.destroy();
     *
     * @method _removeIdentity
     * @protected
     * @param  {layer.Identity} identity
     */
    _removeIdentity: function _removeIdentity(identity) {
      // Insure we do not get any events, such as message:remove
      identity.off(null, null, this);

      var id = identity.id;
      if (this._models.identities[id]) {
        delete this._models.identities[id];
        this._triggerAsync('identities:remove', { identities: [identity] });
      }
    },


    /**
     * Follow this user and get Full Identity, and websocket changes on Identity.
     *
     * @method followIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */
    followIdentity: function followIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.follow();
      return identity;
    },


    /**
     * Unfollow this user and get only Basic Identity, and no websocket changes on Identity.
     *
     * @method unfollowIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */
    unfollowIdentity: function unfollowIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.unfollow();
      return identity;
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWlkZW50aXRpZXMuanMiXSwibmFtZXMiOlsiSWRlbnRpdHkiLCJyZXF1aXJlIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIm1vZHVsZSIsImV4cG9ydHMiLCJldmVudHMiLCJsaWZlY3ljbGUiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJfbW9kZWxzIiwiaWRlbnRpdGllcyIsImNsZWFudXAiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImlkIiwiaWRlbnRpdHkiLCJpc0Rlc3Ryb3llZCIsImRlc3Ryb3kiLCJyZXNldCIsIm1ldGhvZHMiLCJnZXRJZGVudGl0eSIsImNhbkxvYWQiLCJFcnJvciIsImlkUGFyYW1SZXF1aXJlZCIsImlzVmFsaWRJZCIsInByZWZpeFVVSUQiLCJlbmNvZGVVUklDb21wb25lbnQiLCJsb2FkIiwiX2FkZElkZW50aXR5IiwiX3RyaWdnZXJBc3luYyIsIl9yZW1vdmVJZGVudGl0eSIsIm9mZiIsImZvbGxvd0lkZW50aXR5IiwiY2xpZW50SWQiLCJhcHBJZCIsInVzZXJJZCIsInN1YnN0cmluZyIsImZvbGxvdyIsInVuZm9sbG93SWRlbnRpdHkiLCJ1bmZvbGxvdyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0FBTUEsSUFBTUEsV0FBV0MsUUFBUSxvQkFBUixDQUFqQjtBQUNBLElBQU1DLGtCQUFrQkQsUUFBUSxnQkFBUixFQUEwQkUsVUFBbEQ7O0FBRUFDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsVUFBUTtBQUNOOzs7Ozs7O0FBT0EscUJBUk07O0FBVU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLHFCQTlCTTs7QUFnQ047Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsa0JBaERNOztBQWtETjs7Ozs7Ozs7Ozs7Ozs7O0FBZUEscUJBakVNOztBQW1FTjs7Ozs7Ozs7OztBQVVBLHVCQTdFTSxDQURPO0FBZ0ZmQyxhQUFXO0FBQ1RDLGVBRFMsdUJBQ0dDLE9BREgsRUFDWTtBQUNuQixXQUFLQyxPQUFMLENBQWFDLFVBQWIsR0FBMEIsRUFBMUI7QUFDRCxLQUhRO0FBSVRDLFdBSlMscUJBSUM7QUFBQTs7QUFDUkMsYUFBT0MsSUFBUCxDQUFZLEtBQUtKLE9BQUwsQ0FBYUMsVUFBekIsRUFBcUNJLE9BQXJDLENBQTZDLFVBQUNDLEVBQUQsRUFBUTtBQUNuRCxZQUFNQyxXQUFXLE1BQUtQLE9BQUwsQ0FBYUMsVUFBYixDQUF3QkssRUFBeEIsQ0FBakI7QUFDQSxZQUFJQyxZQUFZLENBQUNBLFNBQVNDLFdBQTFCLEVBQXVDO0FBQ3JDRCxtQkFBU0UsT0FBVDtBQUNEO0FBQ0YsT0FMRDtBQU1BLFdBQUtULE9BQUwsQ0FBYUMsVUFBYixHQUEwQixJQUExQjtBQUNELEtBWlE7QUFjVFMsU0FkUyxtQkFjRDtBQUNOLFdBQUtWLE9BQUwsQ0FBYUMsVUFBYixHQUEwQixFQUExQjtBQUNEO0FBaEJRLEdBaEZJO0FBa0dmVSxXQUFTO0FBQ1A7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE0QkFDLGVBN0JPLHVCQTZCS04sRUE3QkwsRUE2QlNPLE9BN0JULEVBNkJrQjtBQUN2QixVQUFJLE9BQU9QLEVBQVAsS0FBYyxRQUFsQixFQUE0QixNQUFNLElBQUlRLEtBQUosQ0FBVXRCLGdCQUFnQnVCLGVBQTFCLENBQU47QUFDNUIsVUFBSSxDQUFDekIsU0FBUzBCLFNBQVQsQ0FBbUJWLEVBQW5CLENBQUwsRUFBNkI7QUFDM0JBLGFBQUtoQixTQUFTMkIsVUFBVCxHQUFzQkMsbUJBQW1CWixFQUFuQixDQUEzQjtBQUNEOztBQUVELFVBQUksS0FBS04sT0FBTCxDQUFhQyxVQUFiLENBQXdCSyxFQUF4QixDQUFKLEVBQWlDO0FBQy9CLGVBQU8sS0FBS04sT0FBTCxDQUFhQyxVQUFiLENBQXdCSyxFQUF4QixDQUFQO0FBQ0QsT0FGRCxNQUVPLElBQUlPLE9BQUosRUFBYTtBQUNsQixlQUFPdkIsU0FBUzZCLElBQVQsQ0FBY2IsRUFBZCxFQUFrQixJQUFsQixDQUFQO0FBQ0Q7QUFDRCxhQUFPLElBQVA7QUFDRCxLQXpDTTs7O0FBMkNQOzs7Ozs7Ozs7Ozs7O0FBYUFjLGdCQXhETyx3QkF3RE1iLFFBeEROLEVBd0RnQjtBQUNyQixVQUFNRCxLQUFLQyxTQUFTRCxFQUFwQjtBQUNBLFVBQUlBLE1BQU0sQ0FBQyxLQUFLTixPQUFMLENBQWFDLFVBQWIsQ0FBd0JLLEVBQXhCLENBQVgsRUFBd0M7QUFDdEM7QUFDQSxhQUFLTixPQUFMLENBQWFDLFVBQWIsQ0FBd0JLLEVBQXhCLElBQThCQyxRQUE5QjtBQUNBLGFBQUtjLGFBQUwsQ0FBbUIsZ0JBQW5CLEVBQXFDLEVBQUVwQixZQUFZLENBQUNNLFFBQUQsQ0FBZCxFQUFyQztBQUNEO0FBQ0YsS0EvRE07OztBQWlFUDs7Ozs7Ozs7Ozs7O0FBWUFlLG1CQTdFTywyQkE2RVNmLFFBN0VULEVBNkVtQjtBQUN4QjtBQUNBQSxlQUFTZ0IsR0FBVCxDQUFhLElBQWIsRUFBbUIsSUFBbkIsRUFBeUIsSUFBekI7O0FBRUEsVUFBTWpCLEtBQUtDLFNBQVNELEVBQXBCO0FBQ0EsVUFBSSxLQUFLTixPQUFMLENBQWFDLFVBQWIsQ0FBd0JLLEVBQXhCLENBQUosRUFBaUM7QUFDL0IsZUFBTyxLQUFLTixPQUFMLENBQWFDLFVBQWIsQ0FBd0JLLEVBQXhCLENBQVA7QUFDQSxhQUFLZSxhQUFMLENBQW1CLG1CQUFuQixFQUF3QyxFQUFFcEIsWUFBWSxDQUFDTSxRQUFELENBQWQsRUFBeEM7QUFDRDtBQUNGLEtBdEZNOzs7QUF3RlA7Ozs7Ozs7QUFPQWlCLGtCQS9GTywwQkErRlFsQixFQS9GUixFQStGWTtBQUNqQixVQUFJLENBQUNoQixTQUFTMEIsU0FBVCxDQUFtQlYsRUFBbkIsQ0FBTCxFQUE2QjtBQUMzQkEsYUFBS2hCLFNBQVMyQixVQUFULEdBQXNCQyxtQkFBbUJaLEVBQW5CLENBQTNCO0FBQ0Q7QUFDRCxVQUFJQyxXQUFXLEtBQUtLLFdBQUwsQ0FBaUJOLEVBQWpCLENBQWY7QUFDQSxVQUFJLENBQUNDLFFBQUwsRUFBZTtBQUNiQSxtQkFBVyxJQUFJakIsUUFBSixDQUFhO0FBQ3RCZ0IsZ0JBRHNCO0FBRXRCbUIsb0JBQVUsS0FBS0MsS0FGTztBQUd0QkMsa0JBQVFyQixHQUFHc0IsU0FBSCxDQUFhLEVBQWI7QUFIYyxTQUFiLENBQVg7QUFLRDtBQUNEckIsZUFBU3NCLE1BQVQ7QUFDQSxhQUFPdEIsUUFBUDtBQUNELEtBN0dNOzs7QUErR1A7Ozs7Ozs7QUFPQXVCLG9CQXRITyw0QkFzSFV4QixFQXRIVixFQXNIYztBQUNuQixVQUFJLENBQUNoQixTQUFTMEIsU0FBVCxDQUFtQlYsRUFBbkIsQ0FBTCxFQUE2QjtBQUMzQkEsYUFBS2hCLFNBQVMyQixVQUFULEdBQXNCQyxtQkFBbUJaLEVBQW5CLENBQTNCO0FBQ0Q7QUFDRCxVQUFJQyxXQUFXLEtBQUtLLFdBQUwsQ0FBaUJOLEVBQWpCLENBQWY7QUFDQSxVQUFJLENBQUNDLFFBQUwsRUFBZTtBQUNiQSxtQkFBVyxJQUFJakIsUUFBSixDQUFhO0FBQ3RCZ0IsZ0JBRHNCO0FBRXRCbUIsb0JBQVUsS0FBS0MsS0FGTztBQUd0QkMsa0JBQVFyQixHQUFHc0IsU0FBSCxDQUFhLEVBQWI7QUFIYyxTQUFiLENBQVg7QUFLRDtBQUNEckIsZUFBU3dCLFFBQVQ7QUFDQSxhQUFPeEIsUUFBUDtBQUNEO0FBcElNO0FBbEdNLENBQWpCIiwiZmlsZSI6ImNsaWVudC1pZGVudGl0aWVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZGRzIElkZW50aXR5IGhhbmRsaW5nIHRvIHRoZSBsYXllci5DbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLm1peGlucy5DbGllbnRJZGVudGl0aWVzXG4gKi9cblxuY29uc3QgSWRlbnRpdHkgPSByZXF1aXJlKCcuLi9tb2RlbHMvaWRlbnRpdHknKTtcbmNvbnN0IEVycm9yRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJykuZGljdGlvbmFyeTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV2ZW50czogW1xuICAgIC8qKlxuICAgICAqIEEgY2FsbCB0byBsYXllci5JZGVudGl0eS5sb2FkIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICpcbiAgICAgKiBAZXZlbnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHl9IGV2dC50YXJnZXRcbiAgICAgKi9cbiAgICAnaWRlbnRpdGllczpsb2FkZWQnLFxuXG4gICAgLyoqXG4gICAgICogQW4gSWRlbnRpdHkgaGFzIGhhZCBhIGNoYW5nZSBpbiBpdHMgcHJvcGVydGllcy5cbiAgICAgKlxuICAgICAqIENoYW5nZXMgb2NjdXIgd2hlbiBuZXcgZGF0YSBhcnJpdmVzIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHZhciBkaXNwbGF5TmFtZUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignZGlzcGxheU5hbWUnKTtcbiAgICAgKiAgICAgICAgICBpZiAoZGlzcGxheU5hbWVDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyU3RhdHVzKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgICAqL1xuICAgICdpZGVudGl0aWVzOmNoYW5nZScsXG5cbiAgICAvKipcbiAgICAgKiBJZGVudGl0aWVzIGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgQ2xpZW50LlxuICAgICAqXG4gICAgICogVGhpcyBldmVudCBpcyB0cmlnZ2VyZWQgd2hlbmV2ZXIgYSBuZXcgbGF5ZXIuSWRlbnRpdHkgKEZ1bGwgaWRlbnRpdHkgb3Igbm90KVxuICAgICAqIGhhcyBiZWVuIHJlY2VpdmVkIGJ5IHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgICAgICAgIGNsaWVudC5vbignaWRlbnRpdGllczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgICBldnQuaWRlbnRpdGllcy5mb3JFYWNoKGZ1bmN0aW9uKGlkZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIG15Vmlldy5hZGRJZGVudGl0eShpZGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAqXG4gICAgKiBAZXZlbnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5W119IGV2dC5pZGVudGl0aWVzXG4gICAgKi9cbiAgICAnaWRlbnRpdGllczphZGQnLFxuXG4gICAgLyoqXG4gICAgICogSWRlbnRpdGllcyBoYXZlIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGlzIGRvZXMgbm90IHR5cGljYWxseSBvY2N1ci5cbiAgICAgKlxuICAgICAgICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICAgIGV2dC5pZGVudGl0aWVzLmZvckVhY2goZnVuY3Rpb24oaWRlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgbXlWaWV3LmFkZElkZW50aXR5KGlkZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICpcbiAgICAqIEBldmVudFxuICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LmlkZW50aXRpZXNcbiAgICAqL1xuICAgICdpZGVudGl0aWVzOnJlbW92ZScsXG5cbiAgICAvKipcbiAgICAgKiBBbiBJZGVudGl0eSBoYXMgYmVlbiB1bmZvbGxvd2VkIG9yIGRlbGV0ZWQuXG4gICAgICpcbiAgICAgKiBXZSBkbyBub3QgZGVsZXRlIHN1Y2ggSWRlbnRpdGllcyBlbnRpcmVseSBmcm9tIHRoZSBDbGllbnQgYXNcbiAgICAgKiB0aGVyZSBhcmUgc3RpbGwgTWVzc2FnZXMgZnJvbSB0aGVzZSBJZGVudGl0aWVzIHRvIGJlIHJlbmRlcmVkLFxuICAgICAqIGJ1dCB3ZSBkbyBkb3duZ3JhZGUgdGhlbSBmcm9tIEZ1bGwgSWRlbnRpdHkgdG8gQmFzaWMgSWRlbnRpdHkuXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2lkZW50aXRpZXM6dW5mb2xsb3cnLFxuICBdLFxuICBsaWZlY3ljbGU6IHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuaWRlbnRpdGllcyA9IHt9O1xuICAgIH0sXG4gICAgY2xlYW51cCgpIHtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscy5pZGVudGl0aWVzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICBjb25zdCBpZGVudGl0eSA9IHRoaXMuX21vZGVscy5pZGVudGl0aWVzW2lkXTtcbiAgICAgICAgaWYgKGlkZW50aXR5ICYmICFpZGVudGl0eS5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIGlkZW50aXR5LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9tb2RlbHMuaWRlbnRpdGllcyA9IG51bGw7XG4gICAgfSxcblxuICAgIHJlc2V0KCkge1xuICAgICAgdGhpcy5fbW9kZWxzLmlkZW50aXRpZXMgPSB7fTtcbiAgICB9LFxuICB9LFxuICBtZXRob2RzOiB7XG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYSBpZGVudGl0eSBieSBJZGVudGlmaWVyLlxuICAgICAqXG4gICAgICogICAgICB2YXIgaWRlbnRpdHkgPSBjbGllbnQuZ2V0SWRlbnRpdHkoJ2xheWVyOi8vL2lkZW50aXRpZXMvdXNlcl9pZCcpO1xuICAgICAqXG4gICAgICogSWYgdGhlcmUgaXMgbm90IGFuIElkZW50aXR5IHdpdGggdGhhdCBpZCwgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICAgKiBUaGlzIGlzIG9ubHkgc3VwcG9ydGVkIGZvciBVc2VyIElkZW50aXRpZXMsIG5vdCBTZXJ2aWNlIElkZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBJZiBsb2FkaW5nIGZyb20gdGhlIHNlcnZlciwgdGhlIG1ldGhvZCB3aWxsIHJldHVyblxuICAgICAqIGEgbGF5ZXIuSWRlbnRpdHkgaW5zdGFuY2UgdGhhdCBoYXMgbm8gZGF0YTsgdGhlIGlkZW50aXRpZXM6bG9hZGVkL2lkZW50aXRpZXM6bG9hZGVkLWVycm9yIGV2ZW50c1xuICAgICAqIHdpbGwgbGV0IHlvdSBrbm93IHdoZW4gdGhlIGlkZW50aXR5IGhhcyBmaW5pc2hlZC9mYWlsZWQgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICpcbiAgICAgKiAgICAgIHZhciB1c2VyID0gY2xpZW50LmdldElkZW50aXR5KCdsYXllcjovLy9pZGVudGl0aWVzLzEyMycsIHRydWUpXG4gICAgICogICAgICAub24oJ2lkZW50aXRpZXM6bG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSB1c2VyIGxpc3Qgd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAgICogICAgICAgICAgbXlyZXJlbmRlcih1c2VyKTtcbiAgICAgKiAgICAgIH0pO1xuICAgICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIHVzZXIgdW50aWwgdGhlIGRldGFpbHMgb2YgdXNlciBoYXZlIGxvYWRlZFxuICAgICAqICAgICAgbXlyZW5kZXIodXNlcik7XG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGdldElkZW50aXR5XG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIEFjY2VwdHMgZnVsbCBMYXllciBJRCAobGF5ZXI6Ly8vaWRlbnRpdGllcy9mcm9kby10aGUtZG9kbykgb3IganVzdCB0aGUgVXNlcklEIChmcm9kby10aGUtZG9kbykuXG4gICAgICogQHBhcmFtICB7Ym9vbGVhbn0gW2NhbkxvYWQ9ZmFsc2VdIC0gUGFzcyB0cnVlIHRvIGFsbG93IGxvYWRpbmcgYW4gaWRlbnRpdHkgZnJvbVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIHNlcnZlciBpZiBub3QgZm91bmRcbiAgICAgKiBAcmV0dXJuIHtsYXllci5JZGVudGl0eX1cbiAgICAgKi9cbiAgICBnZXRJZGVudGl0eShpZCwgY2FuTG9hZCkge1xuICAgICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcbiAgICAgIGlmICghSWRlbnRpdHkuaXNWYWxpZElkKGlkKSkge1xuICAgICAgICBpZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQoaWQpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmlkZW50aXRpZXNbaWRdKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbHMuaWRlbnRpdGllc1tpZF07XG4gICAgICB9IGVsc2UgaWYgKGNhbkxvYWQpIHtcbiAgICAgICAgcmV0dXJuIElkZW50aXR5LmxvYWQoaWQsIHRoaXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW4gaWRlbnRpdHkgdG8gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIElkZW50aXR5IGNvbnN0cnVjdG9yIHdpbGwgY2FsbCB0aGlzLlxuICAgICAqXG4gICAgICogQG1ldGhvZCBfYWRkSWRlbnRpdHlcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHl9IGlkZW50aXR5XG4gICAgICpcbiAgICAgKiBUT0RPOiBJdCBzaG91bGQgYmUgcG9zc2libGUgdG8gYWRkIGFuIElkZW50aXR5IHdob3NlIHVzZXJJZCBpcyBwb3B1bGF0ZWQsIGJ1dFxuICAgICAqIG90aGVyIHZhbHVlcyBhcmUgbm90IHlldCBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLiAgU2hvdWxkIGFkZCB0byBfbW9kZWxzLmlkZW50aXRpZXMgbm93XG4gICAgICogYnV0IHRyaWdnZXIgYGlkZW50aXRpZXM6YWRkYCBvbmx5IHdoZW4gaXRzIGdvdCBlbm91Z2ggZGF0YSB0byBiZSByZW5kZXJhYmxlLlxuICAgICAqL1xuICAgIF9hZGRJZGVudGl0eShpZGVudGl0eSkge1xuICAgICAgY29uc3QgaWQgPSBpZGVudGl0eS5pZDtcbiAgICAgIGlmIChpZCAmJiAhdGhpcy5fbW9kZWxzLmlkZW50aXRpZXNbaWRdKSB7XG4gICAgICAgIC8vIFJlZ2lzdGVyIHRoZSBJZGVudGl0eVxuICAgICAgICB0aGlzLl9tb2RlbHMuaWRlbnRpdGllc1tpZF0gPSBpZGVudGl0eTtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOmFkZCcsIHsgaWRlbnRpdGllczogW2lkZW50aXR5XSB9KTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbiBpZGVudGl0eSBmcm9tIHRoZSBjbGllbnQuXG4gICAgICpcbiAgICAgKiBUeXBpY2FsbHksIHlvdSBkbyBub3QgbmVlZCB0byBjYWxsIHRoaXM7IHRoZSBmb2xsb3dpbmcgY29kZVxuICAgICAqIGF1dG9tYXRpY2FsbHkgY2FsbHMgX3JlbW92ZUlkZW50aXR5IGZvciB5b3U6XG4gICAgICpcbiAgICAgKiAgICAgIGlkZW50aXR5LmRlc3Ryb3koKTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgX3JlbW92ZUlkZW50aXR5XG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5fSBpZGVudGl0eVxuICAgICAqL1xuICAgIF9yZW1vdmVJZGVudGl0eShpZGVudGl0eSkge1xuICAgICAgLy8gSW5zdXJlIHdlIGRvIG5vdCBnZXQgYW55IGV2ZW50cywgc3VjaCBhcyBtZXNzYWdlOnJlbW92ZVxuICAgICAgaWRlbnRpdHkub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuXG4gICAgICBjb25zdCBpZCA9IGlkZW50aXR5LmlkO1xuICAgICAgaWYgKHRoaXMuX21vZGVscy5pZGVudGl0aWVzW2lkXSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWxzLmlkZW50aXRpZXNbaWRdO1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2lkZW50aXRpZXM6cmVtb3ZlJywgeyBpZGVudGl0aWVzOiBbaWRlbnRpdHldIH0pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGb2xsb3cgdGhpcyB1c2VyIGFuZCBnZXQgRnVsbCBJZGVudGl0eSwgYW5kIHdlYnNvY2tldCBjaGFuZ2VzIG9uIElkZW50aXR5LlxuICAgICAqXG4gICAgICogQG1ldGhvZCBmb2xsb3dJZGVudGl0eVxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gaWQgLSBBY2NlcHRzIGZ1bGwgTGF5ZXIgSUQgKGxheWVyOi8vL2lkZW50aXRpZXMvZnJvZG8tdGhlLWRvZG8pIG9yIGp1c3QgdGhlIFVzZXJJRCAoZnJvZG8tdGhlLWRvZG8pLlxuICAgICAqIEByZXR1cm5zIHtsYXllci5JZGVudGl0eX1cbiAgICAgKi9cbiAgICBmb2xsb3dJZGVudGl0eShpZCkge1xuICAgICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICAgIGlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG4gICAgICB9XG4gICAgICBsZXQgaWRlbnRpdHkgPSB0aGlzLmdldElkZW50aXR5KGlkKTtcbiAgICAgIGlmICghaWRlbnRpdHkpIHtcbiAgICAgICAgaWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICAgIHVzZXJJZDogaWQuc3Vic3RyaW5nKDIwKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZGVudGl0eS5mb2xsb3coKTtcbiAgICAgIHJldHVybiBpZGVudGl0eTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVW5mb2xsb3cgdGhpcyB1c2VyIGFuZCBnZXQgb25seSBCYXNpYyBJZGVudGl0eSwgYW5kIG5vIHdlYnNvY2tldCBjaGFuZ2VzIG9uIElkZW50aXR5LlxuICAgICAqXG4gICAgICogQG1ldGhvZCB1bmZvbGxvd0lkZW50aXR5XG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIEFjY2VwdHMgZnVsbCBMYXllciBJRCAobGF5ZXI6Ly8vaWRlbnRpdGllcy9mcm9kby10aGUtZG9kbykgb3IganVzdCB0aGUgVXNlcklEIChmcm9kby10aGUtZG9kbykuXG4gICAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgICAqL1xuICAgIHVuZm9sbG93SWRlbnRpdHkoaWQpIHtcbiAgICAgIGlmICghSWRlbnRpdHkuaXNWYWxpZElkKGlkKSkge1xuICAgICAgICBpZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQoaWQpO1xuICAgICAgfVxuICAgICAgbGV0IGlkZW50aXR5ID0gdGhpcy5nZXRJZGVudGl0eShpZCk7XG4gICAgICBpZiAoIWlkZW50aXR5KSB7XG4gICAgICAgIGlkZW50aXR5ID0gbmV3IElkZW50aXR5KHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgICB1c2VySWQ6IGlkLnN1YnN0cmluZygyMCksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWRlbnRpdHkudW5mb2xsb3coKTtcbiAgICAgIHJldHVybiBpZGVudGl0eTtcbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
