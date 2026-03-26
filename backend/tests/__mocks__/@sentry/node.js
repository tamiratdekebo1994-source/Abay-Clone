// Stub for @sentry/node — used in the test environment where the package is not installed.
const Sentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  expressErrorHandler: () => (err, req, res, next) => next(err),
  httpIntegration: jest.fn(),
  expressIntegration: jest.fn(),
};

module.exports = Sentry;
