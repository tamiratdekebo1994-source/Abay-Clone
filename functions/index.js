const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

console.log('Initializing ET SPARK API...');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
// Cloud Functions (1st gen) already buffers the full request body into req.rawBody before
// Express sees it, so multer's usual approach of streaming directly off `req` finds an
// already-drained stream and fails with "Unexpected end of form". Parsing req.rawBody
// directly with busboy sidesteps that entirely.
function parseSingleFileUpload(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: maxBytes } });
    let fileBuffer = null;
    let fileMimetype = null;
    let sawFile = false;
    let tooLarge = false;

    busboy.on('file', (fieldname, fileStream, info) => {
      sawFile = true;
      fileMimetype = info.mimeType;
      const chunks = [];
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('limit', () => { tooLarge = true; });
      fileStream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('error', (err) => reject(err));
    busboy.on('finish', () => {
      if (tooLarge) return reject(new Error('File exceeds the maximum allowed size'));
      if (!sawFile || !fileBuffer) return reject(new Error('No file uploaded'));
      resolve({ buffer: fileBuffer, mimetype: fileMimetype });
    });

    busboy.end(req.rawBody);
  });
}

const FILE_BASE_URL = 'https://europe-west1-abay-clone-project-36721.cloudfunctions.net/api';

async function uploadImageBuffer(buffer, contentType, destinationPath) {
  // Neither getSignedUrl() (needs iam.serviceAccounts.signBlob, which this project's
  // runtime service account doesn't have) nor makePublic() (fails outright on buckets
  // with Uniform Bucket-Level Access, the default for newly-created buckets, which this
  // one is) are usable here. Simplest robust option: don't try to make the object public
  // at all — just save it, and serve it back through our own /files/* route below using
  // the Admin SDK, which always has full read access to the project's own bucket
  // regardless of ACLs, signing permissions, or bucket-level access settings.
  const bucket = admin.storage().bucket();
  const file = bucket.file(destinationPath);
  await file.save(buffer, { metadata: { contentType } });
  return `${FILE_BASE_URL}/files/${destinationPath}`;
}

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

// Firestore Timestamp fields (createdAt, updatedAt, deliveredAt, ...) come back from doc.data()
// as Timestamp instances, not strings. JSON.stringify-ing them directly produces
// {_seconds, _nanoseconds} objects that `new Date(...)` on the client can't parse ("Invalid Date").
// Converting every response through this before it goes out means no individual route handler
// has to remember to call .toDate() on every timestamp field it happens to pass through.
function sanitizeTimestamps(value) {
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(sanitizeTimestamps);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = sanitizeTimestamps(value[key]);
    return out;
  }
  return value;
}
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(sanitizeTimestamps(body));
  next();
});

