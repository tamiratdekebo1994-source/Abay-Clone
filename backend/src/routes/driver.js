const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/database');
const { getSurgeMultiplier } = require('../services/surgeService');
const {
  registerDriver, getDriverProfile, updateLocation,
  toggleOnline, getNearbyOrders, getEarnings,
} = require('../controllers/driverController');

router.use(authenticate);
router.use(authorize('DRIVER'));

router.post('/register', registerDriver);
router.get('/profile', getDriverProfile);
router.patch('/location', updateLocation);
router.post('/toggle-online', toggleOnline);
router.get('/orders/nearby', getNearbyOrders);
router.get('/earnings', getEarnings);

// Push token registration
router.post('/push-token', async (req, res, next) => {
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
