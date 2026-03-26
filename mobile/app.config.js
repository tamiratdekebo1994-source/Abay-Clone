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
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  extra: {
    ...config.extra,
    googleMapsApiKey,
    apiBaseUrl,
    eas: { projectId: easProjectId },
  },
});
