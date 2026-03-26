/**
 * Unit tests for request validators.
 * Uses the express-validator .run() API to execute chains against a mock
 * request object — no HTTP server or Prisma required.
 */
const { validationResult } = require('express-validator');

const driverV = require('../../src/validators/driver');
const storeV  = require('../../src/validators/store');
const adminV  = require('../../src/validators/admin');
const walletV = require('../../src/validators/wallet');
const orderV  = require('../../src/validators/order');

// Run an array of express-validator chains against a synthetic request
async function run(chains, { body = {}, params = {}, query = {} } = {}) {
  const req = { body, params, query, headers: {} };
  await Promise.all(chains.map((c) => c.run(req)));
  return validationResult(req).array().map((e) => e.path);
}

// ── Driver validators ─────────────────────────────────────────────────────────

describe('driverValidators.register', () => {
  const valid = {
    licenseNumber: 'ET-DL-12345',
    licenseExpiry: '2027-01-01',
    vehicleType: 'MOTORCYCLE',
    vehiclePlate: 'AAA1234',
    city: 'Addis Ababa',
  };

  test('passes with all required fields', async () => {
    expect(await run(driverV.register, { body: valid })).toHaveLength(0);
  });

  test('fails when licenseNumber is missing', async () => {
    const errors = await run(driverV.register, { body: { ...valid, licenseNumber: '' } });
    expect(errors).toContain('licenseNumber');
  });

  test('fails when licenseExpiry is not a date', async () => {
    const errors = await run(driverV.register, { body: { ...valid, licenseExpiry: 'not-a-date' } });
    expect(errors).toContain('licenseExpiry');
  });

  test('fails when vehicleType is not in allowlist', async () => {
    const errors = await run(driverV.register, { body: { ...valid, vehicleType: 'JETSKI' } });
    expect(errors).toContain('vehicleType');
  });

  test('rejects vehicleYear outside range', async () => {
    const errors = await run(driverV.register, { body: { ...valid, vehicleYear: 1985 } });
    expect(errors).toContain('vehicleYear');
  });

  test('accepts optional vehicleYear within range', async () => {
    expect(await run(driverV.register, { body: { ...valid, vehicleYear: 2022 } })).toHaveLength(0);
  });
});

describe('driverValidators.location', () => {
  test('passes valid coords', async () => {
    expect(await run(driverV.location, { body: { lat: 9.02, lng: 38.75 } })).toHaveLength(0);
  });

  test('fails when lat is out of range', async () => {
    expect(await run(driverV.location, { body: { lat: 91, lng: 38.75 } })).toContain('lat');
  });

  test('fails when lng is out of range', async () => {
    expect(await run(driverV.location, { body: { lat: 9.02, lng: 181 } })).toContain('lng');
  });

  test('fails when lat is not a number', async () => {
    expect(await run(driverV.location, { body: { lat: 'north', lng: 38.75 } })).toContain('lat');
  });
});

describe('driverValidators.pushToken', () => {
  test('passes valid token', async () => {
    expect(await run(driverV.pushToken, { body: { token: 'ExponentPushToken[xxx]' } })).toHaveLength(0);
  });

  test('fails when token is empty', async () => {
    expect(await run(driverV.pushToken, { body: { token: '' } })).toContain('token');
  });

  test('fails when platform is not in allowlist', async () => {
    const errors = await run(driverV.pushToken, { body: { token: 'abc', platform: 'windows' } });
    expect(errors).toContain('platform');
  });

  test('accepts valid platform values', async () => {
    for (const p of ['android', 'ios', 'web']) {
      expect(await run(driverV.pushToken, { body: { token: 'abc', platform: p } })).toHaveLength(0);
    }
  });
});

// ── Store validators ──────────────────────────────────────────────────────────

