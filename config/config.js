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
      'http://127.0.0.1:3001'
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
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';
const MAX_URL_ENCODED_SIZE = process.env.MAX_URL_ENCODED_SIZE || '10mb';

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
