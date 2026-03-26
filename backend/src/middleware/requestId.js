const { randomUUID } = require('crypto');

/**
 * Attaches a unique requestId to every incoming request.
 * The ID is echoed back in the X-Request-Id response header
 * so clients can correlate logs with specific requests.
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
