/**
 * Storage Services
 * Central export for all database services
 */

const ConfigService = require('./services/ConfigService');
const LicenseService = require('./services/LicenseService');
const UserService = require('./services/UserService');
const SessionService = require('./services/SessionService');
const TransactionService = require('./services/TransactionService');
const CreditService = require('./services/CreditService');
const TelegramService = require('./services/TelegramService');
const ProxyService = require('./services/ProxyService');

const DatabaseManager = require('./DatabaseManager');
const BackupService = require('./BackupService');
const DatabaseInitializer = require('./DatabaseInitializer');

module.exports = {
  // Services
  ConfigService,
  LicenseService,
  UserService,
  SessionService,
  TransactionService,
  CreditService,
  TelegramService,
  ProxyService,

  // Core components
  DatabaseManager,
  BackupService,
  DatabaseInitializer,
};
