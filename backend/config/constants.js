module.exports = {
  // License statuses
  LICENSE_STATUS: {
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
  },

  // Transaction statuses
  TRANSACTION_STATUS: {
    SUCCESS: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
  },

  // Credit operation types
  CREDIT_OPERATION: {
    DEDUCT: 'deduct',
    TOPUP: 'topup',
    REFUND: 'refund',
    ADJUSTMENT: 'adjustment',
  },

  // Top-up request statuses
  TOPUP_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  },

  // Session status
  SESSION_STATUS: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    TERMINATED: 'terminated',
  },

  // User roles
  USER_ROLE: {
    ADMIN: 'admin',
    SUPERADMIN: 'superadmin',
  },

  // WebSocket events
  WS_EVENTS: {
    // Server to client
    CONFIG_UPDATE: 'config:update',
    CREDITS_UPDATE: 'credits:update',
    SESSION_TERMINATED: 'session:terminated',
    MAINTENANCE_ENABLED: 'maintenance:enabled',
    NOTIFICATION: 'notification',

    // Client to server
    PROGRESS_UPDATE: 'progress:update',
    TRANSACTION_START: 'transaction:start',
    TRANSACTION_COMPLETE: 'transaction:complete',
    HEARTBEAT: 'heartbeat',
  },

  // Notification types
  NOTIFICATION_TYPE: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success',
  },

  // Error codes
  ERROR_CODE: {
    INVALID_LICENSE: 'INVALID_LICENSE',
    LICENSE_EXPIRED: 'LICENSE_EXPIRED',
    LICENSE_SUSPENDED: 'LICENSE_SUSPENDED',
    TELEGRAM_NOT_LINKED: 'TELEGRAM_NOT_LINKED',
    NO_CREDITS: 'NO_CREDITS',
    SESSION_EXISTS: 'SESSION_EXISTS',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },

  // Linking request expiry (minutes)
  LINKING_REQUEST_EXPIRY_MINUTES: 15,

  // Default config values
  DEFAULT_CONFIG: {
    runtime: {
      apiKey: '',
      baseURL: 'https://www.cebupacificair.com',
      soarURL: 'https://soar.cebupacificair.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      secChUa: '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      acceptLang: 'en-US,en;q=0.9',
    },
    proxy: {
      primary: '',
      pool: [],
      rotationStrategy: 'random',
    },
    processing: {
      retryCount: 10,
      retryDelay: 2000,
      requestTimeout: 30000,
      workerCount: 5,
      exponentialBackoff: true,
      jitterMs: 500,
    },
    modes: {
      automatic: true,
      manual: true,
      maintenance: false,
    },
    payment: {
      qrCodeUrl: '',
      topupInstructions: 'Please send payment via GCash/PayMaya and submit receipt through Telegram bot.',
    },
  },
};
