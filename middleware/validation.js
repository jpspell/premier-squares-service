const Joi = require('joi');
const logger = require('../utils/logger');

// Sanitization helper functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, ''); // Remove potential HTML tags
};

const sanitizeArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => sanitizeString(item)).filter(item => item !== '');
};

// Validation schemas
const eventIdSchema = Joi.string()
  .required()
  .min(1)
  .max(100)
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .messages({
    'string.empty': 'eventId cannot be empty',
    'string.pattern.base': 'eventId can only contain letters, numbers, hyphens, and underscores',
    'any.required': 'eventId is required'
  });

const costPerSquareSchema = Joi.number()
  .required()
  .positive()
  .max(10000)
  .precision(2)
  .messages({
    'number.base': 'costPerSquare must be a number',
    'number.positive': 'costPerSquare must be a positive number',
    'number.max': 'costPerSquare cannot exceed $10,000',
    'any.required': 'costPerSquare is required'
  });

const nameSchema = Joi.string()
  .required()
  .min(1)
  .max(100)
  .messages({
    'string.empty': 'Name cannot be empty',
    'string.max': 'Name cannot exceed 100 characters'
  });

const namesArraySchema = Joi.array()
  .items(nameSchema)
  .min(1)
  .max(100)
  .messages({
    'array.min': 'At least one name is required',
    'array.max': 'Cannot exceed 100 names'
  });

const contestIdSchema = Joi.string()
  .required()
  .min(1)
  .max(100) // Firebase IDs can be longer
  .messages({
    'any.required': 'Contest ID is required',
    'string.empty': 'Contest ID cannot be empty'
  });

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const data = req[property];
    
    // Log the validation attempt
    logger.info('Starting validation:', {
      endpoint: req.originalUrl,
      method: req.method,
      property: property,
      data: data
    });
    
    // Sanitize the data first
    const sanitizedData = sanitizeInput(data);
    

    
    const { error, value } = schema.validate(sanitizedData, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      logger.error('Validation failed:', {
        endpoint: req.originalUrl,
        method: req.method,
        errors: errorDetails,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        originalData: data,
        sanitizedData: sanitizedData,
        property: property
      });

      return res.status(400).json({
        error: 'Validation Failed',
        message: 'Invalid input data',
        details: errorDetails
      });
    }

    // Replace the original data with sanitized and validated data
    req[property] = value;
    next();
  };
};

// Sanitization function
const sanitizeInput = (data) => {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return sanitizeArray(data);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Log suspicious patterns
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    logger.warn('Bot/crawler detected:', { ip: clientIP, userAgent });
  }
  
  if (req.body && Object.keys(req.body).length > 10) {
    logger.warn('Large request body detected:', { 
      ip: clientIP, 
      bodySize: JSON.stringify(req.body).length 
    });
  }
  
  next();
};

// Content-Type validation
const validateContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid Content-Type:', { 
        contentType, 
        ip: req.ip, 
        method: req.method 
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content-Type must be application/json'
      });
    }
  }
  next();
};

// Request size validation
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = 1024 * 1024; // 1MB
  
  if (contentLength > maxSize) {
    logger.warn('Request too large:', { 
      contentLength, 
      ip: req.ip, 
      method: req.method 
    });
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body too large'
    });
  }
  next();
};

// Export validation schemas and middleware
module.exports = {
  // Schemas
  eventIdSchema,
  costPerSquareSchema,
  nameSchema,
  namesArraySchema,
  contestIdSchema,
  
  // Validation middleware
  validate,
  validateRateLimit,
  validateContentType,
  validateRequestSize,
  
  // Sanitization
  sanitizeInput,
  sanitizeString,
  sanitizeArray
};
