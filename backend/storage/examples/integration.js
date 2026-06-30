/**
 * Storage Integration Example
 * Shows how to integrate storage services with Express server
 */

const {
  ConfigService,
  LicenseService,
  UserService,
  SessionService,
  TransactionService,
  CreditService,
  BackupService,
  DatabaseInitializer,
} = require('../');

const logger = require('../../utils/logger');

/**
 * Initialize storage layer on server startup
 */
async function initializeStorage() {
  try {
    logger.info('Initializing storage layer...');

    // Initialize all databases
    const initializer = new DatabaseInitializer();
    const results = await initializer.initializeAll(false); // Don't force if exists

    logger.info(`Database initialization: ${results.created.length} created, ${results.skipped.length} skipped`);

    // Check integrity
    const integrity = await initializer.checkIntegrity();
    if (integrity.invalid.length > 0 || integrity.missing.length > 0) {
      logger.error('Database integrity issues found:', integrity);
      throw new Error('Database integrity check failed');
    }

    logger.info('All databases validated successfully');

    // Start backup service
    const backupService = new BackupService({
      interval: 3600000, // 1 hour
      maxBackups: 24, // Keep 24 backups
      enabled: process.env.BACKUP_ENABLED !== 'false',
    });
    backupService.start();

    logger.info('Storage layer initialized successfully');
    return { initializer, backupService };
  } catch (error) {
    logger.error('Failed to initialize storage layer:', error);
    throw error;
  }
}

/**
 * Cleanup storage on server shutdown
 */
async function cleanupStorage(backupService) {
  try {
    logger.info('Cleaning up storage layer...');

    // Stop backup service
    if (backupService) {
      backupService.stop();
    }

    // Cleanup expired sessions
    const cleaned = await SessionService.cleanup();
    logger.info(`Cleaned up ${cleaned} expired sessions`);

    logger.info('Storage layer cleanup complete');
  } catch (error) {
    logger.error('Failed to cleanup storage:', error);
  }
}

module.exports = {
  initializeStorage,
  cleanupStorage,
};
