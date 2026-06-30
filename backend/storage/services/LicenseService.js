const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { LICENSE_STATUS } = require('../../config/constants');
const logger = require('../../utils/logger');

const licenseSchema = Joi.object({
  id: Joi.string().uuid().required(),
  key: Joi.string().pattern(/^[A-Z0-9-]+$/).min(4).max(128).required(),
  status: Joi.string().valid(...Object.values(LICENSE_STATUS)).required(),
  userId: Joi.string().trim().required(),
  expiresAt: Joi.string().isoDate().required(),
  createdAt: Joi.string().isoDate().required(),
  lastUsedAt: Joi.string().isoDate().allow(null).required(),
  credits: Joi.number().min(0).required(),
  maxConcurrentSessions: Joi.number().integer().min(1).required(),
  telegramId: Joi.string().allow(null, '').required(),
  telegramUsername: Joi.string().allow(null, '').required(),
});

const licenseStoreSchema = Joi.object({
  licenses: Joi.array().items(licenseSchema).required(),
});

const createLicenseSchema = Joi.object({
  key: Joi.string().pattern(/^[A-Z0-9-]+$/).min(4).max(128).required(),
  status: Joi.string().valid(...Object.values(LICENSE_STATUS)).default(LICENSE_STATUS.ACTIVE),
  userId: Joi.string().trim().required(),
  expiresAt: Joi.string().isoDate().required(),
  credits: Joi.number().min(0).default(0),
  maxConcurrentSessions: Joi.number().integer().min(1).default(1),
  telegramId: Joi.string().allow(null, '').optional(),
  telegramUsername: Joi.string().allow(null, '').optional(),
  lastUsedAt: Joi.string().isoDate().allow(null).default(null),
});

const updateLicenseSchema = Joi.object({
  key: Joi.string().pattern(/^[A-Z0-9-]+$/).min(4).max(128).optional(),
  status: Joi.string().valid(...Object.values(LICENSE_STATUS)).optional(),
  userId: Joi.string().trim().optional(),
  expiresAt: Joi.string().isoDate().optional(),
  lastUsedAt: Joi.string().isoDate().allow(null).optional(),
  credits: Joi.number().min(0).optional(),
  maxConcurrentSessions: Joi.number().integer().min(1).optional(),
  telegramId: Joi.string().allow(null, '').optional(),
  telegramUsername: Joi.string().allow(null, '').optional(),
}).min(1);

/**
 * Service for managing license records in JSON-backed storage.
 * Stores license identity, usage status, remaining credits, and Telegram linkage.
 */
