/**
 * JWT token helpers for tests.
 * User IDs match the mock users set up in each test file's beforeEach.
 */
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'et-spark-driver-test-secret-32c';

const makeToken = (payload, expiresIn = '15m') =>
  jwt.sign(payload, SECRET, { expiresIn });

const adminToken = () => makeToken({ userId: 'admin-user-id', role: 'ADMIN' });
const storeToken = (userId = 'store-user-id') => makeToken({ userId, role: 'STORE' });
const driverToken = (userId = 'driver-user-id') => makeToken({ userId, role: 'DRIVER' });
const expiredToken = () => makeToken({ userId: 'store-user-id', role: 'STORE' }, '-1s');

module.exports = { adminToken, storeToken, driverToken, expiredToken, makeToken };
