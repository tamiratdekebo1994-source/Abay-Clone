jest.mock('../../src/config/database', () => ({}));

const prisma = require('../../src/config/database');
const { getSurgeMultiplier, setManualSurge } = require('../../src/services/surgeService');

// Helpers to set the Ethiopian local time (UTC+3)
// Pass the desired Ethiopian hour (0-23) and we compute the UTC time
function setEthiopianHour(hour) {
  const utcHour = (hour - 3 + 24) % 24;
  const date = new Date();
  date.setUTCHours(utcHour, 0, 0, 0);
  jest.useFakeTimers({ now: date });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no pending orders, 3 online drivers, no zone override
  prisma.order = { count: jest.fn().mockResolvedValue(0) };
  prisma.driver = { count: jest.fn().mockResolvedValue(3) };
  prisma.zone = {
    findFirst: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getSurgeMultiplier — time-based surge', () => {
  test('no surge outside peak hours (e.g. 3am EAT)', async () => {
    setEthiopianHour(3);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.0);
    expect(result.isSurge).toBe(false);
    expect(result.reason).toBeNull();
  });

  test('morning rush (7–9 EAT) applies 1.3x multiplier', async () => {
    setEthiopianHour(8); // 8am EAT — inside 7–9 window
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.3);
    expect(result.isSurge).toBe(true);
    expect(result.reason).toBe('Morning rush hour');
  });

  test('lunch rush (12–14 EAT) applies 1.2x multiplier', async () => {
    setEthiopianHour(13);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.2);
    expect(result.isSurge).toBe(true);
    expect(result.reason).toBe('Lunch hour');
  });

  test('evening rush (17–20 EAT) applies 1.4x multiplier', async () => {
    setEthiopianHour(18);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.4);
    expect(result.isSurge).toBe(true);
    expect(result.reason).toBe('Evening rush hour');
  });

  test('edge: hour 9 is outside morning rush window', async () => {
    setEthiopianHour(9); // window is [7, 9) — 9 is excluded
    const result = await getSurgeMultiplier('Addis Ababa');
    // No time surge; demand surge will be 1.0 with 0 orders and 3 drivers
    expect(result.multiplier).toBe(1.0);
  });

  test('edge: hour 20 is outside evening rush window', async () => {
    setEthiopianHour(20); // window is [17, 20) — 20 is excluded
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.0);
  });
});

describe('getSurgeMultiplier — demand-based surge', () => {
  beforeEach(() => setEthiopianHour(3)); // off-peak to isolate demand logic

  test('no surge when demand is low (ratio < 1.5)', async () => {
    prisma.order.count.mockResolvedValue(2);
    prisma.driver.count.mockResolvedValue(5); // ratio = 0.4
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.0);
  });

  test('1.2x when ratio >= 1.5', async () => {
    prisma.order.count.mockResolvedValue(3);
    prisma.driver.count.mockResolvedValue(2); // ratio = 1.5
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.2);
  });

  test('1.3x when ratio >= 2', async () => {
    prisma.order.count.mockResolvedValue(6);
    prisma.driver.count.mockResolvedValue(3); // ratio = 2.0
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.3);
  });

  test('1.5x when ratio >= 3', async () => {
    prisma.order.count.mockResolvedValue(9);
    prisma.driver.count.mockResolvedValue(3); // ratio = 3.0
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeGreaterThanOrEqual(1.5);
    expect(result.reason).toBe('High demand in your area');
  });

  test('1.8x when there are pending orders but zero online drivers', async () => {
    prisma.order.count.mockResolvedValue(4);
    prisma.driver.count.mockResolvedValue(0);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.8);
    expect(result.isSurge).toBe(true);
  });

  test('no surge when zero orders and zero drivers', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.driver.count.mockResolvedValue(0);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.0);
    expect(result.isSurge).toBe(false);
  });

  test('returns pendingOrders and onlineDrivers in response', async () => {
    prisma.order.count.mockResolvedValue(2);
    prisma.driver.count.mockResolvedValue(5);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.pendingOrders).toBe(2);
    expect(result.onlineDrivers).toBe(5);
  });
});

describe('getSurgeMultiplier — DB override', () => {
  beforeEach(() => setEthiopianHour(3));

  test('zone DB override takes effect when higher than time/demand surge', async () => {
    prisma.zone.findFirst.mockResolvedValue({ surgeMultiplier: 2.0, isActive: true });
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(2.0);
    expect(result.isSurge).toBe(true);
  });

  test('no zone returns default multiplier 1.0', async () => {
    prisma.zone.findFirst.mockResolvedValue(null);
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBe(1.0);
  });
});

describe('getSurgeMultiplier — MAX_SURGE cap', () => {
  beforeEach(() => setEthiopianHour(18)); // evening rush (1.4x)

  test('never exceeds 2.5x even with combined demand + zone override', async () => {
    prisma.order.count.mockResolvedValue(100);
    prisma.driver.count.mockResolvedValue(1); // high demand → 1.5x or 1.8x
    prisma.zone.findFirst.mockResolvedValue({ surgeMultiplier: 3.0, isActive: true });
    const result = await getSurgeMultiplier('Addis Ababa');
    expect(result.multiplier).toBeLessThanOrEqual(2.5);
  });
});

describe('setManualSurge', () => {
  test('calls prisma.zone.updateMany with capped multiplier', async () => {
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    await setManualSurge('Addis Ababa', 1.8);
    expect(prisma.zone.updateMany).toHaveBeenCalledWith({
      where: { city: 'Addis Ababa', isActive: true },
      data: { surgeMultiplier: 1.8 },
    });
  });

  test('caps the multiplier at 2.5 (MAX_SURGE)', async () => {
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    await setManualSurge('Addis Ababa', 9.99);
    const call = prisma.zone.updateMany.mock.calls[0][0];
    expect(call.data.surgeMultiplier).toBeLessThanOrEqual(2.5);
  });
});
