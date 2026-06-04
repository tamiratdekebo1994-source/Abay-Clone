const prisma = require('../config/database');
const { calculateDistance } = require('../utils/pricing');
const pushService = require('./pushNotificationService');

const OFFER_TIMEOUT_MS = 30_000;
const MAX_RADIUS_KM = 15;

// orderId -> timeoutId (in-process; timers reset on server restart)
const activeTimers = new Map();

const cancelOrderTimer = (orderId) => {
  const t = activeTimers.get(orderId);
  if (t) { clearTimeout(t); activeTimers.delete(orderId); }
};

const findNextDriver = async (orderId, pickupLat, pickupLng) => {
  const offered = await prisma.orderDriverOffer.findMany({
    where: { orderId },
    select: { driverId: true },
  });
  const excludeIds = offered.map((o) => o.driverId);

  const where = {
    status: 'ONLINE',
    currentLat: { not: null },
    currentLng: { not: null },
  };
  if (excludeIds.length > 0) where.id = { notIn: excludeIds };

  const drivers = await prisma.driver.findMany({
    where,
    select: { id: true, currentLat: true, currentLng: true, userId: true },
  });

  return drivers
    .map((d) => ({ ...d, dist: calculateDistance(pickupLat, pickupLng, d.currentLat, d.currentLng) }))
    .filter((d) => d.dist <= MAX_RADIUS_KM)
    .sort((a, b) => a.dist - b.dist)[0] ?? null;
};

const offerToDriver = async (io, order, driver) => {
  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);

  await prisma.orderDriverOffer.create({
    data: { orderId: order.id, driverId: driver.id, expiresAt, status: 'PENDING' },
  });

  const payload = {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    pickupAddress: order.pickupAddress,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    deliveryAddress: order.deliveryAddress,
    driverFee: order.driverFee,
    distanceKm: order.distanceKm,
    isFragile: order.isFragile,
    requiresRefrigeration: order.requiresRefrigeration,
    store: order.store,
    timeoutSeconds: OFFER_TIMEOUT_MS / 1000,
  };

  io?.to(`driver:${driver.userId}`).emit('new_order_offer', payload);

  pushService.sendToUser(driver.userId, {
    title: '⚡ New Delivery Request!',
    body: `ETB ${order.driverFee?.toFixed(0)} · ${order.distanceKm?.toFixed(1)}km · ${order.pickupAddress}`,
    data: { type: 'NEW_ORDER_OFFER', orderId: order.id },
  }).catch(console.error);

  const timer = setTimeout(() => handleOfferExpiry(io, order.id, driver.id), OFFER_TIMEOUT_MS);
  activeTimers.set(order.id, timer);
};

const handleOfferExpiry = async (io, orderId, driverId) => {
  activeTimers.delete(orderId);
  try {
    await prisma.orderDriverOffer.updateMany({
      where: { orderId, driverId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } });
    if (driver) io?.to(`driver:${driver.userId}`).emit('order_offer_expired', { orderId });
    await advanceToNextDriver(io, orderId);
  } catch (err) {
    console.error('[Assignment] expiry error:', err.message);
  }
};

const advanceToNextDriver = async (io, orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { storeName: true, address: true } } },
    });
    if (!order || order.status !== 'SEARCHING_DRIVER') return;

    const next = await findNextDriver(orderId, order.pickupLat, order.pickupLng);
    if (!next) {
      io?.to(`store:${order.storeId}`).emit('no_driver_found', {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
      return;
    }
    await offerToDriver(io, order, next);
  } catch (err) {
    console.error('[Assignment] advance error:', err.message);
  }
};

const startAssignment = async (io, order) => {
  const driver = await findNextDriver(order.id, order.pickupLat, order.pickupLng);
  if (!driver) {
    // No nearby drivers — broadcast to all online as fallback
    io?.to('drivers').emit('new_order_available', {
      id: order.id, orderId: order.id, orderNumber: order.orderNumber,
      pickupAddress: order.pickupAddress, deliveryAddress: order.deliveryAddress,
      driverFee: order.driverFee, distanceKm: order.distanceKm, store: order.store,
    });
    const timer = setTimeout(() => {
      activeTimers.delete(order.id);
      advanceToNextDriver(io, order.id);
    }, 30_000);
    activeTimers.set(order.id, timer);
    return;
  }
  await offerToDriver(io, order, driver);
};

module.exports = { startAssignment, cancelOrderTimer, advanceToNextDriver };
