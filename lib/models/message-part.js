'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The MessagePart class represents an element of a message.
 *
 *      // Create a Message Part with any mimeType
 *      var part = new layer.MessagePart({
 *          body: "hello",
 *          mimeType: "text/plain"
 *      });
 *
 *      // Create a text/plain only Message Part
 *      var part = new layer.MessagePart("Hello I am text/plain");
 *
 * You can also create a Message Part from a File Input dom node:
 *
 *      var fileInputNode = document.getElementById("myFileInput");
 *      var part = new layer.MessagePart(fileInputNode.files[0]);
 *
 * You can also create Message Parts from a file drag and drop operation:
 *
 *      onFileDrop: function(evt) {
 *           var files = evt.dataTransfer.files;
 *           var m = conversation.createMessage({
 *               parts: files.map(function(file) {
 *                  return new layer.MessagePart({body: file, mimeType: file.type});
 *               }
 *           });
 *      });
 *
 * ### Blobs vs Strings
 *
 * You should always expect to see the `body` property be a Blob **unless** the mimeType is listed in layer.MessagePart.TextualMimeTypes,
 * in which case the value will be a String.  You can add mimeTypes to TextualMimeTypes:
 *
 * ```
 * layer.MessagePart.TextualMimeTypes = ['text/plain', 'text/mountain', /^application\/json(\+.+)$/]
 * ```
 *
 * Any mimeType matching the above strings and regular expressions will be transformed to text before being delivered to your app; otherwise it
 * must be a Blob.  Note that the above snippet sets a static property that is set once, and affects all MessagePart objects for the lifespan of
 * the app.
 *
 * ### Accesing Rich Content
 *
 * There are two ways of accessing rich content
 *
 * 1. Access the data directly: `part.fetchContent(function(data) {myRenderData(data);})`. This approach downloads the data,
 *    writes it to the the `body` property, writes a Data URI to the part's `url` property, and then calls your callback.
 *    By downloading the data and storing it in `body`, the data does not expire.
 * 2. Access the URL rather than the data.  When you first receive the Message Part it will have a valid `url` property; however, this URL expires.  *    URLs are needed for streaming, and for content that doesn't yet need to be rendered (e.g. hyperlinks to data that will render when clicked).
 *    The url property will return a string if the url is valid, or '' if its expired.  Call `part.fetchStream(callback)` to get an updated URL.
 *    The following pattern is recommended:
 *
 * ```
 * if (!part.url) {
 *   part.fetchStream(function(url) {myRenderUrl(url)});
 * } else {
 *   myRenderUrl(part.url);
 * }
 * ```
 *
 * NOTE: `layer.MessagePart.url` should have a value when the message is first received, and will only fail `if (!part.url)` once the url has expired.
 *
 * @class  layer.MessagePart
 * @extends layer.Root
 * @author Michael Kantor
 */

var Root = require('../root');
var Content = require('./content');
var xhr = require('../xhr');
var ClientRegistry = require('../client-registry');
var LayerError = require('../layer-error');
var Util = require('../client-utils');
var logger = require('../logger');

