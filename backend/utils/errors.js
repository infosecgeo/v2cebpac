/**
 * Custom error classes
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class LicenseError extends AppError {
  constructor(message, errorCode) {
    super(message, 401, errorCode);
  }
}

class SessionError extends AppError {
  constructor(message, errorCode) {
    super(message, 409, errorCode);
  }
}

class CreditError extends AppError {
  constructor(message) {
    super(message, 403, 'NO_CREDITS');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  LicenseError,
  SessionError,
  CreditError,
};
