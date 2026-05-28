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
    ingredients: JSON.parse(r.ingredients || "[]"),
    instructions: JSON.parse(r.instructions || "[]"),
  }));
  return json(recipes);
};
