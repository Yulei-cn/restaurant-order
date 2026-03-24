import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    requireSupabaseConfig();
  } catch {
    return res.status(500).json({ error: 'Configuration Supabase manquante' });
  }

  const { id, order_status = 'completed' } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'ID manquant' });
  }

  const allowedStatuses = ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  const nextStatus = allowedStatuses.includes(order_status) ? order_status : 'completed';

  const supabaseRes = await fetch(getSupabaseUrl(`/rest/v1/orders?id=eq.${id}`), {
    method: 'PATCH',
    headers: getServiceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    }),
    body: JSON.stringify({ order_status: nextStatus })
  });

  if (!supabaseRes.ok) {
    const errorText = await supabaseRes.text();
    console.error('Supabase order status update error:', errorText);
    return res.status(500).json({ error: 'Échec de mise à jour' });
  }

  return res.status(200).json({ status: 'ok', order_status: nextStatus });
}
