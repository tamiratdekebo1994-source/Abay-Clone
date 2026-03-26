const { Sentry } = require('../config/sentry');
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
    });
  }

  const statusCode = err.statusCode || 500;

  // Report unexpected server errors to Sentry (skip known client errors)
  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
