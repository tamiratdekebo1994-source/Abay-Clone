const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/database');
const { getSurgeMultiplier } = require('../services/surgeService');
const validate = require('../middleware/validate');
const driverValidators = require('../validators/driver');
const { makeRateLimiter } = require('../utils/rateLimiter');

const pushTokenLimit = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many push token registration requests.' },
});
const {
  registerDriver, getDriverProfile, updateLocation,
  toggleOnline, getNearbyOrders, getEarnings, rejectOrder,
} = require('../controllers/driverController');

router.use(authenticate);
router.use(authorize('DRIVER'));

router.post('/register', validate(driverValidators.register), registerDriver);
router.get('/profile', getDriverProfile);
router.patch('/location', validate(driverValidators.location), updateLocation);
router.post('/toggle-online', toggleOnline);
router.get('/orders/nearby', getNearbyOrders);
router.post('/orders/:orderId/reject', rejectOrder);
router.get('/earnings', getEarnings);

// Push token registration
router.post('/push-token', pushTokenLimit, validate(driverValidators.pushToken), async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.user.id, platform, updatedAt: new Date() },
      create: { userId: req.user.id, token, platform: platform || 'android' },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Surge info
router.get('/surge', async (req, res, next) => {
  try {
    const { city = 'Addis Ababa' } = req.query;
    const surge = await getSurgeMultiplier(city);
    res.json({ success: true, data: surge });
  } catch (err) { next(err); }
});

module.exports = router;
