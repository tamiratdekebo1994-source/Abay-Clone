const Sentry = require('@sentry/node');

function initSentry(app) {
  if (!process.env.SENTRY_DSN || process.env.NODE_ENV === 'test') return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration({ app }),
    ],
  });
}

module.exports = { Sentry, initSentry };
