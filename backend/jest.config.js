module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  testTimeout: 10000,
  verbose: true,
  // Stub optional peer packages that may not be installed in the test environment
  moduleNameMapper: {
    '^@sentry/node$': '<rootDir>/tests/__mocks__/@sentry/node.js',
    '^rate-limit-redis$': '<rootDir>/tests/__mocks__/rate-limit-redis.js',
  },
};
