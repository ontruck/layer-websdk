'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class represents a Layer Event, and is used as the parameter for all event handlers.
 *
 * Calls to
 *
 *      obj.trigger('eventName2', {hey: 'ho'});
 *
 * results in:
 *
 *      obj.on('eventName2', function(layerEvent) {
 *          alert(layerEvent.target.toString() + ' has fired a value of ' + layerEvent.hey);
 *      });
 *
 * Change events (events ending in ':change') get special handling:
 *
 *      obj.trigger('obj:change', {
 *          newValue: 55,
 *          oldValue: 25,
 *          property: 'hey'
 *      });
 *
 * results in your event data being wrapped in a `changes` array:
 *
 *      obj.on('obj:change', function(layerEvent) {
 *          layerEvent.changes.forEach(function(change) {
 *              alert(layerEvent.target.toString() + ' changed ' +
 *                    change.property + ' from ' + change.oldValue +
 *                    ' to ' + change.newValue);
 *          });
 *      });
 *
 * The `layer.LayerEvent.getChangesFor()` and `layer.LayerEvent.hasProperty()` methods
 * simplify working with xxx:change events so you don't need
 * to iterate over the `changes` array.
 *
 * @class layer.LayerEvent
 */

var LayerEvent = function () {
  /**
   * Constructor for LayerEvent.
   *
   * @method
   * @param  {Object} args - Properties to mixin to the event
   * @param  {string} eventName - Name of the event that generated this LayerEvent.
   * @return {layer.LayerEvent}
   */
  function LayerEvent(args, eventName) {
    var _this = this;

    _classCallCheck(this, LayerEvent);

    var ptr = this;

    // Is it a change event?  if so, setup the change properties.
    if (eventName.match(/:change$/)) {
      this.changes = [{}];
      // All args get copied into the changes object instead of this
      ptr = this.changes[0];
      this.isChange = true;
    } else {
      this.isChange = false;
    }

    // Copy the args into either this Event object... or into the change object.
    // Wouldn't be needed if this inherited from Root.
    Object.keys(args).forEach(function (name) {
      // Even if we are copying properties into the change object, target remains
      // a property of LayerEvent.
      if (ptr !== _this && name === 'target') {
        _this.target = args.target;
      } else {
        ptr[name] = args[name];
      }
    });
    this.eventName = eventName;
  }

  /**
   * Returns true if the specified property was changed.
   *
   * Returns false if this is not a change event.
   *
   *      if (layerEvent.hasProperty('age')) {
   *          handleAgeChange(obj.age);
   *      }
   *
   * @method hasProperty
   * @param  {string}  name - Name of the property
   * @return {Boolean}
   */


  _createClass(LayerEvent, [{
    key: 'hasProperty',
    value: function hasProperty(name) {
      if (!this.isChange) return false;
      return Boolean(this.changes.filter(function (change) {
        return change.property === name;
      }).length);
    }

    /**
     * Get all changes to the property.
     *
     * Returns an array of changes.
     * If this is not a change event, will return []
     * Changes are typically of the form:
     *
     *      layerEvent.getChangesFor('age');
     *      > [{
     *          oldValue: 10,
     *          newValue: 5,
     *          property: 'age'
     *      }]
     *
     * @method getChangesFor
     * @param  {string} name - Name of the property whose changes are of interest
     * @return {Object[]}
     */

  }, {
    key: 'getChangesFor',
    value: function getChangesFor(name) {
      if (!this.isChange) return [];
      return this.changes.filter(function (change) {
        return change.property === name;
      });
    }

    /**
     * Merge changes into a single changes array.
     *
     * The other event will need to be deleted.
     *
     * @method _mergeChanges
     * @protected
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_mergeChanges',
    value: function _mergeChanges(evt) {
      this.changes = this.changes.concat(evt.changes);
    }
  }]);

  return LayerEvent;
}();

/**
 * Indicates that this is a change event.
 *
 * If the event name ends with ':change' then
 * it is treated as a change event;  such
 * events are assumed to come with `newValue`, `oldValue` and `property` in the layer.LayerEvent.changes property.
 * @type {Boolean}
 */


LayerEvent.prototype.isChange = false;

/**
 * Array of changes (Change Events only).
 *
 * If its a Change Event, then the changes property contains an array of change objects
 * which each contain:
 *
 * * oldValue
 * * newValue
 * * property
 *
 * @type {Object[]}
 */
LayerEvent.prototype.changes = null;

/**
 * Component that was the source of the change.
 *
 * If one calls
 *
 *      obj.trigger('event');
 *
 * then obj will be the target.
 * @type {layer.Root}
 */
LayerEvent.prototype.target = null;

/**
 * The name of the event that created this instance.
 *
 * If one calls
 *
 *      obj.trigger('myevent');
 *
 * then eventName = 'myevent'
 *
 * @type {String}
 */
LayerEvent.prototype.eventName = '';

module.exports = LayerEvent;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sYXllci1ldmVudC5qcyJdLCJuYW1lcyI6WyJMYXllckV2ZW50IiwiYXJncyIsImV2ZW50TmFtZSIsInB0ciIsIm1hdGNoIiwiY2hhbmdlcyIsImlzQ2hhbmdlIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJuYW1lIiwidGFyZ2V0IiwiQm9vbGVhbiIsImZpbHRlciIsImNoYW5nZSIsInByb3BlcnR5IiwibGVuZ3RoIiwiZXZ0IiwiY29uY2F0IiwicHJvdG90eXBlIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBc0NNQSxVO0FBQ0o7Ozs7Ozs7O0FBUUEsc0JBQVlDLElBQVosRUFBa0JDLFNBQWxCLEVBQTZCO0FBQUE7O0FBQUE7O0FBQzNCLFFBQUlDLE1BQU0sSUFBVjs7QUFFQTtBQUNBLFFBQUlELFVBQVVFLEtBQVYsQ0FBZ0IsVUFBaEIsQ0FBSixFQUFpQztBQUMvQixXQUFLQyxPQUFMLEdBQWUsQ0FBQyxFQUFELENBQWY7QUFDQTtBQUNBRixZQUFNLEtBQUtFLE9BQUwsQ0FBYSxDQUFiLENBQU47QUFDQSxXQUFLQyxRQUFMLEdBQWdCLElBQWhCO0FBQ0QsS0FMRCxNQUtPO0FBQ0wsV0FBS0EsUUFBTCxHQUFnQixLQUFoQjtBQUNEOztBQUVEO0FBQ0E7QUFDQUMsV0FBT0MsSUFBUCxDQUFZUCxJQUFaLEVBQWtCUSxPQUFsQixDQUEwQixVQUFDQyxJQUFELEVBQVU7QUFDbEM7QUFDQTtBQUNBLFVBQUlQLGlCQUFnQk8sU0FBUyxRQUE3QixFQUF1QztBQUNyQyxjQUFLQyxNQUFMLEdBQWNWLEtBQUtVLE1BQW5CO0FBQ0QsT0FGRCxNQUVPO0FBQ0xSLFlBQUlPLElBQUosSUFBWVQsS0FBS1MsSUFBTCxDQUFaO0FBQ0Q7QUFDRixLQVJEO0FBU0EsU0FBS1IsU0FBTCxHQUFpQkEsU0FBakI7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Z0NBYVlRLEksRUFBTTtBQUNoQixVQUFJLENBQUMsS0FBS0osUUFBVixFQUFvQixPQUFPLEtBQVA7QUFDcEIsYUFBT00sUUFBUSxLQUFLUCxPQUFMLENBQWFRLE1BQWIsQ0FBb0I7QUFBQSxlQUFVQyxPQUFPQyxRQUFQLEtBQW9CTCxJQUE5QjtBQUFBLE9BQXBCLEVBQXdETSxNQUFoRSxDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztrQ0FrQmNOLEksRUFBTTtBQUNsQixVQUFJLENBQUMsS0FBS0osUUFBVixFQUFvQixPQUFPLEVBQVA7QUFDcEIsYUFBTyxLQUFLRCxPQUFMLENBQWFRLE1BQWIsQ0FBb0I7QUFBQSxlQUFVQyxPQUFPQyxRQUFQLEtBQW9CTCxJQUE5QjtBQUFBLE9BQXBCLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O2tDQVNjTyxHLEVBQUs7QUFDakIsV0FBS1osT0FBTCxHQUFlLEtBQUtBLE9BQUwsQ0FBYWEsTUFBYixDQUFvQkQsSUFBSVosT0FBeEIsQ0FBZjtBQUNEOzs7Ozs7QUFHSDs7Ozs7Ozs7OztBQVFBTCxXQUFXbUIsU0FBWCxDQUFxQmIsUUFBckIsR0FBZ0MsS0FBaEM7O0FBRUE7Ozs7Ozs7Ozs7OztBQVlBTixXQUFXbUIsU0FBWCxDQUFxQmQsT0FBckIsR0FBK0IsSUFBL0I7O0FBRUE7Ozs7Ozs7Ozs7QUFVQUwsV0FBV21CLFNBQVgsQ0FBcUJSLE1BQXJCLEdBQThCLElBQTlCOztBQUVBOzs7Ozs7Ozs7OztBQVdBWCxXQUFXbUIsU0FBWCxDQUFxQmpCLFNBQXJCLEdBQWlDLEVBQWpDOztBQUVBa0IsT0FBT0MsT0FBUCxHQUFpQnJCLFVBQWpCIiwiZmlsZSI6ImxheWVyLWV2ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBMYXllciBFdmVudCwgYW5kIGlzIHVzZWQgYXMgdGhlIHBhcmFtZXRlciBmb3IgYWxsIGV2ZW50IGhhbmRsZXJzLlxuICpcbiAqIENhbGxzIHRvXG4gKlxuICogICAgICBvYmoudHJpZ2dlcignZXZlbnROYW1lMicsIHtoZXk6ICdobyd9KTtcbiAqXG4gKiByZXN1bHRzIGluOlxuICpcbiAqICAgICAgb2JqLm9uKCdldmVudE5hbWUyJywgZnVuY3Rpb24obGF5ZXJFdmVudCkge1xuICogICAgICAgICAgYWxlcnQobGF5ZXJFdmVudC50YXJnZXQudG9TdHJpbmcoKSArICcgaGFzIGZpcmVkIGEgdmFsdWUgb2YgJyArIGxheWVyRXZlbnQuaGV5KTtcbiAqICAgICAgfSk7XG4gKlxuICogQ2hhbmdlIGV2ZW50cyAoZXZlbnRzIGVuZGluZyBpbiAnOmNoYW5nZScpIGdldCBzcGVjaWFsIGhhbmRsaW5nOlxuICpcbiAqICAgICAgb2JqLnRyaWdnZXIoJ29iajpjaGFuZ2UnLCB7XG4gKiAgICAgICAgICBuZXdWYWx1ZTogNTUsXG4gKiAgICAgICAgICBvbGRWYWx1ZTogMjUsXG4gKiAgICAgICAgICBwcm9wZXJ0eTogJ2hleSdcbiAqICAgICAgfSk7XG4gKlxuICogcmVzdWx0cyBpbiB5b3VyIGV2ZW50IGRhdGEgYmVpbmcgd3JhcHBlZCBpbiBhIGBjaGFuZ2VzYCBhcnJheTpcbiAqXG4gKiAgICAgIG9iai5vbignb2JqOmNoYW5nZScsIGZ1bmN0aW9uKGxheWVyRXZlbnQpIHtcbiAqICAgICAgICAgIGxheWVyRXZlbnQuY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xuICogICAgICAgICAgICAgIGFsZXJ0KGxheWVyRXZlbnQudGFyZ2V0LnRvU3RyaW5nKCkgKyAnIGNoYW5nZWQgJyArXG4gKiAgICAgICAgICAgICAgICAgICAgY2hhbmdlLnByb3BlcnR5ICsgJyBmcm9tICcgKyBjaGFuZ2Uub2xkVmFsdWUgK1xuICogICAgICAgICAgICAgICAgICAgICcgdG8gJyArIGNoYW5nZS5uZXdWYWx1ZSk7XG4gKiAgICAgICAgICB9KTtcbiAqICAgICAgfSk7XG4gKlxuICogVGhlIGBsYXllci5MYXllckV2ZW50LmdldENoYW5nZXNGb3IoKWAgYW5kIGBsYXllci5MYXllckV2ZW50Lmhhc1Byb3BlcnR5KClgIG1ldGhvZHNcbiAqIHNpbXBsaWZ5IHdvcmtpbmcgd2l0aCB4eHg6Y2hhbmdlIGV2ZW50cyBzbyB5b3UgZG9uJ3QgbmVlZFxuICogdG8gaXRlcmF0ZSBvdmVyIHRoZSBgY2hhbmdlc2AgYXJyYXkuXG4gKlxuICogQGNsYXNzIGxheWVyLkxheWVyRXZlbnRcbiAqL1xuXG5jbGFzcyBMYXllckV2ZW50IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yIGZvciBMYXllckV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gYXJncyAtIFByb3BlcnRpZXMgdG8gbWl4aW4gdG8gdGhlIGV2ZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZlbnROYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQgdGhhdCBnZW5lcmF0ZWQgdGhpcyBMYXllckV2ZW50LlxuICAgKiBAcmV0dXJuIHtsYXllci5MYXllckV2ZW50fVxuICAgKi9cbiAgY29uc3RydWN0b3IoYXJncywgZXZlbnROYW1lKSB7XG4gICAgbGV0IHB0ciA9IHRoaXM7XG5cbiAgICAvLyBJcyBpdCBhIGNoYW5nZSBldmVudD8gIGlmIHNvLCBzZXR1cCB0aGUgY2hhbmdlIHByb3BlcnRpZXMuXG4gICAgaWYgKGV2ZW50TmFtZS5tYXRjaCgvOmNoYW5nZSQvKSkge1xuICAgICAgdGhpcy5jaGFuZ2VzID0gW3t9XTtcbiAgICAgIC8vIEFsbCBhcmdzIGdldCBjb3BpZWQgaW50byB0aGUgY2hhbmdlcyBvYmplY3QgaW5zdGVhZCBvZiB0aGlzXG4gICAgICBwdHIgPSB0aGlzLmNoYW5nZXNbMF07XG4gICAgICB0aGlzLmlzQ2hhbmdlID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pc0NoYW5nZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENvcHkgdGhlIGFyZ3MgaW50byBlaXRoZXIgdGhpcyBFdmVudCBvYmplY3QuLi4gb3IgaW50byB0aGUgY2hhbmdlIG9iamVjdC5cbiAgICAvLyBXb3VsZG4ndCBiZSBuZWVkZWQgaWYgdGhpcyBpbmhlcml0ZWQgZnJvbSBSb290LlxuICAgIE9iamVjdC5rZXlzKGFyZ3MpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIC8vIEV2ZW4gaWYgd2UgYXJlIGNvcHlpbmcgcHJvcGVydGllcyBpbnRvIHRoZSBjaGFuZ2Ugb2JqZWN0LCB0YXJnZXQgcmVtYWluc1xuICAgICAgLy8gYSBwcm9wZXJ0eSBvZiBMYXllckV2ZW50LlxuICAgICAgaWYgKHB0ciAhPT0gdGhpcyAmJiBuYW1lID09PSAndGFyZ2V0Jykge1xuICAgICAgICB0aGlzLnRhcmdldCA9IGFyZ3MudGFyZ2V0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRyW25hbWVdID0gYXJnc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmV2ZW50TmFtZSA9IGV2ZW50TmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNwZWNpZmllZCBwcm9wZXJ0eSB3YXMgY2hhbmdlZC5cbiAgICpcbiAgICogUmV0dXJucyBmYWxzZSBpZiB0aGlzIGlzIG5vdCBhIGNoYW5nZSBldmVudC5cbiAgICpcbiAgICogICAgICBpZiAobGF5ZXJFdmVudC5oYXNQcm9wZXJ0eSgnYWdlJykpIHtcbiAgICogICAgICAgICAgaGFuZGxlQWdlQ2hhbmdlKG9iai5hZ2UpO1xuICAgKiAgICAgIH1cbiAgICpcbiAgICogQG1ldGhvZCBoYXNQcm9wZXJ0eVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICBuYW1lIC0gTmFtZSBvZiB0aGUgcHJvcGVydHlcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIGhhc1Byb3BlcnR5KG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaXNDaGFuZ2UpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gQm9vbGVhbih0aGlzLmNoYW5nZXMuZmlsdGVyKGNoYW5nZSA9PiBjaGFuZ2UucHJvcGVydHkgPT09IG5hbWUpLmxlbmd0aCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBjaGFuZ2VzIHRvIHRoZSBwcm9wZXJ0eS5cbiAgICpcbiAgICogUmV0dXJucyBhbiBhcnJheSBvZiBjaGFuZ2VzLlxuICAgKiBJZiB0aGlzIGlzIG5vdCBhIGNoYW5nZSBldmVudCwgd2lsbCByZXR1cm4gW11cbiAgICogQ2hhbmdlcyBhcmUgdHlwaWNhbGx5IG9mIHRoZSBmb3JtOlxuICAgKlxuICAgKiAgICAgIGxheWVyRXZlbnQuZ2V0Q2hhbmdlc0ZvcignYWdlJyk7XG4gICAqICAgICAgPiBbe1xuICAgKiAgICAgICAgICBvbGRWYWx1ZTogMTAsXG4gICAqICAgICAgICAgIG5ld1ZhbHVlOiA1LFxuICAgKiAgICAgICAgICBwcm9wZXJ0eTogJ2FnZSdcbiAgICogICAgICB9XVxuICAgKlxuICAgKiBAbWV0aG9kIGdldENoYW5nZXNGb3JcbiAgICogQHBhcmFtICB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgd2hvc2UgY2hhbmdlcyBhcmUgb2YgaW50ZXJlc3RcbiAgICogQHJldHVybiB7T2JqZWN0W119XG4gICAqL1xuICBnZXRDaGFuZ2VzRm9yKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaXNDaGFuZ2UpIHJldHVybiBbXTtcbiAgICByZXR1cm4gdGhpcy5jaGFuZ2VzLmZpbHRlcihjaGFuZ2UgPT4gY2hhbmdlLnByb3BlcnR5ID09PSBuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZSBjaGFuZ2VzIGludG8gYSBzaW5nbGUgY2hhbmdlcyBhcnJheS5cbiAgICpcbiAgICogVGhlIG90aGVyIGV2ZW50IHdpbGwgbmVlZCB0byBiZSBkZWxldGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9tZXJnZUNoYW5nZXNcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9tZXJnZUNoYW5nZXMoZXZ0KSB7XG4gICAgdGhpcy5jaGFuZ2VzID0gdGhpcy5jaGFuZ2VzLmNvbmNhdChldnQuY2hhbmdlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgY2hhbmdlIGV2ZW50LlxuICpcbiAqIElmIHRoZSBldmVudCBuYW1lIGVuZHMgd2l0aCAnOmNoYW5nZScgdGhlblxuICogaXQgaXMgdHJlYXRlZCBhcyBhIGNoYW5nZSBldmVudDsgIHN1Y2hcbiAqIGV2ZW50cyBhcmUgYXNzdW1lZCB0byBjb21lIHdpdGggYG5ld1ZhbHVlYCwgYG9sZFZhbHVlYCBhbmQgYHByb3BlcnR5YCBpbiB0aGUgbGF5ZXIuTGF5ZXJFdmVudC5jaGFuZ2VzIHByb3BlcnR5LlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbkxheWVyRXZlbnQucHJvdG90eXBlLmlzQ2hhbmdlID0gZmFsc2U7XG5cbi8qKlxuICogQXJyYXkgb2YgY2hhbmdlcyAoQ2hhbmdlIEV2ZW50cyBvbmx5KS5cbiAqXG4gKiBJZiBpdHMgYSBDaGFuZ2UgRXZlbnQsIHRoZW4gdGhlIGNoYW5nZXMgcHJvcGVydHkgY29udGFpbnMgYW4gYXJyYXkgb2YgY2hhbmdlIG9iamVjdHNcbiAqIHdoaWNoIGVhY2ggY29udGFpbjpcbiAqXG4gKiAqIG9sZFZhbHVlXG4gKiAqIG5ld1ZhbHVlXG4gKiAqIHByb3BlcnR5XG4gKlxuICogQHR5cGUge09iamVjdFtdfVxuICovXG5MYXllckV2ZW50LnByb3RvdHlwZS5jaGFuZ2VzID0gbnVsbDtcblxuLyoqXG4gKiBDb21wb25lbnQgdGhhdCB3YXMgdGhlIHNvdXJjZSBvZiB0aGUgY2hhbmdlLlxuICpcbiAqIElmIG9uZSBjYWxsc1xuICpcbiAqICAgICAgb2JqLnRyaWdnZXIoJ2V2ZW50Jyk7XG4gKlxuICogdGhlbiBvYmogd2lsbCBiZSB0aGUgdGFyZ2V0LlxuICogQHR5cGUge2xheWVyLlJvb3R9XG4gKi9cbkxheWVyRXZlbnQucHJvdG90eXBlLnRhcmdldCA9IG51bGw7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgY3JlYXRlZCB0aGlzIGluc3RhbmNlLlxuICpcbiAqIElmIG9uZSBjYWxsc1xuICpcbiAqICAgICAgb2JqLnRyaWdnZXIoJ215ZXZlbnQnKTtcbiAqXG4gKiB0aGVuIGV2ZW50TmFtZSA9ICdteWV2ZW50J1xuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkxheWVyRXZlbnQucHJvdG90eXBlLmV2ZW50TmFtZSA9ICcnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExheWVyRXZlbnQ7XG4iXX0=
