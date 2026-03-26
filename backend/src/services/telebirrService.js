/**
 * TeleBirr H5Pay integration — AES-128-ECB request signing.
 *
 * Signing algorithm (TeleBirr paygate-sdk spec):
 *   1. Build the params object (exclude `sign` and empty values)
 *   2. Sort keys alphabetically
 *   3. Join as "key=value&key=value..."
 *   4. AES-128-ECB encrypt using the first 16 bytes of appKey as the cipher key
 *   5. Base64-encode the ciphertext → `sign`
 *   6. POST JSON to paygate-sdk/v1.0.0/h5pay
 */
const crypto = require('crypto');

/**
 * Signs a TeleBirr payload using AES-128-ECB.
 * @param {Record<string, string>} params  Key/value pairs (sign and empty values excluded automatically)
 * @param {string} appKey  TELEBIRR_APP_KEY environment variable value
 * @returns {string} Base64-encoded AES-128-ECB ciphertext
 */
function signPayload(params, appKey) {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] != null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  // TeleBirr spec: use first 16 characters of appKey as the 128-bit cipher key
  const keyBuf = Buffer.from(appKey.substring(0, 16), 'utf8');
  const cipher = crypto.createCipheriv('aes-128-ecb', keyBuf, null);
  cipher.setAutoPadding(true); // PKCS7
  return Buffer.concat([cipher.update(sorted, 'utf8'), cipher.final()]).toString('base64');
}

/**
 * Initiates a TeleBirr H5 payment checkout.
 *
 * @param {{
 *   appId: string,
 *   appKey: string,
 *   shortCode: string,
 *   outTradeNo: string,
 *   subject: string,
 *   totalAmount: string,   // "123.45"
 *   receiveName: string,
 *   notifyUrl: string,
 *   returnUrl: string,
 *   timeoutExpress?: string, // minutes, default "30"
 * }} options
 *
 * @returns {Promise<{ toPayUrl: string, rawRequest: object }>}
 */
async function initiateH5Payment(options) {
  const {
    appId, appKey, shortCode,
    outTradeNo, subject, totalAmount,
    receiveName, notifyUrl, returnUrl,
    timeoutExpress = '30',
  } = options;

  const baseUrl = process.env.TELEBIRR_BASE_URL || 'https://api.ethiotelecom.et/payment';
  const endpoint = `${baseUrl}/paygate-sdk/v1.0.0/h5pay`;

  const params = {
    appId,
    shortCode,
    outTradeNo,
    subject,
    totalAmount,
    receiveName,
    notifyUrl,
    returnUrl,
    timeoutExpress,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  params.sign = signPayload(params, appKey);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw Object.assign(new Error(`TeleBirr API error: ${response.status} — ${text}`), { status: 502 });
  }

  const data = await response.json();

  // TeleBirr returns { code: "0", msg: "success", data: { toPayUrl: "..." } }
  if (data.code !== '0' && data.code !== 0) {
    throw Object.assign(
      new Error(`TeleBirr payment initiation failed: ${data.msg || JSON.stringify(data)}`),
      { status: 502 }
    );
  }

  return { toPayUrl: data.data?.toPayUrl || data.toPayUrl, rawRequest: params };
}

module.exports = { signPayload, initiateH5Payment };
