const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Database Initialization Utility
 * Initializes database files with default data
 */
class DatabaseInitializer {
  constructor(options = {}) {
    this.dbDir = options.dbDir || path.join(__dirname, 'db');
    this.backupDir = options.backupDir || path.join(__dirname, 'backups');
  }

  /**
   * Initialize all databases
   * @param {boolean} force - Force reinitialization even if files exist
   * @returns {Promise<Object>} Initialization results
   */
  async initializeAll(force = false) {
    logger.info('Starting database initialization...');

    const results = {
      created: [],
      skipped: [],
      errors: [],
    };

    // Ensure directories exist
    await this._ensureDirectories();

    // Define database initializers
    const databases = [
      { name: 'users.json', initializer: this._initUsers.bind(this) },
      { name: 'licenses.json', initializer: this._initLicenses.bind(this) },
      { name: 'sessions.json', initializer: this._initSessions.bind(this) },
      { name: 'credits.json', initializer: this._initCredits.bind(this) },
      { name: 'transactions.json', initializer: this._initTransactions.bind(this) },
      { name: 'telegram.json', initializer: this._initTelegram.bind(this) },
      { name: 'proxies.json', initializer: this._initProxies.bind(this) },
      // config.json already exists, skip or update
    ];

    // Initialize each database
    for (const db of databases) {
      try {
        const filePath = path.join(this.dbDir, db.name);
        const exists = fsSync.existsSync(filePath);

        if (exists && !force) {
          results.skipped.push(db.name);
          logger.debug(`Skipped ${db.name} (already exists)`);
          continue;
        }

        const data = await db.initializer();
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        results.created.push(db.name);
        logger.info(`Initialized ${db.name}`);
      } catch (error) {
        results.errors.push({ file: db.name, error: error.message });
        logger.error(`Failed to initialize ${db.name}:`, error);
      }
    }

    logger.info(`Database initialization complete: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);
    return results;
  }

  /**
   * Ensure directories exist
   * @private
   */
  async _ensureDirectories() {
    const dirs = [this.dbDir, this.backupDir];

    for (const dir of dirs) {
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Initialize users database
   * @private
   */
  async _initUsers() {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');

    // Create default admin user
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    return {
      users: [
        {
          id: uuidv4(),
          username: process.env.ADMIN_USERNAME || 'admin',
          passwordHash,
          role: 'superadmin',
          email: '',
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
          isActive: true,
        },
      ],
    };
  }

  /**
   * Initialize licenses database
   * @private
   */
  async _initLicenses() {
    return {
      licenses: [],
    };
  }

  /**
   * Initialize sessions database
   * @private
   */
  async _initSessions() {
    return {
      sessions: [],
    };
  }

  /**
   * Initialize credits database
   * @private
   */
  async _initCredits() {
    return {
      entries: [],
    };
  }

  /**
   * Initialize transactions database
   * @private
   */
  async _initTransactions() {
    return {
      transactions: [],
    };
  }

  /**
   * Initialize telegram database
   * @private
   */
  async _initTelegram() {
    return {
      bot: {
        token: process.env.TELEGRAM_BOT_TOKEN || '',
        username: '',
        isActive: false,
      },
      linkingRequests: [],
      linkedAccounts: [],
    };
  }

  /**
   * Initialize proxies database
   * @private
   */
  async _initProxies() {
    return {
      proxies: [],
      rotationIndex: 0,
    };
  }

  /**
   * Check database integrity
   * @returns {Promise<Object>} Integrity check results
   */
  async checkIntegrity() {
    logger.info('Checking database integrity...');

    const results = {
      valid: [],
      invalid: [],
      missing: [],
    };

    const requiredFiles = [
      'users.json',
      'licenses.json',
      'sessions.json',
      'credits.json',
      'transactions.json',
      'config.json',
      'telegram.json',
      'proxies.json',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.dbDir, file);

      try {
        // Check if file exists
        if (!fsSync.existsSync(filePath)) {
          results.missing.push(file);
          continue;
        }

        // Try to parse JSON
        const content = await fs.readFile(filePath, 'utf8');
        JSON.parse(content);

        results.valid.push(file);
      } catch (error) {
        results.invalid.push({ file, error: error.message });
        logger.error(`Integrity check failed for ${file}:`, error);
      }
    }

    logger.info(`Integrity check complete: ${results.valid.length} valid, ${results.missing.length} missing, ${results.invalid.length} invalid`);
    return results;
  }

  /**
   * Backup all databases
   * @returns {Promise<string>} Backup directory path
   */
  async backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `manual-${timestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    const files = await fs.readdir(this.dbDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    let copied = 0;
    for (const file of jsonFiles) {
      try {
        const sourcePath = path.join(this.dbDir, file);
        const destPath = path.join(backupPath, file);
        await fs.copyFile(sourcePath, destPath);
        copied++;
      } catch (error) {
        logger.error(`Failed to backup ${file}:`, error);
      }
    }

    logger.info(`Manual backup created: ${backupPath} (${copied} files)`);
    return backupPath;
  }

  /**
   * Reset all databases (dangerous!)
   * @param {boolean} createBackup - Create backup before reset
   * @returns {Promise<Object>}
   */
  async resetAll(createBackup = true) {
    logger.warn('Resetting all databases...');

    if (createBackup) {
      await this.backup();
    }

    return this.initializeAll(true);
  }
}

module.exports = DatabaseInitializer;
