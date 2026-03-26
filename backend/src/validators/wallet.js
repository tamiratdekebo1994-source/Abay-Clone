const { body } = require('express-validator');

const requestWithdrawal = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('amount must be a positive number'),
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('accountNumber is required'),
  body('method').optional().trim().isLength({ max: 50 }),
  body('accountName').optional().trim().isLength({ max: 100 }),
];

const processWithdrawal = [
  body('action')
    .optional()
    .isIn(['complete', 'fail'])
    .withMessage('action must be "complete" or "fail"'),
  body('status')
    .optional()
    .isIn(['COMPLETED', 'FAILED'])
    .withMessage('status must be "COMPLETED" or "FAILED"'),
  body('reference').optional().trim().isLength({ max: 200 }),
];

module.exports = { requestWithdrawal, processWithdrawal };
