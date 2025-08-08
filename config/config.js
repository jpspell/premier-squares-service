/**
 * Application Configuration
 * Centralized environment variable management with defaults and validation
 */

// Server Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.API_VERSION || '1.0.0';

// CORS Configuration
const getCorsOrigins = () => {
  // If environment variable is set, use it
  if (process.env.CORS_ALLOWED_ORIGINS) {
    return process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Environment-specific defaults
  if (NODE_ENV === 'production') {
    return [
      'https://premiersquares.com',
      'https://www.premiersquares.com'
    ];
  } else if (NODE_ENV === 'development') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://premiersquares.com',  // Allow production domain in dev for testing
      'https://www.premiersquares.com'
    ];
  } else {
    // Test environment - no origins allowed
    return [];
  }
};

const CORS_ALLOWED_ORIGINS = getCorsOrigins();

// Firebase Configuration
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;

// Security Configuration
const getRequestSizeLimits = () => {
  if (NODE_ENV === 'production') {
    return {
      MAX_REQUEST_SIZE: process.env.MAX_REQUEST_SIZE || '1mb',
      MAX_URL_ENCODED_SIZE: process.env.MAX_URL_ENCODED_SIZE || '1mb',
      MAX_QUERY_STRING_SIZE: process.env.MAX_QUERY_STRING_SIZE || '2048',
      MAX_HEADER_SIZE: process.env.MAX_HEADER_SIZE || '8192',
      MAX_FIELD_SIZE: process.env.MAX_FIELD_SIZE || '1024'
    };
  } else {
    return {
      MAX_REQUEST_SIZE: process.env.MAX_REQUEST_SIZE || '10mb',
      MAX_URL_ENCODED_SIZE: process.env.MAX_URL_ENCODED_SIZE || '10mb',
      MAX_QUERY_STRING_SIZE: process.env.MAX_QUERY_STRING_SIZE || '4096',
      MAX_HEADER_SIZE: process.env.MAX_HEADER_SIZE || '16384',
      MAX_FIELD_SIZE: process.env.MAX_FIELD_SIZE || '2048'
    };
  }
};

const {
  MAX_REQUEST_SIZE,
  MAX_URL_ENCODED_SIZE,
  MAX_QUERY_STRING_SIZE,
  MAX_HEADER_SIZE,
  MAX_FIELD_SIZE
} = getRequestSizeLimits();

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const CREATE_CONTEST_LIMIT = parseInt(process.env.CREATE_CONTEST_LIMIT) || 10; // 10 per hour
const UPDATE_CONTEST_LIMIT = parseInt(process.env.UPDATE_CONTEST_LIMIT) || 20; // 20 per 15 minutes
const START_CONTEST_LIMIT = parseInt(process.env.START_CONTEST_LIMIT) || 5; // 5 per hour
const DDOS_LIMIT = parseInt(process.env.DDOS_LIMIT) || 30; // 30 per minute

// Logging Configuration
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_FORMAT = process.env.LOG_FORMAT || (NODE_ENV === 'production' ? 'json' : 'simple');

// Validation
const validateConfig = () => {
  const errors = [];
  
  if (!PORT || isNaN(PORT)) {
    errors.push('PORT must be a valid number');
  }
  
  if (!['development', 'production', 'test'].includes(NODE_ENV)) {
    errors.push('NODE_ENV must be development, production, or test');
  }
  
  // Validate CORS configuration
  if (NODE_ENV === 'production') {
    if (!CORS_ALLOWED_ORIGINS || CORS_ALLOWED_ORIGINS.length === 0) {
      errors.push('CORS_ALLOWED_ORIGINS must be provided in production');
    }
    
    // Validate production origins are HTTPS
    const nonHttpsOrigins = CORS_ALLOWED_ORIGINS.filter(origin => 
      origin && !origin.startsWith('https://')
    );
    if (nonHttpsOrigins.length > 0) {
      errors.push(`Non-HTTPS origins not allowed in production: ${nonHttpsOrigins.join(', ')}`);
    }
    
    // Validate no localhost in production
    const localhostOrigins = CORS_ALLOWED_ORIGINS.filter(origin => 
      origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))
    );
    if (localhostOrigins.length > 0) {
      errors.push(`Localhost origins not allowed in production: ${localhostOrigins.join(', ')}`);
    }
  }
  
  if (RATE_LIMIT_WINDOW_MS <= 0) {
    errors.push('RATE_LIMIT_WINDOW_MS must be a positive number');
  }
  
  if (RATE_LIMIT_MAX_REQUESTS <= 0) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be a positive number');
  }
  
  // Validate request size limits
  const validateSizeLimit = (size, name) => {
    if (typeof size === 'string') {
      const match = size.match(/^(\d+)([kmg]?b)$/i);
      if (!match) {
        errors.push(`${name} must be a valid size (e.g., 1mb, 10kb)`);
        return;
      }
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const multipliers = { 'b': 1, 'kb': 1024, 'mb': 1024*1024, 'gb': 1024*1024*1024 };
      const bytes = value * multipliers[unit];
      
      if (bytes <= 0) {
        errors.push(`${name} must be greater than 0`);
      }
      
      // Production limits
      if (NODE_ENV === 'production') {
        if (name === 'MAX_REQUEST_SIZE' && bytes > 5 * 1024 * 1024) { // 5MB
          errors.push(`${name} cannot exceed 5MB in production`);
        }
        if (name === 'MAX_URL_ENCODED_SIZE' && bytes > 2 * 1024 * 1024) { // 2MB
          errors.push(`${name} cannot exceed 2MB in production`);
        }
      }
    } else if (typeof size === 'number') {
      if (size <= 0) {
        errors.push(`${name} must be greater than 0`);
      }
    } else {
      errors.push(`${name} must be a valid size`);
    }
  };
  
  validateSizeLimit(MAX_REQUEST_SIZE, 'MAX_REQUEST_SIZE');
  validateSizeLimit(MAX_URL_ENCODED_SIZE, 'MAX_URL_ENCODED_SIZE');
  
  // Validate numeric limits
  if (MAX_QUERY_STRING_SIZE <= 0 || MAX_QUERY_STRING_SIZE > 10000) {
    errors.push('MAX_QUERY_STRING_SIZE must be between 1 and 10000');
  }
  
  if (MAX_HEADER_SIZE <= 0 || MAX_HEADER_SIZE > 32768) {
    errors.push('MAX_HEADER_SIZE must be between 1 and 32768');
  }
  
  if (MAX_FIELD_SIZE <= 0 || MAX_FIELD_SIZE > 8192) {
    errors.push('MAX_FIELD_SIZE must be between 1 and 8192');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Export configuration
module.exports = {
  // Server
  PORT,
  NODE_ENV,
  API_VERSION,
  
  // CORS
  CORS_ALLOWED_ORIGINS,
  
  // Firebase
  FIREBASE_DATABASE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL,
  
  // Security
  MAX_REQUEST_SIZE,
  MAX_URL_ENCODED_SIZE,
  MAX_QUERY_STRING_SIZE,
  MAX_HEADER_SIZE,
  MAX_FIELD_SIZE,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  CREATE_CONTEST_LIMIT,
  UPDATE_CONTEST_LIMIT,
  START_CONTEST_LIMIT,
  DDOS_LIMIT,
  
  // Logging
  LOG_LEVEL,
  LOG_FORMAT,
  
  // Validation
  validateConfig,
  
  // Helper functions
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test'
};
