/**
 * Payment Routes — TeleBirr & CBE Birr integration stubs
 * Replace the stub implementations with actual gateway SDK calls.
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/database');
const crypto = require('crypto');

router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePayRef(prefix = 'PAY') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function getOrderForPayment(orderId, userId) {
  const store = await prisma.store.findUnique({ where: { userId } });
  if (!store) throw Object.assign(new Error('Store not found'), { status: 404 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: store.id },
  });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.paymentStatus === 'PAID') {
    throw Object.assign(new Error('Order already paid'), { status: 400 });
  }
  return order;
}

// ─── TeleBirr ────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/telebirr/initiate
 * Initiates a TeleBirr STK push / checkout URL for the given order.
 *
 * In production replace the stub block with:
 *   const { TelebirrSDK } = require('telebirr-sdk');
 *   const sdk = new TelebirrSDK({ appId, appKey, shortCode, ... });
 *   const result = await sdk.createH5Payment({ ... });
 */
router.post('/telebirr/initiate', authorize('STORE'), async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' });

    const order = await getOrderForPayment(orderId, req.user.id);
    const payRef = generatePayRef('TBR');

    // ── STUB: replace with real TeleBirr SDK call ──
    const telebirrPayload = {
      appId: process.env.TELEBIRR_APP_ID || 'DEMO_APP_ID',
      shortCode: process.env.TELEBIRR_SHORT_CODE || '1000',
      outTradeNo: payRef,
      subject: `Abay Driver Delivery — ${order.orderNumber}`,
      totalAmount: order.totalAmount.toFixed(2),
      timeoutExpress: '30',
      receiveName: 'Abay Driver PLC',
      notifyUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/telebirr/callback`,
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/store/orders/${orderId}/payment-result`,
    };
    // In production: const { toPayUrl, rawRequest } = await telebirrSDK.createH5Payment(telebirrPayload);
    const toPayUrl = `https://checkout.ethiotelecom.et/pay?ref=${payRef}&amount=${order.totalAmount}`;
    // ── END STUB ──

    // Save payment ref to order
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentRef: payRef, paymentMethod: 'TELEBIRR' },
    });

    res.json({
      success: true,
      data: {
        payRef,
        payUrl: toPayUrl,
        amount: order.totalAmount,
        currency: 'ETB',
        provider: 'TELEBIRR',
        expiresIn: 30 * 60, // 30 minutes
      },
    });
  } catch (err) { next(err); }
});

// TeleBirr callback (webhook from TeleBirr)
router.post('/telebirr/callback', async (req, res, next) => {
  try {
    const { outTradeNo, tradeStatus, transactionNo } = req.body;

    // In production: verify HMAC signature from TeleBirr
    if (!outTradeNo) return res.status(400).send('FAIL');

    const order = await prisma.order.findFirst({ where: { paymentRef: outTradeNo } });
    if (!order) return res.status(404).send('FAIL');

    if (tradeStatus === 'SUCCESS' || tradeStatus === 'TRADE_SUCCESS') {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', paymentRef: transactionNo || outTradeNo },
      });

      // Notify store via socket
      req.io?.to(`store:${order.storeId}`).emit('payment_confirmed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        provider: 'TELEBIRR',
      });
    }

    res.send('SUCCESS');
  } catch (err) { next(err); }
});

// ─── CBE Birr ─────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/cbe/initiate
 * Initiates a CBE Birr payment for the given order.
 */
router.post('/cbe/initiate', authorize('STORE'), async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' });

    const order = await getOrderForPayment(orderId, req.user.id);
    const payRef = generatePayRef('CBE');

    // ── STUB: replace with CBE Merchant API ──
    const cbePayload = {
      merchantId: process.env.CBE_MERCHANT_ID || 'DEMO_MERCHANT',
      orderRef: payRef,
      amount: order.totalAmount,
      currency: 'ETB',
      description: `Abay Driver Delivery — ${order.orderNumber}`,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/cbe/callback`,
    };
    // In production: const { paymentUrl } = await cbeMerchantAPI.createPayment(cbePayload);
    const paymentUrl = `https://cbebirr.et/pay?ref=${payRef}&amount=${order.totalAmount}`;
    // ── END STUB ──

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentRef: payRef, paymentMethod: 'CBE_BIRR' },
    });

    res.json({
      success: true,
      data: {
        payRef,
        payUrl: paymentUrl,
        amount: order.totalAmount,
        currency: 'ETB',
        provider: 'CBE_BIRR',
        expiresIn: 30 * 60,
      },
    });
  } catch (err) { next(err); }
});

// CBE callback
router.post('/cbe/callback', async (req, res, next) => {
  try {
    const { orderRef, status, transactionRef } = req.body;
    if (!orderRef) return res.status(400).send('FAIL');

    const order = await prisma.order.findFirst({ where: { paymentRef: orderRef } });
    if (!order) return res.status(404).send('FAIL');

    if (status === 'SUCCESS') {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', paymentRef: transactionRef || orderRef },
      });
      req.io?.to(`store:${order.storeId}`).emit('payment_confirmed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        provider: 'CBE_BIRR',
      });
    }

    res.send('SUCCESS');
  } catch (err) { next(err); }
});

// ─── Payment status check ──────────────────────────────────────────────────

router.get('/status/:paymentRef', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { paymentRef: req.params.paymentRef },
      select: {
        id: true, orderNumber: true,
        paymentStatus: true, paymentMethod: true,
        paymentRef: true, totalAmount: true,
      },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

module.exports = router;
