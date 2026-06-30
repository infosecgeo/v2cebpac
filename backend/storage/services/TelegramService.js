const path = require('path');
const Joi = require('joi');
const DatabaseManager = require('../DatabaseManager');
const logger = require('../../utils/logger');

// Validation schema for telegram data
const telegramSchema = Joi.object({
  bot: Joi.object({
    token: Joi.string().required(),
    username: Joi.string().required(),
    isActive: Joi.boolean().required(),
  }).required(),
  linkingRequests: Joi.array().items(
    Joi.object({
      requestId: Joi.string().required(),
      licenseKey: Joi.string().required(),
      telegramId: Joi.string().required(),
      telegramUsername: Joi.string().allow(''),
      status: Joi.string().valid('pending', 'approved', 'expired').required(),
      createdAt: Joi.string().isoDate().required(),
      expiresAt: Joi.string().isoDate().required(),
    })
  ).required(),
  linkedAccounts: Joi.array().items(
    Joi.object({
      licenseKey: Joi.string().required(),
      telegramId: Joi.string().required(),
      telegramUsername: Joi.string().allow(''),
      linkedAt: Joi.string().isoDate().required(),
    })
  ).required(),
});

/**
 * Telegram Service
 * Manages Telegram bot data and account linking
 */
class TelegramService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'telegram.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = telegramSchema.validate(data);
        if (error) {
          throw new Error(`Telegram data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Initialize telegram data structure
   * @private
   */
  async _initialize() {
    const data = await this.db.read();
    if (!data || Object.keys(data).length === 0) {
      const initial = {
        bot: {
          token: process.env.TELEGRAM_BOT_TOKEN || '',
          username: '',
          isActive: false,
        },
        linkingRequests: [],
        linkedAccounts: [],
      };
      await this.db.write(initial);
      return initial;
    }
    return data;
  }

  /**
   * Get bot configuration
   * @returns {Promise<Object>}
   */
  async getBotConfig() {
    const data = await this._initialize();
    return data.bot;
  }

  /**
   * Update bot configuration
   * @param {Object} config - Bot config updates
   * @returns {Promise<Object>}
   */
  async updateBotConfig(config) {
    const updated = await this.db.update((data) => {
      data.bot = { ...data.bot, ...config };
      return data;
    });
    logger.info('Telegram bot config updated');
    return updated.bot;
  }

  /**
   * Create a linking request
   * @param {string} licenseKey - License key
   * @param {string} telegramId - Telegram user ID
   * @param {string} telegramUsername - Telegram username
   * @returns {Promise<Object>} Created request
   */
  async createLinkingRequest(licenseKey, telegramId, telegramUsername = '') {
    const { v4: uuidv4 } = require('uuid');
    
    const request = {
      requestId: uuidv4(),
      licenseKey,
      telegramId,
      telegramUsername,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    };

    await this.db.update((data) => {
      data.linkingRequests.push(request);
      return data;
    });

    logger.info(`Created linking request: ${request.requestId}`);
    return request;
  }

  /**
   * Get linking request by ID
   * @param {string} requestId - Request ID
   * @returns {Promise<Object|null>}
   */
  async getLinkingRequest(requestId) {
    const data = await this._initialize();
    return data.linkingRequests.find(r => r.requestId === requestId) || null;
  }

  /**
   * Approve a linking request
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Linked account
   */
  async approveLinkingRequest(requestId) {
    const updated = await this.db.update((data) => {
      const request = data.linkingRequests.find(r => r.requestId === requestId);
      if (!request) {
        throw new Error('Linking request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request is not pending');
      }

      // Check if already linked
      const existing = data.linkedAccounts.find(
        a => a.licenseKey === request.licenseKey || a.telegramId === request.telegramId
      );
      if (existing) {
        throw new Error('Account already linked');
      }

      // Create linked account
      const linkedAccount = {
        licenseKey: request.licenseKey,
        telegramId: request.telegramId,
        telegramUsername: request.telegramUsername,
        linkedAt: new Date().toISOString(),
      };
      data.linkedAccounts.push(linkedAccount);

      // Mark request as approved
      request.status = 'approved';

      return data;
    });

    logger.info(`Approved linking request: ${requestId}`);
    const linkedAccount = updated.linkedAccounts[updated.linkedAccounts.length - 1];
    return linkedAccount;
  }

  /**
   * Get linked account by license key
   * @param {string} licenseKey - License key
   * @returns {Promise<Object|null>}
   */
  async getLinkedAccountByLicense(licenseKey) {
    const data = await this._initialize();
    return data.linkedAccounts.find(a => a.licenseKey === licenseKey) || null;
  }

  /**
   * Get linked account by telegram ID
   * @param {string} telegramId - Telegram ID
   * @returns {Promise<Object|null>}
   */
  async getLinkedAccountByTelegram(telegramId) {
    const data = await this._initialize();
    return data.linkedAccounts.find(a => a.telegramId === telegramId) || null;
  }

  /**
   * Unlink an account
   * @param {string} licenseKey - License key
   * @returns {Promise<void>}
   */
  async unlinkAccount(licenseKey) {
    await this.db.update((data) => {
      const index = data.linkedAccounts.findIndex(a => a.licenseKey === licenseKey);
      if (index === -1) {
        throw new Error('Linked account not found');
      }
      data.linkedAccounts.splice(index, 1);
      return data;
    });

    logger.info(`Unlinked account: ${licenseKey}`);
  }

  /**
   * Cleanup expired linking requests
   * @returns {Promise<number>} Number of expired requests removed
   */
  async cleanupExpiredRequests() {
    const now = new Date();
    let removed = 0;

    await this.db.update((data) => {
      const initialLength = data.linkingRequests.length;
      data.linkingRequests = data.linkingRequests.filter(r => {
        if (r.status === 'pending' && new Date(r.expiresAt) < now) {
          return false; // Remove expired
        }
        return true;
      });
      removed = initialLength - data.linkingRequests.length;
      return data;
    });

    if (removed > 0) {
      logger.info(`Cleaned up ${removed} expired linking requests`);
    }

    return removed;
  }

  /**
   * List all linked accounts
   * @returns {Promise<Array>}
   */
  async listLinkedAccounts() {
    const data = await this._initialize();
    return data.linkedAccounts;
  }

  /**
   * List pending linking requests
   * @returns {Promise<Array>}
   */
  async listPendingRequests() {
    const data = await this._initialize();
    return data.linkingRequests.filter(r => r.status === 'pending');
  }
}

// Export singleton instance
module.exports = new TelegramService();
