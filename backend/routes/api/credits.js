const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const LicenseService = require('../../storage/services/LicenseService');
const CreditService = require('../../storage/services/CreditService');
const { ERROR_CODE } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * GET /api/credits/balance
 * Get credit balance and history
 */
router.get(
  '/balance',
  authenticate,
  asyncHandler(async (req, res) => {
    const { licenseId } = req.user;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 404);
    }

    // Get credit history to provide more context
    const history = await CreditService.getByLicense(licenseId, {
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return Response.success(res, {
      balance: license.credits,
      license: {
        id: license.id,
        key: license.key,
        userId: license.userId,
      },
      recentHistory: history.map((entry) => ({
        operation: entry.operation,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
    });
  })
);

/**
 * POST /api/credits/check
 * Check if user has credits
 */
router.post(
  '/check',
  authenticate,
  asyncHandler(async (req, res) => {
    const { licenseId } = req.user;
    const { required } = req.body;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 404);
    }

    const requiredCredits = required || 1;
    const hasEnough = license.credits >= requiredCredits;

    return Response.success(res, {
      balance: license.credits,
      required: requiredCredits,
      sufficient: hasEnough,
    });
  })
);

/**
 * POST /api/credits/topup/request
 * Request credit top-up
 */
router.post(
  '/topup/request',
  authenticate,
  validate(schemas.topupRequest),
  asyncHandler(async (req, res) => {
    const { licenseId, licenseKey } = req.user;
    const { amount, paymentMethod, paymentReference } = req.body;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 404);
    }

    // Log the top-up request
    logger.info(`Top-up request: ${amount} credits for license: ${licenseKey}`, {
      paymentMethod,
      paymentReference,
      licenseId,
    });

    // In a real system, this would create a pending top-up request in the database
    // and notify admins via Telegram or another channel
    // For now, we'll return a success message with instructions

    return Response.success(res, {
      message: 'Top-up request submitted successfully',
      request: {
        amount,
        paymentMethod,
        paymentReference: paymentReference || 'N/A',
        license: {
          id: license.id,
          key: license.key,
          userId: license.userId,
        },
        status: 'pending',
        instructions: 'Your top-up request has been submitted. An admin will review and process it shortly. You will be notified via Telegram when your credits are added.',
      },
    });
  })
);

module.exports = router;
