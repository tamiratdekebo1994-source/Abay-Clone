const prisma = require('../config/database');
const { calculateDeliveryFee, calculateDistance } = require('../utils/pricing');
const pushService = require('../services/pushNotificationService');
const { getSurgeMultiplier } = require('../services/surgeService');

const createOrder = async (req, res, next) => {
  try {
    const {
      pickupAddress, pickupLat, pickupLng, pickupNotes,
      deliveryAddress, deliveryLat, deliveryLng, deliveryNotes,
      recipientName, recipientPhone,
      description, weight, isFragile, requiresRefrigeration,
      paymentMethod,
    } = req.body;

    const store = await prisma.store.findUnique({ where: { userId: req.user.id } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store profile not found' });
    }

    const distanceKm = calculateDistance(
      parseFloat(pickupLat), parseFloat(pickupLng),
      parseFloat(deliveryLat), parseFloat(deliveryLng)
    );

    // Apply surge pricing
    const surge = await getSurgeMultiplier(store.city);
    const fees = calculateDeliveryFee(distanceKm, {
      isFragile, requiresRefrigeration,
      surgeMultiplier: surge.multiplier,
    });

    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        status: 'SEARCHING_DRIVER',
        pickupAddress, pickupLat: parseFloat(pickupLat), pickupLng: parseFloat(pickupLng),
        pickupNotes,
        deliveryAddress, deliveryLat: parseFloat(deliveryLat), deliveryLng: parseFloat(deliveryLng),
        deliveryNotes,
        recipientName, recipientPhone,
        description,
        weight: weight ? parseFloat(weight) : null,
        isFragile: Boolean(isFragile),
        requiresRefrigeration: Boolean(requiresRefrigeration),
        distanceKm: fees.distanceKm,
        baseFee: fees.baseFee,
        driverFee: fees.driverFee,
        platformFee: fees.platformFee,
        totalAmount: fees.totalAmount,
        paymentMethod,
      },
      include: {
        store: { select: { storeName: true, address: true } },
      },
    });

    // Notify nearby online drivers via socket
    req.io?.emit('new_order_available', {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      pickupAddress: order.pickupAddress,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      deliveryAddress: order.deliveryAddress,
      driverFee: order.driverFee,
      distanceKm: order.distanceKm,
      isFragile: order.isFragile,
      requiresRefrigeration: order.requiresRefrigeration,
      store: order.store,
    });

    // Push notification to online drivers
    pushService.notifyNearbyDrivers(order).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Order created and searching for driver',
      data: { ...order, surge: { isSurge: surge.isSurge, multiplier: surge.multiplier, reason: surge.reason } },
    });
  } catch (error) {
    next(error);
  }
};

const acceptOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });

    if (!driver || driver.status !== 'ONLINE') {
      return res.status(403).json({ success: false, message: 'Driver must be online' });
    }

    // Check if driver already has an active order
    const activeOrder = await prisma.order.findFirst({
      where: {
        driverId: driver.id,
        status: { in: ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'] },
      },
    });

    if (activeOrder) {
      return res.status(409).json({ success: false, message: 'You already have an active delivery' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'SEARCHING_DRIVER') {
      return res.status(404).json({ success: false, message: 'Order not available' });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: driver.id,
        status: 'DRIVER_ASSIGNED',
        driverAssignedAt: new Date(),
      },
      include: {
        store: { select: { storeName: true, address: true, lat: true, lng: true, phone: true } },
      },
    });

    await prisma.driver.update({
      where: { id: driver.id },
      data: { status: 'BUSY' },
    });

    // Notify store via socket + push
    req.io?.to(`store:${order.storeId}`).emit('driver_assigned', {
      orderId: order.id,
      driver: { id: driver.id, name: req.user.fullName },
    });

    pushService.notifyDriverAssigned(
      order.store?.user?.id || (await prisma.store.findUnique({ where: { id: order.storeId }, select: { userId: true } }))?.userId,
      req.user.fullName,
      order.orderNumber
    ).catch(console.error);

    res.json({ success: true, message: 'Order accepted', data: updated });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true },
    });

    if (!order || order.driverId !== driver?.id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this order' });
    }

    const validTransitions = {
      DRIVER_ASSIGNED: ['DRIVER_AT_STORE', 'CANCELLED'],
      DRIVER_AT_STORE: ['PICKED_UP'],
      PICKED_UP: ['IN_TRANSIT'],
      IN_TRANSIT: ['DELIVERED'],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status transition from ${order.status} to ${status}` });
    }

    const updateData = { status };
    if (status === 'PICKED_UP') updateData.pickedUpAt = new Date();
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();

      // Create earning and update wallet in a transaction
      await prisma.$transaction(async (tx) => {
        // Earning record
        await tx.earning.create({
          data: { driverId: driver.id, orderId: order.id, amount: order.driverFee },
        });

        // Update driver stats
        await tx.driver.update({
          where: { id: driver.id },
          data: {
            totalDeliveries: { increment: 1 },
            totalEarnings: { increment: order.driverFee },
            status: 'ONLINE',
          },
        });

        // Credit driver wallet
        const wallet = await tx.wallet.findUnique({ where: { driverId: driver.id } });
        if (wallet) {
          await tx.wallet.update({
            where: { driverId: driver.id },
            data: { balance: { increment: order.driverFee } },
          });
        } else {
          await tx.wallet.create({
            data: { driverId: driver.id, balance: order.driverFee },
          });
        }

        // Update store stats
        await tx.store.update({
          where: { id: order.storeId },
          data: { totalOrders: { increment: 1 } },
        });
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Notify store and order room via socket
    req.io?.to(`store:${order.storeId}`).emit('order_status_updated', { orderId, status });
    req.io?.to(`order:${orderId}`).emit('order_status_updated', { orderId, status });

    // Push notification to store owner
    const storeOwner = await prisma.store.findUnique({ where: { id: order.storeId }, select: { userId: true } });
    if (storeOwner) {
      pushService.notifyOrderStatus(storeOwner.userId, status, order.orderNumber).catch(console.error);
    }

    res.json({ success: true, message: `Order status updated to ${status}`, data: updated });
  } catch (error) {
    next(error);
  }
};

const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { storeName: true, address: true, city: true, lat: true, lng: true, phone: true } },
        driver: {
          select: {
            vehiclePlate: true, vehicleModel: true, vehicleColor: true, vehicleType: true,
            rating: true, totalDeliveries: true, currentLat: true, currentLng: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        tracking: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check access
    const isDriver = req.user.role === 'DRIVER';
    const isStore = req.user.role === 'STORE';
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin) {
      if (isDriver) {
        const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
        if (order.driverId && order.driverId !== driver?.id) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (isStore) {
        const store = await prisma.store.findUnique({ where: { userId: req.user.id } });
        if (order.storeId !== store?.id) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};
    if (req.user.role === 'STORE') {
      const store = await prisma.store.findUnique({ where: { userId: req.user.id } });
      where.storeId = store?.id;
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
      where.driverId = driver?.id;
    }

    if (status) {
      where.status = status.includes(',')
        ? { in: status.split(',').map((s) => s.trim()) }
        : status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          store: { select: { storeName: true, city: true } },
          driver: {
            select: {
              vehiclePlate: true,
              user: { select: { fullName: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const cancellableStatuses = ['PENDING', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });

    // If driver was assigned, set them back to online
    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { status: 'ONLINE' },
      });
    }

    req.io?.to(`order:${orderId}`).emit('order_cancelled', { orderId, reason });

    res.json({ success: true, message: 'Order cancelled', data: updated });
  } catch (error) {
    next(error);
  }
};

const submitReview = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { rating, comment } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true },
    });

    if (!order || order.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Can only review completed deliveries' });
    }

    if (order.review) {
      return res.status(409).json({ success: false, message: 'Review already submitted' });
    }

    const review = await prisma.review.create({
      data: {
        orderId,
        driverId: order.driverId,
        storeId: order.storeId,
        rating: parseInt(rating),
        comment,
      },
    });

    // Update driver rating
    if (order.driverId) {
      const driverReviews = await prisma.review.aggregate({
        where: { driverId: order.driverId },
        _avg: { rating: true },
      });
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { rating: driverReviews._avg.rating || 0 },
      });
    }

    res.status(201).json({ success: true, message: 'Review submitted', data: review });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  acceptOrder,
  updateOrderStatus,
  getOrderDetails,
  getMyOrders,
  cancelOrder,
  submitReview,
};
