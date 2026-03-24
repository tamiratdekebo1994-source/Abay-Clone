const prisma = require('../config/database');

const registerStore = async (req, res, next) => {
  try {
    const { storeName, storeType, address, city, subcity, woreda, lat, lng, phone, description } = req.body;

    const existing = await prisma.store.findFirst({ where: { userId: req.user.id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Store profile already exists' });
    }

    const store = await prisma.store.create({
      data: {
        userId: req.user.id,
        storeName,
        storeType,
        address,
        city,
        subcity,
        woreda,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        phone,
        description,
      },
    });

    res.status(201).json({ success: true, message: 'Store registered successfully', data: store });
  } catch (error) {
    next(error);
  }
};

const getStoreProfile = async (req, res, next) => {
  try {
    const store = await prisma.store.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { fullName: true, phone: true, email: true } },
        _count: { select: { orders: true } },
      },
    });

    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

const updateStoreProfile = async (req, res, next) => {
  try {
    const { storeName, storeType, address, city, subcity, woreda, lat, lng, phone, description } = req.body;

    const store = await prisma.store.update({
      where: { userId: req.user.id },
      data: {
        ...(storeName && { storeName }),
        ...(storeType && { storeType }),
        ...(address && { address }),
        ...(city && { city }),
        ...(subcity !== undefined && { subcity }),
        ...(woreda !== undefined && { woreda }),
        ...(lat && { lat: parseFloat(lat) }),
        ...(lng && { lng: parseFloat(lng) }),
        ...(phone && { phone }),
        ...(description !== undefined && { description }),
      },
    });

    res.json({ success: true, message: 'Store updated successfully', data: store });
  } catch (error) {
    next(error);
  }
};

const getStoreDashboard = async (req, res, next) => {
  try {
    const store = await prisma.store.findUnique({ where: { userId: req.user.id } });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, activeOrders, completedOrders, totalSpent] = await Promise.all([
      prisma.order.count({ where: { storeId: store.id, createdAt: { gte: today } } }),
      prisma.order.count({
        where: {
          storeId: store.id,
          status: { in: ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'] },
        },
      }),
      prisma.order.count({ where: { storeId: store.id, status: 'DELIVERED' } }),
      prisma.order.aggregate({
        where: { storeId: store.id, status: 'DELIVERED' },
        _sum: { totalAmount: true },
      }),
    ]);

    const recentOrders = await prisma.order.findMany({
      where: { storeId: store.id },
      include: {
        driver: {
          select: {
            vehiclePlate: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        stats: {
          todayOrders,
          activeOrders,
          completedOrders,
          totalSpent: totalSpent._sum.totalAmount || 0,
          currency: 'ETB',
        },
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerStore, getStoreProfile, updateStoreProfile, getStoreDashboard };
