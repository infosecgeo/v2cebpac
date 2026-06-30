const path = require('path');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { SESSION_STATUS } = require('../../config/constants');
const logger = require('../../utils/logger');

const sessionSchema = Joi.object({
  id: Joi.string().uuid().required(),
  licenseId: Joi.string().required(),
  token: Joi.string().min(16).required(),
  status: Joi.string().valid(...Object.values(SESSION_STATUS)).required(),
  ipAddress: Joi.string().allow('').required(),
  userAgent: Joi.string().allow('').required(),
  createdAt: Joi.string().isoDate().required(),
  expiresAt: Joi.string().isoDate().required(),
  lastActivityAt: Joi.string().isoDate().required(),
});

const sessionStoreSchema = Joi.object({
  sessions: Joi.array().items(sessionSchema).required(),
});

const createSessionSchema = Joi.object({
  licenseId: Joi.string().required(),
  token: Joi.string().min(16).required(),
  status: Joi.string().valid(...Object.values(SESSION_STATUS)).default(SESSION_STATUS.ACTIVE),
  ipAddress: Joi.string().allow('').default(''),
  userAgent: Joi.string().allow('').default(''),
  expiresAt: Joi.string().isoDate().required(),
});

const updateActivitySchema = Joi.object({
  lastActivityAt: Joi.string().isoDate().optional(),
  ipAddress: Joi.string().allow('').optional(),
  userAgent: Joi.string().allow('').optional(),
  expiresAt: Joi.string().isoDate().optional(),
  status: Joi.string().valid(...Object.values(SESSION_STATUS)).optional(),
});

/**
 * Service for managing client sessions in JSON-backed storage.
 * Handles token lookup, activity refresh, and expired-session cleanup.
 */
