const logger = require('../utils/logger');
const Response = require('../utils/response');
const { AppError } = require('../utils/errors');
const config = require('../config/env');

/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user || req.admin || null,
  });
  
  // Operational errors (known)
  if (err.isOperational) {
    return Response.error(
      res,
      err.errorCode,
      err.message,
      err.statusCode,
      err.errors ? { errors: err.errors } : {}
    );
  }
  
  // Programming or unknown errors
  if (config.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.message,
      stack: err.stack,
    });
  }
  
  // Production: don't leak error details
  return Response.internalError(res, 'An unexpected error occurred');
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  return Response.notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
