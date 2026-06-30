const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const ConfigService = require('../../storage/services/ConfigService');
const logger = require('../../utils/logger');

/**
 * GET /api/config/runtime
 * Get runtime configuration for client
 */
router.get(
  '/runtime',
  authenticate,
  asyncHandler(async (req, res) => {
    const config = await ConfigService.get();
    
    // Return only client-relevant config sections
    const runtimeConfig = {
      runtime: config.runtime || {},
      proxy: {
        primary: config.proxy?.primary || '',
        rotationStrategy: config.proxy?.rotationStrategy || 'random',
      },
      processing: config.processing || {},
      modes: config.modes || {},
      payment: config.payment || {},
      version: config.version || 1,
      updatedAt: config.updatedAt,
    };

    logger.info(`Config retrieved by license: ${req.user.licenseId}`);
    
    return Response.success(res, { config: runtimeConfig });
  })
);

module.exports = router;
