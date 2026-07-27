import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

export default async function handler(req, res) {
  try { requireAdminConfig(); requireSupabaseConfig(); } catch { return res.status(500).json({ error: 'Configuration serveur manquante' }); }
  if (!requireAdminSession(req, res)) return;

  if (req.method === 'GET') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.date || '')) ? req.query.date : new Date().toISOString().slice(0, 10);
    const headers = getServiceHeaders();
    const [eventsRes, dayRes] = await Promise.all([
      fetch(getSupabaseUrl(`/rest/v1/payment_events?select=fiscal_sequence,order_id,event_type,payment_method,amount,terminal_reference,reason,recorded_by,recorded_at&recorded_at=gte.${date}T00:00:00Z&recorded_at=lt.${date}T23:59:59.999Z&order=fiscal_sequence.asc`), { headers }),
      fetch(getSupabaseUrl(`/rest/v1/cash_register_days?business_date=eq.${date}&select=*`), { headers })
    ]);
    const events = await eventsRes.json(); const days = await dayRes.json();
    if (!eventsRes.ok || !dayRes.ok) return res.status(500).json({ error: 'Lecture du rapport impossible' });
    const totals = { cash: 0, card: 0, meal_voucher: 0, other: 0, refunds: 0 };
    for (const event of events) { const signed = event.event_type === 'payment' ? Number(event.amount) : -Number(event.amount); totals[event.payment_method] = (totals[event.payment_method] || 0) + signed; if (event.event_type !== 'payment') totals.refunds += Number(event.amount); }
    return res.status(200).json({ date, totals, events, closure: days[0] || null });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode non autorisee' });
  const { action } = req.body || {};
  const rpc = action === 'open' ? 'open_cash_register_day' : action === 'close' ? 'close_cash_register_day' : action === 'payment' ? 'record_payment_event' : '';
  if (!rpc) return res.status(400).json({ error: 'Action invalide' });
  const payload = action === 'payment'
    ? { payment_payload: { ...req.body, amount: roundMoney(Number(req.body.amount)), recorded_by: 'admin' } }
    : action === 'open'
      ? { open_payload: { business_date: req.body.business_date || '', opening_cash: roundMoney(Number(req.body.opening_cash)), opened_by: 'admin' } }
      : { close_payload: { business_date: req.body.business_date || '', counted_cash: roundMoney(Number(req.body.counted_cash)), closed_by: 'admin' } };
  const response = await fetch(getSupabaseUrl(`/rest/v1/rpc/${rpc}`), { method: 'POST', headers: getServiceHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok) return res.status(400).json({ error: data?.message || 'Operation impossible' });
  return res.status(200).json({ status: 'ok', result: Array.isArray(data) ? data[0] : data });
}
