import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

const PAYMENT_METHODS = new Set(['cash', 'card', 'meal_voucher', 'other']);
const EVENT_TYPES = new Set(['payment', 'refund', 'void']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  try {
    requireAdminConfig();
    requireSupabaseConfig();
  } catch {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  if (!requireAdminSession(req, res)) {
    return;
  }

  const {
    order_id,
    event_type = 'payment',
    payment_method,
    amount,
    terminal_reference = '',
    reason = ''
  } = req.body || {};
  const normalizedAmount = roundMoney(Number(amount));

  if (!order_id || !EVENT_TYPES.has(event_type) || !PAYMENT_METHODS.has(payment_method)) {
    return res.status(400).json({ error: 'Donnees de paiement invalides' });
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ error: 'Montant de paiement invalide' });
  }
  if ((event_type === 'refund' || event_type === 'void') && !String(reason).trim()) {
    return res.status(400).json({ error: 'Motif obligatoire pour un remboursement ou une annulation' });
  }
  if (String(terminal_reference).length > 100 || String(reason).length > 500) {
    return res.status(400).json({ error: 'Reference ou motif trop long' });
  }

  const rpcRes = await fetch(getSupabaseUrl('/rest/v1/rpc/record_payment_event'), {
    method: 'POST',
    headers: getServiceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      payment_payload: {
        order_id: String(order_id),
        event_type,
        payment_method,
        amount: normalizedAmount,
        terminal_reference: String(terminal_reference).trim(),
        reason: String(reason).trim(),
        recorded_by: 'admin'
      }
    })
  });

  const data = await rpcRes.json().catch(() => null);
  if (!rpcRes.ok) {
    console.error('record_payment_event error:', data);
    return res.status(400).json({ error: data?.message || 'Enregistrement du paiement impossible' });
  }

  const payment = Array.isArray(data) ? data[0] : data;
  return res.status(200).json({
    status: 'ok',
    paymentEventId: payment?.payment_event_id,
    paymentStatus: payment?.payment_status,
    paidAmount: payment?.paid_amount
  });
}
