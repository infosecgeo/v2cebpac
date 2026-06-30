const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const TransactionService = require('../../storage/services/TransactionService');
const LicenseService = require('../../storage/services/LicenseService');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/transactions
 * List all transactions with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { licenseId, type, since, until, page, limit, sortBy, sortOrder } = req.query;

    const filters = {
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    };

    if (licenseId) {
      filters.licenseId = licenseId;
    }
    if (type) {
      filters.type = type;
    }
    if (since) {
      filters.since = since;
    }
    if (until) {
      filters.until = until;
    }

    const allTransactions = await TransactionService.list(filters);

    // Implement pagination
    let paginatedTransactions = allTransactions;
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      paginatedTransactions = allTransactions.slice(startIndex, startIndex + limitNum);
    }

    // Enrich with license data
    const enrichedTransactions = await Promise.all(
      paginatedTransactions.map(async (t) => {
        const license = await LicenseService.getById(t.licenseId);
        return {
          ...t,
          license: license
            ? {
                id: license.id,
                key: license.key,
                userId: license.userId,
              }
            : null,
        };
      })
    );

    logger.info(`Transactions listed by admin: ${req.admin.username}`);

    return Response.success(res, {
      transactions: enrichedTransactions,
      total: allTransactions.length,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : allTransactions.length,
    });
  })
);

/**
 * GET /api/admin/transactions/stats
 * Get transaction statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { licenseId, since, until } = req.query;

    const filters = {};
    if (licenseId) {
      filters.licenseId = licenseId;
    }
    if (since) {
      filters.since = since;
    }
    if (until) {
      filters.until = until;
    }

    const stats = await TransactionService.getStats(filters);

    logger.info(`Transaction stats retrieved by admin: ${req.admin.username}`);

    return Response.success(res, { stats });
  })
);

/**
 * GET /api/admin/transactions/:id
 * Get a specific transaction by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await TransactionService.getById(id);
    if (!transaction) {
      return Response.notFound(res, 'Transaction not found');
    }

    // Enrich with license data
    const license = await LicenseService.getById(transaction.licenseId);
    const enrichedTransaction = {
      ...transaction,
      license: license
        ? {
            id: license.id,
            key: license.key,
            userId: license.userId,
            credits: license.credits,
          }
        : null,
    };

    return Response.success(res, { transaction: enrichedTransaction });
  })
);

module.exports = router;
