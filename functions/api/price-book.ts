import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { RECEIPT_TTL_DAYS, SHELF_TTL_DAYS } from "./_pricebook.ts";

// GET /api/price-book → { prices: { item: {per_kg, per_item, source, updated_at} }, fresh: [items] }
// The resolved unit price per ingredient: a recent receipt (what you actually
// paid) wins over the shelf price. `fresh` lists items whose shelf lookup is
// recent (priced or known-missing), so the browser only fills the rest.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const country = await userCountry(ctx.env.DB, uid(ctx));
  const { results } = await ctx.env.DB.prepare(
    `SELECT item, source, per_kg, per_item, store, updated_at,
       julianday('now') - julianday(updated_at) AS age FROM price_book WHERE country=?`,
  ).bind(country).all<any>();
  const prices: Record<string, any> = {};
  const fresh: string[] = [];
  for (const r of results) {
    if (r.source === "shelf" && r.age < SHELF_TTL_DAYS) fresh.push(r.item);
    if (r.per_kg == null && r.per_item == null) continue;
    const live = r.source === "receipt" ? r.age < RECEIPT_TTL_DAYS : r.age < SHELF_TTL_DAYS * 3;
    if (!live) continue;
    const cur = prices[r.item];
    if (!cur || (r.source === "receipt" && cur.source !== "receipt")) {
      prices[r.item] = { per_kg: r.per_kg, per_item: r.per_item, source: r.source, store: r.store, updated_at: r.updated_at };
    }
  }
  return json({ prices, fresh });
};
