import { json, type Env } from "./_helpers.ts";

// POST /api/edit-plan { plan, instruction }
// Natural-language editing of the whole week. The model picks replacement
// recipes strictly from the existing catalog (by id); the client applies the
// returned slot changes. We never invent recipes here — only re-slot real ones.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { plan, instruction } = await ctx.request.json<any>();
  if (!instruction?.trim()) return json({ error: "instruction required" }, 400);

  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, primary_protein, cuisine, total_time,
            is_vegetarian, is_pescatarian, is_gluten_free, is_dairy_free
     FROM recipes`,
  ).all();

  const catalog = (results as any[]).map((r) => {
    const tags = [
      r.is_vegetarian ? "veg" : "", r.is_pescatarian ? "pesc" : "",
      r.is_gluten_free ? "gf" : "", r.is_dairy_free ? "df" : "",
    ].filter(Boolean).join(",");
    return `${r.id} | ${r.name} | ${r.primary_protein} | ${r.cuisine || "-"} | ${r.total_time}m${tags ? " | " + tags : ""}`;
  }).join("\n");

  const current = (plan || []).map((p: any) =>
    `${p.day_of_week} ${p.slot}: ${p.recipe_name || "(empty)"}${p.is_leftover ? " [leftover]" : ""}`).join("\n");

  const PROMPT = `You edit a family's weekly meal plan. Days are 1=Mon..7=Sun, slots are
"lunch" and "dinner".

CURRENT PLAN:
${current || "(empty)"}

AVAILABLE RECIPES (id | name | protein | cuisine | time | diet-tags). You may ONLY
choose recipes from this list, by their exact id:
${catalog}

INSTRUCTION: ${instruction}

Apply the instruction by swapping recipes. Keep protein/cuisine variety across the
week, prefer not to repeat a recipe already in the plan, and respect any diet/cost
intent (e.g. "vegetarian" → veg-tagged, "cheaper" → simple staples, quick times).
Return ONLY a JSON array of the slots you are changing, each:
{"day_of_week":<1-7>,"slot":"lunch|dinner","recipe_id":"<exact id from the list>"}
Return [] if nothing should change. No prose.`;

  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.3, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    const changes = JSON.parse(txt);
    const valid = Array.isArray(changes)
      ? changes.filter((c: any) => c && c.recipe_id && c.day_of_week >= 1 &&
          c.day_of_week <= 7 && (c.slot === "lunch" || c.slot === "dinner"))
      : [];
    return json({ changes: valid });
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }
};
