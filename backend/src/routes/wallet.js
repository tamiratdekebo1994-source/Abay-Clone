const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getWallet, requestWithdrawal, processWithdrawal, getPendingWithdrawals } = require('../controllers/walletController');

router.use(authenticate);

// Driver routes
router.get('/', authorize('DRIVER'), getWallet);
router.post('/withdraw', authorize('DRIVER'), requestWithdrawal);

// Admin routes
router.get('/pending', authorize('ADMIN'), getPendingWithdrawals);
router.patch('/:withdrawalId/process', authorize('ADMIN'), processWithdrawal);

module.exports = router;
