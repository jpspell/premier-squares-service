const logger = require('../utils/logger');

// Security middleware to prevent common attacks
const securityMiddleware = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Block suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /perl/i,
    /ruby/i,
    /java/i,
    /php/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  if (isSuspicious) {
    logger.warn('Suspicious user agent blocked:', { ip: clientIP, userAgent });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }
  
  // Block requests with suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-forwarded-proto',
    'x-forwarded-host'
  ];
  
  const hasSuspiciousHeaders = suspiciousHeaders.some(header => 
    req.get(header) && req.get(header).includes('script')
  );
  
  if (hasSuspiciousHeaders) {
    logger.warn('Suspicious headers detected:', { 
      ip: clientIP, 
      headers: suspiciousHeaders.filter(h => req.get(h))
    });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid headers'
    });
  }
  
  // Block requests with suspicious query parameters
  const suspiciousQueryParams = Object.keys(req.query).some(param => {
    const value = req.query[param];
    return typeof value === 'string' && (
      value.includes('<script') ||
      value.includes('javascript:') ||
      value.includes('data:text/html') ||
      value.includes('vbscript:')
    );
  });
  
  if (suspiciousQueryParams) {
    logger.warn('Suspicious query parameters detected:', { 
      ip: clientIP, 
      query: req.query 
    });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid query parameters'
    });
  }
  
  // Block requests with suspicious body content
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body).toLowerCase();
    const suspiciousBodyPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i
    ];
    
    const hasSuspiciousBody = suspiciousBodyPatterns.some(pattern => 
      pattern.test(bodyString)
    );
    
    if (hasSuspiciousBody) {
      logger.warn('Suspicious body content detected:', { 
        ip: clientIP, 
        bodySize: bodyString.length 
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body'
      });
    }
  }
  
  // Rate limiting check (basic)
  const requestKey = `${clientIP}-${req.method}-${req.path}`;
  const now = Date.now();
  
  // Simple in-memory rate limiting (in production, use Redis)
  if (!req.app.locals.rateLimit) {
    req.app.locals.rateLimit = new Map();
  }
  
  const rateLimit = req.app.locals.rateLimit;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;
  
  const userRequests = rateLimit.get(requestKey) || [];
  const recentRequests = userRequests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    logger.warn('Rate limit exceeded:', { ip: clientIP, endpoint: req.path });
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded'
    });
  }
  
  recentRequests.push(now);
  rateLimit.set(requestKey, recentRequests);
  
  // Clean up old entries
  if (rateLimit.size > 1000) {
    const oldestAllowed = now - windowMs;
    for (const [key, times] of rateLimit.entries()) {
      const filtered = times.filter(time => time > oldestAllowed);
      if (filtered.length === 0) {
        rateLimit.delete(key);
      } else {
        rateLimit.set(key, filtered);
      }
    }
  }
  
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = value.trim().replace(/[<>]/g, '');
      }
    }
  }
  
  // Sanitize body (already handled by validation middleware)
  next();
};

module.exports = {
  securityMiddleware,
  sanitizeInput
};
