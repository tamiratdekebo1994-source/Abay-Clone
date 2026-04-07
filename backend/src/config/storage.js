/**
 * File storage abstraction — priority order:
 *   1. Firebase Storage  (when FIREBASE_SERVICE_ACCOUNT is set)
 *   2. AWS S3 / Cloudflare R2 / MinIO  (when AWS_S3_BUCKET is set)
 *   3. Local disk fallback
 */

const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Lazy-initialised Firebase Admin app (singleton)
let _firebaseApp = null;
function getFirebaseApp() {
  if (_firebaseApp) return _firebaseApp;
  const admin = require('firebase-admin');
  if (admin.apps.length) { _firebaseApp = admin.apps[0]; return _firebaseApp; }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  // Accept either a file path or an inline JSON string
  const credential = raw.trim().startsWith('{')
    ? admin.credential.cert(JSON.parse(raw))
    : admin.credential.cert(require(path.resolve(raw)));

  _firebaseApp = admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return _firebaseApp;
}

/**
 * Store a processed file buffer.
 *
 * @param {Buffer} buffer      Processed image/file buffer
 * @param {string} key         Storage path key, e.g. 'documents/abc.webp'
 * @param {string} contentType MIME type (default: image/webp)
 * @returns {Promise<string>}  Public URL of the stored file
 */
async function storeFile(buffer, key, contentType = 'image/webp') {
  // ── Firebase Storage ──────────────────────────────────────────────────────
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_STORAGE_BUCKET) {
    const admin = require('firebase-admin');
    const app = getFirebaseApp();
    const bucket = admin.storage(app).bucket();
    const file = bucket.file(key);

    await file.save(buffer, {
      metadata: { contentType },
      resumable: false,
    });

    // Make the file publicly readable and return its URL
    await file.makePublic();
    return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${key}`;
  }

  // ── AWS S3 / Cloudflare R2 / MinIO ────────────────────────────────────────
  if (process.env.AWS_S3_BUCKET) {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      ...(process.env.AWS_ENDPOINT_URL && {
        endpoint: process.env.AWS_ENDPOINT_URL,
        forcePathStyle: true,
      }),
    });

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const cdnBase = process.env.AWS_CDN_URL
      || `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    return `${cdnBase}/${key}`;
  }

  // ── Local disk fallback ───────────────────────────────────────────────────
  const dir = path.join(UPLOADS_DIR, path.dirname(key));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, key), buffer);
  return `/uploads/${key}`;
}

module.exports = { storeFile };
