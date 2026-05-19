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

// Rate limit for OTP requests — test phone numbers bypass it entirely
const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean)
);
const otpRateLimit = makeRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  skip: (req) => TEST_PHONES.has(req.body?.phone),
  message: { success: false, message: 'Too many OTP requests. Please try again in 5 minutes.' },
});

// OTP flows
router.post('/otp/request', otpRateLimit, validate(authValidators.otpRequest), requestOtp);
router.post('/otp/verify-login', validate(authValidators.otpVerify), loginWithOtp);
router.post('/otp/verify-register', validate(authValidators.otpVerify), verifyRegistrationOtp);
// Pre-processor: generate verificationToken from phone (body or Firebase token)
router.use('/register/complete', async (req, res, next) => {
  if (req.body.verificationToken) return next();
  try {
    let phone = req.body.phone || null;
    if (!phone && req.headers.authorization && process.env.FIREBASE_API_KEY) {
      const token = req.headers.authorization.replace('Bearer ', '');
      const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + process.env.FIREBASE_API_KEY,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
      if (r.ok) { const d = await r.json(); phone = d.users?.[0]?.phoneNumber || null; }
    }
    if (phone) {
      const { generateAccessToken } = require('../config/jwt');
      req.body.verificationToken = generateAccessToken({ phone, scope: 'COMPLETE_REGISTRATION' });
    }
  } catch {}
  next();
});

router.post('/register/complete', validate(authValidators.completeRegistration), completeRegistration);

// Password login (admin)
router.post('/login', validate(authValidators.login), login);

// Token management
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Firebase provisioning — called once after first Firebase sign-in
router.post('/firebase/provision', provisionFirebaseUser);

// Simple provision endpoint — accepts phone directly in body (no Firebase Admin SDK needed)
router.post('/firebase/provision-simple', async (req, res) => {
  try {
    const prisma = require('../config/database');
    const { fullName, role, phone, email } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
    if (!fullName?.trim()) return res.status(400).json({ success: false, message: 'Full name is required' });
    if (!['DRIVER', 'STORE'].includes(role)) return res.status(400).json({ success: false, message: 'Role must be DRIVER or STORE' });
    const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
    if (existing) return res.status(409).json({ success: false, message: 'Account already exists. Please log in instead.' });
    const user = await prisma.user.create({
      data: { phone, email: email || null, passwordHash: '', fullName: fullName.trim(), role, isVerified: true },
      select: { id: true, phone: true, email: true, fullName: true, role: true, createdAt: true },
    });
    res.status(201).json({ success: true, message: 'Account created successfully', data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Protected
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

module.exports = router;
