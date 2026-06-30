const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticate } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');
const { validate, schemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const LicenseService = require('../../storage/services/LicenseService');
const SessionService = require('../../storage/services/SessionService');
const { LICENSE_STATUS, SESSION_STATUS, ERROR_CODE } = require('../../config/constants');
const config = require('../../config/env');
const security = require('../../config/security');
const logger = require('../../utils/logger');

/**
 * POST /api/auth/license
 * Authenticate with license key
 */
router.post(
  '/license',
  authLimiter,
  validate(schemas.licenseKey),
  asyncHandler(async (req, res) => {
    const { licenseKey } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Find license by key
    const license = await LicenseService.getByKey(licenseKey);
    
    if (!license) {
      logger.warn(`Failed auth attempt - invalid license: ${licenseKey}`);
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'Invalid license key', 401);
    }

    // Check license status
    if (license.status !== LICENSE_STATUS.ACTIVE) {
      logger.warn(`Failed auth attempt - inactive license: ${licenseKey} (${license.status})`);
      return Response.error(
        res, 
        license.status === LICENSE_STATUS.EXPIRED ? ERROR_CODE.LICENSE_EXPIRED : ERROR_CODE.LICENSE_SUSPENDED,
        `License is ${license.status}`,
        401
      );
    }

    // Check expiration
    if (new Date(license.expiresAt) <= new Date()) {
      logger.warn(`Failed auth attempt - expired license: ${licenseKey}`);
      await LicenseService.update(license.id, { status: LICENSE_STATUS.EXPIRED });
      return Response.error(res, ERROR_CODE.LICENSE_EXPIRED, 'License has expired', 401);
    }

    // Check concurrent sessions
    const activeSessions = await SessionService.list({
      licenseId: license.id,
      activeOnly: true,
    });
    
    if (activeSessions.length >= license.maxConcurrentSessions) {
      logger.warn(`Failed auth attempt - max sessions reached for: ${licenseKey}`);
      return Response.error(
        res,
        ERROR_CODE.SESSION_EXISTS,
        `Maximum concurrent sessions (${license.maxConcurrentSessions}) reached`,
        429
      );
    }

    // Generate JWT token
    const sessionExpiresAt = new Date(Date.now() + config.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();
    const tokenPayload = {
      licenseId: license.id,
      licenseKey: license.key,
      type: 'client',
    };
    
    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      algorithm: security.jwt.algorithm,
      issuer: security.jwt.issuer,
      audience: security.jwt.audience,
      expiresIn: config.JWT_EXPIRES_IN,
    });

    // Create session record
    const session = await SessionService.create({
      licenseId: license.id,
      token,
      status: SESSION_STATUS.ACTIVE,
      ipAddress,
      userAgent,
      expiresAt: sessionExpiresAt,
    });

    // Update license last used
    await LicenseService.update(license.id, {
      lastUsedAt: new Date().toISOString(),
    });

    logger.info(`Successful authentication for license: ${license.key}`);

    return Response.success(res, {
      token,
      expiresAt: sessionExpiresAt,
      license: {
        id: license.id,
        key: license.key,
        userId: license.userId,
        credits: license.credits,
        expiresAt: license.expiresAt,
        maxConcurrentSessions: license.maxConcurrentSessions,
      },
      session: {
        id: session.id,
        createdAt: session.createdAt,
      },
    });
  })
);

/**
 * GET /api/auth/validate
 * Validate current session token
 */
router.get(
  '/validate',
  authenticate,
  asyncHandler(async (req, res) => {
    const { licenseId, sessionId } = req.user;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 401);
    }

    // Get session if sessionId exists
    let session = null;
    if (sessionId) {
      session = await SessionService.getById(sessionId);
    }

    // Check license status
    if (license.status !== LICENSE_STATUS.ACTIVE) {
      return Response.error(
        res,
        license.status === LICENSE_STATUS.EXPIRED ? ERROR_CODE.LICENSE_EXPIRED : ERROR_CODE.LICENSE_SUSPENDED,
        `License is ${license.status}`,
        401
      );
    }

    // Check expiration
    if (new Date(license.expiresAt) <= new Date()) {
      await LicenseService.update(license.id, { status: LICENSE_STATUS.EXPIRED });
      return Response.error(res, ERROR_CODE.LICENSE_EXPIRED, 'License has expired', 401);
    }

    // Update session activity if session exists
    if (session) {
      await SessionService.updateActivity(session.id);
    }

    return Response.success(res, {
      valid: true,
      license: {
        id: license.id,
        key: license.key,
        userId: license.userId,
        status: license.status,
        credits: license.credits,
        expiresAt: license.expiresAt,
      },
    });
  })
);

/**
 * POST /api/auth/logout
 * Terminate current session
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.user;

    if (sessionId) {
      try {
        const session = await SessionService.getById(sessionId);
        if (session) {
          await SessionService.updateActivity(sessionId, {
            status: SESSION_STATUS.TERMINATED,
          });
          logger.info(`Session terminated: ${sessionId}`);
        }
      } catch (error) {
        logger.error('Error terminating session', { error: error.message, sessionId });
      }
    }

    return Response.success(res, {
      message: 'Logged out successfully',
    });
  })
);

module.exports = router;
