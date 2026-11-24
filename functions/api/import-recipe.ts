import { json, type Env } from "./_helpers.ts";
import { recipeRow, INSERT_RECIPE } from "./_recipes.ts";
import { findRecipeLd, recipeFromLd } from "../../src/engine/importRecipe.ts";

// POST /api/import-recipe { url } — read a recipe page's schema.org data, save
// it if it's safe for the household allergies, and say why not otherwise.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { url } = await ctx.request.json<any>().catch(() => ({}));
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return json({ error: "paste a recipe link (https://…)" }, 400);
  let html: string;
  try {
    const res = await fetch(url.trim(), { headers: { "user-agent": "Mozilla/5.0 (compatible; groceree)", accept: "text/html" },
      signal: AbortSignal.timeout(15000) });
    if (!res.ok) return json({ error: `the site answered ${res.status}` }, 502);
    html = await res.text();
  } catch {
    return json({ error: "couldn't reach that page" }, 502);
  }
  const ld = findRecipeLd(html);
  const rec = ld && recipeFromLd(ld, url.trim());
  if (!rec) return json({ error: "no recipe found on that page (it has no recipe card data)" }, 422);
  const row = recipeRow({ ...rec, source: "link" });
  if ("error" in row) return json({ error: `“${rec.name}”: ${row.error}`, name: rec.name }, row.status);
  await ctx.env.DB.prepare(INSERT_RECIPE).bind(...row.values).run();
  return json({ ok: true, id: row.id, name: rec.name, ingredients: rec.ingredients.length });
};
