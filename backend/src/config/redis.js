const Redis = require('ioredis');

let client = null;

/**
 * Returns a shared Redis client, or null if REDIS_URL is not configured.
 * All callers must handle the null case (graceful degradation to DB/memory).
 */
function getRedis() {
  if (client) return client;
  if (!process.env.REDIS_URL) return null;

  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
  });

  client.on('error', (err) => {
    // Log but don't crash — callers degrade gracefully
    console.error('[Redis] connection error:', err.message);
  });

  return client;
}

module.exports = { getRedis };
