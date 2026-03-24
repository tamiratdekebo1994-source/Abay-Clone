require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const storeRoutes = require('./routes/store');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const chatRoutes = require('./routes/chat');
const walletRoutes = require('./routes/wallet');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socketService');

const app = express();
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

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

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Abay Driver API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Abay Driver API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health\n`);
});

module.exports = { app, io };
