const admin = require('firebase-admin');

/**
 * Load Firebase service account credentials
 * @returns {Object|null} Service account object or null if not found
 */
const loadServiceAccount = () => {
  try {
    // Try to load from environment variable (for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    
    // Try to load from local file (for development)
    return require('../serviceAccountKey.json');
  } catch (error) {
    console.warn('Firebase service account not found. Please add serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT environment variable.');
    return null;
  }
};

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
  const serviceAccount = loadServiceAccount();
  
  if (!admin.apps.length) {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
      });
    } else {
      console.warn('⚠️  Firebase not configured - running in mock mode');
    }
  }
};

// Initialize Firebase
initializeFirebase();

const db = admin.firestore();

module.exports = { db };
