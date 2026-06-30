const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const TransactionService = require('../../storage/services/TransactionService');
const LicenseService = require('../../storage/services/LicenseService');
const CreditService = require('../../storage/services/CreditService');
const { TRANSACTION_STATUS, CREDIT_OPERATION, ERROR_CODE } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * POST /api/transactions/start
 * Start a new transaction
 */
router.post(
  '/start',
  authenticate,
  asyncHandler(async (req, res) => {
    const { licenseId, licenseKey } = req.user;
    const { cardNumber, metadata } = req.body;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 404);
    }

    // Check if license has credits
    if (license.credits <= 0) {
      logger.warn(`Transaction start failed - no credits for license: ${licenseKey}`);
      return Response.error(res, ERROR_CODE.NO_CREDITS, 'Insufficient credits', 402);
    }

    // Create pending transaction
    const transaction = await TransactionService.create({
      licenseId: license.id,
      type: TRANSACTION_STATUS.PENDING,
      cardNumber: cardNumber || '0000000000000000',
      message: 'Transaction started',
      metadata: metadata || {},
    });

    logger.info(`Transaction started: ${transaction.id} for license: ${licenseKey}`);

    return Response.success(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        cardNumber: transaction.cardNumber,
        message: transaction.message,
        createdAt: transaction.createdAt,
      },
      credits: license.credits,
    });
  })
);

/**
 * POST /api/transactions/complete
 * Complete a transaction and update credits
 */
router.post(
  '/complete',
  authenticate,
  validate(schemas.transactionComplete),
  asyncHandler(async (req, res) => {
    const { licenseId, licenseKey } = req.user;
    const { success, cardNumber, amount, message, metadata } = req.body;

    // Get license
    const license = await LicenseService.getById(licenseId);
    if (!license) {
      return Response.error(res, ERROR_CODE.INVALID_LICENSE, 'License not found', 404);
    }

    const transactionType = success ? TRANSACTION_STATUS.SUCCESS : TRANSACTION_STATUS.FAILED;
    let updatedCredits = license.credits;

    // Deduct credit if transaction was successful
    if (success && license.credits > 0) {
      const balanceBefore = license.credits;
      updatedCredits = balanceBefore - 1;

      // Update license credits
      await LicenseService.updateCredits(license.id, updatedCredits, { mode: 'set' });

      // Create credit history entry
      await CreditService.create({
        licenseId: license.id,
        operation: CREDIT_OPERATION.DEDUCT,
        amount: 1,
        balanceBefore,
        balanceAfter: updatedCredits,
        reason: 'Transaction completed successfully',
        performedBy: 'system',
      });

      logger.info(`Credit deducted for license: ${licenseKey}, new balance: ${updatedCredits}`);
    }

    // Create transaction log
    const transaction = await TransactionService.create({
      licenseId: license.id,
      type: transactionType,
      cardNumber: cardNumber || '0000000000000000',
      amount: amount || null,
      message: message || (success ? 'Transaction completed successfully' : 'Transaction failed'),
      metadata: metadata || {},
    });

    logger.info(`Transaction completed: ${transaction.id} (${transactionType}) for license: ${licenseKey}`);

    return Response.success(res, {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        cardNumber: transaction.cardNumber,
        amount: transaction.amount,
        message: transaction.message,
        createdAt: transaction.createdAt,
      },
      credits: updatedCredits,
    });
  })
);

/**
 * GET /api/transactions/history
 * Get transaction history
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const { licenseId } = req.user;
    const { limit, page, type } = req.query;

    const filters = {
      licenseId,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    if (type) {
      filters.type = type;
    }

    const transactions = await TransactionService.list(filters);

    // Implement pagination if page is specified
    let paginatedTransactions = transactions;
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      paginatedTransactions = transactions.slice(startIndex, startIndex + limitNum);
    }

    return Response.success(res, {
      transactions: paginatedTransactions,
      total: transactions.length,
      page: page ? parseInt(page, 10) : 1,
    });
  })
);

module.exports = router;
