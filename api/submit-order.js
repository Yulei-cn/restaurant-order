// 速率限制：15分钟内最多5次下单
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15分钟
  const maxRequests = 5;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const record = rateLimitMap.get(ip);
  
  if (now > record.resetTime) {
    // 重置计数器
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// 根据您的菜单创建价格表
const menuPrices = {
  "Concombre mariné / 拍黄瓜 - 5.80€": 5.80,
  "Radis aigre-doux / 酸甜萝卜 - 5.80€": 5.80,
  "Pommes de terre râpées / 凉拌土豆丝 - 5.80€": 5.80,
  "Algues marinées / 海带丝 - 5.80€": 5.80,
  "Bœuf mijoté / 烧牛肉 - 8.80€": 8.80,
  "Porc braisé / 红烧肉 - 8.80€": 8.80,
  "Poulet aigre-doux / 糖醋鸡 - 8.80€": 8.80,
  "Porc sauté croustillant / 溜肉段 - 8.80€": 8.80,
  "Poulet frit / 炸鸡块 - 8.80€": 8.80,
  "Porc frit croustillant / 小酥肉 - 8.80€": 8.80,
  "Poulet Kung Pao / 宫保鸡丁 - 8.80€": 8.80,
  "Aubergines braisées / 烧茄子 - 6.80€": 6.80,
  "Haricots verts sautés / 干煸豆角 - 6.80€": 6.80,
  "Œufs aux tomates / 番茄炒鸡蛋 - 6.80€": 6.80,
  "Riz nature / 米饭 - 2.50€": 2.50,
  "Riz sauté / 炒饭 - 5.80€": 5.80,
  "Nouilles sautées / 炒面 - 6.80€": 6.80,
  "Roujiamo porc / 猪肉肉夹馍 - 5.80€": 5.80,
  "Roujiamo bœuf / 牛肉肉夹馍 - 6.80€": 6.80,
  "Coca-Cola / 可乐 - 2.00€": 2.00,
  "Sprite / 雪碧 - 2.00€": 2.00,
  "Fanta / 芬达 - 2.00€": 2.00,
  "Thé à la pêche / 桃茶 - 2.00€": 2.00,
  "Jus d'orange / 橙汁 - 2.00€": 2.00,
  "Eau minérale / 矿泉水 - 2.00€": 2.00,
  "Formule 1 — 米饭/炒面 + 前菜1 + 热菜2 + 饮品 - 11.80€": 11.80,
  "Formule 2 — 米饭/炒面 + 前菜1 + 热菜3 + 饮品 - 13.80€": 13.80
};

export default async function handler(req, res) {
  // 获取客户端IP
  const clientIP = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   'unknown';
  
  // 检查速率限制
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ 
      error: "Trop de commandes. Veuillez patienter 15 minutes." 
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { items, address, phone, notes, customer_name } = req.body;

  // 验证客户姓名
  if (!customer_name || customer_name.trim().length === 0) {
    return res.status(400).json({ error: "Nom du client requis" });
  }

  if (customer_name.length > 50) {
    return res.status(400).json({ error: "Nom trop long" });
  }

  // 验证订单
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Commande vide" });
  }

  // 重新计算价格防止篡改
  let serverTotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const correctPrice = menuPrices[item.name];
    
    if (!correctPrice) {
      return res.status(400).json({ error: `Produit invalide: ${item.name}` });
    }

    if (item.qty <= 0 || item.qty > 10) {
      return res.status(400).json({ error: `Quantité invalide: ${item.qty}` });
    }

    // 使用服务端正确价格
    validatedItems.push({
      name: item.name,
      qty: item.qty,
      price: correctPrice
    });

    serverTotal += correctPrice * item.qty;
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
        items: validatedItems, // 使用验证后的商品
        address: address ? address.trim() : null,
        phone: phone ? phone.trim() : null,
        notes: notes ? notes.trim() : null,
        customer_name: customer_name.trim()
      })
    });

    if (!supabaseRes.ok) throw new Error("Erreur Supabase");

    res.status(200).json({ 
      status: "ok",
      serverTotal: serverTotal 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
