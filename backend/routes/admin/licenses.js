const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const { requireSuperadmin } = require('../../middleware/adminAuth');
const Response = require('../../utils/response');
const LicenseService = require('../../storage/services/LicenseService');
const CreditService = require('../../storage/services/CreditService');
const SessionService = require('../../storage/services/SessionService');
const { LICENSE_STATUS, CREDIT_OPERATION, SESSION_STATUS, ERROR_CODE } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/licenses
 * List all licenses with optional filtering
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, userId, query, page, limit, sortBy, sortOrder } = req.query;

    const filters = {};

    if (status) {
      filters.status = status;
    }
    if (userId) {
      filters.userId = userId;
    }
    if (query) {
      filters.query = query;
    }
    if (sortBy) {
      filters.sortBy = sortBy;
    }
    if (sortOrder) {
      filters.sortOrder = sortOrder;
    }

    const allLicenses = await LicenseService.list(filters);

    // Implement pagination
    let paginatedLicenses = allLicenses;
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      paginatedLicenses = allLicenses.slice(startIndex, startIndex + limitNum);
    }

    logger.info(`Licenses listed by admin: ${req.admin.username}`);

    return Response.success(res, {
      licenses: paginatedLicenses,
      total: allLicenses.length,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : allLicenses.length,
    });
  })
);

/**
 * GET /api/admin/licenses/:id
 * Get a specific license by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const license = await LicenseService.getById(id);
    if (!license) {
      return Response.notFound(res, 'License not found');
    }

    // Get related data
    const sessions = await SessionService.list({ licenseId: id });
    const creditHistory = await CreditService.getByLicense(id, { limit: 20 });

    return Response.success(res, {
      license,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        lastActivityAt: s.lastActivityAt,
      })),
      creditHistory: creditHistory.map((c) => ({
        operation: c.operation,
        amount: c.amount,
        balanceAfter: c.balanceAfter,
        reason: c.reason,
        performedBy: c.performedBy,
        createdAt: c.createdAt,
      })),
    });
  })
);

/**
 * POST /api/admin/licenses
 * Create a new license (superadmin only)
 */
router.post(
  '/',
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const { key, userId, credits, maxConcurrentSessions, expiresAt, telegramId, telegramUsername } = req.body;

    // Validate required fields
    if (!key || !userId || !expiresAt) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Missing required fields: key, userId, expiresAt', 400);
    }

    const license = await LicenseService.create({
      key,
      userId,
      status: LICENSE_STATUS.ACTIVE,
      credits: credits || 0,
      maxConcurrentSessions: maxConcurrentSessions || 1,
      expiresAt,
      telegramId: telegramId || null,
      telegramUsername: telegramUsername || null,
    });

    // Create initial credit entry if credits > 0
    if (credits && credits > 0) {
      await CreditService.create({
        licenseId: license.id,
        operation: CREDIT_OPERATION.TOPUP,
        amount: credits,
        balanceBefore: 0,
        balanceAfter: credits,
        reason: 'Initial credit allocation',
        performedBy: req.admin.username,
      });
    }

    logger.info(`License created by admin: ${req.admin.username}`, { licenseId: license.id });

    return Response.success(res, { license }, 201);
  })
);

/**
 * PATCH /api/admin/licenses/:id
 * Update a license
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Check if license exists
    const existingLicense = await LicenseService.getById(id);
    if (!existingLicense) {
      return Response.notFound(res, 'License not found');
    }

    // Update license
    const updatedLicense = await LicenseService.update(id, updates);

    logger.info(`License updated by admin: ${req.admin.username}`, { licenseId: id });

    return Response.success(res, { license: updatedLicense });
  })
);

/**
 * POST /api/admin/licenses/:id/credits
 * Update license credits
 */
router.post(
  '/:id/credits',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, operation, reason } = req.body;

    // Validate required fields
    if (typeof amount !== 'number' || !operation || !reason) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Missing required fields: amount, operation, reason', 400);
    }

    // Get license
    const license = await LicenseService.getById(id);
    if (!license) {
      return Response.notFound(res, 'License not found');
    }

    const balanceBefore = license.credits;
    let balanceAfter = balanceBefore;

    // Calculate new balance based on operation
    switch (operation) {
      case CREDIT_OPERATION.TOPUP:
      case CREDIT_OPERATION.REFUND:
        balanceAfter = balanceBefore + amount;
        break;
      case CREDIT_OPERATION.DEDUCT:
        balanceAfter = balanceBefore - amount;
        break;
      case CREDIT_OPERATION.ADJUSTMENT:
        balanceAfter = amount;
        break;
      default:
        return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Invalid operation', 400);
    }

    if (balanceAfter < 0) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Credit balance cannot be negative', 400);
    }

    // Update license credits
    await LicenseService.updateCredits(id, balanceAfter, { mode: 'set' });

    // Create credit history entry
    await CreditService.create({
      licenseId: id,
      operation,
      amount: Math.abs(balanceAfter - balanceBefore),
      balanceBefore,
      balanceAfter,
      reason,
      performedBy: req.admin.username,
    });

    logger.info(`License credits updated by admin: ${req.admin.username}`, { licenseId: id, balanceBefore, balanceAfter });

    return Response.success(res, {
      licenseId: id,
      balanceBefore,
      balanceAfter,
      operation,
    });
  })
);

/**
 * DELETE /api/admin/licenses/:id
 * Delete a license (superadmin only)
 */
router.delete(
  '/:id',
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if license exists
    const license = await LicenseService.getById(id);
    if (!license) {
      return Response.notFound(res, 'License not found');
    }

    // Terminate all active sessions
    const sessions = await SessionService.list({ licenseId: id, activeOnly: true });
    for (const session of sessions) {
      await SessionService.updateActivity(session.id, { status: SESSION_STATUS.TERMINATED });
    }

    // Delete license
    await LicenseService.delete(id);

    logger.info(`License deleted by admin: ${req.admin.username}`, { licenseId: id });

    return Response.success(res, { message: 'License deleted successfully' });
  })
);

module.exports = router;
