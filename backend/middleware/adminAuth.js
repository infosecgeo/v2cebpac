const jwt = require('jsonwebtoken');
const config = require('../config/env');
const security = require('../config/security');
const Response = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Admin authentication middleware
 */
function authenticateAdmin(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.unauthorized(res, 'No admin token provided');
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: [security.jwt.algorithm],
    });
    
    // Check if admin token
    if (decoded.type !== 'admin') {
      return Response.forbidden(res, 'Admin access required');
    }
    
    // Attach admin info to request
    req.admin = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return Response.error(res, 'TOKEN_EXPIRED', 'Admin token has expired', 401);
    }
    
    if (error.name === 'JsonWebTokenError') {
      return Response.error(res, 'INVALID_TOKEN', 'Invalid admin token', 401);
    }
    
    return Response.unauthorized(res, 'Admin authentication failed');
  }
}

/**
 * Superadmin authorization middleware
 */
function requireSuperadmin(req, res, next) {
  if (!req.admin) {
    return Response.unauthorized(res, 'Authentication required');
  }
  
  if (req.admin.role !== 'superadmin') {
    return Response.forbidden(res, 'Superadmin access required');
  }
  
  next();
}

module.exports = {
  authenticateAdmin,
  requireSuperadmin,
};
