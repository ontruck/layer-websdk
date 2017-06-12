'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class  layer.Websockets.ChangeManager
 * @private
 *
 * This class listens for `change` events from the websocket server,
 * and processes them.
 */
var Utils = require('../client-utils');
var logger = require('../logger');
var Message = require('../models/message');
var Conversation = require('../models/conversation');
var Channel = require('../models/channel');

var WebsocketChangeManager = function () {
  /**
   * Create a new websocket change manager
   *
   *      var websocketChangeManager = new layer.Websockets.ChangeManager({
   *          client: client,
   *          socketManager: client.Websockets.SocketManager
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @param {layer.Websockets.SocketManager} socketManager
   * @returns {layer.Websockets.ChangeManager}
   */
  function WebsocketChangeManager(options) {
    _classCallCheck(this, WebsocketChangeManager);

    this.client = options.client;
    options.socketManager.on('message', this._handleChange, this);
  }

  /**
   * Handles a Change packet from the server.
   *
   * @method _handleChange
   * @private
   * @param  {layer.LayerEvent} evt
   */


  _createClass(WebsocketChangeManager, [{
    key: '_handleChange',
    value: function _handleChange(evt) {
      if (evt.data.type === 'change') {
        this._processChange(evt.data.body);
      }
    }

    /**
     * Process changes from a change packet.
     *
     * Called both by _handleChange, and by the requestManager on getting a changes array.
     *
     * @method _processChanage
     * @private
     * @param {Object} msg
     */

  }, {
    key: '_processChange',
    value: function _processChange(msg) {
      switch (msg.operation) {
        case 'create':
          logger.info('Websocket Change Event: Create ' + msg.object.type + ' ' + msg.object.id);
          logger.debug(msg.data);
          this._handleCreate(msg);
          break;
        case 'delete':
          logger.info('Websocket Change Event: Delete ' + msg.object.type + ' ' + msg.object.id);
          logger.debug(msg.data);
          this._handleDelete(msg);
          break;
        case 'update':
          logger.info('Websocket Change Event: Patch ' + msg.object.type + ' ' + msg.object.id + ': ' + msg.data.map(function (op) {
            return op.property;
          }).join(', '));
          logger.debug(msg.data);
          this._handlePatch(msg);
          break;
      }
    }

    /**
     * Process a create object message from the server
     *
     * @method _handleCreate
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleCreate',
    value: function _handleCreate(msg) {
      msg.data.fromWebsocket = true;
      this.client._createObject(msg.data);
    }

    /**
     * Handles delete object messages from the server.
     * All objects that can be deleted from the server should
     * provide a _deleted() method to be called prior to destroy().
     *
     * @method _handleDelete
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleDelete',
    value: function _handleDelete(msg) {
      var entity = this.getObject(msg);
      if (entity) {
        entity._handleWebsocketDelete(msg.data);
      }
    }

    /**
     * On receiving an update/patch message from the server
     * run the LayerParser on the data.
     *
     * @method _handlePatch
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handlePatch',
    value: function _handlePatch(msg) {
      // Can only patch a cached object
      var entity = this.getObject(msg);
      if (entity) {
        try {
          entity._inLayerParser = true;
          Utils.layerParse({
            object: entity,
            type: msg.object.type,
            operations: msg.data,
            client: this.client
          });
          entity._inLayerParser = false;
        } catch (err) {
          logger.error('websocket-manager: Failed to handle event', msg.data);
        }
      } else {
        switch (Utils.typeFromID(msg.object.id)) {
          case 'channels':
            if (Channel._loadResourceForPatch(msg.data)) this.client.getObject(msg.object.id, true);
            break;
          case 'conversations':
            if (Conversation._loadResourceForPatch(msg.data)) this.client.getObject(msg.object.id, true);
            break;
          case 'messages':
            if (Message._loadResourceForPatch(msg.data)) this.client.getMessage(msg.object.id, true);
            break;
          case 'announcements':
            break;
        }
      }
    }

    /**
     * Get the object specified by the `object` property of the websocket packet.
     *
     * @method getObject
     * @private
     * @param  {Object} msg
     * @return {layer.Root}
     */

  }, {
    key: 'getObject',
    value: function getObject(msg) {
      return this.client.getObject(msg.object.id);
    }

    /**
     * Not required, but destroy is best practice
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this.client = null;
    }
  }]);

  return WebsocketChangeManager;
}();

/**
 * The Client that owns this.
 * @type {layer.Client}
 */


WebsocketChangeManager.prototype.client = null;

module.exports = WebsocketChangeManager;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsImxvZ2dlciIsIk1lc3NhZ2UiLCJDb252ZXJzYXRpb24iLCJDaGFubmVsIiwiV2Vic29ja2V0Q2hhbmdlTWFuYWdlciIsIm9wdGlvbnMiLCJjbGllbnQiLCJzb2NrZXRNYW5hZ2VyIiwib24iLCJfaGFuZGxlQ2hhbmdlIiwiZXZ0IiwiZGF0YSIsInR5cGUiLCJfcHJvY2Vzc0NoYW5nZSIsImJvZHkiLCJtc2ciLCJvcGVyYXRpb24iLCJpbmZvIiwib2JqZWN0IiwiaWQiLCJkZWJ1ZyIsIl9oYW5kbGVDcmVhdGUiLCJfaGFuZGxlRGVsZXRlIiwibWFwIiwib3AiLCJwcm9wZXJ0eSIsImpvaW4iLCJfaGFuZGxlUGF0Y2giLCJmcm9tV2Vic29ja2V0IiwiX2NyZWF0ZU9iamVjdCIsImVudGl0eSIsImdldE9iamVjdCIsIl9oYW5kbGVXZWJzb2NrZXREZWxldGUiLCJfaW5MYXllclBhcnNlciIsImxheWVyUGFyc2UiLCJvcGVyYXRpb25zIiwiZXJyIiwiZXJyb3IiLCJ0eXBlRnJvbUlEIiwiX2xvYWRSZXNvdXJjZUZvclBhdGNoIiwiZ2V0TWVzc2FnZSIsInByb3RvdHlwZSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7Ozs7O0FBT0EsSUFBTUEsUUFBUUMsUUFBUSxpQkFBUixDQUFkO0FBQ0EsSUFBTUMsU0FBU0QsUUFBUSxXQUFSLENBQWY7QUFDQSxJQUFNRSxVQUFVRixRQUFRLG1CQUFSLENBQWhCO0FBQ0EsSUFBTUcsZUFBZUgsUUFBUSx3QkFBUixDQUFyQjtBQUNBLElBQU1JLFVBQVVKLFFBQVEsbUJBQVIsQ0FBaEI7O0lBR01LLHNCO0FBQ0o7Ozs7Ozs7Ozs7Ozs7O0FBY0Esa0NBQVlDLE9BQVosRUFBcUI7QUFBQTs7QUFDbkIsU0FBS0MsTUFBTCxHQUFjRCxRQUFRQyxNQUF0QjtBQUNBRCxZQUFR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Q3hCLElBQUlKLElBQXZDLENBQUosRUFBa0QsS0FBS0wsTUFBTCxDQUFZeUIsU0FBWixDQUFzQmhCLElBQUlHLE1BQUosQ0FBV0MsRUFBakMsRUFBcUMsSUFBckM7QUFDbEQ7QUFDRixlQUFLLFVBQUw7QUFDRSxnQkFBSWxCLFFBQVFzQyxxQkFBUixDQUE4QnhCLElBQUlKLElBQWxDLENBQUosRUFBNkMsS0FBS0wsTUFBTCxDQUFZa0MsVUFBWixDQUF1QnpCLElBQUlHLE1BQUosQ0FBV0MsRUFBbEMsRUFBc0MsSUFBdEM7QUFDN0M7QUFDRixlQUFLLGVBQUw7QUFDRTtBQVhKO0FBYUQ7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7OEJBUVVKLEcsRUFBSztBQUNiLGFBQU8sS0FBS1QsTUFBTCxDQUFZeUIsU0FBWixDQUFzQmhCLElBQUlHLE1BQUosQ0FBV0MsRUFBakMsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7OzhCQUlVO0FBQ1IsV0FBS2IsTUFBTCxHQUFjLElBQWQ7QUFDRDs7Ozs7O0FBR0g7Ozs7OztBQUlBRix1QkFBdUJxQyxTQUF2QixDQUFpQ25DLE1BQWpDLEdBQTBDLElBQTFDOztBQUVBb0MsT0FBT0MsT0FBUCxHQUFpQnZDLHNCQUFqQiIsImZpbGUiOiJjaGFuZ2UtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzICBsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXJcbiAqIEBwcml2YXRlXG4gKlxuICogVGhpcyBjbGFzcyBsaXN0ZW5zIGZvciBgY2hhbmdlYCBldmVudHMgZnJvbSB0aGUgd2Vic29ja2V0IHNlcnZlcixcbiAqIGFuZCBwcm9jZXNzZXMgdGhlbS5cbiAqL1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4uL21vZGVscy9tZXNzYWdlJyk7XG5jb25zdCBDb252ZXJzYXRpb24gPSByZXF1aXJlKCcuLi9tb2RlbHMvY29udmVyc2F0aW9uJyk7XG5jb25zdCBDaGFubmVsID0gcmVxdWlyZSgnLi4vbW9kZWxzL2NoYW5uZWwnKTtcblxuXG5jbGFzcyBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyB3ZWJzb2NrZXQgY2hhbmdlIG1hbmFnZXJcbiAgICpcbiAgICogICAgICB2YXIgd2Vic29ja2V0Q2hhbmdlTWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogY2xpZW50LldlYnNvY2tldHMuU29ja2V0TWFuYWdlclxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfSBzb2NrZXRNYW5hZ2VyXG4gICAqIEByZXR1cm5zIHtsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXJ9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5jbGllbnQgPSBvcHRpb25zLmNsaWVudDtcbiAgICBvcHRpb25zLnNvY2tldE1hbmFnZXIub24oJ21lc3NhZ2UnLCB0aGlzLl9oYW5kbGVDaGFuZ2UsIHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgYSBDaGFuZ2UgcGFja2V0IGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgX2hhbmRsZUNoYW5nZShldnQpIHtcbiAgICBpZiAoZXZ0LmRhdGEudHlwZSA9PT0gJ2NoYW5nZScpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NDaGFuZ2UoZXZ0LmRhdGEuYm9keSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgY2hhbmdlcyBmcm9tIGEgY2hhbmdlIHBhY2tldC5cbiAgICpcbiAgICogQ2FsbGVkIGJvdGggYnkgX2hhbmRsZUNoYW5nZSwgYW5kIGJ5IHRoZSByZXF1ZXN0TWFuYWdlciBvbiBnZXR0aW5nIGEgY2hhbmdlcyBhcnJheS5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc0NoYW5hZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1zZ1xuICAgKi9cbiAgX3Byb2Nlc3NDaGFuZ2UobXNnKSB7XG4gICAgc3dpdGNoIChtc2cub3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICdjcmVhdGUnOlxuICAgICAgICBsb2dnZXIuaW5mbyhgV2Vic29ja2V0IENoYW5nZSBFdmVudDogQ3JlYXRlICR7bXNnLm9iamVjdC50eXBlfSAke21zZy5vYmplY3QuaWR9YCk7XG4gICAgICAgIGxvZ2dlci5kZWJ1Zyhtc2cuZGF0YSk7XG4gICAgICAgIHRoaXMuX2hhbmRsZUNyZWF0ZShtc2cpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBEZWxldGUgJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH1gKTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgdGhpcy5faGFuZGxlRGVsZXRlKG1zZyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgbG9nZ2VyLmluZm8oYFdlYnNvY2tldCBDaGFuZ2UgRXZlbnQ6IFBhdGNoICR7bXNnLm9iamVjdC50eXBlfSAke21zZy5vYmplY3QuaWR9OiAke21zZy5kYXRhLm1hcChvcCA9PiBvcC5wcm9wZXJ0eSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgdGhpcy5faGFuZGxlUGF0Y2gobXNnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSBjcmVhdGUgb2JqZWN0IG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUNyZWF0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1zZ1xuICAgKi9cbiAgX2hhbmRsZUNyZWF0ZShtc2cpIHtcbiAgICBtc2cuZGF0YS5mcm9tV2Vic29ja2V0ID0gdHJ1ZTtcbiAgICB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KG1zZy5kYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGRlbGV0ZSBvYmplY3QgbWVzc2FnZXMgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBBbGwgb2JqZWN0cyB0aGF0IGNhbiBiZSBkZWxldGVkIGZyb20gdGhlIHNlcnZlciBzaG91bGRcbiAgICogcHJvdmlkZSBhIF9kZWxldGVkKCkgbWV0aG9kIHRvIGJlIGNhbGxlZCBwcmlvciB0byBkZXN0cm95KCkuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZURlbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1zZ1xuICAgKi9cbiAgX2hhbmRsZURlbGV0ZShtc2cpIHtcbiAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmdldE9iamVjdChtc2cpO1xuICAgIGlmIChlbnRpdHkpIHtcbiAgICAgIGVudGl0eS5faGFuZGxlV2Vic29ja2V0RGVsZXRlKG1zZy5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT24gcmVjZWl2aW5nIGFuIHVwZGF0ZS9wYXRjaCBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKiBydW4gdGhlIExheWVyUGFyc2VyIG9uIHRoZSBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVQYXRjaFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG1zZ1xuICAgKi9cbiAgX2hhbmRsZVBhdGNoKG1zZykge1xuICAgIC8vIENhbiBvbmx5IHBhdGNoIGEgY2FjaGVkIG9iamVjdFxuICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZ2V0T2JqZWN0KG1zZyk7XG4gICAgaWYgKGVudGl0eSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZW50aXR5Ll9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcbiAgICAgICAgVXRpbHMubGF5ZXJQYXJzZSh7XG4gICAgICAgICAgb2JqZWN0OiBlbnRpdHksXG4gICAgICAgICAgdHlwZTogbXNnLm9iamVjdC50eXBlLFxuICAgICAgICAgIG9wZXJhdGlvbnM6IG1zZy5kYXRhLFxuICAgICAgICAgIGNsaWVudDogdGhpcy5jbGllbnQsXG4gICAgICAgIH0pO1xuICAgICAgICBlbnRpdHkuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3dlYnNvY2tldC1tYW5hZ2VyOiBGYWlsZWQgdG8gaGFuZGxlIGV2ZW50JywgbXNnLmRhdGEpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2ggKFV0aWxzLnR5cGVGcm9tSUQobXNnLm9iamVjdC5pZCkpIHtcbiAgICAgICAgY2FzZSAnY2hhbm5lbHMnOlxuICAgICAgICAgIGlmIChDaGFubmVsLl9sb2FkUmVzb3VyY2VGb3JQYXRjaChtc2cuZGF0YSkpIHRoaXMuY2xpZW50LmdldE9iamVjdChtc2cub2JqZWN0LmlkLCB0cnVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gICAgICAgICAgaWYgKENvbnZlcnNhdGlvbi5fbG9hZFJlc291cmNlRm9yUGF0Y2gobXNnLmRhdGEpKSB0aGlzLmNsaWVudC5nZXRPYmplY3QobXNnLm9iamVjdC5pZCwgdHJ1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ21lc3NhZ2VzJzpcbiAgICAgICAgICBpZiAoTWVzc2FnZS5fbG9hZFJlc291cmNlRm9yUGF0Y2gobXNnLmRhdGEpKSB0aGlzLmNsaWVudC5nZXRNZXNzYWdlKG1zZy5vYmplY3QuaWQsIHRydWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBvYmplY3Qgc3BlY2lmaWVkIGJ5IHRoZSBgb2JqZWN0YCBwcm9wZXJ0eSBvZiB0aGUgd2Vic29ja2V0IHBhY2tldC5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICogQHJldHVybiB7bGF5ZXIuUm9vdH1cbiAgICovXG4gIGdldE9iamVjdChtc2cpIHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ2V0T2JqZWN0KG1zZy5vYmplY3QuaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vdCByZXF1aXJlZCwgYnV0IGRlc3Ryb3kgaXMgYmVzdCBwcmFjdGljZVxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGllbnQgPSBudWxsO1xuICB9XG59XG5cbi8qKlxuICogVGhlIENsaWVudCB0aGF0IG93bnMgdGhpcy5cbiAqIEB0eXBlIHtsYXllci5DbGllbnR9XG4gKi9cbldlYnNvY2tldENoYW5nZU1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzID0gV2Vic29ja2V0Q2hhbmdlTWFuYWdlcjtcbiJdfQ==
