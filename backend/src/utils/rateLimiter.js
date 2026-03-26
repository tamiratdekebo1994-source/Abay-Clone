const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');

/**
 * Creates an express-rate-limit middleware.
 * Uses a Redis store when REDIS_URL is set so limits survive restarts
 * and are shared across multiple server instances.
 */
function makeRateLimiter(options) {
  const redis = getRedis();
  if (redis) {
    const { RedisStore } = require('rate-limit-redis');
    return rateLimit({
      ...options,
      store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    });
  }
  return rateLimit(options);
}

module.exports = { makeRateLimiter };
