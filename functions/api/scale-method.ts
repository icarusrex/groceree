import { json, type Env } from "./_helpers.ts";
import { geminiUrl, MIN_THINKING } from "./_gemini.ts";

// POST /api/scale-method { recipe, servings, leftovers? }
// The ingredient list scales by arithmetic in the browser; the method can't —
// "add 2 tbsp oil", "a 23 cm tin", "sear in one pan" are prose. This rewrites
// the steps for the batch actually being cooked (a dinner doubled to feed next
// day's lunch), and says how to keep the leftover portion.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { recipe, servings, leftovers } = await ctx.request.json<any>().catch(() => ({}));
  const steps: string[] = recipe?.instructions || [];
  if (!steps.length || !servings || !recipe?.servings) return json({ error: "recipe with instructions, servings required" }, 400);

  const PROMPT = `You are adapting a home recipe to a different batch size.
The recipe was written for ${recipe.servings} servings; it will be cooked for ${servings}.
Rewrite the METHOD for ${servings} servings:
- Scale every quantity written inside a step (spoons, grams, ml, counts) and use metric.
  Round to what a cook would actually measure: whole or half items (2 onions, not 1.25),
  whole or half spoons, grams/ml to the nearest 25.
- Adjust equipment when the batch no longer fits: bigger pot, two trays, a larger dish.
- Where a bigger batch changes technique, say so: sear/brown in batches, don't crowd the pan.
- Only change times where batch size genuinely matters (bringing more liquid to a boil,
  a deeper dish in the oven); leave the rest as written.
- Keep the same order and roughly the same number of steps; plain, short sentences.
${leftovers ? `- ${leftovers} of the ${servings} servings are leftovers for tomorrow's lunch: add one final step saying
  to set that portion aside before serving, cool it, and refrigerate it in a sealed container.` : ""}
Return ONLY JSON: {"instructions":["step", "..."]}

INGREDIENTS (original amounts, for reference):
${JSON.stringify(recipe.ingredients || [])}

METHOD (original):
${JSON.stringify(steps)}`;

  const gres = await fetch(geminiUrl(ctx.env.GEMINI_API_KEY), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.2, response_mime_type: "application/json", ...MIN_THINKING },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    const out = JSON.parse(txt);
    const instructions = (out.instructions || []).filter((s: any) => typeof s === "string" && s.trim());
    if (!instructions.length) throw new Error("empty");
    return json({ instructions });
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }
};
