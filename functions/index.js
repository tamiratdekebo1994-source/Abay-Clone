const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

console.log('Initializing ET SPARK API...');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

console.log('Admin SDK initialized');

// Create Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

console.log('Express app created');

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
// Accepts either a JWT (web admin login) or a Firebase ID token (mobile phone auth).
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  try {
    const decodedJWT = jwt.verify(token, 'et-spark-secret-key');
    req.userId = decodedJWT.uid;
    return next();
  } catch (jwtErr) {
    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);
      req.userId = decodedFirebase.uid;
      return next();
    } catch (firebaseErr) {
      console.error('Token verification failed:', firebaseErr.message);
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
};

// ─── Auth Routes ────────────────────────────────────────────────────────────

app.post('/register', async (req, res) => {
  try {
    if (!auth || !db) {
      return res.status(503).json({ success: false, message: 'Auth service unavailable' });
    }

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
    console.log('Login request received');

    let { email, phone, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    // Hardcoded admin credentials for testing
    const adminPhone = '+251972735128';
    const adminEmail = 'admin@etspark.et';
    const adminPassword = 'Admin@1234';
    const adminUID = 'D5eaxB7sbyTxFahEOL2kX9mqbkN2';

    // Check credentials - accept either phone or email
    let isValid = false;
    if (phone && phone === adminPhone && password === adminPassword) {
      isValid = true;
      email = adminEmail; // Convert phone to email for consistency
    } else if (email && email === adminEmail && password === adminPassword) {
      isValid = true;
    }

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Create JWT token
    const accessToken = jwt.sign(
      { uid: adminUID, email: adminEmail },
      'et-spark-secret-key',
      { expiresIn: '7d' }
    );

    const userData = {
      uid: adminUID,
      email: adminEmail,
      phone: adminPhone,
      fullName: 'ET SPARK Admin',
      role: 'ADMIN',
      isVerified: true
    };

    res.json({
      success: true,
      data: {
        accessToken,
        user: userData
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });

    let uid, isFirebaseToken = false;

    try {
      // Try to verify as JWT token first (web admin login)
      const decodedJWT = jwt.verify(token, 'et-spark-secret-key');
      uid = decodedJWT.uid;
    } catch (jwtErr) {
      // If JWT fails, try Firebase ID token (mobile phone auth)
      try {
        const decodedFirebase = await admin.auth().verifyIdToken(token);
        uid = decodedFirebase.uid;
        isFirebaseToken = true;
      } catch (firebaseErr) {
        console.error('Token verification failed:', firebaseErr.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }

    // Retrieve user from Firestore
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = {
      uid,
      ...userDoc.data()
    };

    // If user is a driver, fetch driver profile
    if (userData.role === 'DRIVER') {
      const driverDoc = await db.collection('drivers').doc(uid).get();
      if (driverDoc.exists) {
        userData.driver = {
          uid,
          ...driverDoc.data()
        };
      }
    }

    res.json({ success: true, data: userData });
  } catch (err) {
    console.error('Auth/me error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to get user' });
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

app.post('/driver/toggle-online', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

    let userId;
    try {
      const decodedJWT = jwt.verify(token, 'et-spark-secret-key');
      userId = decodedJWT.uid;
    } catch (jwtErr) {
      try {
        const decodedFirebase = await admin.auth().verifyIdToken(token);
        userId = decodedFirebase.uid;
      } catch (firebaseErr) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }

    // Get current driver status
    const driverDoc = await db.collection('drivers').doc(userId).get();
    if (!driverDoc.exists) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    const currentStatus = driverDoc.data().status || 'OFFLINE';
    const newStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';

    // Update driver status
    await db.collection('drivers').doc(userId).update({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      data: {
        status: newStatus,
        message: `Driver is now ${newStatus.toLowerCase()}`
      }
    });
  } catch (err) {
    console.error('Toggle online error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Failed to toggle status' });
  }
});

app.post('/driver/register', async (req, res) => {
  try {
    console.log('[DRIVER/REGISTER] Request received');
    console.log('[DRIVER/REGISTER] Headers:', req.headers.authorization ? 'Bearer token present' : 'NO TOKEN');
    console.log('[DRIVER/REGISTER] Body keys:', Object.keys(req.body));

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      console.error('[DRIVER/REGISTER] No token provided');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let userId;
    try {
      const decodedJWT = jwt.verify(token, 'et-spark-secret-key');
      userId = decodedJWT.uid;
      console.log('[DRIVER/REGISTER] JWT token verified, userId:', userId);
    } catch (jwtErr) {
      console.log('[DRIVER/REGISTER] JWT failed, trying Firebase token...');
      try {
        const decodedFirebase = await admin.auth().verifyIdToken(token);
        userId = decodedFirebase.uid;
        console.log('[DRIVER/REGISTER] Firebase token verified, userId:', userId);
      } catch (firebaseErr) {
        console.error('[DRIVER/REGISTER] Firebase token failed:', firebaseErr.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }

    const {
      fullName, dateOfBirth, gender, nationalId, emergencyContactName, emergencyContactPhone,
      city, homeAddress, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehiclePlate,
      licenseNumber, licenseClass, licenseExpiry
    } = req.body;

    console.log('[DRIVER/REGISTER] Validating fields...');
    const missing = [];
    if (!fullName) missing.push('fullName');
    if (!emergencyContactPhone) missing.push('emergencyContactPhone');
    if (!city) missing.push('city');
    if (!vehicleType) missing.push('vehicleType');
    if (!vehiclePlate) missing.push('vehiclePlate');
    if (!licenseNumber) missing.push('licenseNumber');
    if (!licenseExpiry) missing.push('licenseExpiry');

    if (missing.length > 0) {
      console.error('[DRIVER/REGISTER] Missing fields:', missing);
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    console.log('[DRIVER/REGISTER] Saving to Firestore...');
    const docRef = await db.collection('driverApplications').add({
      userId,
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      nationalId: nationalId || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone.trim(),
      city,
      homeAddress: homeAddress || null,
      vehicleType,
      vehicleMake: vehicleMake || null,
      vehicleModel: vehicleModel || null,
      vehicleYear: vehicleYear || null,
      vehicleColor: vehicleColor || null,
      vehiclePlate: vehiclePlate.toUpperCase(),
      licenseNumber: licenseNumber.trim(),
      licenseClass: licenseClass || null,
      licenseExpiry,
      status: 'DRIVER',
      rejectionReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also create driver profile
    await db.collection('drivers').doc(userId).set({
      userId,
      fullName: fullName.trim(),
      city,
      vehicleType,
      vehiclePlate: vehiclePlate.toUpperCase(),
      licenseNumber: licenseNumber.trim(),
      status: 'ACTIVE',
      earnings: 0,
      rating: 0,
      totalRides: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[DRIVER/REGISTER] Success! Application ID:', docRef.id);
    res.json({
      success: true,
      message: 'Driver application submitted successfully',
      data: { applicationId: docRef.id }
    });
  } catch (err) {
    console.error('[DRIVER/REGISTER] Error:', err.message);
    console.error('[DRIVER/REGISTER] Stack:', err.stack);
    res.status(400).json({ success: false, message: err.message || 'Registration failed' });
  }
});

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/driver/earnings', verifyToken, async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const now = new Date();
    let start;
    if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const snapshot = await db.collection('orders')
      .where('driverId', '==', req.userId)
      .get();

    const delivered = snapshot.docs
      .map((doc) => doc.data())
      .filter((o) => o.status === 'DELIVERED' && (o.deliveredAt?.toDate?.() ?? o.createdAt?.toDate?.()) >= start);

    const totalEarnings = delivered.reduce((sum, o) => sum + (o.driverFee || 0), 0);
    const totalDeliveries = delivered.length;
    const avgPerTrip = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

    res.json({
      success: true,
      data: { totalEarnings, totalDeliveries, avgPerTrip, period },
    });
  } catch (err) {
    console.error('Driver earnings error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/driver/orders/nearby', verifyToken, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius) || 10;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const commissionDoc = await db.collection('commissionSettings').doc('default').get();
    const driverCommissionPercent = commissionDoc.exists
      ? (commissionDoc.data().driverCommissionPercent ?? 85)
      : 85;

    const snapshot = await db.collection('orders')
      .where('status', '==', 'SEARCHING_DRIVER')
      .get();

    const storeNameCache = {};
    const nearby = [];

    for (const doc of snapshot.docs) {
      const order = doc.data();
      if (typeof order.pickupLat !== 'number' || typeof order.pickupLng !== 'number') continue;
      if (order.rejectedByDriverIds?.includes(req.userId)) continue;

      const distanceKm = haversineKm(lat, lng, order.pickupLat, order.pickupLng);
      if (distanceKm > radiusKm) continue;

      if (!(order.storeId in storeNameCache)) {
        const storeSnap = await db.collection('stores').where('userId', '==', order.storeId).limit(1).get();
        storeNameCache[order.storeId] = storeSnap.empty ? 'Store' : storeSnap.docs[0].data().storeName;
      }

      const driverFee = order.driverFee ?? Math.round((order.totalAmount || 0) * (driverCommissionPercent / 100));

      nearby.push({
        id: doc.id,
        ...order,
        driverFee,
        distanceKm,
        store: { storeName: storeNameCache[order.storeId] },
      });
    }

    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ success: true, data: nearby });
  } catch (err) {
    console.error('Nearby orders error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/driver/surge', verifyToken, async (req, res) => {
  try {
    const hour = new Date().getHours();
    const peakWindows = [[7, 9], [12, 14], [17, 20]];
    const isSurge = peakWindows.some(([start, end]) => hour >= start && hour < end);

    res.json({
      success: true,
      data: {
        city: req.query.city || 'Addis Ababa',
        isSurge,
        multiplier: isSurge ? 1.5 : 1.0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/driver/push-token', verifyToken, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    await db.collection('drivers').doc(req.userId).set({
      pushToken: token,
      pushPlatform: platform || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Push token registered' });
  } catch (err) {
    console.error('Push token error:', err.message);
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

const ORDER_STATUS_FLOW = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

async function attachStoreName(order) {
  if (!order.storeId) return order;
  const storeSnap = await db.collection('stores').where('userId', '==', order.storeId).limit(1).get();
  return { ...order, store: { storeName: storeSnap.empty ? 'Store' : storeSnap.docs[0].data().storeName } };
}

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

    const order = await attachStoreName({ id: doc.id, ...doc.data() });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/orders/:orderId/accept', verifyToken, async (req, res) => {
  try {
    const orderRef = db.collection('orders').doc(req.params.orderId);

    const order = await db.runTransaction(async (tx) => {
      const doc = await tx.get(orderRef);
      if (!doc.exists) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
      }
      const data = doc.data();
      if (data.status !== 'SEARCHING_DRIVER') {
        const err = new Error('This order has already been taken');
        err.status = 409;
        throw err;
      }

      let driverFee = data.driverFee;
      let distanceKm = data.distanceKm;
      if (driverFee == null || distanceKm == null) {
        const commissionDoc = await db.collection('commissionSettings').doc('default').get();
        const driverCommissionPercent = commissionDoc.exists
          ? (commissionDoc.data().driverCommissionPercent ?? 85)
          : 85;
        driverFee = driverFee ?? Math.round((data.totalAmount || 0) * (driverCommissionPercent / 100));
        distanceKm = distanceKm ?? (
          typeof data.pickupLat === 'number' && typeof data.deliveryLat === 'number'
            ? haversineKm(data.pickupLat, data.pickupLng, data.deliveryLat, data.deliveryLng)
            : null
        );
      }

      const update = {
        driverId: req.userId,
        status: 'DRIVER_ASSIGNED',
        driverFee,
        distanceKm,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      tx.update(orderRef, update);
      return { id: doc.id, ...data, ...update };
    });

    const enriched = await attachStoreName(order);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message || 'Failed to accept order' });
  }
});

app.post('/driver/orders/:orderId/reject', verifyToken, async (req, res) => {
  try {
    await db.collection('orders').doc(req.params.orderId).update({
      rejectedByDriverIds: admin.firestore.FieldValue.arrayUnion(req.userId),
    });
    res.json({ success: true, message: 'Order declined' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/orders/:orderId/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const orderRef = db.collection('orders').doc(req.params.orderId);
    const doc = await orderRef.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Order not found' });
    const data = doc.data();

    if (data.driverId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not assigned to this order' });
    }

    const currentIdx = ORDER_STATUS_FLOW.indexOf(data.status);
    const nextIdx = ORDER_STATUS_FLOW.indexOf(status);
    if (nextIdx === -1 || nextIdx !== currentIdx + 1) {
      return res.status(400).json({ success: false, message: 'Invalid status transition' });
    }

    const update = { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (status === 'DELIVERED') update.deliveredAt = admin.firestore.FieldValue.serverTimestamp();

    await orderRef.update(update);
    res.json({ success: true, data: { status } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/orders', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    const role = userDoc.exists ? userDoc.data().role : null;
    const filterField = role === 'DRIVER' ? 'driverId' : 'storeId';

    let query = db.collection('orders').where(filterField, '==', req.userId);

    const statusParam = req.query.status;
    const statuses = typeof statusParam === 'string' && statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (statuses.length === 1) {
      query = query.where('status', '==', statuses[0]);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    let orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    if (statuses.length > 1) {
      orders = orders.filter((o) => statuses.includes(o.status));
    }

    const total = orders.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const start = (page - 1) * limit;
    const paged = orders.slice(start, start + limit);

    res.json({
      success: true,
      data: {
        orders: paged,
        pagination: { total, page, limit },
      },
    });
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

// ─── Debug endpoint to check user data ──────────────────────────────────────

app.get('/debug/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`Checking user: ${email}`);

    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`Found in Auth: ${user.uid}`);
    } catch (err) {
      return res.json({ success: false, message: `Not in Auth: ${err.message}` });
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    console.log(`Firestore doc exists: ${userDoc.exists}`);

    res.json({
      success: true,
      authUser: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      },
      firestoreDoc: userDoc.exists ? userDoc.data() : null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin Setup (One-time) ─────────────────────────────────────────────────

app.post('/admin/setup-password', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    console.log(`Setting up password for: ${email}, phone: ${phone}`);

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
          phone: phone || userDoc.data().phone,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Document updated`);
      } else {
        // Create new document
        await userRef.set({
          uid: user.uid,
          email: user.email,
          phone: phone,
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
  console.log('Health check endpoint called');
  res.json({
    status: 'ok',
    app: 'ET SPARK API (Firebase)',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    deployed: true,
  });
});

app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'API is working!' });
});

// ─── Export Functions ───────────────────────────────────────────────────────

exports.api = functions
  .region('europe-west1')
  .https.onRequest(app);
