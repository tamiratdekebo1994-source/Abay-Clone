/**
 * Africa's Talking SMS / OTP Service
 * Ethiopia's most popular SMS gateway
 *
 * Sign up at: https://africastalking.com
 * Set env: AT_API_KEY, AT_USERNAME, AT_SENDER_ID
 *
 * OTP storage strategy:
 *   - When REDIS_URL is set: codes stored in Redis with TTL (faster, self-expiring)
 *   - Otherwise: codes stored in PostgreSQL via OtpCode table (fallback)
 */

const prisma = require('../config/database');
const { getRedis } = require('../config/redis');

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

const OTP_EXPIRY_SECONDS = 5 * 60;   // 5 minutes
const MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;

// ─── Redis-backed OTP storage ─────────────────────────────────────────────────

function redisKey(phone, purpose) {
  return `otp:${purpose}:${phone}`;
}

async function sendOtpViaRedis(phone, purpose, code) {
  const redis = getRedis();
  const key = redisKey(phone, purpose);
  // Store: code|attempts|createdAt
  await redis.set(key, `${code}|0|${Date.now()}`, 'EX', OTP_EXPIRY_SECONDS);
}

async function checkCooldownRedis(phone, purpose) {
  const redis = getRedis();
  const key = redisKey(phone, purpose);
  const raw = await redis.get(key);
  if (!raw) return null;
  const [, , createdAt] = raw.split('|');
  const elapsed = (Date.now() - parseInt(createdAt)) / 1000;
  if (elapsed < OTP_COOLDOWN_SECONDS) {
    return Math.ceil(OTP_COOLDOWN_SECONDS - elapsed);
  }
  return null;
}

async function verifyOtpViaRedis(phone, code, purpose) {
  const redis = getRedis();
  const key = redisKey(phone, purpose);
  const raw = await redis.get(key);

  if (!raw) {
    throw Object.assign(new Error('OTP expired or not found. Please request a new code.'), { statusCode: 400 });
  }

  const [storedCode, attemptsStr] = raw.split('|');
  const attempts = parseInt(attemptsStr);

  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    throw Object.assign(new Error('Too many failed attempts. Please request a new code.'), { statusCode: 429 });
  }

  if (storedCode !== code) {
    // Increment attempt counter (preserve TTL)
    const ttl = await redis.ttl(key);
    const [sc, , ts] = raw.split('|');
    await redis.set(key, `${sc}|${attempts + 1}|${ts}`, 'EX', ttl > 0 ? ttl : OTP_EXPIRY_SECONDS);
    const attemptsLeft = MAX_ATTEMPTS - (attempts + 1);
    throw Object.assign(new Error(`Invalid code. ${attemptsLeft} attempt(s) remaining.`), { statusCode: 400 });
  }

  await redis.del(key);
  return true;
}

// ─── DB-backed OTP storage (fallback) ────────────────────────────────────────

async function sendOtpViaDb(phone, purpose, code) {
  await prisma.otpCode.updateMany({
    where: { phone, purpose, isUsed: false },
    data: { isUsed: true },
  });
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
  await prisma.otpCode.create({ data: { phone, code, purpose, expiresAt } });
}

async function checkCooldownDb(phone, purpose) {
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      phone, purpose, isUsed: false,
      createdAt: { gte: new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!recentOtp) return null;
  return Math.ceil(
    (recentOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
  );
}

async function verifyOtpViaDb(phone, code, purpose) {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, isUsed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw Object.assign(new Error('OTP expired or not found. Please request a new code.'), { statusCode: 400 });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });

  if (otp.attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
    throw Object.assign(new Error('Too many failed attempts. Please request a new code.'), { statusCode: 429 });
  }

  if (otp.code !== code) {
    const attemptsLeft = MAX_ATTEMPTS - (otp.attempts + 1);
    throw Object.assign(new Error(`Invalid code. ${attemptsLeft} attempt(s) remaining.`), { statusCode: 400 });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
  return true;
}

// ─── Test phone numbers (always accept code 123456) ──────────────────────────

const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean)
);

function isTestPhone(phone) {
  return TEST_PHONES.has(phone);
}

// ─── Public API ───────────────────────────────────────────────────────────────

const sendOtp = async (phone, purpose = 'LOGIN') => {
  const useRedis = !!getRedis();

  // Test phone numbers always get code 123456, no cooldown, no SMS
  if (isTestPhone(phone)) {
    const code = '123456';
    if (useRedis) await sendOtpViaRedis(phone, purpose, code);
    else await sendOtpViaDb(phone, purpose, code);
    console.log(`[OTP TEST] Phone: ${phone} | Code: ${code} | Purpose: ${purpose}`);
    return { sent: true, expiresIn: OTP_EXPIRY_SECONDS };
  }

  // Cooldown check
  const secondsLeft = useRedis
    ? await checkCooldownRedis(phone, purpose)
    : await checkCooldownDb(phone, purpose);

  if (secondsLeft) {
    throw Object.assign(
      new Error(`Please wait ${secondsLeft} seconds before requesting a new code`),
      { statusCode: 429, secondsLeft }
    );
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  if (useRedis) {
    await sendOtpViaRedis(phone, purpose, code);
  } else {
    await sendOtpViaDb(phone, purpose, code);
  }

  // Send SMS
  const message = buildSmsMessage(code, purpose);
  let smsFailed = false;
  if (process.env.AT_API_KEY && process.env.AT_API_KEY !== 'sandbox' && process.env.NODE_ENV !== 'test') {
    try {
      const sms = getAT().SMS;
      await sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID || 'ETSPAR' });
    } catch (smsErr) {
      smsFailed = true;
      console.error(`[OTP] SMS send failed: ${smsErr.message}`);
      console.log(`\n[OTP DEV] Code for ${phone}: ${code}\n`);
    }
  } else {
    smsFailed = true;
    console.log(`\n[OTP DEV] Code for ${phone}: ${code}\n`);
  }

  return {
    sent: true,
    expiresIn: OTP_EXPIRY_SECONDS,
    // Return code in response when SMS is unavailable (no real SMS configured)
    ...(smsFailed && { devCode: code }),
  };
};

const verifyOtp = async (phone, code, purpose = 'LOGIN') => {
  if (getRedis()) {
    return verifyOtpViaRedis(phone, code, purpose);
  }
  return verifyOtpViaDb(phone, code, purpose);
};

const buildSmsMessage = (code, purpose) => {
  const purposeText = { REGISTER: 'registration', LOGIN: 'login', RESET: 'password reset' }[purpose] || 'verification';
  return `Your ET SPAR ${purposeText} code is: ${code}\nValid for ${OTP_EXPIRY_SECONDS / 60} minutes.\nDo not share this code.\n\nET SPAR Ethiopia`;
};

module.exports = { sendOtp, verifyOtp };
