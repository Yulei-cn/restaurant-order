import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';

const rateLimitMap = new Map();
const TAX_RATE = 0.1;
const MIN_FORM_FILL_MS = 2500;

const allowedPrices = new Set([1.0, 2.5, 5.8, 6.8, 8.8, 10.0, 11.8, 13.8]);
const allowedOriginHosts = new Set([
  'cube-paris.vercel.app',
  'www.cube-paris.vercel.app'
]);
const allowedMenuItems = new Map([
  ['Concombre marine', 5.8],
  ['Radis aigre-doux', 5.8],
  ['Pommes de terre rapees', 5.8],
  ['Algues marinees', 5.8],
  ['Boeuf mijote', 8.8],
  ['Porc braise', 8.8],
  ['Poulet aigre-doux', 8.8],
  ['Porc saute croustillant', 8.8],
  ['Poulet frit', 8.8],
  ['Porc frit croustillant', 8.8],
  ['Poulet Kung Pao', 8.8],
  ['Aubergines braisees', 6.8],
  ['Haricots verts sautes', 6.8],
  ['Oeufs aux tomates', 6.8],
  ['Riz nature', 2.5],
  ['Riz saute', 5.8],
  ['Nouilles sautees', 6.8],
  ['Roujiamo porc', 5.8],
  ['Roujiamo boeuf', 6.8],
  ['Formule 10 EUR', 10.0],
  ['Formule 1', 11.8],
  ['Formule 2', 13.8],
  ['Supplement nouilles formule', 1.0],
  ['Supplement boisson formule', 1.0]
]);

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 5;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const record = rateLimitMap.get(ip);
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

function logSuspiciousActivity(ip, reason, data) {
  console.error(`[SECURITY] ${new Date().toISOString()} - IP: ${ip} - ${reason}`, data);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || 'unknown';
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source = origin || referer;

  if (!source) {
    return false;
  }

  try {
    const url = new URL(source);
    return allowedOriginHosts.has(url.host);
  } catch {
    return false;
  }
}

