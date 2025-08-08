const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const logger = require('./utils/logger');

// Validate configuration on startup
try {
  config.validateConfig();
} catch (error) {
  logger.error('Configuration error:', error.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(helmet());

// CORS configuration - secure for production
const corsOptions = {
  origin: function (origin, callback) {
    if (config.isDevelopment) {
      logger.debug('CORS Request from origin:', origin);
    }
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) {
      if (config.isDevelopment) {
        logger.debug('No origin - allowing request');
      }
      return callback(null, true);
    }
    
    // Check exact match first
    if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
      if (config.isDevelopment) {
        logger.debug('Origin allowed:', origin);
      }
      callback(null, true);
    } else {
      // Check if origin starts with any of our allowed domains
      const isAllowed = config.CORS_ALLOWED_ORIGINS.some(allowedOrigin => {
        return origin.startsWith(allowedOrigin);
      });
      
      if (isAllowed) {
        if (config.isDevelopment) {
          logger.debug('Origin allowed (partial match):', origin);
        }
        callback(null, true);
      } else {
        if (config.isDevelopment) {
          logger.warn('Origin blocked:', origin);
          logger.debug('Allowed origins:', config.CORS_ALLOWED_ORIGINS);
        }
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

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
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.originalUrl} does not exist`
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server'
  });
});

// Start server
app.listen(config.PORT, () => {
  logger.info(`Server running on http://localhost:${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`API Version: ${config.API_VERSION}`);
});

module.exports = app;

