import { json, type Env } from "./_helpers.ts";

// POST /api/remix-recipe { recipe, instruction }
// Returns a modified recipe in the same shape the app uses.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { recipe, instruction } = await ctx.request.json<any>();
  if (!recipe || !instruction) return json({ error: "recipe and instruction required" }, 400);

  const PROMPT = `You are a recipe editor. Modify the recipe below per the user's
instruction. Keep it realistic and cookable. Return ONLY JSON, no prose, shaped:
{"name":"<dish name>","description":"<one line>",
 "ingredients":[{"name":"","quantity":<number|null>,"unit":"","category":"meat|seafood|dairy|produce|pantry|frozen"}],
 "instructions":["step", "..."],
 "primary_protein":"chicken|beef|pork|turkey|fish|lamb|duck|none",
 "is_gluten_free":<bool>,"is_vegetarian":<bool>,"is_pescatarian":<bool>,
 "is_dairy_free":<bool>,"contains_dairy":<bool>,
 "total_time":<minutes>,"servings":<number>}

INSTRUCTION: ${instruction}

RECIPE:
${JSON.stringify({
    name: recipe.name, ingredients: recipe.ingredients,
    instructions: recipe.instructions, servings: recipe.servings,
    total_time: recipe.total_time,
  })}`;

  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.4, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    return json(JSON.parse(txt));
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }
};
