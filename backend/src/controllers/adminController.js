const prisma = require('../config/database');
const emailService = require('../services/emailService');

const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDrivers, onlineDrivers, pendingDrivers,
      totalStores, totalOrders, todayOrders,
      activeOrders, completedOrders,
      todayRevenue, totalRevenue,
    ] = await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
      prisma.driver.count({ where: { status: 'PENDING' } }),
      prisma.store.count(),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: { in: ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'] } } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: today } }, _sum: { platformFee: true } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { platformFee: true } }),
    ]);

    res.json({
      success: true,
      data: {
        drivers: { total: totalDrivers, online: onlineDrivers, pending: pendingDrivers },
        stores: { total: totalStores },
        orders: { total: totalOrders, today: todayOrders, active: activeOrders, completed: completedOrders },
        revenue: {
          today: todayRevenue._sum.platformFee || 0,
          total: totalRevenue._sum.platformFee || 0,
          currency: 'ETB',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getDrivers = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: { user: { select: { fullName: true, phone: true, email: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.driver.count({ where }),
    ]);

    res.json({ success: true, data: { drivers, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const approveDriver = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { action } = req.body; // 'approve' or 'suspend'

    const status = action === 'approve' ? 'OFFLINE' : 'SUSPENDED';
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status },
      include: { user: { select: { fullName: true, phone: true } } },
    });

    // Notify driver
    await prisma.notification.create({
      data: {
        userId: driver.userId,
        title: action === 'approve' ? 'Application Approved!' : 'Account Suspended',
        titleAm: action === 'approve' ? 'ማመልከቻ ተቀብሏል!' : 'መለያ ታግዷል',
        body: action === 'approve'
          ? 'Your driver application has been approved. You can now go online and accept deliveries!'
          : 'Your driver account has been suspended. Please contact support.',
        bodyAm: action === 'approve'
          ? 'የሾፌር ማመልከቻዎ ተቀባይነት አግኝቷል። አሁን ኦንላይን ሆነው ማድረስ መቀበል ይችላሉ!'
          : 'የሾፌር መለያዎ ታግዷል። እባክዎ ድጋፍን ያነጋግሩ።',
        type: 'DRIVER_STATUS',
      },
    });

    // Send email notification if driver has an email on file
    if (driver.user.email) {
      const fn = action === 'approve' ? emailService.sendDriverApproved : emailService.sendDriverSuspended;
      fn(driver.user.email, driver.user.fullName).catch(console.error);
    }

    res.json({ success: true, message: `Driver ${action}d successfully`, data: driver });
  } catch (error) {
    next(error);
  }
};

const getStores = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        include: {
          user: { select: { fullName: true, phone: true, email: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.store.count(),
    ]);

    res.json({ success: true, data: { stores, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          store: { select: { storeName: true, city: true } },
          driver: { select: { vehiclePlate: true, user: { select: { fullName: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: { orders, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const updateStoreStatus = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { action } = req.body; // 'verify' | 'unverify' | 'suspend' | 'unsuspend'

    const validActions = ['verify', 'unverify', 'suspend', 'unsuspend'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: `action must be one of: ${validActions.join(', ')}` });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    if (action === 'verify' || action === 'unverify') {
      await prisma.store.update({ where: { id: storeId }, data: { isVerified: action === 'verify' } });
      if (action === 'verify' && store.user.email) {
        emailService.sendStoreVerified(store.user.email, store.storeName).catch(console.error);
      }
    } else {
      await prisma.user.update({ where: { id: store.userId }, data: { isActive: action === 'unsuspend' } });
    }

    const notifTitles = {
      verify: 'Store Verified!', unverify: 'Store Verification Removed',
      suspend: 'Store Suspended', unsuspend: 'Store Reinstated',
    };
    const notifBodies = {
      verify: 'Your store has been verified. Customers will see a verified badge on your profile.',
      unverify: 'Your store verification has been removed.',
      suspend: 'Your store has been suspended. Please contact support.',
      unsuspend: 'Your store account has been reinstated. You can resume operations.',
    };

    await prisma.notification.create({
      data: {
        userId: store.userId,
        title: notifTitles[action],
        body: notifBodies[action],
        type: 'STORE_STATUS',
      },
    });

    res.json({ success: true, message: `Store ${action}d successfully` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getDrivers, approveDriver, getStores, getAllOrders, updateStoreStatus };
