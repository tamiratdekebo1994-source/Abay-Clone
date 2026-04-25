const express = require('express');
const router = express.Router();
const {
  requestOtp, loginWithOtp, verifyRegistrationOtp, completeRegistration,
  login, refreshToken, logout, getMe, updateProfile, provisionFirebaseUser,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const authValidators = require('../validators/auth');
const { makeRateLimiter } = require('../utils/rateLimiter');

// Tight rate limit for OTP requests (Redis-backed when available)
const otpRateLimit = makeRateLimiter({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

// OTP flows
router.post('/otp/request', otpRateLimit, validate(authValidators.otpRequest), requestOtp);
router.post('/otp/verify-login', validate(authValidators.otpVerify), loginWithOtp);
router.post('/otp/verify-register', validate(authValidators.otpVerify), verifyRegistrationOtp);
router.post('/register/complete', validate(authValidators.completeRegistration), completeRegistration);

// Password login (admin)
router.post('/login', validate(authValidators.login), login);

// Token management
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Firebase provisioning — called once after first Firebase sign-in
router.post('/firebase/provision', provisionFirebaseUser);

// Protected
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

module.exports = router;
