const cors = require('cors');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Validate origin format and security
 * @param {string} origin - The origin to validate
 * @returns {Object} Validation result
 */
const validateOrigin = (origin) => {
  try {
    const url = new URL(origin);
    
    // Check protocol
    if (config.isProduction && url.protocol !== 'https:') {
      return {
        valid: false,
        reason: 'Non-HTTPS origin not allowed in production',
        code: 'NON_HTTPS_ORIGIN'
      };
    }
    
    // Check for localhost in production
    if (config.isProduction && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      return {
        valid: false,
        reason: 'Localhost origins not allowed in production',
        code: 'LOCALHOST_IN_PRODUCTION'
      };
    }
    
    // Check for invalid characters
    if (!/^[a-zA-Z0-9.-]+$/.test(url.hostname)) {
      return {
        valid: false,
        reason: 'Invalid hostname characters',
        code: 'INVALID_HOSTNAME'
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: 'Invalid origin format',
      code: 'INVALID_FORMAT'
    };
  }
};

/**
 * Create CORS options based on environment
 * @returns {Object} CORS configuration
 */
const createCorsOptions = () => {
  return {
    origin: function (origin, callback) {
      // Handle requests with no origin
      if (!origin) {
        if (config.isProduction) {
          logger.warn('CORS blocked: Request with no origin', {
            ip: this.req?.ip,
            userAgent: this.req?.get('User-Agent'),
            endpoint: this.req?.originalUrl
          });
          return callback(new Error('Origin required in production'));
        } else {
          logger.debug('CORS allowed: No origin (development mode)');
          return callback(null, true);
        }
      }
      
      // Validate origin format and security
      const validation = validateOrigin(origin);
      if (!validation.valid) {
        logger.warn('CORS blocked: Invalid origin', {
          origin,
          reason: validation.reason,
          code: validation.code,
          ip: this.req?.ip,
          userAgent: this.req?.get('User-Agent'),
          endpoint: this.req?.originalUrl
        });
        return callback(new Error(validation.reason));
      }
      
      // Check if origin is in allowed list
      if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
        if (config.isDevelopment) {
          logger.debug('CORS allowed:', origin);
        }
        callback(null, true);
      } else {
        logger.warn('CORS blocked: Origin not in allowed list', {
          origin,
          allowedOrigins: config.CORS_ALLOWED_ORIGINS,
          ip: this.req?.ip,
          userAgent: this.req?.get('User-Agent'),
          endpoint: this.req?.originalUrl
        });
        callback(new Error('Origin not allowed'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400, // Cache preflight for 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
};

/**
 * CORS middleware with strict validation
 */
const corsMiddleware = cors(createCorsOptions());

/**
 * Additional CORS headers middleware
 */
const additionalCorsHeaders = (req, res, next) => {
  // Add security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Add CORS headers for preflight
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '86400');
  }
  
  next();
};

module.exports = {
  corsMiddleware,
  additionalCorsHeaders,
  validateOrigin,
  createCorsOptions
};