// ─── Authentication Middleware ───────────────────────────────────────────────
// Accepts either a JWT (web admin login) or a Firebase ID token (mobile phone auth).
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  try {
    const decodedJWT = jwt.verify(token, 'et-spark-secret-key');
    if (!decodedJWT.uid) return res.status(401).json({ success: false, message: 'Invalid token' });
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

    if (!uid) {
      // Valid JWT (e.g. a REGISTER verificationToken) but not a session token — has no uid.
      return res.status(401).json({ success: false, message: 'Invalid token' });
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

app.patch('/auth/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, email } = req.body;
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'fullName is required' });
    }

    await db.collection('users').doc(req.userId).set({
      fullName: fullName.trim(),
      email: email || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Mock OTP Routes ──────────────────────────────────────────────────────────
// No SMS gateway is configured — every request/verify uses a fixed test code.
// Good enough for development and QA; swap for a real SMS provider before
// handling real driver/store sign-ups.
const MOCK_OTP_CODE = '123456';
const OTP_TTL_MS = 5 * 60 * 1000;

app.post('/auth/otp/request', async (req, res) => {
  try {
    const { phone, purpose } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
    const normalizedPurpose = purpose === 'REGISTER' ? 'REGISTER' : 'LOGIN';

    if (normalizedPurpose === 'LOGIN') {
      const userSnap = await db.collection('users').where('phone', '==', phone).limit(1).get();
      if (userSnap.empty) {
        return res.status(404).json({ success: false, message: 'No account found for this phone number' });
      }
    }

    await db.collection('otpCodes').doc(phone).set({
      code: MOCK_OTP_CODE,
      purpose: normalizedPurpose,
      expiresAt: Date.now() + OTP_TTL_MS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { devCode: MOCK_OTP_CODE } });
  } catch (err) {
    console.error('OTP request error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/auth/otp/verify-register', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ success: false, message: 'Phone and code are required' });

    const otpDoc = await db.collection('otpCodes').doc(phone).get();
    if (!otpDoc.exists) return res.status(400).json({ success: false, message: 'No code was requested for this phone' });
    const otpData = otpDoc.data();
    if (otpData.code !== code) return res.status(400).json({ success: false, message: 'Invalid code' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ success: false, message: 'Code expired. Request a new one.' });

    await db.collection('otpCodes').doc(phone).delete();

    const verificationToken = jwt.sign({ phone, purpose: 'REGISTER' }, 'et-spark-secret-key', { expiresIn: '15m' });
    res.json({ success: true, data: { verificationToken } });
  } catch (err) {
    console.error('OTP verify-register error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/auth/otp/verify-login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ success: false, message: 'Phone and code are required' });

    const otpDoc = await db.collection('otpCodes').doc(phone).get();
    if (!otpDoc.exists) return res.status(400).json({ success: false, message: 'No code was requested for this phone' });
    const otpData = otpDoc.data();
    if (otpData.code !== code) return res.status(400).json({ success: false, message: 'Invalid code' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ success: false, message: 'Code expired. Request a new one.' });

    const userSnap = await db.collection('users').where('phone', '==', phone).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ success: false, message: 'No account found for this phone number' });

    await db.collection('otpCodes').doc(phone).delete();

    const accessToken = jwt.sign({ uid: userSnap.docs[0].id, phone }, 'et-spark-secret-key', { expiresIn: '7d' });
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    console.error('OTP verify-login error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/auth/firebase/provision-simple', async (req, res) => {
  try {
    const { fullName, role, phone, email } = req.body;
    if (!fullName || !role || !phone) {
      return res.status(400).json({ success: false, message: 'fullName, role, and phone are required' });
    }

    const existing = await db.collection('users').where('phone', '==', phone).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'An account with this phone number already exists' });
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({
        phoneNumber: phone,
        email: email || undefined,
        displayName: fullName,
      });
    } catch (createErr) {
      if (createErr.code === 'auth/phone-number-already-exists') {
        // Orphaned Firebase Auth account from earlier testing with no Firestore profile yet — reuse it.
        userRecord = await auth.getUserByPhoneNumber(phone);
      } else {
        throw createErr;
      }
    }

    await db.collection('users').doc(userRecord.uid).set({
      phone,
      fullName,
      email: email || null,
      role,
      isVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const accessToken = jwt.sign({ uid: userRecord.uid, phone }, 'et-spark-secret-key', { expiresIn: '7d' });
    res.json({ success: true, data: { accessToken, uid: userRecord.uid } });
  } catch (err) {
    console.error('Provision-simple error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Registration failed' });
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
      status: 'PENDING',
      rejectionReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also create the driver profile now, but PENDING — the app already knows how to show
    // a "your application is under review" state for this status and blocks going online
    // until an admin approves it via PATCH /admin/driver-applications/:id/approve.
    await db.collection('drivers').doc(userId).set({
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
      status: 'PENDING',
      totalEarnings: 0,
      rating: 0,
      totalDeliveries: 0,
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

// Lets an approved/pending driver update the personal, vehicle, and license
// details captured at registration — /auth/profile only covers fullName/email
// on the users collection, this covers everything else on the drivers doc.
app.patch('/driver/profile', verifyToken, async (req, res) => {
  try {
    const {
      dateOfBirth, nationalId, emergencyContactName, emergencyContactPhone, homeAddress,
      vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehiclePlate,
      licenseNumber, licenseClass, licenseExpiry,
    } = req.body;

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth || null;
    if (nationalId !== undefined) update.nationalId = nationalId || null;
    if (emergencyContactName !== undefined) update.emergencyContactName = emergencyContactName || null;
    if (emergencyContactPhone !== undefined) update.emergencyContactPhone = emergencyContactPhone || null;
    if (homeAddress !== undefined) update.homeAddress = homeAddress || null;
    if (vehicleMake !== undefined) update.vehicleMake = vehicleMake || null;
    if (vehicleModel !== undefined) update.vehicleModel = vehicleModel || null;
    if (vehicleYear !== undefined) update.vehicleYear = vehicleYear || null;
    if (vehicleColor !== undefined) update.vehicleColor = vehicleColor || null;
    if (vehiclePlate !== undefined) update.vehiclePlate = vehiclePlate ? vehiclePlate.toUpperCase() : null;
    if (licenseNumber !== undefined) update.licenseNumber = licenseNumber || null;
    if (licenseClass !== undefined) update.licenseClass = licenseClass || null;
    if (licenseExpiry !== undefined) update.licenseExpiry = licenseExpiry || null;

    await db.collection('drivers').doc(req.userId).set(update, { merge: true });
    res.json({ success: true, message: 'Driver profile updated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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

const ETHIOPIA_UTC_OFFSET_HOURS = 3; // EAT is UTC+3 year-round — no DST to account for

app.get('/driver/activity-heatmap', verifyToken, async (req, res) => {
  try {
    // Aggregates ALL historical orders by hour-of-day (not just "today"), same approach
    // real "popular times"-style charts use — a single day's data isn't a pattern, a
    // typical-hour distribution built from everything seen so far is.
    const snapshot = await db.collection('orders').get();

    const hourCounts = new Array(24).fill(0);
    let totalOrders = 0;

    snapshot.forEach((doc) => {
      const date = doc.data().createdAt?.toDate?.();
      if (!date) return;
      // Cloud Functions run in UTC — bucket by Ethiopia local hour, not the server's,
      // otherwise every order lands ~3 hours off from when it actually happened locally.
      const addisHour = (date.getUTCHours() + ETHIOPIA_UTC_OFFSET_HOURS) % 24;
      hourCounts[addisHour] += 1;
      totalOrders += 1;
    });

    const maxCount = Math.max(...hourCounts);
    const normalized = hourCounts.map((count) => (maxCount > 0 ? count / maxCount : 0));

    res.json({
      success: true,
      data: { hourCounts, normalized, totalOrders },
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

app.patch('/driver/location', verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'lat and lng must be numbers' });
    }

    await db.collection('drivers').doc(req.userId).set({
      location: { lat, lng },
      locationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    console.error('Driver location error:', err.message);
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

    if (status === 'DELIVERED') {
      // Roll up onto the driver's profile — /admin/drivers already sorts by this field,
      // and per-driver earnings elsewhere are computed live from orders, but the admin
      // leaderboard view needs a running total on the driver doc itself.
      await db.collection('drivers').doc(req.userId).update({
        totalEarnings: admin.firestore.FieldValue.increment(data.driverFee || 0),
        totalDeliveries: admin.firestore.FieldValue.increment(1),
      }).catch((err) => console.error('Driver earnings rollup failed:', err.message));

      await createNotification(req.userId, {
        type: 'ORDER_DELIVERED',
        title: 'Delivery completed',
        titleAm: 'ማድረስ ተጠናቅቋል',
        body: `You earned ETB ${(data.driverFee || 0).toFixed(2)} for this delivery.`,
        bodyAm: `ለዚህ ማድረስ ${(data.driverFee || 0).toFixed(2)} ብር አግኝተዋል።`,
      }).catch((err) => console.error('Notification create failed:', err.message));
    }

    res.json({ success: true, data: { status } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/orders/:orderId/review', verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });
    }

    const orderRef = db.collection('orders').doc(req.params.orderId);
    const doc = await orderRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Order not found' });
    const data = doc.data();

    if (data.driverId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not assigned to this order' });
    }
    if (data.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Order must be delivered before it can be reviewed' });
    }
    if (data.review) {
      return res.status(400).json({ success: false, message: 'This order has already been reviewed' });
    }

    const review = { rating: ratingNum, comment: comment || null, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    await orderRef.update({ review });

    // Roll the new rating into the driver's running average.
    await db.runTransaction(async (tx) => {
      const driverRef = db.collection('drivers').doc(req.userId);
      const driverDoc = await tx.get(driverRef);
      const current = driverDoc.data() || {};
      const prevCount = current.ratingCount || 0;
      const prevRating = current.rating || 0;
      const newCount = prevCount + 1;
      const newRating = (prevRating * prevCount + ratingNum) / newCount;
      tx.update(driverRef, { rating: newRating, ratingCount: newCount });
    }).catch((err) => console.error('Driver rating rollup failed:', err.message));

    res.json({ success: true, message: 'Review submitted' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

const CANCELLABLE_STATUSES = ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'];

app.post('/orders/:orderId/cancel', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const orderRef = db.collection('orders').doc(req.params.orderId);
    const doc = await orderRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Order not found' });
    const data = doc.data();

    if (data.driverId !== req.userId && data.storeId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }
    if (!CANCELLABLE_STATUSES.includes(data.status)) {
      return res.status(400).json({ success: false, message: `Order cannot be cancelled from status ${data.status}` });
    }

    await orderRef.update({
      status: 'CANCELLED',
      cancelReason: reason || null,
      cancelledBy: req.userId,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/orders', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    const role = userDoc.exists ? userDoc.data().role : null;
    const filterField = role === 'DRIVER' ? 'driverId' : 'storeId';

    // Single equality filter only — no orderBy/second filter in the Firestore query itself,
    // since combining them requires a manually-created composite index. Filtering and sorting
    // happen in memory instead, which is fine at this collection's current scale.
    const snapshot = await db.collection('orders').where(filterField, '==', req.userId).get();

    let orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    const statusParam = req.query.status;
    const statuses = typeof statusParam === 'string' && statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (statuses.length > 0) {
      orders = orders.filter((o) => statuses.includes(o.status));
    }

    orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

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

// ─── Upload Routes ──────────────────────────────────────────────────────────

app.post('/upload/order/:orderId/cargo', verifyToken, async (req, res) => {
  try {
    const { buffer, mimetype } = await parseSingleFileUpload(req);

    const orderRef = db.collection('orders').doc(req.params.orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).json({ success: false, message: 'Order not found' });
    if (orderDoc.data().driverId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not assigned to this order' });
    }

    const path = `orders/${req.params.orderId}/pod-${uuidv4()}.jpg`;
    const url = await uploadImageBuffer(buffer, mimetype || 'image/jpeg', path);

    await orderRef.update({ podPhotoUrl: url });

    res.json({ success: true, data: { url } });
  } catch (err) {
    console.error('Cargo upload error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Upload failed' });
  }
});

app.post('/upload/avatar', verifyToken, async (req, res) => {
  try {
    const { buffer, mimetype } = await parseSingleFileUpload(req);

    const path = `avatars/${req.userId}-${uuidv4()}.jpg`;
    const url = await uploadImageBuffer(buffer, mimetype || 'image/jpeg', path);

    await db.collection('drivers').doc(req.userId).set({ profilePhotoUrl: url }, { merge: true });
    await db.collection('users').doc(req.userId).set({ profilePhotoUrl: url }, { merge: true });

    res.json({ success: true, data: { avatarUrl: url } });
  } catch (err) {
    console.error('Avatar upload error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Upload failed' });
  }
});

app.get('/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ success: false, message: 'File not found' });

    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    file.createReadStream()
      .on('error', (err) => {
        console.error('File stream error:', err.message);
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);
  } catch (err) {
    console.error('File serve error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Notification Routes ────────────────────────────────────────────────────

async function createNotification(userId, { type, title, titleAm, body, bodyAm }) {
  await db.collection('notifications').add({
    userId, type, title, titleAm: titleAm || null, body, bodyAm: bodyAm || null,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

app.get('/notifications', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('notifications').where('userId', '==', req.userId).get();

    let notifications = [];
    snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));

    notifications.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const limit = Math.max(1, parseInt(req.query.limit, 10) || 30);
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    notifications = notifications.slice(0, limit);

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/notifications/read-all', verifyToken, async (req, res) => {
  try {
    // Single equality filter only, then filter unread in memory — chaining a second
    // .where() here would need a manually-created composite index.
    const snapshot = await db.collection('notifications').where('userId', '==', req.userId).get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      if (doc.data().isRead === false) batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/notifications/:notificationId/read', verifyToken, async (req, res) => {
  try {
    const notifRef = db.collection('notifications').doc(req.params.notificationId);
    const notifDoc = await notifRef.get();
    if (!notifDoc.exists) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notifDoc.data().userId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not your notification' });
    }

    await notifRef.update({ isRead: true });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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

app.get('/admin/driver-applications', verifyToken, async (req, res) => {
  try {
    const statusFilter = req.query.status || 'PENDING';

    const snapshot = await db.collection('driverApplications').get();
    let applications = [];
    snapshot.forEach(doc => applications.push({ id: doc.id, ...doc.data() }));

    if (statusFilter !== 'ALL') {
      applications = applications.filter((a) => a.status === statusFilter);
    }
    applications.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    res.json({ success: true, data: { applications } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/admin/driver-applications/:applicationId/approve', verifyToken, async (req, res) => {
  try {
    const appRef = db.collection('driverApplications').doc(req.params.applicationId);
    const appDoc = await appRef.get();
    if (!appDoc.exists) return res.status(404).json({ success: false, message: 'Application not found' });

    const appData = appDoc.data();
    if (appData.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Application is already ${appData.status}` });
    }

    await appRef.update({ status: 'APPROVED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('drivers').doc(appData.userId).set({
      status: 'ACTIVE',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await createNotification(appData.userId, {
      type: 'DRIVER_STATUS',
      title: 'Application approved!',
      titleAm: 'ማመልከቻ ጸድቋል!',
      body: "You're all set — tap Spark Now to start receiving delivery offers.",
      bodyAm: 'ተዘጋጅተዋል — ትዕዛዞችን ለመቀበል Spark Now ይጫኑ።',
    }).catch((err) => console.error('Notification create failed:', err.message));

    res.json({ success: true, message: 'Driver application approved' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/admin/driver-applications/:applicationId/reject', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const appRef = db.collection('driverApplications').doc(req.params.applicationId);
    const appDoc = await appRef.get();
    if (!appDoc.exists) return res.status(404).json({ success: false, message: 'Application not found' });

    const appData = appDoc.data();
    if (appData.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Application is already ${appData.status}` });
    }

    await appRef.update({
      status: 'REJECTED',
      rejectionReason: reason || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('drivers').doc(appData.userId).set({
      status: 'REJECTED',
      rejectionReason: reason || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await createNotification(appData.userId, {
      type: 'DRIVER_STATUS',
      title: 'Application not approved',
      titleAm: 'ማመልከቻ አልጸደቀም',
      body: reason || 'Contact support for more information.',
      bodyAm: reason || 'ለተጨማሪ መረጃ ድጋፍን ያናጋሩ።',
    }).catch((err) => console.error('Notification create failed:', err.message));

    res.json({ success: true, message: 'Driver application rejected' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/drivers', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drivers')
      .orderBy('totalEarnings', 'desc')
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

    // Equality filter + orderBy on a different field needs a composite index in Firestore —
    // filter/sort/limit in memory instead so no manual index setup is required.
    const snapshot = await db.collection('fraudFlags').get();

    let flags = [];
    snapshot.forEach(doc => {
      flags.push({ id: doc.id, ...doc.data() });
    });

    if (status) {
      flags = flags.filter((f) => f.status === status);
    }
    flags.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    flags = flags.slice(0, 50);

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

app.get('/admin/financial-reports', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('orders').get();
    const orders = [];
    snapshot.forEach(doc => orders.push(doc.data()));

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const delivered = orders.filter((o) => o.status === 'DELIVERED');
    const cancelled = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'FAILED');
    const totalDriverPayouts = delivered.reduce((sum, o) => sum + (o.driverFee || 0), 0);
    const platformEarnings = totalRevenue - totalDriverPayouts;

    const dayBuckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = { date: key, revenue: 0, orders: 0 };
    }
    orders.forEach((o) => {
      const ms = o.createdAt?.toMillis?.();
      if (!ms) return;
      const key = new Date(ms).toISOString().slice(0, 10);
      if (dayBuckets[key]) {
        dayBuckets[key].revenue += o.totalAmount || 0;
        dayBuckets[key].orders += 1;
      }
    });

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalDriverPayouts,
        platformEarnings,
        totalOrders: orders.length,
        deliveredOrders: delivered.length,
        cancelledOrders: cancelled.length,
        last7Days: Object.values(dayBuckets),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/admin/push-notifications', verifyToken, async (req, res) => {
  try {
    const { title, body, titleAm, bodyAm } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body are required' });
    }

    const snapshot = await db.collection('drivers').get();
    const targets = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.pushToken) targets.push({ uid: doc.id, pushToken: data.pushToken });
    });

    // Create the in-app notification for every driver regardless of push token,
    // so it still shows in their Notifications tab even without a device push.
    const allDrivers = [];
    snapshot.forEach(doc => allDrivers.push(doc.id));
    await Promise.all(allDrivers.map((uid) =>
      createNotification(uid, { type: 'SYSTEM', title, titleAm, body, bodyAm })
        .catch((err) => console.error('Notification create failed:', err.message))
    ));

    // Batch to Expo's push API in chunks of 100 messages per request.
    let sent = 0;
    for (let i = 0; i < targets.length; i += 100) {
      const chunk = targets.slice(i, i + 100).map((t) => ({ to: t.pushToken, title, body, sound: 'default' }));
      try {
        await axios.post('https://exp.host/--/api/v2/push/send', chunk, {
          headers: { 'Content-Type': 'application/json' },
        });
        sent += chunk.length;
      } catch (err) {
        console.error('Expo push send failed:', err.message);
      }
    }

    await db.collection('auditLogs').add({
      userId: req.userId,
      action: 'SEND_PUSH_NOTIFICATION',
      resource: 'NOTIFICATION',
      resourceId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: `Notification created for ${allDrivers.length} drivers, push sent to ${sent} device(s)`,
      data: { notifiedCount: allDrivers.length, pushSentCount: sent },
    });
  } catch (err) {
    console.error('Push notification error:', err.message);
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
