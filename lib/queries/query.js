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
 * You can release Conversations and Messages held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### predicate
 *
 * Note that the `predicate` property is only supported for Messages, and only supports
 * querying by Conversation: `conversation.id = 'layer:///conversations/UUIUD'`
 *
 * #### sortBy
 *
 * Note that the `sortBy` property is only supported for Conversations at this time and only
 * supports "createdAt" and "lastMessage.sentAt" as sort fields.
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
        type: 'data',
        target: this.client,
        query: this,
        isChange: false,
        data: []
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
      this._isServerSyncing = false;
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
      if (this._isSyncingId) {
        clearTimeout(this._isSyncingId);
        this._isSyncingId = 0;
      }
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
      var isSyncing = results.xhr.getResponseHeader('Layer-Conversation-Is-Syncing') === 'true';

      // isFiring is false... unless we are still syncing
      this.isFiring = isSyncing;
      this._firingRequest = '';
      if (results.success) {
        if (isSyncing) {
          this._isSyncingId = setTimeout(function () {
            _this2._isSyncingId = 0;
            _this2._run();
          }, 1500);
        } else {
          this._isSyncingId = 0;
          this._appendResults(results, false);
          this.totalSize = Number(results.xhr.getResponseHeader('Layer-Count'));

          if (results.data.length < pageSize) this.pagedToEnd = true;
        }
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
          return data.push(item);
        });

        this.totalSize += list.length;

        // Index calculated above may shift after additional insertions.  This has
        // to be done after the above insertions have completed.
        list.forEach(function (item) {
          _this4._triggerChange({
            type: 'insert',
            index: _this4.data.indexOf(item),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9xdWVyaWVzL3F1ZXJ5LmpzIl0sIm5hbWVzIjpbIlJvb3QiLCJyZXF1aXJlIiwiTGF5ZXJFcnJvciIsIkxvZ2dlciIsIlF1ZXJ5Iiwib3B0aW9ucyIsImFyZ3MiLCJsZW5ndGgiLCJidWlsZCIsImNsaWVudCIsInByZWRpY2F0ZSIsIl9maXhQcmVkaWNhdGUiLCJwYWdpbmF0aW9uV2luZG93IiwiTWF0aCIsIm1pbiIsIl9nZXRNYXhQYWdlU2l6ZSIsIndhcm4iLCJkYXRhIiwiX2luaXRpYWxQYWdpbmF0aW9uV2luZG93IiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsIm9uIiwiX2hhbmRsZUV2ZW50cyIsImlzUmVhZHkiLCJvbmNlIiwiX3J1biIsIl90cmlnZ2VyQ2hhbmdlIiwidHlwZSIsInRhcmdldCIsInF1ZXJ5IiwiaXNDaGFuZ2UiLCJvZmYiLCJfcmVtb3ZlUXVlcnkiLCJjb25zdHJ1Y3RvciIsIk1heFBhZ2VTaXplIiwibmVlZHNSZWZyZXNoIiwibmVlZHNSZWNyZWF0ZSIsIm9wdGlvbnNCdWlsdCIsInNpemUiLCJtb2RlbCIsIm1vZGVsSW1tdXRhYmxlIiwiSlNPTiIsInN0cmluZ2lmeSIsInNvcnRCeSIsIl9yZXNldCIsImluVmFsdWUiLCJwcmVkaWNhdGVOb3RTdXBwb3J0ZWQiLCJ0b3RhbFNpemUiLCJfY2hlY2tBbmRQdXJnZUNhY2hlIiwiaXNGaXJpbmciLCJfcHJlZGljYXRlIiwiX25leHREQkZyb21JZCIsIl9uZXh0U2VydmVyRnJvbUlkIiwiX2lzU2VydmVyU3luY2luZyIsInBhZ2VkVG9FbmQiLCJfaXNTeW5jaW5nSWQiLCJjbGVhclRpbWVvdXQiLCJwYWdlU2l6ZSIsInJlbW92ZWREYXRhIiwic2xpY2UiLCJfdHJpZ2dlckFzeW5jIiwiX2ZldGNoRGF0YSIsInJlc3VsdHMiLCJyZXF1ZXN0VXJsIiwiX2ZpcmluZ1JlcXVlc3QiLCJpc0Rlc3Ryb3llZCIsImlzU3luY2luZyIsInhociIsImdldFJlc3BvbnNlSGVhZGVyIiwic3VjY2VzcyIsInNldFRpbWVvdXQiLCJfYXBwZW5kUmVzdWx0cyIsIk51bWJlciIsInRyaWdnZXIiLCJlcnJvciIsImZyb21EYiIsImZvckVhY2giLCJpdGVtIiwiX2NyZWF0ZU9iamVjdCIsIm5ld1Jlc3VsdHMiLCJmaWx0ZXIiLCJfZ2V0SW5kZXgiLCJpZCIsInJlc3VsdExlbmd0aCIsImRhdGFUeXBlIiwiT2JqZWN0RGF0YVR5cGUiLCJjb25jYXQiLCJpdGVtSW4iLCJnZXRPYmplY3QiLCJfYXBwZW5kUmVzdWx0c1NwbGljZSIsIm1hcCIsIl9nZXREYXRhIiwidG9PYmplY3QiLCJpbmRleCIsImV2ZW50TmFtZSIsImV2dCIsIm5hbWUiLCJjaGFuZ2VzIiwibGlzdCIsIm9iaiIsInB1c2giLCJpbmRleE9mIiwicmVtb3ZlZCIsIl91cGRhdGVOZXh0RnJvbUlkIiwic3BsaWNlIiwicmVtb3ZlZE9iaiIsIl9pbkNsZWFudXAiLCJwcmVmaXhVVUlEIiwiQ29udmVyc2F0aW9uIiwiQ2hhbm5lbCIsIk1lc3NhZ2UiLCJBbm5vdW5jZW1lbnQiLCJJZGVudGl0eSIsIk1lbWJlcnNoaXAiLCJJbnN0YW5jZURhdGFUeXBlIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiLCJlbnVtZXJhYmxlIiwiZ2V0IiwicmV0dXJuVHlwZSIsIl9zdXBwb3J0ZWRFdmVudHMiLCJpbml0Q2xhc3MiLCJhcHBseSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2TUEs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RixLQUFLMEgsZ0JBcERXLENBQXpCOztBQXNEQTFILEtBQUsySCxTQUFMLENBQWVDLEtBQWYsQ0FBcUJ4SCxLQUFyQixFQUE0QixDQUFDQSxLQUFELEVBQVEsT0FBUixDQUE1Qjs7QUFFQXlILE9BQU9DLE9BQVAsR0FBaUIxSCxLQUFqQiIsImZpbGUiOiJxdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlcmUgYXJlIHR3byB3YXlzIHRvIGluc3RhbnRpYXRlIHRoaXMgY2xhc3M6XG4gKlxuICogICAgICAvLyAxLiBVc2luZyBhIFF1ZXJ5IEJ1aWxkZXJcbiAqICAgICAgdmFyIGNvbnZlcnNhdGlvblF1ZXJ5QnVpbGRlciA9IFF1ZXJ5QnVpbGRlci5jb252ZXJzYXRpb25zKCkuc29ydEJ5KCdsYXN0TWVzc2FnZScpO1xuICogICAgICB2YXIgY29udmVyc2F0aW9uUXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocXVlcnlCdWlsZGVyKTtcbiAqICAgICAgdmFyIGNoYW5uZWxRdWVyeUJ1aWxkZXIgPSBRdWVyeUJ1aWxkZXIuY2hhbm5lbHMoKTtcbiAqICAgICAgdmFyIGNoYW5uZWxRdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeShxdWVyeUJ1aWxkZXIpO1xuICpcbiAqICAgICAgLy8gMi4gUGFzc2luZyBwcm9wZXJ0aWVzIGRpcmVjdGx5XG4gKiAgICAgIHZhciBjb252ZXJzYXRpb25RdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gKiAgICAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5LkNvbnZlcnNhdGlvbixcbiAqICAgICAgICBzb3J0Qnk6IFt7J2NyZWF0ZWRBdCc6ICdkZXNjJ31dXG4gKiAgICAgIH0pO1xuICogICAgICB2YXIgY2hhbm5lbFF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAqICAgICAgICBtb2RlbDogbGF5ZXIuUXVlcnkuQ2hhbm5lbFxuICogICAgICB9KTtcbiAqXG4gKiBZb3UgY2FuIGNoYW5nZSB0aGUgZGF0YSBzZWxlY3RlZCBieSB5b3VyIHF1ZXJ5IGFueSB0aW1lIHlvdSB3YW50IHVzaW5nOlxuICpcbiAqICAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgICBwYWdpbmF0aW9uV2luZG93OiAyMDBcbiAqICAgICAgfSk7XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe1xuICogICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbi5pZCA9IFwiJyArIGNvbnYuaWQgKyBcIidcIlxuICogICAgICB9KTtcbiAqXG4gKiAgICAgLy8gT3IgdXNlIHRoZSBRdWVyeSBCdWlsZGVyOlxuICogICAgIHF1ZXJ5QnVpbGRlci5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgcXVlcnkudXBkYXRlKHF1ZXJ5QnVpbGRlcik7XG4gKlxuICogWW91IGNhbiByZWxlYXNlIENvbnZlcnNhdGlvbnMgYW5kIE1lc3NhZ2VzIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqICMjIyMgcHJlZGljYXRlXG4gKlxuICogTm90ZSB0aGF0IHRoZSBgcHJlZGljYXRlYCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgTWVzc2FnZXMsIGFuZCBvbmx5IHN1cHBvcnRzXG4gKiBxdWVyeWluZyBieSBDb252ZXJzYXRpb246IGBjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9VVUlVRCdgXG4gKlxuICogIyMjIyBzb3J0QnlcbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGBzb3J0QnlgIHByb3BlcnR5IGlzIG9ubHkgc3VwcG9ydGVkIGZvciBDb252ZXJzYXRpb25zIGF0IHRoaXMgdGltZSBhbmQgb25seVxuICogc3VwcG9ydHMgXCJjcmVhdGVkQXRcIiBhbmQgXCJsYXN0TWVzc2FnZS5zZW50QXRcIiBhcyBzb3J0IGZpZWxkcy5cbiAqXG4gKiAjIyMjIGRhdGFUeXBlXG4gKlxuICogVGhlIGxheWVyLlF1ZXJ5LmRhdGFUeXBlIHByb3BlcnR5IGxldHMgeW91IHNwZWNpZnkgd2hhdCB0eXBlIG9mIGRhdGEgc2hvd3MgdXAgaW4geW91ciByZXN1bHRzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5Lk1lc3NhZ2UsXG4gKiAgICAgcHJlZGljYXRlOiBcImNvbnZlcnNhdGlvbi5pZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWQnXCIsXG4gKiAgICAgZGF0YVR5cGU6IGxheWVyLlF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGVcbiAqIH0pXG4gKlxuICogdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgICBtb2RlbDogbGF5ZXIuUXVlcnkuTWVzc2FnZSxcbiAqICAgICBwcmVkaWNhdGU6IFwiY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCdcIixcbiAqICAgICBkYXRhVHlwZTogbGF5ZXIuUXVlcnkuT2JqZWN0RGF0YVR5cGVcbiAqIH0pXG4gKiBgYGBcbiAqXG4gKiBUaGUgcHJvcGVydHkgZGVmYXVsdHMgdG8gbGF5ZXIuUXVlcnkuSW5zdGFuY2VEYXRhVHlwZS4gIEluc3RhbmNlcyBzdXBwb3J0IG1ldGhvZHMgYW5kIGxldCB5b3Ugc3Vic2NyaWJlIHRvIGV2ZW50cyBmb3IgZGlyZWN0IG5vdGlmaWNhdGlvblxuICogb2YgY2hhbmdlcyB0byBhbnkgb2YgdGhlIHJlc3VsdHMgb2YgeW91ciBxdWVyeTpcbiAqXG4qIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5LmRhdGFbMF0ub24oJ21lc3NhZ2VzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgIGFsZXJ0KCdUaGUgZmlyc3QgbWVzc2FnZSBoYXMgaGFkIGEgcHJvcGVydHkgY2hhbmdlOyBwcm9iYWJseSBpc1JlYWQgb3IgcmVjaXBpZW50X3N0YXR1cyEnKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogQSB2YWx1ZSBvZiBsYXllci5RdWVyeS5PYmplY3REYXRhVHlwZSB3aWxsIGNhdXNlIHRoZSBkYXRhIHRvIGJlIGFuIGFycmF5IG9mIGltbXV0YWJsZSBvYmplY3RzIHJhdGhlciB0aGFuIGluc3RhbmNlcy4gIE9uZSBjYW4gc3RpbGwgZ2V0IGFuIGluc3RhbmNlIGZyb20gdGhlIFBPSk86XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIG0gPSBjbGllbnQuZ2V0TWVzc2FnZShxdWVyeS5kYXRhWzBdLmlkKTtcbiAqIG0ub24oJ21lc3NhZ2VzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgIGFsZXJ0KCdUaGUgZmlyc3QgbWVzc2FnZSBoYXMgaGFkIGEgcHJvcGVydHkgY2hhbmdlOyBwcm9iYWJseSBpc1JlYWQgb3IgcmVjaXBpZW50X3N0YXR1cyEnKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogIyMgUXVlcnkgRXZlbnRzXG4gKlxuICogUXVlcmllcyBmaXJlIGV2ZW50cyB3aGVuZXZlciB0aGVpciBkYXRhIGNoYW5nZXMuICBUaGVyZSBhcmUgNSB0eXBlcyBvZiBldmVudHM7XG4gKiBhbGwgZXZlbnRzIGFyZSByZWNlaXZlZCBieSBzdWJzY3JpYmluZyB0byB0aGUgYGNoYW5nZWAgZXZlbnQuXG4gKlxuICogIyMjIDEuIERhdGEgRXZlbnRzXG4gKlxuICogVGhlIERhdGEgZXZlbnQgaXMgZmlyZWQgd2hlbmV2ZXIgYSByZXF1ZXN0IGlzIHNlbnQgdG8gdGhlIHNlcnZlciBmb3IgbmV3IHF1ZXJ5IHJlc3VsdHMuICBUaGlzIGNvdWxkIGhhcHBlbiB3aGVuIGZpcnN0IGNyZWF0aW5nIHRoZSBxdWVyeSwgd2hlbiBwYWdpbmcgZm9yIG1vcmUgZGF0YSwgb3Igd2hlbiBjaGFuZ2luZyB0aGUgcXVlcnkncyBwcm9wZXJ0aWVzLCByZXN1bHRpbmcgaW4gYSBuZXcgcmVxdWVzdCB0byB0aGUgc2VydmVyLlxuICpcbiAqIFRoZSBFdmVudCBvYmplY3Qgd2lsbCBoYXZlIGFuIGBldnQuZGF0YWAgYXJyYXkgb2YgYWxsIG5ld2x5IGFkZGVkIHJlc3VsdHMuICBCdXQgZnJlcXVlbnRseSB5b3UgbWF5IGp1c3Qgd2FudCB0byB1c2UgdGhlIGBxdWVyeS5kYXRhYCBhcnJheSBhbmQgZ2V0IEFMTCByZXN1bHRzLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAnZGF0YScpIHtcbiAqICAgICAgdmFyIG5ld0RhdGEgPSBldnQuZGF0YTtcbiAqICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpkYXRhJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDIuIEluc2VydCBFdmVudHNcbiAqXG4gKiBBIG5ldyBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSB3YXMgY3JlYXRlZC4gSXQgbWF5IGhhdmUgYmVlbiBjcmVhdGVkIGxvY2FsbHkgYnkgeW91ciB1c2VyLCBvciBpdCBtYXkgaGF2ZSBiZWVuIHJlbW90ZWx5IGNyZWF0ZWQsIHJlY2VpdmVkIHZpYSB3ZWJzb2NrZXQsIGFuZCBhZGRlZCB0byB0aGUgUXVlcnkncyByZXN1bHRzLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyB0aGUgbmV3bHkgaW5zZXJ0ZWQgb2JqZWN0LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICBpZiAoZXZ0LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gKiAgICAgICB2YXIgbmV3SXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgYWxsRGF0YSA9IHF1ZXJ5LmRhdGE7XG4gKiAgICB9XG4gKiAgfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6aW5zZXJ0JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDMuIFJlbW92ZSBFdmVudHNcbiAqXG4gKiBBIENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIHdhcyBkZWxldGVkLiBUaGlzIG1heSBoYXZlIGJlZW4gZGVsZXRlZCBsb2NhbGx5IGJ5IHlvdXIgdXNlciwgb3IgaXQgbWF5IGhhdmUgYmVlbiByZW1vdGVseSBkZWxldGVkLCBhIG5vdGlmaWNhdGlvbiByZWNlaXZlZCB2aWEgd2Vic29ja2V0LCBhbmQgcmVtb3ZlZCBmcm9tIHRoZSBRdWVyeSByZXN1bHRzLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyB0aGUgcmVtb3ZlZCBvYmplY3QuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdyZW1vdmUnKSB7XG4gKiAgICAgICB2YXIgcmVtb3ZlZEl0ZW0gPSBldnQudGFyZ2V0O1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpyZW1vdmUnLCBmdW5jdGlvbihldnQpIHt9YCBpcyBhbHNvIHN1cHBvcnRlZC5cbiAqXG4gKiAjIyMgNC4gUmVzZXQgRXZlbnRzXG4gKlxuICogQW55IHRpbWUgeW91ciBxdWVyeSdzIG1vZGVsIG9yIHByZWRpY2F0ZSBwcm9wZXJ0aWVzIGhhdmUgYmVlbiBjaGFuZ2VkXG4gKiB0aGUgcXVlcnkgaXMgcmVzZXQsIGFuZCBhIG5ldyByZXF1ZXN0IGlzIHNlbnQgdG8gdGhlIHNlcnZlci4gIFRoZSByZXNldCBldmVudCBpbmZvcm1zIHlvdXIgVUkgdGhhdCB0aGUgY3VycmVudCByZXN1bHQgc2V0IGlzIGVtcHR5LCBhbmQgdGhhdCB0aGUgcmVhc29uIGl0cyBlbXB0eSBpcyB0aGF0IGl0IHdhcyBgcmVzZXRgLiAgVGhpcyBoZWxwcyBkaWZmZXJlbnRpYXRlIGl0IGZyb20gYSBgZGF0YWAgZXZlbnQgdGhhdCByZXR1cm5zIGFuIGVtcHR5IGFycmF5LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAncmVzZXQnKSB7XG4gKiAgICAgICB2YXIgYWxsRGF0YSA9IHF1ZXJ5LmRhdGE7IC8vIFtdXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOnJlc2V0JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDUuIFByb3BlcnR5IEV2ZW50c1xuICpcbiAqIElmIGFueSBwcm9wZXJ0aWVzIGNoYW5nZSBpbiBhbnkgb2YgdGhlIG9iamVjdHMgbGlzdGVkIGluIHlvdXIgbGF5ZXIuUXVlcnkuZGF0YSBwcm9wZXJ0eSwgYSBgcHJvcGVydHlgIGV2ZW50IHdpbGwgYmUgZmlyZWQuXG4gKlxuICogVGhlIGxheWVyLkxheWVyRXZlbnQudGFyZ2V0IHByb3BlcnR5IGNvbnRhaW5zIG9iamVjdCB0aGF0IHdhcyBtb2RpZmllZC5cbiAqXG4gKiBTZWUgbGF5ZXIuTGF5ZXJFdmVudC5jaGFuZ2VzIGZvciBkZXRhaWxzIG9uIGhvdyBjaGFuZ2VzIGFyZSByZXBvcnRlZC5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ3Byb3BlcnR5Jykge1xuICogICAgICAgdmFyIGNoYW5nZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBpc1JlYWRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2lzUmVhZCcpO1xuICogICAgICAgdmFyIHJlY2lwaWVudFN0YXR1c0NoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcigncmVjaXBpZW50U3RhdHVzJyk7XG4gKiAgICAgICBpZiAoaXNSZWFkQ2hhbmdlcy5sZW5ndGgpIHtcbiAqICAgICAgICAgICAuLi5cbiAqICAgICAgIH1cbiAqXG4gKiAgICAgICBpZiAocmVjaXBpZW50U3RhdHVzQ2hhbmdlcy5sZW5ndGgpIHtcbiAqICAgICAgICAgICAuLi5cbiAqICAgICAgIH1cbiAqICAgfVxuICogfSk7XG4gKmBgYFxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOnByb3BlcnR5JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDYuIE1vdmUgRXZlbnRzXG4gKlxuICogT2NjYXNpb25hbGx5LCBhIHByb3BlcnR5IGNoYW5nZSB3aWxsIGNhdXNlIGFuIGl0ZW0gdG8gYmUgc29ydGVkIGRpZmZlcmVudGx5LCBjYXVzaW5nIGEgTW92ZSBldmVudC5cbiAqIFRoZSBldmVudCB3aWxsIHRlbGwgeW91IHdoYXQgaW5kZXggdGhlIGl0ZW0gd2FzIGF0LCBhbmQgd2hlcmUgaXQgaGFzIG1vdmVkIHRvIGluIHRoZSBRdWVyeSByZXN1bHRzLlxuICogVGhpcyBpcyBjdXJyZW50bHkgb25seSBzdXBwb3J0ZWQgZm9yIENvbnZlcnNhdGlvbnMuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdtb3ZlJykge1xuICogICAgICAgdmFyIGNoYW5nZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBvbGRJbmRleCA9IGV2dC5mcm9tSW5kZXg7XG4gKiAgICAgICB2YXIgbmV3SW5kZXggPSBldnQubmV3SW5kZXg7XG4gKiAgICAgICB2YXIgbW92ZU5vZGUgPSBsaXN0LmNoaWxkTm9kZXNbb2xkSW5kZXhdO1xuICogICAgICAgbGlzdC5yZW1vdmVDaGlsZChtb3ZlTm9kZSk7XG4gKiAgICAgICBsaXN0Lmluc2VydEJlZm9yZShtb3ZlTm9kZSwgbGlzdC5jaGlsZE5vZGVzW25ld0luZGV4XSk7XG4gKiAgIH1cbiAqIH0pO1xuICpgYGBcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTptb3ZlJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogQGNsYXNzICBsYXllci5RdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICpcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuLi9sYXllci1lcnJvcicpO1xuY29uc3QgTG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XG5cbmNsYXNzIFF1ZXJ5IGV4dGVuZHMgUm9vdCB7XG5cbiAgY29uc3RydWN0b3IoLi4uYXJncykge1xuICAgIGxldCBvcHRpb25zO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMikge1xuICAgICAgb3B0aW9ucyA9IGFyZ3NbMV0uYnVpbGQoKTtcbiAgICAgIG9wdGlvbnMuY2xpZW50ID0gYXJnc1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IGFyZ3NbMF07XG4gICAgfVxuXG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5wcmVkaWNhdGUgPSB0aGlzLl9maXhQcmVkaWNhdGUob3B0aW9ucy5wcmVkaWNhdGUgfHwgJycpO1xuXG4gICAgaWYgKCdwYWdpbmF0aW9uV2luZG93JyBpbiBvcHRpb25zKSB7XG4gICAgICBjb25zdCBwYWdpbmF0aW9uV2luZG93ID0gb3B0aW9ucy5wYWdpbmF0aW9uV2luZG93O1xuICAgICAgdGhpcy5wYWdpbmF0aW9uV2luZG93ID0gTWF0aC5taW4odGhpcy5fZ2V0TWF4UGFnZVNpemUoKSwgb3B0aW9ucy5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIGlmIChvcHRpb25zLnBhZ2luYXRpb25XaW5kb3cgIT09IHBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgICAgTG9nZ2VyLndhcm4oYHBhZ2luYXRpb25XaW5kb3cgdmFsdWUgJHtwYWdpbmF0aW9uV2luZG93fSBpbiBRdWVyeSBjb25zdHJ1Y3RvciBgICtcbiAgICAgICAgICBgZXhjZWRlcyBRdWVyeS5NYXhQYWdlU2l6ZSBvZiAke3RoaXMuX2dldE1heFBhZ2VTaXplKCl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhID0gW107XG4gICAgdGhpcy5faW5pdGlhbFBhZ2luYXRpb25XaW5kb3cgPSB0aGlzLnBhZ2luYXRpb25XaW5kb3c7XG4gICAgaWYgKCF0aGlzLmNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICB0aGlzLmNsaWVudC5vbignYWxsJywgdGhpcy5faGFuZGxlRXZlbnRzLCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5jbGllbnQuaXNSZWFkeSkge1xuICAgICAgdGhpcy5jbGllbnQub25jZSgncmVhZHknLCAoKSA9PiB0aGlzLl9ydW4oKSwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3J1bigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwIGFuZCByZW1vdmUgdGhpcyBRdWVyeSwgaXRzIHN1YnNjcmlwdGlvbnMgYW5kIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgIHR5cGU6ICdkYXRhJyxcbiAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgICBxdWVyeTogdGhpcyxcbiAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICAgIHRoaXMuY2xpZW50Lm9mZihudWxsLCBudWxsLCB0aGlzKTtcbiAgICB0aGlzLmNsaWVudC5fcmVtb3ZlUXVlcnkodGhpcyk7XG4gICAgdGhpcy5kYXRhID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBtYXhpbXVtIG51bWJlciBvZiBpdGVtcyBhbGxvd2VkIGluIGEgcGFnZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRNYXhQYWdlU2l6ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgX2dldE1heFBhZ2VTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLk1heFBhZ2VTaXplO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgcHJvcGVydGllcyBvZiB0aGUgUXVlcnkuXG4gICAqXG4gICAqIEN1cnJlbnRseSBzdXBwb3J0cyB1cGRhdGluZzpcbiAgICpcbiAgICogKiBwYWdpbmF0aW9uV2luZG93XG4gICAqICogcHJlZGljYXRlXG4gICAqICogc29ydEJ5XG4gICAqXG4gICAqIEFueSBjaGFuZ2UgdG8gcHJlZGljYXRlIG9yIG1vZGVsIHJlc3VsdHMgaW4gY2xlYXJpbmcgYWxsIGRhdGEgZnJvbSB0aGVcbiAgICogcXVlcnkncyByZXN1bHRzIGFuZCB0cmlnZ2VyaW5nIGEgY2hhbmdlIGV2ZW50IHdpdGggW10gYXMgdGhlIG5ldyBkYXRhLlxuICAgKlxuICAgKiBgYGBcbiAgICogcXVlcnkudXBkYXRlKHtcbiAgICogICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogYGBgXG4gICAqIHF1ZXJ5LnVwZGF0ZSh7XG4gICAqICAgIHBhZ2luYXRpb25XaW5kb3c6IDEwMCxcbiAgICogICAgcHJlZGljYXRlOiAnY29udmVyc2F0aW9uLmlkID0gXCJsYXllcjovLy9jb252ZXJzYXRpb25zL1VVSURcIidcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBgYGBcbiAgICogcXVlcnkudXBkYXRlKHtcbiAgICogICAgc29ydEJ5OiBbe1wibGFzdE1lc3NhZ2Uuc2VudEF0XCI6IFwiZGVzY1wifV1cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByZWRpY2F0ZV0gLSBBIG5ldyBwcmVkaWNhdGUgZm9yIHRoZSBxdWVyeVxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZWxdIC0gQSBuZXcgbW9kZWwgZm9yIHRoZSBRdWVyeVxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2luYXRpb25XaW5kb3ddIC0gSW5jcmVhc2UvZGVjcmVhc2Ugb3VyIHJlc3VsdCBzaXplIHRvIG1hdGNoIHRoaXMgcGFnaW5hdGlvbiB3aW5kb3cuXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fSB0aGlzXG4gICAqL1xuICB1cGRhdGUob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IG5lZWRzUmVmcmVzaCxcbiAgICAgIG5lZWRzUmVjcmVhdGU7XG5cbiAgICBjb25zdCBvcHRpb25zQnVpbHQgPSAodHlwZW9mIG9wdGlvbnMuYnVpbGQgPT09ICdmdW5jdGlvbicpID8gb3B0aW9ucy5idWlsZCgpIDogb3B0aW9ucztcblxuICAgIGlmICgncGFnaW5hdGlvbldpbmRvdycgaW4gb3B0aW9uc0J1aWx0ICYmIHRoaXMucGFnaW5hdGlvbldpbmRvdyAhPT0gb3B0aW9uc0J1aWx0LnBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgIHRoaXMucGFnaW5hdGlvbldpbmRvdyA9IE1hdGgubWluKHRoaXMuX2dldE1heFBhZ2VTaXplKCkgKyB0aGlzLnNpemUsIG9wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIGlmICh0aGlzLnBhZ2luYXRpb25XaW5kb3cgPCBvcHRpb25zQnVpbHQucGFnaW5hdGlvbldpbmRvdykge1xuICAgICAgICBMb2dnZXIud2FybihgcGFnaW5hdGlvbldpbmRvdyB2YWx1ZSAke29wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93fSBpbiBRdWVyeS51cGRhdGUoKSBgICtcbiAgICAgICAgICBgaW5jcmVhc2VzIHNpemUgZ3JlYXRlciB0aGFuIFF1ZXJ5Lk1heFBhZ2VTaXplIG9mICR7dGhpcy5fZ2V0TWF4UGFnZVNpemUoKX1gKTtcbiAgICAgIH1cbiAgICAgIG5lZWRzUmVmcmVzaCA9IHRydWU7XG4gICAgfVxuICAgIGlmICgnbW9kZWwnIGluIG9wdGlvbnNCdWlsdCAmJiB0aGlzLm1vZGVsICE9PSBvcHRpb25zQnVpbHQubW9kZWwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkubW9kZWxJbW11dGFibGUpO1xuICAgIH1cblxuICAgIGlmICgncHJlZGljYXRlJyBpbiBvcHRpb25zQnVpbHQpIHtcbiAgICAgIGNvbnN0IHByZWRpY2F0ZSA9IHRoaXMuX2ZpeFByZWRpY2F0ZShvcHRpb25zQnVpbHQucHJlZGljYXRlIHx8ICcnKTtcbiAgICAgIGlmICh0aGlzLnByZWRpY2F0ZSAhPT0gcHJlZGljYXRlKSB7XG4gICAgICAgIHRoaXMucHJlZGljYXRlID0gcHJlZGljYXRlO1xuICAgICAgICBuZWVkc1JlY3JlYXRlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCdzb3J0QnknIGluIG9wdGlvbnNCdWlsdCAmJiBKU09OLnN0cmluZ2lmeSh0aGlzLnNvcnRCeSkgIT09IEpTT04uc3RyaW5naWZ5KG9wdGlvbnNCdWlsdC5zb3J0QnkpKSB7XG4gICAgICB0aGlzLnNvcnRCeSA9IG9wdGlvbnNCdWlsdC5zb3J0Qnk7XG4gICAgICBuZWVkc1JlY3JlYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG5lZWRzUmVjcmVhdGUpIHtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfVxuICAgIGlmIChuZWVkc1JlY3JlYXRlIHx8IG5lZWRzUmVmcmVzaCkgdGhpcy5fcnVuKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogTm9ybWFsaXplcyB0aGUgcHJlZGljYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9maXhQcmVkaWNhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGluVmFsdWVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9maXhQcmVkaWNhdGUoaW5WYWx1ZSkge1xuICAgIGlmIChpblZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnByZWRpY2F0ZU5vdFN1cHBvcnRlZCk7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgLyoqXG4gICAqIEFmdGVyIHJlZGVmaW5pbmcgdGhlIHF1ZXJ5LCByZXNldCBpdDogcmVtb3ZlIGFsbCBkYXRhL3Jlc2V0IGFsbCBzdGF0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLnRvdGFsU2l6ZSA9IDA7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLmNsaWVudC5fY2hlY2tBbmRQdXJnZUNhY2hlKGRhdGEpO1xuICAgIHRoaXMuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9wcmVkaWNhdGUgPSBudWxsO1xuICAgIHRoaXMuX25leHREQkZyb21JZCA9ICcnO1xuICAgIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSAnJztcbiAgICB0aGlzLl9pc1NlcnZlclN5bmNpbmcgPSBmYWxzZTtcbiAgICB0aGlzLnBhZ2VkVG9FbmQgPSBmYWxzZTtcbiAgICB0aGlzLnBhZ2luYXRpb25XaW5kb3cgPSB0aGlzLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdztcbiAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgIGRhdGE6IFtdLFxuICAgICAgdHlwZTogJ3Jlc2V0JyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB5b3VyIHF1ZXJ5IHRvIGl0cyBpbml0aWFsIHN0YXRlIGFuZCB0aGVuIHJlcnVuIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIHJlc2V0XG4gICAqL1xuICByZXNldCgpIHtcbiAgICBpZiAodGhpcy5faXNTeW5jaW5nSWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9pc1N5bmNpbmdJZCk7XG4gICAgICB0aGlzLl9pc1N5bmNpbmdJZCA9IDA7XG4gICAgfVxuICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgdGhpcy5fcnVuKCk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgcXVlcnkuXG4gICAqXG4gICAqIE5vLCBkb24ndCBtdXJkZXIgaXQsIGp1c3QgZmlyZSBpdC4gIE5vLCBkb24ndCBtYWtlIGl0IHVuZW1wbG95ZWQsXG4gICAqIGp1c3QgY29ubmVjdCB0byB0aGUgc2VydmVyIGFuZCBnZXQgdGhlIHJlc3VsdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1blxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3J1bigpIHtcbiAgICAvLyBGaW5kIHRoZSBudW1iZXIgb2YgaXRlbXMgd2UgbmVlZCB0byByZXF1ZXN0LlxuICAgIGNvbnN0IHBhZ2VTaXplID0gTWF0aC5taW4odGhpcy5wYWdpbmF0aW9uV2luZG93IC0gdGhpcy5zaXplLCB0aGlzLl9nZXRNYXhQYWdlU2l6ZSgpKTtcblxuICAgIC8vIElmIHRoZXJlIGlzIGEgcmVkdWN0aW9uIGluIHBhZ2luYXRpb24gd2luZG93LCB0aGVuIHRoaXMgdmFyaWFibGUgd2lsbCBiZSBuZWdhdGl2ZSwgYW5kIHdlIGNhbiBzaHJpbmtcbiAgICAvLyB0aGUgZGF0YS5cbiAgICBpZiAocGFnZVNpemUgPCAwKSB7XG4gICAgICBjb25zdCByZW1vdmVkRGF0YSA9IHRoaXMuZGF0YS5zbGljZSh0aGlzLnBhZ2luYXRpb25XaW5kb3cpO1xuICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLnNsaWNlKDAsIHRoaXMucGFnaW5hdGlvbldpbmRvdyk7XG4gICAgICB0aGlzLmNsaWVudC5fY2hlY2tBbmRQdXJnZUNhY2hlKHJlbW92ZWREYXRhKTtcbiAgICAgIHRoaXMucGFnZWRUb0VuZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjaGFuZ2UnLCB7IGRhdGE6IFtdIH0pO1xuICAgIH0gZWxzZSBpZiAocGFnZVNpemUgPT09IDAgfHwgdGhpcy5wYWdlZFRvRW5kKSB7XG4gICAgICAvLyBObyBuZWVkIHRvIGxvYWQgMCByZXN1bHRzLlxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9mZXRjaERhdGEocGFnZVNpemUpO1xuICAgIH1cbiAgfVxuXG4gIF9mZXRjaERhdGEocGFnZVNpemUpIHtcbiAgICAvLyBOb29wXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgc29ydCBmaWVsZCBmb3IgdGhlIHF1ZXJ5LlxuICAgKlxuICAgKiBSZXR1cm5zIE9uZSBvZjpcbiAgICpcbiAgICogKiAncG9zaXRpb24nIChNZXNzYWdlcyBvbmx5KVxuICAgKiAqICdsYXN0X21lc3NhZ2UnIChDb252ZXJzYXRpb25zIG9ubHkpXG4gICAqICogJ2NyZWF0ZWRfYXQnIChDb252ZXJzYXRpb25zIG9ubHkpXG4gICAqIEBtZXRob2QgX2dldFNvcnRGaWVsZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IHNvcnQga2V5IHVzZWQgYnkgc2VydmVyXG4gICAqL1xuICBfZ2V0U29ydEZpZWxkKCkge1xuICAgIC8vIE5vb3BcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSByZXN1bHRzIG9mIHRoZSBgX3J1bmAgbWV0aG9kOyBjYWxscyBfX2FwcGVuZFJlc3VsdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NSdW5SZXN1bHRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0cyAtIEZ1bGwgeGhyIHJlc3BvbnNlIG9iamVjdCB3aXRoIHNlcnZlciByZXN1bHRzXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBwYWdlU2l6ZSAtIE51bWJlciBvZiBlbnRyaWVzIHRoYXQgd2VyZSByZXF1ZXN0ZWRcbiAgICovXG4gIF9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCByZXF1ZXN0VXJsLCBwYWdlU2l6ZSkge1xuICAgIGlmIChyZXF1ZXN0VXJsICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0IHx8IHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICBjb25zdCBpc1N5bmNpbmcgPSByZXN1bHRzLnhoci5nZXRSZXNwb25zZUhlYWRlcignTGF5ZXItQ29udmVyc2F0aW9uLUlzLVN5bmNpbmcnKSA9PT0gJ3RydWUnO1xuXG5cbiAgICAvLyBpc0ZpcmluZyBpcyBmYWxzZS4uLiB1bmxlc3Mgd2UgYXJlIHN0aWxsIHN5bmNpbmdcbiAgICB0aGlzLmlzRmlyaW5nID0gaXNTeW5jaW5nO1xuICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSAnJztcbiAgICBpZiAocmVzdWx0cy5zdWNjZXNzKSB7XG4gICAgICBpZiAoaXNTeW5jaW5nKSB7XG4gICAgICAgIHRoaXMuX2lzU3luY2luZ0lkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5faXNTeW5jaW5nSWQgPSAwO1xuICAgICAgICAgIHRoaXMuX3J1bigpO1xuICAgICAgICB9LCAxNTAwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2lzU3luY2luZ0lkID0gMDtcbiAgICAgICAgdGhpcy5fYXBwZW5kUmVzdWx0cyhyZXN1bHRzLCBmYWxzZSk7XG4gICAgICAgIHRoaXMudG90YWxTaXplID0gTnVtYmVyKHJlc3VsdHMueGhyLmdldFJlc3BvbnNlSGVhZGVyKCdMYXllci1Db3VudCcpKTtcblxuICAgICAgICBpZiAocmVzdWx0cy5kYXRhLmxlbmd0aCA8IHBhZ2VTaXplKSB0aGlzLnBhZ2VkVG9FbmQgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogcmVzdWx0cy5kYXRhIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFycmF5cyBvZiBkYXRhIHRvIHRoZSBRdWVyeSByZXN1bHRzLlxuICAgKlxuICAgKiBAbWV0aG9kICBfYXBwZW5kUmVzdWx0c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2FwcGVuZFJlc3VsdHMocmVzdWx0cywgZnJvbURiKSB7XG4gICAgLy8gRm9yIGFsbCByZXN1bHRzLCByZWdpc3RlciB0aGVtIHdpdGggdGhlIGNsaWVudFxuICAgIC8vIElmIGFscmVhZHkgcmVnaXN0ZXJlZCB3aXRoIHRoZSBjbGllbnQsIHByb3BlcnRpZXMgd2lsbCBiZSB1cGRhdGVkIGFzIG5lZWRlZFxuICAgIC8vIERhdGFiYXNlIHJlc3VsdHMgcmF0aGVyIHRoYW4gc2VydmVyIHJlc3VsdHMgd2lsbCBhcnJpdmUgYWxyZWFkeSByZWdpc3RlcmVkLlxuICAgIHJlc3VsdHMuZGF0YS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICBpZiAoIShpdGVtIGluc3RhbmNlb2YgUm9vdCkpIHRoaXMuY2xpZW50Ll9jcmVhdGVPYmplY3QoaXRlbSk7XG4gICAgfSk7XG5cbiAgICAvLyBGaWx0ZXIgcmVzdWx0cyB0byBqdXN0IHRoZSBuZXcgcmVzdWx0c1xuICAgIGNvbnN0IG5ld1Jlc3VsdHMgPSByZXN1bHRzLmRhdGEuZmlsdGVyKGl0ZW0gPT4gdGhpcy5fZ2V0SW5kZXgoaXRlbS5pZCkgPT09IC0xKTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgbmV4dCBJRCB0byB1c2UgaW4gcGFnaW5hdGlvblxuICAgIGNvbnN0IHJlc3VsdExlbmd0aCA9IHJlc3VsdHMuZGF0YS5sZW5ndGg7XG4gICAgaWYgKHJlc3VsdExlbmd0aCkge1xuICAgICAgaWYgKGZyb21EYikge1xuICAgICAgICB0aGlzLl9uZXh0REJGcm9tSWQgPSByZXN1bHRzLmRhdGFbcmVzdWx0TGVuZ3RoIC0gMV0uaWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gcmVzdWx0cy5kYXRhW3Jlc3VsdExlbmd0aCAtIDFdLmlkO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSB0aGlzLmRhdGFcbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIHRoaXMuZGF0YSA9IFtdLmNvbmNhdCh0aGlzLmRhdGEpO1xuICAgIH1cblxuICAgIC8vIEluc2VydCB0aGUgcmVzdWx0cy4uLiBpZiB0aGUgcmVzdWx0cyBhcmUgYSBtYXRjaFxuICAgIG5ld1Jlc3VsdHMuZm9yRWFjaCgoaXRlbUluKSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5jbGllbnQuZ2V0T2JqZWN0KGl0ZW1Jbi5pZCk7XG4gICAgICBpZiAoaXRlbSkgdGhpcy5fYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKTtcbiAgICB9KTtcblxuXG4gICAgLy8gVHJpZ2dlciB0aGUgY2hhbmdlIGV2ZW50XG4gICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICB0eXBlOiAnZGF0YScsXG4gICAgICBkYXRhOiBuZXdSZXN1bHRzLm1hcChpdGVtID0+IHRoaXMuX2dldERhdGEodGhpcy5jbGllbnQuZ2V0T2JqZWN0KGl0ZW0uaWQpKSksXG4gICAgICBxdWVyeTogdGhpcyxcbiAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgfSk7XG4gIH1cblxuICBfYXBwZW5kUmVzdWx0c1NwbGljZShpdGVtKSB7XG4gICAgLy8gTm9vcFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBjb3JyZWN0bHkgZm9ybWF0dGVkIG9iamVjdCByZXByZXNlbnRpbmcgYSByZXN1bHQuXG4gICAqXG4gICAqIEZvcm1hdCBpcyBzcGVjaWZpZWQgYnkgdGhlIGBkYXRhVHlwZWAgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdH0gaXRlbSAtIENvbnZlcnNhdGlvbiwgTWVzc2FnZSwgZXRjLi4uIGluc3RhbmNlXG4gICAqIEByZXR1cm4ge09iamVjdH0gLSBDb252ZXJzYXRpb24sIE1lc3NhZ2UsIGV0Yy4uLiBpbnN0YW5jZSBvciBPYmplY3RcbiAgICovXG4gIF9nZXREYXRhKGl0ZW0pIHtcbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIHJldHVybiBpdGVtLnRvT2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gaW5zdGFuY2UgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBpbnB1dCBpcyBpbnN0YW5jZSBvciBvYmplY3RcbiAgICogQG1ldGhvZCBfZ2V0SW5zdGFuY2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Sb290fE9iamVjdH0gaXRlbSAtIENvbnZlcnNhdGlvbiwgTWVzc2FnZSwgZXRjLi4uIG9iamVjdC9pbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgX2dldEluc3RhbmNlKGl0ZW0pIHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIFJvb3QpIHJldHVybiBpdGVtO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5nZXRPYmplY3QoaXRlbS5pZCk7XG4gIH1cblxuICAvKipcbiAgICogQXNrIHRoZSBxdWVyeSBmb3IgdGhlIGl0ZW0gbWF0Y2hpbmcgdGhlIElELlxuICAgKlxuICAgKiBSZXR1cm5zIHVuZGVmaW5lZCBpZiB0aGUgSUQgaXMgbm90IGZvdW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJdGVtXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAgICogQHJldHVybiB7T2JqZWN0fSBDb252ZXJzYXRpb24sIE1lc3NhZ2UsIGV0Yy4uLiBvYmplY3Qgb3IgaW5zdGFuY2VcbiAgICovXG4gIF9nZXRJdGVtKGlkKSB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZCk7XG4gICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IG51bGwgOiB0aGlzLmRhdGFbaW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgaW5kZXggb2YgdGhlIGl0ZW0gcmVwcmVzZW50ZWQgYnkgdGhlIHNwZWNpZmllZCBJRDsgb3IgcmV0dXJuIC0xLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJbmRleFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAqIEByZXR1cm4ge251bWJlcn1cbiAgICovXG4gIF9nZXRJbmRleChpZCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBpZiAodGhpcy5kYXRhW2luZGV4XS5pZCA9PT0gaWQpIHJldHVybiBpbmRleDtcbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhbnkgY2hhbmdlIGV2ZW50IHJlY2VpdmVkIGZyb20gdGhlIGxheWVyLkNsaWVudC5cbiAgICpcbiAgICogVGhlc2UgY2FuIGJlIGNhdXNlZCBieSB3ZWJzb2NrZXQgZXZlbnRzLCBhcyB3ZWxsIGFzIGxvY2FsXG4gICAqIHJlcXVlc3RzIHRvIGNyZWF0ZS9kZWxldGUvbW9kaWZ5IENvbnZlcnNhdGlvbnMgYW5kIE1lc3NhZ2VzLlxuICAgKlxuICAgKiBUaGUgZXZlbnQgZG9lcyBub3QgbmVjZXNzYXJpbHkgYXBwbHkgdG8gdGhpcyBRdWVyeSwgYnV0IHRoZSBRdWVyeVxuICAgKiBtdXN0IGV4YW1pbmUgaXQgdG8gZGV0ZXJtaW5lIGlmIGl0IGFwcGxpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIC0gXCJtZXNzYWdlczphZGRcIiwgXCJjb252ZXJzYXRpb25zOmNoYW5nZVwiXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlRXZlbnRzKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgLy8gTm9vcFxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIGNoYW5nZSBldmVudC4uLiBmb3IgbW9kZWxzIHRoYXQgZG9uJ3QgcmVxdWlyZSBjdXN0b20gaGFuZGxpbmdcbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlRXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYW5kbGVDaGFuZ2VFdmVudChuYW1lLCBldnQpIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGV2dC50YXJnZXQuaWQpO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgIGV2dC50YXJnZXQudG9PYmplY3QoKSxcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQWRkRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgY29uc3QgbGlzdCA9IGV2dFtuYW1lXVxuICAgICAgLmZpbHRlcihvYmogPT4gdGhpcy5fZ2V0SW5kZXgob2JqLmlkKSA9PT0gLTEpXG4gICAgICAubWFwKG9iaiA9PiB0aGlzLl9nZXREYXRhKG9iaikpO1xuXG4gICAgLy8gQWRkIHRoZW0gdG8gb3VyIHJlc3VsdCBzZXQgYW5kIHRyaWdnZXIgYW4gZXZlbnQgZm9yIGVhY2ggb25lXG4gICAgaWYgKGxpc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhID0gdGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUgPyBbXS5jb25jYXQodGhpcy5kYXRhKSA6IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaChpdGVtID0+IGRhdGEucHVzaChpdGVtKSk7XG5cbiAgICAgIHRoaXMudG90YWxTaXplICs9IGxpc3QubGVuZ3RoO1xuXG4gICAgICAvLyBJbmRleCBjYWxjdWxhdGVkIGFib3ZlIG1heSBzaGlmdCBhZnRlciBhZGRpdGlvbmFsIGluc2VydGlvbnMuICBUaGlzIGhhc1xuICAgICAgLy8gdG8gYmUgZG9uZSBhZnRlciB0aGUgYWJvdmUgaW5zZXJ0aW9ucyBoYXZlIGNvbXBsZXRlZC5cbiAgICAgIGxpc3QuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICBpbmRleDogdGhpcy5kYXRhLmluZGV4T2YoaXRlbSksXG4gICAgICAgICAgdGFyZ2V0OiBpdGVtLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVSZW1vdmVFdmVudChuYW1lLCBldnQpIHtcbiAgICBjb25zdCByZW1vdmVkID0gW107XG4gICAgZXZ0W25hbWVdLmZvckVhY2goKG9iaikgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChvYmouaWQpO1xuXG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGlmIChvYmouaWQgPT09IHRoaXMuX25leHREQkZyb21JZCkgdGhpcy5fbmV4dERCRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIGlmIChvYmouaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBvYmosXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShyZW1vdmVkT2JqLmRhdGEpLFxuICAgICAgICBpbmRleDogcmVtb3ZlZE9iai5pbmRleCxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgY3VycmVudCBuZXh0LWlkIGlzIHJlbW92ZWQgZnJvbSB0aGUgbGlzdCwgZ2V0IGEgbmV3IG5leHRJZC5cbiAgICpcbiAgICogSWYgdGhlIGluZGV4IGlzIGdyZWF0ZXIgdGhhbiAwLCB3aGF0ZXZlciBpcyBhZnRlciB0aGF0IGluZGV4IG1heSBoYXZlIGNvbWUgZnJvbVxuICAgKiB3ZWJzb2NrZXRzIG9yIG90aGVyIHNvdXJjZXMsIHNvIGRlY3JlbWVudCB0aGUgaW5kZXggdG8gZ2V0IHRoZSBuZXh0IHNhZmUgcGFnaW5nIGlkLlxuICAgKlxuICAgKiBJZiB0aGUgaW5kZXggaWYgMCwgZXZlbiBpZiB0aGVyZSBpcyBkYXRhLCB0aGF0IGRhdGEgZGlkIG5vdCBjb21lIGZyb20gcGFnaW5nIGFuZFxuICAgKiBjYW4gbm90IGJlIHVzZWQgc2FmZWx5IGFzIGEgcGFnaW5nIGlkOyByZXR1cm4gJyc7XG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZU5leHRGcm9tSWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gQ3VycmVudCBpbmRleCBvZiB0aGUgbmV4dEZyb21JZFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIE5leHQgSUQgb3IgZW1wdHkgc3RyaW5nXG4gICAqL1xuICBfdXBkYXRlTmV4dEZyb21JZChpbmRleCkge1xuICAgIGlmIChpbmRleCA+IDApIHJldHVybiB0aGlzLmRhdGFbaW5kZXggLSAxXS5pZDtcbiAgICBlbHNlIHJldHVybiAnJztcbiAgfVxuXG4gIC8qXG4gICAqIElmIHRoaXMgaXMgZXZlciBjaGFuZ2VkIHRvIGJlIGFzeW5jLCBtYWtlIHN1cmUgdGhhdCBkZXN0cm95KCkgc3RpbGwgdHJpZ2dlcnMgc3luY2hyb25vdXMgZXZlbnRzXG4gICAqL1xuICBfdHJpZ2dlckNoYW5nZShldnQpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCB8fCB0aGlzLmNsaWVudC5faW5DbGVhbnVwKSByZXR1cm47XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCBldnQpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgfVxuXG4gIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmlkO1xuICB9XG59XG5cblxuUXVlcnkucHJlZml4VVVJRCA9ICdsYXllcjovLy9xdWVyaWVzLyc7XG5cbi8qKlxuICogUXVlcnkgZm9yIENvbnZlcnNhdGlvbnMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuQ29udmVyc2F0aW9uID0gJ0NvbnZlcnNhdGlvbic7XG5cbi8qKlxuICogUXVlcnkgZm9yIENoYW5uZWxzLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5LkNoYW5uZWwgPSAnQ2hhbm5lbCc7XG5cbi8qKlxuICogUXVlcnkgZm9yIE1lc3NhZ2VzLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lk1lc3NhZ2UgPSAnTWVzc2FnZSc7XG5cbi8qKlxuICogUXVlcnkgZm9yIEFubm91bmNlbWVudHMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuQW5ub3VuY2VtZW50ID0gJ0Fubm91bmNlbWVudCc7XG5cbi8qKlxuICogUXVlcnkgZm9yIElkZW50aXRpZXMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuSWRlbnRpdHkgPSAnSWRlbnRpdHknO1xuXG4vKipcbiAqIFF1ZXJ5IGZvciBNZW1iZXJzIG9mIGEgQ2hhbm5lbC5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5NZW1iZXJzaGlwID0gJ01lbWJlcnNoaXAnO1xuXG4vKipcbiAqIEdldCBkYXRhIGFzIFBPSk9zL2ltbXV0YWJsZSBvYmplY3RzLlxuICpcbiAqIFRoaXMgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuZGF0YVR5cGUgd2lsbCBjYXVzZSB5b3VyIFF1ZXJ5IGRhdGEgYW5kIGV2ZW50cyB0byBwcm92aWRlIE1lc3NhZ2VzL0NvbnZlcnNhdGlvbnMgYXMgaW1tdXRhYmxlIG9iamVjdHMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuT2JqZWN0RGF0YVR5cGUgPSAnb2JqZWN0JztcblxuLyoqXG4gKiBHZXQgZGF0YSBhcyBpbnN0YW5jZXMgb2YgbGF5ZXIuTWVzc2FnZSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLlxuICpcbiAqIFRoaXMgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuZGF0YVR5cGUgd2lsbCBjYXVzZSB5b3VyIFF1ZXJ5IGRhdGEgYW5kIGV2ZW50cyB0byBwcm92aWRlIE1lc3NhZ2VzL0NvbnZlcnNhdGlvbnMgYXMgaW5zdGFuY2VzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGUgPSAnaW5zdGFuY2UnO1xuXG4vKipcbiAqIFNldCB0aGUgbWF4aW11bSBwYWdlIHNpemUgZm9yIHF1ZXJpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuTWF4UGFnZVNpemUgPSAxMDA7XG5cbi8qKlxuICogQWNjZXNzIHRoZSBudW1iZXIgb2YgcmVzdWx0cyBjdXJyZW50bHkgbG9hZGVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFF1ZXJ5LnByb3RvdHlwZSwgJ3NpemUnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiAhdGhpcy5kYXRhID8gMCA6IHRoaXMuZGF0YS5sZW5ndGg7XG4gIH0sXG59KTtcblxuLyoqIEFjY2VzcyB0aGUgdG90YWwgbnVtYmVyIG9mIHJlc3VsdHMgb24gdGhlIHNlcnZlci5cbiAqXG4gKiBXaWxsIGJlIDAgdW50aWwgdGhlIGZpcnN0IHF1ZXJ5IGhhcyBzdWNjZXNzZnVsbHkgbG9hZGVkIHJlc3VsdHMuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUudG90YWxTaXplID0gMDtcblxuXG4vKipcbiAqIEFjY2VzcyB0byB0aGUgY2xpZW50IHNvIGl0IGNhbiBsaXN0ZW4gdG8gd2Vic29ja2V0IGFuZCBsb2NhbCBldmVudHMuXG4gKlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqIEBwcm90ZWN0ZWRcbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBRdWVyeSByZXN1bHRzLlxuICpcbiAqIEFycmF5IG9mIGRhdGEgcmVzdWx0aW5nIGZyb20gdGhlIFF1ZXJ5OyBlaXRoZXIgYSBsYXllci5Sb290IHN1YmNsYXNzLlxuICpcbiAqIG9yIHBsYWluIE9iamVjdHNcbiAqIEB0eXBlIHtPYmplY3RbXX1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuZGF0YSA9IG51bGw7XG5cbi8qKlxuICogU3BlY2lmaWVzIHRoZSB0eXBlIG9mIGRhdGEgYmVpbmcgcXVlcmllZCBmb3IuXG4gKlxuICogTW9kZWwgaXMgb25lIG9mXG4gKlxuICogKiBsYXllci5RdWVyeS5Db252ZXJzYXRpb25cbiAqICogbGF5ZXIuUXVlcnkuQ2hhbm5lbFxuICogKiBsYXllci5RdWVyeS5NZXNzYWdlXG4gKiAqIGxheWVyLlF1ZXJ5LkFubm91bmNlbWVudFxuICogKiBsYXllci5RdWVyeS5JZGVudGl0eVxuICpcbiAqIFZhbHVlIGNhbiBiZSBzZXQgdmlhIGNvbnN0cnVjdG9yIGFuZCBsYXllci5RdWVyeS51cGRhdGUoKS5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5tb2RlbCA9ICcnO1xuXG4vKipcbiAqIFdoYXQgdHlwZSBvZiByZXN1bHRzIHRvIHJlcXVlc3Qgb2YgdGhlIHNlcnZlci5cbiAqXG4gKiBOb3QgeWV0IHN1cHBvcnRlZDsgcmV0dXJuVHlwZSBpcyBvbmUgb2ZcbiAqXG4gKiAqIG9iamVjdFxuICogKiBpZFxuICogKiBjb3VudFxuICpcbiAqICBWYWx1ZSBzZXQgdmlhIGNvbnN0cnVjdG9yLlxuICsgKlxuICogVGhpcyBRdWVyeSBBUEkgaXMgZGVzaWduZWQgb25seSBmb3IgdXNlIHdpdGggJ29iamVjdCcgYXQgdGhpcyB0aW1lOyB3YWl0aW5nIGZvciB1cGRhdGVzIHRvIHNlcnZlciBmb3JcbiAqIHRoaXMgZnVuY3Rpb25hbGl0eS5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5yZXR1cm5UeXBlID0gJ29iamVjdCc7XG5cbi8qKlxuICogU3BlY2lmeSB3aGF0IGtpbmQgb2YgZGF0YSBhcnJheSB5b3VyIGFwcGxpY2F0aW9uIHJlcXVpcmVzLlxuICpcbiAqIFVzZWQgdG8gc3BlY2lmeSBxdWVyeSBkYXRhVHlwZS4gIE9uZSBvZlxuICogKiBRdWVyeS5PYmplY3REYXRhVHlwZVxuICogKiBRdWVyeS5JbnN0YW5jZURhdGFUeXBlXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuZGF0YVR5cGUgPSBRdWVyeS5JbnN0YW5jZURhdGFUeXBlO1xuXG4vKipcbiAqIE51bWJlciBvZiByZXN1bHRzIGZyb20gdGhlIHNlcnZlciB0byByZXF1ZXN0L2NhY2hlLlxuICpcbiAqIFRoZSBwYWdpbmF0aW9uIHdpbmRvdyBjYW4gYmUgaW5jcmVhc2VkIHRvIGRvd25sb2FkIGFkZGl0aW9uYWwgaXRlbXMsIG9yIGRlY3JlYXNlZCB0byBwdXJnZSByZXN1bHRzXG4gKiBmcm9tIHRoZSBkYXRhIHByb3BlcnR5LlxuICpcbiAqICAgICBxdWVyeS51cGRhdGUoe1xuICogICAgICAgcGFnaW5hdGlvbldpbmRvdzogMTUwXG4gKiAgICAgfSlcbiAqXG4gKiBUaGlzIGNhbGwgd2lsbCBhaW0gdG8gYWNoaWV2ZSAxNTAgcmVzdWx0cy4gIElmIGl0IHByZXZpb3VzbHkgaGFkIDEwMCxcbiAqIHRoZW4gaXQgd2lsbCBsb2FkIDUwIG1vcmUuIElmIGl0IHByZXZpb3VzbHkgaGFkIDIwMCwgaXQgd2lsbCBkcm9wIDUwLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc2VydmVyIHdpbGwgb25seSBwZXJtaXQgMTAwIGF0IGEgdGltZS5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93ID0gMTAwO1xuXG4vKipcbiAqIFNvcnRpbmcgY3JpdGVyaWEgZm9yIENvbnZlcnNhdGlvbiBRdWVyaWVzLlxuICpcbiAqIE9ubHkgc3VwcG9ydHMgYW4gYXJyYXkgb2Ygb25lIGZpZWxkL2VsZW1lbnQuXG4gKiBPbmx5IHN1cHBvcnRzIHRoZSBmb2xsb3dpbmcgb3B0aW9uczpcbiAqXG4gKiBgYGBcbiAqIHF1ZXJ5LnVwZGF0ZSh7c29ydEJ5OiBbeydjcmVhdGVkQXQnOiAnZGVzYyd9XX0pXG4gKiBxdWVyeS51cGRhdGUoe3NvcnRCeTogW3snbGFzdE1lc3NhZ2Uuc2VudEF0JzogJ2Rlc2MnfV1cbiAqXG4gKiBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICBzb3J0Qnk6IFt7J2xhc3RNZXNzYWdlLnNlbnRBdCc6ICdkZXNjJ31dXG4gKiB9KTtcbiAqIGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgIHNvcnRCeTogW3snbGFzdE1lc3NhZ2Uuc2VudEF0JzogJ2Rlc2MnfV1cbiAqIH0pO1xuICogYGBgXG4gKlxuICogV2h5IHN1Y2ggbGltaXRhdGlvbnM/IFdoeSB0aGlzIHN0cnVjdHVyZT8gIFRoZSBzZXJ2ZXIgd2lsbCBiZSBleHBvc2luZyBhIFF1ZXJ5IEFQSSBhdCB3aGljaCBwb2ludCB0aGVcbiAqIGFib3ZlIHNvcnQgb3B0aW9ucyB3aWxsIG1ha2UgYSBsb3QgbW9yZSBzZW5zZSwgYW5kIGZ1bGwgc29ydGluZyB3aWxsIGJlIHByb3ZpZGVkLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnNvcnRCeSA9IG51bGw7XG5cbi8qKlxuICogVGhpcyB2YWx1ZSB0ZWxscyB1cyB3aGF0IHRvIHJlc2V0IHRoZSBwYWdpbmF0aW9uV2luZG93IHRvIHdoZW4gdGhlIHF1ZXJ5IGlzIHJlZGVmaW5lZC5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHByaXZhdGVcbiAqL1xuUXVlcnkucHJvdG90eXBlLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdyA9IDEwMDtcblxuLyoqXG4gKiBZb3VyIFF1ZXJ5J3MgV0hFUkUgY2xhdXNlLlxuICpcbiAqIEN1cnJlbnRseSwgdGhlIG9ubHkgcXVlcmllcyBzdXBwb3J0ZWQgYXJlOlxuICpcbiAqIGBgYFxuICogIFwiY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCdcIlxuICogIFwiY2hhbm5lbC5pZCA9ICdsYXllcjovLy9jaGFubmVscy91dWlkXCJcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBib3RoICcgYW5kIFwiIGFyZSBzdXBwb3J0ZWQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUucHJlZGljYXRlID0gbnVsbDtcblxuLyoqXG4gKiBUcnVlIGlmIHRoZSBRdWVyeSBpcyBjb25uZWN0aW5nIHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogSXQgaXMgbm90IGdhdXJlbnRlZWQgdGhhdCBldmVyeSBgdXBkYXRlKClgIHdpbGwgZmlyZSBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAqIEZvciBleGFtcGxlLCB1cGRhdGluZyBhIHBhZ2luYXRpb25XaW5kb3cgdG8gYmUgc21hbGxlcixcbiAqIE9yIGNoYW5naW5nIGEgdmFsdWUgdG8gdGhlIGV4aXN0aW5nIHZhbHVlIHdvdWxkIGNhdXNlIHRoZSByZXF1ZXN0IG5vdCB0byBmaXJlLlxuICpcbiAqIFJlY29tbWVuZGVkIHBhdHRlcm4gaXM6XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe3BhZ2luYXRpb25XaW5kb3c6IDUwfSk7XG4gKiAgICAgIGlmICghcXVlcnkuaXNGaXJpbmcpIHtcbiAqICAgICAgICBhbGVydChcIkRvbmVcIik7XG4gKiAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgICBxdWVyeS5vbmNlKFwiY2hhbmdlXCIsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgICAgICAgICBpZiAoZXZ0LnR5cGUgPT0gXCJkYXRhXCIpIGFsZXJ0KFwiRG9uZVwiKTtcbiAqICAgICAgICAgIH0pO1xuICogICAgICB9XG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLmlzRmlyaW5nID0gZmFsc2U7XG5cbi8qKlxuICogVHJ1ZSBpZiB3ZSBoYXZlIHJlYWNoZWQgdGhlIGxhc3QgcmVzdWx0LCBhbmQgZnVydGhlciBwYWdpbmcgd2lsbCBqdXN0IHJldHVybiBbXVxuICpcbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5wYWdlZFRvRW5kID0gZmFsc2U7XG5cbi8qKlxuICogVGhlIGxhc3QgcmVxdWVzdCBmaXJlZC5cbiAqXG4gKiBJZiBtdWx0aXBsZSByZXF1ZXN0cyBhcmUgaW5mbGlnaHQsIHRoZSByZXNwb25zZVxuICogbWF0Y2hpbmcgdGhpcyByZXF1ZXN0IGlzIHRoZSBPTkxZIHJlc3BvbnNlIHdlIHdpbGwgcHJvY2Vzcy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5RdWVyeS5wcm90b3R5cGUuX2ZpcmluZ1JlcXVlc3QgPSAnJztcblxuLyoqXG4gKiBUaGUgSUQgdG8gdXNlIGluIHBhZ2luZyB0aGUgc2VydmVyLlxuICpcbiAqIFdoeSBub3QganVzdCB1c2UgdGhlIElEIG9mIHRoZSBsYXN0IGl0ZW0gaW4gb3VyIHJlc3VsdCBzZXQ/XG4gKiBCZWNhdXNlIGFzIHdlIHJlY2VpdmUgd2Vic29ja2V0IGV2ZW50cywgd2UgaW5zZXJ0IGFuZCBhcHBlbmQgaXRlbXMgdG8gb3VyIGRhdGEuXG4gKiBUaGF0IHdlYnNvY2tldCBldmVudCBtYXkgbm90IGluIGZhY3QgZGVsaXZlciB0aGUgTkVYVCBpdGVtIGluIG91ciBkYXRhLCBidXQgc2ltcGx5IGFuIGl0ZW0sIHRoYXQgc2VxdWVudGlhbGx5XG4gKiBiZWxvbmdzIGF0IHRoZSBlbmQgZGVzcGl0ZSBza2lwcGluZyBvdmVyIG90aGVyIGl0ZW1zIG9mIGRhdGEuICBQYWdpbmcgc2hvdWxkIG5vdCBiZSBmcm9tIHRoaXMgbmV3IGl0ZW0sIGJ1dFxuICogb25seSB0aGUgbGFzdCBpdGVtIHB1bGxlZCB2aWEgdGhpcyBxdWVyeSBmcm9tIHRoZSBzZXJ2ZXIuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuUXVlcnkucHJvdG90eXBlLl9uZXh0U2VydmVyRnJvbUlkID0gJyc7XG5cbi8qKlxuICogVGhlIElEIHRvIHVzZSBpbiBwYWdpbmcgdGhlIGRhdGFiYXNlLlxuICpcbiAqIFdoeSBub3QganVzdCB1c2UgdGhlIElEIG9mIHRoZSBsYXN0IGl0ZW0gaW4gb3VyIHJlc3VsdCBzZXQ/XG4gKiBCZWNhdXNlIGFzIHdlIHJlY2VpdmUgd2Vic29ja2V0IGV2ZW50cywgd2UgaW5zZXJ0IGFuZCBhcHBlbmQgaXRlbXMgdG8gb3VyIGRhdGEuXG4gKiBUaGF0IHdlYnNvY2tldCBldmVudCBtYXkgbm90IGluIGZhY3QgZGVsaXZlciB0aGUgTkVYVCBpdGVtIGluIG91ciBkYXRhLCBidXQgc2ltcGx5IGFuIGl0ZW0sIHRoYXQgc2VxdWVudGlhbGx5XG4gKiBiZWxvbmdzIGF0IHRoZSBlbmQgZGVzcGl0ZSBza2lwcGluZyBvdmVyIG90aGVyIGl0ZW1zIG9mIGRhdGEuICBQYWdpbmcgc2hvdWxkIG5vdCBiZSBmcm9tIHRoaXMgbmV3IGl0ZW0sIGJ1dFxuICogb25seSB0aGUgbGFzdCBpdGVtIHB1bGxlZCB2aWEgdGhpcyBxdWVyeSBmcm9tIHRoZSBkYXRhYmFzZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5RdWVyeS5wcm90b3R5cGUuX25leHREQkZyb21JZCA9ICcnO1xuXG5cblF1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBoYXMgY2hhbmdlZDsgYW55IGNoYW5nZSBldmVudCB3aWxsIGNhdXNlIHRoaXMgZXZlbnQgdG8gdHJpZ2dlci5cbiAgICogQGV2ZW50IGNoYW5nZVxuICAgKi9cbiAgJ2NoYW5nZScsXG5cbiAgLyoqXG4gICAqIEEgbmV3IHBhZ2Ugb2YgZGF0YSBoYXMgYmVlbiBsb2FkZWQgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBldmVudCAnY2hhbmdlOmRhdGEnXG4gICAqL1xuICAnY2hhbmdlOmRhdGEnLFxuXG4gIC8qKlxuICAgKiBBbGwgZGF0YSBmb3IgdGhpcyBxdWVyeSBoYXMgYmVlbiByZXNldCBkdWUgdG8gYSBjaGFuZ2UgaW4gdGhlIFF1ZXJ5IHByZWRpY2F0ZS5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVzZXQnXG4gICAqL1xuICAnY2hhbmdlOnJlc2V0JyxcblxuICAvKipcbiAgICogQW4gaXRlbSBvZiBkYXRhIHdpdGhpbiB0aGlzIFF1ZXJ5IGhhcyBoYWQgYSBwcm9wZXJ0eSBjaGFuZ2UgaXRzIHZhbHVlLlxuICAgKiBAZXZlbnQgJ2NoYW5nZTpwcm9wZXJ0eSdcbiAgICovXG4gICdjaGFuZ2U6cHJvcGVydHknLFxuXG4gIC8qKlxuICAgKiBBIG5ldyBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gaW5zZXJ0ZWQgaW50byB0aGUgUXVlcnkuIE5vdCB0cmlnZ2VyZWQgYnkgbG9hZGluZ1xuICAgKiBhIG5ldyBwYWdlIG9mIGRhdGEgZnJvbSB0aGUgc2VydmVyLCBidXQgaXMgdHJpZ2dlcmVkIGJ5IGxvY2FsbHkgY3JlYXRpbmcgYSBtYXRjaGluZ1xuICAgKiBpdGVtIG9mIGRhdGEsIG9yIHJlY2VpdmluZyBhIG5ldyBpdGVtIG9mIGRhdGEgdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6aW5zZXJ0J1xuICAgKi9cbiAgJ2NoYW5nZTppbnNlcnQnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBRdWVyeS4gTm90IHRyaWdnZXJlZCBmb3IgZXZlcnkgcmVtb3ZhbCwgYnV0XG4gICAqIGlzIHRyaWdnZXJlZCBieSBsb2NhbGx5IGRlbGV0aW5nIGEgcmVzdWx0LCBvciByZWNlaXZpbmcgYSByZXBvcnQgb2YgZGVsZXRpb24gdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVtb3ZlJ1xuICAgKi9cbiAgJ2NoYW5nZTpyZW1vdmUnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gbW92ZWQgdG8gYSBuZXcgaW5kZXggaW4gdGhlIFF1ZXJ5IHJlc3VsdHMuXG4gICAqIEBldmVudCAnY2hhbmdlOm1vdmUnXG4gICAqL1xuICAnY2hhbmdlOm1vdmUnLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBmYWlsZWQgdG8gbG9hZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudCBlcnJvclxuICAgKi9cbiAgJ2Vycm9yJyxcblxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoUXVlcnksIFtRdWVyeSwgJ1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuIl19
