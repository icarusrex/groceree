import { json, type Env } from "./_helpers.ts";

// POST /api/generate-recipe { prompt, servings, diet?, max_active_minutes?, country? }
// Invents a recipe from a free-text prompt, in the same shape /api/recipes POST
// stores and the engine consumes.
//
// servings is not a hint: the planner scales the shopping list by
// (plan item servings / recipe servings), and assignSlot stamps the plan item
// with settings.household_size. So a recipe generated at exactly that number
// scales by 1 and its quantities reach the shopping list untouched. Models
// routinely ignore a serving count and hand back "serves 4" anyway, so the
// result is rescaled server-side rather than trusted - see normalise().

const CATEGORIES = ["meat", "seafood", "dairy", "produce", "pantry", "frozen"];
const DIET_RULES: Record<string, string> = {
  gluten_free: "must be gluten free",
  vegetarian: "must be vegetarian (no meat, no fish)",
  pescatarian: "no meat other than fish/seafood",
  dairy_free: "must be dairy free",
};

interface Ing { name: string; quantity: number | null; unit: string; category: string }

// Force the recipe onto the requested serving count, rescaling quantities if the
// model returned a different one, and drop anything malformed.
export function normalise(rec: any, want: number) {
  const got = Number(rec?.servings) > 0 ? Number(rec.servings) : want;
  const factor = want / got;
  const ingredients: Ing[] = (Array.isArray(rec?.ingredients) ? rec.ingredients : [])
    .filter((i: any) => i && typeof i.name === "string" && i.name.trim())
    .map((i: any) => {
      const q = Number(i.quantity);
      return {
        name: String(i.name).trim(),
        // round to 2dp so 333.3333g does not reach the shopping list
        quantity: Number.isFinite(q) && q > 0 ? Math.round(q * factor * 100) / 100 : null,
        unit: typeof i.unit === "string" ? i.unit.trim() : "",
        category: CATEGORIES.includes(i.category) ? i.category : "pantry",
      };
    });
  return {
    ...rec,
    name: String(rec?.name || "Custom recipe").trim(),
    servings: want,
    ingredients,
    instructions: Array.isArray(rec?.instructions) ? rec.instructions.map(String) : [],
    total_time: Number(rec?.total_time) > 0 ? Number(rec.total_time) : 30,
    primary_protein: rec?.primary_protein || "none",
    is_gluten_free: !!rec?.is_gluten_free,
    is_vegetarian: !!rec?.is_vegetarian,
    is_pescatarian: !!rec?.is_pescatarian,
    is_dairy_free: !!rec?.is_dairy_free,
    contains_dairy: !!rec?.contains_dairy,
    source: "prompt",
    rescaled: factor !== 1 ? { from: got, to: want } : null,
  };
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>();
  const prompt = String(body?.prompt || "").trim();
  if (!prompt) return json({ error: "prompt required" }, 400);

  // Rounded, not just clamped: household_size is INTEGER in the schema but
  // SQLite is dynamically typed and a fractional value can get stored (found
  // 4.5 in production), which would otherwise ask the model to cook "for
  // exactly 4.5 people" and scale every quantity off that.
  const want = Math.max(1, Math.min(20, Math.round(Number(body?.servings) || 4)));
  const diet: string[] = Array.isArray(body?.diet) ? body.diet : [];
  const maxMin = Number(body?.max_active_minutes) || null;

  const rules = [
    ...diet.map((d) => DIET_RULES[d]).filter(Boolean),
    maxMin ? `total time must be at most ${maxMin} minutes` : "",
    body?.country === "CZ"
      ? "use ingredients easily bought in a Czech supermarket"
      : "use ingredients easily bought in a Portuguese supermarket",
  ].filter(Boolean);

  const PROMPT = `You are a recipe writer. Invent ONE realistic, cookable dish from
the user's request. Quantities must be REAL shopping amounts for exactly ${want}
people - weigh things in g/kg/ml/l or whole units, never "to taste" for a main
ingredient. Set "servings" to ${want}.
${rules.length ? "Constraints: " + rules.join("; ") + "." : ""}

Return ONLY JSON, no prose, shaped:
{"name":"<dish name>","description":"<one line>","cuisine":"<e.g. portuguese>",
 "ingredients":[{"name":"","quantity":<number|null>,"unit":"","category":"meat|seafood|dairy|produce|pantry|frozen"}],
 "instructions":["step", "..."],
 "primary_protein":"chicken|beef|pork|turkey|fish|lamb|duck|none",
 "is_gluten_free":<bool>,"is_vegetarian":<bool>,"is_pescatarian":<bool>,
 "is_dairy_free":<bool>,"contains_dairy":<bool>,
 "total_time":<minutes>,"servings":${want}}

REQUEST: ${prompt}`;

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.7, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);

  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    const rec = normalise(JSON.parse(txt), want);
    if (!rec.ingredients.length) return json({ error: "the model returned no usable ingredients — try rephrasing" }, 502);
    return json(rec);
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }
};
