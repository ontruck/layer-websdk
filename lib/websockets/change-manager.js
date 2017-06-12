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
        var msg = evt.data.body;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsImxvZ2dlciIsIk1lc3NhZ2UiLCJDb252ZXJzYXRpb24iLCJDaGFubmVsIiwiV2Vic29ja2V0Q2hhbmdlTWFuYWdlciIsIm9wdGlvbnMiLCJjbGllbnQiLCJzb2NrZXRNYW5hZ2VyIiwib24iLCJfaGFuZGxlQ2hhbmdlIiwiZXZ0IiwiZGF0YSIsInR5cGUiLCJtc2ciLCJib2R5Iiwib3BlcmF0aW9uIiwiaW5mbyIsIm9iamVjdCIsImlkIiwiZGVidWciLCJfaGFuZGxlQ3JlYXRlIiwiX2hhbmRsZURlbGV0ZSIsIm1hcCIsIm9wIiwicHJvcGVydHkiLCJqb2luIiwiX2hhbmRsZVBhdGNoIiwiZnJvbVdlYnNvY2tldCIsIl9jcmVhdGVPYmplY3QiLCJlbnRpdHkiLCJnZXRPYmplY3QiLCJfaGFuZGxlV2Vic29ja2V0RGVsZXRlIiwiX2luTGF5ZXJQYXJzZXIiLCJsYXllclBhcnNlIiwib3BlcmF0aW9ucyIsImVyciIsImVycm9yIiwidHlwZUZyb21JRCIsIl9sb2FkUmVzb3VyY2VGb3JQYXRjaCIsImdldE1lc3NhZ2UiLCJwcm90b3R5cGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7OztBQU9BLElBQU1BLFFBQVFDLFFBQVEsaUJBQVIsQ0FBZDtBQUNBLElBQU1DLFNBQVNELFFBQVEsV0FBUixDQUFmO0FBQ0EsSUFBTUUsVUFBVUYsUUFBUSxtQkFBUixDQUFoQjtBQUNBLElBQU1HLGVBQWVILFFBQVEsd0JBQVIsQ0FBckI7QUFDQSxJQUFNSSxVQUFVSixRQUFRLG1CQUFSLENBQWhCOztJQUdNSyxzQjtBQUNKOzs7Ozs7Ozs7Ozs7OztBQWNBLGtDQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFNBQUtDLE1BQUwsR0FBY0QsUUFBUUMsTUFBdEI7QUFDQUQsWUFBUUUsYUFBUixDQUFzQkMsRUFB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akIsSUFBSUksTUFBSixDQUFXQyxFQUFqQyxFQUFxQyxJQUFyQztBQUNsRDtBQUNGLGVBQUssVUFBTDtBQUNFLGdCQUFJakIsUUFBUXFDLHFCQUFSLENBQThCekIsSUFBSUYsSUFBbEMsQ0FBSixFQUE2QyxLQUFLTCxNQUFMLENBQVlpQyxVQUFaLENBQXVCMUIsSUFBSUksTUFBSixDQUFXQyxFQUFsQyxFQUFzQyxJQUF0QztBQUM3QztBQUNGLGVBQUssZUFBTDtBQUNFO0FBWEo7QUFhRDtBQUNGOztBQUVEOzs7Ozs7Ozs7Ozs4QkFRVUwsRyxFQUFLO0FBQ2IsYUFBTyxLQUFLUCxNQUFMLENBQVl3QixTQUFaLENBQXNCakIsSUFBSUksTUFBSixDQUFXQyxFQUFqQyxDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OEJBSVU7QUFDUixXQUFLWixNQUFMLEdBQWMsSUFBZDtBQUNEOzs7Ozs7QUFHSDs7Ozs7O0FBSUFGLHVCQUF1Qm9DLFNBQXZCLENBQWlDbEMsTUFBakMsR0FBMEMsSUFBMUM7O0FBRUFtQyxPQUFPQyxPQUFQLEdBQWlCdEMsc0JBQWpCIiwiZmlsZSI6ImNoYW5nZS1tYW5hZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgIGxheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlclxuICogQHByaXZhdGVcbiAqXG4gKiBUaGlzIGNsYXNzIGxpc3RlbnMgZm9yIGBjaGFuZ2VgIGV2ZW50cyBmcm9tIHRoZSB3ZWJzb2NrZXQgc2VydmVyLFxuICogYW5kIHByb2Nlc3NlcyB0aGVtLlxuICovXG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5jb25zdCBNZXNzYWdlID0gcmVxdWlyZSgnLi4vbW9kZWxzL21lc3NhZ2UnKTtcbmNvbnN0IENvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4uL21vZGVscy9jb252ZXJzYXRpb24nKTtcbmNvbnN0IENoYW5uZWwgPSByZXF1aXJlKCcuLi9tb2RlbHMvY2hhbm5lbCcpO1xuXG5cbmNsYXNzIFdlYnNvY2tldENoYW5nZU1hbmFnZXIge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHdlYnNvY2tldCBjaGFuZ2UgbWFuYWdlclxuICAgKlxuICAgKiAgICAgIHZhciB3ZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBjbGllbnQuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9IHNvY2tldE1hbmFnZXJcbiAgICogQHJldHVybnMge2xheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcn1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLmNsaWVudCA9IG9wdGlvbnMuY2xpZW50O1xuICAgIG9wdGlvbnMuc29ja2V0TWFuYWdlci5vbignbWVzc2FnZScsIHRoaXMuX2hhbmRsZUNoYW5nZSwgdGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBhIENoYW5nZSBwYWNrZXQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlQ2hhbmdlKGV2dCkge1xuICAgIGlmIChldnQuZGF0YS50eXBlID09PSAnY2hhbmdlJykge1xuICAgICAgY29uc3QgbXNnID0gZXZ0LmRhdGEuYm9keTtcbiAgICAgIHN3aXRjaCAobXNnLm9wZXJhdGlvbikge1xuICAgICAgICBjYXNlICdjcmVhdGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBDcmVhdGUgJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH1gKTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcobXNnLmRhdGEpO1xuICAgICAgICAgIHRoaXMuX2hhbmRsZUNyZWF0ZShtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBEZWxldGUgJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH1gKTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcobXNnLmRhdGEpO1xuICAgICAgICAgIHRoaXMuX2hhbmRsZURlbGV0ZShtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBQYXRjaCAke21zZy5vYmplY3QudHlwZX0gJHttc2cub2JqZWN0LmlkfTogJHttc2cuZGF0YS5tYXAob3AgPT4gb3AucHJvcGVydHkpLmpvaW4oJywgJyl9YCk7XG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgICB0aGlzLl9oYW5kbGVQYXRjaChtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgY3JlYXRlIG9iamVjdCBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVDcmVhdGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICovXG4gIF9oYW5kbGVDcmVhdGUobXNnKSB7XG4gICAgbXNnLmRhdGEuZnJvbVdlYnNvY2tldCA9IHRydWU7XG4gICAgdGhpcy5jbGllbnQuX2NyZWF0ZU9iamVjdChtc2cuZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBkZWxldGUgb2JqZWN0IG1lc3NhZ2VzIGZyb20gdGhlIHNlcnZlci5cbiAgICogQWxsIG9iamVjdHMgdGhhdCBjYW4gYmUgZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIgc2hvdWxkXG4gICAqIHByb3ZpZGUgYSBfZGVsZXRlZCgpIG1ldGhvZCB0byBiZSBjYWxsZWQgcHJpb3IgdG8gZGVzdHJveSgpLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVEZWxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICovXG4gIF9oYW5kbGVEZWxldGUobXNnKSB7XG4gICAgY29uc3QgZW50aXR5ID0gdGhpcy5nZXRPYmplY3QobXNnKTtcbiAgICBpZiAoZW50aXR5KSB7XG4gICAgICBlbnRpdHkuX2hhbmRsZVdlYnNvY2tldERlbGV0ZShtc2cuZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9uIHJlY2VpdmluZyBhbiB1cGRhdGUvcGF0Y2ggbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXJcbiAgICogcnVuIHRoZSBMYXllclBhcnNlciBvbiB0aGUgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUGF0Y2hcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICovXG4gIF9oYW5kbGVQYXRjaChtc2cpIHtcbiAgICAvLyBDYW4gb25seSBwYXRjaCBhIGNhY2hlZCBvYmplY3RcbiAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmdldE9iamVjdChtc2cpO1xuICAgIGlmIChlbnRpdHkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGVudGl0eS5faW5MYXllclBhcnNlciA9IHRydWU7XG4gICAgICAgIFV0aWxzLmxheWVyUGFyc2Uoe1xuICAgICAgICAgIG9iamVjdDogZW50aXR5LFxuICAgICAgICAgIHR5cGU6IG1zZy5vYmplY3QudHlwZSxcbiAgICAgICAgICBvcGVyYXRpb25zOiBtc2cuZGF0YSxcbiAgICAgICAgICBjbGllbnQ6IHRoaXMuY2xpZW50LFxuICAgICAgICB9KTtcbiAgICAgICAgZW50aXR5Ll9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCd3ZWJzb2NrZXQtbWFuYWdlcjogRmFpbGVkIHRvIGhhbmRsZSBldmVudCcsIG1zZy5kYXRhKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoIChVdGlscy50eXBlRnJvbUlEKG1zZy5vYmplY3QuaWQpKSB7XG4gICAgICAgIGNhc2UgJ2NoYW5uZWxzJzpcbiAgICAgICAgICBpZiAoQ2hhbm5lbC5fbG9hZFJlc291cmNlRm9yUGF0Y2gobXNnLmRhdGEpKSB0aGlzLmNsaWVudC5nZXRPYmplY3QobXNnLm9iamVjdC5pZCwgdHJ1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICAgIGlmIChDb252ZXJzYXRpb24uX2xvYWRSZXNvdXJjZUZvclBhdGNoKG1zZy5kYXRhKSkgdGhpcy5jbGllbnQuZ2V0T2JqZWN0KG1zZy5vYmplY3QuaWQsIHRydWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICAgICAgaWYgKE1lc3NhZ2UuX2xvYWRSZXNvdXJjZUZvclBhdGNoKG1zZy5kYXRhKSkgdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtc2cub2JqZWN0LmlkLCB0cnVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYW5ub3VuY2VtZW50cyc6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgb2JqZWN0IHNwZWNpZmllZCBieSB0aGUgYG9iamVjdGAgcHJvcGVydHkgb2YgdGhlIHdlYnNvY2tldCBwYWNrZXQuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0T2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbXNnXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9XG4gICAqL1xuICBnZXRPYmplY3QobXNnKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmdldE9iamVjdChtc2cub2JqZWN0LmlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3QgcmVxdWlyZWQsIGJ1dCBkZXN0cm95IGlzIGJlc3QgcHJhY3RpY2VcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuY2xpZW50ID0gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBDbGllbnQgdGhhdCBvd25zIHRoaXMuXG4gKiBAdHlwZSB7bGF5ZXIuQ2xpZW50fVxuICovXG5XZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyLnByb3RvdHlwZS5jbGllbnQgPSBudWxsO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYnNvY2tldENoYW5nZU1hbmFnZXI7XG4iXX0=
