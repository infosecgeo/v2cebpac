const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { TRANSACTION_STATUS } = require('../../config/constants');
const logger = require('../../utils/logger');

const transactionSchema = Joi.object({
  transactions: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      licenseId: Joi.string().required(),
      type: Joi.string().valid(...Object.values(TRANSACTION_STATUS)).required(),
      cardNumber: Joi.string().allow(''),
      amount: Joi.number().min(0).allow(null),
      message: Joi.string().required(),
      metadata: Joi.object(),
      createdAt: Joi.string().isoDate().required(),
    })
  ).required(),
});

class TransactionService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'transactions.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = transactionSchema.validate(data);
        if (error) {
          throw new Error(\`Transaction validation failed: \${error.message}\`);
        }
      },
    });
  }

  async _initialize() {
    const data = await this.db.read();
    if (!data || Object.keys(data).length === 0) {
      const initial = { transactions: [] };
      await this.db.write(initial);
      return initial;
    }
    return data;
  }

  _maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '';
    return '****' + cardNumber.slice(-4);
  }

  async create(transactionData) {
    const transaction = {
      id: uuidv4(),
      licenseId: transactionData.licenseId,
      type: transactionData.type,
      cardNumber: this._maskCardNumber(transactionData.cardNumber),
      amount: transactionData.amount || null,
      message: transactionData.message,
      metadata: transactionData.metadata || {},
      createdAt: new Date().toISOString(),
    };

    await this.db.update((data) => {
      data.transactions.push(transaction);
      return data;
    });

    logger.info(\`Created transaction: \${transaction.id} (\${transaction.type})\`);
    return transaction;
  }

  async getById(id) {
    const data = await this._initialize();
    return data.transactions.find(t => t.id === id) || null;
  }

  async list(filters = {}) {
    const data = await this._initialize();
    let transactions = data.transactions;

    if (filters.licenseId) {
      transactions = transactions.filter(t => t.licenseId === filters.licenseId);
    }

    if (filters.type) {
      transactions = transactions.filter(t => t.type === filters.type);
    }

    if (filters.limit) {
      transactions = transactions.slice(-filters.limit);
    }

    return transactions.reverse();
  }

  async getByLicense(licenseId, limit = 100) {
    return this.list({ licenseId, limit });
  }

  async getStats(licenseId = null) {
    const data = await this._initialize();
    let transactions = data.transactions;

    if (licenseId) {
      transactions = transactions.filter(t => t.licenseId === licenseId);
    }

    const stats = {
      total: transactions.length,
      success: transactions.filter(t => t.type === TRANSACTION_STATUS.SUCCESS).length,
      failed: transactions.filter(t => t.type === TRANSACTION_STATUS.FAILED).length,
      pending: transactions.filter(t => t.type === TRANSACTION_STATUS.PENDING).length,
    };

    if (stats.total > 0) {
      stats.successRate = (stats.success / stats.total) * 100;
    } else {
      stats.successRate = 0;
    }

    return stats;
  }
}

module.exports = new TransactionService();
