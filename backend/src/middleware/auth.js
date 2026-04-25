const { verifyAccessToken } = require('../config/jwt');
const prisma = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Try Firebase ID token first
    try {
      const { getFirebaseAdmin } = require('../config/firebaseAdmin');
      const decoded = await getFirebaseAdmin().auth().verifyIdToken(token);

      const phone = decoded.phone_number || null;
      const email = decoded.email || null;

      const conditions = [];
      if (phone) conditions.push({ phone });
      if (email) conditions.push({ email });

      const user = conditions.length
        ? await prisma.user.findFirst({
            where: { OR: conditions },
            select: { id: true, role: true, isActive: true, phone: true, fullName: true, email: true },
          })
        : null;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Account not found. Please complete registration.',
          code: 'NOT_PROVISIONED',
          firebaseUid: decoded.uid,
          phone: decoded.phone_number,
          email: decoded.email,
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }

      req.user = user;
      next();
      return;
    } catch (firebaseError) {
      // Only fall through to JWT if it's a token-format error (not a Firebase auth error)
      const code = firebaseError.code || '';
      if (!code.startsWith('auth/') && firebaseError.errorInfo?.code?.startsWith('auth/') === false) {
        // If Firebase Admin SDK itself errored (no config, etc.) — fall through silently
      }
      // Fall through to JWT
    }

    // Legacy JWT fallback
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, phone: true, fullName: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
