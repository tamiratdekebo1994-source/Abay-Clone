const { body } = require('express-validator');

const STORE_TYPES = ['GROCERY', 'PHARMACY', 'RESTAURANT', 'ELECTRONICS', 'CLOTHING', 'BAKERY', 'OTHER'];
const ETHIOPIAN_PHONE = /^\+251\d{9}$/;

const register = [
  body('storeName').trim().notEmpty().withMessage('Store name is required').isLength({ max: 100 }),
  body('storeType').isIn(STORE_TYPES).withMessage(`Store type must be one of: ${STORE_TYPES.join(', ')}`),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('phone')
    .optional()
    .matches(ETHIOPIAN_PHONE)
    .withMessage('Phone must be a valid Ethiopian number (+251XXXXXXXXX)'),
  body('subcity').optional().trim().isLength({ max: 100 }),
  body('woreda').optional().trim().isLength({ max: 50 }),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const updateProfile = [
  body('storeName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('storeType').optional().isIn(STORE_TYPES).withMessage(`Store type must be one of: ${STORE_TYPES.join(', ')}`),
  body('address').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('phone')
    .optional()
    .matches(ETHIOPIAN_PHONE)
    .withMessage('Phone must be a valid Ethiopian number (+251XXXXXXXXX)'),
  body('subcity').optional().trim().isLength({ max: 100 }),
  body('woreda').optional().trim().isLength({ max: 50 }),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const pushToken = [
  body('token').trim().notEmpty().withMessage('Push token is required'),
  body('platform').optional().isIn(['android', 'ios', 'web']),
];

module.exports = { register, updateProfile, pushToken };
