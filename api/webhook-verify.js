import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 获取支付商的签名（以Stripe为例）
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    console.error('Missing webhook signature or secret');
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    // 验证webhook签名
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.split('=')[1];
    
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // 处理支付事件
    const event = req.body;
    console.log(`[PAYMENT WEBHOOK] ${new Date().toISOString()} - Event: ${event.type}`);

    // 根据事件类型处理
    switch (event.type) {
      case 'payment_intent.succeeded':
        // 支付成功，更新订单状态
        console.log('Payment succeeded:', event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        // 支付失败
        console.log('Payment failed:', event.data.object.id);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
