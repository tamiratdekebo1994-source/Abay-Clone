/**
 * Test application factory — creates an Express app with all routes mounted
 * but without starting an HTTP server or binding to a port.
 * Call createApp() once per test file after jest.mock() calls are in place.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'fetno-test-secret-key-32chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fetno-refresh-secret-32chars';
process.env.NODE_ENV = 'test';

const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());

  // Stub socket.io — routes use req.io to emit events
  app.use((req, _res, next) => {
    req.io = {
      emit: () => {},
      to: () => ({ emit: () => {} }),
    };
    next();
  });

  app.use('/api/auth', require('../../src/routes/auth'));
  app.use('/api/driver', require('../../src/routes/driver'));
  app.use('/api/store', require('../../src/routes/store'));
  app.use('/api/orders', require('../../src/routes/order'));
  app.use('/api/admin', require('../../src/routes/admin'));
  app.use('/api/chat', require('../../src/routes/chat'));
  app.use('/api/wallet', require('../../src/routes/wallet'));
  app.use('/api/notifications', require('../../src/routes/notifications'));

  app.use(require('../../src/middleware/errorHandler'));

  return app;
}

module.exports = createApp;
