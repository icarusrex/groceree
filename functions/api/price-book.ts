import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { NOT_FOUND_TTL_DAYS, RECEIPT_TTL_DAYS, SHELF_TTL_DAYS } from "./_pricebook.ts";

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
  const fresh: string[] = [];
  const shelf = new Map<string, any>(), receipt = new Map<string, any>();
  for (const r of results) {
    const priced = r.per_kg != null || r.per_item != null;
    // a found price is good for the TTL; a "not found" is retried after a week
    if (r.source === "shelf" && r.age < (priced ? SHELF_TTL_DAYS : NOT_FOUND_TTL_DAYS)) fresh.push(r.item);
    if (!priced) continue;
    if (r.source === "shelf" && r.age < SHELF_TTL_DAYS * 3) shelf.set(r.item, r);
    if (r.source === "receipt" && r.age < RECEIPT_TTL_DAYS) receipt.set(r.item, r);
  }
  const prices: Record<string, any> = {};
  for (const item of new Set([...shelf.keys(), ...receipt.keys()])) {
    const sh = shelf.get(item), rc = receipt.get(item);
    // A paid price wins, field by field (a per-pack receipt price doesn't hide
    // the shelf €/kg) — unless it's wildly off the shelf, which means the
    // receipt line was a different product (chips for "potato", ham for
    // "turkey breast"), not that Lidl sells potatoes at 6× Auchan's price.
    const sane = (a: number | null, b: number | null) => a == null || b == null || (a / b >= 0.4 && a / b <= 2.5);
    const useRc = rc && sane(rc.per_kg, sh?.per_kg) && sane(rc.per_item, sh?.per_item);
    const per_kg = (useRc ? rc.per_kg : null) ?? sh?.per_kg ?? null;
    const per_item = (useRc ? rc.per_item : null) ?? sh?.per_item ?? null;
    if (per_kg == null && per_item == null) continue;
    const src = useRc ? rc : sh;
    prices[item] = { per_kg, per_item, source: useRc ? "receipt" : "shelf", store: src.store, updated_at: src.updated_at };
  }
  return json({ prices, fresh });
};
