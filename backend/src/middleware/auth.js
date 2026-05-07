const { verifyAccessToken } = require('../config/jwt');
const prisma = require('../config/database');

async function verifyFirebaseToken(token) {
  // Try Firebase Admin SDK first (requires FIREBASE_SERVICE_ACCOUNT_JSON)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const { getFirebaseAdmin } = require('../config/firebaseAdmin');
      const decoded = await getFirebaseAdmin().auth().verifyIdToken(token);
      return { phone_number: decoded.phone_number || null, email: decoded.email || null, uid: decoded.uid };
    } catch {
      // Admin SDK failed — fall through to REST API
    }
  }

  // Fallback: Firebase REST API — works with just the API key, no service account needed
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const u = data.users?.[0];
    if (!u) return null;
    return { phone_number: u.phoneNumber || null, email: u.email || null, uid: u.localId };
  } catch {
    return null;
  }
}

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Try Firebase ID token verification
    const firebaseUser = await verifyFirebaseToken(token);
    if (firebaseUser) {
      const { phone_number: phone, email } = firebaseUser;

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
          phone,
          email,
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }

      req.user = user;
      return next();
    }

    // Legacy JWT fallback (admin email/password login)
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
