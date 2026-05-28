import { json, uid, type Env } from "./_helpers.ts";

// GET /api/plan?week=YYYY-MM-DD
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const week = new URL(ctx.request.url).searchParams.get("week");
  const user = uid(ctx);
  const plan = await ctx.env.DB.prepare(
    "SELECT * FROM meal_plans WHERE user_id=? AND week_start=?",
  ).bind(user, week).first<any>();
  if (!plan) return json(null);
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM meal_plan_items WHERE plan_id=? ORDER BY day_of_week",
  ).bind(plan.id).all();
  return json({ ...plan, items: results });
};

// POST /api/plan {week_start, status, items:[{day_of_week,slot,recipe_id,is_leftover,servings}]}
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const b = await ctx.request.json<any>();
  const db = ctx.env.DB;
  await db.prepare(
    `INSERT INTO meal_plans (user_id, week_start, status) VALUES (?,?,?)
     ON CONFLICT(user_id, week_start) DO UPDATE SET status=excluded.status`,
  ).bind(user, b.week_start, b.status || "saved").run();
  const plan = await db.prepare(
    "SELECT id FROM meal_plans WHERE user_id=? AND week_start=?",
  ).bind(user, b.week_start).first<any>();
  await db.prepare("DELETE FROM meal_plan_items WHERE plan_id=?").bind(plan.id).run();
  for (const it of b.items || []) {
    await db.prepare(
      `INSERT INTO meal_plan_items (plan_id,day_of_week,slot,recipe_id,is_leftover,servings)
       VALUES (?,?,?,?,?,?)`,
    ).bind(plan.id, it.day_of_week, it.slot, it.recipe_id ?? null,
           it.is_leftover ? 1 : 0, it.servings ?? null).run();
  }
  return json({ ok: true, plan_id: plan.id });
};
