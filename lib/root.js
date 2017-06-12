'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./client-utils');
var LayerEvent = require('./layer-event');
var LayerError = require('./layer-error');
var Events = require('backbone-events-standalone/backbone-events-standalone');
var Logger = require('./logger');

/*
 * Provides a system bus that can be accessed by all components of the system.
 * Currently used to listen to messages sent via postMessage, but envisioned to
 * do far more.
 */
function EventClass() {}
EventClass.prototype = Events;

var SystemBus = new EventClass();
if (typeof postMessage === 'function') {
  addEventListener('message', function (event) {
    if (event.data.type === 'layer-delayed-event') {
      SystemBus.trigger(event.data.internalId + '-delayed-event');
    }
  });
}

// Used to generate a unique internalId for every Root instance
var uniqueIds = {};

// Regex for splitting an event string such as obj.on('evtName1 evtName2 evtName3')
var eventSplitter = /\s+/;

/**
 * The root class of all layer objects. Provides the following utilities
 *
 * 1. Mixes in the Backbone event model
 *
 *        var person = new Person();
 *        person.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        });
 *
 *        // Fire the console log handler:
 *        person.trigger('destroy');
 *
 *        // Unsubscribe
 *        person.off('destroy');
 *
 * 2. Adds a subscriptions object so that any event handlers on an object can be quickly found and removed
 *
 *        var person1 = new Person();
 *        var person2 = new Person();
 *        person2.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        }, person1);
 *
 *        // Pointers to person1 held onto by person2 are removed
 *        person1.destroy();
 *
 * 3. Adds support for event listeners in the constructor
 *    Any event handler can be passed into the constructor
 *    just as though it were a property.
 *
 *        var person = new Person({
 *            age: 150,
 *            destroy: function() {
 *                console.log('I have been destroyed!');
 *            }
 *        });
 *
 * 4. A _disableEvents property
 *
 *        myMethod() {
 *          if (this.isInitializing) {
 *              this._disableEvents = true;
 *
 *              // Event only received if _disableEvents = false
 *              this.trigger('destroy');
 *              this._disableEvents = false;
 *          }
 *        }
 *
 * 5. A _supportedEvents static property for each class
 *
 *     This property defines which events can be triggered.
 *
 *     * Any attempt to trigger
 *       an event not in _supportedEvents will log an error.
 *     * Any attempt to register a listener for an event not in _supportedEvents will
 *     *throw* an error.
 *
 *     This allows us to insure developers only subscribe to valid events.
 *
 *     This allows us to control what events can be fired and which ones blocked.
 *
 * 6. Adds an internalId property
 *
 *        var person = new Person();
 *        console.log(person.internalId); // -> 'Person1'
 *
 * 7. Adds a toObject method to create a simplified Plain Old Javacript Object from your object
 *
 *        var person = new Person();
 *        var simplePerson = person.toObject();
 *
 * 8. Provides __adjustProperty method support
 *
 *     For any property of a class, an `__adjustProperty` method can be defined.  If its defined,
 *     it will be called prior to setting that property, allowing:
 *
 *     A. Modification of the value that is actually set
 *     B. Validation of the value; throwing errors if invalid.
 *
 * 9. Provides __udpateProperty method support
 *
 *     After setting any property for which there is an `__updateProperty` method defined,
 *     the method will be called, allowing the new property to be applied.
 *
 *     Typically used for
 *
 *     A. Triggering events
 *     B. Firing XHR requests
 *     C. Updating the UI to match the new property value
 *
 *
 * @class layer.Root
 * @abstract
 * @author Michael Kantor
 */

