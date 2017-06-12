'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Metrics gathering component.
 *
 * 1. Should never broadcast any personally identifiable information
 * 2. Should never broadcast any values actually sent/received by users
 * 3. It can send how long any type of operation took to perform
 * 4. It can send how many times an operation was performed
 *
 * This is currently setup to run once per hour, sending hourly updates to the server.
 *
 * @class layer.TelemetryMonitor
 * @extends layer.Root
 * @private
 */

var Root = require('./root');
var Xhr = require('./xhr');
var Util = require('./client-utils');

var TelemetryMonitor = function (_Root) {
  _inherits(TelemetryMonitor, _Root);

  /**
   * Creates a new Monitor.
   *
   * An Application is expected to only have one Monitor.
   *
   * @method constructor
   * @param {Object} options
   * @param {layer.Client} options.client
   * @param {Boolean} [options.enabled=true]   Set to false to disable telemetry reporting
   * @param {Number} [options.reportingInterval=1000 * 3600]   Defaults to 1 hour, but can be set to other intervals
   */
  function TelemetryMonitor(options) {
    _classCallCheck(this, TelemetryMonitor);

    var _this = _possibleConstructorReturn(this, (TelemetryMonitor.__proto__ || Object.getPrototypeOf(TelemetryMonitor)).call(this, options));

    _this.client = options.client;
    _this.state = {
      id: _this.id,
      records: []
    };
    _this.tempState = {};
    _this.storageKey = 'layer-telemetry-' + _this.client.appId;

    if (!global.localStorage) {
      _this.enabled = false;
    } else {
      try {
        var oldState = localStorage[_this.storageKey];
        if (!oldState) {
          localStorage.setItem(_this.storageKey, JSON.stringify(_this.state));
        } else {
          _this.state = JSON.parse(oldState);
        }
      } catch (e) {
        _this.enabled = false;
      }
    }

    _this.client.on('state-change', _this.trackEvent, _this);
    Xhr.addConnectionListener(_this.trackRestPerformance.bind(_this));
    _this.setupReportingInterval();
    return _this;
  }

  /**
   * Given a `telemetryId` and an optional `id`, and a `started` or `ended` key,
   * track performance of the given telemetry statistic.
   *
   * @method
   */


  _createClass(TelemetryMonitor, [{
    key: 'trackEvent',
    value: function trackEvent(evt) {
      if (!this.enabled) return;
      var eventId = evt.telemetryId + '-' + (evt.id || 'noid');

      if (evt.started) {
        this.tempState[eventId] = Date.now();
      } else if (evt.ended) {
        var started = this.tempState[eventId];
        if (started) {
          delete this.tempState[eventId];
          var duration = Date.now() - started;
          this.writePerformance(evt.telemetryId, duration);
        }
      }
    }

    /**
     * Clear out any requests that were never completed.
     *
     * Currently we only track an id and a start time, so we don't know much about these events.
     *
     * @method clearEvents
     */

  }, {
    key: 'clearEvents',
    value: function clearEvents() {
      var _this2 = this;

      var now = Date.now();
      Object.keys(this.tempState).forEach(function (key) {
        if (_this2.tempState[key] + _this2.reportingInterval < now) delete _this2.tempState[key];
      });
    }

    /**
     * Any xhr request that was called with a `telemetry` key contains metrics to be logged.
     *
     * The `telemetry` object should contain `name` and `duration` keys
     *
     * @method
     */

  }, {
    key: 'trackRestPerformance',
    value: function trackRestPerformance(evt) {
      if (this.enabled && evt.request.telemetry) {
        this.writePerformance(evt.request.telemetry.name, evt.duration);
      }
    }

    /**
     * When writing performance, there are three inputs used:
     *
     * 1. The name of the metric being tracked
     * 2. The duration it took for the operation
     * 3. The current time (this is not a function input, but is still a dependency)
     *
     * Results of writing performance are to increment count, and total time for the operation.
     *
     * @method
     */

  }, {
    key: 'writePerformance',
    value: function writePerformance(name, timing) {
      var performance = this.getCurrentStateObject().performance;
      if (!performance[name]) {
        performance[name] = {
          count: 0,
          time: 0,
          max: 0
        };
      }
      performance[name].count++;
      performance[name].time += timing;
      if (timing > performance[name].max) performance[name].max = timing;
      this.writeState();
    }

    /**
     * When writing usage, we are simply incrementing the usage counter for the metric.
     *
     * @method
     */

  }, {
    key: 'writeUsage',
    value: function writeUsage(name) {
      var usage = this.getCurrentStateObject().usage;
      if (!usage[name]) usage[name] = 0;
      usage[name]++;
      this.writeState();
    }

    /**
     * Grab some environmental data to attach to the report.
     *
     * note that environmental data may change from hour to hour,
     * so we regather this information for each record we send to the server.
     *
     * @method
     */

  }, {
    key: 'getEnvironment',
    value: function getEnvironment() {
      var environment = {
        platform: 'web',
        locale: (navigator.language || '').replace(/-/g, '_'), // should match the en_us format that mobile devices are using rather than the much nicer en-us
        layer_sdk_version: this.client.constructor.version,
        domain: location.hostname
      };

      // This event allows other libraries to add information to the environment object; specifically: Layer UI
      this.trigger('telemetry-environment', {
        environment: environment
      });
      return environment;
    }

    /**
     * Grab some device data to attach to the report.
     *
     * note that device data may change from hour to hour,
     * so we regather this information for each record we send to the server.
     *
     * @method
     */

  }, {
    key: 'getDevice',
    value: function getDevice() {
      return {
        user_agent: navigator.userAgent,
        screen: {
          width: (typeof screen === 'undefined' ? 'undefined' : _typeof(screen)) === undefined ? 0 : screen.width,
          height: (typeof screen === 'undefined' ? 'undefined' : _typeof(screen)) === undefined ? 0 : screen.height
        },
        window: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    }

    /**
     * Return the state object used to track performance for the current time slot
     *
     * @method
     */

  }, {
    key: 'getCurrentStateObject',
    value: function getCurrentStateObject(doNotCreate) {
      var today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      var currentDate = new Date(today);

      var now = Date.now();

      // If the reporting interval is less than 24 hours, iterate until we find the current time slice within our day
      if (this.reportingInterval < 60 * 60 * 1000 * 24) {
        while (currentDate.getTime() < now) {
          currentDate.setMilliseconds(currentDate.getMilliseconds() + this.reportingInterval);
        }
      }

      var currentStart = currentDate.toISOString();
      var currentEndDate = new Date(currentDate);
      currentEndDate.setMilliseconds(currentEndDate.getMilliseconds() + this.reportingInterval);
      var todayObj = this.state.records.filter(function (set) {
        return set.period.start === currentStart;
      })[0];

      if (!todayObj && !doNotCreate) {
        todayObj = {
          period: {
            start: currentStart,
            end: currentEndDate.toISOString()
          },
          environment: this.getEnvironment(),
          device: this.getDevice(),
          usage: {},
          performance: {},
          errors: {}
        };
        this.state.records.push(todayObj);
      }

      return todayObj;
    }

    /**
     * Write state to localStorage.
     *
     * Writing the state is an expensive operation that should be done less often,
     * and containing more changes rather than done immediatley and repeated with each change.
     *
     * @method
     */

  }, {
    key: 'writeState',
    value: function writeState() {
      var _this3 = this;

      if (this.enabled && !this._writeTimeoutId) {
        this._writeTimeoutId = setTimeout(function () {
          localStorage.setItem(_this3.storageKey, JSON.stringify(_this3.state));
          _this3._writeTimeoutId = 0;
        }, 1000);
      }
    }

    /**
     * Given a time slot's data, convert its data to what the server expects.
     *
     * @method
     */

  }, {
    key: 'convertRecord',
    value: function convertRecord(record) {
      var result = {
        period: record.period,
        device: record.device,
        environment: record.environment,
        usage: record.usage,
        performance: {}
      };

      Object.keys(record.performance).forEach(function (performanceKey) {
        var item = record.performance[performanceKey];
        result.performance[performanceKey] = {
          max: Math.round(item.max),
          count: item.count,
          mean: Math.round(item.time / item.count) // convert to mean in miliseconds from total time in nanoseconds
        };
      });
      return result;
    }

    /**
     * Send data to the server; do not send any data from the current hour.
     *
     * Remove any data successfully sent from our records.
     *
     * @method
     */

  }, {
    key: 'sendData',
    value: function sendData() {
      var _this4 = this;

      var doNotSendCurrentRecord = this.getCurrentStateObject(true);
      var records = this.state.records.filter(function (record) {
        return record !== doNotSendCurrentRecord;
      });
      if (records.length) {
        Xhr({
          sync: false,
          method: 'POST',
          url: this.telemetryUrl,
          headers: {
            'content-type': 'application/json'
          },
          data: {
            id: Util.uuid(this.state.id),
            layer_app_id: this.client.appId,
            records: records.map(function (record) {
              return _this4.convertRecord(record);
            })
          }
        }, function (result) {
          if (result.success) {
            // Remove any records that were sent from our state
            _this4.state.records = _this4.state.records.filter(function (record) {
              return records.indexOf(record) === -1;
            });
            _this4.writeState();
          }
        });
      }
      this.clearEvents();
    }

    /**
     * Periodicalily call sendData to send updates to the server.
     *
     * @method
     */

  }, {
    key: 'setupReportingInterval',
    value: function setupReportingInterval() {
      if (this.enabled) {
        // Send any stale data
        this.sendData();
        this._intervalId = setInterval(this.sendData.bind(this), this.reportingInterval);
      }
    }

    /**
     * If the enabled property is set, automatically clear or start the interval.
     *
     * ```
     * telemetryMonitor.enabled = false;
     * ```
     *
     * The above code will stop the telemetryMonitor from sending data.
     *
     * @method
     */

  }, {
    key: '__updateEnabled',
    value: function __updateEnabled() {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = 0;
      }
      if (this.enabled) this.setupReportingInterval();
    }
  }]);

  return TelemetryMonitor;
}(Root);

