const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Constants
const PORT = process.env.PORT || 3001;
const API_VERSION = '1.0.0';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
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

