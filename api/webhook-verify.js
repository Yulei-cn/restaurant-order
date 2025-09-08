import crypto from 'crypto';

export function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function logWebhookEvent(event, ip) {
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK] ${timestamp} - IP: ${ip} - Event: ${event.type}`);
}
