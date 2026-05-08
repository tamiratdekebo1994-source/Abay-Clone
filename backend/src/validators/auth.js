const { body } = require('express-validator');

// Ethiopian mobile numbers: +251 followed by 9 digits
const PHONE_RE = /^\+251\d{9}$/;

const phone = body('phone')
  .trim()
  .notEmpty().withMessage('Phone number is required')
  .matches(PHONE_RE).withMessage('Phone must be a valid Ethiopian number (e.g. +251911234567)');

const otpCode = body('code')
  .trim()
  .notEmpty().withMessage('OTP code is required')
  .matches(/^\d{6}$/).withMessage('OTP code must be exactly 6 digits');

module.exports = {
  login: [
    phone,
    body('password').notEmpty().withMessage('Password is required'),
  ],

  otpRequest: [
    phone,
    body('purpose')
      .isIn(['LOGIN', 'REGISTER'])
      .withMessage("purpose must be 'LOGIN' or 'REGISTER'"),
  ],

  otpVerify: [phone, otpCode],

  completeRegistration: [
    body('verificationToken').optional(),
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ max: 100 }).withMessage('Full name must be 100 characters or fewer'),
    body('role')
      .isIn(['DRIVER', 'STORE'])
      .withMessage("Role must be 'DRIVER' or 'STORE'"),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
  ],
};
