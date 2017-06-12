'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class layer.Logger
 * @private
 *
 */
var _require$LOG = require('./const').LOG,
    DEBUG = _require$LOG.DEBUG,
    INFO = _require$LOG.INFO,
    WARN = _require$LOG.WARN,
    ERROR = _require$LOG.ERROR,
    NONE = _require$LOG.NONE;

// Pretty arbitrary test that IE/edge fails and others don't.  Yes I could do a more direct
// test for IE/edge but its hoped that MS will fix this around the time they cleanup their internal console object.
// Note that uglifyjs with drop_console=true will throw an error on console.assert.toString().match; so we instead do (console.assert.toString() || "") which drop_console
// on replacing console.assert.toString() with (void 0) will still work


var supportsConsoleFormatting = Boolean(console.assert && (console.assert.toString() || "").match(/assert/));
var LayerCss = 'color: #888; font-weight: bold;';
var Black = 'color: black';
/* istanbulify ignore next */

var Logger = function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, [{
    key: 'log',
    value: function log(msg, obj, type, color) {
      /* istanbul ignore else */
      if ((typeof msg === 'undefined' ? 'undefined' : _typeof(msg)) === 'object') {
        obj = msg;
        msg = '';
      }
      var timestamp = new Date().toLocaleTimeString();
      var op = void 0;
      switch (type) {
        case DEBUG:
          op = 'debug';
          break;
        case INFO:
          op = 'info';
          break;
        case WARN:
          op = 'warn';
          break;
        case ERROR:
          op = 'error';
          break;
        default:
          op = 'log';
      }
      if (obj) {
        if (supportsConsoleFormatting) {
          console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black, obj);
        } else {
          console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg, obj);
        }
      } else if (supportsConsoleFormatting) {
        console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black);
      } else {
        console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg);
      }
    }
  }, {
    key: 'debug',
    value: function debug(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= DEBUG) this.log(msg, obj, DEBUG, '#888');
    }
  }, {
    key: 'info',
    value: function info(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= INFO) this.log(msg, obj, INFO, 'black');
    }
  }, {
    key: 'warn',
    value: function warn(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= WARN) this.log(msg, obj, WARN, 'orange');
    }
  }, {
    key: 'error',
    value: function error(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= ERROR) this.log(msg, obj, ERROR, 'red');
    }
  }]);

  return Logger;
}();

/* istanbul ignore next */


Logger.prototype.level = typeof jasmine === 'undefined' ? ERROR : NONE;

var logger = new Logger();

