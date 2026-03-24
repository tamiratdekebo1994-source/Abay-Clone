const { Server } = require('socket.io');
const { verifyAccessToken } = require('../config/jwt');
const prisma = require('../config/database');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, fullName: true },
      });

      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { user } = socket;
    console.log(`[Socket] ${user.role} connected: ${user.fullName} (${socket.id})`);

    // Join user-specific room
    socket.join(`user:${user.id}`);

    if (user.role === 'DRIVER') {
      socket.join('drivers');

      // Join active order room if exists
      const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      if (driver) {
        const activeOrder = await prisma.order.findFirst({
          where: {
            driverId: driver.id,
            status: { in: ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'] },
          },
        });
        if (activeOrder) {
          socket.join(`order:${activeOrder.id}`);
        }

        socket.on('update_location', async (data) => {
          const { lat, lng, speed, heading } = data;
          await prisma.driver.update({
            where: { id: driver.id },
            data: { currentLat: lat, currentLng: lng, lastLocationAt: new Date() },
          });

          if (activeOrder) {
            await prisma.orderTracking.create({
              data: { orderId: activeOrder.id, lat, lng, speed, heading },
            });
            io.to(`order:${activeOrder.id}`).emit('driver_location', { lat, lng, speed, heading });
          }
        });
      }
    }

    if (user.role === 'STORE') {
      const store = await prisma.store.findUnique({ where: { userId: user.id } });
      if (store) {
        socket.join(`store:${store.id}`);
      }
    }

    socket.on('join_order', (orderId) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.fullName}`);
    });
  });

  return io;
};

module.exports = { initSocket };
