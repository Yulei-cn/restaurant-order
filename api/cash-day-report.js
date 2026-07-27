import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode non autorisee' });
  try { requireAdminConfig(); requireSupabaseConfig(); } catch { return res.status(500).json({ error: 'Configuration serveur manquante' }); }
  if (!requireAdminSession(req, res)) return;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.date || '')) ? req.query.date : new Date().toISOString().slice(0, 10);
  const eventsRes = await fetch(getSupabaseUrl(`/rest/v1/payment_events?select=fiscal_sequence,order_id,event_type,payment_method,amount,terminal_reference,reason,recorded_by,recorded_at&recorded_at=gte.${date}T00:00:00Z&recorded_at=lt.${date}T23:59:59.999Z&order=fiscal_sequence.asc`), { headers: getServiceHeaders() });
  const dayRes = await fetch(getSupabaseUrl(`/rest/v1/cash_register_days?business_date=eq.${date}&select=*`), { headers: getServiceHeaders() });
  const events = await eventsRes.json();
  const days = await dayRes.json();
  if (!eventsRes.ok || !dayRes.ok) return res.status(500).json({ error: 'Lecture du rapport impossible' });

  const totals = { cash: 0, card: 0, meal_voucher: 0, other: 0, refunds: 0 };
  for (const event of events) {
    const signed = event.event_type === 'payment' ? Number(event.amount) : -Number(event.amount);
    totals[event.payment_method] = (totals[event.payment_method] || 0) + signed;
    if (event.event_type !== 'payment') totals.refunds += Number(event.amount);
  }
  return res.status(200).json({ date, totals, events, closure: days[0] || null });
}
