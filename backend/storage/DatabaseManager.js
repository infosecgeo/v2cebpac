const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { AsyncLock } = require('../utils/asyncLock');
const logger = require('../utils/logger');

/**
 * Thread-safe JSON database manager
 * Provides atomic read/write operations with file locking
 */
class DatabaseManager {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.tempFilePath = `${filePath}.tmp`;
    this.lockFilePath = `${filePath}.lock`;
    this.lock = new AsyncLock();
    
    // Options
    this.options = {
      pretty: options.pretty !== false,
      backupOnWrite: options.backupOnWrite || false,
      validateOnRead: options.validateOnRead !== false,
      encoding: options.encoding || 'utf8',
      ...options,
    };

    // Ensure directory exists
    this._ensureDirectory();
  }

  /**
   * Ensure the database directory exists
   */
  _ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }

  /**
   * Read data from the database file
   * @returns {Promise<Object>} Parsed JSON data
   */
  async read() {
    return this.lock.acquire('read', async () => {
      try {
        // Check if file exists
        if (!fsSync.existsSync(this.filePath)) {
          logger.debug(`Database file not found, returning empty object: ${this.filePath}`);
          return {};
        }

        // Read file
        const data = await fs.readFile(this.filePath, this.options.encoding);
        
        // Parse JSON
        const parsed = JSON.parse(data);

        // Validate if enabled
        if (this.options.validateOnRead && this.options.validator) {
          this.options.validator(parsed);
        }

        return parsed;
      } catch (error) {
        if (error.code === 'ENOENT') {
          logger.debug(`Database file not found: ${this.filePath}`);
          return {};
        }
        logger.error(`Failed to read database ${this.filePath}:`, error);
        throw new Error(`Database read error: ${error.message}`);
      }
    });
  }

  /**
   * Write data to the database file atomically
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   */
  async write(data) {
    return this.lock.acquire('write', async () => {
      try {
        // Validate data if validator provided
        if (this.options.validator) {
          this.options.validator(data);
        }

        // Create backup if enabled
        if (this.options.backupOnWrite && fsSync.existsSync(this.filePath)) {
          await this._createBackup();
        }

        // Serialize data
        const jsonString = this.options.pretty
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(data);

        // Atomic write: write to temp file first
        await fs.writeFile(this.tempFilePath, jsonString, this.options.encoding);

        // Rename temp file to actual file (atomic operation)
        await fs.rename(this.tempFilePath, this.filePath);

        logger.debug(`Successfully wrote to database: ${this.filePath}`);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          if (fsSync.existsSync(this.tempFilePath)) {
            await fs.unlink(this.tempFilePath);
          }
        } catch (cleanupError) {
          logger.error('Failed to cleanup temp file:', cleanupError);
        }

        logger.error(`Failed to write database ${this.filePath}:`, error);
        throw new Error(`Database write error: ${error.message}`);
      }
    });
  }

  /**
   * Update data with a transaction function
   * @param {Function} updateFn - Function that receives current data and returns updated data
   * @returns {Promise<Object>} Updated data
   */
  async update(updateFn) {
    return this.lock.acquire('update', async () => {
      try {
        // Read current data
        const currentData = await this.read();

        // Apply update function
        const updatedData = await updateFn(currentData);

        // Write updated data
        await this.write(updatedData);

        return updatedData;
      } catch (error) {
        logger.error(`Failed to update database ${this.filePath}:`, error);
        throw error;
      }
    });
  }

  /**
   * Create a backup of the current database file
   * @private
   */
  async _createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.filePath}.backup-${timestamp}`;
    
    try {
      await fs.copyFile(this.filePath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to create backup for ${this.filePath}:`, error);
    }
  }

  /**
   * Check if database file exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete the database file
   * @returns {Promise<void>}
   */
  async delete() {
    return this.lock.acquire('delete', async () => {
      try {
        if (await this.exists()) {
          await fs.unlink(this.filePath);
          logger.info(`Deleted database file: ${this.filePath}`);
        }
      } catch (error) {
        logger.error(`Failed to delete database ${this.filePath}:`, error);
        throw error;
      }
    });
  }

  /**
   * Get file stats
   * @returns {Promise<Object>}
   */
  async stats() {
    try {
      const stats = await fs.stat(this.filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

module.exports = DatabaseManager;
