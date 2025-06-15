export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const supabaseRes = await fetch(
    "https://fdbcypvxuikhmxvyyvmb.supabase.co/rest/v1/orders?status=eq.新订单&select=id,created_at,items,notes,address,phone,customer_name&order=created_at.desc",
    {
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  );

  const data = await supabaseRes.json();
  res.status(200).json(data);
}
