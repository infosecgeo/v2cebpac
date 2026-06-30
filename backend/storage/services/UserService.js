const path = require('path');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../DatabaseManager');
const { USER_ROLE } = require('../../config/constants');
const logger = require('../../utils/logger');

const userSchema = Joi.object({
  id: Joi.string().uuid().required(),
  username: Joi.string().trim().min(3).max(50).required(),
  passwordHash: Joi.string().min(20).required(),
  role: Joi.string().valid(...Object.values(USER_ROLE)).required(),
  email: Joi.string().email().allow(null, '').required(),
  createdAt: Joi.string().isoDate().required(),
  lastLoginAt: Joi.string().isoDate().allow(null).required(),
  isActive: Joi.boolean().required(),
});

const userStoreSchema = Joi.object({
  users: Joi.array().items(userSchema).required(),
});

const createUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  passwordHash: Joi.string().min(20).required(),
  role: Joi.string().valid(...Object.values(USER_ROLE)).default(USER_ROLE.ADMIN),
  email: Joi.string().email().allow(null, '').optional(),
  isActive: Joi.boolean().default(true),
});

const updateUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).optional(),
  passwordHash: Joi.string().min(20).optional(),
  role: Joi.string().valid(...Object.values(USER_ROLE)).optional(),
  email: Joi.string().email().allow(null, '').optional(),
  lastLoginAt: Joi.string().isoDate().allow(null).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

/**
 * Service for managing administrative users in JSON-backed storage.
 * Handles persistence, uniqueness checks, authentication, and last-login tracking.
 */
