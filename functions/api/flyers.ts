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

// DELETE /api/flyers?id=
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get("id");
  await ctx.env.DB.prepare("DELETE FROM flyers WHERE id=? AND user_id=?")
    .bind(id, uid(ctx)).run();
  return json({ ok: true });
};
