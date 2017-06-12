'use strict';

/**
 * Run the Layer Parser on the request.
 *
 * Parameters here
 * are the parameters specied in [Layer-Patch](https://github.com/layerhq/node-layer-patch), plus
 * a client object.
 *
 *      layerParse({
 *          object: conversation,
 *          type: 'Conversation',
 *          operations: layerPatchOperations,
 *          client: client
 *      });
 *
 * @method
 * @param {Object} request - layer-patch parameters
 * @param {Object} request.object - Object being updated  by the operations
 * @param {string} request.type - Type of object being updated
 * @param {Object[]} request.operations - Array of change operations to perform upon the object
 * @param {layer.Client} request.client
 */
var LayerParser = require('layer-patch');

var parser = void 0;

/**
 * Creates a LayerParser
 *
 * @method
 * @private
 * @param {Object} request - see layer.ClientUtils.layerParse
 */
function createParser(request) {
  request.client.once('destroy', function () {
    return parser = null;
  });

  parser = new LayerParser({
    camelCase: true,
    getObjectCallback: function getObjectCallback(id) {
      return request.client.getObject(id);
    },
    createObjectCallback: function createObjectCallback(id, obj) {
      return request.client._createObject(obj);
    },
    propertyNameMap: {
      Conversation: {
        unreadMessageCount: 'unreadCount'
      },
      Identity: {
        presence: '_presence'
      }
    },
    changeCallbacks: {
      Message: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Conversation: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Channel: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Identity: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      }
    }
  });
}

