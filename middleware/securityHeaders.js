const helmet = require('helmet');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Create Content Security Policy directives
 * @returns {Object} CSP directives
 */
const createCSPDirectives = () => {
  const baseDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "https:"],
    connectSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: config.isProduction ? [] : null
  };

  // Remove null values
  Object.keys(baseDirectives).forEach(key => {
    if (baseDirectives[key] === null) {
      delete baseDirectives[key];
    }
  });

  return baseDirectives;
};

/**
 * Create Helmet configuration based on environment
 * @returns {Object} Helmet configuration
 */
const createHelmetConfig = () => {
  const helmetConfig = {
    // Content Security Policy
    contentSecurityPolicy: config.SECURITY_CONFIG.CSP_ENABLED ? {
      directives: createCSPDirectives(),
      reportOnly: false
    } : false,

    // HTTP Strict Transport Security
    hsts: config.SECURITY_CONFIG.HSTS_ENABLED ? {
      maxAge: config.SECURITY_CONFIG.HSTS_MAX_AGE,
      includeSubDomains: config.SECURITY_CONFIG.HSTS_INCLUDE_SUBDOMAINS,
      preload: config.SECURITY_CONFIG.HSTS_PRELOAD
    } : false,

    // Content Type Options
    noSniff: config.SECURITY_CONFIG.CONTENT_TYPE_NOSNIFF,

    // Frame Options
    frameguard: config.SECURITY_CONFIG.FRAME_DENY ? {
      action: 'deny'
    } : false,

    // XSS Protection
    xssFilter: config.SECURITY_CONFIG.XSS_PROTECTION,

    // Referrer Policy
    referrerPolicy: {
      policy: config.SECURITY_CONFIG.REFERRER_POLICY
    },

    // Permissions Policy (formerly Feature Policy)
    permittedCrossDomainPolicies: false,

    // Hide Powered By
    hidePoweredBy: true,

    // IE No Open
    ieNoOpen: true,

    // Don't allow MIME type sniffing
    noSniff: true,

    // Prevent clickjacking
    frameguard: {
      action: 'deny'
    }
  };

  // Remove false values
  Object.keys(helmetConfig).forEach(key => {
    if (helmetConfig[key] === false) {
      delete helmetConfig[key];
    }
  });

  return helmetConfig;
};

/**
 * Additional security headers middleware
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Cross-Origin Embedder Policy
  if (config.SECURITY_CONFIG.CROSS_ORIGIN_EMBEDDER_POLICY) {
    res.setHeader('Cross-Origin-Embedder-Policy', config.SECURITY_CONFIG.CROSS_ORIGIN_EMBEDDER_POLICY);
  }

  // Cross-Origin Opener Policy
  if (config.SECURITY_CONFIG.CROSS_ORIGIN_OPENER_POLICY) {
    res.setHeader('Cross-Origin-Opener-Policy', config.SECURITY_CONFIG.CROSS_ORIGIN_OPENER_POLICY);
  }

  // Cross-Origin Resource Policy
  if (config.SECURITY_CONFIG.CROSS_ORIGIN_RESOURCE_POLICY) {
    res.setHeader('Cross-Origin-Resource-Policy', config.SECURITY_CONFIG.CROSS_ORIGIN_RESOURCE_POLICY);
  }

  // Permissions Policy
  if (config.SECURITY_CONFIG.PERMISSIONS_POLICY) {
    res.setHeader('Permissions-Policy', config.SECURITY_CONFIG.PERMISSIONS_POLICY);
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Security headers validation middleware
 */
const validateSecurityHeaders = (req, res, next) => {
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection'
  ];

  const missingHeaders = requiredHeaders.filter(header => 
    !res.getHeader(header)
  );

  if (missingHeaders.length > 0) {
    logger.warn('Missing security headers:', {
      missingHeaders,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
    });
  }

  next();
};

/**
 * Security headers monitoring middleware
 */
const monitorSecurityHeaders = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security headers for monitoring
    if (config.isDevelopment) {
      const securityHeaders = {
        'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
        'X-Frame-Options': res.getHeader('X-Frame-Options'),
        'X-XSS-Protection': res.getHeader('X-XSS-Protection'),
        'Strict-Transport-Security': res.getHeader('Strict-Transport-Security'),
        'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
        'Referrer-Policy': res.getHeader('Referrer-Policy'),
        'Permissions-Policy': res.getHeader('Permissions-Policy'),
        'Cross-Origin-Embedder-Policy': res.getHeader('Cross-Origin-Embedder-Policy'),
        'Cross-Origin-Opener-Policy': res.getHeader('Cross-Origin-Opener-Policy'),
        'Cross-Origin-Resource-Policy': res.getHeader('Cross-Origin-Resource-Policy')
      };

      logger.debug('Security headers for request:', {
        headers: securityHeaders,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Create Helmet middleware with configuration
 */
const helmetMiddleware = helmet(createHelmetConfig());

module.exports = {
  helmetMiddleware,
  additionalSecurityHeaders,
  validateSecurityHeaders,
  monitorSecurityHeaders,
  createHelmetConfig,
  createCSPDirectives
};
