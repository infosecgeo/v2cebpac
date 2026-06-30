const Joi = require('joi');

/**
 * Validation helper functions
 */

/**
 * Validate license key format
 * @param {String} key - License key
 * @returns {Boolean}
 */
function isValidLicenseKey(key) {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

/**
 * Validate email format
 * @param {String} email - Email address
 * @returns {Boolean}
 */
function isValidEmail(email) {
  const schema = Joi.string().email();
  const result = schema.validate(email);
  return !result.error;
}

/**
 * Validate UUID format
 * @param {String} uuid - UUID string
 * @returns {Boolean}
 */
function isValidUUID(uuid) {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(uuid);
}

/**
 * Sanitize string input
 * @param {String} str - Input string
 * @returns {String}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Validate password strength
 * @param {String} password - Password
 * @returns {Object} { valid: Boolean, errors: Array }
 */
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be at most 128 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate card number format
 * @param {String} card - Card number
 * @returns {Boolean}
 */
function isValidCardNumber(card) {
  const cleaned = card.replace(/\D/g, '');
  return cleaned.length >= 13 && cleaned.length <= 19;
}

module.exports = {
  isValidLicenseKey,
  isValidEmail,
  isValidUUID,
  sanitizeString,
  validatePassword,
  isValidCardNumber,
};
