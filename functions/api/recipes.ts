import { json, type Env } from "./_helpers.ts";

// GET /api/recipes — all recipes (small dataset, served whole; engine runs client-side)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT * FROM recipes ORDER BY name",
  ).all();
  const recipes = (results as any[]).map((r) => ({
    ...r,
    is_gluten_free: !!r.is_gluten_free,
    is_vegetarian: !!r.is_vegetarian,
    is_pescatarian: !!r.is_pescatarian,
    is_dairy_free: !!r.is_dairy_free,
    contains_dairy: !!r.contains_dairy,
    is_one_pot: !!r.is_one_pot,
    image_url: r.image_url || null,
    ingredients: JSON.parse(r.ingredients || "[]"),
    instructions: JSON.parse(r.instructions || "[]"),
  }));
  return json(recipes);
};

// POST /api/recipes — save a custom/remixed recipe into D1
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const r = await ctx.request.json<any>();
  const slug = (r.name || "custom").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  const id = `${slug}-${Date.now().toString(36)}`;
  const ings = r.ingredients || [];
  await ctx.env.DB.prepare(
    `INSERT INTO recipes (id,name,description,cuisine,total_time,servings,
      is_gluten_free,is_vegetarian,is_pescatarian,is_dairy_free,contains_dairy,
      primary_protein,ease_score,ingredient_count,is_one_pot,ingredients,instructions,source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, r.name || "Custom recipe", r.description ?? null, r.cuisine ?? null,
    r.total_time ?? 30, r.servings ?? 4,
    r.is_gluten_free ? 1 : 0, r.is_vegetarian ? 1 : 0, r.is_pescatarian ? 1 : 0,
    r.is_dairy_free ? 1 : 0, r.contains_dairy ? 1 : 0,
    r.primary_protein ?? "none", 0.7, ings.length, 0,
    JSON.stringify(ings), JSON.stringify(r.instructions ?? []), "custom",
  ).run();
  return json({ ok: true, id });
};
