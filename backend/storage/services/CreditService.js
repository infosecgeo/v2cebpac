const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { CREDIT_OPERATION } = require('../../config/constants');
const logger = require('../../utils/logger');

const creditSchema = Joi.object({
  credits: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      licenseId: Joi.string().required(),
      operation: Joi.string().valid(...Object.values(CREDIT_OPERATION)).required(),
      amount: Joi.number().required(),
      balanceBefore: Joi.number().min(0).required(),
      balanceAfter: Joi.number().min(0).required(),
      reason: Joi.string().required(),
      performedBy: Joi.string().required(),
      createdAt: Joi.string().isoDate().required(),
    })
  ).required(),
});

class CreditService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'credits.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = creditSchema.validate(data);
        if (error) {
          throw new Error(\`Credit validation failed: \${error.message}\`);
        }
      },
    });
  }

  async _initialize() {
    const data = await this.db.read();
    if (!data || Object.keys(data).length === 0) {
      const initial = { credits: [] };
      await this.db.write(initial);
      return initial;
    }
    return data;
  }

  async create(creditData) {
    const credit = {
      id: uuidv4(),
      licenseId: creditData.licenseId,
      operation: creditData.operation,
      amount: creditData.amount,
      balanceBefore: creditData.balanceBefore,
      balanceAfter: creditData.balanceAfter,
      reason: creditData.reason,
      performedBy: creditData.performedBy,
      createdAt: new Date().toISOString(),
    };

    await this.db.update((data) => {
      data.credits.push(credit);
      return data;
    });

    logger.info(\`Credit operation: \${credit.operation} \${credit.amount} for license \${credit.licenseId}\`);
    return credit;
  }

  async getById(id) {
    const data = await this._initialize();
    return data.credits.find(c => c.id === id) || null;
  }

  async list(filters = {}) {
    const data = await this._initialize();
    let credits = data.credits;

    if (filters.licenseId) {
      credits = credits.filter(c => c.licenseId === filters.licenseId);
    }

    if (filters.operation) {
      credits = credits.filter(c => c.operation === filters.operation);
    }

    if (filters.limit) {
      credits = credits.slice(-filters.limit);
    }

    return credits.reverse();
  }

  async getByLicense(licenseId, limit = 100) {
    return this.list({ licenseId, limit });
  }

  async getBalance(licenseId) {
    const data = await this._initialize();
    const credits = data.credits.filter(c => c.licenseId === licenseId);

    if (credits.length === 0) {
      return 0;
    }

    const latest = credits[credits.length - 1];
    return latest.balanceAfter;
  }
}

module.exports = new CreditService();
