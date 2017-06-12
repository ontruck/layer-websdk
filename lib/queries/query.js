'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * There are two ways to instantiate this class:
 *
 *      // 1. Using a Query Builder
 *      var conversationQueryBuilder = QueryBuilder.conversations().sortBy('lastMessage');
 *      var conversationQuery = client.createQuery(queryBuilder);
 *      var channelQueryBuilder = QueryBuilder.channels();
 *      var channelQuery = client.createQuery(queryBuilder);
 *
 *      // 2. Passing properties directly
 *      var conversationQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Conversation,
 *        sortBy: [{'createdAt': 'desc'}]
 *      });
 *      var channelQuery = client.createQuery({
 *        client: client,
 *        model: layer.Query.Channel
 *      });
 *
 * You can change the data selected by your query any time you want using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 *      query.update({
 *        predicate: 'conversation.id = "' + conv.id + "'"
 *      });
 *
 *     // Or use the Query Builder:
 *     queryBuilder.paginationWindow(200);
 *     query.update(queryBuilder);
 *
 * You can release data held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### Query Types
 *
 * For documentation on creating each of these types of queries, see the specified Query Subclass:
 *
 * * layer.ConversationsQuery
 * * layer.ChannelsQuery
 * * layer.MessagesQuery
 * * layer.IdentitiesQuery
 * * layer.MembersQuery
 *
 * #### dataType
 *
 * The layer.Query.dataType property lets you specify what type of data shows up in your results:
 *
 * ```javascript
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.InstanceDataType
 * })
 *
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.ObjectDataType
 * })
 * ```
 *
 * The property defaults to layer.Query.InstanceDataType.  Instances support methods and let you subscribe to events for direct notification
 * of changes to any of the results of your query:
 *
