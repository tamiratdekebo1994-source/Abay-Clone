/**
 * Dynamic Expo config — reads secrets from environment variables at build time.
 * Copy mobile/.env.example to mobile/.env and fill in your values.
 *
 * This file takes precedence over app.json for any overlapping fields.
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
const easProjectId = process.env.EAS_PROJECT_ID || '9ec35099-d353-4072-bbbd-2504bcde96f6';
const sentryDsn = process.env.SENTRY_DSN || '';
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON || './google-services.json';

// For EAS Build: Use file environment variable
// For local development: Use local file
const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist';

// Firebase Web App config — from Firebase Console → Project Settings → Your Apps
const firebase = {
  apiKey:            process.env.FIREBASE_API_KEY            || '',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.FIREBASE_APP_ID             || '',
};

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile: googleServicesPlist,
    infoPlist: {
      ...config.ios?.infoPlist,
      NSLocationWhenInUseUsageDescription: 'We need your location to show nearby deliveries and track your progress.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'We need your location to show nearby deliveries and track your progress.',
    },
    config: {
      ...config.ios?.config,
      googleMapsApiKey,
    },
  },
  android: {
    ...config.android,
    googleServicesFile: googleServicesJson,
    config: {
      googleMaps: { apiKey: googleMapsApiKey },
    },
  },
  extra: {
    ...config.extra,
    googleMapsApiKey,
    apiBaseUrl,
    sentryDsn,
    firebase,
    eas: { projectId: easProjectId },
  },
});