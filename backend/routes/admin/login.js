const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authLimiter } = require('../../middleware/rateLimit');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const UserService = require('../../storage/services/UserService');
const { ERROR_CODE } = require('../../config/constants');
const config = require('../../config/env');
const security = require('../../config/security');
const logger = require('../../utils/logger');

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post(
  '/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Username and password are required', 400);
    }

    // Authenticate user
    const user = await UserService.authenticate(username, password);
    if (!user) {
      logger.warn(`Failed admin login attempt for username: ${username}`);
      return Response.error(res, ERROR_CODE.UNAUTHORIZED, 'Invalid credentials', 401);
    }

    // Update last login timestamp
    await UserService.updateLastLogin(user.id);

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'admin',
    };

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      algorithm: security.jwt.algorithm,
      expiresIn: config.JWT_EXPIRES_IN,
    });

    logger.info(`Successful admin login: ${username}`);

    return Response.success(res, {
      token,
      admin: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
    });
  })
);

module.exports = router;
