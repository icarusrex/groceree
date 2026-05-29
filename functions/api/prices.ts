import { json, type Env } from "./_helpers.ts";

// GET /api/prices — returns price history aggregated for charting:
//  { stores:[...], categories:[...], points:[{date, store, category, avg_price, n}],
//    items:[{name, store, date, price}] }
// Category is inferred from item name keywords (flyers don't carry our categories).
const CAT = (name: string) => {
  const n = name.toLowerCase();
  if (/chicken|beef|pork|lamb|turkey|sausage|bacon|mince|steak/.test(n)) return "meat";
  if (/fish|salmon|cod|tuna|prawn|shrimp|sardine|hake|squid/.test(n)) return "fish";
  if (/milk|cheese|yogurt|yoghurt|butter|cream|egg/.test(n)) return "dairy";
  if (/apple|banana|tomato|onion|potato|carrot|lettuce|pepper|fruit|veg|salad|orange|lemon/.test(n)) return "produce";
  return "pantry";
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    `SELECT s.name AS store, p.item_name, p.price, p.valid_from, p.created_at
     FROM store_prices p JOIN stores s ON s.id = p.store_id
     WHERE p.price IS NOT NULL ORDER BY p.created_at`,
  ).all();
  const rows = (results as any[]).map((r) => ({
    store: r.store, name: r.item_name, price: Number(r.price),
    date: (r.valid_from || r.created_at || "").slice(0, 10), cat: CAT(r.item_name),
  }));
  // aggregate avg price per (date, store, category)
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = `${r.date}|${r.store}|${r.cat}`;
    const a = agg.get(k) || { sum: 0, n: 0 };
    a.sum += r.price; a.n += 1; agg.set(k, a);
  }
  const points = [...agg.entries()].map(([k, v]) => {
    const [date, store, category] = k.split("|");
    return { date, store, category, avg_price: Math.round((v.sum / v.n) * 100) / 100, n: v.n };
  });
  return json({
    stores: [...new Set(rows.map((r) => r.store))],
    categories: [...new Set(rows.map((r) => r.cat))],
    points, items: rows, count: rows.length,
  });
};
