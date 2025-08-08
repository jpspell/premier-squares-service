const logger = require('./logger');
const config = require('../config/config');

/**
 * Error types for categorization
 */
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  DATABASE: 'DATABASE_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  CONFIGURATION: 'CONFIGURATION_ERROR',
  INTERNAL: 'INTERNAL_ERROR'
};

/**
 * HTTP status codes mapping
 */
const StatusCodes = {
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.AUTHENTICATION]: 401,
  [ErrorTypes.AUTHORIZATION]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.DATABASE]: 503,
  [ErrorTypes.EXTERNAL_SERVICE]: 502,
  [ErrorTypes.NETWORK]: 503,
  [ErrorTypes.CONFIGURATION]: 500,
  [ErrorTypes.INTERNAL]: 500
};

/**
 * Sanitize error message for production
 * @param {string} message - Original error message
 * @param {boolean} isDevelopment - Whether in development mode
 * @returns {string} Sanitized error message
 */
const sanitizeErrorMessage = (message, isDevelopment = false) => {
  if (isDevelopment) {
    return message;
  }
  
  // Remove sensitive information from error messages
  const sensitivePatterns = [
    /password/gi,
    /token/gi,
    /key/gi,
    /secret/gi,
    /credential/gi,
    /private/gi,
    /\.env/gi,
    /\/home\/.*\/\.ssh/gi,
    /\/Users\/.*\/\.ssh/gi,
    /C:\\Users\\.*\\AppData/gi
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
};

/**
 * Create structured error log data
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {string} errorType - Type of error
 * @param {Object} additionalContext - Additional context data
 * @returns {Object} Structured error data
 */
const createErrorLogData = (error, req, errorType, additionalContext = {}) => {
  const baseData = {
    errorType,
    message: error.message,
    stack: error.stack,
    endpoint: req?.originalUrl,
    method: req?.method,
    ip: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestId: req?.headers['x-request-id'] || 'unknown'
  };

  return {
    ...baseData,
    ...additionalContext
  };
};

/**
 * Create user-friendly error response
 * @param {Error} error - The error object
 * @param {string} errorType - Type of error
 * @param {Object} req - Express request object
 * @param {Object} additionalData - Additional response data
 * @returns {Object} Error response object
 */
const createErrorResponse = (error, errorType, req, additionalData = {}) => {
  const statusCode = StatusCodes[errorType] || 500;
  const isDevelopment = config.isDevelopment;
  
  const baseResponse = {
    error: errorType,
    message: sanitizeErrorMessage(error.message, isDevelopment),
    timestamp: new Date().toISOString(),
    path: req?.originalUrl,
    method: req?.method
  };

  // Add development details
  if (isDevelopment) {
    baseResponse.stack = error.stack;
    baseResponse.details = additionalData;
  }

  // Add additional data if provided
  if (Object.keys(additionalData).length > 0) {
    baseResponse.details = {
      ...baseResponse.details,
      ...additionalData
    };
  }

  return {
    statusCode,
    response: baseResponse
  };
};

/**
 * Handle and log errors with proper categorization
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {string} errorType - Type of error
 * @param {Object} additionalContext - Additional context for logging
 * @param {Object} additionalData - Additional data for response
 */
const handleError = (error, req, errorType = ErrorTypes.INTERNAL, additionalContext = {}, additionalData = {}) => {
  // Create structured log data
  const logData = createErrorLogData(error, req, errorType, additionalContext);
  
  // Log based on error type
  switch (errorType) {
    case ErrorTypes.VALIDATION:
      logger.warn('Validation error:', logData);
      break;
    case ErrorTypes.RATE_LIMIT:
      logger.warn('Rate limit error:', logData);
      break;
    case ErrorTypes.NOT_FOUND:
      logger.info('Not found error:', logData);
      break;
    case ErrorTypes.DATABASE:
    case ErrorTypes.EXTERNAL_SERVICE:
    case ErrorTypes.NETWORK:
      logger.error('Service error:', logData);
      break;
    case ErrorTypes.CONFIGURATION:
      logger.error('Configuration error:', logData);
      break;
    default:
      logger.error('Internal error:', logData);
  }
  
  // Create user-friendly response
  return createErrorResponse(error, errorType, req, additionalData);
};

/**
 * Express error handling middleware
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const expressErrorHandler = (error, req, res, next) => {
  // Determine error type based on error properties
  let errorType = ErrorTypes.INTERNAL;
  
  if (error.name === 'ValidationError') {
    errorType = ErrorTypes.VALIDATION;
  } else if (error.name === 'UnauthorizedError') {
    errorType = ErrorTypes.AUTHENTICATION;
  } else if (error.name === 'ForbiddenError') {
    errorType = ErrorTypes.AUTHORIZATION;
  } else if (error.name === 'NotFoundError') {
    errorType = ErrorTypes.NOT_FOUND;
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    errorType = ErrorTypes.NETWORK;
  } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    errorType = ErrorTypes.EXTERNAL_SERVICE;
  }
  
  // Handle the error
  const { statusCode, response } = handleError(error, req, errorType);
  
  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create specific error handlers for different scenarios
 */
const createSpecificErrorHandler = (errorType, additionalContext = {}) => {
  return (error, req, res, next) => {
    const { statusCode, response } = handleError(error, req, errorType, additionalContext);
    res.status(statusCode).json(response);
  };
};

/**
 * Database error handler
 */
const handleDatabaseError = (error, req, additionalContext = {}) => {
  const logData = createErrorLogData(error, req, ErrorTypes.DATABASE, {
    ...additionalContext,
    databaseOperation: additionalContext.operation || 'unknown',
    collection: additionalContext.collection || 'unknown'
  });
  
  logger.error('Database error:', logData);
  
  return createErrorResponse(error, ErrorTypes.DATABASE, req, {
    operation: additionalContext.operation,
    collection: additionalContext.collection
  });
};

/**
 * Validation error handler
 */
const handleValidationError = (error, req, validationDetails = {}) => {
  const logData = createErrorLogData(error, req, ErrorTypes.VALIDATION, {
    validationDetails,
    field: validationDetails.field,
    value: validationDetails.value
  });
  
  logger.warn('Validation error:', logData);
  
  return createErrorResponse(error, ErrorTypes.VALIDATION, req, {
    field: validationDetails.field,
    value: validationDetails.value,
    validationType: validationDetails.type
  });
};

/**
 * Firebase-specific error handler
 */
const handleFirebaseError = (error, req, operation = 'unknown') => {
  const errorType = error.code === 'not-found' ? ErrorTypes.NOT_FOUND : ErrorTypes.DATABASE;
  
  const logData = createErrorLogData(error, req, errorType, {
    firebaseOperation: operation,
    firebaseCode: error.code,
    firebaseMessage: error.message
  });
  
  logger.error('Firebase error:', logData);
  
  return createErrorResponse(error, errorType, req, {
    operation,
    firebaseCode: error.code
  });
};

module.exports = {
  ErrorTypes,
  StatusCodes,
  handleError,
  expressErrorHandler,
  asyncErrorHandler,
  createSpecificErrorHandler,
  handleDatabaseError,
  handleValidationError,
  handleFirebaseError,
  sanitizeErrorMessage,
  createErrorLogData,
  createErrorResponse
};
