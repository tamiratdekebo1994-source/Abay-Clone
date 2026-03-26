const { body, query } = require('express-validator');

const VEHICLE_TYPES = ['MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN', 'TRUCK'];
const PLATFORMS = ['android', 'ios', 'web'];

const register = [
  body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
  body('licenseExpiry').isISO8601().withMessage('License expiry must be a valid date (YYYY-MM-DD)'),
  body('vehicleType').isIn(VEHICLE_TYPES).withMessage(`Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`),
  body('vehiclePlate').trim().notEmpty().withMessage('Vehicle plate is required'),
  body('vehicleModel').optional().trim().isLength({ max: 100 }),
  body('vehicleColor').optional().trim().isLength({ max: 50 }),
  body('vehicleYear')
    .optional()
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
    .withMessage('Vehicle year must be between 1990 and next year'),
  body('city').trim().notEmpty().withMessage('City is required'),
];

const location = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a number between -90 and 90'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a number between -180 and 180'),
];

const pushToken = [
  body('token').trim().notEmpty().withMessage('Push token is required'),
  body('platform').optional().isIn(PLATFORMS).withMessage(`platform must be one of: ${PLATFORMS.join(', ')}`),
];

module.exports = { register, location, pushToken };
