import { json, type Env } from "./_helpers.ts";

// POST /api/clean-ingredients { recipe_ids: [...] }
// For each recipe, ask Gemini to turn messy ingredients into clean buy-items,
// then write them back to D1. Key stays server-side.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { recipe_ids } = await ctx.request.json<any>();
  if (!recipe_ids?.length) return json({ error: "recipe_ids required" }, 400);

  const placeholders = recipe_ids.map(() => "?").join(",");
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, ingredients FROM recipes WHERE id IN (${placeholders})`,
  ).bind(...recipe_ids).all();

  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  let updated = 0;

  for (const row of results as any[]) {
    const ings = JSON.parse(row.ingredients || "[]");
    const PROMPT = `Clean this recipe's ingredients into a shopping-ready list.
For each ingredient: give the plain grocery NAME you'd buy at a store (no prep
words like "sliced/chopped/scraped/cut into strips", no "for garnish/to taste"),
a QUANTITY as a number (or null), and a metric UNIT ("g","kg","ml","l" or "" for
whole items counted in units; never lb/oz/cup). Merge duplicates. Drop water and
pure seasonings-to-taste. Keep category as meat|seafood|dairy|produce|pantry|frozen.
Return ONLY a JSON array: [{"name","quantity","unit","category"}].

Recipe: ${row.name}
Ingredients: ${JSON.stringify(ings.map((i: any) => i.name))}`;

    try {
      const gres = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PROMPT }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" },
        }),
      });
      if (!gres.ok) continue;
      const data = await gres.json<any>();
      const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
      const clean = JSON.parse(txt);
      if (!Array.isArray(clean) || !clean.length) continue;
      const normalised = clean.map((c: any) => ({
        name: (c.name || "").trim(), quantity: c.quantity ?? null,
        unit: (c.unit || "").trim(),
        category: ["meat", "seafood", "dairy", "produce", "pantry", "frozen"].includes(c.category)
          ? c.category : "pantry",
      })).filter((c: any) => c.name);
      await ctx.env.DB.prepare(
        "UPDATE recipes SET ingredients=?, ingredient_count=? WHERE id=?",
      ).bind(JSON.stringify(normalised), normalised.length, row.id).run();
      updated++;
    } catch { /* skip this recipe, continue batch */ }
  }
  return json({ updated });
};