function getCategoryFromName(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('formule') || lowerName.includes('supplement')) return 'formula';
  if (
    lowerName.includes('coca') ||
    lowerName.includes('sprite') ||
    lowerName.includes('fanta') ||
    lowerName.includes('jus') ||
    lowerName.includes('eau') ||
    lowerName.includes('the')
  ) {
    return 'drink';
  }
  if (lowerName.includes('roujiamo')) return 'snack';
  if (lowerName.includes('riz') || lowerName.includes('nouilles')) return 'side';
  return 'dish';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  try {
    requireSupabaseConfig();
  } catch {
    return res.status(500).json({ error: 'Configuration Supabase manquante' });
  }

  const clientIP = getClientIp(req);
  if (!checkRateLimit(clientIP)) {
    logSuspiciousActivity(clientIP, 'Rate limit exceeded', { attempts: rateLimitMap.get(clientIP)?.count });
    return res.status(429).json({ error: 'Trop de commandes. Veuillez patienter 15 minutes.' });
  }

  const {
    items,
    address,
    phone,
    notes,
    customer_name,
    website = '',
    form_started_at,
    source = 'online_pickup',
    channel = 'web',
    fulfillment_type = 'pickup',
    payment_status
  } = req.body || {};

  if (!isAllowedOrigin(req)) {
    logSuspiciousActivity(clientIP, 'Blocked by origin check', {
      origin: req.headers.origin,
      referer: req.headers.referer
    });
    return res.status(403).json({ error: 'Origine non autorisee' });
  }

  if (typeof website === 'string' && website.trim() !== '') {
    logSuspiciousActivity(clientIP, 'Honeypot field filled', { website });
    return res.status(400).json({ error: 'Requete invalide' });
  }

  const startedAt = Number(form_started_at);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    logSuspiciousActivity(clientIP, 'Missing form timestamp', { form_started_at });
    return res.status(400).json({ error: 'Requete invalide' });
  }

  if (Date.now() - startedAt < MIN_FORM_FILL_MS) {
    logSuspiciousActivity(clientIP, 'Submitted too quickly', { elapsedMs: Date.now() - startedAt });
    return res.status(400).json({ error: 'Soumission trop rapide' });
  }

  if (!customer_name || !customer_name.trim()) {
    logSuspiciousActivity(clientIP, 'Empty customer name', { customer_name });
    return res.status(400).json({ error: 'Nom du client requis' });
  }

  if (customer_name.trim().length > 50) {
    logSuspiciousActivity(clientIP, 'Customer name too long', { length: customer_name.trim().length });
    return res.status(400).json({ error: 'Nom trop long' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    logSuspiciousActivity(clientIP, 'Empty order attempt', { items });
    return res.status(400).json({ error: 'Commande vide' });
  }

  let totalAmount = 0;
  const validatedItems = [];

  for (const [index, item] of items.entries()) {
    const itemName = String(item?.name || '').trim();
    const quantity = Number(item?.qty);
    const submittedPrice = roundMoney(Number(item?.price));

    if (!itemName || itemName.length > 160) {
      logSuspiciousActivity(clientIP, 'Invalid product attempted', { productName: itemName });
      return res.status(400).json({ error: `Produit invalide: ${itemName}` });
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10) {
      logSuspiciousActivity(clientIP, 'Invalid quantity attempted', { product: itemName, quantity });
      return res.status(400).json({ error: `Quantite invalide: ${quantity}` });
    }

    if (!allowedPrices.has(submittedPrice)) {
      logSuspiciousActivity(clientIP, 'Invalid price attempted', { product: itemName, price: submittedPrice });
      return res.status(400).json({ error: `Prix invalide: ${submittedPrice}` });
    }

    const expectedPrice = allowedMenuItems.get(itemName);
    if (expectedPrice === undefined || roundMoney(expectedPrice) !== submittedPrice) {
      logSuspiciousActivity(clientIP, 'Invalid menu item attempted', { product: itemName, price: submittedPrice });
      return res.status(400).json({ error: `Produit invalide: ${itemName}` });
    }

    validatedItems.push({
      sort_order: index,
      item_name: itemName,
      item_category: getCategoryFromName(itemName),
      quantity,
      unit_price: submittedPrice,
      tax_rate: 10.0,
      notes: item?.notes ? String(item.notes).trim() : null
    });

    totalAmount = roundMoney(totalAmount + submittedPrice * quantity);
  }

  const formulaCount = validatedItems
    .filter((item) => item.item_name.startsWith('Formule'))
    .reduce((sum, item) => sum + item.quantity, 0);
  const hasTooManySupplements = validatedItems
    .filter((item) => item.item_name.startsWith('Supplement'))
    .some((item) => item.quantity > formulaCount);

  if (hasTooManySupplements) {
    return res.status(400).json({ error: 'Les supplements necessitent une formule' });
  }

  const subtotalAmount = roundMoney(totalAmount / (1 + TAX_RATE));
  const taxAmount = roundMoney(totalAmount - subtotalAmount);
  const normalizedSource = ['internal', 'online_pickup', 'online_paid'].includes(source) ? source : 'online_pickup';
  const normalizedChannel = ['staff', 'web', 'phone', 'walk_in'].includes(channel) ? channel : 'web';
  const normalizedFulfillment = ['pickup', 'dine_in', 'delivery'].includes(fulfillment_type) ? fulfillment_type : 'pickup';
  const normalizedPaymentStatus = payment_status || (normalizedSource === 'online_paid' ? 'paid' : 'pay_on_pickup');

  try {
    const orderRes = await fetch(getSupabaseUrl('/rest/v1/rpc/create_order_with_items'), {
      method: 'POST',
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify({
        order_payload: {
          source: normalizedSource,
          channel: normalizedChannel,
          order_status: 'new',
          payment_status: normalizedPaymentStatus,
          customer_name: customer_name.trim(),
          customer_phone: phone ? String(phone).trim() : null,
          customer_address: address ? String(address).trim() : null,
          customer_notes: notes ? String(notes).trim() : null,
          fulfillment_type: normalizedFulfillment,
          subtotal_amount: subtotalAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'EUR'
        },
        item_payloads: validatedItems
      })
    });

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error('Supabase create_order_with_items error:', errorText);
      throw new Error('Erreur lors de la creation de la commande');
    }

    const orderData = await orderRes.json();
    const createdOrder = Array.isArray(orderData) ? orderData[0] : orderData;

    if (!createdOrder?.id || !createdOrder?.order_number) {
      console.error('Unexpected create_order_with_items response:', orderData);
      throw new Error('Reponse serveur invalide');
    }

    console.log(
      `[ORDER] ${new Date().toISOString()} - IP: ${clientIP} - Order: EUR ${totalAmount} - Customer: ${customer_name.trim()} - Number: ${createdOrder.order_number}`
    );

    return res.status(200).json({
      status: 'ok',
      serverTotal: totalAmount,
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number
    });
  } catch (err) {
    console.error('Order processing error:', err);
    logSuspiciousActivity(clientIP, 'Database error', { error: err.message });
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