describe('storeValidators.register', () => {
  const valid = {
    storeName: "Abebe's Grocery",
    storeType: 'GROCERY',
    address: 'Bole Road near Edna Mall',
    city: 'Addis Ababa',
  };

  test('passes with required fields', async () => {
    expect(await run(storeV.register, { body: valid })).toHaveLength(0);
  });

  test('fails when storeName is missing', async () => {
    const errors = await run(storeV.register, { body: { ...valid, storeName: '' } });
    expect(errors).toContain('storeName');
  });

  test('fails with invalid storeType', async () => {
    const errors = await run(storeV.register, { body: { ...valid, storeType: 'NIGHTCLUB' } });
    expect(errors).toContain('storeType');
  });

  test('fails with invalid Ethiopian phone', async () => {
    const errors = await run(storeV.register, { body: { ...valid, phone: '0911234567' } });
    expect(errors).toContain('phone');
  });

  test('accepts valid Ethiopian phone', async () => {
    const errors = await run(storeV.register, { body: { ...valid, phone: '+251911234567' } });
    expect(errors).toHaveLength(0);
  });

  test('fails with lat out of range', async () => {
    const errors = await run(storeV.register, { body: { ...valid, lat: -91 } });
    expect(errors).toContain('lat');
  });
});

describe('storeValidators.updateProfile', () => {
  test('passes with empty body (all optional)', async () => {
    expect(await run(storeV.updateProfile, { body: {} })).toHaveLength(0);
  });

  test('fails when provided storeType is invalid', async () => {
    const errors = await run(storeV.updateProfile, { body: { storeType: 'INVALID' } });
    expect(errors).toContain('storeType');
  });

  test('fails when provided storeName is empty string', async () => {
    const errors = await run(storeV.updateProfile, { body: { storeName: '' } });
    expect(errors).toContain('storeName');
  });
});

// ── Admin validators ──────────────────────────────────────────────────────────

describe('adminValidators.approveDriver', () => {
  test('passes with approve', async () => {
    expect(await run(adminV.approveDriver, { body: { action: 'approve' } })).toHaveLength(0);
  });

  test('passes with suspend', async () => {
    expect(await run(adminV.approveDriver, { body: { action: 'suspend' } })).toHaveLength(0);
  });

  test('fails with invalid action', async () => {
    const errors = await run(adminV.approveDriver, { body: { action: 'delete' } });
    expect(errors).toContain('action');
  });

  test('fails when action is missing', async () => {
    const errors = await run(adminV.approveDriver, { body: {} });
    expect(errors).toContain('action');
  });
});

describe('adminValidators.surge', () => {
  test('passes with valid city and multiplier', async () => {
    expect(await run(adminV.surge, { body: { city: 'Addis Ababa', multiplier: 1.5 } })).toHaveLength(0);
  });

  test('fails when city is missing', async () => {
    const errors = await run(adminV.surge, { body: { multiplier: 1.5 } });
    expect(errors).toContain('city');
  });

  test('fails when multiplier is below 1.0', async () => {
    const errors = await run(adminV.surge, { body: { city: 'Addis Ababa', multiplier: 0.5 } });
    expect(errors).toContain('multiplier');
  });

  test('fails when multiplier exceeds 10.0', async () => {
    const errors = await run(adminV.surge, { body: { city: 'Addis Ababa', multiplier: 11 } });
    expect(errors).toContain('multiplier');
  });

  test('fails when multiplier is not a number', async () => {
    const errors = await run(adminV.surge, { body: { city: 'Addis Ababa', multiplier: 'high' } });
    expect(errors).toContain('multiplier');
  });
});

// ── Wallet validators ─────────────────────────────────────────────────────────