// Docs in client-utils.js
module.exports = function (request) {
  if (!parser) createParser(request);
  parser.parse(request);
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9sYXllci1wYXJzZXIuanMiXSwibmFtZXMiOlsiTGF5ZXJQYXJzZXIiLCJyZXF1aXJlIiwicGFyc2VyIiwiY3JlYXRlUGFyc2VyIiwicmVxdWVzdCIsImNsaWVudCIsIm9uY2UiLCJjYW1lbENhc2UiLCJnZXRPYmplY3RDYWxsYmFjayIsImdldE9iamVjdCIsImlkIiwiY3JlYXRlT2JqZWN0Q2FsbGJhY2siLCJvYmoiLCJfY3JlYXRlT2JqZWN0IiwicHJvcGVydHlOYW1lTWFwIiwiQ29udmVyc2F0aW9uIiwidW5yZWFkTWVzc2FnZUNvdW50IiwiSWRlbnRpdHkiLCJwcmVzZW5jZSIsImNoYW5nZUNhbGxiYWNrcyIsIk1lc3NhZ2UiLCJhbGwiLCJ1cGRhdGVPYmplY3QiLCJuZXdWYWx1ZSIsIm9sZFZhbHVlIiwicGF0aHMiLCJfaGFuZGxlUGF0Y2hFdmVudCIsIkNoYW5uZWwiLCJtb2R1bGUiLCJleHBvcnRzIiwicGFyc2UiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxJQUFNQSxjQUFjQyxRQUFRLGFBQVIsQ0FBcEI7O0FBRUEsSUFBSUMsZUFBSjs7QUFFQTs7Ozs7OztBQU9BLFNBQVNDLFlBQVQsQ0FBc0JDLE9BQXRCLEVBQStCO0FBQzdCQSxVQUFRQyxNQUFSLENBQWVDLElBQWYsQ0FBb0IsU0FBcEIsRUFBK0I7QUFBQSxXQUFPSixTQUFTLElBQWhCO0FBQUEsR0FBL0I7O0FBRUFBLFdBQVMsSUFBSUYsV0FBSixDQUFnQjtBQUN2Qk8sZUFBVyxJQURZO0FBRXZCQyx1QkFBbUI7QUFBQSxhQUFNSixRQUFRQyxNQUFSLENBQWVJLFNBQWYsQ0FBeUJDLEVBQXpCLENBQU47QUFBQSxLQUZJO0FBR3ZCQywwQkFBc0IsOEJBQUNELEVBQUQsRUFBS0UsR0FBTDtBQUFBLGFBQWFSLFFBQVFDLE1BQVIsQ0FBZVEsYUFBZixDQUE2QkQsR0FBN0IsQ0FBYjtBQUFBLEtBSEM7QUFJdkJFLHFCQUFpQjtBQUNmQyxvQkFBYztBQUNaQyw0QkFBb0I7QUFEUixPQURDO0FBSWZDLGdCQUFVO0FBQ1JDLGtCQUFVO0FBREY7QUFKSyxLQUpNO0FBWXZCQyxxQkFBaUI7QUFDZkMsZUFBUztBQUNQQyxhQUFLLGFBQUNDLFlBQUQsRUFBZUMsUUFBZixFQUF5QkMsUUFBekIsRUFBbUNDLEtBQW5DLEVBQTZDO0FBQ2hESCx1QkFBYUksaUJBQWIsQ0FBK0JILFFBQS9CLEVBQXlDQyxRQUF6QyxFQUFtREMsS0FBbkQ7QUFDRDtBQUhNLE9BRE07QUFNZlYsb0JBQWM7QUFDWk0sYUFBSyxhQUFDQyxZQUFELEVBQWVDLFFBQWYsRUFBeUJDLFFBQXpCLEVBQW1DQyxLQUFuQyxFQUE2QztBQUNoREgsdUJBQWFJLGlCQUFiLENBQStCSCxRQUEvQixFQUF5Q0MsUUFBekMsRUFBbURDLEtBQW5EO0FBQ0Q7QUFIVyxPQU5DO0FBV2ZFLGVBQVM7QUFDUE4sYUFBSyxhQUFDQyxZQUFELEVBQWVDLFFBQWYsRUFBeUJDLFFBQXpCLEVBQW1DQyxLQUFuQyxFQUE2QztBQUNoREgsdUJBQWFJLGlCQUFiLENBQStCSCxRQUEvQixFQUF5Q0MsUUFBekMsRUFBbURDLEtBQW5EO0FBQ0Q7QUFITSxPQVhNO0FBZ0JmUixnQkFBVTtBQUNSSSxhQUFLLGFBQUNDLFlBQUQsRUFBZUMsUUFBZixFQUF5QkMsUUFBekIsRUFBbUNDLEtBQW5DLEVBQTZDO0FBQ2hESCx1QkFBYUksaUJBQWIsQ0FBK0JILFFBQS9CLEVBQXlDQyxRQUF6QyxFQUFtREMsS0FBbkQ7QUFDRDtBQUhPO0FBaEJLO0FBWk0sR0FBaEIsQ0FBVDtBQW1DRDs7QUFFRDtBQUNBRyxPQUFPQyxPQUFQLEdBQWlCLFVBQUN6QixPQUFELEVBQWE7QUFDNUIsTUFBSSxDQUFDRixNQUFMLEVBQWFDLGFBQWFDLE9BQWI7QUFDYkYsU0FBTzRCLEtBQVAsQ0FBYTFCLE9BQWI7QUFDRCxDQUhEIiwiZmlsZSI6ImxheWVyLXBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUnVuIHRoZSBMYXllciBQYXJzZXIgb24gdGhlIHJlcXVlc3QuXG4gKlxuICogUGFyYW1ldGVycyBoZXJlXG4gKiBhcmUgdGhlIHBhcmFtZXRlcnMgc3BlY2llZCBpbiBbTGF5ZXItUGF0Y2hdKGh0dHBzOi8vZ2l0aHViLmNvbS9sYXllcmhxL25vZGUtbGF5ZXItcGF0Y2gpLCBwbHVzXG4gKiBhIGNsaWVudCBvYmplY3QuXG4gKlxuICogICAgICBsYXllclBhcnNlKHtcbiAqICAgICAgICAgIG9iamVjdDogY29udmVyc2F0aW9uLFxuICogICAgICAgICAgdHlwZTogJ0NvbnZlcnNhdGlvbicsXG4gKiAgICAgICAgICBvcGVyYXRpb25zOiBsYXllclBhdGNoT3BlcmF0aW9ucyxcbiAqICAgICAgICAgIGNsaWVudDogY2xpZW50XG4gKiAgICAgIH0pO1xuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0IC0gbGF5ZXItcGF0Y2ggcGFyYW1ldGVyc1xuICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3Qub2JqZWN0IC0gT2JqZWN0IGJlaW5nIHVwZGF0ZWQgIGJ5IHRoZSBvcGVyYXRpb25zXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdC50eXBlIC0gVHlwZSBvZiBvYmplY3QgYmVpbmcgdXBkYXRlZFxuICogQHBhcmFtIHtPYmplY3RbXX0gcmVxdWVzdC5vcGVyYXRpb25zIC0gQXJyYXkgb2YgY2hhbmdlIG9wZXJhdGlvbnMgdG8gcGVyZm9ybSB1cG9uIHRoZSBvYmplY3RcbiAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSByZXF1ZXN0LmNsaWVudFxuICovXG5jb25zdCBMYXllclBhcnNlciA9IHJlcXVpcmUoJ2xheWVyLXBhdGNoJyk7XG5cbmxldCBwYXJzZXI7XG5cbi8qKlxuICogQ3JlYXRlcyBhIExheWVyUGFyc2VyXG4gKlxuICogQG1ldGhvZFxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0IC0gc2VlIGxheWVyLkNsaWVudFV0aWxzLmxheWVyUGFyc2VcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFyc2VyKHJlcXVlc3QpIHtcbiAgcmVxdWVzdC5jbGllbnQub25jZSgnZGVzdHJveScsICgpID0+IChwYXJzZXIgPSBudWxsKSk7XG5cbiAgcGFyc2VyID0gbmV3IExheWVyUGFyc2VyKHtcbiAgICBjYW1lbENhc2U6IHRydWUsXG4gICAgZ2V0T2JqZWN0Q2FsbGJhY2s6IGlkID0+IHJlcXVlc3QuY2xpZW50LmdldE9iamVjdChpZCksXG4gICAgY3JlYXRlT2JqZWN0Q2FsbGJhY2s6IChpZCwgb2JqKSA9PiByZXF1ZXN0LmNsaWVudC5fY3JlYXRlT2JqZWN0KG9iaiksXG4gICAgcHJvcGVydHlOYW1lTWFwOiB7XG4gICAgICBDb252ZXJzYXRpb246IHtcbiAgICAgICAgdW5yZWFkTWVzc2FnZUNvdW50OiAndW5yZWFkQ291bnQnLFxuICAgICAgfSxcbiAgICAgIElkZW50aXR5OiB7XG4gICAgICAgIHByZXNlbmNlOiAnX3ByZXNlbmNlJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjaGFuZ2VDYWxsYmFja3M6IHtcbiAgICAgIE1lc3NhZ2U6IHtcbiAgICAgICAgYWxsOiAodXBkYXRlT2JqZWN0LCBuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSA9PiB7XG4gICAgICAgICAgdXBkYXRlT2JqZWN0Ll9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIENvbnZlcnNhdGlvbjoge1xuICAgICAgICBhbGw6ICh1cGRhdGVPYmplY3QsIG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpID0+IHtcbiAgICAgICAgICB1cGRhdGVPYmplY3QuX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgQ2hhbm5lbDoge1xuICAgICAgICBhbGw6ICh1cGRhdGVPYmplY3QsIG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpID0+IHtcbiAgICAgICAgICB1cGRhdGVPYmplY3QuX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgSWRlbnRpdHk6IHtcbiAgICAgICAgYWxsOiAodXBkYXRlT2JqZWN0LCBuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSA9PiB7XG4gICAgICAgICAgdXBkYXRlT2JqZWN0Ll9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn1cblxuLy8gRG9jcyBpbiBjbGllbnQtdXRpbHMuanNcbm1vZHVsZS5leHBvcnRzID0gKHJlcXVlc3QpID0+IHtcbiAgaWYgKCFwYXJzZXIpIGNyZWF0ZVBhcnNlcihyZXF1ZXN0KTtcbiAgcGFyc2VyLnBhcnNlKHJlcXVlc3QpO1xufTtcbiJdfQ==
