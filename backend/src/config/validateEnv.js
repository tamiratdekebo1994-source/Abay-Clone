/**
 * Validates required environment variables at startup.
 * Throws with a clear list of what's missing so the operator knows
 * exactly what to set before the process starts accepting connections.
 */
function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `[startup] FATAL: Missing required environment variables:\n` +
      missing.map((k) => `  - ${k}`).join('\n') +
      `\n\nSee backend/.env.example for documentation.`
    );
    process.exit(1);
  }

  // Warn about important-but-optional vars
  const recommended = ['AT_API_KEY', 'SENTRY_DSN', 'REDIS_URL'];
  const absent = recommended.filter((key) => !process.env[key]);
  if (absent.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn(
      `[startup] WARNING: Recommended env vars not set (features may be degraded):\n` +
      absent.map((k) => `  - ${k}`).join('\n')
    );
  }
}

module.exports = validateEnv;
