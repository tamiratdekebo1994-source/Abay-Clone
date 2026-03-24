const prisma = require('../config/database');

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

module.exports = { getDashboard, getDrivers, approveDriver, getStores, getAllOrders };
