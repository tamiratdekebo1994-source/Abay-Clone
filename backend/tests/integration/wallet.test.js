/**
 * Wallet route integration tests
 * Tests driver wallet balance, withdrawal request, admin pending list,
 * and admin withdrawal processing.
 */
jest.mock('../../src/config/database', () => ({}));

process.env.JWT_SECRET = 'fetno-test-secret-key-32chars';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../helpers/testApp');
const { driverToken, adminToken, storeToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');

const app = createApp();

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockDriverUser = {
  id: 'driver-user-id',
  role: 'DRIVER',
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockAdminUser = {
  id: 'admin-user-id',
  role: 'ADMIN',
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockDriver = { id: 'driver-id', userId: 'driver-user-id', status: 'OFFLINE' };

const mockWallet = {
  id: 'wallet-id',
  driverId: 'driver-id',
  balance: 1000,
  pendingBalance: 0,
  totalEarned: 5000,
  withdrawals: [],
};

const mockWithdrawal = {
  id: 'withdrawal-id',
  walletId: 'wallet-id',
  amount: 500,
  method: 'CBE',
  accountNumber: '1000123456789',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user = { findUnique: jest.fn() };
  prisma.driver = { findUnique: jest.fn() };
  prisma.wallet = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };
  prisma.walletWithdrawal = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  prisma.$transaction = jest.fn();
});

// ─── GET /api/wallet ──────────────────────────────────────────────────────────

describe('GET /api/wallet', () => {
  test('200 — returns wallet with withdrawals', async () => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.wallet.findUnique.mockResolvedValue(mockWallet);

    const res = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(1000);
  });

  test('200 — auto-creates wallet if missing', async () => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.wallet.findUnique.mockResolvedValue(null);
    prisma.wallet.create.mockResolvedValue({ ...mockWallet, balance: 0 });

    const res = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.wallet.create).toHaveBeenCalledTimes(1);
  });

  test('404 — driver profile not found', async () => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);
    prisma.driver.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(404);
  });

  test('403 — store user cannot access driver wallet', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockDriverUser, role: 'STORE' });

    const res = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/wallet/withdraw ────────────────────────────────────────────────

describe('POST /api/wallet/withdraw', () => {
  const validBody = { amount: 500, accountNumber: '1000123456789', method: 'CBE' };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.wallet.findUnique.mockResolvedValue(mockWallet);
    prisma.walletWithdrawal.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([mockWithdrawal, mockWallet]);
  });

  test('201 — creates withdrawal and deducts balance', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(500);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('400 — amount exceeds balance', async () => {
    prisma.wallet.findUnique.mockResolvedValue({ ...mockWallet, balance: 100 });

    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ ...validBody, amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  test('409 — pending withdrawal already exists', async () => {
    prisma.walletWithdrawal.findFirst.mockResolvedValue(mockWithdrawal);

    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/pending/i);
  });

  test('400 — validator rejects zero amount', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ ...validBody, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('amount');
  });

  test('400 — validator rejects missing accountNumber', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('accountNumber');
  });
});

// ─── GET /api/wallet/pending (admin) ─────────────────────────────────────────

describe('GET /api/wallet/pending', () => {
  test('200 — admin gets pending withdrawals', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.walletWithdrawal.findMany.mockResolvedValue([mockWithdrawal]);

    const res = await request(app)
      .get('/api/wallet/pending')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('403 — driver cannot access pending withdrawals', async () => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);

    const res = await request(app)
      .get('/api/wallet/pending')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/wallet/:id/process (admin) ───────────────────────────────────

describe('PATCH /api/wallet/:id/process', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.walletWithdrawal.findUnique.mockResolvedValue({
      ...mockWithdrawal,
      wallet: mockWallet,
    });
    prisma.$transaction.mockResolvedValue([]);
  });

  test('200 — admin completes withdrawal', async () => {
    const res = await request(app)
      .patch('/api/wallet/withdrawal-id/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'complete', reference: 'TX-001' });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('200 — admin fails withdrawal', async () => {
    const res = await request(app)
      .patch('/api/wallet/withdrawal-id/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'fail' });

    expect(res.status).toBe(200);
  });

  test('400 — validator rejects unknown action', async () => {
    const res = await request(app)
      .patch('/api/wallet/withdrawal-id/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('action');
  });

  test('403 — driver cannot process withdrawals', async () => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);

    const res = await request(app)
      .patch('/api/wallet/withdrawal-id/process')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ action: 'complete' });

    expect(res.status).toBe(403);
  });
});
