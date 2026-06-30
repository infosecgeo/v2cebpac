const rateLimit = require('express-rate-limit');
const security = require('../config/security');
const config = require('../config/env');

/**
 * Rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: security.rateLimit.auth.windowMs,
  max: security.rateLimit.auth.max,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: security.rateLimit.auth.message,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return config.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for general API endpoints
 */
const apiLimiter = rateLimit({
  windowMs: security.rateLimit.api.windowMs,
  max: security.rateLimit.api.max,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: security.rateLimit.api.message,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return config.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for admin endpoints
 */
const adminLimiter = rateLimit({
  windowMs: security.rateLimit.admin.windowMs,
  max: security.rateLimit.admin.max,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: security.rateLimit.admin.message,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return config.NODE_ENV === 'development';
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
  adminLimiter,
};
