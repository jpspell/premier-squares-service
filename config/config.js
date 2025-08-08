/**
 * Application Configuration
 * Centralized environment variable management with defaults and validation
 */

// Server Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.API_VERSION || '1.0.0';

// CORS Configuration
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',        // Development
      'http://localhost:3001',        // Development
      'https://premiersquares.com',   // Production
      'https://www.premiersquares.com', // Production
      'https://z414f9tg84.execute-api.us-east-1.amazonaws.com/prod' // API Gateway with path
    ];

// Firebase Configuration
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;

// Security Configuration
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';
const MAX_URL_ENCODED_SIZE = process.env.MAX_URL_ENCODED_SIZE || '10mb';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

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
  
  if (!CORS_ALLOWED_ORIGINS || CORS_ALLOWED_ORIGINS.length === 0) {
    errors.push('CORS_ALLOWED_ORIGINS must be provided');
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
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  
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
