const admin = require('firebase-admin');
const config = require('./config');

/**
 * Load Firebase service account credentials
 * @returns {Object|null} Service account object or null if not found
 */
const loadServiceAccount = () => {
  try {
    // First try environment variables
    if (config.FIREBASE_PROJECT_ID && config.FIREBASE_PRIVATE_KEY && config.FIREBASE_CLIENT_EMAIL) {
      console.log('🔐 Loading Firebase credentials from environment variables');
      return {
        project_id: config.FIREBASE_PROJECT_ID,
        private_key: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: config.FIREBASE_CLIENT_EMAIL
      };
    }
    
    // Fallback to JSON file
    console.log('🔐 Loading Firebase credentials from serviceAccountKey.json');
    return require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Error loading Firebase credentials:', error.message);
    console.warn('⚠️  No Firebase credentials found - running in mock mode');
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
      console.log('✅ Firebase already initialized');
      return;
    }

    const serviceAccount = loadServiceAccount();
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
      });
      console.log('✅ Firebase initialized successfully');
    } else {
      console.warn('⚠️  Firebase not configured - running in mock mode');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
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
    console.log('✅ Firestore initialized successfully');
  } else {
    throw new Error('Firebase not initialized');
  }
} catch (error) {
  console.error('❌ Firestore initialization error:', error.message);
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
  console.log('⚠️  Using mock Firestore - Firebase not available');
}

module.exports = { db };
