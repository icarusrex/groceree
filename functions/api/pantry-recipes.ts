import { json, uid, type Env } from "./_helpers.ts";

// POST /api/pantry-recipes — generate recipe ideas from current pantry items
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { results } = await ctx.env.DB.prepare(
    "SELECT raw_text FROM pantry_items WHERE user_id=?",
  ).bind(uid(ctx)).all();
  const items = (results as any[]).map((r) => r.raw_text);
  if (!items.length) return json({ error: "pantry is empty" }, 400);

  const PROMPT = `I have these pantry items: ${items.join(", ")}.
Suggest 3 simple, cheap, family-friendly lunch/dinner recipes that mainly use what
I have (assume basics like oil, salt, pepper on hand). Prefer raw-ingredient cooking.
Return ONLY a JSON array of 3 objects:
[{"name","description","total_time":<min>,"servings":<n>,
  "ingredients":[{"name","quantity","unit","category":"meat|seafood|dairy|produce|pantry|frozen"}],
  "instructions":["step"],
  "primary_protein":"chicken|beef|pork|turkey|fish|none",
  "is_gluten_free":<bool>,"is_vegetarian":<bool>,"is_pescatarian":<bool>,
  "is_dairy_free":<bool>,"contains_dairy":<bool>}]`;

  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.6, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    return json({ recipes: JSON.parse(txt) });
  } catch { return json({ error: "could not parse output" }, 502); }
};
