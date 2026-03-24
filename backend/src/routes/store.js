const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { registerStore, getStoreProfile, updateStoreProfile, getStoreDashboard } = require('../controllers/storeController');

router.use(authenticate);
router.use(authorize('STORE'));

router.post('/register', registerStore);
router.get('/profile', getStoreProfile);
router.patch('/profile', updateStoreProfile);
router.get('/dashboard', getStoreDashboard);

module.exports = router;
