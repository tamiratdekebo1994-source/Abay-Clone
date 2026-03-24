const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createOrder, acceptOrder, updateOrderStatus,
  getOrderDetails, getMyOrders, cancelOrder, submitReview,
} = require('../controllers/orderController');

router.use(authenticate);

// Store routes
router.post('/', authorize('STORE'), createOrder);
router.post('/:orderId/cancel', authorize('STORE', 'ADMIN'), cancelOrder);
router.post('/:orderId/review', submitReview);

// Driver routes
router.post('/:orderId/accept', authorize('DRIVER'), acceptOrder);
router.patch('/:orderId/status', authorize('DRIVER'), updateOrderStatus);

// Shared routes
router.get('/', getMyOrders);
router.get('/:orderId', getOrderDetails);

module.exports = router;
