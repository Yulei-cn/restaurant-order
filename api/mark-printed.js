export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID manquant" });

  const supabaseRes = await fetch(
    `https://fdbcypvxuikhmxvyyvmb.supabase.co/rest/v1/orders?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ status: "已打印" })
    }
  );

  if (supabaseRes.ok) {
    res.status(200).json({ status: "ok" });
  } else {
    res.status(500).json({ error: "Échec de mise à jour" });
  }
}