var MessagePart = function (_Root) {
  _inherits(MessagePart, _Root);

  /**
   * Constructor
   *
   * @method constructor
   * @param  {Object} options - Can be an object with body and mimeType, or it can be a string, or a Blob/File
   * @param  {string} options.body - Any string larger than 2kb will be sent as Rich Content, meaning it will be uploaded to cloud storage and must be separately downloaded from the Message when its received.
   * @param  {string} [options.mimeType=text/plain] - Mime type; can be anything; if your client doesn't have a renderer for it, it will be ignored.
   * @param  {number} [options.size=0] - Size of your part. Will be calculated for you if not provided.
   *
   * @return {layer.MessagePart}
   */
  function MessagePart(options) {
    _classCallCheck(this, MessagePart);

    var newOptions = options;
    if (typeof options === 'string') {
      newOptions = { body: options };
      if ((arguments.length <= 1 ? 0 : arguments.length - 1) > 0) {
        newOptions.mimeType = arguments.length <= 1 ? undefined : arguments[1];
      } else {
        newOptions.mimeType = 'text/plain';
      }
    } else if (Util.isBlob(options) || Util.isBlob(options.body)) {
      var body = options instanceof Blob ? options : options.body;
      var mimeType = Util.isBlob(options.body) ? options.mimeType : body.type;
      newOptions = {
        mimeType: mimeType,
        body: body,
        size: body.size,
        hasContent: true
      };
    }

    var _this = _possibleConstructorReturn(this, (MessagePart.__proto__ || Object.getPrototypeOf(MessagePart)).call(this, newOptions));

    if (!_this.size && _this.body) _this.size = _this.body.length;

    // Don't expose encoding; blobify it if its encoded.
    if (options.encoding === 'base64') {
      _this.body = Util.base64ToBlob(_this.body);
    }

    // Could be a blob because it was read out of indexedDB,
    // or because it was created locally with a file
    // Or because of base64 encoded data.
    var isBlobBody = Util.isBlob(_this.body);
    var textual = _this.isTextualMimeType();

    // Custom handling for non-textual content
    if (!textual) {
      // If the body exists and is a blob, extract the data uri for convenience; only really relevant for image and video HTML tags.
      if (!isBlobBody && _this.body) _this.body = new Blob([_this.body], { type: _this.mimeType });
      if (_this.body) _this.url = URL.createObjectURL(_this.body);
    }

    // If our textual content is a blob, turning it into text is asychronous, and can't be done in the synchronous constructor
    // This will only happen when the client is attaching a file.  Conversion for locally created messages is done while calling `Message.send()`
    return _this;
  }

  _createClass(MessagePart, [{
    key: 'destroy',
    value: function destroy() {
      if (this.__url) {
        URL.revokeObjectURL(this.__url);
        this.__url = null;
      }
      this.body = null;
      _get(MessagePart.prototype.__proto__ || Object.getPrototypeOf(MessagePart.prototype), 'destroy', this).call(this);
    }

    /**
     * Get the layer.Client associated with this layer.MessagePart.
     *
     * Uses the layer.MessagePart.clientId property.
     *
     * @method _getClient
     * @private
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }

    /**
     * Get the layer.Message associated with this layer.MessagePart.
     *
     * @method _getMessage
     * @private
     * @return {layer.Message}
     */

  }, {
    key: '_getMessage',
    value: function _getMessage() {
      return this._getClient().getMessage(this.id.replace(/\/parts.*$/, ''));
    }

    /**
     * Download Rich Content from cloud server.
     *
     * For MessageParts with rich content, this method will load the data from google's cloud storage.
     * The body property of this MessagePart is set to the result.
     *
     *      messagepart.fetchContent()
     *      .on("content-loaded", function() {
     *          render(messagepart.body);
     *      });
     *
     * Note that a successful call to `fetchContent` will also cause Query change events to fire.
     * In this example, `render` will be called by the query change event that will occur once the content has downloaded:
     *
     * ```
     *  query.on('change', function(evt) {
     *    render(query.data);
     *  });
     *  messagepart.fetchContent();
     * ```
     *
     *
     * @method fetchContent
     * @param {Function} [callback]
     * @param {Mixed} callback.data - Either a string (mimeType=text/plain) or a Blob (all other mimeTypes)
     * @return {layer.Content} this
     */

  }, {
    key: 'fetchContent',
    value: function fetchContent(callback) {
      var _this2 = this;

      if (this._content && !this.isFiring) {
        this.isFiring = true;
        var type = this.mimeType === 'image/jpeg+preview' ? 'image/jpeg' : this.mimeType;
        this._content.loadContent(type, function (err, result) {
          return _this2._fetchContentCallback(err, result, callback);
        });
      }
      return this;
    }

    /**
     * Callback with result or error from calling fetchContent.
     *
     * @private
     * @method _fetchContentCallback
     * @param {layer.LayerError} err
     * @param {Object} result
     * @param {Function} callback
     */

  }, {
    key: '_fetchContentCallback',
    value: function _fetchContentCallback(err, result, callback) {
      var _this3 = this;

      if (err) {
        this.trigger('content-loaded-error', err);
      } else {
        this.isFiring = false;
        if (this.isTextualMimeType()) {
          Util.fetchTextFromFile(result, function (text) {
            return _this3._fetchContentComplete(text, callback);
          });
        } else {
          this.url = URL.createObjectURL(result);
          this._fetchContentComplete(result, callback);
        }
      }
    }

    /**
     * Callback with Part Body from _fetchContentCallback.
     *
     * @private
     * @method _fetchContentComplete
     * @param {Blob|String} body
     * @param {Function} callback
     */

  }, {
    key: '_fetchContentComplete',
    value: function _fetchContentComplete(body, callback) {
      var message = this._getMessage();

      this.body = body;

      this.trigger('content-loaded');
      message._triggerAsync('messages:change', {
        oldValue: message.parts,
        newValue: message.parts,
        property: 'parts'
      });
      if (callback) callback(this.body);
    }

    /**
     * Access the URL to the remote resource.
     *
     * Useful for streaming the content so that you don't have to download the entire file before rendering it.
     * Also useful for content that will be openned in a new window, and does not need to be fetched now.
     *
     * For MessageParts with Rich Content, will lookup a URL to your Rich Content.
     * Useful for streaming and content so that you don't have to download the entire file before rendering it.
     *
     * ```
     * messagepart.fetchStream(function(url) {
     *     render(url);
     * });
     * ```
     *
     * Note that a successful call to `fetchStream` will also cause Query change events to fire.
     * In this example, `render` will be called by the query change event that will occur once the `url` has been refreshed:
     *
     * ```
     *  query.on('change', function(evt) {
     *      render(query.data);
     *  });
     *  messagepart.fetchStream();
     * ```
     *
     * @method fetchStream
     * @param {Function} [callback]
     * @param {Mixed} callback.url
     * @return {layer.Content} this
     */

  }, {
    key: 'fetchStream',
    value: function fetchStream(callback) {
      var _this4 = this;

      if (!this._content) throw new Error(LayerError.dictionary.contentRequired);
      if (this._content.isExpired()) {
        this._content.refreshContent(this._getClient(), function (url) {
          return _this4._fetchStreamComplete(url, callback);
        });
      } else {
        this._fetchStreamComplete(this._content.downloadUrl, callback);
      }
      return this;
    }

    // Does not set this.url; instead relies on fact that this._content.downloadUrl has been updated

  }, {
    key: '_fetchStreamComplete',
    value: function _fetchStreamComplete(url, callback) {
      var message = this._getMessage();

      this.trigger('url-loaded');
      message._triggerAsync('messages:change', {
        oldValue: message.parts,
        newValue: message.parts,
        property: 'parts'
      });
      if (callback) callback(url);
    }

    /**
     * Preps a MessagePart for sending.  Normally that is trivial.
     * But if there is rich content, then the content must be uploaded
     * and then we can trigger a "parts:send" event indicating that
     * the part is ready to send.
     *
     * @method _send
     * @protected
     * @param  {layer.Client} client
     * @fires parts:send
     */

  }, {
    key: '_send',
    value: function _send(client) {
      // There is already a Content object, presumably the developer
      // already took care of this step for us.
      if (this._content) {
        this._sendWithContent();
      }

      // If the size is large, Create and upload the Content
      else if (this.size > 2048) {
          this._generateContentAndSend(client);
        }

        // If the body is a blob, but is not YET Rich Content, do some custom analysis/processing:
        else if (Util.isBlob(this.body)) {
            this._sendBlob(client);
          }

          // Else the message part can be sent as is.
          else {
              this._sendBody();
            }
    }
  }, {
    key: '_sendBody',
    value: function _sendBody() {
      if (typeof this.body !== 'string') {
        var err = 'MessagePart.body must be a string in order to send it';
        logger.error(err, { mimeType: this.mimeType, body: this.body });
        throw new Error(err);
      }

      var obj = {
        mime_type: this.mimeType,
        body: this.body
      };
      this.trigger('parts:send', obj);
    }
  }, {
    key: '_sendWithContent',
    value: function _sendWithContent() {
      this.trigger('parts:send', {
        mime_type: this.mimeType,
        content: {
          size: this.size,
          id: this._content.id
        }
      });
    }

    /**
     * This method is only called if Blob.size < 2048.
     *
     * However, conversion to base64 can impact the size, so we must retest the size
     * after conversion, and then decide to send the original blob or the base64 encoded data.
     *
     * @method _sendBlob
     * @private
     * @param {layer.Client} client
     */

  }, {
    key: '_sendBlob',
    value: function _sendBlob(client) {
      var _this5 = this;

      /* istanbul ignore else */
      Util.blobToBase64(this.body, function (base64data) {
        if (base64data.length < 2048) {
          var body = base64data.substring(base64data.indexOf(',') + 1);
          var obj = {
            body: body,
            mime_type: _this5.mimeType
          };
          obj.encoding = 'base64';
          _this5.trigger('parts:send', obj);
        } else {
          _this5._generateContentAndSend(client);
        }
      });
    }

    /**
     * Create an rich Content object on the server
     * and then call _processContentResponse
     *
     * @method _generateContentAndSend
     * @private
     * @param  {layer.Client} client
     */

  }, {
    key: '_generateContentAndSend',
    value: function _generateContentAndSend(client) {
      var _this6 = this;

      this.hasContent = true;
      var body = void 0;
      if (!Util.isBlob(this.body)) {
        body = Util.base64ToBlob(Util.utoa(this.body), this.mimeType);
      } else {
        body = this.body;
      }
      client.xhr({
        url: '/content',
        method: 'POST',
        headers: {
          'Upload-Content-Type': this.mimeType,
          'Upload-Content-Length': body.size,
          'Upload-Origin': typeof location !== 'undefined' ? location.origin : ''
        },
        sync: {}
      }, function (result) {
        return _this6._processContentResponse(result.data, body, client);
      });
    }

    /**
     * Creates a layer.Content object from the server's
     * Content object, and then uploads the data to google cloud storage.
     *
     * @method _processContentResponse
     * @private
     * @param  {Object} response
     * @param  {Blob} body
     * @param  {layer.Client} client
     */

  }, {
    key: '_processContentResponse',
    value: function _processContentResponse(response, body, client) {
      var _this7 = this;

      this._content = new Content(response.id);
      this.hasContent = true;

      xhr({
        url: response.upload_url,
        method: 'PUT',
        data: body,
        headers: {
          'Upload-Content-Length': this.size,
          'Upload-Content-Type': this.mimeType
        }
      }, function (result) {
        return _this7._processContentUploadResponse(result, response, client);
      });
    }
  }, {
    key: '_processContentUploadResponse',
    value: function _processContentUploadResponse(uploadResult, contentResponse, client) {
      if (!uploadResult.success) {
        if (!client.onlineManager.isOnline) {
          client.onlineManager.once('connected', this._processContentResponse.bind(this, contentResponse, client), this);
        } else {
          logger.error('We don\'t yet handle this!');
        }
      } else {
        this.trigger('parts:send', {
          mime_type: this.mimeType,
          content: {
            size: this.size,
            id: this._content.id
          }
        });
      }
    }

    /**
     * Returns the text for any text/plain part.
     *
     * Returns '' if its not a text/plain part.
     *
     * @method getText
     * @return {string}
     */

  }, {
    key: 'getText',
    value: function getText() {
      if (this.isTextualMimeType()) {
        return this.body;
      } else {
        return '';
      }
    }

    /**
     * Updates the MessagePart with new data from the server.
     *
     * Currently, MessagePart properties do not update... however,
     * the layer.Content object that Rich Content MessageParts contain
     * do get updated with refreshed expiring urls.
     *
     * @method _populateFromServer
     * @param  {Object} part - Server representation of a part
     * @private
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(part) {
      if (part.content && this._content) {
        this._content.downloadUrl = part.content.download_url;
        this._content.expiration = new Date(part.content.expiration);
      }
    }

    /**
     * Is the mimeType for this MessagePart defined as textual content?
     *
     * If the answer is true, expect a `body` of string, else expect `body` of Blob.
     *
     * To change whether a given MIME Type is treated as textual, see layer.MessagePart.TextualMimeTypes.
     *
     * @method isTextualMimeType
     * @returns {Boolean}
     */

  }, {
    key: 'isTextualMimeType',
    value: function isTextualMimeType() {
      var i = 0;
      for (i = 0; i < MessagePart.TextualMimeTypes.length; i++) {
        var test = MessagePart.TextualMimeTypes[i];
        if (typeof test === 'string') {
          if (test === this.mimeType) return true;
        } else if (test instanceof RegExp) {
          if (this.mimeType.match(test)) return true;
        }
      }
      return false;
    }

    /**
     * Creates a MessagePart from a server representation of the part
     *
     * @method _createFromServer
     * @private
     * @static
     * @param  {Object} part - Server representation of a part
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(part) {
      var content = part.content ? Content._createFromServer(part.content) : null;

      // Turn base64 data into a Blob
      if (part.encoding === 'base64') part.body = Util.base64ToBlob(part.body, part.mimeType);

      // Create the MessagePart
      return new MessagePart({
        id: part.id,
        mimeType: part.mime_type,
        body: part.body || '',
        _content: content,
        hasContent: Boolean(content),
        size: part.size || 0
      });
    }
  }]);

  return MessagePart;
}(Root);

/**
 * layer.Client that the conversation belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 */


MessagePart.prototype.clientId = '';

/**
 * Server generated identifier for the part
 * @type {string}
 */
MessagePart.prototype.id = '';

/**
 * Body of your message part.
 *
 * This is the core data of your part.
 *
 * If this is `null` then most likely layer.Message.hasContent is true, and you
 * can either use the layer.MessagePart.url property or the layer.MessagePart.fetchContent method.
 *
 * @type {string}
 */
MessagePart.prototype.body = null;

/**
 * Rich content object.
 *
 * This will be automatically created for you if your layer.MessagePart.body
 * is large.
 * @type {layer.Content}
 * @private
 */
MessagePart.prototype._content = null;

/**
 * The Part has rich content
 * @type {Boolean}
 */
MessagePart.prototype.hasContent = false;

/**
 * URL to rich content object.
 *
 * Parts with rich content will be initialized with this property set.  But its value will expire.
 *
 * Will contain an expiring url at initialization time and be refreshed with calls to `layer.MessagePart.fetchStream()`.
 * Will contain a non-expiring url to a local resource if `layer.MessagePart.fetchContent()` is called.
 *
 * @type {layer.Content}
 */
Object.defineProperty(MessagePart.prototype, 'url', {
  enumerable: true,
  get: function get() {
    // Its possible to have a url and no content if it has been instantiated but not yet sent.
    // If there is a __url then its a local url generated from the body property and does not expire.
    if (this.__url) return this.__url;
    if (this._content) return this._content.isExpired() ? '' : this._content.downloadUrl;
    return '';
  },
  set: function set(inValue) {
    this.__url = inValue;
  }
});

/**
 * Mime Type for the data represented by the MessagePart.
 *
 * Typically this is the type for the data in layer.MessagePart.body;
 * if there is Rich Content, then its the type of Content that needs to be
 * downloaded.
 *
 * @type {String}
 */
MessagePart.prototype.mimeType = 'text/plain';

/**
 * Size of the layer.MessagePart.body.
 *
 * Will be set for you if not provided.
 * Only needed for use with rich content.
 *
 * @type {number}
 */
MessagePart.prototype.size = 0;

/**
 * Array of mime types that should be treated as text.
 *
 * Treating a MessagePart as text means that even if the `body` gets a File or Blob,
 * it will be transformed to a string before being delivered to your app.
 *
 * This value can be customized using strings and regular expressions:
 *
 * ```
 * layer.MessagePart.TextualMimeTypes = ['text/plain', 'text/mountain', /^application\/json(\+.+)$/]
 * ```
 *
 * @static
 * @type {Mixed[]}
 */
MessagePart.TextualMimeTypes = [/^text\/.+$/, /^application\/json(\+.+)?$/];

MessagePart._supportedEvents = ['parts:send', 'content-loaded', 'url-loaded', 'content-loaded-error'].concat(Root._supportedEvents);
Root.initClass.apply(MessagePart, [MessagePart, 'MessagePart']);

module.exports = MessagePart;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVzc2FnZS1wYXJ0LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiQ29udGVudCIsInhociIsIkNsaWVudFJlZ2lzdHJ5IiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJsb2dnZXIiLCJNZXNzYWdlUGFydCIsIm9wdGlvbnMiLCJuZXdPcHRpb25zIiwiYm9keSIsIm1pbWVUeXBlIiwiaXNCbG9iIiwiQmxvYiIsInR5cGUiLCJzaXplIiwiaGFzQ29udGVudCIsImxlbmd0aCIsImVuY29kaW5nIiwiYmFzZTY0VG9CbG9iIiwiaXNCbG9iQm9keSIsInRleHR1YWwiLCJpc1RleHR1YWxNaW1lVHlwZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIl9fdXJsIiwicmV2b2tlT2JqZWN0VVJMIiwiZ2V0IiwiY2xpZW50SWQiLCJfZ2V0Q2xpZW50IiwiZ2V0TWVzc2FnZSIsImlkIiwicmVwbGFjZSIsImNhbGxiYWNrIiwiX2NvbnRlbnQiLCJpc0ZpcmluZyIsImxvYWRDb250ZW50IiwiZXJyIiwicmVzdWx0IiwiX2ZldGNoQ29udGVudENhbGxiYWNrIiwidHJpZ2dlciIsImZldGNoVGV4dEZyb21GaWxlIiwiX2ZldGNoQ29udGVudENvbXBsZXRlIiwidGV4dCIsIm1lc3NhZ2UiLCJfZ2V0TWVzc2FnZSIsIl90cmlnZ2VyQXN5bmMiLCJvbGRWYWx1ZSIsInBhcnRzIiwibmV3VmFsdWUiLCJwcm9wZXJ0eSIsIkVycm9yIiwiZGljdGlvbmFyeSIsImNvbnRlbnRSZXF1aXJlZCIsImlzRXhwaXJlZCIsInJlZnJlc2hDb250ZW50IiwiX2ZldGNoU3RyZWFtQ29tcGxldGUiLCJkb3dubG9hZFVybCIsImNsaWVudCIsIl9zZW5kV2l0aENvbnRlbnQiLCJfZ2VuZXJhdGVDb250ZW50QW5kU2VuZCIsIl9zZW5kQmxvYiIsIl9zZW5kQm9keSIsImVycm9yIiwib2JqIiwibWltZV90eXBlIiwiY29udGVudCIsImJsb2JUb0Jhc2U2NCIsImJhc2U2NGRhdGEiLCJzdWJzdHJpbmciLCJpbmRleE9mIiwidXRvYSIsIm1ldGhvZCIsImhlYWRlcnMiLCJsb2NhdGlvbiIsIm9yaWdpbiIsInN5bmMiLCJfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZSIsImRhdGEiLCJyZXNwb25zZSIsInVwbG9hZF91cmwiLCJfcHJvY2Vzc0NvbnRlbnRVcGxvYWRSZXNwb25zZSIsInVwbG9hZFJlc3VsdCIsImNvbnRlbnRSZXNwb25zZSIsInN1Y2Nlc3MiLCJvbmxpbmVNYW5hZ2VyIiwiaXNPbmxpbmUiLCJvbmNlIiwiYmluZCIsInBhcnQiLCJkb3dubG9hZF91cmwiLCJleHBpcmF0aW9uIiwiRGF0ZSIsImkiLCJUZXh0dWFsTWltZVR5cGVzIiwidGVzdCIsIlJlZ0V4cCIsIm1hdGNoIiwiX2NyZWF0ZUZyb21TZXJ2ZXIiLCJCb29sZWFuIiwicHJvdG90eXBlIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwic2V0IiwiaW5WYWx1ZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJjb25jYXQiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUVBLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsVUFBVUQsUUFBUSxXQUFSLENBQWhCO0FBQ0EsSUFBTUUsTUFBTUYsUUFBUSxRQUFSLENBQVo7QUFDQSxJQUFNRyxpQkFBaUJILFFBQVEsb0JBQVIsQ0FBdkI7QUFDQSxJQUFNSSxhQUFhSixRQUFRLGdCQUFSLENBQW5CO0FBQ0EsSUFBTUssT0FBT0wsUUFBUSxpQkFBUixDQUFiO0FBQ0EsSUFBTU0sU0FBU04sUUFBUSxXQUFSLENBQWY7O0lBRU1PLFc7OztBQUVKOzs7Ozs7Ozs7OztBQVdBLHVCQUFZQyxPQUFaLEVBQThCO0FBQUE7O0FB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dEI3RyxLQUFLNEcsZ0JBTGlCLENBQS9CO0FBTUE1RyxLQUFLOEcsU0FBTCxDQUFlQyxLQUFmLENBQXFCdkcsV0FBckIsRUFBa0MsQ0FBQ0EsV0FBRCxFQUFjLGFBQWQsQ0FBbEM7O0FBRUF3RyxPQUFPQyxPQUFQLEdBQWlCekcsV0FBakIiLCJmaWxlIjoibWVzc2FnZS1wYXJ0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgTWVzc2FnZVBhcnQgY2xhc3MgcmVwcmVzZW50cyBhbiBlbGVtZW50IG9mIGEgbWVzc2FnZS5cbiAqXG4gKiAgICAgIC8vIENyZWF0ZSBhIE1lc3NhZ2UgUGFydCB3aXRoIGFueSBtaW1lVHlwZVxuICogICAgICB2YXIgcGFydCA9IG5ldyBsYXllci5NZXNzYWdlUGFydCh7XG4gKiAgICAgICAgICBib2R5OiBcImhlbGxvXCIsXG4gKiAgICAgICAgICBtaW1lVHlwZTogXCJ0ZXh0L3BsYWluXCJcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBDcmVhdGUgYSB0ZXh0L3BsYWluIG9ubHkgTWVzc2FnZSBQYXJ0XG4gKiAgICAgIHZhciBwYXJ0ID0gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KFwiSGVsbG8gSSBhbSB0ZXh0L3BsYWluXCIpO1xuICpcbiAqIFlvdSBjYW4gYWxzbyBjcmVhdGUgYSBNZXNzYWdlIFBhcnQgZnJvbSBhIEZpbGUgSW5wdXQgZG9tIG5vZGU6XG4gKlxuICogICAgICB2YXIgZmlsZUlucHV0Tm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibXlGaWxlSW5wdXRcIik7XG4gKiAgICAgIHZhciBwYXJ0ID0gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KGZpbGVJbnB1dE5vZGUuZmlsZXNbMF0pO1xuICpcbiAqIFlvdSBjYW4gYWxzbyBjcmVhdGUgTWVzc2FnZSBQYXJ0cyBmcm9tIGEgZmlsZSBkcmFnIGFuZCBkcm9wIG9wZXJhdGlvbjpcbiAqXG4gKiAgICAgIG9uRmlsZURyb3A6IGZ1bmN0aW9uKGV2dCkge1xuICogICAgICAgICAgIHZhciBmaWxlcyA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXM7XG4gKiAgICAgICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICAgICAgIHBhcnRzOiBmaWxlcy5tYXAoZnVuY3Rpb24oZmlsZSkge1xuICogICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtib2R5OiBmaWxlLCBtaW1lVHlwZTogZmlsZS50eXBlfSk7XG4gKiAgICAgICAgICAgICAgIH1cbiAqICAgICAgICAgICB9KTtcbiAqICAgICAgfSk7XG4gKlxuICogIyMjIEJsb2JzIHZzIFN0cmluZ3NcbiAqXG4gKiBZb3Ugc2hvdWxkIGFsd2F5cyBleHBlY3QgdG8gc2VlIHRoZSBgYm9keWAgcHJvcGVydHkgYmUgYSBCbG9iICoqdW5sZXNzKiogdGhlIG1pbWVUeXBlIGlzIGxpc3RlZCBpbiBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLFxuICogaW4gd2hpY2ggY2FzZSB0aGUgdmFsdWUgd2lsbCBiZSBhIFN0cmluZy4gIFlvdSBjYW4gYWRkIG1pbWVUeXBlcyB0byBUZXh0dWFsTWltZVR5cGVzOlxuICpcbiAqIGBgYFxuICogbGF5ZXIuTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlcyA9IFsndGV4dC9wbGFpbicsICd0ZXh0L21vdW50YWluJywgL15hcHBsaWNhdGlvblxcL2pzb24oXFwrLispJC9dXG4gKiBgYGBcbiAqXG4gKiBBbnkgbWltZVR5cGUgbWF0Y2hpbmcgdGhlIGFib3ZlIHN0cmluZ3MgYW5kIHJlZ3VsYXIgZXhwcmVzc2lvbnMgd2lsbCBiZSB0cmFuc2Zvcm1lZCB0byB0ZXh0IGJlZm9yZSBiZWluZyBkZWxpdmVyZWQgdG8geW91ciBhcHA7IG90aGVyd2lzZSBpdFxuICogbXVzdCBiZSBhIEJsb2IuICBOb3RlIHRoYXQgdGhlIGFib3ZlIHNuaXBwZXQgc2V0cyBhIHN0YXRpYyBwcm9wZXJ0eSB0aGF0IGlzIHNldCBvbmNlLCBhbmQgYWZmZWN0cyBhbGwgTWVzc2FnZVBhcnQgb2JqZWN0cyBmb3IgdGhlIGxpZmVzcGFuIG9mXG4gKiB0aGUgYXBwLlxuICpcbiAqICMjIyBBY2Nlc2luZyBSaWNoIENvbnRlbnRcbiAqXG4gKiBUaGVyZSBhcmUgdHdvIHdheXMgb2YgYWNjZXNzaW5nIHJpY2ggY29udGVudFxuICpcbiAqIDEuIEFjY2VzcyB0aGUgZGF0YSBkaXJlY3RseTogYHBhcnQuZmV0Y2hDb250ZW50KGZ1bmN0aW9uKGRhdGEpIHtteVJlbmRlckRhdGEoZGF0YSk7fSlgLiBUaGlzIGFwcHJvYWNoIGRvd25sb2FkcyB0aGUgZGF0YSxcbiAqICAgIHdyaXRlcyBpdCB0byB0aGUgdGhlIGBib2R5YCBwcm9wZXJ0eSwgd3JpdGVzIGEgRGF0YSBVUkkgdG8gdGhlIHBhcnQncyBgdXJsYCBwcm9wZXJ0eSwgYW5kIHRoZW4gY2FsbHMgeW91ciBjYWxsYmFjay5cbiAqICAgIEJ5IGRvd25sb2FkaW5nIHRoZSBkYXRhIGFuZCBzdG9yaW5nIGl0IGluIGBib2R5YCwgdGhlIGRhdGEgZG9lcyBub3QgZXhwaXJlLlxuICogMi4gQWNjZXNzIHRoZSBVUkwgcmF0aGVyIHRoYW4gdGhlIGRhdGEuICBXaGVuIHlvdSBmaXJzdCByZWNlaXZlIHRoZSBNZXNzYWdlIFBhcnQgaXQgd2lsbCBoYXZlIGEgdmFsaWQgYHVybGAgcHJvcGVydHk7IGhvd2V2ZXIsIHRoaXMgVVJMIGV4cGlyZXMuICAqICAgIFVSTHMgYXJlIG5lZWRlZCBmb3Igc3RyZWFtaW5nLCBhbmQgZm9yIGNvbnRlbnQgdGhhdCBkb2Vzbid0IHlldCBuZWVkIHRvIGJlIHJlbmRlcmVkIChlLmcuIGh5cGVybGlua3MgdG8gZGF0YSB0aGF0IHdpbGwgcmVuZGVyIHdoZW4gY2xpY2tlZCkuXG4gKiAgICBUaGUgdXJsIHByb3BlcnR5IHdpbGwgcmV0dXJuIGEgc3RyaW5nIGlmIHRoZSB1cmwgaXMgdmFsaWQsIG9yICcnIGlmIGl0cyBleHBpcmVkLiAgQ2FsbCBgcGFydC5mZXRjaFN0cmVhbShjYWxsYmFjaylgIHRvIGdldCBhbiB1cGRhdGVkIFVSTC5cbiAqICAgIFRoZSBmb2xsb3dpbmcgcGF0dGVybiBpcyByZWNvbW1lbmRlZDpcbiAqXG4gKiBgYGBcbiAqIGlmICghcGFydC51cmwpIHtcbiAqICAgcGFydC5mZXRjaFN0cmVhbShmdW5jdGlvbih1cmwpIHtteVJlbmRlclVybCh1cmwpfSk7XG4gKiB9IGVsc2Uge1xuICogICBteVJlbmRlclVybChwYXJ0LnVybCk7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBOT1RFOiBgbGF5ZXIuTWVzc2FnZVBhcnQudXJsYCBzaG91bGQgaGF2ZSBhIHZhbHVlIHdoZW4gdGhlIG1lc3NhZ2UgaXMgZmlyc3QgcmVjZWl2ZWQsIGFuZCB3aWxsIG9ubHkgZmFpbCBgaWYgKCFwYXJ0LnVybClgIG9uY2UgdGhlIHVybCBoYXMgZXhwaXJlZC5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLk1lc3NhZ2VQYXJ0XG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IENvbnRlbnQgPSByZXF1aXJlKCcuL2NvbnRlbnQnKTtcbmNvbnN0IHhociA9IHJlcXVpcmUoJy4uL3hocicpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4uL2NsaWVudC11dGlscycpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5cbmNsYXNzIE1lc3NhZ2VQYXJ0IGV4dGVuZHMgUm9vdCB7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIC0gQ2FuIGJlIGFuIG9iamVjdCB3aXRoIGJvZHkgYW5kIG1pbWVUeXBlLCBvciBpdCBjYW4gYmUgYSBzdHJpbmcsIG9yIGEgQmxvYi9GaWxlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy5ib2R5IC0gQW55IHN0cmluZyBsYXJnZXIgdGhhbiAya2Igd2lsbCBiZSBzZW50IGFzIFJpY2ggQ29udGVudCwgbWVhbmluZyBpdCB3aWxsIGJlIHVwbG9hZGVkIHRvIGNsb3VkIHN0b3JhZ2UgYW5kIG11c3QgYmUgc2VwYXJhdGVseSBkb3dubG9hZGVkIGZyb20gdGhlIE1lc3NhZ2Ugd2hlbiBpdHMgcmVjZWl2ZWQuXG4gICAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMubWltZVR5cGU9dGV4dC9wbGFpbl0gLSBNaW1lIHR5cGU7IGNhbiBiZSBhbnl0aGluZzsgaWYgeW91ciBjbGllbnQgZG9lc24ndCBoYXZlIGEgcmVuZGVyZXIgZm9yIGl0LCBpdCB3aWxsIGJlIGlnbm9yZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gW29wdGlvbnMuc2l6ZT0wXSAtIFNpemUgb2YgeW91ciBwYXJ0LiBXaWxsIGJlIGNhbGN1bGF0ZWQgZm9yIHlvdSBpZiBub3QgcHJvdmlkZWQuXG4gICAqXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2VQYXJ0fVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucywgLi4uYXJncykge1xuICAgIGxldCBuZXdPcHRpb25zID0gb3B0aW9ucztcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICBuZXdPcHRpb25zID0geyBib2R5OiBvcHRpb25zIH07XG4gICAgICBpZiAoYXJncy5sZW5ndGggPiAwKSB7XG4gICAgICAgIG5ld09wdGlvbnMubWltZVR5cGUgPSBhcmdzWzBdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3T3B0aW9ucy5taW1lVHlwZSA9ICd0ZXh0L3BsYWluJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFV0aWwuaXNCbG9iKG9wdGlvbnMpIHx8IFV0aWwuaXNCbG9iKG9wdGlvbnMuYm9keSkpIHtcbiAgICAgIGNvbnN0IGJvZHkgPSBvcHRpb25zIGluc3RhbmNlb2YgQmxvYiA/IG9wdGlvbnMgOiBvcHRpb25zLmJvZHk7XG4gICAgICBjb25zdCBtaW1lVHlwZSA9IFV0aWwuaXNCbG9iKG9wdGlvbnMuYm9keSkgPyBvcHRpb25zLm1pbWVUeXBlIDogYm9keS50eXBlO1xuICAgICAgbmV3T3B0aW9ucyA9IHtcbiAgICAgICAgbWltZVR5cGUsXG4gICAgICAgIGJvZHksXG4gICAgICAgIHNpemU6IGJvZHkuc2l6ZSxcbiAgICAgICAgaGFzQ29udGVudDogdHJ1ZSxcbiAgICAgIH07XG4gICAgfVxuICAgIHN1cGVyKG5ld09wdGlvbnMpO1xuICAgIGlmICghdGhpcy5zaXplICYmIHRoaXMuYm9keSkgdGhpcy5zaXplID0gdGhpcy5ib2R5Lmxlbmd0aDtcblxuICAgIC8vIERvbid0IGV4cG9zZSBlbmNvZGluZzsgYmxvYmlmeSBpdCBpZiBpdHMgZW5jb2RlZC5cbiAgICBpZiAob3B0aW9ucy5lbmNvZGluZyA9PT0gJ2Jhc2U2NCcpIHtcbiAgICAgIHRoaXMuYm9keSA9IFV0aWwuYmFzZTY0VG9CbG9iKHRoaXMuYm9keSk7XG4gICAgfVxuXG4gICAgLy8gQ291bGQgYmUgYSBibG9iIGJlY2F1c2UgaXQgd2FzIHJlYWQgb3V0IG9mIGluZGV4ZWREQixcbiAgICAvLyBvciBiZWNhdXNlIGl0IHdhcyBjcmVhdGVkIGxvY2FsbHkgd2l0aCBhIGZpbGVcbiAgICAvLyBPciBiZWNhdXNlIG9mIGJhc2U2NCBlbmNvZGVkIGRhdGEuXG4gICAgY29uc3QgaXNCbG9iQm9keSA9IFV0aWwuaXNCbG9iKHRoaXMuYm9keSk7XG4gICAgY29uc3QgdGV4dHVhbCA9IHRoaXMuaXNUZXh0dWFsTWltZVR5cGUoKTtcblxuICAgIC8vIEN1c3RvbSBoYW5kbGluZyBmb3Igbm9uLXRleHR1YWwgY29udGVudFxuICAgIGlmICghdGV4dHVhbCkge1xuICAgICAgLy8gSWYgdGhlIGJvZHkgZXhpc3RzIGFuZCBpcyBhIGJsb2IsIGV4dHJhY3QgdGhlIGRhdGEgdXJpIGZvciBjb252ZW5pZW5jZTsgb25seSByZWFsbHkgcmVsZXZhbnQgZm9yIGltYWdlIGFuZCB2aWRlbyBIVE1MIHRhZ3MuXG4gICAgICBpZiAoIWlzQmxvYkJvZHkgJiYgdGhpcy5ib2R5KSB0aGlzLmJvZHkgPSBuZXcgQmxvYihbdGhpcy5ib2R5XSwgeyB0eXBlOiB0aGlzLm1pbWVUeXBlIH0pO1xuICAgICAgaWYgKHRoaXMuYm9keSkgdGhpcy51cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMuYm9keSk7XG4gICAgfVxuXG4gICAgLy8gSWYgb3VyIHRleHR1YWwgY29udGVudCBpcyBhIGJsb2IsIHR1cm5pbmcgaXQgaW50byB0ZXh0IGlzIGFzeWNocm9ub3VzLCBhbmQgY2FuJ3QgYmUgZG9uZSBpbiB0aGUgc3luY2hyb25vdXMgY29uc3RydWN0b3JcbiAgICAvLyBUaGlzIHdpbGwgb25seSBoYXBwZW4gd2hlbiB0aGUgY2xpZW50IGlzIGF0dGFjaGluZyBhIGZpbGUuICBDb252ZXJzaW9uIGZvciBsb2NhbGx5IGNyZWF0ZWQgbWVzc2FnZXMgaXMgZG9uZSB3aGlsZSBjYWxsaW5nIGBNZXNzYWdlLnNlbmQoKWBcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuX191cmwpIHtcbiAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5fX3VybCk7XG4gICAgICB0aGlzLl9fdXJsID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5ib2R5ID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5DbGllbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbGF5ZXIuTWVzc2FnZVBhcnQuXG4gICAqXG4gICAqIFVzZXMgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LmNsaWVudElkIHByb3BlcnR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDbGllbnRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgX2dldENsaWVudCgpIHtcbiAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbGF5ZXIuTWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlUGFydC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0TWVzc2FnZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgX2dldE1lc3NhZ2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldENsaWVudCgpLmdldE1lc3NhZ2UodGhpcy5pZC5yZXBsYWNlKC9cXC9wYXJ0cy4qJC8sICcnKSk7XG4gIH1cblxuICAvKipcbiAgICogRG93bmxvYWQgUmljaCBDb250ZW50IGZyb20gY2xvdWQgc2VydmVyLlxuICAgKlxuICAgKiBGb3IgTWVzc2FnZVBhcnRzIHdpdGggcmljaCBjb250ZW50LCB0aGlzIG1ldGhvZCB3aWxsIGxvYWQgdGhlIGRhdGEgZnJvbSBnb29nbGUncyBjbG91ZCBzdG9yYWdlLlxuICAgKiBUaGUgYm9keSBwcm9wZXJ0eSBvZiB0aGlzIE1lc3NhZ2VQYXJ0IGlzIHNldCB0byB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiAgICAgIG1lc3NhZ2VwYXJ0LmZldGNoQ29udGVudCgpXG4gICAqICAgICAgLm9uKFwiY29udGVudC1sb2FkZWRcIiwgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIHJlbmRlcihtZXNzYWdlcGFydC5ib2R5KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTm90ZSB0aGF0IGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGBmZXRjaENvbnRlbnRgIHdpbGwgYWxzbyBjYXVzZSBRdWVyeSBjaGFuZ2UgZXZlbnRzIHRvIGZpcmUuXG4gICAqIEluIHRoaXMgZXhhbXBsZSwgYHJlbmRlcmAgd2lsbCBiZSBjYWxsZWQgYnkgdGhlIHF1ZXJ5IGNoYW5nZSBldmVudCB0aGF0IHdpbGwgb2NjdXIgb25jZSB0aGUgY29udGVudCBoYXMgZG93bmxvYWRlZDpcbiAgICpcbiAgICogYGBgXG4gICAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIHJlbmRlcihxdWVyeS5kYXRhKTtcbiAgICogIH0pO1xuICAgKiAgbWVzc2FnZXBhcnQuZmV0Y2hDb250ZW50KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKlxuICAgKiBAbWV0aG9kIGZldGNoQ29udGVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGNhbGxiYWNrLmRhdGEgLSBFaXRoZXIgYSBzdHJpbmcgKG1pbWVUeXBlPXRleHQvcGxhaW4pIG9yIGEgQmxvYiAoYWxsIG90aGVyIG1pbWVUeXBlcylcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udGVudH0gdGhpc1xuICAgKi9cbiAgZmV0Y2hDb250ZW50KGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnQgJiYgIXRoaXMuaXNGaXJpbmcpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgY29uc3QgdHlwZSA9IHRoaXMubWltZVR5cGUgPT09ICdpbWFnZS9qcGVnK3ByZXZpZXcnID8gJ2ltYWdlL2pwZWcnIDogdGhpcy5taW1lVHlwZTtcbiAgICAgIHRoaXMuX2NvbnRlbnQubG9hZENvbnRlbnQodHlwZSwgKGVyciwgcmVzdWx0KSA9PiB0aGlzLl9mZXRjaENvbnRlbnRDYWxsYmFjayhlcnIsIHJlc3VsdCwgY2FsbGJhY2spKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aXRoIHJlc3VsdCBvciBlcnJvciBmcm9tIGNhbGxpbmcgZmV0Y2hDb250ZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbWV0aG9kIF9mZXRjaENvbnRlbnRDYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGVyclxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBfZmV0Y2hDb250ZW50Q2FsbGJhY2soZXJyLCByZXN1bHQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb250ZW50LWxvYWRlZC1lcnJvcicsIGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICAgIGlmICh0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCkpIHtcbiAgICAgICAgVXRpbC5mZXRjaFRleHRGcm9tRmlsZShyZXN1bHQsIHRleHQgPT4gdGhpcy5fZmV0Y2hDb250ZW50Q29tcGxldGUodGV4dCwgY2FsbGJhY2spKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChyZXN1bHQpO1xuICAgICAgICB0aGlzLl9mZXRjaENvbnRlbnRDb21wbGV0ZShyZXN1bHQsIGNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2l0aCBQYXJ0IEJvZHkgZnJvbSBfZmV0Y2hDb250ZW50Q2FsbGJhY2suXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX2ZldGNoQ29udGVudENvbXBsZXRlXG4gICAqIEBwYXJhbSB7QmxvYnxTdHJpbmd9IGJvZHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIF9mZXRjaENvbnRlbnRDb21wbGV0ZShib2R5LCBjYWxsYmFjaykge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9nZXRNZXNzYWdlKCk7XG5cbiAgICB0aGlzLmJvZHkgPSBib2R5O1xuXG4gICAgdGhpcy50cmlnZ2VyKCdjb250ZW50LWxvYWRlZCcpO1xuICAgIG1lc3NhZ2UuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgb2xkVmFsdWU6IG1lc3NhZ2UucGFydHMsXG4gICAgICBuZXdWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIHByb3BlcnR5OiAncGFydHMnLFxuICAgIH0pO1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sodGhpcy5ib2R5KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFjY2VzcyB0aGUgVVJMIHRvIHRoZSByZW1vdGUgcmVzb3VyY2UuXG4gICAqXG4gICAqIFVzZWZ1bCBmb3Igc3RyZWFtaW5nIHRoZSBjb250ZW50IHNvIHRoYXQgeW91IGRvbid0IGhhdmUgdG8gZG93bmxvYWQgdGhlIGVudGlyZSBmaWxlIGJlZm9yZSByZW5kZXJpbmcgaXQuXG4gICAqIEFsc28gdXNlZnVsIGZvciBjb250ZW50IHRoYXQgd2lsbCBiZSBvcGVubmVkIGluIGEgbmV3IHdpbmRvdywgYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgZmV0Y2hlZCBub3cuXG4gICAqXG4gICAqIEZvciBNZXNzYWdlUGFydHMgd2l0aCBSaWNoIENvbnRlbnQsIHdpbGwgbG9va3VwIGEgVVJMIHRvIHlvdXIgUmljaCBDb250ZW50LlxuICAgKiBVc2VmdWwgZm9yIHN0cmVhbWluZyBhbmQgY29udGVudCBzbyB0aGF0IHlvdSBkb24ndCBoYXZlIHRvIGRvd25sb2FkIHRoZSBlbnRpcmUgZmlsZSBiZWZvcmUgcmVuZGVyaW5nIGl0LlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZXBhcnQuZmV0Y2hTdHJlYW0oZnVuY3Rpb24odXJsKSB7XG4gICAqICAgICByZW5kZXIodXJsKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBOb3RlIHRoYXQgYSBzdWNjZXNzZnVsIGNhbGwgdG8gYGZldGNoU3RyZWFtYCB3aWxsIGFsc28gY2F1c2UgUXVlcnkgY2hhbmdlIGV2ZW50cyB0byBmaXJlLlxuICAgKiBJbiB0aGlzIGV4YW1wbGUsIGByZW5kZXJgIHdpbGwgYmUgY2FsbGVkIGJ5IHRoZSBxdWVyeSBjaGFuZ2UgZXZlbnQgdGhhdCB3aWxsIG9jY3VyIG9uY2UgdGhlIGB1cmxgIGhhcyBiZWVuIHJlZnJlc2hlZDpcbiAgICpcbiAgICogYGBgXG4gICAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgcmVuZGVyKHF1ZXJ5LmRhdGEpO1xuICAgKiAgfSk7XG4gICAqICBtZXNzYWdlcGFydC5mZXRjaFN0cmVhbSgpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBmZXRjaFN0cmVhbVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGNhbGxiYWNrLnVybFxuICAgKiBAcmV0dXJuIHtsYXllci5Db250ZW50fSB0aGlzXG4gICAqL1xuICBmZXRjaFN0cmVhbShjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5fY29udGVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jb250ZW50UmVxdWlyZWQpO1xuICAgIGlmICh0aGlzLl9jb250ZW50LmlzRXhwaXJlZCgpKSB7XG4gICAgICB0aGlzLl9jb250ZW50LnJlZnJlc2hDb250ZW50KHRoaXMuX2dldENsaWVudCgpLCB1cmwgPT4gdGhpcy5fZmV0Y2hTdHJlYW1Db21wbGV0ZSh1cmwsIGNhbGxiYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2ZldGNoU3RyZWFtQ29tcGxldGUodGhpcy5fY29udGVudC5kb3dubG9hZFVybCwgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIERvZXMgbm90IHNldCB0aGlzLnVybDsgaW5zdGVhZCByZWxpZXMgb24gZmFjdCB0aGF0IHRoaXMuX2NvbnRlbnQuZG93bmxvYWRVcmwgaGFzIGJlZW4gdXBkYXRlZFxuICBfZmV0Y2hTdHJlYW1Db21wbGV0ZSh1cmwsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dldE1lc3NhZ2UoKTtcblxuICAgIHRoaXMudHJpZ2dlcigndXJsLWxvYWRlZCcpO1xuICAgIG1lc3NhZ2UuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgb2xkVmFsdWU6IG1lc3NhZ2UucGFydHMsXG4gICAgICBuZXdWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIHByb3BlcnR5OiAncGFydHMnLFxuICAgIH0pO1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sodXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwcyBhIE1lc3NhZ2VQYXJ0IGZvciBzZW5kaW5nLiAgTm9ybWFsbHkgdGhhdCBpcyB0cml2aWFsLlxuICAgKiBCdXQgaWYgdGhlcmUgaXMgcmljaCBjb250ZW50LCB0aGVuIHRoZSBjb250ZW50IG11c3QgYmUgdXBsb2FkZWRcbiAgICogYW5kIHRoZW4gd2UgY2FuIHRyaWdnZXIgYSBcInBhcnRzOnNlbmRcIiBldmVudCBpbmRpY2F0aW5nIHRoYXRcbiAgICogdGhlIHBhcnQgaXMgcmVhZHkgdG8gc2VuZC5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBmaXJlcyBwYXJ0czpzZW5kXG4gICAqL1xuICBfc2VuZChjbGllbnQpIHtcbiAgICAvLyBUaGVyZSBpcyBhbHJlYWR5IGEgQ29udGVudCBvYmplY3QsIHByZXN1bWFibHkgdGhlIGRldmVsb3BlclxuICAgIC8vIGFscmVhZHkgdG9vayBjYXJlIG9mIHRoaXMgc3RlcCBmb3IgdXMuXG4gICAgaWYgKHRoaXMuX2NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX3NlbmRXaXRoQ29udGVudCgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBzaXplIGlzIGxhcmdlLCBDcmVhdGUgYW5kIHVwbG9hZCB0aGUgQ29udGVudFxuICAgIGVsc2UgaWYgKHRoaXMuc2l6ZSA+IDIwNDgpIHtcbiAgICAgIHRoaXMuX2dlbmVyYXRlQ29udGVudEFuZFNlbmQoY2xpZW50KTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgYm9keSBpcyBhIGJsb2IsIGJ1dCBpcyBub3QgWUVUIFJpY2ggQ29udGVudCwgZG8gc29tZSBjdXN0b20gYW5hbHlzaXMvcHJvY2Vzc2luZzpcbiAgICBlbHNlIGlmIChVdGlsLmlzQmxvYih0aGlzLmJvZHkpKSB7XG4gICAgICB0aGlzLl9zZW5kQmxvYihjbGllbnQpO1xuICAgIH1cblxuICAgIC8vIEVsc2UgdGhlIG1lc3NhZ2UgcGFydCBjYW4gYmUgc2VudCBhcyBpcy5cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuX3NlbmRCb2R5KCk7XG4gICAgfVxuICB9XG5cbiAgX3NlbmRCb2R5KCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5ib2R5ICE9PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZXJyID0gJ01lc3NhZ2VQYXJ0LmJvZHkgbXVzdCBiZSBhIHN0cmluZyBpbiBvcmRlciB0byBzZW5kIGl0JztcbiAgICAgIGxvZ2dlci5lcnJvcihlcnIsIHsgbWltZVR5cGU6IHRoaXMubWltZVR5cGUsIGJvZHk6IHRoaXMuYm9keSB9KTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnIpO1xuICAgIH1cblxuICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgIGJvZHk6IHRoaXMuYm9keSxcbiAgICB9O1xuICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIG9iaik7XG4gIH1cblxuICBfc2VuZFdpdGhDb250ZW50KCkge1xuICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIHtcbiAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgc2l6ZTogdGhpcy5zaXplLFxuICAgICAgICBpZDogdGhpcy5fY29udGVudC5pZCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgaXMgb25seSBjYWxsZWQgaWYgQmxvYi5zaXplIDwgMjA0OC5cbiAgICpcbiAgICogSG93ZXZlciwgY29udmVyc2lvbiB0byBiYXNlNjQgY2FuIGltcGFjdCB0aGUgc2l6ZSwgc28gd2UgbXVzdCByZXRlc3QgdGhlIHNpemVcbiAgICogYWZ0ZXIgY29udmVyc2lvbiwgYW5kIHRoZW4gZGVjaWRlIHRvIHNlbmQgdGhlIG9yaWdpbmFsIGJsb2Igb3IgdGhlIGJhc2U2NCBlbmNvZGVkIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2QgX3NlbmRCbG9iXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICovXG4gIF9zZW5kQmxvYihjbGllbnQpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIFV0aWwuYmxvYlRvQmFzZTY0KHRoaXMuYm9keSwgKGJhc2U2NGRhdGEpID0+IHtcbiAgICAgIGlmIChiYXNlNjRkYXRhLmxlbmd0aCA8IDIwNDgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGJhc2U2NGRhdGEuc3Vic3RyaW5nKGJhc2U2NGRhdGEuaW5kZXhPZignLCcpICsgMSk7XG4gICAgICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgfTtcbiAgICAgICAgb2JqLmVuY29kaW5nID0gJ2Jhc2U2NCc7XG4gICAgICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIG9iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kKGNsaWVudCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGFuIHJpY2ggQ29udGVudCBvYmplY3Qgb24gdGhlIHNlcnZlclxuICAgKiBhbmQgdGhlbiBjYWxsIF9wcm9jZXNzQ29udGVudFJlc3BvbnNlXG4gICAqXG4gICAqIEBtZXRob2QgX2dlbmVyYXRlQ29udGVudEFuZFNlbmRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICovXG4gIF9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kKGNsaWVudCkge1xuICAgIHRoaXMuaGFzQ29udGVudCA9IHRydWU7XG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKCFVdGlsLmlzQmxvYih0aGlzLmJvZHkpKSB7XG4gICAgICBib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IoVXRpbC51dG9hKHRoaXMuYm9keSksIHRoaXMubWltZVR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5ib2R5O1xuICAgIH1cbiAgICBjbGllbnQueGhyKHtcbiAgICAgIHVybDogJy9jb250ZW50JyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtVHlwZSc6IHRoaXMubWltZVR5cGUsXG4gICAgICAgICdVcGxvYWQtQ29udGVudC1MZW5ndGgnOiBib2R5LnNpemUsXG4gICAgICAgICdVcGxvYWQtT3JpZ2luJzogdHlwZW9mIGxvY2F0aW9uICE9PSAndW5kZWZpbmVkJyA/IGxvY2F0aW9uLm9yaWdpbiA6ICcnLFxuICAgICAgfSxcbiAgICAgIHN5bmM6IHt9LFxuICAgIH0sIHJlc3VsdCA9PiB0aGlzLl9wcm9jZXNzQ29udGVudFJlc3BvbnNlKHJlc3VsdC5kYXRhLCBib2R5LCBjbGllbnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbGF5ZXIuQ29udGVudCBvYmplY3QgZnJvbSB0aGUgc2VydmVyJ3NcbiAgICogQ29udGVudCBvYmplY3QsIGFuZCB0aGVuIHVwbG9hZHMgdGhlIGRhdGEgdG8gZ29vZ2xlIGNsb3VkIHN0b3JhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NDb250ZW50UmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXNwb25zZVxuICAgKiBAcGFyYW0gIHtCbG9ifSBib2R5XG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqL1xuICBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZShyZXNwb25zZSwgYm9keSwgY2xpZW50KSB7XG4gICAgdGhpcy5fY29udGVudCA9IG5ldyBDb250ZW50KHJlc3BvbnNlLmlkKTtcbiAgICB0aGlzLmhhc0NvbnRlbnQgPSB0cnVlO1xuXG4gICAgeGhyKHtcbiAgICAgIHVybDogcmVzcG9uc2UudXBsb2FkX3VybCxcbiAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICBkYXRhOiBib2R5LFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtTGVuZ3RoJzogdGhpcy5zaXplLFxuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtVHlwZSc6IHRoaXMubWltZVR5cGUsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiB0aGlzLl9wcm9jZXNzQ29udGVudFVwbG9hZFJlc3BvbnNlKHJlc3VsdCwgcmVzcG9uc2UsIGNsaWVudCkpO1xuICB9XG5cbiAgX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UodXBsb2FkUmVzdWx0LCBjb250ZW50UmVzcG9uc2UsIGNsaWVudCkge1xuICAgIGlmICghdXBsb2FkUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIGlmICghY2xpZW50Lm9ubGluZU1hbmFnZXIuaXNPbmxpbmUpIHtcbiAgICAgICAgY2xpZW50Lm9ubGluZU1hbmFnZXIub25jZSgnY29ubmVjdGVkJywgdGhpcy5fcHJvY2Vzc0NvbnRlbnRSZXNwb25zZS5iaW5kKHRoaXMsIGNvbnRlbnRSZXNwb25zZSwgY2xpZW50KSwgdGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ1dlIGRvblxcJ3QgeWV0IGhhbmRsZSB0aGlzIScpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCB7XG4gICAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHNpemU6IHRoaXMuc2l6ZSxcbiAgICAgICAgICBpZDogdGhpcy5fY29udGVudC5pZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB0ZXh0IGZvciBhbnkgdGV4dC9wbGFpbiBwYXJ0LlxuICAgKlxuICAgKiBSZXR1cm5zICcnIGlmIGl0cyBub3QgYSB0ZXh0L3BsYWluIHBhcnQuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0VGV4dFxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KCkge1xuICAgIGlmICh0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmJvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgTWVzc2FnZVBhcnQgd2l0aCBuZXcgZGF0YSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSwgTWVzc2FnZVBhcnQgcHJvcGVydGllcyBkbyBub3QgdXBkYXRlLi4uIGhvd2V2ZXIsXG4gICAqIHRoZSBsYXllci5Db250ZW50IG9iamVjdCB0aGF0IFJpY2ggQ29udGVudCBNZXNzYWdlUGFydHMgY29udGFpblxuICAgKiBkbyBnZXQgdXBkYXRlZCB3aXRoIHJlZnJlc2hlZCBleHBpcmluZyB1cmxzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwYXJ0IC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIGEgcGFydFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgaWYgKHBhcnQuY29udGVudCAmJiB0aGlzLl9jb250ZW50KSB7XG4gICAgICB0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsID0gcGFydC5jb250ZW50LmRvd25sb2FkX3VybDtcbiAgICAgIHRoaXMuX2NvbnRlbnQuZXhwaXJhdGlvbiA9IG5ldyBEYXRlKHBhcnQuY29udGVudC5leHBpcmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIG1pbWVUeXBlIGZvciB0aGlzIE1lc3NhZ2VQYXJ0IGRlZmluZWQgYXMgdGV4dHVhbCBjb250ZW50P1xuICAgKlxuICAgKiBJZiB0aGUgYW5zd2VyIGlzIHRydWUsIGV4cGVjdCBhIGBib2R5YCBvZiBzdHJpbmcsIGVsc2UgZXhwZWN0IGBib2R5YCBvZiBCbG9iLlxuICAgKlxuICAgKiBUbyBjaGFuZ2Ugd2hldGhlciBhIGdpdmVuIE1JTUUgVHlwZSBpcyB0cmVhdGVkIGFzIHRleHR1YWwsIHNlZSBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzVGV4dHVhbE1pbWVUeXBlXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNUZXh0dWFsTWltZVR5cGUoKSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBNZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZXN0ID0gTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgdGVzdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKHRlc3QgPT09IHRoaXMubWltZVR5cGUpIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0ZXN0IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIGlmICh0aGlzLm1pbWVUeXBlLm1hdGNoKHRlc3QpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBNZXNzYWdlUGFydCBmcm9tIGEgc2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBwYXJ0XG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IHBhcnQgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBwYXJ0XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIocGFydCkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSAocGFydC5jb250ZW50KSA/IENvbnRlbnQuX2NyZWF0ZUZyb21TZXJ2ZXIocGFydC5jb250ZW50KSA6IG51bGw7XG5cbiAgICAvLyBUdXJuIGJhc2U2NCBkYXRhIGludG8gYSBCbG9iXG4gICAgaWYgKHBhcnQuZW5jb2RpbmcgPT09ICdiYXNlNjQnKSBwYXJ0LmJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYihwYXJ0LmJvZHksIHBhcnQubWltZVR5cGUpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBNZXNzYWdlUGFydFxuICAgIHJldHVybiBuZXcgTWVzc2FnZVBhcnQoe1xuICAgICAgaWQ6IHBhcnQuaWQsXG4gICAgICBtaW1lVHlwZTogcGFydC5taW1lX3R5cGUsXG4gICAgICBib2R5OiBwYXJ0LmJvZHkgfHwgJycsXG4gICAgICBfY29udGVudDogY29udGVudCxcbiAgICAgIGhhc0NvbnRlbnQ6IEJvb2xlYW4oY29udGVudCksXG4gICAgICBzaXplOiBwYXJ0LnNpemUgfHwgMCxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIGxheWVyLkNsaWVudCB0aGF0IHRoZSBjb252ZXJzYXRpb24gYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBTZXJ2ZXIgZ2VuZXJhdGVkIGlkZW50aWZpZXIgZm9yIHRoZSBwYXJ0XG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuaWQgPSAnJztcblxuLyoqXG4gKiBCb2R5IG9mIHlvdXIgbWVzc2FnZSBwYXJ0LlxuICpcbiAqIFRoaXMgaXMgdGhlIGNvcmUgZGF0YSBvZiB5b3VyIHBhcnQuXG4gKlxuICogSWYgdGhpcyBpcyBgbnVsbGAgdGhlbiBtb3N0IGxpa2VseSBsYXllci5NZXNzYWdlLmhhc0NvbnRlbnQgaXMgdHJ1ZSwgYW5kIHlvdVxuICogY2FuIGVpdGhlciB1c2UgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LnVybCBwcm9wZXJ0eSBvciB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQuZmV0Y2hDb250ZW50IG1ldGhvZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuYm9keSA9IG51bGw7XG5cbi8qKlxuICogUmljaCBjb250ZW50IG9iamVjdC5cbiAqXG4gKiBUaGlzIHdpbGwgYmUgYXV0b21hdGljYWxseSBjcmVhdGVkIGZvciB5b3UgaWYgeW91ciBsYXllci5NZXNzYWdlUGFydC5ib2R5XG4gKiBpcyBsYXJnZS5cbiAqIEB0eXBlIHtsYXllci5Db250ZW50fVxuICogQHByaXZhdGVcbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLl9jb250ZW50ID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgUGFydCBoYXMgcmljaCBjb250ZW50XG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmhhc0NvbnRlbnQgPSBmYWxzZTtcblxuLyoqXG4gKiBVUkwgdG8gcmljaCBjb250ZW50IG9iamVjdC5cbiAqXG4gKiBQYXJ0cyB3aXRoIHJpY2ggY29udGVudCB3aWxsIGJlIGluaXRpYWxpemVkIHdpdGggdGhpcyBwcm9wZXJ0eSBzZXQuICBCdXQgaXRzIHZhbHVlIHdpbGwgZXhwaXJlLlxuICpcbiAqIFdpbGwgY29udGFpbiBhbiBleHBpcmluZyB1cmwgYXQgaW5pdGlhbGl6YXRpb24gdGltZSBhbmQgYmUgcmVmcmVzaGVkIHdpdGggY2FsbHMgdG8gYGxheWVyLk1lc3NhZ2VQYXJ0LmZldGNoU3RyZWFtKClgLlxuICogV2lsbCBjb250YWluIGEgbm9uLWV4cGlyaW5nIHVybCB0byBhIGxvY2FsIHJlc291cmNlIGlmIGBsYXllci5NZXNzYWdlUGFydC5mZXRjaENvbnRlbnQoKWAgaXMgY2FsbGVkLlxuICpcbiAqIEB0eXBlIHtsYXllci5Db250ZW50fVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWVzc2FnZVBhcnQucHJvdG90eXBlLCAndXJsJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAvLyBJdHMgcG9zc2libGUgdG8gaGF2ZSBhIHVybCBhbmQgbm8gY29udGVudCBpZiBpdCBoYXMgYmVlbiBpbnN0YW50aWF0ZWQgYnV0IG5vdCB5ZXQgc2VudC5cbiAgICAvLyBJZiB0aGVyZSBpcyBhIF9fdXJsIHRoZW4gaXRzIGEgbG9jYWwgdXJsIGdlbmVyYXRlZCBmcm9tIHRoZSBib2R5IHByb3BlcnR5IGFuZCBkb2VzIG5vdCBleHBpcmUuXG4gICAgaWYgKHRoaXMuX191cmwpIHJldHVybiB0aGlzLl9fdXJsO1xuICAgIGlmICh0aGlzLl9jb250ZW50KSByZXR1cm4gdGhpcy5fY29udGVudC5pc0V4cGlyZWQoKSA/ICcnIDogdGhpcy5fY29udGVudC5kb3dubG9hZFVybDtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24gc2V0KGluVmFsdWUpIHtcbiAgICB0aGlzLl9fdXJsID0gaW5WYWx1ZTtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIE1pbWUgVHlwZSBmb3IgdGhlIGRhdGEgcmVwcmVzZW50ZWQgYnkgdGhlIE1lc3NhZ2VQYXJ0LlxuICpcbiAqIFR5cGljYWxseSB0aGlzIGlzIHRoZSB0eXBlIGZvciB0aGUgZGF0YSBpbiBsYXllci5NZXNzYWdlUGFydC5ib2R5O1xuICogaWYgdGhlcmUgaXMgUmljaCBDb250ZW50LCB0aGVuIGl0cyB0aGUgdHlwZSBvZiBDb250ZW50IHRoYXQgbmVlZHMgdG8gYmVcbiAqIGRvd25sb2FkZWQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLm1pbWVUeXBlID0gJ3RleHQvcGxhaW4nO1xuXG4vKipcbiAqIFNpemUgb2YgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LmJvZHkuXG4gKlxuICogV2lsbCBiZSBzZXQgZm9yIHlvdSBpZiBub3QgcHJvdmlkZWQuXG4gKiBPbmx5IG5lZWRlZCBmb3IgdXNlIHdpdGggcmljaCBjb250ZW50LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5zaXplID0gMDtcblxuLyoqXG4gKiBBcnJheSBvZiBtaW1lIHR5cGVzIHRoYXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgdGV4dC5cbiAqXG4gKiBUcmVhdGluZyBhIE1lc3NhZ2VQYXJ0IGFzIHRleHQgbWVhbnMgdGhhdCBldmVuIGlmIHRoZSBgYm9keWAgZ2V0cyBhIEZpbGUgb3IgQmxvYixcbiAqIGl0IHdpbGwgYmUgdHJhbnNmb3JtZWQgdG8gYSBzdHJpbmcgYmVmb3JlIGJlaW5nIGRlbGl2ZXJlZCB0byB5b3VyIGFwcC5cbiAqXG4gKiBUaGlzIHZhbHVlIGNhbiBiZSBjdXN0b21pemVkIHVzaW5nIHN0cmluZ3MgYW5kIHJlZ3VsYXIgZXhwcmVzc2lvbnM6XG4gKlxuICogYGBgXG4gKiBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzID0gWyd0ZXh0L3BsYWluJywgJ3RleHQvbW91bnRhaW4nLCAvXmFwcGxpY2F0aW9uXFwvanNvbihcXCsuKykkL11cbiAqIGBgYFxuICpcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtNaXhlZFtdfVxuICovXG5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzID0gWy9edGV4dFxcLy4rJC8sIC9eYXBwbGljYXRpb25cXC9qc29uKFxcKy4rKT8kL107XG5cbk1lc3NhZ2VQYXJ0Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gICdwYXJ0czpzZW5kJyxcbiAgJ2NvbnRlbnQtbG9hZGVkJyxcbiAgJ3VybC1sb2FkZWQnLFxuICAnY29udGVudC1sb2FkZWQtZXJyb3InLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KE1lc3NhZ2VQYXJ0LCBbTWVzc2FnZVBhcnQsICdNZXNzYWdlUGFydCddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlUGFydDtcbiJdfQ==
