const { body, query } = require('express-validator');

const VEHICLE_TYPES = ['MOTORCYCLE', 'BAJAJ', 'CAR', 'VAN', 'TRUCK'];
const PLATFORMS = ['android', 'ios', 'web'];
const GENDERS = ['MALE', 'FEMALE'];
const LICENSE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'];

const register = [
  // Personal identity
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
  body('gender').optional().isIn(GENDERS).withMessage('Gender must be MALE or FEMALE'),
  body('nationalId').optional().trim().isLength({ max: 50 }),
  body('emergencyContactName').optional().trim().isLength({ max: 100 }),
  body('emergencyContactPhone').optional().trim().isLength({ max: 20 }),
  body('homeAddress').optional().trim().isLength({ max: 200 }),

  // License
  body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
  body('licenseExpiry').isISO8601().withMessage('License expiry must be a valid date (YYYY-MM-DD)'),
  body('licenseClass').optional().isIn(LICENSE_CLASSES).withMessage('Invalid license class'),

  // Vehicle
  body('vehicleType').isIn(VEHICLE_TYPES).withMessage(`Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`),
  body('vehicleMake').optional().trim().isLength({ max: 50 }),
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