* ```javascript
 * query.data[0].on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * A value of layer.Query.ObjectDataType will cause the data to be an array of immutable objects rather than instances.  One can still get an instance from the POJO:
 *
 * ```javascript
 * var m = client.getMessage(query.data[0].id);
 * m.on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * ## Query Events
 *
 * Queries fire events whenever their data changes.  There are 5 types of events;
 * all events are received by subscribing to the `change` event.
 *
 * ### 1. Data Events
 *
 * The Data event is fired whenever a request is sent to the server for new query results.  This could happen when first creating the query, when paging for more data, or when changing the query's properties, resulting in a new request to the server.
 *
 * The Event object will have an `evt.data` array of all newly added results.  But frequently you may just want to use the `query.data` array and get ALL results.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'data') {
 *      var newData = evt.data;
 *      var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:data', function(evt) {}` is also supported.
 *
 * ### 2. Insert Events
 *
 * A new Conversation or Message was created. It may have been created locally by your user, or it may have been remotely created, received via websocket, and added to the Query's results.
 *
 * The layer.LayerEvent.target property contains the newly inserted object.
 *
 * ```javascript
 *  query.on('change', function(evt) {
 *    if (evt.type === 'insert') {
 *       var newItem = evt.target;
 *       var allData = query.data;
 *    }
 *  });
 * ```
 *
 * Note that `query.on('change:insert', function(evt) {}` is also supported.
 *
 * ### 3. Remove Events
 *
 * A Conversation or Message was deleted. This may have been deleted locally by your user, or it may have been remotely deleted, a notification received via websocket, and removed from the Query results.
 *
 * The layer.LayerEvent.target property contains the removed object.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'remove') {
 *       var removedItem = evt.target;
 *       var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:remove', function(evt) {}` is also supported.
 *
 * ### 4. Reset Events
 *
 * Any time your query's model or predicate properties have been changed
 * the query is reset, and a new request is sent to the server.  The reset event informs your UI that the current result set is empty, and that the reason its empty is that it was `reset`.  This helps differentiate it from a `data` event that returns an empty array.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'reset') {
 *       var allData = query.data; // []
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:reset', function(evt) {}` is also supported.
 *
 * ### 5. Property Events
 *
 * If any properties change in any of the objects listed in your layer.Query.data property, a `property` event will be fired.
 *
 * The layer.LayerEvent.target property contains object that was modified.
 *
 * See layer.LayerEvent.changes for details on how changes are reported.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'property') {
 *       var changedItem = evt.target;
 *       var isReadChanges = evt.getChangesFor('isRead');
 *       var recipientStatusChanges = evt.getChangesFor('recipientStatus');
 *       if (isReadChanges.length) {
 *           ...
 *       }
 *
 *       if (recipientStatusChanges.length) {
 *           ...
 *       }
 *   }
 * });
 *```
 * Note that `query.on('change:property', function(evt) {}` is also supported.
 *
 * ### 6. Move Events
 *
 * Occasionally, a property change will cause an item to be sorted differently, causing a Move event.
 * The event will tell you what index the item was at, and where it has moved to in the Query results.
 * This is currently only supported for Conversations.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'move') {
 *       var changedItem = evt.target;
 *       var oldIndex = evt.fromIndex;
 *       var newIndex = evt.newIndex;
 *       var moveNode = list.childNodes[oldIndex];
 *       list.removeChild(moveNode);
 *       list.insertBefore(moveNode, list.childNodes[newIndex]);
 *   }
 * });
 *```
 * Note that `query.on('change:move', function(evt) {}` is also supported.
 *
 * @class  layer.Query
 * @extends layer.Root
 *
 */
var Root = require('../root');
var LayerError = require('../layer-error');
var Logger = require('../logger');
var Utils = require('../client-utils');

var Query = function (_Root) {
  _inherits(Query, _Root);

  function Query() {
    _classCallCheck(this, Query);

    var options = void 0;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 2) {
      options = args[1].build();
      options.client = args[0];
    } else {
      options = args[0];
    }

    var _this = _possibleConstructorReturn(this, (Query.__proto__ || Object.getPrototypeOf(Query)).call(this, options));

    _this.predicate = _this._fixPredicate(options.predicate || '');

    if ('paginationWindow' in options) {
      var paginationWindow = options.paginationWindow;
      _this.paginationWindow = Math.min(_this._getMaxPageSize(), options.paginationWindow);
      if (options.paginationWindow !== paginationWindow) {
        Logger.warn('paginationWindow value ' + paginationWindow + ' in Query constructor ' + ('excedes Query.MaxPageSize of ' + _this._getMaxPageSize()));
      }
    }

    _this.data = [];
    _this._initialPaginationWindow = _this.paginationWindow;
    if (!_this.client) throw new Error(LayerError.dictionary.clientMissing);
    _this.client.on('all', _this._handleEvents, _this);

    if (!_this.client.isReady) {
      _this.client.once('ready', function () {
        return _this._run();
      }, _this);
    } else {
      _this._run();
    }
    return _this;
  }

  /**
   * Cleanup and remove this Query, its subscriptions and data.
   *
   * @method destroy
   */


  _createClass(Query, [{
    key: 'destroy',
    value: function destroy() {
      this.data = [];
      this._triggerChange({
        data: [],
        type: 'reset'
      });
      this.client.off(null, null, this);
      this.client._removeQuery(this);
      this.data = null;
      _get(Query.prototype.__proto__ || Object.getPrototypeOf(Query.prototype), 'destroy', this).call(this);
    }

    /**
     * Get the maximum number of items allowed in a page
     *
     * @method _getMaxPageSize
     * @private
     * @returns {number}
     */

  }, {
    key: '_getMaxPageSize',
    value: function _getMaxPageSize() {
      return this.constructor.MaxPageSize;
    }

    /**
     * Updates properties of the Query.
     *
     * Currently supports updating:
     *
     * * paginationWindow
     * * predicate
     * * sortBy
     *
     * Any change to predicate or model results in clearing all data from the
     * query's results and triggering a change event with [] as the new data.
     *
     * ```
     * query.update({
     *    paginationWindow: 200
     * });
     * ```
     *
     * ```
     * query.update({
     *    paginationWindow: 100,
     *    predicate: 'conversation.id = "layer:///conversations/UUID"'
     * });
     * ```
     *
     * ```
     * query.update({
     *    sortBy: [{"lastMessage.sentAt": "desc"}]
     * });
     * ```
     *
     * @method update
     * @param  {Object} options
     * @param {string} [options.predicate] - A new predicate for the query
     * @param {string} [options.model] - A new model for the Query
     * @param {number} [paginationWindow] - Increase/decrease our result size to match this pagination window.
     * @return {layer.Query} this
     */

  }, {
    key: 'update',
    value: function update() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var needsRefresh = void 0,
          needsRecreate = void 0;

      var optionsBuilt = typeof options.build === 'function' ? options.build() : options;

      if ('paginationWindow' in optionsBuilt && this.paginationWindow !== optionsBuilt.paginationWindow) {
        this.paginationWindow = Math.min(this._getMaxPageSize() + this.size, optionsBuilt.paginationWindow);
        if (this.paginationWindow < optionsBuilt.paginationWindow) {
          Logger.warn('paginationWindow value ' + optionsBuilt.paginationWindow + ' in Query.update() ' + ('increases size greater than Query.MaxPageSize of ' + this._getMaxPageSize()));
        }
        needsRefresh = true;
      }
      if ('model' in optionsBuilt && this.model !== optionsBuilt.model) {
        throw new Error(LayerError.dictionary.modelImmutable);
      }

      if ('predicate' in optionsBuilt) {
        var predicate = this._fixPredicate(optionsBuilt.predicate || '');
        if (this.predicate !== predicate) {
          this.predicate = predicate;
          needsRecreate = true;
        }
      }
      if ('sortBy' in optionsBuilt && JSON.stringify(this.sortBy) !== JSON.stringify(optionsBuilt.sortBy)) {
        this.sortBy = optionsBuilt.sortBy;
        needsRecreate = true;
      }
      if (needsRecreate) {
        this._reset();
      }
      if (needsRecreate || needsRefresh) this._run();
      return this;
    }

    /**
     * Normalizes the predicate.
     *
     * @method _fixPredicate
     * @param {String} inValue
     * @private
     */

  }, {
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      if (inValue) throw new Error(LayerError.dictionary.predicateNotSupported);
      return '';
    }

    /**
     * After redefining the query, reset it: remove all data/reset all state.
     *
     * @method _reset
     * @private
     */

  }, {
    key: '_reset',
    value: function _reset() {
      this.totalSize = 0;
      var data = this.data;
      this.data = [];
      this.client._checkAndPurgeCache(data);
      this.isFiring = false;
      this._predicate = null;
      this._nextDBFromId = '';
      this._nextServerFromId = '';
      this.pagedToEnd = false;
      this.paginationWindow = this._initialPaginationWindow;
      this._triggerChange({
        data: [],
        type: 'reset'
      });
    }

    /**
     * Reset your query to its initial state and then rerun it.
     *
     * @method reset
     */

  }, {
    key: 'reset',
    value: function reset() {
      this._reset();
      this._run();
    }

    /**
     * Execute the query.
     *
     * No, don't murder it, just fire it.  No, don't make it unemployed,
     * just connect to the server and get the results.
     *
     * @method _run
     * @private
     */

  }, {
    key: '_run',
    value: function _run() {
      // Find the number of items we need to request.
      var pageSize = Math.min(this.paginationWindow - this.size, this._getMaxPageSize());

      // If there is a reduction in pagination window, then this variable will be negative, and we can shrink
      // the data.
      if (pageSize < 0) {
        var removedData = this.data.slice(this.paginationWindow);
        this.data = this.data.slice(0, this.paginationWindow);
        this.client._checkAndPurgeCache(removedData);
        this.pagedToEnd = false;
        this._triggerAsync('change', { data: [] });
      } else if (pageSize === 0 || this.pagedToEnd) {
        // No need to load 0 results.
      } else {
        this._fetchData(pageSize);
      }
    }
  }, {
    key: '_fetchData',
    value: function _fetchData(pageSize) {}
    // Noop


    /**
     * Returns the sort field for the query.
     *
     * Returns One of:
     *
     * * 'position' (Messages only)
     * * 'last_message' (Conversations only)
     * * 'created_at' (Conversations only)
     * @method _getSortField
     * @private
     * @return {String} sort key used by server
     */

  }, {
    key: '_getSortField',
    value: function _getSortField() {}
    // Noop


    /**
     * Process the results of the `_run` method; calls __appendResults.
     *
     * @method _processRunResults
     * @private
     * @param  {Object} results - Full xhr response object with server results
     * @param {Number} pageSize - Number of entries that were requested
     */

  }, {
    key: '_processRunResults',
    value: function _processRunResults(results, requestUrl, pageSize) {
      var _this2 = this;

      if (requestUrl !== this._firingRequest || this.isDestroyed) return;

      // isFiring is false... unless we are still syncing
      this.isFiring = false;
      this._firingRequest = '';
      if (results.success) {
        this.totalSize = Number(results.xhr.getResponseHeader('Layer-Count'));
        this._appendResults(results, false);

        if (results.data.length < pageSize) this.pagedToEnd = true;
      } else if (results.data.getNonce()) {
        this.client.once('ready', function () {
          _this2._run();
        });
      } else {
        this.trigger('error', { error: results.data });
      }
    }

    /**
     * Appends arrays of data to the Query results.
     *
     * @method  _appendResults
     * @private
     */

  }, {
    key: '_appendResults',
    value: function _appendResults(results, fromDb) {
      var _this3 = this;

      // For all results, register them with the client
      // If already registered with the client, properties will be updated as needed
      // Database results rather than server results will arrive already registered.
      results.data.forEach(function (item) {
        if (!(item instanceof Root)) _this3.client._createObject(item);
      });

      // Filter results to just the new results
      var newResults = results.data.filter(function (item) {
        return _this3._getIndex(item.id) === -1;
      });

      // Update the next ID to use in pagination
      var resultLength = results.data.length;
      if (resultLength) {
        if (fromDb) {
          this._nextDBFromId = results.data[resultLength - 1].id;
        } else {
          this._nextServerFromId = results.data[resultLength - 1].id;
        }
      }

      // Update this.data
      if (this.dataType === Query.ObjectDataType) {
        this.data = [].concat(this.data);
      }

      // Insert the results... if the results are a match
      newResults.forEach(function (itemIn) {
        var item = _this3.client.getObject(itemIn.id);
        if (item) _this3._appendResultsSplice(item);
      });

      // Trigger the change event
      this._triggerChange({
        type: 'data',
        data: newResults.map(function (item) {
          return _this3._getData(_this3.client.getObject(item.id));
        }),
        query: this,
        target: this.client
      });
    }
  }, {
    key: '_appendResultsSplice',
    value: function _appendResultsSplice(item) {}
    // Noop


    /**
     * Returns a correctly formatted object representing a result.
     *
     * Format is specified by the `dataType` property.
     *
     * @method _getData
     * @private
     * @param  {layer.Root} item - Conversation, Message, etc... instance
     * @return {Object} - Conversation, Message, etc... instance or Object
     */

  }, {
    key: '_getData',
    value: function _getData(item) {
      if (this.dataType === Query.ObjectDataType) {
        return item.toObject();
      }
      return item;
    }

    /**
     * Returns an instance regardless of whether the input is instance or object
     * @method _getInstance
     * @private
     * @param {layer.Root|Object} item - Conversation, Message, etc... object/instance
     * @return {layer.Root}
     */

  }, {
    key: '_getInstance',
    value: function _getInstance(item) {
      if (item instanceof Root) return item;
      return this.client.getObject(item.id);
    }

    /**
     * Ask the query for the item matching the ID.
     *
     * Returns undefined if the ID is not found.
     *
     * @method _getItem
     * @private
     * @param  {string} id
     * @return {Object} Conversation, Message, etc... object or instance
     */

  }, {
    key: '_getItem',
    value: function _getItem(id) {
      var index = this._getIndex(id);
      return index === -1 ? null : this.data[index];
    }

    /**
     * Get the index of the item represented by the specified ID; or return -1.
     *
     * @method _getIndex
     * @private
     * @param  {string} id
     * @return {number}
     */

  }, {
    key: '_getIndex',
    value: function _getIndex(id) {
      for (var index = 0; index < this.data.length; index++) {
        if (this.data[index].id === id) return index;
      }
      return -1;
    }

    /**
     * Handle any change event received from the layer.Client.
     *
     * These can be caused by websocket events, as well as local
     * requests to create/delete/modify Conversations and Messages.
     *
     * The event does not necessarily apply to this Query, but the Query
     * must examine it to determine if it applies.
     *
     * @method _handleEvents
     * @private
     * @param {string} eventName - "messages:add", "conversations:change"
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleEvents',
    value: function _handleEvents(eventName, evt) {}
    // Noop


    /**
     * Handle a change event... for models that don't require custom handling
     *
     * @method _handleChangeEvent
     * @param {layer.LayerEvent} evt
     * @private
     */

  }, {
    key: '_handleChangeEvent',
    value: function _handleChangeEvent(name, evt) {
      var index = this._getIndex(evt.target.id);

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }
  }, {
    key: '_handleAddEvent',
    value: function _handleAddEvent(name, evt) {
      var _this4 = this;

      var list = evt[name].filter(function (obj) {
        return _this4._getIndex(obj.id) === -1;
      }).map(function (obj) {
        return _this4._getData(obj);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        var data = this.data = this.dataType === Query.ObjectDataType ? [].concat(this.data) : this.data;
        list.forEach(function (item) {
          data.push(item);
          _this4.totalSize += 1;

          _this4._triggerChange({
            type: 'insert',
            index: data.length - 1,
            target: item,
            query: _this4
          });
        });
      }
    }
  }, {
    key: '_handleRemoveEvent',
    value: function _handleRemoveEvent(name, evt) {
      var _this5 = this;

      var removed = [];
      evt[name].forEach(function (obj) {
        var index = _this5._getIndex(obj.id);

        if (index !== -1) {
          if (obj.id === _this5._nextDBFromId) _this5._nextDBFromId = _this5._updateNextFromId(index);
          if (obj.id === _this5._nextServerFromId) _this5._nextServerFromId = _this5._updateNextFromId(index);
          removed.push({
            data: obj,
            index: index
          });
          if (_this5.dataType === Query.ObjectDataType) {
            _this5.data = [].concat(_toConsumableArray(_this5.data.slice(0, index)), _toConsumableArray(_this5.data.slice(index + 1)));
          } else {
            _this5.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this5._triggerChange({
          type: 'remove',
          target: _this5._getData(removedObj.data),
          index: removedObj.index,
          query: _this5
        });
      });
    }

    /**
     * If the current next-id is removed from the list, get a new nextId.
     *
     * If the index is greater than 0, whatever is after that index may have come from
     * websockets or other sources, so decrement the index to get the next safe paging id.
     *
     * If the index if 0, even if there is data, that data did not come from paging and
     * can not be used safely as a paging id; return '';
     *
     * @method _updateNextFromId
     * @private
     * @param {number} index - Current index of the nextFromId
     * @returns {string} - Next ID or empty string
     */

  }, {
    key: '_updateNextFromId',
    value: function _updateNextFromId(index) {
      if (index > 0) return this.data[index - 1].id;else return '';
    }

    /*
     * If this is ever changed to be async, make sure that destroy() still triggers synchronous events
     */

  }, {
    key: '_triggerChange',
    value: function _triggerChange(evt) {
      if (this.isDestroyed || this.client._inCleanup) return;
      this.trigger('change', evt);
      this.trigger('change:' + evt.type, evt);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.id;
    }
  }]);

  return Query;
}(Root);

Query.prefixUUID = 'layer:///queries/';

/**
 * Query for Conversations.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Conversation = 'Conversation';

/**
 * Query for Channels.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Channel = 'Channel';

/**
 * Query for Messages.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Message = 'Message';

/**
 * Query for Announcements.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Announcement = 'Announcement';

/**
 * Query for Identities.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Identity = 'Identity';

/**
 * Query for Members of a Channel.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Membership = 'Membership';

/**
 * Get data as POJOs/immutable objects.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as immutable objects.
 *
 * @type {string}
 * @static
 */
Query.ObjectDataType = 'object';

/**
 * Get data as instances of layer.Message and layer.Conversation.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as instances.
 *
 * @type {string}
 * @static
 */
Query.InstanceDataType = 'instance';

/**
 * Set the maximum page size for queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSize = 100;

/**
 * Access the number of results currently loaded.
 *
 * @type {Number}
 * @readonly
 */
Object.defineProperty(Query.prototype, 'size', {
  enumerable: true,
  get: function get() {
    return !this.data ? 0 : this.data.length;
  }
});

/** Access the total number of results on the server.
 *
 * Will be 0 until the first query has successfully loaded results.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.totalSize = 0;

/**
 * Access to the client so it can listen to websocket and local events.
 *
 * @type {layer.Client}
 * @protected
 * @readonly
 */
Query.prototype.client = null;

/**
 * Query results.
 *
 * Array of data resulting from the Query; either a layer.Root subclass.
 *
 * or plain Objects
 * @type {Object[]}
 * @readonly
 */
Query.prototype.data = null;

/**
 * Specifies the type of data being queried for.
 *
 * Model is one of
 *
 * * layer.Query.Conversation
 * * layer.Query.Channel
 * * layer.Query.Message
 * * layer.Query.Announcement
 * * layer.Query.Identity
 *
 * Value can be set via constructor and layer.Query.update().
 *
 * @type {String}
 * @readonly
 */
Query.prototype.model = '';

/**
 * What type of results to request of the server.
 *
 * Not yet supported; returnType is one of
 *
 * * object
 * * id
 * * count
 *
 *  Value set via constructor.
 + *
 * This Query API is designed only for use with 'object' at this time; waiting for updates to server for
 * this functionality.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.returnType = 'object';

/**
 * Specify what kind of data array your application requires.
 *
 * Used to specify query dataType.  One of
 * * Query.ObjectDataType
 * * Query.InstanceDataType
 *
 * @type {String}
 * @readonly
 */
Query.prototype.dataType = Query.InstanceDataType;

/**
 * Number of results from the server to request/cache.
 *
 * The pagination window can be increased to download additional items, or decreased to purge results
 * from the data property.
 *
 *     query.update({
 *       paginationWindow: 150
 *     })
 *
 * This call will aim to achieve 150 results.  If it previously had 100,
 * then it will load 50 more. If it previously had 200, it will drop 50.
 *
 * Note that the server will only permit 100 at a time.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.paginationWindow = 100;

/**
 * Sorting criteria for Conversation Queries.
 *
 * Only supports an array of one field/element.
 * Only supports the following options:
 *
 * ```
 * query.update({sortBy: [{'createdAt': 'desc'}]})
 * query.update({sortBy: [{'lastMessage.sentAt': 'desc'}]
 *
 * client.createQuery({
 *   sortBy: [{'lastMessage.sentAt': 'desc'}]
 * });
 * client.createQuery({
 *   sortBy: [{'lastMessage.sentAt': 'desc'}]
 * });
 * ```
 *
 * Why such limitations? Why this structure?  The server will be exposing a Query API at which point the
 * above sort options will make a lot more sense, and full sorting will be provided.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.sortBy = null;

/**
 * This value tells us what to reset the paginationWindow to when the query is redefined.
 *
 * @type {Number}
 * @private
 */
Query.prototype._initialPaginationWindow = 100;

/**
 * Your Query's WHERE clause.
 *
 * Currently, the only queries supported are:
 *
 * ```
 *  "conversation.id = 'layer:///conversations/uuid'"
 *  "channel.id = 'layer:///channels/uuid"
 * ```
 *
 * Note that both ' and " are supported.
 *
 * @type {string}
 * @readonly
 */
Query.prototype.predicate = null;

/**
 * True if the Query is connecting to the server.
 *
 * It is not gaurenteed that every `update()` will fire a request to the server.
 * For example, updating a paginationWindow to be smaller,
 * Or changing a value to the existing value would cause the request not to fire.
 *
 * Recommended pattern is:
 *
 *      query.update({paginationWindow: 50});
 *      if (!query.isFiring) {
 *        alert("Done");
 *      } else {
 *          query.once("change", function(evt) {
 *            if (evt.type == "data") alert("Done");
 *          });
 *      }
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.isFiring = false;

/**
 * True if we have reached the last result, and further paging will just return []
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.pagedToEnd = false;

/**
 * The last request fired.
 *
 * If multiple requests are inflight, the response
 * matching this request is the ONLY response we will process.
 * @type {String}
 * @private
 */
Query.prototype._firingRequest = '';

/**
 * The ID to use in paging the server.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the server.
 *
 * @type {string}
 */
Query.prototype._nextServerFromId = '';

/**
 * The ID to use in paging the database.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the database.
 *
 * @type {string}
 */
Query.prototype._nextDBFromId = '';

Query._supportedEvents = [
/**
 * The query data has changed; any change event will cause this event to trigger.
 * @event change
 */
'change',

/**
 * A new page of data has been loaded from the server
 * @event 'change:data'
 */
'change:data',

/**
 * All data for this query has been reset due to a change in the Query predicate.
 * @event 'change:reset'
 */
'change:reset',

/**
 * An item of data within this Query has had a property change its value.
 * @event 'change:property'
 */
'change:property',

/**
 * A new item of data has been inserted into the Query. Not triggered by loading
 * a new page of data from the server, but is triggered by locally creating a matching
 * item of data, or receiving a new item of data via websocket.
 * @event 'change:insert'
 */
'change:insert',

/**
 * An item of data has been removed from the Query. Not triggered for every removal, but
 * is triggered by locally deleting a result, or receiving a report of deletion via websocket.
 * @event 'change:remove'
 */
'change:remove',

/**
 * An item of data has been moved to a new index in the Query results.
 * @event 'change:move'
 */
'change:move',

/**
 * The query data failed to load from the server.
 * @event error
 */
'error'].concat(Root._supportedEvents);

Root.initClass.apply(Query, [Query, 'Query']);

module.exports = Query;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL3F1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIkxvZ2dlciIsIlV0aWxzIiwiUXVlcnkiLCJvcHRpb25zIiwiYXJncyIsImxlbmd0aCIsImJ1aWxkIiwiY2xpZW50IiwicHJlZGljYXRlIiwiX2ZpeFByZWRpY2F0ZSIsInBhZ2luYXRpb25XaW5kb3ciLCJNYXRoIiwibWluIiwiX2dldE1heFBhZ2VTaXplIiwid2FybiIsImRhdGEiLCJfaW5pdGlhbFBhZ2luYXRpb25XaW5kb3ciLCJFcnJvciIsImRpY3Rpb25hcnkiLCJjbGllbnRNaXNzaW5nIiwib24iLCJfaGFuZGxlRXZlbnRzIiwiaXNSZWFkeSIsIm9uY2UiLCJfcnVuIiwiX3RyaWdnZXJDaGFuZ2UiLCJ0eXBlIiwib2ZmIiwiX3JlbW92ZVF1ZXJ5IiwiY29uc3RydWN0b3IiLCJNYXhQYWdlU2l6ZSIsIm5lZWRzUmVmcmVzaCIsIm5lZWRzUmVjcmVhdGUiLCJvcHRpb25zQnVpbHQiLCJzaXplIiwibW9kZWwiLCJtb2RlbEltbXV0YWJsZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJzb3J0QnkiLCJfcmVzZXQiLCJpblZhbHVlIiwicHJlZGljYXRlTm90U3VwcG9ydGVkIiwidG90YWxTaXplIiwiX2NoZWNrQW5kUHVyZ2VDYWNoZSIsImlzRmlyaW5nIiwiX3ByZWRpY2F0ZSIsIl9uZXh0REJGcm9tSWQiLCJfbmV4dFNlcnZlckZyb21JZCIsInBhZ2VkVG9FbmQiLCJwYWdlU2l6ZSIsInJlbW92ZWREYXRhIiwic2xpY2UiLCJfdHJpZ2dlckFzeW5jIiwiX2ZldGNoRGF0YSIsInJlc3VsdHMiLCJyZXF1ZXN0VXJsIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0Rlc3Ryb3llZCIsInN1Y2Nlc3MiLCJOdW1iZXIiLCJ4aHIiLCJnZXRSZXNwb25zZUhlYWRlciIsIl9hcHBlbmRSZXN1bHRzIiwiZ2V0Tm9uY2UiLCJ0cmlnZ2VyIiwiZXJyb3IiLCJmcm9tRGIiLCJmb3JFYWNoIiwiaXRlbSIsIl9jcmVhdGVPYmplY3QiLCJuZXdSZXN1bHRzIiwiZmlsdGVyIiwiX2dldEluZGV4IiwiaWQiLCJyZXN1bHRMZW5ndGgiLCJkYXRhVHlwZSIsIk9iamVjdERhdGFUeXBlIiwiY29uY2F0IiwiaXRlbUluIiwiZ2V0T2JqZWN0IiwiX2FwcGVuZFJlc3VsdHNTcGxpY2UiLCJtYXAiLCJfZ2V0RGF0YSIsInF1ZXJ5IiwidGFyZ2V0IiwidG9PYmplY3QiLCJpbmRleCIsImV2ZW50TmFtZSIsImV2dCIsIm5hbWUiLCJpc0NoYW5nZSIsImNoYW5nZXMiLCJsaXN0Iiwib2JqIiwicHVzaCIsInJlbW92ZWQiLCJfdXBkYXRlTmV4dEZyb21JZCIsInNwbGljZSIsInJlbW92ZWRPYmoiLCJfaW5DbGVhbnVwIiwicHJlZml4VVVJRCIsIkNvbnZlcnNhdGlvbiIsIkNoYW5uZWwiLCJNZXNzYWdlIiwiQW5ub3VuY2VtZW50IiwiSWRlbnRpdHkiLCJNZW1iZXJzaGlwIiwiSW5zdGFuY2VEYXRhVHlwZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwicHJvdG90eXBlIiwiZW51bWVyYWJsZSIsImdldCIsInJldHVyblR5cGUiLCJfc3VwcG9ydGVkRXZlbnRzIiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNk1BLElBQU1BLE9BQU9DLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTUMsYUFBYUQsUUFBUSxnQkFBUixDQUFuQjtBQUNB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UUFBaEIsR0FBMkIsS0FBM0I7O0FBRUE7Ozs7OztBQU1BM0MsTUFBTTZHLFNBQU4sQ0FBZ0I5RCxVQUFoQixHQUE2QixLQUE3Qjs7QUFFQTs7Ozs7Ozs7QUFRQS9DLE1BQU02RyxTQUFOLENBQWdCdEQsY0FBaEIsR0FBaUMsRUFBakM7O0FBRUE7Ozs7Ozs7Ozs7O0FBV0F2RCxNQUFNNkcsU0FBTixDQUFnQi9ELGlCQUFoQixHQUFvQyxFQUFwQzs7QUFFQTs7Ozs7Ozs7Ozs7QUFXQTlDLE1BQU02RyxTQUFOLENBQWdCaEUsYUFBaEIsR0FBZ0MsRUFBaEM7O0FBRUE3QyxNQUFNaUgsZ0JBQU4sR0FBeUI7QUFDdkI7Ozs7QUFJQSxRQUx1Qjs7QUFPdkI7Ozs7QUFJQSxhQVh1Qjs7QUFhdkI7Ozs7QUFJQSxjQWpCdUI7O0FBbUJ2Qjs7OztBQUlBLGlCQXZCdUI7O0FBeUJ2Qjs7Ozs7O0FBTUEsZUEvQnVCOztBQWlDdkI7Ozs7O0FBS0EsZUF0Q3VCOztBQXdDdkI7Ozs7QUFJQSxhQTVDdUI7O0FBOEN2Qjs7OztBQUlBLE9BbER1QixFQW9EdkJyQyxNQXBEdUIsQ0FvRGhCakYsS0FBS3NILGdCQXBEVyxDQUF6Qjs7QUFzREF0SCxLQUFLdUgsU0FBTCxDQUFlQyxLQUFmLENBQXFCbkgsS0FBckIsRUFBNEIsQ0FBQ0EsS0FBRCxFQUFRLE9BQVIsQ0FBNUI7O0FBRUFvSCxPQUFPQyxPQUFQLEdBQWlCckgsS0FBakIiLCJmaWxlIjoicXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyB0byBpbnN0YW50aWF0ZSB0aGlzIGNsYXNzOlxuICpcbiAqICAgICAgLy8gMS4gVXNpbmcgYSBRdWVyeSBCdWlsZGVyXG4gKiAgICAgIHZhciBjb252ZXJzYXRpb25RdWVyeUJ1aWxkZXIgPSBRdWVyeUJ1aWxkZXIuY29udmVyc2F0aW9ucygpLnNvcnRCeSgnbGFzdE1lc3NhZ2UnKTtcbiAqICAgICAgdmFyIGNvbnZlcnNhdGlvblF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHF1ZXJ5QnVpbGRlcik7XG4gKiAgICAgIHZhciBjaGFubmVsUXVlcnlCdWlsZGVyID0gUXVlcnlCdWlsZGVyLmNoYW5uZWxzKCk7XG4gKiAgICAgIHZhciBjaGFubmVsUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocXVlcnlCdWlsZGVyKTtcbiAqXG4gKiAgICAgIC8vIDIuIFBhc3NpbmcgcHJvcGVydGllcyBkaXJlY3RseVxuICogICAgICB2YXIgY29udmVyc2F0aW9uUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5Db252ZXJzYXRpb24sXG4gKiAgICAgICAgc29ydEJ5OiBbeydjcmVhdGVkQXQnOiAnZGVzYyd9XVxuICogICAgICB9KTtcbiAqICAgICAgdmFyIGNoYW5uZWxRdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gKiAgICAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5LkNoYW5uZWxcbiAqICAgICAgfSk7XG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGRhdGEgc2VsZWN0ZWQgYnkgeW91ciBxdWVyeSBhbnkgdGltZSB5b3Ugd2FudCB1c2luZzpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgICBwcmVkaWNhdGU6ICdjb252ZXJzYXRpb24uaWQgPSBcIicgKyBjb252LmlkICsgXCInXCJcbiAqICAgICAgfSk7XG4gKlxuICogICAgIC8vIE9yIHVzZSB0aGUgUXVlcnkgQnVpbGRlcjpcbiAqICAgICBxdWVyeUJ1aWxkZXIucGFnaW5hdGlvbldpbmRvdygyMDApO1xuICogICAgIHF1ZXJ5LnVwZGF0ZShxdWVyeUJ1aWxkZXIpO1xuICpcbiAqIFlvdSBjYW4gcmVsZWFzZSBkYXRhIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqICMjIyMgUXVlcnkgVHlwZXNcbiAqXG4gKiBGb3IgZG9jdW1lbnRhdGlvbiBvbiBjcmVhdGluZyBlYWNoIG9mIHRoZXNlIHR5cGVzIG9mIHF1ZXJpZXMsIHNlZSB0aGUgc3BlY2lmaWVkIFF1ZXJ5IFN1YmNsYXNzOlxuICpcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uc1F1ZXJ5XG4gKiAqIGxheWVyLkNoYW5uZWxzUXVlcnlcbiAqICogbGF5ZXIuTWVzc2FnZXNRdWVyeVxuICogKiBsYXllci5JZGVudGl0aWVzUXVlcnlcbiAqICogbGF5ZXIuTWVtYmVyc1F1ZXJ5XG4gKlxuICogIyMjIyBkYXRhVHlwZVxuICpcbiAqIFRoZSBsYXllci5RdWVyeS5kYXRhVHlwZSBwcm9wZXJ0eSBsZXRzIHlvdSBzcGVjaWZ5IHdoYXQgdHlwZSBvZiBkYXRhIHNob3dzIHVwIGluIHlvdXIgcmVzdWx0czpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZXNzYWdlLFxuICogICAgIHByZWRpY2F0ZTogXCJjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJ1wiLFxuICogICAgIGRhdGFUeXBlOiBsYXllci5RdWVyeS5JbnN0YW5jZURhdGFUeXBlXG4gKiB9KVxuICpcbiAqIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5Lk1lc3NhZ2UsXG4gKiAgICAgcHJlZGljYXRlOiBcImNvbnZlcnNhdGlvbi5pZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWQnXCIsXG4gKiAgICAgZGF0YVR5cGU6IGxheWVyLlF1ZXJ5Lk9iamVjdERhdGFUeXBlXG4gKiB9KVxuICogYGBgXG4gKlxuICogVGhlIHByb3BlcnR5IGRlZmF1bHRzIHRvIGxheWVyLlF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGUuICBJbnN0YW5jZXMgc3VwcG9ydCBtZXRob2RzIGFuZCBsZXQgeW91IHN1YnNjcmliZSB0byBldmVudHMgZm9yIGRpcmVjdCBub3RpZmljYXRpb25cbiAqIG9mIGNoYW5nZXMgdG8gYW55IG9mIHRoZSByZXN1bHRzIG9mIHlvdXIgcXVlcnk6XG4gKlxuKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5kYXRhWzBdLm9uKCdtZXNzYWdlczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgICBhbGVydCgnVGhlIGZpcnN0IG1lc3NhZ2UgaGFzIGhhZCBhIHByb3BlcnR5IGNoYW5nZTsgcHJvYmFibHkgaXNSZWFkIG9yIHJlY2lwaWVudF9zdGF0dXMhJyk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEEgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuT2JqZWN0RGF0YVR5cGUgd2lsbCBjYXVzZSB0aGUgZGF0YSB0byBiZSBhbiBhcnJheSBvZiBpbW11dGFibGUgb2JqZWN0cyByYXRoZXIgdGhhbiBpbnN0YW5jZXMuICBPbmUgY2FuIHN0aWxsIGdldCBhbiBpbnN0YW5jZSBmcm9tIHRoZSBQT0pPOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UocXVlcnkuZGF0YVswXS5pZCk7XG4gKiBtLm9uKCdtZXNzYWdlczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgICBhbGVydCgnVGhlIGZpcnN0IG1lc3NhZ2UgaGFzIGhhZCBhIHByb3BlcnR5IGNoYW5nZTsgcHJvYmFibHkgaXNSZWFkIG9yIHJlY2lwaWVudF9zdGF0dXMhJyk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqICMjIFF1ZXJ5IEV2ZW50c1xuICpcbiAqIFF1ZXJpZXMgZmlyZSBldmVudHMgd2hlbmV2ZXIgdGhlaXIgZGF0YSBjaGFuZ2VzLiAgVGhlcmUgYXJlIDUgdHlwZXMgb2YgZXZlbnRzO1xuICogYWxsIGV2ZW50cyBhcmUgcmVjZWl2ZWQgYnkgc3Vic2NyaWJpbmcgdG8gdGhlIGBjaGFuZ2VgIGV2ZW50LlxuICpcbiAqICMjIyAxLiBEYXRhIEV2ZW50c1xuICpcbiAqIFRoZSBEYXRhIGV2ZW50IGlzIGZpcmVkIHdoZW5ldmVyIGEgcmVxdWVzdCBpcyBzZW50IHRvIHRoZSBzZXJ2ZXIgZm9yIG5ldyBxdWVyeSByZXN1bHRzLiAgVGhpcyBjb3VsZCBoYXBwZW4gd2hlbiBmaXJzdCBjcmVhdGluZyB0aGUgcXVlcnksIHdoZW4gcGFnaW5nIGZvciBtb3JlIGRhdGEsIG9yIHdoZW4gY2hhbmdpbmcgdGhlIHF1ZXJ5J3MgcHJvcGVydGllcywgcmVzdWx0aW5nIGluIGEgbmV3IHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBUaGUgRXZlbnQgb2JqZWN0IHdpbGwgaGF2ZSBhbiBgZXZ0LmRhdGFgIGFycmF5IG9mIGFsbCBuZXdseSBhZGRlZCByZXN1bHRzLiAgQnV0IGZyZXF1ZW50bHkgeW91IG1heSBqdXN0IHdhbnQgdG8gdXNlIHRoZSBgcXVlcnkuZGF0YWAgYXJyYXkgYW5kIGdldCBBTEwgcmVzdWx0cy5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ2RhdGEnKSB7XG4gKiAgICAgIHZhciBuZXdEYXRhID0gZXZ0LmRhdGE7XG4gKiAgICAgIHZhciBhbGxEYXRhID0gcXVlcnkuZGF0YTtcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6ZGF0YScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyAyLiBJbnNlcnQgRXZlbnRzXG4gKlxuICogQSBuZXcgQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2Ugd2FzIGNyZWF0ZWQuIEl0IG1heSBoYXZlIGJlZW4gY3JlYXRlZCBsb2NhbGx5IGJ5IHlvdXIgdXNlciwgb3IgaXQgbWF5IGhhdmUgYmVlbiByZW1vdGVseSBjcmVhdGVkLCByZWNlaXZlZCB2aWEgd2Vic29ja2V0LCBhbmQgYWRkZWQgdG8gdGhlIFF1ZXJ5J3MgcmVzdWx0cy5cbiAqXG4gKiBUaGUgbGF5ZXIuTGF5ZXJFdmVudC50YXJnZXQgcHJvcGVydHkgY29udGFpbnMgdGhlIG5ld2x5IGluc2VydGVkIG9iamVjdC5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAgcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgaWYgKGV2dC50eXBlID09PSAnaW5zZXJ0Jykge1xuICogICAgICAgdmFyIG5ld0l0ZW0gPSBldnQudGFyZ2V0O1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICAgfVxuICogIH0pO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOmluc2VydCcsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyAzLiBSZW1vdmUgRXZlbnRzXG4gKlxuICogQSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSB3YXMgZGVsZXRlZC4gVGhpcyBtYXkgaGF2ZSBiZWVuIGRlbGV0ZWQgbG9jYWxseSBieSB5b3VyIHVzZXIsIG9yIGl0IG1heSBoYXZlIGJlZW4gcmVtb3RlbHkgZGVsZXRlZCwgYSBub3RpZmljYXRpb24gcmVjZWl2ZWQgdmlhIHdlYnNvY2tldCwgYW5kIHJlbW92ZWQgZnJvbSB0aGUgUXVlcnkgcmVzdWx0cy5cbiAqXG4gKiBUaGUgbGF5ZXIuTGF5ZXJFdmVudC50YXJnZXQgcHJvcGVydHkgY29udGFpbnMgdGhlIHJlbW92ZWQgb2JqZWN0LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAncmVtb3ZlJykge1xuICogICAgICAgdmFyIHJlbW92ZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBhbGxEYXRhID0gcXVlcnkuZGF0YTtcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDQuIFJlc2V0IEV2ZW50c1xuICpcbiAqIEFueSB0aW1lIHlvdXIgcXVlcnkncyBtb2RlbCBvciBwcmVkaWNhdGUgcHJvcGVydGllcyBoYXZlIGJlZW4gY2hhbmdlZFxuICogdGhlIHF1ZXJ5IGlzIHJlc2V0LCBhbmQgYSBuZXcgcmVxdWVzdCBpcyBzZW50IHRvIHRoZSBzZXJ2ZXIuICBUaGUgcmVzZXQgZXZlbnQgaW5mb3JtcyB5b3VyIFVJIHRoYXQgdGhlIGN1cnJlbnQgcmVzdWx0IHNldCBpcyBlbXB0eSwgYW5kIHRoYXQgdGhlIHJlYXNvbiBpdHMgZW1wdHkgaXMgdGhhdCBpdCB3YXMgYHJlc2V0YC4gIFRoaXMgaGVscHMgZGlmZmVyZW50aWF0ZSBpdCBmcm9tIGEgYGRhdGFgIGV2ZW50IHRoYXQgcmV0dXJucyBhbiBlbXB0eSBhcnJheS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ3Jlc2V0Jykge1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhOyAvLyBbXVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpyZXNldCcsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyA1LiBQcm9wZXJ0eSBFdmVudHNcbiAqXG4gKiBJZiBhbnkgcHJvcGVydGllcyBjaGFuZ2UgaW4gYW55IG9mIHRoZSBvYmplY3RzIGxpc3RlZCBpbiB5b3VyIGxheWVyLlF1ZXJ5LmRhdGEgcHJvcGVydHksIGEgYHByb3BlcnR5YCBldmVudCB3aWxsIGJlIGZpcmVkLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyBvYmplY3QgdGhhdCB3YXMgbW9kaWZpZWQuXG4gKlxuICogU2VlIGxheWVyLkxheWVyRXZlbnQuY2hhbmdlcyBmb3IgZGV0YWlscyBvbiBob3cgY2hhbmdlcyBhcmUgcmVwb3J0ZWQuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdwcm9wZXJ0eScpIHtcbiAqICAgICAgIHZhciBjaGFuZ2VkSXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgaXNSZWFkQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdpc1JlYWQnKTtcbiAqICAgICAgIHZhciByZWNpcGllbnRTdGF0dXNDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3JlY2lwaWVudFN0YXR1cycpO1xuICogICAgICAgaWYgKGlzUmVhZENoYW5nZXMubGVuZ3RoKSB7XG4gKiAgICAgICAgICAgLi4uXG4gKiAgICAgICB9XG4gKlxuICogICAgICAgaWYgKHJlY2lwaWVudFN0YXR1c0NoYW5nZXMubGVuZ3RoKSB7XG4gKiAgICAgICAgICAgLi4uXG4gKiAgICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpgYGBcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpwcm9wZXJ0eScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyA2LiBNb3ZlIEV2ZW50c1xuICpcbiAqIE9jY2FzaW9uYWxseSwgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2lsbCBjYXVzZSBhbiBpdGVtIHRvIGJlIHNvcnRlZCBkaWZmZXJlbnRseSwgY2F1c2luZyBhIE1vdmUgZXZlbnQuXG4gKiBUaGUgZXZlbnQgd2lsbCB0ZWxsIHlvdSB3aGF0IGluZGV4IHRoZSBpdGVtIHdhcyBhdCwgYW5kIHdoZXJlIGl0IGhhcyBtb3ZlZCB0byBpbiB0aGUgUXVlcnkgcmVzdWx0cy5cbiAqIFRoaXMgaXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydGVkIGZvciBDb252ZXJzYXRpb25zLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAnbW92ZScpIHtcbiAqICAgICAgIHZhciBjaGFuZ2VkSXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgb2xkSW5kZXggPSBldnQuZnJvbUluZGV4O1xuICogICAgICAgdmFyIG5ld0luZGV4ID0gZXZ0Lm5ld0luZGV4O1xuICogICAgICAgdmFyIG1vdmVOb2RlID0gbGlzdC5jaGlsZE5vZGVzW29sZEluZGV4XTtcbiAqICAgICAgIGxpc3QucmVtb3ZlQ2hpbGQobW92ZU5vZGUpO1xuICogICAgICAgbGlzdC5pbnNlcnRCZWZvcmUobW92ZU5vZGUsIGxpc3QuY2hpbGROb2Rlc1tuZXdJbmRleF0pO1xuICogICB9XG4gKiB9KTtcbiAqYGBgXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6bW92ZScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqXG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcblxuY2xhc3MgUXVlcnkgZXh0ZW5kcyBSb290IHtcblxuICBjb25zdHJ1Y3RvciguLi5hcmdzKSB7XG4gICAgbGV0IG9wdGlvbnM7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICBvcHRpb25zID0gYXJnc1sxXS5idWlsZCgpO1xuICAgICAgb3B0aW9ucy5jbGllbnQgPSBhcmdzWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gYXJnc1swXTtcbiAgICB9XG5cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnByZWRpY2F0ZSA9IHRoaXMuX2ZpeFByZWRpY2F0ZShvcHRpb25zLnByZWRpY2F0ZSB8fCAnJyk7XG5cbiAgICBpZiAoJ3BhZ2luYXRpb25XaW5kb3cnIGluIG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IHBhZ2luYXRpb25XaW5kb3cgPSBvcHRpb25zLnBhZ2luYXRpb25XaW5kb3c7XG4gICAgICB0aGlzLnBhZ2luYXRpb25XaW5kb3cgPSBNYXRoLm1pbih0aGlzLl9nZXRNYXhQYWdlU2l6ZSgpLCBvcHRpb25zLnBhZ2luYXRpb25XaW5kb3cpO1xuICAgICAgaWYgKG9wdGlvbnMucGFnaW5hdGlvbldpbmRvdyAhPT0gcGFnaW5hdGlvbldpbmRvdykge1xuICAgICAgICBMb2dnZXIud2FybihgcGFnaW5hdGlvbldpbmRvdyB2YWx1ZSAke3BhZ2luYXRpb25XaW5kb3d9IGluIFF1ZXJ5IGNvbnN0cnVjdG9yIGAgK1xuICAgICAgICAgIGBleGNlZGVzIFF1ZXJ5Lk1heFBhZ2VTaXplIG9mICR7dGhpcy5fZ2V0TWF4UGFnZVNpemUoKX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdyA9IHRoaXMucGFnaW5hdGlvbldpbmRvdztcbiAgICBpZiAoIXRoaXMuY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIHRoaXMuY2xpZW50Lm9uKCdhbGwnLCB0aGlzLl9oYW5kbGVFdmVudHMsIHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLmNsaWVudC5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmNsaWVudC5vbmNlKCdyZWFkeScsICgpID0+IHRoaXMuX3J1bigpLCB0aGlzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcnVuKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAgYW5kIHJlbW92ZSB0aGlzIFF1ZXJ5LCBpdHMgc3Vic2NyaXB0aW9ucyBhbmQgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuZGF0YSA9IFtdO1xuICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgZGF0YTogW10sXG4gICAgICB0eXBlOiAncmVzZXQnLFxuICAgIH0pO1xuICAgIHRoaXMuY2xpZW50Lm9mZihudWxsLCBudWxsLCB0aGlzKTtcbiAgICB0aGlzLmNsaWVudC5fcmVtb3ZlUXVlcnkodGhpcyk7XG4gICAgdGhpcy5kYXRhID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBtYXhpbXVtIG51bWJlciBvZiBpdGVtcyBhbGxvd2VkIGluIGEgcGFnZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRNYXhQYWdlU2l6ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgX2dldE1heFBhZ2VTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLk1heFBhZ2VTaXplO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgcHJvcGVydGllcyBvZiB0aGUgUXVlcnkuXG4gICAqXG4gICAqIEN1cnJlbnRseSBzdXBwb3J0cyB1cGRhdGluZzpcbiAgICpcbiAgICogKiBwYWdpbmF0aW9uV2luZG93XG4gICAqICogcHJlZGljYXRlXG4gICAqICogc29ydEJ5XG4gICAqXG4gICAqIEFueSBjaGFuZ2UgdG8gcHJlZGljYXRlIG9yIG1vZGVsIHJlc3VsdHMgaW4gY2xlYXJpbmcgYWxsIGRhdGEgZnJvbSB0aGVcbiAgICogcXVlcnkncyByZXN1bHRzIGFuZCB0cmlnZ2VyaW5nIGEgY2hhbmdlIGV2ZW50IHdpdGggW10gYXMgdGhlIG5ldyBkYXRhLlxuICAgKlxuICAgKiBgYGBcbiAgICogcXVlcnkudXBkYXRlKHtcbiAgICogICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogYGBgXG4gICAqIHF1ZXJ5LnVwZGF0ZSh7XG4gICAqICAgIHBhZ2luYXRpb25XaW5kb3c6IDEwMCxcbiAgICogICAgcHJlZGljYXRlOiAnY29udmVyc2F0aW9uLmlkID0gXCJsYXllcjovLy9jb252ZXJzYXRpb25zL1VVSURcIidcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBgYGBcbiAgICogcXVlcnkudXBkYXRlKHtcbiAgICogICAgc29ydEJ5OiBbe1wibGFzdE1lc3NhZ2Uuc2VudEF0XCI6IFwiZGVzY1wifV1cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByZWRpY2F0ZV0gLSBBIG5ldyBwcmVkaWNhdGUgZm9yIHRoZSBxdWVyeVxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZWxdIC0gQSBuZXcgbW9kZWwgZm9yIHRoZSBRdWVyeVxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2luYXRpb25XaW5kb3ddIC0gSW5jcmVhc2UvZGVjcmVhc2Ugb3VyIHJlc3VsdCBzaXplIHRvIG1hdGNoIHRoaXMgcGFnaW5hdGlvbiB3aW5kb3cuXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fSB0aGlzXG4gICAqL1xuICB1cGRhdGUob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IG5lZWRzUmVmcmVzaCxcbiAgICAgIG5lZWRzUmVjcmVhdGU7XG5cbiAgICBjb25zdCBvcHRpb25zQnVpbHQgPSAodHlwZW9mIG9wdGlvbnMuYnVpbGQgPT09ICdmdW5jdGlvbicpID8gb3B0aW9ucy5idWlsZCgpIDogb3B0aW9ucztcblxuICAgIGlmICgncGFnaW5hdGlvbldpbmRvdycgaW4gb3B0aW9uc0J1aWx0ICYmIHRoaXMucGFnaW5hdGlvbldpbmRvdyAhPT0gb3B0aW9uc0J1aWx0LnBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgIHRoaXMucGFnaW5hdGlvbldpbmRvdyA9IE1hdGgubWluKHRoaXMuX2dldE1heFBhZ2VTaXplKCkgKyB0aGlzLnNpemUsIG9wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIGlmICh0aGlzLnBhZ2luYXRpb25XaW5kb3cgPCBvcHRpb25zQnVpbHQucGFnaW5hdGlvbldpbmRvdykge1xuICAgICAgICBMb2dnZXIud2FybihgcGFnaW5hdGlvbldpbmRvdyB2YWx1ZSAke29wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93fSBpbiBRdWVyeS51cGRhdGUoKSBgICtcbiAgICAgICAgICBgaW5jcmVhc2VzIHNpemUgZ3JlYXRlciB0aGFuIFF1ZXJ5Lk1heFBhZ2VTaXplIG9mICR7dGhpcy5fZ2V0TWF4UGFnZVNpemUoKX1gKTtcbiAgICAgIH1cbiAgICAgIG5lZWRzUmVmcmVzaCA9IHRydWU7XG4gICAgfVxuICAgIGlmICgnbW9kZWwnIGluIG9wdGlvbnNCdWlsdCAmJiB0aGlzLm1vZGVsICE9PSBvcHRpb25zQnVpbHQubW9kZWwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkubW9kZWxJbW11dGFibGUpO1xuICAgIH1cblxuICAgIGlmICgncHJlZGljYXRlJyBpbiBvcHRpb25zQnVpbHQpIHtcbiAgICAgIGNvbnN0IHByZWRpY2F0ZSA9IHRoaXMuX2ZpeFByZWRpY2F0ZShvcHRpb25zQnVpbHQucHJlZGljYXRlIHx8ICcnKTtcbiAgICAgIGlmICh0aGlzLnByZWRpY2F0ZSAhPT0gcHJlZGljYXRlKSB7XG4gICAgICAgIHRoaXMucHJlZGljYXRlID0gcHJlZGljYXRlO1xuICAgICAgICBuZWVkc1JlY3JlYXRlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCdzb3J0QnknIGluIG9wdGlvbnNCdWlsdCAmJiBKU09OLnN0cmluZ2lmeSh0aGlzLnNvcnRCeSkgIT09IEpTT04uc3RyaW5naWZ5KG9wdGlvbnNCdWlsdC5zb3J0QnkpKSB7XG4gICAgICB0aGlzLnNvcnRCeSA9IG9wdGlvbnNCdWlsdC5zb3J0Qnk7XG4gICAgICBuZWVkc1JlY3JlYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG5lZWRzUmVjcmVhdGUpIHtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfVxuICAgIGlmIChuZWVkc1JlY3JlYXRlIHx8IG5lZWRzUmVmcmVzaCkgdGhpcy5fcnVuKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogTm9ybWFsaXplcyB0aGUgcHJlZGljYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9maXhQcmVkaWNhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGluVmFsdWVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIGlmIChpblZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnByZWRpY2F0ZU5vdFN1cHBvcnRlZCk7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgLyoqXG4gICAqIEFmdGVyIHJlZGVmaW5pbmcgdGhlIHF1ZXJ5LCByZXNldCBpdDogcmVtb3ZlIGFsbCBkYXRhL3Jlc2V0IGFsbCBzdGF0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLnRvdGFsU2l6ZSA9IDA7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLmNsaWVudC5fY2hlY2tBbmRQdXJnZUNhY2hlKGRhdGEpO1xuICAgIHRoaXMuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9wcmVkaWNhdGUgPSBudWxsO1xuICAgIHRoaXMuX25leHREQkZyb21JZCA9ICcnO1xuICAgIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSAnJztcbiAgICB0aGlzLnBhZ2VkVG9FbmQgPSBmYWxzZTtcbiAgICB0aGlzLnBhZ2luYXRpb25XaW5kb3cgPSB0aGlzLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdztcbiAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgIGRhdGE6IFtdLFxuICAgICAgdHlwZTogJ3Jlc2V0JyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB5b3VyIHF1ZXJ5IHRvIGl0cyBpbml0aWFsIHN0YXRlIGFuZCB0aGVuIHJlcnVuIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIHJlc2V0XG4gICAqL1xuICByZXNldCgpIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIHRoaXMuX3J1bigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIHF1ZXJ5LlxuICAgKlxuICAgKiBObywgZG9uJ3QgbXVyZGVyIGl0LCBqdXN0IGZpcmUgaXQuICBObywgZG9uJ3QgbWFrZSBpdCB1bmVtcGxveWVkLFxuICAgKiBqdXN0IGNvbm5lY3QgdG8gdGhlIHNlcnZlciBhbmQgZ2V0IHRoZSByZXN1bHRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ydW5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9ydW4oKSB7XG4gICAgLy8gRmluZCB0aGUgbnVtYmVyIG9mIGl0ZW1zIHdlIG5lZWQgdG8gcmVxdWVzdC5cbiAgICBjb25zdCBwYWdlU2l6ZSA9IE1hdGgubWluKHRoaXMucGFnaW5hdGlvbldpbmRvdyAtIHRoaXMuc2l6ZSwgdGhpcy5fZ2V0TWF4UGFnZVNpemUoKSk7XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBhIHJlZHVjdGlvbiBpbiBwYWdpbmF0aW9uIHdpbmRvdywgdGhlbiB0aGlzIHZhcmlhYmxlIHdpbGwgYmUgbmVnYXRpdmUsIGFuZCB3ZSBjYW4gc2hyaW5rXG4gICAgLy8gdGhlIGRhdGEuXG4gICAgaWYgKHBhZ2VTaXplIDwgMCkge1xuICAgICAgY29uc3QgcmVtb3ZlZERhdGEgPSB0aGlzLmRhdGEuc2xpY2UodGhpcy5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIHRoaXMuZGF0YSA9IHRoaXMuZGF0YS5zbGljZSgwLCB0aGlzLnBhZ2luYXRpb25XaW5kb3cpO1xuICAgICAgdGhpcy5jbGllbnQuX2NoZWNrQW5kUHVyZ2VDYWNoZShyZW1vdmVkRGF0YSk7XG4gICAgICB0aGlzLnBhZ2VkVG9FbmQgPSBmYWxzZTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY2hhbmdlJywgeyBkYXRhOiBbXSB9KTtcbiAgICB9IGVsc2UgaWYgKHBhZ2VTaXplID09PSAwIHx8IHRoaXMucGFnZWRUb0VuZCkge1xuICAgICAgLy8gTm8gbmVlZCB0byBsb2FkIDAgcmVzdWx0cy5cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZmV0Y2hEYXRhKHBhZ2VTaXplKTtcbiAgICB9XG4gIH1cblxuICBfZmV0Y2hEYXRhKHBhZ2VTaXplKSB7XG4gICAgLy8gTm9vcFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHNvcnQgZmllbGQgZm9yIHRoZSBxdWVyeS5cbiAgICpcbiAgICogUmV0dXJucyBPbmUgb2Y6XG4gICAqXG4gICAqICogJ3Bvc2l0aW9uJyAoTWVzc2FnZXMgb25seSlcbiAgICogKiAnbGFzdF9tZXNzYWdlJyAoQ29udmVyc2F0aW9ucyBvbmx5KVxuICAgKiAqICdjcmVhdGVkX2F0JyAoQ29udmVyc2F0aW9ucyBvbmx5KVxuICAgKiBAbWV0aG9kIF9nZXRTb3J0RmllbGRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7U3RyaW5nfSBzb3J0IGtleSB1c2VkIGJ5IHNlcnZlclxuICAgKi9cbiAgX2dldFNvcnRGaWVsZCgpIHtcbiAgICAvLyBOb29wXG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgcmVzdWx0cyBvZiB0aGUgYF9ydW5gIG1ldGhvZDsgY2FsbHMgX19hcHBlbmRSZXN1bHRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcm9jZXNzUnVuUmVzdWx0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdHMgLSBGdWxsIHhociByZXNwb25zZSBvYmplY3Qgd2l0aCBzZXJ2ZXIgcmVzdWx0c1xuICAgKiBAcGFyYW0ge051bWJlcn0gcGFnZVNpemUgLSBOdW1iZXIgb2YgZW50cmllcyB0aGF0IHdlcmUgcmVxdWVzdGVkXG4gICAqL1xuICBfcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgcmVxdWVzdFVybCwgcGFnZVNpemUpIHtcbiAgICBpZiAocmVxdWVzdFVybCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCB8fCB0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG5cbiAgICAvLyBpc0ZpcmluZyBpcyBmYWxzZS4uLiB1bmxlc3Mgd2UgYXJlIHN0aWxsIHN5bmNpbmdcbiAgICB0aGlzLmlzRmlyaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9ICcnO1xuICAgIGlmIChyZXN1bHRzLnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMudG90YWxTaXplID0gTnVtYmVyKHJlc3VsdHMueGhyLmdldFJlc3BvbnNlSGVhZGVyKCdMYXllci1Db3VudCcpKTtcbiAgICAgIHRoaXMuX2FwcGVuZFJlc3VsdHMocmVzdWx0cywgZmFsc2UpO1xuXG4gICAgICBpZiAocmVzdWx0cy5kYXRhLmxlbmd0aCA8IHBhZ2VTaXplKSB0aGlzLnBhZ2VkVG9FbmQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0cy5kYXRhLmdldE5vbmNlKCkpIHtcbiAgICAgIHRoaXMuY2xpZW50Lm9uY2UoJ3JlYWR5JywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9ydW4oKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogcmVzdWx0cy5kYXRhIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFycmF5cyBvZiBkYXRhIHRvIHRoZSBRdWVyeSByZXN1bHRzLlxuICAgKlxuICAgKiBAbWV0aG9kICBfYXBwZW5kUmVzdWx0c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2FwcGVuZFJlc3VsdHMocmVzdWx0cywgZnJvbURiKSB7XG4gICAgLy8gRm9yIGFsbCByZXN1bHRzLCByZWdpc3RlciB0aGVtIHdpdGggdGhlIGNsaWVudFxuICAgIC8vIElmIGFscmVhZHkgcmVnaXN0ZXJlZCB3aXRoIHRoZSBjbGllbnQsIHByb3BlcnRpZXMgd2lsbCBiZSB1cGRhdGVkIGFzIG5lZWRlZFxuICAgIC8vIERhdGFiYXNlIHJlc3VsdHMgcmF0aGVyIHRoYW4gc2VydmVyIHJlc3VsdHMgd2lsbCBhcnJpdmUgYWxyZWFkeSByZWdpc3RlcmVkLlxuICAgIHJlc3VsdHMuZGF0YS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICBpZiAoIShpdGVtIGluc3RhbmNlb2YgUm9vdCkpIHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QoaXRlbSk7XG4gICAgfSk7XG5cbiAgICAvLyBGaWx0ZXIgcmVzdWx0cyB0byBqdXN0IHRoZSBuZXcgcmVzdWx0c1xuICAgIGNvbnN0IG5ld1Jlc3VsdHMgPSByZXN1bHRzLmRhdGEuZmlsdGVyKGl0ZW0gPT4gdGhpcy5fZ2V0SW5kZXgoaXRlbS5pZCkgPT09IC0xKTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgbmV4dCBJRCB0byB1c2UgaW4gcGFnaW5hdGlvblxuICAgIGNvbnN0IHJlc3VsdExlbmd0aCA9IHJlc3VsdHMuZGF0YS5sZW5ndGg7XG4gICAgaWYgKHJlc3VsdExlbmd0aCkge1xuICAgICAgaWYgKGZyb21EYikge1xuICAgICAgICB0aGlzLl9uZXh0REJGcm9tSWQgPSByZXN1bHRzLmRhdGFbcmVzdWx0TGVuZ3RoIC0gMV0uaWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gcmVzdWx0cy5kYXRhW3Jlc3VsdExlbmd0aCAtIDFdLmlkO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSB0aGlzLmRhdGFcbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIHRoaXMuZGF0YSA9IFtdLmNvbmNhdCh0aGlzLmRhdGEpO1xuICAgIH1cblxuICAgIC8vIEluc2VydCB0aGUgcmVzdWx0cy4uLiBpZiB0aGUgcmVzdWx0cyBhcmUgYSBtYXRjaFxuICAgIG5ld1Jlc3VsdHMuZm9yRWFjaCgoaXRlbUluKSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5jbGllbnQuZ2V0T2JqZWN0KGl0ZW1Jbi5pZCk7XG4gICAgICBpZiAoaXRlbSkgdGhpcy5fYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKTtcbiAgICB9KTtcblxuXG4gICAgLy8gVHJpZ2dlciB0aGUgY2hhbmdlIGV2ZW50XG4gICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICB0eXBlOiAnZGF0YScsXG4gICAgICBkYXRhOiBuZXdSZXN1bHRzLm1hcChpdGVtID0+IHRoaXMuX2dldERhdGEodGhpcy5jbGllbnQuZ2V0T2JqZWN0KGl0ZW0uaWQpKSksXG4gICAgICBxdWVyeTogdGhpcyxcbiAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgfSk7XG4gIH1cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgLy8gTm9vcFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBjb3JyZWN0bHkgZm9ybWF0dGVkIG9iamVjdCByZXByZXNlbnRpbmcgYSByZXN1bHQuXG4gICAqXG4gICAqIEZvcm1hdCBpcyBzcGVjaWZpZWQgYnkgdGhlIGBkYXRhVHlwZWAgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdH0gaXRlbSAtIENvbnZlcnNhdGlvbiwgTWVzc2FnZSwgZXRjLi4uIGluc3RhbmNlXG4gICAqIEByZXR1cm4ge09iamVjdH0gLSBDb252ZXJzYXRpb24sIE1lc3NhZ2UsIGV0Yy4uLiBpbnN0YW5jZSBvciBPYmplY3RcbiAgICovXG4gIF9nZXREYXRhKGl0ZW0pIHtcbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIHJldHVybiBpdGVtLnRvT2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gaW5zdGFuY2UgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBpbnB1dCBpcyBpbnN0YW5jZSBvciBvYmplY3RcbiAgICogQG1ldGhvZCBfZ2V0SW5zdGFuY2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Sb290fE9iamVjdH0gaXRlbSAtIENvbnZlcnNhdGlvbiwgTWVzc2FnZSwgZXRjLi4uIG9iamVjdC9pbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgX2dldEluc3RhbmNlKGl0ZW0pIHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIFJvb3QpIHJldHVybiBpdGVtO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXRPYmplY3QoaXRlbS5pZCk7XG4gIH1cblxuICAvKipcbiAgICogQXNrIHRoZSBxdWVyeSBmb3IgdGhlIGl0ZW0gbWF0Y2hpbmcgdGhlIElELlxuICAgKlxuICAgKiBSZXR1cm5zIHVuZGVmaW5lZCBpZiB0aGUgSUQgaXMgbm90IGZvdW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJdGVtXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAgICogQHJldHVybiB7T2JqZWN0fSBDb252ZXJzYXRpb24sIE1lc3NhZ2UsIGV0Yy4uLiBvYmplY3Qgb3IgaW5zdGFuY2VcbiAgICovXG4gIF9nZXRJdGVtKGlkKSB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZCk7XG4gICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IG51bGwgOiB0aGlzLmRhdGFbaW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgaW5kZXggb2YgdGhlIGl0ZW0gcmVwcmVzZW50ZWQgYnkgdGhlIHNwZWNpZmllZCBJRDsgb3IgcmV0dXJuIC0xLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJbmRleFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAqIEByZXR1cm4ge251bWJlcn1cbiAgICovXG4gIF9nZXRJbmRleChpZCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBpZiAodGhpcy5kYXRhW2luZGV4XS5pZCA9PT0gaWQpIHJldHVybiBpbmRleDtcbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhbnkgY2hhbmdlIGV2ZW50IHJlY2VpdmVkIGZyb20gdGhlIGxheWVyLkNsaWVudC5cbiAgICpcbiAgICogVGhlc2UgY2FuIGJlIGNhdXNlZCBieSB3ZWJzb2NrZXQgZXZlbnRzLCBhcyB3ZWxsIGFzIGxvY2FsXG4gICAqIHJlcXVlc3RzIHRvIGNyZWF0ZS9kZWxldGUvbW9kaWZ5IENvbnZlcnNhdGlvbnMgYW5kIE1lc3NhZ2VzLlxuICAgKlxuICAgKiBUaGUgZXZlbnQgZG9lcyBub3QgbmVjZXNzYXJpbHkgYXBwbHkgdG8gdGhpcyBRdWVyeSwgYnV0IHRoZSBRdWVyeVxuICAgKiBtdXN0IGV4YW1pbmUgaXQgdG8gZGV0ZXJtaW5lIGlmIGl0IGFwcGxpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIC0gXCJtZXNzYWdlczphZGRcIiwgXCJjb252ZXJzYXRpb25zOmNoYW5nZVwiXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlRXZlbnRzKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgLy8gTm9vcFxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIGNoYW5nZSBldmVudC4uLiBmb3IgbW9kZWxzIHRoYXQgZG9uJ3QgcmVxdWlyZSBjdXN0b20gaGFuZGxpbmdcbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlRXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYW5kbGVDaGFuZ2VFdmVudChuYW1lLCBldnQpIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGV2dC50YXJnZXQuaWQpO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgIGV2dC50YXJnZXQudG9PYmplY3QoKSxcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQWRkRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgbGlzdCA9IGV2dFtuYW1lXVxuICAgICAgLmZpbHRlcihvYmogPT4gdGhpcy5fZ2V0SW5kZXgob2JqLmlkKSA9PT0gLTEpXG4gICAgICAubWFwKG9iaiA9PiB0aGlzLl9nZXREYXRhKG9iaikpO1xuXG4gICAgLy8gQWRkIHRoZW0gdG8gb3VyIHJlc3VsdCBzZXQgYW5kIHRyaWdnZXIgYW4gZXZlbnQgZm9yIGVhY2ggb25lXG4gICAgaWYgKGxpc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhID0gdGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUgPyBbXS5jb25jYXQodGhpcy5kYXRhKSA6IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICBkYXRhLnB1c2goaXRlbSk7XG4gICAgICAgIHRoaXMudG90YWxTaXplICs9IDE7XG5cbiAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgaW5kZXg6IGRhdGEubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZVJlbW92ZUV2ZW50KG5hbWUsIGV2dCkge1xuICAgIGNvbnN0IHJlbW92ZWQgPSBbXTtcbiAgICBldnRbbmFtZV0uZm9yRWFjaCgob2JqKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KG9iai5pZCk7XG5cbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgaWYgKG9iai5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKG9iai5pZCA9PT0gdGhpcy5fbmV4dFNlcnZlckZyb21JZCkgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICByZW1vdmVkLnB1c2goe1xuICAgICAgICAgIGRhdGE6IG9iaixcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvdGFsU2l6ZSAtPSByZW1vdmVkLmxlbmd0aDtcbiAgICByZW1vdmVkLmZvckVhY2goKHJlbW92ZWRPYmopID0+IHtcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncmVtb3ZlJyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKHJlbW92ZWRPYmouZGF0YSksXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBjdXJyZW50IG5leHQtaWQgaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0LCBnZXQgYSBuZXcgbmV4dElkLlxuICAgKlxuICAgKiBJZiB0aGUgaW5kZXggaXMgZ3JlYXRlciB0aGFuIDAsIHdoYXRldmVyIGlzIGFmdGVyIHRoYXQgaW5kZXggbWF5IGhhdmUgY29tZSBmcm9tXG4gICAqIHdlYnNvY2tldHMgb3Igb3RoZXIgc291cmNlcywgc28gZGVjcmVtZW50IHRoZSBpbmRleCB0byBnZXQgdGhlIG5leHQgc2FmZSBwYWdpbmcgaWQuXG4gICAqXG4gICAqIElmIHRoZSBpbmRleCBpZiAwLCBldmVuIGlmIHRoZXJlIGlzIGRhdGEsIHRoYXQgZGF0YSBkaWQgbm90IGNvbWUgZnJvbSBwYWdpbmcgYW5kXG4gICAqIGNhbiBub3QgYmUgdXNlZCBzYWZlbHkgYXMgYSBwYWdpbmcgaWQ7IHJldHVybiAnJztcbiAgICpcbiAgICogQG1ldGhvZCBfdXBkYXRlTmV4dEZyb21JZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBDdXJyZW50IGluZGV4IG9mIHRoZSBuZXh0RnJvbUlkXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gTmV4dCBJRCBvciBlbXB0eSBzdHJpbmdcbiAgICovXG4gIF91cGRhdGVOZXh0RnJvbUlkKGluZGV4KSB7XG4gICAgaWYgKGluZGV4ID4gMCkgcmV0dXJuIHRoaXMuZGF0YVtpbmRleCAtIDFdLmlkO1xuICAgIGVsc2UgcmV0dXJuICcnO1xuICB9XG5cbiAgLypcbiAgICogSWYgdGhpcyBpcyBldmVyIGNoYW5nZWQgdG8gYmUgYXN5bmMsIG1ha2Ugc3VyZSB0aGF0IGRlc3Ryb3koKSBzdGlsbCB0cmlnZ2VycyBzeW5jaHJvbm91cyBldmVudHNcbiAgICovXG4gIF90cmlnZ2VyQ2hhbmdlKGV2dCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8IHRoaXMuY2xpZW50Ll9pbkNsZWFudXApIHJldHVybjtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIGV2dCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2U6JyArIGV2dC50eXBlLCBldnQpO1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuaWQ7XG4gIH1cbn1cblxuXG5RdWVyeS5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL3F1ZXJpZXMvJztcblxuLyoqXG4gKiBRdWVyeSBmb3IgQ29udmVyc2F0aW9ucy5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5Db252ZXJzYXRpb24gPSAnQ29udmVyc2F0aW9uJztcblxuLyoqXG4gKiBRdWVyeSBmb3IgQ2hhbm5lbHMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuQ2hhbm5lbCA9ICdDaGFubmVsJztcblxuLyoqXG4gKiBRdWVyeSBmb3IgTWVzc2FnZXMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuTWVzc2FnZSA9ICdNZXNzYWdlJztcblxuLyoqXG4gKiBRdWVyeSBmb3IgQW5ub3VuY2VtZW50cy5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5Bbm5vdW5jZW1lbnQgPSAnQW5ub3VuY2VtZW50JztcblxuLyoqXG4gKiBRdWVyeSBmb3IgSWRlbnRpdGllcy5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5JZGVudGl0eSA9ICdJZGVudGl0eSc7XG5cbi8qKlxuICogUXVlcnkgZm9yIE1lbWJlcnMgb2YgYSBDaGFubmVsLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lk1lbWJlcnNoaXAgPSAnTWVtYmVyc2hpcCc7XG5cbi8qKlxuICogR2V0IGRhdGEgYXMgUE9KT3MvaW1tdXRhYmxlIG9iamVjdHMuXG4gKlxuICogVGhpcyB2YWx1ZSBvZiBsYXllci5RdWVyeS5kYXRhVHlwZSB3aWxsIGNhdXNlIHlvdXIgUXVlcnkgZGF0YSBhbmQgZXZlbnRzIHRvIHByb3ZpZGUgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyBhcyBpbW11dGFibGUgb2JqZWN0cy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5PYmplY3REYXRhVHlwZSA9ICdvYmplY3QnO1xuXG4vKipcbiAqIEdldCBkYXRhIGFzIGluc3RhbmNlcyBvZiBsYXllci5NZXNzYWdlIGFuZCBsYXllci5Db252ZXJzYXRpb24uXG4gKlxuICogVGhpcyB2YWx1ZSBvZiBsYXllci5RdWVyeS5kYXRhVHlwZSB3aWxsIGNhdXNlIHlvdXIgUXVlcnkgZGF0YSBhbmQgZXZlbnRzIHRvIHByb3ZpZGUgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyBhcyBpbnN0YW5jZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuSW5zdGFuY2VEYXRhVHlwZSA9ICdpbnN0YW5jZSc7XG5cbi8qKlxuICogU2V0IHRoZSBtYXhpbXVtIHBhZ2Ugc2l6ZSBmb3IgcXVlcmllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5NYXhQYWdlU2l6ZSA9IDEwMDtcblxuLyoqXG4gKiBBY2Nlc3MgdGhlIG51bWJlciBvZiByZXN1bHRzIGN1cnJlbnRseSBsb2FkZWQuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEByZWFkb25seVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUXVlcnkucHJvdG90eXBlLCAnc2l6ZScsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmRhdGEgPyAwIDogdGhpcy5kYXRhLmxlbmd0aDtcbiAgfSxcbn0pO1xuXG4vKiogQWNjZXNzIHRoZSB0b3RhbCBudW1iZXIgb2YgcmVzdWx0cyBvbiB0aGUgc2VydmVyLlxuICpcbiAqIFdpbGwgYmUgMCB1bnRpbCB0aGUgZmlyc3QgcXVlcnkgaGFzIHN1Y2Nlc3NmdWxseSBsb2FkZWQgcmVzdWx0cy5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS50b3RhbFNpemUgPSAwO1xuXG5cbi8qKlxuICogQWNjZXNzIHRvIHRoZSBjbGllbnQgc28gaXQgY2FuIGxpc3RlbiB0byB3ZWJzb2NrZXQgYW5kIGxvY2FsIGV2ZW50cy5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuQ2xpZW50fVxuICogQHByb3RlY3RlZFxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5jbGllbnQgPSBudWxsO1xuXG4vKipcbiAqIFF1ZXJ5IHJlc3VsdHMuXG4gKlxuICogQXJyYXkgb2YgZGF0YSByZXN1bHRpbmcgZnJvbSB0aGUgUXVlcnk7IGVpdGhlciBhIGxheWVyLlJvb3Qgc3ViY2xhc3MuXG4gKlxuICogb3IgcGxhaW4gT2JqZWN0c1xuICogQHR5cGUge09iamVjdFtdfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5kYXRhID0gbnVsbDtcblxuLyoqXG4gKiBTcGVjaWZpZXMgdGhlIHR5cGUgb2YgZGF0YSBiZWluZyBxdWVyaWVkIGZvci5cbiAqXG4gKiBNb2RlbCBpcyBvbmUgb2ZcbiAqXG4gKiAqIGxheWVyLlF1ZXJ5LkNvbnZlcnNhdGlvblxuICogKiBsYXllci5RdWVyeS5DaGFubmVsXG4gKiAqIGxheWVyLlF1ZXJ5Lk1lc3NhZ2VcbiAqICogbGF5ZXIuUXVlcnkuQW5ub3VuY2VtZW50XG4gKiAqIGxheWVyLlF1ZXJ5LklkZW50aXR5XG4gKlxuICogVmFsdWUgY2FuIGJlIHNldCB2aWEgY29uc3RydWN0b3IgYW5kIGxheWVyLlF1ZXJ5LnVwZGF0ZSgpLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLm1vZGVsID0gJyc7XG5cbi8qKlxuICogV2hhdCB0eXBlIG9mIHJlc3VsdHMgdG8gcmVxdWVzdCBvZiB0aGUgc2VydmVyLlxuICpcbiAqIE5vdCB5ZXQgc3VwcG9ydGVkOyByZXR1cm5UeXBlIGlzIG9uZSBvZlxuICpcbiAqICogb2JqZWN0XG4gKiAqIGlkXG4gKiAqIGNvdW50XG4gKlxuICogIFZhbHVlIHNldCB2aWEgY29uc3RydWN0b3IuXG4gKyAqXG4gKiBUaGlzIFF1ZXJ5IEFQSSBpcyBkZXNpZ25lZCBvbmx5IGZvciB1c2Ugd2l0aCAnb2JqZWN0JyBhdCB0aGlzIHRpbWU7IHdhaXRpbmcgZm9yIHVwZGF0ZXMgdG8gc2VydmVyIGZvclxuICogdGhpcyBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnJldHVyblR5cGUgPSAnb2JqZWN0JztcblxuLyoqXG4gKiBTcGVjaWZ5IHdoYXQga2luZCBvZiBkYXRhIGFycmF5IHlvdXIgYXBwbGljYXRpb24gcmVxdWlyZXMuXG4gKlxuICogVXNlZCB0byBzcGVjaWZ5IHF1ZXJ5IGRhdGFUeXBlLiAgT25lIG9mXG4gKiAqIFF1ZXJ5Lk9iamVjdERhdGFUeXBlXG4gKiAqIFF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGVcbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5kYXRhVHlwZSA9IFF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGU7XG5cbi8qKlxuICogTnVtYmVyIG9mIHJlc3VsdHMgZnJvbSB0aGUgc2VydmVyIHRvIHJlcXVlc3QvY2FjaGUuXG4gKlxuICogVGhlIHBhZ2luYXRpb24gd2luZG93IGNhbiBiZSBpbmNyZWFzZWQgdG8gZG93bmxvYWQgYWRkaXRpb25hbCBpdGVtcywgb3IgZGVjcmVhc2VkIHRvIHB1cmdlIHJlc3VsdHNcbiAqIGZyb20gdGhlIGRhdGEgcHJvcGVydHkuXG4gKlxuICogICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICBwYWdpbmF0aW9uV2luZG93OiAxNTBcbiAqICAgICB9KVxuICpcbiAqIFRoaXMgY2FsbCB3aWxsIGFpbSB0byBhY2hpZXZlIDE1MCByZXN1bHRzLiAgSWYgaXQgcHJldmlvdXNseSBoYWQgMTAwLFxuICogdGhlbiBpdCB3aWxsIGxvYWQgNTAgbW9yZS4gSWYgaXQgcHJldmlvdXNseSBoYWQgMjAwLCBpdCB3aWxsIGRyb3AgNTAuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBzZXJ2ZXIgd2lsbCBvbmx5IHBlcm1pdCAxMDAgYXQgYSB0aW1lLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnBhZ2luYXRpb25XaW5kb3cgPSAxMDA7XG5cbi8qKlxuICogU29ydGluZyBjcml0ZXJpYSBmb3IgQ29udmVyc2F0aW9uIFF1ZXJpZXMuXG4gKlxuICogT25seSBzdXBwb3J0cyBhbiBhcnJheSBvZiBvbmUgZmllbGQvZWxlbWVudC5cbiAqIE9ubHkgc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuICpcbiAqIGBgYFxuICogcXVlcnkudXBkYXRlKHtzb3J0Qnk6IFt7J2NyZWF0ZWRBdCc6ICdkZXNjJ31dfSlcbiAqIHF1ZXJ5LnVwZGF0ZSh7c29ydEJ5OiBbeydsYXN0TWVzc2FnZS5zZW50QXQnOiAnZGVzYyd9XVxuICpcbiAqIGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgIHNvcnRCeTogW3snbGFzdE1lc3NhZ2Uuc2VudEF0JzogJ2Rlc2MnfV1cbiAqIH0pO1xuICogY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgc29ydEJ5OiBbeydsYXN0TWVzc2FnZS5zZW50QXQnOiAnZGVzYyd9XVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBXaHkgc3VjaCBsaW1pdGF0aW9ucz8gV2h5IHRoaXMgc3RydWN0dXJlPyAgVGhlIHNlcnZlciB3aWxsIGJlIGV4cG9zaW5nIGEgUXVlcnkgQVBJIGF0IHdoaWNoIHBvaW50IHRoZVxuICogYWJvdmUgc29ydCBvcHRpb25zIHdpbGwgbWFrZSBhIGxvdCBtb3JlIHNlbnNlLCBhbmQgZnVsbCBzb3J0aW5nIHdpbGwgYmUgcHJvdmlkZWQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuc29ydEJ5ID0gbnVsbDtcblxuLyoqXG4gKiBUaGlzIHZhbHVlIHRlbGxzIHVzIHdoYXQgdG8gcmVzZXQgdGhlIHBhZ2luYXRpb25XaW5kb3cgdG8gd2hlbiB0aGUgcXVlcnkgaXMgcmVkZWZpbmVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5RdWVyeS5wcm90b3R5cGUuX2luaXRpYWxQYWdpbmF0aW9uV2luZG93ID0gMTAwO1xuXG4vKipcbiAqIFlvdXIgUXVlcnkncyBXSEVSRSBjbGF1c2UuXG4gKlxuICogQ3VycmVudGx5LCB0aGUgb25seSBxdWVyaWVzIHN1cHBvcnRlZCBhcmU6XG4gKlxuICogYGBgXG4gKiAgXCJjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJ1wiXG4gKiAgXCJjaGFubmVsLmlkID0gJ2xheWVyOi8vL2NoYW5uZWxzL3V1aWRcIlxuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IGJvdGggJyBhbmQgXCIgYXJlIHN1cHBvcnRlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5wcmVkaWNhdGUgPSBudWxsO1xuXG4vKipcbiAqIFRydWUgaWYgdGhlIFF1ZXJ5IGlzIGNvbm5lY3RpbmcgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBJdCBpcyBub3QgZ2F1cmVudGVlZCB0aGF0IGV2ZXJ5IGB1cGRhdGUoKWAgd2lsbCBmaXJlIGEgcmVxdWVzdCB0byB0aGUgc2VydmVyLlxuICogRm9yIGV4YW1wbGUsIHVwZGF0aW5nIGEgcGFnaW5hdGlvbldpbmRvdyB0byBiZSBzbWFsbGVyLFxuICogT3IgY2hhbmdpbmcgYSB2YWx1ZSB0byB0aGUgZXhpc3RpbmcgdmFsdWUgd291bGQgY2F1c2UgdGhlIHJlcXVlc3Qgbm90IHRvIGZpcmUuXG4gKlxuICogUmVjb21tZW5kZWQgcGF0dGVybiBpczpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7cGFnaW5hdGlvbldpbmRvdzogNTB9KTtcbiAqICAgICAgaWYgKCFxdWVyeS5pc0ZpcmluZykge1xuICogICAgICAgIGFsZXJ0KFwiRG9uZVwiKTtcbiAqICAgICAgfSBlbHNlIHtcbiAqICAgICAgICAgIHF1ZXJ5Lm9uY2UoXCJjaGFuZ2VcIiwgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICAgICAgICAgIGlmIChldnQudHlwZSA9PSBcImRhdGFcIikgYWxlcnQoXCJEb25lXCIpO1xuICogICAgICAgICAgfSk7XG4gKiAgICAgIH1cbiAqXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuaXNGaXJpbmcgPSBmYWxzZTtcblxuLyoqXG4gKiBUcnVlIGlmIHdlIGhhdmUgcmVhY2hlZCB0aGUgbGFzdCByZXN1bHQsIGFuZCBmdXJ0aGVyIHBhZ2luZyB3aWxsIGp1c3QgcmV0dXJuIFtdXG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnBhZ2VkVG9FbmQgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgbGFzdCByZXF1ZXN0IGZpcmVkLlxuICpcbiAqIElmIG11bHRpcGxlIHJlcXVlc3RzIGFyZSBpbmZsaWdodCwgdGhlIHJlc3BvbnNlXG4gKiBtYXRjaGluZyB0aGlzIHJlcXVlc3QgaXMgdGhlIE9OTFkgcmVzcG9uc2Ugd2Ugd2lsbCBwcm9jZXNzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5fZmlyaW5nUmVxdWVzdCA9ICcnO1xuXG4vKipcbiAqIFRoZSBJRCB0byB1c2UgaW4gcGFnaW5nIHRoZSBzZXJ2ZXIuXG4gKlxuICogV2h5IG5vdCBqdXN0IHVzZSB0aGUgSUQgb2YgdGhlIGxhc3QgaXRlbSBpbiBvdXIgcmVzdWx0IHNldD9cbiAqIEJlY2F1c2UgYXMgd2UgcmVjZWl2ZSB3ZWJzb2NrZXQgZXZlbnRzLCB3ZSBpbnNlcnQgYW5kIGFwcGVuZCBpdGVtcyB0byBvdXIgZGF0YS5cbiAqIFRoYXQgd2Vic29ja2V0IGV2ZW50IG1heSBub3QgaW4gZmFjdCBkZWxpdmVyIHRoZSBORVhUIGl0ZW0gaW4gb3VyIGRhdGEsIGJ1dCBzaW1wbHkgYW4gaXRlbSwgdGhhdCBzZXF1ZW50aWFsbHlcbiAqIGJlbG9uZ3MgYXQgdGhlIGVuZCBkZXNwaXRlIHNraXBwaW5nIG92ZXIgb3RoZXIgaXRlbXMgb2YgZGF0YS4gIFBhZ2luZyBzaG91bGQgbm90IGJlIGZyb20gdGhpcyBuZXcgaXRlbSwgYnV0XG4gKiBvbmx5IHRoZSBsYXN0IGl0ZW0gcHVsbGVkIHZpYSB0aGlzIHF1ZXJ5IGZyb20gdGhlIHNlcnZlci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5RdWVyeS5wcm90b3R5cGUuX25leHRTZXJ2ZXJGcm9tSWQgPSAnJztcblxuLyoqXG4gKiBUaGUgSUQgdG8gdXNlIGluIHBhZ2luZyB0aGUgZGF0YWJhc2UuXG4gKlxuICogV2h5IG5vdCBqdXN0IHVzZSB0aGUgSUQgb2YgdGhlIGxhc3QgaXRlbSBpbiBvdXIgcmVzdWx0IHNldD9cbiAqIEJlY2F1c2UgYXMgd2UgcmVjZWl2ZSB3ZWJzb2NrZXQgZXZlbnRzLCB3ZSBpbnNlcnQgYW5kIGFwcGVuZCBpdGVtcyB0byBvdXIgZGF0YS5cbiAqIFRoYXQgd2Vic29ja2V0IGV2ZW50IG1heSBub3QgaW4gZmFjdCBkZWxpdmVyIHRoZSBORVhUIGl0ZW0gaW4gb3VyIGRhdGEsIGJ1dCBzaW1wbHkgYW4gaXRlbSwgdGhhdCBzZXF1ZW50aWFsbHlcbiAqIGJlbG9uZ3MgYXQgdGhlIGVuZCBkZXNwaXRlIHNraXBwaW5nIG92ZXIgb3RoZXIgaXRlbXMgb2YgZGF0YS4gIFBhZ2luZyBzaG91bGQgbm90IGJlIGZyb20gdGhpcyBuZXcgaXRlbSwgYnV0XG4gKiBvbmx5IHRoZSBsYXN0IGl0ZW0gcHVsbGVkIHZpYSB0aGlzIHF1ZXJ5IGZyb20gdGhlIGRhdGFiYXNlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5fbmV4dERCRnJvbUlkID0gJyc7XG5cblF1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBoYXMgY2hhbmdlZDsgYW55IGNoYW5nZSBldmVudCB3aWxsIGNhdXNlIHRoaXMgZXZlbnQgdG8gdHJpZ2dlci5cbiAgICogQGV2ZW50IGNoYW5nZVxuICAgKi9cbiAgJ2NoYW5nZScsXG5cbiAgLyoqXG4gICAqIEEgbmV3IHBhZ2Ugb2YgZGF0YSBoYXMgYmVlbiBsb2FkZWQgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBldmVudCAnY2hhbmdlOmRhdGEnXG4gICAqL1xuICAnY2hhbmdlOmRhdGEnLFxuXG4gIC8qKlxuICAgKiBBbGwgZGF0YSBmb3IgdGhpcyBxdWVyeSBoYXMgYmVlbiByZXNldCBkdWUgdG8gYSBjaGFuZ2UgaW4gdGhlIFF1ZXJ5IHByZWRpY2F0ZS5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVzZXQnXG4gICAqL1xuICAnY2hhbmdlOnJlc2V0JyxcblxuICAvKipcbiAgICogQW4gaXRlbSBvZiBkYXRhIHdpdGhpbiB0aGlzIFF1ZXJ5IGhhcyBoYWQgYSBwcm9wZXJ0eSBjaGFuZ2UgaXRzIHZhbHVlLlxuICAgKiBAZXZlbnQgJ2NoYW5nZTpwcm9wZXJ0eSdcbiAgICovXG4gICdjaGFuZ2U6cHJvcGVydHknLFxuXG4gIC8qKlxuICAgKiBBIG5ldyBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gaW5zZXJ0ZWQgaW50byB0aGUgUXVlcnkuIE5vdCB0cmlnZ2VyZWQgYnkgbG9hZGluZ1xuICAgKiBhIG5ldyBwYWdlIG9mIGRhdGEgZnJvbSB0aGUgc2VydmVyLCBidXQgaXMgdHJpZ2dlcmVkIGJ5IGxvY2FsbHkgY3JlYXRpbmcgYSBtYXRjaGluZ1xuICAgKiBpdGVtIG9mIGRhdGEsIG9yIHJlY2VpdmluZyBhIG5ldyBpdGVtIG9mIGRhdGEgdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6aW5zZXJ0J1xuICAgKi9cbiAgJ2NoYW5nZTppbnNlcnQnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBRdWVyeS4gTm90IHRyaWdnZXJlZCBmb3IgZXZlcnkgcmVtb3ZhbCwgYnV0XG4gICAqIGlzIHRyaWdnZXJlZCBieSBsb2NhbGx5IGRlbGV0aW5nIGEgcmVzdWx0LCBvciByZWNlaXZpbmcgYSByZXBvcnQgb2YgZGVsZXRpb24gdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVtb3ZlJ1xuICAgKi9cbiAgJ2NoYW5nZTpyZW1vdmUnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gbW92ZWQgdG8gYSBuZXcgaW5kZXggaW4gdGhlIFF1ZXJ5IHJlc3VsdHMuXG4gICAqIEBldmVudCAnY2hhbmdlOm1vdmUnXG4gICAqL1xuICAnY2hhbmdlOm1vdmUnLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBmYWlsZWQgdG8gbG9hZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudCBlcnJvclxuICAgKi9cbiAgJ2Vycm9yJyxcblxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoUXVlcnksIFtRdWVyeSwgJ1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuXG4iXX0=
