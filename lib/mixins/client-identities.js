'use strict';

/**
 * Adds Identity handling to the layer.Client.
 *
 * @class layer.mixins.ClientIdentities
 */

var Identity = require('../models/identity');
var ErrorDictionary = require('../layer-error').dictionary;
var Util = require('../client-utils');

var _require = require('../sync-event'),
    WebsocketSyncEvent = _require.WebsocketSyncEvent;

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
   * A call to layer.Identity.load has failed
   *
   * @event
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.LayerError} evt.error
   */
  'identities:loaded-error',

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
      this._loadPresenceIds = [];
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
      var _this2 = this;

      var id = identity.id;
      if (id && !this._models.identities[id]) {
        // Register the Identity
        this._models.identities[id] = identity;
        this._triggerAsync('identities:add', { identities: [identity] });

        /* Bot messages from SAPI 1.0 generate an Identity that has no `id` */
        if (identity.id && identity._presence.status === null && !identity.sessionOwner) {
          this._loadPresenceIds.push(id);
          if (this._loadPresenceIds.length === 1) {
            setTimeout(function () {
              if (!_this2.isDestroyed) _this2._loadPresence();
            }, 150);
          }
        }
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
    },


    /**
     * Load presence data for a batch of Idenity IDs.
     *
     * TODO: This uses the syncManager to request presence because the syncManager
     *   knows how to wait until the websocket is connected, and retry until the request completes.
     *   BUT: this is not ideal, because it must wait if there are any other requests already queued;
     *   this is a READ not a WRITE and should not have to wait.
     *
     * @method _loadPresence
     * @private
     */
    _loadPresence: function _loadPresence() {
      var ids = this._loadPresenceIds;
      this._loadPresenceIds = [];
      this.syncManager.request(new WebsocketSyncEvent({
        data: {
          method: 'Presence.sync',
          data: { ids: ids }
        },
        returnChangesArray: true,
        operation: 'READ',
        target: null,
        depends: []
      }));
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taXhpbnMvY2xpZW50LWlkZW50aXRpZXMuanMiXSwibmFtZXMiOlsiSWRlbnRpdHkiLCJyZXF1aXJlIiwiRXJyb3JEaWN0aW9uYXJ5IiwiZGljdGlvbmFyeSIsIlV0aWwiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJtb2R1bGUiLCJleHBvcnRzIiwiZXZlbnRzIiwibGlmZWN5Y2xlIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX21vZGVscyIsImlkZW50aXRpZXMiLCJfbG9hZFByZXNlbmNlSWRzIiwiY2xlYW51cCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiaWQiLCJpZGVudGl0eSIsImlzRGVzdHJveWVkIiwiZGVzdHJveSIsInJlc2V0IiwibWV0aG9kcyIsImdldElkZW50aXR5IiwiY2FuTG9hZCIsIkVycm9yIiwiaWRQYXJhbVJlcXVpcmVkIiwiaXNWYWxpZElkIiwicHJlZml4VVVJRCIsImVuY29kZVVSSUNvbXBvbmVudCIsImxvYWQiLCJfYWRkSWRlbnRpdHkiLCJfdHJpZ2dlckFzeW5jIiwiX3ByZXNlbmNlIiwic3RhdHVzIiwic2Vzc2lvbk93bmVyIiwicHVzaCIsImxlbmd0aCIsInNldFRpbWVvdXQiLCJfbG9hZFByZXNlbmNlIiwiX3JlbW92ZUlkZW50aXR5Iiwib2ZmIiwiZm9sbG93SWRlbnRpdHkiLCJjbGllbnRJZCIsImFwcElkIiwidXNlcklkIiwic3Vic3RyaW5nIiwiZm9sbG93IiwidW5mb2xsb3dJZGVudGl0eSIsInVuZm9sbG93IiwiaWRzIiwic3luY01hbmFnZXIiLCJyZXF1ZXN0IiwiZGF0YSIsIm1ldGhvZCIsInJldHVybkNoYW5nZXNBcnJheSIsIm9wZXJhdGlvbiIsInRhcmdldCIsImRlcGVuZHMiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztBQU1BLElBQU1BLFdBQVdDLFFBQVEsb0JBQVIsQ0FBakI7QUFDQSxJQUFNQyxrQkFBa0JELFFBQVEsZ0JBQVIsRUFBMEJFLFVBQWxEO0FBQ0EsSUFBTUMs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QUwsRUFBNkI7QUFDM0JBLGFBQUtuQixTQUFTOEIsVUFBVCxHQUFzQkMsbUJBQW1CWixFQUFuQixDQUEzQjtBQUNEO0FBQ0QsVUFBSUMsV0FBVyxLQUFLSyxXQUFMLENBQWlCTixFQUFqQixDQUFmO0FBQ0EsVUFBSSxDQUFDQyxRQUFMLEVBQWU7QUFDYkEsbUJBQVcsSUFBSXBCLFFBQUosQ0FBYTtBQUN0Qm1CLGdCQURzQjtBQUV0QjBCLG9CQUFVLEtBQUtDLEtBRk87QUFHdEJDLGtCQUFRNUIsR0FBRzZCLFNBQUgsQ0FBYSxFQUFiO0FBSGMsU0FBYixDQUFYO0FBS0Q7QUFDRDVCLGVBQVMrQixRQUFUO0FBQ0EsYUFBTy9CLFFBQVA7QUFDRCxLQTlJTTs7O0FBZ0pQOzs7Ozs7Ozs7OztBQVdBcUIsaUJBM0pPLDJCQTJKUztBQUNkLFVBQU1XLE1BQU0sS0FBS3RDLGdCQUFqQjtBQUNBLFdBQUtBLGdCQUFMLEdBQXdCLEVBQXhCO0FBQ0EsV0FBS3VDLFdBQUwsQ0FBaUJDLE9BQWpCLENBQXlCLElBQUlqRCxrQkFBSixDQUF1QjtBQUM5Q2tELGNBQU07QUFDSkMsa0JBQVEsZUFESjtBQUVKRCxnQkFBTSxFQUFFSCxRQUFGO0FBRkYsU0FEd0M7QUFLOUNLLDRCQUFvQixJQUwwQjtBQU05Q0MsbUJBQVcsTUFObUM7QUFPOUNDLGdCQUFRLElBUHNDO0FBUTlDQyxpQkFBUztBQVJxQyxPQUF2QixDQUF6QjtBQVVEO0FBeEtNO0FBN0dNLENBQWpCIiwiZmlsZSI6ImNsaWVudC1pZGVudGl0aWVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZGRzIElkZW50aXR5IGhhbmRsaW5nIHRvIHRoZSBsYXllci5DbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLm1peGlucy5DbGllbnRJZGVudGl0aWVzXG4gKi9cblxuY29uc3QgSWRlbnRpdHkgPSByZXF1aXJlKCcuLi9tb2RlbHMvaWRlbnRpdHknKTtcbmNvbnN0IEVycm9yRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJykuZGljdGlvbmFyeTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IHsgV2Vic29ja2V0U3luY0V2ZW50IH0gPSByZXF1aXJlKCcuLi9zeW5jLWV2ZW50Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBldmVudHM6IFtcbiAgICAvKipcbiAgICAgKiBBIGNhbGwgdG8gbGF5ZXIuSWRlbnRpdHkubG9hZCBoYXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseVxuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2lkZW50aXRpZXM6bG9hZGVkJyxcblxuICAgIC8qKlxuICAgICAqIEEgY2FsbCB0byBsYXllci5JZGVudGl0eS5sb2FkIGhhcyBmYWlsZWRcbiAgICAgKlxuICAgICAqIEBldmVudFxuICAgICAqIEBldmVudFxuICAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZXJyb3JcbiAgICAgKi9cbiAgICAnaWRlbnRpdGllczpsb2FkZWQtZXJyb3InLFxuXG4gICAgLyoqXG4gICAgICogQW4gSWRlbnRpdHkgaGFzIGhhZCBhIGNoYW5nZSBpbiBpdHMgcHJvcGVydGllcy5cbiAgICAgKlxuICAgICAqIENoYW5nZXMgb2NjdXIgd2hlbiBuZXcgZGF0YSBhcnJpdmVzIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAqICAgICAgICAgIHZhciBkaXNwbGF5TmFtZUNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignZGlzcGxheU5hbWUnKTtcbiAgICAgKiAgICAgICAgICBpZiAoZGlzcGxheU5hbWVDaGFuZ2VzLmxlbmd0aCkge1xuICAgICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyU3RhdHVzKGV2dC50YXJnZXQpO1xuICAgICAqICAgICAgICAgIH1cbiAgICAgKiAgICAgIH0pO1xuICAgICAqXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICAgKiBAcGFyYW0ge01peGVkfSBldnQuY2hhbmdlcy5uZXdWYWx1ZVxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgICAqL1xuICAgICdpZGVudGl0aWVzOmNoYW5nZScsXG5cbiAgICAvKipcbiAgICAgKiBJZGVudGl0aWVzIGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgQ2xpZW50LlxuICAgICAqXG4gICAgICogVGhpcyBldmVudCBpcyB0cmlnZ2VyZWQgd2hlbmV2ZXIgYSBuZXcgbGF5ZXIuSWRlbnRpdHkgKEZ1bGwgaWRlbnRpdHkgb3Igbm90KVxuICAgICAqIGhhcyBiZWVuIHJlY2VpdmVkIGJ5IHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgICAgICAgIGNsaWVudC5vbignaWRlbnRpdGllczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgICBldnQuaWRlbnRpdGllcy5mb3JFYWNoKGZ1bmN0aW9uKGlkZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIG15Vmlldy5hZGRJZGVudGl0eShpZGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAqXG4gICAgKiBAZXZlbnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5W119IGV2dC5pZGVudGl0aWVzXG4gICAgKi9cbiAgICAnaWRlbnRpdGllczphZGQnLFxuXG4gICAgLyoqXG4gICAgICogSWRlbnRpdGllcyBoYXZlIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBDbGllbnQuXG4gICAgICpcbiAgICAgKiBUaGlzIGRvZXMgbm90IHR5cGljYWxseSBvY2N1ci5cbiAgICAgKlxuICAgICAgICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICAgIGV2dC5pZGVudGl0aWVzLmZvckVhY2goZnVuY3Rpb24oaWRlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgbXlWaWV3LmFkZElkZW50aXR5KGlkZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICpcbiAgICAqIEBldmVudFxuICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LmlkZW50aXRpZXNcbiAgICAqL1xuICAgICdpZGVudGl0aWVzOnJlbW92ZScsXG5cbiAgICAvKipcbiAgICAgKiBBbiBJZGVudGl0eSBoYXMgYmVlbiB1bmZvbGxvd2VkIG9yIGRlbGV0ZWQuXG4gICAgICpcbiAgICAgKiBXZSBkbyBub3QgZGVsZXRlIHN1Y2ggSWRlbnRpdGllcyBlbnRpcmVseSBmcm9tIHRoZSBDbGllbnQgYXNcbiAgICAgKiB0aGVyZSBhcmUgc3RpbGwgTWVzc2FnZXMgZnJvbSB0aGVzZSBJZGVudGl0aWVzIHRvIGJlIHJlbmRlcmVkLFxuICAgICAqIGJ1dCB3ZSBkbyBkb3duZ3JhZGUgdGhlbSBmcm9tIEZ1bGwgSWRlbnRpdHkgdG8gQmFzaWMgSWRlbnRpdHkuXG4gICAgICogQGV2ZW50XG4gICAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAgICovXG4gICAgJ2lkZW50aXRpZXM6dW5mb2xsb3cnLFxuICBdLFxuICBsaWZlY3ljbGU6IHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuaWRlbnRpdGllcyA9IHt9O1xuICAgICAgdGhpcy5fbG9hZFByZXNlbmNlSWRzID0gW107XG4gICAgfSxcbiAgICBjbGVhbnVwKCkge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzLmlkZW50aXRpZXMpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkZW50aXR5ID0gdGhpcy5fbW9kZWxzLmlkZW50aXRpZXNbaWRdO1xuICAgICAgICBpZiAoaWRlbnRpdHkgJiYgIWlkZW50aXR5LmlzRGVzdHJveWVkKSB7XG4gICAgICAgICAgaWRlbnRpdHkuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX21vZGVscy5pZGVudGl0aWVzID0gbnVsbDtcbiAgICB9LFxuXG4gICAgcmVzZXQoKSB7XG4gICAgICB0aGlzLl9tb2RlbHMuaWRlbnRpdGllcyA9IHt9O1xuICAgIH0sXG4gIH0sXG4gIG1ldGhvZHM6IHtcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhIGlkZW50aXR5IGJ5IElkZW50aWZpZXIuXG4gICAgICpcbiAgICAgKiAgICAgIHZhciBpZGVudGl0eSA9IGNsaWVudC5nZXRJZGVudGl0eSgnbGF5ZXI6Ly8vaWRlbnRpdGllcy91c2VyX2lkJyk7XG4gICAgICpcbiAgICAgKiBJZiB0aGVyZSBpcyBub3QgYW4gSWRlbnRpdHkgd2l0aCB0aGF0IGlkLCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogSWYgeW91IHdhbnQgaXQgdG8gbG9hZCBpdCBmcm9tIGNhY2hlIGFuZCB0aGVuIGZyb20gc2VydmVyIGlmIG5vdCBpbiBjYWNoZSwgdXNlIHRoZSBgY2FuTG9hZGAgcGFyYW1ldGVyLlxuICAgICAqIFRoaXMgaXMgb25seSBzdXBwb3J0ZWQgZm9yIFVzZXIgSWRlbnRpdGllcywgbm90IFNlcnZpY2UgSWRlbnRpdGllcy5cbiAgICAgKlxuICAgICAqIElmIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLCB0aGUgbWV0aG9kIHdpbGwgcmV0dXJuXG4gICAgICogYSBsYXllci5JZGVudGl0eSBpbnN0YW5jZSB0aGF0IGhhcyBubyBkYXRhOyB0aGUgaWRlbnRpdGllczpsb2FkZWQvaWRlbnRpdGllczpsb2FkZWQtZXJyb3IgZXZlbnRzXG4gICAgICogd2lsbCBsZXQgeW91IGtub3cgd2hlbiB0aGUgaWRlbnRpdHkgaGFzIGZpbmlzaGVkL2ZhaWxlZCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqICAgICAgdmFyIHVzZXIgPSBjbGllbnQuZ2V0SWRlbnRpdHkoJ2xheWVyOi8vL2lkZW50aXRpZXMvMTIzJywgdHJ1ZSlcbiAgICAgKiAgICAgIC5vbignaWRlbnRpdGllczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgICAgICAvLyBSZW5kZXIgdGhlIHVzZXIgbGlzdCB3aXRoIGFsbCBvZiBpdHMgZGV0YWlscyBsb2FkZWRcbiAgICAgKiAgICAgICAgICBteXJlcmVuZGVyKHVzZXIpO1xuICAgICAqICAgICAgfSk7XG4gICAgICogICAgICAvLyBSZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgdXNlciB1bnRpbCB0aGUgZGV0YWlscyBvZiB1c2VyIGhhdmUgbG9hZGVkXG4gICAgICogICAgICBteXJlbmRlcih1c2VyKTtcbiAgICAgKlxuICAgICAqIEBtZXRob2QgZ2V0SWRlbnRpdHlcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gQWNjZXB0cyBmdWxsIExheWVyIElEIChsYXllcjovLy9pZGVudGl0aWVzL2Zyb2RvLXRoZS1kb2RvKSBvciBqdXN0IHRoZSBVc2VySUQgKGZyb2RvLXRoZS1kb2RvKS5cbiAgICAgKiBAcGFyYW0gIHtib29sZWFufSBbY2FuTG9hZD1mYWxzZV0gLSBQYXNzIHRydWUgdG8gYWxsb3cgbG9hZGluZyBhbiBpZGVudGl0eSBmcm9tXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgc2VydmVyIGlmIG5vdCBmb3VuZFxuICAgICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5fVxuICAgICAqL1xuICAgIGdldElkZW50aXR5KGlkLCBjYW5Mb2FkKSB7XG4gICAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICAgIGlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9tb2RlbHMuaWRlbnRpdGllc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscy5pZGVudGl0aWVzW2lkXTtcbiAgICAgIH0gZWxzZSBpZiAoY2FuTG9hZCkge1xuICAgICAgICByZXR1cm4gSWRlbnRpdHkubG9hZChpZCwgdGhpcyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhbiBpZGVudGl0eSB0byB0aGUgY2xpZW50LlxuICAgICAqXG4gICAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgSWRlbnRpdHkgY29uc3RydWN0b3Igd2lsbCBjYWxsIHRoaXMuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIF9hZGRJZGVudGl0eVxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKiBAcGFyYW0gIHtsYXllci5JZGVudGl0eX0gaWRlbnRpdHlcbiAgICAgKlxuICAgICAqIFRPRE86IEl0IHNob3VsZCBiZSBwb3NzaWJsZSB0byBhZGQgYW4gSWRlbnRpdHkgd2hvc2UgdXNlcklkIGlzIHBvcHVsYXRlZCwgYnV0XG4gICAgICogb3RoZXIgdmFsdWVzIGFyZSBub3QgeWV0IGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuICBTaG91bGQgYWRkIHRvIF9tb2RlbHMuaWRlbnRpdGllcyBub3dcbiAgICAgKiBidXQgdHJpZ2dlciBgaWRlbnRpdGllczphZGRgIG9ubHkgd2hlbiBpdHMgZ290IGVub3VnaCBkYXRhIHRvIGJlIHJlbmRlcmFibGUuXG4gICAgICovXG4gICAgX2FkZElkZW50aXR5KGlkZW50aXR5KSB7XG4gICAgICBjb25zdCBpZCA9IGlkZW50aXR5LmlkO1xuICAgICAgaWYgKGlkICYmICF0aGlzLl9tb2RlbHMuaWRlbnRpdGllc1tpZF0pIHtcbiAgICAgICAgLy8gUmVnaXN0ZXIgdGhlIElkZW50aXR5XG4gICAgICAgIHRoaXMuX21vZGVscy5pZGVudGl0aWVzW2lkXSA9IGlkZW50aXR5O1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2lkZW50aXRpZXM6YWRkJywgeyBpZGVudGl0aWVzOiBbaWRlbnRpdHldIH0pO1xuXG4gICAgICAgIC8qIEJvdCBtZXNzYWdlcyBmcm9tIFNBUEkgMS4wIGdlbmVyYXRlIGFuIElkZW50aXR5IHRoYXQgaGFzIG5vIGBpZGAgKi9cbiAgICAgICAgaWYgKGlkZW50aXR5LmlkICYmIGlkZW50aXR5Ll9wcmVzZW5jZS5zdGF0dXMgPT09IG51bGwgJiYgIWlkZW50aXR5LnNlc3Npb25Pd25lcikge1xuICAgICAgICAgIHRoaXMuX2xvYWRQcmVzZW5jZUlkcy5wdXNoKGlkKTtcbiAgICAgICAgICBpZiAodGhpcy5fbG9hZFByZXNlbmNlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgIGlmICghdGhpcy5pc0Rlc3Ryb3llZCkgdGhpcy5fbG9hZFByZXNlbmNlKCk7XG4gICAgICAgICAgICB9LCAxNTApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFuIGlkZW50aXR5IGZyb20gdGhlIGNsaWVudC5cbiAgICAgKlxuICAgICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBjYWxscyBfcmVtb3ZlSWRlbnRpdHkgZm9yIHlvdTpcbiAgICAgKlxuICAgICAqICAgICAgaWRlbnRpdHkuZGVzdHJveSgpO1xuICAgICAqXG4gICAgICogQG1ldGhvZCBfcmVtb3ZlSWRlbnRpdHlcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHl9IGlkZW50aXR5XG4gICAgICovXG4gICAgX3JlbW92ZUlkZW50aXR5KGlkZW50aXR5KSB7XG4gICAgICAvLyBJbnN1cmUgd2UgZG8gbm90IGdldCBhbnkgZXZlbnRzLCBzdWNoIGFzIG1lc3NhZ2U6cmVtb3ZlXG4gICAgICBpZGVudGl0eS5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG5cbiAgICAgIGNvbnN0IGlkID0gaWRlbnRpdHkuaWQ7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmlkZW50aXRpZXNbaWRdKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9tb2RlbHMuaWRlbnRpdGllc1tpZF07XG4gICAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnaWRlbnRpdGllczpyZW1vdmUnLCB7IGlkZW50aXRpZXM6IFtpZGVudGl0eV0gfSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvbGxvdyB0aGlzIHVzZXIgYW5kIGdldCBGdWxsIElkZW50aXR5LCBhbmQgd2Vic29ja2V0IGNoYW5nZXMgb24gSWRlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGZvbGxvd0lkZW50aXR5XG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIEFjY2VwdHMgZnVsbCBMYXllciBJRCAobGF5ZXI6Ly8vaWRlbnRpdGllcy9mcm9kby10aGUtZG9kbykgb3IganVzdCB0aGUgVXNlcklEIChmcm9kby10aGUtZG9kbykuXG4gICAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgICAqL1xuICAgIGZvbGxvd0lkZW50aXR5KGlkKSB7XG4gICAgICBpZiAoIUlkZW50aXR5LmlzVmFsaWRJZChpZCkpIHtcbiAgICAgICAgaWQgPSBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KGlkKTtcbiAgICAgIH1cbiAgICAgIGxldCBpZGVudGl0eSA9IHRoaXMuZ2V0SWRlbnRpdHkoaWQpO1xuICAgICAgaWYgKCFpZGVudGl0eSkge1xuICAgICAgICBpZGVudGl0eSA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgICAgaWQsXG4gICAgICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgICAgICAgdXNlcklkOiBpZC5zdWJzdHJpbmcoMjApLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlkZW50aXR5LmZvbGxvdygpO1xuICAgICAgcmV0dXJuIGlkZW50aXR5O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBVbmZvbGxvdyB0aGlzIHVzZXIgYW5kIGdldCBvbmx5IEJhc2ljIElkZW50aXR5LCBhbmQgbm8gd2Vic29ja2V0IGNoYW5nZXMgb24gSWRlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIHVuZm9sbG93SWRlbnRpdHlcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gQWNjZXB0cyBmdWxsIExheWVyIElEIChsYXllcjovLy9pZGVudGl0aWVzL2Zyb2RvLXRoZS1kb2RvKSBvciBqdXN0IHRoZSBVc2VySUQgKGZyb2RvLXRoZS1kb2RvKS5cbiAgICAgKiBAcmV0dXJucyB7bGF5ZXIuSWRlbnRpdHl9XG4gICAgICovXG4gICAgdW5mb2xsb3dJZGVudGl0eShpZCkge1xuICAgICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICAgIGlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG4gICAgICB9XG4gICAgICBsZXQgaWRlbnRpdHkgPSB0aGlzLmdldElkZW50aXR5KGlkKTtcbiAgICAgIGlmICghaWRlbnRpdHkpIHtcbiAgICAgICAgaWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoe1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICAgIHVzZXJJZDogaWQuc3Vic3RyaW5nKDIwKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZGVudGl0eS51bmZvbGxvdygpO1xuICAgICAgcmV0dXJuIGlkZW50aXR5O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIHByZXNlbmNlIGRhdGEgZm9yIGEgYmF0Y2ggb2YgSWRlbml0eSBJRHMuXG4gICAgICpcbiAgICAgKiBUT0RPOiBUaGlzIHVzZXMgdGhlIHN5bmNNYW5hZ2VyIHRvIHJlcXVlc3QgcHJlc2VuY2UgYmVjYXVzZSB0aGUgc3luY01hbmFnZXJcbiAgICAgKiAgIGtub3dzIGhvdyB0byB3YWl0IHVudGlsIHRoZSB3ZWJzb2NrZXQgaXMgY29ubmVjdGVkLCBhbmQgcmV0cnkgdW50aWwgdGhlIHJlcXVlc3QgY29tcGxldGVzLlxuICAgICAqICAgQlVUOiB0aGlzIGlzIG5vdCBpZGVhbCwgYmVjYXVzZSBpdCBtdXN0IHdhaXQgaWYgdGhlcmUgYXJlIGFueSBvdGhlciByZXF1ZXN0cyBhbHJlYWR5IHF1ZXVlZDtcbiAgICAgKiAgIHRoaXMgaXMgYSBSRUFEIG5vdCBhIFdSSVRFIGFuZCBzaG91bGQgbm90IGhhdmUgdG8gd2FpdC5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgX2xvYWRQcmVzZW5jZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRQcmVzZW5jZSgpIHtcbiAgICAgIGNvbnN0IGlkcyA9IHRoaXMuX2xvYWRQcmVzZW5jZUlkcztcbiAgICAgIHRoaXMuX2xvYWRQcmVzZW5jZUlkcyA9IFtdO1xuICAgICAgdGhpcy5zeW5jTWFuYWdlci5yZXF1ZXN0KG5ldyBXZWJzb2NrZXRTeW5jRXZlbnQoe1xuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgbWV0aG9kOiAnUHJlc2VuY2Uuc3luYycsXG4gICAgICAgICAgZGF0YTogeyBpZHMgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmV0dXJuQ2hhbmdlc0FycmF5OiB0cnVlLFxuICAgICAgICBvcGVyYXRpb246ICdSRUFEJyxcbiAgICAgICAgdGFyZ2V0OiBudWxsLFxuICAgICAgICBkZXBlbmRzOiBbXSxcbiAgICAgIH0pKTtcbiAgICB9LFxuICB9LFxufTtcbiJdfQ==
