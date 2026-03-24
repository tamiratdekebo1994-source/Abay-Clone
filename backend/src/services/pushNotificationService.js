/**
 * Push Notification Service — Expo Push Notifications
 * Works with the Expo Go app and standalone builds
 * No Apple/Google developer account needed for development
 */

const https = require('https');
const prisma = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification to a single user
 */
const sendToUser = async (userId, { title, body, data = {}, sound = 'default' }) => {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound,
    title,
    body,
    data,
    priority: 'high',
    channelId: 'default',
  }));

  return sendBatch(messages);
};

/**
 * Send push notification to multiple users
 */
const sendToUsers = async (userIds, notification) => {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    ...notification,
  }));

  return sendBatch(messages);
};

/**
 * Notify all online drivers about a new order
 */
const notifyNearbyDrivers = async (order) => {
  const onlineDrivers = await prisma.driver.findMany({
    where: { status: 'ONLINE' },
    select: { userId: true },
  });

  const userIds = onlineDrivers.map((d) => d.userId);
  if (userIds.length === 0) return;

  return sendToUsers(userIds, {
    title: '🚚 New Delivery Available!',
    body: `ETB ${order.driverFee?.toFixed(0)} • ${order.distanceKm?.toFixed(1)}km • ${order.pickupAddress}`,
    data: { type: 'NEW_ORDER', orderId: order.id },
    sound: 'default',
  });
};

/**
 * Notify store when driver is assigned
 */
const notifyDriverAssigned = async (storeUserId, driverName, orderNumber) => {
  return sendToUser(storeUserId, {
    title: '🎉 Driver Found!',
    body: `${driverName} is on the way to pick up order #${orderNumber}`,
    data: { type: 'DRIVER_ASSIGNED' },
  });
};

/**
 * Notify store/recipient of delivery status changes
 */
const notifyOrderStatus = async (userId, status, orderNumber) => {
  const messages = {
    PICKED_UP: { title: '📦 Order Picked Up', body: `Your order #${orderNumber} has been picked up and is on the way!` },
    IN_TRANSIT: { title: '🚗 Order In Transit', body: `Order #${orderNumber} is heading to the destination.` },
    DELIVERED: { title: '✅ Delivered!', body: `Order #${orderNumber} has been successfully delivered!` },
    CANCELLED: { title: '❌ Order Cancelled', body: `Order #${orderNumber} has been cancelled.` },
  };

  const msg = messages[status];
  if (!msg) return;

  return sendToUser(userId, { ...msg, data: { type: 'ORDER_STATUS', status } });
};

/**
 * Send batch push messages to Expo
 */
const sendBatch = (messages) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(messages);

    const options = {
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Handle invalid tokens
          if (parsed.data) {
            const invalid = parsed.data
              .filter((r) => r.status === 'error' && r.details?.error === 'DeviceNotRegistered')
              .map((r) => r.details?.expoPushToken)
              .filter(Boolean);

            if (invalid.length > 0) {
              prisma.pushToken.deleteMany({ where: { token: { in: invalid } } }).catch(console.error);
            }
          }
          resolve(parsed);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Push] Error:', err.message);
      resolve(null); // Don't fail the main flow
    });

    req.write(body);
    req.end();
  });
};

module.exports = {
  sendToUser,
  sendToUsers,
  notifyNearbyDrivers,
  notifyDriverAssigned,
  notifyOrderStatus,
};
