import { json, uid, type Env } from "./_helpers.ts";

// GET /api/flyers — list stored flyers (most recent first), with active flag
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM flyers WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
  ).bind(uid(ctx)).all();
  const today = new Date().toISOString().slice(0, 10);
  const flyers = (results as any[]).map((f) => ({
    id: f.id, store_name: f.store_name, valid_from: f.valid_from, valid_to: f.valid_to,
    summary: f.summary, item_count: f.item_count, deals: JSON.parse(f.deals || "{}"),
    active: (!f.valid_from || f.valid_from <= today) && (!f.valid_to || f.valid_to >= today),
  }));
  return json(flyers);
};

// DELETE /api/flyers?id= — also drops the flyer's price rows so deleting a
// flyer removes it from the price comparison/trend, not just the card list.
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get("id");
  const user = uid(ctx);
  const f = await ctx.env.DB.prepare(
    "SELECT store_id, valid_from FROM flyers WHERE id=? AND user_id=?",
  ).bind(id, user).first<{ store_id: string; valid_from: string | null }>();
  if (f) {
    await ctx.env.DB.prepare(
      "DELETE FROM store_prices WHERE store_id=? AND IFNULL(valid_from,'')=IFNULL(?,'')",
    ).bind(f.store_id, f.valid_from ?? null).run();
  }
  await ctx.env.DB.prepare("DELETE FROM flyers WHERE id=? AND user_id=?")
    .bind(id, user).run();
  return json({ ok: true });
};
