import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

function mapClient(row) {
  return {
    id: row.id,
    name: row.company_name,
    legalName: row.legal_name || '',
    address: row.address_line_1 || '',
    addressLine2: row.address_line_2 || '',
    city: row.city || '',
    postalCode: row.postal_code || '',
    country: row.country || 'France',
    tva: row.vat_number || '',
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    contactPhone: row.contact_phone || '',
    notes: row.notes || ''
  };
}

export default async function handler(req, res) {
  try {
    requireAdminConfig();
    requireSupabaseConfig();
  } catch {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  if (!requireAdminSession(req, res)) {
    return;
  }

  if (req.method === 'GET') {
    const query = [
      'select=id,company_name,legal_name,address_line_1,address_line_2,postal_code,city,country,vat_number,contact_name,contact_email,contact_phone,notes',
      'order=company_name.asc'
    ].join('&');

    const supabaseRes = await fetch(getSupabaseUrl(`/rest/v1/invoice_clients?${query}`), {
      headers: getServiceHeaders()
    });

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error('Supabase invoice-clients GET error:', errorText);
      return res.status(500).json({ error: 'Erreur de lecture des clients' });
    }

    const rows = await supabaseRes.json();
    return res.status(200).json(rows.map(mapClient));
  }

  if (req.method === 'POST') {
    const {
      id,
      name,
      legalName = '',
      address = '',
      addressLine2 = '',
      city = '',
      postalCode = '',
      country = 'France',
      tva = '',
      contactName = '',
      contactEmail = '',
      contactPhone = '',
      notes = ''
    } = req.body || {};

    if (!name || !String(name).trim() || !address || !String(address).trim() || !city || !String(city).trim()) {
      return res.status(400).json({ error: 'Nom, adresse et ville sont requis' });
    }

    const payload = {
      company_name: String(name).trim(),
      legal_name: legalName ? String(legalName).trim() : null,
      address_line_1: String(address).trim(),
      address_line_2: addressLine2 ? String(addressLine2).trim() : null,
      postal_code: postalCode ? String(postalCode).trim() : null,
      city: String(city).trim(),
      country: country ? String(country).trim() : 'France',
      vat_number: tva ? String(tva).trim() : null,
      contact_name: contactName ? String(contactName).trim() : null,
      contact_email: contactEmail ? String(contactEmail).trim() : null,
      contact_phone: contactPhone ? String(contactPhone).trim() : null,
      notes: notes ? String(notes).trim() : null
    };

    const isUpdate = !!id;
    const path = isUpdate
      ? `/rest/v1/invoice_clients?id=eq.${encodeURIComponent(String(id))}&select=id,company_name,legal_name,address_line_1,address_line_2,postal_code,city,country,vat_number,contact_name,contact_email,contact_phone,notes`
      : '/rest/v1/invoice_clients?select=id,company_name,legal_name,address_line_1,address_line_2,postal_code,city,country,vat_number,contact_name,contact_email,contact_phone,notes';

    const supabaseRes = await fetch(getSupabaseUrl(path), {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(payload)
    });

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error('Supabase invoice-clients POST error:', errorText);
      return res.status(500).json({ error: 'Erreur de sauvegarde du client' });
    }

    const rows = await supabaseRes.json();
    return res.status(200).json(mapClient(Array.isArray(rows) ? rows[0] : rows));
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
    if (!id) {
      return res.status(400).json({ error: 'ID manquant' });
    }

    const supabaseRes = await fetch(getSupabaseUrl(`/rest/v1/invoice_clients?id=eq.${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: getServiceHeaders({
        Prefer: 'return=minimal'
      })
    });

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error('Supabase invoice-clients DELETE error:', errorText);
      return res.status(500).json({ error: 'Erreur de suppression du client' });
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Methode non autorisee' });
}
