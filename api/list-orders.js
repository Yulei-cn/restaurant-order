import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    requireSupabaseConfig();
  } catch {
    return res.status(500).json({ error: 'Configuration Supabase manquante' });
  }

  const query = [
    'select=id,order_number,source,channel,order_status,payment_status,customer_name,customer_phone,customer_address,customer_notes,total_amount,created_at,items',
    'order=created_at.desc',
    'order_status=in.(new,confirmed,preparing,ready)'
  ].join('&');

  const supabaseRes = await fetch(getSupabaseUrl(`/rest/v1/order_summary?${query}`), {
    headers: getServiceHeaders()
  });

  if (!supabaseRes.ok) {
    const errorText = await supabaseRes.text();
    console.error('Supabase list-orders error:', errorText);
    return res.status(500).json({ error: 'Erreur de lecture des commandes' });
  }

  const data = await supabaseRes.json();
  return res.status(200).json(data);
}