/**
 * The URL to `POST` telemetry data to.
 *
 * @property {String}
 */


TelemetryMonitor.prototype.telemetryUrl = 'https://telemetry.layer.com';

/**
 * ID for the `window.setInterval` operation
 *
 * @property {Number}
 */
TelemetryMonitor.prototype._intervalId = 0;

/**
 * The reporting interval controls how frequently the module tries to report on usage data.
 *
 * It also is used to determine how to segment data into time slices.
 *
 * Value should not excede 1 day.
 *
 * @property {Number} [reportingInterval=3,600,000]  Number of miliseconds between submitting usage reports; defaults to once per hour
 */
TelemetryMonitor.prototype.reportingInterval = 1000 * 60 * 60;

/**
 * To avoid performance issues, we only write changes asynchronously; this timeoutId tracks that this has been scheduled.
 *
 * @property {Number}
 */
TelemetryMonitor.prototype._writeTimeoutId = 0;

/**
 * Constructor sets this to be the key within localStorage for accessing the cached telemetry data.
 *
 * @property {String}
 */
TelemetryMonitor.prototype.storageKey = '';

/**
 * Current state object.
 *
 * Initialized with data from localStorage, and any changes to it are written
 * back to localStorage.
 *
 * Sending records causes them to be removed from the state.
 *
 * @property {Object}
 */
TelemetryMonitor.prototype.state = null;

/**
 * Cache of in-progress performance events.
 *
 * Each key has a value representing a timestamp.  Events are removed once they are completed.
 *
 * @property {Object}
 */
TelemetryMonitor.prototype.tempState = null;

/**
 * Telemetry defaults to enabled, but can be disabled by setting this to `false`
 *
 * @property {Boolean}
 */
TelemetryMonitor.prototype.enabled = true;

/**
 * Pointer to the layer.Client
 *
 * @property {layer.Client}
 */
TelemetryMonitor.prototype.client = null;

