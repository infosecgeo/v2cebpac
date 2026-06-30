const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const Response = require('../../utils/response');
const LicenseService = require('../../storage/services/LicenseService');
const SessionService = require('../../storage/services/SessionService');
const TransactionService = require('../../storage/services/TransactionService');
const CreditService = require('../../storage/services/CreditService');
const UserService = require('../../storage/services/UserService');
const { LICENSE_STATUS, SESSION_STATUS, TRANSACTION_STATUS } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    // Get all data for statistics
    const allLicenses = await LicenseService.list();
    const allSessions = await SessionService.list();
    const allUsers = await UserService.list();
    
    // Get transaction stats
    const transactionStats = await TransactionService.getStats();

    // Calculate license statistics
    const licenseStats = {
      total: allLicenses.length,
      active: allLicenses.filter((l) => l.status === LICENSE_STATUS.ACTIVE).length,
      expired: allLicenses.filter((l) => l.status === LICENSE_STATUS.EXPIRED).length,
      suspended: allLicenses.filter((l) => l.status === LICENSE_STATUS.SUSPENDED).length,
      revoked: allLicenses.filter((l) => l.status === LICENSE_STATUS.REVOKED).length,
    };

    // Calculate session statistics
    const activeSessions = allSessions.filter((s) => 
      s.status === SESSION_STATUS.ACTIVE && new Date(s.expiresAt) > new Date()
    );
    
    const sessionStats = {
      total: allSessions.length,
      active: activeSessions.length,
      expired: allSessions.filter((s) => s.status === SESSION_STATUS.EXPIRED).length,
      terminated: allSessions.filter((s) => s.status === SESSION_STATUS.TERMINATED).length,
    };

    // Calculate credit statistics
    const totalCredits = allLicenses.reduce((sum, l) => sum + l.credits, 0);
    const avgCredits = allLicenses.length > 0 ? totalCredits / allLicenses.length : 0;

    // User statistics
    const userStats = {
      total: allUsers.length,
      active: allUsers.filter((u) => u.isActive).length,
      inactive: allUsers.filter((u) => !u.isActive).length,
      admins: allUsers.filter((u) => u.role === 'admin').length,
      superadmins: allUsers.filter((u) => u.role === 'superadmin').length,
    };

    // Recent activity
    const recentLicenses = await LicenseService.list({
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 5,
    });

    const recentTransactions = await TransactionService.list({
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 10,
    });

    logger.info(`Dashboard stats retrieved by admin: ${req.admin.username}`);

    return Response.success(res, {
      licenses: licenseStats,
      sessions: sessionStats,
      transactions: transactionStats,
      users: userStats,
      credits: {
        total: totalCredits,
        average: avgCredits,
      },
      recent: {
        licenses: recentLicenses.map((l) => ({
          id: l.id,
          key: l.key,
          userId: l.userId,
          status: l.status,
          credits: l.credits,
          createdAt: l.createdAt,
        })),
        transactions: recentTransactions.map((t) => ({
          id: t.id,
          type: t.type,
          cardNumber: t.cardNumber,
          amount: t.amount,
          message: t.message,
          createdAt: t.createdAt,
        })),
      },
    });
  })
);

/**
 * GET /api/admin/dashboard/overview
 * Get quick overview statistics
 */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const allLicenses = await LicenseService.list();
    const activeSessions = await SessionService.list({ activeOnly: true });
    const transactionStats = await TransactionService.getStats();

    return Response.success(res, {
      activeLicenses: allLicenses.filter((l) => l.status === LICENSE_STATUS.ACTIVE).length,
      activeSessions: activeSessions.length,
      totalTransactions: transactionStats.total,
      successfulTransactions: transactionStats.success,
      totalCredits: allLicenses.reduce((sum, l) => sum + l.credits, 0),
    });
  })
);

module.exports = router;
