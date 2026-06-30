const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Automatic backup service
 * Handles periodic backups and rotation
 */
class BackupService {
  constructor(options = {}) {
    this.options = {
      backupDir: options.backupDir || path.join(__dirname, '..', 'storage', 'backups'),
      dbDir: options.dbDir || path.join(__dirname, '..', 'storage', 'db'),
      interval: options.interval || 3600000, // 1 hour default
      maxBackups: options.maxBackups || 24, // Keep 24 backups by default
      enabled: options.enabled !== false,
      ...options,
    };

    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start the backup service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Backup service is already running');
      return;
    }

    if (!this.options.enabled) {
      logger.info('Backup service is disabled');
      return;
    }

    logger.info('Starting backup service...');
    
    // Ensure backup directory exists
    this._ensureBackupDirectory();

    // Run initial backup
    this.createBackup().catch(error => {
      logger.error('Initial backup failed:', error);
    });

    // Schedule periodic backups
    this.intervalId = setInterval(() => {
      this.createBackup().catch(error => {
        logger.error('Scheduled backup failed:', error);
      });
    }, this.options.interval);

    this.isRunning = true;
    logger.info(`Backup service started (interval: ${this.options.interval}ms, max backups: ${this.options.maxBackups})`);
  }

  /**
   * Stop the backup service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Backup service stopped');
  }

  /**
   * Create a backup of all database files
   * @returns {Promise<string>} Backup directory path
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirPath = path.join(this.options.backupDir, timestamp);

    try {
      // Create backup directory
      await fs.mkdir(backupDirPath, { recursive: true });

      // Get all JSON files in db directory
      const dbFiles = await this._getDBFiles();

      // Copy each file to backup directory
      let copiedCount = 0;
      for (const file of dbFiles) {
        const sourcePath = path.join(this.options.dbDir, file);
        const destPath = path.join(backupDirPath, file);

        try {
          await fs.copyFile(sourcePath, destPath);
          copiedCount++;
        } catch (error) {
          logger.warn(`Failed to backup file ${file}:`, error.message);
        }
      }

      logger.info(`Backup created: ${backupDirPath} (${copiedCount} files)`);

      // Rotate old backups
      await this._rotateBackups();

      return backupDirPath;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Restore from a backup
   * @param {string} backupPath - Path to backup directory or timestamp
   * @returns {Promise<void>}
   */
  async restore(backupPath) {
    try {
      // If timestamp provided, construct full path
      let fullBackupPath = backupPath;
      if (!path.isAbsolute(backupPath)) {
        fullBackupPath = path.join(this.options.backupDir, backupPath);
      }

      // Check if backup exists
      const stats = await fs.stat(fullBackupPath);
      if (!stats.isDirectory()) {
        throw new Error('Backup path is not a directory');
      }

      // Get all files in backup
      const backupFiles = await fs.readdir(fullBackupPath);
      const jsonFiles = backupFiles.filter(f => f.endsWith('.json'));

      // Restore each file
      let restoredCount = 0;
      for (const file of jsonFiles) {
        const sourcePath = path.join(fullBackupPath, file);
        const destPath = path.join(this.options.dbDir, file);

        try {
          await fs.copyFile(sourcePath, destPath);
          restoredCount++;
        } catch (error) {
          logger.warn(`Failed to restore file ${file}:`, error.message);
        }
      }

      logger.info(`Restored from backup: ${fullBackupPath} (${restoredCount} files)`);
    } catch (error) {
      logger.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * List all available backups
   * @returns {Promise<Array>} Array of backup info objects
   */
  async listBackups() {
    try {
      const entries = await fs.readdir(this.options.backupDir, { withFileTypes: true });
      const backups = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backupPath = path.join(this.options.backupDir, entry.name);
          const stats = await fs.stat(backupPath);
          
          // Count files in backup
          const files = await fs.readdir(backupPath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));

          backups.push({
            name: entry.name,
            path: backupPath,
            created: stats.birthtime,
            modified: stats.mtime,
            fileCount: jsonFiles.length,
            size: await this._getDirectorySize(backupPath),
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete old backups to maintain max backup count
   * @private
   */
  async _rotateBackups() {
    try {
      const backups = await this.listBackups();

      // Delete oldest backups if we exceed max
      if (backups.length > this.options.maxBackups) {
        const toDelete = backups.slice(this.options.maxBackups);
        
        for (const backup of toDelete) {
          try {
            await fs.rm(backup.path, { recursive: true, force: true });
            logger.debug(`Deleted old backup: ${backup.name}`);
          } catch (error) {
            logger.warn(`Failed to delete old backup ${backup.name}:`, error.message);
          }
        }

        logger.info(`Rotated backups: deleted ${toDelete.length} old backups`);
      }
    } catch (error) {
      logger.error('Failed to rotate backups:', error);
    }
  }

  /**
   * Get all database files
   * @private
   */
  async _getDBFiles() {
    try {
      const entries = await fs.readdir(this.options.dbDir);
      return entries.filter(f => f.endsWith('.json'));
    } catch (error) {
      logger.error('Failed to read database directory:', error);
      return [];
    }
  }

  /**
   * Calculate directory size
   * @private
   */
  async _getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this._getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Failed to get directory size for ${dirPath}:`, error.message);
    }
    
    return totalSize;
  }

  /**
   * Ensure backup directory exists
   * @private
   */
  _ensureBackupDirectory() {
    if (!fsSync.existsSync(this.options.backupDir)) {
      fsSync.mkdirSync(this.options.backupDir, { recursive: true });
      logger.info(`Created backup directory: ${this.options.backupDir}`);
    }
  }

  /**
   * Get service status
   * @returns {Object}
   */
  getStatus() {
    return {
      running: this.isRunning,
      enabled: this.options.enabled,
      interval: this.options.interval,
      maxBackups: this.options.maxBackups,
      backupDir: this.options.backupDir,
      nextBackup: this.intervalId ? new Date(Date.now() + this.options.interval).toISOString() : null,
    };
  }
}

module.exports = BackupService;
