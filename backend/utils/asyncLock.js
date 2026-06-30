/**
 * AsyncLock - Provides mutual exclusion for async operations
 * Ensures thread-safe access to shared resources
 */
class AsyncLock {
  constructor() {
    this.locks = new Map();
    this.queues = new Map();
  }

  /**
   * Acquire a lock and execute a function
   * @param {string} key - Lock identifier
   * @param {Function} fn - Async function to execute while holding the lock
   * @returns {Promise<any>} Result of the function
   */
  async acquire(key, fn) {
    // Wait for existing lock to be released
    while (this.locks.get(key)) {
      await this._waitForRelease(key);
    }

    // Acquire lock
    this.locks.set(key, true);

    try {
      // Execute function
      const result = await fn();
      return result;
    } finally {
      // Release lock
      this.locks.delete(key);
      this._notifyWaiters(key);
    }
  }

  /**
   * Wait for a lock to be released
   * @private
   */
  _waitForRelease(key) {
    return new Promise((resolve) => {
      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }
      this.queues.get(key).push(resolve);
    });
  }

  /**
   * Notify all waiting operations that lock is released
   * @private
   */
  _notifyWaiters(key) {
    const queue = this.queues.get(key);
    if (queue && queue.length > 0) {
      const resolve = queue.shift();
      resolve();
      
      // Clean up empty queue
      if (queue.length === 0) {
        this.queues.delete(key);
      }
    }
  }

  /**
   * Check if a key is currently locked
   * @param {string} key - Lock identifier
   * @returns {boolean}
   */
  isLocked(key) {
    return this.locks.has(key);
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAll() {
    this.locks.clear();
    
    // Resolve all waiting promises
    for (const [key, queue] of this.queues.entries()) {
      queue.forEach(resolve => resolve());
    }
    this.queues.clear();
  }
}

module.exports = { AsyncLock };
