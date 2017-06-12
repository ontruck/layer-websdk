'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * The TypingPublisher's job is:
 *
 *  1. Send state changes to the server
 *  2. Insure that the server is not flooded with repeated state changes of the same value
 *  3. Automatically transition states when no new states or old states are requested.
 *
 * Who is the Typing Publisher for?  Its used by the layer.TypingIndicators.TypingListener; if your using
 * the TypingListener, you don't need this.  If you want to provide your own logic for when to send typing
 * states, then you need the TypingPublisher.
 *
 * Create an instance using:
 *
 *        var publisher = client.createTypingPublisher();
 *
 * To tell the Publisher which Conversation its reporting activity on, use:
 *
 *        publisher.setConversation(mySelectedConversation);
 *
 * To then use the instance:
 *
 *        publisher.setState(layer.TypingIndicators.STARTED);
 *        publisher.setState(layer.TypingIndicators.PAUSED);
 *        publisher.setState(layer.TypingIndicators.FINISHED);
 *
 * Note that the `STARTED` state only lasts for 2.5 seconds, so you
 * must repeatedly call setState for as long as this state should continue.
 * This is typically done by simply calling `setState(STARTED)` every time a user hits
 * a key.
 *
 * A few rules for how the *publisher* works internally:
 *
 *  - it maintains an indicator state for the current conversation
 *  - if app calls  `setState(layer.TypingIndicators.STARTED);` publisher sends the event immediately
 *  - if app calls the same method under _2.5 seconds_ with the same typing indicator state (`started`), publisher waits
 *    for those 2.5 seconds to pass and then publishes the ephemeral event
 *  - if app calls the same methods multiple times within _2.5 seconds_ with the same value,
 *    publisher waits until end of 2.5 second period and sends the state only once.
 *  - if app calls the same method under _2.5 seconds_ with a different typing indicator state (say `paused`),
 *    publisher immediately sends the event
 *  - if 2.5 seconds passes without any events, state transitions from 'started' to 'paused'
 *  - if 2.5 seconds passes without any events, state transitions from 'paused' to 'finished'
 *
 * @class layer.TypingIndicators.TypingPublisher
 * @protected
 */

var INTERVAL = 2500;

var _require = require('./typing-indicators'),
    STARTED = _require.STARTED,
    PAUSED = _require.PAUSED,
    FINISHED = _require.FINISHED;

var ClientRegistry = require('../client-registry');

