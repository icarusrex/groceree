import { json, uid, type Env } from "./_helpers.ts";
import { crossStoreDeals, bestStore, buildIngredientIndex, type DealRow, type StoreDeal } from "./_analysis.ts";

// GET /api/best-deals — the cross-store overview: the most compelling discounted,
// diet-friendly, recipe-relevant offers across ALL of the user's active flyers,
// each tagged with its store. Deterministic (no AI) — computed from the price
// rows + recipe ingredients + diet prefs, so it stays current on every read.
// Stores with no discounts contribute nothing, which is the point: this is where
// the savings are this week, not a dump of every catalogue.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const today = new Date().toISOString().slice(0, 10);

  // Newest non-expired flyer per store (don't double-count re-uploads).
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM flyers WHERE user_id=? ORDER BY created_at DESC",
  ).bind(user).all();
  const byStore = new Map<string, any>();
  for (const f of results as any[]) {
    if (f.valid_to && f.valid_to < today) continue;
    if (!byStore.has(f.store_id)) byStore.set(f.store_id, f);
  }
  const flyers = [...byStore.values()];
  if (!flyers.length) return json({ deals: [] as StoreDeal[], store_count: 0 });

  const idx = await buildIngredientIndex(ctx.env.DB, user);
  let diet: string[] = [];
  const st = await ctx.env.DB.prepare("SELECT diet FROM user_settings WHERE user_id=?")
    .bind(user).first<{ diet: string }>();
  try { diet = JSON.parse(st?.diet || "[]"); } catch { diet = []; }

  const perStore = await Promise.all(flyers.map(async (f) => {
    const pr = await ctx.env.DB.prepare(
      `SELECT item_name, item_name_pt, unit, price, normal_price, discount
         FROM store_prices WHERE store_id=? AND IFNULL(valid_from,'')=IFNULL(?,'')`,
    ).bind(f.store_id, f.valid_from ?? null).all();
    return { store: f.store_name as string, rows: (pr.results as unknown as DealRow[]) || [] };
  }));

  const deals = crossStoreDeals(perStore, idx, diet, 8);
  const best = bestStore(perStore, idx, diet);
  // Validity window of the flyers these deals come from, so the UI can show the
  // date and you can tell the data is current (or stale).
  const froms = flyers.map((f) => f.valid_from).filter(Boolean).sort();
  const tos = flyers.map((f) => f.valid_to).filter(Boolean).sort();
  const dates = (froms.length || tos.length)
    ? { from: froms[0] || null, to: tos[tos.length - 1] || null }
    : null;
  return json({ deals, best, dates, store_count: flyers.length });
};
