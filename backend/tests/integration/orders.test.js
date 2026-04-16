/**
 * Order route integration tests
 * Tests create, list, cancel, accept, and status-update flows.
 */
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/surgeService');
jest.mock('../../src/services/pushNotificationService', () => ({
  notifyNearbyDrivers: jest.fn().mockResolvedValue(undefined),
  notifyDriverAssigned: jest.fn().mockResolvedValue(undefined),
  notifyOrderStatus: jest.fn().mockResolvedValue(undefined),
}));

process.env.JWT_SECRET = 'et-spark-driver-test-secret-32c';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../helpers/testApp');
const { storeToken, driverToken, adminToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');
const { getSurgeMultiplier } = require('../../src/services/surgeService');

const app = createApp();

// ─── Shared mock data ─────────────────────────────────────────────────────────

const mockStoreUser = {
  id: 'store-user-id',
  role: 'STORE',
  isActive: true,
  isVerified: true,
  driver: null,
  store: { id: 'store-id' },
};

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

const mockStore = {
  id: 'store-id',
  storeName: 'Test Store',
  city: 'Addis Ababa',
  userId: 'store-user-id',
};

const mockOnlineDriver = {
  id: 'driver-id',
  userId: 'driver-user-id',
  status: 'ONLINE',
};

const mockOfflineDriver = {
  id: 'driver-id',
  userId: 'driver-user-id',
  status: 'OFFLINE',
};

const mockOrder = {
  id: 'order-id',
  storeId: 'store-id',
  driverId: null,
  status: 'SEARCHING_DRIVER',
  orderNumber: 'ORD-001',
  pickupAddress: '123 Pickup St',
  pickupLat: 9.0121,
  pickupLng: 38.7468,
  deliveryAddress: '456 Delivery Ave',
  deliveryLat: 8.9946,
  deliveryLng: 38.7906,
  recipientName: 'John Doe',
  recipientPhone: '+251911111111',
  driverFee: 50,
  platformFee: 10,
  totalAmount: 60,
  distanceKm: 5.2,
  baseFee: 30,
  store: { storeName: 'Test Store', address: '1 Main St' },
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
  prisma.store = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  prisma.driver = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn(),
  };
  prisma.order = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn(),
  };
  prisma.orderTracking = { create: jest.fn().mockResolvedValue({}) };
  prisma.earning = { findMany: jest.fn(), create: jest.fn().mockResolvedValue({}) };
  prisma.wallet = {
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
  prisma.review = { create: jest.fn(), aggregate: jest.fn() };
  prisma.$transaction = jest.fn(async (opsOrFn) => {
    if (typeof opsOrFn === 'function') return opsOrFn(prisma);
    return Promise.all(opsOrFn);
  });

  // authenticate middleware: return the right user based on userId in token
  prisma.user.findUnique.mockImplementation(({ where }) => {
    if (where?.id === 'store-user-id') return Promise.resolve(mockStoreUser);
    if (where?.id === 'driver-user-id') return Promise.resolve(mockDriverUser);
    if (where?.id === 'admin-user-id') return Promise.resolve(mockAdminUser);
    return Promise.resolve(null);
  });

  // Default surge: no surge
  getSurgeMultiplier.mockResolvedValue({ multiplier: 1.0, isSurge: false, reason: null });
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  const orderBody = {
    pickupAddress: '123 Pickup St',
    pickupLat: 9.0121,
    pickupLng: 38.7468,
    pickupNotes: 'Ring the bell',
    deliveryAddress: '456 Delivery Ave',
    deliveryLat: 8.9946,
    deliveryLng: 38.7906,
    recipientName: 'John Doe',
    recipientPhone: '+251911111111',
    description: 'Documents',
    paymentMethod: 'CASH',
  };

  test('store creates order and gets 201 with order data', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    prisma.order.create.mockResolvedValue({ ...mockOrder, store: { storeName: 'Test Store', address: '1 Main St' } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(orderBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('order-id');
    expect(res.body.data.status).toBe('SEARCHING_DRIVER');
    expect(res.body.data.surge).toBeDefined();
  });

  test('driver cannot create an order — returns 403', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(orderBody);

    expect(res.status).toBe(403);
  });

  test('returns 401 with no authorization header', async () => {
    const res = await request(app).post('/api/orders').send(orderBody);
    expect(res.status).toBe(401);
  });

  test('returns 404 when store profile does not exist', async () => {
    prisma.store.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(orderBody);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('applies surge multiplier from surgeService', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    getSurgeMultiplier.mockResolvedValue({ multiplier: 1.4, isSurge: true, reason: 'Evening rush hour' });
    prisma.order.create.mockResolvedValue({ ...mockOrder, store: { storeName: 'Test Store', address: '1 Main St' } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(orderBody);

    expect(res.status).toBe(201);
    expect(res.body.data.surge.isSurge).toBe(true);
    expect(res.body.data.surge.multiplier).toBe(1.4);
  });
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  test('store user gets their own orders with pagination', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('status query with comma-separated values passes { in: [...] } to Prisma', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    await request(app)
      .get('/api/orders?status=SEARCHING_DRIVER,DRIVER_ASSIGNED')
      .set('Authorization', `Bearer ${storeToken()}`);

    const findManyCall = prisma.order.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toEqual({ in: ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'] });
  });

  test('single status value passes a plain string to Prisma (not an array)', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    await request(app)
      .get('/api/orders?status=DELIVERED')
      .set('Authorization', `Bearer ${storeToken()}`);

    const findManyCall = prisma.order.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe('DELIVERED');
  });

  test('driver user gets their own orders filtered by driverId', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${driverToken()}`);

    const findManyCall = prisma.order.findMany.mock.calls[0][0];
    expect(findManyCall.where.driverId).toBe('driver-id');
  });

  test('returns 401 with no token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/orders/:orderId/cancel ─────────────────────────────────────────

describe('POST /api/orders/:orderId/cancel', () => {
  test('store can cancel a SEARCHING_DRIVER order', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'SEARCHING_DRIVER' });
    prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });

    const res = await request(app)
      .post('/api/orders/order-id/cancel')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    );
  });

  test('returns 400 when trying to cancel an IN_TRANSIT order', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'IN_TRANSIT' });

    const res = await request(app)
      .post('/api/orders/order-id/cancel')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when trying to cancel a DELIVERED order', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'DELIVERED' });

    const res = await request(app)
      .post('/api/orders/order-id/cancel')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/orders/nonexistent-id/cancel')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({});

    expect(res.status).toBe(404);
  });

  test('sets driver back to ONLINE when cancelling an assigned order', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'DRIVER_ASSIGNED', driverId: 'driver-id' });
    prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });

    await request(app)
      .post('/api/orders/order-id/cancel')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({});

    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ONLINE' } })
    );
  });

  test('driver can cancel a DRIVER_ASSIGNED order', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'DRIVER_ASSIGNED', driverId: 'driver-id' });
    prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });

    const res = await request(app)
      .post('/api/orders/order-id/cancel')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ reason: 'Cannot reach pickup' });

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/orders/:orderId/accept ─────────────────────────────────────────

describe('POST /api/orders/:orderId/accept', () => {
  test('online driver accepts a SEARCHING_DRIVER order', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findFirst.mockResolvedValue(null); // no active order
    prisma.order.findUnique.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'DRIVER_ASSIGNED', driverId: 'driver-id', store: mockStore });
    prisma.store.findUnique.mockResolvedValue({ userId: 'store-user-id' });

    const res = await request(app)
      .post('/api/orders/order-id/accept')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('offline driver cannot accept — returns 403', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOfflineDriver);

    const res = await request(app)
      .post('/api/orders/order-id/accept')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('driver with active order gets 409', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findFirst.mockResolvedValue({ ...mockOrder, status: 'IN_TRANSIT', driverId: 'driver-id' });

    const res = await request(app)
      .post('/api/orders/order-id/accept')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(409);
  });

  test('order not in SEARCHING_DRIVER status returns 404', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: 'DRIVER_ASSIGNED' });

    const res = await request(app)
      .post('/api/orders/order-id/accept')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(404);
  });

  test('non-driver role cannot accept — returns 403', async () => {
    const res = await request(app)
      .post('/api/orders/order-id/accept')
      .set('Authorization', `Bearer ${storeToken()}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/orders/:orderId/status ───────────────────────────────────────

describe('PATCH /api/orders/:orderId/status', () => {
  const assignedOrder = {
    ...mockOrder,
    status: 'DRIVER_ASSIGNED',
    driverId: 'driver-id',
    store: { id: 'store-id', storeName: 'Test Store' },
    storeId: 'store-id',
  };

  test('DRIVER_ASSIGNED → DRIVER_AT_STORE is a valid transition', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findUnique.mockResolvedValue(assignedOrder);
    prisma.order.update.mockResolvedValue({ ...assignedOrder, status: 'DRIVER_AT_STORE' });
    prisma.store.findUnique.mockResolvedValue({ userId: 'store-user-id' });

    const res = await request(app)
      .patch('/api/orders/order-id/status')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ status: 'DRIVER_AT_STORE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('invalid transition returns 400', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findUnique.mockResolvedValue(assignedOrder);

    const res = await request(app)
      .patch('/api/orders/order-id/status')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ status: 'DELIVERED' }); // DRIVER_ASSIGNED → DELIVERED is invalid

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid status transition/i);
  });

  test('driver cannot update another driver\'s order — returns 403', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockOnlineDriver, id: 'other-driver-id' });
    prisma.order.findUnique.mockResolvedValue(assignedOrder); // driverId is 'driver-id', not 'other-driver-id'

    const res = await request(app)
      .patch('/api/orders/order-id/status')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ status: 'DRIVER_AT_STORE' });

    expect(res.status).toBe(403);
  });

  test('DELIVERED transition creates earning and credits wallet in $transaction', async () => {
    const inTransitOrder = { ...assignedOrder, status: 'IN_TRANSIT' };
    prisma.driver.findUnique.mockResolvedValue(mockOnlineDriver);
    prisma.order.findUnique.mockResolvedValue(inTransitOrder);
    prisma.order.update.mockResolvedValue({ ...inTransitOrder, status: 'DELIVERED' });
    prisma.wallet.findUnique.mockResolvedValue({ driverId: 'driver-id', balance: 100 });
    prisma.store.findUnique.mockResolvedValue({ userId: 'store-user-id' });

    const res = await request(app)
      .patch('/api/orders/order-id/status')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ status: 'DELIVERED' });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.earning.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ driverId: 'driver-id', amount: 50 }) })
    );
  });

  test('non-driver role cannot update order status — returns 403', async () => {
    const res = await request(app)
      .patch('/api/orders/order-id/status')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ status: 'DRIVER_AT_STORE' });

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/orders/estimate ────────────────────────────────────────────────

describe('POST /api/orders/estimate', () => {
  test('returns fee breakdown with surge info for valid coordinates', async () => {
    prisma.store.findUnique.mockResolvedValue(mockStore);
    getSurgeMultiplier.mockResolvedValue({ multiplier: 1.3, isSurge: true, reason: 'Morning rush hour' });

    const res = await request(app)
      .post('/api/orders/estimate')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({
        pickupLat: 9.0121,
        pickupLng: 38.7468,
        deliveryLat: 8.9946,
        deliveryLng: 38.7906,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
    expect(res.body.data.surge.isSurge).toBe(true);
    expect(res.body.data.surge.multiplier).toBe(1.3);
  });

  test('returns 400 when coordinates are missing', async () => {
    const res = await request(app)
      .post('/api/orders/estimate')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send({ pickupLat: 9.0121 }); // missing other coords

    expect(res.status).toBe(400);
  });
});
