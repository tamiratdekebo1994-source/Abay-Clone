/**
 * Dynamic Expo config — reads secrets from environment variables at build time.
 * Set GOOGLE_MAPS_API_KEY in your .env file (see .env.example).
 *
 * This file takes precedence over app.json for any overlapping fields.
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';

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
  },
});
