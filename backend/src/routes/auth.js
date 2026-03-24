const express = require('express');
const router = express.Router();
const {
  requestOtp, loginWithOtp, verifyRegistrationOtp, completeRegistration,
  login, refreshToken, logout, getMe, updateProfile,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Tight rate limit for OTP requests
const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

// OTP flows
router.post('/otp/request', otpRateLimit, requestOtp);
router.post('/otp/verify-login', loginWithOtp);
router.post('/otp/verify-register', verifyRegistrationOtp);
router.post('/register/complete', completeRegistration);

// Password login (admin)
router.post('/login', login);

// Token management
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

module.exports = router;
