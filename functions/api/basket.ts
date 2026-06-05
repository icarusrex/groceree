import { json, uid, type Env } from "./_helpers.ts";
import { SOURCES } from "./_sources.ts";

// Staple basket — the honest cross-store price-level comparison. The user logs the
// REGULAR shelf price of staples they actually buy at each store; because it's the
// SAME item priced at each store, the comparison is apples-to-apples (unlike flyer
// averages, which only reflect what each store chose to promote). The index is
// built only from items priced at 2+ stores, normalised so the cheapest store = 1.

const STORE_ORDER = ["Lidl", "Aldi", "Pingo Doce", "Continente", "Intermarché"];
const storeNames = () => {
  const known = SOURCES.map((s) => s.name);
  // keep the preferred order, then any extra known stores.
  return [...STORE_ORDER.filter((s) => known.includes(s)),
    ...known.filter((s) => !STORE_ORDER.includes(s))];
};

// Sensible starter staples (all GF/DF, carried by every chain) — shown when the
// basket is empty so there's something to fill in immediately.
const DEFAULT_STAPLES = [
  "Eggs (dozen)", "Rice (1kg)", "Potatoes (1kg)", "Onions (1kg)", "Carrots (1kg)",
  "Bananas (1kg)", "Tomatoes (1kg)", "Apples (1kg)", "Chicken breast (1kg)",
  "Minced beef (1kg)", "Canned tuna (tin)", "Canned chickpeas (tin)",
];

interface Row { item: string; store: string; price: number | null; updated_at: string }

function buildIndex(rows: Row[], stores: string[]) {
  // item -> store -> price (only real numbers)
  const byItem: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (typeof r.price !== "number" || r.price <= 0) continue;
    (byItem[r.item] ||= {})[r.store] = r.price;
  }
  const ratios: Record<string, number[]> = {};
  let comparableItems = 0;
  for (const prices of Object.values(byItem)) {
    const entries = Object.entries(prices);
    if (entries.length < 2) continue; // need 2+ stores to compare
    comparableItems++;
    const cheapest = Math.min(...entries.map(([, p]) => p));
    for (const [st, p] of entries) (ratios[st] ||= []).push(p / cheapest);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const raw: { store: string; index: number; n: number }[] = [];
  for (const st of stores) {
    const r = ratios[st];
    if (r && r.length) raw.push({ store: st, index: avg(r), n: r.length });
  }
  if (raw.length < 2) return { index: [] as typeof raw, comparableItems };
  const min = Math.min(...raw.map((x) => x.index));
  return {
    index: raw.map((x) => ({ ...x, index: x.index / (min || 1) })).sort((a, b) => a.index - b.index),
    comparableItems,
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const { results } = await ctx.env.DB.prepare(
    "SELECT item, store, price, updated_at FROM basket_prices WHERE user_id=?",
  ).bind(user).all();
  const rows = results as unknown as Row[];

  const prices: Record<string, Record<string, number>> = {};
  let latest = "";
  for (const r of rows) {
    if (typeof r.price === "number") (prices[r.item] ||= {})[r.store] = r.price;
    if (r.updated_at > latest) latest = r.updated_at;
  }
  const have = [...new Set(rows.map((r) => r.item))];
  const items = have.length ? have.sort() : DEFAULT_STAPLES;
  const stores = storeNames();
  const { index, comparableItems } = buildIndex(rows, stores);
  return json({ stores, items, prices, index, comparable_items: comparableItems, updated: latest || null });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const b = await ctx.request.json<any>().catch(() => ({}));
  const op = b.op || "set";

  if (op === "set") {
    const item = String(b.item || "").trim();
    const store = String(b.store || "").trim();
    if (!item || !store) return json({ error: "item and store required" }, 400);
    const price = b.price === null || b.price === "" ? null : Number(b.price);
    if (price == null || !isFinite(price)) {
      await ctx.env.DB.prepare("DELETE FROM basket_prices WHERE user_id=? AND item=? AND store=?")
        .bind(user, item, store).run();
    } else {
      await ctx.env.DB.prepare(
        `INSERT INTO basket_prices (user_id,item,store,price,updated_at)
         VALUES (?,?,?,?,datetime('now'))
         ON CONFLICT(user_id,item,store) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at`,
      ).bind(user, item, store, price).run();
    }
    return json({ ok: true });
  }

  if (op === "addItem") {
    const item = String(b.item || "").trim();
    if (!item) return json({ error: "item required" }, 400);
    // Materialise the row with a null price so the item persists with no price yet.
    await ctx.env.DB.prepare(
      `INSERT OR IGNORE INTO basket_prices (user_id,item,store,price) VALUES (?,?,?,NULL)`,
    ).bind(user, item, "_").run();
    return json({ ok: true });
  }

  if (op === "removeItem") {
    const item = String(b.item || "").trim();
    await ctx.env.DB.prepare("DELETE FROM basket_prices WHERE user_id=? AND item=?")
      .bind(user, item).run();
    return json({ ok: true });
  }

  if (op === "renameItem") {
    const item = String(b.item || "").trim();
    const to = String(b.to || "").trim();
    if (!item || !to) return json({ error: "item and to required" }, 400);
    await ctx.env.DB.prepare("UPDATE basket_prices SET item=? WHERE user_id=? AND item=?")
      .bind(to, user, item).run();
    return json({ ok: true });
  }

  return json({ error: "unknown op" }, 400);
};
