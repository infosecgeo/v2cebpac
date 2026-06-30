const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Admin
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  ADMIN_2FA_ENABLED: process.env.ADMIN_2FA_ENABLED === 'true',

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_ADMIN_CHANNEL_ID: process.env.TELEGRAM_ADMIN_CHANNEL_ID || '',
  TELEGRAM_NOTIFICATION_CHANNEL_ID: process.env.TELEGRAM_NOTIFICATION_CHANNEL_ID || '',
  TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || '',

  // HTTPS
  HTTPS_ENABLED: process.env.HTTPS_ENABLED === 'true',
  HTTPS_CERT_PATH: process.env.HTTPS_CERT_PATH || '',
  HTTPS_KEY_PATH: process.env.HTTPS_KEY_PATH || '',

  // Rate Limiting
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,

  // Session
  SESSION_TIMEOUT_HOURS: parseInt(process.env.SESSION_TIMEOUT_HOURS, 10) || 24,
  SESSION_HEARTBEAT_INTERVAL_MS: parseInt(process.env.SESSION_HEARTBEAT_INTERVAL_MS, 10) || 30000,

  // Backup
  BACKUP_ENABLED: process.env.BACKUP_ENABLED !== 'false',
  BACKUP_INTERVAL_HOURS: parseInt(process.env.BACKUP_INTERVAL_HOURS, 10) || 6,
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_ENABLED: process.env.LOG_FILE_ENABLED !== 'false',
  LOG_CONSOLE_ENABLED: process.env.LOG_CONSOLE_ENABLED !== 'false',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS !== 'false',

  // Paths
  DB_PATH: path.resolve(__dirname, '..', process.env.DB_PATH || './storage/db'),
  BACKUP_PATH: path.resolve(__dirname, '..', process.env.BACKUP_PATH || './storage/backups'),
  LOG_PATH: path.resolve(__dirname, '..', './logs'),
};
