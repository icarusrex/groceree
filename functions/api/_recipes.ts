import { dietConflicts } from "../../src/engine/allergens.ts";

// One place that turns a recipe into a stored row, shared by POST /api/recipes,
// "add from link" and the bulk import script. Anything containing a household
// allergen is refused here, so it can never reach a plan.
export const RECIPE_COLUMNS = ["id", "name", "description", "cuisine", "total_time", "servings",
  "is_gluten_free", "is_vegetarian", "is_pescatarian", "is_dairy_free", "contains_dairy",
  "primary_protein", "ease_score", "ingredient_count", "is_one_pot", "ingredients", "instructions",
  "source", "image_url", "source_url"] as const;
export const INSERT_RECIPE = `INSERT INTO recipes (${RECIPE_COLUMNS.join(",")}) VALUES (${RECIPE_COLUMNS.map(() => "?").join(",")})`;

const SOURCES = /^(custom|link|import:[a-z0-9.-]+)$/;

export function recipeRow(r: any, id?: string): { error: string; status: number } | { id: string; values: unknown[] } {
  const ings = (Array.isArray(r?.ingredients) ? r.ingredients : [])
    .filter((i: any) => i && typeof i.name === "string" && i.name.trim());
  if (!ings.length) return { error: "a recipe needs ingredients", status: 400 };
  const steps = Array.isArray(r.instructions) ? r.instructions.map(String) : [];
  const hits = dietConflicts({ ingredients: ings, instructions: steps, description: r.description }, []);
  if (hits.size) return { error: `Not saved — contains ${[...hits].map(([a, l]) => `${a} (${l})`).join(", ")}.`, status: 422 };
  const slug = String(r.name || "custom").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  id ??= `${slug}-${Date.now().toString(36)}`;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown, d: number) => (Number(v) > 0 ? Math.round(Number(v)) : d);
  return { id, values: [
    id, str(r.name) ?? "Custom recipe", str(r.description), str(r.cuisine),
    num(r.total_time, 30), num(r.servings, 4),
    1, r.is_vegetarian ? 1 : 0, r.is_pescatarian ? 1 : 0, 1, 0, // gluten/dairy-free: passed the scan above
    str(r.primary_protein) ?? "none", 0.7, ings.length, 0,
    JSON.stringify(ings), JSON.stringify(steps),
    SOURCES.test(r.source) ? r.source : "custom", str(r.image_url), str(r.source_url),
  ] };
}
