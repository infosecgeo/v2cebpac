/**
 * Standard response formatter
 */
class ResponseFormatter {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {Object} data - Response data
   * @param {Number} statusCode - HTTP status code
   */
  static success(res, data = {}, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      ...data,
    });
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {String} error - Error code
   * @param {String} message - Error message
   * @param {Number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   */
  static error(res, error, message, statusCode = 400, details = {}) {
    return res.status(statusCode).json({
      success: false,
      error,
      message,
      ...details,
    });
  }

  /**
   * Validation error response
   * @param {Object} res - Express response object
   * @param {Array} errors - Validation errors
   */
  static validationError(res, errors) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
    });
  }

  /**
   * Unauthorized response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message,
    });
  }

  /**
   * Forbidden response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static forbidden(res, message = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message,
    });
  }

  /**
   * Not found response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message,
    });
  }

  /**
   * Internal server error response
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static internalError(res, message = 'Internal server error') {
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message,
    });
  }
}

module.exports = ResponseFormatter;