module.exports = logger;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2dnZXIuanMiXSwibmFtZXMiOlsicmVxdWlyZSIsIkxPRyIsIkRFQlVHIiwiSU5GTyIsIldBUk4iLCJFUlJPUiIsIk5PTkUiLCJzdXBwb3J0c0NvbnNvbGVGb3JtYXR0aW5nIiwiQm9vbGVhbiIsImNvbnNvbGUiLCJhc3NlcnQiLCJ0b1N0cmluZyIsIm1hdGNoIiwiTGF5ZXJDc3MiLCJCbGFjayIsIkxvZ2dlciIsIm1zZyIsIm9iaiIsInR5cGUiLCJjb2xvciIsInRpbWVzdGFtcCIsIkRhdGUiLCJ0b0xvY2FsZVRpbWVTdHJpbmciLCJvcCIsInRvVXBwZXJDYXNlIiwibGV2ZWwiLCJsb2ciLCJwcm90b3R5cGUiLCJqYXNtaW5lIiwibG9nZ2VyIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7Ozs7bUJBSzJDQSxRQUFRLFNBQVIsRUFBbUJDLEc7SUFBdERDLEssZ0JBQUFBLEs7SUFBT0MsSSxnQkFBQUEsSTtJQUFNQyxJLGdCQUFBQSxJO0lBQU1DLEssZ0JBQUFBLEs7SUFBT0MsSSxnQkFBQUEsSTs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7OztBQUNBLElBQU1DLDRCQUE0QkMsUUFBUUMsUUFBUUMsTUFBUixJQUFrQixDQUFDRCxRQUFRQyxNQUFSLENBQWVDLFFBQWYsTUFBNkIsRUFBOUIsRUFBa0NDLEtBQWxDLENBQXdDLFFBQXhDLENBQTFCLENBQWxDO0FBQ0EsSUFBTUMsV0FBVyxpQ0FBakI7QUFDQSxJQUFNQyxRQUFRLGNBQWQ7QUFDQTs7SUFDTUMsTTs7Ozs7Ozt3QkFDQUMsRyxFQUFLQyxHLEVBQUtDLEksRUFBTUMsSyxFQUFPO0FBQ3pCO0FBQ0EsVUFBSSxRQUFPSCxHQUFQLHlDQUFPQSxHQUFQLE9BQWUsUUFBbkIsRUFBNkI7QUFDM0JDLGNBQU1ELEdBQU47QUFDQUEsY0FBTSxFQUFOO0FBQ0Q7QUFDRCxVQUFNSSxZQUFZLElBQUlDLElBQUosR0FBV0Msa0JBQVgsRUFBbEI7QUFDQSxVQUFJQyxXQUFKO0FBQ0EsY0FBUUwsSUFBUjtBQUNFLGFBQUtoQixLQUFMO0FBQ0VxQixlQUFLLE9BQUw7QUFDQTtBQUNGLGFBQUtwQixJQUFMO0FBQ0VvQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtuQixJQUFMO0FBQ0VtQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtsQixLQUFMO0FBQ0VrQixlQUFLLE9BQUw7QUFDQTtBQUNGO0FBQ0VBLGVBQUssS0FBTDtBQWRKO0FBZ0JBLFVBQUlOLEdBQUosRUFBUztBQUNQLFlBQUlWLHlCQUFKLEVBQStCO0FBQzdCRSxrQkFBUWMsRUFBUixpQkFBeUJBLEdBQUdDLFdBQUgsRUFBekIsWUFBZ0RKLFNBQWhELFdBQStESixHQUEvRCxFQUFzRUgsUUFBdEUsY0FBMEZNLEtBQTFGLEVBQW1HTCxLQUFuRyxFQUEwR0csR0FBMUc7QUFDRCxTQUZELE1BRU87QUFDTFIsa0JBQVFjLEVBQVIsYUFBcUJBLEdBQUdDLFdBQUgsRUFBckIsVUFBMENKLFNBQTFDLFdBQXlESixHQUF6RCxFQUFnRUMsR0FBaEU7QUFDRDtBQUNGLE9BTkQsTUFNTyxJQUFJVix5QkFBSixFQUErQjtBQUNwQ0UsZ0JBQVFjLEVBQVIsaUJBQXlCQSxHQUFHQyxXQUFILEVBQXpCLFlBQWdESixTQUFoRCxXQUErREosR0FBL0QsRUFBc0VILFFBQXRFLGNBQTBGTSxLQUExRixFQUFtR0wsS0FBbkc7QUFDRCxPQUZNLE1BRUE7QUFDTEwsZ0JBQVFjLEVBQVIsYUFBcUJBLEdBQUdDLFdBQUgsRUFBckIsVUFBMENKLFNBQTFDLFdBQXlESixHQUF6RDtBQUNEO0FBQ0Y7OzswQkFHS0EsRyxFQUFLQyxHLEVBQUs7QUFDZDtBQUNBLFVBQUksS0FBS1EsS0FBTCxJQUFjdkIsS0FBbEIsRUFBeUIsS0FBS3dCLEdBQUwsQ0FBU1YsR0FBVCxFQUFjQyxHQUFkLEVBQW1CZixLQUFuQixFQUEwQixNQUExQjtBQUMxQjs7O3lCQUVJYyxHLEVBQUtDLEcsRUFBSztBQUNiO0FBQ0EsVUFBSSxLQUFLUSxLQUFMLElBQWN0QixJQUFsQixFQUF3QixLQUFLdUIsR0FBTCxDQUFTVixHQUFULEVBQWNDLEdBQWQsRUFBbUJkLElBQW5CLEVBQXlCLE9BQXpCO0FBQ3pCOzs7eUJBRUlhLEcsRUFBS0MsRyxFQUFLO0FBQ2I7QUFDQSxVQUFJLEtBQUtRLEtBQUwsSUFBY3JCLElBQWxCLEVBQXdCLEtBQUtzQixHQUFMLENBQVNWLEdBQVQsRUFBY0MsR0FBZCxFQUFtQmIsSUFBbkIsRUFBeUIsUUFBekI7QUFDekI7OzswQkFFS1ksRyxFQUFLQyxHLEVBQUs7QUFDZDtBQUNBLFVBQUksS0FBS1EsS0FBTCxJQUFjcEIsS0FBbEIsRUFBeUIsS0FBS3FCLEdBQUwsQ0FBU1YsR0FBVCxFQUFjQyxHQUFkLEVBQW1CWixLQUFuQixFQUEwQixLQUExQjtBQUMxQjs7Ozs7O0FBR0g7OztBQUNBVSxPQUFPWSxTQUFQLENBQWlCRixLQUFqQixHQUF5QixPQUFPRyxPQUFQLEtBQW1CLFdBQW5CLEdBQWlDdkIsS0FBakMsR0FBeUNDLElBQWxFOztBQUVBLElBQU11QixTQUFTLElBQUlkLE1BQUosRUFBZjs7QUFFQWUsT0FBT0MsT0FBUCxHQUFpQkYsTUFBakIiLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgbGF5ZXIuTG9nZ2VyXG4gKiBAcHJpdmF0ZVxuICpcbiAqL1xuY29uc3QgeyBERUJVRywgSU5GTywgV0FSTiwgRVJST1IsIE5PTkUgfSA9IHJlcXVpcmUoJy4vY29uc3QnKS5MT0c7XG5cbi8vIFByZXR0eSBhcmJpdHJhcnkgdGVzdCB0aGF0IElFL2VkZ2UgZmFpbHMgYW5kIG90aGVycyBkb24ndC4gIFllcyBJIGNvdWxkIGRvIGEgbW9yZSBkaXJlY3Rcbi8vIHRlc3QgZm9yIElFL2VkZ2UgYnV0IGl0cyBob3BlZCB0aGF0IE1TIHdpbGwgZml4IHRoaXMgYXJvdW5kIHRoZSB0aW1lIHRoZXkgY2xlYW51cCB0aGVpciBpbnRlcm5hbCBjb25zb2xlIG9iamVjdC5cbi8vIE5vdGUgdGhhdCB1Z2xpZnlqcyB3aXRoIGRyb3BfY29uc29sZT10cnVlIHdpbGwgdGhyb3cgYW4gZXJyb3Igb24gY29uc29sZS5hc3NlcnQudG9TdHJpbmcoKS5tYXRjaDsgc28gd2UgaW5zdGVhZCBkbyAoY29uc29sZS5hc3NlcnQudG9TdHJpbmcoKSB8fCBcIlwiKSB3aGljaCBkcm9wX2NvbnNvbGVcbi8vIG9uIHJlcGxhY2luZyBjb25zb2xlLmFzc2VydC50b1N0cmluZygpIHdpdGggKHZvaWQgMCkgd2lsbCBzdGlsbCB3b3JrXG5jb25zdCBzdXBwb3J0c0NvbnNvbGVGb3JtYXR0aW5nID0gQm9vbGVhbihjb25zb2xlLmFzc2VydCAmJiAoY29uc29sZS5hc3NlcnQudG9TdHJpbmcoKSB8fCBcIlwiKS5tYXRjaCgvYXNzZXJ0LykpO1xuY29uc3QgTGF5ZXJDc3MgPSAnY29sb3I6ICM4ODg7IGZvbnQtd2VpZ2h0OiBib2xkOyc7XG5jb25zdCBCbGFjayA9ICdjb2xvcjogYmxhY2snO1xuLyogaXN0YW5idWxpZnkgaWdub3JlIG5leHQgKi9cbmNsYXNzIExvZ2dlciB7XG4gIGxvZyhtc2csIG9iaiwgdHlwZSwgY29sb3IpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICh0eXBlb2YgbXNnID09PSAnb2JqZWN0Jykge1xuICAgICAgb2JqID0gbXNnO1xuICAgICAgbXNnID0gJyc7XG4gICAgfVxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9Mb2NhbGVUaW1lU3RyaW5nKCk7XG4gICAgbGV0IG9wO1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSBERUJVRzpcbiAgICAgICAgb3AgPSAnZGVidWcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgSU5GTzpcbiAgICAgICAgb3AgPSAnaW5mbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBXQVJOOlxuICAgICAgICBvcCA9ICd3YXJuJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVSUk9SOlxuICAgICAgICBvcCA9ICdlcnJvcic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgb3AgPSAnbG9nJztcbiAgICB9XG4gICAgaWYgKG9iaikge1xuICAgICAgaWYgKHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcpIHtcbiAgICAgICAgY29uc29sZVtvcF0oYCVjTGF5ZXIlYyAke29wLnRvVXBwZXJDYXNlKCl9JWMgWyR7dGltZXN0YW1wfV06ICR7bXNnfWAsIExheWVyQ3NzLCBgY29sb3I6ICR7Y29sb3J9YCwgQmxhY2ssIG9iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlW29wXShgTGF5ZXIgJHtvcC50b1VwcGVyQ2FzZSgpfSBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcpIHtcbiAgICAgIGNvbnNvbGVbb3BdKGAlY0xheWVyJWMgJHtvcC50b1VwcGVyQ2FzZSgpfSVjIFske3RpbWVzdGFtcH1dOiAke21zZ31gLCBMYXllckNzcywgYGNvbG9yOiAke2NvbG9yfWAsIEJsYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZVtvcF0oYExheWVyICR7b3AudG9VcHBlckNhc2UoKX0gWyR7dGltZXN0YW1wfV06ICR7bXNnfWApO1xuICAgIH1cbiAgfVxuXG5cbiAgZGVidWcobXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IERFQlVHKSB0aGlzLmxvZyhtc2csIG9iaiwgREVCVUcsICcjODg4Jyk7XG4gIH1cblxuICBpbmZvKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBJTkZPKSB0aGlzLmxvZyhtc2csIG9iaiwgSU5GTywgJ2JsYWNrJyk7XG4gIH1cblxuICB3YXJuKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBXQVJOKSB0aGlzLmxvZyhtc2csIG9iaiwgV0FSTiwgJ29yYW5nZScpO1xuICB9XG5cbiAgZXJyb3IobXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IEVSUk9SKSB0aGlzLmxvZyhtc2csIG9iaiwgRVJST1IsICdyZWQnKTtcbiAgfVxufVxuXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuTG9nZ2VyLnByb3RvdHlwZS5sZXZlbCA9IHR5cGVvZiBqYXNtaW5lID09PSAndW5kZWZpbmVkJyA/IEVSUk9SIDogTk9ORTtcblxuY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxvZ2dlcjtcbiJdfQ==
