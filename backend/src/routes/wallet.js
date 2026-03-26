const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getWallet, requestWithdrawal, processWithdrawal, getPendingWithdrawals } = require('../controllers/walletController');
const validate = require('../middleware/validate');
const walletValidators = require('../validators/wallet');

router.use(authenticate);

// Driver routes
router.get('/', authorize('DRIVER'), getWallet);
router.post('/withdraw', authorize('DRIVER'), validate(walletValidators.requestWithdrawal), requestWithdrawal);

// Admin routes
router.get('/pending', authorize('ADMIN'), getPendingWithdrawals);
router.patch('/:withdrawalId/process', authorize('ADMIN'), validate(walletValidators.processWithdrawal), processWithdrawal);

module.exports = router;
