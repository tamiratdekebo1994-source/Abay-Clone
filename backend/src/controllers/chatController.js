const prisma = require('../config/database');
const pushService = require('../services/pushNotificationService');

/**
 * Get chat messages for an order
 */
const getMessages = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true } },
        driver: { select: { userId: true } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Only allow store owner or assigned driver
    const isStore = req.user.role === 'STORE' && order.store?.userId === req.user.id;
    const isDriver = req.user.role === 'DRIVER' && order.driver?.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isStore && !isDriver && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { orderId },
      include: {
        sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread messages as read
    await prisma.chatMessage.updateMany({
      where: { orderId, senderId: { not: req.user.id }, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a chat message
 */
const sendMessage = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { userId: true, storeName: true } },
        driver: { select: { userId: true, user: { select: { fullName: true } } } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isStore = req.user.role === 'STORE' && order.store?.userId === req.user.id;
    const isDriver = req.user.role === 'DRIVER' && order.driver?.userId === req.user.id;

    if (!isStore && !isDriver) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const chatMessage = await prisma.chatMessage.create({
      data: { orderId, senderId: req.user.id, message: message.trim() },
      include: {
        sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
    });

    // Emit via socket to order room
    req.io?.to(`order:${orderId}`).emit('new_chat_message', chatMessage);

    // Push notification to the other party
    const recipientId = isDriver ? order.store?.userId : order.driver?.userId;
    if (recipientId) {
      const senderName = req.user.fullName || (isDriver ? 'Driver' : order.store?.storeName);
      pushService.sendToUser(recipientId, {
        title: `💬 ${senderName}`,
        body: message.trim().slice(0, 100),
        data: { type: 'CHAT_MESSAGE', orderId },
      }).catch(console.error);
    }

    res.status(201).json({ success: true, data: chatMessage });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count per order
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await prisma.chatMessage.count({
      where: {
        order: req.user.role === 'DRIVER'
          ? { driver: { userId: req.user.id } }
          : { store: { userId: req.user.id } },
        senderId: { not: req.user.id },
        isRead: false,
      },
    });

    res.json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMessages, sendMessage, getUnreadCount };
