/**
 * Structured JSON logger
 * - In production: emits JSON lines for log aggregation (ELK, Datadog, etc.)
 * - In development: emits human-readable colourised output via morgan 'dev'
 * - Every request gets a unique requestId injected by the requestId middleware
 */

const isProduction = process.env.NODE_ENV === 'production';

function formatMessage(level, message, meta = {}) {
  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'abay-driver-api',
      version: '1.0.0',
      ...meta,
    });
  }
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  info: (message, meta) => console.log(formatMessage('info', message, meta)),
  warn: (message, meta) => console.warn(formatMessage('warn', message, meta)),
  error: (message, meta) => console.error(formatMessage('error', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;
