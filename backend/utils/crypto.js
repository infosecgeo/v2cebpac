const crypto = require('crypto');

/**
 * Cryptographic utility functions
 */

/**
 * Generate a secure random string
 * @param {Number} length - Length of the string
 * @returns {String}
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a license key (format: XXXX-XXXX-XXXX-XXXX)
 * @returns {String}
 */
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  
  for (let i = 0; i < 4; i++) {
    if (i > 0) key += '-';
    for (let j = 0; j < 4; j++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      key += chars[randomIndex];
    }
  }
  
  return key;
}

/**
 * Generate a 6-digit linking code
 * @returns {String}
 */
function generateLinkingCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash a string using SHA256
 * @param {String} str - String to hash
 * @returns {String}
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate a device fingerprint
 * @param {String} userAgent - User agent string
 * @param {String} ip - IP address
 * @returns {String}
 */
function generateDeviceFingerprint(userAgent, ip) {
  const data = `${userAgent}|${ip}`;
  return sha256(data);
}

/**
 * Mask sensitive data (e.g., API keys, proxy URLs)
 * @param {String} str - String to mask
 * @param {Number} visibleChars - Number of visible characters
 * @returns {String}
 */
function maskString(str, visibleChars = 4) {
  if (!str || str.length <= visibleChars * 2) {
    return str;
  }
  const start = str.substring(0, visibleChars);
  const end = str.substring(str.length - visibleChars);
  const masked = '*'.repeat(Math.min(str.length - visibleChars * 2, 12));
  return `${start}${masked}${end}`;
}

module.exports = {
  generateRandomString,
  generateLicenseKey,
  generateLinkingCode,
  sha256,
  generateDeviceFingerprint,
  maskString,
};
