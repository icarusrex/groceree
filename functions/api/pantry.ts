import { json, uid, type Env } from "./_helpers.ts";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM pantry_items WHERE user_id=? ORDER BY created_at DESC",
  ).bind(uid(ctx)).all();
  return json(results);
};

// POST /api/pantry {raw_text} — minimal qty/unit parse; name = remainder
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const { raw_text, source } = await ctx.request.json<any>();
  const m = String(raw_text).match(/^\s*([\d.]+)\s*(kg|g|ml|l|cup|cups|tbsp|tsp|un|x)?\s*(.*)$/i);
  const quantity = m && m[1] ? Number(m[1]) : null;
  const unit = m && m[2] ? m[2].toLowerCase() : null;
  const name = m && m[3] ? m[3].trim() : raw_text;
  // dedup: don't add a second row for an item already in the pantry (case-insensitive name)
  await ctx.env.DB.prepare(
    `INSERT INTO pantry_items (user_id, raw_text, name, quantity, unit, source)
     SELECT ?,?,?,?,?,?
     WHERE NOT EXISTS (
       SELECT 1 FROM pantry_items WHERE user_id=? AND lower(name)=lower(?)
     )`,
  ).bind(user, raw_text, name, quantity, unit, source || "manual", user, name).run();
  return json({ ok: true });
};

// DELETE /api/pantry?id=123
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const id = new URL(ctx.request.url).searchParams.get("id");
  await ctx.env.DB.prepare("DELETE FROM pantry_items WHERE id=? AND user_id=?")
    .bind(id, uid(ctx)).run();
  return json({ ok: true });
};
