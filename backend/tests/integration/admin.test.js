/**
 * Admin route integration tests
 * Tests dashboard stats, driver management, store listing, order listing,
 * and surge pricing endpoints.
 */
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/surgeService');

process.env.JWT_SECRET = 'abay-driver-test-secret-key-32chars';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../helpers/testApp');
const { adminToken, storeToken, driverToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');
const { getSurgeMultiplier, setManualSurge } = require('../../src/services/surgeService');

const app = createApp();

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockAdminUser = {
  id: 'admin-user-id',
  role: 'ADMIN',
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockDriverUser = {
  id: 'driver-user-id',
  role: 'DRIVER',
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockDriver = {
  id: 'driver-id',
  userId: 'some-user-id',
  status: 'PENDING',
  user: { fullName: 'Test Driver', phone: '+251911111111' },
};

const mockSurge = { multiplier: 1.0, isSurge: false, reason: null };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user = { findUnique: jest.fn() };
  prisma.driver = {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  };
  prisma.store = {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  };
  prisma.order = {
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { platformFee: null } }),
    findMany: jest.fn().mockResolvedValue([]),
  };
  prisma.notification = { create: jest.fn().mockResolvedValue({}) };
  prisma.zone = { findFirst: jest.fn().mockResolvedValue(null) };

  getSurgeMultiplier.mockResolvedValue(mockSurge);
  setManualSurge.mockResolvedValue(undefined);
});

// ─── Auth guard — all admin routes require ADMIN role ────────────────────────

describe('Admin route auth guards', () => {
  const adminRoutes = [
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/drivers'],
    ['GET', '/api/admin/stores'],
    ['GET', '/api/admin/orders'],
    ['GET', '/api/admin/surge'],
  ];

  test.each(adminRoutes)('%s %s returns 401 without token', async (method, path) => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
  });

  test.each(adminRoutes)('%s %s returns 403 for DRIVER role', async (method, path) => {
    prisma.user.findUnique.mockResolvedValue(mockDriverUser);
    const res = await request(app)
      [method.toLowerCase()](path)
      .set('Authorization', `Bearer ${driverToken()}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────

describe('GET /api/admin/dashboard', () => {
  test('200 — returns aggregated stats', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.driver.count.mockResolvedValue(10);
    prisma.store.count.mockResolvedValue(5);
    prisma.order.count.mockResolvedValue(100);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('drivers');
    expect(res.body.data).toHaveProperty('stores');
    expect(res.body.data).toHaveProperty('orders');
  });
});

// ─── GET /api/admin/drivers ───────────────────────────────────────────────────

describe('GET /api/admin/drivers', () => {
  test('200 — returns paginated driver list', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.driver.findMany.mockResolvedValue([mockDriver]);
    prisma.driver.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/drivers')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.drivers).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  test('200 — filters drivers by status param', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.driver.findMany.mockResolvedValue([]);
    prisma.driver.count.mockResolvedValue(0);

    await request(app)
      .get('/api/admin/drivers?status=PENDING')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(prisma.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } })
    );
  });
});

// ─── PATCH /api/admin/drivers/:driverId/status ───────────────────────────────

describe('PATCH /api/admin/drivers/:driverId/status', () => {
  test('200 — approves driver', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.driver.update.mockResolvedValue({ ...mockDriver, status: 'OFFLINE' });

    const res = await request(app)
      .patch('/api/admin/drivers/driver-id/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OFFLINE' } })
    );
  });

  test('200 — suspends driver', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.driver.update.mockResolvedValue({ ...mockDriver, status: 'SUSPENDED' });

    const res = await request(app)
      .patch('/api/admin/drivers/driver-id/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'suspend' });

    expect(res.status).toBe(200);
    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUSPENDED' } })
    );
  });

  test('400 — validator rejects unknown action', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);

    const res = await request(app)
      .patch('/api/admin/drivers/driver-id/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ action: 'delete' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('action');
  });
});

// ─── GET /api/admin/stores ────────────────────────────────────────────────────

describe('GET /api/admin/stores', () => {
  test('200 — returns paginated store list', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.store.findMany.mockResolvedValue([{ id: 'store-id', storeName: 'Test Store' }]);
    prisma.store.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/stores')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stores).toHaveLength(1);
  });
});

// ─── GET /api/admin/orders ────────────────────────────────────────────────────

describe('GET /api/admin/orders', () => {
  test('200 — returns all orders paginated', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);
    prisma.order.findMany.mockResolvedValue([{ id: 'order-id' }]);
    prisma.order.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });
});

// ─── GET /api/admin/surge ─────────────────────────────────────────────────────

describe('GET /api/admin/surge', () => {
  test('200 — returns surge info for all cities', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);

    const res = await request(app)
      .get('/api/admin/surge')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(getSurgeMultiplier).toHaveBeenCalled();
  });
});

// ─── POST /api/admin/surge ────────────────────────────────────────────────────

describe('POST /api/admin/surge', () => {
  test('200 — sets surge multiplier', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);

    const res = await request(app)
      .post('/api/admin/surge')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ city: 'Addis Ababa', multiplier: 1.5 });

    expect(res.status).toBe(200);
    expect(setManualSurge).toHaveBeenCalledWith('Addis Ababa', 1.5);
  });

  test('400 — validator rejects missing city', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);

    const res = await request(app)
      .post('/api/admin/surge')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ multiplier: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('city');
  });

  test('400 — validator rejects multiplier above 10', async () => {
    prisma.user.findUnique.mockResolvedValue(mockAdminUser);

    const res = await request(app)
      .post('/api/admin/surge')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ city: 'Addis Ababa', multiplier: 15 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('multiplier');
  });
});
