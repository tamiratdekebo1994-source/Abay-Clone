/**
 * Driver route integration tests
 * Tests registration, profile, toggle-online, nearby orders, and earnings.
 */
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/surgeService');

process.env.JWT_SECRET = 'abay-driver-test-secret-key-32chars';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../helpers/testApp');
const { driverToken, storeToken } = require('../helpers/tokens');
const prisma = require('../../src/config/database');
const { getSurgeMultiplier } = require('../../src/services/surgeService');

const app = createApp();

// ─── Shared mock data ─────────────────────────────────────────────────────────

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
  userId: 'driver-user-id',
  status: 'OFFLINE',
  licenseNumber: 'ETH-LIC-001',
  vehicleType: 'MOTORCYCLE',
  vehiclePlate: 'AA1234',
  vehicleModel: 'Honda CB150',
  vehicleColor: 'Red',
  vehicleYear: 2020,
  city: 'Addis Ababa',
  rating: 4.8,
  totalDeliveries: 120,
  totalEarnings: 6000,
  currentLat: null,
  currentLng: null,
};

const registrationBody = {
  licenseNumber: 'ETH-LIC-002',
  licenseExpiry: '2027-01-01',
  vehicleType: 'MOTORCYCLE',
  vehiclePlate: 'aa5678',
  vehicleModel: 'Yamaha YBR',
  vehicleColor: 'Blue',
  vehicleYear: '2021',
  city: 'Addis Ababa',
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
    count: jest.fn().mockResolvedValue(0),
  };
  prisma.earning = {
    findMany: jest.fn().mockResolvedValue([]),
  };
  prisma.pushToken = {
    upsert: jest.fn().mockResolvedValue({}),
  };
  prisma.zone = {
    findFirst: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };

  // authenticate middleware
  prisma.user.findUnique.mockImplementation(({ where }) => {
    if (where?.id === 'driver-user-id') return Promise.resolve(mockDriverUser);
    return Promise.resolve(null);
  });

  getSurgeMultiplier.mockResolvedValue({ multiplier: 1.0, isSurge: false, reason: null });
});

// ─── POST /api/driver/register ────────────────────────────────────────────────

describe('POST /api/driver/register', () => {
  test('creates a driver profile and returns 201 with PENDING status', async () => {
    prisma.driver.findFirst.mockResolvedValue(null); // no existing profile
    prisma.driver.create.mockResolvedValue({
      ...mockDriver,
      status: 'PENDING',
      vehiclePlate: 'AA5678', // uppercased
    });

    const res = await request(app)
      .post('/api/driver/register')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(registrationBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
  });

  test('uppercases the vehicle plate before saving', async () => {
    prisma.driver.findFirst.mockResolvedValue(null);
    prisma.driver.create.mockResolvedValue({ ...mockDriver, status: 'PENDING', vehiclePlate: 'AA5678' });

    await request(app)
      .post('/api/driver/register')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ ...registrationBody, vehiclePlate: 'aa5678' });

    expect(prisma.driver.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vehiclePlate: 'AA5678' }) })
    );
  });

  test('returns 409 when driver profile already exists', async () => {
    prisma.driver.findFirst.mockResolvedValue(mockDriver);

    const res = await request(app)
      .post('/api/driver/register')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send(registrationBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 for non-driver role (STORE)', async () => {
    // Store user attempting driver registration
    prisma.user.findUnique.mockResolvedValue({
      id: 'store-user-id',
      role: 'STORE',
      isActive: true,
      isVerified: true,
      driver: null,
      store: null,
    });

    const res = await request(app)
      .post('/api/driver/register')
      .set('Authorization', `Bearer ${storeToken()}`)
      .send(registrationBody);

    expect(res.status).toBe(403);
  });

  test('returns 401 with no token', async () => {
    const res = await request(app).post('/api/driver/register').send(registrationBody);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/driver/profile ──────────────────────────────────────────────────

describe('GET /api/driver/profile', () => {
  test('returns driver profile with earnings', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      ...mockDriver,
      user: { fullName: 'Test Driver', phone: '+251911000000', email: 'driver@test.com', avatarUrl: null },
      earnings: [],
    });

    const res = await request(app)
      .get('/api/driver/profile')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('driver-id');
    expect(res.body.data.vehiclePlate).toBe('AA1234');
  });

  test('returns 404 when no driver profile exists', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/driver/profile')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/driver/toggle-online ──────────────────────────────────────────

describe('POST /api/driver/toggle-online', () => {
  test('OFFLINE driver toggles to ONLINE', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'OFFLINE' });
    prisma.driver.update.mockResolvedValue({ ...mockDriver, status: 'ONLINE' });

    const res = await request(app)
      .post('/api/driver/toggle-online')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ONLINE');
    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ONLINE' } })
    );
  });

  test('ONLINE driver toggles to OFFLINE', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'ONLINE' });
    prisma.driver.update.mockResolvedValue({ ...mockDriver, status: 'OFFLINE' });

    const res = await request(app)
      .post('/api/driver/toggle-online')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OFFLINE');
  });

  test('PENDING driver is blocked — returns 403', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'PENDING' });

    const res = await request(app)
      .post('/api/driver/toggle-online')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('SUSPENDED driver is blocked — returns 403', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'SUSPENDED' });

    const res = await request(app)
      .post('/api/driver/toggle-online')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(403);
  });

  test('returns 404 when no driver profile exists', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/driver/toggle-online')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/driver/orders/nearby ───────────────────────────────────────────

describe('GET /api/driver/orders/nearby', () => {
  const searchingOrder = {
    id: 'order-id',
    status: 'SEARCHING_DRIVER',
    pickupLat: 9.0121,
    pickupLng: 38.7468,
    store: { storeName: 'Test Store', address: '1 Main St', city: 'Addis Ababa', lat: 9.01, lng: 38.74 },
  };

  test('online driver sees SEARCHING_DRIVER orders', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'ONLINE' });
    prisma.order.findMany.mockResolvedValue([searchingOrder]);

    const res = await request(app)
      .get('/api/driver/orders/nearby')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  test('offline driver is blocked — returns 403', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'OFFLINE' });

    const res = await request(app)
      .get('/api/driver/orders/nearby')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(403);
  });

  test('filters by radius when lat/lng query params provided', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'ONLINE' });
    // Order at same location as driver — should be within any positive radius
    prisma.order.findMany.mockResolvedValue([searchingOrder]);

    const res = await request(app)
      .get('/api/driver/orders/nearby?lat=9.0121&lng=38.7468&radius=5')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1); // within 5km of itself
  });

  test('excludes orders outside radius', async () => {
    prisma.driver.findUnique.mockResolvedValue({ ...mockDriver, status: 'ONLINE' });
    // Dire Dawa — ~440km from Addis Ababa driver position
    prisma.order.findMany.mockResolvedValue([{
      ...searchingOrder,
      pickupLat: 9.5931,
      pickupLng: 41.8662,
    }]);

    const res = await request(app)
      .get('/api/driver/orders/nearby?lat=9.0121&lng=38.7468&radius=10')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0); // 440km > 10km radius
  });
});

