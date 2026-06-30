const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { CREDIT_OPERATION } = require('../../config/constants');
const logger = require('../../utils/logger');

const creditEntrySchema = Joi.object({
  id: Joi.string().uuid().required(),
  licenseId: Joi.string().required(),
  operation: Joi.string().valid(...Object.values(CREDIT_OPERATION)).required(),
  amount: Joi.number().positive().required(),
  balanceBefore: Joi.number().min(0).required(),
  balanceAfter: Joi.number().min(0).required(),
  reason: Joi.string().trim().required(),
  performedBy: Joi.string().trim().required(),
  createdAt: Joi.string().isoDate().required(),
});

const creditStoreSchema = Joi.object({
  entries: Joi.array().items(creditEntrySchema).required(),
});

const createCreditEntrySchema = Joi.object({
  licenseId: Joi.string().required(),
  operation: Joi.string().valid(...Object.values(CREDIT_OPERATION)).required(),
  amount: Joi.number().positive().required(),
  balanceBefore: Joi.number().min(0).required(),
  balanceAfter: Joi.number().min(0).required(),
  reason: Joi.string().trim().required(),
  performedBy: Joi.string().trim().required(),
});

/**
 * Service for managing per-license credit history in JSON-backed storage.
 * Stores immutable balance movements and exposes balance reporting helpers.
 */
class CreditService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'credits.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = creditStoreSchema.validate(data);
        if (error) {
          throw new Error(`Credit data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Create a credit history entry.
   * @param {Object} payload - Credit entry payload.
   * @returns {Promise<Object>} Persisted credit entry.
   */
  async create(payload) {
    try {
      const value = this._validate(createCreditEntrySchema, payload, 'Invalid credit entry payload');
      this._validateBalanceTransition(value);

      const entry = {
        id: uuidv4(),
        licenseId: value.licenseId,
        operation: value.operation,
        amount: value.amount,
        balanceBefore: value.balanceBefore,
        balanceAfter: value.balanceAfter,
        reason: value.reason.trim(),
        performedBy: value.performedBy.trim(),
        createdAt: new Date().toISOString(),
      };

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        data.entries.push(entry);
        return data;
      });

      logger.info(`Created credit entry: ${entry.id}`);
      return entry;
    } catch (error) {
      logger.error('Failed to create credit entry', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a credit history entry by identifier.
   * @param {string} id - Credit entry identifier.
   * @returns {Promise<Object|null>} Matching entry or null.
   */
  async getById(id) {
    try {
      const data = await this._initialize();
      return data.entries.find((item) => item.id === id) || null;
    } catch (error) {
      logger.error('Failed to get credit entry by id', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List credit entries using optional filters.
   * @param {Object} [filters={}] - Filter and sort options.
   * @returns {Promise<Object[]>} Matching credit entries.
   */
  async list(filters = {}) {
    try {
      const data = await this._initialize();
      return this._filterEntries(data.entries, filters);
    } catch (error) {
      logger.error('Failed to list credit entries', { error: error.message });
      throw error;
    }
  }

  /**
   * List credit entries belonging to a specific license.
   * @param {string} licenseId - License identifier.
   * @param {Object} [filters={}] - Additional list options.
   * @returns {Promise<Object[]>} Matching entries.
   */
  async getByLicense(licenseId, filters = {}) {
    try {
      return this.list({ ...filters, licenseId });
    } catch (error) {
      logger.error('Failed to get credit history by license', { error: error.message, licenseId });
      throw error;
    }
  }

  /**
   * Get the current balance for a license.
   * @param {string} licenseId - License identifier.
   * @returns {Promise<number>} Current balance or zero when no history exists.
   */
  async getBalance(licenseId) {
    try {
      const entries = await this.getByLicense(licenseId, {
        limit: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (entries.length === 0) {
        return 0;
      }
      return entries[0].balanceAfter;
    } catch (error) {
      logger.error('Failed to get license balance', { error: error.message, licenseId });
      throw error;
    }
  }

  /**
   * Ensure the credit store exists and is normalized.
   * @returns {Promise<Object>} Normalized store.
   * @private
   */
  async _initialize() {
    const current = await this.db.read();
    const normalized = this._normalizeStore(current);

    if (!current || Object.keys(current).length === 0 || !Array.isArray(current.entries)) {
      await this.db.write(normalized);
    }

    return normalized;
  }

  /**
   * Normalize raw database data.
   * @param {Object} data - Raw store content.
   * @returns {{entries: Object[]}} Normalized store structure.
   * @private
   */
  _normalizeStore(data) {
    return {
      entries: Array.isArray(data?.entries) ? data.entries : [],
    };
  }

  /**
   * Validate a payload using Joi.
   * @param {Joi.Schema} schema - Validation schema.
   * @param {Object} payload - Payload to validate.
   * @param {string} message - Error prefix.
   * @returns {Object} Validated payload.
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
   * Validate that the balance transition matches the credit operation semantics.
   * @param {Object} entry - Validated entry payload.
   * @private
   */
  _validateBalanceTransition(entry) {
    const delta = entry.balanceAfter - entry.balanceBefore;

    switch (entry.operation) {
      case CREDIT_OPERATION.DEDUCT:
        if (delta !== -entry.amount) {
          throw new Error('Deduct operation must reduce the balance by the entry amount');
        }
        break;
      case CREDIT_OPERATION.TOPUP:
      case CREDIT_OPERATION.REFUND:
        if (delta !== entry.amount) {
          throw new Error('Top-up and refund operations must increase the balance by the entry amount');
        }
        break;
      case CREDIT_OPERATION.ADJUSTMENT:
        if (Math.abs(delta) !== entry.amount) {
          throw new Error('Adjustment operation must match the absolute balance delta');
        }
        break;
      default:
        throw new Error('Unsupported credit operation');
    }
  }

  /**
   * Filter, sort, and limit credit history entries.
   * @param {Object[]} entries - Credit entry collection.
   * @param {Object} filters - Filter and sort options.
   * @returns {Object[]} Filtered entries.
   * @private
   */
  _filterEntries(entries, filters) {
    let items = [...entries];

    if (filters.licenseId) {
      items = items.filter((item) => item.licenseId === filters.licenseId);
    }
    if (filters.operation) {
      items = items.filter((item) => item.operation === filters.operation);
    }
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      items = items.filter((item) => new Date(item.createdAt).getTime() >= since);
    }
    if (filters.until) {
      const until = new Date(filters.until).getTime();
      items = items.filter((item) => new Date(item.createdAt).getTime() <= until);
    }

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

module.exports = new CreditService();
