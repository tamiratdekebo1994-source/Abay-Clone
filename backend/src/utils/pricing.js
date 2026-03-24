/**
 * Pricing utilities for Abay Driver - Ethiopia
 * All amounts in Ethiopian Birr (ETB)
 */

const PRICING = {
  BASE_FEE: parseFloat(process.env.BASE_FEE_ETB) || 50,
  PER_KM_FEE: parseFloat(process.env.PER_KM_FEE_ETB) || 15,
  PLATFORM_FEE_PERCENT: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 15,
  MIN_FEE: 80,
  SURGE_MULTIPLIER: 1.0,
};

/**
 * Calculate delivery fee based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @param {object} options - Additional options
 * @returns {object} Fee breakdown
 */
const calculateDeliveryFee = (distanceKm, options = {}) => {
  const { isFragile = false, requiresRefrigeration = false, surgeMultiplier = 1.0 } = options;

  let baseFee = PRICING.BASE_FEE;
  let distanceFee = distanceKm * PRICING.PER_KM_FEE;

  // Special cargo surcharges
  if (isFragile) distanceFee *= 1.1;
  if (requiresRefrigeration) distanceFee *= 1.2;

  let subtotal = (baseFee + distanceFee) * surgeMultiplier;
  subtotal = Math.max(subtotal, PRICING.MIN_FEE);

  const platformFee = subtotal * (PRICING.PLATFORM_FEE_PERCENT / 100);
  const driverFee = subtotal - platformFee;
  const totalAmount = subtotal;

  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    baseFee: parseFloat(baseFee.toFixed(2)),
    driverFee: parseFloat(driverFee.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    currency: 'ETB',
  };
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);

module.exports = { calculateDeliveryFee, calculateDistance, PRICING };
