const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDashboard, getDrivers, approveDriver, getStores, getAllOrders } = require('../controllers/adminController');

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/drivers', getDrivers);
router.patch('/drivers/:driverId/status', approveDriver);
router.get('/stores', getStores);
router.get('/orders', getAllOrders);

module.exports = router;
