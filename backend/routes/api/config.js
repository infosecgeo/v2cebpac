const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');

/**
 * GET /api/config/runtime
 * Get runtime configuration for client
 */
router.get(
  '/runtime',
  authenticate,
  asyncHandler(async (req, res) => {
    // TODO: Implement in Phase 4
    Response.error(res, 'NOT_IMPLEMENTED', 'Config retrieval not yet implemented', 501);
  })
);

module.exports = router;
