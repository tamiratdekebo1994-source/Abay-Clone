const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let _app = null;

function getFirebaseAdmin() {
  if (_app) return _app;
  if (admin.apps.length) return (_app = admin.apps[0]);

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountPath) {
    const resolved = path.resolve(serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    _app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    _app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    _app = admin.initializeApp();
  }
  return _app;
}

module.exports = { getFirebaseAdmin };
