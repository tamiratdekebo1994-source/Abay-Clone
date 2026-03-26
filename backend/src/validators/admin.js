const { body } = require('express-validator');

const approveDriver = [
  body('action')
    .isIn(['approve', 'suspend'])
    .withMessage('action must be "approve" or "suspend"'),
];

const surge = [
  body('city').trim().notEmpty().withMessage('city is required'),
  body('multiplier')
    .isFloat({ min: 1.0, max: 10.0 })
    .withMessage('multiplier must be a number between 1.0 and 10.0'),
];

module.exports = { approveDriver, surge };
