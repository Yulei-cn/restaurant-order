import { verifyWebhookSignature, logWebhookEvent } from './webhook-verify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature']; // 支付商的签名头
  const payload = JSON.stringify(req.body);
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // 验证webhook签名
  if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
    console.error('Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const clientIP = req.headers['x-forwarded-for'] || 'unknown';
  logWebhookEvent(req.body, clientIP);

  // 处理支付事件
  try {
    // 这里会处理支付成功/失败的逻辑
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
