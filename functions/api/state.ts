import { json, uid, type Env } from "./_helpers.ts";

// GET /api/state — map of recipeId -> learning state for this user
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM recipe_state WHERE user_id=?",
  ).bind(uid(ctx)).all();
  const map: Record<string, any> = {};
  for (const r of results as any[]) {
    map[r.recipe_id] = {
      is_favorite: !!r.is_favorite, is_hidden: !!r.is_hidden,
      times_cooked: r.times_cooked, times_skipped: r.times_skipped,
      last_cooked_at: r.last_cooked_at,
    };
  }
  return json(map);
};

// POST /api/state {recipe_id, signal}
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const { recipe_id, signal } = await ctx.request.json<any>();
  const db = ctx.env.DB;
  await db.prepare(
    "INSERT OR IGNORE INTO recipe_state (user_id, recipe_id) VALUES (?,?)",
  ).bind(user, recipe_id).run();
  const sets: Record<string, string> = {
    favorite: "is_favorite=1", unfavorite: "is_favorite=0",
    hide: "is_hidden=1", unhide: "is_hidden=0",
    cooked: "times_cooked=times_cooked+1, last_cooked_at=datetime('now')",
    skipped: "times_skipped=times_skipped+1",
  };
  if (sets[signal]) {
    await db.prepare(
      `UPDATE recipe_state SET ${sets[signal]}, updated_at=datetime('now')
       WHERE user_id=? AND recipe_id=?`,
    ).bind(user, recipe_id).run();
    await db.prepare(
      "INSERT INTO recipe_events (user_id, recipe_id, signal) VALUES (?,?,?)",
    ).bind(user, recipe_id, signal).run();
  }
  return json({ ok: true });
};
