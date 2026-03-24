const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
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

module.exports = router;
