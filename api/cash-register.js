import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

const PAYMENT_METHODS = new Set(['cash', 'card', 'meal_voucher', 'other']);
const EVENT_TYPES = new Set(['payment', 'refund', 'void']);

export default async function handler(req, res) {
  try { requireAdminConfig(); requireSupabaseConfig(); } catch { return res.status(500).json({ error: 'Configuration serveur manquante' }); }
  if (!requireAdminSession(req, res)) return;

  if (req.method === 'GET') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.date || '')) ? req.query.date : new Date().toISOString().slice(0, 10);
    const headers = getServiceHeaders();
    const dayRes = await fetch(getSupabaseUrl('/rest/v1/cash_register_days?select=*&order=opened_at.desc&limit=1'), { headers });
    const days = await dayRes.json();
    if (!dayRes.ok) return res.status(500).json({ error: 'Lecture du rapport impossible' });
    const day = days[0] || null;
    const reportStart = day?.opened_at || `${date}T00:00:00Z`;
    const reportEnd = day?.closed_at || new Date().toISOString();
    const eventsRes = await fetch(getSupabaseUrl(`/rest/v1/payment_events?select=fiscal_sequence,order_id,event_type,payment_method,amount,terminal_reference,reason,recorded_by,recorded_at&recorded_at=gte.${encodeURIComponent(reportStart)}&recorded_at=lte.${encodeURIComponent(reportEnd)}&order=fiscal_sequence.asc`), { headers });
    const events = await eventsRes.json();
    if (!eventsRes.ok) return res.status(500).json({ error: 'Lecture du rapport impossible' });
    const within24Hours = day && Date.now() - new Date(day.opened_at).getTime() < 24 * 60 * 60 * 1000;
    const totals = { cash: 0, card: 0, meal_voucher: 0, other: 0, refunds: 0 };
    for (const event of events) { const signed = event.event_type === 'payment' ? Number(event.amount) : -Number(event.amount); totals[event.payment_method] = (totals[event.payment_method] || 0) + signed; if (event.event_type !== 'payment') totals.refunds += Number(event.amount); }
    return res.status(200).json({ date: day?.business_date || date, totals, events, day, day_state: within24Hours ? day.status : 'not_started', closure: day });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode non autorisee' });
  const { action } = req.body || {};
  const rpc = action === 'open' ? 'open_cash_register_day' : action === 'close' ? 'close_cash_register_day' : action === 'payment' ? 'record_payment_event' : '';
  if (!rpc) return res.status(400).json({ error: 'Action invalide' });
  if (action === 'payment') {
    const eventType = req.body.event_type || 'payment';
    const amount = roundMoney(Number(req.body.amount));
    if (!req.body.order_id || !EVENT_TYPES.has(eventType) || !PAYMENT_METHODS.has(req.body.payment_method) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Donnees de paiement invalides' });
    }
    if ((eventType === 'refund' || eventType === 'void') && !String(req.body.reason || '').trim()) {
      return res.status(400).json({ error: 'Motif obligatoire pour un remboursement ou une annulation' });
    }
    if (String(req.body.terminal_reference || '').length > 100 || String(req.body.reason || '').length > 500) {
      return res.status(400).json({ error: 'Reference ou motif trop long' });
    }
  }
  if ((action === 'open' || action === 'close') && (!Number.isFinite(roundMoney(Number(action === 'open' ? req.body.opening_cash : req.body.counted_cash))) || Number(action === 'open' ? req.body.opening_cash : req.body.counted_cash) < 0)) {
    return res.status(400).json({ error: 'Montant de caisse invalide' });
  }
  const payload = action === 'payment'
    ? { payment_payload: { ...req.body, event_type: req.body.event_type || 'payment', amount: roundMoney(Number(req.body.amount)), recorded_by: 'admin' } }
    : action === 'open'
      ? { open_payload: { business_date: req.body.business_date || '', opening_cash: roundMoney(Number(req.body.opening_cash)), opened_by: 'admin' } }
      : { close_payload: { business_date: req.body.business_date || '', counted_cash: roundMoney(Number(req.body.counted_cash)), closed_by: 'admin' } };
  const response = await fetch(getSupabaseUrl(`/rest/v1/rpc/${rpc}`), { method: 'POST', headers: getServiceHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('Cash-register RPC error:', { action, status: response.status, data });
    return res.status(400).json({ error: data?.message || 'Operation impossible' });
  }
  return res.status(200).json({ status: 'ok', result: Array.isArray(data) ? data[0] : data });
}
