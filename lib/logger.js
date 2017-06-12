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


var supportsConsoleFormatting = Boolean(console.assert && console.assert.toString().match(/assert/));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2dnZXIuanMiXSwibmFtZXMiOlsicmVxdWlyZSIsIkxPRyIsIkRFQlVHIiwiSU5GTyIsIldBUk4iLCJFUlJPUiIsIk5PTkUiLCJzdXBwb3J0c0NvbnNvbGVGb3JtYXR0aW5nIiwiQm9vbGVhbiIsImNvbnNvbGUiLCJhc3NlcnQiLCJ0b1N0cmluZyIsIm1hdGNoIiwiTGF5ZXJDc3MiLCJCbGFjayIsIkxvZ2dlciIsIm1zZyIsIm9iaiIsInR5cGUiLCJjb2xvciIsInRpbWVzdGFtcCIsIkRhdGUiLCJ0b0xvY2FsZVRpbWVTdHJpbmciLCJvcCIsInRvVXBwZXJDYXNlIiwibGV2ZWwiLCJsb2ciLCJwcm90b3R5cGUiLCJqYXNtaW5lIiwibG9nZ2VyIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7Ozs7bUJBSzJDQSxRQUFRLFNBQVIsRUFBbUJDLEc7SUFBdERDLEssZ0JBQUFBLEs7SUFBT0MsSSxnQkFBQUEsSTtJQUFNQyxJLGdCQUFBQSxJO0lBQU1DLEssZ0JBQUFBLEs7SUFBT0MsSSxnQkFBQUEsSTs7QUFFbEM7QUFDQTs7O0FBQ0EsSUFBTUMsNEJBQTRCQyxRQUFRQyxRQUFRQyxNQUFSLElBQWtCRCxRQUFRQyxNQUFSLENBQWVDLFFBQWYsR0FBMEJDLEtBQTFCLENBQWdDLFFBQWhDLENBQTFCLENBQWxDO0FBQ0EsSUFBTUMsV0FBVyxpQ0FBakI7QUFDQSxJQUFNQyxRQUFRLGNBQWQ7QUFDQTs7SUFDTUMsTTs7Ozs7Ozt3QkFDQUMsRyxFQUFLQyxHLEVBQUtDLEksRUFBTUMsSyxFQUFPO0FBQ3pCO0FBQ0EsVUFBSSxRQUFPSCxHQUFQLHlDQUFPQSxHQUFQLE9BQWUsUUFBbkIsRUFBNkI7QUFDM0JDLGNBQU1ELEdBQU47QUFDQUEsY0FBTSxFQUFOO0FBQ0Q7QUFDRCxVQUFNSSxZQUFZLElBQUlDLElBQUosR0FBV0Msa0JBQVgsRUFBbEI7QUFDQSxVQUFJQyxXQUFKO0FBQ0EsY0FBUUwsSUFBUjtBQUNFLGFBQUtoQixLQUFMO0FBQ0VxQixlQUFLLE9BQUw7QUFDQTtBQUNGLGFBQUtwQixJQUFMO0FBQ0VvQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtuQixJQUFMO0FBQ0VtQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtsQixLQUFMO0FBQ0VrQixlQUFLLE9BQUw7QUFDQTtBQUNGO0FBQ0VBLGVBQUssS0FBTDtBQWRKO0FBZ0JBLFVBQUlOLEdBQUosRUFBUztBQUNQLFlBQUlWLHlCQUFKLEVBQStCO0FBQzdCRSxrQkFBUWMsRUFBUixpQkFBeUJBLEdBQUdDLFdBQUgsRUFBekIsWUFBZ0RKLFNBQWhELFdBQStESixHQUEvRCxFQUFzRUgsUUFBdEUsY0FBMEZNLEtBQTFGLEVBQW1HTCxLQUFuRyxFQUEwR0csR0FBMUc7QUFDRCxTQUZELE1BRU87QUFDTFIsa0JBQVFjLEVBQVIsYUFBcUJBLEdBQUdDLFdBQUgsRUFBckIsVUFBMENKLFNBQTFDLFdBQXlESixHQUF6RCxFQUFnRUMsR0FBaEU7QUFDRDtBQUNGLE9BTkQsTUFNTyxJQUFJVix5QkFBSixFQUErQjtBQUNwQ0UsZ0JBQVFjLEVBQVIsaUJBQXlCQSxHQUFHQyxXQUFILEVBQXpCLFlBQWdESixTQUFoRCxXQUErREosR0FBL0QsRUFBc0VILFFBQXRFLGNBQTBGTSxLQUExRixFQUFtR0wsS0FBbkc7QUFDRCxPQUZNLE1BRUE7QUFDTEwsZ0JBQVFjLEVBQVIsYUFBcUJBLEdBQUdDLFdBQUgsRUFBckIsVUFBMENKLFNBQTFDLFdBQXlESixHQUF6RDtBQUNEO0FBQ0Y7OzswQkFHS0EsRyxFQUFLQyxHLEVBQUs7QUFDZDtBQUNBLFVBQUksS0FBS1EsS0FBTCxJQUFjdkIsS0FBbEIsRUFBeUIsS0FBS3dCLEdBQUwsQ0FBU1YsR0FBVCxFQUFjQyxHQUFkLEVBQW1CZixLQUFuQixFQUEwQixNQUExQjtBQUMxQjs7O3lCQUVJYyxHLEVBQUtDLEcsRUFBSztBQUNiO0FBQ0EsVUFBSSxLQUFLUSxLQUFMLElBQWN0QixJQUFsQixFQUF3QixLQUFLdUIsR0FBTCxDQUFTVixHQUFULEVBQWNDLEdBQWQsRUFBbUJkLElBQW5CLEVBQXlCLE9BQXpCO0FBQ3pCOzs7eUJBRUlhLEcsRUFBS0MsRyxFQUFLO0FBQ2I7QUFDQSxVQUFJLEtBQUtRLEtBQUwsSUFBY3JCLElBQWxCLEVBQXdCLEtBQUtzQixHQUFMLENBQVNWLEdBQVQsRUFBY0MsR0FBZCxFQUFtQmIsSUFBbkIsRUFBeUIsUUFBekI7QUFDekI7OzswQkFFS1ksRyxFQUFLQyxHLEVBQUs7QUFDZDtBQUNBLFVBQUksS0FBS1EsS0FBTCxJQUFjcEIsS0FBbEIsRUFBeUIsS0FBS3FCLEdBQUwsQ0FBU1YsR0FBVCxFQUFjQyxHQUFkLEVBQW1CWixLQUFuQixFQUEwQixLQUExQjtBQUMxQjs7Ozs7O0FBR0g7OztBQUNBVSxPQUFPWSxTQUFQLENBQWlCRixLQUFqQixHQUF5QixPQUFPRyxPQUFQLEtBQW1CLFdBQW5CLEdBQWlDdkIsS0FBakMsR0FBeUNDLElBQWxFOztBQUVBLElBQU11QixTQUFTLElBQUlkLE1BQUosRUFBZjs7QUFFQWUsT0FBT0MsT0FBUCxHQUFpQkYsTUFBakIiLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgbGF5ZXIuTG9nZ2VyXG4gKiBAcHJpdmF0ZVxuICpcbiAqL1xuY29uc3QgeyBERUJVRywgSU5GTywgV0FSTiwgRVJST1IsIE5PTkUgfSA9IHJlcXVpcmUoJy4vY29uc3QnKS5MT0c7XG5cbi8vIFByZXR0eSBhcmJpdHJhcnkgdGVzdCB0aGF0IElFL2VkZ2UgZmFpbHMgYW5kIG90aGVycyBkb24ndC4gIFllcyBJIGNvdWxkIGRvIGEgbW9yZSBkaXJlY3Rcbi8vIHRlc3QgZm9yIElFL2VkZ2UgYnV0IGl0cyBob3BlZCB0aGF0IE1TIHdpbGwgZml4IHRoaXMgYXJvdW5kIHRoZSB0aW1lIHRoZXkgY2xlYW51cCB0aGVpciBpbnRlcm5hbCBjb25zb2xlIG9iamVjdC5cbmNvbnN0IHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcgPSBCb29sZWFuKGNvbnNvbGUuYXNzZXJ0ICYmIGNvbnNvbGUuYXNzZXJ0LnRvU3RyaW5nKCkubWF0Y2goL2Fzc2VydC8pKTtcbmNvbnN0IExheWVyQ3NzID0gJ2NvbG9yOiAjODg4OyBmb250LXdlaWdodDogYm9sZDsnO1xuY29uc3QgQmxhY2sgPSAnY29sb3I6IGJsYWNrJztcbi8qIGlzdGFuYnVsaWZ5IGlnbm9yZSBuZXh0ICovXG5jbGFzcyBMb2dnZXIge1xuICBsb2cobXNnLCBvYmosIHR5cGUsIGNvbG9yKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAodHlwZW9mIG1zZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9iaiA9IG1zZztcbiAgICAgIG1zZyA9ICcnO1xuICAgIH1cbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlVGltZVN0cmluZygpO1xuICAgIGxldCBvcDtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgREVCVUc6XG4gICAgICAgIG9wID0gJ2RlYnVnJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIElORk86XG4gICAgICAgIG9wID0gJ2luZm8nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgV0FSTjpcbiAgICAgICAgb3AgPSAnd2Fybic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFUlJPUjpcbiAgICAgICAgb3AgPSAnZXJyb3InO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG9wID0gJ2xvZyc7XG4gICAgfVxuICAgIGlmIChvYmopIHtcbiAgICAgIGlmIChzdXBwb3J0c0NvbnNvbGVGb3JtYXR0aW5nKSB7XG4gICAgICAgIGNvbnNvbGVbb3BdKGAlY0xheWVyJWMgJHtvcC50b1VwcGVyQ2FzZSgpfSVjIFske3RpbWVzdGFtcH1dOiAke21zZ31gLCBMYXllckNzcywgYGNvbG9yOiAke2NvbG9yfWAsIEJsYWNrLCBvYmopO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZVtvcF0oYExheWVyICR7b3AudG9VcHBlckNhc2UoKX0gWyR7dGltZXN0YW1wfV06ICR7bXNnfWAsIG9iaik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzdXBwb3J0c0NvbnNvbGVGb3JtYXR0aW5nKSB7XG4gICAgICBjb25zb2xlW29wXShgJWNMYXllciVjICR7b3AudG9VcHBlckNhc2UoKX0lYyBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCwgTGF5ZXJDc3MsIGBjb2xvcjogJHtjb2xvcn1gLCBCbGFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGVbb3BdKGBMYXllciAke29wLnRvVXBwZXJDYXNlKCl9IFske3RpbWVzdGFtcH1dOiAke21zZ31gKTtcbiAgICB9XG4gIH1cblxuXG4gIGRlYnVnKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBERUJVRykgdGhpcy5sb2cobXNnLCBvYmosIERFQlVHLCAnIzg4OCcpO1xuICB9XG5cbiAgaW5mbyhtc2csIG9iaikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKHRoaXMubGV2ZWwgPj0gSU5GTykgdGhpcy5sb2cobXNnLCBvYmosIElORk8sICdibGFjaycpO1xuICB9XG5cbiAgd2Fybihtc2csIG9iaikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKHRoaXMubGV2ZWwgPj0gV0FSTikgdGhpcy5sb2cobXNnLCBvYmosIFdBUk4sICdvcmFuZ2UnKTtcbiAgfVxuXG4gIGVycm9yKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBFUlJPUikgdGhpcy5sb2cobXNnLCBvYmosIEVSUk9SLCAncmVkJyk7XG4gIH1cbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbkxvZ2dlci5wcm90b3R5cGUubGV2ZWwgPSB0eXBlb2YgamFzbWluZSA9PT0gJ3VuZGVmaW5lZCcgPyBFUlJPUiA6IE5PTkU7XG5cbmNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBsb2dnZXI7XG4iXX0=
