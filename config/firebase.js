const admin = require('firebase-admin');
const config = require('./config');
const logger = require('../utils/logger');
const { handleError, ErrorTypes } = require('../utils/errorHandler');

// Store Firebase app globally for graceful shutdown
let firebaseApp = null;

/**
 * Load Firebase service account credentials
 * @returns {Object|null} Service account object or null if not found
 */
const loadServiceAccount = () => {
  try {
    // Use JSON file directly (bypass environment variables)
    logger.info('Loading Firebase credentials from serviceAccountKey.json');
    return require('../serviceAccountKey.json');
  } catch (error) {
    // Use structured error handling
    handleError(error, null, ErrorTypes.CONFIGURATION, {
      operation: 'load_firebase_credentials',
      file: 'serviceAccountKey.json'
    });
    logger.warn('No Firebase credentials found - running in mock mode');
    return null;
  }
};

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    const apps = admin.apps;
    if (apps && apps.length > 0) {
      logger.info('Firebase already initialized');
      return;
    }

    const serviceAccount = loadServiceAccount();
    
    if (serviceAccount) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
      });
      
      // Store Firebase app globally for graceful shutdown
      global.firebaseApp = firebaseApp;
      
      logger.info('Firebase initialized successfully');
    } else {
      logger.warn('Firebase not configured - running in mock mode');
    }
  } catch (error) {
    // Use structured error handling
    handleError(error, null, ErrorTypes.CONFIGURATION, {
      operation: 'initialize_firebase',
      serviceAccount: serviceAccount ? 'loaded' : 'not_found'
    });
    // Don't throw - let the app continue without Firebase
  }
};

// Initialize Firebase
initializeFirebase();

// Get Firestore instance with error handling
let db = null;
try {
  // Check if Firebase is initialized before trying to get Firestore
  if (admin.apps.length > 0) {
    db = admin.firestore();
    logger.info('Firestore initialized successfully');
  } else {
    throw new Error('Firebase not initialized');
  }
} catch (error) {
  // Use structured error handling
  handleError(error, null, ErrorTypes.CONFIGURATION, {
    operation: 'initialize_firestore',
    firebaseApps: admin.apps?.length || 0
  });
  
  // Create a mock db object for graceful degradation
  db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => null }),
        set: async () => ({}),
        update: async () => ({}),
        delete: async () => ({})
      })
    })
  };
  logger.warn('Using mock Firestore - Firebase not available');
}

module.exports = { db };
