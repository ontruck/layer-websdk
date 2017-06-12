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
          if (!_this2.isDestroyed) _this2._fetchContentCallback(err, result, callback);
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
      if (!message) return;

      // NOTE: This will trigger a messageparts:change event, and therefore a messages:change event
      this.body = body;

      this.trigger('content-loaded');

      // TODO: This event is now deprecated, and should be removed for WebSDK 4.0
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

      this._triggerAsync('messageparts:change', {
        oldValue: '',
        newValue: url,
        property: 'url'
      });

      // TODO: This event is now deprecated, and should be removed for WebSDK 4.0
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
     * @param {Number} [retryCount=0]
     */

  }, {
    key: '_processContentResponse',
    value: function _processContentResponse(response, body, client) {
      var _this7 = this;

      var retryCount = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

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
        return _this7._processContentUploadResponse(result, response, client, body, retryCount);
      });
    }

    /**
     * Process the response to uploading the content to google cloud storage.
     *
     * Result is either:
     *
     * 1. trigger `parts:send` on success
     * 2. call `_processContentResponse` to retry
     * 3. trigger `messages:sent-error` if retries have failed
     *
     * @method _processContentUploadResponse
     * @private
     * @param  {Object} uploadResult    Response from google cloud server; note that the xhr method assumes some layer-like behaviors and may replace non-json responses with js objects.
     * @param  {Object} contentResponse Response to `POST /content` from before
     * @param  {layer.Client} client
     * @param  {Blob} body
     * @param  {Number} retryCount
     */

  }, {
    key: '_processContentUploadResponse',
    value: function _processContentUploadResponse(uploadResult, contentResponse, client, body, retryCount) {
      if (!uploadResult.success) {
        if (!client.onlineManager.isOnline) {
          client.onlineManager.once('connected', this._processContentResponse.bind(this, contentResponse, client), this);
        } else if (retryCount < MessagePart.MaxRichContentRetryCount) {
          this._processContentResponse(contentResponse, body, client, retryCount + 1);
        } else {
          logger.error('Failed to upload rich content; triggering message:sent-error event; status of ', uploadResult.status, this);
          this._getMessage().trigger('messages:sent-error', {
            error: new LayerError({
              message: 'Upload of rich content failed',
              httpStatus: uploadResult.status,
              code: 0,
              data: uploadResult.xhr
            }),
            part: this
          });
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
     * This method is automatically called any time the body is changed.
     *
     * Note that it is not called during initialization.  Any developer who does:
     *
     * ```
     * part.body = "Hi";
     * ```
     *
     * can expect this to trigger a change event, which will in turn trigger a `messages:change` event on the layer.Message.
     *
     * @method __updateBody
     * @private
     * @param {String} newValue
     * @param {String} oldValue
     */

  }, {
    key: '__updateBody',
    value: function __updateBody(newValue, oldValue) {
      this._triggerAsync('messageparts:change', {
        property: 'body',
        newValue: newValue,
        oldValue: oldValue
      });
    }

    /**
     * This method is automatically called any time the mimeType is changed.
     *
     * Note that it is not called during initialization.  Any developer who does:
     *
     * ```
     * part.mimeType = "text/mountain";
     * ```
     *
     * can expect this to trigger a change event, which will in turn trigger a `messages:change` event on the layer.Message.
     *
     * @method __updateMimeType
     * @private
     * @param {String} newValue
     * @param {String} oldValue
     */

  }, {
    key: '__updateMimeType',
    value: function __updateMimeType(newValue, oldValue) {
      this._triggerAsync('messageparts:change', {
        property: 'mimeType',
        newValue: newValue,
        oldValue: oldValue
      });
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

/**
 * Number of retry attempts to make before giving up on uploading Rich Content to Google Cloud Storage.
 *
 * @type {Number}
 */
MessagePart.MaxRichContentRetryCount = 3;

MessagePart._supportedEvents = ['parts:send', 'content-loaded', 'url-loaded', 'content-loaded-error', 'messageparts:change'].concat(Root._supportedEvents);
Root.initClass.apply(MessagePart, [MessagePart, 'MessagePart']);

module.exports = MessagePart;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvbWVzc2FnZS1wYXJ0LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiQ29udGVudCIsInhociIsIkNsaWVudFJlZ2lzdHJ5IiwiTGF5ZXJFcnJvciIsIlV0aWwiLCJsb2dnZXIiLCJNZXNzYWdlUGFydCIsIm9wdGlvbnMiLCJuZXdPcHRpb25zIiwiYm9keSIsIm1pbWVUeXBlIiwiaXNCbG9iIiwiQmxvYiIsInR5cGUiLCJzaXplIiwiaGFzQ29udGVudCIsImxlbmd0aCIsImVuY29kaW5nIiwiYmFzZTY0VG9CbG9iIiwiaXNCbG9iQm9keSIsInRleHR1YWwiLCJpc1RleHR1YWxNaW1lVHlwZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIl9fdXJsIiwicmV2b2tlT2JqZWN0VVJMIiwiZ2V0IiwiY2xpZW50SWQiLCJfZ2V0Q2xpZW50IiwiZ2V0TWVzc2FnZSIsImlkIiwicmVwbGFjZSIsImNhbGxiYWNrIiwiX2NvbnRlbnQiLCJpc0ZpcmluZyIsImxvYWRDb250ZW50IiwiZXJyIiwicmVzdWx0IiwiaXNEZXN0cm95ZWQiLCJfZmV0Y2hDb250ZW50Q2FsbGJhY2siLCJ0cmlnZ2VyIiwiZmV0Y2hUZXh0RnJvbUZpbGUiLCJfZmV0Y2hDb250ZW50Q29tcGxldGUiLCJ0ZXh0IiwibWVzc2FnZSIsIl9nZXRNZXNzYWdlIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwicGFydHMiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY29udGVudFJlcXVpcmVkIiwiaXNFeHBpcmVkIiwicmVmcmVzaENvbnRlbnQiLCJfZmV0Y2hTdHJlYW1Db21wbGV0ZSIsImRvd25sb2FkVXJsIiwiY2xpZW50IiwiX3NlbmRXaXRoQ29udGVudCIsIl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kIiwiX3NlbmRCbG9iIiwiX3NlbmRCb2R5IiwiZXJyb3IiLCJvYmoiLCJtaW1lX3R5cGUiLCJjb250ZW50IiwiYmxvYlRvQmFzZTY0IiwiYmFzZTY0ZGF0YSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJ1dG9hIiwibWV0aG9kIiwiaGVhZGVycyIsImxvY2F0aW9uIiwib3JpZ2luIiwic3luYyIsIl9wcm9jZXNzQ29udGVudFJlc3BvbnNlIiwiZGF0YSIsInJlc3BvbnNlIiwicmV0cnlDb3VudCIsInVwbG9hZF91cmwiLCJfcHJvY2Vzc0NvbnRlbnRVcGxvYWRSZXNwb25zZSIsInVwbG9hZFJlc3VsdCIsImNvbnRlbnRSZXNwb25zZSIsInN1Y2Nlc3MiLCJvbmxpbmVNYW5hZ2VyIiwiaXNPbmxpbmUiLCJvbmNlIiwiYmluZCIsIk1heFJpY2hDb250ZW50UmV0cnlDb3VudCIsInN0YXR1cyIsImh0dHBTdGF0dXMiLCJjb2RlIiwicGFydCIsImRvd25sb2FkX3VybCIsImV4cGlyYXRpb24iLCJEYXRlIiwiaSIsIlRleHR1YWxNaW1lVHlwZXMiLCJ0ZXN0IiwiUmVnRXhwIiwibWF0Y2giLCJfY3JlYXRlRnJvbVNlcnZlciIsIkJvb2xlYW4iLCJwcm90b3R5cGUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiLCJzZXQiLCJpblZhbHVlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImNvbmNhdCIsImluaXRDbGFzcyIsImFwcGx5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtRUEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxVQUFVRCxRQUFRLFdBQVIsQ0FBaEI7QUFDQSxJQUFNRSxNQUFNRixRQUFRLFFBQVIsQ0FBWjtBQUNBLElBQU1HLGlCQUFpQkgsUUFBUSxvQkFBUixDQUF2QjtBQUNBLElBQU1JLGFBQWFKLFFBQVEsZ0JBQVIsQ0FBbkI7QUFDQSxJQUFNSyxPQUFPTCxRQUFRLGlCQUFSLENBQWI7QUFDQSxJ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QUFmLENBQS9COztBQUVBOzs7OztBQUtBOUYsWUFBWXFGLHdCQUFaLEdBQXVDLENBQXZDOztBQUVBckYsWUFBWTBHLGdCQUFaLEdBQStCLENBQzdCLFlBRDZCLEVBRTdCLGdCQUY2QixFQUc3QixZQUg2QixFQUk3QixzQkFKNkIsRUFLN0IscUJBTDZCLEVBTTdCQyxNQU42QixDQU10Qm5ILEtBQUtrSCxnQkFOaUIsQ0FBL0I7QUFPQWxILEtBQUtvSCxTQUFMLENBQWVDLEtBQWYsQ0FBcUI3RyxXQUFyQixFQUFrQyxDQUFDQSxXQUFELEVBQWMsYUFBZCxDQUFsQzs7QUFFQThHLE9BQU9DLE9BQVAsR0FBaUIvRyxXQUFqQiIsImZpbGUiOiJtZXNzYWdlLXBhcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBNZXNzYWdlUGFydCBjbGFzcyByZXByZXNlbnRzIGFuIGVsZW1lbnQgb2YgYSBtZXNzYWdlLlxuICpcbiAqICAgICAgLy8gQ3JlYXRlIGEgTWVzc2FnZSBQYXJ0IHdpdGggYW55IG1pbWVUeXBlXG4gKiAgICAgIHZhciBwYXJ0ID0gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtcbiAqICAgICAgICAgIGJvZHk6IFwiaGVsbG9cIixcbiAqICAgICAgICAgIG1pbWVUeXBlOiBcInRleHQvcGxhaW5cIlxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIENyZWF0ZSBhIHRleHQvcGxhaW4gb25seSBNZXNzYWdlIFBhcnRcbiAqICAgICAgdmFyIHBhcnQgPSBuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoXCJIZWxsbyBJIGFtIHRleHQvcGxhaW5cIik7XG4gKlxuICogWW91IGNhbiBhbHNvIGNyZWF0ZSBhIE1lc3NhZ2UgUGFydCBmcm9tIGEgRmlsZSBJbnB1dCBkb20gbm9kZTpcbiAqXG4gKiAgICAgIHZhciBmaWxlSW5wdXROb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJteUZpbGVJbnB1dFwiKTtcbiAqICAgICAgdmFyIHBhcnQgPSBuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoZmlsZUlucHV0Tm9kZS5maWxlc1swXSk7XG4gKlxuICogWW91IGNhbiBhbHNvIGNyZWF0ZSBNZXNzYWdlIFBhcnRzIGZyb20gYSBmaWxlIGRyYWcgYW5kIGRyb3Agb3BlcmF0aW9uOlxuICpcbiAqICAgICAgb25GaWxlRHJvcDogZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICAgICAgICAgdmFyIGZpbGVzID0gZXZ0LmRhdGFUcmFuc2Zlci5maWxlcztcbiAqICAgICAgICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKHtcbiAqICAgICAgICAgICAgICAgcGFydHM6IGZpbGVzLm1hcChmdW5jdGlvbihmaWxlKSB7XG4gKiAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe2JvZHk6IGZpbGUsIG1pbWVUeXBlOiBmaWxlLnR5cGV9KTtcbiAqICAgICAgICAgICAgICAgfVxuICogICAgICAgICAgIH0pO1xuICogICAgICB9KTtcbiAqXG4gKiAjIyMgQmxvYnMgdnMgU3RyaW5nc1xuICpcbiAqIFlvdSBzaG91bGQgYWx3YXlzIGV4cGVjdCB0byBzZWUgdGhlIGBib2R5YCBwcm9wZXJ0eSBiZSBhIEJsb2IgKip1bmxlc3MqKiB0aGUgbWltZVR5cGUgaXMgbGlzdGVkIGluIGxheWVyLk1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMsXG4gKiBpbiB3aGljaCBjYXNlIHRoZSB2YWx1ZSB3aWxsIGJlIGEgU3RyaW5nLiAgWW91IGNhbiBhZGQgbWltZVR5cGVzIHRvIFRleHR1YWxNaW1lVHlwZXM6XG4gKlxuICogYGBgXG4gKiBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzID0gWyd0ZXh0L3BsYWluJywgJ3RleHQvbW91bnRhaW4nLCAvXmFwcGxpY2F0aW9uXFwvanNvbihcXCsuKykkL11cbiAqIGBgYFxuICpcbiAqIEFueSBtaW1lVHlwZSBtYXRjaGluZyB0aGUgYWJvdmUgc3RyaW5ncyBhbmQgcmVndWxhciBleHByZXNzaW9ucyB3aWxsIGJlIHRyYW5zZm9ybWVkIHRvIHRleHQgYmVmb3JlIGJlaW5nIGRlbGl2ZXJlZCB0byB5b3VyIGFwcDsgb3RoZXJ3aXNlIGl0XG4gKiBtdXN0IGJlIGEgQmxvYi4gIE5vdGUgdGhhdCB0aGUgYWJvdmUgc25pcHBldCBzZXRzIGEgc3RhdGljIHByb3BlcnR5IHRoYXQgaXMgc2V0IG9uY2UsIGFuZCBhZmZlY3RzIGFsbCBNZXNzYWdlUGFydCBvYmplY3RzIGZvciB0aGUgbGlmZXNwYW4gb2ZcbiAqIHRoZSBhcHAuXG4gKlxuICogIyMjIEFjY2VzaW5nIFJpY2ggQ29udGVudFxuICpcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyBvZiBhY2Nlc3NpbmcgcmljaCBjb250ZW50XG4gKlxuICogMS4gQWNjZXNzIHRoZSBkYXRhIGRpcmVjdGx5OiBgcGFydC5mZXRjaENvbnRlbnQoZnVuY3Rpb24oZGF0YSkge215UmVuZGVyRGF0YShkYXRhKTt9KWAuIFRoaXMgYXBwcm9hY2ggZG93bmxvYWRzIHRoZSBkYXRhLFxuICogICAgd3JpdGVzIGl0IHRvIHRoZSB0aGUgYGJvZHlgIHByb3BlcnR5LCB3cml0ZXMgYSBEYXRhIFVSSSB0byB0aGUgcGFydCdzIGB1cmxgIHByb3BlcnR5LCBhbmQgdGhlbiBjYWxscyB5b3VyIGNhbGxiYWNrLlxuICogICAgQnkgZG93bmxvYWRpbmcgdGhlIGRhdGEgYW5kIHN0b3JpbmcgaXQgaW4gYGJvZHlgLCB0aGUgZGF0YSBkb2VzIG5vdCBleHBpcmUuXG4gKiAyLiBBY2Nlc3MgdGhlIFVSTCByYXRoZXIgdGhhbiB0aGUgZGF0YS4gIFdoZW4geW91IGZpcnN0IHJlY2VpdmUgdGhlIE1lc3NhZ2UgUGFydCBpdCB3aWxsIGhhdmUgYSB2YWxpZCBgdXJsYCBwcm9wZXJ0eTsgaG93ZXZlciwgdGhpcyBVUkwgZXhwaXJlcy4gICogICAgVVJMcyBhcmUgbmVlZGVkIGZvciBzdHJlYW1pbmcsIGFuZCBmb3IgY29udGVudCB0aGF0IGRvZXNuJ3QgeWV0IG5lZWQgdG8gYmUgcmVuZGVyZWQgKGUuZy4gaHlwZXJsaW5rcyB0byBkYXRhIHRoYXQgd2lsbCByZW5kZXIgd2hlbiBjbGlja2VkKS5cbiAqICAgIFRoZSB1cmwgcHJvcGVydHkgd2lsbCByZXR1cm4gYSBzdHJpbmcgaWYgdGhlIHVybCBpcyB2YWxpZCwgb3IgJycgaWYgaXRzIGV4cGlyZWQuICBDYWxsIGBwYXJ0LmZldGNoU3RyZWFtKGNhbGxiYWNrKWAgdG8gZ2V0IGFuIHVwZGF0ZWQgVVJMLlxuICogICAgVGhlIGZvbGxvd2luZyBwYXR0ZXJuIGlzIHJlY29tbWVuZGVkOlxuICpcbiAqIGBgYFxuICogaWYgKCFwYXJ0LnVybCkge1xuICogICBwYXJ0LmZldGNoU3RyZWFtKGZ1bmN0aW9uKHVybCkge215UmVuZGVyVXJsKHVybCl9KTtcbiAqIH0gZWxzZSB7XG4gKiAgIG15UmVuZGVyVXJsKHBhcnQudXJsKTtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIE5PVEU6IGBsYXllci5NZXNzYWdlUGFydC51cmxgIHNob3VsZCBoYXZlIGEgdmFsdWUgd2hlbiB0aGUgbWVzc2FnZSBpcyBmaXJzdCByZWNlaXZlZCwgYW5kIHdpbGwgb25seSBmYWlsIGBpZiAoIXBhcnQudXJsKWAgb25jZSB0aGUgdXJsIGhhcyBleHBpcmVkLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuTWVzc2FnZVBhcnRcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqIEBhdXRob3IgTWljaGFlbCBLYW50b3JcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi4vcm9vdCcpO1xuY29uc3QgQ29udGVudCA9IHJlcXVpcmUoJy4vY29udGVudCcpO1xuY29uc3QgeGhyID0gcmVxdWlyZSgnLi4veGhyJyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4uL2NsaWVudC1yZWdpc3RyeScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXInKTtcblxuY2xhc3MgTWVzc2FnZVBhcnQgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ29uc3RydWN0b3JcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnMgLSBDYW4gYmUgYW4gb2JqZWN0IHdpdGggYm9keSBhbmQgbWltZVR5cGUsIG9yIGl0IGNhbiBiZSBhIHN0cmluZywgb3IgYSBCbG9iL0ZpbGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBvcHRpb25zLmJvZHkgLSBBbnkgc3RyaW5nIGxhcmdlciB0aGFuIDJrYiB3aWxsIGJlIHNlbnQgYXMgUmljaCBDb250ZW50LCBtZWFuaW5nIGl0IHdpbGwgYmUgdXBsb2FkZWQgdG8gY2xvdWQgc3RvcmFnZSBhbmQgbXVzdCBiZSBzZXBhcmF0ZWx5IGRvd25sb2FkZWQgZnJvbSB0aGUgTWVzc2FnZSB3aGVuIGl0cyByZWNlaXZlZC5cbiAgICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5taW1lVHlwZT10ZXh0L3BsYWluXSAtIE1pbWUgdHlwZTsgY2FuIGJlIGFueXRoaW5nOyBpZiB5b3VyIGNsaWVudCBkb2Vzbid0IGhhdmUgYSByZW5kZXJlciBmb3IgaXQsIGl0IHdpbGwgYmUgaWdub3JlZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSBbb3B0aW9ucy5zaXplPTBdIC0gU2l6ZSBvZiB5b3VyIHBhcnQuIFdpbGwgYmUgY2FsY3VsYXRlZCBmb3IgeW91IGlmIG5vdCBwcm92aWRlZC5cbiAgICpcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZVBhcnR9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zLCAuLi5hcmdzKSB7XG4gICAgbGV0IG5ld09wdGlvbnMgPSBvcHRpb25zO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG5ld09wdGlvbnMgPSB7IGJvZHk6IG9wdGlvbnMgfTtcbiAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbmV3T3B0aW9ucy5taW1lVHlwZSA9IGFyZ3NbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdPcHRpb25zLm1pbWVUeXBlID0gJ3RleHQvcGxhaW4nO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoVXRpbC5pc0Jsb2Iob3B0aW9ucykgfHwgVXRpbC5pc0Jsb2Iob3B0aW9ucy5ib2R5KSkge1xuICAgICAgY29uc3QgYm9keSA9IG9wdGlvbnMgaW5zdGFuY2VvZiBCbG9iID8gb3B0aW9ucyA6IG9wdGlvbnMuYm9keTtcbiAgICAgIGNvbnN0IG1pbWVUeXBlID0gVXRpbC5pc0Jsb2Iob3B0aW9ucy5ib2R5KSA/IG9wdGlvbnMubWltZVR5cGUgOiBib2R5LnR5cGU7XG4gICAgICBuZXdPcHRpb25zID0ge1xuICAgICAgICBtaW1lVHlwZSxcbiAgICAgICAgYm9keSxcbiAgICAgICAgc2l6ZTogYm9keS5zaXplLFxuICAgICAgICBoYXNDb250ZW50OiB0cnVlLFxuICAgICAgfTtcbiAgICB9XG4gICAgc3VwZXIobmV3T3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLnNpemUgJiYgdGhpcy5ib2R5KSB0aGlzLnNpemUgPSB0aGlzLmJvZHkubGVuZ3RoO1xuXG4gICAgLy8gRG9uJ3QgZXhwb3NlIGVuY29kaW5nOyBibG9iaWZ5IGl0IGlmIGl0cyBlbmNvZGVkLlxuICAgIGlmIChvcHRpb25zLmVuY29kaW5nID09PSAnYmFzZTY0Jykge1xuICAgICAgdGhpcy5ib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IodGhpcy5ib2R5KTtcbiAgICB9XG5cbiAgICAvLyBDb3VsZCBiZSBhIGJsb2IgYmVjYXVzZSBpdCB3YXMgcmVhZCBvdXQgb2YgaW5kZXhlZERCLFxuICAgIC8vIG9yIGJlY2F1c2UgaXQgd2FzIGNyZWF0ZWQgbG9jYWxseSB3aXRoIGEgZmlsZVxuICAgIC8vIE9yIGJlY2F1c2Ugb2YgYmFzZTY0IGVuY29kZWQgZGF0YS5cbiAgICBjb25zdCBpc0Jsb2JCb2R5ID0gVXRpbC5pc0Jsb2IodGhpcy5ib2R5KTtcbiAgICBjb25zdCB0ZXh0dWFsID0gdGhpcy5pc1RleHR1YWxNaW1lVHlwZSgpO1xuXG4gICAgLy8gQ3VzdG9tIGhhbmRsaW5nIGZvciBub24tdGV4dHVhbCBjb250ZW50XG4gICAgaWYgKCF0ZXh0dWFsKSB7XG4gICAgICAvLyBJZiB0aGUgYm9keSBleGlzdHMgYW5kIGlzIGEgYmxvYiwgZXh0cmFjdCB0aGUgZGF0YSB1cmkgZm9yIGNvbnZlbmllbmNlOyBvbmx5IHJlYWxseSByZWxldmFudCBmb3IgaW1hZ2UgYW5kIHZpZGVvIEhUTUwgdGFncy5cbiAgICAgIGlmICghaXNCbG9iQm9keSAmJiB0aGlzLmJvZHkpIHRoaXMuYm9keSA9IG5ldyBCbG9iKFt0aGlzLmJvZHldLCB7IHR5cGU6IHRoaXMubWltZVR5cGUgfSk7XG4gICAgICBpZiAodGhpcy5ib2R5KSB0aGlzLnVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwodGhpcy5ib2R5KTtcbiAgICB9XG5cbiAgICAvLyBJZiBvdXIgdGV4dHVhbCBjb250ZW50IGlzIGEgYmxvYiwgdHVybmluZyBpdCBpbnRvIHRleHQgaXMgYXN5Y2hyb25vdXMsIGFuZCBjYW4ndCBiZSBkb25lIGluIHRoZSBzeW5jaHJvbm91cyBjb25zdHJ1Y3RvclxuICAgIC8vIFRoaXMgd2lsbCBvbmx5IGhhcHBlbiB3aGVuIHRoZSBjbGllbnQgaXMgYXR0YWNoaW5nIGEgZmlsZS4gIENvbnZlcnNpb24gZm9yIGxvY2FsbHkgY3JlYXRlZCBtZXNzYWdlcyBpcyBkb25lIHdoaWxlIGNhbGxpbmcgYE1lc3NhZ2Uuc2VuZCgpYFxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5fX3VybCkge1xuICAgICAgVVJMLnJldm9rZU9iamVjdFVSTCh0aGlzLl9fdXJsKTtcbiAgICAgIHRoaXMuX191cmwgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmJvZHkgPSBudWxsO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxheWVyLkNsaWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlUGFydC5cbiAgICpcbiAgICogVXNlcyB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQuY2xpZW50SWQgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENsaWVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBfZ2V0Q2xpZW50KCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5NZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGxheWVyLk1lc3NhZ2VQYXJ0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBfZ2V0TWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0Q2xpZW50KCkuZ2V0TWVzc2FnZSh0aGlzLmlkLnJlcGxhY2UoL1xcL3BhcnRzLiokLywgJycpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEb3dubG9hZCBSaWNoIENvbnRlbnQgZnJvbSBjbG91ZCBzZXJ2ZXIuXG4gICAqXG4gICAqIEZvciBNZXNzYWdlUGFydHMgd2l0aCByaWNoIGNvbnRlbnQsIHRoaXMgbWV0aG9kIHdpbGwgbG9hZCB0aGUgZGF0YSBmcm9tIGdvb2dsZSdzIGNsb3VkIHN0b3JhZ2UuXG4gICAqIFRoZSBib2R5IHByb3BlcnR5IG9mIHRoaXMgTWVzc2FnZVBhcnQgaXMgc2V0IHRvIHRoZSByZXN1bHQuXG4gICAqXG4gICAqICAgICAgbWVzc2FnZXBhcnQuZmV0Y2hDb250ZW50KClcbiAgICogICAgICAub24oXCJjb250ZW50LWxvYWRlZFwiLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgcmVuZGVyKG1lc3NhZ2VwYXJ0LmJvZHkpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBOb3RlIHRoYXQgYSBzdWNjZXNzZnVsIGNhbGwgdG8gYGZldGNoQ29udGVudGAgd2lsbCBhbHNvIGNhdXNlIFF1ZXJ5IGNoYW5nZSBldmVudHMgdG8gZmlyZS5cbiAgICogSW4gdGhpcyBleGFtcGxlLCBgcmVuZGVyYCB3aWxsIGJlIGNhbGxlZCBieSB0aGUgcXVlcnkgY2hhbmdlIGV2ZW50IHRoYXQgd2lsbCBvY2N1ciBvbmNlIHRoZSBjb250ZW50IGhhcyBkb3dubG9hZGVkOlxuICAgKlxuICAgKiBgYGBcbiAgICogIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgcmVuZGVyKHF1ZXJ5LmRhdGEpO1xuICAgKiAgfSk7XG4gICAqICBtZXNzYWdlcGFydC5mZXRjaENvbnRlbnQoKTtcbiAgICogYGBgXG4gICAqXG4gICAqXG4gICAqIEBtZXRob2QgZmV0Y2hDb250ZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICogQHBhcmFtIHtNaXhlZH0gY2FsbGJhY2suZGF0YSAtIEVpdGhlciBhIHN0cmluZyAobWltZVR5cGU9dGV4dC9wbGFpbikgb3IgYSBCbG9iIChhbGwgb3RoZXIgbWltZVR5cGVzKVxuICAgKiBAcmV0dXJuIHtsYXllci5Db250ZW50fSB0aGlzXG4gICAqL1xuICBmZXRjaENvbnRlbnQoY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5fY29udGVudCAmJiAhdGhpcy5pc0ZpcmluZykge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICBjb25zdCB0eXBlID0gdGhpcy5taW1lVHlwZSA9PT0gJ2ltYWdlL2pwZWcrcHJldmlldycgPyAnaW1hZ2UvanBlZycgOiB0aGlzLm1pbWVUeXBlO1xuICAgICAgdGhpcy5fY29udGVudC5sb2FkQ29udGVudCh0eXBlLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSB0aGlzLl9mZXRjaENvbnRlbnRDYWxsYmFjayhlcnIsIHJlc3VsdCwgY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2l0aCByZXN1bHQgb3IgZXJyb3IgZnJvbSBjYWxsaW5nIGZldGNoQ29udGVudC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfZmV0Y2hDb250ZW50Q2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBlcnJcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cbiAgX2ZldGNoQ29udGVudENhbGxiYWNrKGVyciwgcmVzdWx0LCBjYWxsYmFjaykge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHRoaXMudHJpZ2dlcignY29udGVudC1sb2FkZWQtZXJyb3InLCBlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gZmFsc2U7XG4gICAgICBpZiAodGhpcy5pc1RleHR1YWxNaW1lVHlwZSgpKSB7XG4gICAgICAgIFV0aWwuZmV0Y2hUZXh0RnJvbUZpbGUocmVzdWx0LCB0ZXh0ID0+IHRoaXMuX2ZldGNoQ29udGVudENvbXBsZXRlKHRleHQsIGNhbGxiYWNrKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwocmVzdWx0KTtcbiAgICAgICAgdGhpcy5fZmV0Y2hDb250ZW50Q29tcGxldGUocmVzdWx0LCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdpdGggUGFydCBCb2R5IGZyb20gX2ZldGNoQ29udGVudENhbGxiYWNrLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbWV0aG9kIF9mZXRjaENvbnRlbnRDb21wbGV0ZVxuICAgKiBAcGFyYW0ge0Jsb2J8U3RyaW5nfSBib2R5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBfZmV0Y2hDb250ZW50Q29tcGxldGUoYm9keSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2V0TWVzc2FnZSgpO1xuICAgIGlmICghbWVzc2FnZSkgcmV0dXJuO1xuXG4gICAgLy8gTk9URTogVGhpcyB3aWxsIHRyaWdnZXIgYSBtZXNzYWdlcGFydHM6Y2hhbmdlIGV2ZW50LCBhbmQgdGhlcmVmb3JlIGEgbWVzc2FnZXM6Y2hhbmdlIGV2ZW50XG4gICAgdGhpcy5ib2R5ID0gYm9keTtcblxuICAgIHRoaXMudHJpZ2dlcignY29udGVudC1sb2FkZWQnKTtcblxuICAgIC8vIFRPRE86IFRoaXMgZXZlbnQgaXMgbm93IGRlcHJlY2F0ZWQsIGFuZCBzaG91bGQgYmUgcmVtb3ZlZCBmb3IgV2ViU0RLIDQuMFxuICAgIG1lc3NhZ2UuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgb2xkVmFsdWU6IG1lc3NhZ2UucGFydHMsXG4gICAgICBuZXdWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIHByb3BlcnR5OiAncGFydHMnLFxuICAgIH0pO1xuXG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh0aGlzLmJvZHkpO1xuICB9XG5cblxuICAvKipcbiAgICogQWNjZXNzIHRoZSBVUkwgdG8gdGhlIHJlbW90ZSByZXNvdXJjZS5cbiAgICpcbiAgICogVXNlZnVsIGZvciBzdHJlYW1pbmcgdGhlIGNvbnRlbnQgc28gdGhhdCB5b3UgZG9uJ3QgaGF2ZSB0byBkb3dubG9hZCB0aGUgZW50aXJlIGZpbGUgYmVmb3JlIHJlbmRlcmluZyBpdC5cbiAgICogQWxzbyB1c2VmdWwgZm9yIGNvbnRlbnQgdGhhdCB3aWxsIGJlIG9wZW5uZWQgaW4gYSBuZXcgd2luZG93LCBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBmZXRjaGVkIG5vdy5cbiAgICpcbiAgICogRm9yIE1lc3NhZ2VQYXJ0cyB3aXRoIFJpY2ggQ29udGVudCwgd2lsbCBsb29rdXAgYSBVUkwgdG8geW91ciBSaWNoIENvbnRlbnQuXG4gICAqIFVzZWZ1bCBmb3Igc3RyZWFtaW5nIGFuZCBjb250ZW50IHNvIHRoYXQgeW91IGRvbid0IGhhdmUgdG8gZG93bmxvYWQgdGhlIGVudGlyZSBmaWxlIGJlZm9yZSByZW5kZXJpbmcgaXQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlcGFydC5mZXRjaFN0cmVhbShmdW5jdGlvbih1cmwpIHtcbiAgICogICAgIHJlbmRlcih1cmwpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBgZmV0Y2hTdHJlYW1gIHdpbGwgYWxzbyBjYXVzZSBRdWVyeSBjaGFuZ2UgZXZlbnRzIHRvIGZpcmUuXG4gICAqIEluIHRoaXMgZXhhbXBsZSwgYHJlbmRlcmAgd2lsbCBiZSBjYWxsZWQgYnkgdGhlIHF1ZXJ5IGNoYW5nZSBldmVudCB0aGF0IHdpbGwgb2NjdXIgb25jZSB0aGUgYHVybGAgaGFzIGJlZW4gcmVmcmVzaGVkOlxuICAgKlxuICAgKiBgYGBcbiAgICogIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICByZW5kZXIocXVlcnkuZGF0YSk7XG4gICAqICB9KTtcbiAgICogIG1lc3NhZ2VwYXJ0LmZldGNoU3RyZWFtKCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGZldGNoU3RyZWFtXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICogQHBhcmFtIHtNaXhlZH0gY2FsbGJhY2sudXJsXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnRlbnR9IHRoaXNcbiAgICovXG4gIGZldGNoU3RyZWFtKGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9jb250ZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNvbnRlbnRSZXF1aXJlZCk7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnQuaXNFeHBpcmVkKCkpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnQucmVmcmVzaENvbnRlbnQodGhpcy5fZ2V0Q2xpZW50KCksIHVybCA9PiB0aGlzLl9mZXRjaFN0cmVhbUNvbXBsZXRlKHVybCwgY2FsbGJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZmV0Y2hTdHJlYW1Db21wbGV0ZSh0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gRG9lcyBub3Qgc2V0IHRoaXMudXJsOyBpbnN0ZWFkIHJlbGllcyBvbiBmYWN0IHRoYXQgdGhpcy5fY29udGVudC5kb3dubG9hZFVybCBoYXMgYmVlbiB1cGRhdGVkXG4gIF9mZXRjaFN0cmVhbUNvbXBsZXRlKHVybCwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2V0TWVzc2FnZSgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCd1cmwtbG9hZGVkJyk7XG5cbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VwYXJ0czpjaGFuZ2UnLCB7XG4gICAgICBvbGRWYWx1ZTogJycsXG4gICAgICBuZXdWYWx1ZTogdXJsLFxuICAgICAgcHJvcGVydHk6ICd1cmwnLFxuICAgIH0pO1xuXG4gICAgLy8gVE9ETzogVGhpcyBldmVudCBpcyBub3cgZGVwcmVjYXRlZCwgYW5kIHNob3VsZCBiZSByZW1vdmVkIGZvciBXZWJTREsgNC4wXG4gICAgbWVzc2FnZS5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBvbGRWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIG5ld1ZhbHVlOiBtZXNzYWdlLnBhcnRzLFxuICAgICAgcHJvcGVydHk6ICdwYXJ0cycsXG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBzIGEgTWVzc2FnZVBhcnQgZm9yIHNlbmRpbmcuICBOb3JtYWxseSB0aGF0IGlzIHRyaXZpYWwuXG4gICAqIEJ1dCBpZiB0aGVyZSBpcyByaWNoIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgbXVzdCBiZSB1cGxvYWRlZFxuICAgKiBhbmQgdGhlbiB3ZSBjYW4gdHJpZ2dlciBhIFwicGFydHM6c2VuZFwiIGV2ZW50IGluZGljYXRpbmcgdGhhdFxuICAgKiB0aGUgcGFydCBpcyByZWFkeSB0byBzZW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZW5kXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQGZpcmVzIHBhcnRzOnNlbmRcbiAgICovXG4gIF9zZW5kKGNsaWVudCkge1xuICAgIC8vIFRoZXJlIGlzIGFscmVhZHkgYSBDb250ZW50IG9iamVjdCwgcHJlc3VtYWJseSB0aGUgZGV2ZWxvcGVyXG4gICAgLy8gYWxyZWFkeSB0b29rIGNhcmUgb2YgdGhpcyBzdGVwIGZvciB1cy5cbiAgICBpZiAodGhpcy5fY29udGVudCkge1xuICAgICAgdGhpcy5fc2VuZFdpdGhDb250ZW50KCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHNpemUgaXMgbGFyZ2UsIENyZWF0ZSBhbmQgdXBsb2FkIHRoZSBDb250ZW50XG4gICAgZWxzZSBpZiAodGhpcy5zaXplID4gMjA0OCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVDb250ZW50QW5kU2VuZChjbGllbnQpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBib2R5IGlzIGEgYmxvYiwgYnV0IGlzIG5vdCBZRVQgUmljaCBDb250ZW50LCBkbyBzb21lIGN1c3RvbSBhbmFseXNpcy9wcm9jZXNzaW5nOlxuICAgIGVsc2UgaWYgKFV0aWwuaXNCbG9iKHRoaXMuYm9keSkpIHtcbiAgICAgIHRoaXMuX3NlbmRCbG9iKGNsaWVudCk7XG4gICAgfVxuXG4gICAgLy8gRWxzZSB0aGUgbWVzc2FnZSBwYXJ0IGNhbiBiZSBzZW50IGFzIGlzLlxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5fc2VuZEJvZHkoKTtcbiAgICB9XG4gIH1cblxuICBfc2VuZEJvZHkoKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmJvZHkgIT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlcnIgPSAnTWVzc2FnZVBhcnQuYm9keSBtdXN0IGJlIGEgc3RyaW5nIGluIG9yZGVyIHRvIHNlbmQgaXQnO1xuICAgICAgbG9nZ2VyLmVycm9yKGVyciwgeyBtaW1lVHlwZTogdGhpcy5taW1lVHlwZSwgYm9keTogdGhpcy5ib2R5IH0pO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycik7XG4gICAgfVxuXG4gICAgY29uc3Qgb2JqID0ge1xuICAgICAgbWltZV90eXBlOiB0aGlzLm1pbWVUeXBlLFxuICAgICAgYm9keTogdGhpcy5ib2R5LFxuICAgIH07XG4gICAgdGhpcy50cmlnZ2VyKCdwYXJ0czpzZW5kJywgb2JqKTtcbiAgfVxuXG4gIF9zZW5kV2l0aENvbnRlbnQoKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdwYXJ0czpzZW5kJywge1xuICAgICAgbWltZV90eXBlOiB0aGlzLm1pbWVUeXBlLFxuICAgICAgY29udGVudDoge1xuICAgICAgICBzaXplOiB0aGlzLnNpemUsXG4gICAgICAgIGlkOiB0aGlzLl9jb250ZW50LmlkLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBvbmx5IGNhbGxlZCBpZiBCbG9iLnNpemUgPCAyMDQ4LlxuICAgKlxuICAgKiBIb3dldmVyLCBjb252ZXJzaW9uIHRvIGJhc2U2NCBjYW4gaW1wYWN0IHRoZSBzaXplLCBzbyB3ZSBtdXN0IHJldGVzdCB0aGUgc2l6ZVxuICAgKiBhZnRlciBjb252ZXJzaW9uLCBhbmQgdGhlbiBkZWNpZGUgdG8gc2VuZCB0aGUgb3JpZ2luYWwgYmxvYiBvciB0aGUgYmFzZTY0IGVuY29kZWQgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZEJsb2JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKi9cbiAgX3NlbmRCbG9iKGNsaWVudCkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgVXRpbC5ibG9iVG9CYXNlNjQodGhpcy5ib2R5LCAoYmFzZTY0ZGF0YSkgPT4ge1xuICAgICAgaWYgKGJhc2U2NGRhdGEubGVuZ3RoIDwgMjA0OCkge1xuICAgICAgICBjb25zdCBib2R5ID0gYmFzZTY0ZGF0YS5zdWJzdHJpbmcoYmFzZTY0ZGF0YS5pbmRleE9mKCcsJykgKyAxKTtcbiAgICAgICAgY29uc3Qgb2JqID0ge1xuICAgICAgICAgIGJvZHksXG4gICAgICAgICAgbWltZV90eXBlOiB0aGlzLm1pbWVUeXBlLFxuICAgICAgICB9O1xuICAgICAgICBvYmouZW5jb2RpbmcgPSAnYmFzZTY0JztcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdwYXJ0czpzZW5kJywgb2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2dlbmVyYXRlQ29udGVudEFuZFNlbmQoY2xpZW50KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW4gcmljaCBDb250ZW50IG9iamVjdCBvbiB0aGUgc2VydmVyXG4gICAqIGFuZCB0aGVuIGNhbGwgX3Byb2Nlc3NDb250ZW50UmVzcG9uc2VcbiAgICpcbiAgICogQG1ldGhvZCBfZ2VuZXJhdGVDb250ZW50QW5kU2VuZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKi9cbiAgX2dlbmVyYXRlQ29udGVudEFuZFNlbmQoY2xpZW50KSB7XG4gICAgdGhpcy5oYXNDb250ZW50ID0gdHJ1ZTtcbiAgICBsZXQgYm9keTtcbiAgICBpZiAoIVV0aWwuaXNCbG9iKHRoaXMuYm9keSkpIHtcbiAgICAgIGJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYihVdGlsLnV0b2EodGhpcy5ib2R5KSwgdGhpcy5taW1lVHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLmJvZHk7XG4gICAgfVxuICAgIGNsaWVudC54aHIoe1xuICAgICAgdXJsOiAnL2NvbnRlbnQnLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdVcGxvYWQtQ29udGVudC1UeXBlJzogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgJ1VwbG9hZC1Db250ZW50LUxlbmd0aCc6IGJvZHkuc2l6ZSxcbiAgICAgICAgJ1VwbG9hZC1PcmlnaW4nOiB0eXBlb2YgbG9jYXRpb24gIT09ICd1bmRlZmluZWQnID8gbG9jYXRpb24ub3JpZ2luIDogJycsXG4gICAgICB9LFxuICAgICAgc3luYzoge30sXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX3Byb2Nlc3NDb250ZW50UmVzcG9uc2UocmVzdWx0LmRhdGEsIGJvZHksIGNsaWVudCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXllci5Db250ZW50IG9iamVjdCBmcm9tIHRoZSBzZXJ2ZXInc1xuICAgKiBDb250ZW50IG9iamVjdCwgYW5kIHRoZW4gdXBsb2FkcyB0aGUgZGF0YSB0byBnb29nbGUgY2xvdWQgc3RvcmFnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3BvbnNlXG4gICAqIEBwYXJhbSAge0Jsb2J9IGJvZHlcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtyZXRyeUNvdW50PTBdXG4gICAqL1xuICBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZShyZXNwb25zZSwgYm9keSwgY2xpZW50LCByZXRyeUNvdW50ID0gMCkge1xuICAgIHRoaXMuX2NvbnRlbnQgPSBuZXcgQ29udGVudChyZXNwb25zZS5pZCk7XG4gICAgdGhpcy5oYXNDb250ZW50ID0gdHJ1ZTtcbiAgICB4aHIoe1xuICAgICAgdXJsOiByZXNwb25zZS51cGxvYWRfdXJsLFxuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIGRhdGE6IGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdVcGxvYWQtQ29udGVudC1MZW5ndGgnOiB0aGlzLnNpemUsXG4gICAgICAgICdVcGxvYWQtQ29udGVudC1UeXBlJzogdGhpcy5taW1lVHlwZSxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UocmVzdWx0LCByZXNwb25zZSwgY2xpZW50LCBib2R5LCByZXRyeUNvdW50KSk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgcmVzcG9uc2UgdG8gdXBsb2FkaW5nIHRoZSBjb250ZW50IHRvIGdvb2dsZSBjbG91ZCBzdG9yYWdlLlxuICAgKlxuICAgKiBSZXN1bHQgaXMgZWl0aGVyOlxuICAgKlxuICAgKiAxLiB0cmlnZ2VyIGBwYXJ0czpzZW5kYCBvbiBzdWNjZXNzXG4gICAqIDIuIGNhbGwgYF9wcm9jZXNzQ29udGVudFJlc3BvbnNlYCB0byByZXRyeVxuICAgKiAzLiB0cmlnZ2VyIGBtZXNzYWdlczpzZW50LWVycm9yYCBpZiByZXRyaWVzIGhhdmUgZmFpbGVkXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSB1cGxvYWRSZXN1bHQgICAgUmVzcG9uc2UgZnJvbSBnb29nbGUgY2xvdWQgc2VydmVyOyBub3RlIHRoYXQgdGhlIHhociBtZXRob2QgYXNzdW1lcyBzb21lIGxheWVyLWxpa2UgYmVoYXZpb3JzIGFuZCBtYXkgcmVwbGFjZSBub24tanNvbiByZXNwb25zZXMgd2l0aCBqcyBvYmplY3RzLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnRlbnRSZXNwb25zZSBSZXNwb25zZSB0byBgUE9TVCAvY29udGVudGAgZnJvbSBiZWZvcmVcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtICB7QmxvYn0gYm9keVxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IHJldHJ5Q291bnRcbiAgICovXG4gIF9wcm9jZXNzQ29udGVudFVwbG9hZFJlc3BvbnNlKHVwbG9hZFJlc3VsdCwgY29udGVudFJlc3BvbnNlLCBjbGllbnQsIGJvZHksIHJldHJ5Q291bnQpIHtcbiAgICBpZiAoIXVwbG9hZFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICBpZiAoIWNsaWVudC5vbmxpbmVNYW5hZ2VyLmlzT25saW5lKSB7XG4gICAgICAgIGNsaWVudC5vbmxpbmVNYW5hZ2VyLm9uY2UoJ2Nvbm5lY3RlZCcsIHRoaXMuX3Byb2Nlc3NDb250ZW50UmVzcG9uc2UuYmluZCh0aGlzLCBjb250ZW50UmVzcG9uc2UsIGNsaWVudCksIHRoaXMpO1xuICAgICAgfSBlbHNlIGlmIChyZXRyeUNvdW50IDwgTWVzc2FnZVBhcnQuTWF4UmljaENvbnRlbnRSZXRyeUNvdW50KSB7XG4gICAgICAgIHRoaXMuX3Byb2Nlc3NDb250ZW50UmVzcG9uc2UoY29udGVudFJlc3BvbnNlLCBib2R5LCBjbGllbnQsIHJldHJ5Q291bnQgKyAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHVwbG9hZCByaWNoIGNvbnRlbnQ7IHRyaWdnZXJpbmcgbWVzc2FnZTpzZW50LWVycm9yIGV2ZW50OyBzdGF0dXMgb2YgJywgdXBsb2FkUmVzdWx0LnN0YXR1cywgdGhpcyk7XG4gICAgICAgIHRoaXMuX2dldE1lc3NhZ2UoKS50cmlnZ2VyKCdtZXNzYWdlczpzZW50LWVycm9yJywge1xuICAgICAgICAgIGVycm9yOiBuZXcgTGF5ZXJFcnJvcih7XG4gICAgICAgICAgICBtZXNzYWdlOiAnVXBsb2FkIG9mIHJpY2ggY29udGVudCBmYWlsZWQnLFxuICAgICAgICAgICAgaHR0cFN0YXR1czogdXBsb2FkUmVzdWx0LnN0YXR1cyxcbiAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICBkYXRhOiB1cGxvYWRSZXN1bHQueGhyLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHBhcnQ6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCB7XG4gICAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHNpemU6IHRoaXMuc2l6ZSxcbiAgICAgICAgICBpZDogdGhpcy5fY29udGVudC5pZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB0ZXh0IGZvciBhbnkgdGV4dC9wbGFpbiBwYXJ0LlxuICAgKlxuICAgKiBSZXR1cm5zICcnIGlmIGl0cyBub3QgYSB0ZXh0L3BsYWluIHBhcnQuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0VGV4dFxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KCkge1xuICAgIGlmICh0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmJvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgTWVzc2FnZVBhcnQgd2l0aCBuZXcgZGF0YSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSwgTWVzc2FnZVBhcnQgcHJvcGVydGllcyBkbyBub3QgdXBkYXRlLi4uIGhvd2V2ZXIsXG4gICAqIHRoZSBsYXllci5Db250ZW50IG9iamVjdCB0aGF0IFJpY2ggQ29udGVudCBNZXNzYWdlUGFydHMgY29udGFpblxuICAgKiBkbyBnZXQgdXBkYXRlZCB3aXRoIHJlZnJlc2hlZCBleHBpcmluZyB1cmxzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwYXJ0IC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIGEgcGFydFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgaWYgKHBhcnQuY29udGVudCAmJiB0aGlzLl9jb250ZW50KSB7XG4gICAgICB0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsID0gcGFydC5jb250ZW50LmRvd25sb2FkX3VybDtcbiAgICAgIHRoaXMuX2NvbnRlbnQuZXhwaXJhdGlvbiA9IG5ldyBEYXRlKHBhcnQuY29udGVudC5leHBpcmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIG1pbWVUeXBlIGZvciB0aGlzIE1lc3NhZ2VQYXJ0IGRlZmluZWQgYXMgdGV4dHVhbCBjb250ZW50P1xuICAgKlxuICAgKiBJZiB0aGUgYW5zd2VyIGlzIHRydWUsIGV4cGVjdCBhIGBib2R5YCBvZiBzdHJpbmcsIGVsc2UgZXhwZWN0IGBib2R5YCBvZiBCbG9iLlxuICAgKlxuICAgKiBUbyBjaGFuZ2Ugd2hldGhlciBhIGdpdmVuIE1JTUUgVHlwZSBpcyB0cmVhdGVkIGFzIHRleHR1YWwsIHNlZSBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzVGV4dHVhbE1pbWVUeXBlXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNUZXh0dWFsTWltZVR5cGUoKSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBNZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZXN0ID0gTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgdGVzdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKHRlc3QgPT09IHRoaXMubWltZVR5cGUpIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0ZXN0IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIGlmICh0aGlzLm1pbWVUeXBlLm1hdGNoKHRlc3QpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGFueSB0aW1lIHRoZSBib2R5IGlzIGNoYW5nZWQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBpdCBpcyBub3QgY2FsbGVkIGR1cmluZyBpbml0aWFsaXphdGlvbi4gIEFueSBkZXZlbG9wZXIgd2hvIGRvZXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBwYXJ0LmJvZHkgPSBcIkhpXCI7XG4gICAqIGBgYFxuICAgKlxuICAgKiBjYW4gZXhwZWN0IHRoaXMgdG8gdHJpZ2dlciBhIGNoYW5nZSBldmVudCwgd2hpY2ggd2lsbCBpbiB0dXJuIHRyaWdnZXIgYSBgbWVzc2FnZXM6Y2hhbmdlYCBldmVudCBvbiB0aGUgbGF5ZXIuTWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZUJvZHlcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVCb2R5KG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXBhcnRzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnYm9keScsXG4gICAgICBuZXdWYWx1ZSxcbiAgICAgIG9sZFZhbHVlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGFueSB0aW1lIHRoZSBtaW1lVHlwZSBpcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgaXQgaXMgbm90IGNhbGxlZCBkdXJpbmcgaW5pdGlhbGl6YXRpb24uICBBbnkgZGV2ZWxvcGVyIHdobyBkb2VzOlxuICAgKlxuICAgKiBgYGBcbiAgICogcGFydC5taW1lVHlwZSA9IFwidGV4dC9tb3VudGFpblwiO1xuICAgKiBgYGBcbiAgICpcbiAgICogY2FuIGV4cGVjdCB0aGlzIHRvIHRyaWdnZXIgYSBjaGFuZ2UgZXZlbnQsIHdoaWNoIHdpbGwgaW4gdHVybiB0cmlnZ2VyIGEgYG1lc3NhZ2VzOmNoYW5nZWAgZXZlbnQgb24gdGhlIGxheWVyLk1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVNaW1lVHlwZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmV3VmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9sZFZhbHVlXG4gICAqL1xuICBfX3VwZGF0ZU1pbWVUeXBlKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXBhcnRzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnbWltZVR5cGUnLFxuICAgICAgbmV3VmFsdWUsXG4gICAgICBvbGRWYWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgTWVzc2FnZVBhcnQgZnJvbSBhIHNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgcGFydFxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVGcm9tU2VydmVyXG4gICAqIEBwcml2YXRlXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwYXJ0IC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIGEgcGFydFxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKHBhcnQpIHtcbiAgICBjb25zdCBjb250ZW50ID0gKHBhcnQuY29udGVudCkgPyBDb250ZW50Ll9jcmVhdGVGcm9tU2VydmVyKHBhcnQuY29udGVudCkgOiBudWxsO1xuXG4gICAgLy8gVHVybiBiYXNlNjQgZGF0YSBpbnRvIGEgQmxvYlxuICAgIGlmIChwYXJ0LmVuY29kaW5nID09PSAnYmFzZTY0JykgcGFydC5ib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IocGFydC5ib2R5LCBwYXJ0Lm1pbWVUeXBlKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgTWVzc2FnZVBhcnRcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2VQYXJ0KHtcbiAgICAgIGlkOiBwYXJ0LmlkLFxuICAgICAgbWltZVR5cGU6IHBhcnQubWltZV90eXBlLFxuICAgICAgYm9keTogcGFydC5ib2R5IHx8ICcnLFxuICAgICAgX2NvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICBoYXNDb250ZW50OiBCb29sZWFuKGNvbnRlbnQpLFxuICAgICAgc2l6ZTogcGFydC5zaXplIHx8IDAsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBsYXllci5DbGllbnQgdGhhdCB0aGUgY29udmVyc2F0aW9uIGJlbG9uZ3MgdG8uXG4gKlxuICogQWN0dWFsIHZhbHVlIG9mIHRoaXMgc3RyaW5nIG1hdGNoZXMgdGhlIGFwcElkLlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmNsaWVudElkID0gJyc7XG5cbi8qKlxuICogU2VydmVyIGdlbmVyYXRlZCBpZGVudGlmaWVyIGZvciB0aGUgcGFydFxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmlkID0gJyc7XG5cbi8qKlxuICogQm9keSBvZiB5b3VyIG1lc3NhZ2UgcGFydC5cbiAqXG4gKiBUaGlzIGlzIHRoZSBjb3JlIGRhdGEgb2YgeW91ciBwYXJ0LlxuICpcbiAqIElmIHRoaXMgaXMgYG51bGxgIHRoZW4gbW9zdCBsaWtlbHkgbGF5ZXIuTWVzc2FnZS5oYXNDb250ZW50IGlzIHRydWUsIGFuZCB5b3VcbiAqIGNhbiBlaXRoZXIgdXNlIHRoZSBsYXllci5NZXNzYWdlUGFydC51cmwgcHJvcGVydHkgb3IgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LmZldGNoQ29udGVudCBtZXRob2QuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmJvZHkgPSBudWxsO1xuXG4vKipcbiAqIFJpY2ggY29udGVudCBvYmplY3QuXG4gKlxuICogVGhpcyB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgY3JlYXRlZCBmb3IgeW91IGlmIHlvdXIgbGF5ZXIuTWVzc2FnZVBhcnQuYm9keVxuICogaXMgbGFyZ2UuXG4gKiBAdHlwZSB7bGF5ZXIuQ29udGVudH1cbiAqIEBwcml2YXRlXG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5fY29udGVudCA9IG51bGw7XG5cbi8qKlxuICogVGhlIFBhcnQgaGFzIHJpY2ggY29udGVudFxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5oYXNDb250ZW50ID0gZmFsc2U7XG5cbi8qKlxuICogVVJMIHRvIHJpY2ggY29udGVudCBvYmplY3QuXG4gKlxuICogUGFydHMgd2l0aCByaWNoIGNvbnRlbnQgd2lsbCBiZSBpbml0aWFsaXplZCB3aXRoIHRoaXMgcHJvcGVydHkgc2V0LiAgQnV0IGl0cyB2YWx1ZSB3aWxsIGV4cGlyZS5cbiAqXG4gKiBXaWxsIGNvbnRhaW4gYW4gZXhwaXJpbmcgdXJsIGF0IGluaXRpYWxpemF0aW9uIHRpbWUgYW5kIGJlIHJlZnJlc2hlZCB3aXRoIGNhbGxzIHRvIGBsYXllci5NZXNzYWdlUGFydC5mZXRjaFN0cmVhbSgpYC5cbiAqIFdpbGwgY29udGFpbiBhIG5vbi1leHBpcmluZyB1cmwgdG8gYSBsb2NhbCByZXNvdXJjZSBpZiBgbGF5ZXIuTWVzc2FnZVBhcnQuZmV0Y2hDb250ZW50KClgIGlzIGNhbGxlZC5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuQ29udGVudH1cbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1lc3NhZ2VQYXJ0LnByb3RvdHlwZSwgJ3VybCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgLy8gSXRzIHBvc3NpYmxlIHRvIGhhdmUgYSB1cmwgYW5kIG5vIGNvbnRlbnQgaWYgaXQgaGFzIGJlZW4gaW5zdGFudGlhdGVkIGJ1dCBub3QgeWV0IHNlbnQuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSBfX3VybCB0aGVuIGl0cyBhIGxvY2FsIHVybCBnZW5lcmF0ZWQgZnJvbSB0aGUgYm9keSBwcm9wZXJ0eSBhbmQgZG9lcyBub3QgZXhwaXJlLlxuICAgIGlmICh0aGlzLl9fdXJsKSByZXR1cm4gdGhpcy5fX3VybDtcbiAgICBpZiAodGhpcy5fY29udGVudCkgcmV0dXJuIHRoaXMuX2NvbnRlbnQuaXNFeHBpcmVkKCkgPyAnJyA6IHRoaXMuX2NvbnRlbnQuZG93bmxvYWRVcmw7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uIHNldChpblZhbHVlKSB7XG4gICAgdGhpcy5fX3VybCA9IGluVmFsdWU7XG4gIH0sXG59KTtcblxuLyoqXG4gKiBNaW1lIFR5cGUgZm9yIHRoZSBkYXRhIHJlcHJlc2VudGVkIGJ5IHRoZSBNZXNzYWdlUGFydC5cbiAqXG4gKiBUeXBpY2FsbHkgdGhpcyBpcyB0aGUgdHlwZSBmb3IgdGhlIGRhdGEgaW4gbGF5ZXIuTWVzc2FnZVBhcnQuYm9keTtcbiAqIGlmIHRoZXJlIGlzIFJpY2ggQ29udGVudCwgdGhlbiBpdHMgdGhlIHR5cGUgb2YgQ29udGVudCB0aGF0IG5lZWRzIHRvIGJlXG4gKiBkb3dubG9hZGVkLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5taW1lVHlwZSA9ICd0ZXh0L3BsYWluJztcblxuLyoqXG4gKiBTaXplIG9mIHRoZSBsYXllci5NZXNzYWdlUGFydC5ib2R5LlxuICpcbiAqIFdpbGwgYmUgc2V0IGZvciB5b3UgaWYgbm90IHByb3ZpZGVkLlxuICogT25seSBuZWVkZWQgZm9yIHVzZSB3aXRoIHJpY2ggY29udGVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuc2l6ZSA9IDA7XG5cbi8qKlxuICogQXJyYXkgb2YgbWltZSB0eXBlcyB0aGF0IHNob3VsZCBiZSB0cmVhdGVkIGFzIHRleHQuXG4gKlxuICogVHJlYXRpbmcgYSBNZXNzYWdlUGFydCBhcyB0ZXh0IG1lYW5zIHRoYXQgZXZlbiBpZiB0aGUgYGJvZHlgIGdldHMgYSBGaWxlIG9yIEJsb2IsXG4gKiBpdCB3aWxsIGJlIHRyYW5zZm9ybWVkIHRvIGEgc3RyaW5nIGJlZm9yZSBiZWluZyBkZWxpdmVyZWQgdG8geW91ciBhcHAuXG4gKlxuICogVGhpcyB2YWx1ZSBjYW4gYmUgY3VzdG9taXplZCB1c2luZyBzdHJpbmdzIGFuZCByZWd1bGFyIGV4cHJlc3Npb25zOlxuICpcbiAqIGBgYFxuICogbGF5ZXIuTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlcyA9IFsndGV4dC9wbGFpbicsICd0ZXh0L21vdW50YWluJywgL15hcHBsaWNhdGlvblxcL2pzb24oXFwrLispJC9dXG4gKiBgYGBcbiAqXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7TWl4ZWRbXX1cbiAqL1xuTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlcyA9IFsvXnRleHRcXC8uKyQvLCAvXmFwcGxpY2F0aW9uXFwvanNvbihcXCsuKyk/JC9dO1xuXG4vKipcbiAqIE51bWJlciBvZiByZXRyeSBhdHRlbXB0cyB0byBtYWtlIGJlZm9yZSBnaXZpbmcgdXAgb24gdXBsb2FkaW5nIFJpY2ggQ29udGVudCB0byBHb29nbGUgQ2xvdWQgU3RvcmFnZS5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5NZXNzYWdlUGFydC5NYXhSaWNoQ29udGVudFJldHJ5Q291bnQgPSAzO1xuXG5NZXNzYWdlUGFydC5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAncGFydHM6c2VuZCcsXG4gICdjb250ZW50LWxvYWRlZCcsXG4gICd1cmwtbG9hZGVkJyxcbiAgJ2NvbnRlbnQtbG9hZGVkLWVycm9yJyxcbiAgJ21lc3NhZ2VwYXJ0czpjaGFuZ2UnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KE1lc3NhZ2VQYXJ0LCBbTWVzc2FnZVBhcnQsICdNZXNzYWdlUGFydCddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlUGFydDtcbiJdfQ==
