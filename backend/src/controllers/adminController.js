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

// Driver Earnings Dashboard
const getDriverEarnings = async (req, res, next) => {
  try {
    const { sortBy = 'earnings', limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const drivers = await prisma.driver.findMany({
      include: {
        user: { select: { fullName: true, phone: true } },
        earnings: { where: { isPaid: false } },
        _count: { select: { earnings: true } },
      },
      orderBy: sortBy === 'rating' ? { rating: 'desc' } : { totalEarnings: 'desc' },
      skip,
      take: parseInt(limit),
    });

    const total = await prisma.driver.count();
    const totalEarningsUnpaid = await prisma.earning.aggregate({
      where: { isPaid: false },
      _sum: { amount: true },
    });

    const data = drivers.map((d) => ({
      ...d,
      unpaidAmount: d.earnings.reduce((sum, e) => sum + e.amount, 0),
      unpaidOrders: d.earnings.length,
    }));

    res.json({
      success: true,
      data: {
        drivers: data,
        total,
        totalUnpaidEarnings: totalEarningsUnpaid._sum.amount || 0,
        page: parseInt(page),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Financial Reports
const getFinancialReport = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      totalOrders,
      deliveredOrders,
      totalRevenue,
      driverPayouts,
      platformFees,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startDate } } }),
      prisma.order.count({ where: { status: 'DELIVERED', createdAt: { gte: startDate } } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: startDate } },
        _sum: { totalAmount: true },
      }),
      prisma.earning.aggregate({
        where: { createdAt: { gte: startDate }, isPaid: true },
        _sum: { amount: true },
      }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: startDate } },
        _sum: { platformFee: true },
      }),
    ]);

    const totalRevenueAmount = totalRevenue._sum.totalAmount || 0;
    const driverPayoutsAmount = driverPayouts._sum.amount || 0;
    const platformFeesAmount = platformFees._sum.platformFee || 0;
    const profit = platformFeesAmount - 0; // simplified (doesn't account for costs)

    res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        metrics: {
          totalOrders,
          deliveredOrders,
          totalRevenue: totalRevenueAmount,
          driverPayouts: driverPayoutsAmount,
          platformFees: platformFeesAmount,
          profit,
          conversionRate: totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Push Notifications - Send to drivers/stores
const sendPushNotification = async (req, res, next) => {
  try {
    const { title, body, targetType, targetIds } = req.body;
    // targetType: 'ALL_DRIVERS' | 'ALL_STORES' | 'SPECIFIC' | 'ONLINE_DRIVERS'

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    let userIds = [];
    if (targetType === 'ALL_DRIVERS') {
      const drivers = await prisma.driver.findMany({ select: { userId: true } });
      userIds = drivers.map((d) => d.userId);
    } else if (targetType === 'ONLINE_DRIVERS') {
      const drivers = await prisma.driver.findMany({
        where: { status: 'ONLINE' },
        select: { userId: true },
      });
      userIds = drivers.map((d) => d.userId);
    } else if (targetType === 'ALL_STORES') {
      const stores = await prisma.store.findMany({ select: { userId: true } });
      userIds = stores.map((s) => s.userId);
    } else if (targetType === 'SPECIFIC' && targetIds && targetIds.length > 0) {
      userIds = targetIds;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid targetType or missing targetIds' });
    }

    // Create notifications for all target users
    const notifications = userIds.map((userId) => ({
      userId,
      title,
      body,
      type: 'ADMIN_BROADCAST',
    }));

    const created = await prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    });

    res.json({
      success: true,
      message: `Notification sent to ${created.count} users`,
      data: { sentCount: created.count },
    });
  } catch (error) {
    next(error);
  }
};

