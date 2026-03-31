import { getServiceHeaders, getSupabaseUrl, requireSupabaseConfig, roundMoney } from './_supabase.js';
import { requireAdminConfig, requireAdminSession } from './_adminAuth.js';

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
    invoice_client_id,
    issue_date,
    payment_method,
    ticket_reference = '',
    items
  } = req.body || {};

  if (!invoice_client_id) {
    return res.status(400).json({ error: 'Client requis' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Au moins une ligne de facture est requise' });
  }

  let subtotalAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  const itemPayloads = [];

  for (const [index, item] of items.entries()) {
    const description = String(item?.description || '').trim();
    const quantity = Number(item?.quantity);
    const unitPriceHT = roundMoney(Number(item?.unit_price_ht));
    const unitPriceTTC = roundMoney(Number(item?.unit_price_ttc));
    const taxRate = roundMoney(Number(item?.tax_rate ?? 10));

    if (!description) {
      return res.status(400).json({ error: 'Description invalide' });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantite invalide' });
    }

    if (unitPriceHT < 0 || unitPriceTTC < 0) {
      return res.status(400).json({ error: 'Prix invalide' });
    }

    const lineTotalHT = roundMoney(unitPriceHT * quantity);
    const lineTotalTTC = roundMoney(unitPriceTTC * quantity);
    subtotalAmount = roundMoney(subtotalAmount + lineTotalHT);
    totalAmount = roundMoney(totalAmount + lineTotalTTC);

    itemPayloads.push({
      sort_order: index,
      description,
      quantity,
      unit_price_ht: unitPriceHT,
      tax_rate: taxRate,
      unit_price_ttc: unitPriceTTC
    });
  }

  taxAmount = roundMoney(totalAmount - subtotalAmount);

  const notes = ticket_reference ? `Ticket reference: ${String(ticket_reference).trim()}` : null;

  const supabaseRes = await fetch(getSupabaseUrl('/rest/v1/rpc/create_invoice_with_items'), {
    method: 'POST',
    headers: getServiceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify({
      invoice_payload: {
        invoice_client_id: String(invoice_client_id).trim(),
        issue_date: issue_date ? String(issue_date).trim() : null,
        payment_method: payment_method ? String(payment_method).trim() : null,
        payment_status: 'paid',
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: 'EUR',
        notes
      },
      item_payloads: itemPayloads
    })
  });

  if (!supabaseRes.ok) {
    const errorText = await supabaseRes.text();
    console.error('Supabase save-invoice RPC error:', errorText);
    return res.status(500).json({ error: 'Erreur de sauvegarde de la facture' });
  }

  const data = await supabaseRes.json();
  const savedInvoice = Array.isArray(data) ? data[0] : data;

  if (!savedInvoice?.id || !savedInvoice?.invoice_number) {
    console.error('Unexpected create_invoice_with_items response:', data);
    return res.status(500).json({ error: 'Reponse serveur invalide' });
  }

  return res.status(200).json({
    status: 'ok',
    invoiceId: savedInvoice.id,
    invoiceNumber: savedInvoice.invoice_number,
    totalAmount: savedInvoice.total_amount
  });
}