// ─── GET /api/driver/earnings ─────────────────────────────────────────────────

describe('GET /api/driver/earnings', () => {
  const mockEarning = {
    id: 'earning-id',
    driverId: 'driver-id',
    amount: 85,
    createdAt: new Date(),
    order: {
      orderNumber: 'ORD-001',
      deliveryAddress: '456 Delivery Ave',
      deliveredAt: new Date(),
      distanceKm: 7.2,
    },
  };

  test('returns earnings summary with correct totals', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.earning.findMany.mockResolvedValue([mockEarning, { ...mockEarning, id: 'earning-2', amount: 65 }]);

    const res = await request(app)
      .get('/api/driver/earnings')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(150); // 85 + 65
    expect(res.body.data.deliveries).toBe(2);
    expect(res.body.data.currency).toBe('ETB');
  });

  test('averagePerDelivery is 0 when no earnings', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.earning.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/driver/earnings')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.averagePerDelivery).toBe(0);
    expect(res.body.data.total).toBe(0);
  });

  test('returns 404 when driver profile not found', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/driver/earnings')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(404);
  });

  test('period=today is accepted as a valid query param', async () => {
    prisma.driver.findUnique.mockResolvedValue(mockDriver);
    prisma.earning.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/driver/earnings?period=today')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('today');
  });
});

// ─── POST /api/driver/push-token ─────────────────────────────────────────────

describe('POST /api/driver/push-token', () => {
  test('upserts push token and returns success', async () => {
    const res = await request(app)
      .post('/api/driver/push-token')
      .set('Authorization', `Bearer ${driverToken()}`)
      .send({ token: 'ExponentPushToken[abc123]', platform: 'android' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'ExponentPushToken[abc123]' },
        create: expect.objectContaining({ userId: 'driver-user-id', platform: 'android' }),
      })
    );
  });
});

// ─── GET /api/driver/surge ────────────────────────────────────────────────────

describe('GET /api/driver/surge', () => {
  test('returns surge info for a city', async () => {
    getSurgeMultiplier.mockResolvedValue({ multiplier: 1.4, isSurge: true, reason: 'Evening rush hour', pendingOrders: 10, onlineDrivers: 3 });

    const res = await request(app)
      .get('/api/driver/surge?city=Addis%20Ababa')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.multiplier).toBe(1.4);
    expect(res.body.data.isSurge).toBe(true);
    expect(getSurgeMultiplier).toHaveBeenCalledWith('Addis Ababa');
  });

  test('defaults to Addis Ababa when no city query param', async () => {
    getSurgeMultiplier.mockResolvedValue({ multiplier: 1.0, isSurge: false, reason: null });

    await request(app)
      .get('/api/driver/surge')
      .set('Authorization', `Bearer ${driverToken()}`);

    expect(getSurgeMultiplier).toHaveBeenCalledWith('Addis Ababa');
  });
});
