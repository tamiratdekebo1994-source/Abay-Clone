/**
 * Dynamic Expo config — reads secrets from environment variables at build time.
 * Copy mobile/.env.example to mobile/.env and fill in your values.
 *
 * This file takes precedence over app.json for any overlapping fields.
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
// Dev API server — set to your machine's local IP (e.g. http://192.168.1.100:5000)
const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.1.100:5000';
// EAS project ID — get from `eas init` or https://expo.dev/accounts/<username>/projects
const easProjectId = process.env.EAS_PROJECT_ID || '';
const sentryDsn = process.env.SENTRY_DSN || '';

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
    config: {
      ...config.ios?.config,
      googleMapsApiKey,
    },
  },
  android: {
    ...config.android,
    config: {
      googleMaps: { apiKey: googleMapsApiKey },
    },
    ...(process.env.GOOGLE_SERVICES_JSON && { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }),
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
