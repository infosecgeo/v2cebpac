const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const ConfigService = require('../../storage/services/ConfigService');
const { ERROR_CODE } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/config
 * Get current runtime configuration
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const config = await ConfigService.get(false); // Don't use cache for admin

    logger.info(`Config retrieved by admin: ${req.admin.username}`);

    return Response.success(res, { config });
  })
);

/**
 * POST /api/admin/config
 * Update runtime configuration
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'No configuration updates provided', 400);
    }

    const updatedConfig = await ConfigService.update(updates, req.admin.username);

    logger.info(`Config updated by admin: ${req.admin.username}`);

    return Response.success(res, {
      config: updatedConfig,
      message: 'Configuration updated successfully',
    });
  })
);

/**
 * POST /api/admin/config/reset
 * Reset configuration to defaults
 */
router.post(
  '/reset',
  asyncHandler(async (req, res) => {
    const defaultConfig = await ConfigService.reset(req.admin.username);

    logger.info(`Config reset to defaults by admin: ${req.admin.username}`);

    return Response.success(res, {
      config: defaultConfig,
      message: 'Configuration reset to defaults',
    });
  })
);

/**
 * GET /api/admin/config/:section
 * Get a specific configuration section
 */
router.get(
  '/:section',
  asyncHandler(async (req, res) => {
    const { section } = req.params;

    const sectionData = await ConfigService.getSection(section);
    if (!sectionData) {
      return Response.notFound(res, `Configuration section '${section}' not found`);
    }

    return Response.success(res, { section, data: sectionData });
  })
);

/**
 * POST /api/admin/config/:section
 * Update a specific configuration section
 */
router.post(
  '/:section',
  asyncHandler(async (req, res) => {
    const { section } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'No updates provided', 400);
    }

    const updatedConfig = await ConfigService.updateSection(section, updates, req.admin.username);

    logger.info(`Config section '${section}' updated by admin: ${req.admin.username}`);

    return Response.success(res, {
      config: updatedConfig,
      message: `Configuration section '${section}' updated successfully`,
    });
  })
);

module.exports = router;
