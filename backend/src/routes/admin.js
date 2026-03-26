const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getDashboard, getDrivers, approveDriver, getStores, getAllOrders, updateStoreStatus } = require('../controllers/adminController');
const { getSurgeMultiplier, setManualSurge } = require('../services/surgeService');
const prisma = require('../config/database');
const validate = require('../middleware/validate');
const adminValidators = require('../validators/admin');

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/drivers', getDrivers);
router.patch('/drivers/:driverId/status', validate(adminValidators.approveDriver), approveDriver);
router.get('/stores', getStores);
router.patch('/stores/:storeId/status', updateStoreStatus);
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

router.post('/surge', validate(adminValidators.surge), async (req, res, next) => {
  try {
    const { city, multiplier } = req.body;
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

// ─── CSV Exports ─────────────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

// GET /api/admin/export/orders.csv
router.get('/export/orders.csv', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        store: { select: { storeName: true, city: true } },
        driver: { select: { user: { select: { fullName: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csv = toCSV(
      ['Order #', 'Status', 'Store', 'City', 'Driver', 'Driver Phone', 'Distance (km)',
        'Total (ETB)', 'Driver Fee (ETB)', 'Platform Fee (ETB)', 'Payment Method',
        'Payment Status', 'Created At', 'Delivered At'],
      orders.map((o) => [
        o.orderNumber, o.status,
        o.store?.storeName, o.store?.city,
        o.driver?.user?.fullName || '', o.driver?.user?.phone || '',
        o.distanceKm?.toFixed(2), o.totalAmount?.toFixed(2),
        o.driverFee?.toFixed(2), o.platformFee?.toFixed(2),
        o.paymentMethod || '', o.paymentStatus,
        o.createdAt.toISOString(), o.deliveredAt?.toISOString() || '',
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/admin/export/drivers.csv
router.get('/export/drivers.csv', async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        user: { select: { fullName: true, phone: true, email: true, createdAt: true } },
        wallet: { select: { balance: true, totalWithdrawn: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csv = toCSV(
      ['Name', 'Phone', 'Email', 'Status', 'City', 'Vehicle Type', 'Vehicle Plate',
        'Rating', 'Total Deliveries', 'Total Earnings (ETB)', 'Wallet Balance (ETB)', 'Joined At'],
      drivers.map((d) => [
        d.user.fullName, d.user.phone, d.user.email || '',
        d.status, d.city, d.vehicleType, d.vehiclePlate,
        d.rating?.toFixed(2), d.totalDeliveries, d.totalEarnings?.toFixed(2),
        d.wallet?.balance?.toFixed(2) || '0.00',
        d.user.createdAt.toISOString(),
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="drivers_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/admin/export/stores.csv
router.get('/export/stores.csv', async (req, res, next) => {
  try {
    const stores = await prisma.store.findMany({
      include: {
        user: { select: { fullName: true, phone: true, email: true, isActive: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csv = toCSV(
      ['Store Name', 'Type', 'Owner', 'Phone', 'Email', 'City', 'Address',
        'Verified', 'Active', 'Rating', 'Total Orders', 'Joined At'],
      stores.map((s) => [
        s.storeName, s.storeType,
        s.user.fullName, s.user.phone, s.user.email || '',
        s.city, s.address,
        s.isVerified ? 'Yes' : 'No',
        s.user.isActive ? 'Yes' : 'No',
        s.rating?.toFixed(2) ?? '',
        s._count.orders,
        s.createdAt.toISOString(),
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stores_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/admin/export/withdrawals.csv
router.get('/export/withdrawals.csv', async (req, res, next) => {
  try {
    const withdrawals = await prisma.walletWithdrawal.findMany({
      include: {
        wallet: {
          include: { driver: { include: { user: { select: { fullName: true, phone: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csv = toCSV(
      ['Driver', 'Phone', 'Amount (ETB)', 'Method', 'Account Number', 'Account Name',
        'Status', 'Reference', 'Requested At', 'Processed At'],
      withdrawals.map((w) => [
        w.wallet?.driver?.user?.fullName || '', w.wallet?.driver?.user?.phone || '',
        w.amount?.toFixed(2), w.method, w.accountNumber, w.accountName || '',
        w.status, w.reference || '',
        w.createdAt.toISOString(), w.processedAt?.toISOString() || '',
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="withdrawals_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
