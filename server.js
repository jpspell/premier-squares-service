const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const logger = require('./utils/logger');
const { validateContentType, validateRequestSize } = require('./middleware/validation');
const { securityMiddleware, sanitizeInput } = require('./middleware/security');
const { 
  generalLimiter, 
  ddosLimiter, 
  blockSuspiciousIPs, 
  detectBots 
} = require('./middleware/rateLimit');
const { expressErrorHandler } = require('./utils/errorHandler');
const { corsMiddleware, additionalCorsHeaders } = require('./middleware/cors');
const { validateRequestSizes, monitorMemoryUsage } = require('./middleware/requestSize');

// Validate configuration on startup
try {
  config.validateConfig();
  logger.info('CORS Configuration:', {
    environment: config.NODE_ENV,
    allowedOrigins: config.CORS_ALLOWED_ORIGINS,
    isProduction: config.isProduction
  });
} catch (error) {
  logger.error('Configuration error:', error.message);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Apply CORS middleware
app.use(corsMiddleware);
app.use(additionalCorsHeaders);

// Rate limiting and security middleware
app.use(detectBots);
app.use(blockSuspiciousIPs);
app.use(ddosLimiter);
app.use(generalLimiter);

// Security and validation middleware
app.use(securityMiddleware);
app.use(sanitizeInput);
app.use(validateContentType);
app.use(validateRequestSizes);
app.use(monitorMemoryUsage);

app.use(express.json({ limit: config.MAX_REQUEST_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_URL_ENCODED_SIZE }));

// Routes
const contestsRouter = require('./routes/contests');
app.use('/contests', contestsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Premier Squares Service API',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    corsOrigins: config.CORS_ALLOWED_ORIGINS,
    requestSizeLimits: {
      maxRequestBody: config.MAX_REQUEST_SIZE,
      maxUrlEncoded: config.MAX_URL_ENCODED_SIZE,
      maxQueryString: config.MAX_QUERY_STRING_SIZE + ' bytes',
      maxHeaderSize: config.MAX_HEADER_SIZE + ' bytes',
      maxFieldSize: config.MAX_FIELD_SIZE + ' bytes'
    },
    endpoints: {
      health: '/health',
      contests: {
        create: 'POST /contests',
        getAll: 'GET /contests',
        getById: 'GET /contests/:id',
        update: 'PUT /contests/:id',
        start: 'POST /contests/:id/start'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  const error = new Error(`Endpoint not found: ${req.originalUrl}`);
  error.name = 'NotFoundError';
  res.status(404).json({
    error: 'NOT_FOUND_ERROR',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(expressErrorHandler);

// Start server
app.listen(config.PORT, () => {
  logger.info(`Server running on http://localhost:${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`API Version: ${config.API_VERSION}`);
});

module.exports = app;

