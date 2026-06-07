import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { categorize } from "./_flyer.ts";

// GET /api/prices — returns price history aggregated for charting:
//  { stores:[...], categories:[...], points:[{date, store, category, avg_price, n}],
//    items:[{name, store, date, price}] }
// Category is inferred from item name keywords; non-grocery rows are dropped.

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const country = await userCountry(ctx.env.DB, uid(ctx));
  const { results } = await ctx.env.DB.prepare(
    `SELECT s.name AS store, p.item_name, p.price, p.valid_from, p.created_at
     FROM store_prices p JOIN stores s ON s.id = p.store_id
     WHERE p.price IS NOT NULL AND p.country=? ORDER BY p.created_at`,
  ).bind(country).all();
  const rows = (results as any[]).map((r) => ({
    store: r.store, name: r.item_name, price: Number(r.price),
    date: (r.valid_from || r.created_at || "").slice(0, 10), cat: categorize(r.item_name),
  })).filter((r) => r.cat !== null) as { store: string; name: string; price: number; date: string; cat: string }[];
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