class LicenseService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'licenses.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = licenseStoreSchema.validate(data);
        if (error) {
          throw new Error(`License data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Create a new license record.
   * @param {Object} payload - License creation payload.
   * @returns {Promise<Object>} Persisted license.
   */
  async create(payload) {
    try {
      const value = this._validate(createLicenseSchema, payload, 'Invalid license payload');
      const timestamp = new Date().toISOString();
      const license = {
        id: uuidv4(),
        key: this._normalizeKey(value.key),
        status: value.status,
        userId: value.userId.trim(),
        expiresAt: value.expiresAt,
        createdAt: timestamp,
        lastUsedAt: value.lastUsedAt,
        credits: value.credits,
        maxConcurrentSessions: value.maxConcurrentSessions,
        telegramId: value.telegramId ?? null,
        telegramUsername: value.telegramUsername ?? null,
      };

      await this.db.update((current) => {
        const data = this._normalizeStore(current);

        if (data.licenses.some((item) => item.key === license.key)) {
          throw new Error('License key already exists');
        }

        if (license.telegramId && data.licenses.some((item) => item.telegramId === license.telegramId)) {
          throw new Error('Telegram account is already linked to another license');
        }

        data.licenses.push(license);
        return data;
      });

      logger.info(`Created license: ${license.id}`);
      return license;
    } catch (error) {
      logger.error('Failed to create license', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a license by its public key.
   * @param {string} key - License key.
   * @returns {Promise<Object|null>} Matching license or null.
   */
  async getByKey(key) {
    try {
      const data = await this._initialize();
      return data.licenses.find((item) => item.key === this._normalizeKey(key)) || null;
    } catch (error) {
      logger.error('Failed to get license by key', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get a license by its internal identifier.
   * @param {string} id - License identifier.
   * @returns {Promise<Object|null>} Matching license or null.
   */
  async getById(id) {
    try {
      const data = await this._initialize();
      return data.licenses.find((item) => item.id === id) || null;
    } catch (error) {
      logger.error('Failed to get license by id', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Update mutable license fields.
   * @param {string} id - License identifier.
   * @param {Object} updates - Partial update payload.
   * @returns {Promise<Object>} Updated license.
   */
  async update(id, updates) {
    try {
      const value = this._validate(updateLicenseSchema, updates, 'Invalid license update payload');
      let updatedLicense = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const license = data.licenses.find((item) => item.id === id);

        if (!license) {
          throw new Error('License not found');
        }

        const nextKey = value.key ? this._normalizeKey(value.key) : license.key;
        if (data.licenses.some((item) => item.id !== id && item.key === nextKey)) {
          throw new Error('License key already exists');
        }

        const nextTelegramId = value.telegramId !== undefined ? value.telegramId : license.telegramId;
        if (
          nextTelegramId &&
          data.licenses.some((item) => item.id !== id && item.telegramId === nextTelegramId)
        ) {
          throw new Error('Telegram account is already linked to another license');
        }

        Object.assign(license, {
          ...value,
          key: nextKey,
          telegramId: value.telegramId !== undefined ? value.telegramId : license.telegramId,
          telegramUsername:
            value.telegramUsername !== undefined ? value.telegramUsername : license.telegramUsername,
        });

        updatedLicense = { ...license };
        return data;
      });

      logger.info(`Updated license: ${id}`);
      return updatedLicense;
    } catch (error) {
      logger.error('Failed to update license', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Delete a license record.
   * @param {string} id - License identifier.
   * @returns {Promise<Object>} Removed license.
   */
  async delete(id) {
    try {
      let deletedLicense = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const index = data.licenses.findIndex((item) => item.id === id);

        if (index === -1) {
          throw new Error('License not found');
        }

        deletedLicense = data.licenses.splice(index, 1)[0];
        return data;
      });

      logger.info(`Deleted license: ${id}`);
      return deletedLicense;
    } catch (error) {
      logger.error('Failed to delete license', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List licenses using optional filter criteria.
   * @param {Object} [filters={}] - Filter and sort options.
   * @returns {Promise<Object[]>} Matching licenses.
   */
  async list(filters = {}) {
    try {
      const data = await this._initialize();
      let licenses = [...data.licenses];

      if (filters.status) {
        licenses = licenses.filter((item) => item.status === filters.status);
      }
      if (filters.userId) {
        licenses = licenses.filter((item) => item.userId === filters.userId);
      }
      if (filters.telegramId) {
        licenses = licenses.filter((item) => item.telegramId === filters.telegramId);
      }
      if (filters.expired === true) {
        const now = Date.now();
        licenses = licenses.filter((item) => new Date(item.expiresAt).getTime() <= now);
      }
      if (filters.expired === false) {
        const now = Date.now();
        licenses = licenses.filter((item) => new Date(item.expiresAt).getTime() > now);
      }
      if (filters.query) {
        licenses = licenses.filter((item) => this._matchesSearch(item, filters.query));
      }

      return this._sortAndLimit(licenses, filters);
    } catch (error) {
      logger.error('Failed to list licenses', { error: error.message });
      throw error;
    }
  }

  /**
   * Search licenses across key, user, and Telegram fields.
   * @param {string} query - Free-text search query.
   * @param {Object} [options={}] - Additional list options.
   * @returns {Promise<Object[]>} Matching licenses.
   */
  async search(query, options = {}) {
    try {
      return this.list({ ...options, query });
    } catch (error) {
      logger.error('Failed to search licenses', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Adjust or set the credit balance for a license.
   * @param {string} id - License identifier.
   * @param {number} amount - Credit value to apply.
   * @param {Object} [options={}] - Update mode configuration.
   * @returns {Promise<Object>} Updated license.
   */
  async updateCredits(id, amount, options = {}) {
    try {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error('Amount must be a valid number');
      }

      const mode = options.mode || 'set';
      if (!['set', 'increment', 'decrement'].includes(mode)) {
        throw new Error('Invalid credit update mode');
      }

      let updatedLicense = null;
      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const license = data.licenses.find((item) => item.id === id);

        if (!license) {
          throw new Error('License not found');
        }

        let nextCredits = amount;
        if (mode === 'increment') {
          nextCredits = license.credits + amount;
        } else if (mode === 'decrement') {
          nextCredits = license.credits - amount;
        }

        if (nextCredits < 0) {
          throw new Error('Credit balance cannot be negative');
        }

        license.credits = nextCredits;
        updatedLicense = { ...license };
        return data;
      });

      logger.info(`Updated license credits: ${id}`);
      return updatedLicense;
    } catch (error) {
      logger.error('Failed to update license credits', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Link a Telegram account to a license.
   * @param {string} id - License identifier.
   * @param {string} telegramId - Telegram user identifier.
   * @param {string} [telegramUsername=''] - Telegram username.
   * @returns {Promise<Object>} Updated license.
   */
  async linkTelegram(id, telegramId, telegramUsername = '') {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      return this.update(id, {
        telegramId: String(telegramId).trim(),
        telegramUsername: telegramUsername ? String(telegramUsername).trim() : '',
      });
    } catch (error) {
      logger.error('Failed to link Telegram account', { error: error.message, id, telegramId });
      throw error;
    }
  }

  /**
   * Ensure the backing data file exists and has the expected structure.
   * @returns {Promise<Object>} Normalized store.
   * @private
   */
  async _initialize() {
    const current = await this.db.read();
    const normalized = this._normalizeStore(current);

    if (!current || Object.keys(current).length === 0 || !Array.isArray(current.licenses)) {
      await this.db.write(normalized);
    }

    return normalized;
  }

  /**
   * Normalize store data loaded from disk.
   * @param {Object} data - Raw database content.
   * @returns {{licenses: Object[]}} Normalized store shape.
   * @private
   */
  _normalizeStore(data) {
    return {
      licenses: Array.isArray(data?.licenses) ? data.licenses : [],
    };
  }

  /**
   * Validate a payload with Joi and throw a descriptive error on failure.
   * @param {Joi.Schema} schema - Joi schema instance.
   * @param {Object} payload - Payload to validate.
   * @param {string} message - Error prefix.
   * @returns {Object} Validated value.
   * @private
   */
  _validate(schema, payload, message) {
    const { error, value } = schema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      throw new Error(`${message}: ${error.message}`);
    }

    return value;
  }

  /**
   * Normalize license keys for consistent lookups.
   * @param {string} key - Raw license key.
   * @returns {string} Uppercased, trimmed key.
   * @private
   */
  _normalizeKey(key) {
    return String(key).trim().toUpperCase();
  }

  /**
   * Check whether a license matches a free-text query.
   * @param {Object} license - License record.
   * @param {string} query - Search query.
   * @returns {boolean} True when the record matches.
   * @private
   */
  _matchesSearch(license, query) {
    const needle = String(query).trim().toLowerCase();
    return [license.key, license.userId, license.telegramId, license.telegramUsername, license.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }

  /**
   * Apply sorting and limit options to a collection.
   * @param {Object[]} items - Records to process.
   * @param {Object} filters - Sort and pagination options.
   * @returns {Object[]} Processed records.
   * @private
   */
  _sortAndLimit(items, filters) {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    const limit = Number.isInteger(filters.limit) && filters.limit > 0 ? filters.limit : null;

    items.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) return 0;
      return left > right ? (sortOrder === 'asc' ? 1 : -1) : sortOrder === 'asc' ? -1 : 1;
    });

    return limit ? items.slice(0, limit) : items;
  }
}

module.exports = new LicenseService();

