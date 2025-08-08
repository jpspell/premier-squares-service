const admin = require('firebase-admin');

/**
 * Load Firebase service account credentials
 * @returns {Object|null} Service account object or null if not found
 */
const loadServiceAccount = () => {
  try {
    // Priority 1: Try to load from environment variables (for production)
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_CLIENT_EMAIL) {
      
      console.log('🔐 Loading Firebase credentials from environment variables');
      
      // Debug: Check the private key format
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      console.log('🔍 Private key starts with:', privateKey.substring(0, 50));
      console.log('🔍 Private key ends with:', privateKey.substring(privateKey.length - 50));
      console.log('🔍 Private key length:', privateKey.length);
      
      // Test if the key is valid
      try {
        require('crypto').createPrivateKey(privateKey);
        console.log('✅ Private key is valid!');
      } catch (error) {
        console.log('❌ Private key validation failed:', error.message);
      }
      
      return {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
        universe_domain: "googleapis.com"
      };
    }
    
    // Priority 2: Try to load from environment variable as JSON (legacy support)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔐 Loading Firebase credentials from FIREBASE_SERVICE_ACCOUNT env var');
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    
    // Priority 3: Try to load from local file (for development only)
    console.log('🔐 Loading Firebase credentials from serviceAccountKey.json (fallback mode)');
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
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
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
