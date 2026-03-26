/**
 * Public order tracking — no authentication required.
 * Returns only the fields needed for the customer-facing tracking page.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { makeRateLimiter } = require('../utils/rateLimiter');

// 60 lookups per IP per 15 minutes — generous for real customers, protective against scrapers
const trackLimit = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests, please slow down' },
});

router.get('/:orderId', trackLimit, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        deliveryAddress: true,
        deliveryLat: true,
        deliveryLng: true,
        distanceKm: true,
        totalAmount: true,
        createdAt: true,
        deliveredAt: true,
        cargoPhotoUrl: true,
        store: { select: { storeName: true, city: true } },
        driver: {
          select: {
            currentLat: true,
            currentLng: true,
            vehicleModel: true,
            vehicleColor: true,
            vehiclePlate: true,
            rating: true,
            totalDeliveries: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

module.exports = router;
