import { json, uid, ensureSettings, type Env } from "./_helpers.ts";

const shape = (r: any) => ({
  household_size: r.household_size,
  diet: JSON.parse(r.diet || "[]"),
  exclude_cuisines: JSON.parse(r.exclude_cuisines || "[]"),
  max_active_minutes: r.max_active_minutes,
  leftover_strategy: r.leftover_strategy,
  plan_days: r.plan_days ?? 4,
  selected_stores: JSON.parse(r.selected_stores || "[]"),
  country: r.country ?? "PT",
  notion_parent_id: r.notion_parent_id ?? "",
  monthly_food_budget: r.monthly_food_budget ?? null,
});

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const row = await ensureSettings(ctx.env.DB, uid(ctx));
  return json(shape(row));
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = uid(ctx);
  const b = await ctx.request.json<any>();
  await ensureSettings(ctx.env.DB, user);
  await ctx.env.DB.prepare(
    `UPDATE user_settings SET household_size=?, diet=?, exclude_cuisines=?,
     max_active_minutes=?, leftover_strategy=?, plan_days=?, selected_stores=?,
     country=?, notion_parent_id=?, monthly_food_budget=?, updated_at=datetime('now')
     WHERE user_id=?`,
  ).bind(
    Math.max(1, Math.round(Number(b.household_size) || 2)), JSON.stringify(b.diet ?? []),
    JSON.stringify(b.exclude_cuisines ?? []),
    b.max_active_minutes ?? null, b.leftover_strategy ?? "auto",
    b.plan_days === 7 ? 7 : 4, JSON.stringify(b.selected_stores ?? []),
    "PT",
    (b.notion_parent_id ?? "").trim() || null,
    Number(b.monthly_food_budget) > 0 ? Math.round(Number(b.monthly_food_budget)) : null, user,
  ).run();
  return json({ ok: true });
};
