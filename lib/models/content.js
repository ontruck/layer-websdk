'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Content class represents Rich Content.
 *
 * Note that instances of this class will automatically be
 * generated for developers based on whether their message parts
 * require it.
 *
 * That means for the most part, you should never need to
 * instantiate one of these directly.
 *
 *      var content = new layer.Content({
 *          id: 'layer:///content/8c839735-5f95-439a-a867-30903c0133f2'
 *      });
 *
 * @class  layer.Content
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 */

var Root = require('../root');
var xhr = require('../xhr');

var Content = function (_Root) {
  _inherits(Content, _Root);

  /**
   * Constructor
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.id - Identifier for the content
   * @param  {string} [options.downloadUrl=null] - Url to download the content from
   * @param  {Date} [options.expiration] - Expiration date for the url
   * @param  {string} [options.refreshUrl] - Url to access to get a new downloadUrl after it has expired
   *
   * @return {layer.Content}
   */
  function Content(options) {
    _classCallCheck(this, Content);

    if (typeof options === 'string') {
      options = { id: options };
    }
    return _possibleConstructorReturn(this, (Content.__proto__ || Object.getPrototypeOf(Content)).call(this, options));
  }

  /**
   * Loads the data from google's cloud storage.
   *
   * Data is provided via callback.
   *
   * Note that typically one should use layer.MessagePart.fetchContent() rather than layer.Content.loadContent()
   *
   * @method loadContent
   * @param {string} mimeType - Mime type for the Blob
   * @param {Function} callback
   * @param {Blob} callback.data - A Blob instance representing the data downloaded.  If Blob object is not available, then may use other format.
   */


  _createClass(Content, [{
    key: 'loadContent',
    value: function loadContent(mimeType, callback) {
      xhr({
        url: this.downloadUrl,
        responseType: 'arraybuffer'
      }, function (result) {
        if (result.success) {
          if (typeof Blob !== 'undefined') {
            var blob = new Blob([result.data], { type: mimeType });
            callback(null, blob);
          } else {
            // If the blob class isn't defined (nodejs) then just return the result as is
            callback(null, result.data);
          }
        } else {
          callback(result.data, null);
        }
      });
    }

    /**
     * Refreshes the URL, which updates the URL and resets the expiration time for the URL
     *
     * @method refreshContent
     * @param {layer.Client} client
     * @param {Function} [callback]
     */

  }, {
    key: 'refreshContent',
    value: function refreshContent(client, callback) {
      var _this2 = this;

      client.xhr({
        url: this.refreshUrl,
        method: 'GET',
        sync: false
      }, function (result) {
        var data = result.data;

        _this2.expiration = new Date(data.expiration);
        _this2.downloadUrl = data.download_url;
        if (callback) callback(_this2.downloadUrl);
      });
    }

    /**
     * Is the download url expired or about to expire?
     * We can't be sure of the state of the device's internal clock,
     * so if its within 10 minutes of expiring, just treat it as expired.
     *
     * @method isExpired
     * @returns {Boolean}
     */

  }, {
    key: 'isExpired',
    value: function isExpired() {
      var expirationLeeway = 10 * 60 * 1000;
      return this.expiration.getTime() - expirationLeeway < Date.now();
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
      return new Content({
        id: part.id,
        downloadUrl: part.download_url,
        expiration: new Date(part.expiration),
        refreshUrl: part.refresh_url
      });
    }
  }]);

  return Content;
}(Root);

/**
 * Server generated identifier
 * @type {string}
 */


Content.prototype.id = '';

Content.prototype.blob = null;

/**
 * Server generated url for downloading the content
 * @type {string}
 */
Content.prototype.downloadUrl = '';

/**
 * Url for refreshing the downloadUrl after it has expired
 * @type {string}
 */
Content.prototype.refreshUrl = '';

/**
 * Size of the content.
 *
 * This property only has a value when in the process
 * of Creating the rich content and sending the Message.
 *
 * @type {number}
 */
