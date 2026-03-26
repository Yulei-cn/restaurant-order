export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.warn('[PAYMENT DISABLED] payment-webhook called before phase 3 is enabled');
  return res.status(410).json({
    error: 'Payment webhook is disabled until phase 3'
  });
}
