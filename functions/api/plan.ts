import { json, uid, type Env } from "./_helpers.ts";

const validWeek = (week: unknown): week is string => {
  if (typeof week !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return false;
  const date = new Date(`${week}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === week && date.getUTCDay() === 1;
};
const validSlot = (slot: any) => slot && Number.isInteger(slot.day_of_week) &&
  slot.day_of_week >= 1 && slot.day_of_week <= 7 && ["lunch", "dinner"].includes(slot.slot);

// One D1 batch reads the revision and its items from the same snapshot.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const week = new URL(ctx.request.url).searchParams.get("week");
  if (!validWeek(week)) return json({ error: "A valid Monday is required." }, 400);
  const user = uid(ctx);
  const [plans, items] = await ctx.env.DB.batch([
    ctx.env.DB.prepare("SELECT * FROM meal_plans WHERE user_id=? AND week_start=?").bind(user, week),
    ctx.env.DB.prepare(`SELECT * FROM meal_plan_items
      WHERE plan_id=(SELECT id FROM meal_plans WHERE user_id=? AND week_start=?)
      ORDER BY day_of_week, CASE slot WHEN 'lunch' THEN 0 ELSE 1 END`).bind(user, week),
  ]);
  const plan = plans.results[0] as Record<string, unknown> | undefined;
  if (!plan) return json(null);
  return json({ ...plan, items: items.results.map((item: any) => {
    let source = null;
    try { source = JSON.parse(item.leftover_of); } catch {}
    // Older saves omitted the link. The engine made next-day lunch leftovers.
    if (item.is_leftover && !validSlot(source) && items.results.some((p: any) =>
      p.day_of_week === item.day_of_week - 1 && p.slot === "dinner" &&
      p.recipe_id === item.recipe_id && !p.is_leftover)) {
      source = { day_of_week: item.day_of_week - 1, slot: "dinner" };
    }
    return { day_of_week: item.day_of_week, slot: item.slot, recipe_id: item.recipe_id,
      is_leftover: !!item.is_leftover, leftover_of: validSlot(source) ? source : null,
      servings: item.servings };
  }) });
};

// expected_revision=null creates only if absent; an integer updates that revision.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let b: any;
  try { b = await ctx.request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b || !Object.hasOwn(b, "expected_revision"))
    return json({ error: "Reload Groceree before saving this plan." }, 428);
  if (!validWeek(b.week_start) || !Array.isArray(b.items) || b.items.length > 14 ||
      (b.expected_revision !== null && (!Number.isSafeInteger(b.expected_revision) || b.expected_revision < 1)) ||
      (b.status !== undefined && !["draft", "saved"].includes(b.status)))
    return json({ error: "Invalid plan." }, 400);
  const seen = new Set<string>();
  for (const item of b.items) {
    const key = `${item?.day_of_week}:${item?.slot}`;
    if (!validSlot(item) || seen.has(key) || typeof item.is_leftover !== "boolean" ||
        (item.recipe_id !== null && (typeof item.recipe_id !== "string" || !item.recipe_id.trim())) ||
        !Number.isSafeInteger(item.servings) || item.servings < 1 ||
        (item.leftover_of != null && (!item.is_leftover || !validSlot(item.leftover_of))))
      return json({ error: "Invalid meal slot." }, 400);
    seen.add(key);
  }
  const user = uid(ctx), db = ctx.env.DB, revision = b.expected_revision ?? 0;
  const target = "SELECT id FROM meal_plans WHERE user_id=? AND week_start=? AND revision=?";
  const statements: D1PreparedStatement[] = [];
  if (b.expected_revision === null) statements.push(db.prepare(
    "INSERT OR IGNORE INTO meal_plans (user_id,week_start,status,revision) VALUES (?,?,?,0)",
  ).bind(user, b.week_start, b.status || "draft"));
  statements.push(db.prepare(`DELETE FROM meal_plan_items WHERE plan_id=(${target})`)
    .bind(user, b.week_start, revision));
  for (const item of b.items) statements.push(db.prepare(
    `INSERT INTO meal_plan_items (plan_id,day_of_week,slot,recipe_id,is_leftover,leftover_of,servings)
     SELECT id,?,?,?,?,?,? FROM meal_plans WHERE user_id=? AND week_start=? AND revision=?`,
  ).bind(item.day_of_week, item.slot, item.recipe_id, item.is_leftover ? 1 : 0,
    item.leftover_of ? JSON.stringify(item.leftover_of) : null, item.servings,
    user, b.week_start, revision));
  statements.push(db.prepare(`UPDATE meal_plans SET status=?, revision=revision+1
    WHERE user_id=? AND week_start=? AND revision=? RETURNING id,revision`)
    .bind(b.status || "draft", user, b.week_start, revision));
  // Conditional writes and version bump run atomically. A stale request changes
  // nothing, including during a race to import an old browser-only plan.
  const results = await db.batch(statements);
  const saved = results[results.length - 1].results[0] as any;
  if (!saved) return json({ error: "This plan changed on another device. Load the cloud plan first." }, 409);
  return json({ ok: true, plan_id: saved.id, revision: saved.revision });
};
