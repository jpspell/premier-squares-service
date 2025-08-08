const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Constants
const PORT = process.env.PORT || 3001;
const API_VERSION = '1.0.0';

const app = express();

// Middleware
app.use(helmet());

// CORS configuration - secure for production
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 CORS Request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) {
      console.log('✅ No origin - allowing request');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',        // Development
      'http://localhost:3001',        // Development
      'https://premiersquares.com',   // Production
      'https://www.premiersquares.com', // Production
      'https://z414f9tg84.execute-api.us-east-1.amazonaws.com/prod' // API Gateway with path
    ];
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Origin allowed:', origin);
      callback(null, true);
    } else {
      // Check if origin starts with any of our allowed domains
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        return origin.startsWith(allowedOrigin);
      });
      
      if (isAllowed) {
        console.log('✅ Origin allowed (partial match):', origin);
        callback(null, true);
      } else {
        console.log('❌ Origin blocked:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    version: API_VERSION,
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
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;

