const { calculateDeliveryFee, calculateDistance, PRICING } = require('../../src/utils/pricing');

describe('calculateDistance (Haversine formula)', () => {
  test('returns 0 for identical coordinates', () => {
    expect(calculateDistance(9.0, 38.7, 9.0, 38.7)).toBe(0);
  });

  test('is commutative — same distance in both directions', () => {
    const d1 = calculateDistance(9.0121, 38.7468, 8.9946, 38.7906);
    const d2 = calculateDistance(8.9946, 38.7906, 9.0121, 38.7468);
    expect(d1).toBeCloseTo(d2, 5);
  });

  test('Merkato → Bole is approximately 5 km', () => {
    // Merkato: 9.0121, 38.7468  |  Bole: 8.9946, 38.7906
    const dist = calculateDistance(9.0121, 38.7468, 8.9946, 38.7906);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  test('Addis Ababa → Dire Dawa is approximately 350 km', () => {
    // Addis Ababa: 9.0192, 38.7525  |  Dire Dawa: 9.5931, 41.8662
    const dist = calculateDistance(9.0192, 38.7525, 9.5931, 41.8662);
    expect(dist).toBeGreaterThan(300);
    expect(dist).toBeLessThan(420);
  });

  test('returns a positive number for any two different points', () => {
    const dist = calculateDistance(9.0, 38.7, 9.1, 38.8);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('calculateDeliveryFee', () => {
  test('returns all required fields', () => {
    const result = calculateDeliveryFee(5);
    expect(result).toMatchObject({
      distanceKm: expect.any(Number),
      baseFee: expect.any(Number),
      driverFee: expect.any(Number),
      platformFee: expect.any(Number),
      totalAmount: expect.any(Number),
      currency: 'ETB',
    });
  });

  test('enforces minimum fee floor for very short distances', () => {
    const result = calculateDeliveryFee(0.1);
    expect(result.totalAmount).toBe(PRICING.MIN_FEE);
  });

  test('platform fee is 15% of total', () => {
    const result = calculateDeliveryFee(10);
    expect(result.platformFee).toBeCloseTo(result.totalAmount * (PRICING.PLATFORM_FEE_PERCENT / 100), 1);
  });

  test('driverFee + platformFee === totalAmount', () => {
    const result = calculateDeliveryFee(8);
    expect(result.driverFee + result.platformFee).toBeCloseTo(result.totalAmount, 1);
  });

  test('fee increases with distance', () => {
    const short = calculateDeliveryFee(3);
    const long = calculateDeliveryFee(15);
    expect(long.totalAmount).toBeGreaterThan(short.totalAmount);
  });

  test('fragile surcharge increases the fee', () => {
    const normal = calculateDeliveryFee(10);
    const fragile = calculateDeliveryFee(10, { isFragile: true });
    expect(fragile.totalAmount).toBeGreaterThan(normal.totalAmount);
  });

  test('refrigeration surcharge increases the fee more than fragile', () => {
    const fragile = calculateDeliveryFee(10, { isFragile: true });
    const cold = calculateDeliveryFee(10, { requiresRefrigeration: true });
    expect(cold.totalAmount).toBeGreaterThan(fragile.totalAmount);
  });

  test('surge multiplier scales total proportionally', () => {
    const normal = calculateDeliveryFee(10);
    const surged = calculateDeliveryFee(10, { surgeMultiplier: 1.5 });
    expect(surged.totalAmount).toBeCloseTo(normal.totalAmount * 1.5, 0);
  });

  test('distanceKm in result is rounded to 2 decimal places', () => {
    const result = calculateDeliveryFee(5.12345);
    const decimals = result.distanceKm.toString().split('.')[1]?.length || 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  test('base fee is always the configured BASE_FEE', () => {
    const result = calculateDeliveryFee(10);
    expect(result.baseFee).toBe(PRICING.BASE_FEE);
  });
});
