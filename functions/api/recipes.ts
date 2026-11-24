import { json, type Env } from "./_helpers.ts";
import { recipeRow, INSERT_RECIPE } from "./_recipes.ts";

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
  const row = recipeRow(await ctx.request.json<any>());
  if ("error" in row) return json({ error: row.error }, row.status);
  await ctx.env.DB.prepare(INSERT_RECIPE).bind(...row.values).run();
  return json({ ok: true, id: row.id });
};