/**
 * The presence of this causes layer.Root to automatically generate an id if one isn't present.
 *
 * This id is written to localStorage so that it can persist across sessions.
 *
 * @static
 * @property {String}
 */
TelemetryMonitor.prefixUUID = 'layer:///telemetry/';

TelemetryMonitor._supportedEvents = Root._supportedEvents.concat(['telemetry-environment']);

Root.initClass.apply(TelemetryMonitor, [TelemetryMonitor, 'TelemetryMonitor']);
module.exports = TelemetryMonitor;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy90ZWxlbWV0cnktbW9uaXRvci5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIlhociIsIlV0aWwiLCJUZWxlbWV0cnlNb25pdG9yIiwib3B0aW9ucyIsImNsaWVudCIsInN0YXRlIiwiaWQiLCJyZWNvcmRzIiwidGVtcFN0YXRlIiwic3RvcmFnZUtleSIsImFwcElkIiwiZ2xvYmFsIiwibG9jYWxTdG9yYWdlIiwiZW5hYmxlZCIsIm9sZFN0YXRlIiwic2V0SXRlbSIsIkpTT04iLCJzdHJpbmdpZnkiLCJwYXJzZSIsImUiLCJvbiIsInRyYWNrRXZlbnQiLCJhZGRDb25uZWN0aW9uTGlzdGVuZXIiLCJ0cmFja1Jlc3RQZXJmb3JtYW5jZSIsImJpbmQiLCJzZXR1cFJlcG9ydGluZ0ludGVydmFsIiwiZXZ0IiwiZXZlbnRJZCIsInRlbGVtZXRyeUlkIiwic3RhcnRlZCIsIkRhdGUiLCJub3ciLCJlbmRlZCIsImR1cmF0aW9uIiwid3JpdGVQZXJmb3JtYW5jZSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwicmVwb3J0aW5nSW50ZXJ2YWwiLCJyZXF1ZXN0IiwidGVsZW1ldHJ5IiwibmFtZSIsInRpbWluZyIsInBlcmZvcm1hbmNlIiwiZ2V0Q3VycmVudFN0YXRlT2JqZWN0IiwiY291bnQiLCJ0aW1lIiwibWF4Iiwid3JpdGVTdGF0ZSIsInVzYWdlIiwiZW52aXJvbm1lbnQiLCJwbGF0Zm9ybSIsImxvY2FsZSIsIm5hdmlnYXRvciIsImxhbmd1YWdlIiwicmVwbGFjZSIsImxheWVyX3Nka192ZXJzaW9uIiwiY29uc3RydWN0b3IiLCJ2ZXJzaW9uIiwiZG9tYWluIiwibG9jYXRpb24iLCJob3N0bmFtZSIsInRyaWdnZXIiLCJ1c2VyX2FnZW50IiwidXNlckFnZW50Iiwic2NyZWVuIiwid2lkdGgiLCJ1bmRlZmluZWQiLCJoZWlnaHQiLCJ3aW5kb3ciLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJkb05vdENyZWF0ZSIsInRvZGF5Iiwic2V0VVRDSG91cnMiLCJjdXJyZW50RGF0ZSIsImdldFRpbWUiLCJzZXRNaWxsaXNlY29uZHMiLCJnZXRNaWxsaXNlY29uZHMiLCJjdXJyZW50U3RhcnQiLCJ0b0lTT1N0cmluZyIsImN1cnJlbnRFbmREYXRlIiwidG9kYXlPYmoiLCJmaWx0ZXIiLCJzZXQiLCJwZXJpb2QiLCJzdGFydCIsImVuZCIsImdldEVudmlyb25tZW50IiwiZGV2aWNlIiwiZ2V0RGV2aWNlIiwiZXJyb3JzIiwicHVzaCIsIl93cml0ZVRpbWVvdXRJZCIsInNldFRpbWVvdXQiLCJyZWNvcmQiLCJyZXN1bHQiLCJwZXJmb3JtYW5jZUtleSIsIml0ZW0iLCJNYXRoIiwicm91bmQiLCJtZWFuIiwiZG9Ob3RTZW5kQ3VycmVudFJlY29yZCIsImxlbmd0aCIsInN5bmMiLCJtZXRob2QiLCJ1cmwiLCJ0ZWxlbWV0cnlVcmwiLCJoZWFkZXJzIiwiZGF0YSIsInV1aWQiLCJsYXllcl9hcHBfaWQiLCJtYXAiLCJjb252ZXJ0UmVjb3JkIiwic3VjY2VzcyIsImluZGV4T2YiLCJjbGVhckV2ZW50cyIsInNlbmREYXRhIiwiX2ludGVydmFsSWQiLCJzZXRJbnRlcnZhbCIsImNsZWFySW50ZXJ2YWwiLCJwcm90b3R5cGUiLCJwcmVmaXhVVUlEIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7OztBQWVBLElBQU1BLE9BQU9DLFFBQVEsUUFBUixDQUFiO0FBQ0EsSUFBTUMsTUFBTUQsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFNRSxPQUFPRixRQUFRLGdCQUFSLENBQWI7O0lBRU1HLGdCOzs7QUFDSjs7Ozs7Ozs7Ozs7QUFXQSw0QkFBWUMsT0FBWixFQUFxQjtBQUFBOztBQUFBLG9JQUNiQSxPQURhOztBQUVuQixVQUFLQyxNQUFMLEdBQWNELFFBQVFDLE1BQXRCO0FBQ0EsVUFBS0MsS0FB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LENBQXBDOztBQUlBL0gsS0FBS2dJLFNBQUwsQ0FBZUMsS0FBZixDQUFxQjdILGdCQUFyQixFQUF1QyxDQUFDQSxnQkFBRCxFQUFtQixrQkFBbkIsQ0FBdkM7QUFDQThILE9BQU9DLE9BQVAsR0FBaUIvSCxnQkFBakIiLCJmaWxlIjoidGVsZW1ldHJ5LW1vbml0b3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1ldHJpY3MgZ2F0aGVyaW5nIGNvbXBvbmVudC5cbiAqXG4gKiAxLiBTaG91bGQgbmV2ZXIgYnJvYWRjYXN0IGFueSBwZXJzb25hbGx5IGlkZW50aWZpYWJsZSBpbmZvcm1hdGlvblxuICogMi4gU2hvdWxkIG5ldmVyIGJyb2FkY2FzdCBhbnkgdmFsdWVzIGFjdHVhbGx5IHNlbnQvcmVjZWl2ZWQgYnkgdXNlcnNcbiAqIDMuIEl0IGNhbiBzZW5kIGhvdyBsb25nIGFueSB0eXBlIG9mIG9wZXJhdGlvbiB0b29rIHRvIHBlcmZvcm1cbiAqIDQuIEl0IGNhbiBzZW5kIGhvdyBtYW55IHRpbWVzIGFuIG9wZXJhdGlvbiB3YXMgcGVyZm9ybWVkXG4gKlxuICogVGhpcyBpcyBjdXJyZW50bHkgc2V0dXAgdG8gcnVuIG9uY2UgcGVyIGhvdXIsIHNlbmRpbmcgaG91cmx5IHVwZGF0ZXMgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuVGVsZW1ldHJ5TW9uaXRvclxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQHByaXZhdGVcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBYaHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5cbmNsYXNzIFRlbGVtZXRyeU1vbml0b3IgZXh0ZW5kcyBSb290IHtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgTW9uaXRvci5cbiAgICpcbiAgICogQW4gQXBwbGljYXRpb24gaXMgZXhwZWN0ZWQgdG8gb25seSBoYXZlIG9uZSBNb25pdG9yLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBvcHRpb25zLmNsaWVudFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmVuYWJsZWQ9dHJ1ZV0gICBTZXQgdG8gZmFsc2UgdG8gZGlzYWJsZSB0ZWxlbWV0cnkgcmVwb3J0aW5nXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5yZXBvcnRpbmdJbnRlcnZhbD0xMDAwICogMzYwMF0gICBEZWZhdWx0cyB0byAxIGhvdXIsIGJ1dCBjYW4gYmUgc2V0IHRvIG90aGVyIGludGVydmFsc1xuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuY2xpZW50ID0gb3B0aW9ucy5jbGllbnQ7XG4gICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgcmVjb3JkczogW10sXG4gICAgfTtcbiAgICB0aGlzLnRlbXBTdGF0ZSA9IHt9O1xuICAgIHRoaXMuc3RvcmFnZUtleSA9ICdsYXllci10ZWxlbWV0cnktJyArIHRoaXMuY2xpZW50LmFwcElkO1xuXG4gICAgaWYgKCFnbG9iYWwubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2xkU3RhdGUgPSBsb2NhbFN0b3JhZ2VbdGhpcy5zdG9yYWdlS2V5XTtcbiAgICAgICAgaWYgKCFvbGRTdGF0ZSkge1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkodGhpcy5zdGF0ZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBKU09OLnBhcnNlKG9sZFN0YXRlKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNsaWVudC5vbignc3RhdGUtY2hhbmdlJywgdGhpcy50cmFja0V2ZW50LCB0aGlzKTtcbiAgICBYaHIuYWRkQ29ubmVjdGlvbkxpc3RlbmVyKHRoaXMudHJhY2tSZXN0UGVyZm9ybWFuY2UuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5zZXR1cFJlcG9ydGluZ0ludGVydmFsKCk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gYSBgdGVsZW1ldHJ5SWRgIGFuZCBhbiBvcHRpb25hbCBgaWRgLCBhbmQgYSBgc3RhcnRlZGAgb3IgYGVuZGVkYCBrZXksXG4gICAqIHRyYWNrIHBlcmZvcm1hbmNlIG9mIHRoZSBnaXZlbiB0ZWxlbWV0cnkgc3RhdGlzdGljLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICB0cmFja0V2ZW50KGV2dCkge1xuICAgIGlmICghdGhpcy5lbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgZXZlbnRJZCA9IGAke2V2dC50ZWxlbWV0cnlJZH0tJHtldnQuaWQgfHwgJ25vaWQnfWA7XG5cbiAgICBpZiAoZXZ0LnN0YXJ0ZWQpIHtcbiAgICAgIHRoaXMudGVtcFN0YXRlW2V2ZW50SWRdID0gRGF0ZS5ub3coKTtcbiAgICB9IGVsc2UgaWYgKGV2dC5lbmRlZCkge1xuICAgICAgY29uc3Qgc3RhcnRlZCA9IHRoaXMudGVtcFN0YXRlW2V2ZW50SWRdO1xuICAgICAgaWYgKHN0YXJ0ZWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMudGVtcFN0YXRlW2V2ZW50SWRdO1xuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydGVkO1xuICAgICAgICB0aGlzLndyaXRlUGVyZm9ybWFuY2UoZXZ0LnRlbGVtZXRyeUlkLCBkdXJhdGlvbik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIG91dCBhbnkgcmVxdWVzdHMgdGhhdCB3ZXJlIG5ldmVyIGNvbXBsZXRlZC5cbiAgICpcbiAgICogQ3VycmVudGx5IHdlIG9ubHkgdHJhY2sgYW4gaWQgYW5kIGEgc3RhcnQgdGltZSwgc28gd2UgZG9uJ3Qga25vdyBtdWNoIGFib3V0IHRoZXNlIGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBjbGVhckV2ZW50c1xuICAgKi9cbiAgY2xlYXJFdmVudHMoKSB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLnRlbXBTdGF0ZSkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBpZiAodGhpcy50ZW1wU3RhdGVba2V5XSArIHRoaXMucmVwb3J0aW5nSW50ZXJ2YWwgPCBub3cpIGRlbGV0ZSB0aGlzLnRlbXBTdGF0ZVtrZXldO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFueSB4aHIgcmVxdWVzdCB0aGF0IHdhcyBjYWxsZWQgd2l0aCBhIGB0ZWxlbWV0cnlgIGtleSBjb250YWlucyBtZXRyaWNzIHRvIGJlIGxvZ2dlZC5cbiAgICpcbiAgICogVGhlIGB0ZWxlbWV0cnlgIG9iamVjdCBzaG91bGQgY29udGFpbiBgbmFtZWAgYW5kIGBkdXJhdGlvbmAga2V5c1xuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICB0cmFja1Jlc3RQZXJmb3JtYW5jZShldnQpIHtcbiAgICBpZiAodGhpcy5lbmFibGVkICYmIGV2dC5yZXF1ZXN0LnRlbGVtZXRyeSkge1xuICAgICAgdGhpcy53cml0ZVBlcmZvcm1hbmNlKGV2dC5yZXF1ZXN0LnRlbGVtZXRyeS5uYW1lLCBldnQuZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXaGVuIHdyaXRpbmcgcGVyZm9ybWFuY2UsIHRoZXJlIGFyZSB0aHJlZSBpbnB1dHMgdXNlZDpcbiAgICpcbiAgICogMS4gVGhlIG5hbWUgb2YgdGhlIG1ldHJpYyBiZWluZyB0cmFja2VkXG4gICAqIDIuIFRoZSBkdXJhdGlvbiBpdCB0b29rIGZvciB0aGUgb3BlcmF0aW9uXG4gICAqIDMuIFRoZSBjdXJyZW50IHRpbWUgKHRoaXMgaXMgbm90IGEgZnVuY3Rpb24gaW5wdXQsIGJ1dCBpcyBzdGlsbCBhIGRlcGVuZGVuY3kpXG4gICAqXG4gICAqIFJlc3VsdHMgb2Ygd3JpdGluZyBwZXJmb3JtYW5jZSBhcmUgdG8gaW5jcmVtZW50IGNvdW50LCBhbmQgdG90YWwgdGltZSBmb3IgdGhlIG9wZXJhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZFxuICAgKi9cbiAgd3JpdGVQZXJmb3JtYW5jZShuYW1lLCB0aW1pbmcpIHtcbiAgICBjb25zdCBwZXJmb3JtYW5jZSA9IHRoaXMuZ2V0Q3VycmVudFN0YXRlT2JqZWN0KCkucGVyZm9ybWFuY2U7XG4gICAgaWYgKCFwZXJmb3JtYW5jZVtuYW1lXSkge1xuICAgICAgcGVyZm9ybWFuY2VbbmFtZV0gPSB7XG4gICAgICAgIGNvdW50OiAwLFxuICAgICAgICB0aW1lOiAwLFxuICAgICAgICBtYXg6IDAsXG4gICAgICB9O1xuICAgIH1cbiAgICBwZXJmb3JtYW5jZVtuYW1lXS5jb3VudCsrO1xuICAgIHBlcmZvcm1hbmNlW25hbWVdLnRpbWUgKz0gdGltaW5nO1xuICAgIGlmICh0aW1pbmcgPiBwZXJmb3JtYW5jZVtuYW1lXS5tYXgpIHBlcmZvcm1hbmNlW25hbWVdLm1heCA9IHRpbWluZztcbiAgICB0aGlzLndyaXRlU3RhdGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGVuIHdyaXRpbmcgdXNhZ2UsIHdlIGFyZSBzaW1wbHkgaW5jcmVtZW50aW5nIHRoZSB1c2FnZSBjb3VudGVyIGZvciB0aGUgbWV0cmljLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICB3cml0ZVVzYWdlKG5hbWUpIHtcbiAgICBjb25zdCB1c2FnZSA9IHRoaXMuZ2V0Q3VycmVudFN0YXRlT2JqZWN0KCkudXNhZ2U7XG4gICAgaWYgKCF1c2FnZVtuYW1lXSkgdXNhZ2VbbmFtZV0gPSAwO1xuICAgIHVzYWdlW25hbWVdKys7XG4gICAgdGhpcy53cml0ZVN0YXRlKCk7XG4gIH1cblxuICAvKipcbiAgICogR3JhYiBzb21lIGVudmlyb25tZW50YWwgZGF0YSB0byBhdHRhY2ggdG8gdGhlIHJlcG9ydC5cbiAgICpcbiAgICogbm90ZSB0aGF0IGVudmlyb25tZW50YWwgZGF0YSBtYXkgY2hhbmdlIGZyb20gaG91ciB0byBob3VyLFxuICAgKiBzbyB3ZSByZWdhdGhlciB0aGlzIGluZm9ybWF0aW9uIGZvciBlYWNoIHJlY29yZCB3ZSBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2RcbiAgICovXG4gIGdldEVudmlyb25tZW50KCkge1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0ge1xuICAgICAgcGxhdGZvcm06ICd3ZWInLFxuICAgICAgbG9jYWxlOiAobmF2aWdhdG9yLmxhbmd1YWdlIHx8ICcnKS5yZXBsYWNlKC8tL2csICdfJyksIC8vIHNob3VsZCBtYXRjaCB0aGUgZW5fdXMgZm9ybWF0IHRoYXQgbW9iaWxlIGRldmljZXMgYXJlIHVzaW5nIHJhdGhlciB0aGFuIHRoZSBtdWNoIG5pY2VyIGVuLXVzXG4gICAgICBsYXllcl9zZGtfdmVyc2lvbjogdGhpcy5jbGllbnQuY29uc3RydWN0b3IudmVyc2lvbixcbiAgICAgIGRvbWFpbjogbG9jYXRpb24uaG9zdG5hbWUsXG4gICAgfTtcblxuICAgIC8vIFRoaXMgZXZlbnQgYWxsb3dzIG90aGVyIGxpYnJhcmllcyB0byBhZGQgaW5mb3JtYXRpb24gdG8gdGhlIGVudmlyb25tZW50IG9iamVjdDsgc3BlY2lmaWNhbGx5OiBMYXllciBVSVxuICAgIHRoaXMudHJpZ2dlcigndGVsZW1ldHJ5LWVudmlyb25tZW50Jywge1xuICAgICAgZW52aXJvbm1lbnRcbiAgICB9KTtcbiAgICByZXR1cm4gZW52aXJvbm1lbnQ7XG4gIH1cblxuICAvKipcbiAgICogR3JhYiBzb21lIGRldmljZSBkYXRhIHRvIGF0dGFjaCB0byB0aGUgcmVwb3J0LlxuICAgKlxuICAgKiBub3RlIHRoYXQgZGV2aWNlIGRhdGEgbWF5IGNoYW5nZSBmcm9tIGhvdXIgdG8gaG91cixcbiAgICogc28gd2UgcmVnYXRoZXIgdGhpcyBpbmZvcm1hdGlvbiBmb3IgZWFjaCByZWNvcmQgd2Ugc2VuZCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICBnZXREZXZpY2UoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVzZXJfYWdlbnQ6IG5hdmlnYXRvci51c2VyQWdlbnQsXG4gICAgICBzY3JlZW46IHtcbiAgICAgICAgd2lkdGg6IHR5cGVvZiBzY3JlZW4gPT09IHVuZGVmaW5lZCA/IDAgOiBzY3JlZW4ud2lkdGgsXG4gICAgICAgIGhlaWdodDogdHlwZW9mIHNjcmVlbiA9PT0gdW5kZWZpbmVkID8gMCA6IHNjcmVlbi5oZWlnaHQsXG4gICAgICB9LFxuICAgICAgd2luZG93OiB7XG4gICAgICAgIHdpZHRoOiB3aW5kb3cuaW5uZXJXaWR0aCxcbiAgICAgICAgaGVpZ2h0OiB3aW5kb3cuaW5uZXJIZWlnaHQsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzdGF0ZSBvYmplY3QgdXNlZCB0byB0cmFjayBwZXJmb3JtYW5jZSBmb3IgdGhlIGN1cnJlbnQgdGltZSBzbG90XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICovXG4gIGdldEN1cnJlbnRTdGF0ZU9iamVjdChkb05vdENyZWF0ZSkge1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICB0b2RheS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgICBjb25zdCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKHRvZGF5KTtcblxuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICAvLyBJZiB0aGUgcmVwb3J0aW5nIGludGVydmFsIGlzIGxlc3MgdGhhbiAyNCBob3VycywgaXRlcmF0ZSB1bnRpbCB3ZSBmaW5kIHRoZSBjdXJyZW50IHRpbWUgc2xpY2Ugd2l0aGluIG91ciBkYXlcbiAgICBpZiAodGhpcy5yZXBvcnRpbmdJbnRlcnZhbCA8IDYwICogNjAgKiAxMDAwICogMjQpIHtcbiAgICAgIHdoaWxlIChjdXJyZW50RGF0ZS5nZXRUaW1lKCkgPCBub3cpIHtcbiAgICAgICAgY3VycmVudERhdGUuc2V0TWlsbGlzZWNvbmRzKGN1cnJlbnREYXRlLmdldE1pbGxpc2Vjb25kcygpICsgdGhpcy5yZXBvcnRpbmdJbnRlcnZhbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudFN0YXJ0ID0gY3VycmVudERhdGUudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjdXJyZW50RW5kRGF0ZSA9IG5ldyBEYXRlKGN1cnJlbnREYXRlKTtcbiAgICBjdXJyZW50RW5kRGF0ZS5zZXRNaWxsaXNlY29uZHMoY3VycmVudEVuZERhdGUuZ2V0TWlsbGlzZWNvbmRzKCkgKyB0aGlzLnJlcG9ydGluZ0ludGVydmFsKTtcbiAgICBsZXQgdG9kYXlPYmogPSB0aGlzLnN0YXRlLnJlY29yZHMuZmlsdGVyKHNldCA9PiBzZXQucGVyaW9kLnN0YXJ0ID09PSBjdXJyZW50U3RhcnQpWzBdO1xuXG4gICAgaWYgKCF0b2RheU9iaiAmJiAhZG9Ob3RDcmVhdGUpIHtcbiAgICAgIHRvZGF5T2JqID0ge1xuICAgICAgICBwZXJpb2Q6IHtcbiAgICAgICAgICBzdGFydDogY3VycmVudFN0YXJ0LFxuICAgICAgICAgIGVuZDogY3VycmVudEVuZERhdGUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZ2V0RW52aXJvbm1lbnQoKSxcbiAgICAgICAgZGV2aWNlOiB0aGlzLmdldERldmljZSgpLFxuICAgICAgICB1c2FnZToge30sXG4gICAgICAgIHBlcmZvcm1hbmNlOiB7fSxcbiAgICAgICAgZXJyb3JzOiB7fSxcbiAgICAgIH07XG4gICAgICB0aGlzLnN0YXRlLnJlY29yZHMucHVzaCh0b2RheU9iaik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvZGF5T2JqO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlIHN0YXRlIHRvIGxvY2FsU3RvcmFnZS5cbiAgICpcbiAgICogV3JpdGluZyB0aGUgc3RhdGUgaXMgYW4gZXhwZW5zaXZlIG9wZXJhdGlvbiB0aGF0IHNob3VsZCBiZSBkb25lIGxlc3Mgb2Z0ZW4sXG4gICAqIGFuZCBjb250YWluaW5nIG1vcmUgY2hhbmdlcyByYXRoZXIgdGhhbiBkb25lIGltbWVkaWF0bGV5IGFuZCByZXBlYXRlZCB3aXRoIGVhY2ggY2hhbmdlLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICB3cml0ZVN0YXRlKCkge1xuICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgIXRoaXMuX3dyaXRlVGltZW91dElkKSB7XG4gICAgICB0aGlzLl93cml0ZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLnN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHRoaXMuc3RhdGUpKTtcbiAgICAgICAgdGhpcy5fd3JpdGVUaW1lb3V0SWQgPSAwO1xuICAgICAgfSwgMTAwMCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgdGltZSBzbG90J3MgZGF0YSwgY29udmVydCBpdHMgZGF0YSB0byB3aGF0IHRoZSBzZXJ2ZXIgZXhwZWN0cy5cbiAgICpcbiAgICogQG1ldGhvZFxuICAgKi9cbiAgY29udmVydFJlY29yZChyZWNvcmQpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBwZXJpb2Q6IHJlY29yZC5wZXJpb2QsXG4gICAgICBkZXZpY2U6IHJlY29yZC5kZXZpY2UsXG4gICAgICBlbnZpcm9ubWVudDogcmVjb3JkLmVudmlyb25tZW50LFxuICAgICAgdXNhZ2U6IHJlY29yZC51c2FnZSxcbiAgICAgIHBlcmZvcm1hbmNlOiB7fSxcbiAgICB9O1xuXG4gICAgT2JqZWN0LmtleXMocmVjb3JkLnBlcmZvcm1hbmNlKS5mb3JFYWNoKChwZXJmb3JtYW5jZUtleSkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHJlY29yZC5wZXJmb3JtYW5jZVtwZXJmb3JtYW5jZUtleV07XG4gICAgICByZXN1bHQucGVyZm9ybWFuY2VbcGVyZm9ybWFuY2VLZXldID0ge1xuICAgICAgICBtYXg6IE1hdGgucm91bmQoaXRlbS5tYXgpLFxuICAgICAgICBjb3VudDogaXRlbS5jb3VudCxcbiAgICAgICAgbWVhbjogTWF0aC5yb3VuZChpdGVtLnRpbWUgLyBpdGVtLmNvdW50KSwgLy8gY29udmVydCB0byBtZWFuIGluIG1pbGlzZWNvbmRzIGZyb20gdG90YWwgdGltZSBpbiBuYW5vc2Vjb25kc1xuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgZGF0YSB0byB0aGUgc2VydmVyOyBkbyBub3Qgc2VuZCBhbnkgZGF0YSBmcm9tIHRoZSBjdXJyZW50IGhvdXIuXG4gICAqXG4gICAqIFJlbW92ZSBhbnkgZGF0YSBzdWNjZXNzZnVsbHkgc2VudCBmcm9tIG91ciByZWNvcmRzLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICBzZW5kRGF0YSgpIHtcbiAgICBjb25zdCBkb05vdFNlbmRDdXJyZW50UmVjb3JkID0gdGhpcy5nZXRDdXJyZW50U3RhdGVPYmplY3QodHJ1ZSk7XG4gICAgY29uc3QgcmVjb3JkcyA9IHRoaXMuc3RhdGUucmVjb3Jkc1xuICAgICAgLmZpbHRlcihyZWNvcmQgPT4gcmVjb3JkICE9PSBkb05vdFNlbmRDdXJyZW50UmVjb3JkKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGgpIHtcbiAgICAgIFhocih7XG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgdXJsOiB0aGlzLnRlbGVtZXRyeVVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGlkOiBVdGlsLnV1aWQodGhpcy5zdGF0ZS5pZCksXG4gICAgICAgICAgbGF5ZXJfYXBwX2lkOiB0aGlzLmNsaWVudC5hcHBJZCxcbiAgICAgICAgICByZWNvcmRzOiByZWNvcmRzLm1hcChyZWNvcmQgPT4gdGhpcy5jb252ZXJ0UmVjb3JkKHJlY29yZCkpLFxuICAgICAgICB9LFxuICAgICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAvLyBSZW1vdmUgYW55IHJlY29yZHMgdGhhdCB3ZXJlIHNlbnQgZnJvbSBvdXIgc3RhdGVcbiAgICAgICAgICB0aGlzLnN0YXRlLnJlY29yZHMgPSB0aGlzLnN0YXRlLnJlY29yZHMuZmlsdGVyKChyZWNvcmQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiByZWNvcmRzLmluZGV4T2YocmVjb3JkKSA9PT0gLTE7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy53cml0ZVN0YXRlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLmNsZWFyRXZlbnRzKCk7XG4gIH1cblxuICAvKipcbiAgICogUGVyaW9kaWNhbGlseSBjYWxsIHNlbmREYXRhIHRvIHNlbmQgdXBkYXRlcyB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqL1xuICBzZXR1cFJlcG9ydGluZ0ludGVydmFsKCkge1xuICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgIC8vIFNlbmQgYW55IHN0YWxlIGRhdGFcbiAgICAgIHRoaXMuc2VuZERhdGEoKTtcbiAgICAgIHRoaXMuX2ludGVydmFsSWQgPSBzZXRJbnRlcnZhbCh0aGlzLnNlbmREYXRhLmJpbmQodGhpcyksIHRoaXMucmVwb3J0aW5nSW50ZXJ2YWwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgZW5hYmxlZCBwcm9wZXJ0eSBpcyBzZXQsIGF1dG9tYXRpY2FsbHkgY2xlYXIgb3Igc3RhcnQgdGhlIGludGVydmFsLlxuICAgKlxuICAgKiBgYGBcbiAgICogdGVsZW1ldHJ5TW9uaXRvci5lbmFibGVkID0gZmFsc2U7XG4gICAqIGBgYFxuICAgKlxuICAgKiBUaGUgYWJvdmUgY29kZSB3aWxsIHN0b3AgdGhlIHRlbGVtZXRyeU1vbml0b3IgZnJvbSBzZW5kaW5nIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2RcbiAgICovXG4gIF9fdXBkYXRlRW5hYmxlZCgpIHtcbiAgICBpZiAodGhpcy5faW50ZXJ2YWxJZCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9pbnRlcnZhbElkKTtcbiAgICAgIHRoaXMuX2ludGVydmFsSWQgPSAwO1xuICAgIH1cbiAgICBpZiAodGhpcy5lbmFibGVkKSB0aGlzLnNldHVwUmVwb3J0aW5nSW50ZXJ2YWwoKTtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBVUkwgdG8gYFBPU1RgIHRlbGVtZXRyeSBkYXRhIHRvLlxuICpcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByb3RvdHlwZS50ZWxlbWV0cnlVcmwgPSAnaHR0cHM6Ly90ZWxlbWV0cnkubGF5ZXIuY29tJztcblxuLyoqXG4gKiBJRCBmb3IgdGhlIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIG9wZXJhdGlvblxuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByb3RvdHlwZS5faW50ZXJ2YWxJZCA9IDA7XG5cbi8qKlxuICogVGhlIHJlcG9ydGluZyBpbnRlcnZhbCBjb250cm9scyBob3cgZnJlcXVlbnRseSB0aGUgbW9kdWxlIHRyaWVzIHRvIHJlcG9ydCBvbiB1c2FnZSBkYXRhLlxuICpcbiAqIEl0IGFsc28gaXMgdXNlZCB0byBkZXRlcm1pbmUgaG93IHRvIHNlZ21lbnQgZGF0YSBpbnRvIHRpbWUgc2xpY2VzLlxuICpcbiAqIFZhbHVlIHNob3VsZCBub3QgZXhjZWRlIDEgZGF5LlxuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBbcmVwb3J0aW5nSW50ZXJ2YWw9Myw2MDAsMDAwXSAgTnVtYmVyIG9mIG1pbGlzZWNvbmRzIGJldHdlZW4gc3VibWl0dGluZyB1c2FnZSByZXBvcnRzOyBkZWZhdWx0cyB0byBvbmNlIHBlciBob3VyXG4gKi9cblRlbGVtZXRyeU1vbml0b3IucHJvdG90eXBlLnJlcG9ydGluZ0ludGVydmFsID0gMTAwMCAqIDYwICogNjA7XG5cbi8qKlxuICogVG8gYXZvaWQgcGVyZm9ybWFuY2UgaXNzdWVzLCB3ZSBvbmx5IHdyaXRlIGNoYW5nZXMgYXN5bmNocm9ub3VzbHk7IHRoaXMgdGltZW91dElkIHRyYWNrcyB0aGF0IHRoaXMgaGFzIGJlZW4gc2NoZWR1bGVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByb3RvdHlwZS5fd3JpdGVUaW1lb3V0SWQgPSAwO1xuXG4vKipcbiAqIENvbnN0cnVjdG9yIHNldHMgdGhpcyB0byBiZSB0aGUga2V5IHdpdGhpbiBsb2NhbFN0b3JhZ2UgZm9yIGFjY2Vzc2luZyB0aGUgY2FjaGVkIHRlbGVtZXRyeSBkYXRhLlxuICpcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByb3RvdHlwZS5zdG9yYWdlS2V5ID0gJyc7XG5cbi8qKlxuICogQ3VycmVudCBzdGF0ZSBvYmplY3QuXG4gKlxuICogSW5pdGlhbGl6ZWQgd2l0aCBkYXRhIGZyb20gbG9jYWxTdG9yYWdlLCBhbmQgYW55IGNoYW5nZXMgdG8gaXQgYXJlIHdyaXR0ZW5cbiAqIGJhY2sgdG8gbG9jYWxTdG9yYWdlLlxuICpcbiAqIFNlbmRpbmcgcmVjb3JkcyBjYXVzZXMgdGhlbSB0byBiZSByZW1vdmVkIGZyb20gdGhlIHN0YXRlLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByb3RvdHlwZS5zdGF0ZSA9IG51bGw7XG5cbi8qKlxuICogQ2FjaGUgb2YgaW4tcHJvZ3Jlc3MgcGVyZm9ybWFuY2UgZXZlbnRzLlxuICpcbiAqIEVhY2gga2V5IGhhcyBhIHZhbHVlIHJlcHJlc2VudGluZyBhIHRpbWVzdGFtcC4gIEV2ZW50cyBhcmUgcmVtb3ZlZCBvbmNlIHRoZXkgYXJlIGNvbXBsZXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdH1cbiAqL1xuVGVsZW1ldHJ5TW9uaXRvci5wcm90b3R5cGUudGVtcFN0YXRlID0gbnVsbDtcblxuLyoqXG4gKiBUZWxlbWV0cnkgZGVmYXVsdHMgdG8gZW5hYmxlZCwgYnV0IGNhbiBiZSBkaXNhYmxlZCBieSBzZXR0aW5nIHRoaXMgdG8gYGZhbHNlYFxuICpcbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cbiAqL1xuVGVsZW1ldHJ5TW9uaXRvci5wcm90b3R5cGUuZW5hYmxlZCA9IHRydWU7XG5cbi8qKlxuICogUG9pbnRlciB0byB0aGUgbGF5ZXIuQ2xpZW50XG4gKlxuICogQHByb3BlcnR5IHtsYXllci5DbGllbnR9XG4gKi9cblRlbGVtZXRyeU1vbml0b3IucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogVGhlIHByZXNlbmNlIG9mIHRoaXMgY2F1c2VzIGxheWVyLlJvb3QgdG8gYXV0b21hdGljYWxseSBnZW5lcmF0ZSBhbiBpZCBpZiBvbmUgaXNuJ3QgcHJlc2VudC5cbiAqXG4gKiBUaGlzIGlkIGlzIHdyaXR0ZW4gdG8gbG9jYWxTdG9yYWdlIHNvIHRoYXQgaXQgY2FuIHBlcnNpc3QgYWNyb3NzIHNlc3Npb25zLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfVxuICovXG5UZWxlbWV0cnlNb25pdG9yLnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vdGVsZW1ldHJ5Lyc7XG5cblRlbGVtZXRyeU1vbml0b3IuX3N1cHBvcnRlZEV2ZW50cyA9IFJvb3QuX3N1cHBvcnRlZEV2ZW50cy5jb25jYXQoW1xuICAndGVsZW1ldHJ5LWVudmlyb25tZW50J1xuXSk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KFRlbGVtZXRyeU1vbml0b3IsIFtUZWxlbWV0cnlNb25pdG9yLCAnVGVsZW1ldHJ5TW9uaXRvciddKTtcbm1vZHVsZS5leHBvcnRzID0gVGVsZW1ldHJ5TW9uaXRvcjtcbiJdfQ==