class SessionService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'sessions.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = sessionStoreSchema.validate(data);
        if (error) {
          throw new Error(`Session data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Create a new session record.
   * @param {Object} payload - Session creation payload.
   * @returns {Promise<Object>} Persisted session.
   */
  async create(payload) {
    try {
      const value = this._validate(createSessionSchema, payload, 'Invalid session payload');
      const now = new Date().toISOString();
      const session = {
        id: uuidv4(),
        licenseId: value.licenseId,
        token: value.token,
        status: value.status,
        ipAddress: value.ipAddress,
        userAgent: value.userAgent,
        createdAt: now,
        expiresAt: value.expiresAt,
        lastActivityAt: now,
      };

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        if (data.sessions.some((item) => item.token === session.token)) {
          throw new Error('Session token already exists');
        }
        data.sessions.push(session);
        return data;
      });

      logger.info(`Created session: ${session.id}`);
      return session;
    } catch (error) {
      logger.error('Failed to create session', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a session by identifier.
   * @param {string} id - Session identifier.
   * @returns {Promise<Object|null>} Matching session or null.
   */
  async getById(id) {
    try {
      const data = await this._initialize();
      return data.sessions.find((item) => item.id === id) || null;
    } catch (error) {
      logger.error('Failed to get session by id', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get a session by its token.
   * @param {string} token - Session token.
   * @returns {Promise<Object|null>} Matching session or null.
   */
  async getByToken(token) {
    try {
      const data = await this._initialize();
      return data.sessions.find((item) => item.token === token) || null;
    } catch (error) {
      logger.error('Failed to get session by token', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a session record.
   * @param {string} id - Session identifier.
   * @returns {Promise<Object>} Removed session.
   */
  async delete(id) {
    try {
      let deletedSession = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const index = data.sessions.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Session not found');
        }
        deletedSession = data.sessions.splice(index, 1)[0];
        return data;
      });

      logger.info(`Deleted session: ${id}`);
      return deletedSession;
    } catch (error) {
      logger.error('Failed to delete session', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List sessions using optional filters.
   * @param {Object} [filters={}] - Filter and sort options.
   * @returns {Promise<Object[]>} Matching sessions.
   */
  async list(filters = {}) {
    try {
      const data = await this._initialize();
      let sessions = [...data.sessions];

      if (filters.licenseId) {
        sessions = sessions.filter((item) => item.licenseId === filters.licenseId);
      }
      if (filters.status) {
        sessions = sessions.filter((item) => item.status === filters.status);
      }
      if (filters.ipAddress) {
        sessions = sessions.filter((item) => item.ipAddress === filters.ipAddress);
      }
      if (filters.activeOnly) {
        const now = Date.now();
        sessions = sessions.filter(
          (item) => item.status === SESSION_STATUS.ACTIVE && new Date(item.expiresAt).getTime() > now
        );
      }
      if (filters.expired === true) {
        const now = Date.now();
        sessions = sessions.filter(
          (item) =>
            new Date(item.expiresAt).getTime() <= now || item.status === SESSION_STATUS.EXPIRED
        );
      }

      return this._sortAndLimit(sessions, filters);
    } catch (error) {
      logger.error('Failed to list sessions', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove all expired sessions from storage.
   * @returns {Promise<number>} Number of sessions removed.
   */
  async cleanup() {
    try {
      let removed = 0;
      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const now = Date.now();
        const initialLength = data.sessions.length;
        data.sessions = data.sessions.filter((item) => {
          return !(
            item.status === SESSION_STATUS.EXPIRED || new Date(item.expiresAt).getTime() <= now
          );
        });
        removed = initialLength - data.sessions.length;
        return data;
      });

      if (removed > 0) {
        logger.info(`Cleaned up expired sessions: ${removed}`);
      }

      return removed;
    } catch (error) {
      logger.error('Failed to cleanup sessions', { error: error.message });
      throw error;
    }
  }

  /**
   * Refresh session activity data.
   * @param {string} id - Session identifier.
   * @param {Object} [updates={}] - Optional session field updates.
   * @returns {Promise<Object>} Updated session.
   */
  async updateActivity(id, updates = {}) {
    try {
      const value = this._validate(updateActivitySchema, updates, 'Invalid session activity payload');
      let updatedSession = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const session = data.sessions.find((item) => item.id === id);

        if (!session) {
          throw new Error('Session not found');
        }

        const now = value.lastActivityAt || new Date().toISOString();
        if (new Date(session.expiresAt).getTime() <= Date.now()) {
          session.status = SESSION_STATUS.EXPIRED;
        }

        if (value.ipAddress !== undefined) {
          session.ipAddress = value.ipAddress;
        }
        if (value.userAgent !== undefined) {
          session.userAgent = value.userAgent;
        }
        if (value.expiresAt !== undefined) {
          session.expiresAt = value.expiresAt;
        }
        if (value.status !== undefined) {
          session.status = value.status;
        }

        session.lastActivityAt = now;
        updatedSession = { ...session };
        return data;
      });

      logger.info(`Updated session activity: ${id}`);
      return updatedSession;
    } catch (error) {
      logger.error('Failed to update session activity', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Ensure the session store exists and is normalized.
   * @returns {Promise<Object>} Normalized store.
   * @private
   */
  async _initialize() {
    const current = await this.db.read();
    const normalized = this._normalizeStore(current);

    if (!current || Object.keys(current).length === 0 || !Array.isArray(current.sessions)) {
      await this.db.write(normalized);
    }

    return normalized;
  }

  /**
   * Normalize raw database data.
   * @param {Object} data - Raw store content.
   * @returns {{sessions: Object[]}} Normalized store structure.
   * @private
   */
  _normalizeStore(data) {
    return {
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
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
   * Apply sorting and limit options to a collection.
   * @param {Object[]} items - Records to process.
   * @param {Object} filters - Sort and pagination options.
   * @returns {Object[]} Processed records.
   * @private
   */
  _sortAndLimit(items, filters) {
    const sortBy = filters.sortBy || 'lastActivityAt';
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

module.exports = new SessionService();
