require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { Sentry, initSentry } = require('./config/sentry');
const logger = require('./config/logger');
const requestId = require('./middleware/requestId');
const { makeRateLimiter } = require('./utils/rateLimiter');
const prisma = require('./config/database');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const storeRoutes = require('./routes/store');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const chatRoutes = require('./routes/chat');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');
const trackRoutes = require('./routes/track');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socketService');

const app = express();
app.set('trust proxy', 1); // trust nginx reverse proxy
initSentry(app);
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// Request ID — must be first so all subsequent middleware can use req.requestId
app.use(requestId);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting — Redis-backed when REDIS_URL is set
app.use('/api/auth', makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
}));

app.use(makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
}));

// Parsing — capture raw body for payment webhook signature verification
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// HTTP request logging
if (process.env.NODE_ENV === 'production') {
  morgan.token('request-id', (req) => req.requestId);
  app.use(morgan((tokens, req, res) => JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'abay-driver-api',
    requestId: tokens['request-id'](req, res),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: parseInt(tokens.status(req, res), 10),
    responseTime: parseFloat(tokens['response-time'](req, res)),
    contentLength: tokens.res(req, res, 'content-length'),
    userAgent: tokens['user-agent'](req, res),
  })));
} else {
  app.use(morgan('dev'));
}

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Inject io into requests
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/track', trackRoutes);

// Health check — used by Docker and load balancers
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      app: 'Abay Driver API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: 'ok',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      app: 'Abay Driver API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: 'unreachable',
    });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Sentry error handler (must come before custom error handler)
app.use(Sentry.expressErrorHandler());

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info('Abay Driver API started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    health: `http://localhost:${PORT}/health`,
  });
});

module.exports = { app, io };
