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

// Analytics — real time-series data for the last N days
router.get('/analytics', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const results = [];

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const [orders, revenue, newDrivers] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.order.aggregate({
          where: { createdAt: { gte: start, lte: end }, status: 'DELIVERED' },
          _sum: { totalAmount: true },
        }),
        prisma.driver.count({ where: { createdAt: { gte: start, lte: end } } }),
      ]);

      results.push({
        date: start.toISOString().split('T')[0],
        day: start.toLocaleDateString('en-US', { weekday: 'short' }),
        orders,
        revenue: parseFloat((revenue._sum.totalAmount || 0).toFixed(2)),
        newDrivers,
      });
    }

    // Summary totals
    const [totalOrders, totalRevenue, activeDrivers, totalStores] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { totalAmount: true } }),
      prisma.driver.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
      prisma.store.count(),
    ]);

    res.json({
      success: true,
      data: {
        timeSeries: results,
        summary: {
          totalOrders,
          totalRevenue: parseFloat((totalRevenue._sum.totalAmount || 0).toFixed(2)),
          activeDrivers,
          totalStores,
        },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
