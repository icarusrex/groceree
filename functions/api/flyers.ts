import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { analyzeFlyer, buildIngredientIndex, type DealRow, type IngredientIndex } from "./_analysis.ts";

// GET /api/flyers — list stored flyers (most recent first), with active flag and
// a computed deal analysis (stock-up / cook-fresh / recipe-relevant picks) for
// each non-expired flyer. The analysis is deterministic — derived from the price
// rows + the user's recipe ingredients, recomputed on read so it stays current.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const country = await userCountry(ctx.env.DB, user);
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM flyers WHERE country=? ORDER BY created_at DESC LIMIT 20",
  ).bind(country).all();
  const today = new Date().toISOString().slice(0, 10);

  const rows = results as any[];
  const anyActive = rows.some((f) => !f.valid_to || f.valid_to >= today);
  // Build the recipe-ingredient index once, only if there's a flyer to analyse.
  const idx: IngredientIndex = anyActive ? await buildIngredientIndex(ctx.env.DB, user) : new Map();
  // Dietary prefs hard-filter the picks (e.g. dairy-free hides yogurt deals).
  let diet: string[] = [];
  if (anyActive) {
    const st = await ctx.env.DB.prepare("SELECT diet FROM user_settings WHERE user_id=?")
      .bind(user).first<{ diet: string }>();
    try { diet = JSON.parse(st?.diet || "[]"); } catch { diet = []; }
  }

  const flyers = await Promise.all(rows.map(async (f) => {
    const expired = f.valid_to && f.valid_to < today;
    let analysis = null;
    if (!expired) {
      const pr = await ctx.env.DB.prepare(
        `SELECT item_name, item_name_pt, unit, price, normal_price, discount
           FROM store_prices WHERE store_id=? AND country=? AND IFNULL(valid_from,'')=IFNULL(?,'')`,
      ).bind(f.store_id, country, f.valid_from ?? null).all();
      const deal = analyzeFlyer((pr.results as unknown as DealRow[]) || [], idx, diet);
      // Only surface the analysis when the store actually has discounts. Stores
      // with no offers (e.g. full-catalogue feeds) are tracked for the cross-store
      // comparison but shouldn't pad the UI — the card just notes prices tracked.
      if (deal.stock_up.length || deal.cook_fresh.length) analysis = deal;
    }
    return {
      id: f.id, store_name: f.store_name, valid_from: f.valid_from, valid_to: f.valid_to,
      summary: f.summary, item_count: f.item_count, deals: JSON.parse(f.deals || "{}"),
      active: (!f.valid_from || f.valid_from <= today) && (!f.valid_to || f.valid_to >= today),
      analysis,
    };
  }));
  return json(flyers);
};

// DELETE /api/flyers?id= — also drops the flyer's price rows so deleting a
// flyer removes it from the price comparison/trend, not just the card list.
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get("id");
  const country = await userCountry(ctx.env.DB, uid(ctx));
  const f = await ctx.env.DB.prepare(
    "SELECT store_id, valid_from FROM flyers WHERE id=? AND country=?",
  ).bind(id, country).first<{ store_id: string; valid_from: string | null }>();
  if (f) {
    await ctx.env.DB.prepare(
      "DELETE FROM store_prices WHERE store_id=? AND country=? AND IFNULL(valid_from,'')=IFNULL(?,'')",
    ).bind(f.store_id, country, f.valid_from ?? null).run();
  }
  await ctx.env.DB.prepare("DELETE FROM flyers WHERE id=? AND country=?")
    .bind(id, country).run();
  return json({ ok: true });
};
