'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TypingPublisher = require('./typing-publisher');

var _require = require('./typing-indicators'),
    STARTED = _require.STARTED,
    PAUSED = _require.PAUSED,
    FINISHED = _require.FINISHED;

/**
 * The Typing Listener Class listens to keyboard events on
 * your text field, and uses the layer.TypingPublisher to
 * send state based on keyboard behavior.
 *
 *      var typingListener = client.createTypingListener(document.getElementById('mytextarea'));
 *
 *  You change what Conversation
 *  the typing indicator reports your user to be typing
 *  in by calling:
 *
 *      typingListener.setConversation(mySelectedConversation);
 *
 * There are two ways of cleaning up all pointers to your input so it can be garbage collected:
 *
 * 1. Destroy the listener:
 *
 *        typingListener.destroy();
 *
 * 2. Remove or replace the input:
 *
 *        typingListener.setInput(null);
 *        typingListener.setInput(newInput);
 *
 * @class  layer.TypingIndicators.TypingListener
 */


var TypingListener = function () {

  /**
   * Create a TypingListener that listens for the user's typing.
   *
   * The TypingListener needs
   * to know what Conversation the user is typing into... but it does not require that parameter during initialization.
   *
   * @method constructor
   * @param  {Object} args
   * @param {string} args.clientId - The ID of the client; used so that the TypingPublisher can access its websocket manager*
   * @param {HTMLElement} [args.input=null] - A Text editor dom node that will have typing indicators
   * @param {Object} [args.conversation=null] - The Conversation Object or Instance that the input will send messages to
   */
  function TypingListener(args) {
    _classCallCheck(this, TypingListener);

    this.clientId = args.clientId;
    this.conversation = args.conversation;
    this.publisher = new TypingPublisher({
      clientId: this.clientId,
      conversation: this.conversation
    });

    this.intervalId = 0;
    this.lastKeyId = 0;

    this._handleKeyPress = this._handleKeyPress.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this.setInput(args.input);
  }

  _createClass(TypingListener, [{
    key: 'destroy',
    value: function destroy() {
      this._removeInput(this.input);
      this.publisher.destroy();
    }

    /**
     * Change the input being tracked by your TypingListener.
     *
     * If you are removing your input from the DOM, you can simply call
     *
     *     typingListener.setInput(null);
     *
     * And all event handlers will be removed, allowing for garbage collection
     * to cleanup your input.
     *
     * You can also call setInput with a newly created input:
     *
     *     var input = document.createElement('input');
     *     typingListener.setInput(input);
     *
     * @method setInput
     * @param {HTMLElement} input - Textarea or text input
     */

  }, {
    key: 'setInput',
    value: function setInput(input) {
      if (input !== this.input) {
        this._removeInput(this.input);
        this.input = input;

        // Use keypress rather than keydown because the user hitting alt-tab to change
        // windows, and other meta keys should not result in typing indicators
        this.input.addEventListener('keypress', this._handleKeyPress);
        this.input.addEventListener('keydown', this._handleKeyDown);
      }
    }

    /**
     * Cleanup and remove all links and callbacks keeping input from being garbage collected.
     *
     * @method _removeInput
     * @private
     * @param {HTMLElement} input - Textarea or text input
     */

  }, {
    key: '_removeInput',
    value: function _removeInput(input) {
      if (input) {
        input.removeEventListener('keypress', this._handleKeyPress);
        input.removeEventListener('keydown', this._handleKeyDown);
        this.input = null;
      }
    }

    /**
     * Change the Conversation; this should set the state of the old Conversation to "finished".
     *
     * Use this when the user has changed Conversations and you want to report on typing to a new
     * Conversation.
     *
     * @method setConversation
     * @param  {Object} conv - The new Conversation Object or Instance
     */

  }, {
    key: 'setConversation',
    value: function setConversation(conv) {
      if (conv !== this.conversation) {
        this.conversation = conv;
        this.publisher.setConversation(conv);
      }
    }

    /**
     * Whenever the key is pressed, send a "started" or "finished" event.
     *
     * If its a "start" event, schedule a pause-test that will send
     * a "pause" event if typing stops.
     *
     * @method _handleKeyPress
     * @private
     * @param  {KeyboardEvent} evt
     */

  }, {
    key: '_handleKeyPress',
    value: function _handleKeyPress(evt) {
      var _this = this;

      if (this.lastKeyId) window.clearTimeout(this.lastKeyId);
      this.lastKeyId = window.setTimeout(function () {
        _this.lastKeyId = 0;
        var isEmpty = !_this.input.value;
        _this.send(isEmpty ? FINISHED : STARTED);
      }, 50);
    }

    /**
     * Handles keyboard keys not reported by on by keypress events.
     *
     * These keys can be detected with keyDown event handlers. The ones
     * currently handled here are backspace, delete and enter.
     * We may add more later.
     *
     * @method _handleKeyDown
     * @private
     * @param  {KeyboardEvent} evt
     */

  }, {
    key: '_handleKeyDown',
    value: function _handleKeyDown(evt) {
      if ([8, 46, 13].indexOf(evt.keyCode) !== -1) this._handleKeyPress();
    }

    /**
     * Send the state to the publisher.
     *
     * If your application requires
     * you to directly control the state, you can call this method;
     * however, as long as you use this TypingListener, keyboard
     * events will overwrite any state changes you send.
     *
     * Common use case for this: After a message is sent, you want to clear any typing indicators:
     *
     *      function send() {
     *        message.send();
     *        typingIndicators.send(layer.TypingIndicators.FINISHED);
     *      }
     *
     * @method send
     * @param  {string} state - One of "started", "paused", "finished"
     */

  }, {
    key: 'send',
    value: function send(state) {
      this.publisher.setState(state);
    }
  }]);

  return TypingListener;
}();

