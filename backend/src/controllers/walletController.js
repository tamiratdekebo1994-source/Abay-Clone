const prisma = require('../config/database');
const pushService = require('../services/pushNotificationService');
const emailService = require('../services/emailService');

/**
 * Get driver wallet balance
 */
const getWallet = async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    let wallet = await prisma.wallet.findUnique({
      where: { driverId: driver.id },
      include: { withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    // Auto-create wallet if missing
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { driverId: driver.id },
        include: { withdrawals: true },
      });
    }

    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
};

/**
 * Request a withdrawal
 */
const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, accountNumber, accountName } = req.body;

    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const wallet = await prisma.wallet.findUnique({ where: { driverId: driver.id } });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const withdrawalAmount = parseFloat(amount);
    const MIN_WITHDRAWAL = 100; // ETB 100 minimum

    if (withdrawalAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ETB ${MIN_WITHDRAWAL}`,
      });
    }

    if (withdrawalAmount > wallet.balance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ETB ${wallet.balance.toFixed(2)}`,
      });
    }

    // Check for pending withdrawal
    const pendingWithdrawal = await prisma.walletWithdrawal.findFirst({
      where: { walletId: wallet.id, status: 'PENDING' },
    });

    if (pendingWithdrawal) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending withdrawal request',
      });
    }

    // Deduct from balance and add to pending
    const [withdrawal] = await prisma.$transaction([
      prisma.walletWithdrawal.create({
        data: {
          walletId: wallet.id,
          amount: withdrawalAmount,
          method,
          accountNumber,
          accountName,
          status: 'PENDING',
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: withdrawalAmount },
          pendingAmount: { increment: withdrawalAmount },
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Processing within 24 hours.',
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Process a withdrawal
 */
const processWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId } = req.params;
    // Accept both { action: 'complete'|'fail' } and { status: 'COMPLETED'|'FAILED' }
    const { action, status: bodyStatus, reference, txRef } = req.body;
    const ref = reference || txRef;
    let newStatus;
    if (bodyStatus === 'COMPLETED' || action === 'complete') {
      newStatus = 'COMPLETED';
    } else if (bodyStatus === 'FAILED' || action === 'fail') {
      newStatus = 'FAILED';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use status: COMPLETED or FAILED' });
    }

    const withdrawal = await prisma.walletWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { wallet: true },
    });

    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed' });
    }

    await prisma.$transaction([
      prisma.walletWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: newStatus, reference: ref, processedAt: new Date() },
      }),
      prisma.wallet.update({
        where: { id: withdrawal.walletId },
        data: {
          pendingAmount: { decrement: withdrawal.amount },
          // If completed, record in totalWithdrawn; if failed, refund to balance
          ...(newStatus === 'COMPLETED' && { totalWithdrawn: { increment: withdrawal.amount } }),
          ...(newStatus === 'FAILED' && { balance: { increment: withdrawal.amount } }),
        },
      }),
    ]);

    // Notify driver via push + email
    const walletWithDriver = await prisma.wallet.findUnique({
      where: { id: withdrawal.walletId },
      include: { driver: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
    });
    const driverUser = walletWithDriver?.driver?.user;
    if (driverUser) {
      const pushTitle = newStatus === 'COMPLETED' ? '💰 Withdrawal Processed' : '❌ Withdrawal Failed';
      const pushBody = newStatus === 'COMPLETED'
        ? `ETB ${withdrawal.amount.toFixed(2)} has been sent to your account.`
        : `ETB ${withdrawal.amount.toFixed(2)} withdrawal failed. Amount refunded to your wallet.`;
      pushService.sendToUser(driverUser.id, { title: pushTitle, body: pushBody, data: { type: 'WITHDRAWAL_UPDATE' } }).catch(console.error);

      if (driverUser.email) {
        emailService.sendWithdrawalUpdate(driverUser.email, driverUser.fullName, newStatus, withdrawal.amount).catch(console.error);
      }
    }

    res.json({ success: true, message: `Withdrawal ${newStatus.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get withdrawals filtered by status
 */
const getPendingWithdrawals = async (req, res, next) => {
  try {
    const { status = 'PENDING' } = req.query;
    const validStatuses = ['PENDING', 'COMPLETED', 'FAILED'];
    const where = validStatuses.includes(status) ? { status } : { status: 'PENDING' };

    const withdrawals = await prisma.walletWithdrawal.findMany({
      where,
      include: {
        wallet: {
          include: {
            driver: {
              include: { user: { select: { fullName: true, phone: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: withdrawals });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWallet, requestWithdrawal, processWithdrawal, getPendingWithdrawals };
