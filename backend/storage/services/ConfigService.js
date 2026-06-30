const path = require('path');
const Joi = require('joi');
const DatabaseManager = require('../DatabaseManager');
const { DEFAULT_CONFIG } = require('../../config/constants');
const logger = require('../../utils/logger');

// Validation schema for config
const configSchema = Joi.object({
  version: Joi.number().integer().min(1).required(),
  updatedAt: Joi.string().isoDate().required(),
  updatedBy: Joi.string().required(),
  runtime: Joi.object({
    apiKey: Joi.string().allow(''),
    baseURL: Joi.string().uri().required(),
    soarURL: Joi.string().uri().required(),
    userAgent: Joi.string().required(),
    secChUa: Joi.string().required(),
    acceptLang: Joi.string().required(),
  }).required(),
  proxy: Joi.object({
    primary: Joi.string().allow(''),
    pool: Joi.array().items(Joi.string()),
    rotationStrategy: Joi.string().valid('random', 'round-robin', 'least-used'),
  }).required(),
  processing: Joi.object({
    retryCount: Joi.number().integer().min(0).max(50),
    retryDelay: Joi.number().integer().min(100),
    requestTimeout: Joi.number().integer().min(1000),
    workerCount: Joi.number().integer().min(1).max(20),
    exponentialBackoff: Joi.boolean(),
    jitterMs: Joi.number().integer().min(0),
  }).required(),
  modes: Joi.object({
    automatic: Joi.boolean(),
    manual: Joi.boolean(),
    maintenance: Joi.boolean(),
  }).required(),
  payment: Joi.object({
    qrCodeUrl: Joi.string().allow(''),
    topupInstructions: Joi.string().required(),
  }).required(),
});

/**
 * Config Service
 * Manages runtime configuration
 */
class ConfigService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'config.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = configSchema.validate(data);
        if (error) {
          throw new Error(`Config validation failed: ${error.message}`);
        }
      },
    });
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = 60000; // 1 minute cache
  }

  /**
   * Get current configuration
   * @param {boolean} useCache - Whether to use cached config
   * @returns {Promise<Object>}
   */
  async get(useCache = true) {
    // Return cached config if valid
    if (useCache && this._cache && this._cacheTime && (Date.now() - this._cacheTime < this._cacheTTL)) {
      return this._cache;
    }

    const config = await this.db.read();
    
    // Return default config if file doesn't exist
    if (!config || Object.keys(config).length === 0) {
      return this._createDefaultConfig();
    }

    // Update cache
    this._cache = config;
    this._cacheTime = Date.now();

    return config;
  }

  /**
   * Update configuration
   * @param {Object} updates - Partial config updates
   * @param {string} updatedBy - User who made the update
   * @returns {Promise<Object>} Updated config
   */
  async update(updates, updatedBy = 'system') {
    const config = await this.db.update((current) => {
      // Get current config or default
      const base = Object.keys(current).length > 0 ? current : this._getDefaultConfigData();

      // Deep merge updates
      const updated = this._deepMerge(base, updates);

      // Update metadata
      updated.version = (base.version || 0) + 1;
      updated.updatedAt = new Date().toISOString();
      updated.updatedBy = updatedBy;

      return updated;
    });

    // Invalidate cache
    this._cache = config;
    this._cacheTime = Date.now();

    logger.info(`Config updated by ${updatedBy}, version: ${config.version}`);
    return config;
  }

  /**
   * Reset configuration to defaults
   * @param {string} updatedBy - User who made the reset
   * @returns {Promise<Object>}
   */
  async reset(updatedBy = 'system') {
    const defaultConfig = this._createDefaultConfig();
    defaultConfig.updatedBy = updatedBy;
    
    await this.db.write(defaultConfig);
    
    // Invalidate cache
    this._cache = defaultConfig;
    this._cacheTime = Date.now();

    logger.info(`Config reset to defaults by ${updatedBy}`);
    return defaultConfig;
  }

  /**
   * Get specific config section
   * @param {string} section - Section name (e.g., 'runtime', 'proxy')
   * @returns {Promise<Object>}
   */
  async getSection(section) {
    const config = await this.get();
    return config[section] || null;
  }

  /**
   * Update specific config section
   * @param {string} section - Section name
   * @param {Object} updates - Section updates
   * @param {string} updatedBy - User who made the update
   * @returns {Promise<Object>}
   */
  async updateSection(section, updates, updatedBy = 'system') {
    return this.update({ [section]: updates }, updatedBy);
  }

  /**
   * Invalidate cache
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }

  /**
   * Create default configuration
   * @private
   */
  _createDefaultConfig() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      ...DEFAULT_CONFIG,
    };
  }

  /**
   * Get default config data
   * @private
   */
  _getDefaultConfigData() {
    return this._createDefaultConfig();
  }

  /**
   * Deep merge objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key]) && target[key] instanceof Object && !Array.isArray(target[key])) {
        result[key] = this._deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}

// Export singleton instance
module.exports = new ConfigService();
