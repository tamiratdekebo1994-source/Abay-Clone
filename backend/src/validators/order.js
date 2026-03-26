const { body } = require('express-validator');

const PHONE_RE = /^\+251\d{9}$/;

const lat = (field) =>
  body(field)
    .notEmpty().withMessage(`${field} is required`)
    .isFloat({ min: -90, max: 90 }).withMessage(`${field} must be a valid latitude (-90 to 90)`);

const lng = (field) =>
  body(field)
    .notEmpty().withMessage(`${field} is required`)
    .isFloat({ min: -180, max: 180 }).withMessage(`${field} must be a valid longitude (-180 to 180)`);

const VALID_PAYMENT_METHODS = ['CASH', 'TELEBIRR', 'CBE_BIRR', 'AWASH_BANK', 'DASHEN_BANK'];

module.exports = {
  createOrder: [
    body('pickupAddress').trim().notEmpty().withMessage('Pickup address is required'),
    lat('pickupLat'),
    lng('pickupLng'),
    body('deliveryAddress').trim().notEmpty().withMessage('Delivery address is required'),
    lat('deliveryLat'),
    lng('deliveryLng'),
    body('recipientName').trim().notEmpty().withMessage('Recipient name is required'),
    body('recipientPhone')
      .notEmpty().withMessage('Recipient phone is required')
      .matches(PHONE_RE).withMessage('Recipient phone must be a valid Ethiopian number'),
    body('paymentMethod')
      .optional()
      .isIn(VALID_PAYMENT_METHODS)
      .withMessage(`Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`),
    body('weight')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  ],

  estimate: [
    lat('pickupLat'),
    lng('pickupLng'),
    lat('deliveryLat'),
    lng('deliveryLng'),
  ],

  // Driver status transitions: the valid set of values the driver may submit
  updateStatus: [
    body('status')
      .isIn(['DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
      .withMessage('status must be a valid order status'),
  ],

  cancel: [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('reason must be 500 characters or fewer'),
  ],

  review: [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('rating must be an integer between 1 and 5'),
    body('comment')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('comment must be 500 characters or fewer'),
  ],
};
