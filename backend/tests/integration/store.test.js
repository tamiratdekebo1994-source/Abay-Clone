/**
 * Store route integration tests
 * Tests register, profile (get/update), and dashboard endpoints.
 */
jest.mock('../../src/config/database', () => ({}));

process.env.JWT_SECRET = 'et-spark-driver-test-secret-32c';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../helpers/testApp');
const { storeToken, adminToken, driverToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');

const app = createApp();

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockStoreUser = {
  id: 'store-user-id',
  role: 'STORE',
  isActive: true,
  isVerified: true,
  driver: null,
  store: null,
};

const mockStore = {
  id: 'store-id',
  userId: 'store-user-id',
  storeName: 'Test Grocery',
  storeType: 'GROCERY',
  address: 'Bole Road',
  city: 'Addis Ababa',
  subcity: 'Bole',
  phone: '+251911234567',
  isVerified: false,
  _count: { orders: 3 },
};

const validStoreBody = {
  storeName: 'New Grocery',
  storeType: 'GROCERY',
  address: 'Bole Road near Edna Mall',
  city: 'Addis Ababa',
  phone: '+251911234567',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user = {
    findUnique: jest.fn().mockResolvedValue(mockStoreUser),
  };
  prisma.store = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  prisma.order = {
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null } }),
    findMany: jest.fn().mockResolvedValue([]),
  };
});

// ─── POST /api/store/register ─────────────────────────────────────────────────

describe('POST /api/store/register', () => {
  test('201 — creates store profile', async () => {
    prisma.store.findFirst.mockResolvedValue(null);
    prisma.store.create.mockResolvedValue(mockStore);

    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(validStoreBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(prisma.store.create).toHaveBeenCalledTimes(1);
  });

  test('409 — duplicate store profile', async () => {
    prisma.store.findFirst.mockResolvedValue(mockStore);

    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(validStoreBody);

    expect(res.status).toBe(409);
  });

  test('400 — missing storeName', async () => {
    const { storeName, ...body } = validStoreBody;
    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('storeName');
  });

  test('400 — invalid storeType', async () => {
    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ ...validStoreBody, storeType: 'NIGHTCLUB' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('storeType');
  });

  test('400 — invalid Ethiopian phone', async () => {
    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ ...validStoreBody, phone: '0911234567' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('phone');
  });

  test('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/store/register').send(validStoreBody);
    expect(res.status).toBe(401);
  });

  test('403 — driver cannot register store', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockStoreUser, role: 'DRIVER' });
    const res = await request(app)
      .post('/api/store/register')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(validStoreBody);

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/store/profile ───────────────────────────────────────────────────

describe('GET /api/store/profile', () => {
  test('200 — returns store profile', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);

    const res = await request(app)
      .get('/api/store/profile')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.storeName).toBe('Test Grocery');
  });

  test('404 — no store found', async () => {
    prisma.store.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/store/profile')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/store/profile ─────────────────────────────────────────────────

describe('PATCH /api/store/profile', () => {
  test('200 — updates store profile', async () => {
    const updated = { ...mockStore, storeName: 'Updated Grocery' };
    prisma.store.update.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/store/profile')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ storeName: 'Updated Grocery' });

    expect(res.status).toBe(200);
    expect(res.body.data.storeName).toBe('Updated Grocery');
  });

  test('400 — invalid storeType on update', async () => {
    const res = await request(app)
      .patch('/api/store/profile')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ storeType: 'INVALID_TYPE' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('storeType');
  });
});

// ─── GET /api/store/dashboard ────────────────────────────────────────────────

describe('GET /api/store/dashboard', () => {
  test('200 — returns dashboard stats', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);

    const res = await request(app)
      .get('/api/store/dashboard')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toHaveProperty('todayOrders');
    expect(res.body.data.stats).toHaveProperty('activeOrders');
    expect(res.body.data.stats).toHaveProperty('totalSpent');
  });

  test('404 — no store for this user', async () => {
    prisma.store.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/store/dashboard')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(404);
  });
});
