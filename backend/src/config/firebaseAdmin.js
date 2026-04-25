const admin = require('firebase-admin');

let _app = null;

function getFirebaseAdmin() {
  if (_app) return _app;
  if (admin.apps.length) return (_app = admin.apps[0]);

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    _app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    _app = admin.initializeApp();
  }
  return _app;
}

module.exports = { getFirebaseAdmin };
