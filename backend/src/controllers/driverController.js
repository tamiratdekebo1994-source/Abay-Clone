const prisma = require('../config/database');
const { calculateDistance } = require('../utils/pricing');

const registerDriver = async (req, res, next) => {
  try {
    const {
      licenseNumber, licenseExpiry, vehicleType, vehiclePlate,
      vehicleModel, vehicleColor, vehicleYear, city,
    } = req.body;

    const existing = await prisma.driver.findFirst({
      where: { userId: req.user.id },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Driver profile already exists' });
    }

    const driver = await prisma.driver.create({
      data: {
        userId: req.user.id,
        licenseNumber,
        licenseExpiry: new Date(licenseExpiry),
        vehicleType,
        vehiclePlate: vehiclePlate.toUpperCase(),
        vehicleModel,
        vehicleColor,
        vehicleYear: parseInt(vehicleYear),
        city,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Driver registration submitted. Awaiting approval.',
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

const getDriverProfile = async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { fullName: true, phone: true, email: true, avatarUrl: true } },
        earnings: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    res.json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    await prisma.driver.update({
      where: { userId: req.user.id },
      data: { currentLat: lat, currentLng: lng, lastLocationAt: new Date() },
    });

    // If driver has an active order, add tracking point
    const activeOrder = await prisma.order.findFirst({
      where: {
        driverId: driver.id,
        status: { in: ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'] },
      },
    });

    if (activeOrder) {
      await prisma.orderTracking.create({
        data: { orderId: activeOrder.id, lat, lng },
      });

      // Emit to socket room
      req.io?.to(`order:${activeOrder.id}`).emit('driver_location', { orderId: activeOrder.id, lat, lng });
    }

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    next(error);
  }
};

const toggleOnline = async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    if (driver.status === 'PENDING' || driver.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Driver account not approved' });
    }

    const newStatus = driver.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { status: newStatus },
    });

    res.json({ success: true, data: { status: updated.status } });
  } catch (error) {
    next(error);
  }
};

const getNearbyOrders = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver || driver.status !== 'ONLINE') {
      return res.status(403).json({ success: false, message: 'Driver must be online to see orders' });
    }

    // Get orders in SEARCHING_DRIVER status
    const orders = await prisma.order.findMany({
      where: { status: 'SEARCHING_DRIVER' },
      include: {
        store: { select: { storeName: true, address: true, city: true, lat: true, lng: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by distance if coordinates provided
    let filteredOrders = orders;
    if (lat && lng) {
      const driverLat = parseFloat(lat);
      const driverLng = parseFloat(lng);
      filteredOrders = orders.filter((order) => {
        const distance = calculateDistance(driverLat, driverLng, order.pickupLat, order.pickupLng);
        return distance <= parseFloat(radius);
      });
    }

    res.json({ success: true, data: filteredOrders });
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const { period = 'week' } = req.query;
    let startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (period === 'today') startDate.setHours(0, 0, 0, 0);

    const earnings = await prisma.earning.findMany({
      where: { driverId: driver.id, createdAt: { gte: startDate } },
      include: {
        order: {
          select: {
            orderNumber: true,
            deliveryAddress: true,
            deliveredAt: true,
            distanceKm: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = earnings.reduce((sum, e) => sum + e.amount, 0);
    const deliveries = earnings.length;

    res.json({
      success: true,
      data: {
        total,
        deliveries,
        earnings,
        currency: 'ETB',
        period,
        averagePerDelivery: deliveries > 0 ? total / deliveries : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerDriver,
  getDriverProfile,
  updateLocation,
  toggleOnline,
  getNearbyOrders,
  getEarnings,
};
