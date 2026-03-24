const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDashboard, getDrivers, approveDriver, getStores, getAllOrders } = require('../controllers/adminController');
const { getSurgeMultiplier, setManualSurge } = require('../services/surgeService');
const prisma = require('../config/database');

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/drivers', getDrivers);
router.patch('/drivers/:driverId/status', approveDriver);
router.get('/stores', getStores);
router.get('/orders', getAllOrders);

// Surge pricing management
router.get('/surge', async (req, res, next) => {
  try {
    const cities = [
      'Addis Ababa', 'Dire Dawa', 'Hawassa', 'Bahir Dar',
      'Mekelle', 'Adama', 'Jimma', 'Dessie', 'Gondar',
    ];
    const results = await Promise.all(
      cities.map(async (city) => {
        const surge = await getSurgeMultiplier(city);
        const zone = await prisma.zone.findFirst({ where: { city, isActive: true } });
        return { city, ...surge, manualOverride: zone?.surgeMultiplier || 1.0 };
      })
    );
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

router.post('/surge', async (req, res, next) => {
  try {
    const { city, multiplier } = req.body;
    if (!city || multiplier === undefined) {
      return res.status(400).json({ success: false, message: 'city and multiplier are required' });
    }
    await setManualSurge(city, parseFloat(multiplier));
    const updated = await getSurgeMultiplier(city);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
