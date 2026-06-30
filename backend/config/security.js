module.exports = {
  // Helmet configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // Password requirements
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },

  // License key format
  license: {
    format: /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    length: 19,
  },

  // Session
  session: {
    tokenLength: 32,
    maxActiveSessions: 1,
    timeoutHours: 24,
  },

  // Rate limiting
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts
      message: 'Too many authentication attempts, please try again later.',
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests
      message: 'Too many requests, please try again later.',
    },
    admin: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200, // 200 requests
      message: 'Too many admin requests, please try again later.',
    },
  },

  // JWT
  jwt: {
    algorithm: 'HS256',
    issuer: 'cebupac-backend',
    audience: 'cebupac-client',
  },

  // Encryption
  bcrypt: {
    saltRounds: 12,
  },
};
