const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Create Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware to strip /api prefix (Firebase Hosting rewrites /api/** to this function)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} (original: ${req.url})`);
  if (req.path.startsWith('/api')) {
    const newUrl = req.url.replace(/^\/api/, '') || '/';
    console.log(`Stripping /api prefix: ${req.url} -> ${newUrl}`);
    req.url = newUrl;
  }
  next();
});

// ─── Authentication Middleware ───────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.userId = decodedToken.uid;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Auth Routes ────────────────────────────────────────────────────────────

app.post('/register', async (req, res) => {
  try {
    const { phone, fullName, email, password, role } = req.body;

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email || `${phone}@etspark.et`,
      password,
    });

    // Hash password for local verification
    const passwordHash = await bcrypt.hash(password, 10);

    // Store user data in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      phone,
      fullName,
      email: email || `${phone}@etspark.et`,
      passwordHash,
      role: role || 'STORE',
      isVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'User registered', uid: userRecord.uid });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', { body: req.body, headers: req.headers });

    let { email, phone, password } = req.body;

    if (!email && !phone) {
      console.log('No email or phone provided');
      return res.status(400).json({ success: false, message: 'Email or phone required' });
    }

    if (!password) {
      console.log('No password provided');
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    // Convert phone to email format if phone is provided
    if (phone && !email) {
      email = `${phone}@etspark.et`;
      console.log(`Converted phone ${phone} to email ${email}`);
    }

    // Get user from Firebase Auth by email
    let user;
    try {
      console.log(`Looking up user by email: ${email}`);
      user = await auth.getUserByEmail(email);
      console.log(`User found: ${user.uid}`);
    } catch (err) {
      console.error(`User lookup failed: ${err.code} - ${err.message}`);
      if (err.code === 'auth/user-not-found') {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      throw err;
    }

    // Verify password using bcrypt against stored hash
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists && userDoc.data().passwordHash) {
      const passwordMatch = await bcrypt.compare(password, userDoc.data().passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
    } else {
      // For backwards compatibility with users created before password hashing
      // Just accept the login (this is a temporary measure)
      console.warn(`User ${email} has no password hash, allowing login`);
    }

    // Create custom token for login
    const customToken = await auth.createCustomToken(user.uid);

    // Get user document in Firestore
    let userData = userDoc.exists ? userDoc.data() : {
      uid: user.uid,
      email: user.email,
      fullName: user.displayName || 'User',
      role: 'ADMIN',
      isVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Create document if it doesn't exist
    if (!userDoc.exists) {
      await db.collection('users').doc(user.uid).set(userData);
    }

    res.json({
      success: true,
      data: {
        accessToken: customToken,
        user: { uid: user.uid, ...userData }
      }
    });
  } catch (err) {
    console.error('Login error:', err.message, err.code);
    res.status(401).json({
      success: false,
      message: err.message || 'Invalid credentials'
    });
  }
});

// ─── Driver Routes ──────────────────────────────────────────────────────────

app.get('/drivers', async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'DRIVER')
      .limit(50)
      .get();

    const drivers = [];
    snapshot.forEach(doc => {
      drivers.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: drivers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/drivers', verifyToken, async (req, res) => {
  try {
    const { licenseNumber, vehicleType, plateNumber } = req.body;

    await db.collection('drivers').doc(req.userId).set({
      userId: req.userId,
      licenseNumber,
      vehicleType,
      plateNumber,
      status: 'PENDING',
      earnings: 0,
      rating: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Driver profile created' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Store Routes ───────────────────────────────────────────────────────────

app.get('/stores', async (req, res) => {
  try {
    const snapshot = await db.collection('stores')
      .limit(100)
      .get();

    const stores = [];
    snapshot.forEach(doc => {
      stores.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: stores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/stores', verifyToken, async (req, res) => {
  try {
    const { storeName, address, city } = req.body;

    const docRef = await db.collection('stores').add({
      userId: req.userId,
      storeName,
      address,
      city,
      status: 'PENDING',
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { id: docRef.id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Order Routes ───────────────────────────────────────────────────────────

app.post('/orders', verifyToken, async (req, res) => {
  try {
    const { pickupAddress, deliveryAddress, totalAmount, pickupLat, pickupLng, deliveryLat, deliveryLng } = req.body;

    const docRef = await db.collection('orders').add({
      storeId: req.userId,
      pickupAddress,
      deliveryAddress,
      totalAmount,
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
      status: 'SEARCHING_DRIVER',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { id: docRef.id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/orders/:orderId', async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.orderId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/orders', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('orders')
      .where('storeId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin Routes ───────────────────────────────────────────────────────────

app.get('/admin/dashboard', verifyToken, async (req, res) => {
  try {
    const driversSnapshot = await db.collection('drivers').get();
    const storesSnapshot = await db.collection('stores').get();
    const ordersSnapshot = await db.collection('orders').get();

    const totalRevenue = (await db.collection('orders').get()).docs.reduce((sum, doc) => {
      return sum + (doc.data().totalAmount || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        drivers: { total: driversSnapshot.size },
        stores: { total: storesSnapshot.size },
        orders: { total: ordersSnapshot.size },
        revenue: { total: totalRevenue }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/drivers', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drivers')
      .orderBy('earnings', 'desc')
      .limit(50)
      .get();

    const drivers = [];
    snapshot.forEach(doc => {
      drivers.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: { drivers } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/customers', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('customers')
      .limit(100)
      .get();

    const customers = [];
    snapshot.forEach(doc => {
      customers.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: { customers, total: customers.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/admin/customers/:customerId/block', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('customers').doc(req.params.customerId).update({
      isBlocked: true,
      blockedReason: reason,
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Customer blocked' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/promo-codes', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('promoCodes')
      .limit(50)
      .get();

    const promoCodes = [];
    snapshot.forEach(doc => {
      promoCodes.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: { promoCodes } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/admin/promo-codes', verifyToken, async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses } = req.body;

    const docRef = await db.collection('promoCodes').add({
      code,
      discountType,
      discountValue,
      maxUses,
      usedCount: 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log action
    await db.collection('auditLogs').add({
      userId: req.userId,
      action: 'CREATE_PROMO_CODE',
      resource: 'PROMO_CODE',
      resourceId: docRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { id: docRef.id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/audit-logs', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('auditLogs')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: { logs, total: logs.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/fraud-flags', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('fraudFlags');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const flags = [];
    snapshot.forEach(doc => {
      flags.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: { flags, total: flags.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/admin/fraud-flags', verifyToken, async (req, res) => {
  try {
    const { flagType, severity, description, subjectId } = req.body;

    const docRef = await db.collection('fraudFlags').add({
      flagType,
      severity,
      description,
      subjectId,
      status: 'OPEN',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { id: docRef.id } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/admin/fraud-flags/:flagId/resolve', verifyToken, async (req, res) => {
  try {
    const { status, resolution } = req.body;

    await db.collection('fraudFlags').doc(req.params.flagId).update({
      status,
      resolution,
      resolvedBy: req.userId,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log action
    await db.collection('auditLogs').add({
      userId: req.userId,
      action: 'RESOLVE_FRAUD_FLAG',
      resource: 'FRAUD_FLAG',
      resourceId: req.params.flagId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Fraud flag resolved' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/settings/commission', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('commissionSettings').doc('default').get();

    const data = doc.exists ? doc.data() : {
      platformCommissionPercent: 15,
      driverCommissionPercent: 85,
      minimumOrderValue: 0,
      surgeCommissionBonus: 0.05,
    };

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/admin/settings/commission', verifyToken, async (req, res) => {
  try {
    const { platformCommissionPercent, driverCommissionPercent, minimumOrderValue, surgeCommissionBonus } = req.body;

    if (platformCommissionPercent + driverCommissionPercent !== 100) {
      return res.status(400).json({ success: false, message: 'Commission must equal 100%' });
    }

    await db.collection('commissionSettings').doc('default').set({
      platformCommissionPercent,
      driverCommissionPercent,
      minimumOrderValue,
      surgeCommissionBonus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log action
    await db.collection('auditLogs').add({
      userId: req.userId,
      action: 'UPDATE_COMMISSION',
      resource: 'SETTINGS',
      resourceId: 'commission',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Commission settings updated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Admin Setup (One-time) ─────────────────────────────────────────────────

app.post('/admin/setup-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    console.log(`Setting up password for: ${email}`);

    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`Found user: ${user.uid}`);
    } catch (err) {
      console.error(`User lookup failed: ${err.code} - ${err.message}`);
      return res.status(404).json({ success: false, message: 'User not found in Firebase Auth' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    console.log(`Password hashed`);

    // Try to update existing document
    const userRef = db.collection('users').doc(user.uid);

    try {
      const userDoc = await userRef.get();
      console.log(`Document exists: ${userDoc.exists}`);

      if (userDoc.exists) {
        // Update existing document
        await userRef.update({
          passwordHash,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Document updated`);
      } else {
        // Create new document
        await userRef.set({
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || 'Admin',
          passwordHash,
          role: 'ADMIN',
          isVerified: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Document created`);
      }

      res.json({ success: true, message: 'Password setup complete', userId: user.uid });
    } catch (err) {
      console.error(`Firestore error: ${err.code} - ${err.message}`, err);
      res.status(400).json({
        success: false,
        message: `Firestore error: ${err.message}`,
        code: err.code
      });
    }
  } catch (err) {
    console.error('Setup password error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ET SPARK API (Firebase)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Export Functions ───────────────────────────────────────────────────────

exports.api = functions
  .region('europe-west1')
  .https.onRequest(app);
