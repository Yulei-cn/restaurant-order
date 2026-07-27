import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode non autorisee' });
  try { requireAdminConfig(); requireSupabaseConfig(); } catch { return res.status(500).json({ error: 'Configuration serveur manquante' }); }
  if (!requireAdminSession(req, res)) return;
  const openingCash = roundMoney(Number(req.body?.opening_cash));
  if (!Number.isFinite(openingCash) || openingCash < 0) return res.status(400).json({ error: 'Fond de caisse invalide' });
  const response = await fetch(getSupabaseUrl('/rest/v1/rpc/open_cash_register_day'), { method: 'POST', headers: getServiceHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ open_payload: { business_date: req.body?.business_date || '', opening_cash: openingCash, opened_by: 'admin' } }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) return res.status(400).json({ error: data?.message || 'Ouverture impossible' });
  return res.status(200).json({ status: 'ok', opening: Array.isArray(data) ? data[0] : data });
}