Content.prototype.size = 0;

/**
 * Expiration date for the downloadUrl
 * @type {Date}
 */
Content.prototype.expiration = null;

Root.initClass.apply(Content, [Content, 'Content']);
module.exports = Content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tb2RlbHMvY29udGVudC5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsInhociIsIkNvbnRlbnQiLCJvcHRpb25zIiwiaWQiLCJtaW1lVHlwZSIsImNhbGxiYWNrIiwidXJsIiwiZG93bmxvYWRVcmwiLCJyZXNwb25zZVR5cGUiLCJyZXN1bHQiLCJzdWNjZXNzIiwiQmxvYiIsImJsb2IiLCJkYXRhIiwidHlwZSIsImNsaWVudCIsInJlZnJlc2hVcmwiLCJtZXRob2QiLCJzeW5jIiwiZXhwaXJhdGlvbiIsIkRhdGUiLCJkb3dubG9hZF91cmwiLCJleHBpcmF0aW9uTGVld2F5IiwiZ2V0VGltZSIsIm5vdyIsInBhcnQiLCJyZWZyZXNoX3VybCIsInByb3RvdHlwZSIsInNpemUiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsSUFBTUEsT0FBT0MsUUFBUSxTQUFSLENBQWI7QUFDQSxJQUFNQyxNQUFNRCxRQUFRLFFBQVIsQ0FBWjs7SUFFTUUsTzs7O0FBRUo7Ozs7Ozs7Ozs7OztBQVlBLG1CQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFFBQUksT0FBT0EsT0FBUCxLQUFtQixRQUF2QixFQUFpQztBQUMvQkEsZ0JBQVUsRUFBRUMsSUFBSUQsT0FBTixFQUFWO0FBQ0Q7QUFIa0IsNkdBSWJBLE9BSmE7QUFLcEI7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Z0NBWVlFLFEsRUFBVUMsUSxFQUFVO0FBQzlCTCxVQUFJO0FBQ0ZNLGFBQUssS0FBS0MsV0FEUjtBQUVGQyxzQkFBYztBQUZaLE9BQUosRUFHRyxVQUFDQyxNQUFELEVBQVk7QUFDYixZQUFJQSxPQUFPQyxPQUFYLEVBQW9CO0FBQ2xCLGNBQUksT0FBT0MsSUFBUCxLQUFnQixXQUFwQixFQUFpQztBQUMvQixnQkFBTUMsT0FBTyxJQUFJRCxJQUFKLENBQVMsQ0FBQ0YsT0FBT0ksSUFBUixDQUFULEVBQXdCLEVBQUVDLE1BQU1WLFFBQVIsRUFBeEIsQ0FBYjtBQUNBQyxxQkFBUyxJQUFULEVBQWVPLElBQWY7QUFDRCxXQUhELE1BR087QUFDTDtBQUNBUCxxQkFBUyxJQUFULEVBQWVJLE9BQU9JLElBQXRCO0FBQ0Q7QUFDRixTQVJELE1BUU87QUFDTFIsbUJBQVNJLE9BQU9JLElBQWhCLEVBQXNCLElBQXRCO0FBQ0Q7QUFDRixPQWZEO0FBZ0JEOztBQUVEOzs7Ozs7Ozs7O21DQU9lRSxNLEVBQVFWLFEsRUFBVTtBQUFBOztBQUMvQlUsYUFBT2YsR0FBUCxDQUFXO0FBQ1RNLGFBQUssS0FBS1UsVUFERDtBQUVUQyxnQkFBUSxLQUZDO0FBR1RDLGNBQU07QUFIRyxPQUFYLEVBSUcsVUFBQ1QsTUFBRCxFQUFZO0FBQUEsWUFDTEksSUFESyxHQUNJSixNQURKLENBQ0xJLElBREs7O0FBRWIsZUFBS00sVUFBTCxHQUFrQixJQUFJQyxJQUFKLENBQVNQLEtBQUtNLFVBQWQsQ0FBbEI7QUFDQSxlQUFLWixXQUFMLEdBQW1CTSxLQUFLUSxZQUF4QjtBQUNBLFlBQUloQixRQUFKLEVBQWNBLFNBQVMsT0FBS0UsV0FBZDtBQUNmLE9BVEQ7QUFVRDs7QUFFRDs7Ozs7Ozs7Ozs7Z0NBUVk7QUFDVixVQUFNZSxtQkFBbUIsS0FBSyxFQUFMLEdBQVUsSUFBbkM7QUFDQSxhQUFRLEtBQUtILFVBQUwsQ0FBZ0JJLE9BQWhCLEtBQTRCRCxnQkFBNUIsR0FBK0NGLEtBQUtJLEdBQUwsRUFBdkQ7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7c0NBUXlCQyxJLEVBQU07QUFDN0IsYUFBTyxJQUFJeEIsT0FBSixDQUFZO0FBQ2pCRSxZQUFJc0IsS0FBS3RCLEVBRFE7QUFFakJJLHFCQUFha0IsS0FBS0osWUFGRDtBQUdqQkYsb0JBQVksSUFBSUMsSUFBSixDQUFTSyxLQUFLTixVQUFkLENBSEs7QUFJakJILG9CQUFZUyxLQUFLQztBQUpBLE9BQVosQ0FBUDtBQU1EOzs7O0VBcEdtQjVCLEk7O0FBdUd0Qjs7Ozs7O0FBSUFHLFFBQVEwQixTQUFSLENBQWtCeEIsRUFBbEIsR0FBdUIsRUFBdkI7O0FBRUFGLFFBQVEwQixTQUFSLENBQWtCZixJQUFsQixHQUF5QixJQUF6Qjs7QUFFQTs7OztBQUlBWCxRQUFRMEIsU0FBUixDQUFrQnBCLFdBQWxCLEdBQWdDLEVBQWhDOztBQUVBOzs7O0FBSUFOLFFBQVEwQixTQUFSLENBQWtCWCxVQUFsQixHQUErQixFQUEvQjs7QUFFQTs7Ozs7Ozs7QUFRQWYsUUFBUTBCLFNBQVIsQ0FBa0JDLElBQWxCLEdBQXlCLENBQXpCOztBQUVBOzs7O0FBSUEzQixRQUFRMEIsU0FBUixDQUFrQlIsVUFBbEIsR0FBK0IsSUFBL0I7O0FBRUFyQixLQUFLK0IsU0FBTCxDQUFlQyxLQUFmLENBQXFCN0IsT0FBckIsRUFBOEIsQ0FBQ0EsT0FBRCxFQUFVLFNBQVYsQ0FBOUI7QUFDQThCLE9BQU9DLE9BQVAsR0FBaUIvQixPQUFqQiIsImZpbGUiOiJjb250ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgQ29udGVudCBjbGFzcyByZXByZXNlbnRzIFJpY2ggQ29udGVudC5cbiAqXG4gKiBOb3RlIHRoYXQgaW5zdGFuY2VzIG9mIHRoaXMgY2xhc3Mgd2lsbCBhdXRvbWF0aWNhbGx5IGJlXG4gKiBnZW5lcmF0ZWQgZm9yIGRldmVsb3BlcnMgYmFzZWQgb24gd2hldGhlciB0aGVpciBtZXNzYWdlIHBhcnRzXG4gKiByZXF1aXJlIGl0LlxuICpcbiAqIFRoYXQgbWVhbnMgZm9yIHRoZSBtb3N0IHBhcnQsIHlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0b1xuICogaW5zdGFudGlhdGUgb25lIG9mIHRoZXNlIGRpcmVjdGx5LlxuICpcbiAqICAgICAgdmFyIGNvbnRlbnQgPSBuZXcgbGF5ZXIuQ29udGVudCh7XG4gKiAgICAgICAgICBpZDogJ2xheWVyOi8vL2NvbnRlbnQvOGM4Mzk3MzUtNWY5NS00MzlhLWE4NjctMzA5MDNjMDEzM2YyJ1xuICogICAgICB9KTtcbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNvbnRlbnRcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKi9cblxuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IHhociA9IHJlcXVpcmUoJy4uL3hocicpO1xuXG5jbGFzcyBDb250ZW50IGV4dGVuZHMgUm9vdCB7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy5pZCAtIElkZW50aWZpZXIgZm9yIHRoZSBjb250ZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMuZG93bmxvYWRVcmw9bnVsbF0gLSBVcmwgdG8gZG93bmxvYWQgdGhlIGNvbnRlbnQgZnJvbVxuICAgKiBAcGFyYW0gIHtEYXRlfSBbb3B0aW9ucy5leHBpcmF0aW9uXSAtIEV4cGlyYXRpb24gZGF0ZSBmb3IgdGhlIHVybFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IFtvcHRpb25zLnJlZnJlc2hVcmxdIC0gVXJsIHRvIGFjY2VzcyB0byBnZXQgYSBuZXcgZG93bmxvYWRVcmwgYWZ0ZXIgaXQgaGFzIGV4cGlyZWRcbiAgICpcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udGVudH1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRpb25zID0geyBpZDogb3B0aW9ucyB9O1xuICAgIH1cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkcyB0aGUgZGF0YSBmcm9tIGdvb2dsZSdzIGNsb3VkIHN0b3JhZ2UuXG4gICAqXG4gICAqIERhdGEgaXMgcHJvdmlkZWQgdmlhIGNhbGxiYWNrLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdHlwaWNhbGx5IG9uZSBzaG91bGQgdXNlIGxheWVyLk1lc3NhZ2VQYXJ0LmZldGNoQ29udGVudCgpIHJhdGhlciB0aGFuIGxheWVyLkNvbnRlbnQubG9hZENvbnRlbnQoKVxuICAgKlxuICAgKiBAbWV0aG9kIGxvYWRDb250ZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBtaW1lVHlwZSAtIE1pbWUgdHlwZSBmb3IgdGhlIEJsb2JcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtCbG9ifSBjYWxsYmFjay5kYXRhIC0gQSBCbG9iIGluc3RhbmNlIHJlcHJlc2VudGluZyB0aGUgZGF0YSBkb3dubG9hZGVkLiAgSWYgQmxvYiBvYmplY3QgaXMgbm90IGF2YWlsYWJsZSwgdGhlbiBtYXkgdXNlIG90aGVyIGZvcm1hdC5cbiAgICovXG4gIGxvYWRDb250ZW50KG1pbWVUeXBlLCBjYWxsYmFjaykge1xuICAgIHhocih7XG4gICAgICB1cmw6IHRoaXMuZG93bmxvYWRVcmwsXG4gICAgICByZXNwb25zZVR5cGU6ICdhcnJheWJ1ZmZlcicsXG4gICAgfSwgKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3Jlc3VsdC5kYXRhXSwgeyB0eXBlOiBtaW1lVHlwZSB9KTtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCBibG9iKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBJZiB0aGUgYmxvYiBjbGFzcyBpc24ndCBkZWZpbmVkIChub2RlanMpIHRoZW4ganVzdCByZXR1cm4gdGhlIHJlc3VsdCBhcyBpc1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0LmRhdGEsIG51bGwpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZnJlc2hlcyB0aGUgVVJMLCB3aGljaCB1cGRhdGVzIHRoZSBVUkwgYW5kIHJlc2V0cyB0aGUgZXhwaXJhdGlvbiB0aW1lIGZvciB0aGUgVVJMXG4gICAqXG4gICAqIEBtZXRob2QgcmVmcmVzaENvbnRlbnRcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICByZWZyZXNoQ29udGVudChjbGllbnQsIGNhbGxiYWNrKSB7XG4gICAgY2xpZW50Lnhocih7XG4gICAgICB1cmw6IHRoaXMucmVmcmVzaFVybCxcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3VsdDtcbiAgICAgIHRoaXMuZXhwaXJhdGlvbiA9IG5ldyBEYXRlKGRhdGEuZXhwaXJhdGlvbik7XG4gICAgICB0aGlzLmRvd25sb2FkVXJsID0gZGF0YS5kb3dubG9hZF91cmw7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHRoaXMuZG93bmxvYWRVcmwpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoZSBkb3dubG9hZCB1cmwgZXhwaXJlZCBvciBhYm91dCB0byBleHBpcmU/XG4gICAqIFdlIGNhbid0IGJlIHN1cmUgb2YgdGhlIHN0YXRlIG9mIHRoZSBkZXZpY2UncyBpbnRlcm5hbCBjbG9jayxcbiAgICogc28gaWYgaXRzIHdpdGhpbiAxMCBtaW51dGVzIG9mIGV4cGlyaW5nLCBqdXN0IHRyZWF0IGl0IGFzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBtZXRob2QgaXNFeHBpcmVkXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNFeHBpcmVkKCkge1xuICAgIGNvbnN0IGV4cGlyYXRpb25MZWV3YXkgPSAxMCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gKHRoaXMuZXhwaXJhdGlvbi5nZXRUaW1lKCkgLSBleHBpcmF0aW9uTGVld2F5IDwgRGF0ZS5ub3coKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIE1lc3NhZ2VQYXJ0IGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIHBhcnRcbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gcGFydCAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIHBhcnRcbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZW50KHtcbiAgICAgIGlkOiBwYXJ0LmlkLFxuICAgICAgZG93bmxvYWRVcmw6IHBhcnQuZG93bmxvYWRfdXJsLFxuICAgICAgZXhwaXJhdGlvbjogbmV3IERhdGUocGFydC5leHBpcmF0aW9uKSxcbiAgICAgIHJlZnJlc2hVcmw6IHBhcnQucmVmcmVzaF91cmwsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJ2ZXIgZ2VuZXJhdGVkIGlkZW50aWZpZXJcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbkNvbnRlbnQucHJvdG90eXBlLmlkID0gJyc7XG5cbkNvbnRlbnQucHJvdG90eXBlLmJsb2IgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZlciBnZW5lcmF0ZWQgdXJsIGZvciBkb3dubG9hZGluZyB0aGUgY29udGVudFxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuQ29udGVudC5wcm90b3R5cGUuZG93bmxvYWRVcmwgPSAnJztcblxuLyoqXG4gKiBVcmwgZm9yIHJlZnJlc2hpbmcgdGhlIGRvd25sb2FkVXJsIGFmdGVyIGl0IGhhcyBleHBpcmVkXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5yZWZyZXNoVXJsID0gJyc7XG5cbi8qKlxuICogU2l6ZSBvZiB0aGUgY29udGVudC5cbiAqXG4gKiBUaGlzIHByb3BlcnR5IG9ubHkgaGFzIGEgdmFsdWUgd2hlbiBpbiB0aGUgcHJvY2Vzc1xuICogb2YgQ3JlYXRpbmcgdGhlIHJpY2ggY29udGVudCBhbmQgc2VuZGluZyB0aGUgTWVzc2FnZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5zaXplID0gMDtcblxuLyoqXG4gKiBFeHBpcmF0aW9uIGRhdGUgZm9yIHRoZSBkb3dubG9hZFVybFxuICogQHR5cGUge0RhdGV9XG4gKi9cbkNvbnRlbnQucHJvdG90eXBlLmV4cGlyYXRpb24gPSBudWxsO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb250ZW50LCBbQ29udGVudCwgJ0NvbnRlbnQnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENvbnRlbnQ7XG4iXX0=
