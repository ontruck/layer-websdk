'use strict';

/**
 * Layer Constants are stored in two places:
 *
 * 1. As part of the layer.Constants singleton
 * 2. As static properties on classes.
 *
 * Typically the static property constants are designed to be changed by developers to customize behaviors,
 * and tend to only be used by that single class.
 *
 * @class layer.Constants
 * @singleton
 */
module.exports = {
  /**
   * Is the object synchronized with the server?
   * @property {Object} [SYNC_STATE=null]
   * @property {string} SYNC_STATE.NEW      - Object is newly created, was created locally, not from server data, and has not yet been sent to the server.
   * @property {string} SYNC_STATE.SAVING   - Object is newly created and is being sent to the server.
   * @property {string} SYNC_STATE.SYNCING  - Object exists both locally and on server but is being synced with changes.
   * @property {string} SYNC_STATE.SYNCED   - Object exists both locally and on server and at last check was in sync.
   * @property {string} SYNC_STATE.LOADING  - Object is being loaded from the server and may not have its properties set yet.
   */
  SYNC_STATE: {
    NEW: 'NEW',
    SAVING: 'SAVING',
    SYNCING: 'SYNCING',
    SYNCED: 'SYNCED',
    LOADING: 'LOADING'
  },

  /**
   * Values for readStatus/deliveryStatus
   * @property {Object} [RECIPIENT_STATE=]
   * @property {string} RECIPIENT_STATE.NONE - No users have read (or received) this Message
   * @property {string} RECIPIENT_STATE.SOME - Some users have read (or received) this Message
   * @property {string} RECIPIENT_STATE.ALL  - All users have read (or received) this Message
   */
  RECIPIENT_STATE: {
    NONE: 'NONE',
    SOME: 'SOME',
    ALL: 'ALL'
  },

  /**
   * Values for recipientStatus
   * @property {Object} [RECEIPT_STATE=]
   * @property {string} RECEIPT_STATE.SENT      - The Message has been sent to the specified user but it has not yet been received by their device.
   * @property {string} RECEIPT_STATE.DELIVERED - The Message has been delivered to the specified use but has not yet been read.
   * @property {string} RECEIPT_STATE.READ      - The Message has been read by the specified user.
   * @property {string} RECEIPT_STATE.PENDING   - The request to send this Message to the specified user has not yet been received by the server.
   */
  RECEIPT_STATE: {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    PENDING: 'pending'
  },
  LOCALSTORAGE_KEYS: {
    SESSIONDATA: 'layer-session-data-'
  },
  ACCEPT: 'application/vnd.layer+json; version=2.0',
  WEBSOCKET_PROTOCOL: 'layer-2.0',

  /**
   * Log levels
   * @property {Object} [LOG=]
   * @property {number} LOG.DEBUG     Log detailed information about requests, responses, events, state changes, etc...
   * @property {number} LOG.INFO      Log sparse information about requests, responses and events
   * @property {number} LOG.WARN      Log failures that are expected, normal, handled, but suggests that an operation didn't complete as intended
   * @property {number} LOG.ERROR     Log failures that are not expected or could not be handled
   * @property {number} LOG.NONE      Logs? Who needs em?
   */
  LOG: {
    DEBUG: 4,
    INFO: 3,
    WARN: 2,
    ERROR: 1,
    NONE: 0
  },

  /**
   * Deletion Modes
   * @property {Object} [DELETION_MODE=]
   * @property {number} DELETION_MODE.ALL          Delete Message/Conversation for All users but remain in the Conversation;
   *                                               new Messages will restore this Conversation minus any Message History prior to deletion.
   * @property {number} DELETION_MODE.MY_DEVICES   Delete Message or Conversation; but see layer.Conversation.leave if you want to delete
   *                                               a Conversation and not have it come back.
   */
  DELETION_MODE: {
    ALL: 'all_participants',
    MY_DEVICES: 'my_devices'
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb25zdC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwiU1lOQ19TVEFURSIsIk5FVyIsIlNBVklORyIsIlNZTkNJTkciLCJTWU5DRUQiLCJMT0FESU5HIiwiUkVDSVBJRU5UX1NUQVRFIiwiTk9ORSIsIlNPTUUiLCJBTEwiLCJSRUNFSVBUX1NUQVRFIiwiU0VOVCIsIkRFTElWRVJFRCIsIlJFQUQiLCJQRU5ESU5HIiwiTE9DQUxTVE9SQUdFX0tFWVMiLCJTRVNTSU9OREFUQSIsIkFDQ0VQVCIsIldFQlNPQ0tFVF9QUk9UT0NPTCIsIkxPRyIsIkRFQlVHIiwiSU5GTyIsIldBUk4iLCJFUlJPUiIsIkRFTEVUSU9OX01PREUiLCJNWV9ERVZJQ0VTIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7Ozs7QUFZQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmOzs7Ozs7Ozs7QUFTQUMsY0FBWTtBQUNWQyxTQUFLLEtBREs7QUFFVkMsWUFBUSxRQUZFO0FBR1ZDLGFBQVMsU0FIQztBQUlWQyxZQUFRLFFBSkU7QUFLVkMsYUFBUztBQUxDLEdBVkc7O0FBa0JmOzs7Ozs7O0FBT0FDLG1CQUFpQjtBQUNmQyxVQUFNLE1BRFM7QUFFZkMsVUFBTSxNQUZTO0FBR2ZDLFNBQUs7QUFIVSxHQXpCRjs7QUErQmY7Ozs7Ozs7O0FBUUFDLGlCQUFlO0FBQ2JDLFVBQU0sTUFETztBQUViQyxlQUFXLFdBRkU7QUFHYkMsVUFBTSxNQUhPO0FBSWJDLGFBQVM7QUFKSSxHQXZDQTtBQTZDZkMscUJBQW1CO0FBQ2pCQyxpQkFBYTtBQURJLEdBN0NKO0FBZ0RmQyxVQUFRLHlDQWhETztBQWlEZkMsc0JBQW9CLFdBakRMOztBQW1EZjs7Ozs7Ozs7O0FBU0FDLE9BQUs7QUFDSEMsV0FBTyxDQURKO0FBRUhDLFVBQU0sQ0FGSDtBQUdIQyxVQUFNLENBSEg7QUFJSEMsV0FBTyxDQUpKO0FBS0hoQixVQUFNO0FBTEgsR0E1RFU7O0FBb0VmOzs7Ozs7OztBQVFBaUIsaUJBQWU7QUFDYmYsU0FBSyxrQkFEUTtBQUViZ0IsZ0JBQVk7QUFGQztBQTVFQSxDQUFqQiIsImZpbGUiOiJjb25zdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGF5ZXIgQ29uc3RhbnRzIGFyZSBzdG9yZWQgaW4gdHdvIHBsYWNlczpcbiAqXG4gKiAxLiBBcyBwYXJ0IG9mIHRoZSBsYXllci5Db25zdGFudHMgc2luZ2xldG9uXG4gKiAyLiBBcyBzdGF0aWMgcHJvcGVydGllcyBvbiBjbGFzc2VzLlxuICpcbiAqIFR5cGljYWxseSB0aGUgc3RhdGljIHByb3BlcnR5IGNvbnN0YW50cyBhcmUgZGVzaWduZWQgdG8gYmUgY2hhbmdlZCBieSBkZXZlbG9wZXJzIHRvIGN1c3RvbWl6ZSBiZWhhdmlvcnMsXG4gKiBhbmQgdGVuZCB0byBvbmx5IGJlIHVzZWQgYnkgdGhhdCBzaW5nbGUgY2xhc3MuXG4gKlxuICogQGNsYXNzIGxheWVyLkNvbnN0YW50c1xuICogQHNpbmdsZXRvblxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgLyoqXG4gICAqIElzIHRoZSBvYmplY3Qgc3luY2hyb25pemVkIHdpdGggdGhlIHNlcnZlcj9cbiAgICogQHByb3BlcnR5IHtPYmplY3R9IFtTWU5DX1NUQVRFPW51bGxdXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTWU5DX1NUQVRFLk5FVyAgICAgIC0gT2JqZWN0IGlzIG5ld2x5IGNyZWF0ZWQsIHdhcyBjcmVhdGVkIGxvY2FsbHksIG5vdCBmcm9tIHNlcnZlciBkYXRhLCBhbmQgaGFzIG5vdCB5ZXQgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTWU5DX1NUQVRFLlNBVklORyAgIC0gT2JqZWN0IGlzIG5ld2x5IGNyZWF0ZWQgYW5kIGlzIGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IFNZTkNfU1RBVEUuU1lOQ0lORyAgLSBPYmplY3QgZXhpc3RzIGJvdGggbG9jYWxseSBhbmQgb24gc2VydmVyIGJ1dCBpcyBiZWluZyBzeW5jZWQgd2l0aCBjaGFuZ2VzLlxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gU1lOQ19TVEFURS5TWU5DRUQgICAtIE9iamVjdCBleGlzdHMgYm90aCBsb2NhbGx5IGFuZCBvbiBzZXJ2ZXIgYW5kIGF0IGxhc3QgY2hlY2sgd2FzIGluIHN5bmMuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTWU5DX1NUQVRFLkxPQURJTkcgIC0gT2JqZWN0IGlzIGJlaW5nIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIgYW5kIG1heSBub3QgaGF2ZSBpdHMgcHJvcGVydGllcyBzZXQgeWV0LlxuICAgKi9cbiAgU1lOQ19TVEFURToge1xuICAgIE5FVzogJ05FVycsXG4gICAgU0FWSU5HOiAnU0FWSU5HJyxcbiAgICBTWU5DSU5HOiAnU1lOQ0lORycsXG4gICAgU1lOQ0VEOiAnU1lOQ0VEJyxcbiAgICBMT0FESU5HOiAnTE9BRElORycsXG4gIH0sXG5cbiAgLyoqXG4gICAqIFZhbHVlcyBmb3IgcmVhZFN0YXR1cy9kZWxpdmVyeVN0YXR1c1xuICAgKiBAcHJvcGVydHkge09iamVjdH0gW1JFQ0lQSUVOVF9TVEFURT1dXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBSRUNJUElFTlRfU1RBVEUuTk9ORSAtIE5vIHVzZXJzIGhhdmUgcmVhZCAob3IgcmVjZWl2ZWQpIHRoaXMgTWVzc2FnZVxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gUkVDSVBJRU5UX1NUQVRFLlNPTUUgLSBTb21lIHVzZXJzIGhhdmUgcmVhZCAob3IgcmVjZWl2ZWQpIHRoaXMgTWVzc2FnZVxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gUkVDSVBJRU5UX1NUQVRFLkFMTCAgLSBBbGwgdXNlcnMgaGF2ZSByZWFkIChvciByZWNlaXZlZCkgdGhpcyBNZXNzYWdlXG4gICAqL1xuICBSRUNJUElFTlRfU1RBVEU6IHtcbiAgICBOT05FOiAnTk9ORScsXG4gICAgU09NRTogJ1NPTUUnLFxuICAgIEFMTDogJ0FMTCcsXG4gIH0sXG5cbiAgLyoqXG4gICAqIFZhbHVlcyBmb3IgcmVjaXBpZW50U3RhdHVzXG4gICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBbUkVDRUlQVF9TVEFURT1dXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBSRUNFSVBUX1NUQVRFLlNFTlQgICAgICAtIFRoZSBNZXNzYWdlIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNwZWNpZmllZCB1c2VyIGJ1dCBpdCBoYXMgbm90IHlldCBiZWVuIHJlY2VpdmVkIGJ5IHRoZWlyIGRldmljZS5cbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IFJFQ0VJUFRfU1RBVEUuREVMSVZFUkVEIC0gVGhlIE1lc3NhZ2UgaGFzIGJlZW4gZGVsaXZlcmVkIHRvIHRoZSBzcGVjaWZpZWQgdXNlIGJ1dCBoYXMgbm90IHlldCBiZWVuIHJlYWQuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBSRUNFSVBUX1NUQVRFLlJFQUQgICAgICAtIFRoZSBNZXNzYWdlIGhhcyBiZWVuIHJlYWQgYnkgdGhlIHNwZWNpZmllZCB1c2VyLlxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gUkVDRUlQVF9TVEFURS5QRU5ESU5HICAgLSBUaGUgcmVxdWVzdCB0byBzZW5kIHRoaXMgTWVzc2FnZSB0byB0aGUgc3BlY2lmaWVkIHVzZXIgaGFzIG5vdCB5ZXQgYmVlbiByZWNlaXZlZCBieSB0aGUgc2VydmVyLlxuICAgKi9cbiAgUkVDRUlQVF9TVEFURToge1xuICAgIFNFTlQ6ICdzZW50JyxcbiAgICBERUxJVkVSRUQ6ICdkZWxpdmVyZWQnLFxuICAgIFJFQUQ6ICdyZWFkJyxcbiAgICBQRU5ESU5HOiAncGVuZGluZycsXG4gIH0sXG4gIExPQ0FMU1RPUkFHRV9LRVlTOiB7XG4gICAgU0VTU0lPTkRBVEE6ICdsYXllci1zZXNzaW9uLWRhdGEtJyxcbiAgfSxcbiAgQUNDRVBUOiAnYXBwbGljYXRpb24vdm5kLmxheWVyK2pzb247IHZlcnNpb249Mi4wJyxcbiAgV0VCU09DS0VUX1BST1RPQ09MOiAnbGF5ZXItMi4wJyxcblxuICAvKipcbiAgICogTG9nIGxldmVsc1xuICAgKiBAcHJvcGVydHkge09iamVjdH0gW0xPRz1dXG4gICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBMT0cuREVCVUcgICAgIExvZyBkZXRhaWxlZCBpbmZvcm1hdGlvbiBhYm91dCByZXF1ZXN0cywgcmVzcG9uc2VzLCBldmVudHMsIHN0YXRlIGNoYW5nZXMsIGV0Yy4uLlxuICAgKiBAcHJvcGVydHkge251bWJlcn0gTE9HLklORk8gICAgICBMb2cgc3BhcnNlIGluZm9ybWF0aW9uIGFib3V0IHJlcXVlc3RzLCByZXNwb25zZXMgYW5kIGV2ZW50c1xuICAgKiBAcHJvcGVydHkge251bWJlcn0gTE9HLldBUk4gICAgICBMb2cgZmFpbHVyZXMgdGhhdCBhcmUgZXhwZWN0ZWQsIG5vcm1hbCwgaGFuZGxlZCwgYnV0IHN1Z2dlc3RzIHRoYXQgYW4gb3BlcmF0aW9uIGRpZG4ndCBjb21wbGV0ZSBhcyBpbnRlbmRlZFxuICAgKiBAcHJvcGVydHkge251bWJlcn0gTE9HLkVSUk9SICAgICBMb2cgZmFpbHVyZXMgdGhhdCBhcmUgbm90IGV4cGVjdGVkIG9yIGNvdWxkIG5vdCBiZSBoYW5kbGVkXG4gICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBMT0cuTk9ORSAgICAgIExvZ3M/IFdobyBuZWVkcyBlbT9cbiAgICovXG4gIExPRzoge1xuICAgIERFQlVHOiA0LFxuICAgIElORk86IDMsXG4gICAgV0FSTjogMixcbiAgICBFUlJPUjogMSxcbiAgICBOT05FOiAwLFxuICB9LFxuXG4gIC8qKlxuICAgKiBEZWxldGlvbiBNb2Rlc1xuICAgKiBAcHJvcGVydHkge09iamVjdH0gW0RFTEVUSU9OX01PREU9XVxuICAgKiBAcHJvcGVydHkge251bWJlcn0gREVMRVRJT05fTU9ERS5BTEwgICAgICAgICAgRGVsZXRlIE1lc3NhZ2UvQ29udmVyc2F0aW9uIGZvciBBbGwgdXNlcnMgYnV0IHJlbWFpbiBpbiB0aGUgQ29udmVyc2F0aW9uO1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE1lc3NhZ2VzIHdpbGwgcmVzdG9yZSB0aGlzIENvbnZlcnNhdGlvbiBtaW51cyBhbnkgTWVzc2FnZSBIaXN0b3J5IHByaW9yIHRvIGRlbGV0aW9uLlxuICAgKiBAcHJvcGVydHkge251bWJlcn0gREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTICAgRGVsZXRlIE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uOyBidXQgc2VlIGxheWVyLkNvbnZlcnNhdGlvbi5sZWF2ZSBpZiB5b3Ugd2FudCB0byBkZWxldGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGEgQ29udmVyc2F0aW9uIGFuZCBub3QgaGF2ZSBpdCBjb21lIGJhY2suXG4gICAqL1xuICBERUxFVElPTl9NT0RFOiB7XG4gICAgQUxMOiAnYWxsX3BhcnRpY2lwYW50cycsXG4gICAgTVlfREVWSUNFUzogJ215X2RldmljZXMnLFxuICB9LFxufTtcbiJdfQ==
