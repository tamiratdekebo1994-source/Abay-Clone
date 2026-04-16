/**
 * Auth route integration tests
 * Tests password login, OTP flow, token refresh, and /me endpoint.
 */
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/otpService');

process.env.JWT_SECRET = 'et-spark-driver-test-secret-32c';
process.env.JWT_REFRESH_SECRET = 'et-spark-driver-refresh-32chars';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createApp = require('../helpers/testApp');
const { adminToken, storeToken, expiredToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');
const { sendOtp, verifyOtp } = require('../../src/services/otpService');

const app = createApp();
const SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ADMIN_HASH = bcrypt.hashSync('Admin@1234', 10);

// ─── Shared mock users ────────────────────────────────────────────────────────

const mockAdmin = {
  id: 'admin-user-id',
  phone: '+251911000000',
  email: 'admin@etsparkdriver.et',
  fullName: 'Abay Admin',
  role: 'ADMIN',
  passwordHash: ADMIN_HASH,
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockStoreUser = {
  id: 'store-user-id',
  phone: '+251922000001',
  email: 'store@etsparkdriver.et',
  fullName: 'Store Owner',
  role: 'STORE',
  passwordHash: '',
  isActive: true,
  isVerified: true,
  driver: null,
  store: { id: 'store-id', storeName: 'Test Store' },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  prisma.user = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  prisma.refreshToken = {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  };

  // Default: /me uses the store user when the store token is presented
  prisma.user.findUnique.mockImplementation(({ where }) => {
    if (where?.id === 'admin-user-id') return Promise.resolve({ ...mockAdmin, driver: null, store: null });
    if (where?.id === 'store-user-id') return Promise.resolve({ ...mockStoreUser, driver: null, store: null });
    return Promise.resolve(null);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('admin logs in successfully with correct credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdmin);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251911000000', password: 'Admin@1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  test('does not return passwordHash in response', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdmin);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251911000000', password: 'Admin@1234' });

    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects wrong password with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdmin);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251911000000', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects unknown phone with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251999999999', password: 'anything' });

    expect(res.status).toBe(401);
  });

  test('rejects inactive account with 401', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockAdmin, isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251911000000', password: 'Admin@1234' });

    expect(res.status).toBe(401);
  });

  test('redirects OTP-only accounts (STORE/DRIVER) to OTP flow', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockStoreUser, passwordHash: '' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+251922000001', password: 'anything' });

    expect(res.status).toBe(400);
    expect(res.body.useOtp).toBe(true);
  });
});

// ─── OTP flow ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/otp/request', () => {
  test('sends OTP to existing user (LOGIN purpose)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockStoreUser);
    sendOtp.mockResolvedValue({ devCode: '123456' });

    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+251922000001', purpose: 'LOGIN' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendOtp).toHaveBeenCalledWith('+251922000001', 'LOGIN');
  });

  test('returns 404 for LOGIN attempt with unregistered phone', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+251999999999', purpose: 'LOGIN' });

    expect(res.status).toBe(404);
  });

  test('returns 409 for REGISTER attempt with already-registered phone', async () => {
    prisma.user.findUnique.mockResolvedValue(mockStoreUser);

    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+251922000001', purpose: 'REGISTER' });

    expect(res.status).toBe(409);
  });

  test('allows REGISTER for new phone', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // not yet registered
    sendOtp.mockResolvedValue({ devCode: '654321' });

    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+251955000099', purpose: 'REGISTER' });

    expect(res.status).toBe(200);
  });

  test('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ purpose: 'LOGIN' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/otp/verify-login', () => {
  test('issues tokens after valid OTP', async () => {
    verifyOtp.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ ...mockStoreUser, isVerified: false });
    prisma.user.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/otp/verify-login')
      .send({ phone: '+251922000001', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('marks phone as verified if not already', async () => {
    verifyOtp.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ ...mockStoreUser, isVerified: false });
    prisma.user.update.mockResolvedValue({});

    await request(app)
      .post('/api/auth/otp/verify-login')
      .send({ phone: '+251922000001', code: '123456' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isVerified: true } })
    );
  });

  test('returns error when OTP verification fails', async () => {
    const err = Object.assign(new Error('Invalid OTP code'), { statusCode: 400 });
    verifyOtp.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/otp/verify-login')
      .send({ phone: '+251922000001', code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/otp/verify-register', () => {
  test('returns a verificationToken on success', async () => {
    verifyOtp.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/otp/verify-register')
      .send({ phone: '+251955000099', code: '654321' });

    expect(res.status).toBe(200);
    expect(res.body.data.verificationToken).toBeDefined();
    expect(res.body.data.phone).toBe('+251955000099');
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('returns user profile with valid access token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('store-user-id');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  test('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.valid');
    expect(res.status).toBe(401);
  });

  test('returns 401 with expired token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken()}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('returns 401 when user not found in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${storeToken()}`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  test('issues new token pair for a valid refresh token', async () => {
    const refreshToken = jwt.sign({ userId: 'admin-user-id' }, REFRESH_SECRET, { expiresIn: '7d' });

    prisma.refreshToken.findUnique.mockResolvedValue({
      token: refreshToken,
      userId: 'admin-user-id',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-user-id', role: 'ADMIN', isActive: true,
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  test('returns 400 when no refresh token is provided', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  test('returns 401 for token not found in DB', async () => {
    const refreshToken = jwt.sign({ userId: 'admin-user-id' }, REFRESH_SECRET, { expiresIn: '7d' });
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  test('succeeds and revokes the refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'any-token-string' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'any-token-string' } });
  });

  test('succeeds even when no refresh token is provided', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});
