const Joi = require('joi');
const { ValidationError } = require('../utils/errors');
const Response = require('../utils/response');

/**
 * Middleware factory for validating request data using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Request property to validate ('body', 'query', 'params')
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return Response.validationError(res, errors);
    }
    
    // Replace request data with validated value
    req[property] = value;
    next();
  };
}

/**
 * Common validation schemas
 */
const schemas = {
  // License key validation
  licenseKey: Joi.object({
    licenseKey: Joi.string()
      .pattern(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid license key format (XXXX-XXXX-XXXX-XXXX)',
        'any.required': 'License key is required',
      }),
    deviceId: Joi.string().optional(),
  }),
  
  // UUID validation
  uuid: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'Invalid ID format',
        'any.required': 'ID is required',
      }),
  }),
  
  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),
  
  // Admin login validation
  adminLogin: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).required(),
    twoFactorCode: Joi.string().length(6).pattern(/^\d+$/).optional(),
  }),
  
  // Transaction complete validation
  transactionComplete: Joi.object({
    transactionId: Joi.string().uuid().required(),
    status: Joi.string().valid('success', 'failed', 'pending').required(),
    recordLocator: Joi.string().optional(),
    email: Joi.string().email().optional(),
    amount: Joi.number().positive().optional(),
    passengers: Joi.array().items(Joi.string()).optional(),
    itinerary: Joi.string().optional(),
    metadata: Joi.object().optional(),
  }),
  
  // Credit top-up request validation
  topupRequest: Joi.object({
    amount: Joi.number().integer().min(1).required(),
    receiptFileId: Joi.string().required(),
  }),
  
  // License generation validation
  licenseGenerate: Joi.object({
    count: Joi.number().integer().min(1).max(100).default(1),
    credits: Joi.number().integer().min(0).default(0),
    expiresInDays: Joi.number().integer().min(1).max(3650).default(365),
    metadata: Joi.object().optional(),
  }),
  
  // License update validation
  licenseUpdate: Joi.object({
    status: Joi.string().valid('active', 'suspended', 'expired', 'revoked').optional(),
    credits: Joi.number().integer().min(0).optional(),
    expiresAt: Joi.date().iso().optional(),
    telegramId: Joi.string().optional(),
    telegramUsername: Joi.string().optional(),
  }),
  
  // Config update validation
  configUpdate: Joi.object({
    runtime: Joi.object({
      apiKey: Joi.string().optional(),
      baseURL: Joi.string().uri().optional(),
      soarURL: Joi.string().uri().optional(),
      userAgent: Joi.string().optional(),
      secChUa: Joi.string().optional(),
      acceptLang: Joi.string().optional(),
    }).optional(),
    proxy: Joi.object({
      primary: Joi.string().optional(),
      pool: Joi.array().items(Joi.string()).optional(),
      rotationStrategy: Joi.string().valid('random', 'sequential', 'failover').optional(),
    }).optional(),
    processing: Joi.object({
      retryCount: Joi.number().integer().min(1).max(20).optional(),
      retryDelay: Joi.number().integer().min(100).optional(),
      requestTimeout: Joi.number().integer().min(1000).optional(),
      workerCount: Joi.number().integer().min(1).max(20).optional(),
      exponentialBackoff: Joi.boolean().optional(),
      jitterMs: Joi.number().integer().min(0).optional(),
    }).optional(),
    modes: Joi.object({
      automatic: Joi.boolean().optional(),
      manual: Joi.boolean().optional(),
      maintenance: Joi.boolean().optional(),
    }).optional(),
    payment: Joi.object({
      qrCodeUrl: Joi.string().uri().optional().allow(''),
      topupInstructions: Joi.string().optional(),
    }).optional(),
  }),
};

module.exports = {
  validate,
  schemas,
};
