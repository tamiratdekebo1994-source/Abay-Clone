const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/database');
const validate = require('../middleware/validate');
const storeValidators = require('../validators/store');
const { makeRateLimiter } = require('../utils/rateLimiter');

const pushTokenLimit = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many push token registration requests.' },
});
const { registerStore, getStoreProfile, updateStoreProfile, getStoreDashboard } = require('../controllers/storeController');

router.use(authenticate);
router.use(authorize('STORE'));

router.post('/register', validate(storeValidators.register), registerStore);
router.get('/profile', getStoreProfile);
router.patch('/profile', validate(storeValidators.updateProfile), updateStoreProfile);
router.get('/dashboard', getStoreDashboard);

// Push token registration
router.post('/push-token', pushTokenLimit, validate(storeValidators.pushToken), async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.user.id, platform, updatedAt: new Date() },
      create: { userId: req.user.id, token, platform: platform || 'web' },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
