export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { items, address, phone, notes, customer_name } = req.body;

  // 基本验证
  if (!Array.isArray(items) || items.length === 0 || !customer_name) {
    return res.status(400).json({ error: "Commande invalide" });
  }

  try {
    const supabaseRes = await fetch("https://fdbcypvxuikhmxvyyvmb.supabase.co/rest/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        status: "新订单",
        items,
        address,
        phone,
        notes,
        customer_name
      })
    });

    if (!supabaseRes.ok) throw new Error("Erreur Supabase");

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
