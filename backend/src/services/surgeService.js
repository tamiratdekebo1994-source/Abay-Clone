/**
 * Surge Pricing Engine for Fetno
 *
 * Surge is triggered by:
 * 1. Time-of-day (peak hours in Addis Ababa traffic)
 * 2. Demand vs supply ratio (many orders, few online drivers)
 * 3. Weather / holiday overrides (configurable)
 */

const prisma = require('../config/database');

// Addis Ababa peak hours (Ethiopian Standard Time = UTC+3)
const PEAK_HOURS = [
  { start: 7, end: 9, multiplier: 1.3 },    // Morning rush
  { start: 12, end: 14, multiplier: 1.2 },  // Lunch rush
  { start: 17, end: 20, multiplier: 1.4 },  // Evening rush
];

const MAX_SURGE = 2.5; // Never exceed 2.5x

/**
 * Calculate surge multiplier for a given city/time
 */
const getSurgeMultiplier = async (city = 'Addis Ababa') => {
  // Get current hour in Ethiopia (UTC+3)
  const now = new Date();
  const ethiopianHour = (now.getUTCHours() + 3) % 24;

  // Check time-based surge
  let timeSurge = 1.0;
  for (const peak of PEAK_HOURS) {
    if (ethiopianHour >= peak.start && ethiopianHour < peak.end) {
      timeSurge = peak.multiplier;
      break;
    }
  }

  // Check demand vs supply
  const [pendingOrders, onlineDrivers] = await Promise.all([
    prisma.order.count({
      where: { status: 'SEARCHING_DRIVER', createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    }),
    prisma.driver.count({ where: { status: 'ONLINE', city } }),
  ]);

  let demandSurge = 1.0;
  if (onlineDrivers > 0) {
    const ratio = pendingOrders / onlineDrivers;
    if (ratio >= 3) demandSurge = 1.5;
    else if (ratio >= 2) demandSurge = 1.3;
    else if (ratio >= 1.5) demandSurge = 1.2;
  } else if (pendingOrders > 0) {
    demandSurge = 1.8; // No drivers online but demand exists
  }

  // Check DB override (for holidays, events, etc.)
  const zone = await prisma.zone.findFirst({ where: { city, isActive: true } });
  const dbMultiplier = zone?.surgeMultiplier || 1.0;

  // Take the highest applicable surge, capped at MAX_SURGE
  const finalMultiplier = Math.min(
    Math.max(timeSurge, demandSurge, dbMultiplier),
    MAX_SURGE
  );

  return {
    multiplier: parseFloat(finalMultiplier.toFixed(2)),
    isSurge: finalMultiplier > 1.0,
    reason: getSurgeReason(finalMultiplier, timeSurge, demandSurge, ethiopianHour),
    pendingOrders,
    onlineDrivers,
  };
};

const getSurgeReason = (multiplier, timeSurge, demandSurge, hour) => {
  if (multiplier <= 1.0) return null;
  if (demandSurge >= timeSurge) return 'High demand in your area';
  if (hour >= 7 && hour < 9) return 'Morning rush hour';
  if (hour >= 12 && hour < 14) return 'Lunch hour';
  if (hour >= 17 && hour < 20) return 'Evening rush hour';
  return 'Busy period';
};

/**
 * Set manual surge override for a city (admin use)
 */
const setManualSurge = async (city, multiplier) => {
  await prisma.zone.updateMany({
    where: { city, isActive: true },
    data: { surgeMultiplier: Math.min(parseFloat(multiplier), MAX_SURGE) },
  });
};

module.exports = { getSurgeMultiplier, setManualSurge };
