/**
 * Email notification service — Nodemailer with SMTP.
 * Works with any SMTP provider: Gmail, SendGrid (SMTP relay),
 * Mailgun, AWS SES (SMTP), or self-hosted Postfix.
 *
 * Required env vars (when email is enabled):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *
 * Optional:
 *   SMTP_SECURE  — 'true' for port 465 TLS (default: false = STARTTLS)
 *   SMTP_FROM    — sender display name + address
 *
 * When SMTP_HOST is not set, emails are logged to console in development
 * and silently dropped in production (push notifications still work).
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

const FROM = () => process.env.SMTP_FROM || 'ET Spark Driver <noreply@etsparkdriver.et>';

async function send(to, subject, html) {
  if (!to) return;
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Email] (no SMTP) To: ${to} | ${subject}`);
    }
    return;
  }
  await t.sendMail({ from: FROM(), to, subject, html });
}

// ─── Driver notifications ────────────────────────────────────────────────────

async function sendDriverApproved(to, name) {
  return send(to, '✅ Your ET Spark Driver Application is Approved!', `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1B4332">Congratulations, ${name}!</h2>
      <p>Your driver application has been reviewed and <strong>approved</strong>. You can now go online and start earning!</p>
      <p>Open the ET Spark Driver app, tap the toggle to go <strong>Online</strong>, and delivery requests will start coming in.</p>
      <hr style="border-color:#e9ecef"/>
      <p style="color:#6c757d;font-size:13px">— ET Spark Driver Team</p>
    </div>
  `);
}

async function sendDriverSuspended(to, name) {
  return send(to, 'Important: Your ET Spark Driver Account', `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#dc3545">Account Suspended</h2>
      <p>Hi ${name},</p>
      <p>Your ET Spark Driver account has been <strong>suspended</strong>.</p>
      <p>If you believe this is an error or would like more information, please contact our support team by replying to this email.</p>
      <hr style="border-color:#e9ecef"/>
      <p style="color:#6c757d;font-size:13px">— ET Spark Driver Team</p>
    </div>
  `);
}

// ─── Withdrawal notifications ─────────────────────────────────────────────────

async function sendWithdrawalUpdate(to, name, status, amount) {
  const amountStr = `ETB ${parseFloat(amount).toFixed(2)}`;
  const success = status === 'COMPLETED';

  return send(
    to,
    success ? `💰 Withdrawal of ${amountStr} Processed` : `Withdrawal of ${amountStr} Failed`,
    `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:${success ? '#1B4332' : '#dc3545'}">
        ${success ? '✅ Withdrawal Successful' : '❌ Withdrawal Failed'}
      </h2>
      <p>Hi ${name},</p>
      ${success
        ? `<p>Your withdrawal of <strong>${amountStr}</strong> has been processed and sent to your account.</p>`
        : `<p>Your withdrawal of <strong>${amountStr}</strong> could not be processed. The amount has been <strong>refunded to your wallet</strong>.</p>
           <p>Please verify your account details and try again, or contact support if the problem persists.</p>`
      }
      <hr style="border-color:#e9ecef"/>
      <p style="color:#6c757d;font-size:13px">— ET Spark Driver Team</p>
    </div>
  `);
}

// ─── Store notifications ──────────────────────────────────────────────────────

async function sendStoreVerified(to, storeName) {
  return send(to, '✅ Your Store is Now Verified on ET Spark Driver', `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1B4332">Store Verified!</h2>
      <p><strong>${storeName}</strong> has been verified. Customers will now see a verified badge on your store profile.</p>
      <hr style="border-color:#e9ecef"/>
      <p style="color:#6c757d;font-size:13px">— ET Spark Driver Team</p>
    </div>
  `);
}

module.exports = { send, sendDriverApproved, sendDriverSuspended, sendWithdrawalUpdate, sendStoreVerified };