describe('walletValidators.requestWithdrawal', () => {
  const valid = { amount: 500, accountNumber: '1000123456789' };

  test('passes with required fields', async () => {
    expect(await run(walletV.requestWithdrawal, { body: valid })).toHaveLength(0);
  });

  test('fails when amount is zero', async () => {
    const errors = await run(walletV.requestWithdrawal, { body: { ...valid, amount: 0 } });
    expect(errors).toContain('amount');
  });

  test('fails when amount is negative', async () => {
    const errors = await run(walletV.requestWithdrawal, { body: { ...valid, amount: -100 } });
    expect(errors).toContain('amount');
  });

  test('fails when accountNumber is missing', async () => {
    const errors = await run(walletV.requestWithdrawal, { body: { amount: 500 } });
    expect(errors).toContain('accountNumber');
  });

  test('passes with optional method and accountName', async () => {
    const errors = await run(walletV.requestWithdrawal, {
      body: { ...valid, method: 'CBE', accountName: 'Abebe Bekele' },
    });
    expect(errors).toHaveLength(0);
  });
});

describe('walletValidators.processWithdrawal', () => {
  test('passes with empty body (both fields optional)', async () => {
    expect(await run(walletV.processWithdrawal, { body: {} })).toHaveLength(0);
  });

  test('passes with valid action', async () => {
    expect(await run(walletV.processWithdrawal, { body: { action: 'complete' } })).toHaveLength(0);
  });

  test('passes with valid status', async () => {
    expect(await run(walletV.processWithdrawal, { body: { status: 'COMPLETED' } })).toHaveLength(0);
  });

  test('fails with invalid action', async () => {
    const errors = await run(walletV.processWithdrawal, { body: { action: 'approve' } });
    expect(errors).toContain('action');
  });

  test('fails with invalid status', async () => {
    const errors = await run(walletV.processWithdrawal, { body: { status: 'APPROVED' } });
    expect(errors).toContain('status');
  });
});

// ── Order validators (new endpoints) ─────────────────────────────────────────

describe('orderValidators.updateStatus', () => {
  const validStatuses = ['DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

  test.each(validStatuses)('passes with status %s', async (status) => {
    expect(await run(orderV.updateStatus, { body: { status } })).toHaveLength(0);
  });

  test('fails when status is missing', async () => {
    expect(await run(orderV.updateStatus, { body: {} })).toContain('status');
  });

  test('fails with unknown status value', async () => {
    expect(await run(orderV.updateStatus, { body: { status: 'FLYING' } })).toContain('status');
  });
});

describe('orderValidators.cancel', () => {
  test('passes with no body (reason is optional)', async () => {
    expect(await run(orderV.cancel, { body: {} })).toHaveLength(0);
  });

  test('passes with a valid reason', async () => {
    expect(await run(orderV.cancel, { body: { reason: 'Store closed' } })).toHaveLength(0);
  });

  test('fails when reason exceeds 500 characters', async () => {
    const errors = await run(orderV.cancel, { body: { reason: 'x'.repeat(501) } });
    expect(errors).toContain('reason');
  });
});

describe('orderValidators.review', () => {
  test('passes with valid rating', async () => {
    expect(await run(orderV.review, { body: { rating: 5 } })).toHaveLength(0);
  });

  test('fails when rating is missing', async () => {
    expect(await run(orderV.review, { body: {} })).toContain('rating');
  });

  test('fails when rating is 0', async () => {
    expect(await run(orderV.review, { body: { rating: 0 } })).toContain('rating');
  });

  test('fails when rating is 6', async () => {
    expect(await run(orderV.review, { body: { rating: 6 } })).toContain('rating');
  });

  test('fails when rating is not an integer', async () => {
    expect(await run(orderV.review, { body: { rating: 4.5 } })).toContain('rating');
  });

  test('passes with optional comment', async () => {
    expect(await run(orderV.review, { body: { rating: 4, comment: 'Fast delivery!' } })).toHaveLength(0);
  });

  test('fails when comment exceeds 500 characters', async () => {
    const errors = await run(orderV.review, { body: { rating: 4, comment: 'x'.repeat(501) } });
    expect(errors).toContain('comment');
  });
});
