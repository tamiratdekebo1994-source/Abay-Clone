/**
 * Returns a fresh Prisma mock object with jest.fn() for every method used
 * across the codebase. Import this in test files that need fine-grained control.
 *
 * Usage:
 *   jest.mock('../../src/config/database', () => require('../helpers/mockPrisma').createMockPrisma());
 */

function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    orderTracking: {
      create: jest.fn(),
    },
    earning: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletWithdrawal: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    pushToken: {
      upsert: jest.fn(),
    },
    zone: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    review: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(async (opsOrFn) => {
      if (typeof opsOrFn === 'function') {
        // Interactive transaction — pass a proxy of the same mock
        return opsOrFn(createMockPrisma());
      }
      // Array of promises
      return Promise.all(opsOrFn);
    }),
  };
}

module.exports = { createMockPrisma };