// Commission Settings
const getCommissionSettings = async (req, res, next) => {
  try {
    const settings = await prisma.commissionSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      const defaults = await prisma.commissionSetting.create({
        data: {
          platformCommissionPercent: 15,
          driverCommissionPercent: 85,
          minimumOrderValue: 0,
          surgeCommissionBonus: 0.05,
          updatedBy: req.user.id,
        },
      });
      return res.json({ success: true, data: defaults });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

const updateCommissionSettings = async (req, res, next) => {
  try {
    const { platformCommissionPercent, driverCommissionPercent, minimumOrderValue, surgeCommissionBonus } = req.body;

    if ((platformCommissionPercent + driverCommissionPercent) !== 100) {
      return res.status(400).json({
        success: false,
        message: 'Platform + Driver commission must equal 100%',
      });
    }

    const settings = await prisma.commissionSetting.create({
      data: {
        platformCommissionPercent,
        driverCommissionPercent,
        minimumOrderValue,
        surgeCommissionBonus,
        updatedBy: req.user.id,
      },
    });

    // Log this action
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_COMMISSION',
        resource: 'COMMISSION',
        resourceId: settings.id,
        changes: JSON.stringify({ platformCommissionPercent, driverCommissionPercent, surgeCommissionBonus }),
      },
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// Customer Management
const getCustomers = async (req, res, next) => {
  try {
    const { isBlocked, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = isBlocked !== undefined ? { isBlocked: isBlocked === 'true' } : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: { customers, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const blockCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { blockedReason } = req.body;

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { isBlocked: true, blockedReason },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BLOCK_CUSTOMER',
        resource: 'CUSTOMER',
        resourceId: customerId,
        changes: JSON.stringify({ blockedReason }),
      },
    });

    res.json({ success: true, message: 'Customer blocked', data: customer });
  } catch (error) {
    next(error);
  }
};

const unblockCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { isBlocked: false, blockedReason: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UNBLOCK_CUSTOMER',
        resource: 'CUSTOMER',
        resourceId: customerId,
        changes: JSON.stringify({}),
      },
    });

    res.json({ success: true, message: 'Customer unblocked', data: customer });
  } catch (error) {
    next(error);
  }
};

// Promo Codes
const getPromoCodes = async (req, res, next) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = isActive !== undefined ? { isActive: isActive === 'true' } : {};

    const [codes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.promoCode.count({ where }),
    ]);

    res.json({ success: true, data: { codes, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const createPromoCode = async (req, res, next) => {
  try {
    const { code, description, discountType, discountValue, maxUses, minOrderAmount, maxDiscount, validFrom, validTo } = req.body;

    if (!code || !discountType || !discountValue || !validFrom || !validTo) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        maxUses,
        minOrderAmount,
        maxDiscount,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        createdBy: req.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_PROMO_CODE',
        resource: 'PROMO_CODE',
        resourceId: promoCode.id,
        changes: JSON.stringify({ code, discountValue, maxUses }),
      },
    });

    res.json({ success: true, data: promoCode });
  } catch (error) {
    next(error);
  }
};

const deactivatePromoCode = async (req, res, next) => {
  try {
    const { codeId } = req.params;

    const promoCode = await prisma.promoCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DEACTIVATE_PROMO_CODE',
        resource: 'PROMO_CODE',
        resourceId: codeId,
        changes: JSON.stringify({}),
      },
    });

    res.json({ success: true, message: 'Promo code deactivated', data: promoCode });
  } catch (error) {
    next(error);
  }
};

// Activity/Audit Logs
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, resource, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: { logs, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

// Fraud Detection
const getFraudFlags = async (req, res, next) => {
  try {
    const { status = 'OPEN', severity, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { status };
    if (severity) where.severity = severity;

    const [flags, total] = await Promise.all([
      prisma.fraudFlag.findMany({
        where,
        include: {
          driver: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
          store: { select: { id: true, storeName: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.fraudFlag.count({ where }),
    ]);

    res.json({ success: true, data: { flags, total, page: parseInt(page) } });
  } catch (error) {
    next(error);
  }
};

const reportFraud = async (req, res, next) => {
  try {
    const { flagType, driverId, storeId, customerId, severity = 'MEDIUM', description, evidence } = req.body;

    if (!flagType || !description) {
      return res.status(400).json({ success: false, message: 'flagType and description are required' });
    }

    const fraudFlag = await prisma.fraudFlag.create({
      data: {
        flagType,
        driverId,
        storeId,
        customerId,
        severity,
        description,
        evidence: evidence ? JSON.stringify(evidence) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REPORT_FRAUD',
        resource: 'FRAUD_FLAG',
        resourceId: fraudFlag.id,
        changes: JSON.stringify({ flagType, severity, description }),
      },
    });

    res.json({ success: true, data: fraudFlag });
  } catch (error) {
    next(error);
  }
};

const resolveFraudFlag = async (req, res, next) => {
  try {
    const { flagId } = req.params;
    const { status, resolution } = req.body;

    const fraudFlag = await prisma.fraudFlag.update({
      where: { id: flagId },
      data: {
        status,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RESOLVE_FRAUD_FLAG',
        resource: 'FRAUD_FLAG',
        resourceId: flagId,
        changes: JSON.stringify({ status, resolution }),
      },
    });

    res.json({ success: true, data: fraudFlag });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getDrivers,
  approveDriver,
  getStores,
  getAllOrders,
  updateStoreStatus,
  getDriverEarnings,
  getFinancialReport,
  sendPushNotification,
  getCommissionSettings,
  updateCommissionSettings,
  getCustomers,
  blockCustomer,
  unblockCustomer,
  getPromoCodes,
  createPromoCode,
  deactivatePromoCode,
  getAuditLogs,
  getFraudFlags,
  reportFraud,
  resolveFraudFlag,
};
