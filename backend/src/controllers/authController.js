const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { sendOtp, verifyOtp } = require('../services/otpService');

// ─── OTP FLOWS ────────────────────────────────────────────────────────────────

/**
 * Step 1: Send OTP to phone number
 * Works for both new registrations and existing user logins
 */
const requestOtp = async (req, res, next) => {
  try {
    const { phone, purpose = 'LOGIN' } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // For REGISTER purpose, check phone isn't already taken
    if (purpose === 'REGISTER') {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered. Please login instead.',
        });
      }
    }

    // For LOGIN purpose, verify phone exists
    if (purpose === 'LOGIN') {
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Phone number not registered. Please sign up first.',
        });
      }
    }

    const result = await sendOtp(phone, purpose);

    res.json({
      success: true,
      message: `Verification code sent to ${phone}`,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Step 2a: Verify OTP and login existing user
 */
const loginWithOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;

    await verifyOtp(phone, code, 'LOGIN');

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { driver: true, store: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Account not found or inactive' });
    }

    // Mark phone as verified
    if (!user.isVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, accessToken, refreshToken },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Step 2b: Verify OTP during registration — confirms phone ownership
 * Returns a short-lived verification token; actual account created in next step
 */
const verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    await verifyOtp(phone, code, 'REGISTER');

    // Issue a temporary token scoped to completing registration
    const verificationToken = generateAccessToken({ phone, scope: 'COMPLETE_REGISTRATION' });

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: { verificationToken, phone },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Step 3: Complete registration with verified phone token
 */
const completeRegistration = async (req, res, next) => {
  try {
    const { verificationToken, fullName, role, email } = req.body;

    // Verify the registration token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    if (decoded.scope !== 'COMPLETE_REGISTRATION') {
      return res.status(400).json({ success: false, message: 'Invalid token scope' });
    }

    if (!['DRIVER', 'STORE'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be DRIVER or STORE' });
    }

    const { phone } = decoded;

    // Check phone not already registered (race condition guard)
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const user = await prisma.user.create({
      data: {
        phone,
        email: email || null,
        passwordHash: '',  // OTP-only auth — no password required
        fullName,
        role,
        isVerified: true,
      },
      select: { id: true, phone: true, email: true, fullName: true, role: true, createdAt: true },
    });

    // Create wallet for drivers
    if (role === 'DRIVER') {
      // Wallet created when driver profile is registered
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};

// ─── PASSWORD FLOWS (legacy / admin use) ──────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { driver: true, store: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Admin accounts use password; regular users use OTP
    if (user.role !== 'ADMIN' && !user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'Please use OTP login for this account',
        useOtp: true,
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const decoded = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });

    if (!stored || stored.userId !== decoded.userId || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.delete({ where: { token } });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        driver: { include: { wallet: true } },
        store: true,
      },
    });
    const { passwordHash, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, email } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(email !== undefined && { email }),
      },
      select: { id: true, phone: true, email: true, fullName: true, role: true, avatarUrl: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  loginWithOtp,
  verifyRegistrationOtp,
  completeRegistration,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
};
