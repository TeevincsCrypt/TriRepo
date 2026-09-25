/**
 * Simple in-memory store used in place of a database.
 * Resets on process restart — suitable for demos and tests.
 */
class MemStore {
  constructor() {
    this._data = {};
  }

  /** Return all records for a collection as an array. */
  list(collection) {
    return Object.values(this._data[collection] || {});
  }

  /** Return one record by id, or undefined. */
  get(collection, id) {
    return (this._data[collection] || {})[id];
  }

  /** Insert or replace a record. */
  set(collection, id, record) {
    if (!this._data[collection]) {
      this._data[collection] = {};
    }
    this._data[collection][id] = record;
    return record;
  }

  /** Remove a record. Returns true if it existed. */
  delete(collection, id) {
    if (!(this._data[collection] && this._data[collection][id])) {
      return false;
    }
    delete this._data[collection][id];
    return true;
  }

  /** Clear one or all collections (useful in tests). */
  clear(collection) {
    if (collection) {
      this._data[collection] = {};
    } else {
      this._data = {};
    }
  }
}

// Singleton shared across the process
export default new MemStore();
