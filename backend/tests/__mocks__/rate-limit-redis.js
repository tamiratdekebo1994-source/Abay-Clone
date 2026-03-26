// Stub for rate-limit-redis — not needed in the test environment.
const RedisStore = jest.fn().mockImplementation(() => ({}));
module.exports = { RedisStore };
