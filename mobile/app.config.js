/**
 * Dynamic Expo config — reads secrets from environment variables at build time.
 * Copy mobile/.env.example to mobile/.env and fill in your values.
 *
 * This file takes precedence over app.json for any overlapping fields.
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
// Dev API server — set to your machine's local IP (e.g. http://192.168.1.100:5000)
const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.1.100:5000';

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
  },
  extra: {
    ...config.extra,
    googleMapsApiKey,
    apiBaseUrl,
  },
});
