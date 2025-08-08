const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Graceful shutdown manager
 */
class GracefulShutdown {
  constructor() {
    this.isShuttingDown = false;
    this.activeConnections = new Set();
    this.shutdownTimeout = config.GRACEFUL_SHUTDOWN_TIMEOUT || 30000; // 30 seconds
    this.shutdownStartTime = null;
    
    // Bind methods
    this.handleShutdown = this.handleShutdown.bind(this);
    this.handleConnection = this.handleConnection.bind(this);
    this.handleDisconnection = this.handleDisconnection.bind(this);
  }

  /**
   * Initialize graceful shutdown
   * @param {Object} server - Express server instance
   */
  init(server) {
    this.server = server;
    
    // Track active connections
    server.on('connection', this.handleConnection);
    
    // Handle shutdown signals
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.handleShutdown('SIGUSR2')); // For nodemon
    
    logger.info('Graceful shutdown initialized');
  }

  /**
   * Handle new connection
   * @param {Object} socket - Socket connection
   */
  handleConnection(socket) {
    if (this.isShuttingDown) {
      logger.warn('Rejecting new connection during shutdown');
      socket.destroy();
      return;
    }

    this.activeConnections.add(socket);
    
    socket.on('close', () => {
      this.activeConnections.delete(socket);
    });

    logger.debug('New connection established', {
      totalConnections: this.activeConnections.size
    });
  }

  /**
   * Handle disconnection
   * @param {Object} socket - Socket connection
   */
  handleDisconnection(socket) {
    this.activeConnections.delete(socket);
    logger.debug('Connection closed', {
      totalConnections: this.activeConnections.size
    });
  }

  /**
   * Handle shutdown signal
   * @param {string} signal - Signal that triggered shutdown
   */
  async handleShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal:', signal);
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();

    logger.info('Graceful shutdown initiated', {
      signal,
      activeConnections: this.activeConnections.size,
      uptime: process.uptime()
    });

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();

      // Step 2: Wait for active requests to complete
      await this.waitForActiveRequests();

      // Step 3: Close database connections
      await this.closeDatabaseConnections();

      // Step 4: Close server
      await this.closeServer();

      // Step 5: Exit process
      this.exitProcess(0);

    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      this.exitProcess(1);
    }
  }

  /**
   * Stop accepting new connections
   */
  async stopAcceptingConnections() {
    logger.info('Stopping new connections...');
    
    // Close server to stop accepting new connections
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Server stopped accepting new connections');
        resolve();
      });
    });
  }

  /**
   * Wait for active requests to complete
   */
  async waitForActiveRequests() {
    const maxWaitTime = this.shutdownTimeout;
    const checkInterval = 1000; // Check every second
    let elapsed = 0;

    logger.info('Waiting for active requests to complete...');

    while (this.activeConnections.size > 0 && elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      logger.info('Waiting for requests to complete', {
        activeConnections: this.activeConnections.size,
        elapsed: `${elapsed}ms`,
        remaining: `${maxWaitTime - elapsed}ms`
      });
    }

    if (this.activeConnections.size > 0) {
      logger.warn('Force closing remaining connections', {
        activeConnections: this.activeConnections.size
      });
      
      // Force close remaining connections
      for (const socket of this.activeConnections) {
        socket.destroy();
      }
    }

    logger.info('All requests completed or timed out');
  }

  /**
   * Close database connections
   */
  async closeDatabaseConnections() {
    logger.info('Closing database connections...');
    
    try {
      // Close Firebase connections if available
      if (global.firebaseApp) {
        await global.firebaseApp.delete();
        logger.info('Firebase connections closed');
      }
      
      // Close any other database connections here
      // Example: await mongoose.connection.close();
      
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }
  }

  /**
   * Close server
   */
  async closeServer() {
    logger.info('Closing server...');
    
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Server closed successfully');
        resolve();
      });
    });
  }

  /**
   * Exit process
   * @param {number} code - Exit code
   */
  exitProcess(code) {
    const shutdownDuration = Date.now() - this.shutdownStartTime;
    
    logger.info('Process exiting', {
      exitCode: code,
      shutdownDuration: `${shutdownDuration}ms`,
      totalUptime: `${process.uptime()}s`
    });

    // Give logger time to flush
    setTimeout(() => {
      process.exit(code);
    }, 100);
  }

  /**
   * Get shutdown status
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      activeConnections: this.activeConnections.size,
      shutdownStartTime: this.shutdownStartTime,
      uptime: process.uptime()
    };
  }
}

/**
 * Middleware to track active requests
 */
const trackActiveRequests = (req, res, next) => {
  if (global.gracefulShutdown && global.gracefulShutdown.isShuttingDown) {
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Server is shutting down'
    });
  }

  // Track request start
  req.startTime = Date.now();
  
  // Track request completion
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.debug('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

/**
 * Health check endpoint that includes shutdown status
 */
const healthCheckWithShutdown = (req, res) => {
  const shutdownStatus = global.gracefulShutdown ? global.gracefulShutdown.getStatus() : null;
  
  res.status(200).json({
    status: 'OK',
    message: 'Service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    shutdown: shutdownStatus
  });
};

module.exports = {
  GracefulShutdown,
  trackActiveRequests,
  healthCheckWithShutdown
};
