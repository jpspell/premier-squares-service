const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const config = require('../config/config');

// Store for tracking blocked IPs
const blockedIPs = new Set();

// General rate limiter - applies to all routes
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logger.warn('Rate limit exceeded:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict rate limiter for contest creation
const createContestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.CREATE_CONTEST_LIMIT,
  message: {
    error: 'Too Many Contest Creations',
    message: 'Too many contest creation attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logger.warn('Contest creation rate limit exceeded:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too Many Contest Creations',
      message: 'Too many contest creation attempts, please try again later.',
      retryAfter: '1 hour'
    });
  }
});

// Strict rate limiter for contest updates
const updateContestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.UPDATE_CONTEST_LIMIT,
  message: {
    error: 'Too Many Contest Updates',
    message: 'Too many contest update attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logger.warn('Contest update rate limit exceeded:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too Many Contest Updates',
      message: 'Too many contest update attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict rate limiter for contest starts
const startContestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.START_CONTEST_LIMIT,
  message: {
    error: 'Too Many Contest Starts',
    message: 'Too many contest start attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logger.warn('Contest start rate limit exceeded:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too Many Contest Starts',
      message: 'Too many contest start attempts, please try again later.',
      retryAfter: '1 hour'
    });
  }
});

// DDoS protection - very strict limits
const ddosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.DDOS_LIMIT,
  message: {
    error: 'DDoS Protection',
    message: 'Too many requests detected, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logger.error('DDoS protection triggered:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    // Add IP to blocked list for 1 hour
    blockedIPs.add(clientIP);
    setTimeout(() => blockedIPs.delete(clientIP), 60 * 60 * 1000);
    
    res.status(429).json({
      error: 'DDoS Protection',
      message: 'Too many requests detected, please slow down.',
      retryAfter: '1 minute'
    });
  }
});

// IP blocking middleware
const blockSuspiciousIPs = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (blockedIPs.has(clientIP)) {
    logger.warn('Blocked IP attempted access:', {
      ip: clientIP,
      endpoint: req.originalUrl,
      method: req.method
    });
    
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Your IP has been temporarily blocked due to suspicious activity.',
      retryAfter: '1 hour'
    });
  }
  
  next();
};

// Bot detection middleware
const detectBots = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const clientIP = req.ip || req.connection.remoteAddress;
  
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python', 'java', 'perl', 'ruby', 'php', 'go-http-client'
  ];
  
  const isBot = botPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (isBot) {
    logger.warn('Bot detected:', {
      ip: clientIP,
      userAgent: userAgent,
      endpoint: req.originalUrl,
      method: req.method
    });
    
    // Apply stricter rate limits for bots
    req.isBot = true;
  }
  
  next();
};

module.exports = {
  generalLimiter,
  createContestLimiter,
  updateContestLimiter,
  startContestLimiter,
  ddosLimiter,
  blockSuspiciousIPs,
  detectBots
};
