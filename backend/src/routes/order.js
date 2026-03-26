const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const orderValidators = require('../validators/order');
const {
  createOrder, acceptOrder, updateOrderStatus,
  getOrderDetails, getMyOrders, cancelOrder, submitReview,
} = require('../controllers/orderController');
const { calculateDeliveryFee, calculateDistance } = require('../utils/pricing');
const { getSurgeMultiplier } = require('../services/surgeService');
const prisma = require('../config/database');

router.use(authenticate);

// Store routes
router.post('/', authorize('STORE'), validate(orderValidators.createOrder), createOrder);
router.post('/:orderId/cancel', authorize('STORE', 'ADMIN', 'DRIVER'), validate(orderValidators.cancel), cancelOrder);
router.post('/:orderId/review', validate(orderValidators.review), submitReview);

// Driver routes
router.post('/:orderId/accept', authorize('DRIVER'), acceptOrder);
router.patch('/:orderId/status', authorize('DRIVER'), validate(orderValidators.updateStatus), updateOrderStatus);

// Fare estimate — called before order creation to show live price with surge
router.post('/estimate', authorize('STORE'), validate(orderValidators.estimate), async (req, res, next) => {
  try {
    const {
      pickupLat, pickupLng, deliveryLat, deliveryLng,
      isFragile = false, requiresRefrigeration = false,
    } = req.body;

    const store = await prisma.store.findUnique({ where: { userId: req.user.id } });
    const city = store?.city || 'Addis Ababa';
    const distanceKm = calculateDistance(
      parseFloat(pickupLat), parseFloat(pickupLng),
      parseFloat(deliveryLat), parseFloat(deliveryLng)
    );
    const surge = await getSurgeMultiplier(city);
    const fees = calculateDeliveryFee(distanceKm, {
      isFragile, requiresRefrigeration,
      surgeMultiplier: surge.multiplier,
    });

    res.json({
      success: true,
      data: {
        ...fees,
        surge: { multiplier: surge.multiplier, isSurge: surge.isSurge, reason: surge.reason },
      },
    });
  } catch (err) { next(err); }
});

// Shared routes
router.get('/', getMyOrders);
router.get('/:orderId', getOrderDetails);

module.exports = router;
