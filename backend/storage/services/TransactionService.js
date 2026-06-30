const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { TRANSACTION_STATUS } = require('../../config/constants');
const { isValidCardNumber } = require('../../utils/validation');
const logger = require('../../utils/logger');

const transactionSchema = Joi.object({
  id: Joi.string().uuid().required(),
  licenseId: Joi.string().required(),
  type: Joi.string().valid(...Object.values(TRANSACTION_STATUS)).required(),
  cardNumber: Joi.string().pattern(/^\*{4}\d{4}$/).required(),
  amount: Joi.number().min(0).allow(null).required(),
  message: Joi.string().trim().required(),
  metadata: Joi.object().required(),
  createdAt: Joi.string().isoDate().required(),
});

const transactionStoreSchema = Joi.object({
  transactions: Joi.array().items(transactionSchema).required(),
});

const createTransactionSchema = Joi.object({
  licenseId: Joi.string().required(),
  type: Joi.string().valid(...Object.values(TRANSACTION_STATUS)).required(),
  cardNumber: Joi.string().trim().required(),
  amount: Joi.number().min(0).allow(null).optional(),
  message: Joi.string().trim().required(),
  metadata: Joi.object().default({}),
});

/**
 * Service for transaction log persistence in JSON-backed storage.
 * Stores masked card data, free-form metadata, and aggregated reporting helpers.
 */
class TransactionService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'transactions.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = transactionStoreSchema.validate(data);
        if (error) {
          throw new Error(`Transaction data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Create a transaction log entry.
   * @param {Object} payload - Transaction creation payload.
   * @returns {Promise<Object>} Persisted transaction.
   */
  async create(payload) {
    try {
      const value = this._validate(createTransactionSchema, payload, 'Invalid transaction payload');
      const transaction = {
        id: uuidv4(),
        licenseId: value.licenseId,
        type: value.type,
        cardNumber: this._maskCardNumber(value.cardNumber),
        amount: value.amount ?? null,
        message: value.message.trim(),
        metadata: value.metadata || {},
        createdAt: new Date().toISOString(),
      };

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        data.transactions.push(transaction);
        return data;
      });

      logger.info(`Created transaction: ${transaction.id}`);
      return transaction;
    } catch (error) {
      logger.error('Failed to create transaction', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a transaction by identifier.
   * @param {string} id - Transaction identifier.
   * @returns {Promise<Object|null>} Matching transaction or null.
   */
  async getById(id) {
    try {
      const data = await this._initialize();
      return data.transactions.find((item) => item.id === id) || null;
    } catch (error) {
      logger.error('Failed to get transaction by id', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List transactions using optional filters.
   * @param {Object} [filters={}] - Filter and sort options.
   * @returns {Promise<Object[]>} Matching transactions.
   */
  async list(filters = {}) {
    try {
      const data = await this._initialize();
      return this._filterTransactions(data.transactions, filters);
    } catch (error) {
      logger.error('Failed to list transactions', { error: error.message });
      throw error;
    }
  }

  /**
   * List transactions belonging to a specific license.
   * @param {string} licenseId - License identifier.
   * @param {Object} [filters={}] - Additional list options.
   * @returns {Promise<Object[]>} Matching transactions.
   */
  async getByLicense(licenseId, filters = {}) {
    try {
      return this.list({ ...filters, licenseId });
    } catch (error) {
      logger.error('Failed to get transactions by license', { error: error.message, licenseId });
      throw error;
    }
  }

  /**
   * Compute transaction statistics for all logs or a filtered subset.
   * @param {Object} [filters={}] - Optional reporting filters.
   * @returns {Promise<Object>} Aggregated transaction statistics.
   */
  async getStats(filters = {}) {
    try {
      const transactions = await this.list(filters);
      const amountTransactions = transactions.filter((item) => typeof item.amount === 'number');
      const totalAmount = amountTransactions.reduce((sum, item) => sum + item.amount, 0);

      return {
        total: transactions.length,
        success: transactions.filter((item) => item.type === TRANSACTION_STATUS.SUCCESS).length,
        failed: transactions.filter((item) => item.type === TRANSACTION_STATUS.FAILED).length,
        pending: transactions.filter((item) => item.type === TRANSACTION_STATUS.PENDING).length,
        totalAmount,
        averageAmount: amountTransactions.length > 0 ? totalAmount / amountTransactions.length : 0,
        latestTransactionAt: transactions[0]?.createdAt || null,
      };
    } catch (error) {
      logger.error('Failed to calculate transaction stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure the transaction store exists and is normalized.
   * @returns {Promise<Object>} Normalized store.
   * @private
   */
  async _initialize() {
    const current = await this.db.read();
    const normalized = this._normalizeStore(current);

    if (!current || Object.keys(current).length === 0 || !Array.isArray(current.transactions)) {
      await this.db.write(normalized);
    }

    return normalized;
  }

  /**
   * Normalize raw database data.
   * @param {Object} data - Raw store content.
   * @returns {{transactions: Object[]}} Normalized store structure.
   * @private
   */
  _normalizeStore(data) {
    return {
      transactions: Array.isArray(data?.transactions) ? data.transactions : [],
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
   * Convert a raw or partially masked card number into a stable stored mask.
   * @param {string} cardNumber - Raw card number input.
   * @returns {string} Masked card representation.
   * @private
   */
  _maskCardNumber(cardNumber) {
    const raw = String(cardNumber).trim();
    const digits = raw.replace(/\D/g, '');

    if (raw.startsWith('****') && digits.length === 4) {
      return `****${digits}`;
    }

    if (!isValidCardNumber(raw)) {
      throw new Error('Invalid card number');
    }

    return `****${digits.slice(-4)}`;
  }

  /**
   * Filter, sort, and limit transaction records.
   * @param {Object[]} transactions - Transaction collection.
   * @param {Object} filters - Filter and sort options.
   * @returns {Object[]} Filtered transactions.
   * @private
   */
  _filterTransactions(transactions, filters) {
    let items = [...transactions];

    if (filters.licenseId) {
      items = items.filter((item) => item.licenseId === filters.licenseId);
    }
    if (filters.type) {
      items = items.filter((item) => item.type === filters.type);
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

module.exports = new TransactionService();