module.exports = TypingListener;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctbGlzdGVuZXIuanMiXSwibmFtZXMiOlsiVHlwaW5nUHVibGlzaGVyIiwicmVxdWlyZSIsIlNUQVJURUQiLCJQQVVTRUQiLCJGSU5JU0hFRCIsIlR5cGluZ0xpc3RlbmVyIiwiYXJncyIsImNsaWVudElkIiwiY29udmVyc2F0aW9uIiwicHVibGlzaGVyIiwiaW50ZXJ2YWxJZCIsImxhc3RLZXlJZCIsIl9oYW5kbGVLZXlQcmVzcyIsImJpbmQiLCJfaGFuZGxlS2V5RG93biIsInNldElucHV0IiwiaW5wdXQiLCJfcmVtb3ZlSW5wdXQiLCJkZXN0cm95IiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJjb252Iiwic2V0Q29udmVyc2F0aW9uIiwiZXZ0Iiwid2luZG93IiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImlzRW1wdHkiLCJ2YWx1ZSIsInNlbmQiLCJpbmRleE9mIiwia2V5Q29kZSIsInN0YXRlIiwic2V0U3RhdGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFNQSxrQkFBa0JDLFFBQVEsb0JBQVIsQ0FBeEI7O2VBQ29DQSxRQUFRLHFCQUFSLEM7SUFBN0JDLE8sWUFBQUEsTztJQUFTQyxNLFlBQUFBLE07SUFBUUMsUSxZQUFBQSxROztBQUV4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQTBCTUMsYzs7QUFFSjs7Ozs7Ozs7Ozs7O0FBWUEsMEJBQVlDLElBQVosRUFBa0I7QUFBQTs7QUFDaEIsU0FBS0MsUUFBTCxHQUFnQkQsS0FBS0MsUUFBckI7QUFDQSxTQUFLQyxZQUFMLEdBQW9CRixLQUFLRSxZQUF6QjtBQUNBLFNBQUtDLFNBQUwsR0FBaUIsSUFBSVQsZUFBSixDQUFvQjtBQUNuQ08sZ0JBQVUsS0FBS0EsUUFEb0I7QUFFbkNDLG9CQUFjLEtBQUtBO0FBRmdCLEtBQXBCLENBQWpCOztBQUtBLFNBQUtFLFVBQUwsR0FBa0IsQ0FBbEI7QUFDQSxTQUFLQyxTQUFMLEdBQWlCLENBQWpCOztBQUVBLFNBQUtDLGVBQUwsR0FBdUIsS0FBS0EsZUFBTCxDQUFxQkMsSUFBckIsQ0FBMEIsSUFBMUIsQ0FBdkI7QUFDQSxTQUFLQyxjQUFMLEdBQXNCLEtBQUtBLGNBQUwsQ0FBb0JELElBQXBCLENBQXlCLElBQXpCLENBQXRCO0FBQ0EsU0FBS0UsUUFBTCxDQUFjVCxLQUFLVSxLQUFuQjtBQUNEOzs7OzhCQUVTO0FBQ1IsV0FBS0MsWUFBTCxDQUFrQixLQUFLRCxLQUF2QjtBQUNBLFdBQUtQLFNBQUwsQ0FBZVMsT0FBZjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7NkJBa0JTRixLLEVBQU87QUFDZCxVQUFJQSxVQUFVLEtBQUtBLEtBQW5CLEVBQTBCO0FBQ3hCLGFBQUtDLFlBQUwsQ0FBa0IsS0FBS0QsS0FBdkI7QUFDQSxhQUFLQSxLQUFMLEdBQWFBLEtBQWI7O0FBRUE7QUFDQTtBQUNBLGFBQUtBLEtBQUwsQ0FBV0csZ0JBQVgsQ0FBNEIsVUFBNUIsRUFBd0MsS0FBS1AsZUFBN0M7QUFDQSxhQUFLSSxLQUFMLENBQVdHLGdCQUFYLENBQTRCLFNBQTVCLEVBQXVDLEtBQUtMLGNBQTVDO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7OztpQ0FPYUUsSyxFQUFPO0FBQ2xCLFVBQUlBLEtBQUosRUFBVztBQUNUQSxjQUFNSSxtQkFBTixDQUEwQixVQUExQixFQUFzQyxLQUFLUixlQUEzQztBQUNBSSxjQUFNSSxtQkFBTixDQUEwQixTQUExQixFQUFxQyxLQUFLTixjQUExQztBQUNBLGFBQUtFLEtBQUwsR0FBYSxJQUFiO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7O29DQVNnQkssSSxFQUFNO0FBQ3BCLFVBQUlBLFNBQVMsS0FBS2IsWUFBbEIsRUFBZ0M7QUFDOUIsYUFBS0EsWUFBTCxHQUFvQmEsSUFBcEI7QUFDQSxhQUFLWixTQUFMLENBQWVhLGVBQWYsQ0FBK0JELElBQS9CO0FBQ0Q7QUFDRjs7QUFHRDs7Ozs7Ozs7Ozs7OztvQ0FVZ0JFLEcsRUFBSztBQUFBOztBQUNuQixVQUFJLEtBQUtaLFNBQVQsRUFBb0JhLE9BQU9DLFlBQVAsQ0FBb0IsS0FBS2QsU0FBekI7QUFDcEIsV0FBS0EsU0FBTCxHQUFpQmEsT0FBT0UsVUFBUCxDQUFrQixZQUFNO0FBQ3ZDLGNBQUtmLFNBQUwsR0FBaUIsQ0FBakI7QUFDQSxZQUFNZ0IsVUFBVSxDQUFDLE1BQUtYLEtBQUwsQ0FBV1ksS0FBNUI7QUFDQSxjQUFLQyxJQUFMLENBQVVGLFVBQVV2QixRQUFWLEdBQXFCRixPQUEvQjtBQUNELE9BSmdCLEVBSWQsRUFKYyxDQUFqQjtBQUtEOztBQUVEOzs7Ozs7Ozs7Ozs7OzttQ0FXZXFCLEcsRUFBSztBQUNsQixVQUFJLENBQUMsQ0FBRCxFQUFJLEVBQUosRUFBUSxFQUFSLEVBQVlPLE9BQVosQ0FBb0JQLElBQUlRLE9BQXhCLE1BQXFDLENBQUMsQ0FBMUMsRUFBNkMsS0FBS25CLGVBQUw7QUFDOUM7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt5QkFrQktvQixLLEVBQU87QUFDVixXQUFLdkIsU0FBTCxDQUFld0IsUUFBZixDQUF3QkQsS0FBeEI7QUFDRDs7Ozs7O0FBR0hFLE9BQU9DLE9BQVAsR0FBaUI5QixjQUFqQiIsImZpbGUiOiJ0eXBpbmctbGlzdGVuZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUeXBpbmdQdWJsaXNoZXIgPSByZXF1aXJlKCcuL3R5cGluZy1wdWJsaXNoZXInKTtcbmNvbnN0IHtTVEFSVEVELCBQQVVTRUQsIEZJTklTSEVEfSA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMnKTtcblxuLyoqXG4gKiBUaGUgVHlwaW5nIExpc3RlbmVyIENsYXNzIGxpc3RlbnMgdG8ga2V5Ym9hcmQgZXZlbnRzIG9uXG4gKiB5b3VyIHRleHQgZmllbGQsIGFuZCB1c2VzIHRoZSBsYXllci5UeXBpbmdQdWJsaXNoZXIgdG9cbiAqIHNlbmQgc3RhdGUgYmFzZWQgb24ga2V5Ym9hcmQgYmVoYXZpb3IuXG4gKlxuICogICAgICB2YXIgdHlwaW5nTGlzdGVuZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nTGlzdGVuZXIoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215dGV4dGFyZWEnKSk7XG4gKlxuICogIFlvdSBjaGFuZ2Ugd2hhdCBDb252ZXJzYXRpb25cbiAqICB0aGUgdHlwaW5nIGluZGljYXRvciByZXBvcnRzIHlvdXIgdXNlciB0byBiZSB0eXBpbmdcbiAqICBpbiBieSBjYWxsaW5nOlxuICpcbiAqICAgICAgdHlwaW5nTGlzdGVuZXIuc2V0Q29udmVyc2F0aW9uKG15U2VsZWN0ZWRDb252ZXJzYXRpb24pO1xuICpcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyBvZiBjbGVhbmluZyB1cCBhbGwgcG9pbnRlcnMgdG8geW91ciBpbnB1dCBzbyBpdCBjYW4gYmUgZ2FyYmFnZSBjb2xsZWN0ZWQ6XG4gKlxuICogMS4gRGVzdHJveSB0aGUgbGlzdGVuZXI6XG4gKlxuICogICAgICAgIHR5cGluZ0xpc3RlbmVyLmRlc3Ryb3koKTtcbiAqXG4gKiAyLiBSZW1vdmUgb3IgcmVwbGFjZSB0aGUgaW5wdXQ6XG4gKlxuICogICAgICAgIHR5cGluZ0xpc3RlbmVyLnNldElucHV0KG51bGwpO1xuICogICAgICAgIHR5cGluZ0xpc3RlbmVyLnNldElucHV0KG5ld0lucHV0KTtcbiAqXG4gKiBAY2xhc3MgIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nTGlzdGVuZXJcbiAqL1xuY2xhc3MgVHlwaW5nTGlzdGVuZXIge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBUeXBpbmdMaXN0ZW5lciB0aGF0IGxpc3RlbnMgZm9yIHRoZSB1c2VyJ3MgdHlwaW5nLlxuICAgKlxuICAgKiBUaGUgVHlwaW5nTGlzdGVuZXIgbmVlZHNcbiAgICogdG8ga25vdyB3aGF0IENvbnZlcnNhdGlvbiB0aGUgdXNlciBpcyB0eXBpbmcgaW50by4uLiBidXQgaXQgZG9lcyBub3QgcmVxdWlyZSB0aGF0IHBhcmFtZXRlciBkdXJpbmcgaW5pdGlhbGl6YXRpb24uXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBhcmdzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhcmdzLmNsaWVudElkIC0gVGhlIElEIG9mIHRoZSBjbGllbnQ7IHVzZWQgc28gdGhhdCB0aGUgVHlwaW5nUHVibGlzaGVyIGNhbiBhY2Nlc3MgaXRzIHdlYnNvY2tldCBtYW5hZ2VyKlxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBbYXJncy5pbnB1dD1udWxsXSAtIEEgVGV4dCBlZGl0b3IgZG9tIG5vZGUgdGhhdCB3aWxsIGhhdmUgdHlwaW5nIGluZGljYXRvcnNcbiAgICogQHBhcmFtIHtPYmplY3R9IFthcmdzLmNvbnZlcnNhdGlvbj1udWxsXSAtIFRoZSBDb252ZXJzYXRpb24gT2JqZWN0IG9yIEluc3RhbmNlIHRoYXQgdGhlIGlucHV0IHdpbGwgc2VuZCBtZXNzYWdlcyB0b1xuICAgKi9cbiAgY29uc3RydWN0b3IoYXJncykge1xuICAgIHRoaXMuY2xpZW50SWQgPSBhcmdzLmNsaWVudElkO1xuICAgIHRoaXMuY29udmVyc2F0aW9uID0gYXJncy5jb252ZXJzYXRpb247XG4gICAgdGhpcy5wdWJsaXNoZXIgPSBuZXcgVHlwaW5nUHVibGlzaGVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmNsaWVudElkLFxuICAgICAgY29udmVyc2F0aW9uOiB0aGlzLmNvbnZlcnNhdGlvbixcbiAgICB9KTtcblxuICAgIHRoaXMuaW50ZXJ2YWxJZCA9IDA7XG4gICAgdGhpcy5sYXN0S2V5SWQgPSAwO1xuXG4gICAgdGhpcy5faGFuZGxlS2V5UHJlc3MgPSB0aGlzLl9oYW5kbGVLZXlQcmVzcy5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX2hhbmRsZUtleURvd24gPSB0aGlzLl9oYW5kbGVLZXlEb3duLmJpbmQodGhpcyk7XG4gICAgdGhpcy5zZXRJbnB1dChhcmdzLmlucHV0KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5fcmVtb3ZlSW5wdXQodGhpcy5pbnB1dCk7XG4gICAgdGhpcy5wdWJsaXNoZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSB0aGUgaW5wdXQgYmVpbmcgdHJhY2tlZCBieSB5b3VyIFR5cGluZ0xpc3RlbmVyLlxuICAgKlxuICAgKiBJZiB5b3UgYXJlIHJlbW92aW5nIHlvdXIgaW5wdXQgZnJvbSB0aGUgRE9NLCB5b3UgY2FuIHNpbXBseSBjYWxsXG4gICAqXG4gICAqICAgICB0eXBpbmdMaXN0ZW5lci5zZXRJbnB1dChudWxsKTtcbiAgICpcbiAgICogQW5kIGFsbCBldmVudCBoYW5kbGVycyB3aWxsIGJlIHJlbW92ZWQsIGFsbG93aW5nIGZvciBnYXJiYWdlIGNvbGxlY3Rpb25cbiAgICogdG8gY2xlYW51cCB5b3VyIGlucHV0LlxuICAgKlxuICAgKiBZb3UgY2FuIGFsc28gY2FsbCBzZXRJbnB1dCB3aXRoIGEgbmV3bHkgY3JlYXRlZCBpbnB1dDpcbiAgICpcbiAgICogICAgIHZhciBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAqICAgICB0eXBpbmdMaXN0ZW5lci5zZXRJbnB1dChpbnB1dCk7XG4gICAqXG4gICAqIEBtZXRob2Qgc2V0SW5wdXRcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5wdXQgLSBUZXh0YXJlYSBvciB0ZXh0IGlucHV0XG4gICAqL1xuICBzZXRJbnB1dChpbnB1dCkge1xuICAgIGlmIChpbnB1dCAhPT0gdGhpcy5pbnB1dCkge1xuICAgICAgdGhpcy5fcmVtb3ZlSW5wdXQodGhpcy5pbnB1dCk7XG4gICAgICB0aGlzLmlucHV0ID0gaW5wdXQ7XG5cbiAgICAgIC8vIFVzZSBrZXlwcmVzcyByYXRoZXIgdGhhbiBrZXlkb3duIGJlY2F1c2UgdGhlIHVzZXIgaGl0dGluZyBhbHQtdGFiIHRvIGNoYW5nZVxuICAgICAgLy8gd2luZG93cywgYW5kIG90aGVyIG1ldGEga2V5cyBzaG91bGQgbm90IHJlc3VsdCBpbiB0eXBpbmcgaW5kaWNhdG9yc1xuICAgICAgdGhpcy5pbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIHRoaXMuX2hhbmRsZUtleVByZXNzKTtcbiAgICAgIHRoaXMuaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuX2hhbmRsZUtleURvd24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwIGFuZCByZW1vdmUgYWxsIGxpbmtzIGFuZCBjYWxsYmFja3Mga2VlcGluZyBpbnB1dCBmcm9tIGJlaW5nIGdhcmJhZ2UgY29sbGVjdGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVJbnB1dFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBpbnB1dCAtIFRleHRhcmVhIG9yIHRleHQgaW5wdXRcbiAgICovXG4gIF9yZW1vdmVJbnB1dChpbnB1dCkge1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgaW5wdXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCB0aGlzLl9oYW5kbGVLZXlQcmVzcyk7XG4gICAgICBpbnB1dC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5faGFuZGxlS2V5RG93bik7XG4gICAgICB0aGlzLmlucHV0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIHRoZSBDb252ZXJzYXRpb247IHRoaXMgc2hvdWxkIHNldCB0aGUgc3RhdGUgb2YgdGhlIG9sZCBDb252ZXJzYXRpb24gdG8gXCJmaW5pc2hlZFwiLlxuICAgKlxuICAgKiBVc2UgdGhpcyB3aGVuIHRoZSB1c2VyIGhhcyBjaGFuZ2VkIENvbnZlcnNhdGlvbnMgYW5kIHlvdSB3YW50IHRvIHJlcG9ydCBvbiB0eXBpbmcgdG8gYSBuZXdcbiAgICogQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIHNldENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnYgLSBUaGUgbmV3IENvbnZlcnNhdGlvbiBPYmplY3Qgb3IgSW5zdGFuY2VcbiAgICovXG4gIHNldENvbnZlcnNhdGlvbihjb252KSB7XG4gICAgaWYgKGNvbnYgIT09IHRoaXMuY29udmVyc2F0aW9uKSB7XG4gICAgICB0aGlzLmNvbnZlcnNhdGlvbiA9IGNvbnY7XG4gICAgICB0aGlzLnB1Ymxpc2hlci5zZXRDb252ZXJzYXRpb24oY29udik7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogV2hlbmV2ZXIgdGhlIGtleSBpcyBwcmVzc2VkLCBzZW5kIGEgXCJzdGFydGVkXCIgb3IgXCJmaW5pc2hlZFwiIGV2ZW50LlxuICAgKlxuICAgKiBJZiBpdHMgYSBcInN0YXJ0XCIgZXZlbnQsIHNjaGVkdWxlIGEgcGF1c2UtdGVzdCB0aGF0IHdpbGwgc2VuZFxuICAgKiBhIFwicGF1c2VcIiBldmVudCBpZiB0eXBpbmcgc3RvcHMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUtleVByZXNzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge0tleWJvYXJkRXZlbnR9IGV2dFxuICAgKi9cbiAgX2hhbmRsZUtleVByZXNzKGV2dCkge1xuICAgIGlmICh0aGlzLmxhc3RLZXlJZCkgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmxhc3RLZXlJZCk7XG4gICAgdGhpcy5sYXN0S2V5SWQgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLmxhc3RLZXlJZCA9IDA7XG4gICAgICBjb25zdCBpc0VtcHR5ID0gIXRoaXMuaW5wdXQudmFsdWU7XG4gICAgICB0aGlzLnNlbmQoaXNFbXB0eSA/IEZJTklTSEVEIDogU1RBUlRFRCk7XG4gICAgfSwgNTApO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMga2V5Ym9hcmQga2V5cyBub3QgcmVwb3J0ZWQgYnkgb24gYnkga2V5cHJlc3MgZXZlbnRzLlxuICAgKlxuICAgKiBUaGVzZSBrZXlzIGNhbiBiZSBkZXRlY3RlZCB3aXRoIGtleURvd24gZXZlbnQgaGFuZGxlcnMuIFRoZSBvbmVzXG4gICAqIGN1cnJlbnRseSBoYW5kbGVkIGhlcmUgYXJlIGJhY2tzcGFjZSwgZGVsZXRlIGFuZCBlbnRlci5cbiAgICogV2UgbWF5IGFkZCBtb3JlIGxhdGVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVLZXlEb3duXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge0tleWJvYXJkRXZlbnR9IGV2dFxuICAgKi9cbiAgX2hhbmRsZUtleURvd24oZXZ0KSB7XG4gICAgaWYgKFs4LCA0NiwgMTNdLmluZGV4T2YoZXZ0LmtleUNvZGUpICE9PSAtMSkgdGhpcy5faGFuZGxlS2V5UHJlc3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIHRoZSBzdGF0ZSB0byB0aGUgcHVibGlzaGVyLlxuICAgKlxuICAgKiBJZiB5b3VyIGFwcGxpY2F0aW9uIHJlcXVpcmVzXG4gICAqIHlvdSB0byBkaXJlY3RseSBjb250cm9sIHRoZSBzdGF0ZSwgeW91IGNhbiBjYWxsIHRoaXMgbWV0aG9kO1xuICAgKiBob3dldmVyLCBhcyBsb25nIGFzIHlvdSB1c2UgdGhpcyBUeXBpbmdMaXN0ZW5lciwga2V5Ym9hcmRcbiAgICogZXZlbnRzIHdpbGwgb3ZlcndyaXRlIGFueSBzdGF0ZSBjaGFuZ2VzIHlvdSBzZW5kLlxuICAgKlxuICAgKiBDb21tb24gdXNlIGNhc2UgZm9yIHRoaXM6IEFmdGVyIGEgbWVzc2FnZSBpcyBzZW50LCB5b3Ugd2FudCB0byBjbGVhciBhbnkgdHlwaW5nIGluZGljYXRvcnM6XG4gICAqXG4gICAqICAgICAgZnVuY3Rpb24gc2VuZCgpIHtcbiAgICogICAgICAgIG1lc3NhZ2Uuc2VuZCgpO1xuICAgKiAgICAgICAgdHlwaW5nSW5kaWNhdG9ycy5zZW5kKGxheWVyLlR5cGluZ0luZGljYXRvcnMuRklOSVNIRUQpO1xuICAgKiAgICAgIH1cbiAgICpcbiAgICogQG1ldGhvZCBzZW5kXG4gICAqIEBwYXJhbSAge3N0cmluZ30gc3RhdGUgLSBPbmUgb2YgXCJzdGFydGVkXCIsIFwicGF1c2VkXCIsIFwiZmluaXNoZWRcIlxuICAgKi9cbiAgc2VuZChzdGF0ZSkge1xuICAgIHRoaXMucHVibGlzaGVyLnNldFN0YXRlKHN0YXRlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFR5cGluZ0xpc3RlbmVyO1xuIl19
