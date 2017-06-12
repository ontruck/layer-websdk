'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class represents a Layer Error.
 *
 * At this point, a LayerError is only used in response to an error from the server.
 * It may be extended to report on internal errors... but typically internal errors
 * are reported via `throw new Error(...);`
 *
 * Layer Error is passed as part of the layer.LayerEvent's data property.
 *
 * Throw an error:
 *
 *     object.trigger('xxx-error', new LayerEvent({
 *       data: new LayerError()
 *     }));
 *
 *  Receive an Error:
 *
 *     conversation.on('loaded-error', function(errEvt) {
 *        var error = errEvt.data;
 *        console.error(error.message);
 *     });
 *
 * @class layer.LayerError
 */
var Logger = require('./logger');

var LayerError = function () {
  function LayerError(options) {
    var _this = this;

    _classCallCheck(this, LayerError);

    if (options instanceof LayerError) {
      options = {
        errType: options.errType,
        httpStatus: options.httpStatus,
        message: options.message,
        code: options.code,
        url: options.url,
        data: options.data
      };
    } else if (options && (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
      options.errType = options.id;
    } else {
      options = {
        message: options
      };
    }

    Object.keys(options).forEach(function (name) {
      return _this[name] = options[name];
    });
    if (!this.data) this.data = {};
  }

  /**
   * Returns either '' or a nonce.
   *
   * If a nonce has been returned
   * by the server as part of a session-expiration error,
   * then this method will return that nonce.
   *
   * @method getNonce
   * @return {string} nonce
   */


  _createClass(LayerError, [{
    key: 'getNonce',
    value: function getNonce() {
      return this.data && this.data.nonce ? this.data.nonce : '';
    }

    /**
     * String representation of the error
     *
     * @method toString
     * @return {string}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.code + ' (' + this.id + '): ' + this.message + '; (see ' + this.url + ')';
    }

    /**
     * Log the errors
     *
     * @method log
     * @deprecated see layer.Logger
     */

  }, {
    key: 'log',
    value: function log() {
      Logger.error('Layer-Error: ' + this.toString());
    }
  }]);

  return LayerError;
}();

/**
 * A string name for the event; these names are paired with codes.
 *
 * Codes can be looked up at https://github.com/layerhq/docs/blob/web-api/specs/rest-api.md#client-errors
 * @type {String}
 */


LayerError.prototype.errType = '';

/**
 * Numerical error code.
 *
 * https://developer.layer.com/docs/client/rest#full-list
 * @type {Number}
 */
LayerError.prototype.code = 0;

/**
 * URL to go to for more information on this error.
 * @type {String}
 */
LayerError.prototype.url = '';

/**
 * Detailed description of the error.
 * @type {String}
 */
LayerError.prototype.message = '';

/**
 * Http error code; no value if its a websocket response.
 * @type {Number}
 */
LayerError.prototype.httpStatus = 0;

/**
 * Contains data from the xhr request object.
 *
 *  * url: the url to the service endpoint
 *  * data: xhr.data,
 *  * xhr: XMLHttpRequest object
 *
 * @type {Object}
 */
LayerError.prototype.request = null;

/**
 * Any additional details about the error sent as additional properties.
 * @type {Object}
 */
LayerError.prototype.data = null;

/**
 * Pointer to the xhr object that fired the actual request and contains the response.
 * @type {XMLHttpRequest}
 */
LayerError.prototype.xhr = null;

/**
 * Dictionary of error messages
 * @property {Object} [dictionary={}]
 */
LayerError.dictionary = {
  appIdMissing: 'Property missing: appId is required',
  identityTokenMissing: 'Identity Token missing: answerAuthenticationChallenge requires an identity token',
  sessionTokenMissing: 'Session Token missing: _authComplete requires a {session_token: value} input',
  clientMissing: 'Property missing: client is required',
  conversationMissing: 'Property missing: conversation is required',
  partsMissing: 'Property missing: parts is required',
  moreParticipantsRequired: 'Conversation needs participants other than the current user',
  isDestroyed: 'Object is destroyed',
  urlRequired: 'Object needs a url property',
  invalidUrl: 'URL is invalid',
  invalidId: 'Identifier is invalid',
  idParamRequired: 'The ID Parameter is required',
  wrongClass: 'Parameter class error; should be: ',
  inProgress: 'Operation already in progress',
  cantChangeIfConnected: 'You can not change value after connecting',
  cantChangeUserId: 'You can not change the userId property',
  alreadySent: 'Already sent or sending',
  contentRequired: 'MessagePart requires rich content for this call',
  alreadyDestroyed: 'This object has already been destroyed',
  deletionModeUnsupported: 'Call to deletion was made with an unsupported deletion mode',
  sessionAndUserRequired: 'connectWithSession requires both a userId and a sessionToken',
  invalidUserIdChange: 'The prn field in the Identity Token must match the requested UserID',
  predicateNotSupported: 'The predicate is not supported for this value of model',
  invalidPredicate: 'The predicate does not match the expected format',
  appIdImmutable: 'The appId property cannot be changed',
  clientMustBeReady: 'The Client must have triggered its "ready" event before you can call this',
  modelImmutable: 'The model property cannot be changed'
};

module.exports = LayerError;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sYXllci1lcnJvci5qcyJdLCJuYW1lcyI6WyJMb2dnZXIiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIm9wdGlvbnMiLCJlcnJUeXBlIiwiaHR0cFN0YXR1cyIsIm1lc3NhZ2UiLCJjb2RlIiwidXJsIiwiZGF0YSIsImlkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJuYW1lIiwibm9uY2UiLCJlcnJvciIsInRvU3RyaW5nIiwicHJvdG90eXBlIiwicmVxdWVzdCIsInhociIsImRpY3Rpb25hcnkiLCJhcHBJZE1pc3NpbmciLCJpZGVudGl0eVRva2VuTWlzc2luZyIsInNlc3Npb25Ub2tlbk1pc3NpbmciLCJjbGllbnRNaXNzaW5nIiwiY29udmVyc2F0aW9uTWlzc2luZyIsInBhcnRzTWlzc2luZyIsIm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCIsImlzRGVzdHJveWVkIiwidXJsUmVxdWlyZWQiLCJpbnZhbGlkVXJsIiwiaW52YWxpZElkIiwiaWRQYXJhbVJlcXVpcmVkIiwid3JvbmdDbGFzcyIsImluUHJvZ3Jlc3MiLCJjYW50Q2hhbmdlSWZDb25uZWN0ZWQiLCJjYW50Q2hhbmdlVXNlcklkIiwiYWxyZWFkeVNlbnQiLCJjb250ZW50UmVxdWlyZWQiLCJhbHJlYWR5RGVzdHJveWVkIiwiZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQiLCJzZXNzaW9uQW5kVXNlclJlcXVpcmVkIiwiaW52YWxpZFVzZXJJZENoYW5nZSIsInByZWRpY2F0ZU5vdFN1cHBvcnRlZCIsImludmFsaWRQcmVkaWNhdGUiLCJhcHBJZEltbXV0YWJsZSIsImNsaWVudE11c3RCZVJlYWR5IiwibW9kZWxJbW11dGFibGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QkEsSUFBTUEsU0FBU0MsUUFBUSxVQUFSLENBQWY7O0lBRU1DLFU7QUFDSixzQkFBWUMsT0FBWixFQUFxQjtBQUFBOztB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STtBQXlCdEJDLGtCQUFnQixzQ0F6Qk07QUEwQnRCQyxxQkFBbUIsMkVBMUJHO0FBMkJ0QkMsa0JBQWdCO0FBM0JNLENBQXhCOztBQThCQUMsT0FBT0MsT0FBUCxHQUFpQmhELFVBQWpCIiwiZmlsZSI6ImxheWVyLWVycm9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBMYXllciBFcnJvci5cbiAqXG4gKiBBdCB0aGlzIHBvaW50LCBhIExheWVyRXJyb3IgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIGFuIGVycm9yIGZyb20gdGhlIHNlcnZlci5cbiAqIEl0IG1heSBiZSBleHRlbmRlZCB0byByZXBvcnQgb24gaW50ZXJuYWwgZXJyb3JzLi4uIGJ1dCB0eXBpY2FsbHkgaW50ZXJuYWwgZXJyb3JzXG4gKiBhcmUgcmVwb3J0ZWQgdmlhIGB0aHJvdyBuZXcgRXJyb3IoLi4uKTtgXG4gKlxuICogTGF5ZXIgRXJyb3IgaXMgcGFzc2VkIGFzIHBhcnQgb2YgdGhlIGxheWVyLkxheWVyRXZlbnQncyBkYXRhIHByb3BlcnR5LlxuICpcbiAqIFRocm93IGFuIGVycm9yOlxuICpcbiAqICAgICBvYmplY3QudHJpZ2dlcigneHh4LWVycm9yJywgbmV3IExheWVyRXZlbnQoe1xuICogICAgICAgZGF0YTogbmV3IExheWVyRXJyb3IoKVxuICogICAgIH0pKTtcbiAqXG4gKiAgUmVjZWl2ZSBhbiBFcnJvcjpcbiAqXG4gKiAgICAgY29udmVyc2F0aW9uLm9uKCdsb2FkZWQtZXJyb3InLCBmdW5jdGlvbihlcnJFdnQpIHtcbiAqICAgICAgICB2YXIgZXJyb3IgPSBlcnJFdnQuZGF0YTtcbiAqICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICogICAgIH0pO1xuICpcbiAqIEBjbGFzcyBsYXllci5MYXllckVycm9yXG4gKi9cbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5cbmNsYXNzIExheWVyRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBMYXllckVycm9yKSB7XG4gICAgICBvcHRpb25zID0ge1xuICAgICAgICBlcnJUeXBlOiBvcHRpb25zLmVyclR5cGUsXG4gICAgICAgIGh0dHBTdGF0dXM6IG9wdGlvbnMuaHR0cFN0YXR1cyxcbiAgICAgICAgbWVzc2FnZTogb3B0aW9ucy5tZXNzYWdlLFxuICAgICAgICBjb2RlOiBvcHRpb25zLmNvZGUsXG4gICAgICAgIHVybDogb3B0aW9ucy51cmwsXG4gICAgICAgIGRhdGE6IG9wdGlvbnMuZGF0YSxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0Jykge1xuICAgICAgb3B0aW9ucy5lcnJUeXBlID0gb3B0aW9ucy5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgbWVzc2FnZTogb3B0aW9ucyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMob3B0aW9ucykuZm9yRWFjaChuYW1lID0+ICh0aGlzW25hbWVdID0gb3B0aW9uc1tuYW1lXSkpO1xuICAgIGlmICghdGhpcy5kYXRhKSB0aGlzLmRhdGEgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGVpdGhlciAnJyBvciBhIG5vbmNlLlxuICAgKlxuICAgKiBJZiBhIG5vbmNlIGhhcyBiZWVuIHJldHVybmVkXG4gICAqIGJ5IHRoZSBzZXJ2ZXIgYXMgcGFydCBvZiBhIHNlc3Npb24tZXhwaXJhdGlvbiBlcnJvcixcbiAgICogdGhlbiB0aGlzIG1ldGhvZCB3aWxsIHJldHVybiB0aGF0IG5vbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE5vbmNlXG4gICAqIEByZXR1cm4ge3N0cmluZ30gbm9uY2VcbiAgICovXG4gIGdldE5vbmNlKCkge1xuICAgIHJldHVybiAodGhpcy5kYXRhICYmIHRoaXMuZGF0YS5ub25jZSkgPyB0aGlzLmRhdGEubm9uY2UgOiAnJztcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgdG9TdHJpbmdcbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29kZSArICcgKCcgKyB0aGlzLmlkICsgJyk6ICcgKyB0aGlzLm1lc3NhZ2UgKyAnOyAoc2VlICcgKyB0aGlzLnVybCArICcpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgdGhlIGVycm9yc1xuICAgKlxuICAgKiBAbWV0aG9kIGxvZ1xuICAgKiBAZGVwcmVjYXRlZCBzZWUgbGF5ZXIuTG9nZ2VyXG4gICAqL1xuICBsb2coKSB7XG4gICAgTG9nZ2VyLmVycm9yKCdMYXllci1FcnJvcjogJyArIHRoaXMudG9TdHJpbmcoKSk7XG4gIH1cblxufVxuXG4vKipcbiAqIEEgc3RyaW5nIG5hbWUgZm9yIHRoZSBldmVudDsgdGhlc2UgbmFtZXMgYXJlIHBhaXJlZCB3aXRoIGNvZGVzLlxuICpcbiAqIENvZGVzIGNhbiBiZSBsb29rZWQgdXAgYXQgaHR0cHM6Ly9naXRodWIuY29tL2xheWVyaHEvZG9jcy9ibG9iL3dlYi1hcGkvc3BlY3MvcmVzdC1hcGkubWQjY2xpZW50LWVycm9yc1xuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUuZXJyVHlwZSA9ICcnO1xuXG4vKipcbiAqIE51bWVyaWNhbCBlcnJvciBjb2RlLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL2NsaWVudC9yZXN0I2Z1bGwtbGlzdFxuICogQHR5cGUge051bWJlcn1cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUuY29kZSA9IDA7XG5cbi8qKlxuICogVVJMIHRvIGdvIHRvIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoaXMgZXJyb3IuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBEZXRhaWxlZCBkZXNjcmlwdGlvbiBvZiB0aGUgZXJyb3IuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5tZXNzYWdlID0gJyc7XG5cbi8qKlxuICogSHR0cCBlcnJvciBjb2RlOyBubyB2YWx1ZSBpZiBpdHMgYSB3ZWJzb2NrZXQgcmVzcG9uc2UuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5odHRwU3RhdHVzID0gMDtcblxuLyoqXG4gKiBDb250YWlucyBkYXRhIGZyb20gdGhlIHhociByZXF1ZXN0IG9iamVjdC5cbiAqXG4gKiAgKiB1cmw6IHRoZSB1cmwgdG8gdGhlIHNlcnZpY2UgZW5kcG9pbnRcbiAqICAqIGRhdGE6IHhoci5kYXRhLFxuICogICogeGhyOiBYTUxIdHRwUmVxdWVzdCBvYmplY3RcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5yZXF1ZXN0ID0gbnVsbDtcblxuLyoqXG4gKiBBbnkgYWRkaXRpb25hbCBkZXRhaWxzIGFib3V0IHRoZSBlcnJvciBzZW50IGFzIGFkZGl0aW9uYWwgcHJvcGVydGllcy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLmRhdGEgPSBudWxsO1xuXG4vKipcbiAqIFBvaW50ZXIgdG8gdGhlIHhociBvYmplY3QgdGhhdCBmaXJlZCB0aGUgYWN0dWFsIHJlcXVlc3QgYW5kIGNvbnRhaW5zIHRoZSByZXNwb25zZS5cbiAqIEB0eXBlIHtYTUxIdHRwUmVxdWVzdH1cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUueGhyID0gbnVsbDtcblxuLyoqXG4gKiBEaWN0aW9uYXJ5IG9mIGVycm9yIG1lc3NhZ2VzXG4gKiBAcHJvcGVydHkge09iamVjdH0gW2RpY3Rpb25hcnk9e31dXG4gKi9cbkxheWVyRXJyb3IuZGljdGlvbmFyeSA9IHtcbiAgYXBwSWRNaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogYXBwSWQgaXMgcmVxdWlyZWQnLFxuICBpZGVudGl0eVRva2VuTWlzc2luZzogJ0lkZW50aXR5IFRva2VuIG1pc3Npbmc6IGFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlIHJlcXVpcmVzIGFuIGlkZW50aXR5IHRva2VuJyxcbiAgc2Vzc2lvblRva2VuTWlzc2luZzogJ1Nlc3Npb24gVG9rZW4gbWlzc2luZzogX2F1dGhDb21wbGV0ZSByZXF1aXJlcyBhIHtzZXNzaW9uX3Rva2VuOiB2YWx1ZX0gaW5wdXQnLFxuICBjbGllbnRNaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogY2xpZW50IGlzIHJlcXVpcmVkJyxcbiAgY29udmVyc2F0aW9uTWlzc2luZzogJ1Byb3BlcnR5IG1pc3Npbmc6IGNvbnZlcnNhdGlvbiBpcyByZXF1aXJlZCcsXG4gIHBhcnRzTWlzc2luZzogJ1Byb3BlcnR5IG1pc3Npbmc6IHBhcnRzIGlzIHJlcXVpcmVkJyxcbiAgbW9yZVBhcnRpY2lwYW50c1JlcXVpcmVkOiAnQ29udmVyc2F0aW9uIG5lZWRzIHBhcnRpY2lwYW50cyBvdGhlciB0aGFuIHRoZSBjdXJyZW50IHVzZXInLFxuICBpc0Rlc3Ryb3llZDogJ09iamVjdCBpcyBkZXN0cm95ZWQnLFxuICB1cmxSZXF1aXJlZDogJ09iamVjdCBuZWVkcyBhIHVybCBwcm9wZXJ0eScsXG4gIGludmFsaWRVcmw6ICdVUkwgaXMgaW52YWxpZCcsXG4gIGludmFsaWRJZDogJ0lkZW50aWZpZXIgaXMgaW52YWxpZCcsXG4gIGlkUGFyYW1SZXF1aXJlZDogJ1RoZSBJRCBQYXJhbWV0ZXIgaXMgcmVxdWlyZWQnLFxuICB3cm9uZ0NsYXNzOiAnUGFyYW1ldGVyIGNsYXNzIGVycm9yOyBzaG91bGQgYmU6ICcsXG4gIGluUHJvZ3Jlc3M6ICdPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcycsXG4gIGNhbnRDaGFuZ2VJZkNvbm5lY3RlZDogJ1lvdSBjYW4gbm90IGNoYW5nZSB2YWx1ZSBhZnRlciBjb25uZWN0aW5nJyxcbiAgY2FudENoYW5nZVVzZXJJZDogJ1lvdSBjYW4gbm90IGNoYW5nZSB0aGUgdXNlcklkIHByb3BlcnR5JyxcbiAgYWxyZWFkeVNlbnQ6ICdBbHJlYWR5IHNlbnQgb3Igc2VuZGluZycsXG4gIGNvbnRlbnRSZXF1aXJlZDogJ01lc3NhZ2VQYXJ0IHJlcXVpcmVzIHJpY2ggY29udGVudCBmb3IgdGhpcyBjYWxsJyxcbiAgYWxyZWFkeURlc3Ryb3llZDogJ1RoaXMgb2JqZWN0IGhhcyBhbHJlYWR5IGJlZW4gZGVzdHJveWVkJyxcbiAgZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQ6ICdDYWxsIHRvIGRlbGV0aW9uIHdhcyBtYWRlIHdpdGggYW4gdW5zdXBwb3J0ZWQgZGVsZXRpb24gbW9kZScsXG4gIHNlc3Npb25BbmRVc2VyUmVxdWlyZWQ6ICdjb25uZWN0V2l0aFNlc3Npb24gcmVxdWlyZXMgYm90aCBhIHVzZXJJZCBhbmQgYSBzZXNzaW9uVG9rZW4nLFxuICBpbnZhbGlkVXNlcklkQ2hhbmdlOiAnVGhlIHBybiBmaWVsZCBpbiB0aGUgSWRlbnRpdHkgVG9rZW4gbXVzdCBtYXRjaCB0aGUgcmVxdWVzdGVkIFVzZXJJRCcsXG4gIHByZWRpY2F0ZU5vdFN1cHBvcnRlZDogJ1RoZSBwcmVkaWNhdGUgaXMgbm90IHN1cHBvcnRlZCBmb3IgdGhpcyB2YWx1ZSBvZiBtb2RlbCcsXG4gIGludmFsaWRQcmVkaWNhdGU6ICdUaGUgcHJlZGljYXRlIGRvZXMgbm90IG1hdGNoIHRoZSBleHBlY3RlZCBmb3JtYXQnLFxuICBhcHBJZEltbXV0YWJsZTogJ1RoZSBhcHBJZCBwcm9wZXJ0eSBjYW5ub3QgYmUgY2hhbmdlZCcsXG4gIGNsaWVudE11c3RCZVJlYWR5OiAnVGhlIENsaWVudCBtdXN0IGhhdmUgdHJpZ2dlcmVkIGl0cyBcInJlYWR5XCIgZXZlbnQgYmVmb3JlIHlvdSBjYW4gY2FsbCB0aGlzJyxcbiAgbW9kZWxJbW11dGFibGU6ICdUaGUgbW9kZWwgcHJvcGVydHkgY2Fubm90IGJlIGNoYW5nZWQnLFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMYXllckVycm9yO1xuIl19
