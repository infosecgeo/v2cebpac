const morgan = require('morgan');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * HTTP request logging middleware
 */

// Define custom tokens
morgan.token('user', (req) => {
  if (req.user) {
    return req.user.licenseKey || req.user.licenseId || 'unknown';
  }
  if (req.admin) {
    return `admin:${req.admin.username}`;
  }
  return 'anonymous';
});

// Create Morgan middleware
const requestLogger = morgan(
  ':remote-addr - :user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  {
    stream: logger.stream,
    skip: (req) => {
      // Skip healthcheck and static file requests
      return req.url === '/health' || req.url.startsWith('/admin/css') || req.url.startsWith('/admin/js');
    },
  }
);

module.exports = requestLogger;
