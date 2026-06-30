const jwt = require('jsonwebtoken');
const config = require('../config/env');
const security = require('../config/security');
const { ERROR_CODE } = require('../config/constants');
const Response = require('../utils/response');
const logger = require('../utils/logger');

/**
 * JWT authentication middleware for client requests
 */
function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.unauthorized(res, 'No token provided');
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: [security.jwt.algorithm],
      issuer: security.jwt.issuer,
      audience: security.jwt.audience,
    });
    
    // Attach user info to request
    req.user = {
      licenseId: decoded.licenseId,
      licenseKey: decoded.licenseKey,
      sessionId: decoded.sessionId,
      type: decoded.type || 'client',
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return Response.error(res, ERROR_CODE.TOKEN_EXPIRED, 'Token has expired', 401);
    }
    
    if (error.name === 'JsonWebTokenError') {
      return Response.error(res, ERROR_CODE.INVALID_TOKEN, 'Invalid token', 401);
    }
    
    return Response.unauthorized(res, 'Authentication failed');
  }
}

/**
 * Optional authentication middleware
 */
function authenticateOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: [security.jwt.algorithm],
      issuer: security.jwt.issuer,
      audience: security.jwt.audience,
    });
    
    req.user = {
      licenseId: decoded.licenseId,
      licenseKey: decoded.licenseKey,
      sessionId: decoded.sessionId,
      type: decoded.type || 'client',
    };
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = {
  authenticate,
  authenticateOptional,
};
