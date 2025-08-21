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
const { 
  helmetMiddleware, 
  additionalSecurityHeaders, 
  validateSecurityHeaders, 
  monitorSecurityHeaders 
} = require('./middleware/securityHeaders');
const { 
  GracefulShutdown, 
  trackActiveRequests, 
  healthCheckWithShutdown 
} = require('./middleware/gracefulShutdown');

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

// Security headers middleware
app.use(helmetMiddleware);
app.use(additionalSecurityHeaders);
app.use(validateSecurityHeaders);
app.use(monitorSecurityHeaders);

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

// Graceful shutdown middleware
app.use(trackActiveRequests);

app.use(express.json({ limit: config.MAX_REQUEST_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_URL_ENCODED_SIZE }));

// Routes
const contestsRouter = require('./routes/contests');
const bagBuilderRouter = require('./routes/bagBuilder');

app.use('/contests', contestsRouter);
app.use('/bagbuilder', bagBuilderRouter);

// Health check endpoint with shutdown status
app.get('/health', healthCheckWithShutdown);

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
    securityHeaders: {
      cspEnabled: config.SECURITY_CONFIG.CSP_ENABLED,
      hstsEnabled: config.SECURITY_CONFIG.HSTS_ENABLED,
      referrerPolicy: config.SECURITY_CONFIG.REFERRER_POLICY,
      permissionsPolicy: config.SECURITY_CONFIG.PERMISSIONS_POLICY,
      crossOriginEmbedderPolicy: config.SECURITY_CONFIG.CROSS_ORIGIN_EMBEDDER_POLICY,
      crossOriginOpenerPolicy: config.SECURITY_CONFIG.CROSS_ORIGIN_OPENER_POLICY,
      crossOriginResourcePolicy: config.SECURITY_CONFIG.CROSS_ORIGIN_RESOURCE_POLICY
    },
    endpoints: {
      health: '/health',
      contests: {
        create: 'POST /contests',
        getAll: 'GET /contests',
        getById: 'GET /contests/:id',
        update: 'PUT /contests/:id',
        start: 'POST /contests/:id/start'
      },
      bagBuilder: {
        setWinner: 'POST /bagbuilder/winner/:name',
        getWinner: 'GET /bagbuilder/winner'
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

// Start server with graceful shutdown
const server = app.listen(config.PORT, () => {
  logger.info(`Server running on http://localhost:${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`API Version: ${config.API_VERSION}`);
});

// Initialize graceful shutdown
const gracefulShutdown = new GracefulShutdown();
gracefulShutdown.init(server);

// Store globally for health checks
global.gracefulShutdown = gracefulShutdown;

module.exports = app;