var TypingPublisher = function () {

  /**
   * Create a Typing Publisher.  See layer.Client.createTypingPublisher.
   *
   * The TypingPublisher needs
   * to know what Conversation its publishing changes for...
   * but it does not require that parameter during initialization.
   *
   * @method constructor
   * @param {Object} args
   * @param {string} clientId - The ID for the client from which we will get access to the websocket
   * @param {Object} [conversation=null] - The Conversation Object or Instance that messages are being typed to.
   */
  function TypingPublisher(args) {
    _classCallCheck(this, TypingPublisher);

    this.clientId = args.clientId;
    if (args.conversation) this.conversation = this._getClient().getObject(args.conversation.id);
    this.state = FINISHED;
    this._lastMessageTime = 0;
  }

  /**
   * Set which Conversation we are reporting on state changes for.
   *
   * If this instance managed a previous Conversation,
   * its state is immediately transitioned to "finished".
   *
   * @method setConversation
   * @param  {Object} conv - Conversation Object or Instance
   */


  _createClass(TypingPublisher, [{
    key: 'setConversation',
    value: function setConversation(conv) {
      this.setState(FINISHED);
      this.conversation = conv ? this._getClient().getObject(conv.id) : null;
      this.state = FINISHED;
    }

    /**
     * Sets the state and either sends the state to the server or schedules it to be sent.
     *
     * @method setState
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: 'setState',
    value: function setState(state) {
      // We have a fresh state; whatever our pauseLoop was doing
      // can be canceled... and restarted later.
      if (this._pauseLoopId) {
        clearInterval(this._pauseLoopId);
        this._pauseLoopId = 0;
      }
      if (!this.conversation) return;

      // If its a new state, send it immediately.
      if (this.state !== state) {
        this.state = state;
        this._send(state);
      }

      // No need to resend 'finished' state
      else if (state === FINISHED) {
          return;
        }

        // If its an existing state that hasn't been sent in the
        // last 2.5 seconds, send it immediately.
        else if (Date.now() > this._lastMessageTime + INTERVAL) {
            this._send(state);
          }

          // Else schedule it to be sent.
          else {
              this._scheduleNextMessage(state);
            }

      // Start test to automatically transition if 2.5 seconds without any setState calls
      if (this.state !== FINISHED) this._startPauseLoop();
    }

    /**
     * Start loop to automatically change to next state.
     *
     * Any time we are set to 'started' or 'paused' we should transition
     * to the next state after 2.5 seconds of no setState calls.
     *
     * The 2.5 second setTimeout is canceled/restarted every call to setState()
     *
     * @method _startPauseLoop
     * @private
     */

  }, {
    key: '_startPauseLoop',
    value: function _startPauseLoop() {
      var _this = this;

      if (this._pauseLoopId) return;

      // Note that this interval is canceled every call to setState.
      this._pauseLoopId = window.setInterval(function () {
        if (_this.state === PAUSED) {
          _this.setState(FINISHED);
        } else if (_this.state === STARTED) {
          _this.setState(PAUSED);
        }
      }, INTERVAL);
    }

    /**
     * Schedule the next state refresh message.
     *
     * It should be at least INTERVAL ms after
     * the last state message of the same state
     *
     * @method _scheduleNextMessage
     * @private
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: '_scheduleNextMessage',
    value: function _scheduleNextMessage(state) {
      var _this2 = this;

      if (this._scheduleId) clearTimeout(this._scheduleId);
      var delay = INTERVAL - Math.min(Date.now() - this._lastMessageTime, INTERVAL);
      this._scheduleId = setTimeout(function () {
        _this2._scheduleId = 0;
        // If the state didn't change while waiting...
        if (_this2.state === state) _this2._send(state);
      }, delay);
    }

    /**
     * Send a state change to the server.
     *
     * @method send
     * @private
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: '_send',
    value: function _send(state) {
      if (!this.conversation.isSaved()) return;
      this._lastMessageTime = Date.now();
      var ws = this._getClient().socketManager;
      ws.sendSignal({
        type: 'typing_indicator',
        object: {
          id: this.conversation.id
        },
        data: {
          action: state
        }
      });
    }

    /**
     * Get the Client associated with this layer.Message.
     *
     * Uses the clientId property.
     *
     * @method getClient
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      delete this.conversation;
      this.isDestroyed = true;
      clearTimeout(this._scheduleId);
      clearInterval(this._pauseLoopId);
    }
  }]);

  return TypingPublisher;
}();

module.exports = TypingPublisher;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctcHVibGlzaGVyLmpzIl0sIm5hbWVzIjpbIklOVEVSVkFMIiwicmVxdWlyZSIsIlNUQVJURUQiLCJQQVVTRUQiLCJGSU5JU0hFRCIsIkNsaWVudFJlZ2lzdHJ5IiwiVHlwaW5nUHVibGlzaGVyIiwiYXJncyIsImNsaWVudElkIiwiY29udmVyc2F0aW9uIiwiX2dldENsaWVudCIsImdldE9iamVjdCIsImlkIiwic3RhdGUiLCJfbGFzdE1lc3NhZ2VUaW1lIiwiY29udiIsInNldFN0YXRlIiwiX3BhdXNlTG9vcElkIiwiY2xlYXJJbnRlcnZhbCIsIl9zZW5kIiwiRGF0ZSIsIm5vdyIsIl9zY2hlZHVsZU5leHRNZXNzYWdlIiwiX3N0YXJ0UGF1c2VMb29wIiwid2luZG93Iiwic2V0SW50ZXJ2YWwiLCJfc2NoZWR1bGVJZCIsImNsZWFyVGltZW91dCIsImRlbGF5IiwiTWF0aCIsIm1pbiIsInNldFRpbWVvdXQiLCJpc1NhdmVkIiwid3MiLCJzb2NrZXRNYW5hZ2VyIiwic2VuZFNpZ25hbCIsInR5cGUiLCJvYmplY3QiLCJkYXRhIiwiYWN0aW9uIiwiZ2V0IiwiaXNEZXN0cm95ZWQiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUErQ0EsSUFBTUEsV0FBVyxJQUFqQjs7ZUFDc0NDLFFBQVEscUJBQVIsQztJQUE5QkMsTyxZQUFBQSxPO0lBQVNDLE0sWUFBQUEsTTtJQUFRQyxRLFlBQUFBLFE7O0FBQ3pCLElBQU1DLGlCQUFpQkosUUFBUSxvQkFBUixDQUF2Qjs7SUFFTUssZTs7QUFHSjs7Ozs7Ozs7Ozs7O0FBWUEsMkJBQVlDLElBQVosRUFBa0I7QUFBQTs7QUFDaEIsU0FBS0MsUUFBTCxHQUFnQkQsS0FBS0MsUUFBckI7QUFDQSxRQUFJRCxLQUFLRSxZQUFULEVBQXVCLEtBQUtBLFlB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OztBQUVEOzs7Ozs7Ozs7OztpQ0FRYTtBQUNYLGFBQU9SLGVBQWVtQyxHQUFmLENBQW1CLEtBQUtoQyxRQUF4QixDQUFQO0FBQ0Q7Ozs4QkFFUztBQUNSLGFBQU8sS0FBS0MsWUFBWjtBQUNBLFdBQUtnQyxXQUFMLEdBQW1CLElBQW5CO0FBQ0FkLG1CQUFhLEtBQUtELFdBQWxCO0FBQ0FSLG9CQUFjLEtBQUtELFlBQW5CO0FBQ0Q7Ozs7OztBQUVIeUIsT0FBT0MsT0FBUCxHQUFpQnJDLGVBQWpCIiwiZmlsZSI6InR5cGluZy1wdWJsaXNoZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBUeXBpbmdQdWJsaXNoZXIncyBqb2IgaXM6XG4gKlxuICogIDEuIFNlbmQgc3RhdGUgY2hhbmdlcyB0byB0aGUgc2VydmVyXG4gKiAgMi4gSW5zdXJlIHRoYXQgdGhlIHNlcnZlciBpcyBub3QgZmxvb2RlZCB3aXRoIHJlcGVhdGVkIHN0YXRlIGNoYW5nZXMgb2YgdGhlIHNhbWUgdmFsdWVcbiAqICAzLiBBdXRvbWF0aWNhbGx5IHRyYW5zaXRpb24gc3RhdGVzIHdoZW4gbm8gbmV3IHN0YXRlcyBvciBvbGQgc3RhdGVzIGFyZSByZXF1ZXN0ZWQuXG4gKlxuICogV2hvIGlzIHRoZSBUeXBpbmcgUHVibGlzaGVyIGZvcj8gIEl0cyB1c2VkIGJ5IHRoZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyOyBpZiB5b3VyIHVzaW5nXG4gKiB0aGUgVHlwaW5nTGlzdGVuZXIsIHlvdSBkb24ndCBuZWVkIHRoaXMuICBJZiB5b3Ugd2FudCB0byBwcm92aWRlIHlvdXIgb3duIGxvZ2ljIGZvciB3aGVuIHRvIHNlbmQgdHlwaW5nXG4gKiBzdGF0ZXMsIHRoZW4geW91IG5lZWQgdGhlIFR5cGluZ1B1Ymxpc2hlci5cbiAqXG4gKiBDcmVhdGUgYW4gaW5zdGFuY2UgdXNpbmc6XG4gKlxuICogICAgICAgIHZhciBwdWJsaXNoZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyKCk7XG4gKlxuICogVG8gdGVsbCB0aGUgUHVibGlzaGVyIHdoaWNoIENvbnZlcnNhdGlvbiBpdHMgcmVwb3J0aW5nIGFjdGl2aXR5IG9uLCB1c2U6XG4gKlxuICogICAgICAgIHB1Ymxpc2hlci5zZXRDb252ZXJzYXRpb24obXlTZWxlY3RlZENvbnZlcnNhdGlvbik7XG4gKlxuICogVG8gdGhlbiB1c2UgdGhlIGluc3RhbmNlOlxuICpcbiAqICAgICAgICBwdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtcbiAqICAgICAgICBwdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5QQVVTRUQpO1xuICogICAgICAgIHB1Ymxpc2hlci5zZXRTdGF0ZShsYXllci5UeXBpbmdJbmRpY2F0b3JzLkZJTklTSEVEKTtcbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGBTVEFSVEVEYCBzdGF0ZSBvbmx5IGxhc3RzIGZvciAyLjUgc2Vjb25kcywgc28geW91XG4gKiBtdXN0IHJlcGVhdGVkbHkgY2FsbCBzZXRTdGF0ZSBmb3IgYXMgbG9uZyBhcyB0aGlzIHN0YXRlIHNob3VsZCBjb250aW51ZS5cbiAqIFRoaXMgaXMgdHlwaWNhbGx5IGRvbmUgYnkgc2ltcGx5IGNhbGxpbmcgYHNldFN0YXRlKFNUQVJURUQpYCBldmVyeSB0aW1lIGEgdXNlciBoaXRzXG4gKiBhIGtleS5cbiAqXG4gKiBBIGZldyBydWxlcyBmb3IgaG93IHRoZSAqcHVibGlzaGVyKiB3b3JrcyBpbnRlcm5hbGx5OlxuICpcbiAqICAtIGl0IG1haW50YWlucyBhbiBpbmRpY2F0b3Igc3RhdGUgZm9yIHRoZSBjdXJyZW50IGNvbnZlcnNhdGlvblxuICogIC0gaWYgYXBwIGNhbGxzICBgc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtgIHB1Ymxpc2hlciBzZW5kcyB0aGUgZXZlbnQgaW1tZWRpYXRlbHlcbiAqICAtIGlmIGFwcCBjYWxscyB0aGUgc2FtZSBtZXRob2QgdW5kZXIgXzIuNSBzZWNvbmRzXyB3aXRoIHRoZSBzYW1lIHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgKGBzdGFydGVkYCksIHB1Ymxpc2hlciB3YWl0c1xuICogICAgZm9yIHRob3NlIDIuNSBzZWNvbmRzIHRvIHBhc3MgYW5kIHRoZW4gcHVibGlzaGVzIHRoZSBlcGhlbWVyYWwgZXZlbnRcbiAqICAtIGlmIGFwcCBjYWxscyB0aGUgc2FtZSBtZXRob2RzIG11bHRpcGxlIHRpbWVzIHdpdGhpbiBfMi41IHNlY29uZHNfIHdpdGggdGhlIHNhbWUgdmFsdWUsXG4gKiAgICBwdWJsaXNoZXIgd2FpdHMgdW50aWwgZW5kIG9mIDIuNSBzZWNvbmQgcGVyaW9kIGFuZCBzZW5kcyB0aGUgc3RhdGUgb25seSBvbmNlLlxuICogIC0gaWYgYXBwIGNhbGxzIHRoZSBzYW1lIG1ldGhvZCB1bmRlciBfMi41IHNlY29uZHNfIHdpdGggYSBkaWZmZXJlbnQgdHlwaW5nIGluZGljYXRvciBzdGF0ZSAoc2F5IGBwYXVzZWRgKSxcbiAqICAgIHB1Ymxpc2hlciBpbW1lZGlhdGVseSBzZW5kcyB0aGUgZXZlbnRcbiAqICAtIGlmIDIuNSBzZWNvbmRzIHBhc3NlcyB3aXRob3V0IGFueSBldmVudHMsIHN0YXRlIHRyYW5zaXRpb25zIGZyb20gJ3N0YXJ0ZWQnIHRvICdwYXVzZWQnXG4gKiAgLSBpZiAyLjUgc2Vjb25kcyBwYXNzZXMgd2l0aG91dCBhbnkgZXZlbnRzLCBzdGF0ZSB0cmFuc2l0aW9ucyBmcm9tICdwYXVzZWQnIHRvICdmaW5pc2hlZCdcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdQdWJsaXNoZXJcbiAqIEBwcm90ZWN0ZWRcbiAqL1xuXG5jb25zdCBJTlRFUlZBTCA9IDI1MDA7XG5jb25zdCB7IFNUQVJURUQsIFBBVVNFRCwgRklOSVNIRUQgfSA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5cbmNsYXNzIFR5cGluZ1B1Ymxpc2hlciB7XG5cblxuICAvKipcbiAgICogQ3JlYXRlIGEgVHlwaW5nIFB1Ymxpc2hlci4gIFNlZSBsYXllci5DbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyLlxuICAgKlxuICAgKiBUaGUgVHlwaW5nUHVibGlzaGVyIG5lZWRzXG4gICAqIHRvIGtub3cgd2hhdCBDb252ZXJzYXRpb24gaXRzIHB1Ymxpc2hpbmcgY2hhbmdlcyBmb3IuLi5cbiAgICogYnV0IGl0IGRvZXMgbm90IHJlcXVpcmUgdGhhdCBwYXJhbWV0ZXIgZHVyaW5nIGluaXRpYWxpemF0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhcmdzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBjbGllbnRJZCAtIFRoZSBJRCBmb3IgdGhlIGNsaWVudCBmcm9tIHdoaWNoIHdlIHdpbGwgZ2V0IGFjY2VzcyB0byB0aGUgd2Vic29ja2V0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udmVyc2F0aW9uPW51bGxdIC0gVGhlIENvbnZlcnNhdGlvbiBPYmplY3Qgb3IgSW5zdGFuY2UgdGhhdCBtZXNzYWdlcyBhcmUgYmVpbmcgdHlwZWQgdG8uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihhcmdzKSB7XG4gICAgdGhpcy5jbGllbnRJZCA9IGFyZ3MuY2xpZW50SWQ7XG4gICAgaWYgKGFyZ3MuY29udmVyc2F0aW9uKSB0aGlzLmNvbnZlcnNhdGlvbiA9IHRoaXMuX2dldENsaWVudCgpLmdldE9iamVjdChhcmdzLmNvbnZlcnNhdGlvbi5pZCk7XG4gICAgdGhpcy5zdGF0ZSA9IEZJTklTSEVEO1xuICAgIHRoaXMuX2xhc3RNZXNzYWdlVGltZSA9IDA7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHdoaWNoIENvbnZlcnNhdGlvbiB3ZSBhcmUgcmVwb3J0aW5nIG9uIHN0YXRlIGNoYW5nZXMgZm9yLlxuICAgKlxuICAgKiBJZiB0aGlzIGluc3RhbmNlIG1hbmFnZWQgYSBwcmV2aW91cyBDb252ZXJzYXRpb24sXG4gICAqIGl0cyBzdGF0ZSBpcyBpbW1lZGlhdGVseSB0cmFuc2l0aW9uZWQgdG8gXCJmaW5pc2hlZFwiLlxuICAgKlxuICAgKiBAbWV0aG9kIHNldENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnYgLSBDb252ZXJzYXRpb24gT2JqZWN0IG9yIEluc3RhbmNlXG4gICAqL1xuICBzZXRDb252ZXJzYXRpb24oY29udikge1xuICAgIHRoaXMuc2V0U3RhdGUoRklOSVNIRUQpO1xuICAgIHRoaXMuY29udmVyc2F0aW9uID0gY29udiA/IHRoaXMuX2dldENsaWVudCgpLmdldE9iamVjdChjb252LmlkKSA6IG51bGw7XG4gICAgdGhpcy5zdGF0ZSA9IEZJTklTSEVEO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHN0YXRlIGFuZCBlaXRoZXIgc2VuZHMgdGhlIHN0YXRlIHRvIHRoZSBzZXJ2ZXIgb3Igc2NoZWR1bGVzIGl0IHRvIGJlIHNlbnQuXG4gICAqXG4gICAqIEBtZXRob2Qgc2V0U3RhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBzdGF0ZSAtIE9uZSBvZlxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRFxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuUEFVU0VEXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5GSU5JU0hFRFxuICAgKi9cbiAgc2V0U3RhdGUoc3RhdGUpIHtcbiAgICAvLyBXZSBoYXZlIGEgZnJlc2ggc3RhdGU7IHdoYXRldmVyIG91ciBwYXVzZUxvb3Agd2FzIGRvaW5nXG4gICAgLy8gY2FuIGJlIGNhbmNlbGVkLi4uIGFuZCByZXN0YXJ0ZWQgbGF0ZXIuXG4gICAgaWYgKHRoaXMuX3BhdXNlTG9vcElkKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuX3BhdXNlTG9vcElkKTtcbiAgICAgIHRoaXMuX3BhdXNlTG9vcElkID0gMDtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbnZlcnNhdGlvbikgcmV0dXJuO1xuXG4gICAgLy8gSWYgaXRzIGEgbmV3IHN0YXRlLCBzZW5kIGl0IGltbWVkaWF0ZWx5LlxuICAgIGlmICh0aGlzLnN0YXRlICE9PSBzdGF0ZSkge1xuICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICAgICAgdGhpcy5fc2VuZChzdGF0ZSk7XG4gICAgfVxuXG4gICAgLy8gTm8gbmVlZCB0byByZXNlbmQgJ2ZpbmlzaGVkJyBzdGF0ZVxuICAgIGVsc2UgaWYgKHN0YXRlID09PSBGSU5JU0hFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElmIGl0cyBhbiBleGlzdGluZyBzdGF0ZSB0aGF0IGhhc24ndCBiZWVuIHNlbnQgaW4gdGhlXG4gICAgLy8gbGFzdCAyLjUgc2Vjb25kcywgc2VuZCBpdCBpbW1lZGlhdGVseS5cbiAgICBlbHNlIGlmIChEYXRlLm5vdygpID4gdGhpcy5fbGFzdE1lc3NhZ2VUaW1lICsgSU5URVJWQUwpIHtcbiAgICAgIHRoaXMuX3NlbmQoc3RhdGUpO1xuICAgIH1cblxuICAgIC8vIEVsc2Ugc2NoZWR1bGUgaXQgdG8gYmUgc2VudC5cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuX3NjaGVkdWxlTmV4dE1lc3NhZ2Uoc3RhdGUpO1xuICAgIH1cblxuICAgIC8vIFN0YXJ0IHRlc3QgdG8gYXV0b21hdGljYWxseSB0cmFuc2l0aW9uIGlmIDIuNSBzZWNvbmRzIHdpdGhvdXQgYW55IHNldFN0YXRlIGNhbGxzXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IEZJTklTSEVEKSB0aGlzLl9zdGFydFBhdXNlTG9vcCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGxvb3AgdG8gYXV0b21hdGljYWxseSBjaGFuZ2UgdG8gbmV4dCBzdGF0ZS5cbiAgICpcbiAgICogQW55IHRpbWUgd2UgYXJlIHNldCB0byAnc3RhcnRlZCcgb3IgJ3BhdXNlZCcgd2Ugc2hvdWxkIHRyYW5zaXRpb25cbiAgICogdG8gdGhlIG5leHQgc3RhdGUgYWZ0ZXIgMi41IHNlY29uZHMgb2Ygbm8gc2V0U3RhdGUgY2FsbHMuXG4gICAqXG4gICAqIFRoZSAyLjUgc2Vjb25kIHNldFRpbWVvdXQgaXMgY2FuY2VsZWQvcmVzdGFydGVkIGV2ZXJ5IGNhbGwgdG8gc2V0U3RhdGUoKVxuICAgKlxuICAgKiBAbWV0aG9kIF9zdGFydFBhdXNlTG9vcFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3N0YXJ0UGF1c2VMb29wKCkge1xuICAgIGlmICh0aGlzLl9wYXVzZUxvb3BJZCkgcmV0dXJuO1xuXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgaW50ZXJ2YWwgaXMgY2FuY2VsZWQgZXZlcnkgY2FsbCB0byBzZXRTdGF0ZS5cbiAgICB0aGlzLl9wYXVzZUxvb3BJZCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gUEFVU0VEKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoRklOSVNIRUQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBTVEFSVEVEKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoUEFVU0VEKTtcbiAgICAgIH1cbiAgICB9LCBJTlRFUlZBTCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSB0aGUgbmV4dCBzdGF0ZSByZWZyZXNoIG1lc3NhZ2UuXG4gICAqXG4gICAqIEl0IHNob3VsZCBiZSBhdCBsZWFzdCBJTlRFUlZBTCBtcyBhZnRlclxuICAgKiB0aGUgbGFzdCBzdGF0ZSBtZXNzYWdlIG9mIHRoZSBzYW1lIHN0YXRlXG4gICAqXG4gICAqIEBtZXRob2QgX3NjaGVkdWxlTmV4dE1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBzdGF0ZSAtIE9uZSBvZlxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRFxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuUEFVU0VEXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5GSU5JU0hFRFxuICAgKi9cbiAgX3NjaGVkdWxlTmV4dE1lc3NhZ2Uoc3RhdGUpIHtcbiAgICBpZiAodGhpcy5fc2NoZWR1bGVJZCkgY2xlYXJUaW1lb3V0KHRoaXMuX3NjaGVkdWxlSWQpO1xuICAgIGNvbnN0IGRlbGF5ID0gSU5URVJWQUwgLSBNYXRoLm1pbihEYXRlLm5vdygpIC0gdGhpcy5fbGFzdE1lc3NhZ2VUaW1lLCBJTlRFUlZBTCk7XG4gICAgdGhpcy5fc2NoZWR1bGVJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5fc2NoZWR1bGVJZCA9IDA7XG4gICAgICAvLyBJZiB0aGUgc3RhdGUgZGlkbid0IGNoYW5nZSB3aGlsZSB3YWl0aW5nLi4uXG4gICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gc3RhdGUpIHRoaXMuX3NlbmQoc3RhdGUpO1xuICAgIH0sIGRlbGF5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgc3RhdGUgY2hhbmdlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHN0YXRlIC0gT25lIG9mXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5QQVVTRURcbiAgICogKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLkZJTklTSEVEXG4gICAqL1xuICBfc2VuZChzdGF0ZSkge1xuICAgIGlmICghdGhpcy5jb252ZXJzYXRpb24uaXNTYXZlZCgpKSByZXR1cm47XG4gICAgdGhpcy5fbGFzdE1lc3NhZ2VUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCB3cyA9IHRoaXMuX2dldENsaWVudCgpLnNvY2tldE1hbmFnZXI7XG4gICAgd3Muc2VuZFNpZ25hbCh7XG4gICAgICB0eXBlOiAndHlwaW5nX2luZGljYXRvcicsXG4gICAgICBvYmplY3Q6IHtcbiAgICAgICAgaWQ6IHRoaXMuY29udmVyc2F0aW9uLmlkLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgYWN0aW9uOiBzdGF0ZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBDbGllbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbGF5ZXIuTWVzc2FnZS5cbiAgICpcbiAgICogVXNlcyB0aGUgY2xpZW50SWQgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLkNsaWVudH1cbiAgICovXG4gIF9nZXRDbGllbnQoKSB7XG4gICAgcmV0dXJuIENsaWVudFJlZ2lzdHJ5LmdldCh0aGlzLmNsaWVudElkKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgZGVsZXRlIHRoaXMuY29udmVyc2F0aW9uO1xuICAgIHRoaXMuaXNEZXN0cm95ZWQgPSB0cnVlO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLl9zY2hlZHVsZUlkKTtcbiAgICBjbGVhckludGVydmFsKHRoaXMuX3BhdXNlTG9vcElkKTtcbiAgfVxufVxubW9kdWxlLmV4cG9ydHMgPSBUeXBpbmdQdWJsaXNoZXI7XG5cbiJdfQ==
