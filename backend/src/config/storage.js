/**
 * File storage abstraction.
 * Uses AWS S3 (or any S3-compatible service like Cloudflare R2, MinIO) when
 * AWS_S3_BUCKET is set; falls back to local disk otherwise.
 *
 * Required env vars for S3:
 *   AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Optional:
 *   AWS_ENDPOINT_URL  — override for R2/MinIO (e.g. https://<id>.r2.cloudflarestorage.com)
 *   AWS_CDN_URL       — public base URL for stored objects (e.g. https://cdn.abaydriver.et)
 */

const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Store a processed file buffer.
 *
 * @param {Buffer} buffer      Processed image/file buffer
 * @param {string} key         Storage path key, e.g. 'documents/abc.webp'
 * @param {string} contentType MIME type (default: image/webp)
 * @returns {Promise<string>}  Public URL of the stored file
 */
async function storeFile(buffer, key, contentType = 'image/webp') {
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

  // Local disk fallback
  const dir = path.join(UPLOADS_DIR, path.dirname(key));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, key), buffer);
  return `/uploads/${key}`;
}

module.exports = { storeFile };
