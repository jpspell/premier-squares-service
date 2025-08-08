const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Convert size string to bytes
 * @param {string} size - Size string (e.g., '1mb', '10kb')
 * @returns {number} Size in bytes
 */
const parseSize = (size) => {
  if (typeof size === 'number') return size;
  
  const match = size.match(/^(\d+)([kmg]?b)$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { 'b': 1, 'kb': 1024, 'mb': 1024*1024, 'gb': 1024*1024*1024 };
  
  return value * multipliers[unit];
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate request body size
 */
const validateBodySize = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = parseSize(config.MAX_REQUEST_SIZE);
  
  if (contentLength > maxSize) {
    logger.warn('Request body too large:', {
      contentLength: formatBytes(contentLength),
      maxSize: formatBytes(maxSize),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds maximum allowed size',
      maxSize: formatBytes(maxSize),
      actualSize: formatBytes(contentLength)
    });
  }
  
  next();
};

/**
 * Validate URL-encoded data size
 */
const validateUrlEncodedSize = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = parseSize(config.MAX_URL_ENCODED_SIZE);
  
  if (contentLength > maxSize) {
    logger.warn('URL-encoded data too large:', {
      contentLength: formatBytes(contentLength),
      maxSize: formatBytes(maxSize),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'URL-encoded data exceeds maximum allowed size',
      maxSize: formatBytes(maxSize),
      actualSize: formatBytes(contentLength)
    });
  }
  
  next();
};

/**
 * Validate query string size
 */
const validateQueryStringSize = (req, res, next) => {
  const queryString = req.url.split('?')[1] || '';
  const querySize = Buffer.byteLength(queryString, 'utf8');
  const maxSize = parseInt(config.MAX_QUERY_STRING_SIZE);
  
  if (querySize > maxSize) {
    logger.warn('Query string too large:', {
      querySize: formatBytes(querySize),
      maxSize: formatBytes(maxSize),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(414).json({
      error: 'URI_TOO_LONG',
      message: 'Query string exceeds maximum allowed size',
      maxSize: formatBytes(maxSize),
      actualSize: formatBytes(querySize)
    });
  }
  
  next();
};

/**
 * Validate header size
 */
const validateHeaderSize = (req, res, next) => {
  const headers = req.headers;
  let totalHeaderSize = 0;
  
  for (const [key, value] of Object.entries(headers)) {
    totalHeaderSize += Buffer.byteLength(key, 'utf8');
    totalHeaderSize += Buffer.byteLength(value, 'utf8');
  }
  
  const maxSize = parseInt(config.MAX_HEADER_SIZE);
  
  if (totalHeaderSize > maxSize) {
    logger.warn('Headers too large:', {
      headerSize: formatBytes(totalHeaderSize),
      maxSize: formatBytes(maxSize),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(431).json({
      error: 'REQUEST_HEADER_FIELDS_TOO_LARGE',
      message: 'Request headers exceed maximum allowed size',
      maxSize: formatBytes(maxSize),
      actualSize: formatBytes(totalHeaderSize)
    });
  }
  
  next();
};

/**
 * Validate individual field sizes
 */
const validateFieldSizes = (req, res, next) => {
  const maxFieldSize = parseInt(config.MAX_FIELD_SIZE);
  const body = req.body;
  
  if (body && typeof body === 'object') {
    const validateField = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
          const fieldSize = Buffer.byteLength(value, 'utf8');
          if (fieldSize > maxFieldSize) {
            logger.warn('Field too large:', {
              field: currentPath,
              fieldSize: formatBytes(fieldSize),
              maxSize: formatBytes(maxFieldSize),
              ip: req.ip,
              method: req.method,
              url: req.originalUrl
            });
            
            return res.status(400).json({
              error: 'FIELD_TOO_LARGE',
              message: `Field '${currentPath}' exceeds maximum allowed size`,
              field: currentPath,
              maxSize: formatBytes(maxFieldSize),
              actualSize: formatBytes(fieldSize)
            });
          }
        } else if (typeof value === 'object' && value !== null) {
          const result = validateField(value, currentPath);
          if (result) return result;
        }
      }
      return null;
    };
    
    const result = validateField(body);
    if (result) return result;
  }
  
  next();
};

/**
 * Comprehensive request size validation middleware
 */
const validateRequestSizes = (req, res, next) => {
  // Validate body size for POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    validateBodySize(req, res, (err) => {
      if (err) return next(err);
      
      validateUrlEncodedSize(req, res, (err) => {
        if (err) return next(err);
        
        validateFieldSizes(req, res, next);
      });
    });
  } else {
    // For GET requests, validate query string and headers
    validateQueryStringSize(req, res, (err) => {
      if (err) return next(err);
      
      validateHeaderSize(req, res, next);
    });
  }
};

/**
 * Memory usage monitoring middleware
 */
const monitorMemoryUsage = (req, res, next) => {
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external
    };
    
    // Log if memory usage increased significantly
    if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
      logger.warn('High memory usage detected:', {
        memoryDiff: {
          rss: formatBytes(memoryDiff.rss),
          heapUsed: formatBytes(memoryDiff.heapUsed),
          external: formatBytes(memoryDiff.external)
        },
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
};

module.exports = {
  validateRequestSizes,
  validateBodySize,
  validateUrlEncodedSize,
  validateQueryStringSize,
  validateHeaderSize,
  validateFieldSizes,
  monitorMemoryUsage,
  parseSize,
  formatBytes
};