class UserService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'users.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = userStoreSchema.validate(data);
        if (error) {
          throw new Error(`User data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Create a new administrative user.
   * @param {Object} payload - User creation payload.
   * @returns {Promise<Object>} Persisted user record.
   */
  async create(payload) {
    try {
      const value = this._validate(createUserSchema, payload, 'Invalid user payload');
      const normalizedUsername = this._normalizeUsername(value.username);
      const normalizedEmail = this._normalizeEmail(value.email);
      const user = {
        id: uuidv4(),
        username: normalizedUsername,
        passwordHash: value.passwordHash,
        role: value.role,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        isActive: value.isActive,
      };

      await this.db.update((current) => {
        const data = this._normalizeStore(current);

        if (data.users.some((item) => this._normalizeUsername(item.username) === normalizedUsername)) {
          throw new Error('Username already exists');
        }

        if (normalizedEmail && data.users.some((item) => this._normalizeEmail(item.email) === normalizedEmail)) {
          throw new Error('Email address already exists');
        }

        data.users.push(user);
        return data;
      });

      logger.info(`Created admin user: ${user.id}`);
      return user;
    } catch (error) {
      logger.error('Failed to create user', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a user by identifier.
   * @param {string} id - User identifier.
   * @returns {Promise<Object|null>} Matching user or null.
   */
  async getById(id) {
    try {
      const data = await this._initialize();
      return data.users.find((item) => item.id === id) || null;
    } catch (error) {
      logger.error('Failed to get user by id', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get a user by username using case-insensitive lookup.
   * @param {string} username - Username value.
   * @returns {Promise<Object|null>} Matching user or null.
   */
  async getByUsername(username) {
    try {
      const data = await this._initialize();
      const normalized = this._normalizeUsername(username);
      return data.users.find((item) => this._normalizeUsername(item.username) === normalized) || null;
    } catch (error) {
      logger.error('Failed to get user by username', { error: error.message, username });
      throw error;
    }
  }

  /**
   * Update mutable user fields.
   * @param {string} id - User identifier.
   * @param {Object} updates - Partial update payload.
   * @returns {Promise<Object>} Updated user.
   */
  async update(id, updates) {
    try {
      const value = this._validate(updateUserSchema, updates, 'Invalid user update payload');
      let updatedUser = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const user = data.users.find((item) => item.id === id);

        if (!user) {
          throw new Error('User not found');
        }

        const nextUsername = value.username ? this._normalizeUsername(value.username) : this._normalizeUsername(user.username);
        const nextEmail = value.email !== undefined ? this._normalizeEmail(value.email) : this._normalizeEmail(user.email);
        const nextRole = value.role || user.role;
        const nextIsActive = value.isActive !== undefined ? value.isActive : user.isActive;

        if (data.users.some((item) => item.id !== id && this._normalizeUsername(item.username) === nextUsername)) {
          throw new Error('Username already exists');
        }

        if (nextEmail && data.users.some((item) => item.id !== id && this._normalizeEmail(item.email) === nextEmail)) {
          throw new Error('Email address already exists');
        }

        if (!this._canRetainSuperadminAccess(data.users, id, nextRole, nextIsActive)) {
          throw new Error('At least one active superadmin account must remain');
        }

        Object.assign(user, {
          ...value,
          username: nextUsername,
          email: nextEmail,
          role: nextRole,
          isActive: nextIsActive,
        });

        updatedUser = { ...user };
        return data;
      });

      logger.info(`Updated admin user: ${id}`);
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Delete a user while preserving at least one active superadmin.
   * @param {string} id - User identifier.
   * @returns {Promise<Object>} Removed user.
   */
  async delete(id) {
    try {
      let deletedUser = null;

      await this.db.update((current) => {
        const data = this._normalizeStore(current);
        const index = data.users.findIndex((item) => item.id === id);

        if (index === -1) {
          throw new Error('User not found');
        }

        const candidate = data.users[index];
        if (!this._canDeleteUser(data.users, candidate)) {
          throw new Error('Cannot delete the last active superadmin');
        }

        deletedUser = data.users.splice(index, 1)[0];
        return data;
      });

      logger.info(`Deleted admin user: ${id}`);
      return deletedUser;
    } catch (error) {
      logger.error('Failed to delete user', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List users with optional filtering and sorting.
   * @param {Object} [filters={}] - Filter and sort options.
   * @returns {Promise<Object[]>} Matching users.
   */
  async list(filters = {}) {
    try {
      const data = await this._initialize();
      let users = [...data.users];

      if (filters.role) {
        users = users.filter((item) => item.role === filters.role);
      }
      if (filters.isActive !== undefined) {
        users = users.filter((item) => item.isActive === filters.isActive);
      }
      if (filters.query) {
        const needle = String(filters.query).trim().toLowerCase();
        users = users.filter((item) => {
          return [item.username, item.email, item.role]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        });
      }

      return this._sortAndLimit(users, filters);
    } catch (error) {
      logger.error('Failed to list users', { error: error.message });
      throw error;
    }
  }

  /**
   * Authenticate an admin user against a bcrypt password hash.
   * @param {string} username - Username value.
   * @param {string} password - Plaintext password.
   * @returns {Promise<Object|null>} Authenticated user or null.
   */
  async authenticate(username, password) {
    try {
      if (!password) {
        return null;
      }

      const user = await this.getByUsername(username);
      if (!user || !user.isActive) {
        return null;
      }

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        logger.warn(`Failed admin authentication attempt for ${username}`);
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Failed to authenticate user', { error: error.message, username });
      throw error;
    }
  }

  /**
   * Update the last-login timestamp for a user.
   * @param {string} id - User identifier.
   * @param {string} [timestamp] - Optional ISO timestamp override.
   * @returns {Promise<Object>} Updated user.
   */
  async updateLastLogin(id, timestamp = new Date().toISOString()) {
    try {
      return this.update(id, { lastLoginAt: timestamp });
    } catch (error) {
      logger.error('Failed to update last login', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Ensure the user store exists and is normalized.
   * @returns {Promise<Object>} Normalized store.
   * @private
   */
  async _initialize() {
    const current = await this.db.read();
    const normalized = this._normalizeStore(current);

    if (!current || Object.keys(current).length === 0 || !Array.isArray(current.users)) {
      await this.db.write(normalized);
    }

    return normalized;
  }

  /**
   * Normalize raw database data.
   * @param {Object} data - Raw store content.
   * @returns {{users: Object[]}} Normalized store structure.
   * @private
   */
  _normalizeStore(data) {
    return {
      users: Array.isArray(data?.users) ? data.users : [],
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
   * Normalize usernames for lookups and storage.
   * @param {string} username - Raw username.
   * @returns {string} Normalized username.
   * @private
   */
  _normalizeUsername(username) {
    return String(username).trim().toLowerCase();
  }

  /**
   * Normalize email addresses for uniqueness checks.
   * @param {string|null|undefined} email - Raw email value.
   * @returns {string|null} Normalized email or null.
   * @private
   */
  _normalizeEmail(email) {
    if (!email) {
      return null;
    }
    return String(email).trim().toLowerCase();
  }

  /**
   * Ensure the update does not remove all active superadmins.
   * @param {Object[]} users - Current user collection.
   * @param {string} targetId - Updated user id.
   * @param {string} nextRole - Resulting role.
   * @param {boolean} nextIsActive - Resulting active flag.
   * @returns {boolean} True when at least one active superadmin remains.
   * @private
   */
  _canRetainSuperadminAccess(users, targetId, nextRole, nextIsActive) {
    const activeSuperadmins = users.filter((item) => item.role === USER_ROLE.SUPERADMIN && item.isActive);
    if (activeSuperadmins.length !== 1 || activeSuperadmins[0].id !== targetId) {
      return true;
    }
    return nextRole === USER_ROLE.SUPERADMIN && nextIsActive === true;
  }

  /**
   * Check whether a user can be deleted without removing all active superadmins.
   * @param {Object[]} users - Current user collection.
   * @param {Object} candidate - User considered for deletion.
   * @returns {boolean} True when deletion is safe.
   * @private
   */
  _canDeleteUser(users, candidate) {
    if (candidate.role !== USER_ROLE.SUPERADMIN || !candidate.isActive) {
      return true;
    }
    return users.some((item) => item.id !== candidate.id && item.role === USER_ROLE.SUPERADMIN && item.isActive);
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

module.exports = new UserService();

