const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMessages, sendMessage, getUnreadCount } = require('../controllers/chatController');

router.use(authenticate);

router.get('/unread', getUnreadCount);
router.get('/order/:orderId', getMessages);
router.post('/order/:orderId', sendMessage);

module.exports = router;
