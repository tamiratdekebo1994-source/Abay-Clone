/**
 * Africa's Talking SMS / OTP Service
 * Ethiopia's most popular SMS gateway
 *
 * Sign up at: https://africastalking.com
 * Set env: AT_API_KEY, AT_USERNAME, AT_SENDER_ID
 */

const prisma = require('../config/database');

// Initialize Africa's Talking (lazy, only if keys present)
let AT = null;
const getAT = () => {
  if (!AT) {
    const AfricasTalking = require('africastalking');
    AT = AfricasTalking({
      apiKey: process.env.AT_API_KEY || 'sandbox',
      username: process.env.AT_USERNAME || 'sandbox',
    });
  }
  return AT;
};

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;

/**
 * Generate a 6-digit OTP, store it, and send via SMS
 */
const sendOtp = async (phone, purpose = 'LOGIN') => {
  // Check if a recent OTP was sent (cooldown)
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      isUsed: false,
      createdAt: { gte: new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentOtp) {
    const secondsLeft = Math.ceil(
      (recentOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
    );
    throw Object.assign(new Error(`Please wait ${secondsLeft} seconds before requesting a new code`), {
      statusCode: 429,
      secondsLeft,
    });
  }

  // Expire previous unused OTPs for this phone+purpose
  await prisma.otpCode.updateMany({
    where: { phone, purpose, isUsed: false },
    data: { isUsed: true },
  });

  // Generate code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { phone, code, purpose, expiresAt },
  });

  // Send SMS
  const message = buildSmsMessage(code, purpose);

  if (process.env.AT_API_KEY && process.env.AT_API_KEY !== 'sandbox' && process.env.NODE_ENV !== 'test') {
    try {
      const sms = getAT().SMS;
      await sms.send({
        to: [phone],
        message,
        from: process.env.AT_SENDER_ID || 'AbayDrvr',
      });
    } catch (smsErr) {
      console.error('[OTP] SMS send failed:', smsErr.message);
      // Don't fail — log the code for development
    }
  } else {
    // Development mode — log the code
    console.log(`\n[OTP DEV] Phone: ${phone} | Code: ${code} | Purpose: ${purpose}\n`);
  }

  return {
    sent: true,
    expiresIn: OTP_EXPIRY_MINUTES * 60,
    // Only include code in development
    ...(process.env.NODE_ENV === 'development' && { devCode: code }),
  };
};

/**
 * Verify an OTP code
 */
const verifyOtp = async (phone, code, purpose = 'LOGIN') => {
  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw Object.assign(new Error('OTP expired or not found. Please request a new code.'), {
      statusCode: 400,
    });
  }

  // Increment attempts
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  if (otp.attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
    throw Object.assign(new Error('Too many failed attempts. Please request a new code.'), {
      statusCode: 429,
    });
  }

  if (otp.code !== code) {
    const attemptsLeft = MAX_ATTEMPTS - (otp.attempts + 1);
    throw Object.assign(new Error(`Invalid code. ${attemptsLeft} attempt(s) remaining.`), {
      statusCode: 400,
    });
  }

  // Mark as used
  await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
  return true;
};

const buildSmsMessage = (code, purpose) => {
  const purposeText = {
    REGISTER: 'registration',
    LOGIN: 'login',
    RESET: 'password reset',
  }[purpose] || 'verification';

  return `Your Abay Driver ${purposeText} code is: ${code}\nValid for ${OTP_EXPIRY_MINUTES} minutes.\nDo not share this code.\n\nAbay Driver Ethiopia`;
};

module.exports = { sendOtp, verifyOtp };
