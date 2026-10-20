// Builds customer-facing share links for an order.
// Ethiopian numbers are normalised to international form (251XXXXXXXXX),
// accepting "+251 9..", "251 9..", "09..", or "9..".

export function normalizeEthiopiaPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('251')) return digits;
  if (digits.startsWith('0')) return `251${digits.slice(1)}`;
  if (digits.length === 9) return `251${digits}`;
  return digits;
}

export function buildTrackingUrl(orderId) {
  return `${window.location.origin}/track/${orderId}`;
}

function shareMessage(orderNumber, trackingUrl) {
  return `Your ET Spark delivery #${orderNumber} is on its way. Track it here: ${trackingUrl}`;
}

export function whatsappShareUrl({ phone, orderNumber, orderId }) {
  const number = normalizeEthiopiaPhone(phone);
  const text = encodeURIComponent(shareMessage(orderNumber, buildTrackingUrl(orderId)));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function smsShareUrl({ phone, orderNumber, orderId }) {
  const number = normalizeEthiopiaPhone(phone) || '';
  const body = encodeURIComponent(shareMessage(orderNumber, buildTrackingUrl(orderId)));
  return `sms:+${number}?&body=${body}`;
}