var Root = function (_EventClass) {
  _inherits(Root, _EventClass);

  /**
   * Superclass constructor handles copying in properties and registering event handlers.
   *
   * @method constructor
   * @param  {Object} options - a hash of properties and event handlers
   * @return {layer.Root}
   */
  function Root() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Root);

    var _this = _possibleConstructorReturn(this, (Root.__proto__ || Object.getPrototypeOf(Root)).call(this));

    _this._layerEventSubscriptions = [];
    _this._delayedTriggers = [];
    _this._lastDelayedTrigger = Date.now();
    _this._events = {};

    // Generate an internalId
    var name = _this.constructor.name;
    if (!uniqueIds[name]) uniqueIds[name] = 0;
    _this.internalId = name + uniqueIds[name]++;

    // Every component listens to the SystemBus for postMessage (triggerAsync) events
    SystemBus.on(_this.internalId + '-delayed-event', _this._processDelayedTriggers, _this);

    // Generate a temporary id if there isn't an id
    if (!_this.id && !options.id && _this.constructor.prefixUUID) {
      _this.id = _this.constructor.prefixUUID + Utils.generateUUID();
    }

    // Copy in all properties; setup all event handlers
    var key = void 0;
    for (key in options) {
      if (_this.constructor._supportedEvents.indexOf(key) !== -1) {
        _this.on(key, options[key]);
      } else if (key in _this && typeof _this[key] !== 'function') {
        _this[key] = options[key];
      }
    }
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroys the object.
   *
   * Cleans up all events / subscriptions
   * and marks the object as isDestroyed.
   *
   * @method destroy
   */


  _createClass(Root, [{
    key: 'destroy',
    value: function destroy() {
      var _this2 = this;

      if (this.isDestroyed) throw new Error(LayerError.dictionary.alreadyDestroyed);

      // If anyone is listening, notify them
      this.trigger('destroy');

      // Cleanup pointers to SystemBus. Failure to call destroy
      // will have very serious consequences...
      SystemBus.off(this.internalId + '-delayed-event', null, this);

      // Remove all events, and all pointers passed to this object by other objects
      this.off();

      // Find all of the objects that this object has passed itself to in the form
      // of event handlers and remove all references to itself.
      this._layerEventSubscriptions.forEach(function (item) {
        return item.off(null, null, _this2);
      });

      this._layerEventSubscriptions = null;
      this._delayedTriggers = null;
      this.isDestroyed = true;
    }
  }, {
    key: 'toObject',


    /**
     * Convert class instance to Plain Javascript Object.
     *
     * Strips out all private members, and insures no datastructure loops.
     * Recursively converting all subobjects using calls to toObject.
     *
     *      console.dir(myobj.toObject());
     *
     * Note: While it would be tempting to have noChildren default to true,
     * this would result in Message.toObject() not outputing its MessageParts.
     *
     * Private data (_ prefixed properties) will not be output.
     *
     * @method toObject
     * @param  {boolean} [noChildren=false] Don't output sub-components
     * @return {Object}
     */
    value: function toObject() {
      var _this3 = this;

      var noChildren = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      this.__inToObject = true;
      var obj = {};

      // Iterate over all formally defined properties
      try {
        var keys = [];
        var aKey = void 0;
        for (aKey in this.constructor.prototype) {
          if (!(aKey in Root.prototype)) keys.push(aKey);
        }keys.forEach(function (key) {
          var v = _this3[key];

          // Ignore private/protected properties and functions
          if (key.indexOf('_') === 0) return;
          if (typeof v === 'function') return;

          // Generate arrays...
          if (Array.isArray(v)) {
            obj[key] = [];
            v.forEach(function (item) {
              if (item instanceof Root) {
                if (noChildren) {
                  delete obj[key];
                } else if (!item.__inToObject) {
                  obj[key].push(item.toObject());
                }
              } else {
                obj[key].push(item);
              }
            });
          }

          // Generate subcomponents
          else if (v instanceof Root) {
              if (!v.__inToObject && !noChildren) {
                obj[key] = v.toObject();
              }
            }

            // Generate dates (creates a copy to separate it from the source object)
            else if (v instanceof Date) {
                obj[key] = new Date(v);
              }

              // Generate simple properties
              else {
                  obj[key] = v;
                }
        });
      } catch (e) {
        // no-op
      }
      this.__inToObject = false;
      return obj;
    }

    /**
     * Log a warning for attempts to subscribe to unsupported events.
     *
     * @method _warnForEvent
     * @private
     */

  }, {
    key: '_warnForEvent',
    value: function _warnForEvent(eventName) {
      if (!Utils.includes(this.constructor._supportedEvents, eventName)) {
        throw new Error('Event ' + eventName + ' not defined for ' + this.toString());
      }
    }

    /**
     * Prepare for processing an event subscription call.
     *
     * If context is a Root class, add this object to the context's subscriptions.
     *
     * @method _prepareOn
     * @private
     */

  }, {
    key: '_prepareOn',
    value: function _prepareOn(name, handler, context) {
      var _this4 = this;

      if (context) {
        if (context instanceof Root) {
          if (context.isDestroyed) {
            throw new Error(LayerError.dictionary.isDestroyed);
          }
        }
        if (context._layerEventSubscriptions) {
          context._layerEventSubscriptions.push(this);
        }
      }
      if (typeof name === 'string' && name !== 'all') {
        if (eventSplitter.test(name)) {
          var names = name.split(eventSplitter);
          names.forEach(function (n) {
            return _this4._warnForEvent(n);
          });
        } else {
          this._warnForEvent(name);
        }
      } else if (name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object') {
        Object.keys(name).forEach(function (keyName) {
          return _this4._warnForEvent(keyName);
        });
      }
    }

    /**
     * Subscribe to events.
     *
     * Note that the context parameter serves double importance here:
     *
     * 1. It determines the context in which to execute the event handler
     * 2. Create a backlink so that if either subscriber or subscribee is destroyed,
     *    all pointers between them can be found and removed.
     *
     * ```
     * obj.on('someEventName someOtherEventName', mycallback, mycontext);
     * ```
     *
     * ```
     * obj.on({
     *    eventName1: callback1,
     *    eventName2: callback2
     * }, mycontext);
     * ```
     *
     * @method on
     * @param  {String} name - Name of the event
     * @param  {Function} handler - Event handler
     * @param  {layer.LayerEvent} handler.event - Event object delivered to the handler
     * @param  {Object} context - This pointer AND link to help with cleanup
     * @return {layer.Root} this
     */

  }, {
    key: 'on',
    value: function on(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.on.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Subscribe to the first occurance of the specified event.
     *
     * @method once
     * @return {layer.Root} this
     */

  }, {
    key: 'once',
    value: function once(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.once.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Unsubscribe from events.
     *
     * ```
     * // Removes all event handlers for this event:
     * obj.off('someEventName');
     *
     * // Removes all event handlers using this function pointer as callback
     * obj.off(null, f, null);
     *
     * // Removes all event handlers that `this` has subscribed to; requires
     * // obj.on to be called with `this` as its `context` parameter.
     * obj.off(null, null, this);
     * ```
     *
     * @method off
     * @param  {String} name - Name of the event; null for all event names
     * @param  {Function} handler - Event handler; null for all functions
     * @param  {Object} context - The context from the `on()` call to search for; null for all contexts
     * @return {layer.Root} this
     */

    /**
     * Trigger an event for any event listeners.
     *
     * Events triggered this way will be blocked if _disableEvents = true
     *
     * @method trigger
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: 'trigger',
    value: function trigger() {
      if (this._disableEvents) return this;
      return this._trigger.apply(this, arguments);
    }

    /**
     * Triggers an event.
     *
     * @method trigger
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     */

  }, {
    key: '_trigger',
    value: function _trigger() {
      if (!Utils.includes(this.constructor._supportedEvents, arguments.length <= 0 ? undefined : arguments[0])) {
        if (!Utils.includes(this.constructor._ignoredEvents, arguments.length <= 0 ? undefined : arguments[0])) {
          Logger.error(this.toString() + ' ignored ' + (arguments.length <= 0 ? undefined : arguments[0]));
        }
        return;
      }

      var computedArgs = this._getTriggerArgs.apply(this, arguments);

      Events.trigger.apply(this, computedArgs);

      var parentProp = this.constructor.bubbleEventParent;
      if (parentProp && (arguments.length <= 0 ? undefined : arguments[0]) !== 'destroy') {
        var _parentValue;

        var parentValue = this[parentProp];
        parentValue = typeof parentValue === 'function' ? parentValue.apply(this) : parentValue;
        if (parentValue) (_parentValue = parentValue).trigger.apply(_parentValue, _toConsumableArray(computedArgs));
      }
    }

    /**
     * Generates a layer.LayerEvent from a trigger call's arguments.
     *
     * * If parameter is already a layer.LayerEvent, we're done.
     * * If parameter is an object, a `target` property is added to that object and its delivered to all subscribers
     * * If the parameter is non-object value, it is added to an object with a `target` property, and the value is put in
     *   the `data` property.
     *
     * @method _getTriggerArgs
     * @private
     * @return {Mixed[]} - First element of array is eventName, second element is layer.LayerEvent.
     */

  }, {
    key: '_getTriggerArgs',
    value: function _getTriggerArgs() {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var computedArgs = Array.prototype.slice.call(args);

      if (args[1]) {
        var newArg = { target: this };

        if (computedArgs[1] instanceof LayerEvent) {
          // A LayerEvent will be an argument when bubbling events up; these args can be used as-is
        } else {
          if (_typeof(computedArgs[1]) === 'object') {
            Object.keys(computedArgs[1]).forEach(function (name) {
              return newArg[name] = computedArgs[1][name];
            });
          } else {
            newArg.data = computedArgs[1];
          }
          computedArgs[1] = new LayerEvent(newArg, computedArgs[0]);
        }
      } else {
        computedArgs[1] = new LayerEvent({ target: this }, computedArgs[0]);
      }

      return computedArgs;
    }

    /**
     * Same as _trigger() method, but delays briefly before firing.
     *
     * When would you want to delay an event?
     *
     * 1. There is an event rollup that may be needed for the event;
     *    this requires the framework to be able to see ALL events that have been
     *    generated, roll them up, and THEN fire them.
     * 2. The event is intended for UI rendering... which should not hold up the rest of
     *    this framework's execution.
     *
     * When NOT to delay an event?
     *
     * 1. Lifecycle events frequently require response at the time the event has fired
     *
     * @method _triggerAsync
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: '_triggerAsync',
    value: function _triggerAsync() {
      var _this5 = this;

      var computedArgs = this._getTriggerArgs.apply(this, arguments);
      this._delayedTriggers.push(computedArgs);

      // NOTE: It is unclear at this time how it happens, but on very rare occasions, we see processDelayedTriggers
      // fail to get called when length = 1, and after that length just continuously grows.  So we add
      // the _lastDelayedTrigger test to insure that it will still run.
      var shouldScheduleTrigger = this._delayedTriggers.length === 1 || this._delayedTriggers.length && this._lastDelayedTrigger + 500 < Date.now();
      if (shouldScheduleTrigger) {
        this._lastDelayedTrigger = Date.now();
        if (typeof postMessage === 'function' && typeof jasmine === 'undefined') {
          var messageData = {
            type: 'layer-delayed-event',
            internalId: this.internalId
          };
          if (typeof document !== 'undefined') {
            window.postMessage(messageData, '*');
          } else {
            // React Native reportedly lacks a document, and throws errors on the second parameter
            window.postMessage(messageData);
          }
        } else {
          setTimeout(function () {
            return _this5._processDelayedTriggers();
          }, 0);
        }
      }
    }

    /**
     * Combines a set of events into a single event.
     *
     * Given an event structure of
     * ```
     *      {
     *          customName: [value1]
     *      }
     *      {
     *          customName: [value2]
     *      }
     *      {
     *          customName: [value3]
     *      }
     * ```
     *
     * Merge them into
     *
     * ```
     *      {
     *          customName: [value1, value2, value3]
     *      }
     * ```
     *
     * @method _foldEvents
     * @private
     * @param  {layer.LayerEvent[]} events
     * @param  {string} name      Name of the property (i.e. 'customName')
     * @param  {layer.Root}    newTarget Value of the target for the folded resulting event
     */

  }, {
    key: '_foldEvents',
    value: function _foldEvents(events, name, newTarget) {
      var _this6 = this;

      var firstEvt = events.length ? events[0][1] : null;
      var firstEvtProp = firstEvt ? firstEvt[name] : null;
      events.forEach(function (evt, i) {
        if (i > 0) {
          firstEvtProp.push(evt[1][name][0]);
          _this6._delayedTriggers.splice(_this6._delayedTriggers.indexOf(evt), 1);
        }
      });
      if (events.length && newTarget) events[0][1].target = newTarget;
    }

    /**
     * Fold a set of Change events into a single Change event.
     *
     * Given a set change events on this component,
     * fold all change events into a single event via
     * the layer.LayerEvent's changes array.
     *
     * @method _foldChangeEvents
     * @private
     */

  }, {
    key: '_foldChangeEvents',
    value: function _foldChangeEvents() {
      var _this7 = this;

      var events = this._delayedTriggers.filter(function (evt) {
        return evt[1].isChange;
      });
      events.forEach(function (evt, i) {
        if (i > 0) {
          events[0][1]._mergeChanges(evt[1]);
          _this7._delayedTriggers.splice(_this7._delayedTriggers.indexOf(evt), 1);
        }
      });
    }

    /**
     * Execute all delayed events for this compoennt.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;
      this._foldChangeEvents();

      this._delayedTriggers.forEach(function (evt) {
        this.trigger.apply(this, _toConsumableArray(evt));
      }, this);
      this._delayedTriggers = [];
    }
  }, {
    key: '_runMixins',
    value: function _runMixins(mixinName, argArray) {
      var _this8 = this;

      this.constructor.mixins.forEach(function (mixin) {
        if (mixin.lifecycle[mixinName]) mixin.lifecycle[mixinName].apply(_this8, argArray);
      });
    }

    /**
     * Returns a string representation of the class that is nicer than `[Object]`.
     *
     * @method toString
     * @return {String}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.internalId;
    }
  }], [{
    key: 'isValidId',
    value: function isValidId(id) {
      return id.indexOf(this.prefixUUID) === 0;
    }
  }]);

  return Root;
}(EventClass);

function defineProperty(newClass, propertyName) {
  var pKey = '__' + propertyName;
  var camel = propertyName.substring(0, 1).toUpperCase() + propertyName.substring(1);
  var hasDefinitions = newClass.prototype['__adjust' + camel] || newClass.prototype['__update' + camel] || newClass.prototype['__get' + camel];
  if (hasDefinitions) {
    // set default value
    newClass.prototype[pKey] = newClass.prototype[propertyName];

    Object.defineProperty(newClass.prototype, propertyName, {
      enumerable: true,
      get: function get() {
        return this['__get' + camel] ? this['__get' + camel](pKey) : this[pKey];
      },
      set: function set(inValue) {
        if (this.isDestroyed) return;
        var initial = this[pKey];
        if (inValue !== initial) {
          if (this['__adjust' + camel]) {
            var result = this['__adjust' + camel](inValue);
            if (result !== undefined) inValue = result;
          }
          this[pKey] = inValue;
        }
        if (inValue !== initial) {
          if (!this.isInitializing && this['__update' + camel]) {
            this['__update' + camel](inValue, initial);
          }
        }
      }
    });
  }
}

function initClass(newClass, className) {
  // Make sure our new class has a name property
  if (!newClass.name) newClass.name = className;

  // Make sure our new class has a _supportedEvents, _ignoredEvents, _inObjectIgnore and EVENTS properties
  if (!newClass._supportedEvents) newClass._supportedEvents = Root._supportedEvents;
  if (!newClass._ignoredEvents) newClass._ignoredEvents = Root._ignoredEvents;

  if (newClass.mixins) {
    newClass.mixins.forEach(function (mixin) {
      if (mixin.events) newClass._supportedEvents = newClass._supportedEvents.concat(mixin.events);
      if (mixin.properties) {
        Object.keys(mixin.properties).forEach(function (key) {
          newClass.prototype[key] = mixin.properties[key];
        });
      }
      if (mixin.methods) {
        Object.keys(mixin.methods).forEach(function (key) {
          newClass.prototype[key] = mixin.methods[key];
        });
      }
    });
  }

  // Generate a list of properties for this class; we don't include any
  // properties from layer.Root
  var keys = Object.keys(newClass.prototype).filter(function (key) {
    return newClass.prototype.hasOwnProperty(key) && !Root.prototype.hasOwnProperty(key) && typeof newClass.prototype[key] !== 'function';
  });

  // Define getters/setters for any property that has __adjust or __update methods defined
  keys.forEach(function (name) {
    return defineProperty(newClass, name);
  });
}

/**
 * Set to true once destroy() has been called.
 *
 * A destroyed object will likely cause errors in any attempt
 * to call methods on it, and will no longer trigger events.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isDestroyed = false;

/**
 * Every instance has its own internal ID.
 *
 * This ID is distinct from any IDs assigned by the server.
 * The internal ID is gaurenteed not to change within the lifetime of the Object/session;
 * it is possible, on creating a new object, for its `id` property to change.
 *
 * @type {string}
 * @readonly
 */
Root.prototype.internalId = '';

/**
 * True while we are in the constructor.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isInitializing = true;

/**
 * Objects that this object is listening for events from.
 *
 * @type {layer.Root[]}
 * @private
 */
Root.prototype._layerEventSubscriptions = null;

/**
 * Disable all events triggered on this object.
 * @type {boolean}
 * @private
 */
Root.prototype._disableEvents = false;

Root._supportedEvents = ['destroy', 'all'];
Root._ignoredEvents = [];
module.exports = Root;
module.exports.initClass = initClass;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yb290LmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsIkxheWVyRXZlbnQiLCJMYXllckVycm9yIiwiRXZlbnRzIiwiTG9nZ2VyIiwiRXZlbnRDbGFzcyIsInByb3RvdHlwZSIsIlN5c3RlbUJ1cyIsInBvc3RNZXNzYWdlIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50IiwiZGF0YSIsInR5cGUiLCJ0cmlnZ2VyIiwiaW50ZXJuYWxJZCIsInVuaXF1ZUlkcyIsImV2ZW50U3BsaXR0ZXIiLCJSb290Iiwib3B0aW9ucyIsIl9sYXllckV2ZW50U3Vic2NyaXB0aW9ucyIsIl9kZWxheWVkVHJpZ2dlcnMiLCJfbGFzdERlbGF5ZWRUcmlnZ2VyIiwiRGF0ZSIsIm5vdyIsIl9ldmVudHMiLCJuYW1lIiwiY29uc3RydWN0b3IiLCJvbiIsIl9wcm9jZXNzRGVsYXllZFRyaWdnZXJzIiwiaWQiLCJwcmVmaXhVVUlEIiwiZ2VuZXJhdGVVVUlEIiwia2V5IiwiX3N1cHBvcnRlZEV2ZW50cyIsImluZGV4T2YiLCJpc0luaXRpYWxpemluZyIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiYWxyZWFkeURlc3Ryb3llZCIsIm9mZiIsImZvckVhY2giLCJpdGVtIiwibm9DaGlsZHJlbiIsIl9faW5Ub09iamVjdCIsIm9iaiIsImtleXMiLCJhS2V5IiwicHVzaCIsInYiLCJBcnJheSIsImlzQXJyYXkiLCJ0b09iamVjdCIsImUiLCJldmVudE5hbWUiLCJpbmNsdWRlcyIsInRvU3RyaW5nIiwiaGFuZGxlciIsImNvbnRleHQiLCJ0ZXN0IiwibmFtZXMiLCJzcGxpdCIsIl93YXJuRm9yRXZlbnQiLCJuIiwiT2JqZWN0Iiwia2V5TmFtZSIsIl9wcmVwYXJlT24iLCJhcHBseSIsIm9uY2UiLCJfZGlzYWJsZUV2ZW50cyIsIl90cmlnZ2VyIiwiX2lnbm9yZWRFdmVudHMiLCJlcnJvciIsImNvbXB1dGVkQXJncyIsIl9nZXRUcmlnZ2VyQXJncyIsInBhcmVudFByb3AiLCJidWJibGVFdmVudFBhcmVudCIsInBhcmVudFZhbHVlIiwiYXJncyIsInNsaWNlIiwiY2FsbCIsIm5ld0FyZyIsInRhcmdldCIsInNob3VsZFNjaGVkdWxlVHJpZ2dlciIsImxlbmd0aCIsImphc21pbmUiLCJtZXNzYWdlRGF0YSIsImRvY3VtZW50Iiwid2luZG93Iiwic2V0VGltZW91dCIsImV2ZW50cyIsIm5ld1RhcmdldCIsImZpcnN0RXZ0IiwiZmlyc3RFdnRQcm9wIiwiZXZ0IiwiaSIsInNwbGljZSIsImZpbHRlciIsImlzQ2hhbmdlIiwiX21lcmdlQ2hhbmdlcyIsIl9mb2xkQ2hhbmdlRXZlbnRzIiwibWl4aW5OYW1lIiwiYXJnQXJyYXkiLCJtaXhpbnMiLCJtaXhpbiIsImxpZmVjeWNsZSIsImRlZmluZVByb3BlcnR5IiwibmV3Q2xhc3MiLCJwcm9wZXJ0eU5hbWUiLCJwS2V5IiwiY2FtZWwiLCJzdWJzdHJpbmciLCJ0b1VwcGVyQ2FzZSIsImhhc0RlZmluaXRpb25zIiwiZW51bWVyYWJsZSIsImdldCIsInNldCIsImluVmFsdWUiLCJpbml0aWFsIiwicmVzdWx0IiwidW5kZWZpbmVkIiwiaW5pdENsYXNzIiwiY2xhc3NOYW1lIiwiY29uY2F0IiwicHJvcGVydGllcyIsIm1ldGhvZHMiLCJoYXNPd25Qcm9wZXJ0eSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBTUEsUUFBUUMsUUFBUSxnQkFBUixDQUFkO0FBQ0EsSUFBTUMsYUFBYUQsUUFBUSxlQUFSLENBQW5CO0FBQ0EsSUFBTUUsYUFBYUYsUUFBUSxlQUFSLENBQW5CO0FBQ0EsSUFBTUcsU0FBU0gsUUFBUSx1REFBUixDQUFmO0FBQ0EsSUFBTUksU0FBU0osUUFBUSxVQUFSLENBQWY7O0FBRUE7Ozs7O0FBS0EsU0FBU0ssVUFBVCxHQUFzQixDQUFHO0FBQ3pCQSxXQUFXQyxTQUFYLEdBQXVCSCxNQUF2Qjs7QUFFQSxJQUFNSSxZQUFZLElBQUlGLFVBQUosRUFB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T0FBUCxHQUFpQi9HLElBQWpCO0FBQ0E4RyxPQUFPQyxPQUFQLENBQWVQLFNBQWYsR0FBMkJBLFNBQTNCIiwiZmlsZSI6InJvb3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBMYXllckV2ZW50ID0gcmVxdWlyZSgnLi9sYXllci1ldmVudCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IEV2ZW50cyA9IHJlcXVpcmUoJ2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lJyk7XG5jb25zdCBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG4vKlxuICogUHJvdmlkZXMgYSBzeXN0ZW0gYnVzIHRoYXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IGFsbCBjb21wb25lbnRzIG9mIHRoZSBzeXN0ZW0uXG4gKiBDdXJyZW50bHkgdXNlZCB0byBsaXN0ZW4gdG8gbWVzc2FnZXMgc2VudCB2aWEgcG9zdE1lc3NhZ2UsIGJ1dCBlbnZpc2lvbmVkIHRvXG4gKiBkbyBmYXIgbW9yZS5cbiAqL1xuZnVuY3Rpb24gRXZlbnRDbGFzcygpIHsgfVxuRXZlbnRDbGFzcy5wcm90b3R5cGUgPSBFdmVudHM7XG5cbmNvbnN0IFN5c3RlbUJ1cyA9IG5ldyBFdmVudENsYXNzKCk7XG5pZiAodHlwZW9mIHBvc3RNZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XG4gIGFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICBpZiAoZXZlbnQuZGF0YS50eXBlID09PSAnbGF5ZXItZGVsYXllZC1ldmVudCcpIHtcbiAgICAgIFN5c3RlbUJ1cy50cmlnZ2VyKGV2ZW50LmRhdGEuaW50ZXJuYWxJZCArICctZGVsYXllZC1ldmVudCcpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIFVzZWQgdG8gZ2VuZXJhdGUgYSB1bmlxdWUgaW50ZXJuYWxJZCBmb3IgZXZlcnkgUm9vdCBpbnN0YW5jZVxuY29uc3QgdW5pcXVlSWRzID0ge307XG5cbi8vIFJlZ2V4IGZvciBzcGxpdHRpbmcgYW4gZXZlbnQgc3RyaW5nIHN1Y2ggYXMgb2JqLm9uKCdldnROYW1lMSBldnROYW1lMiBldnROYW1lMycpXG5jb25zdCBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4vKipcbiAqIFRoZSByb290IGNsYXNzIG9mIGFsbCBsYXllciBvYmplY3RzLiBQcm92aWRlcyB0aGUgZm9sbG93aW5nIHV0aWxpdGllc1xuICpcbiAqIDEuIE1peGVzIGluIHRoZSBCYWNrYm9uZSBldmVudCBtb2RlbFxuICpcbiAqICAgICAgICB2YXIgcGVyc29uID0gbmV3IFBlcnNvbigpO1xuICogICAgICAgIHBlcnNvbi5vbignZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICBjb25zb2xlLmxvZygnSSBoYXZlIGJlZW4gZGVzdHJveWVkIScpO1xuICogICAgICAgIH0pO1xuICpcbiAqICAgICAgICAvLyBGaXJlIHRoZSBjb25zb2xlIGxvZyBoYW5kbGVyOlxuICogICAgICAgIHBlcnNvbi50cmlnZ2VyKCdkZXN0cm95Jyk7XG4gKlxuICogICAgICAgIC8vIFVuc3Vic2NyaWJlXG4gKiAgICAgICAgcGVyc29uLm9mZignZGVzdHJveScpO1xuICpcbiAqIDIuIEFkZHMgYSBzdWJzY3JpcHRpb25zIG9iamVjdCBzbyB0aGF0IGFueSBldmVudCBoYW5kbGVycyBvbiBhbiBvYmplY3QgY2FuIGJlIHF1aWNrbHkgZm91bmQgYW5kIHJlbW92ZWRcbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbjEgPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgdmFyIHBlcnNvbjIgPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgcGVyc29uMi5vbignZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICBjb25zb2xlLmxvZygnSSBoYXZlIGJlZW4gZGVzdHJveWVkIScpO1xuICogICAgICAgIH0sIHBlcnNvbjEpO1xuICpcbiAqICAgICAgICAvLyBQb2ludGVycyB0byBwZXJzb24xIGhlbGQgb250byBieSBwZXJzb24yIGFyZSByZW1vdmVkXG4gKiAgICAgICAgcGVyc29uMS5kZXN0cm95KCk7XG4gKlxuICogMy4gQWRkcyBzdXBwb3J0IGZvciBldmVudCBsaXN0ZW5lcnMgaW4gdGhlIGNvbnN0cnVjdG9yXG4gKiAgICBBbnkgZXZlbnQgaGFuZGxlciBjYW4gYmUgcGFzc2VkIGludG8gdGhlIGNvbnN0cnVjdG9yXG4gKiAgICBqdXN0IGFzIHRob3VnaCBpdCB3ZXJlIGEgcHJvcGVydHkuXG4gKlxuICogICAgICAgIHZhciBwZXJzb24gPSBuZXcgUGVyc29uKHtcbiAqICAgICAgICAgICAgYWdlOiAxNTAsXG4gKiAgICAgICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0kgaGF2ZSBiZWVuIGRlc3Ryb3llZCEnKTtcbiAqICAgICAgICAgICAgfVxuICogICAgICAgIH0pO1xuICpcbiAqIDQuIEEgX2Rpc2FibGVFdmVudHMgcHJvcGVydHlcbiAqXG4gKiAgICAgICAgbXlNZXRob2QoKSB7XG4gKiAgICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemluZykge1xuICogICAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSB0cnVlO1xuICpcbiAqICAgICAgICAgICAgICAvLyBFdmVudCBvbmx5IHJlY2VpdmVkIGlmIF9kaXNhYmxlRXZlbnRzID0gZmFsc2VcbiAqICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2Rlc3Ryb3knKTtcbiAqICAgICAgICAgICAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gKiAgICAgICAgICB9XG4gKiAgICAgICAgfVxuICpcbiAqIDUuIEEgX3N1cHBvcnRlZEV2ZW50cyBzdGF0aWMgcHJvcGVydHkgZm9yIGVhY2ggY2xhc3NcbiAqXG4gKiAgICAgVGhpcyBwcm9wZXJ0eSBkZWZpbmVzIHdoaWNoIGV2ZW50cyBjYW4gYmUgdHJpZ2dlcmVkLlxuICpcbiAqICAgICAqIEFueSBhdHRlbXB0IHRvIHRyaWdnZXJcbiAqICAgICAgIGFuIGV2ZW50IG5vdCBpbiBfc3VwcG9ydGVkRXZlbnRzIHdpbGwgbG9nIGFuIGVycm9yLlxuICogICAgICogQW55IGF0dGVtcHQgdG8gcmVnaXN0ZXIgYSBsaXN0ZW5lciBmb3IgYW4gZXZlbnQgbm90IGluIF9zdXBwb3J0ZWRFdmVudHMgd2lsbFxuICogICAgICp0aHJvdyogYW4gZXJyb3IuXG4gKlxuICogICAgIFRoaXMgYWxsb3dzIHVzIHRvIGluc3VyZSBkZXZlbG9wZXJzIG9ubHkgc3Vic2NyaWJlIHRvIHZhbGlkIGV2ZW50cy5cbiAqXG4gKiAgICAgVGhpcyBhbGxvd3MgdXMgdG8gY29udHJvbCB3aGF0IGV2ZW50cyBjYW4gYmUgZmlyZWQgYW5kIHdoaWNoIG9uZXMgYmxvY2tlZC5cbiAqXG4gKiA2LiBBZGRzIGFuIGludGVybmFsSWQgcHJvcGVydHlcbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbiA9IG5ldyBQZXJzb24oKTtcbiAqICAgICAgICBjb25zb2xlLmxvZyhwZXJzb24uaW50ZXJuYWxJZCk7IC8vIC0+ICdQZXJzb24xJ1xuICpcbiAqIDcuIEFkZHMgYSB0b09iamVjdCBtZXRob2QgdG8gY3JlYXRlIGEgc2ltcGxpZmllZCBQbGFpbiBPbGQgSmF2YWNyaXB0IE9iamVjdCBmcm9tIHlvdXIgb2JqZWN0XG4gKlxuICogICAgICAgIHZhciBwZXJzb24gPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgdmFyIHNpbXBsZVBlcnNvbiA9IHBlcnNvbi50b09iamVjdCgpO1xuICpcbiAqIDguIFByb3ZpZGVzIF9fYWRqdXN0UHJvcGVydHkgbWV0aG9kIHN1cHBvcnRcbiAqXG4gKiAgICAgRm9yIGFueSBwcm9wZXJ0eSBvZiBhIGNsYXNzLCBhbiBgX19hZGp1c3RQcm9wZXJ0eWAgbWV0aG9kIGNhbiBiZSBkZWZpbmVkLiAgSWYgaXRzIGRlZmluZWQsXG4gKiAgICAgaXQgd2lsbCBiZSBjYWxsZWQgcHJpb3IgdG8gc2V0dGluZyB0aGF0IHByb3BlcnR5LCBhbGxvd2luZzpcbiAqXG4gKiAgICAgQS4gTW9kaWZpY2F0aW9uIG9mIHRoZSB2YWx1ZSB0aGF0IGlzIGFjdHVhbGx5IHNldFxuICogICAgIEIuIFZhbGlkYXRpb24gb2YgdGhlIHZhbHVlOyB0aHJvd2luZyBlcnJvcnMgaWYgaW52YWxpZC5cbiAqXG4gKiA5LiBQcm92aWRlcyBfX3VkcGF0ZVByb3BlcnR5IG1ldGhvZCBzdXBwb3J0XG4gKlxuICogICAgIEFmdGVyIHNldHRpbmcgYW55IHByb3BlcnR5IGZvciB3aGljaCB0aGVyZSBpcyBhbiBgX191cGRhdGVQcm9wZXJ0eWAgbWV0aG9kIGRlZmluZWQsXG4gKiAgICAgdGhlIG1ldGhvZCB3aWxsIGJlIGNhbGxlZCwgYWxsb3dpbmcgdGhlIG5ldyBwcm9wZXJ0eSB0byBiZSBhcHBsaWVkLlxuICpcbiAqICAgICBUeXBpY2FsbHkgdXNlZCBmb3JcbiAqXG4gKiAgICAgQS4gVHJpZ2dlcmluZyBldmVudHNcbiAqICAgICBCLiBGaXJpbmcgWEhSIHJlcXVlc3RzXG4gKiAgICAgQy4gVXBkYXRpbmcgdGhlIFVJIHRvIG1hdGNoIHRoZSBuZXcgcHJvcGVydHkgdmFsdWVcbiAqXG4gKlxuICogQGNsYXNzIGxheWVyLlJvb3RcbiAqIEBhYnN0cmFjdFxuICogQGF1dGhvciBNaWNoYWVsIEthbnRvclxuICovXG5jbGFzcyBSb290IGV4dGVuZHMgRXZlbnRDbGFzcyB7XG5cbiAgLyoqXG4gICAqIFN1cGVyY2xhc3MgY29uc3RydWN0b3IgaGFuZGxlcyBjb3B5aW5nIGluIHByb3BlcnRpZXMgYW5kIHJlZ2lzdGVyaW5nIGV2ZW50IGhhbmRsZXJzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIGEgaGFzaCBvZiBwcm9wZXJ0aWVzIGFuZCBldmVudCBoYW5kbGVyc1xuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9sYXllckV2ZW50U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHRoaXMuX2RlbGF5ZWRUcmlnZ2VycyA9IFtdO1xuICAgIHRoaXMuX2xhc3REZWxheWVkVHJpZ2dlciA9IERhdGUubm93KCk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgICAvLyBHZW5lcmF0ZSBhbiBpbnRlcm5hbElkXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZTtcbiAgICBpZiAoIXVuaXF1ZUlkc1tuYW1lXSkgdW5pcXVlSWRzW25hbWVdID0gMDtcbiAgICB0aGlzLmludGVybmFsSWQgPSBuYW1lICsgdW5pcXVlSWRzW25hbWVdKys7XG5cbiAgICAvLyBFdmVyeSBjb21wb25lbnQgbGlzdGVucyB0byB0aGUgU3lzdGVtQnVzIGZvciBwb3N0TWVzc2FnZSAodHJpZ2dlckFzeW5jKSBldmVudHNcbiAgICBTeXN0ZW1CdXMub24odGhpcy5pbnRlcm5hbElkICsgJy1kZWxheWVkLWV2ZW50JywgdGhpcy5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycywgdGhpcyk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhIHRlbXBvcmFyeSBpZCBpZiB0aGVyZSBpc24ndCBhbiBpZFxuICAgIGlmICghdGhpcy5pZCAmJiAhb3B0aW9ucy5pZCAmJiB0aGlzLmNvbnN0cnVjdG9yLnByZWZpeFVVSUQpIHtcbiAgICAgIHRoaXMuaWQgPSB0aGlzLmNvbnN0cnVjdG9yLnByZWZpeFVVSUQgKyBVdGlscy5nZW5lcmF0ZVVVSUQoKTtcbiAgICB9XG5cbiAgICAvLyBDb3B5IGluIGFsbCBwcm9wZXJ0aWVzOyBzZXR1cCBhbGwgZXZlbnQgaGFuZGxlcnNcbiAgICBsZXQga2V5O1xuICAgIGZvciAoa2V5IGluIG9wdGlvbnMpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLl9zdXBwb3J0ZWRFdmVudHMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuICAgICAgICB0aGlzLm9uKGtleSwgb3B0aW9uc1trZXldKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5IGluIHRoaXMgJiYgdHlwZW9mIHRoaXNba2V5XSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzW2tleV0gPSBvcHRpb25zW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95cyB0aGUgb2JqZWN0LlxuICAgKlxuICAgKiBDbGVhbnMgdXAgYWxsIGV2ZW50cyAvIHN1YnNjcmlwdGlvbnNcbiAgICogYW5kIG1hcmtzIHRoZSBvYmplY3QgYXMgaXNEZXN0cm95ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hbHJlYWR5RGVzdHJveWVkKTtcblxuICAgIC8vIElmIGFueW9uZSBpcyBsaXN0ZW5pbmcsIG5vdGlmeSB0aGVtXG4gICAgdGhpcy50cmlnZ2VyKCdkZXN0cm95Jyk7XG5cbiAgICAvLyBDbGVhbnVwIHBvaW50ZXJzIHRvIFN5c3RlbUJ1cy4gRmFpbHVyZSB0byBjYWxsIGRlc3Ryb3lcbiAgICAvLyB3aWxsIGhhdmUgdmVyeSBzZXJpb3VzIGNvbnNlcXVlbmNlcy4uLlxuICAgIFN5c3RlbUJ1cy5vZmYodGhpcy5pbnRlcm5hbElkICsgJy1kZWxheWVkLWV2ZW50JywgbnVsbCwgdGhpcyk7XG5cbiAgICAvLyBSZW1vdmUgYWxsIGV2ZW50cywgYW5kIGFsbCBwb2ludGVycyBwYXNzZWQgdG8gdGhpcyBvYmplY3QgYnkgb3RoZXIgb2JqZWN0c1xuICAgIHRoaXMub2ZmKCk7XG5cbiAgICAvLyBGaW5kIGFsbCBvZiB0aGUgb2JqZWN0cyB0aGF0IHRoaXMgb2JqZWN0IGhhcyBwYXNzZWQgaXRzZWxmIHRvIGluIHRoZSBmb3JtXG4gICAgLy8gb2YgZXZlbnQgaGFuZGxlcnMgYW5kIHJlbW92ZSBhbGwgcmVmZXJlbmNlcyB0byBpdHNlbGYuXG4gICAgdGhpcy5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMuZm9yRWFjaChpdGVtID0+IGl0ZW0ub2ZmKG51bGwsIG51bGwsIHRoaXMpKTtcblxuICAgIHRoaXMuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zID0gbnVsbDtcbiAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMgPSBudWxsO1xuICAgIHRoaXMuaXNEZXN0cm95ZWQgPSB0cnVlO1xuICB9XG5cbiAgc3RhdGljIGlzVmFsaWRJZChpZCkge1xuICAgIHJldHVybiBpZC5pbmRleE9mKHRoaXMucHJlZml4VVVJRCkgPT09IDA7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBjbGFzcyBpbnN0YW5jZSB0byBQbGFpbiBKYXZhc2NyaXB0IE9iamVjdC5cbiAgICpcbiAgICogU3RyaXBzIG91dCBhbGwgcHJpdmF0ZSBtZW1iZXJzLCBhbmQgaW5zdXJlcyBubyBkYXRhc3RydWN0dXJlIGxvb3BzLlxuICAgKiBSZWN1cnNpdmVseSBjb252ZXJ0aW5nIGFsbCBzdWJvYmplY3RzIHVzaW5nIGNhbGxzIHRvIHRvT2JqZWN0LlxuICAgKlxuICAgKiAgICAgIGNvbnNvbGUuZGlyKG15b2JqLnRvT2JqZWN0KCkpO1xuICAgKlxuICAgKiBOb3RlOiBXaGlsZSBpdCB3b3VsZCBiZSB0ZW1wdGluZyB0byBoYXZlIG5vQ2hpbGRyZW4gZGVmYXVsdCB0byB0cnVlLFxuICAgKiB0aGlzIHdvdWxkIHJlc3VsdCBpbiBNZXNzYWdlLnRvT2JqZWN0KCkgbm90IG91dHB1dGluZyBpdHMgTWVzc2FnZVBhcnRzLlxuICAgKlxuICAgKiBQcml2YXRlIGRhdGEgKF8gcHJlZml4ZWQgcHJvcGVydGllcykgd2lsbCBub3QgYmUgb3V0cHV0LlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtub0NoaWxkcmVuPWZhbHNlXSBEb24ndCBvdXRwdXQgc3ViLWNvbXBvbmVudHNcbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgdG9PYmplY3Qobm9DaGlsZHJlbiA9IGZhbHNlKSB7XG4gICAgdGhpcy5fX2luVG9PYmplY3QgPSB0cnVlO1xuICAgIGNvbnN0IG9iaiA9IHt9O1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFsbCBmb3JtYWxseSBkZWZpbmVkIHByb3BlcnRpZXNcbiAgICB0cnkge1xuICAgICAgY29uc3Qga2V5cyA9IFtdO1xuICAgICAgbGV0IGFLZXk7XG4gICAgICBmb3IgKGFLZXkgaW4gdGhpcy5jb25zdHJ1Y3Rvci5wcm90b3R5cGUpIGlmICghKGFLZXkgaW4gUm9vdC5wcm90b3R5cGUpKSBrZXlzLnB1c2goYUtleSk7XG5cbiAgICAgIGtleXMuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgIGNvbnN0IHYgPSB0aGlzW2tleV07XG5cbiAgICAgICAgLy8gSWdub3JlIHByaXZhdGUvcHJvdGVjdGVkIHByb3BlcnRpZXMgYW5kIGZ1bmN0aW9uc1xuICAgICAgICBpZiAoa2V5LmluZGV4T2YoJ18nKSA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHJldHVybjtcblxuICAgICAgICAvLyBHZW5lcmF0ZSBhcnJheXMuLi5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodikpIHtcbiAgICAgICAgICBvYmpba2V5XSA9IFtdO1xuICAgICAgICAgIHYuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBSb290KSB7XG4gICAgICAgICAgICAgIGlmIChub0NoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIG9ialtrZXldO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFpdGVtLl9faW5Ub09iamVjdCkge1xuICAgICAgICAgICAgICAgIG9ialtrZXldLnB1c2goaXRlbS50b09iamVjdCgpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2JqW2tleV0ucHVzaChpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHN1YmNvbXBvbmVudHNcbiAgICAgICAgZWxzZSBpZiAodiBpbnN0YW5jZW9mIFJvb3QpIHtcbiAgICAgICAgICBpZiAoIXYuX19pblRvT2JqZWN0ICYmICFub0NoaWxkcmVuKSB7XG4gICAgICAgICAgICBvYmpba2V5XSA9IHYudG9PYmplY3QoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBkYXRlcyAoY3JlYXRlcyBhIGNvcHkgdG8gc2VwYXJhdGUgaXQgZnJvbSB0aGUgc291cmNlIG9iamVjdClcbiAgICAgICAgZWxzZSBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICBvYmpba2V5XSA9IG5ldyBEYXRlKHYpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgc2ltcGxlIHByb3BlcnRpZXNcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgb2JqW2tleV0gPSB2O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBuby1vcFxuICAgIH1cbiAgICB0aGlzLl9faW5Ub09iamVjdCA9IGZhbHNlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvKipcbiAgICogTG9nIGEgd2FybmluZyBmb3IgYXR0ZW1wdHMgdG8gc3Vic2NyaWJlIHRvIHVuc3VwcG9ydGVkIGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBfd2FybkZvckV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfd2FybkZvckV2ZW50KGV2ZW50TmFtZSkge1xuICAgIGlmICghVXRpbHMuaW5jbHVkZXModGhpcy5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLCBldmVudE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V2ZW50ICcgKyBldmVudE5hbWUgKyAnIG5vdCBkZWZpbmVkIGZvciAnICsgdGhpcy50b1N0cmluZygpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZSBmb3IgcHJvY2Vzc2luZyBhbiBldmVudCBzdWJzY3JpcHRpb24gY2FsbC5cbiAgICpcbiAgICogSWYgY29udGV4dCBpcyBhIFJvb3QgY2xhc3MsIGFkZCB0aGlzIG9iamVjdCB0byB0aGUgY29udGV4dCdzIHN1YnNjcmlwdGlvbnMuXG4gICAqXG4gICAqIEBtZXRob2QgX3ByZXBhcmVPblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZXBhcmVPbihuYW1lLCBoYW5kbGVyLCBjb250ZXh0KSB7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGlmIChjb250ZXh0IGluc3RhbmNlb2YgUm9vdCkge1xuICAgICAgICBpZiAoY29udGV4dC5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoY29udGV4dC5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMpIHtcbiAgICAgICAgY29udGV4dC5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyAmJiBuYW1lICE9PSAnYWxsJykge1xuICAgICAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgICAgICBjb25zdCBuYW1lcyA9IG5hbWUuc3BsaXQoZXZlbnRTcGxpdHRlcik7XG4gICAgICAgIG5hbWVzLmZvckVhY2gobiA9PiB0aGlzLl93YXJuRm9yRXZlbnQobikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fd2FybkZvckV2ZW50KG5hbWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIE9iamVjdC5rZXlzKG5hbWUpLmZvckVhY2goa2V5TmFtZSA9PiB0aGlzLl93YXJuRm9yRXZlbnQoa2V5TmFtZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgdG8gZXZlbnRzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIGNvbnRleHQgcGFyYW1ldGVyIHNlcnZlcyBkb3VibGUgaW1wb3J0YW5jZSBoZXJlOlxuICAgKlxuICAgKiAxLiBJdCBkZXRlcm1pbmVzIHRoZSBjb250ZXh0IGluIHdoaWNoIHRvIGV4ZWN1dGUgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICogMi4gQ3JlYXRlIGEgYmFja2xpbmsgc28gdGhhdCBpZiBlaXRoZXIgc3Vic2NyaWJlciBvciBzdWJzY3JpYmVlIGlzIGRlc3Ryb3llZCxcbiAgICogICAgYWxsIHBvaW50ZXJzIGJldHdlZW4gdGhlbSBjYW4gYmUgZm91bmQgYW5kIHJlbW92ZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBvYmoub24oJ3NvbWVFdmVudE5hbWUgc29tZU90aGVyRXZlbnROYW1lJywgbXljYWxsYmFjaywgbXljb250ZXh0KTtcbiAgICogYGBgXG4gICAqXG4gICAqIGBgYFxuICAgKiBvYmoub24oe1xuICAgKiAgICBldmVudE5hbWUxOiBjYWxsYmFjazEsXG4gICAqICAgIGV2ZW50TmFtZTI6IGNhbGxiYWNrMlxuICAgKiB9LCBteWNvbnRleHQpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBvblxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gaGFuZGxlciAtIEV2ZW50IGhhbmRsZXJcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gaGFuZGxlci5ldmVudCAtIEV2ZW50IG9iamVjdCBkZWxpdmVyZWQgdG8gdGhlIGhhbmRsZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0IC0gVGhpcyBwb2ludGVyIEFORCBsaW5rIHRvIGhlbHAgd2l0aCBjbGVhbnVwXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGhhbmRsZXIsIGNvbnRleHQpIHtcbiAgICB0aGlzLl9wcmVwYXJlT24obmFtZSwgaGFuZGxlciwgY29udGV4dCk7XG4gICAgRXZlbnRzLm9uLmFwcGx5KHRoaXMsIFtuYW1lLCBoYW5kbGVyLCBjb250ZXh0XSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU3Vic2NyaWJlIHRvIHRoZSBmaXJzdCBvY2N1cmFuY2Ugb2YgdGhlIHNwZWNpZmllZCBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBvbmNlXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG4gIG9uY2UobmFtZSwgaGFuZGxlciwgY29udGV4dCkge1xuICAgIHRoaXMuX3ByZXBhcmVPbihuYW1lLCBoYW5kbGVyLCBjb250ZXh0KTtcbiAgICBFdmVudHMub25jZS5hcHBseSh0aGlzLCBbbmFtZSwgaGFuZGxlciwgY29udGV4dF0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuc3Vic2NyaWJlIGZyb20gZXZlbnRzLlxuICAgKlxuICAgKiBgYGBcbiAgICogLy8gUmVtb3ZlcyBhbGwgZXZlbnQgaGFuZGxlcnMgZm9yIHRoaXMgZXZlbnQ6XG4gICAqIG9iai5vZmYoJ3NvbWVFdmVudE5hbWUnKTtcbiAgICpcbiAgICogLy8gUmVtb3ZlcyBhbGwgZXZlbnQgaGFuZGxlcnMgdXNpbmcgdGhpcyBmdW5jdGlvbiBwb2ludGVyIGFzIGNhbGxiYWNrXG4gICAqIG9iai5vZmYobnVsbCwgZiwgbnVsbCk7XG4gICAqXG4gICAqIC8vIFJlbW92ZXMgYWxsIGV2ZW50IGhhbmRsZXJzIHRoYXQgYHRoaXNgIGhhcyBzdWJzY3JpYmVkIHRvOyByZXF1aXJlc1xuICAgKiAvLyBvYmoub24gdG8gYmUgY2FsbGVkIHdpdGggYHRoaXNgIGFzIGl0cyBgY29udGV4dGAgcGFyYW1ldGVyLlxuICAgKiBvYmoub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBvZmZcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQ7IG51bGwgZm9yIGFsbCBldmVudCBuYW1lc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gaGFuZGxlciAtIEV2ZW50IGhhbmRsZXI7IG51bGwgZm9yIGFsbCBmdW5jdGlvbnNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0IC0gVGhlIGNvbnRleHQgZnJvbSB0aGUgYG9uKClgIGNhbGwgdG8gc2VhcmNoIGZvcjsgbnVsbCBmb3IgYWxsIGNvbnRleHRzXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG5cblxuICAvKipcbiAgICogVHJpZ2dlciBhbiBldmVudCBmb3IgYW55IGV2ZW50IGxpc3RlbmVycy5cbiAgICpcbiAgICogRXZlbnRzIHRyaWdnZXJlZCB0aGlzIHdheSB3aWxsIGJlIGJsb2NrZWQgaWYgX2Rpc2FibGVFdmVudHMgPSB0cnVlXG4gICAqXG4gICAqIEBtZXRob2QgdHJpZ2dlclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lICAgIE5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgb25lIHNob3VsZCBzdWJzY3JpYmUgdG8gaW4gb3JkZXIgdG8gcmVjZWl2ZSB0aGlzIGV2ZW50XG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFyZyAgICAgICAgICAgVmFsdWVzIHRoYXQgd2lsbCBiZSBwbGFjZWQgd2l0aGluIGEgbGF5ZXIuTGF5ZXJFdmVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fSB0aGlzXG4gICAqL1xuICB0cmlnZ2VyKC4uLmFyZ3MpIHtcbiAgICBpZiAodGhpcy5fZGlzYWJsZUV2ZW50cykgcmV0dXJuIHRoaXM7XG4gICAgcmV0dXJuIHRoaXMuX3RyaWdnZXIoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogVHJpZ2dlcnMgYW4gZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2QgdHJpZ2dlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lICAgIE5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgb25lIHNob3VsZCBzdWJzY3JpYmUgdG8gaW4gb3JkZXIgdG8gcmVjZWl2ZSB0aGlzIGV2ZW50XG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFyZyAgICAgICAgICAgVmFsdWVzIHRoYXQgd2lsbCBiZSBwbGFjZWQgd2l0aGluIGEgbGF5ZXIuTGF5ZXJFdmVudFxuICAgKi9cbiAgX3RyaWdnZXIoLi4uYXJncykge1xuICAgIGlmICghVXRpbHMuaW5jbHVkZXModGhpcy5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLCBhcmdzWzBdKSkge1xuICAgICAgaWYgKCFVdGlscy5pbmNsdWRlcyh0aGlzLmNvbnN0cnVjdG9yLl9pZ25vcmVkRXZlbnRzLCBhcmdzWzBdKSkge1xuICAgICAgICBMb2dnZXIuZXJyb3IodGhpcy50b1N0cmluZygpICsgJyBpZ25vcmVkICcgKyBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb21wdXRlZEFyZ3MgPSB0aGlzLl9nZXRUcmlnZ2VyQXJncyguLi5hcmdzKTtcblxuICAgIEV2ZW50cy50cmlnZ2VyLmFwcGx5KHRoaXMsIGNvbXB1dGVkQXJncyk7XG5cbiAgICBjb25zdCBwYXJlbnRQcm9wID0gdGhpcy5jb25zdHJ1Y3Rvci5idWJibGVFdmVudFBhcmVudDtcbiAgICBpZiAocGFyZW50UHJvcCAmJiBhcmdzWzBdICE9PSAnZGVzdHJveScpIHtcbiAgICAgIGxldCBwYXJlbnRWYWx1ZSA9IHRoaXNbcGFyZW50UHJvcF07XG4gICAgICBwYXJlbnRWYWx1ZSA9ICh0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdmdW5jdGlvbicpID8gcGFyZW50VmFsdWUuYXBwbHkodGhpcykgOiBwYXJlbnRWYWx1ZTtcbiAgICAgIGlmIChwYXJlbnRWYWx1ZSkgcGFyZW50VmFsdWUudHJpZ2dlciguLi5jb21wdXRlZEFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBsYXllci5MYXllckV2ZW50IGZyb20gYSB0cmlnZ2VyIGNhbGwncyBhcmd1bWVudHMuXG4gICAqXG4gICAqICogSWYgcGFyYW1ldGVyIGlzIGFscmVhZHkgYSBsYXllci5MYXllckV2ZW50LCB3ZSdyZSBkb25lLlxuICAgKiAqIElmIHBhcmFtZXRlciBpcyBhbiBvYmplY3QsIGEgYHRhcmdldGAgcHJvcGVydHkgaXMgYWRkZWQgdG8gdGhhdCBvYmplY3QgYW5kIGl0cyBkZWxpdmVyZWQgdG8gYWxsIHN1YnNjcmliZXJzXG4gICAqICogSWYgdGhlIHBhcmFtZXRlciBpcyBub24tb2JqZWN0IHZhbHVlLCBpdCBpcyBhZGRlZCB0byBhbiBvYmplY3Qgd2l0aCBhIGB0YXJnZXRgIHByb3BlcnR5LCBhbmQgdGhlIHZhbHVlIGlzIHB1dCBpblxuICAgKiAgIHRoZSBgZGF0YWAgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFRyaWdnZXJBcmdzXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge01peGVkW119IC0gRmlyc3QgZWxlbWVudCBvZiBhcnJheSBpcyBldmVudE5hbWUsIHNlY29uZCBlbGVtZW50IGlzIGxheWVyLkxheWVyRXZlbnQuXG4gICAqL1xuICBfZ2V0VHJpZ2dlckFyZ3MoLi4uYXJncykge1xuICAgIGNvbnN0IGNvbXB1dGVkQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MpO1xuXG4gICAgaWYgKGFyZ3NbMV0pIHtcbiAgICAgIGNvbnN0IG5ld0FyZyA9IHsgdGFyZ2V0OiB0aGlzIH07XG5cbiAgICAgIGlmIChjb21wdXRlZEFyZ3NbMV0gaW5zdGFuY2VvZiBMYXllckV2ZW50KSB7XG4gICAgICAgIC8vIEEgTGF5ZXJFdmVudCB3aWxsIGJlIGFuIGFyZ3VtZW50IHdoZW4gYnViYmxpbmcgZXZlbnRzIHVwOyB0aGVzZSBhcmdzIGNhbiBiZSB1c2VkIGFzLWlzXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGNvbXB1dGVkQXJnc1sxXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhjb21wdXRlZEFyZ3NbMV0pLmZvckVhY2gobmFtZSA9PiAobmV3QXJnW25hbWVdID0gY29tcHV0ZWRBcmdzWzFdW25hbWVdKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3QXJnLmRhdGEgPSBjb21wdXRlZEFyZ3NbMV07XG4gICAgICAgIH1cbiAgICAgICAgY29tcHV0ZWRBcmdzWzFdID0gbmV3IExheWVyRXZlbnQobmV3QXJnLCBjb21wdXRlZEFyZ3NbMF0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb21wdXRlZEFyZ3NbMV0gPSBuZXcgTGF5ZXJFdmVudCh7IHRhcmdldDogdGhpcyB9LCBjb21wdXRlZEFyZ3NbMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb21wdXRlZEFyZ3M7XG4gIH1cblxuICAvKipcbiAgICogU2FtZSBhcyBfdHJpZ2dlcigpIG1ldGhvZCwgYnV0IGRlbGF5cyBicmllZmx5IGJlZm9yZSBmaXJpbmcuXG4gICAqXG4gICAqIFdoZW4gd291bGQgeW91IHdhbnQgdG8gZGVsYXkgYW4gZXZlbnQ/XG4gICAqXG4gICAqIDEuIFRoZXJlIGlzIGFuIGV2ZW50IHJvbGx1cCB0aGF0IG1heSBiZSBuZWVkZWQgZm9yIHRoZSBldmVudDtcbiAgICogICAgdGhpcyByZXF1aXJlcyB0aGUgZnJhbWV3b3JrIHRvIGJlIGFibGUgdG8gc2VlIEFMTCBldmVudHMgdGhhdCBoYXZlIGJlZW5cbiAgICogICAgZ2VuZXJhdGVkLCByb2xsIHRoZW0gdXAsIGFuZCBUSEVOIGZpcmUgdGhlbS5cbiAgICogMi4gVGhlIGV2ZW50IGlzIGludGVuZGVkIGZvciBVSSByZW5kZXJpbmcuLi4gd2hpY2ggc2hvdWxkIG5vdCBob2xkIHVwIHRoZSByZXN0IG9mXG4gICAqICAgIHRoaXMgZnJhbWV3b3JrJ3MgZXhlY3V0aW9uLlxuICAgKlxuICAgKiBXaGVuIE5PVCB0byBkZWxheSBhbiBldmVudD9cbiAgICpcbiAgICogMS4gTGlmZWN5Y2xlIGV2ZW50cyBmcmVxdWVudGx5IHJlcXVpcmUgcmVzcG9uc2UgYXQgdGhlIHRpbWUgdGhlIGV2ZW50IGhhcyBmaXJlZFxuICAgKlxuICAgKiBAbWV0aG9kIF90cmlnZ2VyQXN5bmNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSAgICBOYW1lIG9mIHRoZSBldmVudCB0aGF0IG9uZSBzaG91bGQgc3Vic2NyaWJlIHRvIGluIG9yZGVyIHRvIHJlY2VpdmUgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBhcmcgICAgICAgICAgIFZhbHVlcyB0aGF0IHdpbGwgYmUgcGxhY2VkIHdpdGhpbiBhIGxheWVyLkxheWVyRXZlbnRcbiAgICogQHJldHVybiB7bGF5ZXIuUm9vdH0gdGhpc1xuICAgKi9cbiAgX3RyaWdnZXJBc3luYyguLi5hcmdzKSB7XG4gICAgY29uc3QgY29tcHV0ZWRBcmdzID0gdGhpcy5fZ2V0VHJpZ2dlckFyZ3MoLi4uYXJncyk7XG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnB1c2goY29tcHV0ZWRBcmdzKTtcblxuICAgIC8vIE5PVEU6IEl0IGlzIHVuY2xlYXIgYXQgdGhpcyB0aW1lIGhvdyBpdCBoYXBwZW5zLCBidXQgb24gdmVyeSByYXJlIG9jY2FzaW9ucywgd2Ugc2VlIHByb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICAvLyBmYWlsIHRvIGdldCBjYWxsZWQgd2hlbiBsZW5ndGggPSAxLCBhbmQgYWZ0ZXIgdGhhdCBsZW5ndGgganVzdCBjb250aW51b3VzbHkgZ3Jvd3MuICBTbyB3ZSBhZGRcbiAgICAvLyB0aGUgX2xhc3REZWxheWVkVHJpZ2dlciB0ZXN0IHRvIGluc3VyZSB0aGF0IGl0IHdpbGwgc3RpbGwgcnVuLlxuICAgIGNvbnN0IHNob3VsZFNjaGVkdWxlVHJpZ2dlciA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5sZW5ndGggPT09IDEgfHxcbiAgICAgICh0aGlzLl9kZWxheWVkVHJpZ2dlcnMubGVuZ3RoICYmIHRoaXMuX2xhc3REZWxheWVkVHJpZ2dlciArIDUwMCA8IERhdGUubm93KCkpO1xuICAgIGlmIChzaG91bGRTY2hlZHVsZVRyaWdnZXIpIHtcbiAgICAgIHRoaXMuX2xhc3REZWxheWVkVHJpZ2dlciA9IERhdGUubm93KCk7XG4gICAgICBpZiAodHlwZW9mIHBvc3RNZXNzYWdlID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBqYXNtaW5lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBjb25zdCBtZXNzYWdlRGF0YSA9IHtcbiAgICAgICAgICB0eXBlOiAnbGF5ZXItZGVsYXllZC1ldmVudCcsXG4gICAgICAgICAgaW50ZXJuYWxJZDogdGhpcy5pbnRlcm5hbElkLFxuICAgICAgICB9O1xuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShtZXNzYWdlRGF0YSwgJyonKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZWFjdCBOYXRpdmUgcmVwb3J0ZWRseSBsYWNrcyBhIGRvY3VtZW50LCBhbmQgdGhyb3dzIGVycm9ycyBvbiB0aGUgc2Vjb25kIHBhcmFtZXRlclxuICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShtZXNzYWdlRGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycygpLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgYSBzZXQgb2YgZXZlbnRzIGludG8gYSBzaW5nbGUgZXZlbnQuXG4gICAqXG4gICAqIEdpdmVuIGFuIGV2ZW50IHN0cnVjdHVyZSBvZlxuICAgKiBgYGBcbiAgICogICAgICB7XG4gICAqICAgICAgICAgIGN1c3RvbU5hbWU6IFt2YWx1ZTFdXG4gICAqICAgICAgfVxuICAgKiAgICAgIHtcbiAgICogICAgICAgICAgY3VzdG9tTmFtZTogW3ZhbHVlMl1cbiAgICogICAgICB9XG4gICAqICAgICAge1xuICAgKiAgICAgICAgICBjdXN0b21OYW1lOiBbdmFsdWUzXVxuICAgKiAgICAgIH1cbiAgICogYGBgXG4gICAqXG4gICAqIE1lcmdlIHRoZW0gaW50b1xuICAgKlxuICAgKiBgYGBcbiAgICogICAgICB7XG4gICAqICAgICAgICAgIGN1c3RvbU5hbWU6IFt2YWx1ZTEsIHZhbHVlMiwgdmFsdWUzXVxuICAgKiAgICAgIH1cbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgX2ZvbGRFdmVudHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudFtdfSBldmVudHNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBuYW1lICAgICAgTmFtZSBvZiB0aGUgcHJvcGVydHkgKGkuZS4gJ2N1c3RvbU5hbWUnKVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290fSAgICBuZXdUYXJnZXQgVmFsdWUgb2YgdGhlIHRhcmdldCBmb3IgdGhlIGZvbGRlZCByZXN1bHRpbmcgZXZlbnRcbiAgICovXG4gIF9mb2xkRXZlbnRzKGV2ZW50cywgbmFtZSwgbmV3VGFyZ2V0KSB7XG4gICAgY29uc3QgZmlyc3RFdnQgPSBldmVudHMubGVuZ3RoID8gZXZlbnRzWzBdWzFdIDogbnVsbDtcbiAgICBjb25zdCBmaXJzdEV2dFByb3AgPSBmaXJzdEV2dCA/IGZpcnN0RXZ0W25hbWVdIDogbnVsbDtcbiAgICBldmVudHMuZm9yRWFjaCgoZXZ0LCBpKSA9PiB7XG4gICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgZmlyc3RFdnRQcm9wLnB1c2goZXZ0WzFdW25hbWVdWzBdKTtcbiAgICAgICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnNwbGljZSh0aGlzLl9kZWxheWVkVHJpZ2dlcnMuaW5kZXhPZihldnQpLCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXZlbnRzLmxlbmd0aCAmJiBuZXdUYXJnZXQpIGV2ZW50c1swXVsxXS50YXJnZXQgPSBuZXdUYXJnZXQ7XG4gIH1cblxuICAvKipcbiAgICogRm9sZCBhIHNldCBvZiBDaGFuZ2UgZXZlbnRzIGludG8gYSBzaW5nbGUgQ2hhbmdlIGV2ZW50LlxuICAgKlxuICAgKiBHaXZlbiBhIHNldCBjaGFuZ2UgZXZlbnRzIG9uIHRoaXMgY29tcG9uZW50LFxuICAgKiBmb2xkIGFsbCBjaGFuZ2UgZXZlbnRzIGludG8gYSBzaW5nbGUgZXZlbnQgdmlhXG4gICAqIHRoZSBsYXllci5MYXllckV2ZW50J3MgY2hhbmdlcyBhcnJheS5cbiAgICpcbiAgICogQG1ldGhvZCBfZm9sZENoYW5nZUV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2ZvbGRDaGFuZ2VFdmVudHMoKSB7XG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzFdLmlzQ2hhbmdlKTtcbiAgICBldmVudHMuZm9yRWFjaCgoZXZ0LCBpKSA9PiB7XG4gICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgZXZlbnRzWzBdWzFdLl9tZXJnZUNoYW5nZXMoZXZ0WzFdKTtcbiAgICAgICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnNwbGljZSh0aGlzLl9kZWxheWVkVHJpZ2dlcnMuaW5kZXhPZihldnQpLCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGFsbCBkZWxheWVkIGV2ZW50cyBmb3IgdGhpcyBjb21wb2VubnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgdGhpcy5fZm9sZENoYW5nZUV2ZW50cygpO1xuXG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZvckVhY2goZnVuY3Rpb24gKGV2dCkge1xuICAgICAgdGhpcy50cmlnZ2VyKC4uLmV2dCk7XG4gICAgfSwgdGhpcyk7XG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzID0gW107XG4gIH1cblxuXG4gIF9ydW5NaXhpbnMobWl4aW5OYW1lLCBhcmdBcnJheSkge1xuICAgIHRoaXMuY29uc3RydWN0b3IubWl4aW5zLmZvckVhY2goKG1peGluKSA9PiB7XG4gICAgICBpZiAobWl4aW4ubGlmZWN5Y2xlW21peGluTmFtZV0pIG1peGluLmxpZmVjeWNsZVttaXhpbk5hbWVdLmFwcGx5KHRoaXMsIGFyZ0FycmF5KTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNsYXNzIHRoYXQgaXMgbmljZXIgdGhhbiBgW09iamVjdF1gLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvU3RyaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmludGVybmFsSWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmaW5lUHJvcGVydHkobmV3Q2xhc3MsIHByb3BlcnR5TmFtZSkge1xuICBjb25zdCBwS2V5ID0gJ19fJyArIHByb3BlcnR5TmFtZTtcbiAgY29uc3QgY2FtZWwgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBwcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKDEpO1xuICBjb25zdCBoYXNEZWZpbml0aW9ucyA9IG5ld0NsYXNzLnByb3RvdHlwZVsnX19hZGp1c3QnICsgY2FtZWxdIHx8IG5ld0NsYXNzLnByb3RvdHlwZVsnX191cGRhdGUnICsgY2FtZWxdIHx8XG4gICAgbmV3Q2xhc3MucHJvdG90eXBlWydfX2dldCcgKyBjYW1lbF07XG4gIGlmIChoYXNEZWZpbml0aW9ucykge1xuICAgIC8vIHNldCBkZWZhdWx0IHZhbHVlXG4gICAgbmV3Q2xhc3MucHJvdG90eXBlW3BLZXldID0gbmV3Q2xhc3MucHJvdG90eXBlW3Byb3BlcnR5TmFtZV07XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3Q2xhc3MucHJvdG90eXBlLCBwcm9wZXJ0eU5hbWUsIHtcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbJ19fZ2V0JyArIGNhbWVsXSA/IHRoaXNbJ19fZ2V0JyArIGNhbWVsXShwS2V5KSA6IHRoaXNbcEtleV07XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoaW5WYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbml0aWFsID0gdGhpc1twS2V5XTtcbiAgICAgICAgaWYgKGluVmFsdWUgIT09IGluaXRpYWwpIHtcbiAgICAgICAgICBpZiAodGhpc1snX19hZGp1c3QnICsgY2FtZWxdKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzWydfX2FkanVzdCcgKyBjYW1lbF0oaW5WYWx1ZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIGluVmFsdWUgPSByZXN1bHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXNbcEtleV0gPSBpblZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpblZhbHVlICE9PSBpbml0aWFsKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLmlzSW5pdGlhbGl6aW5nICYmIHRoaXNbJ19fdXBkYXRlJyArIGNhbWVsXSkge1xuICAgICAgICAgICAgdGhpc1snX191cGRhdGUnICsgY2FtZWxdKGluVmFsdWUsIGluaXRpYWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbml0Q2xhc3MobmV3Q2xhc3MsIGNsYXNzTmFtZSkge1xuICAvLyBNYWtlIHN1cmUgb3VyIG5ldyBjbGFzcyBoYXMgYSBuYW1lIHByb3BlcnR5XG4gIGlmICghbmV3Q2xhc3MubmFtZSkgbmV3Q2xhc3MubmFtZSA9IGNsYXNzTmFtZTtcblxuICAvLyBNYWtlIHN1cmUgb3VyIG5ldyBjbGFzcyBoYXMgYSBfc3VwcG9ydGVkRXZlbnRzLCBfaWdub3JlZEV2ZW50cywgX2luT2JqZWN0SWdub3JlIGFuZCBFVkVOVFMgcHJvcGVydGllc1xuICBpZiAoIW5ld0NsYXNzLl9zdXBwb3J0ZWRFdmVudHMpIG5ld0NsYXNzLl9zdXBwb3J0ZWRFdmVudHMgPSBSb290Ll9zdXBwb3J0ZWRFdmVudHM7XG4gIGlmICghbmV3Q2xhc3MuX2lnbm9yZWRFdmVudHMpIG5ld0NsYXNzLl9pZ25vcmVkRXZlbnRzID0gUm9vdC5faWdub3JlZEV2ZW50cztcblxuICBpZiAobmV3Q2xhc3MubWl4aW5zKSB7XG4gICAgbmV3Q2xhc3MubWl4aW5zLmZvckVhY2goKG1peGluKSA9PiB7XG4gICAgICBpZiAobWl4aW4uZXZlbnRzKSBuZXdDbGFzcy5fc3VwcG9ydGVkRXZlbnRzID0gbmV3Q2xhc3MuX3N1cHBvcnRlZEV2ZW50cy5jb25jYXQobWl4aW4uZXZlbnRzKTtcbiAgICAgIGlmIChtaXhpbi5wcm9wZXJ0aWVzKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKG1peGluLnByb3BlcnRpZXMpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgIG5ld0NsYXNzLnByb3RvdHlwZVtrZXldID0gbWl4aW4ucHJvcGVydGllc1trZXldO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChtaXhpbi5tZXRob2RzKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKG1peGluLm1ldGhvZHMpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgIG5ld0NsYXNzLnByb3RvdHlwZVtrZXldID0gbWl4aW4ubWV0aG9kc1trZXldO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGEgbGlzdCBvZiBwcm9wZXJ0aWVzIGZvciB0aGlzIGNsYXNzOyB3ZSBkb24ndCBpbmNsdWRlIGFueVxuICAvLyBwcm9wZXJ0aWVzIGZyb20gbGF5ZXIuUm9vdFxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobmV3Q2xhc3MucHJvdG90eXBlKS5maWx0ZXIoa2V5ID0+XG4gICAgbmV3Q2xhc3MucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkgJiZcbiAgICAhUm9vdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJlxuICAgIHR5cGVvZiBuZXdDbGFzcy5wcm90b3R5cGVba2V5XSAhPT0gJ2Z1bmN0aW9uJyk7XG5cbiAgLy8gRGVmaW5lIGdldHRlcnMvc2V0dGVycyBmb3IgYW55IHByb3BlcnR5IHRoYXQgaGFzIF9fYWRqdXN0IG9yIF9fdXBkYXRlIG1ldGhvZHMgZGVmaW5lZFxuICBrZXlzLmZvckVhY2gobmFtZSA9PiBkZWZpbmVQcm9wZXJ0eShuZXdDbGFzcywgbmFtZSkpO1xufVxuXG4vKipcbiAqIFNldCB0byB0cnVlIG9uY2UgZGVzdHJveSgpIGhhcyBiZWVuIGNhbGxlZC5cbiAqXG4gKiBBIGRlc3Ryb3llZCBvYmplY3Qgd2lsbCBsaWtlbHkgY2F1c2UgZXJyb3JzIGluIGFueSBhdHRlbXB0XG4gKiB0byBjYWxsIG1ldGhvZHMgb24gaXQsIGFuZCB3aWxsIG5vIGxvbmdlciB0cmlnZ2VyIGV2ZW50cy5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5Sb290LnByb3RvdHlwZS5pc0Rlc3Ryb3llZCA9IGZhbHNlO1xuXG4vKipcbiAqIEV2ZXJ5IGluc3RhbmNlIGhhcyBpdHMgb3duIGludGVybmFsIElELlxuICpcbiAqIFRoaXMgSUQgaXMgZGlzdGluY3QgZnJvbSBhbnkgSURzIGFzc2lnbmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gKiBUaGUgaW50ZXJuYWwgSUQgaXMgZ2F1cmVudGVlZCBub3QgdG8gY2hhbmdlIHdpdGhpbiB0aGUgbGlmZXRpbWUgb2YgdGhlIE9iamVjdC9zZXNzaW9uO1xuICogaXQgaXMgcG9zc2libGUsIG9uIGNyZWF0aW5nIGEgbmV3IG9iamVjdCwgZm9yIGl0cyBgaWRgIHByb3BlcnR5IHRvIGNoYW5nZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblJvb3QucHJvdG90eXBlLmludGVybmFsSWQgPSAnJztcblxuLyoqXG4gKiBUcnVlIHdoaWxlIHdlIGFyZSBpbiB0aGUgY29uc3RydWN0b3IuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUm9vdC5wcm90b3R5cGUuaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuXG4vKipcbiAqIE9iamVjdHMgdGhhdCB0aGlzIG9iamVjdCBpcyBsaXN0ZW5pbmcgZm9yIGV2ZW50cyBmcm9tLlxuICpcbiAqIEB0eXBlIHtsYXllci5Sb290W119XG4gKiBAcHJpdmF0ZVxuICovXG5Sb290LnByb3RvdHlwZS5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMgPSBudWxsO1xuXG4vKipcbiAqIERpc2FibGUgYWxsIGV2ZW50cyB0cmlnZ2VyZWQgb24gdGhpcyBvYmplY3QuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cblJvb3QucHJvdG90eXBlLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG5cblxuUm9vdC5fc3VwcG9ydGVkRXZlbnRzID0gWydkZXN0cm95JywgJ2FsbCddO1xuUm9vdC5faWdub3JlZEV2ZW50cyA9IFtdO1xubW9kdWxlLmV4cG9ydHMgPSBSb290O1xubW9kdWxlLmV4cG9ydHMuaW5pdENsYXNzID0gaW5pdENsYXNzO1xuIl19
