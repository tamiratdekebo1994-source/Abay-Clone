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

// Finishes the web store-signup flow: exchanges the phone-verified JWT from
// POST /auth/otp/verify-register for a real account, same underlying logic as
// /auth/firebase/provision-simple but driven by the verification token (so the
// phone number can't be spoofed by the client) rather than a raw phone field.
app.post('/auth/register/complete', async (req, res) => {
  try {
    const { verificationToken, fullName, email, role } = req.body;
    if (!verificationToken || !fullName || !role) {
      return res.status(400).json({ success: false, message: 'verificationToken, fullName, and role are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(verificationToken, 'et-spark-secret-key');
    } catch {
      return res.status(401).json({ success: false, message: 'Verification expired — please verify your phone again' });
    }
    if (decoded.purpose !== 'REGISTER' || !decoded.phone) {
      return res.status(401).json({ success: false, message: 'Invalid verification token' });
    }
    const phone = decoded.phone;

    const existing = await db.collection('users').where('phone', '==', phone).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'An account with this phone number already exists' });
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({ phoneNumber: phone, email: email || undefined, displayName: fullName });
    } catch (createErr) {
      if (createErr.code === 'auth/phone-number-already-exists') {
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
    res.json({
      success: true,
      data: { accessToken, user: { uid: userRecord.uid, fullName, phone, email: email || null, role } },
    });
  } catch (err) {
    console.error('Register/complete error:', err.message);
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

const SURGE_CITIES = ['Addis Ababa', 'Dire Dawa', 'Hawassa', 'Bahir Dar', 'Mekelle', 'Adama', 'Jimma', 'Dessie', 'Gondar'];
const SURGE_PEAK_WINDOWS = [
  { start: 7, end: 9, multiplier: 1.3, reason: 'Morning rush' },
  { start: 12, end: 14, multiplier: 1.2, reason: 'Lunch rush' },
  { start: 17, end: 20, multiplier: 1.4, reason: 'Evening rush' },
];

// A manual admin override (set via PATCH /admin/surge) always wins; otherwise falls
// back to a fixed Addis-time peak-hour schedule. Shared by /driver/surge,
// /admin/surge, and the order fare estimate so all three agree on the same number.
async function computeSurgeForCity(city) {
  const overrideDoc = await db.collection('surgeOverrides').doc(city).get();
  const manualOverride = overrideDoc.exists ? (overrideDoc.data().multiplier || 1.0) : 1.0;
  if (manualOverride > 1.0) {
    return { city, isSurge: true, multiplier: manualOverride, reason: 'Manual override', manualOverride };
  }

  const hour = (new Date().getUTCHours() + ETHIOPIA_UTC_OFFSET_HOURS) % 24;
  const active = SURGE_PEAK_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  if (active) {
    return { city, isSurge: true, multiplier: active.multiplier, reason: active.reason, manualOverride: 1.0 };
  }
  return { city, isSurge: false, multiplier: 1.0, reason: null, manualOverride: 1.0 };
}

app.get('/driver/surge', verifyToken, async (req, res) => {
  try {
    const surge = await computeSurgeForCity(req.query.city || 'Addis Ababa');
    res.json({ success: true, data: surge });
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

// The store-signup flow's final step (RegisterPage.jsx) — separate from the
// generic POST /stores above, which only captures a minimal subset of fields.
app.post('/store/register', verifyToken, async (req, res) => {
  try {
    const { storeName, storeType, address, city, subcity, phone, description, lat, lng } = req.body;
    if (!storeName || !city || !address) {
      return res.status(400).json({ success: false, message: 'storeName, city, and address are required' });
    }

    const existing = await db.collection('stores').where('userId', '==', req.userId).limit(1).get();
    const payload = {
      userId: req.userId,
      storeName,
      storeType: storeType || 'OTHER',
      address,
      city,
      subcity: subcity || null,
      phone: phone || null,
      description: description || null,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      isVerified: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let storeId;
    if (existing.empty) {
      const docRef = await db.collection('stores').add({
        ...payload,
        status: 'PENDING',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      storeId = docRef.id;
    } else {
      storeId = existing.docs[0].id;
      await db.collection('stores').doc(storeId).set(payload, { merge: true });
    }

    res.json({ success: true, data: { id: storeId } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

async function getStoreDocByUserId(userId) {
  const snap = await db.collection('stores').where('userId', '==', userId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

app.get('/store/profile', verifyToken, async (req, res) => {
  try {
    const storeDoc = await getStoreDocByUserId(req.userId);
    if (!storeDoc) {
      return res.status(404).json({ success: false, message: 'Store profile not found' });
    }

    const ordersSnap = await db.collection('orders').where('storeId', '==', req.userId).get();

    res.json({
      success: true,
      data: { id: storeDoc.id, ...storeDoc.data(), _count: { orders: ordersSnap.size } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/store/profile', verifyToken, async (req, res) => {
  try {
    const storeDoc = await getStoreDocByUserId(req.userId);
    if (!storeDoc) {
      return res.status(404).json({ success: false, message: 'Store profile not found' });
    }

    const { storeName, storeType, phone, address, city, subcity, woreda, description } = req.body;
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (storeName !== undefined) update.storeName = storeName;
    if (storeType !== undefined) update.storeType = storeType;
    if (phone !== undefined) update.phone = phone;
    if (address !== undefined) update.address = address;
    if (city !== undefined) update.city = city;
    if (subcity !== undefined) update.subcity = subcity;
    if (woreda !== undefined) update.woreda = woreda;
    if (description !== undefined) update.description = description;

    await db.collection('stores').doc(storeDoc.id).set(update, { merge: true });
    res.json({ success: true, data: update });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/store/dashboard', verifyToken, async (req, res) => {
  try {
    const ordersSnap = await db.collection('orders').where('storeId', '==', req.userId).get();
    const orders = [];
    ordersSnap.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const todayKey = addisDateKey(new Date());
    let todayOrders = 0, activeOrders = 0, completedOrders = 0, totalSpent = 0;
    orders.forEach((o) => {
      const createdKey = o.createdAt?.toDate ? addisDateKey(o.createdAt.toDate()) : null;
      if (createdKey === todayKey) todayOrders += 1;
      if (o.status === 'DELIVERED') {
        completedOrders += 1;
        totalSpent += o.totalAmount || 0;
      } else if (ACTIVE_ORDER_STATUSES.includes(o.status)) {
        activeOrders += 1;
      }
    });

    const recentOrders = await Promise.all(
      orders.slice(0, 10).map((o) => attachDriverInfo(o))
    );

    res.json({
      success: true,
      data: {
        stats: { todayOrders, activeOrders, completedOrders, totalSpent },
        recentOrders,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Order Routes ───────────────────────────────────────────────────────────

const ORDER_STATUS_FLOW = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

// Base fare model: flat starting fee + per-km rate, with the fragile/refrigeration
// surcharges shown on the create-order form (+10%/+20%) and the current city surge
// multiplier applied on top. Shared by the live estimate and order creation itself,
// so what a store sees while filling out the form is what actually gets charged.
const BASE_FARE_ETB = 30;
const PER_KM_RATE_ETB = 8;

async function computeFareEstimate({ pickupLat, pickupLng, deliveryLat, deliveryLng, isFragile, requiresRefrigeration, city }) {
  const distanceKm = haversineKm(Number(pickupLat), Number(pickupLng), Number(deliveryLat), Number(deliveryLng));

  let subtotal = BASE_FARE_ETB + distanceKm * PER_KM_RATE_ETB;
  if (isFragile) subtotal *= 1.10;
  if (requiresRefrigeration) subtotal *= 1.20;

  const surge = await computeSurgeForCity(city || 'Addis Ababa');
  const totalAmount = Math.round(subtotal * surge.multiplier);

  const commissionDoc = await db.collection('commissionSettings').doc('default').get();
  const driverCommissionPercent = commissionDoc.exists ? (commissionDoc.data().driverCommissionPercent ?? 85) : 85;
  const driverFee = Math.round(totalAmount * (driverCommissionPercent / 100));
  const platformFee = totalAmount - driverFee;

  return { distanceKm: Math.round(distanceKm * 10) / 10, totalAmount, driverFee, platformFee, surge };
}

async function getRequestingStoreCity(userId) {
  const storeSnap = await db.collection('stores').where('userId', '==', userId).limit(1).get();
  return storeSnap.empty ? 'Addis Ababa' : (storeSnap.docs[0].data().city || 'Addis Ababa');
}

async function attachStoreName(order) {
  if (!order.storeId) return order;
  const storeSnap = await db.collection('stores').where('userId', '==', order.storeId).limit(1).get();
  return { ...order, store: { storeName: storeSnap.empty ? 'Store' : storeSnap.docs[0].data().storeName } };
}

async function attachDriverInfo(order) {
  if (!order.driverId) return order;
  const [driverDoc, userDoc] = await Promise.all([
    db.collection('drivers').doc(order.driverId).get(),
    db.collection('users').doc(order.driverId).get(),
  ]);
  if (!driverDoc.exists) return order;
  return {
    ...order,
    driver: {
      ...driverDoc.data(),
      user: userDoc.exists ? { fullName: userDoc.data().fullName, phone: userDoc.data().phone } : null,
    },
  };
}

app.post('/orders/estimate', verifyToken, async (req, res) => {
  try {
    const { pickupLat, pickupLng, deliveryLat, deliveryLng, isFragile, requiresRefrigeration } = req.body;
    if ([pickupLat, pickupLng, deliveryLat, deliveryLng].some((v) => v === undefined || v === null || v === '')) {
      return res.status(400).json({ success: false, message: 'Pickup and delivery coordinates are required' });
    }

    const city = await getRequestingStoreCity(req.userId);
    const estimate = await computeFareEstimate({ pickupLat, pickupLng, deliveryLat, deliveryLng, isFragile, requiresRefrigeration, city });

    res.json({ success: true, data: estimate });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/orders', verifyToken, async (req, res) => {
  try {
    const {
      pickupAddress, pickupNotes, deliveryAddress, deliveryNotes,
      pickupLat, pickupLng, deliveryLat, deliveryLng,
      recipientName, recipientPhone, description, weight,
      isFragile, requiresRefrigeration, paymentMethod,
    } = req.body;

    const city = await getRequestingStoreCity(req.userId);
    const { distanceKm, totalAmount, driverFee, platformFee, surge } = await computeFareEstimate({
      pickupLat, pickupLng, deliveryLat, deliveryLng, isFragile, requiresRefrigeration, city,
    });
    const orderNumber = String(Math.floor(100000 + Math.random() * 900000));

    const docRef = await db.collection('orders').add({
      storeId: req.userId,
      orderNumber,
      pickupAddress: pickupAddress || '',
      pickupNotes: pickupNotes || null,
      deliveryAddress: deliveryAddress || '',
      deliveryNotes: deliveryNotes || null,
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      deliveryLat: Number(deliveryLat),
      deliveryLng: Number(deliveryLng),
      recipientName: recipientName || '',
      recipientPhone: recipientPhone || '',
      description: description || '',
      weight: weight ? Number(weight) : null,
      isFragile: !!isFragile,
      requiresRefrigeration: !!requiresRefrigeration,
      paymentMethod: paymentMethod || 'CASH',
      distanceKm,
      totalAmount,
      driverFee,
      platformFee,
      surgeMultiplier: surge.multiplier,
      status: 'SEARCHING_DRIVER',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: { id: docRef.id, orderNumber, totalAmount } });
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

    let order = await attachStoreName({ id: doc.id, ...doc.data() });
    order = await attachDriverInfo(order);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public — powers the customer-facing tracking link (no login), same shape as
// GET /orders/:orderId above.
app.get('/track/:orderId', async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.orderId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let order = await attachStoreName({ id: doc.id, ...doc.data() });
    order = await attachDriverInfo(order);
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
        pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
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

const ACTIVE_ORDER_STATUSES = ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'];

// Addis Ababa is UTC+3 with no DST — used everywhere else in this file for
// day/hour bucketing so "today" lines up with the driver's actual local day
// rather than the server's UTC day.
function addisDateKey(date) {
  const shifted = new Date(date.getTime() + ETHIOPIA_UTC_OFFSET_HOURS * 3600 * 1000);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD in Addis-local terms
}

app.get('/admin/dashboard', verifyToken, async (req, res) => {
  try {
    const [driversSnapshot, storesSnapshot, ordersSnapshot] = await Promise.all([
      db.collection('drivers').get(),
      db.collection('stores').get(),
      db.collection('orders').get(),
    ]);

    const todayKey = addisDateKey(new Date());
    let onlineDrivers = 0, pendingDrivers = 0;
    driversSnapshot.forEach((doc) => {
      const status = doc.data().status;
      if (status === 'ONLINE') onlineDrivers += 1;
      if (status === 'PENDING') pendingDrivers += 1;
    });

    let totalRevenue = 0, todayRevenue = 0, activeOrders = 0, completedOrders = 0;
    ordersSnapshot.forEach((doc) => {
      const o = doc.data();
      totalRevenue += o.totalAmount || 0;
      if (o.status === 'DELIVERED') {
        completedOrders += 1;
        const deliveredKey = o.deliveredAt?.toDate ? addisDateKey(o.deliveredAt.toDate()) : null;
        if (deliveredKey === todayKey) todayRevenue += o.totalAmount || 0;
      } else if (ACTIVE_ORDER_STATUSES.includes(o.status)) {
        activeOrders += 1;
      }
    });

    res.json({
      success: true,
      data: {
        drivers: { total: driversSnapshot.size, online: onlineDrivers, pending: pendingDrivers },
        stores: { total: storesSnapshot.size },
        orders: { total: ordersSnapshot.size, active: activeOrders, completed: completedOrders },
        revenue: { total: totalRevenue, today: todayRevenue },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/analytics', verifyToken, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.period, 10) || 7));

    const dayKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(addisDateKey(new Date(Date.now() - i * 24 * 3600 * 1000)));
    }
    const byDay = Object.fromEntries(dayKeys.map((k) => [k, { orders: 0, revenue: 0, newDrivers: 0 }]));
    const dayLabel = (key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    const [ordersSnapshot, driversSnapshot] = await Promise.all([
      db.collection('orders').get(),
      db.collection('drivers').get(),
    ]);

    let totalRevenue = 0;
    ordersSnapshot.forEach((doc) => {
      const o = doc.data();
      if (!o.createdAt?.toDate) return;
      const key = addisDateKey(o.createdAt.toDate());
      if (!byDay[key]) return;
      byDay[key].orders += 1;
      if (o.status === 'DELIVERED') {
        byDay[key].revenue += o.totalAmount || 0;
        totalRevenue += o.totalAmount || 0;
      }
    });

    driversSnapshot.forEach((doc) => {
      const d = doc.data();
      if (!d.createdAt?.toDate) return;
      const key = addisDateKey(d.createdAt.toDate());
      if (byDay[key]) byDay[key].newDrivers += 1;
    });

    const timeSeries = dayKeys.map((key) => ({ day: dayLabel(key), ...byDay[key] }));

    res.json({ success: true, data: { summary: { totalRevenue }, timeSeries } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/surge', verifyToken, async (req, res) => {
  try {
    const [driversSnapshot, storesSnapshot, ordersSnapshot] = await Promise.all([
      db.collection('drivers').get(),
      db.collection('stores').get(),
      db.collection('orders').get(),
    ]);

    const onlineByCity = {};
    driversSnapshot.forEach((doc) => {
      const d = doc.data();
      if (d.status === 'ONLINE' && d.city) onlineByCity[d.city] = (onlineByCity[d.city] || 0) + 1;
    });

    const cityByStoreUserId = {};
    storesSnapshot.forEach((doc) => {
      const s = doc.data();
      if (s.userId) cityByStoreUserId[s.userId] = s.city;
    });

    const pendingByCity = {};
    ordersSnapshot.forEach((doc) => {
      const o = doc.data();
      if (!ACTIVE_ORDER_STATUSES.includes(o.status)) return;
      const city = cityByStoreUserId[o.storeId];
      if (city) pendingByCity[city] = (pendingByCity[city] || 0) + 1;
    });

    const surgeData = await Promise.all(SURGE_CITIES.map(async (city) => {
      const surge = await computeSurgeForCity(city);
      return {
        city,
        onlineDrivers: onlineByCity[city] || 0,
        pendingOrders: pendingByCity[city] || 0,
        ...surge,
      };
    }));

    res.json({ success: true, data: surgeData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/admin/surge', verifyToken, async (req, res) => {
  try {
    const { city, multiplier } = req.body;
    const value = Number(multiplier);
    if (!city || !SURGE_CITIES.includes(city)) {
      return res.status(400).json({ success: false, message: 'Invalid city' });
    }
    if (isNaN(value) || value < 1.0 || value > 2.5) {
      return res.status(400).json({ success: false, message: 'Multiplier must be between 1.0 and 2.5' });
    }

    await db.collection('surgeOverrides').doc(city).set({
      multiplier: value,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.userId,
    });

    res.json({ success: true, message: `${city} surge set to ${value}x` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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

async function attachUserInfo(docs) {
  const userIds = [...new Set(docs.map((d) => d.id))];
  const userDocs = await Promise.all(userIds.map((id) => db.collection('users').doc(id).get()));
  const userById = Object.fromEntries(userDocs.map((d) => [d.id, d.exists ? d.data() : null]));
  return docs.map((d) => ({
    ...d,
    user: userById[d.id] ? { fullName: userById[d.id].fullName, phone: userById[d.id].phone } : null,
  }));
}

app.get('/admin/drivers', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drivers').get();
    let drivers = [];
    snapshot.forEach(doc => drivers.push({ id: doc.id, ...doc.data() }));

    const statusFilter = req.query.status;
    if (statusFilter) drivers = drivers.filter((d) => d.status === statusFilter);
    drivers.sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0));

    const total = drivers.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 15);
    const paged = await attachUserInfo(drivers.slice((page - 1) * limit, page * limit));

    res.json({ success: true, data: { drivers: paged, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const DRIVER_ACTION_STATUS = { approve: 'OFFLINE', suspend: 'SUSPENDED' };

app.post('/admin/drivers/:driverId/action', verifyToken, async (req, res) => {
  try {
    const { action } = req.body;
    const newStatus = DRIVER_ACTION_STATUS[action];
    if (!newStatus) {
      return res.status(400).json({ success: false, message: 'action must be "approve" or "suspend"' });
    }

    await db.collection('drivers').doc(req.params.driverId).set({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, data: { status: newStatus } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/orders', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('orders').get();
    let orders = [];
    snapshot.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));

    const statusParam = req.query.status;
    const statuses = typeof statusParam === 'string' && statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (statuses.length > 0) orders = orders.filter((o) => statuses.includes(o.status));

    orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const total = orders.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 15);
    const paged = orders.slice((page - 1) * limit, page * limit);

    const withStoreAndDriver = await Promise.all(
      paged.map(async (o) => attachDriverInfo(await attachStoreName(o)))
    );

    res.json({ success: true, data: { orders: withStoreAndDriver, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/drivers/earnings', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drivers').get();
    let drivers = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      drivers.push({
        id: doc.id,
        ...d,
        unpaidAmount: d.totalEarnings || 0,
        unpaidOrders: d.totalDeliveries || 0,
      });
    });

    const sortBy = req.query.sortBy === 'rating' ? 'rating' : 'totalEarnings';
    drivers.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

    const totalUnpaidEarnings = drivers.reduce((sum, d) => sum + (d.unpaidAmount || 0), 0);
    const total = drivers.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 30);
    const paged = await attachUserInfo(drivers.slice((page - 1) * limit, page * limit));

    res.json({ success: true, data: { drivers: paged, total, totalUnpaidEarnings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/customers', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('customers').get();
    let customers = [];
    snapshot.forEach(doc => customers.push({ id: doc.id, ...doc.data() }));

    const isBlockedFilter = req.query.isBlocked;
    if (isBlockedFilter === 'true') customers = customers.filter((c) => c.isBlocked);
    else if (isBlockedFilter === 'false') customers = customers.filter((c) => !c.isBlocked);

    const total = customers.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const paged = customers.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: { customers: paged, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/admin/customers/:customerId/block', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('customers').doc(req.params.customerId).set({
      isBlocked: true,
      blockedReason: reason,
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Customer blocked' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/admin/customers/:customerId/unblock', verifyToken, async (req, res) => {
  try {
    await db.collection('customers').doc(req.params.customerId).set({
      isBlocked: false,
      blockedReason: null,
      unblockedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Customer unblocked' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/stores', verifyToken, async (req, res) => {
  try {
    const [storesSnapshot, ordersSnapshot] = await Promise.all([
      db.collection('stores').get(),
      db.collection('orders').get(),
    ]);

    const orderCountByStoreUserId = {};
    ordersSnapshot.forEach((doc) => {
      const storeId = doc.data().storeId;
      if (storeId) orderCountByStoreUserId[storeId] = (orderCountByStoreUserId[storeId] || 0) + 1;
    });

    let stores = [];
    storesSnapshot.forEach((doc) => {
      const s = doc.data();
      stores.push({ id: doc.id, ...s, _count: { orders: orderCountByStoreUserId[s.userId] || 0 } });
    });
    stores.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const total = stores.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 15);
    const paged = stores.slice((page - 1) * limit, page * limit);

    const userDocs = await Promise.all(paged.map((s) => db.collection('users').doc(s.userId).get()));
    const withUser = paged.map((s, i) => ({
      ...s,
      user: userDocs[i].exists ? { fullName: userDocs[i].data().fullName, phone: userDocs[i].data().phone, isActive: userDocs[i].data().isActive !== false } : null,
    }));

    res.json({ success: true, data: { stores: withUser, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/admin/stores/:storeId/status', verifyToken, async (req, res) => {
  try {
    const { action } = req.body;
    const storeRef = db.collection('stores').doc(req.params.storeId);
    const storeDoc = await storeRef.get();
    if (!storeDoc.exists) return res.status(404).json({ success: false, message: 'Store not found' });

    if (action === 'verify' || action === 'unverify') {
      await storeRef.set({ isVerified: action === 'verify' }, { merge: true });
    } else if (action === 'suspend' || action === 'unsuspend') {
      const storeUserId = storeDoc.data().userId;
      await db.collection('users').doc(storeUserId).set({ isActive: action === 'unsuspend' }, { merge: true });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    res.json({ success: true, message: `Store ${action}ed` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Wallet Withdrawals (admin review) ─────────────────────────────────────
// There's currently no in-app way for a driver to request a withdrawal, so this
// collection is empty until that flow exists elsewhere — but the admin review
// page itself works correctly against it rather than crashing.
app.get('/wallet/pending', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('withdrawals').get();
    let withdrawals = [];
    snapshot.forEach((doc) => withdrawals.push({ id: doc.id, ...doc.data() }));

    const statusFilter = req.query.status;
    if (statusFilter) withdrawals = withdrawals.filter((w) => w.status === statusFilter);
    withdrawals.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const driverIds = [...new Set(withdrawals.map((w) => w.driverId).filter(Boolean))];
    const [driverDocs, userDocs] = await Promise.all([
      Promise.all(driverIds.map((id) => db.collection('drivers').doc(id).get())),
      Promise.all(driverIds.map((id) => db.collection('users').doc(id).get())),
    ]);
    const driverById = Object.fromEntries(driverDocs.map((d, i) => [driverIds[i], {
      ...(d.exists ? d.data() : {}),
      user: userDocs[i].exists ? { fullName: userDocs[i].data().fullName, phone: userDocs[i].data().phone } : null,
    }]));

    const withWallet = withdrawals.map((w) => ({
      ...w,
      createdAt: w.createdAt?.toDate?.().toISOString() ?? null,
      wallet: { driver: driverById[w.driverId] || null },
    }));

    res.json({ success: true, data: { withdrawals: withWallet } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/wallet/:withdrawalId/process', verifyToken, async (req, res) => {
  try {
    const { status, txRef, failureReason } = req.body;
    if (!['COMPLETED', 'FAILED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be COMPLETED or FAILED' });
    }

    const update = {
      status,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: req.userId,
    };
    if (txRef) update.reference = txRef;
    if (status === 'FAILED' && failureReason) update.failureReason = failureReason;

    await db.collection('withdrawals').doc(req.params.withdrawalId).set(update, { merge: true });
    res.json({ success: true, message: `Withdrawal marked ${status.toLowerCase()}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/admin/promo-codes', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('promoCodes').get();
    const allCodes = [];
    snapshot.forEach(doc => allCodes.push({ id: doc.id, ...doc.data() }));
    allCodes.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const total = allCodes.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const codes = allCodes.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: { codes, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/admin/promo-codes', verifyToken, async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      maxUses, minOrderAmount, maxDiscount, validFrom, validTo,
    } = req.body;
    if (!code || !discountType || discountValue == null) {
      return res.status(400).json({ success: false, message: 'code, discountType, and discountValue are required' });
    }

    const docRef = await db.collection('promoCodes').add({
      code: String(code).toUpperCase(),
      description: description || null,
      discountType,
      discountValue: Number(discountValue),
      maxUses: maxUses != null ? Number(maxUses) : null,
      minOrderAmount: minOrderAmount != null ? Number(minOrderAmount) : 0,
      maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
      validFrom: validFrom || null,
      validTo: validTo || null,
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

app.patch('/admin/promo-codes/:codeId/deactivate', verifyToken, async (req, res) => {
  try {
    await db.collection('promoCodes').doc(req.params.codeId).set({
      isActive: false,
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'Promo code deactivated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── CSV Exports ────────────────────────────────────────────────────────────
// downloadCSV() on the frontend fetches these directly (not through the axios
// `api` instance) and expects a raw file body, not the {success, data} envelope
// every other endpoint uses.

function toCsv(rows, columns) {
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [columns.map((c) => escape(c.label)).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => escape(c.value(row))).join(',')));
  return lines.join('\r\n');
}

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

app.get('/admin/export/drivers.csv', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drivers').get();
    let drivers = [];
    snapshot.forEach((doc) => drivers.push({ id: doc.id, ...doc.data() }));
    drivers = await attachUserInfo(drivers);
    drivers.sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0));

    const csv = toCsv(drivers, [
      { label: 'Full Name', value: (d) => d.user?.fullName },
      { label: 'Phone', value: (d) => d.user?.phone },
      { label: 'City', value: (d) => d.city },
      { label: 'Vehicle Type', value: (d) => d.vehicleType },
      { label: 'Vehicle Plate', value: (d) => d.vehiclePlate },
      { label: 'License Number', value: (d) => d.licenseNumber },
      { label: 'License Expiry', value: (d) => d.licenseExpiry },
      { label: 'Status', value: (d) => d.status },
      { label: 'Rating', value: (d) => d.rating ?? 0 },
      { label: 'Total Deliveries', value: (d) => d.totalDeliveries ?? 0 },
      { label: 'Total Earnings (ETB)', value: (d) => d.totalEarnings ?? 0 },
    ]);
    sendCsv(res, `drivers_${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/export/orders.csv', verifyToken, async (req, res) => {
  try {
    const [ordersSnapshot, storesSnapshot] = await Promise.all([
      db.collection('orders').get(),
      db.collection('stores').get(),
    ]);

    const storeNameByUserId = {};
    storesSnapshot.forEach((doc) => { storeNameByUserId[doc.data().userId] = doc.data().storeName; });

    let orders = [];
    ordersSnapshot.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const driverIds = [...new Set(orders.map((o) => o.driverId).filter(Boolean))];
    const driverUserDocs = await Promise.all(driverIds.map((id) => db.collection('users').doc(id).get()));
    const driverNameById = Object.fromEntries(driverUserDocs.map((d, i) => [driverIds[i], d.exists ? d.data().fullName : null]));

    const csv = toCsv(orders, [
      { label: 'Order #', value: (o) => o.orderNumber },
      { label: 'Store', value: (o) => storeNameByUserId[o.storeId] },
      { label: 'Driver', value: (o) => driverNameById[o.driverId] },
      { label: 'Delivery Address', value: (o) => o.deliveryAddress },
      { label: 'Recipient', value: (o) => o.recipientName },
      { label: 'Recipient Phone', value: (o) => o.recipientPhone },
      { label: 'Distance (km)', value: (o) => o.distanceKm ?? '' },
      { label: 'Total (ETB)', value: (o) => o.totalAmount ?? 0 },
      { label: 'Platform Fee (ETB)', value: (o) => o.platformFee ?? 0 },
      { label: 'Driver Fee (ETB)', value: (o) => o.driverFee ?? 0 },
      { label: 'Status', value: (o) => o.status },
      { label: 'Created At', value: (o) => o.createdAt?.toDate?.().toISOString() ?? '' },
    ]);
    sendCsv(res, `orders_${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/export/stores.csv', verifyToken, async (req, res) => {
  try {
    const [storesSnapshot, ordersSnapshot] = await Promise.all([
      db.collection('stores').get(),
      db.collection('orders').get(),
    ]);

    const orderCountByStoreUserId = {};
    ordersSnapshot.forEach((doc) => {
      const storeId = doc.data().storeId;
      if (storeId) orderCountByStoreUserId[storeId] = (orderCountByStoreUserId[storeId] || 0) + 1;
    });

    let stores = [];
    storesSnapshot.forEach((doc) => stores.push({ id: doc.id, ...doc.data() }));
    stores.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const ownerIds = [...new Set(stores.map((s) => s.userId).filter(Boolean))];
    const ownerDocs = await Promise.all(ownerIds.map((id) => db.collection('users').doc(id).get()));
    const ownerById = Object.fromEntries(ownerDocs.map((d, i) => [ownerIds[i], d.exists ? d.data() : null]));

    const csv = toCsv(stores, [
      { label: 'Store Name', value: (s) => s.storeName },
      { label: 'Store Type', value: (s) => s.storeType },
      { label: 'Owner Name', value: (s) => ownerById[s.userId]?.fullName },
      { label: 'Owner Phone', value: (s) => ownerById[s.userId]?.phone },
      { label: 'City', value: (s) => s.city },
      { label: 'Address', value: (s) => s.address },
      { label: 'Total Orders', value: (s) => orderCountByStoreUserId[s.userId] || 0 },
      { label: 'Verified', value: (s) => s.isVerified ? 'Yes' : 'No' },
      { label: 'Joined', value: (s) => s.createdAt?.toDate?.().toISOString() ?? '' },
    ]);
    sendCsv(res, `stores_${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/admin/export/withdrawals.csv', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('withdrawals').get();
    let withdrawals = [];
    snapshot.forEach((doc) => withdrawals.push({ id: doc.id, ...doc.data() }));
    withdrawals.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const driverIds = [...new Set(withdrawals.map((w) => w.driverId).filter(Boolean))];
    const driverUserDocs = await Promise.all(driverIds.map((id) => db.collection('users').doc(id).get()));
    const driverById = Object.fromEntries(driverUserDocs.map((d, i) => [driverIds[i], d.exists ? d.data() : null]));

    const csv = toCsv(withdrawals, [
      { label: 'Driver', value: (w) => driverById[w.driverId]?.fullName },
      { label: 'Phone', value: (w) => driverById[w.driverId]?.phone },
      { label: 'Amount (ETB)', value: (w) => w.amount ?? 0 },
      { label: 'Method', value: (w) => w.method },
      { label: 'Account Number', value: (w) => w.accountNumber },
      { label: 'Account Name', value: (w) => w.accountName },
      { label: 'Status', value: (w) => w.status },
      { label: 'Reference', value: (w) => w.reference ?? '' },
      { label: 'Requested At', value: (w) => w.createdAt?.toDate?.().toISOString() ?? '' },
    ]);
    sendCsv(res, `withdrawals_${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const days = Math.min(90, Math.max(1, parseInt(req.query.period, 10) || 30));
    const cutoffMs = Date.now() - days * 24 * 3600 * 1000;

    const snapshot = await db.collection('orders').get();
    const orders = [];
    snapshot.forEach((doc) => {
      const o = doc.data();
      const ms = o.createdAt?.toMillis?.();
      if (ms == null || ms >= cutoffMs) orders.push(o);
    });

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const delivered = orders.filter((o) => o.status === 'DELIVERED');
    const driverPayouts = delivered.reduce((sum, o) => sum + (o.driverFee || 0), 0);
    const platformFees = totalRevenue - driverPayouts;
    const conversionRate = orders.length > 0 ? Math.round((delivered.length / orders.length) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        metrics: {
          totalRevenue,
          platformFees,
          profit: platformFees,
          driverPayouts,
          conversionRate,
          totalOrders: orders.length,
          deliveredOrders: delivered.length,
        },
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
